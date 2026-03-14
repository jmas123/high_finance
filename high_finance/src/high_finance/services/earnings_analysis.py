"""
Earnings Press Release Analysis (8-K Item 2.02)
================================================
Fetches the latest 8-K earnings filing from SEC EDGAR, extracts the press
release text, and sends it to Claude Haiku for structured extraction of:
- Reported results (revenue, EPS, margins) with beat/miss vs estimates
- Forward guidance
- Sentiment analysis
- Key management quotes
- Investor-focused summary

Reuses:
  - sec_sic._load_ticker_map() + SEC_HEADERS for CIK lookup & auth
  - core.llm.get_anthropic_client() + HAIKU_MODEL for LLM
  - core.cache.get_or_compute() for 24-hour caching
"""

import asyncio
import json
import logging
import re
from html.parser import HTMLParser

import httpx

from high_finance.core.cache import get_or_compute
from high_finance.core.llm import get_anthropic_client, HAIKU_MODEL
from high_finance.services.sec_sic import _load_ticker_map, SEC_HEADERS


logger = logging.getLogger(__name__)

# ── HTML stripper (stdlib only, no new deps) ────────────────────────────────

_SKIP_TAGS = {"script", "style"}


class _HTMLTextExtractor(HTMLParser):
    """Strip HTML tags and return plain text."""

    def __init__(self):
        super().__init__()
        self._parts: list[str] = []
        self._skip_depth = 0

    def handle_starttag(self, tag: str, attrs: list) -> None:
        if tag.lower() in _SKIP_TAGS:
            self._skip_depth += 1

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() in _SKIP_TAGS and self._skip_depth > 0:
            self._skip_depth -= 1

    def handle_data(self, data: str) -> None:
        if self._skip_depth == 0:
            self._parts.append(data)

    def get_text(self) -> str:
        raw = " ".join(self._parts)
        # Collapse whitespace
        return re.sub(r"\s+", " ", raw).strip()


def _strip_html(html_text: str) -> str:
    """Convert HTML to plain text using stdlib HTMLParser."""
    extractor = _HTMLTextExtractor()
    try:
        extractor.feed(html_text)
    except Exception:
        # If HTML is malformed, return as-is with tags stripped via regex
        return re.sub(r"<[^>]+>", " ", html_text)
    return extractor.get_text()


# ── SEC EDGAR helpers ───────────────────────────────────────────────────────

async def _find_latest_8k_earnings(ticker: str) -> dict | None:
    """
    Find the most recent 8-K Item 2.02 filing for a ticker.

    SEC submissions JSON has a columnar layout under filings.recent:
      accessionNumber[], filingDate[], reportDate[], form[], items[], primaryDocument[]
    We iterate to find the first 8-K with "2.02" in items.
    """
    ticker_upper = ticker.upper()
    # _load_ticker_map is sync (cached in-memory) — fast enough for inline use
    cik_map = await asyncio.to_thread(_load_ticker_map)
    cik = cik_map.get(ticker_upper)
    if cik is None:
        return None

    padded_cik = str(cik).zfill(10)
    url = f"https://data.sec.gov/submissions/CIK{padded_cik}.json"

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(url, headers=SEC_HEADERS)
        resp.raise_for_status()
        data = resp.json()

    recent = data.get("filings", {}).get("recent", {})
    forms = recent.get("form", [])
    items_list = recent.get("items", [])
    accessions = recent.get("accessionNumber", [])
    filing_dates = recent.get("filingDate", [])
    report_dates = recent.get("reportDate", [])
    primary_docs = recent.get("primaryDocument", [])

    for i in range(len(forms)):
        if forms[i] == "8-K" and "2.02" in items_list[i]:
            return {
                "cik": cik,
                "accession_number": accessions[i],
                "filing_date": filing_dates[i],
                "report_date": report_dates[i],
                "primary_document": primary_docs[i],
            }

    return None


async def _find_exhibit_document(cik: int, accession: str, primary_document: str) -> str:
    """
    Find the Exhibit 99.1 press release in the filing's document index.

    The primaryDocument in SEC submissions is the 8-K cover page, NOT the
    press release. The actual earnings data lives in Exhibit 99.1, which is
    a separate .htm file in the filing folder.

    Strategy: fetch index.json, look for filenames containing "ex99" or
    "exhibit99". Fall back to the largest .htm that isn't the primary doc.
    """
    accession_no_dashes = accession.replace("-", "")
    base_url = f"https://www.sec.gov/Archives/edgar/data/{cik}/{accession_no_dashes}"
    index_url = f"{base_url}/index.json"

    await asyncio.sleep(0.15)

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(index_url, headers=SEC_HEADERS)
        resp.raise_for_status()
        index_data = resp.json()

    items = index_data.get("directory", {}).get("item", [])

    # Strategy 1: filename contains "ex99" or "exhibit99"
    for item in items:
        name = item.get("name", "").lower()
        if ("ex99" in name or "exhibit99" in name) and name.endswith(".htm"):
            return item["name"]

    # Strategy 2: largest .htm file that isn't the primary doc or index
    htm_items = []
    for item in items:
        name = item.get("name", "")
        name_lower = name.lower()
        if not name_lower.endswith((".htm", ".html")):
            continue
        if name == primary_document:
            continue
        if "index" in name_lower or name_lower.startswith("r"):
            continue
        size_str = item.get("size", "0")
        try:
            size = int(size_str)
        except (ValueError, TypeError):
            size = 0
        htm_items.append((name, size))

    if htm_items:
        # Sort by size descending — press release is typically the largest
        htm_items.sort(key=lambda x: x[1], reverse=True)
        return htm_items[0][0]

    # Fallback: just use primary document
    return primary_document


async def _fetch_filing_text(cik: int, accession: str, document: str) -> str:
    """
    Fetch a filing document from SEC EDGAR and return plain text.

    URL format: https://www.sec.gov/Archives/edgar/data/{cik}/{accession_no_dashes}/{document}
    Truncates to 50K chars at a sentence boundary to stay within LLM context limits.
    """
    accession_no_dashes = accession.replace("-", "")
    url = f"https://www.sec.gov/Archives/edgar/data/{cik}/{accession_no_dashes}/{document}"

    # 150ms delay for SEC rate limiting (10 req/s limit)
    await asyncio.sleep(0.15)

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(url, headers=SEC_HEADERS)
        if resp.status_code == 429:
            # Retry once after 1s
            await asyncio.sleep(1.0)
            resp = await client.get(url, headers=SEC_HEADERS)
        resp.raise_for_status()
        html = resp.text

    text = _strip_html(html)

    # Truncate at ~50K chars at sentence boundary
    max_chars = 50_000
    if len(text) > max_chars:
        cut = text[:max_chars]
        # Find last sentence end
        last_period = cut.rfind(".")
        if last_period > max_chars * 0.8:
            text = cut[: last_period + 1]
        else:
            text = cut

    return text


# ── LLM extraction ─────────────────────────────────────────────────────────

_SYSTEM_PROMPT = """You are extracting structured financial data from an SEC 8-K Item 2.02 earnings press release. Return ONLY valid JSON — no markdown fences, no commentary.

Extract the following structure:
{
  "quarter": "Q1 FY2025",
  "reported_results": {
    "revenue": {"value": 124300000000, "unit": "$", "yoy_change_pct": 8.5, "vs_estimate": "beat"|"miss"|"inline"|null, "surprise_pct": 2.1, "note": "$124.3B vs $121.7B est"},
    "eps": {"value": 2.40, "unit": "$", "yoy_change_pct": 12.0, "vs_estimate": "beat"|"miss"|"inline"|null, "surprise_pct": 3.0, "note": "$2.40 vs $2.14 prior year"}
  },
  "other_metrics": [{"name": "Gross Margin", "value": "46.9%", "unit": "%", "yoy_change_pct": 1.2, "note": "expanded 120bp YoY from 45.7%"}],
  "guidance": {
    "has_guidance": true,
    "next_quarter_revenue": {"low": 95000000000, "high": 100000000000},
    "next_quarter_eps": {"low": 1.50, "high": 1.60},
    "full_year_revenue": {"low": null, "high": null},
    "full_year_eps": {"low": null, "high": null},
    "capex": "Expected $2.5B for FY2025",
    "other_forward_items": ["Backlog expected to exceed $4B by year-end", "Hiring 500 new engineers"],
    "guidance_tone": "optimistic"|"cautious"|"neutral"|"pessimistic",
    "guidance_summary": "Management raised full-year guidance citing strong demand..."
  },
  "sentiment": {
    "overall": "positive"|"negative"|"neutral"|"mixed",
    "confidence": 82,
    "confidence_basis": "Strong revenue language, record backlog, raised guidance. Offset slightly by margin compression mention.",
    "tone_vs_prior": "more_optimistic"|"more_cautious"|"unchanged"|null,
    "key_positive_signals": ["record revenue", "strong margins"],
    "key_concerns": ["inventory build-up", "FX headwinds"]
  },
  "key_quotes": [{"speaker": "CEO", "quote": "exact quote...", "context": "opening remarks"}],
  "summary": "2-3 sentence investor-focused summary of key takeaways"
}

Rules:
- Extract ONLY information explicitly stated in the filing text.
- YoY changes: calculate yoy_change_pct from prior year figures when both are stated. Positive = growth, negative = decline. Set null if prior year not mentioned.
- Mark vs_estimate as "beat"/"miss"/"inline" ONLY if analyst estimates are mentioned. Otherwise null.
- Guidance: set has_guidance to false and all other guidance fields to null if NO forward-looking numbers or outlook are mentioned. Extract ALL forward numbers: revenue ranges, EPS ranges, capex, backlog targets, hiring plans, etc.
- Sentiment confidence: integer 0-100 indicating how clearly the press release signals the sentiment. 90+ = very clear (e.g., "record results", explicit raised guidance). 60-89 = moderately clear. Below 60 = ambiguous. Always include confidence_basis explaining what phrases drove the score.
- Keep key_quotes short (max 3 quotes, max 200 chars each).
- Numbers: use raw numeric values (not strings) for financial figures.
- Unit: set "unit" to "$" for dollar amounts, "%" for percentages/margins/rates, "#" for counts (users, subscribers, units), "x" for ratios/multiples, "" for dimensionless. This applies to both reported_results and other_metrics.
- Return valid JSON only."""

_USER_PROMPT_TEMPLATE = """Analyze this SEC 8-K Item 2.02 earnings press release and extract structured data:

---
{filing_text}
---"""

def _extract_json(raw_text: str) -> str:
    """
    Robustly extract JSON from LLM output that may include markdown fences
    or surrounding commentary.
    """
    # Strategy 1: extract content inside ```...``` fences
    fence_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", raw_text, re.DOTALL)
    if fence_match:
        return fence_match.group(1).strip()

    # Strategy 2: find the outermost { ... } block
    start = raw_text.find("{")
    if start != -1:
        # Walk backwards from end to find matching closing brace
        end = raw_text.rfind("}")
        if end != -1 and end > start:
            return raw_text[start : end + 1].strip()

    return raw_text.strip()






async def _analyze_with_llm(filing_text: str) -> dict:
    client = get_anthropic_client()

    response = await client.messages.create(
        model=HAIKU_MODEL,
        max_tokens=2000,
        temperature=0.2,
        system=_SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": _USER_PROMPT_TEMPLATE.format(filing_text=filing_text),
            }
        ],
    )

    raw_text = response.content[0].text
    cleaned = _extract_json(raw_text)

    try:
        result = json.loads(cleaned)
    except json.JSONDecodeError as e:
        # Log the FULL raw response so you can see exactly what Haiku returned
        logger.warning(
            "Haiku returned malformed JSON for earnings analysis. "
            "Parse error: %s. Raw response (first 1000 chars): %r",
            e,
            raw_text[:1000],
        )
        result = {"error": "malformed_response", "raw": raw_text[:500]}

    return {
        **result,
        "model": HAIKU_MODEL,
        "input_tokens": response.usage.input_tokens,
        "output_tokens": response.usage.output_tokens,
    }


# ── Public API ──────────────────────────────────────────────────────────────

async def analyze_earnings_press_release(ticker: str) -> dict:
    """
    Analyze the latest 8-K Item 2.02 earnings press release for a ticker.

    Cached for 24 hours (earnings don't change after publication).
    Returns structured dict with filing metadata + AI analysis.
    """
    ticker_upper = ticker.upper()

    async def _compute() -> dict:
        # 1. Find the latest 8-K earnings filing
        filing = await _find_latest_8k_earnings(ticker_upper)
        if filing is None:
            return {"error": "no_filing_found", "ticker": ticker_upper}

        # 2. Find the Exhibit 99.1 (actual press release, not the cover page)
        try:
            exhibit_doc = await _find_exhibit_document(
                filing["cik"],
                filing["accession_number"],
                filing["primary_document"],
            )
        except Exception:
            logger.warning("Could not fetch filing index for %s, falling back to primary doc", ticker_upper)
            exhibit_doc = filing["primary_document"]

        # 3. Fetch and parse the exhibit text
        try:
            text = await _fetch_filing_text(
                filing["cik"],
                filing["accession_number"],
                exhibit_doc,
            )
        except Exception as e:
            logger.exception("Failed to fetch 8-K exhibit for %s", ticker_upper)
            return {"error": "filing_fetch_failed", "detail": str(e)}

        if len(text.strip()) < 100:
            return {"error": "filing_empty", "ticker": ticker_upper}

        # 4. Run LLM extraction
        analysis = await _analyze_with_llm(text)

        # 5. Build filing URL — link to the exhibit (the actual press release)
        accession_no_dashes = filing["accession_number"].replace("-", "")
        filing_url = (
            f"https://www.sec.gov/Archives/edgar/data/"
            f"{filing['cik']}/{accession_no_dashes}/{exhibit_doc}"
        )

        return {
            **analysis,
            "filing_date": filing["filing_date"],
            "report_date": filing["report_date"],
            "filing_url": filing_url,
        }

    return await get_or_compute(
        key=f"hf:earnings_analysis:{ticker_upper}",
        ttl=86400,  # 24 hours
        compute_fn=_compute,
    )

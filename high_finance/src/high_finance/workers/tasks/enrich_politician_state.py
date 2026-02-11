"""
Enrich Politician State Data
=============================
Fills in Politician.state using the unitedstates/congress-legislators dataset.
The Quiver bulk endpoint (V1) doesn't include State, so we match politicians
by name against the authoritative public dataset.

Matching strategy (in order):
1. Exact bioguide_id match (most reliable)
2. Exact official_full name match
3. Normalized name match (strip prefixes, middle initials)
4. First + last name match (for nicknames like "Bill" vs "William")

Idempotent — safe to run multiple times.
"""

import logging
import re
from typing import Optional

import httpx
import yaml
from sqlalchemy.orm import Session

from high_finance.db.models.politician import Politician
from high_finance.db.session import SessionLocal
from high_finance.workers.tasks.base import tracked_job

logger = logging.getLogger(__name__)

BASE = "https://raw.githubusercontent.com/unitedstates/congress-legislators/main"

# Prefixes Quiver puts on names that congress-legislators doesn't use
_PREFIXES = re.compile(
    r"^(Mr\.|Mrs\.|Ms\.|Dr\.|Hon\.|Rep\.|Sen\.|Honorable)\s+", re.IGNORECASE
)
# Middle initial pattern: single uppercase letter followed by period
_MIDDLE_INITIAL = re.compile(r"\s+[A-Z]\.\s*")


def _normalize_name(name: str) -> str:
    """Strip prefixes, middle initials, extra whitespace. Lowercase."""
    name = _PREFIXES.sub("", name).strip()
    name = _MIDDLE_INITIAL.sub(" ", name).strip()
    return " ".join(name.lower().split())


def _chamber_from_type(term_type: str) -> str:
    """Convert congress-legislators term type to our chamber format."""
    return "Senate" if term_type == "sen" else "House"


def _build_legislator_maps(legislators: list[dict]) -> tuple[
    dict[str, dict],  # bioguide → info
    dict[str, dict],  # exact official_full (lowered) → info
    dict[str, dict],  # normalized name → info
    dict[str, dict],  # "first last" (lowered) → info
]:
    """Build lookup maps from the legislators dataset."""
    by_bioguide: dict[str, dict] = {}
    by_exact: dict[str, dict] = {}
    by_normalized: dict[str, dict] = {}
    by_first_last: dict[str, dict] = {}

    for leg in legislators:
        bio_id = leg.get("id", {}).get("bioguide", "")
        name_obj = leg.get("name", {})
        terms = leg.get("terms", [])
        if not terms:
            continue

        # Use the most recent term for state/chamber
        latest = terms[-1]
        state = latest.get("state")
        chamber = _chamber_from_type(latest.get("type", ""))

        info = {"state": state, "chamber": chamber, "bioguide": bio_id}

        if bio_id:
            by_bioguide[bio_id] = info

        official = name_obj.get("official_full", "")
        if official:
            by_exact[official.lower()] = info
            by_normalized[_normalize_name(official)] = info

        # first + last only (handles middle name mismatches)
        first = name_obj.get("first", "")
        last = name_obj.get("last", "")
        if first and last:
            by_first_last[f"{first} {last}".lower()] = info

            # Also add nickname if present
            nickname = name_obj.get("nickname", "")
            if nickname:
                by_first_last[f"{nickname} {last}".lower()] = info

    return by_bioguide, by_exact, by_normalized, by_first_last


def _match_politician(
    pol: Politician,
    by_bioguide: dict,
    by_exact: dict,
    by_normalized: dict,
    by_first_last: dict,
) -> Optional[dict]:
    """Try to match a politician against the legislature dataset."""
    # 1. Bioguide match (most reliable)
    if pol.bioguide_id and pol.bioguide_id in by_bioguide:
        return by_bioguide[pol.bioguide_id]

    name = (pol.name or "").strip()
    if not name:
        return None

    # 2. Exact name match
    match = by_exact.get(name.lower())
    if match:
        return match

    # 3. Normalized name match (strip Mr./Mrs., middle initials)
    normalized = _normalize_name(name)
    match = by_normalized.get(normalized)
    if match:
        return match

    # 4. First + last only
    match = by_first_last.get(normalized)
    if match:
        return match

    return None


def enrich_politician_state(db: Session) -> dict:
    """
    Fetch congress-legislators data and update Politician.state for
    any politician that's missing it.
    """
    # Fetch both current and historical legislators
    logger.info("Fetching current legislators...")
    current_resp = httpx.get(f"{BASE}/legislators-current.yaml", timeout=60)
    current_resp.raise_for_status()
    current = yaml.safe_load(current_resp.text)
    logger.info(f"Loaded {len(current)} current legislators")

    logger.info("Fetching historical legislators...")
    hist_resp = httpx.get(f"{BASE}/legislators-historical.yaml", timeout=120)
    hist_resp.raise_for_status()
    historical = yaml.safe_load(hist_resp.text)
    logger.info(f"Loaded {len(historical)} historical legislators")

    all_legislators = current + historical
    by_bioguide, by_exact, by_normalized, by_first_last = _build_legislator_maps(
        all_legislators
    )
    logger.info(
        "Built lookup maps: %d bioguide, %d exact, %d normalized, %d first_last",
        len(by_bioguide), len(by_exact), len(by_normalized), len(by_first_last),
    )

    # Find politicians missing state
    politicians = db.query(Politician).filter(Politician.state.is_(None)).all()
    logger.info(f"Found {len(politicians)} politicians with missing state")

    updated = 0
    unmatched = []

    for pol in politicians:
        match = _match_politician(
            pol, by_bioguide, by_exact, by_normalized, by_first_last
        )
        if match and match.get("state"):
            pol.state = match["state"]
            # Also backfill bioguide_id if we matched by name and it was missing
            if not pol.bioguide_id and match.get("bioguide"):
                pol.bioguide_id = match["bioguide"]
            updated += 1
        else:
            unmatched.append(pol.name)

    db.commit()
    logger.info(f"Updated {updated} politicians with state data")
    if unmatched:
        logger.info(f"Unmatched ({len(unmatched)}): {unmatched[:20]}")

    return {
        "status": "ok",
        "total_missing": len(politicians),
        "updated": updated,
        "unmatched_count": len(unmatched),
        "unmatched_sample": unmatched[:20],
    }


@tracked_job("enrich_politician_state")
def enrich_politician_state_job() -> dict:
    """RQ job wrapper."""
    db = SessionLocal()
    try:
        return enrich_politician_state(db)
    except Exception as e:
        db.rollback()
        logger.exception(f"Enrichment failed: {e}")
        return {"status": "error", "message": str(e)}
    finally:
        db.close()

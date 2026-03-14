"""
Test corpus: 20 financial headlines designed to expose VADER weaknesses.

Each headline targets a specific category where lexicon-based sentiment
analysis systematically fails on financial text. Ground truth labels
are from an investor's perspective (does this suggest stock goes up/down/flat?).

Usage:
    from headlines import HEADLINES
    for h in HEADLINES:
        print(h["text"], h["expected_label"])
"""

from typing import List, TypedDict


class Headline(TypedDict):
    text: str
    expected_label: str  # "positive" | "negative" | "neutral"
    category: str
    vader_trap: str  # Why VADER will likely misclassify


HEADLINES: List[Headline] = [
    # ── Category 1: Negation / Qualifiers ─────────────────────────────────────
    # VADER misses "despite", "fails to", "barely" — sees positive words only
    {
        "text": "Tesla misses estimates despite record deliveries",
        "expected_label": "negative",
        "category": "negation",
        "vader_trap": "'record' and 'deliveries' push compound positive; 'despite' negation ignored",
    },
    {
        "text": "Amazon fails to meet revenue expectations for Q3",
        "expected_label": "negative",
        "category": "negation",
        "vader_trap": "'fails to' is weak negation in VADER; 'revenue' and 'expectations' are neutral-positive",
    },
    {
        "text": "Netflix subscriber growth falls short despite price hikes",
        "expected_label": "negative",
        "category": "negation",
        "vader_trap": "'growth' scores positive; 'falls short' compound negation is underweighted",
    },
    {
        "text": "Nvidia guidance disappoints even as AI demand surges",
        "expected_label": "negative",
        "category": "negation",
        "vader_trap": "'surges' and 'demand' are strongly positive; 'disappoints' gets diluted",
    },
    # ── Category 2: Domain Jargon ─────────────────────────────────────────────
    # VADER's lexicon lacks financial terms: hawkish, delisting, margin compression
    {
        "text": "Fed signals hawkish pivot, rate cuts off the table",
        "expected_label": "negative",
        "category": "jargon",
        "vader_trap": "'hawkish' and 'pivot' absent from VADER lexicon; scores near neutral",
    },
    {
        "text": "Margin compression accelerates as input costs rise",
        "expected_label": "negative",
        "category": "jargon",
        "vader_trap": "'compression' and 'accelerates' not in financial context; 'rise' may score positive",
    },
    {
        "text": "Company faces delisting risk after audit failures",
        "expected_label": "negative",
        "category": "jargon",
        "vader_trap": "'delisting' absent from lexicon; 'risk' and 'failures' partially captured",
    },
    {
        "text": "Short interest surges to 25% of float amid accounting concerns",
        "expected_label": "negative",
        "category": "jargon",
        "vader_trap": "'surges' scores positive; 'short interest' context lost on lexicon",
    },
    # ── Category 3: Beat / Miss Framing ───────────────────────────────────────
    # "Beats" reads positive even when surrounding context is negative
    {
        "text": "Apple barely beats as iPhone sales slow for third quarter",
        "expected_label": "negative",
        "category": "beat_miss",
        "vader_trap": "'beats' scores positive; 'barely' is weak modifier; 'slow' underweighted",
    },
    {
        "text": "Meta beats on earnings but issues weak forward guidance",
        "expected_label": "negative",
        "category": "beat_miss",
        "vader_trap": "'beats' and 'earnings' push positive; 'weak guidance' in subordinate clause ignored",
    },
    {
        "text": "Google misses on revenue, beats on EPS by one cent",
        "expected_label": "negative",
        "category": "beat_miss",
        "vader_trap": "'beats' and 'misses' partially cancel; net result skews slightly positive",
    },
    {
        "text": "Microsoft cloud revenue beats but growth rate decelerates sharply",
        "expected_label": "negative",
        "category": "beat_miss",
        "vader_trap": "'beats' and 'growth' dominate; 'decelerates sharply' is unseen jargon",
    },
    # ── Category 4: PR Boilerplate ────────────────────────────────────────────
    # Positive-sounding language that is actually neutral / no new information
    {
        "text": "Company reaffirms full-year guidance in line with expectations",
        "expected_label": "neutral",
        "category": "boilerplate",
        "vader_trap": "'reaffirms' and 'expectations' have slight positive valence in VADER",
    },
    {
        "text": "Board of directors approves regular quarterly dividend",
        "expected_label": "neutral",
        "category": "boilerplate",
        "vader_trap": "'approves' scores positive; this is routine maintenance, not new information",
    },
    {
        "text": "CEO expresses confidence in long-term strategic vision",
        "expected_label": "neutral",
        "category": "boilerplate",
        "vader_trap": "'confidence' and 'strategic vision' are positive words in a meaningless context",
    },
    {
        "text": "Company announces leadership transition, CFO to retire in Q2",
        "expected_label": "neutral",
        "category": "boilerplate",
        "vader_trap": "'transition' and 'retire' may score slightly negative; this is routine succession",
    },
    # ── Category 5: Numeric Context ───────────────────────────────────────────
    # VADER ignores that 2% vs 15% estimate = miss; it only sees words
    {
        "text": "Revenue up 2% vs 15% analyst estimate, guidance cut",
        "expected_label": "negative",
        "category": "numeric",
        "vader_trap": "'up' and 'revenue' push positive; VADER cannot compare 2% vs 15%",
    },
    {
        "text": "Profit margins expand 50bps to 12.3%, above Street consensus",
        "expected_label": "positive",
        "category": "numeric",
        "vader_trap": "'expand' scores mildly positive but 'bps' and '12.3%' are noise to VADER",
    },
    {
        "text": "Earnings fall 40% year-over-year on restructuring charges",
        "expected_label": "negative",
        "category": "numeric",
        "vader_trap": "'fall' is weakly negative; 40% magnitude is invisible to lexicon scoring",
    },
    {
        "text": "Same-store sales decline 0.5%, slightly below flat estimate",
        "expected_label": "negative",
        "category": "numeric",
        "vader_trap": "'decline' is mildly negative but 0.5% seems small; 'slightly' dampens further",
    },
]


# ── Helpers ───────────────────────────────────────────────────────────────────

CATEGORIES = sorted(set(h["category"] for h in HEADLINES))

LABEL_SET = {"positive", "negative", "neutral"}


def accuracy(predictions: List[str], actuals: List[str]) -> float:
    """Overall accuracy as fraction 0.0-1.0."""
    if not predictions:
        return 0.0
    return sum(p == a for p, a in zip(predictions, actuals)) / len(predictions)


def per_category_accuracy(
    predictions: List[str],
    headlines: List[Headline],
) -> dict[str, dict[str, float | int]]:
    """Accuracy broken down by category."""
    from collections import defaultdict

    cat_correct: dict[str, int] = defaultdict(int)
    cat_total: dict[str, int] = defaultdict(int)

    for pred, h in zip(predictions, headlines):
        cat = h["category"]
        cat_total[cat] += 1
        if pred == h["expected_label"]:
            cat_correct[cat] += 1

    return {
        cat: {
            "correct": cat_correct[cat],
            "total": cat_total[cat],
            "accuracy": cat_correct[cat] / cat_total[cat] if cat_total[cat] > 0 else 0.0,
        }
        for cat in CATEGORIES
    }


def confusion_matrix(
    predictions: List[str], actuals: List[str]
) -> dict[str, dict[str, int]]:
    """3x3 confusion matrix: actual (rows) vs predicted (cols)."""
    labels = ["positive", "negative", "neutral"]
    matrix = {a: {p: 0 for p in labels} for a in labels}
    for pred, actual in zip(predictions, actuals):
        if actual in matrix and pred in matrix[actual]:
            matrix[actual][pred] += 1
    return matrix


def print_confusion_matrix(matrix: dict[str, dict[str, int]]) -> None:
    """Pretty-print a confusion matrix."""
    labels = ["positive", "negative", "neutral"]
    header = f"{'Actual \\ Pred':<16}" + "".join(f"{l:<12}" for l in labels)
    print(header)
    print("-" * len(header))
    for actual in labels:
        row = f"{actual:<16}" + "".join(f"{matrix[actual][pred]:<12}" for pred in labels)
        print(row)

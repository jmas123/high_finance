#!/usr/bin/env python3
"""
VADER Sentiment Baseline — Benchmark against financial headline corpus.

Uses the same SentimentIntensityAnalyzer as production news.py.
No extra dependencies required.

Usage:
    python studies/01_vader_baseline.py
"""

from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

from headlines import (
    HEADLINES,
    accuracy,
    confusion_matrix,
    per_category_accuracy,
    print_confusion_matrix,
)


_analyzer = SentimentIntensityAnalyzer()


# ── VADER classification ─────────────────────────────────────────────────────

POSITIVE_THRESHOLD = 0.05
NEGATIVE_THRESHOLD = -0.05


def vader_classify(text: str) -> tuple[str, float]:
    """Classify headline using VADER compound score thresholds.

    Returns (label, compound_score).
    Same thresholds as standard VADER documentation.
    """
    scores = _analyzer.polarity_scores(text)
    compound = scores["compound"]
    if compound >= POSITIVE_THRESHOLD:
        label = "positive"
    elif compound <= NEGATIVE_THRESHOLD:
        label = "negative"
    else:
        label = "neutral"
    return label, compound


def score_all() -> tuple[list[str], list[float]]:
    """Score all headlines, return (labels, compounds)."""
    labels = []
    compounds = []
    for h in HEADLINES:
        label, compound = vader_classify(h["text"])
        labels.append(label)
        compounds.append(compound)
    return labels, compounds


# ── Display ───────────────────────────────────────────────────────────────────


def main() -> None:
    print("=" * 90)
    print("VADER SENTIMENT BASELINE")
    print("=" * 90)
    print()

    predictions, compounds = score_all()
    actuals = [h["expected_label"] for h in HEADLINES]

    # Per-headline table
    print(f"{'#':<4}{'Headline':<62}{'Expected':<11}{'VADER':<11}{'Comp':>6}  {'OK?'}")
    print("-" * 100)

    for i, (h, pred, comp) in enumerate(zip(HEADLINES, predictions, compounds), 1):
        title = h["text"][:60].ljust(60)
        correct = "Y" if pred == h["expected_label"] else "X"
        marker = "" if correct == "Y" else " <-- MISS"
        print(f"{i:<4}{title}  {h['expected_label']:<11}{pred:<11}{comp:>6.3f}  {correct}{marker}")

    print()

    # Overall accuracy
    overall = accuracy(predictions, actuals)
    correct_count = sum(p == a for p, a in zip(predictions, actuals))
    print(f"Overall accuracy: {correct_count}/{len(HEADLINES)} ({overall:.0%})")
    print()

    # Per-category accuracy
    print("Per-category accuracy:")
    print(f"  {'Category':<16}{'Correct':<10}{'Total':<8}{'Accuracy'}")
    print(f"  {'-'*42}")
    cat_acc = per_category_accuracy(predictions, HEADLINES)
    for cat, stats in sorted(cat_acc.items()):
        print(f"  {cat:<16}{stats['correct']:<10}{stats['total']:<8}{stats['accuracy']:.0%}")
    print()

    # Confusion matrix
    print("Confusion matrix (rows=actual, cols=predicted):")
    cm = confusion_matrix(predictions, actuals)
    print_confusion_matrix(cm)
    print()

    # Notable misses with explanations
    print("Notable misclassifications:")
    print("-" * 80)
    for i, (h, pred, comp) in enumerate(zip(HEADLINES, predictions, compounds), 1):
        if pred != h["expected_label"]:
            print(f"  [{i}] \"{h['text'][:70]}\"")
            print(f"      Expected: {h['expected_label']}, Got: {pred} (compound={comp:.3f})")
            print(f"      Why: {h['vader_trap']}")
            print()


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
FinBERT Sentiment Benchmark — Accuracy + Latency profiling.

Requires: pip install -r studies/requirements-study.txt
(transformers + torch CPU-only)

Usage:
    python studies/02_finbert_benchmark.py
"""

import resource
import sys
import time
from typing import Optional

from headlines import (
    HEADLINES,
    accuracy,
    confusion_matrix,
    per_category_accuracy,
    print_confusion_matrix,
)


# ── FinBERT Loading ──────────────────────────────────────────────────────────


def load_finbert():
    """Load FinBERT pipeline. Returns (pipeline, cold_start_seconds)."""
    t0 = time.perf_counter()
    from transformers import pipeline

    pipe = pipeline(
        "sentiment-analysis",
        model="ProsusAI/finbert",
        tokenizer="ProsusAI/finbert",
    )
    cold_start = time.perf_counter() - t0
    return pipe, cold_start


# ── Classification ────────────────────────────────────────────────────────────


def finbert_classify(pipe, text: str) -> tuple[str, float]:
    """Classify a single headline with FinBERT.

    FinBERT returns: {"label": "positive"|"negative"|"neutral", "score": 0.0-1.0}
    Maps directly to our label set.
    """
    result = pipe(text, truncation=True, max_length=128)[0]
    return result["label"], result["score"]


def score_all(pipe) -> tuple[list[str], list[float]]:
    """Score all headlines, return (labels, confidences)."""
    labels = []
    confidences = []
    for h in HEADLINES:
        label, conf = finbert_classify(pipe, h["text"])
        labels.append(label)
        confidences.append(conf)
    return labels, confidences


# ── VADER for comparison ──────────────────────────────────────────────────────


def vader_latency_20() -> float:
    """Time VADER on all 20 headlines for comparison."""
    from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

    analyzer = SentimentIntensityAnalyzer()
    t0 = time.perf_counter()
    for h in HEADLINES:
        analyzer.polarity_scores(h["text"])
    return time.perf_counter() - t0


# ── Display ───────────────────────────────────────────────────────────────────


def main() -> None:
    print("=" * 90)
    print("FINBERT SENTIMENT BENCHMARK")
    print("=" * 90)
    print()

    # Load model (measures cold start)
    print("Loading FinBERT model (first run downloads ~250MB)...")
    pipe, cold_start = load_finbert()
    print(f"Cold start (import + model load): {cold_start:.2f}s")
    print()

    # First inference latency
    t0 = time.perf_counter()
    finbert_classify(pipe, HEADLINES[0]["text"])
    first_inference = (time.perf_counter() - t0) * 1000
    print(f"First inference: {first_inference:.1f}ms")

    # Accuracy section
    print()
    print("-" * 90)
    print("ACCURACY")
    print("-" * 90)
    print()

    predictions, confidences = score_all(pipe)
    actuals = [h["expected_label"] for h in HEADLINES]

    # Per-headline table
    print(f"{'#':<4}{'Headline':<55}{'Expected':<11}{'FinBERT':<11}{'Conf':>5}  {'OK?'}")
    print("-" * 95)

    for i, (h, pred, conf) in enumerate(zip(HEADLINES, predictions, confidences), 1):
        title = h["text"][:53].ljust(53)
        correct = "Y" if pred == h["expected_label"] else "X"
        marker = "" if correct == "Y" else " <-- MISS"
        print(f"{i:<4}{title}  {h['expected_label']:<11}{pred:<11}{conf:>5.2f}  {correct}{marker}")

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

    # Latency section
    print("-" * 90)
    print("LATENCY")
    print("-" * 90)
    print()

    # Steady state: average of 3 full passes
    pass_times = []
    for _ in range(3):
        t0 = time.perf_counter()
        for h in HEADLINES:
            pipe(h["text"], truncation=True, max_length=128)
        pass_times.append(time.perf_counter() - t0)

    avg_pass = sum(pass_times) / len(pass_times)
    per_headline = (avg_pass / len(HEADLINES)) * 1000  # ms

    vader_time = vader_latency_20()

    print(f"Cold start (import + model load):  {cold_start:.2f}s")
    print(f"First inference:                   {first_inference:.1f}ms")
    print(f"Steady state per headline:         {per_headline:.1f}ms")
    print(f"Projected 20 headlines:            {avg_pass:.3f}s")
    print(f"VADER 20 headlines:                {vader_time * 1000:.1f}ms")
    print(f"FinBERT / VADER ratio:             {avg_pass / vader_time:.0f}x slower")
    print()

    # Production feasibility
    print("-" * 90)
    print("PRODUCTION FEASIBILITY")
    print("-" * 90)
    print()

    # Peak RSS memory
    usage = resource.getrusage(resource.RUSAGE_SELF)
    peak_rss_mb = usage.ru_maxrss / (1024 * 1024)  # macOS reports bytes
    if sys.platform == "linux":
        peak_rss_mb = usage.ru_maxrss / 1024  # Linux reports KB

    print(f"Peak RSS memory: {peak_rss_mb:.0f} MB")
    if peak_rss_mb > 512:
        print("WARNING: Peak RSS > 512MB — likely OOM risk on Railway containers")
    else:
        print("Memory within 512MB Railway limit")

    # Model size estimate
    try:
        import os

        from transformers import AutoModelForSequenceClassification

        model_path = AutoModelForSequenceClassification.from_pretrained(
            "ProsusAI/finbert"
        ).config._name_or_path
        # Try to find cached model size
        cache_dir = os.path.expanduser("~/.cache/huggingface/hub")
        total_size = 0
        for dirpath, _, filenames in os.walk(cache_dir):
            if "finbert" in dirpath.lower():
                for f in filenames:
                    total_size += os.path.getsize(os.path.join(dirpath, f))
        if total_size > 0:
            print(f"Model size on disk: ~{total_size / (1024*1024):.0f} MB")
        else:
            print("Model size on disk: ~250 MB (estimated)")
    except Exception:
        print("Model size on disk: ~250 MB (estimated)")

    print()
    print("Summary:")
    print(f"  + Accuracy: {overall:.0%} (vs VADER baseline)")
    print(f"  + Latency per headline: {per_headline:.1f}ms")
    print(f"  - Cold start: {cold_start:.2f}s (first request after deploy)")
    print(f"  - Memory: {peak_rss_mb:.0f}MB RSS")
    print(f"  - Deps: +1.1GB (transformers + torch CPU)")


if __name__ == "__main__":
    main()

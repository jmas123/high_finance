#!/usr/bin/env python3
"""
Side-by-side comparison of all four sentiment methods.

Imports scoring functions from 01, 02, 03, 03b and produces unified tables.
Handles FinBERT/Haiku/DeepSeek being unavailable (skips with warning).

Usage:
    python studies/04_comparison_table.py

    # With API keys:
    ANTHROPIC_API_KEY=sk-... DEEPSEEK_API_KEY=sk-... python studies/04_comparison_table.py
"""

import os
import sys
import time

from headlines import (
    HEADLINES,
    accuracy,
    per_category_accuracy,
)


def _run_vader() -> tuple[list[str], list[float], float]:
    """Run VADER, return (labels, compounds, total_time_seconds)."""
    from vader_baseline_01 import score_all as vader_score_all, vader_classify

    t0 = time.perf_counter()
    labels, compounds = vader_score_all()
    elapsed = time.perf_counter() - t0
    return labels, compounds, elapsed


def _run_finbert() -> tuple[list[str], list[float], float, float] | None:
    """Run FinBERT, return (labels, confidences, inference_time, cold_start) or None."""
    try:
        from finbert_benchmark_02 import load_finbert, score_all as finbert_score_all
    except ImportError:
        print("WARNING: FinBERT unavailable (torch/transformers not installed). Skipping.")
        return None

    try:
        pipe, cold_start = load_finbert()
        t0 = time.perf_counter()
        labels, confidences = finbert_score_all(pipe)
        elapsed = time.perf_counter() - t0
        return labels, confidences, elapsed, cold_start
    except Exception as e:
        print(f"WARNING: FinBERT failed: {e}. Skipping.")
        return None


def _run_haiku() -> tuple[list[str], list[float], float, float] | None:
    """Run Haiku, return (labels, confidences, latency_ms, cost_usd) or None."""
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("WARNING: ANTHROPIC_API_KEY not set. Skipping Haiku benchmark.")
        return None

    try:
        from anthropic_prototype_03 import haiku_batch_sentiment_sync
    except ImportError as e:
        print(f"WARNING: Haiku import failed: {e}. Skipping.")
        return None

    try:
        result = haiku_batch_sentiment_sync(HEADLINES, api_key)
        haiku_results = result["results"]
        if len(haiku_results) != len(HEADLINES):
            print(f"WARNING: Haiku returned {len(haiku_results)} results, expected {len(HEADLINES)}")
            return None
        labels = [r.get("label", "unknown") for r in haiku_results]
        confidences = [r.get("confidence", 0.0) for r in haiku_results]
        return labels, confidences, result["latency_ms"], result["cost_usd"]
    except Exception as e:
        print(f"WARNING: Haiku call failed: {e}. Skipping.")
        return None


def _run_deepseek() -> tuple[list[str], list[float], float, float] | None:
    """Run DeepSeek, return (labels, confidences, latency_ms, cost_usd) or None."""
    api_key = os.environ.get("DEEPSEEK_API_KEY")
    if not api_key:
        print("WARNING: DEEPSEEK_API_KEY not set. Skipping DeepSeek benchmark.")
        return None

    try:
        from deepseek_prototype_03b import deepseek_batch_sentiment_sync
    except ImportError as e:
        print(f"WARNING: DeepSeek import failed: {e}. Skipping.")
        return None

    try:
        result = deepseek_batch_sentiment_sync(HEADLINES, api_key)
        ds_results = result["results"]
        if len(ds_results) != len(HEADLINES):
            print(f"WARNING: DeepSeek returned {len(ds_results)} results, expected {len(HEADLINES)}")
            return None
        labels = [r.get("label", "unknown") for r in ds_results]
        confidences = [r.get("confidence", 0.0) for r in ds_results]
        return labels, confidences, result["latency_ms"], result["cost_usd"]
    except Exception as e:
        print(f"WARNING: DeepSeek call failed: {e}. Skipping.")
        return None


def main() -> None:
    print("=" * 120)
    print("SENTIMENT METHOD COMPARISON")
    print("=" * 120)
    print()

    actuals = [h["expected_label"] for h in HEADLINES]

    # Run all methods
    print("Running VADER...")
    vader_labels, vader_compounds, vader_time = _run_vader()

    print("Running FinBERT...")
    finbert_result = _run_finbert()

    print("Running Haiku...")
    haiku_result = _run_haiku()

    print("Running DeepSeek...")
    deepseek_result = _run_deepseek()

    print()

    # ── Unified headline table ────────────────────────────────────────────────

    has_finbert = finbert_result is not None
    has_haiku = haiku_result is not None
    has_deepseek = deepseek_result is not None

    # Header
    header = f"{'#':<4}{'Headline':<45}{'Expected':<10}{'VADER':<10}"
    if has_finbert:
        header += f"{'FinBERT':<10}"
    if has_haiku:
        header += f"{'Haiku':<10}"
    if has_deepseek:
        header += f"{'DeepSeek':<10}"
    print(header)
    print("-" * len(header))

    for i, h in enumerate(HEADLINES):
        title = h["text"][:43].ljust(43)
        row = f"{i+1:<4}{title}  {h['expected_label']:<10}{vader_labels[i]:<10}"

        if has_finbert:
            row += f"{finbert_result[0][i]:<10}"
        if has_haiku:
            row += f"{haiku_result[0][i]:<10}"
        if has_deepseek:
            row += f"{deepseek_result[0][i]:<10}"

        # Mark row if any method got it wrong
        checks = [vader_labels[i] == h["expected_label"]]
        if has_finbert:
            checks.append(finbert_result[0][i] == h["expected_label"])
        if has_haiku:
            checks.append(haiku_result[0][i] == h["expected_label"])
        if has_deepseek:
            checks.append(deepseek_result[0][i] == h["expected_label"])

        if not all(checks):
            wrong = []
            if vader_labels[i] != h["expected_label"]:
                wrong.append("V")
            if has_finbert and finbert_result[0][i] != h["expected_label"]:
                wrong.append("F")
            if has_haiku and haiku_result[0][i] != h["expected_label"]:
                wrong.append("H")
            if has_deepseek and deepseek_result[0][i] != h["expected_label"]:
                wrong.append("D")
            row += f"  <-- miss: {','.join(wrong)}"

        print(row)

    print()

    # ── Summary table ─────────────────────────────────────────────────────────

    print("=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print()

    # Overall accuracy
    vader_acc = accuracy(vader_labels, actuals)
    print(f"  {'Method':<14}{'Accuracy':<12}{'Latency (20 hl)':<20}{'Cost/call':<14}{'Deps size'}")
    print(f"  {'-'*70}")
    print(f"  {'VADER':<14}{vader_acc:<12.0%}{vader_time*1000:<20.1f}ms{'$0.00':<14}{'0 MB'}")

    if has_finbert:
        fb_labels, _, fb_time, fb_cold = finbert_result
        fb_acc = accuracy(fb_labels, actuals)
        print(f"  {'FinBERT':<14}{fb_acc:<12.0%}{fb_time*1000:<20.1f}ms{'$0.00':<14}{'~900 MB'}")

    if has_haiku:
        hk_labels, _, hk_latency, hk_cost = haiku_result
        hk_acc = accuracy(hk_labels, actuals)
        print(f"  {'Haiku':<14}{hk_acc:<12.0%}{hk_latency:<20.0f}ms{'$'+f'{hk_cost:.4f}':<14}{'0 MB'}")

    if has_deepseek:
        ds_labels, _, ds_latency, ds_cost = deepseek_result
        ds_acc = accuracy(ds_labels, actuals)
        print(f"  {'DeepSeek':<14}{ds_acc:<12.0%}{ds_latency:<20.0f}ms{'$'+f'{ds_cost:.4f}':<14}{'0 MB'}")

    print()

    # Per-category comparison
    print("Per-category accuracy:")
    cat_header = f"  {'Category':<16}{'VADER':<10}"
    if has_finbert:
        cat_header += f"{'FinBERT':<10}"
    if has_haiku:
        cat_header += f"{'Haiku':<10}"
    if has_deepseek:
        cat_header += f"{'DeepSeek':<10}"
    print(cat_header)
    print(f"  {'-'*60}")

    vader_cat = per_category_accuracy(vader_labels, HEADLINES)
    finbert_cat = per_category_accuracy(finbert_result[0], HEADLINES) if has_finbert else {}
    haiku_cat = per_category_accuracy(haiku_result[0], HEADLINES) if has_haiku else {}
    deepseek_cat = per_category_accuracy(deepseek_result[0], HEADLINES) if has_deepseek else {}

    for cat in sorted(vader_cat.keys()):
        row = f"  {cat:<16}{vader_cat[cat]['accuracy']:<10.0%}"
        if has_finbert and cat in finbert_cat:
            row += f"{finbert_cat[cat]['accuracy']:<10.0%}"
        if has_haiku and cat in haiku_cat:
            row += f"{haiku_cat[cat]['accuracy']:<10.0%}"
        if has_deepseek and cat in deepseek_cat:
            row += f"{deepseek_cat[cat]['accuracy']:<10.0%}"
        print(row)

    print()

    # ── Markdown output for report ────────────────────────────────────────────

    print("=" * 80)
    print("MARKDOWN SNIPPET (for sentiment_upgrade.md)")
    print("=" * 80)
    print()

    methods = [("VADER", vader_acc, f"{vader_time*1000:.1f}ms", "$0.00", "0 MB")]
    if has_finbert:
        methods.append(("FinBERT", fb_acc, f"{fb_time*1000:.1f}ms", "$0.00", "~900 MB"))
    if has_haiku:
        methods.append(("Haiku", hk_acc, f"{hk_latency:.0f}ms", f"${hk_cost:.4f}", "0 MB"))
    if has_deepseek:
        methods.append(("DeepSeek", ds_acc, f"{ds_latency:.0f}ms", f"${ds_cost:.4f}", "0 MB"))

    print("| Method | Accuracy | Latency (20 headlines) | Cost/call | Deps size |")
    print("|--------|----------|------------------------|-----------|-----------|")
    for name, acc, lat, cost, deps in methods:
        print(f"| {name} | {acc:.0%} | {lat} | {cost} | {deps} |")

    print()
    print("| Category | " + " | ".join(m[0] for m in methods) + " |")
    print("|----------|" + "|".join("-------" for _ in methods) + "|")
    for cat in sorted(vader_cat.keys()):
        row = f"| {cat} | {vader_cat[cat]['accuracy']:.0%}"
        if has_finbert and cat in finbert_cat:
            row += f" | {finbert_cat[cat]['accuracy']:.0%}"
        if has_haiku and cat in haiku_cat:
            row += f" | {haiku_cat[cat]['accuracy']:.0%}"
        if has_deepseek and cat in deepseek_cat:
            row += f" | {deepseek_cat[cat]['accuracy']:.0%}"
        row += " |"
        print(row)


if __name__ == "__main__":
    # Handle imports — the study scripts use non-standard names with numbers
    # so we need to add the studies directory to sys.path and use importlib
    studies_dir = os.path.dirname(os.path.abspath(__file__))
    if studies_dir not in sys.path:
        sys.path.insert(0, studies_dir)

    # Import with aliases since module names start with numbers
    import importlib

    # Make modules available under clean names
    vader_mod = importlib.import_module("01_vader_baseline")
    sys.modules["vader_baseline_01"] = vader_mod

    try:
        finbert_mod = importlib.import_module("02_finbert_benchmark")
        sys.modules["finbert_benchmark_02"] = finbert_mod
    except ImportError:
        pass

    try:
        haiku_mod = importlib.import_module("03_anthropic_prototype")
        sys.modules["anthropic_prototype_03"] = haiku_mod
    except ImportError:
        pass

    try:
        deepseek_mod = importlib.import_module("03b_deepseek_prototype")
        sys.modules["deepseek_prototype_03b"] = deepseek_mod
    except ImportError:
        pass

    main()

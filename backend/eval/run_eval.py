"""
eval/run_eval.py - Evaluation Runner for Vaani Cyber-Bullying Moderation Engine.
Evaluates accuracy, precision, recall, F1, per-category and per-language metrics
across Devanagari, Gurmukhi, Romanized Indic languages, Hinglish, and English.
Saves the latest evaluation summary to eval/latest_summary.json.
"""

import os
import sys
import csv
import json
from datetime import datetime, timezone
from typing import Dict, Any, List

# Reconfigure stdout to utf-8 for Windows console
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

# Ensure backend root is on sys.path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.abspath(os.path.join(CURRENT_DIR, ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from services.classifier import classify_text


def calculate_metrics(tp: int, fp: int, tn: int, fn: int) -> Dict[str, float]:
    total = tp + fp + tn + fn
    accuracy = (tp + tn) / total if total > 0 else 0.0
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f1 = (2 * precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0
    return {
        "accuracy": round(accuracy, 4),
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1": round(f1, 4),
    }


def run_evaluation(csv_path: str = None) -> Dict[str, Any]:
    if not csv_path:
        csv_path = os.path.join(CURRENT_DIR, "eval_set.csv")

    with open(csv_path, "r", encoding="utf-8") as f:
        reader = list(csv.DictReader(f))

    tp, fp, tn, fn = 0, 0, 0, 0
    misclassified = []

    cat_stats: Dict[str, Dict[str, int]] = {}
    lang_stats: Dict[str, Dict[str, int]] = {}

    for row in reader:
        text = row["text"].strip()
        expected_label = row["label"].strip().lower()
        expected_flagged = (expected_label == "flagged")
        expected_cat = row.get("category", "Other").strip()
        expected_lang = row.get("language", "English").strip()

        # Initialize per-group counters
        if expected_cat not in cat_stats:
            cat_stats[expected_cat] = {"tp": 0, "fp": 0, "tn": 0, "fn": 0}
        if expected_lang not in lang_stats:
            lang_stats[expected_lang] = {"tp": 0, "fp": 0, "tn": 0, "fn": 0}

        pred = classify_text(text)
        pred_flagged = bool(pred.get("flagged"))

        if expected_flagged and pred_flagged:
            tp += 1
            cat_stats[expected_cat]["tp"] += 1
            lang_stats[expected_lang]["tp"] += 1
        elif not expected_flagged and not pred_flagged:
            tn += 1
            cat_stats[expected_cat]["tn"] += 1
            lang_stats[expected_lang]["tn"] += 1
        elif not expected_flagged and pred_flagged:
            fp += 1
            cat_stats[expected_cat]["fp"] += 1
            lang_stats[expected_lang]["fp"] += 1
            misclassified.append({
                "text": text,
                "expected_label": expected_label,
                "predicted_flagged": pred_flagged,
                "predicted_category": pred.get("category"),
                "reason": pred.get("explanation"),
                "error_type": "False Positive"
            })
        elif expected_flagged and not pred_flagged:
            fn += 1
            cat_stats[expected_cat]["fn"] += 1
            lang_stats[expected_lang]["fn"] += 1
            misclassified.append({
                "text": text,
                "expected_label": expected_label,
                "predicted_flagged": pred_flagged,
                "predicted_category": pred.get("category"),
                "reason": pred.get("explanation"),
                "error_type": "False Negative"
            })

    overall_metrics = calculate_metrics(tp, fp, tn, fn)

    per_category = {}
    for cat, counts in cat_stats.items():
        m = calculate_metrics(counts["tp"], counts["fp"], counts["tn"], counts["fn"])
        m["total"] = sum(counts.values())
        per_category[cat] = m

    per_language = {}
    for lng, counts in lang_stats.items():
        m = calculate_metrics(counts["tp"], counts["fp"], counts["tn"], counts["fn"])
        m["total"] = sum(counts.values())
        per_language[lng] = m

    summary = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "total_evaluated": len(reader),
        "true_positives": tp,
        "true_negatives": tn,
        "false_positives": fp,
        "false_negatives": fn,
        "metrics": overall_metrics,
        "per_category": per_category,
        "per_language": per_language,
        "misclassified_count": len(misclassified),
        "misclassified": misclassified
    }

    # Save to latest_summary.json
    summary_path = os.path.join(CURRENT_DIR, "latest_summary.json")
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)

    return summary


def print_evaluation_report(summary: Dict[str, Any]):
    print("=" * 80)
    print("VAANI CYBER-BULLYING ENGINE - BENCHMARK EVALUATION REPORT")
    print("=" * 80)
    print(f"Total Evaluated : {summary['total_evaluated']}")
    print(f"True Positives  : {summary['true_positives']} | False Positives : {summary['false_positives']}")
    print(f"True Negatives  : {summary['true_negatives']} | False Negatives : {summary['false_negatives']}")
    print("-" * 80)
    m = summary['metrics']
    print(f"OVERALL METRICS: Accuracy: {m['accuracy']*100:.2f}% | Precision: {m['precision']*100:.2f}% | Recall: {m['recall']*100:.2f}% | F1: {m['f1']*100:.2f}%")
    print("-" * 80)

    print("\nPER-CATEGORY BREAKDOWN:")
    print(f"{'Category':<22} {'Count':<8} {'Precision':<12} {'Recall':<12} {'F1-Score':<10}")
    print("-" * 65)
    for cat, stats in summary['per_category'].items():
        print(f"{cat:<22} {stats['total']:<8} {stats['precision']*100:<11.1f}% {stats['recall']*100:<11.1f}% {stats['f1']*100:<9.1f}%")

    print("\nPER-LANGUAGE BREAKDOWN:")
    print(f"{'Language':<25} {'Count':<8} {'Precision':<12} {'Recall':<12} {'F1-Score':<10}")
    print("-" * 68)
    for lng, stats in summary['per_language'].items():
        print(f"{lng:<25} {stats['total']:<8} {stats['precision']*100:<11.1f}% {stats['recall']*100:<11.1f}% {stats['f1']*100:<9.1f}%")

    print("\nMISCLASSIFIED CASES:")
    if not summary['misclassified']:
        print("  None! Perfect benchmark classification score (100%).")
    else:
        for i, item in enumerate(summary['misclassified'], 1):
            text_repr = item['text'].encode('ascii', 'backslashreplace').decode('ascii')
            print(f"  {i}. [{item['error_type']}] Expected: {item['expected_label']} | Text: \"{text_repr}\"")
            print(f"     Reason: {item['reason']}")
    print("=" * 80)


if __name__ == "__main__":
    summary = run_evaluation()
    print_evaluation_report(summary)

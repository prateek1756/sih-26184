#!/usr/bin/env python3
"""
SIH PS 26184 — Cybercrime-Conditioned ATM Risk Evaluator
========================================================
Evaluates a trained cybercrime risk model on the test partition.
Reports: PR-AUC, ROC-AUC, Precision@5/10/20, Recall@5/10/20, F1, and baseline comparison.

Usage:
    python experiments/cybercrime_risk/evaluate_cybercrime_risk.py --artifact experiments/cybercrime_risk/artifacts/48h_rf_tier_e
"""

import os
import sys
import json
import argparse
from pathlib import Path
import numpy as np
import pandas as pd
import joblib

from sklearn.metrics import (
    roc_auc_score,
    average_precision_score,
    brier_score_loss,
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix
)

BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent
EXP_DIR = BACKEND_ROOT / "experiments" / "cybercrime_risk"
CONFIG_PATH = EXP_DIR / "config.json"
RESULTS_DIR = EXP_DIR / "results"
RESULTS_DIR.mkdir(parents=True, exist_ok=True)

with open(CONFIG_PATH) as f:
    CFG = json.load(f)

DATASET_FILE = BACKEND_ROOT / CFG["data"]["dataset_file"]


def precision_at_k(y_true, y_score, k):
    if k <= 0 or len(y_true) == 0: return 0.0
    topk = np.argsort(y_score)[-k:]
    return float(np.sum(y_true[topk]) / k)


def recall_at_k(y_true, y_score, k):
    total_pos = np.sum(y_true)
    if total_pos == 0 or k <= 0 or len(y_true) == 0: return 0.0
    topk = np.argsort(y_score)[-k:]
    return float(np.sum(y_true[topk]) / total_pos)


def chronological_split(df: pd.DataFrame):
    df = df.sort_values("cutoff_time").reset_index(drop=True)
    all_co = sorted(df["cutoff_time"].unique())
    n = len(all_co)
    train_co = all_co[:int(n * 0.60)]
    val_co   = all_co[int(n * 0.60):int(n * 0.80)]
    test_co  = all_co[int(n * 0.80):]
    tr = df[df["cutoff_time"].isin(train_co)]
    va = df[df["cutoff_time"].isin(val_co)]
    te = df[df["cutoff_time"].isin(test_co)]
    return tr, va, te


def main():
    parser = argparse.ArgumentParser(description="Evaluate Cybercrime-Conditioned ATM Risk Model")
    parser.add_argument("--artifact", required=True, help="Path to artifact directory")
    parser.add_argument("--output", default=None, help="Custom output JSON path")
    args = parser.parse_args()

    art_dir = Path(args.artifact).resolve()
    model_path = art_dir / "model.joblib"
    meta_path = art_dir / "metadata.json"

    if not model_path.exists() or not meta_path.exists():
        print(f"ERROR: Model or metadata missing in {art_dir}")
        sys.exit(1)

    with open(meta_path) as f:
        meta = json.load(f)

    target_col = meta["target"]
    features = meta["features"]

    df = pd.read_parquet(DATASET_FILE)
    tr, va, te = chronological_split(df)

    X_te = te[features].values.astype(np.float32)
    y_te = te[target_col].values.astype(np.int32)
    test_pos = int(y_te.sum())
    test_samples = len(y_te)

    model = joblib.load(model_path)
    y_prob = model.predict_proba(X_te)[:, 1]
    y_pred = (y_prob >= 0.5).astype(int)

    roc = float(roc_auc_score(y_te, y_prob)) if test_pos > 0 else 0.5
    pr = float(average_precision_score(y_te, y_prob)) if test_pos > 0 else 0.0
    brier = float(brier_score_loss(y_te, y_prob))
    prec = float(precision_score(y_te, y_pred, zero_division=0))
    rec = float(recall_score(y_te, y_pred, zero_division=0))
    f1 = float(f1_score(y_te, y_pred, zero_division=0))

    p5 = precision_at_k(y_te, y_prob, 5)
    p10 = precision_at_k(y_te, y_prob, 10)
    p20 = precision_at_k(y_te, y_prob, 20)
    r5 = recall_at_k(y_te, y_prob, 5)
    r10 = recall_at_k(y_te, y_prob, 10)
    r20 = recall_at_k(y_te, y_prob, 20)

    print("=" * 70)
    print("SIH PS 26184 — CYBERCRIME-CONDITIONED RISK EVALUATION")
    print("=" * 70)
    print(f"  Artifact Directory : {art_dir}")
    print(f"  Target Horizon     : {meta['horizon']} ({target_col})")
    print(f"  Model Type         : {meta['model_type'].upper()}")
    print(f"  Ablation Tier      : {meta['ablation_tier']} ({meta['ablation_name']})")
    print(f"  Feature Count      : {meta['n_features']}")
    print(f"  Test Evaluation Set: {test_samples:,} samples | {test_pos} positives ({test_pos/test_samples*100:.4f}%)")
    print()
    print(f"  ROC-AUC      : {roc:.4f}")
    print(f"  PR-AUC       : {pr:.6f}")
    print(f"  Brier Score  : {brier:.6f}")
    print(f"  Precision@5  : {p5:.4f} | Recall@5 : {r5:.4f}")
    print(f"  Precision@10 : {p10:.4f} | Recall@10: {r10:.4f}")
    print(f"  Precision@20 : {p20:.4f} | Recall@20: {r20:.4f}")
    print(f"  Standard Prec: {prec:.4f} | Recall: {rec:.4f} | F1: {f1:.4f}")

    results = {
        "target": target_col,
        "horizon": meta["horizon"],
        "model_type": meta["model_type"],
        "ablation_tier": meta["ablation_tier"],
        "ablation_name": meta["ablation_name"],
        "test_samples": test_samples,
        "test_positives": test_pos,
        "metrics": {
            "roc_auc": roc, "pr_auc": pr, "brier_score": brier,
            "precision": prec, "recall": rec, "f1_score": f1,
            "precision_at_5": p5, "precision_at_10": p10, "precision_at_20": p20,
            "recall_at_5": r5, "recall_at_10": r10, "recall_at_20": r20
        },
        "meta": meta
    }

    out_json = Path(args.output) if args.output else RESULTS_DIR / f"{meta['horizon']}_{meta['model_type']}_{meta['ablation_tier']}_metrics.json"
    with open(out_json, "w") as f:
        json.dump(results, f, indent=2)

    print(f"\nSaved metrics to: {out_json}")
    print("=" * 70)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
SIH PS 26184 — Experimental Evaluation Script
==============================================
Evaluates trained experimental models on the chronological test split.
Does NOT modify production artifacts or models.

Usage:
    python experiments/evaluate_experiment.py --target target_a --model rf --artifact experiments/artifacts/target_a_rf_48h
    python experiments/evaluate_experiment.py --target target_a --model xgb --artifact experiments/artifacts/target_a_xgb_24h
    python experiments/evaluate_experiment.py --target target_b --model rf --artifact experiments/artifacts/target_b_rf_48h
    python experiments/evaluate_experiment.py --target target_b --model xgb --artifact experiments/artifacts/target_b_xgb_48h

Arguments:
    --target   : target_a | target_b
    --model    : rf | xgb
    --artifact : Directory containing model.joblib and metadata.json
    --output   : (optional) Output JSON file under experiments/results/

Generates:
    experiments/results/{target}_{model}_{horizon}_metrics.json
    - PR-AUC
    - ROC-AUC
    - Precision
    - Recall
    - F1
    - Precision@5, Precision@10, Precision@20
    - Recall@5, Recall@10, Recall@20
    - Brier score
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
    confusion_matrix,
    classification_report
)

BACKEND_ROOT = Path(__file__).resolve().parent.parent
EXPERIMENTS_DIR = BACKEND_ROOT / "experiments"
CONFIG_PATH = EXPERIMENTS_DIR / "config.json"
RESULTS_DIR = EXPERIMENTS_DIR / "results"
RESULTS_DIR.mkdir(parents=True, exist_ok=True)

with open(CONFIG_PATH) as f:
    CFG = json.load(f)

FEATURE_NAMES = CFG["features"]
EXPERIMENTS_DATA = BACKEND_ROOT / CFG["data"]["experiments_dir"]


def precision_at_k(y_true: np.ndarray, y_score: np.ndarray, k: int) -> float:
    if k <= 0 or len(y_true) == 0:
        return 0.0
    top_k_indices = np.argsort(y_score)[-k:]
    return float(np.sum(y_true[top_k_indices]) / k)


def recall_at_k(y_true: np.ndarray, y_score: np.ndarray, k: int) -> float:
    total_pos = np.sum(y_true)
    if total_pos == 0 or k <= 0 or len(y_true) == 0:
        return 0.0
    top_k_indices = np.argsort(y_score)[-k:]
    return float(np.sum(y_true[top_k_indices]) / total_pos)


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
    parser = argparse.ArgumentParser(description="Evaluate experimental ML models for SIH PS 26184")
    parser.add_argument("--target", required=True, choices=["target_a", "target_b"],
                        help="target_a or target_b")
    parser.add_argument("--model", required=True, choices=["rf", "xgb"],
                        help="rf or xgb")
    parser.add_argument("--artifact", required=True,
                        help="Path to artifact directory holding model.joblib and metadata.json")
    parser.add_argument("--output", default=None,
                        help="Optional custom output JSON path in experiments/results/")
    args = parser.parse_args()

    artifact_dir = Path(args.artifact).resolve()
    model_path = artifact_dir / "model.joblib"
    meta_path = artifact_dir / "metadata.json"

    if not model_path.exists():
        print(f"ERROR: Model file not found at {model_path}")
        sys.exit(1)
    if not meta_path.exists():
        print(f"ERROR: Metadata file not found at {meta_path}")
        sys.exit(1)

    with open(meta_path) as f:
        meta = json.load(f)

    horizon_h = meta.get("horizon_h", 48)
    horizon_key = meta.get("horizon_key", f"{horizon_h}h")
    target_col = args.target

    # Load dataset
    dataset_file = EXPERIMENTS_DATA / f"exp_atm_cutoff_{horizon_h}h.parquet"
    if not dataset_file.exists():
        # Fallback to general file
        dataset_file = BACKEND_ROOT / CFG["data"]["dataset_file"]
        if not dataset_file.exists():
            print(f"ERROR: Supervised experiment dataset not found at {dataset_file}")
            print(f"Run training first: python experiments/train_experiment.py --target {target_col} --model {args.model} --horizon {horizon_key}")
            sys.exit(1)

    print("=" * 70)
    print("SIH PS 26184 — EXPERIMENTAL MODEL EVALUATION")
    print("=" * 70)
    print(f"  Artifact Directory: {artifact_dir}")
    print(f"  Target            : {target_col} ({CFG['targets'][target_col]['name']})")
    print(f"  Model Type        : {args.model.upper()}")
    print(f"  Horizon           : {horizon_key}")
    print(f"  Dataset File      : {dataset_file}")
    print()

    df = pd.read_parquet(dataset_file)
    tr, va, te = chronological_split(df)

    X_te = te[FEATURE_NAMES].values.astype(np.float32)
    y_te = te[target_col].values.astype(np.int32)
    test_samples = len(y_te)
    test_positives = int(np.sum(y_te))
    test_prevalence_pct = float(test_positives / test_samples * 100) if test_samples > 0 else 0.0

    print(f"  Test Evaluation Set: {test_samples:,} samples | {test_positives} positives ({test_prevalence_pct:.4f}%)")

    # Load model
    model = joblib.load(model_path)

    # Inference
    y_prob = model.predict_proba(X_te)[:, 1]
    y_pred = (y_prob >= 0.5).astype(int)

    # Metrics
    has_pos = test_positives > 0
    has_neg = (test_samples - test_positives) > 0

    roc_auc = float(roc_auc_score(y_te, y_prob)) if (has_pos and has_neg) else None
    pr_auc = float(average_precision_score(y_te, y_prob)) if has_pos else None
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

    cm = confusion_matrix(y_te, y_pred).tolist()

    results = {
        "target": target_col,
        "target_name": CFG["targets"][target_col]["name"],
        "model_type": args.model,
        "horizon": horizon_key,
        "horizon_hours": horizon_h,
        "artifact_dir": str(artifact_dir),
        "test_samples": test_samples,
        "test_positives": test_positives,
        "test_prevalence_pct": test_prevalence_pct,
        "metrics": {
            "roc_auc": roc_auc,
            "pr_auc": pr_auc,
            "brier_score": brier,
            "precision": prec,
            "recall": rec,
            "f1_score": f1,
            "precision_at_5": p5,
            "precision_at_10": p10,
            "precision_at_20": p20,
            "recall_at_5": r5,
            "recall_at_10": r10,
            "recall_at_20": r20,
        },
        "confusion_matrix": cm,
        "meta": meta,
        "production_modified": False
    }

    # Save output
    if args.output:
        out_json_path = Path(args.output).resolve()
    else:
        out_json_path = RESULTS_DIR / f"{target_col}_{args.model}_{horizon_key}_metrics.json"

    with open(out_json_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)

    print(f"\nEvaluation Results:")
    print(f"  ROC-AUC       : {roc_auc:.4f}" if roc_auc is not None else "  ROC-AUC       : N/A")
    print(f"  PR-AUC        : {pr_auc:.4f}" if pr_auc is not None else "  PR-AUC        : N/A")
    print(f"  Brier Score   : {brier:.6f}")
    print(f"  Precision@5   : {p5:.4f}")
    print(f"  Precision@10  : {p10:.4f}")
    print(f"  Precision@20  : {p20:.4f}")
    print(f"  Recall@5      : {r5:.4f}")
    print(f"  Recall@10     : {r10:.4f}")
    print(f"  Recall@20     : {r20:.4f}")
    print(f"  Standard Prec : {prec:.4f} | Recall: {rec:.4f} | F1: {f1:.4f}")
    print(f"\nSaved machine-readable metrics to: {out_json_path}")
    print("=" * 70)


if __name__ == "__main__":
    main()

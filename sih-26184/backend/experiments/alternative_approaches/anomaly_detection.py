#!/usr/bin/env python3
"""
SIH PS 26184 — Approach A: ATM Anomaly / Deviation Detection
============================================================
Evaluates unsupervised robust statistical z-scores and Isolation Forest
on pre-cutoff activity/fraud metrics for per-cutoff ATM ranking.
"""

import json
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.metrics import average_precision_score, roc_auc_score

BACKEND = Path(__file__).resolve().parent.parent.parent
CONFIG_PATH = BACKEND / "experiments" / "alternative_approaches" / "config.json"
RESULTS_DIR = BACKEND / "experiments" / "results"

with open(CONFIG_PATH) as f:
    CFG = json.load(f)

DATASET_FILE = BACKEND / CFG["data"]["parquet_dataset"]
TARGET_COL = CFG["evaluation"]["target_column"]


def run_anomaly_detection():
    df = pd.read_parquet(DATASET_FILE)
    df["cutoff_time"] = pd.to_datetime(df["cutoff_time"])

    all_co = sorted(df["cutoff_time"].unique())
    n = len(all_co)
    train_co = all_co[:int(n * 0.60)]
    test_co = all_co[int(n * 0.80):]

    tr = df[df["cutoff_time"].isin(train_co)].copy()
    te = df[df["cutoff_time"].isin(test_co)].copy()

    # Features for anomaly detection (strictly t < T)
    anomaly_feature_cols = [
        "activity_ratio_24h", "activity_delta_24h", "activity_ratio_7d",
        "velocity_surge_24h_vs_7d", "unique_account_surge_24h", "amount_ratio_24h",
        "fraud_to_normal_ratio_30d", "fraud_activity_change"
    ]

    # Method 1: Robust Statistical Z-Score (Composite Anomaly Score)
    # Using median and MAD from training set
    medians = tr[anomaly_feature_cols].median()
    mads = (tr[anomaly_feature_cols] - medians).abs().median() + 1e-4

    z_tr = ((tr[anomaly_feature_cols] - medians) / mads).clip(lower=0)
    z_te = ((te[anomaly_feature_cols] - medians) / mads).clip(lower=0)
    te["score_zscore"] = z_te.mean(axis=1)

    # Method 2: Isolation Forest (trained on train set)
    iso = IsolationForest(n_estimators=200, contamination=0.01, random_state=42, n_jobs=-1)
    iso.fit(tr[anomaly_feature_cols].fillna(0).values)
    # decision_function returns negative anomaly scores (lower = more anomalous), so negate it
    te["score_isolation_forest"] = -iso.decision_function(te[anomaly_feature_cols].fillna(0).values)

    # Evaluate per-cutoff
    methods = {
        "Statistical Robust Z-Score": "score_zscore",
        "Isolation Forest": "score_isolation_forest"
    }

    results = []
    for method_name, score_col in methods.items():
        cut_metrics = []
        for ct in test_co:
            chunk = te[te["cutoff_time"] == ct].sort_values(score_col, ascending=False).reset_index(drop=True)
            n_pos = int(chunk[TARGET_COL].sum())
            n_atm = len(chunk)

            h5 = int(chunk.head(5)[TARGET_COL].sum())
            h10 = int(chunk.head(10)[TARGET_COL].sum())
            h20 = int(chunk.head(20)[TARGET_COL].sum())

            cut_metrics.append({
                "cutoff_time": str(ct)[:10],
                "positive_count": n_pos,
                "top5_hits": h5,
                "top10_hits": h10,
                "top20_hits": h20,
                "precision_at_5": h5 / 5.0,
                "precision_at_10": h10 / 10.0,
                "precision_at_20": h20 / 20.0,
                "recall_at_5": h5 / n_pos if n_pos > 0 else 0.0,
                "recall_at_10": h10 / n_pos if n_pos > 0 else 0.0,
                "recall_at_20": h20 / n_pos if n_pos > 0 else 0.0
            })

        df_cm = pd.DataFrame(cut_metrics)
        pos_co = df_cm[df_cm["positive_count"] > 0]
        n_pos_co = len(pos_co)

        pr_auc = float(average_precision_score(te[TARGET_COL], te[score_col]))
        roc_auc = float(roc_auc_score(te[TARGET_COL], te[score_col]))

        hit5 = int((pos_co["top5_hits"] > 0).sum())
        hit10 = int((pos_co["top10_hits"] > 0).sum())
        hit20 = int((pos_co["top20_hits"] > 0).sum())

        results.append({
            "approach": "Approach A: Anomaly Detection",
            "method": method_name,
            "global_pr_auc": round(pr_auc, 6),
            "global_roc_auc": round(roc_auc, 6),
            "pos_cutoff_hit5_pct": round(hit5 / n_pos_co * 100, 2),
            "pos_cutoff_hit10_pct": round(hit10 / n_pos_co * 100, 2),
            "pos_cutoff_hit20_pct": round(hit20 / n_pos_co * 100, 2),
            "pos_cutoff_mean_p5": round(pos_co["precision_at_5"].mean(), 6),
            "pos_cutoff_mean_p10": round(pos_co["precision_at_10"].mean(), 6),
            "pos_cutoff_mean_p20": round(pos_co["precision_at_20"].mean(), 6),
            "all_cutoff_mean_p5": round(df_cm["precision_at_5"].mean(), 6),
            "all_cutoff_mean_p10": round(df_cm["precision_at_10"].mean(), 6),
            "all_cutoff_mean_p20": round(df_cm["precision_at_20"].mean(), 6),
            "pos_cutoff_mean_r5": round(pos_co["recall_at_5"].mean(), 6),
            "pos_cutoff_mean_r10": round(pos_co["recall_at_10"].mean(), 6),
            "pos_cutoff_mean_r20": round(pos_co["recall_at_20"].mean(), 6),
        })

    df_res = pd.DataFrame(results)
    df_res.to_csv(RESULTS_DIR / "anomaly_results.csv", index=False)
    print(df_res.to_string(index=False))
    return df_res, te[["atm_id", "cutoff_time", "score_zscore", "score_isolation_forest"]]


if __name__ == "__main__":
    run_anomaly_detection()

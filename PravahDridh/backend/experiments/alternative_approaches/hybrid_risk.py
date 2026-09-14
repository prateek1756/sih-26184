#!/usr/bin/env python3
"""
SIH PS 26184 — Approach E: Normalized Equal-Weight Hybrid Risk Score
====================================================================
Combines 5 normalized non-learning component signals:
1. Anomaly Deviation (Robust Z-Score)
2. Graph Mule Network Risk
3. Suspicious Transaction Metro Density
4. Spatial Cluster Proximity
5. Historical Fraud Cashout Count
Evaluates per-cutoff operational ranking.
"""

import json
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.metrics import average_precision_score, roc_auc_score

BACKEND = Path(__file__).resolve().parent.parent.parent
CONFIG_PATH = BACKEND / "experiments" / "alternative_approaches" / "config.json"
RESULTS_DIR = BACKEND / "experiments" / "results"

with open(CONFIG_PATH) as f:
    CFG = json.load(f)

DATASET_FILE = BACKEND / CFG["data"]["parquet_dataset"]
TARGET_COL = CFG["evaluation"]["target_column"]


def min_max_norm(s):
    return (s - s.min()) / (s.max() - s.min() + 1e-6)


def run_hybrid_risk():
    df = pd.read_parquet(DATASET_FILE)
    df["cutoff_time"] = pd.to_datetime(df["cutoff_time"])

    all_co = sorted(df["cutoff_time"].unique())
    n = len(all_co)
    test_co = all_co[int(n * 0.80):]
    te = df[df["cutoff_time"].isin(test_co)].copy()

    # Component 1: Anomaly Deviation
    s_anomaly = min_max_norm(te["velocity_surge_24h_vs_7d"].clip(upper=5.0) + te["activity_ratio_24h"].clip(upper=5.0))

    # Component 2: Graph Mule Risk
    s_graph = min_max_norm(te["connected_mule_accounts_7d"] * 2.0 + (1.0 / (te["hours_since_last_fraud"] + 1.0)))

    # Component 3: Suspicious Metro Density
    s_suspicious = min_max_norm(te["suspicious_density_city_7d"])

    # Component 4: Spatial Cluster Density
    s_spatial = min_max_norm(te["atm_cluster_density"])

    # Component 5: Historical Fraud Cashout
    s_fraud_hist = min_max_norm(te["fraud_cashout_atm_30d"] + te["fraud_tx_count_atm_7d"])

    # Equal-weight normalized composite score (0.20 each)
    te["score_hybrid_risk"] = (
        0.20 * s_anomaly +
        0.20 * s_graph +
        0.20 * s_suspicious +
        0.20 * s_spatial +
        0.20 * s_fraud_hist
    )

    cut_metrics = []
    for ct in test_co:
        chunk = te[te["cutoff_time"] == ct].sort_values("score_hybrid_risk", ascending=False).reset_index(drop=True)
        n_pos = int(chunk[TARGET_COL].sum())
        h5 = int(chunk.head(5)[TARGET_COL].sum())
        h10 = int(chunk.head(10)[TARGET_COL].sum())
        h20 = int(chunk.head(20)[TARGET_COL].sum())

        cut_metrics.append({
            "cutoff_time": str(ct)[:10],
            "positive_count": n_pos,
            "top5_hits": h5, "top10_hits": h10, "top20_hits": h20,
            "precision_at_5": h5 / 5.0, "precision_at_10": h10 / 10.0, "precision_at_20": h20 / 20.0,
            "recall_at_5": h5 / n_pos if n_pos > 0 else 0.0,
            "recall_at_10": h10 / n_pos if n_pos > 0 else 0.0,
            "recall_at_20": h20 / n_pos if n_pos > 0 else 0.0,
        })

    df_cm = pd.DataFrame(cut_metrics)
    pos_co = df_cm[df_cm["positive_count"] > 0]
    n_pos_co = len(pos_co)

    pr_auc = float(average_precision_score(te[TARGET_COL], te["score_hybrid_risk"]))
    roc_auc = float(roc_auc_score(te[TARGET_COL], te["score_hybrid_risk"]))

    hit5 = int((pos_co["top5_hits"] > 0).sum())
    hit10 = int((pos_co["top10_hits"] > 0).sum())
    hit20 = int((pos_co["top20_hits"] > 0).sum())

    results = [{
        "approach": "Approach E: Normalized Hybrid Risk",
        "method": "Equal-Weight (0.20 * 5 Components: Anomaly+Graph+Suspicious+Spatial+Fraud)",
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
    }]

    df_res = pd.DataFrame(results)
    df_res.to_csv(RESULTS_DIR / "hybrid_risk_results.csv", index=False)
    print(df_res.to_string(index=False))
    return df_res, te[["atm_id", "cutoff_time", "score_hybrid_risk"]]


if __name__ == "__main__":
    run_hybrid_risk()

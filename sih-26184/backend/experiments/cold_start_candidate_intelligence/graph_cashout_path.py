#!/usr/bin/env python3
"""
SIH PS 26184 — Approach 3: Graph Path to Cashout
=================================================
Constructs deterministic bipartite graph paths from suspicious entities to ATMs.
Evaluates graph path risk score per cutoff.
"""

import json
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.metrics import average_precision_score, roc_auc_score

BACKEND = Path(__file__).resolve().parent.parent.parent
CONFIG_PATH = BACKEND / "experiments" / "cold_start_candidate_intelligence" / "config.json"
RESULTS_DIR = BACKEND / "experiments" / "results"

with open(CONFIG_PATH) as f:
    CFG = json.load(f)

DATASET_FILE = BACKEND / CFG["data"]["parquet_dataset"]
TARGET_COL = CFG["evaluation"]["target_column"]


def compute_graph_path_scores(df_te):
    te = df_te.copy()
    
    # Deterministic Graph Path Metrics strictly before T:
    # 1. 2-Hop Suspicious Metro Cluster Density
    norm_2hop = te["suspicious_density_city_7d"] / (te["suspicious_density_city_7d"].max() + 1e-4)
    # 2. Mule Account Direct Linkage
    norm_mule = te["connected_mule_accounts_7d"] / (te["connected_mule_accounts_7d"].max() + 1e-4)
    # 3. Path Recency / Proximity to Last Fraud Node
    norm_recency = 1.0 / (te["hours_since_last_fraud"] + 1.0)
    norm_recency = norm_recency / (norm_recency.max() + 1e-4)
    # 4. Cashout Path Flow (Historical fraud cashout density)
    norm_flow = te["fraud_cashout_atm_30d"] / (te["fraud_cashout_atm_30d"].max() + 1e-4)
    
    te["score_graph_path"] = (
        0.35 * norm_2hop +
        0.30 * norm_mule +
        0.20 * norm_recency +
        0.15 * norm_flow
    )
    return te


def evaluate_graph_cashout_path(te):
    test_co = sorted(te["cutoff_time"].unique())
    cut_metrics = []
    
    for ct in test_co:
        chunk = te[te["cutoff_time"] == ct].sort_values("score_graph_path", ascending=False).reset_index(drop=True)
        n_pos = int(chunk[TARGET_COL].sum())
        h5 = int(chunk.head(5)[TARGET_COL].sum())
        h10 = int(chunk.head(10)[TARGET_COL].sum())
        h20 = int(chunk.head(20)[TARGET_COL].sum())
        
        cut_metrics.append({
            "cutoff_time": str(ct)[:10],
            "positive_count": n_pos,
            "top5_hits": h5, "top10_hits": h10, "top20_hits": h20,
            "p5": h5 / 5.0, "p10": h10 / 10.0, "p20": h20 / 20.0,
            "r5": h5 / n_pos if n_pos > 0 else 0.0,
            "r10": h10 / n_pos if n_pos > 0 else 0.0,
            "r20": h20 / n_pos if n_pos > 0 else 0.0,
        })
        
    df_cm = pd.DataFrame(cut_metrics)
    pos_co = df_cm[df_cm["positive_count"] > 0]
    n_pos_co = len(pos_co)
    
    pr_auc = float(average_precision_score(te[TARGET_COL], te["score_graph_path"]))
    roc_auc = float(roc_auc_score(te[TARGET_COL], te["score_graph_path"]))
    
    hit5 = int((pos_co["top5_hits"] > 0).sum())
    hit10 = int((pos_co["top10_hits"] > 0).sum())
    hit20 = int((pos_co["top20_hits"] > 0).sum())
    
    results = [{
        "approach": "Approach 3: Graph Path to Cashout",
        "method": "Deterministic 2-Hop Network Flow & Mule Path",
        "global_pr_auc": round(pr_auc, 6),
        "global_roc_auc": round(roc_auc, 6),
        "pos_cutoff_hit5_pct": round(hit5 / n_pos_co * 100, 2),
        "pos_cutoff_hit10_pct": round(hit10 / n_pos_co * 100, 2),
        "pos_cutoff_hit20_pct": round(hit20 / n_pos_co * 100, 2),
        "pos_cutoff_mean_p5": round(pos_co["p5"].mean(), 6),
        "pos_cutoff_mean_p10": round(pos_co["p10"].mean(), 6),
        "pos_cutoff_mean_p20": round(pos_co["p20"].mean(), 6),
        "all_cutoff_mean_p5": round(df_cm["p5"].mean(), 6),
        "all_cutoff_mean_p10": round(df_cm["p10"].mean(), 6),
        "all_cutoff_mean_p20": round(df_cm["p20"].mean(), 6),
    }]
    
    df_res = pd.DataFrame(results)
    df_res.to_csv(RESULTS_DIR / "graph_path_results.csv", index=False)
    print(df_res.to_string(index=False))
    return df_res


if __name__ == "__main__":
    df = pd.read_parquet(DATASET_FILE)
    df["cutoff_time"] = pd.to_datetime(df["cutoff_time"])
    all_co = sorted(df["cutoff_time"].unique())
    test_co = all_co[int(len(all_co)*0.80):]
    te = df[df["cutoff_time"].isin(test_co)].copy()
    te = compute_graph_path_scores(te)
    evaluate_graph_cashout_path(te)

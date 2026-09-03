#!/usr/bin/env python3
"""
SIH PS 26184 — Approach 1: Transaction -> ATM Candidate Propagation
====================================================================
Propagates pre-cutoff suspicious transaction signals to candidate ATMs
via geographic proximity, account linkages, and velocity sequences.
Evaluates Candidate Recall at Top 5%, 10%, 20%, 50%.
"""

import json
from pathlib import Path
import numpy as np
import pandas as pd

BACKEND = Path(__file__).resolve().parent.parent.parent
CONFIG_PATH = BACKEND / "experiments" / "cold_start_candidate_intelligence" / "config.json"
RESULTS_DIR = BACKEND / "experiments" / "results"
RESULTS_DIR.mkdir(parents=True, exist_ok=True)

with open(CONFIG_PATH) as f:
    CFG = json.load(f)

DATASET_FILE = BACKEND / CFG["data"]["parquet_dataset"]
TARGET_COL = CFG["evaluation"]["target_column"]


def compute_transaction_propagation_scores(df_te):
    """
    Computes transaction-to-ATM propagation score based on:
    - Suspicious density in the city/metro in trailing 24h/7d
    - Spatial cluster density around the ATM
    - Trailing 24h velocity burst
    - Fraud recency (decay factor)
    """
    te = df_te.copy()
    
    norm_city_susp_7d = te["suspicious_density_city_7d"] / (te["suspicious_density_city_7d"].max() + 1e-4)
    norm_city_susp_24h = te["suspicious_density_city_24h"] / (te["suspicious_density_city_24h"].max() + 1e-4)
    norm_spatial_cluster = te["atm_cluster_density"] / (te["atm_cluster_density"].max() + 1e-4)
    norm_velocity_surge = te["velocity_surge_24h_vs_7d"].clip(upper=5.0) / 5.0
    norm_recency = 1.0 / (te["hours_since_last_fraud"] + 1.0)
    norm_recency = norm_recency / (norm_recency.max() + 1e-4)
    
    # Transaction Propagation Composite Score
    te["score_tx_propagation"] = (
        0.35 * norm_city_susp_7d +
        0.25 * norm_city_susp_24h +
        0.15 * norm_spatial_cluster +
        0.15 * norm_velocity_surge +
        0.10 * norm_recency
    )
    return te


def evaluate_candidate_recall(te):
    test_co = sorted(te["cutoff_time"].unique())
    percentiles = CFG["evaluation"]["candidate_percentiles"]
    
    total_test_positives = int(te[TARGET_COL].sum())
    recall_records = []
    
    for pct in percentiles:
        pos_captured = 0
        cut_hits_5 = 0
        cut_hits_10 = 0
        cut_hits_20 = 0
        
        for ct in test_co:
            chunk = te[te["cutoff_time"] == ct].sort_values("score_tx_propagation", ascending=False).reset_index(drop=True)
            k_cand = max(1, int(len(chunk) * pct))
            cands = chunk.head(k_cand)
            
            n_pos = int(chunk[TARGET_COL].sum())
            n_cap = int(cands[TARGET_COL].sum())
            pos_captured += n_cap
            
            if n_pos > 0:
                if int(cands.head(5)[TARGET_COL].sum()) > 0:
                    cut_hits_5 += 1
                if int(cands.head(10)[TARGET_COL].sum()) > 0:
                    cut_hits_10 += 1
                if int(cands.head(20)[TARGET_COL].sum()) > 0:
                    cut_hits_20 += 1
                    
        cand_recall_pct = (pos_captured / total_test_positives * 100) if total_test_positives > 0 else 0.0
        recall_records.append({
            "candidate_percentile": f"Top {int(pct*100)}%",
            "candidate_count_per_cutoff": max(1, int(150 * pct)),
            "events_captured": f"{pos_captured}/{total_test_positives}",
            "candidate_recall_pct": round(cand_recall_pct, 2),
            "pos_cutoff_hit5_pct": round(cut_hits_5 / 15 * 100, 2),
            "pos_cutoff_hit10_pct": round(cut_hits_10 / 15 * 100, 2),
            "pos_cutoff_hit20_pct": round(cut_hits_20 / 15 * 100, 2)
        })
        
    df_recall = pd.DataFrame(recall_records)
    df_recall.to_csv(RESULTS_DIR / "candidate_recall.csv", index=False)
    print(df_recall.to_string(index=False))
    return df_recall


if __name__ == "__main__":
    df = pd.read_parquet(DATASET_FILE)
    df["cutoff_time"] = pd.to_datetime(df["cutoff_time"])
    all_co = sorted(df["cutoff_time"].unique())
    test_co = all_co[int(len(all_co)*0.80):]
    te = df[df["cutoff_time"].isin(test_co)].copy()
    te = compute_transaction_propagation_scores(te)
    evaluate_candidate_recall(te)

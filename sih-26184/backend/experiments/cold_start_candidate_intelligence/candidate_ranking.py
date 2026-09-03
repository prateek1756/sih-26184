#!/usr/bin/env python3
"""
SIH PS 26184 — Approach 5: Candidate Ranking & Multi-Signal Fusion
==================================================================
Combines 10 pre-cutoff intelligence signals:
1. Transaction-to-ATM propagation
2. Account-to-ATM behavior
3. Graph cashout path connectivity
4. Suspicious transaction recency
5. Transaction velocity burst
6. Geographic metro density
7. Amount anomaly ratio
8. Temporal compatibility
9. ATM activity baseline
10. A1 Robust Z-Score
Evaluates weighted and rank aggregation on per-cutoff ranking.
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


def min_max_norm(s):
    return (s - s.min()) / (s.max() - s.min() + 1e-6)


def compute_candidate_ranking_scores(df_te):
    te = df_te.copy()
    
    # Signal 1: Transaction Propagation
    s_tx_prop = min_max_norm(te["suspicious_density_city_7d"] * 0.5 + te["suspicious_density_city_24h"] * 0.5)
    # Signal 2: Account Behavior
    s_acct_beh = min_max_norm(te["connected_mule_accounts_7d"] * 2.0 + te["unique_account_surge_24h"])
    # Signal 3: Graph Path Connectivity
    s_graph_path = min_max_norm(te["connected_mule_accounts_7d"] + (1.0 / (te["hours_since_last_fraud"] + 1.0)))
    # Signal 4: Suspicious Transaction Recency
    s_recency = min_max_norm(1.0 / (te["hours_since_last_fraud"] + 1.0))
    # Signal 5: Velocity Surge
    s_velocity = min_max_norm(te["velocity_surge_24h_vs_7d"].clip(upper=5.0))
    # Signal 6: Geographic Metro Density
    s_metro = min_max_norm(te["suspicious_density_city_7d"] + te["atm_cluster_density"] * 0.5)
    # Signal 7: Amount Anomaly
    s_amount = min_max_norm(te["amount_ratio_24h"].clip(upper=5.0))
    # Signal 8: Temporal Compatibility
    s_temp = min_max_norm(te["is_weekend"])
    # Signal 9: Activity Baseline
    s_base = min_max_norm(te["base_cw_rate_daily"])
    # Signal 10: A1 Robust Z-Score (Activity Delta + Velocity Ratio)
    s_a1 = min_max_norm(te["activity_ratio_24h"].clip(upper=5.0) + te["velocity_surge_24h_vs_7d"].clip(upper=5.0))
    
    # Weighted Multi-Signal Crime-to-Cashout Score:
    # Prioritizes transaction propagation (metro crime pressure) and velocity/recency
    te["score_candidate_ranking_weighted"] = (
        0.25 * s_tx_prop +
        0.20 * s_metro +
        0.15 * s_velocity +
        0.15 * s_a1 +
        0.10 * s_graph_path +
        0.05 * s_acct_beh +
        0.05 * s_recency +
        0.05 * s_amount
    )
    
    # Simple Equal-Weight Mean Rank Aggregation
    te["score_candidate_ranking_equal"] = (
        s_tx_prop + s_acct_beh + s_graph_path + s_recency + s_velocity +
        s_metro + s_amount + s_temp + s_base + s_a1
    ) / 10.0
    
    return te


def evaluate_candidate_ranking(te):
    test_co = sorted(te["cutoff_time"].unique())
    methods = {
        "Weighted Multi-Signal Candidate Ranking": "score_candidate_ranking_weighted",
        "Equal-Weight 10-Signal Mean Ranking": "score_candidate_ranking_equal"
    }
    
    results = []
    for method_name, score_col in methods.items():
        cut_metrics = []
        for ct in test_co:
            chunk = te[te["cutoff_time"] == ct].sort_values(score_col, ascending=False).reset_index(drop=True)
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
        
        pr_auc = float(average_precision_score(te[TARGET_COL], te[score_col]))
        roc_auc = float(roc_auc_score(te[TARGET_COL], te[score_col]))
        
        hit5 = int((pos_co["top5_hits"] > 0).sum())
        hit10 = int((pos_co["top10_hits"] > 0).sum())
        hit20 = int((pos_co["top20_hits"] > 0).sum())
        
        results.append({
            "approach": "Approach 5: Candidate Ranking",
            "method": method_name,
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
        })
        
    df_res = pd.DataFrame(results)
    df_res.to_csv(RESULTS_DIR / "candidate_ranking_results.csv", index=False)
    print(df_res.to_string(index=False))
    return df_res


if __name__ == "__main__":
    df = pd.read_parquet(DATASET_FILE)
    df["cutoff_time"] = pd.to_datetime(df["cutoff_time"])
    all_co = sorted(df["cutoff_time"].unique())
    test_co = all_co[int(len(all_co)*0.80):]
    te = df[df["cutoff_time"].isin(test_co)].copy()
    te = compute_candidate_ranking_scores(te)
    evaluate_candidate_ranking(te)

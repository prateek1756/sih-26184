#!/usr/bin/env python3
"""
SIH PS 26184 — Approach 2: Account -> ATM Behavior
===================================================
Models pre-cutoff account behavioral features (mule velocity, unique accounts,
withdrawal-to-deposit ratios, burst activity) to score destination ATM risk.
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


def compute_account_behavior_scores(df_te):
    te = df_te.copy()
    
    # Account behavioral indicators strictly before T:
    # 1. Unique account surge in trailing 24h
    norm_acct_surge = te["unique_account_surge_24h"].clip(upper=5.0) / 5.0
    # 2. Connected mule accounts in trailing 7d
    norm_mule_accts = te["connected_mule_accounts_7d"] / (te["connected_mule_accounts_7d"].max() + 1e-4)
    # 3. Amount ratio (high average transaction amount surge)
    norm_amt_ratio = te["amount_ratio_24h"].clip(upper=5.0) / 5.0
    # 4. Activity delta (absolute surge in withdrawal counts)
    norm_act_delta = (te["activity_delta_24h"].clip(lower=0)) / (te["activity_delta_24h"].max() + 1e-4)
    
    # Account Behavior Composite Score
    te["score_account_behavior"] = (
        0.35 * norm_mule_accts +
        0.25 * norm_acct_surge +
        0.20 * norm_amt_ratio +
        0.20 * norm_act_delta
    )
    return te


def evaluate_account_atm_behavior(te):
    test_co = sorted(te["cutoff_time"].unique())
    cut_metrics = []
    
    for ct in test_co:
        chunk = te[te["cutoff_time"] == ct].sort_values("score_account_behavior", ascending=False).reset_index(drop=True)
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
    
    pr_auc = float(average_precision_score(te[TARGET_COL], te["score_account_behavior"]))
    roc_auc = float(roc_auc_score(te[TARGET_COL], te["score_account_behavior"]))
    
    hit5 = int((pos_co["top5_hits"] > 0).sum())
    hit10 = int((pos_co["top10_hits"] > 0).sum())
    hit20 = int((pos_co["top20_hits"] > 0).sum())
    
    results = [{
        "approach": "Approach 2: Account -> ATM Behavior",
        "method": "Mule Surge + Unique Accounts + Amount Anomaly",
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
    df_res.to_csv(RESULTS_DIR / "account_atm_results.csv", index=False)
    print(df_res.to_string(index=False))
    return df_res


if __name__ == "__main__":
    df = pd.read_parquet(DATASET_FILE)
    df["cutoff_time"] = pd.to_datetime(df["cutoff_time"])
    all_co = sorted(df["cutoff_time"].unique())
    test_co = all_co[int(len(all_co)*0.80):]
    te = df[df["cutoff_time"].isin(test_co)].copy()
    te = compute_account_behavior_scores(te)
    evaluate_account_atm_behavior(te)

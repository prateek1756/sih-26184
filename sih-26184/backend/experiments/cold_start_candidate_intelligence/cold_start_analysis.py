#!/usr/bin/env python3
"""
SIH PS 26184 — Approach 4: Cold-Start Event Split & Forensic Analysis
=====================================================================
Separates the test positive events into:
- Group A: ATM-History-Positive (prior fraud flag, mule account, or acute surge)
- Group B: Cold-Start Events (zero prior fraud, zero mule, normal activity)
Evaluates separate recall and Top-K hit rates.
"""

import json
from pathlib import Path
import numpy as np
import pandas as pd

BACKEND = Path(__file__).resolve().parent.parent.parent
CONFIG_PATH = BACKEND / "experiments" / "cold_start_candidate_intelligence" / "config.json"
RESULTS_DIR = BACKEND / "experiments" / "results"

with open(CONFIG_PATH) as f:
    CFG = json.load(f)

DATASET_FILE = BACKEND / CFG["data"]["parquet_dataset"]
TARGET_COL = CFG["evaluation"]["target_column"]


def classify_events(df_pos):
    """
    Classifies each positive event as History-Positive (Group A) or Cold-Start (Group B).
    """
    classifications = []
    for _, r in df_pos.iterrows():
        has_prior_fraud = bool((r["fraud_tx_count_atm_30d"] > 0) or (r["fraud_cashout_atm_30d"] > 0))
        has_mule = bool(r["connected_mule_accounts_7d"] > 0)
        has_surge = bool((r["velocity_surge_24h_vs_7d"] > 1.5) or (r["activity_ratio_24h"] > 1.5))
        is_cold = not (has_prior_fraud or has_mule or has_surge)
        
        classifications.append({
            "cutoff_time": str(r["cutoff_time"])[:10],
            "atm_id": str(r["atm_id"]),
            "city": r["city"],
            "has_prior_fraud": has_prior_fraud,
            "has_mule": has_mule,
            "has_surge": has_surge,
            "group": "Group B: Cold-Start" if is_cold else "Group A: History-Positive",
            "is_cold_start": is_cold
        })
    return pd.DataFrame(classifications)


def run_cold_start_breakdown(te_scored_dict):
    """
    Computes recovery rates separately for Group A (History-Positive) and Group B (Cold-Start).
    """
    df_pos = te_scored_dict["df_te"][te_scored_dict["df_te"][TARGET_COL] == 1].copy().reset_index(drop=True)
    df_classes = classify_events(df_pos)
    
    n_total = len(df_classes)
    n_cold = int(df_classes["is_cold_start"].sum())
    n_hist = n_total - n_cold
    
    print(f"Total Positive Events: {n_total} | Cold-Start (Group B): {n_cold} ({n_cold/n_total*100:.1f}%) | History-Positive (Group A): {n_hist} ({n_hist/n_total*100:.1f}%)")
    return df_classes


if __name__ == "__main__":
    df = pd.read_parquet(DATASET_FILE)
    df["cutoff_time"] = pd.to_datetime(df["cutoff_time"])
    all_co = sorted(df["cutoff_time"].unique())
    test_co = all_co[int(len(all_co)*0.80):]
    te = df[df["cutoff_time"].isin(test_co)].copy()
    run_cold_start_breakdown({"df_te": te})

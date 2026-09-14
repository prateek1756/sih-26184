#!/usr/bin/env python3
"""
SIH PS 26184 — Comprehensive Alternative Approaches Evaluator
=============================================================
Executes all 5 alternative problem formulations:
- Approach A: Anomaly Detection (Robust Z-Score & Isolation Forest)
- Approach B: Future Activity Forecasting (Regression residual ratio)
- Approach C: Candidate Generation + Priority Ranking (10%, 20%, 30%, 50% pools)
- Approach D: Deterministic Graph Topology Risk
- Approach E: Normalized Equal-Weight Hybrid Risk
Along with standard heuristic Baselines (Random, 30d Volume, 7d Volume, Hist Fraud, Recent Fraud).

Outputs: experiments/results/alternative_approaches_comparison.csv
"""

import json
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.metrics import average_precision_score, roc_auc_score

import anomaly_detection
import activity_forecasting
import candidate_generation
import graph_risk
import hybrid_risk

BACKEND = Path(__file__).resolve().parent.parent.parent
CONFIG_PATH = BACKEND / "experiments" / "alternative_approaches" / "config.json"
RESULTS_DIR = BACKEND / "experiments" / "results"
RESULTS_DIR.mkdir(parents=True, exist_ok=True)

with open(CONFIG_PATH) as f:
    CFG = json.load(f)

DATASET_FILE = BACKEND / CFG["data"]["parquet_dataset"]
TARGET_COL = CFG["evaluation"]["target_column"]


def eval_score_series(te_df, score_col, target_col, test_co, approach_name, method_name, cand_recall=None):
    cut_metrics = []
    for ct in test_co:
        chunk = te_df[te_df["cutoff_time"] == ct].sort_values(score_col, ascending=False).reset_index(drop=True)
        n_pos = int(chunk[target_col].sum())
        h5 = int(chunk.head(5)[target_col].sum())
        h10 = int(chunk.head(10)[target_col].sum())
        h20 = int(chunk.head(20)[target_col].sum())

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

    pr_auc = float(average_precision_score(te_df[target_col], te_df[score_col]))
    roc_auc = float(roc_auc_score(te_df[target_col], te_df[score_col]))

    hit5 = int((pos_co["top5_hits"] > 0).sum())
    hit10 = int((pos_co["top10_hits"] > 0).sum())
    hit20 = int((pos_co["top20_hits"] > 0).sum())

    return {
        "approach": approach_name,
        "method": method_name,
        "global_pr_auc": round(pr_auc, 6),
        "global_roc_auc": round(roc_auc, 6),
        "candidate_recall_pct": cand_recall if cand_recall is not None else 100.0,
        "pos_cutoff_hit5_pct": round(hit5 / n_pos_co * 100, 2),
        "pos_cutoff_hit10_pct": round(hit10 / n_pos_co * 100, 2),
        "pos_cutoff_hit20_pct": round(hit20 / n_pos_co * 100, 2),
        "pos_cutoff_mean_p5": round(pos_co["p5"].mean(), 6),
        "pos_cutoff_mean_p10": round(pos_co["p10"].mean(), 6),
        "pos_cutoff_mean_p20": round(pos_co["p20"].mean(), 6),
        "all_cutoff_mean_p5": round(df_cm["p5"].mean(), 6),
        "all_cutoff_mean_p10": round(df_cm["p10"].mean(), 6),
        "all_cutoff_mean_p20": round(df_cm["p20"].mean(), 6),
    }


def main():
    print("=" * 80)
    print("SIH PS 26184 — EVALUATING ALL ALTERNATIVE PROBLEM FORMULATIONS")
    print("=" * 80)

    # 1. Run Approach A
    print("\n--- Running Approach A (Anomaly Detection) ---")
    df_a_res, df_a_scores = anomaly_detection.run_anomaly_detection()

    # 2. Run Approach B
    print("\n--- Running Approach B (Activity Forecasting) ---")
    df_b_res, df_b_scores = activity_forecasting.run_activity_forecasting()

    # 3. Run Approach C
    print("\n--- Running Approach C (Candidate Generation) ---")
    df_c_res, df_c_scores = candidate_generation.run_candidate_generation()

    # 4. Run Approach D
    print("\n--- Running Approach D (Graph Risk) ---")
    df_d_res, df_d_scores = graph_risk.run_graph_risk()

    # 5. Run Approach E
    print("\n--- Running Approach E (Hybrid Risk Score) ---")
    df_e_res, df_e_scores = hybrid_risk.run_hybrid_risk()

    # 6. Evaluate Standard Baselines for direct side-by-side comparison
    print("\n--- Evaluating Reference Baselines ---")
    df = pd.read_parquet(DATASET_FILE)
    df["cutoff_time"] = pd.to_datetime(df["cutoff_time"])
    all_co = sorted(df["cutoff_time"].unique())
    n = len(all_co)
    test_co = all_co[int(n * 0.80):]
    te = df[df["cutoff_time"].isin(test_co)].copy()

    np.random.seed(42)
    te["score_random"] = np.random.rand(len(te))
    te["score_n30d"] = te["base_tx_count_30d"]
    te["score_n7d"] = te["recent_cw_count_7d"]
    te["score_fraud_rate"] = te["fraud_to_normal_ratio_30d"]
    te["score_recent_fraud"] = te["fraud_tx_count_atm_7d"]

    baseline_rows = [
        eval_score_series(te, "score_random", TARGET_COL, test_co, "Baseline", "1. Random Ranking"),
        eval_score_series(te, "score_n30d", TARGET_COL, test_co, "Baseline", "2. 30-Day ATM Tx Volume"),
        eval_score_series(te, "score_n7d", TARGET_COL, test_co, "Baseline", "3. 7-Day ATM Withdrawal Count"),
        eval_score_series(te, "score_fraud_rate", TARGET_COL, test_co, "Baseline", "4. Historical ATM Fraud Rate"),
        eval_score_series(te, "score_recent_fraud", TARGET_COL, test_co, "Baseline", "5. Recent 7-Day Fraud Count"),
    ]

    # Combine all into summary comparison dataframe
    all_rows = []
    for r in baseline_rows:
        all_rows.append(r)

    for _, r in df_a_res.iterrows():
        all_rows.append(r.to_dict())

    for _, r in df_b_res.iterrows():
        all_rows.append(r.to_dict())

    for _, r in df_c_res.iterrows():
        d = r.to_dict()
        d["method"] = d.get("candidate_tier", "Candidate Gen")
        d["candidate_recall_pct"] = d.get("overall_candidate_recall", 100.0)
        all_rows.append(d)

    for _, r in df_d_res.iterrows():
        all_rows.append(r.to_dict())

    for _, r in df_e_res.iterrows():
        all_rows.append(r.to_dict())

    df_comparison = pd.DataFrame(all_rows)
    cols = [
        "approach", "method", "global_pr_auc", "pos_cutoff_hit5_pct",
        "pos_cutoff_hit10_pct", "pos_cutoff_hit20_pct", "pos_cutoff_mean_p5",
        "pos_cutoff_mean_p10", "candidate_recall_pct"
    ]
    cols_present = [c for c in cols if c in df_comparison.columns]
    df_comp_clean = df_comparison[cols_present].sort_values(
        by=["pos_cutoff_hit10_pct", "pos_cutoff_hit5_pct", "global_pr_auc"],
        ascending=False
    ).reset_index(drop=True)

    out_csv = RESULTS_DIR / "alternative_approaches_comparison.csv"
    df_comp_clean.to_csv(out_csv, index=False)

    print("\n" + "=" * 90)
    print("UNIFIED ALTERNATIVE APPROACHES RANKING (Sorted by Operational Hit Rate & P@10)")
    print("=" * 90)
    print(df_comp_clean.to_string(index=False))
    print(f"\nSaved full comparison to: {out_csv}")


if __name__ == "__main__":
    main()

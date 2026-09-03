#!/usr/bin/env python3
"""
SIH PS 26184 — Approach C: Candidate Generation + Ranking
=========================================================
Step 1: Multi-trigger candidate selection (Top 10%, 20%, 30%, 50% candidate pools).
Evaluates Candidate Recall: "What fraction of future fraud events are captured in the candidate pool?"
Step 2: Priority ranking within the candidate pool.
"""

import json
from pathlib import Path
import numpy as np
import pandas as pd

BACKEND = Path(__file__).resolve().parent.parent.parent
CONFIG_PATH = BACKEND / "experiments" / "alternative_approaches" / "config.json"
RESULTS_DIR = BACKEND / "experiments" / "results"

with open(CONFIG_PATH) as f:
    CFG = json.load(f)

DATASET_FILE = BACKEND / CFG["data"]["parquet_dataset"]
TARGET_COL = CFG["evaluation"]["target_column"]


def run_candidate_generation():
    df = pd.read_parquet(DATASET_FILE)
    df["cutoff_time"] = pd.to_datetime(df["cutoff_time"])

    all_co = sorted(df["cutoff_time"].unique())
    n = len(all_co)
    test_co = all_co[int(n * 0.80):]
    te = df[df["cutoff_time"].isin(test_co)].copy()

    # Heuristic Candidate Trigger Score (strictly t < T):
    # Combines velocity surge, suspicious city density, and local fraud history
    te["candidate_score"] = (
        te["velocity_surge_24h_vs_7d"].clip(upper=5.0) / 5.0 * 0.35 +
        (te["suspicious_density_city_7d"] > 0).astype(float) * 0.25 +
        (te["fraud_tx_count_atm_30d"] > 0).astype(float) * 0.25 +
        te["atm_cluster_density"].clip(upper=10.0) / 10.0 * 0.15
    )

    thresholds = [0.10, 0.20, 0.30, 0.50]
    results = []

    for pct in thresholds:
        cut_metrics = []
        total_pos_across_test = int(te[TARGET_COL].sum())
        total_pos_in_candidates = 0

        for ct in test_co:
            chunk = te[te["cutoff_time"] == ct].sort_values("candidate_score", ascending=False).reset_index(drop=True)
            n_atm = len(chunk)
            k_cand = max(1, int(n_atm * pct))
            candidates = chunk.head(k_cand)

            n_pos_in_cutoff = int(chunk[TARGET_COL].sum())
            n_pos_in_cand = int(candidates[TARGET_COL].sum())
            total_pos_in_candidates += n_pos_in_cand

            h5 = int(candidates.head(5)[TARGET_COL].sum())
            h10 = int(candidates.head(10)[TARGET_COL].sum())
            h20 = int(candidates.head(20)[TARGET_COL].sum())

            cut_metrics.append({
                "cutoff_time": str(ct)[:10],
                "candidate_count": k_cand,
                "cutoff_positives": n_pos_in_cutoff,
                "candidate_positives": n_pos_in_cand,
                "candidate_recall": n_pos_in_cand / n_pos_in_cutoff if n_pos_in_cutoff > 0 else 1.0,
                "top5_hits": h5, "top10_hits": h10, "top20_hits": h20,
                "p5": h5 / 5.0, "p10": h10 / 10.0, "p20": h20 / 20.0,
                "r5": h5 / n_pos_in_cutoff if n_pos_in_cutoff > 0 else 0.0,
                "r10": h10 / n_pos_in_cutoff if n_pos_in_cutoff > 0 else 0.0,
                "r20": h20 / n_pos_in_cutoff if n_pos_in_cutoff > 0 else 0.0,
            })

        df_cm = pd.DataFrame(cut_metrics)
        pos_co = df_cm[df_cm["cutoff_positives"] > 0]
        n_pos_co = len(pos_co)

        overall_candidate_recall = total_pos_in_candidates / total_pos_across_test if total_pos_across_test > 0 else 0.0
        hit5 = int((pos_co["top5_hits"] > 0).sum())
        hit10 = int((pos_co["top10_hits"] > 0).sum())
        hit20 = int((pos_co["top20_hits"] > 0).sum())

        results.append({
            "approach": "Approach C: Candidate Gen + Ranking",
            "candidate_tier": f"Top {int(pct*100)}% Candidate Set",
            "candidate_size_per_cutoff": max(1, int(150 * pct)),
            "overall_candidate_recall": round(overall_candidate_recall * 100, 2),
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
    df_res.to_csv(RESULTS_DIR / "candidate_generation_results.csv", index=False)
    print(df_res.to_string(index=False))
    return df_res, te[["atm_id", "cutoff_time", "candidate_score"]]


if __name__ == "__main__":
    run_candidate_generation()

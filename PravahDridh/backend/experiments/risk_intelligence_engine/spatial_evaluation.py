#!/usr/bin/env python3
"""
SIH PS 26184 — Spatial Radius Sensitivity Evaluation
=====================================================
Evaluates Risk Intelligence Engine performance across configurable
spatial radii: [0.5 km, 1.0 km, 2.0 km, 5.0 km].
Outputs: experiments/results/risk_intelligence_engine_spatial_radius.csv
"""

import json
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.metrics import average_precision_score, roc_auc_score

from engine import RiskIntelligenceEngine

BACKEND = Path(__file__).resolve().parent.parent.parent
CONFIG_PATH = Path(__file__).resolve().parent / "config.json"
RESULTS_DIR = BACKEND / "experiments" / "results"
RESULTS_DIR.mkdir(parents=True, exist_ok=True)

with open(CONFIG_PATH) as f:
    CFG = json.load(f)

DATASET_FILE = BACKEND / CFG["data"]["parquet_dataset"]
TARGET_COL = CFG["evaluation"]["target_column"]
RADII = CFG["evaluation"]["spatial_radii_km"]


def run_spatial_radius_evaluation():
    df = pd.read_parquet(DATASET_FILE)
    df["cutoff_time"] = pd.to_datetime(df["cutoff_time"])

    all_co = sorted(df["cutoff_time"].unique())
    n = len(all_co)
    test_co = all_co[int(n * 0.80):]
    te = df[df["cutoff_time"].isin(test_co)].copy().reset_index(drop=True)

    results = []

    for radius in RADII:
        cut_metrics = []

        for ct in test_co:
            chunk = te[te["cutoff_time"] == ct].copy()
            df_ranked = RiskIntelligenceEngine.evaluate_cutoff_cohort(chunk, spatial_radius_km=radius)

            n_pos = int(df_ranked[TARGET_COL].sum())
            h5 = int(df_ranked.head(5)[TARGET_COL].sum())
            h10 = int(df_ranked.head(10)[TARGET_COL].sum())
            h20 = int(df_ranked.head(20)[TARGET_COL].sum())

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

        hit5 = int((pos_co["top5_hits"] > 0).sum())
        hit10 = int((pos_co["top10_hits"] > 0).sum())
        hit20 = int((pos_co["top20_hits"] > 0).sum())

        results.append({
            "spatial_radius_km": radius,
            "pos_cutoff_hit5_pct": round(hit5 / n_pos_co * 100, 2),
            "pos_cutoff_hit10_pct": round(hit10 / n_pos_co * 100, 2),
            "pos_cutoff_hit20_pct": round(hit20 / n_pos_co * 100, 2),
            "events_recovered_top10": f"{int(pos_co['top10_hits'].sum())}/16",
            "events_recovered_top20": f"{int(pos_co['top20_hits'].sum())}/16",
            "pos_cutoff_mean_p5": round(pos_co["p5"].mean(), 6),
            "pos_cutoff_mean_p10": round(pos_co["p10"].mean(), 6),
            "pos_cutoff_mean_p20": round(pos_co["p20"].mean(), 6),
            "all_cutoff_mean_p5": round(df_cm["p5"].mean(), 6),
            "all_cutoff_mean_p10": round(df_cm["p10"].mean(), 6),
            "all_cutoff_mean_p20": round(df_cm["p20"].mean(), 6),
        })

    df_res = pd.DataFrame(results)
    out_csv = RESULTS_DIR / "risk_intelligence_engine_spatial_radius.csv"
    df_res.to_csv(out_csv, index=False)
    print("=" * 80)
    print("SPATIAL RADIUS SENSITIVITY EVALUATION")
    print("=" * 80)
    print(df_res.to_string(index=False))
    print(f"\nSaved spatial radius evaluation to: {out_csv}")
    return df_res


if __name__ == "__main__":
    run_spatial_radius_evaluation()

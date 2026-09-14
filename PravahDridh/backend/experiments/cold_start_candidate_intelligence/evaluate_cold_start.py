#!/usr/bin/env python3
"""
SIH PS 26184 — Comprehensive Cold-Start Candidate Intelligence Evaluator
========================================================================
Runs all 5 Cold-Start Candidate Intelligence approaches:
1. Transaction -> ATM Candidate Propagation
2. Account -> ATM Behavioral Modeling
3. Graph Path to Cashout
4. Cold-Start Event Split & Evaluation (Group A vs Group B)
5. Candidate Ranking & Multi-Signal Fusion

Generates all 6 result CSVs and detailed 16-event forensic recovery trace.
"""

import json
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.metrics import average_precision_score, roc_auc_score

import transaction_atm_candidates
import account_atm_behavior
import graph_cashout_path
import cold_start_analysis
import candidate_ranking

BACKEND = Path(__file__).resolve().parent.parent.parent
CONFIG_PATH = BACKEND / "experiments" / "cold_start_candidate_intelligence" / "config.json"
RESULTS_DIR = BACKEND / "experiments" / "results"
RESULTS_DIR.mkdir(parents=True, exist_ok=True)

with open(CONFIG_PATH) as f:
    CFG = json.load(f)

DATASET_FILE = BACKEND / CFG["data"]["parquet_dataset"]
TARGET_COL = CFG["evaluation"]["target_column"]


def main():
    print("=" * 90)
    print("SIH PS 26184 — CRIME-TO-CASHOUT CANDIDATE INTELLIGENCE EXPERIMENT")
    print("Targeting the Cold-Start Cashout Problem (12/16 unflagged destination ATMs)")
    print("=" * 90)

    df = pd.read_parquet(DATASET_FILE)
    df["cutoff_time"] = pd.to_datetime(df["cutoff_time"])

    all_co = sorted(df["cutoff_time"].unique())
    n = len(all_co)
    train_co = all_co[:int(n * 0.60)]
    test_co = all_co[int(n * 0.80):]

    tr = df[df["cutoff_time"].isin(train_co)].copy()
    te = df[df["cutoff_time"].isin(test_co)].copy().reset_index(drop=True)

    # ── 1. COMPUTE ALL SIGNAL SCORES ──────────────────────────────────────────
    
    # Approach 1: Transaction Propagation
    te = transaction_atm_candidates.compute_transaction_propagation_scores(te)
    # Approach 2: Account Behavior
    te = account_atm_behavior.compute_account_behavior_scores(te)
    # Approach 3: Graph Cashout Path
    te = graph_cashout_path.compute_graph_path_scores(te)
    # Approach 5: Candidate Ranking Fusion
    te = candidate_ranking.compute_candidate_ranking_scores(te)

    # Historical Benchmark Scores (A1, B, A+B, Baselines)
    anomaly_cols = [
        "activity_ratio_24h", "activity_delta_24h", "activity_ratio_7d",
        "velocity_surge_24h_vs_7d", "unique_account_surge_24h", "amount_ratio_24h",
        "fraud_to_normal_ratio_30d", "fraud_activity_change"
    ]
    medians = tr[anomaly_cols].median()
    mads = (tr[anomaly_cols] - medians).abs().median() + 1e-4
    z_te = ((te[anomaly_cols] - medians) / mads).clip(lower=0)
    te["score_A1_zscore"] = z_te.mean(axis=1)

    te["score_B_activity"] = te["recent_cw_count_24h"] / (te["base_cw_rate_daily"] + 1e-4)

    def min_max_norm(s):
        return (s - s.min()) / (s.max() - s.min() + 1e-6)

    te["score_combo_AB"] = min_max_norm(te["score_A1_zscore"]) * 0.5 + min_max_norm(te["score_B_activity"]) * 0.5
    
    np.random.seed(42)
    te["score_random"] = np.random.rand(len(te))
    te["score_30d_vol"] = te["base_tx_count_30d"]
    te["score_7d_vol"] = te["recent_cw_count_7d"]
    te["score_hist_fraud"] = te["fraud_to_normal_ratio_30d"]

    # ── 2. EXECUTE SUB-SCRIPTS & GENERATE COMPONENT RESULTS CSVs ───────────────
    print("\n--- 1. Evaluating Candidate Recall (Approach 1) ---")
    df_recall = transaction_atm_candidates.evaluate_candidate_recall(te)

    print("\n--- 2. Evaluating Account-ATM Behavior (Approach 2) ---")
    df_acct = account_atm_behavior.evaluate_account_atm_behavior(te)

    print("\n--- 3. Evaluating Graph Cashout Path (Approach 3) ---")
    df_graph = graph_cashout_path.evaluate_graph_cashout_path(te)

    print("\n--- 4. Evaluating Candidate Ranking Fusion (Approach 5) ---")
    df_cand_rank = candidate_ranking.evaluate_candidate_ranking(te)

    # ── 3. EVALUATE COMPARISON ACROSS ALL METHODS & BREAKDOWN BY GROUP A / B ───
    print("\n--- 5. Evaluating Full Comparison & Cold-Start Breakdown ---")

    all_methods = {
        "Approach 1: Transaction Propagation": "score_tx_propagation",
        "Approach 2: Account Behavior": "score_account_behavior",
        "Approach 3: Graph Cashout Path": "score_graph_path",
        "Approach 5: Weighted Candidate Ranking": "score_candidate_ranking_weighted",
        "Approach 5: Equal-Weight Candidate Ranking": "score_candidate_ranking_equal",
        "Benchmark: Approach A1 (Robust Z-Score)": "score_A1_zscore",
        "Benchmark: Combo A+B": "score_combo_AB",
        "Baseline: Random": "score_random",
        "Baseline: 30d Volume": "score_30d_vol",
        "Baseline: 7d Volume": "score_7d_vol",
        "Baseline: Historical Fraud Rate": "score_hist_fraud"
    }

    # Classify positive events into Group A (History-Positive) vs Group B (Cold-Start)
    pos_te = te[te[TARGET_COL] == 1].copy().reset_index(drop=True)
    df_classified = cold_start_analysis.classify_events(pos_te)
    
    cold_start_cutoffs = set(df_classified[df_classified["is_cold_start"]]["cutoff_time"].values)
    hist_pos_cutoffs = set(df_classified[~df_classified["is_cold_start"]]["cutoff_time"].values)

    comp_rows = []
    for m_label, score_col in all_methods.items():
        cut_metrics_all = []
        cut_metrics_cold = []
        cut_metrics_hist = []

        for ct in test_co:
            ct_str = str(ct)[:10]
            chunk = te[te["cutoff_time"] == ct].sort_values(score_col, ascending=False).reset_index(drop=True)
            n_pos = int(chunk[TARGET_COL].sum())
            h5 = int(chunk.head(5)[TARGET_COL].sum())
            h10 = int(chunk.head(10)[TARGET_COL].sum())
            h20 = int(chunk.head(20)[TARGET_COL].sum())

            rec = {
                "cutoff_time": ct_str, "positive_count": n_pos,
                "top5_hits": h5, "top10_hits": h10, "top20_hits": h20,
                "p5": h5 / 5.0, "p10": h10 / 10.0, "p20": h20 / 20.0,
                "r5": h5 / n_pos if n_pos > 0 else 0.0,
                "r10": h10 / n_pos if n_pos > 0 else 0.0,
                "r20": h20 / n_pos if n_pos > 0 else 0.0,
            }
            cut_metrics_all.append(rec)

            if ct_str in cold_start_cutoffs:
                cut_metrics_cold.append(rec)
            if ct_str in hist_pos_cutoffs:
                cut_metrics_hist.append(rec)

        df_all = pd.DataFrame(cut_metrics_all)
        pos_all = df_all[df_all["positive_count"] > 0]
        pos_cold = pd.DataFrame(cut_metrics_cold)
        pos_hist = pd.DataFrame(cut_metrics_hist)

        pr_auc = float(average_precision_score(te[TARGET_COL], te[score_col]))
        roc_auc = float(roc_auc_score(te[TARGET_COL], te[score_col]))

        hit5_all = int((pos_all["top5_hits"] > 0).sum())
        hit10_all = int((pos_all["top10_hits"] > 0).sum())
        hit20_all = int((pos_all["top20_hits"] > 0).sum())

        hit5_cold = int((pos_cold["top5_hits"] > 0).sum()) if len(pos_cold) > 0 else 0
        hit10_cold = int((pos_cold["top10_hits"] > 0).sum()) if len(pos_cold) > 0 else 0
        hit20_cold = int((pos_cold["top20_hits"] > 0).sum()) if len(pos_cold) > 0 else 0

        hit5_hist = int((pos_hist["top5_hits"] > 0).sum()) if len(pos_hist) > 0 else 0
        hit10_hist = int((pos_hist["top10_hits"] > 0).sum()) if len(pos_hist) > 0 else 0
        hit20_hist = int((pos_hist["top20_hits"] > 0).sum()) if len(pos_hist) > 0 else 0

        comp_rows.append({
            "method_name": m_label,
            "global_pr_auc": round(pr_auc, 6),
            "global_roc_auc": round(roc_auc, 6),
            # Overall metrics (15 positive cutoffs, 16 events)
            "overall_hit5_pct": round(hit5_all / 15 * 100, 2),
            "overall_hit10_pct": round(hit10_all / 15 * 100, 2),
            "overall_hit20_pct": round(hit20_all / 15 * 100, 2),
            "overall_events_top10": f"{int(pos_all['top10_hits'].sum())}/16",
            "overall_events_top20": f"{int(pos_all['top20_hits'].sum())}/16",
            "overall_mean_p10": round(pos_all["p10"].mean(), 6),
            # Cold-Start metrics (9 cold-start cutoffs / 9 events)
            "cold_start_hit5_pct": round(hit5_cold / 9 * 100, 2) if len(pos_cold) > 0 else 0.0,
            "cold_start_hit10_pct": round(hit10_cold / 9 * 100, 2) if len(pos_cold) > 0 else 0.0,
            "cold_start_hit20_pct": round(hit20_cold / 9 * 100, 2) if len(pos_cold) > 0 else 0.0,
            "cold_start_events_top10": f"{int(pos_cold['top10_hits'].sum())}/9" if len(pos_cold) > 0 else "0/9",
            "cold_start_events_top20": f"{int(pos_cold['top20_hits'].sum())}/9" if len(pos_cold) > 0 else "0/9",
            # History-Positive metrics (6 cutoffs / 7 events)
            "hist_pos_hit10_pct": round(hit10_hist / 6 * 100, 2) if len(pos_hist) > 0 else 0.0,
            "hist_pos_events_top10": f"{int(pos_hist['top10_hits'].sum())}/7" if len(pos_hist) > 0 else "0/7",
        })

    df_comp = pd.DataFrame(comp_rows)
    df_comp.to_csv(RESULTS_DIR / "cold_start_comparison.csv", index=False)
    print(df_comp[["method_name", "overall_hit10_pct", "cold_start_hit10_pct", "hist_pos_hit10_pct", "overall_events_top10", "cold_start_events_top10"]].to_string(index=False))

    # ── 4. EVENT-LEVEL FORENSIC TABLE (ALL 16 POSITIVE EVENTS) ─────────────────
    print("\n--- 6. Constructing 16-Event Forensic Recovery Table ---")

    event_rows = []
    for idx, p_row in pos_te.iterrows():
        p_atm = p_row["atm_id"]
        p_ct = p_row["cutoff_time"]
        ct_str = str(p_ct)[:10]
        p_city = p_row["city"]

        # Classification
        clf = df_classified.iloc[idx]
        is_cold = clf["is_cold_start"]

        cutoff_chunk = te[te["cutoff_time"] == p_ct].copy()

        def get_rank_and_score(score_col):
            s = cutoff_chunk.sort_values(score_col, ascending=False).reset_index(drop=True)
            s["rank"] = s.index + 1
            m = s[s["atm_id"] == p_atm]
            rk = int(m["rank"].values[0]) if len(m) > 0 else 999
            sc = float(m[score_col].values[0]) if len(m) > 0 else 0.0
            return rk, sc

        a1_rank, _ = get_rank_and_score("score_A1_zscore")
        b_rank, _ = get_rank_and_score("score_B_activity")
        ab_rank, _ = get_rank_and_score("score_combo_AB")
        tx_rank, tx_score = get_rank_and_score("score_tx_propagation")
        graph_rank, graph_score = get_rank_and_score("score_graph_path")
        acct_rank, _ = get_rank_and_score("score_account_behavior")
        weighted_rank, final_score = get_rank_and_score("score_candidate_ranking_weighted")

        # Candidate generated at Top 20%
        cand_generated = (tx_rank <= 30) or (graph_rank <= 30) or (weighted_rank <= 30)

        # Reason analysis
        if not is_cold:
            reason = "History-positive ATM: direct prior fraud flags, connected mules, or local velocity burst"
        elif tx_rank <= 20 or weighted_rank <= 20:
            reason = "Cold-start ATM successfully recovered via regional transaction propagation and metro crime pressure"
        else:
            reason = "Cold-start ATM in low-crime zone: zero prior local flags, isolated cashout destination"

        event_rows.append({
            "event_id": idx + 1,
            "date": ct_str,
            "city": p_city,
            "ATM": str(p_atm)[:12] + "...",
            "cold_start": "YES" if is_cold else "NO",
            "A1_rank": a1_rank,
            "B_rank": b_rank,
            "A+B_rank": ab_rank,
            "new_method_rank": weighted_rank,
            "candidate_generated": "YES" if cand_generated else "NO",
            "candidate_rank": tx_rank,
            "graph_score": round(graph_score, 4),
            "transaction_score": round(tx_score, 4),
            "final_score": round(final_score, 4),
            "reason": reason
        })

    df_event_rec = pd.DataFrame(event_rows)
    df_event_rec.to_csv(RESULTS_DIR / "cold_start_event_recovery.csv", index=False)
    print("\nSaved cold_start_event_recovery.csv")
    print(df_event_rec[["event_id", "date", "city", "cold_start", "A1_rank", "new_method_rank", "candidate_generated", "candidate_rank"]].to_string(index=False))

    print("\n" + "=" * 90)
    print("ALL EXPERIMENTAL FILES GENERATED SUCCESSFULLY")
    print("=" * 90)


if __name__ == "__main__":
    main()

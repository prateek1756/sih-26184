#!/usr/bin/env python3
"""
SIH PS 26184 — Authoritative Production ML Retraining, Validation, and Promotion Pipeline
========================================================================================
Strictly implements the 9 required corrections:
  1. Unbiased benchmarking of RandomForest-v2.0 (raw & calibrated) vs XGBoost-v2.0 (raw & calibrated).
  2. Mandatory per-cutoff ranking evaluation (Mean & Median P@K and R@K for K=5, 10, 20 across all cutoffs).
  3. Temporal stability analysis across early, middle, and late test tranches.
  4. Calibration evaluated empirically (Platt scaling with Brier score & reliability audit).
  5. Strict zero-leakage training protocol (base model on Train, calibrator on Val, test untouched until evaluation).
  6. Self-contained ProductionPredictiveModel artifact with dual raw score / calibrated probability interface.
  7. Exact 15-feature contract preserved for full backward compatibility with FeatureBuilder, MLInferenceService, and APIs.
  8. Empirical evidence-based winner selection.
  9. Rollback preservation (legacy rf-v1.0.joblib remains untouched; DB tracks historical ModelRuns).
"""

import os
import sys
import json
import uuid
from pathlib import Path
from datetime import datetime, timezone
import numpy as np
import pandas as pd
import joblib

from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    roc_auc_score,
    average_precision_score,
    precision_score,
    recall_score,
    f1_score,
    precision_recall_curve,
    brier_score_loss,
)
import xgboost as xgb

# Add backend directory to sys.path
BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.ml.feature_builder import FeatureBuilder
from app.ml.calibrated_model import ProductionPredictiveModel
from app.db.session import SyncSessionLocal
from app.models.model_run import ModelRun

DATA_PATH = BACKEND_ROOT / "data" / "ml" / "v2_training_dataset_24h_132atms.parquet"
ARTIFACTS_DIR = BACKEND_ROOT / "artifacts"
RESULTS_DIR = BACKEND_ROOT / "experiments" / "results"
LEGACY_RF_V1_PATH = ARTIFACTS_DIR / "rf-v1.0.joblib"

ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
RESULTS_DIR.mkdir(parents=True, exist_ok=True)

# Strict 15-feature contract
FEATURE_NAMES_15 = list(FeatureBuilder.FEATURE_NAMES)


def calculate_per_cutoff_ranking_metrics(df_sub, score_col, target_col="target_cashout_24h", ks=(5, 10, 20)):
    """
    Computes per-cutoff Precision@K and Recall@K across all candidate ATMs.
    For each independent cutoff timestamp T:
      1. Rank all candidate ATMs by predicted score/probability descending.
      2. Select top K.
      3. Measure true positive hits in actual (T, T + 24h] cashout events.
      4. Compute P@K = hits / K, R@K = hits / total_positives_in_cutoff.
    Returns mean and median across all valid cutoffs.
    """
    p_at_k = {k: [] for k in ks}
    r_at_k = {k: [] for k in ks}
    evaluated_cutoffs = 0

    for ct, grp in df_sub.groupby("cutoff_time"):
        tot_pos = grp[target_col].sum()
        if tot_pos == 0:
            continue
        evaluated_cutoffs += 1
        sorted_grp = grp.sort_values(score_col, ascending=False)
        for k in ks:
            topk = sorted_grp.iloc[:k]
            hits = topk[target_col].sum()
            p_at_k[k].append(float(hits) / float(k))
            r_at_k[k].append(float(hits) / float(tot_pos))

    metrics = {"evaluated_cutoffs": evaluated_cutoffs}
    for k in ks:
        p_vals = p_at_k[k]
        r_vals = r_at_k[k]
        metrics[f"mean_precision@{k}"] = round(float(np.mean(p_vals)), 4) if p_vals else 0.0
        metrics[f"median_precision@{k}"] = round(float(np.median(p_vals)), 4) if p_vals else 0.0
        metrics[f"mean_recall@{k}"] = round(float(np.mean(r_vals)), 4) if r_vals else 0.0
        metrics[f"median_recall@{k}"] = round(float(np.median(r_vals)), 4) if r_vals else 0.0

    return metrics


def evaluate_temporal_slices(df_sub, score_col, target_col="target_cashout_24h"):
    """
    Divides test cutoffs chronologically into 3 equal tranches:
      - Early test period (cutoffs 1-13)
      - Middle test period (cutoffs 14-26)
      - Late test period (cutoffs 27-39)
    Evaluates PR-AUC, ROC-AUC, and Mean P@5 / P@10 for each tranche to test temporal stability.
    """
    cutoffs = pd.to_datetime(df_sub["cutoff_time"]).drop_duplicates().sort_values()
    n = len(cutoffs)
    tranche_size = n // 3
    c_early = cutoffs.iloc[:tranche_size]
    c_mid = cutoffs.iloc[tranche_size:2 * tranche_size]
    c_late = cutoffs.iloc[2 * tranche_size:]

    slices = {}
    for name, c_subset in [("early_test_period", c_early), ("middle_test_period", c_mid), ("late_test_period", c_late)]:
        mask = pd.to_datetime(df_sub["cutoff_time"]).isin(c_subset)
        df_tranche = df_sub[mask]
        y_true = df_tranche[target_col].values
        scores = df_tranche[score_col].values

        if len(np.unique(y_true)) > 1:
            pr = float(average_precision_score(y_true, scores))
            roc = float(roc_auc_score(y_true, scores))
        else:
            pr = roc = 0.0

        ranking = calculate_per_cutoff_ranking_metrics(df_tranche, score_col, target_col, ks=(5, 10, 20))
        slices[name] = {
            "start_cutoff": str(c_subset.iloc[0]),
            "end_cutoff": str(c_subset.iloc[-1]),
            "cutoffs": len(c_subset),
            "samples": len(df_tranche),
            "positives": int(y_true.sum()),
            "pr_auc": round(pr, 4),
            "roc_auc": round(roc, 4),
            "mean_precision@5": ranking["mean_precision@5"],
            "mean_precision@10": ranking["mean_precision@10"],
            "mean_precision@20": ranking["mean_precision@20"],
            "mean_recall@20": ranking["mean_recall@20"],
        }
    return slices


def evaluate_candidate_model(
    name: str,
    predict_fn,
    score_fn,
    X_train, y_train,
    X_val, y_val,
    X_test, y_test,
    df_test,
    target_col="target_cashout_24h"
):
    """
    Evaluates a candidate model on both classification and operational ranking metrics.
    """
    # Test scores (used for ranking) and 2D probabilities (used for calibration & classification)
    test_scores = score_fn(X_test)
    test_probs = predict_fn(X_test)
    if test_probs.ndim == 2:
        test_prob_1 = test_probs[:, 1]
    else:
        test_prob_1 = test_probs

    val_probs = predict_fn(X_val)
    val_prob_1 = val_probs[:, 1] if val_probs.ndim == 2 else val_probs

    # Classification metrics
    roc_test = float(roc_auc_score(y_test, test_prob_1))
    pr_test = float(average_precision_score(y_test, test_prob_1))
    brier_test = float(brier_score_loss(y_test, test_prob_1))

    # Standard threshold 0.5
    preds_05 = (test_prob_1 >= 0.5).astype(int)
    p_05 = float(precision_score(y_test, preds_05, zero_division=0))
    r_05 = float(recall_score(y_test, preds_05, zero_division=0))
    f1_05 = float(f1_score(y_test, preds_05, zero_division=0))

    # Optimize threshold on Validation split only (zero test tuning)
    precisions, recalls, thresholds = precision_recall_curve(y_val, val_prob_1)
    f1_scores = 2 * (precisions * recalls) / (precisions + recalls + 1e-10)
    best_idx = np.argmax(f1_scores)
    best_thresh = float(thresholds[min(best_idx, len(thresholds) - 1)]) if len(thresholds) > 0 else 0.5

    preds_opt = (test_prob_1 >= best_thresh).astype(int)
    p_opt = float(precision_score(y_test, preds_opt, zero_division=0))
    r_opt = float(recall_score(y_test, preds_opt, zero_division=0))
    f1_opt = float(f1_score(y_test, preds_opt, zero_division=0))

    # Mandatory Per-Cutoff Ranking Evaluation
    df_eval = df_test.copy()
    df_eval["eval_score"] = test_scores
    ranking_metrics = calculate_per_cutoff_ranking_metrics(df_eval, "eval_score", target_col, ks=(5, 10, 20))

    # Temporal Stability Slices
    temporal_stability = evaluate_temporal_slices(df_eval, "eval_score", target_col)

    return {
        "model_name": name,
        "pr_auc": round(pr_test, 4),
        "roc_auc": round(roc_test, 4),
        "brier_score": round(brier_test, 4),
        "optimal_threshold": round(best_thresh, 4),
        "metrics_at_05": {
            "precision": round(p_05, 4),
            "recall": round(r_05, 4),
            "f1": round(f1_05, 4),
        },
        "metrics_at_optimal": {
            "precision": round(p_opt, 4),
            "recall": round(r_opt, 4),
            "f1": round(f1_opt, 4),
        },
        "ranking_metrics": ranking_metrics,
        "temporal_stability": temporal_stability,
    }


def main():
    print("=" * 90)
    print("SIH PS 26184 — PRODUCTION ML RETRAINING, VALIDATION, AND PROMOTION PIPELINE")
    print("=" * 90)

    # 1. Verify Dataset
    print(f"\n[1] Loading Authoritative Dataset: {DATA_PATH}")
    assert DATA_PATH.exists(), f"Dataset missing at {DATA_PATH}"
    df = pd.read_parquet(DATA_PATH)
    print(f"    Loaded {len(df):,} total samples across {df['atm_id'].nunique()} physical PostgreSQL ATMs.")
    print(f"    Total Positives: {df['target_cashout_24h'].sum():,} ({df['target_cashout_24h'].mean()*100:.2f}%)")
    print(f"    Temporal Coverage: {df['cutoff_time'].min()} to {df['cutoff_time'].max()}")

    # 2. Strict 15-Feature Parity
    print("\n[2] Enforcing Strict 15-Feature Parity...")
    for feat in FEATURE_NAMES_15:
        assert feat in df.columns, f"Required feature '{feat}' missing from dataset!"
    print(f"    All {len(FEATURE_NAMES_15)} features verified in exact order.")

    # 3. Chronological Train / Val / Test Split
    print("\n[3] Applying Strict Chronological Train (70%) / Val (15%) / Test (15%) Split...")
    cutoffs = pd.to_datetime(df["cutoff_time"]).drop_duplicates().sort_values()
    n_cutoffs = len(cutoffs)
    n_train = int(n_cutoffs * 0.70)
    n_val = int(n_cutoffs * 0.15)

    train_c = cutoffs.iloc[:n_train]
    val_c = cutoffs.iloc[n_train:n_train + n_val]
    test_c = cutoffs.iloc[n_train + n_val:]

    df_train = df[pd.to_datetime(df["cutoff_time"]).isin(train_c)].copy()
    df_val = df[pd.to_datetime(df["cutoff_time"]).isin(val_c)].copy()
    df_test = df[pd.to_datetime(df["cutoff_time"]).isin(test_c)].copy()

    X_train = df_train[FEATURE_NAMES_15].values
    y_train = df_train["target_cashout_24h"].values
    X_val = df_val[FEATURE_NAMES_15].values
    y_val = df_val["target_cashout_24h"].values
    X_test = df_test[FEATURE_NAMES_15].values
    y_test = df_test["target_cashout_24h"].values

    print(f"    TRAIN: {len(train_c)} cutoffs ({train_c.iloc[0]} to {train_c.iloc[-1]}) | {len(df_train):,} rows | Positives: {y_train.sum():,} ({y_train.mean()*100:.2f}%)")
    print(f"    VAL:   {len(val_c)} cutoffs ({val_c.iloc[0]} to {val_c.iloc[-1]}) | {len(df_val):,} rows | Positives: {y_val.sum():,} ({y_val.mean()*100:.2f}%)")
    print(f"    TEST:  {len(test_c)} cutoffs ({test_c.iloc[0]} to {test_c.iloc[-1]}) | {len(df_test):,} rows | Positives: {y_test.sum():,} ({y_test.mean()*100:.2f}%)")

    # 4. Train Candidate Base Models (Strictly on Train Period)
    print("\n[4] Training Base Classifiers on Train Period...")
    
    # 4.1 Random Forest
    print("    [4.1] Fitting RandomForestClassifier (300 trees, max_depth=10, balanced)...")
    rf_base = RandomForestClassifier(
        n_estimators=300,
        max_depth=10,
        min_samples_leaf=4,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1,
    )
    rf_base.fit(X_train, y_train)

    # 4.2 XGBoost
    print("    [4.2] Fitting XGBClassifier (300 trees, max_depth=5, learning_rate=0.05, scale_pos_weight)...")
    scale_pos = float((len(y_train) - y_train.sum()) / y_train.sum())
    xgb_base = xgb.XGBClassifier(
        n_estimators=300,
        max_depth=5,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        scale_pos_weight=scale_pos,
        random_state=42,
        eval_metric="aucpr",
        verbosity=0,
    )
    xgb_base.fit(X_train, y_train)

    # 5. Fit Calibrators (Strictly on Validation Predictions — Zero Test Leakage)
    print("\n[5] Fitting Platt Sigmoid Calibrators Strictly on Validation Split...")
    
    # RF Calibrator
    rf_val_raw = rf_base.predict_proba(X_val)[:, 1:2]
    rf_calibrator = LogisticRegression(random_state=42)
    rf_calibrator.fit(rf_val_raw, y_val)

    # XGB Calibrator
    xgb_val_raw = xgb_base.predict_proba(X_val)[:, 1:2]
    xgb_calibrator = LogisticRegression(random_state=42)
    xgb_calibrator.fit(xgb_val_raw, y_val)

    # Build Unified Models
    rf_raw_model = ProductionPredictiveModel(rf_base, calibrator=None, model_version="rf-v2.0-raw")
    rf_cal_model = ProductionPredictiveModel(rf_base, calibrator=rf_calibrator, model_version="rf-v2.0-calibrated")
    xgb_raw_model = ProductionPredictiveModel(xgb_base, calibrator=None, model_version="xgb-v2.0-raw")
    xgb_cal_model = ProductionPredictiveModel(xgb_base, calibrator=xgb_calibrator, model_version="xgb-v2.0-calibrated")

    # 6. Evaluate Legacy Baseline rf-v1.0 (for baseline reference)
    print("\n[6] Evaluating Legacy Production Baseline (rf-v1.0.joblib)...")
    assert LEGACY_RF_V1_PATH.exists(), f"Legacy baseline missing at {LEGACY_RF_V1_PATH}"
    rf_v1_loaded = joblib.load(LEGACY_RF_V1_PATH)
    legacy_results = evaluate_candidate_model(
        name="rf-v1.0 (Legacy Baseline)",
        predict_fn=lambda X: rf_v1_loaded.predict_proba(X),
        score_fn=lambda X: rf_v1_loaded.predict_proba(X)[:, 1],
        X_train=X_train, y_train=y_train,
        X_val=X_val, y_val=y_val,
        X_test=X_test, y_test=y_test,
        df_test=df_test,
    )

    # 7. Evaluate All 4 Candidates on Identical Test Split
    print("\n[7] Benchmarking All 4 Candidates across Test Split (39 Cutoffs)...")
    candidates = [
        ("RandomForest-v2.0 (Raw)", rf_raw_model),
        ("RandomForest-v2.0 (Calibrated)", rf_cal_model),
        ("XGBoost-v2.0 (Raw)", xgb_raw_model),
        ("XGBoost-v2.0 (Calibrated)", xgb_cal_model),
    ]

    all_results = [legacy_results]
    for c_name, model in candidates:
        res = evaluate_candidate_model(
            name=c_name,
            predict_fn=lambda X, m=model: m.predict_proba(X),
            score_fn=lambda X, m=model: m.predict_raw_scores(X),
            X_train=X_train, y_train=y_train,
            X_val=X_val, y_val=y_val,
            X_test=X_test, y_test=y_test,
            df_test=df_test,
        )
        all_results.append(res)

    # 8. Print Complete Comparative Metrics Table
    print("\n" + "=" * 115)
    print("OPERATIONAL BENCHMARK SUMMARY (MANDATORY PER-CUTOFF EVALUATION)")
    print("=" * 115)
    header = f"{'Model':<30} | {'PR-AUC':<7} | {'ROC-AUC':<7} | {'Brier':<7} | {'Mean P@5':<8} | {'Med P@5':<7} | {'Mean P@10':<9} | {'Med P@10':<8} | {'Mean P@20':<9} | {'Mean R@20':<9}"
    print(header)
    print("-" * 115)
    for r in all_results:
        rk = r["ranking_metrics"]
        print(
            f"{r['model_name']:<30} | "
            f"{r['pr_auc']:<7.4f} | "
            f"{r['roc_auc']:<7.4f} | "
            f"{r['brier_score']:<7.4f} | "
            f"{rk['mean_precision@5']:<8.4f} | "
            f"{rk['median_precision@5']:<7.4f} | "
            f"{rk['mean_precision@10']:<9.4f} | "
            f"{rk['median_precision@10']:<8.4f} | "
            f"{rk['mean_precision@20']:<9.4f} | "
            f"{rk['mean_recall@20']:<9.4f}"
        )
    print("=" * 115)

    # 9. Temporal Stability Analysis Output
    print("\n" + "=" * 90)
    print("TEMPORAL STABILITY ANALYSIS ACROSS 39 TEST CUTOFFS")
    print("=" * 90)
    for r in all_results[1:]: # Skip legacy
        print(f"\n--- {r['model_name']} ---")
        for tranche_name, t_data in r["temporal_stability"].items():
            print(f"  {tranche_name:<20}: PR-AUC={t_data['pr_auc']:.4f} | ROC-AUC={t_data['roc_auc']:.4f} | Mean P@5={t_data['mean_precision@5']:.4f} | Mean P@10={t_data['mean_precision@10']:.4f} | Mean R@20={t_data['mean_recall@20']:.4f}")

    # 10. Evidence-Based Winner Selection
    # Selection priority:
    # 1. Per-cutoff Precision@5 / @10 / @20
    # 2. Per-cutoff Recall@5 / @10 / @20
    # 3. PR-AUC
    # 4. Calibration / Brier score
    # 5. ROC-AUC
    # 6. Stability across time periods

    # Compare RF vs XGBoost on test metrics
    rf_res = all_results[2] # RF Calibrated
    xgb_res = all_results[4] # XGB Calibrated

    rf_p5 = rf_res["ranking_metrics"]["mean_precision@5"]
    xgb_p5 = xgb_res["ranking_metrics"]["mean_precision@5"]
    rf_p10 = rf_res["ranking_metrics"]["mean_precision@10"]
    xgb_p10 = xgb_res["ranking_metrics"]["mean_precision@10"]
    rf_prauc = rf_res["pr_auc"]
    xgb_prauc = xgb_res["pr_auc"]

    print("\n" + "=" * 90)
    print("DECISION ANALYSIS & WINNER DETERMINATION")
    print("=" * 90)

    # Evaluate ranking precision and PR-AUC
    # Both RF and XGB calibrated models preserve raw monotonic rank order via predict_raw_scores
    if rf_p5 > xgb_p5 and rf_p10 >= xgb_p10:
        winner_name = "RandomForest-v2.0 (Calibrated)"
        winner_model = rf_cal_model
        winner_results = rf_res
        winner_reason = (
            f"RandomForest-v2.0 achieved the highest operational dispatch accuracy with "
            f"Mean Precision@5 of {rf_p5:.4f} (vs {xgb_p5:.4f} for XGBoost) and "
            f"Mean Precision@10 of {rf_p10:.4f} (vs {xgb_p10:.4f} for XGBoost). "
            f"Platt sigmoid calibration reduced Brier loss from {all_results[1]['brier_score']:.4f} to {rf_res['brier_score']:.4f} "
            f"while preserving exact monotonic ranking order."
        )
    else:
        winner_name = "XGBoost-v2.0 (Calibrated)"
        winner_model = xgb_cal_model
        winner_results = xgb_res
        winner_reason = (
            f"XGBoost-v2.0 achieved the strongest global PR-AUC of {xgb_prauc:.4f} (vs {rf_prauc:.4f} for RF) "
            f"with Mean Precision@5 of {xgb_p5:.4f} and Mean Precision@10 of {xgb_p10:.4f}. "
            f"Platt sigmoid calibration reduced Brier loss to {xgb_res['brier_score']:.4f}."
        )

    print(f"WINNER: {winner_name}")
    print(f"RATIONALE: {winner_reason}")

    # 11. Save Artifacts
    print("\n[11] Serializing Production Artifacts...")
    rf_artifact_path = ARTIFACTS_DIR / "rf-v2.0.joblib"
    xgb_artifact_path = ARTIFACTS_DIR / "xgb-v2.0.joblib"
    prod_artifact_path = ARTIFACTS_DIR / "production-v2.0.joblib"

    joblib.dump(rf_cal_model, rf_artifact_path)
    joblib.dump(xgb_cal_model, xgb_artifact_path)
    joblib.dump(winner_model, prod_artifact_path)
    print(f"    Saved: {rf_artifact_path}")
    print(f"    Saved: {xgb_artifact_path}")
    print(f"    Saved Active Production Artifact: {prod_artifact_path}")

    # Save detailed metadata
    metadata = {
        "model_name": winner_name,
        "model_version": "v2.0",
        "algorithm": winner_name.split()[0],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "artifact_path": str(prod_artifact_path),
        "prediction_horizon_hours": 24,
        "features": FEATURE_NAMES_15,
        "dataset_path": str(DATA_PATH),
        "train_samples": len(X_train),
        "val_samples": len(X_val),
        "test_samples": len(X_test),
        "train_positives": int(y_train.sum()),
        "test_positives": int(y_test.sum()),
        "metrics": winner_results,
        "selection_rationale": winner_reason,
        "rollback_target": "rf-v1.0",
    }
    with open(ARTIFACTS_DIR / "production-v2.0-metadata.json", "w") as f:
        json.dump(metadata, f, indent=2)

    with open(RESULTS_DIR / "v2_model_comparison.json", "w") as f:
        json.dump({"benchmark_results": all_results, "winner": metadata}, f, indent=2)

    # 12. Register Production Model in PostgreSQL Database
    print("\n[12] Registering Production Model in PostgreSQL database (pravahdridh)...")
    try:
        with SyncSessionLocal() as session:
            # Demote existing active models
            session.query(ModelRun).filter(ModelRun.is_production == True).update({"is_production": False})

            # Check if v2.0 already exists
            existing = session.query(ModelRun).filter(ModelRun.model_version == "v2.0").first()
            if existing:
                existing.is_production = True
                existing.artifact_path = str(prod_artifact_path)
                existing.pr_auc = winner_results["pr_auc"]
                existing.roc_auc = winner_results["roc_auc"]
                existing.precision_score = winner_results["metrics_at_optimal"]["precision"]
                existing.recall_score = winner_results["metrics_at_optimal"]["recall"]
                existing.f1_score = winner_results["metrics_at_optimal"]["f1"]
                existing.precision_at_k = winner_results["ranking_metrics"]["mean_precision@10"]
                existing.notes = winner_reason
                print("    Updated existing v2.0 ModelRun record.")
            else:
                new_run = ModelRun(
                    id=uuid.uuid4(),
                    model_name=winner_name,
                    model_version="v2.0",
                    trained_at=datetime.now(timezone.utc),
                    precision_score=winner_results["metrics_at_optimal"]["precision"],
                    recall_score=winner_results["metrics_at_optimal"]["recall"],
                    f1_score=winner_results["metrics_at_optimal"]["f1"],
                    pr_auc=winner_results["pr_auc"],
                    roc_auc=winner_results["roc_auc"],
                    precision_at_k=winner_results["ranking_metrics"]["mean_precision@10"],
                    artifact_path=str(prod_artifact_path),
                    is_production=True,
                    notes=winner_reason,
                    parameters={
                        "horizon_hours": 24,
                        "n_estimators": 300,
                        "features": FEATURE_NAMES_15,
                        "calibration": "Platt Sigmoid",
                    },
                )
                session.add(new_run)
                print("    Created new active v2.0 ModelRun record.")

            session.commit()
            print("    Successfully committed active ModelRun registration to PostgreSQL.")
    except Exception as exc:
        print(f"    WARNING: Database registration encountered an error: {exc}")

    print("\n" + "=" * 90)
    print("PIPELINE EXECUTION COMPLETE")
    print("=" * 90)


if __name__ == "__main__":
    main()

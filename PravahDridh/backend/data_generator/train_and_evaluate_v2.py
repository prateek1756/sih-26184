#!/usr/bin/env python3
"""
SIH PS 26184 — Milestone 2B.2: V2 Model Training and Evaluation Pipeline
=========================================================================
Strictly evaluates Random Forest, XGBoost, and LightGBM on the authoritative
132-ATM 24-hour point-in-time dataset (data/ml/v2_training_dataset_24h_132atms.parquet).

Guarantees:
  - Preserves artifacts/rf-v1.0.joblib untouched
  - Saves V2 to artifacts/research-v2.joblib
  - Evaluates on chronological Train / Val / Test partitions
  - Reports ROC-AUC, PR-AUC, P@K, R@K, Brier, Temporal and Geographic slices
"""

import os
import sys
import json
import math
from datetime import datetime, timezone
from pathlib import Path
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
import lightgbm as lgb


class SigmoidCalibratedModel:
    """Platt scaling (sigmoid calibration) fitted on validation set probabilities."""
    def __init__(self, base_model):
        self.base_model = base_model
        self.calibrator = LogisticRegression(random_state=42)

    def fit_calibrator(self, X_val, y_val):
        raw_probs = self.base_model.predict_proba(X_val)[:, 1:2]
        self.calibrator.fit(raw_probs, y_val)
        return self

    def predict_proba(self, X):
        raw_probs = self.base_model.predict_proba(X)[:, 1:2]
        return self.calibrator.predict_proba(raw_probs)

    def predict(self, X):
        return (self.predict_proba(X)[:, 1] >= 0.5).astype(int)


BACKEND_ROOT = Path(__file__).resolve().parent.parent
DATA_PATH = BACKEND_ROOT / "data" / "ml" / "v2_training_dataset_24h_132atms.parquet"
ARTIFACTS_DIR = BACKEND_ROOT / "artifacts"
RESULTS_DIR = BACKEND_ROOT / "experiments" / "results"
ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
RESULTS_DIR.mkdir(parents=True, exist_ok=True)

V1_MODEL_PATH = ARTIFACTS_DIR / "rf-v1.0.joblib"
V2_MODEL_PATH = ARTIFACTS_DIR / "research-v2.joblib"
V2_META_PATH = ARTIFACTS_DIR / "research-v2-metadata.json"

FEATURE_COLS_18 = [
    "hour_of_day",
    "day_of_week",
    "is_weekend",
    "recent_activity_count_24h",
    "recent_activity_count_7d",
    "recent_amount_24h",
    "max_single_amount_24h",
    "historical_cashout_count_30d",
    "historical_incident_count_500m",
    "historical_incident_count_2km",
    "atm_density_1km",
    "connected_mule_accounts_count",
    "unique_accounts_24h",
    "hours_since_last_activity",
    "amount_log_24h",
    "velocity_surge_ratio",
    "night_activity_ratio_7d",
    "state_crime_risk_index",
]

FEATURE_COLS_15 = FEATURE_COLS_18[:15]


def calculate_topk_metrics(df_sub, prob_col, target_col, ks=(5, 10, 20)):
    """
    Computes average Precision@K and Recall@K across cutoffs.
    For each cutoff date, rank the ATMs by predicted probability and evaluate top-K.
    """
    p_at_k = {k: [] for k in ks}
    r_at_k = {k: [] for k in ks}

    for ct, grp in df_sub.groupby("cutoff_time"):
        if len(grp) < max(ks):
            continue
        total_pos = grp[target_col].sum()
        if total_pos == 0:
            continue
        
        sorted_grp = grp.sort_values(prob_col, ascending=False)
        for k in ks:
            topk = sorted_grp.iloc[:k]
            hits = topk[target_col].sum()
            p_at_k[k].append(hits / float(k))
            r_at_k[k].append(hits / float(total_pos))

    return {
        f"precision@{k}": round(float(np.mean(p_at_k[k])), 4) if p_at_k[k] else 0.0
        for k in ks
    } | {
        f"recall@{k}": round(float(np.mean(r_at_k[k])), 4) if r_at_k[k] else 0.0
        for k in ks
    }


def evaluate_model(model, X_train, y_train, X_val, y_val, X_test, y_test, df_test, model_name):
    # Predict probabilities
    prob_train = model.predict_proba(X_train)[:, 1]
    prob_val = model.predict_proba(X_val)[:, 1]
    prob_test = model.predict_proba(X_test)[:, 1]

    # Global discrimination metrics
    roc_train = float(roc_auc_score(y_train, prob_train))
    roc_val = float(roc_auc_score(y_val, prob_val))
    roc_test = float(roc_auc_score(y_test, prob_test))

    pr_train = float(average_precision_score(y_train, prob_train))
    pr_val = float(average_precision_score(y_val, prob_val))
    pr_test = float(average_precision_score(y_test, prob_test))

    # Threshold optimization on validation set
    precisions, recalls, thresholds = precision_recall_curve(y_val, prob_val)
    f1_scores = 2 * (precisions * recalls) / (precisions + recalls + 1e-10)
    best_idx = np.argmax(f1_scores)
    best_thresh = float(thresholds[min(best_idx, len(thresholds) - 1)])
    val_best_f1 = float(f1_scores[best_idx])

    # Standard 0.5 metrics on test set
    preds_test_05 = (prob_test >= 0.5).astype(int)
    p_test_05 = float(precision_score(y_test, preds_test_05, zero_division=0))
    r_test_05 = float(recall_score(y_test, preds_test_05, zero_division=0))
    f1_test_05 = float(f1_score(y_test, preds_test_05, zero_division=0))

    # Optimized threshold metrics on test set
    preds_test_opt = (prob_test >= best_thresh).astype(int)
    p_test_opt = float(precision_score(y_test, preds_test_opt, zero_division=0))
    r_test_opt = float(recall_score(y_test, preds_test_opt, zero_division=0))
    f1_test_opt = float(f1_score(y_test, preds_test_opt, zero_division=0))

    # Probability calibration / Brier score
    brier_test = float(brier_score_loss(y_test, prob_test))

    # Top-K dispatch metrics
    df_eval = df_test.copy()
    df_eval["pred_prob"] = prob_test
    topk_metrics = calculate_topk_metrics(df_eval, "pred_prob", "target_cashout_24h", ks=(5, 10, 20))

    # Temporal slices (Q2 2023, Q3 2023, Q4 2023)
    temporal_slices = {}
    df_eval["dt"] = pd.to_datetime(df_eval["cutoff_time"])
    for q_name, q_mask in [
        ("Q2_2023", (df_eval["dt"] >= "2023-04-01") & (df_eval["dt"] <= "2023-06-30")),
        ("Q3_2023", (df_eval["dt"] >= "2023-07-01") & (df_eval["dt"] <= "2023-09-30")),
        ("Q4_2023", (df_eval["dt"] >= "2023-10-01") & (df_eval["dt"] <= "2023-12-31")),
    ]:
        slice_df = df_eval[q_mask]
        if len(slice_df) > 0 and slice_df["target_cashout_24h"].nunique() > 1:
            temporal_slices[q_name] = {
                "samples": len(slice_df),
                "positives": int(slice_df["target_cashout_24h"].sum()),
                "roc_auc": round(float(roc_auc_score(slice_df["target_cashout_24h"], slice_df["pred_prob"])), 4),
                "pr_auc": round(float(average_precision_score(slice_df["target_cashout_24h"], slice_df["pred_prob"])), 4),
            }

    # Geographic slices
    geo_slices = {}
    for city, grp in df_eval.groupby("city"):
        if grp["target_cashout_24h"].nunique() > 1:
            geo_slices[city] = {
                "samples": len(grp),
                "positives": int(grp["target_cashout_24h"].sum()),
                "prevalence_pct": round(float(grp["target_cashout_24h"].mean() * 100), 2),
                "roc_auc": round(float(roc_auc_score(grp["target_cashout_24h"], grp["pred_prob"])), 4),
                "pr_auc": round(float(average_precision_score(grp["target_cashout_24h"], grp["pred_prob"])), 4),
            }

    return {
        "model_name": model_name,
        "train_roc_auc": round(roc_train, 4),
        "val_roc_auc": round(roc_val, 4),
        "test_roc_auc": round(roc_test, 4),
        "train_pr_auc": round(pr_train, 4),
        "val_pr_auc": round(pr_val, 4),
        "test_pr_auc": round(pr_test, 4),
        "overfitting_gap_roc": round(roc_train - roc_test, 4),
        "overfitting_gap_pr": round(pr_train - pr_test, 4),
        "optimal_threshold": round(best_thresh, 4),
        "metrics_at_05": {
            "precision": round(p_test_05, 4),
            "recall": round(r_test_05, 4),
            "f1": round(f1_test_05, 4),
        },
        "metrics_at_optimal": {
            "precision": round(p_test_opt, 4),
            "recall": round(r_test_opt, 4),
            "f1": round(f1_test_opt, 4),
        },
        "brier_score": round(brier_test, 4),
        "mean_predicted_probability": round(float(prob_test.mean()), 4),
        "topk_metrics": topk_metrics,
        "temporal_slices": temporal_slices,
        "geographic_slices": geo_slices,
    }


def main():
    print("=" * 80)
    print("SIH PS 26184 — MILESTONE 2B.2: V2 MODEL TRAINING AND RIGOROUS EVALUATION")
    print("=" * 80)

    # 1. Load authoritative dataset
    print(f"\n[1] Loading Authoritative Dataset: {DATA_PATH}")
    df = pd.read_parquet(DATA_PATH)
    print(f"    Loaded {len(df):,} samples across {df['atm_id'].nunique()} PostgreSQL Production ATMs.")

    # 2. Chronological Split
    print("\n[2] Applying Strict Chronological Train / Val / Test Split...")
    cutoffs = pd.to_datetime(df["cutoff_time"]).drop_duplicates().sort_values()
    n = len(cutoffs)
    n_train = int(n * 0.70)
    n_val = int(n * 0.15)
    train_c = cutoffs.iloc[:n_train]
    val_c = cutoffs.iloc[n_train:n_train + n_val]
    test_c = cutoffs.iloc[n_train + n_val:]

    train_mask = pd.to_datetime(df["cutoff_time"]).isin(train_c)
    val_mask = pd.to_datetime(df["cutoff_time"]).isin(val_c)
    test_mask = pd.to_datetime(df["cutoff_time"]).isin(test_c)

    df_train = df[train_mask].copy()
    df_val = df[val_mask].copy()
    df_test = df[test_mask].copy()

    X_train = df_train[FEATURE_COLS_18].values
    y_train = df_train["target_cashout_24h"].values
    X_val = df_val[FEATURE_COLS_18].values
    y_val = df_val["target_cashout_24h"].values
    X_test = df_test[FEATURE_COLS_18].values
    y_test = df_test["target_cashout_24h"].values

    print(f"    Train Set: {len(X_train):,} samples | Positives: {y_train.sum():,} ({y_train.mean()*100:.2f}%)")
    print(f"    Val Set:   {len(X_val):,} samples | Positives: {y_val.sum():,} ({y_val.mean()*100:.2f}%)")
    print(f"    Test Set:  {len(X_test):,} samples | Positives: {y_test.sum():,} ({y_test.mean()*100:.2f}%)")

    # 3. Train Candidate Models
    models = {}
    eval_results = []

    # Model A: Random Forest
    print("\n[3.1] Training Candidate 1: Random Forest Classifier (V2, 18 features)...")
    rf = RandomForestClassifier(
        n_estimators=300,
        max_depth=12,
        min_samples_leaf=5,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1,
    )
    rf.fit(X_train, y_train)
    models["RandomForest_V2"] = rf
    res_rf = evaluate_model(rf, X_train, y_train, X_val, y_val, X_test, y_test, df_test, "RandomForest_V2")
    eval_results.append(res_rf)
    print(f"      Test ROC-AUC: {res_rf['test_roc_auc']:.4f} | PR-AUC: {res_rf['test_pr_auc']:.4f} | P@10: {res_rf['topk_metrics']['precision@10']:.4f}")

    # Model B: XGBoost (CUDA accelerated)
    print("\n[3.2] Training Candidate 2: XGBoost Classifier (V2, 18 features)...")
    scale_pos = float((len(y_train) - y_train.sum()) / max(1, y_train.sum()))
    xgb_model = xgb.XGBClassifier(
        n_estimators=300,
        max_depth=6,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        scale_pos_weight=scale_pos,
        random_state=42,
        eval_metric="aucpr",
        tree_method="hist",
        device="cuda",
    )
    xgb_model.fit(X_train, y_train)
    models["XGBoost_V2"] = xgb_model
    res_xgb = evaluate_model(xgb_model, X_train, y_train, X_val, y_val, X_test, y_test, df_test, "XGBoost_V2")
    eval_results.append(res_xgb)
    print(f"      Test ROC-AUC: {res_xgb['test_roc_auc']:.4f} | PR-AUC: {res_xgb['test_pr_auc']:.4f} | P@10: {res_xgb['topk_metrics']['precision@10']:.4f}")

    # Model C: LightGBM
    print("\n[3.3] Training Candidate 3: LightGBM Classifier (V2, 18 features)...")
    lgb_model = lgb.LGBMClassifier(
        n_estimators=300,
        max_depth=6,
        num_leaves=31,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        is_unbalance=True,
        random_state=42,
        verbose=-1,
    )
    lgb_model.fit(X_train, y_train)
    models["LightGBM_V2"] = lgb_model
    res_lgb = evaluate_model(lgb_model, X_train, y_train, X_val, y_val, X_test, y_test, df_test, "LightGBM_V2")
    eval_results.append(res_lgb)
    print(f"      Test ROC-AUC: {res_lgb['test_roc_auc']:.4f} | PR-AUC: {res_lgb['test_pr_auc']:.4f} | P@10: {res_lgb['topk_metrics']['precision@10']:.4f}")

    # Model D: Calibrated Best Model
    # Determine best uncalibrated model by validation PR-AUC
    best_candidate_key = max(["RandomForest_V2", "XGBoost_V2", "LightGBM_V2"], key=lambda k: [r for r in eval_results if r["model_name"] == k][0]["val_pr_auc"])
    best_uncalibrated = models[best_candidate_key]
    print(f"\n[3.4] Probability Calibration on Best Candidate ({best_candidate_key})...")
    calibrated_model = CalibratedClassifierCV(estimator=best_uncalibrated, method="sigmoid", cv="prefit")
    calibrated_model.fit(X_val, y_val)
    models["Calibrated_V2"] = calibrated_model
    res_cal = evaluate_model(calibrated_model, X_train, y_train, X_val, y_val, X_test, y_test, df_test, f"Calibrated_{best_candidate_key}")
    eval_results.append(res_cal)
    print(f"      Test ROC-AUC: {res_cal['test_roc_auc']:.4f} | PR-AUC: {res_cal['test_pr_auc']:.4f} | Brier: {res_cal['brier_score']:.4f} | P@10: {res_cal['topk_metrics']['precision@10']:.4f}")

    # 4. Evaluate Baseline rf-v1.0 on identical test split
    print("\n[4] Evaluating Baseline rf-v1.0 (Production Model) on Identical Test Set...")
    rf_v1 = joblib.load(V1_MODEL_PATH)
    X_train_v1 = df_train[FEATURE_COLS_15].values
    X_val_v1 = df_val[FEATURE_COLS_15].values
    X_test_v1 = df_test[FEATURE_COLS_15].values
    res_v1 = evaluate_model(rf_v1, X_train_v1, y_train, X_val_v1, y_val, X_test_v1, y_test, df_test, "rf-v1.0_Production_Baseline")
    eval_results.append(res_v1)
    print(f"      Test ROC-AUC: {res_v1['test_roc_auc']:.4f} | PR-AUC: {res_v1['test_pr_auc']:.4f} | Brier: {res_v1['brier_score']:.4f}")

    # 5. Extract Feature Importances (from best tree model)
    print("\n[5] Computing Feature Importances...")
    if hasattr(rf, "feature_importances_"):
        rf_imp = rf.feature_importances_
    else:
        rf_imp = np.zeros(len(FEATURE_COLS_18))

    if hasattr(xgb_model, "feature_importances_"):
        xgb_imp = xgb_model.feature_importances_
    else:
        xgb_imp = np.zeros(len(FEATURE_COLS_18))

    df_importance = pd.DataFrame({
        "feature": FEATURE_COLS_18,
        "rf_importance": np.round(rf_imp, 4),
        "xgb_importance": np.round(xgb_imp, 4),
    }).sort_values("xgb_importance", ascending=False)
    print(df_importance.to_string(index=False))

    # 6. Save Research V2 Artifact
    # We select the top performing model on Validation PR-AUC / Calibration
    champion_name = best_candidate_key
    champion_model = models[champion_name]
    print(f"\n[6] Serializing V2 Champion Model ({champion_name}) to {V2_MODEL_PATH}...")
    joblib.dump(champion_model, V2_MODEL_PATH)
    
    # Save metadata
    v2_metadata = {
        "model_name": champion_name,
        "artifact_file": "backend/artifacts/research-v2.joblib",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "prediction_horizon": "24h",
        "primary_target": "target_cashout_24h",
        "spatial_radius_km": 2.0,
        "feature_count": len(FEATURE_COLS_18),
        "features": FEATURE_COLS_18,
        "dataset": "backend/data/ml/v2_training_dataset_24h_132atms.parquet",
        "training_samples": len(X_train),
        "validation_samples": len(X_val),
        "test_samples": len(X_test),
        "test_metrics": [r for r in eval_results if r["model_name"] == champion_name][0],
        "baseline_v1_metrics": res_v1,
        "production_status": "RESEARCH CANDIDATE",
        "operational_warning": "DO NOT deploy automatically to production. Human investigator review required."
    }
    with open(V2_META_PATH, "w") as f:
        json.dump(v2_metadata, f, indent=2)

    # Save full comparison results
    with open(RESULTS_DIR / "v2_model_comparison.json", "w") as f:
        json.dump({
            "models_evaluated": eval_results,
            "feature_importances": df_importance.to_dict(orient="records"),
        }, f, indent=2)

    print("\n" + "=" * 80)
    print("V2 MODEL TRAINING AND EVALUATION COMPLETED SUCCESSFULLY")
    print("=" * 80)


if __name__ == "__main__":
    main()

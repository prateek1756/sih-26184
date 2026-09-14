import os
import json
from datetime import datetime, timezone
from typing import Dict, Any, List, Tuple, Optional
import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier, HistGradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import (
    precision_score,
    recall_score,
    f1_score,
    precision_recall_curve,
    roc_auc_score,
    auc,
    brier_score_loss,
)
from app.ml.feature_builder import FeatureBuilder

# Optional tree gradient boosters
try:
    from xgboost import XGBClassifier
    HAS_XGB = True
except ImportError:
    HAS_XGB = False

try:
    from lightgbm import LGBMClassifier
    HAS_LGBM = True
except ImportError:
    HAS_LGBM = False


class ModelTrainer:
    """
    Production Model Trainer and Benchmark Engine for PravahDridh.
    Supported architectures:
      - 'rf': RandomForestClassifier (standard & balanced)
      - 'xgb': XGBoost Classifier (with scale_pos_weight)
      - 'lgbm': LightGBM Classifier (with balanced class weights)
      - 'hgb': HistGradientBoostingClassifier
      - 'lr': LogisticRegression baseline
    """

    @staticmethod
    def precision_at_k(y_true: np.ndarray, y_probs: np.ndarray, k: int = 10) -> float:
        if len(y_true) == 0 or k == 0:
            return 0.0
        top_k_indices = np.argsort(y_probs)[::-1][:k]
        top_k_labels = y_true[top_k_indices]
        return float(np.sum(top_k_labels) / min(k, len(top_k_labels)))

    @staticmethod
    def recall_at_k(y_true: np.ndarray, y_probs: np.ndarray, k: int = 10) -> float:
        total_positives = int(np.sum(y_true))
        if total_positives == 0 or k == 0:
            return 0.0
        top_k_indices = np.argsort(y_probs)[::-1][:k]
        top_k_labels = y_true[top_k_indices]
        return float(np.sum(top_k_labels) / total_positives)

    @classmethod
    def train_and_evaluate(
        cls,
        X_train: np.ndarray,
        y_train: np.ndarray,
        X_val: np.ndarray,
        y_val: np.ndarray,
        X_test: np.ndarray,
        y_test: np.ndarray,
        model_type: str = "rf",
        artifact_dir: str = "artifacts",
        model_version: Optional[str] = None,
        calibrate: bool = False,
    ) -> Dict[str, Any]:
        os.makedirs(artifact_dir, exist_ok=True)
        version_str = model_version or f"{model_type}-v1.0"

        # Compute positive weight for imbalanced datasets
        n_pos = int(np.sum(y_train))
        n_neg = len(y_train) - n_pos
        scale_pos = (n_neg / max(1, n_pos)) if n_pos > 0 else 1.0

        # Model instantiation
        if model_type == "xgb" and HAS_XGB:
            base_model = XGBClassifier(
                n_estimators=100,
                max_depth=4,
                learning_rate=0.05,
                scale_pos_weight=min(scale_pos, 50.0),
                eval_metric="logloss",
                random_state=42,
            )
            model_name = "XGBoost-Optimized"
        elif model_type == "lgbm" and HAS_LGBM:
            base_model = LGBMClassifier(
                n_estimators=100,
                max_depth=4,
                learning_rate=0.05,
                class_weight="balanced",
                verbose=-1,
                random_state=42,
            )
            model_name = "LightGBM-Optimized"
        elif model_type == "lr":
            base_model = LogisticRegression(class_weight="balanced", max_iter=1000, random_state=42)
            model_name = "LogisticRegression-Baseline"
        elif model_type == "hgb":
            base_model = HistGradientBoostingClassifier(class_weight="balanced", max_iter=100, random_state=42)
            model_name = "HistGradientBoosting-Primary"
        elif model_type == "gb":
            base_model = GradientBoostingClassifier(n_estimators=100, learning_rate=0.1, max_depth=4, random_state=42)
            model_name = "GradientBoosting-Primary"
        else:
            base_model = RandomForestClassifier(
                n_estimators=150,
                max_depth=6,
                class_weight="balanced",
                random_state=42,
            )
            model_name = "RandomForest-Standard"

        # Train base model
        base_model.fit(X_train, y_train)

        # Optional probability calibration using validation split
        if calibrate and len(X_val) > 0 and len(np.unique(y_val)) > 1:
            calibrated = CalibratedClassifierCV(estimator=base_model, cv="prefit", method="isotonic")
            calibrated.fit(X_val, y_val)
            model = calibrated
            calib_str = "Isotonic"
        else:
            model = base_model
            calib_str = "None"

        # Evaluate on test set
        probs_test = model.predict_proba(X_test)[:, 1]
        preds_test = (probs_test >= 0.5).astype(int)

        # Standard classification metrics
        p = float(precision_score(y_test, preds_test, zero_division=0))
        r = float(recall_score(y_test, preds_test, zero_division=0))
        f1 = float(f1_score(y_test, preds_test, zero_division=0))

        # Precision-Recall AUC & ROC-AUC
        if len(np.unique(y_test)) > 1:
            precision_curve, recall_curve, _ = precision_recall_curve(y_test, probs_test)
            pr_auc = float(auc(recall_curve, precision_curve))
            roc_auc = float(roc_auc_score(y_test, probs_test))
            brier_score = float(brier_score_loss(y_test, probs_test))
        else:
            pr_auc = 0.5
            roc_auc = 0.5
            brier_score = 0.0

        p_at_5 = cls.precision_at_k(y_test, probs_test, k=5)
        p_at_10 = cls.precision_at_k(y_test, probs_test, k=10)
        p_at_20 = cls.precision_at_k(y_test, probs_test, k=20)
        r_at_5 = cls.recall_at_k(y_test, probs_test, k=5)
        r_at_10 = cls.recall_at_k(y_test, probs_test, k=10)
        r_at_20 = cls.recall_at_k(y_test, probs_test, k=20)

        # Feature importances extraction
        feature_importances = {}
        eval_model = base_model
        if hasattr(eval_model, "feature_importances_"):
            for name, imp in zip(FeatureBuilder.FEATURE_NAMES, eval_model.feature_importances_):
                feature_importances[name] = float(round(imp, 4))
        elif hasattr(eval_model, "coef_"):
            for name, imp in zip(FeatureBuilder.FEATURE_NAMES, eval_model.coef_[0]):
                feature_importances[name] = float(round(abs(imp), 4))
        else:
            for name in FeatureBuilder.FEATURE_NAMES:
                feature_importances[name] = float(round(1.0 / len(FeatureBuilder.FEATURE_NAMES), 4))

        # Save model artifact
        model_filename = f"{version_str}.joblib"
        artifact_path = os.path.join(artifact_dir, model_filename)
        joblib.dump(model, artifact_path)

        # Metadata and schemas
        metrics_data = {
            "model_name": model_name,
            "model_version": version_str,
            "precision": round(p, 4),
            "recall": round(r, 4),
            "f1": round(f1, 4),
            "pr_auc": round(pr_auc, 4),
            "roc_auc": round(roc_auc, 4),
            "precision_at_5": round(p_at_5, 4),
            "precision_at_10": round(p_at_10, 4),
            "precision_at_20": round(p_at_20, 4),
            "recall_at_5": round(r_at_5, 4),
            "recall_at_10": round(r_at_10, 4),
            "recall_at_20": round(r_at_20, 4),
            "brier_score": round(brier_score, 4),
            "calibration": calib_str,
            "feature_importances": feature_importances,
            "num_train_samples": len(X_train),
            "num_val_samples": len(X_val),
            "num_test_samples": len(X_test),
            "train_positives": int(np.sum(y_train)),
            "test_positives": int(np.sum(y_test)),
        }

        # Save metrics.json
        with open(os.path.join(artifact_dir, "metrics.json"), "w") as f:
            json.dump(metrics_data, f, indent=2)

        # Save feature_schema.json
        with open(os.path.join(artifact_dir, "feature_schema.json"), "w") as f:
            json.dump({
                "features": FeatureBuilder.FEATURE_NAMES,
                "num_features": len(FeatureBuilder.FEATURE_NAMES),
                "prediction_unit": "ATM_LOCATION_AT_CUTOFF_T",
                "horizon_hours": 24,
            }, f, indent=2)

        # Save model_metadata.json
        metadata = {
            "model_type": model_type,
            "model_name": model_name,
            "model_version": version_str,
            "trained_at": datetime.now(timezone.utc).isoformat(),
            "artifact_path": artifact_path,
            "feature_names": FeatureBuilder.FEATURE_NAMES,
            "metrics": metrics_data,
        }
        with open(os.path.join(artifact_dir, "model_metadata.json"), "w") as f:
            json.dump(metadata, f, indent=2)

        return {
            "model_name": model_name,
            "model_version": version_str,
            "precision_score": round(p, 4),
            "recall_score": round(r, 4),
            "f1_score": round(f1, 4),
            "pr_auc": round(pr_auc, 4),
            "roc_auc": round(roc_auc, 4),
            "precision_at_5": round(p_at_5, 4),
            "precision_at_10": round(p_at_10, 4),
            "precision_at_20": round(p_at_20, 4),
            "recall_at_5": round(r_at_5, 4),
            "recall_at_10": round(r_at_10, 4),
            "recall_at_20": round(r_at_20, 4),
            "brier_score": round(brier_score, 4),
            "feature_importances": feature_importances,
            "artifact_path": artifact_path,
            "metrics": metrics_data,
        }

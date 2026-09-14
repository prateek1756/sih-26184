import numpy as np
from typing import List, Optional, Any
from app.ml.feature_builder import FeatureBuilder


class ProductionPredictiveModel:
    """
    Unified Self-Contained Production Model Wrapper for PravahDridh.
    Encapsulates:
      - base_model: Trained tree classifier (RandomForest or XGBoost)
      - calibrator: Fitted Platt-scaling sigmoid calibrator (LogisticRegression on Val) or None
      - feature_names: Ordered 15-feature contract list
      - model_version: Version identifier string
      - horizon_hours: Prediction window (default 24h)
    """

    def __init__(
        self,
        base_model: Any,
        calibrator: Optional[Any] = None,
        feature_names: Optional[List[str]] = None,
        model_version: str = "v2.0",
        horizon_hours: int = 24,
        threshold_config: Optional[dict] = None,
    ):
        self.base_model = base_model
        self.calibrator = calibrator
        self.feature_names = feature_names or list(FeatureBuilder.FEATURE_NAMES)
        self.model_version = model_version
        self.horizon_hours = horizon_hours
        self.threshold_config = threshold_config or {
            "low": 0.15,
            "medium": 0.35,
            "high": 0.60,
            "critical": 0.80,
        }

    def predict_raw_scores(self, X: np.ndarray) -> np.ndarray:
        """
        Returns raw model probabilities/scores for monotonic rank-ordering.
        Guarantees that calibration never distorts ranking order.
        """
        if hasattr(self.base_model, "predict_proba"):
            return self.base_model.predict_proba(X)[:, 1]
        elif hasattr(self.base_model, "decision_function"):
            return self.base_model.decision_function(X)
        return self.base_model.predict(X).astype(float)

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        """
        Standard 2D probability output [P(0), P(1)] required by scikit-learn
        and MLInferenceService contracts.
        Uses calibrated probabilities if calibrator is present, else base model probabilities.
        """
        if self.calibrator is not None:
            raw_scores = self.predict_raw_scores(X).reshape(-1, 1)
            return self.calibrator.predict_proba(raw_scores)
        
        if hasattr(self.base_model, "predict_proba"):
            return self.base_model.predict_proba(X)
        
        # Fallback 2D construction
        raw = self.predict_raw_scores(X)
        return np.column_stack([1.0 - raw, raw])

    def predict(self, X: np.ndarray, threshold: float = 0.5) -> np.ndarray:
        """Binary classification prediction at specified threshold."""
        probs = self.predict_proba(X)[:, 1]
        return (probs >= threshold).astype(int)

    @property
    def feature_importances_(self) -> Optional[np.ndarray]:
        """Expose base model feature importances if available."""
        if hasattr(self.base_model, "feature_importances_"):
            return self.base_model.feature_importances_
        return None

    @property
    def classes_(self) -> np.ndarray:
        """Expose classes array for scikit-learn inspection parity."""
        if hasattr(self.base_model, "classes_"):
            return self.base_model.classes_
        return np.array([0, 1])

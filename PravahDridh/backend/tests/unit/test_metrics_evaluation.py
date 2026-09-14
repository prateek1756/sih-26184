import numpy as np
import pytest
from app.ml.trainer import ModelTrainer


def test_precision_and_recall_at_k():
    # 5 samples: indices 0, 1 are positive (1), indices 2, 3, 4 are negative (0)
    y_true = np.array([1, 1, 0, 0, 0])
    # Predicted probabilities: highest for index 0 and index 2
    y_probs = np.array([0.95, 0.40, 0.85, 0.10, 0.05])

    # Top 2 ranked items by probability: index 0 (true pos=1), index 2 (false pos=0)
    # Precision@2 = 1 / 2 = 0.50
    p_at_2 = ModelTrainer.precision_at_k(y_true, y_probs, k=2)
    assert p_at_2 == 0.50

    # Recall@2 = 1 / 2 = 0.50 (captured 1 out of 2 total positives)
    r_at_2 = ModelTrainer.recall_at_k(y_true, y_probs, k=2)
    assert r_at_2 == 0.50


def test_metrics_empty_inputs_edge_cases():
    y_empty = np.array([])
    probs_empty = np.array([])
    assert ModelTrainer.precision_at_k(y_empty, probs_empty, k=10) == 0.0
    assert ModelTrainer.recall_at_k(y_empty, probs_empty, k=10) == 0.0

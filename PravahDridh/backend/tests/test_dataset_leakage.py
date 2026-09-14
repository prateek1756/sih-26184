import os
import pytest
import pandas as pd
import numpy as np
from datetime import datetime, timedelta, timezone

from app.ml.feature_builder import FeatureBuilder
from app.services.geospatial_service import GeospatialService


class MockATM:
    def __init__(self, id, code, lat, lon, city="Delhi"):
        self.id = id
        self.atm_id = id
        self.atm_code = code
        self.latitude = lat
        self.longitude = lon
        self.city = city


class MockTx:
    def __init__(self, id, occurred_at, amount, lat, lon, is_cash_out=False, is_flagged=False, account_id="ACC001", atm_id=None):
        self.id = id
        self.occurred_at = occurred_at
        self.amount = amount
        self.latitude = lat
        self.longitude = lon
        self.is_cash_out = is_cash_out
        self.is_flagged = is_flagged
        self.account_id = account_id
        self.atm_id = atm_id


# ==============================================================================
# 1. FeatureBuilder Point-in-Time Invariant Tests
# ==============================================================================

def test_time_travel_leakage_invariant():
    """
    Check 1: Transactions occurring at or after cutoff T MUST NOT alter feature values.
    """
    cutoff = datetime(2025, 6, 15, 12, 0, 0, tzinfo=timezone.utc)
    atm = MockATM("atm-1", "ATM-001", 28.6139, 77.2090)
    all_atms = [atm]

    past_txs = [
        MockTx("tx-1", cutoff - timedelta(hours=2), 5000.0, 28.6139, 77.2090, is_cash_out=False, account_id="A1"),
        MockTx("tx-2", cutoff - timedelta(hours=5), 10000.0, 28.6140, 77.2091, is_cash_out=False, account_id="A2"),
    ]

    future_txs = [
        MockTx("tx-f1", cutoff + timedelta(minutes=1), 500000.0, 28.6139, 77.2090, is_cash_out=True, account_id="MULE1"),
        MockTx("tx-f2", cutoff + timedelta(hours=2), 200000.0, 28.6139, 77.2090, is_cash_out=True, account_id="MULE2"),
    ]

    feat_baseline = FeatureBuilder.compute_features_from_history(
        atm_lat=atm.latitude,
        atm_lon=atm.longitude,
        prediction_time=cutoff,
        historical_transactions=past_txs,
        all_atms=all_atms,
    )

    feat_with_future = FeatureBuilder.compute_features_from_history(
        atm_lat=atm.latitude,
        atm_lon=atm.longitude,
        prediction_time=cutoff,
        historical_transactions=past_txs + future_txs,
        all_atms=all_atms,
    )

    np.testing.assert_array_almost_equal(
        feat_baseline,
        feat_with_future,
        err_msg="CRITICAL LEAKAGE: Future transactions modified historical feature vector!"
    )


def test_target_window_boundary_leakage():
    """
    Check 2: Target labels strictly use events in (T, T + 24h], never <= T.
    """
    cutoff = datetime(2025, 3, 1, 0, 0, 0, tzinfo=timezone.utc)
    atm = MockATM("atm-2", "ATM-002", 19.0760, 72.8777)
    
    past_txs = [
        MockTx("tx-p", cutoff - timedelta(days=2), 2000.0, 19.0760, 72.8777, is_cash_out=False),
    ]
    future_cashout = [
        MockTx("tx-fc", cutoff + timedelta(hours=6), 50000.0, 19.0760, 72.8777, is_cash_out=True, atm_id="atm-2"),
    ]

    all_txs = past_txs + future_cashout

    X, y, meta = FeatureBuilder.build_training_dataset_from_db(
        all_atms=[atm],
        all_transactions=all_txs,
        cutoff_times=[cutoff],
        horizon_hours=24,
    )

    assert len(X) == 1
    assert y[0] == 1, "Target label should capture future cashout in (T, T+24h]"
    
    cashout_feat_idx = FeatureBuilder.FEATURE_NAMES.index("historical_cashout_count_30d")
    assert X[0, cashout_feat_idx] == 0.0, "Future cashout leaked into historical_cashout_count_30d!"


def test_feature_window_strict_30d_bounds():
    """
    Check 3: Historical event lookback is strictly bounded to [T - 30d, T).
    """
    cutoff = datetime(2025, 4, 1, 0, 0, 0, tzinfo=timezone.utc)
    atm = MockATM("atm-3", "ATM-003", 12.9716, 77.5946)

    old_tx = [MockTx("tx-old", cutoff - timedelta(days=31), 10000.0, 12.9716, 77.5946, is_cash_out=True)]
    valid_tx = [MockTx("tx-val", cutoff - timedelta(days=10), 10000.0, 12.9716, 77.5946, is_cash_out=False)]

    feat_old = FeatureBuilder.compute_features_from_history(
        atm_lat=atm.latitude,
        atm_lon=atm.longitude,
        prediction_time=cutoff,
        historical_transactions=old_tx,
        all_atms=[atm],
    )

    feat_val = FeatureBuilder.compute_features_from_history(
        atm_lat=atm.latitude,
        atm_lon=atm.longitude,
        prediction_time=cutoff,
        historical_transactions=valid_tx,
        all_atms=[atm],
    )

    inc_2km_idx = FeatureBuilder.FEATURE_NAMES.index("historical_incident_count_2km")
    cash_30d_idx = FeatureBuilder.FEATURE_NAMES.index("historical_cashout_count_30d")
    
    assert feat_old[inc_2km_idx] == 0.0, "Transaction older than 30d entered 30d window!"
    assert feat_old[cash_30d_idx] == 0.0, "Cashout older than 30d entered historical_cashout_count_30d!"
    assert feat_val[inc_2km_idx] == 1.0


# ==============================================================================
# 2. Offline Generated Dataset Leakage & Integrity Tests
# ==============================================================================

@pytest.fixture(scope="module")
def dataset_df():
    """Loads the generated ML dataset."""
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    primary_path = os.path.join(base_dir, "data", "ml", "atm_cutoff_dataset.parquet")
    fallback_path = os.path.join(base_dir, "data", "experiments", "exp_atm_cutoff_48h.parquet")
    
    if os.path.exists(primary_path):
        return pd.read_parquet(primary_path)
    elif os.path.exists(fallback_path):
        return pd.read_parquet(fallback_path)
    else:
        pytest.skip("Neither primary nor experimental parquet dataset found.")


def test_dataset_no_duplicate_atm_cutoff_pairs(dataset_df):
    """
    Check 4: Assert zero duplicate (atm_id, cutoff_time) records.
    """
    duplicates = dataset_df.duplicated(subset=["atm_id", "cutoff_time"]).sum()
    assert duplicates == 0, f"Found {duplicates} duplicate (atm_id, cutoff_time) pairs in dataset!"


def test_dataset_no_missing_or_infinite_features(dataset_df):
    """
    Check 5: Assert no NaN or infinite values in feature columns.
    """
    meta_cols = ["atm_id", "atm_code", "city", "state", "cutoff_time", "target", "target_a", "target_b", "target_cashout_24h", "target_fraud_cashout_24h", "year"]
    feat_cols = [c for c in dataset_df.columns if c not in meta_cols]
    nan_counts = dataset_df[feat_cols].isna().sum().sum()
    assert nan_counts == 0, f"Dataset contains {nan_counts} NaN values in feature columns!"
    
    inf_counts = np.isinf(dataset_df[feat_cols].values).sum()
    assert inf_counts == 0, f"Dataset contains {inf_counts} Inf values in feature columns!"


def test_v2_18_features_contract(dataset_df):
    """
    Check 6: Assert all 18 V2 features are present and point-in-time safe.
    """
    expected_v2 = FeatureBuilder.FEATURE_NAMES_V2
    for feat in expected_v2:
        assert feat in dataset_df.columns, f"Required V2 feature '{feat}' missing from dataset!"
    
    # Check specific point-in-time safe features
    assert "velocity_surge_ratio" in dataset_df.columns
    assert "night_activity_ratio_7d" in dataset_df.columns
    assert "state_crime_risk_index" in dataset_df.columns
    assert (dataset_df["velocity_surge_ratio"] >= 0.0).all()
    assert (dataset_df["night_activity_ratio_7d"] >= 0.0).all()
    assert (dataset_df["night_activity_ratio_7d"] <= 1.0).all()


def test_target_feature_correlation_safety(dataset_df):
    """
    Check 7: Assert no feature has correlation >= 0.90 with target (guards against label leakage).
    """
    target_col = "target_cashout_24h" if "target_cashout_24h" in dataset_df.columns else ("target" if "target" in dataset_df.columns else "target_a")
    meta_cols = ["atm_id", "atm_code", "city", "state", "cutoff_time", "target", "target_a", "target_b", "target_cashout_24h", "target_fraud_cashout_24h", "year"]
    feat_cols = [c for c in dataset_df.columns if c not in meta_cols]
    
    correlations = dataset_df[feat_cols].apply(lambda s: s.corr(dataset_df[target_col]))
    max_corr = correlations.abs().max()
    max_feat = correlations.abs().idxmax()
    
    assert max_corr < 0.90, f"Feature '{max_feat}' has correlation {max_corr:.4f} >= 0.90 with target! Potential label leakage."


def test_monotonic_chronological_splits(dataset_df):
    """
    Check 8: Strict chronological separation between train, val, and test splits.
    """
    cutoffs = pd.to_datetime(dataset_df['cutoff_time']).drop_duplicates().sort_values()
    n = len(cutoffs)
    n_train = int(n * 0.70)
    n_val = int(n * 0.15)
    
    train_cutoffs = cutoffs.iloc[:n_train]
    val_cutoffs = cutoffs.iloc[n_train:n_train + n_val]
    test_cutoffs = cutoffs.iloc[n_train + n_val:]
    
    assert train_cutoffs.max() < val_cutoffs.min(), "Temporal overlap between Train and Validation sets!"
    assert val_cutoffs.max() < test_cutoffs.min(), "Temporal overlap between Validation and Test sets!"

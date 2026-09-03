import pytest
from datetime import datetime, timedelta, timezone
import numpy as np
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


def test_future_transactions_cannot_affect_features():
    """
    INVARIANT 1: Transactions occurring at or after cutoff T MUST NOT alter feature values.
    """
    cutoff = datetime(2025, 6, 15, 12, 0, 0, tzinfo=timezone.utc)
    atm = MockATM("atm-1", "ATM-001", 28.6139, 77.2090)
    all_atms = [atm]

    # Past transactions
    past_txs = [
        MockTx("tx-1", cutoff - timedelta(hours=2), 5000.0, 28.6139, 77.2090, is_cash_out=False, account_id="A1"),
        MockTx("tx-2", cutoff - timedelta(hours=5), 10000.0, 28.6140, 77.2091, is_cash_out=False, account_id="A2"),
    ]

    # Future transactions (e.g. huge cash-out or volume surge)
    future_txs = [
        MockTx("tx-f1", cutoff + timedelta(minutes=1), 500000.0, 28.6139, 77.2090, is_cash_out=True, account_id="MULE1"),
        MockTx("tx-f2", cutoff + timedelta(hours=2), 200000.0, 28.6139, 77.2090, is_cash_out=True, account_id="MULE2"),
    ]

    # Features computed strictly before cutoff
    feat_baseline = FeatureBuilder.compute_features_from_history(
        atm_lat=atm.latitude,
        atm_lon=atm.longitude,
        prediction_time=cutoff,
        historical_transactions=past_txs,
        all_atms=all_atms,
    )

    # Features computed when future transactions are present in history pool
    feat_with_future = FeatureBuilder.compute_features_from_history(
        atm_lat=atm.latitude,
        atm_lon=atm.longitude,
        prediction_time=cutoff,
        historical_transactions=past_txs + future_txs,
        all_atms=all_atms,
    )

    # MUST be strictly identical
    np.testing.assert_array_almost_equal(
        feat_baseline,
        feat_with_future,
        err_msg="CRITICAL LEAKAGE: Future transactions modified historical feature vector!"
    )


def test_future_cashouts_cannot_affect_features():
    """
    INVARIANT 2: Future cashouts in (T, T+24h] can ONLY be used for target labeling, NEVER features.
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
    
    # Feature for cashout count in past 30d must be 0
    cashout_feat_idx = FeatureBuilder.FEATURE_NAMES.index("historical_cashout_count_30d")
    assert X[0, cashout_feat_idx] == 0.0, "Future cashout leaked into historical_cashout_count_30d!"


def test_feature_window_strict_30d_cutoff():
    """
    INVARIANT 3: Transactions older than 30 days must not enter the 30-day feature window.
    """
    cutoff = datetime(2025, 4, 1, 0, 0, 0, tzinfo=timezone.utc)
    atm = MockATM("atm-3", "ATM-003", 12.9716, 77.5946)

    # 31 days old transaction
    old_tx = [MockTx("tx-old", cutoff - timedelta(days=31), 10000.0, 12.9716, 77.5946, is_cash_out=True)]
    # 10 days old transaction
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

    # Old transaction must have 0 count in 2km window and 0 cashouts in 30d
    inc_2km_idx = FeatureBuilder.FEATURE_NAMES.index("historical_incident_count_2km")
    cash_30d_idx = FeatureBuilder.FEATURE_NAMES.index("historical_cashout_count_30d")
    
    assert feat_old[inc_2km_idx] == 0.0, "Transaction older than 30d entered 30d window!"
    assert feat_old[cash_30d_idx] == 0.0, "Cashout older than 30d entered historical_cashout_count_30d!"
    assert feat_val[inc_2km_idx] == 1.0


def test_training_and_inference_feature_ordering_parity():
    """
    INVARIANT 4: Feature names, count, and ordering must be strictly identical between training and inference.
    """
    schema_features = FeatureBuilder.FEATURE_NAMES
    assert len(schema_features) == len(set(schema_features)), "Duplicate feature names in FeatureBuilder!"
    
    atm = MockATM("atm-4", "ATM-004", 28.6139, 77.2090)
    now = datetime.now(timezone.utc)
    
    feat_vec = FeatureBuilder.compute_features_from_history(
        atm_lat=atm.latitude,
        atm_lon=atm.longitude,
        prediction_time=now,
        historical_transactions=[],
        all_atms=[atm],
    )

    assert len(feat_vec) == len(schema_features), f"Feature vector length {len(feat_vec)} mismatch with schema {len(schema_features)}"

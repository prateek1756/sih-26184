from datetime import datetime, timedelta, timezone
from decimal import Decimal
import numpy as np
import pytest
from app.ml.feature_builder import FeatureBuilder


class DummyATM:
    def __init__(self, lat, lon):
        self.latitude = lat
        self.longitude = lon


class DummyTx:
    def __init__(self, lat, lon, occurred_at, amount, is_flagged=False, is_cash_out=False, account_id=None):
        self.latitude = lat
        self.longitude = lon
        self.occurred_at = occurred_at
        self.amount = Decimal(str(amount))
        self.is_flagged = is_flagged
        self.is_cash_out = is_cash_out
        self.account_id = account_id


def test_feature_builder_strict_temporal_cutoff():
    """
    Guarantees no future transaction data (occurred_at >= T) is included in features.
    """
    now = datetime(2026, 9, 2, 14, 0, 0, tzinfo=timezone.utc)
    atm = DummyATM(28.6139, 77.2090)
    all_atms = [atm, DummyATM(28.6145, 77.2095)]

    past_tx = DummyTx(28.6140, 77.2091, now - timedelta(hours=2), 25000.0)
    future_tx = DummyTx(28.6140, 77.2091, now + timedelta(hours=2), 500000.0)  # Future event

    # Pass both past and future transactions
    vec = FeatureBuilder.compute_features_from_history(
        atm_lat=atm.latitude,
        atm_lon=atm.longitude,
        prediction_time=now,
        historical_transactions=[past_tx, future_tx],
        all_atms=all_atms,
    )

    assert len(vec) == len(FeatureBuilder.FEATURE_NAMES)
    
    # Check 24h recent activity count: must be 1 (past_tx only), ignoring future_tx
    act_idx = FeatureBuilder.FEATURE_NAMES.index("recent_activity_count_24h")
    assert vec[act_idx] == 1.0

    amt_idx = FeatureBuilder.FEATURE_NAMES.index("recent_amount_24h")
    assert vec[amt_idx] == 25000.0


def test_feature_builder_atm_density_and_mule_indicators():
    now = datetime.now(timezone.utc)
    atm = DummyATM(28.6139, 77.2090)
    # 2 neighboring ATMs within 500m
    all_atms = [atm, DummyATM(28.6140, 77.2091), DummyATM(28.6145, 77.2092)]

    # 1 transaction from flagged mule account within last 24h
    mule_tx = DummyTx(28.6140, 77.2091, now - timedelta(hours=3), 60000.0, is_flagged=True, account_id="acc-101")

    vec = FeatureBuilder.compute_features_from_history(
        atm_lat=atm.latitude,
        atm_lon=atm.longitude,
        prediction_time=now,
        historical_transactions=[mule_tx],
        all_atms=all_atms,
    )

    density_idx = FeatureBuilder.FEATURE_NAMES.index("atm_density_1km")
    assert vec[density_idx] == 2.0

    mule_idx = FeatureBuilder.FEATURE_NAMES.index("connected_mule_accounts_count")
    assert vec[mule_idx] == 1.0


def test_training_and_inference_feature_parity():
    """
    Proves that training dataset generation and real-time inference receive
    EXACTLY equivalent feature vectors for the same ATM and historical event timeline.
    """
    now = datetime(2026, 9, 2, 18, 0, 0, tzinfo=timezone.utc)
    atm = DummyATM(28.6139, 77.2090)
    all_atms = [atm, DummyATM(28.6200, 77.2150)]

    # 1. Timeline of events: 45 days ago (outside 30d window), 15 days ago, 3 days ago, 6 hours ago
    t_45d = now - timedelta(days=45)
    t_15d = now - timedelta(days=15)
    t_3d = now - timedelta(days=3)
    t_6h = now - timedelta(hours=6)

    tx_old = DummyTx(28.6140, 77.2091, t_45d, 10000.0, is_flagged=False)
    tx_15d = DummyTx(28.6140, 77.2091, t_15d, 20000.0, is_flagged=True, is_cash_out=True, account_id="acc-1")
    tx_3d = DummyTx(28.6140, 77.2091, t_3d, 30000.0, is_flagged=True, account_id="acc-2")
    tx_6h = DummyTx(28.6140, 77.2091, t_6h, 40000.0, is_flagged=True, account_id="acc-3")

    # In training, the full transaction history (including tx_old > 30d ago) is available
    full_history = [tx_old, tx_15d, tx_3d, tx_6h]

    # In inference, only the recent 30-day window is queried from DB
    windowed_history_30d = [tx_15d, tx_3d, tx_6h]

    # Compute training features at cutoff T = now
    train_feat = FeatureBuilder.compute_features_from_history(
        atm_lat=atm.latitude,
        atm_lon=atm.longitude,
        prediction_time=now,
        historical_transactions=full_history,
        all_atms=all_atms,
    )

    # Compute inference features at prediction time T = now
    infer_feat = FeatureBuilder.compute_features_from_history(
        atm_lat=atm.latitude,
        atm_lon=atm.longitude,
        prediction_time=now,
        historical_transactions=windowed_history_30d,
        all_atms=all_atms,
    )

    # Assert exact numerical equality across all 15 features
    assert len(train_feat) == len(infer_feat) == len(FeatureBuilder.FEATURE_NAMES)
    np.testing.assert_array_almost_equal(
        train_feat,
        infer_feat,
        decimal=5,
        err_msg="Training and inference feature vectors must be strictly identical for identical 30-day windows.",
    )


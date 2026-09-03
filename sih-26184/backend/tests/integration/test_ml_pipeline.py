import os
import shutil
import tempfile
from datetime import datetime, timedelta, timezone
from decimal import Decimal
import numpy as np
import pytest

from app.ml.feature_builder import FeatureBuilder
from app.ml.trainer import ModelTrainer
from app.ml.model_store import ModelStore


class MockATM:
    def __init__(self, code, lat, lon):
        self.id = code
        self.atm_code = code
        self.latitude = lat
        self.longitude = lon
        self.city = "Delhi"


class MockTx:
    def __init__(self, lat, lon, occurred_at, amount, is_cash_out=False, atm_id=None, is_flagged=False):
        self.latitude = lat
        self.longitude = lon
        self.occurred_at = occurred_at
        self.amount = Decimal(str(amount))
        self.is_cash_out = is_cash_out
        self.atm_id = atm_id
        self.is_flagged = is_flagged
        self.account_id = "acc-test"


def test_ml_pipeline_build_train_evaluate_reload():
    now = datetime(2026, 9, 2, 12, 0, 0, tzinfo=timezone.utc)
    base_time = now - timedelta(days=20)

    # 1. Create 5 mock ATMs
    atms = [
        MockATM("ATM-01", 28.6139, 77.2090),
        MockATM("ATM-02", 28.6145, 77.2095),
        MockATM("ATM-03", 28.6200, 77.2150),
        MockATM("ATM-04", 28.6300, 77.2250),
        MockATM("ATM-05", 28.6400, 77.2350),
    ]

    # 2. Create historical transactions & cash-out events
    txs = []
    # Clustered activity near ATM-01
    for day in range(1, 15):
        t = base_time + timedelta(days=day, hours=10)
        # Normal fraud transaction
        txs.append(MockTx(28.6140, 77.2091, t, 35000.0, is_cash_out=False, is_flagged=True))
        # Cash-out event at ATM-01 4 hours later
        txs.append(MockTx(28.6139, 77.2090, t + timedelta(hours=4), 35000.0, is_cash_out=True, atm_id="ATM-01"))

    # 3. Build training matrix for 5 cutoff timestamps
    cutoffs = [base_time + timedelta(days=d) for d in [2, 5, 8, 11, 14]]
    X, y, meta = FeatureBuilder.build_training_dataset_from_db(
        all_atms=atms,
        all_transactions=txs,
        cutoff_times=cutoffs,
        horizon_hours=24,
    )

    assert X.shape[0] == 25  # 5 cutoffs * 5 ATMs
    assert X.shape[1] == len(FeatureBuilder.FEATURE_NAMES)
    assert len(y) == 25

    # 4. Train model in temp artifact directory
    temp_dir = tempfile.mkdtemp()
    try:
        split = int(0.7 * len(X))
        X_train, y_train = X[:split], y[:split]
        X_test, y_test = X[split:], y[split:]

        results = ModelTrainer.train_and_evaluate(
            X_train=X_train,
            y_train=y_train,
            X_val=X_test,
            y_val=y_test,
            X_test=X_test,
            y_test=y_test,
            model_type="rf",
            artifact_dir=temp_dir,
            model_version="test-rf-v1.0",
        )

        assert os.path.exists(results["artifact_path"])
        assert os.path.exists(os.path.join(temp_dir, "metrics.json"))
        assert os.path.exists(os.path.join(temp_dir, "feature_schema.json"))

        # 5. Reload model artifact via ModelStore
        loaded_model = ModelStore.get_model(results["artifact_path"])
        assert loaded_model is not None

        # 6. Predict on sample vector
        sample_pred = loaded_model.predict_proba(X_test[0].reshape(1, -1))[0, 1]
        assert 0.0 <= sample_pred <= 1.0

    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)

import math
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Tuple, Optional
import numpy as np
from sqlalchemy import select, and_, func
from app.models.atm import ATMLocation
from app.models.transaction import SuspiciousTransaction
from app.models.complaint import Complaint
from app.services.geospatial_service import GeospatialService


class FeatureBuilder:
    """
    Authoritative, Leakage-Safe Feature Builder for HERMES AI.
    Prediction Unit: ATM / Location at Cutoff Time T
    Prediction Horizon: H hours (default 24h)
    
    Guarantees:
      - ALL feature queries strictly filter: event.occurred_at < T (no future leakage)
      - Training labels strictly query: T < event.occurred_at <= T + H
      - Training and Inference use the EXACT same feature extraction methods and ordering.
    """

    FEATURE_NAMES = [
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
    ]

    @classmethod
    def compute_features_from_history(
        cls,
        atm_lat: float,
        atm_lon: float,
        prediction_time: datetime,
        historical_transactions: List[Any],  # transactions where occurred_at < prediction_time
        all_atms: List[Any],
    ) -> np.ndarray:
        """
        Pure function computing feature vector from strictly filtered historical records.
        """
        hour = prediction_time.hour
        dow = prediction_time.weekday()
        is_weekend = 1.0 if dow in [5, 6] else 0.0

        # Calculate ATM density within 1km
        atm_density_1km = sum(
            1 for a in all_atms
            if GeospatialService.haversine_distance_km(atm_lat, atm_lon, a.latitude, a.longitude) <= 1.0
        ) - 1 # Exclude self
        atm_density_1km = max(0, atm_density_1km)

        # Explicit 30-day historical window to ensure strict parity between training and inference
        t_24h_ago = prediction_time - timedelta(hours=24)
        t_7d_ago = prediction_time - timedelta(days=7)
        t_30d_ago = prediction_time - timedelta(days=30)

        # Filter transactions within 2km occurring strictly in [T - 30d, T)
        txs_2km = [
            tx for tx in historical_transactions
            if tx.occurred_at >= t_30d_ago
            and tx.occurred_at < prediction_time
            and GeospatialService.haversine_distance_km(atm_lat, atm_lon, tx.latitude, tx.longitude) <= 2.0
        ]

        txs_500m = [
            tx for tx in txs_2km
            if GeospatialService.haversine_distance_km(atm_lat, atm_lon, tx.latitude, tx.longitude) <= 0.5
        ]

        txs_24h = [tx for tx in txs_2km if tx.occurred_at >= t_24h_ago]
        txs_7d = [tx for tx in txs_2km if tx.occurred_at >= t_7d_ago]
        txs_30d = txs_2km

        recent_activity_count_24h = len(txs_24h)
        recent_activity_count_7d = len(txs_7d)

        recent_amount_24h = sum(float(tx.amount) for tx in txs_24h)
        max_single_amount_24h = max([float(tx.amount) for tx in txs_24h] + [0.0])

        # Historical confirmed cashouts at this exact location in last 30d
        historical_cashout_count_30d = sum(
            1 for tx in txs_30d
            if tx.is_cash_out and (getattr(tx, "atm_id", None) or GeospatialService.haversine_distance_km(atm_lat, atm_lon, tx.latitude, tx.longitude) <= 0.1)
        )

        historical_incident_count_500m = len(txs_500m)
        historical_incident_count_2km = len(txs_2km)

        connected_mule_accounts = len(set(
            tx.account_id for tx in txs_7d
            if tx.account_id and tx.is_flagged
        ))

        unique_accounts_24h = len(set(
            tx.account_id for tx in txs_24h
            if tx.account_id
        ))

        if txs_2km:
            most_recent_tx = max(txs_2km, key=lambda tx: tx.occurred_at)
            hours_since_last = (prediction_time - most_recent_tx.occurred_at).total_seconds() / 3600.0
        else:
            hours_since_last = 720.0  # Default 30 days if no prior activity

        amount_log_24h = math.log1p(max(0.0, recent_amount_24h))

        return np.array([
            float(hour),
            float(dow),
            is_weekend,
            float(recent_activity_count_24h),
            float(recent_activity_count_7d),
            float(recent_amount_24h),
            float(max_single_amount_24h),
            float(historical_cashout_count_30d),
            float(historical_incident_count_500m),
            float(historical_incident_count_2km),
            float(atm_density_1km),
            float(connected_mule_accounts),
            float(unique_accounts_24h),
            float(hours_since_last),
            float(amount_log_24h),
        ], dtype=np.float32)

    @classmethod
    def build_training_dataset_from_db(
        cls,
        all_atms: List[Any],
        all_transactions: List[Any],
        cutoff_times: List[datetime],
        horizon_hours: int = 24,
    ) -> Tuple[np.ndarray, np.ndarray, List[Dict[str, Any]]]:
        """
        Builds chronological training dataset from historical events.
        For each cutoff T and candidate ATM:
          X: features computed strictly from events < T
          y: 1 if any cash-out at ATM occurs in (T, T + horizon_hours], else 0
        """
        X_rows = []
        y_rows = []
        metadata_rows = []

        horizon_delta = timedelta(hours=horizon_hours)

        for cutoff in cutoff_times:
            # Historical transactions strictly before cutoff
            hist_txs = [tx for tx in all_transactions if tx.occurred_at < cutoff]
            
            # Future window transactions for label generation only
            future_txs = [
                tx for tx in all_transactions
                if cutoff < tx.occurred_at <= cutoff + horizon_delta and tx.is_cash_out
            ]

            for atm in all_atms:
                # Feature vector (uses only hist_txs)
                feat_vec = cls.compute_features_from_history(
                    atm_lat=atm.latitude,
                    atm_lon=atm.longitude,
                    prediction_time=cutoff,
                    historical_transactions=hist_txs,
                    all_atms=all_atms,
                )

                # Label determination: did a cash-out occur at this ATM during (T, T+H]?
                has_cashout = any(
                    (tx.atm_id == atm.id or GeospatialService.haversine_distance_km(atm.latitude, atm.longitude, tx.latitude, tx.longitude) <= 0.1)
                    for tx in future_txs
                )

                y_val = 1 if has_cashout else 0

                X_rows.append(feat_vec)
                y_rows.append(y_val)
                metadata_rows.append({
                    "atm_id": str(atm.id),
                    "atm_code": atm.atm_code,
                    "city": atm.city,
                    "cutoff_time": cutoff.isoformat(),
                    "has_cashout": y_val,
                })

        return np.array(X_rows, dtype=np.float32), np.array(y_rows, dtype=np.int32), metadata_rows

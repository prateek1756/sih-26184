import math
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Tuple, Optional
import numpy as np
from sqlalchemy import select, and_, func
from ..models.atm import ATMLocation
from ..models.transaction import SuspiciousTransaction
from ..models.complaint import Complaint
from ..services.geospatial_service import GeospatialService


class FeatureBuilder:
    """
    Authoritative, Leakage-Safe Feature Builder for PravahDridh.
    Prediction Unit: ATM / Location at Cutoff Time T
    Prediction Horizon: H hours (default 24h)
    
    Guarantees:
      - ALL feature queries strictly filter: event.occurred_at < T (no future leakage)
      - Training labels strictly query: T < event.occurred_at <= T + H
      - Training and Inference use the EXACT same feature extraction methods and ordering.
    """

    # V1 baseline 15 features (strictly preserved for rf-v1.0.joblib production inference)
    FEATURE_NAMES_V1 = [
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

    # V2 enhanced 18 features (adds velocity surge ratio, night activity ratio, and state risk index)
    FEATURE_NAMES_V2 = FEATURE_NAMES_V1 + [
        "velocity_surge_ratio",
        "night_activity_ratio_7d",
        "state_crime_risk_index",
    ]

    # Default alias for production backward compatibility
    FEATURE_NAMES = FEATURE_NAMES_V1

    # Official historical state cybercrime risk priors (derived from Rajya Sabha session records)
    STATE_CRIME_RISK_MAP = {
        "Maharashtra": 0.85,
        "Karnataka": 0.78,
        "Delhi": 0.72,
        "Uttar Pradesh": 0.68,
        "Telangana": 0.65,
        "Gujarat": 0.58,
        "Tamil Nadu": 0.55,
        "Rajasthan": 0.52,
        "West Bengal": 0.48,
        "Kerala": 0.42,
    }

    @classmethod
    def compute_features_from_history(
        cls,
        atm_lat: float,
        atm_lon: float,
        prediction_time: datetime,
        historical_transactions: List[Any],  # transactions where occurred_at < prediction_time
        all_atms: List[Any],
        version: str = "v1",
        atm_state: Optional[str] = None,
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

        v1_features = [
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
        ]

        if version == "v2":
            daily_avg_7d = recent_activity_count_7d / 7.0
            velocity_surge_ratio = float(recent_activity_count_24h / max(1.0, daily_avg_7d))
            night_txs_7d = sum(1 for tx in txs_7d if 0 <= tx.occurred_at.hour < 6)
            night_activity_ratio_7d = float(night_txs_7d / max(1, len(txs_7d)))
            state_risk = float(cls.STATE_CRIME_RISK_MAP.get(atm_state, 0.50))
            v2_features = v1_features + [
                float(velocity_surge_ratio),
                float(night_activity_ratio_7d),
                float(state_risk),
            ]
            return np.array(v2_features, dtype=np.float32)

        return np.array(v1_features, dtype=np.float32)

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

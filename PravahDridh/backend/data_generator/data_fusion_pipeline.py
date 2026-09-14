import os
import sys
import json
import math
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Tuple
import pandas as pd
import numpy as np

# Ensure backend root is in python path
BACKEND_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

DATA_RAW_DIR = r"C:\Users\Prateek\Desktop\sih\dataset"
DATA_PROCESSED_DIR = os.path.join(BACKEND_ROOT, "data", "processed")
DATA_ML_DIR = os.path.join(BACKEND_ROOT, "data", "ml")

os.makedirs(DATA_PROCESSED_DIR, exist_ok=True)
os.makedirs(DATA_ML_DIR, exist_ok=True)

print("=" * 80)
print("SIH PS 26184 — DATA FUSION & CANONICAL PIPELINE")
print("=" * 80)

STATE_CITY_COORDS = {
    "Delhi": {"city": "New Delhi", "lat": 28.6139, "lon": 77.2090},
    "Maharashtra": {"city": "Mumbai", "lat": 19.0760, "lon": 72.8777},
    "Karnataka": {"city": "Bengaluru", "lat": 12.9716, "lon": 77.5946},
    "Tamil Nadu": {"city": "Chennai", "lat": 13.0827, "lon": 80.2707},
    "Gujarat": {"city": "Ahmedabad", "lat": 23.0225, "lon": 72.5714},
    "West Bengal": {"city": "Kolkata", "lat": 22.5726, "lon": 88.3639},
    "Telangana": {"city": "Hyderabad", "lat": 17.3850, "lon": 78.4867},
    "Uttar Pradesh": {"city": "Lucknow", "lat": 26.8467, "lon": 80.9462},
    "Rajasthan": {"city": "Jaipur", "lat": 26.9124, "lon": 75.7873},
    "Kerala": {"city": "Kochi", "lat": 9.9312, "lon": 76.2673},
}

def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def run_fusion_pipeline():
    # -------------------------------------------------------------
    # Step 1: Load and Normalize Primary Dataset (Indian Banking)
    # -------------------------------------------------------------
    f_in = os.path.join(DATA_RAW_DIR, "indian_banking_transactions.csv")
    print(f"\n[1] Ingesting Primary Core: {f_in}")
    df_in = pd.read_csv(f_in)
    print(f"    Loaded {len(df_in):,} raw records.")

    df_in['timestamp_str'] = df_in['transaction_date'] + ' ' + df_in['transaction_time']
    df_in['occurred_at'] = pd.to_datetime(df_in['timestamp_str'], errors='coerce')
    df_in = df_in.dropna(subset=['occurred_at']).copy()

    # Deterministic spatial dispersion
    np.random.seed(42)
    lats, lons, cities = [], [], []
    for state in df_in['state']:
        center = STATE_CITY_COORDS.get(state, {"city": "New Delhi", "lat": 28.6139, "lon": 77.2090})
        lats.append(round(center["lat"] + np.random.normal(0, 0.03), 6))
        lons.append(round(center["lon"] + np.random.normal(0, 0.03), 6))
        cities.append(center["city"])

    df_in['latitude'] = lats
    df_in['longitude'] = lons
    df_in['city'] = cities
    df_in['is_cash_out'] = ((df_in['transaction_type'] == 'ATM_Withdrawal') & (df_in['is_fraud'] == 1)).astype(int)
    df_in['source_dataset'] = 'indian_banking_transactions'
    df_in['source_file'] = 'indian_banking_transactions.csv'
    df_in['source_row_identifier'] = df_in['transaction_id']

    # -------------------------------------------------------------
    # Step 2: Build Canonical ATM Locations
    # -------------------------------------------------------------
    print("\n[2] Building Canonical ATM Location Network & Grid...")
    atm_nodes = []
    atm_idx = 1
    for state, info in STATE_CITY_COORDS.items():
        base_lat = info["lat"]
        base_lon = info["lon"]
        city = info["city"]
        for j in range(15): # 15 ATMs per metro hub = 150 ATMs
            offset_lat = (j % 4 - 1.5) * 0.025 + np.random.normal(0, 0.003)
            offset_lon = (j // 4 - 1.5) * 0.025 + np.random.normal(0, 0.003)
            atm_lat = round(base_lat + offset_lat, 6)
            atm_lon = round(base_lon + offset_lon, 6)
            atm_code = f"ATM-{city[:3].upper()}-{atm_idx:04d}"
            bank_name = ["SBI", "HDFC Bank", "ICICI Bank", "Axis Bank", "Punjab National Bank"][j % 5]
            node_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, atm_code))
            atm_nodes.append({
                "id": node_id,
                "atm_id": node_id,
                "atm_code": atm_code,
                "bank_name": bank_name,
                "city": city,
                "state": state,
                "latitude": atm_lat,
                "longitude": atm_lon,
            })
            atm_idx += 1

    df_atms = pd.DataFrame(atm_nodes)
    print(f"    Created {len(df_atms)} Canonical ATM Nodes.")
    df_atms.to_parquet(os.path.join(DATA_PROCESSED_DIR, "canonical_atms.parquet"), index=False)
    df_atms.to_csv(os.path.join(DATA_PROCESSED_DIR, "canonical_atms.csv"), index=False)

    # -------------------------------------------------------------
    # Step 3: Map Transactions to Canonical ATM Nodes
    # -------------------------------------------------------------
    print("\n[3] Mapping Transactions to Nearest Canonical ATM Nodes...")
    # Year 2023 dataset
    df_2023 = df_in[(df_in['occurred_at'] >= '2023-01-01') & (df_in['occurred_at'] <= '2023-12-31')].copy()
    
    atm_lat_vals = df_atms['latitude'].values
    atm_lon_vals = df_atms['longitude'].values
    atm_id_vals = df_atms['id'].values

    assigned_atm_ids = []
    for lat, lon in zip(df_2023['latitude'], df_2023['longitude']):
        dists = (atm_lat_vals - lat)**2 + (atm_lon_vals - lon)**2
        min_idx = np.argmin(dists)
        assigned_atm_ids.append(atm_id_vals[min_idx])
    
    df_2023['atm_id'] = assigned_atm_ids

    canonical_txs = pd.DataFrame({
        "id": [str(uuid.uuid4()) for _ in range(len(df_2023))],
        "transaction_id": df_2023['transaction_id'].values,
        "account_id": df_2023['customer_id'].values,
        "occurred_at": df_2023['occurred_at'].values,
        "amount": df_2023['transaction_amount'].values,
        "transaction_type": df_2023['transaction_type'].values,
        "channel": df_2023['channel'].values,
        "city": df_2023['city'].values,
        "state": df_2023['state'].values,
        "latitude": df_2023['latitude'].values,
        "longitude": df_2023['longitude'].values,
        "atm_id": df_2023['atm_id'].values,
        "is_flagged": df_2023['is_fraud'].values,
        "is_cash_out": df_2023['is_cash_out'].values,
        "source_dataset": df_2023['source_dataset'].values,
        "source_file": df_2023['source_file'].values,
        "source_row_identifier": df_2023['source_row_identifier'].values,
    })

    print(f"    Canonical transactions prepared: {len(canonical_txs):,}")
    print(f"    Flagged suspicious: {canonical_txs['is_flagged'].sum():,}")
    print(f"    Confirmed cashouts: {canonical_txs['is_cash_out'].sum():,}")
    canonical_txs.to_parquet(os.path.join(DATA_PROCESSED_DIR, "canonical_transactions.parquet"), index=False)

    # -------------------------------------------------------------
    # Step 4: High-Performance Leakage-Safe Feature & Target Matrix
    # -------------------------------------------------------------
    print("\n[4] Building Fast Leakage-Safe ATM × Cutoff-T Dataset...")
    from app.ml.feature_builder import FeatureBuilder

    # Cutoffs every 7 days across 2023 (from Feb 15 to Dec 15 = 44 cutoffs * 150 ATMs = 6,600 samples)
    cutoffs = pd.date_range(start="2023-02-15 00:00:00", end="2023-12-15 00:00:00", freq="7D")
    
    # Pre-index transactions by city for fast lookups
    txs_by_city = {}
    for city, grp in canonical_txs.groupby('city'):
        txs_by_city[city] = grp.sort_values('occurred_at')

    class SimpleObj:
        def __init__(self, **kwargs):
            self.__dict__.update(kwargs)

    all_atm_objs = [SimpleObj(**row) for row in df_atms.to_dict(orient="records")]
    
    X_rows = []
    y_rows = []
    meta_rows = []
    horizon_delta = timedelta(hours=24)

    for cutoff_ts in cutoffs:
        cutoff = cutoff_ts.to_pydatetime()
        t_30d = cutoff - timedelta(days=30)
        t_future = cutoff + horizon_delta

        for atm in all_atm_objs:
            # City transactions slice
            city_df = txs_by_city.get(atm.city, pd.DataFrame())
            if city_df.empty:
                hist_txs = []
                future_cashouts = []
            else:
                # Fast slice
                hist_df = city_df[(city_df['occurred_at'] >= t_30d) & (city_df['occurred_at'] < cutoff)]
                fut_df = city_df[(city_df['occurred_at'] > cutoff) & (city_df['occurred_at'] <= t_future) & (city_df['is_cash_out'] == 1)]
                hist_txs = [SimpleObj(**r) for r in hist_df.to_dict(orient='records')]
                future_cashouts = [SimpleObj(**r) for r in fut_df.to_dict(orient='records')]

            # Compute features using FeatureBuilder
            feat_vec = FeatureBuilder.compute_features_from_history(
                atm_lat=atm.latitude,
                atm_lon=atm.longitude,
                prediction_time=cutoff,
                historical_transactions=hist_txs,
                all_atms=all_atm_objs,
            )

            # Target label: Cash-out at this ATM in (T, T + 24h]
            has_cashout = any(
                (tx.atm_id == atm.id or haversine_km(atm.latitude, atm.longitude, tx.latitude, tx.longitude) <= 0.1)
                for tx in future_cashouts
            )
            y_val = 1 if has_cashout else 0

            X_rows.append(feat_vec)
            y_rows.append(y_val)
            meta_rows.append({
                "atm_id": str(atm.id),
                "atm_code": atm.atm_code,
                "city": atm.city,
                "cutoff_time": cutoff.isoformat(),
                "target": y_val,
            })

    X_mat = np.array(X_rows, dtype=np.float32)
    y_vec = np.array(y_rows, dtype=np.int32)

    print(f"    ML Feature Matrix X: {X_mat.shape}")
    print(f"    ML Label Vector y:   {y_vec.shape} | Positive Targets: {np.sum(y_vec):,} ({np.mean(y_vec)*100:.2f}%)")

    # Save to data/ml/
    feature_cols = FeatureBuilder.FEATURE_NAMES
    df_ml = pd.DataFrame(X_mat, columns=feature_cols)
    df_ml['target'] = y_vec
    for k in ["atm_id", "atm_code", "city", "cutoff_time"]:
        df_ml[k] = [m[k] for m in meta_rows]

    df_ml.to_parquet(os.path.join(DATA_ML_DIR, "atm_cutoff_dataset.parquet"), index=False)
    df_ml.to_csv(os.path.join(DATA_ML_DIR, "atm_cutoff_dataset.csv"), index=False)
    print(f"    Saved ML dataset to {os.path.join(DATA_ML_DIR, 'atm_cutoff_dataset.parquet')}")
    print("=" * 80)
    print("DATA FUSION & SUPERVISED DATASET GENERATION SUCCESSFUL")
    print("=" * 80)

if __name__ == "__main__":
    run_fusion_pipeline()

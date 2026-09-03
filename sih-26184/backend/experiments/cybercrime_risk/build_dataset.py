#!/usr/bin/env python3
"""
SIH PS 26184 — Cybercrime-Conditioned ATM Risk Dataset Builder
=============================================================
Builds the feature matrix across all cutoffs strictly before T.
Calculates:
- Baseline activity metrics (expected historical withdrawal rates)
- Anomaly deviation features (surges in activity, amount, and velocity)
- Cybercrime & fraud context indicators
- Spatial cluster and temporal indicators

Usage:
    python experiments/cybercrime_risk/build_dataset.py [--rebuild]
"""

import os
import sys
import json
import math
from pathlib import Path
from datetime import datetime, timedelta
import numpy as np
import pandas as pd

BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent
EXP_DIR = BACKEND_ROOT / "experiments" / "cybercrime_risk"
CONFIG_PATH = EXP_DIR / "config.json"

with open(CONFIG_PATH) as f:
    CFG = json.load(f)

DATA_RAW_CSV = CFG["data"]["raw_csv"]
CANONICAL_ATMS = BACKEND_ROOT / CFG["data"]["canonical_atms_file"]
DATASET_OUT = BACKEND_ROOT / CFG["data"]["dataset_file"]
DATASET_OUT.parent.mkdir(parents=True, exist_ok=True)

STATE_CITY = {
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

ALL_FEATURES = []
for g, fts in CFG["feature_groups"].items():
    ALL_FEATURES.extend(fts)


def build_dataset(rebuild: bool = False):
    if DATASET_OUT.exists() and not rebuild:
        print(f"Dataset already exists: {DATASET_OUT}")
        return pd.read_parquet(DATASET_OUT)

    print("Building Cybercrime-Conditioned ATM Risk Dataset...")
    df_atms = pd.read_parquet(CANONICAL_ATMS)
    atm_lat_arr = df_atms["latitude"].values
    atm_lon_arr = df_atms["longitude"].values
    atm_id_arr = df_atms["id"].values
    atm_city_arr = df_atms["city"].values

    df_raw = pd.read_csv(DATA_RAW_CSV)
    df_raw["timestamp_str"] = df_raw["transaction_date"].astype(str) + " " + df_raw["transaction_time"].astype(str)
    df_raw["occurred_at"] = pd.to_datetime(df_raw["timestamp_str"], errors="coerce")
    df_raw = df_raw.dropna(subset=["occurred_at"])
    df_raw = df_raw[df_raw["state"].isin(STATE_CITY)].copy()
    df_raw = df_raw[df_raw["occurred_at"].dt.year.between(2019, 2023)].copy()

    np.random.seed(42)
    city_list, lat_list, lon_list = [], [], []
    for st in df_raw["state"]:
        c = STATE_CITY[st]
        city_list.append(c["city"])
        lat_list.append(round(c["lat"] + np.random.normal(0, 0.03), 6))
        lon_list.append(round(c["lon"] + np.random.normal(0, 0.03), 6))
    df_raw = df_raw.assign(city=city_list, latitude=lat_list, longitude=lon_list)
    df_raw["is_cash_withdrawal"] = (df_raw["transaction_type"] == "ATM_Withdrawal").astype(int)
    df_raw["is_fraud_cashout"] = ((df_raw["transaction_type"] == "ATM_Withdrawal") & (df_raw["is_fraud"] == 1)).astype(int)

    assigned = []
    for lat, lon in zip(df_raw["latitude"].values, df_raw["longitude"].values):
        d = (atm_lat_arr - lat)**2 + (atm_lon_arr - lon)**2
        assigned.append(atm_id_arr[np.argmin(d)])
    df_raw["atm_id"] = assigned

    df_raw_sorted = df_raw.sort_values("occurred_at").reset_index(drop=True)
    all_by_atm = {aid: grp.sort_values("occurred_at") for aid, grp in df_raw_sorted.groupby("atm_id")}
    fc_by_atm = {aid: grp for aid, grp in df_raw_sorted[df_raw_sorted["is_fraud_cashout"]==1].groupby("atm_id")}
    fraud_by_city = {city: grp.sort_values("occurred_at") for city, grp in df_raw_sorted[df_raw_sorted["is_fraud"]==1].groupby("city")}

    cfg_co = CFG["validation"]["cutoffs"]
    cutoffs = pd.date_range(start=cfg_co["start"], end=cfg_co["end"], freq=cfg_co["frequency"])
    h_delta_24 = timedelta(hours=24)
    h_delta_48 = timedelta(hours=48)

    X_rows, y_24_rows, y_48_rows, meta_rows = [], [], [], []

    for ct_ts in cutoffs:
        ct = ct_ts.to_pydatetime()
        t_24h = ct - timedelta(hours=24)
        t_7d  = ct - timedelta(days=7)
        t_30d = ct - timedelta(days=30)
        t_end_24 = ct + h_delta_24
        t_end_48 = ct + h_delta_48

        for atm_id, city, alat, alon in zip(atm_id_arr, atm_city_arr, atm_lat_arr, atm_lon_arr):
            grp = all_by_atm.get(atm_id)
            if grp is None or grp.empty:
                hist_30d = hist_7d = hist_24h = pd.DataFrame()
            else:
                hist_30d = grp[(grp["occurred_at"] >= t_30d) & (grp["occurred_at"] < ct)]
                hist_7d  = hist_30d[hist_30d["occurred_at"] >= t_7d]
                hist_24h = hist_7d[hist_7d["occurred_at"] >= t_24h]

            base_tx_count_30d = float(len(hist_30d))
            base_cw_count_30d = float(hist_30d["is_cash_withdrawal"].sum()) if len(hist_30d) > 0 else 0.0
            base_cw_rate_daily = base_cw_count_30d / 30.0
            recent_cw_count_24h = float(hist_24h["is_cash_withdrawal"].sum()) if len(hist_24h) > 0 else 0.0
            recent_cw_count_7d = float(hist_7d["is_cash_withdrawal"].sum()) if len(hist_7d) > 0 else 0.0

            if len(hist_7d) > 0:
                daily_counts = hist_7d[hist_7d["is_cash_withdrawal"]==1].groupby(hist_7d["occurred_at"].dt.date).size()
                cw_volatility_7d = float(daily_counts.std()) if len(daily_counts) > 1 else 0.0
            else:
                cw_volatility_7d = 0.0

            amount_avg_per_tx_30d = float(hist_30d["transaction_amount"].mean()) if len(hist_30d) > 0 else 0.0
            recent_amount_24h = float(hist_24h["transaction_amount"].sum()) if len(hist_24h) > 0 else 0.0
            unique_accts_24h = float(hist_24h["customer_id"].nunique()) if len(hist_24h) > 0 else 0.0

            activity_ratio_24h = recent_cw_count_24h / (base_cw_rate_daily + 1e-4)
            activity_delta_24h = recent_cw_count_24h - base_cw_rate_daily
            activity_ratio_7d = (recent_cw_count_7d / 7.0) / (base_cw_rate_daily + 1e-4)
            amount_ratio_24h = (recent_amount_24h / max(1.0, recent_cw_count_24h)) / (amount_avg_per_tx_30d + 1e-4)
            velocity_surge_24h_vs_7d = recent_cw_count_24h / ((recent_cw_count_7d / 7.0) + 1e-4)
            unique_account_surge_24h = unique_accts_24h / max(1.0, recent_cw_count_24h)

            fraud_tx_count_atm_30d = float(hist_30d["is_fraud"].sum()) if (len(hist_30d) > 0 and "is_fraud" in hist_30d.columns) else 0.0
            fraud_tx_count_atm_7d = float(hist_7d["is_fraud"].sum()) if (len(hist_7d) > 0 and "is_fraud" in hist_7d.columns) else 0.0
            fraud_tx_count_atm_24h = float(hist_24h["is_fraud"].sum()) if (len(hist_24h) > 0 and "is_fraud" in hist_24h.columns) else 0.0

            fraud_cashout_atm_30d = float(hist_30d["is_fraud_cashout"].sum()) if (len(hist_30d) > 0 and "is_fraud_cashout" in hist_30d.columns) else 0.0
            fraud_cashout_atm_7d = float(hist_7d["is_fraud_cashout"].sum()) if (len(hist_7d) > 0 and "is_fraud_cashout" in hist_7d.columns) else 0.0
            fraud_cashout_atm_24h = float(hist_24h["is_fraud_cashout"].sum()) if (len(hist_24h) > 0 and "is_fraud_cashout" in hist_24h.columns) else 0.0

            city_fraud = fraud_by_city.get(city)
            if city_fraud is not None and not city_fraud.empty:
                city_fraud_30d = city_fraud[(city_fraud["occurred_at"] >= t_30d) & (city_fraud["occurred_at"] < ct)]
                city_fraud_7d = city_fraud_30d[city_fraud_30d["occurred_at"] >= t_7d]
                city_fraud_24h = city_fraud_7d[city_fraud_7d["occurred_at"] >= t_24h]
                suspicious_density_city_7d = float(len(city_fraud_7d))
                suspicious_density_city_24h = float(len(city_fraud_24h))
            else:
                suspicious_density_city_7d = 0.0
                suspicious_density_city_24h = 0.0

            fraud_to_normal_ratio_30d = fraud_tx_count_atm_30d / (base_tx_count_30d + 1e-4)
            fraud_activity_change = fraud_tx_count_atm_7d / ((fraud_tx_count_atm_30d / 4.28) + 1e-4)
            connected_mule_accounts_7d = float(hist_7d[hist_7d["is_fraud"]==1]["customer_id"].nunique()) if (len(hist_7d) > 0 and "is_fraud" in hist_7d.columns) else 0.0

            if len(hist_30d) > 0 and "is_fraud" in hist_30d.columns and (hist_30d["is_fraud"]==1).any():
                last_fraud = hist_30d[hist_30d["is_fraud"]==1]["occurred_at"].iloc[-1]
                hours_since_last_fraud = (ct - last_fraud).total_seconds() / 3600.0
            else:
                hours_since_last_fraud = 720.0

            atm_cluster_density = float(np.sum((atm_lat_arr - alat)**2 + (atm_lon_arr - alon)**2 <= (2.0/111.0)**2) - 1)
            hour_of_day = float(ct.hour)
            day_of_week = float(ct.weekday())
            is_weekend = 1.0 if ct.weekday() in [5, 6] else 0.0

            feat_dict = {
                "base_tx_count_30d": base_tx_count_30d,
                "base_cw_count_30d": base_cw_count_30d,
                "base_cw_rate_daily": base_cw_rate_daily,
                "recent_cw_count_24h": recent_cw_count_24h,
                "recent_cw_count_7d": recent_cw_count_7d,
                "cw_volatility_7d": cw_volatility_7d,
                "amount_avg_per_tx_30d": amount_avg_per_tx_30d,
                "activity_ratio_24h": activity_ratio_24h,
                "activity_delta_24h": activity_delta_24h,
                "activity_ratio_7d": activity_ratio_7d,
                "amount_ratio_24h": amount_ratio_24h,
                "velocity_surge_24h_vs_7d": velocity_surge_24h_vs_7d,
                "unique_account_surge_24h": unique_account_surge_24h,
                "fraud_tx_count_atm_30d": fraud_tx_count_atm_30d,
                "fraud_tx_count_atm_7d": fraud_tx_count_atm_7d,
                "fraud_tx_count_atm_24h": fraud_tx_count_atm_24h,
                "fraud_cashout_atm_30d": fraud_cashout_atm_30d,
                "fraud_cashout_atm_7d": fraud_cashout_atm_7d,
                "fraud_cashout_atm_24h": fraud_cashout_atm_24h,
                "suspicious_density_city_7d": suspicious_density_city_7d,
                "suspicious_density_city_24h": suspicious_density_city_24h,
                "fraud_to_normal_ratio_30d": fraud_to_normal_ratio_30d,
                "fraud_activity_change": fraud_activity_change,
                "connected_mule_accounts_7d": connected_mule_accounts_7d,
                "hours_since_last_fraud": hours_since_last_fraud,
                "atm_lat": alat,
                "atm_lon": alon,
                "atm_cluster_density": atm_cluster_density,
                "hour_of_day": hour_of_day,
                "day_of_week": day_of_week,
                "is_weekend": is_weekend
            }

            grp_fc = fc_by_atm.get(atm_id)
            y_24 = 0
            y_48 = 0
            if grp_fc is not None and not grp_fc.empty:
                if ((grp_fc["occurred_at"] > ct) & (grp_fc["occurred_at"] <= t_end_24)).any():
                    y_24 = 1
                if ((grp_fc["occurred_at"] > ct) & (grp_fc["occurred_at"] <= t_end_48)).any():
                    y_48 = 1

            X_rows.append([feat_dict[k] for k in ALL_FEATURES])
            y_24_rows.append(y_24)
            y_48_rows.append(y_48)
            meta_rows.append({
                "atm_id": str(atm_id), "city": city, "cutoff_time": ct.isoformat(), "year": ct.year
            })

    df_out = pd.DataFrame(X_rows, columns=ALL_FEATURES)
    df_out["target_c_24h"] = y_24_rows
    df_out["target_c_48h"] = y_48_rows
    df_meta = pd.DataFrame(meta_rows)
    for k in df_meta.columns:
        df_out[k] = df_meta[k].values

    df_out.to_parquet(DATASET_OUT, index=False)
    print(f"Dataset successfully built & saved to: {DATASET_OUT} ({len(df_out):,} rows)")
    return df_out


if __name__ == "__main__":
    rebuild_flag = "--rebuild" in sys.argv
    build_dataset(rebuild=rebuild_flag)

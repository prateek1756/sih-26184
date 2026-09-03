#!/usr/bin/env python3
"""
SIH PS 26184 — Experimental Training Script
============================================
TARGET DISCOVERY ONLY. Does NOT modify production artifacts.

Usage:
    python experiments/train_experiment.py --target target_a --model rf --horizon 48h
    python experiments/train_experiment.py --target target_a --model xgb --horizon 24h
    python experiments/train_experiment.py --target target_b --model rf --horizon 48h
    python experiments/train_experiment.py --target target_b --model xgb --horizon 48h

Arguments:
    --target   : target_a | target_b
    --model    : rf | xgb
    --horizon  : 6h | 12h | 24h | 48h | 72h
    --output   : (optional) override output directory
    --rebuild  : (optional flag) force rebuild of experiment dataset

Output:
    experiments/artifacts/{target}_{model}_{horizon}/
        model.joblib
        metadata.json
        feature_importance.csv
        split_stats.json
"""

import argparse
import json
import math
import os
import sys
import warnings
from datetime import datetime, timedelta
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

# ── Paths ─────────────────────────────────────────────────────────────────────
BACKEND_ROOT   = Path(__file__).resolve().parent.parent
EXPERIMENTS_DIR = BACKEND_ROOT / "experiments"
CONFIG_PATH    = EXPERIMENTS_DIR / "config.json"
PRODUCTION_DIR = BACKEND_ROOT / "artifacts"
PRODUCTION_MODEL = PRODUCTION_DIR / "rf-v1.0.joblib"

with open(CONFIG_PATH) as f:
    CFG = json.load(f)

DATA_RAW_CSV    = CFG["data"]["raw_csv"]
PROCESSED_DIR   = BACKEND_ROOT / CFG["data"]["processed_dir"]
EXPERIMENTS_DATA = BACKEND_ROOT / CFG["data"]["experiments_dir"]
DATASET_FILE    = BACKEND_ROOT / CFG["data"]["dataset_file"]
CANONICAL_ATMS  = BACKEND_ROOT / CFG["data"]["canonical_atms_file"]
FEATURE_NAMES   = CFG["features"]

# ─── GPU Detection & Diagnostic ───────────────────────────────────────────────
def detect_gpu_device() -> tuple[str, dict]:
    """
    Detects whether NVIDIA CUDA acceleration is usable for XGBoost 3.x.
    Returns:
        device_str: 'cuda' if GPU is verified, else 'cpu'
        diagnostic: dictionary of hardware & backend details
    """
    diagnostic = {
        "cuda_available": False,
        "device": "cpu",
        "gpu_name": None,
        "driver_version": None,
        "xgboost_version": None,
        "error": None
    }

    # 1. Query NVIDIA hardware via nvidia-smi
    try:
        import subprocess
        res = subprocess.run(
            ["nvidia-smi", "--query-gpu=name,driver_version", "--format=csv,noheader"],
            capture_output=True, text=True, timeout=5
        )
        if res.returncode == 0 and res.stdout.strip():
            parts = [p.strip() for p in res.stdout.strip().split(",")]
            diagnostic["gpu_name"] = parts[0]
            if len(parts) > 1:
                diagnostic["driver_version"] = parts[1]
    except Exception:
        pass

    # 2. Test actual XGBoost CUDA backend instantiation and small fit
    try:
        import xgboost as xgb
        diagnostic["xgboost_version"] = xgb.__version__
        test_X = np.array([[1.0, 2.0], [3.0, 4.0]], dtype=np.float32)
        test_y = np.array([0, 1], dtype=np.int32)
        test_model = xgb.XGBClassifier(n_estimators=1, max_depth=1, device="cuda", verbosity=0)
        test_model.fit(test_X, test_y)

        diagnostic["cuda_available"] = True
        diagnostic["device"] = "cuda"
    except Exception as e:
        diagnostic["cuda_available"] = False
        diagnostic["device"] = "cpu"
        diagnostic["error"] = str(e)

    return diagnostic["device"], diagnostic


# ─── Safety check ─────────────────────────────────────────────────────────────
def _check_no_production_modification(output_dir: Path):
    """Hard-fail if output path would overwrite production model."""
    output_dir = output_dir.resolve()
    prod_dir   = PRODUCTION_DIR.resolve()
    if output_dir == prod_dir or PRODUCTION_MODEL.resolve() in output_dir.iterdir() if output_dir.exists() else []:
        raise RuntimeError(
            f"ABORT: output_dir '{output_dir}' would overwrite production artifacts. "
            f"Production model is at '{PRODUCTION_MODEL}'. Choose a different --output path."
        )
    # Also check: none of the target directories are named rf-v1.0
    for p in output_dir.rglob("*"):
        if p.name == "rf-v1.0.joblib":
            raise RuntimeError(
                "ABORT: Refusing to write rf-v1.0.joblib in any output path during experiment."
            )


# ─── Haversine ────────────────────────────────────────────────────────────────
def haversine_km(lat1, lon1, lat2, lon2):
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat/2)**2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ─── State → city/coords mapping ──────────────────────────────────────────────
STATE_CITY = {
    "Delhi":         {"city": "New Delhi", "lat": 28.6139, "lon": 77.2090},
    "Maharashtra":   {"city": "Mumbai",    "lat": 19.0760, "lon": 72.8777},
    "Karnataka":     {"city": "Bengaluru", "lat": 12.9716, "lon": 77.5946},
    "Tamil Nadu":    {"city": "Chennai",   "lat": 13.0827, "lon": 80.2707},
    "Gujarat":       {"city": "Ahmedabad", "lat": 23.0225, "lon": 72.5714},
    "West Bengal":   {"city": "Kolkata",   "lat": 22.5726, "lon": 88.3639},
    "Telangana":     {"city": "Hyderabad", "lat": 17.3850, "lon": 78.4867},
    "Uttar Pradesh": {"city": "Lucknow",   "lat": 26.8467, "lon": 80.9462},
    "Rajasthan":     {"city": "Jaipur",    "lat": 26.9124, "lon": 75.7873},
    "Kerala":        {"city": "Kochi",     "lat":  9.9312, "lon": 76.2673},
}


# ─── Dataset Builder ──────────────────────────────────────────────────────────
def build_experiment_dataset(horizon_h: int) -> pd.DataFrame:
    """
    Builds the full ATM × weekly-cutoff feature/target matrix.
    Leakage-safe: all features computed strictly from events < cutoff_time.
    Saves to data/experiments/exp_atm_cutoff_{horizon_h}h.parquet
    Does NOT touch production data.
    """
    out_path = EXPERIMENTS_DATA / f"exp_atm_cutoff_{horizon_h}h.parquet"
    EXPERIMENTS_DATA.mkdir(parents=True, exist_ok=True)

    if out_path.exists():
        print(f"  [DATASET] Found cached dataset: {out_path}")
        return pd.read_parquet(out_path)

    print(f"  [DATASET] Building experiment dataset (H={horizon_h}h) — this takes ~5-10 min ...")

    # Load ATMs
    if not CANONICAL_ATMS.exists():
        raise FileNotFoundError(
            f"Canonical ATMs not found at {CANONICAL_ATMS}. "
            "Run: python data_generator/data_fusion_pipeline.py"
        )
    df_atms = pd.read_parquet(CANONICAL_ATMS)
    atm_lat_arr  = df_atms["latitude"].values
    atm_lon_arr  = df_atms["longitude"].values
    atm_id_arr   = df_atms["id"].values
    atm_city_arr = df_atms["city"].values
    N_ATMS = len(df_atms)

    # Load & enrich raw transactions
    print(f"  [DATASET] Loading {DATA_RAW_CSV} ...")
    df_raw = pd.read_csv(DATA_RAW_CSV)
    df_raw["occurred_at"] = pd.to_datetime(
        df_raw["transaction_date"].astype(str) + " " + df_raw["transaction_time"].astype(str),
        errors="coerce"
    )
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
    df_raw["is_fraud_cashout"]   = (
        (df_raw["transaction_type"] == "ATM_Withdrawal") & (df_raw["is_fraud"] == 1)
    ).astype(int)

    # Assign ATM IDs
    print(f"  [DATASET] Assigning ATM IDs ...")
    assigned = []
    for lat, lon in zip(df_raw["latitude"].values, df_raw["longitude"].values):
        d = (atm_lat_arr - lat)**2 + (atm_lon_arr - lon)**2
        assigned.append(atm_id_arr[np.argmin(d)])
    df_raw["atm_id"] = assigned

    # Pre-index by ATM
    df_raw_sorted = df_raw.sort_values("occurred_at").reset_index(drop=True)
    all_by_atm = {
        aid: grp.sort_values("occurred_at")
        for aid, grp in df_raw_sorted.groupby("atm_id")
    }
    cw_by_atm = {
        aid: grp for aid, grp in df_raw_sorted[df_raw_sorted["is_cash_withdrawal"]==1].groupby("atm_id")
    }
    fc_by_atm = {
        aid: grp for aid, grp in df_raw_sorted[df_raw_sorted["is_fraud_cashout"]==1].groupby("atm_id")
    }

    # Cutoffs
    cfg_co = CFG["cutoffs"]
    cutoffs = pd.date_range(start=cfg_co["start"], end=cfg_co["end"], freq=cfg_co["frequency"])
    h_delta = timedelta(hours=horizon_h)

    print(f"  [DATASET] Building {len(cutoffs)} × {N_ATMS} = {len(cutoffs)*N_ATMS:,} cells ...")
    X_rows, y_A_rows, y_B_rows, meta_rows = [], [], [], []

    for ct_ts in cutoffs:
        ct    = ct_ts.to_pydatetime()
        t_24h = ct - timedelta(hours=24)
        t_7d  = ct - timedelta(days=7)
        t_30d = ct - timedelta(days=30)
        t_end = ct + h_delta

        for atm_id, city, alat, alon in zip(atm_id_arr, atm_city_arr, atm_lat_arr, atm_lon_arr):
            grp = all_by_atm.get(atm_id)
            if grp is None or grp.empty:
                hist_30d = hist_7d = hist_24h = pd.DataFrame()
            else:
                hist_30d = grp[(grp["occurred_at"] >= t_30d) & (grp["occurred_at"] < ct)]
                hist_7d  = hist_30d[hist_30d["occurred_at"] >= t_7d]
                hist_24h = hist_7d[hist_7d["occurred_at"] >= t_24h]

            n24 = len(hist_24h); n7 = len(hist_7d); n30 = len(hist_30d)
            amt24  = float(hist_24h["transaction_amount"].sum()) if n24 > 0 else 0.0
            max24  = float(hist_24h["transaction_amount"].max()) if n24 > 0 else 0.0
            nc24   = int(hist_24h["is_cash_withdrawal"].sum()) if n24 > 0 else 0
            nc7    = int(hist_7d["is_cash_withdrawal"].sum())  if n7  > 0 else 0
            nc30   = int(hist_30d["is_cash_withdrawal"].sum()) if n30 > 0 else 0
            nf24   = int(hist_24h["is_fraud_cashout"].sum())   if n24 > 0 else 0
            nf7    = int(hist_7d["is_fraud_cashout"].sum())    if n7  > 0 else 0
            nf30   = int(hist_30d["is_fraud_cashout"].sum())   if n30 > 0 else 0
            ua24   = int(hist_24h["customer_id"].nunique())    if n24 > 0 else 0
            ua7    = int(hist_7d["customer_id"].nunique())     if n7  > 0 else 0
            hrs_since = (
                (ct - hist_30d["occurred_at"].iloc[-1]).total_seconds() / 3600.0
                if n30 > 0 else 720.0
            )

            feat = [
                float(ct.hour), float(ct.weekday()),
                1.0 if ct.weekday() in [5, 6] else 0.0,
                float(n24), float(n7), float(n30),
                float(amt24), float(max24),
                float(nc24), float(nc7), float(nc30),
                float(nf24), float(nf7), float(nf30),
                float(ua24), float(ua7),
                float(hrs_since), float(math.log1p(max(0.0, amt24))),
                float(alat), float(alon),
            ]

            # Labels: any event in (ct, ct+H] for this ATM
            grp_A = cw_by_atm.get(atm_id)
            y_A = 0
            if grp_A is not None:
                if ((grp_A["occurred_at"] > ct) & (grp_A["occurred_at"] <= t_end)).any():
                    y_A = 1

            grp_B = fc_by_atm.get(atm_id)
            y_B = 0
            if grp_B is not None:
                if ((grp_B["occurred_at"] > ct) & (grp_B["occurred_at"] <= t_end)).any():
                    y_B = 1

            X_rows.append(feat)
            y_A_rows.append(y_A)
            y_B_rows.append(y_B)
            meta_rows.append({
                "atm_id": str(atm_id), "city": city,
                "cutoff_time": ct.isoformat(), "year": ct.year,
            })

    df_feat = pd.DataFrame(X_rows, columns=FEATURE_NAMES)
    df_feat["target_a"]    = y_A_rows
    df_feat["target_b"]    = y_B_rows
    df_meta = pd.DataFrame(meta_rows)
    for k in df_meta.columns:
        df_feat[k] = df_meta[k].values

    df_feat.to_parquet(out_path, index=False)
    print(f"  [DATASET] Saved: {out_path}  ({len(df_feat):,} rows)")
    print(f"  [DATASET] Target A positives: {df_feat['target_a'].sum():,} ({df_feat['target_a'].mean()*100:.3f}%)")
    print(f"  [DATASET] Target B positives: {df_feat['target_b'].sum():,} ({df_feat['target_b'].mean()*100:.4f}%)")
    return df_feat


# ─── Chronological split ──────────────────────────────────────────────────────
def chronological_split(df: pd.DataFrame):
    df = df.sort_values("cutoff_time").reset_index(drop=True)
    all_co = sorted(df["cutoff_time"].unique())
    n = len(all_co)
    train_co = all_co[:int(n * 0.60)]
    val_co   = all_co[int(n * 0.60):int(n * 0.80)]
    test_co  = all_co[int(n * 0.80):]
    tr = df[df["cutoff_time"].isin(train_co)]
    va = df[df["cutoff_time"].isin(val_co)]
    te = df[df["cutoff_time"].isin(test_co)]
    return tr, va, te, {
        "train_cutoffs": len(train_co),
        "val_cutoffs":   len(val_co),
        "test_cutoffs":  len(test_co),
        "train_start":   str(train_co[0])  if train_co else None,
        "train_end":     str(train_co[-1]) if train_co else None,
        "val_start":     str(val_co[0])    if val_co   else None,
        "val_end":       str(val_co[-1])   if val_co   else None,
        "test_start":    str(test_co[0])   if test_co  else None,
        "test_end":      str(test_co[-1])  if test_co  else None,
    }


# ─── Main ─────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(
        description="SIH PS 26184 — Experimental model training (TARGET DISCOVERY ONLY)"
    )
    parser.add_argument("--target",  required=True, choices=["target_a", "target_b"],
                        help="target_a = cash withdrawal | target_b = fraud-associated cashout")
    parser.add_argument("--model",   required=True, choices=["rf", "xgb"],
                        help="rf = Random Forest | xgb = XGBoost")
    parser.add_argument("--horizon", required=True, choices=["6h", "12h", "24h", "48h", "72h"],
                        help="Prediction horizon (hours)")
    parser.add_argument("--output",  default=None,
                        help="Override output directory (default: experiments/artifacts/{target}_{model}_{horizon})")
    parser.add_argument("--rebuild", action="store_true",
                        help="Force rebuild of experiment dataset even if cached")
    args = parser.parse_args()

    horizon_h = int(args.horizon.replace("h", ""))
    target_col = args.target        # "target_a" or "target_b"
    model_type = args.model         # "rf" or "xgb"
    horizon_key = args.horizon      # "48h" etc.

    # ── Device & Diagnostic Setup ─────────────────────────────────────────────
    gpu_diag = {}
    if model_type == "rf":
        model_display_name = "Random Forest"
        compute_device = "CPU"
    else:
        model_display_name = "XGBoost"
        device_str, gpu_diag = detect_gpu_device()
        compute_device = "CUDA" if device_str == "cuda" else "CPU"

    print("=" * 70)
    print("SIH PS 26184 — EXPERIMENTAL TRAINING")
    print("  TARGET DISCOVERY ONLY — Production NOT modified")
    print("=" * 70)
    print(f"  Target  : {target_col} ({CFG['targets'][target_col]['name']})")
    print(f"  MODEL: {model_display_name}")
    print(f"  COMPUTE DEVICE: {compute_device}")
    if model_type == "xgb":
        if compute_device == "CUDA":
            print(f"  GPU HARDWARE: {gpu_diag.get('gpu_name', 'NVIDIA GPU')} (Driver: {gpu_diag.get('driver_version', 'N/A')})")
        else:
            print(f"  GPU STATUS: Unavailable / Fallback to CPU ({gpu_diag.get('error', 'No CUDA backend')})")
    else:
        print("  PARALLELISM: n_jobs=-1 (All CPU Cores)")
    print(f"  Horizon : {horizon_key}")
    print(f"  Production model: {PRODUCTION_MODEL} — UNTOUCHED")
    print()

    # Resolve output directory
    if args.output:
        out_dir = Path(args.output).resolve()
    else:
        out_dir = EXPERIMENTS_DIR / "artifacts" / f"{target_col}_{model_type}_{horizon_key}"
    out_dir.mkdir(parents=True, exist_ok=True)

    # Safety check — refuse to touch production
    _check_no_production_modification(out_dir)

    # Build or load dataset
    dataset_path = EXPERIMENTS_DATA / f"exp_atm_cutoff_{horizon_h}h.parquet"
    if args.rebuild and dataset_path.exists():
        print(f"  [--rebuild] Removing cached dataset: {dataset_path}")
        dataset_path.unlink()

    df = build_experiment_dataset(horizon_h)

    # Check positive counts
    target_cfg = CFG["targets"][target_col]
    n_pos = df[target_col].sum()
    n_tot = len(df)
    print(f"\n  Dataset loaded: {n_tot:,} rows | Positives ({target_col}): {n_pos:,} ({n_pos/n_tot*100:.3f}%)")

    if n_pos < 10:
        print(f"\n  WARNING: Only {n_pos} positives for {target_col}.")
        print("  This target may not be learnable. Consider using target_a instead.")
        if n_pos == 0:
            print("  ABORT: Cannot train with 0 positives.")
            sys.exit(1)

    # Split
    tr, va, te, split_info = chronological_split(df)
    pos_tr = tr[target_col].sum()
    pos_va = va[target_col].sum()
    pos_te = te[target_col].sum()

    print(f"\n  Chronological Split:")
    print(f"    Train : {len(tr):>7,} samples | {pos_tr:>5} positives | {split_info['train_start']} → {split_info['train_end']}")
    print(f"    Val   : {len(va):>7,} samples | {pos_va:>5} positives | {split_info['val_start']} → {split_info['val_end']}")
    print(f"    Test  : {len(te):>7,} samples | {pos_te:>5} positives | {split_info['test_start']} → {split_info['test_end']}")

    if pos_va == 0:
        print("\n  WARNING: Validation set has 0 positives. Hyperparameter selection is not possible.")
        print("  Training will proceed but model may not generalize. Consider walk-forward strategy.")

    X_tr = tr[FEATURE_NAMES].values.astype(np.float32)
    y_tr = tr[target_col].values.astype(np.int32)
    X_te = te[FEATURE_NAMES].values.astype(np.float32)
    y_te = te[target_col].values.astype(np.int32)

    # Build model
    model_cfg = CFG["models"][model_type]
    params = dict(model_cfg["params"])

    if model_type == "rf":
        from sklearn.ensemble import RandomForestClassifier
        params["n_jobs"] = -1
        model = RandomForestClassifier(**params)

    elif model_type == "xgb":
        import xgboost as xgb
        # Modern XGBoost 3.x device configuration
        params["device"] = "cuda" if compute_device == "CUDA" else "cpu"
        params["tree_method"] = "hist"
        if model_cfg.get("scale_pos_weight") == "auto":
            neg = int((y_tr == 0).sum())
            pos_n = int(y_tr.sum())
            params["scale_pos_weight"] = max(1, neg // max(1, pos_n))
            print(f"  XGBoost scale_pos_weight (auto): {params['scale_pos_weight']}")
        print(f"  XGBoost Device Setting: device='{params['device']}', tree_method='{params['tree_method']}'")
        model = xgb.XGBClassifier(**params)

    print(f"\n  Training {model_type.upper()} on {compute_device} ...")
    t0 = datetime.now()
    model.fit(X_tr, y_tr)
    elapsed = (datetime.now() - t0).total_seconds()
    print(f"  Training complete in {elapsed:.1f}s")

    # Save model
    model_path = out_dir / "model.joblib"
    joblib.dump(model, model_path)
    print(f"\n  Model saved: {model_path}")

    # Feature importance
    if model_type == "rf":
        importances = model.feature_importances_
    else:
        importances = model.feature_importances_

    df_fi = pd.DataFrame({
        "feature": FEATURE_NAMES,
        "importance": importances
    }).sort_values("importance", ascending=False)
    fi_path = out_dir / "feature_importance.csv"
    df_fi.to_csv(fi_path, index=False)
    print(f"  Feature importance: {fi_path}")
    print(f"\n  Top 5 features:")
    for _, row in df_fi.head(5).iterrows():
        print(f"    {row['feature']:<35} {row['importance']:.4f}")

    # Split stats
    split_stats = {
        **split_info,
        "train_samples": len(tr), "train_positives": int(pos_tr),
        "val_samples":   len(va), "val_positives":   int(pos_va),
        "test_samples":  len(te), "test_positives":  int(pos_te),
        "train_prevalence_pct": round(pos_tr/len(tr)*100, 4) if len(tr) > 0 else 0,
        "test_prevalence_pct":  round(pos_te/len(te)*100, 4) if len(te) > 0 else 0,
    }
    with open(out_dir / "split_stats.json", "w") as f:
        json.dump(split_stats, f, indent=2)

    # Save metadata
    meta = {
        "target":           target_col,
        "target_name":      target_cfg["name"],
        "model_type":       model_type,
        "compute_device":   compute_device,
        "gpu_diagnostic":   gpu_diag,
        "horizon_h":        horizon_h,
        "horizon_key":      horizon_key,
        "feature_names":    FEATURE_NAMES,
        "n_features":       len(FEATURE_NAMES),
        "train_samples":    len(tr),
        "train_positives":  int(pos_tr),
        "test_samples":     len(te),
        "test_positives":   int(pos_te),
        "trained_at":       datetime.now().isoformat(),
        "model_params":     params,
        "training_time_s":  round(elapsed, 2),
        "production_modified": False,
        "production_model_path": str(PRODUCTION_MODEL),
        "experiment_model_path": str(model_path),
        "note": "EXPERIMENTAL ONLY — run evaluate_experiment.py to get metrics"
    }
    with open(out_dir / "metadata.json", "w") as f:
        json.dump(meta, f, indent=2)

    print(f"\n{'='*70}")
    print(f"  TRAINING COMPLETE")
    print(f"  Artifact dir : {out_dir}")
    print(f"  Model file   : model.joblib")
    print(f"  PRODUCTION MODIFIED: NO")
    print(f"{'='*70}")
    print(f"\n  Next step — evaluate this model:")
    print(f"    python experiments/evaluate_experiment.py \\")
    print(f"      --target {target_col} \\")
    print(f"      --model {model_type} \\")
    print(f"      --artifact {out_dir}")


if __name__ == "__main__":
    main()

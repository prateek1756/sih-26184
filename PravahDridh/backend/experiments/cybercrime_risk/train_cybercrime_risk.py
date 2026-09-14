#!/usr/bin/env python3
"""
SIH PS 26184 — Cybercrime-Conditioned ATM Risk Training Script
==============================================================
Manual CLI trainer for cybercrime-conditioned risk formulation.
Does NOT modify production models or artifacts.

Usage:
    python experiments/cybercrime_risk/train_cybercrime_risk.py --horizon 48h --model rf --ablation tier_e
    python experiments/cybercrime_risk/train_cybercrime_risk.py --horizon 48h --model xgb --ablation tier_e
    python experiments/cybercrime_risk/train_cybercrime_risk.py --horizon 24h --model xgb --ablation tier_c

Arguments:
    --horizon  : 24h | 48h
    --model    : rf | xgb
    --ablation : tier_a | tier_b | tier_c | tier_d | tier_e (default: tier_e)
    --output   : (optional) override output directory
"""

import os
import sys
import json
import argparse
from pathlib import Path
from datetime import datetime
import numpy as np
import pandas as pd
import joblib

BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent
EXP_DIR = BACKEND_ROOT / "experiments" / "cybercrime_risk"
CONFIG_PATH = EXP_DIR / "config.json"
PRODUCTION_DIR = BACKEND_ROOT / "artifacts"
PRODUCTION_MODEL = PRODUCTION_DIR / "rf-v1.0.joblib"

with open(CONFIG_PATH) as f:
    CFG = json.load(f)

DATASET_FILE = BACKEND_ROOT / CFG["data"]["dataset_file"]


def detect_gpu_device() -> tuple[str, dict]:
    diagnostic = {
        "cuda_available": False,
        "device": "cpu",
        "gpu_name": None,
        "driver_version": None,
        "xgboost_version": None,
        "error": None
    }
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


def _check_no_production_modification(output_dir: Path):
    output_dir = output_dir.resolve()
    prod_dir = PRODUCTION_DIR.resolve()
    if output_dir == prod_dir:
        raise RuntimeError("ABORT: Attempting to overwrite production artifacts directory.")
    for p in output_dir.rglob("*"):
        if p.name == "rf-v1.0.joblib":
            raise RuntimeError("ABORT: Refusing to write rf-v1.0.joblib.")


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
        "val_cutoffs": len(val_co),
        "test_cutoffs": len(test_co),
        "train_start": str(train_co[0]),
        "train_end": str(train_co[-1]),
        "val_start": str(val_co[0]),
        "val_end": str(val_co[-1]),
        "test_start": str(test_co[0]),
        "test_end": str(test_co[-1]),
    }


def main():
    parser = argparse.ArgumentParser(description="Train Cybercrime-Conditioned ATM Risk Model")
    parser.add_argument("--horizon", required=True, choices=["24h", "48h"], help="Prediction horizon")
    parser.add_argument("--model", required=True, choices=["rf", "xgb"], help="Model type: rf | xgb")
    parser.add_argument("--ablation", default="tier_e",
                        choices=["tier_a", "tier_b", "tier_c", "tier_d", "tier_e"],
                        help="Ablation feature tier")
    parser.add_argument("--output", default=None, help="Custom output directory")
    args = parser.parse_args()

    horizon_col = CFG["target"]["columns"][args.horizon]
    tier_info = CFG["ablation_tiers"][args.ablation]
    tier_groups = tier_info["groups"]

    features = []
    for g in tier_groups:
        features.extend(CFG["feature_groups"][g])

    # Device detection
    gpu_diag = {}
    if args.model == "rf":
        model_display = "Random Forest"
        compute_device = "CPU"
    else:
        model_display = "XGBoost"
        device_str, gpu_diag = detect_gpu_device()
        compute_device = "CUDA" if device_str == "cuda" else "CPU"

    print("=" * 70)
    print("SIH PS 26184 — CYBERCRIME-CONDITIONED ATM RISK TRAINING")
    print("  EXPERIMENTAL ONLY — Production Unmodified")
    print("=" * 70)
    print(f"  Target Horizon: {args.horizon} ({horizon_col})")
    print(f"  MODEL         : {model_display}")
    print(f"  COMPUTE DEVICE: {compute_device}")
    if args.model == "xgb":
        if compute_device == "CUDA":
            print(f"  GPU Hardware  : {gpu_diag.get('gpu_name', 'NVIDIA GPU')} (Driver: {gpu_diag.get('driver_version', 'N/A')})")
        else:
            print(f"  GPU Status    : Fallback to CPU ({gpu_diag.get('error', 'No CUDA backend')})")
    print(f"  Ablation Tier : {args.ablation} ({tier_info['name']})")
    print(f"  Feature Count : {len(features)}")
    print(f"  Production    : {PRODUCTION_MODEL} — UNTOUCHED")
    print()

    if args.output:
        out_dir = Path(args.output).resolve()
    else:
        out_dir = EXP_DIR / "artifacts" / f"{args.horizon}_{args.model}_{args.ablation}"
    out_dir.mkdir(parents=True, exist_ok=True)
    _check_no_production_modification(out_dir)

    # Load dataset
    if not DATASET_FILE.exists():
        print(f"Dataset not found at {DATASET_FILE}. Building dataset first...")
        from build_dataset import build_dataset
        df = build_dataset()
    else:
        df = pd.read_parquet(DATASET_FILE)

    tr, va, te, split_info = chronological_split(df)
    pos_tr = int(tr[horizon_col].sum())
    pos_te = int(te[horizon_col].sum())

    print(f"  Train samples: {len(tr):,} | Positives: {pos_tr} ({pos_tr/len(tr)*100:.3f}%)")
    print(f"  Test samples : {len(te):,} | Positives: {pos_te} ({pos_te/len(te)*100:.3f}%)")

    X_tr = tr[features].values.astype(np.float32)
    y_tr = tr[horizon_col].values.astype(np.int32)

    model_cfg = CFG["models"][args.model]
    params = dict(model_cfg["params"])

    if args.model == "rf":
        from sklearn.ensemble import RandomForestClassifier
        params["n_jobs"] = -1
        model = RandomForestClassifier(**params)
    elif args.model == "xgb":
        import xgboost as xgb
        params["device"] = "cuda" if compute_device == "CUDA" else "cpu"
        params["tree_method"] = "hist"
        if model_cfg.get("scale_pos_weight") == "auto":
            neg = int((y_tr == 0).sum())
            pos_n = int(y_tr.sum())
            params["scale_pos_weight"] = max(1, neg // max(1, pos_n))
        model = xgb.XGBClassifier(**params)

    print(f"\n  Fitting {model_display} on {compute_device} ...")
    t0 = datetime.now()
    model.fit(X_tr, y_tr)
    elapsed = (datetime.now() - t0).total_seconds()
    print(f"  Fit complete in {elapsed:.1f}s")

    model_path = out_dir / "model.joblib"
    joblib.dump(model, model_path)
    print(f"  Model saved: {model_path}")

    # Feature importances
    importances = model.feature_importances_
    df_fi = pd.DataFrame({
        "feature": features,
        "importance": importances
    }).sort_values("importance", ascending=False)
    df_fi.to_csv(out_dir / "feature_importance.csv", index=False)

    meta = {
        "target": horizon_col,
        "horizon": args.horizon,
        "model_type": args.model,
        "ablation_tier": args.ablation,
        "ablation_name": tier_info["name"],
        "compute_device": compute_device,
        "gpu_diagnostic": gpu_diag,
        "features": features,
        "n_features": len(features),
        "split_info": split_info,
        "training_time_s": round(elapsed, 2),
        "trained_at": datetime.now().isoformat(),
        "production_modified": False
    }
    with open(out_dir / "metadata.json", "w") as f:
        json.dump(meta, f, indent=2)

    print(f"\n{'='*70}")
    print(f"  TRAINING COMPLETE")
    print(f"  Artifact dir: {out_dir}")
    print(f"  Evaluate command:")
    print(f"    python experiments/cybercrime_risk/evaluate_cybercrime_risk.py --artifact {out_dir}")
    print(f"{'='*70}")


if __name__ == "__main__":
    main()

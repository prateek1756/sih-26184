# Cybercrime-Conditioned ATM Risk Experiment

This directory implements the **Cybercrime-Conditioned ATM Risk** formulation for SIH PS 26184.

> [!IMPORTANT]
> **Production Safety Guarantees:**
> - Production models (`artifacts/rf-v1.0.joblib`), APIs, database schemas, and frontend remain completely unmodified.
> - Training is **NEVER** run automatically in production.
> - All outputs are stored isolated under `experiments/cybercrime_risk/artifacts/` and `experiments/cybercrime_risk/results/`.

---

## 1. Formulation & Objectives

### Problem Formulation:
> *"Given suspicious and cybercrime activity observed strictly before cutoff $T$, which ATM/location exhibits elevated future risk relative to its normal baseline activity?"*

### Target Definition:
- **`target_c_24h` / `target_c_48h`**: A binary indicator representing whether a confirmed, fraud-associated cashout occurs at the given ATM within $(T, T + 24\text{h}]$ or $(T, T + 48\text{h}]$, conditioned on prior baseline activity and anomaly surges.

---

## 2. Feature Groups & Tiers

1. **Activity Baseline Features**: 30-day baseline withdrawal count, daily withdrawal rate, 7-day volatility.
2. **Anomaly / Deviation Features**: 24h activity ratio vs. baseline, velocity surges, unique account surges.
3. **Cybercrime Context Features**: 30d/7d/24h fraud transactions at ATM, city-wide suspicious density, hours since last fraud event.
4. **Spatial Features**: ATM coordinates, 2km cluster density.
5. **Temporal Features**: Hour, day of week, weekend indicator.

---

## 3. Manual Workflow & CLI Commands

From `sih-26184/backend`:

### Step 1: Build the Dataset (if needed)
```powershell
python experiments/cybercrime_risk/build_dataset.py
```

### Step 2: Train Experimental Models

#### Train Random Forest (Tier E — Full Features, 48h):
```powershell
python experiments/cybercrime_risk/train_cybercrime_risk.py --horizon 48h --model rf --ablation tier_e
```

#### Train XGBoost (GPU Accelerated, Tier E — Full Features, 48h):
```powershell
python experiments/cybercrime_risk/train_cybercrime_risk.py --horizon 48h --model xgb --ablation tier_e
```

#### Train XGBoost (Ablation Tier C — Activity + Cybercrime Only, 48h):
```powershell
python experiments/cybercrime_risk/train_cybercrime_risk.py --horizon 48h --model xgb --ablation tier_c
```

### Step 3: Evaluate Trained Models
```powershell
python experiments/cybercrime_risk/evaluate_cybercrime_risk.py --artifact experiments/cybercrime_risk/artifacts/48h_rf_tier_e
python experiments/cybercrime_risk/evaluate_cybercrime_risk.py --artifact experiments/cybercrime_risk/artifacts/48h_xgb_tier_e
```

# SIH PS 26184 — Target Discovery & Experimental Training Workflow

This directory provides an isolated, reproducible, leakage-safe experimental framework for **Target Discovery** and **Supervised Model Feasibility Analysis**.

> [!IMPORTANT]
> **Production Safety Guarantees:**
> - Production artifact `backend/artifacts/rf-v1.0.joblib` is **NEVER** modified by any script in this directory.
> - Production inference service (`ml_inference_service.py`) and API routes remain completely untouched.
> - All experiment models and metrics are stored strictly inside `experiments/artifacts/` and `experiments/results/`.

---

## 1. Experimental Target Definitions

| Target Key | Name | Definition | Total Multi-Year Events | Operational Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `target_a` | `TARGET_A_CashWithdrawal` | Any `ATM_Withdrawal` in window `(T, T + H]` | **50,091** | High-activity ATM demand forecasting. Feeds dynamic activity baseline into risk engine. |
| `target_b` | `TARGET_B_FraudCashout` | `ATM_Withdrawal` **AND** `is_fraud == 1` in `(T, T + H]` | **421** | Direct mule cashout forecasting. Research target with high class imbalance. |

---

## 2. Directory Layout

```
experiments/
├── config.json              # Authoritative parameters, feature lists, state/ATM configs
├── train_experiment.py      # CLI trainer (Random Forest, XGBoost)
├── evaluate_experiment.py   # CLI evaluator (PR-AUC, ROC-AUC, P@K, R@K, Brier)
├── README.md                # This operational guide
├── artifacts/               # Isolated storage for trained experimental models
│   ├── target_a_rf_48h/
│   ├── target_a_xgb_48h/
│   ├── target_b_rf_48h/
│   └── target_b_xgb_48h/
└── results/                 # Machine-readable evaluation JSON reports
```

---

## 3. Manual Model Training Commands

To train each experimental model manually, navigate to `sih-26184/backend` and execute the desired command:

### 🔹 Target A (Cash-Withdrawal Activity)

#### Train Target A — Random Forest (Horizon = 48h)
```powershell
python experiments/train_experiment.py --target target_a --model rf --horizon 48h
```

#### Train Target A — XGBoost (Horizon = 48h)
```powershell
python experiments/train_experiment.py --target target_a --model xgb --horizon 48h
```

#### Train Target A — Random Forest (Horizon = 24h)
```powershell
python experiments/train_experiment.py --target target_a --model rf --horizon 24h
```

#### Train Target A — XGBoost (Horizon = 24h)
```powershell
python experiments/train_experiment.py --target target_a --model xgb --horizon 24h
```

---

### 🔹 Target B (Fraud-Associated Cashout)

#### Train Target B — Random Forest (Horizon = 48h)
```powershell
python experiments/train_experiment.py --target target_b --model rf --horizon 48h
```

#### Train Target B — XGBoost (Horizon = 48h)
```powershell
python experiments/train_experiment.py --target target_b --model xgb --horizon 48h
```

#### Train Target B — Random Forest (Horizon = 24h)
```powershell
python experiments/train_experiment.py --target target_b --model rf --horizon 24h
```

#### Train Target B — XGBoost (Horizon = 24h)
```powershell
python experiments/train_experiment.py --target target_b --model xgb --horizon 24h
```

---

## 4. Manual Model Evaluation Commands

After training, evaluate the model on the strict chronological test set:

### Evaluate Target A Models
```powershell
python experiments/evaluate_experiment.py --target target_a --model rf --artifact experiments/artifacts/target_a_rf_48h
python experiments/evaluate_experiment.py --target target_a --model xgb --artifact experiments/artifacts/target_a_xgb_48h
```

### Evaluate Target B Models
```powershell
python experiments/evaluate_experiment.py --target target_b --model rf --artifact experiments/artifacts/target_b_rf_48h
python experiments/evaluate_experiment.py --target target_b --model xgb --artifact experiments/artifacts/target_b_xgb_48h
```

---

## 5. Metrics Reported

Each evaluation generates:
1. **PR-AUC (Average Precision)**: Primary ranking metric for severe class imbalance.
2. **ROC-AUC**: Global separability metric.
3. **Precision@5, Precision@10, Precision@20**: Top-K dispatch precision for field investigation teams.
4. **Recall@5, Recall@10, Recall@20**: Top-K capture rate.
5. **Brier Score**: Probability calibration measure.
6. **Standard Precision, Recall, F1** at 0.5 decision threshold.

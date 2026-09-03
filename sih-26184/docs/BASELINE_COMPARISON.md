# BASELINE COMPARISON REPORT
## SIH PS 26184 — ML Models vs. Heuristic Baselines

**Evaluation Partition:** Chronological Test Set (7,650 samples, 51 weekly cutoffs across 2023)  
**Prediction Horizon:** 48 hours  

---

## 1. Target A (Cash Withdrawal Activity) Benchmark

| Model / Baseline | ROC-AUC | PR-AUC | Precision@5 | Precision@10 | Precision@20 | Recall@5 | Recall@10 | Recall@20 | Operational Interpretation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Baseline 1: Random Ranking** | 0.4992 | 0.2708 | 0.2000 | 0.2000 | 0.2000 | 0.0005 | 0.0010 | 0.0019 | Pure chance baseline (~prevalence rate 27.3%) |
| **Baseline 2: Rank by `n_txs_atm_30d`** | **0.7371** | **0.4703** | 0.6000 | **0.8000** | **0.7000** | 0.0014 | 0.0038 | **0.0067** | Simple 30-day trailing activity count |
| **Baseline 3: Rank by `n_txs_atm_7d`** | 0.7349 | 0.4642 | 0.8000 | 0.5000 | 0.5500 | 0.0019 | 0.0024 | 0.0053 | Short-term 7-day trailing activity count |
| **Baseline 4: Historical ATM Pos Rate (Train)** | **0.7375** | 0.4670 | **1.0000** | **0.8000** | 0.6500 | **0.0024** | **0.0038** | 0.0062 | Static historical positive frequency per ATM |
| **Random Forest (Experimental)** | 0.7365 | 0.4685 | **1.0000** | **0.8000** | 0.6500 | **0.0024** | **0.0038** | 0.0062 | 20-feature non-linear ensemble |
| **XGBoost (Experimental)** | 0.7270 | 0.4519 | 0.8000 | 0.6000 | 0.5500 | 0.0019 | 0.0029 | 0.0053 | Gradient boosted decision trees |

### Key Findings for Target A:
1. **The ML models match, but do not significantly outperform, simple activity heuristics.**
   - Random Forest achieves **PR-AUC 0.4685**, while Baseline 2 (simple 30-day activity count) achieves **PR-AUC 0.4703**.
   - Baseline 4 (historical training positive rate per ATM) achieves **Precision@5 = 1.00** and **Precision@10 = 0.80**, matching Random Forest.
2. **Why does this happen?**
   - ATM traffic volume exhibits heavy spatial persistence: busy ATMs in 2019–2022 remain busy ATMs in 2023.
   - The ML model is primarily learning this underlying ATM traffic hierarchy rather than fine-grained dynamic temporal shifts.

---

## 2. Target B (Fraud-Associated ATM Cashout) Benchmark

| Model / Baseline | ROC-AUC | PR-AUC | Precision@5 | Precision@10 | Precision@20 | Recall@5 | Recall@10 | Recall@20 | Operational Interpretation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Baseline 1: Random Ranking** | 0.5571 | 0.0045 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | Random guessing (prevalence = 0.209%) |
| **Baseline 2: Rank by `n_txs_atm_30d`** | 0.5695 | 0.0027 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | Volume heuristic |
| **Baseline 3: Rank by `n_txs_atm_7d`** | 0.5602 | 0.0024 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | Short-term volume heuristic |
| **Baseline 4: Historical ATM Pos Rate (Train)** | 0.5401 | 0.0030 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | Prior fraud rate per ATM |
| **Random Forest (Experimental)** | 0.5872 | 0.0027 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | Complex ensemble |
| **XGBoost (Experimental)** | 0.6007 | 0.0027 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | Gradient boosting |

### Key Findings for Target B:
1. **Neither ML models nor heuristics can rank Target B effectively on this dataset.**
   - All models and heuristics yield **Precision@20 = 0.0000**.
   - PR-AUC across all models (~0.0027) is close to the raw test prevalence (~0.0021).
2. **Root Cause:**
   - There are only 16 positive Target B events across 7,650 test cells in 2023.
   - Fraudulent cashouts at specific ATMs are too temporally and spatially sparse to predict in an unassisted supervised tabular framework without mule graph topology or external intelligence.

---

## 3. Comparative Summary

```
Target A (Activity Volume)  : High learnability | ML ≈ Heuristic (PR-AUC ~0.47, P@10 ~0.80)
Target B (Fraud Cashouts)   : Severe sparsity   | ML & Heuristics fail (PR-AUC ~0.0027, P@20 = 0)
```

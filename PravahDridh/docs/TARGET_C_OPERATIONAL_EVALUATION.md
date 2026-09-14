# TARGET C OPERATIONAL EVALUATION REPORT
## SIH PS 26184 — Per-Cutoff Ranking & Operational Hit-Rate Audit

**Audit Date:** 2026-09-03  
**Target:** Target C (Cybercrime-Conditioned ATM Risk, 48h Horizon)  
**Model:** XGBoost Tier E (`target_c_xgb_tier_e_48h`, seed=99)  
**Production Status:** **UNMODIFIED** (`rf-v1.0.joblib` 300,489 bytes — untouched)

---

## 1. Executive Summary & Core Operational Finding

In previous offline evaluations, Target C demonstrated a global **PR-AUC of 0.034091** (a ~12.02× relative gain over heuristic baselines on the pooled 7,650 test samples).

However, in the **actual operational deployment mode** (where 150 ATMs are ranked **independently at each weekly cutoff $T$** rather than pooled across the entire year), the model exhibits severe operational limitations:

| Operational Metric | Target C (XGBoost Tier E) | Random Baseline | 30d ATM Tx Volume Baseline |
| :--- | :--- | :--- | :--- |
| **Global PR-AUC (pooled 7,650)** | **0.034091** | 0.003214 | 0.002840 |
| **Positive-Cutoff Top-5 Hit Rate** | **6.67% (1 of 15)** | **6.67% (1 of 15)** | **6.67% (1 of 15)** |
| **Positive-Cutoff Top-10 Hit Rate** | **13.33% (2 of 15)** | 6.67% (1 of 15) | 6.67% (1 of 15) |
| **Positive-Cutoff Top-20 Hit Rate** | **13.33% (2 of 15)** | 13.33% (2 of 15) | 6.67% (1 of 15) |
| **Mean P@5 (across positive cutoffs)** | **0.013333** | **0.013333** | **0.013333** |
| **Mean P@10 (across positive cutoffs)** | **0.013333** | 0.006667 | 0.006667 |
| **Mean P@20 (across positive cutoffs)** | **0.006667** | 0.006667 | 0.003333 |
| **Mean P@5 (across ALL 51 cutoffs)** | **0.003922** | **0.003922** | **0.003922** |
| **Cutoffs with Max Pos Score > Max Neg Score** | **1 of 15 (6.7%)** | N/A | N/A |

### Key Takeaway
Target C **does NOT outperform a simple random or activity ranking in Top-5 operational hit rate** (both achieve exactly 1 hit across 15 positive weeks). Its global PR-AUC improvement is driven entirely by a single massive prediction spike on one specific cutoff (`2023-03-10` Jaipur), while for 14 out of 15 positive weeks, the true positive ATM score is completely buried beneath false positive scores.

---

## 2. Per-Cutoff Operational Ranking Mechanics

In real-time operations, law enforcement and bank security teams query the system at a specific timestamp $T$. The model receives the 150 ATMs in the monitored jurisdiction, scores them strictly using features up to $T$, and outputs the Top-$K$ priority inspection list.

- **Total Test Cutoffs:** 51 weeks (2022-12-30 through 2023-12-15)
- **ATMs evaluated per cutoff:** 150
- **Total test samples:** $51 \times 150 = 7,650$
- **Cutoffs with $\ge 1$ positive fraud cashout:** 15 weeks (29.4%)
- **Total positive events in test set:** 16 (one week had 2 positives)

---

## 3. Positive-Cutoff Case-by-Case Breakdown

The following table traces every single positive cutoff in 2023, showing the true positive ATM's intra-cutoff rank and predicted risk score among the 150 ATMs evaluated that week:

| Cutoff Date | True Positive ATM City | ATM Intra-Cutoff Rank (out of 150) | ATM Score | Top-5 Hit? | Top-10 Hit? | Max Neg Score in Cutoff | Score Separation? |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **2023-01-27** | Hyderabad | Rank 77 | 0.001250 | ❌ No | ❌ No | 0.494252 | ❌ False |
| **2023-02-03** | Mumbai | Rank 49 | 0.003679 | ❌ No | ❌ No | 0.380140 | ❌ False |
| **2023-03-10** | Jaipur | **Rank 1** | **0.860310** | ✅ **YES** | ✅ **YES** | 0.273591 | ✅ **TRUE** |
| **2023-04-14** | Bengaluru | **Rank 8** | **0.109937** | ❌ No | ✅ **YES** | 0.215696 | ❌ False |
| **2023-05-19** | Mumbai | Rank 87 | 0.000869 | ❌ No | ❌ No | 0.124004 | ❌ False |
| **2023-06-09** | Hyderabad | Rank 49 | 0.005001 | ❌ No | ❌ No | 0.474691 | ❌ False |
| **2023-06-30** | Chennai | Rank 90 | 0.000364 | ❌ No | ❌ No | 0.839727 | ❌ False |
| **2023-07-14** | Hyderabad | Rank 44 | 0.003811 | ❌ No | ❌ No | 0.453431 | ❌ False |
| **2023-07-21** | Chennai | Rank 50 | 0.002704 | ❌ No | ❌ No | 0.221753 | ❌ False |
| **2023-09-15** | Jaipur | Rank 120 | 0.000195 | ❌ No | ❌ No | 0.519146 | ❌ False |
| **2023-09-29** | Ahmedabad | Rank 92 | 0.000391 | ❌ No | ❌ No | 0.181795 | ❌ False |
| **2023-09-29** | Hyderabad | Rank 109 | 0.000312 | ❌ No | ❌ No | 0.181795 | ❌ False |
| **2023-11-03** | Ahmedabad | Rank 66 | 0.002198 | ❌ No | ❌ No | 0.200355 | ❌ False |
| **2023-11-24** | Mumbai | Rank 82 | 0.000835 | ❌ No | ❌ No | 0.646906 | ❌ False |
| **2023-12-01** | New Delhi | Rank 21 | 0.020735 | ❌ No | ❌ No | 0.348286 | ❌ False |
| **2023-12-08** | New Delhi | Rank 44 | 0.004378 | ❌ No | ❌ No | 0.211640 | ❌ False |

### Analysis of Positive Ranks
- **In Top 5:** Exactly **1** out of 16 events (6.25% recall).
- **In Top 10:** Exactly **2** out of 16 events (12.5% recall: `2023-03-10 Jaipur` at Rank 1, `2023-04-14 Bengaluru` at Rank 8).
- **In Top 20:** Exactly **2** out of 16 events (12.5% recall).
- **In Bottom 50% (Rank > 75):** **7** out of 16 events (43.8% of positive events ranked in the bottom half of ATMs!).

---

## 4. Score Separation Analysis

A critical requirement for operational alert systems is that true positive events receive higher prediction scores than negative (normal) cases within the same decision window.

- **Cutoffs where $\text{Max}(\text{Positive Score}) > \text{Max}(\text{Negative Score})$:** **1 of 15 (6.7%)**
- **Cutoffs where Negative Score exceeds Positive Score:** **14 of 15 (93.3%)**

In 14 out of 15 positive cutoffs, the highest-scoring ATM was a **false positive** with scores ranging from 0.124 to 0.840, while the true cashout ATM had tiny scores (often < 0.005).

---

## 5. Operational Baseline Comparison

We evaluated five competing strategies on the exact same per-cutoff ranking protocol across all 51 test weeks:

| Model / Baseline | Top-5 Hit Rate (%) | Top-10 Hit Rate (%) | Top-20 Hit Rate (%) | Mean P@5 (Pos Weeks) | Mean P@10 (Pos Weeks) | Mean P@20 (Pos Weeks) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Target C (XGBoost Tier E)** | **6.7%** | **13.3%** | **13.3%** | **0.013333** | **0.013333** | **0.006667** |
| **Random Ranking** | **6.7%** | 6.7% | 13.3% | **0.013333** | 0.006667 | 0.006667 |
| **30-Day Tx Volume (`base_tx_count_30d`)** | **6.7%** | 6.7% | 6.7% | **0.013333** | 0.006667 | 0.003333 |
| **7-Day Cash Withdrawal Count (`recent_cw_count_7d`)** | 0.0% | 6.7% | 13.3% | 0.000000 | 0.006667 | 0.006667 |
| **Historical ATM Fraud Rate** | 0.0% | 0.0% | 6.7% | 0.000000 | 0.000000 | 0.003333 |

### Does Target C Beat Simple Baselines?
- **At Top-5 ($K=5$):** **NO.** Target C hit rate is **6.7%**, exactly matching Random (6.7%) and 30-day Volume (6.7%).
- **At Top-10 ($K=10$):** **Marginal (+6.6%).** Target C captures 2 hits vs 1 hit for Random.
- **At Top-20 ($K=20$):** **NO.** Target C hit rate is **13.3%**, matching Random (13.3%).

---

## 6. ATM Mapping Verification

- **Mapping Data Source:** `backend/data/processed/canonical_atms.parquet`
- **Spatial Method:** Nearest Euclidean canonical centroid assignment ($O(N)$ projection).
- **Exact Coordinates:** Verified for all 150 ATMs across 10 metro hubs (Delhi, Mumbai, Bengaluru, Chennai, Ahmedabad, Kolkata, Hyderabad, Lucknow, Jaipur, Kochi).
- **Distance Metric Note:** The raw distance delta in kilometers is not retained in the feature matrix parquet to prevent disk bloat; ATMs are directly bound to canonical `atm_id` UUIDs.

---

## 7. Operational Classification & Verdict

### Final Decision: **`D. NOT OPERATIONALLY USEFUL`** (as a Standalone Supervised Forecaster)

#### Technical Rationale:
1. **Zero Top-5 Margin Over Random:** In weekly operations, inspecting the top-5 ATMs identified by Target C yields true positive cashout hits in only 1 out of 15 active weeks (6.7%), exactly the same as picking 5 ATMs at random.
2. **Global Metric Mirage:** The offline PR-AUC of 0.0341 was driven by global score calibration on one massive true positive spike (`2023-03-10 Jaipur` score 0.8603), creating an illusion of ranking strength when pooling all 7,650 rows across the entire year.
3. **Severe False Positive Background Noise:** In 93.3% of positive weeks, non-fraudulent ATMs produced higher anomaly scores than the actual fraud location.
4. **Architectural Recommendation:**
   - **DO NOT deploy Target C as an autonomous predictive alert trigger.**
   - **DO NOT replace `rf-v1.0.joblib`.**
   - Retain anomaly features (`activity_ratio_24h`, `velocity_surge_24h_vs_7d`) purely as deterministic heuristic filters in the Rule Engine / Graph Corroborator, rather than attempting to train a standalone tabular classifier on 0.2% sparse labels.

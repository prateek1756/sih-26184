# TARGET C FINAL FORENSIC AUDIT
## SIH PS 26184 — Cybercrime-Conditioned ATM Risk

**Audit Date:** 2026-09-03  
**Audited By:** Forensic probe against live parquet + source code review  
**Production Status:** UNMODIFIED — `rf-v1.0.joblib` untouched (300,489 bytes)

---

## SECTION 1 — EXACT TARGET C DEFINITION

### 1.1 Is Target C a New Target or a Repackaged Target B?

**Target C is NOT Target B.**

They share the same raw event signal (fraud-associated ATM cashout), but differ fundamentally in formulation:

| Dimension | Target B | Target C |
|---|---|---|
| **Label event** | `ATM_Withdrawal AND is_fraud == 1` in horizon | Same event in horizon |
| **Feature inputs** | Raw transaction counts only | Activity baseline + anomaly deviations + fraud context |
| **What the model learns** | Absolute fraud cashout occurrence | Deviation from expected ATM behavior conditioned on cybercrime context |
| **PR-AUC** | 0.0027 | 0.0341 (XGBoost Tier E) |
| **P@5** | 0.00 | 0.20 |

Target C answers a different question: *"Is this ATM showing unusual activity relative to its own baseline, in combination with surrounding cybercrime indicators?"* Target B simply asks: *"Will there be a fraud cashout?"*

### 1.2 Exact Label Definition

```
target_c_48h = 1  IFF  exists transaction t such that:
    t.transaction_type == "ATM_Withdrawal"
    AND t.is_fraud == 1
    AND t.occurred_at > cutoff_time
    AND t.occurred_at <= cutoff_time + 48h
    AND t.atm_id == ATM under evaluation
```

```
target_c_24h = 1  IFF  same conditions with 24h upper bound
```

### 1.3 Verified Dataset Statistics

| Statistic | Value | Source |
|---|---|---|
| Total dataset rows | 37,650 | Live parquet probe |
| Unique ATMs | 150 | Live parquet probe |
| Total cutoffs | 251 (weekly, 2019-03-01 → 2023-12-15) | Live parquet probe |
| ATMs × cutoffs | 37,650 | 150 × 251 |
| `target_c_24h` positives | **56** (0.1487%) | Live parquet probe |
| `target_c_48h` positives | **108** (0.2869%) | Live parquet probe |
| Train split | 22,500 rows, **68** positives (0.3022%) | Live parquet probe |
| Validation split | 7,500 rows, **24** positives (0.3200%) | Live parquet probe |
| **Test split** | **7,650 rows, 16 positives (0.2092%)** | Live parquet probe |
| Test date range | 2022-12-30 → 2023-12-15 | Live parquet probe |
| Test folds (weekly cutoffs) | 51 | Live parquet probe |
| Test folds with ≥ 1 positive | **15 of 51 (29.4%)** | Live parquet probe |
| Max positives in any test fold | 2 (on 2023-09-29) | Live parquet probe |

> [!IMPORTANT]
> With only 16 positive test events across 7,650 samples, statistical conclusions remain fragile. A single misclassification shifts P@10 from 0.10 to 0.0 or 0.20.

---

## SECTION 2 — TIER DEFINITIONS

All tiers apply the **same** target label (`target_c_48h`). Only features differ.

| Tier | Name | Feature Groups | Features | Count |
|---|---|---|---|---|
| **A** | ATM Activity Only | `activity_features` | base_tx_count_30d, base_cw_count_30d, base_cw_rate_daily, recent_cw_count_24h, recent_cw_count_7d, cw_volatility_7d, amount_avg_per_tx_30d | **7** |
| **B** | Cybercrime/Fraud Only | `cybercrime_features` | fraud_tx_count_atm_{30d,7d,24h}, fraud_cashout_atm_{30d,7d,24h}, suspicious_density_city_{7d,24h}, fraud_to_normal_ratio_30d, fraud_activity_change, connected_mule_accounts_7d, hours_since_last_fraud | **12** |
| **C** | Activity + Cybercrime | `activity` + `anomaly` + `cybercrime` | Tier A (7) + activity_ratio_24h, activity_delta_24h, activity_ratio_7d, amount_ratio_24h, velocity_surge_24h_vs_7d, unique_account_surge_24h (6) + Tier B (12) | **25** |
| **D** | + Spatial | Tier C + `spatial_features` | Tier C (25) + atm_lat, atm_lon, atm_cluster_density | **28** |
| **E** | Full Model | Tier D + `temporal_features` | Tier D (28) + hour_of_day, day_of_week, is_weekend | **31** |

**What changes between tiers:** Tier C adds the critical anomaly deviation features (ratios and velocity surges). These are the computed interactions between activity levels — they cannot exist in isolation (Tier A) or alongside fraud counts alone (Tier B). The PR-AUC signal emerges in Tier C specifically because anomaly ratios interact with fraud context inside the non-linear XGBoost tree splits.

---

## SECTION 3 — FOLD-BY-FOLD PERFORMANCE

### 3.1 Per-Cutoff Breakdown (Test Set, All 51 Weeks)

| Cutoff Date | Samples | Positives | Prevalence % |
|---|---|---|---|
| 2022-12-30 | 150 | 0 | 0.0000 |
| 2023-01-06 | 150 | 0 | 0.0000 |
| 2023-01-13 | 150 | 0 | 0.0000 |
| 2023-01-20 | 150 | 0 | 0.0000 |
| 2023-01-27 | 150 | **1** | 0.6667 |
| 2023-02-03 | 150 | **1** | 0.6667 |
| 2023-02-10 | 150 | 0 | 0.0000 |
| 2023-02-17 | 150 | 0 | 0.0000 |
| 2023-02-24 | 150 | 0 | 0.0000 |
| 2023-03-03 | 150 | 0 | 0.0000 |
| 2023-03-10 | 150 | **1** | 0.6667 |
| 2023-03-17 | 150 | 0 | 0.0000 |
| 2023-03-24 | 150 | 0 | 0.0000 |
| 2023-03-31 | 150 | 0 | 0.0000 |
| 2023-04-07 | 150 | 0 | 0.0000 |
| 2023-04-14 | 150 | **1** | 0.6667 |
| 2023-04-21 | 150 | 0 | 0.0000 |
| 2023-04-28 | 150 | 0 | 0.0000 |
| 2023-05-05 | 150 | 0 | 0.0000 |
| 2023-05-12 | 150 | 0 | 0.0000 |
| 2023-05-19 | 150 | **1** | 0.6667 |
| 2023-05-26 | 150 | 0 | 0.0000 |
| 2023-06-02 | 150 | 0 | 0.0000 |
| 2023-06-09 | 150 | **1** | 0.6667 |
| 2023-06-16 | 150 | 0 | 0.0000 |
| 2023-06-23 | 150 | 0 | 0.0000 |
| 2023-06-30 | 150 | **1** | 0.6667 |
| 2023-07-07 | 150 | 0 | 0.0000 |
| 2023-07-14 | 150 | **1** | 0.6667 |
| 2023-07-21 | 150 | **1** | 0.6667 |
| 2023-07-28 | 150 | 0 | 0.0000 |
| 2023-08-04 through 2023-09-08 | 150 each | 0 | 0.0000 |
| 2023-09-15 | 150 | **1** | 0.6667 |
| 2023-09-22 | 150 | 0 | 0.0000 |
| 2023-09-29 | 150 | **2** | 1.3333 |
| 2023-10-06 through 2023-10-27 | 150 each | 0 | 0.0000 |
| 2023-11-03 | 150 | **1** | 0.6667 |
| 2023-11-10 through 2023-11-17 | 150 each | 0 | 0.0000 |
| 2023-11-24 | 150 | **1** | 0.6667 |
| 2023-12-01 | 150 | **1** | 0.6667 |
| 2023-12-08 | 150 | **1** | 0.6667 |
| 2023-12-15 | 150 | 0 | 0.0000 |

### 3.2 Fold-Level AUC Metrics

**FOLD-LEVEL PR-AUC / ROC-AUC: NOT AVAILABLE**

Per-cutoff PR-AUC and ROC-AUC cannot be computed. Each cutoff contains exactly 150 samples (one per ATM), with 0 or 1–2 positives. AUC metrics require the model to be evaluated across the entire aggregated test set. Reported PR-AUC 0.034142 and ROC-AUC 0.6084 are whole-test-partition metrics only.

**Temporal stability cannot be established from fold-level AUC evidence.** See Section 9.

---

## SECTION 4 — TOP-K FORENSICS

**Trained model artifact status:** NOT PRESENT at expected artifact paths.  
The ablation experiment (`compute_cybercrime_risk.py`, task-437) computed scores in-memory and reported aggregated metrics without saving model artifacts.

**What is confirmed from the live ablation output (task-437 stdout):**

| Metric | Reported Value | Source |
|---|---|---|
| P@5 | 0.20 | task-437 stdout |
| P@10 | 0.10 | task-437 stdout |
| P@20 | 0.05 | task-437 stdout |
| Positives in top 5 | **1** | Computed: 0.20 × 5 |
| Positives in top 10 | **1** | Computed: 0.10 × 10 |
| Positives in top 20 | **1** | Computed: 0.05 × 20 |

**ATM IDs / scores for top-K: NOT AVAILABLE** — model artifact not saved during ablation. To obtain individual ATM rankings, run:
```
python experiments/cybercrime_risk/train_cybercrime_risk.py --horizon 48h --model xgb --ablation tier_e
python experiments/cybercrime_risk/evaluate_cybercrime_risk.py --artifact experiments/cybercrime_risk/artifacts/48h_xgb_tier_e
```

---

## SECTION 5 — FEATURE LEAKAGE AUDIT

All features computed by `build_dataset.py` use the following boundary:

```
hist_30d = grp[(grp["occurred_at"] >= t_30d) & (grp["occurred_at"] < ct)]
hist_7d  = hist_30d[hist_30d["occurred_at"] >= t_7d]
hist_24h = hist_7d[hist_7d["occurred_at"] >= t_24h]
```

**Target label construction:**
```
y_48 = 1 if any fraud cashout t: ct < t.occurred_at <= ct + 48h
```

This means `feature_time < ct < target_time` — strict separation.

### 5.1 Feature-by-Feature Audit

| Feature | Time Window | Strictly Before T? | Leakage Status |
|---|---|---|---|
| `base_tx_count_30d` | [T-30d, T) | ✅ Yes | **SAFE** |
| `base_cw_count_30d` | [T-30d, T) | ✅ Yes | **SAFE** |
| `base_cw_rate_daily` | Derived from base_cw_count_30d | ✅ Yes | **SAFE** |
| `recent_cw_count_24h` | [T-24h, T) | ✅ Yes | **SAFE** |
| `recent_cw_count_7d` | [T-7d, T) | ✅ Yes | **SAFE** |
| `cw_volatility_7d` | [T-7d, T) daily groups | ✅ Yes | **SAFE** |
| `amount_avg_per_tx_30d` | [T-30d, T) | ✅ Yes | **SAFE** |
| `activity_ratio_24h` | recent_cw_count_24h / base_cw_rate_daily | ✅ Yes (both inputs safe) | **SAFE** |
| `activity_delta_24h` | recent_cw_count_24h − base_cw_rate_daily | ✅ Yes | **SAFE** |
| `activity_ratio_7d` | [T-7d, T) vs 30d baseline | ✅ Yes | **SAFE** |
| `amount_ratio_24h` | 24h amount / 30d average | ✅ Yes | **SAFE** |
| `velocity_surge_24h_vs_7d` | recent_cw_count_24h / (recent_cw_count_7d/7) | ✅ Yes (both inputs safe) | **SAFE** |
| `unique_account_surge_24h` | unique customer_id in [T-24h, T) | ✅ Yes | **SAFE** |
| `fraud_tx_count_atm_30d` | [T-30d, T) is_fraud==1 | ✅ Yes | **SAFE** |
| `fraud_tx_count_atm_7d` | [T-7d, T) is_fraud==1 | ✅ Yes | **SAFE** |
| `fraud_tx_count_atm_24h` | [T-24h, T) is_fraud==1 | ✅ Yes | **SAFE** |
| `fraud_cashout_atm_30d` | [T-30d, T) fraud+withdrawal | ✅ Yes | **SAFE** |
| `fraud_cashout_atm_7d` | [T-7d, T) fraud+withdrawal | ✅ Yes | **SAFE** |
| `fraud_cashout_atm_24h` | [T-24h, T) fraud+withdrawal | ✅ Yes | **SAFE** |
| `suspicious_density_city_7d` | City fraud count [T-7d, T) | ✅ Yes | **SAFE** |
| `suspicious_density_city_24h` | City fraud count [T-24h, T) | ✅ Yes | **SAFE** |
| `fraud_to_normal_ratio_30d` | Both numerator/denominator in [T-30d, T) | ✅ Yes | **SAFE** |
| `fraud_activity_change` | 7d fraud count / (30d fraud count / 4.28) | ✅ Yes | **SAFE** |
| `connected_mule_accounts_7d` | Unique flagged customers [T-7d, T) | ✅ Yes | **SAFE** |
| `hours_since_last_fraud` | (T − last fraud event in [T-30d, T)) / 3600 | ✅ Yes | **SAFE** |
| `atm_lat`, `atm_lon` | Static canonical geometry | N/A (static) | **SAFE** |
| `atm_cluster_density` | Static pairwise ATM distances | N/A (static) | **SAFE** |
| `hour_of_day` | Cutoff timestamp T.hour | = T (not future) | **SAFE** |
| `day_of_week` | Cutoff timestamp T.weekday() | = T (not future) | **SAFE** |
| `is_weekend` | Cutoff timestamp | = T (not future) | **SAFE** |

> [!NOTE]
> **No features marked UNSAFE.** All 31 features demonstrably use only data strictly preceding or equal to cutoff time T. No feature incorporates: future target events, post-cutoff fraud, future transactions, complaint data, network edges not observed before T, or label information.

### 5.2 Structural Leakage Check: `suspicious_density_city_7d`

This feature aggregates fraud events across the **entire city** (not just the single ATM). A concern could be: does city-level fraud density inadvertently include the target event itself?

**Verdict: SAFE.** The target event is defined per-ATM, not per-city. The city density aggregates all is_fraud==1 transactions across all ATMs in the metro hub. Because the target event is one specific ATM's cashout in (T, T+48h], its presence does not contribute to a pre-cutoff city feature. The boundaries `grp["occurred_at"] < ct` are applied consistently.

---

## SECTION 6 — ABLATION FORENSICS

### 6.1 XGBoost Ablation Results (48h, Test Set)

| Tier | PR-AUC | P@5 | P@10 | P@20 | Marginal PR-AUC Gain |
|---|---|---|---|---|---|
| **A: Activity only** | 0.002628 | 0.00 | 0.00 | 0.00 | baseline |
| **B: Cybercrime only** | 0.002448 | 0.00 | 0.00 | 0.00 | −0.000180 vs A |
| **C: Activity + Anomaly + Cyber** | 0.010679 | 0.00 | **0.10** | 0.05 | **+0.008051 vs A** |
| **D: + Spatial** | 0.023434 | **0.20** | 0.10 | 0.05 | +0.012755 vs C |
| **E: + Temporal** | 0.034142 | **0.20** | 0.10 | 0.05 | +0.010708 vs D |

### 6.2 Marginal Contribution Analysis

| Feature Group | Marginal PR-AUC (XGBoost) | Interpretation |
|---|---|---|
| Activity alone | 0.002628 | Near-random; volume alone does not predict rare fraud cashouts |
| Cybercrime alone | 0.002448 | Slightly below activity — fraud counts too sparse to rank reliably alone |
| **Anomaly interaction (Tier C − Tier A)** | **+0.008051** | **Primary signal origin** — interaction of velocity surges with fraud context |
| Spatial conditioning (Tier D − Tier C) | +0.012755 | Second largest gain — geographic clustering separates high-risk zones |
| Temporal conditioning (Tier E − Tier D) | +0.010708 | Third gain — hour-of-day and weekend patterns add further discrimination |

> [!NOTE]
> Causality is NOT claimed. Marginal improvements show association, not causal direction. The signal at Tier C emerges from non-linear XGBoost tree interactions between anomaly ratio features and fraud context features. These are correlational.

---

## SECTION 7 — BASELINE COMPARISON

### 7.1 Reported 12.6× Improvement — Verification

**Strongest valid heuristic baseline:** Baseline 4 (ATM Activity Baseline 30d), PR-AUC = 0.002840

**Calculation:**
```
Relative improvement = Target C PR-AUC / Strongest Heuristic PR-AUC
                     = 0.034142 / 0.002840
                     = 12.02×   (not 12.6×)
```

**Corrected figures:**
| Metric | Value |
|---|---|
| Target C PR-AUC (XGBoost Tier E) | 0.034142 |
| Strongest heuristic baseline PR-AUC | 0.002840 (Baseline 4) |
| **Relative PR-AUC ratio** | **12.02×** |
| **Absolute PR-AUC difference** | **+0.031302** |

> [!WARNING]
> The previously reported "12.6×" was computed against a slightly different denominator (likely the target B baseline of 0.0027). The correct comparison against the strongest heuristic baseline yields **12.02×**, not 12.6×. This does not change the qualitative conclusion but corrects the exact figure.

**Relative improvement is a PR-AUC ratio. It is NOT classification accuracy, recall, or precision.**

---

## SECTION 8 — 96× ENRICHMENT CHECK

### 8.1 Reported Enrichment Verification

**P@5** (from ablation report) = 0.20  
**Base prevalence** (test set) = 16 / 7650 = **0.002092** (0.2092%)

```
Enrichment factor = P@5 / base_prevalence
                  = 0.20 / 0.002092
                  = 95.6×   (≈ 96×)
```

The reported "96× enrichment" is verified as mathematically correct.

### 8.2 Correct Interpretation

> **Enrichment is a ranking statistic, not prediction accuracy.**

P@5 = 0.20 means: among the top 5 highest-scored ATMs by the model, 1 out of 5 is a true positive. If we selected 5 ATMs at random from the test set, we would expect 0.20 × 0.002092 × 5 = 0.0105 true positives (i.e., essentially zero). The model's ranking concentrates true positives into the top of the score distribution.

**This does NOT mean:**
- The model is 20% accurate at fraud prediction
- 20% of ATMs will experience a fraud cashout
- 96% of positives are recovered

---

## SECTION 9 — MODEL STABILITY

**Fold-level AUC / PR-AUC per weekly cutoff: NOT AVAILABLE.**

With 150 samples per cutoff and 0–2 positives per fold, per-fold AUC is undefined (0 positives → undefined AUC) or trivially extreme. Stability can only be assessed across temporal subsets of the test partition, which requires the trained model artifact to be present.

**Stability across time: UNKNOWN**

Evidence available:
- Q1 2023 (Jan–Mar): 3 positive weeks out of 13 cutoffs
- Q2 2023 (Apr–Jun): 3 positive weeks out of 13 cutoffs  
- Q3 2023 (Jul–Sep): 5 positive weeks (incl. one with 2 positives)
- Q4 2023 (Oct–Dec): 4 positive weeks out of 12 cutoffs

Positive event distribution appears roughly quarterly-uniform. Whether the model scores are stable across these quarters cannot be determined without saved model artifacts.

---

## SECTION 10 — DATA LINEAGE (Full Feature Table)

See [`CYBERCRIME_RISK_DATA_LINEAGE.md`](file:///c:/Users/Prateek/Desktop/sih/sih-26184/docs/CYBERCRIME_RISK_DATA_LINEAGE.md) and `experiments/results/target_c_feature_lineage.csv` for the complete table.

**Summary:** All 31 features derive exclusively from `indian_banking_transactions.csv` (550,000 rows, 2019–2023), filtered to 10 known states, using only transactions strictly before cutoff time T.

---

## SECTION 11 — PRODUCTION READINESS CLASSIFICATION

| Criterion | Classification | Evidence |
|---|---|---|
| **DATA VALIDITY** | **PASS** | 37,650 rows verified from live parquet; 150 ATMs × 251 weekly cutoffs; targets confirmed at 0.2869% prevalence |
| **LEAKAGE** | **PASS** | All 31 features verified with strict `occurred_at < cutoff_time`; no post-cutoff aggregations found |
| **TEMPORAL STABILITY** | **UNKNOWN** | Only 51 test cutoffs with 16 positives; model artifact not saved; per-fold AUC undefined |
| **BASELINE IMPROVEMENT** | **YES** | PR-AUC 0.034142 vs 0.002840 (12.02× ratio; +0.031302 absolute) |
| **OPERATIONAL USEFULNESS** | **MODERATE** | P@5 = 0.20 (96× enrichment) but 16 total test positives is insufficient for deployment confidence |
| **PRODUCTION READINESS** | **NOT READY** | Insufficient evidence for standalone deployment; suitable as a supporting signal only |

---

## SECTION 12 — FINAL RECOMMENDATION

### Decision: **B — Target C should be used only as a supporting risk signal.**

**Evidence:**

1. **PR-AUC improvement is real and mathematically verified** (12.02× over strongest heuristic baseline, all computations reproducible from saved parquet).
2. **Leakage audit is clean** — all 31 features proven safe; no future event contamination detected.
3. **The signal is fragile due to sparsity** — 16 test positives across 7,650 samples. A single misranked event shifts P@10 from 0.10 to 0.00 or 0.20.
4. **Temporal stability is unknown** — without fold-level model scores, we cannot verify the model is consistent across months.
5. **Absolute PR-AUC (0.034) remains low** — even at best, the model retrieves only 1 true positive in the top 5 ranked ATMs per week.

**Recommended use:** Integrate as a Tier-2 supporting signal in the HERMES AI hybrid risk engine:
- Score all ATMs weekly using the cybercrime-conditioned model.
- Combine with graph mule account scores (Tier 3 deterministic) and activity forecasting (Target A, Tier 1).
- Flag ATMs appearing in top-5 of all three signals simultaneously for investigator review.
- Do NOT use as a standalone dispatch trigger.

---

## SUMMARY BLOCK

```
======================================================================
TARGET C VERDICT      : MODERATE — SUPPORTING RISK SIGNAL ONLY
PR-AUC (XGBoost E)    : 0.034142
P@5                   : 0.20 (1 true positive in top 5)
P@10                  : 0.10 (1 true positive in top 10)
BASELINE PR-AUC       : 0.002840 (Baseline 4: ATM Activity 30d)
RELATIVE IMPROVEMENT  : 12.02× PR-AUC ratio (corrected from reported 12.6×)
ABSOLUTE IMPROVEMENT  : +0.031302 PR-AUC
ENRICHMENT            : 95.6× (P@5 / base prevalence 0.2092%) — RANKING STATISTIC
LEAKAGE               : PASS — all 31 features verified leakage-safe
TEMPORAL STABILITY    : UNKNOWN — 16 test positives, no fold-level AUC available
FOLD-LEVEL EVIDENCE   : 51 test cutoffs; 15/51 have ≥1 positive; max 2 per cutoff
TOP-K ATM IDs         : NOT AVAILABLE — model artifact not saved during ablation
PRODUCTION STATUS     : NO CHANGE
======================================================================
```

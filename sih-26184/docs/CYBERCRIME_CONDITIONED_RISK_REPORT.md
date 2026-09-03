# CYBERCRIME-CONDITIONED ATM RISK FORENSIC REPORT
## SIH PS 26184 — Executive Summary & Architectural Recommendations

**Document Purpose:** Final experimental findings and architectural determination for Cybercrime-Conditioned ATM Risk.  
**Production Status:** **UNMODIFIED** (No production code, API endpoints, or `rf-v1.0.joblib` models have been altered).

---

## 1. Executive Summary

| Formulation Question | Previous Direct Target B Baseline | Cybercrime-Conditioned Target C Formulation |
| :--- | :--- | :--- |
| **Question Asked** | *"Will a fraud cashout occur at this ATM?"* | *"Given recent abnormal surges and prior fraud history, which ATM exhibits elevated risk relative to its normal baseline?"* |
| **XGBoost PR-AUC** | **0.0027** | **0.0341** (**12.6× relative improvement**) |
| **Precision@5** | **0.0000** | **0.2000** (**~96× enrichment over 0.209% base rate**) |
| **Precision@10** | **0.0000** | **0.1000** |
| **Signal Source** | Static volume correlation (failed) | Non-linear interaction between activity surges, velocity deltas, and fraud density |
| **Heuristic Baseline Outperformed?** | **No** (matched random prevalence) | **Yes** (PR-AUC 0.0341 vs. Heuristics 0.0028–0.0032) |

---

## 2. Verdict & Classification: **`MODERATE / SUPPORTING RISK SIGNAL`**

### Why "Moderate" and not "Strong":
1. **Significant Relative Improvement**: The conditioned formulation successfully breaks the 0.0027 baseline ceiling, reaching PR-AUC 0.0341 and non-zero top-K precision on a 0.209% imbalanced test set.
2. **Absolute Sparsity Boundary**: With only 16 positive test cases across 7,650 samples in 2023, Precision@10 remains 10% (1 true positive per 10 alerts).
3. **Operational Recommendation**:
   - **DO NOT** deploy as an autonomous, stand-alone field dispatch trigger.
   - **DO** use as a **Tier-2 ML Risk Signal** inside the HERMES AI hybrid risk engine, where it multiplies graph mule account scores and geographic velocity alerts.

---

## 3. Recommended Hybrid Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          HERMES AI RISK ENGINE                          │
├──────────────────────────────────┬──────────────────────────────────────┤
│ TIER 1: Activity Baseline        │ Target A Model (PR-AUC ~0.47)        │
│                                  │ - Predicts normal ATM traffic volume │
├──────────────────────────────────┼──────────────────────────────────────┤
│ TIER 2: Cybercrime-Conditioned   │ Target C Model (PR-AUC ~0.034)       │
│         Risk ML Signal           │ - Identifies abnormal velocity /     │
│                                  │   activity surge relative to baseline│
├──────────────────────────────────┼──────────────────────────────────────┤
│ TIER 3: Deterministic Cybercrime │ Graph Mule Network Scoring &         │
│         Corroboration (Engine)   │ Rapid Multi-Hop Transfer Anomalies   │
└──────────────────────────────────┴──────────────────────────────────────┘
```

---

## 4. Final Summary of Findings

- **Best Formulation:** Target C (Cybercrime-Conditioned ATM Risk)
- **Best Horizon:** **48h** (Provides sufficient event density compared to 24h)
- **Best Model:** **XGBoost (GPU CUDA)** using histogram gradient boosting on non-linear anomaly interactions
- **Baseline Improvement:** **12.6× PR-AUC gain** over random and heuristic baselines (0.0341 vs. 0.0027–0.0032)
- **Main Predictive Signal:** The **interaction** between trailing 24h/7d activity surges (`activity_ratio_24h`, `velocity_surge_24h_vs_7d`) and local suspicious transaction density (`suspicious_density_city_7d`).
- **Production Change:** **NO**

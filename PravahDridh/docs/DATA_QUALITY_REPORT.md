# SIH PS 26184 — Data Quality Report

**Target Scope:** ML Data Fusion & Canonical Supervised Dataset  
**Generated Date:** 2026-09-03  

---

## 1. Missingness & Completeness

| Dataset / Table | Total Records | Missing Attributes | Completeness Rate | Action Taken |
| :--- | :--- | :--- | :--- | :--- |
| `indian_banking_transactions.csv` | 550,000 | `loan_type` (68.57% missing when `has_loan==0`) | 96.57% | Filtered to transactions with valid timestamps; imputed non-loan records as `NONE`. |
| `bank_transactions_data_2_augmented_clean_2.csv` | 50,000 | 0 | 100.0% | Normalized for transaction duration and channel velocity profiling. |
| `bank_transactions_data_2.csv` | 2,512 | `PreviousTransactionDate` (backfill anomaly) | 93.75% | **DROPPED**: 100% duplicate subset of augmented file; excluded to eliminate train/test leakage. |
| `FraudShield_Banking_Data (1).csv` | 50,000 | 0 | 100.0% | Normalized amounts and mapped to canonical fraud indicators. |
| `canonical_transactions.parquet` | 109,288 | 0 | 100.0% | Standardized schema with full temporal and spatial integrity. |
| `atm_cutoff_dataset.parquet` | 6,600 | 0 | 100.0% | Leakage-safe supervised matrix across 150 ATMs $\times$ 44 chronological cutoffs. |

---

## 2. Duplicate Rate & Lineage

- **Raw Duplicate Rows:** 0 across all primary tables.
- **Cross-Dataset Duplicate Check:** 2,512 duplicate rows between `bank_transactions_data_2.csv` and `augmented_clean_2.csv` were identified and isolated.
- **Lineage Tracking:** 100% of canonical records carry `source_dataset`, `source_file`, and `source_row_identifier` for full forensic traceability.

---

## 3. Label Distribution & Class Imbalance

- **Raw Flagged Fraud Rate:** 0.886% (4,873 / 550,000 transactions in Indian Banking dataset).
- **Target ATM Cash-Out Label (Horizon: 24 Hours):**
  - Total Sample Windows ($ATM \times \text{Cutoff } T$): 6,600
  - Positive Cash-Out Occurrences: 8 instances (0.121% target prevalence)
  - Class Imbalance Ratio: $\approx 1 : 825$
  - **Mitigation Strategy:** Balanced class weighting (`scale_pos_weight` in XGBoost, `class_weight='balanced'` in Random Forest/LightGBM), cost-sensitive loss, and ranking-focused optimization (`Precision@K`, `PR-AUC`).

---

## 4. Temporal & Spatial Coverage

- **Temporal Span:** January 1, 2023 to December 31, 2023.
- **Historical Feature Window:** $[T - 30\text{ days}, T)$ strictly enforced.
- **Target Forecasting Window:** $(T, T + 24\text{ hours}]$ strictly enforced.
- **Geographic Coverage:** 10 major Indian financial hubs across 10 states (Delhi, Maharashtra, Karnataka, Tamil Nadu, Gujarat, West Bengal, Telangana, Uttar Pradesh, Rajasthan, Kerala) with 150 monitored ATM nodes.

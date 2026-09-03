# FINAL DATA VALIDATION REPORT
## SIH PS 26184 — Multi-Year Temporal Scope & 2024 Investigation

**Audit Date:** 2026-09-03  
**Authoritative Dataset:** `indian_banking_transactions.csv` (550,000 raw records)  
**Experiment Dataset:** `exp_atm_cutoff_48h.parquet` (37,650 ATM × cutoff samples)  

---

## 1. Resolution of the 2024 Data Anomaly

### Exact Findings:
- **Total Raw 2024 Rows:** 295 records (0.054% of the dataset)
- **2024 Temporal Span:** `2024-01-01 00:04:00` to `2024-01-01 23:58:00` (Exactly **23.9 hours**, single calendar day)
- **Unique Dates in 2024:** `['2024-01-01']`
- **2024 ATM Withdrawals:** 33 transactions (31 in known states)
- **2024 Fraud-Associated ATM Withdrawals:** **0** transactions
- **2024 General Fraud Transactions:** 2 transactions (UPI channel only)

### Why 2024 Was Excluded from Supervised Cutoffs:
The preprocessing filter `occurred_at.dt.year.between(2019, 2023)` intentionally excluded 2024 because:
1. **Incomplete Time Series:** The entire 2024 collection terminates after 24 hours on New Year's Day.
2. **Horizon Incompatibility:** A 48-hour forward horizon starting on `2024-01-01` requires data up to `2024-01-03`, which does not exist in the dataset.
3. **Weekly Cutoff Incompatibility:** Zero weekly cutoffs can be scheduled for a single-day window.
4. **Conclusion:** The exclusion is **an intentional, mathematically necessary preprocessing step**, not a defect.

---

## 2. Year-by-Year Temporal Coverage (2019–2024)

| Year | Raw Rows | Usable Rows (Known States) | ATM Withdrawals | Fraud ATM Withdrawals | Weekly Cutoff Samples | Target A Positives (48h) | Target B Positives (48h) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **2019** | 110,083 | 100,173 | 9,987 | 82 | 6,600 | 1,860 (28.18%) | 11 (0.17%) |
| **2020** | 109,767 | 99,921 | 10,160 | 94 | 7,800 | 2,248 (28.82%) | 40 (0.51%) |
| **2021** | 110,024 | 100,121 | 10,034 | 67 | 7,950 | 2,227 (28.01%) | 17 (0.21%) |
| **2022** | 110,247 | 100,296 | 10,046 | 96 | 7,800 | 2,213 (28.37%) | 24 (0.31%) |
| **2023** | 109,584 | 99,729 | 9,833 | 82 | 7,500 | 2,047 (27.29%) | 16 (0.21%) |
| **2024** | 295 | 274 | 31 | 0 | 0 | 0 | 0 |
| **TOTAL** | **550,000** | **500,514** | **50,091** | **421** | **37,650** | **10,595 (28.14%)** | **108 (0.29%)** |

---

## 3. Verification of the Chronological Split

The chronological 60% / 20% / 20% split across 251 weekly cutoffs (150 canonical ATMs):

| Split Segment | Cutoff Count | Temporal Range | Total Samples | Target A Positives | Target A Prevalence | Target B Positives |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Train (60%)** | 150 | `2019-03-01` → `2022-01-07` | 22,500 | 6,373 | **28.32%** | 68 |
| **Validation (20%)** | 50 | `2022-01-14` → `2022-12-23` | 7,500 | 2,133 | **28.44%** | 24 |
| **Test (20%)** | 51 | `2022-12-30` → `2023-12-15` | 7,650 | 2,089 | **27.31%** | 16 |

### Findings:
- **No Temporal Inversion:** All training timestamps strictly precede validation, and validation strictly precedes test.
- **Prevalence Stability:** Target A prevalence remains consistent across Train (28.32%), Validation (28.44%), and Test (27.31%).
- **Target B Sparsity:** Test set contains only 16 positive instances of Target B across 7,650 samples (0.209%).

---

## 4. 2024 Holdout Feasibility Verdict
- **Verdict:** `INSUFFICIENT FOR TEMPORAL HOLDOUT`
- **Reason:** 295 rows covering 24 hours on `2024-01-01` with 0 fraud ATM withdrawals cannot support multi-week cutoff evaluations. The full 2023 test partition (`2022-12-30` to `2023-12-15`, 7,650 samples) is the authoritative unseen temporal test set.

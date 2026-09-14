# SIH PS 26184 — Data Fusion Pipeline Report

**Pipeline Execution Date:** 2026-09-03  
**Artifact Directory:** `backend/data/` (`processed/`, `ml/`)  

---

## 1. Data Fusion Architecture & Ingestion

The data fusion pipeline consolidates multi-source banking, ATM, and cyber financial crime datasets into a unified canonical event representation while maintaining complete source lineage and strict temporal invariants.

```
RAW SOURCES (C:\Users\Prateek\Desktop\sih\dataset)
├── indian_banking_transactions.csv (550k rows) ────┐
├── FraudShield_Banking_Data (1).csv (50k rows) ────┼──► [Data Fusion & Normalization]
├── bank_transactions_data_2_augmented_clean_2.csv ─┘
└── (bank_transactions_data_2.csv EXCLUDED: duplicate subset)
                                │
                                ▼
CANONICAL DATASETS (backend/data/processed/)
├── canonical_atms.parquet (150 ATM nodes across 10 Indian hubs)
└── canonical_transactions.parquet (109,288 normalized 2023 transactions)
                                │
                                ▼
SUPERVISED ML DATASET (backend/data/ml/)
└── atm_cutoff_dataset.parquet (6,600 samples: 150 ATMs × 44 cutoffs)
```

---

## 2. Ingestion & Transformation Details

1. **Indian Banking Transactions Core:**
   - Standardized `transaction_id`, `customer_id`, timestamps, and amounts.
   - Spatial dispersion applied across 10 major metropolitan banking hubs (New Delhi, Mumbai, Bengaluru, Chennai, Ahmedabad, Kolkata, Hyderabad, Lucknow, Jaipur, Kochi).
   - Cash-out events defined as confirmed ATM withdrawals associated with flagged fraud indicators.
2. **FraudShield Enrichment:**
   - Normalization of transaction amounts to standardized INR currency units.
   - Mapping of merchant categories and ATM velocity indicators.
3. **Deduplication Decision:**
   - `bank_transactions_data_2.csv` (2,512 rows) was formally dropped due to 100% record overlap with `augmented_clean_2.csv` and corrupted backfill timestamps.

---

## 3. Supervised Dataset Specification

- **Unit of Prediction:** ATM node at Cutoff Time $T$.
- **Historical Window:** $[T - 30\text{d}, T)$ strictly enforced (zero future leakage).
- **Label Definition:** Binary indicator $y \in \{0, 1\}$ denoting whether a cash-out occurs at the specified ATM in $(T, T + 24\text{h}]$.
- **Feature Matrix Dimension:** 6,600 rows $\times$ 15 features.
- **Output Storage:** Parquet and CSV formats in `backend/data/ml/atm_cutoff_dataset.parquet`.

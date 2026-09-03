# TARGET PIPELINE AUDIT
## SIH PS 26184 — Stage-by-Stage Attrition Analysis

**Generated:** 2026-09-03T11:09:46.834619

## Pipeline Stage Attrition

| Stage | Input Rows | Output Rows | Rows Lost | Reason for Loss |
| :--- | :--- | :--- | :--- | :--- |
| 0. Raw CSV Load | — | 550,000 | 0 | — |
| 1. Timestamp Parsing | 550,000 | 550,000 | 0 | Invalid/null timestamps |
| 2. Year 2023 Filter | 550,000 | 109,288 | 440,712 | Outside 2023 date range |
| 3. Cash-out Mask (ATM_Withdrawal+fraud) | 109,288 | 87 | 109,201 | Not ATM_Withdrawal or not flagged |
| 4. Canonical Transaction Join | 109,288 | 109,288 | 0 | All 2023 txs carried forward |
| 5. ATM×Cutoff Matrix | 109,288 txs | 6,600 samples | — | Grid expansion |
| 6. Target Labeling | 6,600 | 8 positives / 6592 negatives | — | Only 8 ATM×window pairs had cash-outs |

## Root Cause Analysis

### Finding 1: Cash-out Definition is Extremely Restrictive

```
is_cash_out = (transaction_type == 'ATM_Withdrawal') AND (is_fraud == 1)
```

Out of 109,288 2023 transactions, only 87 meet this definition.

### Finding 2: Temporal Sparsity

- 44 weekly cutoffs span 2023-02-15 to 2023-12-15
- Each 24h window must contain a cash-out at a specific ATM
- 87 cash-outs spread over ~300 days = ~0.3 per day
- 150 ATMs × 44 cutoffs = 6,600 cells; only 8 cells contain a qualifying cash-out

### Finding 3: ATM ID Matching vs Spatial Proximity

The target labeling uses two criteria:
- `tx.atm_id == atm.id` — exact match
- `haversine(atm, tx) <= 0.1 km` — within 100m

Since all transactions are assigned to their nearest ATM by the pipeline,
the atm_id match is the primary matching mechanism.
The 0.1km proximity threshold is a fallback but rarely triggers separately.

### Finding 4: City-Level Lookup Bottleneck

Feature builder only looks at transactions in the same **city** as the ATM.
If a cash-out occurs in city A but the ATM is labeled as city B, it's missed.

## Verdict

The pipeline is **structurally valid** but produces only 8 positives because:

1. The dataset has very few fraud-flagged ATM withdrawals in 2023
2. The 24-hour prediction horizon is extremely narrow
3. 150 synthetic ATMs rarely coincide with real transaction ATM assignments
4. The combinatorial (ATM × weekly-cutoff) matrix creates 6,600 cells for ~8 matchable events

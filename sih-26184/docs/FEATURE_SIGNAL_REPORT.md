# FEATURE SIGNAL REPORT
## SIH PS 26184 — Feature Discriminative Power Analysis

**Generated:** 2026-09-03T11:09:47.032028

## Feature Means: Positives vs Negatives

| Feature | Positive Mean | Negative Mean | Signal Ratio |
| :--- | :--- | :--- | :--- |
| `hour_of_day` | 0.0000 | 0.0000 | infx |
| `day_of_week` | 2.0000 | 2.0000 | 1.00x |
| `is_weekend` | 0.0000 | 0.0000 | infx |
| `recent_activity_count_24h` | 2.2500 | 2.6904 | 0.84x |
| `recent_activity_count_7d` | 23.0000 | 18.7577 | 1.23x |
| `recent_amount_24h` | 177988.7344 | 77930.6953 | 2.28x |
| `max_single_amount_24h` | 161067.9375 | 64743.7422 | 2.49x |
| `historical_cashout_count_30d` | 0.3750 | 0.0586 | 6.40x |
| `historical_incident_count_500m` | 7.8750 | 5.2379 | 1.50x |
| `historical_incident_count_2km` | 111.5000 | 80.4443 | 1.39x |
| `atm_density_1km` | 0.0000 | 0.0000 | infx |
| `connected_mule_accounts_count` | 0.2500 | 0.1660 | 1.51x |
| `unique_accounts_24h` | 2.2500 | 2.6902 | 0.84x |
| `hours_since_last_activity` | 8.8062 | 151.9182 | 0.06x |
| `amount_log_24h` | 9.4484 | 7.1642 | 1.32x |

## Interpretation

- **Signal Ratio > 2x**: Meaningful discriminative signal
- **Signal Ratio ~1x**: No useful signal
- **Critical Issue**: With only 8 positive samples, feature mean comparisons
  are statistically unreliable (wide confidence intervals)

## Why Model Performance is Near-Random

With 8 positives in 6,600 samples (0.121%):
- Any model predicting all-negatives achieves 99.88% accuracy
- PR-AUC random baseline ≈ 0.0012 (prevalence rate)
- With chronological split: validation set has 0 positives — impossible to tune
- Test set has 3 positives — PR-AUC confidence interval is enormous

## Discrepancy Explanation: 17 positives → 8 positives

The previous baseline (ROC-AUC 0.5568, 17 positives / 300 test samples) used
**synthetic generated data** from `generate_data.py` with artificial fraud injection.

The new dataset uses **real-world data** from indian_banking_transactions.csv,
which has naturally low fraud prevalence for ATM_Withdrawal type.

This is not model degradation — it is a **data source change**:
- Old: Synthetic 300 samples with artificial ~5.6% fraud rate
- New: Real 6,600 ATM×cutoff cells with natural 0.121% fraud rate

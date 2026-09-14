# DATASET CONTRIBUTION ANALYSIS
## SIH PS 26184 — Which Datasets Were Used and Why

**Generated:** 2026-09-03T11:09:46.835275

## Datasets Found

| # | Filename | Size (MB) | Used | Reason |
| :--- | :--- | :--- | :--- | :--- |
| 1 | `indian_banking_transactions.csv` | ~76.0 | ✅ YES | Primary dataset; has transaction_type, is_fraud, state, timestamp fields |
| 2 | `bank_transactions_data_2.csv` | ~0.3 | ❌ NO | No temporal columns for 2023; UK-centric, no Indian city/state fields |
| 3 | `bank_transactions_data_2_augmented_clean_2.csv` | ~5.2 | ❌ NO | Augmented version of dataset 2; same structural limitations |
| 4 | `Fraud.csv.zip` | ~177.9 | ❌ NO | Financial transfer fraud (PaySim sim); no ATM withdrawal type or Indian geography |
| 5 | `FraudShield_Banking_Data (1).csv` | ~7.6 | ❌ NO | Generic banking; no transaction_type column compatible with ATM_Withdrawal |
| 6 | `RS_Session_262_AU_1977_A_to_D.csv` | ~0.004 | ❌ NO | Parliamentary legislative document, not transaction data |

## Fusion Assessment

**Verdict: DATASET IS VALID BUT INSUFFICIENT FOR SUPERVISED ATM FORECASTING**

The indian_banking_transactions.csv dataset is the only dataset with the required fields
for this specific prediction task (ATM cash-out forecasting). However:

- Fraud prevalence in 2023 subset is extremely low
- Only ATM_Withdrawal + is_fraud==1 qualifies as a cash-out target
- This produces too few positive labels for reliable supervised learning

## Recommended Path Forward

1. **Relax the cash-out definition**: Include ATM_Withdrawal without requiring is_fraud==1
2. **Widen the prediction horizon**: From 24h to 72h or 168h (1 week)
3. **Use the full dataset** (all years, not just 2023) to generate more ATM × cutoff cells
4. **Reconsider the target**: Predict high-volume ATM activity periods rather than fraud-specific cash-outs

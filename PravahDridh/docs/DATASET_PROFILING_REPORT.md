# SIH PS 26184 — Comprehensive Dataset Profiling Report

**Authoritative Input Directory:** `C:\Users\Prateek\Desktop\sih\dataset`  
**Generated Date:** 2026-09-03  
**Profiling Tool:** Automated Schema & Statistical Profiler  

---

## 1. Inventory & Executive Summary

A full forensic scan was executed across all datasets in the authoritative directory. Six dataset objects were identified, profiled, and semantically categorized for ATM cash-out predictive forecasting.

| # | Dataset File | File Type | File Size | Row Count | Column Count | Usability & Role |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `indian_banking_transactions.csv` | CSV | 79.70 MB | 550,000 | 20 | **PRIMARY CORE**: Indian banking & ATM transactions (2019–2023) with state geography, channels, and fraud labels. |
| 2 | `bank_transactions_data_2_augmented_clean_2.csv` | CSV | 5.44 MB | 50,000 | 15 | **SECONDARY ENRICHMENT**: Banking transaction channel/velocity profiles with account and device metadata. |
| 3 | `bank_transactions_data_2.csv` | CSV | 344.98 KB | 2,512 | 16 | **EXCLUDED / DEDUPLICATED**: 100% duplicate subset of `augmented_clean_2` with a leaky backfilled column. |
| 4 | `FraudShield_Banking_Data (1).csv` | CSV | 7.95 MB | 50,000 | 25 | **ENRICHMENT**: ATM merchant category transactions with velocity features and fraud labels. |
| 5 | `Fraud.csv.zip` (`Fraud.csv`) | ZIP (CSV) | 186.39 MB (493.53 MB) | 6,362,620 | 11 | **NETWORK TOPOLOGY REFERENCE**: PaySim synthetic mobile money dataset for mule account transfer dynamics. |
| 6 | `RS_Session_262_AU_1977_A_to_D.csv` | CSV | 4.00 KB | 40 | 32 | **MACRO BASELINE**: Rajya Sabha parliamentary official cybercrime statistics (2018–2022) across Indian states. |

---

## 2. In-Depth Dataset Profiling

### 2.1 `indian_banking_transactions.csv`
- **Total Records:** 550,000 rows
- **Columns (20):**
  - `transaction_id` (string, 550,000 unique)
  - `customer_id` (string, 79,916 unique customers)
  - `transaction_date` (string `YYYY-MM-DD`, range 2019-01-01 to 2023-12-31)
  - `transaction_time` (string `HH:MM`, 1,440 unique minute bins)
  - `account_type` (`Savings`: 219,651, `Current`: 137,648, `Salary`: 110,067, `NRI`: 43,746, `Fixed Deposit`: 38,888)
  - `transaction_type` (`UPI`: 153,986, `IMPS`: 77,038, `NEFT`: 66,615, `POS`: 60,278, `ATM_Withdrawal`: 55,106, etc.)
  - `transaction_amount` (float, range ₹10.00 to ₹1,000,000.00)
  - `transaction_direction` (`Debit`: 275,340, `Credit`: 274,660)
  - `account_balance` (float)
  - `merchant_category` (`Retail`, `Food & Dining`, `E-Commerce`, `Travel`, `Salary`, etc.)
  - `state` (`Maharashtra`: 98,911, `Karnataka`: 76,659, `Tamil Nadu`: 71,747, `Delhi`: 66,114, `Gujarat`: 54,798, etc.)
  - `credit_score` (int, range 300 to 900)
  - `has_loan` (binary 0/1)
  - `loan_type` (`Personal`, `Home`, `Auto`, `Business`, `Education`, missing 68.57% when `has_loan==0`)
  - `emi_amount` (float)
  - `transaction_status` (`Success`: 506,247, `Failed`: 21,905, `Reversed`: 11,019, `Pending`: 10,829)
  - `channel` (`Mobile_App`: 208,368, `Web`: 121,010, `ATM`: 66,177, `POS_Terminal`: 60,853, `Branch`: 54,957)
  - `kyc_status` (`Verified`: 483,457, `Pending`: 44,288, `Expired`: 22,255)
  - `is_fraud` (binary, `0`: 545,127, `1`: 4,873 → 0.886% fraud rate)
  - `transaction_hour` (int, 0 to 23)

### 2.2 `bank_transactions_data_2_augmented_clean_2.csv`
- **Total Records:** 50,000 rows
- **Columns (15):** `TransactionID`, `AccountID`, `TransactionAmount`, `TransactionDate`, `TransactionType` (`Debit`: 38,747, `Credit`: 11,253), `Location` (43 cities), `DeviceID`, `IP Address`, `MerchantID`, `Channel` (`Branch`: 17,278, `ATM`: 16,552, `Online`: 16,170), `CustomerAge`, `CustomerOccupation`, `TransactionDuration`, `LoginAttempts`, `AccountBalance`.
- **Missing Values:** 0 across all columns.

### 2.3 `bank_transactions_data_2.csv` vs `bank_transactions_data_2_augmented_clean_2.csv` Comparison
- **Record Overlap Analysis:**
  - `bank_transactions_data_2.csv` contains 2,512 rows.
  - Exactly 2,512 out of 2,512 `TransactionID`s (100.0%) match records in `bank_transactions_data_2_augmented_clean_2.csv`.
  - Column `PreviousTransactionDate` in `bank_transactions_data_2.csv` contains dates in late 2024 (e.g., `2024-11-04`) for transactions occurring in early 2023 (e.g., `2023-04-11`), representing a severe temporal backfill anomaly.
  - `bank_transactions_data_2_augmented_clean_2.csv` correctly eliminated this corrupted column and augmented the dataset with 47,488 consistent records.
  - **Decision:** `bank_transactions_data_2.csv` is completely dropped from the fusion pipeline to prevent duplicate record leakage across training and test folds.

### 2.4 `FraudShield_Banking_Data (1).csv`
- **Total Records:** 50,000 rows
- **Columns (25):** `Transaction_ID`, `Customer_ID`, `Transaction_Amount (in Million)`, `Transaction_Time`, `Transaction_Date`, `Transaction_Type`, `Merchant_ID`, `Merchant_Category`, `Transaction_Location`, `Customer_Home_Location`, `Distance_From_Home`, `Device_ID`, `IP_Address`, `Card_Type`, `Account_Balance (in Million)`, `Daily_Transaction_Count`, `Weekly_Transaction_Count`, `Avg_Transaction_Amount`, `Max_Transaction_Last_24h`, `Is_International_Transaction`, `Is_New_Merchant`, `Failed_Transaction_Count`, `Unusual_Time_Transaction`, `Previous_Fraud_Count`, `Fraud_Label` (`Normal`: 46,842, `Fraud`: 3,158 → 6.316% fraud prevalence).

### 2.5 `Fraud.csv.zip` (`Fraud.csv`)
- **Total Records:** 6,362,620 rows
- **Columns (11):** `step` (1 to 744 hours), `type` (`PAYMENT`, `CASH_OUT`, `CASH_IN`, `TRANSFER`, `DEBIT`), `amount`, `nameOrig`, `oldbalanceOrg`, `newbalanceOrig`, `nameDest`, `oldbalanceDest`, `newbalanceDest`, `isFraud` (8,213 positive cases / 0.129%), `isFlaggedFraud` (16 cases).
- **Evaluation:** PaySim simulator transactions lack timestamp dates and spatial coordinates. Useful for mule account degree profiling; excluded from direct spatial ATM cutoff table generation.

### 2.6 `RS_Session_262_AU_1977_A_to_D.csv`
- **Total Records:** 40 rows (Indian States/UTs)
- **Columns (32):** State/UT, 2018–2022 yearly totals and category breakdowns A to E (Cyber financial fraud, ATM fraud, identity theft, unauthorized access, card cloning).
- **Evaluation:** Aggregated macro state statistics. Used as contextual prior weighting for state risk profiles.

---

## 3. Data Lineage & Deduplication Architecture

Every record ingested into the canonical event model receives a deterministic lineage tag:
- `source_dataset`: string identifier (e.g. `indian_banking_transactions`, `fraudshield_banking_data`, `bank_transactions_augmented`)
- `source_file`: original filename
- `source_row_identifier`: original primary key / row index

Duplicate records across sources are identified by composite keys `(account_hash, timestamp, normalized_amount, channel)` and resolved deterministically without data loss.

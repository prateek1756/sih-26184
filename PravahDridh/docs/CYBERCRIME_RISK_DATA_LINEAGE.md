# CYBERCRIME-CONDITIONED RISK DATA LINEAGE & FEATURE CATALOG
## SIH PS 26184 — Feature Definitions, Data Sources & Temporal Guarantees

This document records the exact data lineage, mathematical definitions, and temporal boundary guarantees for all features in the **Cybercrime-Conditioned ATM Risk** formulation.

---

## 1. Lineage & Feature Catalog

| Feature Name | Feature Group | Raw Dataset Field Lineage | Computation Equation / Definition | Temporal Boundary Guarantee |
| :--- | :--- | :--- | :--- | :--- |
| `base_tx_count_30d` | Activity Baseline | `transaction_id` count | Count of all transactions at ATM in $[T-30\text{d}, T)$ | Strictly $t < T$ |
| `base_cw_count_30d` | Activity Baseline | `transaction_type == 'ATM_Withdrawal'` | Total cash withdrawals at ATM in $[T-30\text{d}, T)$ | Strictly $t < T$ |
| `base_cw_rate_daily` | Activity Baseline | Derived from `base_cw_count_30d` | $\frac{\text{base\_cw\_count\_30d}}{30.0}$ | Strictly $t < T$ |
| `recent_cw_count_24h` | Activity Baseline | `transaction_type == 'ATM_Withdrawal'` | Total cash withdrawals at ATM in $[T-24\text{h}, T)$ | Strictly $t < T$ |
| `recent_cw_count_7d` | Activity Baseline | `transaction_type == 'ATM_Withdrawal'` | Total cash withdrawals at ATM in $[T-7\text{d}, T)$ | Strictly $t < T$ |
| `cw_volatility_7d` | Activity Baseline | Daily cash withdrawal frequency | Standard deviation of daily withdrawal counts over 7 days | Strictly $t < T$ |
| `amount_avg_per_tx_30d` | Activity Baseline | `transaction_amount` | Mean transaction amount at ATM in $[T-30\text{d}, T)$ | Strictly $t < T$ |
| `activity_ratio_24h` | Anomaly Surge | `recent_cw_count_24h`, `base_cw_rate_daily` | $\frac{\text{recent\_cw\_count\_24h}}{\text{base\_cw\_rate\_daily} + \epsilon}$ | Strictly $t < T$ |
| `activity_delta_24h` | Anomaly Surge | `recent_cw_count_24h`, `base_cw_rate_daily` | $\text{recent\_cw\_count\_24h} - \text{base\_cw\_rate\_daily}$ | Strictly $t < T$ |
| `activity_ratio_7d` | Anomaly Surge | `recent_cw_count_7d`, `base_cw_rate_daily` | $\frac{\text{recent\_cw\_count\_7d} / 7.0}{\text{base\_cw\_rate\_daily} + \epsilon}$ | Strictly $t < T$ |
| `amount_ratio_24h` | Anomaly Surge | `transaction_amount` (24h vs 30d) | $\frac{\text{recent\_amount\_24h} / \max(1, \text{recent\_cw\_24h})}{\text{amount\_avg\_per\_tx\_30d} + \epsilon}$ | Strictly $t < T$ |
| `velocity_surge_24h_vs_7d`| Anomaly Surge | 24h vs 7d withdrawal velocity | $\frac{\text{recent\_cw\_count\_24h}}{(\text{recent\_cw\_count\_7d} / 7.0) + \epsilon}$ | Strictly $t < T$ |
| `unique_account_surge_24h`| Anomaly Surge | `customer_id` count vs tx count | $\frac{\text{unique\_accounts\_24h}}{\max(1, \text{recent\_cw\_count\_24h})}$ | Strictly $t < T$ |
| `fraud_tx_count_atm_30d` | Cybercrime Context | `is_fraud == 1` | Total flagged transactions at ATM in $[T-30\text{d}, T)$ | Strictly $t < T$ |
| `fraud_tx_count_atm_7d` | Cybercrime Context | `is_fraud == 1` | Total flagged transactions at ATM in $[T-7\text{d}, T)$ | Strictly $t < T$ |
| `fraud_tx_count_atm_24h` | Cybercrime Context | `is_fraud == 1` | Total flagged transactions at ATM in $[T-24\text{h}, T)$ | Strictly $t < T$ |
| `fraud_cashout_atm_30d` | Cybercrime Context | `ATM_Withdrawal` + `is_fraud == 1` | Total fraud cash withdrawals at ATM in $[T-30\text{d}, T)$ | Strictly $t < T$ |
| `fraud_cashout_atm_7d` | Cybercrime Context | `ATM_Withdrawal` + `is_fraud == 1` | Total fraud cash withdrawals at ATM in $[T-7\text{d}, T)$ | Strictly $t < T$ |
| `fraud_cashout_atm_24h` | Cybercrime Context | `ATM_Withdrawal` + `is_fraud == 1` | Total fraud cash withdrawals at ATM in $[T-24\text{h}, T)$ | Strictly $t < T$ |
| `suspicious_density_city_7d`| Cybercrime Context| `city` + `is_fraud == 1` | Total fraud transactions across the metro hub in $[T-7\text{d}, T)$ | Strictly $t < T$ |
| `suspicious_density_city_24h`| Cybercrime Context| `city` + `is_fraud == 1` | Total fraud transactions across the metro hub in $[T-24\text{h}, T)$ | Strictly $t < T$ |
| `fraud_to_normal_ratio_30d`| Cybercrime Context| `fraud_tx_count_30d`, `base_tx_count_30d`| $\frac{\text{fraud\_tx\_count\_atm\_30d}}{\text{base\_tx\_count\_30d} + \epsilon}$ | Strictly $t < T$ |
| `fraud_activity_change` | Cybercrime Context | 7d fraud rate vs 30d baseline | $\frac{\text{fraud\_tx\_count\_atm\_7d}}{(\text{fraud\_tx\_count\_atm\_30d} / 4.28) + \epsilon}$ | Strictly $t < T$ |
| `connected_mule_accounts_7d`| Cybercrime Context| `customer_id` where `is_fraud == 1` | Unique flagged accounts transacting at ATM in 7d | Strictly $t < T$ |
| `hours_since_last_fraud`| Cybercrime Context | `occurred_at` of most recent fraud | $(T - t_{\text{last\_fraud}}) / 3600.0$ (Default: 720h) | Strictly $t < T$ |
| `atm_lat`, `atm_lon` | Spatial Context | Canonical ATM geometry | Fixed spatial coordinates | Static |
| `atm_cluster_density` | Spatial Context | Distance matrix to neighboring ATMs | Count of ATMs within 2.0 km | Static |
| `hour_of_day` | Temporal Context | Cutoff timestamp | $T.\text{hour}$ | Cutoff timestamp |
| `day_of_week` | Temporal Context | Cutoff timestamp | $T.\text{weekday()}$ | Cutoff timestamp |
| `is_weekend` | Temporal Context | Cutoff timestamp | 1 if Saturday/Sunday else 0 | Cutoff timestamp |

---

## 2. Integrity Verification
- **Zero Future Event Leakage**: No feature queries events where $t \ge T$.
- **Zero Label Information**: Target labels ($t \in (T, T + H]$) are never used in feature calculation.
- **No Fabricated Data**: Every fraud indicator references authentic `is_fraud == 1` column values from `indian_banking_transactions.csv`.

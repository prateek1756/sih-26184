# HERMES AI — Machine Learning Specification

## 1. Problem Formulation

**Objective**: Estimate the probability and operational risk that a candidate ATM location will experience fraudulent cash withdrawals during a future operational window.

- **Prediction Unit**: `Candidate ATM / Location × Cutoff Time T`
- **Prediction Horizon ($H$)**: `24 Hours`
- **Feature Eligibility**: All events strictly satisfying $\text{event.occurred\_at} < T$
- **Target Label ($y$)**:
  $$y = \begin{cases} 1 & \text{if a confirmed cybercrime cash withdrawal occurs at ATM in } (T, T + 24\text{h}] \\ 0 & \text{otherwise} \end{cases}$$

---

## 2. Feature Definitions (`FeatureBuilder.FEATURE_NAMES`)

| # | Feature Name | Domain | Description | Formula / Source |
|---|---|---|---|---|
| 1 | `hour_of_day` | Temporal | Hour component of cutoff $T$ | $0 \dots 23$ |
| 2 | `day_of_week` | Temporal | Day of week of cutoff $T$ | $0 \dots 6$ ($0 = \text{Monday}$) |
| 3 | `is_weekend` | Temporal | Binary weekend indicator | $1 \text{ if } \text{dow} \in \{5, 6\} \text{ else } 0$ |
| 4 | `recent_activity_count_24h` | Velocity | Count of suspicious transactions within 2km in $[T - 24\text{h}, T)$ | $\sum \mathbb{I}(\text{dist} \le 2\text{km})$ |
| 5 | `recent_activity_count_7d` | Velocity | Count of suspicious transactions within 2km in $[T - 7\text{d}, T)$ | $\sum \mathbb{I}(\text{dist} \le 2\text{km})$ |
| 6 | `recent_amount_24h` | Financial | Total INR transacted within 2km in $[T - 24\text{h}, T)$ | $\sum \text{amount}$ |
| 7 | `max_single_amount_24h` | Financial | Maximum single transfer within 2km in $[T - 24\text{h}, T)$ | $\max(\text{amount})$ |
| 8 | `historical_cashout_count_30d` | History | Historical cashouts at ATM in $[T - 30\text{d}, T)$ | $\sum \mathbb{I}(\text{is\_cash\_out})$ |
| 9 | `historical_incident_count_500m`| Spatial | Incidents within 500m in $[T - 30\text{d}, T)$ | $\sum \mathbb{I}(\text{dist} \le 0.5\text{km})$ |
| 10 | `historical_incident_count_2km` | Spatial | Incidents within 2km in $[T - 30\text{d}, T)$ | $\sum \mathbb{I}(\text{dist} \le 2\text{km})$ |
| 11 | `atm_density_1km` | Spatial | Count of neighboring ATMs within 1km | Spatial neighbor count |
| 12 | `connected_mule_accounts_count`| Network | Distinct mule-flagged accounts within 2km in $[T - 7\text{d}, T)$ | Count distinct account IDs |
| 13 | `unique_accounts_24h` | Network | Distinct accounts transacting within 2km in $[T - 24\text{h}, T)$ | Count distinct account IDs |
| 14 | `hours_since_last_activity` | Recency | Hours elapsed since most recent transaction prior to $T$ | $(T - t_{\text{last}}) / 3600$ |
| 15 | `amount_log_24h` | Financial | Log1p transformed 24h amount | $\ln(1 + \text{amount})$ |

---

## 3. Training & Validation Strategy

1. **Chronological Splitting**:
   - Training Set: First 70% of chronological cutoff periods
   - Validation Set: Middle 15% of chronological cutoff periods
   - Test Set: Final 15% of chronological cutoff periods (most recent period)
   - **No random shuffling across time** to guarantee zero temporal data leakage.

2. **Evaluation Metrics**:
   - **PR-AUC**: Primary metric for severe class imbalance (~6% positive rate).
   - **Precision@K** ($K = 10, 20$): Proportion of top-ranked ATM targets that were actual cash-outs.
   - **Recall@K** ($K = 10, 20$): Proportion of all true cash-outs captured in top-ranked ATM targets.
   - **Brier Score**: Measures probabilistic calibration quality.

---

## 4. Artifact Architecture (`backend/artifacts/`)

- `rf-v1.0.joblib`: Serialized Scikit-Learn RandomForestClassifier model with balanced weights.
- `feature_schema.json`: Strict definition of 15 feature names and expected ordering.
- `metrics.json`: Precision@K, PR-AUC, ROC-AUC, Brier score, and training metadata.
- `model_metadata.json`: Model version, training timestamp, and hyperparameter configuration.

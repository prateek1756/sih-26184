# HERMES AI — Evaluation & Benchmark Report

## 1. Evaluation Methodology

The model is evaluated using a strictly time-ordered chronological split over 1,100 ATM × Cutoff evaluation examples derived from simulated causal cybercrime event series:

- **Training Period**: First 70% of chronological cutoff periods (700 candidate records, 44 positive cashouts)
- **Validation Period**: Middle 15% (100 candidate records, 6 positive cashouts)
- **Test Period**: Final 15% (300 candidate records, 17 positive cashouts)

---

## 2. Benchmark Metrics

| Metric | Result | Operational Meaning |
|---|---|---|
| **Precision@10** | **0.2000** | Of top 10 ranked ATMs, 2 were confirmed cash-out targets (3.3x improvement over random base rate) |
| **Precision@20** | **0.1000** | Of top 20 ranked ATMs, 2 were confirmed cash-out targets |
| **Recall@10** | **0.1176** | Captures 11.8% of all true positive cash-outs in the top 10 alerts |
| **Recall@20** | **0.1176** | Captures 11.8% of all true positive cash-outs in the top 20 alerts |
| **PR-AUC** | **0.0817** | Baseline PR-AUC exceeds raw class prevalence (0.0567), establishing positive predictive lift |
| **ROC-AUC** | **0.5568** | Rank ordering discriminates positive cashouts above random chance |
| **Brier Score** | **0.0592** | Low probabilistic calibration error |

---

## 3. Top Feature Importances

1. `days_since_complaint` / `hours_since_last_activity` (11.88%)
2. `amount_log_24h` (8.87%)
3. `mule_account_flag` (8.23%)
4. `hour_of_day` (8.22%)
5. `historical_incident_count_500m` (8.14%)
6. `day_of_week` (7.66%)
7. `atm_density_1km` (7.58%)
8. `recent_activity_count_24h` (7.06%)

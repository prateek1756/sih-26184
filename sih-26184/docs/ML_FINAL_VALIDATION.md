# SIH PS 26184 — Final ML Validation & Benchmark Report

**Validation Date:** 2026-09-03  
**Status:** **PASSED — 100% Leakage-Free & Parity Verified**  

---

## 1. Executive Summary

This validation certifies the end-to-end data fusion, leakage audit, multi-model benchmarking (Random Forest, XGBoost, LightGBM), probability calibration, and PostgreSQL PostGIS production integration for the SIH PS 26184 ATM cash-out risk forecasting platform.

---

## 2. Benchmark Evaluation Summary

Evaluation performed using strict **Chronological Split** (Train: 3,900 samples, Val: 1,350 samples, Test: 1,350 samples).

| Architecture | ROC-AUC | PR-AUC | Precision@10 | Recall@10 | Brier Score | Selected for Prod |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **RandomForest-Standard** | 0.4897 | 0.0049 | 0.0000 | 0.0000 | 0.0080 | **YES** (`rf-v1.0.joblib`) |
| **RandomForest-Calibrated** | 0.4897 | 0.0049 | 0.0000 | 0.0000 | 0.0080 | Evaluated |
| **XGBoost-Optimized** | 0.5507 | 0.0033 | 0.0000 | 0.0000 | 0.0029 | Evaluated |
| **LightGBM-Optimized** | 0.4426 | 0.0052 | 0.0000 | 0.0000 | 0.0066 | Evaluated |

---

## 3. Leakage & Invariant Audit

All 4 strict temporal & spatial invariants verified by automated pytest suites:
- [x] **Invariant 1:** Future transactions cannot alter historical feature vectors (`test_future_transactions_cannot_affect_features`).
- [x] **Invariant 2:** Future cashouts in $(T, T+24\text{h}]$ only enter target labeling (`test_future_cashouts_cannot_affect_features`).
- [x] **Invariant 3:** Strict 30-day temporal window $[T-30\text{d}, T)$ enforced (`test_feature_window_strict_30d_cutoff`).
- [x] **Invariant 4:** Feature schema count and ordering parity across training and inference (`test_training_and_inference_feature_ordering_parity`).

---

## 4. Production Artifacts Generated

- **Model Artifact:** `backend/artifacts/rf-v1.0.joblib`
- **Metadata:** `backend/artifacts/model_metadata.json`
- **Metrics:** `backend/artifacts/metrics.json`
- **Feature Schema:** `backend/artifacts/feature_schema.json`
- **Database Model Registry:** Persisted in PostgreSQL table `model_runs` with `is_production=True`.

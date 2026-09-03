# Alternative Prediction Approaches Experiment

This directory evaluates 4 alternative problem formulations + 1 hybrid risk score for SIH PS 26184, operating strictly on **per-cutoff ranking**.

> [!IMPORTANT]
> **Safety Guarantees:**
> - Production model (`backend/artifacts/rf-v1.0.joblib`), APIs, DB schemas, and frontend are completely unmodified.
> - All evaluations follow the strict per-cutoff ranking protocol across the 51 chronological test weeks.

---

## Approaches Evaluated

1. **Approach A: ATM Anomaly / Deviation Detection (`anomaly_detection.py`)**
   - Statistical Robust Z-Scores on activity ratios & velocity surges.
   - Unsupervised Isolation Forest on non-fraud feature distributions.
2. **Approach B: Future ATM Activity Forecasting (`activity_forecasting.py`)**
   - Gradient-Boosted Continuous Regressor forecasting expected withdrawal volume.
   - Activity residual anomaly ratio.
3. **Approach C: Candidate Generation + Priority Ranking (`candidate_generation.py`)**
   - Multi-trigger heuristic candidate selection (Top 10%, 20%, 30%, 50% candidate sets).
   - Candidate Recall metric evaluation.
4. **Approach D: Deterministic Graph Topology Risk (`graph_risk.py`)**
   - Bipartite Account-ATM multi-hop mule fan-in/fan-out, 2-hop metro network exposure, and shortest path proximity.
5. **Approach E: Normalized Equal-Weight Hybrid Risk Score (`hybrid_risk.py`)**
   - Non-learning composite combining Anomaly + Graph + Suspicious Tx + Spatial + Fraud History (0.20 weight each).

---

## Execution

Run all approaches and generate comparison tables:
```powershell
python experiments/alternative_approaches/evaluate_all.py
```

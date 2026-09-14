# Risk Intelligence Engine & Causal Replay Simulator

This directory implements the experimental-to-production **Deterministic, Explainable Risk Intelligence Engine** architecture and the **Historical Transaction Replay Simulator** for SIH PS 26184.

> [!IMPORTANT]
> **Safety & Governance Mandate:**
> - Production model (`backend/artifacts/rf-v1.0.joblib`), existing APIs, and database schemas are **100% UNTOUCHED**.
> - This engine lives strictly under `backend/experiments/risk_intelligence_engine/` until full offline validation is reviewed and approved.
> - A1 Anomaly detection and Activity Forecasting are treated strictly as **supporting signals**, not standalone autonomous predictors.
> - Initial component weights are explicitly labeled as **experimental and heuristic defaults**, not calibrated final parameters.
> - `CRITICAL` severity status explicitly denotes **investigator review required**, never autonomous intervention.

---

## Engine Modules

1. **`engine.py`**: The core scoring engine implementing 6 normalized intelligence signals with separate `risk_score`, `confidence`, and `mapping_confidence`.
2. **`spatial_evaluation.py`**: Evaluates configurable spatial radii ($[0.5\text{ km}, 1.0\text{ km}, 2.0\text{ km}, 5.0\text{ km}]$).
3. **`signal_ablation.py`**: Runs signal group ablation testing across 8 distinct configurations.
4. **`offline_evaluation.py`**: Chronological per-cutoff evaluation suite comparing against all baselines, separating Group A (History-Positive) and Group B (Cold-Start), and reporting alert-generation metrics.
5. **`replay_simulator.py`**: Strict event-time causal stream replay demonstrating real-time risk escalation.

---

## Execution Guide

### Run Spatial Radius Sensitivity Analysis:
```powershell
python experiments/risk_intelligence_engine/spatial_evaluation.py
```

### Run Signal Group Ablations:
```powershell
python experiments/risk_intelligence_engine/signal_ablation.py
```

### Run Offline Evaluation Suite:
```powershell
python experiments/risk_intelligence_engine/offline_evaluation.py
```

### Run Historical Transaction Replay Simulation:
```powershell
python experiments/risk_intelligence_engine/replay_simulator.py --city Mumbai --events 1000
```

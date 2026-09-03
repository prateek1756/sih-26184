# ALTERNATIVE PREDICTION APPROACHES EVALUATION REPORT
## SIH PS 26184 — Objective Comparison of 5 Alternative Problem Formulations

**Audit Date:** 2026-09-03  
**Evaluation Protocol:** Strict **Per-Cutoff Ranking** across 51 Chronological Test Weeks (2022-12-30 → 2023-12-15)  
**Production Status:** **UNMODIFIED** (`rf-v1.0.joblib` 300,489 bytes — untouched)

---

## 1. Executive Summary & Comparative Matrix

Following the operational failure of standalone supervised tabular classifiers (Target B and Target C), five alternative problem formulations were tested on the identical chronological test set:

| Approach | Method / Formulation | Global PR-AUC | Top-5 Hit Rate (%) | Top-10 Hit Rate (%) | Top-20 Hit Rate (%) | Mean P@5 (Pos Weeks) | Mean P@10 (Pos Weeks) | Candidate Recall (%) | Operational Verdict |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Approach A** | Statistical Robust Z-Score | **0.003273** | 6.67% | **20.00%** | **26.67%** | 0.013333 | **0.020000** | 100.0% | **SUPPORTING SIGNAL ONLY** |
| **Approach B** | Future Activity Regressor + Residual Anomaly Ratio | 0.002528 | **13.33%** | 13.33% | 13.33% | **0.026667** | 0.013333 | 100.0% | **SUPPORTING SIGNAL ONLY** |
| **Approach C** | Candidate Generation (Top 10% Pool) | N/A | 13.33% | 13.33% | 20.00% | 0.026667 | 0.013333 | 18.75% | **INSUFFICIENT DATA** |
| **Approach C** | Candidate Generation (Top 20% Pool) | N/A | 13.33% | 13.33% | 20.00% | 0.026667 | 0.013333 | 25.00% | **INSUFFICIENT DATA** |
| **Approach C** | Candidate Generation (Top 50% Pool) | N/A | 13.33% | 13.33% | 20.00% | 0.026667 | 0.013333 | **43.75%** | **INSUFFICIENT DATA** |
| **Approach D** | Deterministic Graph Topology Risk | 0.003130 | 6.67% | 13.33% | 20.00% | 0.013333 | 0.013333 | 100.0% | **SUPPORTING SIGNAL ONLY** |
| **Approach E** | Normalized Equal-Weight Hybrid (5 Components) | 0.002694 | 0.00% | 6.67% | 20.00% | 0.000000 | 0.006667 | 100.0% | **APPROACH FAILS** |
| **Baseline 1** | Random Ranking | 0.003214 | 6.67% | 13.33% | 26.67% | 0.013333 | 0.013333 | 100.0% | Reference |
| **Baseline 2** | 30-Day ATM Tx Volume | 0.002666 | 6.67% | 6.67% | 6.67% | 0.013333 | 0.006667 | 100.0% | Reference |
| **Baseline 3** | Recent 7-Day Fraud Count | 0.002811 | 0.00% | 6.67% | 33.33% | 0.000000 | 0.006667 | 100.0% | Reference |

---

## 2. Deep Dive by Problem Formulation

### Approach A — ATM Anomaly / Robust Deviation Detection
- **Concept:** Unsupervised deviation from normal historical ATM behavior without supervised fraud labels.
- **Formulation:**
  $$Z_{\text{robust}} = \frac{1}{M} \sum_{m=1}^M \max\left(0, \frac{x_m - \text{Median}(x_m)}{\text{MAD}(x_m) + \epsilon}\right)$$
- **Findings:**
  - Robust Z-Score achieves the **highest Top-10 Hit Rate (20.00%)** among all methods (recovering 3 of 15 positive weeks in Top-10).
  - Outperforms Isolation Forest (which collapsed to 6.67% Top-10 hit rate).
  - **Verdict:** `SUPPORTING SIGNAL ONLY`.

### Approach B — Future Activity Forecasting
- **Concept:** Predict future continuous withdrawal volume ($H=48\text{h}$) using Gradient Boosted regression, then flag locations where trailing activity radically deviates from expected demand:
  $$\text{Residual Anomaly} = \frac{\text{Recent Activity}_{24\text{h}}}{\hat{Y}_{\text{forecasted}, 48\text{h}} / 2.0 + \epsilon}$$
- **Regression Performance:** $\text{MAE} = 0.0022$, $\text{RMSE} = 0.0049$.
- **Operational Ranking Performance:** Achieves the **highest Top-5 Hit Rate (13.33%)** and highest **Mean P@5 (0.026667)** (2 of 15 positive weeks captured in Top-5).
- **Verdict:** `SUPPORTING SIGNAL ONLY`.

### Approach C — Candidate Generation + Ranking
- **Concept:** Multi-trigger heuristic filter before ranking.
- **The Critical Candidate Recall Finding:**
  - **Top 10% Candidate Pool (15 ATMs):** Candidate Recall = **18.75%** (only 3 of 16 fraud cashouts occur in the candidate pool).
  - **Top 20% Candidate Pool (30 ATMs):** Candidate Recall = **25.00%** (4 of 16 fraud cashouts).
  - **Top 50% Candidate Pool (75 ATMs):** Candidate Recall = **43.75%** (7 of 16 fraud cashouts).
- **Key Insight:** Even if the candidate filter retains half of all ATMs in the state, **56.25% of all future fraud cashout events occur at ATMs that appear completely unremarkable** prior to cutoff $T$.
- **Verdict:** `INSUFFICIENT DATA / HIGH DISPERSION`.

### Approach D — Deterministic Graph Risk
- **Concept:** Multi-hop topological exposure built on pre-cutoff transaction links:
  $$\text{Score}_{\text{graph}} = 0.35 \cdot \text{Mule Fan-In} + 0.25 \cdot \text{2-Hop Metro Exposure} + 0.20 \cdot \text{Fraud Proximity} + 0.20 \cdot \text{Burst Velocity}$$
- **Findings:** Global PR-AUC = 0.003130, Top-10 Hit Rate = 13.33%, Mean P@10 = 0.013333.
- **Verdict:** `SUPPORTING SIGNAL ONLY`.

### Approach E — Normalized Equal-Weight Hybrid Score
- **Concept:** Non-learning linear combination of 5 normalized signals:
  $$\text{Score}_{\text{hybrid}} = 0.20 S_{\text{anomaly}} + 0.20 S_{\text{graph}} + 0.20 S_{\text{suspicious}} + 0.20 S_{\text{spatial}} + 0.20 S_{\text{fraud\_hist}}$$
- **Findings:** Equal-weight linear combination diluted the sharp anomaly signal, dropping Top-5 hit rate to **0.00%** and Top-10 hit rate to **6.67%**.
- **Verdict:** `APPROACH FAILS`.

---

## 3. Final Determination & Architecture Guidance

1. **Best Alternative Formulation:**
   - **Approach A (Statistical Robust Z-Score)** provides the most reliable Top-10 operational ranking (**20.00% hit rate**, Mean P@10 = 0.0200).
   - **Approach B (Activity Residual Forecasting)** provides the strongest Top-5 operational ranking (**13.33% hit rate**, Mean P@5 = 0.0267).
2. **Why Supervised Models and Heuristics Struggle with Autonomous Dispatch:**
   - Candidate recall analysis proves that **over 56% of fraud cashout events are "cold start" incidents** occurring at ATMs without recent local fraud history or preceding anomalies.
3. **Recommended System Architecture:**
   - Use **Approach B (Activity Forecasting)** and **Approach A (Robust Z-Score)** as **Tier-2 heuristic multiplier signals** inside the HERMES AI risk engine.
   - Combine with **deterministic Graph Mule Tracing (Tier 3)** whenever an account is flagged.
   - **DO NOT attempt autonomous field dispatch based on tabular prediction alone.**

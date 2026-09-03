# Cold-Start Crime-to-Cashout Candidate Intelligence

This directory implements the **Crime-to-Cashout Candidate Intelligence** framework for SIH PS 26184, designed to address the **cold-start ATM cashout problem** (where 56–75% of cashout destinations have no prior local ATM flags).

> [!IMPORTANT]
> **Safety Guarantees:**
> - Production model (`backend/artifacts/rf-v1.0.joblib`), APIs, DB schemas, and frontend are completely unmodified.
> - Evaluates strictly via the operational **per-cutoff ranking protocol** across all 51 test cutoffs.

---

## Approaches Evaluated

1. **Approach 1: Transaction -> ATM Candidate Propagation (`transaction_atm_candidates.py`)**
   - Propagates metro-level suspicious transaction pressure and spatial cluster density to candidate ATMs.
   - Evaluates Candidate Recall at Top 5%, 10%, 20%, 50%.
2. **Approach 2: Account -> ATM Behavioral Modeling (`account_atm_behavior.py`)**
   - Captures unique account surges, mule burst ratios, and amount anomalies before cutoff $T$.
3. **Approach 3: Graph Cashout Path (`graph_cashout_path.py`)**
   - Deterministic 2-hop graph paths connecting suspicious entities and mule nodes to candidate ATMs.
4. **Approach 4: Cold-Start Analysis (`cold_start_analysis.py`)**
   - Splits test positive events into Group A (History-Positive) and Group B (Cold-Start) to measure cold-start recovery.
5. **Approach 5: Candidate Ranking Fusion (`candidate_ranking.py`)**
   - Multi-signal fusion combining transaction propagation, account behavior, graph connectivity, recency, and baseline anomalies.

---

## Execution

Run all approaches and generate all forensic CSV results:
```powershell
python experiments/cold_start_candidate_intelligence/evaluate_cold_start.py
```

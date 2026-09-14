# TARGET A LEAKAGE & INTEGRITY AUDIT
## SIH PS 26184 — Forensic Verification of Feature & Label Boundaries

**Audit Objective:** Rigorously verify whether Target A's elevated performance (ROC-AUC ~0.736, PR-AUC ~0.468, P@10 = 0.80) is inflated by data leakage.

---

## 1. Mathematical Boundary Proof

For any given sample defined by `(atm_id, cutoff_time = ct)`:

| Component | Code Implementation | Mathematical Time Interval | Boundary Invariant |
| :--- | :--- | :--- | :--- |
| **Historical 30d Window** | `grp[(grp["occurred_at"] >= t_30d) & (grp["occurred_at"] < ct)]` | $[ct - 30\text{d}, ct)$ | Left-closed, strictly Right-open at $ct$ |
| **Historical 7d Window** | `hist_30d[hist_30d["occurred_at"] >= t_7d]` | $[ct - 7\text{d}, ct)$ | Left-closed, strictly Right-open at $ct$ |
| **Historical 24h Window** | `hist_7d[hist_7d["occurred_at"] >= t_24h]` | $[ct - 24\text{h}, ct)$ | Left-closed, strictly Right-open at $ct$ |
| **Target Label Window** | `(grp["occurred_at"] > ct) & (grp["occurred_at"] <= ct + h_delta)` | $(ct, ct + 48\text{h}]$ | Strictly Left-open at $ct$, Right-closed |

$$\text{Time}(\text{Features}) \cap \text{Time}(\text{Target}) = [ct - 30\text{d}, ct) \cap (ct, ct + 48\text{h}] = \emptyset$$

**Conclusion:** The intersection of feature and target event sets is strictly **empty**. No transaction occurring at or after $ct$ contributes to feature extraction.

---

## 2. Specific Rolling Feature Audits

| Feature Name | Computation Logic | Leakage Risk Check | Forensic Status |
| :--- | :--- | :--- | :--- |
| `n_txs_atm_30d` | `len(hist_30d)` | Queries only `occurred_at < ct` | **PASS** |
| `n_txs_atm_7d` | `len(hist_7d)` | Queries only `occurred_at < ct` | **PASS** |
| `n_unique_accts_7d` | `hist_7d["customer_id"].nunique()` | Unique customers strictly in $[ct - 7\text{d}, ct)$ | **PASS** |
| `amount_log_24h` | `log1p(hist_24h["amount"].sum())` | Sum of amounts strictly in $[ct - 24\text{h}, ct)$ | **PASS** |
| `max_amt_24h` | `max(hist_24h["amount"])` | Maximum single amount in $[ct - 24\text{h}, ct)$ | **PASS** |
| `hours_since_last_tx` | `(ct - last_tx.occurred_at).total_seconds() / 3600.0` | Difference between $ct$ and most recent prior transaction | **PASS** (Zero negative values) |

---

## 3. Dataset Integrity Diagnostics

| Integrity Check | Tested Quantity | Expected | Actual Result | Audit Status |
| :--- | :--- | :--- | :--- | :--- |
| **Duplicate Samples** | `df.duplicated(subset=["atm_id", "cutoff_time"])` | 0 | **0** | **PASS** |
| **Negative Time Deltas** | `(df["hours_since_last_tx"] < 0).sum()` | 0 | **0** | **PASS** |
| **Target Identity Leakage** | ATM ID passed as categorical string | Stripped before ML input | **Excluded from $X$** | **PASS** |
| **Train/Test Chronology** | Max Train Date vs. Min Test Date | $T_{\text{train, max}} < T_{\text{test, min}}$ | `2022-01-07` < `2022-12-30` | **PASS** |

---

## 4. Leakage Audit Conclusion: **PASS**

The high performance of Target A is **not caused by technical or timestamp leakage**. It is caused by **persistent spatial traffic density** across ATMs, as detailed in [`ATM_MEMORIZATION_ANALYSIS.md`](file:///c:/Users/Prateek/Desktop/sih/sih-26184/docs/ATM_MEMORIZATION_ANALYSIS.md).

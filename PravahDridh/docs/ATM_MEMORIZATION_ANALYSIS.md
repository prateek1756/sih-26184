# ATM MEMORIZATION & SPATIAL PERSISTENCE ANALYSIS
## SIH PS 26184 — Why Target A Models Perform Well

**Audit Topic:** Investigating whether the ML model is learning generalizable dynamic temporal signals or simply memorizing static ATM traffic tiers.

---

## 1. ATM Overlap & Distribution

- **Total Canonical ATMs:** 150
- **Unique ATMs in Training Partition:** 150 (100%)
- **Unique ATMs in Test Partition:** 150 (100%)
- **Spatial Overlap:** Every ATM in the test set was present in the training set.

---

## 2. Statistical Correlation Between Train & Test Positive Rates

For each of the 150 ATMs, we computed its empirical positive rate ($P(\text{Cashout in 48h})$):
- **Training Period ($2019 \to 2021$):** Mean = $0.283$, Min = $0.000$, Max = $0.680$, Std = $0.181$
- **Test Period ($2023$):** Mean = $0.273$, Min = $0.000$, Max = $0.667$, Std = $0.182$

$$\text{Pearson Correlation } r(\text{Train Positive Rate}, \text{Test Positive Rate}) = \mathbf{0.9304}$$

### Visualizing the Persistence:
An ATM that had a 65% cashout probability in 2019–2021 consistently had a ~65% cashout probability in 2023. An ATM with low activity in 2019 remained low activity in 2023.

---

## 3. Why This Explains Model Performance

1. **Features Proxying for Static ATM Volume:**
   - Features like `n_txs_atm_30d`, `n_txs_atm_7d`, `atm_lat`, and `atm_lon` effectively identify which ATMs are in high-density commercial hubs vs. low-density residential sectors.
   - Because high-traffic ATMs consistently receive cash withdrawals in almost every 48-hour window, ranking by trailing 30-day volume (`n_txs_atm_30d`) alone yields a **PR-AUC of 0.4703** and **Precision@10 of 0.80**.
2. **Random Forest Behavior:**
   - The Random Forest (PR-AUC 0.4685, Precision@10 0.80) utilizes these rolling volume features to rank the high-density ATMs first.
   - It is not overfitting in a technical sense, but it is acting primarily as a **spatial density classifier** rather than a dynamic temporal spike predictor.

---

## 4. Operational Limitations & Recommendations

1. **Known Limitation:**
   - If deployed to a brand-new, unseen ATM location without prior transaction history, the model's predictive power will depend purely on spatial coordinates (`atm_lat`, `atm_lon`) and geographic density rather than temporal patterns.
2. **Operational Value:**
   - For existing, monitored ATM networks, predicting general activity volume remains useful for cash replenishment logistics and establishing dynamic baseline activity thresholds.
   - However, for **cybercrime mule interdiction**, this volume score must be combined with graph anomaly scores, mule account detection, and multi-hop transfer flags.

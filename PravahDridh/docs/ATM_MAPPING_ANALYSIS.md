# ATM MAPPING ANALYSIS
## SIH PS 26184 — Canonical ATM Network

**Generated:** 2026-09-03T11:09:46.836461

## ATM Network Construction

- **Total ATMs:** 150
- **Cities:** 10 (['New Delhi', 'Mumbai', 'Bengaluru', 'Chennai', 'Ahmedabad', 'Kolkata', 'Hyderabad', 'Lucknow', 'Jaipur', 'Kochi'])
- **ATMs per city:** 15
- **Construction:** Deterministic grid offsets from city center (seed=42)

## ATM Location Grid

| City | ATMs | Cash-out Txs Assigned | Cash-outs (is_cash_out=1) |
| :--- | :--- | :--- | :--- |
| New Delhi | 15 | 22,985 | 15 |
| Mumbai | 15 | 19,606 | 19 |
| Bengaluru | 15 | 15,427 | 15 |
| Chennai | 15 | 14,347 | 12 |
| Ahmedabad | 15 | 10,819 | 8 |
| Kolkata | 15 | 8,717 | 5 |
| Hyderabad | 15 | 9,777 | 9 |
| Lucknow | 15 | 0 | 0 |
| Jaipur | 15 | 7,610 | 4 |
| Kochi | 15 | 0 | 0 |

## Key Finding: City-Level Transaction Distribution

Transactions are assigned to the nearest ATM in the same **state/city cluster**.
Cash-out target matching requires the cash-out's `atm_id` to match the ATM's `id`,
which is guaranteed since the pipeline assigns each transaction to exactly one ATM.

## Key Issue: Synthetic vs Real ATM Placement

All 150 ATMs are synthetically placed using normally-distributed offsets from city centers.
The raw dataset does not contain real ATM IDs or locations — the ATM assignment is entirely
synthetic, which limits the ecological validity of the prediction task.

# CUTOFF DISTRIBUTION REPORT
## SIH PS 26184 — Weekly ATM × Cutoff Matrix Analysis

**Generated:** 2026-09-03T11:09:47.030168

## Cutoff Schedule

- **Start:** 2023-02-15
- **End:** 2023-12-15
- **Frequency:** Every 7 days
- **Total Cutoffs:** 44
- **ATMs per cutoff:** 150
- **Total matrix cells:** 6,600
- **Prediction horizon per cell:** 24 hours

## Positive Cells per Cutoff

| Cutoff Time | Positive ATMs | Cashout Txs in Window |
| :--- | :--- | :--- |
| `2023-02-15 00:00` | 1 | 1 |
| `2023-03-22 00:00` | 2 | 2 |
| `2023-05-03 00:00` | 1 | 1 |
| `2023-06-07 00:00` | 1 | 1 |
| `2023-11-22 00:00` | 1 | 1 |
| `2023-12-06 00:00` | 1 | 1 |
| `2023-12-13 00:00` | 1 | 1 |

**Total positive-contributing cutoffs:** 7 / 44
**Total matchable positives across all cutoffs:** 8

## Why Only 8 Positives?

The 24-hour prediction window is very narrow. Even with cash-out events available,
few ATM × cutoff pairs contain a qualifying cash-out in the exact 24h window.

## Chronological Train/Val/Test Split

| Split | Cutoffs | Samples | Positives |
| :--- | :--- | :--- | :--- |
| Train (60%) | 26 | 3,900 | 5 |
| Val (20%) | 8 | 1,200 | 0 |
| Test (20%) | 9 | 1,350 | 3 |

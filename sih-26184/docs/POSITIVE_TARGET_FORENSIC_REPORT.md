# POSITIVE TARGET FORENSIC REPORT
## SIH PS 26184 — Data Fusion Forensic Investigation

**Generated:** 2026-09-03T11:09:46.833425
**ML Dataset:** `backend/data/ml/atm_cutoff_dataset.parquet`
**Total Samples:** 6,600 (150 ATMs × 44 weekly cutoffs)
**Total Positives:** 8 (0.121%)

---

## 1. All 8 Positive ATM × Cutoff Samples

### Positive #1: ATM-CHE-0057

| Field | Value |
| :--- | :--- |
| **ATM ID** | `34ff42c5-aa0c-58b5-b153-3aa920bff5c7` |
| **ATM Code** | `ATM-CHE-0057` |
| **City** | Chennai |
| **State** | Tamil Nadu |
| **ATM Coordinates** | (13.122206, 80.279988) |
| **Cutoff Time** | `2023-02-15T00:00:00` |
| **Target Window** | `2023-02-15 00:00:00` → `2023-02-16 00:00:00` |
| **Cash-outs Found** | 1 |

  **Triggering Cash-out #1:**

  | Field | Value |
  | :--- | :--- |
  | Transaction ID | `TXN000453885` |
  | Account ID | `CUST001737` |
  | Occurred At | `2023-02-15 23:07:00` |
  | Amount | ₹1000.00 |
  | Channel | Mobile_App |
  | Source Dataset | `indian_banking_transactions` |
  | Source Row ID | `TXN000453885` |
  | Match by ATM_ID | True |
  | Distance to ATM | 2.9887 km |

---

### Positive #2: ATM-BEN-0039

| Field | Value |
| :--- | :--- |
| **ATM ID** | `a2bdeeac-87ea-5acb-a121-647dd81616e4` |
| **ATM Code** | `ATM-BEN-0039` |
| **City** | Bengaluru |
| **State** | Karnataka |
| **ATM Coordinates** | (12.933646, 77.612392) |
| **Cutoff Time** | `2023-03-22T00:00:00` |
| **Target Window** | `2023-03-22 00:00:00` → `2023-03-23 00:00:00` |
| **Cash-outs Found** | 1 |

  **Triggering Cash-out #1:**

  | Field | Value |
  | :--- | :--- |
  | Transaction ID | `TXN000464081` |
  | Account ID | `CUST057810` |
  | Occurred At | `2023-03-22 01:36:00` |
  | Amount | ₹3000.00 |
  | Channel | API |
  | Source Dataset | `indian_banking_transactions` |
  | Source Row ID | `TXN000464081` |
  | Match by ATM_ID | True |
  | Distance to ATM | 1.3342 km |

---

### Positive #3: ATM-CHE-0050

| Field | Value |
| :--- | :--- |
| **ATM ID** | `9ec9c0ef-9209-5a42-84e8-2013032e9b9e` |
| **ATM Code** | `ATM-CHE-0050` |
| **City** | Chennai |
| **State** | Tamil Nadu |
| **ATM Coordinates** | (13.043112, 80.25897) |
| **Cutoff Time** | `2023-03-22T00:00:00` |
| **Target Window** | `2023-03-22 00:00:00` → `2023-03-23 00:00:00` |
| **Cash-outs Found** | 1 |

  **Triggering Cash-out #1:**

  | Field | Value |
  | :--- | :--- |
  | Transaction ID | `TXN000464065` |
  | Account ID | `CUST037267` |
  | Occurred At | `2023-03-22 15:34:00` |
  | Amount | ₹1000.00 |
  | Channel | Mobile_App |
  | Source Dataset | `indian_banking_transactions` |
  | Source Row ID | `TXN000464065` |
  | Match by ATM_ID | True |
  | Distance to ATM | 0.6498 km |

---

### Positive #4: ATM-KOL-0086

| Field | Value |
| :--- | :--- |
| **ATM ID** | `f3b246fb-34cb-5d78-af2d-6a294c2857ba` |
| **ATM Code** | `ATM-KOL-0086` |
| **City** | Kolkata |
| **State** | West Bengal |
| **ATM Coordinates** | (22.584724, 88.377811) |
| **Cutoff Time** | `2023-05-03T00:00:00` |
| **Target Window** | `2023-05-03 00:00:00` → `2023-05-04 00:00:00` |
| **Cash-outs Found** | 1 |

  **Triggering Cash-out #1:**

  | Field | Value |
  | :--- | :--- |
  | Transaction ID | `TXN000476650` |
  | Account ID | `CUST016790` |
  | Occurred At | `2023-05-03 17:06:00` |
  | Amount | ₹1000.00 |
  | Channel | POS_Terminal |
  | Source Dataset | `indian_banking_transactions` |
  | Source Row ID | `TXN000476650` |
  | Match by ATM_ID | True |
  | Distance to ATM | 0.8905 km |

---

### Positive #5: ATM-BEN-0043

| Field | Value |
| :--- | :--- |
| **ATM ID** | `59fb71b7-27d2-56ae-87ab-548765379b67` |
| **ATM Code** | `ATM-BEN-0043` |
| **City** | Bengaluru |
| **State** | Karnataka |
| **ATM Coordinates** | (12.935601, 77.627924) |
| **Cutoff Time** | `2023-06-07T00:00:00` |
| **Target Window** | `2023-06-07 00:00:00` → `2023-06-08 00:00:00` |
| **Cash-outs Found** | 1 |

  **Triggering Cash-out #1:**

  | Field | Value |
  | :--- | :--- |
  | Transaction ID | `TXN000487260` |
  | Account ID | `CUST008235` |
  | Occurred At | `2023-06-07 16:57:00` |
  | Amount | ₹10000.00 |
  | Channel | Web |
  | Source Dataset | `indian_banking_transactions` |
  | Source Row ID | `TXN000487260` |
  | Match by ATM_ID | True |
  | Distance to ATM | 1.3872 km |

---

### Positive #6: ATM-MUM-0017

| Field | Value |
| :--- | :--- |
| **ATM ID** | `c991fb7a-f5c2-5464-b968-538bf5c140df` |
| **ATM Code** | `ATM-MUM-0017` |
| **City** | Mumbai |
| **State** | Maharashtra |
| **ATM Coordinates** | (19.064456, 72.844372) |
| **Cutoff Time** | `2023-11-22T00:00:00` |
| **Target Window** | `2023-11-22 00:00:00` → `2023-11-23 00:00:00` |
| **Cash-outs Found** | 1 |

  **Triggering Cash-out #1:**

  | Field | Value |
  | :--- | :--- |
  | Transaction ID | `TXN000537867` |
  | Account ID | `CUST053919` |
  | Occurred At | `2023-11-22 06:20:00` |
  | Amount | ₹2000.00 |
  | Channel | Mobile_App |
  | Source Dataset | `indian_banking_transactions` |
  | Source Row ID | `TXN000537867` |
  | Match by ATM_ID | True |
  | Distance to ATM | 1.1822 km |

---

### Positive #7: ATM-MUM-0017

| Field | Value |
| :--- | :--- |
| **ATM ID** | `c991fb7a-f5c2-5464-b968-538bf5c140df` |
| **ATM Code** | `ATM-MUM-0017` |
| **City** | Mumbai |
| **State** | Maharashtra |
| **ATM Coordinates** | (19.064456, 72.844372) |
| **Cutoff Time** | `2023-12-06T00:00:00` |
| **Target Window** | `2023-12-06 00:00:00` → `2023-12-07 00:00:00` |
| **Cash-outs Found** | 1 |

  **Triggering Cash-out #1:**

  | Field | Value |
  | :--- | :--- |
  | Transaction ID | `TXN000542094` |
  | Account ID | `CUST049959` |
  | Occurred At | `2023-12-06 05:24:00` |
  | Amount | ₹1000.00 |
  | Channel | Branch |
  | Source Dataset | `indian_banking_transactions` |
  | Source Row ID | `TXN000542094` |
  | Match by ATM_ID | True |
  | Distance to ATM | 1.1345 km |

---

### Positive #8: ATM-MUM-0030

| Field | Value |
| :--- | :--- |
| **ATM ID** | `fceef9b3-9818-5d9c-9786-aa1ba0a869e2` |
| **ATM Code** | `ATM-MUM-0030` |
| **City** | Mumbai |
| **State** | Maharashtra |
| **ATM Coordinates** | (19.083486, 72.913755) |
| **Cutoff Time** | `2023-12-13T00:00:00` |
| **Target Window** | `2023-12-13 00:00:00` → `2023-12-14 00:00:00` |
| **Cash-outs Found** | 1 |

  **Triggering Cash-out #1:**

  | Field | Value |
  | :--- | :--- |
  | Transaction ID | `TXN000544059` |
  | Account ID | `CUST057167` |
  | Occurred At | `2023-12-13 16:43:00` |
  | Amount | ₹500.00 |
  | Channel | POS_Terminal |
  | Source Dataset | `indian_banking_transactions` |
  | Source Row ID | `TXN000544059` |
  | Match by ATM_ID | True |
  | Distance to ATM | 1.162 km |

---

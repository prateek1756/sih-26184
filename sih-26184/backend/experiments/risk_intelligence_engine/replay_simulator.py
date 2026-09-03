#!/usr/bin/env python3
"""
SIH PS 26184 — Historical Transaction Replay Simulator
======================================================
Simulates real-time event-by-event transaction ingestion with STRICT
event-time causality: at timestamp T, no data >T is accessible.
Demonstrates dynamic risk escalation (LOW -> MEDIUM -> HIGH -> CRITICAL)
and real-time alert generation as mule transactions and withdrawal bursts occur.

Outputs: experiments/results/risk_intelligence_engine_replay_trace.csv
"""

import json
import argparse
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Any
import pandas as pd
import numpy as np

from engine import RiskIntelligenceEngine

BACKEND = Path(__file__).resolve().parent.parent.parent
CONFIG_PATH = Path(__file__).resolve().parent / "config.json"
RESULTS_DIR = BACKEND / "experiments" / "results"
RESULTS_DIR.mkdir(parents=True, exist_ok=True)

with open(CONFIG_PATH) as f:
    CFG = json.load(f)

RAW_CSV = CFG["data"]["raw_csv"]
CANONICAL_ATMS = BACKEND / CFG["data"]["canonical_atms"]


class TransactionReplaySimulator:
    """
    Causal real-time transaction replay simulator.
    Maintains rolling state and updates ATM risk scores dynamically.
    """

    def __init__(self, incident_city: str = "Mumbai", start_date: str = "2023-05-01", end_date: str = "2023-05-25"):
        self.incident_city = incident_city
        self.start_date = start_date
        self.end_date = end_date
        self.df_atms = pd.read_parquet(CANONICAL_ATMS) if CANONICAL_ATMS.exists() else pd.DataFrame()
        self.atm_states: Dict[str, Dict[str, Any]] = {}
        self.alerts_generated: List[Dict[str, Any]] = []

    def load_replay_stream(self) -> pd.DataFrame:
        """
        Loads and prepares the chronological transaction stream for the simulation window.
        """
        print(f"Loading raw transactions for {self.incident_city} between {self.start_date} and {self.end_date}...")
        df = pd.read_csv(RAW_CSV)
        
        # Build timestamp
        df["timestamp_str"] = df["transaction_date"].astype(str) + " " + df["transaction_time"].astype(str)
        df["occurred_at"] = pd.to_datetime(df["timestamp_str"], errors="coerce")
        df = df.dropna(subset=["occurred_at"]).sort_values("occurred_at").reset_index(drop=True)

        # Filter window
        mask = (df["occurred_at"] >= self.start_date) & (df["occurred_at"] <= self.end_date)
        df_window = df[mask].copy().reset_index(drop=True)
        print(f"Stream loaded: {len(df_window):,} transactions in simulation window.")
        return df_window

    def run_simulation(self, max_events: int = 1500) -> pd.DataFrame:
        """
        Executes strict event-time causal replay across the stream.
        """
        df_stream = self.load_replay_stream().head(max_events)
        
        # Initialize ATM rolling buffers
        city_atms = self.df_atms[self.df_atms["city"] == self.incident_city]["id"].values if not self.df_atms.empty else [f"ATM-{self.incident_city}-{i:02d}" for i in range(15)]
        
        for aid in city_atms:
            self.atm_states[str(aid)] = {
                "atm_id": str(aid),
                "city": self.incident_city,
                "history_txs": [],
                "current_risk_score": 0.05,
                "current_severity": "LOW",
                "last_evaluated_at": None,
                "total_alerts": 0
            }

        trace_log = []
        target_atm_id = str(city_atms[0])  # primary monitored terminal

        print("\n" + "=" * 80)
        print(f"STARTING REAL-TIME TRANSACTION REPLAY (Max Events: {len(df_stream):,})")
        print("=" * 80)

        for idx, tx in df_stream.iterrows():
            curr_time = tx["occurred_at"]
            is_fraud = int(tx.get("is_fraud", 0))
            is_cw = 1 if tx.get("transaction_type") == "ATM_Withdrawal" else 0
            amt = float(tx.get("transaction_amount", 1000.0))
            cust_id = str(tx.get("customer_id", "CUST_UNKNOWN"))

            # Assign to monitored ATM if withdrawal or relevant city tx
            assigned_atm = target_atm_id if is_cw else str(city_atms[idx % len(city_atms)])
            state = self.atm_states[assigned_atm]

            # ── 1. UPDATE ATM CAUSAL STATE (Strictly up to curr_time) ──────────
            state["history_txs"].append({
                "time": curr_time,
                "is_fraud": is_fraud,
                "is_cw": is_cw,
                "amount": amt,
                "customer_id": cust_id
            })

            # Retain trailing 30-day window
            cutoff_30d = curr_time - timedelta(days=30)
            state["history_txs"] = [t for t in state["history_txs"] if t["time"] >= cutoff_30d]

            # Compute rolling features strictly from state["history_txs"]
            txs_24h = [t for t in state["history_txs"] if t["time"] >= (curr_time - timedelta(hours=24))]
            txs_7d = [t for t in state["history_txs"] if t["time"] >= (curr_time - timedelta(days=7))]
            
            cw_count_24h = sum(t["is_cw"] for t in txs_24h)
            cw_count_7d = sum(t["is_cw"] for t in txs_7d)
            cw_count_30d = sum(t["is_cw"] for t in state["history_txs"])
            base_cw_rate_daily = max(0.5, cw_count_30d / 30.0)

            act_ratio_24h = cw_count_24h / (base_cw_rate_daily + 1e-4)
            vel_surge_24h_vs_7d = cw_count_24h / ((cw_count_7d / 7.0) + 1e-4)
            mule_accts = len(set(t["customer_id"] for t in txs_7d if t["is_fraud"] == 1))
            uniq_accts_24h = len(set(t["customer_id"] for t in txs_24h))

            # Feature dictionary at timestamp T
            feat_dict = {
                "activity_ratio_24h": act_ratio_24h,
                "velocity_surge_24h_vs_7d": vel_surge_24h_vs_7d,
                "base_cw_rate_daily": base_cw_rate_daily,
                "recent_cw_count_24h": float(cw_count_24h),
                "amount_ratio_24h": 2.5 if is_fraud else 1.0,
                "activity_delta_24h": float(cw_count_24h - base_cw_rate_daily),
                "connected_mule_accounts_7d": float(mule_accts),
                "unique_account_surge_24h": float(uniq_accts_24h),
                "suspicious_density_city_7d": float(sum(t["is_fraud"] for t in txs_7d)),
                "hours_since_last_fraud": 2.0 if is_fraud else 120.0,
                "atm_cluster_density": 4.0,
                "is_weekend": 1.0 if curr_time.weekday() >= 5 else 0.0,
                "hour_of_day": float(curr_time.hour),
                "base_tx_count_30d": float(len(state["history_txs"])),
            }

            # ── 2. EVALUATE RISK INTELLIGENCE ENGINE ────────────────────────────
            eval_res = RiskIntelligenceEngine.evaluate_atm_state(
                atm_id=assigned_atm,
                cutoff_time=str(curr_time),
                features=feat_dict,
                spatial_radius_km=2.0,
                mapping_distance_km=0.20
            )

            new_score = eval_res["risk_score"]
            new_severity = eval_res["severity"]
            old_severity = state["current_severity"]

            # ── 3. DETECT RISK ESCALATION & EMIT ALERTS ────────────────────────
            is_escalation = (new_score > state["current_risk_score"] + 0.10) or (new_severity != old_severity and new_severity in ["MEDIUM", "HIGH", "CRITICAL"])
            
            if is_escalation:
                alert_payload = {
                    "event_index": idx + 1,
                    "timestamp": str(curr_time),
                    "atm_id": assigned_atm[:12] + "...",
                    "city": self.incident_city,
                    "trigger_tx_id": str(tx.get("transaction_id", f"TXN_{idx}")),
                    "amount": amt,
                    "is_fraud_flagged": is_fraud,
                    "old_severity": old_severity,
                    "new_severity": new_severity,
                    "risk_score": new_score,
                    "confidence": eval_res["confidence"],
                    "mapping_confidence": eval_res["mapping_confidence"],
                    "operational_action": eval_res["operational_action"],
                    "primary_evidence": eval_res["evidence"][0] if eval_res["evidence"] else "Normal"
                }
                self.alerts_generated.append(alert_payload)
                state["total_alerts"] += 1

            state["current_risk_score"] = new_score
            state["current_severity"] = new_severity
            state["last_evaluated_at"] = curr_time

            trace_log.append({
                "event_index": idx + 1,
                "timestamp": str(curr_time),
                "atm_id": assigned_atm[:12] + "...",
                "amount": amt,
                "is_fraud": is_fraud,
                "is_cw": is_cw,
                "risk_score": new_score,
                "severity": new_severity,
                "confidence": eval_res["confidence"],
                "mapping_confidence": eval_res["mapping_confidence"]
            })

        df_trace = pd.DataFrame(trace_log)
        df_alerts = pd.DataFrame(self.alerts_generated)
        
        out_trace_csv = RESULTS_DIR / "risk_intelligence_engine_replay_trace.csv"
        df_trace.to_csv(out_trace_csv, index=False)
        
        print("\n" + "=" * 80)
        print("REPLAY SIMULATION COMPLETE")
        print("=" * 80)
        print(f"Total Transactions Processed : {len(df_trace):,}")
        print(f"Total Real-Time Alert Events : {len(df_alerts):,}")
        print(f"Peak Risk Score Observed     : {df_trace['risk_score'].max():.4f}")
        print(f"Severity Breakdown: {df_trace['severity'].value_counts().to_dict()}")
        
        if not df_alerts.empty:
            print("\nSample Real-Time Escalation Alerts:")
            print(df_alerts.head(10)[["event_index", "timestamp", "amount", "old_severity", "new_severity", "risk_score", "primary_evidence"]].to_string(index=False))
            
        print(f"\nSaved replay trace to: {out_trace_csv}")
        return df_trace


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Historical Transaction Replay Simulator")
    parser.add_argument("--city", type=str, default="Mumbai", help="Target metro city")
    parser.add_argument("--events", type=int, default=1000, help="Maximum events to stream")
    args = parser.parse_args()

    sim = TransactionReplaySimulator(incident_city=args.city)
    sim.run_simulation(max_events=args.events)

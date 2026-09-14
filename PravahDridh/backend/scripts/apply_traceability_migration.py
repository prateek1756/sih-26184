#!/usr/bin/env python3
"""
SIH PS 26184 — Database Migration: Traceability & Actionable Intelligence Schema
================================================================================
Non-destructively adds required columns:
  - suspicious_transactions.beneficiary_account_id (UUID -> accounts.id)
  - investigations.complaint_id (UUID -> complaints.id)
  - investigations.outcome (VARCHAR(50))
  - investigations.outcome_notes (TEXT)
  - investigations.outcome_recorded_at (TIMESTAMPTZ)
  - investigations.action_taken (VARCHAR(100))

FORENSIC RULE:
  Never infer or guess beneficiary_account_id from transaction ordering.
  Leaves beneficiary_account_id as NULL unless an explicit relationship exists.
"""

import os
import sys
from pathlib import Path

# Add backend directory to sys.path
BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from sqlalchemy import text
from app.db.session import SyncSessionLocal


def apply_migration():
    print("=" * 80)
    print("APPLYING TRACEABILITY & ACTIONABLE INTELLIGENCE DATABASE MIGRATION")
    print("=" * 80)

    session = SyncSessionLocal()
    try:
        # 1. Add beneficiary_account_id to suspicious_transactions
        print("[1] Adding beneficiary_account_id to suspicious_transactions...")
        session.execute(text("""
            ALTER TABLE suspicious_transactions
            ADD COLUMN IF NOT EXISTS beneficiary_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL;
        """))
        session.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_suspicious_tx_beneficiary ON suspicious_transactions(beneficiary_account_id);
        """))

        # 2. Add complaint_id to investigations
        print("[2] Adding complaint_id to investigations...")
        session.execute(text("""
            ALTER TABLE investigations
            ADD COLUMN IF NOT EXISTS complaint_id UUID REFERENCES complaints(id) ON DELETE SET NULL;
        """))
        session.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_investigations_complaint ON investigations(complaint_id);
        """))

        # 3. Add outcome fields to investigations
        print("[3] Adding outcome & action fields to investigations...")
        session.execute(text("""
            ALTER TABLE investigations
            ADD COLUMN IF NOT EXISTS outcome VARCHAR(50);
        """))
        session.execute(text("""
            ALTER TABLE investigations
            ADD COLUMN IF NOT EXISTS outcome_notes TEXT;
        """))
        session.execute(text("""
            ALTER TABLE investigations
            ADD COLUMN IF NOT EXISTS outcome_recorded_at TIMESTAMPTZ;
        """))
        session.execute(text("""
            ALTER TABLE investigations
            ADD COLUMN IF NOT EXISTS action_taken VARCHAR(100);
        """))
        session.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_investigations_outcome ON investigations(outcome);
        """))

        # 4. Link investigations with explicit complaints where an alert is tied to a prediction and transactions
        print("[4] Linking investigations to explicit parent complaints via alert transactions...")
        linked_count = session.execute(text("""
            UPDATE investigations i
            SET complaint_id = sub.complaint_id
            FROM (
                SELECT DISTINCT i2.id AS inv_id, t.complaint_id
                FROM investigations i2
                JOIN alerts a ON i2.alert_id = a.id
                JOIN risk_predictions p ON a.prediction_id = p.id
                JOIN suspicious_transactions t ON t.atm_id = p.location_id
                WHERE t.complaint_id IS NOT NULL
            ) sub
            WHERE i.id = sub.inv_id AND i.complaint_id IS NULL;
        """)).rowcount
        print(f"    Linked {linked_count} investigations to verified complaints.")

        session.commit()
        print("\n[OK] Database schema migration successfully applied.")

        # Verification query
        cols = session.execute(text("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name IN ('suspicious_transactions', 'investigations')
              AND column_name IN ('beneficiary_account_id', 'complaint_id', 'outcome', 'action_taken')
            ORDER BY table_name, column_name;
        """)).fetchall()

        print("\nVerified Added Columns:")
        for c in cols:
            print(f"  [OK] {c[0]} ({c[1]})")

    except Exception as e:
        session.rollback()
        print(f"[FATAL] Migration failed: {e}")
        raise
    finally:
        session.close()


if __name__ == "__main__":
    apply_migration()

import os
import sys
import random
import uuid
import hashlib
from datetime import datetime, timedelta, timezone
from decimal import Decimal
import numpy as np

# Add backend directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from geoalchemy2.elements import WKTElement
from app.db.session import SyncSessionLocal, sync_engine
from app.db.base_class import Base
from app.models.user import User
from app.models.complaint import Complaint
from app.models.account import Account
from app.models.atm import ATMLocation
from app.models.transaction import SuspiciousTransaction
from app.models.model_run import ModelRun
from app.core.security import get_password_hash
from app.ml.feature_builder import FeatureBuilder
from app.ml.trainer import ModelTrainer

# Deterministic random seed for reproducibility
random.seed(42)
np.random.seed(42)

CITIES = [
    {"name": "Delhi", "state": "Delhi", "lat": 28.6139, "lon": 77.2090},
    {"name": "Mumbai", "state": "Maharashtra", "lat": 19.0760, "lon": 72.8777},
    {"name": "Bengaluru", "state": "Karnataka", "lat": 12.9716, "lon": 77.5946},
    {"name": "Hyderabad", "state": "Telangana", "lat": 17.3850, "lon": 78.4867},
    {"name": "Kolkata", "state": "West Bengal", "lat": 22.5726, "lon": 88.3639},
    {"name": "Chennai", "state": "Tamil Nadu", "lat": 13.0827, "lon": 80.2707},
    {"name": "Ahmedabad", "state": "Gujarat", "lat": 23.0225, "lon": 72.5714},
    {"name": "Pune", "state": "Maharashtra", "lat": 18.5204, "lon": 73.8567},
    {"name": "Jaipur", "state": "Rajasthan", "lat": 26.9124, "lon": 75.7873},
    {"name": "Lucknow", "state": "Uttar Pradesh", "lat": 26.8467, "lon": 80.9462},
]

BANKS = [
    "State Bank of India",
    "HDFC Bank",
    "ICICI Bank",
    "Axis Bank",
    "Punjab National Bank",
    "Bank of Baroda",
    "Kotak Mahindra Bank",
]

CATEGORIES = [
    {"name": "UPI Payment Fraud", "avg_amount": 25000, "cashout_prob": 0.45},
    {"name": "Phishing & Fake APK Scam", "avg_amount": 75000, "cashout_prob": 0.65},
    {"name": "Investment & Crypto Scam", "avg_amount": 250000, "cashout_prob": 0.80},
    {"name": "Part-Time Job / Task Fraud", "avg_amount": 45000, "cashout_prob": 0.55},
    {"name": "Digital Arrest / Impersonation", "avg_amount": 500000, "cashout_prob": 0.85},
    {"name": "Credit Card KYC Update Fraud", "avg_amount": 35000, "cashout_prob": 0.40},
]


from app.core.config import settings


def generate_synthetic_database(offline_mode: bool = False):
    print("=================================================================")
    if offline_mode:
        print(" HERMES AI — OFFLINE Synthetic Dataset Generation & ML Training")
        print(" [NOTE] Running in explicit --offline mode: Database will NOT be populated.")
    else:
        print(" HERMES AI — Database Seeding & Production ML Baseline Training")
    print("=================================================================")

    now = datetime.now(timezone.utc)
    base_time = now - timedelta(days=35)

    session = None
    if not offline_mode:
        try:
            Base.metadata.create_all(bind=sync_engine)
            session = SyncSessionLocal()
            # Test session connection
            session.execute(Base.metadata.tables["users"].select().limit(1))
        except Exception as e:
            print(f"[FATAL ERROR] Failed to connect to PostgreSQL database: {e}")
            print("To run without database persistence, explicitly pass the --offline flag:")
            print("  python data_generator/generate_data.py --offline")
            raise RuntimeError(f"Database connection failed in DB mode: {e}") from e

    # 1. Generate System Users
    admin_pw = getattr(settings, "DEFAULT_ADMIN_PASSWORD", "Admin@123")
    inv_pw = getattr(settings, "DEFAULT_INVESTIGATOR_PASSWORD", "Hermes@123")

    users_data = [
        {"email": "admin@hermes.gov.in", "role": "ADMIN", "name": "Dr. Rajesh Kumar", "badge": "ADM-001", "agency": "Cyber Operations"},
        {"email": "supervisor@hermes.gov.in", "role": "SUPERVISOR", "name": "ACP Neha Verma", "badge": "SUP-012", "agency": "State Cyber Police"},
        {"email": "investigator@hermes.gov.in", "role": "INVESTIGATOR", "name": "Inspector Vikram Singh", "badge": "INV-409", "agency": "Cyber Crime Cell"},
        {"email": "analyst@hermes.gov.in", "role": "ANALYST", "name": "Pooja Sharma", "badge": "ANL-102", "agency": "NCRP Intelligence"},
        {"email": "ml@hermes.gov.in", "role": "ML_ENGINEER", "name": "Arjun Nair", "badge": "MLE-301", "agency": "AI Research Wing"},
    ]

    if session:
        for u in users_data:
            if not session.query(User).filter(User.email == u["email"]).first():
                pw = admin_pw if u["role"] == "ADMIN" else inv_pw
                session.add(User(
                    email=u["email"],
                    hashed_password=get_password_hash(pw),
                    full_name=u["name"],
                    badge_number=u["badge"],
                    agency=u["agency"],
                    role=u["role"],
                    is_active=True,
                ))
        session.commit()
        print(f"[OK] Seeded {len(users_data)} RBAC users to database.")

    # 2. Generate ATM Locations (10 per city = 100 ATMs)
    print(">>> Generating 100 ATM Locations across 10 Metro Clusters...")
    all_atms = []
    for city_info in CITIES:
        for i in range(10):
            lat_offset = np.random.normal(0, 0.04)
            lon_offset = np.random.normal(0, 0.04)
            atm_lat = round(city_info["lat"] + lat_offset, 6)
            atm_lon = round(city_info["lon"] + lon_offset, 6)
            bank = random.choice(BANKS)
            code = f"ATM-{city_info['name'][:3].upper()}-{1000 + len(all_atms)}"

            atm = ATMLocation(
                id=uuid.uuid4(),
                atm_code=code,
                bank_name=bank,
                address=f"Commercial Complex, Sector {random.randint(1, 40)}, {city_info['name']}",
                city=city_info["name"],
                district=city_info["name"],
                state=city_info["state"],
                latitude=atm_lat,
                longitude=atm_lon,
                location=WKTElement(f"POINT({atm_lon} {atm_lat})", srid=4326),
                is_active=True,
            )
            all_atms.append(atm)
            if session:
                session.add(atm)

    if session:
        session.commit()
    print(f"[OK] Created {len(all_atms)} ATM locations with PostGIS geometry.")

    # 3. Generate Bank Accounts (200 accounts with mule indicators)
    print(">>> Generating 200 Bank Accounts with Mule Node Indicators...")
    all_accounts = []
    for i in range(200):
        is_mule = random.random() < 0.25
        acc_raw = f"ACC-{1000000000 + i}"
        acc_hash = hashlib.sha256(acc_raw.encode()).hexdigest()

        acc = Account(
            id=uuid.uuid4(),
            account_hash=acc_hash,
            bank_name=random.choice(BANKS),
            account_type="SAVINGS" if random.random() > 0.3 else "CURRENT",
            risk_tier="CRITICAL" if is_mule else ("HIGH" if random.random() < 0.3 else "LOW"),
            is_mule_suspected=is_mule,
        )
        all_accounts.append(acc)
        if session:
            session.add(acc)

    if session:
        session.commit()
    print(f"[OK] Created {len(all_accounts)} accounts ({sum(1 for a in all_accounts if a.is_mule_suspected)} mule suspects).")

    # 4. Generate Complaints and Causal Linked Transactions
    print(">>> Generating Complaints, Fraud Multi-Hop Transactions, and Cash-Outs...")
    all_complaints = []
    all_transactions = []

    for i in range(400):
        city_info = random.choice(CITIES)
        cat_info = random.choice(CATEGORIES)
        # Event time spread over past 30 days
        days_offset = random.uniform(1.0, 30.0)
        file_time = base_time + timedelta(days=days_offset)

        amount_val = float(max(5000.0, np.random.normal(cat_info["avg_amount"], cat_info["avg_amount"] * 0.3)))
        reported_amount = Decimal(str(round(amount_val, 2)))

        complaint = Complaint(
            id=uuid.uuid4(),
            complaint_number=f"NCRP-2026-{100000 + i}",
            filed_at=file_time,
            category=cat_info["name"],
            subcategory="Cyber Financial Fraud",
            reported_amount=reported_amount,
            victim_state=city_info["state"],
            victim_city=city_info["name"],
            status="under_investigation" if random.random() < 0.7 else "resolved",
            description=f"Fraudulent transfer reported under {cat_info['name']}.",
        )
        all_complaints.append(complaint)
        if session:
            session.add(complaint)

        # Causal transaction chains
        num_hops = random.randint(2, 5)
        is_cashout_campaign = (random.random() < cat_info["cashout_prob"])
        city_atms = [a for a in all_atms if a.city == city_info["name"]]
        target_atm = random.choice(city_atms) if city_atms else random.choice(all_atms)

        tx_lat_base = target_atm.latitude + np.random.normal(0, 0.01)
        tx_lon_base = target_atm.longitude + np.random.normal(0, 0.01)

        for hop in range(num_hops):
            tx_time = file_time + timedelta(hours=random.uniform(0.5, 8.0) * (hop + 1))
            is_final_cashout = (is_cashout_campaign and hop == num_hops - 1)
            hop_amount = Decimal(str(round(float(reported_amount) / num_hops, 2)))
            account_node = random.choice(all_accounts)

            if is_final_cashout:
                tx_lat = target_atm.latitude
                tx_lon = target_atm.longitude
                tx_type = "ATM_WITHDRAW"
                atm_assigned_id = target_atm.id
            else:
                tx_lat = tx_lat_base + np.random.normal(0, 0.005)
                tx_lon = tx_lon_base + np.random.normal(0, 0.005)
                tx_type = random.choice(["IMPS", "UPI", "NEFT"])
                atm_assigned_id = None

            tx = SuspiciousTransaction(
                id=uuid.uuid4(),
                complaint_id=complaint.id,
                account_id=account_node.id,
                amount=hop_amount,
                transaction_type=tx_type,
                occurred_at=tx_time,
                latitude=round(tx_lat, 6),
                longitude=round(tx_lon, 6),
                location=WKTElement(f"POINT({tx_lon:.6f} {tx_lat:.6f})", srid=4326),
                velocity_score=Decimal(str(round(random.uniform(0.4, 0.95), 2))),
                is_flagged=account_node.is_mule_suspected or (hop_amount > 50000),
                is_cash_out=is_final_cashout,
                atm_id=atm_assigned_id,
            )
            all_transactions.append(tx)
            if session:
                session.add(tx)

    if session:
        session.commit()
    print(f"[OK] Generated {len(all_complaints)} complaints and {len(all_transactions)} transactions ({sum(1 for tx in all_transactions if tx.is_cash_out)} cash-outs).")

    # 5. Build Training Examples across Chronological Cutoff Windows
    print(">>> Constructing ATM x Cutoff-Time Training Matrix via FeatureBuilder...")
    # Generate 15 distinct cutoff timestamps across the 30-day timeline (every 2 days)
    cutoff_times = [base_time + timedelta(days=d) for d in range(7, 28, 2)]
    
    X, y, metadata = FeatureBuilder.build_training_dataset_from_db(
        all_atms=all_atms,
        all_transactions=all_transactions,
        cutoff_times=cutoff_times,
        horizon_hours=24,
    )

    print(f"[OK] Constructed Feature Matrix: X shape={X.shape}, Positive Labels={int(np.sum(y))} ({np.mean(y)*100:.2f}% prevalence).")

    # 6. Chronological Train / Validation / Test Split (Strictly Time-Ordered)
    # Earlier cutoffs for training, middle for validation, latest for testing
    num_cutoffs = len(cutoff_times)
    train_cutoffs_count = int(num_cutoffs * 0.70)
    val_cutoffs_count = int(num_cutoffs * 0.15)
    
    samples_per_cutoff = len(all_atms)
    train_end = train_cutoffs_count * samples_per_cutoff
    val_end = (train_cutoffs_count + val_cutoffs_count) * samples_per_cutoff

    X_train, y_train = X[:train_end], y[:train_end]
    X_val, y_val = X[train_end:val_end], y[train_end:val_end]
    X_test, y_test = X[val_end:], y[val_end:]

    print(f"[SPLIT] Train Samples: {len(X_train)} (Pos: {np.sum(y_train)}), Val: {len(X_val)} (Pos: {np.sum(y_val)}), Test: {len(X_test)} (Pos: {np.sum(y_test)}).")

    # 7. Train & Evaluate Baseline Model
    print(">>> Training Production ML Model (RandomForest with Class Balancing)...")
    artifact_dir = os.path.join(os.path.dirname(__file__), "..", "artifacts")
    eval_results = ModelTrainer.train_and_evaluate(
        X_train=X_train,
        y_train=y_train,
        X_val=X_val,
        y_val=y_val,
        X_test=X_test,
        y_test=y_test,
        model_type="rf",
        artifact_dir=artifact_dir,
        model_version="rf-v1.0",
    )

    print("\n--- MODEL EVALUATION METRICS ---")
    print(f"Model Name:        {eval_results['model_name']}")
    print(f"Model Version:     {eval_results['model_version']}")
    print(f"Precision:         {eval_results['precision_score']:.4f}")
    print(f"Recall:            {eval_results['recall_score']:.4f}")
    print(f"F1 Score:          {eval_results['f1_score']:.4f}")
    print(f"PR-AUC:            {eval_results['pr_auc']:.4f}")
    print(f"ROC-AUC:           {eval_results['roc_auc']:.4f}")
    print(f"Precision@10:      {eval_results['metrics']['precision_at_10']:.4f}")
    print(f"Precision@20:      {eval_results['precision_at_k']:.4f}")
    print(f"Recall@10:         {eval_results['metrics']['recall_at_10']:.4f}")
    print(f"Recall@20:         {eval_results['metrics']['recall_at_20']:.4f}")
    print(f"Artifact Saved:    {eval_results['artifact_path']}")

    # 8. Record in Model Registry Table
    if session:
        # Demote existing production models
        session.query(ModelRun).filter(ModelRun.is_production == True).update({"is_production": False})
        
        model_run = ModelRun(
            id=uuid.uuid4(),
            model_name=eval_results["model_name"],
            model_version=eval_results["model_version"],
            precision_score=eval_results["precision_score"],
            recall_score=eval_results["recall_score"],
            f1_score=eval_results["f1_score"],
            pr_auc=eval_results["pr_auc"],
            roc_auc=eval_results["roc_auc"],
            precision_at_k=eval_results["precision_at_k"],
            parameters={"n_estimators": 100, "max_depth": 8, "class_weight": "balanced"},
            feature_importances=eval_results["feature_importances"],
            artifact_path=eval_results["artifact_path"],
            is_production=True,
            notes="Trained on ATM x Cutoff prediction unit with 24h horizon.",
        )
        session.add(model_run)
        session.commit()
        session.close()
        print(f"[OK] ModelRun recorded in database as active production model.")

    print("\n=================================================================")
    print(" SYNTHETIC DATA & MODEL PIPELINE COMPLETE SUCCESSFULLY")
    print("=================================================================")
    return eval_results


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="HERMES Synthetic Data Generator & ML Training")
    parser.add_argument("--offline", action="store_true", help="Run in offline in-memory mode without writing to database")
    args = parser.parse_args()
    generate_synthetic_database(offline_mode=args.offline)

"""
PravahDridh — Milestone 1 End-to-End Verification Test
Validates the complete pipeline:
Citizen Submission -> FastAPI /api/complaints -> PostgreSQL -> /api/v1/complaints -> LEA Platform
"""

import asyncio
import os
import uuid
from decimal import Decimal
from httpx import AsyncClient, ASGITransport
import psycopg2
from dotenv import load_dotenv

load_dotenv('.env')

from app.main import app

async def run_milestone1_e2e():
    print("=" * 70)
    print("PravahDridh — MILESTONE 1 VERIFICATION: CITIZEN TO LEA PIPELINE")
    print("=" * 70)

    # Step 1: Check PostgreSQL direct connectivity
    print("\n[STEP 1] Checking direct PostgreSQL connectivity...")
    sync_url = os.environ['SYNC_DATABASE_URL']
    conn = psycopg2.connect(sync_url)
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM complaints;")
    initial_count = cur.fetchone()[0]
    print(f" -> Current PostgreSQL complaints count: {initial_count}")

    # Step 2: Citizen files complaint via Citizen Portal API contract
    print("\n[STEP 2] Simulating Citizen Portal (PravahSetu) Complaint Submission...")
    test_run_id = uuid.uuid4().hex[:6].upper()
    citizen_complaint_id = f"CYB-2026-CITIZEN-{test_run_id}"

    citizen_payload = {
        "complaint_number": citizen_complaint_id,
        "category": "UPI & Payment Fraud",
        "subcategory": "UPI_QR_SCAM",
        "description": f"Citizen was coerced into scanning fraudulent dynamic QR code resulting in unauthorized debit. Trace tag: {test_run_id}",
        "reported_amount": 68500.00,
        "victim_state": "Delhi",
        "victim_city": "Rohini Sector 7",
        "victim_district": "North West Delhi",
        "complainant_name": "Aakash Verma",
        "complainant_contact": "9811223344",
        "suspect_info": "Suspect UPI: merchant.pay99@okhdfcbank | Phone: 9988776655 | URL: https://verify-refund-portal.in",
        "financial_details": {
            "amountLost": 68500,
            "transactionId": f"TXN-UPI-{test_run_id}",
            "bankOrWallet": "HDFC Bank",
            "upiId": "merchant.pay99@okhdfcbank"
        },
        "evidence_files": [
            {"name": "screenshot_payment_debit.png", "size": 245100, "type": "image/png"},
            {"name": "whatsapp_chat_transcript.pdf", "size": 1124500, "type": "application/pdf"}
        ],
        "priority": "HIGH"
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://localhost:8000") as client:
        # Submit to public citizen endpoint (POST /api/complaints)
        post_resp = await client.post("/api/complaints", json=citizen_payload)
        print(f" -> POST /api/complaints response status: {post_resp.status_code}")
        assert post_resp.status_code == 201, f"Expected 201, got: {post_resp.text}"
        created_data = post_resp.json()["data"]
        print(f" -> Generated DB UUID: {created_data['id']}")
        print(f" -> Official Reference: {created_data['complaint_number']}")
        print(f" -> Complainant Recorded: {created_data['complainant_name']}")
        print(f" -> Reported Amount: INR {created_data['reported_amount']}")

        # Step 3: Verify direct database persistence in PostgreSQL
        print("\n[STEP 3] Verifying persistence directly in PostgreSQL...")
        cur.execute("SELECT id, complaint_number, complainant_name, reported_amount, status, created_at FROM complaints WHERE complaint_number = %s;", (citizen_complaint_id,))
        row = cur.fetchone()
        assert row is not None, "Complaint was not found in PostgreSQL!"
        print(f" -> Confirmed in DB: ID={row[0]}, Number={row[1]}, Complainant={row[2]}, Amount=INR {row[3]}, Status={row[4]}")
        cur.execute("SELECT COUNT(*) FROM complaints;")
        new_count = cur.fetchone()[0]
        assert new_count == initial_count + 1, f"Expected count {initial_count + 1}, got {new_count}"
        print(f" -> Total database count increased to: {new_count}")

        # Step 4: Citizen tracks complaint via public tracking endpoint
        print("\n[STEP 4] Citizen Tracking Verification...")
        track_resp = await client.get(f"/api/complaints/track/{citizen_complaint_id}")
        assert track_resp.status_code == 200, f"Tracking failed: {track_resp.text}"
        track_data = track_resp.json()["data"]
        assert track_data["complaint_number"] == citizen_complaint_id
        print(f" -> Public tracking confirmed: Status={track_data['status']}, Authority Area={track_data['victim_district']}")

        # Step 5: LEA Intelligence Platform queries complaints feed
        print("\n[STEP 5] LEA Intelligence Platform (PravahDridh) Retrieval Verification...")
        # Authenticate as investigator
        login_resp = await client.post("/api/v1/auth/login", json={
            "email": "investigator@hermes.gov.in",
            "password": "Hermes@123"
        })
        assert login_resp.status_code == 200, f"LEA Login failed: {login_resp.text}"
        token = login_resp.json()["data"]["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Query GET /api/v1/complaints
        lea_resp = await client.get("/api/v1/complaints", headers=headers)
        assert lea_resp.status_code == 200, f"LEA fetch failed: {lea_resp.text}"
        lea_body = lea_resp.json()
        complaints_list = lea_body["data"]
        print(f" -> Retrieved {len(complaints_list)} complaints in LEA feed (Total in DB: {lea_body['meta']['total']})")

        # Top item must be our newly submitted citizen complaint!
        top_complaint = complaints_list[0]
        print(f" -> Top feed complaint: {top_complaint['complaint_number']} | {top_complaint['category']} | INR {top_complaint['reported_amount']}")
        assert top_complaint["complaint_number"] == citizen_complaint_id, (
            f"Expected newly created complaint {citizen_complaint_id} at top of feed, got {top_complaint['complaint_number']}"
        )

        # Step 6: Search & filter verification
        print("\n[STEP 6] Search & Filter Verification on LEA Platform...")
        search_resp = await client.get(f"/api/v1/complaints?search={test_run_id}", headers=headers)
        assert search_resp.status_code == 200
        search_results = search_resp.json()["data"]
        assert len(search_results) >= 1
        assert search_results[0]["complaint_number"] == citizen_complaint_id
        print(f" -> Search query '{test_run_id}' accurately isolated the citizen record!")

    cur.close()
    conn.close()

    print("\n" + "=" * 70)
    print("SUCCESS: ALL MILESTONE 1 END-TO-END VALIDATION CRITERIA SATISFIED!")
    print("=" * 70)

if __name__ == "__main__":
    asyncio.run(run_milestone1_e2e())

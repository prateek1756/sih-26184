import sys, os, json, asyncio, uuid, logging
logging.getLogger('sqlalchemy.engine.Engine').setLevel(logging.CRITICAL)
logging.getLogger('sqlalchemy.pool').setLevel(logging.CRITICAL)
logging.getLogger('passlib').setLevel(logging.CRITICAL)
sys.path.insert(0, '.')
import psycopg2
from psycopg2.extras import RealDictCursor
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.config import settings
from app.db.session import SyncSessionLocal, sync_engine
from app.db.base_class import Base
from app.models.user import User
from app.core.security import get_password_hash

BASE_URL = 'http://testserver'

print('=== [SETUP] Seeding test users ===')
Base.metadata.create_all(bind=sync_engine)
sess = SyncSessionLocal()
run_id = uuid.uuid4().hex[:6]
mle_email = f'mle_{run_id}@hermes.gov.in'
admin_email = f'admin_{run_id}@hermes.gov.in'
for email, role in [(mle_email, 'ML_ENGINEER'), (admin_email, 'ADMIN')]:
    u = User(id=uuid.uuid4(), email=email, hashed_password=get_password_hash('Hermes@2026'),
             full_name=f'{role} Test {run_id}', badge_number=f'{role}-{run_id}',
             agency='Forensic Audit', role=role, is_active=True)
    sess.merge(u)
sess.commit(); sess.close()
print(f'  ML_ENGINEER: {mle_email}')
print(f'  ADMIN:       {admin_email}')

async def run_all():
    results = []
    failed = []
    async with AsyncClient(transport=ASGITransport(app=app), base_url=BASE_URL, timeout=180.0) as client:
        # Login ML_ENGINEER for predictions/run
        r = await client.post('/api/v1/auth/login', json={'email': mle_email, 'password': 'Hermes@2026'})
        tok_ml = r.json()['data']['access_token']
        h_ml = {'Authorization': f'Bearer {tok_ml}'}
        r = await client.post('/api/v1/auth/login', json={'email': admin_email, 'password': 'Hermes@2026'})
        tok_ad = r.json()['data']['access_token']
        h_ad = {'Authorization': f'Bearer {tok_ad}'}

        # Before run
        conn = psycopg2.connect(settings.SYNC_DATABASE_URL); conn.autocommit = True
        cur = conn.cursor()
        cur.execute('SELECT count(*) FROM risk_predictions')
        cnt_before = cur.fetchone()[0]
        cur.close(); conn.close()
        print(f'\n  Predictions before run: {cnt_before}')

        ############################################
        # [P0] POST /predictions/run (ML_ENGINEER) -> MUST call predict_proba() through full stack
        ############################################
        print('\n=== [P0] POST /api/v1/predictions/run (ML_ENGINEER) ===')
        pr = await client.post('/api/v1/predictions/run',
                               json={'window_hours': 24, 'min_risk_threshold': 0.20},
                               headers=h_ml, timeout=300.0)
        print(f'  Status: {pr.status_code}')
        if pr.status_code in (200, 201):
            body = pr.json()
            d = body.get('data')
            print(f'  Response envelope: {sorted(body.keys())}')
            if isinstance(d, list):
                print(f'  predictions returned: {len(d)}')
                if len(d):
                    p0 = d[0]
                    print(f'  Pred[0] keys: {sorted(p0.keys())}')
                    print(f'    risk_score: {p0.get("risk_score")}')
                    print(f'    severity:   {p0.get("severity")}')
                    print(f'    confidence: {p0.get("confidence")}')
                    print(f'    reasons:    {p0.get("reasons", [])[:3]}')
                    print(f'    model_ver:  {p0.get("model_version")}')
            elif isinstance(d, dict):
                print(f'  data keys: {sorted(d.keys())}')
                if 'predictions' in d:
                    preds = d['predictions']
                    print(f'  predictions: {len(preds)}')
                    if preds:
                        p0 = preds[0]
                        print(f'  Pred[0]: score={p0.get("risk_score")} sev={p0.get("severity")} conf={p0.get("confidence")}')
        else:
            print(f'  FAILED [{pr.status_code}]: {pr.text[:500]}')
            if pr.status_code >= 500:
                failed.append(('POST','/predictions/run', pr.status_code, pr.text[:500]))

        # After run - forensic DB check
        conn = psycopg2.connect(settings.SYNC_DATABASE_URL)
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute('SELECT count(*) as c FROM risk_predictions')
        cnt_after = cur.fetchone()['c']
        cur.execute('SELECT count(*) as nz FROM risk_predictions WHERE risk_zone IS NULL')
        nz = cur.fetchone()['nz']
        print(f'\n  Predictions after run: {cnt_after} (delta +{cnt_after-cnt_before})')
        print(f'  risk_zone ALL NULL:    {nz}/{cnt_after}  ->  {nz == cnt_after}')
        # Show actual stored fields
        cur.execute('''
        SELECT id, risk_score::float, severity, confidence::float, model_version, is_active,
               reasons::text as first_reason
        FROM risk_predictions ORDER BY predicted_at DESC LIMIT 5
        ''')
        for r_ in cur.fetchall():
            fr = json.loads(r_['first_reason'])[0] if r_['first_reason'] else None
            print(f'    id={str(r_["id"])[:8]}... score={r_["risk_score"]:.4f} sev={r_["severity"]:8} conf={r_["confidence"]:.4f} ver={r_["model_version"]} active={r_["is_active"]} first_reason={str(fr)[:40]}')

        # RiskPrediction table actual columns
        cur.execute('''
        SELECT column_name, data_type
        FROM information_schema.columns WHERE table_name='risk_predictions'
        ORDER BY ordinal_position
        ''')
        cols = [(r_['column_name'], r_['data_type']) for r_ in cur.fetchall()]
        print(f'\n  risk_predictions SCHEMA columns: {cols}')
        print(f'  ORM declares: id, predicted_at, model_version, location_id, lat, lon, risk_score, severity, confidence, win_start, win_end, risk_zone, reasons, model_run_id, is_active')

        ############################################
        # Remaining endpoints
        ############################################
        route_tests = [
            ('POST', '/api/v1/auth/refresh', h_ml, None, 'auth refresh'),
            ('POST', '/api/v1/complaints', h_ad, {
                'complaint_number': f'NCRP-AUD2-{run_id}',
                'filed_at': '2025-03-18T10:00:00Z',
                'category': 'ATM Fraud', 'subcategory': 'Skimming',
                'reported_amount': '50000.00', 'victim_state': 'Delhi',
                'victim_city': 'New Delhi', 'status': 'open',
                'description': 'Forensic.',
            }, 'create complaint (ADMIN)'),
            ('GET', '/api/v1/predictions', h_ml, None, 'list predictions'),
            ('GET', '/api/v1/predictions/hotspots', h_ml, None, 'hotspots GeoJSON'),
            ('GET', '/api/v1/predictions/top-k?k=10', h_ml, None, 'top-k'),
            ('GET', '/api/v1/alerts', h_ml, None, 'list alerts'),
            ('GET', '/api/v1/geo/atms', h_ml, None, 'geo/atms GeoJSON'),
            ('GET', '/api/v1/geo/clusters?min_samples=2', h_ml, None, 'geo/clusters'),
            ('GET', '/api/v1/investigations', h_ad, None, 'list investigations'),
            ('POST', '/api/v1/investigations', h_ad, {
                'case_number': f'CASE-AUD2-{run_id}',
                'title': 'Forensic Case', 'status': 'active', 'priority': 'MEDIUM',
            }, 'create investigation'),
            ('GET', '/api/v1/audit/events', h_ad, None, 'audit events (SUP+)'),
            ('GET', '/api/v1/models', h_ml, None, 'list ml models'),
        ]
        results.append(('/predictions/run', pr.status_code, ''))

        # Get IDs
        rc = await client.get('/api/v1/complaints', headers=h_ad)
        cid = rc.json()['data'][0]['id'] if (rc.status_code==200 and rc.json().get('data') and len(rc.json()['data'])) else None
        conn2 = psycopg2.connect(settings.SYNC_DATABASE_URL)
        c2 = conn2.cursor()
        c2.execute("SELECT id FROM suspicious_transactions LIMIT 1")
        row = c2.fetchone(); tid = str(row[0]) if row else None
        c2.execute("SELECT id FROM alerts LIMIT 1")
        row = c2.fetchone(); aid = str(row[0]) if row else None
        c2.execute("SELECT id FROM investigations LIMIT 1")
        row = c2.fetchone(); iid = str(row[0]) if row else None
        c2.execute("SELECT id FROM risk_predictions LIMIT 1")
        row = c2.fetchone(); pid = str(row[0]) if row else None
        c2.close(); conn2.close()

        if cid:
            route_tests.append(('GET', f'/api/v1/complaints/{cid}', h_ad, None, 'complaint by id'))
            route_tests.append(('PATCH', f'/api/v1/complaints/{cid}', h_ad,
                {'status': 'under_investigation'}, 'patch complaint'))
        if pid:
            route_tests.append(('GET', f'/api/v1/predictions/{pid}', h_ml, None, 'pred by id'))
        if aid:
            route_tests.append(('GET', f'/api/v1/alerts/{aid}', h_ml, None, 'alert by id'))
            route_tests.append(('POST', f'/api/v1/alerts/{aid}/acknowledge', h_ad, None, 'ack alert'))
            route_tests.append(('PATCH', f'/api/v1/alerts/assign', h_ad,
                {'alert_id': aid}, 'assign alert (body-ok expected 422 if incomplete)'))
        if iid:
            route_tests.append(('GET', f'/api/v1/investigations/{iid}', h_ad, None, 'inv by id'))
            route_tests.append(('PATCH', f'/api/v1/investigations/{iid}', h_ad,
                {'status': 'active'}, 'patch inv'))
            route_tests.append(('POST', f'/api/v1/investigations/{iid}/notes', h_ad,
                {'note': 'Forensic note.'}, 'inv note'))
        # Model by id
        rmod = await client.get('/api/v1/models', headers=h_ml)
        if rmod.status_code==200 and rmod.json().get('data') and len(rmod.json()['data']):
            m0 = rmod.json()['data'][0]
            mid = m0.get('id') or m0.get('model_name')
            route_tests.append(('GET', f'/api/v1/models/{mid}', h_ml, None, 'model by id'))
            route_tests.append(('POST', f'/api/v1/models/{mid}/promote', h_ad, None, 'promote model'))
        if tid:
            route_tests.append(('GET', f'/api/v1/transactions/{tid}', h_ml, None, 'tx by id'))

        print('\n=== ALL CONTRACT ENDPOINTS TESTED ===')
        for method, path, headers, body, desc in route_tests:
            try:
                if method == 'GET':
                    resp = await client.get(path, headers=headers, timeout=30.0)
                elif method == 'POST':
                    resp = await client.post(path, json=body or {}, headers=headers, timeout=90.0)
                else:
                    resp = await client.patch(path, json=body or {}, headers=headers, timeout=30.0)
            except Exception as ex:
                print(f'  ? [ERR] {method:5} {path[:72]:72}  # {desc}: {str(ex)[:70]}')
                failed.append((method, path, 0, str(ex)[:300]))
                continue
            ok = resp.status_code in (200, 201, 204)
            exp = resp.status_code in (401,403,404,422)
            icon = '+' if ok else ('~' if exp else '!')
            extra = ''
            if resp.status_code < 500:
                try:
                    js = resp.json()
                    if resp.status_code == 422:
                        d = js.get('detail', '')
                        extra = f' [422] {(str(d)[:60])}'
                    elif not ok and 'detail' in js:
                        extra = f' detail={str(js["detail"])[:60]}'
                except: pass
            else:
                extra = f' SERVER-5XX: {resp.text[:100]}'
            print(f'  {icon} [{resp.status_code:3}] {method:5} {path[:72]:72}  # {desc}{extra}')
            results.append((f'{method} {path}', resp.status_code, ''))
            if resp.status_code >= 500 or (resp.status_code >= 400 and not exp):
                failed.append((method, path, resp.status_code, resp.text[:300]))

        cur.close(); conn.close()
        return results, failed

results, failed = asyncio.run(run_all())
print(f'\n=== API FORENSICS SUMMARY ===')
ok = sum(1 for (_, c, _) in results if c in (200,201,204))
ok4 = sum(1 for (_, c, _) in results if 400<=c<500)
ok5 = sum(1 for (_, c, _) in results if c>=500)
print(f'  Endpoints run:  {len(results)}')
print(f'  200/201/204:     {ok}  (works)')
print(f'  400-499:        {ok4}  (auth/validation expected)')
print(f'  500+:           {ok5}  (SERVER FAILURES)')
if failed:
    print(f'\n  *** {len(failed)} UNEXPECTED/CRITICAL FAILURES ***')
    for m,p,c,t in failed: print(f'    {m} {p} -> {c}: {str(t)[:250]}')
print('\n=== RUNTIME FORENSICS COMPLETE ===')

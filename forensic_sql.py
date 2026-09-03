import os, sys, json
os.chdir(r'c:\Users\Prateek\Desktop\sih\sih-26184\backend')
sys.path.insert(0, os.getcwd())
from dotenv import load_dotenv
load_dotenv('.env')

import psycopg2
outpath = r'c:\Users\Prateek\Desktop\sih\forensic_sql.txt'
lines = []
lines.append('=' * 80)
lines.append('FORENSIC SQL AUDIT OF SIH_26184 MAIN DATABASE + TEST DATABASE')
lines.append('=' * 80)

for db_label, db_url in [
    ('MAIN DB', os.environ['SYNC_DATABASE_URL']),
    ('TEST DB', os.environ['SYNC_TEST_DATABASE_URL']),
]:
    lines.append(f'\n==== {db_label} ====')
    lines.append(f'URL: {db_url}')
    try:
        conn = psycopg2.connect(db_url, connect_timeout=10)
        cur = conn.cursor()

        # 1. PostGIS version
        cur.execute("SELECT PostGIS_Version()")
        lines.append(f'\n[1] PostGIS_Version(): {cur.fetchone()[0]}')

        # 2. Installed extensions
        cur.execute("SELECT extname, extversion FROM pg_extension ORDER BY extname")
        lines.append('[2] pg_extension entries:')
        for r in cur.fetchall():
            lines.append(f'    {r[0]} {r[1]}')

        # 3. Tables in public schema
        cur.execute("""
            SELECT table_name FROM information_schema.tables
            WHERE table_schema='public' AND table_type='BASE TABLE'
            ORDER BY table_name
        """)
        tables = [r[0] for r in cur.fetchall()]
        lines.append(f'[3] Public tables ({len(tables)}): ' + ', '.join(tables))

        # 4. Geometry columns (PostGIS catalog)
        cur.execute("""
            SELECT f_table_name, f_geometry_column, type, srid
            FROM geometry_columns
            ORDER BY f_table_name, f_geometry_column
        """)
        geom_cols = cur.fetchall()
        lines.append(f'[4] geometry_columns catalog ({len(geom_cols)}):')
        for r in geom_cols:
            lines.append(f'    tbl={r[0]} col={r[1]} type={r[2]} srid={r[3]}')

        # 5. GIST indexes on geometry
        cur.execute("""
            SELECT t.relname AS table_name, i.relname AS idx_name, a.attname AS col
            FROM pg_index ix
            JOIN pg_class t ON t.oid = ix.indrelid
            JOIN pg_class i ON i.oid = ix.indexrelid
            JOIN pg_am am ON am.oid = i.relam
            JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
            WHERE am.amname = 'gist'
            ORDER BY t.relname, i.relname
        """)
        gist = cur.fetchall()
        lines.append(f'[5] GIST indexes ({len(gist)}):')
        for r in gist:
            lines.append(f'    tbl={r[0]} idx={r[1]} col={r[2]}')

        # 6. Row counts per table
        lines.append('[6] Row counts:')
        total_atm, total_tx, total_rp = 0, 0, 0
        for t in tables:
            try:
                cur.execute(f'SELECT COUNT(*) FROM public."{t}"')
                cnt = cur.fetchone()[0]
                lines.append(f'    {t}: {cnt}')
                if t == 'atm_locations': total_atm = cnt
                if t == 'suspicious_transactions': total_tx = cnt
                if t == 'risk_predictions': total_rp = cnt
            except Exception as e:
                lines.append(f'    {t}: ERR {type(e).__name__}: {e}')

        # 7. risk_predictions.risk_zone population (PostGIS POLYGON vs NULL)
        if 'risk_predictions' in tables:
            cur.execute('SELECT COUNT(*) FROM risk_predictions WHERE risk_zone IS NOT NULL')
            rz_not_null = cur.fetchone()[0]
            lines.append(f'[7] risk_predictions.risk_zone (POLYGON Geometry) population: {rz_not_null}/{total_rp} NOT NULL')
            # Get column names
            cur.execute("""
                SELECT column_name, data_type, udt_name
                FROM information_schema.columns
                WHERE table_schema='public' AND table_name='risk_predictions'
                ORDER BY ordinal_position
            """)
            lines.append('    risk_predictions columns:')
            rp_cols = cur.fetchall()
            for r in rp_cols:
                lines.append(f'      {r[0]} ({r[1]}{"/" + r[2] if r[1] == "USER-DEFINED" else ""})')
            if total_rp > 0:
                col_names = [r[0] for r in rp_cols]
                select_cols = ', '.join(c for c in ['id', 'location_id', 'risk_score', 'severity',
                                                    'confidence', 'latitude', 'longitude',
                                                    'model_version', 'predicted_at'] if c in col_names)
                cur.execute(f"""
                    SELECT {select_cols}, ST_AsText(risk_zone) as rz_wkt
                    FROM risk_predictions ORDER BY predicted_at DESC LIMIT 5
                """)
                lines.append(f'    Sample recent 5 risk_predictions:')
                for r in cur.fetchall():
                    lines.append(f'      {r}')

        # 8. atm_locations.location Geometry population vs lat/lon Float
        if 'atm_locations' in tables:
            cur.execute('SELECT COUNT(*) FROM atm_locations WHERE location IS NOT NULL')
            loc_not_null = cur.fetchone()[0]
            lines.append(f'[8] atm_locations.location (POINT Geometry) population: {loc_not_null}/{total_atm} NOT NULL')
            if total_atm > 0:
                cur.execute("""
                    SELECT column_name FROM information_schema.columns
                    WHERE table_schema='public' AND table_name='atm_locations'
                    ORDER BY ordinal_position
                """)
                cols = [r[0] for r in cur.fetchall()]
                safe_cols = [c for c in ['id', 'atm_id', 'latitude', 'longitude'] if c in cols]
                extra = []
                if 'location' in cols:
                    extra.append('ST_AsText(location) geom_wkt')
                    extra.append('ST_SRID(location) srid')
                cur.execute(f"""
                    SELECT {', '.join(safe_cols + extra)} FROM atm_locations LIMIT 5
                """)
                lines.append(f'    Sample atms ({", ".join(safe_cols + extra)}):')
                for r in cur.fetchall():
                    lines.append(f'      {r}')

        # 9. Run ST_DWithin GEOGRAPHY on actual atm_locations.location column
        if total_atm > 0 and 'atm_locations' in tables:
            try:
                cur.execute("""
                    SELECT COUNT(*) FROM atm_locations a
                    WHERE ST_DWithin(
                        a.location::geography,
                        ST_SetSRID(ST_MakePoint(77.2090, 28.6139), 4326)::geography,
                        20000
                    )
                """)
                lines.append(f'[9] PostGIS ST_DWithin GEOGRAPHY(20km radius from Delhi CP) ON atm_locations.location: {cur.fetchone()[0]} HITS (uses GIST index if possible)')
            except Exception as e:
                lines.append(f'[9] ST_DWithin test FAILED: {type(e).__name__}: {e}')

        # 10. suspicious_transactions Geometry population
        if 'suspicious_transactions' in tables:
            cur.execute('SELECT COUNT(*) FROM suspicious_transactions WHERE location IS NOT NULL')
            tx_loc_nn = cur.fetchone()[0]
            lines.append(f'[10] suspicious_transactions.location (POINT Geometry) population: {tx_loc_nn}/{total_tx} NOT NULL')
            if total_tx > 0:
                cur.execute("""
                    SELECT column_name FROM information_schema.columns
                    WHERE table_schema='public' AND table_name='suspicious_transactions'
                    ORDER BY ordinal_position
                """)
                cols = [r[0] for r in cur.fetchall()]
                safe = [c for c in ['id', 'latitude', 'longitude'] if c in cols]
                extra = []
                if 'location' in cols:
                    extra.append('ST_AsText(location) geom_wkt')
                    extra.append('ST_SRID(location) srid')
                cur.execute(f'SELECT {", ".join(safe + extra)} FROM suspicious_transactions LIMIT 3')
                lines.append(f'    Sample txs:')
                for r in cur.fetchall():
                    lines.append(f'      {r}')

        # 11. Data quality: Geometry coords vs lat/lon Float misalignment
        if 'atm_locations' in tables and total_atm > 0:
            try:
                cur.execute("""
                    SELECT COUNT(*) FROM atm_locations
                    WHERE location IS NOT NULL AND latitude IS NOT NULL AND longitude IS NOT NULL
                      AND (ABS(ST_X(location) - longitude) > 0.00001
                           OR ABS(ST_Y(location) - latitude) > 0.00001)
                """)
                lines.append(f'[11] atm_locations: Geometry.X vs longitude / Geometry.Y vs latitude DISAGREEING rows (>1e-5): {cur.fetchone()[0]}')
            except Exception as e:
                lines.append(f'[11] Data quality check failed: {type(e).__name__}: {e}')

        # 12. Model & audit evidence
        for tbl in ['model_runs', 'users', 'audit_events', 'alerts', 'investigations']:
            if tbl in tables:
                cur.execute(f'SELECT COUNT(*) FROM {tbl}')
                lines.append(f'[12] {tbl} rows: {cur.fetchone()[0]}')

        cur.close()
        conn.close()
    except Exception as e:
        lines.append(f'  CONNECT/QUERY EXCEPTION: {type(e).__name__}: {e}')

with open(outpath, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))
print(f'WROTE {outpath}')

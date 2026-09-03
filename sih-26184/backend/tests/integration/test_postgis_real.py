import os
import uuid
import pytest
import psycopg2
from app.core.config import settings


def test_postgis_real_database_extension_and_spatial_queries():
    """
    Mandatory P0 Real PostGIS Integration Test.
    Connects to live PostgreSQL, verifies PostGIS extension, inserts POINT geometries (SRID 4326),
    and executes ST_DWithin to verify spatial query execution directly in PostgreSQL.

    MUST FAIL CLEARLY if PostgreSQL or PostGIS is unavailable.
    """
    # 1. Connect to real PostgreSQL database
    db_url = settings.SYNC_TEST_DATABASE_URL or settings.SYNC_DATABASE_URL
    # Parse connection parameters from standard postgresql:// URL
    # e.g. postgresql://user:password@localhost:5500/dbname
    try:
        conn = psycopg2.connect(db_url)
        conn.autocommit = True
        cur = conn.cursor()
    except Exception as exc:
        pytest.fail(f"[FATAL] Real PostgreSQL connection failed at {db_url}: {exc}")

    try:
        # 2. Verify PostGIS Extension
        try:
            cur.execute("CREATE EXTENSION IF NOT EXISTS postgis;")
            cur.execute("SELECT PostGIS_Full_Version();")
            version_info = cur.fetchone()[0]
            assert version_info is not None
            assert "POSTGIS" in version_info.upper()
            print(f"\n[PostGIS Verified] {version_info}")
        except Exception as exc:
            pytest.fail(
                f"[FATAL] PostGIS extension is not installed/enabled in PostgreSQL! Error: {exc}\n"
                "PostGIS 3.x must be installed in PostgreSQL to support geospatial operations."
            )

        # 3. Create a temporary test table with PostGIS geometry column and GIST index
        table_name = f"test_spatial_atms_{uuid.uuid4().hex[:8]}"
        cur.execute(f"""
            CREATE TABLE {table_name} (
                id UUID PRIMARY KEY,
                atm_code VARCHAR(50) NOT NULL,
                location GEOMETRY(Point, 4326) NOT NULL
            );
        """)
        cur.execute(f"""
            CREATE INDEX idx_{table_name}_geom ON {table_name} USING GIST (location);
        """)

        # 4. Insert real POINT geometry rows (SRID 4326: WGS84 coordinates)
        # Delhi Connaught Place ATM: lat 28.6315, lon 77.2167
        # Delhi Janpath ATM (nearby ~500m): lat 28.6270, lon 77.2180
        # Mumbai Nariman Point ATM (distant ~1150km): lat 18.9256, lon 72.8242
        atm_delhi_id = uuid.uuid4()
        atm_nearby_id = uuid.uuid4()
        atm_mumbai_id = uuid.uuid4()

        cur.execute(f"""
            INSERT INTO {table_name} (id, atm_code, location) VALUES
            ('{atm_delhi_id}', 'ATM-DELHI-CP', ST_SetSRID(ST_MakePoint(77.2167, 28.6315), 4326)),
            ('{atm_nearby_id}', 'ATM-DELHI-JANPATH', ST_SetSRID(ST_MakePoint(77.2180, 28.6270), 4326)),
            ('{atm_mumbai_id}', 'ATM-MUMBAI-NP', ST_SetSRID(ST_MakePoint(72.8242, 18.9256), 4326));
        """)

        # 5. Execute ST_DWithin spatial query in PostgreSQL using geography casting (distance in meters)
        # Query for ATMs within 2000 meters (2km) of Connaught Place ATM (77.2167, 28.6315)
        cur.execute(f"""
            SELECT atm_code, ST_AsText(location), ST_Distance(location::geography, ST_SetSRID(ST_MakePoint(77.2167, 28.6315), 4326)::geography) AS distance_meters
            FROM {table_name}
            WHERE ST_DWithin(
                location::geography,
                ST_SetSRID(ST_MakePoint(77.2167, 28.6315), 4326)::geography,
                2000
            )
            ORDER BY distance_meters ASC;
        """)
        results = cur.fetchall()

        # 6. Assertions
        # Delhi CP (0m) and Janpath (~500m) must be found; Mumbai must NOT be found.
        assert len(results) == 2, f"Expected 2 nearby ATMs within 2km, found {len(results)}: {results}"
        found_codes = [r[0] for r in results]
        assert "ATM-DELHI-CP" in found_codes
        assert "ATM-DELHI-JANPATH" in found_codes
        assert "ATM-MUMBAI-NP" not in found_codes

        # Assert geometry text format
        assert results[0][1] == "POINT(77.2167 28.6315)"

        # 7. Cleanup
        cur.execute(f"DROP TABLE {table_name};")

    finally:
        cur.close()
        conn.close()

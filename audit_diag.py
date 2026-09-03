import socket, sys

out = []
s = socket.socket()
s.settimeout(5)
try:
    r = s.connect_ex(('127.0.0.1', 5500))
    if r == 0:
        out.append('PORT 5500: OPEN')
    else:
        out.append(f'PORT 5500: CLOSED (err={r})')
except Exception as e:
    out.append(f'PORT 5500: EXCEPTION {type(e).__name__}: {e}')
finally:
    s.close()

try:
    import psycopg2
    out.append('psycopg2: AVAILABLE')
except Exception as e:
    out.append(f'psycopg2: MISSING - {e}')

try:
    import geoalchemy2
    out.append('geoalchemy2: AVAILABLE')
except Exception as e:
    out.append(f'geoalchemy2: MISSING - {e}')

try:
    import joblib
    out.append('joblib: AVAILABLE')
except Exception as e:
    out.append(f'joblib: MISSING - {e}')

import os
os.chdir(r'c:\Users\Prateek\Desktop\sih\sih-26184\backend')
sys.path.insert(0, os.getcwd())
out.append(f'CWD: {os.getcwd()}')

try:
    from dotenv import load_dotenv
    load_dotenv()
    out.append(f'SYNC_DB: ' + os.environ.get('SYNC_DATABASE_URL', 'NOT SET')[:80])
except Exception as e:
    out.append(f'DOTENV FAIL: {e}')

with open(r'c:\Users\Prateek\Desktop\sih\audit_diag_out.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(out))
print('DONE')

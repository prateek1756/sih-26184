import os, sys, subprocess, time

os.chdir(r'c:\Users\Prateek\Desktop\sih\sih-26184\backend')
sys.path.insert(0, os.getcwd())

from dotenv import load_dotenv
load_dotenv('.env')

print('Starting TEST 25 RUNNER at', time.ctime())
cmd = [sys.executable, '-m', 'pytest',
       'tests/integration/test_postgis_real.py::test_postgis_real_database_extension_and_spatial_queries',
       '-v', '--tb=long', '-s', '--no-header']
outpath = r'c:\Users\Prateek\Desktop\sih\test25_output.txt'

t0 = time.time()
try:
    result = subprocess.run(
        cmd,
        cwd=r'c:\Users\Prateek\Desktop\sih\sih-26184\backend',
        capture_output=True,
        text=True,
        timeout=180,
        env={**os.environ, 'PYTHONIOENCODING': 'utf-8'}
    )
    elapsed = time.time() - t0
    with open(outpath, 'w', encoding='utf-8') as f:
        f.write(f'=== TEST 25 EXECUTION: exit_code={result.returncode} elapsed={elapsed:.1f}s ===\n')
        f.write(f'CMD: {" ".join(cmd)}\n')
        f.write(f'CWD: {os.getcwd()}\n\n')
        f.write('=== STDOUT ===\n')
        f.write(result.stdout)
        f.write('\n=== STDERR ===\n')
        f.write(result.stderr)
    print(f'WROTE {outpath}, elapsed {elapsed:.1f}s rc={result.returncode}')
except subprocess.TimeoutExpired:
    elapsed = time.time() - t0
    with open(outpath, 'w', encoding='utf-8') as f:
        f.write(f'=== TEST 25 TIMEOUT AFTER {elapsed:.1f}s (exceeded 180s limit) ===\n')
    print(f'TIMEOUT after {elapsed:.1f}s')
except Exception as e:
    with open(outpath, 'w', encoding='utf-8') as f:
        f.write(f'=== TEST 25 EXCEPTION: {type(e).__name__}: {e} ===\n')
    print(f'EXCEPTION: {e}')

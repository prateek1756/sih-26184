import os, sys, subprocess, time

os.chdir(r'c:\Users\Prateek\Desktop\sih\sih-26184\backend')
sys.path.insert(0, os.getcwd())
from dotenv import load_dotenv
load_dotenv('.env')

print('FULL SUITE RUNNER at', time.ctime())
cmd = [sys.executable, '-m', 'pytest', 'tests/', '-v', '--tb=short', '--no-header', '-p', 'no:randomly']
outpath = r'c:\Users\Prateek\Desktop\sih\full_test_output.txt'

t0 = time.time()
try:
    result = subprocess.run(
        cmd, cwd=r'c:\Users\Prateek\Desktop\sih\sih-26184\backend',
        capture_output=True, text=True, timeout=600,
        env={**os.environ, 'PYTHONIOENCODING': 'utf-8'}
    )
    elapsed = time.time() - t0
    with open(outpath, 'w', encoding='utf-8') as f:
        f.write(f'=== FULL TEST SUITE: exit_code={result.returncode} elapsed={elapsed:.1f}s ===\n')
        f.write(f'CMD: {" ".join(cmd)}\n\n')
        f.write('=== STDOUT (last 800 lines) ===\n')
        lines = result.stdout.splitlines()
        f.write('\n'.join(lines[-800:]))
        f.write('\n=== STDERR (last 400 lines) ===\n')
        errlines = result.stderr.splitlines()
        f.write('\n'.join(errlines[-400:]))
    print(f'WROTE {outpath} rc={result.returncode} in {elapsed:.1f}s')
except subprocess.TimeoutExpired:
    elapsed = time.time() - t0
    with open(outpath, 'w', encoding='utf-8') as f:
        f.write(f'TIMEOUT after {elapsed:.1f}s (exceeded 600s limit)\n')
    print('TIMEOUT')

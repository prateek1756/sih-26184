import os, sys, subprocess, time
os.chdir(r'c:\Users\Prateek\Desktop\sih\sih-26184\backend')
sys.path.insert(0, os.getcwd())
from dotenv import load_dotenv
load_dotenv('.env')

outpath = r'c:\Users\Prateek\Desktop\sih\forensic_runtime.txt'
cmd = [sys.executable, 'forensic_runtime.py']

print('Starting forensic_runtime harness at', time.ctime())
t0 = time.time()
try:
    result = subprocess.run(
        cmd, cwd=r'c:\Users\Prateek\Desktop\sih\sih-26184\backend',
        capture_output=True, text=True, timeout=500,
        env={**os.environ, 'PYTHONIOENCODING': 'utf-8'}
    )
    elapsed = time.time() - t0
    with open(outpath, 'w', encoding='utf-8') as f:
        f.write(f'=== FORENSIC RUNTIME EXEC: rc={result.returncode} elapsed={elapsed:.1f}s ===\n')
        f.write(f'CMD: {" ".join(cmd)}\n\n')
        f.write('=== STDOUT (all) ===\n')
        f.write(result.stdout)
        f.write('\n=== STDERR (all) ===\n')
        f.write(result.stderr[-6000:])
    print(f'WROTE {outpath} rc={result.returncode} in {elapsed:.1f}s')
except subprocess.TimeoutExpired:
    elapsed = time.time() - t0
    with open(outpath, 'w', encoding='utf-8') as f:
        f.write(f'TIMEOUT after {elapsed:.1f}s (500s limit)\n')
    print('TIMEOUT')

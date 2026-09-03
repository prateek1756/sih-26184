import os, sys
os.chdir(r'c:\Users\Prateek\Desktop\sih\sih-26184\backend')
sys.path.insert(0, os.getcwd())

from dotenv import load_dotenv
load_dotenv('.env')  # explicitly
print('SYNC_DB:', os.environ.get('SYNC_DATABASE_URL', 'NOT SET'))
print('TEST SYNC:', os.environ.get('SYNC_TEST_DATABASE_URL', 'NOT SET'))

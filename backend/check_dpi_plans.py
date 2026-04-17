
import os
import sys
import django

# Setup django
sys.path.append('c:\\Mujoco Projects\\vninvest\\backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from portfolio.opencore_dpi import DPIPlan

plans = DPIPlan.objects.all()
print(f"Found {plans.count()} plans.")
for p in plans:
    print(f"- {p.name}: {p.display_name}")

if plans.count() == 0:
    print("WARNING: No plans found! This is likely causing the 500 error.")

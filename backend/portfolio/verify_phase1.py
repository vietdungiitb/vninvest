import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from portfolio.models import TrackedSymbol, WhaleServiceJob

def verify():
    print("--- Verification Report: Phase 1 Data Hardening ---")
    
    # 1. Check NULL thresholds
    null_count = TrackedSymbol.objects.filter(whale_alert_threshold_million__isnull=True).count()
    total_count = TrackedSymbol.objects.count()
    
    if null_count == 0:
        print(f"[OK] SUCCESS: No TrackedSymbol has NULL threshold. (Total records: {total_count})")
    else:
        print(f"[ERROR] FAILURE: Found {null_count} records with NULL threshold!")

    # 2. Check WhaleServiceJob model accessibility
    try:
        job_count = WhaleServiceJob.objects.count()
        print(f"[OK] SUCCESS: WhaleServiceJob model is accessible. (Current jobs: {job_count})")
    except Exception as e:
        print(f"[ERROR] FAILURE: Could not access WhaleServiceJob model: {e}")

    # 3. Check is_stale field
    try:
        stale_count = TrackedSymbol.objects.filter(is_stale=True).count()
        print(f"[OK] SUCCESS: is_stale field is accessible. (Stale records: {stale_count})")
    except Exception as e:
        print(f"[ERROR] FAILURE: Could not access is_stale field on TrackedSymbol: {e}")

if __name__ == "__main__":
    verify()

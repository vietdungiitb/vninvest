import os
import django
from datetime import date, time, timedelta

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from portfolio.models import IntradayTick, WhaleAdvisory, WhaleServiceJob
from portfolio.services_whale_compute import WhaleComputeEngine, WhaleBackfillService
from portfolio.whale_service_manager import WhaleJobManager

def verify():
    print("--- Verification Report: Phase 3 Compute Engine ---")
    
    symbol = "VNM"
    trade_date = date(2026, 4, 20)
    
    # 1. Setup Test Data
    print("1. Setting up test ticks...")
    IntradayTick.objects.filter(symbol=symbol, trade_date=trade_date).delete()
    
    # Tick below threshold
    IntradayTick.objects.create(
        symbol=symbol, trade_date=trade_date, trade_time=time(9, 30),
        price=100000, volume=100, side='BUY' # 10M VND
    )
    # Tick above threshold (500M)
    IntradayTick.objects.create(
        symbol=symbol, trade_date=trade_date, trade_time=time(10, 0),
        price=100000, volume=6000, side='BUY' # 600M VND
    )
    
    # 2. Test WhaleComputeEngine
    print("2. Testing WhaleComputeEngine.compute_for_symbol_date...")
    advs, status = WhaleComputeEngine.compute_for_symbol_date(symbol, trade_date, 500_000_000.0)
    print(f"   Status: {status}, Advisories found: {len(advs)}")
    
    if status == 'found' and len(advs) == 1:
        print("   [OK] Found whale signal correctly.")
    else:
        print(f"   [ERROR] Expected 1 whale signal, got {len(advs)} with status {status}")

    # Test zero count
    advs2, status2 = WhaleComputeEngine.compute_for_symbol_date(symbol, trade_date, 1_000_000_000.0)
    print(f"   High threshold status: {status2}, count: {len(advs2)}")
    if status2 == 'zero_count':
        print("   [OK] zero_count detected correctly.")

    # Test no data
    advs3, status3 = WhaleComputeEngine.compute_for_symbol_date(symbol, date(2026, 1, 1), 500_000_000.0)
    print(f"   No data status: {status3}")
    if status3 == 'no_data':
        print("   [OK] no_data detected correctly.")

    # 3. Test WhaleBackfillService
    print("3. Testing WhaleBackfillService.execute_backfill_job...")
    params = {
        "symbols": [symbol],
        "start_date": "2026-04-20",
        "end_date": "2026-04-20",
        "user_id": None
    }
    job, created, st = WhaleJobManager.get_or_create_job(WhaleServiceJob.ServiceType.BACKFILL, params)
    
    success = WhaleBackfillService.execute_backfill_job(job.id, "test-task-p3")
    print(f"   Job execution success: {success}")
    
    job.refresh_from_db()
    print(f"   Final Job Status: {job.status}, Processed: {job.processed_items}")
    
    # Check if WhaleAdvisory was created
    adv_count = WhaleAdvisory.objects.filter(symbol=symbol, created_at__date=trade_date).count()
    print(f"   WhaleAdvisory count in DB: {adv_count}")
    
    if job.status == WhaleServiceJob.StatusChoices.COMPLETED and adv_count == 1:
        print("   [OK] Backfill execution passed.")
    else:
        print("   [ERROR] Backfill execution failed!")

    # Cleanup
    IntradayTick.objects.filter(symbol=symbol, trade_date=trade_date).delete()
    WhaleAdvisory.objects.filter(symbol=symbol, created_at__date=trade_date).delete()
    WhaleServiceJob.objects.all().delete()
    print("   Cleaned up test data.")

if __name__ == "__main__":
    verify()

#!/usr/bin/env python
"""
P3-T03 Shadow Run Testing Script

Purpose: Validate ingest_daily_prices task and verify data parity
Runs: Manual trigger + 3-day monitoring

Usage:
  python manage.py shell < run_p3_shadow_test.py
  OR
  docker exec vninvest-dev-core-api python /app/src/manage.py shell < /app/src/run_p3_shadow_test.py
"""
import json
from datetime import datetime, timedelta
from django.utils import timezone
from data_ingest.models import IngestJob, IngestRun
from data_ingest.tasks import ingest_daily_prices
from market_data.models import DailyPrice, StockProfile

print("=" * 80)
print("P3-T03 Shadow Run Testing — Ingest Daily Prices Task")
print("=" * 80)

# Step 1: Verify database connectivity
print("\n[1] Verifying database connectivity...")
try:
    core_db_stocks = StockProfile.objects.count()
    core_db_prices = DailyPrice.objects.count()
    print(f"  ✓ core_db connected: {core_db_stocks} stocks, {core_db_prices} daily prices")
except Exception as exc:
    print(f"  ✗ core_db connection failed: {exc}")
    exit(1)

# Step 2: Check universe size
print("\n[2] Checking active symbol universe...")
active_symbols = StockProfile.objects.filter(
    status=StockProfile.StatusChoices.ACTIVE
).values_list('symbol', flat=True)
print(f"  Active symbols: {len(active_symbols)}")
print(f"  Sample: {list(active_symbols[:5])}")

# Step 3: Check current DailyPrice counts by date
print("\n[3] Current DailyPrice counts by date...")
from django.db.models import Count
from django.db.models.functions import Cast
from django.db import models as django_models

price_counts = (
    DailyPrice.objects
    .extra(select={'date_only': 'date(date)'})
    .values('date_only')
    .annotate(count=Count('id'))
    .order_by('-date_only')[:5]
)
print(f"  {'Date':<12} | {'Count':<8}")
print(f"  {'-' * 12} | {'-' * 8}")
for pc in price_counts:
    date_str = str(pc['date_only'])
    print(f"  {date_str:<12} | {pc['count']:<8}")

# Step 4: Manually trigger ingest_daily_prices task
print("\n[4] Triggering ingest_daily_prices task (days=1)...")
try:
    task = ingest_daily_prices.apply_async(args=[1, None], countdown=0)
    print(f"  ✓ Task queued: {task.id}")
    
    # Note: Celery result backend may not be available in dev, but task still executes
    print(f"  Note: Task executes asynchronously in worker queue")
    print(f"  Monitor task progress via: /core/v1/data-ingest/runs/ (paginated list)")
    
except Exception as exc:
    print(f"  ✗ Task queue failed: {exc}")
    import traceback
    traceback.print_exc()
    # Don't exit - continue to check IngestRun records

# Step 5: Check IngestRun history
print("\n[5] Recent IngestRun records...")
recent_runs = IngestRun.objects.filter(
    job__isnull=True  # Manual trigger runs have no job
).order_by('-started_at')[:5]

if not recent_runs:
    print("  (No manual ingest runs yet)")
else:
    print(f"  {'Started':<19} | {'State':<10} | {'Rows Upserted':<14} | {'Error':<50}")
    print(f"  {'-' * 19} | {'-' * 10} | {'-' * 14} | {'-' * 50}")
    for run in recent_runs:
        started = run.started_at.strftime('%Y-%m-%d %H:%M:%S')
        error = (run.error_message[:50] if run.error_message else '-')
        print(f"  {started} | {run.state:<10} | {run.rows_upserted:<14} | {error}")

# Step 6: Print parity check instructions
print("\n[6] Parity Check Instructions (for 3-day shadow run)...")
print("""
  Daily checklist (repeat for 3 trading days):
  
  1. Verify task executed at 17:05 ICT (10:05 UTC)
     - Check: IngestRun.objects.latest('started_at').state == 'success'
     - Expect: 0 errors, rows_upserted >= 60 (one per active symbol)
  
  2. Check new DailyPrice records
     - SELECT COUNT(*), MAX(date) FROM market_data_dailyprice;
     - Expect: Row count increases, MAX(date) = today
  
  3. Verify no data loss
     - Legacy count (vninvest): SELECT COUNT(*) FROM portfolio_market_dailyprice;
     - Core count (core_db):    SELECT COUNT(*) FROM market_data_dailyprice;
     - Expect: core_db >= vninvest (no data loss)
  
  4. Monitor error rates
     - SELECT COUNT(*) FROM market_data_ingestrun WHERE state='failed' AND started_at >= NOW()-3DAY;
     - Expect: 0 failed runs (100% success rate)
  
  5. Check task execution time
     - SELECT finished_at - started_at FROM market_data_ingestrun WHERE ... ORDER BY started_at DESC LIMIT 1;
     - Expect: < 5 minutes per run (target: < 3 minutes)

  After 3 days of successful shadow run:
  - Disable old schedule: CELERY_BEAT_SCHEDULE['daily-backfill-prices-1700']['enabled'] = False
  - Enable new schedule: CELERY_BEAT_SCHEDULE['ingest-daily-prices-1705']['enabled'] = True
  - Push to production
""")

print("\n" + "=" * 80)
print("Shadow run initiated. Monitor /core/v1/data-ingest/runs/ for progress.")
print("=" * 80)

#!/usr/bin/env python
import os
import sys
import django

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

django.setup()

from portfolio.models import WhaleAlertEvent
from django.db import connection

# Check table stats
print("=" * 60)
print("WHALE ALERT DATA AUDIT")
print("=" * 60)

# Count
count = WhaleAlertEvent.objects.count()
print(f"\n1. WhaleAlertEvent.objects.count(): {count}")

if count == 0:
    print("   ⚠️  NO WHALE EVENTS FOUND - Table is empty")
else:
    print(f"   ✅ Found {count} whale events")
    
    # Recent samples
    recent = WhaleAlertEvent.objects.order_by('-occurred_at')[:3]
    print(f"\n   Recent samples:")
    for evt in recent:
        print(f"     - {evt.symbol} {evt.side} {evt.matched_value_vnd:,.0f} VND @ {evt.occurred_at}")

# Check if table exists
with connection.cursor() as cursor:
    cursor.execute("""
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = 'portfolio_whalealertevent'
        )
    """)
    exists = cursor.fetchone()[0]
    print(f"\n2. Table 'portfolio_whalealertevent' exists: {exists}")

# Check Celery task schedule
from django.conf import settings
beat_schedule = getattr(settings, 'CELERY_BEAT_SCHEDULE', {})
whale_task = beat_schedule.get('detect-global-whale-alerts')
print(f"\n3. Celery BEAT_SCHEDULE has 'detect-global-whale-alerts': {whale_task is not None}")
if whale_task:
    print(f"   Task: {whale_task.get('task')}")
    print(f"   Schedule: {whale_task.get('schedule')}")

# Check env config
whale_enabled = getattr(settings, 'WHALE_ALERT_DETECTION_ENABLED', False)
whale_interval = getattr(settings, 'WHALE_ALERT_DETECTION_INTERVAL_SECONDS', None)
print(f"\n4. Settings:")
print(f"   WHALE_ALERT_DETECTION_ENABLED: {whale_enabled}")
print(f"   WHALE_ALERT_DETECTION_INTERVAL_SECONDS: {whale_interval}")

print("\n" + "=" * 60)

import os, sys, django
sys.path.insert(0, '/app/src')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')
django.setup()

from django.db import connection

print('=== DB TABLES WITH DATA ===')
cursor = connection.cursor()
cursor.execute("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")
tables = [r[0] for r in cursor.fetchall()]
for t in tables:
    try:
        cursor.execute('SELECT COUNT(*) FROM "' + t + '"')
        cnt = cursor.fetchone()[0]
        if cnt > 0:
            print('  ' + t + ': ' + str(cnt) + ' rows')
    except Exception as e:
        pass

print()
print('=== CELERY PERIODIC TASKS ===')
try:
    from django_celery_beat.models import PeriodicTask
    tasks = PeriodicTask.objects.filter(enabled=True).order_by('name')
    for t in tasks:
        last = str(t.last_run_at) if t.last_run_at else 'NEVER'
        print('  ' + t.name + ' | last_run=' + last)
except Exception as e:
    print('Error: ' + str(e))

print()
print('=== CELERY TASK RESULTS (last 10 failures) ===')
try:
    from django_celery_results.models import TaskResult
    fails = TaskResult.objects.filter(status__in=['FAILURE', 'REVOKED']).order_by('-date_done')[:10]
    for r in fails:
        print('  FAIL: ' + r.task_name + ' @ ' + str(r.date_done))
        print('        ' + str(r.result)[:200])
except Exception as e:
    print('Error: ' + str(e))

print()
print('=== MARKET DATA FRESHNESS ===')
cursor2 = connection.cursor()

# Check intraday data
try:
    cursor2.execute("SELECT symbol, timestamp, price, change_pct FROM market_data_intradaytickersnapshot ORDER BY timestamp DESC LIMIT 5")
    rows = cursor2.fetchall()
    print('Intraday ticker snapshots (latest 5):')
    for r in rows:
        print('  ' + str(r))
except Exception as e:
    print('IntradayTickerSnapshot: ' + str(e))

# Check daily price
try:
    cursor2.execute("SELECT symbol, date, close FROM market_data_dailyprice ORDER BY date DESC LIMIT 5")
    rows = cursor2.fetchall()
    print('Daily prices (latest 5):')
    for r in rows:
        print('  ' + str(r))
except Exception as e:
    print('DailyPrice: ' + str(e))

# Check reference price
try:
    cursor2.execute("SELECT symbol, date FROM market_data_referenceprice ORDER BY date DESC LIMIT 5")
    rows = cursor2.fetchall()
    print('Reference prices (latest 5):')
    for r in rows:
        print('  ' + str(r))
except Exception as e:
    print('ReferencePrice: ' + str(e))

# Check whale/order flow
try:
    cursor2.execute("SELECT symbol, timestamp FROM market_data_orderflowsnapshot ORDER BY timestamp DESC LIMIT 5")
    rows = cursor2.fetchall()
    print('OrderFlow snapshots (latest 5):')
    for r in rows:
        print('  ' + str(r))
except Exception as e:
    print('OrderFlowSnapshot: ' + str(e))

# Check session facts
try:
    cursor2.execute("SELECT tablename FROM pg_tables WHERE tablename LIKE '%session%' OR tablename LIKE '%whale%' OR tablename LIKE '%orderflow%' OR tablename LIKE '%intraday%' OR tablename LIKE '%daily%' OR tablename LIKE '%reference%'")
    rows = cursor2.fetchall()
    print('Relevant tables: ' + str([r[0] for r in rows]))
except Exception as e:
    print('Table scan error: ' + str(e))

print()
print('=== REDIS QUEUE STATUS ===')
try:
    import redis
    r = redis.from_url(os.environ.get('REDIS_URL', 'redis://core-redis:6379/1'))
    keys = r.keys('*')
    print('Redis keys count: ' + str(len(keys)))
    for k in sorted(keys)[:30]:
        key_str = k.decode() if isinstance(k, bytes) else str(k)
        t = r.type(k).decode()
        if t == 'list':
            length = r.llen(k)
            print('  [list] ' + key_str + ': ' + str(length) + ' items')
        else:
            print('  [' + t + '] ' + key_str)
except Exception as e:
    print('Redis error: ' + str(e))

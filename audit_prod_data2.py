import os, sys, django
sys.path.insert(0, '/app/src')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')
django.setup()

from django.db import connection
cursor = connection.cursor()

print('=== market_serving_symbolsnapshot (latest 10) ===')
try:
    cursor.execute("""
        SELECT symbol, timestamp, price, change_pct, volume_today,
               buy_vol_total, sell_vol_total
        FROM market_serving_symbolsnapshot
        ORDER BY timestamp DESC LIMIT 10
    """)
    rows = cursor.fetchall()
    for r in rows:
        print('  ' + str(r))
    if not rows:
        print('  EMPTY')
except Exception as e:
    print('Error: ' + str(e))

print()
print('=== market_serving_sessionfacts (latest 10) ===')
try:
    cursor.execute("""
        SELECT symbol, trading_date, close_price, ref_price, change_pct
        FROM market_serving_sessionfacts
        ORDER BY trading_date DESC LIMIT 10
    """)
    rows = cursor.fetchall()
    for r in rows:
        print('  ' + str(r))
    if not rows:
        print('  EMPTY')
except Exception as e:
    print('  columns error, trying describe...')
    try:
        cursor.execute("""
            SELECT column_name FROM information_schema.columns
            WHERE table_name='market_serving_sessionfacts'
            ORDER BY ordinal_position
        """)
        cols = [r[0] for r in cursor.fetchall()]
        print('  Columns: ' + str(cols))
        cursor.execute('SELECT * FROM market_serving_sessionfacts ORDER BY 1 DESC LIMIT 5')
        rows = cursor.fetchall()
        for r in rows:
            print('  ' + str(r))
    except Exception as e2:
        print('  Fatal: ' + str(e2))

print()
print('=== market_serving_sessionfactsbucket (latest 5) ===')
try:
    cursor.execute("""
        SELECT column_name FROM information_schema.columns
        WHERE table_name='market_serving_sessionfactsbucket'
        ORDER BY ordinal_position
    """)
    cols = [r[0] for r in cursor.fetchall()]
    print('  Columns: ' + str(cols))
    cursor.execute('SELECT COUNT(*) FROM market_serving_sessionfactsbucket')
    cnt = cursor.fetchone()[0]
    print('  Count: ' + str(cnt))
    if cnt > 0:
        cursor.execute('SELECT * FROM market_serving_sessionfactsbucket ORDER BY 1 DESC LIMIT 3')
        rows = cursor.fetchall()
        for r in rows:
            print('  ' + str(r)[:200])
except Exception as e:
    print('Error: ' + str(e))

print()
print('=== market_data_intraday_bar freshness ===')
try:
    cursor.execute("""
        SELECT symbol, ts, open, high, low, close, volume
        FROM market_data_intraday_bar
        ORDER BY ts DESC LIMIT 10
    """)
    rows = cursor.fetchall()
    for r in rows:
        print('  ' + str(r))
    if not rows:
        print('  EMPTY')
except Exception as e:
    print('Error: ' + str(e))
    try:
        cursor.execute("""
            SELECT column_name FROM information_schema.columns
            WHERE table_name='market_data_intraday_bar'
        """)
        cols = [r[0] for r in cursor.fetchall()]
        print('  Columns: ' + str(cols))
    except:
        pass

print()
print('=== market_data_intraday_tick freshness ===')
try:
    cursor.execute("""
        SELECT column_name FROM information_schema.columns
        WHERE table_name='market_data_intraday_tick'
        ORDER BY ordinal_position
    """)
    cols = [r[0] for r in cursor.fetchall()]
    print('  Columns: ' + str(cols))
    cursor.execute('SELECT * FROM market_data_intraday_tick ORDER BY 1 DESC LIMIT 5')
    rows = cursor.fetchall()
    for r in rows:
        print('  ' + str(r)[:200])
except Exception as e:
    print('Error: ' + str(e))

print()
print('=== daily-backfill last runs ===')
try:
    from service_ops.models import ServiceRunLog
    logs = ServiceRunLog.objects.filter(
        service_name__icontains='backfill'
    ).order_by('-started_at')[:10]
    for l in logs:
        print('  ' + l.service_name + ' | ' + str(l.started_at) + ' | ' + l.status)
except Exception as e:
    print('Error: ' + str(e))
    try:
        cursor.execute("""
            SELECT service_name, started_at, finished_at, status
            FROM service_ops_servicerunlog
            WHERE service_name ILIKE '%backfill%' OR service_name ILIKE '%intraday%' OR service_name ILIKE '%realtime%'
            ORDER BY started_at DESC LIMIT 20
        """)
        rows = cursor.fetchall()
        for r in rows:
            print('  ' + str(r))
    except Exception as e2:
        print('Fatal: ' + str(e2))

print()
print('=== signal_intelligence_orderflowevent freshness ===')
try:
    cursor.execute("""
        SELECT column_name FROM information_schema.columns
        WHERE table_name='signal_intelligence_orderflowevent'
        ORDER BY ordinal_position
    """)
    cols = [r[0] for r in cursor.fetchall()]
    print('  Columns: ' + str(cols))
    cursor.execute('SELECT * FROM signal_intelligence_orderflowevent ORDER BY 1 DESC LIMIT 5')
    rows = cursor.fetchall()
    for r in rows:
        print('  ' + str(r)[:200])
except Exception as e:
    print('Error: ' + str(e))

print()
print('=== signal_intelligence_whalealertcanonical freshness ===')
try:
    cursor.execute("""
        SELECT column_name FROM information_schema.columns
        WHERE table_name='signal_intelligence_whalealertcanonical'
        ORDER BY ordinal_position LIMIT 10
    """)
    cols = [r[0] for r in cursor.fetchall()]
    print('  Columns: ' + str(cols))
    cursor.execute('SELECT * FROM signal_intelligence_whalealertcanonical ORDER BY 1 DESC LIMIT 3')
    rows = cursor.fetchall()
    for r in rows:
        print('  ' + str(r)[:250])
except Exception as e:
    print('Error: ' + str(e))

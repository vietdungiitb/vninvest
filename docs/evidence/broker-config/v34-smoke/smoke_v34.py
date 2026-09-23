"""S5 smoke Phase A: vnbroker v3.4.0 thật (pip từ GitHub SHA 1ff04e60).

Chạy: PYTHONPATH=packages/core/backend/src DJANGO_DEBUG=true \
  DNSE_API_KEY=... DNSE_API_SECRET=... \
  .venv/Scripts/python.exe docs/evidence/broker-config/v34-smoke/smoke_v34.py
Assert NON-EMPTY (C3: lỗi câm lặng trả rỗng, không crash).
Các hàm chạm cache/DB được bỏ qua khi redis down (ghi rõ SKIP).
"""
import os
import sys
import traceback

sys.path.insert(0, 'packages/core/backend/src')
os.environ.setdefault('DJANGO_DEBUG', 'true')

import django  # noqa: E402

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')
django.setup()

from market_data import vnbroker_adapter as adapter  # noqa: E402

results = []


def check(name, fn):
    try:
        detail = fn()
        ok = bool(detail)
        results.append((name, 'PASS' if ok else 'EMPTY', str(detail)[:220]))
    except Exception as exc:  # noqa: BLE001
        results.append((name, 'ERROR', f'{type(exc).__name__}: {exc}'))
        traceback.print_exc()


def t_realtime():
    r = adapter.fetch_realtime_price('SSI', source='KBS')
    assert r and float(r.get('close') or 0) > 0, f'empty: {r}'
    return f"{r['symbol']} close={r['close']} source={r['source']}"


def t_company():
    info = adapter.fetch_company_info('FPT', source='KBS')
    overview = (info or {}).get('overview') or {}
    assert overview, 'overview empty'
    return f"overview keys={sorted(overview.keys())[:6]}"


def t_finance():
    fin = adapter.fetch_company_financials('FPT', source='KBS')
    assert fin and (fin.get('ratio') or fin.get('ratios')), 'financials empty'
    return f"keys={sorted(fin.keys())}"


def t_news():
    from vnbroker.api.news import News
    df = News(source='KBS').by_symbol('SSI')
    assert df is not None and not df.empty, 'news empty'
    return f'rows={len(df)} cols={list(df.columns)[:5]}'


def t_dnse_guard():
    out = adapter.fetch_intraday_tape_history('HPG', '2026-09-22')
    assert out == [], f'expected [] without key, got {len(out)} rows'
    return 'empty-keys → [] (except bọc sẵn, S3 đã revert)'


def t_dnse_live():
    key = os.environ.get('DNSE_API_KEY', '')
    sec = os.environ.get('DNSE_API_SECRET', '')
    if not key or not sec:
        return 'SKIP (no DNSE key env)'
    out = adapter.fetch_intraday_tape_history(
        'HPG', '2026-09-22', api_key=key, api_secret=sec)
    return f'rows={len(out)} (empty chấp nhận được ngoài phiên/không dữ liệu)'


check('realtime SSI (VCI/KBS, non-empty)', t_realtime)
check('company FPT overview (api.company, non-empty)', t_company)
check('financials FPT (api.financial, non-empty)', t_finance)
check('news SSI KBS (api.news, non-empty)', t_news)
check('DNSE guard thiếu key → []', t_dnse_guard)
check('DNSE live 2026-09-22 (nếu có key)', t_dnse_live)

print('\n==== SMOKE SUMMARY ====')
failed = 0
for name, status, detail in results:
    safe = str(detail).encode('ascii', 'replace').decode()
    safe_name = str(name).encode('ascii', 'replace').decode()
    print(f'[{status}] {safe_name} :: {safe}')
    if status in ('EMPTY', 'ERROR'):
        failed += 1
print(f'TOTAL {len(results)} / FAIL {failed}')
sys.exit(1 if failed else 0)

"""A5 benchmark: fetch_multiple KBS ở các max_concurrency (giữ nguyên payload 20 mã)."""
import sys
import time

sys.path.insert(0, 'packages/core/backend/src')

from vnbroker.explorer.kbs.quote import Quote

SYMBOLS = ['SSI', 'HPG', 'VNM', 'VCB', 'FPT', 'MBB', 'TCB', 'VIC', 'VHM', 'MSN',
           'ACB', 'CTG', 'BID', 'GAS', 'PLX', 'POW', 'MWG', 'PNJ', 'SAB', 'VRE']

for level in (8, 16, 32):
    t0 = time.perf_counter()
    try:
        dfs = Quote.fetch_multiple(
            symbols=SYMBOLS, start='2026-09-18', end='2026-09-22',
            interval='1D', show_log=False, max_concurrency=level)
        if __import__('asyncio').iscoroutine(dfs):
            import asyncio
            dfs = asyncio.run(dfs)
        ok = sum(1 for df in dfs if df is not None and not df.empty)
    except Exception as exc:  # noqa: BLE001
        print(f'level={level} ERROR {type(exc).__name__}: {exc}')
        continue
    dt = time.perf_counter() - t0
    print(f'level={level} ok={ok}/{len(SYMBOLS)} secs={dt:.1f} throughput={ok / dt:.1f}/s')

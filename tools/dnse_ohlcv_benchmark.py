"""
tools/dnse_ohlcv_benchmark.py
─────────────────────────────────────────────────────────────────────────────
Benchmark DNSE OHLCV (history) so với VCI/KBS cho daily price backfill.

Mục tiêu:
  1. Đo latency per-symbol (min/avg/median/p95/max).
  2. Xác nhận DNSE trả đủ 5 năm lịch sử (1825 ngày).
  3. So sánh số row thực tế DNSE vs VCI trên cùng symbol.
  4. Phát hiện lỗi 401/403/timeout → quyết định DNSE có dùng được làm fallback không.

Chạy:
  docker exec -it vninvest-dev-core-worker-enrichment \
      python /app/tools/dnse_ohlcv_benchmark.py

Yêu cầu env vars trong container:
  DNSE_API_KEY=...
  DNSE_API_SECRET=...

Nếu credentials thiếu, script in hướng dẫn và thoát ngay.
"""
from __future__ import annotations

import os
import sys
import time
import statistics
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, timedelta
from typing import NamedTuple

# ─── credential guard ────────────────────────────────────────────────────────
_API_KEY = os.environ.get("DNSE_API_KEY", "")
_API_SECRET = os.environ.get("DNSE_API_SECRET", "")
if not _API_KEY or not _API_SECRET:
    print(
        "\n[BENCHMARK] DNSE credentials not set.\n"
        "  1. Mở compose.dev.env\n"
        "  2. Bỏ comment và điền:\n"
        "       DNSE_API_KEY=<your_key>\n"
        "       DNSE_API_SECRET=<your_secret>\n"
        "  3. Restart enrichment worker:\n"
        "       docker compose --env-file compose.dev.env up -d core-worker-enrichment\n"
        "  4. Chạy lại: docker exec -it vninvest-dev-core-worker-enrichment "
        "python /app/tools/dnse_ohlcv_benchmark.py\n"
    )
    sys.exit(1)

# ─── test symbols: mix large-cap + mid + small VN stocks ─────────────────────
_SYMBOLS_25 = [
    # Large-cap VN30
    "VNM", "VCB", "HPG", "VIC", "BID", "CTG", "TCB", "VHM", "MBB", "ACB",
    # Mid-cap
    "FPT", "REE", "PNJ", "MWG", "DGC", "GMD", "HAH", "KDH", "NLG", "VRE",
    # Smaller / volatile
    "HBC", "DIG", "PDR", "CII", "FCN",
]

_DAYS_DEEP = 1825      # 5 năm — mục tiêu deep history
_DAYS_SHORT = 365      # 1 năm — warm
_INTERVAL = "1D"
_MAX_WORKERS = 4       # concurrent threads trong benchmark

_END = date.today().isoformat()
_START_DEEP = (date.today() - timedelta(days=_DAYS_DEEP)).isoformat()
_START_SHORT = (date.today() - timedelta(days=_DAYS_SHORT)).isoformat()


# ─── result container ─────────────────────────────────────────────────────────
class Result(NamedTuple):
    symbol: str
    provider: str
    rows: int
    earliest: str        # earliest date in returned data
    elapsed_s: float
    error: str           # empty = success


def _fetch_dnse(symbol: str, start: str, end: str) -> Result:
    """Single DNSE history call — catch all exceptions."""
    from vnbroker.explorer.dnse.quote import DNSEQuote

    t0 = time.perf_counter()
    try:
        q = DNSEQuote(symbol=symbol, api_key=_API_KEY, api_secret=_API_SECRET, show_log=False)
        df = q.history(start=start, end=end, interval=_INTERVAL)
        elapsed = time.perf_counter() - t0
        if df is None or df.empty:
            return Result(symbol, "DNSE", 0, "", elapsed, "empty_response")
        earliest = str(df["time"].min())[:10] if "time" in df.columns else "?"
        return Result(symbol, "DNSE", len(df), earliest, elapsed, "")
    except Exception as exc:
        elapsed = time.perf_counter() - t0
        return Result(symbol, "DNSE", 0, "", elapsed, str(exc)[:120])


def _fetch_vci(symbol: str, start: str, end: str) -> Result:
    """Single VCI history call for comparison."""
    from vnbroker.explorer.vci.quote import Quote as VCIQuote

    t0 = time.perf_counter()
    try:
        q = VCIQuote(symbol=symbol, show_log=False)
        df = q.history(start=start, end=end, interval=_INTERVAL, show_log=False)
        elapsed = time.perf_counter() - t0
        if df is None or df.empty:
            return Result(symbol, "VCI", 0, "", elapsed, "empty_response")
        earliest = str(df["time"].min())[:10] if "time" in df.columns else "?"
        return Result(symbol, "VCI", len(df), earliest, elapsed, "")
    except Exception as exc:
        elapsed = time.perf_counter() - t0
        return Result(symbol, "VCI", 0, "", elapsed, str(exc)[:120])


def _run_parallel(fn, symbols, start, end, workers=_MAX_WORKERS) -> list[Result]:
    results: list[Result] = []
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(fn, s, start, end): s for s in symbols}
        for fut in as_completed(futures):
            results.append(fut.result())
    return sorted(results, key=lambda r: r.symbol)


def _print_table(results: list[Result], label: str):
    ok = [r for r in results if not r.error]
    err = [r for r in results if r.error]
    latencies = [r.elapsed_s for r in ok]

    print(f"\n{'='*70}")
    print(f"  {label}  ({len(results)} symbols, {len(ok)} OK, {len(err)} errors)")
    print(f"{'='*70}")
    print(f"  {'Symbol':<8}  {'Rows':>5}  {'Earliest':^12}  {'Elapsed':>8}  Status")
    print(f"  {'-'*8}  {'-'*5}  {'-'*12}  {'-'*8}  {'-'*30}")
    for r in results:
        status = "OK" if not r.error else f"ERR: {r.error[:35]}"
        print(f"  {r.symbol:<8}  {r.rows:>5}  {r.earliest:^12}  {r.elapsed_s:>7.2f}s  {status}")

    if latencies:
        print(f"\n  Latency (OK symbols only):")
        print(f"    min    = {min(latencies):.2f}s")
        print(f"    median = {statistics.median(latencies):.2f}s")
        print(f"    avg    = {statistics.mean(latencies):.2f}s")
        print(f"    p95    = {sorted(latencies)[int(len(latencies)*0.95)-1]:.2f}s"
              if len(latencies) >= 5 else "    p95 = N/A (need >=5 samples)")
        print(f"    max    = {max(latencies):.2f}s")
        # depth check
        deep_ok = [r for r in ok if r.earliest and r.earliest < _START_DEEP[:7]]
        print(f"\n  History depth: {len(deep_ok)}/{len(ok)} symbols returned data before {_START_DEEP}")
    print()


def _compare_table(dnse_results: list[Result], vci_results: list[Result]):
    vci_map = {r.symbol: r for r in vci_results}
    print(f"\n{'='*70}")
    print(f"  DNSE vs VCI Comparison (5-year range)")
    print(f"{'='*70}")
    print(f"  {'Symbol':<8}  {'DNSE rows':>9}  {'VCI rows':>8}  {'DNSE s':>7}  {'VCI s':>7}  {'Speedup':>8}")
    print(f"  {'-'*8}  {'-'*9}  {'-'*8}  {'-'*7}  {'-'*7}  {'-'*8}")
    speedups = []
    for r in sorted(dnse_results, key=lambda x: x.symbol):
        v = vci_map.get(r.symbol)
        if v is None:
            continue
        speedup = v.elapsed_s / r.elapsed_s if r.elapsed_s > 0 else 0
        speedups.append(speedup)
        flag = "★" if speedup > 2 else ""
        print(f"  {r.symbol:<8}  {r.rows:>9}  {v.rows:>8}  {r.elapsed_s:>6.2f}s  {v.elapsed_s:>6.2f}s  {speedup:>7.1f}x {flag}")
    if speedups:
        print(f"\n  DNSE avg speedup vs VCI: {statistics.mean(speedups):.1f}x")
        print(f"  DNSE median speedup vs VCI: {statistics.median(speedups):.1f}x")
    print()


if __name__ == "__main__":
    print("\n" + "="*70)
    print("  DNSE OHLCV Benchmark")
    print(f"  Symbols: {len(_SYMBOLS_25)} | Deep range: {_START_DEEP} → {_END}")
    print(f"  Workers: {_MAX_WORKERS}")
    print("="*70)

    # ── Phase 1: DNSE deep history (5 yr) ────────────────────────────────────
    print(f"\n[1/3] DNSE history — 5-year range ({_START_DEEP} → {_END}) ...")
    dnse_deep = _run_parallel(_fetch_dnse, _SYMBOLS_25, _START_DEEP, _END)
    _print_table(dnse_deep, "DNSE — 5-year history")

    # ── Phase 2: VCI deep history for comparison (sequential to avoid overload) ──
    print(f"\n[2/3] VCI history — 5-year range for comparison (sequential, may be slow) ...")
    vci_deep = _run_parallel(_fetch_vci, _SYMBOLS_25, _START_DEEP, _END, workers=1)
    _print_table(vci_deep, "VCI — 5-year history (sequential)")

    # ── Phase 3: Compare ─────────────────────────────────────────────────────
    print(f"\n[3/3] Comparison ...")
    _compare_table(dnse_deep, vci_deep)

    # ── Verdict ──────────────────────────────────────────────────────────────
    dnse_ok = [r for r in dnse_deep if not r.error and r.rows > 0]
    dnse_deep_ok = [r for r in dnse_ok if r.earliest and r.earliest < _START_DEEP[:7]]
    print("=" * 70)
    print("  VERDICT")
    print("=" * 70)
    print(f"  DNSE OK rate: {len(dnse_ok)}/{len(_SYMBOLS_25)} ({100*len(dnse_ok)/len(_SYMBOLS_25):.0f}%)")
    if dnse_ok:
        print(f"  5-year depth OK: {len(dnse_deep_ok)}/{len(dnse_ok)}"
              + (" ← PASS" if len(dnse_deep_ok) >= len(dnse_ok) * 0.9 else " ← FAIL (< 90%)"))
        avg_lat = statistics.mean(r.elapsed_s for r in dnse_ok)
        print(f"  Avg latency: {avg_lat:.2f}s/symbol")
        verdict = "SUITABLE as fallback" if len(dnse_ok) >= 20 and len(dnse_deep_ok) >= 18 else "NOT ready — too many gaps"
        print(f"\n  → {verdict}")
    else:
        print("  5-year depth OK: 0/0 ← FAIL (no successful DNSE samples)")
        print("\n  → NOT ready — no valid DNSE daily history sample")
    print()

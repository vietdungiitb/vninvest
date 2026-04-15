from __future__ import annotations

import argparse
import json
import random
import statistics
import threading
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass


@dataclass
class RequestResult:
    latency_ms: float
    status_code: int
    ok: bool
    error: str | None = None


def _single_request(base_url: str, symbol: str, token: str | None, timeout: float) -> RequestResult:
    url = f"{base_url.rstrip('/')}/api/realtime/ticker/{symbol}/"
    request = urllib.request.Request(url, method='GET')
    if token:
        request.add_header('Authorization', f'Bearer {token}')

    started = time.perf_counter()
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            body = response.read()
            _ = json.loads(body.decode('utf-8')) if body else {}
            latency_ms = (time.perf_counter() - started) * 1000.0
            status_code = int(getattr(response, 'status', 200))
            return RequestResult(latency_ms=latency_ms, status_code=status_code, ok=200 <= status_code < 400)
    except urllib.error.HTTPError as exc:
        latency_ms = (time.perf_counter() - started) * 1000.0
        return RequestResult(latency_ms=latency_ms, status_code=int(exc.code), ok=False, error=str(exc))
    except Exception as exc:  # pragma: no cover
        latency_ms = (time.perf_counter() - started) * 1000.0
        return RequestResult(latency_ms=latency_ms, status_code=0, ok=False, error=str(exc))


def percentile(values: list[float], p: float) -> float:
    if not values:
        return 0.0
    if len(values) == 1:
        return float(values[0])
    values_sorted = sorted(values)
    k = (len(values_sorted) - 1) * p
    f = int(k)
    c = min(f + 1, len(values_sorted) - 1)
    if f == c:
        return float(values_sorted[f])
    return float(values_sorted[f] + (values_sorted[c] - values_sorted[f]) * (k - f))


def main() -> int:
    parser = argparse.ArgumentParser(description='Realtime ticker load test (cache-only hot path).')
    parser.add_argument('--base-url', default='http://127.0.0.1:8000', help='Backend base URL')
    parser.add_argument('--token', default='', help='JWT bearer token (optional if endpoint is public)')
    parser.add_argument('--symbols', default='FPT,HPG,VCB,VIC,VNM,SSI,TPB,MBB,MWG,ACB', help='Comma-separated symbols')
    parser.add_argument('--duration-seconds', type=int, default=120, help='Total test duration in seconds')
    parser.add_argument('--target-rpm', type=int, default=6000, help='Target requests per minute')
    parser.add_argument('--concurrency', type=int, default=32, help='Worker thread count')
    parser.add_argument('--timeout-seconds', type=float, default=3.0, help='Per-request timeout')
    parser.add_argument('--seed', type=int, default=42, help='Random seed')
    args = parser.parse_args()

    random.seed(args.seed)
    symbols = [s.strip().upper() for s in str(args.symbols).split(',') if s.strip()]
    if not symbols:
        print('[load-test] No symbols provided')
        return 2

    total_target = max(int(args.target_rpm * args.duration_seconds / 60), 1)
    rps = max(float(args.target_rpm) / 60.0, 1.0)
    spacing = 1.0 / rps

    print('[load-test] Starting realtime ticker load test')
    print(f'[load-test] base_url={args.base_url} duration={args.duration_seconds}s target_rpm={args.target_rpm} concurrency={args.concurrency}')
    print(f'[load-test] planned_requests={total_target} symbols={len(symbols)}')

    lock = threading.Lock()
    results: list[RequestResult] = []

    start = time.perf_counter()

    def submit_task(index: int) -> RequestResult:
        symbol = symbols[index % len(symbols)] if len(symbols) <= 32 else random.choice(symbols)
        return _single_request(args.base_url, symbol, args.token or None, args.timeout_seconds)

    with ThreadPoolExecutor(max_workers=max(args.concurrency, 1)) as pool:
        futures = []
        for i in range(total_target):
            desired = start + (i * spacing)
            now = time.perf_counter()
            if desired > now:
                time.sleep(desired - now)
            futures.append(pool.submit(submit_task, i))

        for future in futures:
            result = future.result()
            with lock:
                results.append(result)

    elapsed = max(time.perf_counter() - start, 0.001)
    latencies = [r.latency_ms for r in results]
    success = [r for r in results if r.ok]
    errors = [r for r in results if not r.ok]

    status_counts: dict[int, int] = {}
    for item in results:
        status_counts[item.status_code] = status_counts.get(item.status_code, 0) + 1

    achieved_rpm = len(results) / elapsed * 60.0
    error_rate = (len(errors) / len(results)) if results else 1.0

    print('\n[load-test] Summary')
    print(f'[load-test] total={len(results)} success={len(success)} errors={len(errors)} error_rate={error_rate:.4f}')
    print(f'[load-test] elapsed_seconds={elapsed:.2f} achieved_rpm={achieved_rpm:.2f}')
    print(f'[load-test] latency_ms_avg={statistics.mean(latencies):.2f}' if latencies else '[load-test] latency_ms_avg=0.00')
    print(f'[load-test] latency_ms_p50={percentile(latencies, 0.50):.2f}')
    print(f'[load-test] latency_ms_p95={percentile(latencies, 0.95):.2f}')
    print(f'[load-test] latency_ms_p99={percentile(latencies, 0.99):.2f}')
    print(f'[load-test] status_counts={json.dumps(status_counts, sort_keys=True)}')

    has_429 = status_counts.get(429, 0) > 0
    if has_429:
        print('[load-test] FAIL: detected HTTP 429 under load.')
        return 1

    print('[load-test] PASS: no HTTP 429 detected.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError, as_completed
from dataclasses import dataclass
from datetime import datetime, timezone
import math
import time
from typing import Any

from django.core.cache import cache

from market_data.vnbroker_adapter import fetch_price_board_snapshot

BENCHMARK_CACHE_KEY = 'core_admin_ops:vnbroker:price_board:benchmark:latest'
BENCHMARK_CACHE_TTL_SECONDS = 60 * 60 * 24

DEFAULT_PROVIDERS = ['KBS', 'VCI']
DEFAULT_CONCURRENCY_LEVELS = [2, 4, 8, 16]
SUPPORTED_PROVIDERS = {'VCI', 'KBS', 'DNSE'}


@dataclass
class _Counter:
    total_requests: int = 0
    success_requests: int = 0
    rate_limited_requests: int = 0
    failed_requests: int = 0
    timeout_errors: int = 0
    transport_errors: int = 0

    def merge(self, other: '_Counter') -> None:
        self.total_requests += other.total_requests
        self.success_requests += other.success_requests
        self.rate_limited_requests += other.rate_limited_requests
        self.failed_requests += other.failed_requests
        self.timeout_errors += other.timeout_errors
        self.transport_errors += other.transport_errors


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _normalize_providers(raw: Any) -> list[str]:
    if not isinstance(raw, list):
        return list(DEFAULT_PROVIDERS)
    normalized: list[str] = []
    for item in raw:
        value = str(item or '').strip().upper()
        if not value or value not in SUPPORTED_PROVIDERS or value in normalized:
            continue
        normalized.append(value)
    return normalized or list(DEFAULT_PROVIDERS)


def _normalize_concurrency_levels(raw: Any) -> list[int]:
    if not isinstance(raw, list):
        return list(DEFAULT_CONCURRENCY_LEVELS)
    normalized: list[int] = []
    for item in raw:
        try:
            value = int(item)
        except (TypeError, ValueError):
            continue
        if value < 1 or value > 64 or value in normalized:
            continue
        normalized.append(value)
    return sorted(normalized) or list(DEFAULT_CONCURRENCY_LEVELS)


def _normalize_runs(raw: Any) -> int:
    try:
        value = int(raw)
    except (TypeError, ValueError):
        value = 3
    return max(1, min(value, 20))


def _is_rate_limited_error(exc: Exception) -> bool:
    message = str(exc or '').lower()
    return '429' in message or 'too many requests' in message or 'rate limit' in message


def _run_worker_once(provider: str, symbol: str) -> _Counter:
    counter = _Counter(total_requests=1)

    try:
        payload = fetch_price_board_snapshot([symbol], source=provider)
        if payload:
            counter.success_requests += 1
        else:
            counter.failed_requests += 1
    except Exception as exc:  # noqa: BLE001
        if _is_rate_limited_error(exc):
            counter.rate_limited_requests += 1
        else:
            counter.failed_requests += 1
            if 'timeout' in str(exc).lower():
                counter.timeout_errors += 1
            else:
                counter.transport_errors += 1

    return counter


def _benchmark_single_provider_concurrency(
    *,
    provider: str,
    symbol: str,
    timeout_seconds: int,
    concurrency: int,
    runs: int,
) -> dict[str, Any]:
    started_all = time.monotonic()
    total = _Counter()
    run_latencies: list[float] = []

    for _ in range(runs):
        started_run = time.monotonic()
        executor = ThreadPoolExecutor(max_workers=concurrency)
        futures = [executor.submit(_run_worker_once, provider, symbol) for _ in range(concurrency)]

        try:
            for future in as_completed(futures, timeout=max(timeout_seconds, 1) + 2):
                try:
                    total.merge(future.result(timeout=0))
                except Exception as exc:  # noqa: BLE001
                    total.total_requests += 1
                    total.failed_requests += 1
                    if 'timeout' in str(exc).lower():
                        total.timeout_errors += 1
                    else:
                        total.transport_errors += 1
        except FuturesTimeoutError:
            for future in futures:
                if not future.done():
                    total.total_requests += 1
                    total.failed_requests += 1
                    total.timeout_errors += 1
        finally:
            executor.shutdown(wait=False, cancel_futures=True)

        run_latencies.append(max(time.monotonic() - started_run, 0.001))

    elapsed_seconds = max(time.monotonic() - started_all, 0.001)
    rpm = (total.total_requests / elapsed_seconds) * 60.0
    rate_limited_pct = (total.rate_limited_requests / total.total_requests * 100.0) if total.total_requests else 0.0
    success_pct = (total.success_requests / total.total_requests * 100.0) if total.total_requests else 0.0

    sorted_latencies = sorted(run_latencies or [elapsed_seconds])
    p50_latency = sorted_latencies[len(sorted_latencies) // 2]
    if len(sorted_latencies) >= 2:
        idx = min(max(math.ceil(0.95 * len(sorted_latencies)) - 1, 0), len(sorted_latencies) - 1)
        p95_latency = sorted_latencies[idx]
    else:
        p95_latency = sorted_latencies[0]

    return {
        'provider': provider,
        'concurrency': concurrency,
        'runs': runs,
        'elapsed_seconds': round(elapsed_seconds, 3),
        'total_requests': total.total_requests,
        'success_requests': total.success_requests,
        'rate_limited_requests': total.rate_limited_requests,
        'failed_requests': total.failed_requests,
        'timeout_errors': total.timeout_errors,
        'transport_errors': total.transport_errors,
        'requests_per_minute': round(rpm, 2),
        'rate_limited_pct': round(rate_limited_pct, 2),
        'success_pct': round(success_pct, 2),
        'p50_latency_seconds': round(float(p50_latency), 3),
        'p95_latency_seconds': round(float(p95_latency), 3),
    }


def _pick_best_result(entries: list[dict[str, Any]]) -> dict[str, Any] | None:
    if not entries:
        return None
    return sorted(
        entries,
        key=lambda item: (
            float(item.get('rate_limited_pct', 100.0)),
            -float(item.get('requests_per_minute', 0.0)),
            -float(item.get('success_pct', 0.0)),
        ),
    )[0]


def build_runtime_recommendation(results: list[dict[str, Any]]) -> dict[str, Any]:
    by_provider: dict[str, list[dict[str, Any]]] = {}
    for item in results:
        provider = str(item.get('provider') or '').upper()
        by_provider.setdefault(provider, []).append(item)

    provider_best = {
        provider: _pick_best_result(entries)
        for provider, entries in by_provider.items()
    }
    provider_best = {provider: entry for provider, entry in provider_best.items() if entry is not None}
    ranked_providers = [
        entry['provider']
        for entry in sorted(
            provider_best.values(),
            key=lambda item: (
                float(item.get('rate_limited_pct', 100.0)),
                -float(item.get('requests_per_minute', 0.0)),
                -float(item.get('success_pct', 0.0)),
            ),
        )
    ]

    if not ranked_providers:
        return {
            'primary_provider': 'KBS',
            'fallback_provider': 'VCI',
            'adaptive_start_concurrency': 8,
            'reason': 'no_data',
        }

    best = provider_best[ranked_providers[0]]
    fallback_provider = ranked_providers[1] if len(ranked_providers) > 1 else 'VCI'
    suggested_start = max(4, min(int(best.get('concurrency') or 8), 16))
    ordered_fallbacks = [provider for provider in ranked_providers[1:]] or [fallback_provider]

    return {
        'primary_provider': str(best.get('provider') or 'KBS').upper(),
        'fallback_provider': str(fallback_provider or 'VCI').upper(),
        'adaptive_start_concurrency': suggested_start,
        'best_observed_concurrency': int(best.get('concurrency') or suggested_start),
        'best_requests_per_minute': float(best.get('requests_per_minute') or 0.0),
        'best_rate_limited_pct': float(best.get('rate_limited_pct') or 0.0),
        'runtime_patch': {
            'price_board_source': str(best.get('provider') or 'KBS').upper(),
            'fallback_sources': ordered_fallbacks,
        },
        'env_patch': {
            'VNBROKER_PRICE_BOARD_SOURCE': str(best.get('provider') or 'KBS').upper(),
            'VNBROKER_PRICE_BOARD_FALLBACK_SOURCES': ','.join(ordered_fallbacks),
        },
        'reason': 'best_observed_metrics',
    }


def run_price_board_provider_benchmark(payload: dict[str, Any] | None = None) -> dict[str, Any]:
    params = payload if isinstance(payload, dict) else {}

    symbol = str(params.get('symbol') or 'VNM').strip().upper()
    try:
        duration_seconds = int(params.get('duration_seconds', 30))
    except (TypeError, ValueError):
        duration_seconds = 30
    duration_seconds = max(5, min(duration_seconds, 180))

    runs_raw = params.get('runs')
    if runs_raw is None:
        inferred_runs = max(1, min(duration_seconds // 10, 20))
        runs = _normalize_runs(inferred_runs)
    else:
        runs = _normalize_runs(runs_raw)

    try:
        timeout_seconds = int(params.get('timeout_seconds', 8))
    except (TypeError, ValueError):
        timeout_seconds = 8
    timeout_seconds = max(1, min(timeout_seconds, 30))

    providers = _normalize_providers(params.get('providers'))
    concurrency_levels = _normalize_concurrency_levels(params.get('concurrency_levels'))

    started_at = utc_now_iso()
    results: list[dict[str, Any]] = []
    for provider in providers:
        for concurrency in concurrency_levels:
            results.append(
                _benchmark_single_provider_concurrency(
                    provider=provider,
                    symbol=symbol,
                    timeout_seconds=timeout_seconds,
                    concurrency=concurrency,
                    runs=runs,
                )
            )

    report = {
        'status': 'completed',
        'started_at': started_at,
        'finished_at': utc_now_iso(),
        'symbol': symbol,
        'duration_seconds': duration_seconds,
        'runs': runs,
        'timeout_seconds': timeout_seconds,
        'providers': providers,
        'concurrency_levels': concurrency_levels,
        'results': results,
        'recommendation': build_runtime_recommendation(results),
    }
    set_latest_price_board_benchmark_report(report)
    return report


def get_latest_price_board_benchmark_report() -> dict[str, Any] | None:
    try:
        cached = cache.get(BENCHMARK_CACHE_KEY)
    except Exception:
        return None
    return cached if isinstance(cached, dict) else None


def set_latest_price_board_benchmark_report(report: dict[str, Any], ttl_seconds: int | None = None) -> None:
    if not isinstance(report, dict):
        return
    timeout = BENCHMARK_CACHE_TTL_SECONDS if ttl_seconds is None else max(int(ttl_seconds), 30)
    try:
        cache.set(BENCHMARK_CACHE_KEY, report, timeout=timeout)
    except Exception:
        return


def clear_latest_price_board_benchmark_report() -> None:
    try:
        cache.delete(BENCHMARK_CACHE_KEY)
    except Exception:
        return
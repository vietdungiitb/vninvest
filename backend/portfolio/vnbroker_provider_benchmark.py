from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed, TimeoutError as FuturesTimeoutError
from dataclasses import dataclass
from datetime import datetime, timezone
import math
import time
from typing import Any

from django.core.cache import cache

from portfolio.adapters.cache_adapter import is_rate_limited_error
from portfolio.adapters.vnbroker_adapter import _build_stock_client
from portfolio.market_calendar import resolve_market_phase
from portfolio.vnbroker_provider_quality import (
    build_provider_quality_snapshot,
    cache_provider_quality_snapshot,
    resolve_provider_order,
)

BENCHMARK_CACHE_KEY = 'admin_ops:vnbroker:price_board:benchmark:latest'
BENCHMARK_CACHE_TTL_SECONDS = 60 * 60 * 24

DEFAULT_PROVIDERS = ['KBS', 'VCI']
DEFAULT_CONCURRENCY_LEVELS = [2, 4, 8, 16]


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


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _normalize_providers(raw: Any) -> list[str]:
    if not isinstance(raw, list):
        return list(DEFAULT_PROVIDERS)
    normalized: list[str] = []
    for item in raw:
        value = str(item or '').strip().upper()
        if not value:
            continue
        if value not in normalized:
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
        if value < 1 or value > 64:
            continue
        if value not in normalized:
            normalized.append(value)
    return sorted(normalized) or list(DEFAULT_CONCURRENCY_LEVELS)


def _normalize_runs(raw: Any) -> int:
    try:
        value = int(raw)
    except (TypeError, ValueError):
        value = 3
    return max(1, min(value, 20))


def _run_worker_once(provider: str, symbol: str) -> _Counter:
    counter = _Counter()

    counter.total_requests += 1
    try:
        stock_client = _build_stock_client(symbol=symbol, source=provider)
        stock_client.trading.price_board(symbols_list=[symbol])
        counter.success_requests += 1
    except Exception as exc:  # noqa: BLE001
        if is_rate_limited_error(exc):
            counter.rate_limited_requests += 1
        else:
            counter.failed_requests += 1
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
                    result = future.result(timeout=0)
                    total.merge(result)
                except Exception:
                    total.total_requests += 1
                    total.failed_requests += 1
                    total.transport_errors += 1
        except FuturesTimeoutError:
            # Mark unfinished futures as timeout failures for this run.
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
        'min_latency_seconds': round(float(min(sorted_latencies)), 3),
        'max_latency_seconds': round(float(max(sorted_latencies)), 3),
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


def _build_quality_metrics_from_benchmark(result: dict[str, Any], timeout_seconds: int) -> dict[str, float]:
    total_requests = max(int(result.get('total_requests') or 0), 0)
    timeout_seconds = max(int(timeout_seconds or 1), 1)

    try:
        p95_latency_seconds = float(result.get('p95_latency_seconds') or timeout_seconds)
    except (TypeError, ValueError):
        p95_latency_seconds = float(timeout_seconds)

    try:
        success_pct = float(result.get('success_pct') or 0.0)
    except (TypeError, ValueError):
        success_pct = 0.0

    try:
        rate_limited_pct = float(result.get('rate_limited_pct') or 0.0)
    except (TypeError, ValueError):
        rate_limited_pct = 0.0

    try:
        transport_errors = float(result.get('transport_errors') or 0.0)
    except (TypeError, ValueError):
        transport_errors = 0.0

    freshness_pct = max(0.0, min(100.0, 100.0 - ((p95_latency_seconds / timeout_seconds) * 100.0)))
    completeness_pct = max(0.0, min(100.0, success_pct))
    success_rate_pct = max(0.0, min(100.0, 100.0 - rate_limited_pct))
    parse_quality_pct = (
        max(0.0, min(100.0, 100.0 - ((transport_errors / total_requests) * 100.0)))
        if total_requests
        else 0.0
    )

    return {
        'freshness_pct': round(freshness_pct, 2),
        'completeness_pct': round(completeness_pct, 2),
        'success_rate_pct': round(success_rate_pct, 2),
        'parse_quality_pct': round(parse_quality_pct, 2),
    }


def build_runtime_recommendation(
    results: list[dict[str, Any]],
    timeout_seconds: int | None = None,
    market_phase: str | None = None,
) -> dict[str, Any]:
    by_provider: dict[str, list[dict[str, Any]]] = {}
    for item in results:
        provider = str(item.get('provider') or '').upper()
        by_provider.setdefault(provider, []).append(item)

    provider_best = {
        provider: _pick_best_result(entries)
        for provider, entries in by_provider.items()
    }
    provider_best = {k: v for k, v in provider_best.items() if v is not None}

    benchmark_timeout_seconds = max(int(timeout_seconds or 8), 1)
    quality_snapshots: dict[str, dict[str, Any]] = {}
    resolved_market_phase = str(market_phase or '').strip().lower()
    if not resolved_market_phase:
        try:
            resolved_market_phase = str((resolve_market_phase() or {}).get('profile') or '').strip().lower()
        except Exception:
            resolved_market_phase = 'default'
    if not resolved_market_phase:
        resolved_market_phase = 'default'

    for provider, entry in provider_best.items():
        quality_metrics = _build_quality_metrics_from_benchmark(entry, benchmark_timeout_seconds)
        snapshot = build_provider_quality_snapshot(
            provider=provider,
            channel='price_board',
            metrics=quality_metrics,
            source='benchmark',
        )
        cache_provider_quality_snapshot(snapshot)
        quality_snapshots[provider] = snapshot

    ranked_providers = resolve_provider_order('price_board', list(provider_best.keys()), market_phase=resolved_market_phase)

    if not ranked_providers:
        ranked_providers = list(provider_best.keys())

    if not ranked_providers:
        return {
            'primary_provider': 'KBS',
            'fallback_provider': 'VCI',
            'adaptive_start_concurrency': 8,
            'reason': 'no_data',
        }

    best = provider_best[ranked_providers[0]]
    fallback = provider_best[ranked_providers[1]] if len(ranked_providers) > 1 else None

    suggested_start = int(best.get('concurrency') or 8)
    # Keep start concurrency in a conservative range for production rollout.
    suggested_start = max(4, min(suggested_start, 16))

    ordered_fallbacks = [provider for provider in ranked_providers[1:]]

    decision_audit = {
        'channel': 'price_board',
        'market_phase': resolved_market_phase,
        'ranked_providers': ranked_providers,
        'selected_provider': str(best.get('provider') or 'KBS').upper(),
        'fallback_provider': str((fallback or {}).get('provider') or 'VCI').upper(),
        'quality_scores': {
            provider: quality_snapshots.get(provider, {}).get('score')
            for provider in ranked_providers
            if provider in quality_snapshots
        },
        'generated_at': _utc_now_iso(),
    }

    return {
        'primary_provider': str(best.get('provider') or 'KBS').upper(),
        'fallback_provider': str((fallback or {}).get('provider') or 'VCI').upper(),
        'adaptive_start_concurrency': suggested_start,
        'best_observed_concurrency': int(best.get('concurrency') or suggested_start),
        'best_requests_per_minute': float(best.get('requests_per_minute') or 0.0),
        'best_rate_limited_pct': float(best.get('rate_limited_pct') or 0.0),
        'quality_scores': {
            provider: quality_snapshots.get(provider, {}).get('score')
            for provider in ranked_providers
            if provider in quality_snapshots
        },
        'quality_snapshots': quality_snapshots,
        'market_phase': resolved_market_phase,
        'decision_audit': decision_audit,
        'runtime_patch': {
            'price_board_source': str(best.get('provider') or 'KBS').upper(),
            'fallback_sources': ordered_fallbacks or [str((fallback or {}).get('provider') or 'VCI').upper()],
        },
        'env_patch': {
            'VNBROKER_TRADING_AUTO_PRIMARY': str(best.get('provider') or 'KBS').lower(),
            'VNBROKER_KBS_ADAPTIVE_START_CONCURRENCY': str(suggested_start),
            'VNBROKER_PRICE_BOARD_SOURCE': str(best.get('provider') or 'KBS').upper(),
            'VNBROKER_PRICE_BOARD_FALLBACK_SOURCES': ','.join(ordered_fallbacks) if ordered_fallbacks else str((fallback or {}).get('provider') or 'VCI').upper(),
        },
        'reason': 'best_quality_score',
    }


def run_price_board_provider_benchmark(payload: dict[str, Any] | None = None) -> dict[str, Any]:
    params = payload if isinstance(payload, dict) else {}

    symbol = str(params.get('symbol') or 'VNM').strip().upper()
    try:
        duration_seconds = int(params.get('duration_seconds', 30))
    except (TypeError, ValueError):
        duration_seconds = 30
    duration_seconds = max(5, min(duration_seconds, 180))

    # Backward-compatible mapping: if runs not provided, infer a bounded runs count
    # from duration_seconds so legacy UI field still controls workload size.
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

    started_at = _utc_now_iso()
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

    recommendation = build_runtime_recommendation(results, timeout_seconds=timeout_seconds)

    report = {
        'status': 'completed',
        'started_at': started_at,
        'finished_at': _utc_now_iso(),
        'symbol': symbol,
        'duration_seconds': duration_seconds,
        'runs': runs,
        'timeout_seconds': timeout_seconds,
        'providers': providers,
        'concurrency_levels': concurrency_levels,
        'results': results,
        'recommendation': recommendation,
    }

    cache.set(BENCHMARK_CACHE_KEY, report, timeout=BENCHMARK_CACHE_TTL_SECONDS)
    return report


def get_latest_price_board_benchmark_report() -> dict[str, Any] | None:
    try:
        cached = cache.get(BENCHMARK_CACHE_KEY)
    except Exception:
        return None
    if isinstance(cached, dict):
        return cached
    return None


def set_latest_price_board_benchmark_report(report: dict[str, Any], ttl_seconds: int | None = None) -> None:
    if not isinstance(report, dict):
        return
    timeout = BENCHMARK_CACHE_TTL_SECONDS if ttl_seconds is None else max(int(ttl_seconds), 30)
    try:
        cache.set(BENCHMARK_CACHE_KEY, report, timeout=timeout)
    except Exception:
        return

"""
data_ingest Celery tasks.

fetch_and_upsert_price_board: fetches price board data and upserts into market_serving.SymbolSnapshot.
backfill_daily_prices: parallel multi-provider OHLCV backfill into DailyPrice.
send_email_verification_token: async email send for email verification (registration).
send_password_reset_email: async email send for password reset.
"""
import logging
import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from concurrent.futures import TimeoutError as FuturesTimeoutError
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

from celery import shared_task
from celery.exceptions import SoftTimeLimitExceeded
from django.conf import settings as django_settings
from django.core.mail import send_mail
from django.utils.dateparse import parse_datetime
from django.utils.timezone import now

from market_data.vnbroker_adapter import fetch_daily_history, fetch_intraday_tape

logger = logging.getLogger(__name__)


def _b02_mark_run_failed_on_crash(task_id, exc, traceback, *args, **kwargs):
    """Celery task_failure signal handler — B02 crash-safety for backfill_daily_prices."""
    sender = kwargs.get('sender')
    sender_name = getattr(sender, 'name', '') or ''
    if sender_name not in (
        'data_ingest.tasks.backfill_daily_prices',
        'data_ingest.tasks.backfill_pre5y_to_market_inception',
        'data_ingest.tasks.ingest_daily_prices',
    ):
        return
    try:
        exec_run_id = kwargs.get('einfo') or getattr(traceback, '_b02_exec_run_id', None)
        # The exec_run_id is stored in the request context — access via kwargs['headers']
        headers = kwargs.get('headers') or {}
        exec_run_pk = headers.get('_b02_exec_run_id')
        if exec_run_pk is None:
            return
        from django.utils import timezone as _tz

        from service_ops.models import BackfillExecutionRun
        BackfillExecutionRun.objects.filter(pk=exec_run_pk, status='running').update(
            status='failed',
            finished_at=_tz.now(),
            error_summary=str(exc)[:2000],
        )
    except Exception:
        pass


try:
    from celery.signals import task_failure
    task_failure.connect(_b02_mark_run_failed_on_crash, weak=False)
except Exception:
    pass


@shared_task(bind=True, name='data_ingest.tasks.run_vnbroker_price_board_benchmark', queue='manual_on_demand')
def run_vnbroker_price_board_benchmark(self, payload: dict | None = None) -> dict:
    from market_data.vnbroker_benchmark import run_price_board_provider_benchmark

    return run_price_board_provider_benchmark(payload if isinstance(payload, dict) else {})

# ---------------------------------------------------------------------------
# Provider registry for daily history backfill.
# Add entries here when a new explorer module gains a working .history() call.
# ---------------------------------------------------------------------------
_HISTORY_PROVIDERS = [
    'VCI',
    'KBS',
]
# Per-provider inter-symbol delay (seconds).
# VCI: tăng delay để giảm rate-limit; KBS: giữ nguyên default.
_PROVIDER_INTER_SYMBOL_DELAY: dict[str, float] = {
    'VCI': 0.5,
    'KBS': 0.12,
}
_DEFAULT_INTER_SYMBOL_DELAY = 0.12
_DAILY_HISTORY_RETRY_ATTEMPTS = 3
_DAILY_HISTORY_RETRY_BACKOFF_SECONDS = 0.5
_DAILY_HISTORY_RETRY_BACKOFF_MAX_SECONDS = 2.0
_INTRADAY_PLAN_DATASETS = ('intraday_ticks', 'intraday_bars')
_INTRADAY_BAR_TIMEFRAMES = ('1m', '5m', '15m', '1H', '2H', '4H')
_INTRADAY_PAGE_SIZE_BY_DEPTH_TIER = {
    'hot': 120,
    'warm': 60,
    'cold': 25,
    'recovery': 80,
}
_B08_STALE_RUNNING_TTL_SECONDS = 2 * 60 * 60
_B08_STALE_GRACE_SECONDS = 10 * 60
# Slice C (QueueRecovery) — warm chunking bounds (FR-03: mọi warm-task ≤ 10 phút).
# Số học bắt buộc: MAX_SYMBOLS × PER_SYMBOL_TIMEOUT < 600s (mặc định 30 × 15 = 450s).
# Corrective live-measured v2: timeout 15→8s. Healthy tape fetch 1-3s; failing symbols
# burn full timeout mỗi pass (đo live: 13/30 timeout × 15s = 195s/chunk). 30×8=240s + DB <
# 600s (FR-03, bound test giữ nguyên). Hot hydrate 2 chunk/10 phút ≈ 8 phút việc/10 phút.
_DEFAULT_WARM_MAX_SYMBOLS_PER_TASK = 30
_DEFAULT_WARM_PER_SYMBOL_TIMEOUT_SECONDS = 8
_DEFAULT_WARM_CHUNK_TIME_LIMIT_MARGIN_SECONDS = 120


def _read_int_env(name: str, default: int) -> int:
    try:
        value = os.getenv(name)
        if value is not None:
            return int(value)
    except (TypeError, ValueError):
        pass
    return default


# Corrective live-measured v3: circuit breaker per symbol — ~40% symbols (derivatives/
# bonds/delisted như 41B5*, ABR) fail MỌI pass, mỗi lần burn full timeout (8s) rồi lại fail
# pass sau. 3 fails liên tiếp → skip 24h (reset khi success). Tiết kiệm ~40% slot warm.
_CIRCUIT_FAIL_THRESHOLD = 3
_CIRCUIT_SKIP_TIMEOUT_SECONDS = 24 * 3600


def _circuit_key(symbol: str) -> str:
    return f'warm:circuit:{str(symbol or "").upper()}'


def _circuit_open(symbol: str) -> bool:
    try:
        from django.core.cache import cache as _cache
        fails = int(_cache.get(_circuit_key(symbol)) or 0)
        return fails >= _read_int_env(
            'WARM_CIRCUIT_FAIL_THRESHOLD', _CIRCUIT_FAIL_THRESHOLD)
    except Exception:
        return False


def _circuit_record(symbol: str, ok: bool) -> None:
    try:
        from django.core.cache import cache as _cache
        key = _circuit_key(symbol)
        if ok:
            _cache.delete(key)
        else:
            fails = int(_cache.get(key) or 0) + 1
            _cache.set(key, fails, timeout=_CIRCUIT_SKIP_TIMEOUT_SECONDS)
    except Exception:
        pass


def _normalize_symbols(symbols: list[str] | None) -> list[str]:
    if symbols is None:
        return []
    return sorted({str(symbol).strip().upper() for symbol in symbols if str(symbol).strip()})


def _get_default_global_registry_symbols() -> list[str]:
    from market_data.models import GlobalSymbolRegistry

    return list(
        GlobalSymbolRegistry.objects
        .filter(is_active=True)
        .order_by('symbol')
        .values_list('symbol', flat=True)
    )


def _get_hot_registry_symbols() -> list[str]:
    """Hot-tier symbols (corrective live-measured): beat warm path mặc định chỉ hydrate
    50 mã hot (~2 chunk) thay vì toàn registry ~1942 (~63 chunk bất tận)."""
    from market_data.models import GlobalSymbolRegistry

    return list(
        GlobalSymbolRegistry.objects
        .filter(is_active=True, current_priority_tier=GlobalSymbolRegistry.PriorityTierChoices.HOT)
        .order_by('symbol')
        .values_list('symbol', flat=True)
    )


def _extract_symbols_from_plan_items(plan_items: list[dict] | None) -> list[str]:
    if not plan_items:
        return []
    return _normalize_symbols([item.get('symbol') for item in plan_items])


def _extract_intraday_datasets_from_plan_items(plan_items: list[dict] | None) -> list[str]:
    if not plan_items:
        return list(_INTRADAY_PLAN_DATASETS)

    requested = {
        str(item.get('dataset') or '').strip().lower()
        for item in plan_items
        if str(item.get('dataset') or '').strip().lower() in _INTRADAY_PLAN_DATASETS
    }
    if not requested:
        return list(_INTRADAY_PLAN_DATASETS)
    return [dataset for dataset in _INTRADAY_PLAN_DATASETS if dataset in requested]


def _resolve_intraday_page_size_from_window(requested_window: dict | None, default_page_size: int) -> int:
    normalized_default = max(int(default_page_size or 50), 1)
    window = requested_window if isinstance(requested_window, dict) else {}

    explicit_page_size = window.get('page_size')
    if explicit_page_size is not None:
        try:
            return max(int(explicit_page_size), 1)
        except (TypeError, ValueError):
            return normalized_default

    depth_tier = str(window.get('intraday_depth_tier') or '').strip().lower()
    if depth_tier in _INTRADAY_PAGE_SIZE_BY_DEPTH_TIER:
        return int(_INTRADAY_PAGE_SIZE_BY_DEPTH_TIER[depth_tier])

    return normalized_default


def _build_intraday_symbol_plan(plan_items: list[dict] | None, default_page_size: int) -> list[dict[str, int | str]]:
    symbols = _extract_symbols_from_plan_items(plan_items)
    if not symbols:
        return []

    requested_window_by_symbol = {}
    for item in list(plan_items or []):
        symbol = str(item.get('symbol') or '').strip().upper()
        if not symbol:
            continue
        requested_window_by_symbol[symbol] = item.get('requested_window') if isinstance(item, dict) else None

    symbol_plan: list[dict[str, int | str]] = []
    for symbol in symbols:
        symbol_plan.append({
            'symbol': symbol,
            'page_size': _resolve_intraday_page_size_from_window(
                requested_window_by_symbol.get(symbol),
                default_page_size,
            ),
        })
    return symbol_plan


def _select_coverage_rotation(symbols: list[str], parts: int = 3) -> list[str]:
    """Chọn 1/phần symbols để refresh coverage theo vòng quay (corrective live-measured).

    Full refresh 1942 symbols tốn hàng chục giây, trong khi price-board chạy mỗi 60s
    (đo live: 144s/run → tự flood chính mình). Xoay vòng: mỗi run refresh 1/3 (~650),
    full refresh sau ~3 chu kỳ (~9 phút với interval mới 180s). Deterministic theo phút
    hiện tại để các worker/retry không lệch pha. parts<=1 → full (dùng cho run-now tay).
    """
    normalized = _normalize_symbols(symbols)
    parts = max(int(parts or 1), 1)
    if parts <= 1 or not normalized:
        return normalized
    from django.utils import timezone as _tz
    slot = (_tz.now().minute // max(60 // parts, 1)) % parts if parts <= 60 else 0
    return [s for i, s in enumerate(normalized) if i % parts == slot]


def _refresh_coverage_for_symbols(
    symbols: list[str] | None,
    *,
    reference_trade_date: date | None = None,
    as_of: datetime | None = None,
) -> int:
    normalized_symbols = _normalize_symbols(symbols)
    if not normalized_symbols:
        return 0

    from django.utils import timezone

    from market_data.global_symbol_coverage import refresh_global_symbol_coverage
    from market_data.models import GlobalSymbolRegistry

    registry_symbols = set(
        GlobalSymbolRegistry.objects
        .filter(symbol__in=normalized_symbols)
        .values_list('symbol', flat=True)
    )
    if not registry_symbols:
        return 0

    refreshed = 0
    effective_trade_date = reference_trade_date or timezone.localdate()
    effective_as_of = as_of or timezone.now()
    for symbol in normalized_symbols:
        if symbol not in registry_symbols:
            continue
        try:
            refresh_global_symbol_coverage(
                symbol,
                reference_trade_date=effective_trade_date,
                as_of=effective_as_of,
            )
            refreshed += 1
        except Exception:
            logger.exception('Failed to refresh coverage for symbol=%s after ingest.', symbol)
    return refreshed


def _attach_ingest_run_to_service_run_log(service_run_log, run) -> None:
    if service_run_log is None or run is None:
        return

    output_summary = dict(service_run_log.output_summary or {})
    if output_summary.get('ingest_run_id') == run.id:
        return

    output_summary['ingest_run_id'] = run.id
    service_run_log.output_summary = output_summary
    service_run_log.save(update_fields=['output_summary'])


def _empty_result_counts() -> dict:
    return {
        'planned_items': 0,
        'inserted': 0,
        'updated': 0,
        'skipped_existing': 0,
        'failed': 0,
        'repaired_conflicts': 0,
    }


def _normalize_intraday_side(side_value: str | None) -> str:
    normalized_side = str(side_value or '').strip().upper()
    if normalized_side == 'BUY':
        return 'BUY'
    if normalized_side == 'SELL':
        return 'SELL'
    return 'UNKNOWN'


def _normalize_intraday_trade_row(symbol: str, trade: dict) -> dict | None:
    timestamp_value = trade.get('timestamp') or trade.get('datetime') or trade.get('time')
    timestamp = parse_datetime(str(timestamp_value or '')) if timestamp_value else None
    if timestamp is None:
        return None

    try:
        price = Decimal(str(trade.get('price') or 0))
        volume = int(trade.get('volume') or 0)
    except (ArithmeticError, TypeError, ValueError):
        return None

    return {
        'symbol': symbol,
        'timestamp': timestamp,
        'price': price,
        'volume': volume,
        'side': _normalize_intraday_side(trade.get('side')),
        'match_type': str(trade.get('match_type') or 'NormalMatch')[:50],
        'source': 'vnbroker_intraday',
    }


def _floor_intraday_bucket(timestamp: datetime, timeframe: str) -> datetime:
    normalized_timeframe = str(timeframe or '').strip()
    if normalized_timeframe.endswith('m'):
        minutes = max(int(normalized_timeframe[:-1]), 1)
        floored_minute = (timestamp.minute // minutes) * minutes
        return timestamp.replace(minute=floored_minute, second=0, microsecond=0)

    if normalized_timeframe.endswith('H'):
        hours = max(int(normalized_timeframe[:-1]), 1)
        floored_hour = (timestamp.hour // hours) * hours
        return timestamp.replace(hour=floored_hour, minute=0, second=0, microsecond=0)

    raise ValueError(f'Unsupported intraday timeframe: {timeframe}')


def _build_intraday_bar_payloads(symbol: str, normalized_trades: list[dict], timeframes: tuple[str, ...] = _INTRADAY_BAR_TIMEFRAMES) -> dict[tuple[str, datetime], dict]:
    bars_by_key: dict[tuple[str, datetime], dict] = {}
    for trade in sorted(normalized_trades, key=lambda row: row['timestamp']):
        trade_price = trade['price']
        trade_volume = trade['volume']
        for timeframe in timeframes:
            bucket_ts = _floor_intraday_bucket(trade['timestamp'], timeframe)
            key = (timeframe, bucket_ts)
            existing_bar = bars_by_key.get(key)
            if existing_bar is None:
                bars_by_key[key] = {
                    'symbol': symbol,
                    'datetime': bucket_ts,
                    'timeframe': timeframe,
                    'open': trade_price,
                    'high': trade_price,
                    'low': trade_price,
                    'close': trade_price,
                    'volume': trade_volume,
                    'source': 'vnbroker_intraday',
                }
                continue

            existing_bar['high'] = max(existing_bar['high'], trade_price)
            existing_bar['low'] = min(existing_bar['low'], trade_price)
            existing_bar['close'] = trade_price
            existing_bar['volume'] += trade_volume

    return bars_by_key


def _fetch_tape_with_timeout(symbol: str, symbol_page_size: int, timeout_seconds: int | None) -> dict:
    """Fetch tape với per-symbol timeout (Slice C). Timeout → orphan thread tự thoát khi
    provider xong (chỉ network+Redis, không ORM) — main flow đi tiếp, symbol vào failed để bù sau."""
    if not timeout_seconds or timeout_seconds <= 0:
        return fetch_intraday_tape(symbol, page_size=symbol_page_size)
    executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix=f'warm-tape-{symbol}')
    future = executor.submit(fetch_intraday_tape, symbol, page_size=symbol_page_size)
    try:
        return future.result(timeout=timeout_seconds)
    except FuturesTimeoutError:
        logger.warning(
            'warm_intraday_universe [%s] per-symbol timeout after %ss — skipping, will retry next cycle',
            symbol, timeout_seconds,
        )
        executor.shutdown(wait=False, cancel_futures=True)
        return {'trades': [], 'source': 'timeout', 'stale': True, '_timed_out': True}


def _hydrate_intraday_symbols(
    symbol_plan: list[dict[str, int | str]],
    target_datasets: list[str],
    page_size: int = 50,
    per_symbol_timeout_seconds: int | None = None,
) -> dict:
    from market_data.models import IntradayBar, IntradayTick

    target_dataset_set = set(target_datasets or _INTRADAY_PLAN_DATASETS)
    tick_counts = _empty_result_counts()
    bar_counts = _empty_result_counts()
    sources: list[str] = []
    warmed_up_count = 0
    failed_symbols: list[str] = []
    timed_out_symbols: list[str] = []
    skipped_circuit = 0

    for plan_item in symbol_plan:
        symbol = str(plan_item.get('symbol') or '').strip().upper()
        if not symbol:
            continue
        # Corrective v3: circuit breaker — symbol fail 3 pass liên tiếp thì skip 24h.
        if _circuit_open(symbol):
            skipped_circuit += 1
            continue
        symbol_page_size = max(int(plan_item.get('page_size') or page_size), 1)
        try:
            tape_result = _fetch_tape_with_timeout(symbol, symbol_page_size, per_symbol_timeout_seconds)
            if tape_result.get('_timed_out'):
                timed_out_symbols.append(symbol)
                failed_symbols.append(symbol)
                _circuit_record(symbol, False)
                continue
            raw_trades = list(tape_result.get('trades') or [])
            source = str(tape_result.get('source') or '').strip()
            if source and source not in sources:
                sources.append(source)

            normalized_trades = [
                trade_row
                for trade_row in (
                    _normalize_intraday_trade_row(symbol, trade)
                    for trade in raw_trades
                )
                if trade_row is not None
            ]
            if not normalized_trades:
                continue

            warmed_up_count += 1
            _circuit_record(symbol, True)

            if 'intraday_ticks' in target_dataset_set:
                tick_counts['planned_items'] += 1
                existing_tick_keys = {
                    (
                        row['timestamp'],
                        row['price'],
                        row['volume'],
                        row['side'],
                        row['match_type'],
                    )
                    for row in IntradayTick.objects.filter(
                        symbol=symbol,
                        timestamp__in=[trade['timestamp'] for trade in normalized_trades],
                    ).values('timestamp', 'price', 'volume', 'side', 'match_type')
                }
                tick_objects = []
                for trade in normalized_trades:
                    tick_key = (
                        trade['timestamp'],
                        trade['price'],
                        trade['volume'],
                        trade['side'],
                        trade['match_type'],
                    )
                    if tick_key in existing_tick_keys:
                        tick_counts['skipped_existing'] += 1
                        continue
                    existing_tick_keys.add(tick_key)
                    tick_counts['inserted'] += 1
                    tick_objects.append(IntradayTick(**trade))

                if tick_objects:
                    IntradayTick.objects.bulk_create(tick_objects, batch_size=500)

            if 'intraday_bars' in target_dataset_set:
                bar_counts['planned_items'] += 1
                bar_payloads = _build_intraday_bar_payloads(symbol, normalized_trades)
                existing_bars_by_key = {
                    (row['timeframe'], row['datetime']): row
                    for row in IntradayBar.objects.filter(
                        symbol=symbol,
                        timeframe__in=list(_INTRADAY_BAR_TIMEFRAMES),
                        datetime__in=[payload['datetime'] for payload in bar_payloads.values()],
                    ).values('timeframe', 'datetime', 'open', 'high', 'low', 'close', 'volume', 'source')
                }
                bar_objects = []
                for key, payload in bar_payloads.items():
                    existing_bar = existing_bars_by_key.get(key)
                    if existing_bar is None:
                        bar_counts['inserted'] += 1
                        bar_objects.append(IntradayBar(**payload))
                        continue

                    if all(existing_bar[field_name] == payload[field_name] for field_name in ('open', 'high', 'low', 'close', 'volume', 'source')):
                        bar_counts['skipped_existing'] += 1
                        continue

                    bar_counts['updated'] += 1
                    bar_objects.append(IntradayBar(**payload))

                if bar_objects:
                    IntradayBar.objects.bulk_create(
                        bar_objects,
                        update_conflicts=True,
                        update_fields=['open', 'high', 'low', 'close', 'volume', 'source'],
                        unique_fields=['symbol', 'datetime', 'timeframe'],
                    )
        except Exception as exc:
            logger.warning('warm_intraday_universe [%s] failed: %s', symbol, exc)
            failed_symbols.append(symbol)
            _circuit_record(symbol, False)

    return {
        'status': 'ok',
        'symbols_count': len(symbol_plan),
        'warmed_up_count': warmed_up_count,
        'sources': sources,
        'inserted': tick_counts['inserted'] + bar_counts['inserted'],
        'updated': tick_counts['updated'] + bar_counts['updated'],
        'skipped_existing': tick_counts['skipped_existing'] + bar_counts['skipped_existing'],
        'failed': failed_symbols,
        'failed_count': len(failed_symbols),
        'timed_out_symbols': timed_out_symbols,
        'skipped_circuit': skipped_circuit,
        'repaired_conflicts': 0,
        'tick_counts': tick_counts,
        'bar_counts': bar_counts,
    }


def _resolve_history_days_from_window(requested_window: dict | None, default_days: int) -> int:
    window = requested_window if isinstance(requested_window, dict) else {}
    if window.get('days') is not None:
        try:
            return max(int(window['days']), 1)
        except (TypeError, ValueError):
            return max(int(default_days), 1)

    trade_date = window.get('trade_date')
    if trade_date:
        return 1

    start_date = window.get('start_date')
    end_date = window.get('end_date')
    if start_date and end_date:
        try:
            start_value = date.fromisoformat(str(start_date))
            end_value = date.fromisoformat(str(end_date))
            return max((end_value - start_value).days + 1, 1)
        except ValueError:
            return max(int(default_days), 1)

    return max(int(default_days), 1)


def _resolve_history_date_range_from_window(requested_window: dict | None) -> tuple[date | None, date | None]:
    window = requested_window if isinstance(requested_window, dict) else {}
    start_date_raw = window.get('start_date')
    end_date_raw = window.get('end_date')

    if not start_date_raw and not end_date_raw:
        return None, None

    try:
        parsed_start_date = date.fromisoformat(str(start_date_raw)) if start_date_raw else None
        parsed_end_date = date.fromisoformat(str(end_date_raw)) if end_date_raw else None
    except ValueError:
        return None, None

    if parsed_start_date is not None and parsed_end_date is not None and parsed_start_date > parsed_end_date:
        return None, None

    return parsed_start_date, parsed_end_date


def _build_default_daily_price_plan_items(symbols: list[str], days: int) -> list[dict]:
    return [
        {
            'symbol': symbol,
            'requested_window': {'days': max(int(days), 1)},
        }
        for symbol in symbols
    ]


def _normalize_daily_plan_items(plan_items: list[dict], default_days: int) -> list[dict]:
    normalized_items: list[dict] = []
    for raw_item in plan_items:
        symbol = str(raw_item.get('symbol') or '').strip().upper()
        if not symbol:
            continue
        requested_window = raw_item.get('requested_window') if isinstance(raw_item, dict) else None
        normalized_days = _resolve_history_days_from_window(requested_window, default_days)
        normalized_items.append({
            'symbol': symbol,
            'requested_window': requested_window if isinstance(requested_window, dict) else {'days': normalized_days},
            'normalized_days': normalized_days,
        })

    normalized_items.sort(
        key=lambda item: (
            item['symbol'],
            int(item['normalized_days']),
        )
    )
    return normalized_items


def _compute_latency_percentile_ms(latencies_ms: list[float], percentile: float) -> float:
    if not latencies_ms:
        return 0.0
    sorted_values = sorted(float(value) for value in latencies_ms)
    index = int(round((len(sorted_values) - 1) * max(min(percentile, 1.0), 0.0)))
    return round(sorted_values[index], 2)


def _fetch_daily_history_with_retry(
    symbol: str,
    provider: str,
    requested_days: int,
    *,
    requested_start_date: date | None = None,
    requested_end_date: date | None = None,
) -> tuple[list[dict], int, float]:
    attempts = max(int(_DAILY_HISTORY_RETRY_ATTEMPTS), 1)
    for attempt in range(1, attempts + 1):
        started_at = time.perf_counter()
        try:
            history_kwargs = {
                'days': requested_days,
                'source': provider,
            }
            if requested_start_date is not None:
                history_kwargs['start_date'] = requested_start_date
            if requested_end_date is not None:
                history_kwargs['end_date'] = requested_end_date
            rows = fetch_daily_history(symbol, **history_kwargs)
            latency_ms = (time.perf_counter() - started_at) * 1000.0
            return list(rows or []), attempt, latency_ms
        except Exception:
            if attempt >= attempts:
                raise
            backoff_seconds = min(
                _DAILY_HISTORY_RETRY_BACKOFF_SECONDS * (2 ** (attempt - 1)),
                _DAILY_HISTORY_RETRY_BACKOFF_MAX_SECONDS,
            )
            time.sleep(backoff_seconds)

    return [], attempts, 0.0


def _classify_daily_price_rows(existing_rows_by_date: dict, history_rows: list[dict], normalized_provider: str) -> tuple[list, int, int, int]:
    from market_data.models import DailyPrice

    objs_to_upsert = []
    inserted = 0
    updated = 0
    skipped_existing = 0

    for row in history_rows:
        try:
            row_date = row['date']
            row_symbol = str(row['symbol']).strip().upper()
            if not row_symbol:
                raise ValueError('empty symbol')

            source = f"vnbroker_{str(row.get('source') or normalized_provider).lower()}"
            next_values = {
                'open': Decimal(str(row['open'])),
                'high': Decimal(str(row['high'])),
                'low': Decimal(str(row['low'])),
                'close': Decimal(str(row['close'])),
                'volume': int(row['volume']),
                'source': source,
            }
        except Exception as exc:
            logger.debug('DailyPrice parse error for %s row: %s', row.get('symbol') or 'unknown', exc)
            continue

        existing = existing_rows_by_date.get(row_date)
        if existing is None:
            inserted += 1
            objs_to_upsert.append(DailyPrice(symbol=row_symbol, date=row_date, **next_values))
            continue

        if all(existing[field_name] == next_value for field_name, next_value in next_values.items()):
            skipped_existing += 1
            continue

        updated += 1
        objs_to_upsert.append(DailyPrice(symbol=row_symbol, date=row_date, **next_values))

    return objs_to_upsert, inserted, updated, skipped_existing


def _fetch_and_upsert_bucket(
    symbols: list[str] | None,
    provider: str,
    days: int,
    inter_symbol_delay: float = 0.12,
    plan_items: list[dict] | None = None,
    progress_callback=None,
) -> dict:
    """
    Fetch daily history for a bucket of symbols using a single provider and
    bulk-upsert into DailyPrice. Designed to run in a thread.
    """
    from market_data.models import DailyPrice

    inserted = 0
    updated = 0
    skipped_existing = 0
    failed: list[str] = []
    normalized_provider = str(provider or '').strip().upper()
    normalized_plan_items = plan_items or _build_default_daily_price_plan_items(list(symbols or []), days)
    total_retries_used = 0
    latencies_ms: list[float] = []
    failed_count = 0
    processed_count = 0

    for plan_item in normalized_plan_items:
        symbol = str(plan_item.get('symbol') or '').strip().upper()
        if not symbol:
            continue
        try:
            requested_window = plan_item.get('requested_window') if isinstance(plan_item, dict) else None
            requested_days = int(plan_item.get('normalized_days') or _resolve_history_days_from_window(requested_window, days))
            requested_start_date, requested_end_date = _resolve_history_date_range_from_window(requested_window)
            history_rows, attempts_used, latency_ms = _fetch_daily_history_with_retry(
                symbol,
                normalized_provider,
                requested_days,
                requested_start_date=requested_start_date,
                requested_end_date=requested_end_date,
            )
            latencies_ms.append(float(latency_ms))
            total_retries_used += max(int(attempts_used) - 1, 0)
            if not history_rows:
                logger.debug('backfill bucket [%s] %s: empty', normalized_provider, symbol)
                time.sleep(inter_symbol_delay)
                continue

            history_dates = [row['date'] for row in history_rows if row.get('date') is not None]
            existing_rows_by_date = {
                row['date']: row
                for row in DailyPrice.objects.filter(symbol=symbol, date__in=history_dates).values(
                    'date', 'open', 'high', 'low', 'close', 'volume', 'source'
                )
            }
            objs, symbol_inserted, symbol_updated, symbol_skipped = _classify_daily_price_rows(
                existing_rows_by_date,
                history_rows,
                normalized_provider,
            )

            if objs:
                DailyPrice.objects.bulk_create(
                    objs,
                    update_conflicts=True,
                    update_fields=['open', 'high', 'low', 'close', 'volume', 'source'],
                    unique_fields=['symbol', 'date'],
                )
                inserted += symbol_inserted
                updated += symbol_updated
                skipped_existing += symbol_skipped
                logger.info('backfill [%s] %s: %d rows', normalized_provider, symbol, len(objs))
            else:
                skipped_existing += symbol_skipped

            time.sleep(inter_symbol_delay)
        except Exception as exc:
            logger.warning('backfill [%s] %s failed: %s', normalized_provider, symbol, exc)
            failed.append(symbol)
            failed_count += 1
        finally:
            processed_count += 1
            if progress_callback is not None and processed_count % 50 == 0:
                try:
                    progress_callback(
                        normalized_provider,
                        processed_count,
                        inserted,
                        updated,
                        skipped_existing,
                        len(failed),
                    )
                except Exception:
                    logger.exception('backfill progress callback failed [%s]', normalized_provider)

    return {
        'inserted': inserted,
        'updated': updated,
        'skipped_existing': skipped_existing,
        'upserted': inserted + updated,
        'failed': failed,
        'failed_count': failed_count,
        'provider': normalized_provider,
        'total_retries_used': total_retries_used,
        'provider_latency_p50_ms': _compute_latency_percentile_ms(latencies_ms, 0.5),
        'provider_latency_p95_ms': _compute_latency_percentile_ms(latencies_ms, 0.95),
    }


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def fetch_and_upsert_price_board(
    self,
    job_id: int = None,
    service_run_log_id: int | None = None,
    plan_items: list[dict] | None = None,
):
    """
    SM-P2.3: Fetch current price board and upsert into SymbolSnapshot.

    Phase 0-2 uses legacy_readonly DB as data source (same as materialize_symbol_snapshot).
    Phase 3+ will switch to direct vnbroker adapter call.

    This task creates an IngestRun record for observability.
    """
    from data_ingest.models import IngestJob, IngestRun

    job = None
    run = None
    service_run_log = None

    try:
        if service_run_log_id is not None:
            from service_ops.models import ServiceRunLog
            from service_ops.tasks import _mark_run_log_finished, _mark_run_log_running

            service_run_log = ServiceRunLog.objects.select_related('service').filter(pk=service_run_log_id).first()
            if service_run_log is not None:
                _mark_run_log_running(service_run_log, getattr(self.request, 'id', ''))

        if job_id:
            try:
                job = IngestJob.objects.get(pk=job_id)
            except IngestJob.DoesNotExist:
                pass

        run = IngestRun.objects.create(
            job=job,
            state=IngestRun.StateChoices.RUNNING,
        ) if job else None
        _attach_ingest_run_to_service_run_log(service_run_log, run)

        from market_serving.vnbroker_materializer import (
            materialize_symbol_snapshot_from_vnbroker,
        )

        # SM-P2.3 Native: Fetch price board from vnbroker adapter.
        # When explicit planner items exist, restrict writes to that subset.
        symbols = _extract_symbols_from_plan_items(plan_items)
        if not symbols:
            symbols = _get_default_global_registry_symbols()

        if not symbols:
            if run:
                run.state = IngestRun.StateChoices.SKIPPED
                run.error_message = 'No active symbols found in GlobalSymbolRegistry'
                run.finished_at = now()
                run.save(update_fields=['state', 'error_message', 'finished_at'])
            if service_run_log is not None:
                _mark_run_log_finished(
                    service_run_log,
                    status_value='skipped',
                    output_summary={'reason': 'no_symbols'},
                )
            return {'status': 'skipped', 'reason': 'no_symbols'}

        result = materialize_symbol_snapshot_from_vnbroker(symbols=symbols)
        count = result.get('upserted', 0)
        inserted = int(result.get('inserted') or 0)
        updated = int(result.get('updated') or 0)
        skipped_existing = int(result.get('skipped_existing') or 0)
        failed_count = int(result.get('failed_count') or 0)
        planned_items = len(plan_items or [])
        # Corrective live-measured: full refresh 1942 symbols/run khiến task 144s > interval 60s
        # (tự flood). Xoay vòng 1/3 mỗi run định kỳ; run tay (plan_items explicit) refresh full.
        if plan_items:
            coverage_refreshed_symbols = _refresh_coverage_for_symbols(symbols)
        else:
            rotation_parts = _read_int_env('PRICE_BOARD_COVERAGE_ROTATION_PARTS', 3)
            coverage_refreshed_symbols = _refresh_coverage_for_symbols(
                _select_coverage_rotation(symbols, parts=rotation_parts))

        if run:
            run.state = (
                IngestRun.StateChoices.FAILED
                if failed_count > 0 and count == 0 and skipped_existing == 0
                else IngestRun.StateChoices.SUCCESS
            )
            run.rows_upserted = count
            run.finished_at = now()
            run.save(update_fields=['state', 'rows_upserted', 'finished_at'])

        if service_run_log is not None:
            service_run_status = 'success'
            if failed_count > 0 and (count > 0 or skipped_existing > 0):
                service_run_status = 'partial'
            elif failed_count > 0:
                service_run_status = 'failed'
            _mark_run_log_finished(
                service_run_log,
                status_value=service_run_status,
                output_summary={
                    'upserted': count,
                    'inserted': inserted,
                    'updated': updated,
                    'skipped_existing': skipped_existing,
                    'failed_count': failed_count,
                    'planned_items': planned_items,
                    'symbols_count': len(symbols),
                    'coverage_refreshed_symbols': coverage_refreshed_symbols,
                    'source': result.get('source'),
                    'ingest_run_id': run.id if run is not None else None,
                },
            )

        logger.info("fetch_and_upsert_price_board (native): upserted %d rows using %s.", count, result.get('source'))
        return {
            'status': 'ok',
            'planned_items': planned_items,
            'symbols_count': len(symbols),
            'coverage_refreshed_symbols': coverage_refreshed_symbols,
            'upserted': count,
            'inserted': inserted,
            'updated': updated,
            'skipped_existing': skipped_existing,
            'failed': list(result.get('failed') or []),
            'failed_count': failed_count,
            'repaired_conflicts': int(result.get('repaired_conflicts') or 0),
            'source': result.get('source'),
        }


    except Exception as exc:
        logger.error("fetch_and_upsert_price_board failed: %s", exc)
        if run:
            run.state = IngestRun.StateChoices.FAILED
            run.error_message = str(exc)[:500]
            run.finished_at = now()
            run.save(update_fields=['state', 'error_message', 'finished_at'])
        if service_run_log is not None:
            _mark_run_log_finished(
                service_run_log,
                status_value='failed',
                error_detail=str(exc),
                output_summary={'ingest_run_id': run.id if run is not None else None},
            )
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=30, soft_time_limit=900, time_limit=1200)
def warm_intraday_universe(
    self,
    plan_items: list[dict] | None = None,
    service_run_log_id: int | None = None,
    page_size: int = 50,
    max_symbols: int | None = None,
    offset: int = 0,
    hot_only: bool | None = None,
):
    """
    Warm native intraday cache and hydrate canonical intraday rows.

    Slice C (QueueRecovery): chunk-aware — mỗi task chỉ xử lý tối đa `max_symbols`
    symbols (default 30) rồi tự enqueue continuation cho phần còn lại. Bound số học:
    max_symbols × per-symbol-timeout (30 × 15s = 450s) + DB < 600s (FR-03).
    Fix cả 2 path: hydrate-leg (có plan_items) và beat trực tiếp (fallback registry).
    Backstop time_limit 900/1200s chỉ giết task kẹt thật (DB wedge), không thay bound trên.

    Corrective live-measured: path beat trực tiếp (plan_items=None) mặc định HOT-ONLY —
    fallback toàn registry ~1942 symbols/5 phút sinh chuỗi 63 chunk bất tận (đo live: LLEN
    tăng 20/phút, drain ≈ 0). Beat là caller duy nhất không plan; caller explicit truyền
    plan_items (không ảnh hưởng) hoặc hot_only=False để ép full.
    """
    from data_ingest.models import IngestJob, IngestRun

    service_run_log = None
    if service_run_log_id is not None:
        from service_ops.models import ServiceRunLog
        from service_ops.tasks import _mark_run_log_finished, _mark_run_log_running

        service_run_log = ServiceRunLog.objects.select_related('service').filter(pk=service_run_log_id).first()
        if service_run_log is not None:
            _mark_run_log_running(service_run_log, getattr(self.request, 'id', ''))

    job, _ = IngestJob.objects.get_or_create(
        name='intraday-universe-hydrate',
        defaults={
            'source': IngestJob.SourceChoices.VNBROKER_INTRADAY,
            'status': IngestJob.StatusChoices.ACTIVE,
            'schedule_seconds': 300,
        },
    )

    run = None

    symbols = _extract_symbols_from_plan_items(plan_items)
    target_datasets = _extract_intraday_datasets_from_plan_items(plan_items)

    if not symbols:
        # Corrective live-measured: beat path (không plan) mặc định hot-only.
        # hot_only=True/False explicit luôn thắng; None + có plan_items → giữ plan.
        if hot_only is False:
            symbols = _get_default_global_registry_symbols()
        else:
            symbols = _get_hot_registry_symbols()

    if not symbols:
        if service_run_log is not None:
            _mark_run_log_finished(
                service_run_log,
                status_value='skipped',
                output_summary={'reason': 'no_symbols'},
            )
        return {'status': 'skipped', 'reason': 'no_symbols'}

    # Slice C (QueueRecovery): chunk-aware slicing — bound mọi task ≤ FR-03.
    chunk_size = max(int(max_symbols or _read_int_env(
        'WARM_INTRADAY_MAX_SYMBOLS_PER_TASK', _DEFAULT_WARM_MAX_SYMBOLS_PER_TASK)), 1)
    per_symbol_timeout = _read_int_env(
        'WARM_INTRADAY_PER_SYMBOL_TIMEOUT_SECONDS', _DEFAULT_WARM_PER_SYMBOL_TIMEOUT_SECONDS)
    safe_offset = max(int(offset or 0), 0)
    if safe_offset >= len(symbols):
        return {'status': 'skipped', 'reason': 'chunk_complete', 'symbols_total': len(symbols)}
    active_symbols = symbols[safe_offset:safe_offset + chunk_size]
    remaining = len(symbols) - safe_offset - len(active_symbols)
    active_set = set(active_symbols)
    active_plan_items = [
        item for item in (plan_items or [])
        if isinstance(item, dict) and str(item.get('symbol') or '').strip().upper() in active_set
    ]

    try:
        symbol_plan = _build_intraday_symbol_plan(active_plan_items or None, page_size)
        if not symbol_plan:
            symbol_plan = [{'symbol': symbol, 'page_size': max(int(page_size or 50), 1)} for symbol in active_symbols]

        run = IngestRun.objects.create(
            job=job,
            state=IngestRun.StateChoices.RUNNING,
        )
        _attach_ingest_run_to_service_run_log(service_run_log, run)
        result = _hydrate_intraday_symbols(
            symbol_plan, target_datasets, page_size=page_size,
            per_symbol_timeout_seconds=per_symbol_timeout,
        )
        # Corrective live-measured: full coverage refresh 30 symbols/chunk tốn ~1-3s/symbol
        # (~90s), đẩy chunk vượt bound. Run định kỳ (không plan explicit) xoay vòng 1/3 như
        # price-board (full sau ~3 pass); run explicit (plan_items) refresh full (rẻ + đúng ý đồ).
        if plan_items:
            coverage_refreshed_symbols = _refresh_coverage_for_symbols(active_symbols)
        else:
            warm_rotation_parts = _read_int_env('WARM_COVERAGE_ROTATION_PARTS', 3)
            coverage_refreshed_symbols = _refresh_coverage_for_symbols(
                _select_coverage_rotation(active_symbols, parts=warm_rotation_parts))

        total_upserted = int(result.get('inserted') or 0) + int(result.get('updated') or 0)
        total_skipped = int(result.get('skipped_existing') or 0)
        failed_count = int(result.get('failed_count') or 0)
        run.state = (
            IngestRun.StateChoices.FAILED
            if failed_count > 0 and total_upserted == 0 and total_skipped == 0
            else IngestRun.StateChoices.SUCCESS
        )
        run.rows_upserted = total_upserted
        run.rows_skipped = total_skipped
        # Slice C (QueueRecovery): self-continuation cho phần còn lại — cùng queue,
        # không service_run_log riêng (tránh spam log), parent log ghi flag continuation.
        continuation_enqueued = False
        if remaining > 0:
            try:
                same_queue = ((getattr(self.request, 'delivery_info', None) or {}).get('routing_key')
                              or 'realtime_prefetch')
            except Exception:
                same_queue = 'realtime_prefetch'
            try:
                # Corrective live-measured: continuation DELAY (countdown) để chunk nhường slot
                # cho shard/materialize xen kẽ — chuỗi 65 chunk back-to-back sẽ chiếm slot hàng giờ.
                chunk_countdown = _read_int_env('WARM_CHUNK_COUNTDOWN_SECONDS', 30)
                warm_intraday_universe.apply_async(
                    kwargs={
                        'plan_items': plan_items,
                        'page_size': page_size,
                        'max_symbols': chunk_size,
                        'offset': safe_offset + len(active_symbols),
                        'service_run_log_id': None,
                        'hot_only': hot_only,
                    },
                    queue=same_queue,
                    countdown=max(int(chunk_countdown), 0),
                )
                continuation_enqueued = True
            except Exception as exc:
                logger.warning('warm_intraday_universe: continuation enqueue failed: %s', exc)

        run.meta = {
            'symbols_count': len(active_symbols),
            'symbols_total': len(symbols),
            'page_size': page_size,
            'symbol_plan': list(symbol_plan),
            'target_datasets': list(target_datasets),
            'tick_counts': dict(result.get('tick_counts') or {}),
            'bar_counts': dict(result.get('bar_counts') or {}),
            'failed': list(result.get('failed') or []),
            'chunk': {
                'offset': safe_offset,
                'max_symbols': chunk_size,
                'remaining': remaining,
                'continuation_enqueued': continuation_enqueued,
            },
        }
        run.finished_at = now()
        run.save(update_fields=['state', 'rows_upserted', 'rows_skipped', 'meta', 'finished_at'])

        if service_run_log is not None:
            service_run_status = 'success'
            if failed_count > 0 and (total_upserted > 0 or total_skipped > 0):
                service_run_status = 'partial'
            elif failed_count > 0:
                service_run_status = 'failed'
            _mark_run_log_finished(
                service_run_log,
                status_value=service_run_status,
                output_summary={
                    'planned_items': len(active_plan_items or active_symbols),
                    'symbols_count': len(active_symbols),
                    'symbols_total': len(symbols),
                    'chunk': {
                        'offset': safe_offset,
                        'max_symbols': chunk_size,
                        'remaining': remaining,
                        'continuation_enqueued': continuation_enqueued,
                    },
                    'coverage_refreshed_symbols': coverage_refreshed_symbols,
                    'target_datasets': list(target_datasets),
                    'warmed_up_count': int(result.get('warmed_up_count') or 0),
                    'inserted': int(result.get('inserted') or 0),
                    'updated': int(result.get('updated') or 0),
                    'skipped_existing': int(result.get('skipped_existing') or 0),
                    'failed_count': failed_count,
                    'repaired_conflicts': int(result.get('repaired_conflicts') or 0),
                    'sources': list(result.get('sources') or []),
                    'tick_counts': dict(result.get('tick_counts') or {}),
                    'bar_counts': dict(result.get('bar_counts') or {}),
                    'ingest_run_id': run.id if run is not None else None,
                },
            )

        logger.info(
            'warm_intraday_universe (native): warmed %d / %d symbols (chunk offset=%d remaining=%d), inserted=%d updated=%d skipped_existing=%d',
            int(result.get('warmed_up_count', 0)),
            int(result.get('symbols_count', 0)),
            safe_offset,
            remaining,
            int(result.get('inserted', 0)),
            int(result.get('updated', 0)),
            int(result.get('skipped_existing', 0)),
        )
        result['coverage_refreshed_symbols'] = coverage_refreshed_symbols
        result['chunk'] = {
            'offset': safe_offset,
            'max_symbols': chunk_size,
            'remaining': remaining,
            'continuation_enqueued': continuation_enqueued,
        }
        return result
    except Exception as exc:
        logger.error('warm_intraday_universe failed: %s', exc, exc_info=True)
        if run is not None:
            run.state = IngestRun.StateChoices.FAILED
            run.error_message = str(exc)[:500]
            run.finished_at = now()
            run.save(update_fields=['state', 'error_message', 'finished_at'])
        if service_run_log is not None:
            _mark_run_log_finished(
                service_run_log,
                status_value='failed',
                error_detail=str(exc),
                output_summary={
                    'planned_items': len(plan_items or []),
                    'symbols_count': len(symbols),
                    'ingest_run_id': run.id if run is not None else None,
                },
            )
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=2)
def sync_market_groups(self, user_id=None, mode='active'):
    """
    Native: Đồng bộ danh sách symbol niêm yết từ vnbroker và seed default watchlist.
    """
    import logging

    from django.conf import settings

    from market_data.global_symbol_planner import create_global_planner_run
    from market_data.global_symbol_registry import (
        sync_admin_group_symbol_set,
        sync_system_default_symbol_group,
    )
    from market_data.models import StockProfile
    from market_data.vnbroker_adapter import (
        fetch_listing_symbols,
        fetch_symbol_group_members,
    )

    logger = logging.getLogger(__name__)

    # 0. Sync StockProfile metadata
    try:
        logger.info("Syncing StockProfile metadata from upstream listing client...")
        symbols_data = fetch_listing_symbols()
        if symbols_data:
            if mode == 'active':
                # Filter for standard 3-character stock symbols
                symbols_data = [
                    item for item in symbols_data
                    if item.get('symbol') and len(item['symbol']) == 3 and item['symbol'].isalpha()
                ]
            existing_profiles = {p.symbol: p for p in StockProfile.objects.all()}
            to_create = []
            to_update = []
            for item in symbols_data:
                sym = item.get('symbol')
                if not sym:
                    continue
                exchange = item.get('exchange', 'HOSE') or 'HOSE'
                company_name = item.get('company_name', '')
                industry = item.get('industry', '') or ''
                if sym in existing_profiles:
                    profile = existing_profiles[sym]
                    changed = False
                    if profile.exchange != exchange:
                        profile.exchange = exchange
                        changed = True
                    if profile.company_name != company_name:
                        profile.company_name = company_name
                        changed = True
                    if profile.industry != industry:
                        profile.industry = industry
                        changed = True
                    if profile.status != StockProfile.StatusChoices.ACTIVE:
                        profile.status = StockProfile.StatusChoices.ACTIVE
                        changed = True
                    if changed:
                        to_update.append(profile)
                else:
                    to_create.append(StockProfile(
                        symbol=sym,
                        exchange=exchange,
                        company_name=company_name,
                        industry=industry,
                        status=StockProfile.StatusChoices.ACTIVE
                    ))
            if to_create:
                StockProfile.objects.bulk_create(to_create, batch_size=500)
            if to_update:
                StockProfile.objects.bulk_update(to_update, ['exchange', 'company_name', 'industry', 'status'], batch_size=500)
            logger.info(f"Bulk synced StockProfile metadata: created {len(to_create)}, updated {len(to_update)}")
    except Exception as e:
        logger.error(f"Failed to sync StockProfile metadata during admin sync task: {e}")

    # Seed default watchlist groups if user_id is provided
    if user_id is not None:
        try:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            user = User.objects.get(pk=user_id)
            from market_data.stock_mgmt_native_views import (
                seed_default_watchlist_groups,
            )
            logger.info(f"Re-seeding default watchlist groups for user {user.username}...")
            seed_default_watchlist_groups(user, force_recreate=True, mode=mode)
        except Exception as e:
            logger.error(f"Failed to re-seed default watchlist groups during admin sync task: {e}")

    exchange_groups = getattr(settings, 'MARKET_DATA_SYNC_EXCHANGE_GROUPS', ['HOSE', 'HNX', 'UPCOM'])
    sector_groups = getattr(settings, 'MARKET_DATA_SYNC_SECTOR_GROUPS', [])
    index_groups = getattr(settings, 'MARKET_DATA_SYNC_INDEX_GROUPS', ['VN30', 'VN100'])

    all_synced_symbols = set()
    sync_results = {}
    errors = []

    # 1. Sync exchange-based groups (HOSE, HNX, UPCOM)
    for exchange in exchange_groups:
        try:
            logger.info(f"Fetching symbols for exchange: {exchange}")
            symbols = fetch_symbol_group_members(exchange)
            if symbols:
                if mode == 'active':
                    symbols = [s for s in symbols if len(s) == 3 and s.isalpha()]
                synced = sync_admin_group_symbol_set(
                    group_name=exchange.lower(),
                    symbols=symbols,
                    group_type="EXCHANGE",
                    description=f"All symbols on {exchange}",
                )
                count = len(synced)
                all_synced_symbols.update(symbols)
                sync_results[exchange] = {"synced": count, "symbols": symbols}
                logger.info(f"Synced {count} symbols for {exchange}")
            else:
                sync_results[exchange] = {"synced": 0, "symbols": [], "warning": "No symbols returned"}
        except Exception as e:
            error_msg = f"Failed to sync {exchange}: {e!s}"
            logger.error(error_msg)
            errors.append(error_msg)
            sync_results[exchange] = {"synced": 0, "error": str(e)}

    # 2. Sync sector groups (if configured)
    for sector in sector_groups:
        try:
            logger.info(f"Fetching symbols for sector: {sector}")
            symbols = fetch_symbol_group_members(sector)
            if symbols:
                if mode == 'active':
                    symbols = [s for s in symbols if len(s) == 3 and s.isalpha()]
                synced = sync_admin_group_symbol_set(
                    group_name=sector.lower().replace(' ', '_'),
                    symbols=symbols,
                    group_type="SECTOR",
                    description=f"Sector: {sector}",
                )
                count = len(synced)
                all_synced_symbols.update(symbols)
                sync_results[sector] = {"synced": count, "symbols": symbols}
                logger.info(f"Synced {count} symbols for sector {sector}")
        except Exception as e:
            error_msg = f"Failed to sync sector {sector}: {e!s}"
            logger.error(error_msg)
            errors.append(error_msg)
            sync_results[sector] = {"synced": 0, "error": str(e)}

    # 3. Sync index groups (VN30, VN100)
    for index_name in index_groups:
        try:
            logger.info(f"Fetching symbols for index: {index_name}")
            symbols = fetch_symbol_group_members(index_name)
            if symbols:
                if mode == 'active':
                    symbols = [s for s in symbols if len(s) == 3 and s.isalpha()]
                synced = sync_admin_group_symbol_set(
                    group_name=index_name.lower(),
                    symbols=symbols,
                    group_type="INDEX",
                    description=f"Index: {index_name}",
                )
                count = len(synced)
                all_synced_symbols.update(symbols)
                sync_results[index_name] = {"synced": count, "symbols": symbols}
                logger.info(f"Synced {count} symbols for index {index_name}")
        except Exception as e:
            error_msg = f"Failed to sync index {index_name}: {e!s}"
            logger.error(error_msg)
            errors.append(error_msg)
            sync_results[index_name] = {"synced": 0, "error": str(e)}

    # 4. Sync system default groups (VN30, VN100)
    try:
        for group_id in ('vn30', 'vn100'):
            symbols = fetch_symbol_group_members(group_id.upper())
            if symbols:
                if mode == 'active':
                    symbols = [s for s in symbols if len(s) == 3 and s.isalpha()]
                sync_system_default_symbol_group(group_id, symbols)
    except Exception as e:
        logger.warning(f"Failed to sync system default groups: {e}")

    # 5. Trigger GlobalSymbolPlanner for data ingestion
    planner_result = None
    if all_synced_symbols:
        try:
            logger.info(f"Triggering GlobalSymbolPlanner for {len(all_synced_symbols)} symbols")
            planner_result = create_global_planner_run(
                symbols=list(all_synced_symbols),
                datasets=['daily_prices', 'price_board_snapshot'],
                mode='missing_only',
                force_refresh=False,
                reason='admin_market_groups_sync',
                execution_mode='async',
            )
            logger.info(f"Planner triggered: {planner_result.get('run_id')}")
        except Exception as e:
            error_msg = f"Failed to trigger planner: {e!s}"
            logger.error(error_msg)
            errors.append(error_msg)

    total_synced = sum(r.get('synced', 0) for r in sync_results.values())

    return {
        "ok": len(errors) == 0,
        "total_symbols_synced": total_synced,
        "unique_symbols": len(all_synced_symbols),
        "groups": {k: {"synced": v.get("synced", 0)} for k, v in sync_results.items()},
        "planner": planner_result,
        "errors": errors,
        "message": f"Synced {total_synced} symbols across {len(sync_results)} groups" + 
                   (f" ({len(errors)} errors)" if errors else ""),
    }


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def ingest_daily_prices(
    self,
    days: int = 1,
    symbols: list = None,
    plan_items: list[dict] | None = None,
    service_run_log_id: int | None = None,
) -> dict:
    """
    Daily price ingestion task (P3-T01 core-worker topology).
    
    Fetches and upserts daily OHLCV data for specified symbols (default: last N days for all active).
    Wrapper around backfill_daily_prices with monitoring/observability.
    
    Called by: 
      - django-celery-beat schedule (daily at 17:00 VN time after market close)
      - Manual admin trigger endpoint (P3-T02)
    
    Args:
        days: number of days to backfill (default 1 for same-day or previous day catch-up)
        symbols: specific symbol list; None = all active GlobalSymbolRegistry symbols
    
    Returns:
        dict with 'status', 'upserted', 'failed', 'providers' keys
    """
    from django.utils.timezone import now

    from data_ingest.models import IngestJob, IngestRun

    service_run_log = None
    if service_run_log_id is not None:
        from service_ops.models import ServiceRunLog
        from service_ops.tasks import _mark_run_log_finished, _mark_run_log_running

        service_run_log = ServiceRunLog.objects.select_related('service').filter(pk=service_run_log_id).first()
        if service_run_log is not None:
            _mark_run_log_running(service_run_log, getattr(self.request, 'id', ''))
    
    # Get or create the IngestJob for daily price ingestion
    job, created = IngestJob.objects.get_or_create(
        name='daily-price-ingest',
        defaults={
            'source': IngestJob.SourceChoices.VNBROKER_PRICE_BOARD,
            'status': IngestJob.StatusChoices.ACTIVE,
            'schedule_seconds': 86400,  # 24 hours
        }
    )
    
    run = None
    
    try:
        # Create observability record for this ingest run
        run = IngestRun.objects.create(
            job=job,
            state=IngestRun.StateChoices.RUNNING,
        )
        _attach_ingest_run_to_service_run_log(service_run_log, run)
        
        unique_symbols = _extract_symbols_from_plan_items(plan_items)
        logger.info(
            f'ingest_daily_prices starting: days={days}, symbols={len(unique_symbols) if plan_items else len(symbols) if symbols else "all"}, '
            f'plan_items={len(plan_items or [])}, run_id={run.id}'
        )
        
        # Reuse the backfill execution logic inline instead of queuing a nested Celery job.
        result = backfill_daily_prices.run(days=days, symbols=symbols, plan_items=plan_items)
        
        upserted = result.get('upserted', 0)
        failed = result.get('failed', [])
        coverage_symbols = unique_symbols or _normalize_symbols(symbols)
        if not coverage_symbols and upserted:
            coverage_symbols = _get_default_global_registry_symbols()
        coverage_refreshed_symbols = _refresh_coverage_for_symbols(coverage_symbols)
        
        if run:
            run.state = IngestRun.StateChoices.SUCCESS
            run.rows_upserted = upserted
            run.finished_at = now()
            run.save(update_fields=['state', 'rows_upserted', 'finished_at'])

        if service_run_log is not None:
            _mark_run_log_finished(
                service_run_log,
                status_value='success',
                output_summary={
                    'days': days,
                    'symbols_count': len(unique_symbols) if plan_items else len(symbols or []),
                    'planned_items': int(result.get('planned_items') or len(plan_items or [])),
                    'inserted': int(result.get('inserted') or 0),
                    'updated': int(result.get('updated') or 0),
                    'skipped_existing': int(result.get('skipped_existing') or 0),
                    'upserted': upserted,
                    'coverage_refreshed_symbols': coverage_refreshed_symbols,
                    'failed_count': int(result.get('failed_count') or len(failed)),
                    'repaired_conflicts': int(result.get('repaired_conflicts') or 0),
                    'providers': result.get('providers', []),
                    'ingest_run_id': run.id if run is not None else None,
                },
            )
        
        logger.info(
            f'ingest_daily_prices completed: run_id={run.id if run else "none"}, upserted={upserted}, failed={len(failed)}, '
            f'providers={result.get("providers")}'
        )
        result['coverage_refreshed_symbols'] = coverage_refreshed_symbols
        return result
    
    except Exception as exc:
        logger.error(f'ingest_daily_prices failed: {exc}', exc_info=True)
        if run:
            run.state = IngestRun.StateChoices.FAILED
            run.error_message = str(exc)[:500]
            run.finished_at = now()
            run.save(update_fields=['state', 'error_message', 'finished_at'])

        if service_run_log is not None:
            _mark_run_log_finished(
                service_run_log,
                status_value='failed',
                error_detail=str(exc),
                output_summary={
                    'days': days,
                    'symbols_count': len(unique_symbols) if plan_items else len(symbols or []),
                    'ingest_run_id': run.id if run is not None else None,
                },
            )
        
        # Retry with exponential backoff (60s, 120s, 240s)
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))


def _b01_clear_inflight_cache(job_key: 'str | None') -> None:
    """B01 helper: clear the scheduler:inflight cache marker on task terminal state."""
    if not job_key:
        return
    try:
        from django.core.cache import cache
        cache.delete(f'scheduler:inflight:{job_key}')
    except Exception:
        pass


def _b08_finalize_stale_running_runs(job_key: 'str | None', stale_after_seconds: int = _B08_STALE_RUNNING_TTL_SECONDS) -> dict[str, int]:
    """B08 helper: close stale running/queued run records before new execution starts."""
    if not job_key:
        return {'stale_run_logs': 0, 'stale_backfill_runs': 0}
    try:
        from django.utils import timezone as _tz

        from service_ops.models import (
            BackfillExecutionRun,
            ServiceDefinition,
            ServiceRunLog,
        )
        from service_ops.scheduler_catalog import CATALOG_JOB_METADATA

        _meta = CATALOG_JOB_METADATA.get(job_key) or {}
        _service_key = str(_meta.get('service_key') or '').strip()
        _max_expected_seconds = int(_meta.get('max_expected_run_seconds') or 0)
        _effective_ttl_seconds = max(
            int(stale_after_seconds or 0),
            _max_expected_seconds + _B08_STALE_GRACE_SECONDS,
            1,
        )
        _cutoff = _tz.now() - timedelta(seconds=_effective_ttl_seconds)
        _closed_run_logs = 0

        if _service_key:
            _service_def = ServiceDefinition.objects.filter(service_key=_service_key).first()
            if _service_def is not None:
                _closed_run_logs = ServiceRunLog.objects.filter(
                    service=_service_def,
                    status__in=['queued', 'running'],
                    started_at__lt=_cutoff,
                ).update(
                    status='failed',
                    finished_at=_tz.now(),
                    error_detail='Auto-closed stale run log before new scheduler execution',
                )

        _closed_backfill_runs = BackfillExecutionRun.objects.filter(
            job_key=job_key,
            status='running',
            started_at__lt=_cutoff,
        ).update(
            status='failed',
            finished_at=_tz.now(),
            error_summary='Auto-closed stale execution run before new scheduler execution',
        )

        if _closed_run_logs or _closed_backfill_runs:
            _b01_clear_inflight_cache(job_key)

        return {
            'stale_run_logs': int(_closed_run_logs),
            'stale_backfill_runs': int(_closed_backfill_runs),
        }
    except Exception as exc:
        logger.warning('backfill stale-run cleanup failed for job_key=%s: %s', job_key, exc)
        return {'stale_run_logs': 0, 'stale_backfill_runs': 0}


def _backfill_daily_prices_impl(
    self,
    days: int = 365,
    symbols: list = None,
    max_workers: int = None,
    plan_items: list[dict] | None = None,
    service_run_log_id: int | None = None,
    _scheduler_job_key: str | None = None,
    # B07 — explicit mode and trigger
    mode: str = 'daily_delta',
    trigger: str = 'beat_schedule',
    celery_task_id: str | None = None,
):
    """
    Backfill DailyPrice cho tất cả active symbols (hoặc danh sách truyền vào).

    Strategy: chia đều symbols thành N buckets, mỗi bucket dùng một provider khác nhau
    (round-robin từ _HISTORY_PROVIDERS), rồi chạy N threads song song.
    Mỗi thread có inter-symbol delay nhỏ để tránh rate-limit từng provider riêng.

    Args:
        days: số ngày lịch sử cần backfill (mặc định 365).
        symbols: danh sách symbol cụ thể; None = tất cả active GlobalSymbolRegistry symbols.
        max_workers: số thread song song; None = số provider khả dụng.
        service_run_log_id: ID của ServiceRunLog pre-created bởi run_now dispatcher.
                            Nếu None và _scheduler_job_key được cung cấp, task tự tạo run log.
        _scheduler_job_key: job key từ CELERY_BEAT_SCHEDULE để map service_key và xóa cache.
    """
    # B01: Run log lifecycle management
    service_run_log = None
    _task_id = celery_task_id or getattr(self.request, 'id', '') or ''
    logger.info(
        'backfill_daily_prices start: job_key=%s task_id=%s celery_task_id=%s run_log_id=%s',
        _scheduler_job_key,
        getattr(self.request, 'id', None),
        celery_task_id,
        service_run_log_id,
    )
    _b08_cleanup_result = _b08_finalize_stale_running_runs(_scheduler_job_key)
    if _b08_cleanup_result.get('stale_run_logs') or _b08_cleanup_result.get('stale_backfill_runs'):
        logger.warning(
            'backfill_daily_prices auto-closed stale runs: job_key=%s run_logs=%s backfill_runs=%s',
            _scheduler_job_key,
            _b08_cleanup_result.get('stale_run_logs', 0),
            _b08_cleanup_result.get('stale_backfill_runs', 0),
        )
    if _scheduler_job_key and service_run_log_id is None and _task_id:
        try:
            from django.core.cache import cache
            if not cache.add(f'scheduler:inflight:{_scheduler_job_key}', _task_id, timeout=7200):
                logger.warning(
                    'backfill_daily_prices dedup skip: job_key=%s task_id=%s already inflight',
                    _scheduler_job_key,
                    _task_id,
                )
                return {'status': 'skipped_dedup', 'job_key': _scheduler_job_key}
        except Exception:
            logger.exception('backfill_daily_prices dedup guard failed; proceeding')
    try:
        from service_ops.models import ServiceRunLog
        from service_ops.tasks import _mark_run_log_finished, _mark_run_log_running

        if service_run_log_id is not None:
            # Operator-triggered run_now: run log pre-created, just transition to running.
            service_run_log = ServiceRunLog.objects.select_related('service').filter(
                pk=service_run_log_id
            ).first()
            if service_run_log is not None and service_run_log.status not in ('success', 'partial', 'failed', 'skipped'):
                _mark_run_log_running(service_run_log, _task_id)
        elif _scheduler_job_key:
            # Beat-triggered run: auto-create ServiceRunLog using catalog service_key.
            from service_ops.registry import get_registered_service
            from service_ops.scheduler_catalog import CATALOG_JOB_METADATA
            _catalog_entry = CATALOG_JOB_METADATA.get(_scheduler_job_key, {})
            _service_key = _catalog_entry.get('service_key', '')
            if _service_key:
                try:
                    _svc_def = get_registered_service(_service_key)
                    service_run_log = ServiceRunLog.objects.create(
                        service=_svc_def,
                        celery_task_id=_task_id,
                        status='running',
                        input_summary={
                            'triggered_by': 'beat_schedule',
                            'job_key': _scheduler_job_key,
                            'days': days,
                        },
                    )
                except Exception:
                    logger.exception(
                        'backfill_daily_prices failed to create ServiceRunLog: job_key=%s service_key=%s',
                        _scheduler_job_key,
                        _service_key,
                    )
    except Exception:
        logger.exception('backfill_daily_prices run-log bootstrap failed: job_key=%s', _scheduler_job_key)
    if plan_items is None and symbols is None:
        symbols = _get_default_global_registry_symbols()

    if plan_items is None:
        plan_items = _build_default_daily_price_plan_items(list(symbols or []), days)

    plan_items = _normalize_daily_plan_items(list(plan_items or []), days)

    if not plan_items:
        # B01: mark skipped in run log if one was created
        if service_run_log is not None:
            try:
                from service_ops.tasks import _mark_run_log_finished
                _mark_run_log_finished(
                    service_run_log,
                    status_value='skipped',
                    output_summary={'reason': 'no_symbols', 'days': days},
                )
            except Exception:
                pass
        _b01_clear_inflight_cache(_scheduler_job_key)
        return {'status': 'skipped', 'reason': 'no_symbols'}

    # B02: create BackfillExecutionRun row — persists even on crash
    _exec_run = None
    try:
        import uuid as _uuid_mod

        from django.utils import timezone as _tz

        from service_ops.models import BackfillExecutionBatch, BackfillExecutionRun
        _run_id = f'backfill-{_uuid_mod.uuid4().hex[:16]}'
        # B07 — use explicit mode/trigger params; fall back to inferred values
        _b07_mode = str(mode or 'daily_delta').strip() or 'daily_delta'
        _trigger = str(trigger or '').strip() or (
            'beat_schedule' if _scheduler_job_key else 'operator_run_now'
        )
        _exec_run = BackfillExecutionRun.objects.create(
            run_id=_run_id,
            job_key=_scheduler_job_key or '',
            service_run_log=service_run_log,
            mode=_b07_mode,
            trigger=_trigger,
            status='running',
            requested_days=days,
            planned_symbols_count=len(plan_items),
        )
    except Exception:
        logger.exception('backfill_daily_prices failed to create BackfillExecutionRun: job_key=%s', _scheduler_job_key)
        _exec_run = None

    # Store exec_run ref on request so on_failure handler can access it
    if _exec_run is not None:
        self.request.update({'_b02_exec_run_id': _exec_run.pk})
        try:
            from celery import current_task
            if current_task and current_task is not self and hasattr(current_task, 'request'):
                current_task.request.update({'_b02_exec_run_id': _exec_run.pk})
        except Exception:
            pass

    providers = _HISTORY_PROVIDERS
    n = len(providers)
    workers = max_workers or n

    # Round-robin partition: item[i] → providers[i % n]
    buckets: dict[str, list[dict]] = {p: [] for p in providers}
    for i, plan_item in enumerate(plan_items):
        buckets[providers[i % n]].append(plan_item)

    symbols = [str(item.get('symbol') or '').strip().upper() for item in plan_items if item.get('symbol')]

    logger.info(
        'backfill_daily_prices: %d symbols / %d plan items / %d providers / %d threads / %d days',
        len(symbols), len(plan_items), n, workers, days,
    )
    for p, bucket in buckets.items():
        logger.info('  bucket [%s]: %d plan items', p, len(bucket))

    total_inserted = 0
    total_updated = 0
    total_skipped_existing = 0
    total_upserted = 0
    all_failed: list[str] = []
    total_retries_used = 0
    per_provider_stats: dict[str, dict[str, float | int]] = {
        provider: {
            'inserted': 0,
            'updated': 0,
            'skipped_existing': 0,
            'failed_count': 0,
            'total_retries_used': 0,
            'provider_latency_p50_ms': 0.0,
            'provider_latency_p95_ms': 0.0,
        }
        for provider in providers
    }

    non_empty_buckets = [
        (provider, bucket)
        for provider, bucket in buckets.items()
        if bucket
    ]

    # B02: create BackfillExecutionBatch row per provider (before execution starts)
    _batch_rows: dict[str, object] = {}
    if _exec_run is not None:
        try:
            from django.utils import timezone as _tz

            from service_ops.models import BackfillExecutionBatch
            for _bi, (_prov, _bucket) in enumerate(non_empty_buckets):
                _batch = BackfillExecutionBatch.objects.create(
                    run=_exec_run,
                    provider=_prov,
                    batch_index=_bi,
                    symbols_count=len(_bucket),
                    state='running',
                    started_at=_tz.now(),
                )
                _batch_rows[_prov] = _batch
        except Exception:
            _batch_rows = {}

    _hb_last: dict[str, tuple[int, int, int, int, int]] = {}

    def _bucket_progress(_provider, processed, inserted, updated, skipped, failed):
        if _exec_run is None:
            return
        prev = _hb_last.get(_provider, (0, 0, 0, 0, 0))
        d_failed = int(failed) - prev[4]
        d_completed = max(int(processed) - prev[0] - d_failed, 0)
        d_inserted = int(inserted) - prev[1]
        d_updated = int(updated) - prev[2]
        d_skipped = int(skipped) - prev[3]
        _hb_last[_provider] = (int(processed), int(inserted), int(updated), int(skipped), int(failed))
        if not any((d_completed, d_failed, d_inserted, d_updated, d_skipped)):
            return
        try:
            from django.db.models import F

            from service_ops.models import BackfillExecutionRun
            BackfillExecutionRun.objects.filter(pk=_exec_run.pk).update(
                completed_symbols_count=F('completed_symbols_count') + d_completed,
                failed_symbols_count=F('failed_symbols_count') + d_failed,
                inserted_rows=F('inserted_rows') + d_inserted,
                updated_rows=F('updated_rows') + d_updated,
                skipped_existing_rows=F('skipped_existing_rows') + d_skipped,
            )
        except Exception:
            logger.exception('backfill heartbeat update failed [%s]', _provider)

    if workers <= 1 or len(non_empty_buckets) <= 1:
        for provider, bucket in non_empty_buckets:
            result = _fetch_and_upsert_bucket(
                [str(item.get('symbol') or '').strip().upper() for item in bucket],
                provider,
                days,
                _PROVIDER_INTER_SYMBOL_DELAY.get(provider.upper(), _DEFAULT_INTER_SYMBOL_DELAY),
                bucket,
                progress_callback=_bucket_progress,
            )
            total_inserted += int(result.get('inserted') or 0)
            total_updated += int(result.get('updated') or 0)
            total_skipped_existing += int(result.get('skipped_existing') or 0)
            total_upserted += result['upserted']
            all_failed.extend(result['failed'])
            total_retries_used += int(result.get('total_retries_used') or 0)
            provider_key = str(result.get('provider') or provider).strip().upper() or provider
            per_provider_stats[provider_key] = {
                'inserted': int(result.get('inserted') or 0),
                'updated': int(result.get('updated') or 0),
                'skipped_existing': int(result.get('skipped_existing') or 0),
                'failed_count': int(result.get('failed_count') or 0),
                'total_retries_used': int(result.get('total_retries_used') or 0),
                'provider_latency_p50_ms': float(result.get('provider_latency_p50_ms') or 0.0),
                'provider_latency_p95_ms': float(result.get('provider_latency_p95_ms') or 0.0),
            }
            logger.info(
                'backfill [%s] done: inserted=%d updated=%d skipped_existing=%d failed=%d',
                provider,
                int(result.get('inserted') or 0),
                int(result.get('updated') or 0),
                int(result.get('skipped_existing') or 0),
                len(result['failed']),
            )
    else:
        with ThreadPoolExecutor(max_workers=workers) as pool:
            futures = {
                pool.submit(
                    _fetch_and_upsert_bucket,
                    [str(item.get('symbol') or '').strip().upper() for item in bucket],
                    provider,
                    days,
                    _PROVIDER_INTER_SYMBOL_DELAY.get(provider.upper(), _DEFAULT_INTER_SYMBOL_DELAY),
                    bucket,
                    progress_callback=_bucket_progress,
                ): provider
                for provider, bucket in buckets.items()
                if bucket
            }
            for future in as_completed(futures):
                provider = futures[future]
                try:
                    result = future.result()
                    total_inserted += int(result.get('inserted') or 0)
                    total_updated += int(result.get('updated') or 0)
                    total_skipped_existing += int(result.get('skipped_existing') or 0)
                    total_upserted += result['upserted']
                    all_failed.extend(result['failed'])
                    total_retries_used += int(result.get('total_retries_used') or 0)
                    provider_key = str(result.get('provider') or provider).strip().upper() or provider
                    per_provider_stats[provider_key] = {
                        'inserted': int(result.get('inserted') or 0),
                        'updated': int(result.get('updated') or 0),
                        'skipped_existing': int(result.get('skipped_existing') or 0),
                        'failed_count': int(result.get('failed_count') or 0),
                        'total_retries_used': int(result.get('total_retries_used') or 0),
                        'provider_latency_p50_ms': float(result.get('provider_latency_p50_ms') or 0.0),
                        'provider_latency_p95_ms': float(result.get('provider_latency_p95_ms') or 0.0),
                    }
                    logger.info(
                        'backfill [%s] done: inserted=%d updated=%d skipped_existing=%d failed=%d',
                        provider,
                        int(result.get('inserted') or 0),
                        int(result.get('updated') or 0),
                        int(result.get('skipped_existing') or 0),
                        len(result['failed']),
                    )
                    # B02: update batch row
                    _batch_obj = _batch_rows.get(provider)
                    if _batch_obj is not None:
                        try:
                            from django.utils import timezone as _tz
                            _failed_syms = result.get('failed') or []
                            _batch_obj.state = 'failed' if _failed_syms and not int(result.get('inserted') or 0) and not int(result.get('updated') or 0) else ('done' if not _failed_syms else 'done')
                            _batch_obj.completed_symbols_count = len(buckets.get(provider) or [])
                            _batch_obj.inserted_rows = int(result.get('inserted') or 0)
                            _batch_obj.updated_rows = int(result.get('updated') or 0)
                            _batch_obj.skipped_existing_rows = int(result.get('skipped_existing') or 0)
                            _batch_obj.failed_symbols = _failed_syms[:200]
                            _batch_obj.latency_p50_ms = float(result.get('provider_latency_p50_ms') or 0.0)
                            _batch_obj.latency_p95_ms = float(result.get('provider_latency_p95_ms') or 0.0)
                            _batch_obj.finished_at = _tz.now()
                            _batch_obj.save(update_fields=[
                                'state', 'completed_symbols_count',
                                'inserted_rows', 'updated_rows', 'skipped_existing_rows',
                                'failed_symbols', 'latency_p50_ms', 'latency_p95_ms', 'finished_at',
                            ])
                        except Exception:
                            pass
                except Exception as exc:
                    logger.error('backfill thread [%s] raised: %s', provider, exc)
                    # B02: mark batch failed
                    _batch_obj = _batch_rows.get(provider)
                    if _batch_obj is not None:
                        try:
                            from django.utils import timezone as _tz
                            _batch_obj.state = 'failed'
                            _batch_obj.finished_at = _tz.now()
                            _batch_obj.save(update_fields=['state', 'finished_at'])
                        except Exception:
                            pass

    result = {
        'status': 'ok',
        'planned_items': len(plan_items),
        'inserted': total_inserted,
        'updated': total_updated,
        'skipped_existing': total_skipped_existing,
        'upserted': total_upserted,
        'failed': all_failed,
        'failed_count': len(all_failed),
        'repaired_conflicts': 0,
        'total_retries_used': total_retries_used,
        'per_provider': per_provider_stats,
        'providers': providers,
    }

    # B02: finalize BackfillExecutionRun
    if _exec_run is not None:
        try:
            from django.utils import timezone as _tz
            _final_status = 'partial' if all_failed else 'success'
            _exec_run.status = _final_status
            _exec_run.completed_symbols_count = len(symbols) - len(all_failed)
            _exec_run.failed_symbols_count = len(all_failed)
            _exec_run.inserted_rows = total_inserted
            _exec_run.updated_rows = total_updated
            _exec_run.skipped_existing_rows = total_skipped_existing
            _exec_run.finished_at = _tz.now()
            _exec_run.summary = {
                'planned_items': len(plan_items),
                'upserted': total_upserted,
                'total_retries_used': total_retries_used,
                'providers': providers,
            }
            _exec_run.save(update_fields=[
                'status', 'completed_symbols_count', 'failed_symbols_count',
                'inserted_rows', 'updated_rows', 'skipped_existing_rows',
                'finished_at', 'summary',
            ])
        except Exception:
            logger.exception('backfill_daily_prices failed to finalize BackfillExecutionRun: run=%s', _exec_run.pk)
    try:
        _affected_symbols = sorted({
            str(item.get('symbol') or '').strip().upper()
            for item in (plan_items or [])
            if isinstance(item, dict) and item.get('symbol')
        })
        if _affected_symbols:
            _coverage_rows = _refresh_coverage_for_symbols(_affected_symbols)
            result['coverage_refreshed'] = _coverage_rows
            logger.info(
                'backfill_daily_prices coverage refreshed: symbols=%s rows=%s',
                len(_affected_symbols),
                _coverage_rows,
            )
    except Exception:
        logger.exception('backfill_daily_prices coverage refresh failed')
    # B01: transition run log to success/partial and clear inflight cache marker.
    if service_run_log is not None:
        try:
            from service_ops.tasks import _mark_run_log_finished
            _final_status = 'partial' if all_failed else 'success'
            _mark_run_log_finished(
                service_run_log,
                status_value=_final_status,
                output_summary={
                    'days': days,
                    'planned_items': len(plan_items),
                    'inserted': total_inserted,
                    'updated': total_updated,
                    'skipped_existing': total_skipped_existing,
                    'upserted': total_upserted,
                    'failed_count': len(all_failed),
                    'total_retries_used': total_retries_used,
                    'providers': providers,
                },
            )
        except Exception:
            pass
    _b01_clear_inflight_cache(_scheduler_job_key)
    return result


@shared_task(
    bind=True,
    max_retries=2,
    default_retry_delay=60,
    time_limit=11400,
    soft_time_limit=10800,
)
def backfill_daily_prices(
    self,
    days: int = 365,
    symbols: list = None,
    max_workers: int = None,
    plan_items: list[dict] | None = None,
    service_run_log_id: int | None = None,
    _scheduler_job_key: str | None = None,
    # B07 — explicit mode and trigger
    mode: str = 'daily_delta',
    trigger: str = 'beat_schedule',
    celery_task_id: str | None = None,
):
    try:
        return _backfill_daily_prices_impl(
            self,
            days=days,
            symbols=symbols,
            max_workers=max_workers,
            plan_items=plan_items,
            service_run_log_id=service_run_log_id,
            _scheduler_job_key=_scheduler_job_key,
            mode=mode,
            trigger=trigger,
            celery_task_id=celery_task_id,
        )
    except SoftTimeLimitExceeded as exc:
        _task_id = celery_task_id or getattr(self.request, 'id', '') or ''
        logger.warning(
            'backfill_daily_prices: soft time limit exceeded! job_key=%s task_id=%s',
            _scheduler_job_key,
            _task_id,
        )
        # 1. Finalize BackfillExecutionRun in DB
        try:
            from service_ops.models import BackfillExecutionRun
            _exec_run = BackfillExecutionRun.objects.filter(
                job_key=_scheduler_job_key or '',
                status='running',
            ).first()
            if _exec_run:
                from django.utils import timezone as _tz
                _exec_run.status = 'failed'
                _exec_run.finished_at = _tz.now()
                _exec_run.error_summary = 'Bị dừng do vượt quá thời gian giới hạn (soft time limit exceeded).'
                _exec_run.save(update_fields=['status', 'finished_at', 'error_summary'])
        except Exception:
            pass

        # 2. Finalize ServiceRunLog in DB
        try:
            from service_ops.models import ServiceRunLog
            from service_ops.tasks import _mark_run_log_finished
            _log_query = ServiceRunLog.objects.filter(
                celery_task_id=_task_id,
                status='running',
            )
            if service_run_log_id:
                _log_query = ServiceRunLog.objects.filter(pk=service_run_log_id)
            
            _run_log = _log_query.first()
            if _run_log:
                _mark_run_log_finished(
                    _run_log,
                    status_value='failed',
                    output_summary={'reason': 'soft_time_limit_exceeded', 'days': days},
                )
        except Exception:
            pass

        # 3. Clear inflight cache
        _b01_clear_inflight_cache(_scheduler_job_key)
        raise exc


@shared_task(bind=True, max_retries=2, default_retry_delay=300)
def backfill_pre5y_to_market_inception(
    self,
    market_inception_date: str = '2000-07-28',
    recent_years: int = 5,
    symbols: list[str] | None = None,
    max_workers: int | None = None,
    service_run_log_id: int | None = None,
    _scheduler_job_key: str | None = None,
) -> dict:
    """
    Backfill OHLCV from market inception up to the day before the rolling recent window.

    The existing deep-history job already covers the latest 5 years. This task fills
    the pre-5-year range only, so operators can bootstrap full-history datasets.
    """
    try:
        parsed_inception_date = date.fromisoformat(str(market_inception_date).strip())
    except ValueError:
        return {
            'status': 'error',
            'reason': 'invalid_market_inception_date',
            'market_inception_date': str(market_inception_date),
        }

    normalized_recent_years = max(int(recent_years or 5), 1)
    today = now().date()
    recent_window_start_date = today - timedelta(days=normalized_recent_years * 365)
    pre5y_end_date = recent_window_start_date - timedelta(days=1)

    if parsed_inception_date > pre5y_end_date:
        return {
            'status': 'skipped',
            'reason': 'no_pre5y_window',
            'market_inception_date': parsed_inception_date.isoformat(),
            'pre5y_end_date': pre5y_end_date.isoformat(),
            'recent_years': normalized_recent_years,
        }

    normalized_symbols = _normalize_symbols(symbols) if symbols is not None else []
    if not normalized_symbols:
        normalized_symbols = _get_default_global_registry_symbols()

    if not normalized_symbols:
        return {'status': 'skipped', 'reason': 'no_symbols'}

    requested_days = max((pre5y_end_date - parsed_inception_date).days + 1, 1)
    requested_window = {
        'start_date': parsed_inception_date.isoformat(),
        'end_date': pre5y_end_date.isoformat(),
    }
    plan_items = [
        {
            'symbol': symbol,
            'requested_window': dict(requested_window),
        }
        for symbol in normalized_symbols
    ]
    trigger_mode = 'beat_schedule' if _scheduler_job_key else 'operator_run_now'

    result = backfill_daily_prices.run(
        days=requested_days,
        symbols=normalized_symbols,
        max_workers=max_workers,
        plan_items=plan_items,
        service_run_log_id=service_run_log_id,
        _scheduler_job_key=_scheduler_job_key,
        mode='historical_inception_backfill',
        trigger=trigger_mode,
        celery_task_id=getattr(self.request, 'id', ''),
    )
    result['market_inception_date'] = parsed_inception_date.isoformat()
    result['pre5y_end_date'] = pre5y_end_date.isoformat()
    result['recent_years'] = normalized_recent_years
    return result


@shared_task(bind=True, name='data_ingest.tasks.run_global_market_data_planner')
def run_global_market_data_planner(self, service_run_log_id: int) -> dict:
    from market_data.global_symbol_planner import execute_global_planner_run
    from service_ops.models import ServiceRunLog
    from service_ops.tasks import _mark_run_log_finished, _mark_run_log_running

    run_log = ServiceRunLog.objects.select_related('service').get(pk=service_run_log_id)
    if str(run_log.status or '').lower() in {'success', 'partial', 'failed', 'skipped'}:
        return {
            'run_id': f'md-run-{run_log.id}',
            'status': str(run_log.status or 'skipped').lower(),
            'summary': dict(run_log.output_summary or {}),
            'detail': 'Run already in terminal state; task execution skipped.',
        }
    _mark_run_log_running(run_log, getattr(self.request, 'id', ''))
    try:
        result = execute_global_planner_run(service_run_log_id=run_log.id)
        status_lookup = {
            'success': 'success',
            'partial': 'partial',
            'failed': 'failed',
            'skipped': 'skipped',
        }
        _mark_run_log_finished(
            run_log,
            status_value=status_lookup.get(str(result.get('status') or '').lower(), 'success'),
            output_summary=result,
        )
        return result
    except Exception as exc:
        logger.exception('run_global_market_data_planner failed for run_log_id=%s', service_run_log_id)
        _mark_run_log_finished(run_log, status_value='failed', error_detail=str(exc))
        raise


# ---------------------------------------------------------------------------
# Email tasks (C3 Email Onboarding Implementation)
# ---------------------------------------------------------------------------


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_email_verification_token(self, email: str, token: str, frontend_url: str = None) -> dict:
    """
    Async email send for email verification (registration flow).
    
    Called by: identity_access.views_auth.register_view
    
    Args:
        email: recipient email address
        token: verification token (raw, not hashed)
        frontend_url: optional frontend base URL (defaults to settings.FRONTEND_URL which is required in production)
    
    Returns:
        dict with 'status' and 'error' keys
    """
    if not frontend_url:
        # C4 Fix: FRONTEND_URL is always available in settings (required in production)
        frontend_url = django_settings.FRONTEND_URL
    
    verify_url = f'{frontend_url}/verify-email?token={token}'
    
    try:
        send_mail(
            subject='Xác minh địa chỉ email VNInvest',
            message=f'Nhấp vào liên kết sau để kích hoạt tài khoản của bạn:\n{verify_url}',
            from_email=django_settings.DEFAULT_FROM_EMAIL,
            recipient_list=[email],
            fail_silently=False,
        )
        logger.info(f'Email verification sent to {email}')
        return {'status': 'sent', 'email': email}
    
    except Exception as exc:
        logger.warning(f'Email verification send failed for {email}: {exc}. Retrying...')
        # Retry with exponential backoff
        try:
            raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))
        except Exception as retry_exc:
            logger.error(f'Email verification retry exhausted for {email}: {retry_exc}')
            return {'status': 'failed', 'email': email, 'error': str(retry_exc)}


@shared_task(bind=True, max_retries=5)
def trigger_email_verification_flow(self, user_id: int, outbox_event_id: str, email: str = None, token: str = None, frontend_url: str = None) -> dict:
    """
    SaaS Native Dynamic Mail Router — delegates to identity_access.mail_service.

    Routes: OAuth2 web-client → Google DWD → SMTP → settings SMTP fallback.
    Fallback to static settings SMTP is preserved when no active config or dynamic provider fails.
    """
    from django.utils import timezone

    from identity_access.mail_service import send_system_email
    from identity_access.models import OutboxEvent

    if not frontend_url:
        frontend_url = django_settings.FRONTEND_URL

    verify_url = f'{frontend_url}/verify-email?token={token}'
    subject = '[VNInvest] Xác minh địa chỉ email VNInvest'
    html_content = f'<p>Nhấp vào liên kết sau để kích hoạt tài khoản của bạn:</p><p><a href="{verify_url}">{verify_url}</a></p>'
    text_content = f'Nhấp vào liên kết sau để kích hoạt tài khoản của bạn:\n{verify_url}'

    try:
        try:
            logger.info('[MAIL_ROUTER] Routing verification email via mail_service.send_system_email')
            send_system_email(
                subject=subject,
                message=text_content,
                recipient_list=[email],
                html_message=html_content,
                fail_silently=False,
            )
        except Exception as dynamic_exc:
            logger.error(
                '[MAIL_ROUTER] mail_service failed (%s). Falling back to static settings SMTP.',
                dynamic_exc,
            )
            send_mail(
                subject=subject,
                message=text_content,
                html_message=html_content,
                from_email=django_settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email],
                fail_silently=False,
            )

        OutboxEvent.objects.filter(pk=outbox_event_id).update(
            status=OutboxEvent.STATUS_PROCESSED,
            processed_at=timezone.now(),
        )
        return {'status': 'sent', 'email': email, 'event_id': outbox_event_id}

    except Exception as exc:
        logger.exception('[MAIL_ROUTER] Verification email sending failed: %s. Retrying.', exc)
        OutboxEvent.objects.filter(pk=outbox_event_id).update(
            status=OutboxEvent.STATUS_FAILED,
            last_error=str(exc),
        )
        try:
            raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))
        except Exception as retry_exc:
            # C4: this used to `return {'status': 'failed'}` — a success-shaped dict
            # that made the failure invisible to the worker, Flower and every alert
            # rule, while the row sat in FAILED that nothing ever scanned again.
            # Re-raise so the failure is a real task failure, and point at the one
            # thing that can still fix it: the beat poller's dead-letter window.
            logger.error(
                '[MAIL_ROUTER] Retries exhausted for OutboxEvent %s (email=%s): %s. '
                'Row is FAILED; process_outbox_events will re-drive it after '
                'OUTBOX_FAILED_REDRIVE_AFTER_SECONDS.',
                outbox_event_id,
                email,
                retry_exc,
            )
            raise



@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_password_reset_email(self, email: str, token: str, frontend_url: str = None) -> dict:
    """
    Async email send for password reset flow.

    Called by: identity_access.views_auth.password_reset_request_view
    Routes via mail_service.send_system_email; falls back to static settings SMTP.
    """
    from identity_access.mail_service import send_system_email

    if not frontend_url:
        frontend_url = django_settings.FRONTEND_URL

    reset_url = f'{frontend_url}/reset-password?token={token}'
    subject = 'Đặt lại mật khẩu VNInvest'
    text_body = f'Nhấp vào liên kết sau để đặt lại mật khẩu:\n{reset_url}\n\nLinh kết hết hạn sau 1 giờ.'
    html_body = f'<p>Nhấp vào liên kết sau để đặt lại mật khẩu của bạn:</p><p><a href="{reset_url}">{reset_url}</a></p><p>Liên kết hết hạn sau 1 giờ.</p>'

    try:
        try:
            send_system_email(
                subject=subject,
                message=text_body,
                recipient_list=[email],
                html_message=html_body,
                fail_silently=False,
            )
        except Exception as dynamic_exc:
            logger.error('send_password_reset_email: mail_service failed (%s). Falling back to static SMTP.', dynamic_exc)
            send_mail(
                subject=subject,
                message=text_body,
                html_message=html_body,
                from_email=django_settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email],
                fail_silently=False,
            )
        logger.info('Password reset email sent to %s', email)
        return {'status': 'sent', 'email': email}

    except Exception as exc:
        logger.warning('Password reset email send failed for %s: %s. Retrying...', email, exc)
        try:
            raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))
        except Exception as retry_exc:
            logger.error('Password reset email retry exhausted for %s: %s', email, retry_exc)
            return {'status': 'failed', 'email': email, 'error': str(retry_exc)}


# ---------------------------------------------------------------------------
# D03: System backfill intraday tick from DNSE
# ---------------------------------------------------------------------------

_BACKFILL_BATCH_SIZE = 500
_MAX_BACKFILL_DAYS = 30  # system default; user-facing clamped tighter


# Giới hạn DNSE API calls: 20 tasks/phút = 1 call mỗi 3 giây, tránh Rate Limit Exceeded.
_DNSE_TASK_RATE_LIMIT = '20/m'
# Khoảng cách giữa các tasks khi orchestrator dispatch hàng loạt (giây).
_DNSE_BACKFILL_COUNTDOWN_SECS = int(getattr(django_settings, 'DNSE_BACKFILL_COUNTDOWN_SECS', 3))


@shared_task(
    bind=True,
    name='data_ingest.tasks.backfill_intraday_tick_system',
    queue='manual_on_demand',
    rate_limit=_DNSE_TASK_RATE_LIMIT,
    time_limit=600,
    soft_time_limit=540,
)
def backfill_intraday_tick_system(self, *, symbol: str, trade_date: str) -> dict:
    """
    System backfill: fetch DNSE tape cho một symbol/date và upsert vào IntradayTick.

    Hard rules (AGENTS.md §14):
    - Abort ngay khi get_system_provider_credentials() trả về None.
    - Presence check IntradayTick.filter(symbol, date).exists() trước bulk_create.
    - Không log api_key / api_secret.
    """
    from market_data.models import IntradayTick
    from market_data.vnbroker_adapter import (
        DnseRateLimitError,
        fetch_intraday_tape_history,
    )

    symbol_upper = str(symbol or '').strip().upper()
    if not symbol_upper or not trade_date:
        return {'status': 'error', 'reason': 'symbol và trade_date là bắt buộc'}

    # §14.4: Abort khi không có system provider credentials.
    # B2.4: đọc SystemBrokerCredential (purpose backfill) trước, fallback cách cũ (admin staff).
    from identity_access.models import (
        get_system_broker_secrets,
        get_system_provider_credentials,
    )

    api_key = api_secret = None
    system_secrets = get_system_broker_secrets('dnse', 'backfill')
    if system_secrets:
        api_key = system_secrets.get('client_id')
        api_secret = system_secrets.get('client_secret')
    if not api_key or not api_secret:
        creds = get_system_provider_credentials()
        if creds is None:
            logger.warning('backfill_intraday_tick_system: no system provider credentials — abort. symbol=%s date=%s',
                           symbol_upper, trade_date)
            return {'status': 'aborted', 'reason': 'no_system_credentials', 'symbol': symbol_upper, 'date': trade_date}
        api_key, api_secret = creds  # không log

    # §14.5: Presence check trước bulk_create using fast range query
    try:
        from datetime import datetime, time

        import pytz
        from django.utils.timezone import make_aware

        tz = pytz.timezone('Asia/Ho_Chi_Minh')
        dt_parsed = datetime.strptime(trade_date, '%Y-%m-%d')
        start_dt = make_aware(datetime.combine(dt_parsed, time.min), tz)
        end_dt = make_aware(datetime.combine(dt_parsed, time.max), tz)

        existing = IntradayTick.objects.filter(
            symbol=symbol_upper,
            timestamp__gte=start_dt,
            timestamp__lte=end_dt
        ).exists()
    except Exception as exc:
        logger.error('backfill_intraday_tick_system: DB check error: %s', exc)
        return {'status': 'error', 'reason': str(exc), 'symbol': symbol_upper, 'date': trade_date}

    if existing:
        logger.info('backfill_intraday_tick_system: skip (data exists) symbol=%s date=%s', symbol_upper, trade_date)
        return {'status': 'skipped', 'reason': 'already_exists', 'symbol': symbol_upper, 'date': trade_date}

    try:
        ticks = fetch_intraday_tape_history(
            symbol_upper, trade_date,
            api_key=api_key, api_secret=api_secret,
            source='dnse_system',
        )
    except DnseRateLimitError:
        # DNSE server-side rate limit — retry với exponential backoff
        # Attempt 1: 5 phút, Attempt 2: 10 phút, Attempt 3: 20 phút
        _countdown = 300 * (2 ** min(self.request.retries, 2))
        logger.warning(
            'backfill_intraday_tick_system: DNSE rate_limit — retry in %ds (attempt %d). symbol=%s date=%s',
            _countdown, self.request.retries + 1, symbol_upper, trade_date,
        )
        raise self.retry(countdown=_countdown, max_retries=3)
    if not ticks:
        return {'status': 'empty', 'symbol': symbol_upper, 'date': trade_date, 'ticks': 0}

    objs = [
        IntradayTick(
            symbol=symbol_upper,
            timestamp=t['timestamp'],
            price=t['price'],
            volume=t['volume'],
            side=t['side'].upper(),
            match_type=t.get('match_type', 'NormalMatch'),
            source=t.get('source', 'dnse_system'),
        )
        for t in ticks
    ]

    created = 0
    for i in range(0, len(objs), _BACKFILL_BATCH_SIZE):
        batch = objs[i:i + _BACKFILL_BATCH_SIZE]
        IntradayTick.objects.bulk_create(batch, ignore_conflicts=True)
        created += len(batch)

    logger.info('backfill_intraday_tick_system: done symbol=%s date=%s created=%d', symbol_upper, trade_date, created)

    # §12: IntradayTick là short-lived staging — chain enrichment pipeline để
    # materialize long-term canonical facts (whale canonical → session facts)
    # Dùng Celery chain để đảm bảo thứ tự: whale detection trước, session facts sau.
    # D06: thêm synthesize_intraday_bars_from_ticks cuối chain để IntradayBar
    # cũng được tổng hợp từ historical ticks sau khi backfill.
    try:
        from celery import chain as celery_chain

        from market_serving.materializers import materialize_session_facts
        from signal_intelligence.tasks import detect_and_store_global_whale_alerts
        celery_chain(
            detect_and_store_global_whale_alerts.si(symbol=symbol_upper, session_date=trade_date),
            materialize_session_facts.si(symbol=symbol_upper, session_date=trade_date),
            synthesize_intraday_bars_from_ticks.si(symbol=symbol_upper, trade_date=trade_date),
        ).apply_async()
        logger.info('backfill_intraday_tick_system: enrichment chain queued symbol=%s date=%s', symbol_upper, trade_date)
    except Exception as exc:
        logger.warning('backfill_intraday_tick_system: enrichment chain trigger failed symbol=%s date=%s: %s',
                       symbol_upper, trade_date, exc)

    return {'status': 'ok', 'symbol': symbol_upper, 'date': trade_date, 'ticks': created}


# ---------------------------------------------------------------------------
# D04: User self-serve backfill intraday tick from DNSE
# ---------------------------------------------------------------------------

_USER_BACKFILL_MAX_DAYS = 180  # §14.8: clamp tại view layer


@shared_task(bind=True, name='data_ingest.tasks.backfill_intraday_tick_user', queue='manual_on_demand')
def backfill_intraday_tick_user(self, *, user_id: int, symbol: str, trade_date: str) -> dict:
    """
    User self-serve backfill: dùng credential của user để fetch DNSE tape.

    Hard rules (AGENTS.md §14):
    - Chỉ nhận user_id (int) — không nhận api_key/api_secret qua Celery args.
    - Ghi vào shared IntradayTick — không tạo per-user silo.
    - Presence check trước bulk_create.
    """
    from market_data.models import IntradayTick
    from market_data.vnbroker_adapter import fetch_intraday_tape_history

    symbol_upper = str(symbol or '').strip().upper()
    if not symbol_upper or not trade_date:
        return {'status': 'error', 'reason': 'symbol và trade_date là bắt buộc'}

    # Lấy credential của user từ user_workspace.DNSECredential — không truyền qua Celery args
    try:
        from user_workspace.models import DNSECredential as _WorkspaceDNSECred
        cred = _WorkspaceDNSECred.objects.get(user_id=user_id, is_active=True)
        api_key = cred.get_client_id()
        api_secret = cred.get_client_secret()
    except Exception as exc:  # DoesNotExist hoặc decrypt error
        _exc_name = type(exc).__name__
        if 'DoesNotExist' in _exc_name:
            return {'status': 'error', 'reason': 'no_user_credential', 'user_id': user_id}
        logger.error('backfill_intraday_tick_user: credential error user_id=%s: %s', user_id, exc)
        return {'status': 'error', 'reason': 'credential_error', 'user_id': user_id}

    # §14.5: Presence check using fast range query
    try:
        from datetime import datetime, time

        import pytz
        from django.utils.timezone import make_aware

        tz = pytz.timezone('Asia/Ho_Chi_Minh')
        dt_parsed = datetime.strptime(trade_date, '%Y-%m-%d')
        start_dt = make_aware(datetime.combine(dt_parsed, time.min), tz)
        end_dt = make_aware(datetime.combine(dt_parsed, time.max), tz)

        user_ticks_exist = IntradayTick.objects.filter(
            symbol=symbol_upper,
            timestamp__gte=start_dt,
            timestamp__lte=end_dt
        ).exists()
    except Exception as exc:
        logger.error('backfill_intraday_tick_user: DB check error: %s', exc)
        return {'status': 'error', 'reason': str(exc), 'symbol': symbol_upper, 'date': trade_date}

    if user_ticks_exist:
        return {'status': 'skipped', 'reason': 'already_exists', 'symbol': symbol_upper, 'date': trade_date}

    ticks = fetch_intraday_tape_history(
        symbol_upper, trade_date,
        api_key=api_key, api_secret=api_secret,
        source='dnse_user',
    )
    if not ticks:
        return {'status': 'empty', 'symbol': symbol_upper, 'date': trade_date, 'ticks': 0}

    objs = [
        IntradayTick(
            symbol=symbol_upper,
            timestamp=t['timestamp'],
            price=t['price'],
            volume=t['volume'],
            side=t['side'].upper(),
            match_type=t.get('match_type', 'NormalMatch'),
            source=t.get('source', 'dnse_user'),
        )
        for t in ticks
    ]

    created = 0
    for i in range(0, len(objs), _BACKFILL_BATCH_SIZE):
        batch = objs[i:i + _BACKFILL_BATCH_SIZE]
        IntradayTick.objects.bulk_create(batch, ignore_conflicts=True)
        created += len(batch)

    logger.info('backfill_intraday_tick_user: done user=%s symbol=%s date=%s created=%d',
                user_id, symbol_upper, trade_date, created)

    # §12: chain enrichment pipeline — dữ liệu user backfill cũng phải
    # materialize whale canonical + session facts để tái sử dụng shared facts.
    # D06: thêm synthesize_intraday_bars_from_ticks để IntradayBar cũng được fill.
    try:
        from celery import chain as celery_chain

        from market_serving.materializers import materialize_session_facts
        from signal_intelligence.tasks import detect_and_store_global_whale_alerts
        celery_chain(
            detect_and_store_global_whale_alerts.si(symbol=symbol_upper, session_date=trade_date),
            materialize_session_facts.si(symbol=symbol_upper, session_date=trade_date),
            synthesize_intraday_bars_from_ticks.si(symbol=symbol_upper, trade_date=trade_date),
        ).apply_async()
        logger.info('backfill_intraday_tick_user: enrichment chain queued symbol=%s date=%s', symbol_upper, trade_date)
    except Exception as exc:
        logger.warning('backfill_intraday_tick_user: enrichment chain trigger failed symbol=%s date=%s: %s',
                       symbol_upper, trade_date, exc)

    return {'status': 'ok', 'symbol': symbol_upper, 'date': trade_date, 'ticks': created, 'user_id': user_id}


# ---------------------------------------------------------------------------
# D05: System orchestrator — DNSE intraday 90-ngày (quarterly backfill)
# ---------------------------------------------------------------------------

@shared_task(
    bind=True,
    name='data_ingest.tasks.enqueue_dnse_quarterly_backfill',
    queue='enrichment_offhours',
    time_limit=600,
    soft_time_limit=500,
)
def enqueue_dnse_quarterly_backfill(
    self,
    *,
    days_back: int = 90,
    symbols_group: str = 'global',
    _scheduler_job_key: str = 'dnse-quarterly-backfill-intraday',
    service_run_log_id: int | None = None,
) -> dict:
    """
    Orchestrator: quét 90 ngày giao dịch gần nhất, queue các slot còn thiếu
    IntradayTick vào 'manual_on_demand' via backfill_intraday_tick_system.

    Không ghi dữ liệu trực tiếp — chỉ dispatch subtasks.

    Hard rules:
    - symbols_group='global' (mặc định) → dùng GlobalSymbolRegistry SSOT toàn bộ.
    - symbols_group khác → fetch_symbol_group_members, fallback về global registry.
    - Presence check per (symbol, date) để tránh duplicate.
    - Chỉ queue 'missing_only' slots.
    - days_back hard-cap = 180 (DNSE tape retention window).
    """
    from datetime import date, timedelta

    from service_ops.models import ServiceDefinition, ServiceRunLog
    from service_ops.tasks import _mark_run_log_finished, _mark_run_log_running

    days_back = max(1, min(int(days_back or 90), 180))

    # S01: Ensure ServiceDefinition exists (idempotent — first run creates it)
    _own_run_log: ServiceRunLog | None = None
    try:
        _svc_def, _ = ServiceDefinition.objects.get_or_create(
            service_key='dnse_intraday_quarterly_backfill',
            defaults={
                'name': 'DNSE Intraday Quarterly Backfill',
                'domain': 'data_ingest',
                'description': 'Orchestrator: cào 90 ngày tape DNSE, dispatch backfill subtasks.',
                'owner_team': 'dataops',
                'is_active': True,
            },
        )
        if service_run_log_id is not None:
            # Triggered via run_now — re-use pre-created run log
            _own_run_log = ServiceRunLog.objects.filter(pk=service_run_log_id).first()
            if _own_run_log:
                _mark_run_log_running(_own_run_log, getattr(self.request, 'id', '') or '')
        else:
            # Triggered by beat schedule — create our own run log
            _own_run_log = ServiceRunLog.objects.create(
                service=_svc_def,
                celery_task_id=getattr(self.request, 'id', '') or '',
                status='running',
                input_summary={
                    'triggered_by': 'beat_schedule',
                    'job_key': _scheduler_job_key,
                    'days_back': days_back,
                    'symbols_group': symbols_group,
                },
            )
    except Exception as _svc_exc:
        logger.warning('enqueue_dnse_quarterly_backfill: ServiceRunLog setup failed: %s', _svc_exc)

    # 1. Resolve symbols — global matrix hoặc nhóm cụ thể
    if not symbols_group or symbols_group == 'global':
        symbols = _get_default_global_registry_symbols()
    elif symbols_group == 'vn100_watchlist':
        try:
            from market_data.vnbroker_adapter import fetch_symbol_group_members
            raw_members = fetch_symbol_group_members('vn100')
            vn100_symbols = {s.strip().upper() for s in raw_members if s and s.strip()}
        except Exception as exc:
            logger.warning('enqueue_dnse_quarterly_backfill: cannot resolve vn100: %s', exc)
            vn100_symbols = set()

        try:
            from user_workspace.models import TrackedSymbol, WatchlistItem
            watchlist_symbols = {
                s.strip().upper()
                for s in WatchlistItem.objects.values_list('symbol', flat=True).distinct()
                if s and s.strip()
            }
            tracked_symbols = {
                s.strip().upper()
                for s in TrackedSymbol.objects.values_list('symbol', flat=True).distinct()
                if s and s.strip()
            }
        except Exception as exc:
            logger.warning('enqueue_dnse_quarterly_backfill: cannot resolve watchlists: %s', exc)
            watchlist_symbols = set()
            tracked_symbols = set()

        symbols = sorted(vn100_symbols | watchlist_symbols | tracked_symbols)
    else:
        try:
            from market_data.vnbroker_adapter import fetch_symbol_group_members
            raw_members = fetch_symbol_group_members(symbols_group)
            symbols = sorted({s.strip().upper() for s in raw_members if s and s.strip()})
        except Exception as exc:
            logger.warning('enqueue_dnse_quarterly_backfill: cannot resolve group %s: %s', symbols_group, exc)
            symbols = []
        if not symbols:
            symbols = _get_default_global_registry_symbols()
    if not symbols:
        return {'status': 'error', 'reason': 'no_symbols', 'symbols_group': symbols_group}

    # 2. Generate trading date range (Mon–Fri, không kể cuối tuần)
    today = date.today()
    date_from = today - timedelta(days=days_back)
    trade_dates: list[str] = []
    cur = date_from
    while cur <= today:
        if cur.weekday() < 5:
            trade_dates.append(cur.isoformat())
        cur += timedelta(days=1)

    # 3. Presence check — lấy tập (symbol, date) đã có data
    # Use IntradayBar (1H timeframe) for presence check as it is ~1000x smaller
    # and composite indexed on (symbol, timeframe, datetime)
    existing_pairs: set[tuple[str, str]] = set()
    try:
        from datetime import datetime, time

        import pytz
        from django.db.models.functions import TruncDate
        from django.utils.timezone import make_aware

        from market_data.models import IntradayBar

        tz = pytz.timezone('Asia/Ho_Chi_Minh')
        sorted_dates = sorted(trade_dates)
        if sorted_dates:
            min_date = datetime.strptime(sorted_dates[0], '%Y-%m-%d').date()
            max_date = datetime.strptime(sorted_dates[-1], '%Y-%m-%d').date()
            start_dt = make_aware(datetime.combine(min_date, time.min), tz)
            end_dt = make_aware(datetime.combine(max_date, time.max), tz)

            qs = (
                IntradayBar.objects
                .filter(symbol__in=symbols, timeframe='1H', datetime__gte=start_dt, datetime__lte=end_dt)
                .annotate(trade_date=TruncDate('datetime'))
                .values_list('symbol', 'trade_date')
                .distinct()
            )
            for sym, dt in qs:
                if dt:
                    existing_pairs.add((sym, dt.isoformat() if hasattr(dt, 'isoformat') else str(dt)))
    except Exception as exc:
        logger.warning('enqueue_dnse_quarterly_backfill: presence query failed: %s', exc)
        # Nếu lỗi presence check — abort để tránh over-queue
        return {'status': 'error', 'reason': 'presence_check_failed', 'detail': str(exc)}

    # 4. Queue missing slots
    total_slots = len(symbols) * len(trade_dates)
    queued = 0
    skipped = 0
    for sym in symbols:
        for dt in trade_dates:
            if (sym, dt) in existing_pairs:
                skipped += 1
                continue
            # countdown = queued * N giây để stagger execution, tránh rate limit DNSE.
            # Kết hợp với rate_limit='20/m' trên task — belt-and-suspenders.
            backfill_intraday_tick_system.apply_async(
                kwargs={'symbol': sym, 'trade_date': dt},
                queue='manual_on_demand',
                countdown=queued * _DNSE_BACKFILL_COUNTDOWN_SECS,
            )
            queued += 1

    logger.info(
        'enqueue_dnse_quarterly_backfill: symbols=%d dates=%d total_slots=%d queued=%d skipped=%d '
        'days_back=%d group=%s',
        len(symbols), len(trade_dates), total_slots, queued, skipped, days_back, symbols_group,
    )
    _result = {
        'status': 'ok',
        'symbols': len(symbols),
        'trade_dates': len(trade_dates),
        'total_slots': total_slots,
        'queued': queued,
        'skipped_existing': skipped,
        'days_back': days_back,
        'symbols_group': symbols_group,
    }
    # S01: finalize run log
    if _own_run_log is not None:
        try:
            _mark_run_log_finished(_own_run_log, status_value='success', output_summary=_result)
        except Exception as _fin_exc:
            logger.warning('enqueue_dnse_quarterly_backfill: run log finalize failed: %s', _fin_exc)
    return _result


# ---------------------------------------------------------------------------
# D06: Synthesize IntradayBar từ IntradayTick đã có trong DB
# ---------------------------------------------------------------------------

def _synthesize_bars_from_db_ticks(symbol: str, trade_date: str) -> dict:
    """
    Đọc IntradayTick từ DB cho (symbol, trade_date) và tổng hợp IntradayBar.

    Không fetch từ vnbroker — chỉ đọc ticks đã được lưu, gọi
    _build_intraday_bar_payloads, rồi upsert vào IntradayBar.

    Returns dict với status, ticks_read, bars_computed, inserted, updated, skipped.
    """
    from datetime import time as _time

    from django.utils import timezone as _tz_range

    from market_data.models import IntradayBar, IntradayTick
    _trade_day = datetime.strptime(trade_date, '%Y-%m-%d').date()
    _day_start = _tz_range.make_aware(datetime.combine(_trade_day, _time.min))
    _day_end = _day_start + timedelta(days=1)
    symbol_upper = symbol.strip().upper()
    tick_rows = list(
        IntradayTick.objects.filter(
            symbol=symbol_upper,
            timestamp__gte=_day_start,
            timestamp__lt=_day_end,
        ).values('timestamp', 'price', 'volume', 'side', 'match_type', 'source')
        .order_by('timestamp')
    )
    if not tick_rows:
        return {
            'status': 'empty',
            'symbol': symbol_upper,
            'date': trade_date,
            'ticks_read': 0,
            'bars_computed': 0,
        }

    # Chuyển đổi sang normalized_trades format để dùng với _build_intraday_bar_payloads
    normalized_trades: list[dict] = []
    tick_sources: set[str] = set()
    for row in tick_rows:
        ts = row['timestamp']
        if hasattr(ts, 'tzinfo') and ts.tzinfo is None:
            ts = ts.replace(tzinfo=UTC)
        normalized_trades.append({
            'symbol': symbol_upper,
            'timestamp': ts,
            'price': float(row['price']),
            'volume': int(row['volume']),
            'side': _normalize_intraday_side(row.get('side')),
            'match_type': row.get('match_type') or 'NormalMatch',
            'source': row.get('source') or 'backfill',
        })
        if row.get('source'):
            tick_sources.add(row['source'])

    # Xác định source label cho bars từ source của ticks
    if any('dnse' in s for s in tick_sources):
        bar_source = 'dnse_backfill'
    elif tick_sources:
        bar_source = next(iter(tick_sources))
    else:
        bar_source = 'backfill'

    bar_payloads = _build_intraday_bar_payloads(symbol_upper, normalized_trades)
    # Override source — _build_intraday_bar_payloads hardcodes 'vnbroker_intraday'
    for payload in bar_payloads.values():
        payload['source'] = bar_source

    if not bar_payloads:
        return {
            'status': 'empty',
            'symbol': symbol_upper,
            'date': trade_date,
            'ticks_read': len(tick_rows),
            'bars_computed': 0,
        }

    # Presence check — chỉ upsert khi khác dữ liệu hiện có
    existing_bars_by_key = {
        (row['timeframe'], row['datetime']): row
        for row in IntradayBar.objects.filter(
            symbol=symbol_upper,
            timeframe__in=list(_INTRADAY_BAR_TIMEFRAMES),
            datetime__in=[payload['datetime'] for payload in bar_payloads.values()],
        ).values('timeframe', 'datetime', 'open', 'high', 'low', 'close', 'volume', 'source')
    }

    bar_objects: list[IntradayBar] = []
    inserted = 0
    updated = 0
    skipped = 0
    for key, payload in bar_payloads.items():
        existing_bar = existing_bars_by_key.get(key)
        if existing_bar is None:
            inserted += 1
            bar_objects.append(IntradayBar(**payload))
            continue
        if all(existing_bar[f] == payload[f] for f in ('open', 'high', 'low', 'close', 'volume', 'source')):
            skipped += 1
            continue
        updated += 1
        bar_objects.append(IntradayBar(**payload))

    if bar_objects:
        IntradayBar.objects.bulk_create(
            bar_objects,
            update_conflicts=True,
            update_fields=['open', 'high', 'low', 'close', 'volume', 'source'],
            unique_fields=['symbol', 'datetime', 'timeframe'],
        )

    return {
        'status': 'ok',
        'symbol': symbol_upper,
        'date': trade_date,
        'ticks_read': len(tick_rows),
        'bars_computed': len(bar_payloads),
        'inserted': inserted,
        'updated': updated,
        'skipped': skipped,
    }


@shared_task(
    bind=True,
    name='data_ingest.tasks.synthesize_intraday_bars_from_ticks',
    queue='manual_on_demand',
    max_retries=3,
    default_retry_delay=60,
)
def synthesize_intraday_bars_from_ticks(self, *, symbol: str, trade_date: str) -> dict:
    """
    D06: Tổng hợp IntradayBar từ IntradayTick đã có trong DB cho (symbol, trade_date).

    Được chain tự động sau backfill_intraday_tick_system và backfill_intraday_tick_user
    để đảm bảo chart OHLCV endpoints có đủ dữ liệu lịch sử sau mỗi lần backfill ticks.

    Không fetch từ mạng — chỉ đọc DB ticks → tổng hợp bars → upsert IntradayBar.
    Idempotent: chạy nhiều lần không gây duplicate (dùng upsert).
    """
    symbol_upper = str(symbol or '').strip().upper()
    if not symbol_upper or not trade_date:
        return {'status': 'error', 'reason': 'symbol và trade_date là bắt buộc'}

    try:
        result = _synthesize_bars_from_db_ticks(symbol_upper, trade_date)
        logger.info(
            'synthesize_intraday_bars_from_ticks: symbol=%s date=%s '
            'ticks=%d bars=%d inserted=%d updated=%d skipped=%d',
            symbol_upper, trade_date,
            result.get('ticks_read', 0),
            result.get('bars_computed', 0),
            result.get('inserted', 0),
            result.get('updated', 0),
            result.get('skipped', 0),
        )
        try:
            result['coverage_refreshed'] = _refresh_coverage_for_symbols([symbol_upper])
        except Exception:
            logger.exception(
                'synthesize_intraday_bars_from_ticks: coverage refresh failed symbol=%s date=%s',
                symbol_upper, trade_date,
            )
        return result
    except Exception as exc:
        logger.error(
            'synthesize_intraday_bars_from_ticks failed: symbol=%s date=%s: %s',
            symbol_upper, trade_date, exc,
        )
        raise self.retry(exc=exc)


@shared_task(name='data_ingest.tasks.process_outbox_events')
def process_outbox_events() -> dict:
    """
    R2: Periodic outbox processor task.
    Queries pending OutboxEvents and dispatches them to their consumers.
    Guarantees reliability and processed idempotency via ProcessedEvent.

    C3: this poller and ``trigger_email_verification_flow`` were BOTH consumers of
    the same ``UserRegisteredEvent`` row, and both wrote ``STATUS_PROCESSED``. The
    poller only ever ran the provisioning consumer, which never sends mail — so if
    the Celery message was lost (worker restart, non-persistent Redis, worker down)
    the beat poller picked the row up within 30s, marked it PROCESSED, and because
    the query only ever looked at PENDING it never retried. The account stayed
    ``is_active=False`` with a dead outbox row and no email ever sent.

    Now each event_type has exactly ONE consumer (``_OUTBOX_CONSUMERS``) and the
    poller can drive the email send itself, so the flow survives a lost broker
    message. The raw token is NOT recoverable (EmailVerificationToken stores only
    ``token_hash`` = SHA-256), so recovery mints a fresh token and invalidates the
    old one rather than trying to replay the original link.
    """
    from django.db import models, transaction
    from django.utils import timezone

    from identity_access.models import OutboxEvent, ProcessedEvent

    now = timezone.now()
    # PENDING: the normal path, plus stranded rows whose Celery message was lost.
    # FAILED: the dead-letter re-drive window (C4). A row that exhausted its Celery
    # retries used to be invisible forever, because the query only ever looked at
    # PENDING and the mail task returned a success-shaped dict while logging the
    # exhaustion at ERROR. Bounded by OUTBOX_MAX_REDRIVES so a permanently broken
    # row ends up parked in FAILED for a human instead of spinning forever.
    failed_cutoff = now - timedelta(seconds=OUTBOX_FAILED_REDRIVE_AFTER_SECONDS)
    pollable = (
        OutboxEvent.objects.filter(
            status__in=(OutboxEvent.STATUS_PENDING, OutboxEvent.STATUS_FAILED)
        )
        .filter(
            models.Q(status=OutboxEvent.STATUS_PENDING)
            | models.Q(
                status=OutboxEvent.STATUS_FAILED,
                created_at__lte=failed_cutoff,
                retry_count__lt=OUTBOX_MAX_REDRIVES,
            )
        )
        .order_by('created_at')[:50]
    )
    pending_events = list(pollable)
    processed_count = 0
    failed_count = 0
    recovered_count = 0
    skipped_retry_count = 0
    redriven_count = 0

    for base_event in pending_events:
        was_failed = base_event.status == OutboxEvent.STATUS_FAILED
        try:
            if _outbox_recovery_is_deferred(base_event):
                # Someone else may still be handling this row (the normal path is a
                # Celery task that usually finishes in seconds). Back off so the beat
                # poller and the worker cannot both send the same email.
                skipped_retry_count += 1
                continue

            with transaction.atomic():
                # Lock row để bảo đảm an toàn trên môi trường đa worker (Fix 2)
                event = (
                    OutboxEvent.objects.select_for_update(skip_locked=True)
                    .filter(pk=base_event.pk)
                    .first()
                )
                if not event or not _is_pollable(event, failed_cutoff):
                    continue

                # Step 1: Idempotency Check (R2)
                if ProcessedEvent.objects.filter(event_id=event.event_id).exists():
                    # Already processed, mark processed directly
                    event.status = OutboxEvent.STATUS_PROCESSED
                    event.processed_at = timezone.now()
                    event.save(update_fields=['status', 'processed_at'])
                    processed_count += 1
                    continue

                # Step 2: Route to the ONE consumer registered for this event type.
                consumer = _OUTBOX_CONSUMERS.get(event.event_type)
                if consumer is None:
                    # Unknown type: do NOT mark processed, and do NOT retry forever.
                    raise _UnknownOutboxEventType(event.event_type)

                consumer(event)

                # Step 3: Mark as processed
                if not ProcessedEvent.objects.filter(event_id=event.event_id).exists():
                    ProcessedEvent.objects.create(event_id=event.event_id)
                event.status = OutboxEvent.STATUS_PROCESSED
                event.processed_at = timezone.now()
                event.retry_count = 0
                event.last_error = ''
                event.save(
                    update_fields=['status', 'processed_at', 'retry_count', 'last_error']
                )

            processed_count += 1
            if _is_email_verification_event(base_event.event_type):
                recovered_count += 1
            if was_failed:
                redriven_count += 1

        except _UnknownOutboxEventType as e:
            # Fail fast and permanently instead of spinning 5 times on a typo.
            logger.error('Outbox event %s has an unrouted event_type: %s', base_event.event_id, e)
            try:
                with transaction.atomic():
                    OutboxEvent.objects.filter(pk=base_event.pk).update(
                        status=OutboxEvent.STATUS_FAILED,
                        last_error=str(e),
                    )
            except Exception:
                logger.exception('Failed to mark outbox event %s as failed', base_event.event_id)
            failed_count += 1

        except Exception as e:
            logger.exception(f"Outbox processing failed for event {base_event.event_id}: {e}")
            try:
                # Update in a separate transaction since the processing one rolled back
                with transaction.atomic():
                    event_err = OutboxEvent.objects.get(pk=base_event.pk)
                    event_err.retry_count += 1
                    event_err.last_error = str(e)

                    if event_err.retry_count >= 5:
                        event_err.status = OutboxEvent.STATUS_FAILED
                    else:
                        event_err.status = OutboxEvent.STATUS_PENDING

                    event_err.save(update_fields=['status', 'retry_count', 'last_error'])
            except Exception:
                pass
            failed_count += 1

    return {
        'processed': processed_count,
        'failed': failed_count,
        'recovered_verification_emails': recovered_count,
        'deferred_to_active_worker': skipped_retry_count,
        'failed_rows_redriven': redriven_count,
    }


def _is_pollable(event, failed_cutoff) -> bool:
    """Re-check eligibility under the row lock (C4 dead-letter window included)."""
    from identity_access.models import OutboxEvent

    if event.status == OutboxEvent.STATUS_PENDING:
        return True
    if event.status == OutboxEvent.STATUS_FAILED:
        return event.created_at <= failed_cutoff and event.retry_count < OUTBOX_MAX_REDRIVES
    return False


class _UnknownOutboxEventType(Exception):
    """Raised when an OutboxEvent carries an event_type with no registered consumer."""


#: Canonical outbox event types. One consumer each — that is the whole point of C3.
USER_REGISTERED_EVENT = 'UserRegisteredEvent'
#: Slice A should switch the resend flow (identity_access/views/register.py:397) to
#: this type. Until it does, the poller treats UserRegisteredEvent as an email event
#: too, because the raw token is unrecoverable and the account is stuck inactive.
EMAIL_VERIFICATION_REQUESTED_EVENT = 'EmailVerificationRequestedEvent'
#: Routing key for the (already synchronous) tenant provisioning done in
#: identity_access/views/register.py:113-144. Nothing needs to emit this today.
TENANT_PROVISIONING_EVENT = 'TenantProvisioningEvent'


def _is_email_verification_event(event_type: str) -> bool:
    return event_type in (USER_REGISTERED_EVENT, EMAIL_VERIFICATION_REQUESTED_EVENT)


#: A PENDING row younger than this is assumed to still be owned by the Celery task
#: that was dispatched for it. The beat poller runs every 30s; the recovery branch
#: only acts once the row is demonstrably stranded.
OUTBOX_RECOVERY_GRACE_SECONDS = 120

#: C4 — a row whose mail task exhausted its Celery retries is re-driven by this same
#: 30s poller once it has been FAILED for this long. Chosen over a dedicated retry
#: task because settings.py is not this slice's to edit: a new beat entry would need
#: the coordinator, whereas the poller that owns outbox recovery already runs.
OUTBOX_FAILED_REDRIVE_AFTER_SECONDS = 900

#: Hard ceiling on re-drives. A permanently broken row parks in FAILED for a human
#: instead of being retried forever.
OUTBOX_MAX_REDRIVES = 10


def _outbox_recovery_is_deferred(event) -> bool:
    from django.utils import timezone

    if not _is_email_verification_event(event.event_type):
        return False
    age_seconds = (timezone.now() - event.created_at).total_seconds()
    return age_seconds < OUTBOX_RECOVERY_GRACE_SECONDS


def _mint_verification_token(user):
    """Create a fresh verification token and invalidate the previous unused ones.

    Mirrors identity_access/views/register.py:161-175 (token_urlsafe(32) + SHA-256,
    TTL from settings.EMAIL_VERIFICATION_TOKEN_TTL_MINUTES) so a token minted by the
    recovery path is indistinguishable from one minted by the view.
    """
    import hashlib
    import secrets
    from datetime import timedelta as _timedelta

    from django.utils import timezone

    from identity_access.models import EmailVerificationToken

    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode('utf-8')).hexdigest()

    EmailVerificationToken.objects.filter(user=user, is_used=False).update(is_used=True)

    ttl_minutes = getattr(django_settings, 'EMAIL_VERIFICATION_TOKEN_TTL_MINUTES', 30)
    EmailVerificationToken.objects.create(
        user=user,
        token_hash=token_hash,
        expires_at=timezone.now() + _timedelta(minutes=ttl_minutes),
    )
    return raw_token


def consume_email_verification_event(event) -> None:
    """The single consumer for a verification-email outbox event.

    Runs INSIDE the poller's transaction and calls the mail task synchronously, so
    a send failure is counted by the poller's retry accounting instead of vanishing
    into a lost Celery message.
    """
    from django.contrib.auth import get_user_model

    User = get_user_model()
    payload = event.payload or {}
    user_id = payload.get('user_id')
    if not user_id:
        raise ValueError(
            f'OutboxEvent {event.event_id} ({event.event_type}) has no user_id in payload; '
            'cannot send a verification email.'
        )

    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        raise ValueError(f'User {user_id} from OutboxEvent {event.event_id} does not exist.')

    if user.is_active:
        # Already verified — the mail would be noise. Close the row out.
        logger.info(
            'Outbox %s: user %s already active, no verification email needed.',
            event.event_id,
            user_id,
        )
        return

    if not user.email:
        raise ValueError(f'User {user_id} has no email address; cannot send verification.')

    # The original raw token is unrecoverable (only its SHA-256 is stored), so a
    # recovered event gets a NEW token. The old unused ones are invalidated.
    raw_token = _mint_verification_token(user)
    frontend_url = getattr(django_settings, 'FRONTEND_URL', None)

    result = trigger_email_verification_flow(
        user.id,
        event.event_id,
        email=user.email,
        token=raw_token,
        frontend_url=frontend_url,
    )
    if not result or result.get('status') != 'sent':
        # The mail task swallowed a failure and returned a success-shaped dict.
        # Force the poller to retry rather than marking the row PROCESSED.
        raise RuntimeError(
            f'Verification email for outbox {event.event_id} not sent: {result}'
        )

    logger.info(
        'Outbox %s: verification email re-driven by the beat poller for user %s.',
        event.event_id,
        user_id,
    )


def consume_tenant_provisioning_event(event) -> None:
    """The single consumer for the tenant-provisioning event type."""
    status_res, msg = execute_provisioning_consumer(event.event_id, event.payload)
    if status_res == 'failed':
        raise ValueError(msg)
    if status_res == 'dropped':
        raise ValueError(f'Provisioning event {event.event_id} was already processed: {msg}')


#: event_type -> the ONE consumer allowed to handle it.
_OUTBOX_CONSUMERS = {
    USER_REGISTERED_EVENT: consume_email_verification_event,
    EMAIL_VERIFICATION_REQUESTED_EVENT: consume_email_verification_event,
    TENANT_PROVISIONING_EVENT: consume_tenant_provisioning_event,
}


def execute_provisioning_consumer(event_id, payload) -> tuple[str, str]:
    """
    R2: Idempotent user registration provisioning consumer.
    Checks and creates dynamic provisioning assets atomically.
    """
    from django.contrib.auth import get_user_model
    from django.db import transaction

    from identity_access.models import (
        CoreServiceAccount,
        CoreTenant,
        ProcessedEvent,
        UserProfile,
    )
    
    User = get_user_model()
    user_id = payload.get('user_id')
    
    if ProcessedEvent.objects.filter(event_id=event_id).exists():
        return "dropped", "Already processed."
        
    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return "failed", f"User {user_id} does not exist."
        
    try:
        with transaction.atomic():
            # Check/Create tenant
            tenant, created = CoreTenant.objects.get_or_create(
                owner_user=user,
                defaults={
                    'tenant_code': f"tenant_{user.username}",
                    'display_name': f"{user.first_name} {user.last_name}'s Workspace".strip() or f"{user.username}'s Workspace",
                    'plan': CoreTenant.PlanChoices.FREE,
                    'status': CoreTenant.StatusChoices.ACTIVE
                }
            )
            
            # Check/Create profile
            UserProfile.objects.get_or_create(
                user=user,
                defaults={
                    'tenant': tenant,
                    'display_name': f"{user.first_name} {user.last_name}".strip() or user.username,
                    'theme': 'dark',
                    'language': 'vi'
                }
            )
            
            # Check/Create service account
            CoreServiceAccount.objects.get_or_create(
                tenant=tenant,
                name="default",
                defaults={
                    'status': CoreServiceAccount.StatusChoices.ACTIVE,
                    'scopes': ['market:read', 'signals:read']
                }
            )
            
        return "processed", "Success"
    except Exception as e:
        logger.exception(f"Provisioning consumer failed for user {user_id}: {e}")
        return "failed", str(e)


# ---------------------------------------------------------------------------
# S2.0: Fundamentics consumed via the canonical vnbroker adapter
#        (market_data.vnbroker_adapter.get_company_financials_response, cached 12h).
#        No bespoke StockFundamental store / enrichment task — SSOT.
# ---------------------------------------------------------------------------


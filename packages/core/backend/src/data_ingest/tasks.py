"""
data_ingest Celery tasks.

fetch_and_upsert_price_board: fetches price board data and upserts into market_serving.SymbolSnapshot.
backfill_daily_prices: parallel multi-provider OHLCV backfill into DailyPrice.
send_email_verification_token: async email send for email verification (registration).
send_password_reset_email: async email send for password reset.
"""
import logging
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from celery import shared_task
from django.conf import settings as django_settings
from django.core.mail import send_mail
from django.utils.dateparse import parse_datetime
from django.utils.timezone import now

from market_data.vnbroker_adapter import fetch_daily_history, fetch_intraday_tape

logger = logging.getLogger(__name__)


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


def _normalize_symbols(symbols: list[str] | None) -> list[str]:
    if symbols is None:
        return []
    return sorted({str(symbol).strip().upper() for symbol in symbols if str(symbol).strip()})


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


def _hydrate_intraday_symbols(symbol_plan: list[dict[str, int | str]], target_datasets: list[str], page_size: int = 50) -> dict:
    from market_data.models import IntradayBar, IntradayTick

    target_dataset_set = set(target_datasets or _INTRADAY_PLAN_DATASETS)
    tick_counts = _empty_result_counts()
    bar_counts = _empty_result_counts()
    sources: list[str] = []
    warmed_up_count = 0
    failed_symbols: list[str] = []

    for plan_item in symbol_plan:
        symbol = str(plan_item.get('symbol') or '').strip().upper()
        if not symbol:
            continue
        symbol_page_size = max(int(plan_item.get('page_size') or page_size), 1)
        try:
            tape_result = fetch_intraday_tape(symbol, page_size=symbol_page_size)
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


def _fetch_daily_history_with_retry(symbol: str, provider: str, requested_days: int) -> tuple[list[dict], int, float]:
    attempts = max(int(_DAILY_HISTORY_RETRY_ATTEMPTS), 1)
    for attempt in range(1, attempts + 1):
        started_at = time.perf_counter()
        try:
            rows = fetch_daily_history(symbol, days=requested_days, source=provider)
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

    for plan_item in normalized_plan_items:
        symbol = str(plan_item.get('symbol') or '').strip().upper()
        if not symbol:
            continue
        try:
            requested_days = int(plan_item.get('normalized_days') or _resolve_history_days_from_window(plan_item.get('requested_window'), days))
            history_rows, attempts_used, latency_ms = _fetch_daily_history_with_retry(symbol, normalized_provider, requested_days)
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

        from market_serving.vnbroker_materializer import materialize_symbol_snapshot_from_vnbroker
        from market_data.models import StockProfile

        # SM-P2.3 Native: Fetch price board from vnbroker adapter.
        # When explicit planner items exist, restrict writes to that subset.
        symbols = _extract_symbols_from_plan_items(plan_items)
        if not symbols:
            symbols = list(
                StockProfile.objects
                .filter(status=StockProfile.StatusChoices.ACTIVE)
                .values_list('symbol', flat=True)
            )

        if not symbols:
            if run:
                run.state = IngestRun.StateChoices.SKIPPED
                run.error_message = 'No active symbols found in StockProfile'
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
        coverage_refreshed_symbols = _refresh_coverage_for_symbols(symbols)

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


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def warm_intraday_universe(
    self,
    plan_items: list[dict] | None = None,
    service_run_log_id: int | None = None,
    page_size: int = 50,
):
    """
    Warm native intraday cache and hydrate canonical intraday rows.
    """
    from data_ingest.models import IngestJob, IngestRun
    from market_data.models import StockProfile

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
        symbols = list(
            StockProfile.objects
            .filter(status=StockProfile.StatusChoices.ACTIVE)
            .values_list('symbol', flat=True)
        )

    if not symbols:
        if service_run_log is not None:
            _mark_run_log_finished(
                service_run_log,
                status_value='skipped',
                output_summary={'reason': 'no_symbols'},
            )
        return {'status': 'skipped', 'reason': 'no_symbols'}

    try:
        symbol_plan = _build_intraday_symbol_plan(plan_items, page_size)
        if not symbol_plan:
            symbol_plan = [{'symbol': symbol, 'page_size': max(int(page_size or 50), 1)} for symbol in symbols]

        run = IngestRun.objects.create(
            job=job,
            state=IngestRun.StateChoices.RUNNING,
        )
        _attach_ingest_run_to_service_run_log(service_run_log, run)
        result = _hydrate_intraday_symbols(symbol_plan, target_datasets, page_size=page_size)
        coverage_refreshed_symbols = _refresh_coverage_for_symbols(symbols)

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
        run.meta = {
            'symbols_count': len(symbols),
            'page_size': page_size,
            'symbol_plan': list(symbol_plan),
            'target_datasets': list(target_datasets),
            'tick_counts': dict(result.get('tick_counts') or {}),
            'bar_counts': dict(result.get('bar_counts') or {}),
            'failed': list(result.get('failed') or []),
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
                    'planned_items': len(plan_items or []),
                    'symbols_count': len(symbols),
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
            'warm_intraday_universe (native): warmed %d / %d symbols, inserted=%d updated=%d skipped_existing=%d',
            int(result.get('warmed_up_count', 0)),
            int(result.get('symbols_count', 0)),
            int(result.get('inserted', 0)),
            int(result.get('updated', 0)),
            int(result.get('skipped_existing', 0)),
        )
        result['coverage_refreshed_symbols'] = coverage_refreshed_symbols
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
def sync_market_groups(self):
    """
    Native: Đồng bộ danh sách symbol niêm yết từ vnbroker.
    Cập nhật hoặc tạo mới StockProfile.
    """
    from market_data.vnbroker_adapter import fetch_listing_symbols
    from market_data.models import StockProfile
    
    symbols_data = fetch_listing_symbols()
    upserted = 0
    
    for item in symbols_data:
        StockProfile.objects.update_or_create(
            symbol=item['symbol'],
            defaults={
                'exchange': item.get('exchange', 'HOSE'),
                'company_name': item.get('company_name', ''),
                'industry': item.get('industry', ''),
                'status': StockProfile.StatusChoices.ACTIVE,
            }
        )
        upserted += 1
        
    return {'status': 'ok', 'upserted': upserted}


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
        symbols: specific symbol list; None = all active StockProfile
    
    Returns:
        dict with 'status', 'upserted', 'failed', 'providers' keys
    """
    from data_ingest.models import IngestJob, IngestRun
    from django.utils.timezone import now

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
            from market_data.models import StockProfile

            coverage_symbols = list(
                StockProfile.objects
                .filter(status=StockProfile.StatusChoices.ACTIVE)
                .values_list('symbol', flat=True)
            )
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


@shared_task(bind=True, max_retries=2, default_retry_delay=60)
def backfill_daily_prices(
    self,
    days: int = 365,
    symbols: list = None,
    max_workers: int = None,
    plan_items: list[dict] | None = None,
):
    """
    Backfill DailyPrice cho tất cả active symbols (hoặc danh sách truyền vào).

    Strategy: chia đều symbols thành N buckets, mỗi bucket dùng một provider khác nhau
    (round-robin từ _HISTORY_PROVIDERS), rồi chạy N threads song song.
    Mỗi thread có inter-symbol delay nhỏ để tránh rate-limit từng provider riêng.

    Args:
        days: số ngày lịch sử cần backfill (mặc định 365).
        symbols: danh sách symbol cụ thể; None = tất cả active StockProfile.
        max_workers: số thread song song; None = số provider khả dụng.
    """
    from market_data.models import StockProfile

    if plan_items is None and symbols is None:
        symbols = list(
            StockProfile.objects
            .filter(status=StockProfile.StatusChoices.ACTIVE)
            .values_list('symbol', flat=True)
        )

    if plan_items is None:
        plan_items = _build_default_daily_price_plan_items(list(symbols or []), days)

    plan_items = _normalize_daily_plan_items(list(plan_items or []), days)

    if not plan_items:
        return {'status': 'skipped', 'reason': 'no_symbols'}

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

    if workers <= 1 or len(non_empty_buckets) <= 1:
        for provider, bucket in non_empty_buckets:
            result = _fetch_and_upsert_bucket(
                [str(item.get('symbol') or '').strip().upper() for item in bucket],
                provider,
                days,
                0.12,
                bucket,
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
                    0.12,
                    bucket,
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
                except Exception as exc:
                    logger.error('backfill thread [%s] raised: %s', provider, exc)

    return {
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


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_password_reset_email(self, email: str, token: str, frontend_url: str = None) -> dict:
    """
    Async email send for password reset flow.
    
    Called by: identity_access.views_auth.password_reset_request_view
    
    Args:
        email: recipient email address
        token: reset token (raw, not hashed)
        frontend_url: optional frontend base URL (defaults to settings.FRONTEND_URL which is required in production)
    
    Returns:
        dict with 'status' and 'error' keys
    """
    if not frontend_url:
        # C4 Fix: FRONTEND_URL is always available in settings (required in production)
        frontend_url = django_settings.FRONTEND_URL
    
    reset_url = f'{frontend_url}/reset-password?token={token}'
    
    try:
        send_mail(
            subject='Đặt lại mật khẩu VNInvest',
            message=f'Nhấp vào liên kết sau để đặt lại mật khẩu:\n{reset_url}\n\nLinh kết hết hạn sau 1 giờ.',
            from_email=django_settings.DEFAULT_FROM_EMAIL,
            recipient_list=[email],
            fail_silently=False,
        )
        logger.info(f'Password reset email sent to {email}')
        return {'status': 'sent', 'email': email}
    
    except Exception as exc:
        logger.warning(f'Password reset email send failed for {email}: {exc}. Retrying...')
        # Retry with exponential backoff
        try:
            raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))
        except Exception as retry_exc:
            logger.error(f'Password reset email retry exhausted for {email}: {retry_exc}')
            return {'status': 'failed', 'email': email, 'error': str(retry_exc)}

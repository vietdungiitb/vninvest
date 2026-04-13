import concurrent.futures as cf
import logging
import os
import threading
import time

import pandas as pd

from portfolio.exceptions import ExternalSystemException
from portfolio.vnstock_runtime_config import get_vnstock_runtime_settings

from .cache_adapter import is_rate_limited_error


logger = logging.getLogger(__name__)


_PRICE_BOARD_FIELDS_BY_SECTION = {
    'listing': {'ref_price', 'ceiling', 'floor'},
    'match': {'match_price', 'reference_price', 'ceiling_price', 'floor_price', 'open_price', 'highest', 'lowest'},
    'bid_ask': {
        'bid_1_price', 'bid_2_price', 'bid_3_price',
        'ask_1_price', 'ask_2_price', 'ask_3_price',
    },
}


def _normalize_price_board_dataframe(price_board_df):
    if price_board_df is None or getattr(price_board_df, 'empty', True):
        return price_board_df

    if not isinstance(price_board_df, pd.DataFrame):
        return price_board_df

    normalized_df = price_board_df.copy()
    columns = normalized_df.columns
    if isinstance(columns, pd.MultiIndex):
        for column in columns:
            if not isinstance(column, tuple) or len(column) < 2:
                continue
            section = str(column[0] or '').strip().lower()
            field = str(column[1] or '').strip().lower()
            if field not in _PRICE_BOARD_FIELDS_BY_SECTION.get(section, set()):
                continue
            normalized_df[column] = pd.to_numeric(normalized_df[column], errors='coerce')
        return normalized_df

    for column in columns:
        field = str(column or '').strip().lower()
        if any(field in section_fields for section_fields in _PRICE_BOARD_FIELDS_BY_SECTION.values()):
            normalized_df[column] = pd.to_numeric(normalized_df[column], errors='coerce')
    return normalized_df


def _resolve_int_env(name: str, default_value: int, min_value: int = 0) -> int:
    try:
        value = int(os.getenv(name, str(default_value)))
    except (TypeError, ValueError):
        value = default_value
    return max(value, min_value)


def _resolve_float_env(name: str, default_value: float, min_value: float = 0.0) -> float:
    try:
        value = float(os.getenv(name, str(default_value)))
    except (TypeError, ValueError):
        value = default_value
    return max(value, min_value)


_VNSTOCK_GATE_BY_LIMIT: dict[int, threading.BoundedSemaphore] = {}
_VNSTOCK_GATE_LOCK = threading.Lock()


def _get_runtime_settings() -> dict:
    settings_payload = get_vnstock_runtime_settings()
    if not isinstance(settings_payload, dict):
        settings_payload = {}
    return settings_payload


def _get_gate(limit: int) -> threading.BoundedSemaphore:
    with _VNSTOCK_GATE_LOCK:
        gate = _VNSTOCK_GATE_BY_LIMIT.get(limit)
        if gate is None:
            gate = threading.BoundedSemaphore(value=limit)
            _VNSTOCK_GATE_BY_LIMIT[limit] = gate
        return gate


def _resolve_timeout(channel: str, default_timeout: int = 8) -> int:
    runtime_settings = _get_runtime_settings()
    timeout_cfg = runtime_settings.get('timeout_config') if isinstance(runtime_settings.get('timeout_config'), dict) else {}
    configured = timeout_cfg.get(str(channel or 'general').strip().lower())
    if configured is not None:
        try:
            timeout_value = int(configured)
        except (TypeError, ValueError):
            timeout_value = default_timeout
        return max(timeout_value, 1)

    env_key = f"VNSTOCK_{str(channel or 'general').upper()}_TIMEOUT_SECONDS"
    try:
        timeout_value = int(os.getenv(env_key, default_timeout))
    except (TypeError, ValueError):
        timeout_value = default_timeout
    return max(timeout_value, 1)


def _import_vnstock():
    try:
        from vnstock import Vnstock
        return Vnstock
    except ImportError as exc:
        raise ExternalSystemException('vnstock chưa được cài đặt.', code='vnstock_missing') from exc


def _build_stock_client(symbol: str, source: str = 'VCI'):
    vnstock_cls = _import_vnstock()
    return vnstock_cls().stock(symbol=symbol, source=source)


def _resolve_price_board_sources(explicit_source: str | None = None) -> list[str]:
    runtime_settings = _get_runtime_settings()

    configured_primary = str(runtime_settings.get('price_board_source') or '').strip().upper()
    configured_fallbacks = runtime_settings.get('fallback_sources') if isinstance(runtime_settings.get('fallback_sources'), list) else []
    fallback_items = [str(item or '').strip().upper() for item in configured_fallbacks if str(item or '').strip()]

    primary = str(explicit_source or configured_primary or os.getenv('VNSTOCK_PRICE_BOARD_SOURCE', 'KBS') or 'KBS').strip().upper()
    if not fallback_items:
        fallback_raw = str(os.getenv('VNSTOCK_PRICE_BOARD_FALLBACK_SOURCES', 'VCI') or '').strip()
        fallback_items = [item.strip().upper() for item in fallback_raw.split(',') if item.strip()]

    ordered = []
    for source in [primary] + fallback_items:
        if source and source not in ordered:
            ordered.append(source)
    return ordered or ['KBS']


def _run_with_timeout(fn, timeout=8):
    runtime_settings = _get_runtime_settings()

    retry_attempts = runtime_settings.get('retry_attempts')
    if retry_attempts is None:
        retry_attempts = _resolve_int_env('VNSTOCK_RETRY_ATTEMPTS', 1, 0)
    retry_backoff_seconds = runtime_settings.get('retry_backoff_seconds')
    if retry_backoff_seconds is None:
        retry_backoff_seconds = _resolve_float_env('VNSTOCK_RETRY_BACKOFF_SECONDS', 0.35, 0.0)

    max_concurrency = runtime_settings.get('max_concurrency')
    if max_concurrency is None:
        max_concurrency = _resolve_int_env('VNSTOCK_MAX_CONCURRENCY', 12, 1)
    max_concurrency = max(int(max_concurrency), 1)

    enable_concurrent_limit = bool(runtime_settings.get('enable_concurrent_limit', True))
    enable_rate_limit_detection = bool(runtime_settings.get('enable_rate_limit_detection', True))

    max_attempts = int(retry_attempts) + 1
    last_error = None

    for attempt in range(max_attempts):
        gate = _get_gate(max_concurrency) if enable_concurrent_limit else None
        if gate is not None:
            acquired = gate.acquire(timeout=max(timeout, 1))
            if not acquired:
                last_error = ExternalSystemException(
                    'vnstock queue saturated, thử lại sau.',
                    code='vnstock_busy',
                )
                break

        try:
            with cf.ThreadPoolExecutor(max_workers=1) as executor:
                future = executor.submit(fn)
                return future.result(timeout=timeout)
        except cf.TimeoutError as exc:
            last_error = ExternalSystemException(
                f'vnstock timeout sau {timeout}s',
                code='vnstock_timeout',
            )
        except (Exception, SystemExit) as exc:
            is_rate_limited = enable_rate_limit_detection and is_rate_limited_error(exc)
            code = 'vnstock_rate_limited' if is_rate_limited else 'vnstock_error'
            last_error = ExternalSystemException(str(exc), code=code)
        finally:
            if gate is not None:
                gate.release()

        should_retry = (
            attempt < max_attempts - 1
            and last_error is not None
            and last_error.code in {'vnstock_timeout', 'vnstock_error'}
            and (
                '502' in str(last_error).lower()
                or '503' in str(last_error).lower()
                or '504' in str(last_error).lower()
                or 'bad gateway' in str(last_error).lower()
                or 'temporarily unavailable' in str(last_error).lower()
            )
        )
        if should_retry:
            time.sleep(float(retry_backoff_seconds) * (attempt + 1))
            continue
        break

    if last_error is not None:
        raise last_error
    raise ExternalSystemException('vnstock unknown error', code='vnstock_error')


def fetch_intraday_dataframe(symbol: str, page_size: int):
    stock_client = _build_stock_client(symbol=symbol, source='VCI')

    return _run_with_timeout(
        lambda: stock_client.quote.intraday(
            symbol=symbol,
            page_size=page_size,
        ),
        timeout=_resolve_timeout('intraday', 8),
    )


def fetch_price_board_dataframe(symbols_list: list[str], anchor_symbol: str, source: str | None = None):
    timeout_seconds = _resolve_timeout('price_board', 8)
    sources = _resolve_price_board_sources(explicit_source=source)
    last_error = None

    for candidate_source in sources:
        stock_client = _build_stock_client(symbol=anchor_symbol, source=candidate_source)
        try:
            result = _run_with_timeout(
                lambda: stock_client.trading.price_board(
                    symbols_list=symbols_list,
                ),
                timeout=timeout_seconds,
            )
            return _normalize_price_board_dataframe(result)
        except ExternalSystemException as exc:
            last_error = exc
            # Fallback to next provider only on explicit rate-limit errors.
            if exc.code == 'vnstock_rate_limited' or is_rate_limited_error(exc):
                logger.warning('price_board source %s rate-limited, fallback to next source', candidate_source)
                continue
            raise

    if last_error is not None:
        raise last_error
    raise ExternalSystemException('vnstock unknown error', code='vnstock_error')


def fetch_financial_ratio_dataframe(
    symbol: str,
    *,
    period: str = 'year',
    lang: str = 'vi',
    dropna: bool = True,
    source: str = 'VCI',
):
    stock_client = _build_stock_client(symbol=symbol, source=source)
    return _run_with_timeout(
        lambda: stock_client.finance.ratio(period=period, lang=lang, dropna=dropna),
        timeout=_resolve_timeout('financial_ratio', 10),
    )


def fetch_history_dataframe(
    symbol: str,
    *,
    start,
    end,
    interval: str = '1D',
    source: str = 'VCI',
):
    stock_client = _build_stock_client(symbol=symbol, source=source)
    return _run_with_timeout(
        lambda: stock_client.quote.history(
            symbol=symbol,
            start=start,
            end=end,
            interval=interval,
        ),
        timeout=_resolve_timeout('history', 12),
    )


def fetch_listing_symbols_dataframe(symbol: str, source: str = 'VCI'):
    stock_client = _build_stock_client(symbol=symbol, source=source)
    return _run_with_timeout(
        lambda: stock_client.listing.all_symbols(),
        timeout=_resolve_timeout('listing', 12),
    )


def read_stream_intraday_ticks(symbol: str, count: int):
    try:
        from portfolio.realtime.stream_reader import StreamReader

        reader = StreamReader()
        return reader.get_intraday_ticks(symbol, count=count) or []
    except (Exception, SystemExit) as exc:
        logger.debug('Stream fallback failed for %s: %s', symbol, exc)
        return []
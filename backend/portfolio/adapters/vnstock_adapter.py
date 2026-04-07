import concurrent.futures as cf
import logging
import os
import threading
import time

from portfolio.exceptions import ExternalSystemException

from .cache_adapter import is_rate_limited_error


logger = logging.getLogger(__name__)


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


# Benchmark thực tế cho thấy ngưỡng ổn định nằm quanh 12 concurrent requests.
_VNSTOCK_MAX_CONCURRENCY = _resolve_int_env('VNSTOCK_MAX_CONCURRENCY', 12, 1)
_VNSTOCK_RETRY_ATTEMPTS = _resolve_int_env('VNSTOCK_RETRY_ATTEMPTS', 1, 0)
_VNSTOCK_RETRY_BACKOFF_SECONDS = _resolve_float_env('VNSTOCK_RETRY_BACKOFF_SECONDS', 0.35, 0.0)
_VNSTOCK_GATE = threading.BoundedSemaphore(value=_VNSTOCK_MAX_CONCURRENCY)


def _resolve_timeout(channel: str, default_timeout: int = 8) -> int:
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


def _run_with_timeout(fn, timeout=8):
    max_attempts = _VNSTOCK_RETRY_ATTEMPTS + 1
    last_error = None

    for attempt in range(max_attempts):
        acquired = _VNSTOCK_GATE.acquire(timeout=max(timeout, 1))
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
            code = 'vnstock_rate_limited' if is_rate_limited_error(exc) else 'vnstock_error'
            last_error = ExternalSystemException(str(exc), code=code)
        finally:
            _VNSTOCK_GATE.release()

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
            time.sleep(_VNSTOCK_RETRY_BACKOFF_SECONDS * (attempt + 1))
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


def fetch_price_board_dataframe(symbols_list: list[str], anchor_symbol: str):
    stock_client = _build_stock_client(symbol=anchor_symbol, source='VCI')

    return _run_with_timeout(
        lambda: stock_client.trading.price_board(
            symbols_list=symbols_list,
        ),
        timeout=_resolve_timeout('price_board', 8),
    )


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
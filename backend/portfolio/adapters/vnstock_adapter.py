import concurrent.futures as cf
import logging
import os

from portfolio.exceptions import ExternalSystemException

from .cache_adapter import is_rate_limited_error


logger = logging.getLogger(__name__)


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
    try:
        with cf.ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(fn)
            try:
                return future.result(timeout=timeout)
            except cf.TimeoutError as exc:
                raise ExternalSystemException(
                    f'vnstock timeout sau {timeout}s',
                    code='vnstock_timeout',
                ) from exc
    except ExternalSystemException:
        raise
    except (Exception, SystemExit) as exc:
        code = 'vnstock_rate_limited' if is_rate_limited_error(exc) else 'vnstock_error'
        raise ExternalSystemException(str(exc), code=code) from exc


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
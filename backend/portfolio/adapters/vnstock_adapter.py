import concurrent.futures as cf
import logging

from portfolio.exceptions import ExternalSystemException

from .cache_adapter import is_rate_limited_error


logger = logging.getLogger(__name__)


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
    try:
        from vnstock import Vnstock
    except ImportError as exc:
        raise ExternalSystemException('vnstock chưa được cài đặt.', code='vnstock_missing') from exc

    return _run_with_timeout(
        lambda: Vnstock().stock(symbol=symbol, source='VCI').quote.intraday(
            symbol=symbol,
            page_size=page_size,
        )
    )


def fetch_price_board_dataframe(symbols_list: list[str], anchor_symbol: str):
    try:
        from vnstock import Vnstock
    except ImportError as exc:
        raise ExternalSystemException('vnstock chưa được cài đặt.', code='vnstock_missing') from exc

    return _run_with_timeout(
        lambda: Vnstock().stock(symbol=anchor_symbol, source='VCI').trading.price_board(
            symbols_list=symbols_list,
        )
    )


def read_stream_intraday_ticks(symbol: str, count: int):
    try:
        from portfolio.realtime.stream_reader import StreamReader

        reader = StreamReader()
        return reader.get_intraday_ticks(symbol, count=count) or []
    except (Exception, SystemExit) as exc:
        logger.debug('Stream fallback failed for %s: %s', symbol, exc)
        return []
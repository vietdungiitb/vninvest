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
    'match': {
        'match_price', 'reference_price', 'ceiling_price', 'floor_price',
        'open_price', 'highest', 'lowest', 'accumulated_volume',
        'foreign_buy_volume', 'foreign_sell_volume',
    },
    'bid_ask': {
        'bid_1_price', 'bid_1_volume', 'bid_2_price', 'bid_2_volume', 'bid_3_price', 'bid_3_volume',
        'ask_1_price', 'ask_1_volume', 'ask_2_price', 'ask_2_volume', 'ask_3_price', 'ask_3_volume',
    },
}

_KBS_FLAT_MAPPING = {
    'symbol': ('listing', 'symbol'),
    'ticker': ('listing', 'symbol'),
    'stock_symbol': ('listing', 'symbol'),
    'code': ('listing', 'symbol'),
    'ref_price': ('listing', 'ref_price'),
    'reference_price': ('match', 'reference_price'),
    'ceiling_price': ('match', 'ceiling_price'),
    'floor_price': ('match', 'floor_price'),
    'match_price': ('match', 'match_price'),
    'last_price': ('match', 'match_price'),
    'price': ('match', 'match_price'),
    'open_price': ('match', 'open_price'),
    'highest': ('match', 'highest'),
    'high_price': ('match', 'highest'),
    'high': ('match', 'highest'),
    'lowest': ('match', 'lowest'),
    'low_price': ('match', 'lowest'),
    'low': ('match', 'lowest'),
    'accumulated_volume': ('match', 'accumulated_volume'),
    'close_price': ('match', 'match_price'),
    'total_volume': ('match', 'accumulated_volume'),
    'volume': ('match', 'accumulated_volume'),
    'foreign_buy_volume': ('match', 'foreign_buy_volume'),
    'foreign_sell_volume': ('match', 'foreign_sell_volume'),
    # Bid/Ask Mapping
    'bid_price_1': ('bid_ask', 'bid_1_price'),
    'bid_vol_1': ('bid_ask', 'bid_1_volume'),
    'bid_price_2': ('bid_ask', 'bid_2_price'),
    'bid_vol_2': ('bid_ask', 'bid_2_volume'),
    'bid_price_3': ('bid_ask', 'bid_3_price'),
    'bid_vol_3': ('bid_ask', 'bid_3_volume'),
    'ask_price_1': ('bid_ask', 'ask_1_price'),
    'ask_vol_1': ('bid_ask', 'ask_1_volume'),
    'ask_price_2': ('bid_ask', 'ask_2_price'),
    'ask_vol_2': ('bid_ask', 'ask_2_volume'),
    'ask_price_3': ('bid_ask', 'ask_3_price'),
    'ask_vol_3': ('bid_ask', 'ask_3_volume'),
}


def _normalize_price_board_column(raw_col):
    key = str(raw_col).strip()
    normalized_key = _KBS_FLAT_MAPPING.get(key.lower())
    if normalized_key:
        return normalized_key
    return ('', key)


def _coerce_price_board_numeric_columns(df: pd.DataFrame) -> pd.DataFrame:
    normalized_df = df.copy()
    for section, field in normalized_df.columns:
        if field in _PRICE_BOARD_FIELDS_BY_SECTION.get(section, set()):
            normalized_df[(section, field)] = pd.to_numeric(normalized_df[(section, field)], errors='coerce')
    return normalized_df


def _price_board_dataframe_is_parseable(price_board_df) -> bool:
    if price_board_df is None or getattr(price_board_df, 'empty', True):
        return False

    if not isinstance(price_board_df, pd.DataFrame):
        return True

    columns = set(price_board_df.columns.tolist())
    symbol_candidates = {
        ('listing', 'symbol'),
        ('symbol', ''),
        ('symbol', 'symbol'),
        'symbol',
        'ticker',
    }
    price_candidates = {
        ('listing', 'ref_price'),
        ('match', 'reference_price'),
        ('match', 'match_price'),
        'ref_price',
        'reference_price',
        'match_price',
        'price',
        'last_price',
    }
    return bool(columns.intersection(symbol_candidates) and columns.intersection(price_candidates))


def _normalize_price_board_dataframe(price_board_df):
    if price_board_df is None or getattr(price_board_df, 'empty', True):
        return price_board_df

    if not isinstance(price_board_df, pd.DataFrame):
        return price_board_df

    columns = price_board_df.columns

    # Case 1: Already MultiIndex (e.g. VCI)
    if isinstance(columns, pd.MultiIndex):
        # Idempotent check: if it has expected sections like 'match' or 'bid_ask', likely canonical
        if any(sec in columns.levels[0] for sec in ('match', 'bid_ask')):
            return _coerce_price_board_numeric_columns(price_board_df)

    # Case 2: Flat DataFrame (e.g. KBS) or unsupported MultiIndex
    # We attempt to reconstruct the Canonical MultiIndex structure
    mapped_rows = []

    for _, source_row in price_board_df.iterrows():
        mapped_row = {}
        for raw_col, value in source_row.to_dict().items():
            mapped_row[_normalize_price_board_column(raw_col)] = value
        if mapped_row:
            mapped_rows.append(mapped_row)

    if mapped_rows:
        mi_df = pd.DataFrame(mapped_rows)
        mi_df.columns = pd.MultiIndex.from_tuples(mi_df.columns)
        return _coerce_price_board_numeric_columns(mi_df)

    return price_board_df


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
    try:
        return vnstock_cls().stock(symbol=symbol, source=source)
    except (Exception, SystemExit) as exc:
        code = 'vnstock_rate_limited' if is_rate_limited_error(exc) else 'vnstock_error'
        raise ExternalSystemException(str(exc), code=code) from exc


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
    last_result = None

    for candidate_source in sources:
        stock_client = _build_stock_client(symbol=anchor_symbol, source=candidate_source)
        try:
            result = _run_with_timeout(
                lambda: stock_client.trading.price_board(
                    symbols_list=symbols_list,
                ),
                timeout=timeout_seconds,
            )
            normalized_result = _normalize_price_board_dataframe(result)
            last_result = normalized_result

            if _price_board_dataframe_is_parseable(normalized_result):
                return normalized_result

            logger.warning(
                'price_board source %s returned unusable payload for %d symbols; trying next source',
                candidate_source,
                len(symbols_list),
            )
            continue
        except ExternalSystemException as exc:
            last_error = exc
            # Fallback to next provider only on explicit rate-limit errors.
            if exc.code == 'vnstock_rate_limited' or is_rate_limited_error(exc):
                logger.warning('price_board source %s rate-limited, fallback to next source', candidate_source)
                continue
            raise

    if last_result is not None:
        return last_result
    if last_error is not None:
        raise last_error
    raise ExternalSystemException('vnstock unknown error', code='vnstock_error')


def fetch_price_depth_dataframe(symbol: str, source: str | None = None):
    """Lấy dữ liệu sổ lệnh chuyên biệt từ Quote.price_depth (nếu hỗ trợ)."""
    timeout_seconds = _resolve_timeout('price_depth', 8)
    # Price depth thường chỉ khả dụng trên VCI hoặc các provider có capability này
    sources = _resolve_price_board_sources(explicit_source=source)
    
    for candidate_source in sources:
        stock_client = _build_stock_client(symbol=symbol, source=candidate_source)
        try:
            # Kiểm tra xem quote api có tồn tại không
            if not hasattr(stock_client, 'quote'):
                continue
                
            result = _run_with_timeout(
                lambda: stock_client.quote.price_depth(symbol=symbol),
                timeout=timeout_seconds,
            )
            # Quote.price_depth thường trả về flat DF với bid/ask levels
            # Chúng ta map nó sang canonical MultiIndex shape để reuse logic
            return _normalize_price_board_dataframe(result)
        except (ExternalSystemException, AttributeError):
            continue
            
    # Fallback về price_board board nếu depth chuyên biệt fail
    return fetch_price_board_dataframe([symbol], anchor_symbol=symbol, source=source)


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
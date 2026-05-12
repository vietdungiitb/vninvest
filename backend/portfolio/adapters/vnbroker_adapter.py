import concurrent.futures as cf
import logging
import os
import threading
import time
from typing import Any

import pandas as pd

from portfolio.exceptions import ExternalSystemException
from portfolio.vnbroker_runtime_config import get_vnbroker_runtime_settings
from portfolio.vnbroker_provider_quality import resolve_provider_order
from portfolio.price_units import (
    normalize_quote_price_to_canonical,
    PriceSource,
    QUOTE_UNIT_CANONICAL,
)

from .cache_adapter import is_rate_limited_error


logger = logging.getLogger(__name__)


_VNBROKER_PROVIDER_CACHE: dict[str, dict[str, Any]] = {}
_VNBROKER_STOCK_CLIENT_CACHE: dict[tuple[str, str], dict[str, Any]] = {}
_VNBROKER_CACHE_LOCK = threading.RLock()


def _now_epoch() -> float:
    return time.time()


def _read_bool_env(name: str, default_value: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default_value
    return str(raw).strip().lower() in {'1', 'true', 'yes', 'on'}


def _provider_cache_enabled() -> bool:
    return _read_bool_env('VNBROKER_PROVIDER_CACHE_ENABLED', True)


def _client_cache_enabled() -> bool:
    return _read_bool_env('VNBROKER_CLIENT_CACHE_ENABLED', True)


def _provider_cache_ttl_seconds() -> int:
    return _resolve_int_env('VNBROKER_PROVIDER_CACHE_TTL_SECONDS', 900, 30)


def _client_cache_ttl_seconds() -> int:
    return _resolve_int_env('VNBROKER_CLIENT_CACHE_TTL_SECONDS', 900, 30)


def _client_cache_maxsize() -> int:
    return _resolve_int_env('VNBROKER_CLIENT_CACHE_MAXSIZE', 512, 16)


def _bootstrap_log_suppress_enabled() -> bool:
    return _read_bool_env('VNBROKER_BOOTSTRAP_LOG_SUPPRESS_ENABLED', True)


def _normalize_source(source: str | None) -> str:
    normalized = str(source or 'VCI').strip().upper()
    return normalized or 'VCI'


def _normalize_symbol(symbol: str | None) -> str:
    normalized = str(symbol or '').strip().upper()
    return normalized


def _evict_vnbroker_cache_locked(now_epoch: float) -> None:
    provider_ttl = _provider_cache_ttl_seconds()
    client_ttl = _client_cache_ttl_seconds()

    for source, entry in list(_VNBROKER_PROVIDER_CACHE.items()):
        created_at = float(entry.get('created_at') or 0.0)
        if now_epoch - created_at > provider_ttl:
            _VNBROKER_PROVIDER_CACHE.pop(source, None)

    for key, entry in list(_VNBROKER_STOCK_CLIENT_CACHE.items()):
        created_at = float(entry.get('created_at') or 0.0)
        if now_epoch - created_at > client_ttl:
            _VNBROKER_STOCK_CLIENT_CACHE.pop(key, None)

    maxsize = _client_cache_maxsize()
    if len(_VNBROKER_STOCK_CLIENT_CACHE) <= maxsize:
        return

    overflow = len(_VNBROKER_STOCK_CLIENT_CACHE) - maxsize
    for cache_key, _entry in sorted(
        _VNBROKER_STOCK_CLIENT_CACHE.items(),
        key=lambda item: float(item[1].get('last_used_at') or 0.0),
    )[:overflow]:
        _VNBROKER_STOCK_CLIENT_CACHE.pop(cache_key, None)


def _get_vnbroker_provider(source: str):
    vnbroker_cls = _import_vnbroker()
    normalized_source = _normalize_source(source)

    if not _provider_cache_enabled():
        return vnbroker_cls()

    now_epoch = _now_epoch()
    with _VNBROKER_CACHE_LOCK:
        _evict_vnbroker_cache_locked(now_epoch)
        cached = _VNBROKER_PROVIDER_CACHE.get(normalized_source)
        if cached is not None:
            cached['last_used_at'] = now_epoch
            return cached['instance']

    provider = vnbroker_cls()
    with _VNBROKER_CACHE_LOCK:
        _VNBROKER_PROVIDER_CACHE[normalized_source] = {
            'instance': provider,
            'created_at': now_epoch,
            'last_used_at': now_epoch,
        }
    return provider


def _get_cached_stock_client(symbol: str, source: str):
    normalized_source = _normalize_source(source)
    normalized_symbol = _normalize_symbol(symbol)

    if not normalized_symbol:
        raise ExternalSystemException('symbol không hợp lệ.', code='vnbroker_error')

    if not _client_cache_enabled():
        provider = _get_vnbroker_provider(normalized_source)
        return provider.stock(symbol=normalized_symbol, source=normalized_source)

    cache_key = (normalized_source, normalized_symbol)
    now_epoch = _now_epoch()

    with _VNBROKER_CACHE_LOCK:
        _evict_vnbroker_cache_locked(now_epoch)
        cached = _VNBROKER_STOCK_CLIENT_CACHE.get(cache_key)
        if cached is not None:
            cached['last_used_at'] = now_epoch
            return cached['instance']

    provider = _get_vnbroker_provider(normalized_source)
    stock_client = provider.stock(symbol=normalized_symbol, source=normalized_source)

    with _VNBROKER_CACHE_LOCK:
        _VNBROKER_STOCK_CLIENT_CACHE[cache_key] = {
            'instance': stock_client,
            'created_at': now_epoch,
            'last_used_at': now_epoch,
        }
    return stock_client


def _invalidate_stock_client_cache(source: str, symbol: str) -> None:
    cache_key = (_normalize_source(source), _normalize_symbol(symbol))
    with _VNBROKER_CACHE_LOCK:
        _VNBROKER_STOCK_CLIENT_CACHE.pop(cache_key, None)


_FUNDAMENTAL_SNAPSHOT_SCHEMA = [
    'symbol',
    'period',
    'report_date',
    'metric',
    'value',
    'unit',
    'source',
    'source_used',
]

_INSIDER_DEALS_SCHEMA = [
    'symbol',
    'announce_date',
    'deal_date',
    'actor_name',
    'actor_type',
    'action',
    'quantity',
    'price',
    'ratio',
    'note',
    'source',
    'source_used',
]


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


def _ensure_quote_prices_canonical_thousand_vnd(df: pd.DataFrame, source_provider: str = 'KBS') -> pd.DataFrame:
    """Ensure all quote price columns in dataframe are canonical THOUSAND_VND.
    
    This is the key function that standardizes price units immediately after normalization.
    All prices from vnbroker come either in VND (KBS) or THOUSAND_VND (VCI),
    so we detect and convert them here to guarantee canonical output.
    
    Args:
        df: MultiIndex DataFrame with structure {(section, field): value}
        source_provider: Source provider name ('KBS' or 'VCI') for detection logic
    
    Returns:
        DataFrame with all quote prices guaranteed in THOUSAND_VND canonical
    
    Side effect:
        Sets df.attrs['price_unit_canonical'] = 'THOUSAND_VND' as contract seal
    """
    if df is None or getattr(df, 'empty', True) or not isinstance(df, pd.DataFrame):
        return df
    
    result_df = df.copy()
    
    # Detect source unit from provider
    # KBS typically returns full VND prices; VCI returns THOUSAND_VND
    source_unit = 'VND' if source_provider.upper() == 'KBS' else 'THOUSAND_VND'
    
    # Price columns that need normalization
    price_columns = [
        ('match', 'match_price'),
        ('match', 'reference_price'),
        ('match', 'open_price'),
        ('match', 'highest'),
        ('match', 'lowest'),
        ('match', 'ceiling_price'),
        ('match', 'floor_price'),
        ('listing', 'ref_price'),
        # Bid/Ask levels
        ('bid_ask', 'bid_1_price'),
        ('bid_ask', 'bid_2_price'),
        ('bid_ask', 'bid_3_price'),
        ('bid_ask', 'ask_1_price'),
        ('bid_ask', 'ask_2_price'),
        ('bid_ask', 'ask_3_price'),
    ]
    
    for col_tuple in price_columns:
        if col_tuple in result_df.columns:
            try:
                # Normalize column to canonical THOUSAND_VND
                result_df[col_tuple] = result_df[col_tuple].apply(
                    lambda x: normalize_quote_price_to_canonical(
                        value=x,
                        source_unit=source_unit,
                        source=PriceSource.VNBROKER_DAILY,
                    ).value if pd.notna(x) else x
                )
            except Exception as exc:
                logger.warning(
                    'Failed to normalize price column %s from %s: %s',
                    col_tuple, source_provider, exc
                )
                # Continue processing other columns; don't fail entire operation
    
    # Seal contract: all prices now guaranteed THOUSAND_VND
    result_df.attrs['price_unit_canonical'] = QUOTE_UNIT_CANONICAL
    result_df.attrs['price_unit_source'] = source_provider
    
    return result_df


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


_VNBROKER_GATE_BY_LIMIT: dict[int, threading.BoundedSemaphore] = {}
_VNBROKER_GATE_LOCK = threading.Lock()


def _get_runtime_settings() -> dict:
    settings_payload = get_vnbroker_runtime_settings()
    if not isinstance(settings_payload, dict):
        settings_payload = {}
    return settings_payload


def _get_gate(limit: int) -> threading.BoundedSemaphore:
    with _VNBROKER_GATE_LOCK:
        gate = _VNBROKER_GATE_BY_LIMIT.get(limit)
        if gate is None:
            gate = threading.BoundedSemaphore(value=limit)
            _VNBROKER_GATE_BY_LIMIT[limit] = gate
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

    env_key = f"VNBROKER_{str(channel or 'general').upper()}_TIMEOUT_SECONDS"
    try:
        timeout_value = int(os.getenv(env_key, default_timeout))
    except (TypeError, ValueError):
        timeout_value = default_timeout
    return max(timeout_value, 1)


def _import_vnbroker():
    try:
        from vnbroker import Vnbroker
        return Vnbroker
    except ImportError as exc:
        raise ExternalSystemException('vnbroker chưa được cài đặt.', code='vnbroker_missing') from exc


def _is_missing_data_key_error(exc: Exception) -> bool:
    return isinstance(exc, KeyError) and str(exc).strip("'") == 'data'


def _log_upstream_payload_warning(*, source: str, symbol: str, operation: str, exc: Exception) -> None:
    if _is_missing_data_key_error(exc):
        logger.warning(
            "vnbroker upstream payload missing key 'data' op=%s source=%s symbol=%s",
            operation,
            source,
            symbol,
        )


def _build_stock_client(symbol: str, source: str = 'VCI'):
    normalized_source = _normalize_source(source)
    normalized_symbol = _normalize_symbol(symbol)
    try:
        return _get_cached_stock_client(symbol=normalized_symbol, source=normalized_source)
    except ExternalSystemException:
        _invalidate_stock_client_cache(normalized_source, normalized_symbol)
        raise
    except (Exception, SystemExit) as exc:
        _invalidate_stock_client_cache(normalized_source, normalized_symbol)
        if isinstance(exc, Exception):
            _log_upstream_payload_warning(
                source=normalized_source,
                symbol=normalized_symbol,
                operation='stock_client_init',
                exc=exc,
            )
            if not _bootstrap_log_suppress_enabled():
                logger.warning(
                    'vnbroker stock_client bootstrap failed source=%s symbol=%s error=%s',
                    normalized_source,
                    normalized_symbol,
                    exc,
                )
        code = 'vnbroker_rate_limited' if is_rate_limited_error(exc) else 'vnbroker_error'
        raise ExternalSystemException(str(exc), code=code) from exc


def _resolve_runtime_sources(
    *,
    explicit_source: str | None = None,
    runtime_primary_key: str | None = 'price_board_source',
    env_primary_key: str | None = None,
    env_fallback_key: str | None = None,
    default_primary: str = 'KBS',
    default_fallbacks: list[str] | None = None,
    supported_sources: set[str] | None = None,
    source_config_channel: str | None = None,
) -> list[str]:
    runtime_settings = _get_runtime_settings()

    source_config = runtime_settings.get('source_config') if isinstance(runtime_settings.get('source_config'), dict) else {}

    configured_primary = ''
    if source_config_channel and isinstance(source_config, dict):
        channel_config = source_config.get(source_config_channel)
        if isinstance(channel_config, dict):
            configured_primary = str(channel_config.get('primary') or '').strip().upper()

    if runtime_primary_key:
        configured_primary = configured_primary or str(runtime_settings.get(runtime_primary_key) or '').strip().upper()
    configured_fallbacks = runtime_settings.get('fallback_sources') if isinstance(runtime_settings.get('fallback_sources'), list) else []
    runtime_fallbacks = [str(item or '').strip().upper() for item in configured_fallbacks if str(item or '').strip()]

    env_primary = ''
    if env_primary_key:
        env_primary = str(os.getenv(env_primary_key, '') or '').strip().upper()

    primary = str(explicit_source or configured_primary or env_primary or default_primary).strip().upper()

    env_fallbacks: list[str] = []
    if env_fallback_key:
        env_fallback_raw = str(os.getenv(env_fallback_key, '') or '').strip()
        env_fallbacks = [item.strip().upper() for item in env_fallback_raw.split(',') if item.strip()]

    ordered: list[str] = []
    for source in [primary] + runtime_fallbacks + env_fallbacks + list(default_fallbacks or []):
        normalized_source = str(source or '').strip().upper()
        if not normalized_source:
            continue
        if supported_sources and normalized_source not in supported_sources:
            continue
        if normalized_source not in ordered:
            ordered.append(normalized_source)

    return ordered or [default_primary]


def _apply_provider_quality_order(channel: str, sources: list[str], explicit_source: str | None = None) -> list[str]:
    if explicit_source:
        return sources

    try:
        ordered_sources = resolve_provider_order(channel, sources)
    except Exception:
        return sources

    return ordered_sources or sources


def _resolve_price_board_sources(explicit_source: str | None = None) -> list[str]:
    sources = _resolve_runtime_sources(
        explicit_source=explicit_source,
        runtime_primary_key='price_board_source',
        env_primary_key='VNBROKER_PRICE_BOARD_SOURCE',
        env_fallback_key='VNBROKER_PRICE_BOARD_FALLBACK_SOURCES',
        default_primary='KBS',
        default_fallbacks=['VCI'],
        source_config_channel='price_board',
    )
    return _apply_provider_quality_order('price_board', sources, explicit_source=explicit_source)


def _resolve_intraday_sources(explicit_source: str | None = None) -> list[str]:
    sources = _resolve_runtime_sources(
        explicit_source=explicit_source,
        runtime_primary_key='price_board_source',
        env_primary_key='VNBROKER_INTRADAY_SOURCE',
        env_fallback_key='VNBROKER_INTRADAY_FALLBACK_SOURCES',
        default_primary='KBS',
        default_fallbacks=['VCI'],
        source_config_channel='intraday',
    )
    return _apply_provider_quality_order('intraday', sources, explicit_source=explicit_source)


def _resolve_history_sources(explicit_source: str | None = None) -> list[str]:
    sources = _resolve_runtime_sources(
        explicit_source=explicit_source,
        runtime_primary_key='price_board_source',
        env_primary_key='VNBROKER_HISTORY_SOURCE',
        env_fallback_key='VNBROKER_HISTORY_FALLBACK_SOURCES',
        default_primary='KBS',
        default_fallbacks=['VCI'],
        source_config_channel='history',
    )
    return _apply_provider_quality_order('history', sources, explicit_source=explicit_source)


def _resolve_listing_sources(explicit_source: str | None = None) -> list[str]:
    sources = _resolve_runtime_sources(
        explicit_source=explicit_source,
        runtime_primary_key='price_board_source',
        env_primary_key='VNBROKER_LISTING_SOURCE',
        env_fallback_key='VNBROKER_LISTING_FALLBACK_SOURCES',
        default_primary='KBS',
        default_fallbacks=['VCI'],
        source_config_channel='listing',
    )
    return _apply_provider_quality_order('listing', sources, explicit_source=explicit_source)


def _resolve_financial_ratio_sources(explicit_source: str | None = None) -> list[str]:
    return _resolve_runtime_sources(
        explicit_source=explicit_source,
        runtime_primary_key=None,
        env_primary_key='VNBROKER_FINANCIAL_RATIO_SOURCE',
        env_fallback_key='VNBROKER_FINANCIAL_RATIO_FALLBACK_SOURCES',
        default_primary='AUTO',
        default_fallbacks=['TCBS', 'VCI', 'KBS'],
        supported_sources={'AUTO', 'TCBS', 'VCI', 'KBS', 'FMP'},
        source_config_channel='financial_ratio',
    )


def _normalize_intraday_dataframe(result, *, source_provider: str) -> pd.DataFrame:
    if result is None or getattr(result, 'empty', True):
        return pd.DataFrame()

    if not isinstance(result, pd.DataFrame):
        try:
            result = pd.DataFrame(result)
        except Exception as exc:
            raise ExternalSystemException(str(exc), code='vnbroker_error') from exc

    normalized_df = result.copy()
    if normalized_df.empty:
        return normalized_df

    if 'time' not in normalized_df.columns:
        if 'tradingDate' in normalized_df.columns:
            normalized_df['time'] = normalized_df['tradingDate']
        elif 'date' in normalized_df.columns:
            normalized_df['time'] = normalized_df['date']
        else:
            normalized_df['time'] = ''

    if 'price' not in normalized_df.columns and 'close' in normalized_df.columns:
        normalized_df['price'] = normalized_df['close']
    if 'volume' not in normalized_df.columns:
        if 'vol' in normalized_df.columns:
            normalized_df['volume'] = normalized_df['vol']
        elif 'matchVolume' in normalized_df.columns:
            normalized_df['volume'] = normalized_df['matchVolume']
        else:
            normalized_df['volume'] = 0

    if 'match_type' not in normalized_df.columns:
        if 'matchType' in normalized_df.columns:
            normalized_df['match_type'] = normalized_df['matchType']
        elif 'side' in normalized_df.columns:
            normalized_df['match_type'] = normalized_df['side']
        else:
            normalized_df['match_type'] = 'UNKNOWN'

    normalized_df['price'] = pd.to_numeric(normalized_df['price'], errors='coerce')
    normalized_df['volume'] = pd.to_numeric(normalized_df['volume'], errors='coerce').fillna(0)

    def _normalize_intraday_price(value):
        if pd.isna(value):
            return value
        source_unit = 'VND' if abs(float(value)) >= 1000 else 'THOUSAND_VND'
        return normalize_quote_price_to_canonical(
            value=value,
            source_unit=source_unit,
            source=PriceSource.INTRADAY_TICK,
        ).value

    normalized_df['price'] = normalized_df['price'].apply(_normalize_intraday_price)
    normalized_df.attrs['price_unit_canonical'] = QUOTE_UNIT_CANONICAL
    normalized_df.attrs['price_unit_source'] = source_provider
    normalized_df.attrs['intraday_source'] = source_provider
    return normalized_df


def _run_with_timeout(fn, timeout=8):
    runtime_settings = _get_runtime_settings()

    retry_attempts = runtime_settings.get('retry_attempts')
    if retry_attempts is None:
        retry_attempts = _resolve_int_env('VNBROKER_RETRY_ATTEMPTS', 1, 0)
    retry_backoff_seconds = runtime_settings.get('retry_backoff_seconds')
    if retry_backoff_seconds is None:
        retry_backoff_seconds = _resolve_float_env('VNBROKER_RETRY_BACKOFF_SECONDS', 0.35, 0.0)

    max_concurrency = runtime_settings.get('max_concurrency')
    if max_concurrency is None:
        max_concurrency = _resolve_int_env('VNBROKER_MAX_CONCURRENCY', 12, 1)
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
                    'vnbroker queue saturated, thử lại sau.',
                    code='vnbroker_busy',
                )
                break

        try:
            with cf.ThreadPoolExecutor(max_workers=1) as executor:
                future = executor.submit(fn)
                return future.result(timeout=timeout)
        except cf.TimeoutError as exc:
            last_error = ExternalSystemException(
                f'vnbroker timeout sau {timeout}s',
                code='vnbroker_timeout',
            )
        except (Exception, SystemExit) as exc:
            is_rate_limited = enable_rate_limit_detection and is_rate_limited_error(exc)
            code = 'vnbroker_rate_limited' if is_rate_limited else 'vnbroker_error'
            last_error = ExternalSystemException(str(exc), code=code)
        finally:
            if gate is not None:
                gate.release()

        should_retry = (
            attempt < max_attempts - 1
            and last_error is not None
            and last_error.code in {'vnbroker_timeout', 'vnbroker_error'}
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
    raise ExternalSystemException('vnbroker unknown error', code='vnbroker_error')


def fetch_price_depth_dataframe(symbol: str, source: str | None = None):
    """Lấy dữ liệu sổ lệnh chuyên biệt từ Quote.price_depth (nếu hỗ trợ).
    
    OUTPUT GUARANTEE: All prices returned in canonical THOUSAND_VND.
    """
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
            normalized = _normalize_price_board_dataframe(result)
            canonical = _ensure_quote_prices_canonical_thousand_vnd(
                normalized,
                source_provider=candidate_source
            )
            return canonical
        except (ExternalSystemException, AttributeError):
            continue
            
    # Fallback về price_board board nếu depth chuyên biệt fail
    return fetch_price_board_dataframe([symbol], anchor_symbol=symbol, source=source)


def fetch_intraday_dataframe(symbol: str, page_size: int):
    """Fetch intraday ticks for symbol.
    
    OUTPUT GUARANTEE: All prices returned in canonical THOUSAND_VND.
    """
    timeout_seconds = _resolve_timeout('intraday', 8)
    sources = _resolve_intraday_sources()
    last_error = None

    for candidate_source in sources:
        try:
            stock_client = _build_stock_client(symbol=symbol, source=candidate_source)
            result = _run_with_timeout(
                lambda: stock_client.quote.intraday(
                    symbol=symbol,
                    page_size=page_size,
                ),
                timeout=timeout_seconds,
            )
            normalized = _normalize_intraday_dataframe(result, source_provider=candidate_source)
            if normalized is None or normalized.empty:
                logger.warning('intraday source %s returned empty payload for %s; trying next source', candidate_source, symbol)
                continue
            return normalized
        except ExternalSystemException as exc:
            last_error = exc
            logger.warning('intraday source %s failed for %s: %s', candidate_source, symbol, exc)
            continue
        except AttributeError as exc:
            last_error = ExternalSystemException(str(exc), code='vnbroker_error')
            logger.warning('intraday source %s missing intraday capability for %s', candidate_source, symbol)
            continue

    if last_error is not None:
        raise last_error
    raise ExternalSystemException('vnbroker unknown error', code='vnbroker_error')


def fetch_price_board_dataframe(symbols_list: list[str], anchor_symbol: str, source: str | None = None):
    """Fetch market quote prices for symbol list.
    
    OUTPUT GUARANTEE: All prices returned in canonical THOUSAND_VND.
    
    This function is the primary ingress point for realtime quote prices.
    It routes through multiple providers (KBS, VCI) with best-effort fallback.
    Critically, it enforces canonical THOUSAND_VND unit on all outputs.
    """
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
            
            # CRITICAL: Ensure all prices are canonical THOUSAND_VND
            # This is the point where we enforce the contract
            canonical_result = _ensure_quote_prices_canonical_thousand_vnd(
                normalized_result,
                source_provider=candidate_source
            )
            last_result = canonical_result

            if _price_board_dataframe_is_parseable(canonical_result):
                return canonical_result

            logger.warning(
                'price_board source %s returned unusable payload for %d symbols; trying next source',
                candidate_source,
                len(symbols_list),
            )
            continue
        except ExternalSystemException as exc:
            last_error = exc
            # Fallback to next provider only on explicit rate-limit errors.
            if exc.code == 'vnbroker_rate_limited' or is_rate_limited_error(exc):
                logger.warning('price_board source %s rate-limited, fallback to next source', candidate_source)
                continue
            raise

    if last_result is not None:
        return last_result
    if last_error is not None:
        raise last_error
    raise ExternalSystemException('vnbroker unknown error', code='vnbroker_error')


def fetch_heatmap_snapshot(symbols_list: list[str]) -> list[dict]:
    """Lấy snapshot heatmap từ vnbroker 1.0.1 APIs (KBS source).

    Trả về list[dict] với các field:
        symbol, market_cap_bn, industry, company_name, current_price, change_pct

    - market_cap_bn: tỷ VND = outstanding_shares × close_price / 1e9
    - industry: tên ngành tiếng Việt (fallback "Khác")

    Chiến lược:
    1. price_board (batch, 1 call) → close_price cho tất cả mã
    2. Listing.symbols_by_industries() (1 call) → industry mapping
    3. Listing.all_symbols() (1 call) → company_name mapping
    4. company.overview() song song (ThreadPoolExecutor) → outstanding_shares

    Trả về [] nếu không lấy được dữ liệu.
    """
    if not symbols_list:
        return []
    try:
        try:
            from vnbroker import Listing
        except ImportError as exc:
            raise ExternalSystemException('vnbroker chưa được cài đặt.', code='vnbroker_missing') from exc

        symbols = [s.strip().upper() for s in symbols_list if s]

        # 1. Batch price_board via KBS
        price_map: dict[str, float] = {}
        try:
            stock_client = _build_stock_client(symbol=symbols[0], source='KBS')
            pb = stock_client.trading.price_board(symbols_list=symbols)
            if isinstance(pb, pd.DataFrame) and not pb.empty:
                for _, row in pb.iterrows():
                    sym = str(row.get('symbol', '') or '').strip().upper()
                    close = float(row.get('close_price', 0) or 0)
                    if sym and close > 0:
                        price_map[sym] = close
        except Exception as exc:
            logger.warning('fetch_heatmap_snapshot: price_board lỗi: %s', exc)

        # 2. Industry mapping via Listing
        industry_map: dict[str, str] = {}
        try:
            ls = Listing()
            ind_df = ls.symbols_by_industries()
            if isinstance(ind_df, pd.DataFrame) and not ind_df.empty:
                for _, row in ind_df.iterrows():
                    sym = str(row.get('symbol', '') or '').strip().upper()
                    ind = str(row.get('industry_name', '') or '').strip()
                    if sym:
                        industry_map[sym] = ind or 'Khác'
        except Exception as exc:
            logger.warning('fetch_heatmap_snapshot: industry_map lỗi: %s', exc)

        # 3. Company name mapping via all_symbols
        name_map: dict[str, str] = {}
        try:
            sym_df = Listing().all_symbols(show_log=False)
            if isinstance(sym_df, pd.DataFrame) and not sym_df.empty:
                for _, row in sym_df.iterrows():
                    sym = str(row.get('symbol', '') or '').strip().upper()
                    name = str(row.get('organ_name', '') or '').strip()
                    if sym:
                        name_map[sym] = name or sym
        except Exception as exc:
            logger.warning('fetch_heatmap_snapshot: name_map lỗi: %s', exc)

        # 4. Per-symbol outstanding_shares via company.overview() (song song, tối đa 5 luồng)
        outstanding_map: dict[str, int] = {}

        def _fetch_outstanding(sym: str) -> tuple[str, int]:
            try:
                ov = _build_stock_client(symbol=sym, source='KBS').company.overview()
                if isinstance(ov, pd.DataFrame) and not ov.empty:
                    val = ov.iloc[0].get('outstanding_shares', 0)
                    shares = int(float(val or 0))
                    return sym, shares
            except Exception as exc:
                logger.debug('fetch_heatmap_snapshot: overview lỗi %s: %s', sym, exc)
            return sym, 0

        with cf.ThreadPoolExecutor(max_workers=5) as executor:
            futures = {executor.submit(_fetch_outstanding, sym): sym for sym in symbols}
            for future in cf.as_completed(futures, timeout=60):
                try:
                    sym, shares = future.result()
                    if shares > 0:
                        outstanding_map[sym] = shares
                except Exception as exc:
                    logger.debug('fetch_heatmap_snapshot: future lỗi: %s', exc)

        # 5. Tổng hợp kết quả
        results = []
        for sym in symbols:
            close_price = price_map.get(sym, 0)
            outstanding = outstanding_map.get(sym, 0)
            market_cap_bn: float | None = None
            if outstanding > 0 and close_price > 0:
                market_cap_bn = round(outstanding * close_price / 1e9, 4)

            results.append({
                'symbol': sym,
                'market_cap_bn': market_cap_bn,
                'industry': industry_map.get(sym, 'Khác'),
                'company_name': name_map.get(sym, sym),
                'current_price': round(close_price / 1000, 4),  # VND → nghìn VND
                'change_pct': 0,
            })

        ok_count = sum(1 for r in results if r['market_cap_bn'] is not None)
        logger.info(
            'fetch_heatmap_snapshot: OK %d mã, %d có market_cap_bn', len(results), ok_count
        )
        return results

    except Exception as exc:
        logger.warning('fetch_heatmap_snapshot failed: %s', exc)
        return []


def fetch_financial_ratio_dataframe(
    symbol: str,
    *,
    period: str = 'year',
    lang: str = 'vi',
    dropna: bool = True,
    source: str | None = None,
):
    timeout_seconds = _resolve_timeout('financial_ratio', 10)
    sources = _resolve_financial_ratio_sources(explicit_source=source)
    last_error = None
    last_result = None

    for candidate_source in sources:
        try:
            stock_client = _build_stock_client(symbol=symbol, source=candidate_source)
            result = _run_with_timeout(
                lambda: stock_client.finance.ratio(period=period, lang=lang, dropna=dropna),
                timeout=timeout_seconds,
            )
            if result is None or getattr(result, 'empty', False):
                logger.warning('financial_ratio source %s returned empty payload for %s; trying next source', candidate_source, symbol)
                continue

            if hasattr(result, 'attrs') and isinstance(result.attrs, dict):
                result.attrs['financial_ratio_source'] = candidate_source
            last_result = result
            return result
        except ExternalSystemException as exc:
            last_error = exc
            logger.warning('financial_ratio source %s failed for %s: %s', candidate_source, symbol, exc)
            continue
        except AttributeError as exc:
            last_error = ExternalSystemException(str(exc), code='vnbroker_error')
            logger.warning('financial_ratio source %s missing finance ratio capability for %s', candidate_source, symbol)
            continue

    if last_result is not None:
        return last_result
    if last_error is not None:
        raise last_error
    raise ExternalSystemException('vnbroker unknown error', code='vnbroker_error')


def _to_dataframe(result: Any) -> pd.DataFrame:
    if isinstance(result, pd.DataFrame):
        return result.copy()
    if result is None:
        return pd.DataFrame()
    try:
        return pd.DataFrame(result)
    except Exception:
        return pd.DataFrame()


def _empty_schema_df(columns: list[str]) -> pd.DataFrame:
    return pd.DataFrame(columns=columns)


def _series_from_col(frame: pd.DataFrame, column: str, default_value: Any = '') -> pd.Series:
    if column in frame.columns:
        return frame[column]
    return pd.Series([default_value] * len(frame), index=frame.index)


def _normalize_period(period: str | None) -> str:
    normalized = str(period or 'quarter').strip().lower()
    if normalized == 'annual':
        return 'year'
    if normalized not in {'quarter', 'year'}:
        return 'quarter'
    return normalized


def _coerce_fundamental_snapshot_df(
    result: Any,
    *,
    symbol: str,
    period: str,
    source_used: str,
) -> pd.DataFrame:
    frame = _to_dataframe(result)
    if frame.empty:
        return _empty_schema_df(_FUNDAMENTAL_SNAPSHOT_SCHEMA)

    rename_map = {
        'indicator': 'metric',
        'ratio': 'metric',
        'ratio_name': 'metric',
        'name': 'metric',
        'item': 'metric',
        'date': 'report_date',
        'period_name': 'period',
        'report_period': 'period',
    }
    frame = frame.rename(columns=rename_map)

    normalized_period = _normalize_period(period)
    frame['symbol'] = _series_from_col(frame, 'symbol', symbol).fillna(symbol).astype(str).str.upper()
    frame['period'] = _series_from_col(frame, 'period', normalized_period).fillna(normalized_period).astype(str).str.lower()
    frame['report_date'] = _series_from_col(frame, 'report_date', '').fillna('').astype(str)
    frame['metric'] = _series_from_col(frame, 'metric', '').fillna('').astype(str)
    frame['value'] = pd.to_numeric(_series_from_col(frame, 'value', None), errors='coerce')
    frame['unit'] = _series_from_col(frame, 'unit', '').fillna('').astype(str)
    frame['source'] = _series_from_col(frame, 'source', 'vnbroker').fillna('vnbroker').astype(str)
    frame['source_used'] = _series_from_col(frame, 'source_used', source_used).fillna(source_used).astype(str)

    return frame[_FUNDAMENTAL_SNAPSHOT_SCHEMA]


def _coerce_insider_deals_df(
    result: Any,
    *,
    symbol: str,
    source_used: str,
) -> pd.DataFrame:
    frame = _to_dataframe(result)
    if frame.empty:
        return _empty_schema_df(_INSIDER_DEALS_SCHEMA)

    rename_map = {
        'announcement_date': 'announce_date',
        'announced_date': 'announce_date',
        'trading_date': 'deal_date',
        'insider_name': 'actor_name',
        'name': 'actor_name',
        'side': 'action',
        'qty': 'quantity',
        'deal_price': 'price',
        'ownership_ratio': 'ratio',
        'remark': 'note',
    }
    frame = frame.rename(columns=rename_map)

    frame['symbol'] = _series_from_col(frame, 'symbol', symbol).fillna(symbol).astype(str).str.upper()
    frame['announce_date'] = _series_from_col(frame, 'announce_date', '').fillna('').astype(str)
    frame['deal_date'] = _series_from_col(frame, 'deal_date', '').fillna('').astype(str)
    frame['actor_name'] = _series_from_col(frame, 'actor_name', '').fillna('').astype(str)
    frame['actor_type'] = _series_from_col(frame, 'actor_type', '').fillna('').astype(str)
    frame['action'] = _series_from_col(frame, 'action', '').fillna('').astype(str).str.upper()
    frame['quantity'] = pd.to_numeric(_series_from_col(frame, 'quantity', None), errors='coerce')
    frame['price'] = pd.to_numeric(_series_from_col(frame, 'price', None), errors='coerce')
    frame['ratio'] = pd.to_numeric(_series_from_col(frame, 'ratio', None), errors='coerce')
    frame['note'] = _series_from_col(frame, 'note', '').fillna('').astype(str)
    frame['source'] = _series_from_col(frame, 'source', 'vnbroker').fillna('vnbroker').astype(str)
    frame['source_used'] = _series_from_col(frame, 'source_used', source_used).fillna(source_used).astype(str)

    return frame[_INSIDER_DEALS_SCHEMA]


def _attach_common_source_columns(result: Any, source_used: str) -> pd.DataFrame:
    frame = _to_dataframe(result)
    if frame.empty:
        frame = pd.DataFrame()
    frame['source'] = _series_from_col(frame, 'source', 'vnbroker').fillna('vnbroker').astype(str)
    frame['source_used'] = _series_from_col(frame, 'source_used', source_used).fillna(source_used).astype(str)
    return frame


def fetch_fundamental_snapshot_dataframe(
    symbol: str,
    *,
    metrics: list[str] | None = None,
    period: str = 'quarter',
    source: str | None = None,
) -> pd.DataFrame:
    """Fetch standardized fundamental snapshot from vnbroker core finance API.

    Always returns a DataFrame with canonical long-table schema.
    """
    timeout_seconds = _resolve_timeout('financial_ratio', 10)
    sources = _resolve_financial_ratio_sources(explicit_source=source)
    normalized_symbol = str(symbol or '').strip().upper()
    normalized_period = _normalize_period(period)
    last_error = None

    for candidate_source in sources:
        try:
            stock_client = _build_stock_client(symbol=normalized_symbol, source=candidate_source)
            result = _run_with_timeout(
                lambda: stock_client.finance.fundamental_snapshot(
                    symbol=normalized_symbol,
                    metrics=metrics,
                    period=normalized_period,
                ),
                timeout=timeout_seconds,
            )
            return _coerce_fundamental_snapshot_df(
                result,
                symbol=normalized_symbol,
                period=normalized_period,
                source_used=candidate_source,
            )
        except ExternalSystemException as exc:
            last_error = exc
            logger.warning('fundamental_snapshot source %s failed for %s: %s', candidate_source, normalized_symbol, exc)
            continue
        except AttributeError as exc:
            # Backward-compat fallback for older vnbroker variants.
            last_error = ExternalSystemException(str(exc), code='vnbroker_error')
            logger.warning('fundamental_snapshot not available on source %s for %s', candidate_source, normalized_symbol)
            continue

    if last_error is not None:
        logger.warning('fundamental_snapshot fallback to empty schema for %s due to: %s', normalized_symbol, last_error)
    return _empty_schema_df(_FUNDAMENTAL_SNAPSHOT_SCHEMA)


def fetch_insider_deals_dataframe(
    symbol: str,
    *,
    page: int = 1,
    page_size: int | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    actor_type: str | None = None,
    standardize: bool = True,
    source: str | None = None,
) -> pd.DataFrame:
    """Fetch insider deals with standardized schema when standardize=True."""
    timeout_seconds = _resolve_timeout('listing', 12)
    sources = _resolve_financial_ratio_sources(explicit_source=source)
    normalized_symbol = str(symbol or '').strip().upper()
    last_error = None

    for candidate_source in sources:
        try:
            stock_client = _build_stock_client(symbol=normalized_symbol, source=candidate_source)
            result = _run_with_timeout(
                lambda: stock_client.company.insider_deals(
                    page=page,
                    page_size=page_size,
                    start_date=start_date,
                    end_date=end_date,
                    actor_type=actor_type,
                    standardize=standardize,
                ),
                timeout=timeout_seconds,
            )
            if standardize:
                return _coerce_insider_deals_df(result, symbol=normalized_symbol, source_used=candidate_source)
            return _attach_common_source_columns(result, source_used=candidate_source)
        except ExternalSystemException as exc:
            last_error = exc
            logger.warning('insider_deals source %s failed for %s: %s', candidate_source, normalized_symbol, exc)
            continue
        except AttributeError as exc:
            last_error = ExternalSystemException(str(exc), code='vnbroker_error')
            logger.warning('insider_deals not available on source %s for %s', candidate_source, normalized_symbol)
            continue

    if last_error is not None:
        logger.warning('insider_deals fallback to empty schema for %s due to: %s', normalized_symbol, last_error)
    return _empty_schema_df(_INSIDER_DEALS_SCHEMA) if standardize else pd.DataFrame()


def fetch_industry_peers_dataframe(
    symbol: str,
    *,
    level: int = 4,
    include_exchanges: list[str] | None = None,
    max_peers: int = 100,
    source: str | None = None,
) -> pd.DataFrame:
    timeout_seconds = _resolve_timeout('financial_ratio', 10)
    sources = _resolve_financial_ratio_sources(explicit_source=source)
    normalized_symbol = str(symbol or '').strip().upper()
    last_error = None

    for candidate_source in sources:
        try:
            stock_client = _build_stock_client(symbol=normalized_symbol, source=candidate_source)
            result = _run_with_timeout(
                lambda: stock_client.finance.industry_peers(
                    symbol=normalized_symbol,
                    level=level,
                    include_exchanges=include_exchanges,
                    max_peers=max_peers,
                ),
                timeout=timeout_seconds,
            )
            frame = _attach_common_source_columns(result, source_used=candidate_source)
            if 'symbol' not in frame.columns:
                frame['symbol'] = normalized_symbol
            return frame
        except ExternalSystemException as exc:
            last_error = exc
            logger.warning('industry_peers source %s failed for %s: %s', candidate_source, normalized_symbol, exc)
            continue
        except AttributeError as exc:
            last_error = ExternalSystemException(str(exc), code='vnbroker_error')
            logger.warning('industry_peers not available on source %s for %s', candidate_source, normalized_symbol)
            continue

    if last_error is not None:
        logger.warning('industry_peers fallback to empty DataFrame for %s due to: %s', normalized_symbol, last_error)
    return pd.DataFrame()


def fetch_industry_benchmark_dataframe(
    symbol: str,
    *,
    metrics: list[str] | None = None,
    period: str = 'quarter',
    method: str = 'median',
    source: str | None = None,
) -> pd.DataFrame:
    timeout_seconds = _resolve_timeout('financial_ratio', 10)
    sources = _resolve_financial_ratio_sources(explicit_source=source)
    normalized_symbol = str(symbol or '').strip().upper()
    normalized_period = _normalize_period(period)
    last_error = None

    for candidate_source in sources:
        try:
            stock_client = _build_stock_client(symbol=normalized_symbol, source=candidate_source)
            result = _run_with_timeout(
                lambda: stock_client.finance.industry_benchmark(
                    symbol=normalized_symbol,
                    metrics=metrics,
                    period=normalized_period,
                    method=method,
                ),
                timeout=timeout_seconds,
            )
            frame = _attach_common_source_columns(result, source_used=candidate_source)
            if 'symbol' not in frame.columns:
                frame['symbol'] = normalized_symbol
            if 'period' not in frame.columns:
                frame['period'] = normalized_period
            return frame
        except ExternalSystemException as exc:
            last_error = exc
            logger.warning('industry_benchmark source %s failed for %s: %s', candidate_source, normalized_symbol, exc)
            continue
        except AttributeError as exc:
            last_error = ExternalSystemException(str(exc), code='vnbroker_error')
            logger.warning('industry_benchmark not available on source %s for %s', candidate_source, normalized_symbol)
            continue

    if last_error is not None:
        logger.warning('industry_benchmark fallback to empty DataFrame for %s due to: %s', normalized_symbol, last_error)
    return pd.DataFrame()


def fetch_industry_rank_dataframe(
    symbol: str,
    *,
    metric: str = 'roe',
    period: str = 'quarter',
    method: str = 'percentile',
    source: str | None = None,
) -> pd.DataFrame:
    timeout_seconds = _resolve_timeout('financial_ratio', 10)
    sources = _resolve_financial_ratio_sources(explicit_source=source)
    normalized_symbol = str(symbol or '').strip().upper()
    normalized_period = _normalize_period(period)
    last_error = None

    for candidate_source in sources:
        try:
            stock_client = _build_stock_client(symbol=normalized_symbol, source=candidate_source)
            result = _run_with_timeout(
                lambda: stock_client.finance.industry_rank(
                    symbol=normalized_symbol,
                    metric=metric,
                    period=normalized_period,
                    method=method,
                ),
                timeout=timeout_seconds,
            )
            frame = _attach_common_source_columns(result, source_used=candidate_source)
            if 'symbol' not in frame.columns:
                frame['symbol'] = normalized_symbol
            if 'period' not in frame.columns:
                frame['period'] = normalized_period
            if 'metric' not in frame.columns:
                frame['metric'] = metric
            return frame
        except ExternalSystemException as exc:
            last_error = exc
            logger.warning('industry_rank source %s failed for %s: %s', candidate_source, normalized_symbol, exc)
            continue
        except AttributeError as exc:
            last_error = ExternalSystemException(str(exc), code='vnbroker_error')
            logger.warning('industry_rank not available on source %s for %s', candidate_source, normalized_symbol)
            continue

    if last_error is not None:
        logger.warning('industry_rank fallback to empty DataFrame for %s due to: %s', normalized_symbol, last_error)
    return pd.DataFrame()


def fetch_history_dataframe(
    symbol: str,
    *,
    start,
    end,
    interval: str = '1D',
    source: str | None = None,
):
    timeout_seconds = _resolve_timeout('history', 12)
    sources = _resolve_history_sources(explicit_source=source)
    last_error = None

    for candidate_source in sources:
        try:
            stock_client = _build_stock_client(symbol=symbol, source=candidate_source)
            return _run_with_timeout(
                lambda: stock_client.quote.history(
                    symbol=symbol,
                    start=start,
                    end=end,
                    interval=interval,
                ),
                timeout=timeout_seconds,
            )
        except ExternalSystemException as exc:
            last_error = exc
            logger.warning('history source %s failed for %s: %s', candidate_source, symbol, exc)
            continue

    if last_error is not None:
        raise last_error
    raise ExternalSystemException('vnbroker unknown error', code='vnbroker_error')


def fetch_listing_symbols_dataframe(symbol: str, source: str | None = None):
    timeout_seconds = _resolve_timeout('listing', 12)
    sources = _resolve_listing_sources(explicit_source=source)
    last_error = None

    for candidate_source in sources:
        try:
            stock_client = _build_stock_client(symbol=symbol, source=candidate_source)
            return _run_with_timeout(
                lambda: stock_client.listing.all_symbols(),
                timeout=timeout_seconds,
            )
        except ExternalSystemException as exc:
            last_error = exc
            logger.warning('listing source %s failed for %s: %s', candidate_source, symbol, exc)
            continue

    if last_error is not None:
        raise last_error
    raise ExternalSystemException('vnbroker unknown error', code='vnbroker_error')


def fetch_symbols_by_industries_dataframe(anchor_symbol: str = 'ACB', source: str | None = None):
    timeout_seconds = _resolve_timeout('listing', 12)
    sources = _resolve_listing_sources(explicit_source=source)
    normalized_symbol = str(anchor_symbol or 'ACB').strip().upper() or 'ACB'
    last_error = None

    for candidate_source in sources:
        try:
            stock_client = _build_stock_client(symbol=normalized_symbol, source=candidate_source)
            result = _run_with_timeout(
                lambda: stock_client.listing.symbols_by_industries(),
                timeout=timeout_seconds,
            )
            frame = _to_dataframe(result)
            if not frame.empty:
                return frame
        except ExternalSystemException as exc:
            last_error = exc
            logger.warning('symbols_by_industries source %s failed for %s: %s', candidate_source, normalized_symbol, exc)
            continue
        except AttributeError as exc:
            last_error = ExternalSystemException(str(exc), code='vnbroker_error')
            logger.warning('symbols_by_industries missing capability on source %s for %s', candidate_source, normalized_symbol)
            continue

    if last_error is not None:
        raise last_error
    return pd.DataFrame()


def fetch_symbols_by_group_series(group_code: str, anchor_symbol: str = 'ACB', source: str | None = None) -> pd.Series:
    timeout_seconds = _resolve_timeout('listing', 12)
    sources = _resolve_listing_sources(explicit_source=source)
    normalized_symbol = str(anchor_symbol or 'ACB').strip().upper() or 'ACB'
    normalized_group_code = str(group_code or '').strip().upper()
    last_error = None

    for candidate_source in sources:
        try:
            stock_client = _build_stock_client(symbol=normalized_symbol, source=candidate_source)
            result = _run_with_timeout(
                lambda: stock_client.listing.symbols_by_group(normalized_group_code),
                timeout=timeout_seconds,
            )
            if isinstance(result, pd.Series):
                return result.copy()
            frame = _to_dataframe(result)
            if 'symbol' in frame.columns:
                return frame['symbol'].astype(str)
            if not frame.empty:
                first_col = frame.columns[0]
                return frame[first_col].astype(str)
        except ExternalSystemException as exc:
            last_error = exc
            logger.warning('symbols_by_group source %s failed for %s/%s: %s', candidate_source, normalized_symbol, normalized_group_code, exc)
            continue
        except AttributeError as exc:
            last_error = ExternalSystemException(str(exc), code='vnbroker_error')
            logger.warning('symbols_by_group missing capability on source %s for %s', candidate_source, normalized_symbol)
            continue

    if last_error is not None:
        raise last_error
    return pd.Series(dtype='object')


def fetch_symbols_by_exchange_dataframe(anchor_symbol: str = 'ACB', source: str | None = None):
    timeout_seconds = _resolve_timeout('listing', 12)
    sources = _resolve_listing_sources(explicit_source=source)
    normalized_symbol = str(anchor_symbol or 'ACB').strip().upper() or 'ACB'
    last_error = None

    for candidate_source in sources:
        try:
            stock_client = _build_stock_client(symbol=normalized_symbol, source=candidate_source)
            result = _run_with_timeout(
                lambda: stock_client.listing.symbols_by_exchange(),
                timeout=timeout_seconds,
            )
            frame = _to_dataframe(result)
            if not frame.empty:
                return frame
        except ExternalSystemException as exc:
            last_error = exc
            logger.warning('symbols_by_exchange source %s failed for %s: %s', candidate_source, normalized_symbol, exc)
            continue
        except AttributeError as exc:
            last_error = ExternalSystemException(str(exc), code='vnbroker_error')
            logger.warning('symbols_by_exchange missing capability on source %s for %s', candidate_source, normalized_symbol)
            continue

    if last_error is not None:
        raise last_error
    return pd.DataFrame()


def read_stream_intraday_ticks(symbol: str, count: int):
    try:
        from portfolio.realtime.stream_reader import StreamReader

        reader = StreamReader()
        return reader.get_intraday_ticks(symbol, count=count) or []
    except (Exception, SystemExit) as exc:
        logger.debug('Stream fallback failed for %s: %s', symbol, exc)
        return []

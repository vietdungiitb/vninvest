import logging
import time
import random
import json
from datetime import date as dt_date
from datetime import timedelta
from datetime import timezone as _dt_timezone
from importlib import import_module
from typing import Any, Optional

import pandas as pd
import httpx
from django.core.cache import cache
from django.conf import settings
from django.db.utils import ProgrammingError, OperationalError
from django.utils import timezone
from django.utils.timezone import now
from .models import VnbrokerRuntimeConfig

logger = logging.getLogger(__name__)

_SUPPORTED_PROVIDER_SOURCES = ('VCI', 'KBS', 'DNSE')
_DAILY_HISTORY_ALLOWED_SOURCES = ('VCI', 'KBS')
_DAILY_HISTORY_FALLBACK_SOURCE = 'VCI'
_DAILY_HISTORY_DISABLED_WARN_CODE = 'DNSE_DAILY_OHLCV_DISABLED'

class VnbrokerAdapterError(Exception):
    """Base error for vnbroker adapter."""
    pass


class DnseRateLimitError(VnbrokerAdapterError):
    """DNSE API trả về Rate Limit Exceeded — caller nên retry sau delay."""
    pass


class _RateLimitWatcher(logging.Handler):
    """Intercepts vnbroker WARNING logs chứa 'rate limit' — used inside fetch_intraday_tape_history."""

    def __init__(self) -> None:
        super().__init__(level=logging.WARNING)
        self.triggered = False

    def emit(self, record: logging.LogRecord) -> None:
        if 'rate limit' in record.getMessage().lower():
            self.triggered = True


_INTRADAY_FALLBACK_SOURCES = _SUPPORTED_PROVIDER_SOURCES
_LISTING_GROUP_ALIASES = {
    'vn30': 'VN30',
    'vn50': 'VN50',
    'vn100': 'VN100',
    'top100': 'VN100',
    'hose': 'HOSE',
    'hnx': 'HNX',
    'upcom': 'UPCOM',
}
# Exchange-based groups resolved by filtering listing rows on exchange field
_EXCHANGE_BASED_GROUPS = frozenset({'hose', 'hnx', 'upcom'})
_LISTING_SEED_DATA = [
    ('ACB', 'HOSE', 'ACB', 'Ngân hàng'), ('BCM', 'HOSE', 'Becamex', 'Bất động sản'),
    ('BID', 'HOSE', 'BIDV', 'Ngân hàng'), ('BMP', 'HOSE', 'Nhựa Bình Minh', 'Thép & Vật liệu'),
    ('CEO', 'HNX', 'CEO Group', 'Bất động sản'), ('CMG', 'HOSE', 'CMC Corp', 'Công nghệ thông tin'),
    ('CTG', 'HOSE', 'Vietinbank', 'Ngân hàng'), ('DGC', 'HOSE', 'Hóa chất Đức Giang', 'Thép & Vật liệu'),
    ('DIG', 'HOSE', 'DIC Corp', 'Bất động sản'), ('DXG', 'HOSE', 'Đất Xanh', 'Bất động sản'),
    ('EIB', 'HOSE', 'Eximbank', 'Ngân hàng'), ('ELC', 'HOSE', 'Elcom', 'Công nghệ thông tin'),
    ('FPT', 'HOSE', 'FPT Corp', 'Công nghệ thông tin'), ('GAS', 'HOSE', 'PV Gas', 'Dầu khí'),
    ('GVR', 'HOSE', 'GVR', 'Bất động sản'), ('HDB', 'HOSE', 'HDBank', 'Ngân hàng'),
    ('HPG', 'HOSE', 'Hòa Phát', 'Thép & Vật liệu'), ('HSG', 'HOSE', 'Hoa Sen', 'Thép & Vật liệu'),
    ('KBC', 'HOSE', 'Kinh Bắc', 'Bất động sản'), ('KDH', 'HOSE', 'Khang Điền', 'Bất động sản'),
    ('LPB', 'HOSE', 'LPBank', 'Ngân hàng'), ('MBB', 'HOSE', 'MB Bank', 'Ngân hàng'),
    ('MSB', 'HOSE', 'MSB', 'Ngân hàng'), ('MSN', 'HOSE', 'Masan', 'Bán lẻ & Tiêu dùng'),
    ('MWG', 'HOSE', 'Thế Giới Di Động', 'Bán lẻ & Tiêu dùng'), ('NKG', 'HOSE', 'Nam Kim', 'Thép & Vật liệu'),
    ('NLG', 'HOSE', 'Nam Long', 'Bất động sản'), ('NVL', 'HOSE', 'Novaland', 'Bất động sản'),
    ('OCB', 'HOSE', 'OCB', 'Ngân hàng'), ('OIL', 'UPCOM', 'PV Oil', 'Dầu khí'),
    ('PDR', 'HOSE', 'Phát Đạt', 'Bất động sản'), ('PLX', 'HOSE', 'Petrolimex', 'Dầu khí'),
    ('PNJ', 'HOSE', 'PNJ', 'Bán lẻ & Tiêu dùng'), ('PVD', 'HOSE', 'PV Drilling', 'Dầu khí'),
    ('PVS', 'HNX', 'PV Services', 'Dầu khí'), ('PVT', 'HOSE', 'PV Trans', 'Dầu khí'),
    ('SAB', 'HOSE', 'Sabeco', 'Bán lẻ & Tiêu dùng'), ('SAM', 'HOSE', 'SAM Holdings', 'Công nghệ thông tin'),
    ('SHB', 'HOSE', 'SHB', 'Ngân hàng'), ('SJS', 'HOSE', 'SUDICO', 'Bất động sản'),
    ('SSB', 'HOSE', 'SeABank', 'Ngân hàng'), ('SSI', 'HOSE', 'Chứng khoán SSI', 'Dịch vụ tài chính'),
    ('STB', 'HOSE', 'Sacombank', 'Ngân hàng'), ('TCB', 'HOSE', 'Techcombank', 'Ngân hàng'),
    ('TDH', 'HOSE', 'Thuduc House', 'Bất động sản'), ('TLH', 'HOSE', 'Thép Tiến Lên', 'Thép & Vật liệu'),
    ('TPB', 'HOSE', 'TPBank', 'Ngân hàng'), ('VCB', 'HOSE', 'Vietcombank', 'Ngân hàng'),
    ('VGC', 'HOSE', 'Viglacera', 'Thép & Vật liệu'), ('VGI', 'UPCOM', 'Viettel Global', 'Công nghệ thông tin'),
    ('VHM', 'HOSE', 'Vinhomes', 'Bất động sản'), ('VIB', 'HOSE', 'VIB', 'Ngân hàng'),
    ('VIC', 'HOSE', 'Vingroup', 'Bất động sản'), ('VIS', 'HOSE', 'Thép Việt Ý', 'Thép & Vật liệu'),
    ('VJC', 'HOSE', 'Vietjet', 'Dịch vụ tài chính'), ('VNM', 'HOSE', 'Vinamilk', 'Bán lẻ & Tiêu dùng'),
    ('VND', 'HOSE', 'Chứng khoán VNDirect', 'Dịch vụ tài chính'), ('VPB', 'HOSE', 'VPBank', 'Ngân hàng'),
    ('VPL', 'HOSE', 'Vinpearl', 'Bất động sản'), ('VRE', 'HOSE', 'Vincom Retail', 'Bất động sản'),
]


def _build_intraday_source_candidates(preferred_source: str | None) -> list[str]:
    candidates: list[str] = []
    normalized_preferred_source = _normalize_supported_source(preferred_source, fallback_to_config=False)
    for source in [normalized_preferred_source, *_INTRADAY_FALLBACK_SOURCES]:
        source_code = str(source or '').strip().upper()
        if source_code and source_code not in candidates:
            candidates.append(source_code)
    return candidates


def _normalize_intraday_trade_rows(frame: pd.DataFrame, symbol_upper: str) -> list[dict[str, Any]]:
    if frame is None or frame.empty:
        return []

    normalized_rows: list[dict[str, Any]] = []
    ordered_frame = frame.copy()
    if 'time' in ordered_frame.columns:
        ordered_frame = ordered_frame.sort_values('time')

    for row in ordered_frame.to_dict('records'):
        timestamp_value = row.get('time') or row.get('timestamp') or row.get('datetime')
        timestamp = pd.to_datetime(timestamp_value, errors='coerce')
        if pd.isna(timestamp):
            continue

        match_type = str(row.get('match_type') or row.get('side') or '').strip().lower()
        if match_type.startswith('buy'):
            side = 'buy'
        elif match_type.startswith('sell'):
            side = 'sell'
        else:
            side = 'unknown'

        normalized_rows.append({
            'timestamp': timestamp.isoformat(),
            'time': timestamp.strftime('%H:%M:%S'),
            'price': float(row.get('price') or 0),
            'volume': int(row.get('volume') or 0),
            'side': side,
            'match_type': row.get('match_type') or 'NormalMatch',
        })

    return normalized_rows


def _publish_intraday_stream(symbol_upper: str, trades: list[dict[str, Any]]) -> None:
    if not trades:
        return

    try:
        import redis

        redis_client = redis.from_url(getattr(settings, 'REDIS_URL', 'redis://localhost:6379/1'))
        stream_key = f'vninvest:ticks:{symbol_upper}'
        for trade in trades:
            redis_client.xadd(stream_key, {
                'symbol': symbol_upper,
                'timestamp': trade['timestamp'],
                'time': trade['time'],
                'price': str(trade['price']),
                'volume': str(trade['volume']),
                'side': trade['side'],
                'match_type': trade['match_type'],
            }, maxlen=500, approximate=True)
    except Exception as exc:
        logger.warning('Failed to publish intraday stream for %s: %s', symbol_upper, exc)


def _fetch_intraday_frame(symbol: str, page_size: int = 50) -> tuple[pd.DataFrame, str | None]:
    from vnbroker import Vnbroker

    symbol_upper = symbol.upper()
    config = get_active_config()
    preferred_source = getattr(config, 'data_source', None)

    last_error: Exception | None = None
    for source in _build_intraday_source_candidates(preferred_source):
        try:
            client = Vnbroker().stock(symbol=symbol_upper, source=source)
            frame = client.quote.intraday(symbol=symbol_upper, page_size=page_size)
            if frame is not None and not frame.empty:
                return frame, source
        except Exception as exc:
            last_error = exc
            logger.warning('Intraday fetch failed for %s via %s: %s', symbol_upper, source, exc)

    if last_error:
        logger.info('Intraday fetch exhausted all sources for %s: %s', symbol_upper, last_error)
    return pd.DataFrame(), None


def warm_up_intraday_symbols(symbols: list[str], page_size: int = 50) -> dict[str, Any]:
    warmed = 0
    sources: list[str] = []

    for symbol in symbols:
        result = fetch_intraday_tape(symbol, page_size=page_size)
        if result.get('trades'):
            warmed += 1
            source = result.get('source')
            if source and source not in sources:
                sources.append(source)

    return {
        'status': 'ok',
        'warmed_up_count': warmed,
        'symbols_count': len(symbols),
        'sources': sources,
    }

def get_active_config() -> VnbrokerRuntimeConfig:
    """Lấy cấu hình đang hoạt động hoặc tạo mặc định."""
    from django.db import transaction
    try:
        with transaction.atomic():
            config = VnbrokerRuntimeConfig.objects.filter(is_active=True).first()
            if not config:
                config, _ = VnbrokerRuntimeConfig.objects.get_or_create(
                    name='Default Config',
                    defaults={
                        'is_active': True,
                        'data_source': VnbrokerRuntimeConfig.SourceChoices.VCI,
                        'max_workers': 4,
                        'batch_size': 50,
                    }
                )
            return config
    except (ProgrammingError, OperationalError):
        # Fallback for early bootstrap when DB migration for runtime config is missing.
        # This keeps ingest pipeline alive in dev and SaaS cutover smoke runs.
        class _FallbackConfig:
            data_source = VnbrokerRuntimeConfig.SourceChoices.VCI
            request_delay_ms = 0

        logger.warning(
            "VnbrokerRuntimeConfig table unavailable; using fallback runtime config."
        )
        return _FallbackConfig()


def _normalize_supported_source(source: str | None, *, fallback_to_config: bool = True) -> str:
    normalized_source = str(source or '').strip().upper()
    if normalized_source in _SUPPORTED_PROVIDER_SOURCES:
        return normalized_source

    if normalized_source:
        logger.warning(
            'Unsupported vnbroker source %s requested on native core path; '
            'falling back to supported provider roster %s.',
            normalized_source,
            ', '.join(_SUPPORTED_PROVIDER_SOURCES),
        )

    if not fallback_to_config:
        return ''

    config = get_active_config()
    configured_source = str(
        getattr(config, 'data_source', VnbrokerRuntimeConfig.SourceChoices.VCI)
        or VnbrokerRuntimeConfig.SourceChoices.VCI
    ).strip().upper()
    if configured_source in _SUPPORTED_PROVIDER_SOURCES:
        return configured_source

    if configured_source:
        logger.warning(
            'Configured runtime source %s is outside the supported provider roster; defaulting to VCI.',
            configured_source,
        )

    return VnbrokerRuntimeConfig.SourceChoices.VCI


def _resolve_realtime_source(source: str | None) -> str:
    return _normalize_supported_source(source, fallback_to_config=True)


def _resolve_daily_history_source(source: str | None) -> str:
    normalized_source = _normalize_supported_source(source, fallback_to_config=True)
    requested_source = str(source or '').strip().upper()

    if normalized_source in _DAILY_HISTORY_ALLOWED_SOURCES:
        return normalized_source

    if normalized_source == 'DNSE':
        if requested_source == 'DNSE':
            logger.warning(
                '[%s] Daily OHLCV provider DNSE is hard-disabled on native core path; '
                'returning empty result.',
                _DAILY_HISTORY_DISABLED_WARN_CODE,
            )
            return ''

        logger.warning(
            '[%s] Daily OHLCV source resolved to DNSE from runtime config; '
            'forcing fallback source %s.',
            _DAILY_HISTORY_DISABLED_WARN_CODE,
            _DAILY_HISTORY_FALLBACK_SOURCE,
        )
        return _DAILY_HISTORY_FALLBACK_SOURCE

    logger.warning(
        '[DAILY_OHLCV_SOURCE_UNSUPPORTED] Daily OHLCV source %s unsupported; '
        'forcing fallback source %s.',
        normalized_source,
        _DAILY_HISTORY_FALLBACK_SOURCE,
    )
    return _DAILY_HISTORY_FALLBACK_SOURCE


def _load_quote_class(source: str):
    normalized_source = str(source or '').strip().upper()
    if not normalized_source:
        raise VnbrokerAdapterError('Realtime source is required.')

    module_name = f'vnbroker.explorer.{normalized_source.lower()}.quote'
    try:
        module = import_module(module_name)
        quote_class = getattr(module, 'Quote')
    except Exception as exc:
        raise VnbrokerAdapterError(
            f'Unsupported realtime source for vnbroker adapter: {normalized_source}'
        ) from exc

    return quote_class


def _load_listing_adapter_class():
    from vnbroker.api.listing import Listing as VnbrokerListing

    return VnbrokerListing


def _build_listing_seed_rows(source: str) -> list[dict[str, Any]]:
    return [
        {
            'symbol': symbol,
            'exchange': exchange,
            'company_name': company_name,
            'industry': industry,
            'source': source,
        }
        for symbol, exchange, company_name, industry in _LISTING_SEED_DATA
    ]


def _extract_listing_records(rows: Any) -> list[Any]:
    if rows is None:
        return []
    if isinstance(rows, pd.DataFrame):
        return rows.to_dict('records')
    if isinstance(rows, pd.Series):
        return rows.tolist()
    if isinstance(rows, tuple):
        return list(rows)
    if isinstance(rows, list):
        return rows
    return list(rows)


def _normalize_listing_rows(rows: Any, source: str) -> list[dict[str, Any]]:
    normalized_rows: list[dict[str, Any]] = []
    seen_symbols: set[str] = set()
    for item in _extract_listing_records(rows):
        if isinstance(item, dict):
            symbol_value = item.get('symbol') or item.get('ticker') or item.get('code') or item.get('stock_code')
            company_name = item.get('company_name') or item.get('organ_name') or item.get('name') or item.get('short_name')
            exchange = item.get('exchange') or item.get('board') or item.get('market') or item.get('exchange_code')
            industry = item.get('industry') or item.get('sector') or item.get('icb_name') or item.get('category')
            
            # Filter out non-stock security types (like warrants cw, bonds, funds) if type is populated
            sec_type = item.get('type') or item.get('security_type')
            if sec_type and str(sec_type).strip().lower() != 'stock':
                continue
        else:
            symbol_value = item
            company_name = None
            exchange = None
            industry = None

        symbol = str(symbol_value or '').strip().upper()
        if not symbol or symbol in seen_symbols:
            continue

        seen_symbols.add(symbol)
        normalized_rows.append({
            'symbol': symbol,
            'exchange': exchange,
            'company_name': company_name,
            'industry': industry,
            'source': source,
        })

    return normalized_rows


def _slice_listing_symbols(symbols: list[str], symbol_group_id: str) -> list[str]:
    group_id = str(symbol_group_id or '').strip().lower()
    if group_id == 'vn30':
        return symbols[:30]
    if group_id == 'vn50':
        return symbols[:50]
    if group_id in {'vn100', 'top100'}:
        return symbols[:100]
    # Exchange-based groups and 'all' return unsliced list
    return symbols


def _fetch_realtime_price_with_quote_class(symbol_upper: str, source: str, quote_class) -> dict[str, Any] | None:
    from datetime import date as dt_date

    today = dt_date.today()
    quote_client = quote_class(symbol=symbol_upper)
    frame = quote_client.history(
        start=today.isoformat(),
        end=today.isoformat(),
        interval='1D',
        show_log=False,
    )
    if frame is None or frame.empty:
        return None

    row = frame.iloc[0]
    return {
        'symbol': symbol_upper,
        'close': float(row['close']),
        'open': float(row.get('open') or row['close']),
        'high': float(row.get('high') or row['close']),
        'low': float(row.get('low') or row['close']),
        'volume': int(row.get('volume') or 0),
        'fetched_at': now().isoformat(),
        'source': source,
    }


def fetch_realtime_price(symbol: str, *, source: str | None = None) -> dict[str, Any] | None:
    """
    Lấy giá realtime (live bar hôm nay) cho một symbol qua provider được chỉ định.
    SSOT cho tất cả live-price reads — không gọi quote class trực tiếp ngoài hàm này.

    Trả về dict với keys: symbol, close, open, high, low, volume, fetched_at, source
    hoặc None nếu vnbroker không trả dữ liệu.
    """
    symbol_upper = symbol.strip().upper()
    normalized_source = _resolve_realtime_source(source)
    try:
        quote_class = _load_quote_class(normalized_source)
        return _fetch_realtime_price_with_quote_class(symbol_upper, normalized_source, quote_class)
    except VnbrokerAdapterError as exc:
        logger.warning(
            'fetch_realtime_price source resolution failed for %s via %s: %s',
            symbol_upper,
            normalized_source,
            exc,
        )
        return None
    except Exception as exc:
        logger.warning('fetch_realtime_price %s failed for %s: %s', normalized_source, symbol_upper, exc)
        return None


def fetch_price_board_snapshots_batch(symbols: list[str], *, source: str | None = None) -> dict[str, dict[str, Any]]:
    """
    Fetch realtime snapshot for a list of symbols in batch using async fetch_multiple.
    Returns a dict mapping symbol -> snapshot dict:
    {
        'FPT': {
            'symbol': 'FPT',
            'close': 74000.0,
            'open': 73600.0,
            'high': 74300.0,
            'low': 73500.0,
            'volume': 2987500,
            'fetched_at': '...',
            'source': '...'
        }
    }
    """
    normalized_source = _resolve_realtime_source(source)
    quote_class = _load_quote_class(normalized_source)
    logger.info('Fetching batch price board snapshot from %s for %d symbols.', normalized_source, len(symbols))

    import asyncio
    from datetime import date as dt_date
    today = dt_date.today()

    cleaned_symbols = sorted({str(sym).strip().upper() for sym in symbols if str(sym).strip()})
    if not cleaned_symbols:
        return {}

    try:
        raw_res = quote_class.fetch_multiple(
            symbols=cleaned_symbols,
            start=today.isoformat(),
            end=today.isoformat(),
            interval='1D',
            show_log=False,
        )
        if asyncio.iscoroutine(raw_res):
            from asgiref.sync import async_to_sync
            async def _wait_coro():
                return await raw_res
            dfs = async_to_sync(_wait_coro)()
        else:
            dfs = raw_res
    except Exception as exc:
        logger.error('fetch_price_board_snapshots_batch failed: %s', exc)
        return {}

    results = {}
    for df in dfs:
        if df is not None and not df.empty:
            symbol = ''
            if hasattr(df, 'attrs') and isinstance(df.attrs, dict):
                symbol = df.attrs.get('symbol') or ''
            if not symbol:
                symbol = getattr(df, 'name', '') or getattr(df, 'symbol', '')
            symbol = str(symbol).strip().upper()
            if not symbol:
                continue
            row = df.iloc[-1]
            results[symbol] = {
                'symbol': symbol,
                'close': float(row['close']),
                'open': float(row.get('open') or row['close']),
                'high': float(row.get('high') or row['close']),
                'low': float(row.get('low') or row['close']),
                'volume': int(row.get('volume') or 0),
                'fetched_at': now().isoformat(),
                'source': normalized_source,
            }
    return results


def fetch_price_board_snapshot(symbols: list[str], *, source: str | None = None) -> list[dict[str, Any]]:
    """
    Lấy snapshot giá realtime cho danh sách symbol qua provider được chỉ định.
    Sử dụng batch fetch để tránh rate limit 429 và tối ưu hiệu năng.
    """
    normalized_source = _resolve_realtime_source(source)
    logger.info('Fetching price board snapshot from %s for %d symbols in batch.', normalized_source, len(symbols))

    snapshots = fetch_price_board_snapshots_batch(symbols, source=normalized_source)
    results = []
    for symbol in symbols:
        sym_upper = symbol.strip().upper()
        live = snapshots.get(sym_upper)
        if live is None:
            logger.debug('fetch_price_board_snapshot: no live data for %s — skipped', symbol)
            continue
        results.append({
            'symbol': live['symbol'],
            'price': live['close'],
            'price_change': 0.0,       # caller (materializer) computes delta vs reference
            'price_change_pct': 0.0,
            'volume': live['volume'],
            'source': live.get('source', normalized_source),
            'fetched_at': live['fetched_at'],
        })

    return results


def fetch_daily_history(
    symbol: str,
    days: int = 365,
    *,
    source: str | None = None,
    start_date: dt_date | None = None,
    end_date: dt_date | None = None,
) -> list[dict[str, Any]]:
    """
    Lấy lịch sử giá ngày (OHLCV) cho một symbol qua provider được chỉ định (có fallback).
    Trả về list dict chuẩn hoá để ghi vào DailyPrice.
    """
    symbol_upper = symbol.strip().upper()
    primary_source = _resolve_daily_history_source(source)
    if not primary_source:
        return []

    # Build fallback candidates list (primary first, then other allowed sources)
    sources_to_try = [primary_source]
    for allowed in _DAILY_HISTORY_ALLOWED_SOURCES:
        if allowed != primary_source and allowed not in sources_to_try:
            sources_to_try.append(allowed)

    normalized_end_date = end_date or timezone.now().date()
    normalized_days = max(int(days or 1), 1)
    normalized_start_date = start_date or (normalized_end_date - timedelta(days=normalized_days))
    if normalized_start_date > normalized_end_date:
        logger.warning(
            'fetch_daily_history ignored for %s due to invalid date range (%s > %s).',
            symbol_upper,
            normalized_start_date,
            normalized_end_date,
        )
        return []

    last_error = None
    for current_source in sources_to_try:
        try:
            quote_class = _load_quote_class(current_source)
            quote_client = quote_class(symbol=symbol_upper)
            df = quote_client.history(
                start=normalized_start_date.isoformat(),
                end=normalized_end_date.isoformat(),
                interval='1D',
                show_log=False,
            )
            
            if df is None or df.empty:
                logger.warning('fetch_daily_history %s returned empty DataFrame for %s (range: %s to %s)',
                               current_source, symbol_upper, normalized_start_date, normalized_end_date)
                continue

            rows: list[dict[str, Any]] = []
            for _, row in df.iterrows():
                try:
                    trade_date = pd.to_datetime(row['time']).date() if not isinstance(row['time'], dt_date) else row['time']
                    rows.append({
                        'symbol': symbol_upper,
                        'date': trade_date,
                        'open': float(row['open']),
                        'high': float(row['high']),
                        'low': float(row['low']),
                        'close': float(row['close']),
                        'volume': int(row['volume']),
                        'source': current_source,
                    })
                except (KeyError, TypeError, ValueError) as exc:
                    logger.debug('Skipping malformed OHLCV row for %s via %s: %s', symbol_upper, current_source, exc)
                    continue

            if rows:
                if current_source != primary_source:
                    logger.info('fetch_daily_history primary source %s failed; fallback to %s succeeded for %s',
                                primary_source, current_source, symbol_upper)
                return rows
        except Exception as exc:
            last_error = exc
            logger.warning('fetch_daily_history %s failed for %s: %s', current_source, symbol_upper, exc)

    if last_error:
        logger.warning('fetch_daily_history exhausted all sources for %s. Last error: %s', symbol_upper, last_error)
    return []


def fetch_listing_symbols(*, source: str | None = None) -> list[dict[str, Any]]:
    """
    Lấy danh sách mã niêm yết từ nguồn dữ liệu.
    Ưu tiên vnbroker Listing adapter theo provider được chỉ định.
    Fallback về seed universe nếu upstream không sẵn sàng.
    """
    normalized_source = _resolve_realtime_source(source)

    logger.info('Fetching listing symbols from %s.', normalized_source)

    try:
        listing_class = _load_listing_adapter_class()
        listing_client = listing_class(source=normalized_source)
        
        # Try fetching symbols via symbols_by_exchange('HOSE') first to get populated exchange/type fields
        try:
            raw_data = listing_client.symbols_by_exchange('HOSE')
        except Exception as exchange_exc:
            logger.info('symbols_by_exchange failed, falling back to all_symbols: %s', exchange_exc)
            raw_data = listing_client.all_symbols()

        # Try fetching industry mapping if available
        ind_map = {}
        try:
            if hasattr(listing_client, 'symbols_by_industries'):
                df_ind = listing_client.symbols_by_industries()
                if df_ind is not None and not df_ind.empty:
                    ind_map = dict(zip(df_ind['symbol'], df_ind['industry_name']))
        except Exception as ind_exc:
            logger.warning('Failed to fetch industry mapping from symbols_by_industries: %s', ind_exc)

        listing_rows = _normalize_listing_rows(raw_data, normalized_source)
        if listing_rows:
            # Inject industry names from the mapping
            for row in listing_rows:
                sym = row['symbol']
                if ind_map.get(sym):
                    row['industry'] = ind_map[sym]
            return listing_rows
    except Exception as exc:
        logger.warning('fetch_listing_symbols %s failed: %s', normalized_source, exc)

    return _build_listing_seed_rows(normalized_source)


# Các group đại diện cho TOÀN BỘ thị trường — chỉ những group này mới được
# fallback trả về toàn bộ universe. Mọi group khác (BOND, ETF, CW, sector...)
# phải lấy danh sách thành viên thực tế, nếu không có thì trả rỗng (không pollute).
_ALL_MARKET_GROUP_IDS = frozenset({'all', 'toan-thi-truong', 'toanbo', 'vnall', 'vnxall'})


def fetch_symbol_group_members(symbol_group_id: str, *, source: str | None = None) -> list[str]:
    normalized_source = _resolve_realtime_source(source)
    group_id = str(symbol_group_id or '').strip().lower()
    if group_id == 'top100':
        group_id = 'vn100'

    # Custom groups: 'custom_<slug>' → query CustomSymbolGroup model
    if group_id.startswith('custom_'):
        slug = group_id[len('custom_'):]
        try:
            from service_ops.models import CustomSymbolGroup  # lazy import to avoid circular dep
            custom_group = CustomSymbolGroup.objects.get(slug=slug, is_active=True)
            symbols = custom_group.clean_symbols()
            if symbols:
                return symbols
        except Exception as exc:
            logger.warning('fetch_symbol_group_members custom group %s failed: %s', slug, exc)
        return []

    # Candidate group names to probe the listing adapter with. Prefer the
    # canonical vnbroker alias, then fall back to the raw id / its uppercase form
    # (vnbroker supports arbitrary group names such as BOND, ETF, CW, FU_INDEX).
    candidate_groups: list[str] = []
    group_alias = _LISTING_GROUP_ALIASES.get(group_id)
    if group_alias:
        candidate_groups.append(group_alias)
    else:
        candidate_groups.extend([group_id, group_id.upper()])

    listing_class = _load_listing_adapter_class()
    for candidate in candidate_groups:
        if not candidate:
            continue
        try:
            logger.info('Fetching symbol group %s from %s.', candidate, normalized_source)
            listing_client = listing_class(source=normalized_source)
            group_symbols = _normalize_listing_rows(
                listing_client.symbols_by_group(group=candidate),
                normalized_source,
            )
            symbols = [row['symbol'] for row in group_symbols if row.get('symbol')]
            if symbols:
                return symbols
        except Exception as exc:
            logger.warning(
                'fetch_symbol_group_members %s via %s failed: %s',
                candidate,
                normalized_source,
                exc,
            )

    logger.info('Falling back to listing universe slice for %s from %s.', group_id, normalized_source)
    listing_rows = fetch_listing_symbols(source=normalized_source)

    # HNX30 slice fallback: only take HNX symbols and limit to 30
    if group_id == 'hnx30':
        hnx_symbols = [
            row['symbol'] for row in listing_rows
            if row.get('symbol') and str(row.get('exchange') or '').upper() == 'HNX'
        ]
        if hnx_symbols:
            return hnx_symbols[:30]

    # Exchange-based groups: filter by exchange field in listing rows
    if group_id in _EXCHANGE_BASED_GROUPS:
        exchange_upper = group_id.upper()
        exchange_symbols = [
            row['symbol'] for row in listing_rows
            if row.get('symbol') and str(row.get('exchange') or '').upper() == exchange_upper
        ]
        if exchange_symbols:
            return exchange_symbols

    # Chỉ group đại diện toàn thị trường mới được trả toàn bộ universe.
    # Các group khác (BOND, ETF, CW, sector...) trả rỗng thay vì pollute 1522 mã.
    if group_id in _ALL_MARKET_GROUP_IDS:
        listing_symbols = [row['symbol'] for row in listing_rows if row.get('symbol')]
        return _slice_listing_symbols(listing_symbols, group_id)

    logger.warning(
        'fetch_symbol_group_members %s returned empty: no real members resolved.',
        group_id,
    )
    return []


def fetch_intraday_ohlcv(symbol: str, timeframe: str = '1H', days: int = 180) -> dict[str, Any]:
    """
    Fetch intraday OHLCV bars from native IntradayBar model.
    Phase 2: Direct DB query (no vnbroker API call yet).
    """
    from .models import IntradayBar
    from datetime import timedelta
    
    symbol_upper = symbol.upper()
    qs = IntradayBar.objects.filter(
        symbol=symbol_upper,
        timeframe=timeframe,
    ).order_by('-datetime')
    
    # Limit to last N days using date range filter
    if days:
        cutoff_date = timezone.now() - timedelta(days=days)
        qs = qs.filter(datetime__gte=cutoff_date)
    
    # Reverse to chronological order
    bars = list(qs.order_by('datetime'))
    
    return {
        'symbol': symbol_upper,
        'timeframe': timeframe,
        'bars': [
            {
                'datetime': bar.datetime.isoformat(),
                'open': float(bar.open),
                'high': float(bar.high),
                'low': float(bar.low),
                'close': float(bar.close),
                'volume': bar.volume,
            }
            for bar in bars
        ]
    }


def fetch_intraday_tape(symbol: str, page_size: int = 50) -> dict[str, Any]:
    """
    Fetch intraday tick trades from Redis cache (5 min TTL) or DB fallback.
    Phase 2: Native storage with caching.
    
    Note: Cache is keyed by symbol only. For different page_sizes,
    the cached result will contain whatever was cached first.
    """
    symbol_upper = symbol.upper()
    cache_key = f'intraday_tape:{symbol_upper}'
    
    # Try Redis cache first
    cached = cache.get(cache_key)
    if cached:
        logger.debug(f"Cache HIT for {cache_key}")
        cached_data = cached if isinstance(cached, dict) else json.loads(cached)
        # If cached data has more items than requested page_size,
        # return the last page_size items (most recent)
        if len(cached_data['trades']) > page_size:
            cached_data['trades'] = cached_data['trades'][-page_size:]
        return cached_data
    
    # Cache miss — query native vnbroker and persist the response in Redis.
    logger.debug(f"Cache MISS for {cache_key} — fetching native intraday frame")
    frame, source = _fetch_intraday_frame(symbol_upper, page_size=page_size)
    trade_list = _normalize_intraday_trade_rows(frame, symbol_upper)
    result = {
        'symbol': symbol_upper,
        'trades': trade_list,
        'total': len(trade_list),
        'source': source or 'native',
        'stale': False,
        'fetched_at': now().isoformat(),
    }

    _publish_intraday_stream(symbol_upper, trade_list)
    
    # Cache for 5 minutes (300 seconds)
    cache.set(cache_key, result, timeout=300)
    
    return result


# ---------------------------------------------------------------------------
# DNSE Historical Tape — SSOT (D01)
# ---------------------------------------------------------------------------
# SSOT duy nhất cho fetch tape lịch sử DNSE.
# Tuyệt đối cấm import DNSEQuote từ bất kỳ nơi nào khác ngoài hàm này.
# ---------------------------------------------------------------------------

_DNSE_SIDE_BUY = frozenset({'bu', 'b', 'buy', '+'})
_DNSE_SIDE_SELL = frozenset({'sd', 's', 'sell', '-'})


def fetch_intraday_tape_history(
    symbol: str,
    trade_date: str,
    api_key: str | None = None,
    api_secret: str | None = None,
    *,
    source: str = 'dnse',
) -> list[dict[str, Any]]:
    """
    Fetch historical intraday tape từ DNSE cho một ngày giao dịch cụ thể.

    SSOT duy nhất cho DNSE historical tape — tuyệt đối không import DNSEQuote
    từ bất kỳ module nào khác ngoài hàm này.

    Args:
        symbol:     Mã CK, e.g. 'HPG'.
        trade_date: Ngày giao dịch 'YYYY-MM-DD'.
        api_key:    DNSE API key (None → public endpoint, dữ liệu có thể giới hạn).
        api_secret: DNSE API secret.
        source:     Label ghi vào field 'source' của mỗi tick, e.g. 'dnse_system' / 'dnse_user'.

    Returns:
        list[dict] với keys: timestamp (UTC-aware datetime), price (float),
        volume (int), side ('buy'/'sell'/'unknown'), match_type (str), source (str).
        Trả về [] nếu không có dữ liệu hoặc lỗi. Không raise exception.

    Security:
        api_key và api_secret tuyệt đối không được log.
        Chỉ log symbol, trade_date, result count.
    """
    symbol_upper = symbol.strip().upper()
    # DNSEQuote.intraday() chỉ nhận string 'YYYY-MM-DD', không nhận datetime.date
    trade_date_str = trade_date.strftime('%Y-%m-%d') if hasattr(trade_date, 'strftime') else str(trade_date)
    try:
        from vnbroker.explorer.dnse.quote import DNSEQuote

        q = DNSEQuote(
            symbol=symbol_upper,
            api_key=api_key,
            api_secret=api_secret,
            show_log=False,
        )
        # Intercept vnbroker rate-limit WARNING log để phân biệt "no data" vs "rate limited"
        _watcher = _RateLimitWatcher()
        _vnbroker_log = logging.getLogger('vnbroker')
        _vnbroker_log.addHandler(_watcher)
        try:
            df = q.intraday(date=trade_date_str, get_all=True, page_size=1000)
        finally:
            _vnbroker_log.removeHandler(_watcher)
        if _watcher.triggered:
            raise DnseRateLimitError(f'DNSE rate limit exceeded: symbol={symbol_upper} date={trade_date_str}')

        if df is None or df.empty:
            logger.info(
                'fetch_intraday_tape_history: no data — symbol=%s date=%s',
                symbol_upper, trade_date_str,
            )
            return []

        results: list[dict[str, Any]] = []
        for _, row in df.iterrows():
            ts_raw = row.get('time')
            if ts_raw is None or pd.isna(ts_raw):
                continue

            # _parse_trades converts Unix timestamps → naive UTC datetime (tz stripped).
            # For string timestamps from DNSE, they may be VN local naive; treat as UTC
            # since VN production data consistently uses Unix seconds (UTC).
            ts = pd.Timestamp(ts_raw)
            if ts.tzinfo is None:
                utc_ts = ts.to_pydatetime().replace(tzinfo=_dt_timezone.utc)
            else:
                utc_ts = ts.to_pydatetime().astimezone(_dt_timezone.utc)

            side_raw = str(row.get('side') or '').strip().lower()
            if side_raw in _DNSE_SIDE_BUY:
                side = 'buy'
            elif side_raw in _DNSE_SIDE_SELL:
                side = 'sell'
            else:
                side = 'unknown'

            results.append({
                'timestamp': utc_ts,
                'price': float(row.get('price') or 0),
                'volume': int(row.get('volume') or 0),
                'side': side,
                'match_type': 'NormalMatch',
                'source': source,
            })

        logger.info(
            'fetch_intraday_tape_history: symbol=%s date=%s ticks=%d source=%s',
            symbol_upper, trade_date_str, len(results), source,
        )
        return results

    except DnseRateLimitError:
        raise  # Propagate rate limit — caller (Celery task) sẽ retry
    except Exception:
        # Không log exception message nếu nó chứa credential info.
        # Chỉ log symbol và date.
        logger.warning(
            'fetch_intraday_tape_history failed: symbol=%s date=%s',
            symbol_upper, trade_date_str,
        )
        return []


def fetch_company_info(symbol: str, source: str = 'KBS') -> dict:
    """
    Fetch company profile details (overview, officers, shareholders, events) from vnbroker.
    """
    symbol_upper = symbol.upper()
    try:
        from vnbroker import Company
        company = Company(symbol=symbol_upper, source=source)
        
        # 1. overview
        try:
            overview_df = company.overview()
            if overview_df is not None and not overview_df.empty:
                overview_df = overview_df.loc[:, ~overview_df.columns.duplicated()]
                overview_df = overview_df.where(pd.notnull(overview_df), None)
                overview = overview_df.to_dict(orient='records')[0]
            else:
                overview = {}
        except Exception as e:
            logger.error('Error fetching company overview for %s from vnbroker: %s', symbol_upper, e)
            overview = {}

        # 2. officers
        try:
            officers_df = company.officers()
            if officers_df is not None and not officers_df.empty:
                officers_df = officers_df.loc[:, ~officers_df.columns.duplicated()]
                officers_df = officers_df.where(pd.notnull(officers_df), None)
                officers = officers_df.to_dict(orient='records')
            else:
                officers = []
        except Exception as e:
            logger.error('Error fetching company officers for %s from vnbroker: %s', symbol_upper, e)
            officers = []

        # 3. shareholders
        try:
            shareholders_df = company.shareholders()
            if shareholders_df is not None and not shareholders_df.empty:
                shareholders_df = shareholders_df.loc[:, ~shareholders_df.columns.duplicated()]
                shareholders_df = shareholders_df.where(pd.notnull(shareholders_df), None)
                shareholders = shareholders_df.to_dict(orient='records')
            else:
                shareholders = []
        except Exception as e:
            logger.error('Error fetching company shareholders for %s from vnbroker: %s', symbol_upper, e)
            shareholders = []

        # 4. events
        try:
            events_df = company.events()
            if events_df is not None and not events_df.empty:
                events_df = events_df.loc[:, ~events_df.columns.duplicated()]
                events_df = events_df.where(pd.notnull(events_df), None)
                events = events_df.to_dict(orient='records')
            else:
                events = []
        except Exception as e:
            logger.error('Error fetching company events for %s from vnbroker: %s', symbol_upper, e)
            events = []

        return {
            'overview': overview,
            'officers': officers,
            'shareholders': shareholders,
            'events': events,
        }
    except Exception as e:
        logger.error('Failed to fetch company info for %s from vnbroker: %s', symbol_upper, e)
        return {
            'overview': {},
            'officers': [],
            'shareholders': [],
            'events': [],
        }


def fetch_company_financials(symbol: str, source: str = 'KBS') -> dict:
    """
    Fetch company ratios, income statement, and balance sheet from vnbroker.
    """
    symbol_upper = symbol.upper()
    try:
        from vnbroker import Finance
        finance = Finance(symbol=symbol_upper, source=source)
        
        # 1. ratios
        try:
            ratios_df = finance.ratio(period='quarter')
            if ratios_df is not None and not ratios_df.empty:
                ratios_df = ratios_df.loc[:, ~ratios_df.columns.duplicated()]
                ratios_df = ratios_df.where(pd.notnull(ratios_df), None)
                ratios = ratios_df.to_dict(orient='records')
            else:
                ratios = []
        except Exception as e:
            logger.error('Error fetching ratios for %s from vnbroker: %s', symbol_upper, e)
            ratios = []

        # 2. income statement
        try:
            income_df = finance.income_statement(period='quarter')
            if income_df is not None and not income_df.empty:
                income_df = income_df.loc[:, ~income_df.columns.duplicated()]
                income_df = income_df.where(pd.notnull(income_df), None)
                income = income_df.to_dict(orient='records')
            else:
                income = []
        except Exception as e:
            logger.error('Error fetching income statement for %s from vnbroker: %s', symbol_upper, e)
            income = []

        # 3. balance sheet
        try:
            balance_df = finance.balance_sheet(period='quarter')
            if balance_df is not None and not balance_df.empty:
                balance_df = balance_df.loc[:, ~balance_df.columns.duplicated()]
                balance_df = balance_df.where(pd.notnull(balance_df), None)
                balance = balance_df.to_dict(orient='records')
            else:
                balance = []
        except Exception as e:
            logger.error('Error fetching balance sheet for %s from vnbroker: %s', symbol_upper, e)
            balance = []

        return {
            'ratio': ratios,
            'income_statement': income,
            'balance_sheet': balance,
        }
    except Exception as e:
        logger.error('Failed to fetch company financials for %s from vnbroker: %s', symbol_upper, e)
        return {
            'ratio': [],
            'income_statement': [],
            'balance_sheet': [],
        }


def fetch_rss_news(symbol: str) -> list[dict]:
    """
    Fetch news for a symbol using Google News RSS search feed.
    """
    symbol_upper = symbol.upper()
    url = f"https://news.google.com/rss/search?q={symbol_upper}&hl=vi&gl=VN&ceid=VN:vi"
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    try:
        import xml.etree.ElementTree as ET
        response = httpx.get(url, headers=headers, timeout=10.0)
        if response.status_code != 200:
            return []
        root = ET.fromstring(response.content)
        news_items = []
        for item in root.findall(".//item"):
            title = item.find("title").text if item.find("title") is not None else ""
            link = item.find("link").text if item.find("link") is not None else ""
            pub_date = item.find("pubDate").text if item.find("pubDate") is not None else ""
            # Clean title (remove trailing source name like "- CafeF")
            clean_title = title.rsplit(" - ", 1)[0] if " - " in title else title
            news_items.append({
                'news_id': f"rss:{hash(link)}",
                'title': clean_title,
                'summary': '',
                'url': link,
                'published_at': pub_date,
                'source': 'Google News',
            })
        return news_items
    except Exception as e:
        logger.error('Error fetching Google News RSS for %s: %s', symbol_upper, e)
        return []


def _clean_financials_nan(obj):
    """Recursively replace NaN/Inf with None so cached payloads are JSON-safe."""
    import math
    if isinstance(obj, dict):
        return {k: _clean_financials_nan(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_clean_financials_nan(x) for x in obj]
    if isinstance(obj, float) and (math.isnan(obj) or math.isinf(obj)):
        return None
    return obj


def get_company_financials_response(symbol: str, force: bool = False) -> dict:
    """
    SSOT: canonical cached fetch of company financials from vnbroker.

    Single gateway for all vnbroker financials data (ratio / income_statement /
    balance_sheet). Caches 12h in Django cache under ``stock_financials:{symbol}``
    — the same key consumed by StockManagementFinancialsView — so every consumer
    shares one source of truth and one cache. Returns the cached response payload
    ``{symbol, financials, note}``. On failure returns an empty-but-valid payload
    (graceful, no crash) and does NOT cache the failure (allows retry on next call).
    """
    from django.core.cache import cache

    symbol = symbol.upper()
    cache_key = f"stock_financials:{symbol}"

    if not force:
        cached = cache.get(cache_key)
        if cached is not None:
            return cached

    try:
        fin = fetch_company_financials(symbol, source='KBS')
    except Exception as e:  # noqa: BLE001 - vnbroker feed may be unreachable
        logger.error('get_company_financials_response: fetch failed for %s: %s', symbol, e)
        fin = {'ratio': [], 'income_statement': [], 'balance_sheet': []}

    response_data = _clean_financials_nan({
        'symbol': symbol,
        'financials': {
            'ratio': fin.get('ratio', []),
            'income_statement': fin.get('income_statement', []),
            'balance_sheet': fin.get('balance_sheet', []),
        },
        'note': 'financials_loaded_successfully',
    })

    cache.set(cache_key, response_data, timeout=43200)  # 12 hours
    return response_data


# ---------------------------------------------------------------------------
# CachedSymbolGroup sync — SSOT cho nhóm thị trường
# ---------------------------------------------------------------------------

_PROVIDER_SYNC_ORDER = ('KBS', 'VCI', 'TCBS')

# Static display metadata — vnbroker chỉ trả category/group_name, KHÔNG trả color/order/group_type.
# Map này cung cấp visual properties cho UI, giữ nguyên khi provider thay đổi.
_GROUP_METADATA: dict[str, dict[str, Any]] = {
    # ── Sector groups (hardcoded ở backend, frontend chỉ hiển thị) ──
    'Ngân hàng':             {'group_type': 'SECTOR', 'color': '#3b82f6', 'display_order': 1},
    'Bất động sản':          {'group_type': 'SECTOR', 'color': '#f59e0b', 'display_order': 2},
    'Thép & Vật liệu':       {'group_type': 'SECTOR', 'color': '#ef4444', 'display_order': 3},
    'Dầu khí':               {'group_type': 'SECTOR', 'color': '#8b5cf6', 'display_order': 4},
    'Công nghệ':             {'group_type': 'SECTOR', 'color': '#22c55e', 'display_order': 5},
    'Bán lẻ & Tiêu dùng':   {'group_type': 'SECTOR', 'color': '#ec4899', 'display_order': 6},
    # ── Index groups (từ vnbroker) ──
    'VN30':                  {'group_type': 'INDEX',  'color': '#6366f1', 'display_order': 10},
    'VN50':                  {'group_type': 'INDEX',  'color': '#818cf8', 'display_order': 11},
    'VN100':                 {'group_type': 'INDEX',  'color': '#14b8a6', 'display_order': 12},
    'VNX50':                 {'group_type': 'INDEX',  'color': '#0ea5e9', 'display_order': 13},
    'VNXALL':                {'group_type': 'INDEX',  'color': '#06b6d4', 'display_order': 14},
    'VNALL':                 {'group_type': 'INDEX',  'color': '#0891b2', 'display_order': 15},
    'VNSmallCap':            {'group_type': 'INDEX',  'color': '#a78bfa', 'display_order': 16},
    'VNMidCap':              {'group_type': 'INDEX',  'color': '#c084fc', 'display_order': 17},
    'VNSI':                  {'group_type': 'INDEX',  'color': '#e879f9', 'display_order': 18},
    'HNX30':                 {'group_type': 'INDEX',  'color': '#f43f5e', 'display_order': 19},
    # ── Exchange groups (từ vnbroker) ──
    'HOSE':                  {'group_type': 'EXCHANGE', 'color': '#10b981', 'display_order': 30},
    'HNX':                   {'group_type': 'EXCHANGE', 'color': '#6366f1', 'display_order': 31},
    'UPCOM':                 {'group_type': 'EXCHANGE', 'color': '#ec4899', 'display_order': 32},
    # ── Other groups (từ vnbroker) ──
    'ETF':                   {'group_type': 'ETF',      'color': '#f59e0b', 'display_order': 40},
    'CW':                    {'group_type': 'CW',       'color': '#8b5cf6', 'display_order': 41},
    'BOND':                  {'group_type': 'BOND',     'color': '#22c55e', 'display_order': 42},
    'FU_INDEX':              {'group_type': 'DERIVATIVE', 'color': '#ef4444', 'display_order': 43},
    # ── VCI extended groups ──
    'HNXCon':                {'group_type': 'INDEX',  'color': '#fb923c', 'display_order': 20},
    'HNXFin':                {'group_type': 'INDEX',  'color': '#fb923c', 'display_order': 21},
    'HNXLCap':               {'group_type': 'INDEX',  'color': '#fb923c', 'display_order': 22},
    'HNXMSCap':              {'group_type': 'INDEX',  'color': '#fb923c', 'display_order': 23},
    'HNXMan':                {'group_type': 'INDEX',  'color': '#fb923c', 'display_order': 24},
}

# Sector groups — hardcoded ở backend, không sync từ vnbroker (provider không có sector).
_SECTOR_GROUPS: list[dict[str, Any]] = [
    {
        'group_name': 'Ngân hàng',
        'group_code': 'SECTOR_BANK',
        'category': 'Sector — VN',
        'description': 'Nhóm ngân hàng',
        'group_type': 'SECTOR',
        'color': '#3b82f6',
        'display_order': 1,
    },
    {
        'group_name': 'Bất động sản',
        'group_code': 'SECTOR_RE',
        'category': 'Sector — VN',
        'description': 'Nhóm bất động sản',
        'group_type': 'SECTOR',
        'color': '#f59e0b',
        'display_order': 2,
    },
    {
        'group_name': 'Thép & Vật liệu',
        'group_code': 'SECTOR_MAT',
        'category': 'Sector — VN',
        'description': 'Nhóm thép và vật liệu xây dựng',
        'group_type': 'SECTOR',
        'color': '#ef4444',
        'display_order': 3,
    },
    {
        'group_name': 'Dầu khí',
        'group_code': 'SECTOR_OG',
        'category': 'Sector — VN',
        'description': 'Nhóm dầu khí và năng lượng',
        'group_type': 'SECTOR',
        'color': '#8b5cf6',
        'display_order': 4,
    },
    {
        'group_name': 'Công nghệ',
        'group_code': 'SECTOR_TECH',
        'category': 'Sector — VN',
        'description': 'Nhóm công nghệ và viễn thông',
        'group_type': 'SECTOR',
        'color': '#22c55e',
        'display_order': 5,
    },
    {
        'group_name': 'Bán lẻ & Tiêu dùng',
        'group_code': 'SECTOR_RET',
        'category': 'Sector — VN',
        'description': 'Nhóm bán lẻ và hàng tiêu dùng',
        'group_type': 'SECTOR',
        'color': '#ec4899',
        'display_order': 6,
    },
]


def sync_cached_symbol_groups(*, source: str | None = None) -> dict[str, Any]:
    """Sync nhóm thị trường từ vnbroker provider + sector groups vào CachedSymbolGroup.

    1. Upsert sector groups (hardcoded) — luôn sync, không phụ thuộc provider.
    2. Gọi listing.get_supported_groups() → upsert vào DB.
    3. Với mỗi group, populate group_type/color/display_order từ _GROUP_METADATA.
    4. Soft-deactivate groups không còn ở provider (giữ sector groups).

    Returns:
        dict: {synced: int, deactivated: int, source: str, error: str|None}
    """
    from service_ops.models import CachedSymbolGroup  # lazy import — cross package

    imported_names: set[str] = set()
    synced = 0

    # ── Step 1: Upsert sector groups (hardcoded, không phụ thuộc provider) ──
    for sg in _SECTOR_GROUPS:
        meta = _GROUP_METADATA.get(sg['group_name'], {})
        CachedSymbolGroup.objects.update_or_create(
            group_name=sg['group_name'],
            defaults={
                'group_code': sg['group_code'],
                'category': sg['category'],
                'description': sg['description'],
                'source_provider': 'SECTOR',
                'group_type': meta.get('group_type', sg.get('group_type', 'SECTOR')),
                'color': meta.get('color', sg.get('color', '')),
                'display_order': meta.get('display_order', sg.get('display_order', 999)),
                'symbol_count': None,
                'is_active': True,
            },
        )
        imported_names.add(sg['group_name'])
        synced += 1

    # ── Step 2: Sync từ vnbroker provider ──
    providers_to_try = [source.upper()] if source else list(_PROVIDER_SYNC_ORDER)
    provider_source = None

    for prov in providers_to_try:
        try:
            normalized = _resolve_realtime_source(prov)
            listing_class = _load_listing_adapter_class()
            client = listing_class(source=normalized)

            groups_df = client.get_supported_groups()
            if groups_df is None or (hasattr(groups_df, 'empty') and groups_df.empty):
                logger.warning('sync_cached_symbol_groups: %s trả về empty groups', normalized)
                continue

            provider_source = normalized

            for _, row in groups_df.iterrows():
                group_name = str(row.get('group_name', '')).strip()
                if not group_name:
                    continue

                group_code = str(row.get('group_code', '')).strip()
                category = str(row.get('category', '')).strip()
                description = str(row.get('description', '')).strip()

                meta = _GROUP_METADATA.get(group_name, {})

                # Đếm symbols — lazy, có thể fail
                symbol_count = None
                try:
                    symbols = client.symbols_by_group(group=group_name)
                    if symbols is not None and hasattr(symbols, '__len__'):
                        symbol_count = len(symbols)
                except Exception:
                    pass

                CachedSymbolGroup.objects.update_or_create(
                    group_name=group_name,
                    defaults={
                        'group_code': group_code,
                        'category': category,
                        'description': description,
                        'source_provider': normalized,
                        'symbol_count': symbol_count,
                        'group_type': meta.get('group_type', ''),
                        'color': meta.get('color', ''),
                        'display_order': meta.get('display_order', 999),
                        'is_active': True,
                    },
                )
                imported_names.add(group_name)
                synced += 1

            # Soft-deactivate provider groups không còn ở provider này
            deactivated = CachedSymbolGroup.objects.filter(
                is_active=True,
                source_provider=normalized,
            ).exclude(
                group_name__in=imported_names,
            ).update(is_active=False)

            logger.info(
                'sync_cached_symbol_groups: synced=%d, deactivated=%d, source=%s',
                synced, deactivated, normalized,
            )
            return {'synced': synced, 'deactivated': deactivated, 'source': normalized, 'error': None}

        except Exception as exc:
            logger.warning('sync_cached_symbol_groups: provider %s fail: %s', prov, exc)
            continue

    # Sector groups synced even if all providers fail
    if synced > 0:
        return {'synced': synced, 'deactivated': 0, 'source': 'SECTOR', 'error': None}

    return {
        'synced': 0,
        'deactivated': 0,
        'source': 'none',
        'error': 'Tất cả vnbroker providers đều không khả dụng',
    }


import logging
import time
import random
import json
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

class VnbrokerAdapterError(Exception):
    """Base error for vnbroker adapter."""
    pass


_INTRADAY_FALLBACK_SOURCES = _SUPPORTED_PROVIDER_SOURCES
_LISTING_GROUP_ALIASES = {
    'vn30': 'VN30',
    'vn100': 'VN100',
    'top100': 'VN100',
}
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
    try:
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
    if group_id in {'vn100', 'top100'}:
        return symbols[:100]
    return symbols[:50]


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


def fetch_price_board_snapshot(symbols: list[str], *, source: str | None = None) -> list[dict[str, Any]]:
    """
    Lấy snapshot giá realtime cho danh sách symbol qua provider được chỉ định.
    Tất cả calls qua fetch_realtime_price để đảm bảo SSOT.
    """
    normalized_source = _resolve_realtime_source(source)
    _load_quote_class(normalized_source)
    logger.info('Fetching price board snapshot from %s for %d symbols.', normalized_source, len(symbols))

    results = []
    for symbol in symbols:
        live = fetch_realtime_price(symbol, source=normalized_source)
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

def fetch_daily_history(symbol: str, days: int = 365, *, source: str | None = None) -> list[dict[str, Any]]:
    """
    Lấy lịch sử giá ngày (OHLCV) cho một symbol qua provider được chỉ định.
    Trả về list dict chuẩn hoá để ghi vào DailyPrice.
    """
    from datetime import timedelta, date as dt_date

    symbol_upper = symbol.strip().upper()
    normalized_source = _resolve_realtime_source(source)
    end_date = timezone.now().date()
    start_date = end_date - timedelta(days=days)

    try:
        quote_class = _load_quote_class(normalized_source)
        quote_client = quote_class(symbol=symbol_upper)
        df = quote_client.history(
            start=start_date.isoformat(),
            end=end_date.isoformat(),
            interval='1D',
            show_log=False,
        )
    except Exception as exc:
        logger.warning('fetch_daily_history %s failed for %s: %s', normalized_source, symbol_upper, exc)
        return []

    if df is None or df.empty:
        return []

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
                'source': normalized_source,
            })
        except (KeyError, TypeError, ValueError) as exc:
            logger.debug('Skipping malformed OHLCV row for %s via %s: %s', symbol_upper, normalized_source, exc)
            continue

    return rows

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
        listing_rows = _normalize_listing_rows(listing_client.all_symbols(), normalized_source)
        if listing_rows:
            return listing_rows
    except Exception as exc:
        logger.warning('fetch_listing_symbols %s failed: %s', normalized_source, exc)

    return _build_listing_seed_rows(normalized_source)


def fetch_symbol_group_members(symbol_group_id: str, *, source: str | None = None) -> list[str]:
    normalized_source = _resolve_realtime_source(source)
    group_id = str(symbol_group_id or '').strip().lower()
    if group_id == 'top100':
        group_id = 'vn100'
    group_alias = _LISTING_GROUP_ALIASES.get(group_id)

    if group_alias:
        try:
            logger.info('Fetching symbol group %s from %s.', group_alias, normalized_source)
            listing_class = _load_listing_adapter_class()
            listing_client = listing_class(source=normalized_source)
            group_symbols = _normalize_listing_rows(
                listing_client.symbols_by_group(group=group_alias),
                normalized_source,
            )
            symbols = [row['symbol'] for row in group_symbols]
            if symbols:
                return symbols
        except Exception as exc:
            logger.warning(
                'fetch_symbol_group_members %s via %s failed: %s',
                group_id,
                normalized_source,
                exc,
            )

    logger.info('Falling back to listing universe slice for %s from %s.', group_id, normalized_source)
    listing_rows = fetch_listing_symbols(source=normalized_source)
    listing_symbols = [row['symbol'] for row in listing_rows if row.get('symbol')]
    return _slice_listing_symbols(listing_symbols, group_id)


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

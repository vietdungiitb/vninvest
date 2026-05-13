import logging
import time
import random
from typing import Any, Optional
import httpx
from django.db.utils import ProgrammingError, OperationalError
from django.utils import timezone
from django.utils.timezone import now
from .models import VnbrokerRuntimeConfig

logger = logging.getLogger(__name__)

class VnbrokerAdapterError(Exception):
    """Base error for vnbroker adapter."""
    pass

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

def fetch_price_board_snapshot(symbols: list[str]) -> list[dict[str, Any]]:
    """
    Lấy dữ liệu snapshot bảng giá cho danh sách symbol.
    Logic này mô phỏng việc gọi API từ các nguồn (VCI/KBS).
    Trong thực tế, nó sẽ tích hợp thư viện vnbroker hoặc gọi REST API.
    """
    config = get_active_config()
    source = config.data_source
    
    logger.info(f"Fetching price board from {source} for {len(symbols)} symbols.")
    
    # Giả lập delay và jitter dựa trên config
    if config.request_delay_ms > 0:
        time.sleep(config.request_delay_ms / 1000.0)
    
    results = []
    # Đây là nơi code gọi API thực tế sẽ nằm. 
    # Hiện tại chúng ta mock dữ liệu để đảm bảo pipeline chạy được.
    for symbol in symbols:
        # Giả lập dữ liệu cho demo/test
        price = 20.0 + random.uniform(-5.0, 5.0)
        change_pct = round(random.uniform(-3.5, 3.5), 2)   # percent scale (-3.5% … +3.5%)
        price_change = round(price * change_pct / 100, 2)
        results.append({
            'symbol': symbol.upper(),
            'price': round(price, 2),
            'price_change': price_change,
            'price_change_pct': change_pct,
            'volume': random.randint(100_000, 5_000_000),
            'source': source,
            'fetched_at': now().isoformat(),
        })
        
    return results

def warm_up_symbols(symbols: list[str]) -> dict[str, Any]:
    """
    Kích hoạt warmup cho danh sách symbol.
    Native version tập trung vào việc cập nhật SymbolSnapshot.
    """
    from market_serving.models import SymbolSnapshot
    
    snapshots = fetch_price_board_snapshot(symbols)
    count = 0
    today = now().date()
    
    for item in snapshots:
        SymbolSnapshot.objects.update_or_create(
            symbol=item['symbol'],
            session_date=today,
            defaults={
                'price': item['price'],
                'price_change': item['price_change'],
                'price_change_pct': item['price_change_pct'],
                'volume': item['volume'],
                'market_status': SymbolSnapshot.MarketStatusChoices.OPEN,
                'source': SymbolSnapshot.SourceChoices.CORE,
                'stale': False,
            }
        )
        count += 1
        
    return {'status': 'ok', 'warmed_up_count': count, 'source': snapshots[0]['source'] if snapshots else 'unknown'}

def fetch_listing_symbols() -> list[dict[str, Any]]:
    """
    Lấy danh sách mã niêm yết từ nguồn dữ liệu.
    Mô phỏng listing universe đủ rộng cho dashboard/heatmap.
    """
    config = get_active_config()
    source = config.data_source

    logger.info(f"Fetching listing symbols from {source}.")

    # Demo universe rộng (~60 mã) để dashboard breadth/heatmap có dữ liệu hoạt động.
    seed_data = [
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

    return [
        {
            'symbol': symbol,
            'exchange': exchange,
            'company_name': company_name,
            'industry': industry,
        }
        for symbol, exchange, company_name, industry in seed_data
    ]


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
    import json
    from django.core.cache import cache
    from .models import IntradayTick
    
    symbol_upper = symbol.upper()
    cache_key = f'intraday_tape:{symbol_upper}'
    
    # Try Redis cache first
    cached = cache.get(cache_key)
    if cached:
        logger.debug(f"Cache HIT for {cache_key}")
        cached_data = json.loads(cached)
        # If cached data has more items than requested page_size,
        # return the last page_size items (most recent)
        if len(cached_data['trades']) > page_size:
            cached_data['trades'] = cached_data['trades'][-page_size:]
        return cached_data
    
    # Cache miss — query DB (latest page_size ticks)
    logger.debug(f"Cache MISS for {cache_key} — querying DB")
    ticks = IntradayTick.objects.filter(
        symbol=symbol_upper
    ).order_by('-timestamp')[:page_size]
    
    # Build result with reverse order (chronological)
    tick_list = [
        {
            'timestamp': tick.timestamp.isoformat(),
            'price': float(tick.price),
            'volume': tick.volume,
            'side': tick.side.lower(),
            'match_type': tick.match_type or 'NormalMatch',
        }
        for tick in reversed(list(ticks))
    ]
    
    result = {
        'symbol': symbol_upper,
        'trades': tick_list,
    }
    
    # Cache for 5 minutes (300 seconds)
    cache.set(cache_key, json.dumps(result, default=str), timeout=300)
    
    return result

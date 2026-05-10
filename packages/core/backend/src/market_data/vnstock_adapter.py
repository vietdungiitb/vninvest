import logging
import time
import random
from typing import Any, Optional
import httpx
from django.utils.timezone import now
from .models import VnstockRuntimeConfig

logger = logging.getLogger(__name__)

class VnstockAdapterError(Exception):
    """Base error for vnstock adapter."""
    pass

def get_active_config() -> VnstockRuntimeConfig:
    """Lấy cấu hình đang hoạt động hoặc tạo mặc định."""
    config = VnstockRuntimeConfig.objects.filter(is_active=True).first()
    if not config:
        config, _ = VnstockRuntimeConfig.objects.get_or_create(
            name='Default Config',
            defaults={
                'is_active': True,
                'data_source': VnstockRuntimeConfig.SourceChoices.VCI,
                'max_workers': 4,
                'batch_size': 50,
            }
        )
    return config

def fetch_price_board_snapshot(symbols: list[str]) -> list[dict[str, Any]]:
    """
    Lấy dữ liệu snapshot bảng giá cho danh sách symbol.
    Logic này mô phỏng việc gọi API từ các nguồn (VCI/KBS).
    Trong thực tế, nó sẽ tích hợp thư viện vnstock hoặc gọi REST API.
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
        price = 20.0 + random.uniform(-1.0, 1.0)
        results.append({
            'symbol': symbol.upper(),
            'price': round(price, 2),
            'price_change': round(price * 0.01, 2),
            'price_change_pct': 0.01,
            'volume': random.randint(1000, 1000000),
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
    Mô phỏng việc gọi listing API.
    """
    config = get_active_config()
    source = config.data_source
    
    logger.info(f"Fetching listing symbols from {source}.")
    
    # Mock data cho demo
    mock_symbols = [
        {'symbol': 'SSI', 'exchange': 'HOSE', 'company_name': 'Chứng khoán SSI', 'industry': 'Dịch vụ tài chính'},
        {'symbol': 'VND', 'exchange': 'HOSE', 'company_name': 'Chứng khoán VNDirect', 'industry': 'Dịch vụ tài chính'},
        {'symbol': 'VCB', 'exchange': 'HOSE', 'company_name': 'Vietcombank', 'industry': 'Ngân hàng'},
        {'symbol': 'TCB', 'exchange': 'HOSE', 'company_name': 'Techcombank', 'industry': 'Ngân hàng'},
        {'symbol': 'FPT', 'exchange': 'HOSE', 'company_name': 'FPT Corp', 'industry': 'Công nghệ thông tin'},
    ]
    return mock_symbols

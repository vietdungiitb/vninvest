from __future__ import annotations

import logging
from datetime import datetime
from django.conf import settings
from django.core.cache import cache
from django.utils import timezone

from portfolio.models import IntradayTick
from portfolio.market_data_service import market_data_service
from portfolio.observability import record_symbol_engagement_event

logger = logging.getLogger(__name__)

def activate_symbol_engagement(user_id: int, symbol: str, source: str, context: dict | None = None):
    """
    Kích hoạt Engagement cho một Symbol khi có tương tác mới.
    Sử dụng cache guard để tránh kích hoạt nhiều lần cho cùng một user/symbol trong phiên.
    """
    symbol = symbol.upper().strip()
    
    # Guard: Tránh activation storm cho cùng một user/symbol (vd: nạp nhiều transaction một lúc)
    engagement_guard_key = f"engagement:active:{user_id}:{symbol}:{timezone.now().date().isoformat()}"
    if not cache.add(engagement_guard_key, 1, timeout=14400): # 4 hours guard
        return

    logger.info(f"Activating symbol engagement: {symbol} for user {user_id} (source: {source})")
    
    # Record metric
    record_symbol_engagement_event('activation_total')
    
    # Trigger async warm-up
    from .tasks_symbol_engagement import warmup_symbol_intraday
    warmup_symbol_intraday.apply_async(
        kwargs={
            'symbol': symbol,
            'reason': source,
        },
        countdown=1
    )

def is_intraday_fresh(symbol: str) -> bool:
    """
    Kiểm tra xem dữ liệu Intraday của symbol có đang "tươi" không.
    - Phụ thuộc vào market phase (nếu market đóng cửa thì coi như tươi).
    - Ngưỡng mặc định 180 giây.
    """
    try:
        clock = market_data_service._get_market_clock_context()
        profile = clock.get('profile', 'offhours')
        
        # Nếu không trong phiên giao dịch chính hoặc phiên đóng cửa, không cần warm-up thêm
        if profile not in ('market_open', 'pre_close', 'pre_open'):
            return True
            
        threshold_seconds = int(getattr(settings, 'SYMBOL_WARMUP_FRESHNESS_THRESHOLD', 180))
        now_local = timezone.localtime(timezone.now())

        # Kiểm tra tick mới nhất trong DB theo ngày local để tránh lệch UTC
        # Lưu ý: IntradayTick dùng trade_date (date) và trade_time (time)
        latest_tick = IntradayTick.objects.filter(
            symbol=symbol.upper(),
            trade_date=now_local.date()
        ).order_by('-trade_time').first()
        
        if not latest_tick:
            return False
            
        # Kết hợp date và time để tính age
        tick_dt = timezone.make_aware(
            datetime.combine(latest_tick.trade_date, latest_tick.trade_time),
            timezone.get_current_timezone(),
        )
        age = (now_local - tick_dt).total_seconds()
        
        # Nếu data < threshold, coi là tươi
        if age <= threshold_seconds:
            # Thêm điều kiện đủ lượng tick để đảm bảo pipeline đã chạy ổn định
            tick_count = IntradayTick.objects.filter(
                symbol=symbol.upper(),
                trade_date=now_local.date()
            ).count()
            if tick_count >= 20:
                return True
                
        return False
    except Exception as exc:
        logger.warning(f"Error checking freshness for {symbol}: {exc}")
        return False

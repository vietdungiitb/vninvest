from __future__ import annotations

import logging
from celery import shared_task
from django.core.cache import cache
from django.utils import timezone

from portfolio.observability import record_symbol_engagement_event

logger = logging.getLogger(__name__)

@shared_task(bind=True, name='portfolio.tasks_symbol_engagement.warmup_symbol_intraday', max_retries=3)
def warmup_symbol_intraday(self, symbol: str, reason: str = 'unknown'):
    """
    Task chạy ngầm để lấy dữ liệu intraday cho một mã chứng khoán mới được engage.
    """
    symbol = symbol.upper().strip()
    today_str = timezone.now().strftime('%Y%m%d')
    lock_key = f"warmup:intraday:{symbol}:{today_str}"
    
    # 1. Idempotency Lock (10 minutes)
    if not cache.add(lock_key, 1, timeout=600):
        record_symbol_engagement_event('warmup_skipped_lock_total')
        logger.info(f"Warmup skipped for {symbol}: Lock exists.")
        return {'status': 'skipped', 'reason': 'lock_exists'}
    
    try:
        from .services_symbol_engagement import is_intraday_fresh
        
        # 2. Freshness check
        if is_intraday_fresh(symbol):
            record_symbol_engagement_event('warmup_skipped_fresh_total')
            logger.info(f"Warmup skipped for {symbol}: Data is already fresh.")
            return {'status': 'skipped', 'reason': 'already_fresh'}
        
        # 3. Collection Pipeline
        from portfolio.realtime.collector import collect_intraday_frame
        from portfolio.realtime.tick_producer import TickProducer
        
        logger.info(f"Executing warm-up collection for {symbol} (reason: {reason})")
        df = collect_intraday_frame(symbol)
        
        if df is None or df.empty:
            record_symbol_engagement_event('warmup_error_total')
            logger.warning(f"Warmup finished for {symbol} but 0 ticks were collected.")
            return {'status': 'warning', 'pushed': 0}
        
        # Push to Stream (for WebSockets / Alert Engine)
        producer = TickProducer()
        pushed_count = producer.push_intraday_ticks(symbol, df)
        
        # 4. Direct DB Persist (Robustness: Medium 2 finding)
        # Đảm bảo có dữ liệu trong DB cho Analytics Chart ngay lập tức
        try:
            _persist_df_to_db_directly(symbol, df)
        except Exception as db_exc:
            logger.warning(f"Direct DB persist failed for {symbol}: {db_exc}")
        
        record_symbol_engagement_event('warmup_success_total')
        logger.info(f"Warmup success for {symbol}: {pushed_count} ticks pushed and persisted.")
        return {'status': 'success', 'pushed': pushed_count}
            
    except Exception as exc:
        record_symbol_engagement_event('warmup_error_total')
        logger.exception(f"Warmup task failed for {symbol}: {exc}")
        cache.delete(lock_key)
        raise self.retry(exc=exc, countdown=10)

def _persist_df_to_db_directly(symbol: str, df: 'pd.DataFrame'):
    """
    Ghi trực tiếp dataframe vào IntradayTick DB để đảm bảo tính sẵn sàng cao.
    """
    from portfolio.models import IntradayTick
    from decimal import Decimal
    from datetime import datetime
    from django.utils import timezone as dj_tz
    
    objs = []
    for _, row in df.iterrows():
        try:
            ts_str = str(row.get('ts') or '')
            if not ts_str:
                continue
            dt = datetime.fromisoformat(ts_str.replace('Z', '+00:00'))
            if dj_tz.is_naive(dt):
                dt = dj_tz.make_aware(dt)
            
            objs.append(IntradayTick(
                symbol=symbol.upper(),
                trade_date=dt.date(),
                trade_time=dt.time(),
                price=Decimal(str(round(float(row.get('price', 0)), 3))),
                volume=int(float(row.get('volume', 0))),
                side=str(row.get('side', 'UNKNOWN')),
                stream_id='warmup-direct'
            ))
        except Exception:
            continue
            
    if objs:
        IntradayTick.objects.bulk_create(objs, ignore_conflicts=True)

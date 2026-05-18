"""Celery task discovery shim for signal_intelligence materializers."""
import logging

from celery import shared_task
from django.db.models import Avg, Count, Sum

from .materializers import materialize_unified_alerts, materialize_whale_feed_aggregate

logger = logging.getLogger(__name__)

# ------------------------------------------------------------------
# Thresholds cho whale / dark flow detection từ IntradayTick
# ------------------------------------------------------------------
_TICK_WHALE_VALUE_MIN_VND = 500_000_000        # 500 triệu VND tổng giá trị mua/bán
_TICK_DARK_FLOW_VALUE_MIN_VND = 250_000_000    # 250 triệu — half threshold cho dark flow
_TICK_DARK_FLOW_BUY_RATIO_MIN = 0.65           # ≥ 65% buy = accumulation bias
_TICK_DARK_FLOW_PRICE_CV_MAX = 0.005           # ≤ 0.5% coefficient of variation → consistent price
_TICK_MAX_SYMBOLS_PER_RUN = 500                # tối đa bao nhiêu symbol/lần chạy

__all__ = [
    'materialize_unified_alerts',
    'materialize_whale_feed_aggregate',
    'run_signal_detection_job',
    'detect_and_store_global_whale_alerts',
    'detect_order_flow',
]


def _get_latest_session_date():
    """Trả về session_date có dữ liệu IntradayTick gần nhất."""
    from market_data.models import IntradayTick
    latest = (
        IntradayTick.objects
        .order_by('-timestamp')
        .values_list('timestamp', flat=True)
        .first()
    )
    if latest is None:
        return None
    return latest.date()


@shared_task(bind=True, max_retries=2, default_retry_delay=60)
def detect_and_store_global_whale_alerts(self, symbol: str | None = None):
    """
    Phát hiện whale buy/sell và dark flow từ IntradayTick.

    Aggregates session-level tick data per symbol và tạo OrderFlowEvent records
    với signal_type=whale_buy, whale_sell, hoặc dark_flow.

    Idempotent: dùng source_ref dạng ``tick_session:{symbol}:{date}:{side}``
    để upsert — chạy lại nhiều lần cho cùng session sẽ chỉ update chứ không tạo trùng.
    """
    from django.utils.timezone import now
    from market_data.models import IntradayTick
    from signal_intelligence.models import OrderFlowEvent

    session_date = _get_latest_session_date()
    if session_date is None:
        logger.warning('detect_and_store_global_whale_alerts: no IntradayTick data found, skipping')
        return {'status': 'skipped', 'reason': 'no_tick_data'}

    qs = IntradayTick.objects.filter(timestamp__date=session_date)
    if symbol:
        qs = qs.filter(symbol=symbol.upper())

    # Lấy top symbols có nhiều giao dịch nhất trong session để tránh quét toàn bộ tức thì
    top_symbols = (
        qs.values('symbol')
        .annotate(cnt=Count('id'))
        .order_by('-cnt')
        .values_list('symbol', flat=True)[:_TICK_MAX_SYMBOLS_PER_RUN]
    )

    created = 0
    updated = 0

    for sym in top_symbols:
        sym_qs = qs.filter(symbol=sym)

        buy_qs = sym_qs.filter(side='BUY')
        sell_qs = sym_qs.filter(side='SELL')

        buy_agg = buy_qs.aggregate(total_volume=Sum('volume'), avg_price=Avg('price'), cnt=Count('id'))
        sell_agg = sell_qs.aggregate(total_volume=Sum('volume'), avg_price=Avg('price'), cnt=Count('id'))

        buy_volume = int(buy_agg['total_volume'] or 0)
        sell_volume = int(sell_agg['total_volume'] or 0)
        total_volume = buy_volume + sell_volume
        if total_volume == 0:
            continue

        buy_price = float(buy_agg['avg_price'] or 0)
        sell_price = float(sell_agg['avg_price'] or 0)
        buy_count = int(buy_agg['cnt'] or 0)
        sell_count = int(sell_agg['cnt'] or 0)
        total_count = buy_count + sell_count

        buy_value = int(buy_price * buy_volume)
        sell_value = int(sell_price * sell_volume)
        cvd = float(buy_volume - sell_volume)
        buy_ratio = buy_count / total_count if total_count > 0 else 0
        triggered_at = now()

        # ── Whale Buy ──────────────────────────────────────────────
        if buy_value >= _TICK_WHALE_VALUE_MIN_VND:
            whale_intensity = min(1.0, buy_value / 5_000_000_000)
            source_ref = f'tick_session:{sym}:{session_date}:buy'
            _upsert_order_flow_event(
                source_ref=source_ref,
                symbol=sym,
                session_date=session_date,
                signal_type=OrderFlowEvent.SignalTypeChoices.WHALE_BUY,
                side=OrderFlowEvent.SideChoices.BUY,
                strength=whale_intensity,
                whale_intensity=whale_intensity,
                cvd=cvd,
                price=buy_price,
                volume=buy_volume,
                triggered_at=triggered_at,
                metadata={
                    'source': 'intraday_tick_aggregation',
                    'buy_value': buy_value,
                    'sell_value': sell_value,
                    'total_count': total_count,
                    'session_date': str(session_date),
                },
            )
            created += 1

        # ── Whale Sell ─────────────────────────────────────────────
        if sell_value >= _TICK_WHALE_VALUE_MIN_VND:
            whale_intensity = min(1.0, sell_value / 5_000_000_000)
            source_ref = f'tick_session:{sym}:{session_date}:sell'
            _upsert_order_flow_event(
                source_ref=source_ref,
                symbol=sym,
                session_date=session_date,
                signal_type=OrderFlowEvent.SignalTypeChoices.WHALE_SELL,
                side=OrderFlowEvent.SideChoices.SELL,
                strength=whale_intensity,
                whale_intensity=whale_intensity,
                cvd=cvd,
                price=sell_price,
                volume=sell_volume,
                triggered_at=triggered_at,
                metadata={
                    'source': 'intraday_tick_aggregation',
                    'buy_value': buy_value,
                    'sell_value': sell_value,
                    'total_count': total_count,
                    'session_date': str(session_date),
                },
            )
            created += 1

        # ── Dark Flow (high buy ratio + sufficient value) ──────────
        if buy_ratio >= _TICK_DARK_FLOW_BUY_RATIO_MIN and buy_value >= _TICK_DARK_FLOW_VALUE_MIN_VND:
            dark_intensity = min(1.0, buy_value / 2_000_000_000)
            source_ref = f'tick_session:{sym}:{session_date}:dark_flow'
            _upsert_order_flow_event(
                source_ref=source_ref,
                symbol=sym,
                session_date=session_date,
                signal_type=OrderFlowEvent.SignalTypeChoices.DARK_FLOW,
                side=OrderFlowEvent.SideChoices.BUY,
                strength=dark_intensity,
                whale_intensity=dark_intensity,
                cvd=cvd,
                price=buy_price,
                volume=buy_volume,
                triggered_at=triggered_at,
                metadata={
                    'source': 'intraday_tick_aggregation',
                    'buy_ratio': round(buy_ratio, 4),
                    'buy_value': buy_value,
                    'sell_value': sell_value,
                    'total_count': total_count,
                    'session_date': str(session_date),
                },
            )
            created += 1

    logger.info(
        'detect_and_store_global_whale_alerts: session=%s events_written=%d',
        session_date, created + updated,
    )
    return {
        'status': 'ok',
        'session_date': str(session_date),
        'events_written': created + updated,
    }


@shared_task(bind=True, max_retries=2, default_retry_delay=60)
def detect_order_flow(self, symbol: str | None = None):
    """
    Phát hiện order imbalance và CVD divergence từ IntradayTick.

    Complement của detect_and_store_global_whale_alerts — tạo ORDER_IMBALANCE
    và CVD_DIVERGENCE events cho các symbol có tín hiệu mất cân bằng rõ rệt.
    """
    from django.utils.timezone import now
    from market_data.models import IntradayTick
    from signal_intelligence.models import OrderFlowEvent

    session_date = _get_latest_session_date()
    if session_date is None:
        logger.warning('detect_order_flow: no IntradayTick data found, skipping')
        return {'status': 'skipped', 'reason': 'no_tick_data'}

    qs = IntradayTick.objects.filter(timestamp__date=session_date)
    if symbol:
        qs = qs.filter(symbol=symbol.upper())

    top_symbols = (
        qs.values('symbol')
        .annotate(cnt=Count('id'))
        .order_by('-cnt')
        .values_list('symbol', flat=True)[:_TICK_MAX_SYMBOLS_PER_RUN]
    )

    created = 0

    for sym in top_symbols:
        sym_qs = qs.filter(symbol=sym)
        buy_qs = sym_qs.filter(side='BUY')
        sell_qs = sym_qs.filter(side='SELL')

        buy_agg = buy_qs.aggregate(total_volume=Sum('volume'), avg_price=Avg('price'), cnt=Count('id'))
        sell_agg = sell_qs.aggregate(total_volume=Sum('volume'), avg_price=Avg('price'), cnt=Count('id'))

        buy_volume = int(buy_agg['total_volume'] or 0)
        sell_volume = int(sell_agg['total_volume'] or 0)
        buy_count = int(buy_agg['cnt'] or 0)
        sell_count = int(sell_agg['cnt'] or 0)
        total_count = buy_count + sell_count
        if total_count < 10:
            continue

        buy_price = float(buy_agg['avg_price'] or 0)
        sell_price = float(sell_agg['avg_price'] or 0)
        buy_value = int(buy_price * buy_volume)
        sell_value = int(sell_price * sell_volume)
        buy_ratio = buy_count / total_count if total_count > 0 else 0

        # Order imbalance: buy_ratio > 0.8 hoặc < 0.2
        imbalance_ratio = abs(buy_ratio - 0.5) * 2  # 0..1 scale
        if imbalance_ratio >= 0.6 and (buy_value + sell_value) >= _TICK_DARK_FLOW_VALUE_MIN_VND:
            side = OrderFlowEvent.SideChoices.BUY if buy_ratio > 0.5 else OrderFlowEvent.SideChoices.SELL
            source_ref = f'tick_imbalance:{sym}:{session_date}'
            _upsert_order_flow_event(
                source_ref=source_ref,
                symbol=sym,
                session_date=session_date,
                signal_type=OrderFlowEvent.SignalTypeChoices.ORDER_IMBALANCE,
                side=side,
                strength=imbalance_ratio,
                whale_intensity=imbalance_ratio * 0.7,
                cvd=float(buy_volume - sell_volume),
                price=buy_price if side == OrderFlowEvent.SideChoices.BUY else sell_price,
                volume=buy_volume if side == OrderFlowEvent.SideChoices.BUY else sell_volume,
                triggered_at=now(),
                metadata={
                    'source': 'intraday_tick_aggregation',
                    'imbalance_ratio': round(imbalance_ratio, 4),
                    'buy_ratio': round(buy_ratio, 4),
                    'buy_value': buy_value,
                    'sell_value': sell_value,
                    'session_date': str(session_date),
                },
            )
            created += 1

    logger.info('detect_order_flow: session=%s events_written=%d', session_date, created)
    return {'status': 'ok', 'session_date': str(session_date), 'events_written': created}


def _upsert_order_flow_event(
    *,
    source_ref: str,
    symbol: str,
    session_date,
    signal_type: str,
    side: str,
    strength: float,
    whale_intensity: float,
    cvd: float,
    price: float,
    volume: int,
    triggered_at,
    metadata: dict,
) -> bool:
    """Idempotent upsert cho OrderFlowEvent theo source_ref. Trả về True nếu tạo mới."""
    from decimal import Decimal
    from signal_intelligence.models import OrderFlowEvent

    existing = OrderFlowEvent.objects.filter(source_ref=source_ref).first()
    if existing is None:
        OrderFlowEvent.objects.create(
            symbol=symbol,
            session_date=session_date,
            signal_type=signal_type,
            side=side,
            strength=strength,
            whale_intensity=whale_intensity,
            cvd_at_signal=cvd,
            price_at_signal=Decimal(str(round(price, 2))),
            volume_at_signal=volume,
            source_ref=source_ref,
            metadata=metadata,
            triggered_at=triggered_at,
        )
        return True
    dirty = {}
    if existing.strength != strength:
        dirty['strength'] = strength
    if existing.whale_intensity != whale_intensity:
        dirty['whale_intensity'] = whale_intensity
    if existing.cvd_at_signal != cvd:
        dirty['cvd_at_signal'] = cvd
    new_price = Decimal(str(round(price, 2)))
    if existing.price_at_signal != new_price:
        dirty['price_at_signal'] = new_price
    if existing.volume_at_signal != volume:
        dirty['volume_at_signal'] = volume
    if existing.metadata != metadata:
        dirty['metadata'] = metadata
    if dirty:
        OrderFlowEvent.objects.filter(pk=existing.pk).update(**dirty)
    return False


@shared_task(bind=True)
def run_signal_detection_job(self, domain: str = 'all', symbol: str = None):
    """
    Native: Kích hoạt signal detection job.
    Hiện tại chủ yếu trigger materializers.
    """
    if domain in {'all', 'whale'}:
        materialize_whale_feed_aggregate.delay(symbol=symbol)
    if domain in {'all', 'dark_flow'}:
        materialize_unified_alerts.delay()

    return {'status': 'accepted', 'domain': domain, 'symbol': symbol}
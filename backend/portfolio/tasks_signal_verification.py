"""
PR-2 — W6: Whale Signal Backtesting Worker
Task verify_signals_daily: chạy 16:30 ICT (09:30 UTC) mỗi ngày giao dịch.

Logic:
 - Tìm WhaleAdvisory và OrderFlowSignal phát ra đúng T-3 ngày giao dịch.
 - So sánh giá đóng cửa EOD 16:30 ICT của cổ phiếu và VNINDEX.
 - Tính Alpha = stock_return - vnindex_return.
 - Lưu kết quả vào SignalVerification.
"""
from __future__ import annotations

import logging
from datetime import date, timedelta
from decimal import Decimal

from celery import shared_task
from django.contrib.contenttypes.models import ContentType
from django.db import transaction
from django.utils import timezone

logger = logging.getLogger(__name__)

_IPO_MIN_TRADING_DAYS = 30          # Loại bỏ mã IPO < 30 ngày giao dịch
_PRICE_VALIDATE_THRESHOLD = 0.01    # Lệch > 1% → data_warning


def _get_n_trading_days_ago(n: int, anchor: date) -> date:
    """
    Lùi anchor về n ngày GIAO DỊCH (bỏ qua T7, CN, ngày nghỉ).
    Dùng market_calendar.previous_trading_day lặp n lần.
    """
    from portfolio.market_calendar import previous_trading_day
    cursor = anchor
    for _ in range(n):
        cursor = previous_trading_day(policy=None, anchor_date=cursor)
    return cursor


def _get_ipo_trading_day_count(symbol: str, as_of: date) -> int:
    """Ước tính số ngày giao dịch của symbol tính đến as_of từ DailyPrice."""
    from portfolio.models import DailyPrice
    return DailyPrice.objects.filter(symbol=symbol, date__lte=as_of).count()


def _get_close_price(symbol: str, target_date: date):
    """Trả về close_price của symbol vào target_date hoặc None."""
    from portfolio.models import DailyPrice
    try:
        dp = DailyPrice.objects.get(symbol=symbol, date=target_date)
        return dp.close_price
    except DailyPrice.DoesNotExist:
        return None


def _validate_price(symbol: str, price: Decimal, target_date: date) -> bool:
    """
    Kiểm tra chéo giá. Hiện tại chỉ dùng DailyPrice nội bộ.
    Trả về False (data_warning) nếu không tìm thấy mã để so sánh
    hoặc lệch > 1% (reserved cho tích hợp nguồn backup sau này).
    """
    return True  # Tích hợp nguồn backup CafeF trong sprint kế tiếp


@shared_task(
    name='portfolio.tasks_signal_verification.verify_signals_daily',
    bind=True,
    max_retries=2,
    default_retry_delay=300,
    queue='default',
)
def verify_signals_daily(self):
    """
    Hậu kiểm tất cả tín hiệu phát ra đúng T-3 ngày giao dịch.
    Chạy 16:30 ICT (09:30 UTC) thứ Hai đến thứ Sáu.
    """
    from portfolio.models import (
        DailyPrice, OrderFlowSignal, SignalVerification, WhaleAdvisory,
    )

    today = timezone.localtime().date()
    t0_date = _get_n_trading_days_ago(3, today)

    logger.info('[verify_signals_daily] today=%s, scanning signals on T0=%s', today, t0_date)

    # ── Thu thập tín hiệu cần hậu kiểm ──────────────────────────────────────
    whale_ct = ContentType.objects.get_for_model(WhaleAdvisory)
    order_ct = ContentType.objects.get_for_model(OrderFlowSignal)

    whale_qs = WhaleAdvisory.objects.filter(created_at__date=t0_date)
    order_qs = OrderFlowSignal.objects.filter(
        created_at__date=t0_date
    ).exclude(signal_type='none')

    vnindex_t0 = _get_close_price('VNINDEX', t0_date)
    vnindex_t3 = _get_close_price('VNINDEX', today)

    if vnindex_t0 is None or vnindex_t3 is None:
        logger.warning('[verify_signals_daily] Thiếu dữ liệu VNINDEX t0=%s hoặc t3=%s, bỏ qua', t0_date, today)
        return {'status': 'skipped', 'reason': 'missing_vnindex'}

    created = 0
    skipped = 0
    warned = 0

    def _process_signal(ct, signal, symbol: str, signal_price_float: float):
        nonlocal created, skipped, warned

        # Loại IPO non-eligible
        if _get_ipo_trading_day_count(symbol, today) < _IPO_MIN_TRADING_DAYS:
            logger.debug('[verify_signals_daily] Bỏ qua IPO %s', symbol)
            skipped += 1
            return

        # Tránh tạo duplicate
        if SignalVerification.objects.filter(content_type=ct, object_id=signal.pk).exists():
            skipped += 1
            return

        signal_price = Decimal(str(signal_price_float))
        t3_price = _get_close_price(symbol, today)
        if t3_price is None:
            logger.debug('[verify_signals_daily] Không có giá T+3 cho %s', symbol)
            skipped += 1
            return

        data_warning = not _validate_price(symbol, t3_price, today)

        alpha_score = None
        is_success = False
        if not data_warning and signal_price > 0 and vnindex_t0 > 0:
            stock_return = (t3_price / signal_price) - Decimal('1')
            vnindex_return = (Decimal(str(vnindex_t3)) / Decimal(str(vnindex_t0))) - Decimal('1')
            alpha_score = stock_return - vnindex_return
            price_change_pct = stock_return * 100
            is_success = (alpha_score > 0) or (price_change_pct > Decimal('2'))
        elif data_warning:
            warned += 1

        with transaction.atomic():
            SignalVerification.objects.create(
                content_type=ct,
                object_id=signal.pk,
                symbol=symbol,
                signal_price=signal_price,
                t3_price=t3_price,
                vnindex_price_at_signal=Decimal(str(vnindex_t0)),
                vnindex_price_t3=Decimal(str(vnindex_t3)),
                alpha_score=alpha_score,
                is_success=is_success,
                data_warning=data_warning,
            )
        created += 1

    for advisory in whale_qs:
        symbol = advisory.symbol
        price_raw = advisory.matched_value or 0
        # WhaleAdvisory không lưu giá trực tiếp — lấy từ DailyPrice của ngày T0
        t0_price = _get_close_price(symbol, t0_date)
        if t0_price is None:
            skipped += 1
            continue
        _process_signal(whale_ct, advisory, symbol, float(t0_price))

    for signal in order_qs:
        _process_signal(order_ct, signal, signal.symbol, signal.price_at_signal)

    result = {
        'status': 'ok',
        'date': str(today),
        't0_date': str(t0_date),
        'created': created,
        'skipped': skipped,
        'data_warnings': warned,
    }
    logger.info('[verify_signals_daily] Done: %s', result)
    return result

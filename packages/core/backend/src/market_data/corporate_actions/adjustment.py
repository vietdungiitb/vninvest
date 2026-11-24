"""Tính hệ số điều chỉnh theo ex_date rồi materialize vào DailyPrice.adj_close.

P0 (2026-11-24): ghi adj_close bị TẮT mặc định. Nguồn VCI/KBS đã trả giá điều chỉnh
ở cột `close`; tự nhân factor ở đây tạo ra adjacent price sai (double-adjust).
Bật tường minh qua `PRICE_ADJUSTMENT_WRITES_ENABLED=1` chỉ để chạy test F1 legacy.
"""
import logging
import os
from collections import defaultdict
from datetime import date
from decimal import Decimal

from market_data.models import AdjFactor, CorporateAction, DailyPrice

logger = logging.getLogger(__name__)

Q10 = Decimal('0.0000000001')
Q2 = Decimal('0.01')
ONE = Decimal(1).quantize(Q10)


def _prev_close(symbol: str, ex_date: date) -> Decimal | None:
    """Raw close của phiên giao dịch liền trước ex_date (không phải ex_date - 1 ngày lịch)."""
    return (
        DailyPrice.objects.filter(symbol=symbol, date__lt=ex_date)
        .order_by('-date')
        .values_list('close', flat=True)
        .first()
    )


def compute_adj_factors(symbol: str) -> list[AdjFactor]:
    """Group event theo ex_date, cộng tiền, nhân dồn tỉ lệ, lưu AdjFactor (recompute được)."""
    events = list(CorporateAction.objects.filter(symbol=symbol, is_latest=True).order_by('ex_date'))
    grouped: dict[date, list] = defaultdict(list)
    for event in events:
        grouped[event.ex_date].append(event)

    result: list[AdjFactor] = []
    for ex_date in sorted(grouped):
        group = grouped[ex_date]
        prev_close = _prev_close(symbol, ex_date)
        if prev_close is None:
            logger.warning('Không có close phiên trước ex_date=%s symbol=%s — bỏ qua', ex_date, symbol)
            continue

        cash_sum = sum(
            (e.cash_amount_per_share for e in group if e.cash_amount_per_share is not None),
            Decimal(0),
        )
        ratio_sum = sum(
            (e.stock_ratio_pct for e in group if e.stock_ratio_pct is not None),
            Decimal(0),
        )
        has_unparsed = any(e.parse_status == 'unparsed' for e in group)

        denominator = ONE + (ratio_sum / Decimal(100)).quantize(Q10)
        if cash_sum >= prev_close or denominator <= 0:
            logger.warning(
                'Hệ số không hợp lệ symbol=%s ex_date=%s cash_sum=%s ratio_sum=%s prev_close=%s',
                symbol, ex_date, cash_sum, ratio_sum, prev_close,
            )
            # Recompute: bỏ factor cũ để không áp dụng hệ số stale sau correction (F1).
            AdjFactor.objects.filter(symbol=symbol, ex_date=ex_date).delete()
            continue

        cash_factor = ((prev_close - cash_sum) / prev_close).quantize(Q10)
        stock_factor = (ONE / denominator).quantize(Q10)
        factor_total = (cash_factor * stock_factor).quantize(Q10)
        status = AdjFactor.Status.PARTIAL if has_unparsed else AdjFactor.Status.COMPUTED

        factor, _ = AdjFactor.objects.update_or_create(
            symbol=symbol,
            ex_date=ex_date,
            defaults={
                'prev_close': prev_close,
                'cash_factor': cash_factor,
                'stock_factor': stock_factor,
                'factor_total': factor_total,
                'status': status,
            },
        )
        result.append(factor)
    return result


def apply_adjustments(symbol: str) -> int:
    """Walk ex_date tăng, nhân dồn factor cho mọi ex_date > t; không ghi đè close thô.

    Guard đặt ở ĐẦU HÀM để freeze cả vòng reset (F1) lẫn vòng ghi. Đặt guard sau
    vòng reset thì vẫn `save()` ⇒ vi phạm AC-1 "0 UPDATE".
    """
    if os.getenv('PRICE_ADJUSTMENT_WRITES_ENABLED', '0') != '1':
        return 0

    factors = list(AdjFactor.objects.filter(symbol=symbol).order_by('ex_date'))
    # Không return sớm: khi correction xoá hết factor vẫn phải reset adj_close cũ (F1).
    prices = list(DailyPrice.objects.filter(symbol=symbol).order_by('date'))
    updated = 0
    for price in prices:
        affecting = [f for f in factors if f.ex_date > price.date]
        reset = (not affecting) or any(f.status != AdjFactor.Status.COMPUTED for f in affecting)
        if reset:
            # per-date: reset cả state cũ (F1) — sau correction không giữ adj_close stale.
            if price.adj_close is not None or price.is_adjusted:
                price.adj_close = None
                price.is_adjusted = False
                price.save(update_fields=['adj_close', 'is_adjusted'])
            continue
        product = ONE
        for factor in affecting:
            product = (product * factor.factor_total).quantize(Q10)
        price.adj_close = (price.close * product).quantize(Q2)
        price.is_adjusted = True
        price.save(update_fields=['adj_close', 'is_adjusted'])
        updated += 1
    return updated

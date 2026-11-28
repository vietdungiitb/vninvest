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


def compute_event_factor(event: dict, prev_close: Decimal) -> Decimal:
    """Hệ số Sở GDCK VN: (P + I1*P_issue - D) / (P*(1+I1+I2)).

    Pure function — không DB. Event thiếu số/ambiguous ⇒ PARTIAL_EVENT,
    fail-closed để caller giữ nguyên chuỗi cũ.
    """
    if event.get('parse_status') != 'structured' or event.get('ambiguous'):
        raise ValueError('PARTIAL_EVENT')
    cash = Decimal(str(event.get('cash') or 0))
    stock_pct = Decimal(str(event.get('stock_ratio_pct') or 0))
    rights_pct = Decimal(str(event.get('rights_ratio_pct') or 0))
    issue_price = event.get('rights_issue_price')
    if rights_pct and issue_price is None:
        raise ValueError('PARTIAL_EVENT')
    issue = Decimal(str(issue_price or 0))
    prev = Decimal(str(prev_close))
    i1 = rights_pct / Decimal(100)
    i2 = stock_pct / Decimal(100)
    denominator = prev * (ONE + i1 + i2)
    if denominator <= 0 or prev <= 0:
        raise ValueError('INVALID_FACTOR')
    factor = ((prev + i1 * issue - cash) / denominator).quantize(Q10)
    if not (Decimal('0.01') <= factor <= Decimal('1.05')):
        raise ValueError('INVALID_FACTOR')
    return factor


def recompute_adjusted(rows: list[dict], events: list[dict]) -> list[dict]:
    """Pure: adj_close(t) = base_close(t) * Π f(e) với e.ex_date > t."""
    ordered = sorted(events, key=lambda e: e['ex_date'])
    out = []
    for row in rows:
        cumulative = ONE
        for event in ordered:
            if event['ex_date'] > row['date']:
                cumulative = (
                    cumulative * Decimal(str(event['factor']))
                ).quantize(Q10)
        copy = dict(row)
        copy['adj_close'] = (
            Decimal(str(row['base_close'])) * cumulative
        ).quantize(Q2)
        copy['adj_factor'] = cumulative
        out.append(copy)
    return out


def apply_adjustment_service(symbol: str) -> dict:
    """Đường ghi DUY NHẤT cho adjusted (Phase 3): event → recompute toàn chuỗi."""
    from django.db.models import F
    from django.utils.timezone import now

    from market_data.models import CorporateAction, DailyPrice, PriceRebaseRun

    events = list(
        CorporateAction.objects.filter(symbol=symbol, is_latest=True).order_by('ex_date')
    )
    prices = list(DailyPrice.objects.filter(symbol=symbol).order_by('date'))
    if not prices:
        return {'status': 'noop', 'rows_updated': 0}

    grouped: dict[date, list] = defaultdict(list)
    for event in events:
        grouped[event.ex_date].append(event)
    factors = []
    for ex_date, group in sorted(grouped.items()):
        prev = next((p for p in reversed(prices) if p.date < ex_date), None)
        if prev is None:
            raise ValueError('NO_PREV_CLOSE')
        issue_prices = [e.rights_issue_price for e in group
                        if e.rights_issue_price is not None]
        payload = {
            'cash': sum((e.cash_amount_per_share or Decimal(0) for e in group), Decimal(0)),
            'stock_ratio_pct': sum((e.stock_ratio_pct or Decimal(0) for e in group), Decimal(0)),
            'rights_ratio_pct': sum((e.rights_ratio_pct or Decimal(0) for e in group), Decimal(0)),
            'rights_issue_price': issue_prices[0] if issue_prices else None,
            'parse_status': 'structured' if all(
                e.parse_status == CorporateAction.ParseStatus.STRUCTURED for e in group
            ) else 'parsed_from_text',
            'ambiguous': any(e.ambiguous_cash_pct or e.ambiguous_ratio_pct for e in group),
            'ex_date': ex_date,
        }
        factors.append({'ex_date': ex_date, 'factor': compute_event_factor(payload, prev.close)})

    computed = recompute_adjusted(
        [{'date': p.date, 'base_close': p.close} for p in prices], factors,
    )
    updates = []
    for price, result in zip(prices, computed):
        if price.adj_close == result['adj_close']:
            continue
        price.adj_close = result['adj_close']
        price.adj_factor = result['adj_factor']
        price.is_adjusted = True
        price.adj_as_of = now()
        price.adj_version = F('adj_version') + 1
        updates.append(price)
    if updates:
        DailyPrice.objects.bulk_update(
            updates,
            ['adj_close', 'adj_factor', 'is_adjusted', 'adj_as_of', 'adj_version'],
            batch_size=1000,
        )
    PriceRebaseRun.objects.create(
        symbol=symbol, trigger=PriceRebaseRun.Trigger.CORPORATE_ACTION,
        status=PriceRebaseRun.Status.APPLIED,
        rows_updated=len(updates),
        sample_verdict='PENDING_PROVIDER_SYNC',
    )
    return {'status': 'applied', 'rows_updated': len(updates)}


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

"""Wave 1 B1.3: position-first sync — vi the broker la nguon that.

Nguyen tac (QĐ-2/ADR-005): `PositionSnapshot(source='broker')` + `AccountSnapshot`
ghi tu adapter; ledger giu dong tien + cost-basis. Doi soat dung de PHAT HIEN
lech (B1.5), khong de suy ra vi the.

Idempotent: `update_or_create` theo unique DB (portfolio, symbol, as_of_date).
Va cham (2 tieu khoan chung portfolio+symbol+ngay): SKIP + bao trong stats,
khong ghi de, khong crash (quyet dinh PLAN muc 4).
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal

from django.utils import timezone

CALCULATION_VERSION = 'b13-1'


def _money(value) -> Decimal | None:
    """So that -> Decimal; 0/None/rong -> None (khong gia 0)."""
    try:
        number = float(value or 0)
    except (TypeError, ValueError):
        return None
    if not number:
        return None
    return Decimal(str(number))


def sync_account_positions(service, sub_account, *, as_of_date=None) -> dict:
    """Dong bo 1 tieu khoan: vi the + so du. Tra stats (ghi DB o B1.4/B1.5)."""
    from ..models import AccountSnapshot, PositionSnapshot  # noqa: PLC0415 (lazy)

    today = as_of_date or timezone.now().date()
    stats: dict = {
        'positions_written': 0,
        'collisions': [],
        'skipped_no_portfolio': [],
        'balance_written': False,
    }
    portfolio = getattr(sub_account, 'portfolio', None)
    if portfolio is None:
        stats['skipped_no_portfolio'].append({
            'sub_account_id': sub_account.pk,
            'external_id': getattr(sub_account, 'external_id', ''),
        })
        return stats

    account_no = (
        getattr(sub_account, 'external_id', '')
        or getattr(sub_account, 'account_number', '')
    )
    for position in service.get_positions(account_no):
        symbol = str(getattr(position, 'symbol', '') or '').upper()
        if not symbol:
            continue
        existing = PositionSnapshot.objects.filter(
            portfolio=portfolio, symbol=symbol, as_of_date=today,
        ).exclude(broker_account__isnull=True).first()
        if existing is not None and existing.broker_account_id != sub_account.pk:
            stats['collisions'].append({
                'symbol': symbol,
                'kept_sub_account_id': existing.broker_account_id,
                'skipped_sub_account_id': sub_account.pk,
            })
            continue
        market_price = _money(getattr(position, 'market_price', 0))
        quantity = Decimal(str(getattr(position, 'quantity', 0) or 0))
        market_value = (
            None if market_price is None
            else (market_price * quantity).quantize(Decimal('0.01'))
        )
        # Lookup gioi han dung hang cua CHINH tieu khoan nay: hang computed
        # (broker_account NULL) hay cua TK khac duoc giu nguyen, khong bao gio
        # MultipleObjectsReturned.
        PositionSnapshot.objects.update_or_create(
            portfolio=portfolio, symbol=symbol, as_of_date=today,
            broker_account=sub_account,
            defaults={
                'tenant': sub_account.tenant,
                'quantity': quantity,
                'avg_cost': _money(getattr(position, 'avg_price', 0)) or Decimal('0'),
                'current_price': market_price,
                'market_value': market_value,
                'source': 'broker',
                'calculation_version': CALCULATION_VERSION,
            },
        )
        stats['positions_written'] += 1

    balance = service.get_balance(account_no)
    AccountSnapshot.objects.update_or_create(
        sub_account=sub_account, date=today,
        defaults={
            'cash_balance': _money(balance.cash) or Decimal('0'),
            'stock_value': _money(balance.stock_value) or Decimal('0'),
            'debt': _money(balance.debt) or Decimal('0'),
            'net_equity': _money(balance.net_equity) or Decimal('0'),
            'broker_account': sub_account,
        },
    )
    stats['balance_written'] = True
    return stats


def as_of_today() -> date:
    return timezone.now().date()

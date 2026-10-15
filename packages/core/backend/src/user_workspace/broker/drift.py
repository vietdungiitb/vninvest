"""Wave 1 B1.5: drift broker vs ledger — phat hien, khong tu sua.

`detect_position_drift` thuan (khong DB) de test re + tai dung.
`report_drift_issues` ghi BrokerSyncIssue (Wave 2 hien de user xu ly).
"""
from __future__ import annotations

from decimal import Decimal


def _qty(value) -> Decimal:
    try:
        return Decimal(str(value if value is not None else 0))
    except (TypeError, ValueError, ArithmeticError):
        return Decimal('0')


def detect_position_drift(ledger_holdings: dict, broker_positions: list) -> list[dict]:
    """So vi the ledger `{SYM: {quantity...}}` voi `[BrokerPosition]`.

    Tra list issue dict `{code, symbol, ledger_quantity, broker_quantity}`.
    Khong DB, khong I/O.
    """
    broker_qty: dict[str, Decimal] = {}
    for position in broker_positions or []:
        symbol = str(getattr(position, 'symbol', '') or '').upper()
        if not symbol:
            continue
        broker_qty[symbol] = broker_qty.get(symbol, Decimal('0')) + _qty(
            getattr(position, 'quantity', 0))

    ledger_qty: dict[str, Decimal] = {}
    for symbol, holding in (ledger_holdings or {}).items():
        key = str(symbol or '').upper()
        if not key:
            continue
        qty = holding.get('quantity', 0) if isinstance(holding, dict) else 0
        ledger_qty[key] = _qty(qty)

    issues = []
    for symbol in sorted(set(ledger_qty) | set(broker_qty)):
        in_ledger = symbol in ledger_qty
        in_broker = symbol in broker_qty
        if in_ledger and not in_broker:
            issues.append({
                'code': 'position_missing_broker',
                'symbol': symbol,
                'ledger_quantity': str(ledger_qty[symbol]),
                'broker_quantity': '0',
            })
        elif in_broker and not in_ledger:
            issues.append({
                'code': 'position_missing_ledger',
                'symbol': symbol,
                'ledger_quantity': '0',
                'broker_quantity': str(broker_qty[symbol]),
            })
        elif ledger_qty[symbol] != broker_qty[symbol]:
            issues.append({
                'code': 'position_drift',
                'symbol': symbol,
                'ledger_quantity': str(ledger_qty[symbol]),
                'broker_quantity': str(broker_qty[symbol]),
            })
    return issues


def report_drift_issues(portfolio, tenant, service, sub_account,
                        *, ledger_holdings, run=None) -> list:
    """Chay detect + persist BrokerSyncIssue. Tra list row da tao."""
    from ..models import BrokerSyncIssue  # noqa: PLC0415 (lazy)

    account_no = (
        getattr(sub_account, 'external_id', '')
        or getattr(sub_account, 'account_number', '')
    )
    found = detect_position_drift(
        ledger_holdings, service.get_positions(account_no))
    created = []
    for item in found:
        created.append(BrokerSyncIssue.objects.create(
            run=run,
            tenant=tenant,
            severity='warning',
            code=item['code'],
            payload={
                'symbol': item['symbol'],
                'ledger_quantity': item['ledger_quantity'],
                'broker_quantity': item['broker_quantity'],
                'portfolio_id': portfolio.pk,
                'sub_account_id': sub_account.pk,
            },
        ))
    return created

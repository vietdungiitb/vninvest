"""
P0-2 — đồng bộ `Transaction` → `LedgerEntry` + `CashFlow` khi ghi qua API.

**Vì sao module này tồn tại.**

`ledger/services.py` đọc hai nguồn khác nhau, và chỉ một nguồn được ghi:

| Thứ | Đọc từ đâu | Được ghi bởi ai ở runtime? |
|---|---|---|
| `holdings`, `cash` (P&L) | `Transaction` (`_queryset`, `services.py:42-47`) | API `views.py` — **có** |
| `cash_flow_total` (NAV) | `CashFlow` (`services.py:348`) | **không ai** |

`0022` backfill một lần lúc deploy, nhưng không có gì ghi tiếp. Hệ quả đo được
ở `services.py:374`: có giao dịch mà `CashFlow` rỗng ⇒ `nav = null` với
`nav_reason='cash_flows_not_backfilled'`. Tức NAV **bị chặn**, không phải sai
âm thầm — đúng fail-closed của LED-03 R5, nhưng nghĩa là `nav` không bao giờ
tính được sau giao dịch đầu tiên.

**Không sửa `ledger/services.py`.** File đó đang được claim `in-progress` của
agent khác (`docs/CLAIMS.md:277`). Module này chỉ **ghi**, không đọc cache.

**Bất biến append-only — vì sao xoá giao dịch không xoá dòng sổ.**

`AppendOnlyMixin.delete()` raise vô điều kiện (`models.py:1004-1008`) và
`migrations/0023_append_only_guards.py` có trigger Postgres chặn `UPDATE`/
`DELETE`. Xoá `LedgerEntry` là vi phạm thiết kế, không phải bug. Nên:

- sửa giao dịch → tạo entry `ADJUSTMENT` trừ dòng cũ (`reversal_of`), rồi ghi
  dòng mới;
- xoá giao dịch → tạo entry `ADJUSTMENT` trừ dòng đang hiệu lực, không ghi
  dòng mới.

Ràng buộc `uniq_ledger_entry_single_reversal` (`models.py:1157-1161`) cho phép
mỗi dòng bị đảo **đúng một lần** ⇒ mỗi lần sửa phải đảo dòng *đang hiệu lực*,
không phải dòng gốc.

**Không dùng cờ `app.allow_ledger_mutation`** (`0023:39`) ở đây. Cờ đó dành cho
migration `0022` chạy một lần; dùng ở runtime để lách trigger là đúng kiểu
lỗi mà wave này sinh ra để diệt.
"""

from decimal import Decimal

from django.db import transaction as db_transaction

from user_workspace.models import CashFlow, LedgerEntry, Transaction

#: Tiền tệ D-05: R1 chỉ VND. Multi-currency defer.
CURRENCY = 'VND'

#: Khoá idempotency. `uniq_ledger_entry_tenant_external_id` chỉ áp cho
#: `external_id != ''`, nên ta luôn ghi khoá có tiền tố để ràng buộc có hiệu lực.
#: Dạng: `tx:<pk>` cho bản đầu, `tx:<pk>:v<n>` cho các bản sau khi sửa.
BASE_EXTERNAL_ID = 'tx:{pk}'
VERSIONED_EXTERNAL_ID = 'tx:{pk}:v{version}'


def _money(value) -> Decimal:
    return Decimal(str(value if value is not None else 0))


def cash_flows_for(transaction):
    """Dòng tiền theo D-06 — cùng luật với `ledger/holdings.py:181,252-256,274`.

    `amount` có dấu: dương = tiền vào, âm = tiền ra. Trả list
    `(flow_type, amount)`.

    - BUY: tiền ra `price*quantity`, cộng phí và thuế (chi phí vốn vào giá).
    - SELL: tiền vào `price*quantity`, trừ phí và thuế (realized P&L đã trừ cả
      hai ở `holdings.py:253`).
    - DIVIDEND: tiền vào `price*quantity` (cổ tức mỗi cổ phiếu × số cổ phiếu
      được trả), trừ phí và thuế.
    """
    gross = _money(transaction.price) * _money(transaction.quantity)
    fee = _money(transaction.fee)
    tax = _money(transaction.tax)
    kind = transaction.transaction_type

    if kind == Transaction.TransactionType.BUY:
        flows = [(CashFlow.FlowType.BUY, -gross)]
    elif kind == Transaction.TransactionType.SELL:
        flows = [(CashFlow.FlowType.SELL, gross)]
    elif kind == Transaction.TransactionType.DIVIDEND:
        flows = [(CashFlow.FlowType.DIVIDEND, gross)]
    else:
        flows = []

    if fee:
        flows.append((CashFlow.FlowType.FEE, -fee))
    if tax:
        flows.append((CashFlow.FlowType.TAX, -tax))
    return flows


def _write_flows(entry, flows):
    for flow_type, amount in flows:
        CashFlow.objects.create(
            entry=entry,
            tenant_id=entry.tenant_id,
            flow_type=flow_type,
            amount=amount,
            currency=CURRENCY,
        )


def active_entry_for(transaction):
    """Dòng sổ cái đang hiệu lực của giao dịch, hoặc `None`.

    "Đang hiệu lực" = dòng có khoá `tx:<pk>` mà chưa bị dòng nào đảo. Các bản
    `v1..vn` cũng xét vì PATCH ghi khoá có phiên bản.
    """
    prefix = f'tx:{transaction.pk}'
    entries = (
        LedgerEntry.objects
        .filter(tenant_id=transaction.tenant_id, portfolio_id=transaction.portfolio_id)
        .filter(external_id__startswith=prefix)
        .order_by('-pk')
        .prefetch_related('reversals')
    )
    for entry in entries:
        # `uniq_ledger_entry_single_reversal` giữ mỗi dòng chỉ bị đảo một lần,
        # nên "có reversal" là đủ để kết luận dòng đó không còn hiệu lực.
        if not entry.reversals.exists():
            return entry
    return None


def _next_version(transaction):
    prefix = f'tx:{transaction.pk}:v'
    return LedgerEntry.objects.filter(
        tenant_id=transaction.tenant_id,
        portfolio_id=transaction.portfolio_id,
        external_id__startswith=prefix,
    ).count() + 1


def _reverse(entry):
    """Đảo một dòng sổ cái bằng dòng `ADJUSTMENT` trừ ngược dòng tiền.

    `LedgerEntry` là sổ chỉ-append nên không xoá/sửa dòng cũ; dòng mới mang
    `reversal_of` trỏ về nó. Các dòng tiền bị đảo dấu nên tổng `CashFlow` của
    portfolio vẫn đúng bằng 0 sau khi đảo trọn vẹn một giao dịch.
    """
    reverse = LedgerEntry.objects.create(
        tenant_id=entry.tenant_id,
        portfolio_id=entry.portfolio_id,
        entry_type=LedgerEntry.EntryType.ADJUSTMENT,
        symbol=entry.symbol,
        trade_date=entry.trade_date,
        quantity=0,
        price=Decimal('0'),
        fee=Decimal('0'),
        tax=Decimal('0'),
        market=entry.market,
        source=LedgerEntry.Source.ADJUSTMENT,
        external_id='',
        reversal_of=entry,
        created_by_id=entry.created_by_id,
    )
    _write_flows(
        reverse,
        [(flow_type, -amount) for flow_type, amount in
         CashFlow.objects.filter(entry=entry).values_list('flow_type', 'amount')],
    )
    return reverse


def _write_entry(transaction, *, actor=None):
    entry = LedgerEntry.objects.create(
        tenant_id=transaction.tenant_id,
        portfolio_id=transaction.portfolio_id,
        entry_type=transaction.transaction_type,
        symbol=str(transaction.symbol or '').strip().upper(),
        trade_date=transaction.date,
        quantity=int(transaction.quantity or 0),
        price=_money(transaction.price),
        fee=_money(transaction.fee),
        tax=_money(transaction.tax),
        market=LedgerEntry.Market.UNKNOWN,
        source=LedgerEntry.Source.MANUAL,
        external_id=BASE_EXTERNAL_ID.format(pk=transaction.pk),
        created_by=actor,
    )
    _write_flows(entry, cash_flows_for(transaction))
    return entry


def sync_transaction_to_ledger(transaction, *, actor=None):
    """Đảm bảo `CashFlow` của giao dịch khớp với `Transaction`.

    Idempotent: gọi lại với giao dịch không đổi thì **không** ghi thêm dòng. Đây
    là yêu cầu của AC — `post_save` bắn cả lần `save()` lặp lại không có thay
    đổi.

    Trả `True` nếu ghi dòng mới, `False` nếu đã khớp.
    """
    if transaction.tenant_id is None or transaction.portfolio_id is None:
        # Không tenant ⇒ `LedgerEntry.tenant` NOT NULL. Bỏ qua thay vì raise:
        # đường ghi `Transaction` cũ vẫn phải hoạt động, còn NAV sẽ bị chặn
        # đúng bằng `nav_reason` thay vì crash.
        return False
    if not str(transaction.symbol or '').strip():
        return False

    flows = cash_flows_for(transaction)
    current = active_entry_for(transaction)
    if current is not None:
        recorded = list(
            CashFlow.objects
            .filter(entry=current)
            .order_by('pk')
            .values_list('flow_type', 'amount')
        )
        if [(f, _money(a)) for f, a in recorded] == flows and (
            current.quantity == int(transaction.quantity or 0)
            and _money(current.price) == _money(transaction.price)
            and _money(current.fee) == _money(transaction.fee)
            and _money(current.tax) == _money(transaction.tax)
        ):
            return False
        # Dữ liệu nguồn đổi: đảo dòng cũ rồi ghi bản mới. Khoá bản mới có phiên
        # bản vì `uniq_ledger_entry_tenant_external_id` không cho trùng khoá.
        _reverse(current)
        entry = LedgerEntry.objects.create(
            tenant_id=transaction.tenant_id,
            portfolio_id=transaction.portfolio_id,
            entry_type=transaction.transaction_type,
            symbol=str(transaction.symbol or '').strip().upper(),
            trade_date=transaction.date,
            quantity=int(transaction.quantity or 0),
            price=_money(transaction.price),
            fee=_money(transaction.fee),
            tax=_money(transaction.tax),
            market=LedgerEntry.Market.UNKNOWN,
            source=LedgerEntry.Source.MANUAL,
            external_id=VERSIONED_EXTERNAL_ID.format(
                pk=transaction.pk, version=_next_version(transaction),
            ),
            created_by=actor,
        )
        _write_flows(entry, flows)
        return True

    _write_entry(transaction, actor=actor)
    return True


def reverse_transaction_from_ledger(transaction, *, actor=None):
    """Đảo dòng sổ cái khi giao dịch bị xoá. Không xoá dòng nào."""
    if transaction.tenant_id is None or transaction.portfolio_id is None:
        return False
    current = active_entry_for(transaction)
    if current is None:
        return False
    _reverse(current)
    return True


@db_transaction.atomic
def sync_transaction_on_save(transaction, *, actor=None):
    try:
        return sync_transaction_to_ledger(transaction, actor=actor)
    except Exception:  # noqa: BLE001
        # Đường ghi `Transaction` phải sống sót. NAV sẽ bị chặn bằng
        # `nav_reason` thay vì trả số sai — đó là hành vi an toàn hơn là làm
        # hỏng việc ghi giao dịch chỉ vì sổ cái lỗi.
        import logging
        logging.getLogger(__name__).error(
            'sync_transaction_to_ledger failed for transaction pk=%s',
            getattr(transaction, 'pk', None), exc_info=True,
        )
        return False


@db_transaction.atomic
def reverse_transaction_on_delete(transaction, *, actor=None):
    try:
        return reverse_transaction_from_ledger(transaction, actor=actor)
    except Exception:  # noqa: BLE001
        import logging
        logging.getLogger(__name__).error(
            'reverse_transaction_from_ledger failed for transaction pk=%s',
            getattr(transaction, 'pk', None), exc_info=True,
        )
        return False
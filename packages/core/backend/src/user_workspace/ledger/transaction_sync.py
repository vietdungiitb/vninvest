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

---

## Khoá `external_id` — phải trùng lược đồ của `0022`

Migration `0022` đã dựng sẵn cột `external_id` cho mọi giao dịch tồn tại:

    source_ref = str(tx.external_id or '').strip() or f'manual:tx:{tx.pk}'
    # migrations/0022_backfill_transaction_to_ledger.py:105

Module này dùng **đúng biểu thức đó**. Lý do — bản đầu của module tự sinh
khoá `tx:<pk>` riêng, tạo ra namespace **rời** với `0022`:

- `0022` đã ghi `brk-1` (giao dịch có mã broker) hoặc `manual:tx:7` (nhập tay)
- module tìm `tx:7` ⇒ không thấy ⇒ ghi thêm một dòng nữa
- ⇒ `CashFlow` bị **đếm trùng**, `nav` sai, và `nav_reason` rỗng tức hệ
  thống trả số sai một cách tự tin không cảnh báo.

Tái hiện được: 1 giao dịch backfill + 1 lần `save()` không đổi ⇒ tổng
`CashFlow` bằng **hai lần** số tiền thật.

Bản sửa cũng bỏ việc so khớp bằng `startswith` trần: `'tx:59'.startswith('tx:5')`
là `True`, nên với portfolio hơn 50 giao dịch, sửa giao dịch pk=5 sẽ đảo nhầm
dòng sổ của pk=59. Dấu phân cách `:v` trong `f'{ref}:v{n}'` khiến
`'tx:59:v1'.startswith('tx:5:v')` là `False` — phải có cả hai dấu `:`.

## Bất biến append-only — vì sao xoá giao dịch không xoá dòng sổ

`AppendOnlyMixin.delete()` raise vô điều kiện (`models.py:1004-1008`) và
`migrations/0023_append_only_guards.py` có trigger Postgres chặn `UPDATE`/
`DELETE`. Xoá `LedgerEntry` là vi phạm thiết kế, không phải bug. Nên:

- sửa giao dịch → tạo entry `ADJUSTMENT` trừ dòng cũ (`reversal_of`), rồi ghi
  dòng mới với khoá `f'{ref}:v{n}'`;
- xoá giao dịch → tạo entry `ADJUSTMENT` trừ dòng đang hiệu lực, không ghi
  dòng mới.

Ràng buộc `uniq_ledger_entry_single_reversal` (`models.py:1157-1161`) cho phép
mỗi dòng bị đảo **đúng một lần** ⇒ mỗi lần sửa phải đảo dòng *đang hiệu lực*,
không phải dòng gốc.

**Không dùng cờ `app.allow_ledger_mutation`** (`0023:39`). Cờ đó dành cho
migration `0022` chạy một lần; dùng ở runtime để lách trigger là đúng kiểu lỗi
mà wave này sinh ra để diệt.

## Sai số có chủ đích

`cash_flows_for` ghi **toàn bộ** số tiền broker thực sự chuyển, kể cả phần bán
vượt số lượng đang giữ. `ledger/holdings.py:215,250-256` chỉ ghi nhận phần có
cost basis (`min(qty, position.quantity)`). Hai con số **cố ý lệch nhau** và
`services.py:263-278` mô tả đúng trường hợp này: phần chênh là tiền đang chờ
đối soát, và `cash_cross_check` là cơ chế bắt. Vì vậy ở đây **không** cắt theo
`sellable` — cắt sẽ làm mất thông tin đối soát.
"""

import logging
from decimal import Decimal

from django.db import transaction as db_transaction
from django.db.models import Q

from user_workspace.models import CashFlow, LedgerEntry, Transaction

logger = logging.getLogger(__name__)

#: Tiền tệ D-05: R1 chỉ VND. Multi-currency defer.
CURRENCY = 'VND'

#: Trùng `0022` (`migrations/0022_backfill_transaction_to_ledger.py:47`). Giữ
#: hằng số riêng thay vì import từ migration: import module migration sẽ kéo
#: `django.db.migrations` vào runtime.
MANUAL_REF_PREFIX = 'manual:tx:'

#: Hậu tố phiên bản, có dấu phân cách rõ ràng — xem mục "Bất biến" ở trên.
VERSION_SEPARATOR = ':v'


def _money(value) -> Decimal:
    return Decimal(str(value if value is not None else 0)).quantize(Decimal('0.01'))


def source_ref_for(transaction) -> str:
    """Khoá `external_id` của giao dịch — **phải trùng `0022:105`**."""
    broker_ref = str(transaction.external_id or '').strip()
    return broker_ref or f'{MANUAL_REF_PREFIX}{transaction.pk}'


def _versioned_ref(ref: str, version: int) -> str:
    return f'{ref}{VERSION_SEPARATOR}{version}'


def cash_flows_for(transaction):
    """Dòng tiền theo D-06 — cùng luật với `ledger/holdings.py`.

    `amount` có dấu: dương = tiền vào, âm = tiền ra.

    `quantity <= 0` thì bỏ **trọn** giao dịch, kể cả phí và thuế — khớp
    `holdings.py:167-176`, vốn phát ra `non_positive_quantity` rồi `continue`
    trước khi chạm phí/thuế. Ghi phí cho một lệnh không khớp có vị thế là dữ
    liệu bịa, và `cash_cross_check` sẽ báo động vô nghĩa.

    Ghi toàn bộ số lượng bán, không cắt theo vị thế đang giữ: xem mục
    "Sai số có chủ đích".
    """
    quantity = _money(transaction.quantity)
    kind = transaction.transaction_type
    if quantity <= 0:
        return []

    gross = _money(transaction.price) * quantity
    fee = _money(transaction.fee)
    tax = _money(transaction.tax)

    if kind == Transaction.TransactionType.BUY:
        flows = [(CashFlow.FlowType.BUY, -gross)]
    elif kind == Transaction.TransactionType.SELL:
        flows = [(CashFlow.FlowType.SELL, gross)]
    elif kind == Transaction.TransactionType.DIVIDEND:
        flows = [(CashFlow.FlowType.DIVIDEND, gross)]
    else:
        return []

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


def _entries_for_ref(transaction, ref):
    """Mọi dòng sổ cái thuộc giao dịch này.

    `startswith(f'{ref}{VERSION_SEPARATOR}')` chứ KHÔNG dùng `startswith(ref)`:
    với `ref = 'tx:5'`, biểu thức thứ hai khớp luôn `'tx:59'` và `'tx:50:v1'`.
    """
    return LedgerEntry.objects.filter(
        tenant_id=transaction.tenant_id,
        portfolio_id=transaction.portfolio_id,
    ).filter(
        Q(external_id=ref) | Q(external_id__startswith=f'{ref}{VERSION_SEPARATOR}')
    )


def active_entry_for(transaction):
    """Dòng sổ cái đang hiệu lực của giao dịch, hoặc `None`.

    "Đang hiệu lực" = dòng có khoá `ref` hoặc `ref:v<n>` mà chưa bị dòng nào đảo.
    `uniq_ledger_entry_single_reversal` giữ mỗi dòng chỉ bị đảo một lần, nên
    "có reversal" là đủ để kết luận dòng đó không còn hiệu lực.
    """
    for entry in _entries_for_ref(transaction, source_ref_for(transaction)).order_by('-pk'):
        if not entry.reversals.exists():
            return entry
    return None


def _next_version(transaction, ref):
    prefix = f'{ref}{VERSION_SEPARATOR}'
    return _entries_for_ref(transaction, ref).filter(
        external_id__startswith=prefix,
    ).count() + 1


def _reverse(entry, *, actor=None):
    """Đảo một dòng sổ cái bằng dòng `ADJUSTMENT` trừ ngược dòng tiền."""
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
        created_by_id=entry.created_by_id or getattr(actor, 'pk', None),
    )
    _write_flows(
        reverse,
        [(flow_type, -amount) for flow_type, amount in
         CashFlow.objects.filter(entry=entry).values_list('flow_type', 'amount')],
    )
    return reverse


def _write_entry(transaction, ref, *, actor=None):
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
        external_id=ref,
        created_by=actor,
    )
    _write_flows(entry, cash_flows_for(transaction))
    return entry


def _matches_current_data(entry, transaction, flows):
    return (
        entry.quantity == int(transaction.quantity or 0)
        and _money(entry.price) == _money(transaction.price)
        and _money(entry.fee) == _money(transaction.fee)
        and _money(entry.tax) == _money(transaction.tax)
        and [(f, _money(a)) for f, a in
             CashFlow.objects.filter(entry=entry).order_by('pk')
             .values_list('flow_type', 'amount')] == flows
    )


def sync_transaction_to_ledger(transaction, *, actor=None):
    """Đảm bảo `CashFlow` của giao dịch khớp với `Transaction`.

    Idempotent: gọi lại với giao dịch không đổi thì **không** ghi thêm dòng —
    kể cả khi dòng đã có sẵn từ migration `0022`.

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
    ref = source_ref_for(transaction)
    current = active_entry_for(transaction)
    if current is not None and _matches_current_data(current, transaction, flows):
        return False

    if current is not None:
        # Dữ liệu nguồn đổi: đảo dòng cũ rồi ghi bản mới. Khoá bản mới có phiên
        # bản vì `uniq_ledger_entry_tenant_external_id` không cho trùng khoá.
        _reverse(current, actor=actor)
        _write_entry(transaction, _versioned_ref(ref, _next_version(transaction, ref)),
                     actor=actor)
    else:
        _write_entry(transaction, ref, actor=actor)
    return True


def reverse_transaction_from_ledger(transaction, *, actor=None):
    """Đảo dòng sổ cái khi giao dịch bị xoá. Không xoá dòng nào."""
    if transaction.tenant_id is None or transaction.portfolio_id is None:
        return False
    current = active_entry_for(transaction)
    if current is None:
        return False
    _reverse(current, actor=actor)
    return True


def _run_isolated(operation, transaction, *, actor=None):
    """Chạy phần ghi sổ cái trong **savepoint riêng**.

    Bản đầu bọc `@atomic` ở **ngoài** `try/except`. Exception bị nuốt bên trong
    khối atomic nên `atomic.__exit__` tưởng thành công và đi `COMMIT` — nhưng
    PostgreSQL đã hủy transaction nên `COMMIT` ném lỗi, kéo theo **rollback
    cả bản ghi `Transaction` hợp lệ của người dùng**. Đó là biến lỗi sổ cái
    thành mất giao dịch, đúng cái docstring cũ nói là không được.

    Ở đây `atomic` nằm **bên trong** `try`: lỗi rollback savepoint, `except`
    bắt được, transaction ngoài vẫn sống.
    """
    try:
        with db_transaction.atomic():
            return operation(transaction, actor=actor)
    except Exception:
        # Đường ghi `Transaction` phải sống sót. NAV sẽ bị chặn bằng
        # `nav_reason` thay vì trả số sai — đó là hành vi an toàn hơn là làm
        # hỏng việc ghi giao dịch chỉ vì sổ cái lỗi.
        logger.error(
            'ledger sync failed for transaction pk=%s',
            getattr(transaction, 'pk', None), exc_info=True,
        )
        return False


def sync_transaction_on_save(transaction, *, actor=None):
    return _run_isolated(sync_transaction_to_ledger, transaction, actor=actor)


def reverse_transaction_on_delete(transaction, *, actor=None):
    return _run_isolated(reverse_transaction_from_ledger, transaction, actor=actor)
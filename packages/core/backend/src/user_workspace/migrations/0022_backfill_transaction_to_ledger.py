"""
LED-05 — **BACKFILL** phase: `Transaction` → `LedgerEntry` + `CashFlow`.

Đây là phase thứ 2 trong 5 phase của D-24. `0021` đã làm phase expand.
Những gì phase này **không** làm, và vì sao:

- **Không** `NOT NULL` hóa / đổi tên / xoá bảng `Transaction` (contract phase).
  Contract chỉ chạy khi verify = 0 lệch **trên bản sao DB có dữ liệu thật**,
  không phải trên DB rỗng. Chạy contract trên DB rỗng là cách kinh điển để
  mất dữ liệu.
- **Không** sửa dòng `Transaction` nào. Dữ liệu cũ giữ nguyên để đối chiếu.

Nguyên tắc bắt buộc cho file này:

1. **KHÔNG `print()` có dấu.** `UnicodeEncodeError` trên cp1252 đã làm
   `migrate` fail giữa chừng một lần thật (ghi ở AGENTS.md). Dùng `logger`.
2. **Đếm trước, đếm sau, ghi lại cả hai.** Số 0 mà không có mốc đối chiếu thì
   không phải bằng chứng.
3. **Row nào không map được thì đếm và ghi log, không bỏ qua im lặng**
   (LED-05 PB2). Dòng không map được là câu hỏi cho con người, không phải thứ
   để xoá.
4. **Reverse chỉ revert row do chính migration này tạo**, nhận diện bằng
   marker `backfilled_by` (D-24). Dòng `LedgerEntry` người dùng tạo tay từ
   sau migration này không bị đụng.
"""
import logging
from decimal import Decimal

from django.db import migrations

logger = logging.getLogger('user_workspace.migrations')

#: Marker ghi vào mọi row do migration này tạo. Reverse chỉ xoá row mang
#: đúng chuỗi này.
BACKFILL_MARKER = '0022_backfill_transaction_to_ledger'

#: Ngưỡng "quá nhiều dòng hỏng" ⇒ coi như backfill lỗi và raise, thay vì để
#: migration "thành công" với dữ liệu thiếu. Một danh mục có vài chục dòng
#: không map được là chuyện bình thường; hàng nghìn là chuyện khác.
UNMAPPABLE_RATIO_LIMIT = 0.05


def _money(value):
    return Decimal(str(value if value is not None else 0)).quantize(Decimal('0.01'))


def _normalise_symbol(symbol):
    return str(symbol or '').strip().upper()


def forwards(apps, schema_editor):
    """`Transaction` → `LedgerEntry` + `CashFlow`, 1 transaction = 1 entry."""
    Transaction = apps.get_model('user_workspace', 'Transaction')
    LedgerEntry = apps.get_model('user_workspace', 'LedgerEntry')
    CashFlow = apps.get_model('user_workspace', 'CashFlow')

    queryset = Transaction.objects.all().order_by('pk')
    total = queryset.count()
    logger.info('LED-05 backfill: bat dau, %s transaction', total)

    entries = []
    flows = []
    unmapped = []
    entries_by_tx = {}

    for tx in queryset.iterator(chunk_size=500):
        symbol = _normalise_symbol(tx.symbol)
        kind = tx.transaction_type
        quantity = tx.quantity or 0
        price = _money(tx.price)
        fee = _money(tx.fee)
        tax = _money(tx.tax)

        # PB2: đếm dòng không map được, đừng bỏ qua im lặng.
        if not symbol:
            unmapped.append((tx.pk, 'missing_symbol'))
            continue
        if kind not in ('BUY', 'SELL', 'DIVIDEND'):
            unmapped.append((tx.pk, f'unknown_type:{kind}'))
            continue
        if quantity is None or quantity <= 0:
            unmapped.append((tx.pk, f'non_positive_quantity:{quantity}'))
            continue

        entry = LedgerEntry(
            tenant_id=tx.tenant_id,
            portfolio_id=tx.portfolio_id,
            entry_type=kind,
            symbol=symbol,
            trade_date=tx.date,
            quantity=quantity,
            price=price,
            fee=fee,
            tax=tax,
            # Chưa biết thị trường thì để UNKNOWN: validator sẽ cảnh báo
            # `market_unknown` thay vì ép lô 100 cho dữ liệu không đủ căn cứ.
            market='UNKNOWN',
            source='backfill',
            # `external_id` giữ nguyên (chỉ `strip`) ⇒ UNIQUE
            # (tenant, external_id) làm backfill idempotent: chạy lại migration
            # không nhân bản.
            #
            # KHÔNG uppercase `external_id`. Mã tham chiếu broker là chuỗi do
            # hệ thống bên thứ ba sinh ra; `abc-1` và `ABC-1` là hai giao dịch
            # khác nhau và việc gộp chúng sẽ âm thầm nuốt một dòng sổ cái.
            # Chuẩn hoá case chỉ áp cho `symbol`.
            external_id=str(tx.external_id or '').strip(),
            backfilled_by=BACKFILL_MARKER,
        )
        entries.append(entry)
        entries_by_tx[tx.pk] = entry

        # D-06: mỗi entry tạo đúng một dòng tiền đã ký.
        if kind == 'BUY':
            # tiền ra = -(giá × số lượng + phí + thuế)
            flows.append((entry, 'BUY', -(price * quantity + fee + tax)))
        elif kind == 'SELL':
            # tiền vào = +(giá × số lượng) − phí − thuế
            flows.append((entry, 'SELL', price * quantity - fee - tax))
        else:  # DIVIDEND
            flows.append((entry, 'DIVIDEND', price * quantity - fee - tax))

    created_entries = LedgerEntry.objects.bulk_create(entries, batch_size=500)
    created_flows = [
        CashFlow(entry=entry, tenant_id=entry.tenant_id, flow_type=kind, amount=amount)
        for entry, kind, amount in flows
    ]
    CashFlow.objects.bulk_create(created_flows, batch_size=500)

    if unmapped:
        ratio = len(unmapped) / total if total else 0
        logger.warning(
            'LED-05 backfill: %s/%s dong khong map duoc (%.2f%%). Ly do: %s',
            len(unmapped), total, ratio * 100,
            sorted({reason for _pk, reason in unmapped}),
        )
        if total and ratio > UNMAPPABLE_RATIO_LIMIT:
            raise RuntimeError(
                f'LED-05 backfill: {len(unmapped)}/{total} dong khong map duoc '
                f'(> {UNMAPPABLE_RATIO_LIMIT:.0%}). Dung migration thay vi lam '
                f'du lieu mat. Chi tiet trong log migration.'
            )

    # ── verify: đếm lại, không tin số đếm ở trên ──────────────────────
    entry_count = LedgerEntry.objects.filter(backfilled_by=BACKFILL_MARKER).count()
    flow_count = CashFlow.objects.filter(entry__backfilled_by=BACKFILL_MARKER).count()
    logger.info(
        'LED-05 backfill: xong. transaction=%s ledger_entry=%s cash_flow=%s '
        'unmapped=%s', total, entry_count, flow_count, len(unmapped),
    )

    if entry_count != len(entries):
        raise RuntimeError(
            f'LED-05 verify FAIL: ghi {len(entries)} LedgerEntry nhung doc lai '
            f'{entry_count}. Dung phase tiep theo.'
        )


def backwards(apps, schema_editor):
    """Chỉ xoá row do chính migration này tạo (D-24)."""
    LedgerEntry = apps.get_model('user_workspace', 'LedgerEntry')
    CashFlow = apps.get_model('user_workspace', 'CashFlow')

    marked = LedgerEntry.objects.filter(backfilled_by=BACKFILL_MARKER)
    entry_count = marked.count()
    flow_count = CashFlow.objects.filter(entry__backfilled_by=BACKFILL_MARKER).count()
    # `CashFlow` cascade theo `entry`, nhưng xoá tường minh để con số log khớp.
    CashFlow.objects.filter(entry__backfilled_by=BACKFILL_MARKER).delete()
    marked.delete()
    logger.info(
        'LED-05 backfill: rollback, da xoa %s LedgerEntry va %s CashFlow '
        '(chi dong co marker %s)', entry_count, flow_count, BACKFILL_MARKER,
    )


class Migration(migrations.Migration):

    dependencies = [
        ('user_workspace', '0021_portfolio_opening_balance_and_more'),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]

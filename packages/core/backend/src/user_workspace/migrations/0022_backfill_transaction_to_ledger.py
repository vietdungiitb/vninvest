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

#: Tiền tố cho `external_id` tự sinh của giao dịch **nhập tay** (nguồn không có
#: mã tham chiếu).
#:
#: Vì sao phải có tiền tố riêng, không dùng trần `tx-<pk>`: broker gửi
#: `order_id`/`orderId`/`deal_id` là chuỗi tùy ý bên thứ ba
#: (`tasks.py:332`). Nếu ta dùng `tx-123` thì một mã broker tình cờ trùng
#: sẽ đụng UNIQUE `(tenant, external_id)` và làm migration abort bằng
#: `IntegrityError` mù — tứ biến một sự cố chất lượng dữ liệu thành lỗi không
#: truy vết được. Với namespace riêng, va chạm gần như không thể; mà nếu vẫn
#: xảy ra thì thông báo lỗi của `backwards`/`forwards` có tên.
MANUAL_REF_PREFIX = 'manual:tx:'

#: Dau phan cach phien ban - **phai trung** `ledger/transaction_sync.py`
#: (`VERSION_SEPARATOR`). Ref co phien ban la `ref:v<n>`, sinh ra khi du lieu
#: nguon doi va ban cu bi dao bang `ADJUSTMENT`.
VERSION_SEPARATOR = ':v'


def _money(value):
    return Decimal(str(value if value is not None else 0)).quantize(Decimal('0.01'))


def _normalise_symbol(symbol):
    return str(symbol or '').strip().upper()


def _existing_refs(entries):
    """Tap `(tenant_id, ref)` da co trong so cai.

    **Vi sao migration nay can buoc nay.** `ledger/transaction_sync.py`
    (`sync_transaction_to_ledger`, them o `d7226a591` P0-2) ghi `LedgerEntry`
    **moi lan `Transaction` duoc luu**. Nen mot giao dich duoc tao *sau khi
    ung dung da chay* thi da co dong so cai roi. Ban `forwards()` dau tien
    `bulk_create` ma khong hoi => ghi 2 lan => dung
    `uniq_ledger_entry_tenant_external_id` => **ca migration abort**.

    Day khong phai rui ro hoc thuyet: no lam hong 10 test trong
    `tests/test_ledger_migration_backfill.py` (`roll back -> 0021 -> tao du lieu
    -> chay lai 0022`), va bat ky lan rollback-thiet-lap-lai nao tren DB that.

    Nap **mot lan** thay vi query moi dong - `bulk_create` phia sau van la 1
    lenh, khong muon them N round-trip chi de hoi "da co chua".

    Phien ban `ref:v<n>` duoc quy ve `ref` vi chung la cung mot giao dich
    (xem `active_entry_for` trong `transaction_sync.py`).
    """
    refs = set()
    rows = entries.exclude(external_id='').values_list(
        'tenant_id', 'external_id')
    for tenant_id, external_id in rows:
        refs.add((tenant_id, external_id))
        head, sep, _tail = external_id.rpartition(VERSION_SEPARATOR)
        if sep and head:
            refs.add((tenant_id, head))
    return refs


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
    already_synced = []

    # Giao dich nao da co dong so cai thi KHONG ghi lan nua - xem `_existing_refs`.
    existing_refs = _existing_refs(LedgerEntry.objects)
    if existing_refs:
        logger.info(
            'LED-05 backfill: %s ref da ton tai trong so cai (sync P0-2 se co '
            'san), se bo qua de tranh ghi trung', len(existing_refs),
        )

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

        # `external_id` phải **ổn định và duy nhất theo nguồn**, nếu không
        # chạy lại migration sẽ nhân bản dữ liệu tài chính.
        #
        # Giao dịch tay (`external_id=''`) trước đây được để rỗng — mà rỗng
        # thì UNIQUE constraint cố ý bỏ qua ⇒ mỗi lần chạy lại là một bản ghi
        # trùng. Sửa: dùng `MANUAL_REF_PREFIX + pk` khi nguồn không có mã tham
        # chiếu. `pk` là ổn định và `external_id` chỉ cần khác nhau trong phạm
        # vi tenant.
        #
        # KHÔNG uppercase `external_id`. Mã tham chiếu broker là chuỗi do hệ
        # thống bên thứ ba sinh ra; `abc-1` và `ABC-1` là hai giao dịch khác nhau
        # và việc gộp chúng sẽ âm thầm nuốt một dòng sổ cái. Chuẩn hoá case
        # chỉ áp cho `symbol`.
        source_ref = str(tx.external_id or '').strip() or f'{MANUAL_REF_PREFIX}{tx.pk}'

        # Da co san dong so cai cho giao dich nay (xem `_existing_refs`).
        # Ghi de la sai - va con lam ABORT ca migration, khong chi sai so lieu.
        if (tx.tenant_id, source_ref) in existing_refs:
            already_synced.append(tx.pk)
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
            external_id=source_ref,
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

    # ── DỪNG TRƯỚC KHI GHI ────────────────────────────────────────────
    #
    # Bản đầu `bulk_create` xong MỚI kiểm rồi mới raise. An toàn chỉ vì Django
    # bọc `RunPython` trong transaction, tức tính đúng đắn nằm ở framework chứ
    # không nằm trong code này. Đưa kiểm lên trước để điều đó không phụ thuộc
    # vào một chi tiết của Django — và để log không bao giờ ghi "đã ghi N dòng"
    # cho một lần chạy thất bại.
    if unmapped:
        reasons = sorted({reason for _pk, reason in unmapped})
        raise RuntimeError(
            f'LED-05 backfill: {len(unmapped)}/{total} dong khong map duoc '
            f'({reasons[:8]}). Migration dung lai, CHUA ghi gi vao ledger. '
            f'Truy viet bang: SELECT pk, symbol, transaction_type, quantity '
            f'FROM user_workspace_transaction '
            f'WHERE TRIM(symbol) = "" OR quantity <= 0 '
            f'OR transaction_type NOT IN ('
            f'"BUY","SELL","DIVIDEND");'
        )

    created_entries = LedgerEntry.objects.bulk_create(entries, batch_size=500)
    created_flows = [
        CashFlow(entry=entry, tenant_id=entry.tenant_id, flow_type=kind, amount=amount)
        for entry, kind, amount in flows
    ]
    CashFlow.objects.bulk_create(created_flows, batch_size=500)

    # ── verify: đếm lại, không tin số đếm ở trên ──────────────────────
    entry_count = LedgerEntry.objects.filter(backfilled_by=BACKFILL_MARKER).count()
    flow_count = CashFlow.objects.filter(entry__backfilled_by=BACKFILL_MARKER).count()
    logger.info(
        'LED-05 backfill: xong. transaction=%s ledger_entry=%s cash_flow=%s '
        'unmapped=%s da_co_san=%s', total, entry_count, flow_count, len(unmapped),
        len(already_synced),
    )

    # Chi so voi phan migration nay **tu ghi**. Dong `already_synced` khong co
    # marker nen nam ngoai `entry_count` - neu so voi `total` thi backfill
    # dung 100% cung bi coi la FAIL.
    if entry_count != len(entries):
        raise RuntimeError(
            f'LED-05 verify FAIL: ghi {len(entries)} LedgerEntry nhung doc lai '
            f'{entry_count}. Dung phase tiep theo.'
        )


def backwards(apps, schema_editor):
    """Chỉ xoá row do chính migration này tạo (D-24).

    **Và dừng lại nếu có row hậu-migration phụ thuộc vào chúng.** Bản đầu xoá
    theo marker một cách mù quáng, gây ra 2 lỗi:

    1. Một entry `ADJUSTMENT`/`REVERSAL` viết **sau** migration không mang marker
       nên nó sống sót, còn `CashFlow` của nó bị xoá theo cascade ⇒ còn entry
       không có dòng tiền nào.
    2. `reversal_of` là `PROTECT`, nên một `ADJUSTMENT` trỏ tới dòng backfill
       làm `delete()` ném `ProtectedError` ⇒ **rollback không hoàn tất**, DB ở
       trạng thái nửa vời.

    Dừng sớm với thông báo rõ ràng tốt hơn một rollback chết giữa chừng.
    """
    LedgerEntry = apps.get_model('user_workspace', 'LedgerEntry')
    CashFlow = apps.get_model('user_workspace', 'CashFlow')

    dependents = LedgerEntry.objects.filter(
        reversal_of__backfilled_by=BACKFILL_MARKER,
    ).exclude(backfilled_by=BACKFILL_MARKER)
    dependent_ids = list(dependents.values_list('pk', flat=True))
    if dependent_ids:
        raise RuntimeError(
            f'LED-05 rollback: {len(dependent_ids)} entry viet SAU migration '
            f'(ADJUSTMENT/REVERSAL) dang tro toi dong backfill. Xoá hoac chuyen '
            f'sang entry ADJUSTMENT rieng truoc khi rollback. pk: '
            f'{dependent_ids[:10]}'
        )

    marked = LedgerEntry.objects.filter(backfilled_by=BACKFILL_MARKER)
    entry_count = marked.count()
    flow_count = CashFlow.objects.filter(entry__backfilled_by=BACKFILL_MARKER).count()
    # `CashFlow` cascade theo `entry`, nhưng xoá tường minh để con số log khớp.
    # `SET LOCAL` KHÔNG PHẢI `SET`.
    #
    # `SET` đặt cờ cho cả **session**; Postgres KHÔNG hoàn tác nó khi
    # `ROLLBACK`. Nên nếu `marked.delete()` ném lỗi, `finally` chạy trên một
    # transaction đã hỏng, lệnh `SET ... = 'off'` bị từ chối
    # (`InFailedSqlTransaction`), và cờ **kẹt ở `'on'`**. Với
    # `CONN_MAX_AGE=60` (settings.py) connection đó được tái dùng cho các
    # request sau — tức trigger append-only và trigger tenant-match tắt
    # trong một phút, không ai biết.
    #
    # `SET LOCAL` gắn cờ vào transaction nên `COMMIT` hay `ROLLBACK` đều trả
    # về mặc định. Đã kiểm chứng trên Postgres: `BEGIN; SET ...; ROLLBACK;`
    # vẫn để lại `'on'`, còn `SET LOCAL` + `ROLLBACK` thì không.
    with schema_editor.connection.cursor() as cursor:
        cursor.execute("SET LOCAL app.allow_ledger_mutation = 'on'")
    try:
        CashFlow.objects.filter(entry__backfilled_by=BACKFILL_MARKER).delete()
        marked.delete()
    finally:
        # `SET LOCAL` nằm trong transaction, nên cả nhánh lỗi lẫn nhánh thành
        # công đều tự trả cờ về mặc định. Vẫn set lại cho rõ ý định, và dùng
        # `set_config(..., is_local=true)` vì `SET LOCAL` sẽ lỗi nếu
        # transaction đã hỏng.
        with schema_editor.connection.cursor() as cursor:
            cursor.execute(
                "SELECT set_config('app.allow_ledger_mutation', 'off', true)")
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

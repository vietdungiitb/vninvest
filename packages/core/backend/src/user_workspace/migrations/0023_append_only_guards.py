"""
LED-01/02/03 — lớp phòng thủ thứ hai cho append-only + sửa schema NAV.

Migration này sinh ra từ một review độc lập, không phải từ kế hoạch ban đầu.
Ghi lại vì sao vì đó là câu hỏi reviewer sẽ hỏi đầu tiên.

**Vấn đề 1 — bảo vệ append-only ở tầng Python là không đủ.**
Bản đầu chặn trong `Model.save()`/`Model.delete()`. Đã bị lách thật, không
phải giả định:

- `LedgerEntry(pk=<pk đã tồn tại>).save()` — truyền PK vào constructor thì
  Django đặt `_state.adding = True`, nên `save()` chạy `UPDATE` và ghi đè dòng
  đã commit.
- `queryset.update()` / `queryset.delete()` — không đi qua `Model.save()`.
- `bulk_update()`, raw SQL, cascade từ `portfolio.delete()`.

⇒ Thêm **trigger** Postgres chặn `UPDATE`/`DELETE`. Trigger là lớp duy nhất
sống sót qua `update()` và raw SQL. Ngoại lệ duy nhất: các phase backfill/
rollback của chính migration này được phép đặt cờ `app.allow_ledger_mutation`.

**Vấn đề 2 — `ValuationSnapshot.stock_value/cash` NOT NULL DEFAULT 0.**
`nav` nullable đúng, nhưng tới ngày không định giá được, schema chỉ còn một
đáp án hợp lệ và đó là con số 0 bịa. Cho nullable.

**Vấn đề 3 — `tenant != portfolio.tenant` là ràng buộc qua hai bảng.**
Django không thể biểu diễn, nên thêm trigger so khớp hai cột.

Lưu ý bài học đã gặp: KHÔNG dùng `print()` có dấu trong migration — dùng
`logger`. Và không sửa migration đã apply (`0021`..`0023` là file mới).
"""
import logging

from django.db import migrations, models

logger = logging.getLogger('user_workspace.migrations')

#: Cờ phiên cho phép sửa/xoá bảng append-only. Migration backfill/rollback và
#: lệnh quản trị dùng nó. Không dùng ngoài đó.
GUARD_SETTING = 'app.allow_ledger_mutation'

_APPEND_ONLY_TABLES = (
    'user_workspace_ledgerentry',
    'user_workspace_positionsnapshot',
    'user_workspace_valuationsnapshot',
)


def _guard_sql():
    """SQL tạo trigger. Sinh theo bảng để không lặp 3 bản giống hệt nhau."""
    statements = []

    # Định nghĩa hàm check tenant TRƯỚC: trigger `tenant_match` tham chiếu nó.
    statements.append("""
CREATE OR REPLACE FUNCTION user_workspace_check_tenant_matches_portfolio()
RETURNS trigger AS $$
DECLARE
    portfolio_tenant bigint;
BEGIN
    IF NEW.portfolio_id IS NULL OR NEW.tenant_id IS NULL THEN
        RETURN NEW;
    END IF;
    SELECT tenant_id INTO portfolio_tenant
    FROM user_workspace_portfolio WHERE id = NEW.portfolio_id;
    IF portfolio_tenant IS NOT NULL AND portfolio_tenant <> NEW.tenant_id THEN
        RAISE EXCEPTION
            'user_workspace: tenant % khong khop tenant % cua danh muc %',
            NEW.tenant_id, portfolio_tenant, NEW.portfolio_id
            USING ERRCODE = 'restrict_violation';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
""")

    for table in _APPEND_ONLY_TABLES:
        name = table.rsplit('_', 1)[-1]
        statements.append(f"""
CREATE OR REPLACE FUNCTION user_workspace_block_{name}_mutation()
RETURNS trigger AS $$
BEGIN
    IF current_setting('{GUARD_SETTING}', true) = 'on' THEN
        RETURN OLD;
    END IF;
    RAISE EXCEPTION
        'user_workspace: {table} la bang append-only, UPDATE/DELETE bi chan (LED-01 R2).'
        USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;
""")
        for op in ('UPDATE', 'DELETE'):
            trigger = f'user_workspace_{name}_no_{op.lower()}'
            statements.append(f"DROP TRIGGER IF EXISTS {trigger} ON {table};\n")
            statements.append(f"""
CREATE TRIGGER {trigger}
BEFORE {op} ON {table}
FOR EACH ROW EXECUTE FUNCTION user_workspace_block_{name}_mutation();
""")
        statements.append(
            f"DROP TRIGGER IF EXISTS user_workspace_{name}_tenant_match ON {table};\n")
        statements.append(f"""
CREATE TRIGGER user_workspace_{name}_tenant_match
BEFORE INSERT OR UPDATE ON {table}
FOR EACH ROW EXECUTE FUNCTION user_workspace_check_tenant_matches_portfolio();
""")
    return statements


def _drop_sql():
    statements = []
    for table in _APPEND_ONLY_TABLES:
        name = table.rsplit('_', 1)[-1]
        statements.append(
            f'DROP TRIGGER IF EXISTS user_workspace_{name}_no_update ON {table};')
        statements.append(
            f'DROP TRIGGER IF EXISTS user_workspace_{name}_no_delete ON {table};')
        statements.append(
            f'DROP TRIGGER IF EXISTS user_workspace_{name}_tenant_match ON {table};')
        statements.append(
            f'DROP FUNCTION IF EXISTS user_workspace_block_{name}_mutation();')
    statements.append(
        'DROP FUNCTION IF EXISTS user_workspace_check_tenant_matches_portfolio();')
    return statements


def apply_sql(apps, schema_editor):
    with schema_editor.connection.cursor() as cursor:
        for statement in _guard_sql():
            cursor.execute(statement)
    logger.info(
        'LED append-only: da tao trigger UPDATE/DELETE + tenant-match cho %s bang',
        len(_APPEND_ONLY_TABLES),
    )


def drop_sql(apps, schema_editor):
    with schema_editor.connection.cursor() as cursor:
        for statement in _drop_sql():
            cursor.execute(statement)
    logger.info('LED append-only: da go trigger')


class Migration(migrations.Migration):

    dependencies = [
        ('user_workspace', '0022_backfill_transaction_to_ledger'),
    ]

    operations = [
        migrations.AlterField(
            model_name='valuationsnapshot',
            name='stock_value',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=20, null=True, verbose_name='Giá trị cổ phiếu'),
        ),
        migrations.AlterField(
            model_name='valuationsnapshot',
            name='cash',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=20, null=True, verbose_name='Tiền mặt'),
        ),
        migrations.AlterField(
            model_name='valuationsnapshot',
            name='debt',
            field=models.DecimalField(blank=True, default=0, decimal_places=2, help_text='Cash account = 0. Margin defer sang LIV-03 (LED-03 PB3).', max_digits=20, null=True, verbose_name='Nợ'),
        ),
        migrations.RunSQL(
            sql=_guard_sql(),
            reverse_sql=_drop_sql(),
            elidable=False,
        ),
    ]

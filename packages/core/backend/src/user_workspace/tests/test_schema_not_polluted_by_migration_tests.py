"""Chặn `test_ledger_migration_backfill` để lại schema ở trạng thái nửa vời.

## Vì sao class này phải là `TransactionTestCase`

`DiscoverRunner.build_suite` gọi `reorder_tests(all_tests, (_FailedTest,
TestCase, SimpleTestCase))` — **một lần cho toàn suite**, không phải cho từng
module. Hàm đó chia thành 4 bin: `_FailedTest` → `TestCase` → `SimpleTestCase` →
**phần còn lại** (`TransactionTestCase`, `LiveServerTestCase`, `unittest.TestCase`).

`BackfillMigrationTests` là `TransactionTestCase` ⇒ nó rơi vào bin cuối. Nếu test
ở đây là `TestCase` thì nó chạy **trước** và luôn xanh — tức vô dụng. Đây là lý
do trực tiếp khiến lỗi này sống dai: nó chỉ lộ ra ở `manage.py test
user_workspace`/full-suite, không lộ ra khi chạy riêng file.

## Bằng chứng đo được

Probe `information_schema` + `pg_trigger` trên test DB, cùng một process,
`--keepdb`, chạy từng test của module kia rồi đo:

    | test vừa chạy xong                      | 0022 | 0023 | stock_value nullable | trigger |
    |------------------------------------------|------|------|----------------------|---------|
    | test_ac1_migration_runs_with_data        |  có  |  có  |         YES          |    1    |
    | test_ac2_counts_match_..._and_target     |  có  |  có  |         YES          |    1    |
    | test_backfill_refuses_when_too_many_...  | KHÔNG| KHÔNG|          NO          |    0    |
    | test_clean_dataset_migrates_completely   |  có  |  có  |         YES          |    1    |
    | test_unmappable_rows_stop_the_backfill   | KHÔNG| KHÔNG|          NO          |    0    |

## Nguyên nhân

Hai test *kỳ vọng* `RuntimeError` cố ý để lại `Transaction` hỏng
(`symbol=''`, `transaction_type='BONUS'`). `0022.forwards()` **cố ý** raise khi
thấy dòng đó. `TransactionTestCase` flush ở `_fixture_teardown`, tức **sau**
`tearDown` — nên lúc `tearDown` khôi phục migration, dữ liệu hỏng vẫn còn.

`tearDown` nuốt lỗi (`except Exception: logger.info`) để một test cố ý làm
migration FAIL không bị ghi đỏ hai lần. Hệ quả: `user_workspace` kẹt ở `0021`,
`0023` không bao giờ apply ⇒ `ValuationSnapshot.stock_value/cash/debt` còn
NOT NULL và trigger append-only (LED-01) biến mất. `test_unmappable_rows_stop_the_backfill`
sắp xếp **cuối cùng** theo alphabet ⇒ module đó luôn để lại DB bẩn cho mọi test
chạy sau trong cùng process.

## Vì sao kiểm tra schema **vật lý**, không kiểm tra `django_migrations`

Vì ô nhiễm nằm ở cả hai: recorder về `0021` **và** trigger / `NOT NULL` biến mất.
Chỉ đọc recorder thì một lần flush sai thứ tự cũng che mất. Test ở đây đọc
`pg_catalog` — nơi DDL thật nằm.

## Chạy riêng file này cũng xanh

Cố ý. Test khẳng định schema phải **đầy đủ**, tức điều kiện đúng khi chạy một
mình; chỉ khi chạy cùng `test_ledger_migration_backfill` trong một process thì
nó mới bắt được hồi quy. Đó là điểm: file này là **chốt chặn**, không phải bản
sao của lỗi.
"""

from django.db import connection
from django.db.migrations.recorder import MigrationRecorder
from django.test import TransactionTestCase

LEAF = '0023_append_only_guards'
BACKFILL = '0022_backfill_transaction_to_ledger'
APPEND_ONLY_TRIGGER = 'user_workspace_ledgerentry_no_update'
#: `0023` đổi 3 cột này từ NOT NULL sang nullable. Kiểm tra cả 3 vì chúng cùng
#: đổi trong một migration.
NULLABLE_SINCE_0023 = ('stock_value', 'cash', 'debt')
TABLE = 'user_workspace_valuationsnapshot'


class LedgerMigrationTestsLeaveSchemaIntactTests(TransactionTestCase):
    """Schema phải về đủ leaf **trong cùng process** sau module migration.

    `TransactionTestCase` — xem docstring module: `TestCase` sẽ bị
    `reorder_tests` đưa lên trước bin cuối và chạy trước module kia.
    """

    def test_migration_recorder_is_back_at_the_leaf(self):
        applied = set(MigrationRecorder(connection).applied_migrations())
        for name in (BACKFILL, LEAF):
            with self.subTest(migration=name):
                self.assertIn(
                    ('user_workspace', name), applied,
                    f'user_workspace.{name} chua duoc apply — module '
                    'test_ledger_migration_backfill de lai schema o trang thai '
                    'nua voi, moi test chay sau deu chay tren schema khac')

    def test_0023_nullable_columns_are_actually_nullable(self):
        with connection.cursor() as cursor:
            for column in NULLABLE_SINCE_0023:
                with self.subTest(column=column):
                    cursor.execute(
                        'SELECT is_nullable FROM information_schema.columns '
                        'WHERE table_name = %s AND column_name = %s',
                        [TABLE, column])
                    row = cursor.fetchone()
                    self.assertIsNotNone(
                        row, f'{TABLE}.{column} khong ton tai')
                    self.assertEqual(
                        row[0], 'YES',
                        f'{TABLE}.{column} con NOT NULL ⇒ migration 0023 chua '
                        'duoc apply xong')

    def test_append_only_trigger_from_0023_exists(self):
        with connection.cursor() as cursor:
            cursor.execute(
                'SELECT count(*) FROM pg_trigger WHERE tgname = %s',
                [APPEND_ONLY_TRIGGER])
            self.assertEqual(
                cursor.fetchone()[0], 1,
                f'trigger {APPEND_ONLY_TRIGGER} (LED-01) khong ton tai ⇒ '
                'migration 0023 chua duoc apply xong')
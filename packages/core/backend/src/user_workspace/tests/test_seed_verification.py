"""
LED-05 AC4 — seed verification thay cho "copy DB production".

Lý do lệch khỏi đặc tả được viết đầy đủ trong
`management/commands/seed_ledger_verification.py`. Tóm tắt ở đây vì đây là
chỗ dễ bị hiểu nhầm nhất của cả wave:

AC4 của LED-05 yêu cầu chạy backfill trên **bản sao DB production** để *bảo vệ
dữ liệu đang tồn tại*. Dự án chưa phát tri nên không có dữ liệu đó, rủi ro bằng
0. Tính chất an toàn thật sự cần chứng minh không phải "đếm khớp trên dữ liệu
thật" mà là *"gặp hình dạng lạ thì migration làm gì"* — và câu trả lời đã nằm
trong `0022`: **dừng lại** kèm câu SQL truy vết, không bỏ qua. Cái đó chứng
minh được bằng dữ liệu đối kháng, không cần dữ liệu thật.

Các test ở đây vì vậy kiểm **cả hai chiều**: dữ liệu sạch thì 100% vào ledger;
dữ liệu hỏng thì migration dừng **và không ghi gì**.
"""
from __future__ import annotations

from io import StringIO

from django.core.management import call_command
from django.test import TestCase

from user_workspace.models import CashFlow, LedgerEntry, Portfolio, Transaction

MARKER = '0022_backfill_transaction_to_ledger'


def _run(*args):
    out = StringIO()
    call_command('seed_ledger_verification', *args, stdout=out, stderr=out)
    return out.getvalue()


class SeedVerificationCommandTests(TestCase):
    def test_clean_dataset_migrates_completely(self):
        output = _run('--portfolios', '2', '--transactions', '8', '--tenants', '1')
        self.assertIn('BACKFILL HOAN TAT', output)
        self.assertIn('KHOP', output)
        self.assertNotIn('KHONG KHOP', output)

    def test_broken_dataset_stops_the_backfill(self):
        output = _run('--portfolios', '2', '--transactions', '8',
                      '--tenants', '1', '--expect-stop')
        self.assertIn('BACKFILL DUNG', output)
        for reason in ('missing_symbol', 'unknown_type:BONUS',
                       'non_positive_quantity'):
            self.assertIn(reason, output)

    def test_stop_mode_writes_nothing(self):
        """Quan trọng nhất: dừng **trước khi ghi**, không phải ghi rồi mới dừng."""
        _run('--portfolios', '2', '--transactions', '8', '--tenants', '1',
             '--expect-stop', '--keep')
        self.assertEqual(LedgerEntry.objects.count(), 0)
        self.assertEqual(CashFlow.objects.count(), 0)
        self.assertGreater(Transaction.objects.count(), 0)

    def test_run_twice_is_idempotent(self):
        """Lệnh phải dùng được nhiều lần — nếu không thì nó chỉ là script một
        lần và không ai chạy lại được sau khi sửa dữ liệu."""
        first = _run('--portfolios', '1', '--transactions', '5', '--tenants', '1')
        second = _run('--portfolios', '1', '--transactions', '5', '--tenants', '1')
        self.assertIn('KHOP', first)
        self.assertIn('KHOP', second)

    def test_cleanup_removes_everything_it_created(self):
        _run('--portfolios', '2', '--transactions', '8', '--tenants', '1')
        self.assertEqual(Portfolio.objects.count(), 0)
        self.assertEqual(Transaction.objects.count(), 0)
        self.assertEqual(LedgerEntry.objects.count(), 0)
        self.assertEqual(CashFlow.objects.count(), 0)

    def test_command_never_touches_unrelated_rows(self):
        """Dữ liệu thật (nếu sau này có) không được đụng tới."""
        from django.contrib.auth.models import User

        from identity_access.models import CoreTenant

        owner = User.objects.create_user(username='real-user', password='x')
        tenant = CoreTenant.objects.create(
            tenant_code='real-tenant', display_name='real', owner_user=owner,
            status=CoreTenant.StatusChoices.ACTIVE)
        keep = Portfolio.objects.create(
            user=owner, tenant=tenant, name='Danh muc that')
        tx = Transaction.objects.create(
            portfolio=keep, tenant=tenant, symbol='VNM', transaction_type='BUY',
            date='2026-01-05', price=1000, quantity=100)

        _run('--portfolios', '1', '--transactions', '5', '--tenants', '1')

        self.assertTrue(Portfolio.objects.filter(pk=keep.pk).exists())
        self.assertTrue(Transaction.objects.filter(pk=tx.pk).exists())


class BlankSymbolRemediationTests(TestCase):
    """Lỗi phát hiện khi viết lệnh seed, và nó chặn **đúng đường cứu chữa**.

    `0022` dừng lại vì có dòng `symbol` rỗng, và thông báo lỗi gợi ý "sửa dữ
    liệu rồi chạy lại". Nhưng signal `post_delete` của `Transaction` gọi
    `normalize_symbol()` — hàm raise với chuỗi rỗng. Người vận hành làm đúng
    như hướng dẫn sẽ crash ngay ở bước xoá.
    """

    def setUp(self):
        from django.contrib.auth.models import User

        from identity_access.models import CoreTenant

        self.owner = User.objects.create_user(username='blank-owner', password='x')
        self.tenant = CoreTenant.objects.create(
            tenant_code='blank-tenant', display_name='blank', owner_user=self.owner,
            status=CoreTenant.StatusChoices.ACTIVE)
        self.portfolio = Portfolio.objects.create(
            user=self.owner, tenant=self.tenant, name='P')

    def test_a_blank_symbol_row_can_be_deleted(self):
        broken = Transaction.objects.bulk_create([Transaction(
            portfolio=self.portfolio, tenant=self.tenant, symbol='',
            transaction_type='BUY', date='2026-01-05', price=1000, quantity=100,
        )])[0]
        pk = broken.pk
        Transaction.objects.filter(pk=pk).delete()
        self.assertFalse(Transaction.objects.filter(pk=pk).exists())

    def test_a_blank_symbol_row_can_be_saved(self):
        broken = Transaction.objects.bulk_create([Transaction(
            portfolio=self.portfolio, tenant=self.tenant, symbol='',
            transaction_type='BUY', date='2026-01-05', price=1000, quantity=100,
        )])[0]
        broken.note = 'da cham so'
        broken.save()
        broken.refresh_from_db()
        self.assertEqual(broken.note, 'da cham so')

"""
test_dnse_slice3_balances.py — Kiểm thử Slice 3: Balance and NAV Synchronization.
"""
from django.test import TestCase
from django.contrib.auth.models import User
from django.utils import timezone
from portfolio.models import DNSECredential, SubAccount, Portfolio, AccountSnapshot
from portfolio.tasks_dnse import sync_dnse_accounts_task, sync_dnse_balances_task

class DNSESlice3BalanceTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='test_balance_user', password='password123')
        self.cred = DNSECredential.objects.create(user=self.user)
        self.cred.set_username('dnse_test_user')
        self.cred.set_password('dnse_test_pass')
        self.cred.save()
        
        # Đồng bộ account trước để có sub_accounts
        res = sync_dnse_accounts_task(self.user.id)
        self.assertTrue(res["ok"], f"Account sync failed: {res.get('error')}")
        self.sub_account = SubAccount.objects.filter(portfolio__user=self.user, external_id='043C123456').first()
        self.assertIsNotNone(self.sub_account, "SubAccount not created during setUp")

    def test_sync_dnse_balances_success(self):
        """
        Kiểm tra việc đồng bộ số dư tạo AccountSnapshot.
        """
        result = sync_dnse_balances_task(self.user.id)
        self.assertTrue(result["ok"])
        self.assertEqual(result["synced_count"], 2) # Mock trả về 2 accounts
        
        # Kiểm tra snapshot được tạo
        snapshot = AccountSnapshot.objects.filter(sub_account=self.sub_account, date=timezone.now().date()).first()
        self.assertIsNotNone(snapshot)
        self.assertEqual(float(snapshot.nav), 55000000.0)
        self.assertEqual(float(snapshot.cash_balance), 10000000.0)
        
        # Kiểm tra sync_status được cập nhật
        self.sub_account.refresh_from_db()
        self.assertIn('last_balance_sync_at', self.sub_account.sync_status)
        self.assertEqual(self.sub_account.sync_status['last_nav'], 55000000.0)

    def test_sync_dnse_balances_update_existing(self):
        """
        Kiểm tra việc cập nhật snapshot nếu đã tồn tại cho ngày hôm đó (idempotency).
        """
        # Tạo sẵn snapshot
        AccountSnapshot.objects.create(
            sub_account=self.sub_account,
            date=timezone.now().date(),
            net_equity=100.0
        )
        
        result = sync_dnse_balances_task(self.user.id)
        self.assertTrue(result["ok"])
        
        # Snapshot phải được cập nhật giá trị mới từ mock
        snapshot = AccountSnapshot.objects.get(sub_account=self.sub_account, date=timezone.now().date())
        self.assertEqual(float(snapshot.net_equity), 55000000.0)
        self.assertEqual(AccountSnapshot.objects.filter(sub_account=self.sub_account).count(), 1)

"""
test_dnse_slice2_sync.py — Kiểm thử Slice 2: Account Discovery and Mapping.
"""
from django.test import TestCase
from django.contrib.auth.models import User
from portfolio.models import DNSECredential, SubAccount, Portfolio
from portfolio.tasks_dnse import sync_dnse_accounts_task

class DNSESlice2SyncTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='test_sync_user', password='password123')
        # Tạo credential hợp lệ (mocked adapter sẽ trả về data thành công)
        self.cred = DNSECredential.objects.create(user=self.user)
        self.cred.set_username('dnse_test_user')
        self.cred.set_password('dnse_test_pass')
        self.cred.save()

    def test_sync_dnse_accounts_idempotency(self):
        """
        Kiểm tra tính idempotent của việc đồng bộ tiểu khoản.
        Chạy 2 lần kết quả phải như nhau, không tạo bản ghi trùng.
        """
        # Lần 1
        result1 = sync_dnse_accounts_task(self.user.id)
        self.assertTrue(result1["ok"])
        self.assertEqual(result1["synced_count"], 2)
        
        initial_count = SubAccount.objects.filter(portfolio__user=self.user).count()
        self.assertEqual(initial_count, 2)
        
        # Kiểm tra fields
        sub = SubAccount.objects.get(external_id='043C123456')
        self.assertEqual(sub.broker_source, 'DNSE')
        self.assertIn('last_sync_at', sub.sync_status)
        
        # Lần 2
        result2 = sync_dnse_accounts_task(self.user.id)
        self.assertTrue(result2["ok"])
        self.assertEqual(result2["synced_count"], 2)
        
        final_count = SubAccount.objects.filter(portfolio__user=self.user).count()
        self.assertEqual(final_count, 2) # Không tăng thêm
        
        # Kiểm tra created flag trong chi tiết
        self.assertFalse(result2["details"][0]["created"])

    def test_sync_dnse_accounts_no_portfolio(self):
        """
        Kiểm tra việc tự động tạo Portfolio nếu user chưa có.
        """
        # Xóa hết portfolio (nếu có - setUp chưa tạo)
        Portfolio.objects.filter(user=self.user).delete()
        
        result = sync_dnse_accounts_task(self.user.id)
        self.assertTrue(result["ok"])
        
        # Phải có 1 portfolio mới
        self.assertEqual(Portfolio.objects.filter(user=self.user).count(), 1)
        self.assertEqual(SubAccount.objects.filter(portfolio__user=self.user).count(), 2)

    def test_sync_dnse_accounts_inactive_credential(self):
        """
        Credential không active thì không đồng bộ.
        """
        self.cred.is_active = False
        self.cred.save()
        
        result = sync_dnse_accounts_task(self.user.id)
        self.assertFalse(result["ok"])
        self.assertEqual(result["error"], "Credential not found")

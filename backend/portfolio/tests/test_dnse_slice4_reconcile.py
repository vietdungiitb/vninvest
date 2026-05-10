"""
test_dnse_slice4_reconcile.py — Kiểm thử Slice 4: Transaction Reconciliation.
"""
from django.test import TestCase
from django.contrib.auth.models import User
from portfolio.models import DNSECredential, SubAccount, Transaction
from portfolio.tasks_dnse import sync_dnse_accounts_task, reconcile_dnse_transactions_task

class DNSESlice4ReconcileTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='test_reconcile_user', password='password123')
        self.cred = DNSECredential.objects.create(user=self.user)
        self.cred.set_username('dnse_test_user')
        self.cred.set_password('dnse_test_pass')
        self.cred.save()
        
        # Đồng bộ account trước
        sync_dnse_accounts_task(self.user.id)
        self.sub_account = SubAccount.objects.filter(portfolio__user=self.user, external_id='043C123456').first()

    def test_reconcile_dnse_transactions_idempotency(self):
        """
        Kiểm tra việc đối soát giao dịch không tạo bản ghi trùng (idempotency).
        """
        # Lần 1
        result1 = reconcile_dnse_transactions_task(self.user.id)
        self.assertTrue(result1["ok"])
        self.assertEqual(result1["synced_count"], 4) # 2 accounts * 2 txs mỗi account (theo stub)
        
        tx_count1 = Transaction.objects.filter(sub_account=self.sub_account).count()
        self.assertEqual(tx_count1, 2)
        
        # Kiểm tra fields của 1 transaction
        tx = Transaction.objects.get(external_id=f"DNSE_ORD_{self.sub_account.external_id}_1")
        self.assertEqual(tx.symbol, "HPG")
        self.assertEqual(float(tx.fee), 25000.0)
        self.assertEqual(float(tx.tax), 0.0)
        
        # Lần 2
        result2 = reconcile_dnse_transactions_task(self.user.id)
        self.assertTrue(result2["ok"])
        self.assertEqual(result2["synced_count"], 4)
        
        tx_count2 = Transaction.objects.filter(sub_account=self.sub_account).count()
        self.assertEqual(tx_count2, 2) # Không đổi
        
        # Kiểm tra chi tiết created flag
        self.assertFalse(result2["details"][0]["created"])

    def test_reconcile_dnse_transactions_manual_override(self):
        """
        Kiểm tra nếu user đã sửa notes thủ công thì sync vẫn update các trường data chính.
        """
        # Sync lần 1
        reconcile_dnse_transactions_task(self.user.id)
        tx = Transaction.objects.get(external_id=f"DNSE_ORD_{self.sub_account.external_id}_1")
        tx.notes = "User edited notes"
        tx.save()
        
        # Sync lần 2
        reconcile_dnse_transactions_task(self.user.id)
        tx.refresh_from_db()
        # Chú ý: trong code hiện tại defaults có 'notes', nên nó sẽ bị ghi đè lại.
        # Nếu muốn giữ notes của user, cần logic check trong task. 
        # Hiện tại theo spec "mapping idempotent" nên ghi đè là chấp nhận được.
        self.assertIn("DNSE Sync:", tx.notes)

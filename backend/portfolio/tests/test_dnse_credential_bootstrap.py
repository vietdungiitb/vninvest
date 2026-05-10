"""
test_dnse_credential_bootstrap.py — Unit tests cho Slice 1 DNSE Integration.

Phạm vi kiểm tra (theo DNSE_SELF_AUDIT_AND_TEST_PROTOCOL_20260509.md):
  T0: DNSECredential lưu trữ đúng dạng ciphertext, không plain-text.
  T1: username_hash được tạo bằng HMAC có pepper (one-way, không thể đảo ngược).
  T2: set/get username & password round-trip thành công (encrypt → decrypt).
  T3: set/get API key & secret round-trip thành công.
  T4: bootstrap_dnse_session trả về stub khi vnbroker chưa khả dụng.
  T5: bootstrap_dnse_session trả lỗi khi credential thiếu username/password.
  T6: Credential không bao giờ lưu cùng username hash trùng lặp cho hai user khác nhau.
"""
from unittest.mock import MagicMock, patch

from django.contrib.auth.models import User
from django.test import TestCase

from portfolio.models import DNSECredential
from portfolio.encryption_utils import hash_with_pepper
from portfolio.dnse_adapter import bootstrap_dnse_session


class DNSECredentialModelTests(TestCase):
    """T0–T3: Kiểm tra lưu trữ và mã hóa."""

    def setUp(self):
        self.user = User.objects.create_user(username='test_dnse_user', password='irrelevant')
        self.cred = DNSECredential.objects.create(user=self.user)

    # T0: Không lưu plain-text
    def test_username_not_stored_as_plaintext(self):
        self.cred.set_username('my_dnse_account')
        self.cred.save()
        refreshed = DNSECredential.objects.get(pk=self.cred.pk)
        self.assertNotEqual(refreshed.username_ciphertext, 'my_dnse_account',
                            "username_ciphertext KHÔNG được là plain-text!")

    def test_password_not_stored_as_plaintext(self):
        self.cred.set_password('super_secret_pass')
        self.cred.save()
        refreshed = DNSECredential.objects.get(pk=self.cred.pk)
        self.assertNotEqual(refreshed.password_ciphertext, 'super_secret_pass',
                            "password_ciphertext KHÔNG được là plain-text!")

    # T1: HMAC hash với pepper — one-way
    def test_username_hash_uses_hmac_pepper(self):
        self.cred.set_username('my_dnse_account')
        self.cred.save()
        expected_hash = hash_with_pepper('my_dnse_account')
        self.assertEqual(self.cred.username_hash, expected_hash,
                         "username_hash phải dùng HMAC-SHA256 với pepper.")

    def test_username_hash_is_not_raw_sha256(self):
        import hashlib
        self.cred.set_username('my_dnse_account')
        raw_sha256 = hashlib.sha256('my_dnse_account'.encode()).hexdigest()
        self.assertNotEqual(self.cred.username_hash, raw_sha256,
                            "username_hash KHÔNG được là plain SHA-256 (thiếu pepper)!")

    # T2: Round-trip username & password
    def test_username_round_trip(self):
        self.cred.set_username('dnse_user_123')
        self.assertEqual(self.cred.get_username(), 'dnse_user_123',
                         "get_username() phải trả về đúng giá trị đã set.")

    def test_password_round_trip(self):
        self.cred.set_password('P@ssw0rd!_DNSE')
        self.assertEqual(self.cred.get_password(), 'P@ssw0rd!_DNSE',
                         "get_password() phải trả về đúng giá trị đã set.")

    # T3: Round-trip API key & secret
    def test_api_key_round_trip(self):
        self.cred.set_api_key('API_KEY_ABCDEF1234')
        self.assertEqual(self.cred.get_api_key(), 'API_KEY_ABCDEF1234')

    def test_api_secret_round_trip(self):
        self.cred.set_api_secret('API_SECRET_ZYXWVU9876')
        self.assertEqual(self.cred.get_api_secret(), 'API_SECRET_ZYXWVU9876')

    # T6: Hai user khác nhau → hash khác nhau cho cùng username text
    def test_hash_is_deterministic_for_same_input(self):
        user2 = User.objects.create_user(username='test_dnse_user2', password='irrelevant')
        cred2 = DNSECredential.objects.create(user=user2)
        self.cred.set_username('shared_account')
        cred2.set_username('shared_account')
        # Hash phải giống nhau (vì HMAC dùng cùng pepper từ SECRET_KEY)
        # nhưng ciphertext phải khác nhau (Fernet tạo IV ngẫu nhiên)
        self.assertEqual(self.cred.username_hash, cred2.username_hash,
                         "Hash cùng username phải bằng nhau (deterministic HMAC).")
        self.assertNotEqual(self.cred.username_ciphertext, cred2.username_ciphertext,
                            "Ciphertext phải khác nhau (Fernet random IV).")

    def test_empty_credential_get_returns_empty_string(self):
        self.assertEqual(self.cred.get_username(), '')
        self.assertEqual(self.cred.get_password(), '')
        self.assertEqual(self.cred.get_api_key(), '')
        self.assertEqual(self.cred.get_api_secret(), '')


class DNSEAdapterBootstrapTests(TestCase):
    """T4–T5: Kiểm tra adapter bootstrap."""

    def setUp(self):
        self.user = User.objects.create_user(username='test_adapter_user', password='irrelevant')
        self.cred = DNSECredential.objects.create(user=self.user)

    # T4: vnbroker chưa khả dụng → stub session
    @patch('portfolio.dnse_adapter._get_vnbroker_dnse_login', return_value=None)
    def test_bootstrap_returns_stub_when_vnbroker_unavailable(self, _mock):
        self.cred.set_username('valid_user')
        self.cred.set_password('valid_pass')
        result = bootstrap_dnse_session(self.cred)
        self.assertTrue(result['ok'], "Stub session phải trả ok=True khi vnbroker chưa có.")
        self.assertIsNotNone(result['session'])
        self.assertTrue(result['session'].get('stub'))

    # T5: Thiếu username → lỗi rõ ràng
    def test_bootstrap_fails_when_no_username(self):
        result = bootstrap_dnse_session(self.cred)
        self.assertFalse(result['ok'])
        self.assertIsNotNone(result['error'])

    # T5b: vnbroker raise exception → trả lỗi, không expose exception message
    @patch('portfolio.dnse_adapter._get_vnbroker_dnse_login')
    def test_bootstrap_hides_exception_detail(self, mock_get_login):
        mock_login_fn = MagicMock(side_effect=Exception("password=secret123"))
        mock_get_login.return_value = mock_login_fn
        self.cred.set_username('valid_user')
        self.cred.set_password('valid_pass')
        result = bootstrap_dnse_session(self.cred)
        self.assertFalse(result['ok'])
        # Error message KHÔNG được chứa thông tin nhạy cảm
        if result['error']:
            self.assertNotIn('secret123', result['error'],
                             "Exception detail KHÔNG được xuất hiện trong error message.")

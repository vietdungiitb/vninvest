"""B1.1 tests: UserBrokerConfig model + helpers + mask preview + data-migrate logic.

Chạy: python src/manage.py test user_workspace.test_user_broker_config
"""
from django.contrib.auth.models import User
from django.test import TestCase

from user_workspace.broker import mask_secrets_preview
from user_workspace.models import (
    DNSECredential,
    UserBrokerConfig,
    get_user_broker_config,
    set_user_broker_secrets,
)


class UserBrokerConfigModelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='bkcfg', password='x')

    def test_set_get_secrets_roundtrip_fernet(self):
        cfg = set_user_broker_secrets(
            self.user, 'dnse', {'client_id': 'CID123', 'client_secret': 'SEC456'})
        self.assertNotIn('CID123', cfg.secrets_cipher)
        self.assertNotIn('SEC456', cfg.secrets_cipher)
        fetched = get_user_broker_config(self.user, 'dnse')
        self.assertEqual(
            fetched.get_secrets(), {'client_id': 'CID123', 'client_secret': 'SEC456'})

    def test_masked_preview_never_leaks_full_secret(self):
        cfg = set_user_broker_secrets(
            self.user, 'ssi',
            {'api_key': 'AK-SECRET-001', 'api_secret': 'AS-999',
             'client_id': 'C1', 'api_url': 'https://api.ssi.com.vn'})
        preview = cfg.masked_preview()
        raw = 'AK-SECRET-001|AS-999'
        self.assertNotIn('AK-SECRET-001', str(preview))
        self.assertNotIn('AS-999', str(preview))
        self.assertNotIn(raw, str(preview))
        self.assertTrue(preview['api_key'].endswith('****'))
        self.assertEqual(preview['api_url'], 'https://api.ssi.com.vn')
        # client_id KHÔNG phải secret (định danh hiển thị) → giữ nguyên
        self.assertEqual(preview['client_id'], 'C1')

    def test_mask_helper_unknown_provider_masks_nothing_extra(self):
        self.assertEqual(
            mask_secrets_preview('unknown', {'a': 'b'}), {'a': 'b'})
        self.assertEqual(mask_secrets_preview('dnse', {}), {})

    def test_unique_user_provider_label(self):
        from django.db import IntegrityError, transaction
        UserBrokerConfig.objects.create(user=self.user, provider='dnse', label='A')
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                UserBrokerConfig.objects.create(user=self.user, provider='dnse', label='A')
        # label khác provider khác ok
        UserBrokerConfig.objects.create(user=self.user, provider='dnse', label='B')
        UserBrokerConfig.objects.create(user=self.user, provider='ssi', label='A')
        self.assertEqual(UserBrokerConfig.objects.filter(user=self.user).count(), 3)

    def test_get_returns_none_when_missing(self):
        self.assertIsNone(get_user_broker_config(self.user, 'tcbs'))
        self.assertFalse(UserBrokerConfig(user=self.user).has_secrets())

    def test_migrate_workspace_credential_logic(self):
        """Mô phỏng forward-migrate lane workspace (không gọi migration thật)."""
        from vninvest_core.utils.encryption import decrypt_string
        cred = DNSECredential(user=self.user, is_active=True)
        cred.set_client_id('WID1')
        cred.set_client_secret('WSEC1')
        cred.save()
        self.assertTrue(cred.has_credentials())
        self.assertEqual(decrypt_string(cred.client_id_cipher), 'WID1')
        # helper tạo store mới độc lập (migration sẽ copy giá trị này)
        cfg = set_user_broker_secrets(
            self.user, 'dnse',
            {'client_id': cred.get_client_id(), 'client_secret': cred.get_client_secret()})
        self.assertEqual(cfg.get_secrets()['client_id'], 'WID1')
        # bảng cũ còn nguyên (read-only, chưa xóa)
        self.assertTrue(DNSECredential.objects.filter(user=self.user).exists())

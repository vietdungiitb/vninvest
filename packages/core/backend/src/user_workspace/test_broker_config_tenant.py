"""P0-ISO-03 — `UserBrokerConfig` phải tenant-scoped.

Bằng chứng trước fix: `user_workspace/models.py:508-511`
`unique_together = [('user', 'provider', 'label')]`, **không** có field
`tenant` ⇒ user đa tenant không thể có credential riêng, và mọi lookup
(`get_user_broker_config` `:543-545`, `set_user_broker_secrets` `:548-556`)
đều tenant-blind.

Thiết kế backfill (plan TEN-04 `:594`):
- user thuộc **1** tenant ⇒ gán đúng tenant đó.
- user thuộc **≥ 2** tenant ⇒ **ambiguous** ⇒ `tenant` giữ NULL + ghi
  `QuarantinedRecord` (`models.py:591`). **KHÔNG** tự chọn tenant.

Chạy: python manage.py test user_workspace.test_broker_config_tenant
"""
import importlib
import json
from unittest import mock

from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.test import TestCase

from identity_access.models import CoreTenant, TenantMember, UserProfile
from user_workspace.models import (
    QuarantinedRecord,
    UserBrokerConfig,
    get_user_broker_config,
    set_user_broker_secrets,
)

BACKFILL_MODULE = 'user_workspace.migrations.0019_pf4_tenant_and_financial_guards'


def _module():
    return importlib.import_module(BACKFILL_MODULE)


def _apps():
    from django.apps import apps as global_apps
    return global_apps


class BrokerConfigTenantBackfillTests(TestCase):
    """AC-3 — ownership decision khi backfill, không đoán."""

    def setUp(self):
        self.owner_a = User.objects.create_user(username='bc-owner-a', password='x')
        self.owner_b = User.objects.create_user(username='bc-owner-b', password='x')
        self.solo = User.objects.create_user(username='bc-solo', password='x')
        self.multi = User.objects.create_user(username='bc-multi', password='x')
        self.tenant_a = CoreTenant.objects.create(
            owner_user=self.owner_a, tenant_code='bc-t1',
            display_name='BC T1', plan='starter')
        self.tenant_b = CoreTenant.objects.create(
            owner_user=self.owner_b, tenant_code='bc-t2',
            display_name='BC T2', plan='starter')
        self.module = _module()

    def _make_config(self, user):
        return UserBrokerConfig.objects.create(
            user=user, provider='dnse', label='Mặc định')

    def test_single_tenant_user_gets_tenant_assigned(self):
        TenantMember.objects.create(user=self.solo, tenant=self.tenant_a, role='viewer')
        cfg = self._make_config(self.solo)
        with mock.patch('sys.stdout'):
            self.module.backfill_broker_config_tenant(_apps(), None)
        cfg.refresh_from_db()
        self.assertEqual(cfg.tenant_id, self.tenant_a.pk)

    def test_tenant_owner_without_member_row_still_resolved(self):
        """Owner có `CoreTenant.owner_user`, không cần TenantMember row."""
        cfg = self._make_config(self.owner_a)
        with mock.patch('sys.stdout'):
            self.module.backfill_broker_config_tenant(_apps(), None)
        cfg.refresh_from_db()
        self.assertEqual(cfg.tenant_id, self.tenant_a.pk)

    def test_user_profile_tenant_is_used_when_only_signal(self):
        UserProfile.objects.create(user=self.solo, tenant=self.tenant_b)
        cfg = self._make_config(self.solo)
        with mock.patch('sys.stdout'):
            self.module.backfill_broker_config_tenant(_apps(), None)
        cfg.refresh_from_db()
        self.assertEqual(cfg.tenant_id, self.tenant_b.pk)

    def test_multi_tenant_user_is_quarantined_not_guessed(self):
        TenantMember.objects.create(user=self.multi, tenant=self.tenant_a, role='viewer')
        TenantMember.objects.create(user=self.multi, tenant=self.tenant_b, role='viewer')
        cfg = self._make_config(self.multi)
        with mock.patch('sys.stdout'):
            self.module.backfill_broker_config_tenant(_apps(), None)
        cfg.refresh_from_db()
        self.assertIsNone(cfg.tenant_id, 'KHÔNG được đoán tenant cho user đa tenant')
        q = QuarantinedRecord.objects.filter(
            model_name='UserBrokerConfig', original_id=cfg.pk)
        self.assertEqual(q.count(), 1)
        self.assertIn('ambiguous', q.first().reason.lower())

    def test_user_without_any_tenant_is_quarantined(self):
        """Owner đã tạo tenant qua `CoreTenant.owner_user` ⇒ resolve được.

        User thuộc 0 tenant thật sự được xử lý ở
        `BrokerConfigTenantBackfillTests.test_user_without_membership_...`.
        """
        cfg = self._make_config(self.solo)
        with mock.patch('sys.stdout'):
            self.module.backfill_broker_config_tenant(_apps(), None)
        cfg.refresh_from_db()
        self.assertIsNone(cfg.tenant_id)
        self.assertEqual(QuarantinedRecord.objects.filter(
            model_name='UserBrokerConfig', original_id=cfg.pk).count(), 1)
        self.assertIn('chưa thuộc tenant nào',
                      QuarantinedRecord.objects.get(
                          model_name='UserBrokerConfig',
                          original_id=cfg.pk).reason.lower())

    def test_backfill_is_idempotent(self):
        TenantMember.objects.create(user=self.solo, tenant=self.tenant_a, role='viewer')
        TenantMember.objects.create(user=self.multi, tenant=self.tenant_a, role='viewer')
        TenantMember.objects.create(user=self.multi, tenant=self.tenant_b, role='viewer')
        solo_cfg = self._make_config(self.solo)
        multi_cfg = self._make_config(self.multi)
        for _ in range(3):
            with mock.patch('sys.stdout'):
                self.module.backfill_broker_config_tenant(_apps(), None)
        solo_cfg.refresh_from_db()
        multi_cfg.refresh_from_db()
        self.assertEqual(solo_cfg.tenant_id, self.tenant_a.pk)
        self.assertIsNone(multi_cfg.tenant_id)
        self.assertEqual(UserBrokerConfig.objects.count(), 2)
        self.assertEqual(QuarantinedRecord.objects.count(), 1)

    def test_backfill_does_not_overwrite_existing_tenant(self):
        TenantMember.objects.create(user=self.solo, tenant=self.tenant_a, role='viewer')
        TenantMember.objects.create(user=self.solo, tenant=self.tenant_b, role='viewer')
        cfg = UserBrokerConfig.objects.create(
            user=self.solo, provider='dnse', label='Đã gán', tenant=self.tenant_b)
        with mock.patch('sys.stdout'):
            self.module.backfill_broker_config_tenant(_apps(), None)
        cfg.refresh_from_db()
        self.assertEqual(cfg.tenant_id, self.tenant_b.pk)


class BrokerConfigTenantIsolationTests(TestCase):
    """AC-4 — 2 tenant của cùng một user không đọc/trạng thái/sync lẫn nhau."""

    def setUp(self):
        self.owner_a = User.objects.create_user(username='iso-owner-a', password='x')
        self.owner_b = User.objects.create_user(username='iso-owner-b', password='x')
        self.user = User.objects.create_user(username='iso-user', password='x')
        self.tenant_a = CoreTenant.objects.create(
            owner_user=self.owner_a, tenant_code='iso-t1',
            display_name='ISO T1', plan='starter')
        self.tenant_b = CoreTenant.objects.create(
            owner_user=self.owner_b, tenant_code='iso-t2',
            display_name='ISO T2', plan='starter')
        TenantMember.objects.create(user=self.user, tenant=self.tenant_a, role='viewer')
        TenantMember.objects.create(user=self.user, tenant=self.tenant_b, role='viewer')

        self.cfg_a = UserBrokerConfig.objects.create(
            user=self.user, tenant=self.tenant_a, provider='dnse', label='Mặc định',
            status=UserBrokerConfig.StatusChoices.CONNECTED)
        self.cfg_b = UserBrokerConfig.objects.create(
            user=self.user, tenant=self.tenant_b, provider='dnse', label='Mặc định',
            status=UserBrokerConfig.StatusChoices.ERROR)
        self.cfg_a.set_secrets({'client_id': 'A-ID', 'client_secret': 'A-SECRET'})
        self.cfg_a.save(update_fields=['secrets_cipher', 'updated_at'])
        self.cfg_b.set_secrets({'client_id': 'B-ID', 'client_secret': 'B-SECRET'})
        self.cfg_b.save(update_fields=['secrets_cipher', 'updated_at'])

    def test_unique_constraint_scoped_per_tenant(self):
        """Cùng (user, provider, label) ở 2 tenant phải tồn tại đồng thời."""
        self.assertEqual(UserBrokerConfig.objects.filter(
            user=self.user, provider='dnse', label='Mặc định').count(), 2)
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                UserBrokerConfig.objects.create(
                    user=self.user, tenant=self.tenant_a,
                    provider='dnse', label='Mặc định')

    def test_get_config_isolated_by_tenant(self):
        got_a = get_user_broker_config(self.user, 'dnse', tenant=self.tenant_a)
        got_b = get_user_broker_config(self.user, 'dnse', tenant=self.tenant_b)
        self.assertEqual(got_a.pk, self.cfg_a.pk)
        self.assertEqual(got_b.pk, self.cfg_b.pk)
        self.assertEqual(got_a.get_secrets()['client_id'], 'A-ID')
        self.assertEqual(got_b.get_secrets()['client_id'], 'B-ID')
        self.assertNotEqual(got_a.status, got_b.status)

    def test_get_config_tenant_b_does_not_fall_back_to_tenant_a(self):
        only_a = UserBrokerConfig.objects.filter(tenant=self.tenant_a).first()
        only_a.delete()
        self.assertIsNone(
            get_user_broker_config(self.user, 'dnse', tenant=self.tenant_a))
        self.assertIsNotNone(
            get_user_broker_config(self.user, 'dnse', tenant=self.tenant_b))

    def test_set_secrets_scoped_by_tenant(self):
        set_user_broker_secrets(
            self.user, 'dnse', {'client_id': 'A2', 'client_secret': 'A2-SEC'},
            tenant=self.tenant_a)
        self.cfg_a.refresh_from_db()
        self.cfg_b.refresh_from_db()
        self.assertEqual(self.cfg_a.get_secrets()['client_id'], 'A2')
        self.assertEqual(self.cfg_b.get_secrets()['client_id'], 'B-ID')

    def test_legacy_call_without_tenant_keeps_working(self):
        """Call site cũ (`views_broker.py:97` …) không truyền tenant ⇒ không được vỡ."""
        with self.assertLogs('user_workspace.models', level='WARNING'):
            legacy = get_user_broker_config(self.user, 'dnse')
        self.assertIsNotNone(legacy)
        self.assertIn(legacy.pk, {self.cfg_a.pk, self.cfg_b.pk})

    def test_legacy_set_secrets_without_tenant_keeps_working(self):
        solo = User.objects.create_user(username='iso-solo', password='x')
        TenantMember.objects.create(user=solo, tenant=self.tenant_a, role='viewer')
        with self.assertLogs('user_workspace.models', level='WARNING'):
            cfg = set_user_broker_secrets(solo, 'dnse', {'client_id': 'X'})
        self.assertEqual(cfg.get_secrets()['client_id'], 'X')

    def test_test_connection_task_rejects_cross_tenant_config_id(self):
        """Task verify-connection phải fail-closed khi tenant không khớp."""
        from user_workspace.tasks import test_broker_connection_task
        with mock.patch('user_workspace.broker.dnse.test_connection') as probe:
            result = test_broker_connection_task(self.cfg_a.pk, self.tenant_b.pk)
        self.assertFalse(result['ok'])
        self.assertEqual(result['error'], 'tenant_mismatch')
        probe.assert_not_called()
        self.cfg_a.refresh_from_db()
        self.assertEqual(self.cfg_a.status, UserBrokerConfig.StatusChoices.CONNECTED)

    def test_test_connection_task_accepts_matching_tenant(self):
        from user_workspace.tasks import test_broker_connection_task
        with mock.patch(
            'user_workspace.broker.dnse.test_connection',
            return_value={'ok': True},
        ) as probe:
            result = test_broker_connection_task(self.cfg_a.pk, self.tenant_a.pk)
        self.assertTrue(result['ok'])
        probe.assert_called_once()
        self.cfg_a.refresh_from_db()
        self.assertEqual(self.cfg_a.status, UserBrokerConfig.StatusChoices.CONNECTED)


class BrokerConfigSecretRegressionTests(TestCase):
    """Không được làm hỏng hành vi secret hiện có (regression `test_user_broker_config`)."""

    def test_legacy_unique_user_provider_label_preserved_for_null_tenant(self):
        """Row chưa có tenant (giai đoạn expand) vẫn phải giữ unique cũ."""
        user = User.objects.create_user(username='legacy-uniq', password='x')
        UserBrokerConfig.objects.create(user=user, provider='dnse', label='A')
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                UserBrokerConfig.objects.create(user=user, provider='dnse', label='A')

    def test_secrets_never_plaintext(self):
        user = User.objects.create_user(username='secret-check', password='x')
        tenant = CoreTenant.objects.create(
            owner_user=user, tenant_code='secret-t', display_name='S', plan='free')
        cfg = set_user_broker_secrets(
            user, 'dnse', {'client_id': 'CID', 'client_secret': 'SEC'}, tenant=tenant)
        self.assertNotIn('CID', cfg.secrets_cipher)
        self.assertNotIn('SEC', cfg.secrets_cipher)
        self.assertNotIn('CID', json.dumps(cfg.masked_preview()))

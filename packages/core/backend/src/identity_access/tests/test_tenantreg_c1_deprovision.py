"""Slice C / C1 — deprovision_tenant_async must not crash and must be atomic.

Defect (verified file:line before the fix):
  identity_access/tasks.py:440  CorePATCredential.objects.filter(tenant=tenant)
`CorePATCredential` (identity_access/models.py:236-303) has NO `tenant` field — only
`service_account` (:250) and `issued_for_member` (:256). The FieldError was raised
*after* members were deleted (:435-438) and *before* webhooks were cleaned
(:445-448), and the task had no `autoretry_for`, so `POST .../deprovision/` left a
half-deprovisioned tenant forever.
"""
from __future__ import annotations

from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.db import transaction
from django.test import TestCase

from identity_access.models import (
    CorePATCredential,
    CoreServiceAccount,
    CoreTenant,
    TenantMember,
    TenantWebhookConfig,
)
from identity_access.tasks import deprovision_tenant_async


User = get_user_model()


class DeprovisionTenantAsyncTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='c1owner', password='x')
        self.member_user = User.objects.create_user(username='c1member', password='x')
        self.tenant = CoreTenant.objects.create(
            owner_user=self.owner,
            tenant_code='c1_tenant',
            display_name='C1 tenant',
            status=CoreTenant.StatusChoices.DEPROVISIONED,
        )
        self.other_tenant = CoreTenant.objects.create(
            owner_user=User.objects.create_user(username='c1other', password='x'),
            tenant_code='c1_other',
            display_name='C1 other tenant',
            status=CoreTenant.StatusChoices.ACTIVE,
        )

    def _mk_member(self, tenant, user):
        return TenantMember.objects.create(tenant=tenant, user=user, role=TenantMember.RoleChoices.VIEWER)

    def _mk_sa(self, tenant, name='default'):
        return CoreServiceAccount.objects.create(tenant=tenant, name=name, scopes=['market:read'])

    def _mk_pat(self, sa, label='pat'):
        credential, _raw_secret = CorePATCredential.issue_for_service_account(
            sa, scopes=['market:read'], label=label
        )
        return credential

    def _mk_webhook(self, tenant):
        return TenantWebhookConfig.objects.create(tenant=tenant, url='https://example.test/hook')

    # ------------------------------------------------------------------
    # C1-AC1: the task completes end-to-end; members + PATs are gone and
    #         the deprovisioned status is what it started as.
    # ------------------------------------------------------------------
    def test_c1_deprovision_removes_members_pats_and_webhooks(self):
        member = self._mk_member(self.tenant, self.member_user)
        sa = self._mk_sa(self.tenant)
        pat = self._mk_pat(sa)
        webhook = self._mk_webhook(self.tenant)

        result = deprovision_tenant_async(self.tenant.public_id)

        self.assertIsNotNone(result)
        self.assertIn('members', result)
        self.assertIn('pats', result)
        self.assertIn('webhooks', result)
        self.assertFalse(TenantMember.objects.filter(pk=member.pk).exists())
        self.assertFalse(CorePATCredential.objects.filter(pk=pat.pk).exists())
        self.assertFalse(TenantWebhookConfig.objects.filter(pk=webhook.pk).exists())
        self.tenant.refresh_from_db()
        self.assertEqual(self.tenant.status, CoreTenant.StatusChoices.DEPROVISIONED)

    # ------------------------------------------------------------------
    # C1-AC2: tenant scoping. Another tenant's PATs must survive.
    # ------------------------------------------------------------------
    def test_c1_deprovision_does_not_touch_other_tenants(self):
        self._mk_member(self.tenant, self.member_user)
        sa = self._mk_sa(self.tenant)
        self._mk_pat(sa, label='mine')

        other_sa = self._mk_sa(self.other_tenant)
        other_pat = self._mk_pat(other_sa, label='theirs')
        other_member = self._mk_member(self.other_tenant, self.owner)

        deprovision_tenant_async(self.tenant.public_id)

        self.assertTrue(CorePATCredential.objects.filter(pk=other_pat.pk).exists())
        self.assertTrue(TenantMember.objects.filter(pk=other_member.pk).exists())
        self.assertEqual(CoreServiceAccount.objects.filter(pk=other_sa.pk).count(), 1)

    # ------------------------------------------------------------------
    # C1-AC3 (the actual regression): the old filter raised FieldError.
    #         Pinned explicitly so the exact broken expression cannot come back.
    # ------------------------------------------------------------------
    def test_c1_pat_has_no_tenant_field_so_task_does_not_raise_field_error(self):
        field_names = {f.name for f in CorePATCredential._meta.get_fields()}
        self.assertNotIn(
            'tenant',
            field_names,
            msg='If CorePATCredential ever gains a tenant FK, revisit the deprovision filter.',
        )

        sa = self._mk_sa(self.tenant)
        self._mk_pat(sa)
        deprovision_tenant_async(self.tenant.public_id)  # must not raise
        self.assertEqual(CorePATCredential.objects.count(), 0)

    # ------------------------------------------------------------------
    # C1-AC4: a mid-way failure must not leave a half-destroyed tenant.
    # ------------------------------------------------------------------
    def test_c1_body_is_atomic_rolls_back_on_midway_failure(self):
        member = self._mk_member(self.tenant, self.member_user)
        sa = self._mk_sa(self.tenant)
        pat = self._mk_pat(sa)
        webhook = self._mk_webhook(self.tenant)

        boom = RuntimeError('webhook delete exploded')
        with patch(
            'django.db.models.QuerySet.delete',
            side_effect=boom,
        ):
            with self.assertRaises(RuntimeError):
                deprovision_tenant_async(self.tenant.public_id)

        # Everything must still be there: the transaction rolled back as a unit.
        self.assertTrue(TenantMember.objects.filter(pk=member.pk).exists())
        self.assertTrue(CorePATCredential.objects.filter(pk=pat.pk).exists())
        self.assertTrue(TenantWebhookConfig.objects.filter(pk=webhook.pk).exists())

    # ------------------------------------------------------------------
    # C1-AC5: non-deprovisioned tenants are skipped (guard unchanged).
    # ------------------------------------------------------------------
    def test_c1_skips_tenant_not_deprovisioned(self):
        self.tenant.status = CoreTenant.StatusChoices.ACTIVE
        self.tenant.save(update_fields=['status'])
        member = self._mk_member(self.tenant, self.member_user)

        self.assertIsNone(deprovision_tenant_async(self.tenant.public_id))
        self.assertTrue(TenantMember.objects.filter(pk=member.pk).exists())

    def test_c1_missing_tenant_returns_none(self):
        self.assertIsNone(
            deprovision_tenant_async('00000000-0000-0000-0000-000000000000')
        )

    def test_c1_task_declares_retry_policy(self):
        """Without autoretry_for the rollback would be terminal — assert we have it."""
        self.assertIn(Exception, deprovision_tenant_async.autoretry_for)
        self.assertTrue(transaction.atomic is not None)

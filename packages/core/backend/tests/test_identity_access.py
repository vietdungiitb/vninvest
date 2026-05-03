"""
SAAS-13: identity_access model and authentication tests.

Uses Django's TestCase for DB isolation.

ISOLATION RULE: No imports from backend.portfolio or backend.* allowed.
"""
import os
import sys

# Ensure src/ is on sys.path
_src_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src'))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest_core.settings')

import django
django.setup()

from django.contrib.auth.models import User
from django.test import TestCase

from identity_access.models import (
    CorePATCredential,
    CoreServiceAccount,
    CoreTenant,
    _extract_pat_prefix,
    _hash_pat_secret,
)


class CoreTenantModelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='tenantowner', password='testpass123')

    def test_create_tenant(self):
        tenant = CoreTenant.objects.create(
            owner_user=self.user,
            tenant_code='test-tenant-1',
            display_name='Test Tenant',
            plan='pro',
        )
        self.assertIsNotNone(tenant.public_id)
        self.assertEqual(len(tenant.public_id), 36)  # UUID4
        self.assertEqual(tenant.tenant_id, tenant.public_id)
        self.assertEqual(tenant.plan, 'pro')
        self.assertEqual(tenant.status, 'active')

    def test_tenant_auto_uuid(self):
        tenant = CoreTenant.objects.create(
            owner_user=self.user,
            tenant_code='test-tenant-2',
            display_name='UUID Test',
        )
        # public_id must be a valid UUID4 (36 chars)
        self.assertEqual(len(tenant.public_id), 36)
        self.assertIn('-', tenant.public_id)


class CoreServiceAccountModelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='saowner', password='testpass123')
        self.tenant = CoreTenant.objects.create(
            owner_user=self.user,
            tenant_code='sa-tenant-1',
            display_name='SA Tenant',
        )

    def test_create_service_account(self):
        sa = CoreServiceAccount.objects.create(
            tenant=self.tenant,
            name='CI Pipeline Bot',
            scopes=['read:market', 'write:signals'],
        )
        self.assertIsNotNone(sa.public_id)
        self.assertEqual(sa.status, 'active')
        self.assertEqual(sa.scopes, ['read:market', 'write:signals'])
        self.assertEqual(sa.tenant_id, self.tenant.pk)

    def test_service_account_belongs_to_tenant(self):
        sa = CoreServiceAccount.objects.create(
            tenant=self.tenant,
            name='Bot 2',
        )
        self.assertEqual(sa.tenant.pk, self.tenant.pk)


class CorePATCredentialModelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='patowner', password='testpass123')
        self.tenant = CoreTenant.objects.create(
            owner_user=self.user,
            tenant_code='pat-tenant-1',
            display_name='PAT Tenant',
        )
        self.sa = CoreServiceAccount.objects.create(
            tenant=self.tenant,
            name='PAT Bot',
        )

    def test_issue_pat_returns_credential_and_raw_secret(self):
        credential, raw_secret = CorePATCredential.issue_for_service_account(
            service_account=self.sa,
            scopes=['read:market'],
            label='Test PAT',
        )
        self.assertIsNotNone(credential.pk)
        self.assertIsNotNone(raw_secret)
        self.assertTrue(raw_secret.startswith('vni_'))
        self.assertEqual(credential.token_prefix, _extract_pat_prefix(raw_secret))
        self.assertEqual(credential.token_secret_hash, _hash_pat_secret(raw_secret))
        self.assertFalse(credential.revoked)

    def test_resolve_from_raw_secret(self):
        credential, raw_secret = CorePATCredential.issue_for_service_account(
            service_account=self.sa,
            scopes=['read:whale'],
        )
        resolved = CorePATCredential.resolve_from_raw_secret(raw_secret)
        self.assertIsNotNone(resolved)
        self.assertEqual(resolved.pk, credential.pk)

    def test_resolve_returns_none_for_invalid_secret(self):
        resolved = CorePATCredential.resolve_from_raw_secret('vni_not_a_real_token_abc123')
        self.assertIsNone(resolved)

    def test_revoke_pat(self):
        credential, raw_secret = CorePATCredential.issue_for_service_account(
            service_account=self.sa,
            scopes=['read:market'],
        )
        credential.revoke_pat(reason='rotation')
        credential.refresh_from_db()
        self.assertTrue(credential.revoked)
        self.assertEqual(credential.status, 'revoked')
        self.assertIsNotNone(credential.revoked_at)
        self.assertEqual(credential.audit_reason, 'rotation')
        # effective_status must be revoked
        self.assertEqual(credential.effective_status, 'revoked')
        # resolve must fail after revoke
        resolved = CorePATCredential.resolve_from_raw_secret(raw_secret)
        self.assertIsNone(resolved)

    def test_pat_token_prefix_is_12_chars(self):
        credential, raw_secret = CorePATCredential.issue_for_service_account(
            service_account=self.sa,
            scopes=[],
        )
        self.assertEqual(len(credential.token_prefix), 12)

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
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

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


class CorePartnerServiceAccountApiTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='apiowner', password='testpass123')
        self.tenant = CoreTenant.objects.create(
            owner_user=self.user,
            tenant_code='api-tenant-1',
            display_name='API Tenant',
            plan='pro',
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_service_account_list_uses_created_at_cursor_pagination_and_create_succeeds(self):
        existing = CoreServiceAccount.objects.create(
            tenant=self.tenant,
            name='Existing Bot',
            scopes=['pol_market_read'],
            metadata={'environment': 'prod'},
        )

        list_response = self.client.get('/core/v1/partner/service-accounts/')

        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertIn('results', list_response.data)
        self.assertEqual(list_response.data['results'][0]['service_account_id'], existing.public_id)
        self.assertEqual(list_response.data['results'][0]['environment'], 'prod')
        self.assertEqual(list_response.data['results'][0]['policy_ids'], ['pol_market_read'])

        create_response = self.client.post(
            '/core/v1/partner/service-accounts/',
            {
                'name': 'New Bot',
                'environment': 'staging',
                'policy_ids': ['pol_market_read', 'pol_signals_read'],
            },
            format='json',
        )

        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(create_response.data['name'], 'New Bot')
        self.assertEqual(create_response.data['id'], create_response.data['service_account_id'])
        self.assertEqual(create_response.data['tenant_id'], self.tenant.public_id)
        self.assertEqual(create_response.data['environment'], 'staging')
        self.assertEqual(create_response.data['policy_ids'], ['pol_market_read', 'pol_signals_read'])

        created_service_account = CoreServiceAccount.objects.get(public_id=create_response.data['service_account_id'])
        self.assertEqual(created_service_account.scopes, ['market:read', 'signals:read'])
        self.assertEqual(created_service_account.metadata.get('environment'), 'staging')
        self.assertEqual(created_service_account.metadata.get('policy_ids'), ['pol_market_read', 'pol_signals_read'])

        issue_response = self.client.post(
            '/core/v1/partner/pats/issue/',
            {
                'service_account_id': created_service_account.public_id,
                'scope_codes': ['market:read'],
                'display_name': 'Policy-backed PAT',
            },
            format='json',
        )

        self.assertEqual(issue_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(issue_response.data['scope_codes'], ['market:read'])


class CorePartnerPATApiTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='partnerpatowner', password='testpass123')
        self.tenant = CoreTenant.objects.create(
            owner_user=self.user,
            tenant_code='partner-pat-tenant-1',
            display_name='Partner PAT Tenant',
            plan='pro',
        )
        self.service_account = CoreServiceAccount.objects.create(
            tenant=self.tenant,
            name='Partner PAT Bot',
            scopes=['manage_pats', 'market:read', 'signals:read'],
            metadata={'environment': 'prod'},
        )
        self.other_user = User.objects.create_user(username='otherpatowner', password='testpass123')
        self.other_tenant = CoreTenant.objects.create(
            owner_user=self.other_user,
            tenant_code='partner-pat-tenant-2',
            display_name='Other Partner PAT Tenant',
            plan='pro',
        )
        self.other_service_account = CoreServiceAccount.objects.create(
            tenant=self.other_tenant,
            name='Other Partner PAT Bot',
            scopes=['manage_pats'],
            metadata={'environment': 'prod'},
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_issue_pat_returns_frontend_contract_and_secret_authenticates(self):
        issue_response = self.client.post(
            '/core/v1/partner/pats/issue/',
            {
                'service_account_id': self.service_account.public_id,
                'scope_codes': ['market:read', 'signals:read'],
                'display_name': 'Tenant UI PAT',
                'audit_reason': 'tenant_admin_issue_pat',
            },
            format='json',
        )

        self.assertEqual(issue_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(issue_response.data['object'], 'pat_credential')
        self.assertEqual(issue_response.data['id'], issue_response.data['pat_id'])
        self.assertEqual(issue_response.data['service_account_id'], self.service_account.public_id)
        self.assertEqual(issue_response.data['tenant_id'], self.tenant.public_id)
        self.assertEqual(issue_response.data['display_name'], 'Tenant UI PAT')
        self.assertEqual(issue_response.data['scope_codes'], ['market:read', 'signals:read'])
        self.assertEqual(issue_response.data['status'], CorePATCredential.StatusChoices.ACTIVE)
        self.assertTrue(issue_response.data['secret'].startswith('vni_'))

        auth_client = APIClient()
        auth_client.credentials(HTTP_AUTHORIZATION=f"Bearer {issue_response.data['secret']}")
        profile_response = auth_client.get('/core/v1/auth/me/')

        self.assertEqual(profile_response.status_code, status.HTTP_200_OK)
        self.assertEqual(profile_response.data['username'], self.user.username)
        self.assertEqual(profile_response.data['tenant']['tenant_id'], self.tenant.public_id)

    def test_rotate_pat_returns_nested_new_token_and_keeps_old_token_in_grace_window(self):
        credential, old_secret = CorePATCredential.issue_for_service_account(
            service_account=self.service_account,
            scopes=['market:read'],
            label='Rotate Me',
            audit_reason='tenant_admin_issue_pat',
        )

        rotate_response = self.client.post(
            f'/core/v1/partner/pats/{credential.public_id}/rotate/',
            {
                'grace_period_seconds': 1800,
                'audit_reason': 'tenant_admin_rotate_pat',
            },
            format='json',
        )

        self.assertEqual(rotate_response.status_code, status.HTTP_200_OK)
        self.assertEqual(rotate_response.data['object'], 'pat_rotation')
        self.assertEqual(rotate_response.data['old_token_id'], credential.public_id)
        self.assertEqual(rotate_response.data['new_token']['object'], 'pat_credential')
        self.assertEqual(rotate_response.data['new_token']['status'], CorePATCredential.StatusChoices.ACTIVE)
        self.assertEqual(rotate_response.data['new_token']['scope_codes'], ['market:read'])
        self.assertTrue(rotate_response.data['new_token']['secret'].startswith('vni_'))
        self.assertIsNotNone(rotate_response.data['old_token_grace_until'])

        credential.refresh_from_db()
        self.assertEqual(credential.status, 'rotating')
        self.assertIsNotNone(credential.expires_at)
        self.assertGreater(credential.expires_at, timezone.now())

        old_pat_client = APIClient()
        old_pat_client.credentials(HTTP_AUTHORIZATION=f'Bearer {old_secret}')
        old_profile_response = old_pat_client.get('/core/v1/auth/me/')
        self.assertEqual(old_profile_response.status_code, status.HTTP_200_OK)

        new_pat_client = APIClient()
        new_pat_client.credentials(HTTP_AUTHORIZATION=f"Bearer {rotate_response.data['new_token']['secret']}")
        new_profile_response = new_pat_client.get('/core/v1/auth/me/')
        self.assertEqual(new_profile_response.status_code, status.HTTP_200_OK)

    def test_partner_pat_list_excludes_human_session_credentials(self):
        machine_credential, _ = CorePATCredential.issue_for_service_account(
            service_account=self.service_account,
            scopes=['market:read'],
            label='Machine PAT',
            audit_reason='tenant_admin_issue_pat',
        )
        human_credential, _ = CorePATCredential.issue_for_service_account(
            service_account=self.service_account,
            scopes=['market:read'],
            label='login:admin',
            audit_reason='core login',
            is_human_session=True,
        )

        list_response = self.client.get('/core/v1/partner/pats/')

        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        listed_pat_ids = {item['pat_id'] for item in list_response.data['results']}
        self.assertIn(machine_credential.public_id, listed_pat_ids)
        self.assertNotIn(human_credential.public_id, listed_pat_ids)

    def test_rotate_human_session_pat_returns_not_found(self):
        human_credential, _ = CorePATCredential.issue_for_service_account(
            service_account=self.service_account,
            scopes=['market:read'],
            label='login:admin',
            audit_reason='core login',
            is_human_session=True,
        )

        rotate_response = self.client.post(
            f'/core/v1/partner/pats/{human_credential.public_id}/rotate/',
            {
                'grace_period_seconds': 1800,
                'audit_reason': 'tenant_admin_rotate_pat',
            },
            format='json',
        )

        self.assertEqual(rotate_response.status_code, status.HTTP_404_NOT_FOUND)

    def test_revoke_human_session_pat_returns_not_found(self):
        human_credential, _ = CorePATCredential.issue_for_service_account(
            service_account=self.service_account,
            scopes=['market:read'],
            label='login:admin',
            audit_reason='core login',
            is_human_session=True,
        )

        revoke_response = self.client.post(
            f'/core/v1/partner/pats/{human_credential.public_id}/revoke/',
            {'reason': 'tenant_admin_manual_revoke'},
            format='json',
        )

        self.assertEqual(revoke_response.status_code, status.HTTP_404_NOT_FOUND)

    def test_revoke_pat_invalidates_token(self):
        credential, raw_secret = CorePATCredential.issue_for_service_account(
            service_account=self.service_account,
            scopes=['market:read'],
            label='Revoke Me',
            audit_reason='tenant_admin_issue_pat',
        )

        revoke_response = self.client.post(
            f'/core/v1/partner/pats/{credential.public_id}/revoke/',
            {'reason': 'tenant_admin_manual_revoke'},
            format='json',
        )

        self.assertEqual(revoke_response.status_code, status.HTTP_200_OK)
        self.assertEqual(revoke_response.data['object'], 'pat_revocation')
        self.assertEqual(revoke_response.data['token_id'], credential.public_id)
        self.assertEqual(revoke_response.data['status'], CorePATCredential.StatusChoices.REVOKED)

        revoked_pat_client = APIClient()
        revoked_pat_client.credentials(HTTP_AUTHORIZATION=f'Bearer {raw_secret}')
        revoked_profile_response = revoked_pat_client.get('/core/v1/auth/me/')
        self.assertEqual(revoked_profile_response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_cross_tenant_pat_issue_is_blocked(self):
        issue_response = self.client.post(
            '/core/v1/partner/pats/issue/',
            {
                'service_account_id': self.other_service_account.public_id,
                'scope_codes': ['market:read'],
                'display_name': 'Cross Tenant PAT',
            },
            format='json',
        )

        self.assertEqual(issue_response.status_code, status.HTTP_404_NOT_FOUND)

    def test_issue_pat_rejects_scopes_outside_service_account_policy(self):
        issue_response = self.client.post(
            '/core/v1/partner/pats/issue/',
            {
                'service_account_id': self.service_account.public_id,
                'scope_codes': ['manage_service_accounts'],
                'display_name': 'Out Of Policy PAT',
            },
            format='json',
        )

        self.assertEqual(issue_response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_issue_pat_rejects_disabled_service_account(self):
        disabled_service_account = CoreServiceAccount.objects.create(
            tenant=self.tenant,
            name='Disabled Partner PAT Bot',
            status=CoreServiceAccount.StatusChoices.DISABLED,
            scopes=['manage_pats'],
        )

        issue_response = self.client.post(
            '/core/v1/partner/pats/issue/',
            {
                'service_account_id': disabled_service_account.public_id,
                'scope_codes': ['manage_pats'],
                'display_name': 'Disabled SA PAT',
            },
            format='json',
        )

        self.assertEqual(issue_response.status_code, status.HTTP_404_NOT_FOUND)

    def test_issue_pat_allows_staff_without_tenant_using_service_account_id(self):
        admin_user = User.objects.create_user(
            username='globaladmin',
            password='testpass123',
            is_staff=True,
        )
        staff_client = APIClient()
        staff_client.force_authenticate(user=admin_user)

        issue_response = staff_client.post(
            '/core/v1/partner/pats/issue/',
            {
                'service_account_id': self.service_account.public_id,
                'scope_codes': ['market:read'],
                'display_name': 'Admin No Tenant PAT',
            },
            format='json',
        )

        self.assertEqual(issue_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(issue_response.data['service_account_id'], self.service_account.public_id)
        self.assertEqual(issue_response.data['scope_codes'], ['market:read'])
        self.assertTrue(issue_response.data['secret'].startswith('vni_'))

    def test_issue_pat_blocks_non_staff_without_tenant(self):
        no_tenant_user = User.objects.create_user(username='notenant', password='testpass123')
        no_tenant_client = APIClient()
        no_tenant_client.force_authenticate(user=no_tenant_user)

        issue_response = no_tenant_client.post(
            '/core/v1/partner/pats/issue/',
            {
                'service_account_id': self.service_account.public_id,
                'scope_codes': ['market:read'],
                'display_name': 'Should Be Blocked',
            },
            format='json',
        )

        self.assertEqual(issue_response.status_code, status.HTTP_403_FORBIDDEN)

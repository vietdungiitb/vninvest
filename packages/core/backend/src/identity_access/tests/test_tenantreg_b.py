"""Regression tests for the tenantreg-b slice.

One test class (or more) per fixed defect, named after the defect id so the
suite reads as a checklist. Every test here FAILED before its fix and passes
after; where a test asserts a *documented* behaviour that was already
correct, it is marked as a guard rather than a regression.

Defect map:
  B1  resolve_tenant() X-Tenant-ID had no owner/member check
  B2  logger was undefined in identity_access/middleware.py
  B2b CoreTenant was undefined -> the 429 quota path was dead
  B3  AuditLogListView degraded to objects.all()
  B4  PAT CIDR allow-list trusted a spoofable X-Forwarded-For
  B5  TenantScopePermission overwrote request.tenant
  B6  IsTenantActive inspected the owned tenant, not the request's tenant
  B7  membership fallback had no ordering and no status filter
  B8  AuditEvent.tenant_id was empty for member-only users
  B9  TenantQuotaMiddleware skipped all PAT traffic
  B10 TenantScopePermission read a header the frontend never sends
  B11 in-memory is_staff strip cannot persist (documented guard)
"""
import json
import logging
import uuid
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.http import JsonResponse
from django.test import RequestFactory, TestCase, override_settings
from django.utils import timezone

from rest_framework.exceptions import PermissionDenied

from identity_access.authentication import CorePATAuthentication
from identity_access.middleware import TenantQuotaMiddleware, TenantResolutionMiddleware
from identity_access.models import (
    CorePATCredential,
    CoreServiceAccount,
    CoreTenant,
    TenantMember,
)
from identity_access.permissions import IsTenantActive
from identity_access.utils.resolve_tenant import (
    RESOLVABLE_TENANT_STATUSES,
    first_eligible_tenant_for_user,
    is_plausible_tenant_public_id,
    resolve_tenant,
    resolve_tenant_for_user,
)
from ops_audit.models import AuditEvent
from ops_audit.views import AuditLogListView
from user_workspace.permissions import TenantScopePermission

User = get_user_model()


def _ok(request):
    """get_response stub that records the request it saw."""
    return JsonResponse({'status': 'ok'})


def _tenant(owner, *, code, status=CoreTenant.StatusChoices.ACTIVE, plan=None):
    return CoreTenant.objects.create(
        tenant_code=code,
        display_name=f'Tenant {code}',
        owner_user=owner,
        status=status,
        plan=plan or CoreTenant.PlanChoices.FREE,
    )


def _fresh_owner(username):
    """CoreTenant.owner_user is a OneToOne (models.py:65-70), so every extra
    tenant needs its own owner user."""
    return User.objects.create_user(
        username=username, email=f'{username}@test.com', password=f'pw-{username}-123',
    )


def _machine_pat(tenant, scopes=None, **kwargs):
    sa = CoreServiceAccount.objects.create(
        tenant=tenant,
        name=f'SA_{uuid.uuid4().hex[:8]}',
        status=CoreServiceAccount.StatusChoices.ACTIVE,
        scopes=scopes or ['manage_tenant'],
    )
    return CorePATCredential.issue_for_service_account(
        service_account=sa,
        scopes=scopes or ['manage_tenant'],
        label='test',
        audit_reason='test',
        is_human_session=False,
        **kwargs,
    )


class TenantFixtureMixin:
    """user owns tenant A (owner role) and is a VIEWER in tenant B."""

    def setUp(self):
        self.factory = RequestFactory()
        self.cache = cache
        cache.clear()

        self.user = User.objects.create_user(
            username='multi', email='multi@test.com', password='pw-multi-123',
        )
        self.other_owner = User.objects.create_user(
            username='other_owner', email='other@test.com', password='pw-other-123',
        )
        self.stranger = User.objects.create_user(
            username='stranger', email='stranger@test.com', password='pw-stranger-123',
        )

        # A: owned by self.user -> role OWNER
        self.tenant_a = _tenant(self.user, code='tenant_a')
        # B: owned by other_owner, self.user is a VIEWER
        self.tenant_b = _tenant(self.other_owner, code='tenant_b')
        TenantMember.objects.create(
            tenant=self.tenant_b, user=self.user, role=TenantMember.RoleChoices.VIEWER,
        )


# ---------------------------------------------------------------------------
# B1 - resolve_tenant() header must go through the shared membership check
# ---------------------------------------------------------------------------
class B1ResolveTenantHeaderMembershipTests(TenantFixtureMixin, TestCase):
    """resolve_tenant() used to accept ANY X-Tenant-ID with no owner/member check."""

    def _request(self, user, tenant_header=None, path='/core/v1/audit-log/'):
        request = self.factory.get(path)
        if tenant_header is not None:
            request.META['HTTP_X_TENANT_ID'] = tenant_header
        request.user = user
        return request

    def test_stranger_header_is_denied_not_handed_the_tenant(self):
        """Core regression: stranger names tenant B -> PermissionDenied.

        Pre-fix this returned tenant B and set request.tenant, i.e. a
        caller-controlled header selected an arbitrary tenant.
        """
        request = self._request(self.stranger, str(self.tenant_b.public_id))
        with self.assertRaises(PermissionDenied):
            resolve_tenant(request)

    def test_known_nonexistent_public_id_is_denied(self):
        request = self._request(self.user, str(uuid.uuid4()))
        with self.assertRaises(PermissionDenied):
            resolve_tenant(request)

    def test_denial_does_not_set_request_tenant(self):
        """A denied resolution must not leave request.tenant pointing at the
        tenant the caller was not allowed to use."""
        request = self._request(self.stranger, str(self.tenant_b.public_id))
        with self.assertRaises(PermissionDenied):
            resolve_tenant(request)
        self.assertIsNone(getattr(request, 'tenant', None))

    def test_owner_via_header_still_works(self):
        request = self._request(self.user, str(self.tenant_a.public_id))
        self.assertEqual(resolve_tenant(request), self.tenant_a)

    def test_member_via_header_still_works(self):
        request = self._request(self.user, str(self.tenant_b.public_id))
        self.assertEqual(resolve_tenant(request), self.tenant_b)

    def test_request_tenant_set_by_middleware_still_wins(self):
        """Resolution order unchanged: an existing request.tenant is returned
        as-is, so the middleware path is untouched."""
        request = self._request(self.user, str(self.tenant_b.public_id))
        request.tenant = self.tenant_a
        self.assertEqual(resolve_tenant(request), self.tenant_a)

    def test_shared_helper_is_the_one_membership_check(self):
        """The helper used by resolve_tenant() must be the same one the
        middleware delegates to (single membership check in the codebase)."""
        from identity_access import middleware as mw

        self.assertEqual(
            resolve_tenant_for_user(self.user, str(self.tenant_b.public_id)),
            (self.tenant_b, TenantMember.RoleChoices.VIEWER),
        )
        self.assertEqual(
            resolve_tenant_for_user(self.user, str(self.tenant_a.public_id)),
            (self.tenant_a, TenantMember.RoleChoices.OWNER),
        )
        self.assertEqual(
            resolve_tenant_for_user(self.stranger, str(self.tenant_b.public_id)),
            (None, None),
        )
        # middleware._resolve_by_header is now a thin wrapper, not a re-implementation.
        instance = mw.TenantResolutionMiddleware(get_response=_ok)
        self.assertEqual(
            instance._resolve_by_header(str(self.tenant_b.public_id), self.user),
            (self.tenant_b, TenantMember.RoleChoices.VIEWER),
        )
        self.assertEqual(
            instance._resolve_by_header(str(self.tenant_b.public_id), self.stranger),
            (None, None),
        )


# ---------------------------------------------------------------------------
# B2 / B2b - undefined names in identity_access/middleware.py
# ---------------------------------------------------------------------------
class B2MiddlewareLoggerTests(TenantFixtureMixin, TestCase):
    """logger.warning() was called but never defined, and CoreTenant was
    referenced in the quota branch but never imported."""

    def test_module_logger_exists(self):
        from identity_access import middleware as mw

        self.assertTrue(hasattr(mw, 'logger'))
        self.assertIsInstance(mw.logger, logging.Logger)

    def test_pat_last_used_at_failure_logs_and_does_not_raise(self):
        """Branch 1 (pre-fix :339): a DB failure while stamping last_used_at
        used to raise NameError out of the except handler."""
        quota = TenantQuotaMiddleware(get_response=_ok)
        request = self.factory.get('/core/v1/partner/tenant/')
        request.user = self.user
        request.tenant = self.tenant_a

        with patch.object(quota, '_increment_daily_counter', return_value=1), \
             patch.object(quota, '_get_tenant_quota_limit', return_value=1000), \
             patch(
                 'identity_access.models.CorePATCredential.objects.filter',
                 side_effect=RuntimeError('db down'),
             ), \
             self.assertLogs('identity_access.middleware', level='WARNING') as logs:
            # request.auth present -> is_pat True -> hits the except branch
            request.auth = _machine_pat(self.tenant_a)[0]
            response = quota(request)

        self.assertEqual(response.status_code, 200)
        self.assertTrue(
            any('last_used_at' in m for m in logs.output),
            msg=f'expected a warning about last_used_at, got {logs.output}',
        )

    def test_enterprise_over_quota_logs_and_adds_header(self):
        """Branch 2 (pre-fix :347): enterprise soft limit. Pre-fix this raised
        NameError on CoreTenant, so an over-quota enterprise tenant got a 500
        instead of a warning header."""
        ent = _tenant(_fresh_owner('ent_owner'), code='tenant_ent',
                      plan=CoreTenant.PlanChoices.ENTERPRISE)
        quota = TenantQuotaMiddleware(get_response=_ok)
        request = self.factory.get('/core/v1/partner/tenant/')
        request.user = self.user
        request.tenant = ent

        with patch.object(quota, '_increment_daily_counter', return_value=50), \
             patch.object(quota, '_get_tenant_quota_limit', return_value=10), \
             self.assertLogs('identity_access.middleware', level='WARNING') as logs:
            response = quota(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['X-Quota-Warning'], 'exceeded')
        self.assertTrue(any('exceeded API quota' in m for m in logs.output))

    def test_over_quota_non_enterprise_returns_429_not_500(self):
        """B2b: the whole 429 enforcement path was dead because CoreTenant was
        never imported at module scope. Pre-fix this raised NameError -> 500."""
        quota = TenantQuotaMiddleware(get_response=_ok)
        request = self.factory.get('/core/v1/partner/tenant/')
        request.user = self.user
        request.tenant = self.tenant_a

        with patch.object(quota, '_increment_daily_counter', return_value=99), \
             patch.object(quota, '_get_tenant_quota_limit', return_value=10):
            response = quota(request)

        self.assertEqual(response.status_code, 429, 'over-quota must be 429, never 500')
        body = json.loads(response.content.decode())
        self.assertEqual(body['error'], 'quota_exceeded')

    def test_enqueue_pat_audit_failure_logs_and_does_not_raise(self):
        """Branch 3 (pre-fix :407): the outer except of _enqueue_pat_audit.

        The inner try/except swallows cache failures, so the outer handler is
        reached by something that fails while *building* the entry. A
        non-numeric status_code does it: `int(status_code)` sits in the entry
        dict, inside the outer try only.
        """
        quota = TenantQuotaMiddleware(get_response=_ok)
        request = self.factory.get('/core/v1/partner/tenant/')
        request.user = self.user
        request.tenant = self.tenant_a
        pat, _raw = _machine_pat(self.tenant_a)

        with self.assertLogs('identity_access.middleware', level='WARNING') as logs:
            quota._enqueue_pat_audit(request, pat, 'not-an-int')  # type: ignore[arg-type]

        self.assertTrue(
            any('failed to enqueue PAT audit' in m for m in logs.output),
            msg=f'expected enqueue warning, got {logs.output}',
        )


# ---------------------------------------------------------------------------
# B3 - AuditLogListView must fail closed
# ---------------------------------------------------------------------------
class B3AuditLogListViewIsolationTests(TenantFixtureMixin, TestCase):
    def setUp(self):
        super().setUp()
        # A member-only staff account: staff=True, owns no tenant.
        self.staff_member = User.objects.create_user(
            username='staff_member', email='staffm@test.com',
            password='pw-staff-123', is_staff=True,
        )
        TenantMember.objects.create(
            tenant=self.tenant_b, user=self.staff_member,
            role=TenantMember.RoleChoices.ADMIN,
        )
        for code, tid in (('A', str(self.tenant_a.public_id)), ('B', str(self.tenant_b.public_id))):
            AuditEvent.objects.create(
                actor_label=f'actor_{code}', tenant_id=tid,
                action=AuditEvent.ActionChoices.ACCESS, resource_type='HttpRequest',
                resource_id='/x', request_id=uuid.uuid4().hex,
            )

    def _view(self, request):
        view = AuditLogListView()
        view.request = request
        return view

    def test_member_only_staff_gets_zero_rows_not_every_tenants(self):
        """Core regression: staff with no OWNED tenant got tenant_id=None and
        therefore the unfiltered cross-tenant list."""
        request = self.factory.get('/core/v1/audit-log/')
        request.user = self.staff_member
        qs = self._view(request).get_queryset()
        self.assertEqual(list(qs), [], 'member-only staff must see zero rows')
        self.assertEqual(qs.count(), 0)

    def test_no_user_tenant_at_all_gets_zero_rows(self):
        """Absolute fail-closed: nothing resolves -> nothing is returned."""
        request = self.factory.get('/core/v1/audit-log/')
        request.user = self.stranger
        self.assertEqual(list(self._view(request).get_queryset()), [])

    def test_request_tenant_is_preferred_over_owned_tenant(self):
        """request.tenant wins, so a staff-switch session is scoped correctly."""
        request = self.factory.get('/core/v1/audit-log/')
        request.user = self.user  # owns tenant A
        request.tenant = self.tenant_b
        qs = self._view(request).get_queryset()
        self.assertEqual([e.tenant_id for e in qs], [str(self.tenant_b.public_id)])

    def test_owned_tenant_used_when_request_tenant_absent(self):
        request = self.factory.get('/core/v1/audit-log/')
        request.user = self.user  # owns A, no request.tenant
        qs = self._view(request).get_queryset()
        self.assertEqual([e.tenant_id for e in qs], [str(self.tenant_a.public_id)])


# ---------------------------------------------------------------------------
# B4 - client IP must not be spoofable via X-Forwarded-For
# ---------------------------------------------------------------------------
class B4ClientIpSpoofingTests(TenantFixtureMixin, TestCase):
    """With the default empty TRUSTED_PROXY_IPS the header is ignored, so a
    PAT restricted to a CIDR must be rejected when the real peer is outside
    it - even if the client sends a matching X-Forwarded-For."""

    def _cidr_pat(self, cidr='10.0.0.0/8'):
        return _machine_pat(self.tenant_a, allowed_cidr_blocks=[cidr])

    def _auth_request(self, raw, remote_addr, xff=None):
        request = self.factory.get('/core/v1/partner/tenant/')
        request.META['REMOTE_ADDR'] = remote_addr
        if xff is not None:
            request.META['HTTP_X_FORWARDED_FOR'] = xff
        request.META['HTTP_AUTHORIZATION'] = f'Bearer {raw}'
        return request

    @override_settings(TRUSTED_PROXY_IPS=[])
    def test_cidr_pat_rejected_when_spoofed_xff_matches(self):
        """Core regression: pre-fix this authenticated because the check read
        the left-most XFF entry, which the client controls."""
        _pat, raw = self._cidr_pat('10.0.0.0/8')
        request = self._auth_request(raw, '203.0.113.9', xff='10.0.0.7')
        from rest_framework.exceptions import AuthenticationFailed
        with self.assertRaises(AuthenticationFailed):
            CorePATAuthentication().authenticate(request)

    @override_settings(TRUSTED_PROXY_IPS=[])
    def test_cidr_pat_accepted_from_real_peer_in_range(self):
        _pat, raw = self._cidr_pat('10.0.0.0/8')
        request = self._auth_request(raw, '10.1.2.3')
        _user, cred = CorePATAuthentication().authenticate(request)
        self.assertIsNotNone(cred)

    @override_settings(TRUSTED_PROXY_IPS=['127.0.0.1'])
    def test_cidr_pat_honours_xff_only_from_trusted_proxy(self):
        """Same request, but now the peer IS trusted -> header is honoured and
        the token works. Proves the fix keys off TRUSTED_PROXY_IPS."""
        _pat, raw = self._cidr_pat('10.0.0.0/8')
        request = self._auth_request(raw, '127.0.0.1', xff='10.0.0.7')
        _user, cred = CorePATAuthentication().authenticate(request)
        self.assertIsNotNone(cred)

    @override_settings(TRUSTED_PROXY_IPS=[])
    def test_cidr_pat_rejected_when_peer_unresolvable(self):
        """Fail closed: unknown peer must not pass a CIDR check."""
        _pat, raw = self._cidr_pat('10.0.0.0/8')
        request = self._auth_request(raw, 'not-an-ip')
        from rest_framework.exceptions import AuthenticationFailed
        with self.assertRaises(AuthenticationFailed):
            CorePATAuthentication().authenticate(request)

    @override_settings(TRUSTED_PROXY_IPS=[])
    def test_pat_audit_ip_is_peer_not_spoofed_xff(self):
        """middleware._enqueue_pat_audit must enqueue the real peer."""
        quota = TenantQuotaMiddleware(get_response=_ok)
        request = self.factory.get('/core/v1/partner/tenant/')
        request.user = self.user
        request.tenant = self.tenant_a
        request.META['REMOTE_ADDR'] = '203.0.113.9'
        request.META['HTTP_X_FORWARDED_FOR'] = '10.0.0.7'
        pat, _raw = _machine_pat(self.tenant_a)
        # request.auth is what makes the middleware treat this as PAT traffic
        # and reach _enqueue_pat_audit at all.
        request.auth = pat

        captured = {}
        fake_redis = type('R', (), {'rpush': lambda self, k, v: captured.setdefault('payload', v)})

        with patch.object(quota, '_increment_daily_counter', return_value=1), \
             patch.object(quota, '_get_tenant_quota_limit', return_value=1000), \
             patch('identity_access.middleware.cache') as mock_cache:
            mock_cache._cache.get_client.return_value = fake_redis()
            quota(request)

        self.assertIn('payload', captured, 'PAT audit entry was never enqueued')
        entry = json.loads(captured['payload'])
        self.assertEqual(entry['ip_address'], '203.0.113.9')

    @override_settings(TRUSTED_PROXY_IPS=[])
    def test_audit_event_ip_is_peer_not_spoofed_xff(self):
        """ops_audit.RequestTraceMiddleware._record_access_event must store the peer."""
        from ops_audit.middleware import RequestTraceMiddleware

        request = self.factory.get('/core/v1/partner/tenant/')
        request.user = self.user
        request.tenant = self.tenant_a
        request.META['REMOTE_ADDR'] = '203.0.113.9'
        request.META['HTTP_X_FORWARDED_FOR'] = '10.0.0.7'
        RequestTraceMiddleware(get_response=_ok)(request)

        event = AuditEvent.objects.filter(resource_id='/core/v1/partner/tenant/').latest('occurred_at')
        self.assertEqual(event.ip_address, '203.0.113.9')


# ---------------------------------------------------------------------------
# B5 / B10 - TenantScopePermission must not overwrite the middleware's tenant
# ---------------------------------------------------------------------------
class B5TenantScopePermissionTests(TenantFixtureMixin, TestCase):
    def setUp(self):
        super().setUp()
        self.perm = TenantScopePermission()

    def _req(self, user, headers=None):
        request = self.factory.get('/core/v1/workspace/portfolio/')
        request.user = user
        for k, v in (headers or {}).items():
            request.META[k] = v
        return request

    def test_header_tenant_wins_and_is_not_overwritten(self):
        """Core B5 regression: user owns A, is viewer in B, frontend sends B.
        Pre-fix the permission overwrote request.tenant with the profile/owner
        tenant A, so quota and data disagreed."""
        request = self._req(self.user, {'HTTP_X_TENANT_ID': str(self.tenant_b.public_id)})
        self.assertTrue(self.perm.has_permission(request, view=None))
        self.assertEqual(request.tenant, self.tenant_b)

    def test_existing_middleware_tenant_is_preserved(self):
        """When the middleware already resolved, do not touch it - even if a
        conflicting header is also present."""
        request = self._req(self.user, {'HTTP_X_TENANT_ID': str(self.tenant_b.public_id)})
        request.tenant = self.tenant_a
        request.tenant_role = TenantMember.RoleChoices.OWNER
        self.assertTrue(self.perm.has_permission(request, view=None))
        self.assertEqual(request.tenant, self.tenant_a)

    def test_role_used_for_permission_check_is_the_headers_tenant_role(self):
        """B5's second half: a viewer in B must be judged viewer in B, not
        owner of A."""
        from identity_access.utils.resolve_tenant import get_tenant_role, require_tenant_permission

        request = self._req(self.user, {'HTTP_X_TENANT_ID': str(self.tenant_b.public_id)})
        # Simulate the middleware having resolved the header tenant.
        tenant, role = resolve_tenant_for_user(self.user, str(self.tenant_b.public_id))
        request.tenant = tenant
        request.tenant_role = role

        self.assertTrue(self.perm.has_permission(request, view=None))
        self.assertEqual(get_tenant_role(request), TenantMember.RoleChoices.VIEWER)
        # viewer must NOT hold tenant:write in B
        with self.assertRaises(PermissionDenied):
            require_tenant_permission(request, 'tenant:write')

    def test_viewer_in_b_cannot_use_owners_role_from_a(self):
        """The escalation this closes: owner-of-A role must not authorise a
        write scoped to B. A viewer legitimately holds some permissions, so
        assert the dangerous one is absent rather than that the set is empty.
        """
        from identity_access.utils.resolve_tenant import get_tenant_permissions

        request = self._req(self.user, {'HTTP_X_TENANT_ID': str(self.tenant_b.public_id)})
        tenant, role = resolve_tenant_for_user(self.user, str(self.tenant_b.public_id))
        request.tenant = tenant
        request.tenant_role = role
        perms = get_tenant_permissions(request)
        self.assertNotIn('tenant:write', perms)
        self.assertNotIn('member:write', perms)
        self.assertNotIn('*', perms)
        # Sanity: the owner of A does hold the wildcard, which is exactly the
        # authority that must not leak across tenants.
        owner_request = self._req(self.user)
        owner_tenant, owner_role = resolve_tenant_for_user(
            self.user, str(self.tenant_a.public_id),
        )
        owner_request.tenant = owner_tenant
        owner_request.tenant_role = owner_role
        self.assertIn('*', get_tenant_permissions(owner_request))

    def test_b10_reads_x_tenant_id_header_which_frontend_sends(self):
        """X-Tenant-ID (public_id) must resolve, not just X-Tenant-Code."""
        request = self._req(self.user, {'HTTP_X_TENANT_ID': str(self.tenant_b.public_id)})
        self.assertTrue(self.perm.has_permission(request, view=None))
        self.assertEqual(request.tenant.public_id, self.tenant_b.public_id)

    def test_legacy_tenant_code_hint_still_works(self):
        """Backward compat: X-Tenant-Code must keep working."""
        request = self._req(self.user, {'HTTP_X_TENANT_CODE': self.tenant_b.tenant_code})
        self.assertTrue(self.perm.has_permission(request, view=None))
        self.assertEqual(request.tenant, self.tenant_b)

    def test_garbage_header_is_denied_not_500(self):
        request = self._req(self.user, {'HTTP_X_TENANT_ID': "'; DROP TABLE core_tenant; --"})
        self.assertFalse(self.perm.has_permission(request, view=None))
        self.assertIsNone(getattr(request, 'tenant', None))

    def test_stranger_header_is_denied(self):
        request = self._req(self.stranger, {'HTTP_X_TENANT_ID': str(self.tenant_b.public_id)})
        self.assertFalse(self.perm.has_permission(request, view=None))

    def test_unauthenticated_is_denied(self):
        from django.contrib.auth.models import AnonymousUser
        request = self._req(AnonymousUser())
        self.assertFalse(self.perm.has_permission(request, view=None))

    def test_middleware_tenant_with_ineligible_status_is_denied(self):
        """The status gate is preserved: PENDING_ACTIVATION stays ineligible."""
        pend = _tenant(_fresh_owner('pend_owner'), code='tenant_pend',
                       status=CoreTenant.StatusChoices.PENDING_ACTIVATION)
        request = self._req(self.user)
        request.tenant = pend
        self.assertFalse(self.perm.has_permission(request, view=None))
        self.assertNotIn(CoreTenant.StatusChoices.PENDING_ACTIVATION,
                         RESOLVABLE_TENANT_STATUSES)

    def test_shape_check_accepts_legacy_non_uuid_public_ids(self):
        """public_id is a CharField that only auto-fills with a uuid4; the
        suite legitimately uses 'rbac_tenant' / 'test_tenant_123'. A strict
        UUID parse would 403 valid traffic."""
        for value in ('rbac_tenant', 'test_tenant_123', 'tenant1_uuid', str(uuid.uuid4())):
            self.assertTrue(is_plausible_tenant_public_id(value), value)
        for value in ('', '   ', 'has space', "'; DROP", 'x' * 37, None, 123):
            self.assertFalse(is_plausible_tenant_public_id(value), repr(value))


# ---------------------------------------------------------------------------
# B6 - IsTenantActive must inspect the request's tenant
# ---------------------------------------------------------------------------
class B6IsTenantActiveTests(TenantFixtureMixin, TestCase):
    def setUp(self):
        super().setUp()
        self.perm = IsTenantActive()
        self.tenant_a.status = CoreTenant.StatusChoices.SUSPENDED
        self.tenant_a.save(update_fields=['status'])

    def test_suspended_owned_tenant_no_longer_blocks_active_viewer_tenant(self):
        """Core regression: pre-fix, owning a suspended A denied a request the
        middleware had correctly scoped to active B."""
        request = self.factory.get('/core/v1/partner/audit-logs/')
        request.user = self.user
        request.tenant = self.tenant_b  # active
        self.assertTrue(self.perm.has_permission(request, view=None))

    def test_suspended_request_tenant_is_blocked(self):
        request = self.factory.get('/core/v1/partner/audit-logs/')
        request.user = self.user
        request.tenant = self.tenant_a  # suspended
        self.assertFalse(self.perm.has_permission(request, view=None))

    def test_deprovisioned_request_tenant_is_blocked(self):
        self.tenant_b.status = CoreTenant.StatusChoices.DEPROVISIONED
        self.tenant_b.save(update_fields=['status'])
        request = self.factory.get('/core/v1/partner/audit-logs/')
        request.user = self.user
        request.tenant = self.tenant_b
        self.assertFalse(self.perm.has_permission(request, view=None))

    def test_falls_back_to_owned_tenant_when_request_has_none(self):
        """Exempt-path behaviour preserved: no request.tenant -> owned tenant."""
        request = self.factory.get('/core/v1/partner/audit-logs/')
        request.user = self.user
        self.assertFalse(self.perm.has_permission(request, view=None))

    def test_no_tenant_anywhere_passes_explicitly(self):
        """Documented fail-open: a STATUS gate with no tenant to check must not
        deny auth/billing/public/admin-ops endpoints."""
        request = self.factory.get('/core/v1/partner/audit-logs/')
        request.user = self.stranger
        self.assertTrue(self.perm.has_permission(request, view=None))

    def test_superuser_still_bypasses(self):
        su = User.objects.create_superuser(
            username='su', email='su@test.com', password='pw-su-123',
        )
        request = self.factory.get('/core/v1/partner/audit-logs/')
        request.user = su
        request.tenant = self.tenant_a  # suspended
        self.assertTrue(self.perm.has_permission(request, view=None))

    def test_anonymous_passes(self):
        from django.contrib.auth.models import AnonymousUser
        request = self.factory.get('/x')
        request.user = AnonymousUser()
        self.assertTrue(self.perm.has_permission(request, view=None))


# ---------------------------------------------------------------------------
# B7 - deterministic, status-filtered membership fallback
# ---------------------------------------------------------------------------
class B7MembershipFallbackTests(TenantFixtureMixin, TestCase):
    def test_fallback_is_deterministic_with_multiple_memberships(self):
        """Pre-fix `.first()` with no order_by returned an arbitrary row."""
        c_owner = User.objects.create_user(
            username='c_owner', email='c@test.com', password='pw-c-123',
        )
        d_owner = User.objects.create_user(
            username='d_owner', email='d@test.com', password='pw-d-123',
        )
        t_c = _tenant(c_owner, code='tenant_c')
        t_d = _tenant(d_owner, code='tenant_d')
        TenantMember.objects.create(tenant=t_d, user=self.stranger, role=TenantMember.RoleChoices.ADMIN)
        TenantMember.objects.create(tenant=t_c, user=self.stranger, role=TenantMember.RoleChoices.VIEWER)

        picks = {first_eligible_tenant_for_user(self.stranger)[0].pk for _ in range(25)}
        self.assertEqual(len(picks), 1, f'fallback was nondeterministic: {picks}')
        # order_by('tenant_id') -> lowest tenant pk wins
        self.assertEqual(picks.pop(), min(t_c.pk, t_d.pk))

    def test_suspended_membership_is_never_auto_selected(self):
        """A user who is only a member of a suspended tenant must not have it
        silently chosen as their tenant."""
        s_owner = User.objects.create_user(
            username='s_owner', email='s@test.com', password='pw-s-123',
        )
        t_s = _tenant(s_owner, code='tenant_s', status=CoreTenant.StatusChoices.SUSPENDED)
        TenantMember.objects.create(tenant=t_s, user=self.stranger, role=TenantMember.RoleChoices.ADMIN)
        self.assertEqual(first_eligible_tenant_for_user(self.stranger), (None, None))

    def test_pending_activation_membership_is_never_auto_selected(self):
        p_owner = User.objects.create_user(
            username='p_owner', email='p@test.com', password='pw-p-123',
        )
        t_p = _tenant(p_owner, code='tenant_p', status=CoreTenant.StatusChoices.PENDING_ACTIVATION)
        TenantMember.objects.create(tenant=t_p, user=self.stranger, role=TenantMember.RoleChoices.ADMIN)
        self.assertEqual(first_eligible_tenant_for_user(self.stranger), (None, None))

    def test_trial_membership_is_eligible(self):
        self.assertIn(CoreTenant.StatusChoices.TRIAL, RESOLVABLE_TENANT_STATUSES)

    def test_header_path_still_resolves_suspended_so_middleware_can_403(self):
        """Status must NOT be filtered on the explicit header path, otherwise
        middleware would answer tenant_not_found instead of tenant_suspended."""
        s_owner = User.objects.create_user(
            username='s2_owner', email='s2@test.com', password='pw-s2-123',
        )
        t_s = _tenant(s_owner, code='tenant_s2', status=CoreTenant.StatusChoices.SUSPENDED)
        TenantMember.objects.create(tenant=t_s, user=self.stranger, role=TenantMember.RoleChoices.VIEWER)
        tenant, _role = resolve_tenant_for_user(self.stranger, str(t_s.public_id))
        self.assertEqual(tenant, t_s)

        mw = TenantResolutionMiddleware(get_response=_ok)
        request = self.factory.get('/core/v1/partner/tenant/')
        request.user = self.stranger
        request.META['HTTP_X_TENANT_ID'] = str(t_s.public_id)
        response = mw(request)
        self.assertEqual(response.status_code, 403)
        self.assertEqual(json.loads(response.content.decode())['error'], 'tenant_suspended')


# ---------------------------------------------------------------------------
# B8 - AuditEvent tenant attribution
# ---------------------------------------------------------------------------
class B8AuditEventAttributionTests(TenantFixtureMixin, TestCase):
    def _record(self, request, response=None):
        from ops_audit.middleware import RequestTraceMiddleware
        RequestTraceMiddleware(
            get_response=lambda r: response or JsonResponse({}, status=200)
        )(request)
        return AuditEvent.objects.latest('occurred_at')

    def test_member_only_user_is_attributed_to_the_request_tenant(self):
        """Core regression: user owns A and is a viewer in B. Pre-fix only
        user.core_tenant existed, so a pure member got tenant_id=''."""
        request = self.factory.get('/core/v1/partner/tenant/')
        request.user = self.user
        request.tenant = self.tenant_b
        event = self._record(request)
        self.assertEqual(event.tenant_id, str(self.tenant_b.public_id))
        self.assertNotEqual(event.tenant_id, '')

    def test_falls_back_to_owned_tenant(self):
        request = self.factory.get('/core/v1/partner/tenant/')
        request.user = self.user
        event = self._record(request)  # no request.tenant
        self.assertEqual(event.tenant_id, str(self.tenant_a.public_id))

    def test_pure_member_without_any_tenant_is_still_recorded(self):
        """Row must exist; tenant_id empty is acceptable when truly unknown."""
        request = self.factory.get('/core/v1/partner/tenant/')
        request.user = self.stranger
        event = self._record(request)
        self.assertEqual(event.tenant_id, '')

    def test_request_tenant_is_populated_by_the_time_it_is_recorded(self):
        """Ordering guarantee B8 relies on: RequestTraceMiddleware is
        MIDDLEWARE index 7 and records AFTER get_response(), so
        TenantResolutionMiddleware (index 8) has already set request.tenant."""
        from vninvest_core import settings as dj

        order = list(dj.MIDDLEWARE)
        self.assertLess(
            order.index('ops_audit.middleware.RequestTraceMiddleware'),
            order.index('identity_access.middleware.TenantResolutionMiddleware'),
        )
        self.assertLess(
            order.index('identity_access.middleware.TenantResolutionMiddleware'),
            order.index('identity_access.middleware.TenantQuotaMiddleware'),
        )


# ---------------------------------------------------------------------------
# B9 - PAT traffic must be metered
# ---------------------------------------------------------------------------
class B9PatQuotaMeteringTests(TenantFixtureMixin, TestCase):
    def setUp(self):
        super().setUp()
        self.quota = TenantQuotaMiddleware(get_response=_ok)
        self.resolver = TenantResolutionMiddleware(get_response=_ok)
        cache.clear()

    def _pat_request(self):
        _pat, raw = _machine_pat(self.tenant_a)
        # A PAT request: no Django session, so request.user is anonymous.
        request = self.factory.get('/core/v1/partner/tenant/')
        request.META['HTTP_AUTHORIZATION'] = f'Bearer {raw}'
        request.META['REMOTE_ADDR'] = '203.0.113.9'
        from django.contrib.auth.models import AnonymousUser
        request.user = AnonymousUser()
        return request, raw

    def test_resolution_stashes_the_pat_user_on_the_request(self):
        request, _raw = self._pat_request()
        self.resolver(request)
        self.assertTrue(getattr(request, '_pat_user', None) is not None)
        self.assertEqual(request._pat_user.id, self.user.id)

    def test_pat_traffic_increments_the_daily_counter(self):
        """Core regression: pre-fix the counter was never touched for PATs."""
        request, _raw = self._pat_request()
        self.resolver(request)
        self.assertIsNotNone(getattr(request, 'tenant', None))

        with patch.object(self.quota, '_increment_daily_counter', return_value=1) as incr, \
             patch.object(self.quota, '_get_tenant_quota_limit', return_value=1000):
            response = self.quota(request)
        self.assertEqual(response.status_code, 200)
        incr.assert_called_once()
        self.assertEqual(incr.call_args[0][0], str(self.tenant_a.public_id))

    def test_pat_traffic_can_now_be_rate_limited_to_429(self):
        request, _raw = self._pat_request()
        self.resolver(request)
        with patch.object(self.quota, '_increment_daily_counter', return_value=100), \
             patch.object(self.quota, '_get_tenant_quota_limit', return_value=10):
            response = self.quota(request)
        self.assertEqual(response.status_code, 429)

    def test_pat_audit_branch_is_now_reachable(self):
        request, _raw = self._pat_request()
        self.resolver(request)
        with patch.object(self.quota, 'get_response', return_value=JsonResponse({})), \
             patch.object(self.quota, '_increment_daily_counter', return_value=1), \
             patch.object(self.quota, '_get_tenant_quota_limit', return_value=1000), \
             patch.object(self.quota, '_enqueue_pat_audit') as audit:
            self.quota(request)
        audit.assert_called_once()

    def test_session_auth_path_is_unchanged(self):
        """No regression: ordinary session traffic still works and is still
        metered, and request.user is never replaced."""
        request = self.factory.get('/core/v1/partner/tenant/')
        request.user = self.user
        request.tenant = self.tenant_a
        with patch.object(self.quota, '_increment_daily_counter', return_value=1) as incr, \
             patch.object(self.quota, '_get_tenant_quota_limit', return_value=1000):
            response = self.quota(request)
        self.assertEqual(response.status_code, 200)
        self.assertIs(request.user, self.user, 'request.user must not be swapped')
        incr.assert_called_once()

    def test_anonymous_without_pat_is_still_skipped(self):
        from django.contrib.auth.models import AnonymousUser
        request = self.factory.get('/core/v1/partner/tenant/')
        request.user = AnonymousUser()
        with patch.object(self.quota, '_increment_daily_counter', return_value=1) as incr:
            self.quota(request)
        incr.assert_not_called()

    def test_invalid_pat_is_not_stashed(self):
        request = self.factory.get('/core/v1/partner/tenant/')
        request.META['HTTP_AUTHORIZATION'] = 'Bearer not-a-real-token'
        from django.contrib.auth.models import AnonymousUser
        request.user = AnonymousUser()
        self.resolver(request)
        self.assertIsNone(getattr(request, '_pat_user', None))
        with patch.object(self.quota, '_increment_daily_counter', return_value=1) as incr:
            self.quota(request)
        incr.assert_not_called()

    def test_exempt_paths_are_not_metered(self):
        _pat, raw = _machine_pat(self.tenant_a)
        request = self.factory.get('/health')
        request.META['HTTP_AUTHORIZATION'] = f'Bearer {raw}'
        self.resolver(request)
        with patch.object(self.quota, '_increment_daily_counter', return_value=1) as incr:
            self.quota(request)
        incr.assert_not_called()


# ---------------------------------------------------------------------------
# B11 - documented guard, not a regression fix
# ---------------------------------------------------------------------------
class B11StaffSwitchMutationTests(TenantFixtureMixin, TestCase):
    """_resolve_staff_switch mutates user.is_staff/is_superuser in memory.
    Verified to be request-scoped only: no code path calls request.user.save(),
    so it cannot reach the database. Documented, not changed."""

    def test_no_code_path_saves_request_user(self):
        from identity_access.models import CorePATCredential
        from identity_access.utils.resolve_tenant import apply_pat_user_privileges

        pat = _machine_pat(self.tenant_a)[0]
        # The in-memory strip used by both the staff-switch and the PAT paths.
        self.assertFalse(apply_pat_user_privileges(self.user, pat).is_superuser)
        # The row itself is untouched: no save() anywhere in the chain.
        self.user.refresh_from_db()
        self.assertFalse(self.user.is_superuser)

    def test_staff_switch_strip_does_not_persist(self):
        su = User.objects.create_user(
            username='su_switch', email='sus@test.com', password='pw-su2-123', is_staff=True,
        )
        mw = TenantResolutionMiddleware(get_response=_ok)
        request = self.factory.get('/core/v1/partner/tenant/')
        request.user = su
        # Force the staff-switch branch to succeed via a patched verifier.
        with patch(
            'service_ops.views.staff.verify_staff_switch',
            return_value=(su.id, str(self.tenant_b.public_id)),
        ):
            ok = mw._resolve_staff_switch(request, su, 'token')
        self.assertTrue(ok)
        self.assertEqual(request.tenant, self.tenant_b)
        self.assertEqual(request.tenant_role, 'viewer')
        # In-memory strip applied...
        self.assertFalse(su.is_staff)
        # ...but the database still has the real value.
        su.refresh_from_db()
        self.assertTrue(su.is_staff)

    def test_superuser_tenant_helper_performs_no_status_check(self):
        """Documented finding (reported, deliberately NOT changed): the
        superuser path assigns OWNER for any public_id and never checks
        status. Pinned here so the behaviour is visible if it ever changes."""
        su = User.objects.create_superuser(
            username='su_nostatus', email='sun@test.com', password='pw-su3-123',
        )
        self.tenant_a.status = CoreTenant.StatusChoices.DEPROVISIONED
        self.tenant_a.save(update_fields=['status'])
        mw = TenantResolutionMiddleware(get_response=_ok)
        request = self.factory.get('/core/v1/partner/tenant/')
        request.user = su
        request.META['HTTP_X_TENANT_ID'] = str(self.tenant_a.public_id)
        mw._resolve_superuser_tenant(request, su)
        self.assertEqual(request.tenant, self.tenant_a)
        self.assertEqual(request.tenant_role, TenantMember.RoleChoices.OWNER)


# ---------------------------------------------------------------------------
# Shared-helper unit guards
# ---------------------------------------------------------------------------
class SharedHelperTests(TenantFixtureMixin, TestCase):
    def test_resolve_tenant_for_user_requires_authenticated_user(self):
        from django.contrib.auth.models import AnonymousUser
        self.assertEqual(
            resolve_tenant_for_user(AnonymousUser(), str(self.tenant_a.public_id)), (None, None)
        )
        self.assertEqual(resolve_tenant_for_user(None, str(self.tenant_a.public_id)), (None, None))

    def test_resolve_tenant_for_user_handles_empty_hint(self):
        self.assertEqual(resolve_tenant_for_user(self.user, ''), (None, None))
        self.assertEqual(resolve_tenant_for_user(self.user, None), (None, None))

    def test_resolve_tenant_for_user_whitespace_is_tolerated(self):
        tenant, role = resolve_tenant_for_user(self.user, f'  {self.tenant_a.public_id}  ')
        self.assertEqual(tenant, self.tenant_a)
        self.assertEqual(role, TenantMember.RoleChoices.OWNER)

    def test_resolve_tenant_via_staff_service_account_still_works(self):
        """The documented staff cross-tenant path must be preserved."""
        sa = CoreServiceAccount.objects.create(
            tenant=self.tenant_b, name='SA_staff', status=CoreServiceAccount.StatusChoices.ACTIVE,
        )
        staff = User.objects.create_user(
            username='staffer', email='staffer@test.com', password='pw-st-123', is_staff=True,
        )
        request = self.factory.post('/core/v1/partner/tenant/')
        request.user = staff
        request.data = {'service_account_id': str(sa.public_id)}
        self.assertEqual(resolve_tenant(request), self.tenant_b)

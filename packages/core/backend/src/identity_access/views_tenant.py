import logging
from datetime import timedelta

from django.db.models import Count
from django.db.models.functions import TruncDate
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from vninvest_core.pagination import CoreCursorPagination

from .models import CorePATCredential, CoreServiceAccount, CoreTenant, PATAuditLog, TenantSettings, UserProfile, TenantCustomRole
from .permissions import IsTenantActive, require_human_session, require_pat_scopes_or_human_session
from .utils.resolve_tenant import resolve_tenant as _get_request_tenant, require_tenant_permission as _require_tenant_permission

logger = logging.getLogger(__name__)
from .serializers import (
    CorePATCredentialSerializer,
    CoreServiceAccountSerializer,
    CoreTenantSerializer,
    PartnerPATIssueSerializer,
    PartnerPATRevokeSerializer,
    PartnerPATRotateSerializer,
    TenantSettingsSerializer,
    TenantCustomRoleSerializer,
)


TENANT_PERMISSION_CLASSES = [permissions.IsAuthenticated, IsTenantActive]
PARTNER_SCOPE_MANAGE_TENANT = 'manage_tenant'
PARTNER_SCOPE_MANAGE_SERVICE_ACCOUNTS = 'manage_service_accounts'
PARTNER_SCOPE_MANAGE_PATS = 'manage_pats'
HUMAN_SESSION_PAT_AUDIT_REASON = 'core login'
HUMAN_SESSION_PAT_LABEL_PREFIX = 'login:'


def _normalize_scope_codes(scope_codes) -> list[str]:
    normalized: list[str] = []
    seen: set[str] = set()
    for raw_scope in scope_codes or []:
        scope = str(raw_scope or '').strip()
        if not scope or scope in seen:
            continue
        seen.add(scope)
        normalized.append(scope)
    return normalized


def _is_human_session_pat(auth) -> bool:
    return bool(isinstance(auth, CorePATCredential) and auth.is_human_session)


def _require_partner_scope(request, required_scope: str) -> None:
    require_pat_scopes_or_human_session(request, required_scope)


def _reject_personal_prefix(*, label: str, audit_reason: str) -> None:
    """D2 (B+A): tiền tố `personal:` do endpoint personal tự gắn — admin endpoints từ chối."""
    field_errors = {}
    if str(label or '').strip().startswith('personal:'):
        field_errors['display_name'] = ['Tiền tố personal: dành riêng cho API key cá nhân.']
    if str(audit_reason or '').strip().startswith('personal:'):
        field_errors['audit_reason'] = ['Tiền tố personal: dành riêng cho API key cá nhân.']
    if field_errors:
        raise ValidationError(field_errors)


def _reject_human_session_markers(*, label: str, audit_reason: str) -> None:
    stripped_label = str(label or '').strip()
    stripped_audit_reason = str(audit_reason or '').strip()
    field_errors = {}

    if stripped_label.startswith(HUMAN_SESSION_PAT_LABEL_PREFIX):
        field_errors['display_name'] = ['display_name này được dành riêng cho phiên đăng nhập người dùng.']

    if stripped_audit_reason == HUMAN_SESSION_PAT_AUDIT_REASON:
        field_errors['audit_reason'] = ['audit_reason này được dành riêng cho phiên đăng nhập người dùng.']

    if field_errors:
        raise ValidationError(field_errors)


def _validate_requested_pat_scopes(request, service_account: CoreServiceAccount, requested_scope_codes) -> list[str]:
    normalized_requested = _normalize_scope_codes(requested_scope_codes)
    allowed_by_service_account = set(_normalize_scope_codes(service_account.scopes))
    disallowed_by_service_account = [
        scope for scope in normalized_requested
        if scope not in allowed_by_service_account
    ]
    if disallowed_by_service_account:
        raise ValidationError(
            {
                'scope_codes': [
                    'Service account không được phép cấp các scope này: '
                    + ', '.join(disallowed_by_service_account)
                    + '.'
                ]
            }
        )

    auth = getattr(request, 'auth', None)
    if not isinstance(auth, CorePATCredential) or _is_human_session_pat(auth):
        return normalized_requested

    granted_by_caller = set(_normalize_scope_codes(auth.scopes))
    disallowed_by_caller = [
        scope for scope in normalized_requested
        if scope not in granted_by_caller
    ]
    if disallowed_by_caller:
        raise PermissionDenied(
            'PAT hiện tại không được phép cấp các scope này: '
            + ', '.join(disallowed_by_caller)
            + '.'
        )

    return normalized_requested


def _serialize_partner_pat(credential: CorePATCredential, *, secret: str | None = None) -> dict:
    payload = CorePATCredentialSerializer(credential).data
    payload['label'] = credential.label
    payload['display_name'] = credential.label
    if secret:
        payload['secret'] = secret
        payload['token'] = secret
        payload['access'] = secret
    return payload


def _resolve_issue_target_service_account(*, request, service_account_id: str) -> CoreServiceAccount:
    tenant = _get_request_tenant(request)
    queryset = CoreServiceAccount.objects.filter(
        public_id=service_account_id,
        status=CoreServiceAccount.StatusChoices.ACTIVE,
        tenant=tenant,
    )
    return generics.get_object_or_404(queryset)


class TenantDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = CoreTenantSerializer
    permission_classes = TENANT_PERMISSION_CLASSES

    def get_object(self):
        _require_partner_scope(self.request, PARTNER_SCOPE_MANAGE_TENANT)
        _require_tenant_permission(self.request, 'tenant:write')
        return _get_request_tenant(self.request)


class ServiceAccountListView(generics.ListCreateAPIView):
    serializer_class = CoreServiceAccountSerializer
    pagination_class = CoreCursorPagination
    permission_classes = TENANT_PERMISSION_CLASSES

    def get_queryset(self):
        _require_partner_scope(self.request, PARTNER_SCOPE_MANAGE_SERVICE_ACCOUNTS)
        _require_tenant_permission(self.request, 'sa:read')
        tenant = _get_request_tenant(self.request)
        return CoreServiceAccount.objects.filter(tenant=tenant).order_by('-created_at')

    def perform_create(self, serializer):
        _require_partner_scope(self.request, PARTNER_SCOPE_MANAGE_SERVICE_ACCOUNTS)
        _require_tenant_permission(self.request, 'sa:write')
        tenant = _get_request_tenant(self.request)
        serializer.save(tenant=tenant)


class ServiceAccountDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = CoreServiceAccountSerializer
    permission_classes = TENANT_PERMISSION_CLASSES

    def get_queryset(self):
        _require_partner_scope(self.request, PARTNER_SCOPE_MANAGE_SERVICE_ACCOUNTS)
        _require_tenant_permission(self.request, 'sa:read')
        tenant = _get_request_tenant(self.request)
        return CoreServiceAccount.objects.filter(tenant=tenant)

    def get_object(self):
        return generics.get_object_or_404(
            self.get_queryset(), public_id=self.kwargs['service_account_id']
        )

    def _ensure_not_last_active_service_account(self, instance: CoreServiceAccount, *, next_status=None, deleting=False):
        if instance.status != CoreServiceAccount.StatusChoices.ACTIVE:
            return

        target_status = next_status or instance.status
        if not deleting and target_status == CoreServiceAccount.StatusChoices.ACTIVE:
            return

        has_other_active_accounts = CoreServiceAccount.objects.filter(
            tenant=instance.tenant,
            status=CoreServiceAccount.StatusChoices.ACTIVE,
        ).exclude(pk=instance.pk).exists()
        if has_other_active_accounts:
            return

        if deleting:
            raise ValidationError({'detail': 'Không thể xóa service account đang hoạt động cuối cùng của tenant.'})
        raise ValidationError({'detail': 'Không thể vô hiệu hóa service account đang hoạt động cuối cùng của tenant.'})

    def perform_update(self, serializer):
        _require_partner_scope(self.request, PARTNER_SCOPE_MANAGE_SERVICE_ACCOUNTS)
        _require_tenant_permission(self.request, 'sa:write')
        instance = self.get_object()
        next_status = serializer.validated_data.get('status', instance.status)
        self._ensure_not_last_active_service_account(instance, next_status=next_status)
        serializer.save()

    def perform_destroy(self, instance):
        _require_partner_scope(self.request, PARTNER_SCOPE_MANAGE_SERVICE_ACCOUNTS)
        _require_tenant_permission(self.request, 'sa:write')
        self._ensure_not_last_active_service_account(instance, deleting=True)
        instance.delete()


class PATListView(generics.ListAPIView):
    serializer_class = CorePATCredentialSerializer
    pagination_class = CoreCursorPagination
    permission_classes = TENANT_PERMISSION_CLASSES

    def get_queryset(self):
        _require_partner_scope(self.request, PARTNER_SCOPE_MANAGE_PATS)
        _require_tenant_permission(self.request, 'pat:read')
        tenant = _get_request_tenant(self.request)
        return CorePATCredential.objects.filter(
            service_account__tenant=tenant,
            is_human_session=False,
        ).select_related('service_account', 'service_account__tenant').order_by('-created_at')


def issue_pat(request, service_account_id):
    """Issue a new PAT for a service account (legacy endpoint)."""
    _require_partner_scope(request, PARTNER_SCOPE_MANAGE_PATS)
    _require_tenant_permission(request, 'pat:write')
    sa = _resolve_issue_target_service_account(request=request, service_account_id=service_account_id)

    scopes = _normalize_scope_codes(request.data.get('scope_codes', []))
    expires_at = request.data.get('expires_at')
    label = str(request.data.get('display_name') or request.data.get('label') or '').strip()
    audit_reason = str(request.data.get('audit_reason', '')).strip()
    _reject_human_session_markers(label=label, audit_reason=audit_reason)
    _reject_personal_prefix(label=label, audit_reason=audit_reason)
    scopes = _validate_requested_pat_scopes(request, sa, scopes)

    credential, raw_token = CorePATCredential.issue_for_service_account(
        service_account=sa,
        scopes=scopes,
        expires_at=expires_at,
        label=label,
        audit_reason=audit_reason,
    )
    return Response(_serialize_partner_pat(credential, secret=raw_token), status=status.HTTP_201_CREATED)


class UserProfileView(APIView):
    """
    GET  /core/v1/identity/profile/  — return authenticated user's UserProfile
    PATCH /core/v1/identity/profile/ — partial update display_name, language, theme, whale_alert_threshold
    """
    permission_classes = TENANT_PERMISSION_CLASSES

    def get(self, request):
        require_human_session(request)
        user = request.user
        profile, _ = UserProfile.objects.get_or_create(
            user=user,
            defaults={
                'display_name': user.get_full_name() or user.username,
            },
        )
        from django.db.models import Q
        from .views.helpers import _build_abilities, _tenant_payload
        user_tenants = CoreTenant.objects.filter(Q(owner_user=user) | Q(members__user=user)).distinct()
        tenant = user_tenants.first()
        abilities = _build_abilities(user, tenant) if tenant else []
        return Response({
            'username': user.username,
            'email': user.email,
            'is_staff': bool(user.is_staff),
            'is_superuser': bool(user.is_superuser),
            'display_name': profile.display_name,
            'avatar_url': profile.avatar_url,
            'language': profile.language,
            'theme': profile.theme,
            'whale_alert_threshold': str(profile.whale_alert_threshold),
            'preferences': profile.preferences,
            'tenants': [_tenant_payload(t) for t in user_tenants],
            'abilities': abilities,
        })

    def patch(self, request):
        require_human_session(request)
        profile, _ = UserProfile.objects.get_or_create(
            user=request.user,
            defaults={
                'display_name': request.user.get_full_name() or request.user.username,
            },
        )
        allowed_fields = {'display_name', 'avatar_url', 'language', 'theme', 'whale_alert_threshold', 'preferences'}
        update_fields = []
        for field in allowed_fields:
            if field in request.data:
                setattr(profile, field, request.data[field])
                update_fields.append(field)
        if update_fields:
            update_fields.append('updated_at')
            profile.save(update_fields=update_fields)
        return Response({
            'username': request.user.username,
            'email': request.user.email,
            'is_staff': bool(request.user.is_staff),
            'is_superuser': bool(request.user.is_superuser),
            'display_name': profile.display_name,
            'avatar_url': profile.avatar_url,
            'language': profile.language,
            'theme': profile.theme,
            'whale_alert_threshold': str(profile.whale_alert_threshold),
            'preferences': profile.preferences,
        })


# ---------------------------------------------------------------------------
# Partner namespace views — tenant self-admin operations at /core/v1/partner/*
# ---------------------------------------------------------------------------

@api_view(['POST'])
@permission_classes(TENANT_PERMISSION_CLASSES)
def partner_issue_pat(request):
    """Issue a new PAT. Takes service_account_id from request body."""
    _require_partner_scope(request, PARTNER_SCOPE_MANAGE_PATS)
    _require_tenant_permission(request, 'pat:write')
    tenant = _get_request_tenant(request)
    serializer = PartnerPATIssueSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    sa_id = serializer.validated_data['service_account_id']
    sa = _resolve_issue_target_service_account(request=request, service_account_id=sa_id)

    scopes = serializer.validated_data.get('scope_codes', [])
    expires_at = serializer.validated_data.get('expires_at')
    label = serializer.validated_data.get('display_name') or serializer.validated_data.get('label') or ''
    audit_reason = serializer.validated_data.get('audit_reason', '')
    allowed_cidr_blocks = serializer.validated_data.get('allowed_cidr_blocks', [])
    _reject_human_session_markers(label=label, audit_reason=audit_reason)
    _reject_personal_prefix(label=label, audit_reason=audit_reason)
    scopes = _validate_requested_pat_scopes(request, sa, scopes)

    credential, raw_token = CorePATCredential.issue_for_service_account(
        service_account=sa,
        scopes=scopes,
        expires_at=expires_at,
        label=label,
        audit_reason=audit_reason,
        allowed_cidr_blocks=allowed_cidr_blocks,
    )
    return Response(_serialize_partner_pat(credential, secret=raw_token), status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes(TENANT_PERMISSION_CLASSES)
def partner_rotate_pat(request, pat_id):
    """Revoke old PAT and issue a replacement for the same service account."""
    _require_partner_scope(request, PARTNER_SCOPE_MANAGE_PATS)
    _require_tenant_permission(request, 'pat:write')
    tenant = _get_request_tenant(request)
    old_pat = generics.get_object_or_404(
        CorePATCredential,
        public_id=pat_id,
        service_account__tenant=tenant,
        is_human_session=False,
    )
    sa = old_pat.service_account
    if sa.status != CoreServiceAccount.StatusChoices.ACTIVE:
        raise ValidationError({'service_account_id': ['Service account đã bị vô hiệu.']})

    serializer = PartnerPATRotateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    scopes = serializer.validated_data.get('scope_codes', old_pat.scopes or [])
    if not scopes:
        scopes = list(old_pat.scopes or [])
    expires_at = serializer.validated_data.get('expires_at')
    label = serializer.validated_data.get('display_name') or serializer.validated_data.get('label') or old_pat.label or ''
    audit_reason = serializer.validated_data.get('audit_reason', '') or 'rotated_by_tenant_admin'
    allowed_cidr_blocks = serializer.validated_data.get('allowed_cidr_blocks', old_pat.allowed_cidr_blocks or [])
    _reject_human_session_markers(label=label, audit_reason=audit_reason)
    _reject_personal_prefix(label=label, audit_reason=audit_reason)
    scopes = _validate_requested_pat_scopes(request, sa, scopes)
    grace_until = old_pat.mark_rotating(
        grace_period_seconds=serializer.validated_data.get('grace_period_seconds', 3600),
        reason=audit_reason,
    )

    credential, raw_token = CorePATCredential.issue_for_service_account(
        service_account=sa,
        scopes=scopes,
        expires_at=expires_at,
        label=label,
        audit_reason=audit_reason,
        allowed_cidr_blocks=allowed_cidr_blocks,
    )
    payload = {
        'object': 'pat_rotation',
        'old_token_id': old_pat.public_id,
        'old_token_grace_until': grace_until.isoformat() if grace_until else None,
        'new_token': _serialize_partner_pat(credential, secret=raw_token),
    }
    return Response(payload, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes(TENANT_PERMISSION_CLASSES)
def partner_revoke_pat(request, pat_id):
    """Revoke a PAT owned by the authenticated tenant."""
    _require_partner_scope(request, PARTNER_SCOPE_MANAGE_PATS)
    _require_tenant_permission(request, 'pat:write')
    tenant = _get_request_tenant(request)
    pat = generics.get_object_or_404(
        CorePATCredential,
        public_id=pat_id,
        service_account__tenant=tenant,
        is_human_session=False,
    )
    serializer = PartnerPATRevokeSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    pat.revoke_pat(reason=serializer.validated_data.get('reason', 'revoked_by_tenant_admin'))
    return Response(
        {
            'object': 'pat_revocation',
            'token_id': pat_id,
            'status': pat.status,
            'revoked_at': pat.revoked_at.isoformat() if pat.revoked_at else None,
        }
    )


class TenantLifecycleView(APIView):
    """Return tenant plan and status for the current authenticated user.

    Used by the frontend dashboard to determine feature gating and
    billing status.  Returns minimal envelope — consumer is expected
    to cache this response on the client side.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        try:
            tenant = _get_request_tenant(request)
        except PermissionDenied:
            return Response(
                {'detail': 'Tenant not found for the current user.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response({
            'plan': tenant.plan,
            'status': tenant.status,
            'tenant_id': tenant.public_id,
            'tenant_code': tenant.tenant_code,
            'display_name': tenant.display_name,
        })


class PartnerUsageMetersView(generics.ListAPIView):
    """Usage meters list — placeholder until usage metering is implemented."""
    permission_classes = TENANT_PERMISSION_CLASSES

    def list(self, request, *args, **kwargs):
        return Response([])


# ---------------------------------------------------------------------------
# PAT / Service Account usage analytics (Phase 1)
# ---------------------------------------------------------------------------

def _parse_days_param(request, default: int = 30, maximum: int = 90) -> int:
    try:
        days = int(request.query_params.get('days', default))
    except (TypeError, ValueError):
        days = default
    return max(1, min(days, maximum))


def _status_breakdown(logs) -> dict:
    counts = logs.values('status_code').annotate(c=Count('id'))
    breakdown = {'2xx': 0, '4xx': 0, '5xx': 0}
    for row in counts:
        code = row['status_code']
        if code < 300:
            breakdown['2xx'] += row['c']
        elif code < 500:
            breakdown['4xx'] += row['c']
        else:
            breakdown['5xx'] += row['c']
    return breakdown


@api_view(['GET'])
@permission_classes(TENANT_PERMISSION_CLASSES)
def partner_pat_usage(request, pat_id):
    """Per-PAT usage breakdown: calls, top IPs/endpoints, status, timeline."""
    _require_partner_scope(request, PARTNER_SCOPE_MANAGE_PATS)
    _require_tenant_permission(request, 'pat:read')
    tenant = _get_request_tenant(request)
    pat = generics.get_object_or_404(
        CorePATCredential,
        public_id=pat_id,
        service_account__tenant=tenant,
        is_human_session=False,
    )
    days = _parse_days_param(request)
    since = timezone.now() - timedelta(days=days)
    logs = PATAuditLog.objects.filter(pat=pat, occurred_at__gte=since)
    total_calls = logs.count()

    top_endpoints = [
        {'endpoint': e['endpoint'], 'count': e['count']}
        for e in logs.values('endpoint').annotate(count=Count('id')).order_by('-count')[:10]
    ]
    timeline = [
        {'date': t['date'].isoformat(), 'count': t['count']}
        for t in logs.annotate(date=TruncDate('occurred_at'))
        .values('date').annotate(count=Count('id')).order_by('date')
    ]

    return Response({
        'pat_id': pat.public_id,
        'label': pat.label,
        'total_calls': total_calls,
        'unique_ips': logs.values('ip_address').distinct().count() if total_calls else 0,
        'top_endpoints': top_endpoints,
        'status_breakdown': _status_breakdown(logs),
        'timeline': timeline,
        'last_used_at': pat.last_used_at.isoformat() if pat.last_used_at else None,
        'expires_at': pat.expires_at.isoformat() if pat.expires_at else None,
    })


@api_view(['GET'])
@permission_classes(TENANT_PERMISSION_CLASSES)
def partner_pat_usage_summary(request):
    """Tenant-wide PAT usage summary."""
    _require_partner_scope(request, PARTNER_SCOPE_MANAGE_PATS)
    _require_tenant_permission(request, 'pat:read')
    tenant = _get_request_tenant(request)
    days = _parse_days_param(request)
    since = timezone.now() - timedelta(days=days)

    pats = CorePATCredential.objects.filter(
        service_account__tenant=tenant,
        is_human_session=False,
    )
    pat_ids = list(pats.values_list('id', flat=True))
    total_calls = (
        PATAuditLog.objects.filter(pat_id__in=pat_ids, occurred_at__gte=since).count()
        if pat_ids else 0
    )
    pats_usage = [
        {
            'pat_id': pat.public_id,
            'label': pat.label,
            'calls_30d': PATAuditLog.objects.filter(pat=pat, occurred_at__gte=since).count(),
            'last_used_at': pat.last_used_at.isoformat() if pat.last_used_at else None,
        }
        for pat in pats
    ]
    return Response({
        'total_pats': pats.count(),
        'active_pats': pats.filter(status=CorePATCredential.StatusChoices.ACTIVE).count(),
        'total_calls_30d': total_calls,
        'pats_usage': pats_usage,
    })


@api_view(['GET'])
@permission_classes(TENANT_PERMISSION_CLASSES)
def partner_service_account_usage(request, sa_id):
    """Per-ServiceAccount usage: PAT breakdown and total calls."""
    _require_partner_scope(request, PARTNER_SCOPE_MANAGE_SERVICE_ACCOUNTS)
    _require_tenant_permission(request, 'sa:read')
    tenant = _get_request_tenant(request)
    sa = generics.get_object_or_404(
        CoreServiceAccount,
        public_id=sa_id,
        tenant=tenant,
    )
    days = _parse_days_param(request)
    since = timezone.now() - timedelta(days=days)

    pats = list(sa.pat_credentials.filter(is_human_session=False))
    total_calls = 0
    pats_usage = []
    for pat in pats:
        calls = PATAuditLog.objects.filter(pat=pat, occurred_at__gte=since).count()
        total_calls += calls
        pats_usage.append({
            'pat_id': pat.public_id,
            'label': pat.label,
            'calls_30d': calls,
            'last_used_at': pat.last_used_at.isoformat() if pat.last_used_at else None,
        })
    return Response({
        'sa_id': sa.public_id,
        'name': sa.name,
        'total_pats': len(pats),
        'total_calls': total_calls,
        'pats': pats_usage,
    })


class PartnerTenantSettingsView(APIView):
    """GET/PUT tenant settings (owner/admin only)."""
    permission_classes = [permissions.IsAuthenticated, IsTenantActive]

    def get(self, request):
        require_pat_scopes_or_human_session(request, 'manage_tenant')
        _require_tenant_permission(request, 'settings:write')
        tenant = _get_request_tenant(request)

        settings_obj, _created = TenantSettings.objects.get_or_create(tenant=tenant)
        serializer = TenantSettingsSerializer(settings_obj)
        return Response(serializer.data)

    def put(self, request):
        require_pat_scopes_or_human_session(request, 'manage_tenant')
        _require_tenant_permission(request, 'settings:write')
        tenant = _get_request_tenant(request)

        settings_obj, _created = TenantSettings.objects.get_or_create(tenant=tenant)
        serializer = TenantSettingsSerializer(settings_obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class PartnerRoleListCreateView(APIView):
    """List and create custom roles for the tenant (owner/admin only)."""
    permission_classes = [permissions.IsAuthenticated, IsTenantActive]

    def get(self, request):
        require_pat_scopes_or_human_session(request, 'manage_tenant')
        _require_tenant_permission(request, 'settings:write')
        tenant = _get_request_tenant(request)
        roles = TenantCustomRole.objects.filter(tenant=tenant).order_by('-is_system', 'name')
        return Response({
            'roles': TenantCustomRoleSerializer(roles, many=True).data,
        })

    def post(self, request):
        require_pat_scopes_or_human_session(request, 'manage_tenant')
        _require_tenant_permission(request, 'settings:write')
        tenant = _get_request_tenant(request)

        serializer = TenantCustomRoleSerializer(data=request.data, tenant=tenant)
        serializer.is_valid(raise_exception=True)
        serializer.save(tenant=tenant)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class PartnerRoleDetailView(APIView):
    """Retrieve, update, delete a custom role (owner/admin only)."""
    permission_classes = [permissions.IsAuthenticated, IsTenantActive]

    def _get_role(self, request, role_id):
        tenant = _get_request_tenant(request)
        try:
            return TenantCustomRole.objects.get(public_id=role_id, tenant=tenant)
        except TenantCustomRole.DoesNotExist:
            from rest_framework.exceptions import NotFound
            raise NotFound('Vai trò không tồn tại.')

    def get(self, request, role_id):
        require_pat_scopes_or_human_session(request, 'manage_tenant')
        _require_tenant_permission(request, 'settings:write')
        role = self._get_role(request, role_id)
        return Response(TenantCustomRoleSerializer(role, tenant=role.tenant).data)

    def patch(self, request, role_id):
        require_pat_scopes_or_human_session(request, 'manage_tenant')
        _require_tenant_permission(request, 'settings:write')
        role = self._get_role(request, role_id)
        if role.is_system:
            from rest_framework.exceptions import PermissionDenied as DRFPermissionDenied
            raise DRFPermissionDenied('Không thể sửa vai trò hệ thống.')
        serializer = TenantCustomRoleSerializer(role, data=request.data, partial=True, tenant=role.tenant)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, role_id):
        require_pat_scopes_or_human_session(request, 'manage_tenant')
        _require_tenant_permission(request, 'settings:write')
        role = self._get_role(request, role_id)
        if role.is_system:
            from rest_framework.exceptions import PermissionDenied as DRFPermissionDenied
            raise DRFPermissionDenied('Không thể xoá vai trò hệ thống.')
        # Reassign members back to viewer before deleting
        role.members.update(custom_role=None)
        role.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
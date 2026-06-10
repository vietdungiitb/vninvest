from datetime import timedelta

from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from vninvest_core.pagination import CoreCursorPagination

from .models import CorePATCredential, CoreServiceAccount, CoreTenant, UserProfile
from .permissions import IsTenantActive, require_human_session, require_pat_scopes_or_human_session
from .serializers import (
    CorePATCredentialSerializer,
    CoreServiceAccountSerializer,
    CoreTenantSerializer,
    PartnerPATIssueSerializer,
    PartnerPATRevokeSerializer,
    PartnerPATRotateSerializer,
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


def _resolve_request_tenant_or_none(user) -> CoreTenant | None:
    """Return the caller tenant when available; allow staff/superuser to operate without one."""
    try:
        return CoreTenant.objects.get(owner_user=user)
    except CoreTenant.DoesNotExist:
        if bool(getattr(user, 'is_staff', False) or getattr(user, 'is_superuser', False)):
            return None
        raise PermissionDenied('Không tìm thấy tenant của người dùng hiện tại.')


def _resolve_issue_target_service_account(*, request, service_account_id: str, tenant: CoreTenant | None) -> CoreServiceAccount:
    queryset = CoreServiceAccount.objects.filter(
        public_id=service_account_id,
        status=CoreServiceAccount.StatusChoices.ACTIVE,
    )
    if tenant is not None:
        queryset = queryset.filter(tenant=tenant)
    return generics.get_object_or_404(queryset)


class TenantDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = CoreTenantSerializer
    permission_classes = TENANT_PERMISSION_CLASSES

    def get_object(self):
        _require_partner_scope(self.request, PARTNER_SCOPE_MANAGE_TENANT)
        return CoreTenant.objects.get(owner_user=self.request.user)


class ServiceAccountListView(generics.ListCreateAPIView):
    serializer_class = CoreServiceAccountSerializer
    pagination_class = CoreCursorPagination
    permission_classes = TENANT_PERMISSION_CLASSES

    def get_queryset(self):
        _require_partner_scope(self.request, PARTNER_SCOPE_MANAGE_SERVICE_ACCOUNTS)
        tenant = CoreTenant.objects.get(owner_user=self.request.user)
        return CoreServiceAccount.objects.filter(tenant=tenant).order_by('-created_at')

    def perform_create(self, serializer):
        _require_partner_scope(self.request, PARTNER_SCOPE_MANAGE_SERVICE_ACCOUNTS)
        tenant = CoreTenant.objects.get(owner_user=self.request.user)
        serializer.save(tenant=tenant)


class ServiceAccountDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = CoreServiceAccountSerializer
    permission_classes = TENANT_PERMISSION_CLASSES

    def get_queryset(self):
        _require_partner_scope(self.request, PARTNER_SCOPE_MANAGE_SERVICE_ACCOUNTS)
        tenant = CoreTenant.objects.get(owner_user=self.request.user)
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
            raise ValidationError({'detail': 'Không thể xóa service account active cuối cùng của tenant.'})

        raise ValidationError({'status': ['Không thể vô hiệu service account active cuối cùng của tenant.']})

    def perform_update(self, serializer):
        instance = self.get_object()
        next_status = serializer.validated_data.get('status', instance.status)
        self._ensure_not_last_active_service_account(instance, next_status=next_status)
        serializer.save()

    def perform_destroy(self, instance):
        self._ensure_not_last_active_service_account(instance, deleting=True)
        instance.delete()


class PATListView(generics.ListAPIView):
    serializer_class = CorePATCredentialSerializer
    pagination_class = CoreCursorPagination
    permission_classes = TENANT_PERMISSION_CLASSES

    def get_queryset(self):
        _require_partner_scope(self.request, PARTNER_SCOPE_MANAGE_PATS)
        tenant = CoreTenant.objects.get(owner_user=self.request.user)
        return CorePATCredential.objects.filter(
            service_account__tenant=tenant,
            is_human_session=False,
        ).order_by('-created_at')


@api_view(['POST'])
@permission_classes(TENANT_PERMISSION_CLASSES)
def issue_pat(request, service_account_id):
    """Issue a new PAT for a service account. Returns token ONE TIME only."""
    _require_partner_scope(request, PARTNER_SCOPE_MANAGE_PATS)
    tenant = _resolve_request_tenant_or_none(request.user)
    sa = _resolve_issue_target_service_account(
        request=request,
        service_account_id=service_account_id,
        tenant=tenant,
    )

    serializer = PartnerPATIssueSerializer(data={
        **request.data,
        'service_account_id': service_account_id,
    })
    serializer.is_valid(raise_exception=True)

    scopes = serializer.validated_data.get('scope_codes', [])
    expires_at = serializer.validated_data.get('expires_at')
    label = serializer.validated_data.get('display_name') or serializer.validated_data.get('label') or ''
    audit_reason = serializer.validated_data.get('audit_reason', '')
    _reject_human_session_markers(label=label, audit_reason=audit_reason)
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
        profile, _ = UserProfile.objects.get_or_create(
            user=request.user,
            defaults={
                'display_name': request.user.get_full_name() or request.user.username,
            },
        )
        return Response({
            'username': request.user.username,
            'email': request.user.email,
            'display_name': profile.display_name,
            'language': profile.language,
            'theme': profile.theme,
            'whale_alert_threshold': str(profile.whale_alert_threshold),
            'preferences': profile.preferences,
        })

    def patch(self, request):
        require_human_session(request)
        profile, _ = UserProfile.objects.get_or_create(
            user=request.user,
            defaults={
                'display_name': request.user.get_full_name() or request.user.username,
            },
        )
        allowed_fields = {'display_name', 'language', 'theme', 'whale_alert_threshold', 'preferences'}
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
            'display_name': profile.display_name,
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
    tenant = _resolve_request_tenant_or_none(request.user)
    serializer = PartnerPATIssueSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    sa_id = serializer.validated_data['service_account_id']
    sa = _resolve_issue_target_service_account(
        request=request,
        service_account_id=sa_id,
        tenant=tenant,
    )

    scopes = serializer.validated_data.get('scope_codes', [])
    expires_at = serializer.validated_data.get('expires_at')
    label = serializer.validated_data.get('display_name') or serializer.validated_data.get('label') or ''
    audit_reason = serializer.validated_data.get('audit_reason', '')
    _reject_human_session_markers(label=label, audit_reason=audit_reason)
    scopes = _validate_requested_pat_scopes(request, sa, scopes)

    credential, raw_token = CorePATCredential.issue_for_service_account(
        service_account=sa,
        scopes=scopes,
        expires_at=expires_at,
        label=label,
        audit_reason=audit_reason,
    )
    return Response(_serialize_partner_pat(credential, secret=raw_token), status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes(TENANT_PERMISSION_CLASSES)
def partner_rotate_pat(request, pat_id):
    """Revoke old PAT and issue a replacement for the same service account."""
    _require_partner_scope(request, PARTNER_SCOPE_MANAGE_PATS)
    tenant = CoreTenant.objects.get(owner_user=request.user)
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
    _reject_human_session_markers(label=label, audit_reason=audit_reason)
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
    tenant = CoreTenant.objects.get(owner_user=request.user)
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


class PartnerUsageMetersView(generics.ListAPIView):
    """Usage meters list — placeholder until usage metering is implemented."""
    permission_classes = TENANT_PERMISSION_CLASSES

    def list(self, request, *args, **kwargs):
        return Response([])

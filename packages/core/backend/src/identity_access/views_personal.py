"""B+A S1: Personal API keys self-service — user tự quản key của chính mình.

Gate: TENANT_PERMISSION_CLASSES (từ views/helpers.py — C6, không import views_tenant nặng
ngoài các helper pure). Own-data principle: không yêu cầu role token; admin/shared
endpoints khác giữ nguyên. Middleware chặn no-tenant bằng 403 trước khi vào view (C8).
"""
from datetime import timedelta

from django.utils import timezone
from drf_spectacular.openapi import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from vninvest_core.api_envelope import envelope_response

from .envelope import envelope, paginated_envelope
from .models import (
    CorePATCredential,
    CoreServiceAccount,
    TenantMember,
)
from .schema import (
    IssuedCorePATSerializer,
    PaginatedResultsSerializer,
    PersonalKeysUsageSummarySerializer,
    PersonalPATRevocationSerializer,
    PersonalPATRotationSerializer,
    PersonalSummarySerializer,
)
from .serializers import (
    CorePATCredentialSerializer,
    PartnerPATRevokeSerializer,
    PartnerPATRotateSerializer,
    PersonalPATIssueSerializer,
)
from .utils.resolve_tenant import resolve_tenant as _get_request_tenant
from .views.helpers import TENANT_PERMISSION_CLASSES
from .views_tenant import (
    _parse_days_param,
    _reject_human_session_markers,
    _serialize_partner_pat,
    _validate_requested_pat_scopes,
)

PERSONAL_LABEL_PREFIX = 'personal:'


def _personal_member(request):
    """Member row của requester (None nếu owner). C1: query trực tiếp, KHÔNG đọc
    request.tenant_member (middleware không set attr này)."""
    tenant = _get_request_tenant(request)
    return (TenantMember.objects
            .filter(tenant=tenant, user=request.user)
            .select_related('custom_role')
            .first())


def _personal_default_sa(tenant):
    """Default SA, get_or_create cho tenant cũ thiếu (D5)."""
    sa, _ = CoreServiceAccount.objects.get_or_create(
        tenant=tenant,
        name='default',
        defaults={
            'status': CoreServiceAccount.StatusChoices.ACTIVE,
            'scopes': ['market:read', 'signals:read'],
        },
    )
    return sa


def _personal_key_qs(request):
    """Queryset key cá nhân của CHÍNH requester (fail-closed theo member)."""
    tenant = _get_request_tenant(request)
    member = _personal_member(request)
    filters = {
        'service_account__tenant': tenant,
        'is_human_session': False,
        'label__startswith': PERSONAL_LABEL_PREFIX,
    }
    if member is None:
        filters['issued_for_member__isnull'] = True
    else:
        filters['issued_for_member'] = member
    return CorePATCredential.objects.filter(**filters)


def _personal_get_key(request, key_id):
    return generics.get_object_or_404(_personal_key_qs(request), public_id=key_id)


def _reject_personal_prefix(*, label: str, audit_reason: str) -> None:
    """D2-mirror: input personal tự đặt prefix personal: → 400 (BE ép prefix)."""
    from rest_framework.exceptions import ValidationError
    field_errors = {}
    if str(label or '').strip().startswith(PERSONAL_LABEL_PREFIX):
        field_errors['display_name'] = ['Tiền tố personal: do hệ thống tự gắn, không được tự đặt.']
    if str(audit_reason or '').strip().startswith(PERSONAL_LABEL_PREFIX):
        field_errors['audit_reason'] = ['Tiền tố personal: do hệ thống tự gắn, không được tự đặt.']
    if field_errors:
        raise ValidationError(field_errors)


#: Một path, hai method ⇒ **hai** khai báo. `extend_schema` gắn vào decorator
#: của function nên phải tách theo `methods=`; gộp chung sẽ mô tả sai method
#: còn lại.
#:
#: - `GET` → `paginated_envelope({'results': [...]})`
#: - `POST` → `_do_issue()` → `envelope(...)` với **201**
@extend_schema(
    methods=['GET'],
    responses={200: envelope_response(PaginatedResultsSerializer)},
)
@extend_schema(
    request=OpenApiTypes.OBJECT,
    methods=['POST'],
    responses={201: envelope_response(IssuedCorePATSerializer)},
)
@api_view(['GET', 'POST'])
@permission_classes(TENANT_PERMISSION_CLASSES)
def personal_keys_list_create(request):
    """GET list / POST issue key cá nhân (chung path, khác method)."""
    if request.method == 'GET':
        serializer = CorePATCredentialSerializer(_personal_key_qs(request), many=True)
        return paginated_envelope({'results': serializer.data})
    return _do_issue(request)


@api_view(['GET'])
@permission_classes(TENANT_PERMISSION_CLASSES)
def personal_keys_list(request):
    """GET /partner/me/keys/ — key cá nhân của chính mình (không secret)."""
    serializer = CorePATCredentialSerializer(_personal_key_qs(request), many=True)
    return paginated_envelope({'results': serializer.data})


@api_view(['POST'])
@permission_classes(TENANT_PERMISSION_CLASSES)
def personal_keys_issue(request):
    """POST /partner/me/keys/ — tạo key cá nhân, secret trả đúng 1 lần (dùng nội bộ)."""
    return _do_issue(request)


def _do_issue(request):
    """Logic issue dùng chung (tránh gọi view đã bọc api_view từ view khác)."""
    tenant = _get_request_tenant(request)
    member = _personal_member(request)
    serializer = PersonalPATIssueSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    display_name = (serializer.validated_data.get('display_name') or '').strip()
    label = f'{PERSONAL_LABEL_PREFIX}{display_name or "key"}'
    audit_reason = serializer.validated_data.get('audit_reason', '')
    _reject_personal_prefix(label=display_name or serializer.validated_data.get('label', ''),
                            audit_reason=serializer.validated_data.get('audit_reason', ''))
    _reject_human_session_markers(label=label, audit_reason=audit_reason)

    sa = _personal_default_sa(tenant)
    if sa.status != CoreServiceAccount.StatusChoices.ACTIVE:
        from rest_framework.exceptions import ValidationError
        raise ValidationError('Service account mặc định đã bị vô hiệu.')

    scopes = serializer.validated_data.get('scope_codes', [])
    if not scopes:
        scopes = list(sa.scopes or [])
    scopes = _validate_requested_pat_scopes(request, sa, scopes)

    from django.core.exceptions import ValidationError as DjangoValidationError
    from rest_framework.exceptions import ValidationError as DRFValidationError
    try:
        credential, raw_token = CorePATCredential.issue_for_service_account(
            service_account=sa,
            scopes=scopes,
            expires_at=serializer.validated_data.get('expires_at'),
            label=label,
            audit_reason=audit_reason,
            allowed_cidr_blocks=serializer.validated_data.get('allowed_cidr_blocks', []),
            issued_for_member=member,
        )
    except DjangoValidationError as exc:
        # Quota max_active_pats (model raise Django ValidationError → DRF không convert → 500)
        raise DRFValidationError({'non_field_errors': exc.messages})
    return envelope(_serialize_partner_pat(credential, secret=raw_token),
                    status=status.HTTP_201_CREATED)


#: **Phẳng** (F4): `{object: 'personal_pat_rotation', ...}`. Cùng hợp đồng
#: với `partner_rotate_pat` (`views_tenant.py:386`) — bọc vào `{data, meta}` sẽ
#: phá hợp đồng, xem `api_envelope.py` §"Vì sao KHÔNG ép mọi 2xx vào envelope".
@extend_schema(
    request=OpenApiTypes.OBJECT,
    responses={200: PersonalPATRotationSerializer},
)
@api_view(['POST'])
@permission_classes(TENANT_PERMISSION_CLASSES)
def personal_keys_rotate(request, key_id):
    """POST /partner/me/keys/<id>/rotate/ — xoay key của chính mình."""
    old_pat = _personal_get_key(request, key_id)
    sa = old_pat.service_account
    if sa.status != CoreServiceAccount.StatusChoices.ACTIVE:
        from rest_framework.exceptions import ValidationError
        raise ValidationError('Service account mặc định đã bị vô hiệu.')

    serializer = PartnerPATRotateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    scopes = serializer.validated_data.get('scope_codes', []) or list(old_pat.scopes or [])
    expires_at = serializer.validated_data.get('expires_at')
    label = old_pat.label
    audit_reason = serializer.validated_data.get('audit_reason', '') or 'rotated_by_owner'
    allowed_cidr_blocks = (serializer.validated_data.get('allowed_cidr_blocks')
                           or old_pat.allowed_cidr_blocks or [])
    _reject_human_session_markers(label=label, audit_reason=audit_reason)
    scopes = _validate_requested_pat_scopes(request, sa, scopes)
    grace_until = old_pat.mark_rotating(
        grace_period_seconds=serializer.validated_data.get('grace_period_seconds', 3600),
        reason=audit_reason,
    )
    credential, raw_token = None, None
    from django.core.exceptions import ValidationError as DjangoValidationError
    from rest_framework.exceptions import ValidationError as DRFValidationError
    try:
        credential, raw_token = CorePATCredential.issue_for_service_account(
            service_account=sa,
            scopes=scopes,
            expires_at=expires_at,
            label=label,
            audit_reason=audit_reason,
            allowed_cidr_blocks=allowed_cidr_blocks,
            issued_for_member=old_pat.issued_for_member,
        )
    except DjangoValidationError as exc:
        raise DRFValidationError({'non_field_errors': exc.messages})
    return Response({
        'object': 'personal_pat_rotation',
        'old_token_id': old_pat.public_id,
        'old_token_grace_until': grace_until.isoformat() if grace_until else None,
        'new_token': _serialize_partner_pat(credential, secret=raw_token),
    }, status=status.HTTP_200_OK)


#: **Phẳng** (F4): `{object: 'personal_pat_revocation', ...}` — cùng lý do
#: `personal_keys_rotate` ở trên.
@extend_schema(
    request=OpenApiTypes.OBJECT,
    responses={200: PersonalPATRevocationSerializer},
)
@api_view(['POST'])
@permission_classes(TENANT_PERMISSION_CLASSES)
def personal_keys_revoke(request, key_id):
    """POST /partner/me/keys/<id>/revoke/ — thu hồi key của chính mình."""
    pat = _personal_get_key(request, key_id)
    serializer = PartnerPATRevokeSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    pat.revoke_pat(reason=serializer.validated_data.get('reason', '') or 'revoked_by_owner')
    return Response({
        'object': 'personal_pat_revocation',
        'token_id': pat.public_id,
        'status': pat.status,
        'revoked_at': pat.revoked_at.isoformat() if pat.revoked_at else None,
    }, status=status.HTTP_200_OK)


@extend_schema(
    responses={200: envelope_response(PersonalKeysUsageSummarySerializer)},
)
@api_view(['GET'])
@permission_classes(TENANT_PERMISSION_CLASSES)
def personal_keys_usage_summary(request):
    """GET /partner/me/keys/usage-summary/ — usage key cá nhân của chính mình."""
    from .models import PATAuditLog

    days = _parse_days_param(request)
    since = timezone.now() - timedelta(days=days)
    pats = list(_personal_key_qs(request))
    pat_ids = [p.id for p in pats]
    total_calls = (PATAuditLog.objects.filter(pat_id__in=pat_ids, occurred_at__gte=since).count()
                   if pat_ids else 0)
    return envelope({
        'total_keys': len(pats),
        'active_keys': sum(1 for p in pats
                           if p.status == CorePATCredential.StatusChoices.ACTIVE),
        'total_calls_30d': total_calls,
        'keys': [{
            'pat_id': p.public_id,
            'label': p.label,
            'calls_30d': PATAuditLog.objects.filter(pat=p, occurred_at__gte=since).count(),
            'last_used_at': p.last_used_at.isoformat() if p.last_used_at else None,
        } for p in pats],
    })


def _current_period_quotas(tenant):
    """C3: copy logic kỳ hiện tại từ TenantQuotaMiddleware (không import middleware)."""
    from commercial.models import QuotaRecord

    today = timezone.now().date()
    record = (QuotaRecord.objects.filter(
        tenant=tenant, period_start__lte=today, period_end__gte=today)
        .order_by('-period_start', '-period_end').first())
    if record is None:
        return {'api_calls_limit': -1, 'period_start': None, 'period_end': None}
    return {'api_calls_limit': int(record.api_calls_limit),
            'period_start': record.period_start.isoformat(),
            'period_end': record.period_end.isoformat()}


@extend_schema(
    responses={200: envelope_response(PersonalSummarySerializer)},
)
@api_view(['GET'])
@permission_classes(TENANT_PERMISSION_CLASSES)
def personal_summary(request):
    """GET /partner/me/summary/ — tenant + quotas + key của chính mình."""
    from .models import PATAuditLog

    tenant = _get_request_tenant(request)
    days = 30
    since = timezone.now() - timedelta(days=days)
    pats = list(_personal_key_qs(request))
    pat_ids = [p.id for p in pats]
    calls = (PATAuditLog.objects.filter(pat_id__in=pat_ids, occurred_at__gte=since).count()
             if pat_ids else 0)
    return envelope({
        'tenant': {
            'plan': tenant.plan,
            'status': tenant.status,
            'display_name': tenant.display_name,
            'tenant_code': tenant.tenant_code,
        },
        'quotas': _current_period_quotas(tenant),
        'my': {
            'total_keys': len(pats),
            'active_keys': sum(1 for p in pats
                               if p.status == CorePATCredential.StatusChoices.ACTIVE),
            'calls_30d': calls,
        },
    })

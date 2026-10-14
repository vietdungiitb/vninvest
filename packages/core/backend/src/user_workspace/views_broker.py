"""
views_broker.py — B1.2: API cấu hình broker đa-nhà (dnse/ssi/tcbs) cho người dùng.

B0.6 (Wave 0): cau hinh/credential MO cho ca 3 lane da biet (worker task da
xu ly ssi/tcbs) — khong con `not_supported_yet`. Muc do ho tro that nam o
`GET /broker/capabilities/` (matrix versioned, `broker/base.py`).
Mọi I/O tới broker chạy trong Celery (test-connection enqueue + poll) — cấm I/O trong request.
Secret không bao giờ xuất hiện trong response (chỉ preview mask).
"""
from celery.result import AsyncResult
from django.core.cache import cache
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework import status

from vninvest_core.exceptions import (
    NotFoundErrorException,
    RateLimitErrorException,
    ValidationErrorException,
)

from .permissions import (attach_required_permissions, WorkspacePermission, required_workspace_permission,)

from .broker import SCHEMAS
from .broker.base import (
    capability_matrix,
    is_fully_supported,
    mask_secrets_preview,
)
from .envelope import envelope
from .models import (
    DNSECredential,
    UserBrokerConfig,
    get_user_broker_config,
    set_user_broker_secrets,
)
from .tasks import test_broker_connection_task
from drf_spectacular.utils import extend_schema
from drf_spectacular.openapi import OpenApiTypes
from vninvest_core.api_envelope import envelope_response


SUPPORTED_PROVIDERS = ('dnse', 'ssi', 'tcbs')


def _is_fully_supported(provider: str) -> bool:
    """Uy quyen cho `broker/base.py` (C-04) — view khong hardcode."""
    return is_fully_supported(provider)

TEST_CONN_LIMIT = 5
TEST_CONN_WINDOW_SECONDS = 60


def _require_provider(provider: str) -> str:
    normalized = str(provider or '').strip().lower()
    if normalized not in SUPPORTED_PROVIDERS:
        raise NotFoundErrorException(
            detail=f'Broker không hỗ trợ: {provider}',
            code='broker_not_supported',
        )
    return normalized


def _serialize_config(config: UserBrokerConfig | None) -> dict:
    if config is None:
        return {'is_configured': False}
    return {
        'is_configured': bool(config.has_secrets()),
        'provider': config.provider,
        'label': config.label,
        'status': config.status,
        'preview': mask_secrets_preview(config.provider, config.get_secrets()),
        'last_verified_at': config.last_verified_at,
        'last_error': config.last_error,
        'prefs': config.prefs or {},
    }


def _mirror_to_legacy_dnse(user, secrets: dict, is_active: bool) -> None:
    """B1.2.5 transitional: mirror sang DNSECredential cũ để tasks sync hiện tại còn chạy.

    Xóa khi tasks chuyển sang store mới (pha Broker Hub). Không log secret.
    """
    credential, _ = DNSECredential.objects.get_or_create(user=user)
    if secrets.get('client_id') and secrets.get('client_secret'):
        credential.set_client_id(str(secrets['client_id']))
        credential.set_client_secret(str(secrets['client_secret']))
    else:
        credential.client_id_cipher = ''
        credential.client_secret_cipher = ''
    credential.is_active = bool(is_active)
    credential.save()


@extend_schema(
    summary='broker_providers_api',
    description='Declared so drf-spectacular stops reporting an unguessable serializer; payload shape is verified by the envelope invariant tests.',
    request=OpenApiTypes.OBJECT,
    responses={
        200: envelope_response(),
    },
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def broker_providers_api(request):
    """Danh sách broker + trạng thái đã nối của user.

    B0.6: moi lane deu doc duoc trang thai that; `fully_supported` cho UI biet
    lane nao da xac minh day du (chi dnse), lane nao cho xac minh (ssi/tcbs).
    """
    items = []
    for provider in SUPPORTED_PROVIDERS:
        config = get_user_broker_config(
            request.user, provider, tenant=getattr(request, 'tenant', None),
        )
        items.append({
            'id': provider,
            'status': (config.status if config else UserBrokerConfig.StatusChoices.NEVER_CONNECTED),
            'is_configured': bool(config and config.has_secrets()),
            'fully_supported': _is_fully_supported(provider),
        })
    return envelope({'providers': items})


@extend_schema(
    summary='broker_capabilities_api',
    description='Declared so drf-spectacular stops reporting an unguessable serializer; payload shape is verified by the envelope invariant tests.',
    request=OpenApiTypes.OBJECT,
    responses={
        200: envelope_response(),
    },
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def broker_capabilities_api(request):
    """B0.6: ma tran kha nang versioned — nguon that duy nhat cho UI.

    Client doc `version` de phat hien cache cu. Khong bao gio suy trang thai
    ho tro tu ten provider.
    """
    return envelope(capability_matrix())


@extend_schema(
    summary='broker_config_schema_api',
    description='Declared so drf-spectacular stops reporting an unguessable serializer; payload shape is verified by the envelope invariant tests.',
    request=OpenApiTypes.OBJECT,
    responses={
        200: envelope_response(),
    },
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def broker_config_schema_api(request, provider):
    """Schema form động cho từng broker."""
    normalized = _require_provider(provider)
    return envelope(SCHEMAS[normalized].get_schema())


@extend_schema(
    summary='broker_config_api',
    description='Declared so drf-spectacular stops reporting an unguessable serializer; payload shape is verified by the envelope invariant tests.',
    request=OpenApiTypes.OBJECT,
    responses={
        200: envelope_response(),
    },
)
@required_workspace_permission('broker_manage')
@api_view(['GET', 'POST', 'DELETE'])
@permission_classes([IsAuthenticated, WorkspacePermission])
def broker_config_api(request, provider):
    tenant = getattr(request, 'tenant', None)
    """CRUD config broker của user. POST validate theo field, lưu Fernet, chỉ trả preview."""
    normalized = _require_provider(provider)
    user = request.user

    if request.method == 'DELETE':
        config = get_user_broker_config(user, normalized, tenant=tenant)
        if config:
            config.set_secrets({})
            config.status = UserBrokerConfig.StatusChoices.NEVER_CONNECTED
            config.last_error = ''
            config.save(update_fields=['secrets_cipher', 'status', 'last_error', 'updated_at'])
        if normalized == 'dnse':
            _mirror_to_legacy_dnse(user, {}, False)
        return envelope({'ok': True, 'message': 'Đã xoá cấu hình broker.'})

    if request.method == 'GET':
        return envelope(_serialize_config(get_user_broker_config(user, normalized, tenant=tenant)))

    # POST — validate theo schema từng provider, chỉ lưu field trong schema
    data = request.data if isinstance(request.data, dict) else {}
    schema = SCHEMAS[normalized].get_schema()
    secrets = {}
    for field in schema['fields']:
        key = field['key']
        value = data.get(key, '')
        secrets[key] = str(value or '').strip()
    errors = SCHEMAS[normalized].validate_secrets(secrets)
    if errors:
        raise ValidationErrorException(detail=errors, code='validation_error')

    config = set_user_broker_secrets(user, normalized, secrets, tenant=tenant)
    config.status = UserBrokerConfig.StatusChoices.NEVER_CONNECTED
    config.last_error = ''
    config.save(update_fields=['status', 'last_error', 'updated_at'])
    if normalized == 'dnse':
        _mirror_to_legacy_dnse(user, secrets, True)
    return envelope({'ok': True, **_serialize_config(config)}, status=status.HTTP_200_OK)


@extend_schema(
    summary='broker_test_connection_api',
    description='Declared so drf-spectacular stops reporting an unguessable serializer; payload shape is verified by the envelope invariant tests.',
    request=OpenApiTypes.OBJECT,
    responses={
        200: envelope_response(),
    },
)
@required_workspace_permission('broker_manage')
@api_view(['POST'])
@permission_classes([IsAuthenticated, WorkspacePermission])
def broker_test_connection_api(request, provider):
    tenant = getattr(request, 'tenant', None)
    """Enqueue test-connection (trả job_id ngay, <500ms). Poll qua broker_job_status_api."""
    normalized = _require_provider(provider)
    user = request.user
    config = get_user_broker_config(user, normalized, tenant=tenant)
    if not config or not config.has_secrets():
        raise ValidationErrorException(
            detail='Chưa cấu hình credentials. Lưu cấu hình trước khi kiểm tra.',
            code='validation_error',
        )

    # TEN-06: include the tenant so the rate-limit bucket is not shared across
    # tenants (one tenant's bursts cannot exhaust another's quota).
    _conn_tenant = getattr(getattr(request, "tenant", None), "public_id", None) or "no-tenant"
    cache_key = f'broker:testconn:{_conn_tenant}:{user.id}:{normalized}'
    count = cache.get(cache_key, 0)
    if count >= TEST_CONN_LIMIT:
        raise RateLimitErrorException(
            detail='Kiểm tra kết nối quá nhiều. Vui lòng thử lại sau 1 phút.',
            code='test_connection_rate_limited',
        )
    cache.set(cache_key, count + 1, TEST_CONN_WINDOW_SECONDS)

    job = test_broker_connection_task.delay(
        config.id,
        tenant_id=getattr(tenant, 'id', None),
    )
    return envelope(
        {'job_id': job.id, 'state': 'pending'}, status=status.HTTP_202_ACCEPTED)


@extend_schema(
    summary='broker_job_status_api',
    description='Declared so drf-spectacular stops reporting an unguessable serializer; payload shape is verified by the envelope invariant tests.',
    request=OpenApiTypes.OBJECT,
    responses={
        200: envelope_response(),
    },
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def broker_job_status_api(request, job_id):
    """Poll trạng thái job test-connection. job_id UUID không đoán được."""
    try:
        result = AsyncResult(str(job_id))
        state = result.state
    except Exception:  # noqa: BLE001 — backend lỗi/không có coi như pending
        return envelope({'job_id': str(job_id), 'state': 'pending'})
    if state in ('PENDING', 'STARTED', 'RETRY'):
        return envelope({'job_id': str(job_id), 'state': 'pending'})
    if state == 'SUCCESS':
        payload = result.result if isinstance(result.result, dict) else {}
        return envelope({'job_id': str(job_id), 'state': 'succeeded', 'result': payload})
    try:
        error = str(result.result)[:500] if result.result else 'failed'
    except Exception:  # noqa: BLE001
        error = 'failed'
    return envelope({'job_id': str(job_id), 'state': 'failed', 'error': error})

# SAFE-04: xem iews_dnse.py — @api_view khong chep attribute sang class.
attach_required_permissions(
    broker_config_api,
    broker_test_connection_api,
)

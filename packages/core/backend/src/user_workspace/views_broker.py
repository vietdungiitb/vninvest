"""
views_broker.py — B1.2: API cấu hình broker đa-nhà (dnse/ssi/tcbs) cho người dùng.

Đợt 1 chỉ hỗ trợ đầy đủ `dnse`; `ssi`/`tcbs` trả `not_supported_yet` (khung có sẵn).
Mọi I/O tới broker chạy trong Celery (test-connection enqueue + poll) — cấm I/O trong request.
Secret không bao giờ xuất hiện trong response (chỉ preview mask).
"""
from celery.result import AsyncResult
from django.core.cache import cache
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from vninvest_core.exceptions import (
    NotFoundErrorException,
    RateLimitErrorException,
    ValidationErrorException,
)

from .broker import SCHEMAS
from .broker.base import mask_secrets_preview
from .models import (
    DNSECredential,
    UserBrokerConfig,
    get_user_broker_config,
    set_user_broker_secrets,
)
from .tasks import test_broker_connection_task

SUPPORTED_PROVIDERS = ('dnse', 'ssi', 'tcbs')
FULLY_SUPPORTED = frozenset({'dnse', 'ssi', 'tcbs'})

TEST_CONN_LIMIT = 5
TEST_CONN_WINDOW_SECONDS = 60


def _require_provider(provider: str) -> str:
    normalized = str(provider or '').strip().lower()
    if normalized not in SUPPORTED_PROVIDERS:
        raise NotFoundErrorException(
            detail=f'Broker không hỗ trợ: {provider}',
            code='broker_not_supported',
        )
    if normalized not in FULLY_SUPPORTED:
        raise ValidationErrorException(
            detail=f'Broker {normalized} chưa hỗ trợ ở giai đoạn này.',
            code='not_supported_yet',
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


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def broker_providers_api(request):
    """Danh sách broker + trạng thái đã nối của user."""
    items = []
    for provider in SUPPORTED_PROVIDERS:
        if provider not in FULLY_SUPPORTED:
            items.append({
                'id': provider,
                'status': 'not_supported_yet',
                'is_configured': False,
            })
            continue
        config = get_user_broker_config(request.user, provider)
        items.append({
            'id': provider,
            'status': (config.status if config else UserBrokerConfig.StatusChoices.NEVER_CONNECTED),
            'is_configured': bool(config and config.has_secrets()),
        })
    return Response({'providers': items})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def broker_config_schema_api(request, provider):
    """Schema form động cho từng broker."""
    normalized = _require_provider(provider)
    return Response(SCHEMAS[normalized].get_schema())


@api_view(['GET', 'POST', 'DELETE'])
@permission_classes([IsAuthenticated])
def broker_config_api(request, provider):
    """CRUD config broker của user. POST validate theo field, lưu Fernet, chỉ trả preview."""
    normalized = _require_provider(provider)
    user = request.user

    if request.method == 'DELETE':
        config = get_user_broker_config(user, normalized)
        if config:
            config.set_secrets({})
            config.status = UserBrokerConfig.StatusChoices.NEVER_CONNECTED
            config.last_error = ''
            config.save(update_fields=['secrets_cipher', 'status', 'last_error', 'updated_at'])
        if normalized == 'dnse':
            _mirror_to_legacy_dnse(user, {}, False)
        return Response({'ok': True, 'message': 'Đã xoá cấu hình broker.'})

    if request.method == 'GET':
        return Response(_serialize_config(get_user_broker_config(user, normalized)))

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

    config = set_user_broker_secrets(user, normalized, secrets)
    config.status = UserBrokerConfig.StatusChoices.NEVER_CONNECTED
    config.last_error = ''
    config.save(update_fields=['status', 'last_error', 'updated_at'])
    if normalized == 'dnse':
        _mirror_to_legacy_dnse(user, secrets, True)
    return Response({'ok': True, **_serialize_config(config)}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def broker_test_connection_api(request, provider):
    """Enqueue test-connection (trả job_id ngay, <500ms). Poll qua broker_job_status_api."""
    normalized = _require_provider(provider)
    user = request.user
    config = get_user_broker_config(user, normalized)
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

    job = test_broker_connection_task.delay(config.id)
    return Response({'job_id': job.id, 'state': 'pending'}, status=status.HTTP_202_ACCEPTED)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def broker_job_status_api(request, job_id):
    """Poll trạng thái job test-connection. job_id UUID không đoán được."""
    try:
        result = AsyncResult(str(job_id))
        state = result.state
    except Exception:  # noqa: BLE001 — backend lỗi/không có coi như pending
        return Response({'job_id': str(job_id), 'state': 'pending'})
    if state in ('PENDING', 'STARTED', 'RETRY'):
        return Response({'job_id': str(job_id), 'state': 'pending'})
    if state == 'SUCCESS':
        payload = result.result if isinstance(result.result, dict) else {}
        return Response({'job_id': str(job_id), 'state': 'succeeded', 'result': payload})
    try:
        error = str(result.result)[:500] if result.result else 'failed'
    except Exception:  # noqa: BLE001
        error = 'failed'
    return Response({'job_id': str(job_id), 'state': 'failed', 'error': error})

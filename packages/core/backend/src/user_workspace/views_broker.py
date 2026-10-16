"""
views_broker.py — B1.2: API cấu hình broker đa-nhà (dnse/ssi/tcbs) cho người dùng.

B0.6 (Wave 0): cau hinh/credential MO cho ca 3 lane da biet (worker task da
xu ly ssi/tcbs) — khong con `not_supported_yet`. Muc do ho tro that nam o
`GET /broker/capabilities/` (matrix versioned, `broker/base.py`).
Mọi I/O tới broker chạy trong Celery (test-connection enqueue + poll) — cấm I/O trong request.
Secret không bao giờ xuất hiện trong response (chỉ preview mask).
"""
import logging

from celery.result import AsyncResult
from django.core.cache import cache
from django.db import transaction as db_transaction
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework import status

from vninvest_core.exceptions import (
    InternalErrorException,
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
from .broker.sync_service import BrokerSyncService
from .envelope import envelope
from .models import (
    BrokerSyncIssue,
    BrokerSyncRun,
    DNSECredential,
    Portfolio,
    SubAccount,
    UserBrokerConfig,
    get_user_broker_config,
    set_user_broker_secrets,
)
from .tasks import sync_broker_account_task, test_broker_connection_task
from drf_spectacular.utils import extend_schema
from drf_spectacular.openapi import OpenApiTypes
from vninvest_core.api_envelope import envelope_response


SUPPORTED_PROVIDERS = ('dnse', 'ssi', 'tcbs')

logger = logging.getLogger(__name__)


def _is_fully_supported(provider: str) -> bool:
    """Uy quyen cho `broker/base.py` (C-04) — view khong hardcode."""
    return is_fully_supported(provider)

TEST_CONN_LIMIT = 5
TEST_CONN_WINDOW_SECONDS = 60

# conn-hardening (F-BE-02): map job_id -> (user, tenant) de poll khong thanh
# oracle cross-user. Thieu map (job cu truoc deploy) -> cho qua nhu cu.
JOB_OWNER_TTL_SECONDS = 600


def _job_owner_key(job_id: str) -> str:
    return f'broker:jobowner:{job_id}'


def _remember_job_owner(job_id: str, user_id: int, tenant_id) -> None:
    try:
        cache.set(
            _job_owner_key(str(job_id)),
            {'user_id': user_id, 'tenant_id': tenant_id},
            JOB_OWNER_TTL_SECONDS,
        )
    except Exception:  # noqa: BLE001 — cache hong khong duoc chan enqueue
        logger.warning('broker job owner map unavailable')


def _job_owner_mismatch(request, job_id: str) -> bool:
    """True = job co chu nhung khong phai nguoi dang hoi (404, khong lo ton tai)."""
    try:
        entry = cache.get(_job_owner_key(str(job_id)))
    except Exception:  # noqa: BLE001
        return False
    if not isinstance(entry, dict):
        return False
    tenant = getattr(request, 'tenant', None)
    return (
        entry.get('user_id') != getattr(request.user, 'id', None)
        or entry.get('tenant_id') != getattr(tenant, 'id', None)
    )


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
    _remember_job_owner(job.id, user.id, getattr(tenant, 'id', None))
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
    if _job_owner_mismatch(request, str(job_id)):
        raise NotFoundErrorException(
            detail='Không tìm thấy tác vụ.',
            code='job_not_found',
        )
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

def _get_sub_account_or_404(pk, user, tenant):
    """Tieu khoan thuoc user (+ tenant neu co)."""
    try:
        if tenant is not None:
            return SubAccount.objects.get(pk=pk, user=user, tenant=tenant)
        return SubAccount.objects.get(pk=pk, user=user)
    except (SubAccount.DoesNotExist, ValueError, TypeError):
        raise NotFoundErrorException(
            detail='Tieu khoan khong ton tai.',
            code='sub_account_not_found',
        )


def _serialize_sub_account(sub: SubAccount) -> dict:
    return {
        'id': sub.id,
        'provider': sub.provider,
        'external_id': sub.external_id,
        'account_number': sub.account_number,
        'display_name': sub.display_name,
        'type': sub.type,
        'is_active': sub.is_active,
        'broker_config_id': sub.broker_config_id,
        'last_sync_at': sub.last_sync_at,
    }


def _service_for_sub_account(sub: SubAccount):
    """Service doc broker cho 1 tieu khoan. Chua lien ket => 400."""
    config = sub.broker_config
    if config is None:
        raise ValidationErrorException(
            detail='Tieu khoan chua lien ket cau hinh broker.',
            code='account_not_linked',
        )
    return BrokerSyncService.for_config(config)


def _position_to_dict(position) -> dict:
    return {
        'symbol': position.symbol,
        'quantity': position.quantity,
        'avg_price': position.avg_price,
        'market_price': position.market_price,
    }


def _balance_to_dict(balance) -> dict:
    return {
        'cash': balance.cash,
        'stock_value': balance.stock_value,
        'debt': balance.debt,
        'net_equity': balance.net_equity,
        'buying_power': balance.buying_power,
    }


def _order_to_dict(order) -> dict:
    return {
        'order_id': order.order_id,
        'symbol': order.symbol,
        'side': order.side,
        'price': order.price,
        'quantity': order.quantity,
        'status': order.status,
        'placed_at': order.placed_at,
    }


@extend_schema(
    summary='broker_accounts_api',
    operation_id='broker_accounts_list',
    description='Declared so drf-spectacular stops reporting an unguessable serializer; payload shape is verified by the envelope invariant tests.',
    request=OpenApiTypes.OBJECT,
    responses={
        200: envelope_response(),
    },
)
@required_workspace_permission('portfolio_read')
@api_view(['GET'])
@permission_classes([IsAuthenticated, WorkspacePermission])
def broker_accounts_api(request):
    """B1.6: danh sach tieu khoan broker (scope user + tenant)."""
    tenant = getattr(request, 'tenant', None)
    if tenant is not None:
        qs = SubAccount.objects.filter(
            user=request.user, tenant=tenant).order_by('-created_at')
    else:
        qs = SubAccount.objects.filter(
            user=request.user).order_by('-created_at')
    return envelope([_serialize_sub_account(sub) for sub in qs])


@extend_schema(
    summary='broker_account_detail_api',
    operation_id='broker_account_retrieve',
    description='Declared so drf-spectacular stops reporting an unguessable serializer; payload shape is verified by the envelope invariant tests.',
    request=OpenApiTypes.OBJECT,
    responses={
        200: envelope_response(),
    },
)
@required_workspace_permission('portfolio_read')
@api_view(['GET'])
@permission_classes([IsAuthenticated, WorkspacePermission])
def broker_account_detail_api(request, account_id):
    """B1.6: chi tiet 1 tieu khoan."""
    tenant = getattr(request, 'tenant', None)
    sub = _get_sub_account_or_404(account_id, request.user, tenant)
    return envelope(_serialize_sub_account(sub))


@extend_schema(
    summary='broker_account_positions_api',
    description='Declared so drf-spectacular stops reporting an unguessable serializer; payload shape is verified by the envelope invariant tests.',
    request=OpenApiTypes.OBJECT,
    responses={
        200: envelope_response(),
    },
)
@required_workspace_permission('portfolio_read')
@api_view(['GET'])
@permission_classes([IsAuthenticated, WorkspacePermission])
def broker_account_positions_api(request, account_id):
    """B1.6: vi the truc tiep tu broker (read-only, khong ghi DB)."""
    tenant = getattr(request, 'tenant', None)
    sub = _get_sub_account_or_404(account_id, request.user, tenant)
    service = _service_for_sub_account(sub)
    account_no = sub.external_id or sub.account_number
    return envelope(
        [_position_to_dict(p) for p in service.get_positions(account_no)])


@extend_schema(
    summary='broker_account_balance_api',
    description='Declared so drf-spectacular stops reporting an unguessable serializer; payload shape is verified by the envelope invariant tests.',
    request=OpenApiTypes.OBJECT,
    responses={
        200: envelope_response(),
    },
)
@required_workspace_permission('portfolio_read')
@api_view(['GET'])
@permission_classes([IsAuthenticated, WorkspacePermission])
def broker_account_balance_api(request, account_id):
    """B1.6: so du truc tiep tu broker (read-only, khong ghi DB)."""
    tenant = getattr(request, 'tenant', None)
    sub = _get_sub_account_or_404(account_id, request.user, tenant)
    service = _service_for_sub_account(sub)
    account_no = sub.external_id or sub.account_number
    return envelope(_balance_to_dict(service.get_balance(account_no)))


@extend_schema(
    summary='broker_account_orders_api',
    description='Declared so drf-spectacular stops reporting an unguessable serializer; payload shape is verified by the envelope invariant tests.',
    request=OpenApiTypes.OBJECT,
    responses={
        200: envelope_response(),
    },
)
@required_workspace_permission('portfolio_write')
@api_view(['GET'])
@permission_classes([IsAuthenticated, WorkspacePermission])
def broker_account_orders_api(request, account_id):
    """B1.6: so lenh truc tiep tu broker. Ghi (xem) nen can portfolio_write."""
    tenant = getattr(request, 'tenant', None)
    sub = _get_sub_account_or_404(account_id, request.user, tenant)
    service = _service_for_sub_account(sub)
    account_no = sub.external_id or sub.account_number
    return envelope([_order_to_dict(o) for o in service.get_orders(account_no)])


@extend_schema(
    summary='broker_account_sync_api',
    description='Declared so drf-spectacular stops reporting an unguessable serializer; payload shape is verified by the envelope invariant tests.',
    request=OpenApiTypes.OBJECT,
    responses={
        200: envelope_response(),
    },
)
@required_workspace_permission('portfolio_write')
@api_view(['POST'])
@permission_classes([IsAuthenticated, WorkspacePermission])
def broker_account_sync_api(request, account_id):
    """B1.6: enqueue sync 1 tieu khoan (position-first, worker). Tra 202."""
    tenant = getattr(request, 'tenant', None)
    sub = _get_sub_account_or_404(account_id, request.user, tenant)
    config = sub.broker_config
    if config is None:
        raise ValidationErrorException(
            detail='Tieu khoan chua lien ket cau hinh broker.',
            code='account_not_linked',
        )
    job = sync_broker_account_task.delay(config.id, sub.id)
    return envelope(
        {'ok': True, 'job_id': job.id, 'state': 'pending'},
        status=status.HTTP_202_ACCEPTED)


@extend_schema(
    summary='broker_sync_runs_api',
    description='Declared so drf-spectacular stops reporting an unguessable serializer; payload shape is verified by the envelope invariant tests.',
    request=OpenApiTypes.OBJECT,
    responses={
        200: envelope_response(),
    },
)
@required_workspace_permission('portfolio_read')
@api_view(['GET'])
@permission_classes([IsAuthenticated, WorkspacePermission])
def broker_sync_runs_api(request):
    """B1.6: lich su lan dong bo (moi nhat truoc)."""
    tenant = getattr(request, 'tenant', None)
    try:
        limit = max(1, min(int(request.query_params.get('limit', 20)), 100))
    except (TypeError, ValueError):
        limit = 20
    if tenant is not None:
        qs = BrokerSyncRun.objects.filter(
            user=request.user, tenant=tenant).order_by('-started_at')[:limit]
    else:
        qs = BrokerSyncRun.objects.filter(
            user=request.user).order_by('-started_at')[:limit]
    return envelope([{
        'id': run.id,
        'provider': run.provider,
        'status': run.status,
        'started_at': run.started_at,
        'finished_at': run.finished_at,
        'stats': run.stats,
        'error': run.error,
    } for run in qs])


@extend_schema(
    summary='broker_sync_issues_api',
    description='Declared so drf-spectacular stops reporting an unguessable serializer; payload shape is verified by the envelope invariant tests.',
    request=OpenApiTypes.OBJECT,
    responses={
        200: envelope_response(),
    },
)
@required_workspace_permission('portfolio_read')
@api_view(['GET'])
@permission_classes([IsAuthenticated, WorkspacePermission])
def broker_sync_issues_api(request):
    """B1.6: lech chua xu ly truoc (`?resolved=false`, `?severity=`)."""
    tenant = getattr(request, 'tenant', None)
    if tenant is not None:
        qs = BrokerSyncIssue.objects.filter(
            tenant=tenant).order_by('-created_at')
    else:
        qs = BrokerSyncIssue.objects.filter(
            run__user=request.user).order_by('-created_at')
    raw_resolved = request.query_params.get('resolved')
    if raw_resolved in ('true', '1'):
        qs = qs.filter(resolved=True)
    elif raw_resolved in ('false', '0'):
        qs = qs.filter(resolved=False)
    severity = (request.query_params.get('severity') or '').strip().lower()
    if severity in ('info', 'warning', 'error'):
        qs = qs.filter(severity=severity)
    return envelope([{
        'id': issue.id,
        'severity': issue.severity,
        'code': issue.code,
        'payload': issue.payload,
        'resolved': issue.resolved,
        'created_at': issue.created_at,
    } for issue in qs[:100]])


#: B3.2-BE — audit cho bien doi binding. `AuditEvent.action` chi nhan 6 gia tri
#: co dinh (`ops_audit/models.py:25`), nen ma nghiep vu nam o
#: `metadata['operation']`, tuong tu `_AUDIT_OPERATION` cua `views_dnse.py:211`.
_BINDING_AUDIT_RESOURCE_TYPE = 'portfolio_binding'
_BINDING_AUDIT_OPERATION_ADD = 'portfolio.binding.add'
_BINDING_AUDIT_OPERATION_REMOVE = 'portfolio.binding.remove'
_BINDING_AUDIT_OPERATION_CONVERT = 'portfolio.convert'

#: B3.2-BE — bang chuyen lan `kind` (contract dong bang §2): luat chi phu thuoc
#: dich (khong phu thuoc nguon), kiem tren so binding dem that trong transaction.
_CONVERT_TARGETS = ('manual', 'broker_backed', 'aggregate')


def _serialize_binding(binding) -> dict:
    """1 dong binding theo contract BE-READ §2 (khoa dung ten hien co)."""
    sub = binding.sub_account
    return {
        'binding_id': binding.id,
        'sub_account_id': binding.sub_account_id,
        'provider': sub.provider,
        'external_id': sub.external_id,
        'display_name': sub.display_name,
        'role': binding.role,
        'is_default': binding.is_default,
    }


def _audit_binding(request, portfolio, sub, operation, outcome, action, extra=None):
    """Ghi audit cho bien doi binding. Tra event, hoac None khi ghi hong.

    Import lazy nhu `views_dnse.py` (tranh circular import). `action` phai la
    1 trong 6 gia tri `AuditEvent.ActionChoices` (cot hep + choices).
    """
    try:
        from ops_audit.models import AuditEvent  # noqa: PLC0415 (lazy)
        metadata = {
            'operation': operation,
            'outcome': outcome,
            'portfolio_id': portfolio.id,
            'sub_account_id': getattr(sub, 'id', None),
            **(extra or {}),
        }
        return AuditEvent.objects.create(
            actor_user_id=request.user.id if getattr(
                request.user, 'is_authenticated', False) else None,
            actor_label=str(getattr(request.user, 'username', '') or '')[:120],
            tenant_id=str(getattr(
                getattr(request, 'tenant', None), 'public_id', '') or '')[:36],
            action=action,
            resource_type=_BINDING_AUDIT_RESOURCE_TYPE,
            resource_id=str(portfolio.id)[:64],
            request_id=str(getattr(request, 'request_id', '') or '')[:36],
            metadata=metadata,
        )
    except Exception:  # noqa: BLE001 — audit hong khong duoc lam vo request chinh
        logger.error(
            'AUDIT-BINDING-UNAVAILABLE operation=%s portfolio=%s',
            operation, getattr(portfolio, 'id', None), exc_info=True,
        )
        return None


def _convert_portfolio_kind(request, portfolio, data):
    """Action `convert` — duong chuyen lan `kind` duy nhat (O-5).

    PATTERN: dem binding that trong transaction (select_for_update khoa
    portfolio), ap bang chuyen lan §2, doi kind, ghi audit. Moi convert
    (ke ca no-op cung kind) deu ghi audit; audit hong ⇒ tu choi
    (`audit_unavailable`, fail-closed nhu luong dat lenh `views_dnse.py:759`).
    """
    from ops_audit.models import AuditEvent  # noqa: PLC0415 (lazy, lay choices)

    target = str(data.get('kind', '')).strip().lower()
    if target not in _CONVERT_TARGETS:
        raise ValidationErrorException(
            detail="kind phai la 'manual', 'broker_backed' hoac 'aggregate'.",
            code='validation_error',
        )
    with db_transaction.atomic():
        locked = Portfolio.objects.select_for_update().get(pk=portfolio.pk)
        count = locked.broker_bindings.count()
        if target == 'broker_backed' and count != 1:
            if count == 0:
                raise ValidationErrorException(
                    detail='Chuyen sang broker_backed can dung 1 tieu khoan '
                           'lien ket. Gop tieu khoan truoc.',
                    code='convert_needs_binding',
                )
            raise ValidationErrorException(
                detail='Danh muc broker_backed chi giu dung 1 tieu khoan. '
                       'Tach bot hoac chuyen sang aggregate de gop.',
                code='broker_backed_single_account',
            )
        if target == 'aggregate' and count == 0:
            raise ValidationErrorException(
                detail='Chuyen sang aggregate can it nhat 1 tieu khoan '
                       'lien ket. Gop tieu khoan truoc.',
                code='convert_needs_binding',
            )
        if target == 'manual' and count > 0:
            raise ValidationErrorException(
                detail='Ve manual phai tach het tieu khoan lien ket truoc.',
                code='convert_requires_empty',
            )
        from_kind = locked.kind
        if target != from_kind:
            locked.kind = target
            locked.save(update_fields=['kind', 'updated_at'])
        event = _audit_binding(
            request, locked, None, _BINDING_AUDIT_OPERATION_CONVERT,
            'accepted', AuditEvent.ActionChoices.UPDATE,
            {'from_kind': from_kind, 'to_kind': target,
             'binding_count': count},
        )
        if event is None:
            raise InternalErrorException(
                detail='Khong ghi duoc audit chuyen loai danh muc nen thao '
                       'tac bi tu choi. Khong co gi thay doi.',
                code='audit_unavailable',
            )
    return envelope({
        'ok': True, 'portfolio_id': locked.id, 'kind': target,
        'from_kind': from_kind, 'binding_count': count,
        'audit_recorded': True,
    })


@extend_schema(
    summary='portfolio_broker_bindings_api',
    description='Declared so drf-spectacular stops reporting an unguessable serializer; payload shape is verified by the envelope invariant tests.',
    request=OpenApiTypes.OBJECT,
    responses={
        200: envelope_response(),
    },
)
@required_workspace_permission('portfolio_write')
@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated, WorkspacePermission])
def portfolio_broker_bindings_api(request, portfolio_id):
    """B1.6: gop/tach tieu khoan khoi danh muc (explicit, QĐ-C).

    Danh muc `broker_backed` chi giu DUNG 1 tieu khoan — gop them phai doi
    sang `aggregate` (hoac tach cu). Quy tac nay ngan tron lan cau truc.

    BE-READ (Wave 3): GET tra danh sach binding theo contract §2.
    B3.2-BE (Wave 3): action `convert` doi `kind` theo bang chuyen lan.
    GET giu `portfolio_write` nhu PATCH (panel vua doc vua gop/tach).
    """
    from .models import PortfolioBrokerBinding  # noqa: PLC0415 (lazy)

    tenant = getattr(request, 'tenant', None)
    try:
        if tenant is not None:
            portfolio = Portfolio.objects.get(
                pk=portfolio_id, user=request.user, tenant=tenant)
        else:
            portfolio = Portfolio.objects.get(
                pk=portfolio_id, user=request.user)
    except (Portfolio.DoesNotExist, ValueError, TypeError):
        raise NotFoundErrorException(
            detail='Danh muc khong ton tai.',
            code='portfolio_not_found',
        )
    if request.method == 'GET':
        bindings = PortfolioBrokerBinding.objects.filter(
            portfolio=portfolio).select_related('sub_account').order_by(
            '-created_at')
        return envelope([_serialize_binding(b) for b in bindings])

    data = request.data if isinstance(request.data, dict) else {}
    action = str(data.get('action', '')).strip().lower()
    if action == 'convert':
        return _convert_portfolio_kind(request, portfolio, data)
    from ops_audit.models import AuditEvent  # noqa: PLC0415 (lazy, lay choices)
    sub_account_id = data.get('sub_account_id')
    sub = _get_sub_account_or_404(sub_account_id, request.user, tenant)

    if action == 'add':
        if portfolio.kind == 'broker_backed' and PortfolioBrokerBinding.objects.filter(
                portfolio=portfolio).exclude(sub_account=sub).exists():
            raise ValidationErrorException(
                detail='Danh muc broker_backed chi giu 1 tieu khoan. '
                       'Doi sang aggregate de gop, hoac tach tieu khoan cu.',
                code='broker_backed_single_account',
            )
        role = str(data.get('role') or 'secondary').strip().lower()
        if role not in ('primary', 'secondary'):
            raise ValidationErrorException(
                detail="role phai la 'primary' hoac 'secondary'.",
                code='validation_error',
            )
        binding, _ = PortfolioBrokerBinding.objects.get_or_create(
            portfolio=portfolio, sub_account=sub,
            defaults={
                'tenant': tenant or portfolio.tenant,
                'role': role,
                'is_default': bool(data.get('is_default', False)),
            },
        )
        binding.full_clean()
        event = _audit_binding(
            request, portfolio, sub, _BINDING_AUDIT_OPERATION_ADD,
            'accepted', AuditEvent.ActionChoices.CREATE,
            {'binding_id': binding.id, 'role': binding.role},
        )
        return envelope({
            'ok': True, 'portfolio_id': portfolio.id,
            'sub_account_id': sub.id, 'binding_id': binding.id,
            'audit_recorded': event is not None,
        })
    if action == 'remove':
        deleted, _ = PortfolioBrokerBinding.objects.filter(
            portfolio=portfolio, sub_account=sub).delete()
        event = _audit_binding(
            request, portfolio, sub, _BINDING_AUDIT_OPERATION_REMOVE,
            'accepted', AuditEvent.ActionChoices.DELETE,
            {'removed': bool(deleted)},
        )
        return envelope({
            'ok': True, 'portfolio_id': portfolio.id,
            'sub_account_id': sub.id, 'removed': bool(deleted),
            'audit_recorded': event is not None,
        })
    raise ValidationErrorException(
        detail="action phai la 'add', 'remove' hoac 'convert'.",
        code='validation_error',
    )


# SAFE-04: xem iews_dnse.py — @api_view khong chep attribute sang class.
attach_required_permissions(
    broker_config_api,
    broker_test_connection_api,
)

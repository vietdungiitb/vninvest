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


@extend_schema(
    summary='portfolio_broker_bindings_api',
    description='Declared so drf-spectacular stops reporting an unguessable serializer; payload shape is verified by the envelope invariant tests.',
    request=OpenApiTypes.OBJECT,
    responses={
        200: envelope_response(),
    },
)
@required_workspace_permission('portfolio_write')
@api_view(['PATCH'])
@permission_classes([IsAuthenticated, WorkspacePermission])
def portfolio_broker_bindings_api(request, portfolio_id):
    """B1.6: gop/tach tieu khoan khoi danh muc (explicit, QĐ-C).

    Danh muc `broker_backed` chi giu DUNG 1 tieu khoan — gop them phai doi
    sang `aggregate` (hoac tach cu). Quy tac nay ngan tron lan cau truc.
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
    data = request.data if isinstance(request.data, dict) else {}
    action = str(data.get('action', '')).strip().lower()
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
        binding, _ = PortfolioBrokerBinding.objects.get_or_create(
            portfolio=portfolio, sub_account=sub,
            defaults={
                'tenant': tenant or portfolio.tenant,
                'role': str(data.get('role') or 'primary'),
                'is_default': bool(data.get('is_default', False)),
            },
        )
        binding.full_clean()
        return envelope({
            'ok': True, 'portfolio_id': portfolio.id,
            'sub_account_id': sub.id, 'binding_id': binding.id,
        })
    if action == 'remove':
        deleted, _ = PortfolioBrokerBinding.objects.filter(
            portfolio=portfolio, sub_account=sub).delete()
        return envelope({
            'ok': True, 'portfolio_id': portfolio.id,
            'sub_account_id': sub.id, 'removed': bool(deleted),
        })
    raise ValidationErrorException(
        detail="action phai la 'add' hoac 'remove'.",
        code='validation_error',
    )


# SAFE-04: xem iews_dnse.py — @api_view khong chep attribute sang class.
attach_required_permissions(
    broker_config_api,
    broker_test_connection_api,
)

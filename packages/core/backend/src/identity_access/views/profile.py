import logging

from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import permissions, status
from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
    throttle_classes,
)
from rest_framework.response import Response

from vninvest_core.api_envelope import envelope_response

from ..authentication import CorePATAuthentication
from ..envelope import envelope
from ..models import CorePATCredential, CoreTenant
from ..permissions import require_human_session
from .helpers import (
    _USER_CONFIG_STORE,
    TENANT_PERMISSION_CLASSES,
    AuthBootstrapThrottle,
    _build_capabilities_payload,
    _current_user_config,
    _normalize_user_config_payload,
    _resolve_request_service_account,
    _tenant_payload,
    _user_payload,
)

logger = logging.getLogger(__name__)


#: `data` free-form: payload là `{**_user_payload(user), plan, abilities,
#: entitlements, capabilities, user, tenant, …}` — có **splat** và khối lồng
#: nhau dựng ở `views/helpers.py`, key không ổn định theo từng nhánh 404/200.
#: Liệt kê cứng sẽ bắt client tin có field không tồn tại — xem bảng "Khi nào
#: KHÔNG tạo serializer" ở `identity_access/schema.py`.
@extend_schema(
    responses={200: envelope_response()},
)
@api_view(['GET'])
@authentication_classes([CorePATAuthentication])
@permission_classes(TENANT_PERMISSION_CLASSES)
@throttle_classes([AuthBootstrapThrottle])
def profile_view(request):
    """
    GET /core/v1/auth/profile
    Returns current user/tenant profile.
    Requires: Authorization: Bearer <raw_pat>
    """
    user = request.user
    try:
        tenant = user.core_tenant
    except CoreTenant.DoesNotExist:
        return Response(
            {'detail': 'No tenant associated with this account.'},
            status=status.HTTP_404_NOT_FOUND,
        )

    service_account = _resolve_request_service_account(request, tenant)
    subscription = getattr(tenant, 'subscription', None)
    capabilities = _build_capabilities_payload(user, tenant, service_account)

    subscription_payload = None
    if subscription and getattr(subscription, 'status', '') == 'active':
        subscription_payload = {
            'plan': subscription.plan,
            'status': subscription.status,
        }

    from django.db.models import Q
    user_tenants = CoreTenant.objects.filter(Q(owner_user=user) | Q(members__user=user)).distinct()

    active_pat_count = CorePATCredential.objects.filter(
        service_account__tenant=tenant,
        status=CorePATCredential.StatusChoices.ACTIVE,
        expires_at__gt=timezone.now(),
    ).count()

    return envelope(
        {
            **_user_payload(user),
            'plan': tenant.plan,
            'active_pat_count': active_pat_count,
            'abilities': capabilities['abilities'],
            'entitlements': capabilities['entitlements'],
            'capabilities': capabilities,
            'user': _user_payload(user),
            'tenant': {
                **_tenant_payload(tenant),
                'created_at': tenant.created_at.isoformat() if hasattr(tenant, 'created_at') else None,
            },
            'tenants': [_tenant_payload(t) for t in user_tenants],
            'subscription': subscription_payload,
        }
    )


#: `data` free-form — payload là `_build_capabilities_payload(...)`, dict dựng tay
#: nhiều tầng (`principal` / `abilities` / `build` / `navigation` / `surfaces` /
#: `entitlements`). Nhánh 200-anonymous cũng dùng **cùng** key set ⇒ mô tả
#: free-form thay vì liệt kê 6 nhánh.
@extend_schema(
    responses={200: envelope_response()},
)
@api_view(['GET'])
@authentication_classes([CorePATAuthentication])
@permission_classes([permissions.AllowAny])
@throttle_classes([AuthBootstrapThrottle])
def capabilities_view(request):
    user = request.user
    if not user or not user.is_authenticated:
        # Return minimal empty capabilities — frontend handles gracefully.
        # Must NOT return 401 here: syncAuthState treats 401 as auth failure → logout.
        return envelope({
            'principal': {'identity': {}, 'is_authenticated': False},
            'abilities': [],
            'build': {'plan': 'free', 'target': 'core'},
            'navigation': {'visible_groups': [], 'visible_routes': []},
            'surfaces': {},
            'entitlements': {},
        }, status=200)
    try:
        tenant = user.core_tenant
    except CoreTenant.DoesNotExist:
        return Response(
            {'detail': 'No tenant associated with this account.'},
            status=status.HTTP_404_NOT_FOUND,
        )

    service_account = _resolve_request_service_account(request, tenant)
    return envelope(_build_capabilities_payload(user, tenant, service_account), status=status.HTTP_200_OK)


@api_view(['GET', 'PUT'])
@authentication_classes([CorePATAuthentication])
@permission_classes(TENANT_PERMISSION_CLASSES)
def user_config_view(request):
    require_human_session(request)
    user = request.user
    try:
        tenant = user.core_tenant
    except CoreTenant.DoesNotExist:
        return Response(
            {'detail': 'No tenant associated with this account.'},
            status=status.HTTP_404_NOT_FOUND,
        )

    key = str(tenant.public_id)
    if request.method == 'GET':
        return envelope(_current_user_config(tenant), status=status.HTTP_200_OK)

    if not isinstance(request.data, dict):
        return Response(
            {'detail': 'Invalid user config payload.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    current = _current_user_config(tenant)
    current.update(_normalize_user_config_payload(request.data))
    _USER_CONFIG_STORE[key] = current
    return envelope(current, status=status.HTTP_200_OK)

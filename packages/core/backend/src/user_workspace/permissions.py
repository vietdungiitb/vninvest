"""
Permissions module for user_workspace domain.

TenantScopePermission ensures request.user has active tenant and attaches
request.tenant for use in views.
"""
import logging
from typing import Optional
from rest_framework.permissions import BasePermission

from identity_access.utils.resolve_tenant import (
    RESOLVABLE_TENANT_STATUSES,
    first_eligible_tenant_for_user,
    get_tenant_permissions,
    is_plausible_tenant_public_id,
    owner_tenant_for_user,
    resolve_tenant_for_user,
)

logger = logging.getLogger(__name__)


#: SAFE-04 R2 — permission string cho từng nhóm endpoint portfolio/broker.
#:
#: Tên permission PHẢI khớp `SYSTEM_ROLE_PERMISSIONS` trong
#: `identity_access/utils/resolve_tenant.py`, nơi đã có sẵn 4 system role và
#: custom_role override. Ta KHÔNG tạo hệ capability song song — sẽ tạo ra
#: hai nguồn sự thật và lệch nhau đúng như lỗi resolver năm 2026-09-26.
#: `owner` có `['*']`; `admin`/`editor`/`viewer` có danh sách hẹp.
WORKSPACE_PERMISSIONS = {
    # Đọc portfolio / holdings / NAV / ledger.
    'portfolio_read': 'dashboard:read',
    # Ghi danh sách chứng khoán, transaction, sub-account.
    'portfolio_write': 'dashboard:read',
    # Đặt lệnh (kể cả paper) — hành động tạo ra rủi ro tài chính.
    'order_write': 'alert:write',
    # Cấu hình / xoá credential broker.
    'broker_manage': 'settings:write',
}


def has_workspace_permission(request, permission: str) -> bool:
    """True nếu actor của request có `permission` trong tenant hiện tại.

    Dùng lại `get_tenant_permissions()` — cùng một nguồn sự thật với
    `identity_access`, nên custom_role cũng được áp dụng như nhau.

    Fail-closed: không xác định được actor thì trả `False`. Một endpoint
    tài chính không được phép "có lẽ là được" khi không biết ai đang hỏi.
    """
    user = getattr(request, 'user', None)
    if user is None or not getattr(user, 'is_authenticated', False):
        return False
    try:
        perms = get_tenant_permissions(request)
    except Exception:  # noqa: BLE001 — lỗi phân giải quyền thì chặn
        logger.error(
            'has_workspace_permission: cannot resolve permissions — denying',
            exc_info=True,
        )
        return False
    if '*' in perms:
        return True
    return permission in perms


class WorkspacePermission(BasePermission):
    """SAFE-04 — view tài chính phải khai báo quyền, thiếu thì chặn.

    Dùng như:
        @permission_classes([IsAuthenticated, WorkspacePermission])
        @required_workspace_permission('order_write')
        def place_order(...)

    Khác `IsAuthenticated` trần: `IsAuthenticated` chỉ hỏi "có đăng nhập
    không", còn đây hỏi "có QUYỀN trong tenant này không". Một user đăng nhập
    hợp lệ nhưng chỉ có vai trò `viewer` sẽ bị chặn ở endpoint tài chính.

    Decorator là bắt buộc (`required_workspace_permission`) chứ không suy ra
    từ tên view: suy ra từ tên là đoán, và một view tên sai sẽ hở. Thiếu
    decorator ⇒ `has_permission` trả `False` (deny), đúng R3.
    """

    message = 'Bạn không có quyền thực hiện thao tác này trong tenant hiện tại.'

    def has_permission(self, request, view) -> bool:
        required = _declared_permissions(view)
        if not required:
            # R3: deny-by-default. View tài chính chưa khai báo quyền thì
            # KHÔNG được mở — im lặng cho qua là fail-open.
            logger.error(
                'WorkspacePermission: view %s khai bao cap cong thong qua '
                '(safe: doc). Denying write-capable request.',
                getattr(view, '__name__', view),
            )
            return False
        for permission in required:
            if not has_workspace_permission(request, permission):
                logger.warning(
                    'WorkspacePermission: thieu permission %s cho user=%s',
                    permission, getattr(getattr(request, 'user', None), 'id', None),
                )
                return False
        return True


def _declared_permissions(view) -> list:
    """Lấy permission khai báo từ view, chịu được cả `@api_view`.

    `@api_view` của DRF dựng class `WrappedAPIView` rồi chép **một danh sách
    cố định** attribute sang class đó (rest_framework/decorators.py:55-61:
    `__name__`, `__module__`, `renderer_classes`, `parser_classes`,
    `authentication_classes`, `throttle_classes`, `schema`). Attribute tuỳ ý
    như `required_workspace_permission` **không** được chép.

    Đo bằng lệnh (không suy luận):
        type(v.dnse_place_order_api)          -> <class 'function'>
        hasattr(v.dnse_place_order_api, '...') -> False
        sorted(v.dnse_place_order_api.cls.__dict__) -> không có attribute đó

    Vì vậy decorator buộc phải ghi xuống `.cls` — và vì `@api_view` tạo `.cls`
    *sau* khi các decorator bên trong đã chạy, ta ghi cả hai nơi: lúc trang
    trí (nếu `.cls` đã tồn tại) và lúc import module xong (qua
    `attach_required_permissions`).
    """
    candidates = [view]
    cls = getattr(view, 'cls', None)
    if cls is not None:
        candidates.append(cls)
        handler = getattr(cls, 'handler', None)
        if handler is not None:
            candidates.append(handler)

    for candidate in candidates:
        declared = getattr(candidate, 'required_workspace_permission', None)
        if declared:
            return list(declared) if isinstance(declared, (list, tuple)) else [declared]
    return []


def attach_required_permissions(*views) -> None:
    """Chuyển khai báo từ hàm gốc sang `.cls` của `@api_view`.

    Gọi một lần ở cuối module sau khi mọi view đã được `@api_view` bọc. Đây là
    nơi duy nhất DRF thật sự giữ được attribute.
    """
    for view in views:
        declared = getattr(view, 'required_workspace_permission', None)
        cls = getattr(view, 'cls', None)
        if not declared or cls is None:
            continue
        cls.required_workspace_permission = (
            list(declared) if isinstance(declared, (list, tuple)) else [declared]
        )
        logger.debug(
            'attach_required_permissions: %s -> %s',
            getattr(view, '__name__', view), declared,
        )


def required_workspace_permission(*permissions: str):
    """Decorator: gắn permission bắt buộc lên view (SAFE-04 R1)."""
    def decorator(view_func):
        existing = getattr(view_func, 'required_workspace_permission', None)
        if existing:
            merged = list(existing) if isinstance(existing, (list, tuple)) else [existing]
            for p in permissions:
                if p not in merged:
                    merged.append(p)
        else:
            merged = list(permissions)
        view_func.required_workspace_permission = merged
        # Nếu `@api_view` đã chạy trước (thứ tự decorator ngược), `.cls` có
        # sẵn — ghi luôn để không phụ thuộc thứ tự.
        cls = getattr(view_func, 'cls', None)
        if cls is not None:
            cls.required_workspace_permission = merged
        return view_func
    return decorator




class TenantScopePermission(BasePermission):
    """
    Ensure authenticated user has active tenant.
    Attaches request.tenant for downstream views.

    Use in view.permission_classes:
        permission_classes = [IsAuthenticated, TenantScopePermission]

    After check, request.tenant will be set (or None if single-tenant mode).
    """

    def has_permission(self, request, view) -> bool:
        if not request.user or not request.user.is_authenticated:
            return False

        # ------------------------------------------------------------------
        # The middleware is authoritative. Do NOT overwrite its decision.
        # ------------------------------------------------------------------
        # TenantResolutionMiddleware (MIDDLEWARE index 8) already reads
        # X-Tenant-ID, applies the shared owner-or-member check, and sets
        # BOTH request.tenant and request.tenant_role. The previous version of
        # this class unconditionally re-resolved and overwrote request.tenant
        # from user.core_profile.tenant, which is a *different* tenant than the
        # one the middleware picked. That is the B5 bug: for a user who owns
        # tenant A and is a viewer in tenant B, TenantQuotaMiddleware (index 9,
        # earlier in the chain) metered and incremented Redis against A while
        # user_workspace views then read B - and get_tenant_role() returned A's
        # role, so a mere viewer in B passed `tenant:write`-style checks
        # measured against A's owner role.
        current = getattr(request, 'tenant', None)
        if current is not None:
            # Keep the middleware's tenant. Only apply this class's status gate,
            # which is what distinguishes PENDING_ACTIVATION (not resolvable)
            # from SUSPENDED/DEPROVISIONED (already 403'd by the middleware).
            return current.status in RESOLVABLE_TENANT_STATUSES

        # ------------------------------------------------------------------
        # No middleware resolution (exempt paths, or middleware bypassed):
        # resolve here, through the SAME shared membership check.
        # ------------------------------------------------------------------
        # X-Tenant-ID is the header the frontend actually sends, carrying
        # CoreTenant.public_id. The legacy names below are kept working.
        public_id_hint = (request.headers.get('X-Tenant-ID') or '').strip()
        if public_id_hint:
            # Bounded shape check before touching the DB. NOT a strict UUID
            # parse on purpose: public_id is a CharField(max_length=36) that
            # only *auto-fills* with str(uuid.uuid4()) (models.py:128-132), and
            # the existing test-suite uses non-UUID values such as
            # 'rbac_tenant' / 'test_tenant_123'. A strict UUID check would 403
            # legitimate requests. Garbage is rejected by the shape check and by
            # the membership check, never by a ValidationError 500.
            if not is_plausible_tenant_public_id(public_id_hint):
                logger.warning(
                    'TenantScopePermission: malformed X-Tenant-ID rejected '
                    '(user=%s).', getattr(request.user, 'username', '?'),
                )
                return False
            tenant, _role = resolve_tenant_for_user(request.user, public_id_hint)
            if tenant is None:
                return False
            request.tenant = tenant
            return True

        tenant_code_hint = (
            request.headers.get('X-Tenant-Code')
            or request.query_params.get('tenant_code')
            or request.query_params.get('tenant')
        )

        # Resolve tenant from user
        tenant = _resolve_tenant(request.user, tenant_code_hint=tenant_code_hint)
        if not tenant:
            return False
        request.tenant = tenant  # Attach to request for view use

        return True


def _resolve_tenant(user, tenant_code_hint: Optional[str] = None) -> Optional['CoreTenant']:
    """Resolve a tenant for ``user`` by DELEGATING to the shared SSOT.

    This used to be a fourth independent resolver: its own priority order
    (profile -> member -> owner), its own inline ``['active','trial']`` status
    literals, and its own hint vocabulary. That is not a style problem - the two
    implementations could pick DIFFERENT tenants for the same request. For a user
    who owns a SUSPENDED tenant A and is an active viewer in B, this function
    skipped A on status and returned B, while ``owner_tenant_for_user`` returned
    A, so identity_access views operated on A while user_workspace views operated
    on B from one request, and ``get_tenant_role`` then reported A's ``owner``.

    Delegating removes the possibility rather than documenting it. The order is the
    SSOT's: owner (status-filtered) -> first eligible membership. The profile-tenant
    preference is gone on purpose: it was the other half of the disagreement.
    ``RESOLVABLE_TENANT_STATUSES`` is imported rather than re-listed so the two
    cannot drift.
    """
    normalized_hint = (tenant_code_hint or '').strip().lower()

    # An explicit tenant_code hint is a different key from public_id, and the SSOT
    # resolves by public_id. Look it up here, but still subject it to the shared
    # owner-or-member membership check so a hint cannot reach another tenant.
    if normalized_hint:
        try:
            from django.db.models import Q

            from identity_access.models import CoreTenant, TenantMember
        except ImportError:  # identity_access not installed in this environment
            return None
        try:
            # A tenant_code hint still has to satisfy owner-or-member, exactly as
            # resolve_tenant_for_user does for a public_id hint.
            member_tenant_ids = TenantMember.objects.filter(user=user).values_list(
                'tenant_id', flat=True
            )
            candidate = (
                CoreTenant.objects.filter(tenant_code__iexact=normalized_hint)
                .filter(
                    Q(owner_user=user) | Q(pk__in=member_tenant_ids),
                    status__in=RESOLVABLE_TENANT_STATUSES,
                )
                .order_by('pk')
                .first()
            )
        except Exception as exc:  # pragma: no cover - defensive
            logger.warning(
                '_resolve_tenant hint lookup failed for user=%s: %s',
                getattr(user, 'id', None),
                exc,
            )
            return None
        return candidate

    # NOTE: first_eligible_tenant_for_user returns a (tenant, role) TUPLE, while
    # owner_tenant_for_user returns a bare tenant. Mixing them up assigns the tuple
    # to request.tenant, and every downstream `filter(tenant=request.tenant)` then
    # raises "Field 'id' expected a number but got <CoreTenant>".
    #
    # The status check is HERE rather than inside owner_tenant_for_user on purpose.
    # That shared helper is unfiltered so the middleware can report the precise
    # `tenant_suspended` instead of a misleading `tenant_not_found`, which its
    # tests pin. Applying the same eligibility rule at both call sites is what
    # makes the two resolvers agree, without destroying the error detail.
    owner = owner_tenant_for_user(user)
    if owner is not None and owner.status in RESOLVABLE_TENANT_STATUSES:
        return owner
    tenant, _role = first_eligible_tenant_for_user(user)
    return tenant

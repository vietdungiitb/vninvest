"""
Tenant-permission gate for the billing/usage read endpoints.

Reuses the existing single source of truth instead of re-deriving a role check.
`identity_access/utils/resolve_tenant.py` already carries:

* `get_tenant_role()` — the role the request pipeline decided on
* `SYSTEM_ROLE_PERMISSIONS` (`:27-56`) — the role → permission-token table
* `require_tenant_permission()` (`:399`) — the deny helper that respects
  `custom_role`

and that table already encodes the policy this gate needs: `billing:read` is
granted to `owner` (`*`) and `admin`, and withheld from `editor` and `viewer`.
That matches `D07_API_SPECIFICATION_20261002.md:707` ("Owner, Admin") for
`GET /billing/invoices`.

Why the permission tokens and not a hand-written role set: a tenant member with
a `custom_role` may legitimately be granted `billing:read`. A hardcoded
`role in ('owner', 'admin')` check would silently ignore that grant, so the
role table and the custom-role table could disagree. Going through
`require_tenant_permission` keeps one rule for both.

Why the invoice queryset cannot be narrowed instead
----------------------------------------------------
`Invoice`, `QuotaRecord` and `Subscription` are keyed by `tenant` only — there is
no user FK in `commercial/models.py`. "A member's own invoices" does not exist
in this schema, so "a viewer must not see other members' invoices" is only
expressible as *refuse the viewer the endpoint*, which is what this gate does.

Views opt in by declaring `required_tenant_permissions`:

    class InvoiceListView(generics.ListAPIView):
        required_tenant_permissions = ('billing:read',)
        permission_classes = [permissions.IsAuthenticated, RequiresTenantPermission]

`RequiresTenantPermission` is listed LAST on purpose: `IsAuthenticated` and
`IsTenantActive` should produce their own 401/403 before this one runs.
"""

from rest_framework import permissions

from identity_access.utils.resolve_tenant import require_tenant_permission


class RequiresTenantPermission(permissions.BasePermission):
    """Enforce the view's `required_tenant_permissions` against the request.

    A view that declares no `required_tenant_permissions` is left alone, so
    adding this class to a view is opt-in per endpoint.

    Fails closed: `require_tenant_permission` raises `PermissionDenied` when a
    token is missing, and DRF renders that as 403 rather than falling through to
    an allow.
    """

    message = 'Tài khoản này không có quyền đọc dữ liệu này trong tenant.'

    def has_permission(self, request, view):
        required = getattr(view, 'required_tenant_permissions', ())
        if not required:
            return True
        require_tenant_permission(request, *required)
        return True
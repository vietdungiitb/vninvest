"""Helper tạo user + tenant cho test HTTP.

SAFE-04 (2026-10-07): `PortfolioAICommandCenterView` nằm trong
`portfolio_analytics_views.py` nay da co `WorkspacePermission`. Test cu tao user
khong thuoc tenant nao nen nhan `403` thay vi `400`/`200` mong doi.

Day la hanh vi DUNG, khong phai test hong:
`SystemAISettings` va `UserAICredential` deu gan theo **tenant** — mot user khong
thuoc tenant nao thi khong co config de doc hay ghi. `403` dung hon `400`, va
`400` chi dang dung khi user da co quyen.

Ham nay nap user vao tenant voi role cu the. Dung `grant_tenant` khi can quyen
ghi (`editor`/`admin`/`owner`), `grant_tenant_readonly` khi chi doc.
"""
from __future__ import annotations

from django.contrib.auth.models import User

from identity_access.models import CoreTenant, TenantMember


def grant_tenant(
    user: User,
    *,
    role: str = 'editor',
    tenant_code: str = 'test-tenant',
    display_name: str = 'Test Tenant',
) -> CoreTenant:
    """Tao (hoac lay) tenant ACTIVE va gan `user` vao voi `role`.

    `role` duoc dat tren dong `TenantMember` — dung mo hinh "user la thanh vien
    cua tenant cua chu". KHONG dat `owner_user=user` mac dinh, vi `get_tenant_role`
    doi chieu `tenant.owner_user == request.user` TRUOC khi xem `TenantMember`,
    nen dat `owner_user` cho user test se luon tra `'owner'` va role y dinh se
    khong bao gio duoc ap dung.

    `role='owner'` van gan `owner_user` de kiem tra duong owner trong resolver.
    """
    tenant = CoreTenant.objects.filter(tenant_code=tenant_code).first()
    if tenant is None:
        # Chua co tenant -> tao moi. `owner_user` la mot user rieng de khong
        # lam `role` cua user test bi ghi de.
        anchor = User.objects.filter(username=f'{tenant_code}-owner').first()
        if anchor is None:
            anchor = User.objects.create_user(
                username=f'{tenant_code}-owner', password='testpass123',
            )
        tenant = CoreTenant.objects.create(
            tenant_code=tenant_code,
            display_name=display_name,
            owner_user=anchor,
            status=CoreTenant.StatusChoices.ACTIVE,
        )
    if role == 'owner':
        tenant.owner_user = user
        tenant.save(update_fields=['owner_user'])
        return tenant
    TenantMember.objects.get_or_create(
        tenant=tenant, user=user, defaults={'role': role},
    )
    return tenant


def grant_tenant_readonly(user: User, **kwargs) -> CoreTenant:
    """User chỉ có quyen doc — dung de chung minh endpoint ghi bi chan."""
    return grant_tenant(user, role='viewer', **kwargs)
from dataclasses import dataclass

from .models import CoreTenant


@dataclass(frozen=True)
class PartnerTenantContext:
    owner_user: object
    tenant_id: str
    tenant_code: str
    display_name: str
    plan_code: str
    status: str = 'active'
    default_environment: str = 'prod'


def resolve_partner_tenant_context(user) -> PartnerTenantContext:
    tenant = CoreTenant.ensure_for_user(user)

    return PartnerTenantContext(
        owner_user=tenant.owner_user,
        tenant_id=tenant.public_id,
        tenant_code=tenant.tenant_code,
        display_name=tenant.display_name,
        plan_code=tenant.plan_code,
        status=tenant.status,
        default_environment=tenant.default_environment,
    )
from dataclasses import dataclass

try:
    from identity_access.models import CoreTenant
    HAS_CORETENANT = True
except ImportError:
    HAS_CORETENANT = False
    CoreTenant = None


@dataclass(frozen=True)
class PartnerTenantContext:
    owner_user: object
    tenant_id: str
    tenant_code: str
    display_name: str
    plan_code: str
    status: str = 'active'
    default_environment: str = 'prod'


def _normalize_tenant_code(raw_value: str, fallback: str, owner_user_id: int) -> str:
    value = str(raw_value or '').strip().lower().replace('_', '-')
    normalized = ''.join(ch if ch.isalnum() or ch == '-' else '-' for ch in value)
    normalized = '-'.join(part for part in normalized.split('-') if part)
    if not normalized:
        normalized = fallback
    suffix = str(owner_user_id or 0)
    if not normalized.endswith(f'-{suffix}'):
        normalized = f'{normalized}-{suffix}'
    return normalized[:96]


def resolve_partner_tenant_context(user) -> PartnerTenantContext:
    if not HAS_CORETENANT:
        raise RuntimeError('identity_access module not available. This function requires CoreTenant.')
    
    owner_user_id = getattr(user, 'pk', None)
    if not owner_user_id:
        raise ValueError('owner_user must be saved before resolving CoreTenant.')

    username = str(getattr(user, 'username', '') or '').strip()
    email = str(getattr(user, 'email', '') or '').strip()
    email_local = email.split('@', 1)[0] if email else ''
    display_name = username or email or f'user-{owner_user_id}'
    plan = str(getattr(getattr(user, 'user_config', None), 'plan', 'free') or 'free').strip().lower()

    tenant, created = CoreTenant.objects.get_or_create(
        owner_user=user,
        defaults={
            'public_id': f'ten_usr_{owner_user_id}',
            'tenant_code': _normalize_tenant_code(
                username or email_local,
                fallback=f'tenant-{owner_user_id}',
                owner_user_id=owner_user_id,
            ),
            'display_name': display_name,
            'plan': plan,
            'status': CoreTenant.StatusChoices.ACTIVE,
            'features': [],
        },
    )

    if not created:
        update_fields = []
        if not tenant.public_id:
            tenant.public_id = f'ten_usr_{owner_user_id}'
            update_fields.append('public_id')
        if not tenant.tenant_code:
            tenant.tenant_code = _normalize_tenant_code(
                username or email_local,
                fallback=f'tenant-{owner_user_id}',
                owner_user_id=owner_user_id,
            )
            update_fields.append('tenant_code')
        if tenant.display_name != display_name:
            tenant.display_name = display_name
            update_fields.append('display_name')
        if update_fields:
            tenant.save(update_fields=[*update_fields, 'updated_at'])

    return PartnerTenantContext(
        owner_user=tenant.owner_user,
        tenant_id=tenant.public_id,
        tenant_code=tenant.tenant_code,
        display_name=tenant.display_name,
        plan_code=tenant.plan,
        status=tenant.status,
        default_environment='prod',
    )

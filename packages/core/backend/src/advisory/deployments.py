"""
R2.1: resolver deployment/fallback-chain.

- pick_active_deployment(user): deployment user đang chọn (active_deployment),
  None nếu chưa dùng R2 (hành vi cũ giữ nguyên).
- resolve_fallback_chain(user, tenant=None): danh sách AIDeployment theo thứ tự
  chain của user (rơi xuống tenant, rồi system). Chain rỗng/thiếu ⇒ [] (không
  failover — AC3).
"""
from typing import Optional


def pick_active_deployment(user):
    from advisory.models import UserAICredential

    try:
        cred = UserAICredential.objects.select_related('active_deployment').get(user=user)
    except UserAICredential.DoesNotExist:
        return None
    deployment = cred.active_deployment
    if deployment is None:
        return None
    if not deployment.enabled:
        return None
    return deployment


def _chain_for(owner_scope, owner_user=None, owner_tenant=None):
    from advisory.models import AIFallbackChain

    filters: dict = {'owner_scope': owner_scope}
    if owner_scope == 'user':
        filters['owner_user'] = owner_user
    elif owner_scope == 'tenant':
        filters['owner_tenant'] = owner_tenant
    return AIFallbackChain.objects.filter(**filters).order_by('id').first()


def resolve_fallback_chain(user, tenant=None):
    """Trả [AIDeployment] đã bật theo thứ tự chain; [] nếu không có/không hợp lệ."""
    from advisory.models import AIDeployment

    chain = None
    if user is not None and getattr(user, 'pk', None):
        chain = _chain_for('user', owner_user=user)
    if chain is None and tenant is not None:
        chain = _chain_for('tenant', owner_tenant=tenant)
    if chain is None:
        chain = _chain_for('system')
    if chain is None:
        return []
    steps = chain.deployment_ids or []
    if not isinstance(steps, list) or not steps:
        return []
    wanted = []
    for raw in steps:
        try:
            wanted.append(int(raw))
        except (TypeError, ValueError):
            continue
    if not wanted:
        return []
    found = {d.pk: d for d in AIDeployment.objects.filter(pk__in=wanted, enabled=True)}
    return [found[pk] for pk in wanted if pk in found]


def pick_deployment(user, tenant=None) -> Optional[object]:
    """Deployment hiệu lực: active đang bật > đầu chain > None (hành vi cũ)."""
    active = pick_active_deployment(user)
    if active is not None:
        return active
    chain = resolve_fallback_chain(user, tenant)
    return chain[0] if chain else None

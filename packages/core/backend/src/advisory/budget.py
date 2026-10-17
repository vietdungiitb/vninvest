"""R2.8 - hieu luc han muc AI: 4 tang x 3 chieu, soft_ratio / hard 100%.

Mot noi duy nhat quyet dinh "co cham han muc khong": `resolve_budget`.
`views._advisory_budget_state` uu tien ket qua day, chi fallback ve han vi cu
(token theo `AdvisorySession`) khi khong co dong `AIBudget` nao khop (AC9 -
migration khong backfill, han vi mac dinh giong hom nay).

**"Muc chặt nhat" nghia la gi** (AC1/AC7): kiem tra *moi* dong khop roi lay dong
`pct_used` cao nhat - KHONG phai "tang dau tien trong thu tu". Neu lay theo thu tu
uu tien thi budget theo model se vo hieu hoa han muc user/tenant: doi model la
ne tranh (AC7).
Tiet: bang pct, uu tien **scope hep nhat** (model > user > tenant > system).
"""

from __future__ import annotations

import logging
from datetime import timedelta
from decimal import Decimal

from django.utils import timezone

from advisory.models import AIBudget

logger = logging.getLogger(__name__)

BUDGET_SOURCE_MODEL = 'model'
BUDGET_SOURCE_USER = 'user'
BUDGET_SOURCE_TENANT = 'tenant'
BUDGET_SOURCE_SYSTEM = 'system'

#: Scope rong -> scope hep. Tiet bang pct: thang hep hon thang.
_SOURCE_ORDER = {
    BUDGET_SOURCE_SYSTEM: 0,
    BUDGET_SOURCE_TENANT: 1,
    BUDGET_SOURCE_USER: 2,
    BUDGET_SOURCE_MODEL: 3,
}


def _empty_state() -> dict:
    return {
        'matched': False,
        'dimension': None,
        'used': 0,
        'limit': 0,
        'pct': 0.0,
        'source': None,
        'budget_id': None,
        'soft_ratio': 0.8,
        'soft_warning': False,
        'hard_exceeded': False,
        'period': None,
    }


def period_start(period: str, now=None):
    """Dau chu ky (theo gio dia phuong) cho daily / weekly / monthly."""
    from datetime import datetime

    now = now or timezone.now()
    local_now = timezone.localtime(now)
    day = local_now.date()
    if period == AIBudget.PeriodChoices.WEEKLY:
        start = day - timedelta(days=day.weekday())
    elif period == AIBudget.PeriodChoices.MONTHLY:
        start = day.replace(day=1)
    else:
        start = day
    return timezone.make_aware(
        datetime.combine(start, datetime.min.time()), timezone.get_current_timezone(),
    )


def _scope_source(row: AIBudget) -> str:
    if row.model:
        return BUDGET_SOURCE_MODEL
    if row.user_id:
        return BUDGET_SOURCE_USER
    if row.tenant_id:
        return BUDGET_SOURCE_TENANT
    return BUDGET_SOURCE_SYSTEM


def _tenant_user_ids(tenant) -> 'set':
    """User thuoc tenant = owner + TenantMember.

    `AIUsageRecord` khong co FK tenant (R0.7 da tu choi doan tenant thanh toan)
    nen chi so cua tang tenant = hop cac user nay. User thuoc nhieu tenant bi
    tinh o moi tang => thieu nghiem (gioi han hon), khong bao gio lo.
    """
    user_ids = set()
    if tenant is None:
        return user_ids
    owner_id = getattr(tenant, 'owner_user_id', None)
    if owner_id:
        user_ids.add(owner_id)
    from identity_access.models import TenantMember

    user_ids.update(
        TenantMember.objects.filter(tenant=tenant).values_list('user_id', flat=True)
    )
    return user_ids


def _usage_totals(user, tenant, model: str, provider: str, period: str, now=None) -> dict:
    """Tong theo chieu trong chu ky: {'tokens', 'cost', 'requests'}."""
    """Tong theo chieu trong chu ky. Tra (tokens, cost, requests)."""
    from ai_analytics.models import AIUsageRecord
    from django.db.models import Sum

    qs = AIUsageRecord.objects.filter(created_at__gte=period_start(period, now))
    if user is not None:
        user_ids = [user.pk]
    elif tenant is not None:
        user_ids = sorted(_tenant_user_ids(tenant))
        if not user_ids:
            return {'tokens': 0, 'cost': Decimal('0'), 'requests': 0}
    else:
        user_ids = None
    if user_ids is not None:
        qs = qs.filter(user_id__in=user_ids)
    if model:
        qs = qs.filter(model__iexact=model)
    if provider:
        qs = qs.filter(provider__iexact=provider)

    agg = qs.aggregate(
        tokens_in=Sum('tokens_in'), tokens_out=Sum('tokens_out'), cost=Sum('cost'),
    )
    tokens = int(agg['tokens_in'] or 0) + int(agg['tokens_out'] or 0)
    return {'tokens': tokens, 'cost': Decimal(agg['cost'] or 0), 'requests': qs.count()}


def _dimension_value(dimension: str, usage: dict):
    return {
        AIBudget.DimensionChoices.TOKENS: usage['tokens'],
        AIBudget.DimensionChoices.COST: usage['cost'],
        AIBudget.DimensionChoices.REQUESTS: usage['requests'],
    }[dimension]


def resolve_budget(
    *, user=None, tenant=None, model: str = '', provider: str = '', now=None,
) -> dict:
    """Tra ve trang thai han muc hieu luc.

    `matched=False` => khong co dong `AIBudget` nao khop: goi nen giu han vi cu.
    """
    model = (model or '').strip()
    provider = (provider or '').strip()

    rows = list(AIBudget.objects.filter(is_active=True))
    candidates = []
    for row in rows:
        # Dong ghep model/provider khac => KHONG ap dung (ke ca khi chua biet
        # model cua len goi: khong doan, chi dung tang cha).
        if row.model and row.model.lower() != model.lower():
            continue
        if row.provider and row.provider.lower() != provider.lower():
            continue
        if row.user_id and (user is None or row.user_id != user.pk):
            continue
        if row.tenant_id and (tenant is None or row.tenant_id != tenant.pk):
            continue
        # AC8: chi so `cost` cua provider han muc luon 0 nen ngan sach cost
        # khong bao gio binding - nhung van giu lai ứng viên de UI hien tang.
        candidates.append(row)
    if not candidates:
        return _empty_state()

    best = None
    best_key = None
    for row in candidates:
        usage = _usage_totals(user, tenant, model, provider, row.period, now)
        used = _dimension_value(row.dimension, usage)
        limit = Decimal(row.limit_value or 0)
        pct = float(used) / float(limit) * 100 if limit > 0 else 100.0
        source = _scope_source(row)
        key = (pct, _SOURCE_ORDER[source])
        if best_key is None or key > best_key:
            best_key, best = key, (row, used, limit, pct, source)

    row, used, limit, pct, source = best
    if isinstance(used, Decimal):
        used_out, limit_out = used, limit
    else:
        used_out, limit_out = used, limit
    soft_ratio = Decimal(row.soft_ratio if row.soft_ratio is not None else Decimal('0.8'))
    soft_threshold = limit * soft_ratio
    return {
        'matched': True,
        'dimension': row.dimension,
        'used': used_out,
        'limit': limit_out,
        'pct': round(pct, 1),
        'source': source,
        'budget_id': row.pk,
        'soft_ratio': float(soft_ratio),
        'period': row.period,
        'soft_warning': used >= soft_threshold and used < limit,
        'hard_exceeded': used >= limit,
    }
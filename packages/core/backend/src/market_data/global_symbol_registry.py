from __future__ import annotations

from datetime import timedelta
from typing import Any

from django.conf import settings
from django.utils import timezone

from .models import GlobalSymbolCoverage, GlobalSymbolDemandSource, GlobalSymbolRegistry

HOT_SOURCE_TYPES = frozenset({
    GlobalSymbolDemandSource.SourceTypeChoices.WATCHLIST,
    GlobalSymbolDemandSource.SourceTypeChoices.TRACKED_SYMBOL,
    GlobalSymbolDemandSource.SourceTypeChoices.HOLDING,
    GlobalSymbolDemandSource.SourceTypeChoices.ALERT,
})
WARM_SOURCE_TYPES = frozenset({
    GlobalSymbolDemandSource.SourceTypeChoices.ADMIN_GROUP,
    GlobalSymbolDemandSource.SourceTypeChoices.SYSTEM_DEFAULT,
})
FRESHNESS_RANK = {
    GlobalSymbolCoverage.FreshnessChoices.UNKNOWN: 0,
    GlobalSymbolCoverage.FreshnessChoices.FRESH: 1,
    GlobalSymbolCoverage.FreshnessChoices.WARM: 2,
    GlobalSymbolCoverage.FreshnessChoices.STALE: 3,
    GlobalSymbolCoverage.FreshnessChoices.MISSING: 4,
    GlobalSymbolCoverage.FreshnessChoices.ERROR: 5,
}
SYSTEM_DEFAULT_GROUP_ID_ALIASES = {
    'top100': 'vn100',
}


def normalize_symbol(raw_symbol: Any) -> str:
    symbol = str(raw_symbol or '').upper().strip()
    if not symbol:
        raise ValueError('Thiếu mã chứng khoán.')
    return symbol


def build_watchlist_source_ref(watchlist_id: Any) -> str:
    return f'watchlist:{watchlist_id}'


def build_tracked_symbol_source_ref(tracked_symbol_id: Any) -> str:
    return f'tracked_symbol:{tracked_symbol_id}'


def build_price_alert_source_ref(price_alert_id: Any) -> str:
    return f'price_alert:{price_alert_id}'


def build_holding_source_ref(portfolio_id: Any) -> str:
    return f'portfolio:{portfolio_id}'


def build_system_default_source_ref(group_id: Any) -> str:
    normalized_group_id = str(group_id or '').strip().lower()
    normalized_group_id = SYSTEM_DEFAULT_GROUP_ID_ALIASES.get(normalized_group_id, normalized_group_id)
    return f'system_default:{normalized_group_id}'


def _build_raw_system_default_source_ref(group_id: Any) -> str:
    return f'system_default:{str(group_id or "").strip().lower()}'


def build_admin_group_source_ref(group_name: Any) -> str:
    normalized_group_name = str(group_name or '').strip().lower().replace(' ', '_')
    return f'admin_group:{normalized_group_name}'


def _get_decay_days() -> int:
    configured = getattr(settings, 'GLOBAL_SYMBOL_MATRIX_DECAY_DAYS', 7)
    try:
        return max(int(configured), 1)
    except (TypeError, ValueError):
        return 7


def _coerce_metadata(metadata: Any) -> dict[str, Any]:
    if isinstance(metadata, dict):
        return metadata
    return {}


def _resolve_weight(source_type: str, explicit_weight: float | None = None) -> float:
    if explicit_weight is not None:
        return float(explicit_weight)
    defaults = {
        GlobalSymbolDemandSource.SourceTypeChoices.HOLDING: 2.0,
        GlobalSymbolDemandSource.SourceTypeChoices.ALERT: 1.5,
        GlobalSymbolDemandSource.SourceTypeChoices.TRACKED_SYMBOL: 1.25,
        GlobalSymbolDemandSource.SourceTypeChoices.WATCHLIST: 1.0,
        GlobalSymbolDemandSource.SourceTypeChoices.ADMIN_GROUP: 0.75,
        GlobalSymbolDemandSource.SourceTypeChoices.SYSTEM_DEFAULT: 0.5,
    }
    return float(defaults.get(source_type, 1.0))


def _summarize_coverage(registry: GlobalSymbolRegistry) -> dict[str, Any]:
    coverage_rows = list(
        registry.coverage_rows.values(
            'freshness_state',
            'last_verified_at',
            'latest_available_at',
            'latest_complete_trade_date',
        )
    )
    if not coverage_rows:
        return {
            'freshness_state_summary': GlobalSymbolCoverage.FreshnessChoices.UNKNOWN,
            'coverage_state_summary': 'unknown',
            'last_hydrated_at': registry.last_hydrated_at,
            'latest_trade_date': registry.latest_trade_date,
        }

    worst_freshness = max(
        (row['freshness_state'] or GlobalSymbolCoverage.FreshnessChoices.UNKNOWN for row in coverage_rows),
        key=lambda value: FRESHNESS_RANK.get(value, -1),
    )
    if worst_freshness in {GlobalSymbolCoverage.FreshnessChoices.ERROR, GlobalSymbolCoverage.FreshnessChoices.MISSING}:
        coverage_state_summary = 'gap'
    elif worst_freshness == GlobalSymbolCoverage.FreshnessChoices.STALE:
        coverage_state_summary = 'stale'
    elif worst_freshness == GlobalSymbolCoverage.FreshnessChoices.WARM:
        coverage_state_summary = 'warming'
    else:
        coverage_state_summary = 'ok'

    last_hydrated_at = max(
        (
            row['last_verified_at']
            or row['latest_available_at']
            for row in coverage_rows
            if row['last_verified_at'] is not None or row['latest_available_at'] is not None
        ),
        default=registry.last_hydrated_at,
    )
    latest_trade_date = max(
        (row['latest_complete_trade_date'] for row in coverage_rows if row['latest_complete_trade_date'] is not None),
        default=registry.latest_trade_date,
    )
    return {
        'freshness_state_summary': worst_freshness,
        'coverage_state_summary': coverage_state_summary,
        'last_hydrated_at': last_hydrated_at,
        'latest_trade_date': latest_trade_date,
    }


def _resolve_priority_tier(active_source_types: set[str], demand_source_count: int) -> str:
    if demand_source_count <= 0:
        return GlobalSymbolRegistry.PriorityTierChoices.RECOVERY
    if active_source_types & HOT_SOURCE_TYPES:
        return GlobalSymbolRegistry.PriorityTierChoices.HOT
    if active_source_types & WARM_SOURCE_TYPES:
        return GlobalSymbolRegistry.PriorityTierChoices.WARM
    return GlobalSymbolRegistry.PriorityTierChoices.COLD


def refresh_global_symbol_registry(symbol_or_registry: str | GlobalSymbolRegistry) -> GlobalSymbolRegistry:
    registry = symbol_or_registry
    if isinstance(symbol_or_registry, str):
        registry = GlobalSymbolRegistry.objects.get(symbol=normalize_symbol(symbol_or_registry))

    now = timezone.now()
    active_edges = list(
        registry.demand_sources.filter(is_active=True).values('source_type', 'weight')
    )
    active_source_types = {row['source_type'] for row in active_edges}
    demand_source_count = len(active_edges)
    priority_score = round(sum(float(row['weight'] or 0.0) for row in active_edges), 2)

    if demand_source_count > 0:
        decay_after_at = None
        is_active = True
    else:
        decay_after_at = registry.decay_after_at or (now + timedelta(days=_get_decay_days()))
        is_active = decay_after_at > now

    coverage_summary = _summarize_coverage(registry)
    update_fields = []
    next_values = {
        'is_active': is_active,
        'current_priority_tier': _resolve_priority_tier(active_source_types, demand_source_count),
        'priority_score': priority_score,
        'demand_source_count': demand_source_count,
        'decay_after_at': decay_after_at,
        'freshness_state_summary': coverage_summary['freshness_state_summary'],
        'coverage_state_summary': coverage_summary['coverage_state_summary'],
        'last_hydrated_at': coverage_summary['last_hydrated_at'],
        'latest_trade_date': coverage_summary['latest_trade_date'],
    }

    for field_name, next_value in next_values.items():
        if getattr(registry, field_name) != next_value:
            setattr(registry, field_name, next_value)
            update_fields.append(field_name)

    if update_fields:
        if 'updated_at' not in update_fields:
            update_fields.append('updated_at')
        registry.save(update_fields=update_fields)
    return registry


def upsert_global_symbol_demand(
    *,
    symbol: str,
    source_type: str,
    source_ref: str,
    user=None,
    tenant=None,
    metadata: dict[str, Any] | None = None,
    weight: float | None = None,
) -> tuple[GlobalSymbolRegistry, GlobalSymbolDemandSource]:
    normalized_symbol = normalize_symbol(symbol)
    now = timezone.now()
    registry, _ = GlobalSymbolRegistry.objects.get_or_create(
        symbol=normalized_symbol,
        defaults={
            'is_active': True,
            'current_priority_tier': GlobalSymbolRegistry.PriorityTierChoices.COLD,
            'last_demand_at': now,
        },
    )
    edge, _ = GlobalSymbolDemandSource.objects.get_or_create(
        registry=registry,
        source_type=source_type,
        source_ref=source_ref,
        defaults={
            'tenant': tenant,
            'user': user,
            'is_active': True,
            'activated_at': now,
            'deactivated_at': None,
            'weight': _resolve_weight(source_type, weight),
            'metadata': _coerce_metadata(metadata),
        },
    )

    edge_update_fields = []
    if edge.user_id != getattr(user, 'pk', None):
        edge.user = user
        edge_update_fields.append('user')
    if edge.tenant_id != getattr(tenant, 'pk', None):
        edge.tenant = tenant
        edge_update_fields.append('tenant')
    resolved_weight = _resolve_weight(source_type, weight)
    if float(edge.weight or 0.0) != resolved_weight:
        edge.weight = resolved_weight
        edge_update_fields.append('weight')
    resolved_metadata = _coerce_metadata(metadata)
    if edge.metadata != resolved_metadata:
        edge.metadata = resolved_metadata
        edge_update_fields.append('metadata')
    if not edge.is_active:
        edge.is_active = True
        edge.activated_at = now
        edge.deactivated_at = None
        edge_update_fields.extend(['is_active', 'activated_at', 'deactivated_at'])
    if edge_update_fields:
        if 'updated_at' not in edge_update_fields:
            edge_update_fields.append('updated_at')
        edge.save(update_fields=edge_update_fields)

    if registry.last_demand_at != now:
        registry.last_demand_at = now
        registry.save(update_fields=['last_demand_at', 'updated_at'])
    return refresh_global_symbol_registry(registry), edge


def deactivate_global_symbol_demand(
    *,
    symbol: str,
    source_type: str,
    source_ref: str,
    metadata: dict[str, Any] | None = None,
) -> tuple[GlobalSymbolRegistry | None, GlobalSymbolDemandSource | None]:
    normalized_symbol = normalize_symbol(symbol)
    registry = GlobalSymbolRegistry.objects.filter(symbol=normalized_symbol).first()
    if registry is None:
        return None, None

    edge = registry.demand_sources.filter(source_type=source_type, source_ref=source_ref).first()
    if edge is None:
        return refresh_global_symbol_registry(registry), None

    update_fields = []
    if edge.is_active:
        edge.is_active = False
        edge.deactivated_at = timezone.now()
        update_fields.extend(['is_active', 'deactivated_at'])
    resolved_metadata = _coerce_metadata(metadata)
    if resolved_metadata and edge.metadata != resolved_metadata:
        edge.metadata = resolved_metadata
        update_fields.append('metadata')
    if update_fields:
        if 'updated_at' not in update_fields:
            update_fields.append('updated_at')
        edge.save(update_fields=update_fields)
    return refresh_global_symbol_registry(registry), edge


def sync_global_source_symbol_set(
    *,
    source_type: str,
    source_ref: str,
    symbols: list[str] | tuple[str, ...] | set[str],
    metadata_by_symbol: dict[str, dict[str, Any]] | None = None,
    default_metadata: dict[str, Any] | None = None,
    weight: float | None = None,
) -> list[GlobalSymbolRegistry]:
    normalized_symbols = []
    seen_symbols = set()
    for raw_symbol in symbols:
        normalized_symbol = normalize_symbol(raw_symbol)
        if normalized_symbol in seen_symbols:
            continue
        seen_symbols.add(normalized_symbol)
        normalized_symbols.append(normalized_symbol)

    metadata_lookup = {
        normalize_symbol(symbol): _coerce_metadata(metadata)
        for symbol, metadata in (metadata_by_symbol or {}).items()
    }
    default_metadata = _coerce_metadata(default_metadata)
    refreshed_registries: list[GlobalSymbolRegistry] = []

    existing_edges = list(
        GlobalSymbolDemandSource.objects.select_related('registry')
        .filter(source_type=source_type, source_ref=source_ref)
    )
    existing_edge_by_symbol = {
        edge.registry.symbol: edge
        for edge in existing_edges
    }

    for symbol in normalized_symbols:
        metadata = {**default_metadata, **metadata_lookup.get(symbol, {})}
        registry, _ = upsert_global_symbol_demand(
            symbol=symbol,
            source_type=source_type,
            source_ref=source_ref,
            user=None,
            tenant=None,
            metadata=metadata,
            weight=weight,
        )
        refreshed_registries.append(registry)

    for symbol, edge in existing_edge_by_symbol.items():
        if symbol in seen_symbols:
            continue
        registry, _ = deactivate_global_symbol_demand(
            symbol=symbol,
            source_type=source_type,
            source_ref=source_ref,
        )
        if registry is not None:
            refreshed_registries.append(registry)

    deduped_registries = []
    seen_registry_symbols = set()
    for registry in refreshed_registries:
        if registry.symbol in seen_registry_symbols:
            continue
        seen_registry_symbols.add(registry.symbol)
        deduped_registries.append(registry)
    return deduped_registries


def sync_system_default_symbol_group(group_id: Any, symbols: list[str] | tuple[str, ...] | set[str]) -> list[GlobalSymbolRegistry]:
    normalized_group_id = str(group_id or '').strip().lower()
    canonical_group_id = SYSTEM_DEFAULT_GROUP_ID_ALIASES.get(normalized_group_id, normalized_group_id)
    refreshed_registries = sync_global_source_symbol_set(
        source_type=GlobalSymbolDemandSource.SourceTypeChoices.SYSTEM_DEFAULT,
        source_ref=build_system_default_source_ref(canonical_group_id),
        symbols=symbols,
        default_metadata={'group_id': canonical_group_id},
    )
    if canonical_group_id != normalized_group_id:
        return refreshed_registries

    legacy_alias_refs = [
        _build_raw_system_default_source_ref(alias_group_id)
        for alias_group_id, alias_target in SYSTEM_DEFAULT_GROUP_ID_ALIASES.items()
        if alias_target == canonical_group_id
    ]
    seen_registry_symbols = {registry.symbol for registry in refreshed_registries}
    for legacy_source_ref in legacy_alias_refs:
        legacy_edges = list(
            GlobalSymbolDemandSource.objects.select_related('registry').filter(
                source_type=GlobalSymbolDemandSource.SourceTypeChoices.SYSTEM_DEFAULT,
                source_ref=legacy_source_ref,
                is_active=True,
            )
        )
        for legacy_edge in legacy_edges:
            registry, _ = deactivate_global_symbol_demand(
                symbol=legacy_edge.registry.symbol,
                source_type=GlobalSymbolDemandSource.SourceTypeChoices.SYSTEM_DEFAULT,
                source_ref=legacy_source_ref,
            )
            if registry is not None and registry.symbol not in seen_registry_symbols:
                refreshed_registries.append(registry)
                seen_registry_symbols.add(registry.symbol)
    return refreshed_registries


def sync_admin_group_symbol_set(
    group_name: Any,
    symbols: list[str] | tuple[str, ...] | set[str],
    *,
    group_type: str | None = None,
    description: str | None = None,
) -> list[GlobalSymbolRegistry]:
    normalized_group_name = str(group_name or '').strip()
    metadata = {
        'group_name': normalized_group_name,
        'group_type': str(group_type or '').strip().upper(),
        'description': str(description or '').strip(),
    }
    return sync_global_source_symbol_set(
        source_type=GlobalSymbolDemandSource.SourceTypeChoices.ADMIN_GROUP,
        source_ref=build_admin_group_source_ref(normalized_group_name),
        symbols=symbols,
        default_metadata=metadata,
    )


def sync_watchlist_item_demand(item, *, is_active: bool = True) -> tuple[GlobalSymbolRegistry | None, GlobalSymbolDemandSource | None]:
    if is_active:
        return upsert_global_symbol_demand(
            symbol=item.symbol,
            source_type=GlobalSymbolDemandSource.SourceTypeChoices.WATCHLIST,
            source_ref=build_watchlist_source_ref(item.watchlist_id),
            user=getattr(item.watchlist, 'user', None),
            tenant=getattr(item.watchlist, 'tenant', None),
            metadata={
                'watchlist_id': item.watchlist_id,
                'watchlist_name': getattr(item.watchlist, 'name', ''),
                'item_id': item.pk,
            },
        )
    return deactivate_global_symbol_demand(
        symbol=item.symbol,
        source_type=GlobalSymbolDemandSource.SourceTypeChoices.WATCHLIST,
        source_ref=build_watchlist_source_ref(item.watchlist_id),
        metadata={'watchlist_id': item.watchlist_id, 'item_id': item.pk},
    )


def sync_tracked_symbol_demand(tracked_symbol, *, is_active: bool | None = None) -> tuple[GlobalSymbolRegistry | None, GlobalSymbolDemandSource | None]:
    resolved_active = tracked_symbol.is_active if is_active is None else bool(is_active)
    if resolved_active:
        return upsert_global_symbol_demand(
            symbol=tracked_symbol.symbol,
            source_type=GlobalSymbolDemandSource.SourceTypeChoices.TRACKED_SYMBOL,
            source_ref=build_tracked_symbol_source_ref(tracked_symbol.pk),
            user=getattr(tracked_symbol, 'user', None),
            tenant=getattr(tracked_symbol, 'tenant', None),
            metadata={
                'tracked_symbol_id': tracked_symbol.pk,
                'source_watchlist_id': tracked_symbol.source_watchlist_id,
            },
        )
    return deactivate_global_symbol_demand(
        symbol=tracked_symbol.symbol,
        source_type=GlobalSymbolDemandSource.SourceTypeChoices.TRACKED_SYMBOL,
        source_ref=build_tracked_symbol_source_ref(tracked_symbol.pk),
        metadata={'tracked_symbol_id': tracked_symbol.pk},
    )


def sync_price_alert_demand(alert, *, is_active: bool | None = None) -> tuple[GlobalSymbolRegistry | None, GlobalSymbolDemandSource | None]:
    resolved_active = bool(alert.is_enabled) and alert.status != alert.AlertStatus.DISABLED if is_active is None else bool(is_active)
    if resolved_active:
        return upsert_global_symbol_demand(
            symbol=alert.symbol,
            source_type=GlobalSymbolDemandSource.SourceTypeChoices.ALERT,
            source_ref=build_price_alert_source_ref(alert.pk),
            user=getattr(alert, 'user', None),
            tenant=getattr(alert, 'tenant', None),
            metadata={
                'price_alert_id': alert.pk,
                'alert_type': alert.alert_type,
                'price_threshold': str(alert.price_threshold),
            },
        )
    return deactivate_global_symbol_demand(
        symbol=alert.symbol,
        source_type=GlobalSymbolDemandSource.SourceTypeChoices.ALERT,
        source_ref=build_price_alert_source_ref(alert.pk),
        metadata={'price_alert_id': alert.pk},
    )


def sync_holding_demand_for_portfolio_symbol(portfolio, symbol: str) -> tuple[GlobalSymbolRegistry | None, GlobalSymbolDemandSource | None]:
    normalized_symbol = normalize_symbol(symbol)
    from user_workspace.models import Transaction

    transactions = list(
        Transaction.objects.filter(portfolio=portfolio, symbol__iexact=normalized_symbol)
        .values('transaction_type', 'quantity')
    )
    net_quantity = 0
    for row in transactions:
        transaction_type = str(row['transaction_type'] or '').upper().strip()
        quantity = int(row['quantity'] or 0)
        if transaction_type == Transaction.TransactionType.BUY:
            net_quantity += quantity
        elif transaction_type == Transaction.TransactionType.SELL:
            net_quantity -= quantity

    if net_quantity > 0:
        return upsert_global_symbol_demand(
            symbol=normalized_symbol,
            source_type=GlobalSymbolDemandSource.SourceTypeChoices.HOLDING,
            source_ref=build_holding_source_ref(portfolio.pk),
            user=getattr(portfolio, 'user', None),
            tenant=getattr(portfolio, 'tenant', None),
            metadata={
                'portfolio_id': portfolio.pk,
                'portfolio_name': getattr(portfolio, 'name', ''),
                'net_quantity': net_quantity,
            },
        )
    return deactivate_global_symbol_demand(
        symbol=normalized_symbol,
        source_type=GlobalSymbolDemandSource.SourceTypeChoices.HOLDING,
        source_ref=build_holding_source_ref(portfolio.pk),
        metadata={'portfolio_id': portfolio.pk, 'net_quantity': net_quantity},
    )
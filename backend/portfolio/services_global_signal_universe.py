from __future__ import annotations

import os
import sys
from django.db.models import Count
from django.utils import timezone

from .global_signal_policy_helpers import GLOBAL_SIGNAL_UNIVERSE_POLICY_KEY, get_global_signal_universe_policy

# Setup path for packages/core imports
_core_backend_src = os.path.normpath(
    os.path.join(os.path.dirname(__file__), '../../packages/core/backend/src')
)
if os.path.exists(_core_backend_src) and _core_backend_src not in sys.path:
    sys.path.insert(0, _core_backend_src)

# Core models (AUTHORITY)
try:
    from user_workspace.models import PriceAlert, WatchlistItem
except (ImportError, RuntimeError) as e:
    # Models migrated to packages/core - stubs for dev environment
    class PriceAlert:
        pass
    class WatchlistItem:
        pass

# Legacy models (remaining)
from .models import SecuritiesItem, TrackedSymbol, Transaction


def _build_symbol_count_map(queryset, symbol_field: str, count_field: str) -> dict[str, int]:
    payload = {}
    for row in queryset:
        symbol = str(row.get(symbol_field) or '').strip().upper()
        if not symbol:
            continue
        payload[symbol] = int(row.get(count_field) or 0)
    return payload


def _normalized_symbol_set(queryset) -> set[str]:
    return {
        str(symbol).strip().upper()
        for symbol in queryset
        if symbol and str(symbol).strip()
    }


def _compute_heat_score(
    *,
    watchlist_users: int,
    alert_users: int,
    holding_users: int,
    is_system_symbol: bool,
) -> int:
    return (
        5 * max(int(watchlist_users), 0)
        + 3 * max(int(alert_users), 0)
        + 2 * max(int(holding_users), 0)
        + (1 if is_system_symbol else 0)
    )


def _stable_shard_id(symbol: str, shard_count: int) -> int:
    if shard_count <= 1:
        return 0
    total = sum(ord(ch) for ch in str(symbol or '').upper())
    return int(total % shard_count)


class GlobalSignalUniverseResolver:
    SYSTEM_POLICY_KEY = GLOBAL_SIGNAL_UNIVERSE_POLICY_KEY

    @staticmethod
    def _coerce_group_ids(raw_group_ids) -> list[int]:
        group_ids = []
        if not isinstance(raw_group_ids, (list, tuple)):
            return group_ids

        for raw_group_id in raw_group_ids:
            try:
                parsed_id = int(raw_group_id)
            except (TypeError, ValueError):
                continue
            if parsed_id >= 1 and parsed_id not in group_ids:
                group_ids.append(parsed_id)
        return group_ids

    @staticmethod
    def _coerce_symbols(raw_symbols) -> list[str]:
        if not isinstance(raw_symbols, (list, tuple)):
            return []

        symbols = []
        seen = set()
        for raw_symbol in raw_symbols:
            symbol = str(raw_symbol or '').strip().upper()
            if not symbol or symbol in seen:
                continue
            seen.add(symbol)
            symbols.append(symbol)
        return symbols

    @classmethod
    def _normalize_config(cls, config: dict | None = None) -> dict:
        config = config if isinstance(config, dict) else {}
        return {
            'include_tracked_symbols': bool(config.get('include_tracked_symbols', True)),
            'include_watchlist_symbols': bool(config.get('include_watchlist_symbols', True)),
            'include_alert_symbols': bool(config.get('include_alert_symbols', True)),
            'include_portfolio_symbols': bool(config.get('include_portfolio_symbols', True)),
            'include_group_symbols': bool(config.get('include_group_symbols', False)),
            'selected_group_ids': cls._coerce_group_ids(config.get('selected_group_ids', [])),
            'admin_symbols': cls._coerce_symbols(config.get('admin_symbols', [])),
            'force_selected_groups_to_warm_tier': bool(config.get('force_selected_groups_to_warm_tier', True)),
        }

    @classmethod
    def load_system_policy(cls) -> dict:
        return cls._normalize_config(get_global_signal_universe_policy())

    @classmethod
    def from_prefetch_runtime_settings(cls, runtime_settings: dict | None = None) -> dict:
        runtime_settings = runtime_settings if isinstance(runtime_settings, dict) else {}
        return cls._normalize_config(
            {
                'include_group_symbols': runtime_settings.get('include_group_symbols', False),
                'selected_group_ids': runtime_settings.get('intraday_universe_group_ids', []),
                'force_selected_groups_to_warm_tier': runtime_settings.get('intraday_universe_force_warm_tier', True),
            }
        )

    @staticmethod
    def _tier_shards(topology: dict, tier: str) -> int:
        if tier == 'hot':
            return max(int(topology.get('hot_shards', 4)), 1)
        if tier == 'warm':
            return max(int(topology.get('warm_shards', 6)), 1)
        return max(int(topology.get('cold_shards', 6)), 1)

    @classmethod
    def build_snapshot(cls, *, config: dict | None = None, topology: dict | None = None) -> dict:
        merged_config = dict(cls.load_system_policy())
        if isinstance(config, dict):
            merged_config.update(config)
        config = cls._normalize_config(merged_config)
        topology = topology if isinstance(topology, dict) else {}

        tracked_users = {}
        if config['include_tracked_symbols']:
            tracked_users = _build_symbol_count_map(
                TrackedSymbol.objects.values('symbol').annotate(user_count=Count('user', distinct=True)),
                'symbol',
                'user_count',
            )

        watchlist_users = {}
        if config['include_watchlist_symbols']:
            watchlist_users = _build_symbol_count_map(
                WatchlistItem.objects.values('symbol').annotate(user_count=Count('watchlist__user', distinct=True)),
                'symbol',
                'user_count',
            )

        alert_users = {}
        if config['include_alert_symbols']:
            alert_users = _build_symbol_count_map(
                PriceAlert.objects.filter(is_enabled=True).values('symbol').annotate(user_count=Count('user', distinct=True)),
                'symbol',
                'user_count',
            )

        holding_users = {}
        if config['include_portfolio_symbols']:
            holding_users = _build_symbol_count_map(
                Transaction.objects.values('symbol').annotate(user_count=Count('sub_account__portfolio__user', distinct=True)),
                'symbol',
                'user_count',
            )

        all_group_symbols = set()
        if config['include_group_symbols']:
            all_group_symbols = _normalized_symbol_set(
                SecuritiesItem.objects.values_list('symbol', flat=True).distinct()
            )

        selected_group_symbols = set()
        if config['selected_group_ids']:
            selected_group_symbols = _normalized_symbol_set(
                SecuritiesItem.objects.filter(group_id__in=config['selected_group_ids']).values_list('symbol', flat=True).distinct()
            )

        admin_direct_symbols = set(config['admin_symbols'])
        admin_curated_symbols = set(all_group_symbols) | set(selected_group_symbols) | set(admin_direct_symbols)

        all_symbols = set(admin_curated_symbols)
        all_symbols.update(tracked_users)
        all_symbols.update(watchlist_users)
        all_symbols.update(alert_users)
        all_symbols.update(holding_users)

        generated_at = timezone.now().isoformat()
        universe_rows = []
        for symbol in all_symbols:
            watchlist_count = int(watchlist_users.get(symbol, 0))
            alert_count = int(alert_users.get(symbol, 0))
            holding_count = int(holding_users.get(symbol, 0))
            tracked_count = int(tracked_users.get(symbol, 0))
            is_system_symbol = symbol in admin_curated_symbols
            is_intraday_universe_symbol = symbol in selected_group_symbols

            heat_score = _compute_heat_score(
                watchlist_users=watchlist_count,
                alert_users=alert_count,
                holding_users=holding_count,
                is_system_symbol=is_system_symbol,
            )
            universe_rows.append(
                {
                    'symbol': symbol,
                    'subscriber_count': max(watchlist_count, tracked_count),
                    'tracked_by_watchlist_users': watchlist_count,
                    'tracked_by_alert_rules': alert_count,
                    'tracked_by_portfolio_holders': holding_count,
                    'is_system_symbol': is_system_symbol,
                    'is_intraday_universe_symbol': is_intraday_universe_symbol,
                    'heat_score': heat_score,
                }
            )

        universe_rows.sort(key=lambda item: (-int(item.get('heat_score', 0)), item.get('symbol', '')))

        symbol_limit = max(int(topology.get('universe_symbol_limit', 1800)), 0)
        if symbol_limit:
            universe_rows = universe_rows[:symbol_limit]

        hot_limit = max(int(topology.get('hot_limit', 200)), 0)
        warm_limit = max(int(topology.get('warm_limit', 600)), 0)
        for idx, row in enumerate(universe_rows):
            if idx < hot_limit:
                tier = 'hot'
            elif idx < hot_limit + warm_limit:
                tier = 'warm'
            else:
                tier = 'cold'

            if config['force_selected_groups_to_warm_tier'] and bool(row.get('is_intraday_universe_symbol')) and tier == 'cold':
                tier = 'warm'

            row['tier'] = tier
            row['shard_id'] = _stable_shard_id(row.get('symbol'), cls._tier_shards(topology, tier))
            row['computed_at'] = generated_at

        effective_symbols = [str(row.get('symbol') or '').strip().upper() for row in universe_rows if str(row.get('symbol') or '').strip()]
        source_counts = {
            'tracked_symbols': len(tracked_users),
            'watchlist_items': len(watchlist_users),
            'price_alerts': len(alert_users),
            'portfolio_transactions': len(holding_users),
            'market_group_items': len(all_group_symbols),
            'intraday_universe_group_ids': len(config['selected_group_ids']),
            'intraday_universe_group_items': len(selected_group_symbols),
            'admin_symbols': len(admin_direct_symbols),
        }

        return {
            'generated_at': generated_at,
            'effective_symbols': effective_symbols,
            'counts': {
                'admin_curated': len(admin_curated_symbols),
                'tracked': len(tracked_users),
                'watchlist': len(watchlist_users),
                'alerts': len(alert_users),
                'holdings': len(holding_users),
                'effective': len(effective_symbols),
            },
            'source_counts': source_counts,
            'sources': {
                'admin_groups': list(config['selected_group_ids']),
                'admin_symbols': list(config['admin_symbols']),
                'include_group_symbols': bool(config['include_group_symbols']),
                'include_tracked': bool(config['include_tracked_symbols']),
                'include_watchlists': bool(config['include_watchlist_symbols']),
                'include_alerts': bool(config['include_alert_symbols']),
                'include_portfolio': bool(config['include_portfolio_symbols']),
            },
            'rows': universe_rows,
        }

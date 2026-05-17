from __future__ import annotations

from datetime import date, datetime, time, timedelta
from typing import Any

from django.conf import settings
from django.db import transaction
from django.db.models import Max, Min
from django.utils import timezone

from market_serving.models import SessionFacts, SymbolSnapshot

from .global_symbol_registry import normalize_symbol, refresh_global_symbol_registry
from .models import DailyPrice, GlobalSymbolCoverage, GlobalSymbolRegistry, IntradayBar, IntradayTick

DATASET_ORDER = (
    GlobalSymbolCoverage.DatasetChoices.DAILY_PRICES,
    GlobalSymbolCoverage.DatasetChoices.PRICE_BOARD_SNAPSHOT,
    GlobalSymbolCoverage.DatasetChoices.INTRADAY_BARS,
    GlobalSymbolCoverage.DatasetChoices.INTRADAY_TICKS,
    GlobalSymbolCoverage.DatasetChoices.SESSION_FACTS,
)
FRESHNESS_ORDER = (
    GlobalSymbolCoverage.FreshnessChoices.FRESH,
    GlobalSymbolCoverage.FreshnessChoices.WARM,
    GlobalSymbolCoverage.FreshnessChoices.STALE,
    GlobalSymbolCoverage.FreshnessChoices.MISSING,
    GlobalSymbolCoverage.FreshnessChoices.ERROR,
)
TOP_GAP_ORDER = {
    GlobalSymbolCoverage.FreshnessChoices.ERROR: 0,
    GlobalSymbolCoverage.FreshnessChoices.MISSING: 1,
    GlobalSymbolCoverage.FreshnessChoices.STALE: 2,
    GlobalSymbolCoverage.FreshnessChoices.WARM: 3,
    GlobalSymbolCoverage.FreshnessChoices.FRESH: 4,
    GlobalSymbolCoverage.FreshnessChoices.UNKNOWN: 5,
}
PLANNER_SUPPORTED_MODES = frozenset({'missing_only'})
PLANNER_PROVIDER_CHAIN_BY_DATASET = {
    GlobalSymbolCoverage.DatasetChoices.DAILY_PRICES: ['vnbroker'],
    GlobalSymbolCoverage.DatasetChoices.PRICE_BOARD_SNAPSHOT: ['vnbroker'],
    GlobalSymbolCoverage.DatasetChoices.INTRADAY_BARS: ['vnbroker'],
    GlobalSymbolCoverage.DatasetChoices.INTRADAY_TICKS: ['vnbroker'],
    GlobalSymbolCoverage.DatasetChoices.SESSION_FACTS: ['vnbroker', 'session_facts_materializer'],
}
_SNAPSHOT_FRESH_WINDOW = timedelta(minutes=15)
_SNAPSHOT_WARM_WINDOW = timedelta(hours=1)
_INTRADAY_FRESH_WINDOW = timedelta(hours=1)
_INTRADAY_WARM_WINDOW = timedelta(hours=6)
_SESSION_FACTS_FRESH_WINDOW = timedelta(minutes=30)
_SESSION_FACTS_WARM_WINDOW = timedelta(hours=2)
_DAILY_PRICE_FRESH_DAYS = 1
_DAILY_PRICE_WARM_DAYS = 3
_NEXT_ACTION_BY_DATASET = {
    GlobalSymbolCoverage.DatasetChoices.DAILY_PRICES: {
        'missing': 'hydrate_daily_prices',
        'warm': 'refresh_daily_prices',
        'stale': 'refresh_daily_prices',
        'error': 'investigate_daily_prices',
    },
    GlobalSymbolCoverage.DatasetChoices.PRICE_BOARD_SNAPSHOT: {
        'missing': 'hydrate_price_board_snapshot',
        'warm': 'refresh_price_board_snapshot',
        'stale': 'refresh_price_board_snapshot',
        'error': 'investigate_price_board_snapshot',
    },
    GlobalSymbolCoverage.DatasetChoices.INTRADAY_BARS: {
        'missing': 'hydrate_intraday_bars',
        'warm': 'refresh_intraday_bars',
        'stale': 'refresh_intraday_bars',
        'error': 'investigate_intraday_bars',
    },
    GlobalSymbolCoverage.DatasetChoices.INTRADAY_TICKS: {
        'missing': 'hydrate_intraday_ticks',
        'warm': 'refresh_intraday_ticks',
        'stale': 'refresh_intraday_ticks',
        'error': 'investigate_intraday_ticks',
    },
    GlobalSymbolCoverage.DatasetChoices.SESSION_FACTS: {
        'missing': 'materialize_session_facts',
        'warm': 'refresh_session_facts',
        'stale': 'refresh_session_facts',
        'error': 'investigate_session_facts',
    },
}


def _resolve_daily_price_bootstrap_days() -> int:
    default_days = getattr(settings, 'GLOBAL_MARKET_DATA_DAILY_BOOTSTRAP_DAYS_DEFAULT', 365)
    min_days = getattr(settings, 'GLOBAL_MARKET_DATA_DAILY_BOOTSTRAP_DAYS_MIN', 1)
    max_days = getattr(settings, 'GLOBAL_MARKET_DATA_DAILY_BOOTSTRAP_DAYS_MAX', 3650)
    configured_days = getattr(
        settings,
        'GLOBAL_MARKET_DATA_DAILY_BOOTSTRAP_DAYS',
        default_days,
    )
    try:
        normalized_days = int(configured_days)
    except (TypeError, ValueError):
        normalized_days = int(default_days)
    return max(min(normalized_days, int(max_days)), int(min_days))


def _resolve_registry(symbol_or_registry: str | GlobalSymbolRegistry) -> GlobalSymbolRegistry:
    if isinstance(symbol_or_registry, GlobalSymbolRegistry):
        return symbol_or_registry
    return GlobalSymbolRegistry.objects.get(symbol=normalize_symbol(symbol_or_registry))


def _trade_date_to_datetime(trade_date: date | None, *, market_close: bool = False) -> datetime | None:
    if trade_date is None:
        return None
    trade_time = time(hour=15) if market_close else time.min
    return timezone.make_aware(datetime.combine(trade_date, trade_time), timezone.get_current_timezone())


def _normalize_dt(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if timezone.is_aware(value):
        return value
    return timezone.make_aware(value, timezone.get_current_timezone())


def _build_missing_ranges(*, latest_trade_date: date | None, reference_trade_date: date, state: str) -> list[dict[str, str]]:
    if state not in {
        GlobalSymbolCoverage.FreshnessChoices.MISSING,
        GlobalSymbolCoverage.FreshnessChoices.STALE,
    }:
        return []
    if latest_trade_date is None:
        return [{'start': reference_trade_date.isoformat(), 'end': reference_trade_date.isoformat()}]
    if latest_trade_date >= reference_trade_date:
        return []
    return [{
        'start': (latest_trade_date + timedelta(days=1)).isoformat(),
        'end': reference_trade_date.isoformat(),
    }]


def _resolve_daily_price_state(latest_trade_date: date | None, reference_trade_date: date) -> str:
    if latest_trade_date is None:
        return GlobalSymbolCoverage.FreshnessChoices.MISSING
    age_days = max((reference_trade_date - latest_trade_date).days, 0)
    if age_days <= _DAILY_PRICE_FRESH_DAYS:
        return GlobalSymbolCoverage.FreshnessChoices.FRESH
    if age_days <= _DAILY_PRICE_WARM_DAYS:
        return GlobalSymbolCoverage.FreshnessChoices.WARM
    return GlobalSymbolCoverage.FreshnessChoices.STALE


def _resolve_intraday_state(latest_available_at: datetime | None, reference_trade_date: date, as_of: datetime) -> str:
    if latest_available_at is None:
        return GlobalSymbolCoverage.FreshnessChoices.MISSING
    latest_available_at = _normalize_dt(latest_available_at)
    if latest_available_at is None:
        return GlobalSymbolCoverage.FreshnessChoices.MISSING
    age_days = (reference_trade_date - latest_available_at.date()).days
    if age_days > 0:
        return GlobalSymbolCoverage.FreshnessChoices.WARM if age_days == 1 else GlobalSymbolCoverage.FreshnessChoices.STALE
    age = max(as_of - latest_available_at, timedelta())
    if age <= _INTRADAY_FRESH_WINDOW:
        return GlobalSymbolCoverage.FreshnessChoices.FRESH
    if age <= _INTRADAY_WARM_WINDOW:
        return GlobalSymbolCoverage.FreshnessChoices.WARM
    return GlobalSymbolCoverage.FreshnessChoices.STALE


def _resolve_snapshot_state(row: SymbolSnapshot | None, reference_trade_date: date, as_of: datetime) -> str:
    if row is None:
        return GlobalSymbolCoverage.FreshnessChoices.MISSING
    if row.session_date < reference_trade_date:
        return GlobalSymbolCoverage.FreshnessChoices.STALE
    if row.stale:
        return GlobalSymbolCoverage.FreshnessChoices.STALE
    fetched_at = _normalize_dt(row.fetched_at)
    if fetched_at is None:
        return GlobalSymbolCoverage.FreshnessChoices.UNKNOWN
    age = max(as_of - fetched_at, timedelta())
    if age <= _SNAPSHOT_FRESH_WINDOW:
        return GlobalSymbolCoverage.FreshnessChoices.FRESH
    if age <= _SNAPSHOT_WARM_WINDOW:
        return GlobalSymbolCoverage.FreshnessChoices.WARM
    return GlobalSymbolCoverage.FreshnessChoices.STALE


def _resolve_session_facts_state(row: SessionFacts | None, reference_trade_date: date, as_of: datetime) -> str:
    if row is None:
        return GlobalSymbolCoverage.FreshnessChoices.MISSING
    if row.session_date < reference_trade_date:
        return GlobalSymbolCoverage.FreshnessChoices.STALE
    if row.stale:
        return GlobalSymbolCoverage.FreshnessChoices.STALE
    computed_at = _normalize_dt(row.computed_at)
    if computed_at is None:
        return GlobalSymbolCoverage.FreshnessChoices.UNKNOWN
    age = max(as_of - computed_at, timedelta())
    if age <= _SESSION_FACTS_FRESH_WINDOW:
        return GlobalSymbolCoverage.FreshnessChoices.FRESH
    if age <= _SESSION_FACTS_WARM_WINDOW:
        return GlobalSymbolCoverage.FreshnessChoices.WARM
    return GlobalSymbolCoverage.FreshnessChoices.STALE


def _resolve_next_action(dataset: str, freshness_state: str) -> str:
    return _NEXT_ACTION_BY_DATASET.get(dataset, {}).get(str(freshness_state or '').lower(), '')


def _normalize_requested_symbols(symbols: list[str] | tuple[str, ...] | set[str] | None) -> list[str]:
    if symbols:
        normalized_symbols = []
        seen_symbols = set()
        for raw_symbol in symbols:
            normalized_symbol = normalize_symbol(raw_symbol)
            if normalized_symbol in seen_symbols:
                continue
            seen_symbols.add(normalized_symbol)
            normalized_symbols.append(normalized_symbol)
        return normalized_symbols

    return list(
        GlobalSymbolRegistry.objects.filter(is_active=True).order_by('symbol').values_list('symbol', flat=True)
    )


def _normalize_requested_datasets(datasets: list[str] | tuple[str, ...] | set[str] | None) -> list[str]:
    if not datasets:
        return list(DATASET_ORDER)

    normalized_datasets = []
    seen_datasets = set()
    for raw_dataset in datasets:
        normalized_dataset = str(raw_dataset or '').strip().lower()
        if not normalized_dataset:
            continue
        if normalized_dataset not in DATASET_ORDER:
            raise ValueError(f'Dataset khong hop le: {raw_dataset}')
        if normalized_dataset in seen_datasets:
            continue
        seen_datasets.add(normalized_dataset)
        normalized_datasets.append(normalized_dataset)
    return normalized_datasets


def _resolve_planner_reason(freshness_state: str, *, force_refresh: bool) -> str:
    if force_refresh:
        return 'manual_force'
    return {
        GlobalSymbolCoverage.FreshnessChoices.ERROR: 'repair',
        GlobalSymbolCoverage.FreshnessChoices.MISSING: 'missing',
        GlobalSymbolCoverage.FreshnessChoices.STALE: 'stale',
        GlobalSymbolCoverage.FreshnessChoices.UNKNOWN: 'missing',
    }.get(freshness_state, 'coverage_ok')


def _should_plan_dataset(freshness_state: str, *, force_refresh: bool) -> bool:
    if force_refresh:
        return True
    return freshness_state in {
        GlobalSymbolCoverage.FreshnessChoices.ERROR,
        GlobalSymbolCoverage.FreshnessChoices.MISSING,
        GlobalSymbolCoverage.FreshnessChoices.STALE,
        GlobalSymbolCoverage.FreshnessChoices.UNKNOWN,
    }


def _build_requested_window(
    dataset: str,
    coverage_row: GlobalSymbolCoverage | None,
    *,
    reference_trade_date: date,
    force_refresh: bool,
) -> dict[str, str]:
    reference_trade_date_str = reference_trade_date.isoformat()
    if force_refresh:
        return {'trade_date': reference_trade_date_str}

    # Apply explicit gap windows first when coverage indicates stale/missing ranges.
    missing_ranges = list((coverage_row.missing_ranges if coverage_row is not None else []) or [])
    if missing_ranges:
        first_range = missing_ranges[0]
        return {
            'start_date': str(first_range.get('start') or reference_trade_date_str),
            'end_date': str(first_range.get('end') or reference_trade_date_str),
        }

    if dataset == GlobalSymbolCoverage.DatasetChoices.DAILY_PRICES:
        if coverage_row is None or coverage_row.latest_complete_trade_date is None:
            return {'days': _resolve_daily_price_bootstrap_days()}
        latest_trade_date = coverage_row.latest_complete_trade_date if coverage_row is not None else None
        if latest_trade_date is not None and latest_trade_date < reference_trade_date:
            return {
                'start_date': (latest_trade_date + timedelta(days=1)).isoformat(),
                'end_date': reference_trade_date_str,
            }
        return {'trade_date': reference_trade_date_str}

    return {'trade_date': reference_trade_date_str}


def _upsert_coverage_row(
    registry: GlobalSymbolRegistry,
    *,
    dataset: str,
    latest_available_at: datetime | None,
    oldest_available_at: datetime | None,
    latest_complete_trade_date: date | None,
    freshness_state: str,
    missing_ranges: list[dict[str, str]] | None,
    last_verified_at: datetime,
    next_recommended_action: str,
    detail: dict[str, Any] | None,
) -> GlobalSymbolCoverage:
    row, _ = GlobalSymbolCoverage.objects.get_or_create(
        registry=registry,
        dataset=dataset,
    )
    next_values = {
        'latest_available_at': latest_available_at,
        'oldest_available_at': oldest_available_at,
        'latest_complete_trade_date': latest_complete_trade_date,
        'freshness_state': freshness_state,
        'missing_ranges': missing_ranges or [],
        'last_verified_at': last_verified_at,
        'next_recommended_action': next_recommended_action,
        'detail': detail or {},
    }
    update_fields = []
    for field_name, next_value in next_values.items():
        if getattr(row, field_name) != next_value:
            setattr(row, field_name, next_value)
            update_fields.append(field_name)
    if update_fields:
        if 'updated_at' not in update_fields:
            update_fields.append('updated_at')
        row.save(update_fields=update_fields)
    return row


def _build_daily_prices_payload(symbol: str, reference_trade_date: date, verified_at: datetime) -> dict[str, Any]:
    stats = DailyPrice.objects.filter(symbol=symbol).aggregate(oldest_date=Min('date'), latest_date=Max('date'))
    latest_trade_date = stats['latest_date']
    freshness_state = _resolve_daily_price_state(latest_trade_date, reference_trade_date)
    return {
        'dataset': GlobalSymbolCoverage.DatasetChoices.DAILY_PRICES,
        'latest_available_at': _trade_date_to_datetime(latest_trade_date, market_close=True),
        'oldest_available_at': _trade_date_to_datetime(stats['oldest_date']),
        'latest_complete_trade_date': latest_trade_date,
        'freshness_state': freshness_state,
        'missing_ranges': _build_missing_ranges(
            latest_trade_date=latest_trade_date,
            reference_trade_date=reference_trade_date,
            state=freshness_state,
        ),
        'last_verified_at': verified_at,
        'next_recommended_action': _resolve_next_action(GlobalSymbolCoverage.DatasetChoices.DAILY_PRICES, freshness_state),
        'detail': {
            'row_count': DailyPrice.objects.filter(symbol=symbol).count(),
            'reference_trade_date': reference_trade_date.isoformat(),
        },
    }


def _build_intraday_payload(dataset: str, symbol: str, reference_trade_date: date, verified_at: datetime) -> dict[str, Any]:
    model = IntradayBar if dataset == GlobalSymbolCoverage.DatasetChoices.INTRADAY_BARS else IntradayTick
    latest_field = 'datetime' if model is IntradayBar else 'timestamp'
    stats = model.objects.filter(symbol=symbol).aggregate(
        oldest_available_at=Min(latest_field),
        latest_available_at=Max(latest_field),
    )
    latest_available_at = _normalize_dt(stats['latest_available_at'])
    freshness_state = _resolve_intraday_state(latest_available_at, reference_trade_date, verified_at)
    latest_trade_date = latest_available_at.date() if latest_available_at is not None else None
    return {
        'dataset': dataset,
        'latest_available_at': latest_available_at,
        'oldest_available_at': _normalize_dt(stats['oldest_available_at']),
        'latest_complete_trade_date': latest_trade_date,
        'freshness_state': freshness_state,
        'missing_ranges': _build_missing_ranges(
            latest_trade_date=latest_trade_date,
            reference_trade_date=reference_trade_date,
            state=freshness_state,
        ),
        'last_verified_at': verified_at,
        'next_recommended_action': _resolve_next_action(dataset, freshness_state),
        'detail': {
            'row_count': model.objects.filter(symbol=symbol).count(),
            'reference_trade_date': reference_trade_date.isoformat(),
        },
    }


def _build_snapshot_payload(symbol: str, reference_trade_date: date, verified_at: datetime) -> dict[str, Any]:
    row = SymbolSnapshot.objects.filter(symbol=symbol).order_by('-session_date', '-fetched_at', '-pk').first()
    oldest_session_date = SymbolSnapshot.objects.filter(symbol=symbol).aggregate(oldest_session_date=Min('session_date'))['oldest_session_date']
    freshness_state = _resolve_snapshot_state(row, reference_trade_date, verified_at)
    latest_trade_date = row.session_date if row is not None else None
    return {
        'dataset': GlobalSymbolCoverage.DatasetChoices.PRICE_BOARD_SNAPSHOT,
        'latest_available_at': _normalize_dt(row.fetched_at) if row is not None else None,
        'oldest_available_at': _trade_date_to_datetime(oldest_session_date),
        'latest_complete_trade_date': latest_trade_date,
        'freshness_state': freshness_state,
        'missing_ranges': _build_missing_ranges(
            latest_trade_date=latest_trade_date,
            reference_trade_date=reference_trade_date,
            state=freshness_state,
        ),
        'last_verified_at': verified_at,
        'next_recommended_action': _resolve_next_action(GlobalSymbolCoverage.DatasetChoices.PRICE_BOARD_SNAPSHOT, freshness_state),
        'detail': {
            'row_count': SymbolSnapshot.objects.filter(symbol=symbol).count(),
            'snapshot_stale_flag': bool(row.stale) if row is not None else None,
            'reference_trade_date': reference_trade_date.isoformat(),
        },
    }


def _build_session_facts_payload(symbol: str, reference_trade_date: date, verified_at: datetime) -> dict[str, Any]:
    row = SessionFacts.objects.filter(symbol=symbol).order_by('-session_date', '-computed_at', '-pk').first()
    oldest_session_date = SessionFacts.objects.filter(symbol=symbol).aggregate(oldest_session_date=Min('session_date'))['oldest_session_date']
    freshness_state = _resolve_session_facts_state(row, reference_trade_date, verified_at)
    latest_trade_date = row.session_date if row is not None else None
    return {
        'dataset': GlobalSymbolCoverage.DatasetChoices.SESSION_FACTS,
        'latest_available_at': _normalize_dt(row.computed_at) if row is not None else None,
        'oldest_available_at': _trade_date_to_datetime(oldest_session_date),
        'latest_complete_trade_date': latest_trade_date,
        'freshness_state': freshness_state,
        'missing_ranges': _build_missing_ranges(
            latest_trade_date=latest_trade_date,
            reference_trade_date=reference_trade_date,
            state=freshness_state,
        ),
        'last_verified_at': verified_at,
        'next_recommended_action': _resolve_next_action(GlobalSymbolCoverage.DatasetChoices.SESSION_FACTS, freshness_state),
        'detail': {
            'row_count': SessionFacts.objects.filter(symbol=symbol).count(),
            'session_facts_stale_flag': bool(row.stale) if row is not None else None,
            'reference_trade_date': reference_trade_date.isoformat(),
        },
    }


@transaction.atomic
def refresh_global_symbol_coverage(
    symbol_or_registry: str | GlobalSymbolRegistry,
    *,
    reference_trade_date: date | None = None,
    as_of: datetime | None = None,
) -> list[GlobalSymbolCoverage]:
    registry = _resolve_registry(symbol_or_registry)
    verified_at = _normalize_dt(as_of) or timezone.now()
    reference_trade_date = reference_trade_date or timezone.localdate()
    symbol = registry.symbol
    payloads = (
        _build_daily_prices_payload(symbol, reference_trade_date, verified_at),
        _build_snapshot_payload(symbol, reference_trade_date, verified_at),
        _build_intraday_payload(GlobalSymbolCoverage.DatasetChoices.INTRADAY_BARS, symbol, reference_trade_date, verified_at),
        _build_intraday_payload(GlobalSymbolCoverage.DatasetChoices.INTRADAY_TICKS, symbol, reference_trade_date, verified_at),
        _build_session_facts_payload(symbol, reference_trade_date, verified_at),
    )
    coverage_rows = [
        _upsert_coverage_row(registry, **payload)
        for payload in payloads
    ]
    refresh_global_symbol_registry(registry)
    return coverage_rows


def build_symbol_coverage_detail(symbol_or_registry: str | GlobalSymbolRegistry) -> dict[str, Any]:
    registry = _resolve_registry(symbol_or_registry)
    datasets = []
    dataset_order = {dataset: index for index, dataset in enumerate(DATASET_ORDER)}
    for row in sorted(registry.coverage_rows.all(), key=lambda item: dataset_order.get(item.dataset, 999)):
        datasets.append({
            'dataset': row.dataset,
            'freshness_state': row.freshness_state,
            'latest_available_at': row.latest_available_at.isoformat() if row.latest_available_at else None,
            'latest_complete_trade_date': row.latest_complete_trade_date.isoformat() if row.latest_complete_trade_date else None,
            'missing_ranges': list(row.missing_ranges or []),
            'next_recommended_action': row.next_recommended_action or None,
            'detail': dict(row.detail or {}),
        })
    return {
        'symbol': registry.symbol,
        'datasets': datasets,
    }


def build_global_coverage_summary(*, top_gap_limit: int = 10) -> dict[str, Any]:
    datasets = []
    for dataset in DATASET_ORDER:
        row = {'dataset': dataset}
        for freshness_state in FRESHNESS_ORDER:
            row[freshness_state] = GlobalSymbolCoverage.objects.filter(
                dataset=dataset,
                freshness_state=freshness_state,
            ).count()
        datasets.append(row)

    top_gap_rows = list(
        GlobalSymbolCoverage.objects.select_related('registry').filter(
            freshness_state__in=[
                GlobalSymbolCoverage.FreshnessChoices.ERROR,
                GlobalSymbolCoverage.FreshnessChoices.MISSING,
                GlobalSymbolCoverage.FreshnessChoices.STALE,
            ]
        )
    )
    dataset_order = {dataset: index for index, dataset in enumerate(DATASET_ORDER)}
    top_gap_rows.sort(
        key=lambda row: (
            TOP_GAP_ORDER.get(row.freshness_state, 999),
            dataset_order.get(row.dataset, 999),
            -(row.last_verified_at.timestamp() if row.last_verified_at else 0.0),
            row.registry.symbol,
        )
    )
    top_gaps = [{
        'symbol': row.registry.symbol,
        'dataset': row.dataset,
        'freshness_state': row.freshness_state,
        'next_recommended_action': row.next_recommended_action or None,
    } for row in top_gap_rows[:max(int(top_gap_limit), 0)]]
    return {
        'datasets': datasets,
        'top_gaps': top_gaps,
        'updated_at': timezone.now().isoformat(),
    }


def build_global_planner_preview(
    *,
    symbols: list[str] | tuple[str, ...] | set[str] | None = None,
    datasets: list[str] | tuple[str, ...] | set[str] | None = None,
    mode: str = 'missing_only',
    force_refresh: bool = False,
    reason: str = 'manual_preview',
    reference_trade_date: date | None = None,
) -> dict[str, Any]:
    normalized_mode = str(mode or '').strip().lower() or 'missing_only'
    if normalized_mode not in PLANNER_SUPPORTED_MODES:
        raise ValueError(f'Planner mode khong ho tro: {mode}')

    normalized_symbols = _normalize_requested_symbols(symbols)
    normalized_datasets = _normalize_requested_datasets(datasets)
    reference_trade_date = reference_trade_date or timezone.localdate()
    dataset_order = {dataset: index for index, dataset in enumerate(DATASET_ORDER)}

    coverage_rows = list(
        GlobalSymbolCoverage.objects.select_related('registry').filter(
            registry__symbol__in=normalized_symbols,
            dataset__in=normalized_datasets,
        )
    )
    coverage_by_key = {
        (row.registry.symbol, row.dataset): row
        for row in coverage_rows
    }

    items = []
    skipped = []
    for symbol in normalized_symbols:
        for dataset in normalized_datasets:
            coverage_row = coverage_by_key.get((symbol, dataset))
            coverage_before = coverage_row.freshness_state if coverage_row is not None else GlobalSymbolCoverage.FreshnessChoices.MISSING
            if _should_plan_dataset(coverage_before, force_refresh=force_refresh):
                items.append({
                    'symbol': symbol,
                    'dataset': dataset,
                    'provider_chain': list(PLANNER_PROVIDER_CHAIN_BY_DATASET.get(dataset, ['vnbroker'])),
                    'requested_window': _build_requested_window(
                        dataset,
                        coverage_row,
                        reference_trade_date=reference_trade_date,
                        force_refresh=force_refresh,
                    ),
                    'reason': _resolve_planner_reason(coverage_before, force_refresh=force_refresh),
                    'overwrite_existing': bool(force_refresh),
                    'coverage_before': coverage_before,
                })
                continue

            skipped.append({
                'symbol': symbol,
                'dataset': dataset,
                'reason': 'coverage_ok',
            })

    items.sort(key=lambda item: (item['symbol'], dataset_order.get(item['dataset'], 999)))
    skipped.sort(key=lambda item: (item['symbol'], dataset_order.get(item['dataset'], 999)))
    return {
        'mode': normalized_mode,
        'requested_reason': str(reason or '').strip() or 'manual_preview',
        'items': items,
        'skipped': skipped,
        'summary': {
            'planned_items': len(items),
            'skipped_items': len(skipped),
        },
    }
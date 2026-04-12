
# --- Stock Management Modular Views ---
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, IsAdminUser, AllowAny
from rest_framework import generics, filters as rest_framework_filters
from .models import StockProfile
from .serializers import StockProfileSerializer, SecuritiesGroupDetailSerializer, SecuritiesItemSerializer

# StockProfile List API
class StockProfileListView(generics.ListAPIView):
    serializer_class = StockProfileSerializer
    permission_classes = [AllowAny]
    filter_backends = [rest_framework_filters.SearchFilter]
    search_fields = ['symbol', 'company_name']

    def get_queryset(self):
        qs = StockProfile.objects.filter(is_active=True)
        return qs

# StockProfile Detail đã có

# Đồng bộ StockProfile từ vnstock (gọi management command hoặc service)
from django.http import JsonResponse
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def sync_stockprofile_api(request):
    result = sync_stock_profiles(requested_by=request.user, mode=request.query_params.get('mode', 'all'))
    return JsonResponse(
        {
            'success': result['success'],
            'message': result['message'],
            'warning': result.get('warning'),
            'source': result.get('source'),
            'total_symbols': result.get('total_symbols', 0),
            'created_symbols': result.get('created_symbols', 0),
            'updated_symbols': result.get('updated_symbols', 0),
            'error': result.get('error', ''),
        },
        status=200 if result['success'] else 500,
    )

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def symbol_investigation_api(request, symbol: str):
    """
    GET /api/realtime/symbol-investigation/<symbol>/

    Get co-observation of whale campaigns + dark money flows for a symbol.
    """
    try:
        normalized_symbol = (symbol or '').strip().upper()
        if not normalized_symbol or len(normalized_symbol) > 10:
            return Response(
                {'detail': 'Thiếu mã chứng khoán.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        window = request.query_params.get('window', 'session')
        if window not in ['5m', '15m', '1h', 'session', '5d']:
            return Response(
                {'detail': 'Window không hợp lệ. Sử dụng: 5m, 15m, 1h, session, 5d'},
                status=status.HTTP_400_BAD_REQUEST
            )

        include_whale_raw = request.query_params.get('include_whale', request.query_params.get('include_campaigns', 'true'))
        include_dark_flow_raw = request.query_params.get('include_dark_flow', request.query_params.get('include_signals', 'true'))
        include_whale = str(include_whale_raw).lower() == 'true'
        include_dark_flow = str(include_dark_flow_raw).lower() == 'true'
        sort = request.query_params.get('sort', 'created_at')
        if sort not in ['created_at', 'correlation_strength']:
            return Response(
                {'detail': 'Sort không hợp lệ. Sử dụng: created_at, correlation_strength'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from .coobservation_service import CoObservationService
        service = CoObservationService()
        result = service.get_symbol_investigation(
            symbol=normalized_symbol,
            window=window,
            include_whale=include_whale,
            include_dark_flow=include_dark_flow,
            sort=sort,
            user=request.user,
            query_params=request.query_params,
        )
        return Response(result)
    except Exception:
        logger.exception(f'symbol_investigation_api error for {symbol}')
        return Response(
            {'detail': 'Lỗi khi lấy thông tin co-observation.'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAdminUser])
def sync_market_groups_api(request):
    """
    POST /api/admin-ops/market-groups/sync/
    Trigger đồng bộ nhóm thị trườ ng (sectors, market caps) toàn hệ thống.
    Yêu cầu is_staff.
    """
    mode = request.query_params.get('mode', 'all')
    clear_existing = request.query_params.get('clear', 'false').lower() == 'true'

    result = sync_market_groups(
        requested_by=request.user,
        mode=mode,
        clear_existing=clear_existing,
        scope=MarketGroupSyncLog.ScopeChoices.GLOBAL,
    )

    if result.get('warning') and result.get('success'):
        resp_status = status.HTTP_207_MULTI_STATUS
    elif result.get('success'):
        resp_status = status.HTTP_200_OK
    else:
        resp_status = status.HTTP_500_INTERNAL_SERVER_ERROR

    return Response(
        {
            'success': result.get('success', False),
            'message': result.get('message', ''),
            'warning': result.get('warning'),
            'source': result.get('source'),
            'created_groups': result.get('created_groups_count', 0),
            'updated_groups': result.get('updated_groups_count', 0),
            'added_symbols': result.get('added_symbols_count', 0),
            'error': result.get('error', ''),
        },
        status=resp_status,
    )


@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_runtime_kpi_api(request):
    """
    GET /api/admin-ops/runtime-kpi/
    Admin-only: runtime KPI snapshot cho trust-track S24-06..S24-10.
    Trả về observability market, prefetch health, celery alive status.
    """
    from time import time as _time
    from portfolio.observability import get_market_observability_snapshot
    from config.health import build_prefetch_health_snapshot

    celery_alive = False
    celery_active_queues: list = []
    try:
        from config.celery import app as celery_app
        inspect = celery_app.control.inspect(timeout=1.5)
        ping_result = inspect.ping()
        celery_alive = bool(ping_result)
        active_qs = inspect.active_queues() or {}
        celery_active_queues = list(active_qs.keys())
    except Exception:
        pass

    obs_snapshot = get_market_observability_snapshot()
    prefetch_snapshot = build_prefetch_health_snapshot()

    return Response(
        {
            'sampled_at': _time(),
            'market_observability': obs_snapshot,
            'prefetch_health': prefetch_snapshot,
            'celery': {
                'alive': celery_alive,
                'active_workers': celery_active_queues,
            },
        },
        status=status.HTTP_200_OK,
    )


@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_runtime_kpi_advisory_merge_api(request):
    """
    GET /api/admin-ops/runtime-kpi/advisory-merge/
    Admin-only: trả về nhanh chỉ số merge pipeline của advisory event.
    """
    from time import time as _time
    from portfolio.observability import get_market_observability_snapshot

    snapshot = get_market_observability_snapshot()
    merge_stats = snapshot.get('advisory_event_merge') or {}
    return Response(
        {
            'sampled_at': _time(),
            'advisory_event_merge': {
                'scheduled': int(merge_stats.get('scheduled', 0)),
                'merged': int(merge_stats.get('merged', 0)),
                'flushed': int(merge_stats.get('flushed', 0)),
                'skipped': int(merge_stats.get('skipped', 0)),
            },
        },
        status=status.HTTP_200_OK,
    )


@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_runtime_kpi_whale_pipeline_api(request):
    """
    GET /api/admin-ops/runtime-kpi/whale-pipeline/
    Admin-only: trả về health summary cho whale pipeline observability.
    """
    from time import time as _time
    from portfolio.observability import get_whale_pipeline_health_summary

    return Response(
        {
            'sampled_at': _time(),
            'whale_pipeline': get_whale_pipeline_health_summary(),
        },
        status=status.HTTP_200_OK,
    )


@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_runtime_kpi_advisory_metrics_api(request):
    """
    GET /api/admin-ops/runtime-kpi/advisory-metrics/

    Admin-only: monitoring metrics cho Advisory AI pipeline.
    Tổng hợp 5 chỉ số chính phục vụ Grafana / alerting:
      - p50 / p95 generation latency (từ AdvisoryAggregateAuditLog, window 24h)
      - Token burn today vs. tổng budget khả dụng
      - Provider distribution (7 ngày gần nhất)
      - Active 429 rate-limit cooldowns per provider
      - Advisory generation counts today by source

    Query-params:
      latency_window_hours=24  (default)   — cửa sổ tính latency, tối đa 168
      provider_window_days=7   (default)   — cửa sổ phân phối provider, tối đa 30
    """
    import statistics
    from time import time as _time
    from django.db.models import Sum
    from django.utils import timezone
    from django.core.cache import cache
    from portfolio.models import AdvisoryAggregateAuditLog, AdvisoryTokenLog, UserConfig, WhaleAdvisory
    from portfolio.ai_options import MODEL_CATALOG

    sampled_at = _time()

    # ── Query-param validation ────────────────────────────────────────────────
    try:
        latency_window_hours = min(max(int(request.query_params.get('latency_window_hours', 24)), 1), 168)
    except (TypeError, ValueError):
        latency_window_hours = 24

    try:
        provider_window_days = min(max(int(request.query_params.get('provider_window_days', 7)), 1), 30)
    except (TypeError, ValueError):
        provider_window_days = 7

    # ── 1. Latency p50 / p95 ─────────────────────────────────────────────────
    latency_window_start = timezone.now() - timezone.timedelta(hours=latency_window_hours)
    audit_qs = AdvisoryAggregateAuditLog.objects.filter(
        created_at__gte=latency_window_start,
    ).values_list('metadata_json', flat=True)

    latencies_ms: list[float] = []
    for meta in audit_qs:
        if isinstance(meta, dict):
            val = meta.get('latency_ms')
            if val is not None:
                try:
                    latencies_ms.append(float(val))
                except (TypeError, ValueError):
                    pass

    latency_p50 = round(statistics.median(latencies_ms), 2) if latencies_ms else None
    if latencies_ms:
        sorted_lat = sorted(latencies_ms)
        p95_idx = max(0, int(len(sorted_lat) * 0.95) - 1)
        latency_p95 = round(sorted_lat[p95_idx], 2)
    else:
        latency_p95 = None

    # ── 2. Token burn today ───────────────────────────────────────────────────
    today = timezone.localdate()
    token_burn_today = int(
        AdvisoryTokenLog.objects.filter(created_at__date=today).aggregate(t=Sum('tokens_used'))['t'] or 0
    )
    total_configured_budget = int(
        UserConfig.objects.filter(advisory_max_tokens_per_day__gt=0).aggregate(
            s=Sum('advisory_max_tokens_per_day')
        )['s'] or 0
    )
    burn_pct = round((token_burn_today / total_configured_budget * 100), 2) if total_configured_budget else None

    # ── 3. Provider distribution (last N days) ────────────────────────────────
    provider_window_start = timezone.now() - timezone.timedelta(days=provider_window_days)
    provider_dist: dict[str, int] = {}
    for meta in AdvisoryAggregateAuditLog.objects.filter(
        created_at__gte=provider_window_start,
    ).values_list('metadata_json', flat=True):
        if isinstance(meta, dict):
            prov = str(meta.get('ai_provider') or '').strip().lower()
            if prov:
                provider_dist[prov] = provider_dist.get(prov, 0) + 1

    # ── 4. Active 429 rate-limit cooldowns per provider ──────────────────────
    known_providers = list(MODEL_CATALOG.keys())
    ratelimit_cooldowns: dict[str, bool] = {
        prov: bool(cache.get(f'advisory:provider-ratelimit:{prov}'))
        for prov in known_providers
    }
    today_iso = today.isoformat()
    ratelimit_429_counts_today: dict[str, int] = {
        prov: int(cache.get(f'advisory:429-count:{prov}:{today_iso}') or 0)
        for prov in known_providers
    }
    budget_downgrade_count_today = int(cache.get(f'advisory:budget-downgrade-count:{today_iso}') or 0)

    language_quality = {}
    for lang in ('vi', 'en'):
        checks = int(cache.get(f'advisory:language-check-count:{lang}:{today_iso}') or 0)
        mismatches = int(cache.get(f'advisory:language-mismatch-count:{lang}:{today_iso}') or 0)
        mismatch_rate = round((mismatches / checks) * 100.0, 2) if checks > 0 else None
        language_quality[lang] = {
            'checks_today': checks,
            'mismatches_today': mismatches,
            'mismatch_rate_pct': mismatch_rate,
        }

    # ── 4b. Failover tracking + provider health (today) ─────────────────────
    failover_attempt_count_today = int(cache.get(f'advisory:failover-attempt-count:{today_iso}') or 0)
    failover_success_count_today = int(cache.get(f'advisory:failover-success-count:{today_iso}') or 0)
    failover_success_rate = (
        round(failover_success_count_today / failover_attempt_count_today, 4)
        if failover_attempt_count_today > 0
        else None
    )

    failover_by_source: dict[str, dict] = {}
    provider_health: dict[str, dict] = {}
    for prov in known_providers:
        failover_count = int(cache.get(f'advisory:failover-count:{prov}:{today_iso}') or 0)
        failover_success_for_source = int(cache.get(f'advisory:failover-success:{prov}:{today_iso}') or 0)

        primary_failures = {
            'rate_limited': int(cache.get(f'advisory:failover-reason:{prov}:rate_limited:{today_iso}') or 0),
            'service_down': int(cache.get(f'advisory:failover-reason:{prov}:service_down:{today_iso}') or 0),
            'timeout': int(cache.get(f'advisory:failover-reason:{prov}:timeout:{today_iso}') or 0),
            'missing_api_key': int(cache.get(f'advisory:failover-reason:{prov}:missing_api_key:{today_iso}') or 0),
            'unknown': int(cache.get(f'advisory:failover-reason:{prov}:unknown:{today_iso}') or 0),
        }

        fallback_targets_used = {
            target: int(cache.get(f'advisory:failover-target:{prov}:{target}:{today_iso}') or 0)
            for target in known_providers
            if target != prov
        }
        fallback_targets_used = {k: v for k, v in fallback_targets_used.items() if v > 0}

        failover_by_source[prov] = {
            'failover_count': failover_count,
            'success_after_failover_count': failover_success_for_source,
            'primary_failures': primary_failures,
            'fallback_targets_used': fallback_targets_used,
        }

        attempts_today = int(cache.get(f'advisory:provider-attempts:{prov}:{today_iso}') or 0)
        successful_attempts_today = int(cache.get(f'advisory:provider-success:{prov}:{today_iso}') or 0)
        success_rate_pct = round((successful_attempts_today / attempts_today) * 100.0, 2) if attempts_today else None
        last_failure = cache.get(f'advisory:provider-last-failure:{prov}')
        provider_health[prov] = {
            'success_rate_pct': success_rate_pct,
            'last_failure': last_failure.get('at') if isinstance(last_failure, dict) else None,
            'failure_type': last_failure.get('failure_type') if isinstance(last_failure, dict) else None,
            'attempts_today': attempts_today,
            'successful_attempts': successful_attempts_today,
        }

    # ── 5. Generation counts today by source ─────────────────────────────────
    source_counts: dict[str, int] = {}
    for entry in (
        AdvisoryTokenLog.objects.filter(created_at__date=today)
        .values('source')
        .annotate(cnt=Sum('tokens_used'))
        .order_by()
    ):
        source_counts[str(entry['source'])] = int(entry['cnt'] or 0)

    advisory_count_today = AdvisoryTokenLog.objects.filter(created_at__date=today).count()

    return Response(
        {
            'sampled_at': sampled_at,
            'windows': {
                'latency_hours': latency_window_hours,
                'provider_days': provider_window_days,
            },
            'latency': {
                'p50_ms': latency_p50,
                'p95_ms': latency_p95,
                'sample_count': len(latencies_ms),
            },
            'token_burn': {
                'today_tokens': token_burn_today,
                'total_configured_budget': total_configured_budget,
                'burn_pct': burn_pct,
            },
            'provider_distribution': provider_dist,
            'ratelimit_cooldowns_active': ratelimit_cooldowns,
            'ratelimit_429_counts_today': ratelimit_429_counts_today,
            'budget_downgrade_count_today': budget_downgrade_count_today,
            'language_quality': language_quality,
            'failover_tracking': {
                'failovers_today': failover_attempt_count_today,
                'by_source_provider': failover_by_source,
                'failover_success_rate': failover_success_rate,
            },
            'provider_health': provider_health,
            'advisory_counts_today': {
                'total': advisory_count_today,
                'by_source_tokens': source_counts,
            },
        },
        status=status.HTTP_200_OK,
    )


HOLISTIC_GOVERNANCE_DELTA_CACHE_KEY = 'admin_ops:holistic_governance_delta_thresholds'
PREFETCH_RUNTIME_SETTINGS_CACHE_KEY = 'admin_ops:prefetch_runtime_settings'
PREFETCH_TIME_POLICY_CACHE_KEY = 'admin_ops:prefetch_time_policy'


def _default_governance_delta_thresholds():
    warning = max(0.0, float(getattr(settings, 'HOLISTIC_GOVERNANCE_DELTA_WARNING_THRESHOLD', 2.0) or 2.0))
    critical = max(warning, float(getattr(settings, 'HOLISTIC_GOVERNANCE_DELTA_CRITICAL_THRESHOLD', 4.0) or 4.0))
    cooldown = max(0.0, float(getattr(settings, 'HOLISTIC_GOVERNANCE_DELTA_COOLDOWN_THRESHOLD', 2.0) or 2.0))
    return {
        'warning': warning,
        'critical': critical,
        'cooldown': cooldown,
    }


def _coerce_governance_delta_thresholds(raw_payload, fallback=None):
    payload = raw_payload if isinstance(raw_payload, dict) else {}
    base = fallback or _default_governance_delta_thresholds()

    try:
        warning = float(payload.get('warning', base['warning']))
        critical = float(payload.get('critical', base['critical']))
        cooldown = float(payload.get('cooldown', base['cooldown']))
    except (TypeError, ValueError):
        raise ValueError('governance_delta_thresholds phải là số hợp lệ.')

    if warning < 0 or critical < 0 or cooldown < 0:
        raise ValueError('governance_delta_thresholds không được âm.')
    if critical < warning:
        raise ValueError('critical phải lớn hơn hoặc bằng warning.')

    return {
        'warning': warning,
        'critical': critical,
        'cooldown': cooldown,
    }


def _get_runtime_governance_delta_thresholds():
    from django.core.cache import cache

    default_thresholds = _default_governance_delta_thresholds()
    cached = cache.get(HOLISTIC_GOVERNANCE_DELTA_CACHE_KEY)
    if not isinstance(cached, dict):
        return default_thresholds
    try:
        return _coerce_governance_delta_thresholds(cached, fallback=default_thresholds)
    except ValueError:
        return default_thresholds


def _set_runtime_governance_delta_thresholds(raw_payload):
    from django.core.cache import cache

    normalized = _coerce_governance_delta_thresholds(raw_payload, fallback=_default_governance_delta_thresholds())
    cache.set(HOLISTIC_GOVERNANCE_DELTA_CACHE_KEY, normalized, timeout=None)
    setattr(settings, 'HOLISTIC_GOVERNANCE_DELTA_WARNING_THRESHOLD', normalized['warning'])
    setattr(settings, 'HOLISTIC_GOVERNANCE_DELTA_CRITICAL_THRESHOLD', normalized['critical'])
    setattr(settings, 'HOLISTIC_GOVERNANCE_DELTA_COOLDOWN_THRESHOLD', normalized['cooldown'])
    return normalized


def _default_prefetch_runtime_settings():
    def _int_env(name, default, minimum):
        try:
            value = int(os.getenv(name, str(default)))
        except (TypeError, ValueError):
            value = int(default)
        return max(value, minimum)

    retry_base = _int_env('TICKER_PREFETCH_RETRY_BASE_SECONDS', 8, 1)
    return {
        'batch_size': _int_env('TICKER_PREFETCH_BATCH_SIZE', 60, 1),
        'symbol_limit': _int_env('TICKER_PREFETCH_SYMBOL_LIMIT', 240, 0),
        'max_retries': _int_env('TICKER_PREFETCH_MAX_RETRIES', 6, 0),
        'retry_base_seconds': retry_base,
        'retry_max_seconds': max(_int_env('TICKER_PREFETCH_RETRY_MAX_SECONDS', 120, 1), retry_base),
        'rate_limit_cooldown_seconds': _int_env('VNSTOCK_RATE_LIMIT_COOLDOWN_SECONDS', 20, 5),
        'circuit_window_seconds': _int_env('VNSTOCK_CIRCUIT_WINDOW_SECONDS', 300, 30),
        'circuit_breaker_timeout_threshold': _int_env('VNSTOCK_CIRCUIT_BREAKER_TIMEOUT_THRESHOLD', 3, 1),
        'circuit_breaker_cooldown_seconds': _int_env('VNSTOCK_CIRCUIT_BREAKER_COOLDOWN_SECONDS', 1800, 60),
        'include_group_symbols': os.getenv('TICKER_PREFETCH_INCLUDE_GROUP_SYMBOLS', 'False').lower() == 'true',
    }


def _coerce_prefetch_runtime_settings(raw_payload, fallback=None):
    payload = raw_payload if isinstance(raw_payload, dict) else {}
    base = fallback or _default_prefetch_runtime_settings()

    int_fields = {
        'batch_size': 1,
        'symbol_limit': 0,
        'max_retries': 0,
        'retry_base_seconds': 1,
        'retry_max_seconds': 1,
        'rate_limit_cooldown_seconds': 5,
        'circuit_window_seconds': 30,
        'circuit_breaker_timeout_threshold': 1,
        'circuit_breaker_cooldown_seconds': 60,
    }

    normalized = {}
    for field, minimum in int_fields.items():
        try:
            value = int(payload.get(field, base[field]))
        except (TypeError, ValueError):
            raise ValueError(f'{field} phải là số nguyên hợp lệ.')
        normalized[field] = max(value, minimum)

    normalized['retry_max_seconds'] = max(normalized['retry_max_seconds'], normalized['retry_base_seconds'])
    normalized['include_group_symbols'] = bool(payload.get('include_group_symbols', base['include_group_symbols']))
    return normalized


def _get_runtime_prefetch_settings():
    from django.core.cache import cache

    default_settings = _default_prefetch_runtime_settings()
    cached = cache.get(PREFETCH_RUNTIME_SETTINGS_CACHE_KEY)
    if not isinstance(cached, dict):
        return default_settings
    try:
        return _coerce_prefetch_runtime_settings(cached, fallback=default_settings)
    except ValueError:
        return default_settings


def _set_runtime_prefetch_settings(raw_payload):
    from django.core.cache import cache

    normalized = _coerce_prefetch_runtime_settings(raw_payload, fallback=_default_prefetch_runtime_settings())
    cache.set(PREFETCH_RUNTIME_SETTINGS_CACHE_KEY, normalized, timeout=None)
    return normalized


def _default_prefetch_time_policy():
    return {
        'timezone': 'Asia/Ho_Chi_Minh',
        'market': {
            'open_time': '09:00',
            'close_time': '15:00',
            'pre_open_minutes': 30,
            'post_close_minutes': 30,
            'lunch_break': {
                'enabled': True,
                'start': '11:30',
                'end': '13:00',
            },
            'weekend_mode': 'offhours',
        },
        'profiles': {
            'pre_open': {
                'query_enabled': True,
                'interval_seconds': 90,
                'batch_size': 10,
                'symbol_limit': 20,
                'max_retries': 2,
            },
            'market_open': {
                'query_enabled': True,
                'interval_seconds': 35,
                'batch_size': 20,
                'symbol_limit': 40,
                'max_retries': 4,
            },
            'lunch_break': {
                'query_enabled': True,
                'interval_seconds': 180,
                'batch_size': 8,
                'symbol_limit': 20,
                'max_retries': 1,
            },
            'pre_close': {
                'query_enabled': True,
                'interval_seconds': 60,
                'batch_size': 12,
                'symbol_limit': 30,
                'max_retries': 2,
            },
            'post_close': {
                'query_enabled': True,
                'interval_seconds': 180,
                'batch_size': 8,
                'symbol_limit': 20,
                'max_retries': 1,
            },
            'offhours': {
                'query_enabled': False,
                'interval_seconds': 600,
                'batch_size': 5,
                'symbol_limit': 10,
                'max_retries': 0,
            },
        },
        'rate_limit_guard': {
            'jitter_percent': 15.0,
            'cooldown_multiplier_on_429': 2.0,
            'max_interval_seconds': 1800,
        },
    }


def _prefetch_time_policy_rulebook():
    return {
        'timezone_required': True,
        'time_format': 'HH:MM',
        'market': {
            'pre_open_minutes_min': 0,
            'post_close_minutes_min': 0,
            'weekend_mode_allowed': ['offhours'],
        },
        'profiles': {
            'required_profiles': ['pre_open', 'market_open', 'lunch_break', 'pre_close', 'post_close', 'offhours'],
            'interval_seconds_min': 5,
            'batch_size_min': 1,
            'symbol_limit_min': 0,
            'max_retries_min': 0,
        },
        'rate_limit_guard': {
            'jitter_percent_min': 0,
            'jitter_percent_max': 50,
            'cooldown_multiplier_on_429_min': 1,
            'max_interval_seconds_min': 60,
        },
    }


def _coerce_prefetch_time_policy(raw_payload, fallback=None):
    from datetime import datetime
    from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

    def _to_int(value, field, minimum=0):
        try:
            parsed = int(value)
        except (TypeError, ValueError):
            raise ValueError(f'{field} phải là số nguyên hợp lệ.')
        if parsed < minimum:
            raise ValueError(f'{field} phải lớn hơn hoặc bằng {minimum}.')
        return parsed

    def _to_float(value, field):
        try:
            return float(value)
        except (TypeError, ValueError):
            raise ValueError(f'{field} phải là số hợp lệ.')

    def _to_bool(value, field):
        if isinstance(value, bool):
            return value
        if isinstance(value, (int, float)):
            return bool(value)
        if isinstance(value, str):
            lowered = value.strip().lower()
            if lowered in {'true', '1', 'yes', 'on'}:
                return True
            if lowered in {'false', '0', 'no', 'off'}:
                return False
        raise ValueError(f'{field} phải là boolean hợp lệ.')

    def _to_hhmm(value, field):
        candidate = str(value or '').strip()
        try:
            datetime.strptime(candidate, '%H:%M')
        except ValueError:
            raise ValueError(f'{field} phải theo định dạng HH:MM.')
        return candidate

    def _to_minutes(hhmm):
        hh, mm = hhmm.split(':')
        return int(hh) * 60 + int(mm)

    payload = raw_payload if isinstance(raw_payload, dict) else {}
    base = fallback or _default_prefetch_time_policy()

    timezone_name = str(payload.get('timezone', base['timezone']) or '').strip()
    if not timezone_name:
        raise ValueError('prefetch_time_policy.timezone là bắt buộc.')
    try:
        ZoneInfo(timezone_name)
    except ZoneInfoNotFoundError:
        raise ValueError('prefetch_time_policy.timezone không hợp lệ.')

    market_payload = payload.get('market', {})
    if market_payload is None:
        market_payload = {}
    if not isinstance(market_payload, dict):
        raise ValueError('prefetch_time_policy.market phải là object hợp lệ.')

    market_base = base['market']
    open_time = _to_hhmm(market_payload.get('open_time', market_base['open_time']), 'prefetch_time_policy.market.open_time')
    close_time = _to_hhmm(market_payload.get('close_time', market_base['close_time']), 'prefetch_time_policy.market.close_time')
    if _to_minutes(open_time) >= _to_minutes(close_time):
        raise ValueError('prefetch_time_policy.market.open_time phải nhỏ hơn close_time.')

    pre_open_minutes = _to_int(
        market_payload.get('pre_open_minutes', market_base['pre_open_minutes']),
        'prefetch_time_policy.market.pre_open_minutes',
        minimum=0,
    )
    post_close_minutes = _to_int(
        market_payload.get('post_close_minutes', market_base['post_close_minutes']),
        'prefetch_time_policy.market.post_close_minutes',
        minimum=0,
    )

    lunch_payload = market_payload.get('lunch_break', {})
    if lunch_payload is None:
        lunch_payload = {}
    if not isinstance(lunch_payload, dict):
        raise ValueError('prefetch_time_policy.market.lunch_break phải là object hợp lệ.')

    lunch_base = market_base['lunch_break']
    lunch_enabled = _to_bool(
        lunch_payload.get('enabled', lunch_base['enabled']),
        'prefetch_time_policy.market.lunch_break.enabled',
    )
    lunch_start = _to_hhmm(
        lunch_payload.get('start', lunch_base['start']),
        'prefetch_time_policy.market.lunch_break.start',
    )
    lunch_end = _to_hhmm(
        lunch_payload.get('end', lunch_base['end']),
        'prefetch_time_policy.market.lunch_break.end',
    )
    if lunch_enabled and _to_minutes(lunch_start) >= _to_minutes(lunch_end):
        raise ValueError('prefetch_time_policy.market.lunch_break.start phải nhỏ hơn end.')

    weekend_mode = str(market_payload.get('weekend_mode', market_base.get('weekend_mode', 'offhours')) or '').strip().lower()
    if weekend_mode not in {'offhours'}:
        raise ValueError('prefetch_time_policy.market.weekend_mode không hợp lệ.')

    profiles_payload = payload.get('profiles', {})
    if profiles_payload is None:
        profiles_payload = {}
    if not isinstance(profiles_payload, dict):
        raise ValueError('prefetch_time_policy.profiles phải là object hợp lệ.')

    normalized_profiles = {}
    for profile_name, profile_base in base['profiles'].items():
        profile_payload = profiles_payload.get(profile_name, {})
        if profile_payload is None:
            profile_payload = {}
        if not isinstance(profile_payload, dict):
            raise ValueError(f'prefetch_time_policy.profiles.{profile_name} phải là object hợp lệ.')

        query_enabled = _to_bool(
            profile_payload.get('query_enabled', profile_base['query_enabled']),
            f'prefetch_time_policy.profiles.{profile_name}.query_enabled',
        )
        interval_seconds = _to_int(
            profile_payload.get('interval_seconds', profile_base['interval_seconds']),
            f'prefetch_time_policy.profiles.{profile_name}.interval_seconds',
            minimum=5,
        )
        batch_size = _to_int(
            profile_payload.get('batch_size', profile_base['batch_size']),
            f'prefetch_time_policy.profiles.{profile_name}.batch_size',
            minimum=1,
        )
        symbol_limit = _to_int(
            profile_payload.get('symbol_limit', profile_base['symbol_limit']),
            f'prefetch_time_policy.profiles.{profile_name}.symbol_limit',
            minimum=0,
        )
        max_retries = _to_int(
            profile_payload.get('max_retries', profile_base['max_retries']),
            f'prefetch_time_policy.profiles.{profile_name}.max_retries',
            minimum=0,
        )

        normalized_profiles[profile_name] = {
            'query_enabled': query_enabled,
            'interval_seconds': interval_seconds,
            'batch_size': batch_size,
            'symbol_limit': symbol_limit,
            'max_retries': max_retries,
        }

    guard_payload = payload.get('rate_limit_guard', {})
    if guard_payload is None:
        guard_payload = {}
    if not isinstance(guard_payload, dict):
        raise ValueError('prefetch_time_policy.rate_limit_guard phải là object hợp lệ.')
    guard_base = base['rate_limit_guard']

    jitter_percent = _to_float(
        guard_payload.get('jitter_percent', guard_base['jitter_percent']),
        'prefetch_time_policy.rate_limit_guard.jitter_percent',
    )
    if jitter_percent < 0 or jitter_percent > 50:
        raise ValueError('prefetch_time_policy.rate_limit_guard.jitter_percent phải trong khoảng [0, 50].')

    cooldown_multiplier_on_429 = _to_float(
        guard_payload.get('cooldown_multiplier_on_429', guard_base['cooldown_multiplier_on_429']),
        'prefetch_time_policy.rate_limit_guard.cooldown_multiplier_on_429',
    )
    if cooldown_multiplier_on_429 < 1:
        raise ValueError('prefetch_time_policy.rate_limit_guard.cooldown_multiplier_on_429 phải >= 1.')

    max_interval_seconds = _to_int(
        guard_payload.get('max_interval_seconds', guard_base['max_interval_seconds']),
        'prefetch_time_policy.rate_limit_guard.max_interval_seconds',
        minimum=60,
    )

    for profile_name, profile_payload in normalized_profiles.items():
        if profile_payload['interval_seconds'] > max_interval_seconds:
            raise ValueError(
                f'prefetch_time_policy.profiles.{profile_name}.interval_seconds không được lớn hơn '
                'prefetch_time_policy.rate_limit_guard.max_interval_seconds.'
            )

    return {
        'timezone': timezone_name,
        'market': {
            'open_time': open_time,
            'close_time': close_time,
            'pre_open_minutes': pre_open_minutes,
            'post_close_minutes': post_close_minutes,
            'lunch_break': {
                'enabled': lunch_enabled,
                'start': lunch_start,
                'end': lunch_end,
            },
            'weekend_mode': weekend_mode,
        },
        'profiles': normalized_profiles,
        'rate_limit_guard': {
            'jitter_percent': jitter_percent,
            'cooldown_multiplier_on_429': cooldown_multiplier_on_429,
            'max_interval_seconds': max_interval_seconds,
        },
    }


def _get_runtime_prefetch_time_policy():
    from django.core.cache import cache

    default_policy = _default_prefetch_time_policy()
    cached = cache.get(PREFETCH_TIME_POLICY_CACHE_KEY)
    if not isinstance(cached, dict):
        return default_policy
    try:
        return _coerce_prefetch_time_policy(cached, fallback=default_policy)
    except ValueError:
        return default_policy


def _set_runtime_prefetch_time_policy(raw_payload):
    from django.core.cache import cache

    normalized = _coerce_prefetch_time_policy(raw_payload, fallback=_default_prefetch_time_policy())
    cache.set(PREFETCH_TIME_POLICY_CACHE_KEY, normalized, timeout=None)
    return normalized


@api_view(['GET', 'PUT'])
@permission_classes([IsAdminUser])
def admin_system_ai_settings_api(request):
    """
    GET/PUT /api/admin-ops/system-ai-settings/
    Admin-only: quản trị System AI Settings cho fallback runtime.
    """
    from django.core.exceptions import ValidationError
    from .ai_options import ADVISORY_CAPABILITY, is_model_allowed_for_capability, is_valid_model, is_valid_provider
    from .models import SystemAISettings, SystemAISettingsAuditLog

    settings_obj = SystemAISettings.get_active()
    if settings_obj is None:
        settings_obj = SystemAISettings.objects.create(name='default', is_active=True)

    def _serialize(obj):
        governance_thresholds = _get_runtime_governance_delta_thresholds()
        prefetch_runtime_settings = _get_runtime_prefetch_settings()
        prefetch_time_policy = _get_runtime_prefetch_time_policy()
        return {
            'id': obj.id,
            'name': obj.name,
            'is_active': bool(obj.is_active),
            'ai_provider': str(obj.ai_provider or '').strip().lower(),
            'ai_model': str(obj.ai_model or '').strip(),
            'effective_ai_model': obj.get_effective_ai_model(),
            'allow_env_fallback': bool(obj.allow_env_fallback),
            'ai_api_key_configured': obj.ai_api_key_configured,
            'notes': str(obj.notes or ''),
            'governance_delta_thresholds': governance_thresholds,
            'governance_delta_rulebook': {
                'warning_min': 0,
                'critical_must_be_gte_warning': True,
                'cooldown_min': 0,
                'recommended': {
                    'warning': 2.0,
                    'critical': 4.0,
                    'cooldown': 2.0,
                },
            },
            'prefetch_runtime_settings': prefetch_runtime_settings,
            'prefetch_runtime_rulebook': {
                'batch_size_min': 1,
                'symbol_limit_min': 0,
                'max_retries_min': 0,
                'retry_base_seconds_min': 1,
                'retry_max_seconds_min': 1,
                'rate_limit_cooldown_seconds_min': 5,
                'circuit_window_seconds_min': 30,
                'circuit_breaker_timeout_threshold_min': 1,
                'circuit_breaker_cooldown_seconds_min': 60,
                'recommended': {
                    'batch_size': 20,
                    'symbol_limit': 40,
                    'max_retries': 4,
                    'retry_base_seconds': 15,
                    'retry_max_seconds': 120,
                    'rate_limit_cooldown_seconds': 30,
                    'circuit_window_seconds': 300,
                    'circuit_breaker_timeout_threshold': 3,
                    'circuit_breaker_cooldown_seconds': 1800,
                    'include_group_symbols': False,
                },
            },
            'prefetch_time_policy': prefetch_time_policy,
            'prefetch_time_policy_rulebook': _prefetch_time_policy_rulebook(),
            'updated_at': obj.updated_at.isoformat() if obj.updated_at else None,
        }

    def _snapshot(obj):
        governance_thresholds = _get_runtime_governance_delta_thresholds()
        prefetch_runtime_settings = _get_runtime_prefetch_settings()
        prefetch_time_policy = _get_runtime_prefetch_time_policy()
        return {
            'id': obj.id,
            'name': obj.name,
            'is_active': bool(obj.is_active),
            'ai_provider': str(obj.ai_provider or '').strip().lower(),
            'ai_model': str(obj.ai_model or '').strip(),
            'effective_ai_model': obj.get_effective_ai_model(),
            'allow_env_fallback': bool(obj.allow_env_fallback),
            'ai_api_key_configured': obj.ai_api_key_configured,
            'notes': str(obj.notes or ''),
            'governance_delta_thresholds': governance_thresholds,
            'prefetch_runtime_settings': prefetch_runtime_settings,
            'prefetch_time_policy': prefetch_time_policy,
        }

    if request.method == 'GET':
        return Response({'ok': True, 'settings': _serialize(settings_obj)}, status=status.HTTP_200_OK)

    before_snapshot = _snapshot(settings_obj)

    provider = str(request.data.get('ai_provider') or settings_obj.ai_provider or 'openclaw').strip().lower()
    model = str(request.data.get('ai_model') or '').strip()
    notes = str(request.data.get('notes') or settings_obj.notes or '').strip()
    allow_env_fallback = bool(request.data.get('allow_env_fallback', settings_obj.allow_env_fallback))
    is_active = bool(request.data.get('is_active', settings_obj.is_active))
    raw_key = request.data.get('ai_api_key', None)
    governance_thresholds_payload = request.data.get('governance_delta_thresholds', None)
    prefetch_runtime_settings_payload = request.data.get('prefetch_runtime_settings', None)
    prefetch_time_policy_payload = request.data.get('prefetch_time_policy', None)

    if not is_valid_provider(provider):
        return Response({'ok': False, 'message': 'AI provider không hợp lệ.'}, status=status.HTTP_400_BAD_REQUEST)

    effective_model = model or settings_obj.get_effective_ai_model()
    if effective_model and not is_valid_model(provider, effective_model):
        return Response({'ok': False, 'message': 'AI model không hợp lệ cho provider đã chọn.'}, status=status.HTTP_400_BAD_REQUEST)
    if effective_model and not is_model_allowed_for_capability(provider, effective_model, ADVISORY_CAPABILITY):
        return Response({'ok': False, 'message': 'AI model này chưa được hỗ trợ cho advisory runtime hiện tại.'}, status=status.HTTP_400_BAD_REQUEST)

    settings_obj.ai_provider = provider
    settings_obj.ai_model = model
    settings_obj.notes = notes
    settings_obj.allow_env_fallback = allow_env_fallback
    settings_obj.is_active = is_active
    if raw_key is not None:
        settings_obj.set_ai_api_key(str(raw_key or '').strip())

    try:
        if governance_thresholds_payload is not None:
            _set_runtime_governance_delta_thresholds(governance_thresholds_payload)
        if prefetch_runtime_settings_payload is not None:
            _set_runtime_prefetch_settings(prefetch_runtime_settings_payload)
        if prefetch_time_policy_payload is not None:
            _set_runtime_prefetch_time_policy(prefetch_time_policy_payload)
        settings_obj.full_clean()
        settings_obj.save()
    except (ValidationError, ValueError) as exc:
        return Response({'ok': False, 'message': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    after_snapshot = _snapshot(settings_obj)
    if before_snapshot != after_snapshot:
        SystemAISettingsAuditLog.objects.create(
            settings=settings_obj,
            actor=request.user if request.user.is_authenticated else None,
            action='update_settings',
            reason='updated_via_admin_api',
            before_json=before_snapshot,
            after_json=after_snapshot,
        )

    return Response(
        {
            'ok': True,
            'message': 'Đã cập nhật System AI Settings.',
            'settings': _serialize(settings_obj),
        },
        status=status.HTTP_200_OK,
    )


@api_view(['POST'])
@permission_classes([IsAdminUser])
def admin_system_ai_test_connection_api(request):
    """
    POST /api/admin-ops/system-ai-settings/test-connection/
    Admin-only: kiểm tra kết nối theo System AI Settings hiện hành.
    """
    from .ai_runtime_config import resolve_ai_runtime_config
    from .ai_service import test_ai_connection
    from .models import SystemAISettings, SystemAISettingsAuditLog

    settings_obj = SystemAISettings.get_active()
    if settings_obj is None:
        return Response(
            {
                'ok': False,
                'message': 'Chưa có System AI Settings để test kết nối.',
                'reason': 'missing_system_ai_settings',
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    runtime_cfg = resolve_ai_runtime_config(user=None, system_settings=settings_obj)
    if not runtime_cfg.get('ready'):
        SystemAISettingsAuditLog.objects.create(
            settings=settings_obj,
            actor=request.user if request.user.is_authenticated else None,
            action='test_connection_failed',
            reason=str(runtime_cfg.get('reason') or 'runtime_not_ready'),
            before_json={
                'provider': runtime_cfg.get('provider'),
                'model': runtime_cfg.get('model'),
            },
            after_json={'ready': False},
        )
        return Response(
            {
                'ok': False,
                'message': runtime_cfg.get('message') or 'System AI runtime chưa sẵn sàng.',
                'reason': runtime_cfg.get('reason') or 'runtime_not_ready',
                'provider': runtime_cfg.get('provider'),
                'model': runtime_cfg.get('model'),
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    payload = test_ai_connection(
        provider=str(runtime_cfg.get('provider') or ''),
        model=str(runtime_cfg.get('model') or ''),
        api_key=str(runtime_cfg.get('api_key') or ''),
    )
    SystemAISettingsAuditLog.objects.create(
        settings=settings_obj,
        actor=request.user if request.user.is_authenticated else None,
        action='test_connection_success' if payload.get('ok') else 'test_connection_failed',
        reason=str(payload.get('message') or ''),
        before_json={
            'provider': runtime_cfg.get('provider'),
            'model': runtime_cfg.get('model'),
        },
        after_json={
            'ok': bool(payload.get('ok')),
            'prompt_tokens': int(payload.get('prompt_tokens') or 0),
            'completion_tokens': int(payload.get('completion_tokens') or 0),
        },
    )
    status_code = status.HTTP_200_OK if payload.get('ok') else status.HTTP_400_BAD_REQUEST
    return Response(payload, status=status_code)


@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_system_ai_audit_logs_api(request):
    """
    GET /api/admin-ops/system-ai-settings/audit-logs/
    Admin-only: xem lịch sử thay đổi/test của System AI Settings.
    """
    from .models import SystemAISettingsAuditLog

    from django.utils.dateparse import parse_datetime

    limit = max(1, min(int(request.query_params.get('limit', 50)), 200))
    offset = max(0, int(request.query_params.get('offset', 0)))
    action = str(request.query_params.get('action') or '').strip().lower()
    actor_username = str(request.query_params.get('actor') or '').strip()
    start_at_raw = str(request.query_params.get('start_at') or '').strip()
    end_at_raw = str(request.query_params.get('end_at') or '').strip()
    order = str(request.query_params.get('order') or 'desc').strip().lower()
    if order not in {'asc', 'desc'}:
        return Response({'ok': False, 'message': 'order chỉ hỗ trợ asc hoặc desc.'}, status=status.HTTP_400_BAD_REQUEST)

    ordering = 'created_at' if order == 'asc' else '-created_at'
    logs_qs = SystemAISettingsAuditLog.objects.select_related('actor', 'settings').order_by(ordering)
    if action:
        logs_qs = logs_qs.filter(action=action)
    if actor_username:
        logs_qs = logs_qs.filter(actor__username__iexact=actor_username)

    if start_at_raw:
        start_at = parse_datetime(start_at_raw)
        if not start_at:
            return Response({'ok': False, 'message': 'start_at không đúng định dạng ISO datetime.'}, status=status.HTTP_400_BAD_REQUEST)
        logs_qs = logs_qs.filter(created_at__gte=start_at)

    if end_at_raw:
        end_at = parse_datetime(end_at_raw)
        if not end_at:
            return Response({'ok': False, 'message': 'end_at không đúng định dạng ISO datetime.'}, status=status.HTTP_400_BAD_REQUEST)
        logs_qs = logs_qs.filter(created_at__lte=end_at)

    total = logs_qs.count()
    logs = list(logs_qs[offset: offset + limit])

    payload = []
    for log in logs:
        payload.append(
            {
                'id': log.id,
                'created_at': log.created_at.isoformat() if log.created_at else None,
                'action': log.action,
                'reason': log.reason,
                'actor': log.actor.username if log.actor_id else None,
                'settings_id': log.settings_id,
                'before_json': log.before_json,
                'after_json': log.after_json,
            }
        )

    return Response(
        {
            'ok': True,
            'count': len(payload),
            'total': total,
            'offset': offset,
            'limit': limit,
            'order': order,
            'has_more': (offset + len(payload)) < total,
            'results': payload,
        },
        status=status.HTTP_200_OK,
    )


@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_vnstock_runtime_config_current_api(request):
    """GET /api/admin-ops/vnstock-config/current/"""
    from .models import RuntimeVnstockConfig
    from .serializers import RuntimeVnstockConfigSerializer
    from .vnstock_runtime_config import coerce_vnstock_runtime_settings, default_vnstock_runtime_settings

    config = RuntimeVnstockConfig.get_or_create_singleton()
    defaults = default_vnstock_runtime_settings()
    normalized = coerce_vnstock_runtime_settings(config.to_runtime_dict(), fallback=defaults)
    for key, value in normalized.items():
        setattr(config, key, value)

    serializer = RuntimeVnstockConfigSerializer(config)
    return Response(
        {
            'ok': True,
            'settings': serializer.data,
            'rulebook': {
                'max_concurrency': {'min': 1, 'max': 50},
                'retry_attempts': {'min': 0, 'max': 5},
                'retry_backoff_seconds': {'min': 0.0, 'max': 5.0},
                'rate_limit_cooldown_seconds': {'min': 5, 'max': 120},
                'timeout_seconds': {'min': 1, 'max': 120},
                'allowed_sources': ['VCI', 'KBS', 'TCBS', 'SSI'],
            },
        },
        status=status.HTTP_200_OK,
    )


@api_view(['PATCH'])
@permission_classes([IsAdminUser])
def admin_vnstock_runtime_config_update_api(request):
    """PATCH /api/admin-ops/vnstock-config/update-config/"""
    from .models import RuntimeVnstockConfig
    from .serializers import RuntimeVnstockConfigSerializer
    from .vnstock_runtime_config import invalidate_vnstock_runtime_cache

    config = RuntimeVnstockConfig.get_or_create_singleton()
    before = config.to_runtime_dict()

    serializer = RuntimeVnstockConfigSerializer(config, data=request.data or {}, partial=True)
    if not serializer.is_valid():
        return Response(
            {
                'ok': False,
                'message': 'Dữ liệu cấu hình không hợp lệ.',
                'field_errors': serializer.errors,
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    updated_config = serializer.save(updated_by=request.user)
    after = updated_config.to_runtime_dict()

    changes = {}
    for key, old_value in before.items():
        new_value = after.get(key)
        if old_value != new_value:
            changes[key] = {'before': old_value, 'after': new_value}

    if changes:
        updated_config.append_changelog(actor=request.user, changes=changes, reason='update_config')
        updated_config.save(update_fields=['changelog', 'updated_at'])

    invalidate_vnstock_runtime_cache()
    return Response(
        {
            'ok': True,
            'message': 'Đã cập nhật Runtime Vnstock Config.',
            'settings': RuntimeVnstockConfigSerializer(updated_config).data,
        },
        status=status.HTTP_200_OK,
    )


@api_view(['POST'])
@permission_classes([IsAdminUser])
def admin_vnstock_runtime_config_reset_api(request):
    """POST /api/admin-ops/vnstock-config/reset-to-defaults/"""
    from .models import RuntimeVnstockConfig
    from .serializers import RuntimeVnstockConfigSerializer
    from .vnstock_runtime_config import default_vnstock_runtime_settings, invalidate_vnstock_runtime_cache

    defaults = default_vnstock_runtime_settings()
    config = RuntimeVnstockConfig.get_or_create_singleton()

    for key, value in defaults.items():
        setattr(config, key, value)
    config.updated_by = request.user
    config.full_clean()
    config.save()

    config.append_changelog(actor=request.user, changes={'reset': True}, reason='reset_to_defaults')
    config.save(update_fields=['changelog', 'updated_at'])
    invalidate_vnstock_runtime_cache()

    return Response(
        {
            'ok': True,
            'message': 'Đã reset Runtime Vnstock Config về mặc định.',
            'settings': RuntimeVnstockConfigSerializer(config).data,
        },
        status=status.HTTP_200_OK,
    )


@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_vnstock_runtime_config_changelog_api(request):
    """GET /api/admin-ops/vnstock-config/changelog/"""
    from .models import RuntimeVnstockConfig

    limit = max(1, min(int(request.query_params.get('limit', 30)), 200))
    offset = max(0, int(request.query_params.get('offset', 0)))

    config = RuntimeVnstockConfig.get_or_create_singleton()
    items = list(config.changelog or [])
    total = len(items)
    rows = items[offset: offset + limit]

    return Response(
        {
            'ok': True,
            'count': len(rows),
            'total': total,
            'offset': offset,
            'limit': limit,
            'has_more': offset + len(rows) < total,
            'results': rows,
        },
        status=status.HTTP_200_OK,
    )


@api_view(['POST'])
@permission_classes([IsAdminUser])
def warm_ticker_prefetch_api(request):
    """
    POST /api/admin-ops/prefetch/warm/
    Trigger warm cache ticker thủ công từ giao diện admin/dashboard.

    Query/body:
      - mode=async (mặc định): queue Celery task ngay lập tức.
      - mode=sync: chạy ngay trong request để debug/verify.
    """
    from config.health import build_prefetch_health_snapshot
    from portfolio.tasks import prefetch_ticker_price_board

    mode = str(request.query_params.get('mode') or request.data.get('mode') or 'async').strip().lower()

    if mode == 'sync':
        result = prefetch_ticker_price_board.run()
        snapshot = build_prefetch_health_snapshot()
        ok = result.get('status') == 'ok'
        return Response(
            {
                'queued': False,
                'mode': 'sync',
                'result': result,
                'prefetch': snapshot,
            },
            status=status.HTTP_200_OK if ok else status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    task = prefetch_ticker_price_board.apply_async(countdown=0)
    return Response(
        {
            'queued': True,
            'mode': 'async',
            'task_id': task.id,
            'prefetch': build_prefetch_health_snapshot(),
        },
        status=status.HTTP_202_ACCEPTED,
    )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def ai_options_api(request):
    """GET /api/ai-options/ - provider/model khả dụng cho frontend dropdown."""
    from .ai_options import ADVISORY_CAPABILITY, AVAILABLE_MODELS, MODEL_CATALOG, get_default_model, get_model_entries

    return Response(
        {
            'providers': AVAILABLE_MODELS,
            'defaults': {provider: get_default_model(provider) for provider in AVAILABLE_MODELS.keys()},
            'model_catalog': {
                provider: get_model_entries(provider)
                for provider in MODEL_CATALOG.keys()
            },
            'scope': ADVISORY_CAPABILITY,
        },
        status=status.HTTP_200_OK,
    )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def ai_test_connection_api(request):
    """POST /api/ai-config/test-connection/ - kiểm tra provider/model/api key trước khi lưu."""
    from .ai_options import ADVISORY_CAPABILITY, is_model_allowed_for_capability, is_valid_model, is_valid_provider
    from .ai_service import _resolve_provider_api_key, test_ai_connection

    user_cfg, _ = UserConfig.objects.get_or_create(user=request.user)
    provider = str(request.data.get('ai_provider') or user_cfg.ai_provider or 'openclaw').strip().lower()
    model = str(request.data.get('ai_model') or user_cfg.ai_model or '').strip()
    api_key = str(request.data.get('ai_api_key') or '').strip() or user_cfg.get_ai_api_key()

    if not is_valid_provider(provider):
        return Response({'ok': False, 'message': 'AI provider không hợp lệ.'}, status=status.HTTP_400_BAD_REQUEST)
    if not model:
        return Response({'ok': False, 'message': 'Bạn chưa chọn AI model.'}, status=status.HTTP_400_BAD_REQUEST)
    if not is_valid_model(provider, model):
        return Response({'ok': False, 'message': 'Model không hợp lệ cho provider đã chọn.'}, status=status.HTTP_400_BAD_REQUEST)
    if not is_model_allowed_for_capability(provider, model, ADVISORY_CAPABILITY):
        return Response({'ok': False, 'message': 'Model này chưa được hỗ trợ cho AI advisory hiện tại.'}, status=status.HTTP_400_BAD_REQUEST)
    if not _resolve_provider_api_key(provider, api_key):
        return Response({'ok': False, 'message': 'Bạn chưa cấu hình API key cho provider đã chọn.'}, status=status.HTTP_400_BAD_REQUEST)

    payload = test_ai_connection(provider=provider, model=model, api_key=api_key)
    return Response(payload, status=status.HTTP_200_OK if payload.get('ok') else status.HTTP_400_BAD_REQUEST)


def _get_ai_runtime_config_status(user_cfg) -> dict:
    from .ai_runtime_config import resolve_ai_runtime_config

    runtime_cfg = resolve_ai_runtime_config(user=getattr(user_cfg, 'user', None))
    provider = str(runtime_cfg.get('provider') or '').strip().lower()
    model = str(runtime_cfg.get('model') or '').strip()
    source = runtime_cfg.get('source')
    ready = bool(runtime_cfg.get('ready'))
    reason = runtime_cfg.get('reason')
    message = str(runtime_cfg.get('message') or '').strip()

    if ready:
        return {
            'provider': provider,
            'model': model,
            'source': source,
            'has_key': True,
            'ready': True,
            'reason': None,
            'message': '',
        }

    if not message:
        message = 'AI runtime chưa sẵn sàng. Vui lòng kiểm tra User AI hoặc System AI Settings.'

    return {
        'provider': provider,
        'model': model,
        'source': source,
        'has_key': False,
        'ready': False,
        'reason': reason,
        'message': message,
    }


@api_view(['GET', 'PUT'])
@permission_classes([IsAuthenticated])
def ai_config_api(request):
    """GET/PUT /api/ai-config/ - đọc/cập nhật cấu hình AI cho user hiện tại."""
    from .ai_service import _resolve_provider_api_key

    user_cfg, _ = UserConfig.objects.get_or_create(user=request.user)

    def _has_effective_ai_key(provider: str) -> bool:
        return bool(_resolve_provider_api_key(provider, user_cfg.get_ai_api_key()))

    ai_status = _get_ai_runtime_config_status(user_cfg)

    if request.method == 'GET':
        return Response(
            {
                'ai_provider': user_cfg.ai_provider,
                'ai_model': str(user_cfg.ai_model or '').strip(),
                'ai_api_key_configured': _has_effective_ai_key(user_cfg.ai_provider),
                'ai_ready': ai_status['ready'],
                'ai_config_message': ai_status['message'],
                'effective_ai_provider': ai_status['provider'],
                'effective_ai_model': ai_status['model'],
                'effective_ai_source': ai_status.get('source'),
            },
            status=status.HTTP_200_OK,
        )

    provider = str(request.data.get('ai_provider') or user_cfg.ai_provider or 'openclaw').strip().lower()
    model = str(request.data.get('ai_model') or '').strip()
    api_key = request.data.get('ai_api_key', None)

    from .ai_options import ADVISORY_CAPABILITY, is_model_allowed_for_capability, is_valid_model, is_valid_provider

    if not is_valid_provider(provider):
        return Response({'ok': False, 'message': 'AI provider không hợp lệ.'}, status=status.HTTP_400_BAD_REQUEST)

    if not model:
        return Response({'ok': False, 'message': 'Bạn chưa chọn AI model.'}, status=status.HTTP_400_BAD_REQUEST)
    if not is_valid_model(provider, model):
        return Response({'ok': False, 'message': 'Model không hợp lệ cho provider đã chọn.'}, status=status.HTTP_400_BAD_REQUEST)
    if not is_model_allowed_for_capability(provider, model, ADVISORY_CAPABILITY):
        return Response({'ok': False, 'message': 'Model này chưa được hỗ trợ cho AI advisory hiện tại.'}, status=status.HTTP_400_BAD_REQUEST)

    user_cfg.ai_provider = provider
    user_cfg.ai_model = model
    if api_key is not None:
        user_cfg.set_ai_api_key(str(api_key or '').strip())
    user_cfg.save()

    return Response(
        {
            'ok': True,
            'message': 'Đã cập nhật cấu hình AI.',
            'ai_provider': user_cfg.ai_provider,
            'ai_model': str(user_cfg.ai_model or '').strip(),
            'ai_api_key_configured': _has_effective_ai_key(user_cfg.ai_provider),
            'ai_ready': _get_ai_runtime_config_status(user_cfg)['ready'],
            'ai_config_message': _get_ai_runtime_config_status(user_cfg)['message'],
            'effective_ai_provider': _get_ai_runtime_config_status(user_cfg)['provider'],
            'effective_ai_model': _get_ai_runtime_config_status(user_cfg)['model'],
            'effective_ai_source': _get_ai_runtime_config_status(user_cfg).get('source'),
        },
        status=status.HTTP_200_OK,
    )

# SecuritiesGroup List API
class SecuritiesGroupListView(generics.ListAPIView):
    serializer_class = SecuritiesGroupDetailSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return SecuritiesGroup.objects.all()

# SecuritiesItem List API (liệt kê các mã trong group)
class SecuritiesItemListView(generics.ListAPIView):
    serializer_class = SecuritiesItemSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        group_id = self.kwargs['pk']
        return SecuritiesItem.objects.filter(group_id=group_id)
"""
views.py — DRF API Views.

Endpoints:
  GET/POST   /api/portfolio/portfolios/
  GET/PUT/DELETE /api/portfolio/portfolios/{id}/
  GET/POST   /api/portfolio/portfolios/{id}/transactions/
  GET/PUT/DELETE /api/transactions/{id}/
  GET        /api/portfolio/portfolios/{id}/holdings/
  GET        /api/portfolio/portfolios/{id}/summary/
  GET        /api/portfolio/portfolios/{id}/chart/
  POST       /api/portfolio/portfolios/{id}/sync/
  GET/PUT    /api/portfolio/userconfig/ (UserConfig)
"""

from decimal import Decimal
from datetime import date, datetime, time, timedelta
import base64
import json
import re
import concurrent.futures as _cf
import logging
import os

logger = logging.getLogger(__name__)


from django.db.models import Case, ExpressionWrapper, F, FloatField, IntegerField, Max, Min, Q, Sum, When
from django.conf import settings
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.core.cache import cache
from django.views.decorators.csrf import csrf_exempt
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.throttling import ScopedRateThrottle
from django.contrib.auth.models import User
import redis as redis_lib
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from .models import Portfolio, Transaction, DailyPrice, IntradayTick, OrderFlowSignal, AIAdvisoryComponentRecord, AIAdvisoryExecutiveSummary, AdvisoryAggregateAuditLog, AdvisoryAggregateSnapshot, AdvisoryTokenLog, SecuritiesGroup, SecuritiesItem, TrackedSymbol, UserConfig, SubAccount, WatchlistGroup, WatchlistItem, StockProfile, PriceAlertRule, MarketGroupSyncLog, StockProfileSyncLog, WhaleAdvisory
from .serializers import (
    PortfolioSerializer, TransactionSerializer, UserConfigSerializer, SubAccountSerializer,
    HoldingSerializer, SummarySerializer, ChartPointSerializer,
    SecuritiesGroupCreateSerializer, SecuritiesGroupDetailSerializer, SecuritiesItemSerializer,
    TrackedSymbolSerializer, WatchlistGroupSerializer, WatchlistItemSerializer, StockProfileSerializer,
    PriceAlertRuleSerializer, StockWorkspaceChartPointSerializer, StockWorkspaceChartResponseSerializer,
    StockWorkspaceGroupRefSerializer, StockWorkspaceOverviewSerializer,
    StockWorkspaceTechnicalSerializer, StockWorkspaceWatchlistMembershipSerializer,
    WhaleAdvisorySerializer, AIAdvisoryComponentRecordSerializer, AIAdvisoryExecutiveSummarySerializer,
    StockAIChartContextSerializer,
)

from .services import (
    fetch_and_save_daily_prices, sync_portfolio_prices, get_latest_price,
    get_price_changes, get_price_series, sync_market_groups, sync_market_groups_for_user, sync_stock_profiles, sync_watchlist_prices,
)
from .permissions import IsProPlan, _get_plan, resolve_user_entitlements
from .quota_service import build_quota_exceeded_payload, consume_quota
from .opencore_dpi import check_feature_access
from .opencore_analytics import track_api_call
from .whale_scoring import calculate_display_score, calculate_event_score, resolve_whale_score_config
from .adapters.vnstock_adapter import (
    fetch_financial_ratio_dataframe,
    fetch_history_dataframe,
    fetch_intraday_dataframe,
    fetch_listing_symbols_dataframe,
    fetch_price_board_dataframe,
)
from .exceptions import ExternalSystemException, MarketDataValidationException
from .market_data_service import market_data_service
from .stock_workspace_helpers import (
    _build_stock_workspace_overview,
    _compute_ema,
    _compute_macd_hist,
    _compute_rsi,
    _compute_stock_workspace_technical,
    _get_exchange_price_band,
    _safe_round,
    _technical_bias_meta,
    _to_float,
)
from .whale_feed_helpers import (
    _allow_vnstock_aggregate_fallback,
    _build_aggregate_event_payload,
    _build_aggregate_event_payload_from_record,
    _build_stream_aggregate_records,
    _build_tick_timestamp,
    _build_vnstock_aggregate_records,
    _build_whale_order_payload,
    _cache_get,
    _cache_set,
    _classify_signal_size,
    _dataframe_has_threshold_hits,
    _decode_whale_feed_cursor,
    _encode_whale_feed_cursor,
    _get_user_whale_threshold_vnd,
    _is_event_timestamp_in_window,
    _is_tick_row_in_window,
    _get_user_symbol_threshold_overrides_vnd,
    _is_rate_limited_error,
    _is_vnstock_rate_limited,
    _mark_vnstock_rate_limited,
    _normalize_aggregate_event_records,
    _normalize_signal_side,
    _parse_aggregate_window,
    _parse_cursor_datetime,
    _parse_cursor_matched_value,
    _resolve_user_whale_threshold_vnd,
    _resolve_whale_feed_symbols,
    _vnstock_rate_limit_cache_key,
)
from .ai_advisory_helpers import (
    _sprint17_build_component_templates,
    _sprint17_compute_summary_from_components,
    _sprint17_enforce_summary_narrative_policy,
    _sprint17_extract_json_block,
    _sprint17_generate_component_templates_with_ai,
    _sprint17_generate_executive_synthesis_with_ai,
    _sprint17_normalize_ai_component_payload,
    _sprint17_serialize_stock_advisory_session,
    _sprint17_suggested_action_from_status,
)
from .view_helpers import (
    _build_group_response,
    _build_price_alert_rule_row,
    _price_alert_is_triggered,
)
from .screener_helpers import (
    _SCREENER_ALLOWED_FIELDS,
    _SCREENER_ALLOWED_OPS,
    _apply_screener_condition,
    _screener_build_technical,
    _validate_screener_rules,
)

from .analytics import (
    compute_holdings, compute_nav_series, compute_allocation, build_summary,
    build_risk_metrics, compute_allocation_by_sector,
)

from .views_portfolio_watchlist import (
    AllocationView,
    ChartDataView,
    EquityCurveView,
    HoldingsView,
    PortfolioAnalyticsView,
    PortfolioDetailView,
    PortfolioListCreateView,
    SubAccountDetailView,
    SubAccountListCreateView,
    SummaryView,
    SyncPricesView,
    TransactionDetailView,
    TransactionListCreateView,
    UserConfigView,
    WatchlistGroupDetailView,
    WatchlistGroupListCreateView,
    WatchlistItemCreateView,
    WatchlistItemDeleteView,
    WatchlistSeedView,
    WatchlistSyncView,
    _acquire_sync_cooldown,
)
from .views_stock_management import (
    PriceAlertRuleDetailView,
    PriceAlertRuleListCreateView,
    PriceAlertRuleTriggerView,
    SecuritiesGroupDetailView,
    SecuritiesGroupListCreateView,
    SecuritiesItemCreateView,
    SecuritiesItemDeleteView,
    SecuritiesSeedView,
    SecuritiesSyncView,
    TrackedSymbolBulkThresholdView,
    TrackedSymbolDeleteView,
    TrackedSymbolListCreateView,
    _parse_tracked_symbol_threshold_million,
)
from .views_screener import (
    ScreenerRuleDetailView,
    ScreenerRuleListCreateView,
    ScreenerRuleRunView,
)
from .views_stock_workspace_admin import (
    AdminOpsStatsView,
    StockProfileDetailView,
    StockWorkspaceChartView,
    StockWorkspaceOverviewView,
)
from .views_realtime_core import (
    IntradayMatchedView,
    PriceBoardView,
    RealtimeTickerView,
    SectorBreadthView,
)
from .views_realtime_advanced import (
    RVOLView,
    WhaleFeedView,
)
from .views_realtime_aggregate_campaigns import (
    WhaleCampaignsView,
    WhaleFeedAggregateView,
)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def whale_symbol_summary_api(request, symbol: str):
    """
    GET /api/realtime/whale-symbol-summary/<symbol>/
    
    Get comprehensive whale event summary for a symbol including:
    - Latest campaign info
    - Today's buy/sell bias
    - Net value flow
    - Abnormality context
    - Baseline metrics
    """
    try:
        normalized_symbol = (symbol or '').strip().upper()
        if not normalized_symbol or len(normalized_symbol) > 10:
            return Response(
                {'detail': 'Thiếu mã chứng khoán.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        from .baseline_service import BaselineService
        baseline_svc = BaselineService()
        summary = baseline_svc.get_whale_symbol_summary(normalized_symbol, window='session')
        
        return Response(summary)
    except Exception:
        logger.exception(f'whale_symbol_summary_api error for {symbol}')
        return Response(
            {'detail': 'Lỗi khi lấy thông tin tóm tắt whale.'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


class DepthChartView(APIView):
    """
    GET /api/realtime/depth-chart/<symbol>/
    Tính độ sâu tích lũy từ price_board để vẽ depth chart (bid/ask mountains).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, symbol):
        normalized_symbol = (symbol or '').strip().upper()
        if not normalized_symbol:
            return Response({'detail': 'Thiếu mã chứng khoán.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            df = fetch_price_board_dataframe([normalized_symbol], anchor_symbol=normalized_symbol)
        except ExternalSystemException as exc:
            logger.warning('DepthChartView lỗi vnstock %s: %s', normalized_symbol, exc)
            return Response({'detail': f'Không lấy được dữ liệu: {exc.message}'}, status=status.HTTP_502_BAD_GATEWAY)

        if df is None or df.empty:
            return Response({'symbol': normalized_symbol, 'bids': [], 'asks': [], 'walls': [], 'reference_price': None})

        def safe_f(val):
            try:
                v = float(val)
                return v if v == v else None
            except (TypeError, ValueError):
                return None

        def safe_i(val):
            try:
                v = float(val)
                return int(v) if v == v else None
            except (TypeError, ValueError):
                return None

        ba = df['bid_ask'].iloc[0]
        mt = df['match'].iloc[0]

        ref_price = safe_f(mt.get('reference_price')) or 0
        ceil_price = safe_f(mt.get('ceiling_price')) or (ref_price * 1.07 if ref_price else None)
        floor_price = safe_f(mt.get('floor_price')) or (ref_price * 0.93 if ref_price else None)

        bids = []
        cum_bid = 0
        for i in range(1, 4):
            bp = safe_f(ba.get(f'bid_{i}_price'))
            bv = safe_i(ba.get(f'bid_{i}_volume'))
            if bp and bv:
                cum_bid += bv
                bids.append({'price': bp, 'volume': bv, 'cumulative': cum_bid})

        asks = []
        cum_ask = 0
        for i in range(1, 4):
            ap = safe_f(ba.get(f'ask_{i}_price'))
            av = safe_i(ba.get(f'ask_{i}_volume'))
            if ap and av:
                cum_ask += av
                asks.append({'price': ap, 'volume': av, 'cumulative': cum_ask})

        all_vols = [b['volume'] for b in bids] + [a['volume'] for a in asks]
        avg_vol = sum(all_vols) / len(all_vols) if all_vols else 1
        wall_threshold = avg_vol * 2

        walls = []
        for b in bids:
            if b['volume'] >= wall_threshold:
                walls.append({'side': 'bid', 'price': b['price'], 'volume': b['volume'],
                               'label': f'⚠️ TƯỜNG MUA: {b["volume"]:,}'})
        for a in asks:
            if a['volume'] >= wall_threshold:
                walls.append({'side': 'ask', 'price': a['price'], 'volume': a['volume'],
                               'label': f'⚠️ TƯỜNG BÁN: {a["volume"]:,}'})

        return Response({
            'symbol': normalized_symbol,
            'reference_price': ref_price,
            'ceiling_price': ceil_price,
            'floor_price': floor_price,
            'bids': bids,
            'asks': asks,
            'walls': walls,
            'fetched_at': timezone.now().isoformat(),
        })


# ---------------------------------------------------------------------------
# Financial Metrics View
# ---------------------------------------------------------------------------

class FinancialMetricsView(APIView):
    """
    GET /api/stock-management/stocks/<symbol>/financials/
    Trả về chỉ tiêu tài chính theo năm (tối đa 5 năm gần nhất).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, symbol):
        normalized_symbol = (symbol or '').strip().upper()
        if not normalized_symbol:
            return Response({'detail': 'Thiếu mã chứng khoán.'}, status=status.HTTP_400_BAD_REQUEST)

        cache_key = f'financials:{normalized_symbol}'
        cached = _cache_get(cache_key)
        if cached is not None:
            return Response(cached)

        try:
            df = fetch_financial_ratio_dataframe(
                normalized_symbol,
                period='year',
                lang='vi',
                dropna=True,
                source='VCI',
            )
        except ExternalSystemException as exc:
            logger.warning('FinancialMetricsView lỗi vnstock %s: %s', normalized_symbol, exc)
            if exc.code == 'vnstock_missing':
                return Response({'detail': str(exc.message)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
            return Response(
                {
                    'symbol': normalized_symbol,
                    'years': [],
                    'source': 'vnstock_unavailable',
                    'fetched_at': timezone.now().isoformat(),
                }
            )
        except Exception as exc:
            logger.exception('FinancialMetricsView unexpected lỗi %s: %s', normalized_symbol, exc)
            return Response(
                {
                    'symbol': normalized_symbol,
                    'years': [],
                    'source': 'error',
                    'fetched_at': timezone.now().isoformat(),
                }
            )

        if df is None or df.empty:
            return Response({'symbol': normalized_symbol, 'years': []})

        def _f(row, key):
            val = row.get(key)
            if val is None:
                return None
            try:
                v = float(val)
                return round(v, 4) if v == v else None
            except (TypeError, ValueError):
                return None

        def _parse_year(value):
            if value is None:
                return None
            try:
                return int(float(value))
            except (TypeError, ValueError):
                match = re.search(r'\d{4}', str(value))
                return int(match.group(0)) if match else None

        years = []
        try:
            for _, row in df.head(5).iterrows():
                year_val = row.get(('Meta', 'Năm')) or row.get('Năm') or row.get('year')
                years.append({
                    'year': _parse_year(year_val),
                    # Định giá
                    'eps':         _f(row, ('Chỉ tiêu định giá', 'EPS (VND)')),
                    'pe':          _f(row, ('Chỉ tiêu định giá', 'P/E')),
                    'pb':          _f(row, ('Chỉ tiêu định giá', 'P/B')),
                    'ps':          _f(row, ('Chỉ tiêu định giá', 'P/S')),
                    'bvps':        _f(row, ('Chỉ tiêu định giá', 'BVPS (VND)')),
                    'market_cap_bn': _f(row, ('Chỉ tiêu định giá', 'Vốn hóa (Tỷ đồng)')),
                    # Sinh lời
                    'roe':           _f(row, ('Chỉ tiêu khả năng sinh lợi', 'ROE (%)')),
                    'roa':           _f(row, ('Chỉ tiêu khả năng sinh lợi', 'ROA (%)')),
                    'net_margin':    _f(row, ('Chỉ tiêu khả năng sinh lợi', 'Biên lợi nhuận ròng (%)')),
                    'dividend_yield': _f(row, ('Chỉ tiêu khả năng sinh lợi', 'Tỷ suất cổ tức (%)')),
                    # Thanh khoản / đòn bẩy
                    'leverage':      _f(row, ('Chỉ tiêu thanh khoản', 'Đòn bẩy tài chính')),
                    'current_ratio': _f(row, ('Chỉ tiêu thanh khoản', 'Hệ số thanh toán hiện hành')),
                    'quick_ratio':   _f(row, ('Chỉ tiêu thanh khoản', 'Hệ số thanh toán nhanh')),
                    'debt_equity':   _f(row, ('Chỉ tiêu thanh khoản', 'Nợ/Vốn chủ sở hữu')),
                })
        except Exception as exc:
            logger.exception('FinancialMetricsView parse lỗi %s: %s', normalized_symbol, exc)
            return Response({'detail': 'Không parse được dữ liệu tài chính từ nguồn realtime.'}, status=status.HTTP_502_BAD_GATEWAY)

        result = {
            'symbol': normalized_symbol,
            'years': years,
            'fetched_at': timezone.now().isoformat(),
        }
        _cache_set(cache_key, result, timeout=21600)  # 6 giờ
        return Response(result)


# ---------------------------------------------------------------------------
# WhaleAdvisory — Tư vấn AI từ OpenClaw
# ---------------------------------------------------------------------------
class WhaleAdvisoryListView(generics.ListAPIView):
    """
    GET /api/portfolio/whale-advisory/
    Pro+: trả về danh sách advisory (ẩn ai_detail nếu chưa Premium).
    """
    permission_classes = [IsAuthenticated, IsProPlan]
    serializer_class = WhaleAdvisorySerializer

    def get_queryset(self):
        # Return only user-owned advisories (no legacy fallback)
        # Legacy records with user=NULL should not appear in user-facing lists
        qs = (
            WhaleAdvisory.objects
            .filter(user=self.request.user)
            .order_by('-created_at')
        )

        refresh_status = str(self.request.query_params.get('refresh_status') or '').strip().lower()
        now = timezone.now()
        if refresh_status == 'ready':
            qs = qs.filter(next_refresh_at__isnull=False, next_refresh_at__lte=now)
        elif refresh_status == 'pending':
            qs = qs.filter(next_refresh_at__isnull=False, next_refresh_at__gt=now)
        elif refresh_status == 'recent':
            cutoff = now - timedelta(hours=4)
            qs = qs.filter(created_at__gte=cutoff)

        # ?watchlist_only=true: chỉ trả advisory cho mã trong TrackedSymbol của user
        watchlist_only = str(self.request.query_params.get('watchlist_only') or '').strip().lower()
        if watchlist_only == 'true':
            tracked_symbols = TrackedSymbol.objects.filter(user=self.request.user).values_list('symbol', flat=True)
            qs = qs.filter(symbol__in=tracked_symbols)

        # FIX: Get latest advisory per symbol (not just first 100 globally)
        # This ensures canonical contract returns latest advisory for each symbol
        # even if that symbol's latest falls outside the global 100 limit
        seen_symbols = set()
        result = []
        for advisory in qs:
            symbol = str(advisory.symbol or '').strip().upper()
            if symbol and symbol not in seen_symbols:
                seen_symbols.add(symbol)
                result.append(advisory)
                if len(result) >= 100:  # Limit to 100 symbols max
                    break
        return result

    def list(self, request, *args, **kwargs):
        qs = self.get_queryset()
        plan = _get_plan(request.user)
        contract = str(request.query_params.get('contract') or '').strip().lower()

        if contract == 'canonical':
            user_cfg, _ = UserConfig.objects.get_or_create(user=request.user)
            # qs already contains one advisory per symbol (latest for each)
            items = []
            for advisory in qs:
                items.append(_build_advisory_canonical_payload(request.user, advisory, user_cfg=user_cfg))
            return Response({'ok': True, 'contract_version': 'canonical_v1', 'items': items})

        data = WhaleAdvisorySerializer(qs, many=True).data
        # Pro: ẩn ai_detail (chỉ Premium+ được xem)
        if plan not in ('premium', 'admin'):
            for item in data:
                item['ai_detail'] = ''
        return Response(data)


def _extract_confidence_from_summary(ai_summary: str) -> float | None:
    summary_text = str(ai_summary or '')
    matched = re.search(r'(\d{1,3})\s*%', summary_text)
    if not matched:
        return None
    try:
        value = float(matched.group(1))
    except (TypeError, ValueError):
        return None
    return max(0.0, min(value, 100.0))


def _build_advisory_canonical_payload(user, advisory: WhaleAdvisory | None, *, user_cfg: UserConfig | None = None) -> dict:
    if advisory is None:
        return {
            'advisory_id': None,
            'symbol': None,
            'created_at': None,
            'source': None,
            'ai_provider': None,
            'ai_model': None,
            'summary_text': '',
            'detail_text': '',
            'confidence': None,
            'risk_level': None,
            'recommendation': None,
            'output_language': str(getattr(user_cfg, 'language', 'vi') or 'vi').strip().lower(),
            'freshness': {'next_refresh_at': None, 'is_stale': False},
        }

    if user_cfg is None:
        user_cfg, _ = UserConfig.objects.get_or_create(user=user)

    plan = _get_plan(user)
    detail_text = str(advisory.ai_detail or '') if plan in ('premium', 'admin') else ''
    next_refresh_at = advisory.next_refresh_at
    if next_refresh_at is None:
        interval_hours = max(int(getattr(user_cfg, 'advisory_refresh_interval_hours', 24) or 24), 1)
        next_refresh_at = advisory.created_at + timedelta(hours=interval_hours)
    now = timezone.now()

    return {
        'advisory_id': advisory.id,
        'symbol': advisory.symbol,
        'created_at': advisory.created_at,
        'source': advisory.source,
        'ai_provider': advisory.ai_provider,
        'ai_model': advisory.ai_model,
        'summary_text': str(advisory.ai_summary or ''),
        'detail_text': detail_text,
        'confidence': _extract_confidence_from_summary(advisory.ai_summary),
        'risk_level': str(advisory.severity or ''),
        'recommendation': str(advisory.side or ''),
        'output_language': str(getattr(user_cfg, 'language', 'vi') or 'vi').strip().lower(),
        'freshness': {
            'next_refresh_at': next_refresh_at,
            'is_stale': bool(next_refresh_at and next_refresh_at <= now),
        },
    }


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsProPlan])
def ai_advisory_canonical_symbol_api(request, symbol: str):
    normalized_symbol = str(symbol or '').strip().upper()
    if not normalized_symbol:
        return Response({'ok': False, 'message': 'Symbol không hợp lệ.'}, status=status.HTTP_400_BAD_REQUEST)

    user_cfg, _ = UserConfig.objects.get_or_create(user=request.user)
    latest = (
        WhaleAdvisory.objects
        .filter(user=request.user, symbol=normalized_symbol)
        .order_by('-created_at')
        .first()
    )

    return Response(
        {
            'ok': True,
            'contract_version': 'canonical_v1',
            'symbol': normalized_symbol,
            'advisory': _build_advisory_canonical_payload(request.user, latest, user_cfg=user_cfg),
        },
        status=status.HTTP_200_OK,
    )


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsProPlan])
def whale_advisory_auto_refresh_info_api(request, symbol: str):
    normalized_symbol = str(symbol or '').strip().upper()
    if not normalized_symbol:
        return Response({'ok': False, 'message': 'Symbol không hợp lệ.'}, status=status.HTTP_400_BAD_REQUEST)

    tracked = TrackedSymbol.objects.filter(user=request.user, symbol=normalized_symbol).first()
    if tracked is None:
        return Response(
            {'ok': False, 'symbol': normalized_symbol, 'message': 'Symbol chưa nằm trong danh sách theo dõi.'},
            status=status.HTTP_404_NOT_FOUND,
        )

    user_cfg, _ = UserConfig.objects.get_or_create(user=request.user)
    latest = WhaleAdvisory.objects.filter(user=request.user, symbol=normalized_symbol).order_by('-created_at').first()
    tokens_today = AdvisoryTokenLog.objects.filter(
        user=request.user,
        created_at__date=timezone.localdate(),
    ).aggregate(total=Sum('tokens_used'))['total'] or 0
    auto_refreshes_today = AdvisoryTokenLog.objects.filter(
        user=request.user,
        source=AdvisoryTokenLog.SourceChoices.AUTO_GENERATION,
        created_at__date=timezone.localdate(),
    ).count()

    response_payload = {
        'ok': True,
        'symbol': normalized_symbol,
        'tracked_since': tracked.added_at,
        'advisory_auto_generation_enabled': bool(user_cfg.advisory_auto_generation_enabled),
        'advisory_manual_refresh_enabled': bool(user_cfg.advisory_manual_refresh_enabled),
        'advisory_refresh_interval_hours': int(user_cfg.advisory_refresh_interval_hours or 24),
        'advisory_max_auto_refreshes_per_day': int(user_cfg.advisory_max_auto_refreshes_per_day or 0),
        'auto_refreshes_used_today': int(auto_refreshes_today),
        'auto_refreshes_remaining_today': max(int(user_cfg.advisory_max_auto_refreshes_per_day or 0) - int(auto_refreshes_today), 0),
        'daily_token_budget': int(user_cfg.advisory_max_tokens_per_day or 0),
        'tokens_used_today': int(tokens_today),
        'tokens_remaining_today': max(int(user_cfg.advisory_max_tokens_per_day or 0) - int(tokens_today), 0),
    }

    if latest is None:
        response_payload.update({
            'status': 'no_advisory',
            'advisory_id': None,
            'last_refreshed_at': None,
            'next_refresh_at': None,
            'refresh_count': 0,
            'is_stale': False,
            'is_auto_generated': False,
            'source': None,
        })
        return Response(response_payload, status=status.HTTP_200_OK)

    next_refresh_at = latest.next_refresh_at or (
        latest.created_at + timedelta(hours=max(int(user_cfg.advisory_refresh_interval_hours or 24), 1))
    )
    response_payload.update({
        'status': 'ready' if next_refresh_at <= timezone.now() else 'scheduled',
        'advisory_id': latest.id,
        'last_refreshed_at': latest.created_at,
        'next_refresh_at': next_refresh_at,
        'refresh_count': int(latest.refresh_count or 0),
        'is_stale': next_refresh_at <= timezone.now(),
        'is_auto_generated': bool(latest.is_auto_generated),
        'source': latest.source,
    })
    return Response(response_payload, status=status.HTTP_200_OK)


def _is_celery_worker_available() -> bool:
    try:
        from config.celery import app as celery_app

        inspect = celery_app.control.inspect(timeout=1.0)
        ping_result = inspect.ping() or {}
        return bool(ping_result)
    except Exception:
        return False


def _submit_advisory_generation_with_fallback(
    *,
    payload_kwargs: dict,
    prefer_sync_fallback: bool,
    force_sync: bool = False,
    context_label: str = 'advisory_generation',
) -> dict:
    from portfolio.tasks import generate_whale_advisory_task

    if force_sync:
        try:
            result = generate_whale_advisory_task.run(**payload_kwargs)
            return {'queued': False, 'task_id': None, 'sync': True, 'result': result}
        except Exception as exc:
            logger.warning('%s force sync failed: %s', context_label, exc)

    worker_available = _is_celery_worker_available()
    if worker_available:
        try:
            task = generate_whale_advisory_task.apply_async(kwargs=payload_kwargs, countdown=0)
            return {'queued': True, 'task_id': task.id, 'sync': False}
        except Exception as exc:
            logger.warning('%s queue submit failed (fallback=%s): %s', context_label, prefer_sync_fallback, exc)
            if not prefer_sync_fallback:
                return {'queued': False, 'task_id': None, 'sync': False, 'queue_error': str(exc)}
    elif not prefer_sync_fallback:
        return {'queued': False, 'task_id': None, 'sync': False, 'queue_error': 'no_worker_available'}

    if not prefer_sync_fallback:
        return {'queued': False, 'task_id': None, 'sync': False, 'queue_error': 'sync_fallback_disabled'}

    try:
        result = generate_whale_advisory_task.run(**payload_kwargs)
        return {'queued': False, 'task_id': None, 'sync': True, 'result': result}
    except Exception as exc:
        logger.exception('%s sync fallback failed: %s', context_label, exc)
        return {'queued': False, 'task_id': None, 'sync': False, 'queue_error': str(exc)}


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def refresh_whale_advisory_api(request, symbol: str):
    """
    POST /api/portfolio/whale-advisory/<symbol>/refresh/
    Làm mới advisory thủ công để tiết kiệm token: chỉ gọi khi user chủ động bấm Refresh.
    """
    normalized_symbol = str(symbol or '').strip().upper()
    if not normalized_symbol:
        return Response({'queued': False, 'message': 'Symbol không hợp lệ.'}, status=status.HTTP_400_BAD_REQUEST)

    entitlements = resolve_user_entitlements(request.user)
    if not entitlements.get('can_read_whale_advisory', False):
        return Response(
            {
                'queued': False,
                'symbol': normalized_symbol,
                'reason': 'plan_upgrade_required',
                'message': 'Gói hiện tại chưa hỗ trợ Refresh AI Advisory. Vui lòng nâng cấp lên Pro để sử dụng tính năng này.',
            },
            status=status.HTTP_403_FORBIDDEN,
        )

    user_cfg, _ = UserConfig.objects.get_or_create(user=request.user)
    ai_status = _get_ai_runtime_config_status(user_cfg)
    if not ai_status['ready']:
        return Response(
            {
                'queued': False,
                'symbol': normalized_symbol,
                'message': ai_status['message'],
                'reason': 'ai_not_configured',
                'config_issue': ai_status['reason'],
            },
            status=status.HTTP_409_CONFLICT,
        )

    refresh_cooldown = max(int(getattr(settings, 'WHALE_ADVISORY_MANUAL_REFRESH_COOLDOWN_SECONDS', 90)), 10)
    refresh_lock_key = f'whale_advisory_refresh_lock:{request.user.id}:{normalized_symbol}'

    # Chặn spam refresh liên tiếp để tiết kiệm token cho user.
    last_refresh_ts = _cache_get(refresh_lock_key)
    if last_refresh_ts:
        retry_after = refresh_cooldown
        return Response(
            {
                'queued': False,
                'symbol': normalized_symbol,
                'message': 'Bạn vừa refresh gần đây, vui lòng thử lại sau.',
                'retry_after_seconds': retry_after,
            },
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )

    latest = WhaleAdvisory.objects.filter(symbol=normalized_symbol, user=request.user).order_by('-created_at').first()
    latest_symbol_side = (
        WhaleAdvisory.objects
        .filter(symbol=normalized_symbol)
        .exclude(side__iexact='UNKNOWN')
        .order_by('-created_at')
        .values_list('side', flat=True)
        .first()
    )

    regenerate_quota = consume_quota(
        request.user,
        quota_key='ai_regenerate_per_day',
        entitlements=entitlements,
    )
    if not regenerate_quota.get('allowed', True):
        return Response(
            build_quota_exceeded_payload(regenerate_quota, 'Ban da dung het quota refresh AI trong ngay.'),
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )

    matched_value_vnd = float(latest.matched_value) if latest else float(user_cfg.whale_alert_threshold or 500) * 1_000_000
    advisory_side = latest.side if latest else (str(latest_symbol_side or 'UNKNOWN').upper())
    advisory_threshold = float(latest.threshold or 0) if latest else float(user_cfg.whale_alert_threshold or 500) * 1_000_000

    task_kwargs = {
        'symbol': normalized_symbol,
        'matched_value_vnd': matched_value_vnd,
        'side': advisory_side,
        'threshold': advisory_threshold,
        'force_refresh': True,
        'user_id': request.user.id,
        'source': WhaleAdvisory.SourceChoices.USER_REFRESH,
    }

    prefer_sync_fallback = bool(getattr(settings, 'WHALE_ADVISORY_SYNC_FALLBACK_IF_NO_WORKER', True))
    should_force_sync_first_create = latest is None and prefer_sync_fallback

    if should_force_sync_first_create:
        logger.info(
            'Force sync first advisory creation for user=%s symbol=%s to avoid queue-only bootstrap',
            request.user.id,
            normalized_symbol,
        )

    submit_result = _submit_advisory_generation_with_fallback(
        payload_kwargs=task_kwargs,
        prefer_sync_fallback=prefer_sync_fallback,
        force_sync=should_force_sync_first_create,
        context_label='refresh_whale_advisory_api',
    )

    if submit_result.get('queue_error'):
        return Response(
            {
                'queued': False,
                'symbol': normalized_symbol,
                'message': 'Không thể xử lý advisory lúc này. Vui lòng thử lại sau.',
            },
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    _cache_set(refresh_lock_key, timezone.now().isoformat(), timeout=refresh_cooldown)
    if submit_result.get('queued'):
        return Response(
            {
                'queued': True,
                'symbol': normalized_symbol,
                'task_id': submit_result.get('task_id'),
                'runtime_ai_source': ai_status.get('source'),
                'runtime_ai_provider': ai_status.get('provider'),
                'runtime_ai_model': ai_status.get('model'),
                'message': 'Đã nhận yêu cầu refresh advisory.' if latest else 'Đã nhận yêu cầu tạo advisory đầu tiên cho mã này.',
            },
            status=status.HTTP_202_ACCEPTED,
        )

    result = submit_result.get('result')
    if isinstance(result, dict) and result.get('status') == 'ok':
        return Response(
            {
                'queued': False,
                'fallback_sync': True,
                'symbol': normalized_symbol,
                'advisory_id': result.get('advisory_id'),
                'runtime_ai_source': result.get('ai_source') or ai_status.get('source'),
                'runtime_ai_provider': result.get('ai_provider') or ai_status.get('provider'),
                'runtime_ai_model': result.get('ai_model') or ai_status.get('model'),
                'message': 'Đã tạo advisory ngay lập tức (fallback đồng bộ).',
            },
            status=status.HTTP_200_OK,
        )

    reason = result.get('reason') if isinstance(result, dict) else 'unknown'
    return Response(
        {
            'queued': False,
            'fallback_sync': True,
            'symbol': normalized_symbol,
            'runtime_ai_source': ai_status.get('source'),
            'runtime_ai_provider': ai_status.get('provider'),
            'runtime_ai_model': ai_status.get('model'),
            'message': f'Đã xử lý fallback đồng bộ nhưng chưa tạo advisory mới (reason={reason}).',
        },
        status=status.HTTP_202_ACCEPTED,
    )


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_current_whale_advisory_api(request, symbol: str):
    normalized_symbol = str(symbol or '').strip().upper()
    if not normalized_symbol:
        return Response({'ok': False, 'message': 'Symbol không hợp lệ.'}, status=status.HTTP_400_BAD_REQUEST)

    entitlements = resolve_user_entitlements(request.user)
    if not entitlements.get('can_read_whale_advisory', False):
        return Response(
            {
                'ok': False,
                'symbol': normalized_symbol,
                'reason': 'plan_upgrade_required',
                'message': 'Gói hiện tại chưa hỗ trợ thao tác này. Vui lòng nâng cấp lên Pro.',
            },
            status=status.HTTP_403_FORBIDDEN,
        )

    latest = (
        WhaleAdvisory.objects
        .filter(user=request.user, symbol=normalized_symbol)
        .order_by('-created_at')
        .first()
    )
    if latest is None:
        return Response(
            {
                'ok': False,
                'symbol': normalized_symbol,
                'message': 'Không tìm thấy advisory hiện tại để xóa.',
            },
            status=status.HTTP_404_NOT_FOUND,
        )

    deleted_id = latest.id
    latest.delete()
    return Response(
        {
            'ok': True,
            'symbol': normalized_symbol,
            'deleted_id': deleted_id,
            'message': 'Đã xóa advisory hiện tại.',
        },
        status=status.HTTP_200_OK,
    )


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsProPlan])
def whale_advisory_symbol_stats_api(request):
    """
    GET /api/portfolio/whale-advisory-symbol-stats/
    Thống kê BUY/SELL whale theo cùng nguồn IntradayTick như Whale Alerts,
    giúp đồng nhất số liệu hiển thị giữa Whale Alerts và Whale Advisory.
    """
    from django.db.models import ExpressionWrapper, F, FloatField, Sum

    symbols_param = str(request.query_params.get('symbols') or '').strip()
    window = str(request.query_params.get('window') or 'session').strip().lower() or 'session'

    if symbols_param:
        symbols = [s.strip().upper() for s in symbols_param.split(',') if s.strip()]
    else:
        symbols = list(
            TrackedSymbol.objects.filter(user=request.user).values_list('symbol', flat=True)
        )

    if not symbols:
        return Response(
            {
                'ok': True,
                'stats': [],
                'window': window,
                'source': 'intraday_tick_db',
            },
            status=status.HTTP_200_OK,
        )

    today_local = timezone.localdate()
    queryset = IntradayTick.objects.filter(symbol__in=symbols).annotate(
        matched_value=ExpressionWrapper(F('price') * F('volume'), output_field=FloatField())
    )

    if window == '5d':
        queryset = queryset.filter(trade_date__gte=today_local - timedelta(days=4))
    else:
        queryset = queryset.filter(trade_date=today_local)

    stats_list = []
    for symbol in symbols:
        symbol_threshold_vnd, _ = _resolve_user_whale_threshold_vnd(request.user, symbol)
        symbol_ticks = queryset.filter(symbol=symbol, matched_value__gte=symbol_threshold_vnd)

        buy_count = symbol_ticks.filter(side__iexact='BUY').count()
        sell_count = symbol_ticks.filter(side__iexact='SELL').count()
        total_count = buy_count + sell_count
        if total_count <= 0:
            continue

        total_value = float(symbol_ticks.aggregate(total=Sum('matched_value')).get('total') or 0.0)
        total_volume = int(symbol_ticks.aggregate(total=Sum('volume')).get('total') or 0)
        avg_order_value = total_value / total_count

        stats_list.append(
            {
                'symbol': symbol,
                'buyCount': buy_count,
                'sellCount': sell_count,
                'totalValue': total_value,
                'totalVolume': total_volume,
                'count': total_count,
                'avgOrderValue': avg_order_value,
            }
        )

    stats_list.sort(key=lambda item: item['totalValue'], reverse=True)
    return Response(
        {
            'ok': True,
            'stats': stats_list,
            'window': window,
            'source': 'intraday_tick_db',
            'symbols_count': len(symbols),
            'stats_count': len(stats_list),
        },
        status=status.HTTP_200_OK,
    )


_OPENCORE_STOCK_FEATURE_KEYS = {
    'stock_order_flow_api': 'dark_pool_flow',
    'stock_ai_advisory_session_api': 'whale_momentum',
    'stock_ai_advisory_components_generate_api': 'sentiment_score',
    'stock_ai_advisory_component_refresh_api': 'sentiment_score',
    'stock_ai_advisory_summary_regenerate_api': 'sentiment_score',
    'stock_ai_advisory_component_toggle_include_api': 'sentiment_score',
    'stock_ai_advisory_component_delete_api': 'sentiment_score',
    'stock_ai_advisory_component_clear_deleted_api': 'sentiment_score',
    'stock_ai_advisory_component_restore_api': 'sentiment_score',
    'stock_ai_advisory_summary_delete_api': 'sentiment_score',
}

_OPENCORE_STOCK_ENDPOINT_QUOTA_KEYS = {
    'stock_order_flow_api': {
        'GET': 'api_calls_per_day',
        'POST': 'api_calls_per_day',
    },
    'stock_ai_advisory_session_api': {
        'POST': 'ai_regenerate_per_day',
    },
    'stock_ai_advisory_components_generate_api': {
        'POST': 'ai_regenerate_per_day',
    },
    'stock_ai_advisory_component_refresh_api': {
        'POST': 'ai_regenerate_per_day',
    },
    'stock_ai_advisory_summary_regenerate_api': {
        'POST': 'ai_regenerate_per_day',
    },
    'stock_ai_advisory_component_toggle_include_api': {
        'POST': 'api_calls_per_day',
    },
    'stock_ai_advisory_component_delete_api': {
        'DELETE': 'api_calls_per_day',
    },
    'stock_ai_advisory_component_clear_deleted_api': {
        'DELETE': 'api_calls_per_day',
    },
    'stock_ai_advisory_component_restore_api': {
        'POST': 'api_calls_per_day',
    },
    'stock_ai_advisory_summary_delete_api': {
        'DELETE': 'api_calls_per_day',
    },
}


def _enforce_opencore_feature_for_stock_endpoint(request, endpoint_name: str):
    """
    Sprint26 Day 2 feature gate for stock workspace endpoints.

    Transitional behavior:
    - Legacy users chưa có DPI license tạm thời được cho phép đi qua
      để tránh hard-break trước khi backfill license toàn hệ thống.
    """
    feature_key = _OPENCORE_STOCK_FEATURE_KEYS.get(endpoint_name)
    if not feature_key:
        return None

    try:
        request.user.dpi_license
    except Exception:
        return None

    can_access, reason = check_feature_access(request.user, feature_key)
    if can_access:
        return None

    _track_opencore_stock_endpoint_usage(
        request,
        endpoint_name,
        status.HTTP_403_FORBIDDEN,
    )

    return Response(
        {
            'ok': False,
            'code': 'feature_locked',
            'feature_key': feature_key,
            'message': 'Tinh nang nay yeu cau goi cao hon hoac license hop le.',
            'reason': reason,
        },
        status=status.HTTP_403_FORBIDDEN,
    )


def _enforce_opencore_quota_for_stock_endpoint(request, endpoint_name: str):
    quota_key = (_OPENCORE_STOCK_ENDPOINT_QUOTA_KEYS.get(endpoint_name) or {}).get(request.method.upper())
    if not quota_key:
        return None

    entitlements = resolve_user_entitlements(request.user)
    quota_result = consume_quota(
        request.user,
        quota_key=quota_key,
        entitlements=entitlements,
    )
    if quota_result.get('allowed', True):
        return None

    _track_opencore_stock_endpoint_usage(
        request,
        endpoint_name,
        status.HTTP_429_TOO_MANY_REQUESTS,
    )

    quota_messages = {
        'api_calls_per_day': 'Ban da dung het quota API trong ngay.',
        'ai_regenerate_per_day': 'Ban da dung het quota refresh AI trong ngay.',
    }
    return Response(
        build_quota_exceeded_payload(
            quota_result,
            quota_messages.get(quota_key, 'Ban da dung het quota trong ngay.'),
        ),
        status=status.HTTP_429_TOO_MANY_REQUESTS,
    )


def _track_opencore_stock_endpoint_usage(request, endpoint_name: str, response_status_code: int):
    feature_key = _OPENCORE_STOCK_FEATURE_KEYS.get(endpoint_name, '')
    try:
        track_api_call(
            user=request.user,
            endpoint=request.path,
            method=request.method,
            status_code=int(response_status_code),
            feature=feature_key,
            api_weight=1,
        )
    except Exception as exc:
        logger.debug('OpenCore stock endpoint usage tracking failed for %s: %s', endpoint_name, exc)


def _timeframe_to_minutes(timeframe: str) -> int:
    """
    F2 Helper: Convert timeframe string (30m, 1h, 4h, 1d) to minutes
    for detect_dark_flow window_minutes parameter.
    Defaults to 30 minutes if format unrecognized.
    """
    timeframe_lower = str(timeframe or '').strip().lower()
    
    if timeframe_lower.endswith('m'):
        try:
            return max(int(timeframe_lower.rstrip('m')), 1)
        except (ValueError, TypeError):
            return 30
    elif timeframe_lower.endswith('h'):
        try:
            hours = int(timeframe_lower.rstrip('h'))
            return max(hours * 60, 1)
        except (ValueError, TypeError):
            return 30
    elif timeframe_lower.endswith('d'):
        try:
            days = int(timeframe_lower.rstrip('d'))
            return max(days * 24 * 60, 1)
        except (ValueError, TypeError):
            return 30
    
    return 30  # Default: 30 minutes


def _resolve_first_create_threshold_vnd(user, symbol: str, user_default_threshold_vnd: float) -> tuple[float, str]:
    """
    F3 Helper: Resolve threshold for first advisory creation.
    Returns (threshold_vnd, threshold_source) tuple.
    
    Order of precedence:
    1. Symbol-specific override (TrackedSymbol.whale_alert_threshold_million)
    2. User default threshold (UserConfig.whale_alert_threshold)
    
    Returns tuple of (threshold_vnd, source) where source is 'symbol_override' or 'user_default'
    """
    from portfolio.models import TrackedSymbol
    
    try:
        tracked_symbol = TrackedSymbol.objects.get(user=user, symbol=symbol.upper())
        if tracked_symbol.whale_alert_threshold_million:
            resolved_threshold = float(tracked_symbol.whale_alert_threshold_million) * 1_000_000
            return (resolved_threshold, 'symbol_override')
    except TrackedSymbol.DoesNotExist:
        pass
    
    return (user_default_threshold_vnd, 'user_default')


def _build_component_generation_key(component) -> str:
    component_type = str(getattr(component, 'component_type', '') or 'component').strip().lower() or 'component'
    indicator_name = str(getattr(component, 'indicator_name', '') or '').strip().upper()
    if indicator_name:
        return f'{component_type}:{indicator_name}'
    return component_type


def _estimate_component_generation_confidence(*, dark_flow: dict | None, generated_by_ai: bool, created_count: int) -> float:
    strength = 0.0
    if isinstance(dark_flow, dict):
        try:
            strength = float(dark_flow.get('strength') or 0.0)
        except Exception:
            strength = 0.0
    if strength > 1.0:
        strength = strength / 100.0

    score = 0.40 + min(max(strength, 0.0), 0.35)
    if generated_by_ai:
        score += 0.12
    if created_count >= 3:
        score += 0.08
    return max(0.0, min(score, 0.99))


def _estimate_component_generation_actionability(created_components) -> float:
    created_components = list(created_components or [])
    if not created_components:
        return 0.0

    actionable_components = 0
    confidence_total = 0.0
    for component in created_components:
        suggested_action = str(getattr(component, 'suggested_action', '') or '').strip().lower()
        if suggested_action and suggested_action not in {'watch', 'hold', 'neutral'}:
            actionable_components += 1
        try:
            confidence_total += float(getattr(component, 'confidence_score', 0) or 0)
        except Exception:
            confidence_total += 0.0

    actionable_ratio = actionable_components / len(created_components)
    normalized_confidence = min(max((confidence_total / len(created_components)) / 10.0, 0.0), 1.0)
    score = 0.35 + (actionable_ratio * 0.40) + (normalized_confidence * 0.20)
    return max(0.0, min(score, 0.99))


def _persist_component_generation_metrics_audit_log(
    *,
    user,
    symbol: str,
    latest_advisory,
    created_components,
    timeframe: str,
    generated_by_ai: bool,
    chart_context_used: bool,
    chart_context_warnings: list[str],
    metrics: dict,
) -> None:
    if user is None:
        return

    created_components = list(created_components or [])
    before_state = {}
    if latest_advisory is not None:
        before_state = {
            'advisory_id': latest_advisory.id,
            'severity': getattr(latest_advisory, 'severity', ''),
            'source': getattr(latest_advisory, 'source', ''),
            'threshold_source': getattr(latest_advisory, 'threshold_source', ''),
            'created_at': latest_advisory.created_at.isoformat() if latest_advisory.created_at else None,
        }

    after_state = {
        'operation': 'component_generation',
        'timeframe': timeframe,
        'generated_by_ai': bool(generated_by_ai),
        'component_count': len(created_components),
        'component_ids': [component.id for component in created_components],
    }

    metadata_payload = dict(metrics or {})
    metadata_payload.update(
        {
            'operation': 'component_generation',
            'symbol': symbol,
            'timeframe': timeframe,
            'generated_by_ai': bool(generated_by_ai),
            'chart_context_used': bool(chart_context_used),
            'chart_context_warning_count': len(chart_context_warnings or []),
            'created_count': len(created_components),
            'created_component_keys': [_build_component_generation_key(component) for component in created_components],
        }
    )

    try:
        from portfolio.models import AdvisoryAggregateAuditLog

        AdvisoryAggregateAuditLog.objects.create(
            user=user,
            symbol=symbol,
            before_state_json=before_state,
            after_state_json=after_state,
            reason=AdvisoryAggregateAuditLog.ReasonChoices.MANUAL_REFRESH,
            actor=AdvisoryAggregateAuditLog.ActorChoices.USER,
            actor_id=str(user.id),
            metadata_json=metadata_payload,
        )
    except Exception as exc:
        logger.warning('Component generation metrics audit log persistence failed for %s: %s', symbol, exc)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def stock_news_api(request, symbol: str):
    """
    GET /api/stock-management/stocks/<symbol>/news/
    Sprint34 Layer 1: Trả về danh sách tin tức gần đây theo mã từ vnstock.
    Cache Redis 30 phút. Graceful degradation khi vnstock không khả dụng.
        Hỗ trợ manual refresh:
            - GET .../news/?force=1
            - POST .../news/
    """
    from .adapters.cache_adapter import get_cache, set_cache

    normalized_symbol = str(symbol or '').strip().upper()
    if not normalized_symbol or len(normalized_symbol) > 10:
        return Response({'detail': 'Mã chứng khoán không hợp lệ.'}, status=status.HTTP_400_BAD_REQUEST)

    force_refresh = request.method == 'POST' or str(request.query_params.get('force', '')).strip().lower() in {'1', 'true', 'yes'}

    cache_key = f'stock:news:{normalized_symbol}'
    if not force_refresh:
        cached = get_cache(cache_key)
        if cached is not None:
            cached['cached'] = True
            return Response(cached)

    rss_sources_raw = str(
        getattr(settings, 'VNSTOCK_RSS_NEWS_SOURCES', os.getenv('VNSTOCK_RSS_NEWS_SOURCES', 'rss_cafef,rss_vneconomy'))
        or 'rss_cafef,rss_vneconomy'
    )
    rss_sources = [src.strip() for src in rss_sources_raw.split(',') if src.strip()]
    if not rss_sources:
        rss_sources = ['rss_cafef', 'rss_vneconomy']

    def _fix_mojibake(text: str) -> str:
        value = str(text or '').strip()
        if not value:
            return value
        if 'Ã' not in value and 'áº' not in value and 'Ä' not in value:
            return value
        try:
            repaired = value.encode('latin1', errors='ignore').decode('utf-8', errors='ignore').strip()
            return repaired or value
        except Exception:
            return value

    def _fetch_news_with_fallback(limit: int = 20):
        import pandas as _pd
        from vnstock.api.news import News

        collected = []
        seen = set()
        last_exc = None

        for source in rss_sources:
            try:
                news_client = News(source=source)
            except Exception as exc:
                last_exc = exc
                continue

            df = None
            try:
                df = news_client.by_symbol(normalized_symbol, limit=max(limit * 2, 20))
            except Exception as exc:
                last_exc = exc

            if df is None or (hasattr(df, 'empty') and df.empty):
                try:
                    latest_df = news_client.latest(limit=60)
                    if latest_df is not None and not latest_df.empty:
                        if 'symbol' in latest_df.columns:
                            symbol_filtered = latest_df[latest_df['symbol'].astype(str).str.upper() == normalized_symbol]
                        else:
                            symbol_filtered = latest_df[latest_df.get('title', _pd.Series(dtype='str')).astype(str).str.upper().str.contains(normalized_symbol)]
                        df = symbol_filtered
                except Exception as exc:
                    last_exc = exc
                    df = None

            if df is None or (hasattr(df, 'empty') and df.empty):
                continue

            rows = df.to_dict(orient='records') if hasattr(df, 'to_dict') else []
            for row in rows:
                title = _fix_mojibake(str(row.get('title') or row.get('headline') or '').strip())
                if not title:
                    continue
                url = str(row.get('url') or row.get('link') or '').strip()
                if url and not url.startswith(('http://', 'https://')):
                    url = ''
                source_name = _fix_mojibake(str(row.get('source') or source).strip())
                raw_date = row.get('published_at') or row.get('published_date') or row.get('date') or ''
                try:
                    published_at = str(_pd.Timestamp(raw_date).isoformat()) if raw_date else None
                except Exception:
                    published_at = str(raw_date) if raw_date else None

                dedup_key = (title.lower(), (url or '').lower())
                if dedup_key in seen:
                    continue
                seen.add(dedup_key)

                collected.append(
                    {
                        'title': title,
                        'url': url or None,
                        'source': source_name or source,
                        'published_at': published_at,
                    }
                )
                if len(collected) >= limit:
                    return collected

        if collected:
            return collected
        if last_exc:
            raise last_exc
        return []

    items = []
    unavailable = False
    try:
        items = _fetch_news_with_fallback(limit=20)
    except Exception:
        logger.warning('stock_news_api: không lấy được tin tức cho %s', normalized_symbol)
        unavailable = True

    def _fetch_rss_fallback(news_symbol: str, limit: int = 12):
        import datetime
        import email.utils
        import urllib.parse
        import urllib.request
        import xml.etree.ElementTree as ET

        keyword = urllib.parse.quote_plus(f'{news_symbol} chứng khoán')
        rss_urls = [
            f'https://news.google.com/rss/search?q={keyword}&hl=vi&gl=VN&ceid=VN:vi',
            f'https://news.google.com/rss/search?q={keyword}&hl=en-US&gl=US&ceid=US:en',
        ]

        normalized_items = []
        seen = set()
        for rss_url in rss_urls:
            try:
                with urllib.request.urlopen(rss_url, timeout=8) as response:
                    payload = response.read()
                root = ET.fromstring(payload)
            except Exception:
                continue

            channel = root.find('channel')
            if channel is None:
                continue

            for item_node in channel.findall('item'):
                title = (item_node.findtext('title') or '').strip()
                if not title:
                    continue
                link = (item_node.findtext('link') or '').strip()
                if link and not link.startswith(('http://', 'https://')):
                    link = ''
                pub_date_raw = (item_node.findtext('pubDate') or '').strip()
                published_at = None
                if pub_date_raw:
                    try:
                        parsed_date = email.utils.parsedate_to_datetime(pub_date_raw)
                        if parsed_date is not None:
                            published_at = parsed_date.isoformat()
                    except Exception:
                        published_at = None

                dedup_key = (title.lower(), link.lower())
                if dedup_key in seen:
                    continue
                seen.add(dedup_key)

                normalized_items.append(
                    {
                        'title': title,
                        'url': link or None,
                        'source': 'google-news-rss',
                        'published_at': published_at or datetime.datetime.utcnow().isoformat(),
                    }
                )
                if len(normalized_items) >= limit:
                    return normalized_items

        return normalized_items

    if not items:
        try:
            rss_items = _fetch_rss_fallback(normalized_symbol, limit=12)
            if rss_items:
                items = rss_items
                unavailable = False
        except Exception as exc:
            logger.warning('stock_news_api: rss fallback failed for %s: %s', normalized_symbol, exc)

    result = {
        'symbol': normalized_symbol,
        'items': items,
        'fetched_at': timezone.now().isoformat(),
        'cached': False,
        'unavailable': unavailable,
    }
    if not unavailable:
        set_cache(cache_key, result, timeout=1800)
    return Response(result)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def stock_news_ai_summary_api(request, symbol: str):
    """
    POST /api/stock-management/stocks/<symbol>/news/ai-summary/
    Tạo bản tóm tắt AI dựa trên tin tức mới nhất của 1 mã cổ phiếu.
    Body options:
      - force_refresh: bool (bỏ cache tin tức khi true)
    """
    from .ai_options import ADVISORY_CAPABILITY, get_model_entry, is_valid_provider
    from .ai_service import generate_portfolio_digest
    from .adapters.cache_adapter import get_cache, set_cache
    from .models import UserConfig

    normalized_symbol = str(symbol or '').strip().upper()
    if not normalized_symbol or len(normalized_symbol) > 10:
        return Response({'detail': 'Mã chứng khoán không hợp lệ.'}, status=status.HTTP_400_BAD_REQUEST)

    force_refresh = bool(request.data.get('force_refresh'))
    source_payload = None

    if not force_refresh:
        cached_news = get_cache(f'stock:news:{normalized_symbol}')
        if cached_news is not None:
            source_payload = dict(cached_news)
            source_payload['cached'] = True

    if source_payload is None:
        # Build an internal HttpRequest instead of reusing DRF Request to avoid
        # AssertionError in api_view wrapper.
        from django.test import RequestFactory
        from rest_framework.test import force_authenticate

        rf = RequestFactory()
        params = {'force': '1'} if force_refresh else {}
        internal_request = rf.get(f'/api/stock-management/stocks/{normalized_symbol}/news/', data=params)
        force_authenticate(internal_request, user=request.user)

        news_response = stock_news_api(internal_request, normalized_symbol)
        if news_response.status_code >= 400:
            return news_response
        source_payload = dict(news_response.data or {})

    if bool(source_payload.get('unavailable')):
        return Response(
            {
                'detail': 'Nguồn tin tức tạm thời không khả dụng. Vui lòng thử lại sau.',
                'reason': 'news_unavailable',
            },
            status=status.HTTP_409_CONFLICT,
        )

    items = source_payload.get('items') if isinstance(source_payload.get('items'), list) else []
    if not items:
        return Response(
            {
                'detail': 'Chưa có dữ liệu tin tức để AI tổng hợp.',
                'reason': 'empty_news',
            },
            status=status.HTTP_409_CONFLICT,
        )

    user_cfg, _ = UserConfig.objects.get_or_create(user=request.user)
    user_provider = str(user_cfg.ai_provider or '').strip().lower()
    user_model = str(user_cfg.get_effective_ai_model() or '').strip()
    user_api_key = str(user_cfg.get_ai_api_key() or '').strip()

    if not user_api_key:
        return Response(
            {
                'detail': 'Bạn chưa cấu hình AI API key cá nhân. Vui lòng vào UserConfig để thiết lập trước khi dùng AI News.',
                'reason': 'missing_user_ai_api_key',
                'username': request.user.username,
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    if not is_valid_provider(user_provider):
        return Response(
            {
                'detail': 'AI provider trong UserConfig không hợp lệ.',
                'reason': 'invalid_user_ai_provider',
                'username': request.user.username,
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    if not user_model:
        return Response(
            {
                'detail': 'AI model trong UserConfig đang để trống.',
                'reason': 'missing_user_ai_model',
                'username': request.user.username,
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    # If model exists in catalog, enforce capability gate.
    # If not present in catalog, allow pass-through for custom provider models.
    model_entry = get_model_entry(user_provider, user_model)
    if model_entry is not None and ADVISORY_CAPABILITY not in list(model_entry.get('capabilities') or []):
        return Response(
            {
                'detail': 'AI model trong UserConfig chưa được bật capability AI News.',
                'reason': 'user_ai_model_capability_blocked',
                'username': request.user.username,
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    lines = []
    for item in items[:10]:
        title = str(item.get('title') or '').strip()
        if not title:
            continue
        source = str(item.get('source') or 'unknown').strip()
        published_at = str(item.get('published_at') or '').strip()
        lines.append(f"- {title} ({source}{', ' + published_at if published_at else ''})")

    if not lines:
        return Response(
            {
                'detail': 'Không đủ dữ liệu headline hợp lệ để AI tổng hợp.',
                'reason': 'invalid_news_payload',
            },
            status=status.HTTP_409_CONFLICT,
        )

    news_context_by_symbol = {
        normalized_symbol: f"[{normalized_symbol}]\n" + "\n".join(lines),
    }

    ai_cache_key = f'stock:news:ai-summary:{normalized_symbol}'
    if not force_refresh:
        ai_cached = get_cache(ai_cache_key)
        if ai_cached is not None:
            ai_cached['cached'] = True
            return Response(ai_cached)

    try:
        digest_payload = generate_portfolio_digest(
            provider=user_provider,
            model=user_model,
            api_key=user_api_key,
            symbols=[normalized_symbol],
            news_context_by_symbol=news_context_by_symbol,
            user=request.user,
        )
    except Exception as exc:
        logger.exception('stock_news_ai_summary_api failed for %s: %s', normalized_symbol, exc)
        import httpx
        if isinstance(exc, (httpx.ReadTimeout, httpx.ConnectTimeout, TimeoutError)):
            return Response(
                {
                    'detail': 'AI provider phản hồi quá chậm (timeout). Vui lòng thử lại sau 1-2 phút.',
                    'reason': 'ai_provider_timeout',
                    'username': request.user.username,
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        return Response(
            {
                'detail': 'Không thể tạo AI News lúc này. Vui lòng thử lại sau.',
                'reason': 'ai_summary_generation_failed',
                'username': request.user.username,
            },
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    response_payload = {
        'symbol': normalized_symbol,
        'summary': str(digest_payload.get('summary') or '').strip(),
        'full': str(digest_payload.get('full') or '').strip(),
        'item_count': len(items),
        'ai_provider': user_provider,
        'ai_model': user_model,
        'generated_at': timezone.now().isoformat(),
        'news_fetched_at': source_payload.get('fetched_at'),
        'cached': False,
    }
    set_cache(ai_cache_key, response_payload, timeout=900)
    return Response(response_payload)



@api_view(['GET'])
@permission_classes([IsAuthenticated])
def portfolio_news_digest_api(request):
    """
    GET /api/stock-management/portfolio/news-digest/
    Sprint35 Layer 3: Trả về bản tóm tắt tin tức danh mục mới nhất của user.
    Query param: ?date=YYYY-MM-DD (tuỳ chọn, mặc định hôm nay)
    """
    from portfolio.models import PortfolioNewsDigest
    from django.utils import timezone as _tz
    import datetime

    date_str = request.query_params.get('date', '')
    if date_str:
        try:
            target_date = datetime.date.fromisoformat(date_str)
        except ValueError:
            return Response({'detail': 'Định dạng ngày không hợp lệ. Dùng YYYY-MM-DD.'}, status=400)
    else:
        target_date = None  # lấy mới nhất

    qs = PortfolioNewsDigest.objects.filter(user=request.user)
    if target_date:
        qs = qs.filter(date=target_date)
    digest = qs.order_by('-date').first()

    if digest is None:
        return Response({
            'has_digest': False,
            'date': str(target_date or _tz.localdate()),
            'message': 'Chưa có bản tóm tắt tin tức cho ngày này.',
        })

    return Response({
        'has_digest': True,
        'id': digest.id,
        'date': str(digest.date),
        'symbols': digest.symbols,
        'digest_summary': digest.digest_summary,
        'digest_full': digest.digest_full,
        'item_count': digest.item_count,
        'ai_model': digest.ai_model,
        'created_at': digest.created_at.isoformat(),
    })


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def stock_order_flow_api(request, symbol: str):
    """
    GET /api/stock-management/stocks/<symbol>/order-flow/
    Tra summary order flow cho stock detail page.
    Query params:
      - window: 5m | 15m | 30m (default) | 1h — khung thời gian CVD và tick rate.
    """
    from portfolio.order_flow import compute_cvd_series, detect_dark_flow

    denied_response = _enforce_opencore_feature_for_stock_endpoint(request, 'stock_order_flow_api')
    if denied_response is not None:
        return denied_response

    normalized_symbol = str(symbol or '').strip().upper()
    if not normalized_symbol:
        return Response({'ok': False, 'message': 'Symbol không hợp lệ.'}, status=status.HTTP_400_BAD_REQUEST)

    quota_response = _enforce_opencore_quota_for_stock_endpoint(request, 'stock_order_flow_api')
    if quota_response is not None:
        return quota_response

    _window_map = {'5m': 5, '15m': 15, '30m': 30, '1h': 60}
    window_param = str(request.query_params.get('window', '30m')).strip().lower()
    window_minutes = _window_map.get(window_param, 30)

    dark_flow = detect_dark_flow(normalized_symbol, window_minutes=window_minutes)
    cvd_series = compute_cvd_series(normalized_symbol, window_minutes=window_minutes, bucket_seconds=60)
    # Sprint 34 A2: Implement cursor-based pagination with has_more semantics
    import base64

    try:
        offset = int(request.query_params.get('offset', 0) or 0)
    except (TypeError, ValueError):
        offset = 0
    offset = max(0, min(offset, 10000))  # Prevent crazy values

    try:
        limit = int(request.query_params.get('limit', 8) or 8)
    except (TypeError, ValueError):
        limit = 8
    limit = max(1, min(limit, 50))  # 1-50 records per page
    cursor = str(request.query_params.get('cursor', '')).strip()
    
    # Parse cursor if provided (format: base64(timestamp:id))
    cursor_timestamp = None
    cursor_id = None
    if cursor:
        try:
            decoded = base64.b64decode(cursor).decode('utf-8')
            cursor_timestamp, cursor_id_raw = decoded.rsplit(':', 1)
            cursor_id = int(cursor_id_raw)
        except Exception:
            pass  # Invalid cursor, start from beginning
    
    # Query with pagination: order by -created_at, -id for deterministic tiebreaker
    queryset = OrderFlowSignal.objects.filter(symbol=normalized_symbol).order_by('-created_at', '-id')
    
    # Apply cursor offset if provided
    if cursor_timestamp and cursor_id is not None:
        from datetime import datetime
        from django.db.models import Q
        try:
            cursor_dt = datetime.fromisoformat(cursor_timestamp.replace('Z', '+00:00'))
            queryset = queryset.filter(
                Q(created_at__lt=cursor_dt) |
                Q(created_at=cursor_dt, id__lt=cursor_id)
            )
        except Exception:
            pass
    
    # Get total count before offset
    total_count = queryset.count()
    
    # Apply offset + fetch limit+1 to detect has_more
    signals_with_extra = list(queryset[offset:offset + limit + 1].values(
        'id', 'symbol', 'signal_type', 'strength', 'confidence', 'tick_rate',
        'small_order_ratio', 'cvd_at_signal', 'price_at_signal', 'created_at',
        'event_id', 'severity'
    ))
    
    has_more = len(signals_with_extra) > limit
    recent_signals = signals_with_extra[:limit]
    
    # Generate next_cursor if has_more
    next_cursor = None
    if has_more and recent_signals:
        last_signal = recent_signals[-1]
        cursor_payload = f"{last_signal['created_at'].isoformat()}:{last_signal['id']}"
        next_cursor = base64.b64encode(cursor_payload.encode('utf-8')).decode('utf-8')
    
    latest_signal = recent_signals[0] if recent_signals else None

    _track_opencore_stock_endpoint_usage(request, 'stock_order_flow_api', status.HTTP_200_OK)
    return Response(
        {
            'ok': True,
            'symbol': normalized_symbol,
            'window': window_param,
            'window_minutes': window_minutes,
            'latest_signal': latest_signal,
            'signals': recent_signals,
            'cvd_series': cvd_series,
            'dark_flow': dark_flow,
            'tick_rate': (dark_flow.get('components') or {}).get('tick_rate') or {},
            'size_distribution': (dark_flow.get('components') or {}).get('size_distribution') or {},
            'pagination': {
                'offset': offset,
                'limit': limit,
                'total_count': total_count,
                'has_more': has_more,
                'next_cursor': next_cursor,
            }
        },
        status=status.HTTP_200_OK,
    )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def stock_ai_advisory_components_generate_api(request, symbol: str):
    from portfolio.order_flow import detect_dark_flow
    from portfolio.observability import (
        end_advisory_phase,
        end_advisory_session,
        record_advisory_actionability,
        record_advisory_component,
        record_advisory_confidence,
        record_advisory_error_recovery,
        record_ai_chart_context_observation,
        start_advisory_phase,
        start_advisory_session,
    )
    from time import perf_counter

    denied_response = _enforce_opencore_feature_for_stock_endpoint(request, 'stock_ai_advisory_components_generate_api')
    if denied_response is not None:
        return denied_response

    normalized_symbol = str(symbol or '').strip().upper()
    if not normalized_symbol:
        return Response({'ok': False, 'message': 'Symbol khong hop le.'}, status=status.HTTP_400_BAD_REQUEST)

    latest = WhaleAdvisory.objects.filter(symbol=normalized_symbol, user=request.user).order_by('-created_at').first()
    if latest is None:
        return Response({'ok': False, 'message': 'Chua co advisory goc de tao components.'}, status=status.HTTP_400_BAD_REQUEST)

    user_cfg, _ = UserConfig.objects.get_or_create(user=request.user)
    ai_status = _get_ai_runtime_config_status(user_cfg)
    if not ai_status['ready']:
        return Response(
            {
                'ok': False,
                'message': ai_status['message'],
                'reason': 'ai_not_configured',
                'config_issue': ai_status['reason'],
            },
            status=status.HTTP_409_CONFLICT,
        )

    quota_response = _enforce_opencore_quota_for_stock_endpoint(request, 'stock_ai_advisory_components_generate_api')
    if quota_response is not None:
        return quota_response

    timeframe = str(request.data.get('timeframe', '30m')).strip().lower()
    valid_timeframes = {choice for choice, _ in AIAdvisoryComponentRecord.TimeframeChoice.choices}
    if timeframe not in valid_timeframes:
        timeframe = '30m'

    chart_context = None
    chart_context_used = False
    chart_context_warnings = []
    raw_chart_context = request.data.get('chart_context')
    chart_context_payload_bytes = 0
    chart_context_ohlcv_points = 0
    if raw_chart_context is not None:
        try:
            chart_context_payload_bytes = len(json.dumps(raw_chart_context, ensure_ascii=False).encode('utf-8'))
        except Exception:
            chart_context_payload_bytes = 0
        _max_chart_context_bytes = int(os.getenv('MAX_CHART_CONTEXT_BYTES', '65536'))
        if chart_context_payload_bytes > _max_chart_context_bytes:
            chart_context_warnings.append('chart_context_too_large')
            # Do not use oversized context — discard to prevent prompt explosion.
        else:
            context_serializer = StockAIChartContextSerializer(
                data=raw_chart_context,
                context={'symbol': normalized_symbol, 'max_ohlcv_points': 300},
            )
            if context_serializer.is_valid():
                chart_context = dict(context_serializer.validated_data)
                chart_context_used = True
                chart_context_ohlcv_points = len(chart_context.get('ohlcv') or [])
            else:
                chart_context_warnings.append('chart_context_invalid')

    logger.info(
        'stock_ai_advisory_components_generate telemetry symbol=%s chart_context_present=%s chart_context_used=%s chart_context_ohlcv_points=%s chart_context_payload_bytes=%s chart_context_warning_count=%s',
        normalized_symbol,
        raw_chart_context is not None,
        chart_context_used,
        chart_context_ohlcv_points,
        chart_context_payload_bytes,
        len(chart_context_warnings),
    )
    record_ai_chart_context_observation(
        present=raw_chart_context is not None,
        used=chart_context_used,
        warning_count=len(chart_context_warnings),
        ohlcv_points=chart_context_ohlcv_points,
        payload_bytes=chart_context_payload_bytes,
    )

    start_advisory_session()
    session_closed = False
    try:
        window_minutes = _timeframe_to_minutes(timeframe)

        start_advisory_phase('component_dark_flow_detection')
        dark_flow_started = perf_counter()
        try:
            dark_flow = detect_dark_flow(normalized_symbol, window_minutes=window_minutes)
        finally:
            end_advisory_phase('component_dark_flow_detection')
        record_advisory_component('dark_flow_detection', (perf_counter() - dark_flow_started) * 1000)

        start_advisory_phase('component_template_generation')
        template_started = perf_counter()
        try:
            templates = _sprint17_generate_component_templates_with_ai(
                user=request.user,
                symbol=normalized_symbol,
                latest_advisory=latest,
                dark_flow=dark_flow,
                timeframe=timeframe,
                chart_context=chart_context,
            )
            generated_by_ai = bool(templates)
            if not templates:
                templates = _sprint17_build_component_templates(
                    normalized_symbol,
                    latest,
                    dark_flow,
                    timeframe,
                    chart_context=chart_context,
                )
        finally:
            end_advisory_phase('component_template_generation')
        record_advisory_component(
            'template_generation_ai' if generated_by_ai else 'template_generation_fallback',
            (perf_counter() - template_started) * 1000,
        )

        start_advisory_phase('component_record_persistence')
        persistence_started = perf_counter()
        try:
            created = [
                AIAdvisoryComponentRecord.objects.create(user=request.user, **payload)
                for payload in templates
            ]
        finally:
            end_advisory_phase('component_record_persistence')
        persistence_latency_ms = (perf_counter() - persistence_started) * 1000
        record_advisory_component('component_record_persistence', persistence_latency_ms)

        per_component_latency_ms = persistence_latency_ms / max(len(created), 1)
        for component in created:
            record_advisory_component(_build_component_generation_key(component), per_component_latency_ms)

        record_advisory_confidence(
            _estimate_component_generation_confidence(
                dark_flow=dark_flow,
                generated_by_ai=generated_by_ai,
                created_count=len(created),
            ),
            source='component_generation',
        )
        record_advisory_actionability(_estimate_component_generation_actionability(created))

        start_advisory_phase('component_response_serialization')
        serialization_started = perf_counter()
        try:
            components_payload = AIAdvisoryComponentRecordSerializer(created, many=True).data
        finally:
            end_advisory_phase('component_response_serialization')
        record_advisory_component('component_response_serialization', (perf_counter() - serialization_started) * 1000)

        metrics = end_advisory_session()
        session_closed = True
        _persist_component_generation_metrics_audit_log(
            user=request.user,
            symbol=normalized_symbol,
            latest_advisory=latest,
            created_components=created,
            timeframe=timeframe,
            generated_by_ai=generated_by_ai,
            chart_context_used=chart_context_used,
            chart_context_warnings=chart_context_warnings,
            metrics=metrics,
        )
    except Exception as exc:
        record_advisory_error_recovery(type(exc).__name__, 'component_generation_failed', success=False)
        if not session_closed:
            end_advisory_session()
        raise

    _track_opencore_stock_endpoint_usage(request, 'stock_ai_advisory_components_generate_api', status.HTTP_201_CREATED)
    return Response(
        {
            'ok': True,
            'symbol': normalized_symbol,
            'created_count': len(created),
            'generated_by_ai': generated_by_ai,
            'chart_context_used': chart_context_used,
            'chart_context_warnings': chart_context_warnings,
            'components': components_payload,
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def stock_ai_advisory_component_toggle_include_api(request, component_id: int):
    denied_response = _enforce_opencore_feature_for_stock_endpoint(request, 'stock_ai_advisory_component_toggle_include_api')
    if denied_response is not None:
        return denied_response

    component = AIAdvisoryComponentRecord.objects.filter(id=component_id, user=request.user, is_deleted=False).first()
    if component is None:
        return Response({'ok': False, 'message': 'Component khong ton tai.'}, status=status.HTTP_404_NOT_FOUND)

    quota_response = _enforce_opencore_quota_for_stock_endpoint(request, 'stock_ai_advisory_component_toggle_include_api')
    if quota_response is not None:
        return quota_response

    component.include_in_summary = not component.include_in_summary
    component.save(update_fields=['include_in_summary', 'updated_at'])
    _track_opencore_stock_endpoint_usage(request, 'stock_ai_advisory_component_toggle_include_api', status.HTTP_200_OK)
    return Response({'ok': True, 'component': AIAdvisoryComponentRecordSerializer(component).data}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def stock_ai_advisory_component_refresh_api(request, component_id: int):
    from portfolio.order_flow import detect_dark_flow

    denied_response = _enforce_opencore_feature_for_stock_endpoint(request, 'stock_ai_advisory_component_refresh_api')
    if denied_response is not None:
        return denied_response

    component = AIAdvisoryComponentRecord.objects.filter(id=component_id, user=request.user, is_deleted=False).first()
    if component is None:
        return Response({'ok': False, 'message': 'Component không tồn tại.'}, status=status.HTTP_404_NOT_FOUND)

    latest = WhaleAdvisory.objects.filter(symbol=component.symbol, user=request.user).order_by('-created_at').first()
    if latest is None:
        return Response({'ok': False, 'message': 'Chưa có advisory gốc để làm mới tab.'}, status=status.HTTP_400_BAD_REQUEST)

    user_cfg, _ = UserConfig.objects.get_or_create(user=request.user)
    ai_status = _get_ai_runtime_config_status(user_cfg)
    if not ai_status['ready']:
        return Response(
            {
                'ok': False,
                'message': ai_status['message'],
                'reason': 'ai_not_configured',
                'config_issue': ai_status['reason'],
            },
            status=status.HTTP_409_CONFLICT,
        )

    quota_response = _enforce_opencore_quota_for_stock_endpoint(request, 'stock_ai_advisory_component_refresh_api')
    if quota_response is not None:
        return quota_response

    timeframe = component.timeframe or AIAdvisoryComponentRecord.TimeframeChoice.M30
    dark_flow = detect_dark_flow(component.symbol)
    templates = _sprint17_generate_component_templates_with_ai(
        user=request.user,
        symbol=component.symbol,
        latest_advisory=latest,
        dark_flow=dark_flow,
        timeframe=timeframe,
    )
    generated_by_ai = bool(templates)
    if not templates:
        templates = _sprint17_build_component_templates(component.symbol, latest, dark_flow, timeframe)

    refreshed_payload = next((item for item in templates if item.get('component_type') == component.component_type), None)
    if refreshed_payload is None and templates:
        refreshed_payload = templates[0]
    if refreshed_payload is None:
        return Response({'ok': False, 'message': 'Không tạo được dữ liệu làm mới cho tab này.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    component.indicator_name = refreshed_payload.get('indicator_name') or component.indicator_name
    component.status = refreshed_payload.get('status') or component.status
    component.confidence_score = int(refreshed_payload.get('confidence_score') or component.confidence_score or 5)
    component.suggested_action = refreshed_payload.get('suggested_action') or component.suggested_action
    component.rationale_text = refreshed_payload.get('rationale_text') or component.rationale_text
    component.timeframe = refreshed_payload.get('timeframe') or component.timeframe
    component.save(update_fields=['indicator_name', 'status', 'confidence_score', 'suggested_action', 'rationale_text', 'timeframe', 'updated_at'])

    _track_opencore_stock_endpoint_usage(request, 'stock_ai_advisory_component_refresh_api', status.HTTP_200_OK)
    return Response(
        {
            'ok': True,
            'generated_by_ai': generated_by_ai,
            'component': AIAdvisoryComponentRecordSerializer(component).data,
            'message': 'Đã làm mới tab AI đang chọn.',
        },
        status=status.HTTP_200_OK,
    )


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def stock_ai_advisory_component_delete_api(request, component_id: int):
    denied_response = _enforce_opencore_feature_for_stock_endpoint(request, 'stock_ai_advisory_component_delete_api')
    if denied_response is not None:
        return denied_response

    component = AIAdvisoryComponentRecord.objects.filter(id=component_id, user=request.user, is_deleted=False).first()
    if component is None:
        return Response({'ok': False, 'message': 'Component khong ton tai.'}, status=status.HTTP_404_NOT_FOUND)

    quota_response = _enforce_opencore_quota_for_stock_endpoint(request, 'stock_ai_advisory_component_delete_api')
    if quota_response is not None:
        return quota_response

    component.is_deleted = True
    component.include_in_summary = False
    component.save(update_fields=['is_deleted', 'include_in_summary', 'updated_at'])
    _track_opencore_stock_endpoint_usage(request, 'stock_ai_advisory_component_delete_api', status.HTTP_200_OK)
    return Response({'ok': True, 'message': 'Da xoa component (soft delete).'}, status=status.HTTP_200_OK)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def stock_ai_advisory_component_clear_deleted_api(request, symbol: str):
    denied_response = _enforce_opencore_feature_for_stock_endpoint(request, 'stock_ai_advisory_component_clear_deleted_api')
    if denied_response is not None:
        return denied_response

    normalized_symbol = str(symbol or '').strip().upper()
    if not normalized_symbol:
        return Response({'ok': False, 'message': 'Symbol khong hop le.'}, status=status.HTTP_400_BAD_REQUEST)

    quota_response = _enforce_opencore_quota_for_stock_endpoint(request, 'stock_ai_advisory_component_clear_deleted_api')
    if quota_response is not None:
        return quota_response

    deleted_qs = AIAdvisoryComponentRecord.objects.filter(
        user=request.user,
        symbol=normalized_symbol,
        is_deleted=True,
    )
    deleted_count = deleted_qs.count()
    deleted_qs.delete()

    _track_opencore_stock_endpoint_usage(request, 'stock_ai_advisory_component_clear_deleted_api', status.HTTP_200_OK)
    return Response(
        {
            'ok': True,
            'symbol': normalized_symbol,
            'deleted_count': deleted_count,
            'message': 'Da xoa toan bo deleted tabs.',
        },
        status=status.HTTP_200_OK,
    )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def stock_ai_advisory_component_restore_api(request, component_id: int):
    denied_response = _enforce_opencore_feature_for_stock_endpoint(request, 'stock_ai_advisory_component_restore_api')
    if denied_response is not None:
        return denied_response

    component = AIAdvisoryComponentRecord.objects.filter(id=component_id, user=request.user, is_deleted=True).first()
    if component is None:
        return Response({'ok': False, 'message': 'Component khong ton tai hoac chua bi xoa.'}, status=status.HTTP_404_NOT_FOUND)

    quota_response = _enforce_opencore_quota_for_stock_endpoint(request, 'stock_ai_advisory_component_restore_api')
    if quota_response is not None:
        return quota_response

    component.is_deleted = False
    component.include_in_summary = True
    component.save(update_fields=['is_deleted', 'include_in_summary', 'updated_at'])
    _track_opencore_stock_endpoint_usage(request, 'stock_ai_advisory_component_restore_api', status.HTTP_200_OK)
    return Response({'ok': True, 'component': AIAdvisoryComponentRecordSerializer(component).data}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def stock_ai_advisory_summary_regenerate_api(request, symbol: str):
    denied_response = _enforce_opencore_feature_for_stock_endpoint(request, 'stock_ai_advisory_summary_regenerate_api')
    if denied_response is not None:
        return denied_response

    normalized_symbol = str(symbol or '').strip().upper()
    if not normalized_symbol:
        return Response({'ok': False, 'message': 'Symbol khong hop le.'}, status=status.HTTP_400_BAD_REQUEST)

    def _tracked_response(payload: dict, response_status: int):
        _track_opencore_stock_endpoint_usage(request, 'stock_ai_advisory_summary_regenerate_api', response_status)
        return Response(payload, status=response_status)

    user_cfg, _ = UserConfig.objects.get_or_create(user=request.user)
    ai_status = _get_ai_runtime_config_status(user_cfg)
    if not ai_status['ready']:
        return _tracked_response(
            {
                'ok': False,
                'message': ai_status['message'],
                'reason': 'ai_not_configured',
                'config_issue': ai_status['reason'],
            },
            status.HTTP_409_CONFLICT,
        )

    cooldown = max(int(getattr(settings, 'AI_ADVISORY_SUMMARY_REGEN_COOLDOWN_SECONDS', 30)), 5)
    lock_key = f'ai_advisory_summary_regen:{request.user.id}:{normalized_symbol}'
    if _cache_get(lock_key):
        return _tracked_response(
            {
                'ok': False,
                'message': 'Ban vua regenerate gan day, vui long thu lai sau.',
                'retry_after_seconds': cooldown,
            },
            status.HTTP_429_TOO_MANY_REQUESTS,
        )

    component_ids = request.data.get('component_ids')
    synthesis_preference = str(request.data.get('synthesis_preference') or 'balanced').strip().lower()
    if synthesis_preference not in {'short_term_action', 'risk_management', 'balanced'}:
        synthesis_preference = 'balanced'

    qs = AIAdvisoryComponentRecord.objects.filter(
        user=request.user,
        symbol=normalized_symbol,
        is_deleted=False,
        include_in_summary=True,
    )
    if isinstance(component_ids, list) and component_ids:
        qs = qs.filter(id__in=component_ids)

    components = list(qs.order_by('-created_at'))
    if not components:
        return _tracked_response({'ok': False, 'message': 'Khong co component active de tong hop.'}, status.HTTP_400_BAD_REQUEST)

    quota_response = _enforce_opencore_quota_for_stock_endpoint(request, 'stock_ai_advisory_summary_regenerate_api')
    if quota_response is not None:
        return quota_response

    latest = AIAdvisoryExecutiveSummary.objects.filter(user=request.user, symbol=normalized_symbol).order_by('-summary_version').first()
    summary_payload = _sprint17_compute_summary_from_components(components)
    ai_synthesis_text = _sprint17_generate_executive_synthesis_with_ai(
        user=request.user,
        symbol=normalized_symbol,
        components=components,
        summary_payload=summary_payload,
        synthesis_preference=synthesis_preference,
    )
    if ai_synthesis_text:
        summary_payload['synthesis_text'] = ai_synthesis_text
    summary_payload = _sprint17_enforce_summary_narrative_policy(summary_payload, components)
    summary = AIAdvisoryExecutiveSummary.objects.create(
        user=request.user,
        symbol=normalized_symbol,
        summary_version=(latest.summary_version + 1) if latest else 1,
        **summary_payload,
    )
    _cache_set(lock_key, timezone.now().isoformat(), timeout=cooldown)

    return _tracked_response({'ok': True, 'executive_summary': AIAdvisoryExecutiveSummarySerializer(summary).data}, status.HTTP_201_CREATED)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def stock_ai_advisory_summary_delete_api(request, symbol: str, summary_id: int):
    denied_response = _enforce_opencore_feature_for_stock_endpoint(request, 'stock_ai_advisory_summary_delete_api')
    if denied_response is not None:
        return denied_response

    normalized_symbol = str(symbol or '').strip().upper()
    if not normalized_symbol:
        return Response({'ok': False, 'message': 'Symbol khong hop le.'}, status=status.HTTP_400_BAD_REQUEST)

    quota_response = _enforce_opencore_quota_for_stock_endpoint(request, 'stock_ai_advisory_summary_delete_api')
    if quota_response is not None:
        return quota_response

    summary = AIAdvisoryExecutiveSummary.objects.filter(
        id=summary_id,
        user=request.user,
        symbol=normalized_symbol,
    ).first()
    if summary is None:
        return Response({'ok': False, 'message': 'Thong tin tong hop khong ton tai.'}, status=status.HTTP_404_NOT_FOUND)

    summary.delete()
    _track_opencore_stock_endpoint_usage(request, 'stock_ai_advisory_summary_delete_api', status.HTTP_200_OK)
    return Response(
        {
            'ok': True,
            'summary_id': summary_id,
            'message': 'Da xoa thong tin tong hop.',
        },
        status=status.HTTP_200_OK,
    )


def _build_session_v2_decision_digest(advisory_obj, snapshot_obj) -> dict:
    if advisory_obj is None:
        return {
            'score': 0.0,
            'score_band': 'neutral',
            'action': 'watch',
            'risk': 'medium',
        }

    state_json = snapshot_obj.state_json if snapshot_obj is not None and isinstance(snapshot_obj.state_json, dict) else {}
    quality = state_json.get('quality') if isinstance(state_json.get('quality'), dict) else {}

    score_value = quality.get('actionability')
    if score_value is None:
        threshold = float(advisory_obj.threshold or 0.0)
        ratio = (float(advisory_obj.matched_value or 0.0) / threshold) if threshold > 0 else 0.0
        score_value = max(0.0, min(ratio / 2.0, 1.0))
    score_value = max(0.0, min(float(score_value or 0.0), 1.0))

    if score_value >= 0.75:
        score_band = 'high'
    elif score_value >= 0.45:
        score_band = 'medium'
    else:
        score_band = 'low'

    action_map = {
        'BUY': 'accumulate',
        'SELL': 'reduce',
        'UNKNOWN': 'watch',
    }
    risk_map = {
        WhaleAdvisory.SeverityChoices.URGENT: 'high',
        WhaleAdvisory.SeverityChoices.WARNING: 'medium',
        WhaleAdvisory.SeverityChoices.INFO: 'low',
    }

    return {
        'score': round(score_value, 4),
        'score_band': score_band,
        'action': action_map.get(str(advisory_obj.side or '').upper(), 'watch'),
        'risk': risk_map.get(advisory_obj.severity, 'medium'),
    }


def _build_session_v2_benchmark_enrichment(symbol: str) -> dict:
    normalized_symbol = str(symbol or '').strip().upper()
    if not normalized_symbol:
        return {
            'vwap_deviation_pct': None,
            'rvol': None,
            'rvol_regime': 'unknown',
            'relative_strength_20d_pct': None,
            'mtf_confirmation_score': 0.0,
            'mtf_confirmation_label': 'unknown',
            'freshness': {'daily_price_date': None, 'intraday_tick_at': None},
        }

    recent_prices = list(
        DailyPrice.objects.filter(symbol=normalized_symbol)
        .order_by('-date')[:80]
    )
    benchmark_prices = list(
        DailyPrice.objects.filter(symbol='VNINDEX')
        .order_by('-date')[:80]
    )

    latest_price = float(recent_prices[0].close_price) if recent_prices else None
    latest_volume = float(recent_prices[0].volume or 0) if recent_prices else 0.0
    baseline_volumes = [float(item.volume or 0) for item in recent_prices[1:21] if float(item.volume or 0) > 0]

    rvol = None
    if latest_volume > 0 and baseline_volumes:
        baseline_avg = sum(baseline_volumes) / max(len(baseline_volumes), 1)
        if baseline_avg > 0:
            rvol = round(latest_volume / baseline_avg, 2)

    if rvol is None:
        rvol_regime = 'unknown'
    elif rvol >= 2.0:
        rvol_regime = 'spike'
    elif rvol >= 1.2:
        rvol_regime = 'elevated'
    elif rvol >= 0.8:
        rvol_regime = 'normal'
    else:
        rvol_regime = 'dry'

    relative_strength_20d_pct = None
    if len(recent_prices) > 20 and len(benchmark_prices) > 20:
        stock_ret = (float(recent_prices[0].close_price) / float(recent_prices[20].close_price)) - 1.0
        benchmark_ret = (float(benchmark_prices[0].close_price) / float(benchmark_prices[20].close_price)) - 1.0
        relative_strength_20d_pct = round((stock_ret - benchmark_ret) * 100.0, 2)

    mtf_votes = []
    if len(recent_prices) > 5:
        mtf_votes.append(float(recent_prices[0].close_price) >= float(recent_prices[5].close_price))
    if len(recent_prices) > 20:
        mtf_votes.append(float(recent_prices[0].close_price) >= float(recent_prices[20].close_price))
    if len(recent_prices) > 60:
        mtf_votes.append(float(recent_prices[0].close_price) >= float(recent_prices[60].close_price))

    if mtf_votes:
        mtf_confirmation_score = round(sum(1.0 for vote in mtf_votes if vote) / len(mtf_votes), 2)
    else:
        mtf_confirmation_score = 0.0

    if mtf_confirmation_score >= 0.8:
        mtf_confirmation_label = 'strong'
    elif mtf_confirmation_score >= 0.5:
        mtf_confirmation_label = 'mixed'
    elif mtf_votes:
        mtf_confirmation_label = 'weak'
    else:
        mtf_confirmation_label = 'unknown'

    latest_trade = (
        IntradayTick.objects.filter(symbol=normalized_symbol)
        .order_by('-trade_date', '-trade_time')
        .first()
    )
    vwap_deviation_pct = None
    intraday_tick_at = None
    if latest_trade is not None:
        intraday_tick_at = f'{latest_trade.trade_date}T{latest_trade.trade_time}'
        same_day_ticks = IntradayTick.objects.filter(symbol=normalized_symbol, trade_date=latest_trade.trade_date)
        total_volume = 0.0
        total_notional = 0.0
        for tick in same_day_ticks.iterator():
            tick_volume = float(tick.volume or 0)
            tick_price = float(tick.price or 0)
            total_volume += tick_volume
            total_notional += tick_price * tick_volume
        if total_volume > 0 and latest_trade.price is not None:
            vwap_value = total_notional / total_volume
            if vwap_value > 0:
                vwap_deviation_pct = round(((float(latest_trade.price) - vwap_value) / vwap_value) * 100.0, 2)

    daily_price_date = str(recent_prices[0].date) if recent_prices else None
    return {
        'vwap_deviation_pct': vwap_deviation_pct,
        'rvol': rvol,
        'rvol_regime': rvol_regime,
        'relative_strength_20d_pct': relative_strength_20d_pct,
        'mtf_confirmation_score': mtf_confirmation_score,
        'mtf_confirmation_label': mtf_confirmation_label,
        'freshness': {
            'daily_price_date': daily_price_date,
            'intraday_tick_at': intraday_tick_at,
        },
    }


def _build_session_v2_observability(user, symbol: str, advisory_obj, snapshot_obj) -> dict:
    normalized_symbol = str(symbol or '').strip().upper()
    severity_rank = {
        WhaleAdvisory.SeverityChoices.INFO: 1.0,
        WhaleAdvisory.SeverityChoices.WARNING: 2.0,
        WhaleAdvisory.SeverityChoices.URGENT: 3.0,
    }

    current_severity = str(getattr(advisory_obj, 'severity', WhaleAdvisory.SeverityChoices.INFO) or WhaleAdvisory.SeverityChoices.INFO)
    current_score = severity_rank.get(current_severity, 1.0)

    since_at = timezone.now() - timedelta(hours=24)
    recent_advisories = list(
        WhaleAdvisory.objects.filter(user=user, symbol=normalized_symbol, created_at__gte=since_at)
        .order_by('-created_at')[:40]
    )
    recent_scores = [severity_rank.get(str(item.severity or ''), 1.0) for item in recent_advisories]
    baseline_score = round(sum(recent_scores) / len(recent_scores), 2) if recent_scores else round(current_score, 2)
    severity_delta = round(current_score - baseline_score, 2)
    abs_delta = abs(severity_delta)
    if abs_delta >= 1.2:
        drift_label = 'high_drift'
    elif abs_delta >= 0.6:
        drift_label = 'moderate_drift'
    else:
        drift_label = 'stable'

    quality_metrics = _build_session_v2_aggregate_quality_metrics(advisory_obj, snapshot_obj)

    return {
        'severity_drift_24h': {
            'current': current_severity,
            'current_score': current_score,
            'baseline_score': baseline_score,
            'delta': severity_delta,
            'label': drift_label,
            'sample_size': len(recent_scores),
        },
        'aggregate_quality': {
            'score': quality_metrics['score'],
            'label': quality_metrics['label'],
            'actionability': quality_metrics['actionability'],
            'noise_ratio': quality_metrics['noise_ratio'],
            'consistency': quality_metrics['consistency'],
        },
    }


def _get_holistic_advisory_v1_gate_status(user) -> dict:
    if not bool(getattr(settings, 'HOLISTIC_ADVISORY_V1_ENABLED', True)):
        return {
            'enabled': False,
            'reason': 'global_disabled',
            'cohort_mode': str(getattr(settings, 'HOLISTIC_ADVISORY_V1_COHORT_MODE', 'all') or 'all').strip().lower(),
        }

    cohort_mode = str(getattr(settings, 'HOLISTIC_ADVISORY_V1_COHORT_MODE', 'all') or 'all').strip().lower()
    if cohort_mode == 'all':
        return {'enabled': True, 'reason': 'all', 'cohort_mode': cohort_mode}

    if cohort_mode == 'staff':
        is_staff = bool(getattr(user, 'is_staff', False) or getattr(user, 'is_superuser', False))
        return {
            'enabled': is_staff,
            'reason': 'staff' if is_staff else 'staff_only',
            'cohort_mode': cohort_mode,
        }

    if cohort_mode == 'allowlist':
        allowlist = getattr(settings, 'HOLISTIC_ADVISORY_V1_COHORT_USERNAMES', []) or []
        normalized_allowlist = {str(item).strip().lower() for item in allowlist if str(item).strip()}
        in_allowlist = str(getattr(user, 'username', '')).strip().lower() in normalized_allowlist
        return {
            'enabled': in_allowlist,
            'reason': 'allowlist' if in_allowlist else 'allowlist_blocked',
            'cohort_mode': cohort_mode,
        }

    # Unknown mode falls back to enabled to avoid accidental hard lockout.
    return {'enabled': True, 'reason': 'unknown_mode_fallback', 'cohort_mode': cohort_mode}


def _is_holistic_advisory_v1_enabled_for_user(user) -> bool:
    return bool(_get_holistic_advisory_v1_gate_status(user).get('enabled'))


def _log_holistic_rollout_gate_deny(*, user, symbol: str, endpoint: str, gate_status: dict) -> None:
    try:
        AdvisoryAggregateAuditLog.objects.create(
            user=user,
            symbol=symbol,
            before_state_json={},
            after_state_json={
                'operation': 'holistic_rollout_gate',
                'outcome': 'denied',
                'endpoint': endpoint,
            },
            reason=AdvisoryAggregateAuditLog.ReasonChoices.HOLISTIC_ROLLOUT_DENY,
            actor=AdvisoryAggregateAuditLog.ActorChoices.SYSTEM,
            actor_id='holistic_rollout_gate',
            metadata_json={
                'event_type': 'rollout_gate_deny',
                'endpoint': endpoint,
                'deny_reason': str(gate_status.get('reason') or '').strip().lower(),
                'cohort_mode': str(gate_status.get('cohort_mode') or '').strip().lower(),
            },
        )
    except Exception:
        logger.exception('Failed to persist holistic rollout deny audit log for %s/%s', user.id, symbol)


def _build_session_v2_aggregate_quality_metrics(advisory_obj, snapshot_obj) -> dict:
    state_json = snapshot_obj.state_json if snapshot_obj is not None and isinstance(snapshot_obj.state_json, dict) else {}
    quality = state_json.get('quality') if isinstance(state_json.get('quality'), dict) else {}
    actionability = quality.get('actionability')
    if actionability is None:
        actionability = _build_session_v2_decision_digest(advisory_obj, snapshot_obj).get('score', 0.0)
    actionability = max(0.0, min(float(actionability or 0.0), 1.0))

    noise_ratio = max(0.0, min(float(quality.get('noise_ratio', 0.5) or 0.5), 1.0))
    consistency = max(0.0, min(float(quality.get('consistency', 0.5) or 0.5), 1.0))
    quality_score = round(((actionability * 0.45) + ((1.0 - noise_ratio) * 0.25) + (consistency * 0.30)) * 100.0, 1)
    if quality_score >= 75:
        quality_label = 'high'
    elif quality_score >= 55:
        quality_label = 'medium'
    else:
        quality_label = 'low'

    return {
        'score': quality_score,
        'label': quality_label,
        'actionability': round(actionability, 4),
        'noise_ratio': round(noise_ratio, 4),
        'consistency': round(consistency, 4),
    }


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def stock_ai_advisory_session_api(request, symbol: str):
    """
    GET/POST /api/stock-management/stocks/<symbol>/ai-advisory-session/
    - GET: trả advisory mới nhất; nếu chưa có thì tự queue tạo advisory.
    - POST: refresh thủ công advisory cho mã hiện tại.
    """
    denied_response = _enforce_opencore_feature_for_stock_endpoint(request, 'stock_ai_advisory_session_api')
    if denied_response is not None:
        return denied_response

    normalized_symbol = str(symbol or '').strip().upper()
    if not normalized_symbol:
        return Response({'ok': False, 'message': 'Symbol không hợp lệ.'}, status=status.HTTP_400_BAD_REQUEST)

    quota_response = _enforce_opencore_quota_for_stock_endpoint(request, 'stock_ai_advisory_session_api')
    if quota_response is not None:
        return quota_response

    user_cfg, _ = UserConfig.objects.get_or_create(user=request.user)
    threshold_m = float(user_cfg.whale_alert_threshold or 500)
    threshold_vnd = threshold_m * 1_000_000
    holistic_gate_status = _get_holistic_advisory_v1_gate_status(request.user)
    holistic_v1_enabled = bool(holistic_gate_status.get('enabled'))
    session_v2_enabled = bool(getattr(settings, 'STOCK_AI_ADVISORY_SESSION_V2_ENABLED', False))
    benchmark_enrichment_enabled = bool(getattr(settings, 'STOCK_AI_ADVISORY_BENCHMARKS_ENABLED', False))
    contract_raw = str(request.query_params.get('contract') or '').strip().lower()
    include_benchmarks_raw = str(request.query_params.get('include_benchmarks') or '').strip().lower()
    include_benchmarks = include_benchmarks_raw in {'1', 'true', 'yes', 'on'}
    if contract_raw and contract_raw not in {'v1', 'v2'}:
        return Response({'ok': False, 'message': 'contract khong hop le. Ho tro: v1, v2.'}, status=status.HTTP_400_BAD_REQUEST)
    if contract_raw == 'v2' and not holistic_v1_enabled:
        _log_holistic_rollout_gate_deny(
            user=request.user,
            symbol=normalized_symbol,
            endpoint='stock_ai_advisory_session_api',
            gate_status=holistic_gate_status,
        )
        return Response(
            {
                'ok': False,
                'symbol': normalized_symbol,
                'reason': 'holistic_disabled',
                'message': 'Holistic Advisory V1 dang tat theo rollout gate.',
            },
            status=status.HTTP_403_FORBIDDEN,
        )
    if not holistic_v1_enabled:
        session_v2_enabled = False
        benchmark_enrichment_enabled = False
    if contract_raw == 'v1':
        session_v2_enabled = False
    elif contract_raw == 'v2':
        session_v2_enabled = True

    def _should_use_sync_fallback() -> bool:
        return bool(getattr(settings, 'STOCK_AI_ADVISORY_SYNC_FALLBACK_IF_NO_WORKER', True))

    def _queue_or_run(payload_kwargs: dict, *, force_sync: bool = False) -> dict:
        return _submit_advisory_generation_with_fallback(
            payload_kwargs=payload_kwargs,
            prefer_sync_fallback=_should_use_sync_fallback(),
            force_sync=force_sync,
            context_label=f'stock_ai_advisory_session_api:{normalized_symbol}',
        )

    def _serialize_latest(latest_advisory):
        if latest_advisory is None:
            return None
        data = WhaleAdvisorySerializer(latest_advisory).data
        if _get_plan(request.user) not in ('premium', 'admin'):
            data['ai_detail'] = ''
        return data

    def _build_session_payload(latest_advisory):
        payload = _sprint17_serialize_stock_advisory_session(request.user, normalized_symbol, latest_advisory)
        advisory_data = payload.get('advisory')
        if advisory_data and _get_plan(request.user) not in ('premium', 'admin'):
            advisory_data['ai_detail'] = ''
        payload['user_ai_provider'] = str(user_cfg.ai_provider or 'openclaw').strip().lower()
        payload['effective_ai_provider'] = ai_status.get('provider')
        payload['effective_ai_model'] = ai_status.get('model')
        payload['effective_ai_source'] = ai_status.get('source')
        payload['contract_version'] = 'v1'

        if session_v2_enabled:
            trace_payload = _build_advisory_trace_payload_for_user(
                user=request.user,
                symbol=normalized_symbol,
                advisory_id=latest_advisory.id if latest_advisory is not None else None,
                snapshot_id=(latest_advisory.aggregate_snapshot_id if latest_advisory is not None else None),
                max_logs=1,
                strict_after_state=True,
            )
            latest_log = (trace_payload.get('audit_logs') or [None])[0] if trace_payload.get('ok') else None
            snapshot_obj = latest_advisory.aggregate_snapshot if latest_advisory is not None else None
            decision_digest = _build_session_v2_decision_digest(latest_advisory, snapshot_obj)
            payload['contract_version'] = 'v2'
            payload['aggregate'] = {
                'advisory_id': latest_advisory.id if latest_advisory is not None else None,
                'snapshot_id': latest_advisory.aggregate_snapshot_id if latest_advisory is not None else None,
                'snapshot_seq': snapshot_obj.snapshot_seq if snapshot_obj is not None else None,
                'last_audit_reason': latest_log.get('reason') if latest_log else None,
                'last_audit_actor': latest_log.get('actor') if latest_log else None,
                'last_audit_at': latest_log.get('created_at') if latest_log else None,
                'decision': decision_digest,
                'observability': _build_session_v2_observability(request.user, normalized_symbol, latest_advisory, snapshot_obj),
            }
            if benchmark_enrichment_enabled or include_benchmarks:
                payload['aggregate']['benchmarks'] = _build_session_v2_benchmark_enrichment(normalized_symbol)
        return payload

    def _tracked_response(payload: dict, response_status: int):
        _track_opencore_stock_endpoint_usage(request, 'stock_ai_advisory_session_api', response_status)
        return Response(payload, status=response_status)

    latest = WhaleAdvisory.objects.filter(symbol=normalized_symbol, user=request.user).order_by('-created_at').first()
    ai_status = _get_ai_runtime_config_status(user_cfg)

    if request.method == 'GET':
        if latest is not None:
            return _tracked_response(
                {
                    'ok': True,
                    'queued': False,
                    'symbol': normalized_symbol,
                    **_build_session_payload(latest),
                },
                status.HTTP_200_OK,
            )

        auto_cooldown = max(int(getattr(settings, 'STOCK_AI_ADVISORY_AUTOGEN_COOLDOWN_SECONDS', 45)), 10)
        auto_lock_key = f'stock_ai_advisory_autogen_lock:{request.user.id}:{normalized_symbol}'
        if not ai_status['ready']:
            return _tracked_response(
                {
                    'ok': False,
                    'queued': False,
                    'symbol': normalized_symbol,
                    'advisory': None,
                    'components': [],
                    'deleted_components': [],
                    'executive_summary': None,
                    'executive_summaries': [],
                    'components_count': 0,
                    'active_components_count': 0,
                    'message': ai_status['message'],
                    'reason': 'ai_not_configured',
                    'config_issue': ai_status['reason'],
                },
                status.HTTP_409_CONFLICT,
            )
        if _cache_get(auto_lock_key):
            return _tracked_response(
                {
                    'ok': True,
                    'queued': False,
                    'symbol': normalized_symbol,
                    'advisory': None,
                    'message': 'Đang chờ advisory AI được tạo, vui lòng tải lại sau ít giây.',
                },
                status.HTTP_202_ACCEPTED,
            )

        # F3 Fix: Resolve symbol-specific threshold override for first-create session
        resolved_threshold_vnd, threshold_source = _resolve_first_create_threshold_vnd(
            request.user,
            normalized_symbol,
            threshold_vnd
        )

        payload_kwargs = {
            'symbol': normalized_symbol,
            'matched_value_vnd': resolved_threshold_vnd,
            'side': 'UNKNOWN',
            'threshold': resolved_threshold_vnd,
            'threshold_source': threshold_source,
            'force_refresh': False,
            'user_id': request.user.id,
        }
        force_sync_first_create = bool(getattr(settings, 'STOCK_AI_ADVISORY_FORCE_SYNC_FIRST_CREATE', True))
        submit_result = _queue_or_run(payload_kwargs, force_sync=force_sync_first_create)
        if submit_result.get('queue_error'):
            return _tracked_response(
                {
                    'ok': False,
                    'queued': False,
                    'symbol': normalized_symbol,
                    'advisory': None,
                    'components': [],
                    'deleted_components': [],
                    'executive_summary': None,
                    'executive_summaries': [],
                    'components_count': 0,
                    'active_components_count': 0,
                    'message': 'Khong the tao advisory luc nay (queue service tam thoi khong san sang). Vui long thu lai sau.',
                },
                status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        _cache_set(auto_lock_key, timezone.now().isoformat(), timeout=auto_cooldown)

        latest_after_submit = WhaleAdvisory.objects.filter(symbol=normalized_symbol, user=request.user).order_by('-created_at').first()
        if submit_result.get('sync') and latest_after_submit is not None:
            return _tracked_response(
                {
                    'ok': True,
                    'queued': False,
                    'symbol': normalized_symbol,
                    **_build_session_payload(latest_after_submit),
                    'message': 'Đã tạo AI Advisory trực tiếp trong phiên hiện tại.',
                },
                status.HTTP_200_OK,
            )

        return _tracked_response(
            {
                'ok': True,
                'queued': bool(submit_result.get('queued')),
                'symbol': normalized_symbol,
                'task_id': submit_result.get('task_id'),
                'advisory': None,
                'components': [],
                'executive_summary': None,
                'components_count': 0,
                'active_components_count': 0,
                'message': 'Đã gửi yêu cầu tạo AI Advisory cho mã này.' if submit_result.get('queued') else 'Đang xử lý AI Advisory trực tiếp.',
            },
            status.HTTP_202_ACCEPTED,
        )

    refresh_cooldown = max(int(getattr(settings, 'WHALE_ADVISORY_MANUAL_REFRESH_COOLDOWN_SECONDS', 90)), 10)
    refresh_lock_key = f'stock_ai_advisory_refresh_lock:{request.user.id}:{normalized_symbol}'
    if not ai_status['ready']:
        return _tracked_response(
            {
                'ok': False,
                'queued': False,
                'symbol': normalized_symbol,
                **_build_session_payload(latest),
                'message': ai_status['message'],
                'reason': 'ai_not_configured',
                'config_issue': ai_status['reason'],
            },
            status.HTTP_409_CONFLICT,
        )
    if _cache_get(refresh_lock_key):
        return _tracked_response(
            {
                'ok': False,
                'queued': False,
                'symbol': normalized_symbol,
                'message': 'Bạn vừa refresh gần đây, vui lòng thử lại sau.',
                'retry_after_seconds': refresh_cooldown,
            },
            status.HTTP_429_TOO_MANY_REQUESTS,
        )

    matched_value_vnd = float(latest.matched_value) if latest else threshold_vnd
    advisory_side = latest.side if latest else 'UNKNOWN'
    advisory_threshold = float(latest.threshold or 0) if latest else threshold_vnd
    payload_kwargs = {
        'symbol': normalized_symbol,
        'matched_value_vnd': matched_value_vnd,
        'side': advisory_side,
        'threshold': advisory_threshold,
        'force_refresh': True,
        'user_id': request.user.id,
        'source': WhaleAdvisory.SourceChoices.USER_REFRESH,
    }
    submit_result = _queue_or_run(payload_kwargs)
    if submit_result.get('queue_error'):
        return _tracked_response(
            {
                'ok': False,
                'queued': False,
                'symbol': normalized_symbol,
                **_build_session_payload(latest),
                'message': 'Khong the refresh advisory luc nay (queue service tam thoi khong san sang). Vui long thu lai sau.',
            },
            status.HTTP_503_SERVICE_UNAVAILABLE,
        )
    _cache_set(refresh_lock_key, timezone.now().isoformat(), timeout=refresh_cooldown)

    latest_after_refresh = WhaleAdvisory.objects.filter(symbol=normalized_symbol, user=request.user).order_by('-created_at').first()
    if submit_result.get('sync') and latest_after_refresh is not None:
        return _tracked_response(
            {
                'ok': True,
                'queued': False,
                'symbol': normalized_symbol,
                'task_id': None,
                **_build_session_payload(latest_after_refresh),
                'message': 'Đã refresh AI Advisory trực tiếp trong phiên hiện tại.',
            },
            status.HTTP_200_OK,
        )

    return _tracked_response(
        {
            'ok': True,
            'queued': bool(submit_result.get('queued')),
            'symbol': normalized_symbol,
            'task_id': submit_result.get('task_id'),
            **_build_session_payload(latest),
            'message': 'Đã gửi yêu cầu refresh AI Advisory cho mã này.' if submit_result.get('queued') else 'Đang refresh AI Advisory trực tiếp.',
        },
        status.HTTP_202_ACCEPTED,
    )


def _build_advisory_trace_payload_for_user(
    *,
    user,
    symbol: str,
    advisory_id: int | None,
    snapshot_id: int | None,
    max_logs: int,
    audit_reason: str = '',
    audit_actor: str = '',
    audit_start_at=None,
    audit_end_at=None,
    strict_after_state: bool = False,
) -> dict:
    advisory = None
    snapshot = None

    if advisory_id is not None:
        advisory = (
            WhaleAdvisory.objects.select_related('aggregate_snapshot')
            .filter(id=advisory_id, user=user, symbol=symbol)
            .first()
        )
        if advisory is None:
            return {'ok': False, 'message': 'Khong tim thay advisory theo advisory_id.'}
        snapshot = advisory.aggregate_snapshot
        if snapshot is not None and snapshot_id is None:
            snapshot_id = snapshot.id

    if snapshot_id is not None and snapshot is None:
        snapshot = AdvisoryAggregateSnapshot.objects.filter(
            id=snapshot_id,
            user=user,
            symbol=symbol,
        ).first()
        if snapshot is None:
            return {'ok': False, 'message': 'Khong tim thay snapshot theo snapshot_id.'}

    if advisory is None and snapshot is not None:
        advisory = (
            WhaleAdvisory.objects.filter(user=user, symbol=symbol, aggregate_snapshot=snapshot)
            .order_by('-created_at')
            .first()
        )
        if advisory is not None and advisory_id is None:
            advisory_id = advisory.id

    if advisory is None and snapshot is None:
        return {'ok': False, 'message': 'Can truyen advisory_id hoac snapshot_id hop le cho symbol nay.'}

    def _matches_trace(log_item) -> bool:
        before_state = log_item.before_state_json or {}
        after_state = log_item.after_state_json or {}
        metadata = log_item.metadata_json or {}

        advisory_candidates = {
            before_state.get('advisory_id'),
            after_state.get('advisory_id'),
            metadata.get('advisory_id'),
        }
        snapshot_candidates = {
            before_state.get('snapshot_id'),
            after_state.get('snapshot_id'),
            metadata.get('snapshot_id'),
        }

        if strict_after_state:
            advisory_ok = advisory_id is None or after_state.get('advisory_id') == advisory_id
            snapshot_ok = snapshot_id is None or after_state.get('snapshot_id') == snapshot_id
        else:
            advisory_ok = advisory_id is None or advisory_id in advisory_candidates
            snapshot_ok = snapshot_id is None or snapshot_id in snapshot_candidates
        reason_ok = not audit_reason or log_item.reason == audit_reason
        actor_ok = not audit_actor or log_item.actor == audit_actor
        start_ok = audit_start_at is None or (log_item.created_at is not None and log_item.created_at >= audit_start_at)
        end_ok = audit_end_at is None or (log_item.created_at is not None and log_item.created_at <= audit_end_at)
        return advisory_ok and snapshot_ok and reason_ok and actor_ok and start_ok and end_ok

    matched_logs = []
    logs_qs = AdvisoryAggregateAuditLog.objects.filter(user=user, symbol=symbol).order_by('-created_at')
    for log_item in logs_qs.iterator():
        if _matches_trace(log_item):
            matched_logs.append(log_item)
            if len(matched_logs) >= max_logs:
                break

    return {
        'ok': True,
        'trace': {
            'symbol': symbol,
            'advisory_id': advisory_id,
            'snapshot_id': snapshot_id,
            'replay_ready': bool(snapshot_id),
        },
        'advisory': {
            'id': advisory.id if advisory else None,
            'created_at': advisory.created_at.isoformat() if advisory and advisory.created_at else None,
            'source': advisory.source if advisory else '',
            'severity': advisory.severity if advisory else '',
            'threshold': float(advisory.threshold or 0) if advisory else 0.0,
            'aggregate_snapshot_id': advisory.aggregate_snapshot_id if advisory else None,
            'ai_provider': advisory.ai_provider if advisory else '',
            'ai_model': advisory.ai_model if advisory else '',
        },
        'snapshot': {
            'id': snapshot.id if snapshot else None,
            'snapshot_seq': snapshot.snapshot_seq if snapshot else None,
            'created_at': snapshot.created_at.isoformat() if snapshot and snapshot.created_at else None,
            'expires_at': snapshot.expires_at.isoformat() if snapshot and snapshot.expires_at else None,
            'state_json': snapshot.state_json if snapshot else {},
        },
        'audit_logs': [
            {
                'id': log_item.id,
                'created_at': log_item.created_at.isoformat() if log_item.created_at else None,
                'reason': log_item.reason,
                'actor': log_item.actor,
                'actor_id': log_item.actor_id,
                'before_state_json': log_item.before_state_json,
                'after_state_json': log_item.after_state_json,
                'metadata_json': log_item.metadata_json,
            }
            for log_item in matched_logs
        ],
        'counts': {
            'matched_audit_logs': len(matched_logs),
            'max_logs': max_logs,
        },
    }


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def stock_ai_advisory_trace_api(request, symbol: str):
    from django.utils.dateparse import parse_datetime

    normalized_symbol = str(symbol or '').strip().upper()
    if not normalized_symbol:
        return Response({'ok': False, 'message': 'Symbol khong hop le.'}, status=status.HTTP_400_BAD_REQUEST)

    advisory_id_raw = request.query_params.get('advisory_id')
    snapshot_id_raw = request.query_params.get('snapshot_id')
    max_logs_raw = request.query_params.get('max_logs')
    reason_raw = str(request.query_params.get('reason') or '').strip().lower()
    actor_raw = str(request.query_params.get('actor') or '').strip().lower()
    start_at_raw = str(request.query_params.get('start_at') or '').strip()
    end_at_raw = str(request.query_params.get('end_at') or '').strip()

    try:
        advisory_id = int(advisory_id_raw) if advisory_id_raw not in (None, '') else None
    except (TypeError, ValueError):
        return Response({'ok': False, 'message': 'advisory_id khong hop le.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        snapshot_id = int(snapshot_id_raw) if snapshot_id_raw not in (None, '') else None
    except (TypeError, ValueError):
        return Response({'ok': False, 'message': 'snapshot_id khong hop le.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        max_logs = max(int(max_logs_raw or 20), 1)
    except (TypeError, ValueError):
        return Response({'ok': False, 'message': 'max_logs khong hop le.'}, status=status.HTTP_400_BAD_REQUEST)

    valid_reasons = {value for value, _ in AdvisoryAggregateAuditLog.ReasonChoices.choices}
    valid_actors = {value for value, _ in AdvisoryAggregateAuditLog.ActorChoices.choices}
    if reason_raw and reason_raw not in valid_reasons:
        return Response({'ok': False, 'message': 'reason khong hop le.'}, status=status.HTTP_400_BAD_REQUEST)
    if actor_raw and actor_raw not in valid_actors:
        return Response({'ok': False, 'message': 'actor khong hop le.'}, status=status.HTTP_400_BAD_REQUEST)

    start_at = None
    end_at = None
    if start_at_raw:
        start_at = parse_datetime(start_at_raw)
        if not start_at:
            return Response({'ok': False, 'message': 'start_at khong dung dinh dang ISO datetime.'}, status=status.HTTP_400_BAD_REQUEST)
    if end_at_raw:
        end_at = parse_datetime(end_at_raw)
        if not end_at:
            return Response({'ok': False, 'message': 'end_at khong dung dinh dang ISO datetime.'}, status=status.HTTP_400_BAD_REQUEST)
    if start_at is not None and end_at is not None and start_at > end_at:
        return Response({'ok': False, 'message': 'start_at phai <= end_at.'}, status=status.HTTP_400_BAD_REQUEST)

    payload = _build_advisory_trace_payload_for_user(
        user=request.user,
        symbol=normalized_symbol,
        advisory_id=advisory_id,
        snapshot_id=snapshot_id,
        max_logs=max_logs,
        audit_reason=reason_raw,
        audit_actor=actor_raw,
        audit_start_at=start_at,
        audit_end_at=end_at,
    )
    if not payload.get('ok'):
        return Response(payload, status=status.HTTP_404_NOT_FOUND)

    return Response(payload, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def stock_ai_advisory_trace_list_api(request, symbol: str):
    from django.utils.dateparse import parse_datetime

    normalized_symbol = str(symbol or '').strip().upper()
    if not normalized_symbol:
        return Response({'ok': False, 'message': 'Symbol khong hop le.'}, status=status.HTTP_400_BAD_REQUEST)

    limit_raw = request.query_params.get('limit')
    cursor_raw = request.query_params.get('cursor')
    reason_raw = str(request.query_params.get('reason') or '').strip().lower()
    actor_raw = str(request.query_params.get('actor') or '').strip().lower()
    start_at_raw = str(request.query_params.get('start_at') or '').strip()
    end_at_raw = str(request.query_params.get('end_at') or '').strip()

    try:
        limit = max(int(limit_raw or 20), 1)
        limit = min(limit, 100)
    except (TypeError, ValueError):
        return Response({'ok': False, 'message': 'limit khong hop le.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        cursor = int(cursor_raw) if cursor_raw not in (None, '') else None
    except (TypeError, ValueError):
        return Response({'ok': False, 'message': 'cursor khong hop le.'}, status=status.HTTP_400_BAD_REQUEST)

    valid_reasons = {value for value, _ in AdvisoryAggregateAuditLog.ReasonChoices.choices}
    valid_actors = {value for value, _ in AdvisoryAggregateAuditLog.ActorChoices.choices}
    if reason_raw and reason_raw not in valid_reasons:
        return Response({'ok': False, 'message': 'reason khong hop le.'}, status=status.HTTP_400_BAD_REQUEST)
    if actor_raw and actor_raw not in valid_actors:
        return Response({'ok': False, 'message': 'actor khong hop le.'}, status=status.HTTP_400_BAD_REQUEST)

    start_at = None
    end_at = None
    if start_at_raw:
        start_at = parse_datetime(start_at_raw)
        if not start_at:
            return Response({'ok': False, 'message': 'start_at khong dung dinh dang ISO datetime.'}, status=status.HTTP_400_BAD_REQUEST)
    if end_at_raw:
        end_at = parse_datetime(end_at_raw)
        if not end_at:
            return Response({'ok': False, 'message': 'end_at khong dung dinh dang ISO datetime.'}, status=status.HTTP_400_BAD_REQUEST)
    if start_at is not None and end_at is not None and start_at > end_at:
        return Response({'ok': False, 'message': 'start_at phai <= end_at.'}, status=status.HTTP_400_BAD_REQUEST)

    advisories_qs = (
        WhaleAdvisory.objects.select_related('aggregate_snapshot')
        .filter(user=request.user, symbol=normalized_symbol)
        .order_by('-id')
    )
    if cursor is not None:
        advisories_qs = advisories_qs.filter(id__lt=cursor)

    advisories = []
    for advisory_item in advisories_qs.iterator():
        advisories.append(advisory_item)
        if len(advisories) >= 500:
            break

    items = []
    has_audit_filters = bool(reason_raw or actor_raw or start_at is not None or end_at is not None)
    for advisory in advisories:
        snapshot = advisory.aggregate_snapshot
        trace_payload = _build_advisory_trace_payload_for_user(
            user=request.user,
            symbol=normalized_symbol,
            advisory_id=advisory.id,
            snapshot_id=snapshot.id if snapshot is not None else None,
            max_logs=5,
            audit_reason=reason_raw,
            audit_actor=actor_raw,
            audit_start_at=start_at,
            audit_end_at=end_at,
            strict_after_state=True,
        )
        if not trace_payload.get('ok'):
            continue
        matched_count = trace_payload.get('counts', {}).get('matched_audit_logs', 0)
        if has_audit_filters and matched_count <= 0:
            continue

        items.append(
            {
                'advisory_id': advisory.id,
                'created_at': advisory.created_at.isoformat() if advisory.created_at else None,
                'severity': advisory.severity,
                'source': advisory.source,
                'snapshot_id': advisory.aggregate_snapshot_id,
                'snapshot_seq': snapshot.snapshot_seq if snapshot is not None else None,
                'matched_audit_logs': matched_count,
                'last_audit_reason': (
                    (trace_payload.get('audit_logs') or [{}])[0].get('reason')
                    if trace_payload.get('audit_logs')
                    else ''
                ),
            }
        )
        if len(items) >= limit:
            break

    has_more = len(items) == limit and advisories_qs.filter(id__lt=items[-1]['advisory_id']).exists()
    next_cursor = items[-1]['advisory_id'] if has_more else None

    return Response(
        {
            'ok': True,
            'symbol': normalized_symbol,
            'items': items,
            'filters': {
                'reason': reason_raw or None,
                'actor': actor_raw or None,
                'start_at': start_at_raw or None,
                'end_at': end_at_raw or None,
            },
            'paging': {
                'limit': limit,
                'cursor': cursor,
                'next_cursor': next_cursor,
                'has_more': has_more,
            },
        },
        status=status.HTTP_200_OK,
    )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def stock_ai_advisory_trace_export_api(request, symbol: str):
    from django.utils.dateparse import parse_datetime

    normalized_symbol = str(symbol or '').strip().upper()
    if not normalized_symbol:
        return Response({'ok': False, 'message': 'Symbol khong hop le.'}, status=status.HTTP_400_BAD_REQUEST)

    advisory_id_raw = request.query_params.get('advisory_id')
    snapshot_id_raw = request.query_params.get('snapshot_id')
    max_logs_raw = request.query_params.get('max_logs')
    history_limit_raw = request.query_params.get('history_limit')
    contract_raw = str(request.query_params.get('contract') or 'v2').strip().lower()
    reason_raw = str(request.query_params.get('reason') or '').strip().lower()
    actor_raw = str(request.query_params.get('actor') or '').strip().lower()
    start_at_raw = str(request.query_params.get('start_at') or '').strip()
    end_at_raw = str(request.query_params.get('end_at') or '').strip()

    if contract_raw not in {'v1', 'v2'}:
        return Response({'ok': False, 'message': 'contract khong hop le. Ho tro: v1, v2.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        advisory_id = int(advisory_id_raw) if advisory_id_raw not in (None, '') else None
    except (TypeError, ValueError):
        return Response({'ok': False, 'message': 'advisory_id khong hop le.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        snapshot_id = int(snapshot_id_raw) if snapshot_id_raw not in (None, '') else None
    except (TypeError, ValueError):
        return Response({'ok': False, 'message': 'snapshot_id khong hop le.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        max_logs = max(int(max_logs_raw or 20), 1)
        max_logs = min(max_logs, 200)
    except (TypeError, ValueError):
        return Response({'ok': False, 'message': 'max_logs khong hop le.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        history_limit = max(int(history_limit_raw or 10), 1)
        history_limit = min(history_limit, 50)
    except (TypeError, ValueError):
        return Response({'ok': False, 'message': 'history_limit khong hop le.'}, status=status.HTTP_400_BAD_REQUEST)

    valid_reasons = {value for value, _ in AdvisoryAggregateAuditLog.ReasonChoices.choices}
    valid_actors = {value for value, _ in AdvisoryAggregateAuditLog.ActorChoices.choices}
    if reason_raw and reason_raw not in valid_reasons:
        return Response({'ok': False, 'message': 'reason khong hop le.'}, status=status.HTTP_400_BAD_REQUEST)
    if actor_raw and actor_raw not in valid_actors:
        return Response({'ok': False, 'message': 'actor khong hop le.'}, status=status.HTTP_400_BAD_REQUEST)

    start_at = None
    end_at = None
    if start_at_raw:
        start_at = parse_datetime(start_at_raw)
        if not start_at:
            return Response({'ok': False, 'message': 'start_at khong dung dinh dang ISO datetime.'}, status=status.HTTP_400_BAD_REQUEST)
    if end_at_raw:
        end_at = parse_datetime(end_at_raw)
        if not end_at:
            return Response({'ok': False, 'message': 'end_at khong dung dinh dang ISO datetime.'}, status=status.HTTP_400_BAD_REQUEST)
    if start_at is not None and end_at is not None and start_at > end_at:
        return Response({'ok': False, 'message': 'start_at phai <= end_at.'}, status=status.HTTP_400_BAD_REQUEST)

    trace_payload = _build_advisory_trace_payload_for_user(
        user=request.user,
        symbol=normalized_symbol,
        advisory_id=advisory_id,
        snapshot_id=snapshot_id,
        max_logs=max_logs,
        audit_reason=reason_raw,
        audit_actor=actor_raw,
        audit_start_at=start_at,
        audit_end_at=end_at,
    )
    if not trace_payload.get('ok'):
        return Response(trace_payload, status=status.HTTP_404_NOT_FOUND)

    advisory_ref_id = trace_payload.get('advisory', {}).get('id')
    advisory_obj = (
        WhaleAdvisory.objects.select_related('aggregate_snapshot')
        .filter(id=advisory_ref_id, user=request.user, symbol=normalized_symbol)
        .first()
    )
    snapshot_obj = advisory_obj.aggregate_snapshot if advisory_obj is not None else None

    user_cfg, _ = UserConfig.objects.get_or_create(user=request.user)
    ai_status = _get_ai_runtime_config_status(user_cfg)
    advisory_data = WhaleAdvisorySerializer(advisory_obj).data if advisory_obj is not None else None
    if advisory_data and _get_plan(request.user) not in ('premium', 'admin'):
        advisory_data['ai_detail'] = ''

    session_payload = {
        'contract_version': contract_raw,
        'symbol': normalized_symbol,
        'advisory': advisory_data,
        'effective_ai_provider': ai_status.get('provider'),
        'effective_ai_model': ai_status.get('model'),
        'effective_ai_source': ai_status.get('source'),
    }
    if contract_raw == 'v2':
        latest_log = (trace_payload.get('audit_logs') or [None])[0]
        session_payload['aggregate'] = {
            'advisory_id': advisory_obj.id if advisory_obj is not None else None,
            'snapshot_id': advisory_obj.aggregate_snapshot_id if advisory_obj is not None else None,
            'snapshot_seq': snapshot_obj.snapshot_seq if snapshot_obj is not None else None,
            'last_audit_reason': latest_log.get('reason') if latest_log else None,
            'last_audit_actor': latest_log.get('actor') if latest_log else None,
            'last_audit_at': latest_log.get('created_at') if latest_log else None,
            'decision': _build_session_v2_decision_digest(advisory_obj, snapshot_obj),
            'observability': _build_session_v2_observability(request.user, normalized_symbol, advisory_obj, snapshot_obj),
        }

    history_qs = (
        WhaleAdvisory.objects.select_related('aggregate_snapshot')
        .filter(user=request.user, symbol=normalized_symbol)
        .order_by('-id')
    )
    if advisory_obj is not None:
        history_qs = history_qs.filter(id__lte=advisory_obj.id)

    history_items = []
    has_audit_filters = bool(reason_raw or actor_raw or start_at is not None or end_at is not None)
    for advisory_item in history_qs.iterator():
        history_snapshot = advisory_item.aggregate_snapshot
        item_trace_payload = _build_advisory_trace_payload_for_user(
            user=request.user,
            symbol=normalized_symbol,
            advisory_id=advisory_item.id,
            snapshot_id=history_snapshot.id if history_snapshot is not None else None,
            max_logs=2,
            audit_reason=reason_raw,
            audit_actor=actor_raw,
            audit_start_at=start_at,
            audit_end_at=end_at,
            strict_after_state=True,
        )
        if not item_trace_payload.get('ok'):
            continue
        matched_count = item_trace_payload.get('counts', {}).get('matched_audit_logs', 0)
        if has_audit_filters and matched_count <= 0:
            continue

        history_items.append(
            {
                'advisory_id': advisory_item.id,
                'created_at': advisory_item.created_at.isoformat() if advisory_item.created_at else None,
                'source': advisory_item.source,
                'severity': advisory_item.severity,
                'snapshot_id': advisory_item.aggregate_snapshot_id,
                'snapshot_seq': history_snapshot.snapshot_seq if history_snapshot is not None else None,
                'matched_audit_logs': matched_count,
                'last_audit_reason': (
                    (item_trace_payload.get('audit_logs') or [{}])[0].get('reason')
                    if item_trace_payload.get('audit_logs')
                    else None
                ),
            }
        )
        if len(history_items) >= history_limit:
            break

    history_has_more = len(history_items) == history_limit and history_qs.filter(id__lt=history_items[-1]['advisory_id']).exists()

    return Response(
        {
            'ok': True,
            'symbol': normalized_symbol,
            'exported_at': timezone.now().isoformat(),
            'filters': {
                'contract': contract_raw,
                'reason': reason_raw or None,
                'actor': actor_raw or None,
                'start_at': start_at_raw or None,
                'end_at': end_at_raw or None,
            },
            'session': session_payload,
            'trace': trace_payload,
            'history': {
                'limit': history_limit,
                'has_more': history_has_more,
                'items': history_items,
            },
        },
        status=status.HTTP_200_OK,
    )


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def stock_ai_advisory_observability_api(request, symbol: str):
    normalized_symbol = str(symbol or '').strip().upper()
    if not normalized_symbol:
        return Response({'ok': False, 'message': 'Symbol khong hop le.'}, status=status.HTTP_400_BAD_REQUEST)

    holistic_gate_status = _get_holistic_advisory_v1_gate_status(request.user)
    if not bool(holistic_gate_status.get('enabled')):
        _log_holistic_rollout_gate_deny(
            user=request.user,
            symbol=normalized_symbol,
            endpoint='stock_ai_advisory_observability_api',
            gate_status=holistic_gate_status,
        )
        return Response(
            {
                'ok': False,
                'symbol': normalized_symbol,
                'reason': 'holistic_disabled',
                'message': 'Holistic Advisory V1 dang tat theo rollout gate.',
            },
            status=status.HTTP_403_FORBIDDEN,
        )

    if request.method == 'POST':
        payload = request.data if isinstance(request.data, dict) else {}
        telemetry = payload.get('telemetry') if isinstance(payload.get('telemetry'), dict) else {}

        event_type = str(payload.get('event_type') or 'frontend_retry_telemetry').strip()[:80]
        outcome = str(payload.get('outcome') or '').strip()[:60]
        client_ts = str(payload.get('client_ts') or '').strip()[:64]

        def _safe_non_negative_int(value, default=0):
            try:
                parsed = int(value)
                return parsed if parsed >= 0 else default
            except (TypeError, ValueError):
                return default

        scheduled_count = _safe_non_negative_int(telemetry.get('scheduled_count', 0))
        recovered_count = _safe_non_negative_int(telemetry.get('recovered_count', 0))
        failed_count = _safe_non_negative_int(telemetry.get('failed_count', 0))
        last_reason = str(telemetry.get('last_reason') or '').strip()[:120]

        metadata_payload = {
            'event_type': event_type,
            'outcome': outcome,
            'telemetry': {
                'scheduled_count': scheduled_count,
                'recovered_count': recovered_count,
                'failed_count': failed_count,
                'last_reason': last_reason,
                'last_event_at': str(telemetry.get('last_event_at') or '').strip()[:64],
            },
            'client_ts': client_ts,
        }

        audit_log = AdvisoryAggregateAuditLog.objects.create(
            user=request.user,
            symbol=normalized_symbol,
            before_state_json={},
            after_state_json={
                'operation': 'frontend_retry_telemetry',
                'outcome': outcome,
                'event_type': event_type,
            },
            reason=AdvisoryAggregateAuditLog.ReasonChoices.MANUAL_REFRESH,
            actor=AdvisoryAggregateAuditLog.ActorChoices.USER,
            actor_id=str(request.user.id),
            metadata_json=metadata_payload,
        )

        return Response(
            {
                'ok': True,
                'symbol': normalized_symbol,
                'log_id': audit_log.id,
                'message': 'Telemetry recorded.',
            },
            status=status.HTTP_201_CREATED,
        )

    limit_raw = request.query_params.get('limit')
    window_hours_raw = request.query_params.get('window_hours')
    try:
        limit = max(int(limit_raw or 20), 1)
        limit = min(limit, 100)
    except (TypeError, ValueError):
        return Response({'ok': False, 'message': 'limit khong hop le.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        window_hours = max(int(window_hours_raw or 24), 1)
        window_hours = min(window_hours, 168)
    except (TypeError, ValueError):
        return Response({'ok': False, 'message': 'window_hours khong hop le.'}, status=status.HTTP_400_BAD_REQUEST)

    retry_outcome_filter = str(request.query_params.get('retry_outcome') or '').strip().lower()
    retry_reason_filter = str(request.query_params.get('retry_reason') or '').strip().lower()
    retry_sort = str(request.query_params.get('retry_sort') or 'newest').strip().lower()
    governance_bucket = str(request.query_params.get('governance_bucket') or 'hour').strip().lower()
    governance_endpoint_filter = str(request.query_params.get('governance_endpoint') or '').strip().lower()
    governance_reason_filter = str(request.query_params.get('governance_reason') or '').strip().lower()
    valid_retry_sort_values = {'newest', 'oldest', 'most_failed'}
    if retry_sort not in valid_retry_sort_values:
        return Response({'ok': False, 'message': 'retry_sort khong hop le.'}, status=status.HTTP_400_BAD_REQUEST)
    if governance_bucket not in {'hour', 'day'}:
        return Response({'ok': False, 'message': 'governance_bucket khong hop le.'}, status=status.HTTP_400_BAD_REQUEST)

    runtime_thresholds = _get_runtime_governance_delta_thresholds()
    warning_threshold = runtime_thresholds['warning']
    critical_threshold = runtime_thresholds['critical']
    cooldown_threshold = runtime_thresholds['cooldown']

    def _safe_int(value, default=0):
        try:
            return int(value)
        except (TypeError, ValueError):
            return default

    since_at = timezone.now() - timedelta(hours=window_hours)
    advisories = list(
        WhaleAdvisory.objects.select_related('aggregate_snapshot')
        .filter(user=request.user, symbol=normalized_symbol, created_at__gte=since_at)
        .order_by('-created_at')[:limit]
    )

    severity_rank = {
        WhaleAdvisory.SeverityChoices.INFO: 1.0,
        WhaleAdvisory.SeverityChoices.WARNING: 2.0,
        WhaleAdvisory.SeverityChoices.URGENT: 3.0,
    }

    timeline = []
    severity_scores = []
    quality_scores = []
    for advisory in advisories:
        snapshot = advisory.aggregate_snapshot
        quality_metrics = _build_session_v2_aggregate_quality_metrics(advisory, snapshot)
        severity_score = severity_rank.get(str(advisory.severity or ''), 1.0)
        severity_scores.append(severity_score)
        quality_scores.append(quality_metrics['score'])
        timeline.append(
            {
                'advisory_id': advisory.id,
                'created_at': advisory.created_at.isoformat() if advisory.created_at else None,
                'source': advisory.source,
                'severity': advisory.severity,
                'severity_score': severity_score,
                'snapshot_id': advisory.aggregate_snapshot_id,
                'snapshot_seq': snapshot.snapshot_seq if snapshot is not None else None,
                'aggregate_quality': quality_metrics,
            }
        )

    current_severity = timeline[0]['severity'] if timeline else WhaleAdvisory.SeverityChoices.INFO
    current_severity_score = timeline[0]['severity_score'] if timeline else 1.0
    baseline_score = round(sum(severity_scores) / len(severity_scores), 2) if severity_scores else 1.0
    severity_delta = round(current_severity_score - baseline_score, 2)
    drift_label = 'high_drift' if abs(severity_delta) >= 1.2 else 'moderate_drift' if abs(severity_delta) >= 0.6 else 'stable'
    avg_quality_score = round(sum(quality_scores) / len(quality_scores), 1) if quality_scores else 0.0

    audit_logs = list(
        AdvisoryAggregateAuditLog.objects.filter(
            user=request.user,
            symbol=normalized_symbol,
            created_at__gte=since_at,
        ).order_by('-created_at')[:200]
    )
    retry_events = []
    retry_scheduled_total = 0
    retry_recovered_total = 0
    retry_failed_total = 0
    rollout_deny_total = 0
    rollout_deny_by_endpoint = {}
    rollout_deny_by_reason = {}
    rollout_gate_cohort_modes = set()
    rollout_deny_trend = {}
    for log_item in audit_logs:
        metadata = log_item.metadata_json or {}
        event_type = str(metadata.get('event_type') or '').strip().lower()
        if event_type == 'rollout_gate_deny':
            endpoint = str(metadata.get('endpoint') or '').strip().lower()
            deny_reason = str(metadata.get('deny_reason') or '').strip().lower()
            cohort_mode = str(metadata.get('cohort_mode') or '').strip().lower()

            if governance_endpoint_filter and endpoint != governance_endpoint_filter:
                continue
            if governance_reason_filter and deny_reason != governance_reason_filter:
                continue

            rollout_deny_total += 1
            if endpoint:
                rollout_deny_by_endpoint[endpoint] = rollout_deny_by_endpoint.get(endpoint, 0) + 1
            if deny_reason:
                rollout_deny_by_reason[deny_reason] = rollout_deny_by_reason.get(deny_reason, 0) + 1
            if cohort_mode:
                rollout_gate_cohort_modes.add(cohort_mode)

            created_at = log_item.created_at
            if created_at is not None:
                local_dt = timezone.localtime(created_at)
                if governance_bucket == 'day':
                    bucket_key = local_dt.strftime('%Y-%m-%d')
                else:
                    bucket_key = local_dt.strftime('%Y-%m-%d %H:00')

                bucket_payload = rollout_deny_trend.setdefault(
                    bucket_key,
                    {
                        'bucket': bucket_key,
                        'deny_total': 0,
                        'deny_by_endpoint': {},
                        'deny_by_reason': {},
                        'deny_by_cohort_mode': {},
                    },
                )
                bucket_payload['deny_total'] += 1
                if endpoint:
                    bucket_payload['deny_by_endpoint'][endpoint] = bucket_payload['deny_by_endpoint'].get(endpoint, 0) + 1
                if deny_reason:
                    bucket_payload['deny_by_reason'][deny_reason] = bucket_payload['deny_by_reason'].get(deny_reason, 0) + 1
                if cohort_mode:
                    bucket_payload['deny_by_cohort_mode'][cohort_mode] = bucket_payload['deny_by_cohort_mode'].get(cohort_mode, 0) + 1

        if str(metadata.get('event_type') or '') != 'frontend_retry_telemetry':
            continue

        telemetry_payload = metadata.get('telemetry') if isinstance(metadata.get('telemetry'), dict) else {}
        scheduled_count = _safe_int(telemetry_payload.get('scheduled_count') or 0)
        recovered_count = _safe_int(telemetry_payload.get('recovered_count') or 0)
        failed_count = _safe_int(telemetry_payload.get('failed_count') or 0)
        retry_scheduled_total += scheduled_count
        retry_recovered_total += recovered_count
        retry_failed_total += failed_count

        event_payload = {
            'log_id': log_item.id,
            'created_at': log_item.created_at.isoformat() if log_item.created_at else None,
            'outcome': str(metadata.get('outcome') or '').lower(),
            'reason': str(telemetry_payload.get('last_reason') or '').lower(),
            'scheduled_count': scheduled_count,
            'recovered_count': recovered_count,
            'failed_count': failed_count,
            'client_ts': metadata.get('client_ts') or '',
        }

        if retry_outcome_filter and event_payload['outcome'] != retry_outcome_filter:
            continue
        if retry_reason_filter and event_payload['reason'] != retry_reason_filter:
            continue
        retry_events.append(event_payload)

    if retry_sort == 'oldest':
        retry_events.sort(key=lambda item: str(item.get('created_at') or ''))
    elif retry_sort == 'most_failed':
        retry_events.sort(
            key=lambda item: (int(item.get('failed_count') or 0), str(item.get('created_at') or '')),
            reverse=True,
        )
    else:
        retry_events.sort(key=lambda item: str(item.get('created_at') or ''), reverse=True)

    retry_events = retry_events[:limit]

    return Response(
        {
            'ok': True,
            'symbol': normalized_symbol,
            'window_hours': window_hours,
            'limit': limit,
            'retry_filters': {
                'outcome': retry_outcome_filter or None,
                'reason': retry_reason_filter or None,
                'sort': retry_sort,
            },
            'summary': {
                'current_severity': current_severity,
                'current_severity_score': current_severity_score,
                'baseline_severity_score': baseline_score,
                'severity_delta': severity_delta,
                'severity_drift_label': drift_label,
                'avg_aggregate_quality_score': avg_quality_score,
                'sample_size': len(timeline),
                'retry_scheduled_total': retry_scheduled_total,
                'retry_recovered_total': retry_recovered_total,
                'retry_failed_total': retry_failed_total,
                'rollout_gate_deny_total': rollout_deny_total,
            },
            'governance': {
                'rollout_gate_deny_total': rollout_deny_total,
                'rollout_gate_deny_by_endpoint': rollout_deny_by_endpoint,
                'rollout_gate_deny_by_reason': rollout_deny_by_reason,
                'cohort_modes_seen': sorted(rollout_gate_cohort_modes),
                'filters': {
                    'endpoint': governance_endpoint_filter or None,
                    'reason': governance_reason_filter or None,
                },
                'delta_thresholds': {
                    'warning': warning_threshold,
                    'critical': critical_threshold,
                    'cooldown': cooldown_threshold,
                },
                'trend_bucket': governance_bucket,
                'rollout_gate_deny_trend': [
                    rollout_deny_trend[key]
                    for key in sorted(rollout_deny_trend.keys())
                ],
            },
            'timeline': timeline,
            'retry_events': retry_events,
        },
        status=status.HTTP_200_OK,
    )



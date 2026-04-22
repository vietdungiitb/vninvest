from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from django.core.cache import cache

from portfolio.tasks_prefetch import _read_offpeak_ingest_history
from portfolio.runtime_policy_helpers import (
    _get_runtime_governance_delta_thresholds,
    _get_runtime_prefetch_settings,
    _get_runtime_prefetch_time_policy,
    _prefetch_time_policy_rulebook,
    _set_runtime_governance_delta_thresholds,
    _set_runtime_prefetch_settings,
    _set_runtime_prefetch_time_policy,
)
from portfolio.tasks_whale_preflight_cache import (
    WHALE_PREFLIGHT_KPI_SCHEMA_VERSION,
    WHALE_PREFLIGHT_METRIC_NAMES,
    _build_preflight_metric_rates,
    _build_preflight_metric_summary,
    _read_preflight_metrics,
    _read_preflight_metrics_window,
    _sum_preflight_metrics_window,
)


def _is_celery_worker_available() -> bool:
    try:
        from config.celery import app as celery_app

        inspect = celery_app.control.inspect(timeout=1.0)
        ping_result = inspect.ping() or {}
        return bool(ping_result)
    except Exception:
        return False

def _parse_bool_query_param(raw_value, *, default: bool = False) -> bool:
    if raw_value in (None, ''):
        return default
    normalized = str(raw_value).strip().lower()
    if normalized in {'1', 'true', 'yes', 'y', 'on'}:
        return True
    if normalized in {'0', 'false', 'no', 'n', 'off'}:
        return False
    return default


def _parse_optional_positive_int(raw_value, field_name: str):
    if raw_value in (None, ''):
        return None
    try:
        value = int(raw_value)
    except (TypeError, ValueError):
        raise ValueError(f'{field_name} phai la so nguyen duong.')
    if value < 1:
        raise ValueError(f'{field_name} phai la so nguyen duong.')
    return value


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
    from portfolio.tasks_prefetch import _metric_cache_key

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

    def _read_prefetch_metric(metric_name: str) -> int:
        try:
            return int(cache.get(_metric_cache_key(metric_name)) or 0)
        except Exception:
            return 0

    prefetch_scheduler_metrics = {
        'runs_total': _read_prefetch_metric('scheduler_runs_total'),
        'enqueued_total': _read_prefetch_metric('scheduler_enqueued_total'),
        'skipped_due_to_interval_total': _read_prefetch_metric('scheduler_skipped_due_to_interval_total'),
        'empty_shard_total': _read_prefetch_metric('scheduler_empty_shard_total'),
        'disabled_tier_total': _read_prefetch_metric('scheduler_disabled_tier_total'),
        'stale_snapshot_total': _read_prefetch_metric('scheduler_stale_snapshot_total'),
        'estimated_upstream_calls_per_minute_total': _read_prefetch_metric('realtime_upstream_calls_per_minute'),
    }

    return Response(
        {
            'sampled_at': _time(),
            'market_observability': obs_snapshot,
            'prefetch_health': prefetch_snapshot,
            'prefetch_scheduler_metrics': prefetch_scheduler_metrics,
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
def admin_runtime_kpi_whale_preflight_metrics_api(request):
    """
    GET /api/admin-ops/runtime-kpi/whale-preflight-metrics/
    Admin-only: trả về counters profiling cho whale preflight cache checks.
    Query params:
      - date=YYYY-MM-DD (optional, default=today localdate)
      - window_days=1..30 (optional, default=1)
            - compact=true|false (optional, default=false)
    """
    from time import time as _time
    from django.utils import timezone

    sampled_at = _time()
    requested_date = str(request.query_params.get('date') or '').strip()
    compact = _parse_bool_query_param(request.query_params.get('compact'), default=False)
    requested_window_days = request.query_params.get('window_days')
    if requested_window_days in (None, ''):
        window_days = 1
    else:
        try:
            window_days = int(requested_window_days)
        except (TypeError, ValueError):
            return Response(
                {
                    'detail': 'Invalid window_days. Use an integer from 1 to 30.',
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if window_days < 1 or window_days > 30:
            return Response(
                {
                    'detail': 'Invalid window_days. Use an integer from 1 to 30.',
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    target_date = timezone.localdate()
    if requested_date:
        try:
            target_date = timezone.datetime.strptime(requested_date, '%Y-%m-%d').date()
        except ValueError:
            return Response(
                {
                    'detail': 'Invalid date format. Use YYYY-MM-DD.',
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    day_key = target_date.isoformat()
    try:
        metrics = _read_preflight_metrics(day_key=day_key)
        trend = _read_preflight_metrics_window(end_date=target_date, window_days=window_days)
        totals = _sum_preflight_metrics_window(window_rows=trend)
        rates = _build_preflight_metric_rates(totals=totals)
        summary = _build_preflight_metric_summary(totals=totals, rates=rates)
    except Exception:
        metrics = {name: 0 for name in WHALE_PREFLIGHT_METRIC_NAMES}
        trend = [{'date': day_key, 'metrics': metrics}] if window_days == 1 else []
        totals = {name: 0 for name in WHALE_PREFLIGHT_METRIC_NAMES}
        rates = _build_preflight_metric_rates(totals=totals)
        summary = _build_preflight_metric_summary(totals=totals, rates=rates)

    payload = {
        'sampled_at': sampled_at,
        'updated_at': timezone.now().isoformat(),
        'schema_version': WHALE_PREFLIGHT_KPI_SCHEMA_VERSION,
        'date': day_key,
        'window_days': window_days,
        'compact': compact,
        'whale_preflight_metrics': metrics,
        'whale_preflight_metrics_totals': totals,
        'whale_preflight_metrics_rates': rates,
        'whale_preflight_metrics_summary': summary,
    }
    if not compact:
        payload['whale_preflight_metrics_trend'] = trend

    return Response(payload, status=status.HTTP_200_OK)


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
      latency_window_hours=24  (default)   - cửa sổ tính latency, tối đa 168
      provider_window_days=7   (default)   - cửa sổ phân phối provider, tối đa 30
    """
    import statistics
    from time import time as _time
    from django.db.models import Sum
    from django.utils import timezone
    from django.core.cache import cache
    from portfolio.models import AdvisoryAggregateAuditLog, AdvisoryTokenLog, UserConfig, WhaleAdvisory
    from portfolio.ai_options import MODEL_CATALOG

    sampled_at = _time()

    try:
        latency_window_hours = min(max(int(request.query_params.get('latency_window_hours', 24)), 1), 168)
    except (TypeError, ValueError):
        latency_window_hours = 24

    try:
        provider_window_days = min(max(int(request.query_params.get('provider_window_days', 7)), 1), 30)
    except (TypeError, ValueError):
        provider_window_days = 7

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

    provider_window_start = timezone.now() - timezone.timedelta(days=provider_window_days)
    provider_dist: dict[str, int] = {}
    for meta in AdvisoryAggregateAuditLog.objects.filter(
        created_at__gte=provider_window_start,
    ).values_list('metadata_json', flat=True):
        if isinstance(meta, dict):
            prov = str(meta.get('ai_provider') or '').strip().lower()
            if prov:
                provider_dist[prov] = provider_dist.get(prov, 0) + 1

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
                'offhours_cache_ttl_seconds_min': 60,
                'session_close_retention_days_min': 1,
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
                    'offhours_cache_ttl_seconds': 3600,
                    'session_close_retention_days': 7,
                    'include_group_symbols': False,
                    'session_close_capture_enabled': True,
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
    from portfolio.tasks import (
        build_realtime_symbol_universe_snapshot,
        schedule_realtime_prefetch_shards,
    )

    mode = str(request.query_params.get('mode') or request.data.get('mode') or 'async').strip().lower()

    if mode == 'sync':
        universe_result = build_realtime_symbol_universe_snapshot.run()
        schedule_result = schedule_realtime_prefetch_shards.run()
        result = {
            'status': 'ok',
            'flow': 'canonical_realtime_prefetch',
            'universe': universe_result,
            'scheduler': schedule_result,
        }
        snapshot = build_prefetch_health_snapshot()
        ok = bool(
            result.get('status') == 'ok'
            and isinstance(schedule_result, dict)
            and schedule_result.get('status') in {'ok', 'skipped_lock'}
        )
        return Response(
            {
                'queued': False,
                'mode': 'sync',
                'ok': ok,
                'result': result,
                'prefetch': snapshot,
            },
            status=status.HTTP_200_OK,
        )

    task = schedule_realtime_prefetch_shards.apply_async(countdown=0)
    return Response(
        {
            'queued': True,
            'mode': 'async',
            'task_id': task.id,
            'flow': 'canonical_realtime_prefetch',
            'prefetch': build_prefetch_health_snapshot(),
        },
        status=status.HTTP_202_ACCEPTED,
    )


@api_view(['POST'])
@permission_classes([IsAdminUser])
def offpeak_vnstock_ingest_api(request):
    """
    POST /api/admin-ops/prefetch/offpeak-ingest/
    Trigger ingest du lieu off-peak vao DB + refresh ticker cache Redis.

    Query/body:
      - mode=async (mac dinh) | sync
      - days (optional, int >= 1)
      - max_symbols (optional, int >= 1)
    """
    from config.health import build_prefetch_health_snapshot
    from portfolio.tasks import offpeak_vnstock_ingest

    mode = str(request.query_params.get('mode') or request.data.get('mode') or 'async').strip().lower()
    try:
        days = _parse_optional_positive_int(request.query_params.get('days', request.data.get('days')), 'days')
        max_symbols = _parse_optional_positive_int(
            request.query_params.get('max_symbols', request.data.get('max_symbols')),
            'max_symbols',
        )
    except ValueError as exc:
        return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    task_kwargs = {
        'days': days,
        'max_symbols': max_symbols,
        'trigger': 'admin_manual',
    }
    task_kwargs = {key: value for key, value in task_kwargs.items() if value is not None}

    if mode == 'sync':
        result = offpeak_vnstock_ingest.run(**task_kwargs)
        ok = str(result.get('status') or '').lower() in {'ok', 'partial'}
        return Response(
            {
                'queued': False,
                'mode': 'sync',
                'ok': ok,
                'result': result,
                'prefetch': build_prefetch_health_snapshot(),
            },
            status=status.HTTP_200_OK,
        )

    task = offpeak_vnstock_ingest.apply_async(kwargs=task_kwargs)
    return Response(
        {
            'queued': True,
            'mode': 'async',
            'task_id': task.id,
            'kwargs': task_kwargs,
            'prefetch': build_prefetch_health_snapshot(),
        },
        status=status.HTTP_202_ACCEPTED,
    )


@api_view(['GET'])
@permission_classes([IsAdminUser])
def offpeak_vnstock_ingest_history_api(request):
    """
    GET /api/admin-ops/prefetch/offpeak-ingest/history/
    Tra ve latest run va history gan day cua offpeak ingest task.
    """
    limit_raw = request.query_params.get('limit', 20)
    try:
        limit = max(int(limit_raw), 1)
    except (TypeError, ValueError):
        return Response({'detail': 'limit phai la so nguyen duong.'}, status=status.HTTP_400_BAD_REQUEST)

    payload = _read_offpeak_ingest_history(limit=limit)
    return Response(
        {
            'ok': True,
            'latest': payload.get('latest'),
            'history': payload.get('history', []),
            'total_entries': int(payload.get('total_entries', 0) or 0),
            'limit': int(payload.get('limit', limit) or limit),
        },
        status=status.HTTP_200_OK,
    )


@api_view(['POST'])
@permission_classes([IsAdminUser])
def admin_intraday_side_backfill_preview_api(request):
    """
    POST /api/admin-ops/intraday-side-backfill/preview/
    Admin-only: dry-run xem scope/changed/transitions trước khi apply.

    Body (JSON, tất cả optional):
      symbols       - danh sách mã (list[str]), mặc định tất cả
      start_date    - YYYY-MM-DD
      end_date      - YYYY-MM-DD
      threshold     - giá trị min matched_value (VND), 0 = tất cả
      batch_size    - chunk size iterator (mặc định 2000)
    """
    from portfolio.services_backfill import intraday_side_backfill_preview

    symbols_raw = request.data.get('symbols') or []
    if isinstance(symbols_raw, str):
        symbols_raw = [s.strip() for s in symbols_raw.split(',') if s.strip()]
    symbols = [str(s).strip().upper() for s in symbols_raw if str(s).strip()]

    start_date = str(request.data.get('start_date') or '').strip() or None
    end_date = str(request.data.get('end_date') or '').strip() or None

    try:
        threshold = int(request.data.get('threshold') or 0)
    except (TypeError, ValueError):
        return Response({'detail': 'threshold phai la so nguyen.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        batch_size = max(100, int(request.data.get('batch_size') or 2000))
    except (TypeError, ValueError):
        batch_size = 2000

    try:
        max_preview_rows = max(1000, int(request.data.get('max_preview_rows') or 100_000))
    except (TypeError, ValueError):
        max_preview_rows = 100_000

    try:
        result = intraday_side_backfill_preview(
            symbols=symbols,
            start_date=start_date,
            end_date=end_date,
            threshold=threshold,
            batch_size=batch_size,
            max_preview_rows=max_preview_rows,
        )
    except Exception as exc:
        return Response({'detail': str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    return Response({'ok': True, **result}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAdminUser])
def admin_intraday_side_backfill_apply_api(request):
    """
    POST /api/admin-ops/intraday-side-backfill/apply/
    Admin-only: apply backfill IntradayTick.side vào DB.

    Body (JSON):
      confirm       - phải là true (safety gate)
      symbols       - danh sách mã (list[str])
      start_date    - YYYY-MM-DD
      end_date      - YYYY-MM-DD
      threshold     - giá trị min matched_value (VND), 0 = tất cả
      batch_size    - chunk size (mặc định 2000)
    """
    from django.utils import timezone
    from portfolio.tasks_maintenance import (
        run_intraday_side_backfill_apply,
        set_intraday_side_backfill_task_status,
    )

    confirm = request.data.get('confirm')
    if str(confirm).strip().lower() not in {'true', '1', 'yes'}:
        return Response(
            {'detail': 'Phai truyen confirm=true de thuc hien apply.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    symbols_raw = request.data.get('symbols') or []
    if isinstance(symbols_raw, str):
        symbols_raw = [s.strip() for s in symbols_raw.split(',') if s.strip()]
    symbols = [str(s).strip().upper() for s in symbols_raw if str(s).strip()]

    start_date = str(request.data.get('start_date') or '').strip() or None
    end_date = str(request.data.get('end_date') or '').strip() or None

    try:
        threshold = int(request.data.get('threshold') or 0)
    except (TypeError, ValueError):
        return Response({'detail': 'threshold phai la so nguyen.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        batch_size = max(100, int(request.data.get('batch_size') or 2000))
    except (TypeError, ValueError):
        batch_size = 2000

    if not _is_celery_worker_available():
        return Response(
            {
                'ok': False,
                'status': 'worker_unavailable',
                'message': 'Celery worker đang offline. Không thể chạy backfill nền lúc này.',
            },
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    task = run_intraday_side_backfill_apply.apply_async(
        kwargs={
            'symbols': symbols,
            'start_date': start_date,
            'end_date': end_date,
            'threshold': threshold,
            'batch_size': batch_size,
        }
    )
    task_id = str(task.id)
    set_intraday_side_backfill_task_status(
        task_id,
        {
            'id': task_id,
            'status': 'queued',
            'queued_at': timezone.now().isoformat(),
            'started_at': None,
            'finished_at': None,
            'message': 'Backfill intraday side đã được đưa vào hàng chờ nền.',
            'result': None,
            'error': None,
            'params': {
                'symbols': symbols,
                'start_date': start_date,
                'end_date': end_date,
                'threshold': threshold,
                'batch_size': batch_size,
            },
        },
    )
    return Response(
        {
            'ok': True,
            'status': 'queued',
            'task_id': task_id,
            'message': 'Backfill intraday side đang chạy nền. Vui lòng theo dõi trạng thái tác vụ.',
        },
        status=status.HTTP_202_ACCEPTED,
    )


@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_intraday_side_backfill_status_api(request, task_id: str):
    from portfolio.tasks_maintenance import get_intraday_side_backfill_task_status

    payload = get_intraday_side_backfill_task_status(task_id)
    if not payload:
        return Response(
            {
                'ok': False,
                'status': 'not_found',
                'message': 'Không tìm thấy trạng thái backfill cho task_id đã cung cấp.',
            },
            status=status.HTTP_404_NOT_FOUND,
        )

    return Response({'ok': True, 'task': payload}, status=status.HTTP_200_OK)
from __future__ import annotations

from collections import defaultdict
from copy import deepcopy
from datetime import timedelta
import logging
from typing import Any

from django.conf import settings
from django.contrib.auth.models import User
from django.core.cache import caches
from django.utils import timezone
import httpx
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
import time

from advisory.models import SystemAISettings
from data_ingest.models import IngestJob, IngestRun
from identity_access.models import CoreTenant
from market_data.models import VnbrokerRuntimeConfig
from market_serving.models import SessionFacts, SymbolSnapshot
from ops_audit.models import AuditEvent, RequestTrace
from signal_intelligence.models import OrderFlowEvent, UnifiedAlert, WhaleAlertCanonical
from user_workspace.models import Portfolio, Transaction, WatchlistItem
from vninvest_core.monitoring.queue_metrics import build_scheduler_queue_metrics_snapshot


logger = logging.getLogger(__name__)


DEFAULT_GOVERNANCE_DELTA_THRESHOLDS = {
    'warning': 2.0,
    'critical': 4.0,
    'cooldown': 2.0,
}

DEFAULT_GOVERNANCE_DELTA_RULEBOOK = {
    'warning_min': 0,
    'critical_must_be_gte_warning': True,
    'cooldown_min': 0,
    'recommended': deepcopy(DEFAULT_GOVERNANCE_DELTA_THRESHOLDS),
}

DEFAULT_VNBROKER_TIMEOUT_CONFIG = {
    'price_board': 8,
    'intraday': 8,
    'financial_ratio': 10,
    'history': 15,
    'listing': 15,
    'general': 10,
}

DEFAULT_VNBROKER_EXTRA = {
    'retry_backoff_seconds': 0.5,
    'rate_limit_cooldown_seconds': 30,
    'fallback_sources': ['VCI'],
    'timeout_config': deepcopy(DEFAULT_VNBROKER_TIMEOUT_CONFIG),
    'enable_caching': True,
    'enable_rate_limit_detection': True,
    'enable_concurrent_limit': True,
    'changelog': [],
}

DEFAULT_PREFETCH_RUNTIME_SETTINGS = {
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
    'intraday_universe_group_ids': [],
    'intraday_universe_force_warm_tier': True,
    'session_close_capture_enabled': True,
    'realtime_stream_enabled': False,
    'intraday_tick_auto_cleanup_enabled': True,
    'intraday_tick_keep_days': 7,
}

DEFAULT_PREFETCH_RUNTIME_RULEBOOK = {
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
    'intraday_universe_group_ids_type': 'array<int>',
    'recommended': deepcopy(DEFAULT_PREFETCH_RUNTIME_SETTINGS),
}

DEFAULT_PREFETCH_TIME_POLICY = {
    'timezone': 'Asia/Ho_Chi_Minh',
    'market_code': 'VN_STOCK',
    'supported_timezones': ['Asia/Ho_Chi_Minh'],
    'market': {
        'open_time': '09:00',
        'close_time': '15:00',
        'pre_open_minutes': 30,
        'post_close_minutes': 30,
        'holiday_dates': [],
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
            'max_retries': 3,
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
            'max_retries': 3,
        },
        'pre_close': {
            'query_enabled': True,
            'interval_seconds': 60,
            'batch_size': 12,
            'symbol_limit': 30,
            'max_retries': 3,
        },
        'post_close': {
            'query_enabled': True,
            'interval_seconds': 180,
            'batch_size': 20,
            'symbol_limit': 60,
            'max_retries': 3,
        },
        'offhours': {
            'query_enabled': True,
            'interval_seconds': 1200,
            'batch_size': 20,
            'symbol_limit': 60,
            'max_retries': 3,
        },
    },
    'rate_limit_guard': {
        'jitter_percent': 15.0,
        'cooldown_multiplier_on_429': 2.0,
        'max_interval_seconds': 1800,
    },
}

DEFAULT_PREFETCH_TIME_POLICY_RULEBOOK = {
    'market': {
        'time_format': 'HH:MM',
        'holiday_dates_type': 'array<YYYY-MM-DD>',
    },
    'profiles': {
        'interval_seconds_min': 1,
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

VNBROKER_ALLOWED_SOURCES = {'VCI', 'KBS', 'TCBS', 'SSI', 'MSI'}

DEFAULT_SIGNAL_SERVICES_CONFIG = {
    'enabled': True,
    'whale_service': {
        'enabled': True,
        'default_threshold_vnd': 500_000_000,
        'cooldown_seconds': 120,
    },
    'dark_flow_service': {
        'enabled': True,
        'window_seconds': 300,
        'warning_strength': 40,
        'urgent_strength': 70,
        'cooldown_seconds': 300,
    },
    'distribution': {
        'websocket_enabled': True,
        'history_enabled': True,
        'fanout_batch_size': 200,
    },
}

DEFAULT_SIGNAL_UNIVERSE_POLICY = {
    'include_tracked_symbols': True,
    'include_watchlist_symbols': True,
    'include_alert_symbols': True,
    'include_portfolio_symbols': True,
    'include_group_symbols': False,
    'admin_symbols': [],
}

DEFAULT_SIGNAL_RETENTION_POLICY = {
    'raw_intraday_keep_days': DEFAULT_PREFETCH_RUNTIME_SETTINGS['intraday_tick_keep_days'],
    'whale_event_keep_days': 90,
    'dark_flow_keep_days': 90,
}

DEFAULT_SIGNAL_OWNERSHIP = {
    'surface': 'signal_control_center',
    'mode': 'native-read-preview',
    'domains': {
        'services_config': {
            'owner': 'legacy-global-signal-policy',
            'status': 'read-preview',
        },
        'universe_policy': {
            'owner': 'legacy-global-signal-policy',
            'status': 'read-preview',
        },
        'retention_policy': {
            'owner': 'data-ops-runtime-policy',
            'status': 'read-preview',
        },
        'materialization_preview': {
            'owner': 'core-market-serving',
            'status': 'native-read',
        },
        'events': {
            'owner': 'core-signal-intelligence',
            'status': 'native-read',
        },
        'jobs': {
            'owner': 'core-admin-ops',
            'status': 'guarded-write',
        },
        'whale_governance': {
            'owner': 'whale-mission-control',
            'status': 'bridge-preview',
        },
    },
    'compatibility': {
        'raw_intraday_keep_days': {
            'owner': 'data-ops-runtime-policy',
            'status': 'read-only',
        },
        'tracked_symbols': {
            'owner': 'legacy-stock-management',
            'status': 'not-promoted',
        },
        'price_alert_symbols': {
            'owner': 'legacy-alerting',
            'status': 'not-promoted',
        },
        'group_symbols': {
            'owner': 'legacy-securities-groups',
            'status': 'not-promoted',
        },
    },
    'deprecation_notes': [
        'Signal policy writer vẫn thuộc legacy global-signal SSOT; core-admin ở slice này chỉ mở native read-side và preview an toàn.',
        'raw_intraday_keep_days vẫn do Data Ops runtime owner quyết định; Signal Control Center chỉ đọc preview giữ liệu retention.',
        'tracked symbols, price alerts và curated group universe chưa có native core source nên hiện đang hiển thị như source rỗng có chủ đích.',
    ],
}

SIGNAL_CONFIG_WRITE_BLOCK_MESSAGE = (
    'Signal policy writer vẫn thuộc legacy global-signal SSOT. '
    'Native Signal Control Center ở slice này chỉ hỗ trợ read-side và preview an toàn.'
)

SIGNAL_JOB_WRITE_BLOCK_MESSAGE = (
    'Manual run/retry cho whale hoặc dark flow chưa được promote native vì core chưa có detector parity đầy đủ cho write path này.'
)

LEGACY_BRIDGE_REQUIRED_MESSAGE = (
    'Write-through bridge sang legacy admin chưa được cấu hình. '
    'Set LEGACY_BACKEND_URL và bật legacy backend khi cần dùng đúng SSOT helpers hiện hữu.'
)

LEGACY_ADMIN_BRIDGE_TIMEOUT = httpx.Timeout(connect=5.0, read=120.0, write=30.0, pool=5.0)


def _is_celery_alive() -> bool:
    """Kiểm tra xem Celery worker có đang hoạt động không."""
    try:
        from vninvest_core.celery import app as celery_app
        inspect = celery_app.control.inspect(timeout=1.5)
        ping_result = inspect.ping() or {}
        return bool(ping_result)
    except Exception as e:
        logger.warning(f"Celery health check failed: {e}")
        return False


def _get_celery_active_queues() -> list[str]:
    """Lấy danh sách các queue đang hoạt động của Celery."""
    try:
        from vninvest_core.celery import app as celery_app
        inspect = celery_app.control.inspect(timeout=1.5)
        active_qs = inspect.active_queues() or {}
        queues = set()
        for worker_queues in active_qs.values():
            for q in worker_queues:
                queues.add(q.get('name'))
        return sorted(list(queues))
    except Exception:
        return []


def _now_iso() -> str:
    return timezone.now().isoformat()


def _legacy_backend_url() -> str:
    return str(getattr(settings, 'LEGACY_BACKEND_URL', '') or '').strip().rstrip('/')


def _legacy_admin_bridge_enabled() -> bool:
    return bool(_legacy_backend_url())


def _normalized_bridge_payload(payload: Any) -> Any:
    if payload is None:
        return None
    if hasattr(payload, 'dict') and callable(payload.dict):
        try:
            return payload.dict()
        except TypeError:
            return payload
    if isinstance(payload, (dict, list)):
        return deepcopy(payload)
    return payload


def _legacy_admin_bridge_headers(request) -> dict[str, str]:
    headers = {
        'Accept': 'application/json',
        'X-Admin-Ops-Bridge': 'core-api',
    }
    request_host = ''
    try:
        request_host = str(request.get_host() or '').strip()
    except Exception:
        request_host = str(request.META.get('HTTP_HOST') or '').strip()
    if request_host:
        # Preserve the user-facing host so legacy ALLOWED_HOSTS remains aligned with ingress.
        headers['Host'] = request_host
        headers['X-Forwarded-Host'] = request_host
    authorization = str(request.META.get('HTTP_AUTHORIZATION') or '').strip()
    if authorization:
        headers['Authorization'] = authorization
    return headers


def _legacy_admin_bridge_response(
    request,
    legacy_path: str,
    *,
    timeout: httpx.Timeout | None = None,
    unavailable_message: str | None = None,
) -> Response | None:
    base_url = _legacy_backend_url()
    if not base_url:
        return None

    payload = _normalized_bridge_payload(request.data) if request.method.upper() in {'POST', 'PUT', 'PATCH'} else None
    params = request.query_params.dict() if hasattr(request.query_params, 'dict') else dict(request.query_params)
    url = f'{base_url}{legacy_path}'

    try:
        upstream_response = httpx.request(
            method=request.method.upper(),
            url=url,
            headers=_legacy_admin_bridge_headers(request),
            params=params,
            json=payload,
            timeout=timeout or LEGACY_ADMIN_BRIDGE_TIMEOUT,
        )
    except httpx.ConnectError as exc:
        # SFI-B1: Nếu lỗi kết nối (container chưa lên), trả về None để view thực hiện fallback native.
        logger.warning("Legacy bridge connection failed (fallback to native): %s", exc)
        return None
    except httpx.RequestError as exc:
        return Response(
            {
                'ok': False,
                'status': 'bridge_unavailable',
                'message': unavailable_message or 'Legacy admin bridge hiện không khả dụng.',
                'detail': str(exc),
                'bridge': {
                    'enabled': True,
                    'url': url,
                },
            },
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    try:
        response_payload = upstream_response.json()
    except ValueError:
        response_payload = {
            'ok': upstream_response.is_success,
            'status': 'bridge_response',
            'detail': upstream_response.text,
        }

    return Response(response_payload, status=upstream_response.status_code)


def _probe_cache_health() -> bool | None:
    try:
        cache = caches['default']
        probe_key = f'admin-ops:probe:{timezone.now().timestamp()}'
        cache.set(probe_key, 'ok', timeout=5)
        return cache.get(probe_key) == 'ok'
    except Exception:
        return None


def _channel_layer_type() -> str:
    channel_layer = getattr(settings, 'CHANNEL_LAYERS', {}).get('default', {})
    return str(channel_layer.get('BACKEND') or 'unconfigured')


def _calc_p95(values: list[int]) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    index = max(int(len(ordered) * 0.95) - 1, 0)
    return float(ordered[index])


def _record_audit_event(*, actor, action: str, resource_type: str, resource_id: str, metadata: dict[str, Any] | None = None) -> None:
    try:
        AuditEvent.objects.create(
            actor_user_id=getattr(actor, 'id', None),
            actor_label=actor.get_username() if actor and actor.is_authenticated else '',
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            metadata=metadata or {},
        )
    except Exception:
        # Audit capture must not break admin flows.
        return


def _derive_ai_provider(ai_model: str, metadata: dict[str, Any]) -> str:
    provider = str(metadata.get('ai_provider') or '').strip().lower()
    if provider:
        return provider
    normalized_model = str(ai_model or '').strip().lower()
    if normalized_model.startswith('gemini'):
        return 'google'
    if normalized_model.startswith('gpt'):
        return 'openai'
    return 'custom'


def _get_or_create_active_ai_settings() -> SystemAISettings:
    active = SystemAISettings.objects.filter(is_active=True).order_by('-updated_at').first()
    if active is not None:
        return active

    existing = SystemAISettings.objects.order_by('-updated_at').first()
    if existing is not None:
        if not existing.is_active:
            existing.is_active = True
            existing.save(update_fields=['is_active', 'updated_at'])
        return existing

    return SystemAISettings.objects.create(
        name='default',
        is_active=True,
        ai_model=SystemAISettings.ModelChoices.GPT4O_MINI,
    )


def _get_or_create_active_vnbroker_config() -> VnbrokerRuntimeConfig:
    active = VnbrokerRuntimeConfig.objects.filter(is_active=True).order_by('-updated_at').first()
    if active is not None:
        return active

    existing = VnbrokerRuntimeConfig.objects.order_by('-updated_at').first()
    if existing is not None:
        if not existing.is_active:
            existing.is_active = True
            existing.save(update_fields=['is_active', 'updated_at'])
        return existing

    return VnbrokerRuntimeConfig.objects.create(
        name='default',
        is_active=True,
        data_source='KBS',
        max_workers=4,
        request_delay_ms=200,
        max_retries=3,
        batch_size=50,
        extra=deepcopy(DEFAULT_VNBROKER_EXTRA),
    )


def _vnbroker_extra(config: VnbrokerRuntimeConfig) -> dict[str, Any]:
    payload = deepcopy(DEFAULT_VNBROKER_EXTRA)
    payload.update(config.extra or {})
    payload['timeout_config'] = {
        **DEFAULT_VNBROKER_TIMEOUT_CONFIG,
        **(payload.get('timeout_config') or {}),
    }
    fallback_sources = payload.get('fallback_sources') or [config.data_source]
    payload['fallback_sources'] = [
        source for source in fallback_sources if str(source or '').strip().upper() in VNBROKER_ALLOWED_SOURCES
    ] or [config.data_source]
    payload['changelog'] = list(payload.get('changelog') or [])
    return payload


def _build_prefetch_runtime_settings(config: VnbrokerRuntimeConfig) -> dict[str, Any]:
    extra = _vnbroker_extra(config)
    payload = deepcopy(DEFAULT_PREFETCH_RUNTIME_SETTINGS)
    payload.update(extra.get('prefetch_runtime_settings') or {})
    payload['batch_size'] = int(payload.get('batch_size') or config.batch_size or DEFAULT_PREFETCH_RUNTIME_SETTINGS['batch_size'])
    payload['max_retries'] = int(payload.get('max_retries') or config.max_retries or DEFAULT_PREFETCH_RUNTIME_SETTINGS['max_retries'])
    payload['rate_limit_cooldown_seconds'] = int(
        payload.get('rate_limit_cooldown_seconds') or extra.get('rate_limit_cooldown_seconds') or DEFAULT_PREFETCH_RUNTIME_SETTINGS['rate_limit_cooldown_seconds']
    )
    return payload


def _build_prefetch_time_policy(config: VnbrokerRuntimeConfig) -> dict[str, Any]:
    extra = _vnbroker_extra(config)
    payload = deepcopy(DEFAULT_PREFETCH_TIME_POLICY)
    payload.update(extra.get('prefetch_time_policy') or {})
    market_payload = payload.get('market') or {}
    payload['market'] = {
        **DEFAULT_PREFETCH_TIME_POLICY['market'],
        **market_payload,
        'lunch_break': {
            **DEFAULT_PREFETCH_TIME_POLICY['market']['lunch_break'],
            **(market_payload.get('lunch_break') or {}),
        },
    }
    merged_profiles = {}
    profile_payload = payload.get('profiles') or {}
    for profile_name, defaults in DEFAULT_PREFETCH_TIME_POLICY['profiles'].items():
        merged_profiles[profile_name] = {
            **defaults,
            **(profile_payload.get(profile_name) or {}),
        }
    payload['profiles'] = merged_profiles
    payload['rate_limit_guard'] = {
        **DEFAULT_PREFETCH_TIME_POLICY['rate_limit_guard'],
        **(payload.get('rate_limit_guard') or {}),
    }
    return payload


def _serialize_system_ai_settings(config: SystemAISettings) -> dict[str, Any]:
    metadata = deepcopy(config.metadata or {})
    vnbroker_config = _get_or_create_active_vnbroker_config()
    governance = deepcopy(DEFAULT_GOVERNANCE_DELTA_THRESHOLDS)
    governance.update(metadata.get('governance_delta_thresholds') or {})

    return {
        'id': config.pk,
        'name': config.name,
        'is_active': bool(config.is_active),
        'ai_provider': _derive_ai_provider(config.ai_model, metadata),
        'ai_model': config.ai_model,
        'effective_ai_model': config.ai_model,
        'allow_env_fallback': bool(metadata.get('allow_env_fallback', True)),
        'ai_api_key_configured': bool(metadata.get('ai_api_key_configured', False)),
        'notes': str(metadata.get('notes') or ''),
        'max_tokens': config.max_tokens,
        'temperature': config.temperature,
        'prompt_template': config.prompt_template,
        'governance_delta_thresholds': governance,
        'governance_delta_rulebook': deepcopy(DEFAULT_GOVERNANCE_DELTA_RULEBOOK),
        'prefetch_runtime_settings': _build_prefetch_runtime_settings(vnbroker_config),
        'prefetch_runtime_rulebook': deepcopy(DEFAULT_PREFETCH_RUNTIME_RULEBOOK),
        'prefetch_time_policy': _build_prefetch_time_policy(vnbroker_config),
        'prefetch_time_policy_rulebook': deepcopy(DEFAULT_PREFETCH_TIME_POLICY_RULEBOOK),
        'write_capabilities': {
            'ai_runtime': True,
            'governance_delta_thresholds': True,
            'prefetch_runtime_settings': False,
            'prefetch_time_policy': False,
        },
        'updated_at': config.updated_at.isoformat() if config.updated_at else None,
    }


def _serialize_vnbroker_settings(config: VnbrokerRuntimeConfig) -> dict[str, Any]:
    extra = _vnbroker_extra(config)
    return {
        'id': config.pk,
        'max_concurrency': config.max_workers,
        'retry_attempts': config.max_retries,
        'retry_backoff_seconds': extra['retry_backoff_seconds'],
        'rate_limit_cooldown_seconds': extra['rate_limit_cooldown_seconds'],
        'timeout_config': extra['timeout_config'],
        'price_board_source': config.data_source,
        'fallback_sources': extra['fallback_sources'],
        'enable_caching': bool(extra['enable_caching']),
        'enable_rate_limit_detection': bool(extra['enable_rate_limit_detection']),
        'enable_concurrent_limit': bool(extra['enable_concurrent_limit']),
        'changelog': extra['changelog'],
        'updated_by_username': str(extra.get('updated_by_username') or ''),
        'created_at': config.created_at.isoformat() if config.created_at else None,
        'updated_at': config.updated_at.isoformat() if config.updated_at else None,
    }


def _serialize_vnbroker_rulebook() -> dict[str, Any]:
    return {
        'max_concurrency': {'min': 1, 'max': 50},
        'retry_attempts': {'min': 0, 'max': 10},
        'retry_backoff_seconds': {'min': 0.0, 'max': 30.0},
        'rate_limit_cooldown_seconds': {'min': 5, 'max': 1800},
        'timeout_seconds': {'min': 1, 'max': 120},
        'allowed_sources': sorted(VNBROKER_ALLOWED_SOURCES),
    }


def _source_counts() -> dict[str, int]:
    tracked_symbol_count = WatchlistItem.objects.values('symbol').distinct().count()
    return {
        'tracked_symbols': tracked_symbol_count,
        'watchlist_items': WatchlistItem.objects.count(),
        'price_alerts': 0,
        'portfolio_transactions': Transaction.objects.count(),
    }


def _build_prefetch_health_snapshot() -> dict[str, Any]:
    config = _get_or_create_active_vnbroker_config()
    latest_run = (
        IngestRun.objects.select_related('job')
        .filter(job__source=IngestJob.SourceChoices.VNBROKER_PRICE_BOARD)
        .order_by('-started_at')
        .first()
    )
    base_prefetch = {
        'generated_at': _now_iso(),
        'status': 'idle',
        'symbols': 0,
        'cached': 0,
        'batch_size': config.batch_size,
        'policy': {
            'owner': 'core-data-ingest',
            'query_enabled': True,
        },
        'source_counts': _source_counts(),
    }
    if latest_run is None:
        return {
            'healthy': None,
            'warning': False,
            'meta_present': False,
            'freshness_seconds': None,
            'sample_cache_hits': 0,
            'sample_cache_total': 0,
            'prefetch': base_prefetch,
        }

    completed_at = latest_run.finished_at or latest_run.started_at
    freshness_seconds = None
    if completed_at is not None:
        freshness_seconds = int(max((timezone.now() - completed_at).total_seconds(), 0))

    state = str(latest_run.state or '').lower()
    status_map = {
        'success': 'ok',
        'running': 'running',
        'failed': 'failed',
        'skipped': 'idle',
    }
    healthy = True if state == 'success' else False if state == 'failed' else None

    prefetch_payload = {
        **base_prefetch,
        'generated_at': completed_at.isoformat() if completed_at else _now_iso(),
        'status': status_map.get(state, 'unknown'),
        'symbols': latest_run.rows_upserted,
        'cached': latest_run.rows_skipped,
        'reason': latest_run.error_message or '',
    }
    return {
        'healthy': healthy,
        'warning': state == 'running',
        'meta_present': True,
        'freshness_seconds': freshness_seconds,
        'sample_cache_hits': latest_run.rows_upserted if state == 'success' else 0,
        'sample_cache_total': latest_run.rows_upserted if latest_run.rows_upserted else 0,
        'prefetch': prefetch_payload,
    }


def _build_market_observability_snapshot() -> dict[str, Any]:
    traces = list(RequestTrace.objects.order_by('-traced_at')[:200])
    http_requests = len(traces)
    http_5xx = sum(1 for trace in traces if trace.status_code and trace.status_code >= 500)
    endpoint_metrics: dict[str, dict[str, list[int] | int]] = defaultdict(lambda: {'durations': [], 'errors': 0})
    for trace in traces:
        metrics = endpoint_metrics[trace.path]
        if trace.duration_ms is not None:
            metrics['durations'].append(int(trace.duration_ms))
        if trace.status_code and trace.status_code >= 500:
            metrics['errors'] += 1

    endpoints = {}
    for path, metrics in endpoint_metrics.items():
        durations = metrics['durations']
        count = max(len(durations), 1)
        endpoints[path] = {
            'latency_ms': {
                'p95': _calc_p95(durations),
            },
            'five_xx_ratio_pct': round((metrics['errors'] / count) * 100, 2),
        }

    overall_ratio = round((http_5xx / http_requests) * 100, 2) if http_requests else 0.0
    return {
        'overall': {
            'http_requests': http_requests,
            'http_5xx_ratio_pct': overall_ratio,
            'fallback_hits': 0,
            'external_timeouts': 0,
        },
        'intraday_freshness': {
            'age_seconds': {
                'p50': None,
                'p95': None,
            },
            'stale_served_total': 0,
            'stale_over_threshold_total': 0,
            'realtime_refresh_trigger_total': 0,
        },
        'endpoints': endpoints,
    }


def _build_stats_snapshot(request) -> dict[str, Any]:
    tracked_symbol_count = WatchlistItem.objects.values('symbol').distinct().count()
    surface_permissions = {
        'vnbroker_config_write': bool(request.user and request.user.is_staff),
        'intraday_side_backfill_apply': False,
        'governance_threshold_write': bool(request.user and request.user.is_staff),
        'prefetch_runtime_write': False,
        'prefetch_time_policy_write': False,
    }
    whale_placeholder = {
        'status': 'not_migrated',
        'detail': 'Whale governance admin chưa được promote sang core-native route.',
    }

    return {
        'user_count': User.objects.count(),
        'portfolio_count': Portfolio.objects.count(),
        'tracked_symbol_count': tracked_symbol_count,
        'watchlist_item_count': WatchlistItem.objects.count(),
        'transaction_count': Transaction.objects.count(),
        'tenant_count': CoreTenant.objects.count(),
        'channel_layer_type': _channel_layer_type(),
        'realtime_enabled': _channel_layer_type() != 'unconfigured',
        'redis_ok': _probe_cache_health(),
        'last_market_group_sync': None,
        'last_stock_profile_sync': None,
        'surface_permissions': surface_permissions,
        'ticker_prefetch': _build_prefetch_health_snapshot(),
        'whale_config_propagation': whale_placeholder,
        'whale_config_anomaly': whale_placeholder,
        'whale_config_dashboard': {
            'propagation': whale_placeholder,
            'anomaly': whale_placeholder,
            'alerts': {'count': 0},
            'worker_summary': {'workers': []},
        },
    }


def _validate_governance_thresholds(payload: Any) -> tuple[dict[str, float] | None, str | None]:
    if not isinstance(payload, dict):
        return None, 'governance_delta_thresholds phải là object hợp lệ.'

    try:
        warning = float(payload.get('warning'))
        critical = float(payload.get('critical'))
        cooldown = float(payload.get('cooldown'))
    except (TypeError, ValueError):
        return None, 'governance_delta_thresholds phải chứa các giá trị số hợp lệ.'

    if warning < 0:
        return None, 'warning phải lớn hơn hoặc bằng 0.'
    if critical < warning:
        return None, 'critical phải lớn hơn hoặc bằng warning.'
    if cooldown < 0:
        return None, 'cooldown phải lớn hơn hoặc bằng 0.'

    return {
        'warning': warning,
        'critical': critical,
        'cooldown': cooldown,
    }, None


def _validate_vnbroker_payload(payload: Any) -> tuple[dict[str, Any] | None, dict[str, list[str]]]:
    errors: dict[str, list[str]] = {}
    if not isinstance(payload, dict):
        return None, {'non_field_errors': ['Payload phải là object hợp lệ.']}

    normalized: dict[str, Any] = {}
    number_fields = {
        'max_concurrency': (int, 1, 50),
        'retry_attempts': (int, 0, 10),
        'rate_limit_cooldown_seconds': (int, 5, 1800),
        'retry_backoff_seconds': (float, 0.0, 30.0),
    }
    for field, (caster, min_value, max_value) in number_fields.items():
        if field not in payload:
            continue
        raw_value = payload.get(field)
        try:
            value = caster(raw_value)
        except (TypeError, ValueError):
            errors[field] = [f'{field} phải là số hợp lệ.']
            continue
        if value < min_value or value > max_value:
            errors[field] = [f'{field} phải nằm trong khoảng [{min_value}, {max_value}].']
            continue
        normalized[field] = value

    if 'price_board_source' in payload:
        source = str(payload.get('price_board_source') or '').strip().upper()
        if source not in VNBROKER_ALLOWED_SOURCES:
            errors['price_board_source'] = ['price_board_source không hợp lệ.']
        else:
            normalized['price_board_source'] = source

    if 'fallback_sources' in payload:
        raw_sources = payload.get('fallback_sources')
        if not isinstance(raw_sources, list):
            errors['fallback_sources'] = ['fallback_sources phải là danh sách.']
        else:
            normalized_sources = []
            for item in raw_sources:
                source = str(item or '').strip().upper()
                if not source:
                    continue
                if source not in VNBROKER_ALLOWED_SOURCES:
                    errors.setdefault('fallback_sources', []).append(f'Provider không hợp lệ: {source}')
                    continue
                if source not in normalized_sources:
                    normalized_sources.append(source)
            if 'fallback_sources' not in errors:
                normalized['fallback_sources'] = normalized_sources

    if 'timeout_config' in payload:
        raw_timeout_config = payload.get('timeout_config')
        if not isinstance(raw_timeout_config, dict):
            errors['timeout_config'] = ['timeout_config phải là object hợp lệ.']
        else:
            timeout_config = {}
            for channel in DEFAULT_VNBROKER_TIMEOUT_CONFIG:
                if channel not in raw_timeout_config:
                    continue
                try:
                    timeout_value = int(raw_timeout_config[channel])
                except (TypeError, ValueError):
                    errors[f'timeout_config.{channel}'] = [f'timeout_config.{channel} phải là số nguyên.']
                    continue
                if timeout_value < 1 or timeout_value > 120:
                    errors[f'timeout_config.{channel}'] = [f'timeout_config.{channel} phải nằm trong khoảng [1, 120].']
                    continue
                timeout_config[channel] = timeout_value
            if not any(key.startswith('timeout_config.') for key in errors):
                normalized['timeout_config'] = timeout_config

    for field in ('enable_caching', 'enable_rate_limit_detection', 'enable_concurrent_limit'):
        if field in payload:
            normalized[field] = bool(payload.get(field))

    return (normalized if not errors else None), errors


def _append_vnbroker_changelog(config: VnbrokerRuntimeConfig, actor, *, reason: str, changes: dict[str, Any]) -> None:
    extra = _vnbroker_extra(config)
    changelog = list(extra.get('changelog') or [])
    changelog.insert(
        0,
        {
            'timestamp': _now_iso(),
            'actor_user_id': getattr(actor, 'id', None),
            'actor_label': actor.get_username() if actor and actor.is_authenticated else '',
            'reason': reason,
            'changes': changes,
        },
    )
    extra['changelog'] = changelog[:200]
    extra['updated_by_username'] = actor.get_username() if actor and actor.is_authenticated else ''
    config.extra = extra


def _deep_merge_dict(base: dict[str, Any], override: Any) -> dict[str, Any]:
    payload = deepcopy(base)
    if not isinstance(override, dict):
        return payload
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(payload.get(key), dict):
            payload[key] = _deep_merge_dict(payload[key], value)
        else:
            payload[key] = value
    return payload


def _build_config_changes(before: dict[str, Any], after: dict[str, Any]) -> dict[str, Any]:
    changes: dict[str, Any] = {}
    for key, before_value in before.items():
        after_value = after.get(key)
        if before_value != after_value:
            changes[key] = {
                'before': before_value,
                'after': after_value,
            }
    return changes


def _normalize_symbol_list(values: Any) -> list[str]:
    if isinstance(values, str):
        values = values.split(',')
    if not isinstance(values, (list, tuple, set)):
        return []
    normalized: list[str] = []
    for raw_value in values:
        symbol = str(raw_value or '').strip().upper()
        if symbol and symbol not in normalized:
            normalized.append(symbol)
    return normalized


def _coerce_signal_services_config(payload: Any, fallback: dict[str, Any] | None = None) -> dict[str, Any]:
    current = deepcopy(fallback or DEFAULT_SIGNAL_SERVICES_CONFIG)
    merged = _deep_merge_dict(current, payload)
    whale_service = merged.get('whale_service') or {}
    dark_flow_service = merged.get('dark_flow_service') or {}
    distribution = merged.get('distribution') or {}
    return {
        'enabled': bool(merged.get('enabled', True)),
        'whale_service': {
            'enabled': bool(whale_service.get('enabled', True)),
            'default_threshold_vnd': int(whale_service.get('default_threshold_vnd') or DEFAULT_SIGNAL_SERVICES_CONFIG['whale_service']['default_threshold_vnd']),
            'cooldown_seconds': int(whale_service.get('cooldown_seconds') or DEFAULT_SIGNAL_SERVICES_CONFIG['whale_service']['cooldown_seconds']),
        },
        'dark_flow_service': {
            'enabled': bool(dark_flow_service.get('enabled', True)),
            'window_seconds': int(dark_flow_service.get('window_seconds') or DEFAULT_SIGNAL_SERVICES_CONFIG['dark_flow_service']['window_seconds']),
            'warning_strength': int(dark_flow_service.get('warning_strength') or DEFAULT_SIGNAL_SERVICES_CONFIG['dark_flow_service']['warning_strength']),
            'urgent_strength': int(dark_flow_service.get('urgent_strength') or DEFAULT_SIGNAL_SERVICES_CONFIG['dark_flow_service']['urgent_strength']),
            'cooldown_seconds': int(dark_flow_service.get('cooldown_seconds') or DEFAULT_SIGNAL_SERVICES_CONFIG['dark_flow_service']['cooldown_seconds']),
        },
        'distribution': {
            'websocket_enabled': bool(distribution.get('websocket_enabled', True)),
            'history_enabled': bool(distribution.get('history_enabled', True)),
            'fanout_batch_size': int(distribution.get('fanout_batch_size') or DEFAULT_SIGNAL_SERVICES_CONFIG['distribution']['fanout_batch_size']),
        },
    }


def _coerce_signal_universe_policy(payload: Any, fallback: dict[str, Any] | None = None) -> dict[str, Any]:
    current = deepcopy(fallback or DEFAULT_SIGNAL_UNIVERSE_POLICY)
    merged = _deep_merge_dict(current, payload)
    return {
        'include_tracked_symbols': bool(merged.get('include_tracked_symbols', True)),
        'include_watchlist_symbols': bool(merged.get('include_watchlist_symbols', True)),
        'include_alert_symbols': bool(merged.get('include_alert_symbols', True)),
        'include_portfolio_symbols': bool(merged.get('include_portfolio_symbols', True)),
        'include_group_symbols': bool(merged.get('include_group_symbols', False)),
        'admin_symbols': _normalize_symbol_list(merged.get('admin_symbols') or []),
    }


def _coerce_signal_retention_policy(payload: Any, fallback: dict[str, Any] | None = None) -> dict[str, Any]:
    current = deepcopy(fallback or DEFAULT_SIGNAL_RETENTION_POLICY)
    merged = _deep_merge_dict(current, payload)
    return {
        'raw_intraday_keep_days': int(merged.get('raw_intraday_keep_days') or DEFAULT_SIGNAL_RETENTION_POLICY['raw_intraday_keep_days']),
        'whale_event_keep_days': int(merged.get('whale_event_keep_days') or DEFAULT_SIGNAL_RETENTION_POLICY['whale_event_keep_days']),
        'dark_flow_keep_days': int(merged.get('dark_flow_keep_days') or DEFAULT_SIGNAL_RETENTION_POLICY['dark_flow_keep_days']),
    }


def _signal_ownership_snapshot() -> dict[str, Any]:
    snapshot = deepcopy(DEFAULT_SIGNAL_OWNERSHIP)
    if _legacy_admin_bridge_enabled():
        snapshot['mode'] = 'native-read-legacy-write-through'
        snapshot['domains']['services_config']['status'] = 'bridge-write'
        snapshot['domains']['universe_policy']['status'] = 'bridge-write'
        snapshot['domains']['retention_policy']['status'] = 'bridge-write'
        snapshot['domains']['jobs'] = {
            'owner': 'legacy-detector-runtime',
            'status': 'bridge-write',
        }
        snapshot['deprecation_notes'] = [
            'Signal policy và detector writes đang được write-through sang legacy SSOT qua bridge; core vẫn giữ native read-side cho facts/events.',
            'raw_intraday_keep_days vẫn do Data Ops runtime owner quyết định; Signal Control Center chỉ write-through phần retention policy mà legacy đang sở hữu.',
            'tracked symbols, price alerts và curated group universe vẫn phụ thuộc legacy resolver cho đến khi source native được promote hoàn tất.',
        ]
    return snapshot


def _signal_services_config() -> dict[str, Any]:
    return deepcopy(DEFAULT_SIGNAL_SERVICES_CONFIG)


def _signal_universe_policy() -> dict[str, Any]:
    return deepcopy(DEFAULT_SIGNAL_UNIVERSE_POLICY)


def _signal_retention_policy() -> dict[str, Any]:
    return deepcopy(DEFAULT_SIGNAL_RETENTION_POLICY)


def _signal_write_guard(message: str) -> Response:
    if not _legacy_admin_bridge_enabled():
        message = f'{message} {LEGACY_BRIDGE_REQUIRED_MESSAGE}'
    return Response(
        {
            'ok': False,
            'status': 'guarded',
            'message': message,
            'ownership': _signal_ownership_snapshot(),
        },
        status=status.HTTP_409_CONFLICT,
    )


def _parse_positive_int(value: Any, default: int, *, minimum: int = 1, maximum: int = 100) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return default
    return max(minimum, min(parsed, maximum))


def _signal_run_queryset(service_domain: str | None = None):
    queryset = (
        IngestRun.objects.select_related('job')
        .filter(job__name__startswith='signal-control-')
        .order_by('-started_at', '-pk')
    )
    if service_domain:
        queryset = queryset.filter(meta__service_domain=service_domain)
    return queryset


def _serialize_signal_run(run: IngestRun | None) -> dict[str, Any] | None:
    if run is None:
        return None

    service_domain = str((run.meta or {}).get('service_domain') or 'signal')
    run_type = str((run.meta or {}).get('run_type') or 'manual')
    status_map = {
        IngestRun.StateChoices.RUNNING: 'RUNNING',
        IngestRun.StateChoices.SUCCESS: 'COMPLETED',
        IngestRun.StateChoices.FAILED: 'FAILED',
        IngestRun.StateChoices.SKIPPED: 'PARTIAL',
    }
    status_value = status_map.get(run.state, 'RUNNING')
    service_labels = {
        'whale': 'Whale Alerts',
        'dark_flow': 'Dark Flow',
        'retention_preview': 'Retention Preview',
        'materialization_preview': 'Materialization Preview',
    }
    run_type_labels = {
        'manual': 'Manual',
        'preview': 'Preview',
        'retention_preview': 'Retention Preview',
        'materialization_preview': 'Materialization Preview',
    }
    return {
        'id': run.pk,
        'service_domain': service_domain,
        'service_domain_display': service_labels.get(service_domain, service_domain.replace('_', ' ').title()),
        'run_type': run_type,
        'run_type_display': run_type_labels.get(run_type, run_type.replace('_', ' ').title()),
        'status': status_value,
        'status_display': status_value.title(),
        'stored_items': int(run.rows_upserted or 0),
        'created_at': run.started_at.isoformat() if run.started_at else None,
        'finished_at': run.finished_at.isoformat() if run.finished_at else None,
        'task_id': str((run.meta or {}).get('task_id') or ''),
        'params_json': deepcopy((run.meta or {}).get('params') or {}),
        'log': run.error_message,
    }


def _latest_signal_run(service_domain: str, *, states: set[str]) -> IngestRun | None:
    return _signal_run_queryset(service_domain).filter(state__in=states).first()


def _signal_watchlist_symbols() -> set[str]:
    return {
        str(symbol or '').strip().upper()
        for symbol in WatchlistItem.objects.values_list('symbol', flat=True).distinct()
        if str(symbol or '').strip()
    }


def _signal_portfolio_symbols() -> set[str]:
    return {
        str(symbol or '').strip().upper()
        for symbol in Transaction.objects.values_list('symbol', flat=True).distinct()
        if str(symbol or '').strip()
    }


def _build_signal_universe_snapshot(policy: dict[str, Any]) -> dict[str, Any]:
    normalized_policy = _coerce_signal_universe_policy(policy)
    admin_symbols = set(normalized_policy['admin_symbols'])
    watchlist_symbols = _signal_watchlist_symbols() if normalized_policy['include_watchlist_symbols'] else set()
    portfolio_symbols = _signal_portfolio_symbols() if normalized_policy['include_portfolio_symbols'] else set()
    tracked_symbols: set[str] = set()
    alert_symbols: set[str] = set()
    group_symbols: set[str] = set()

    effective_symbols = set(admin_symbols)
    effective_symbols.update(watchlist_symbols)
    effective_symbols.update(portfolio_symbols)
    if normalized_policy['include_tracked_symbols']:
        effective_symbols.update(tracked_symbols)
    if normalized_policy['include_alert_symbols']:
        effective_symbols.update(alert_symbols)
    if normalized_policy['include_group_symbols']:
        effective_symbols.update(group_symbols)

    return {
        'generated_at': _now_iso(),
        'counts': {
            'admin': len(admin_symbols),
            'tracked': len(tracked_symbols),
            'watchlist': len(watchlist_symbols),
            'alerts': len(alert_symbols),
            'portfolio': len(portfolio_symbols),
            'groups': len(group_symbols),
            'effective': len(effective_symbols),
        },
        'sources': {
            'admin_symbols': {'enabled': bool(admin_symbols), 'count': len(admin_symbols), 'sample': sorted(admin_symbols)[:10]},
            'tracked_symbols': {'enabled': normalized_policy['include_tracked_symbols'], 'count': len(tracked_symbols), 'sample': [], 'status': 'not-promoted'},
            'watchlist_symbols': {'enabled': normalized_policy['include_watchlist_symbols'], 'count': len(watchlist_symbols), 'sample': sorted(watchlist_symbols)[:10]},
            'alert_symbols': {'enabled': normalized_policy['include_alert_symbols'], 'count': len(alert_symbols), 'sample': [], 'status': 'not-promoted'},
            'portfolio_symbols': {'enabled': normalized_policy['include_portfolio_symbols'], 'count': len(portfolio_symbols), 'sample': sorted(portfolio_symbols)[:10]},
            'group_symbols': {'enabled': normalized_policy['include_group_symbols'], 'count': len(group_symbols), 'sample': [], 'status': 'not-promoted'},
        },
        'effective_symbols_sample': sorted(effective_symbols)[:20],
    }


def _signal_freshness_state(age_seconds: int | None) -> str:
    if age_seconds is None:
        return 'empty'
    if age_seconds <= 300:
        return 'fresh'
    if age_seconds <= 1800:
        return 'warm'
    return 'stale'


def _build_signal_domain_summary(service_domain: str) -> dict[str, Any]:
    now = timezone.now()
    window_start = now - timedelta(hours=24)
    latest_session_fact = SessionFacts.objects.order_by('-computed_at', '-pk').first()
    facts_count = SessionFacts.objects.count()
    cached_at = latest_session_fact.computed_at if latest_session_fact is not None else None

    if service_domain == 'whale':
        whale_alerts = UnifiedAlert.objects.filter(alert_type=UnifiedAlert.AlertTypeChoices.WHALE)
        latest_detail = (
            WhaleAlertCanonical.objects.select_related('alert')
            .filter(is_dark_flow=False)
            .order_by('-executed_at', '-pk')
            .first()
        )
        latest_event_ts = latest_detail.executed_at if latest_detail is not None else None
        latest_payload = None
        if latest_detail is not None:
            latest_payload = {
                'event_id': str(latest_detail.alert.alert_id),
                'symbol': latest_detail.symbol,
                'severity': latest_detail.alert.severity,
                'occurred_at': latest_detail.executed_at.isoformat() if latest_detail.executed_at else None,
            }
        recent_count = whale_alerts.filter(triggered_at__gte=window_start).count()
        total_count = whale_alerts.count()
        summary_value = int(latest_detail.matched_value) if latest_detail is not None else 0
    else:
        dark_flow_events = OrderFlowEvent.objects.filter(signal_type=OrderFlowEvent.SignalTypeChoices.DARK_FLOW)
        dark_flow_alerts = UnifiedAlert.objects.filter(alert_type=UnifiedAlert.AlertTypeChoices.DARK_FLOW)
        latest_event = dark_flow_events.order_by('-triggered_at', '-pk').first()
        latest_alert = dark_flow_alerts.order_by('-triggered_at', '-pk').first()
        latest_event_ts = None
        latest_payload = None
        if latest_event is not None:
            latest_event_ts = latest_event.triggered_at
            latest_payload = {
                'event_id': str(latest_event.event_id),
                'symbol': latest_event.symbol,
                'severity': latest_event.unified_alert.severity if latest_event.unified_alert_id else 'medium',
                'occurred_at': latest_event.triggered_at.isoformat() if latest_event.triggered_at else None,
            }
            recent_count = dark_flow_events.filter(triggered_at__gte=window_start).count()
            total_count = dark_flow_events.count()
            summary_value = float(latest_event.strength or 0.0)
        elif latest_alert is not None:
            latest_event_ts = latest_alert.triggered_at
            latest_payload = {
                'event_id': str(latest_alert.alert_id),
                'symbol': latest_alert.symbol,
                'severity': latest_alert.severity,
                'occurred_at': latest_alert.triggered_at.isoformat() if latest_alert.triggered_at else None,
            }
            recent_count = dark_flow_alerts.filter(triggered_at__gte=window_start).count()
            total_count = dark_flow_alerts.count()
            summary_value = float(latest_alert.value or 0.0)
        else:
            recent_count = 0
            total_count = 0
            summary_value = 0.0

    age_seconds = int((now - cached_at).total_seconds()) if cached_at is not None else None
    lag_seconds = int((now - latest_event_ts).total_seconds()) if latest_event_ts is not None else None
    freshness_state = _signal_freshness_state(lag_seconds if latest_event_ts is not None else age_seconds)

    materialization_source = 'core_session_facts' if latest_session_fact is not None else 'unavailable'
    if service_domain == 'whale':
        materialization_source = 'core_unified_alerts' if latest_event_ts is not None else materialization_source
    elif latest_event_ts is not None:
        materialization_source = 'core_order_flow_events'

    return {
        'last_successful_run': _serialize_signal_run(_latest_signal_run(service_domain, states={IngestRun.StateChoices.SUCCESS, IngestRun.StateChoices.SKIPPED})),
        'last_failed_run': _serialize_signal_run(_latest_signal_run(service_domain, states={IngestRun.StateChoices.FAILED})),
        'recent_event_count_24h': recent_count,
        'total_event_count': total_count,
        'latest_event': latest_payload,
        'cache_freshness': {
            'cached_at': cached_at.isoformat() if cached_at else None,
            'event_ts': latest_event_ts.isoformat() if latest_event_ts else None,
            'age_seconds': age_seconds,
            'lag_seconds': lag_seconds,
            'freshness_state': freshness_state,
        },
        'materialization': {
            'source': materialization_source,
            'generated_at': latest_event_ts.isoformat() if latest_event_ts else (cached_at.isoformat() if cached_at else None),
            'cached_at': cached_at.isoformat() if cached_at else None,
            'freshness_state': freshness_state,
            'lag_seconds': float(lag_seconds or 0.0),
            'bucket_fact_count': facts_count,
            'anomaly_count': 0,
            'session_summary_state': 'complete' if latest_session_fact is not None else 'empty',
            'read_path': 'facts_first' if latest_session_fact is not None else 'empty',
        },
        'session_summary': {
            'generated_at': cached_at.isoformat() if cached_at else None,
            'latest_symbol': latest_session_fact.symbol if latest_session_fact is not None else None,
            'latest_session_date': latest_session_fact.session_date.isoformat() if latest_session_fact is not None else None,
            'summary_value': summary_value,
        },
        'anomaly_markers': [],
        'pending_run_count': _signal_run_queryset(service_domain).filter(state=IngestRun.StateChoices.RUNNING).count(),
    }


def _build_signal_freshness_snapshot() -> dict[str, Any]:
    whale_summary = _build_signal_domain_summary('whale')
    dark_flow_summary = _build_signal_domain_summary('dark_flow')
    whale_state = (whale_summary.get('materialization') or {}).get('freshness_state')
    dark_flow_state = (dark_flow_summary.get('materialization') or {}).get('freshness_state')
    states = {state for state in (whale_state, dark_flow_state) if state and state != 'empty'}
    overall_state = 'empty' if not states else ('fresh' if states == {'fresh'} else 'mixed')
    return {
        'state': overall_state,
        'whale': {
            'freshness_state': whale_state,
            'lag_seconds': (whale_summary.get('materialization') or {}).get('lag_seconds'),
        },
        'dark_flow': {
            'freshness_state': dark_flow_state,
            'lag_seconds': (dark_flow_summary.get('materialization') or {}).get('lag_seconds'),
        },
    }


def _build_signal_preview_contract(
    *,
    preview_kind: str,
    current_values: dict[str, Any],
    proposed_values: dict[str, Any],
    impacted_counts: dict[str, Any],
    freshness: dict[str, Any],
    warnings: list[Any] | None = None,
    preview_state: str = 'ready',
    confirmed: bool = False,
) -> dict[str, Any]:
    ownership = _signal_ownership_snapshot()
    effective_warnings = list(ownership.get('deprecation_notes') or [])
    effective_warnings.extend(list(warnings or []))
    return {
        'effective_owner': ownership,
        'effective_values': proposed_values,
        'diff': _build_config_changes(current_values, proposed_values),
        'impacted_counts': impacted_counts,
        'freshness': freshness,
        'confirmation_metadata': {
            'preview_kind': preview_kind,
            'requires_confirm': True,
            'confirmed': confirmed,
            'preview_state': preview_state,
        },
        'effective_value_warnings': effective_warnings,
    }


def _build_signal_whale_governance_snapshot() -> dict[str, Any]:
    return {
        'generated_at': _now_iso(),
        'active_version': None,
        'active_rollout': {
            'status': 'pending_legacy_cutover',
        },
        'pending_draft': None,
        'propagation': {
            'signal': 'legacy_owner',
        },
        'anomaly': {
            'status': 'not_migrated',
            'detail': 'Whale governance tiếp tục do mission-control legacy vận hành cho đến khi SSOT cutover hoàn tất.',
        },
    }


def _build_signal_retention_preview(policy: dict[str, Any] | None = None) -> dict[str, Any]:
    normalized_policy = _coerce_signal_retention_policy(policy or {})
    now = timezone.now()
    whale_count = WhaleAlertCanonical.objects.filter(is_dark_flow=False).count()
    dark_flow_event_count = OrderFlowEvent.objects.filter(signal_type=OrderFlowEvent.SignalTypeChoices.DARK_FLOW).count()
    dark_flow_alert_count = UnifiedAlert.objects.filter(alert_type=UnifiedAlert.AlertTypeChoices.DARK_FLOW).count()
    dark_flow_count = max(dark_flow_event_count, dark_flow_alert_count)
    return {
        'policy': normalized_policy,
        'raw_intraday': {
            'rows_total': 0,
            'keep_days': normalized_policy['raw_intraday_keep_days'],
            'purge_before': (now - timedelta(days=normalized_policy['raw_intraday_keep_days'])).isoformat(),
        },
        'whale_events': {
            'rows_total': whale_count,
            'purge_before': (now - timedelta(days=normalized_policy['whale_event_keep_days'])).isoformat(),
        },
        'dark_flow_events': {
            'rows_total': dark_flow_count,
            'purge_before': (now - timedelta(days=normalized_policy['dark_flow_keep_days'])).isoformat(),
        },
        'forensic_policy': {
            'storage_mode': 'selective_windows',
            'candidate_count': 0,
            'min_severity': 'high',
        },
        'safety_gate': {
            'purge_ready': False,
            'preview_freshness_state': 'guarded',
        },
        'preview_state': 'guarded',
    }


def _parse_signal_materialization_request(payload: Any) -> dict[str, Any]:
    payload = payload if isinstance(payload, dict) else {}
    return {
        'symbols': _normalize_symbol_list(payload.get('symbols') or []),
        'start_date': str(payload.get('start_date') or '').strip() or None,
        'end_date': str(payload.get('end_date') or '').strip() or None,
        'threshold': int(payload.get('threshold') or 0),
        'batch_size': max(100, int(payload.get('batch_size') or 2000)),
        'max_preview_rows': max(100, int(payload.get('max_preview_rows') or payload.get('batch_size') or 2000)),
    }


def _build_signal_materialization_preview_contract(payload: dict[str, Any]) -> dict[str, Any]:
    session_facts = list(SessionFacts.objects.order_by('-computed_at', '-pk')[: max(payload['max_preview_rows'], 1)])
    whale_count = WhaleAlertCanonical.objects.filter(is_dark_flow=False).count()
    dark_flow_count = OrderFlowEvent.objects.filter(signal_type=OrderFlowEvent.SignalTypeChoices.DARK_FLOW).count()
    preview = {
        'generated_at': _now_iso(),
        'read_path': 'facts_first' if session_facts else 'empty',
        'scope_symbols': payload['symbols'],
        'scope_rows': len(session_facts),
        'changed_rows': 0,
        'preview_rows_scanned': len(session_facts),
        'sample_rows': [
            {
                'symbol': row.symbol,
                'session_date': row.session_date.isoformat(),
                'cvd_normalized': row.cvd_normalized,
                'buy_strength': row.buy_strength,
                'institutional_strength': row.institutional_strength,
            }
            for row in session_facts[:10]
        ],
    }
    impacted_counts = {
        'scope_rows': len(session_facts),
        'changed_rows': 0,
        'sample_rows': len(preview['sample_rows']),
        'session_fact_rows_total': SessionFacts.objects.count(),
        'whale_event_rows_total': whale_count,
        'dark_flow_event_rows_total': dark_flow_count,
    }
    freshness = {
        'state': 'ready' if session_facts else 'empty',
        'source': 'core_session_facts',
        'read_path': preview['read_path'],
    }
    warnings = [
        {
            'field': 'materialization',
            'message': 'Materialization preview đang phản ánh core read models; writer/backfill native cho money-flow chưa được promote ở slice này.',
            'severity': 'warning',
        }
    ]
    return {
        'preview': preview,
        **_build_signal_preview_contract(
            preview_kind='materialization_preview',
            current_values={
                'symbols': [],
                'start_date': None,
                'end_date': None,
                'threshold': 0,
                'batch_size': 2000,
                'max_preview_rows': 2000,
            },
            proposed_values=payload,
            impacted_counts=impacted_counts,
            freshness=freshness,
            warnings=warnings,
            preview_state='ready' if session_facts else 'empty',
        ),
    }


def _normalize_signal_recent_events(domain: str, *, symbol: str | None, limit: int, offset: int = 0) -> tuple[list[dict[str, Any]], int]:
    normalized_symbol = str(symbol or '').strip().upper()
    fetch_limit = max(limit + max(offset, 0), limit)
    rows: list[dict[str, Any]] = []
    total_count = 0

    if domain in {'all', 'whale'}:
        whale_queryset = (
            WhaleAlertCanonical.objects.select_related('alert')
            .filter(is_dark_flow=False)
            .order_by('-executed_at', '-pk')
        )
        if normalized_symbol:
            whale_queryset = whale_queryset.filter(symbol=normalized_symbol)
        total_count += whale_queryset.count()
        for item in whale_queryset[:fetch_limit]:
            rows.append(
                {
                    'domain': 'whale',
                    'event_id': str(item.alert.alert_id),
                    'symbol': item.symbol,
                    'severity': item.alert.severity,
                    'ts': item.executed_at.isoformat() if item.executed_at else None,
                    'summary_value': float(item.matched_value or 0),
                    'source': item.order_id,
                }
            )

    if domain in {'all', 'dark_flow'}:
        dark_flow_queryset = OrderFlowEvent.objects.filter(signal_type=OrderFlowEvent.SignalTypeChoices.DARK_FLOW).order_by('-triggered_at', '-pk')
        if normalized_symbol:
            dark_flow_queryset = dark_flow_queryset.filter(symbol=normalized_symbol)
        event_count = dark_flow_queryset.count()
        if event_count > 0:
            total_count += event_count
            for item in dark_flow_queryset[:fetch_limit]:
                rows.append(
                    {
                        'domain': 'dark_flow',
                        'event_id': str(item.event_id),
                        'symbol': item.symbol,
                        'severity': item.unified_alert.severity if item.unified_alert_id else 'medium',
                        'ts': item.triggered_at.isoformat() if item.triggered_at else None,
                        'summary_value': float(item.strength or 0.0),
                        'source': item.signal_type,
                    }
                )
        else:
            dark_flow_alerts = UnifiedAlert.objects.filter(alert_type=UnifiedAlert.AlertTypeChoices.DARK_FLOW).order_by('-triggered_at', '-pk')
            if normalized_symbol:
                dark_flow_alerts = dark_flow_alerts.filter(symbol=normalized_symbol)
            total_count += dark_flow_alerts.count()
            for item in dark_flow_alerts[:fetch_limit]:
                rows.append(
                    {
                        'domain': 'dark_flow',
                        'event_id': str(item.alert_id),
                        'symbol': item.symbol,
                        'severity': item.severity,
                        'ts': item.triggered_at.isoformat() if item.triggered_at else None,
                        'summary_value': float(item.value or 0.0),
                        'source': item.source_ref,
                    }
                )

    rows.sort(key=lambda item: str(item.get('ts') or ''), reverse=True)
    return rows[offset: offset + limit], total_count


def _build_signal_summary_snapshot() -> dict[str, Any]:
    services_config = _signal_services_config()
    universe_policy = _signal_universe_policy()
    retention_policy = _signal_retention_policy()
    ownership = _signal_ownership_snapshot()
    retention_preview = _build_signal_retention_preview(retention_policy)
    whale_summary = _build_signal_domain_summary('whale')
    dark_flow_summary = _build_signal_domain_summary('dark_flow')

    lifecycle = {
        'tiers': {
            'raw_intraday': {
                'owner': (ownership.get('compatibility') or {}).get('raw_intraday_keep_days', {}).get('owner'),
                'status': (ownership.get('compatibility') or {}).get('raw_intraday_keep_days', {}).get('status'),
                'rows_total': (retention_preview.get('raw_intraday') or {}).get('rows_total'),
                'keep_days': (retention_preview.get('raw_intraday') or {}).get('keep_days'),
                'purge_before': (retention_preview.get('raw_intraday') or {}).get('purge_before'),
            },
            'whale_events': {
                'owner': (ownership.get('domains') or {}).get('retention_policy', {}).get('owner'),
                'rows_total': (retention_preview.get('whale_events') or {}).get('rows_total'),
                'keep_days': retention_policy.get('whale_event_keep_days'),
                'purge_before': (retention_preview.get('whale_events') or {}).get('purge_before'),
            },
            'dark_flow_events': {
                'owner': (ownership.get('domains') or {}).get('retention_policy', {}).get('owner'),
                'rows_total': (retention_preview.get('dark_flow_events') or {}).get('rows_total'),
                'keep_days': retention_policy.get('dark_flow_keep_days'),
                'purge_before': (retention_preview.get('dark_flow_events') or {}).get('purge_before'),
            },
            'forensic_windows': {
                'owner': (ownership.get('domains') or {}).get('retention_policy', {}).get('owner'),
                'storage_mode': (retention_preview.get('forensic_policy') or {}).get('storage_mode'),
                'candidate_count': (retention_preview.get('forensic_policy') or {}).get('candidate_count'),
                'min_severity': (retention_preview.get('forensic_policy') or {}).get('min_severity'),
            },
        },
        'materialization_lag': {
            'whale': {
                'freshness_state': (whale_summary.get('materialization') or {}).get('freshness_state'),
                'lag_seconds': (whale_summary.get('materialization') or {}).get('lag_seconds'),
                'session_summary_state': (whale_summary.get('materialization') or {}).get('session_summary_state'),
            },
            'dark_flow': {
                'freshness_state': (dark_flow_summary.get('materialization') or {}).get('freshness_state'),
                'lag_seconds': (dark_flow_summary.get('materialization') or {}).get('lag_seconds'),
                'session_summary_state': (dark_flow_summary.get('materialization') or {}).get('session_summary_state'),
            },
        },
        'anomaly_backlog': {
            'whale': len(whale_summary.get('anomaly_markers') or []),
            'dark_flow': len(dark_flow_summary.get('anomaly_markers') or []),
            'total': len(whale_summary.get('anomaly_markers') or []) + len(dark_flow_summary.get('anomaly_markers') or []),
        },
        'effective_owner_matrix': ownership,
        'deprecation_warnings': list(ownership.get('deprecation_notes') or []),
    }

    latest_cached_at = max(
        [value for value in [
            (whale_summary.get('cache_freshness') or {}).get('cached_at'),
            (dark_flow_summary.get('cache_freshness') or {}).get('cached_at'),
        ] if value],
        default=None,
    )

    return {
        'ok': True,
        'sampled_at': _now_iso(),
        'services': {
            'enabled': bool(services_config.get('enabled', True)),
            'whale': {
                'enabled': bool((services_config.get('whale_service') or {}).get('enabled', True)),
                **whale_summary,
            },
            'dark_flow': {
                'enabled': bool((services_config.get('dark_flow_service') or {}).get('enabled', True)),
                **dark_flow_summary,
            },
        },
        'distribution': services_config.get('distribution') or {},
        'universe': _build_signal_universe_snapshot(universe_policy),
        'retention': retention_preview,
        'ownership': ownership,
        'lifecycle': lifecycle,
        'whale_governance': _build_signal_whale_governance_snapshot(),
        'celery': {
            'alive': _is_celery_alive(),
        },
        'cache_freshness': {
            'cached_at': latest_cached_at,
        },
    }


class AdminOpsStatsView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        return Response(_build_stats_snapshot(request))


class AdminOpsRuntimeKPIView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        # SFI-B8: Đồng bộ format với legacy UI để đảm bảo hiển thị đúng status.
        return Response(
            {
                'ok': True,
                'sampled_at': time.time(),
                'generated_at': _now_iso(),
                'market_observability': _build_market_observability_snapshot(),
                'prefetch_health': _build_prefetch_health_snapshot(),
                'prefetch_scheduler_metrics': build_scheduler_queue_metrics_snapshot(),
                'celery': {
                    'alive': _is_celery_alive(),
                    'active_queues': _get_celery_active_queues(),
                },
            }
        )


class AdminOpsSystemAiSettingsView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        config = _get_or_create_active_ai_settings()
        return Response({'ok': True, 'settings': _serialize_system_ai_settings(config)}, status=status.HTTP_200_OK)

    def put(self, request):
        payload = request.data if isinstance(request.data, dict) else {}
        
        # SFI-B6: Nếu chứa prefetch settings, thực hiện bridge sang legacy thay vì chặn đứng.
        prefetch_fields = [field for field in ('prefetch_runtime_settings', 'prefetch_time_policy') if field in payload]
        if prefetch_fields:
            logger.info("Bridging prefetch settings write to legacy admin for fields: %s", prefetch_fields)
            bridged_response = _legacy_admin_bridge_response(
                request,
                '/api/admin-ops/system-ai-settings/',
                unavailable_message='Không cập nhật được prefetch settings qua legacy bridge.',
            )
            if bridged_response:
                return bridged_response

        config = _get_or_create_active_ai_settings()
        metadata = deepcopy(config.metadata or {})
        changed_fields = []

        if 'governance_delta_thresholds' in payload:
            governance_thresholds, error_message = _validate_governance_thresholds(payload.get('governance_delta_thresholds'))
            if error_message is not None:
                return Response({'ok': False, 'message': error_message}, status=status.HTTP_400_BAD_REQUEST)
            metadata['governance_delta_thresholds'] = governance_thresholds
            changed_fields.append('governance_delta_thresholds')

        if 'ai_provider' in payload:
            metadata['ai_provider'] = str(payload.get('ai_provider') or '').strip().lower()
            changed_fields.append('ai_provider')

        if 'allow_env_fallback' in payload:
            metadata['allow_env_fallback'] = bool(payload.get('allow_env_fallback'))
            changed_fields.append('allow_env_fallback')

        if 'notes' in payload:
            metadata['notes'] = str(payload.get('notes') or '')
            changed_fields.append('notes')

        if 'ai_api_key' in payload:
            metadata['ai_api_key_configured'] = bool(str(payload.get('ai_api_key') or '').strip())
            changed_fields.append('ai_api_key_configured')

        if 'ai_model' in payload and str(payload.get('ai_model') or '').strip():
            config.ai_model = str(payload.get('ai_model') or '').strip()
            changed_fields.append('ai_model')

        if 'max_tokens' in payload:
            try:
                config.max_tokens = int(payload.get('max_tokens'))
            except (TypeError, ValueError):
                return Response({'ok': False, 'message': 'max_tokens phải là số nguyên hợp lệ.'}, status=status.HTTP_400_BAD_REQUEST)
            changed_fields.append('max_tokens')

        if 'temperature' in payload:
            try:
                config.temperature = float(payload.get('temperature'))
            except (TypeError, ValueError):
                return Response({'ok': False, 'message': 'temperature phải là số hợp lệ.'}, status=status.HTTP_400_BAD_REQUEST)
            changed_fields.append('temperature')

        if 'prompt_template' in payload:
            config.prompt_template = str(payload.get('prompt_template') or '')
            changed_fields.append('prompt_template')

        if 'is_active' in payload:
            config.is_active = bool(payload.get('is_active'))
            changed_fields.append('is_active')

        config.metadata = metadata
        config.save()

        _record_audit_event(
            actor=request.user,
            action='update',
            resource_type='system_ai_settings',
            resource_id=str(config.pk),
            metadata={'changed_fields': changed_fields},
        )
        return Response(
            {
                'ok': True,
                'message': 'Đã cập nhật cấu hình AI runtime core-native.',
                'settings': _serialize_system_ai_settings(config),
            },
            status=status.HTTP_200_OK,
        )


class AdminOpsVnbrokerConfigCurrentView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        config = _get_or_create_active_vnbroker_config()
        return Response(
            {
                'ok': True,
                'settings': _serialize_vnbroker_settings(config),
                'rulebook': _serialize_vnbroker_rulebook(),
            },
            status=status.HTTP_200_OK,
        )

    def patch(self, request):
        payload, errors = _validate_vnbroker_payload(request.data)
        if errors:
            return Response(
                {
                    'ok': False,
                    'message': 'Dữ liệu cấu hình không hợp lệ.',
                    'field_errors': errors,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        config = _get_or_create_active_vnbroker_config()
        before = _serialize_vnbroker_settings(config)
        extra = _vnbroker_extra(config)

        if 'max_concurrency' in payload:
            config.max_workers = payload['max_concurrency']
        if 'retry_attempts' in payload:
            config.max_retries = payload['retry_attempts']
        if 'price_board_source' in payload:
            config.data_source = payload['price_board_source']
        if 'retry_backoff_seconds' in payload:
            extra['retry_backoff_seconds'] = payload['retry_backoff_seconds']
        if 'rate_limit_cooldown_seconds' in payload:
            extra['rate_limit_cooldown_seconds'] = payload['rate_limit_cooldown_seconds']
        if 'fallback_sources' in payload:
            fallback_sources = payload['fallback_sources']
            if config.data_source not in fallback_sources:
                fallback_sources = [config.data_source, *[source for source in fallback_sources if source != config.data_source]]
            extra['fallback_sources'] = fallback_sources
        if 'timeout_config' in payload:
            merged_timeout = {
                **DEFAULT_VNBROKER_TIMEOUT_CONFIG,
                **extra.get('timeout_config', {}),
                **payload['timeout_config'],
            }
            extra['timeout_config'] = merged_timeout
        for field in ('enable_caching', 'enable_rate_limit_detection', 'enable_concurrent_limit'):
            if field in payload:
                extra[field] = payload[field]

        extra['updated_by_username'] = request.user.get_username()
        config.extra = extra
        config.save()

        after = _serialize_vnbroker_settings(config)
        changes = {
            key: {'before': before.get(key), 'after': after.get(key)}
            for key in after
            if before.get(key) != after.get(key)
        }
        _append_vnbroker_changelog(config, request.user, reason='update_config', changes=changes)
        config.save(update_fields=['extra', 'updated_at'])

        _record_audit_event(
            actor=request.user,
            action='update',
            resource_type='vnbroker_runtime_config',
            resource_id=str(config.pk),
            metadata={'changed_fields': sorted(changes.keys())},
        )
        return Response(
            {
                'ok': True,
                'message': 'Đã cập nhật Runtime Vnbroker Config trên core-api.',
                'settings': _serialize_vnbroker_settings(config),
            },
            status=status.HTTP_200_OK,
        )


class AdminOpsVnbrokerConfigResetView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        config = _get_or_create_active_vnbroker_config()
        config.is_active = True
        config.data_source = 'KBS'
        config.max_workers = 4
        config.request_delay_ms = 200
        config.max_retries = 3
        config.batch_size = 50
        config.extra = deepcopy(DEFAULT_VNBROKER_EXTRA)
        _append_vnbroker_changelog(config, request.user, reason='reset_to_defaults', changes={'reset': True})
        config.save()

        _record_audit_event(
            actor=request.user,
            action='update',
            resource_type='vnbroker_runtime_config',
            resource_id=str(config.pk),
            metadata={'reason': 'reset_to_defaults'},
        )
        return Response(
            {
                'ok': True,
                'message': 'Đã reset Runtime Vnbroker Config về mặc định trên core-api.',
                'settings': _serialize_vnbroker_settings(config),
            },
            status=status.HTTP_200_OK,
        )


class AdminOpsVnbrokerConfigChangelogView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        limit = max(1, min(int(request.query_params.get('limit', 30)), 200))
        offset = max(0, int(request.query_params.get('offset', 0)))
        config = _get_or_create_active_vnbroker_config()
        entries = list((_vnbroker_extra(config).get('changelog') or []))
        total = len(entries)
        rows = entries[offset: offset + limit]
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


class AdminOpsPrefetchWarmView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        from data_ingest.tasks import fetch_and_upsert_price_board

        mode = str(request.query_params.get('mode') or (request.data.get('mode') if isinstance(request.data, dict) else '') or 'async').strip().lower()
        job, _ = IngestJob.objects.get_or_create(
            name='core-price-board-prefetch',
            defaults={
                'source': IngestJob.SourceChoices.VNBROKER_PRICE_BOARD,
                'status': IngestJob.StatusChoices.ACTIVE,
                'schedule_seconds': 60,
                'config': {},
            },
        )
        if job.source != IngestJob.SourceChoices.VNBROKER_PRICE_BOARD:
            job.source = IngestJob.SourceChoices.VNBROKER_PRICE_BOARD
            job.save(update_fields=['source', 'updated_at'])

        if mode == 'sync':
            result = fetch_and_upsert_price_board.run(job_id=job.id)
            _record_audit_event(
                actor=request.user,
                action='update',
                resource_type='prefetch_warm',
                resource_id=str(job.pk),
                metadata={'mode': 'sync', 'status': result.get('status')},
            )
            return Response(
                {
                    'queued': False,
                    'mode': 'sync',
                    'ok': str(result.get('status') or '').lower() == 'ok',
                    'flow': 'core_price_board_ingest',
                    'result': result,
                    'prefetch': _build_prefetch_health_snapshot(),
                },
                status=status.HTTP_200_OK,
            )

        task = fetch_and_upsert_price_board.apply_async(kwargs={'job_id': job.id})
        _record_audit_event(
            actor=request.user,
            action='update',
            resource_type='prefetch_warm',
            resource_id=str(job.pk),
            metadata={'mode': 'async', 'task_id': str(task.id)},
        )
        return Response(
            {
                'queued': True,
                'mode': 'async',
                'task_id': str(task.id),
                'flow': 'core_price_board_ingest',
                'prefetch': _build_prefetch_health_snapshot(),
            },
            status=status.HTTP_202_ACCEPTED,
        )


class AdminOpsSignalsSummaryView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        return Response(_build_signal_summary_snapshot(), status=status.HTTP_200_OK)


class AdminOpsSignalsConfigView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        bridged_response = _legacy_admin_bridge_response(
            request,
            '/api/admin-ops/signals/config/',
            unavailable_message='Không đọc được signal config từ legacy SSOT bridge.',
        )
        if bridged_response is not None:
            return bridged_response
        return Response(
            {
                'ok': True,
                'services_config': _signal_services_config(),
                'universe_policy': _signal_universe_policy(),
                'retention_policy': _signal_retention_policy(),
                'ownership': _signal_ownership_snapshot(),
            },
            status=status.HTTP_200_OK,
        )

    def put(self, request):
        bridged_response = _legacy_admin_bridge_response(
            request,
            '/api/admin-ops/signals/config/',
            unavailable_message='Không ghi được signal config qua legacy SSOT bridge.',
        )
        if bridged_response is not None:
            return bridged_response
        return _signal_write_guard(SIGNAL_CONFIG_WRITE_BLOCK_MESSAGE)


class AdminOpsSignalsConfigPreviewView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        bridged_response = _legacy_admin_bridge_response(
            request,
            '/api/admin-ops/signals/config/preview/',
            unavailable_message='Không tạo được signal config preview từ legacy SSOT bridge.',
        )
        if bridged_response is not None:
            return bridged_response
        current_services = _signal_services_config()
        current_universe = _signal_universe_policy()
        current_retention = _signal_retention_policy()
        proposed_services = _coerce_signal_services_config((request.data or {}).get('services_config'), fallback=current_services)
        proposed_universe = _coerce_signal_universe_policy((request.data or {}).get('universe_policy'), fallback=current_universe)
        proposed_retention = _coerce_signal_retention_policy((request.data or {}).get('retention_policy'), fallback=current_retention)
        preview_contract = _build_signal_preview_contract(
            preview_kind='config_preview',
            current_values={
                'services_config': current_services,
                'universe_policy': current_universe,
                'retention_policy': current_retention,
            },
            proposed_values={
                'services_config': proposed_services,
                'universe_policy': proposed_universe,
                'retention_policy': proposed_retention,
            },
            impacted_counts={
                'services_config': len(_build_config_changes(current_services, proposed_services)),
                'universe_policy': len(_build_config_changes(current_universe, proposed_universe)),
                'retention_policy': len(_build_config_changes(current_retention, proposed_retention)),
            },
            freshness=_build_signal_freshness_snapshot(),
        )
        return Response(
            {
                'ok': True,
                'preview': {
                    'services_config': proposed_services,
                    'universe_policy': proposed_universe,
                    'retention_policy': proposed_retention,
                },
                'ownership': _signal_ownership_snapshot(),
                'changes': {
                    'services_config': _build_config_changes(current_services, proposed_services),
                    'universe_policy': _build_config_changes(current_universe, proposed_universe),
                    'retention_policy': _build_config_changes(current_retention, proposed_retention),
                },
                'universe_preview': _build_signal_universe_snapshot(proposed_universe),
                **preview_contract,
            },
            status=status.HTTP_200_OK,
        )


class AdminOpsSignalsUniversePreviewView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        bridged_response = _legacy_admin_bridge_response(
            request,
            '/api/admin-ops/signals/universe/preview/',
            unavailable_message='Không tạo được signal universe preview từ legacy SSOT bridge.',
        )
        if bridged_response is not None:
            return bridged_response
        policy = _coerce_signal_universe_policy(request.data or {}, fallback=_signal_universe_policy())
        return Response(
            {
                'ok': True,
                'policy': policy,
                'preview': _build_signal_universe_snapshot(policy),
            },
            status=status.HTTP_200_OK,
        )


class AdminOpsSignalsUniverseApplyView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        bridged_response = _legacy_admin_bridge_response(
            request,
            '/api/admin-ops/signals/universe/apply/',
            unavailable_message='Không áp dụng được signal universe qua legacy SSOT bridge.',
        )
        if bridged_response is not None:
            return bridged_response
        return _signal_write_guard(SIGNAL_CONFIG_WRITE_BLOCK_MESSAGE)


class AdminOpsSignalsMaterializationPreviewView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        payload = _parse_signal_materialization_request(request.data or {})
        return Response(_build_signal_materialization_preview_contract(payload), status=status.HTTP_200_OK)


class AdminOpsSignalsJobsView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        bridged_response = _legacy_admin_bridge_response(
            request,
            '/api/admin-ops/signals/jobs/',
            unavailable_message='Không tải được signal jobs từ legacy detector bridge.',
        )
        if bridged_response is not None and bridged_response.status_code != status.HTTP_503_SERVICE_UNAVAILABLE:
            return bridged_response
        page = _parse_positive_int(request.query_params.get('page'), 1, maximum=100000)
        page_size = _parse_positive_int(request.query_params.get('page_size', request.query_params.get('limit')), 20, maximum=100)
        service_domain = str(request.query_params.get('service_domain') or '').strip().lower() or None
        queryset = _signal_run_queryset(service_domain)
        total_count = queryset.count()
        offset = (page - 1) * page_size
        rows = list(queryset[offset: offset + page_size])
        return Response(
            {
                'ok': True,
                'count': total_count,
                'page': page,
                'page_size': page_size,
                'results': [_serialize_signal_run(row) for row in rows],
            },
            status=status.HTTP_200_OK,
        )


class AdminOpsSignalsJobsRunView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        from signal_intelligence.tasks import run_signal_detection_job
        
        domain = str(request.data.get('domain') or 'all').strip().lower()
        symbol = request.data.get('symbol')
        
        # SM-P4 Native: Trigger native signal detection job.
        task_result = run_signal_detection_job.delay(domain=domain, symbol=symbol)
        
        return Response(
            {
                'status': 'accepted', 
                'task_id': task_result.id,
                'message': f'Đã kích hoạt native signal detection cho domain: {domain}'
            }, 
            status=status.HTTP_200_OK
        )


class AdminOpsSignalsJobRetryView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def post(self, request, run_id: int):
        from signal_intelligence.tasks import run_signal_detection_job
        
        # SM-P4 Native: Retry logic in native context (re-triggering for now).
        # In a full implementation, we would look up the old run's params.
        task_result = run_signal_detection_job.delay()
        
        return Response(
            {
                'status': 'accepted', 
                'task_id': task_result.id,
                'message': f'Đã kích hoạt retry cho signal job {run_id}.'
            }, 
            status=status.HTTP_200_OK
        )


class AdminOpsVnbrokerBenchmarkLatestView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        bridged_response = _legacy_admin_bridge_response(
            request,
            '/api/admin-ops/vnbroker-config/benchmark-price-board/latest/',
            unavailable_message='Không đọc được benchmark price board từ legacy admin bridge.',
        )
        if bridged_response is not None:
            return bridged_response
        return Response({'status': 'not_available'}, status=status.HTTP_200_OK)


class AdminOpsVnbrokerBenchmarkRunView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        bridged_response = _legacy_admin_bridge_response(
            request,
            '/api/admin-ops/vnbroker-config/benchmark-price-board/run/',
            unavailable_message='Không chạy được benchmark price board qua legacy admin bridge.',
        )
        if bridged_response is not None:
            return bridged_response
        return Response({'status': 'not_available'}, status=status.HTTP_200_OK)


class AdminOpsMarketGroupsSyncView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        from data_ingest.tasks import sync_market_groups
        
        # SM-P4 Native: Trigger native market group sync.
        task_result = sync_market_groups.delay()
        
        return Response(
            {
                'status': 'accepted', 
                'task_id': task_result.id,
                'message': 'Đã kích hoạt native market groups sync.'
            }, 
            status=status.HTTP_200_OK
        )


class AdminOpsIntradaySideBackfillPreviewView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        bridged_response = _legacy_admin_bridge_response(
            request,
            '/api/admin-ops/intraday-side-backfill/preview/',
            unavailable_message='Không tạo được intraday side backfill preview qua legacy admin bridge.',
        )
        if bridged_response is not None:
            return bridged_response
        return Response({'status': 'accepted', 'task_id': None}, status=status.HTTP_200_OK)


class AdminOpsIntradaySideBackfillApplyView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        bridged_response = _legacy_admin_bridge_response(
            request,
            '/api/admin-ops/intraday-side-backfill/apply/',
            unavailable_message='Không apply được intraday side backfill qua legacy admin bridge.',
        )
        if bridged_response is not None:
            return bridged_response
        return Response({'status': 'accepted', 'task_id': None}, status=status.HTTP_200_OK)


class AdminOpsIntradaySideBackfillStatusView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request, task_id: str):
        bridged_response = _legacy_admin_bridge_response(
            request,
            f'/api/admin-ops/intraday-side-backfill/status/{task_id}/',
            unavailable_message='Không đọc được intraday side backfill status từ legacy admin bridge.',
        )
        if bridged_response is not None:
            return bridged_response
        return Response({'status': 'ok', 'results': [], 'count': 0}, status=status.HTTP_200_OK)


class AdminOpsIntradayUniverseWarmNowView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        from data_ingest.tasks import warm_intraday_universe
        
        # SM-P4 Native: Trigger native intraday cache warm-up.
        task_result = warm_intraday_universe.delay()
        
        return Response(
            {
                'status': 'accepted', 
                'task_id': task_result.id,
                'message': 'Đã kích hoạt native warmup cho intraday universe.'
            }, 
            status=status.HTTP_202_ACCEPTED
        )


class AdminOpsSignalsRecentEventsView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        domain = str(request.query_params.get('domain') or 'all').strip().lower()
        if domain not in {'all', 'whale', 'dark_flow'}:
            return Response(
                {'ok': False, 'message': 'domain chỉ hỗ trợ all, whale, dark_flow.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        symbol = request.query_params.get('symbol')
        page = _parse_positive_int(request.query_params.get('page'), 1, maximum=100000)
        page_size = _parse_positive_int(request.query_params.get('page_size', request.query_params.get('limit')), 20, maximum=100)
        offset = (page - 1) * page_size
        results, total_count = _normalize_signal_recent_events(domain, symbol=symbol, limit=page_size, offset=offset)
        return Response(
            {
                'ok': True,
                'count': total_count,
                'page': page,
                'page_size': page_size,
                'results': results,
            },
            status=status.HTTP_200_OK,
        )


class AdminOpsSignalsRetentionPreviewView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        proposed_policy = _coerce_signal_retention_policy((request.data or {}).get('retention_policy', request.data or {}), fallback=_signal_retention_policy())
        preview = _build_signal_retention_preview(proposed_policy)
        preview_contract = _build_signal_preview_contract(
            preview_kind='retention_preview',
            current_values=_signal_retention_policy(),
            proposed_values=proposed_policy,
            impacted_counts={
                'raw_intraday_rows_total': int((preview.get('raw_intraday') or {}).get('rows_total') or 0),
                'whale_event_rows_total': int((preview.get('whale_events') or {}).get('rows_total') or 0),
                'dark_flow_rows_total': int((preview.get('dark_flow_events') or {}).get('rows_total') or 0),
                'forensic_candidate_count': int((preview.get('forensic_policy') or {}).get('candidate_count') or 0),
            },
            freshness={
                'state': preview.get('preview_state') or 'guarded',
                'source': 'core_signal_retention_preview',
                'preview_freshness_state': (preview.get('safety_gate') or {}).get('preview_freshness_state'),
            },
            preview_state=preview.get('preview_state') or 'guarded',
        )
        return Response(
            {
                'ok': True,
                'preview': preview,
                **preview_contract,
            },
            status=status.HTTP_200_OK,
        )
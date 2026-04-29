from __future__ import annotations

from datetime import timedelta

from django.core.cache import cache
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response

from portfolio.global_signal_policy_helpers import (
    coerce_global_signal_retention_policy,
    coerce_global_signal_services_config,
    coerce_global_signal_universe_policy,
    get_global_signal_retention_policy,
    get_global_signal_services_config,
    get_global_signal_universe_policy,
    set_global_signal_retention_policy,
    set_global_signal_services_config,
    set_global_signal_universe_policy,
)
from portfolio.models import IntradayTick, OrderFlowSignal, SignalServiceRun, WhaleAlertEvent
from portfolio.serializers import SignalServiceRunSerializer
from portfolio.services_global_signal_universe import GlobalSignalUniverseResolver
from portfolio.services_global_whale_alerts import GLOBAL_WHALE_LATEST_EVENT_CACHE_PREFIX
from portfolio.tasks import detect_and_store_global_whale_alerts, detect_and_store_order_flow
from portfolio.tasks_order_flow import ORDER_FLOW_LATEST_SIGNAL_CACHE_PREFIX
from portfolio.views_admin_runtime import _is_celery_worker_available


def _truthy(value) -> bool:
    return str(value or '').strip().lower() in {'1', 'true', 'yes', 'on'}


def _parse_bounded_positive_int(value, default: int, *, minimum: int = 1, maximum: int = 100) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return default
    return max(minimum, min(parsed, maximum))


def _build_config_changes(before: dict, after: dict) -> dict:
    changes = {}
    for key, before_value in before.items():
        after_value = after.get(key)
        if before_value != after_value:
            changes[key] = {
                'before': before_value,
                'after': after_value,
            }
    return changes


def _serialize_run(run: SignalServiceRun | None) -> dict | None:
    if run is None:
        return None
    return SignalServiceRunSerializer(run).data


def _latest_run(service_domain: str, *, statuses: set[str]) -> SignalServiceRun | None:
    return (
        SignalServiceRun.objects.filter(service_domain=service_domain, status__in=statuses)
        .order_by('-created_at', '-id')
        .first()
    )


def _latest_whale_cache_payload() -> dict | None:
    latest_event = WhaleAlertEvent.objects.order_by('-occurred_at', '-id').first()
    if latest_event is None:
        return None
    return cache.get(f'{GLOBAL_WHALE_LATEST_EVENT_CACHE_PREFIX}:{latest_event.symbol}')


def _latest_dark_flow_cache_payload() -> dict | None:
    latest_signal = OrderFlowSignal.objects.order_by('-created_at', '-id').first()
    if latest_signal is None:
        return None
    return cache.get(f'{ORDER_FLOW_LATEST_SIGNAL_CACHE_PREFIX}:{latest_signal.symbol}')


def _build_summary_domain_payload(service_domain: str) -> dict:
    now = timezone.now()
    window_start = now - timedelta(hours=24)

    if service_domain == SignalServiceRun.ServiceDomain.WHALE:
        latest_event = WhaleAlertEvent.objects.order_by('-occurred_at', '-id').first()
        cache_payload = _latest_whale_cache_payload()
        recent_count = WhaleAlertEvent.objects.filter(occurred_at__gte=window_start).count()
        total_count = WhaleAlertEvent.objects.count()
        latest_payload = {
            'event_id': latest_event.event_id,
            'symbol': latest_event.symbol,
            'severity': latest_event.severity,
            'occurred_at': latest_event.occurred_at.isoformat() if latest_event and latest_event.occurred_at else None,
        } if latest_event else None
    else:
        latest_event = OrderFlowSignal.objects.order_by('-created_at', '-id').first()
        cache_payload = _latest_dark_flow_cache_payload()
        recent_count = OrderFlowSignal.objects.filter(created_at__gte=window_start).count()
        total_count = OrderFlowSignal.objects.count()
        latest_payload = {
            'event_id': latest_event.event_id,
            'symbol': latest_event.symbol,
            'severity': latest_event.severity,
            'occurred_at': latest_event.created_at.isoformat() if latest_event and latest_event.created_at else None,
        } if latest_event else None

    return {
        'last_successful_run': _serialize_run(_latest_run(service_domain, statuses={SignalServiceRun.StatusChoices.COMPLETED, SignalServiceRun.StatusChoices.PARTIAL})),
        'last_failed_run': _serialize_run(_latest_run(service_domain, statuses={SignalServiceRun.StatusChoices.FAILED})),
        'recent_event_count_24h': recent_count,
        'total_event_count': total_count,
        'latest_event': latest_payload,
        'cache_freshness': {
            'cached_at': (cache_payload or {}).get('cached_at'),
            'event_ts': (cache_payload or {}).get('ts') or (cache_payload or {}).get('triggered_at'),
        },
    }


def _build_retention_preview(policy: dict) -> dict:
    now = timezone.now()
    raw_cutoff = (now - timedelta(days=int(policy.get('raw_intraday_keep_days', 7) or 7))).isoformat()
    whale_cutoff = (now - timedelta(days=int(policy.get('whale_event_keep_days', 90) or 90))).isoformat()
    dark_flow_cutoff = (now - timedelta(days=int(policy.get('dark_flow_keep_days', 90) or 90))).isoformat()

    return {
        'policy': policy,
        'raw_intraday': {
            'rows_total': IntradayTick.objects.count(),
            'earliest_trade_date': IntradayTick.objects.order_by('trade_date', 'trade_time').values_list('trade_date', flat=True).first(),
            'purge_before': raw_cutoff,
        },
        'whale_events': {
            'rows_total': WhaleAlertEvent.objects.count(),
            'earliest_occurred_at': (WhaleAlertEvent.objects.order_by('occurred_at').values_list('occurred_at', flat=True).first() or None),
            'purge_before': whale_cutoff,
        },
        'dark_flow_events': {
            'rows_total': OrderFlowSignal.objects.count(),
            'earliest_created_at': (OrderFlowSignal.objects.order_by('created_at').values_list('created_at', flat=True).first() or None),
            'purge_before': dark_flow_cutoff,
        },
    }


def _normalize_recent_events(domain: str, symbol: str | None, limit: int, *, offset: int = 0) -> tuple[list[dict], int]:
    normalized_symbol = str(symbol or '').strip().upper()
    fetch_limit = max(limit + max(offset, 0), limit)
    events = []
    total_count = 0

    if domain in {'all', 'whale'}:
        whale_qs = WhaleAlertEvent.objects.order_by('-occurred_at', '-id')
        if normalized_symbol:
            whale_qs = whale_qs.filter(symbol=normalized_symbol)
        total_count += whale_qs.count()
        for event in whale_qs[:fetch_limit]:
            events.append(
                {
                    'domain': 'whale',
                    'event_id': event.event_id,
                    'symbol': event.symbol,
                    'severity': event.severity,
                    'ts': event.occurred_at.isoformat() if event.occurred_at else None,
                    'summary_value': float(event.matched_value_vnd or 0),
                    'source': event.source,
                }
            )

    if domain in {'all', 'dark_flow'}:
        dark_flow_qs = OrderFlowSignal.objects.order_by('-created_at', '-id')
        if normalized_symbol:
            dark_flow_qs = dark_flow_qs.filter(symbol=normalized_symbol)
        total_count += dark_flow_qs.count()
        for signal in dark_flow_qs[:fetch_limit]:
            events.append(
                {
                    'domain': 'dark_flow',
                    'event_id': signal.event_id,
                    'symbol': signal.symbol,
                    'severity': signal.severity,
                    'ts': signal.created_at.isoformat() if signal.created_at else None,
                    'summary_value': float(signal.strength or 0),
                    'source': signal.signal_type,
                }
            )

    events.sort(key=lambda item: str(item.get('ts') or ''), reverse=True)
    return events[offset:offset + limit], total_count


@api_view(['GET'])
@permission_classes([IsAdminUser])
def signal_admin_summary_api(request):
    services_config = get_global_signal_services_config()
    universe_snapshot = GlobalSignalUniverseResolver.build_snapshot()
    retention_policy = get_global_signal_retention_policy()

    return Response(
        {
            'ok': True,
            'sampled_at': timezone.now().isoformat(),
            'services': {
                'enabled': bool(services_config.get('enabled', True)),
                'whale': {
                    'enabled': bool((services_config.get('whale_service') or {}).get('enabled', True)),
                    **_build_summary_domain_payload(SignalServiceRun.ServiceDomain.WHALE),
                },
                'dark_flow': {
                    'enabled': bool((services_config.get('dark_flow_service') or {}).get('enabled', True)),
                    **_build_summary_domain_payload(SignalServiceRun.ServiceDomain.DARK_FLOW),
                },
            },
            'distribution': services_config.get('distribution') or {},
            'universe': {
                'generated_at': universe_snapshot.get('generated_at'),
                'counts': universe_snapshot.get('counts') or {},
                'sources': universe_snapshot.get('sources') or {},
            },
            'retention': _build_retention_preview(retention_policy),
            'celery': {
                'alive': _is_celery_worker_available(),
            },
        },
        status=status.HTTP_200_OK,
    )


@api_view(['GET', 'PUT'])
@permission_classes([IsAdminUser])
def signal_admin_config_api(request):
    if request.method == 'GET':
        return Response(
            {
                'ok': True,
                'services_config': get_global_signal_services_config(),
                'universe_policy': get_global_signal_universe_policy(),
                'retention_policy': get_global_signal_retention_policy(),
            },
            status=status.HTTP_200_OK,
        )

    current_services = get_global_signal_services_config()
    current_universe = get_global_signal_universe_policy()
    current_retention = get_global_signal_retention_policy()

    services_payload = request.data.get('services_config', current_services)
    universe_payload = request.data.get('universe_policy', current_universe)
    retention_payload = request.data.get('retention_policy', current_retention)

    normalized_services = coerce_global_signal_services_config(services_payload, fallback=current_services)
    normalized_universe = coerce_global_signal_universe_policy(universe_payload, fallback=current_universe)
    normalized_retention = coerce_global_signal_retention_policy(retention_payload, fallback=current_retention)

    set_global_signal_services_config(normalized_services)
    set_global_signal_universe_policy(normalized_universe)
    set_global_signal_retention_policy(normalized_retention)

    return Response(
        {
            'ok': True,
            'services_config': normalized_services,
            'universe_policy': normalized_universe,
            'retention_policy': normalized_retention,
            'changes': {
                'services_config': _build_config_changes(current_services, normalized_services),
                'universe_policy': _build_config_changes(current_universe, normalized_universe),
                'retention_policy': _build_config_changes(current_retention, normalized_retention),
            },
        },
        status=status.HTTP_200_OK,
    )


@api_view(['POST'])
@permission_classes([IsAdminUser])
def signal_admin_config_preview_api(request):
    current_services = get_global_signal_services_config()
    current_universe = get_global_signal_universe_policy()
    current_retention = get_global_signal_retention_policy()

    normalized_services = coerce_global_signal_services_config(request.data.get('services_config', current_services), fallback=current_services)
    normalized_universe = coerce_global_signal_universe_policy(request.data.get('universe_policy', current_universe), fallback=current_universe)
    normalized_retention = coerce_global_signal_retention_policy(request.data.get('retention_policy', current_retention), fallback=current_retention)

    return Response(
        {
            'ok': True,
            'preview': {
                'services_config': normalized_services,
                'universe_policy': normalized_universe,
                'retention_policy': normalized_retention,
            },
            'changes': {
                'services_config': _build_config_changes(current_services, normalized_services),
                'universe_policy': _build_config_changes(current_universe, normalized_universe),
                'retention_policy': _build_config_changes(current_retention, normalized_retention),
            },
            'universe_preview': GlobalSignalUniverseResolver.build_snapshot(config=normalized_universe),
        },
        status=status.HTTP_200_OK,
    )


@api_view(['POST'])
@permission_classes([IsAdminUser])
def signal_admin_universe_preview_api(request):
    normalized_policy = coerce_global_signal_universe_policy(request.data or {}, fallback=get_global_signal_universe_policy())
    snapshot = GlobalSignalUniverseResolver.build_snapshot(config=normalized_policy)
    return Response(
        {
            'ok': True,
            'policy': normalized_policy,
            'preview': snapshot,
        },
        status=status.HTTP_200_OK,
    )


@api_view(['POST'])
@permission_classes([IsAdminUser])
def signal_admin_universe_apply_api(request):
    if not _truthy(request.data.get('confirm')):
        return Response(
            {'ok': False, 'message': 'Phải truyền confirm=true trước khi apply universe policy.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    normalized_policy = coerce_global_signal_universe_policy(request.data.get('policy') or request.data or {}, fallback=get_global_signal_universe_policy())
    applied = set_global_signal_universe_policy(normalized_policy)
    snapshot = GlobalSignalUniverseResolver.build_snapshot(config=applied)
    return Response(
        {
            'ok': True,
            'policy': applied,
            'preview': snapshot,
        },
        status=status.HTTP_200_OK,
    )


@api_view(['GET'])
@permission_classes([IsAdminUser])
def signal_admin_jobs_api(request):
    page = _parse_bounded_positive_int(request.query_params.get('page'), 1, maximum=100000)
    page_size = _parse_bounded_positive_int(
        request.query_params.get('page_size', request.query_params.get('limit')),
        20,
    )
    service_domain = str(request.query_params.get('service_domain') or '').strip().lower()
    queryset = SignalServiceRun.objects.all().order_by('-created_at', '-id')
    if service_domain in {SignalServiceRun.ServiceDomain.WHALE, SignalServiceRun.ServiceDomain.DARK_FLOW}:
        queryset = queryset.filter(service_domain=service_domain)

    total_count = queryset.count()
    offset = (page - 1) * page_size
    rows = list(queryset[offset:offset + page_size])
    return Response(
        {
            'ok': True,
            'count': total_count,
            'page': page,
            'page_size': page_size,
            'results': SignalServiceRunSerializer(rows, many=True).data,
        },
        status=status.HTTP_200_OK,
    )


@api_view(['POST'])
@permission_classes([IsAdminUser])
def signal_admin_jobs_run_api(request):
    service_domain = str(request.data.get('service_domain') or '').strip().lower()
    if service_domain not in {SignalServiceRun.ServiceDomain.WHALE, SignalServiceRun.ServiceDomain.DARK_FLOW}:
        return Response({'ok': False, 'message': 'service_domain chỉ hỗ trợ whale hoặc dark_flow.'}, status=status.HTTP_400_BAD_REQUEST)

    symbol = str(request.data.get('symbol') or '').strip().upper() or None
    run = SignalServiceRun.objects.create(
        service_domain=service_domain,
        run_type=SignalServiceRun.RunType.MANUAL,
        status=SignalServiceRun.StatusChoices.QUEUED,
        params_json={'symbol': symbol} if symbol else {},
        created_by=request.user if request.user.is_authenticated else None,
    )

    if service_domain == SignalServiceRun.ServiceDomain.WHALE:
        task = detect_and_store_global_whale_alerts.apply_async(kwargs={'symbol': symbol, 'run_id': run.id})
    else:
        task = detect_and_store_order_flow.apply_async(kwargs={'symbol': symbol, 'run_id': run.id})

    run.task_id = str(getattr(task, 'id', '') or '')
    run.save(update_fields=['task_id', 'updated_at'])

    return Response(
        {
            'ok': True,
            'run': SignalServiceRunSerializer(run).data,
        },
        status=status.HTTP_202_ACCEPTED,
    )


@api_view(['POST'])
@permission_classes([IsAdminUser])
def signal_admin_job_retry_api(request, run_id: int):
    try:
        source_run = SignalServiceRun.objects.get(id=run_id)
    except SignalServiceRun.DoesNotExist:
        return Response({'ok': False, 'message': 'Không tìm thấy signal run.'}, status=status.HTTP_404_NOT_FOUND)

    if source_run.status in {SignalServiceRun.StatusChoices.QUEUED, SignalServiceRun.StatusChoices.RUNNING}:
        return Response({'ok': False, 'message': 'Run đang chờ hoặc đang chạy, chưa thể retry.'}, status=status.HTTP_400_BAD_REQUEST)

    retry_run = SignalServiceRun.objects.create(
        service_domain=source_run.service_domain,
        run_type=SignalServiceRun.RunType.MANUAL,
        status=SignalServiceRun.StatusChoices.QUEUED,
        params_json=source_run.params_json or {},
        created_by=request.user if request.user.is_authenticated else None,
    )
    symbol = (retry_run.params_json or {}).get('symbol')

    if retry_run.service_domain == SignalServiceRun.ServiceDomain.WHALE:
        task = detect_and_store_global_whale_alerts.apply_async(kwargs={'symbol': symbol, 'run_id': retry_run.id})
    else:
        task = detect_and_store_order_flow.apply_async(kwargs={'symbol': symbol, 'run_id': retry_run.id})

    retry_run.task_id = str(getattr(task, 'id', '') or '')
    retry_run.save(update_fields=['task_id', 'updated_at'])

    return Response(
        {
            'ok': True,
            'run': SignalServiceRunSerializer(retry_run).data,
        },
        status=status.HTTP_202_ACCEPTED,
    )


@api_view(['GET'])
@permission_classes([IsAdminUser])
def signal_admin_recent_events_api(request):
    domain = str(request.query_params.get('domain') or 'all').strip().lower()
    if domain not in {'all', 'whale', 'dark_flow'}:
        return Response({'ok': False, 'message': 'domain chỉ hỗ trợ all, whale, dark_flow.'}, status=status.HTTP_400_BAD_REQUEST)

    symbol = request.query_params.get('symbol')
    page = _parse_bounded_positive_int(request.query_params.get('page'), 1, maximum=100000)
    page_size = _parse_bounded_positive_int(
        request.query_params.get('page_size', request.query_params.get('limit')),
        20,
    )
    offset = (page - 1) * page_size
    results, total_count = _normalize_recent_events(domain, symbol, page_size, offset=offset)
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


@api_view(['POST'])
@permission_classes([IsAdminUser])
def signal_admin_retention_preview_api(request):
    payload = request.data.get('retention_policy', request.data or {})
    normalized_policy = coerce_global_signal_retention_policy(payload, fallback=get_global_signal_retention_policy())
    return Response(
        {
            'ok': True,
            'preview': _build_retention_preview(normalized_policy),
        },
        status=status.HTTP_200_OK,
    )
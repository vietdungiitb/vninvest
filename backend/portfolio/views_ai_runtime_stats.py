import json
from datetime import timedelta

from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .permissions import IsProPlan
from .models import AICommandCenterAuditLog, AICommandCenterConfig
from .serializers import AICommandCenterConfigSerializer


def _legacy_views_module():
    from . import views as legacy_views

    return legacy_views


def _get_or_create_ai_command_center_config(user):
    command_center_cfg, _ = AICommandCenterConfig.objects.get_or_create(
        user=user,
        defaults={
            'ai_provider': 'openclaw',
            'ai_model': '',
            'ai_prompt_config': {},
        },
    )
    return command_center_cfg


def _ai_command_center_prompt_config(raw_config):
    from .ai_advisory_helpers import _parse_prompt_config

    return _parse_prompt_config(raw_config)


def _ai_command_center_snapshot(command_center_cfg, runtime_cfg=None):
    runtime_cfg = runtime_cfg or {}
    prompt_config = _ai_command_center_prompt_config(getattr(command_center_cfg, 'ai_prompt_config', {}))
    return {
        'id': command_center_cfg.id,
        'user_id': command_center_cfg.user_id,
        'ai_provider': str(command_center_cfg.ai_provider or '').strip().lower(),
        'ai_model': str(command_center_cfg.ai_model or '').strip(),
        'configured_ai_model': str(command_center_cfg.ai_model or '').strip(),
        'ai_api_key_configured': bool(command_center_cfg.ai_api_key_configured),
        'ai_prompt_config': prompt_config,
        'ai_ready': bool(runtime_cfg.get('ready')),
        'effective_ai_provider': str(runtime_cfg.get('provider') or command_center_cfg.ai_provider or '').strip().lower(),
        'effective_ai_source': runtime_cfg.get('source') or 'command_center',
        'effective_ai_model': str(runtime_cfg.get('model') or command_center_cfg.get_effective_ai_model() or '').strip(),
        'ai_config_message': str(runtime_cfg.get('message') or '').strip(),
        'updated_at': command_center_cfg.updated_at.isoformat() if command_center_cfg.updated_at else None,
    }


def _parse_positive_int(value, default: int, minimum: int, maximum: int) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return default
    return max(minimum, min(maximum, parsed))


def _format_audit_value(value) -> str:
    if value is None:
        return '∅'
    if isinstance(value, bool):
        return 'true' if value else 'false'
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return '""'
        return text if len(text) <= 80 else f'{text[:77]}...'

    try:
        serialized = json.dumps(value, ensure_ascii=False, sort_keys=True)
    except TypeError:
        serialized = str(value)

    return serialized if len(serialized) <= 120 else f'{serialized[:117]}...'


def _collect_audit_diff(before_value, after_value, prefix: str = '', depth: int = 0, max_depth: int = 4, max_items: int = 12):
    if before_value == after_value:
        return []

    if depth >= max_depth:
        return [(prefix or 'value', before_value, after_value)]

    if isinstance(before_value, dict) and isinstance(after_value, dict):
        changes = []
        keys = sorted(set(before_value.keys()) | set(after_value.keys()))
        for key in keys:
            child_prefix = f'{prefix}.{key}' if prefix else str(key)
            changes.extend(
                _collect_audit_diff(
                    before_value.get(key),
                    after_value.get(key),
                    prefix=child_prefix,
                    depth=depth + 1,
                    max_depth=max_depth,
                    max_items=max_items,
                )
            )
            if len(changes) >= max_items:
                return changes[:max_items]
        return changes

    if isinstance(before_value, list) and isinstance(after_value, list):
        return [(prefix or 'value', before_value, after_value)]

    return [(prefix or 'value', before_value, after_value)]


def _build_audit_diff_summary(before_json, after_json) -> dict:
    changes = _collect_audit_diff(before_json or {}, after_json or {})
    if not changes:
        return {
            'changed_fields': [],
            'diff_count': 0,
            'diff_summary': 'Không có thay đổi chi tiết.',
        }

    changed_fields = [path for path, _, _ in changes]
    formatted_changes = [f'{path}: {_format_audit_value(before)} -> {_format_audit_value(after)}' for path, before, after in changes[:8]]
    remaining = len(changes) - len(formatted_changes)
    if remaining > 0:
        formatted_changes.append(f'... +{remaining} thay đổi nữa')

    return {
        'changed_fields': changed_fields,
        'diff_count': len(changes),
        'diff_summary': '; '.join(formatted_changes),
    }


def _create_ai_command_center_audit_log(*, command_center_cfg, actor, action, reason='', before_json=None, after_json=None):
    return AICommandCenterAuditLog.objects.create(
        command_center_config=command_center_cfg,
        actor=actor if getattr(actor, 'is_authenticated', False) else None,
        action=action,
        reason=str(reason or ''),
        before_json=before_json or {},
        after_json=after_json or {},
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

    command_center_cfg = _get_or_create_ai_command_center_config(request.user)
    provider = str(request.data.get('ai_provider') or command_center_cfg.ai_provider or 'openclaw').strip().lower()
    model = str(request.data.get('ai_model') or command_center_cfg.ai_model or '').strip()
    api_key = str(request.data.get('ai_api_key') or '').strip() or command_center_cfg.get_ai_api_key()

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
    _create_ai_command_center_audit_log(
        command_center_cfg=command_center_cfg,
        actor=request.user,
        action='test_connection_success' if payload.get('ok') else 'test_connection_failed',
        reason=str(payload.get('message') or ''),
        before_json={
            'ai_provider': provider,
            'ai_model': model,
        },
        after_json={
            'ok': bool(payload.get('ok')),
            'message': payload.get('message'),
            'prompt_tokens': int(payload.get('prompt_tokens') or 0),
            'completion_tokens': int(payload.get('completion_tokens') or 0),
        },
    )
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
            message = 'AI runtime chưa sẵn sàng. Vui lòng kiểm tra AI Command Center hoặc System AI Settings.'

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
    """GET/PUT /api/ai-config/ - đọc/cập nhật cấu hình AI cho user hiện tại (legacy route, backed by AI Command Center SSOT)."""
    from .ai_service import _resolve_provider_api_key
    from .ai_options import ADVISORY_CAPABILITY, is_model_allowed_for_capability, is_valid_model, is_valid_provider

    command_center_cfg = _get_or_create_ai_command_center_config(request.user)

    def _has_effective_ai_key(provider: str) -> bool:
        return bool(_resolve_provider_api_key(provider, command_center_cfg.get_ai_api_key()))

    ai_status = _get_ai_runtime_config_status(command_center_cfg)

    if request.method == 'GET':
        prompt_config = _ai_command_center_prompt_config(command_center_cfg.ai_prompt_config)
        return Response(
            {
                'id': command_center_cfg.id,
                'ai_provider': command_center_cfg.ai_provider,
                'ai_model': str(command_center_cfg.ai_model or '').strip(),
                'ai_api_key_configured': _has_effective_ai_key(command_center_cfg.ai_provider),
                'ai_ready': ai_status['ready'],
                'ai_config_message': ai_status['message'],
                'effective_ai_provider': ai_status['provider'],
                'effective_ai_model': ai_status['model'],
                'effective_ai_source': ai_status.get('source'),
                'ai_prompt_config': prompt_config,
                'prompt_config': prompt_config,
                'updated_at': command_center_cfg.updated_at.isoformat() if command_center_cfg.updated_at else None,
            },
            status=status.HTTP_200_OK,
        )

    serializer = AICommandCenterConfigSerializer(
        instance=command_center_cfg,
        data=request.data,
        partial=True,
    )
    if not serializer.is_valid():
        return Response({'ok': False, 'message': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

    before_snapshot = _ai_command_center_snapshot(command_center_cfg, ai_status)
    updated_cfg = serializer.save()
    updated_status = _get_ai_runtime_config_status(updated_cfg)
    after_snapshot = _ai_command_center_snapshot(updated_cfg, updated_status)

    if before_snapshot != after_snapshot:
        _create_ai_command_center_audit_log(
            command_center_cfg=updated_cfg,
            actor=request.user,
            action='update_settings',
            reason='updated_via_command_center_api',
            before_json=before_snapshot,
            after_json=after_snapshot,
        )

    return Response(
        {
            'ok': True,
            'message': 'Đã cập nhật cấu hình AI Command Center.',
            'id': updated_cfg.id,
            'ai_provider': updated_cfg.ai_provider,
            'ai_model': str(updated_cfg.ai_model or '').strip(),
            'ai_api_key_configured': _has_effective_ai_key(updated_cfg.ai_provider),
            'ai_ready': updated_status['ready'],
            'ai_config_message': updated_status['message'],
            'effective_ai_provider': updated_status['provider'],
            'effective_ai_model': updated_status['model'],
            'effective_ai_source': updated_status.get('source'),
            'ai_prompt_config': _ai_command_center_prompt_config(updated_cfg.ai_prompt_config),
            'prompt_config': _ai_command_center_prompt_config(updated_cfg.ai_prompt_config),
            'updated_at': updated_cfg.updated_at.isoformat() if updated_cfg.updated_at else None,
        },
        status=status.HTTP_200_OK,
    )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def ai_command_center_audit_logs_api(request):
    """GET /api/portfolio/ai-command-center/audit-logs/ - lịch sử thay đổi và test connection của AI Command Center."""
    limit = _parse_positive_int(request.query_params.get('limit', 50), default=50, minimum=1, maximum=200)
    offset = _parse_positive_int(request.query_params.get('offset', 0), default=0, minimum=0, maximum=10_000_000)
    action = str(request.query_params.get('action') or '').strip().lower()
    actor = str(request.query_params.get('actor') or '').strip()
    date_from_raw = str(request.query_params.get('date_from') or '').strip()
    date_to_raw = str(request.query_params.get('date_to') or '').strip()
    order = str(request.query_params.get('order') or 'desc').strip().lower()
    if order not in {'asc', 'desc'}:
        return Response({'ok': False, 'message': 'order chỉ hỗ trợ asc hoặc desc.'}, status=status.HTTP_400_BAD_REQUEST)

    valid_actions = {choice[0] for choice in AICommandCenterAuditLog.ACTION_CHOICES}
    if action and action not in valid_actions:
        return Response({'ok': False, 'message': f'action chỉ hỗ trợ: {", ".join(sorted(valid_actions))}.'}, status=status.HTTP_400_BAD_REQUEST)

    date_from = parse_date(date_from_raw) if date_from_raw else None
    if date_from_raw and date_from is None:
        return Response({'ok': False, 'message': 'date_from phải có định dạng YYYY-MM-DD.'}, status=status.HTTP_400_BAD_REQUEST)

    date_to = parse_date(date_to_raw) if date_to_raw else None
    if date_to_raw and date_to is None:
        return Response({'ok': False, 'message': 'date_to phải có định dạng YYYY-MM-DD.'}, status=status.HTTP_400_BAD_REQUEST)

    command_center_cfg = _get_or_create_ai_command_center_config(request.user)
    logs_qs = AICommandCenterAuditLog.objects.select_related('actor', 'command_center_config').filter(command_center_config=command_center_cfg)
    if action:
        logs_qs = logs_qs.filter(action=action)
    if actor:
        if actor.lower() == 'system':
            logs_qs = logs_qs.filter(actor__isnull=True)
        else:
            logs_qs = logs_qs.filter(actor__username__iexact=actor)
    if date_from:
        logs_qs = logs_qs.filter(created_at__date__gte=date_from)
    if date_to:
        logs_qs = logs_qs.filter(created_at__date__lte=date_to)

    ordering = 'created_at' if order == 'asc' else '-created_at'
    logs_qs = logs_qs.order_by(ordering)

    total = logs_qs.count()
    logs = list(logs_qs[offset: offset + limit])

    results = []
    for log in logs:
        diff_meta = _build_audit_diff_summary(log.before_json, log.after_json)
        results.append(
            {
                'id': log.id,
                'created_at': log.created_at.isoformat() if log.created_at else None,
                'action': log.action,
                'reason': log.reason,
                'actor': log.actor.username if log.actor_id else None,
                'command_center_config_id': log.command_center_config_id,
                'before_json': log.before_json,
                'after_json': log.after_json,
                'diff_summary': diff_meta['diff_summary'],
                'changed_fields': diff_meta['changed_fields'],
                'diff_count': diff_meta['diff_count'],
            }
        )

    return Response(
        {
            'ok': True,
            'count': len(results),
            'total': total,
            'offset': offset,
            'limit': limit,
            'order': order,
            'filters': {
                'action': action,
                'actor': actor,
                'date_from': date_from_raw,
                'date_to': date_to_raw,
            },
            'has_more': (offset + len(results)) < total,
            'results': results,
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

    legacy_views = _legacy_views_module()
    symbols_param = str(request.query_params.get('symbols') or '').strip()
    window = str(request.query_params.get('window') or 'session').strip().lower() or 'session'

    if symbols_param:
        symbols = [s.strip().upper() for s in symbols_param.split(',') if s.strip()]
    else:
        symbols = list(
            legacy_views.TrackedSymbol.objects.filter(user=request.user).values_list('symbol', flat=True)
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
    queryset = legacy_views.IntradayTick.objects.filter(symbol__in=symbols).annotate(
        matched_value=ExpressionWrapper(F('price') * F('volume'), output_field=FloatField())
    )

    if window == '5d':
        queryset = queryset.filter(trade_date__gte=today_local - timedelta(days=4))
    else:
        queryset = queryset.filter(trade_date=today_local)

    stats_list = []
    for symbol in symbols:
        from .services import WhaleSignalEngine
        symbol_threshold_vnd, _ = WhaleSignalEngine.resolve_threshold_vnd(request.user, symbol)
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
                'thresholdVnd': float(symbol_threshold_vnd),
                'thresholdSource': 'intraday_threshold',
            }
        )

    stats_list.sort(key=lambda item: item['totalValue'], reverse=True)

    return Response(
        {
            'ok': True,
            'window': window,
            'source': 'intraday_tick_db',
            'stats': stats_list,
            'count': len(stats_list),
            'generated_at': timezone.now().isoformat(),
        },
        status=status.HTTP_200_OK,
    )
from datetime import timedelta

from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .permissions import IsProPlan


def _legacy_views_module():
    from . import views as legacy_views

    return legacy_views


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

    legacy_views = _legacy_views_module()
    user_cfg, _ = legacy_views.UserConfig.objects.get_or_create(user=request.user)
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
    from .ai_options import ADVISORY_CAPABILITY, is_model_allowed_for_capability, is_valid_model, is_valid_provider

    legacy_views = _legacy_views_module()
    user_cfg, _ = legacy_views.UserConfig.objects.get_or_create(user=request.user)

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
        symbol_threshold_vnd, _ = legacy_views._resolve_user_whale_threshold_vnd(request.user, symbol)
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
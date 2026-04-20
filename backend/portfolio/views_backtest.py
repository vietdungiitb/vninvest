"""
PR-5 — Backtest Stats API View
GET /api/v1/whale/backtest-stats/
Params: symbol (optional), signal_type (optional: 'whale'|'order_flow')
Gating:
  - Free: chỉ trả overall win-rate toàn thị trường
  - Pro:  full stats theo từng symbol
"""
from __future__ import annotations

import logging

from django.db.models import Avg, Count, Q
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

logger = logging.getLogger(__name__)

_MIN_SIGNALS_FOR_DISPLAY = 10  # Tối thiểu 10 tín hiệu mới hiện win-rate


def _user_has_backtest_access(user) -> bool:
    try:
        from portfolio.opencore_premium import PremiumFeatureGate
        return PremiumFeatureGate.can_use_feature(user, 'whale_backtesting')
    except Exception:
        try:
            plan = user.dpi_licenses.filter(status='active').order_by('-created_at').first()
            return plan and plan.plan.name in ('pro', 'enterprise')
        except Exception:
            return False


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def backtest_stats_api(request):
    """
    GET /api/v1/whale/backtest-stats/?symbol=VNM&signal_type=whale
    """
    from portfolio.models import SignalVerification

    symbol = request.query_params.get('symbol', '').upper().strip() or None
    signal_type = request.query_params.get('signal_type', '').lower().strip() or None
    has_access = _user_has_backtest_access(request.user)

    qs = SignalVerification.objects.filter(data_warning=False)

    # Lọc theo signal_type qua content_type
    if signal_type == 'whale':
        from django.contrib.contenttypes.models import ContentType
        from portfolio.models import WhaleAdvisory
        ct = ContentType.objects.get_for_model(WhaleAdvisory)
        qs = qs.filter(content_type=ct)
    elif signal_type == 'order_flow':
        from django.contrib.contenttypes.models import ContentType
        from portfolio.models import OrderFlowSignal
        ct = ContentType.objects.get_for_model(OrderFlowSignal)
        qs = qs.filter(content_type=ct)

    if has_access and symbol:
        qs = qs.filter(symbol=symbol)
        stats = qs.aggregate(
            total=Count('id'),
            success=Count('id', filter=Q(is_success=True)),
            avg_alpha=Avg('alpha_score'),
        )
        total = stats['total'] or 0
        if total < _MIN_SIGNALS_FOR_DISPLAY:
            return Response({
                'symbol': symbol,
                'status': 'collecting',
                'message': f'Đang thu thập dữ liệu ({total}/{_MIN_SIGNALS_FOR_DISPLAY} tín hiệu)',
            })
        win_rate = round((stats['success'] or 0) / total * 100, 1)
        avg_alpha = round(float(stats['avg_alpha'] or 0) * 100, 2)
        return Response({
            'symbol': symbol,
            'total_signals': total,
            'win_rate_pct': win_rate,
            'avg_alpha_pct': avg_alpha,
            'min_signals_threshold': _MIN_SIGNALS_FOR_DISPLAY,
        })

    # Overall stats (Free) hoặc toàn thị trường (Pro không chọn symbol)
    overall = qs.aggregate(
        total=Count('id'),
        success=Count('id', filter=Q(is_success=True)),
        avg_alpha=Avg('alpha_score'),
    )
    total = overall['total'] or 0
    if total < _MIN_SIGNALS_FOR_DISPLAY:
        return Response({
            'status': 'collecting',
            'message': f'Đang thu thập dữ liệu ({total}/{_MIN_SIGNALS_FOR_DISPLAY} tín hiệu)',
        })

    win_rate = round((overall['success'] or 0) / total * 100, 1)
    avg_alpha = round(float(overall['avg_alpha'] or 0) * 100, 2)

    result = {
        'total_signals': total,
        'win_rate_pct': win_rate,
        'avg_alpha_pct': avg_alpha,
    }

    if not has_access:
        result['upgrade_prompt'] = 'Nâng cấp Pro để xem win-rate theo từng mã cụ thể'

    if has_access:
        # Top 5 mã có win-rate cao nhất
        from django.db.models import FloatField, ExpressionWrapper, F
        top_symbols = (
            SignalVerification.objects.filter(data_warning=False)
            .values('symbol')
            .annotate(
                total=Count('id'),
                success=Count('id', filter=Q(is_success=True)),
            )
            .filter(total__gte=_MIN_SIGNALS_FOR_DISPLAY)
            .order_by('-success')[:5]
        )
        result['top_symbols'] = [
            {
                'symbol': r['symbol'],
                'total': r['total'],
                'win_rate_pct': round(r['success'] / r['total'] * 100, 1),
            }
            for r in top_symbols
        ]

    return Response(result)

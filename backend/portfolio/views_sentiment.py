"""
PR-3 — AI4: Sentiment API Views
GET /api/v1/stock/<symbol>/sentiment/ — Trả về điểm tâm lý hiện tại + lịch sử 7 ngày.
Gating: Free chỉ nhận status label, Pro nhận full data.
"""
from __future__ import annotations

import logging
from decimal import Decimal

from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

logger = logging.getLogger(__name__)

_SCORE_LABELS = [
    (Decimal('0.6'),  'Bullish'),
    (Decimal('0.2'),  'Slightly Bullish'),
    (Decimal('-0.2'), 'Neutral'),
    (Decimal('-0.6'), 'Slightly Bearish'),
]


def _score_to_status(score: Decimal) -> str:
    for threshold, label in _SCORE_LABELS:
        if score >= threshold:
            return label
    return 'Bearish'


def _user_has_sentiment_access(user) -> bool:
    """Kiểm tra user có gói Pro+ không."""
    try:
        from portfolio.opencore_premium import PremiumFeatureGate
        return PremiumFeatureGate.can_use_feature(user, 'sentiment_analysis')
    except Exception:
        # Fallback: kiểm tra plan trực tiếp
        try:
            plan = user.dpi_licenses.filter(status='active').order_by('-created_at').first()
            if plan:
                return plan.plan.name in ('pro', 'enterprise')
        except Exception:
            pass
        return False


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def sentiment_detail_api(request, symbol: str):
    """
    GET /api/v1/stock/<symbol>/sentiment/
    - Pro: current_score, summary, history_7d
    - Free: chỉ status label + upgrade_prompt
    """
    from portfolio.models import SentimentLog

    symbol = symbol.upper().strip()
    if not symbol:
        return Response({'error': 'Symbol không hợp lệ'}, status=status.HTTP_400_BAD_REQUEST)

    # Lấy log mới nhất
    latest = SentimentLog.objects.filter(symbol=symbol).order_by('-captured_at').first()

    if latest is None:
        return Response({
            'symbol': symbol,
            'current_score': None,
            'status': 'Neutral',
            'summary': None,
            'history_7d': None,
            'message': 'Chưa có dữ liệu tâm lý cho mã này',
        })

    status_label = _score_to_status(latest.sentiment_score)
    has_access = _user_has_sentiment_access(request.user)

    if not has_access:
        return Response({
            'symbol': symbol,
            'current_score': None,
            'status': status_label,
            'summary': None,
            'history_7d': None,
            'upgrade_prompt': 'Nâng cấp lên gói Pro để xem điểm số chi tiết và lịch sử 7 ngày',
        })

    # Pro: full data
    since = timezone.now() - timezone.timedelta(days=7)
    history_qs = (
        SentimentLog.objects.filter(symbol=symbol, captured_at__gte=since)
        .order_by('captured_at')
        .values('captured_at', 'sentiment_score')
    )

    history_7d = [
        {
            'date': entry['captured_at'].strftime('%Y-%m-%d'),
            'score': float(entry['sentiment_score']),
        }
        for entry in history_qs
    ]

    return Response({
        'symbol': symbol,
        'current_score': float(latest.sentiment_score),
        'status': status_label,
        'summary': latest.ai_reasoning or '',
        'history_7d': history_7d,
    })

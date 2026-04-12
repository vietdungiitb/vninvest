import logging

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

logger = logging.getLogger(__name__)


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
        logger.exception('whale_symbol_summary_api error for %s', symbol)
        return Response(
            {'detail': 'Lỗi khi lấy thông tin tóm tắt whale.'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
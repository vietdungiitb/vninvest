import logging

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

logger = logging.getLogger(__name__)


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
        logger.exception('symbol_investigation_api error for %s', symbol)
        return Response(
            {'detail': 'Lỗi khi lấy thông tin co-observation.'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
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
        logger.exception('whale_symbol_summary_api error for %s', symbol)
        return Response(
            {'detail': 'Lỗi khi lấy thông tin tóm tắt whale.'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

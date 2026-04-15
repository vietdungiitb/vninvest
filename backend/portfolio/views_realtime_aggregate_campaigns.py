import logging

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .exceptions import ExternalSystemException, MarketDataValidationException
from .market_data_service import market_data_service

logger = logging.getLogger(__name__)


class WhaleFeedAggregateView(APIView):
    """
    GET /api/realtime/whale-feed/aggregate/
    Aggregate whale events với pipeline ưu tiên Redis stream -> IntradayTick DB -> vnstock.
    """

    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'realtime_whale_aggregate'

    def get(self, request):
        try:
            payload = market_data_service.get_whale_feed_aggregate(request.user, request.query_params)
            return Response(payload)
        except MarketDataValidationException as exc:
            return Response({'detail': exc.message}, status=status.HTTP_400_BAD_REQUEST)
        except ExternalSystemException as exc:
            http_status = status.HTTP_503_SERVICE_UNAVAILABLE if exc.code == 'vnstock_missing' else status.HTTP_502_BAD_GATEWAY
            return Response({'detail': exc.message, **exc.payload}, status=http_status)
        except Exception:
            logger.exception('WhaleFeedAggregateView unexpected error')
            return Response({'detail': 'Lỗi ngoài dự kiến khi tổng hợp whale events.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class WhaleCampaignsView(APIView):
    """
    GET /api/realtime/whale-campaigns/
    Group aggregate whale events thanh campaign clusters theo symbol/side/time-gap.
    """

    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'realtime_whale_aggregate'

    def get(self, request):
        try:
            payload = market_data_service.get_whale_campaigns(request.user, request.query_params)
            return Response(payload)
        except MarketDataValidationException as exc:
            return Response({'detail': exc.message}, status=status.HTTP_400_BAD_REQUEST)
        except ExternalSystemException as exc:
            http_status = status.HTTP_503_SERVICE_UNAVAILABLE if exc.code == 'vnstock_missing' else status.HTTP_502_BAD_GATEWAY
            return Response({'detail': exc.message, **exc.payload}, status=http_status)
        except Exception:
            logger.exception('WhaleCampaignsView unexpected error')
            return Response({'detail': 'Lỗi ngoài dự kiến khi tổng hợp whale campaigns.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

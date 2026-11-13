"""G0.2/C02: POST /core/v1/auth/ws-ticket/ — cap ticket WS ngan han.

Shape response CO TINH PHANG (flat {"ticket", "expiresIn"}), KHONG envelope,
vi widget fetchWsTicket doc raw r.json().ticket o top-level
(vninvestcharts-widget/src/widget/adapters/VNInvestClient.ts:813-826).
"""
from drf_spectacular.utils import extend_schema
from rest_framework import permissions, serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .ws_ticket import WS_TICKET_TTL_S, issue_ws_ticket


class WsTicketResponseSerializer(serializers.Serializer):
    ticket = serializers.CharField()
    expiresIn = serializers.IntegerField()


class WsTicketView(APIView):
    """Cap ticket WS single-use 60s cho user/PAT da xac thuc."""

    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        summary='Cap WS handshake ticket (G0.2/C02)',
        description='Tra flat {"ticket", "expiresIn"} — widget doc raw, khong envelope.',
        responses={200: WsTicketResponseSerializer, 401: {}, 403: {}},
    )
    def post(self, request):
        tenant = getattr(request, "tenant", None)
        tenant_id = str(getattr(tenant, "public_id", "") or "") or None
        ticket, _ = issue_ws_ticket(request.user.id, tenant_id, WS_TICKET_TTL_S)
        return Response({"ticket": ticket, "expiresIn": WS_TICKET_TTL_S}, status=status.HTTP_200_OK)

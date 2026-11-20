"""G0.2/C02: POST /core/v1/auth/ws-ticket/ — cap ticket WS ngan han.

Shape response CO TINH PHANG (flat {"ticket", "expiresIn"}), KHONG envelope,
vi widget fetchWsTicket doc raw r.json().ticket o top-level
(vninvestcharts-widget/src/widget/adapters/VNInvestClient.ts:813-826).
"""
from drf_spectacular.openapi import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import permissions, serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .permissions import is_machine_pat_request, require_pat_scopes_or_human_session
from .ws_ticket import (
    WS_TICKET_MACHINE_TTL_S,
    WS_TICKET_TTL_S,
    issue_ws_ticket,
)


class WsTicketResponseSerializer(serializers.Serializer):
    ticket = serializers.CharField()
    expiresIn = serializers.IntegerField()


class WsTicketView(APIView):
    """Cap ticket WS/SSE single-use 60s cho human session da xac thuc (machine PAT -> 403 via require_human_session)."""

    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        summary='Cap WS handshake ticket (G0.2/C02)',
        description='Tra flat {"ticket", "expiresIn"} — widget doc raw, khong envelope.',
        request=OpenApiTypes.OBJECT,
        responses={200: WsTicketResponseSerializer, 401: OpenApiTypes.OBJECT, 403: OpenApiTypes.OBJECT},
    )
    def post(self, request):
        # /core/v1/auth/ is middleware-exempt => request.tenant is absent.
        # Derive it from the *authenticated credential*, never from a client header.
        machine = is_machine_pat_request(request)
        if machine:
            credential = getattr(request, "auth", None)
            request.tenant = credential.service_account.tenant
        # Human path unchanged; machine PAT must carry the narrow ws:realtime scope.
        require_pat_scopes_or_human_session(request, "ws:realtime")
        tenant = getattr(request, "tenant", None)
        tenant_id = str(getattr(tenant, "public_id", "") or "") or None
        ttl = WS_TICKET_MACHINE_TTL_S if machine else WS_TICKET_TTL_S
        credential = getattr(request, "auth", None)
        sa_id = str(getattr(getattr(credential, "service_account", None), "public_id", "") or "") or None
        ticket, _ = issue_ws_ticket(
            request.user.id, tenant_id, ttl,
            machine=machine, service_account_id=sa_id if machine else None,
        )
        return Response({"ticket": ticket, "expiresIn": ttl}, status=status.HTTP_200_OK)

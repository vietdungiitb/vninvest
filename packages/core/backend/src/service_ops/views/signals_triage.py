"""
Signals Triage Views (W2.2, P2b) — Ack/Mute deliveries scoped to SOC operator user.

Scope quyết định (IMPLEMENTATION_PLAN_SOC_SIGNALS_COMMERCIAL_20260916.md):
  - Triage trên deliveries của `request.user` (SOC operator, IsAdminUser từ SOCBaseView).
  - Triage toàn cục mọi end-user là epic riêng — không nhồi PR này.
  - Tái dùng engine: delivery_service.transition guards + UserAlertDeliveryStateSerializer.

Endpoints:
  GET  /api/soc/signals/deliveries/ — deliveries của operator (filter state/symbol, unacked_only, page)
  POST /api/soc/signals/deliveries/<uuid:delivery_id>/seen/ — đánh dấu đã xem (auto khi expand row ở FE)
  POST /api/soc/signals/deliveries/<uuid:delivery_id>/ack/ — acknowledge (single; bulk = FE loop)
  POST /api/soc/signals/deliveries/mute/ — mute theo symbol/alert_family + lý do + thời hạn
"""
from datetime import timedelta

from django.utils import timezone
from drf_spectacular.openapi import OpenApiTypes
from drf_spectacular.utils import extend_schema, OpenApiParameter
from rest_framework import serializers, status
from rest_framework.response import Response

from ..envelope import envelope, paginated_envelope
from signal_intelligence import delivery_service
from signal_intelligence.models import UserAlertDelivery
from signal_intelligence.views import (
    AlertCenterMutePreferenceRequestSerializer,
    UserAlertDeliveryStateSerializer,
)

from .base import SOCBaseView


class SignalsDeliveryMuteRequestSerializer(AlertCenterMutePreferenceRequestSerializer):
    """Mute payload của SOC = AlertCenter payload + lý do audit (optional)."""

    reason = serializers.CharField(required=False, allow_blank=True, max_length=255)


def _serialize_delivery_with_context(row: UserAlertDelivery) -> dict:
    """Serializer tái dùng + context alert (additive) để FE render cột feed."""
    payload = UserAlertDeliveryStateSerializer(row).data
    alert = row.alert
    payload['symbol'] = alert.symbol
    payload['alert_type'] = alert.alert_type
    payload['severity'] = alert.severity
    payload['title'] = alert.title
    payload['triggered_at'] = alert.triggered_at.isoformat() if alert.triggered_at else None
    return payload


@extend_schema(
    summary='Danh sách deliveries của SOC operator',
    description='Deliveries của request.user, filter theo delivery_state/symbol, unacked_only, phân trang.',
    parameters=[
        OpenApiParameter('delivery_state', OpenApiTypes.STR, description='Lọc theo state: new/seen/acknowledged/muted/suppressed'),
        OpenApiParameter('symbol', OpenApiTypes.STR, description='Lọc theo mã CK'),
        OpenApiParameter('unacked_only', OpenApiTypes.BOOL, description='true = chỉ new + seen'),
    ],
    responses={200: UserAlertDeliveryStateSerializer(many=True), 401: OpenApiTypes.OBJECT, 403: OpenApiTypes.OBJECT},
)
class SignalsDeliveriesView(SOCBaseView):
    """GET /api/soc/signals/deliveries/"""

    def get(self, request):
        qs = UserAlertDelivery.objects.filter(user=request.user).select_related('alert').order_by('-delivered_at', '-pk')

        delivery_state = (request.query_params.get('delivery_state') or '').strip().lower()
        if delivery_state:
            valid_states = {choice for choice, _ in UserAlertDelivery.DeliveryStateChoices.choices}
            if delivery_state not in valid_states:
                return Response({
                    'detail': f"delivery_state '{delivery_state}' không hợp lệ.",
                    'code': 'INVALID_DELIVERY_STATE',
                }, status=status.HTTP_400_BAD_REQUEST)
            qs = qs.filter(delivery_state=delivery_state)

        symbol = (request.query_params.get('symbol') or '').strip().upper()
        if symbol:
            qs = qs.filter(alert__symbol__iexact=symbol)

        unacked_only = str(request.query_params.get('unacked_only') or '').strip().lower() in {'1', 'true', 'yes'}
        if unacked_only:
            qs = qs.filter(delivery_state__in=[
                UserAlertDelivery.DeliveryStateChoices.NEW,
                UserAlertDelivery.DeliveryStateChoices.SEEN,
            ])

        page = self.paginate_queryset(qs, request)
        if page is not None:
            data = [_serialize_delivery_with_context(row) for row in page]
            paged = self.get_paginated_response(data)
            # Bọc cả khối phân trang (count/next/previous/results) trong `data`.
            return paginated_envelope(dict(paged.data))
        return envelope([_serialize_delivery_with_context(row) for row in qs])


def _get_operator_delivery(request, delivery_id):
    try:
        return UserAlertDelivery.objects.select_related('alert').get(delivery_id=delivery_id, user=request.user)
    except UserAlertDelivery.DoesNotExist:
        return None


@extend_schema(
    summary='Đánh dấu seen cho delivery',
    description='FE gọi khi operator expand row. Tái dùng transition guard (new→seen).',
    responses={200: UserAlertDeliveryStateSerializer, 401: OpenApiTypes.OBJECT, 403: OpenApiTypes.OBJECT, 404: OpenApiTypes.OBJECT},
)
class SignalsDeliverySeenView(SOCBaseView):
    """POST /api/soc/signals/deliveries/<uuid:delivery_id>/seen/"""

    def post(self, request, delivery_id):
        row = _get_operator_delivery(request, delivery_id)
        if row is None:
            return Response({
                'detail': 'Không tìm thấy delivery của operator hiện tại.',
                'code': 'DELIVERY_NOT_FOUND',
            }, status=status.HTTP_404_NOT_FOUND)
        before = row.delivery_state
        row = delivery_service.mark_delivery_seen(user=request.user, alert=row.alert)
        payload = _serialize_delivery_with_context(row)
        payload['transitioned'] = before != row.delivery_state
        return envelope(payload)


@extend_schema(
    summary='Acknowledge delivery',
    description='Tái dùng delivery_service.acknowledge_delivery — guard new→ack, seen→ack; ack/muted/suppressed giữ nguyên.',
    responses={200: UserAlertDeliveryStateSerializer, 401: OpenApiTypes.OBJECT, 403: OpenApiTypes.OBJECT, 404: OpenApiTypes.OBJECT},
)
class SignalsDeliveryAckView(SOCBaseView):
    """POST /api/soc/signals/deliveries/<uuid:delivery_id>/ack/"""

    def post(self, request, delivery_id):
        row = _get_operator_delivery(request, delivery_id)
        if row is None:
            return Response({
                'detail': 'Không tìm thấy delivery của operator hiện tại.',
                'code': 'DELIVERY_NOT_FOUND',
            }, status=status.HTTP_404_NOT_FOUND)
        before = row.delivery_state
        if before == UserAlertDelivery.DeliveryStateChoices.ACKNOWLEDGED:
            # Idempotent: đã ack rồi thì no-op, không gọi service (tránh refresh acknowledged_at).
            payload = _serialize_delivery_with_context(row)
            payload['transitioned'] = False
            return envelope(payload)
        before_ack_at = row.acknowledged_at
        row = delivery_service.acknowledge_delivery(user=request.user, alert=row.alert)
        payload = _serialize_delivery_with_context(row)
        payload['transitioned'] = before != row.delivery_state or before_ack_at != row.acknowledged_at
        return envelope(payload)


@extend_schema(
    summary='Mute deliveries theo symbol/alert_family',
    description='Tái dùng upsert_user_alert_preference — lý do ghi vào preference metadata (audit actor = username).',
    request=SignalsDeliveryMuteRequestSerializer,
    responses={200: OpenApiTypes.OBJECT, 400: OpenApiTypes.OBJECT, 401: OpenApiTypes.OBJECT, 403: OpenApiTypes.OBJECT},
)
class SignalsDeliveryMuteView(SOCBaseView):
    """POST /api/soc/signals/deliveries/mute/"""

    def post(self, request):
        serializer = SignalsDeliveryMuteRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return self.error_response(
                request,
                code='INVALID_MUTE_PAYLOAD',
                detail=self._stringify_error_detail(serializer.errors),
                http_status=status.HTTP_400_BAD_REQUEST,
                field_errors=serializer.errors,
            )
        payload = serializer.validated_data
        mute_minutes = int(payload.get('mute_minutes') or 0)
        mute_until = timezone.now() + timedelta(minutes=mute_minutes) if mute_minutes > 0 else None
        reason = (payload.get('reason') or '').strip()
        preference = delivery_service.upsert_user_alert_preference(
            user=request.user,
            symbol=payload.get('symbol') or '',
            alert_family=payload.get('alert_family') or '',
            mute_until=mute_until,
            cooldown_seconds=int(payload.get('cooldown_seconds') or 0),
            metadata={'reason': reason, 'actor': getattr(request.user, 'username', 'api')} if reason else {'actor': getattr(request.user, 'username', 'api')},
        )
        return envelope({
            'symbol': preference.symbol,
            'alert_family': preference.alert_family,
            'mute_until': preference.mute_until.isoformat() if preference.mute_until else None,
            'cooldown_seconds': preference.cooldown_seconds,
        })

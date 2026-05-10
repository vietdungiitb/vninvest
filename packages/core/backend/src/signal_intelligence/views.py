from rest_framework import generics, permissions

from vninvest_core.pagination import AlertCursorPagination, OrderFlowCursorPagination

from .models import OrderFlowEvent, UnifiedAlert, WhaleAlertCanonical
from .serializers import OrderFlowEventSerializer, UnifiedAlertSerializer, WhaleAlertCanonicalSerializer


class UnifiedAlertListView(generics.ListAPIView):
    serializer_class = UnifiedAlertSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = AlertCursorPagination

    def get_queryset(self):
        qs = UnifiedAlert.objects.all().order_by('-triggered_at')
        symbol = self.request.query_params.get('symbol')
        alert_type = self.request.query_params.get('alert_type')
        severity = self.request.query_params.get('severity')
        session_date = self.request.query_params.get('session_date')
        if symbol:
            qs = qs.filter(symbol=symbol.upper())
        if alert_type:
            qs = qs.filter(alert_type=alert_type)
        if severity:
            qs = qs.filter(severity=severity)
        if session_date:
            qs = qs.filter(session_date=session_date)
        return qs


class WhaleFeedAggregateView(generics.ListAPIView):
    serializer_class = WhaleAlertCanonicalSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = AlertCursorPagination

    def get_queryset(self):
        qs = WhaleAlertCanonical.objects.select_related('alert').order_by('-executed_at')
        symbol = self.request.query_params.get('symbol')
        session_date = self.request.query_params.get('session_date')
        if symbol:
            qs = qs.filter(symbol=symbol.upper())
        if session_date:
            qs = qs.filter(session_date=session_date)
        return qs


class OrderFlowEventListView(generics.ListAPIView):
    """List OrderFlowEvent records for a symbol (newest first)."""
    serializer_class = OrderFlowEventSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = OrderFlowCursorPagination

    def get_queryset(self):
        symbol = self.kwargs.get('symbol', '').upper()
        qs = OrderFlowEvent.objects.filter(symbol=symbol).order_by('-triggered_at')
        session_date = self.request.query_params.get('session_date')
        signal_type = self.request.query_params.get('signal_type')
        if session_date:
            qs = qs.filter(session_date=session_date)
        if signal_type:
            qs = qs.filter(signal_type=signal_type)
        return qs

from rest_framework import serializers

from .models import OrderFlowEvent, UnifiedAlert, WhaleAlertCanonical


class UnifiedAlertSerializer(serializers.ModelSerializer):
    class Meta:
        model = UnifiedAlert
        fields = [
            'alert_id', 'alert_type', 'symbol', 'severity', 'title', 'body',
            'value', 'direction', 'session_date', 'triggered_at', 'source_ref', 'metadata',
        ]


class WhaleAlertCanonicalSerializer(serializers.ModelSerializer):
    alert_id = serializers.UUIDField(source='alert.alert_id', read_only=True)
    severity = serializers.CharField(source='alert.severity', read_only=True)

    class Meta:
        model = WhaleAlertCanonical
        fields = [
            'alert_id', 'symbol', 'session_date', 'side', 'price',
            'volume', 'matched_value', 'is_dark_flow', 'order_id', 'executed_at',
            'severity',
        ]


class OrderFlowEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderFlowEvent
        fields = [
            'event_id', 'symbol', 'session_date', 'signal_type', 'side',
            'strength', 'whale_intensity', 'cvd_at_signal', 'price_at_signal',
            'volume_at_signal', 'source_ref', 'triggered_at',
        ]

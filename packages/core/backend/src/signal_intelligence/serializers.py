from rest_framework import serializers

from .models import OrderFlowEvent, UnifiedAlert, WhaleAlertCanonical


class UnifiedAlertSerializer(serializers.ModelSerializer):
    lane = serializers.SerializerMethodField()
    alert_family = serializers.SerializerMethodField()
    summary = serializers.SerializerMethodField()

    class Meta:
        model = UnifiedAlert
        fields = [
            'alert_id', 'alert_type', 'alert_family', 'lane', 'symbol', 'severity', 'confidence', 'freshness_state',
            'title', 'body', 'value', 'direction', 'session_date', 'triggered_at',
            'source_ref', 'metadata', 'evidence', 'summary',
        ]

    def get_lane(self, obj):
        return 'main' if obj.alert_type in {
            UnifiedAlert.AlertTypeChoices.WHALE,
            UnifiedAlert.AlertTypeChoices.DARK_FLOW,
            UnifiedAlert.AlertTypeChoices.SIGNAL,
            UnifiedAlert.AlertTypeChoices.SYSTEM,
        } else 'ai'

    def get_alert_family(self, obj):
        if obj.alert_type == UnifiedAlert.AlertTypeChoices.SIGNAL:
            if str(obj.source_ref or '').startswith('market_anomaly:'):
                return 'price_shock'
            if isinstance(obj.evidence, dict) and obj.evidence.get('price_change_pct') is not None:
                return 'price_shock'
        if obj.alert_type == UnifiedAlert.AlertTypeChoices.SYSTEM:
            if str(obj.source_ref or '').startswith('stale_quote:'):
                return 'stale_quote'
            if str(obj.freshness_state or '').lower() == 'stale':
                return 'stale_quote'
        return obj.alert_type

    def get_summary(self, obj):
        body = str(obj.body or '').strip()
        if body:
            return body
        return str(obj.title or '').strip()


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

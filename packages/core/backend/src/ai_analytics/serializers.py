from rest_framework import serializers

from .models import AIUsageRecord, AIUsageSummary


class AIUsageRecordSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True, default='')

    class Meta:
        model = AIUsageRecord
        fields = [
            'id',
            'user',
            'username',
            'action',
            'provider',
            'model',
            'tokens_in',
            'tokens_out',
            'cost',
            'latency_ms',
            'status',
            'usage_unavailable',
            'pricing_available',
            'created_at',
        ]
        read_only_fields = fields


class AIUsageSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = AIUsageSummary
        fields = [
            'date',
            'action',
            'total_requests',
            'total_tokens_in',
            'total_tokens_out',
            'total_cost',
            'avg_latency_ms',
        ]

from rest_framework import serializers

from .models import AuditEvent


class AuditEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditEvent
        fields = [
            'event_id', 'actor_user_id', 'actor_label', 'tenant_id',
            'action', 'resource_type', 'resource_id', 'request_id',
            'ip_address', 'metadata', 'occurred_at',
        ]

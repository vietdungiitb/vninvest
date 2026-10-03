from rest_framework import serializers

from .models import AuditEvent
from tenant_lifecycle.models import TenantLifecycleEvent


class AuditEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditEvent
        fields = [
            'event_id', 'actor_user_id', 'actor_label', 'tenant_id',
            'action', 'resource_type', 'resource_id', 'request_id',
            'ip_address', 'metadata', 'occurred_at',
        ]


class TenantLifecycleEventSerializer(serializers.ModelSerializer):
    """Serializer for TenantLifecycleEvent - used by Partner Audit Logs API."""
    actor_username = serializers.SerializerMethodField()
    actor_user = serializers.SerializerMethodField()

    class Meta:
        model = TenantLifecycleEvent
        fields = [
            'id', 'event_type', 'actor_type', 'actor_username', 'actor_user',
            'ip_address', 'old_value', 'new_value', 'metadata', 'created_at',
        ]

    def get_actor_username(self, obj):
        if obj.actor_user:
            return obj.actor_user.username
        return obj.actor_type

    def get_actor_user(self, obj):
        if obj.actor_user:
            return obj.actor_user.id
        return None
from rest_framework import serializers

from .models import AgentRegistry


class AgentRegistrySerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentRegistry
        fields = [
            'id',
            'name',
            'agent_type',
            'provider',
            'model',
            'capabilities',
            'system_prompt',
            'is_active',
            'created_by',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']

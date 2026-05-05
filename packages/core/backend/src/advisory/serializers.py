"""
Advisory domain serializers.
"""
from rest_framework import serializers

from .models import AdvisoryRecord, SystemAISettings


class AdvisoryRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = AdvisoryRecord
        fields = [
            'advisory_id',
            'symbol',
            'session_date',
            'status',
            'ai_model',
            'advisory_text',
            'tokens_used',
            'error_message',
            'generated_at',
            'created_at',
        ]
        read_only_fields = fields


class SystemAISettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemAISettings
        fields = [
            'id',
            'name',
            'is_active',
            'ai_model',
            'max_tokens',
            'temperature',
            'prompt_template',
            'updated_at',
        ]
        read_only_fields = ['id', 'updated_at']

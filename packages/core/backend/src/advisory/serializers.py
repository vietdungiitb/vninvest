"""
Advisory domain serializers.
"""
from rest_framework import serializers

from .models import AdvisoryRecord, SystemAISettings, UserAICredential


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


class UserAICredentialSerializer(serializers.ModelSerializer):
    """
    Serializer cho UserAICredential.
    API Key chỉ được gửi từ client -> server, không bao giờ trả về trong response.
    """

    fallback_quota_remaining = serializers.IntegerField(read_only=True)
    fallback_quota_max = serializers.SerializerMethodField()
    fallback_quota_reset = serializers.DateField(source='fallback_quota_date', read_only=True)

    class Meta:
        model = UserAICredential
        fields = [
            'ai_provider',
            'ai_model',
            'encrypted_api_key',
            'custom_endpoint',
            'is_active',
            'fallback_quota_remaining',
            'fallback_quota_max',
            'fallback_quota_reset',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'fallback_quota_remaining',
            'fallback_quota_max',
            'fallback_quota_reset',
            'created_at',
            'updated_at',
        ]
        extra_kwargs = {
            'encrypted_api_key': {'write_only': True},
        }

    def get_fallback_quota_max(self, obj) -> int:
        from django.conf import settings as django_settings
        return getattr(django_settings, 'AI_FALLBACK_DAILY_QUOTA', 5)

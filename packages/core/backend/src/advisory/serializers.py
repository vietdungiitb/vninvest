"""
Advisory domain serializers.
"""
import re

from rest_framework import serializers

from .models import AdvisoryRecord, SystemAISettings, UserAICredential, AIAuditLog


# ── API Key Masking ────────────────────────────────────────────────────────

SENSITIVE_KEY_PATTERNS = re.compile(
    r'(sk-proj-|sk-ant-|AIza|ghp_|gho_|ghu_|sk-)[A-Za-z0-9_-]{20,}'
)

# Key names that are actually secrets — NOT budget fields like max_tokens / tokens_per_day
_SENSITIVE_KEY_TOKEN = re.compile(
    r'(?:^|_)(?:api_key|access_token|refresh_token|auth_token|bearer_token|id_token|token)(?:$|_)',
    re.IGNORECASE,
)


def _is_sensitive_key(key: str) -> bool:
    key_l = key.lower()
    if any(p in key_l for p in ('api_key', 'secret', 'credential')):
        return True
    # 'token' alone matches access_token etc., but not max_tokens / tokens_per_day
    if _SENSITIVE_KEY_TOKEN.search(key_l) and 'max_token' not in key_l and 'tokens_per' not in key_l:
        return True
    return False


def sanitize_sensitive_fields(data: dict) -> dict:
    """Mask sensitive fields in audit snapshots before persisting."""
    sanitized = {}
    for key, value in data.items():
        if _is_sensitive_key(key):
            sanitized[key] = _mask_sensitive_value(str(value))
        elif isinstance(value, dict):
            sanitized[key] = sanitize_sensitive_fields(value)
        else:
            if isinstance(value, str):
                sanitized[key] = SENSITIVE_KEY_PATTERNS.sub(
                    lambda m: m.group(0)[:8] + '••••••••' + m.group(0)[-4:],
                    value
                )
            else:
                sanitized[key] = value
    return sanitized


def _mask_sensitive_value(value: str) -> str:
    """sk-proj-1234567890abcdef1234 → sk-proj-••••••••1234"""
    if len(value) <= 8:
        return '••••••••'
    if len(value) > 12:
        return value[:8] + '••••••••' + value[-4:]
    return value[:4] + '••••••••'


class AdvisoryRecordSerializer(serializers.ModelSerializer):
    # T1.1: expose structured fields từ structured_output (fallback None cho record cũ)
    signal = serializers.SerializerMethodField()
    confidence_score = serializers.SerializerMethodField()
    summary = serializers.SerializerMethodField()
    rationale = serializers.SerializerMethodField()
    components = serializers.SerializerMethodField()

    class Meta:
        model = AdvisoryRecord
        fields = [
            'advisory_id',
            'symbol',
            'session_date',
            'status',
            'ai_model',
            'advisory_text',
            'structured_output',
            'signal',
            'confidence_score',
            'summary',
            'rationale',
            'components',
            'tokens_used',
            'error_message',
            'generated_at',
            'created_at',
        ]
        read_only_fields = fields

    def get_signal(self, obj):
        data = getattr(obj, 'structured_output', None) or {}
        return data.get('signal') if isinstance(data, dict) else None

    def get_confidence_score(self, obj):
        data = getattr(obj, 'structured_output', None) or {}
        return data.get('confidence_score') if isinstance(data, dict) else None

    def get_summary(self, obj):
        data = getattr(obj, 'structured_output', None) or {}
        return data.get('summary') if isinstance(data, dict) else None

    def get_rationale(self, obj):
        data = getattr(obj, 'structured_output', None) or {}
        return data.get('rationale') if isinstance(data, dict) else None

    def get_components(self, obj):
        data = getattr(obj, 'structured_output', None) or {}
        return data.get('components') if isinstance(data, dict) else None


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


class AIAuditLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AIAuditLog
        fields = [
            'id',
            'action',
            'actor',
            'reason',
            'before_json',
            'after_json',
            'diff_summary',
            'created_at',
        ]
        read_only_fields = fields

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if isinstance(data.get('before_json'), dict):
            data['before_json'] = sanitize_sensitive_fields(data['before_json'])
        if isinstance(data.get('after_json'), dict):
            data['after_json'] = sanitize_sensitive_fields(data['after_json'])
        return data

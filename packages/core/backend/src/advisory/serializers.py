"""
Advisory domain serializers.
"""
import re

from rest_framework import serializers

from .models import (
    AdvisoryRecord,
    AIAuditLog,
    AIDeployment,
    AITrace,
    SystemAISettings,
    UserAICredential,
)
from .signal_norm import (
    SIGNAL_UNKNOWN,
    normalize_confidence,
    normalize_risk_level,
    normalize_signal,
    signal_to_side,
)

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
        elif isinstance(value, list):
            # R0.7 — trước đây list rơi vào nhánh `else` nên chuỗi bên trong
            # list không bao giờ qua `SENSITIVE_KEY_PATTERNS`. Một list các dict
            # chứa `api_key` là đường lọt secret rõ ràng.
            sanitized[key] = _sanitize_list(value)
        else:
            if isinstance(value, str):
                sanitized[key] = SENSITIVE_KEY_PATTERNS.sub(
                    lambda m: m.group(0)[:8] + '********' + m.group(0)[-4:],
                    value
                )
            else:
                sanitized[key] = value
    return sanitized


def _sanitize_list(items: list) -> list:
    """Đệ quy xử lý từng phần tử của list (dict lồng, list lồng, chuỗi thô)."""
    sanitized = []
    for item in items:
        if isinstance(item, dict):
            sanitized.append(sanitize_sensitive_fields(item))
        elif isinstance(item, list):
            sanitized.append(_sanitize_list(item))
        elif isinstance(item, str):
            sanitized.append(
                SENSITIVE_KEY_PATTERNS.sub(
                    lambda m: m.group(0)[:8] + '********' + m.group(0)[-4:],
                    item,
                )
            )
        else:
            sanitized.append(item)
    return sanitized



def _mask_sensitive_value(value: str) -> str:
    """sk-proj-1234567890abcdef1234 → sk-proj-••••••••1234"""
    if len(value) <= 8:
        return '••••••••'
    if len(value) > 12:
        return value[:8] + '••••••••' + value[-4:]
    return value[:4] + '••••••••'


class AdvisoryRecordSerializer(serializers.ModelSerializer):
    """Contract chuẩn cho FE.

    R0.4 — trước đây `get_signal`/`get_confidence_score` đọc thẳng
    `structured_output.signal` trong khi orchestrator không hề ghi key đó
    (xem `tasks.py:_build_structured_output` và `orchestrator.py`), nên hai
    field này trả `None` vĩnh viễn và FE suy ra `side=UNKNOWN` cho mọi mã.
    Giờ đọc qua `signal_norm` và fallback sang `recommendation`.
    """

    signal = serializers.SerializerMethodField()
    confidence_score = serializers.SerializerMethodField()
    summary = serializers.SerializerMethodField()
    rationale = serializers.SerializerMethodField()
    components = serializers.SerializerMethodField()
    side = serializers.SerializerMethodField()
    error_code = serializers.SerializerMethodField()
    user_message = serializers.SerializerMethodField()
    recommendation = serializers.SerializerMethodField()
    risk_level = serializers.SerializerMethodField()
    target_price = serializers.SerializerMethodField()
    feature_attribution = serializers.SerializerMethodField()
    input_snapshot = serializers.SerializerMethodField()
    schema_version = serializers.SerializerMethodField()
    ai_provider = serializers.SerializerMethodField()
    matched_value = serializers.SerializerMethodField()
    is_discovery = serializers.SerializerMethodField()
    whale_intensity = serializers.SerializerMethodField()

    class Meta:
        model = AdvisoryRecord
        fields = [
            'advisory_id',
            'symbol',
            'session_date',
            'status',
            'ai_model',
            'ai_provider',
            'advisory_text',
            'structured_output',
            'signal',
            'side',
            'confidence_score',
            'summary',
            'rationale',
            'recommendation',
            'risk_level',
            'target_price',
            'components',
            'feature_attribution',
            'input_snapshot',
            'schema_version',
            'matched_value',
            'is_discovery',
            'whale_intensity',
            'tokens_used',
            'error_message',
            'error_code',
            'user_message',
            'generated_at',
            'created_at',
        ]
        read_only_fields = fields

    # -- helpers -------------------------------------------------------------

    @staticmethod
    def _structured(obj):
        data = getattr(obj, 'structured_output', None) or {}
        return data if isinstance(data, dict) else {}

    @staticmethod
    def _attribution(structured, keys):
        attribution = structured.get('feature_attribution')
        if isinstance(attribution, dict):
            return {key: attribution.get(key) for key in keys}
        return {}

    @staticmethod
    def _resolve_session(obj):
        """Tìm `AdvisorySession` ứng với record để đọc `components`.

        Trả `None` nếu record không có `user` (record legacy) — khi đó
        `get_components` fallback sang `structured_output['components']`.
        """
        user_id = getattr(obj, 'user_id', None)
        if not user_id:
            return None
        try:
            from .models import AdvisorySession
            return (
                AdvisorySession.objects
                .filter(
                    user_id=user_id,
                    symbol=obj.symbol,
                    session_date=obj.session_date,
                )
                .order_by('-updated_at')
                .first()
            )
        except Exception:  # pragma: no cover - defensive, never break serialization
            return None

    # -- fields --------------------------------------------------------------

    def get_signal(self, obj):
        structured = self._structured(obj)
        signal = normalize_signal(structured.get('signal'))
        if signal == SIGNAL_UNKNOWN:
            signal = normalize_signal(structured.get('recommendation'))
        return signal

    def get_side(self, obj):
        return signal_to_side(self.get_signal(obj))

    def get_confidence_score(self, obj):
        return normalize_confidence(self._structured(obj).get('confidence_score'))

    def get_summary(self, obj):
        value = self._structured(obj).get('summary')
        if value:
            return value
        return getattr(obj, 'advisory_text', '') or ''

    def get_rationale(self, obj):
        return self._structured(obj).get('rationale') or ''

    def get_recommendation(self, obj):
        return self._structured(obj).get('recommendation') or ''

    def get_risk_level(self, obj):
        return normalize_risk_level(self._structured(obj).get('risk_level'))

    def get_target_price(self, obj):
        return self._structured(obj).get('target_price')

    def get_feature_attribution(self, obj):
        structured = self._structured(obj)
        raw = structured.get('feature_attribution')
        if isinstance(raw, dict) and raw:
            return raw
        return self._attribution(structured, ('whale', 'dark_flow', 'technical', 'sentiment'))

    def get_input_snapshot(self, obj):
        value = self._structured(obj).get('input_snapshot')
        return value if isinstance(value, dict) else {}

    def get_schema_version(self, obj):
        return self._structured(obj).get('schema_version')

    def get_ai_provider(self, obj):
        snapshot = getattr(obj, 'context_snapshot', None) or {}
        if isinstance(snapshot, dict):
            context = snapshot.get('effective_ai_context')
            if isinstance(context, dict) and context.get('ai_provider'):
                return context['ai_provider']
        return snapshot.get('ai_provider') if isinstance(snapshot, dict) else None

    def get_matched_value(self, obj):
        return self._structured(obj).get('matched_value')

    def get_is_discovery(self, obj):
        return bool(self._structured(obj).get('is_discovery') or False)

    def get_whale_intensity(self, obj):
        value = self._structured(obj).get('whale_intensity')
        return value if isinstance(value, (int, float)) else None

    def get_error_code(self, obj):
        error = self._structured(obj).get('error')
        if isinstance(error, dict):
            return error.get('error_code')
        return None

    def get_user_message(self, obj):
        error = self._structured(obj).get('error')
        if isinstance(error, dict):
            return error.get('user_message')
        return None

    def get_components(self, obj):
        """R0.9 — ưu tiên `AdvisoryComponent` đã materialize, fallback structured.

        N2 — chặn rò rỉ dữ liệu cũ. `AdvisorySession` KHÔNG có FK tới
        `AdvisoryRecord`; nó được định danh bằng khoá
        `(user, symbol, session_date)` (unique). Hệ quả: khi một record MỚI
        thất bại (ví dụ provider trả 429), session của lần chạy thành công
        trước đó vẫn còn nguyên và `_resolve_session` trả về nó. Nếu trả thẳng,
        UI sẽ hiển thị phân tích của phiên cũ — gồm cả khuyến nghị mua/bán —
        ngay sau khi người dùng bấm "làm mới" và bị báo lỗi. Với sản phẩm tài
        chính thì đây là rủi ro cao hơn cả lỗi hiển thị.

        Vì vậy chỉ đọc component materialize khi record này thực sự có kết quả.
        `structured_output['components']` thuộc chính record nên vẫn an toàn.
        """
        structured_components = self._structured(obj).get('components')
        has_result = normalize_signal(self._structured(obj).get('signal')) != SIGNAL_UNKNOWN
        if not has_result:
            if isinstance(structured_components, list):
                return structured_components
            return []
        session = self._resolve_session(obj)
        if session is not None:
            rows = list(
                session.components.all().order_by('order', 'component_type').values(
                    'component_type', 'content', 'metadata', 'order'
                )
            )
            if rows:
                return rows
        if isinstance(structured_components, list):
            return structured_components
        return []



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


class AIDeploymentSerializer(serializers.ModelSerializer):
    """R2.1: deployment (credential_ref không bao giờ trả secret)."""

    class Meta:
        model = AIDeployment
        fields = [
            'id',
            'name',
            'owner_scope',
            'provider',
            'model',
            'weight',
            'enabled',
            'health_state',
            'last_health_at',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at', 'last_health_at']


class AITraceSerializer(serializers.ModelSerializer):
    """R3.2 — trả metadata của 1 bước trace cho trang "Traces".

    **Không** có `prompt`/`response` thô (AC3): model vốn chỉ lưu SHA-256 (PIPL
    13/2023). `routing_decision` là JSONField — đi qua `sanitize_sensitive_fields`
    để không lỡ tay rò khóa/token nếu sau này ai đó nhét vào đó.
    """

    class Meta:
        model = AITrace
        fields = [
            'id',
            'trace_id',
            'advisory_id',
            'symbol',
            'session_date',
            'step',
            'provider',
            'model',
            'prompt_hash',
            'response_hash',
            'tokens_in',
            'tokens_out',
            'latency_ms',
            'status',
            'error_code',
            'routing_decision',
            'created_at',
        ]
        read_only_fields = fields

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if isinstance(data.get('routing_decision'), dict):
            data['routing_decision'] = sanitize_sensitive_fields(
                data['routing_decision'])
        return data


class AIAuditLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AIAuditLog
        fields = [
            'id',
            'action',
            'actor',
            'user',
            'tenant',
            'legacy_unattributed',
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

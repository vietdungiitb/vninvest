from rest_framework import serializers

from .models import CorePATCredential, CoreServiceAccount, CoreTenant, TenantMember, TenantInvite


POLICY_TO_SCOPE_CODES = {
    'pol_market_read': ['market:read'],
    'pol_signals_read': ['signals:read'],
    'pol_ai_invoke': ['ai:invoke'],
    'pol_manage_pats': ['manage_pats'],
    'pol_manage_service_accounts': ['manage_service_accounts'],
    'pol_manage_tenant': ['manage_tenant'],
}
SCOPE_CODE_TO_POLICY = {
    'market:read': 'pol_market_read',
    'signals:read': 'pol_signals_read',
    'ai:invoke': 'pol_ai_invoke',
    'manage_pats': 'pol_manage_pats',
    'manage_service_accounts': 'pol_manage_service_accounts',
    'manage_tenant': 'pol_manage_tenant',
}


def _normalize_identifier_list(values) -> list[str]:
    normalized: list[str] = []
    seen: set[str] = set()
    for raw_value in values or []:
        value = str(raw_value or '').strip()
        if not value or value in seen:
            continue
        seen.add(value)
        normalized.append(value)
    return normalized


def _policy_ids_to_scope_codes(policy_ids) -> list[str]:
    scope_codes: list[str] = []
    seen: set[str] = set()
    for policy_id in _normalize_identifier_list(policy_ids):
        mapped_scopes = POLICY_TO_SCOPE_CODES.get(policy_id, [policy_id])
        for scope_code in mapped_scopes:
            if scope_code in seen:
                continue
            seen.add(scope_code)
            scope_codes.append(scope_code)
    return scope_codes


def _scope_codes_to_policy_ids(scope_codes) -> list[str]:
    policy_ids: list[str] = []
    seen: set[str] = set()
    for scope_code in _normalize_identifier_list(scope_codes):
        policy_id = SCOPE_CODE_TO_POLICY.get(scope_code, scope_code)
        if policy_id in seen:
            continue
        seen.add(policy_id)
        policy_ids.append(policy_id)
    return policy_ids


class CoreTenantSerializer(serializers.ModelSerializer):
    tenant_id = serializers.CharField(source='public_id', read_only=True)

    class Meta:
        model = CoreTenant
        fields = [
            'tenant_id', 'tenant_code', 'display_name', 'plan', 'status',
            'features', 'trial_ends_at', 'activated_at', 'suspended_at',
            'billing_period_start', 'billing_period_end', 'created_at', 'updated_at',
        ]
        read_only_fields = ['tenant_id', 'created_at', 'updated_at']


class CoreServiceAccountSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='public_id', read_only=True)
    service_account_id = serializers.CharField(source='public_id', read_only=True)
    tenant_id = serializers.CharField(source='tenant.public_id', read_only=True)
    policy_ids = serializers.ListField(child=serializers.CharField(), required=False)
    environment = serializers.CharField(required=False, allow_blank=False, default='prod')
    audit_reason = serializers.CharField(required=False, allow_blank=True, write_only=True)

    class Meta:
        model = CoreServiceAccount
        fields = [
            'id', 'service_account_id', 'tenant_id', 'name', 'status',
            'environment', 'policy_ids', 'scopes', 'audit_reason', 'last_rotated_at', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'service_account_id', 'tenant_id', 'created_at', 'updated_at']

    def validate(self, attrs):
        attrs = super().validate(attrs)
        policy_ids = attrs.get('policy_ids')
        scopes = attrs.get('scopes')
        if policy_ids is not None and scopes is None:
            attrs['policy_ids'] = _normalize_identifier_list(policy_ids)
            attrs['scopes'] = _policy_ids_to_scope_codes(policy_ids)
        if scopes is not None and policy_ids is None:
            attrs['scopes'] = _normalize_identifier_list(scopes)
            attrs['policy_ids'] = _scope_codes_to_policy_ids(scopes)
        if policy_ids is not None and scopes is not None:
            attrs['policy_ids'] = _normalize_identifier_list(policy_ids)
            attrs['scopes'] = _normalize_identifier_list(scopes)
        return attrs

    def _merge_metadata(self, instance, validated_data):
        metadata = dict(getattr(instance, 'metadata', {}) if instance is not None else {})
        metadata.update(dict(validated_data.pop('metadata', {}) or {}))

        environment = validated_data.pop('environment', None)
        if environment:
            metadata['environment'] = environment

        audit_reason = str(validated_data.pop('audit_reason', '') or '').strip()
        if audit_reason:
            metadata['audit_reason'] = audit_reason

        policy_ids = validated_data.pop('policy_ids', None)
        if policy_ids is not None and 'scopes' not in validated_data:
            validated_data['scopes'] = _policy_ids_to_scope_codes(policy_ids)

        metadata['policy_ids'] = list(policy_ids) if policy_ids is not None else _scope_codes_to_policy_ids(validated_data.get('scopes') or [])
        validated_data['metadata'] = metadata
        return validated_data

    def create(self, validated_data):
        validated_data = self._merge_metadata(None, validated_data)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data = self._merge_metadata(instance, validated_data)
        return super().update(instance, validated_data)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        metadata = dict(instance.metadata or {})
        data['id'] = data['service_account_id']
        data['environment'] = str(metadata.get('environment') or 'prod')
        data['policy_ids'] = _normalize_identifier_list(
            metadata.get('policy_ids') or _scope_codes_to_policy_ids(data.get('scopes') or [])
        )
        return data


class CorePATCredentialSerializer(serializers.ModelSerializer):
    object = serializers.SerializerMethodField()
    id = serializers.CharField(source='public_id', read_only=True)
    pat_id = serializers.CharField(source='public_id', read_only=True)
    service_account_id = serializers.CharField(source='service_account.public_id', read_only=True)
    tenant_id = serializers.CharField(source='service_account.tenant.public_id', read_only=True)
    token_prefix = serializers.CharField(read_only=True)
    scope_codes = serializers.ListField(source='scopes', child=serializers.CharField(), read_only=True)
    display_name = serializers.CharField(source='label', read_only=True)
    status = serializers.SerializerMethodField()

    class Meta:
        model = CorePATCredential
        fields = [
            'object', 'id', 'pat_id', 'service_account_id', 'tenant_id',
            'display_name', 'label', 'token_prefix', 'scope_codes', 'scopes', 'status', 'revoked',
            'expires_at', 'last_used_at', 'revoked_at', 'audit_reason',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'object', 'id', 'pat_id', 'service_account_id', 'tenant_id', 'display_name', 'token_prefix',
            'revoked', 'revoked_at', 'created_at', 'updated_at',
        ]

    def get_object(self, obj) -> str:
        return 'pat_credential'

    def get_status(self, obj) -> str:
        return obj.effective_status


class CorePATIssueResponseSerializer(serializers.Serializer):
    object = serializers.CharField()
    id = serializers.CharField()
    pat_id = serializers.CharField()
    service_account_id = serializers.CharField()
    tenant_id = serializers.CharField()
    display_name = serializers.CharField()
    label = serializers.CharField()
    token_prefix = serializers.CharField()
    secret = serializers.CharField(help_text='Full token — shown ONE TIME only.')
    token = serializers.CharField(help_text='Alias of secret for compatibility.')
    access = serializers.CharField(help_text='Alias of secret for compatibility.')
    scope_codes = serializers.ListField(child=serializers.CharField())
    scopes = serializers.ListField(child=serializers.CharField())
    status = serializers.CharField()
    expires_at = serializers.DateTimeField(allow_null=True)


class PartnerPATIssueSerializer(serializers.Serializer):
    service_account_id = serializers.CharField(required=True)
    scope_codes = serializers.ListField(child=serializers.CharField(), required=False, allow_empty=True)
    scopes = serializers.ListField(child=serializers.CharField(), required=False, allow_empty=True)
    expires_at = serializers.DateTimeField(required=False, allow_null=True)
    display_name = serializers.CharField(required=False, allow_blank=True)
    label = serializers.CharField(required=False, allow_blank=True)
    audit_reason = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        scope_codes = attrs.get('scope_codes')
        scopes = attrs.get('scopes')
        if scope_codes is None:
            attrs['scope_codes'] = list(scopes or [])
        if scopes is None:
            attrs['scopes'] = list(attrs['scope_codes'])
        return attrs


class PartnerPATRotateSerializer(serializers.Serializer):
    grace_period_seconds = serializers.IntegerField(required=False, min_value=0, default=3600)
    scope_codes = serializers.ListField(child=serializers.CharField(), required=False, allow_empty=True)
    scopes = serializers.ListField(child=serializers.CharField(), required=False, allow_empty=True)
    expires_at = serializers.DateTimeField(required=False, allow_null=True)
    display_name = serializers.CharField(required=False, allow_blank=True)
    label = serializers.CharField(required=False, allow_blank=True)
    audit_reason = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        scope_codes = attrs.get('scope_codes')
        scopes = attrs.get('scopes')
        if scope_codes is None and scopes is not None:
            attrs['scope_codes'] = list(scopes)
        if scopes is None and scope_codes is not None:
            attrs['scopes'] = list(scope_codes)
        return attrs


class PartnerPATRevokeSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True)


class TenantMemberSerializer(serializers.ModelSerializer):
    member_id = serializers.CharField(source='public_id', read_only=True)
    tenant_id = serializers.CharField(source='tenant.public_id', read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)
    email = serializers.CharField(source='user.email', read_only=True)

    class Meta:
        model = TenantMember
        fields = [
            'member_id', 'tenant_id', 'username', 'email', 'role',
            'invited_by', 'joined_at', 'updated_at',
        ]
        read_only_fields = ['member_id', 'tenant_id', 'username', 'email', 'joined_at', 'updated_at']


class TenantInviteSerializer(serializers.ModelSerializer):
    invite_id = serializers.CharField(source='public_id', read_only=True)
    tenant_id = serializers.CharField(source='tenant.public_id', read_only=True)
    inviter_username = serializers.CharField(source='inviter.username', read_only=True)
    is_expired = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = TenantInvite
        fields = [
            'invite_id', 'tenant_id', 'invited_email', 'inviter_username',
            'token', 'role', 'status', 'is_expired', 'expires_at',
            'accepted_at', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'invite_id', 'tenant_id', 'token', 'is_expired',
            'accepted_at', 'created_at', 'updated_at',
        ]

    def get_is_expired(self, obj) -> bool:
        return obj.is_expired


class TenantInviteCreateSerializer(serializers.Serializer):
    """Input schema for creating a tenant invite."""
    invited_email = serializers.EmailField(max_length=254)
    role = serializers.ChoiceField(
        choices=TenantMember.RoleChoices.choices,
        default=TenantMember.RoleChoices.VIEWER,
    )


# ---------------------------------------------------------------------------
# SaaS Native User Registration & Anti-Spam Serializer (Slice 2)
# ---------------------------------------------------------------------------
import re
import requests
import logging
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password

User = get_user_model()
logger = logging.getLogger(__name__)

class SaaSRegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=30)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    password_confirm = serializers.CharField(write_only=True)
    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    
    # Spam Shield inputs
    website = serializers.CharField(required=False, allow_blank=True)  # Honeypot field
    turnstile_token = serializers.CharField(required=False, allow_blank=True)

    def validate_username(self, value):
        val_clean = str(value or '').strip()
        if not re.match(r'^[a-zA-Z0-9_]{3,30}$', val_clean):
            raise serializers.ValidationError("Tên đăng nhập chỉ chứa ký tự chữ, số và dấu gạch dưới (3-30 ký tự).")
        if User.objects.filter(username__iexact=val_clean).exists():
            raise serializers.ValidationError("Tên đăng nhập này đã tồn tại.")
        return val_clean.lower()

    def validate_email(self, value):
        email_clean = str(value or '').lower().strip()
        if User.objects.filter(email__iexact=email_clean).exists():
            raise serializers.ValidationError("Địa chỉ email này đã được đăng ký.")
        
        # Tầng 2: Disposable Domain Block (O(1) Hash Set Lookup)
        domain = email_clean.split('@')[-1]
        disposable_set = getattr(settings, 'BLOCKED_DISPOSABLE_DOMAINS', set())
        if domain in disposable_set:
            logger.warning(f"[SPAM_SHIELD] Rejected disposable email domain: {domain}")
            raise serializers.ValidationError("Không cho phép đăng ký bằng địa chỉ email tạm thời.")
        return email_clean

    def validate(self, attrs):
        # Kiểm tra tính trùng khớp mật khẩu
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({"password_confirm": "Mật khẩu xác nhận không khớp."})
        
        # Enforce Django password strength validation
        validate_password(attrs['password'])

        # Tầng 1: Bẫy Honeypot Check
        if attrs.get('website'):
            logger.warning("[SPAM_SHIELD] Honeypot field 'website' was filled. Potential bot registration dropped.")
            # Trả về lỗi validation giả để bot không nhận biết được cơ chế phòng thủ
            raise serializers.ValidationError({"website": "Lỗi kết nối máy chủ. Vui lòng thử lại sau."})

        # Tầng 3: Cloudflare Turnstile token validation
        token = attrs.get('turnstile_token')
        client_ip = self.context.get('client_ip', '0.0.0.0')
        self._verify_turnstile(token, client_ip)

        return attrs

    def _verify_turnstile(self, token, client_ip):
        secret_key = getattr(settings, 'TURNSTILE_SECRET_KEY', '').strip()
        if not secret_key:
            if settings.DEBUG:
                logger.warning("[SPAM_SHIELD] Missing TURNSTILE_SECRET_KEY in DEBUG mode. Skipping verification.")
                return
            else:
                logger.critical("[SPAM_SHIELD] ImproperlyConfigured: TURNSTILE_SECRET_KEY is empty in production.")
                raise RuntimeError("Hệ thống Mail và Bảo mật chưa được cấu hình đầy đủ.")

        if not token:
            raise serializers.ValidationError({"turnstile_token": "Yêu cầu mã xác thực Turnstile."})

        verify_url = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
        try:
            res = requests.post(
                verify_url,
                data={'secret': secret_key, 'response': token, 'remoteip': client_ip},
                timeout=3.0  # 3000ms SLA budget
            )
            res.raise_for_status()
            result_json = res.json()
            if not result_json.get('success'):
                logger.warning(f"[SPAM_SHIELD] Turnstile verification failed. Error-codes: {result_json.get('error-codes')}")
                raise serializers.ValidationError({"turnstile_token": "Xác thực Turnstile không hợp lệ hoặc hết hạn."})
        except requests.RequestException as e:
            logger.error(f"[SPAM_SHIELD] Turnstile validation timeout/failure: {str(e)}")
            raise serializers.ValidationError({"turnstile_token": "Không thể kết nối máy chủ xác thực Turnstile. Vui lòng thử lại."})


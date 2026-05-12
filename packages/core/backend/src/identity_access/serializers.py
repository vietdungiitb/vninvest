from rest_framework import serializers

from .models import CorePATCredential, CoreServiceAccount, CoreTenant, TenantMember, TenantInvite


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
    service_account_id = serializers.CharField(source='public_id', read_only=True)
    tenant_id = serializers.CharField(source='tenant.public_id', read_only=True)

    class Meta:
        model = CoreServiceAccount
        fields = [
            'service_account_id', 'tenant_id', 'name', 'status',
            'scopes', 'last_rotated_at', 'created_at', 'updated_at',
        ]
        read_only_fields = ['service_account_id', 'tenant_id', 'created_at', 'updated_at']


class CorePATCredentialSerializer(serializers.ModelSerializer):
    pat_id = serializers.CharField(source='public_id', read_only=True)
    service_account_id = serializers.CharField(source='service_account.public_id', read_only=True)
    tenant_id = serializers.CharField(source='service_account.tenant.public_id', read_only=True)
    token_prefix = serializers.CharField(read_only=True)

    class Meta:
        model = CorePATCredential
        fields = [
            'pat_id', 'service_account_id', 'tenant_id', 'label',
            'token_prefix', 'scopes', 'status', 'revoked',
            'expires_at', 'last_used_at', 'revoked_at', 'audit_reason',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'pat_id', 'service_account_id', 'tenant_id', 'token_prefix',
            'revoked', 'revoked_at', 'created_at', 'updated_at',
        ]


class CorePATIssueResponseSerializer(serializers.Serializer):
    pat_id = serializers.CharField()
    service_account_id = serializers.CharField()
    tenant_id = serializers.CharField()
    label = serializers.CharField()
    token_prefix = serializers.CharField()
    token = serializers.CharField(help_text='Full token — shown ONE TIME only.')
    scopes = serializers.ListField(child=serializers.CharField())
    expires_at = serializers.DateTimeField(allow_null=True)


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

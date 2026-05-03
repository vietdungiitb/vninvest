from rest_framework import serializers

from .models import CorePATCredential, CoreServiceAccount, CoreTenant


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

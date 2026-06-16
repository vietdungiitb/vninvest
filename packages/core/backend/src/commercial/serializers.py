from rest_framework import serializers

from .models import Invoice, QuotaRecord, Subscription, QuotaHistory


class SubscriptionSerializer(serializers.ModelSerializer):
    tenant_id = serializers.CharField(source='tenant.public_id', read_only=True)

    class Meta:
        model = Subscription
        fields = ['tenant_id', 'plan', 'status', 'current_period_start', 'current_period_end', 'cancel_at_period_end', 'created_at', 'updated_at']


class QuotaRecordSerializer(serializers.ModelSerializer):
    tenant_id = serializers.CharField(source='tenant.public_id', read_only=True)

    class Meta:
        model = QuotaRecord
        fields = [
            'tenant_id', 'period_start', 'period_end',
            'api_calls_used', 'api_calls_limit',
            'symbols_used', 'symbols_limit',
            'users_used', 'users_limit',
            'storage_mb_used', 'storage_mb_limit',
            'updated_at',
        ]


class QuotaHistorySerializer(serializers.ModelSerializer):
    tenant_id = serializers.CharField(source='tenant.public_id', read_only=True)

    class Meta:
        model = QuotaHistory
        fields = [
            'tenant_id', 'date', 'meter_code', 'meter_name', 'unit',
            'consumed_amount', 'entitled_amount', 'remaining_amount',
            'risk_state', 'hard_stop', 'created_at',
        ]


class InvoiceSerializer(serializers.ModelSerializer):
    tenant_id = serializers.CharField(source='tenant.public_id', read_only=True)

    class Meta:
        model = Invoice
        fields = ['tenant_id', 'invoice_number', 'status', 'amount_due', 'currency', 'period_start', 'period_end', 'due_date', 'paid_at', 'created_at']

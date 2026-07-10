from rest_framework import serializers

from .models import Invoice, QuotaRecord, Subscription, QuotaHistory


class SubscriptionSerializer(serializers.ModelSerializer):
    tenant_id = serializers.CharField(source='tenant.public_id', read_only=True)
    # Backend owns contract: expose alias fields frontend expects (H8 Option B).
    plan_name = serializers.CharField(source='plan', read_only=True)
    next_billing_date = serializers.DateField(source='current_period_end', read_only=True)

    class Meta:
        model = Subscription
        fields = ['tenant_id', 'plan', 'plan_name', 'status', 'current_period_start',
                  'current_period_end', 'next_billing_date', 'cancel_at_period_end', 'created_at', 'updated_at']


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


class PartnerUsageMeterSerializer(serializers.ModelSerializer):
    """Snapshot latest quota per meter — contract khớp frontend Meter/Quota interface (C4)."""
    display_name = serializers.CharField(source='meter_name', read_only=True)

    class Meta:
        model = QuotaHistory
        fields = [
            'meter_code', 'display_name', 'unit', 'date',
            'consumed_amount', 'entitled_amount', 'remaining_amount',
            'risk_state', 'hard_stop',
        ]


class InvoiceSerializer(serializers.ModelSerializer):
    tenant_id = serializers.CharField(source='tenant.public_id', read_only=True)
    # Backend owns contract: expose alias fields frontend expects (H8 Option B).
    invoice_id = serializers.CharField(source='invoice_number', read_only=True)
    amount = serializers.DecimalField(source='amount_due', max_digits=18, decimal_places=2, read_only=True)

    class Meta:
        model = Invoice
        fields = ['tenant_id', 'invoice_number', 'invoice_id', 'status', 'amount_due', 'amount',
                  'currency', 'period_start', 'period_end', 'due_date', 'paid_at', 'created_at']

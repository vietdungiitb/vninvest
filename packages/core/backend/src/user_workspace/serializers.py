"""
User Workspace domain serializers.
"""
from rest_framework import serializers
from .models import Portfolio, Transaction, Watchlist, WatchlistItem, SubAccount, DNSECredential, ScreenerRule


class WatchlistItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = WatchlistItem
        fields = ['id', 'symbol', 'note', 'added_at']
        read_only_fields = ['id', 'added_at']


class WatchlistSerializer(serializers.ModelSerializer):
    class Meta:
        model = Watchlist
        fields = ['id', 'name', 'description', 'is_default', 'created_at']
        read_only_fields = ['id', 'created_at']


class TransactionSerializer(serializers.ModelSerializer):
    notes = serializers.CharField(source='note', required=False, allow_blank=True)
    transaction_type_display = serializers.CharField(source='get_transaction_type_display', read_only=True)
    total_value = serializers.SerializerMethodField()

    class Meta:
        model = Transaction
        fields = [
            'id', 'symbol', 'transaction_type', 'transaction_type_display', 'date',
            'price', 'quantity', 'fee', 'tax', 'external_id', 'note', 'notes', 'total_value', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']

    def get_total_value(self, obj):
        return obj.price * obj.quantity


class PortfolioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Portfolio
        fields = ['id', 'name', 'description', 'is_default', 'created_at']
        read_only_fields = ['id', 'created_at']


class SubAccountSerializer(serializers.ModelSerializer):
    portfolio_name = serializers.CharField(source='portfolio.name', read_only=True)
    type_display = serializers.CharField(source='get_type_display', read_only=True)

    class Meta:
        model = SubAccount
        fields = [
            'id', 'broker', 'account_number', 'name', 'display_name',
            'type', 'type_display', 'portfolio', 'portfolio_name', 'is_active', 
            'external_id', 'broker_source', 'sync_status', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class DNSECredentialSerializer(serializers.ModelSerializer):
    """
    Read-only serializer — không expose client_id/secret ciphertext.
    Write path qua views_dnse.dnse_config_api (set_client_id/set_client_secret).
    """
    is_configured = serializers.SerializerMethodField()

    class Meta:
        model = DNSECredential
        fields = ['id', 'is_configured', 'is_active', 'last_sync_at', 'created_at', 'updated_at']
        read_only_fields = ['id', 'is_configured', 'last_sync_at', 'created_at', 'updated_at']

    def get_is_configured(self, obj) -> bool:
        return obj.has_credentials()


class ScreenerRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = ScreenerRule
        fields = ['id', 'name', 'rules_json', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


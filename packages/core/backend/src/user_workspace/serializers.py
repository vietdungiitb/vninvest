"""
User Workspace domain serializers.
"""
from decimal import Decimal

from rest_framework import serializers
from .models import Portfolio, Transaction, Watchlist, WatchlistItem, SubAccount, DNSECredential, ScreenerRule


class WatchlistItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = WatchlistItem
        fields = ['id', 'symbol', 'note', 'added_at']
        read_only_fields = ['id', 'added_at']


class WatchlistSerializer(serializers.ModelSerializer):
    items = WatchlistItemSerializer(many=True, read_only=True)

    class Meta:
        model = Watchlist
        fields = ['id', 'name', 'description', 'is_default', 'items', 'created_at']
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
    """
    `opening_balance` was on the model since migration 0021 but absent from
    `fields`, so there was no write path for it: every portfolio returned
    `nav: null` with `nav_reason='no_opening_balance'` (ledger/valuation.py).
    Both fields are writable now; the ledger still stays the only reader of the
    balance, so accepting it here does not bypass the ledger.

    `MinValueValidator` lives here, not on the model, on purpose: adding it to
    `models.py` would make Django generate a new migration, and migration leaf
    numbers are coordinator-owned in this repository.
    """

    opening_balance = serializers.DecimalField(
        max_digits=20,
        decimal_places=2,
        min_value=Decimal('0'),
        required=False,
        allow_null=True,
    )
    opening_balance_source = serializers.CharField(
        max_length=64,
        required=False,
        allow_blank=True,
        allow_null=True,
    )

    def validate(self, attrs):
        # NAV is only computable when the balance is set, and a balance without a
        # stated provenance is an accounting figure nobody can trace later.
        balance = attrs.get('opening_balance', getattr(self.instance, 'opening_balance', None))
        source = attrs.get(
            'opening_balance_source',
            getattr(self.instance, 'opening_balance_source', None),
        )
        if balance not in (None, '') and not (source or '').strip():
            raise serializers.ValidationError({
                'opening_balance_source': (
                    'Phai ghi nguon goc cua so du mo dau de so lieu nay con truy vet duoc.'
                ),
            })
        return attrs

    class Meta:
        model = Portfolio
        fields = [
            'id', 'name', 'description', 'is_default',
            'opening_balance', 'opening_balance_source', 'created_at',
        ]
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
    Write path qua views_broker.broker_config_api (B1.2, store UserBrokerConfig).
    """
    is_configured = serializers.SerializerMethodField()

    class Meta:
        model = DNSECredential
        fields = ['id', 'is_configured', 'is_active', 'last_sync_at', 'created_at', 'updated_at']
        read_only_fields = ['id', 'is_configured', 'last_sync_at', 'created_at', 'updated_at']

    def get_is_configured(self, obj) -> bool:
        return obj.has_credentials()


class ScreenerRuleSerializer(serializers.ModelSerializer):
    owner_username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = ScreenerRule
        fields = ['id', 'name', 'rules_json', 'is_active', 'is_public', 'owner_username', 'created_at', 'updated_at']
        read_only_fields = ['id', 'owner_username', 'created_at', 'updated_at']


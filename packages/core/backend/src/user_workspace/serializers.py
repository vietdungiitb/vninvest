"""
User Workspace domain serializers.
"""
from rest_framework import serializers

from .models import Portfolio, Transaction, Watchlist, WatchlistItem, SubAccount, DNSECredential


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
    class Meta:
        model = Transaction
        fields = [
            'id', 'symbol', 'transaction_type', 'date',
            'price', 'quantity', 'fee', 'tax', 'external_id', 'note', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class PortfolioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Portfolio
        fields = ['id', 'name', 'description', 'is_default', 'created_at']
        read_only_fields = ['id', 'created_at']


class SubAccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubAccount
        fields = [
            'id', 'broker', 'account_number', 'name', 'display_name',
            'type', 'is_active', 'external_id', 'broker_source',
            'sync_status', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class DNSECredentialSerializer(serializers.ModelSerializer):
    class Meta:
        model = DNSECredential
        fields = ['id', 'is_active', 'last_sync_at', 'created_at', 'updated_at']
        read_only_fields = ['id', 'last_sync_at', 'created_at', 'updated_at']

"""
User Workspace domain serializers.
"""
from rest_framework import serializers

from .models import Portfolio, Transaction, Watchlist, WatchlistItem


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
            'price', 'quantity', 'fee', 'note', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class PortfolioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Portfolio
        fields = ['id', 'name', 'description', 'is_default', 'created_at']
        read_only_fields = ['id', 'created_at']

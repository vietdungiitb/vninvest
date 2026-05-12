"""
Market Data domain serializers.
"""
from rest_framework import serializers

from .models import DailyPrice, StockProfile, VnbrokerRuntimeConfig


class StockProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = StockProfile
        fields = [
            'symbol', 'company_name', 'exchange', 'industry',
            'status', 'outstanding_shares', 'updated_at',
        ]
        read_only_fields = fields


class DailyPriceSerializer(serializers.ModelSerializer):
    class Meta:
        model = DailyPrice
        fields = [
            'symbol', 'date', 'open', 'high', 'low', 'close',
            'volume', 'value', 'change_pct', 'source', 'is_adjusted',
        ]
        read_only_fields = fields

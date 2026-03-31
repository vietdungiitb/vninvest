"""
serializers.py — DRF Serializers cho Portfolio, Transaction, DailyPrice, Watchlist, UserConfig.
"""

from rest_framework import serializers
from .models import Portfolio, Transaction, DailyPrice, SecuritiesGroup, SecuritiesItem, UserConfig, SubAccount, WatchlistGroup, WatchlistItem




class SubAccountSerializer(serializers.ModelSerializer):
    type_display = serializers.CharField(source='get_type_display', read_only=True)
    portfolio_name = serializers.CharField(source='portfolio.name', read_only=True)
    
    class Meta:
        model = SubAccount
        fields = ['id', 'name', 'type', 'type_display', 'portfolio', 'portfolio_name', 'margin_ratio', 'created_at']
        read_only_fields = ['id', 'created_at']

class TransactionSerializer(serializers.ModelSerializer):
    transaction_type_display = serializers.CharField(
        source='get_transaction_type_display', read_only=True
    )
    total_value = serializers.DecimalField(
        max_digits=20, decimal_places=2, read_only=True
    )
    sub_account_name = serializers.CharField(source='sub_account.name', read_only=True)
    sub_account_type = serializers.CharField(source='sub_account.type', read_only=True)

    class Meta:
        model = Transaction
        fields = [
            'id', 'sub_account', 'sub_account_name', 'sub_account_type', 'symbol', 
            'transaction_type', 'transaction_type_display',
            'date', 'price', 'quantity', 'fee', 'notes', 'total_value', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']

    def validate_symbol(self, value):
        return value.upper().strip()

    def validate(self, attrs):
        t_type = attrs.get('transaction_type', '')
        price = attrs.get('price', 0)
        quantity = attrs.get('quantity', 0)

        if t_type in ('BUY', 'SELL') and (price <= 0 or quantity <= 0):
            raise serializers.ValidationError(
                'Lệnh MUA/BÁN phải có giá và khối lượng > 0.'
            )
        return attrs




class PortfolioSerializer(serializers.ModelSerializer):
    transaction_count = serializers.SerializerMethodField()
    subaccount_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Portfolio
        fields = ['id', 'name', 'description', 'created_at', 'updated_at', 'transaction_count', 'subaccount_count']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_transaction_count(self, obj):
        return Transaction.objects.filter(sub_account__portfolio=obj).count()

    def get_subaccount_count(self, obj):
        return obj.sub_accounts.count()



class DailyPriceSerializer(serializers.ModelSerializer):
    class Meta:
        model = DailyPrice
        fields = ['id', 'symbol', 'date', 'open_price', 'high_price', 'low_price', 'close_price', 'volume']


class UserConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserConfig
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_whale_alert_threshold(self, value):
        if value < 1:
            raise serializers.ValidationError('Ngưỡng phải >= 1 triệu VNĐ.')
        return value


# ---------------------------------------------------------------------------
# Read-only serializers cho dữ liệu tổng hợp (Holdings, Chart, Summary)
# ---------------------------------------------------------------------------

class HoldingSerializer(serializers.Serializer):
    """Một vị thế đang nắm giữ với P/L."""
    symbol = serializers.CharField()
    quantity = serializers.DecimalField(max_digits=20, decimal_places=2)
    avg_cost = serializers.DecimalField(max_digits=20, decimal_places=2)
    current_price = serializers.DecimalField(max_digits=20, decimal_places=2, allow_null=True)
    market_value = serializers.DecimalField(max_digits=20, decimal_places=2, allow_null=True)
    cost_basis = serializers.DecimalField(max_digits=20, decimal_places=2)
    unrealized_pl = serializers.DecimalField(max_digits=20, decimal_places=2, allow_null=True)
    unrealized_pl_pct = serializers.DecimalField(max_digits=10, decimal_places=2, allow_null=True)
    realized_pl = serializers.DecimalField(max_digits=20, decimal_places=2)
    dividends_received = serializers.DecimalField(max_digits=20, decimal_places=2)


class SummarySerializer(serializers.Serializer):
    """Tổng quan tài sản của toàn bộ danh mục."""
    portfolio_id = serializers.IntegerField()
    portfolio_name = serializers.CharField()
    total_market_value = serializers.DecimalField(max_digits=20, decimal_places=2)
    total_cost_basis = serializers.DecimalField(max_digits=20, decimal_places=2)
    total_unrealized_pl = serializers.DecimalField(max_digits=20, decimal_places=2)
    total_unrealized_pl_pct = serializers.DecimalField(max_digits=10, decimal_places=2)
    total_realized_pl = serializers.DecimalField(max_digits=20, decimal_places=2)
    total_dividends = serializers.DecimalField(max_digits=20, decimal_places=2)
    last_updated = serializers.DateField(allow_null=True)


class ChartPointSerializer(serializers.Serializer):
    """Một điểm dữ liệu trên biểu đồ đường."""
    date = serializers.DateField()
    value = serializers.DecimalField(max_digits=20, decimal_places=2)


# ---------------------------------------------------------------------------
# Watchlist Serializers
# ---------------------------------------------------------------------------

class SecuritiesGroupCreateSerializer(serializers.ModelSerializer):
    """Dùng để tạo / cập nhật SecuritiesGroup."""
    class Meta:
        model = SecuritiesGroup
        fields = ['id', 'name', 'group_type', 'description', 'color', 'order']
        read_only_fields = ['id']


class SecuritiesItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = SecuritiesItem
        fields = ['id', 'symbol', 'order', 'added_at']
        read_only_fields = ['id', 'added_at']

    def validate_symbol(self, value):
        return value.upper().strip()


# Read-only — bao gồm dữ liệu giá thời gian thực
class WatchlistItemWithPriceSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    symbol = serializers.CharField()
    current_price = serializers.FloatField(allow_null=True)
    prev_price = serializers.FloatField(allow_null=True)
    change_value = serializers.FloatField(allow_null=True)
    change_pct = serializers.FloatField(allow_null=True)
    last_date = serializers.CharField(allow_null=True)



class SecuritiesGroupDetailSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    group_type = serializers.CharField()
    description = serializers.CharField()
    color = serializers.CharField()
    order = serializers.IntegerField()
    items = WatchlistItemWithPriceSerializer(many=True)



class TrackedSymbolSerializer(serializers.Serializer):
    """Serializer cho Mã Theo dõi cá nhân (TrackedSymbol) kèm giá thị trường."""
    id = serializers.IntegerField()
    symbol = serializers.CharField()
    source_group_id = serializers.IntegerField(allow_null=True)
    source_group_name = serializers.CharField(allow_null=True)
    current_price = serializers.FloatField(allow_null=True)
    prev_price = serializers.FloatField(allow_null=True)
    change_value = serializers.FloatField(allow_null=True)
    change_pct = serializers.FloatField(allow_null=True)
    last_date = serializers.CharField(allow_null=True)
    added_at = serializers.DateTimeField()

class WatchlistGroupSerializer(serializers.ModelSerializer):
    class Meta:
        model = WatchlistGroup
        fields = ['id', 'name', 'description', 'created_at']
        read_only_fields = ['id', 'created_at']

class WatchlistItemSerializer(serializers.ModelSerializer):
    group_name = serializers.CharField(source='group.name', read_only=True)
    class Meta:
        model = WatchlistItem
        fields = ['id', 'group', 'group_name', 'symbol', 'added_at']
        read_only_fields = ['id', 'added_at']


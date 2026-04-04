"""
serializers.py — DRF Serializers cho Portfolio, Transaction, DailyPrice, Watchlist, UserConfig.
"""

from rest_framework import serializers
from .models import Portfolio, Transaction, DailyPrice, SecuritiesGroup, SecuritiesItem, UserConfig, SubAccount, WatchlistGroup, WatchlistItem, PriceAlertRule
from .models import StockProfile, WhaleAdvisory, AIAdvisoryComponentRecord, AIAdvisoryExecutiveSummary
from .ai_options import get_default_model, is_valid_model, is_valid_provider




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
        read_only_fields = ['id', 'sub_account', 'created_at']

    def validate_symbol(self, value):
        normalized_symbol = value.upper().strip()
        if not StockProfile.objects.filter(symbol=normalized_symbol).exists():
            raise serializers.ValidationError(
                'Mã chứng khoán không tồn tại trong danh mục hệ thống. Vui lòng kiểm tra lại.'
            )
        return normalized_symbol

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
    ai_api_key = serializers.CharField(write_only=True, required=False, allow_blank=True)
    ai_api_key_configured = serializers.BooleanField(read_only=True)

    class Meta:
        model = UserConfig
        fields = [
            'id',
            'user',
            'whale_alert_threshold',
            'theme',
            'plan',
            'plan_expires_at',
            'oauth_provider',
            'oauth_uid',
            'email_verified',
            'email_verification_sent_at',
            'email_verified_at',
            'ai_provider',
            'ai_model',
            'ai_api_key',
            'ai_api_key_configured',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'user',
            'plan',
            'plan_expires_at',
            'oauth_provider',
            'oauth_uid',
            'email_verified',
            'email_verification_sent_at',
            'email_verified_at',
            'ai_api_key_configured',
            'created_at',
            'updated_at',
        ]

    def validate_whale_alert_threshold(self, value):
        if value < 1:
            raise serializers.ValidationError('Ngưỡng phải >= 1 triệu VNĐ.')
        return value

    def validate_ai_provider(self, value):
        provider = str(value or '').strip().lower()
        if not is_valid_provider(provider):
            raise serializers.ValidationError('AI provider không hợp lệ.')
        return provider

    def validate(self, attrs):
        provider = attrs.get('ai_provider')
        model = attrs.get('ai_model')
        if provider and not model:
            attrs['ai_model'] = get_default_model(provider)
        if provider and not is_valid_model(provider, attrs.get('ai_model')):
            raise serializers.ValidationError({'ai_model': 'Model không thuộc provider đã chọn.'})
        return attrs

    def update(self, instance, validated_data):
        api_key = validated_data.pop('ai_api_key', None)
        instance = super().update(instance, validated_data)
        if api_key is not None:
            instance.set_ai_api_key(api_key)
            instance.save(update_fields=['ai_api_key'])
        return instance


# ---------------------------------------------------------------------------
# WhaleAdvisory serializer — trả về tóm tắt AI & phân tích sâu
# ---------------------------------------------------------------------------

class WhaleAdvisorySerializer(serializers.ModelSerializer):
    class Meta:
        model = WhaleAdvisory
        fields = [
            'id', 'symbol', 'matched_value', 'side', 'threshold',
            'ai_summary', 'ai_detail', 'ai_provider', 'created_at',
        ]
        read_only_fields = fields


class AIAdvisoryComponentRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = AIAdvisoryComponentRecord
        fields = [
            'id', 'symbol', 'component_type', 'indicator_name', 'status',
            'confidence_score', 'suggested_action', 'rationale_text',
            'timeframe', 'include_in_summary', 'is_deleted', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'symbol', 'is_deleted', 'created_at', 'updated_at']


class AIAdvisoryExecutiveSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = AIAdvisoryExecutiveSummary
        fields = [
            'id', 'symbol', 'strategy_action', 'synthesis_text', 'target_price_zone',
            'stop_loss_zone', 'risk_level', 'overall_confidence', 'used_component_ids',
            'summary_version', 'created_at',
        ]
        read_only_fields = fields


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


class PriceAlertRuleSerializer(serializers.ModelSerializer):
    current_price = serializers.FloatField(read_only=True, allow_null=True)
    is_triggered = serializers.BooleanField(read_only=True)

    class Meta:
        model = PriceAlertRule
        fields = [
            'id', 'symbol', 'condition', 'target_price', 'cooldown_seconds',
            'is_active', 'last_triggered_at', 'created_at', 'updated_at',
            'current_price', 'is_triggered',
        ]
        read_only_fields = ['id', 'last_triggered_at', 'created_at', 'updated_at', 'current_price', 'is_triggered']

    def validate_symbol(self, value):
        return value.upper().strip()

    def validate_cooldown_seconds(self, value):
        if value < 0:
            raise serializers.ValidationError('Cooldown phải >= 0 giây.')
        return value

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
        read_only_fields = ['id', 'group', 'added_at']

class StockProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = StockProfile
        fields = ['symbol', 'company_name', 'industry', 'exchange', 'listed_date', 'is_active', 'updated_at']
        read_only_fields = fields


class StockWorkspaceGroupRefSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()


class StockWorkspaceWatchlistMembershipSerializer(serializers.Serializer):
    item_id = serializers.IntegerField()
    group_id = serializers.IntegerField()
    group_name = serializers.CharField()


class StockWorkspaceOverviewSerializer(serializers.Serializer):
    tracked_symbol_id = serializers.IntegerField(allow_null=True)
    symbol = serializers.CharField()
    company_name = serializers.CharField(allow_blank=True)
    industry = serializers.CharField(allow_blank=True)
    exchange = serializers.CharField(allow_blank=True)
    listed_date = serializers.DateField(allow_null=True)
    is_active = serializers.BooleanField()
    updated_at = serializers.DateTimeField(allow_null=True)
    current_price = serializers.FloatField(allow_null=True)
    prev_price = serializers.FloatField(allow_null=True)
    change_value = serializers.FloatField(allow_null=True)
    change_pct = serializers.FloatField(allow_null=True)
    last_date = serializers.CharField(allow_null=True)
    open_price = serializers.FloatField(allow_null=True)
    high_price = serializers.FloatField(allow_null=True)
    low_price = serializers.FloatField(allow_null=True)
    close_price = serializers.FloatField(allow_null=True)
    volume = serializers.IntegerField(allow_null=True)
    average_price = serializers.FloatField(allow_null=True)
    reference_price = serializers.FloatField(allow_null=True)
    ceiling_price = serializers.FloatField(allow_null=True)
    floor_price = serializers.FloatField(allow_null=True)
    week52_high = serializers.FloatField(allow_null=True)
    week52_low = serializers.FloatField(allow_null=True)
    is_tracked = serializers.BooleanField()
    source_group_name = serializers.CharField(allow_null=True)
    market_groups = serializers.ListField(child=serializers.CharField(), allow_empty=True)
    watchlist_groups = serializers.ListField(child=serializers.CharField(), allow_empty=True)
    market_group_refs = StockWorkspaceGroupRefSerializer(many=True)
    watchlist_memberships = StockWorkspaceWatchlistMembershipSerializer(many=True)


class StockWorkspaceTechnicalSerializer(serializers.Serializer):
    bias = serializers.CharField()
    bias_label = serializers.CharField()
    bias_description = serializers.CharField()
    sma20 = serializers.FloatField(allow_null=True)
    sma50 = serializers.FloatField(allow_null=True)
    rsi14 = serializers.FloatField(allow_null=True)
    avg_volume_20 = serializers.FloatField(allow_null=True)
    price_vs_sma20_pct = serializers.FloatField(allow_null=True)
    price_vs_sma50_pct = serializers.FloatField(allow_null=True)
    momentum_20d_pct = serializers.FloatField(allow_null=True)
    range_position_pct = serializers.FloatField(allow_null=True)
    latest_close = serializers.FloatField(allow_null=True)


class StockWorkspaceChartPointSerializer(serializers.Serializer):
    date = serializers.CharField()
    open = serializers.FloatField(allow_null=True)
    high = serializers.FloatField(allow_null=True)
    low = serializers.FloatField(allow_null=True)
    close = serializers.FloatField()
    volume = serializers.FloatField(allow_null=True)


class StockWorkspaceChartResponseSerializer(serializers.Serializer):
    symbol = serializers.CharField()
    days = serializers.IntegerField()
    start_date = serializers.CharField()
    end_date = serializers.CharField()
    points = StockWorkspaceChartPointSerializer(many=True)
    technical = StockWorkspaceTechnicalSerializer()


from .models import ScreenerRule


class ScreenerRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = ScreenerRule
        fields = ['id', 'name', 'rules_json', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


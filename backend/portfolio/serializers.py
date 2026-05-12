"""
serializers.py — DRF Serializers cho Portfolio, Transaction, DailyPrice, Watchlist, UserConfig.
"""

from rest_framework import serializers
from .models import Portfolio, Transaction, DailyPrice, SecuritiesGroup, SecuritiesItem, UserConfig, SubAccount, WatchlistGroup, WatchlistItem, PriceAlertRule, RuntimeVnbrokerConfig, DNSECredential
from .models import AICommandCenterAuditLog, AICommandCenterConfig
from .models import StockProfile, WhaleAdvisory, AIAdvisoryComponentRecord, AIAdvisoryExecutiveSummary, LegalPage
from .models import ScreenerRule, CrawlJob, CrawlSchedule, CrawlRun, CrawlAuditLog, SignalServiceRun
from .ai_options import ADVISORY_CAPABILITY, get_default_model, is_model_allowed_for_capability, is_valid_model, is_valid_provider
from .vnbroker_runtime_config import ALLOWED_VNBROKER_SOURCES, default_vnbroker_source_config




class SubAccountSerializer(serializers.ModelSerializer):
    type_display = serializers.CharField(source='get_type_display', read_only=True)
    portfolio_name = serializers.CharField(source='portfolio.name', read_only=True)
    
    class Meta:
        model = SubAccount
        fields = ['id', 'name', 'type', 'type_display', 'portfolio', 'portfolio_name', 'margin_ratio', 'created_at']
        read_only_fields = ['id', 'created_at']
        extra_kwargs = {
            'portfolio': {'required': False},
        }

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
            # Soft-bootstrap profile to avoid blocking first transaction of a new symbol.
            StockProfile.objects.create(
                symbol=normalized_symbol,
                company_name=normalized_symbol,
                industry='Unknown',
                exchange='UNKNOWN',
                is_active=True,
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

    def create(self, validated_data):
        from .services_symbol_engagement import activate_symbol_engagement
        from django.db import transaction as db_transaction

        instance = super().create(validated_data)

        # Trigger engagement warm-up (ensure transaction is committed)
        # Note: instance.sub_account is set by the view before saving
        user_id = getattr(instance.sub_account.portfolio, 'user_id', None)
        if user_id and instance.symbol:
            db_transaction.on_commit(
                lambda: activate_symbol_engagement(
                    user_id=user_id,
                    symbol=instance.symbol,
                    source='holding_add'
                )
            )
        return instance




class PortfolioSerializer(serializers.ModelSerializer):
    transaction_count = serializers.SerializerMethodField()
    subaccount_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Portfolio
        fields = ['id', 'name', 'description', 'created_at', 'updated_at', 'transaction_count', 'subaccount_count']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_transaction_count(self, obj):
        if hasattr(obj, 'transaction_count_annotated'):
            return obj.transaction_count_annotated
        return Transaction.objects.filter(sub_account__portfolio=obj).count()

    def get_subaccount_count(self, obj):
        if hasattr(obj, 'subaccount_count_annotated'):
            return obj.subaccount_count_annotated
        return obj.sub_accounts.count()



class DailyPriceSerializer(serializers.ModelSerializer):
    class Meta:
        model = DailyPrice
        fields = ['id', 'symbol', 'date', 'open_price', 'high_price', 'low_price', 'close_price', 'volume']


class UserConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserConfig
        fields = [
            'id',
            'user',
            'whale_alert_threshold',
            'theme',
            'language',
            'plan',
            'plan_expires_at',
            'oauth_provider',
            'oauth_uid',
            'email_verified',
            'email_verification_sent_at',
            'email_verified_at',
            'advisory_auto_generation_enabled',
            'advisory_whale_signal_enabled',
            'advisory_manual_refresh_enabled',
            'advisory_refresh_interval_hours',
            'advisory_max_auto_refreshes_per_day',
            'advisory_max_tokens_per_day',
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
            'created_at',
            'updated_at',
        ]

    def validate_whale_alert_threshold(self, value):
        if value < 1:
            raise serializers.ValidationError('Ngưỡng phải >= 1 triệu VNĐ.')
        return value

    def validate_advisory_max_auto_refreshes_per_day(self, value):
        if value < 1:
            raise serializers.ValidationError('Số lần auto refresh/ngày phải >= 1.')
        return value



class AICommandCenterConfigSerializer(serializers.ModelSerializer):
    ai_api_key = serializers.CharField(write_only=True, required=False, allow_blank=True)
    ai_api_key_configured = serializers.BooleanField(read_only=True)

    class Meta:
        model = AICommandCenterConfig
        fields = [
            'id',
            'user',
            'ai_provider',
            'ai_model',
            'ai_api_key',
            'ai_api_key_configured',
            'ai_prompt_config',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'user',
            'ai_api_key_configured',
            'created_at',
            'updated_at',
        ]

    def validate_ai_provider(self, value):
        provider = str(value or '').strip().lower()
        if not is_valid_provider(provider):
            raise serializers.ValidationError('AI provider không hợp lệ.')
        return provider

    def validate_ai_prompt_config(self, value):
        from .ai_advisory_helpers import _parse_prompt_config

        normalized = _parse_prompt_config(value)
        if not isinstance(normalized, dict):
            raise serializers.ValidationError('AI prompt_config phải là object.')
        return normalized

    def validate(self, attrs):
        provider = attrs.get('ai_provider')
        model = attrs.get('ai_model')
        if provider and not model:
            attrs['ai_model'] = get_default_model(provider)
        if provider and not is_valid_model(provider, attrs.get('ai_model')):
            raise serializers.ValidationError({'ai_model': 'Model không thuộc provider đã chọn.'})
        if provider and not is_model_allowed_for_capability(provider, attrs.get('ai_model'), ADVISORY_CAPABILITY):
            raise serializers.ValidationError({'ai_model': 'Model này chưa được hỗ trợ cho AI advisory hiện tại.'})
        return attrs

    def update(self, instance, validated_data):
        api_key = validated_data.pop('ai_api_key', None)
        instance = super().update(instance, validated_data)
        if api_key is not None:
            instance.set_ai_api_key(api_key)
            instance.save(update_fields=['ai_api_key'])
        return instance


class RuntimeVnbrokerConfigSerializer(serializers.ModelSerializer):
    updated_by_username = serializers.CharField(source='updated_by.username', read_only=True)

    class Meta:
        model = RuntimeVnbrokerConfig
        fields = [
            'id',
            'max_concurrency',
            'retry_attempts',
            'retry_backoff_seconds',
            'rate_limit_cooldown_seconds',
            'timeout_config',
            'price_board_source',
            'fallback_sources',
            'source_config',
            'enable_caching',
            'enable_rate_limit_detection',
            'enable_concurrent_limit',
            'changelog',
            'updated_by',
            'updated_by_username',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'changelog', 'updated_by', 'updated_by_username', 'created_at', 'updated_at']

    def validate_price_board_source(self, value):
        source = str(value or '').strip().upper()
        if source not in ALLOWED_VNBROKER_SOURCES:
            raise serializers.ValidationError('price_board_source không hợp lệ.')
        return source

    def validate_fallback_sources(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError('fallback_sources phải là danh sách.')
        normalized = []
        for item in value:
            source = str(item or '').strip().upper()
            if not source:
                continue
            if source not in ALLOWED_VNBROKER_SOURCES:
                raise serializers.ValidationError(f'Provider không hợp lệ: {source}')
            if source not in normalized:
                normalized.append(source)
        return normalized

    def validate_source_config(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError('source_config phải là object hợp lệ.')

        allowed_channels = set(default_vnbroker_source_config().keys())
        normalized = {}
        for channel, channel_value in value.items():
            if channel not in allowed_channels:
                raise serializers.ValidationError(f'source_config chứa channel không hợp lệ: {channel}')
            if not isinstance(channel_value, dict):
                raise serializers.ValidationError(f'source_config.{channel} phải là object.')

            source = str(channel_value.get('primary') or '').strip().upper()
            if source not in ALLOWED_VNBROKER_SOURCES:
                raise serializers.ValidationError(f'source_config.{channel}.primary không hợp lệ.')
            normalized[channel] = {'primary': source}

        return normalized

    def validate_timeout_config(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError('timeout_config phải là object hợp lệ.')
        allowed_channels = {'price_board', 'intraday', 'financial_ratio', 'history', 'listing', 'general'}
        normalized = {}
        for channel in allowed_channels:
            raw_timeout = value.get(channel)
            if raw_timeout is None:
                continue
            try:
                timeout_value = int(raw_timeout)
            except (TypeError, ValueError):
                raise serializers.ValidationError(f'timeout_config.{channel} phải là số nguyên.')
            if timeout_value < 1 or timeout_value > 120:
                raise serializers.ValidationError(f'timeout_config.{channel} phải nằm trong khoảng [1, 120].')
            normalized[channel] = timeout_value
        return normalized

    def validate(self, attrs):
        source = str(attrs.get('price_board_source') or getattr(self.instance, 'price_board_source', 'KBS')).strip().upper()
        source_config = attrs.get('source_config')
        if source_config is not None:
            merged_source_config = default_vnbroker_source_config()
            if self.instance is not None:
                existing_source_config = getattr(self.instance, 'source_config', None)
                if isinstance(existing_source_config, dict):
                    merged_source_config.update(existing_source_config)
            merged_source_config.update(source_config)
            attrs['source_config'] = merged_source_config
            source = str(merged_source_config.get('price_board', {}).get('primary') or source).strip().upper()
            attrs['price_board_source'] = source

        fallback_sources = attrs.get('fallback_sources')
        if fallback_sources is None and self.instance is not None:
            fallback_sources = list(self.instance.fallback_sources or [])
        fallback_sources = fallback_sources or []
        if source and source not in fallback_sources:
            fallback_sources = [source] + [item for item in fallback_sources if item != source]
            attrs['fallback_sources'] = fallback_sources

        timeout_config = attrs.get('timeout_config')
        if timeout_config is not None:
            merged = RuntimeVnbrokerConfig.default_timeout_config()
            merged.update(timeout_config)
            attrs['timeout_config'] = merged
        return attrs


# ---------------------------------------------------------------------------
# WhaleAdvisory serializer — trả về tóm tắt AI & phân tích sâu
# ---------------------------------------------------------------------------

class WhaleAdvisorySerializer(serializers.ModelSerializer):
    symbol = serializers.SerializerMethodField()

    def get_symbol(self, obj):
        """
        PR-6: mask_symbol tại tầng Serializer — an toàn tuyệt đối.
        User Free → ký hiệu bị băm (VNM → V**).
        Áp dụng khi symbol không nằm trong preferred_symbols (max 3 mã quà tặng).
        """
        request = self.context.get('request')
        if request is None:
            return obj.symbol
        try:
            from portfolio.opencore_premium import PremiumFeatureGate
            if PremiumFeatureGate.can_use_feature(request.user, 'telegram_bot_full'):
                return obj.symbol  # Pro/Enterprise: trả symbol thật
            # Free: kiểm tra preferred_symbols
            try:
                preferred = list(request.user.telegram_profile.preferred_symbols or [])
            except Exception:
                preferred = []
            if obj.symbol in preferred:
                return obj.symbol  # Nằm trong 3 mã quà tặng → hiện thật
            return PremiumFeatureGate.mask_symbol(obj.symbol)
        except Exception:
            return obj.symbol  # Fallback an toàn

    class Meta:
        model = WhaleAdvisory
        fields = [
            'id', 'symbol', 'matched_value', 'side', 'threshold',
            'ai_summary', 'ai_detail', 'ai_provider', 'ai_model', 'created_at',
            'next_refresh_at', 'refresh_count', 'is_auto_generated', 'source', 'merged_sources', 'primary_source', 'advisory_type', 'severity',
            'is_discovery', 'discovery_bucket', 'whale_intensity', 'threshold_source',
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


class StockAIChartVisibleRangeSerializer(serializers.Serializer):
    from_ts = serializers.IntegerField(required=False, allow_null=True)
    to_ts = serializers.IntegerField(required=False, allow_null=True)

    def validate(self, attrs):
        from_ts = attrs.get('from_ts')
        to_ts = attrs.get('to_ts')
        if from_ts is not None and to_ts is not None and from_ts > to_ts:
            raise serializers.ValidationError('visible_range.from_ts must be <= visible_range.to_ts')
        return attrs


class StockAIChartOHLCVPointSerializer(serializers.Serializer):
    ts = serializers.IntegerField()
    o = serializers.FloatField(required=False, allow_null=True)
    h = serializers.FloatField(required=False, allow_null=True)
    l = serializers.FloatField(required=False, allow_null=True)
    c = serializers.FloatField(required=False, allow_null=True)
    v = serializers.FloatField(required=False, allow_null=True)


class StockAIChartDrawingMetaSerializer(serializers.Serializer):
    overlay_count = serializers.IntegerField(required=False, min_value=0)
    types = serializers.ListField(child=serializers.CharField(max_length=40), required=False)


class StockAIChartContextSerializer(serializers.Serializer):
    symbol = serializers.CharField(max_length=10, required=False, allow_blank=True)
    chart_timeframe = serializers.CharField(max_length=10, required=False, allow_blank=True)
    visible_range = StockAIChartVisibleRangeSerializer(required=False)
    ohlcv = StockAIChartOHLCVPointSerializer(many=True, required=False)
    active_indicators = serializers.DictField(child=serializers.BooleanField(), required=False)
    computed_metrics = serializers.DictField(child=serializers.FloatField(), required=False)
    drawing_meta = StockAIChartDrawingMetaSerializer(required=False)
    client_generated_at = serializers.CharField(required=False, allow_blank=True)

    def validate_symbol(self, value):
        return str(value or '').strip().upper()

    def validate_ohlcv(self, value):
        max_points = int(self.context.get('max_ohlcv_points', 300))
        if len(value) > max_points:
            raise serializers.ValidationError(f'ohlcv exceeds max points ({max_points})')
        return value

    def validate(self, attrs):
        request_symbol = str(self.context.get('symbol') or '').strip().upper()
        payload_symbol = str(attrs.get('symbol') or '').strip().upper()
        if payload_symbol and request_symbol and payload_symbol != request_symbol:
            raise serializers.ValidationError({'symbol': 'chart_context.symbol mismatch URL symbol'})
        return attrs


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
    industry = serializers.CharField(required=False, allow_null=True)
    change_period_pct = serializers.FloatField(allow_null=True, required=False, default=None)
    market_cap_bn = serializers.FloatField(allow_null=True, required=False, default=None)


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
    whale_alert_threshold_million = serializers.FloatField(allow_null=True)
    current_price = serializers.FloatField(allow_null=True)
    prev_price = serializers.FloatField(allow_null=True)
    change_value = serializers.FloatField(allow_null=True)
    change_pct = serializers.FloatField(allow_null=True)
    last_date = serializers.CharField(allow_null=True)
    added_at = serializers.DateTimeField()
    updated_at = serializers.DateTimeField()
    industry = serializers.CharField(required=False, allow_null=True)
    company_name = serializers.CharField(required=False, allow_null=True)
    market_cap_bn = serializers.FloatField(required=False, allow_null=True)


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
    items = serializers.SerializerMethodField()

    class Meta:
        model = WatchlistGroup
        fields = ['id', 'name', 'description', 'created_at', 'items']
        read_only_fields = ['id', 'created_at']

    def get_items(self, obj):
        return WatchlistItemSerializer(obj.items.all(), many=True).data

class WatchlistItemSerializer(serializers.ModelSerializer):
    group_name = serializers.CharField(source='group.name', read_only=True)
    class Meta:
        model = WatchlistItem
        fields = ['id', 'group', 'group_name', 'symbol', 'added_at']
        read_only_fields = ['id', 'group', 'added_at']

    def validate_symbol(self, value):
        value = value.upper().strip()
        # Validate format: 1–10 ký tự chữ in hoa và số
        if not value.isalnum() or len(value) > 10:
            raise serializers.ValidationError(
                'Mã chứng khoán không hợp lệ. Chỉ chấp nhận 1–10 ký tự chữ in hoa và số.'
            )
        # Validate existence: kiểm tra StockProfile nếu bảng đã được sync
        if StockProfile.objects.exists() and not StockProfile.objects.filter(symbol=value).exists():
            raise serializers.ValidationError(
                f'Mã {value} không tồn tại trong hệ thống. Vui lòng kiểm tra lại mã chứng khoán.'
            )
        return value

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
    timeframe = serializers.CharField(required=False)
    interval = serializers.CharField(required=False)
    start_date = serializers.CharField()
    end_date = serializers.CharField()
    points = StockWorkspaceChartPointSerializer(many=True)
    technical = StockWorkspaceTechnicalSerializer()


# ---------------------------------------------------------------------------
# Screener & Whale Service serializers
# ---------------------------------------------------------------------------


class ScreenerRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = ScreenerRule
        fields = ['id', 'name', 'rules_json', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class MarketIntradayQuerySerializer(serializers.Serializer):
    page_size = serializers.IntegerField(required=False, default=50, min_value=10, max_value=200)


class MarketStockChartQuerySerializer(serializers.Serializer):
    days = serializers.IntegerField(required=False, default=180, min_value=1, max_value=3650)
    timeframe = serializers.ChoiceField(
        required=False,
        default='1H',
        choices=['1m', '5m', '15m', '1H', '2H', '4H', 'D', 'W', 'M', 'Y'],
    )


class TradingSubAccountCreateRequestSerializer(serializers.Serializer):
    portfolio = serializers.IntegerField(required=False, min_value=1)


# ---------------------------------------------------------------------------
# Sprint 28 — LegalPage Serializer
# ---------------------------------------------------------------------------
class LegalPageSerializer(serializers.ModelSerializer):
    slug_display = serializers.CharField(source='get_slug_display', read_only=True)
    locale_display = serializers.CharField(source='get_locale_display', read_only=True)

    class Meta:
        model = LegalPage
        fields = [
            'id', 'slug', 'slug_display', 'locale', 'locale_display',
            'title', 'summary', 'content_markdown',
            'version', 'published_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'slug', 'slug_display', 'locale', 'locale_display',
            'title', 'summary', 'content_markdown',
            'version', 'published_at', 'updated_at',
        ]


# ---------------------------------------------------------------------------
# Crawling Control Plane serializers
# ---------------------------------------------------------------------------

class CrawlJobSerializer(serializers.ModelSerializer):
    class Meta:
        model = CrawlJob
        fields = ['id', 'service_code', 'description', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

class CrawlScheduleSerializer(serializers.ModelSerializer):
    job = serializers.PrimaryKeyRelatedField(queryset=CrawlJob.objects.all())
    class Meta:
        model = CrawlSchedule
        fields = ['id', 'job', 'cron_expression', 'next_run_at', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

class CrawlRunSerializer(serializers.ModelSerializer):
    job = serializers.PrimaryKeyRelatedField(queryset=CrawlJob.objects.all())
    class Meta:
        model = CrawlRun
        fields = ['id', 'job', 'trigger_type', 'started_at', 'finished_at', 'status', 'log', 'created_at', 'updated_at']
        read_only_fields = ['id', 'started_at', 'finished_at', 'created_at', 'updated_at']

class CrawlAuditLogSerializer(serializers.ModelSerializer):
    run = serializers.PrimaryKeyRelatedField(queryset=CrawlRun.objects.all(), allow_null=True, required=False)
    class Meta:
        model = CrawlAuditLog
        fields = '__all__'

class SignalServiceRunSerializer(serializers.ModelSerializer):
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    service_domain_display = serializers.CharField(source='get_service_domain_display', read_only=True)
    run_type_display = serializers.CharField(source='get_run_type_display', read_only=True)

    class Meta:
        model = SignalServiceRun
        fields = [
            'id', 'service_domain', 'service_domain_display', 'run_type', 'run_type_display',
            'status', 'status_display', 'created_by_username', 'params_json', 'task_id', 'progress_pct',
            'processed_items', 'stored_items', 'failed_items', 'log',
            'created_at', 'updated_at',
        ]
        read_only_fields = fields


class DNSECredentialSerializer(serializers.ModelSerializer):
    username_configured = serializers.SerializerMethodField()
    api_key_configured = serializers.SerializerMethodField()
    
    class Meta:
        model = DNSECredential
        fields = [
            'id', 'user', 'is_active', 'last_synced_at', 
            'created_at', 'updated_at',
            'username_configured', 'api_key_configured'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'last_synced_at']

    def get_username_configured(self, obj):
        return bool(obj.username_ciphertext)

    def get_api_key_configured(self, obj):
        return bool(obj.api_key_ciphertext)

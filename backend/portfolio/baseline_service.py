"""Baseline service for abnormality scoring and symbol statistics."""

import logging
from datetime import date, datetime, timedelta
from decimal import Decimal

from django.db.models import Avg, Count, ExpressionWrapper, F, FloatField, Max, Min, Sum
from django.utils import timezone

from .adapters.cache_adapter import get_cache, set_cache
from .models import DailyPrice, IntradayTick

logger = logging.getLogger(__name__)


class BaselineService:
    """Compute baseline metrics (ADV, session percentile, abnormality score) for whale event analysis."""

    ABNORMALITY_CACHE_TTL = 3600  # 1 hour
    BASELINE_CACHE_TTL = 86400  # 24 hours
    
    def __init__(self):
        pass

    def get_symbol_baseline(self, symbol: str, lookback_days: int = 20) -> dict:
        """
        Get baseline metrics for a symbol (ADV, volume stats, price volatility).
        
        Returns:
            {
                'symbol': str,
                'adv_vnd': float,  # Average Daily Value in VND
                'avg_volume': float,
                'max_daily_value': float,
                'min_daily_value': float,
                'volatility_percent': float,
                'liquidity_tier': str,  # low | medium | high
                'days_lookback': int,
                'as_of_date': str,
            }
        """
        cache_key = f'baseline:symbol:{symbol.upper()}:{lookback_days}d'
        cached = get_cache(cache_key)
        if cached is not None:
            return cached

        today_local = timezone.localdate()
        lookback_start = today_local - timedelta(days=lookback_days)

        # Get daily prices for ADV calculation
        daily_stats = (
            DailyPrice.objects
            .filter(symbol=symbol.upper(), date__gte=lookback_start, date__lte=today_local)
            .aggregate(
                avg_close=Avg('close_price'),
                max_close=Max('close_price'),
                min_close=Min('close_price'),
                avg_volume=Avg('volume'),
                max_volume=Max('volume'),
                min_volume=Min('volume'),
                count=Count('id'),
            )
        )

        if not daily_stats or daily_stats['count'] is None or daily_stats['count'] == 0:
            # Return minimal baseline if no historical data
            return {
                'symbol': symbol.upper(),
                'adv_vnd': 0.0,
                'avg_volume': 0.0,
                'max_daily_value': 0.0,
                'min_daily_value': 0.0,
                'volatility_percent': 0.0,
                'liquidity_tier': 'low',
                'days_lookback': lookback_days,
                'as_of_date': today_local.isoformat(),
            }

        avg_close = float(daily_stats['avg_close'] or 0.0)
        avg_volume = float(daily_stats['avg_volume'] or 0.0)
        adv_vnd = avg_close * avg_volume

        # Calculate volatility
        max_close = float(daily_stats['max_close'] or 0.0)
        min_close = float(daily_stats['min_close'] or 0.0)
        volatility_percent = 0.0
        if avg_close > 0:
            volatility_percent = ((max_close - min_close) / avg_close) * 100

        # Classify liquidity tier based on ADV
        if adv_vnd >= 100_000_000_000:  # 100 billion VND
            liquidity_tier = 'high'
        elif adv_vnd >= 10_000_000_000:  # 10 billion VND
            liquidity_tier = 'medium'
        else:
            liquidity_tier = 'low'

        result = {
            'symbol': symbol.upper(),
            'adv_vnd': round(adv_vnd, 2),
            'avg_volume': round(avg_volume, 2),
            'max_daily_value': round(max_close * daily_stats['max_volume'], 2),
            'min_daily_value': round(min_close * daily_stats['min_volume'], 2),
            'volatility_percent': round(volatility_percent, 2),
            'liquidity_tier': liquidity_tier,
            'days_lookback': lookback_days,
            'as_of_date': today_local.isoformat(),
        }

        set_cache(cache_key, result, timeout=self.BASELINE_CACHE_TTL)
        return result

    def get_session_percentile(self, symbol: str, matched_value: float, window: str = 'session') -> float:
        """
        Calculate what percentile this whale event is within today's session (or other window).
        
        Returns:
            percentile (0-100), where 100 = largest whale event in the window
        """
        cache_key = f'session_percentile:{symbol.upper()}:{window}'
        cached = get_cache(cache_key)
        if cached is not None:
            from_cache = cached.get(f'percentile_{matched_value}')
            if from_cache is not None:
                return from_cache

        today_local = timezone.localdate()
        
        # Determine date filter based on window
        if window == 'session':
            date_filter = today_local
        elif window == '5d':
            date_filter__gte = today_local - timedelta(days=4)
            date_filter__lte = today_local
        else:
            date_filter = today_local

        queryset = IntradayTick.objects.filter(symbol=symbol.upper())
        
        if window == '5d':
            queryset = queryset.filter(trade_date__gte=date_filter__gte, trade_date__lte=date_filter__lte)
        else:
            queryset = queryset.filter(trade_date=date_filter)

        # Count how many events have lower matched_value
        queryset = queryset.annotate(
            matched_value=ExpressionWrapper(F('price') * F('volume'), output_field=FloatField())
        )
        
        total_count = queryset.count()
        if total_count == 0:
            return 50.0  # Default to median if no data

        lower_count = queryset.filter(matched_value__lt=matched_value).count()
        percentile = (lower_count / total_count) * 100

        return round(percentile, 2)

    def calculate_abnormality_score(
        self,
        symbol: str,
        matched_value: float,
        baseline: dict | None = None,
        session_percentile: float | None = None,
    ) -> dict:
        """
        Calculate abnormality score (0-100) based on matched_value vs baseline ADV and distribution.
        
        Returns:
            {
                'abnormality_score': float (0-100),
                'adv_multiple': float,
                'percentile_rank': float,
                'liquidity_stress': str,  # low | medium | high
                'triggers': list[str],
            }
        """
        if baseline is None:
            baseline = self.get_symbol_baseline(symbol)

        if session_percentile is None:
            session_percentile = self.get_session_percentile(symbol, matched_value)

        adv_vnd = baseline['adv_vnd']
        adv_multiple = matched_value / adv_vnd if adv_vnd > 0 else 0.0

        # Calculate abnormality based on:
        # 1. How many ADVs (multiples)
        # 2. Session percentile rank
        # 3. Liquidity context

        abnormality_score = 50.0  # Start at neutral
        triggers = []

        # If matched_value > 3x ADV, significant abnormality
        if adv_multiple >= 3.0:
            abnormality_score = min(100, 50 + (adv_multiple - 3.0) * 10)
            triggers.append(f'{adv_multiple:.1f}x ADV large block')
        elif adv_multiple >= 1.5:
            abnormality_score = min(90, 50 + (adv_multiple - 1.5) * 15)
            triggers.append(f'{adv_multiple:.1f}x ADV block')
        elif adv_multiple <= 0.1:
            abnormality_score = 20
            triggers.append('Small micro-transaction')

        # Session percentile: if in top 10%, boost score
        if session_percentile >= 90:
            abnormality_score = min(100, abnormality_score + 15)
            triggers.append('Top 10% of session events')
        elif session_percentile >= 75:
            abnormality_score = min(95, abnormality_score + 8)
            triggers.append('Top 25% of session events')

        # Liquidity context
        liquidity_stress = baseline['liquidity_tier']
        if liquidity_stress == 'low':
            abnormality_score = min(100, abnormality_score + 10)
            triggers.append('Low liquidity stock amplifies')

        abnormality_score = round(abnormality_score, 1)

        return {
            'abnormality_score': abnormality_score,
            'adv_multiple': round(adv_multiple, 2),
            'percentile_rank': round(session_percentile, 1),
            'liquidity_stress': liquidity_stress,
            'triggers': triggers,
        }

    def get_whale_symbol_summary(self, symbol: str, window: str = 'session') -> dict:
        """
        Get comprehensive summary for a symbol including latest campaign, abnormality, and context.
        
        Returns:
            {
                'symbol': str,
                'latest_campaign': str | None,
                'campaign_count_session': int,
                'buy_bias': float,  # 0-100, 50 = neutral
                'net_value_today': float,
                'abnormality_summary': str,
                'baseline': dict,
                'source_quality': dict,
            }
        """
        today_local = timezone.localdate() 
        
        # Get today's whale events for this symbol
        today_events = IntradayTick.objects.filter(
            symbol=symbol.upper(),
            trade_date=today_local,
        ).annotate(
            matched_value=ExpressionWrapper(F('price') * F('volume'), output_field=FloatField())
        )

        # Calculate buy/sell bias
        buy_count = today_events.filter(side='BUY').count()
        sell_count = today_events.filter(side='SELL').count()
        total_count = today_events.count()
        
        if total_count == 0:
            buy_bias = 50.0
        else:
            buy_bias = (buy_count / total_count) * 100

        # Calculate net value
        buy_value = today_events.filter(side='BUY').aggregate(Sum('matched_value'))['matched_value__sum'] or 0
        sell_value = today_events.filter(side='SELL').aggregate(Sum('matched_value'))['matched_value__sum'] or 0
        net_value = buy_value - sell_value

        # Get baseline
        baseline = self.get_symbol_baseline(symbol)

        # Latest abnormality
        latest_event = today_events.order_by('-created_at').first()
        abnormality_summary = 'N/A'
        if latest_event:
            abnormality = self.calculate_abnormality_score(
                symbol,
                float(getattr(latest_event, 'matched_value', 0) or 0),
                baseline=baseline,
            )
            abnormality_summary = f'Score: {abnormality["abnormality_score"]}, ADV: {abnormality["adv_multiple"]}x'

        return {
            'symbol': symbol.upper(),
            'latest_campaign': None,  # TODO: Link to actual campaign
            'campaign_count_session': total_count,
            'buy_bias': round(buy_bias, 1),
            'net_value_today': round(float(net_value or 0), 2),
            'abnormality_summary': abnormality_summary,
            'baseline': baseline,
            'source_quality': {
                'freshness_bucket': '< 5 minutes',
                'last_update': timezone.now().isoformat(),
            },
        }

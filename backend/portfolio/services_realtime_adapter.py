"""
Realtime data adapter helpers extraction from legacy views.

This module provides common adapters and utilities for realtime endpoints,
extracted from legacy views.py. All fetch operations emit observability metrics.
"""
import logging
from decimal import Decimal
from django.utils import timezone

from .adapters.vnbroker_adapter import (
    fetch_price_board_dataframe as _adapter_fetch_price_board,
    fetch_intraday_dataframe as _adapter_fetch_intraday,
    fetch_financial_ratio_dataframe as _adapter_fetch_financial_ratio,
)
from .services import get_price_changes
from .exceptions import ExternalSystemException
from .services_realtime_metrics import increment_realtime_metric

logger = logging.getLogger(__name__)


def fetch_price_board_dataframe(symbols_list: list[str], anchor_symbol: str, source: str | None = None):
    """
    Wrapper around vnbroker adapter to fetch price board data with consistent error handling.
    Emits metrics: realtime_upstream_calls_total (suffix: price_board), realtime_upstream_errors_total
    
    Args:
        symbols_list: List of stock symbols to fetch
        anchor_symbol: Primary symbol for rate-limit tracking
        source: Optional data source provider
        
    Returns:
        DataFrame with price board data or None if failed
        
    Raises:
        ExternalSystemException: If fetch fails
    """
    try:
        increment_realtime_metric('realtime_upstream_calls_total', suffix='price_board')
        return _adapter_fetch_price_board(symbols_list, anchor_symbol=anchor_symbol, source=source)
    except ExternalSystemException:
        increment_realtime_metric('realtime_upstream_errors_total', suffix='price_board')
        raise
    except Exception as exc:
        increment_realtime_metric('realtime_upstream_errors_total', suffix='price_board')
        logger.warning('fetch_price_board_dataframe error for %s: %s', anchor_symbol, exc)
        raise ExternalSystemException(str(exc), code='vnbroker_error')


def fetch_intraday_dataframe(symbol: str, page_size: int = 25):
    """
    Wrapper around vnbroker adapter to fetch intraday tick data.
    Emits metrics: realtime_upstream_calls_total (suffix: intraday), realtime_upstream_errors_total
    
    Args:
        symbol: Stock symbol
        page_size: Number of records to fetch (default 25)
        
    Returns:
        DataFrame with intraday data or None if failed
        
    Raises:
        ExternalSystemException: If fetch fails
    """
    try:
        increment_realtime_metric('realtime_upstream_calls_total', suffix='intraday')
        return _adapter_fetch_intraday(symbol=symbol, page_size=page_size)
    except ExternalSystemException:
        increment_realtime_metric('realtime_upstream_errors_total', suffix='intraday')
        raise
    except Exception as exc:
        increment_realtime_metric('realtime_upstream_errors_total', suffix='intraday')
        logger.warning('fetch_intraday_dataframe error for %s: %s', symbol, exc)
        raise ExternalSystemException(str(exc), code='vnbroker_error')


def fetch_financial_ratio_dataframe(symbol: str, *, period: str = 'year', lang: str = 'vi', dropna: bool = True, source: str | None = None):
    """
    Wrapper around vnbroker adapter to fetch financial ratio data.
    Emits metrics: realtime_upstream_calls_total (suffix: financial_ratio), realtime_upstream_errors_total
    
    Args:
        symbol: Stock symbol
        period: Period type ('year', 'quarter') - default 'year'
        lang: Language ('vi', 'en') - default 'vi'
        dropna: Drop NaN rows - default True
        source: Optional preferred data source, will fallback automatically when omitted
        
    Returns:
        DataFrame with financial ratio data or None if failed
        
    Raises:
        ExternalSystemException: If fetch fails
    """
    try:
        increment_realtime_metric('realtime_upstream_calls_total', suffix='financial_ratio')
        return _adapter_fetch_financial_ratio(
            symbol,
            period=period,
            lang=lang,
            dropna=dropna,
            source=source,
        )
    except ExternalSystemException:
        increment_realtime_metric('realtime_upstream_errors_total', suffix='financial_ratio')
        raise
    except Exception as exc:
        increment_realtime_metric('realtime_upstream_errors_total', suffix='financial_ratio')
        logger.warning('fetch_financial_ratio_dataframe error for %s: %s', symbol, exc)
        raise ExternalSystemException(str(exc), code='vnbroker_error')



def normalize_symbol(symbol: str | None) -> str:
    """Normalize stock symbol to uppercase."""
    return str(symbol or '').strip().upper()


def resolve_user_whale_threshold_vnd(user, symbol: str) -> tuple[float, str]:
    """
    Resolve whale alert threshold for user and symbol.
    
    Priority:
    1. User's custom threshold on TrackedSymbol
    2. Domain default from settings
    
    Args:
        user: Django user object
        symbol: Stock symbol
        
    Returns:
        Tuple of (threshold_vnd, source_label)
    """
    from .models import TrackedSymbol
    from django.conf import settings
    
    normalized_symbol = normalize_symbol(symbol)
    if not normalized_symbol:
        default_threshold = float(getattr(settings, 'DOMAIN_WHALE_THRESHOLD_MILLION_VND', 5.0)) * 1e6
        return default_threshold, 'domain_default'
    
    try:
        tracked = TrackedSymbol.objects.filter(
            user=user,
            symbol=normalized_symbol
        ).first()
        
        if tracked and tracked.whale_alert_threshold_million:
            threshold_vnd = float(tracked.whale_alert_threshold_million) * 1e6
            return threshold_vnd, 'user_custom'
    except Exception as exc:
        logger.debug('resolve_user_whale_threshold_vnd error: %s', exc)
    
    default_threshold = float(getattr(settings, 'DOMAIN_WHALE_THRESHOLD_MILLION_VND', 5.0)) * 1e6
    return default_threshold, 'domain_default'


def dataframe_has_threshold_hits(df, threshold_vnd: float) -> bool:
    """
    Check if dataframe has matched_value rows exceeding threshold.
    
    Args:
        df: DataFrame with matched_value column
        threshold_vnd: Threshold in VND
        
    Returns:
        True if any row matched_value >= threshold, False otherwise
    """
    if df is None or df.empty:
        return False
    
    try:
        if 'matched_value' in df.columns:
            values = df['matched_value'].fillna(0)
            return (values >= threshold_vnd).any()
    except Exception as exc:
        logger.debug('dataframe_has_threshold_hits error: %s', exc)
    
    return False

import base64
import hashlib
import json
import logging
import math
import os
import re
from collections import defaultdict
from datetime import date, datetime, time, timedelta
from decimal import Decimal

from django.conf import settings
from django.core.cache import cache
from django.db.models import Case, ExpressionWrapper, F, FloatField, Max, Min, Q, When
from django.utils import timezone

from .adapters.cache_adapter import (
    get_cache,
    is_rate_limited_error,
    is_vnstock_rate_limited,
    mark_vnstock_rate_limited,
    set_cache,
)
from .adapters.vnstock_adapter import (
    fetch_financial_ratio_dataframe,
    fetch_history_dataframe,
    fetch_intraday_dataframe,
    fetch_listing_symbols_dataframe,
    fetch_price_board_dataframe,
    fetch_price_depth_dataframe,
    read_stream_intraday_ticks,
)
from .baseline_service import BaselineService
from .domain_constants import (
    WHALE_AGGREGATE_VNSTOCK_MAX_SYMBOLS_DEFAULT,
    WHALE_CONFIG_VERSION,
    classify_whale_size_class,
    resolve_user_whale_threshold_vnd,
)
from .exceptions import ExternalSystemException, MarketDataValidationException
from .market_calendar import resolve_market_phase
from .models import (
    DailyPrice,
    IntradayTick,
    OrderFlowSignal,
    SecuritiesGroup,
    SecuritiesItem,
    StockProfile,
    TickerSessionClose,
    TrackedSymbol,
    UserConfig,
    WatchlistGroup,
    WatchlistItem,
)
from .observability import (
    record_intraday_freshness_observation,
    record_market_external_timeout,
    record_market_fallback,
)
from .permissions import resolve_user_entitlements
from .price_units import PriceSource, normalize_quote_price_to_canonical
from .services import get_price_changes
from .runtime_policy_helpers import _get_runtime_prefetch_time_policy
from .whale_scoring import calculate_display_score, calculate_event_score, resolve_whale_score_config


logger = logging.getLogger(__name__)
PREFETCH_ENQUEUE_LOCK_KEY = 'ticker:prefetch:enqueue:lock'
ONDEMAND_TICKER_LOCK_PREFIX = 'ticker:ondemand:lock'


class MarketDataService:
    _CHART_TIMEFRAME_TO_INTERVAL = {
        '1m': '1m',
        '5m': '5m',
        '15m': '15m',
        '1H': '1H',
        '2H': '2H',
        '4H': '4H',
        'D': '1D',
        'W': '1W',
        'M': '1M',
        # Provider does not guarantee 1Y candles; fallback to monthly to keep long-range behavior.
        'Y': '1M',
    }

    _INTRADAY_LOOKBACK_DAYS_CAP = {
        '1m': 5,
        '5m': 20,
        '15m': 60,
        '1H': 180,
        '2H': 365,
        '4H': 730,
    }

    def _normalize_chart_timeframe(self, timeframe) -> str:
        value = str(timeframe or '1H').strip()
        value_lower = value.lower()
        minute_frames = {'1m': '1m', '5m': '5m', '15m': '15m'}
        if value_lower in minute_frames:
            return minute_frames[value_lower]
        upper_value = value.upper()
        if upper_value in self._CHART_TIMEFRAME_TO_INTERVAL:
            return upper_value
        return '1H'

    def _normalize_chart_timestamp(self, raw_value):
        if raw_value is None:
            return None
        if isinstance(raw_value, datetime):
            return raw_value
        if isinstance(raw_value, date):
            return datetime.combine(raw_value, time.min)
        text_value = str(raw_value).strip()
        if not text_value:
            return None
        try:
            # Accept both date-only and datetime-like strings.
            return datetime.fromisoformat(text_value.replace('Z', '+00:00'))
        except ValueError:
            try:
                return datetime.fromisoformat(text_value[:10])
            except ValueError:
                return None

    def _resolve_chart_lookback_days(self, timeframe: str, requested_days: int) -> int:
        cap = self._INTRADAY_LOOKBACK_DAYS_CAP.get(timeframe)
        if cap is None:
            return requested_days
        return min(requested_days, cap)

    def normalize_symbol(self, symbol: str) -> str:
        normalized_symbol = str(symbol or '').strip().upper()
        if not normalized_symbol or len(normalized_symbol) > 10:
            raise MarketDataValidationException('Thiếu mã chứng khoán.')
        return normalized_symbol

    def normalize_page_size(self, page_size) -> int:
        try:
            resolved_page_size = int(page_size or 50)
        except (ValueError, TypeError):
            resolved_page_size = 50
        return max(10, min(200, resolved_page_size))

    def _intraday_last_good_cache_key(self, symbol: str) -> str:
        return f'intraday:last_good:{self.normalize_symbol(symbol)}'

    def _intraday_vn30_cache_key(self, symbol: str) -> str:
        return f'intraday:is_vn30:{self.normalize_symbol(symbol)}'

    def _is_vn30_symbol(self, symbol: str) -> bool:
        normalized_symbol = self.normalize_symbol(symbol)
        cache_key = self._intraday_vn30_cache_key(normalized_symbol)
        cached_flag = get_cache(cache_key)
        if isinstance(cached_flag, bool):
            return cached_flag

        is_vn30 = SecuritiesItem.objects.filter(
            symbol=normalized_symbol,
            group__group_type=SecuritiesGroup.GroupType.MARKET_CAP,
            group__name__icontains='VN30',
        ).exists()
        set_cache(cache_key, is_vn30, timeout=300)
        return is_vn30

    def _resolve_intraday_stale_threshold_seconds(self, symbol: str) -> int:
        default_threshold = max(int(getattr(settings, 'INTRADAY_STALE_MAX_SECONDS_DEFAULT', 15) or 15), 1)
        vn30_threshold = max(int(getattr(settings, 'INTRADAY_STALE_MAX_SECONDS_VN30', 10) or 10), 1)
        return vn30_threshold if self._is_vn30_symbol(symbol) else default_threshold

    def _parse_intraday_event_datetime(self, raw_value, fallback_date: date | None = None) -> datetime | None:
        if raw_value is None:
            return None

        parsed_dt: datetime | None = None
        if isinstance(raw_value, datetime):
            parsed_dt = raw_value
        elif isinstance(raw_value, date):
            parsed_dt = datetime.combine(raw_value, time.min)
        else:
            text_value = str(raw_value).strip()
            if not text_value:
                return None

            try:
                parsed_dt = datetime.fromisoformat(text_value.replace('Z', '+00:00'))
            except ValueError:
                parsed_dt = None

            if parsed_dt is None and len(text_value) <= 8 and ':' in text_value:
                for fmt in ('%H:%M:%S', '%H:%M'):
                    try:
                        parsed_time = datetime.strptime(text_value, fmt).time()
                        parsed_dt = datetime.combine(fallback_date or timezone.localdate(), parsed_time)
                        break
                    except ValueError:
                        continue

        if parsed_dt is None:
            return None
        if timezone.is_naive(parsed_dt):
            parsed_dt = timezone.make_aware(parsed_dt, timezone.get_current_timezone())
        return timezone.localtime(parsed_dt)

    def _to_intraday_event_iso(self, raw_value, fallback_date: date | None = None) -> str | None:
        event_dt = self._parse_intraday_event_datetime(raw_value, fallback_date=fallback_date)
        return event_dt.isoformat() if event_dt is not None else None

    def _resolve_intraday_stream_source_event_at(self, stream_ticks: list[dict]) -> str | None:
        latest_dt = None
        for tick in stream_ticks or []:
            event_dt = self._parse_intraday_event_datetime(tick.get('ts'))
            if event_dt is None:
                continue
            if latest_dt is None or event_dt > latest_dt:
                latest_dt = event_dt
        return latest_dt.isoformat() if latest_dt is not None else None

    def _resolve_intraday_dataframe_source_event_at(self, df) -> str | None:
        latest_dt = None
        fallback_date = timezone.localdate()
        for _, row in df.iterrows():
            raw_time = row.get('time') or row.get('tradingDate') or row.get('date') or ''
            event_dt = self._parse_intraday_event_datetime(raw_time, fallback_date=fallback_date)
            if event_dt is None:
                continue
            if latest_dt is None or event_dt > latest_dt:
                latest_dt = event_dt
        return latest_dt.isoformat() if latest_dt is not None else None

    def _decorate_intraday_response_contract(self, payload: dict, symbol: str) -> dict:
        normalized_symbol = self.normalize_symbol(symbol)
        enriched = dict(payload or {})
        served_at_dt = timezone.now()
        market_clock = self._get_market_clock_context()
        market_phase = str(market_clock.get('profile') or 'offhours').lower()
        is_session_hold_phase = market_phase in {'lunch_break', 'offhours', 'post_close', 'pre_open'}
        source_event_dt = self._parse_intraday_event_datetime(enriched.get('source_event_at'))
        if source_event_dt is None:
            source_event_dt = self._parse_intraday_event_datetime(enriched.get('fetched_at'))

        age_seconds = None
        if source_event_dt is not None:
            age_seconds = max(0, int((served_at_dt - source_event_dt).total_seconds()))

        stale_threshold_seconds = self._resolve_intraday_stale_threshold_seconds(normalized_symbol)
        is_stale = bool(enriched.get('stale'))
        if is_session_hold_phase:
            is_stale = False
        stale_over_threshold = is_stale and age_seconds is not None and age_seconds > stale_threshold_seconds

        enriched['symbol'] = normalized_symbol
        enriched['source_event_at'] = source_event_dt.isoformat() if source_event_dt is not None else None
        enriched['served_at'] = served_at_dt.isoformat()
        enriched['age_seconds'] = age_seconds
        enriched['stale_threshold_seconds'] = stale_threshold_seconds
        enriched['stale'] = is_stale
        enriched['stale_over_threshold'] = stale_over_threshold
        enriched['market_phase'] = enriched.get('market_phase') or market_phase
        if not enriched.get('fetched_at'):
            enriched['fetched_at'] = enriched['served_at']

        record_intraday_freshness_observation(
            source=enriched.get('source'),
            age_seconds=age_seconds,
            stale=is_stale,
            stale_over_threshold=stale_over_threshold,
            realtime_refresh_trigger=stale_over_threshold,
        )
        return enriched

    def _build_intraday_stale_payload(self, payload: dict, symbol: str, reason: str) -> dict:
        source_payload = dict(payload or {})
        source_payload.pop('served_at', None)
        source_payload.pop('age_seconds', None)
        source_payload.pop('stale_over_threshold', None)
        source_payload.pop('stale_threshold_seconds', None)
        fetched_at = source_payload.get('fetched_at') or timezone.now().isoformat()
        source_event_at = source_payload.get('source_event_at') or fetched_at
        return {
            **source_payload,
            'symbol': self.normalize_symbol(symbol),
            'source': f'stale_cache:{reason}',
            'stale': True,
            'fallback_reason': reason,
            'fetched_at': fetched_at,
            'source_event_at': source_event_at,
        }

    def _select_preferred_intraday_fallback(self, symbol: str, last_good: dict | None, db_payload: dict | None) -> dict | None:
        if not isinstance(last_good, dict) or not (last_good.get('trades') or []):
            return db_payload
        if db_payload is None:
            return last_good

        symbol_normalized = self.normalize_symbol(symbol)
        now_dt = timezone.now()
        threshold_seconds = self._resolve_intraday_stale_threshold_seconds(symbol_normalized)

        last_good_event_dt = self._parse_intraday_event_datetime(
            last_good.get('source_event_at') or last_good.get('fetched_at')
        )
        db_event_dt = self._parse_intraday_event_datetime(
            db_payload.get('source_event_at') or db_payload.get('fetched_at')
        )

        last_good_age = None
        if last_good_event_dt is not None:
            last_good_age = max(0, int((now_dt - last_good_event_dt).total_seconds()))

        db_age = None
        if db_event_dt is not None:
            db_age = max(0, int((now_dt - db_event_dt).total_seconds()))

        if db_event_dt is not None and last_good_event_dt is None:
            return db_payload
        if db_event_dt is not None and last_good_event_dt is not None and db_event_dt > last_good_event_dt:
            return db_payload
        if last_good_age is not None and last_good_age > threshold_seconds:
            if db_age is None:
                return db_payload
            if db_age <= threshold_seconds or db_age < last_good_age:
                return db_payload
        return last_good

    def _build_intraday_db_fallback(self, symbol: str, page_size: int, reason: str) -> dict | None:
        normalized_symbol = self.normalize_symbol(symbol)
        today = timezone.localdate()
        rows = list(
            IntradayTick.objects.filter(symbol=normalized_symbol, trade_date=today)
            .order_by('-trade_time', '-id')[:page_size]
        )

        if not rows:
            latest = (
                IntradayTick.objects.filter(symbol=normalized_symbol)
                .order_by('-trade_date', '-trade_time', '-id')
                .values('trade_date')
                .first()
            )
            latest_trade_date = latest.get('trade_date') if latest else None
            if latest_trade_date is None:
                return None
            rows = list(
                IntradayTick.objects.filter(symbol=normalized_symbol, trade_date=latest_trade_date)
                .order_by('-trade_time', '-id')[:page_size]
            )

        trades = []
        latest_event_dt = None
        for row in rows:
            side_raw = str(row.side or '').upper()
            side = 'buy' if side_raw == 'BUY' else ('sell' if side_raw == 'SELL' else 'neutral')
            event_dt = self._parse_intraday_event_datetime(
                datetime.combine(row.trade_date, row.trade_time or time.min)
            )
            if event_dt is not None and (latest_event_dt is None or event_dt > latest_event_dt):
                latest_event_dt = event_dt
            trades.append(
                {
                    'time': row.trade_time.strftime('%H:%M:%S') if row.trade_time else '',
                    'price': float(row.price) if row.price is not None else None,
                    'volume': int(row.volume) if row.volume is not None else None,
                    'side': side,
                    'match_type': row.match_type or side_raw,
                }
            )

        if not trades:
            return None

        return {
            'symbol': normalized_symbol,
            'trades': trades,
            'total': len(trades),
            'source': f'intraday_db:{reason}',
            'stale': True,
            'fallback_reason': reason,
            'fetched_at': timezone.now().isoformat(),
            'source_event_at': latest_event_dt.isoformat() if latest_event_dt is not None else None,
        }

    def _get_market_clock_context(self) -> dict:
        policy = _get_runtime_prefetch_time_policy()
        resolved = resolve_market_phase(policy)
        return {
            'profile': resolved.get('profile', 'offhours'),
            'timezone': resolved.get('timezone', 'Asia/Ho_Chi_Minh'),
            'market_code': resolved.get('market_code', 'VN_STOCK'),
            'supported_timezones': list(resolved.get('supported_timezones') or [resolved.get('timezone', 'Asia/Ho_Chi_Minh')]),
        }

    def get_realtime_tickers(self, symbols: list[str]) -> dict:
        """Batch version of get_realtime_ticker."""
        if not symbols:
            return {}
            
        normalized_symbols = [self.normalize_symbol(s) for s in symbols if s]
        if not normalized_symbols:
            return {}
            
        market_clock = self._get_market_clock_context()
        market_phase = market_clock.get('profile')
        market_code = market_clock.get('market_code')
        supported_timezones = market_clock.get('supported_timezones') or [market_clock.get('timezone')]
        is_offhours_like = market_phase in {'offhours', 'post_close', 'pre_open'}
        
        # 1. Fetch from cache in one go
        cache_keys = [f'ticker:{s}' for s in normalized_symbols]
        cached_data_map = cache.get_many(cache_keys)
        
        results = {}
        freshness_threshold = max(int(getattr(settings, 'TICKER_FRESHNESS_SECONDS', 15) or 15), 1)
        stale_serve_seconds = max(int(getattr(settings, 'TICKER_STALE_SERVE_SECONDS', 90) or 90), 1)
        served_at = timezone.now().isoformat()
        
        for symbol in normalized_symbols:
            cached_ticker = cached_data_map.get(f'ticker:{symbol}')
            
            if cached_ticker and isinstance(cached_ticker, dict):
                payload = dict(cached_ticker)
                last_date = payload.get('last_date')
                freshness_seconds = None
                
                if last_date:
                    try:
                        last_dt = datetime.fromisoformat(str(last_date))
                        now_dt = timezone.now().astimezone(last_dt.tzinfo) if last_dt.tzinfo else datetime.now()
                        freshness_seconds = max(int((now_dt - last_dt).total_seconds()), 0)
                    except (TypeError, ValueError):
                        freshness_seconds = None
                        
                if freshness_seconds is None:
                    freshness_seconds = stale_serve_seconds + 1
                    
                is_stale = False if is_offhours_like and payload.get('current_price') is not None else (freshness_seconds > freshness_threshold)
                payload.update({
                    'freshness_seconds': freshness_seconds,
                    'stale': is_stale,
                    'served_at': served_at,
                    'market_phase': payload.get('market_phase') or market_phase,
                    'market_code': payload.get('market_code') or market_code,
                    'supported_timezones': supported_timezones,
                })
                results[symbol] = payload
            else:
                # Cache miss for this symbol - we'll handle it during hydration or polling rotations
                # but for simplicity in batch API, we return what it would have returned if called individually
                if is_offhours_like:
                    session_close_payload = self._resolve_latest_session_close(symbol, market_code)
                    if session_close_payload:
                        session_close_payload.update({
                            'served_at': served_at,
                            'market_phase': market_phase,
                            'market_code': market_code,
                            'supported_timezones': supported_timezones,
                            'data_semantic': 'last_session_close'
                        })
                        results[symbol] = session_close_payload
                        continue
                
                # Full cache miss / degraded fallback
                results[symbol] = {
                    'symbol': symbol,
                    'current_price': None,
                    'source': 'cache_miss_batch',
                    'stale': True,
                    'served_at': served_at,
                    'market_phase': market_phase,
                    'market_code': market_code,
                }
                
        return results

    def _resolve_latest_session_close(self, symbol: str, market_code: str) -> dict | None:
        row = (
            TickerSessionClose.objects
            .filter(symbol=symbol, market_code=market_code)
            .order_by('-session_date', '-captured_at')
            .first()
        )
        if row is None:
            return None
        return {
            'symbol': symbol,
            'current_price': float(row.close_price) if row.close_price is not None else None,
            'prev_price': float(row.prev_close_price) if row.prev_close_price is not None else None,
            'change_value': float(row.change_value) if row.change_value is not None else None,
            'change_pct': float(row.change_pct) if row.change_pct is not None else None,
            'open_price': float(row.open_price) if row.open_price is not None else None,
            'high_price': float(row.high_price) if row.high_price is not None else None,
            'low_price': float(row.low_price) if row.low_price is not None else None,
            'volume': int(row.volume) if row.volume is not None else None,
            'last_date': row.captured_at.isoformat() if row.captured_at else None,
            'session_date': row.session_date.isoformat(),
            'source': 'session_close_store',
            'cache_state': 'session_close',
            'stale': False,
            'freshness_seconds': 0,
        }

    def get_realtime_ticker(self, symbol: str) -> dict:
        normalized_symbol = self.normalize_symbol(symbol)
        market_clock = self._get_market_clock_context()
        market_phase = market_clock.get('profile')
        market_code = market_clock.get('market_code')
        supported_timezones = market_clock.get('supported_timezones') or [market_clock.get('timezone')]
        is_offhours_like = market_phase in {'offhours', 'post_close', 'pre_open'}
        try:
            ticker_cache_key = f'ticker:{normalized_symbol}'
            cached_ticker = get_cache(ticker_cache_key)
            if cached_ticker is not None:
                if not isinstance(cached_ticker, dict):
                    logger.warning('ticker cache payload invalid type for %s: %s', normalized_symbol, type(cached_ticker).__name__)
                    cached_ticker = None

            if cached_ticker is not None:
                freshness_threshold = max(int(getattr(settings, 'TICKER_FRESHNESS_SECONDS', 15) or 15), 1)
                stale_serve_seconds = max(int(getattr(settings, 'TICKER_STALE_SERVE_SECONDS', 90) or 90), 1)
                served_at = timezone.now().isoformat()

                payload = dict(cached_ticker)
                last_date = payload.get('last_date')
                freshness_seconds = None

                if last_date:
                    try:
                        last_dt = datetime.fromisoformat(str(last_date))
                        if last_dt.tzinfo is not None:
                            now_dt = timezone.now().astimezone(last_dt.tzinfo)
                        else:
                            now_dt = datetime.now()
                        freshness_seconds = max(int((now_dt - last_dt).total_seconds()), 0)
                    except (TypeError, ValueError):
                        freshness_seconds = None

                if freshness_seconds is None:
                    freshness_seconds = stale_serve_seconds + 1

                is_stale = False if is_offhours_like and payload.get('current_price') is not None else (freshness_seconds > freshness_threshold)
                payload['freshness_seconds'] = freshness_seconds
                payload['stale'] = is_stale
                current_source = str(payload.get('source') or '').strip().lower()
                if not current_source or current_source == 'prefetch':
                    current_source = 'stale_cache' if is_stale else 'cache'
                payload['source'] = current_source
                payload['cache_state'] = 'stale' if is_stale else ('session_close' if is_offhours_like else 'fresh')
                payload['served_at'] = served_at
                payload['market_phase'] = payload.get('market_phase') or market_phase
                payload['market_code'] = payload.get('market_code') or market_code
                payload['supported_timezones'] = supported_timezones
                return payload

            if is_offhours_like:
                session_close_payload = self._resolve_latest_session_close(normalized_symbol, market_code)
                if session_close_payload is not None:
                    session_close_payload['served_at'] = timezone.now().isoformat()
                    session_close_payload['market_phase'] = market_phase
                    session_close_payload['market_code'] = market_code
                    session_close_payload['supported_timezones'] = supported_timezones
                    session_close_payload['data_semantic'] = 'last_session_close'
                    return session_close_payload

            price_info = get_price_changes([normalized_symbol]).get(normalized_symbol, {})
            last_date = price_info.get('last_date')
            freshness_seconds = None
            stale = not is_offhours_like

            if last_date:
                try:
                    last_dt = datetime.fromisoformat(str(last_date))
                    if last_dt.tzinfo is not None:
                        now_dt = timezone.now().astimezone(last_dt.tzinfo)
                    else:
                        now_dt = datetime.now()
                    freshness_seconds = max(int((now_dt - last_dt).total_seconds()), 0)
                    stale = freshness_seconds > 30
                except (TypeError, ValueError):
                    freshness_seconds = None
                    stale = True

            latest_dp = (
                DailyPrice.objects
                .filter(symbol=normalized_symbol)
                .order_by('-date')
                .values('open_price', 'high_price', 'low_price', 'volume')
                .first()
            )
            ohlc_extra = {}
            if latest_dp:
                ohlc_extra = {
                    'open_price': float(latest_dp['open_price']) if latest_dp['open_price'] is not None else None,
                    'high_price': float(latest_dp['high_price']) if latest_dp['high_price'] is not None else None,
                    'low_price': float(latest_dp['low_price']) if latest_dp['low_price'] is not None else None,
                    'volume': int(latest_dp['volume']) if latest_dp['volume'] is not None else None,
                }

            degraded_payload = {
                'symbol': normalized_symbol,
                **price_info,
                **ohlc_extra,
                'freshness_seconds': freshness_seconds,
                'stale': stale,
                'source': 'cache_miss_degraded',
                'cache_state': 'miss',
                'fallback_reason': 'cache_miss_no_realtime_tick',
                'served_at': timezone.now().isoformat(),
                'market_phase': market_phase,
                'market_code': market_code,
                'supported_timezones': supported_timezones,
                'data_semantic': 'last_session_close' if is_offhours_like else 'realtime_or_stale',
            }

            allow_degraded = bool(getattr(settings, 'TICKER_CACHE_MISS_ALLOW_DEGRADED', False))
            if allow_degraded:
                return degraded_payload

            record_market_fallback('ticker-cache-only', 'cache_miss')
            raise ExternalSystemException(
                'Không có snapshot ticker trong cache. Vui lòng thử lại sau vài giây.',
                code='ticker_cache_miss',
                payload=degraded_payload,
            )
        except ExternalSystemException:
            raise
        except Exception as exc:
            logger.exception('Unexpected realtime ticker failure for %s: %s', normalized_symbol, exc)
            return {
                'symbol': normalized_symbol,
                'current_price': None,
                'prev_price': None,
                'change_value': None,
                'change_pct': None,
                'last_date': None,
                'freshness_seconds': None,
                'stale': True,
                'source': 'realtime_ticker_error_degraded',
                'cache_state': 'error',
                'fallback_reason': 'unexpected_internal_error',
                'served_at': timezone.now().isoformat(),
                'market_phase': market_phase,
                'market_code': market_code,
                'supported_timezones': supported_timezones,
                'data_semantic': 'realtime_or_stale',
                'detail': 'ticker_internal_error_degraded',
            }

    def get_intraday_matched(self, symbol: str, page_size=None) -> dict:
        normalized_symbol = self.normalize_symbol(symbol)
        resolved_page_size = self.normalize_page_size(page_size)
        cache_key = f'intraday:{normalized_symbol}:{resolved_page_size}'
        last_good_key = self._intraday_last_good_cache_key(normalized_symbol)
        cached = get_cache(cache_key)
        if cached is not None:
            return self._decorate_intraday_response_contract(cached, normalized_symbol)

        def _fallback_payload(reason: str, rate_limited: bool = False) -> dict | None:
            last_good = get_cache(last_good_key)
            db_payload = self._build_intraday_db_fallback(normalized_symbol, resolved_page_size, reason)
            preferred_payload = self._select_preferred_intraday_fallback(normalized_symbol, last_good, db_payload)
            if preferred_payload is not None:
                if preferred_payload is db_payload:
                    payload = dict(db_payload)
                    if rate_limited:
                        payload['rate_limited'] = True
                    set_cache(cache_key, payload, timeout=8)
                    set_cache(last_good_key, payload, timeout=900)
                    return payload

                stale_payload = self._build_intraday_stale_payload(preferred_payload, normalized_symbol, reason)
                if rate_limited:
                    stale_payload['rate_limited'] = True
                set_cache(cache_key, stale_payload, timeout=5)
                return stale_payload
            return None

        if is_vnstock_rate_limited('intraday'):
            record_market_fallback('intraday-matched', 'vnstock_backoff')
            fallback = _fallback_payload('vnstock_backoff', rate_limited=True)
            if fallback is not None:
                return self._decorate_intraday_response_contract(fallback, normalized_symbol)
            return self._decorate_intraday_response_contract(self._build_intraday_backoff_response(normalized_symbol), normalized_symbol)

        stream_ticks = read_stream_intraday_ticks(normalized_symbol, count=resolved_page_size)
        trades = self._build_stream_trades(stream_ticks)
        if trades:
            source_event_at = self._resolve_intraday_stream_source_event_at(stream_ticks)
            fetched_at = timezone.now().isoformat()
            result = {
                'symbol': normalized_symbol,
                'trades': trades,
                'total': len(trades),
                'source': 'stream',
                'stale': False,
                'fetched_at': fetched_at,
                'source_event_at': source_event_at or fetched_at,
            }
            set_cache(cache_key, result, timeout=8)
            set_cache(last_good_key, result, timeout=900)
            return self._decorate_intraday_response_contract(result, normalized_symbol)

        try:
            df = fetch_intraday_dataframe(normalized_symbol, resolved_page_size)
        except ExternalSystemException as exc:
            if exc.code == 'vnstock_rate_limited':
                mark_vnstock_rate_limited('intraday', exc)
                record_market_fallback('intraday-matched', 'vnstock_backoff')
                fallback = _fallback_payload('vnstock_backoff', rate_limited=True)
                if fallback is not None:
                    return self._decorate_intraday_response_contract(fallback, normalized_symbol)
                return self._decorate_intraday_response_contract(self._build_intraday_backoff_response(normalized_symbol), normalized_symbol)
            if exc.code == 'vnstock_timeout':
                record_market_external_timeout('intraday-matched')
                fallback = _fallback_payload('timeout')
                if fallback is not None:
                    return self._decorate_intraday_response_contract(fallback, normalized_symbol)
                return self._decorate_intraday_response_contract({
                    'symbol': normalized_symbol,
                    'trades': [],
                    'total': 0,
                    'source': 'timeout',
                    'fetched_at': timezone.now().isoformat(),
                    'source_event_at': None,
                }, normalized_symbol)
            if exc.code == 'vnstock_missing':
                raise exc
            record_market_fallback('intraday-matched', 'vnstock_unavailable')
            fallback = _fallback_payload('vnstock_unavailable')
            if fallback is not None:
                return self._decorate_intraday_response_contract(fallback, normalized_symbol)
            return self._decorate_intraday_response_contract({
                'symbol': normalized_symbol,
                'trades': [],
                'total': 0,
                'source': 'vnstock_unavailable',
                'fetched_at': timezone.now().isoformat(),
                'source_event_at': None,
            }, normalized_symbol)
        except Exception as exc:
            logger.warning('get_intraday_matched unexpected error %s: %s', normalized_symbol, exc)
            record_market_fallback('intraday-matched', 'error')
            fallback = _fallback_payload('error')
            if fallback is not None:
                return self._decorate_intraday_response_contract(fallback, normalized_symbol)
            return self._decorate_intraday_response_contract({
                'symbol': normalized_symbol,
                'trades': [],
                'total': 0,
                'source': 'error',
                'fetched_at': timezone.now().isoformat(),
                'source_event_at': None,
            }, normalized_symbol)

        if df is None or df.empty:
            fallback = _fallback_payload('empty')
            if fallback is not None:
                return self._decorate_intraday_response_contract(fallback, normalized_symbol)
            return self._decorate_intraday_response_contract({
                'symbol': normalized_symbol,
                'trades': [],
                'total': 0,
                'fetched_at': timezone.now().isoformat(),
                'source_event_at': None,
            }, normalized_symbol)

        trades = self._build_dataframe_trades(df)
        source_event_at = self._resolve_intraday_dataframe_source_event_at(df)
        fetched_at = timezone.now().isoformat()
        result = {
            'symbol': normalized_symbol,
            'trades': trades,
            'total': len(trades),
            'source': 'vnstock',
            'stale': False,
            'fetched_at': fetched_at,
            'source_event_at': source_event_at or fetched_at,
        }
        set_cache(cache_key, result, timeout=8)
        set_cache(last_good_key, result, timeout=900)
        return self._decorate_intraday_response_contract(result, normalized_symbol)

    def get_price_board(self, symbol: str) -> dict:
        normalized_symbol = self.normalize_symbol(symbol)
        cache_key = f'price_board:{normalized_symbol}'
        cached = get_cache(cache_key)
        if cached is not None:
            return cached

        if is_vnstock_rate_limited('price_board'):
            record_market_fallback('price-board', 'vnstock_backoff')
            return {
                'symbol': normalized_symbol,
                'depth': [],
                'match': {},
                'source': 'vnstock_backoff',
                'rate_limited': True,
            }

        try:
            df = fetch_price_depth_dataframe(normalized_symbol)
        except ExternalSystemException as exc:
            if exc.code == 'vnstock_rate_limited':
                mark_vnstock_rate_limited('price_board', exc)
                record_market_fallback('price-board', 'vnstock_backoff')
                return {
                    'symbol': normalized_symbol,
                    'depth': [],
                    'match': {},
                    'source': 'vnstock_backoff',
                    'rate_limited': True,
                }
            if exc.code == 'vnstock_timeout':
                record_market_external_timeout('price-board')
                return {
                    'symbol': normalized_symbol,
                    'depth': [],
                    'match': {},
                    'source': 'timeout',
                    'fetched_at': timezone.now().isoformat(),
                }
            if exc.code == 'vnstock_missing':
                raise exc
            record_market_fallback('price-board', 'vnstock_unavailable')
            return {
                'symbol': normalized_symbol,
                'depth': [],
                'match': {},
                'source': 'vnstock_unavailable',
                'fetched_at': timezone.now().isoformat(),
            }
        except Exception as exc:
            logger.warning('get_price_board unexpected error %s: %s', normalized_symbol, exc)
            record_market_fallback('price-board', 'error')
            return {
                'symbol': normalized_symbol,
                'depth': [],
                'match': {},
                'source': 'error',
                'fetched_at': timezone.now().isoformat(),
            }

        if df is None or df.empty:
            return {'symbol': normalized_symbol, 'depth': [], 'match': {}}

        try:
            bid_ask = df['bid_ask'].iloc[0]
            match = df['match'].iloc[0]
        except Exception as exc:
            logger.warning('get_price_board malformed payload %s: %s', normalized_symbol, exc)
            record_market_fallback('price-board', 'payload_invalid')
            return {
                'symbol': normalized_symbol,
                'depth': [],
                'match': {},
                'source': 'payload_invalid',
                'fetched_at': timezone.now().isoformat(),
            }

        depth = []
        raw_price_candidates = [
            self._safe_float(match.get('reference_price')),
            self._safe_float(match.get('match_price')),
            self._safe_float(match.get('open_price')),
            self._safe_float(match.get('highest')),
            self._safe_float(match.get('lowest')),
        ]
        for level in range(1, 4):
            raw_price_candidates.append(self._safe_float(bid_ask.get(f'bid_{level}_price')))
            raw_price_candidates.append(self._safe_float(bid_ask.get(f'ask_{level}_price')))
        price_scale = self._resolve_quote_price_scale(raw_price_candidates)

        for level in range(1, 4):
            raw_bid_price = self._safe_float(bid_ask.get(f'bid_{level}_price'))
            bid_price = self._normalize_quote_price(raw_bid_price, price_scale)
            bid_volume = self._safe_int(bid_ask.get(f'bid_{level}_volume'))
            
            raw_ask_price = self._safe_float(bid_ask.get(f'ask_{level}_price'))
            ask_price = self._normalize_quote_price(raw_ask_price, price_scale)
            ask_volume = self._safe_int(bid_ask.get(f'ask_{level}_volume'))
            
            if bid_price is not None or ask_price is not None:
                depth.append(
                    {
                        'level': level,
                        'bid_price': bid_price,
                        'bid_volume': bid_volume,
                        'ask_price': ask_price,
                        'ask_volume': ask_volume,
                    }
                )

        raw_reference_price = self._safe_float(match.get('reference_price'))
        raw_match_price = self._safe_float(match.get('match_price'))
        reference_price = self._normalize_quote_price(raw_reference_price, price_scale)
        match_price = self._normalize_quote_price(raw_match_price, price_scale)
        
        change_pct = None
        if reference_price and match_price:
            change_pct = round((match_price - reference_price) / reference_price * 100, 2)

        result = {
            'symbol': normalized_symbol,
            'depth': depth,
            'match': {
                'match_price': match_price,
                'open_price': self._normalize_quote_price(self._safe_float(match.get('open_price')), price_scale),
                'highest': self._normalize_quote_price(self._safe_float(match.get('highest')), price_scale),
                'lowest': self._normalize_quote_price(self._safe_float(match.get('lowest')), price_scale),
                'reference_price': reference_price,
                'accumulated_volume': self._safe_int(match.get('accumulated_volume')),
                'foreign_buy_volume': self._safe_int(match.get('foreign_buy_volume')),
                'foreign_sell_volume': self._safe_int(match.get('foreign_sell_volume')),
                'change_pct': change_pct,
            },
            'fetched_at': timezone.now().isoformat(),
        }
        set_cache(cache_key, result, timeout=8)
        return result

    def get_sector_breadth(self, symbol: str) -> dict:
        normalized_symbol = self.normalize_symbol(symbol)
        cache_key = f'breadth:{normalized_symbol}'
        cached = get_cache(cache_key)
        if cached is not None:
            return cached

        group_items = (
            SecuritiesItem.objects
            .filter(symbol=normalized_symbol)
            .select_related('group')
            .order_by('group__order', 'group__name')[:5]
        )

        if not group_items.exists():
            return {
                'symbol': normalized_symbol,
                'groups': [],
                'fetched_at': timezone.now().isoformat(),
            }

        groups_meta = []
        all_symbols = set()
        for item in group_items:
            group = item.group
            peers = list(
                SecuritiesItem.objects
                .filter(group=group)
                .exclude(symbol=normalized_symbol)
                .values_list('symbol', flat=True)
                .order_by('order', 'symbol')[:14]
            )
            peers.insert(0, normalized_symbol)
            groups_meta.append({'id': group.id, 'name': group.name, 'symbols': peers})
            all_symbols.update(peers)

        price_map = {}
        missing_symbols = []
        for peer_symbol in list(all_symbols):
            cached_ticker = get_cache(f'ticker:{peer_symbol}')
            if cached_ticker:
                price_map[peer_symbol.upper()] = self._price_map_from_ticker_cache(cached_ticker)
            else:
                missing_symbols.append(peer_symbol)

        if missing_symbols:
            try:
                df = fetch_price_board_dataframe(missing_symbols, anchor_symbol=normalized_symbol)
            except ExternalSystemException as exc:
                logger.warning(
                    'SectorBreadthView refactor fallback error for %s (%d symbols): %s',
                    normalized_symbol,
                    len(missing_symbols),
                    exc.message,
                )
                df = None

            if df is not None and not df.empty:
                for _, row in df.iterrows():
                    peer_symbol = str(row.get(('listing', 'symbol')) or '').upper()
                    if not peer_symbol:
                        continue
                    price = self._safe_float(row.get(('match', 'match_price')))
                    reference_price = self._safe_float(row.get(('match', 'reference_price')))
                    price_map[peer_symbol] = self._build_price_status(price, reference_price)

        result_groups = []
        for group_meta in groups_meta:
            peers = []
            for peer_symbol in group_meta['symbols']:
                info = price_map.get(peer_symbol.upper(), {})
                peers.append(
                    {
                        'symbol': peer_symbol,
                        'price': info.get('price'),
                        'change_pct': info.get('change_pct'),
                        'status': info.get('status', 'flat'),
                        'is_self': peer_symbol == normalized_symbol,
                    }
                )
            result_groups.append({'name': group_meta['name'], 'peers': peers})

        result = {
            'symbol': normalized_symbol,
            'groups': result_groups,
            'fetched_at': timezone.now().isoformat(),
        }
        set_cache(cache_key, result, timeout=30)
        return result

    def get_rvol(self, symbol: str) -> dict:
        normalized_symbol = self.normalize_symbol(symbol)
        cache_key = f'rvol:{normalized_symbol}'
        cached = get_cache(cache_key)
        if cached is not None:
            return cached

        if is_vnstock_rate_limited('intraday'):
            return {
                'symbol': normalized_symbol,
                'buckets': [],
                'source': 'vnstock_backoff',
                'rate_limited': True,
                'baseline_mode': 'same_bucket_20_sessions',
                'baseline_sessions': 0,
                'source_event_at': None,
                'fetched_at': timezone.now().isoformat(),
            }

        provider_error = None
        current_source = 'vnstock'
        source_event_at = None
        current_bucket_map = defaultdict(float)

        try:
            df = fetch_intraday_dataframe(normalized_symbol, 500)
            source_event_at = self._resolve_intraday_dataframe_source_event_at(df)
        except ExternalSystemException as exc:
            if exc.code == 'vnstock_rate_limited':
                mark_vnstock_rate_limited('intraday', exc)
                return {
                    'symbol': normalized_symbol,
                    'buckets': [],
                    'source': 'vnstock_backoff',
                    'rate_limited': True,
                    'baseline_mode': 'same_bucket_20_sessions',
                    'baseline_sessions': 0,
                    'source_event_at': None,
                    'fetched_at': timezone.now().isoformat(),
                }
            provider_error = exc
            df = None

        if df is not None and not df.empty:
            for _, row in df.iterrows():
                raw_time = row.get('time') or row.get('tradingDate') or ''
                raw_volume = row.get('volume') or row.get('vol') or row.get('matchVolume') or 0
                event_dt = self._parse_intraday_event_datetime(raw_time, fallback_date=timezone.localdate())
                try:
                    volume = float(raw_volume)
                except (TypeError, ValueError):
                    continue
                if event_dt is None or volume <= 0:
                    continue
                bucket_dt = event_dt.replace(minute=(event_dt.minute // 15) * 15, second=0, microsecond=0)
                current_bucket_map[bucket_dt] += volume

        if not current_bucket_map:
            current_source = 'intraday_tick_db'
            db_current_rows = list(
                IntradayTick.objects
                .filter(symbol=normalized_symbol, trade_date=timezone.localdate())
                .values('trade_date', 'trade_time', 'volume')
            )
            for row in db_current_rows:
                event_dt = self._parse_intraday_event_datetime(
                    row.get('trade_time'),
                    fallback_date=row.get('trade_date') or timezone.localdate(),
                )
                try:
                    volume = float(row.get('volume') or 0)
                except (TypeError, ValueError):
                    continue
                if event_dt is None or volume <= 0:
                    continue
                bucket_dt = event_dt.replace(minute=(event_dt.minute // 15) * 15, second=0, microsecond=0)
                current_bucket_map[bucket_dt] += volume

            if current_bucket_map:
                source_event_at = max(current_bucket_map.keys()).isoformat()

        if not current_bucket_map:
            if provider_error is not None:
                if provider_error.code == 'vnstock_missing':
                    raise provider_error
                raise ExternalSystemException(
                    f'Không lấy được dữ liệu: {provider_error.message}',
                    code=provider_error.code,
                    payload=provider_error.payload,
                ) from provider_error
            return {
                'symbol': normalized_symbol,
                'buckets': [],
                'source': current_source,
                'baseline_mode': 'same_bucket_20_sessions',
                'baseline_sessions': 0,
                'source_event_at': source_event_at,
                'fetched_at': timezone.now().isoformat(),
            }

        historical_dates = list(
            IntradayTick.objects
            .filter(symbol=normalized_symbol, trade_date__lt=timezone.localdate())
            .order_by('-trade_date')
            .values_list('trade_date', flat=True)
            .distinct()[:20]
        )

        historical_slot_totals = defaultdict(float)
        if historical_dates:
            historical_rows = list(
                IntradayTick.objects
                .filter(symbol=normalized_symbol, trade_date__in=historical_dates)
                .values('trade_date', 'trade_time', 'volume')
            )
            for row in historical_rows:
                trade_date = row.get('trade_date')
                event_dt = self._parse_intraday_event_datetime(
                    row.get('trade_time'),
                    fallback_date=trade_date,
                )
                try:
                    volume = float(row.get('volume') or 0)
                except (TypeError, ValueError):
                    continue
                if trade_date is None or event_dt is None or volume <= 0:
                    continue
                bucket_dt = event_dt.replace(minute=(event_dt.minute // 15) * 15, second=0, microsecond=0)
                slot_key = bucket_dt.strftime('%H:%M')
                historical_slot_totals[(trade_date, slot_key)] += volume

        baseline_by_slot = {}
        slot_samples = {}
        grouped_baselines = defaultdict(list)
        for (_, slot_key), total_volume in historical_slot_totals.items():
            grouped_baselines[slot_key].append(total_volume)

        for slot_key, samples in grouped_baselines.items():
            if not samples:
                continue
            baseline_by_slot[slot_key] = float(sum(samples) / len(samples))
            slot_samples[slot_key] = len(samples)

        buckets = []
        for bucket_dt, volume in sorted(current_bucket_map.items(), key=lambda item: item[0]):
            time_str = bucket_dt.strftime('%H:%M')
            baseline_avg = baseline_by_slot.get(time_str)
            rvol = round(volume / baseline_avg, 2) if baseline_avg and baseline_avg > 0 else None
            buckets.append(
                {
                    'time': time_str,
                    'volume': int(volume),
                    'baseline_avg': int(round(baseline_avg)) if baseline_avg is not None else None,
                    'sma20': int(round(baseline_avg)) if baseline_avg is not None else None,
                    'baseline_sessions': int(slot_samples.get(time_str, 0)),
                    'rvol': rvol,
                    'is_spike': bool(rvol is not None and rvol >= 2.0),
                    'bucket_start_at': bucket_dt.isoformat(),
                }
            )

        result = {
            'symbol': normalized_symbol,
            'buckets': buckets,
            'source': current_source,
            'baseline_mode': 'same_bucket_20_sessions',
            'baseline_sessions': len(historical_dates),
            'source_event_at': source_event_at,
            'fetched_at': timezone.now().isoformat(),
        }
        set_cache(cache_key, result, timeout=20)
        return result

    def get_whale_feed(self, user, symbol: str) -> dict:
        import pandas as pd

        normalized_symbol = self.normalize_symbol(symbol)
        threshold_vnd, threshold_source = self._get_user_whale_threshold_with_source_vnd(user, symbol=normalized_symbol)
        score_config = resolve_whale_score_config()
        request_now = timezone.now()

        cache_key = f'whale_feed:{user.id}:{normalized_symbol}:{int(threshold_vnd)}'
        cached = get_cache(cache_key)
        if cached is not None:
            return cached

        stream_df = None
        stream_has_hits = False
        stream_ticks = read_stream_intraday_ticks(normalized_symbol, count=500)
        if stream_ticks:
            try:
                stream_df = pd.DataFrame([
                    {
                        'price': float(tick.get('price', 0)),
                        'volume': float(tick.get('volume', 0)),
                        'match_type': tick.get('side', 'UNKNOWN'),
                        'side': tick.get('side', 'UNKNOWN'),
                        'time': tick.get('ts', ''),
                    }
                    for tick in stream_ticks
                ])
                stream_has_hits = self._dataframe_has_threshold_hits(stream_df, threshold_vnd)
            except Exception:
                stream_df = None

        db_df = None
        db_has_hits = False
        if stream_df is None or stream_df.empty or not stream_has_hits:
            db_rows = list(
                IntradayTick.objects
                .filter(symbol=normalized_symbol, trade_date=timezone.localdate())
                .order_by('-trade_time', '-id')
                .values('trade_date', 'trade_time', 'price', 'volume', 'match_type', 'side')
            )
            if db_rows:
                db_df = pd.DataFrame([
                    {
                        'time': row['trade_time'].isoformat() if row.get('trade_time') else '',
                        'trade_date': row.get('trade_date'),
                        'price': float(row.get('price') or 0),
                        'volume': float(row.get('volume') or 0),
                        'match_type': row.get('side') or row.get('match_type') or 'UNKNOWN',
                        'side': row.get('side') or row.get('match_type') or 'UNKNOWN',
                    }
                    for row in db_rows
                ])
                db_has_hits = self._dataframe_has_threshold_hits(db_df, threshold_vnd)

        try:
            if stream_df is not None and not stream_df.empty and stream_has_hits:
                df = stream_df
                data_source = 'redis_stream'
            elif db_df is not None and not db_df.empty and db_has_hits:
                df = db_df
                data_source = 'intraday_tick_db'
            elif stream_df is not None and not stream_df.empty:
                df = stream_df
                data_source = 'redis_stream'
            elif db_df is not None and not db_df.empty:
                df = db_df
                data_source = 'intraday_tick_db'
            else:
                if is_vnstock_rate_limited('intraday'):
                    df = None
                    data_source = 'vnstock_backoff'
                else:
                    try:
                        df = fetch_intraday_dataframe(normalized_symbol, 500)
                        data_source = 'vnstock'
                    except ExternalSystemException as exc:
                        if exc.code == 'vnstock_rate_limited':
                            mark_vnstock_rate_limited('intraday', exc)
                            data_source = 'vnstock_backoff'
                        elif exc.code == 'vnstock_timeout':
                            data_source = 'timeout'
                        else:
                            data_source = 'unavailable'
                        df = None
        except Exception as exc:
            logger.warning('WhaleFeed refactor data-source selection error %s: %s', normalized_symbol, exc)
            df = None
            data_source = 'error'

        if data_source == 'redis_stream':
            source_event_at = self._resolve_intraday_stream_source_event_at(stream_ticks)
        elif df is not None and not df.empty:
            source_event_at = self._resolve_intraday_dataframe_source_event_at(df)
        else:
            source_event_at = None

        if df is None or df.empty:
            self._record_source_observability('whale-feed', data_source, primary_source='redis_stream')
            return self._build_empty_whale_feed_response(
                normalized_symbol,
                threshold_vnd,
                data_source,
                threshold_source=threshold_source,
                source_event_at=source_event_at,
            )

        orders = []
        total_buy_value = 0.0
        total_sell_value = 0.0
        shark_value = 0.0
        whale_value_total = 0.0
        small_value = 0.0
        seen_trade_keys = set()

        source_unit_hint = None
        if getattr(df, 'attrs', None):
            source_unit_hint = str(df.attrs.get('price_unit_canonical') or '').strip().upper() or None

        for _, row in df.iterrows():
            try:
                raw_price = self._normalize_intraday_price_vnd(
                    row.get('price') or row.get('close') or 0,
                    source_unit=row.get('price_unit') or source_unit_hint,
                )
                raw_vol = float(row.get('volume') or row.get('vol') or row.get('matchVolume') or 0)
            except (ValueError, TypeError):
                continue
            if raw_price is None:
                continue
            matched_value = raw_price * raw_vol
            side = self._normalize_side(row.get('match_type') or row.get('matchType') or row.get('side') or '')
            raw_time = row.get('time') or row.get('tradingDate') or ''
            occurred_dt = self._parse_intraday_event_datetime(raw_time, fallback_date=row.get('trade_date'))
            occurred_key = occurred_dt.strftime('%Y-%m-%dT%H:%M:%S%z') if occurred_dt is not None else str(raw_time)
            trade_key = (
                occurred_key,
                int(round(float(raw_price or 0))),
                int(float(raw_vol or 0)),
                side,
            )
            if trade_key in seen_trade_keys:
                continue
            seen_trade_keys.add(trade_key)

            size_class = self._classify_signal_size(matched_value)

            if size_class == 'shark':
                shark_value += matched_value
            elif size_class == 'whale':
                whale_value_total += matched_value
            else:
                small_value += matched_value

            if side == 'buy':
                total_buy_value += matched_value
            elif side == 'sell':
                total_sell_value += matched_value

            if matched_value >= threshold_vnd:
                orders.append(
                    self._build_whale_order_payload(
                        raw_time=raw_time,
                        raw_price=raw_price,
                        raw_vol=raw_vol,
                        matched_value=matched_value,
                        side=side,
                        size_class=size_class,
                        threshold_vnd=threshold_vnd,
                        threshold_source=threshold_source,
                        score_config=score_config,
                        now=request_now,
                        fallback_date=row.get('trade_date'),
                    )
                )

        orders.sort(key=lambda item: item['matched_value'], reverse=True)
        total_value = shark_value + whale_value_total + small_value
        unknown_value = max(0.0, total_value - total_buy_value - total_sell_value)
        result = {
            'symbol': normalized_symbol,
            'threshold': threshold_vnd,
            'threshold_source': threshold_source,
            'source': data_source,
            'weights_version': score_config['version'],
            'whale_orders': orders[:50],
            'summary': {
                'buy_value': total_buy_value,
                'sell_value': total_sell_value,
                'unknown_value': unknown_value,
                'total_value': total_value,
                'flow_net': total_buy_value - total_sell_value,
                'shark_value': shark_value,
                'whale_value': whale_value_total,
                'small_value': small_value,
                'buy_pct': round(total_buy_value / total_value * 100, 1) if total_value > 0 else 0,
                'sell_pct': round(total_sell_value / total_value * 100, 1) if total_value > 0 else 0,
                'unknown_pct': round(unknown_value / total_value * 100, 1) if total_value > 0 else 0,
                'shark_pct': round(shark_value / total_value * 100, 1) if total_value > 0 else 0,
                'whale_pct': round(whale_value_total / total_value * 100, 1) if total_value > 0 else 0,
                'small_pct': round(small_value / total_value * 100, 1) if total_value > 0 else 0,
            },
            'source_event_at': source_event_at,
            'fetched_at': timezone.now().isoformat(),
        }
        self._record_source_observability('whale-feed', data_source, primary_source='redis_stream')
        set_cache(cache_key, result, timeout=20)
        return result

    def get_whale_feed_aggregate(self, user, query_params) -> dict:
        threshold_vnd = self._get_user_whale_threshold_vnd(user)
        entitlements = resolve_user_entitlements(user)
        score_config = resolve_whale_score_config()
        request_now = timezone.now()

        symbols, scope, watchlist_group_ids, scope_source = self._resolve_whale_feed_symbols(user, query_params)
        symbol_threshold_overrides = self._get_user_symbol_threshold_overrides_vnd(user, symbols)

        def _resolve_threshold_for_symbol(resolved_symbol: str) -> float:
            return symbol_threshold_overrides.get(str(resolved_symbol or '').strip().upper(), threshold_vnd)

        min_threshold_vnd = min([_resolve_threshold_for_symbol(symbol) for symbol in symbols], default=threshold_vnd)
        limit = self._parse_limit(query_params.get('limit', 20))
        sort = self._parse_sort(query_params.get('sort', 'ts'))
        window = self._parse_aggregate_window(query_params.get('window', 'session'))
        cursor_payload = self._decode_whale_feed_cursor(query_params.get('cursor'))

        if query_params.get('cursor') and cursor_payload is None:
            raise MarketDataValidationException('cursor không hợp lệ.')
        if cursor_payload is not None:
            cursor_sort = str(cursor_payload.get('sort', '')).strip().lower()
            if cursor_sort and cursor_sort != sort:
                raise MarketDataValidationException('cursor không hợp lệ cho sort hiện tại.')
            cursor_window = str(cursor_payload.get('window', 'session')).strip().lower() or 'session'
            if cursor_window != window:
                raise MarketDataValidationException('cursor không hợp lệ cho window hiện tại.')

        if not symbols:
            if cursor_payload is not None:
                raise MarketDataValidationException('cursor không hợp lệ.')
            return self._build_empty_aggregate_response(
                threshold_vnd=threshold_vnd,
                entitlements=entitlements,
                weights_version=score_config['version'],
                scope=scope,
                scope_source=scope_source,
                symbols=[],
                watchlist_group_ids=watchlist_group_ids,
                sort=sort,
                window=window,
                limit=limit,
                source='intraday_tick_db',
            )

        stream_records = self._build_stream_aggregate_records(symbols, min_threshold_vnd)
        if stream_records:
            stream_records = [
                record for record in stream_records
                if (
                    float(record.get('matched_value') or 0.0) >= _resolve_threshold_for_symbol(record.get('symbol'))
                    and self._is_event_timestamp_in_window(record.get('ts'), window, now=request_now)
                )
            ]
        if stream_records:
            normalized_records, ok = self._normalize_aggregate_event_records(
                stream_records,
                sort=sort,
                cursor_payload=cursor_payload,
            )
            if not ok:
                raise MarketDataValidationException('cursor không hợp lệ.')
            self._record_source_observability('whale-feed-aggregate', 'redis_stream', primary_source='redis_stream')
            return self._build_aggregate_record_response(
                normalized_records=normalized_records,
                source='redis_stream',
                threshold_vnd=threshold_vnd,
                threshold_resolver=_resolve_threshold_for_symbol,
                entitlements=entitlements,
                weights_version=score_config['version'],
                scope=scope,
                scope_source=scope_source,
                symbols=symbols,
                watchlist_group_ids=watchlist_group_ids,
                sort=sort,
                window=window,
                limit=limit,
                score_config=score_config,
                now=request_now,
            )

        queryset = (
            IntradayTick.objects
            .filter(symbol__in=symbols)
            .annotate(
                matched_value=ExpressionWrapper(
                    Case(
                        # Legacy rows may store price in VND; canonical rows are THOUSAND_VND.
                        When(price__gte=1000, then=F('price') * F('volume')),
                        default=F('price') * 1000 * F('volume'),
                        output_field=FloatField(),
                    ),
                    output_field=FloatField(),
                )
            )
        )

        # Push per-symbol threshold filtering down to SQL to avoid Python-side full scans.
        symbol_threshold_filter = Q()
        for symbol in symbols:
            symbol_threshold_filter |= Q(
                symbol=symbol,
                matched_value__gte=_resolve_threshold_for_symbol(symbol),
            )
        queryset = queryset.filter(symbol_threshold_filter)

        # Apply precise window bounds in SQL using (trade_date, trade_time) to avoid post-filter loops.
        resolved_now_local = timezone.localtime(request_now)
        window_start = self._window_start_datetime(window, now=request_now)
        if window_start is not None:
            window_start_local = timezone.localtime(window_start)
            queryset = queryset.filter(
                Q(trade_date__gt=window_start_local.date()) |
                Q(trade_date=window_start_local.date(), trade_time__gte=window_start_local.time())
            )
        queryset = queryset.filter(
            Q(trade_date__lt=resolved_now_local.date()) |
            Q(trade_date=resolved_now_local.date(), trade_time__lte=resolved_now_local.time())
        )

        if sort == 'matched_value':
            if cursor_payload is not None:
                parsed_cursor = self._parse_cursor_matched_value(cursor_payload)
                if parsed_cursor is None:
                    raise MarketDataValidationException('cursor không hợp lệ.')
                cursor_value, cursor_id = parsed_cursor
                queryset = queryset.filter(
                    Q(matched_value__lt=cursor_value) |
                    Q(matched_value=cursor_value, id__lt=cursor_id)
                )
            queryset = queryset.order_by('-matched_value', '-id')
        else:
            if cursor_payload is not None:
                parsed_cursor = self._parse_cursor_datetime(cursor_payload)
                if parsed_cursor is None:
                    raise MarketDataValidationException('cursor không hợp lệ.')
                cursor_date, cursor_time, cursor_id = parsed_cursor
                queryset = queryset.filter(
                    Q(trade_date__lt=cursor_date) |
                    Q(trade_date=cursor_date, trade_time__lt=cursor_time) |
                    Q(trade_date=cursor_date, trade_time=cursor_time, id__lt=cursor_id)
                )
            queryset = queryset.order_by('-trade_date', '-trade_time', '-id')

        page_rows_with_probe = list(queryset[:limit + 1])
        has_more = len(page_rows_with_probe) > limit
        page_rows = page_rows_with_probe[:limit]

        if not page_rows:
            try:
                vnstock_records = self._build_vnstock_aggregate_records(symbols, min_threshold_vnd)
            except ExternalSystemException:
                vnstock_records = []
            if vnstock_records:
                vnstock_records = [
                    record for record in vnstock_records
                    if (
                        float(record.get('matched_value') or 0.0) >= _resolve_threshold_for_symbol(record.get('symbol'))
                        and self._is_event_timestamp_in_window(record.get('ts'), window, now=request_now)
                    )
                ]
            normalized_records, ok = self._normalize_aggregate_event_records(
                vnstock_records,
                sort=sort,
                cursor_payload=cursor_payload,
            )
            if not ok:
                raise MarketDataValidationException('cursor không hợp lệ.')
            self._record_source_observability(
                'whale-feed-aggregate',
                'vnstock' if normalized_records else 'intraday_tick_db',
                primary_source='redis_stream',
            )
            return self._build_aggregate_record_response(
                normalized_records=normalized_records,
                source='vnstock' if normalized_records else 'intraday_tick_db',
                threshold_vnd=threshold_vnd,
                threshold_resolver=_resolve_threshold_for_symbol,
                entitlements=entitlements,
                weights_version=score_config['version'],
                scope=scope,
                scope_source=scope_source,
                symbols=symbols,
                watchlist_group_ids=watchlist_group_ids,
                sort=sort,
                window=window,
                limit=limit,
                score_config=score_config,
                now=request_now,
            )

        next_cursor = None
        if has_more and page_rows:
            next_cursor = self._build_next_cursor_from_db_row(page_rows[-1], sort, window=window)

        results = [
            self._build_aggregate_event_payload(
                row,
                _resolve_threshold_for_symbol(getattr(row, 'symbol', '')),
                score_config=score_config,
                now=request_now,
            )
            for row in page_rows
        ]
        self._record_source_observability('whale-feed-aggregate', 'intraday_tick_db', primary_source='redis_stream')
        return self._build_aggregate_response(
            results=results,
            next_cursor=next_cursor,
            has_more=has_more,
            source='intraday_tick_db',
            threshold_vnd=threshold_vnd,
            entitlements=entitlements,
            weights_version=score_config['version'],
            scope=scope,
            scope_source=scope_source,
            symbols=symbols,
            watchlist_group_ids=watchlist_group_ids,
            sort=sort,
            window=window,
            limit=limit,
        )

    def get_whale_campaigns(self, user, query_params) -> dict:
        aggregate_query = query_params.copy()
        aggregate_query.pop('cursor', None)
        aggregate_query.pop('campaign_limit', None)
        aggregate_query.pop('campaign_sort', None)
        aggregate_query.pop('campaign_gap_minutes', None)
        campaign_limit = self._parse_campaign_limit(query_params.get('campaign_limit', 25))
        campaign_sort = self._parse_campaign_sort(query_params.get('campaign_sort', 'strength'))
        campaign_cursor = self._decode_campaign_cursor(query_params.get('cursor'))
        max_gap_minutes = self._resolve_campaign_gap_minutes(
            window_raw=query_params.get('window', 'session'),
            gap_raw=query_params.get('campaign_gap_minutes'),
        )

        if query_params.get('cursor') and campaign_cursor is None:
            raise MarketDataValidationException('campaign cursor không hợp lệ.')
        if campaign_cursor is not None:
            cursor_sort = str(campaign_cursor.get('campaign_sort', '')).strip().lower()
            if cursor_sort and cursor_sort != campaign_sort:
                raise MarketDataValidationException('campaign cursor không hợp lệ cho campaign_sort hiện tại.')

        # Campaign grouping needs a wider event tape than default aggregate limit=20.
        if not aggregate_query.get('limit'):
            aggregate_query['limit'] = str(min(max(campaign_limit * 2, 30), 50))
        aggregate_query['sort'] = 'ts'

        aggregate_payload = self.get_whale_feed_aggregate(user, aggregate_query)
        events = aggregate_payload.get('results') or []
        campaigns = self._group_events_into_campaigns(events, max_gap_minutes=max_gap_minutes)

        if campaign_sort == 'latest':
            campaigns.sort(key=lambda item: item.get('last_event_at') or '', reverse=True)
        elif campaign_sort == 'value':
            campaigns.sort(key=lambda item: float(item.get('total_matched_value') or 0.0), reverse=True)
        else:
            campaigns.sort(key=lambda item: float(item.get('campaign_strength') or 0.0), reverse=True)

        if campaign_cursor is not None:
            campaigns = self._apply_campaign_cursor(campaigns, campaign_sort=campaign_sort, cursor_payload=campaign_cursor)

        has_more = len(campaigns) > campaign_limit
        campaign_rows = campaigns[:campaign_limit]
        next_cursor = None
        if has_more and campaign_rows:
            next_cursor = self._build_campaign_next_cursor(campaign_rows[-1], campaign_sort)

        if getattr(settings, 'BASELINE_CACHE_ENABLED', False) and campaign_rows:
            try:
                from portfolio.baseline_cache_service import enrich_campaign_with_baseline

                campaign_rows = [enrich_campaign_with_baseline(item) for item in campaign_rows]
            except Exception:
                # Baseline enrichment is best-effort and must not break campaign API.
                pass

        return {
            'results': campaign_rows,
            'next_cursor': next_cursor,
            'has_more': has_more,
            'server_time': timezone.now().isoformat(),
            'source': aggregate_payload.get('source', 'intraday_tick_db'),
            'weights_version': aggregate_payload.get('weights_version'),
            'filters': {
                **(aggregate_payload.get('filters') or {}),
                'campaign_limit': campaign_limit,
                'campaign_sort': campaign_sort,
                'campaign_gap_minutes': max_gap_minutes,
                'cursor': query_params.get('cursor') or None,
            },
            'meta': {
                'contract_version': '1.0',
                'campaign_count': len(campaign_rows),
                'has_more': has_more,
                'next_cursor': next_cursor,
            },
            'entitlements': aggregate_payload.get('entitlements', {}),
        }

    def _build_campaign_next_cursor(self, campaign_item: dict, campaign_sort: str) -> str:
        payload = {
            'campaign_sort': campaign_sort,
            'campaign_id': str(campaign_item.get('campaign_id') or ''),
        }
        if campaign_sort == 'latest':
            payload['last_event_at'] = str(campaign_item.get('last_event_at') or '')
        elif campaign_sort == 'value':
            payload['total_matched_value'] = float(campaign_item.get('total_matched_value') or 0.0)
        else:
            payload['campaign_strength'] = float(campaign_item.get('campaign_strength') or 0.0)

        raw = json.dumps(payload, separators=(',', ':')).encode('utf-8')
        return base64.urlsafe_b64encode(raw).decode('ascii')

    def _decode_campaign_cursor(self, raw_cursor: str | None) -> dict | None:
        if not raw_cursor:
            return None
        try:
            padded = raw_cursor + '=' * (-len(raw_cursor) % 4)
            decoded = base64.urlsafe_b64decode(padded.encode('ascii')).decode('utf-8')
            payload = json.loads(decoded)
            return payload if isinstance(payload, dict) else None
        except (ValueError, TypeError, json.JSONDecodeError):
            return None

    def _apply_campaign_cursor(self, campaigns: list[dict], campaign_sort: str, cursor_payload: dict) -> list[dict]:
        cursor_campaign_id = str(cursor_payload.get('campaign_id') or '')
        if not cursor_campaign_id:
            return []

        if campaign_sort == 'latest':
            cursor_ts = str(cursor_payload.get('last_event_at') or '')
            if not cursor_ts:
                return []
            return [
                item for item in campaigns
                if (
                    (str(item.get('last_event_at') or '') < cursor_ts)
                    or (
                        str(item.get('last_event_at') or '') == cursor_ts
                        and str(item.get('campaign_id') or '') < cursor_campaign_id
                    )
                )
            ]

        if campaign_sort == 'value':
            try:
                cursor_value = float(cursor_payload.get('total_matched_value'))
            except (TypeError, ValueError):
                return []
            return [
                item for item in campaigns
                if (
                    float(item.get('total_matched_value') or 0.0) < cursor_value
                    or (
                        float(item.get('total_matched_value') or 0.0) == cursor_value
                        and str(item.get('campaign_id') or '') < cursor_campaign_id
                    )
                )
            ]

        try:
            cursor_strength = float(cursor_payload.get('campaign_strength'))
        except (TypeError, ValueError):
            return []
        return [
            item for item in campaigns
            if (
                float(item.get('campaign_strength') or 0.0) < cursor_strength
                or (
                    float(item.get('campaign_strength') or 0.0) == cursor_strength
                    and str(item.get('campaign_id') or '') < cursor_campaign_id
                )
            )
        ]

    def _parse_campaign_limit(self, limit_raw) -> int:
        try:
            limit = int(limit_raw)
        except (TypeError, ValueError):
            raise MarketDataValidationException('campaign_limit phải là số nguyên trong khoảng [1, 100].')
        if limit < 1 or limit > 100:
            raise MarketDataValidationException('campaign_limit phải là số nguyên trong khoảng [1, 100].')
        return limit

    def _parse_campaign_sort(self, sort_raw) -> str:
        sort = str(sort_raw or 'strength').strip().lower()
        if sort not in {'strength', 'latest', 'value'}:
            raise MarketDataValidationException("campaign_sort không hợp lệ. Chỉ hỗ trợ: 'strength', 'latest', 'value'.")
        return sort

    def _resolve_campaign_gap_minutes(self, window_raw, gap_raw) -> int:
        window = self._parse_aggregate_window(window_raw)
        if gap_raw in (None, ''):
            default_by_window = {
                '5m': 3,
                '15m': 8,
                '1h': 20,
                'session': 45,
                '5d': 180,
            }
            return default_by_window.get(window, 45)
        try:
            gap = int(gap_raw)
        except (TypeError, ValueError):
            raise MarketDataValidationException('campaign_gap_minutes phải là số nguyên trong khoảng [1, 240].')
        if gap < 1 or gap > 240:
            raise MarketDataValidationException('campaign_gap_minutes phải là số nguyên trong khoảng [1, 240].')
        return gap

    def _group_events_into_campaigns(self, events: list[dict], max_gap_minutes: int) -> list[dict]:
        normalized_events = []
        for event in events:
            if not isinstance(event, dict):
                continue
            symbol = str(event.get('symbol') or '').strip().upper()
            side = str(event.get('side') or 'neutral').strip().lower() or 'neutral'
            ts_raw = event.get('ts')
            if not symbol or not ts_raw:
                continue
            try:
                ts_value = datetime.fromisoformat(str(ts_raw).replace('Z', '+00:00'))
            except Exception:
                continue
            if timezone.is_naive(ts_value):
                ts_value = timezone.make_aware(ts_value, timezone.get_current_timezone())
            normalized_events.append({
                'event': event,
                'symbol': symbol,
                'side': side,
                'ts': ts_value,
            })

        normalized_events.sort(key=lambda item: (item['symbol'], item['side'], item['ts']))

        clusters: list[list[dict]] = []
        for item in normalized_events:
            if not clusters:
                clusters.append([item])
                continue
            current_cluster = clusters[-1]
            last_item = current_cluster[-1]
            if item['symbol'] != last_item['symbol'] or item['side'] != last_item['side']:
                clusters.append([item])
                continue
            gap_seconds = (item['ts'] - last_item['ts']).total_seconds()
            if gap_seconds > max_gap_minutes * 60:
                clusters.append([item])
            else:
                current_cluster.append(item)

        campaigns = []
        for cluster in clusters:
            if not cluster:
                continue
            first_item = cluster[0]
            last_item = cluster[-1]
            symbol = first_item['symbol']
            side = first_item['side']
            cluster_events = [item['event'] for item in cluster]

            total_value = float(sum(float(event.get('matched_value') or 0.0) for event in cluster_events))
            avg_event_score = (
                sum(float(event.get('event_score') or 0.0) for event in cluster_events) / len(cluster_events)
                if cluster_events else 0.0
            )
            duration_seconds = max(int((last_item['ts'] - first_item['ts']).total_seconds()), 0)
            strength = min(
                100.0,
                round((len(cluster_events) * 8.0) + min(total_value / 1_000_000_000.0, 20.0) * 2.5 + avg_event_score * 0.45, 2),
            )

            campaign_seed = '|'.join([
                symbol,
                side,
                first_item['ts'].isoformat(),
                last_item['ts'].isoformat(),
                str(len(cluster_events)),
                str(round(total_value, 2)),
            ])
            campaign_id = f"camp:{hashlib.md5(campaign_seed.encode('utf-8')).hexdigest()[:16]}"

            if side == 'buy':
                campaign_type = 'accumulation'
            elif side == 'sell':
                campaign_type = 'distribution'
            else:
                campaign_type = 'mixed'

            events_payload = [
                {
                    'event_id': event.get('event_id'),
                    'symbol': event.get('symbol'),
                    'side': event.get('side'),
                    'ts': event.get('ts'),
                    'matched_value': event.get('matched_value'),
                    'source': event.get('source'),
                    'event_score': event.get('event_score'),
                    'display_score': event.get('display_score'),
                    'threshold_source': event.get('threshold_source'),
                    'size_class': event.get('size_class'),
                }
                for event in cluster_events
            ]

            source_mix = {}
            for event in cluster_events:
                source = str(event.get('source') or 'unknown')
                source_mix[source] = int(source_mix.get(source, 0)) + 1

            campaigns.append({
                'campaign_id': campaign_id,
                'contract_version': '1.0',
                'symbol': symbol,
                'side_bias': side,
                'campaign_type': campaign_type,
                'campaign_strength': strength,
                'event_count': len(cluster_events),
                'total_matched_value': round(total_value, 2),
                'avg_event_score': round(avg_event_score, 2),
                'duration_seconds': duration_seconds,
                'created_at': first_item['ts'].isoformat(),
                'last_event_at': last_item['ts'].isoformat(),
                'source_mix': source_mix,
                'events': events_payload,
            })

        return campaigns

    def get_depth_chart(self, symbol: str) -> dict:
        normalized_symbol = self.normalize_symbol(symbol)
        try:
            df = fetch_price_board_dataframe([normalized_symbol], anchor_symbol=normalized_symbol)
        except ExternalSystemException as exc:
            if exc.code == 'vnstock_missing':
                raise exc
            raise ExternalSystemException(
                f'Không lấy được dữ liệu: {exc.message}',
                code=exc.code,
                payload=exc.payload,
            ) from exc

        if df is None or df.empty:
            return {
                'symbol': normalized_symbol,
                'bids': [],
                'asks': [],
                'walls': [],
                'reference_price': None,
            }

        bid_ask = df['bid_ask'].iloc[0]
        match = df['match'].iloc[0]

        reference_price = self._safe_float(match.get('reference_price')) or 0
        ceiling_price = self._safe_float(match.get('ceiling_price')) or (reference_price * 1.07 if reference_price else None)
        floor_price = self._safe_float(match.get('floor_price')) or (reference_price * 0.93 if reference_price else None)

        bids = []
        cumulative_bid = 0
        for level in range(1, 4):
            bid_price = self._safe_float(bid_ask.get(f'bid_{level}_price'))
            bid_volume = self._safe_int(bid_ask.get(f'bid_{level}_volume'))
            if bid_price and bid_volume:
                cumulative_bid += bid_volume
                bids.append({'price': bid_price, 'volume': bid_volume, 'cumulative': cumulative_bid})

        asks = []
        cumulative_ask = 0
        for level in range(1, 4):
            ask_price = self._safe_float(bid_ask.get(f'ask_{level}_price'))
            ask_volume = self._safe_int(bid_ask.get(f'ask_{level}_volume'))
            if ask_price and ask_volume:
                cumulative_ask += ask_volume
                asks.append({'price': ask_price, 'volume': ask_volume, 'cumulative': cumulative_ask})

        all_volumes = [bid['volume'] for bid in bids] + [ask['volume'] for ask in asks]
        average_volume = sum(all_volumes) / len(all_volumes) if all_volumes else 1
        wall_threshold = average_volume * 2

        walls = []
        for bid in bids:
            if bid['volume'] >= wall_threshold:
                walls.append({
                    'side': 'bid',
                    'price': bid['price'],
                    'volume': bid['volume'],
                    'label': f'⚠️ TƯỜNG MUA: {bid["volume"]:,}',
                })
        for ask in asks:
            if ask['volume'] >= wall_threshold:
                walls.append({
                    'side': 'ask',
                    'price': ask['price'],
                    'volume': ask['volume'],
                    'label': f'⚠️ TƯỜNG BÁN: {ask["volume"]:,}',
                })

        return {
            'symbol': normalized_symbol,
            'reference_price': reference_price,
            'ceiling_price': ceiling_price,
            'floor_price': floor_price,
            'bids': bids,
            'asks': asks,
            'walls': walls,
            'fetched_at': timezone.now().isoformat(),
        }

    def get_financial_metrics(self, symbol: str) -> dict:
        normalized_symbol = self.normalize_symbol(symbol)
        cache_key = f'financials:{normalized_symbol}'
        cached = get_cache(cache_key)
        if cached is not None:
            return cached

        try:
            df = fetch_financial_ratio_dataframe(
                normalized_symbol,
                period='year',
                lang='vi',
                dropna=True,
                source=None,
            )
        except ExternalSystemException as exc:
            if exc.code == 'vnstock_missing':
                raise exc
            return {
                'symbol': normalized_symbol,
                'years': [],
                'source': 'vnstock_unavailable',
                'fetched_at': timezone.now().isoformat(),
            }
        except Exception as exc:
            logger.warning('get_financial_metrics unexpected error %s: %s', normalized_symbol, exc)
            return {
                'symbol': normalized_symbol,
                'years': [],
                'source': 'error',
                'fetched_at': timezone.now().isoformat(),
            }

        if df is None or df.empty:
            return {'symbol': normalized_symbol, 'years': []}

        def _parse_year(value):
            if value is None:
                return None
            try:
                return int(float(value))
            except (TypeError, ValueError):
                match = re.search(r'\d{4}', str(value))
                return int(match.group(0)) if match else None

        years = []
        try:
            for _, row in df.head(5).iterrows():
                year_value = row.get(('Meta', 'Năm')) or row.get('Năm') or row.get('year')
                years.append(
                    {
                        'year': _parse_year(year_value),
                    'eps': self._row_float(row, ('Chỉ tiêu định giá', 'EPS (VND)')),
                    'pe': self._row_float(row, ('Chỉ tiêu định giá', 'P/E')),
                    'pb': self._row_float(row, ('Chỉ tiêu định giá', 'P/B')),
                    'ps': self._row_float(row, ('Chỉ tiêu định giá', 'P/S')),
                    'bvps': self._row_float(row, ('Chỉ tiêu định giá', 'BVPS (VND)')),
                    'market_cap_bn': self._row_float(row, ('Chỉ tiêu định giá', 'Vốn hóa (Tỷ đồng)')),
                    'roe': self._row_float(row, ('Chỉ tiêu khả năng sinh lợi', 'ROE (%)')),
                    'roa': self._row_float(row, ('Chỉ tiêu khả năng sinh lợi', 'ROA (%)')),
                    'net_margin': self._row_float(row, ('Chỉ tiêu khả năng sinh lợi', 'Biên lợi nhuận ròng (%)')),
                    'dividend_yield': self._row_float(row, ('Chỉ tiêu khả năng sinh lợi', 'Tỷ suất cổ tức (%)')),
                    'leverage': self._row_float(row, ('Chỉ tiêu thanh khoản', 'Đòn bẩy tài chính')),
                    'current_ratio': self._row_float(row, ('Chỉ tiêu thanh khoản', 'Hệ số thanh toán hiện hành')),
                    'quick_ratio': self._row_float(row, ('Chỉ tiêu thanh khoản', 'Hệ số thanh toán nhanh')),
                    'debt_equity': self._row_float(row, ('Chỉ tiêu thanh khoản', 'Nợ/Vốn chủ sở hữu')),
                    }
                )
        except Exception as exc:
            logger.warning('get_financial_metrics parse error %s: %s', normalized_symbol, exc)
            return {
                'symbol': normalized_symbol,
                'years': [],
                'source': 'payload_invalid',
                'fetched_at': timezone.now().isoformat(),
            }

        result = {
            'symbol': normalized_symbol,
            'years': years,
            'source': str(getattr(df, 'attrs', {}).get('financial_ratio_source') or 'vnstock').strip().lower(),
            'fetched_at': timezone.now().isoformat(),
        }
        set_cache(cache_key, result, timeout=21600)
        return result

    def get_stock_workspace_overview(self, user, symbol: str) -> dict:
        normalized_symbol = self.normalize_symbol(symbol)
        cache_key = f'overview:{normalized_symbol}'
        cached = get_cache(cache_key)
        if cached is not None:
            return cached

        from .serializers import StockWorkspaceOverviewSerializer

        try:
            payload = self._build_stock_workspace_overview_base(normalized_symbol, user)
        except Exception as exc:
            logger.warning('StockWorkspaceOverview base payload lỗi %s: %s', normalized_symbol, exc)
            profile = StockProfile.objects.filter(symbol=normalized_symbol).first()
            if not profile:
                raise ExternalSystemException(
                    'Không tạo được dữ liệu tổng quan cổ phiếu.',
                    code='overview_payload_failed',
                ) from exc
            payload = {
                'tracked_symbol_id': None,
                'symbol': profile.symbol,
                'company_name': profile.company_name or '',
                'industry': profile.industry or '',
                'exchange': profile.exchange or '',
                'listed_date': profile.listed_date,
                'is_active': profile.is_active,
                'updated_at': profile.updated_at,
                'current_price': None,
                'prev_price': None,
                'change_value': None,
                'change_pct': None,
                'last_date': None,
                'open_price': None,
                'high_price': None,
                'low_price': None,
                'close_price': None,
                'volume': None,
                'average_price': None,
                'reference_price': None,
                'ceiling_price': None,
                'floor_price': None,
                'week52_high': None,
                'week52_low': None,
                'is_tracked': False,
                'source_group_name': None,
                'market_groups': [],
                'watchlist_groups': [],
                'market_group_refs': [],
                'watchlist_memberships': [],
            }

        try:
            df = fetch_price_board_dataframe([normalized_symbol], anchor_symbol=normalized_symbol)
            if df is not None and not df.empty:
                listing = df['listing'].iloc[0]
                match = df['match'].iloc[0]

                def _valid_float(value):
                    resolved = self._safe_float(value)
                    return resolved if resolved not in (None, 0) else None

                match_price = _valid_float(match.get('match_price'))
                reference_price = _valid_float(listing.get('ref_price')) or _valid_float(match.get('reference_price'))
                ceiling_price = _valid_float(listing.get('ceiling')) or _valid_float(match.get('ceiling_price'))
                floor_price = _valid_float(listing.get('floor')) or _valid_float(match.get('floor_price'))
                highest = _valid_float(match.get('highest'))
                lowest = _valid_float(match.get('lowest'))
                open_price = _valid_float(match.get('open_price'))
                accumulated_volume = self._safe_int(match.get('accumulated_volume'))
                exchange_raw = str(listing.get('exchange') or '').strip()

                if match_price:
                    payload['current_price'] = match_price
                    payload['close_price'] = match_price
                if reference_price:
                    payload['reference_price'] = reference_price
                    payload['prev_price'] = reference_price
                if ceiling_price:
                    payload['ceiling_price'] = ceiling_price
                if floor_price:
                    payload['floor_price'] = floor_price
                if highest:
                    payload['high_price'] = highest
                if lowest:
                    payload['low_price'] = lowest
                if open_price:
                    payload['open_price'] = open_price
                if accumulated_volume and accumulated_volume > 0:
                    payload['volume'] = accumulated_volume
                if exchange_raw and not payload.get('exchange'):
                    payload['exchange'] = exchange_raw

                if match_price and reference_price:
                    payload['change_value'] = round(match_price - reference_price, 2)
                    payload['change_pct'] = round((match_price - reference_price) / reference_price * 100, 2)

                prices = [value for value in [open_price, highest, lowest, match_price] if value]
                if len(prices) >= 2:
                    payload['average_price'] = round(sum(prices) / len(prices), 2)
        except ExternalSystemException as exc:
            logger.warning('StockWorkspaceOverview refactor price-board overlay lỗi %s: %s', normalized_symbol, exc)
        except Exception as exc:
            logger.debug('StockWorkspaceOverview refactor overlay parse lỗi %s: %s', normalized_symbol, exc)

        try:
            end_date = timezone.localdate().strftime('%Y-%m-%d')
            start_date = (timezone.localdate() - timedelta(days=365)).strftime('%Y-%m-%d')
            history_df = fetch_history_dataframe(
                normalized_symbol,
                start=start_date,
                end=end_date,
                interval='1D',
            )
            if history_df is not None and not history_df.empty and 'high' in history_df.columns:
                week52_high = self._normalize_historical_quote_price(history_df['high'].max(), normalized_symbol)
                week52_low = self._normalize_historical_quote_price(history_df['low'].min(), normalized_symbol)
                if week52_high > 0:
                    payload['week52_high'] = week52_high
                if week52_low > 0:
                    payload['week52_low'] = week52_low
        except ExternalSystemException as exc:
            logger.debug('StockWorkspaceOverview refactor 52W overlay lỗi %s: %s', normalized_symbol, exc)
        except Exception as exc:
            logger.debug('StockWorkspaceOverview refactor 52W parse lỗi %s: %s', normalized_symbol, exc)

        if not payload.get('company_name'):
            try:
                listing_df = fetch_listing_symbols_dataframe(symbol=normalized_symbol)
                if listing_df is not None and not listing_df.empty:
                    row = listing_df[listing_df['symbol'] == normalized_symbol]
                    if not row.empty:
                        company_name = str(row.iloc[0].get('organ_name') or '').strip()
                        if company_name:
                            payload['company_name'] = company_name
            except ExternalSystemException as exc:
                logger.debug('StockWorkspaceOverview refactor listing overlay lỗi %s: %s', normalized_symbol, exc)
            except Exception as exc:
                logger.debug('StockWorkspaceOverview refactor listing parse lỗi %s: %s', normalized_symbol, exc)

        serialized = StockWorkspaceOverviewSerializer(payload).data
        set_cache(cache_key, serialized, timeout=12)
        return serialized

    def get_stock_workspace_chart(self, user, symbol: str, days_raw, timeframe_raw=None) -> dict:
        normalized_symbol = self.normalize_symbol(symbol)
        try:
            days = int(days_raw or 180)
        except (TypeError, ValueError):
            days = 180
        days = min(max(days, 1), 3650)
        timeframe = self._normalize_chart_timeframe(timeframe_raw)
        interval = self._CHART_TIMEFRAME_TO_INTERVAL[timeframe]
        effective_days = self._resolve_chart_lookback_days(timeframe, days)

        end_date = timezone.localdate()
        start_date = end_date - timedelta(days=effective_days)

        cache_key = f'chart:{normalized_symbol}:{timeframe}:{effective_days}'
        cached = get_cache(cache_key)
        if cached is not None:
            return cached

        from .models import StockProfile
        from .serializers import (
            StockWorkspaceChartPointSerializer,
            StockWorkspaceChartResponseSerializer,
            StockWorkspaceTechnicalSerializer,
        )

        if not StockProfile.objects.filter(symbol=normalized_symbol).exists():
            raise MarketDataValidationException('Thiếu mã chứng khoán.')

        series = None
        technical_rows = None

        try:
            df = fetch_history_dataframe(
                normalized_symbol,
                start=str(start_date),
                end=str(end_date),
                interval=interval,
            )
            if df is not None and not df.empty:
                series = []
                for _, row in df.iterrows():
                    try:
                        raw_time = row.get('time', row.get('date', ''))
                        point_dt = self._normalize_chart_timestamp(raw_time)
                        if point_dt is None:
                            continue
                        normalized_open = self._normalize_historical_quote_price(row.get('open'), normalized_symbol)
                        normalized_high = self._normalize_historical_quote_price(row.get('high'), normalized_symbol)
                        normalized_low = self._normalize_historical_quote_price(row.get('low'), normalized_symbol)
                        normalized_close = self._normalize_historical_quote_price(row.get('close'), normalized_symbol)
                        if normalized_close is None:
                            continue
                        series.append(
                            {
                                'date': point_dt.isoformat(),
                                'open': normalized_open,
                                'high': normalized_high,
                                'low': normalized_low,
                                'close': normalized_close,
                                'volume': float(row['volume']) if row.get('volume') is not None else None,
                            }
                        )
                    except (TypeError, ValueError, KeyError):
                        continue
                technical_rows = [{'close_price': point['close'], 'volume': point['volume']} for point in series]
        except ExternalSystemException as exc:
            logger.warning('StockWorkspaceChart refactor vnstock lỗi %s: %s', normalized_symbol, exc)

        is_intraday_frame = timeframe in self._INTRADAY_LOOKBACK_DAYS_CAP

        if not series and not is_intraday_frame:
            db_rows = list(
                DailyPrice.objects
                .filter(symbol=normalized_symbol, date__range=(start_date, end_date))
                .order_by('date')
                .values('date', 'open_price', 'high_price', 'low_price', 'close_price', 'volume')
            )
            series = [
                {
                    'date': datetime.combine(row['date'], time.min).isoformat(),
                    'open': self._normalize_historical_quote_price(row['open_price'], normalized_symbol),
                    'high': self._normalize_historical_quote_price(row['high_price'], normalized_symbol),
                    'low': self._normalize_historical_quote_price(row['low_price'], normalized_symbol),
                    'close': self._normalize_historical_quote_price(row['close_price'], normalized_symbol),
                    'volume': self._to_float(row['volume']),
                }
                for row in db_rows
            ]
            technical_rows = [
                {
                    'close_price': point['close'],
                    'volume': point['volume'],
                }
                for point in series
                if point.get('close') is not None
            ]

        overview = self._build_stock_workspace_overview_base(normalized_symbol, user)
        payload = {
            'symbol': normalized_symbol,
            'days': effective_days,
            'timeframe': timeframe,
            'interval': interval,
            'start_date': str(start_date),
            'end_date': str(end_date),
            'points': StockWorkspaceChartPointSerializer(series, many=True).data,
            'technical': StockWorkspaceTechnicalSerializer(
                self._compute_stock_workspace_technical(technical_rows or [], overview)
            ).data,
        }

        # Do not silently return daily DB candles for intraday frames.
        # If provider fails or returns empty for intraday, keep points empty instead of misleading 1D candles.
        if is_intraday_frame and not payload['points']:
            payload['technical'] = StockWorkspaceTechnicalSerializer({
                'change_percent': None,
                'rsi_14': None,
                'macd': None,
                'macd_signal': None,
                'atr_14': None,
                'volatility_20': None,
                'volume_ratio': None,
            }).data

        result = StockWorkspaceChartResponseSerializer(payload).data
        set_cache(cache_key, result, timeout=3600)
        return result

    def _build_intraday_backoff_response(self, normalized_symbol: str) -> dict:
        return {
            'symbol': normalized_symbol,
            'trades': [],
            'total': 0,
            'source': 'vnstock_backoff',
            'rate_limited': True,
            'fetched_at': timezone.now().isoformat(),
            'source_event_at': None,
        }

    def _build_stream_trades(self, stream_ticks: list[dict]) -> list[dict]:
        parsed_rows = []
        for tick in stream_ticks:
            raw_time = tick.get('ts', '')
            time_str = self._format_time(raw_time)
            side = self._normalize_side(tick.get('side', 'UNKNOWN'))
            try:
                price_val = float(tick.get('price', 0)) or None
                volume_val = int(float(tick.get('volume', 0)))
            except (ValueError, TypeError):
                price_val = None
                volume_val = None
            if price_val is None or volume_val is None or volume_val <= 0:
                continue

            parsed_rows.append(
                {
                    'time': time_str,
                    'raw_price': price_val,
                    'volume': volume_val,
                    'side': side,
                    'match_type': tick.get('side', ''),
                }
            )

        if not parsed_rows:
            return []

        price_scale = self._resolve_quote_price_scale([row.get('raw_price') for row in parsed_rows])
        trades = []
        for row in parsed_rows:
            normalized_price = self._normalize_quote_price(row.get('raw_price'), price_scale)
            trades.append(
                {
                    'time': row['time'],
                    'price': normalized_price,
                    'volume': row['volume'],
                    'side': row['side'],
                    'match_type': row['match_type'],
                }
            )
        return trades

    def _format_time(self, raw_time) -> str:
        try:
            import pandas as pd
            from portfolio.system_settings import get_zoneinfo as _get_zoneinfo
            ts = pd.Timestamp(raw_time)
            if ts.tzinfo is None:
                ts = ts.tz_localize('UTC')
            ts = ts.tz_convert(_get_zoneinfo())
            return ts.strftime('%H:%M:%S')
        except Exception:
            return str(raw_time)[:8]

    def _normalize_side(self, side_value: str) -> str:
        side_raw = str(side_value or '').strip().lower()
        if side_raw in ('buy', 'bu', 'b'):
            return 'buy'
        if side_raw in ('sell', 'sd', 's'):
            return 'sell'
        return 'neutral'

    def _get_user_whale_threshold_vnd(self, user, symbol: str | None = None) -> float:
        base_config = UserConfig.objects.filter(user=user).values('whale_alert_threshold').first()
        base_threshold_vnd = resolve_user_whale_threshold_vnd((base_config or {}).get('whale_alert_threshold'))
        if not symbol:
            return base_threshold_vnd

        normalized_symbol = str(symbol or '').strip().upper()
        if not normalized_symbol:
            return base_threshold_vnd

        override = (
            TrackedSymbol.objects
            .filter(user=user, symbol=normalized_symbol)
            .values('whale_alert_threshold_million')
            .first()
        )
        if override and override.get('whale_alert_threshold_million') is not None:
            return resolve_user_whale_threshold_vnd(override.get('whale_alert_threshold_million'))
        return base_threshold_vnd

    def _get_user_whale_threshold_with_source_vnd(self, user, symbol: str | None = None) -> tuple[float, str]:
        base_config = UserConfig.objects.filter(user=user).values('whale_alert_threshold').first()
        base_threshold_vnd = resolve_user_whale_threshold_vnd((base_config or {}).get('whale_alert_threshold'))
        if not symbol:
            return base_threshold_vnd, 'user_default'

        normalized_symbol = str(symbol or '').strip().upper()
        if not normalized_symbol:
            return base_threshold_vnd, 'user_default'

        override = (
            TrackedSymbol.objects
            .filter(user=user, symbol=normalized_symbol)
            .values('whale_alert_threshold_million')
            .first()
        )
        if override and override.get('whale_alert_threshold_million') is not None:
            return resolve_user_whale_threshold_vnd(override.get('whale_alert_threshold_million')), 'symbol_override'
        return base_threshold_vnd, 'user_default'

    def _get_user_symbol_threshold_overrides_vnd(self, user, symbols: list[str] | None = None) -> dict[str, float]:
        queryset = TrackedSymbol.objects.filter(user=user, whale_alert_threshold_million__isnull=False)
        if symbols:
            normalized_symbols = [str(symbol).strip().upper() for symbol in symbols if str(symbol).strip()]
            queryset = queryset.filter(symbol__in=normalized_symbols)

        overrides = {}
        for row in queryset.values('symbol', 'whale_alert_threshold_million'):
            symbol = str(row.get('symbol') or '').strip().upper()
            if not symbol:
                continue
            overrides[symbol] = resolve_user_whale_threshold_vnd(row.get('whale_alert_threshold_million'))
        return overrides

    def _classify_signal_size(self, matched_value: float) -> str:
        return classify_whale_size_class(matched_value)

    def _record_source_observability(self, endpoint: str, source: str, primary_source: str) -> None:
        resolved_source = str(source or 'unknown')
        if resolved_source == 'timeout':
            record_market_external_timeout(endpoint)
        if resolved_source != str(primary_source):
            record_market_fallback(endpoint, resolved_source)

    def _build_whale_order_payload(
        self,
        *,
        raw_time,
        raw_price: float,
        raw_vol: float,
        matched_value: float,
        side: str,
        size_class: str,
        threshold_vnd: float,
        threshold_source: str = 'user_default',
        score_config: dict | None = None,
        now=None,
        fallback_date: date | None = None,
    ) -> dict:
        occurred_dt = self._parse_intraday_event_datetime(raw_time, fallback_date=fallback_date)
        if occurred_dt is None:
            resolved_now = now if isinstance(now, datetime) else timezone.now()
            occurred_dt = timezone.localtime(resolved_now)
        occurred_at = occurred_dt.isoformat()
        event_time_key = occurred_dt.strftime('%Y%m%dT%H%M%S')

        score_result = calculate_event_score(
            trade={
                'matched_value': matched_value,
                'threshold': threshold_vnd,
                'side': side,
            },
            context={
                'threshold_vnd': threshold_vnd,
                'side': side,
            },
            config=score_config,
        )
        display_result = calculate_display_score(
            event_score=score_result['event_score'],
            occurred_at=occurred_at,
            now=now,
            config=score_config,
        )

        time_str = occurred_dt.strftime('%H:%M:%S')
        event_id = f"whale:{side}:{event_time_key}:{int(round(float(raw_price or 0)))}:{int(float(raw_vol or 0))}"

        return {
            'event_id': event_id,
            'time': time_str,
            'ts': occurred_at,
            'price': raw_price,
            'volume': int(raw_vol),
            'matched_value': matched_value,
            'side': side,
            'size_class': size_class,
            'threshold_source': str(threshold_source or 'user_default'),
            'event_score': score_result['event_score'],
            'display_score': display_result['display_score'],
            'severity': display_result['severity'],
            'score_breakdown': score_result['score_breakdown'],
            'normalized_features': score_result['normalized_features'],
            'raw_features': score_result['raw_features'],
            'score_decay': {
                'age_seconds': display_result['age_seconds'],
                'decay_factor': display_result['decay_factor'],
            },
            'weights_version': score_result['weights_version'],
        }

    def _dataframe_has_threshold_hits(self, df, threshold_vnd: float) -> bool:
        if df is None or getattr(df, 'empty', True):
            return False

        source_unit_hint = None
        if getattr(df, 'attrs', None):
            source_unit_hint = str(df.attrs.get('price_unit_canonical') or '').strip().upper() or None
        
        for _, row in df.iterrows():
            try:
                raw_price = self._normalize_intraday_price_vnd(
                    row.get('price') or row.get('close') or 0,
                    source_unit=row.get('price_unit') or source_unit_hint,
                )
                raw_vol = float(row.get('volume') or row.get('vol') or row.get('matchVolume') or 0)
            except (ValueError, TypeError):
                continue
            if raw_price is None:
                continue
            if raw_price * raw_vol >= threshold_vnd:
                return True
        return False

    def _build_empty_whale_feed_response(
        self,
        symbol: str,
        threshold_vnd: float,
        data_source: str,
        threshold_source: str = 'user_default',
        source_event_at: str | None = None,
    ) -> dict:
        return {
            'symbol': symbol,
            'threshold': threshold_vnd,
            'threshold_source': str(threshold_source or 'user_default'),
            'source': data_source,
            'rate_limited': data_source in ('unavailable', 'timeout', 'vnstock_backoff'),
            'whale_orders': [],
            'summary': {
                'buy_value': 0,
                'sell_value': 0,
                'flow_net': 0,
                'shark_value': 0,
                'whale_value': 0,
                'small_value': 0,
                'shark_pct': 0,
                'whale_pct': 0,
                'small_pct': 0,
            },
            'source_event_at': source_event_at,
            'fetched_at': timezone.now().isoformat(),
        }

    def get_unified_alerts(self, user, query_params) -> dict:
        symbols, scope, watchlist_group_ids, scope_source = self._resolve_whale_feed_symbols(user, query_params)
        limit = self._parse_limit(query_params.get('limit', 20))
        window = self._parse_aggregate_window(query_params.get('window', 'session'))
        severity_min = self._parse_unified_severity_min(query_params.get('severity_min', 'low'))
        include_market_top_tier = self._parse_boolean_flag(
            query_params.get('include_market_top_tier'),
            default=True,
        )
        cursor_payload = self._decode_unified_alerts_cursor(query_params.get('cursor'))

        if query_params.get('cursor') and cursor_payload is None:
            raise MarketDataValidationException('cursor không hợp lệ cho unified alerts.')
        if cursor_payload is not None:
            if str(cursor_payload.get('window') or '') != window:
                raise MarketDataValidationException('cursor không hợp lệ cho window hiện tại.')
            if str(cursor_payload.get('severity_min') or '') != severity_min:
                raise MarketDataValidationException('cursor không hợp lệ cho severity_min hiện tại.')
        now = timezone.now()

        if not symbols and not include_market_top_tier:
            return {
                'results': [],
                'server_time': now.isoformat(),
                'filters': {
                    'scope': scope,
                    'scope_source': scope_source,
                    'symbols': [],
                    'watchlist_group_ids': watchlist_group_ids,
                    'window': window,
                    'limit': limit,
                    'severity_min': severity_min,
                },
                'next_cursor': None,
                'has_more': False,
                'meta': {
                    'contract_version': '2.0',
                    'source_mix': {
                        'whale': 0,
                        'dark_flow': 0,
                    },
                    'pagination': {
                        'limit': limit,
                        'has_more': False,
                        'next_cursor': None,
                    },
                },
            }

        whale_events = []
        if symbols:
            aggregate_limit = min(max(limit * 2, 20), 50)
            whale_payload = self.get_whale_feed_aggregate(
                user,
                {
                    'symbols': ','.join(symbols),
                    'sort': 'ts',
                    'window': window,
                    'limit': str(aggregate_limit),
                },
            )
            whale_events = whale_payload.get('results') or []

        whale_unified = []
        for event in whale_events:
            symbol = str(event.get('symbol') or '').upper()
            resolved_threshold = float(
                event.get('threshold')
                or self._get_user_whale_threshold_vnd(user, symbol=symbol)
                or 0.0
            )
            matched_value = float(event.get('matched_value') or 0.0)
            raw_severity = str(event.get('severity') or 'medium').lower()
            severity = 'critical' if raw_severity == 'extreme' else raw_severity
            if resolved_threshold > 0 and matched_value >= (resolved_threshold * 3.0):
                severity = 'critical'
            whale_unified.append({
                'event_id': event.get('event_id') or f"whale:{symbol}:{event.get('ts')}",
                'symbol': symbol,
                'source': 'whale',
                'severity': severity,
                'confidence': event.get('display_score'),
                'headline': 'Large buy flow detected' if str(event.get('side') or '').lower() == 'buy' else 'Large sell flow detected',
                'detail': f"Matched value: {round(matched_value, 2)}",
                'ts': event.get('ts') or now.isoformat(),
                'to': f"/whale-alerts/{event.get('symbol')}",
                'matched_value': matched_value,
                'threshold': resolved_threshold,
                'market_wide': False,
                'watchlist_symbol': True,
            })

        dark_flow_rows = []
        if symbols:
            window_start = self._window_start_datetime(window, now=now)
            dark_flow_qs = OrderFlowSignal.objects.filter(symbol__in=symbols)
            if window_start is not None:
                dark_flow_qs = dark_flow_qs.filter(created_at__gte=window_start)
            dark_flow_rows = list(dark_flow_qs.order_by('-created_at', '-id')[: max(limit * 3, 30)])

        dark_flow_unified = []
        for row in dark_flow_rows:
            confidence_text = str(row.confidence or '').lower()
            confidence_score = 80 if confidence_text == 'high' else 60 if confidence_text == 'medium' else 40
            if row.strength >= 80 or confidence_score >= 80:
                severity = 'critical'
            elif row.strength >= 65 or confidence_score >= 60:
                severity = 'high'
            else:
                severity = 'medium'

            dark_flow_unified.append({
                'event_id': row.event_id or f"dark_flow:{row.symbol}:{row.created_at.isoformat()}:{row.signal_type}",
                'symbol': str(row.symbol or '').upper(),
                'source': 'dark_flow',
                'severity': severity,
                'confidence': row.strength,
                'headline': 'Dark money signal detected',
                'detail': f"Signal {row.signal_type} | strength={round(float(row.strength or 0.0), 1)}",
                'ts': row.created_at.isoformat(),
                'to': f"/stocks/{row.symbol}",
                'market_wide': False,
                'watchlist_symbol': True,
            })

        market_top_tier_whales = []
        if include_market_top_tier:
            market_top_tier_whales = self._build_market_top_tier_whale_unified(
                user=user,
                window=window,
                now=now,
                limit=min(max(limit, 3), 10),
                exclude_symbols=symbols,
            )

        combined = whale_unified + dark_flow_unified + market_top_tier_whales
        min_rank = self._unified_severity_rank(severity_min)
        combined = [
            item for item in combined
            if self._unified_severity_rank(item.get('severity')) >= min_rank
        ]

        seen = set()
        deduped = []
        for item in combined:
            dedupe_key = item.get('event_id') or f"{item.get('source')}:{item.get('symbol')}:{item.get('headline')}"
            if dedupe_key in seen:
                continue
            seen.add(dedupe_key)
            item['_priority_rank'] = self._compute_unified_priority_rank(item=item, now=now)
            deduped.append(item)

        deduped.sort(
            key=lambda item: (
                int(item.get('_priority_rank') or 1),
                self._safe_parse_unified_alert_ts(item.get('ts')),
                str(item.get('event_id') or ''),
            ),
            reverse=True,
        )

        if cursor_payload is not None:
            cursor_rank = int(cursor_payload.get('priority_rank'))
            cursor_ts = self._safe_parse_unified_alert_ts(cursor_payload.get('ts'))
            cursor_event_id = str(cursor_payload.get('event_id') or '')
            filtered = []
            for item in deduped:
                item_rank = int(item.get('_priority_rank') or 1)
                item_ts = self._safe_parse_unified_alert_ts(item.get('ts'))
                item_event_id = str(item.get('event_id') or '')
                if item_rank < cursor_rank:
                    filtered.append(item)
                    continue
                if item_rank == cursor_rank and item_ts < cursor_ts:
                    filtered.append(item)
                    continue
                if item_rank == cursor_rank and item_ts == cursor_ts and item_event_id < cursor_event_id:
                    filtered.append(item)
            deduped = filtered

        has_more = len(deduped) > limit
        page_items = deduped[:limit]
        results = [self._sanitize_unified_alert_item(item) for item in page_items]
        next_cursor = self._build_unified_alerts_next_cursor(page_items[-1], window=window, severity_min=severity_min) if has_more and page_items else None
        payload = {
            'results': results,
            'server_time': now.isoformat(),
            'filters': {
                'scope': scope,
                'scope_source': scope_source,
                'symbols': symbols,
                'watchlist_group_ids': watchlist_group_ids,
                'window': window,
                'limit': limit,
                'severity_min': severity_min,
            },
            'next_cursor': next_cursor,
            'has_more': has_more,
            'meta': {
                'contract_version': '2.0',
                'source_mix': {
                    'whale': len([item for item in results if item.get('source') == 'whale']),
                    'dark_flow': len([item for item in results if item.get('source') == 'dark_flow']),
                },
                'market_top_tier': {
                    'enabled': include_market_top_tier,
                    'count': len([item for item in results if item.get('source') == 'whale' and item.get('market_wide') is True]),
                },
                'pagination': {
                    'limit': limit,
                    'has_more': has_more,
                    'next_cursor': next_cursor,
                },
            },
        }
        return payload

    def _parse_unified_severity_min(self, severity_raw) -> str:
        severity = str(severity_raw or 'low').strip().lower()
        if severity not in {'low', 'medium', 'high', 'critical'}:
            raise MarketDataValidationException("severity_min không hợp lệ. Chỉ hỗ trợ: 'low', 'medium', 'high', 'critical'.")
        return severity

    def _unified_severity_rank(self, severity: str | None) -> int:
        normalized = str(severity or '').strip().lower()
        if normalized == 'critical':
            return 4
        if normalized == 'high':
            return 3
        if normalized == 'medium':
            return 2
        return 1

    def _safe_parse_unified_alert_ts(self, ts_raw) -> datetime:
        if not ts_raw:
            return datetime.min.replace(tzinfo=timezone.utc)
        try:
            parsed = datetime.fromisoformat(str(ts_raw).replace('Z', '+00:00'))
            if timezone.is_naive(parsed):
                return timezone.make_aware(parsed, timezone.get_current_timezone())
            return parsed
        except Exception:
            return datetime.min.replace(tzinfo=timezone.utc)

    def _decode_unified_alerts_cursor(self, raw_cursor: str | None) -> dict | None:
        payload = self._decode_whale_feed_cursor(raw_cursor)
        if not payload:
            return None
        try:
            priority_rank = int(payload.get('priority_rank') or payload.get('severity_rank'))
            event_id = str(payload.get('event_id') or '')
            ts = str(payload.get('ts') or '')
            window = str(payload.get('window') or '')
            severity_min = str(payload.get('severity_min') or '')
        except (TypeError, ValueError):
            return None
        if priority_rank < 1 or priority_rank > 8:
            return None
        if not event_id or not ts or not window or not severity_min:
            return None
        return {
            'priority_rank': priority_rank,
            'event_id': event_id,
            'ts': ts,
            'window': window,
            'severity_min': severity_min,
        }

    def _build_unified_alerts_next_cursor(self, item: dict, *, window: str, severity_min: str) -> str:
        payload = {
            'priority_rank': int(item.get('_priority_rank') or self._compute_unified_priority_rank(item=item, now=timezone.now())),
            'event_id': str(item.get('event_id') or ''),
            'ts': str(item.get('ts') or ''),
            'window': str(window),
            'severity_min': str(severity_min),
        }
        return self._encode_whale_feed_cursor(payload)

    def _sanitize_unified_alert_item(self, item: dict) -> dict:
        sanitized = dict(item)
        for key in ('_priority_rank', 'matched_value', 'threshold'):
            sanitized.pop(key, None)
        return sanitized

    def _parse_boolean_flag(self, raw_value, *, default: bool = False) -> bool:
        if raw_value is None:
            return default
        normalized = str(raw_value).strip().lower()
        if normalized in {'1', 'true', 'yes', 'on'}:
            return True
        if normalized in {'0', 'false', 'no', 'off'}:
            return False
        return default

    def _compute_unified_priority_rank(self, item: dict, now=None) -> int:
        base_rank = self._unified_severity_rank(item.get('severity'))
        bonus = 0
        if bool(item.get('watchlist_symbol')):
            bonus += 2

        if str(item.get('source') or '') != 'whale':
            return min(base_rank + bonus, 8)

        threshold = float(item.get('threshold') or 0.0)
        matched_value = float(item.get('matched_value') or 0.0)
        ratio = (matched_value / threshold) if threshold > 0 else 0.0
        if ratio >= 3.0:
            bonus += 2
        elif ratio >= 1.5:
            bonus += 1

        resolved_now = now or timezone.now()
        event_ts = self._safe_parse_unified_alert_ts(item.get('ts'))
        try:
            age_seconds = max((resolved_now - event_ts).total_seconds(), 0.0)
        except Exception:
            age_seconds = 0.0

        if age_seconds <= 5 * 60:
            bonus += 1
        elif age_seconds <= 15 * 60 and ratio >= 1.0:
            bonus += 1

        return min(base_rank + bonus, 8)

    def _build_market_top_tier_whale_unified(
        self,
        *,
        user,
        window: str,
        now,
        limit: int,
        exclude_symbols: list[str] | None = None,
    ) -> list[dict]:
        base_threshold_vnd = float(self._get_user_whale_threshold_vnd(user) or 0.0)
        if base_threshold_vnd <= 0:
            return []

        try:
            tier_multiplier = float(os.getenv('UNIFIED_ALERTS_MARKET_TOP_TIER_MULTIPLIER', '5'))
        except (TypeError, ValueError):
            tier_multiplier = 5.0
        tier_multiplier = max(tier_multiplier, 3.0)
        market_tier_threshold = base_threshold_vnd * tier_multiplier

        try:
            market_cache_ttl = int(os.getenv('UNIFIED_ALERTS_MARKET_TOP_TIER_CACHE_SECONDS', '60'))
        except (TypeError, ValueError):
            market_cache_ttl = 60
        market_cache_ttl = max(market_cache_ttl, 5)

        candidate_limit = max(limit * 8, 20)
        cache_key = f"unified_alerts:market_top_tier:v2:w{window}:l{candidate_limit}:t{int(round(market_tier_threshold))}"
        cached_candidates = cache.get(cache_key)

        if cached_candidates is None:
            try:
                max_price_vnd = float(os.getenv('UNIFIED_ALERTS_MARKET_TOP_TIER_MAX_PRICE_VND', '500000'))
            except (TypeError, ValueError):
                max_price_vnd = 500_000.0
            max_price_vnd = max(max_price_vnd, 1_000.0)
            min_volume_for_scan = max(int(math.ceil(market_tier_threshold / max_price_vnd)), 1)

            queryset = (
                IntradayTick.objects
                .filter(volume__gte=min_volume_for_scan)
                .annotate(
                    matched_value=ExpressionWrapper(
                        Case(
                            When(price__gte=1000, then=F('price') * F('volume')),
                            default=F('price') * 1000 * F('volume'),
                            output_field=FloatField(),
                        ),
                        output_field=FloatField(),
                    )
                )
                .filter(matched_value__gte=market_tier_threshold)
            )

            resolved_now_local = timezone.localtime(now)
            window_start = self._window_start_datetime(window, now=now)
            if window_start is not None:
                window_start_local = timezone.localtime(window_start)
                queryset = queryset.filter(
                    Q(trade_date__gt=window_start_local.date()) |
                    Q(trade_date=window_start_local.date(), trade_time__gte=window_start_local.time())
                )
            queryset = queryset.filter(
                Q(trade_date__lt=resolved_now_local.date()) |
                Q(trade_date=resolved_now_local.date(), trade_time__lte=resolved_now_local.time())
            )

            rows = list(queryset.order_by('-matched_value', '-trade_date', '-trade_time', '-id')[:candidate_limit])
            cached_candidates = []
            for row in rows:
                try:
                    event_dt = timezone.make_aware(
                        datetime.combine(getattr(row, 'trade_date'), getattr(row, 'trade_time')),
                        timezone.get_current_timezone(),
                    )
                except Exception:
                    event_dt = now
                cached_candidates.append({
                    'event_id': f"tick:{getattr(row, 'id', 0)}",
                    'symbol': str(getattr(row, 'symbol', '') or '').upper(),
                    'side': self._normalize_side(getattr(row, 'side', '')),
                    'matched_value': float(getattr(row, 'matched_value', 0.0) or 0.0),
                    'ts': event_dt.isoformat(),
                })
            try:
                cache.set(cache_key, cached_candidates, timeout=market_cache_ttl)
            except Exception:
                pass

        normalized_excludes = {
            str(symbol).strip().upper()
            for symbol in (exclude_symbols or [])
            if str(symbol).strip()
        }

        results = []
        for row in cached_candidates or []:
            symbol = str(row.get('symbol') or '').upper()
            if not symbol or symbol in normalized_excludes:
                continue

            matched_value = float(row.get('matched_value') or 0.0)
            side = str(row.get('side') or 'neutral').lower()
            headline = 'Market-wide mega buy flow detected' if side == 'buy' else 'Market-wide mega sell flow detected'
            results.append({
                'event_id': str(row.get('event_id') or f"tick:{symbol}:{row.get('ts')}"),
                'symbol': symbol,
                'source': 'whale',
                'severity': 'critical',
                'confidence': 99,
                'headline': headline,
                'detail': f"Top-tier matched value: {round(matched_value, 2)}",
                'ts': str(row.get('ts') or now.isoformat()),
                'to': f"/whale-alerts/{symbol}",
                'matched_value': matched_value,
                'threshold': base_threshold_vnd,
                'market_wide': True,
                'watchlist_symbol': False,
            })
            if len(results) >= limit:
                break
        return results

    def _parse_limit(self, limit_raw) -> int:
        try:
            limit = int(limit_raw)
        except (TypeError, ValueError):
            raise MarketDataValidationException('limit phải là số nguyên trong khoảng [1, 50].')
        if limit < 1 or limit > 50:
            raise MarketDataValidationException('limit phải là số nguyên trong khoảng [1, 50].')
        return limit

    def _parse_sort(self, sort_raw) -> str:
        sort = str(sort_raw or 'ts').strip().lower()
        if sort not in ('ts', 'matched_value'):
            raise MarketDataValidationException("sort không hợp lệ. Chỉ hỗ trợ: 'ts' hoặc 'matched_value'.")
        return sort

    def _parse_aggregate_window(self, window_raw) -> str:
        window = str(window_raw or 'session').strip().lower() or 'session'
        if window not in {'5m', '15m', '1h', 'session', '5d'}:
            raise MarketDataValidationException("window không hợp lệ. Chỉ hỗ trợ: '5m', '15m', '1h', 'session', '5d'.")
        return window

    def _window_start_datetime(self, window: str, now=None):
        resolved_now = now or timezone.now()
        local_now = timezone.localtime(resolved_now)
        market_open_time = time(
            hour=int(os.getenv('WHALE_MARKET_OPEN_HOUR', '9')),
            minute=int(os.getenv('WHALE_MARKET_OPEN_MINUTE', '0')),
        )
        today_session_start = timezone.make_aware(
            datetime.combine(local_now.date(), market_open_time),
            timezone.get_current_timezone(),
        )
        if window == 'session':
            return today_session_start
        if window == '5m':
            return resolved_now - timedelta(minutes=5)
        if window == '15m':
            return resolved_now - timedelta(minutes=15)
        if window == '1h':
            return resolved_now - timedelta(hours=1)
        if window == '5d':
            anchor_date = local_now.date() - timedelta(days=4)
            return timezone.make_aware(
                datetime.combine(anchor_date, market_open_time),
                timezone.get_current_timezone(),
            )
        return None

    def _is_event_timestamp_in_window(self, ts_value, window: str, now=None) -> bool:
        resolved_now = now or timezone.now()
        if not ts_value:
            return False
        try:
            event_dt = datetime.fromisoformat(str(ts_value).replace('Z', '+00:00'))
        except Exception:
            return False
        if timezone.is_naive(event_dt):
            event_dt = timezone.make_aware(event_dt, timezone.get_current_timezone())
        start_dt = self._window_start_datetime(window, now=resolved_now)
        if start_dt is None:
            return True
        return start_dt <= event_dt <= resolved_now

    def _is_tick_row_in_window(self, row, window: str, now=None) -> bool:
        resolved_now = now or timezone.now()
        try:
            row_dt = timezone.make_aware(
                datetime.combine(getattr(row, 'trade_date'), getattr(row, 'trade_time')),
                timezone.get_current_timezone(),
            )
        except Exception:
            return False
        if row_dt > resolved_now:
            return False
        start_dt = self._window_start_datetime(window, now=resolved_now)
        if start_dt is None:
            return True
        return start_dt <= row_dt <= resolved_now

    def _allow_vnstock_aggregate_fallback(self, symbols: list[str]) -> bool:
        max_symbols = max(int(os.getenv('WHALE_AGGREGATE_VNSTOCK_MAX_SYMBOLS', str(WHALE_AGGREGATE_VNSTOCK_MAX_SYMBOLS_DEFAULT))), 0)
        if max_symbols == 0:
            return False
        return len(symbols) <= max_symbols

    def _encode_whale_feed_cursor(self, payload: dict) -> str:
        raw = json.dumps(payload, separators=(',', ':')).encode('utf-8')
        return base64.urlsafe_b64encode(raw).decode('ascii')

    def _decode_whale_feed_cursor(self, raw_cursor: str | None) -> dict | None:
        if not raw_cursor:
            return None
        try:
            padded = raw_cursor + '=' * (-len(raw_cursor) % 4)
            decoded = base64.urlsafe_b64decode(padded.encode('ascii')).decode('utf-8')
            payload = json.loads(decoded)
            return payload if isinstance(payload, dict) else None
        except (ValueError, TypeError, json.JSONDecodeError):
            return None

    def _resolve_whale_feed_symbols(self, user, query_params) -> tuple[list[str], str, list[int], str]:
        scope_raw = str(query_params.get('scope', '') or '').strip().lower()
        explicit_symbols = query_params.get('symbols', '')
        watchlist_group_ids_raw = query_params.get('watchlist_group_ids', '')

        def _parse_watchlist_group_ids(raw_value: str) -> list[int]:
            parsed_ids = []
            for chunk in str(raw_value or '').split(','):
                chunk = str(chunk).strip()
                if not chunk:
                    continue
                try:
                    parsed_ids.append(int(chunk))
                except (TypeError, ValueError):
                    continue
            return sorted(set(parsed_ids))

        if scope_raw in ('custom', 'symbols'):
            symbols = sorted({str(symbol).strip().upper() for symbol in explicit_symbols.split(',') if str(symbol).strip()})
            return symbols, 'custom', [], 'query_scope'

        if scope_raw == 'watchlist':
            group_ids = _parse_watchlist_group_ids(watchlist_group_ids_raw)
            groups = WatchlistGroup.objects.filter(user=user, id__in=group_ids).prefetch_related('items')
            symbols = sorted({item.symbol.upper() for group in groups for item in group.items.all()})
            return symbols, 'watchlist', group_ids, 'query_scope'

        if scope_raw == 'tracked':
            tracked_symbols = list(
                TrackedSymbol.objects.filter(user=user).order_by('-added_at').values_list('symbol', flat=True)
            )
            symbols = sorted({str(symbol).strip().upper() for symbol in tracked_symbols if str(symbol).strip()})
            return symbols, 'tracked', [], 'query_scope'

        if explicit_symbols:
            symbols = sorted({str(symbol).strip().upper() for symbol in explicit_symbols.split(',') if str(symbol).strip()})
            return symbols, 'custom', [], 'symbols_param'

        if watchlist_group_ids_raw:
            group_ids = _parse_watchlist_group_ids(watchlist_group_ids_raw)
            groups = WatchlistGroup.objects.filter(user=user, id__in=group_ids).prefetch_related('items')
            symbols = sorted({item.symbol.upper() for group in groups for item in group.items.all()})
            return symbols, 'watchlist', group_ids, 'watchlist_param'

        tracked_symbols = list(
            TrackedSymbol.objects.filter(user=user).order_by('-added_at').values_list('symbol', flat=True)
        )
        symbols = sorted({str(symbol).strip().upper() for symbol in tracked_symbols if str(symbol).strip()})
        return symbols, 'tracked', [], 'default_tracked'

    def _build_aggregate_event_payload(self, row, threshold_vnd: float, score_config: dict | None = None, now=None) -> dict:
        matched_value = float(getattr(row, 'matched_value', 0) or 0)
        occurred_at = self._build_tick_timestamp(row)
        symbol = row.symbol.upper()
        
        score_result = calculate_event_score(
            trade={'matched_value': matched_value, 'threshold': threshold_vnd, 'side': getattr(row, 'side', '')},
            context={'threshold_vnd': threshold_vnd, 'side': getattr(row, 'side', '')},
            config=score_config,
        )
        display_result = calculate_display_score(
            event_score=score_result['event_score'],
            occurred_at=occurred_at,
            now=now,
            config=score_config,
        )
        
        # Calculate abnormality scoring
        baseline_svc = BaselineService()
        try:
            baseline = baseline_svc.get_symbol_baseline(symbol)
            session_percentile = baseline_svc.get_session_percentile(symbol, matched_value, window='session')
            abnormality_data = baseline_svc.calculate_abnormality_score(
                symbol,
                matched_value,
                baseline=baseline,
                session_percentile=session_percentile,
            )
        except Exception as e:
            logger.warning(f'Failed to calculate abnormality score for {symbol}: {e}')
            abnormality_data = {
                'abnormality_score': 50.0,
                'adv_multiple': 0.0,
                'percentile_rank': 50.0,
                'liquidity_stress': 'low',
                'triggers': [],
            }
        
        return {
            'id': row.id,
            'event_id': f'tick:{row.id}',
            'contract_version': '1.0',
            'config_version': WHALE_CONFIG_VERSION,
            'weights_version': score_result['weights_version'],
            'symbol': symbol,
            'side': self._normalize_side(getattr(row, 'side', '')),
            'matched_value': round(matched_value, 2),
            'volume': int(getattr(row, 'volume', 0) or 0),
            'threshold': threshold_vnd,
            'size_class': self._classify_signal_size(matched_value),
            'ts': occurred_at,
            'source': 'intraday_tick_db',
            'event_score': score_result['event_score'],
            'display_score': display_result['display_score'],
            'severity': display_result['severity'],
            'score_breakdown': score_result['score_breakdown'],
            'normalized_features': score_result['normalized_features'],
            'raw_features': score_result['raw_features'],
            'score_decay': {
                'age_seconds': display_result['age_seconds'],
                'decay_factor': display_result['decay_factor'],
            },
            'abnormality_score': abnormality_data['abnormality_score'],
            'session_percentile': abnormality_data['percentile_rank'],
            'baseline_context': {
                'adv_multiple': abnormality_data['adv_multiple'],
                'liquidity_tier': abnormality_data['liquidity_stress'],
                'triggers': abnormality_data['triggers'],
            },
        }

    def _build_tick_timestamp(self, row) -> str:
        try:
            dt = timezone.make_aware(
                datetime.combine(row.trade_date, row.trade_time),
                timezone.get_current_timezone(),
            )
            return dt.isoformat()
        except Exception:
            return row.created_at.isoformat() if getattr(row, 'created_at', None) else timezone.now().isoformat()

    def _build_aggregate_event_payload_from_record(self, record: dict, threshold_vnd: float, score_config: dict | None = None, now=None) -> dict:
        matched_value = float(record.get('matched_value') or 0.0)
        occurred_at = str(record.get('ts') or timezone.now().isoformat())
        side = self._normalize_side(record.get('side'))
        symbol = str(record.get('symbol') or '').strip().upper()
        source = str(record.get('source') or 'intraday_tick_db').strip() or 'intraday_tick_db'

        score_result = calculate_event_score(
            trade={'matched_value': matched_value, 'threshold': threshold_vnd, 'side': side},
            context={'threshold_vnd': threshold_vnd, 'side': side},
            config=score_config,
        )
        display_result = calculate_display_score(
            event_score=score_result['event_score'],
            occurred_at=occurred_at,
            now=now,
            config=score_config,
        )

        # Calculate abnormality scoring
        baseline_svc = BaselineService()
        try:
            baseline = baseline_svc.get_symbol_baseline(symbol)
            session_percentile = baseline_svc.get_session_percentile(symbol, matched_value, window='session')
            abnormality_data = baseline_svc.calculate_abnormality_score(
                symbol,
                matched_value,
                baseline=baseline,
                session_percentile=session_percentile,
            )
        except Exception as e:
            logger.warning(f'Failed to calculate abnormality score for {symbol}: {e}')
            abnormality_data = {
                'abnormality_score': 50.0,
                'adv_multiple': 0.0,
                'percentile_rank': 50.0,
                'liquidity_stress': 'low',
                'triggers': [],
            }

        return {
            'id': record.get('id'),
            'event_id': record.get('event_id') or f'{source}:{symbol}:{record.get("id") or occurred_at}',
            'contract_version': '1.0',
            'config_version': WHALE_CONFIG_VERSION,
            'weights_version': score_result['weights_version'],
            'symbol': symbol,
            'side': side,
            'matched_value': round(matched_value, 2),
            'volume': int(record.get('volume') or 0),
            'threshold': threshold_vnd,
            'size_class': record.get('size_class') or self._classify_signal_size(matched_value),
            'ts': occurred_at,
            'source': source,
            'event_score': score_result['event_score'],
            'display_score': display_result['display_score'],
            'severity': display_result['severity'],
            'score_breakdown': score_result['score_breakdown'],
            'normalized_features': score_result['normalized_features'],
            'raw_features': score_result['raw_features'],
            'score_decay': {
                'age_seconds': display_result['age_seconds'],
                'decay_factor': display_result['decay_factor'],
            },
            'abnormality_score': abnormality_data['abnormality_score'],
            'session_percentile': abnormality_data['percentile_rank'],
            'baseline_context': {
                'adv_multiple': abnormality_data['adv_multiple'],
                'liquidity_tier': abnormality_data['liquidity_stress'],
                'triggers': abnormality_data['triggers'],
            },
        }

    def _normalize_aggregate_event_records(self, records: list[dict], *, sort: str, cursor_payload: dict | None = None) -> tuple[list[dict], bool]:
        normalized = []
        for index, record in enumerate(records, start=1):
            symbol = str(record.get('symbol') or '').strip().upper()
            if not symbol:
                continue
            ts_value = str(record.get('ts') or '').strip()
            try:
                parsed_dt = datetime.fromisoformat(ts_value.replace('Z', '+00:00'))
            except Exception:
                continue
            matched_value = float(record.get('matched_value') or 0.0)
            row_id = int(record.get('id') or index)
            normalized.append({
                **record,
                'symbol': symbol,
                'matched_value': matched_value,
                'ts': parsed_dt.isoformat(),
                'id': row_id,
                '_sort_dt': parsed_dt,
                '_sort_id': row_id,
            })

        if sort == 'matched_value':
            if cursor_payload is not None:
                parsed_cursor = self._parse_cursor_matched_value(cursor_payload)
                if parsed_cursor is None:
                    return [], False
                cursor_value, cursor_id = parsed_cursor
                normalized = [
                    record for record in normalized
                    if record['matched_value'] < cursor_value or (record['matched_value'] == cursor_value and record['_sort_id'] < cursor_id)
                ]
            normalized.sort(key=lambda record: (-record['matched_value'], -record['_sort_id']))
        else:
            if cursor_payload is not None:
                parsed_cursor = self._parse_cursor_datetime(cursor_payload)
                if parsed_cursor is None:
                    return [], False
                cursor_date, cursor_time, cursor_id = parsed_cursor
                normalized = [
                    record for record in normalized
                    if (
                        record['_sort_dt'].date() < cursor_date
                        or (record['_sort_dt'].date() == cursor_date and record['_sort_dt'].time() < cursor_time)
                        or (
                            record['_sort_dt'].date() == cursor_date
                            and record['_sort_dt'].time() == cursor_time
                            and record['_sort_id'] < cursor_id
                        )
                    )
                ]
            normalized.sort(key=lambda record: (record['_sort_dt'], record['_sort_id']), reverse=True)

        return normalized, True

    def _build_stream_aggregate_records(self, symbols: list[str], threshold_vnd: float) -> list[dict]:
        records = []
        synthetic_id = 1
        for symbol in symbols:
            stream_ticks = read_stream_intraday_ticks(symbol, count=150)

            for tick in stream_ticks:
                try:
                    price = self._normalize_intraday_price_vnd(
                        tick.get('price') or 0,
                        source_unit=tick.get('price_unit'),
                    )
                    volume = float(tick.get('volume') or 0)
                except (TypeError, ValueError):
                    continue
                if price is None:
                    continue
                matched_value = price * volume
                if matched_value < threshold_vnd:
                    continue
                    
                ts_raw = tick.get('ts') or tick.get('time') or tick.get('tradingDate') or timezone.now().isoformat()
                try:
                    ts_value = datetime.fromisoformat(str(ts_raw).replace('Z', '+00:00')).isoformat()
                except Exception:
                    ts_value = timezone.now().isoformat()
                    
                side = tick.get('side') or tick.get('match_type') or tick.get('matchType') or 'UNKNOWN'
                records.append({
                    'id': synthetic_id,
                    'event_id': f'stream:{symbol}:{synthetic_id}',
                    'symbol': symbol,
                    'side': side,
                    'matched_value': matched_value,
                    'volume': int(volume),
                    'ts': ts_value,
                    'size_class': self._classify_signal_size(matched_value),
                    'source': 'redis_stream',
                })
                synthetic_id += 1
        return records

    def _build_vnstock_aggregate_records(self, symbols: list[str], threshold_vnd: float) -> list[dict]:
        records = []
        synthetic_id = 1
        if not self._allow_vnstock_aggregate_fallback(symbols):
            logger.info('Skip vnstock aggregate fallback for %s symbols to reduce rate-limit pressure.', len(symbols))
            return []
        if is_vnstock_rate_limited('intraday'):
            return []

        for symbol in symbols:
            try:
                df = fetch_intraday_dataframe(symbol, 150)
            except ExternalSystemException as exc:
                if exc.code == 'vnstock_rate_limited' or is_rate_limited_error(exc):
                    mark_vnstock_rate_limited('intraday', exc)
                    record_market_fallback('whale-feed-aggregate', 'vnstock_backoff')
                    logger.info('Aggregate whale vnstock rate-limited for %s; activate cooldown.', symbol)
                    break
                if exc.code == 'vnstock_timeout':
                    record_market_external_timeout('whale-feed-aggregate')
                    record_market_fallback('whale-feed-aggregate', 'timeout')
                logger.debug('Aggregate whale vnstock fallback failed for %s: %s', symbol, exc)
                continue
            except Exception as exc:
                if is_rate_limited_error(exc):
                    mark_vnstock_rate_limited('intraday', exc)
                    record_market_fallback('whale-feed-aggregate', 'vnstock_backoff')
                    logger.info('Aggregate whale vnstock generic rate-limited for %s; activate cooldown.', symbol)
                    break
                logger.debug('Aggregate whale vnstock unexpected fallback failed for %s: %s', symbol, exc)
                continue

            if df is None or df.empty:
                continue

            source_unit_hint = None
            if getattr(df, 'attrs', None):
                source_unit_hint = str(df.attrs.get('price_unit_canonical') or '').strip().upper() or None
            
            for _, row in df.iterrows():
                try:
                    price = self._normalize_intraday_price_vnd(
                        row.get('price') or row.get('close') or 0,
                        source_unit=row.get('price_unit') or source_unit_hint,
                    )
                    volume = float(row.get('volume') or row.get('vol') or row.get('matchVolume') or 0)
                except (TypeError, ValueError):
                    continue
                if price is None:
                    continue
                matched_value = price * volume
                if matched_value < threshold_vnd:
                    continue
                raw_time = row.get('time') or row.get('tradingDate') or ''
                try:
                    ts_value = datetime.fromisoformat(str(raw_time).replace('Z', '+00:00')).isoformat()
                except Exception:
                    try:
                        ts_value = timezone.make_aware(
                            datetime.combine(timezone.localdate(), datetime.strptime(str(raw_time)[:8], '%H:%M:%S').time()),
                            timezone.get_current_timezone(),
                        ).isoformat()
                    except Exception:
                        ts_value = timezone.now().isoformat()
                side = row.get('side') or row.get('match_type') or row.get('matchType') or 'UNKNOWN'
                records.append({
                    'id': synthetic_id,
                    'event_id': f'vnstock:{symbol}:{synthetic_id}',
                    'symbol': symbol,
                    'side': side,
                    'matched_value': matched_value,
                    'volume': int(volume),
                    'ts': ts_value,
                    'size_class': self._classify_signal_size(matched_value),
                    'source': 'vnstock',
                })
                synthetic_id += 1
        return records

    def _parse_cursor_datetime(self, cursor_payload: dict) -> tuple[date, time, int] | None:
        if not isinstance(cursor_payload, dict):
            return None
        expected_keys = {'sort', 'trade_date', 'trade_time', 'id'}
        extra_keys = set(cursor_payload.keys()) - expected_keys
        if extra_keys and extra_keys != {'window'}:
            return None
        try:
            trade_date = date.fromisoformat(str(cursor_payload['trade_date']))
            trade_time = time.fromisoformat(str(cursor_payload['trade_time']))
            row_id = int(cursor_payload['id'])
        except (KeyError, TypeError, ValueError):
            return None
        return trade_date, trade_time, row_id

    def _parse_cursor_matched_value(self, cursor_payload: dict) -> tuple[float, int] | None:
        if not isinstance(cursor_payload, dict):
            return None
        expected_keys = {'sort', 'matched_value', 'id'}
        extra_keys = set(cursor_payload.keys()) - expected_keys
        if extra_keys and extra_keys != {'window'}:
            return None
        try:
            matched_value = float(cursor_payload['matched_value'])
            row_id = int(cursor_payload['id'])
        except (KeyError, TypeError, ValueError):
            return None
        return matched_value, row_id

    def _build_next_cursor_from_record(self, record: dict, sort: str, window: str | None = None) -> str:
        if sort == 'matched_value':
            payload = {
                'sort': sort,
                'matched_value': float(record['matched_value']),
                'id': int(record['id']),
            }
            if window:
                payload['window'] = str(window)
            return self._encode_whale_feed_cursor(payload)

        last_dt = datetime.fromisoformat(str(record['ts']).replace('Z', '+00:00'))
        payload = {
            'sort': sort,
            'trade_date': last_dt.date().isoformat(),
            'trade_time': last_dt.time().isoformat(),
            'id': int(record['id']),
        }
        if window:
            payload['window'] = str(window)
        return self._encode_whale_feed_cursor(payload)

    def _build_next_cursor_from_db_row(self, row, sort: str, window: str | None = None) -> str:
        if sort == 'matched_value':
            payload = {
                'sort': sort,
                'matched_value': float(getattr(row, 'matched_value', 0) or 0),
                'id': row.id,
            }
            if window:
                payload['window'] = str(window)
            return self._encode_whale_feed_cursor(payload)
        payload = {
            'sort': sort,
            'trade_date': row.trade_date.isoformat(),
            'trade_time': row.trade_time.isoformat(),
            'id': row.id,
        }
        if window:
            payload['window'] = str(window)
        return self._encode_whale_feed_cursor(payload)

    def _build_aggregate_record_response(
        self,
        *,
        normalized_records: list[dict],
        source: str,
        threshold_vnd: float,
        threshold_resolver,
        entitlements: dict,
        weights_version: str,
        scope: str,
        scope_source: str,
        symbols: list[str],
        watchlist_group_ids: list[int],
        sort: str,
        window: str,
        limit: int,
        score_config: dict,
        now,
    ) -> dict:
        has_more = len(normalized_records) > limit
        page_rows = normalized_records[:limit]
        next_cursor = self._build_next_cursor_from_record(page_rows[-1], sort, window=window) if has_more and page_rows else None
        results = [
            self._build_aggregate_event_payload_from_record(
                row,
                threshold_resolver(row.get('symbol')),
                score_config=score_config,
                now=now,
            )
            for row in page_rows
        ]
        return self._build_aggregate_response(
            results=results,
            next_cursor=next_cursor,
            has_more=has_more,
            source=source,
            threshold_vnd=threshold_vnd,
            entitlements=entitlements,
            weights_version=weights_version,
            scope=scope,
            scope_source=scope_source,
            symbols=symbols,
            watchlist_group_ids=watchlist_group_ids,
            sort=sort,
            window=window,
            limit=limit,
        )

    def _build_empty_aggregate_response(
        self,
        *,
        threshold_vnd: float,
        entitlements: dict,
        weights_version: str,
        scope: str,
        scope_source: str,
        symbols: list[str],
        watchlist_group_ids: list[int],
        sort: str,
        window: str,
        limit: int,
        source: str,
    ) -> dict:
        return self._build_aggregate_response(
            results=[],
            next_cursor=None,
            has_more=False,
            source=source,
            threshold_vnd=threshold_vnd,
            entitlements=entitlements,
            weights_version=weights_version,
            scope=scope,
            scope_source=scope_source,
            symbols=symbols,
            watchlist_group_ids=watchlist_group_ids,
            sort=sort,
            window=window,
            limit=limit,
        )

    def _build_aggregate_response(
        self,
        *,
        results: list,
        next_cursor,
        has_more: bool,
        source: str,
        threshold_vnd: float,
        entitlements: dict,
        weights_version: str,
        scope: str,
        scope_source: str,
        symbols: list[str],
        watchlist_group_ids: list[int],
        sort: str,
        window: str,
        limit: int,
    ) -> dict:
        return {
            'results': results,
            'next_cursor': next_cursor,
            'has_more': has_more,
            'server_time': timezone.now().isoformat(),
            'source': source,
            'weights_version': weights_version,
            'filters': {
                'scope': scope,
                'scope_source': scope_source,
                'symbols': symbols,
                'watchlist_group_ids': watchlist_group_ids,
                'sort': sort,
                'window': window,
                'limit': limit,
                'threshold': threshold_vnd,
            },
            'meta': {
                'contract_version': '1.1',
                'pagination': {
                    'sort': sort,
                    'limit': limit,
                    'has_more': has_more,
                    'next_cursor': next_cursor,
                },
                'scope': {
                    'value': scope,
                    'source': scope_source,
                },
            },
            'entitlements': entitlements,
        }

    def _price_map_from_ticker_cache(self, cached_ticker: dict) -> dict:
        match_price = cached_ticker.get('current_price')
        reference_price = cached_ticker.get('prev_price')
        return self._build_price_status(match_price, reference_price)

    def _build_price_status(self, match_price, reference_price) -> dict:
        try:
            change_pct = (
                round((match_price - reference_price) / reference_price * 100, 2)
                if match_price and reference_price else None
            )
        except (TypeError, ZeroDivisionError):
            change_pct = None
        status_value = 'up' if change_pct and change_pct > 0.5 else 'down' if change_pct and change_pct < -0.5 else 'flat'
        return {
            'price': match_price,
            'change_pct': change_pct,
            'status': status_value,
        }

    def _safe_float(self, value):
        try:
            resolved = float(value)
            return resolved if resolved == resolved else None
        except (TypeError, ValueError):
            return None

    def _safe_int(self, value):
        try:
            resolved = float(value)
            return int(resolved) if resolved == resolved else None
        except (TypeError, ValueError):
            return None

    def _resolve_quote_price_scale(self, values) -> float:
        """DEPRECATED: Heuristic price scale detection.
        
        REASON DEPRECATED:
        - Adapter (vnstock_adapter.py) now guarantees all prices in canonical THOUSAND_VND
        - No heuristic detection needed anymore
        - This function is kept for backward compatibility but always returns 1.0 (no scaling)
        
        If you see this being called, it's safe to ignore - prices are already canonical.
        """
        # OLD CODE (kept for reference but NEVER EXECUTED):
        # candidates = []
        # for value in values or []:
        #     numeric = self._safe_float(value)
        #     if numeric is None:
        #         continue
        #     magnitude = abs(numeric)
        #     if magnitude > 0:
        #         candidates.append(magnitude)
        # 
        # if not candidates:
        #     return 1.0
        # 
        # candidates.sort()
        # pivot = candidates[len(candidates) // 2]
        # if pivot >= 1_000_000:
        #     return 0.001
        # if pivot < 1_000:
        #     return 1000.0
        # return 1.0
        
        # NEW: Adapter guarantees THOUSAND_VND canonical, so always return 1.0
        return 1.0

    def _normalize_quote_price(self, value, scale: float = 1.0):
        numeric = self._safe_float(value)
        if numeric is None:
            return None
        return round(numeric * (scale if scale else 1.0), 2)

    def _normalize_historical_quote_price(self, value, symbol: str | None = None):
        numeric = self._safe_float(value)
        if numeric is None:
            return None

        source_unit = 'VND' if abs(numeric) >= 1000 else 'THOUSAND_VND'
        try:
            canonical_quote = normalize_quote_price_to_canonical(
                value=numeric,
                source_unit=source_unit,
                source=PriceSource.VNSTOCK_DAILY,
                symbol=symbol,
            )
            return round(canonical_quote.value, 2)
        except Exception:
            return round(numeric / 1000, 2) if abs(numeric) >= 1000 else round(numeric, 2)

    def _normalize_intraday_price_vnd(self, value, source_unit: str | None = None):
        numeric = self._safe_float(value)
        if numeric is None:
            return None

        resolved_source_unit = str(source_unit or '').strip().upper()
        if resolved_source_unit not in {'VND', 'THOUSAND_VND'}:
            # Fallback for legacy payloads missing unit metadata:
            # - >= 1000: likely VND price (e.g. 65100)
            # - < 1000: likely THOUSAND_VND canonical (e.g. 23.8)
            resolved_source_unit = 'VND' if abs(numeric) >= 1000 else 'THOUSAND_VND'

        try:
            canonical_quote = normalize_quote_price_to_canonical(
                value=numeric,
                source_unit=resolved_source_unit,
                source=PriceSource.INTRADAY_TICK,
            )
            return round(canonical_quote.to_vnd_for_calculation(), 2)
        except Exception:
            # Last-resort fallback keeps whale valuation safe in VND.
            return round(numeric if abs(numeric) >= 1000 else numeric * 1000, 2)

    def _to_float(self, value):
        return float(value) if value is not None else None

    def _get_exchange_price_band(self, exchange):
        normalized_exchange = (exchange or '').strip().upper()
        if normalized_exchange == 'HNX':
            return Decimal('0.10')
        if normalized_exchange in {'UPCOM'}:
            return Decimal('0.15')
        return Decimal('0.07')

    def _build_stock_workspace_overview_base(self, symbol: str, user) -> dict:
        normalized_symbol = (symbol or '').strip().upper()
        profile = StockProfile.objects.filter(symbol=normalized_symbol).first()
        if not profile:
            raise MarketDataValidationException('Thiếu mã chứng khoán.')

        latest_daily_price = (
            DailyPrice.objects
            .filter(symbol=normalized_symbol)
            .order_by('-date')
            .values('open_price', 'high_price', 'low_price', 'close_price', 'volume')
            .first()
        )
        price_info = get_price_changes([normalized_symbol]).get(normalized_symbol, {})
        year_stats = (
            DailyPrice.objects
            .filter(symbol=normalized_symbol, date__gte=timezone.localdate() - timedelta(days=365))
            .aggregate(week52_high=Max('high_price'), week52_low=Min('low_price'))
        )

        normalized_current_price = self._normalize_historical_quote_price(price_info.get('current_price'), normalized_symbol)
        normalized_prev_price = self._normalize_historical_quote_price(price_info.get('prev_price'), normalized_symbol)
        normalized_open_price = self._normalize_historical_quote_price(latest_daily_price.get('open_price'), normalized_symbol) if latest_daily_price else None
        normalized_high_price = self._normalize_historical_quote_price(latest_daily_price.get('high_price'), normalized_symbol) if latest_daily_price else None
        normalized_low_price = self._normalize_historical_quote_price(latest_daily_price.get('low_price'), normalized_symbol) if latest_daily_price else None
        normalized_close_price = self._normalize_historical_quote_price(latest_daily_price.get('close_price'), normalized_symbol) if latest_daily_price else None
        normalized_week52_high = self._normalize_historical_quote_price(year_stats.get('week52_high'), normalized_symbol)
        normalized_week52_low = self._normalize_historical_quote_price(year_stats.get('week52_low'), normalized_symbol)

        average_price = None
        normalized_prices = [
            value
            for value in [
                normalized_open_price,
                normalized_high_price,
                normalized_low_price,
                normalized_close_price,
            ]
            if value is not None
        ]
        if normalized_prices:
            average_price = self._to_float(sum(Decimal(str(value)) for value in normalized_prices) / Decimal(len(normalized_prices)))

        reference_price = normalized_prev_price
        if reference_price is None and normalized_close_price is not None:
            reference_price = normalized_close_price

        change_value = None
        if normalized_current_price is not None and normalized_prev_price is not None:
            change_value = round(normalized_current_price - normalized_prev_price, 2)

        change_pct = None
        if normalized_current_price is not None and normalized_prev_price not in (None, 0):
            change_pct = round((normalized_current_price - normalized_prev_price) / normalized_prev_price * 100, 2)

        ceiling_price = None
        floor_price = None
        if reference_price is not None:
            reference_decimal = Decimal(str(reference_price))
            band = self._get_exchange_price_band(profile.exchange)
            ceiling_price = self._to_float(reference_decimal * (Decimal('1') + band))
            floor_price = self._to_float(reference_decimal * (Decimal('1') - band))

        tracked_item = None
        market_groups = []
        watchlist_groups = []
        market_group_refs = []
        watchlist_memberships = []
        if user and user.is_authenticated:
            tracked_item = (
                TrackedSymbol.objects
                .select_related('source_group')
                .filter(user=user, symbol=normalized_symbol)
                .first()
            )
            market_group_refs = list(
                SecuritiesGroup.objects
                .filter(items__symbol=normalized_symbol)
                .order_by('name')
                .values('id', 'name')
                .distinct()
            )
            market_groups = [group['name'] for group in market_group_refs]
            watchlist_memberships = list(
                WatchlistItem.objects
                .filter(group__user=user, symbol=normalized_symbol)
                .select_related('group')
                .order_by('group__name')
                .values('id', 'group_id', 'group__name')
            )
            watchlist_groups = [item['group__name'] for item in watchlist_memberships]

        return {
            'tracked_symbol_id': tracked_item.id if tracked_item else None,
            'symbol': profile.symbol,
            'company_name': profile.company_name,
            'industry': profile.industry,
            'exchange': profile.exchange,
            'listed_date': profile.listed_date,
            'is_active': profile.is_active,
            'updated_at': profile.updated_at,
            'current_price': normalized_current_price,
            'prev_price': normalized_prev_price,
            'change_value': change_value,
            'change_pct': change_pct,
            'last_date': price_info.get('last_date'),
            'open_price': normalized_open_price,
            'high_price': normalized_high_price,
            'low_price': normalized_low_price,
            'close_price': normalized_close_price,
            'volume': latest_daily_price.get('volume') if latest_daily_price else None,
            'average_price': average_price,
            'reference_price': reference_price,
            'ceiling_price': ceiling_price,
            'floor_price': floor_price,
            'week52_high': normalized_week52_high,
            'week52_low': normalized_week52_low,
            'is_tracked': tracked_item is not None,
            'source_group_name': tracked_item.source_group.name if tracked_item and tracked_item.source_group else None,
            'market_groups': market_groups,
            'watchlist_groups': watchlist_groups,
            'market_group_refs': market_group_refs,
            'watchlist_memberships': [
                {
                    'item_id': item['id'],
                    'group_id': item['group_id'],
                    'group_name': item['group__name'],
                }
                for item in watchlist_memberships
            ],
        }

    def _safe_round(self, value, digits=2):
        if value is None:
            return None
        return round(float(value), digits)

    def _compute_rsi(self, values, window=14):
        if len(values) <= window:
            return None
        deltas = [values[index] - values[index - 1] for index in range(1, len(values))]
        gains = [max(delta, 0) for delta in deltas]
        losses = [abs(min(delta, 0)) for delta in deltas]
        recent_gains = gains[-window:]
        recent_losses = losses[-window:]

        average_gain = sum(recent_gains) / window
        average_loss = sum(recent_losses) / window
        if average_loss == 0:
            return 100.0 if average_gain > 0 else 50.0

        rs = average_gain / average_loss
        return 100 - (100 / (1 + rs))

    def _technical_bias_meta(self, bias):
        normalized_bias = (bias or 'NEUTRAL').strip().upper()
        if normalized_bias == 'BULLISH':
            return {
                'bias': 'BULLISH',
                'bias_label': 'Tăng',
                'bias_description': 'Giá đang nằm trên SMA20 và SMA50, động lượng duy trì tích cực.',
            }
        if normalized_bias == 'WEAK':
            return {
                'bias': 'WEAK',
                'bias_label': 'Yếu',
                'bias_description': 'Giá đang nằm dưới các đường trung bình và động lượng suy yếu.',
            }
        return {
            'bias': 'NEUTRAL',
            'bias_label': 'Trung tính',
            'bias_description': 'Cấu trúc giá chưa nghiêng rõ theo một hướng mạnh.',
        }

    def _compute_stock_workspace_technical(self, rows, overview):
        close_values = [float(row['close_price']) for row in rows if row.get('close_price') is not None]
        volume_values = [float(row['volume']) for row in rows if row.get('volume') is not None]
        latest_close = close_values[-1] if close_values else None

        sma20 = sum(close_values[-20:]) / 20 if len(close_values) >= 20 else None
        sma50 = sum(close_values[-50:]) / 50 if len(close_values) >= 50 else None
        rsi14 = self._compute_rsi(close_values, 14)
        avg_volume_20 = sum(volume_values[-20:]) / 20 if len(volume_values) >= 20 else None
        momentum_20d_pct = None
        if len(close_values) >= 21 and close_values[-21] > 0:
            momentum_20d_pct = ((close_values[-1] - close_values[-21]) / close_values[-21]) * 100

        range_position_pct = None
        week52_low = overview.get('week52_low')
        week52_high = overview.get('week52_high')
        if latest_close is not None and week52_low is not None and week52_high is not None and week52_high > week52_low:
            range_position_pct = ((latest_close - week52_low) / (week52_high - week52_low)) * 100

        price_vs_sma20_pct = None
        if latest_close is not None and sma20:
            price_vs_sma20_pct = ((latest_close - sma20) / sma20) * 100

        price_vs_sma50_pct = None
        if latest_close is not None and sma50:
            price_vs_sma50_pct = ((latest_close - sma50) / sma50) * 100

        bias = 'NEUTRAL'
        if latest_close is not None and sma20 and sma50 and rsi14 is not None:
            if latest_close > sma20 > sma50 and rsi14 >= 55:
                bias = 'BULLISH'
            elif latest_close < sma20 < sma50 and rsi14 <= 45:
                bias = 'WEAK'

        bias_meta = self._technical_bias_meta(bias)

        return {
            **bias_meta,
            'sma20': self._safe_round(sma20),
            'sma50': self._safe_round(sma50),
            'rsi14': self._safe_round(rsi14),
            'avg_volume_20': self._safe_round(avg_volume_20),
            'price_vs_sma20_pct': self._safe_round(price_vs_sma20_pct),
            'price_vs_sma50_pct': self._safe_round(price_vs_sma50_pct),
            'momentum_20d_pct': self._safe_round(momentum_20d_pct),
            'range_position_pct': self._safe_round(range_position_pct),
            'latest_close': self._safe_round(latest_close),
        }

    def _row_float(self, row, key):
        value = row.get(key)
        if value is None:
            return None
        try:
            resolved = float(value)
            return round(resolved, 4) if resolved == resolved else None
        except (TypeError, ValueError):
            return None


market_data_service = MarketDataService()
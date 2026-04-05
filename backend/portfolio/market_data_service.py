import base64
import json
import logging
import os
from datetime import date, datetime, time, timedelta
from decimal import Decimal

from django.db.models import ExpressionWrapper, F, FloatField, Max, Min, Q
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
    read_stream_intraday_ticks,
)
from .domain_constants import (
    WHALE_AGGREGATE_VNSTOCK_MAX_SYMBOLS_DEFAULT,
    WHALE_CONFIG_VERSION,
    classify_whale_size_class,
    resolve_user_whale_threshold_vnd,
)
from .exceptions import ExternalSystemException, MarketDataValidationException
from .models import (
    DailyPrice,
    IntradayTick,
    SecuritiesGroup,
    SecuritiesItem,
    StockProfile,
    TrackedSymbol,
    UserConfig,
    WatchlistGroup,
    WatchlistItem,
)
from .observability import record_market_external_timeout, record_market_fallback
from .permissions import resolve_user_entitlements
from .services import get_price_changes
from .whale_scoring import calculate_display_score, calculate_event_score, resolve_whale_score_config


logger = logging.getLogger(__name__)


class MarketDataService:
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

    def get_realtime_ticker(self, symbol: str) -> dict:
        normalized_symbol = self.normalize_symbol(symbol)
        ticker_cache_key = f'ticker:{normalized_symbol}'
        cached_ticker = get_cache(ticker_cache_key)
        if cached_ticker is not None:
            return cached_ticker

        try:
            from portfolio.tasks import prefetch_ticker_price_board

            prefetch_ticker_price_board.apply_async(countdown=0)
        except Exception:
            pass

        price_info = get_price_changes([normalized_symbol]).get(normalized_symbol, {})
        last_date = price_info.get('last_date')
        freshness_seconds = None
        stale = True

        if last_date:
            try:
                last_dt = datetime.fromisoformat(str(last_date))
                freshness_seconds = max(int((datetime.now() - last_dt).total_seconds()), 0)
                stale = freshness_seconds > 30
            except ValueError:
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

        return {
            'symbol': normalized_symbol,
            **price_info,
            **ohlc_extra,
            'freshness_seconds': freshness_seconds,
            'stale': stale,
            'source': 'db',
        }

    def get_intraday_matched(self, symbol: str, page_size=None) -> dict:
        normalized_symbol = self.normalize_symbol(symbol)
        resolved_page_size = self.normalize_page_size(page_size)
        cache_key = f'intraday:{normalized_symbol}:{resolved_page_size}'
        cached = get_cache(cache_key)
        if cached is not None:
            return cached

        if is_vnstock_rate_limited('intraday'):
            record_market_fallback('intraday-matched', 'vnstock_backoff')
            return self._build_intraday_backoff_response(normalized_symbol)

        stream_ticks = read_stream_intraday_ticks(normalized_symbol, count=resolved_page_size)
        trades = self._build_stream_trades(stream_ticks)
        if trades:
            result = {
                'symbol': normalized_symbol,
                'trades': trades,
                'total': len(trades),
                'source': 'stream',
                'fetched_at': timezone.now().isoformat(),
            }
            set_cache(cache_key, result, timeout=8)
            return result

        try:
            df = fetch_intraday_dataframe(normalized_symbol, resolved_page_size)
        except ExternalSystemException as exc:
            if exc.code == 'vnstock_rate_limited':
                mark_vnstock_rate_limited('intraday', exc)
                record_market_fallback('intraday-matched', 'vnstock_backoff')
                return self._build_intraday_backoff_response(normalized_symbol)
            if exc.code == 'vnstock_timeout':
                record_market_external_timeout('intraday-matched')
            if exc.code == 'vnstock_missing':
                raise exc
            raise ExternalSystemException(
                f'Không lấy được dữ liệu khớp lệnh: {exc.message}',
                code=exc.code,
                payload=exc.payload,
            ) from exc

        if df is None or df.empty:
            return {
                'symbol': normalized_symbol,
                'trades': [],
                'total': 0,
                'fetched_at': timezone.now().isoformat(),
            }

        trades = self._build_dataframe_trades(df)
        result = {
            'symbol': normalized_symbol,
            'trades': trades,
            'total': len(trades),
            'fetched_at': timezone.now().isoformat(),
        }
        set_cache(cache_key, result, timeout=8)
        return result

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
            df = fetch_price_board_dataframe([normalized_symbol], anchor_symbol=normalized_symbol)
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
            if exc.code == 'vnstock_missing':
                raise exc
            raise ExternalSystemException(
                f'Không lấy được dữ liệu sổ lệnh: {exc.message}',
                code=exc.code,
                payload=exc.payload,
            ) from exc

        if df is None or df.empty:
            return {'symbol': normalized_symbol, 'depth': [], 'match': {}}

        bid_ask = df['bid_ask'].iloc[0]
        match = df['match'].iloc[0]

        depth = []
        for level in range(1, 4):
            bid_price = self._safe_float(bid_ask.get(f'bid_{level}_price'))
            bid_volume = self._safe_int(bid_ask.get(f'bid_{level}_volume'))
            ask_price = self._safe_float(bid_ask.get(f'ask_{level}_price'))
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

        reference_price = self._safe_float(match.get('reference_price'))
        match_price = self._safe_float(match.get('match_price'))
        change_pct = None
        if reference_price and match_price:
            change_pct = round((match_price - reference_price) / reference_price * 100, 2)

        result = {
            'symbol': normalized_symbol,
            'depth': depth,
            'match': {
                'match_price': match_price,
                'open_price': self._safe_float(match.get('open_price')),
                'highest': self._safe_float(match.get('highest')),
                'lowest': self._safe_float(match.get('lowest')),
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
                'fetched_at': timezone.now().isoformat(),
            }

        try:
            df = fetch_intraday_dataframe(normalized_symbol, 500)
        except ExternalSystemException as exc:
            if exc.code == 'vnstock_rate_limited':
                mark_vnstock_rate_limited('intraday', exc)
                return {
                    'symbol': normalized_symbol,
                    'buckets': [],
                    'source': 'vnstock_backoff',
                    'rate_limited': True,
                    'fetched_at': timezone.now().isoformat(),
                }
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
                'buckets': [],
                'fetched_at': timezone.now().isoformat(),
            }

        rows = []
        for _, row in df.iterrows():
            raw_time = row.get('time') or row.get('tradingDate') or ''
            raw_volume = row.get('volume') or row.get('vol') or row.get('matchVolume') or 0
            try:
                import pandas as pd

                ts = pd.Timestamp(str(raw_time))
                volume = float(raw_volume)
                rows.append({'ts': ts, 'volume': volume})
            except Exception:
                continue

        if not rows:
            return {
                'symbol': normalized_symbol,
                'buckets': [],
                'fetched_at': timezone.now().isoformat(),
            }

        import pandas as pd

        frame = pd.DataFrame(rows).set_index('ts').sort_index()
        buckets_df = frame.resample('15min')['volume'].sum().reset_index()
        buckets_df.columns = ['time', 'volume']

        volumes = buckets_df['volume'].values
        window = min(20, len(volumes))
        sma20_values = []
        for index in range(len(volumes)):
            start = max(0, index - window)
            sma20_values.append(float(volumes[start:index + 1].mean()) if index >= 0 else 0.0)

        buckets = []
        for index, row in buckets_df.iterrows():
            volume = float(row['volume'])
            sma20 = sma20_values[index] if index < len(sma20_values) else 0.0
            rvol = round(volume / sma20, 2) if sma20 > 0 else 0.0
            try:
                time_str = row['time'].strftime('%H:%M')
            except Exception:
                time_str = str(row['time'])[:5]
            buckets.append(
                {
                    'time': time_str,
                    'volume': int(volume),
                    'sma20': int(sma20),
                    'rvol': rvol,
                    'is_spike': rvol >= 2.0,
                }
            )

        result = {
            'symbol': normalized_symbol,
            'buckets': buckets,
            'fetched_at': timezone.now().isoformat(),
        }
        set_cache(cache_key, result, timeout=20)
        return result

    def get_whale_feed(self, user, symbol: str) -> dict:
        import pandas as pd

        normalized_symbol = self.normalize_symbol(symbol)
        threshold_vnd = self._get_user_whale_threshold_vnd(user, symbol=normalized_symbol)
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
                .values('trade_time', 'price', 'volume', 'match_type', 'side')
            )
            if db_rows:
                db_df = pd.DataFrame([
                    {
                        'time': row['trade_time'].isoformat() if row.get('trade_time') else '',
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

        if df is None or df.empty:
            self._record_source_observability('whale-feed', data_source, primary_source='redis_stream')
            return self._build_empty_whale_feed_response(
                normalized_symbol,
                threshold_vnd,
                data_source,
            )

        orders = []
        total_buy_value = 0.0
        total_sell_value = 0.0
        shark_value = 0.0
        whale_value_total = 0.0
        small_value = 0.0

        for _, row in df.iterrows():
            try:
                raw_price = float(row.get('price') or row.get('close') or 0)
                raw_vol = float(row.get('volume') or row.get('vol') or row.get('matchVolume') or 0)
            except (ValueError, TypeError):
                continue
            matched_value = raw_price * raw_vol
            side = self._normalize_side(row.get('match_type') or row.get('matchType') or row.get('side') or '')
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
                raw_time = row.get('time') or row.get('tradingDate') or ''
                orders.append(
                    self._build_whale_order_payload(
                        raw_time=raw_time,
                        raw_price=raw_price,
                        raw_vol=raw_vol,
                        matched_value=matched_value,
                        side=side,
                        size_class=size_class,
                        threshold_vnd=threshold_vnd,
                        score_config=score_config,
                        now=request_now,
                    )
                )

        orders.sort(key=lambda item: item['matched_value'], reverse=True)
        total_value = shark_value + whale_value_total + small_value
        result = {
            'symbol': normalized_symbol,
            'threshold': threshold_vnd,
            'source': data_source,
            'weights_version': score_config['version'],
            'whale_orders': orders[:50],
            'summary': {
                'buy_value': total_buy_value,
                'sell_value': total_sell_value,
                'flow_net': total_buy_value - total_sell_value,
                'shark_value': shark_value,
                'whale_value': whale_value_total,
                'small_value': small_value,
                'shark_pct': round(shark_value / total_value * 100, 1) if total_value > 0 else 0,
                'whale_pct': round(whale_value_total / total_value * 100, 1) if total_value > 0 else 0,
                'small_pct': round(small_value / total_value * 100, 1) if total_value > 0 else 0,
            },
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
        cursor_payload = self._decode_whale_feed_cursor(query_params.get('cursor'))

        if query_params.get('cursor') and cursor_payload is None:
            raise MarketDataValidationException('cursor không hợp lệ.')
        if cursor_payload is not None:
            cursor_sort = str(cursor_payload.get('sort', '')).strip().lower()
            if cursor_sort and cursor_sort != sort:
                raise MarketDataValidationException('cursor không hợp lệ cho sort hiện tại.')

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
                limit=limit,
                source='intraday_tick_db',
            )

        stream_records = self._build_stream_aggregate_records(symbols, min_threshold_vnd)
        if stream_records:
            stream_records = [
                record for record in stream_records
                if float(record.get('matched_value') or 0.0) >= _resolve_threshold_for_symbol(record.get('symbol'))
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
                limit=limit,
                score_config=score_config,
                now=request_now,
            )

        queryset = (
            IntradayTick.objects
            .filter(trade_date=timezone.localdate(), symbol__in=symbols)
            .annotate(matched_value=ExpressionWrapper(F('price') * F('volume'), output_field=FloatField()))
            .filter(matched_value__gte=min_threshold_vnd)
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

        rows = [
            row for row in queryset
            if float(getattr(row, 'matched_value', 0) or 0.0) >= _resolve_threshold_for_symbol(getattr(row, 'symbol', ''))
        ]
        has_more = len(rows) > limit
        page_rows = rows[:limit]

        if not page_rows:
            vnstock_records = self._build_vnstock_aggregate_records(symbols, min_threshold_vnd)
            if vnstock_records:
                vnstock_records = [
                    record for record in vnstock_records
                    if float(record.get('matched_value') or 0.0) >= _resolve_threshold_for_symbol(record.get('symbol'))
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
                limit=limit,
                score_config=score_config,
                now=request_now,
            )

        next_cursor = None
        if has_more and page_rows:
            next_cursor = self._build_next_cursor_from_db_row(page_rows[-1], sort)

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
            limit=limit,
        )

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
                source='VCI',
            )
        except ExternalSystemException as exc:
            if exc.code == 'vnstock_missing':
                raise exc
            raise ExternalSystemException(
                f'Không lấy được dữ liệu tài chính: {exc.message}',
                code=exc.code,
                payload=exc.payload,
            ) from exc

        if df is None or df.empty:
            return {'symbol': normalized_symbol, 'years': []}

        years = []
        for _, row in df.head(5).iterrows():
            year_value = row.get(('Meta', 'Năm')) or row.get('Năm')
            years.append(
                {
                    'year': int(year_value) if year_value else None,
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

        result = {
            'symbol': normalized_symbol,
            'years': years,
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

        payload = self._build_stock_workspace_overview_base(normalized_symbol, user)

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

        try:
            end_date = timezone.localdate().strftime('%Y-%m-%d')
            start_date = (timezone.localdate() - timedelta(days=365)).strftime('%Y-%m-%d')
            history_df = fetch_history_dataframe(
                normalized_symbol,
                start=start_date,
                end=end_date,
                interval='1D',
                source='VCI',
            )
            if history_df is not None and not history_df.empty and 'high' in history_df.columns:
                scale = 1000.0
                week52_high = round(float(history_df['high'].max()) * scale, 0)
                week52_low = round(float(history_df['low'].min()) * scale, 0)
                if week52_high > 0:
                    payload['week52_high'] = week52_high
                if week52_low > 0:
                    payload['week52_low'] = week52_low
        except ExternalSystemException as exc:
            logger.debug('StockWorkspaceOverview refactor 52W overlay lỗi %s: %s', normalized_symbol, exc)

        if not payload.get('company_name'):
            try:
                listing_df = fetch_listing_symbols_dataframe(symbol=normalized_symbol, source='VCI')
                if listing_df is not None and not listing_df.empty:
                    row = listing_df[listing_df['symbol'] == normalized_symbol]
                    if not row.empty:
                        company_name = str(row.iloc[0].get('organ_name') or '').strip()
                        if company_name:
                            payload['company_name'] = company_name
            except ExternalSystemException as exc:
                logger.debug('StockWorkspaceOverview refactor listing overlay lỗi %s: %s', normalized_symbol, exc)

        serialized = StockWorkspaceOverviewSerializer(payload).data
        set_cache(cache_key, serialized, timeout=12)
        return serialized

    def get_stock_workspace_chart(self, user, symbol: str, days_raw) -> dict:
        normalized_symbol = self.normalize_symbol(symbol)
        try:
            days = int(days_raw or 180)
        except (TypeError, ValueError):
            days = 180
        days = min(max(days, 30), 365)

        end_date = timezone.localdate()
        start_date = end_date - timedelta(days=days)

        cache_key = f'chart:{normalized_symbol}:{days}'
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
                interval='1D',
                source='KBS',
            )
            if df is not None and not df.empty:
                series = []
                for _, row in df.iterrows():
                    try:
                        raw_time = row.get('time', row.get('date', ''))
                        point_date = raw_time.date() if hasattr(raw_time, 'date') else date.fromisoformat(str(raw_time)[:10])
                        series.append(
                            {
                                'date': str(point_date),
                                'open': float(row['open']) if row.get('open') is not None else None,
                                'high': float(row['high']) if row.get('high') is not None else None,
                                'low': float(row['low']) if row.get('low') is not None else None,
                                'close': float(row['close']),
                                'volume': float(row['volume']) if row.get('volume') is not None else None,
                            }
                        )
                    except (TypeError, ValueError, KeyError):
                        continue
                technical_rows = [{'close_price': point['close'], 'volume': point['volume']} for point in series]
        except ExternalSystemException as exc:
            logger.warning('StockWorkspaceChart refactor vnstock lỗi %s: %s', normalized_symbol, exc)

        if not series:
            db_rows = list(
                DailyPrice.objects
                .filter(symbol=normalized_symbol, date__range=(start_date, end_date))
                .order_by('date')
                .values('date', 'open_price', 'high_price', 'low_price', 'close_price', 'volume')
            )
            series = [
                {
                    'date': str(row['date']),
                    'open': self._to_float(row['open_price']),
                    'high': self._to_float(row['high_price']),
                    'low': self._to_float(row['low_price']),
                    'close': float(row['close_price']),
                    'volume': self._to_float(row['volume']),
                }
                for row in db_rows
            ]
            technical_rows = db_rows

        overview = self._build_stock_workspace_overview_base(normalized_symbol, user)
        payload = {
            'symbol': normalized_symbol,
            'days': days,
            'start_date': str(start_date),
            'end_date': str(end_date),
            'points': StockWorkspaceChartPointSerializer(series, many=True).data,
            'technical': StockWorkspaceTechnicalSerializer(
                self._compute_stock_workspace_technical(technical_rows or [], overview)
            ).data,
        }

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
        }

    def _build_stream_trades(self, stream_ticks: list[dict]) -> list[dict]:
        trades = []
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
            if price_val is None:
                continue
            trades.append(
                {
                    'time': time_str,
                    'price': price_val,
                    'volume': volume_val,
                    'side': side,
                    'match_type': tick.get('side', ''),
                }
            )
        return trades

    def _build_dataframe_trades(self, df) -> list[dict]:
        trades = []
        for _, row in df.iterrows():
            raw_time = row.get('time') or row.get('tradingDate') or row.get('date') or ''
            raw_price = row.get('price') or row.get('close') or 0
            raw_volume = row.get('volume') or row.get('vol') or row.get('matchVolume') or 0
            match_type_raw = str(row.get('match_type') or row.get('matchType') or row.get('side') or '')
            try:
                price_val = float(raw_price) if raw_price else None
                volume_val = int(float(raw_volume)) if raw_volume else None
            except (ValueError, TypeError):
                price_val = None
                volume_val = None

            if price_val is None:
                continue

            trades.append(
                {
                    'time': self._format_time(raw_time),
                    'price': price_val,
                    'volume': volume_val,
                    'side': self._normalize_side(match_type_raw),
                    'match_type': match_type_raw,
                }
            )
        return trades

    def _format_time(self, raw_time) -> str:
        try:
            import pandas as pd

            return pd.Timestamp(raw_time).strftime('%H:%M:%S')
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
        score_config: dict | None = None,
        now=None,
    ) -> dict:
        try:
            occurred_at = timezone.make_aware(
                datetime.fromisoformat(str(raw_time).replace('Z', '+00:00')),
                timezone.get_current_timezone(),
            ).isoformat()
        except Exception:
            try:
                occurred_at = timezone.make_aware(
                    datetime.combine(timezone.localdate(), datetime.strptime(str(raw_time)[:8], '%H:%M:%S').time()),
                    timezone.get_current_timezone(),
                ).isoformat()
            except Exception:
                occurred_at = timezone.now().isoformat()

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

        try:
            time_str = datetime.fromisoformat(occurred_at.replace('Z', '+00:00')).strftime('%H:%M:%S')
        except Exception:
            time_str = str(raw_time)[:8]

        return {
            'time': time_str,
            'ts': occurred_at,
            'price': raw_price,
            'volume': int(raw_vol),
            'matched_value': matched_value,
            'side': side,
            'size_class': size_class,
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
        for _, row in df.iterrows():
            try:
                raw_price = float(row.get('price') or row.get('close') or 0)
                raw_vol = float(row.get('volume') or row.get('vol') or row.get('matchVolume') or 0)
            except (ValueError, TypeError):
                continue
            if raw_price * raw_vol >= threshold_vnd:
                return True
        return False

    def _build_empty_whale_feed_response(self, symbol: str, threshold_vnd: float, data_source: str) -> dict:
        return {
            'symbol': symbol,
            'threshold': threshold_vnd,
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
            'fetched_at': timezone.now().isoformat(),
        }

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
        return {
            'id': row.id,
            'event_id': f'tick:{row.id}',
            'contract_version': '1.0',
            'config_version': WHALE_CONFIG_VERSION,
            'weights_version': score_result['weights_version'],
            'symbol': row.symbol.upper(),
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
                    price = float(tick.get('price') or 0)
                    volume = float(tick.get('volume') or 0)
                except (TypeError, ValueError):
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

            if df is None or df.empty:
                continue

            for _, row in df.iterrows():
                try:
                    price = float(row.get('price') or row.get('close') or 0)
                    volume = float(row.get('volume') or row.get('vol') or row.get('matchVolume') or 0)
                except (TypeError, ValueError):
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
        if set(cursor_payload.keys()) != expected_keys:
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
        if set(cursor_payload.keys()) != expected_keys:
            return None
        try:
            matched_value = float(cursor_payload['matched_value'])
            row_id = int(cursor_payload['id'])
        except (KeyError, TypeError, ValueError):
            return None
        return matched_value, row_id

    def _build_next_cursor_from_record(self, record: dict, sort: str) -> str:
        if sort == 'matched_value':
            return self._encode_whale_feed_cursor({
                'sort': sort,
                'matched_value': float(record['matched_value']),
                'id': int(record['id']),
            })
        last_dt = datetime.fromisoformat(str(record['ts']).replace('Z', '+00:00'))
        return self._encode_whale_feed_cursor({
            'sort': sort,
            'trade_date': last_dt.date().isoformat(),
            'trade_time': last_dt.time().isoformat(),
            'id': int(record['id']),
        })

    def _build_next_cursor_from_db_row(self, row, sort: str) -> str:
        if sort == 'matched_value':
            return self._encode_whale_feed_cursor({
                'sort': sort,
                'matched_value': float(getattr(row, 'matched_value', 0) or 0),
                'id': row.id,
            })
        return self._encode_whale_feed_cursor({
            'sort': sort,
            'trade_date': row.trade_date.isoformat(),
            'trade_time': row.trade_time.isoformat(),
            'id': row.id,
        })

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
        limit: int,
        score_config: dict,
        now,
    ) -> dict:
        has_more = len(normalized_records) > limit
        page_rows = normalized_records[:limit]
        next_cursor = self._build_next_cursor_from_record(page_rows[-1], sort) if has_more and page_rows else None
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

        average_price = None
        if latest_daily_price:
            numeric_prices = [
                value
                for value in [
                    latest_daily_price.get('open_price'),
                    latest_daily_price.get('high_price'),
                    latest_daily_price.get('low_price'),
                    latest_daily_price.get('close_price'),
                ]
                if value is not None
            ]
            if numeric_prices:
                average_price = self._to_float(sum(numeric_prices, Decimal('0')) / Decimal(len(numeric_prices)))

        reference_price = price_info.get('prev_price')
        if reference_price is None and latest_daily_price:
            reference_price = self._to_float(latest_daily_price.get('close_price'))

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
            'current_price': price_info.get('current_price'),
            'prev_price': price_info.get('prev_price'),
            'change_value': price_info.get('change_value'),
            'change_pct': price_info.get('change_pct'),
            'last_date': price_info.get('last_date'),
            'open_price': self._to_float(latest_daily_price.get('open_price')) if latest_daily_price else None,
            'high_price': self._to_float(latest_daily_price.get('high_price')) if latest_daily_price else None,
            'low_price': self._to_float(latest_daily_price.get('low_price')) if latest_daily_price else None,
            'close_price': self._to_float(latest_daily_price.get('close_price')) if latest_daily_price else None,
            'volume': latest_daily_price.get('volume') if latest_daily_price else None,
            'average_price': average_price,
            'reference_price': reference_price,
            'ceiling_price': ceiling_price,
            'floor_price': floor_price,
            'week52_high': self._to_float(year_stats.get('week52_high')),
            'week52_low': self._to_float(year_stats.get('week52_low')),
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
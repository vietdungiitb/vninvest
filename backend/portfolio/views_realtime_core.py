from datetime import date, datetime

from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .exceptions import ExternalSystemException
from .models import DailyPrice, IntradayTick, SecuritiesItem

PREFETCH_ENQUEUE_LOCK_KEY = 'ticker:prefetch:enqueue:lock'
ONDEMAND_TICKER_LOCK_PREFIX = 'ticker:ondemand:lock'


def _intraday_last_good_cache_key(symbol: str) -> str:
    return f'intraday:last_good:{str(symbol or '').strip().upper()}'


def _build_intraday_trades_from_db(symbol: str, page_size: int):
    normalized_symbol = str(symbol or '').strip().upper()
    if not normalized_symbol:
        return []

    today = timezone.localdate()
    queryset = (
        IntradayTick.objects.filter(symbol=normalized_symbol, trade_date=today)
        .order_by('-trade_time', '-id')[:page_size]
    )

    rows = list(queryset)
    if not rows:
        latest = (
            IntradayTick.objects.filter(symbol=normalized_symbol)
            .order_by('-trade_date', '-trade_time', '-id')
            .values('trade_date')
            .first()
        )
        latest_trade_date = latest.get('trade_date') if latest else None
        if latest_trade_date is not None:
            rows = list(
                IntradayTick.objects.filter(symbol=normalized_symbol, trade_date=latest_trade_date)
                .order_by('-trade_time', '-id')[:page_size]
            )

    trades = []
    for row in rows:
        side_raw = str(row.side or '').upper()
        side = 'buy' if side_raw == 'BUY' else ('sell' if side_raw == 'SELL' else 'neutral')
        trades.append(
            {
                'time': row.trade_time.strftime('%H:%M:%S') if row.trade_time else '',
                'price': float(row.price) if row.price is not None else None,
                'volume': int(row.volume) if row.volume is not None else None,
                'side': side,
                'match_type': row.match_type or side_raw,
            }
        )

    return trades


def _legacy_views_module():
    from . import views as legacy_views

    return legacy_views


class RealtimeTickerView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'realtime_ticker'

    def get(self, request, symbol):
        legacy_views = _legacy_views_module()
        normalized_symbol = (symbol or '').strip().upper()
        if not normalized_symbol or len(normalized_symbol) > 10:
            return Response({'detail': 'Thiếu mã chứng khoán.'}, status=status.HTTP_400_BAD_REQUEST)

        ticker_cache_key = f'ticker:{normalized_symbol}'
        cached_ticker = legacy_views._cache_get(ticker_cache_key)
        if cached_ticker is not None:
            return Response(cached_ticker)

        if not legacy_views._is_vnstock_rate_limited('price_board'):
            lock_key = f'{ONDEMAND_TICKER_LOCK_PREFIX}:{normalized_symbol}'
            try:
                lock_acquired = legacy_views.cache.add(lock_key, 1, timeout=3)
            except Exception:
                lock_acquired = False

            if lock_acquired:
                try:
                    df = legacy_views.fetch_price_board_dataframe([normalized_symbol], anchor_symbol=normalized_symbol)
                    if df is not None and not df.empty:
                        def _select_symbol_row(frame, expected_symbol):
                            normalized_expected = str(expected_symbol or '').strip().upper()
                            candidate_columns = ('symbol', 'ticker', 'code', 'stock_symbol')

                            for column_name in candidate_columns:
                                if column_name in frame.columns:
                                    try:
                                        matches = frame[
                                            frame[column_name].astype(str).str.strip().str.upper() == normalized_expected
                                        ]
                                    except Exception:
                                        matches = frame.iloc[0:0]
                                    if not matches.empty:
                                        return matches.iloc[0]

                            try:
                                for idx, index_value in enumerate(frame.index):
                                    if str(index_value or '').strip().upper() == normalized_expected:
                                        return frame.iloc[idx]
                            except Exception:
                                pass

                            return frame.iloc[0]

                        row = _select_symbol_row(df, normalized_symbol)
                        try:
                            listing = row.get('listing', {})
                            match = row.get('match', {})
                        except Exception:
                            listing = {}
                            match = {}

                        def _safe_float(value):
                            try:
                                number = float(value)
                            except (TypeError, ValueError):
                                return None
                            return number if number == number else None

                        def _safe_int(value):
                            try:
                                return int(float(value))
                            except (TypeError, ValueError):
                                return None

                        match_price = (
                            _safe_float(match.get('match_price'))
                            or _safe_float(row.get('match_price'))
                            or _safe_float(row.get('close_price'))
                            or _safe_float(row.get('current_price'))
                        )
                        ref_price = (
                            _safe_float(listing.get('ref_price'))
                            or _safe_float(match.get('reference_price'))
                            or _safe_float(row.get('ref_price'))
                            or _safe_float(row.get('reference_price'))
                            or _safe_float(row.get('ceiling_price'))
                            or _safe_float(row.get('floor_price'))
                        )
                        ceiling_price = (
                            _safe_float(listing.get('ceiling'))
                            or _safe_float(match.get('ceiling_price'))
                            or _safe_float(row.get('ceiling'))
                            or _safe_float(row.get('ceiling_price'))
                        )
                        floor_price = (
                            _safe_float(listing.get('floor'))
                            or _safe_float(match.get('floor_price'))
                            or _safe_float(row.get('floor'))
                            or _safe_float(row.get('floor_price'))
                        )
                        open_price = _safe_float(match.get('open_price')) or _safe_float(row.get('open_price'))
                        high_price = (
                            _safe_float(match.get('highest'))
                            or _safe_float(row.get('highest'))
                            or _safe_float(row.get('high_price'))
                        )
                        low_price = (
                            _safe_float(match.get('lowest'))
                            or _safe_float(row.get('lowest'))
                            or _safe_float(row.get('low_price'))
                        )
                        average_price = (
                            _safe_float(match.get('average_price'))
                            or _safe_float(row.get('average_price'))
                        )

                        if match_price is not None:
                            explicit_change_value = (
                                _safe_float(match.get('price_change'))
                                or _safe_float(row.get('price_change'))
                            )
                            explicit_change_pct = (
                                _safe_float(match.get('percent_change'))
                                or _safe_float(row.get('percent_change'))
                            )
                            change_value = round(match_price - ref_price, 2) if ref_price is not None else None
                            change_pct = (
                                round((match_price - ref_price) / ref_price * 100, 2)
                                if ref_price not in (None, 0)
                                else None
                            )
                            if explicit_change_value is not None:
                                change_value = explicit_change_value
                            if explicit_change_pct is not None:
                                change_pct = explicit_change_pct
                            if average_price is None:
                                prices = [value for value in [open_price, high_price, low_price, match_price] if value is not None]
                                if len(prices) >= 2:
                                    average_price = round(sum(prices) / len(prices), 2)
                            payload = {
                                'symbol': normalized_symbol,
                                'current_price': match_price,
                                'prev_price': ref_price,
                                'reference_price': ref_price,
                                'ceiling_price': ceiling_price,
                                'floor_price': floor_price,
                                'average_price': average_price,
                                'change_value': change_value,
                                'change_pct': change_pct,
                                'open_price': open_price,
                                'high_price': high_price,
                                'low_price': low_price,
                                'volume': (
                                    _safe_int(match.get('accumulated_volume'))
                                    or _safe_int(row.get('accumulated_volume'))
                                    or _safe_int(row.get('volume_accumulated'))
                                ),
                                'last_date': timezone.now().isoformat(),
                                'freshness_seconds': 0,
                                'stale': False,
                                'source': 'vnstock_on_demand',
                            }
                            legacy_views._cache_set(ticker_cache_key, payload, timeout=20)
                            return Response(payload)
                except ExternalSystemException as exc:
                    if exc.code == 'vnstock_rate_limited':
                        legacy_views._mark_vnstock_rate_limited('price_board', exc)
                except Exception:
                    pass
                finally:
                    try:
                        legacy_views.cache.delete(lock_key)
                    except Exception:
                        pass

        try:
            from portfolio.tasks import prefetch_ticker_price_board
            if legacy_views.cache.add(PREFETCH_ENQUEUE_LOCK_KEY, 1, timeout=15):
                prefetch_ticker_price_board.apply_async(countdown=0)
        except Exception:
            pass

        price_info = legacy_views.get_price_changes([normalized_symbol]).get(normalized_symbol, {})
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
            DailyPrice.objects.filter(symbol=normalized_symbol)
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

        return Response(
            {
                'symbol': normalized_symbol,
                **price_info,
                **ohlc_extra,
                'freshness_seconds': freshness_seconds,
                'stale': stale,
                'source': 'db_fallback',
                'fallback_reason': 'cache_miss_no_realtime_tick',
            }
        )


class IntradayMatchedView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'realtime_intraday'

    def get(self, request, symbol):
        legacy_views = _legacy_views_module()
        normalized_symbol = (symbol or '').strip().upper()
        if not normalized_symbol or len(normalized_symbol) > 10:
            return Response({'detail': 'Thiếu mã chứng khoán.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            page_size = int(request.query_params.get('page_size', 50))
            page_size = max(10, min(200, page_size))
        except (ValueError, TypeError):
            page_size = 50

        cache_key = f'intraday:{normalized_symbol}:{page_size}'
        last_good_key = _intraday_last_good_cache_key(normalized_symbol)
        cached = legacy_views._cache_get(cache_key)
        if cached is not None:
            return Response(cached)

        def _response_from_last_good(reason: str):
            last_good = legacy_views._cache_get(last_good_key)
            if isinstance(last_good, dict) and (last_good.get('trades') or []):
                stale_payload = {
                    **last_good,
                    'symbol': normalized_symbol,
                    'source': f"stale_cache:{reason}",
                    'stale': True,
                    'fallback_reason': reason,
                    'fetched_at': timezone.now().isoformat(),
                }
                legacy_views._cache_set(cache_key, stale_payload, timeout=5)
                return stale_payload
            return None

        def _response_from_intraday_db(reason: str):
            trades = _build_intraday_trades_from_db(normalized_symbol, page_size)
            if not trades:
                return None
            payload = {
                'symbol': normalized_symbol,
                'trades': trades,
                'total': len(trades),
                'source': f"intraday_db:{reason}",
                'stale': True,
                'fallback_reason': reason,
                'fetched_at': timezone.now().isoformat(),
            }
            legacy_views._cache_set(cache_key, payload, timeout=8)
            legacy_views._cache_set(last_good_key, payload, timeout=900)
            return payload

        try:
            from portfolio.realtime.stream_reader import StreamReader

            _reader = StreamReader()
            stream_ticks = _reader.get_intraday_ticks(normalized_symbol, count=page_size)
            if stream_ticks:
                trades = []
                for tick in stream_ticks:
                    raw_time = tick.get('ts', '')
                    try:
                        import pandas as _pd

                        ts = _pd.Timestamp(raw_time)
                        time_str = ts.strftime('%H:%M:%S')
                    except Exception:
                        time_str = str(raw_time)[:8]
                    side_raw = tick.get('side', 'UNKNOWN').lower()
                    side = 'buy' if side_raw == 'buy' else ('sell' if side_raw == 'sell' else 'neutral')
                    try:
                        price_val = float(tick.get('price', 0)) or None
                        vol_val = int(float(tick.get('volume', 0)))
                    except (ValueError, TypeError):
                        price_val = None
                        vol_val = None
                    if price_val is None:
                        continue
                    trades.append(
                        {
                            'time': time_str,
                            'price': price_val,
                            'volume': vol_val,
                            'side': side,
                            'match_type': tick.get('side', ''),
                        }
                    )
                if trades:
                    result = {
                        'symbol': normalized_symbol,
                        'trades': trades,
                        'total': len(trades),
                        'source': 'stream',
                        'stale': False,
                        'fetched_at': timezone.now().isoformat(),
                    }
                    legacy_views._cache_set(cache_key, result, timeout=8)
                    legacy_views._cache_set(last_good_key, result, timeout=900)
                    return Response(result)
        except (Exception, SystemExit) as exc:
            legacy_views.logger.debug('Stream fallback failed for %s: %s', normalized_symbol, exc)

        try:
            df = legacy_views.fetch_intraday_dataframe(symbol=normalized_symbol, page_size=page_size)
        except ExternalSystemException as exc:
            if exc.code == 'vnstock_missing':
                return Response({'detail': 'vnstock chưa được cài đặt.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
            if exc.code == 'vnstock_rate_limited':
                legacy_views._mark_vnstock_rate_limited('intraday', exc)
                cached_payload = _response_from_last_good('vnstock_backoff')
                if cached_payload is not None:
                    cached_payload['rate_limited'] = True
                    return Response(cached_payload)
                db_payload = _response_from_intraday_db('vnstock_backoff')
                if db_payload is not None:
                    db_payload['rate_limited'] = True
                    return Response(db_payload)
                return Response(
                    {
                        'symbol': normalized_symbol,
                        'trades': [],
                        'total': 0,
                        'source': 'vnstock_backoff',
                        'rate_limited': True,
                        'fetched_at': timezone.now().isoformat(),
                    }
                )
            if exc.code == 'vnstock_timeout':
                cached_payload = _response_from_last_good('timeout')
                if cached_payload is not None:
                    return Response(cached_payload)
                db_payload = _response_from_intraday_db('timeout')
                if db_payload is not None:
                    return Response(db_payload)
                return Response(
                    {
                        'symbol': normalized_symbol,
                        'trades': [],
                        'total': 0,
                        'source': 'timeout',
                        'fetched_at': timezone.now().isoformat(),
                    }
                )
            legacy_views.logger.warning('IntradayMatchedView lỗi vnstock %s: %s', normalized_symbol, exc)
            cached_payload = _response_from_last_good('vnstock_unavailable')
            if cached_payload is not None:
                return Response(cached_payload)
            db_payload = _response_from_intraday_db('vnstock_unavailable')
            if db_payload is not None:
                return Response(db_payload)
            return Response(
                {
                    'symbol': normalized_symbol,
                    'trades': [],
                    'total': 0,
                    'source': 'vnstock_unavailable',
                    'fetched_at': timezone.now().isoformat(),
                }
            )
        except Exception as exc:
            legacy_views.logger.exception('IntradayMatchedView unexpected error %s: %s', normalized_symbol, exc)
            cached_payload = _response_from_last_good('error')
            if cached_payload is not None:
                return Response(cached_payload)
            db_payload = _response_from_intraday_db('error')
            if db_payload is not None:
                return Response(db_payload)
            return Response(
                {
                    'symbol': normalized_symbol,
                    'trades': [],
                    'total': 0,
                    'source': 'error',
                    'fetched_at': timezone.now().isoformat(),
                }
            )

        if df is None or df.empty:
            cached_payload = _response_from_last_good('empty')
            if cached_payload is not None:
                return Response(cached_payload)
            db_payload = _response_from_intraday_db('empty')
            if db_payload is not None:
                return Response(db_payload)
            return Response({'symbol': normalized_symbol, 'trades': [], 'total': 0, 'fetched_at': timezone.now().isoformat()})

        trades = []
        for _, row in df.iterrows():
            raw_time = row.get('time') or row.get('tradingDate') or row.get('date') or ''
            raw_price = row.get('price') or row.get('close') or 0
            raw_vol = row.get('volume') or row.get('vol') or row.get('matchVolume') or 0

            match_type_raw = str(row.get('match_type') or row.get('matchType') or row.get('side') or '')
            mt_lower = match_type_raw.lower()
            if mt_lower in ('buy', 'bu', 'b'):
                side = 'buy'
            elif mt_lower in ('sell', 'sd', 's'):
                side = 'sell'
            else:
                side = 'neutral'

            try:
                price_val = float(raw_price) if raw_price else None
                vol_val = int(float(raw_vol)) if raw_vol else None
            except (ValueError, TypeError):
                price_val = None
                vol_val = None

            if price_val is None:
                continue

            try:
                import pandas as pd

                ts = pd.Timestamp(raw_time)
                time_str = ts.strftime('%H:%M:%S')
            except Exception:
                time_str = str(raw_time)[:8]

            trades.append(
                {
                    'time': time_str,
                    'price': price_val,
                    'volume': vol_val,
                    'side': side,
                    'match_type': match_type_raw,
                }
            )

        result = {
            'symbol': normalized_symbol,
            'trades': trades,
            'total': len(trades),
            'source': 'vnstock',
            'stale': False,
            'fetched_at': timezone.now().isoformat(),
        }
        legacy_views._cache_set(cache_key, result, timeout=8)
        legacy_views._cache_set(last_good_key, result, timeout=900)
        return Response(result)


class PriceBoardView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'realtime_price_board'

    def get(self, request, symbol):
        legacy_views = _legacy_views_module()
        normalized_symbol = (symbol or '').strip().upper()
        if not normalized_symbol or len(normalized_symbol) > 10:
            return Response({'detail': 'Thiếu mã chứng khoán.'}, status=status.HTTP_400_BAD_REQUEST)

        cache_key = f'price_board:{normalized_symbol}'
        cached = legacy_views._cache_get(cache_key)
        if cached is not None:
            return Response(cached)

        if legacy_views._is_vnstock_rate_limited('price_board'):
            return Response({'symbol': normalized_symbol, 'depth': [], 'match': {}, 'source': 'vnstock_backoff', 'rate_limited': True})

        try:
            df = legacy_views.fetch_price_board_dataframe([normalized_symbol], anchor_symbol=normalized_symbol)
        except ExternalSystemException as exc:
            if exc.code == 'vnstock_missing':
                return Response({'detail': 'vnstock chưa được cài đặt.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
            if exc.code == 'vnstock_rate_limited':
                legacy_views._mark_vnstock_rate_limited('price_board', exc)
                return Response({'symbol': normalized_symbol, 'depth': [], 'match': {}, 'source': 'vnstock_backoff', 'rate_limited': True})
            if exc.code == 'vnstock_timeout':
                return Response({'symbol': normalized_symbol, 'depth': [], 'match': {}, 'source': 'timeout', 'fetched_at': timezone.now().isoformat()})
            legacy_views.logger.warning('PriceBoardView lỗi vnstock %s: %s', normalized_symbol, exc)
            return Response({'symbol': normalized_symbol, 'depth': [], 'match': {}, 'source': 'vnstock_unavailable', 'fetched_at': timezone.now().isoformat()})
        except Exception as exc:
            legacy_views.logger.exception('PriceBoardView unexpected fetch error %s: %s', normalized_symbol, exc)
            return Response({'symbol': normalized_symbol, 'depth': [], 'match': {}, 'source': 'error', 'fetched_at': timezone.now().isoformat()})

        if df is None or df.empty:
            return Response({'symbol': normalized_symbol, 'depth': [], 'match': {}})

        def safe_float(val):
            try:
                v = float(val)
                return v if v == v else None
            except (TypeError, ValueError):
                return None

        def safe_int(val):
            try:
                v = float(val)
                return int(v) if v == v else None
            except (TypeError, ValueError):
                return None

        try:
            ba = df['bid_ask'].iloc[0]
            mt = df['match'].iloc[0]
        except Exception as exc:
            legacy_views.logger.warning('PriceBoardView malformed payload %s: %s', normalized_symbol, exc)
            return Response({'symbol': normalized_symbol, 'depth': [], 'match': {}, 'source': 'payload_invalid', 'fetched_at': timezone.now().isoformat()})

        depth = []
        for i in range(1, 4):
            bp = safe_float(ba.get(f'bid_{i}_price'))
            bv = safe_int(ba.get(f'bid_{i}_volume'))
            ap = safe_float(ba.get(f'ask_{i}_price'))
            av = safe_int(ba.get(f'ask_{i}_volume'))
            if bp is not None or ap is not None:
                depth.append({'level': i, 'bid_price': bp, 'bid_volume': bv, 'ask_price': ap, 'ask_volume': av})

        ref = safe_float(mt.get('reference_price'))
        match_price = safe_float(mt.get('match_price'))
        change_pct = round((match_price - ref) / ref * 100, 2) if ref and match_price else None

        match_data = {
            'match_price': match_price,
            'open_price': safe_float(mt.get('open_price')),
            'highest': safe_float(mt.get('highest')),
            'lowest': safe_float(mt.get('lowest')),
            'reference_price': ref,
            'accumulated_volume': safe_int(mt.get('accumulated_volume')),
            'foreign_buy_volume': safe_int(mt.get('foreign_buy_volume')),
            'foreign_sell_volume': safe_int(mt.get('foreign_sell_volume')),
            'change_pct': change_pct,
        }

        result = {
            'symbol': normalized_symbol,
            'depth': depth,
            'match': match_data,
            'fetched_at': timezone.now().isoformat(),
        }
        legacy_views._cache_set(cache_key, result, timeout=8)
        return Response(result)


class SectorBreadthView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'realtime_breadth'

    def get(self, request, symbol):
        legacy_views = _legacy_views_module()
        normalized_symbol = (symbol or '').strip().upper()
        if not normalized_symbol or len(normalized_symbol) > 10:
            return Response({'detail': 'Thiếu mã chứng khoán.'}, status=status.HTTP_400_BAD_REQUEST)

        cache_key = f'breadth:{normalized_symbol}'
        cached = legacy_views._cache_get(cache_key)
        if cached is not None:
            return Response(cached)

        group_items = SecuritiesItem.objects.filter(symbol=normalized_symbol).select_related('group').order_by('group__order', 'group__name')[:5]

        if not group_items.exists():
            return Response({'symbol': normalized_symbol, 'groups': [], 'fetched_at': timezone.now().isoformat()})

        groups_meta = []
        all_symbols = set()
        for item in group_items:
            group = item.group
            peers = list(
                SecuritiesItem.objects.filter(group=group)
                .exclude(symbol=normalized_symbol)
                .values_list('symbol', flat=True)
                .order_by('order', 'symbol')[:14]
            )
            peers.insert(0, normalized_symbol)
            groups_meta.append({'id': group.id, 'name': group.name, 'symbols': peers})
            all_symbols.update(peers)

        all_symbols = list(all_symbols)

        price_map = {}
        missing_syms = []
        for sym in all_symbols:
            cached_t = legacy_views._cache_get(f'ticker:{sym}')
            if cached_t:
                match_price = cached_t.get('current_price')
                ref_price = cached_t.get('prev_price')
                try:
                    chg = round((match_price - ref_price) / ref_price * 100, 2) if match_price and ref_price else None
                except (TypeError, ZeroDivisionError):
                    chg = None
                status_val = 'up' if chg and chg > 0.5 else 'down' if chg and chg < -0.5 else 'flat'
                price_map[sym.upper()] = {'price': match_price, 'change_pct': chg, 'status': status_val}
            else:
                missing_syms.append(sym)

        if missing_syms:
            df = None
            try:
                df = legacy_views.fetch_price_board_dataframe(missing_syms, anchor_symbol=normalized_symbol)
            except ExternalSystemException as exc:
                if exc.code == 'vnstock_timeout':
                    legacy_views.logger.warning('SectorBreadthView timeout fetching %d missing syms for %s', len(missing_syms), normalized_symbol)
                else:
                    legacy_views.logger.warning('SectorBreadthView lỗi vnstock %s: %s', normalized_symbol, exc)

            if df is not None and not df.empty:
                for _, row in df.iterrows():
                    sym = str(row.get(('listing', 'symbol')) or '').upper()
                    if not sym:
                        continue
                    try:
                        ref = float(row.get(('match', 'reference_price')) or 0)
                        price = float(row.get(('match', 'match_price')) or 0)
                        chg = round((price - ref) / ref * 100, 2) if ref > 0 else None
                    except (TypeError, ValueError):
                        chg = None
                        price = None
                    status_val = 'up' if chg and chg > 0.5 else 'down' if chg and chg < -0.5 else 'flat'
                    price_map[sym] = {'price': price, 'change_pct': chg, 'status': status_val}

        result_groups = []
        for gm in groups_meta:
            peers = []
            for s in gm['symbols']:
                info = price_map.get(s.upper(), {})
                peers.append(
                    {
                        'symbol': s,
                        'price': info.get('price'),
                        'change_pct': info.get('change_pct'),
                        'status': info.get('status', 'flat'),
                        'is_self': s == normalized_symbol,
                    }
                )
            result_groups.append({'name': gm['name'], 'peers': peers})

        result = {
            'symbol': normalized_symbol,
            'groups': result_groups,
            'fetched_at': timezone.now().isoformat(),
        }
        legacy_views._cache_set(cache_key, result, timeout=30)
        return Response(result)

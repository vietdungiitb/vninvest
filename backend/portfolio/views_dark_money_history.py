"""
Dark Money History API — W2+W4 Module
Provides combined historical view of:
  - OHLC price candles (via vnstock adapter)
  - Dark flow strength time series (from OrderFlowSignal DB)
  - Whale buy/sell signals (from IntradayTick)
  - Moving averages (MA20, MA50)
  - Smart Money Flow Index
  - Strategy interpretation table
"""
import logging
import statistics
import calendar
from collections import defaultdict
from datetime import date, datetime, timedelta

from django.db.models import Avg, Case, Count, ExpressionWrapper, F, FloatField, Max, Min, Q, Sum, When
from django.db.models.functions import TruncDate, TruncHour, TruncMinute, TruncWeek
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import DailyPrice, IntradayTick, OrderFlowSignal, TrackedSymbol
from .price_units import PriceSource, QUOTE_UNIT_CANONICAL, normalize_quote_price_to_canonical
from .whale_feed_helpers import _resolve_user_whale_threshold_vnd

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
PERIOD_DAYS_MAP = {
    '1M': 30,
    '3M': 90,
    '6M': 180,
    '1Y': 365,
    '10Y': 3650,
}
VALID_INTERVALS = {'1D', '1W', '1h', '30m', '15m'}
INTERVAL_ALIASES = {
    '1d': '1D',
    '1w': '1W',
    '1h': '1h',
    '30m': '30m',
    '15m': '15m',
}
INTRADAY_MAX_DAYS = {'1h': 7, '30m': 3, '15m': 2}
VNSTOCK_INTERVAL_MAP = {'1D': '1D', '1W': '1W', '1h': '60', '30m': '30', '15m': '15'}
TRUNC_FN_MAP = {'1D': TruncDate, '1W': TruncWeek, '1h': TruncHour, '30m': TruncMinute, '15m': TruncMinute}
MA_WINDOWS = [20, 50]
SMFI_LOOKBACK_SESSIONS = 20


def _normalize_interval(value: str) -> str:
    return INTERVAL_ALIASES.get(str(value or '').strip().lower(), '1D')


def _to_unix_seconds(value) -> int | None:
    if value is None:
        return None
    dt_val = None
    if isinstance(value, datetime):
        dt_val = value
    elif hasattr(value, 'to_pydatetime'):
        dt_val = value.to_pydatetime()
    else:
        text = str(value).strip()
        if text.isdigit():
            return int(text)
        try:
            dt_val = datetime.fromisoformat(text.replace('Z', '+00:00'))
        except ValueError:
            return None
    return calendar.timegm(dt_val.timetuple())


def _floor_intraday_bucket(value: datetime, interval: str):
    if interval == '1h':
        return value.replace(minute=0, second=0, microsecond=0)
    if interval == '30m':
        return value.replace(minute=(value.minute // 30) * 30, second=0, microsecond=0)
    if interval == '15m':
        return value.replace(minute=(value.minute // 15) * 15, second=0, microsecond=0)
    return value


def _resolve_period_days(period: str) -> int:
    return PERIOD_DAYS_MAP.get(period.upper(), 90)


def _normalize_chart_quote_price(value, *, source: PriceSource, symbol: str) -> float:
    try:
        numeric_value = float(value or 0)
    except (TypeError, ValueError):
        return 0.0
    if numeric_value <= 0:
        return 0.0
    source_unit = 'VND' if numeric_value >= 1000 else 'THOUSAND_VND'
    return round(
        normalize_quote_price_to_canonical(
            numeric_value,
            source_unit,
            source=source,
            symbol=symbol,
        ).value,
        2,
    )


def _normalize_tick_side(value) -> str:
    raw = str(value or '').strip().lower()
    if raw in {'buy', 'bu', 'b'}:
        return 'buy'
    if raw in {'sell', 'sd', 's'}:
        return 'sell'
    return 'unknown'


def _build_reference_price_by_trade_date(symbol: str, trade_dates: list[date]) -> dict[date, float]:
    normalized_dates = sorted({d for d in trade_dates if d})
    if not normalized_dates:
        return {}

    rows = list(
        DailyPrice.objects
        .filter(symbol=symbol, date__lt=normalized_dates[-1] + timedelta(days=1))
        .order_by('date')
        .values('date', 'close_price')
    )
    if not rows:
        return {}

    result: dict[date, float] = {}
    pointer = 0
    latest_prev_close = None

    for trade_date in normalized_dates:
      while pointer < len(rows) and rows[pointer]['date'] < trade_date:
          try:
              latest_prev_close = float(rows[pointer]['close_price'] or 0)
          except (TypeError, ValueError):
              latest_prev_close = latest_prev_close
          pointer += 1
      if latest_prev_close and latest_prev_close > 0:
          result[trade_date] = latest_prev_close

    return result


def _compute_moving_averages(candles: list[dict], windows: list[int]) -> dict[str, list[dict]]:
    """Compute simple moving averages from close prices."""
    result = {}
    closes = [c['close'] for c in candles]
    times = [c['time'] for c in candles]

    for w in windows:
        ma_key = f'ma{w}'
        ma_values = []
        for i in range(len(closes)):
            if i < w - 1:
                continue
            window_slice = closes[i - w + 1: i + 1]
            avg = sum(window_slice) / len(window_slice)
            ma_values.append({
                'time': times[i],
                'value': round(avg, 2),
            })
        result[ma_key] = ma_values

    return result


def _compute_smfi(
    whale_buy_value: float,
    whale_sell_value: float,
    avg_session_volume_vnd: float,
) -> float:
    """
    Smart Money Flow Index:
    SMFI = (whale_buy - whale_sell) / avg_20_session_volume * 100
    """
    if avg_session_volume_vnd <= 0:
        return 0.0
    return round((whale_buy_value - whale_sell_value) / avg_session_volume_vnd * 100, 2)


def _build_strategy_table(
    latest_dark_flow_strength: float,
    avg_dark_flow_strength: float,
    latest_whale_signal_type: str | None,
) -> list[dict]:
    """Build the W2+W4 strategy interpretation table with active state."""

    # Determine which row is currently active
    active_row = 3  # default: standby

    if latest_dark_flow_strength > 60 and latest_whale_signal_type == 'buy':
        active_row = 0
    elif latest_dark_flow_strength <= 60 and latest_whale_signal_type == 'buy':
        active_row = 1
    elif latest_whale_signal_type == 'sell':
        # Check for divergence: price up but dark flow dropping
        if latest_dark_flow_strength < avg_dark_flow_strength * 0.7:
            active_row = 2
        else:
            active_row = 2
    elif latest_dark_flow_strength < avg_dark_flow_strength * 0.5:
        active_row = 3

    rows = [
        {
            'id': 'allin',
            'dark_flow_state': 'rising_strong',
            'whale_signal': 'buy',
            'tactical_meaning': 'All-in: Cá mập đẩy xác nhận xu hướng',
            'tactical_meaning_en': 'All-in: Shark confirms trend',
            'risk_level': 'low',
            'is_active': active_row == 0,
        },
        {
            'id': 'accumulate',
            'dark_flow_state': 'flat_or_low',
            'whale_signal': 'buy',
            'tactical_meaning': 'Gom thầm: Tích lũy chưa đánh lên',
            'tactical_meaning_en': 'Silent accumulation: Not yet pushing',
            'risk_level': 'medium',
            'is_active': active_row == 1,
        },
        {
            'id': 'distribute',
            'dark_flow_state': 'divergence_negative',
            'whale_signal': 'sell',
            'tactical_meaning': 'Thoát hàng: Rủi ro tạo đỉnh, hạ tỷ trọng',
            'tactical_meaning_en': 'Distribution: Peak risk, reduce position',
            'risk_level': 'high',
            'is_active': active_row == 2,
        },
        {
            'id': 'standby',
            'dark_flow_state': 'below_average',
            'whale_signal': 'none',
            'tactical_meaning': 'Đứng ngoài: Thị trường ngủ đông, quan sát',
            'tactical_meaning_en': 'Standby: Market hibernating, observe',
            'risk_level': 'none',
            'is_active': active_row == 3,
        },
    ]
    return rows


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dark_money_history_api(request, symbol: str):
    """
    GET /api/stock-management/stocks/<symbol>/dark-money-history/

    Combined W2+W4 endpoint providing:
      - OHLC candles (from vnstock)
      - Dark flow strength time series (from OrderFlowSignal DB)
      - Whale buy/sell signals (from IntradayTick)
      - Moving averages (MA20, MA50)
      - Smart Money Flow Index
      - Strategy interpretation table

        Query params:
            - period: 1M | 3M | 6M | 1Y | 10Y (default: 3M)
    - interval: 1D | 1W | 1h | 30m | 15m (default: 1D)
    """
    normalized_symbol = str(symbol or '').strip().upper()
    if not normalized_symbol or len(normalized_symbol) > 10:
        return Response(
            {'ok': False, 'message': 'Symbol không hợp lệ.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    period = str(request.query_params.get('period', '3M')).strip().upper()
    if period not in PERIOD_DAYS_MAP:
        period = '3M'

    interval = _normalize_interval(request.query_params.get('interval', '1D'))
    if interval not in VALID_INTERVALS:
        interval = '1D'

    period_days = _resolve_period_days(period)
    cutoff_date = date.today() - timedelta(days=period_days)
    # Intraday: giới hạn period tối đa theo INTRADAY_MAX_DAYS
    is_intraday = interval in INTRADAY_MAX_DAYS
    if is_intraday:
        max_days = INTRADAY_MAX_DAYS[interval]
        period_days = min(_resolve_period_days(period), max_days)
    cutoff_date = date.today() - timedelta(days=period_days)

    # ─── 1. Fetch OHLC candles from vnstock ───────────────────────────────
    candles = []
    try:
        from .adapters.vnstock_adapter import fetch_history_dataframe

        vnstock_interval = VNSTOCK_INTERVAL_MAP.get(interval, '1D')
        end_date = date.today().strftime('%Y-%m-%d')
        start_date = cutoff_date.strftime('%Y-%m-%d')

        raw_data = fetch_history_dataframe(
            normalized_symbol,
            start=start_date,
            end=end_date,
            interval=vnstock_interval,
        )

        if raw_data is not None and hasattr(raw_data, 'iterrows'):
            for _, row in raw_data.iterrows():
                try:
                    row_time = None
                    for col in ['time', 'date', 'trading_date']:
                        if col in row.index and row[col] is not None:
                            val = row[col]
                            if hasattr(val, 'strftime'):
                                # Intraday: LW Charts cần Unix timestamp (int seconds)
                                # Daily/Weekly: YYYY-MM-DD string là đủ
                                if is_intraday:
                                    row_time = _to_unix_seconds(val)
                                else:
                                    row_time = val.strftime('%Y-%m-%d')
                            else:
                                row_time = _to_unix_seconds(val) if is_intraday else str(val)[:10]
                            break

                    if not row_time:
                        continue

                    candle = {
                        'time': row_time,
                        'open': _normalize_chart_quote_price(row.get('open', 0), source=PriceSource.VNSTOCK_DAILY, symbol=normalized_symbol),
                        'high': _normalize_chart_quote_price(row.get('high', 0), source=PriceSource.VNSTOCK_DAILY, symbol=normalized_symbol),
                        'low': _normalize_chart_quote_price(row.get('low', 0), source=PriceSource.VNSTOCK_DAILY, symbol=normalized_symbol),
                        'close': _normalize_chart_quote_price(row.get('close', 0), source=PriceSource.VNSTOCK_DAILY, symbol=normalized_symbol),
                        'volume': int(row.get('volume', 0)),
                    }
                    if candle['close'] > 0:
                        candles.append(candle)
                except (ValueError, TypeError, KeyError):
                    continue
    except Exception as exc:
        logger.warning('Failed to fetch OHLC for %s: %s', normalized_symbol, exc)

    # ─── 2. Dark Flow Strength Series (from OrderFlowSignal DB) ───────────
    dark_flow_series = []
    try:
        trunc_fn = TRUNC_FN_MAP.get(interval, TruncDate)
        qs = (
            OrderFlowSignal.objects
            .filter(
                symbol=normalized_symbol,
                created_at__date__gte=cutoff_date,
            )
            .annotate(bucket=trunc_fn('created_at'))
            .values('bucket')
            .annotate(
                avg_strength=Avg('strength'),
                max_strength=Max('strength'),
                signal_count=Count('id'),
                avg_cvd=Avg('cvd_at_signal'),
                avg_price=Avg('price_at_signal'),
            )
            .order_by('bucket')
        )

        for row in qs:
            bucket_date = row['bucket']
            if bucket_date is None:
                continue
            if is_intraday and hasattr(bucket_date, 'replace'):
                bucket_date = _floor_intraday_bucket(bucket_date, interval)

            if is_intraday:
                time_key = _to_unix_seconds(bucket_date)
            elif hasattr(bucket_date, 'strftime'):
                time_key = bucket_date.strftime('%Y-%m-%d')
            else:
                time_key = str(bucket_date)[:10]

            if time_key is None:
                continue

            dark_flow_series.append({
                'time': time_key,
                'strength': round(float(row['avg_strength'] or 0), 2),
                'max_strength': round(float(row['max_strength'] or 0), 2),
                'signal_count': int(row['signal_count'] or 0),
                'cvd': round(float(row['avg_cvd'] or 0), 2),
            })

        if is_intraday and interval in {'30m', '15m'} and dark_flow_series:
            grouped = {}
            for item in dark_flow_series:
                ts = int(item['time'])
                dt_item = datetime.utcfromtimestamp(ts)
                dt_floor = _floor_intraday_bucket(dt_item, interval)
                bucket_ts = calendar.timegm(dt_floor.timetuple())
                if bucket_ts not in grouped:
                    grouped[bucket_ts] = {
                        'time': bucket_ts,
                        'sum_strength': 0.0,
                        'max_strength': float('-inf'),
                        'signal_count': 0,
                        'sum_cvd': 0.0,
                        'rows': 0,
                    }
                g = grouped[bucket_ts]
                g['sum_strength'] += float(item['strength'] or 0)
                g['max_strength'] = max(g['max_strength'], float(item['max_strength'] or 0))
                g['signal_count'] += int(item['signal_count'] or 0)
                g['sum_cvd'] += float(item['cvd'] or 0)
                g['rows'] += 1

            dark_flow_series = []
            for _, g in sorted(grouped.items(), key=lambda kv: kv[0]):
                rows = max(1, g['rows'])
                dark_flow_series.append({
                    'time': g['time'],
                    'strength': round(g['sum_strength'] / rows, 2),
                    'max_strength': round(g['max_strength'], 2),
                    'signal_count': g['signal_count'],
                    'cvd': round(g['sum_cvd'] / rows, 2),
                })

        # Also get signal_type breakdown for latest signals
        latest_signals = list(
            OrderFlowSignal.objects
            .filter(
                symbol=normalized_symbol,
                created_at__date__gte=cutoff_date,
            )
            .exclude(signal_type='none')
            .order_by('-created_at')
            .values('signal_type', 'strength', 'confidence', 'created_at')[:10]
        )

        # Enrich dark_flow_series with dominant signal_type per day
        signal_by_date = defaultdict(list)
        for sig in latest_signals:
            if not sig.get('created_at'):
                continue
            if is_intraday:
                sig_key = _to_unix_seconds(_floor_intraday_bucket(sig['created_at'], interval))
            else:
                sig_key = sig['created_at'].strftime('%Y-%m-%d')
            if sig_key is not None:
                signal_by_date[sig_key].append(sig)

        for entry in dark_flow_series:
            day_signals = signal_by_date.get(entry['time'], [])
            if day_signals:
                # Pick the dominant signal type for that day
                types = [s['signal_type'] for s in day_signals]
                entry['signal_type'] = max(set(types), key=types.count)
                entry['confidence'] = day_signals[0].get('confidence', 'low')
            else:
                entry['signal_type'] = 'none'
                entry['confidence'] = 'low'

    except Exception as exc:
        logger.warning('Failed to fetch dark flow series for %s: %s', normalized_symbol, exc)

    # ─── 3. Whale Buy/Sell Signals (from IntradayTick) ────────────────────
    whale_signals = []
    try:
        whale_threshold_vnd, _ = _resolve_user_whale_threshold_vnd(request.user, normalized_symbol)

        whale_ticks_qs = list(
            IntradayTick.objects
            .filter(
                symbol=normalized_symbol,
                trade_date__gte=cutoff_date,
            )
            .annotate(
                # Canonical valuation: legacy rows may store VND, migrated rows store THOUSAND_VND.
                matched_value=ExpressionWrapper(
                    Case(
                        When(price__gte=1000, then=F('price') * F('volume')),
                        default=F('price') * 1000 * F('volume'),
                        output_field=FloatField(),
                    ),
                    output_field=FloatField(),
                ),
            )
            .filter(matched_value__gte=whale_threshold_vnd)
            .values('trade_date', 'trade_time', 'side', 'price', 'volume', 'matched_value')
            .order_by('trade_date', 'trade_time', 'matched_value')
        )

        # Aggregate by (trade_date, inferred_side). We infer side from price movement
        # when source side quality is poor (e.g. mostly SELL/UNKNOWN).
        grouped = defaultdict(lambda: {
            'total_value': 0.0,
            'total_volume': 0.0,
            'count': 0,
            'price_volume_sum': 0.0,
        })
        reference_price_by_date = _build_reference_price_by_trade_date(
            normalized_symbol,
            [row.get('trade_date') for row in whale_ticks_qs],
        )
        prev_price_by_date = dict(reference_price_by_date)
        last_side_by_date = {}

        for row in whale_ticks_qs:
            trade_date = row.get('trade_date')
            if not trade_date:
                continue

            price = float(row.get('price') or 0)
            volume = float(row.get('volume') or 0)
            matched_value = float(row.get('matched_value') or 0)
            if matched_value < whale_threshold_vnd:
                continue

            stored_side = _normalize_tick_side(row.get('side'))
            prev_price = prev_price_by_date.get(trade_date)

            if prev_price is None:
                inferred_side = stored_side
            elif price > prev_price:
                inferred_side = 'buy'
            elif price < prev_price:
                inferred_side = 'sell'
            else:
                inferred_side = last_side_by_date.get(trade_date) or stored_side

            prev_price_by_date[trade_date] = price
            if inferred_side in {'buy', 'sell'}:
                last_side_by_date[trade_date] = inferred_side
            else:
                continue

            bucket = grouped[(trade_date, inferred_side)]
            bucket['total_value'] += matched_value
            bucket['total_volume'] += max(volume, 0.0)
            bucket['count'] += 1
            bucket['price_volume_sum'] += price * max(volume, 0.0)

        for (trade_date, side), agg in sorted(grouped.items(), key=lambda item: (item[0][0], item[0][1])):
            total_value = float(agg['total_value'] or 0)
            total_volume = float(agg['total_volume'] or 0)
            count = int(agg['count'] or 0)
            if total_value < whale_threshold_vnd or count <= 0:
                continue

            avg_price_raw = (agg['price_volume_sum'] / total_volume) if total_volume > 0 else 0.0
            avg_price = _normalize_chart_quote_price(
                avg_price_raw,
                source=PriceSource.INTRADAY_TICK,
                symbol=normalized_symbol,
            )

            severity = 'low'
            if total_value >= whale_threshold_vnd * 5:
                severity = 'extreme'
            elif total_value >= whale_threshold_vnd * 3:
                severity = 'high'
            elif total_value >= whale_threshold_vnd * 1.5:
                severity = 'medium'

            price_display = f'{avg_price:,.2f}'
            if side == 'buy':
                label = f'Mua lớn: vùng {price_display}'
            else:
                label = f'Bán lớn: vùng {price_display}'

            whale_signals.append({
                'time': trade_date.strftime('%Y-%m-%d'),
                'type': side,
                'price': round(avg_price, 2),
                'matched_value': round(total_value, 0),
                'volume': int(total_volume),
                'count': count,
                'severity': severity,
                'label': label,
            })

    except Exception as exc:
        logger.warning('Failed to fetch whale signals for %s: %s', normalized_symbol, exc)

    # ─── 4. Moving Averages ───────────────────────────────────────────────
    moving_averages = _compute_moving_averages(candles, MA_WINDOWS) if candles else {}

    # ─── 5. Smart Money Flow Index ────────────────────────────────────────
    smfi = 0.0
    smfi_components = {}
    try:
        today = date.today()
        session_cutoff = today - timedelta(days=SMFI_LOOKBACK_SESSIONS * 2)

        # Average daily volume over last 20 sessions
        daily_volumes = (
            IntradayTick.objects
            .filter(
                symbol=normalized_symbol,
                trade_date__gte=session_cutoff,
            )
            .values('trade_date')
            .annotate(
                daily_vol=Sum(F('price') * F('volume'), output_field=FloatField()),
            )
            .order_by('-trade_date')[:SMFI_LOOKBACK_SESSIONS]
        )

        vol_values = [float(dv['daily_vol'] or 0) for dv in daily_volumes if dv['daily_vol']]
        avg_session_vol = statistics.mean(vol_values) if vol_values else 0.0

        # Whale buy/sell totals in period
        whale_buy_total = sum(
            ws['matched_value'] for ws in whale_signals if ws['type'] == 'buy'
        )
        whale_sell_total = sum(
            ws['matched_value'] for ws in whale_signals if ws['type'] == 'sell'
        )

        smfi = _compute_smfi(whale_buy_total, whale_sell_total, avg_session_vol)
        smfi_components = {
            'whale_buy_total': round(whale_buy_total, 0),
            'whale_sell_total': round(whale_sell_total, 0),
            'avg_session_volume': round(avg_session_vol, 0),
            'lookback_sessions': len(vol_values),
        }
    except Exception as exc:
        logger.warning('Failed to compute SMFI for %s: %s', normalized_symbol, exc)

    # ─── 6. Strategy Interpretation Table ─────────────────────────────────
    latest_strength = 0.0
    avg_strength = 0.0
    latest_whale_type = None

    if dark_flow_series:
        latest_strength = dark_flow_series[-1].get('strength', 0)
        strengths = [d['strength'] for d in dark_flow_series if d['strength'] > 0]
        avg_strength = statistics.mean(strengths) if strengths else 0.0

    if whale_signals:
        latest_whale_type = whale_signals[-1].get('type')

    strategy_table = _build_strategy_table(latest_strength, avg_strength, latest_whale_type)

    # ─── 7. Absorption zones for chart annotation ─────────────────────────
    absorption_zones = []
    try:
        absorption_signals = (
            OrderFlowSignal.objects
            .filter(
                symbol=normalized_symbol,
                signal_type__in=['absorption', 'mixed'],
                created_at__date__gte=cutoff_date,
                strength__gte=40,
            )
            .order_by('created_at')
            .values('created_at', 'strength', 'price_at_signal', 'confidence')[:50]
        )

        for sig in absorption_signals:
            absorption_zones.append({
                'time': sig['created_at'].strftime('%Y-%m-%d') if sig['created_at'] else None,
                'price': _normalize_chart_quote_price(
                    sig['price_at_signal'] or 0,
                    source=PriceSource.INTRADAY_TICK,
                    symbol=normalized_symbol,
                ),
                'strength': round(float(sig['strength'] or 0), 2),
                'confidence': sig['confidence'] or 'low',
                'type': 'absorption',
            })
    except Exception as exc:
        logger.warning('Failed to fetch absorption zones for %s: %s', normalized_symbol, exc)

    # ─── 8. Aggression events ─────────────────────────────────────────────
    aggression_events = []
    try:
        aggression_qs = (
            OrderFlowSignal.objects
            .filter(
                symbol=normalized_symbol,
                created_at__date__gte=cutoff_date,
                tick_rate__gte=15,  # High tick rate = aggression
                strength__gte=50,
            )
            .order_by('created_at')
            .values('created_at', 'strength', 'tick_rate', 'price_at_signal')[:30]
        )

        for sig in aggression_qs:
            aggression_events.append({
                'time': sig['created_at'].strftime('%Y-%m-%d') if sig['created_at'] else None,
                'price': _normalize_chart_quote_price(
                    sig['price_at_signal'] or 0,
                    source=PriceSource.INTRADAY_TICK,
                    symbol=normalized_symbol,
                ),
                'strength': round(float(sig['strength'] or 0), 2),
                'tick_rate': round(float(sig['tick_rate'] or 0), 2),
                'type': 'aggression',
            })
    except Exception as exc:
        logger.warning('Failed to fetch aggression events for %s: %s', normalized_symbol, exc)

    return Response({
        'ok': True,
        'symbol': normalized_symbol,
        'period': period,
        'interval': interval,
        'price_unit_canonical': QUOTE_UNIT_CANONICAL,
        'candles': candles,
        'dark_flow_series': dark_flow_series,
        'whale_signals': whale_signals,
        'moving_averages': moving_averages,
        'smart_money_flow_index': smfi,
        'smfi_components': smfi_components,
        'strategy_table': strategy_table,
        'absorption_zones': absorption_zones,
        'aggression_events': aggression_events,
        'meta': {
            'candle_count': len(candles),
            'dark_flow_count': len(dark_flow_series),
            'whale_signal_count': len(whale_signals),
            'absorption_zone_count': len(absorption_zones),
            'aggression_event_count': len(aggression_events),
            'period_days': period_days,
            'cutoff_date': cutoff_date.isoformat(),
            'price_unit_canonical': QUOTE_UNIT_CANONICAL,
        },
    })

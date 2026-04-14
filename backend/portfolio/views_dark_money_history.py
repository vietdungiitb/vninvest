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
from collections import defaultdict
from datetime import date, datetime, timedelta

from django.db.models import Avg, Count, F, FloatField, Max, Min, Q, Sum
from django.db.models.functions import TruncDate, TruncHour, TruncWeek
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import IntradayTick, OrderFlowSignal, TrackedSymbol
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
}
VALID_INTERVALS = {'1D', '1W', '1h'}
INTRADAY_MAX_DAYS = {'1h': 7}
VNSTOCK_INTERVAL_MAP = {'1D': '1D', '1W': '1W', '1h': '60'}
TRUNC_FN_MAP = {'1D': TruncDate, '1W': TruncWeek, '1h': TruncHour}
MA_WINDOWS = [20, 50]
SMFI_LOOKBACK_SESSIONS = 20


def _resolve_period_days(period: str) -> int:
    return PERIOD_DAYS_MAP.get(period.upper(), 90)


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
      - period: 1M | 3M | 6M | 1Y (default: 3M)
      - interval: 1D | 1W (default: 1D)
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

    interval = str(request.query_params.get('interval', '1D')).strip().upper()
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
                                if is_intraday and hasattr(val, 'hour'):
                                    import calendar
                                    row_time = calendar.timegm(val.timetuple())
                                else:
                                    row_time = val.strftime('%Y-%m-%d')
                            else:
                                row_time = str(val)[:10] if not is_intraday else str(val)
                            break

                    if not row_time:
                        continue

                    candle = {
                        'time': row_time,
                        'open': round(float(row.get('open', 0)), 2),
                        'high': round(float(row.get('high', 0)), 2),
                        'low': round(float(row.get('low', 0)), 2),
                        'close': round(float(row.get('close', 0)), 2),
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
            if hasattr(bucket_date, 'strftime'):
                if is_intraday and hasattr(bucket_date, 'hour'):
                    import calendar
                    time_str = calendar.timegm(bucket_date.timetuple())
                else:
                    time_str = bucket_date.strftime('%Y-%m-%d')
            else:
                time_str = str(bucket_date)[:10]

            dark_flow_series.append({
                'time': time_str,
                'strength': round(float(row['avg_strength'] or 0), 2),
                'max_strength': round(float(row['max_strength'] or 0), 2),
                'signal_count': int(row['signal_count'] or 0),
                'cvd': round(float(row['avg_cvd'] or 0), 2),
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
            sig_date = sig['created_at'].strftime('%Y-%m-%d') if sig['created_at'] else None
            if sig_date:
                signal_by_date[sig_date].append(sig)

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

        whale_ticks_qs = (
            IntradayTick.objects
            .filter(
                symbol=normalized_symbol,
                trade_date__gte=cutoff_date,
            )
            .annotate(
                matched_value=F('price') * F('volume'),
            )
            .filter(matched_value__gte=whale_threshold_vnd)
            .filter(side__in=['BUY', 'SELL'])
            .values('trade_date', 'side')
            .annotate(
                total_value=Sum(F('price') * F('volume'), output_field=FloatField()),
                total_volume=Sum('volume'),
                avg_price=Avg('price'),
                count=Count('id'),
                max_value=Max(F('price') * F('volume'), output_field=FloatField()),
            )
            .order_by('trade_date', 'side')
        )

        for row in whale_ticks_qs:
            trade_date = row['trade_date']
            if not trade_date:
                continue

            side = str(row['side']).lower()
            total_value = float(row['total_value'] or 0)
            avg_price = float(row['avg_price'] or 0)
            count = int(row['count'] or 0)

            # Only include significant signals
            if total_value < whale_threshold_vnd:
                continue

            severity = 'low'
            if total_value >= whale_threshold_vnd * 5:
                severity = 'extreme'
            elif total_value >= whale_threshold_vnd * 3:
                severity = 'high'
            elif total_value >= whale_threshold_vnd * 1.5:
                severity = 'medium'

            # Build descriptive label
            price_display = f'{avg_price:,.0f}'
            if side == 'buy':
                label = f'Whale Buy: Vùng {price_display}'
            else:
                label = f'Whale Sell: Vùng {price_display}'

            whale_signals.append({
                'time': trade_date.strftime('%Y-%m-%d'),
                'type': side,
                'price': round(avg_price, 2),
                'matched_value': round(total_value, 0),
                'volume': int(row['total_volume'] or 0),
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
                'price': round(float(sig['price_at_signal'] or 0), 2),
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
                'price': round(float(sig['price_at_signal'] or 0), 2),
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
        },
    })

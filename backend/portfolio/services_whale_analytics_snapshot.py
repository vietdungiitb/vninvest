import hashlib
import json
import math
import statistics
from collections import defaultdict
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.db.models import Max
from django.utils import timezone

from .market_data_service import market_data_service
from .models import DailyPrice, IntradayTick
from .services import WhaleSignalEngine
from .views_whale_orders import _get_reference_price
from .whale_scoring import calculate_event_score, resolve_whale_score_config


VN_TZ = ZoneInfo('Asia/Ho_Chi_Minh')
MARKET_OPEN = time(9, 0)
MORNING_END = time(11, 30)
AFTERNOON_START = time(13, 0)
MARKET_CLOSE = time(15, 0)
BUCKET_MINUTES = {
    '15m': 15,
    '30m': 30,
    '1h': 60,
    'morning': 15,
    'afternoon': 15,
    'session': 15,
}
WINDOW_MINUTES = {
    '15m': 15,
    '30m': 30,
    '1h': 60,
}


def _combine_dt(trade_date: date, value: time) -> datetime:
    return datetime.combine(trade_date, value, tzinfo=VN_TZ)


def _current_vn_now() -> datetime:
    return timezone.now().astimezone(VN_TZ)


def _to_iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=VN_TZ)
    return value.astimezone(VN_TZ).isoformat()


def _parse_trade_date(raw_value: str | None) -> date | None:
    text = str(raw_value or '').strip()
    if not text:
        return None
    try:
        return date.fromisoformat(text)
    except ValueError:
        return None


def _latest_trade_date(symbol: str, requested_trade_date: date | None = None) -> date:
    target_date = requested_trade_date or _current_vn_now().date()
    tick_trade_date = (
        IntradayTick.objects
        .filter(symbol=symbol, trade_date__lte=target_date)
        .aggregate(last_trade_date=Max('trade_date'))
        .get('last_trade_date')
    )
    if tick_trade_date:
        return tick_trade_date

    daily_trade_date = (
        DailyPrice.objects
        .filter(symbol=symbol, date__lte=target_date)
        .aggregate(last_trade_date=Max('date'))
        .get('last_trade_date')
    )
    return daily_trade_date or target_date


def _session_segments(trade_date: date) -> list[tuple[datetime, datetime]]:
    return [
        (_combine_dt(trade_date, MARKET_OPEN), _combine_dt(trade_date, MORNING_END)),
        (_combine_dt(trade_date, AFTERNOON_START), _combine_dt(trade_date, MARKET_CLOSE)),
    ]


def _effective_session_now(trade_date: date, reference_now: datetime | None = None) -> datetime:
    now = (reference_now or _current_vn_now()).astimezone(VN_TZ)
    morning_start, morning_end = _session_segments(trade_date)[0]
    afternoon_start, afternoon_end = _session_segments(trade_date)[1]
    if trade_date < now.date():
        return afternoon_end
    if now <= morning_start:
        return morning_start
    if morning_start <= now <= morning_end:
        return now.replace(second=0, microsecond=0)
    if morning_end < now < afternoon_start:
        return morning_end
    if afternoon_start <= now <= afternoon_end:
        return now.replace(second=0, microsecond=0)
    return afternoon_end


def _subtract_trading_minutes(cursor: datetime, minutes: int) -> datetime:
    remaining = max(0, int(minutes))
    working_cursor = cursor.replace(second=0, microsecond=0)
    segments = _session_segments(working_cursor.date())
    while remaining > 0:
        morning_start, morning_end = segments[0]
        afternoon_start, afternoon_end = segments[1]
        if afternoon_start <= working_cursor <= afternoon_end:
            available = int((working_cursor - afternoon_start).total_seconds() // 60)
            if available >= remaining:
                return working_cursor - timedelta(minutes=remaining)
            remaining -= available
            working_cursor = morning_end
            continue
        if morning_start <= working_cursor <= morning_end:
            available = int((working_cursor - morning_start).total_seconds() // 60)
            if available >= remaining:
                return working_cursor - timedelta(minutes=remaining)
            remaining -= available
            return morning_start
        if working_cursor > afternoon_end:
            working_cursor = afternoon_end
            continue
        if morning_end < working_cursor < afternoon_start:
            working_cursor = morning_end
            continue
        return morning_start
    return working_cursor


def _resolve_window(trade_date: date, timeframe: str, reference_now: datetime | None = None) -> tuple[datetime, datetime, int]:
    normalized = str(timeframe or 'session').strip().lower()
    bucket_minutes = BUCKET_MINUTES.get(normalized, 15)
    morning_start, morning_end = _session_segments(trade_date)[0]
    afternoon_start, afternoon_end = _session_segments(trade_date)[1]
    effective_now = _effective_session_now(trade_date, reference_now)

    if normalized == 'morning':
        return morning_start, min(effective_now, morning_end), bucket_minutes
    if normalized == 'afternoon':
        end_dt = effective_now if effective_now >= afternoon_start else afternoon_start
        return afternoon_start, min(end_dt, afternoon_end), bucket_minutes
    if normalized == 'session':
        return morning_start, effective_now, bucket_minutes
    if normalized in WINDOW_MINUTES:
        return _subtract_trading_minutes(effective_now, WINDOW_MINUTES[normalized]), effective_now, bucket_minutes
    return morning_start, effective_now, bucket_minutes


def _floor_bucket(dt_value: datetime, bucket_minutes: int) -> datetime:
    floored = dt_value.replace(second=0, microsecond=0)
    floored_minute = (floored.minute // bucket_minutes) * bucket_minutes
    return floored.replace(minute=floored_minute)


def _normalize_tick_side(side_value: str | None) -> str:
    raw = str(side_value or '').strip().lower()
    if raw in {'buy', 'bu', 'b'}:
        return 'buy'
    if raw in {'sell', 'sd', 's'}:
        return 'sell'
    return 'neutral'


def _matched_value_from_price_volume(price_value: float, volume_value: float) -> float:
    multiplier = 1.0 if price_value >= 1000 else 1000.0
    return float(price_value or 0) * float(volume_value or 0) * multiplier


def _percentile_rank(sample: list[float], current: float) -> float:
    if not sample:
        return 0.5
    sorted_values = sorted(sample)
    count = sum(1 for item in sorted_values if item <= current)
    return count / len(sorted_values)


def _sigmoid(value: float, midpoint: float, slope: float = 1.0) -> float:
    try:
        return 100.0 / (1.0 + math.exp(-slope * (value - midpoint)))
    except OverflowError:
        return 100.0 if value > midpoint else 0.0


def _confidence_label(strength_value: float, percentile_value: float) -> str:
    if strength_value >= 75 or percentile_value >= 0.95:
        return 'high'
    if strength_value >= 45 or percentile_value >= 0.75:
        return 'medium'
    return 'low'


def _build_flow_series(bucket_rows: list[dict], whale_value_by_bucket: dict[str, float], bucket_window: int) -> dict:
    cvd_points = []
    strength_points = []
    institutional_points = []
    speed_points = []
    cumulative_cvd = 0.0
    raw_strength_history = []
    raw_institutional_history = []
    bucket_values_history = []

    for row in bucket_rows:
        buy_value = float(row['buy_value'])
        sell_value = float(row['sell_value'])
        total_value = max(float(row['total_value']), 0.0)
        cvd_delta = buy_value - sell_value
        cumulative_cvd += cvd_delta
        bucket_ts = row['bucket_ts']
        bucket_key = bucket_ts.isoformat()
        baseline_window_values = bucket_values_history[-bucket_window:] if bucket_values_history else []
        baseline_value = statistics.median(baseline_window_values) if baseline_window_values else max(total_value, 1.0)
        imbalance = abs((buy_value - sell_value) / (buy_value + sell_value + 1e-9))
        raw_strength = 0.6 * imbalance + 0.4 * math.log1p(total_value / (baseline_value + 1e-9))
        raw_sample = raw_strength_history[-bucket_window:] + [raw_strength]
        midpoint = statistics.median(raw_sample)
        percentile_value = _percentile_rank(raw_sample, raw_strength)
        strength_value = _sigmoid(raw_strength, midpoint, slope=1.0)
        low_volume_penalty = total_value < baseline_value * 0.25
        if low_volume_penalty:
            strength_value *= 0.55
        strength_value = min(99.5, max(0.0, strength_value))

        whale_bucket_value = float(whale_value_by_bucket.get(bucket_key, 0.0))
        whale_ratio = whale_bucket_value / (total_value + 1e-9)
        dark_flow_ratio = abs(cvd_delta) / (total_value + 1e-9)
        institutional_value_multiple = whale_bucket_value / (baseline_value + 1e-9)
        raw_institutional = 0.45 * whale_ratio + 0.35 * dark_flow_ratio + 0.20 * math.log1p(institutional_value_multiple)
        institutional_sample = raw_institutional_history[-bucket_window:] + [raw_institutional]
        institutional_midpoint = statistics.median(institutional_sample)
        institutional_percentile = _percentile_rank(institutional_sample, raw_institutional)
        institutional_value = _sigmoid(raw_institutional, institutional_midpoint, slope=0.95)
        if whale_bucket_value < baseline_value * 0.15:
            institutional_value *= 0.6
        institutional_value = min(99.5, max(0.0, institutional_value))

        cvd_points.append({
            'bucket_ts': bucket_key,
            'value': round(cumulative_cvd, 2),
        })
        strength_points.append({
            'bucket_ts': bucket_key,
            'value': round(strength_value, 2),
            'baseline_window': bucket_window,
            'confidence': 'low' if low_volume_penalty else _confidence_label(strength_value, percentile_value),
        })
        institutional_points.append({
            'bucket_ts': bucket_key,
            'value': round(institutional_value, 2),
            'baseline_window': bucket_window,
            'confidence': _confidence_label(institutional_value, institutional_percentile),
        })
        bucket_duration_seconds = max(1, int(bucket_window) * 60)
        event_count = int(row.get('event_count') or 0)
        speed_value = event_count / bucket_duration_seconds if event_count > 0 else 0.0
        speed_points.append({
            'bucket_ts': bucket_key,
            'value': round(speed_value, 6),
            'unit': 'events_per_second',
            'confidence': 'high' if event_count >= 3 else 'medium' if event_count >= 2 else 'low',
        })

        raw_strength_history.append(raw_strength)
        raw_institutional_history.append(raw_institutional)
        bucket_values_history.append(total_value)

    return {
        'cvd': cvd_points,
        'buy_strength': strength_points,
        'institutional_strength': institutional_points,
        'speed': speed_points,
    }


def _resolve_reference_price(symbol: str, trade_date: date) -> float | None:
    reference_price = _get_reference_price(symbol, trade_date)
    if reference_price is None:
        return None
    return float(reference_price)


def _calculate_whale_event_score(*, matched_value: float, threshold_vnd: float, side: str, score_config: dict) -> float:
    score_result = calculate_event_score(
        trade={'matched_value': matched_value, 'threshold': threshold_vnd, 'side': side},
        context={'threshold_vnd': threshold_vnd, 'side': side},
        config=score_config,
    )
    return float(score_result.get('event_score') or 0.0)


def _build_percentile_baseline_samples(*, symbol: str, trade_date: date, threshold_vnd: float, score_config: dict, session_limit: int = 10) -> dict:
    previous_trade_dates = list(
        IntradayTick.objects
        .filter(symbol=symbol, trade_date__lt=trade_date)
        .values_list('trade_date', flat=True)
        .distinct()
        .order_by('-trade_date')[:session_limit]
    )
    if not previous_trade_dates:
        return {
            'matched_values': [],
            'event_scores': [],
            'sample_size': 0,
        }

    matched_values = []
    event_scores = []
    baseline_rows = (
        IntradayTick.objects
        .filter(symbol=symbol, trade_date__in=previous_trade_dates)
        .values('price', 'volume', 'side')
    )
    for row in baseline_rows:
        matched_value = _matched_value_from_price_volume(float(row.get('price') or 0), float(row.get('volume') or 0))
        if threshold_vnd > 0 and matched_value < threshold_vnd:
            continue
        normalized_side = str(row.get('side') or '').strip().upper()
        if normalized_side in {'BUY', 'BU', 'B'}:
            normalized_side = 'BUY'
        elif normalized_side in {'SELL', 'SD', 'S'}:
            normalized_side = 'SELL'
        else:
            normalized_side = 'NEUTRAL'
        matched_values.append(float(matched_value))
        event_scores.append(_calculate_whale_event_score(
            matched_value=matched_value,
            threshold_vnd=threshold_vnd,
            side=normalized_side,
            score_config=score_config,
        ))

    return {
        'matched_values': matched_values,
        'event_scores': event_scores,
        'sample_size': len(matched_values),
    }


def _resolve_session_levels(*, user, symbol: str, trade_date: date, reference_price: float | None) -> tuple[dict, list[str]]:
    session_levels = {
        'reference_price': reference_price,
        'high_price': None,
        'low_price': None,
        'ceiling_price': None,
        'floor_price': None,
    }

    daily_price = (
        DailyPrice.objects
        .filter(symbol=symbol, date=trade_date)
        .values('high_price', 'low_price')
        .first()
    )
    if daily_price:
        if daily_price.get('high_price') is not None:
            session_levels['high_price'] = float(daily_price['high_price'])
        if daily_price.get('low_price') is not None:
            session_levels['low_price'] = float(daily_price['low_price'])

    if trade_date == _current_vn_now().date():
        try:
            overview = market_data_service.get_stock_workspace_overview(user, symbol)
        except Exception:
            overview = None
        if overview:
            for field_name in ('reference_price', 'high_price', 'low_price', 'ceiling_price', 'floor_price'):
                field_value = overview.get(field_name)
                if field_value is None:
                    continue
                try:
                    session_levels[field_name] = float(field_value)
                except (TypeError, ValueError):
                    continue

    missing_fields = [
        f'session_levels.{field_name}'
        for field_name, field_value in session_levels.items()
        if field_value is None
    ]
    return session_levels, missing_fields


def _resolve_degraded_state(*, reference_price: float | None, tick_rows: list[dict], missing_session_level_fields: list[str] | None = None) -> tuple[bool, str | None, list[str]]:
    if reference_price is None:
        return True, 'missing_reference_price', []
    if not tick_rows:
        return True, 'missing_intraday_ticks', []
    if missing_session_level_fields:
        return True, 'missing_session_levels', missing_session_level_fields
    return False, None, []


def build_whale_analytics_snapshot(*, user, symbol: str, timeframe: str = 'session', compact: bool = True, trade_date: date | None = None) -> dict:
    normalized_symbol = str(symbol or '').strip().upper()
    normalized_timeframe = str(timeframe or 'session').strip().lower()
    requested_trade_date = trade_date
    resolved_trade_date = _latest_trade_date(normalized_symbol, requested_trade_date)
    window_start, window_end, bucket_minutes = _resolve_window(resolved_trade_date, normalized_timeframe)
    threshold_vnd, threshold_source = WhaleSignalEngine.resolve_threshold_vnd(user, normalized_symbol)
    reference_price = _resolve_reference_price(normalized_symbol, resolved_trade_date)
    now_vn = _current_vn_now()
    score_config = resolve_whale_score_config()
    session_levels, missing_session_level_fields = _resolve_session_levels(
        user=user,
        symbol=normalized_symbol,
        trade_date=resolved_trade_date,
        reference_price=reference_price,
    )

    tick_rows = []
    tick_qs = (
        IntradayTick.objects
        .filter(symbol=normalized_symbol, trade_date=resolved_trade_date)
        .values('trade_date', 'trade_time', 'price', 'volume', 'side')
        .order_by('trade_time')
    )
    seen_keys = set()
    for item in tick_qs:
        trade_time_value = item.get('trade_time')
        if trade_time_value is None:
            continue
        dedupe_key = (
            item.get('trade_date'),
            trade_time_value,
            item.get('side'),
            item.get('price'),
            item.get('volume'),
        )
        if dedupe_key in seen_keys:
            continue
        seen_keys.add(dedupe_key)
        dt_value = datetime.combine(resolved_trade_date, trade_time_value, tzinfo=VN_TZ)
        if not (window_start <= dt_value <= window_end):
            continue
        price_value = float(item.get('price') or 0)
        volume_value = float(item.get('volume') or 0)
        matched_value = _matched_value_from_price_volume(price_value, volume_value)
        tick_rows.append({
            'dt': dt_value,
            'bucket_ts': _floor_bucket(dt_value, bucket_minutes),
            'side': _normalize_tick_side(item.get('side')),
            'price': price_value,
            'volume': volume_value,
            'matched_value': matched_value,
        })

    bucket_map = defaultdict(lambda: {
        'bucket_ts': None,
        'buy_value': 0.0,
        'sell_value': 0.0,
        'total_value': 0.0,
        'event_count': 0,
        'last_price': None,
        'last_ts': None,
    })
    for row in tick_rows:
        key = row['bucket_ts'].isoformat()
        bucket_entry = bucket_map[key]
        bucket_entry['bucket_ts'] = row['bucket_ts']
        bucket_entry['total_value'] += row['matched_value']
        bucket_entry['event_count'] += 1
        if row['side'] == 'buy':
            bucket_entry['buy_value'] += row['matched_value']
        elif row['side'] == 'sell':
            bucket_entry['sell_value'] += row['matched_value']
        if bucket_entry['last_ts'] is None or row['dt'] >= bucket_entry['last_ts']:
            bucket_entry['last_ts'] = row['dt']
            bucket_entry['last_price'] = row['price']

    sorted_buckets = sorted(bucket_map.values(), key=lambda item: item['bucket_ts'])
    price_series = []
    for bucket in sorted_buckets:
        price_value = float(bucket['last_price'] or 0)
        delta_pct = 0.0
        if reference_price and reference_price > 0 and price_value > 0:
            delta_pct = ((price_value - reference_price) / reference_price) * 100.0
        price_series.append({
            'bucket_ts': bucket['bucket_ts'].isoformat(),
            'price': round(price_value, 4),
            'reference_price': reference_price,
            'delta_pct': round(delta_pct, 4),
        })

    whale_payload = market_data_service.get_whale_feed(user, normalized_symbol)
    whale_scores_by_key = {}
    whale_order_rows = []
    for order in whale_payload.get('whale_orders') or []:
        ts_raw = str(order.get('ts') or '').replace('Z', '+00:00')
        try:
            order_dt = datetime.fromisoformat(ts_raw)
        except ValueError:
            continue
        if order_dt.tzinfo is None:
            order_dt = order_dt.replace(tzinfo=timezone.utc)
        order_dt = order_dt.astimezone(VN_TZ)
        normalized_side = str(order.get('side') or '').strip().upper()
        if normalized_side in {'BUY', 'BU', 'B'}:
            normalized_side = 'BUY'
        elif normalized_side in {'SELL', 'SD', 'S'}:
            normalized_side = 'SELL'
        else:
            normalized_side = 'NEUTRAL'
        price_value = float(order.get('price') or 0)
        volume_value = float(order.get('volume') or 0)
        matched_value = float(order.get('matched_value') or _matched_value_from_price_volume(price_value, volume_value))
        whale_scores_by_key[(
            order_dt.isoformat(),
            round(price_value, 4),
            int(volume_value),
            normalized_side,
        )] = order.get('display_score') or order.get('event_score') or 0
        whale_order_rows.append({
            'dt': order_dt,
            'bucket_ts': _floor_bucket(order_dt, bucket_minutes),
            'side': normalized_side,
            'price': price_value,
            'volume': volume_value,
            'matched_value': matched_value,
            'event_score': order.get('display_score') or order.get('event_score') or 0,
        })

    whale_value_by_bucket = defaultdict(float)
    bubble_series = []
    threshold_value = float(threshold_vnd or 0)
    percentile_baseline = _build_percentile_baseline_samples(
        symbol=normalized_symbol,
        trade_date=resolved_trade_date,
        threshold_vnd=threshold_value,
        score_config=score_config,
    )
    threshold_tick_rows = [
        row for row in tick_rows
        if threshold_value <= 0 or float(row['matched_value']) >= threshold_value
    ]
    bubble_source_rows = whale_order_rows if whale_order_rows and len(whale_order_rows) >= len(threshold_tick_rows) else tick_rows
    for row in bubble_source_rows:
        matched_value = float(row['matched_value'])
        if threshold_value > 0 and matched_value < threshold_value:
            continue

        order_dt = row['dt']
        bucket_ts = row['bucket_ts']
        price_value = float(row['price'] or 0)
        volume_value = float(row['volume'] or 0)
        whale_value_by_bucket[bucket_ts.isoformat()] += matched_value

        delta_pct = 0.0
        if reference_price and reference_price > 0 and price_value > 0:
            delta_pct = ((price_value - reference_price) / reference_price) * 100.0

        normalized_side = str(row.get('side') or '').strip().upper()
        if normalized_side in {'BUY', 'BU', 'B'}:
            normalized_side = 'BUY'
        elif normalized_side in {'SELL', 'SD', 'S'}:
            normalized_side = 'SELL'
        else:
            normalized_side = 'NEUTRAL'

        event_score = float(
            row.get('event_score')
            or whale_scores_by_key.get((order_dt.isoformat(), round(price_value, 4), int(volume_value), normalized_side), 0)
            or _calculate_whale_event_score(
                matched_value=matched_value,
                threshold_vnd=max(threshold_value, 1.0),
                side=normalized_side,
                score_config=score_config,
            )
        )
        baseline_sample_size = int(percentile_baseline['sample_size']) if percentile_baseline['sample_size'] > 0 else None
        matched_value_percentile = (
            round(_percentile_rank(percentile_baseline['matched_values'], matched_value) * 100.0, 2)
            if baseline_sample_size
            else None
        )
        event_score_percentile = (
            round(_percentile_rank(percentile_baseline['event_scores'], event_score) * 100.0, 2)
            if baseline_sample_size
            else None
        )

        bubble_series.append({
            'bucket_ts': bucket_ts.isoformat(),
            'ts': order_dt.isoformat(),
            'side': normalized_side,
            'price': round(price_value, 4),
            'volume': int(volume_value),
            'matched_value': round(matched_value, 2),
            'delta_pct': round(delta_pct, 4),
            'is_whale': True if threshold_value > 0 else matched_value > 0,
            'is_extreme': matched_value >= threshold_value * 3 if threshold_value > 0 else False,
            'event_score': round(event_score, 2),
            'matched_value_percentile_10d': matched_value_percentile,
            'event_score_percentile_10d': event_score_percentile,
            'baseline_sample_size': baseline_sample_size,
        })

    flow_series = _build_flow_series(sorted_buckets, whale_value_by_bucket, bucket_window=30 if normalized_timeframe != 'session' else 60)
    total_buy_value = round(sum(item['matched_value'] for item in bubble_series if item['side'] == 'BUY'), 2)
    total_sell_value = round(sum(item['matched_value'] for item in bubble_series if item['side'] == 'SELL'), 2)
    net_cvd = flow_series['cvd'][-1]['value'] if flow_series['cvd'] else 0.0
    generated_at = now_vn.isoformat()
    fetched_at_raw = whale_payload.get('fetched_at')
    cache_age_ms = 0
    if fetched_at_raw:
        try:
            fetched_at = datetime.fromisoformat(str(fetched_at_raw).replace('Z', '+00:00'))
            if fetched_at.tzinfo is None:
                fetched_at = fetched_at.replace(tzinfo=timezone.utc)
            cache_age_ms = max(0, int((now_vn - fetched_at.astimezone(VN_TZ)).total_seconds() * 1000))
        except ValueError:
            cache_age_ms = 0
    is_live_session = resolved_trade_date == now_vn.date() and _combine_dt(resolved_trade_date, MARKET_OPEN) <= now_vn <= _combine_dt(resolved_trade_date, MARKET_CLOSE)
    degraded_mode, stale_reason, missing_fields = _resolve_degraded_state(
        reference_price=reference_price,
        tick_rows=tick_rows,
        missing_session_level_fields=missing_session_level_fields,
    )
    payload = {
        'symbol': normalized_symbol,
        'trade_date': resolved_trade_date.isoformat(),
        'timeframe': normalized_timeframe,
        'session': {
            'timezone': 'Asia/Ho_Chi_Minh',
            'market_open': '09:00',
            'market_close': '15:00',
            'resolved_from': 'live_session' if is_live_session else 'latest_completed_session',
            'auction_policy': {
                'ato': 'bucket_start',
                'atc': 'bucket_start',
            },
        },
        'meta': {
            'generated_at': generated_at,
            'cache_age_ms': cache_age_ms,
            'is_stale': cache_age_ms > 300_000,
            'degraded_mode': degraded_mode,
            'data_state': 'live' if is_live_session else 'snapshot',
            'stale_reason': stale_reason,
            'missing_fields': missing_fields,
            'request_key': f'{normalized_symbol}:{resolved_trade_date.isoformat()}:{normalized_timeframe}:{1 if compact else 0}',
            'threshold_vnd': float(threshold_vnd or 0),
            'threshold_source': threshold_source,
        },
        'axis': {
            'x_mode': 'linear_time',
            'show_session_gaps': True,
            'bucket_interval': f'{bucket_minutes}m',
            'window_start': _to_iso(window_start),
            'window_end': _to_iso(window_end),
        },
        'session_levels': session_levels,
        'price_series': price_series,
        'bubble_series': bubble_series,
        'flow_series': flow_series,
        'summary': {
            'total_buy_value': total_buy_value,
            'total_sell_value': total_sell_value,
            'net_cvd': round(net_cvd, 2),
            'whale_order_count': len(bubble_series),
            'extreme_order_count': len([item for item in bubble_series if item['is_extreme']]),
        },
    }
    return payload


def build_snapshot_etag(payload: dict) -> str:
    normalized_payload = json.loads(json.dumps(payload))
    meta = normalized_payload.get('meta') or {}
    meta.pop('generated_at', None)
    meta.pop('cache_age_ms', None)
    normalized_payload['meta'] = meta
    serialized = json.dumps(normalized_payload, sort_keys=True, ensure_ascii=True, separators=(',', ':'))
    return hashlib.md5(serialized.encode('utf-8')).hexdigest()
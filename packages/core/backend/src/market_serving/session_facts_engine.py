"""
SessionFacts computation engine — công thức chuẩn quốc tế.

============================================================
1. CVD — Cumulative Volume Delta
------------------------------------------------------------
   Delta_i       = buy_value_i − sell_value_i
   CVD_n         = CVD_{n-1} + Delta_n  (tích lũy theo bucket)
   cvd_normalized = clamp(50 + 50 × (CVD_final / p95(|CVD_series|)), 0, 100)
   Ý nghĩa: 50 = trung tính, >50 = áp lực mua, <50 = áp lực bán.

2. Delta Strength %
------------------------------------------------------------
   delta_strength = (net_cvd / total_value) × 100
   >10–15 % → một bên đang áp đảo hoàn toàn (Aggressive).

3. Buy Strength  (0 – 99.5, sigmoid-chuẩn hóa)
------------------------------------------------------------
   imbalance  = |buy − sell| / (buy + sell + ε)
   baseline   = median(bucket_totals của N bucket gần nhất)
   raw        = 0.6 × imbalance + 0.4 × log1p(total / baseline)
   midpoint   = median(raw_history)
   strength   = sigmoid(raw, midpoint, slope=1.0)
   penalty    = ×0.55 nếu total < 0.25 × baseline

4. Institutional Strength  (0 – 99.5)
------------------------------------------------------------
   whale_ratio   = whale_value / (total + ε)
   dark_ratio    = |delta| / (total + ε)
   whale_mult    = whale_value / (baseline + ε)
   raw_inst      = 0.45×whale_ratio + 0.35×dark_ratio + 0.20×log1p(whale_mult)
   inst_str      = sigmoid(raw_inst, midpoint, slope=0.95)
   penalty       = ×0.6 nếu whale_value < 0.15 × baseline

5. Dark Flow Score  (0 – 100)
------------------------------------------------------------
   Proxy cho absorption: giá đứng yên nhưng CVD dịch chuyển mạnh.
   dark_flow_score = min(|net_cvd| / (total_value + ε) × 100, 100)

Data source: signal_intelligence.WhaleAlertCanonical
  Trường dùng: matched_value (VND), side ('buy'/'sell'), executed_at
============================================================
"""
import logging
import math
import statistics
from datetime import date, datetime, time, timedelta, timezone

logger = logging.getLogger(__name__)

# ─── Hằng số ──────────────────────────────────────────────
_BUCKET_MINUTES = 15          # độ rộng bucket mặc định (phút)
_BASELINE_WINDOW = 20         # số bucket dùng để tính baseline median
_WHALE_THRESHOLD_VND = 500_000_000   # Q6: khớp order_flow_engine.WHALE_VALUE_MIN_VND
_EPS = 1e-9
_SERIES_WINDOWS_BY_LABEL = {
    '5m': 5,
    '15m': 15,
    '30m': 30,
    '1h': 60,
    '4h': 240,
    '1D': 1440,
}


# ─── Helpers ──────────────────────────────────────────────

def _sigmoid(value: float, midpoint: float, slope: float = 1.0) -> float:
    try:
        return 100.0 / (1.0 + math.exp(-slope * (value - midpoint)))
    except OverflowError:
        return 100.0 if value > midpoint else 0.0


def _clamp(value: float, lower: float, upper: float) -> float:
    return max(lower, min(upper, float(value)))


def _percentile(sample: list[float], q: float) -> float:
    """Trả về percentile thứ q (0.0–1.0) của sample."""
    if not sample:
        return 0.0
    sorted_s = sorted(sample)
    idx = int(math.ceil(q * len(sorted_s))) - 1
    return float(sorted_s[max(0, min(len(sorted_s) - 1, idx))])


def _floor_bucket(dt: datetime, bucket_minutes: int) -> datetime:
    """Làm tròn xuống theo bucket_minutes (hỗ trợ 5m..1D)."""
    dt = dt.replace(second=0, microsecond=0)
    if bucket_minutes >= 1440:  # 1D
        return dt.replace(hour=0, minute=0)
    if bucket_minutes >= 240:  # 4h
        return dt.replace(hour=(dt.hour // (bucket_minutes // 60)) * (bucket_minutes // 60), minute=0)
    if bucket_minutes >= 60:  # 1h
        return dt.replace(minute=0)
    floored_minute = (dt.minute // bucket_minutes) * bucket_minutes
    return dt.replace(minute=floored_minute)


def _load_session_rows(symbol: str, session_date: date) -> list[dict]:
    from signal_intelligence.models import WhaleAlertCanonical

    # G0 2026-11-24: WhaleAlertCanonical also holds session aggregates
    # (`tick_session:`) whose matched_value is clamped at 5B. Including them
    # double-counts CVD. Only per-tick rows are aggressor observations.
    return list(
        WhaleAlertCanonical.objects
        .filter(
            symbol=symbol.upper(),
            session_date=session_date,
            alert__source_ref__startswith='whale_tick:',
        )
        .values('side', 'matched_value', 'executed_at')
        .order_by('executed_at')
    )


def _compute_session_facts_from_rows(
    rows: list[dict],
    bucket_minutes: int = _BUCKET_MINUTES,
    include_series: bool = False,
) -> dict | None:
    if not rows:
        return None

    buckets: dict[datetime, dict] = {}
    for row in rows:
        executed_at = row['executed_at']
        if executed_at is None:
            continue
        if executed_at.tzinfo is None:
            executed_at = executed_at.replace(tzinfo=timezone.utc)
        bucket_key = _floor_bucket(executed_at, bucket_minutes)
        if bucket_key not in buckets:
            buckets[bucket_key] = {'buy': 0.0, 'sell': 0.0, 'total': 0.0, 'whale': 0.0}
        value = float(row.get('matched_value') or 0)
        side = str(row.get('side') or '').strip().lower()
        if side == 'buy':
            buckets[bucket_key]['buy'] += value
            buckets[bucket_key]['total'] += value
            if value >= _WHALE_THRESHOLD_VND:
                buckets[bucket_key]['whale'] += value
        elif side == 'sell':
            buckets[bucket_key]['sell'] += value
            buckets[bucket_key]['total'] += value
            if value >= _WHALE_THRESHOLD_VND:
                buckets[bucket_key]['whale'] += value
        # REQ-BE-M04: UNKNOWN/other sides are not aggressor evidence — skip
        # hoan toan khoi total LAN whale (auction value di vao auction_value o S5).

    if not buckets:
        return None

    sorted_buckets = sorted(buckets.items())

    cvd_series: list[float] = []
    cvd_buckets: list[dict] = []
    cumulative_cvd = 0.0
    for bucket_ts, bucket in sorted_buckets:
        delta = bucket['buy'] - bucket['sell']
        cumulative_cvd += delta
        cvd_series.append(cumulative_cvd)
        cvd_buckets.append({
            'bucket_ts': bucket_ts.isoformat(),
            'cumulative_cvd': round(cumulative_cvd, 2),
            'buy_volume': int(bucket['buy']),
            'sell_volume': int(bucket['sell']),
        })

    abs_cvds = [abs(value) for value in cvd_series]
    cvd_scale = _percentile(abs_cvds, 0.95) or max(abs_cvds) or 1.0
    final_cvd = cvd_series[-1] if cvd_series else 0.0
    cvd_normalized = _clamp(50.0 + 50.0 * (final_cvd / cvd_scale), 0.0, 100.0)

    raw_strength_history: list[float] = []
    raw_inst_history: list[float] = []
    bucket_values_history: list[float] = []
    buy_strength_series: list[float] = []
    inst_strength_series: list[float] = []

    for _, bucket in sorted_buckets:
        buy_v = bucket['buy']
        sell_v = bucket['sell']
        total_v = max(bucket['total'], 0.0)
        delta_v = buy_v - sell_v
        whale_v = bucket['whale']

        window = bucket_values_history[-_BASELINE_WINDOW:] if bucket_values_history else []
        baseline = statistics.median(window) if window else max(total_v, 1.0)

        imbalance = abs((buy_v - sell_v) / (buy_v + sell_v + _EPS))
        raw_strength = 0.6 * imbalance + 0.4 * math.log1p(total_v / (baseline + _EPS))
        raw_sample = raw_strength_history[-_BASELINE_WINDOW:] + [raw_strength]
        midpoint = statistics.median(raw_sample)
        strength_value = _sigmoid(raw_strength, midpoint, slope=1.0)
        if total_v < baseline * 0.25:
            strength_value *= 0.55
        strength_value = _clamp(strength_value, 0.0, 99.5)

        whale_ratio = whale_v / (total_v + _EPS)
        dark_ratio = abs(delta_v) / (total_v + _EPS)
        whale_mult = whale_v / (baseline + _EPS)
        raw_inst = 0.45 * whale_ratio + 0.35 * dark_ratio + 0.20 * math.log1p(whale_mult)
        inst_sample = raw_inst_history[-_BASELINE_WINDOW:] + [raw_inst]
        inst_midpoint = statistics.median(inst_sample)
        inst_value = _sigmoid(raw_inst, inst_midpoint, slope=0.95)
        if whale_v < baseline * 0.15:
            inst_value *= 0.6
        inst_value = _clamp(inst_value, 0.0, 99.5)

        buy_strength_series.append(strength_value)
        inst_strength_series.append(inst_value)
        raw_strength_history.append(raw_strength)
        raw_inst_history.append(raw_inst)
        bucket_values_history.append(total_v)

    total_buy = sum(bucket['buy'] for _, bucket in sorted_buckets)
    total_sell = sum(bucket['sell'] for _, bucket in sorted_buckets)
    total_value = total_buy + total_sell
    net_cvd = total_buy - total_sell
    buy_strength_final = buy_strength_series[-1] if buy_strength_series else 0.0
    inst_strength_final = inst_strength_series[-1] if inst_strength_series else 0.0
    delta_strength_pct = (net_cvd / (total_value + _EPS)) * 100.0
    dark_flow_score = _clamp(abs(net_cvd) / (total_value + _EPS) * 100.0, 0.0, 100.0)

    result = {
        'cvd_normalized': round(cvd_normalized, 4),
        'buy_strength': round(buy_strength_final, 4),
        'institutional_strength': round(inst_strength_final, 4),
        'whale_net_flow': int(net_cvd),
        'dark_flow_score': round(dark_flow_score, 4),
        'total_buy_volume': int(total_buy),
        'total_sell_volume': int(total_sell),
        'delta_strength_pct': round(delta_strength_pct, 4),
        'alert_count': len(rows),
        'bucket_count': len(sorted_buckets),
    }
    if include_series:
        for bucket_payload, buy_strength_value, institutional_strength_value in zip(
            cvd_buckets,
            buy_strength_series,
            inst_strength_series,
        ):
            bucket_payload['buy_strength'] = round(buy_strength_value, 4)
            bucket_payload['institutional_strength'] = round(institutional_strength_value, 4)
        result['cvd_series'] = cvd_buckets
    return result


def _build_bucket_rows(
    rows: list[dict],
    market: dict | None = None,
    tick_rows: list[dict] | None = None,
) -> list[dict]:
    payload = []
    market_buckets = (market or {}).get('buckets') or {}
    if tick_rows is not None:
        # F1: mac dinh 15m, se duoc thay theo tung window o duoi.
        market_buckets = _aggregate_market_from_rows(tick_rows, 15).get('buckets') or {}
    base_rows = rows
    for window, bucket_minutes in _SERIES_WINDOWS_BY_LABEL.items():
        if tick_rows is not None:
            window_market = _aggregate_market_from_rows(tick_rows, bucket_minutes)
            market_buckets = window_market.get('buckets') or {}
        # N5 (re-audit S5 v2): synthetic rows phai dung bucket CUA WINDOW, khong 15m.
        if not base_rows and market_buckets:
            rows = [{
                'side': 'buy' if value > 0 else 'sell',
                'matched_value': abs(value),
                'executed_at': bucket_ts,
            } for bucket_ts, values in market_buckets.items()
                for value in (values['market_buy_value'], -values['market_sell_value'])]
        else:
            rows = base_rows
        result = _compute_session_facts_from_rows(
            rows,
            bucket_minutes=bucket_minutes,
            include_series=True,
        )
        if result is None:
            continue
        for bucket in result.get('cvd_series', []):
            bucket_ts = datetime.fromisoformat(bucket['bucket_ts'])
            # S5: lay market CVD theo bucket tu IntradayTick neu co (full_tick).
            market_key = _floor_bucket(bucket_ts, bucket_minutes)
            market_row = market_buckets.get(market_key) or {}
            payload.append({
                'window': window,
                'bucket_minutes': bucket_minutes,
                'bucket_ts': bucket_ts,
                'cumulative_cvd': float(bucket.get('cumulative_cvd') or 0.0),
                'buy_strength': float(bucket.get('buy_strength') or 0.0),
                'institutional_strength': float(bucket.get('institutional_strength') or 0.0),
                'buy_volume': int(bucket.get('buy_volume') or 0),
                'sell_volume': int(bucket.get('sell_volume') or 0),
                'market_buy_value': int(market_row.get('market_buy_value') or 0),
                'market_sell_value': int(market_row.get('market_sell_value') or 0),
                'auction_value': int(market_row.get('auction_value') or 0),
                'trade_count': int(market_row.get('trade_count') or 0),
                'whale_buy_value': int(market_row.get('whale_buy_value') or 0),
                'whale_sell_value': int(market_row.get('whale_sell_value') or 0),
                'cvd_source': (market or {}).get('cvd_source') or 'whale_fallback_only',
                'coverage_ratio': float((market or {}).get('coverage_ratio') or 0.0),
            })
    return payload


# ─── Engine chính ─────────────────────────────────────────

def compute_session_facts(
    symbol: str,
    session_date: date,
    bucket_minutes: int = _BUCKET_MINUTES,
    include_series: bool = False,
) -> dict | None:
    """
    Tính SessionFacts cho (symbol, session_date) từ WhaleAlertCanonical.

    Trả về dict sẵn sàng upsert vào SessionFacts, hoặc None nếu
    không có dữ liệu.

    Params:
      bucket_minutes   — độ rộng bucket tính CVD (mặc định 15 phút)
      include_series   — nếu True, trả thêm trường ``cvd_series``

    Các trường trả về:
      cvd_normalized        — 0..100  (50 = trung tính)
      buy_strength          — 0..99.5
      institutional_strength — 0..99.5
      whale_net_flow        — VND (int), dương = mua ròng
      dark_flow_score       — 0..100
      total_buy_volume      — VND (int)
      total_sell_volume     — VND (int)
      delta_strength_pct    — float (chỉ trả về, không lưu thẳng vào model)
      alert_count           — số lệnh whale trong phiên
      cvd_series            — list[{bucket_ts, cumulative_cvd, buy_volume,
                               sell_volume}] (chỉ khi include_series=True)
    """
    rows = _load_session_rows(symbol, session_date)

    if not rows:
        logger.debug('compute_session_facts: no whale data for %s %s', symbol, session_date)
        return None
    return _compute_session_facts_from_rows(
        rows,
        bucket_minutes=bucket_minutes,
        include_series=include_series,
    )


def _load_intraday_tick_values(symbol: str, session_date: date) -> list[dict]:
    """Doc 1 lan tat ca IntradayTick cua (symbol, session) — dung cho moi window."""
    from market_data.models import IntradayTick

    start = datetime.combine(session_date, time.min)
    end = start + timedelta(days=1)
    return list(
        IntradayTick.objects.filter(
            symbol=symbol.upper(), timestamp__gte=start, timestamp__lt=end,
        ).values('timestamp', 'price', 'volume', 'side', 'match_type').order_by('timestamp')
    )


def _aggregate_market_from_rows(rows: list[dict], bucket_minutes: int) -> dict:
    """F1 (re-audit S5): bucket phai theo `bucket_minutes` CUA WINDOW, khong co dinh 15m."""
    from collections import defaultdict
    from decimal import Decimal

    if not rows:
        return {
            'market_buy_value': 0, 'market_sell_value': 0, 'auction_value': 0,
            'trade_count': 0, 'whale_buy_value': 0, 'whale_sell_value': 0,
            'cvd_source': 'whale_fallback_only', 'coverage_ratio': 0.0,
            'buckets': {},
        }

    buckets: dict[datetime, dict] = defaultdict(lambda: {
        'market_buy_value': 0, 'market_sell_value': 0, 'auction_value': 0,
        'trade_count': 0, 'whale_buy_value': 0, 'whale_sell_value': 0,
    })
    total_buy = total_sell = total_auction = total_count = 0
    for row in rows:
        value = int(Decimal(str(row['price'])) * int(row['volume'] or 0))
        ts = row['timestamp']
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        key = _floor_bucket(ts, bucket_minutes)
        side = str(row.get('side') or '').strip().upper()
        if side in ('BUY', 'SELL'):
            buckets[key]['market_buy_value' if side == 'BUY' else 'market_sell_value'] += value
            if value >= 500_000_000:
                buckets[key]['whale_buy_value' if side == 'BUY' else 'whale_sell_value'] += value
            total_buy += value if side == 'BUY' else 0
            total_sell += value if side == 'SELL' else 0
            # trade_count chi dem lệnh CONTINUOUS (aggressor) — auction khong phai CVD trade.
            buckets[key]['trade_count'] += 1
            total_count += 1
        else:
            buckets[key]['auction_value'] += value
            total_auction += value

    total = total_buy + total_sell + total_auction
    return {
        'market_buy_value': total_buy,
        'market_sell_value': total_sell,
        'auction_value': total_auction,
        'trade_count': total_count,
        'whale_buy_value': sum(b['whale_buy_value'] for b in buckets.values()),
        'whale_sell_value': sum(b['whale_sell_value'] for b in buckets.values()),
        'cvd_source': 'full_tick',
        'coverage_ratio': 1.0 if total else 0.0,
        'buckets': dict(buckets),
    }


def compute_market_cvd_from_ticks(
    symbol: str,
    session_date: date,
    bucket_minutes: int = 15,
) -> dict:
    """S5 / REQ-BE-M06 — Market CVD thật từ 100% IntradayTick (public wrapper)."""
    return _aggregate_market_from_rows(
        _load_intraday_tick_values(symbol, session_date), bucket_minutes
    )


def compute_session_facts_for_all_active(
    session_date: date | None = None,
    symbol: str | None = None,
    *,
    refresh_coverage: bool = True,
) -> dict:
    """
    Tính và upsert SessionFacts cho tất cả symbol có whale data trong ngày.

    Dùng bởi Celery task materialize_session_facts.
    """
    from django.utils.timezone import now

    from market_serving.models import SessionFacts, SessionFactsBucket
    from signal_intelligence.models import WhaleAlertCanonical

    target_date = session_date or now().date()

    normalized_symbol = str(symbol or '').strip().upper() or None

    # Lấy danh sách symbol có dữ liệu trong ngày.
    whale_queryset = WhaleAlertCanonical.objects.filter(session_date=target_date)
    if normalized_symbol is not None:
        whale_queryset = whale_queryset.filter(symbol=normalized_symbol)

    # S5: ke ca symbol co IntradayTick (full_tick), khong chi whale alerts.
    from market_data.models import IntradayTick
    tick_queryset = IntradayTick.objects.filter(timestamp__date=target_date)
    if normalized_symbol is not None:
        tick_queryset = tick_queryset.filter(symbol=normalized_symbol)
    symbols = sorted(set(
        list(whale_queryset.order_by().values_list('symbol', flat=True).distinct())
        + list(tick_queryset.order_by().values_list('symbol', flat=True).distinct())
    ))

    upserted = 0
    skipped = 0
    errors = 0
    upserted_symbols: list[str] = []

    for symbol in symbols:
        try:
            rows = _load_session_rows(symbol, target_date)
            tick_rows = _load_intraday_tick_values(symbol, target_date)
            market = _aggregate_market_from_rows(tick_rows, 15)
            if not rows and market['trade_count'] == 0:
                skipped += 1
                continue

            result = _compute_session_facts_from_rows(rows, bucket_minutes=_BUCKET_MINUTES)
            if result is None:
                # S5: ngay co tick nhung khong co whale canonical van phai materialize.
                total_buy = market['market_buy_value']
                total_sell = market['market_sell_value']
                net = total_buy - total_sell
                total = max(total_buy + total_sell, 1)
                result = {
                    'cvd_normalized': 50.0,
                    'buy_strength': 50.0,
                    'institutional_strength': 50.0,
                    'whale_net_flow': net,
                    'dark_flow_score': min(abs(net) / total * 100, 100.0),
                    'total_buy_volume': total_buy,
                    'total_sell_volume': total_sell,
                }

            facts_obj, _ = SessionFacts.objects.update_or_create(
                symbol=symbol,
                session_date=target_date,
                defaults={
                    'cvd_normalized': result['cvd_normalized'],
                    'buy_strength': result['buy_strength'],
                    'institutional_strength': result['institutional_strength'],
                    'whale_net_flow': result['whale_net_flow'],
                    'dark_flow_score': result['dark_flow_score'],
                    'total_buy_volume': result['total_buy_volume'],
                    'total_sell_volume': result['total_sell_volume'],
                    'source': SessionFacts.SourceChoices.COMPUTED,
                    'stale': False,
                },
            )

            SessionFactsBucket.objects.filter(session_facts=facts_obj).delete()
            market = _aggregate_market_from_rows(tick_rows, 15)
            bucket_rows = _build_bucket_rows(rows, market=market, tick_rows=tick_rows)
            if bucket_rows:
                SessionFactsBucket.objects.bulk_create([
                    SessionFactsBucket(
                        session_facts=facts_obj,
                        symbol=symbol,
                        session_date=target_date,
                        window=bucket_row['window'],
                        bucket_minutes=bucket_row['bucket_minutes'],
                        bucket_ts=bucket_row['bucket_ts'],
                        cumulative_cvd=bucket_row['cumulative_cvd'],
                        buy_strength=bucket_row['buy_strength'],
                        institutional_strength=bucket_row['institutional_strength'],
                        buy_volume=bucket_row['buy_volume'],
                        sell_volume=bucket_row['sell_volume'],
                        market_buy_value=bucket_row['market_buy_value'],
                        market_sell_value=bucket_row['market_sell_value'],
                        auction_value=bucket_row['auction_value'],
                        trade_count=bucket_row['trade_count'],
                        whale_buy_value=bucket_row['whale_buy_value'],
                        whale_sell_value=bucket_row['whale_sell_value'],
                        cvd_source=bucket_row['cvd_source'],
                        coverage_ratio=bucket_row['coverage_ratio'],
                    )
                    for bucket_row in bucket_rows
                ])
            upserted += 1
            upserted_symbols.append(symbol)

        except Exception as exc:
            logger.error('compute_session_facts_for_all_active: %s/%s failed: %s', symbol, target_date, exc)
            errors += 1

    # Slice C follow-up (phát hiện verify Slice A): SessionFacts materializer trước đây KHÔNG
    # refresh GlobalSymbolCoverage → coverage session_facts mãi missing dù facts đã có.
    # Refresh theo symbol đã upsert (fail-open từng symbol, không chặn kết quả chính).
    coverage_refreshed = 0
    if refresh_coverage and upserted_symbols:
        try:
            from market_data.global_symbol_coverage import (
                refresh_global_symbol_coverage,
            )
            for upserted_symbol in upserted_symbols:
                try:
                    refresh_global_symbol_coverage(upserted_symbol, reference_trade_date=target_date)
                    coverage_refreshed += 1
                except Exception:
                    logger.exception('compute_session_facts_for_all_active: coverage refresh failed for %s', upserted_symbol)
        except Exception:
            logger.exception('compute_session_facts_for_all_active: coverage refresh import failed')

    logger.info(
        'compute_session_facts_for_all_active: date=%s upserted=%d skipped=%d errors=%d coverage_refreshed=%d',
        target_date, upserted, skipped, errors, coverage_refreshed,
    )
    return {
        'status': 'ok' if errors == 0 else 'partial',
        'session_date': target_date.isoformat(),
        'requested_symbol': normalized_symbol,
        'symbols_total': len(symbols),
        'upserted': upserted,
        'skipped': skipped,
        'errors': errors,
        'coverage_refreshed': coverage_refreshed,
    }

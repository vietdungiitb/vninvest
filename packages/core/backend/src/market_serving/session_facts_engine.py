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
from datetime import date, datetime, timedelta, timezone

logger = logging.getLogger(__name__)

# ─── Hằng số ──────────────────────────────────────────────
_BUCKET_MINUTES = 15          # độ rộng bucket mặc định (phút)
_BASELINE_WINDOW = 20         # số bucket dùng để tính baseline median
_WHALE_THRESHOLD_VND = 200_000_000   # 200 triệu VND → được coi là "whale bucket"
_EPS = 1e-9
_SERIES_WINDOWS_BY_LABEL = {
    '5m': 5,
    '15m': 15,
    '30m': 30,
    '1h': 60,
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
    """Làm tròn xuống theo bucket_minutes."""
    dt = dt.replace(second=0, microsecond=0)
    floored_minute = (dt.minute // bucket_minutes) * bucket_minutes
    return dt.replace(minute=floored_minute)


def _load_session_rows(symbol: str, session_date: date) -> list[dict]:
    from signal_intelligence.models import WhaleAlertCanonical

    return list(
        WhaleAlertCanonical.objects
        .filter(symbol=symbol.upper(), session_date=session_date)
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
        else:
            buckets[bucket_key]['sell'] += value
        buckets[bucket_key]['total'] += value
        if value >= _WHALE_THRESHOLD_VND:
            buckets[bucket_key]['whale'] += value

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


def _build_bucket_rows(rows: list[dict]) -> list[dict]:
    payload = []
    for window, bucket_minutes in _SERIES_WINDOWS_BY_LABEL.items():
        result = _compute_session_facts_from_rows(
            rows,
            bucket_minutes=bucket_minutes,
            include_series=True,
        )
        if result is None:
            continue
        for bucket in result.get('cvd_series', []):
            payload.append({
                'window': window,
                'bucket_minutes': bucket_minutes,
                'bucket_ts': datetime.fromisoformat(bucket['bucket_ts']),
                'cumulative_cvd': float(bucket.get('cumulative_cvd') or 0.0),
                'buy_strength': float(bucket.get('buy_strength') or 0.0),
                'institutional_strength': float(bucket.get('institutional_strength') or 0.0),
                'buy_volume': int(bucket.get('buy_volume') or 0),
                'sell_volume': int(bucket.get('sell_volume') or 0),
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


def compute_session_facts_for_all_active(session_date: date | None = None, symbol: str | None = None) -> dict:
    """
    Tính và upsert SessionFacts cho tất cả symbol có whale data trong ngày.

    Dùng bởi Celery task materialize_session_facts.
    """
    from datetime import date as _date
    from django.utils.timezone import now
    from signal_intelligence.models import WhaleAlertCanonical
    from market_serving.models import SessionFacts, SessionFactsBucket

    target_date = session_date or now().date()

    normalized_symbol = str(symbol or '').strip().upper() or None

    # Lấy danh sách symbol có dữ liệu trong ngày.
    whale_queryset = WhaleAlertCanonical.objects.filter(session_date=target_date)
    if normalized_symbol is not None:
        whale_queryset = whale_queryset.filter(symbol=normalized_symbol)

    symbols = list(
        whale_queryset
        .order_by()
        .values_list('symbol', flat=True)
        .distinct()
    )

    upserted = 0
    skipped = 0
    errors = 0

    for symbol in symbols:
        try:
            rows = _load_session_rows(symbol, target_date)
            if not rows:
                skipped += 1
                continue

            result = _compute_session_facts_from_rows(rows, bucket_minutes=_BUCKET_MINUTES)
            if result is None:
                skipped += 1
                continue

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
            bucket_rows = _build_bucket_rows(rows)
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
                    )
                    for bucket_row in bucket_rows
                ])
            upserted += 1

        except Exception as exc:
            logger.error('compute_session_facts_for_all_active: %s/%s failed: %s', symbol, target_date, exc)
            errors += 1

    logger.info(
        'compute_session_facts_for_all_active: date=%s upserted=%d skipped=%d errors=%d',
        target_date, upserted, skipped, errors,
    )
    return {
        'status': 'ok' if errors == 0 else 'partial',
        'session_date': target_date.isoformat(),
        'requested_symbol': normalized_symbol,
        'symbols_total': len(symbols),
        'upserted': upserted,
        'skipped': skipped,
        'errors': errors,
    }

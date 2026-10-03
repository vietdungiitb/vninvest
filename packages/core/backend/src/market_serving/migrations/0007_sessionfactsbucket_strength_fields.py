import math
import statistics
from datetime import timezone

from django.db import migrations, models


_BASELINE_WINDOW = 20
_WHALE_THRESHOLD_VND = 200_000_000
_EPS = 1e-9
_WINDOW_TO_BUCKET_MINUTES = {
    '5m': 5,
    '15m': 15,
    '30m': 30,
    '1h': 60,
}


def _sigmoid(value, midpoint, slope=1.0):
    try:
        return 100.0 / (1.0 + math.exp(-slope * (value - midpoint)))
    except OverflowError:
        return 100.0 if value > midpoint else 0.0


def _clamp(value, lower, upper):
    return max(lower, min(upper, float(value)))


def _floor_bucket(dt, bucket_minutes):
    normalized = dt.replace(second=0, microsecond=0)
    floored_minute = (normalized.minute // bucket_minutes) * bucket_minutes
    return normalized.replace(minute=floored_minute)


def _compute_strength_map(rows, bucket_minutes):
    buckets = {}
    for side, matched_value, executed_at in rows:
        if executed_at is None:
            continue
        if executed_at.tzinfo is None:
            executed_at = executed_at.replace(tzinfo=timezone.utc)
        bucket_ts = _floor_bucket(executed_at, bucket_minutes)
        bucket = buckets.setdefault(bucket_ts, {'buy': 0.0, 'sell': 0.0, 'total': 0.0, 'whale': 0.0})
        value = float(matched_value or 0.0)
        if str(side or '').strip().lower() == 'buy':
            bucket['buy'] += value
        else:
            bucket['sell'] += value
        bucket['total'] += value
        if value >= _WHALE_THRESHOLD_VND:
            bucket['whale'] += value

    raw_strength_history = []
    raw_inst_history = []
    bucket_values_history = []
    strength_map = {}

    for bucket_ts, bucket in sorted(buckets.items()):
        buy_value = bucket['buy']
        sell_value = bucket['sell']
        total_value = max(bucket['total'], 0.0)
        delta_value = buy_value - sell_value
        whale_value = bucket['whale']

        window = bucket_values_history[-_BASELINE_WINDOW:] if bucket_values_history else []
        baseline = statistics.median(window) if window else max(total_value, 1.0)

        imbalance = abs((buy_value - sell_value) / (buy_value + sell_value + _EPS))
        raw_strength = 0.6 * imbalance + 0.4 * math.log1p(total_value / (baseline + _EPS))
        raw_sample = raw_strength_history[-_BASELINE_WINDOW:] + [raw_strength]
        midpoint = statistics.median(raw_sample)
        strength_value = _sigmoid(raw_strength, midpoint, slope=1.0)
        if total_value < baseline * 0.25:
            strength_value *= 0.55
        strength_value = _clamp(strength_value, 0.0, 99.5)

        whale_ratio = whale_value / (total_value + _EPS)
        dark_ratio = abs(delta_value) / (total_value + _EPS)
        whale_multiplier = whale_value / (baseline + _EPS)
        raw_inst = 0.45 * whale_ratio + 0.35 * dark_ratio + 0.20 * math.log1p(whale_multiplier)
        inst_sample = raw_inst_history[-_BASELINE_WINDOW:] + [raw_inst]
        inst_midpoint = statistics.median(inst_sample)
        institutional_strength = _sigmoid(raw_inst, inst_midpoint, slope=0.95)
        if whale_value < baseline * 0.15:
            institutional_strength *= 0.6
        institutional_strength = _clamp(institutional_strength, 0.0, 99.5)

        strength_map[bucket_ts] = (
            round(strength_value, 4),
            round(institutional_strength, 4),
        )
        raw_strength_history.append(raw_strength)
        raw_inst_history.append(raw_inst)
        bucket_values_history.append(total_value)

    return strength_map


def backfill_session_facts_bucket_strengths(apps, schema_editor):
    SessionFactsBucket = apps.get_model('market_serving', 'SessionFactsBucket')
    WhaleAlertCanonical = apps.get_model('signal_intelligence', 'WhaleAlertCanonical')

    fact_keys = list(
        SessionFactsBucket.objects
        .order_by()
        .values_list('symbol', 'session_date')
        .distinct()
    )

    for symbol, session_date in fact_keys:
        rows = list(
            WhaleAlertCanonical.objects
            .filter(symbol=symbol, session_date=session_date)
            .values_list('side', 'matched_value', 'executed_at')
            .order_by('executed_at')
        )
        if not rows:
            continue

        for window, bucket_minutes in _WINDOW_TO_BUCKET_MINUTES.items():
            strength_map = _compute_strength_map(rows, bucket_minutes)
            bucket_rows = list(
                SessionFactsBucket.objects
                .filter(symbol=symbol, session_date=session_date, window=window)
                .order_by('bucket_ts', 'pk')
            )
            if not bucket_rows:
                continue
            for bucket_row in bucket_rows:
                buy_strength, institutional_strength = strength_map.get(bucket_row.bucket_ts, (0.0, 0.0))
                bucket_row.buy_strength = buy_strength
                bucket_row.institutional_strength = institutional_strength
            SessionFactsBucket.objects.bulk_update(
                bucket_rows,
                ['buy_strength', 'institutional_strength'],
                batch_size=1000,
            )


class Migration(migrations.Migration):

    dependencies = [
        ('signal_intelligence', '0003_unifiedalert_source_ref_nonempty_unique'),
        ('market_serving', '0006_rename_sessionfactsbucket_indexes'),
    ]

    operations = [
        migrations.AddField(
            model_name='sessionfactsbucket',
            name='buy_strength',
            field=models.FloatField(default=0.0),
        ),
        migrations.AddField(
            model_name='sessionfactsbucket',
            name='institutional_strength',
            field=models.FloatField(default=0.0),
        ),
        migrations.RunPython(backfill_session_facts_bucket_strengths, migrations.RunPython.noop),
    ]
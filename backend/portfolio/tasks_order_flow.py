from __future__ import annotations

import logging
import os

from celery import shared_task
from django.conf import settings
from django.core.cache import cache
from django.utils import timezone

from portfolio.models import TrackedSymbol, UserConfig, WatchlistItem, WhaleAdvisory

logger = logging.getLogger(__name__)

ORDER_FLOW_COOLDOWN_SECONDS = 300
ORDER_FLOW_MAX_SYMBOLS = 30


@shared_task(bind=True, name='portfolio.tasks.detect_and_store_order_flow', autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={'max_retries': 0})
def detect_and_store_order_flow(self, symbol: str | None = None) -> dict:
    """Run dark-flow detection for tracked/watchlist symbols and persist alerts."""
    if not getattr(settings, 'ORDER_FLOW_DETECTION_ENABLED', True):
        return {'status': 'disabled'}

    from portfolio.models import OrderFlowSignal
    from portfolio.order_flow import detect_dark_flow

    if symbol:
        symbols = [symbol.upper()]
    else:
        tracked = list(TrackedSymbol.objects.values_list('symbol', flat=True).distinct())
        watchlisted = list(WatchlistItem.objects.values_list('symbol', flat=True).distinct())
        symbols = sorted({s.upper() for s in tracked + watchlisted if s})[:ORDER_FLOW_MAX_SYMBOLS]

    processed = 0
    stored = 0
    alerted = 0
    errors = 0

    for sym in symbols:
        lock_key = f'order_flow_lock:{sym}'
        if cache.get(lock_key):
            continue

        try:
            result = detect_dark_flow(sym)
        except Exception as exc:
            logger.warning('detect_dark_flow error for %s: %s', sym, exc)
            errors += 1
            continue

        processed += 1
        strength = float(result.get('strength', 0) or 0)
        signal_type = str(result.get('signal_type', 'none') or 'none')
        comps = result.get('components', {}) or {}
        tick_rate_info = comps.get('tick_rate', {}) or {}
        size_dist = comps.get('size_distribution', {}) or {}
        cvd_change = comps.get('absorption', {}).get('cvd_change', 0)

        if strength < 40:
            severity = OrderFlowSignal.SeverityChoices.INFO
        elif strength < 70:
            severity = OrderFlowSignal.SeverityChoices.WARNING
        else:
            severity = OrderFlowSignal.SeverityChoices.URGENT
        triggered_at_iso = result.get('triggered_at', timezone.now().isoformat())
        event_id = f"dark_flow:{sym}:{triggered_at_iso}:{signal_type}"

        if signal_type != 'none' or strength > 20:
            _, created = OrderFlowSignal.objects.update_or_create(
                event_id=event_id,
                defaults={
                    'symbol': sym,
                    'signal_type': signal_type,
                    'strength': strength,
                    'confidence': result.get('confidence', 'low'),
                    'tick_rate': tick_rate_info.get('tick_rate_per_min', 0),
                    'small_order_ratio': size_dist.get('small_ratio', 0),
                    'cvd_at_signal': cvd_change,
                    'price_at_signal': 0,
                    'window_seconds': 300,
                    'components_json': comps,
                    'severity': severity,
                },
            )
            if created:
                stored += 1
            cache.set(lock_key, True, timeout=ORDER_FLOW_COOLDOWN_SECONDS)

        if strength > 50:
            try:
                from asgiref.sync import async_to_sync
                from channels.layers import get_channel_layer

                channel_layer = get_channel_layer()
                iceberg = comps.get('iceberg', {}) or {}
                if iceberg.get('level'):
                    description = (
                        f"Phat hien {iceberg.get('repeat_count', 0)} lenh lap tai "
                        f"{iceberg.get('level', 0):,.0f} VND"
                    )
                else:
                    description = f"Tin hieu {signal_type} strength={strength:.0f}"

                async_to_sync(channel_layer.group_send)(
                    f'whale_{sym}',
                    {
                        'type': 'dark_flow_alert',
                        'data': {
                            'event_type': 'dark_flow_alert',
                            'contract_version': '1.0',
                            'symbol': sym,
                            'signal_type': signal_type,
                            'strength': strength,
                            'confidence': result.get('confidence', 'low'),
                            'tick_rate': tick_rate_info.get('tick_rate_per_min', 0),
                            'small_order_ratio': size_dist.get('small_ratio', 0),
                            'cvd_at_signal': cvd_change,
                            'description': description,
                            'event_id': event_id,
                            'ts': result.get('triggered_at', timezone.now().isoformat()),
                            'severity': severity,
                        },
                    },
                )
                alerted += 1

                from portfolio import tasks as tasks_facade

                tracked_rows = list(
                    TrackedSymbol.objects.filter(symbol=sym)
                    .values('user_id', 'whale_alert_threshold_million')
                )
                for tracked_row in tracked_rows:
                    tracked_user_id = int(tracked_row.get('user_id') or 0)
                    if not tracked_user_id:
                        continue
                    user_cfg = UserConfig.objects.filter(user_id=tracked_user_id).first()
                    if user_cfg is None:
                        continue
                    if not bool(user_cfg.advisory_whale_signal_enabled):
                        continue
                    threshold_vnd = tasks_facade._resolve_advisory_threshold_vnd(
                        user_cfg,
                        tracked_threshold_million=tracked_row.get('whale_alert_threshold_million'),
                    )
                    threshold_source = 'symbol_override' if tracked_row.get('whale_alert_threshold_million') is not None else 'user_default'
                    tasks_facade._accumulate_user_advisory_event(
                        user_id=int(tracked_user_id),
                        symbol=sym,
                        source='dark_flow',
                        payload={
                            'strength': strength,
                            'signal_type': signal_type,
                            'cvd_change': cvd_change,
                            'confidence': result.get('confidence', 'low'),
                            'matched_value_vnd': threshold_vnd,
                        },
                        threshold_vnd=threshold_vnd,
                        threshold_source=threshold_source,
                    )
            except Exception as exc:
                logger.warning('dark_flow_alert WS push failed for %s: %s', sym, exc)

    logger.info(
        'detect_and_store_order_flow: symbols=%d processed=%d stored=%d alerted=%d errors=%d',
        len(symbols), processed, stored, alerted, errors,
    )
    return {
        'status': 'ok',
        'symbols': len(symbols),
        'processed': processed,
        'stored': stored,
        'alerted': alerted,
        'errors': errors,
    }


@shared_task(bind=True, name='portfolio.tasks.detect_whale_reversal', autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={'max_retries': 0})
def detect_whale_reversal(self, symbol: str | None = None) -> dict:
    """Detect reversal signals and queue reversal advisories for tracked users."""
    if not getattr(settings, 'REVERSAL_DETECTION_ENABLED', True):
        return {'status': 'disabled'}

    if symbol:
        symbols = [str(symbol).strip().upper()]
    else:
        tracked = list(TrackedSymbol.objects.values_list('symbol', flat=True).distinct())
        watchlisted = list(WatchlistItem.objects.values_list('symbol', flat=True).distinct())
        symbols = sorted({str(s).strip().upper() for s in tracked + watchlisted if s})[:ORDER_FLOW_MAX_SYMBOLS]

    queued = 0
    processed = 0
    skipped_locked = 0

    from portfolio import tasks as tasks_facade

    for sym in symbols:
        lock_key = f'reversal_alert_lock:{sym}'
        lock_seconds = max(int(os.getenv('REVERSAL_COOLDOWN_SECONDS', '300')), 60)
        if not cache.add(lock_key, timezone.now().isoformat(), timeout=lock_seconds):
            skipped_locked += 1
            continue

        signal = tasks_facade._detect_reversal_signal(sym)
        if not signal:
            continue

        processed += 1
        tracked_user_ids = list(
            TrackedSymbol.objects.filter(symbol=sym).values_list('user_id', flat=True).distinct()
        )
        if not tracked_user_ids:
            continue

        for user_id in tracked_user_ids:
            user_cfg = UserConfig.objects.filter(user_id=user_id).first()
            if user_cfg is None:
                continue
            if not bool(user_cfg.advisory_whale_signal_enabled):
                continue

            threshold_vnd = float(user_cfg.whale_alert_threshold or 500) * 1_000_000
            tasks_facade.generate_whale_advisory_task.apply_async(
                kwargs={
                    'symbol': sym,
                    'matched_value_vnd': signal['sell_value_vnd'],
                    'side': 'SELL',
                    'threshold': threshold_vnd,
                    'force_refresh': True,
                    'user_id': user_id,
                    'source': WhaleAdvisory.SourceChoices.WHALE_SIGNAL,
                    'advisory_type': WhaleAdvisory.AdvisoryTypeChoices.REVERSAL,
                    'severity_override': WhaleAdvisory.SeverityChoices.URGENT,
                },
                countdown=1,
            )
            queued += 1

    return {
        'status': 'ok',
        'symbols': len(symbols),
        'processed': processed,
        'queued': queued,
        'skipped_locked': skipped_locked,
    }

from __future__ import annotations

import logging

from celery import shared_task

from portfolio.models import ScreenerScheduleConfig
from portfolio.services_global_screener import GlobalScreenerService
from portfolio.tasks_whale_auto_generation import auto_generate_advisories_for_all_tracked
from portfolio.tasks_whale_broadcast import _broadcast_screener_matched

logger = logging.getLogger(__name__)


@shared_task(bind=True, name='portfolio.tasks.run_global_screener_scheduled_task', autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={'max_retries': 1})
def run_global_screener_scheduled_task(self) -> dict:
    schedule_config = ScreenerScheduleConfig.objects.first()
    if schedule_config is not None and not schedule_config.is_user_custom_screener_enabled:
        return {
            'status': 'skipped',
            'reason': 'disabled',
            'symbol_count': 0,
            'matched_symbols': [],
        }

    snapshot = GlobalScreenerService.precompute_market_snapshot()
    matched_symbols = GlobalScreenerService.match_active_rules(snapshot=snapshot)
    history_count = 0
    broadcast_count = 0
    audience_count = 0
    auto_generation_queue_count = 0

    for symbol in matched_symbols:
        try:
            broadcast_result = _broadcast_screener_matched(symbol=symbol)
        except Exception as exc:
            logger.warning('Global screener broadcast failed for %s: %s', symbol, exc)
            continue

        history_count += int(broadcast_result.get('history_count', 0) or 0)
        broadcast_count += int(broadcast_result.get('broadcast_count', 0) or 0)
        audience_count += int(broadcast_result.get('audience_count', 0) or 0)

    if matched_symbols:
        try:
            auto_generate_advisories_for_all_tracked.apply_async(kwargs={'matched_symbols': matched_symbols}, countdown=0)
            auto_generation_queue_count = len(matched_symbols)
        except Exception as exc:
            logger.warning('Global screener auto-generation enqueue failed: %s', exc)

    logger.info(
        'Global screener scheduled run completed: symbol_count=%s matched=%s',
        snapshot.get('symbol_count', 0),
        len(matched_symbols),
    )

    return {
        'status': 'ok',
        'generated_at': snapshot.get('generated_at'),
        'symbol_count': snapshot.get('symbol_count', 0),
        'matched_symbols': matched_symbols,
        'screener_history_count': history_count,
        'screener_broadcast_count': broadcast_count,
        'screener_audience_count': audience_count,
        'auto_generation_queue_count': auto_generation_queue_count,
    }


@shared_task(bind=True, name='portfolio.tasks.run_global_screener_manual_task', autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={'max_retries': 1})
def run_global_screener_manual_task(self) -> dict:
    return run_global_screener_scheduled_task()
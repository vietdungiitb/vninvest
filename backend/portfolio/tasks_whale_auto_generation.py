from __future__ import annotations

import logging
import os
import random

from celery import shared_task
from django.utils import timezone

from portfolio.models import UserConfig, WhaleAdvisory
from portfolio.tasks_advisory_helpers import (
    _get_remaining_advisory_budget,
    _resolve_advisory_threshold_vnd,
)

logger = logging.getLogger(__name__)


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, retry_kwargs={'max_retries': 1})
def auto_generate_advisories_for_all_tracked(self, batch_size: int | None = None) -> dict:
    """Auto-generate advisories for tracked symbols with enabled users."""
    batch_size = batch_size or int(os.getenv('ADVISORY_AUTO_GENERATE_BATCH_SIZE', '20'))

    from portfolio.models import TrackedSymbol
    from portfolio import tasks as tasks_facade

    start_time = timezone.now()
    tracked_symbols = TrackedSymbol.objects.filter(
        user__userconfig__advisory_auto_generation_enabled=True,
        is_active=True,
    ).select_related('user', 'user__userconfig').distinct()[:batch_size]

    generated_count = 0
    skipped_count = 0
    failed_count = 0

    for ts in tracked_symbols:
        try:
            user_cfg = UserConfig.objects.filter(user_id=ts.user_id).first()
            if not user_cfg or not user_cfg.advisory_auto_generation_enabled:
                skipped_count += 1
                continue

            remaining_budget = _get_remaining_advisory_budget(user_cfg)
            if remaining_budget <= 0:
                skipped_count += 1
                continue

            threshold = _resolve_advisory_threshold_vnd(user_cfg, ts.symbol)

            tasks_facade.generate_whale_advisory_task.apply_async(
                kwargs={
                    'symbol': ts.symbol,
                    'matched_value_vnd': threshold,
                    'side': 'BUY',
                    'threshold': threshold,
                    'user_id': ts.user_id,
                    'source': WhaleAdvisory.SourceChoices.PERIODIC_JOB,
                },
                countdown=random.randint(1, 5),
            )
            generated_count += 1
        except Exception as exc:
            logger.error('Auto-generation failed for user=%s symbol=%s: %s', ts.user_id, ts.symbol, exc)
            failed_count += 1

    elapsed = (timezone.now() - start_time).total_seconds()
    return {
        'status': 'ok',
        'generated_count': generated_count,
        'skipped_count': skipped_count,
        'failed_count': failed_count,
        'elapsed_seconds': elapsed,
        'batch_size': batch_size,
    }

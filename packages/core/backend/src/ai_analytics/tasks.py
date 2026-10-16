"""Nightly usage rollup (R0.7 AC8).

`rollup_usage_daily` upsert AIUsageSummary theo unique (date, user, action).
Chay lai nhieu lan khong nhan doi (update_or_create). Chua noi lich beat —
bao coordinator noi `CELERY_BEAT_SCHEDULE` (bao hanh vi, khong tu sua schedule).
"""
import logging
from datetime import date

from django.db.models import Avg, Count, Sum

logger = logging.getLogger(__name__)


def rollup_usage_daily(target_date=None):
    """Rollup AIUsageRecord cua 1 ngay vao AIUsageSummary. Tra so dong upsert."""
    from ai_analytics.models import AIUsageRecord, AIUsageSummary

    if target_date is None:
        from django.utils import timezone

        target_date = timezone.localdate()
    if isinstance(target_date, str):
        from datetime import date as _date

        target_date = _date.fromisoformat(target_date)

    groups = (
        AIUsageRecord.objects.filter(created_at__date=target_date)
        # R1.5: grain (user, action, model, status) — khớp unique_together mới,
        # để summary lọc được theo model/status như records.
        .values('user', 'action', 'model', 'status')
        .annotate(
            total_requests=Count('id'),
            total_tokens_in=Sum('tokens_in'),
            total_tokens_out=Sum('tokens_out'),
            total_cost=Sum('cost'),
            avg_latency_ms=Avg('latency_ms'),
        )
    )
    upserted = 0
    for group in groups:
        AIUsageSummary.objects.update_or_create(
            date=target_date,
            user_id=group['user'],
            action=group['action'],
            model=group['model'],
            status=group['status'],
            defaults={
                'total_requests': group['total_requests'] or 0,
                'total_tokens_in': group['total_tokens_in'] or 0,
                'total_tokens_out': group['total_tokens_out'] or 0,
                'total_cost': group['total_cost'] or 0,
                'avg_latency_ms': float(group['avg_latency_ms'] or 0),
            },
        )
        upserted += 1
    logger.info('rollup_usage_daily %s: %d summaries', target_date, upserted)
    return upserted

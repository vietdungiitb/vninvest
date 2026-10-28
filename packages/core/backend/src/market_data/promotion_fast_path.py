"""B06 — Promotion fast-path bootstrap.

Khi một symbol được promote/activate vào demand registry (tier hot/warm),
tạo ngay một repair obligation và enqueue backfill task nhanh để không phải
chờ weekly deep-history batch.

SLA mặc định:
  - hot: enqueue ngay lập tức (countdown=0)
  - warm: enqueue trong 5 phút
  - cold/other: không enqueue

Không tạo duplicate: nếu đã có một repair task đang chạy/queued cho symbol này
trong khoảng thời gian SLA thì bỏ qua.
"""
from __future__ import annotations

import logging
from typing import Any

from django.conf import settings
from django.utils import timezone

from .models import GlobalSymbolCoverage, GlobalSymbolRegistry

logger = logging.getLogger(__name__)

# SLA countdown (giây) theo tier
_PROMOTION_SLA_SECONDS: dict[str, int] = {
    'hot': 0,
    'warm': 300,    # 5 phút
    'cold': -1,     # không enqueue
    'recovery': 60,
    '': -1,
}

# Thời gian cooldown tránh duplicate enqueue cho cùng symbol (giây)
_DEDUP_WINDOW_SECONDS = 600  # 10 phút


def _get_sla_countdown(tier: str) -> int:
    """Trả về số giây delay trước khi task chạy; -1 = không enqueue."""
    return _PROMOTION_SLA_SECONDS.get(str(tier or '').lower(), -1)


def should_enqueue_promotion_repair(
    registry: GlobalSymbolRegistry,
    dataset: str = GlobalSymbolCoverage.DatasetChoices.DAILY_PRICES,
) -> bool:
    """Kiểm tra xem symbol này có nên được enqueue promotion repair không.

    Trả về False nếu:
    - Tier không đủ ưu tiên (cold / unknown)
    - Coverage hiện tại đã fresh
    - Đã có repair trong dedup window
    """
    tier = str(getattr(registry, 'current_priority_tier', '') or '').lower()
    if _get_sla_countdown(tier) < 0:
        return False

    coverage = GlobalSymbolCoverage.objects.filter(
        registry=registry, dataset=dataset,
    ).first()
    if coverage is None:
        return True   # Không có coverage row → cần bootstrap

    if coverage.freshness_state == GlobalSymbolCoverage.FreshnessChoices.FRESH:
        return False  # Đã fresh, không cần repair

    # Dedup: nếu vừa mới có action trong window thì bỏ qua
    if coverage.last_verified_at is not None:
        age = (timezone.now() - coverage.last_verified_at).total_seconds()
        if age < _DEDUP_WINDOW_SECONDS:
            logger.debug(
                'promotion_fast_path: skip dedup symbol=%s dataset=%s age=%.0fs',
                registry.symbol, dataset, age,
            )
            return False

    return True


def enqueue_promotion_repair(
    *,
    symbol: str,
    tier: str,
    dataset: str = GlobalSymbolCoverage.DatasetChoices.DAILY_PRICES,
    trigger_reason: str = 'promotion_activate',
) -> dict[str, Any]:
    """Enqueue backfill repair task cho symbol vừa được promoted.

    Trả về dict mô tả kết quả: `{'enqueued': bool, 'reason': str, ...}`.
    Import Celery task bên trong để tránh circular import.
    """
    countdown = _get_sla_countdown(tier)
    if countdown < 0:
        return {'enqueued': False, 'reason': f'tier_not_eligible:{tier}', 'symbol': symbol}

    try:
        from data_ingest.tasks import backfill_daily_prices

        task_result = backfill_daily_prices.apply_async(
            kwargs={
                'symbols': [symbol],
                'mode': 'targeted_symbol_repair',
                'trigger': 'auto_promotion_fast_path',
                'requested_days': getattr(settings, 'PROMOTION_REPAIR_DAYS', 30),
            },
            countdown=countdown,
        )
        logger.info(
            'promotion_fast_path: enqueued symbol=%s tier=%s countdown=%ds task_id=%s reason=%s',
            symbol, tier, countdown, task_result.id, trigger_reason,
        )
        return {
            'enqueued': True,
            'task_id': task_result.id,
            'countdown_seconds': countdown,
            'symbol': symbol,
            'tier': tier,
            'reason': trigger_reason,
        }
    except Exception as exc:
        logger.warning(
            'promotion_fast_path: failed to enqueue symbol=%s tier=%s error=%s',
            symbol, tier, exc,
        )
        return {'enqueued': False, 'reason': f'enqueue_error:{exc}', 'symbol': symbol}


def handle_symbol_promotion(
    registry: GlobalSymbolRegistry,
    *,
    previous_tier: str | None = None,
    dataset: str = GlobalSymbolCoverage.DatasetChoices.DAILY_PRICES,
) -> dict[str, Any]:
    """Điểm vào chính của B06: gọi sau khi `refresh_global_symbol_registry` cập nhật tier.

    Kiểm tra xem tier có thay đổi lên (hot/warm) không và enqueue nếu cần.
    Trả về dict kết quả để caller có thể log/audit.
    """
    new_tier = str(getattr(registry, 'current_priority_tier', '') or '').lower()
    old_tier = str(previous_tier or '').lower()

    # Chỉ trigger khi tier tăng lên hoặc symbol mới
    tier_rank = {'hot': 3, 'warm': 2, 'recovery': 2, 'cold': 1, '': 0}
    is_promotion = tier_rank.get(new_tier, 0) > tier_rank.get(old_tier, 0)

    if not is_promotion:
        return {
            'triggered': False,
            'reason': 'no_tier_promotion',
            'symbol': registry.symbol,
            'old_tier': old_tier,
            'new_tier': new_tier,
        }

    if not should_enqueue_promotion_repair(registry, dataset=dataset):
        return {
            'triggered': False,
            'reason': 'dedup_or_already_fresh',
            'symbol': registry.symbol,
            'old_tier': old_tier,
            'new_tier': new_tier,
        }

    result = enqueue_promotion_repair(
        symbol=registry.symbol,
        tier=new_tier,
        dataset=dataset,
        trigger_reason=f'tier_promoted:{old_tier}->{new_tier}',
    )
    result.update({'old_tier': old_tier, 'new_tier': new_tier, 'triggered': result.get('enqueued', False)})
    return result

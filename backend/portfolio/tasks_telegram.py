"""
PR-4 — I1: Telegram Alert Dispatcher Task
Trigger: post_save signal của WhaleAdvisory (gọi .delay() — KHÔNG xử lý trực tiếp).
Logic:
  1. Phân loại severity (Critical/High/Normal).
  2. Lấy danh sách TelegramProfile verified.
  3. Áp dụng gating: mute, priority_threshold, preferred_symbols (Free).
  4. Route vào Celery queue high_priority hoặc default.
  5. Gọi Telegram Bot API.
"""
from __future__ import annotations

import logging

from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task(
    name='portfolio.tasks_telegram.dispatch_whale_alert',
    bind=True,
    max_retries=3,
    default_retry_delay=30,
    queue='default',
)
def dispatch_whale_alert(self, advisory_id: int):
    """
    Gửi Telegram alert cho một WhaleAdvisory cụ thể.
    Được gọi bất đồng bộ từ post_save signal (không block DB write).
    """
    from portfolio.models import TelegramProfile, WhaleAdvisory
    from portfolio.telegram_service import (
        format_whale_alert_message,
        get_signal_severity,
        mask_symbol,
        send_message,
    )

    try:
        advisory = WhaleAdvisory.objects.select_related('user').get(pk=advisory_id)
    except WhaleAdvisory.DoesNotExist:
        logger.warning('[dispatch_whale_alert] Advisory %d không tồn tại', advisory_id)
        return {'status': 'skipped', 'reason': 'advisory_not_found'}

    severity = get_signal_severity(advisory.matched_value)
    severity_level_map = {'critical': 3, 'high': 2, 'normal': 1}
    severity_level = severity_level_map[severity]

    # Route Critical → high_priority queue nếu chưa ở đó
    if severity == 'critical' and self.request.delivery_info.get('routing_key') != 'high_priority':
        dispatch_whale_alert.apply_async(
            kwargs={'advisory_id': advisory_id},
            queue='high_priority',
        )
        return {'status': 'rerouted', 'queue': 'high_priority'}

    profiles = TelegramProfile.objects.filter(is_verified=True).select_related('user')
    sent = 0
    skipped = 0

    # Kiểm tra Pro một lần cho user sở hữu advisory (nếu có)
    try:
        from portfolio.opencore_premium import PremiumFeatureGate
        def _is_pro(user):
            return PremiumFeatureGate.can_use_feature(user, 'telegram_bot_full')
    except Exception:
        def _is_pro(user):
            return False

    now = timezone.now()

    for profile in profiles:
        try:
            # 1. Kiểm tra mute (Critical bypass mute)
            if severity != 'critical' and profile.mute_until and profile.mute_until > now:
                skipped += 1
                continue

            # 2. Kiểm tra priority_threshold
            if severity_level < profile.priority_threshold:
                skipped += 1
                continue

            is_pro = _is_pro(profile.user)

            # 3. Free user: kiểm tra preferred_symbols
            if not is_pro:
                preferred = profile.preferred_symbols or []
                if advisory.symbol not in preferred:
                    skipped += 1
                    continue

            is_masked = not is_pro
            text = format_whale_alert_message(
                symbol=advisory.symbol,
                matched_value_vnd=advisory.matched_value,
                side=advisory.side,
                ai_summary=advisory.ai_summary,
                severity=severity,
                is_masked=is_masked,
            )

            result = send_message(profile.chat_id, text)
            if result:
                sent += 1
            else:
                skipped += 1

        except Exception as exc:
            logger.error('[dispatch_whale_alert] profile=%d error: %s', profile.pk, exc)
            skipped += 1

    summary = {
        'status': 'ok',
        'advisory_id': advisory_id,
        'severity': severity,
        'sent': sent,
        'skipped': skipped,
    }
    logger.info('[dispatch_whale_alert] %s', summary)
    return summary


@shared_task(
    name='portfolio.tasks_telegram.send_direct_message',
    queue='default',
)
def send_direct_message(chat_id: int, text: str, parse_mode: str = 'HTML'):
    """Helper task để gửi message tùy ý qua queue (dùng trong test/admin)."""
    from portfolio.telegram_service import send_message
    return send_message(chat_id, text, parse_mode=parse_mode)

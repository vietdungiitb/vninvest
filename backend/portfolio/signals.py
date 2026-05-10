from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from .global_signal_policy_helpers import invalidate_global_signal_universe_cache
from .models import PriceAlertRule, RuntimeVnbrokerConfig, SecuritiesItem, TrackedSymbol, Transaction, WatchlistItem
from .vnbroker_runtime_config import invalidate_vnbroker_runtime_cache


@receiver(post_save, sender=RuntimeVnbrokerConfig)
def invalidate_runtime_vnbroker_cache_on_save(sender, instance, **kwargs):
    del sender, instance, kwargs
    invalidate_vnbroker_runtime_cache()


@receiver(post_save, sender=Transaction)
@receiver(post_delete, sender=Transaction)
def invalidate_holdings_cache_on_transaction(sender, instance, **kwargs):
    """
    Khi có Transaction mới/cập nhật → xoá cache holdings của portfolio đó.
    Cache key format: holdings:{portfolio_id}:{period}:{YYYY-MM-DD}
    """
    from django.core.cache import cache
    from datetime import date
    try:
        portfolio_id = instance.sub_account.portfolio_id
    except Exception:
        portfolio_id = None
    if portfolio_id:
        today = date.today().isoformat()
        for period in ('1D', '5D', '1M', 'YTD'):
            cache.delete(f'holdings:{portfolio_id}:{period}:{today}')
    invalidate_global_signal_universe_cache()


@receiver(post_save, sender=TrackedSymbol)
@receiver(post_delete, sender=TrackedSymbol)
@receiver(post_save, sender=WatchlistItem)
@receiver(post_delete, sender=WatchlistItem)
@receiver(post_save, sender=PriceAlertRule)
@receiver(post_delete, sender=PriceAlertRule)
@receiver(post_save, sender=SecuritiesItem)
@receiver(post_delete, sender=SecuritiesItem)
def invalidate_global_signal_universe_on_source_change(sender, instance, **kwargs):
    del sender, instance, kwargs
    invalidate_global_signal_universe_cache()



@receiver(post_save, sender='portfolio.WhaleAdvisory')
def trigger_telegram_whale_alert(sender, instance, created, **kwargs):
    """
    Khi WhaleAdvisory mới được tạo, dispatch Telegram alert bất đồng bộ.
    KHÔNG xử lý trực tiếp — chỉ enqueue Celery task để tránh block DB write.
    """
    if not created:
        return
    try:
        from portfolio.tasks_telegram import dispatch_whale_alert
        dispatch_whale_alert.delay(advisory_id=instance.pk)
    except Exception:
        # Import error hoặc Celery chưa sẵn sàng — log và bỏ qua
        import logging
        logging.getLogger(__name__).warning(
            '[signals] Không thể enqueue telegram alert cho advisory %d', instance.pk
        )

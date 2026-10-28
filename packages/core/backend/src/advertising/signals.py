import logging

from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from advertising.models import AdCampaign
from advertising.tasks import rebuild_ads_cache_index

logger = logging.getLogger(__name__)


@receiver(post_save, sender=AdCampaign)
@receiver(post_delete, sender=AdCampaign)
def on_campaign_changed(sender, instance, **kwargs):
    """Trigger Redis cache reindexing asynchronously on campaign modifications."""
    try:
        rebuild_ads_cache_index.delay()
        logger.info("AdCampaign %s changed; triggered cache index rebuild task.", instance.id)
    except Exception as exc:
        logger.error("Failed to enqueue rebuild_ads_cache_index task on campaign change: %s", exc)
        # Fallback to synchronous run if Celery isn't running or configured properly in dev
        try:
            rebuild_ads_cache_index()
        except Exception:
            pass

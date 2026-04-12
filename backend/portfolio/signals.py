from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import RuntimeVnstockConfig
from .vnstock_runtime_config import invalidate_vnstock_runtime_cache


@receiver(post_save, sender=RuntimeVnstockConfig)
def invalidate_runtime_vnstock_cache_on_save(sender, instance, **kwargs):
    del sender, instance, kwargs
    invalidate_vnstock_runtime_cache()

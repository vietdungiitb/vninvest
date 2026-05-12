from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from identity_access.models import CoreTenant

from tenant_lifecycle.models import TenantLifecycleEvent


@receiver(pre_save, sender=CoreTenant)
def capture_original_status(sender, instance, **kwargs):
    if not instance.pk:
        instance._original_status = None
        return

    try:
        instance._original_status = (
            CoreTenant.objects.only('status').values_list('status', flat=True).get(pk=instance.pk)
        )
    except CoreTenant.DoesNotExist:
        instance._original_status = None


@receiver(post_save, sender=CoreTenant)
def log_status_change(sender, instance, created, **kwargs):
    if created:
        event_type = TenantLifecycleEvent.EventType.STATUS_CHANGED
        if instance.status == CoreTenant.StatusChoices.TRIAL:
            event_type = TenantLifecycleEvent.EventType.TRIAL_STARTED
        TenantLifecycleEvent.objects.create(
            tenant=instance,
            event_type=event_type,
            actor_type='system',
            new_value={'status': instance.status},
        )
        return

    original = getattr(instance, '_original_status', None)
    if original is None or original == instance.status:
        return

    TenantLifecycleEvent.objects.create(
        tenant=instance,
        event_type=TenantLifecycleEvent.EventType.STATUS_CHANGED,
        actor_type=getattr(instance, '_actor_type', 'system'),
        actor_user=getattr(instance, '_actor_user', None),
        old_value={'status': original},
        new_value={'status': instance.status},
    )

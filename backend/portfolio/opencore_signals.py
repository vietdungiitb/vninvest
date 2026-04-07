"""
Django signals for OpenCore DPI integration.

Automatically creates default Free tier licenses for new users.
"""

from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth.models import User
from django.utils import timezone
from .opencore_dpi import DPIPlan, DPILicense, DPIUsageMetrics, get_or_create_default_license


@receiver(post_save, sender=User)
def create_dpi_license_for_new_user(sender, instance, created, **kwargs):
    """
    Signal handler: Create default Free tier license for new users.
    Called when a User instance is created.
    """
    if not created:
        return  # Only process on creation
    
    try:
        # Create or get default license
        license = get_or_create_default_license(instance)
        print(f"[OpenCore] Created default Free license for user: {instance.username}")
    except Exception as e:
        print(f"[OpenCore] Error creating license for {instance.username}: {e}")

from django.contrib.auth.models import User
from django.db import models


class TenantLifecycleEvent(models.Model):
    class EventType(models.TextChoices):
        PLAN_CHANGED = 'plan_changed', 'Plan Changed'
        STATUS_CHANGED = 'status_changed', 'Status Changed'
        TRIAL_STARTED = 'trial_started', 'Trial Started'
        TRIAL_EXPIRED = 'trial_expired', 'Trial Expired'
        QUOTA_EXCEEDED = 'quota_exceeded', 'Quota Exceeded'
        QUOTA_WARNING = 'quota_warning', 'Quota Warning'
        INVOICE_CREATED = 'invoice_created', 'Invoice Created'
        INVOICE_PAID = 'invoice_paid', 'Invoice Paid'
        INVOICE_OVERDUE = 'invoice_overdue', 'Invoice Overdue'
        MEMBER_INVITED = 'member_invited', 'Member Invited'
        MEMBER_JOINED = 'member_joined', 'Member Joined'
        MEMBER_REMOVED = 'member_removed', 'Member Removed'
        PAT_ROTATED = 'pat_rotated', 'PAT Rotated'
        DEPROVISIONED = 'deprovisioned', 'Deprovisioned'

    tenant = models.ForeignKey(
        'identity_access.CoreTenant',
        on_delete=models.CASCADE,
        related_name='lifecycle_events',
    )
    event_type = models.CharField(max_length=64, choices=EventType.choices, db_index=True)
    actor_type = models.CharField(max_length=32, default='system')
    actor_user = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    old_value = models.JSONField(null=True, blank=True)
    new_value = models.JSONField(null=True, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = 'tenant_lifecycle_event'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['tenant', 'event_type']),
            models.Index(fields=['tenant', 'created_at']),
        ]

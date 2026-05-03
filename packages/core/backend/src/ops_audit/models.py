"""
Ops Audit models: AuditEvent and RequestTrace.

ISOLATION RULE: No imports from backend.portfolio or backend.* allowed.
"""
import uuid

from django.db import models


class AuditEvent(models.Model):
    class ActionChoices(models.TextChoices):
        CREATE = 'create', 'Create'
        UPDATE = 'update', 'Update'
        DELETE = 'delete', 'Delete'
        ACCESS = 'access', 'Access'
        AUTH = 'auth', 'Auth'
        REVOKE = 'revoke', 'Revoke'

    event_id = models.UUIDField(default=uuid.uuid4, unique=True, db_index=True, editable=False)
    actor_user_id = models.IntegerField(null=True, blank=True, db_index=True)
    actor_label = models.CharField(max_length=120, blank=True, default='')
    tenant_id = models.CharField(max_length=36, blank=True, default='', db_index=True)
    action = models.CharField(max_length=16, choices=ActionChoices.choices, db_index=True)
    resource_type = models.CharField(max_length=64, db_index=True)
    resource_id = models.CharField(max_length=64, blank=True, default='')
    request_id = models.CharField(max_length=36, blank=True, default='', db_index=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    occurred_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        verbose_name = 'Audit Event'
        verbose_name_plural = 'Audit Events'
        ordering = ['-occurred_at', '-pk']
        indexes = [
            models.Index(fields=['tenant_id', 'action', 'occurred_at']),
        ]

    def __str__(self):
        return f'[{self.action}] {self.resource_type}/{self.resource_id} by {self.actor_label}'


class RequestTrace(models.Model):
    request_id = models.CharField(max_length=36, unique=True, db_index=True)
    method = models.CharField(max_length=8)
    path = models.CharField(max_length=512)
    status_code = models.SmallIntegerField(null=True, blank=True)
    actor_user_id = models.IntegerField(null=True, blank=True)
    tenant_id = models.CharField(max_length=36, blank=True, default='')
    duration_ms = models.IntegerField(null=True, blank=True)
    traced_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        verbose_name = 'Request Trace'
        verbose_name_plural = 'Request Traces'
        ordering = ['-traced_at', '-pk']

    def __str__(self):
        return f'{self.method} {self.path} [{self.status_code}] {self.request_id}'

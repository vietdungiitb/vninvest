import uuid

from django.contrib.auth.models import User
from django.db import models, transaction
from django.utils import timezone


class TicketCategory(models.TextChoices):
    TECHNICAL = 'TECHNICAL', 'Technical'
    ACCOUNT = 'ACCOUNT', 'Account'
    BILLING = 'BILLING', 'Billing'
    FEATURE_REQUEST = 'FEATURE_REQUEST', 'Feature request'
    OTHER = 'OTHER', 'Other'


class TicketPriority(models.TextChoices):
    LOW = 'LOW', 'Low'
    MEDIUM = 'MEDIUM', 'Medium'
    HIGH = 'HIGH', 'High'
    URGENT = 'URGENT', 'Urgent'


class TicketStatus(models.TextChoices):
    OPEN = 'OPEN', 'Open'
    IN_PROGRESS = 'IN_PROGRESS', 'In progress'
    RESOLVED = 'RESOLVED', 'Resolved'
    CLOSED = 'CLOSED', 'Closed'
    REOPENED = 'REOPENED', 'Reopened'


class SenderRole(models.TextChoices):
    USER = 'USER', 'User'
    STAFF = 'STAFF', 'Staff'
    SYSTEM = 'SYSTEM', 'System'


class SupportTicketCounter(models.Model):
    date = models.DateField(unique=True)
    last_number = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name = 'Support ticket counter'
        verbose_name_plural = 'Support ticket counters'


class SupportTicket(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ticket_code = models.CharField(max_length=24, unique=True, db_index=True, blank=True)
    requester = models.ForeignKey(User, on_delete=models.CASCADE, related_name='support_tickets', db_index=True)
    subject = models.CharField(max_length=255)
    category = models.CharField(max_length=20, choices=TicketCategory.choices, default=TicketCategory.OTHER, db_index=True)
    priority = models.CharField(max_length=10, choices=TicketPriority.choices, default=TicketPriority.MEDIUM, db_index=True)
    status = models.CharField(max_length=20, choices=TicketStatus.choices, default=TicketStatus.OPEN, db_index=True)
    assignee = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_support_tickets',
        db_index=True,
    )
    first_response_at = models.DateTimeField(null=True, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    last_message_at = models.DateTimeField(default=timezone.now, db_index=True)
    last_message_by_staff = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['requester', 'status', '-updated_at'], name='support_req_status_upd_idx'),
            models.Index(fields=['status', 'priority', '-updated_at'], name='support_queue_idx'),
        ]
        ordering = ['-updated_at']

    def __str__(self):
        return f'{self.ticket_code} - {self.subject}'

    @staticmethod
    def _next_ticket_code():
        today = timezone.localdate()
        with transaction.atomic():
            counter, _ = SupportTicketCounter.objects.select_for_update().get_or_create(date=today)
            counter.last_number += 1
            counter.save(update_fields=['last_number'])
            return f'VNST-{today:%Y%m%d}-{counter.last_number:06d}'

    def save(self, *args, **kwargs):
        if not self.ticket_code:
            self.ticket_code = self._next_ticket_code()
        super().save(*args, **kwargs)

    def can_transition(self, target_status, actor_is_staff=False):
        allowed = {
            TicketStatus.OPEN: {TicketStatus.IN_PROGRESS, TicketStatus.CLOSED},
            TicketStatus.IN_PROGRESS: {TicketStatus.RESOLVED, TicketStatus.CLOSED},
            TicketStatus.RESOLVED: {TicketStatus.CLOSED, TicketStatus.REOPENED},
            TicketStatus.CLOSED: {TicketStatus.REOPENED},
            TicketStatus.REOPENED: {TicketStatus.IN_PROGRESS, TicketStatus.CLOSED},
        }
        if target_status not in allowed.get(self.status, set()):
            return False

        if self.status == TicketStatus.OPEN and target_status == TicketStatus.IN_PROGRESS and not actor_is_staff:
            return False
        if self.status == TicketStatus.OPEN and target_status == TicketStatus.CLOSED and not actor_is_staff:
            return False
        if self.status == TicketStatus.IN_PROGRESS and target_status in {TicketStatus.RESOLVED, TicketStatus.CLOSED} and not actor_is_staff:
            return False
        if self.status == TicketStatus.CLOSED and target_status == TicketStatus.REOPENED and not actor_is_staff:
            return False
        if self.status == TicketStatus.REOPENED and target_status in {TicketStatus.IN_PROGRESS, TicketStatus.CLOSED} and not actor_is_staff:
            return False

        return True


def ticket_attachment_upload_path(instance, filename):
    ext = (filename.rsplit('.', 1)[-1].lower() if '.' in filename else 'bin')
    return f'support/{instance.message.ticket_id}/{uuid.uuid4().hex}.{ext}'


class TicketMessage(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ticket = models.ForeignKey(SupportTicket, on_delete=models.CASCADE, related_name='messages', db_index=True)
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='support_messages', db_index=True)
    sender_role = models.CharField(max_length=10, choices=SenderRole.choices)
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['created_at']


class TicketAttachment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    message = models.ForeignKey(TicketMessage, on_delete=models.CASCADE, related_name='attachments', db_index=True)
    file = models.FileField(upload_to=ticket_attachment_upload_path)
    original_name = models.CharField(max_length=255)
    mime_type = models.CharField(max_length=128)
    size_bytes = models.BigIntegerField(default=0)
    sha256 = models.CharField(max_length=64, db_index=True, blank=True)
    is_safe = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)


class TicketAuditLog(models.Model):
    ticket = models.ForeignKey(SupportTicket, on_delete=models.CASCADE, related_name='audit_logs')
    actor = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    action = models.CharField(max_length=64)
    old_value = models.JSONField(default=dict, blank=True)
    new_value = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

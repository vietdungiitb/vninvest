"""
data_ingest models.

IngestJob: represents a repeatable ingest source (e.g. vnstock price board).
IngestRun: represents one execution instance of an IngestJob.
"""
from django.db import models
from django.utils import timezone


class IngestJob(models.Model):
    class SourceChoices(models.TextChoices):
        VNSTOCK_PRICE_BOARD = 'vnstock_price_board', 'vnstock Price Board'
        VNSTOCK_INTRADAY = 'vnstock_intraday', 'vnstock Intraday'
        LEGACY_SYNC = 'legacy_sync', 'Legacy DB Sync'
        MANUAL = 'manual', 'Manual Trigger'

    class StatusChoices(models.TextChoices):
        ACTIVE = 'active', 'Active'
        PAUSED = 'paused', 'Paused'
        DISABLED = 'disabled', 'Disabled'

    name = models.CharField(max_length=64, unique=True)
    source = models.CharField(max_length=32, choices=SourceChoices.choices)
    status = models.CharField(max_length=16, choices=StatusChoices.choices, default=StatusChoices.ACTIVE)
    schedule_seconds = models.PositiveIntegerField(default=60)
    config = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Ingest Job'
        verbose_name_plural = 'Ingest Jobs'
        ordering = ['name']

    def __str__(self):
        return f'{self.name} [{self.source}]'


class IngestRun(models.Model):
    class StateChoices(models.TextChoices):
        RUNNING = 'running', 'Running'
        SUCCESS = 'success', 'Success'
        FAILED = 'failed', 'Failed'
        SKIPPED = 'skipped', 'Skipped'

    job = models.ForeignKey(IngestJob, on_delete=models.CASCADE, related_name='runs')
    state = models.CharField(max_length=16, choices=StateChoices.choices, default=StateChoices.RUNNING)
    rows_upserted = models.PositiveIntegerField(default=0)
    rows_skipped = models.PositiveIntegerField(default=0)
    error_message = models.TextField(blank=True, default='')
    started_at = models.DateTimeField(default=timezone.now)
    finished_at = models.DateTimeField(null=True, blank=True)
    meta = models.JSONField(default=dict, blank=True)

    class Meta:
        verbose_name = 'Ingest Run'
        verbose_name_plural = 'Ingest Runs'
        ordering = ['-started_at']
        indexes = [
            models.Index(fields=['job', 'started_at']),
            models.Index(fields=['state', 'started_at']),
        ]

    def __str__(self):
        return f'{self.job.name} @ {self.started_at.strftime("%Y-%m-%d %H:%M")} [{self.state}]'

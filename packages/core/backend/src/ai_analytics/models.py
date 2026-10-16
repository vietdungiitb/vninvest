from django.contrib.auth.models import User
from django.db import models


class AIUsageRecord(models.Model):
    class ActionChoices(models.TextChoices):
        ADVISORY = 'advisory', 'AI Advisory Generation'
        TEST_CONNECTION = 'test_connection', 'Test Connection'
        CHAT = 'chat', 'Chat Completion'
        OTHER = 'other', 'Other'

    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    action = models.CharField(
        max_length=32,
        choices=ActionChoices.choices,
        db_index=True,
        verbose_name='Hành động',
    )
    provider = models.CharField(max_length=32, default='', verbose_name='Nhà cung cấp')
    model = models.CharField(max_length=64, default='', verbose_name='Mô hình')
    tokens_in = models.IntegerField(default=0, verbose_name='Token đầu vào')
    tokens_out = models.IntegerField(default=0, verbose_name='Token đầu ra')
    cost = models.DecimalField(max_digits=12, decimal_places=6, default=0, verbose_name='Chi phí (USD)')
    latency_ms = models.IntegerField(default=0, verbose_name='Độ trễ (ms)')
    status = models.CharField(max_length=16, default='success', verbose_name='Trạng thái')
    # R0.7 AC9/AC10: co quan sat duoc, khong bia so lieu. Provider khong tra
    # usage => tokens 0 + usage_unavailable=True. Chua co bang gia AICostRate
    # => cost 0 + pricing_available=False.
    usage_unavailable = models.BooleanField(default=False, verbose_name='Thieu usage that')
    pricing_available = models.BooleanField(default=False, verbose_name='Co bang gia')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        verbose_name = 'AI Usage Record'
        verbose_name_plural = 'AI Usage Records'
        ordering = ['-created_at']

    def __str__(self) -> str:
        return f'{self.action} — {self.model} — {self.created_at}'


class AIUsageSummary(models.Model):
    date = models.DateField(db_index=True)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    action = models.CharField(max_length=32, db_index=True, verbose_name='Hành động')
    total_requests = models.IntegerField(default=0)
    total_tokens_in = models.IntegerField(default=0)
    total_tokens_out = models.IntegerField(default=0)
    total_cost = models.DecimalField(max_digits=14, decimal_places=6, default=0)
    avg_latency_ms = models.FloatField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'AI Usage Summary'
        verbose_name_plural = 'AI Usage Summaries'
        unique_together = [['date', 'user', 'action']]
        ordering = ['-date']

    def __str__(self) -> str:
        return f'{self.date} — {self.action} — {self.total_requests} requests'

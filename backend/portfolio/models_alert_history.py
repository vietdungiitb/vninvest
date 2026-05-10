from django.contrib.auth.models import User
from django.db import models
from django.utils import timezone


class UserAlertHistory(models.Model):
    class AlertTypeChoices(models.TextChoices):
        SCREENER = 'SCREENER', 'Screener'
        AI = 'AI', 'AI'
        WHALE = 'WHALE', 'Whale'
        DARK_MONEY = 'DARK_MONEY', 'Dark Money'

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='alert_histories',
        verbose_name='Người dùng',
    )
    symbol = models.CharField(max_length=10, db_index=True, verbose_name='Mã chứng khoán')
    alert_type = models.CharField(
        max_length=16,
        choices=AlertTypeChoices.choices,
        db_index=True,
        verbose_name='Loại cảnh báo',
    )
    message = models.TextField(verbose_name='Thông báo')
    matched_at = models.DateTimeField(default=timezone.now, db_index=True, verbose_name='Thời điểm khớp')

    class Meta:
        verbose_name = 'Lịch sử cảnh báo người dùng'
        verbose_name_plural = 'Lịch sử cảnh báo người dùng'
        ordering = ['-matched_at', '-id']
        indexes = [
            models.Index(fields=['symbol', 'alert_type', 'matched_at']),
        ]

    def __str__(self):
        return f'{self.symbol} | {self.alert_type} | {self.user.username}'

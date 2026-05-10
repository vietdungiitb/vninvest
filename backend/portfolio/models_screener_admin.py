from django.db import models


class GlobalScreenerRule(models.Model):
    name = models.CharField(max_length=100, verbose_name='Tên luật toàn cục')
    rules_json = models.JSONField(verbose_name='Luật lọc (JSON)')
    is_active = models.BooleanField(default=True, verbose_name='Kích hoạt')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Luật screener toàn cục'
        verbose_name_plural = 'Luật screener toàn cục'
        ordering = ['-updated_at', '-created_at']

    def __str__(self):
        return self.name


class ScreenerScheduleConfig(models.Model):
    cron_expression = models.CharField(
        max_length=64,
        default='*/5 * * * *',
        verbose_name='Biểu thức cron',
    )
    is_user_custom_screener_enabled = models.BooleanField(
        default=True,
        verbose_name='Bật screener người dùng',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Cấu hình lịch screener'
        verbose_name_plural = 'Cấu hình lịch screener'
        ordering = ['-updated_at', '-created_at']

    def __str__(self):
        state = 'Bật' if self.is_user_custom_screener_enabled else 'Tắt'
        return f'{self.cron_expression} | {state}'

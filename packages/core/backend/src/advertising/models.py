import uuid
from django.db import models
from django.core.exceptions import ValidationError
from identity_access.models import CoreTenant


class AdCampaign(models.Model):
    class CampaignType(models.TextChoices):
        INTERNAL_PROMO = 'internal_promo', 'Internal Upgrade Promo'
        PARTNER_AD = 'partner_ad', 'Partner Advertisement'

    class Status(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        ACTIVE = 'active', 'Active'
        PAUSED = 'paused', 'Paused'
        COMPLETED = 'completed', 'Completed'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=120, verbose_name="Tên Chiến Dịch")
    campaign_type = models.CharField(
        max_length=24, 
        choices=CampaignType.choices, 
        default=CampaignType.INTERNAL_PROMO
    )
    status = models.CharField(
        max_length=16, 
        choices=Status.choices, 
        default=Status.DRAFT, 
        db_index=True
    )
    
    # Ad asset options (supporting WebP & Vector sizes)
    banner_url = models.URLField(max_length=500, verbose_name="Ảnh Banner 1x (WebP/PNG)")
    banner_url_retina = models.URLField(max_length=500, null=True, blank=True, verbose_name="Ảnh Banner 2x (Retina High-DPI)")
    banner_url_svg = models.URLField(max_length=500, null=True, blank=True, verbose_name="Ảnh Banner Vector (SVG)")
    banner_width = models.IntegerField(default=300, help_text="Chiều rộng banner (px)")
    banner_height = models.IntegerField(default=50, help_text="Chiều cao banner (px)")
    
    # Destination & Redirect target
    destination_url = models.URLField(max_length=500, verbose_name="URL Đích (khi click thực tế)")
    
    # Weights & Scheduling
    weight = models.IntegerField(
        default=100, 
        help_text="Trọng số quay vòng quảng cáo (weight càng lớn tỷ lệ xuất hiện càng cao)"
    )
    start_date = models.DateTimeField(db_index=True, verbose_name="Ngày bắt đầu hiển thị")
    end_date = models.DateTimeField(db_index=True, verbose_name="Ngày kết thúc")
    
    # SaaS Enterprise override campaign support
    tenant = models.ForeignKey(
        CoreTenant,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='custom_ad_campaigns',
        help_text="Nếu set, quảng cáo này chỉ hiển thị riêng cho Widget của Tenant này"
    )
    
    # Advanced targeting logic (JSON-structured rules)
    targeting_rules = models.JSONField(
        default=dict, 
        blank=True, 
        help_text="Cấu hình luật hiển thị (Mã chứng khoán, Vùng miền, Tenant loại trừ)"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Chiến dịch quảng cáo"
        verbose_name_plural = "Chiến dịch quảng cáo"
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} ({self.get_campaign_type_display()} - {self.get_status_display()})"

    def clean(self):
        super().clean()
        if self.start_date and self.end_date and self.start_date >= self.end_date:
            raise ValidationError("Ngày kết thúc phải lớn hơn ngày bắt đầu chiến dịch.")


class AdDailySummary(models.Model):
    """Aggregated metrics grouped by campaign, host tenant, symbol and date."""
    campaign = models.ForeignKey(
        AdCampaign, 
        on_delete=models.CASCADE, 
        related_name='daily_summaries'
    )
    tenant = models.ForeignKey(
        CoreTenant, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True
    )
    symbol = models.CharField(max_length=16, default='ALL', db_index=True)
    date = models.DateField(db_index=True)
    
    impressions_count = models.BigIntegerField(default=0)
    clicks_count = models.BigIntegerField(default=0)

    class Meta:
        verbose_name = "Thống kê quảng cáo ngày"
        verbose_name_plural = "Thống kê quảng cáo ngày"
        constraints = [
            models.UniqueConstraint(
                fields=['campaign', 'tenant', 'symbol', 'date'],
                name='unique_ad_daily_summary_rule'
            )
        ]

    def __str__(self):
        return f"{self.campaign.name} - {self.date} (Cổ phiếu: {self.symbol})"


class AdImpressionLog(models.Model):
    """Raw log for ad views/impressions. Recommend Postgres partitioning by range of created_at."""
    campaign = models.ForeignKey(AdCampaign, on_delete=models.CASCADE)
    tenant = models.ForeignKey(CoreTenant, on_delete=models.SET_NULL, null=True, blank=True)
    symbol = models.CharField(max_length=16, blank=True, default='')
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)


class AdClickLog(models.Model):
    """Raw log for ad clicks."""
    campaign = models.ForeignKey(AdCampaign, on_delete=models.CASCADE)
    tenant = models.ForeignKey(CoreTenant, on_delete=models.SET_NULL, null=True, blank=True)
    symbol = models.CharField(max_length=16, blank=True, default='')
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

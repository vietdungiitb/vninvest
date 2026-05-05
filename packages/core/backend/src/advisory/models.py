"""
Advisory domain models for packages/core.

AdvisoryRecord: canonical AI advisory output, replacing legacy WhaleAdvisory.
SystemAISettings: runtime AI configuration (model, token budget, prompt template).

ISOLATION RULE: No imports from backend.portfolio or backend.* allowed.
"""
import uuid

from django.contrib.auth.models import User
from django.db import models


class SystemAISettings(models.Model):
    """
    Singleton-style runtime configuration for AI advisory generation.
    Only one active record should exist (enforced by is_active uniqueness).
    """

    class ModelChoices(models.TextChoices):
        GPT4O = 'gpt-4o', 'GPT-4o'
        GPT4O_MINI = 'gpt-4o-mini', 'GPT-4o-mini'
        GPT35 = 'gpt-3.5-turbo', 'GPT-3.5-turbo'
        GEMINI_PRO = 'gemini-pro', 'Gemini Pro'
        GEMINI_FLASH = 'gemini-1.5-flash', 'Gemini 1.5 Flash'
        CUSTOM = 'custom', 'Custom'

    name = models.CharField(max_length=64, unique=True, verbose_name='Tên cấu hình')
    is_active = models.BooleanField(default=False, db_index=True, verbose_name='Đang kích hoạt')
    ai_model = models.CharField(
        max_length=64,
        choices=ModelChoices.choices,
        default=ModelChoices.GPT4O_MINI,
        verbose_name='AI Model',
    )
    max_tokens = models.IntegerField(default=1000, verbose_name='Token budget tối đa')
    temperature = models.FloatField(default=0.3, verbose_name='Temperature')
    prompt_template = models.TextField(blank=True, default='', verbose_name='System prompt template')
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Cấu hình AI'
        verbose_name_plural = 'Cấu hình AI'

    def __str__(self) -> str:
        active_flag = ' [ACTIVE]' if self.is_active else ''
        return f'{self.name} ({self.ai_model}){active_flag}'


class AdvisoryRecord(models.Model):
    """
    Canonical AI advisory output record.

    Replaces legacy WhaleAdvisory. Stores the full advisory text, the context
    snapshot used for generation, and generation metadata.
    """

    class StatusChoices(models.TextChoices):
        PENDING = 'pending', 'Đang chờ'
        GENERATED = 'generated', 'Đã tạo'
        FAILED = 'failed', 'Thất bại'
        SUPERSEDED = 'superseded', 'Đã thay thế'

    advisory_id = models.UUIDField(default=uuid.uuid4, unique=True, db_index=True, editable=False)
    symbol = models.CharField(max_length=32, db_index=True, verbose_name='Mã cổ phiếu')
    session_date = models.DateField(db_index=True, verbose_name='Ngày phiên')
    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='advisory_records',
        verbose_name='Người dùng yêu cầu',
    )
    status = models.CharField(
        max_length=16,
        choices=StatusChoices.choices,
        default=StatusChoices.PENDING,
        db_index=True,
    )
    ai_model = models.CharField(max_length=64, blank=True, default='', verbose_name='AI model dùng')
    advisory_text = models.TextField(blank=True, default='', verbose_name='Nội dung advisory')
    context_snapshot = models.JSONField(default=dict, blank=True, verbose_name='Context snapshot khi generate')
    tokens_used = models.IntegerField(default=0, verbose_name='Tokens đã dùng')
    error_message = models.TextField(blank=True, default='', verbose_name='Thông báo lỗi')
    # Legacy migration tracking
    legacy_advisory_id = models.IntegerField(null=True, blank=True, db_index=True)
    generated_at = models.DateTimeField(null=True, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Advisory Record'
        verbose_name_plural = 'Advisory Records'
        ordering = ['-generated_at', '-created_at', '-pk']
        indexes = [
            models.Index(fields=['symbol', 'session_date', 'status']),
            models.Index(fields=['user', 'session_date']),
        ]

    def __str__(self) -> str:
        return f'Advisory {self.symbol} {self.session_date} [{self.status}]'


# ── SFI-B5: Conversational Advisory Models ────────────────────────────────

class AdvisorySession(models.Model):
    """
    SFI-B5: Phiên tư vấn AI theo ngữ cảnh (multi-turn advisory session).
    Each session tracks one advisory request-response lifecycle.
    """

    class StatusChoices(models.TextChoices):
        PENDING = 'pending', 'Đang xử lý'
        COMPLETED = 'completed', 'Hoàn thành'
        FAILED = 'failed', 'Thất bại'
        CANCELLED = 'cancelled', 'Đã hủy'

    public_id = models.UUIDField(default=uuid.uuid4, editable=False, unique=True, db_index=True)
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='advisory_sessions',
        verbose_name='Người dùng',
    )
    symbol = models.CharField(max_length=32, db_index=True, verbose_name='Mã cổ phiếu')
    session_date = models.DateField(db_index=True, verbose_name='Ngày phiên')
    status = models.CharField(max_length=12, choices=StatusChoices.choices, default=StatusChoices.PENDING, db_index=True)
    ai_model = models.CharField(max_length=64, default='gpt-4o-mini', verbose_name='AI Model')
    tokens_used = models.IntegerField(default=0, verbose_name='Tokens đã dùng')
    token_budget = models.IntegerField(default=2000, verbose_name='Token budget')
    context_snapshot = models.JSONField(default=dict, blank=True, verbose_name='Context snapshot')
    error_message = models.TextField(blank=True, default='', verbose_name='Lỗi (nếu có)')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Phiên Advisory'
        verbose_name_plural = 'Phiên Advisory'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'symbol', 'session_date']),
            models.Index(fields=['status', 'created_at']),
        ]

    def __str__(self) -> str:
        return f'AdvisorySession {self.symbol} {self.session_date} [{self.status}] user={self.user_id}'

    @property
    def budget_exceeded(self) -> bool:
        return self.tokens_used >= self.token_budget


class AdvisoryComponent(models.Model):
    """
    SFI-B5: Một thành phần (component) trong phiên Advisory — ví dụ: phân tích kỹ thuật,
    tóm tắt whale, tín hiệu khuyến nghị.
    """

    class ComponentType(models.TextChoices):
        TECHNICAL = 'technical', 'Phân tích kỹ thuật'
        WHALE = 'whale', 'Whale signal'
        RECOMMENDATION = 'recommendation', 'Khuyến nghị'
        SUMMARY = 'summary', 'Tóm tắt tổng hợp'
        RAW_CONTEXT = 'raw_context', 'Dữ liệu thô'

    session = models.ForeignKey(
        AdvisorySession,
        on_delete=models.CASCADE,
        related_name='components',
        verbose_name='Phiên Advisory',
    )
    component_type = models.CharField(max_length=20, choices=ComponentType.choices, verbose_name='Loại component')
    content = models.TextField(blank=True, default='', verbose_name='Nội dung')
    metadata = models.JSONField(default=dict, blank=True)
    order = models.SmallIntegerField(default=0, verbose_name='Thứ tự')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Advisory Component'
        verbose_name_plural = 'Advisory Components'
        ordering = ['order', 'created_at']

    def __str__(self) -> str:
        return f'{self.component_type} (session={self.session_id})'

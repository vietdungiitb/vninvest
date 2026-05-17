"""
Service Operations Center — Core Models

6 models cho service governance:
  ServiceDefinition — SSOT danh sách services được quản lý
  ServiceConfig — Config versioned theo thời gian
  ServiceHealth — Health snapshot realtime
  ServiceRunLog — Run log cho mỗi Celery task execution
  OwnershipRecord — Khai báo write ownership của domain
  ConfigChangeAudit — Immutable audit trail cho config changes
"""
from django.db import models
from django.utils import timezone


class ServiceDefinition(models.Model):
    """SSOT cho danh sách service được quản lý bởi SOC."""

    DOMAIN_CHOICES = [
        ('vnbroker', 'VNBroker Data'),
        ('prefetch', 'Prefetch & Cache'),
        ('signals', 'Signal Intelligence'),
        ('screener', 'Global Screener'),
        ('matrix', 'Symbol Matrix'),
        ('platform', 'Platform Internal'),
    ]

    # Định danh
    service_key = models.CharField(max_length=80, unique=True)
    name = models.CharField(max_length=120)
    domain = models.CharField(max_length=40, choices=DOMAIN_CHOICES)

    # Metadata
    description = models.TextField(blank=True)
    owner_team = models.CharField(max_length=80, default='core')
    tags = models.JSONField(default=list)

    # Lifecycle
    is_active = models.BooleanField(default=True)
    is_deprecated = models.BooleanField(default=False)
    deprecation_note = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['domain', 'service_key']
        indexes = [
            models.Index(fields=['domain', 'is_active']),
        ]
        verbose_name = 'Service Definition'
        verbose_name_plural = 'Service Definitions'

    def __str__(self):
        return f'{self.service_key} ({self.domain})'


class ServiceConfig(models.Model):
    """Lưu trữ config có version cho mỗi service."""

    service = models.ForeignKey(
        ServiceDefinition,
        on_delete=models.CASCADE,
        related_name='configs',
    )
    config_schema_version = models.CharField(max_length=20, default='1.0')

    # Config payload — đã qua typed validation trước khi lưu
    config_payload = models.JSONField()

    # Provenance
    applied_by = models.CharField(max_length=120, blank=True)
    applied_at = models.DateTimeField(auto_now_add=True)
    change_reason = models.TextField(blank=True)

    # State
    is_current = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ['-applied_at']
        indexes = [
            models.Index(fields=['service', 'is_current']),
        ]
        verbose_name = 'Service Config'
        verbose_name_plural = 'Service Configs'

    def save(self, *args, **kwargs):
        # Mark các configs cũ của cùng service là not-current
        if self.is_current and self.pk is None:
            ServiceConfig.objects.filter(
                service=self.service,
                is_current=True,
            ).update(is_current=False)
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.service.service_key} config @ {self.applied_at}'


class ServiceHealth(models.Model):
    """Health snapshot cho mỗi service."""

    STATUS_CHOICES = [
        ('healthy', 'Healthy'),
        ('degraded', 'Degraded'),
        ('unhealthy', 'Unhealthy'),
        ('unknown', 'Unknown'),
        ('maintenance', 'Maintenance'),
    ]

    service = models.OneToOneField(
        ServiceDefinition,
        on_delete=models.CASCADE,
        related_name='health',
    )

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='unknown')

    # Metrics
    last_check_at = models.DateTimeField(auto_now=True)
    last_success_at = models.DateTimeField(null=True, blank=True)
    consecutive_failures = models.IntegerField(default=0)
    avg_response_ms = models.FloatField(null=True, blank=True)

    # Detail
    detail = models.JSONField(default=dict)

    class Meta:
        indexes = [
            models.Index(fields=['status']),
        ]
        verbose_name = 'Service Health'
        verbose_name_plural = 'Service Health Records'

    def __str__(self):
        return f'{self.service.service_key}: {self.status}'


class ServiceRunLog(models.Model):
    """Log mỗi lần chạy task (Celery task execution)."""

    STATUS_CHOICES = [
        ('queued', 'Queued'),
        ('running', 'Running'),
        ('success', 'Success'),
        ('partial', 'Partial Success'),
        ('failed', 'Failed'),
        ('skipped', 'Skipped'),
    ]

    service = models.ForeignKey(
        ServiceDefinition,
        on_delete=models.CASCADE,
        related_name='run_logs',
    )

    celery_task_id = models.CharField(max_length=200, blank=True, db_index=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='queued')

    started_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    duration_seconds = models.FloatField(null=True, blank=True)

    # Context
    input_summary = models.JSONField(default=dict)
    output_summary = models.JSONField(default=dict)
    error_detail = models.TextField(blank=True)

    class Meta:
        ordering = ['-started_at']
        indexes = [
            models.Index(fields=['service', 'status']),
            models.Index(fields=['service', 'started_at']),
        ]
        verbose_name = 'Service Run Log'
        verbose_name_plural = 'Service Run Logs'

    def __str__(self):
        return f'{self.service.service_key} run {self.status} @ {self.started_at}'


class MarketDataParitySnapshot(models.Model):
    """Append-only persisted parity snapshot captured during market-data scheduler execution."""

    service = models.ForeignKey(
        ServiceDefinition,
        on_delete=models.CASCADE,
        related_name='parity_snapshots',
    )
    run_log = models.ForeignKey(
        ServiceRunLog,
        on_delete=models.SET_NULL,
        related_name='parity_snapshots',
        null=True,
        blank=True,
    )

    scheduler_task_id = models.CharField(max_length=200, db_index=True)
    window_hours = models.IntegerField()
    sample_size = models.IntegerField(default=100)
    evaluated_symbols = models.IntegerField(default=0)
    strict_fresh_count = models.IntegerField(default=0)
    fresh_or_warm_count = models.IntegerField(default=0)
    strict_fresh_parity = models.FloatField(default=0.0)
    fresh_or_warm_parity = models.FloatField(default=0.0)
    strict_met = models.BooleanField(default=False)
    relaxed_met = models.BooleanField(default=False)
    captured_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        ordering = ['-captured_at', '-id']
        indexes = [
            models.Index(fields=['service', 'window_hours', 'captured_at']),
            models.Index(fields=['scheduler_task_id', 'window_hours']),
        ]
        unique_together = [('scheduler_task_id', 'window_hours')]
        verbose_name = 'Market Data Parity Snapshot'
        verbose_name_plural = 'Market Data Parity Snapshots'

    def __str__(self):
        return (
            f'{self.service.service_key} parity {self.window_hours}h '
            f'({self.strict_fresh_parity:.4f}/{self.fresh_or_warm_parity:.4f})'
        )


class OwnershipRecord(models.Model):
    """Khai báo tường minh write ownership của domain."""

    WRITE_MODE_CHOICES = [
        ('canonical', 'Canonical Writer'),
        ('native-write', 'Native Write'),
        ('bridge-write', 'Bridge Write'),
        ('read-only', 'Read Only'),
        ('deprecated', 'Deprecated'),
    ]

    domain = models.CharField(max_length=40, unique=True)
    owner_team = models.CharField(max_length=80)

    write_mode = models.CharField(max_length=40, choices=WRITE_MODE_CHOICES)
    write_surface = models.CharField(max_length=200, blank=True)

    locked_fields = models.JSONField(default=list)
    compatibility_domains = models.JSONField(default=list)

    # Notes
    deprecation_notes = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Modes có quyền ghi
    WRITABLE_MODES = frozenset({
        'canonical', 'native-write', 'bridge-write',
        'write-through', 'write-enabled', 'direct-writer',
    })

    class Meta:
        ordering = ['domain']
        verbose_name = 'Ownership Record'
        verbose_name_plural = 'Ownership Records'

    def is_writable(self) -> bool:
        """Trả True nếu domain này có quyền ghi từ SOC."""
        return self.write_mode in self.WRITABLE_MODES

    def get_write_block_reason(self) -> 'str | None':
        """Trả None nếu có thể ghi; trả message tiếng Việt nếu bị chặn."""
        if self.is_writable():
            return None
        return (
            f"Domain '{self.domain}' là {self.write_mode}. "
            f"Người ghi: {self.owner_team}. "
            f"Bề mặt ghi: {self.write_surface or 'không xác định'}."
        )

    def __str__(self):
        return f'{self.domain} ({self.write_mode})'


class ConfigChangeAudit(models.Model):
    """Immutable audit trail cho mọi config change."""

    ACTION_CHOICES = [
        ('apply', 'Config Applied'),
        ('preview', 'Preview Generated'),
        ('rollback', 'Config Rolled Back'),
        ('force_apply', 'Force Applied'),
    ]

    service = models.ForeignKey(
        ServiceDefinition,
        on_delete=models.CASCADE,
        related_name='change_audits',
    )

    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    actor = models.CharField(max_length=120)
    actor_ip = models.GenericIPAddressField(null=True, blank=True)

    before_snapshot = models.JSONField(null=True, blank=True)
    after_snapshot = models.JSONField(null=True, blank=True)

    change_summary = models.TextField(blank=True)

    timestamp = models.DateTimeField(auto_now_add=True)
    request_id = models.CharField(max_length=64, blank=True)

    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['service', 'timestamp']),
            models.Index(fields=['actor', 'timestamp']),
        ]
        verbose_name = 'Config Change Audit'
        verbose_name_plural = 'Config Change Audits'

    def __str__(self):
        return f'{self.service.service_key} {self.action} by {self.actor} @ {self.timestamp}'


class ScrapeMatrix(models.Model):
    """Một cycle scraping cho toàn bộ universe matrix."""

    STATUS_CHOICES = [
        ('active', 'Active'),
        ('completing', 'Completing'),
        ('completed', 'Completed'),
        ('aborted', 'Aborted'),
    ]

    cycle_id = models.CharField(max_length=64, unique=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    providers = models.JSONField(default=list)

    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    total_rows = models.IntegerField(default=0)
    done_rows = models.IntegerField(default=0)
    failed_rows = models.IntegerField(default=0)

    class Meta:
        ordering = ['-started_at']
        indexes = [
            models.Index(fields=['status', 'started_at']),
        ]
        verbose_name = 'Scrape Matrix'
        verbose_name_plural = 'Scrape Matrices'

    @property
    def progress_pct(self) -> float:
        if self.total_rows <= 0:
            return 0.0
        return (self.done_rows / self.total_rows) * 100.0

    def __str__(self):
        return f'{self.cycle_id} ({self.status})'


class ScrapeMatrixCell(models.Model):
    """Một ô trong matrix: SymbolGroup x Provider."""

    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('claimed', 'Claimed'),
        ('working', 'Working'),
        ('done', 'Done'),
        ('failed', 'Failed'),
        ('skipped', 'Skipped'),
    ]

    matrix = models.ForeignKey(
        ScrapeMatrix,
        on_delete=models.CASCADE,
        related_name='cells',
    )
    symbol_group_id = models.CharField(max_length=80)
    provider = models.CharField(max_length=40)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    worker_id = models.CharField(max_length=200, blank=True)
    claimed_at = models.DateTimeField(null=True, blank=True)
    done_at = models.DateTimeField(null=True, blank=True)

    symbols_processed = models.IntegerField(default=0)
    error_detail = models.TextField(blank=True)

    class Meta:
        unique_together = [('matrix', 'symbol_group_id', 'provider')]
        indexes = [
            models.Index(fields=['matrix', 'status']),
            models.Index(fields=['matrix', 'symbol_group_id']),
        ]
        verbose_name = 'Scrape Matrix Cell'
        verbose_name_plural = 'Scrape Matrix Cells'

    def __str__(self):
        return f'{self.matrix.cycle_id} {self.symbol_group_id} x {self.provider} ({self.status})'


class CustomSymbolGroup(models.Model):
    """Nhóm mã tuỳ chỉnh do operator tạo ra — dùng cho Matrix Snapshot và Backfill."""

    name = models.CharField(max_length=100, verbose_name='Tên nhóm')
    slug = models.SlugField(
        max_length=60,
        unique=True,
        verbose_name='Slug (group_id)',
        help_text='Dùng làm group_id khi chạy cycle. Tự động tạo từ tên, có thể chỉnh.',
    )
    description = models.TextField(blank=True, verbose_name='Mô tả')
    symbols = models.JSONField(
        default=list,
        verbose_name='Danh sách mã',
        help_text='Danh sách mã theo dạng ["VCB", "BID", "CTG"]',
    )
    is_active = models.BooleanField(default=True, verbose_name='Đang hoạt động')
    created_by = models.CharField(max_length=120, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        verbose_name = 'Nhóm mã tuỳ chỉnh'
        verbose_name_plural = 'Nhóm mã tuỳ chỉnh'

    def __str__(self):
        return f'{self.name} ({len(self.symbols or [])} mã)'

    def clean_symbols(self) -> list[str]:
        """Trả về danh sách mã đã chuẩn hoá (uppercase, dedup, loại trống)."""
        seen: set[str] = set()
        result: list[str] = []
        for raw in (self.symbols or []):
            sym = str(raw or '').strip().upper()
            if sym and sym not in seen:
                seen.add(sym)
                result.append(sym)
        return result

    @property
    def group_id(self) -> str:
        """group_id nhận dạng bởi vnbroker_adapter: 'custom_<slug>'."""
        return f'custom_{self.slug}'

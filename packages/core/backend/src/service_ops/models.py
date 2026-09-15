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
        ('dataops', 'DataOps Scheduler'),
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

    # SLO / SLI
    slo_target = models.FloatField(default=0.999, help_text='Target uptime ratio (e.g. 0.999 = 99.9%)')
    uptime_30d = models.FloatField(null=True, blank=True, help_text='Actual uptime % over last 30 days')
    burn_rate_1h = models.FloatField(null=True, blank=True, help_text='Error budget burn rate over last 1 hour')
    error_budget_remaining = models.FloatField(null=True, blank=True, help_text='Remaining error budget ratio (0-1)')

    # Detail
    detail = models.JSONField(default=dict)

    class Meta:
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['uptime_30d']),
        ]
        verbose_name = 'Service Health'
        verbose_name_plural = 'Service Health Records'

    def __str__(self):
        return f'{self.service.service_key}: {self.status}'


class ServiceHealthCheckLog(models.Model):
    """Timestamped log of each health probe — enables rolling-window uptime computation."""

    STATUS_CHOICES = [
        ('healthy', 'Healthy'),
        ('degraded', 'Degraded'),
        ('unhealthy', 'Unhealthy'),
        ('unknown', 'Unknown'),
        ('maintenance', 'Maintenance'),
    ]

    service = models.ForeignKey(
        ServiceDefinition,
        on_delete=models.CASCADE,
        related_name='health_check_logs',
        db_index=True,
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='unknown')
    response_ms = models.FloatField(null=True, blank=True)
    checked_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-checked_at']
        indexes = [
            models.Index(fields=['service', 'checked_at']),
            models.Index(fields=['service', 'status']),
        ]
        verbose_name = 'Service Health Check Log'
        verbose_name_plural = 'Service Health Check Logs'

    def __str__(self):
        return f'{self.service.service_key}: {self.status} @ {self.checked_at}'


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
        ('toggle', 'Service Toggled'),
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


# ---------------------------------------------------------------------------
# Cached Symbol Groups — SSOT từ vnbroker provider
# ---------------------------------------------------------------------------


class CachedSymbolGroup(models.Model):
    """Nhóm thị trường cache từ vnbroker provider — single source of truth cho group list.

    Thay thế PREDEFINED_SYMBOL_GROUPS hardcoded trong matrix_coordinator.py.
    Sync qua POST /api/soc/symbol-groups/sync/ → symbol_group_sync.sync_groups().
    """

    group_name = models.CharField(
        max_length=50,
        unique=True,
        verbose_name='Tên nhóm',
        help_text='VD: VN30, HOSE, VNMidCap',
    )
    group_code = models.CharField(
        max_length=20,
        blank=True,
        default='',
        verbose_name='Mã nhóm (provider code)',
        help_text='Mã nội bộ provider. VD: KBS dùng "30" cho VN30',
    )
    category = models.CharField(
        max_length=50,
        blank=True,
        default='',
        verbose_name='Phân loại',
        help_text='VD: Chỉ số VN, Sàn giao dịch, ETF/Quỹ',
    )
    description = models.TextField(blank=True, default='', verbose_name='Mô tả')
    source_provider = models.CharField(
        max_length=20,
        verbose_name='Provider nguồn',
        help_text='Provider lấy dữ liệu: KBS, VCI, TCBS',
    )
    symbol_count = models.PositiveIntegerField(
        null=True,
        blank=True,
        verbose_name='Số lượng mã',
        help_text='Số mã trong nhóm (null nếu chưa resolve)',
    )
    group_type = models.CharField(
        max_length=20,
        blank=True,
        default='',
        verbose_name='Loại nhóm',
        help_text='SECTOR, INDEX, EXCHANGE, ETF, CW, BOND, DERIVATIVE',
    )
    color = models.CharField(
        max_length=20,
        blank=True,
        default='',
        verbose_name='Màu hiển thị',
        help_text='Hex color code cho UI, VD: #3b82f6',
    )
    display_order = models.PositiveIntegerField(
        default=999,
        verbose_name='Thứ tự hiển thị',
        help_text='Thứ tự sắp xếp trong sidebar',
    )
    is_active = models.BooleanField(default=True, verbose_name='Đang hoạt động')
    synced_at = models.DateTimeField(auto_now=True, verbose_name='Lần sync gần nhất')

    class Meta:
        ordering = ['display_order', 'group_name']
        verbose_name = 'Nhóm thị trường (cached)'
        verbose_name_plural = 'Nhóm thị trường (cached)'

    def __str__(self):
        return f'{self.group_name} ({self.symbol_count or "?"} mã, {self.source_provider})'


class CachedSymbolGroupMember(models.Model):
    """Thành viên mã của một CachedSymbolGroup (system/market group).

    Tách biệt hoàn toàn với WatchlistItem của user. Mỗi CachedSymbolGroup có
    danh sách mã riêng, không phụ thuộc vào user/tenant — đây là SSOT cho
    "Thị trường & Chỉ số".
    """

    group = models.ForeignKey(
        CachedSymbolGroup,
        on_delete=models.CASCADE,
        related_name='members',
        verbose_name='Nhóm thị trường',
    )
    symbol = models.CharField(max_length=32, db_index=True, verbose_name='Mã cổ phiếu')
    display_order = models.PositiveIntegerField(default=0, verbose_name='Thứ tự hiển thị')

    class Meta:
        ordering = ['display_order', 'symbol']
        unique_together = [('group', 'symbol')]
        verbose_name = 'Mã trong nhóm thị trường (cached)'
        verbose_name_plural = 'Mã trong nhóm thị trường (cached)'

    def __str__(self):
        return f'{self.group.group_name} / {self.symbol}'


# ---------------------------------------------------------------------------
# B02 — Backfill Progress Persistence
# ---------------------------------------------------------------------------


class BackfillExecutionRun(models.Model):
    """Source-of-truth cho mỗi lần chạy backfill (manual hoặc scheduled).

    Operator và UI đọc progress từ model này — không suy diễn từ log text hay cache-only marker.
    Crash an toàn: task exception handler phải update status → 'failed' để lại evidence.
    """

    MODE_CHOICES = [
        ('daily_delta', 'Daily Delta'),
        ('repair_missing', 'Repair Missing'),
        ('deep_bootstrap', 'Deep Bootstrap'),
        ('targeted_symbol_repair', 'Targeted Symbol Repair'),
    ]

    TRIGGER_CHOICES = [
        ('beat_schedule', 'Beat Schedule'),
        ('operator_run_now', 'Operator Run Now'),
        ('auto_promotion_fast_path', 'Auto Promotion Fast Path'),
        ('repair_guard', 'Repair Guard'),
    ]

    STATUS_CHOICES = [
        ('queued', 'Queued'),
        ('running', 'Running'),
        ('partial', 'Partial Success'),
        ('success', 'Success'),
        ('failed', 'Failed'),
        ('aborted', 'Aborted'),
    ]

    # Định danh
    run_id = models.CharField(max_length=120, unique=True, db_index=True)
    job_key = models.CharField(max_length=120, blank=True, db_index=True)

    # Liên kết tới ServiceRunLog (B01 model) — nullable vì có thể chạy standalone
    service_run_log = models.OneToOneField(
        ServiceRunLog,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='backfill_execution_run',
    )

    # Phân loại
    mode = models.CharField(max_length=40, choices=MODE_CHOICES, default='daily_delta')
    trigger = models.CharField(max_length=40, choices=TRIGGER_CHOICES, default='beat_schedule')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='queued', db_index=True)

    # Input spec
    requested_days = models.IntegerField(default=0)
    planned_symbols_count = models.IntegerField(default=0)

    # Counters (cập nhật incremental)
    completed_symbols_count = models.IntegerField(default=0)
    failed_symbols_count = models.IntegerField(default=0)
    inserted_rows = models.IntegerField(default=0)
    updated_rows = models.IntegerField(default=0)
    skipped_existing_rows = models.IntegerField(default=0)

    # Timing
    started_at = models.DateTimeField(default=timezone.now, db_index=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    eta_seconds = models.FloatField(null=True, blank=True)

    # Tóm tắt kết quả
    summary = models.JSONField(default=dict)
    error_summary = models.TextField(blank=True)

    class Meta:
        ordering = ['-started_at']
        indexes = [
            models.Index(fields=['job_key', 'status']),
            models.Index(fields=['job_key', 'started_at']),
            models.Index(fields=['status', 'started_at']),
        ]
        verbose_name = 'Backfill Execution Run'
        verbose_name_plural = 'Backfill Execution Runs'

    def __str__(self) -> str:
        return f'{self.run_id} ({self.status})'

    @property
    def progress_pct(self) -> float:
        if self.planned_symbols_count <= 0:
            return 0.0
        done = self.completed_symbols_count + self.failed_symbols_count
        return round(min(done / self.planned_symbols_count * 100.0, 100.0), 2)

    @property
    def duration_seconds(self) -> float | None:
        if self.finished_at is None:
            return None
        delta = self.finished_at - self.started_at
        return round(delta.total_seconds(), 2)


class BackfillExecutionBatch(models.Model):
    """Progress per-provider batch trong một BackfillExecutionRun.

    Mỗi provider nhận một batch row. Cập nhật khi batch complete/fail.
    """

    STATE_CHOICES = [
        ('pending', 'Pending'),
        ('running', 'Running'),
        ('done', 'Done'),
        ('failed', 'Failed'),
        ('skipped', 'Skipped'),
    ]

    run = models.ForeignKey(
        BackfillExecutionRun,
        on_delete=models.CASCADE,
        related_name='batches',
    )

    # Metadata
    provider = models.CharField(max_length=40, db_index=True)
    batch_index = models.IntegerField(default=0)

    # State
    state = models.CharField(max_length=20, choices=STATE_CHOICES, default='pending', db_index=True)
    current_symbol = models.CharField(max_length=20, blank=True)

    # Input
    symbols_count = models.IntegerField(default=0)

    # Counters
    completed_symbols_count = models.IntegerField(default=0)
    inserted_rows = models.IntegerField(default=0)
    updated_rows = models.IntegerField(default=0)
    skipped_existing_rows = models.IntegerField(default=0)
    failed_symbols = models.JSONField(default=list)

    # Latency telemetry (ms)
    latency_p50_ms = models.FloatField(default=0.0)
    latency_p95_ms = models.FloatField(default=0.0)

    # Timing
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = [('run', 'provider')]
        indexes = [
            models.Index(fields=['run', 'state']),
        ]
        ordering = ['batch_index']
        verbose_name = 'Backfill Execution Batch'
        verbose_name_plural = 'Backfill Execution Batches'

    def __str__(self) -> str:
        return f'{self.run.run_id} / {self.provider} ({self.state})'

    @property
    def failed_symbols_count(self) -> int:
        return len(self.failed_symbols or [])

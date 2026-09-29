# SOC Full Replacement — Technical Specification
**Ngày**: 2026-05-13  
**Phiên bản**: 1.0  
**Status**: Approved  
**Owner**: Backend Lead  
**Parent**: `docs/SOC_FULL_REPLACEMENT_HANDOFF_MASTER_20260513.md`

---

## 1. Phạm vi kỹ thuật

Tài liệu này định nghĩa **chi tiết kỹ thuật** đủ để assigner implement mà không cần hỏi thêm:

- Database schema (models, indexes, constraints)
- Domain config typed schemas (4 dataclasses + validation)
- Ownership Matrix architecture
- Symbol Universe Matrix (ScrapeMatrix + Coordinator)
- REST API contract cho mỗi endpoint (url, method, request schema, response schema, error codes)
- Frontend component interfaces
- Celery task spec
- i18n key mapping

---

## 2. Database Models

### 2.1 ServiceDefinition

```python
class ServiceDefinition(models.Model):
    """SSOT cho danh sách service được quản lý."""
    
    # Định danh
    service_key = models.CharField(max_length=80, unique=True)
    # Ví dụ: 'vnbroker_quote', 'prefetch_daily', 'signal_whale_detector'
    
    name = models.CharField(max_length=120)
    # Tên display: "VNBroker Quote Fetcher"
    
    domain = models.CharField(max_length=40, choices=[
        ('vnbroker', 'VNBroker Data'),
        ('prefetch', 'Prefetch & Cache'),
        ('signals', 'Signal Intelligence'),
        ('screener', 'Global Screener'),
        ('matrix', 'Symbol Matrix'),
        ('platform', 'Platform Internal'),
    ])
    
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
```

### 2.2 ServiceConfig

```python
class ServiceConfig(models.Model):
    """Lưu trữ config hiện hành cho service (versioned)."""
    
    service = models.ForeignKey(ServiceDefinition, on_delete=models.CASCADE, related_name='configs')
    config_schema_version = models.CharField(max_length=20, default='1.0')
    
    # Config payload — typed validation trước khi lưu
    config_payload = models.JSONField()
    
    # Provenance
    applied_by = models.CharField(max_length=120, blank=True)  # user/system
    applied_at = models.DateTimeField(auto_now_add=True)
    change_reason = models.TextField(blank=True)
    
    # State
    is_current = models.BooleanField(default=True, db_index=True)
    
    class Meta:
        ordering = ['-applied_at']
        indexes = [
            models.Index(fields=['service', 'is_current']),
        ]
    
    def save(self, *args, **kwargs):
        # Mark previous configs as not current
        if self.is_current:
            ServiceConfig.objects.filter(
                service=self.service, is_current=True
            ).exclude(pk=self.pk).update(is_current=False)
        super().save(*args, **kwargs)
```

### 2.3 ServiceHealth

```python
class ServiceHealth(models.Model):
    """Health snapshot theo thời gian thực."""
    
    service = models.ForeignKey(ServiceDefinition, on_delete=models.CASCADE, related_name='health_records')
    
    STATUS_CHOICES = [
        ('healthy', 'Healthy'),
        ('degraded', 'Degraded'),
        ('unhealthy', 'Unhealthy'),
        ('unknown', 'Unknown'),
        ('maintenance', 'Maintenance'),
    ]
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='unknown')
    
    # Metrics
    last_check_at = models.DateTimeField(auto_now=True)
    last_success_at = models.DateTimeField(null=True, blank=True)
    consecutive_failures = models.IntegerField(default=0)
    avg_response_ms = models.FloatField(null=True, blank=True)
    
    # Detail
    detail = models.JSONField(default=dict)
    # Ví dụ: {"error": "Connection timeout", "endpoint": "https://..."}
    
    class Meta:
        get_latest_by = 'last_check_at'
        indexes = [
            models.Index(fields=['service', 'status']),
        ]
```

### 2.4 ServiceRunLog

```python
class ServiceRunLog(models.Model):
    """Log mỗi lần chạy task (Celery task execution record)."""
    
    service = models.ForeignKey(ServiceDefinition, on_delete=models.CASCADE, related_name='run_logs')
    
    STATUS_CHOICES = [
        ('queued', 'Queued'),
        ('running', 'Running'),
        ('success', 'Success'),
        ('partial', 'Partial Success'),
        ('failed', 'Failed'),
        ('skipped', 'Skipped'),
    ]
    
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
```

### 2.5 OwnershipRecord

```python
class OwnershipRecord(models.Model):
    """Khai báo tường minh write ownership của domain."""
    
    domain = models.CharField(max_length=40, unique=True)
    owner_team = models.CharField(max_length=80)
    
    WRITE_MODE_CHOICES = [
        ('canonical', 'Canonical Writer'),
        ('native-write', 'Native Write'),
        ('bridge-write', 'Bridge Write'),
        ('read-only', 'Read Only'),
        ('deprecated', 'Deprecated'),
    ]
    
    write_mode = models.CharField(max_length=40, choices=WRITE_MODE_CHOICES)
    write_surface = models.CharField(max_length=200, blank=True)
    # Ví dụ: "packages/core/backend/src/signal_intelligence/"
    
    locked_fields = models.JSONField(default=list)
    compatibility_domains = models.JSONField(default=list)
    
    # Notes
    deprecation_notes = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def is_writable(self) -> bool:
        WRITABLE_MODES = {'canonical', 'native-write', 'bridge-write', 'write-through', 'write-enabled', 'direct-writer'}
        return self.write_mode in WRITABLE_MODES
    
    def get_write_block_reason(self) -> str | None:
        if not self.is_writable():
            return f"Domain '{self.domain}' là read-only. Writer: {self.owner_team} ({self.write_surface})"
        return None
```

### 2.6 ConfigChangeAudit

```python
class ConfigChangeAudit(models.Model):
    """Immutable audit trail cho mọi config change."""
    
    service = models.ForeignKey(ServiceDefinition, on_delete=models.CASCADE, related_name='audits')
    
    ACTION_CHOICES = [
        ('apply', 'Config Applied'),
        ('preview', 'Preview Generated'),
        ('rollback', 'Config Rolled Back'),
        ('force_apply', 'Force Applied (override)'),
    ]
    
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    actor = models.CharField(max_length=120)
    actor_ip = models.GenericIPAddressField(null=True, blank=True)
    
    before_snapshot = models.JSONField(null=True, blank=True)
    after_snapshot = models.JSONField(null=True, blank=True)
    
    change_summary = models.TextField(blank=True)
    # Computed diff text
    
    timestamp = models.DateTimeField(auto_now_add=True)
    request_id = models.CharField(max_length=64, blank=True)
    
    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['service', 'timestamp']),
            models.Index(fields=['actor', 'timestamp']),
        ]
```

---

## 3. Domain Config Typed Schemas

### 3.1 VnbrokerDomainConfig

```python
@dataclass
class VnbrokerTimeoutConfig:
    connect: float = 10.0
    read: float = 30.0
    write: float = 10.0
    pool: float = 5.0
    
    def validate(self) -> list[str]:
        errors = []
        if not (1.0 <= self.connect <= 60.0):
            errors.append("connect phải trong khoảng [1.0, 60.0]")
        if not (5.0 <= self.read <= 300.0):
            errors.append("read phải trong khoảng [5.0, 300.0]")
        return errors

@dataclass
class VnbrokerDomainConfig:
    timeout: VnbrokerTimeoutConfig = field(default_factory=VnbrokerTimeoutConfig)
    max_retries: int = 3
    retry_delay_seconds: float = 2.0
    circuit_breaker_threshold: int = 5
    circuit_breaker_window_seconds: int = 60
    preferred_provider: str = 'vci'
    fallback_providers: list[str] = field(default_factory=lambda: ['kbs'])
    
    def validate(self) -> list[str]:
        errors = self.timeout.validate()
        if not (0 <= self.max_retries <= 10):
            errors.append("max_retries phải trong khoảng [0, 10]")
        VALID_PROVIDERS = {'vci', 'kbs', 'tcbs', 'ssi', 'fireant'}
        if self.preferred_provider not in VALID_PROVIDERS:
            errors.append(f"preferred_provider không hợp lệ: {self.preferred_provider}")
        return errors
    
    @classmethod
    def from_dict(cls, data: dict) -> 'VnbrokerDomainConfig':
        timeout_data = data.pop('timeout', {})
        timeout = VnbrokerTimeoutConfig(**timeout_data)
        return cls(timeout=timeout, **data)
```

### 3.2 PrefetchTimePolicyConfig

```python
@dataclass
class TimePolicyProfile:
    name: str
    active: bool
    interval_seconds: int
    symbols_limit: int | None
    description: str
    
    def validate(self) -> list[str]:
        errors = []
        if not (30 <= self.interval_seconds <= 3600):
            errors.append(f"Profile '{self.name}': interval_seconds phải trong [30, 3600]")
        return errors

@dataclass
class PrefetchTimePolicyConfig:
    """6 profiles tương ứng 6 giai đoạn ngày giao dịch."""
    pre_open: TimePolicyProfile
    market_open: TimePolicyProfile
    lunch_break: TimePolicyProfile
    pre_close: TimePolicyProfile
    post_close: TimePolicyProfile
    offhours: TimePolicyProfile
    
    VALID_PROFILE_NAMES = {
        'pre_open', 'market_open', 'lunch_break', 'pre_close', 'post_close', 'offhours'
    }
    
    def validate(self) -> list[str]:
        errors = []
        for profile_name in self.VALID_PROFILE_NAMES:
            profile = getattr(self, profile_name)
            errors.extend(profile.validate())
        return errors
    
    def get_active_profile(self) -> TimePolicyProfile | None:
        from datetime import datetime, timezone
        # Logic xác định profile theo giờ thực tế
        ...
```

### 3.3 SignalServicesDomainConfig

```python
@dataclass
class SignalDetectionConfig:
    enabled: bool
    min_value_threshold: float
    lookback_periods: int
    
    def validate(self) -> list[str]:
        errors = []
        if self.min_value_threshold < 0:
            errors.append("min_value_threshold không được âm")
        if not (1 <= self.lookback_periods <= 500):
            errors.append("lookback_periods phải trong [1, 500]")
        return errors

@dataclass
class SignalServicesDomainConfig:
    whale_detection: SignalDetectionConfig
    dark_pool_detection: SignalDetectionConfig
    screener_signal: SignalDetectionConfig
    
    # Retention policy
    hot_tier_days: int = 7
    warm_tier_days: int = 30
    cold_tier_days: int = 365
    
    # Universe
    universe_group_ids: list[str] = field(default_factory=list)
    
    def validate(self) -> list[str]:
        errors = []
        errors.extend(self.whale_detection.validate())
        errors.extend(self.dark_pool_detection.validate())
        if not (1 <= self.hot_tier_days <= 30):
            errors.append("hot_tier_days phải trong [1, 30]")
        return errors
```

### 3.4 ScreenerDomainConfig

```python
@dataclass
class ScreenerRuleConfig:
    rule_id: str
    name: str
    enabled: bool
    conditions: list[dict]
    alert_threshold: float
    cooldown_minutes: int
    
    def validate(self) -> list[str]:
        errors = []
        if not self.rule_id:
            errors.append("rule_id không được rỗng")
        if self.cooldown_minutes < 0:
            errors.append("cooldown_minutes không được âm")
        return errors

@dataclass
class ScreenerDomainConfig:
    rules: list[ScreenerRuleConfig] = field(default_factory=list)
    max_rules_active: int = 20
    global_cooldown_minutes: int = 5
    
    def validate(self) -> list[str]:
        errors = []
        if len(self.rules) > 50:
            errors.append("Tối đa 50 rules")
        for rule in self.rules:
            errors.extend(rule.validate())
        return errors
```

---

## 4. Symbol Universe Matrix

### 4.1 Models

```python
class ScrapeMatrix(models.Model):
    """Một cycle scraping cho toàn bộ universe."""
    
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('completing', 'Completing'),
        ('completed', 'Completed'),
        ('aborted', 'Aborted'),
    ]
    
    cycle_id = models.CharField(max_length=64, unique=True)
    # Format: "cycle_{trade_date}_{sequence}" ví dụ: "cycle_20260513_001"
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    providers = models.JSONField(default=list)
    # Danh sách provider được phép trong cycle này
    
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    total_rows = models.IntegerField(default=0)
    done_rows = models.IntegerField(default=0)
    failed_rows = models.IntegerField(default=0)
    
    class Meta:
        ordering = ['-started_at']
    
    @property
    def progress_pct(self) -> float:
        if self.total_rows == 0:
            return 0.0
        return (self.done_rows / self.total_rows) * 100.0


class ScrapeMatrixCell(models.Model):
    """Một ô trong matrix: (SymbolGroup × Provider)."""
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('claimed', 'Claimed'),
        ('working', 'Working'),
        ('done', 'Done'),
        ('failed', 'Failed'),
        ('skipped', 'Skipped'),  # Row đã done bởi cell khác
    ]
    
    matrix = models.ForeignKey(ScrapeMatrix, on_delete=models.CASCADE, related_name='cells')
    symbol_group_id = models.CharField(max_length=80)
    provider = models.CharField(max_length=40)
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    worker_id = models.CharField(max_length=200, blank=True)
    # Celery task ID của worker đang xử lý
    
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
```

### 4.2 MatrixCoordinator

```python
class MatrixCoordinator:
    """Quản lý lifecycle của một ScrapeMatrix cycle."""
    
    def __init__(self, cycle_id: str, providers: list[str]):
        self.cycle_id = cycle_id
        self.providers = providers
    
    def create_cycle(self, symbol_group_ids: list[str]) -> ScrapeMatrix:
        """Tạo matrix mới với N×M cells."""
        with transaction.atomic():
            matrix = ScrapeMatrix.objects.create(
                cycle_id=self.cycle_id,
                providers=self.providers,
                total_rows=len(symbol_group_ids),
            )
            cells = [
                ScrapeMatrixCell(
                    matrix=matrix,
                    symbol_group_id=group_id,
                    provider=provider,
                )
                for group_id in symbol_group_ids
                for provider in self.providers
            ]
            ScrapeMatrixCell.objects.bulk_create(cells)
        return matrix
    
    def try_claim_cell(self, symbol_group_id: str, provider: str, worker_id: str) -> bool:
        """Atomic claim một cell. Returns True nếu claim thành công."""
        with transaction.atomic():
            cell = ScrapeMatrixCell.objects.select_for_update().get(
                matrix__cycle_id=self.cycle_id,
                symbol_group_id=symbol_group_id,
                provider=provider,
                status='pending',
            )
            # Kiểm tra row đã done chưa
            row_done = ScrapeMatrixCell.objects.filter(
                matrix__cycle_id=self.cycle_id,
                symbol_group_id=symbol_group_id,
                status='done',
            ).exists()
            if row_done:
                cell.status = 'skipped'
                cell.save()
                return False
            
            cell.status = 'claimed'
            cell.worker_id = worker_id
            cell.claimed_at = now()
            cell.save()
            return True
    
    def mark_cell_done(self, symbol_group_id: str, provider: str, symbols_processed: int) -> None:
        """Mark cell done và skip các cells còn lại cùng row."""
        with transaction.atomic():
            ScrapeMatrixCell.objects.filter(
                matrix__cycle_id=self.cycle_id,
                symbol_group_id=symbol_group_id,
                provider=provider,
            ).update(status='done', done_at=now(), symbols_processed=symbols_processed)
            
            # Skip các cells pending cùng row
            ScrapeMatrixCell.objects.filter(
                matrix__cycle_id=self.cycle_id,
                symbol_group_id=symbol_group_id,
                status='pending',
            ).update(status='skipped')
            
            # Update matrix progress
            done_count = ScrapeMatrixCell.objects.filter(
                matrix__cycle_id=self.cycle_id,
                symbol_group_id=symbol_group_id,
                status='done',
            ).count()
            # 1 row = 1 done cell → increment done_rows
            ScrapeMatrix.objects.filter(cycle_id=self.cycle_id).update(
                done_rows=models.F('done_rows') + 1
            )
    
    def mark_cell_failed(self, symbol_group_id: str, provider: str, error: str) -> None:
        with transaction.atomic():
            ScrapeMatrixCell.objects.filter(
                matrix__cycle_id=self.cycle_id,
                symbol_group_id=symbol_group_id,
                provider=provider,
            ).update(status='failed', error_detail=error, done_at=now())
    
    def get_cycle_summary(self) -> dict:
        matrix = ScrapeMatrix.objects.get(cycle_id=self.cycle_id)
        return {
            'cycle_id': self.cycle_id,
            'status': matrix.status,
            'progress_pct': matrix.progress_pct,
            'total_rows': matrix.total_rows,
            'done_rows': matrix.done_rows,
            'failed_rows': matrix.failed_rows,
        }
```

---

## 5. REST API Contract

### 5.1 Overview Endpoints

```
GET  /api/soc/overview/                 → Tổng quan health tất cả services
GET  /api/soc/services/                 → Danh sách services (có pagination)
GET  /api/soc/services/{service_key}/   → Chi tiết một service
POST /api/soc/services/{service_key}/health-check/   → Trigger health check
GET  /api/soc/run-logs/                 → Recent run logs (paginaed)
GET  /api/soc/change-audit/             → Config change audit trail
```

#### GET /api/soc/overview/ — Response Schema

```json
{
  "generated_at": "2026-05-13T08:00:00Z",
  "summary": {
    "total": 23,
    "healthy": 18,
    "degraded": 3,
    "unhealthy": 1,
    "unknown": 1
  },
  "by_domain": {
    "vnbroker": { "total": 5, "healthy": 5, "unhealthy": 0 },
    "prefetch": { "total": 4, "healthy": 3, "degraded": 1 },
    "signals": { "total": 8, "healthy": 7, "unhealthy": 1 },
    "screener": { "total": 4, "healthy": 3, "unknown": 1 },
    "matrix": { "total": 2, "healthy": 1, "degraded": 1 }
  },
  "services": [
    {
      "service_key": "vnbroker_quote",
      "name": "VNBroker Quote Fetcher",
      "domain": "vnbroker",
      "status": "healthy",
      "last_check_at": "2026-05-13T07:59:00Z",
      "avg_response_ms": 142.5
    }
  ]
}
```

### 5.2 VNBroker Domain Endpoints

```
GET  /api/soc/vnbroker/config/          → Đọc config hiện hành (VnbrokerDomainConfig)
POST /api/soc/vnbroker/config/apply/    → Apply config mới (validate → save → audit)
GET  /api/soc/vnbroker/config/preview/  → Preview diff với current config
GET  /api/soc/vnbroker/health/          → Health check cho vnbroker connection
POST /api/soc/vnbroker/test-connection/ → Test connection tới providers
GET  /api/soc/vnbroker/providers/       → Danh sách providers và trạng thái
GET  /api/soc/vnbroker/ownership/       → Ownership matrix cho vnbroker domain
```

#### POST /api/soc/vnbroker/config/apply/ — Request Schema

```json
{
  "timeout": {
    "connect": 10.0,
    "read": 30.0,
    "write": 10.0,
    "pool": 5.0
  },
  "max_retries": 3,
  "retry_delay_seconds": 2.0,
  "preferred_provider": "vci",
  "fallback_providers": ["kbs"]
}
```

#### POST /api/soc/vnbroker/config/apply/ — Response 200

```json
{
  "success": true,
  "applied_at": "2026-05-13T08:00:00Z",
  "change_summary": "timeout.read: 30.0 → 45.0; preferred_provider: vci (unchanged)",
  "ownership": {
    "domain": "vnbroker",
    "mode": "native-write",
    "writer": "core-api",
    "can_apply": true
  },
  "validation_warnings": []
}
```

#### POST /api/soc/vnbroker/config/apply/ — Error 400

```json
{
  "detail": "Config validation failed",
  "code": "config_validation_failed",
  "timestamp": "2026-05-13T08:00:00Z",
  "request_id": "req_abc123",
  "field_errors": {
    "timeout.read": ["read phải trong khoảng [5.0, 300.0]"],
    "preferred_provider": ["Giá trị không hợp lệ: 'unknown_provider'"]
  }
}
```

### 5.3 Prefetch Domain Endpoints

```
GET  /api/soc/prefetch/config/           → Đọc PrefetchTimePolicyConfig (6 profiles)
POST /api/soc/prefetch/config/apply/     → Apply time policy
GET  /api/soc/prefetch/config/preview/   → Preview diff
GET  /api/soc/prefetch/status/           → Trạng thái warm tier hiện tại
POST /api/soc/prefetch/warm-now/         → Trigger warm ngay lập tức
GET  /api/soc/prefetch/schedule/         → Lịch prefetch theo 6 profiles
GET  /api/soc/prefetch/ownership/        → Ownership matrix
```

#### GET /api/soc/prefetch/config/ — Response 200

```json
{
  "config": {
    "pre_open":    { "active": true, "interval_seconds": 120, "symbols_limit": 500, "description": "Trước phiên ATO" },
    "market_open": { "active": true, "interval_seconds": 30,  "symbols_limit": null, "description": "Phiên khớp lệnh liên tục" },
    "lunch_break": { "active": true, "interval_seconds": 300, "symbols_limit": 200, "description": "Giờ nghỉ trưa" },
    "pre_close":   { "active": true, "interval_seconds": 30,  "symbols_limit": null, "description": "Trước phiên ATC" },
    "post_close":  { "active": true, "interval_seconds": 600, "symbols_limit": 100, "description": "Sau đóng cửa" },
    "offhours":    { "active": false, "interval_seconds": 3600,"symbols_limit": 50,  "description": "Ngoài giờ" }
  },
  "active_profile": "market_open",
  "ownership": {
    "domain": "prefetch",
    "mode": "native-write",
    "can_apply": true
  }
}
```

### 5.4 Signals Domain Endpoints

```
GET  /api/soc/signals/config/            → Đọc SignalServicesDomainConfig
POST /api/soc/signals/config/apply/      → Apply (ownership check → bridge-write)
GET  /api/soc/signals/config/preview/    → Preview diff + impact analysis
GET  /api/soc/signals/summary/           → Runtime metrics (active alerts, detection rate)
GET  /api/soc/signals/retention-policy/  → Đọc retention policy
POST /api/soc/signals/retention-policy/preview/ → Preview retention impact
GET  /api/soc/signals/materialization/   → Materialization status
POST /api/soc/signals/materialization/preview/  → Preview materialization
GET  /api/soc/signals/universe/          → Đọc universe config
POST /api/soc/signals/universe/update/   → Cập nhật universe
GET  /api/soc/signals/ownership/         → Ownership matrix (full với locked_fields)
POST /api/soc/signals/jobs/run/          → Trigger signal detection job
GET  /api/soc/signals/jobs/status/       → Job status
```

#### GET /api/soc/signals/ownership/ — Response 200

```json
{
  "domain": "signals",
  "mode": "bridge-write",
  "writer": "signal_intelligence",
  "write_surface": "packages/core/backend/src/signal_intelligence/",
  "locked_fields": ["universe_policy", "canonical_thresholds"],
  "can_apply": false,
  "write_block_reason": "Signal config thuộc write surface của signal_intelligence. Thay đổi qua signal_intelligence service.",
  "compatibility_domains": ["whale_alerts", "dark_pool", "screener_signal"],
  "deprecation_notes": ""
}
```

### 5.5 Screener Domain Endpoints

```
GET  /api/soc/screener/config/           → Đọc ScreenerDomainConfig (rules list)
POST /api/soc/screener/config/apply/     → Apply config (validate rules)
GET  /api/soc/screener/config/preview/   → Preview diff
GET  /api/soc/screener/rules/            → Danh sách rules (paginated)
POST /api/soc/screener/rules/run/        → Trigger manual run
GET  /api/soc/screener/rules/last-run/   → Kết quả run cuối
GET  /api/soc/screener/ownership/        → Ownership matrix
```

### 5.6 Matrix Domain Endpoints

```
GET  /api/soc/matrix/cycles/             → Danh sách cycles (paginated)
GET  /api/soc/matrix/cycles/{cycle_id}/  → Chi tiết một cycle (với cells summary)
POST /api/soc/matrix/cycles/start/       → Bắt đầu scrape cycle mới
GET  /api/soc/matrix/cycles/{cycle_id}/cells/ → Cells theo cycle (paginated)
POST /api/soc/matrix/cycles/{cycle_id}/abort/ → Abort cycle đang chạy
GET  /api/soc/matrix/providers/          → Danh sách providers trong matrix
GET  /api/soc/matrix/monitor/            → Realtime monitor data (poll)
```

---

## 6. Celery Tasks

### 6.1 health_check_all_services

```python
@shared_task(bind=True, name='service_ops.health_check_all_services')
def health_check_all_services(self):
    """Chạy health check cho tất cả active services."""
    services = ServiceDefinition.objects.filter(is_active=True)
    for service in services:
        try:
            result = _check_single_service(service)
            ServiceHealth.objects.update_or_create(
                service=service,
                defaults={
                    'status': result['status'],
                    'detail': result['detail'],
                    'avg_response_ms': result.get('response_ms'),
                }
            )
        except Exception as exc:
            logger.error("Health check failed for %s: %s", service.service_key, exc, exc_info=True)
```

### 6.2 run_scrape_cycle

```python
@shared_task(bind=True, name='service_ops.run_scrape_cycle')
def run_scrape_cycle(self, cycle_id: str, symbol_group_ids: list[str], providers: list[str]):
    """Dispatch matrix cells tới worker pool."""
    coordinator = MatrixCoordinator(cycle_id=cycle_id, providers=providers)
    for group_id in symbol_group_ids:
        for provider in providers:
            scrape_cell_task.delay(
                cycle_id=cycle_id,
                symbol_group_id=group_id,
                provider=provider,
                worker_id=self.request.id,
            )
```

### 6.3 scrape_cell_task

```python
@shared_task(bind=True, name='service_ops.scrape_cell_task', max_retries=2)
def scrape_cell_task(self, cycle_id: str, symbol_group_id: str, provider: str, worker_id: str):
    """Thực hiện scraping một cell (SymbolGroup × Provider)."""
    coordinator = MatrixCoordinator(cycle_id=cycle_id, providers=[provider])
    
    claimed = coordinator.try_claim_cell(symbol_group_id, provider, worker_id)
    if not claimed:
        return {'status': 'skipped', 'reason': 'Row already done or claimed'}
    
    try:
        symbols = _get_symbols_for_group(symbol_group_id)
        data = _fetch_symbols_from_provider(symbols, provider)
        coordinator.mark_cell_done(symbol_group_id, provider, len(symbols))
        return {'status': 'done', 'symbols_processed': len(symbols)}
    except Exception as exc:
        coordinator.mark_cell_failed(symbol_group_id, provider, str(exc))
        raise self.retry(exc=exc, countdown=30)
```

---

## 7. Frontend Component Interface

### 7.1 ServiceHealthCard

```jsx
// Props
ServiceHealthCard.propTypes = {
  serviceKey: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  domain: PropTypes.string.isRequired,
  status: PropTypes.oneOf(['healthy', 'degraded', 'unhealthy', 'unknown', 'maintenance']).isRequired,
  lastCheckAt: PropTypes.string,
  avgResponseMs: PropTypes.number,
  onHealthCheckClick: PropTypes.func,
}

// Màu sắc theo trạng thái (Tailwind dark theme)
const STATUS_COLORS = {
  healthy: 'text-emerald-400 border-emerald-700 bg-emerald-950/30',
  degraded: 'text-amber-400 border-amber-700 bg-amber-950/30',
  unhealthy: 'text-rose-400 border-rose-700 bg-rose-950/30',
  unknown: 'text-slate-400 border-slate-700 bg-slate-800',
  maintenance: 'text-sky-400 border-sky-700 bg-sky-950/30',
}
```

### 7.2 OwnershipBadgeRow

```jsx
// Props
OwnershipBadgeRow.propTypes = {
  domain: PropTypes.string.isRequired,
  mode: PropTypes.string.isRequired,
  writer: PropTypes.string.isRequired,
  canApply: PropTypes.bool.isRequired,
  lockedFields: PropTypes.arrayOf(PropTypes.string),
  writeBlockReason: PropTypes.string,
}

// Màu theo mode
const MODE_COLORS = {
  'canonical':    'bg-emerald-900 text-emerald-300',
  'native-write': 'bg-sky-900 text-sky-300',
  'bridge-write': 'bg-amber-900 text-amber-300',
  'read-only':    'bg-slate-800 text-slate-400',
  'deprecated':   'bg-rose-900/50 text-rose-400',
}
```

### 7.3 WriteGuardBanner

```jsx
// Hiển thị khi canApply === false
WriteGuardBanner.propTypes = {
  reason: PropTypes.string.isRequired,
  writer: PropTypes.string.isRequired,
  writeSurface: PropTypes.string.isRequired,
}
// Render: banner amber với icon khóa + nội dung Vietnamese qua i18n
```

### 7.4 ConfigPreviewModal

```jsx
ConfigPreviewModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  
  before: PropTypes.object,
  after: PropTypes.object.isRequired,
  changeSummary: PropTypes.arrayOf(PropTypes.string),
  impactWarnings: PropTypes.arrayOf(PropTypes.string),
  validationErrors: PropTypes.object,
  
  domain: PropTypes.string.isRequired,
  isSubmitting: PropTypes.bool,
}
```

### 7.5 MatrixScrapeMonitor

```jsx
MatrixScrapeMonitor.propTypes = {
  cycleId: PropTypes.string,
  pollIntervalMs: PropTypes.number, // default 5000
  onCycleComplete: PropTypes.func,
}

// Internal: fetch GET /api/soc/matrix/monitor/ mỗi pollIntervalMs ms
// Render: heatmap dạng grid (row = SymbolGroup, col = Provider)
// Màu cell: pending=slate, claimed=sky, working=amber, done=emerald, failed=rose, skipped=slate-600
```

### 7.6 SOCDomainTabs

```jsx
// Tabs: Tổng quan | Tín hiệu | DataOps | Prefetch | Screener | Matrix
const SOC_TABS = [
  { key: 'overview',  label: 'soc.tab.overview',  component: SOCOverviewPanel },
  { key: 'signals',   label: 'soc.tab.signals',   component: SOCSignalsPanel },
  { key: 'dataops',   label: 'soc.tab.dataops',   component: SOCDataOpsPanel },
  { key: 'prefetch',  label: 'soc.tab.prefetch',  component: SOCPrefetchPanel },
  { key: 'screener',  label: 'soc.tab.screener',  component: SOCScreenerPanel },
  { key: 'matrix',    label: 'soc.tab.matrix',    component: SOCMatrixPanel },
]
```

---

## 8. i18n Key Mapping

### File: `frontend/src/i18n/vi.json` — namespace `soc.*`

```json
{
  "soc": {
    "title": "Trung tâm Vận hành Dịch vụ",
    "tab": {
      "overview": "Tổng quan",
      "signals": "Tín hiệu",
      "dataops": "DataOps",
      "prefetch": "Bộ nhớ đệm",
      "screener": "Bộ lọc",
      "matrix": "Ma trận Thu thập"
    },
    "service": {
      "status": {
        "healthy": "Hoạt động tốt",
        "degraded": "Suy giảm",
        "unhealthy": "Lỗi",
        "unknown": "Không rõ",
        "maintenance": "Bảo trì"
      }
    },
    "ownership": {
      "mode": {
        "canonical": "Người ghi chính",
        "native-write": "Ghi tự nhiên",
        "bridge-write": "Ghi qua cầu",
        "read-only": "Chỉ đọc",
        "deprecated": "Đã hạ tầng"
      },
      "writeBlocked": "Không thể áp dụng — domain này được kiểm soát bởi {{writer}}",
      "writeBlockedHint": "Vui lòng thay đổi cấu hình qua: {{writeSurface}}"
    },
    "config": {
      "apply": "Áp dụng cấu hình",
      "preview": "Xem trước thay đổi",
      "applySuccess": "Cấu hình đã được áp dụng thành công",
      "applyFailed": "Áp dụng cấu hình thất bại: {{error}}",
      "confirmTitle": "Xác nhận thay đổi cấu hình",
      "confirmMessage": "Bạn có chắc muốn áp dụng {{count}} thay đổi cho domain {{domain}}?"
    },
    "matrix": {
      "cycle": "Chu kỳ thu thập",
      "progress": "Tiến độ: {{done}}/{{total}} nhóm",
      "startCycle": "Bắt đầu chu kỳ mới",
      "abortCycle": "Dừng chu kỳ",
      "cell": {
        "pending": "Chờ",
        "claimed": "Đã nhận",
        "working": "Đang xử lý",
        "done": "Hoàn thành",
        "failed": "Lỗi",
        "skipped": "Bỏ qua"
      }
    },
    "health": {
      "checkNow": "Kiểm tra ngay",
      "lastCheck": "Kiểm tra lần cuối",
      "avgResponse": "Thời gian phản hồi TB",
      "consecutiveFails": "{{count}} lần lỗi liên tiếp"
    },
    "signals": {
      "universePolicy": "Chính sách nhận diện",
      "retentionPolicy": "Chính sách lưu giữ",
      "materialPreview": "Xem trước vật liệu hoá",
      "jobTrigger": "Khởi chạy phát hiện",
      "jobStatus": "Trạng thái công việc"
    }
  }
}
```

---

## 9. URL Routing

```python
# packages/core/backend/src/vninvest_core/contracts/service_ops/urls.py

urlpatterns = [
    # Overview
    path('overview/', views.SOCOverviewView.as_view(), name='soc-overview'),
    path('services/', views.ServiceListView.as_view(), name='service-list'),
    path('services/<str:service_key>/', views.ServiceDetailView.as_view(), name='service-detail'),
    path('services/<str:service_key>/health-check/', views.TriggerHealthCheckView.as_view(), name='service-health-check'),
    path('run-logs/', views.RunLogListView.as_view(), name='run-log-list'),
    path('change-audit/', views.ConfigChangeAuditListView.as_view(), name='change-audit-list'),
    
    # VNBroker domain
    path('vnbroker/config/', views.VnbrokerConfigView.as_view(), name='vnbroker-config'),
    path('vnbroker/config/apply/', views.VnbrokerConfigApplyView.as_view(), name='vnbroker-config-apply'),
    path('vnbroker/config/preview/', views.VnbrokerConfigPreviewView.as_view(), name='vnbroker-config-preview'),
    path('vnbroker/health/', views.VnbrokerHealthView.as_view(), name='vnbroker-health'),
    path('vnbroker/test-connection/', views.VnbrokerTestConnectionView.as_view(), name='vnbroker-test-connection'),
    path('vnbroker/providers/', views.VnbrokerProvidersView.as_view(), name='vnbroker-providers'),
    path('vnbroker/ownership/', views.VnbrokerOwnershipView.as_view(), name='vnbroker-ownership'),
    
    # Prefetch domain
    path('prefetch/config/', views.PrefetchConfigView.as_view(), name='prefetch-config'),
    path('prefetch/config/apply/', views.PrefetchConfigApplyView.as_view(), name='prefetch-config-apply'),
    path('prefetch/config/preview/', views.PrefetchConfigPreviewView.as_view(), name='prefetch-config-preview'),
    path('prefetch/status/', views.PrefetchStatusView.as_view(), name='prefetch-status'),
    path('prefetch/warm-now/', views.PrefetchWarmNowView.as_view(), name='prefetch-warm-now'),
    path('prefetch/schedule/', views.PrefetchScheduleView.as_view(), name='prefetch-schedule'),
    path('prefetch/ownership/', views.PrefetchOwnershipView.as_view(), name='prefetch-ownership'),
    
    # Signals domain
    path('signals/config/', views.SignalsConfigView.as_view(), name='signals-config'),
    path('signals/config/apply/', views.SignalsConfigApplyView.as_view(), name='signals-config-apply'),
    path('signals/config/preview/', views.SignalsConfigPreviewView.as_view(), name='signals-config-preview'),
    path('signals/summary/', views.SignalsSummaryView.as_view(), name='signals-summary'),
    path('signals/retention-policy/', views.SignalsRetentionPolicyView.as_view(), name='signals-retention-policy'),
    path('signals/retention-policy/preview/', views.SignalsRetentionPreviewView.as_view(), name='signals-retention-preview'),
    path('signals/materialization/', views.SignalsMaterializationView.as_view(), name='signals-materialization'),
    path('signals/materialization/preview/', views.SignalsMaterializationPreviewView.as_view(), name='signals-materialization-preview'),
    path('signals/universe/', views.SignalsUniverseView.as_view(), name='signals-universe'),
    path('signals/universe/update/', views.SignalsUniverseUpdateView.as_view(), name='signals-universe-update'),
    path('signals/ownership/', views.SignalsOwnershipView.as_view(), name='signals-ownership'),
    path('signals/jobs/run/', views.SignalsJobRunView.as_view(), name='signals-job-run'),
    path('signals/jobs/status/', views.SignalsJobStatusView.as_view(), name='signals-job-status'),
    
    # Screener domain
    path('screener/config/', views.ScreenerConfigView.as_view(), name='screener-config'),
    path('screener/config/apply/', views.ScreenerConfigApplyView.as_view(), name='screener-config-apply'),
    path('screener/config/preview/', views.ScreenerConfigPreviewView.as_view(), name='screener-config-preview'),
    path('screener/rules/', views.ScreenerRuleListView.as_view(), name='screener-rule-list'),
    path('screener/rules/run/', views.ScreenerRulesRunView.as_view(), name='screener-rules-run'),
    path('screener/rules/last-run/', views.ScreenerRulesLastRunView.as_view(), name='screener-rules-last-run'),
    path('screener/ownership/', views.ScreenerOwnershipView.as_view(), name='screener-ownership'),
    
    # Matrix domain
    path('matrix/cycles/', views.MatrixCycleListView.as_view(), name='matrix-cycle-list'),
    path('matrix/cycles/<str:cycle_id>/', views.MatrixCycleDetailView.as_view(), name='matrix-cycle-detail'),
    path('matrix/cycles/start/', views.MatrixCycleStartView.as_view(), name='matrix-cycle-start'),
    path('matrix/cycles/<str:cycle_id>/cells/', views.MatrixCellListView.as_view(), name='matrix-cell-list'),
    path('matrix/cycles/<str:cycle_id>/abort/', views.MatrixCycleAbortView.as_view(), name='matrix-cycle-abort'),
    path('matrix/providers/', views.MatrixProvidersView.as_view(), name='matrix-providers'),
    path('matrix/monitor/', views.MatrixMonitorView.as_view(), name='matrix-monitor'),
]
```

**Tổng**: 40 endpoints trong namespace `/api/soc/`

---

## 10. Frontend Route

```
/operations-center                        → SOCPage (SOCDomainTabs + all panels)
/operations-center?tab=signals            → SOCSignalsPanel
/operations-center?tab=matrix             → SOCMatrixPanel
/admin-ops                                → Redirect 301 → /operations-center
```

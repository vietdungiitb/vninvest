"""Quản trị vận hành — `service_ops`.

Vì sao thêm mới
---------------
App này có **15 model** mà trước đây **không có `admin.py` nào** (đếm bằng
script, xem `docs/PLAN_DJANGO_ADMIN_UIUX_20261010.md` §2.1). Trong đó có
`ConfigChangeAudit` (ai đổi cấu hình, lúc nào, từ IP nào), `ServiceHealth`
(dịch vụ có sống không), `BackfillExecutionRun` (backfill chạy đến đâu).

Đây đúng là các bảng mà một sản phẩm thương mại **không thể** không cho
nhân viên vận hành xem — và trước đây phải vào shell truy vấn tay.

Nguyên tắc
----------
- Bảng **ghi tự động** (log, snapshot, matrix cell) dùng `VNReadOnlyMixin`:
  sửa tay là sai dữ liệu vận hành.
- Bảng **cấu hình** (`ServiceDefinition`, `ServiceConfig`, `CustomSymbolGroup`)
  cho sửa, nhưng `readonly_fields` chặn trường hệ thống tự sinh.
"""

from django.contrib import admin

from vninvest_core.admin_ui import (
    VNAdminMixin,
    VNReadOnlyMixin,
    badge_for,
    decimal_vi,
    percent_vi,
)

from .models import (
    BackfillExecutionBatch,
    BackfillExecutionRun,
    CachedSymbolGroup,
    CachedSymbolGroupMember,
    ConfigChangeAudit,
    CustomSymbolGroup,
    MarketDataParitySnapshot,
    OwnershipRecord,
    ScrapeMatrix,
    ScrapeMatrixCell,
    ServiceConfig,
    ServiceDefinition,
    ServiceHealth,
    ServiceHealthCheckLog,
    ServiceRunLog,
)


# ---------------------------------------------------------------------------
# Bảng cấu hình — cho sửa
# ---------------------------------------------------------------------------

class CachedSymbolGroupMemberInline(admin.TabularInline):
    model = CachedSymbolGroupMember
    extra = 0
    fields = ('symbol', 'display_order')
    ordering = ('display_order', 'symbol')


@admin.register(ServiceDefinition)
class ServiceDefinitionAdmin(VNAdminMixin, admin.ModelAdmin):
    list_display = ('service_key', 'name', 'domain', 'owner_team', 'is_active', 'is_deprecated')
    list_filter = ('domain', 'is_active', 'is_deprecated')
    search_fields = ('service_key', 'name', 'description', 'owner_team')
    readonly_fields = ('created_at', 'updated_at')
    ordering = ('domain', 'service_key')
    date_hierarchy = 'created_at'

    @admin.display(description='Đang dùng', boolean=True)
    def is_active(self, obj):
        return obj.is_active


@admin.register(ServiceConfig)
class ServiceConfigAdmin(VNAdminMixin, admin.ModelAdmin):
    list_display = ('service', 'config_schema_version', 'is_current', 'applied_by', 'applied_at')
    list_filter = ('is_current',)
    search_fields = ('service__service_key', 'service__name', 'applied_by', 'change_reason')
    readonly_fields = ('applied_at',)
    list_select_related = ('service',)
    ordering = ('-applied_at',)
    date_hierarchy = 'applied_at'
    autocomplete_fields = ('service',)


@admin.register(CustomSymbolGroup)
class CustomSymbolGroupAdmin(VNAdminMixin, admin.ModelAdmin):
    list_display = ('name', 'slug', 'symbol_count', 'is_active', 'created_by', 'updated_at')
    list_filter = ('is_active',)
    search_fields = ('name', 'slug', 'description', 'created_by')
    readonly_fields = ('created_at', 'updated_at')
    ordering = ('-updated_at',)
    date_hierarchy = 'created_at'

    @admin.display(description='Số mã')
    def symbol_count(self, obj):
        symbols = obj.symbols
        return decimal_vi(len(symbols)) if isinstance(symbols, (list, dict)) else decimal_vi(0)


@admin.register(CachedSymbolGroup)
class CachedSymbolGroupAdmin(VNAdminMixin, admin.ModelAdmin):
    list_display = ('group_name', 'group_code', 'category', 'symbol_count', 'is_active', 'synced_at')
    list_filter = ('category', 'group_type', 'is_active')
    search_fields = ('group_name', 'group_code', 'description')
    readonly_fields = ('synced_at',)
    ordering = ('-synced_at',)
    date_hierarchy = 'synced_at'
    inlines = [CachedSymbolGroupMemberInline]


@admin.register(OwnershipRecord)
class OwnershipRecordAdmin(VNAdminMixin, admin.ModelAdmin):
    list_display = ('domain', 'owner_team', 'write_mode', 'write_surface', 'updated_at')
    list_filter = ('domain', 'write_mode')
    search_fields = ('domain', 'owner_team', 'write_surface', 'deprecation_notes')
    readonly_fields = ('updated_at',)
    ordering = ('domain',)
    date_hierarchy = 'updated_at'


# ---------------------------------------------------------------------------
# Bảng sức khoẻ & đối soát — chỉ đọc
# ---------------------------------------------------------------------------

@admin.register(ServiceHealth)
class ServiceHealthAdmin(VNAdminMixin, VNReadOnlyMixin, admin.ModelAdmin):
    list_display = ('service', 'status_badge', 'last_check_at', 'consecutive_failures',
                    'avg_response_ms', 'uptime_30d_pct')
    list_filter = ('status',)
    search_fields = ('service__service_key', 'service__name')
    list_select_related = ('service',)
    date_hierarchy = 'last_check_at'
    ordering = ('-last_check_at',)

    @admin.display(description='Trạng thái', ordering='status')
    def status_badge(self, obj):
        return badge_for(obj.status)

    @admin.display(description='Số giờ sống 30 ngày')
    def uptime_30d_pct(self, obj):
        return percent_vi(obj.uptime_30d)


@admin.register(ServiceHealthCheckLog)
class ServiceHealthCheckLogAdmin(VNAdminMixin, VNReadOnlyMixin, admin.ModelAdmin):
    list_display = ('service', 'status_badge', 'response_ms', 'checked_at')
    list_filter = ('status',)
    search_fields = ('service__service_key', 'service__name')
    list_select_related = ('service',)
    date_hierarchy = 'checked_at'
    ordering = ('-checked_at',)

    @admin.display(description='Trạng thái', ordering='status')
    def status_badge(self, obj):
        return badge_for(obj.status)


@admin.register(ServiceRunLog)
class ServiceRunLogAdmin(VNAdminMixin, VNReadOnlyMixin, admin.ModelAdmin):
    list_display = ('service', 'status_badge', 'started_at', 'finished_at', 'duration_seconds')
    list_filter = ('status',)
    search_fields = ('service__service_key', 'celery_task_id', 'error_detail')
    list_select_related = ('service',)
    date_hierarchy = 'started_at'
    ordering = ('-started_at',)

    @admin.display(description='Trạng thái', ordering='status')
    def status_badge(self, obj):
        return badge_for(obj.status)


@admin.register(ConfigChangeAudit)
class ConfigChangeAuditAdmin(VNAdminMixin, VNReadOnlyMixin, admin.ModelAdmin):
    list_display = ('timestamp', 'service', 'action_badge', 'actor', 'actor_ip')
    list_filter = ('action',)
    search_fields = ('service__service_key', 'actor', 'actor_ip', 'change_summary', 'request_id')
    list_select_related = ('service',)
    date_hierarchy = 'timestamp'
    ordering = ('-timestamp',)

    @admin.display(description='Hành động', ordering='action')
    def action_badge(self, obj):
        return badge_for(obj.action)


@admin.register(MarketDataParitySnapshot)
class MarketDataParitySnapshotAdmin(VNAdminMixin, VNReadOnlyMixin, admin.ModelAdmin):
    list_display = ('captured_at', 'service', 'window_hours', 'strict_fresh_parity_pct',
                    'strict_met_badge', 'sample_size')
    list_filter = ('strict_met', 'relaxed_met')
    search_fields = ('service__service_key', 'scheduler_task_id')
    list_select_related = ('service',)
    date_hierarchy = 'captured_at'
    ordering = ('-captured_at',)

    @admin.display(description='Tỉ lệ đúng (nghiêm)')
    def strict_fresh_parity_pct(self, obj):
        return percent_vi(obj.strict_fresh_parity)

    @admin.display(description='Đạt (nghiêm)', boolean=True)
    def strict_met_badge(self, obj):
        return obj.strict_met


# ---------------------------------------------------------------------------
# Ma trận thu thập — chỉ đọc (hệ thống ghi)
# ---------------------------------------------------------------------------

class ScrapeMatrixCellInline(admin.TabularInline):
    model = ScrapeMatrixCell
    extra = 0
    fields = ('symbol_group_id', 'provider', 'status_badge', 'worker_id',
              'symbols_processed', 'done_at')
    readonly_fields = ('status_badge', 'done_at')
    show_change_link = True

    @admin.display(description='Trạng thái')
    def status_badge(self, obj):
        return badge_for(obj.status)


@admin.register(ScrapeMatrix)
class ScrapeMatrixAdmin(VNAdminMixin, VNReadOnlyMixin, admin.ModelAdmin):
    list_display = ('cycle_id', 'status_badge', 'started_at', 'completed_at',
                    'total_rows', 'done_rows', 'failed_rows')
    list_filter = ('status',)
    search_fields = ('cycle_id',)
    date_hierarchy = 'started_at'
    ordering = ('-started_at',)
    inlines = [ScrapeMatrixCellInline]

    @admin.display(description='Trạng thái', ordering='status')
    def status_badge(self, obj):
        return badge_for(obj.status)


@admin.register(ScrapeMatrixCell)
class ScrapeMatrixCellAdmin(VNAdminMixin, VNReadOnlyMixin, admin.ModelAdmin):
    list_display = ('matrix', 'provider', 'status_badge', 'symbols_processed',
                    'claimed_at', 'done_at')
    list_filter = ('status', 'provider')
    search_fields = ('matrix__cycle_id', 'provider', 'worker_id')
    list_select_related = ('matrix',)
    date_hierarchy = 'claimed_at'
    ordering = ('-claimed_at',)

    @admin.display(description='Trạng thái', ordering='status')
    def status_badge(self, obj):
        return badge_for(obj.status)


# ---------------------------------------------------------------------------
# Backfill — chỉ đọc
# ---------------------------------------------------------------------------

class BackfillExecutionBatchInline(admin.TabularInline):
    model = BackfillExecutionBatch
    extra = 0
    fields = ('provider', 'batch_index', 'state_badge', 'symbols_count',
              'completed_symbols_count', 'latency_p95_ms')
    readonly_fields = ('state_badge',)
    can_delete = False
    show_change_link = True

    @admin.display(description='Trạng thái')
    def state_badge(self, obj):
        return badge_for(obj.state)


@admin.register(BackfillExecutionRun)
class BackfillExecutionRunAdmin(VNAdminMixin, VNReadOnlyMixin, admin.ModelAdmin):
    list_display = ('run_id', 'job_key', 'status_badge', 'mode', 'started_at',
                    'completed_symbols_count', 'planned_symbols_count')
    list_filter = ('status', 'mode', 'trigger')
    search_fields = ('run_id', 'job_key', 'error_summary')
    date_hierarchy = 'started_at'
    ordering = ('-started_at',)
    inlines = [BackfillExecutionBatchInline]

    @admin.display(description='Trạng thái', ordering='status')
    def status_badge(self, obj):
        return badge_for(obj.status)


@admin.register(BackfillExecutionBatch)
class BackfillExecutionBatchAdmin(VNAdminMixin, VNReadOnlyMixin, admin.ModelAdmin):
    list_display = ('run', 'provider', 'state_badge', 'symbols_count',
                    'completed_symbols_count', 'latency_p95_ms')
    list_filter = ('state', 'provider')
    search_fields = ('run__run_id', 'run__job_key', 'current_symbol')
    list_select_related = ('run',)
    date_hierarchy = 'started_at'
    ordering = ('-started_at',)

    @admin.display(description='Trạng thái', ordering='state')
    def state_badge(self, obj):
        return badge_for(obj.state)

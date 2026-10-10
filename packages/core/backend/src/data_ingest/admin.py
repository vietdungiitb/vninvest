"""Quản trị thu thập dữ liệu — `data_ingest`.

Vì sao thêm mới
---------------
`data_ingest` có **2 model** mà trước đây không có `admin.py`. Đây là bảng định
nghĩa lệnh thu thập và lịch sử chạy — nơi người vận hành kiểm tra "hôm nay đã
chạy chưa, chạy bao nhiêu dòng, lỗi ở đâu".

Ranh giới quyền
---------------
- `IngestJob` (định nghĩa lệnh) ⇒ cho sửa.
- `IngestRun` (một lần chạy) ⇒ **chỉ đọc**; sửa tay sẽ phá số liệu vận hành.
"""

from django.contrib import admin

from vninvest_core.admin_ui import (
    VNAdminMixin,
    VNReadOnlyMixin,
    badge_for,
    decimal_vi,
    datetime_vi,
)

from .models import IngestJob, IngestRun


@admin.register(IngestJob)
class IngestJobAdmin(VNAdminMixin, admin.ModelAdmin):
    list_display = ('name', 'source', 'status_badge', 'schedule_seconds', 'updated_at')
    list_filter = ('source', 'status')
    search_fields = ('name', 'source')
    readonly_fields = ('created_at', 'updated_at')
    ordering = ('name',)
    date_hierarchy = 'created_at'

    @admin.display(description='Trạng thái', ordering='status')
    def status_badge(self, obj):
        return badge_for(obj.status)

    @admin.display(description='Chu kỳ (giây)')
    def schedule_seconds(self, obj):
        return decimal_vi(obj.schedule_seconds, decimals=0)


class IngestRunInline(admin.TabularInline):
    model = IngestRun
    extra = 0
    fields = ('started_at', 'state_badge', 'rows_upserted', 'rows_skipped',
              'finished_at', 'error_message')
    readonly_fields = ('state_badge',)
    ordering = ('-started_at',)
    can_delete = False
    show_change_link = True

    @admin.display(description='Trạng thái')
    def state_badge(self, obj):
        return badge_for(obj.state)


@admin.register(IngestRun)
class IngestRunAdmin(VNReadOnlyMixin, admin.ModelAdmin):
    list_display = ('job', 'state_badge', 'started_at', 'finished_at',
                    'rows_upserted', 'rows_skipped')
    list_filter = ('state',)
    search_fields = ('job__name', 'error_message')
    list_select_related = ('job',)
    date_hierarchy = 'started_at'
    ordering = ('-started_at',)

    @admin.display(description='Trạng thái', ordering='state')
    def state_badge(self, obj):
        return badge_for(obj.state)

    @admin.display(description='Bắt đầu', ordering='started_at')
    def started_display(self, obj):
        return datetime_vi(obj.started_at)

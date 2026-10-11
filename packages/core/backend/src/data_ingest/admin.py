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
    datetime_vi,
    empty_dash,
)

from .models import IngestJob, IngestRun

# Nhãn hiển thị tiếng Việt đồng bộ ở tầng quản trị (không can thiệp database schema)
IngestJob._meta.verbose_name = 'Lệnh thu thập dữ liệu'
IngestJob._meta.verbose_name_plural = 'Lệnh thu thập dữ liệu'
IngestJob._meta.get_field('source').verbose_name = 'Nguồn dữ liệu'
IngestJob._meta.get_field('status').verbose_name = 'Trạng thái'

IngestRun._meta.verbose_name = 'Lần chạy thu thập'
IngestRun._meta.verbose_name_plural = 'Lần chạy thu thập'
IngestRun._meta.get_field('state').verbose_name = 'Trạng thái'


@admin.register(IngestJob)
class IngestJobAdmin(VNAdminMixin, admin.ModelAdmin):
    list_display = ('name_display', 'source_display', 'status_badge', 'schedule_seconds_display', 'updated_at_display')
    list_filter = ('source', 'status')
    search_fields = ('name', 'source')
    readonly_fields = ('created_at', 'updated_at')
    ordering = ('name',)
    date_hierarchy = 'created_at'

    @admin.display(description='Tên lệnh thu thập', ordering='name')
    def name_display(self, obj):
        return obj.name

    @admin.display(description='Nguồn dữ liệu', ordering='source')
    def source_display(self, obj):
        return obj.get_source_display()

    @admin.display(description='Trạng thái', ordering='status')
    def status_badge(self, obj):
        return badge_for(obj.status)

    @admin.display(description='Chu kỳ', ordering='schedule_seconds')
    def schedule_seconds_display(self, obj):
        return f"{obj.schedule_seconds}s"

    @admin.display(description='Cập nhật lúc', ordering='updated_at')
    def updated_at_display(self, obj):
        return datetime_vi(obj.updated_at)


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
    list_display = ('job_display', 'state_badge', 'started_at_display', 'finished_at_display',
                    'rows_upserted_display', 'rows_skipped_display')
    list_filter = ('state',)
    search_fields = ('job__name', 'error_message')
    list_select_related = ('job',)
    date_hierarchy = 'started_at'
    ordering = ('-started_at',)

    @admin.display(description='Lệnh thu thập', ordering='job__name')
    def job_display(self, obj):
        return obj.job.name

    @admin.display(description='Trạng thái', ordering='state')
    def state_badge(self, obj):
        return badge_for(obj.state)

    @admin.display(description='Bắt đầu lúc', ordering='started_at')
    def started_at_display(self, obj):
        return datetime_vi(obj.started_at)

    @admin.display(description='Kết thúc lúc', ordering='finished_at')
    def finished_at_display(self, obj):
        return datetime_vi(obj.finished_at) if obj.finished_at else empty_dash()

    @admin.display(description='Bản ghi nhận', ordering='rows_upserted')
    def rows_upserted_display(self, obj):
        return f"{obj.rows_upserted:,}"

    @admin.display(description='Bỏ qua', ordering='rows_skipped')
    def rows_skipped_display(self, obj):
        return f"{obj.rows_skipped:,}"

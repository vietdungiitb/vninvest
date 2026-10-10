"""Quản trị số liệu dùng AI — `ai_analytics`.

Vì sao thêm mới
---------------
`ai_analytics` có **2 model** mà trước đây không có `admin.py`. Đây là bảng
chi phí và hạn mức token của AI — thứ quyết định `AGENTS.md` mục "OPEN P0 —
HẾT HẠN MỨC GEMINI" có nên xảy ra hay không. Không có admin thì không ai theo
dõi được tổng chi phí theo ngày theo nhà cung cấp.

Ranh giới quyền
---------------
Cả hai bảng **chỉ đọc**. Chúng là dữ liệu phát sinh tự động từ mỗi lần gọi AI;
sửa tay là sai số liệu tài chính.
"""

from django.contrib import admin

from vninvest_core.admin_ui import (
    VNAdminMixin,
    VNReadOnlyMixin,
    badge_for,
    decimal_vi,
    money_vi,
)

from .models import AIUsageRecord, AIUsageSummary


@admin.register(AIUsageRecord)
class AIUsageRecordAdmin(VNReadOnlyMixin, admin.ModelAdmin):
    list_display = ('created_at', 'user', 'action_badge', 'provider', 'model',
                    'tokens_in', 'tokens_out', 'cost_display', 'latency_ms')
    list_filter = ('action', 'provider', 'status')
    search_fields = ('user__username', 'user__email', 'provider', 'model')
    list_select_related = ('user',)
    date_hierarchy = 'created_at'
    ordering = ('-created_at',)

    @admin.display(description='Hành động', ordering='action')
    def action_badge(self, obj):
        return badge_for(obj.action)

    @admin.display(description='Chi phí')
    def cost_display(self, obj):
        # `cost` là USD theo hợp đồng với nhà cung cấp, không phải VND — dùng
        # `decimal_vi` chứ không `money_vi` để không gắn nhầm ký hiệu ₫.
        return decimal_vi(obj.cost, decimals=6)

    @admin.display(description='Tổng token')
    def tokens_total(self, obj):
        return decimal_vi((obj.tokens_in or 0) + (obj.tokens_out or 0), decimals=0)


@admin.register(AIUsageSummary)
class AIUsageSummaryAdmin(VNReadOnlyMixin, admin.ModelAdmin):
    list_display = ('date', 'user', 'action_badge', 'total_requests',
                    'total_tokens_in', 'total_tokens_out', 'total_cost_display')
    list_filter = ('action', 'date')
    search_fields = ('user__username', 'user__email')
    list_select_related = ('user',)
    date_hierarchy = 'date'
    ordering = ('-date',)

    @admin.display(description='Hành động', ordering='action')
    def action_badge(self, obj):
        return badge_for(obj.action)

    @admin.display(description='Tổng chi phí')
    def total_cost_display(self, obj):
        return decimal_vi(obj.total_cost, decimals=6)

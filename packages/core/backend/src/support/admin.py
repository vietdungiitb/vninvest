"""Quản trị hỗ trợ khách hàng — `support`.

Vì sao thêm mới
---------------
App này có **9 model** mà trước đây **không có `admin.py` nào** (đếm bằng
script, xem `docs/PLAN_DJANGO_ADMIN_UIUX_20261010.md` §2.1). Yêu cầu hỗ trợ là
bảng mà nhân viên chăm sóc khách hàng phải **xử lý hằng ngày** — thiếu nó thì
mọi việc phải vào shell truy vấn tay.

Ranh giới quyền
---------------
`SupportTicket` cho **sửa** (nhân viên phải trả lời, đóng yêu cầu được).
Nhưng tin nhắn/tệp đính kèm/nhật ký là **dữ liệu phát sinh theo lời gửi
khách** — sửa tay sẽ phá vỡ chuỗi bằng chứng. Nên:
- `TicketMessage`, `TicketAttachment`, `TicketAuditLog` ⇒ chỉ đọc.
- `SupportTicketCounter` (bộ đếm sinh mã) ⇒ chỉ đọc; sửa tay sẽ phát sinh trùng
  mã yêu cầu.
"""

from django.contrib import admin

from vninvest_core.admin_ui import (
    VNAdminMixin,
    VNReadOnlyMixin,
    badge_for,
    datetime_vi,
    decimal_vi,
)

from .models import (
    SupportTicket,
    SupportTicketCounter,
    TicketAttachment,
    TicketAuditLog,
    TicketMessage,
)

# ---------------------------------------------------------------------------
# `TicketCategory`, `TicketPriority`, `TicketStatus`, `SenderRole` KHÔNG phải
# model — chúng là `models.TextChoices`. Đo bằng script quét `models.py`:
#   class X(models.TextChoices) -> CHOICES, không phải MODEL.
# `admin.register()` một TextChoices sẽ ném `ValueError` lúc autodiscover ⇒
# admin **không khởi động được**. Nhãn tiếng Việt của chúng nằm trong
# `TextChoices.labels`, Django tự hiển thị qua `get_FOO_display()`.
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# Yêu cầu hỗ trợ — cho sửa
# ---------------------------------------------------------------------------

class TicketMessageInline(admin.TabularInline):
    model = TicketMessage
    extra = 0
    fields = ('sender', 'sender_role', 'created_at', 'body_summary')
    readonly_fields = ('created_at', 'body_summary')
    ordering = ('created_at',)
    can_delete = False
    show_change_link = True

    @admin.display(description='Nội dung')
    def body_summary(self, obj):
        # Chỉ hiện 80 ký tự đầu: một tin nhắn dài làm sập dòng changelist.
        body = obj.body or ''
        return (body[:80] + "…") if len(body) > 80 else body


@admin.register(SupportTicket)
class SupportTicketAdmin(VNAdminMixin, admin.ModelAdmin):
    list_display = ('ticket_code', 'subject', 'status_badge', 'priority_badge',
                    'category', 'assignee', 'last_message_display')
    list_filter = ('status', 'priority', 'category', 'last_message_by_staff')
    search_fields = ('ticket_code', 'subject', 'requester__username', 'requester__email')
    readonly_fields = ('ticket_code', 'last_message_at', 'created_at', 'updated_at')
    # AC S3-AC10: tránh N+1 trên 3 khóa ngoại hiển thị trong bảng.
    list_select_related = ('tenant', 'requester', 'assignee')
    date_hierarchy = 'created_at'
    ordering = ('-last_message_at',)
    autocomplete_fields = ('tenant', 'assignee', 'requester')
    inlines = [TicketMessageInline]

    @admin.display(description='Trạng thái', ordering='status')
    def status_badge(self, obj):
        return badge_for(obj.status)

    @admin.display(description='Ưu tiên', ordering='priority')
    def priority_badge(self, obj):
        return badge_for(obj.priority)

    @admin.display(description='Tin nhắn gần nhất', ordering='last_message_at')
    def last_message_display(self, obj):
        return datetime_vi(obj.last_message_at)


# ---------------------------------------------------------------------------
# Bằng chứng — chỉ đọc
# ---------------------------------------------------------------------------

@admin.register(TicketMessage)
class TicketMessageAdmin(VNReadOnlyMixin, admin.ModelAdmin):
    list_display = ('ticket', 'sender', 'sender_role', 'created_at')
    list_filter = ('sender_role',)
    search_fields = ('ticket__ticket_code', 'ticket__subject', 'sender__username', 'body')
    list_select_related = ('ticket', 'sender')
    date_hierarchy = 'created_at'
    ordering = ('-created_at',)


@admin.register(TicketAttachment)
class TicketAttachmentAdmin(VNReadOnlyMixin, admin.ModelAdmin):
    list_display = ('message', 'original_name', 'mime_type', 'size_display', 'is_safe', 'created_at')
    list_filter = ('is_safe', 'mime_type')
    search_fields = ('original_name', 'sha256', 'message__ticket__ticket_code')
    list_select_related = ('message',)
    date_hierarchy = 'created_at'
    ordering = ('-created_at',)

    @admin.display(description='Dung lượng')
    def size_display(self, obj):
        return decimal_vi(obj.size_bytes, decimals=0)


@admin.register(TicketAuditLog)
class TicketAuditLogAdmin(VNReadOnlyMixin, admin.ModelAdmin):
    list_display = ('created_at', 'ticket', 'action', 'actor')
    list_filter = ('action',)
    search_fields = ('ticket__ticket_code', 'action', 'actor__username')
    list_select_related = ('ticket', 'actor')
    date_hierarchy = 'created_at'
    ordering = ('-created_at',)


@admin.register(SupportTicketCounter)
class SupportTicketCounterAdmin(VNReadOnlyMixin, admin.ModelAdmin):
    list_display = ('date', 'last_number')
    search_fields = ('date',)
    date_hierarchy = 'date'
    ordering = ('-date',)

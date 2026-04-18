from django.contrib import admin

from .models import (
    SupportTicket,
    SupportTicketCounter,
    TicketAttachment,
    TicketAuditLog,
    TicketMessage,
)


class TicketAttachmentInline(admin.TabularInline):
    model = TicketAttachment
    extra = 0
    readonly_fields = ('original_name', 'mime_type', 'size_bytes', 'is_safe', 'created_at')


class TicketMessageInline(admin.TabularInline):
    model = TicketMessage
    extra = 0
    readonly_fields = ('sender', 'sender_role', 'body', 'created_at')


@admin.register(SupportTicket)
class SupportTicketAdmin(admin.ModelAdmin):
    list_display = ('ticket_code', 'subject', 'requester', 'status', 'priority', 'assignee', 'updated_at')
    list_filter = ('status', 'priority', 'category')
    search_fields = ('ticket_code', 'subject', 'requester__username', 'requester__email')
    ordering = ('-updated_at',)
    inlines = [TicketMessageInline]


@admin.register(TicketMessage)
class TicketMessageAdmin(admin.ModelAdmin):
    list_display = ('ticket', 'sender', 'sender_role', 'created_at')
    search_fields = ('ticket__ticket_code', 'sender__username', 'body')
    inlines = [TicketAttachmentInline]


@admin.register(TicketAttachment)
class TicketAttachmentAdmin(admin.ModelAdmin):
    list_display = ('message', 'original_name', 'mime_type', 'size_bytes', 'is_safe', 'created_at')
    search_fields = ('message__ticket__ticket_code', 'original_name')


@admin.register(TicketAuditLog)
class TicketAuditLogAdmin(admin.ModelAdmin):
    list_display = ('ticket', 'action', 'actor', 'created_at')
    search_fields = ('ticket__ticket_code', 'action', 'actor__username')
    list_filter = ('action',)


@admin.register(SupportTicketCounter)
class SupportTicketCounterAdmin(admin.ModelAdmin):
    list_display = ('date', 'last_number')

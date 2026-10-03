from django.contrib import admin

from .models import AdvisoryComponent, AdvisoryRecord, AdvisorySession, SystemAISettings, UserAICredential


class AdvisoryComponentInline(admin.TabularInline):
    model = AdvisoryComponent
    extra = 0
    fields = ('component_type', 'order', 'created_at')
    readonly_fields = ('created_at',)
    ordering = ('order',)
    show_change_link = True


@admin.register(SystemAISettings)
class SystemAISettingsAdmin(admin.ModelAdmin):
    list_display = ('name', 'ai_model', 'is_active', 'max_tokens', 'temperature', 'updated_at')
    list_filter = ('is_active', 'ai_model')
    readonly_fields = ('created_at', 'updated_at')
    ordering = ('-is_active', 'name')


@admin.register(AdvisoryRecord)
class AdvisoryRecordAdmin(admin.ModelAdmin):
    list_display = ('symbol', 'session_date', 'status', 'ai_model', 'tokens_used', 'user', 'generated_at')
    list_filter = ('status', 'ai_model', 'session_date')
    search_fields = ('symbol', 'user__username', 'user__email')
    readonly_fields = ('advisory_id', 'created_at', 'updated_at', 'generated_at')
    ordering = ('-generated_at', '-created_at')


@admin.register(AdvisorySession)
class AdvisorySessionAdmin(admin.ModelAdmin):
    list_display = ('symbol', 'session_date', 'status', 'ai_model', 'tokens_used', 'token_budget', 'user', 'created_at')
    list_filter = ('status', 'ai_model', 'session_date')
    search_fields = ('symbol', 'user__username', 'user__email')
    readonly_fields = ('public_id', 'created_at', 'updated_at')
    ordering = ('-created_at',)
    inlines = [AdvisoryComponentInline]


@admin.register(UserAICredential)
class UserAICredentialAdmin(admin.ModelAdmin):
    list_display = ('user', 'ai_provider', 'ai_model', 'is_active', 'fallback_quota_used_today', 'fallback_quota_date', 'updated_at')
    list_filter = ('ai_provider', 'is_active')
    search_fields = ('user__username', 'user__email')
    readonly_fields = ('created_at', 'updated_at', 'fallback_quota_date')
    ordering = ('-updated_at',)

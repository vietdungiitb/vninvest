from django.contrib import admin

from vninvest_core.admin_ui import VNAdminMixin, badge_for, decimal_vi

from .models import (
    AdvisoryComponent,
    AdvisoryRecord,
    AdvisorySession,
    AIDeployment,
    AIFallbackChain,
    AICostRate,
    AIBudget,
    SystemAISettings,
    UserAICredential,
)


class AdvisoryComponentInline(admin.TabularInline):
    model = AdvisoryComponent
    extra = 0
    fields = ('component_type', 'order', 'created_at')
    readonly_fields = ('created_at',)
    ordering = ('order',)
    show_change_link = True


@admin.register(SystemAISettings)
class SystemAISettingsAdmin(VNAdminMixin, admin.ModelAdmin):
    list_display = ('name', 'ai_model', 'is_active', 'max_tokens', 'temperature', 'updated_at')
    list_filter = ('is_active', 'ai_model')
    readonly_fields = ('created_at', 'updated_at')
    ordering = ('-is_active', 'name')
    date_hierarchy = 'created_at'


@admin.register(AdvisoryRecord)
class AdvisoryRecordAdmin(VNAdminMixin, admin.ModelAdmin):
    list_display = ('symbol', 'session_date', 'status_badge', 'ai_model', 'tokens_used', 'user', 'generated_at')
    list_filter = ('status', 'ai_model', 'session_date')
    search_fields = ('symbol', 'user__username', 'user__email')
    readonly_fields = ('advisory_id', 'created_at', 'updated_at', 'generated_at')
    list_select_related = ('user',)
    date_hierarchy = 'session_date'
    ordering = ('-generated_at', '-created_at')

    @admin.display(description='Trạng thái', ordering='status')
    def status_badge(self, obj):
        return badge_for(obj.status)


@admin.register(AdvisorySession)
class AdvisorySessionAdmin(VNAdminMixin, admin.ModelAdmin):
    list_display = ('symbol', 'session_date', 'status_badge', 'ai_model', 'tokens_used', 'token_budget', 'user', 'created_at')
    list_filter = ('status', 'ai_model', 'session_date')
    search_fields = ('symbol', 'user__username', 'user__email')
    readonly_fields = ('public_id', 'created_at', 'updated_at')
    list_select_related = ('user',)
    date_hierarchy = 'session_date'
    ordering = ('-created_at',)
    inlines = [AdvisoryComponentInline]

    @admin.display(description='Trạng thái', ordering='status')
    def status_badge(self, obj):
        return badge_for(obj.status)


@admin.register(UserAICredential)
class UserAICredentialAdmin(VNAdminMixin, admin.ModelAdmin):
    list_display = ('user', 'ai_provider', 'ai_model', 'is_active', 'fallback_quota_used_today', 'fallback_quota_date', 'updated_at')
    list_filter = ('ai_provider', 'is_active')
    search_fields = ('user__username', 'user__email')
    readonly_fields = ('created_at', 'updated_at', 'fallback_quota_date')
    list_select_related = ('user',)
    ordering = ('-updated_at',)
    date_hierarchy = 'created_at'

    @admin.display(description='Đã dùng hạn mức dự phòng')
    def fallback_quota_display(self, obj):
        return decimal_vi(obj.fallback_quota_used_today, decimals=0)

# --- Import cho khoi WAVE 16 -------------------------------------
from .models import (
    AdvisoryComponent,
    AIAuditLog,
)
from vninvest_core.admin_ui import (
    badge_for,
    VNAdminMixin,
    VNReadOnlyMixin,
)
from django.contrib import messages


def _ws_badge(value, mapping=None):
    """Badge có chữ theo bảng màu riêng của nhóm.

    Tách riêng thay vì dùng thẳng `badge_for(..., color=...)` để chỗ gọi
    được đọc là "trạng thái này tô màu này" thay vì lặp lại chuỗi màu.
    """
    if value in (None, ""):
        return "—"
    return badge_for(value, color=(mapping or {}).get(str(value), "blue"))

@admin.register(AdvisoryComponent)
class AdvisoryComponentAdmin(VNReadOnlyMixin, admin.ModelAdmin):
    """Thành phần câu trả lời của buổi tư vấn AI — chỉ đọc."""

    list_display = ('created_at', 'session', 'component_type', 'order')
    list_filter = ('component_type', 'created_at')
    search_fields = ('content', 'session__user__username')
    autocomplete_fields = ('session',)
    ordering = ('session', 'order')


@admin.register(AIAuditLog)
class AIAuditLogAdmin(VNReadOnlyMixin, admin.ModelAdmin):
    """Nhật ký thay đổi/thử kết nối của trung tâm điều hành AI — chỉ đọc."""

    list_display = ('created_at', 'action', 'actor', 'diff_summary')
    list_filter = ('action', 'created_at')
    search_fields = ('actor', 'reason', 'diff_summary')
    ordering = ('-created_at',)
    date_hierarchy = 'created_at'
    list_per_page = 100


@admin.register(AIDeployment)
class AIDeploymentAdmin(VNAdminMixin, admin.ModelAdmin):
    """R2.1: deployment provider/model/credential."""

    list_display = ('name', 'owner_scope', 'provider', 'model', 'weight', 'enabled', 'health_state', 'updated_at')
    list_filter = ('owner_scope', 'provider', 'enabled', 'health_state')
    search_fields = ('name', 'model')
    readonly_fields = ('created_at', 'updated_at', 'last_health_at')
    ordering = ('name',)


@admin.register(AIFallbackChain)
class AIFallbackChainAdmin(VNAdminMixin, admin.ModelAdmin):
    """R2.1: thứ tự failover."""

    list_display = ('name', 'owner_scope', 'updated_at')
    list_filter = ('owner_scope',)
    search_fields = ('name',)
    readonly_fields = ('created_at', 'updated_at')
    ordering = ('name',)


@admin.register(AICostRate)
class AICostRateAdmin(VNAdminMixin, admin.ModelAdmin):
    """R2.7: bang gia token. Doc lai - bao cao da snapshot gia cua no."""

    list_display = (
        'provider', 'model', 'usd_per_1k_input', 'usd_per_1k_output',
        'pricing_source', 'effective_from',
    )
    list_filter = ('provider', 'pricing_source')
    search_fields = ('model', 'provider')
    readonly_fields = ('created_at', 'updated_at')
    ordering = ('provider', 'model', '-effective_from')


@admin.register(AIBudget)
class AIBudgetAdmin(VNAdminMixin, admin.ModelAdmin):
    """R2.8: 1 dong = 1 han muc tren 1 chieu, 4 tang."""

    list_display = (
        'user', 'tenant', 'provider', 'model', 'period', 'dimension',
        'limit_value', 'soft_ratio', 'is_active',
    )
    list_filter = ('period', 'dimension', 'is_active', 'provider')
    search_fields = ('model', 'provider', 'user__username', 'tenant__tenant_code')
    readonly_fields = ('created_at', 'updated_at')
    ordering = ('period', 'dimension', 'provider', 'model')

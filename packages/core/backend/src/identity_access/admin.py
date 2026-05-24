from django.contrib import admin

from .models import (
    CorePATCredential,
    CoreServiceAccount,
    CoreTenant,
    TenantInvite,
    TenantMember,
    UserProfile,
)

# ---------------------------------------------------------------------------
# Admin site branding (set once, in the identity_access app — the root domain)
# ---------------------------------------------------------------------------
admin.site.site_header = 'VNInvest - Trang quản trị hệ thống'
admin.site.site_title = 'VNInvest Admin'
admin.site.index_title = 'Sơ đồ chức năng hệ thống'


# ---------------------------------------------------------------------------
# Inlines
# ---------------------------------------------------------------------------

class CoreServiceAccountInline(admin.TabularInline):
    model = CoreServiceAccount
    extra = 0
    fields = ('name', 'status', 'created_at')
    readonly_fields = ('created_at',)
    show_change_link = True


class CorePATCredentialInline(admin.TabularInline):
    model = CorePATCredential
    extra = 0
    fields = ('label', 'token_prefix', 'status', 'created_at')
    readonly_fields = ('token_prefix', 'created_at')
    show_change_link = True


# ---------------------------------------------------------------------------
# ModelAdmin registrations
# ---------------------------------------------------------------------------

@admin.register(CoreTenant)
class CoreTenantAdmin(admin.ModelAdmin):
    list_display = ('display_name', 'tenant_code', 'plan', 'status', 'owner_user', 'created_at')
    list_filter = ('plan', 'status')
    search_fields = ('display_name', 'tenant_code', 'public_id', 'owner_user__username', 'owner_user__email')
    readonly_fields = ('public_id', 'created_at', 'updated_at')
    ordering = ('-created_at',)
    inlines = [CoreServiceAccountInline]

    class Meta:
        verbose_name = 'Tenant'


@admin.register(CoreServiceAccount)
class CoreServiceAccountAdmin(admin.ModelAdmin):
    list_display = ('name', 'tenant', 'status', 'created_at')
    list_filter = ('status',)
    search_fields = ('name', 'public_id', 'tenant__display_name', 'tenant__tenant_code')
    readonly_fields = ('public_id', 'created_at', 'updated_at')
    ordering = ('-created_at',)
    inlines = [CorePATCredentialInline]


@admin.register(CorePATCredential)
class CorePATCredentialAdmin(admin.ModelAdmin):
    list_display = ('label', 'token_prefix', 'service_account', 'status', 'created_at')
    list_filter = ('status',)
    search_fields = ('label', 'token_prefix', 'public_id', 'service_account__name')
    readonly_fields = ('public_id', 'token_prefix', 'token_secret_hash', 'created_at', 'updated_at')
    ordering = ('-created_at',)


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'language', 'theme', 'whale_alert_threshold', 'updated_at')
    list_filter = ('language', 'theme')
    search_fields = ('user__username', 'user__email', 'display_name')
    readonly_fields = ('created_at', 'updated_at')
    ordering = ('-updated_at',)


@admin.register(TenantMember)
class TenantMemberAdmin(admin.ModelAdmin):
    list_display = ('tenant', 'user', 'role', 'invited_by', 'joined_at')
    list_filter = ('role', 'tenant')
    search_fields = ('tenant__display_name', 'tenant__tenant_code', 'user__username', 'user__email')
    readonly_fields = ('public_id', 'joined_at', 'updated_at')
    ordering = ('-joined_at',)


@admin.register(TenantInvite)
class TenantInviteAdmin(admin.ModelAdmin):
    list_display = ('tenant', 'invited_email', 'role', 'status', 'inviter', 'expires_at', 'created_at')
    list_filter = ('status', 'role', 'tenant')
    search_fields = ('tenant__display_name', 'tenant__tenant_code', 'invited_email', 'token')
    readonly_fields = ('public_id', 'token', 'accepted_at', 'created_at', 'updated_at')
    ordering = ('-created_at',)

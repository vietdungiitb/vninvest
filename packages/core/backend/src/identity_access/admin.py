import uuid

from django import forms
from django.conf import settings
from django.contrib import admin, messages

from vninvest_core.admin_ui import (
    VNAdminMixin,
    badge_for,
    datetime_vi,
    decimal_vi,
)
from django.core import signing
from django.db import transaction
from django.shortcuts import get_object_or_404, redirect
from django.urls import path, reverse
from django.utils import timezone
from django.utils.html import format_html

from .google_oauth_service import (
    build_google_oauth_authorize_url,
    exchange_google_oauth_code,
    fetch_google_user_email,
)
from .mail_service import send_test_email
from .models import (
    CorePATCredential,
    CoreServiceAccount,
    CoreTenant,
    MailConfigAuditLog,
    SystemMailConfig,
    TenantInvite,
    TenantMember,
    TenantSettings,
    UserProfile,
)

# ---------------------------------------------------------------------------
# Branding KHÔNG set ở đây nữa.
#
# Trước đây 3 dòng dưới nằm ở đây. `identity_access` đứng **sau** `vninvest_core`
# trong `INSTALLED_APPS` (`settings.py:115-116`) ⇒ module admin của app này được
# autodiscover **sau**, ghi đè mọi branding đặt trước đó. Kết quả: branding có
# 2 chủ sở hữu, thắng thua theo thứ tự import — không ai đọc code là thấy.
#
# Nay nguồn sự thật duy nhất là `vninvest_core/admin.py` → `admin_ui.branding`.
# ---------------------------------------------------------------------------


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
class CoreTenantAdmin(VNAdminMixin, admin.ModelAdmin):
    list_display = ('display_name', 'tenant_code', 'plan', 'status_badge', 'owner_user', 'created_at')
    list_filter = ('plan', 'status')
    search_fields = ('display_name', 'tenant_code', 'public_id', 'owner_user__username', 'owner_user__email')
    readonly_fields = ('public_id', 'created_at', 'updated_at')
    list_select_related = ('owner_user',)
    ordering = ('-created_at',)
    date_hierarchy = 'created_at'
    inlines = [CoreServiceAccountInline]

    @admin.display(description='Trạng thái', ordering='status')
    def status_badge(self, obj):
        return badge_for(obj.status)

    class Meta:
        verbose_name = 'Tenant'


@admin.register(CoreServiceAccount)
class CoreServiceAccountAdmin(VNAdminMixin, admin.ModelAdmin):
    list_display = ('name', 'tenant', 'status_badge', 'created_at')
    list_filter = ('status',)
    search_fields = ('name', 'public_id', 'tenant__display_name', 'tenant__tenant_code')
    readonly_fields = ('public_id', 'created_at', 'updated_at')
    list_select_related = ('tenant',)
    ordering = ('-created_at',)
    date_hierarchy = 'created_at'
    inlines = [CorePATCredentialInline]

    @admin.display(description='Trạng thái', ordering='status')
    def status_badge(self, obj):
        return badge_for(obj.status)


@admin.register(CorePATCredential)
class CorePATCredentialAdmin(VNAdminMixin, admin.ModelAdmin):
    list_display = ('label', 'token_prefix', 'service_account', 'status_badge', 'created_at')
    list_filter = ('status',)
    search_fields = ('label', 'token_prefix', 'public_id', 'service_account__name')
    readonly_fields = ('public_id', 'token_prefix', 'token_secret_hash', 'created_at', 'updated_at')
    list_select_related = ('service_account',)
    ordering = ('-created_at',)
    date_hierarchy = 'created_at'

    @admin.display(description='Trạng thái', ordering='status')
    def status_badge(self, obj):
        return badge_for(obj.status)


@admin.register(UserProfile)
class UserProfileAdmin(VNAdminMixin, admin.ModelAdmin):
    list_display = ('user', 'language', 'theme', 'whale_alert_threshold_display', 'updated_at')
    list_filter = ('language', 'theme')
    search_fields = ('user__username', 'user__email', 'display_name')
    readonly_fields = ('created_at', 'updated_at')
    list_select_related = ('user',)
    ordering = ('-updated_at',)
    date_hierarchy = 'created_at'

    @admin.display(description='Ngưỡng cảnh báo cá voi')
    def whale_alert_threshold_display(self, obj):
        return decimal_vi(obj.whale_alert_threshold, decimals=0)


@admin.register(TenantMember)
class TenantMemberAdmin(VNAdminMixin, admin.ModelAdmin):
    list_display = ('tenant', 'user', 'role', 'invited_by', 'joined_at_display')
    list_filter = ('role', 'tenant')
    search_fields = ('tenant__display_name', 'tenant__tenant_code', 'user__username', 'user__email')
    readonly_fields = ('public_id', 'joined_at', 'updated_at')
    list_select_related = ('tenant', 'user', 'invited_by')
    ordering = ('-joined_at',)
    date_hierarchy = 'updated_at'

    @admin.display(description='Tham gia', ordering='joined_at')
    def joined_at_display(self, obj):
        return datetime_vi(obj.joined_at)


@admin.register(TenantInvite)
class TenantInviteAdmin(VNAdminMixin, admin.ModelAdmin):
    list_display = ('tenant', 'invited_email', 'role', 'status_badge', 'inviter', 'expires_at', 'created_at')
    list_filter = ('status', 'role', 'tenant')
    search_fields = ('tenant__display_name', 'tenant__tenant_code', 'invited_email', 'token')
    readonly_fields = ('public_id', 'token', 'accepted_at', 'created_at', 'updated_at')
    list_select_related = ('tenant', 'inviter')
    ordering = ('-created_at',)
    date_hierarchy = 'created_at'

    @admin.display(description='Trạng thái', ordering='status')
    def status_badge(self, obj):
        return badge_for(obj.status)


@admin.register(TenantSettings)
class TenantSettingsAdmin(VNAdminMixin, admin.ModelAdmin):
    list_display = ('tenant', 'timezone', 'locale', 'theme', 'custom_domain', 'updated_at')
    list_filter = ('theme', 'locale')
    list_select_related = ('tenant',)
    search_fields = ('tenant__display_name', 'tenant__tenant_code', 'custom_domain')
    readonly_fields = ('created_at', 'updated_at')
    date_hierarchy = 'created_at'


# ---------------------------------------------------------------------------
# System Mail Config Admin — SaaS native Gmail / OAuth2 / SMTP management
# ---------------------------------------------------------------------------

def _resolve_google_oauth_redirect_uri(request) -> str:
    configured = str(getattr(settings, 'GOOGLE_OAUTH_REDIRECT_URI', '') or '').strip()
    if configured:
        return configured
    return request.build_absolute_uri(
        reverse('admin:identity_access_systemmailconfig_google_callback')
    )


class SystemMailConfigAdminForm(forms.ModelForm):
    smtp_password = forms.CharField(
        label='Mật khẩu SMTP',
        required=False,
        widget=forms.PasswordInput(render_value=False),
        help_text='Để trống nếu không thay đổi mật khẩu đã lưu.',
    )
    google_client_secret = forms.CharField(
        label='Google Client Secret',
        required=False,
        widget=forms.PasswordInput(render_value=False),
        help_text='Để trống nếu không thay đổi client secret đã lưu.',
    )
    google_refresh_token = forms.CharField(
        label='Google Refresh Token',
        required=False,
        widget=forms.PasswordInput(render_value=False),
        help_text='Để trống nếu không thay đổi refresh token đã lưu.',
    )
    google_service_account_json = forms.CharField(
        label='Google Service Account JSON',
        required=False,
        widget=forms.Textarea(attrs={'rows': 6}),
        help_text='Để trống nếu không thay đổi JSON đã lưu.',
    )

    class Meta:
        model = SystemMailConfig
        exclude = (
            'smtp_password_encrypted',
            'google_service_account_json_encrypted',
            'google_client_secret_encrypted',
            'google_refresh_token_encrypted',
        )

    def clean(self):
        cleaned_data = super().clean()

        raw_password = cleaned_data.get('smtp_password')
        if raw_password:
            self.instance.set_smtp_password(raw_password)

        raw_google_secret = cleaned_data.get('google_client_secret')
        if raw_google_secret:
            self.instance.set_google_client_secret(raw_google_secret)

        raw_refresh_token = cleaned_data.get('google_refresh_token')
        if raw_refresh_token:
            self.instance.set_google_refresh_token(raw_refresh_token)

        raw_service_account_json = cleaned_data.get('google_service_account_json')
        if raw_service_account_json:
            self.instance.set_google_service_account_json(raw_service_account_json)

        return cleaned_data


@admin.register(SystemMailConfig)
class SystemMailConfigAdmin(VNAdminMixin, admin.ModelAdmin):
    form = SystemMailConfigAdminForm
    list_display = (
        'name',
        'provider',
        'from_email',
        'google_account_email',
        'is_active',
        'last_test_status',
        'last_tested_at',
        'updated_at',
    )
    list_filter = ('provider', 'is_active', 'last_test_status')
    search_fields = ('name', 'from_email', 'from_name', 'google_account_email', 'google_client_id', 'smtp_username')
    ordering = ('-updated_at',)
    date_hierarchy = 'created_at'
    actions = ('mark_as_default', 'send_test_email_to_selected_accounts')
    readonly_fields = (
        'smtp_password_status',
        'google_client_secret_status',
        'google_refresh_token_status',
        'google_service_account_json_status',
        'oauth_actions',
        'last_tested_at',
        'last_test_status',
        'last_test_message',
        'oauth_connected_at',
        'token_last_refreshed_at',
        'token_last_error',
        'last_modified_by',
        'created_at',
        'updated_at',
    )
    fieldsets = (
        ('Nhận diện', {'fields': ('name', 'provider', 'is_active', 'from_email', 'from_name', 'reply_to_email', 'timeout_seconds')}),
        ('Máy chủ SMTP', {'fields': ('smtp_host', 'smtp_port', 'smtp_username', 'smtp_password', 'smtp_password_status', 'smtp_use_tls', 'smtp_use_ssl')}),
        (
            'Google OAuth2',
            {
                'fields': (
                    'google_client_id',
                    'google_client_secret',
                    'google_client_secret_status',
                    'google_refresh_token',
                    'google_refresh_token_status',
                    'google_account_email',
                    'google_token_scope',
                    'oauth_connected_at',
                    'token_last_refreshed_at',
                    'token_last_error',
                    'oauth_actions',
                )
            },
        ),
        (
            'Google Service Account DWD',
            {
                'fields': (
                    'google_delegated_user_email',
                    'google_service_account_json',
                    'google_service_account_json_status',
                )
            },
        ),
        ('Kết quả kiểm tra', {'fields': ('last_tested_at', 'last_test_status', 'last_test_message', 'last_modified_by', 'created_at', 'updated_at')}),
    )

    @admin.display(description='Mật khẩu SMTP')
    def smtp_password_status(self, obj):
        return 'Đã lưu' if obj.smtp_password_encrypted else 'Chưa cấu hình'

    @admin.display(description='Google Client Secret')
    def google_client_secret_status(self, obj):
        return 'Đã lưu' if obj.google_client_secret_encrypted else 'Chưa cấu hình'

    @admin.display(description='Google Refresh Token')
    def google_refresh_token_status(self, obj):
        return 'Đã lưu' if obj.google_refresh_token_encrypted else 'Chưa cấu hình'

    @admin.display(description='Google Service Account JSON')
    def google_service_account_json_status(self, obj):
        return 'Đã lưu' if obj.google_service_account_json_encrypted else 'Chưa cấu hình'

    @admin.display(description='OAuth2 actions')
    def oauth_actions(self, obj):
        if not obj or not obj.pk:
            return 'Lưu cấu hình trước khi thao tác OAuth2.'
        connect_url = reverse('admin:identity_access_systemmailconfig_google_connect', args=[obj.pk])
        revoke_url = reverse('admin:identity_access_systemmailconfig_google_revoke', args=[obj.pk])
        return format_html(
            '<a class="button" href="{}">Kết nối Google</a>&nbsp;'
            '<a class="button" href="{}">Thu hồi token</a>',
            connect_url,
            revoke_url,
        )

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path(
                '<path:object_id>/google/connect/',
                self.admin_site.admin_view(self.google_connect_view),
                name='identity_access_systemmailconfig_google_connect',
            ),
            path(
                'google/callback/',
                self.admin_site.admin_view(self.google_callback_view),
                name='identity_access_systemmailconfig_google_callback',
            ),
            path(
                '<path:object_id>/google/revoke/',
                self.admin_site.admin_view(self.google_revoke_view),
                name='identity_access_systemmailconfig_google_revoke',
            ),
        ]
        return custom_urls + urls

    def save_model(self, request, obj, form, change):
        obj.last_modified_by = request.user
        with transaction.atomic():
            if obj.is_active:
                SystemMailConfig.objects.select_for_update().exclude(pk=obj.pk).update(is_active=False)
            super().save_model(request, obj, form, change)
            MailConfigAuditLog.objects.create(
                operator_user=request.user,
                action='update' if change else 'create',
                target_config_id=obj.id,
                description=f'Staff {"updated" if change else "created"} system mail config ID {obj.id}',
            )

    @admin.action(description='Đặt làm cấu hình gửi mail mặc định')
    def mark_as_default(self, request, queryset):
        selected_config = queryset.order_by('pk').first()
        if not selected_config:
            self.message_user(request, 'Không có cấu hình mail nào được chọn.', level=messages.WARNING)
            return

        with transaction.atomic():
            SystemMailConfig.objects.select_for_update().exclude(pk=selected_config.pk).update(is_active=False)
            selected_config.is_active = True
            selected_config.last_modified_by = request.user
            selected_config.save(update_fields=['is_active', 'last_modified_by', 'updated_at'])
            MailConfigAuditLog.objects.create(
                operator_user=request.user,
                action='activate',
                target_config_id=selected_config.id,
                description=f'Staff activated system mail config ID {selected_config.id}',
            )

        self.message_user(
            request,
            f'Đã đặt cấu hình {selected_config.name or selected_config.from_email} làm mail mặc định.',
            level=messages.SUCCESS,
        )

    @admin.action(description='Gửi mail kiểm tra tới email của tài khoản admin đang đăng nhập')
    def send_test_email_to_selected_accounts(self, request, queryset):
        recipient_email = (request.user.email or '').strip()
        if not recipient_email:
            self.message_user(
                request,
                'Tài khoản admin hiện tại chưa có email, không thể gửi mail kiểm tra.',
                level=messages.ERROR,
            )
            return

        success_count = 0
        for account in queryset:
            try:
                send_test_email(account, recipient_email)
                success_count += 1
            except Exception as exc:
                self.message_user(
                    request,
                    f'Gửi mail kiểm tra thất bại cho cấu hình {account.name or account.from_email}: {exc}',
                    level=messages.ERROR,
                )

        if success_count:
            self.message_user(
                request,
                f'Đã gửi {success_count} mail kiểm tra tới {recipient_email}.',
                level=messages.SUCCESS,
            )

    def google_connect_view(self, request, object_id):
        account = get_object_or_404(SystemMailConfig, pk=object_id)
        change_url = reverse('admin:identity_access_systemmailconfig_change', args=[account.pk])
        if account.provider != SystemMailConfig.PROVIDER_GMAIL:
            self.message_user(request, 'Cấu hình này chưa chọn provider=gmail_api.', level=messages.ERROR)
            return redirect(change_url)

        if not account.google_client_id or not account.get_google_client_secret():
            self.message_user(request, 'Thiếu Google Client ID/Secret.', level=messages.ERROR)
            return redirect(change_url)

        state_payload = signing.dumps(
            {'config_id': account.pk, 'user_id': request.user.pk, 'nonce': uuid.uuid4().hex},
            salt='identity_access.system-mail-google-oauth-state',
        )
        request.session['mail_google_oauth_state'] = state_payload
        request.session['mail_google_oauth_account_id'] = account.pk

        redirect_uri = _resolve_google_oauth_redirect_uri(request)
        scope = (account.google_token_scope or '').strip() or 'https://www.googleapis.com/auth/gmail.send openid email'
        authorize_url = build_google_oauth_authorize_url(
            client_id=account.google_client_id,
            redirect_uri=redirect_uri,
            state=state_payload,
            scope=scope,
        )
        return redirect(authorize_url)

    def google_callback_view(self, request):
        state = request.GET.get('state', '')
        code = request.GET.get('code', '')
        oauth_error = request.GET.get('error', '')
        session_state_token = request.session.get('mail_google_oauth_state', '')
        account_id = request.session.get('mail_google_oauth_account_id')
        change_list_url = reverse('admin:identity_access_systemmailconfig_changelist')

        if oauth_error:
            self.message_user(request, f'Google OAuth lỗi: {oauth_error}', level=messages.ERROR)
            return redirect(change_list_url)

        if not state or not session_state_token or state != session_state_token:
            self.message_user(request, 'OAuth state không hợp lệ. Vui lòng thử lại.', level=messages.ERROR)
            return redirect(change_list_url)

        try:
            state_data = signing.loads(
                state,
                salt='identity_access.system-mail-google-oauth-state',
                max_age=600,
            )
        except signing.SignatureExpired:
            self.message_user(request, 'OAuth state đã hết hạn. Vui lòng kết nối lại Google.', level=messages.ERROR)
            return redirect(change_list_url)
        except signing.BadSignature:
            self.message_user(request, 'OAuth state bị sai chữ ký. Vui lòng thử lại.', level=messages.ERROR)
            return redirect(change_list_url)

        if not code or not account_id:
            self.message_user(request, 'Thiếu authorization code hoặc account context.', level=messages.ERROR)
            return redirect(change_list_url)

        if state_data.get('config_id') != account_id or state_data.get('user_id') != request.user.pk:
            self.message_user(request, 'OAuth state không khớp account/user hiện tại.', level=messages.ERROR)
            return redirect(change_list_url)

        account = get_object_or_404(SystemMailConfig, pk=account_id)
        change_url = reverse('admin:identity_access_systemmailconfig_change', args=[account.pk])

        try:
            redirect_uri = _resolve_google_oauth_redirect_uri(request)
            token_payload = exchange_google_oauth_code(
                client_id=account.google_client_id,
                client_secret=account.get_google_client_secret(),
                code=code,
                redirect_uri=redirect_uri,
                timeout_seconds=account.timeout_seconds,
            )
            refresh_token = str(token_payload.get('refresh_token') or '').strip()
            access_token = str(token_payload.get('access_token') or '').strip()
            scope = str(token_payload.get('scope') or '').strip()

            if refresh_token:
                account.set_google_refresh_token(refresh_token)
            elif not account.has_google_refresh_token:
                raise ValueError('Google không trả refresh_token. Hãy cấp lại consent với prompt=consent.')
            if scope:
                account.google_token_scope = scope

            email = fetch_google_user_email(access_token=access_token, timeout_seconds=account.timeout_seconds)
            if email:
                account.google_account_email = email
            account.oauth_connected_at = timezone.now()
            account.token_last_error = ''
            account.last_modified_by = request.user
            account.save(update_fields=[
                'google_refresh_token_encrypted',
                'google_token_scope',
                'google_account_email',
                'oauth_connected_at',
                'token_last_error',
                'last_modified_by',
                'updated_at',
            ])
            MailConfigAuditLog.objects.create(
                operator_user=request.user,
                action='google_connect',
                target_config_id=account.id,
                description=f'Staff connected Google OAuth2 for mail config ID {account.id}',
            )
            self.message_user(request, f'Kết nối Google thành công cho cấu hình {account.name or account.from_email}.', level=messages.SUCCESS)
        except Exception as exc:
            account.token_last_error = str(exc)
            account.save(update_fields=['token_last_error', 'updated_at'])
            self.message_user(request, f'Kết nối Google thất bại: {exc}', level=messages.ERROR)
        finally:
            request.session.pop('mail_google_oauth_state', None)
            request.session.pop('mail_google_oauth_account_id', None)

        return redirect(change_url)

    def google_revoke_view(self, request, object_id):
        account = get_object_or_404(SystemMailConfig, pk=object_id)
        change_url = reverse('admin:identity_access_systemmailconfig_change', args=[account.pk])
        account.clear_google_refresh_token()
        account.google_account_email = ''
        account.oauth_connected_at = None
        account.token_last_refreshed_at = None
        account.token_last_error = ''
        account.last_modified_by = request.user
        account.save(update_fields=[
            'google_refresh_token_encrypted',
            'google_account_email',
            'oauth_connected_at',
            'token_last_refreshed_at',
            'token_last_error',
            'last_modified_by',
            'updated_at',
        ])
        MailConfigAuditLog.objects.create(
            operator_user=request.user,
            action='google_revoke',
            target_config_id=account.id,
            description=f'Staff revoked Google OAuth2 token for mail config ID {account.id}',
        )
        self.message_user(request, f'Đã gỡ token Google cho cấu hình {account.name or account.from_email}.', level=messages.SUCCESS)
        return redirect(change_url)

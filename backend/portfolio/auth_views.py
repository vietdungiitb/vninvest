"""Auth views for registration, verification, login gating, and /api/auth/me."""
import logging

from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.core import signing
from django.db import transaction
from django.utils import timezone
from django.contrib.auth.models import User
from rest_framework.generics import RetrieveAPIView, CreateAPIView
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import serializers, status
from rest_framework.exceptions import APIException, AuthenticationFailed, ValidationError
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from .email_verification import resolve_email_verification_token, send_verification_email
from .google_oauth_service import fetch_google_user_email
from .models import UserConfig
from .onboarding_trial_service import apply_onboarding_trial_for_new_user
from .password_reset import resolve_password_reset_token, send_password_reset_email
from .permissions import _get_plan, resolve_user_entitlements
from .starter_portfolio_service import (
    provision_starter_portfolios_for_user,
    should_provision_starter_portfolios_for_user,
)


logger = logging.getLogger(__name__)


def _request_ip(request) -> str:
    forwarded = str(request.META.get('HTTP_X_FORWARDED_FOR', '') or '').strip()
    if forwarded:
        return forwarded.split(',')[0].strip()
    return str(request.META.get('REMOTE_ADDR', '') or '').strip()


def _resolve_auth_bootstrap_state(user):
    cfg = getattr(user, 'user_config', None)
    entitlements = resolve_user_entitlements(user)
    plan = entitlements['plan']
    return cfg, entitlements, plan


def _build_current_capability_snapshot(user) -> dict:
    _cfg, entitlements, plan = _resolve_auth_bootstrap_state(user)
    central_operator_enabled = bool(
        entitlements.get('can_read_admin_ops')
        or entitlements.get('can_read_admin_crawl_control')
        or entitlements.get('can_read_admin_core_jobs')
        or entitlements.get('can_read_admin_core_audit_trace')
    )
    tenant_admin_enabled = bool(
        entitlements.get('can_read_tenant_admin_home')
        or entitlements.get('can_read_tenant_capabilities')
        or entitlements.get('can_read_tenant_usage')
        or entitlements.get('can_read_tenant_billing')
        or entitlements.get('can_read_tenant_service_accounts')
        or entitlements.get('can_read_tenant_pats')
    )
    default_route = '/admin-ops' if central_operator_enabled else '/tenant-admin/home' if tenant_admin_enabled else '/'
    session_type = 'operator_human' if central_operator_enabled else 'tenant_human'
    tenant_id = f'ten_usr_{user.id}' if tenant_admin_enabled else None
    menus = []

    if entitlements.get('can_read_admin_ops'):
        menus.append({
            'key': 'admin_ops',
            'label': 'Admin Ops',
            'route': '/admin-ops',
            'enabled': True,
            'required_ability': {'action': 'read', 'subject': 'AdminOps'},
        })
    if entitlements.get('can_read_admin_crawl_control'):
        menus.append({
            'key': 'admin_crawl_control',
            'label': 'Admin Crawl Control',
            'route': '/admin-crawl-control',
            'enabled': True,
            'required_ability': {'action': 'read', 'subject': 'AdminCrawlControl'},
        })
    if entitlements.get('can_read_tenant_admin_home'):
        menus.append({
            'key': 'tenant_admin_home',
            'label': 'Tenant Admin Home',
            'route': '/tenant-admin/home',
            'enabled': True,
            'required_ability': {'action': 'read', 'subject': 'TenantAdminHome'},
        })
    if entitlements.get('can_read_tenant_service_accounts'):
        menus.append({
            'key': 'tenant_service_accounts',
            'label': 'Tenant Service Accounts',
            'route': '/tenant-admin/service-accounts',
            'enabled': True,
            'required_ability': {'action': 'read', 'subject': 'TenantServiceAccountAdmin'},
        })
    if entitlements.get('can_read_tenant_pats'):
        menus.append({
            'key': 'tenant_pats',
            'label': 'Tenant PATs',
            'route': '/tenant-admin/pats',
            'enabled': True,
            'required_ability': {'action': 'read', 'subject': 'TenantPATAdmin'},
        })
    if entitlements.get('can_read_tenant_usage'):
        menus.append({
            'key': 'tenant_usage',
            'label': 'Tenant Usage',
            'route': '/tenant-admin/usage',
            'enabled': True,
            'required_ability': {'action': 'read', 'subject': 'TenantUsageView'},
        })
    if entitlements.get('can_read_tenant_billing'):
        menus.append({
            'key': 'tenant_billing',
            'label': 'Tenant Billing',
            'route': '/tenant-admin/billing',
            'enabled': True,
            'required_ability': {'action': 'read', 'subject': 'TenantBillingView'},
        })
    if entitlements.get('can_read_tenant_capabilities'):
        menus.append({
            'key': 'tenant_capabilities',
            'label': 'Tenant Capabilities',
            'route': '/tenant-admin/capabilities',
            'enabled': True,
            'required_ability': {'action': 'read', 'subject': 'TenantCapabilityView'},
        })

    hidden_routes = []
    if not central_operator_enabled:
        hidden_routes.extend(['/admin-ops', '/admin-crawl-control'])
    if not tenant_admin_enabled:
        hidden_routes.append('/tenant-admin/*')

    return {
        'object': 'capability_snapshot',
        'snapshot_version': '2026-05-02',
        'generated_at': timezone.now().isoformat(),
        'actor': {
            'user_id': str(user.id),
            'username': user.username,
            'email': user.email,
            'session_type': session_type,
            'primary_tenant_id': tenant_id,
            'display_name': user.get_full_name().strip() or user.username,
            'plan': plan,
        },
        'surfaces': {
            'central_operator': {
                'enabled': central_operator_enabled,
                'default_route': '/admin-ops' if central_operator_enabled else None,
            },
            'tenant_admin': {
                'enabled': tenant_admin_enabled,
                'default_route': '/tenant-admin/home' if tenant_admin_enabled else None,
                'tenant_id': tenant_id,
            },
            'vip_internal_admin': {
                'enabled': False,
                'default_route': None,
            },
        },
        'roles': [session_type, plan],
        'scopes': [],
        'abilities': entitlements['abilities'],
        'navigation': {
            'default_route': default_route,
            'menus': menus,
            'hidden_routes': hidden_routes,
        },
        'constraints': {
            'write_actions_require_reason': central_operator_enabled,
            'browser_pat_usage_forbidden': True,
            'show_disabled_actions': True,
            'token_secret_one_time_reveal': True,
        },
        'feature_flags': {
            'central_operator_enabled': central_operator_enabled,
            'tenant_console_enabled': tenant_admin_enabled,
            'capability_bootstrap_source': 'auth_me_wrapper',
        },
        'bridges': {
            'legacy_manage_all_active': False,
            'bridge_source': None,
            'bridge_deprecation_state': 'disabled',
        },
        'entitlements': entitlements,
    }


class EmailDeliveryFailed(APIException):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_detail = 'Không thể gửi email xác thực tại thời điểm này.'
    default_code = 'email_delivery_failed'


# ---------- /api/auth/me ----------

class UserMeView(RetrieveAPIView):
    """
    GET /api/auth/me/
    Trả về thông tin user hiện tại kèm plan và danh sách abilities để CASL Frontend đọc.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        user = request.user
        cfg, entitlements, plan = _resolve_auth_bootstrap_state(user)

        return Response({
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'is_staff': bool(user.is_staff),
            'is_superuser': bool(user.is_superuser),
            'first_name': user.first_name,
            'last_name': user.last_name,
            'plan': plan,
            'plan_expires_at': cfg.plan_expires_at.isoformat() if cfg and cfg.plan_expires_at else None,
            'oauth_provider': cfg.oauth_provider if cfg else '',
            'whale_alert_threshold': float(cfg.whale_alert_threshold) if cfg else 500,
            'theme': cfg.theme if cfg else 'dark',
            'email_verified': bool(cfg.email_verified) if cfg else False,
            'email_verified_at': cfg.email_verified_at.isoformat() if cfg and cfg.email_verified_at else None,
            'abilities': entitlements['abilities'],
            'entitlements': entitlements,
        })


class CapabilitySnapshotView(APIView):
    """
    GET /api/core/v1/access/capabilities/
    Dedicated current-code bootstrap wrapper that exposes admin/tenant surfaces
    without relying on wildcard `manage all` semantics.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        return Response(_build_current_capability_snapshot(request.user))


class VerifiedEmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        # Accept either username or email for login, normalize before JWT auth.
        username_or_email = str(attrs.get('username', '')).strip()
        if username_or_email:
            if '@' in username_or_email:
                user = User.objects.filter(email__iexact=username_or_email).only('username').first()
                if user:
                    attrs['username'] = user.username
            else:
                attrs['username'] = username_or_email.lower()

        data = super().validate(attrs)
        user_config, _ = UserConfig.objects.get_or_create(user=self.user)
        if not self.user.is_superuser and not user_config.email_verified:
            raise AuthenticationFailed('Tài khoản chưa xác thực email. Vui lòng kiểm tra email và kích hoạt tài khoản trước khi đăng nhập.')
        return data


class VerifiedEmailTokenObtainPairView(TokenObtainPairView):
    serializer_class = VerifiedEmailTokenObtainPairSerializer


# ---------- /api/auth/register ----------

class RegisterSerializer(serializers.Serializer):
    username = serializers.RegexField(
        regex=r'^[a-zA-Z0-9_]{3,30}$',
        error_messages={'invalid': 'Username chỉ chứa chữ, số, gạch chân, 3-30 ký tự.'},
    )
    email = serializers.EmailField(required=True, allow_blank=False)
    password = serializers.CharField(min_length=8, write_only=True)
    password_confirm = serializers.CharField(write_only=True)

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError('Tên đăng nhập đã tồn tại.')
        return value

    def validate_email(self, value):
        normalized_email = value.strip().lower()
        if User.objects.filter(email__iexact=normalized_email).exists():
            raise serializers.ValidationError('Email đã được sử dụng.')
        return normalized_email

    def validate(self, data):
        if data['password'] != data['password_confirm']:
            raise serializers.ValidationError({'password_confirm': 'Mật khẩu xác nhận không khớp.'})
        # Enforce Django password validators (min length, common, numeric, similarity)
        validate_password(data['password'])
        return data

    def create(self, validated_data):
        validated_data.pop('password_confirm')
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=validated_data['password'],
        )
        UserConfig.objects.get_or_create(user=user)
        return user


class RegisterView(CreateAPIView):
    """
    POST /api/auth/register/
    Đăng ký tài khoản mới, gửi email xác thực, không auto-login.
    """
    permission_classes = [AllowAny]
    serializer_class = RegisterSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        verification_required = True
        response_message = 'Đăng ký thành công. Vui lòng kiểm tra email để xác thực tài khoản trước khi đăng nhập.'

        with transaction.atomic():
            user = serializer.save()
            user_config = user.user_config

            # Apply onboarding trial policy for every non-superuser signup path.
            if getattr(settings, 'ONBOARDING_TRIAL_APPLY_ON_SIGNUP', True):
                try:
                    apply_onboarding_trial_for_new_user(user=user, signup_method='email_password')
                    user_config.refresh_from_db()
                except Exception:
                    # Fail-soft to avoid blocking signup if policy logic has transient issue.
                    logger.exception('Failed to apply onboarding trial for user_id=%s', user.id)

            if should_provision_starter_portfolios_for_user(user=user):
                try:
                    provision_starter_portfolios_for_user(user=user)
                except Exception:
                    # Fail-soft to keep signup healthy if starter provisioning has transient issue.
                    logger.exception('Failed to provision starter portfolios for user_id=%s', user.id)

            # Pre-set default state
            user_config.email_verified = False
            user_config.email_verification_sent_at = None
            user_config.email_verified_at = None
            user_config.save(update_fields=['email_verified', 'email_verification_sent_at', 'email_verified_at', 'updated_at'])

        # End of transaction block. Send email OUTSIDE the transaction to avoid holding DB lock.
        try:
            send_verification_email(user)
            user_config.email_verification_sent_at = timezone.now()
            user_config.save(update_fields=['email_verification_sent_at', 'updated_at'])
        except Exception as exc:
            if settings.DEBUG:
                # Dev fallback: tránh kẹt luồng đăng ký khi chưa cấu hình SMTP.
                user_config.email_verified = True
                user_config.email_verification_sent_at = None
                user_config.email_verified_at = timezone.now()
                user_config.save(update_fields=['email_verified', 'email_verification_sent_at', 'email_verified_at', 'updated_at'])
                verification_required = False
                response_message = (
                    'Đăng ký thành công (DEV mode). Hệ thống chưa gửi được email xác thực '
                    'nên tài khoản đã được kích hoạt tạm thời.'
                )
            else:
                raise EmailDeliveryFailed(detail=f'Không thể gửi email xác thực: {exc}') from exc

        return Response(
            {
                'username': user.username,
                'email': user.email,
                'plan': _get_plan(user),
                'verification_required': verification_required,
                'message': response_message,
            },
            status=status.HTTP_201_CREATED,
        )


class VerifyEmailSerializer(serializers.Serializer):
    token = serializers.CharField()


class VerifyEmailView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = VerifyEmailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            user = resolve_email_verification_token(serializer.validated_data['token'])
        except (KeyError, signing.BadSignature, User.DoesNotExist):
            raise ValidationError({'token': 'Link xác thực không hợp lệ hoặc đã hết hạn.'})

        user_config, _ = UserConfig.objects.get_or_create(user=user)
        if not user_config.email_verified:
            user_config.email_verified = True
            user_config.email_verified_at = timezone.now()
            user_config.save(update_fields=['email_verified', 'email_verified_at', 'updated_at'])

        return Response(
            {
                'username': user.username,
                'message': 'Xác thực email thành công. Bạn đã có thể đăng nhập vào hệ thống.',
            },
            status=status.HTTP_200_OK,
        )


class ResendVerificationSerializer(serializers.Serializer):
    identifier = serializers.CharField()


class ResendVerificationEmailView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'auth_resend_verification'

    def post(self, request, *args, **kwargs):
        serializer = ResendVerificationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        identifier = serializer.validated_data['identifier'].strip()
        user = User.objects.filter(username__iexact=identifier).first()
        if user is None:
            user = User.objects.filter(email__iexact=identifier).first()

        if user is not None:
            user_config, _ = UserConfig.objects.get_or_create(user=user)
            if not user_config.email_verified:
                try:
                    send_verification_email(user)
                    user_config.email_verification_sent_at = timezone.now()
                    user_config.save(update_fields=['email_verification_sent_at', 'updated_at'])
                except Exception as exc:
                    raise EmailDeliveryFailed(detail=f'Không thể gửi lại email xác thực: {exc}') from exc

        return Response(
            {'message': 'Nếu tài khoản tồn tại và chưa xác thực, hệ thống đã gửi lại email xác thực.'},
            status=status.HTTP_200_OK,
        )


class PasswordResetRequestSerializer(serializers.Serializer):
    identifier = serializers.CharField()


class PasswordResetRequestView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'auth_password_reset_request'

    def post(self, request, *args, **kwargs):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        identifier = serializer.validated_data['identifier'].strip()
        identifier_type = 'email' if '@' in identifier else 'username'
        user = User.objects.filter(username__iexact=identifier).first()
        if user is None:
            user = User.objects.filter(email__iexact=identifier).first()

        if user is not None and (user.email or '').strip():
            try:
                send_password_reset_email(user)
                logger.info(
                    'password_reset_request.sent user_id=%s identifier_type=%s ip=%s',
                    user.id,
                    identifier_type,
                    _request_ip(request),
                )
            except Exception:
                logger.exception('Failed to send password reset email for user_id=%s', user.id)
        else:
            logger.info(
                'password_reset_request.unknown_identifier identifier_type=%s ip=%s',
                identifier_type,
                _request_ip(request),
            )

        return Response(
            {'message': 'Nếu tài khoản tồn tại, hệ thống đã gửi email hướng dẫn đặt lại mật khẩu.'},
            status=status.HTTP_200_OK,
        )


class PasswordResetConfirmSerializer(serializers.Serializer):
    token = serializers.CharField()
    new_password = serializers.CharField(min_length=8, write_only=True)
    new_password_confirm = serializers.CharField(write_only=True)

    def validate(self, data):
        if data['new_password'] != data['new_password_confirm']:
            raise serializers.ValidationError({'new_password_confirm': 'Mật khẩu xác nhận không khớp.'})
        return data


class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'auth_password_reset_confirm'

    def post(self, request, *args, **kwargs):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        token = serializer.validated_data['token']
        new_password = serializer.validated_data['new_password']

        try:
            user = resolve_password_reset_token(token)
        except (KeyError, signing.BadSignature, User.DoesNotExist):
            logger.warning('password_reset_confirm.invalid_token ip=%s', _request_ip(request))
            raise ValidationError({'token': 'Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.'})

        validate_password(new_password, user=user)
        user.set_password(new_password)
        user.save(update_fields=['password'])
        logger.info('password_reset_confirm.success user_id=%s ip=%s', user.id, _request_ip(request))

        return Response(
            {'message': 'Đặt lại mật khẩu thành công. Bạn đã có thể đăng nhập bằng mật khẩu mới.'},
            status=status.HTTP_200_OK,
        )


class GoogleOAuthSerializer(serializers.Serializer):
    access_token = serializers.CharField(required=True, allow_blank=False)


class GoogleOAuthView(APIView):
    permission_classes = [AllowAny]

    def _generate_username(self, email: str) -> str:
        base = (email.split('@', 1)[0] or 'google_user').strip().lower()
        normalized = ''.join(ch if ch.isalnum() or ch == '_' else '_' for ch in base)
        normalized = normalized.strip('_') or 'google_user'
        normalized = normalized[:24]

        candidate = normalized
        suffix = 1
        while User.objects.filter(username=candidate).exists():
            suffix_token = f'_{suffix}'
            candidate = f"{normalized[: max(1, 30 - len(suffix_token))]}{suffix_token}"
            suffix += 1
        return candidate

    def post(self, request, *args, **kwargs):
        serializer = GoogleOAuthSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        access_token = serializer.validated_data['access_token'].strip()
        try:
            email = fetch_google_user_email(access_token=access_token)
        except Exception as exc:
            raise ValidationError({'access_token': f'Không thể xác thực Google access token: {exc}'})

        if not email:
            raise ValidationError({'access_token': 'Google access token không trả về email hợp lệ.'})

        created = False
        with transaction.atomic():
            user = User.objects.filter(email__iexact=email).first()
            if user is None:
                username = self._generate_username(email)
                user = User.objects.create_user(
                    username=username,
                    email=email,
                    password=User.objects.make_random_password(),
                )
                created = True
            else:
                # Security: block auto-link if existing user was NOT originally a Google OAuth user.
                # This prevents account takeover via email collision.
                cfg_existing = UserConfig.objects.filter(user=user).first()
                if cfg_existing and cfg_existing.oauth_provider != 'google':
                    logger.warning(
                        'google_oauth.blocked_auto_link user_id=%s email=%s existing_provider=%s ip=%s',
                        user.id, email, cfg_existing.oauth_provider or 'password', _request_ip(request),
                    )
                    raise ValidationError({
                        'access_token': (
                            'Email này đã được đăng ký bằng mật khẩu. '
                            'Vui lòng đăng nhập bằng mật khẩu, sau đó liên kết Google trong cài đặt tài khoản.'
                        )
                    })

            cfg, _ = UserConfig.objects.get_or_create(user=user)
            if cfg.oauth_provider != 'google' or not cfg.oauth_uid:
                cfg.oauth_provider = 'google'
                cfg.oauth_uid = email

            # Google OAuth account is treated as verified by identity provider.
            if not cfg.email_verified:
                cfg.email_verified = True
                cfg.email_verified_at = timezone.now()
                cfg.email_verification_sent_at = None

            cfg.save(
                update_fields=[
                    'oauth_provider',
                    'oauth_uid',
                    'email_verified',
                    'email_verified_at',
                    'email_verification_sent_at',
                    'updated_at',
                ]
            )

            if created and getattr(settings, 'ONBOARDING_TRIAL_APPLY_ON_SIGNUP', True):
                try:
                    apply_onboarding_trial_for_new_user(user=user, signup_method='google_oauth')
                    cfg.refresh_from_db()
                except Exception:
                    logger.exception('Failed to apply onboarding trial for Google OAuth user_id=%s', user.id)

            if created and should_provision_starter_portfolios_for_user(user=user):
                try:
                    provision_starter_portfolios_for_user(user=user)
                except Exception:
                    logger.exception('Failed to provision starter portfolios for Google OAuth user_id=%s', user.id)

        refresh = RefreshToken.for_user(user)
        return Response(
            {
                'username': user.username,
                'email': user.email,
                'plan': _get_plan(user),
                'created': created,
                'access': str(refresh.access_token),
                'refresh': str(refresh),
            },
            status=status.HTTP_200_OK,
        )

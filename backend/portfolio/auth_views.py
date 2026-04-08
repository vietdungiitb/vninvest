"""Auth views for registration, verification, login gating, and /api/auth/me."""
import logging

from django.conf import settings
from django.core import signing
from django.db import transaction
from django.utils import timezone
from django.contrib.auth.models import User
from rest_framework.generics import RetrieveAPIView, CreateAPIView
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import serializers, status
from rest_framework.exceptions import APIException, AuthenticationFailed, ValidationError
from rest_framework.views import APIView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from .email_verification import resolve_email_verification_token, send_verification_email
from .google_oauth_service import fetch_google_user_email
from .models import UserConfig
from .onboarding_trial_service import apply_onboarding_trial_for_new_user
from .permissions import _get_plan, resolve_user_entitlements


logger = logging.getLogger(__name__)


class EmailDeliveryFailed(APIException):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_detail = 'Khong the gui email xac thuc tai thoi diem nay.'
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
        cfg = getattr(user, 'user_config', None)
        entitlements = resolve_user_entitlements(user)
        plan = entitlements['plan']

        return Response({
            'id': user.id,
            'username': user.username,
            'email': user.email,
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
        if not user_config.email_verified:
            raise AuthenticationFailed('Tai khoan chua xac thuc email. Vui long kiem tra email va kich hoat tai khoan truoc khi dang nhap.')
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
        response_message = 'Dang ky thanh cong. Vui long kiem tra email de xac thuc tai khoan truoc khi dang nhap.'

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

            try:
                send_verification_email(user)
                user_config.email_verified = False
                user_config.email_verification_sent_at = timezone.now()
                user_config.email_verified_at = None
            except Exception as exc:
                if settings.DEBUG:
                    # Dev fallback: tránh kẹt luồng đăng ký khi chưa cấu hình SMTP.
                    user_config.email_verified = True
                    user_config.email_verification_sent_at = None
                    user_config.email_verified_at = timezone.now()
                    verification_required = False
                    response_message = (
                        'Dang ky thanh cong (DEV mode). He thong chua gui duoc email xac thuc '
                        'nen tai khoan da duoc kich hoat tam thoi.'
                    )
                else:
                    raise EmailDeliveryFailed(detail=f'Khong the gui email xac thuc: {exc}') from exc

            user_config.save(update_fields=['email_verified', 'email_verification_sent_at', 'email_verified_at', 'updated_at'])

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
            raise ValidationError({'token': 'Link xac thuc khong hop le hoac da het han.'})

        user_config, _ = UserConfig.objects.get_or_create(user=user)
        if not user_config.email_verified:
            user_config.email_verified = True
            user_config.email_verified_at = timezone.now()
            user_config.save(update_fields=['email_verified', 'email_verified_at', 'updated_at'])

        return Response(
            {
                'username': user.username,
                'message': 'Xac thuc email thanh cong. Ban da co the dang nhap vao he thong.',
            },
            status=status.HTTP_200_OK,
        )


class ResendVerificationSerializer(serializers.Serializer):
    identifier = serializers.CharField()


class ResendVerificationEmailView(APIView):
    permission_classes = [AllowAny]

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
                    raise EmailDeliveryFailed(detail=f'Khong the gui lai email xac thuc: {exc}') from exc

        return Response(
            {'message': 'Neu tai khoan ton tai va chua xac thuc, he thong da gui lai email xac thuc.'},
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
            raise ValidationError({'access_token': f'Khong the xac thuc Google access token: {exc}'})

        if not email:
            raise ValidationError({'access_token': 'Google access token khong tra ve email hop le.'})

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

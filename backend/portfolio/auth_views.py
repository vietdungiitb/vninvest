"""
portfolio/auth_views.py
View /api/auth/me — trả về user info + CASL abilities theo plan.
View /api/auth/register — đăng ký tài khoản mới (username/password).
"""
from django.contrib.auth.models import User
from rest_framework.generics import RetrieveAPIView, CreateAPIView
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import serializers, status

from .permissions import _get_plan, build_abilities


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
        plan = _get_plan(user)

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
            'abilities': build_abilities(plan),
        })


# ---------- /api/auth/register ----------

class RegisterSerializer(serializers.Serializer):
    username = serializers.RegexField(
        regex=r'^[a-zA-Z0-9_]{3,30}$',
        error_messages={'invalid': 'Username chỉ chứa chữ, số, gạch chân, 3-30 ký tự.'},
    )
    email = serializers.EmailField(required=False, allow_blank=True, default='')
    password = serializers.CharField(min_length=8, write_only=True)
    password_confirm = serializers.CharField(write_only=True)

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError('Tên đăng nhập đã tồn tại.')
        return value

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
        # Tự động tạo UserConfig với plan=free
        from .models import UserConfig
        UserConfig.objects.get_or_create(user=user)
        return user


class RegisterView(CreateAPIView):
    """
    POST /api/auth/register/
    Đăng ký tài khoản mới. Trả về 201 + {username, plan} khi thành công.
    """
    permission_classes = [AllowAny]
    serializer_class = RegisterSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(
            {'username': user.username, 'plan': 'free', 'message': 'Đăng ký thành công.'},
            status=status.HTTP_201_CREATED,
        )

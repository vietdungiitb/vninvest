import logging
from django.contrib.auth import get_user_model
from django.conf import settings
from django.core.cache import cache
from rest_framework import status
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework import permissions
from rest_framework.response import Response

from ..models import PasswordResetToken
from vninvest_core.exceptions import (
    ValidationErrorException,
    RateLimitErrorException,
)
from data_ingest.tasks import send_password_reset_email

logger = logging.getLogger(__name__)
User = get_user_model()


@api_view(['POST'])
@authentication_classes([])
@permission_classes([permissions.AllowAny])
def password_reset_request_view(request):
    """
    SFI-B2.4a: POST /api/auth/password-reset/
    Body: { "email": "..." }
    Sends password reset link to email (if account exists).
    
    C1 Fix: Uses PasswordResetToken model (DB-backed) instead of in-memory store.
    Tokens now persist across application restarts.
    B1 Fix: Rate limited to 3 requests per minute per EMAIL (per Checklist H2, OWASP A01 enumeration protection).
    """
    email = str(request.data.get('email', '') or '').strip().lower()
    if not email:
        return Response({'detail': 'email is required.'}, status=status.HTTP_400_BAD_REQUEST)
    
    # Rate limit per email (3 requests per minute per email address)
    cache_key = f'ratelimit:password-reset-email:{email}'
    count = cache.get(cache_key, 0)
    if count >= 3:
        raise RateLimitErrorException(
            detail='Too many password reset requests for this email address. Please try again in 1 minute.',
            code='password_reset_rate_limit_exceeded',
        )
    cache.set(cache_key, count + 1, 60)

    # Always return 200 to avoid user enumeration (OWASP A01).
    user = User.objects.filter(email=email, is_active=True).first()
    if user:
        # Generate and save token in DB (survives restart)
        token_obj, raw_token = PasswordResetToken.generate_and_save(email=email, hours=1)
        
        # C4 Fix: Use validated FRONTEND_URL from settings (required in production)
        # Send email asynchronously via Celery (C3 fix)
        send_password_reset_email.delay(email=email, token=raw_token, frontend_url=settings.FRONTEND_URL)

    return Response(
        {'detail': 'Nếu email tồn tại trong hệ thống, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu.'},
        status=status.HTTP_200_OK,
    )


@api_view(['POST'])
@authentication_classes([])
@permission_classes([permissions.AllowAny])
def password_reset_confirm_view(request):
    """
    SFI-B2.4b: POST /api/auth/password-reset/confirm/
    Body: { "token": "...", "password": "..." }
    Sets new password for user identified by token.
    
    C1 Fix: Uses PasswordResetToken model to verify token and mark as used.
    A4-A5 Fix: Uses standard error envelope via exceptions.
    """
    token = str(request.data.get('token', '') or '').strip()
    new_password = str(request.data.get('password', '') or '')

    if not token or not new_password:
        raise ValidationErrorException(
            detail='token and password are required.',
        )

    if len(new_password) < 8:
        raise ValidationErrorException(
            detail='Password phải có ít nhất 8 ký tự.',
        )

    # Verify token from DB and mark as used
    try:
        reset_token = PasswordResetToken.verify_and_mark_used(token)
    except ValueError as e:
        raise ValidationErrorException(
            detail=str(e),
        )

    # Find user by email from the reset token
    try:
        user = User.objects.get(email=reset_token.email, is_active=True)
    except User.DoesNotExist:
        raise ValidationErrorException(
            detail='Tài khoản không tồn tại hoặc bị vô hiệu hóa.',
        )

    user.set_password(new_password)
    user.save(update_fields=['password', 'updated_at'] if hasattr(user, 'updated_at') else ['password'])

    return Response({'detail': 'Mật khẩu đã được đặt lại thành công.'}, status=status.HTTP_200_OK)

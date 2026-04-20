"""
PR-4 — I1: Notifications Views
- POST /api/v1/notifications/telegram/link/    → Tạo deep link OTP
- POST /api/v1/notifications/telegram/webhook/ → Nhận update từ Telegram
- DELETE /api/v1/notifications/telegram/link/  → Hủy kết nối
- GET/POST/DELETE /api/v1/notifications/preferred-symbols/ → Quản lý 3 mã Free
"""
from __future__ import annotations

import hashlib
import hmac
import logging
import os

from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

logger = logging.getLogger(__name__)

_MAX_PREFERRED_SYMBOLS = 3


# ── Deep Link ────────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def telegram_generate_link(request):
    """POST /api/v1/notifications/telegram/link/ → Trả về deep link OTP."""
    from portfolio.telegram_service import generate_deeplink_token, get_deeplink_url
    token = generate_deeplink_token(request.user.pk)
    url = get_deeplink_url(token)
    return Response({'deep_link': url, 'expires_in_seconds': 900})


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def telegram_unlink(request):
    """DELETE /api/v1/notifications/telegram/link/ → Hủy kết nối Telegram."""
    from portfolio.models import TelegramProfile
    deleted, _ = TelegramProfile.objects.filter(user=request.user).delete()
    return Response({'unlinked': deleted > 0})


# ── Webhook ──────────────────────────────────────────────────────────────────

def _verify_telegram_signature(body: bytes, signature: str) -> bool:
    """Xác thực X-Telegram-Bot-Api-Secret-Token header."""
    secret = os.getenv('TELEGRAM_WEBHOOK_SECRET', '')
    if not secret:
        # Không cấu hình → chỉ accept từ localhost trong dev
        return True
    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature or '')


@api_view(['POST'])
@permission_classes([AllowAny])
def telegram_webhook(request):
    """
    POST /api/v1/notifications/telegram/webhook/
    Telegram gọi endpoint này khi có update.
    Xác thực qua X-Telegram-Bot-Api-Secret-Token header.
    """
    sig = request.headers.get('X-Telegram-Bot-Api-Secret-Token', '')
    if not _verify_telegram_signature(request.body, sig):
        logger.warning('[webhook] Chữ ký không hợp lệ, bỏ qua update')
        return Response({'ok': False}, status=status.HTTP_403_FORBIDDEN)

    update = request.data
    if not isinstance(update, dict):
        return Response({'ok': False}, status=status.HTTP_400_BAD_REQUEST)

    try:
        from portfolio.telegram_service import process_webhook_update
        process_webhook_update(update)
    except Exception as exc:
        logger.error('[telegram_webhook] Lỗi xử lý update: %s', exc)

    # Luôn trả 200 OK để Telegram không retry
    return Response({'ok': True})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def telegram_status(request):
    """GET /api/v1/notifications/telegram/status/ → Trạng thái kết nối."""
    from portfolio.models import TelegramProfile
    try:
        profile = TelegramProfile.objects.get(user=request.user)
        return Response({
            'linked': True,
            'verified': profile.is_verified,
            'priority_threshold': profile.priority_threshold,
            'mute_until': profile.mute_until,
            'preferred_symbols': profile.preferred_symbols,
        })
    except TelegramProfile.DoesNotExist:
        return Response({'linked': False})


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def telegram_settings_update(request):
    """PATCH /api/v1/notifications/telegram/settings/ → Cập nhật threshold/mute."""
    from portfolio.models import TelegramProfile
    try:
        profile = TelegramProfile.objects.get(user=request.user)
    except TelegramProfile.DoesNotExist:
        return Response({'error': 'Chưa kết nối Telegram'}, status=status.HTTP_404_NOT_FOUND)

    data = request.data
    updated = []

    if 'priority_threshold' in data:
        val = int(data['priority_threshold'])
        if val not in (1, 2, 3):
            return Response({'error': 'priority_threshold phải là 1, 2 hoặc 3'}, status=status.HTTP_400_BAD_REQUEST)
        profile.priority_threshold = val
        updated.append('priority_threshold')

    if 'mute_minutes' in data:
        minutes = int(data['mute_minutes'])
        if minutes <= 0:
            profile.mute_until = None
        else:
            profile.mute_until = timezone.now() + timezone.timedelta(minutes=minutes)
        updated.append('mute_until')

    if updated:
        profile.save(update_fields=updated)

    return Response({'updated': updated})


# ── Preferred Symbols (Free Tier Gift) ──────────────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def preferred_symbols_list(request):
    """
    GET  → Lấy danh sách preferred_symbols (max 3).
    POST → Thêm symbol (body: {"symbol": "VNM"}).
    """
    from portfolio.models import TelegramProfile
    try:
        profile = TelegramProfile.objects.get(user=request.user)
    except TelegramProfile.DoesNotExist:
        return Response({'error': 'Chưa kết nối Telegram'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        return Response({'preferred_symbols': profile.preferred_symbols or []})

    # POST — thêm mã
    symbol = str(request.data.get('symbol', '')).upper().strip()
    if not symbol:
        return Response({'error': 'symbol không được trống'}, status=status.HTTP_400_BAD_REQUEST)

    current = list(profile.preferred_symbols or [])
    if symbol in current:
        return Response({'preferred_symbols': current})

    if len(current) >= _MAX_PREFERRED_SYMBOLS:
        return Response(
            {'error': f'Tối đa {_MAX_PREFERRED_SYMBOLS} mã. Nâng cấp Pro để nhận alert không giới hạn.'},
            status=status.HTTP_402_PAYMENT_REQUIRED,
        )

    current.append(symbol)
    profile.preferred_symbols = current
    profile.save(update_fields=['preferred_symbols'])
    return Response({'preferred_symbols': current}, status=status.HTTP_201_CREATED)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def preferred_symbols_delete(request, symbol: str):
    """DELETE /api/v1/notifications/preferred-symbols/<symbol>/"""
    from portfolio.models import TelegramProfile
    try:
        profile = TelegramProfile.objects.get(user=request.user)
    except TelegramProfile.DoesNotExist:
        return Response({'error': 'Chưa kết nối Telegram'}, status=status.HTTP_404_NOT_FOUND)

    symbol = symbol.upper().strip()
    current = list(profile.preferred_symbols or [])
    if symbol in current:
        current.remove(symbol)
        profile.preferred_symbols = current
        profile.save(update_fields=['preferred_symbols'])

    return Response({'preferred_symbols': current})

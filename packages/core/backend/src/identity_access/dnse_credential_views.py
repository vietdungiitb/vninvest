"""
CRUD views cho UserDNSECredential (D02 — DNSE Backfill).

Endpoints:
  GET  /core/v1/dnse-credential/        — lấy credential hiện tại của user (không trả về giá trị thực)
  POST /core/v1/dnse-credential/        — tạo hoặc cập nhật credential
  DELETE /core/v1/dnse-credential/      — xoá credential

Hard rules (AGENTS.md §14):
  - Không bao giờ trả về api_key / api_secret trong response.
  - is_system_provider=True chỉ admin (is_staff) được set.
  - Fernet key bắt buộc tồn tại.
"""
import logging

from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import UserDNSECredential, _encrypt_credential
from .permissions import require_human_session

logger = logging.getLogger(__name__)


class DNSECredentialView(APIView):
    """
    GET  — trả về metadata (không có api_key/secret).
    POST — tạo hoặc cập nhật.
    DELETE — xoá.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        require_human_session(request)
        try:
            cred = UserDNSECredential.objects.get(user=request.user)
        except UserDNSECredential.DoesNotExist:
            return Response({'detail': 'Chưa cấu hình DNSE credential.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(_safe_serialize(cred))

    def post(self, request):
        require_human_session(request)
        api_key = str(request.data.get('api_key') or '').strip()
        api_secret = str(request.data.get('api_secret') or '').strip()
        is_system = bool(request.data.get('is_system_provider', False))

        if not api_key or not api_secret:
            return Response(
                {'detail': 'api_key và api_secret là bắt buộc.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Hard rule §14.6: chỉ admin mới set is_system_provider
        if is_system and not request.user.is_staff:
            return Response(
                {'detail': 'Chỉ admin mới được đặt is_system_provider=true.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            cred, created = UserDNSECredential.objects.get_or_create(
                user=request.user,
                defaults={'api_key_encrypted': b'', 'api_secret_encrypted': b''},
            )
            cred.set_credentials(api_key, api_secret)
            if request.user.is_staff:
                cred.is_system_provider = is_system
            cred.is_verified = False
            cred.last_verified_at = None
            cred.save()
        except RuntimeError as exc:
            # Thiếu DNSE_CREDENTIAL_FERNET_KEY
            logger.error('DNSECredentialView POST: Fernet key error: %s', exc)
            return Response(
                {'detail': 'Lỗi cấu hình mã hoá phía server. Liên hệ admin.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            _safe_serialize(cred),
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    def delete(self, request):
        require_human_session(request)
        deleted, _ = UserDNSECredential.objects.filter(user=request.user).delete()
        if deleted:
            return Response({'detail': 'DNSE credential đã được xoá.'}, status=status.HTTP_204_NO_CONTENT)
        return Response({'detail': 'Không tìm thấy credential.'}, status=status.HTTP_404_NOT_FOUND)


def _safe_serialize(cred: UserDNSECredential) -> dict:
    """Trả về metadata, KHÔNG bao gồm api_key / api_secret."""
    return {
        'user_id': cred.user_id,
        'username': cred.user.username,
        'is_system_provider': cred.is_system_provider,
        'is_verified': cred.is_verified,
        'last_verified_at': cred.last_verified_at.isoformat() if cred.last_verified_at else None,
        'created_at': cred.created_at.isoformat(),
        'updated_at': cred.updated_at.isoformat(),
    }

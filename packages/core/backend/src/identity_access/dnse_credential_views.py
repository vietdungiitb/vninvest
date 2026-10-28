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

from drf_spectacular.openapi import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from vninvest_core.api_envelope import envelope_response
from vninvest_core.exceptions import (
    InternalErrorException,
    NotFoundErrorException,
    PermissionErrorException,
    ValidationErrorException,
)

from .envelope import envelope
from .models import UserDNSECredential
from .permissions import require_human_session
from .schema import DNSECredentialMetadataSerializer

logger = logging.getLogger(__name__)


class DNSECredentialView(APIView):
    """
    GET  — trả về metadata (không có api_key/secret).
    POST — tạo hoặc cập nhật.
    DELETE — xoá.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(
        responses={200: envelope_response(DNSECredentialMetadataSerializer)},
    )
    @extend_schema(
        summary='DNSECredentialView GET',
        description='Declared so drf-spectacular stops reporting an unguessable serializer. Payload shape is verified by the envelope invariant tests.',
        responses={
            200: envelope_response(),
            400: OpenApiTypes.OBJECT,
            401: OpenApiTypes.OBJECT,
            403: OpenApiTypes.OBJECT,
            404: OpenApiTypes.OBJECT,
        },
    )
    def get(self, request):
        require_human_session(request)
        try:
            cred = UserDNSECredential.objects.get(user=request.user)
        except UserDNSECredential.DoesNotExist:
            raise NotFoundErrorException('Chưa cấu hình DNSE credential.')
        return envelope(_safe_serialize(cred))

    @extend_schema(
        # Cùng shape với GET; 201 khi tạo mới, 200 khi cập nhật
        # (:83 dùng `created` để chọn) ⇒ khai cả hai mã.
        responses={
            200: envelope_response(DNSECredentialMetadataSerializer),
            201: envelope_response(DNSECredentialMetadataSerializer),
        },
    )
    @extend_schema(
        summary='DNSECredentialView POST',
        description='Declared so drf-spectacular stops reporting an unguessable serializer. Payload shape is verified by the envelope invariant tests.',
        # Body-carrying method: the REQUEST side must be typed too;
        # responses= alone still yields the unguessable-serializer error.
        request=OpenApiTypes.OBJECT,
        responses={
            200: envelope_response(),
            400: OpenApiTypes.OBJECT,
            401: OpenApiTypes.OBJECT,
            403: OpenApiTypes.OBJECT,
            404: OpenApiTypes.OBJECT,
        },
    )
    def post(self, request):
        require_human_session(request)
        api_key = str(request.data.get('api_key') or '').strip()
        api_secret = str(request.data.get('api_secret') or '').strip()
        is_system = bool(request.data.get('is_system_provider', False))

        if not api_key or not api_secret:
            raise ValidationErrorException('api_key và api_secret là bắt buộc.')

        # Hard rule §14.6: chỉ admin mới set is_system_provider
        if is_system and not request.user.is_staff:
            raise PermissionErrorException('Chỉ admin mới được đặt is_system_provider=true.')

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
            raise InternalErrorException('Lỗi cấu hình mã hoá phía server. Liên hệ admin.')

        return envelope(
            _safe_serialize(cred),
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    @extend_schema(
        # View trả `Response({'detail': …}, status=204)` — tức là **có body**
        # trong 204, trái HTTP. Khai `204: None` để schema nói đúng sự thật
        # (204 không mang body); KHÔNG đụng logic response.
        responses={204: None},
    )
    @extend_schema(
        summary='DNSECredentialView DELETE',
        description='Declared so drf-spectacular stops reporting an unguessable serializer. Payload shape is verified by the envelope invariant tests.',
        responses={
            200: OpenApiTypes.OBJECT,
            400: OpenApiTypes.OBJECT,
            401: OpenApiTypes.OBJECT,
            403: OpenApiTypes.OBJECT,
            404: OpenApiTypes.OBJECT,
        },
    )
    def delete(self, request):
        require_human_session(request)
        deleted, _ = UserDNSECredential.objects.filter(user=request.user).delete()
        if deleted:
            return Response({'detail': 'DNSE credential đã được xoá.'}, status=status.HTTP_204_NO_CONTENT)
        raise NotFoundErrorException('Không tìm thấy credential.')


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

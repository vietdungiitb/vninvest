"""
views_dnse.py — API Views cho tích hợp DNSE LightSpeed API trong SaaS Core.

Auth flow chuẩn:
  POST /v2/authentication/token với client_id + client_secret (LightSpeed API)
  KHÔNG dùng username/password tài khoản cá nhân.
"""
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone

from .models import DNSECredential, SubAccount
from .serializers import SubAccountSerializer
from .tasks import sync_dnse_accounts_task


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def dnse_config_api(request):
    """
    GET: Lấy trạng thái cấu hình DNSE LightSpeed API hiện tại của user.
    POST: Cập nhật Client ID và Client Secret.

    Lưu ý: chỉ nhận client_id và client_secret (LightSpeed API credentials),
    không nhận username/password tài khoản cá nhân DNSE.
    """
    user = request.user

    if request.method == 'GET':
        credential = DNSECredential.objects.filter(user=user).first()
        if not credential or not credential.has_credentials():
            return Response({
                "is_configured": False,
                "message": "Chưa cấu hình DNSE LightSpeed API. Vui lòng cung cấp Client ID và Client Secret.",
            })
        client_id_preview = ""
        raw_id = credential.get_client_id()
        if raw_id:
            client_id_preview = raw_id[:4] + "****"
        return Response({
            "is_configured": True,
            "data": {
                "client_id_preview": client_id_preview,
                "is_active": credential.is_active,
                "last_sync_at": credential.last_sync_at,
            },
        })

    # POST
    data = request.data
    client_id = str(data.get('client_id', '')).strip()
    client_secret = str(data.get('client_secret', '')).strip()

    if not client_id or not client_secret:
        return Response({
            "ok": False,
            "error": "Yêu cầu cung cấp client_id và client_secret từ trang quản lý DNSE LightSpeed API.",
        }, status=status.HTTP_400_BAD_REQUEST)

    credential, _ = DNSECredential.objects.get_or_create(user=user)
    credential.set_client_id(client_id)
    credential.set_client_secret(client_secret)
    credential.is_active = bool(data.get('is_active', True))
    credential.save()

    return Response({
        "ok": True,
        "message": "Cập nhật DNSE LightSpeed credential thành công.",
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def dnse_sync_accounts_api(request):
    """
    Kích hoạt tác vụ đồng bộ tiểu khoản từ DNSE LightSpeed API.
    """
    user = request.user
    credential = DNSECredential.objects.filter(user=user, is_active=True).first()
    if not credential or not credential.has_credentials():
        return Response({
            "ok": False,
            "error": "DNSE LightSpeed credential chưa được thiết lập. Cấu hình Client ID và Client Secret trước.",
        }, status=status.HTTP_400_BAD_REQUEST)

    result = sync_dnse_accounts_task(user.id)

    if result.get("ok"):
        sub_accounts = SubAccount.objects.filter(user=user, broker_source='DNSE')
        serializer = SubAccountSerializer(sub_accounts, many=True)
        return Response({
            "ok": True,
            "synced_count": result.get("synced_count", 0),
            "accounts": serializer.data,
        })
    return Response({
        "ok": False,
        "error": result.get("error", "Đồng bộ thất bại."),
    }, status=status.HTTP_502_BAD_GATEWAY)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def dnse_place_order_api(request):
    """
    Đặt lệnh giao dịch qua DNSE LightSpeed API.
    Chưa triển khai — trả 501 để tránh giả vờ thành công.
    """
    return Response({
        "ok": False,
        "error": "Tính năng đặt lệnh DNSE chưa được triển khai. Liên hệ quản trị viên.",
    }, status=status.HTTP_501_NOT_IMPLEMENTED)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dnse_token_status_api(request):
    """
    Kiểm tra trạng thái phiên giao dịch DNSE LightSpeed API.
    """
    user = request.user
    credential = DNSECredential.objects.filter(user=user, is_active=True).first()
    if not credential or not credential.has_credentials():
        return Response({
            "ok": False,
            "is_configured": False,
            "message": "DNSE LightSpeed credential chưa được cấu hình.",
        })
    return Response({
        "ok": True,
        "is_configured": True,
        "is_active": credential.is_active,
        "last_sync_at": credential.last_sync_at,
        "broker": "DNSE",
        "auth_method": "LightSpeed_OAuth2",
    })

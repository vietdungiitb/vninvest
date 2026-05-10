"""
views_dnse.py — API Views cho tích hợp DNSE Broker trong SaaS Core.
"""
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone

from .models import DNSECredential, SubAccount
from .serializers import SubAccountSerializer
# Note: DNSECredentialSerializer will be added to serializers.py
from .tasks import sync_dnse_accounts_task

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def dnse_config_api(request):
    """
    GET: Lấy trạng thái cấu hình DNSE hiện tại của user.
    POST: Cập nhật cấu hình DNSE.
    """
    user = request.user
    
    if request.method == 'GET':
        credential = DNSECredential.objects.filter(user=user).first()
        if not credential:
            return Response({
                "is_configured": False,
                "message": "Chưa cấu hình kết nối DNSE."
            })
        
        return Response({
            "is_configured": True,
            "data": {
                "username": credential.get_username()[:3] + "****" if credential.username_cipher else "",
                "is_active": credential.is_active,
                "last_sync_at": credential.last_sync_at
            }
        })

    elif request.method == 'POST':
        data = request.data
        credential, created = DNSECredential.objects.get_or_create(user=user)
        
        if 'username' in data:
            credential.set_username(data['username'])
        if 'password' in data:
            credential.set_password(data['password'])
        if 'api_key' in data:
            credential.set_api_key(data['api_key'])
        if 'api_secret' in data:
            credential.set_api_secret(data['api_secret'])
            
        credential.is_active = data.get('is_active', True)
        credential.save()
        
        return Response({
            "ok": True,
            "message": "Cập nhật cấu hình DNSE thành công (Core).",
        })

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def dnse_sync_accounts_api(request):
    """
    Kích hoạt tác vụ đồng bộ tiểu khoản từ DNSE.
    """
    user = request.user
    credential = DNSECredential.objects.filter(user=user, is_active=True).first()
    if not credential:
        return Response({
            "ok": False,
            "error": "DNSE Credential chưa được thiết lập."
        }, status=status.HTTP_400_BAD_REQUEST)

    result = sync_dnse_accounts_task(user.id)
    
    if result["ok"]:
        sub_accounts = SubAccount.objects.filter(user=user, broker_source='DNSE')
        serializer = SubAccountSerializer(sub_accounts, many=True)
        return Response({
            "ok": True,
            "synced_count": result["synced_count"],
            "accounts": serializer.data
        })
    else:
        return Response({
            "ok": False,
            "error": result["error"]
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def dnse_place_order_api(request):
    """
    Đặt lệnh giao dịch qua DNSE (SaaS Core).
    """
    return Response({
        "ok": True,
        "message": "Cổng đặt lệnh DNSE (Core) đã được kết nối.",
        "order_id": "CORE_STUB_ORD_123"
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dnse_token_status_api(request):
    """
    Kiểm tra trạng thái phiên giao dịch (Trading Token).
    """
    return Response({
        "ok": True,
        "is_active": False,
        "next_step": "OTP_REQUIRED",
        "broker": "DNSE"
    })

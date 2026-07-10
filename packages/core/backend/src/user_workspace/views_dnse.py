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

from .dnse_adapter import (
    DNSEAdapterError,
    DNSECredentialMissingError,
    bootstrap_dnse_session,
)
from .models import DNSECredential, SubAccount
from .serializers import SubAccountSerializer
from .tasks import (
    reconcile_dnse_transactions_task,
    sync_dnse_accounts_task,
    sync_dnse_balances_task,
)
from vninvest_core.exceptions import ValidationErrorException, NotFoundErrorException


def _to_bool(value) -> bool:
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"1", "true", "yes", "y", "on"}


def _extract_trading_token(result):
    if isinstance(result, dict):
        token = result.get("trading_token") or result.get("token")
        if token:
            return str(token)
        data = result.get("data")
        if isinstance(data, dict):
            token = data.get("trading_token") or data.get("token")
            if token:
                return str(token)
    return ""


def _get_active_dnse_client(user):
    credential = DNSECredential.objects.filter(user=user, is_active=True).first()
    if not credential or not credential.has_credentials():
        raise DNSECredentialMissingError(
            "DNSE LightSpeed credential chưa được thiết lập. Cấu hình Client ID và Client Secret trước."
        )

    session = bootstrap_dnse_session(credential)
    client = session.get("session")
    if client is None:
        raise DNSEAdapterError("Không thể khởi tạo phiên DNSE LightSpeed API.")
    return client


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
def dnse_sync_balances_api(request):
    """
    Kích hoạt tác vụ đồng bộ số dư/NAV từ DNSE cho các tiểu khoản đã liên kết.
    """
    user = request.user
    credential = DNSECredential.objects.filter(user=user, is_active=True).first()
    if not credential or not credential.has_credentials():
        raise ValidationErrorException(
            detail="DNSE LightSpeed credential chưa được thiết lập. Cấu hình Client ID và Client Secret trước.",
            code="validation_error"
        )

    result = sync_dnse_balances_task(user.id)
    if result.get("ok"):
        return Response(result)

    raise ValidationErrorException(
        detail=result.get("error", "Đồng bộ số dư thất bại."),
        code="validation_error"
    )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def dnse_reconcile_transactions_api(request):
    """
    Kích hoạt đối soát giao dịch DNSE cho các tiểu khoản đã liên kết.
    """
    user = request.user
    credential = DNSECredential.objects.filter(user=user, is_active=True).first()
    if not credential or not credential.has_credentials():
        raise ValidationErrorException(
            detail="DNSE LightSpeed credential chưa được thiết lập. Cấu hình Client ID và Client Secret trước.",
            code="validation_error"
        )

    raw_days_back = request.data.get("days_back", 7)
    try:
        days_back = max(1, min(int(raw_days_back), 365))
    except (TypeError, ValueError):
        days_back = 7

    result = reconcile_dnse_transactions_task(user.id, days_back=days_back)
    if result.get("ok"):
        return Response(result)

    raise ValidationErrorException(
        detail=result.get("error", "Đối soát giao dịch thất bại."),
        code="validation_error"
    )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def dnse_place_order_api(request):
    """
    Đặt lệnh giao dịch qua DNSE LightSpeed API bằng trading token đã xác thực OTP.
    """
    user = request.user
    market_type = str(request.data.get("market_type", "STOCK")).strip().upper() or "STOCK"
    order_category = str(request.data.get("order_category", "NORMAL")).strip().upper() or "NORMAL"
    trading_token = str(request.data.get("trading_token", "")).strip()
    payload = request.data.get("payload")
    dry_run = _to_bool(request.data.get("dry_run", False))

    if not trading_token:
        raise ValidationErrorException(
            detail="Thiếu trading_token. Vui lòng gửi OTP và tạo trading token trước khi đặt lệnh.",
            code="validation_error"
        )

    if not isinstance(payload, dict) or not payload:
        raise ValidationErrorException(
            detail="Thiếu payload đặt lệnh hợp lệ.",
            code="validation_error"
        )

    try:
        client = _get_active_dnse_client(user)
        result = client.post_order(
            market_type=market_type,
            payload=payload,
            trading_token=trading_token,
            order_category=order_category,
            dry_run=dry_run,
            raw=False,
        )
        return Response({"result": result})
    except DNSECredentialMissingError as exc:
        raise ValidationErrorException(detail=str(exc), code="validation_error")
    except DNSEAdapterError as exc:
        raise ValidationErrorException(detail=str(exc), code="validation_error")
    except Exception as exc:
        raise ValidationErrorException(detail=f"Đặt lệnh DNSE thất bại: {exc}", code="validation_error")


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def dnse_send_email_otp_api(request):
    """
    Gửi OTP email cho flow giao dịch DNSE.
    """
    user = request.user
    dry_run = _to_bool(request.data.get("dry_run", False))

    try:
        client = _get_active_dnse_client(user)
        result = client.send_email_otp(dry_run=dry_run, raw=False)
        return Response({"result": result})
    except DNSECredentialMissingError as exc:
        raise ValidationErrorException(detail=str(exc), code="validation_error")
    except DNSEAdapterError as exc:
        raise ValidationErrorException(detail=str(exc), code="validation_error")
    except Exception as exc:
        raise ValidationErrorException(detail=f"Gửi OTP DNSE thất bại: {exc}", code="validation_error")


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def dnse_create_trading_token_api(request):
    """
    Tạo trading token bằng OTP/passcode để đặt/sửa/hủy lệnh DNSE.
    """
    user = request.user
    otp_type = str(request.data.get("otp_type", "EMAIL")).strip().upper() or "EMAIL"
    passcode = str(request.data.get("passcode", "")).strip()
    dry_run = _to_bool(request.data.get("dry_run", False))

    if not passcode:
        raise ValidationErrorException(
            detail="Thiếu passcode OTP từ DNSE.",
            code="validation_error"
        )

    try:
        client = _get_active_dnse_client(user)
        result = client.create_trading_token(
            otp_type=otp_type,
            passcode=passcode,
            dry_run=dry_run,
            raw=False,
        )
        trading_token = _extract_trading_token(result)
        return Response({
            "ok": True,
            "otp_type": otp_type,
            "trading_token": trading_token,
            "result": result,
        })
    except DNSECredentialMissingError as exc:
        return Response({"ok": False, "error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    except DNSEAdapterError as exc:
        raise ValidationErrorException(detail=str(exc), code="validation_error")
    except Exception as exc:
        raise ValidationErrorException(detail=f"Tạo trading token DNSE thất bại: {exc}", code="validation_error")


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
            "is_configured": False,
            "message": "DNSE LightSpeed credential chưa được cấu hình.",
        })
    return Response({
        "is_configured": True,
        "is_active": credential.is_active,
        "last_sync_at": credential.last_sync_at,
        "broker": "DNSE",
        "auth_method": "LightSpeed_OAuth2",
    })

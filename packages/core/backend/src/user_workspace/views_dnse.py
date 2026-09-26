"""
views_dnse.py — API Views cho tích hợp DNSE LightSpeed API trong SaaS Core.

Auth flow chuẩn:
  POST /v2/authentication/token với client_id + client_secret (LightSpeed API)
  KHÔNG dùng username/password tài khoản cá nhân.
"""
from rest_framework.decorators import (
    api_view,
    permission_classes,
    throttle_classes,
)
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework.throttling import ScopedRateThrottle
from django.utils import timezone

import logging
import traceback

logger = logging.getLogger(__name__)

from .dnse_adapter import (
    DNSEAdapterError,
    DNSECredentialMissingError,
    DNSEVnbrokerUnavailableError,
)
from .models import DNSECredential, SubAccount, get_user_broker_config, set_user_broker_secrets
from .serializers import SubAccountSerializer
from .tasks import (
    reconcile_dnse_transactions_task,
    sync_dnse_accounts_task,
    sync_dnse_balances_task,
)
from vninvest_core.exceptions import (
    InternalErrorException,
    NotFoundErrorException,
    ValidationErrorException,
)

#: side hợp lệ — `UNKNOWN` bị từ chối để luồng fail-closed ở BE cũng áp dụng.
_ALLOWED_SIDES = ('BUY', 'SELL')
#: lô tối thiểu cho cổ phiếu Việt Nam
_MIN_LOT = 100
#: X.3 — `market_type` chỉ nhận giá trị sản phẩm thật sự dùng. Trước đây không
#: allowlist nên `FUND` đi thẳng xuống broker VÀ né được guard lô 100 (guard chỉ
#: chạy khi `market_type == 'STOCK'`). Thêm loại mới ⇒ thêm ở đây + validate riêng.
_ALLOWED_MARKET_TYPES = ('STOCK',)
#: X.4 — `order_category` trước đây nhận và truyền thẳng xuống broker, không validate.
_ALLOWED_ORDER_CATEGORIES = ('NORMAL',)
#: X.1 — hai caller FE (`DNSEConnectionPanel.js:216`, `AdvisoryOrderTicket.js:51`)
#: đều gửi `quantity`; validator cũ chỉ đọc `volume` nên `int(None)` → TypeError →
#: "Khối lượng phải là số nguyên." ⇒ mọi lệnh từ UI trả 400.
#: `volume` là key chuẩn của BE; `quantity` là alias được chấp nhận.
_VOLUME_KEY = 'volume'
_VOLUME_ALIASES = ('quantity',)


def _require_allowlisted(raw, allowed, default, code: str, label: str) -> str:
    """Chuẩn hoá + kiểm allowlist. Sai ⇒ 400 với `code` riêng, không phải 400 chung chung."""
    if raw is None:
        return default
    value = str(raw).strip().upper()
    if not value:
        return default
    if value not in allowed:
        raise ValidationErrorException(
            detail=(
                f"{label} không hợp lệ: '{value}'. "
                f"Chỉ chấp nhận: {', '.join(allowed)}."
            ),
            code=code,
        )
    return value


def _read_volume(payload: dict) -> int:
    """Đọc khối lượng từ `volume` HOẶC alias `quantity`, rồi trả về số nguyên đã kiểm.

    Nếu client gửi cả hai mà lệch nhau ⇒ từ chối, vì lúc đó không biết broker sẽ
    đọc giá trị nào — đó chính là lớp TOCTOU mà X.6 nói.
    """
    present = {
        key: payload.get(key)
        for key in (_VOLUME_KEY, *_VOLUME_ALIASES)
        if payload.get(key) is not None and str(payload.get(key)).strip() != ''
    }
    if not present:
        raise ValidationErrorException(
            detail=(
                "Thiếu khối lượng đặt lệnh. "
                f"Gửi '{_VOLUME_KEY}'"
                + (f" hoặc '{_VOLUME_ALIASES[0]}'." if _VOLUME_ALIASES else ".")
            ),
            code="order_volume_missing",
        )
    if len(present) > 1:
        coerced = {}
        for key, raw in present.items():
            try:
                coerced[key] = int(raw)
            except (TypeError, ValueError):
                raise ValidationErrorException(
                    detail="Khối lượng phải là số nguyên.", code="validation_error",
                )
        if len(set(coerced.values())) > 1:
            raise ValidationErrorException(
                detail=(
                    f"Khối lượng mâu thuẫn: "
                    + ", ".join(f"{k}={v}" for k, v in sorted(coerced.items()))
                    + ". Gửi một giá trị duy nhất."
                ),
                code="order_volume_conflict",
            )
        return next(iter(coerced.values()))
    raw = next(iter(present.values()))
    try:
        return int(raw)
    except (TypeError, ValueError):
        raise ValidationErrorException(
            detail="Khối lượng phải là số nguyên.", code="validation_error",
        )


def _normalize_order_payload(payload: dict, market_type: str) -> dict:
    """Validate đơn đặt lệnh ở server, không tin UI, rồi TRẢ VỀ bản đã chuẩn hoá.

    X.6 — bản trả về chính là bản được truyền xuống broker. Trước đây validator
    đọc bản `symbol` đã `.upper()` còn `dnse_place_order_api` vẫn execute
    `payload` gốc ⇒ giá trị kiểm ≠ giá trị thực thi.

    Chặn:
    - thiếu `symbol`, hoặc symbol không phải mã cổ phiếu hợp lệ
    - thiếu `side`, hoặc side ngoài BUY/SELL
    - thiếu khối lượng, khối lượng không phải số nguyên dương, mâu thuẫn giữa
      `volume`/`quantity`, hoặc (với STOCK) không tròn 100
    - `price` âm
    """
    normalized = dict(payload)

    symbol = str(payload.get('symbol') or '').strip().upper()
    if not symbol:
        raise ValidationErrorException(
            detail="Thiếu mã chứng khoán trong payload đặt lệnh.", code="validation_error",
        )
    if not symbol.isalnum() or not (2 <= len(symbol) <= 10):
        raise ValidationErrorException(
            detail=f"Mã chứng khoán không hợp lệ: {symbol}.", code="validation_error",
        )
    normalized['symbol'] = symbol

    side = str(payload.get('side') or '').strip().upper()
    if side not in _ALLOWED_SIDES:
        raise ValidationErrorException(
            detail=(
                f"Chiều lệnh không hợp lệ: '{side or 'trống'}'. "
                "Chỉ chấp nhận BUY hoặc SELL."
            ),
            code="validation_error",
        )
    normalized['side'] = side

    volume = _read_volume(payload)
    if volume <= 0:
        raise ValidationErrorException(
            detail="Khối lượng phải lớn hơn 0.", code="validation_error",
        )
    if market_type == 'STOCK' and volume % _MIN_LOT != 0:
        raise ValidationErrorException(
            detail=f"Khối lượng cổ phiếu phải là bội số của {_MIN_LOT}.", code="validation_error",
        )
    # Ghi giá trị ĐÃ kiểm vào MỌI key khối lượng client gửi, và luôn có key chuẩn
    # `volume` để broker không đọc nhầm giá trị thô.
    for key in (_VOLUME_KEY, *_VOLUME_ALIASES):
        if key in normalized:
            normalized[key] = volume
    normalized.setdefault(_VOLUME_KEY, volume)

    raw_price = payload.get('price')
    if raw_price not in (None, ''):
        try:
            price = float(raw_price)
        except (TypeError, ValueError):
            raise ValidationErrorException(
                detail="Giá phải là số.", code="validation_error",
            )
        if price < 0:
            raise ValidationErrorException(
                detail="Giá không được âm.", code="validation_error",
            )

    return normalized


#: X.2 — tên thao tác đầy đủ. Không dùng làm `action` vì cột hẹp 16 ký tự
#: (`ops_audit/models.py:25`) ⇒ `varchar(16)` nhận chuỗi 18 ký tự ném
#: `DataError`, bị `except Exception` nuốt, và còn làm hỏng transaction nên
#: `ops_audit` `RequestTraceMiddleware` cũng không ghi được cho request đó.
#: ⇒ đặt ở `metadata['operation']`, còn `action` dùng giá trị hợp lệ.
_AUDIT_OPERATION = 'broker.place_order'
_AUDIT_RESOURCE_TYPE = 'dnse_order'


def _clip(value, limit: int) -> str:
    return str(value or '')[:limit]


def _create_audit_event(
    request,
    market_type: str,
    order_category: str,
    payload: dict,
    outcome: str,
    mode: str,
    dry_run: bool,
):
    """Tạo dòng audit cho một lần đặt lệnh. Ném lỗi nếu ghi hỏng — caller quyết định."""
    from ops_audit.models import AuditEvent
    return AuditEvent.objects.create(
        actor_user_id=request.user.id if getattr(request.user, 'is_authenticated', False) else None,
        actor_label=_clip(getattr(request.user, 'username', ''), 120),
        tenant_id=_clip(getattr(getattr(request, 'tenant', None), 'public_id', ''), 36),
        # `action` phải nằm trong `AuditEvent.ActionChoices` và <= max_length.
        action=AuditEvent.ActionChoices.CREATE,
        resource_type=_AUDIT_RESOURCE_TYPE,
        resource_id=_clip(payload.get('symbol'), 64),
        request_id=_clip(getattr(request, 'request_id', ''), 36),
        metadata={
            'operation': _AUDIT_OPERATION,
            'market_type': market_type,
            'order_category': order_category,
            'side': payload.get('side'),
            'volume': payload.get(_VOLUME_KEY),
            'outcome': outcome,
            'mode': mode,
            'dry_run': bool(dry_run),
        },
    )


def _audit_order(
    request,
    market_type: str,
    order_category: str,
    payload: dict,
    outcome: str,
    mode: str,
    dry_run: bool,
):
    """Ghi audit và TRẢ VỀ dòng đã tạo, hoặc `None` nếu ghi hỏng.

    Fail-closed: trả `None` kèm log ERROR (không `logger.exception` rồi bỏ qua
    im lặng) để caller từ chối thao tác thay vì tiếp tục không có dấu vết.
    """
    try:
        return _create_audit_event(
            request, market_type, order_category, payload, outcome, mode, dry_run,
        )
    except Exception:
        logger.error(
            'AUDIT-UNAVAILABLE operation=%s outcome=%s resource=%s — %s',
            _AUDIT_OPERATION, outcome, _clip(payload.get('symbol'), 64),
            traceback.format_exc(),
        )
        return None


def _finalize_audit_event(event, outcome: str) -> bool:
    """Ghi kết quả cuối vào dòng audit đã tạo. Trả `False` nếu cập nhật hỏng.

    Không thể fail-closed ở đây: lệnh đã đẩy xuống broker, không thể hoàn tác.
    Nên thay vì nuốt im lặng, trả `False` cho caller để báo lại trong response.
    """
    if event is None:
        return False
    try:
        event.metadata = {**(event.metadata or {}), 'outcome': outcome}
        event.save(update_fields=['metadata'])
        return True
    except Exception:
        logger.error(
            'AUDIT-FINALIZE-FAILED operation=%s audit_event_id=%s outcome=%s — %s',
            _AUDIT_OPERATION, event.pk, outcome, traceback.format_exc(),
        )
        return False


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


def _get_dnse_secrets(user):
    """B1.2.5: đọc secrets DNSE từ store mới (UserBrokerConfig) trước, fallback store cũ.

    Trả về (client_id, client_secret) hoặc (None, None). Không log secret.
    """
    config = get_user_broker_config(user, 'dnse')
    if config is not None:
        secrets = config.get_secrets()
        client_id = str(secrets.get('client_id', '') or '').strip()
        client_secret = str(secrets.get('client_secret', '') or '').strip()
        if client_id and client_secret:
            return client_id, client_secret
    credential = DNSECredential.objects.filter(user=user).first()
    if credential and credential.has_credentials():
        return credential.get_client_id(), credential.get_client_secret()
    return None, None


def _has_dnse_credentials(user) -> bool:
    client_id, client_secret = _get_dnse_secrets(user)
    return bool(client_id and client_secret)


def _get_active_dnse_client(user):
    from .vnbroker_dnse_compat import build_dnse_client

    client_id, client_secret = _get_dnse_secrets(user)
    if not client_id or not client_secret:
        raise DNSECredentialMissingError(
            "DNSE LightSpeed credential chưa được thiết lập. Cấu hình Client ID và Client Secret trước."
        )

    try:
        return build_dnse_client(client_id=client_id, client_secret=client_secret)
    except ImportError as exc:
        raise DNSEVnbrokerUnavailableError(
            "vnbroker DNSE connector chưa khả dụng. "
            "Cài đặt vnbroker >= phiên bản hỗ trợ LightSpeed API trước khi kích hoạt DNSE sync."
        ) from exc
    except Exception as exc:
        raise DNSEAdapterError(
            "Không thể khởi tạo phiên DNSE LightSpeed API. Kiểm tra Client ID/Secret và kết nối mạng."
        ) from exc


# NOTE (B1.2): dnse_config_api cũ đã chuyển thành views_broker.broker_config_api
# (route `broker/<provider>/config/`, store UserBrokerConfig). Xóa để khỏi 2 nguồn.
# Giữ lại sync/OTP/order views (đọc secrets qua _get_dnse_secrets → store mới trước).


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def dnse_sync_accounts_api(request):
    """
    Kích hoạt tác vụ đồng bộ tiểu khoản từ DNSE LightSpeed API.
    """
    user = request.user
    if not _has_dnse_credentials(user):
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
    if not _has_dnse_credentials(user):
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
    if not _has_dnse_credentials(user):
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
@throttle_classes([ScopedRateThrottle])
def dnse_place_order_api(request):
    """
    Đặt lệnh giao dịch qua DNSE LightSpeed API bằng trading token đã xác thực OTP.

    R0.11 — trước đây endpoint không có validate server-side, không throttle
    riêng, không audit log, và nhánh `except Exception` trả `str(exc)` thô cho
    client (lộ chi tiết hạ tầng). Nay đã bổ sung đủ 4 lớp.

    PA-1 — audit fail-closed: dòng audit `requested` được ghi TRƯỚC khi gọi
    broker. Ghi hỏng ⇒ từ chối lệnh (`audit_unavailable`), không gọi broker.
    Không thể làm vậy sau khi gọi broker vì lệnh đã không thể hoàn tác.
    """
    user = request.user
    raw_payload = request.data.get("payload")
    audit_payload = raw_payload if isinstance(raw_payload, dict) else {}
    market_type = 'unknown'
    order_category = 'unknown'
    mode = 'unknown'
    dry_run = False
    try:
        market_type = _require_allowlisted(
            request.data.get("market_type"), _ALLOWED_MARKET_TYPES, "STOCK",
            "market_type_not_allowed", "Loại thị trường",
        )
        order_category = _require_allowlisted(
            request.data.get("order_category"), _ALLOWED_ORDER_CATEGORIES, "NORMAL",
            "order_category_not_allowed", "Nhóm lệnh",
        )
        trading_token = str(request.data.get("trading_token", "")).strip()
        dry_run = _to_bool(request.data.get("dry_run", False))

        if not trading_token:
            raise ValidationErrorException(
                detail="Thiếu trading_token. Vui lòng gửi OTP và tạo trading token trước khi đặt lệnh.",
                code="validation_error"
            )

        if not isinstance(raw_payload, dict) or not raw_payload:
            raise ValidationErrorException(
                detail="Thiếu payload đặt lệnh hợp lệ.",
                code="validation_error"
            )

        # R0.11 — validate server-side. UI đã chặn lô 100 và side UNKNOWN nhưng
        # client có thể gọi thẳng API, không được tin UI.
        # X.6 — bản chuẩn hoá trả về đây là bản DUY NHẤT đi xuống broker.
        normalized_payload = _normalize_order_payload(raw_payload, market_type)
    except ValidationErrorException as exc:
        _audit_order(
            request, market_type, order_category, audit_payload,
            'rejected_validation', mode, dry_run,
        )
        raise exc

    # X.2 + SAFE-01 — fail-closed: không có dòng audit thì KHÔNG gọi broker.
    audit_event = _audit_order(
        request, market_type, order_category, normalized_payload, 'requested', mode, dry_run,
    )
    if audit_event is None:
        raise InternalErrorException(
            detail=(
                "Không ghi được audit đặt lệnh nên lệnh bị từ chối. "
                "Không có giao dịch nào được gửi tới broker. Liên hệ quản trị viên."
            ),
            code="audit_unavailable",
        )

    try:
        client = _get_active_dnse_client(user)
        result = client.post_order(
            market_type=market_type,
            payload=normalized_payload,
            trading_token=trading_token,
            order_category=order_category,
            dry_run=dry_run,
            raw=False,
        )
        return Response({
            "result": result,
            "audit_recorded": _finalize_audit_event(audit_event, 'accepted'),
        })
    except DNSECredentialMissingError as exc:
        _finalize_audit_event(audit_event, 'credential_missing')
        raise ValidationErrorException(detail=str(exc), code="validation_error")
    except DNSEAdapterError as exc:
        _finalize_audit_event(audit_event, 'adapter_error')
        # `str(exc)` từ adapter đã là thông điệp nghiệp vụ có kiểm soát.
        raise ValidationErrorException(detail=str(exc), code="validation_error")
    except ValidationErrorException:
        _finalize_audit_event(audit_event, 'rejected_by_adapter')
        raise
    except Exception:
        # R0.11 — KHÔNG trả `str(exc)` cho client. Chi tiết lỗi nằm trong log
        # nội bộ, client chỉ nhận thông điệp chung.
        _finalize_audit_event(audit_event, 'internal_error')
        logger.exception('dnse_place_order_api: unexpected failure for user=%s', getattr(user, 'id', None))
        raise ValidationErrorException(
            detail="Đặt lệnh thất bại do lỗi hệ thống. Vui lòng thử lại sau.",
            code="internal_error",
        )


# R0.11 — `ScopedRateThrottle` đọc scope từ attribute của view, nên phải gán
# SAU khi định nghĩa hàm (không phải biến cục bộ trong thân hàm).
dnse_place_order_api.throttle_scope = 'broker_order'


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
    config = get_user_broker_config(user, 'dnse')
    secrets_ok = bool(config and config.has_secrets())
    if not secrets_ok:
        credential = DNSECredential.objects.filter(user=user, is_active=True).first()
        secrets_ok = bool(credential and credential.has_credentials())
    if not secrets_ok:
        return Response({
            "is_configured": False,
            "message": "DNSE LightSpeed credential chưa được cấu hình.",
        })
    return Response({
        "is_configured": True,
        "is_active": True,
        "last_sync_at": config.last_verified_at if config else None,
        "broker": "DNSE",
        "auth_method": "LightSpeed_OAuth2",
    })

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

import hashlib
import json
import logging
import traceback

# Đặt cùng khối import đầu file để không sinh thêm E402 (`logger = ...` ở
# dưới đã khiến các import sau nó đều bị báo).
from .envelope import envelope

logger = logging.getLogger(__name__)

from .dnse_adapter import (
    DNSEAdapterError,
    DNSECredentialMissingError,
    DNSEVnbrokerUnavailableError,
)
from .models import DNSECredential, SubAccount, get_user_broker_config, set_user_broker_secrets
from .serializers import SubAccountSerializer
from .services import idempotency
from .tasks import (
    reconcile_dnse_transactions_task,
    sync_dnse_accounts_task,
    sync_dnse_balances_task,
)
from vninvest_core.exceptions import (
    ConflictErrorException,
    InternalErrorException,
    NotFoundErrorException,
    PermissionErrorException,
    ServiceUnavailableException,
    ValidationErrorException,
)

from .permissions import (attach_required_permissions, WorkspacePermission, required_workspace_permission,)

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


#: SAFE-01 — mode là enum rõ ràng, không phải boolean suy diễn.
#: `_to_bool` cũ đã bị XOÁ: nó hiểu `{"1","true","yes","y","on"}` và trả `False`
#: cho MỌI thứ còn lại, nên `dry_run="paper"` hay `"live"` đều ra LIVE.
#: Thay bằng `_parse_bool_strict` trả True/False/None.
MODE_PAPER = 'paper'
MODE_LIVE = 'live'
_ALLOWED_MODES = (MODE_PAPER, MODE_LIVE)
_TRUE_TOKENS = frozenset({'1', 'true', 'yes', 'y', 'on'})
_FALSE_TOKENS = frozenset({'0', 'false', 'no', 'n', 'off'})
#: Header bắt buộc cho mọi lệnh — chống double-click và retry.
IDEMPOTENCY_HEADER = 'HTTP_IDEMPOTENCY_KEY'
#: Ngữ cảnh dùng chung cho các endpoint DNSE khác (OTP / trading token).
_BROKER_SCOPE = 'dnse_broker_write'
_ORDER_SCOPE = 'dnse_order'
#: X.5 — gate còn thiếu nên live mode bị từ chối. Nêu tên từng gate để client
#: không phải đoán, thay vì trả 403 chung chung.
_LIVE_ORDERING_MISSING_GATES = (
    'chưa có order policy gate',
    'chưa có bước xác nhận (confirm token) bắt buộc',
    'chưa có giới hạn rủi ro theo lệnh',
)


def _parse_bool_strict(value):
    """True / False / `None` khi không parse được. KHÔNG default thành False.

    `_to_bool` cũ trả `False` cho mọi thứ không nằm trong tập true, nên
    `dry_run="paper"` và `dry_run="live"` đều ra LIVE.
    """
    if isinstance(value, bool):
        return value
    token = str(value).strip().lower()
    if token in _TRUE_TOKENS:
        return True
    if token in _FALSE_TOKENS:
        return False
    return None


def _resolve_order_mode(data) -> tuple:
    """Trả `(mode, dry_run)`. Server là nguồn sự thật của mode.

    Thứ tự ưu tiên xác định:
    1. có `mode` → phải thuộc `paper|live`, và không mâu thuẫn `dry_run`
    2. không có `mode` nhưng có `dry_run` → parse nghiêm ngặc
    3. không có gì → `order_mode_required` (fail-closed, KHÔNG mặc định live)
    """
    raw_mode = data.get('mode')
    has_dry_run = 'dry_run' in data
    raw_dry_run = data.get('dry_run')
    dry_run_flag = _parse_bool_strict(raw_dry_run) if has_dry_run else None

    if has_dry_run and dry_run_flag is None:
        raise ValidationErrorException(
            detail=(
                f"Không đọc được `dry_run`: {str(raw_dry_run)!r}. "
                f"Dùng `mode` = {' hoặc '.join(_ALLOWED_MODES)} thay vì boolean."
            ),
            code="order_mode_invalid",
        )

    if raw_mode is None or not str(raw_mode).strip():
        if not has_dry_run:
            raise ValidationErrorException(
                detail=(
                    "Thiếu `mode`. Server không tự đoán: gửi "
                    f"`mode` = {MODE_PAPER!r} để chạy thử, "
                    f"{MODE_LIVE!r} để đặt lệnh thật. Thiếu mode sẽ bị từ chối."
                ),
                code="order_mode_required",
            )
        mode = MODE_PAPER if dry_run_flag else MODE_LIVE
    else:
        mode = str(raw_mode).strip().lower()
        if mode not in _ALLOWED_MODES:
            raise ValidationErrorException(
                detail=(
                    f"Mode không hợp lệ: '{mode}'. "
                    f"Chỉ chấp nhận: {', '.join(_ALLOWED_MODES)}."
                ),
                code="order_mode_invalid",
            )
        if has_dry_run and dry_run_flag is not (mode == MODE_PAPER):
            raise ValidationErrorException(
                detail=(
                    f"`mode={mode}` mâu thuẫn `dry_run={bool(dry_run_flag)}`. "
                    "Chỉ cần gửi `mode`."
                ),
                code="order_mode_conflict",
            )

    if mode == MODE_LIVE:
        raise PermissionErrorException(
            detail=(
                "Đặt lệnh thật (mode=live) đang bị từ chối: "
                + "; ".join(_LIVE_ORDERING_MISSING_GATES)
                + f". Dùng `mode={MODE_PAPER!r}` trong lúc chờ các gate đó."
            ),
            code="live_ordering_disabled",
            field_errors={'mode': list(_LIVE_ORDERING_MISSING_GATES)},
        )

    # `paper` ⇒ `dry_run=True` xuống broker do SERVER quyết, không phải client.
    return mode, True


#: Mã lỗi do `_resolve_order_mode` sinh ra — dùng để gắn nhãn audit đúng nguyên nhân.
_MODE_ERROR_CODES = frozenset({
    'order_mode_required', 'order_mode_invalid', 'order_mode_conflict',
    'live_ordering_disabled',
})


def _mode_rejection_outcome(exc) -> str:
    """Nhãn audit cho lỗi chặn ở tầng mode, `None` nếu lỗi đến từ tầng khác."""
    if getattr(exc, 'code', None) == 'live_ordering_disabled':
        return 'rejected_live_mode'
    if getattr(exc, 'code', None) in _MODE_ERROR_CODES:
        return 'rejected_mode'
    return None


def _order_fingerprint(market_type: str, order_category: str, payload: dict) -> str:
    """Fingerprint của *nội dung lệnh* — dùng phát hiện tái sử dụng key sai cách."""
    canonical = {
        'market_type': market_type,
        'order_category': order_category,
        'symbol': payload.get('symbol'),
        'side': payload.get('side'),
        'volume': payload.get(_VOLUME_KEY),
        'price': payload.get('price'),
        'account_no': payload.get('account_no'),
    }
    blob = json.dumps(canonical, sort_keys=True, default=str, ensure_ascii=False)
    return hashlib.sha256(blob.encode('utf-8')).hexdigest()


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


@required_workspace_permission('portfolio_write')
@api_view(['POST'])
@permission_classes([IsAuthenticated, WorkspacePermission])
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
        return envelope({
            "ok": True,
            "synced_count": result.get("synced_count", 0),
            "accounts": serializer.data,
        })
    return Response({
        "ok": False,
        "error": result.get("error", "Đồng bộ thất bại."),
    }, status=status.HTTP_502_BAD_GATEWAY)


@required_workspace_permission('portfolio_write')
@api_view(['POST'])
@permission_classes([IsAuthenticated, WorkspacePermission])
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
        return envelope(result)

    raise ValidationErrorException(
        detail=result.get("error", "Đồng bộ số dư thất bại."),
        code="validation_error"
    )


@required_workspace_permission('portfolio_write')
@api_view(['POST'])
@permission_classes([IsAuthenticated, WorkspacePermission])
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
        return envelope(result)

    raise ValidationErrorException(
        detail=result.get("error", "Đối soát giao dịch thất bại."),
        code="validation_error"
    )


def _assert_broker_writes_allowed(request, provider, *, action: str) -> None:
    """SAFE-03 lớp view: chặn ghi broker khi kill-switch bật hoặc không đọc được.

    Chạy global + tenant + provider: chỉ cần một scope nào đó bật là chặn.
    `KillSwitchIndeterminate` (lỗi hạ tầng) trả 503 vì đó là sự cố tạm thời,
    còn `BrokerWriteDisabled` (operator chủ động tắt) trả 503 luôn — hai nguyên
    nhân khác nhau nhưng đều nghĩa là "đừng ghi lúc này".
    """
    from service_ops.broker_runtime import (
        BrokerWriteDisabled,
        check_kill_switch,
    )

    tenant = getattr(request, 'tenant', None)
    for scope in ('global', 'tenant', 'provider'):
        try:
            check_kill_switch(scope, tenant=tenant, provider=provider)
        except BrokerWriteDisabled as exc:
            logger.warning(
                'dnse: write blocked by kill-switch scope=%s provider=%s '
                'action=%s user=%s: %s',
                scope, provider, action, getattr(request.user, 'id', None), exc,
            )
            raise ServiceUnavailableException(
                detail=(
                    'Hệ thống đang tạm ngừng giao dịch. Vui lòng thử lại sau. '
                    'Lệnh của bạn chưa được gửi tới broker.'
                ),
                code='broker_writes_disabled',
            ) from exc


@required_workspace_permission('order_write')
@api_view(['POST'])
@permission_classes([IsAuthenticated, WorkspacePermission])
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
    # SAFE-03 — kill-switch chặn TRƯỚC mọi thao tác khác, kể cả trước khi
    # validate payload: một request bị chặn không nên tạo audit row, cũng
    # không nên chạm broker. `check_kill_switch` fail-closed — lỗi đọc
    # trạng thái cũng chặn, không cho qua.
    _assert_broker_writes_allowed(request, 'dnse', action='place_order')
    user = request.user
    raw_payload = request.data.get("payload")
    audit_payload = raw_payload if isinstance(raw_payload, dict) else {}
    market_type = 'unknown'
    order_category = 'unknown'
    # Mode client KHAI trước khi resolve — nếu resolve lỗi thì đây chính là
    # thứ cần ghi vào audit. `_resolve_order_mode` sẽ ghi đè bằng giá trị server
    # quyết khi thành công.
    mode = str(request.data.get('mode') or '').strip().lower() or 'unknown'
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
        # SAFE-01 — resolve mode TRƯỚC mọi thứ khác.
        mode, dry_run = _resolve_order_mode(request.data)

        trading_token = str(request.data.get("trading_token", "")).strip()

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
    except (ValidationErrorException, PermissionErrorException) as exc:
        # `PermissionErrorException` chỉ sinh ra từ `_resolve_order_mode` trong view này.
        _audit_order(
            request, market_type, order_category, audit_payload,
            _mode_rejection_outcome(exc) or 'rejected_validation', mode, dry_run,
        )
        raise exc

    idempotency_key = str(request.META.get(IDEMPOTENCY_HEADER, '') or '').strip()
    if not idempotency_key:
        _audit_order(
            request, market_type, order_category, normalized_payload,
            'rejected_no_idempotency_key', mode, dry_run,
        )
        raise ValidationErrorException(
            detail=(
                "Thiếu header `Idempotency-Key`. Mọi lệnh phải có key để chống gửi trùng. "
                "Sinh một UUID ngẫu nhiên cho mỗi lần bấm đặt lệnh."
            ),
            code="idempotency_key_required",
        )

    fingerprint = _order_fingerprint(market_type, order_category, normalized_payload)
    # TEN-06: scope the idempotency namespace by tenant, so the same key under
    # tenant B cannot be deduped against / conflict with a record from tenant A.
    #
    # LED-06: truyền **đối tượng `CoreTenant`**, không phải `public_id`. Bảng
    # `IdempotencyRecord.tenant` là `NOT NULL` (D-03) nên phải resolve được thật;
    # truyền chuỗi rồi tra cứu lại là thừa một bước và thêm một nhánh lỗi.
    order_tenant = getattr(request, 'tenant', None)
    if order_tenant is None:
        # Không có tenant ⇒ không ghi được key ⇒ **từ chối lệnh**, không phải
        # rơi về namespace dùng chung. Một key dùng chung giữa các tenant là
        # đường rò response đơn hàng của tenant khác.
        _audit_order(
            request, market_type, order_category, normalized_payload,
            'rejected_no_tenant', mode, dry_run,
        )
        raise PermissionErrorException(
            detail=(
                'Không xác định được tenant nên không thể ghi nhận '
                '`Idempotency-Key`. Lệnh bị từ chối. Kiểm tra header `X-Tenant-ID`.'
            ),
            code='idempotency_tenant_unresolved',
        )
    try:
        claim = idempotency.claim(
            user_id=user.id, scope=_ORDER_SCOPE, key=idempotency_key,
            fingerprint=fingerprint, tenant_id=order_tenant,
        )
    except idempotency.IdempotencyTenantUnresolved as exc:
        _audit_order(
            request, market_type, order_category, normalized_payload,
            'rejected_idempotency_tenant', mode, dry_run,
        )
        raise PermissionErrorException(detail=str(exc),
                                        code='idempotency_tenant_unresolved')
    if claim.conflict:
        raise ConflictErrorException(
            detail=(
                "`Idempotency-Key` đã dùng cho một lệnh KHÁC. "
                "Dùng key mới cho mỗi lệnh khác nhau."
            ),
            code="idempotency_key_conflict",
        )
    if claim.in_progress:
        raise ConflictErrorException(
            detail="Lệnh cùng `Idempotency-Key` đang được xử lý. Thử lại sau.",
            code="idempotency_in_progress",
        )
    if claim.replay:
        return envelope({
            "result": claim.result,
            "idempotent_replay": True,
            "audit_recorded": True,
            # SAFE-01 R3: client cần biết lệnh này chạy ở mode nào để render
            # badge. Không có nó thì FE chỉ còn cách đoán từ payload.
            "mode": mode,
            "dry_run": dry_run,
        })

    # X.2 + SAFE-01 — fail-closed: không có dòng audit thì KHÔNG gọi broker.
    audit_event = _audit_order(
        request, market_type, order_category, normalized_payload, 'requested', mode, dry_run,
    )
    if audit_event is None:
        idempotency.release(user_id=user.id, scope=_ORDER_SCOPE, key=idempotency_key, tenant_id=order_tenant)
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
        audit_recorded = _finalize_audit_event(audit_event, 'accepted')
        idempotency.store_result(
            user_id=user.id, scope=_ORDER_SCOPE, key=idempotency_key,
            fingerprint=fingerprint, result=result, tenant_id=order_tenant,
        )
        return envelope({
            "result": result,
            "idempotent_replay": False,
            "audit_recorded": audit_recorded,
            # SAFE-01 R3 — `mode` là quyết định của SERVER, không phải client.
            "mode": mode,
            "dry_run": dry_run,
        })
    except DNSECredentialMissingError as exc:
        _finalize_audit_event(audit_event, 'credential_missing')
        idempotency.release(user_id=user.id, scope=_ORDER_SCOPE, key=idempotency_key, tenant_id=order_tenant)
        raise ValidationErrorException(detail=str(exc), code="validation_error")
    except DNSEAdapterError as exc:
        _finalize_audit_event(audit_event, 'adapter_error')
        idempotency.release(user_id=user.id, scope=_ORDER_SCOPE, key=idempotency_key, tenant_id=order_tenant)
        # `str(exc)` từ adapter đã là thông điệp nghiệp vụ có kiểm soát.
        raise ValidationErrorException(detail=str(exc), code="validation_error")
    except ValidationErrorException:
        _finalize_audit_event(audit_event, 'rejected_by_adapter')
        idempotency.release(user_id=user.id, scope=_ORDER_SCOPE, key=idempotency_key, tenant_id=order_tenant)
        raise
    except Exception:
        # R0.11 — KHÔNG trả `str(exc)` cho client. Chi tiết lỗi nằm trong log
        # nội bộ, client chỉ nhận thông điệp chung.
        _finalize_audit_event(audit_event, 'internal_error')
        idempotency.release(user_id=user.id, scope=_ORDER_SCOPE, key=idempotency_key, tenant_id=order_tenant)
        logger.exception('dnse_place_order_api: unexpected failure for user=%s', getattr(user, 'id', None))
        raise ValidationErrorException(
            detail="Đặt lệnh thất bại do lỗi hệ thống. Vui lòng thử lại sau.",
            code="internal_error",
        )


# R0.11 — `ScopedRateThrottle` đọc scope từ attribute của view, nên phải gán
# SAU khi định nghĩa hàm (không phải biến cục bộ trong thân hàm).
dnse_place_order_api.throttle_scope = 'broker_order'


@required_workspace_permission('order_write')
@api_view(['POST'])
@permission_classes([IsAuthenticated, WorkspacePermission])
def dnse_send_email_otp_api(request):
    """
    Gửi OTP email cho flow giao dịch DNSE.

    PA-1/SAFE-01 — trước đây `dry_run` mặc định `False` ⇒ gọi LIVE khi client
    quên field. Nay mode phải nói rõ, và thiếu mode thì từ chối.
    PA-1/X.5 — nhánh `except Exception` trả `str(exc)` thô; nay chỉ trả mã lỗi.
    """
    _assert_broker_writes_allowed(request, 'dnse', action='send_email_otp')
    user = request.user
    mode, dry_run = _resolve_order_mode(request.data)

    try:
        client = _get_active_dnse_client(user)
        result = client.send_email_otp(dry_run=dry_run, raw=False)
        return envelope({"result": result, "mode": mode, "dry_run": dry_run})
    except DNSECredentialMissingError as exc:
        raise ValidationErrorException(detail=str(exc), code="validation_error")
    except DNSEAdapterError as exc:
        raise ValidationErrorException(detail=str(exc), code="validation_error")
    except Exception:
        # X.5 — KHÔNG trả `str(exc)`: lộ token/URL hạ tầng cho client.
        logger.exception('dnse_send_email_otp_api: unexpected failure for user=%s',
                         getattr(user, 'id', None))
        raise ValidationErrorException(
            detail="Gửi OTP DNSE thất bại do lỗi hệ thống. Vui lòng thử lại sau.",
            code="internal_error",
        )


@required_workspace_permission('order_write')
@api_view(['POST'])
@permission_classes([IsAuthenticated, WorkspacePermission])
def dnse_create_trading_token_api(request):
    """
    Tạo trading token bằng OTP/passcode để đặt/sửa/hủy lệnh DNSE.

    PA-1/SAFE-01 + PA-1/X.5 — cùng xử lý mode và redaction như `place_order`.
    """
    _assert_broker_writes_allowed(request, 'dnse', action='create_trading_token')
    user = request.user
    otp_type = str(request.data.get("otp_type", "EMAIL")).strip().upper() or "EMAIL"
    passcode = str(request.data.get("passcode", "")).strip()
    mode, dry_run = _resolve_order_mode(request.data)

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
        return envelope({
            "ok": True,
            "otp_type": otp_type,
            "trading_token": trading_token,
            "result": result,
            # SAFE-01 R3 — client cần `mode` để biết token này được cấp cho
            # luồng paper hay live.
            "mode": mode,
            "dry_run": dry_run,
        })
    except DNSECredentialMissingError as exc:
        raise ValidationErrorException(detail=str(exc), code="validation_error")
    except DNSEAdapterError as exc:
        raise ValidationErrorException(detail=str(exc), code="validation_error")
    except Exception:
        # X.5 — KHÔNG trả `str(exc)`.
        logger.exception('dnse_create_trading_token_api: unexpected failure for user=%s',
                         getattr(user, 'id', None))
        raise ValidationErrorException(
            detail="Tạo trading token DNSE thất bại do lỗi hệ thống. Vui lòng thử lại sau.",
            code="internal_error",
        )


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
        return envelope({
            "is_configured": False,
            "message": "DNSE LightSpeed credential chưa được cấu hình.",
        })
    return envelope({
        "is_configured": True,
        "is_active": True,
        "last_sync_at": config.last_verified_at if config else None,
        "broker": "DNSE",
        "auth_method": "LightSpeed_OAuth2",
    })

# SAFE-04: @api_view khong chep attribute tuy chon sang class, nen phai
# chuyen khai bao sang .cls sau khi moi view da duoc boc.
attach_required_permissions(
    dnse_sync_accounts_api,
    dnse_sync_balances_api,
    dnse_place_order_api,
    dnse_send_email_otp_api,
    dnse_create_trading_token_api,
    dnse_reconcile_transactions_api,
)

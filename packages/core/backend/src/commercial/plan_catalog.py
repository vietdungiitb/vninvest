"""
Plan Catalog — single source of truth cho taxonomy gói cước.

Giải quyết audit C2 (3 bộ từ vựng không khớp) và H9 (Stripe/VNPay plan param mismatch).
Backend dùng canonical: starter / pro / enterprise (khớp Stripe).
Frontend billing dùng VIP_1M / VIP_6M / VIP_12M → map về canonical qua VIP_TO_CANONICAL.

Slice C / C2 — PLAN_ENTITLEMENTS bên dưới là bảng quyền DUY NHẤT của hệ thống.
Trước đây có 4 bảng hard-code mâu thuẫn nhau; 2 bảng còn lại nằm ở
`identity_access/views/helpers.py:137` (`_paid_plans`) và
`identity_access/views_webhooks.py:196` (`features_map`) — xem `PAID_PLAN_CODES` và
`get_plan_entitlement` để biết chính xác coordinator cần sửa gì ở 2 file đó.
"""
from django.conf import settings

# Sentinel: -1 nghĩa là KHÔNG GIỚI HẠN (xem QuotaRecord.api_calls_limit, models.py:44).
UNLIMITED = -1

# Canonical plan codes — phải khớp với CoreTenant.PlanChoices và Stripe price ID keys.
CANONICAL_PLANS = ["starter", "pro", "enterprise"]

# Mọi plan code hợp lệ (kể cả free/custom/internal) — khớp CoreTenant.PlanChoices.
ALL_PLAN_CODES = ["free", "starter", "pro", "enterprise", "custom", "internal"]

# Frontend billing (VIP_*) → canonical backend/Stripe.
VIP_TO_CANONICAL = {
    "VIP_1M": "starter",
    "VIP_6M": "pro",
    "VIP_12M": "enterprise",
}

CANONICAL_TO_VIP = {v: k for k, v in VIP_TO_CANONICAL.items()}

# Giá chuẩn VND — dùng để validate server-side chống tam giá (C1).
PLAN_PRICES_VND = {
    "starter": 100_000,
    "pro": 500_000,
    "enterprise": 900_000,
}

# Thời hạn gói (ngày) — dùng khi kích hoạt subscription sau IPN (C1).
PLAN_DURATIONS_DAYS = {
    "starter": 30,
    "pro": 180,
    "enterprise": 360,
}

# ---------------------------------------------------------------------------
# Slice C / C2 — CANONICAL PLAN ENTITLEMENTS
# ---------------------------------------------------------------------------
# api_calls / members / sso / webhooks / audit_days lấy NGUYÊN VĂN từ
# `identity_access/views_webhooks.py:196-201` (`features_map`) — đó là nơi DUY NHẤT
# trong repo từng chứa số api_calls, và nó cũng là endpoint mà khách hàng nhìn thấy
# khi preview đổi gói. Chọn số khác ở đây sẽ âm thầm đổi thứ đã báo giá cho khách.
#
# members: 0 nghĩa là không giới hạn (None trong features_map cũ).
# max_active_pats: UNLIMITED cho MỌI plan — cố ý KHÔNG đặt hạn mức hữu hạn ở đây.
#   CoreTenant.max_active_pats mặc định -1 (models.py:107) và
#   CorePATCredential.issue_for_service_account (models.py:337-348) SẼ CHẶN việc cấp
#   PAT mới khi chạm hạn mức. Đặt số hữu hạn lúc chưa có quyết định sản phẩm là chặn
#   khách trả tiền. Số giờ nằm ở đây để khi owner quyết thì chỉ sửa 1 dòng.
PLAN_ENTITLEMENTS: dict[str, dict[str, object]] = {
    "free": {
        "api_calls": 1_000,
        "members": 3,
        "sso": False,
        "webhooks": False,
        "audit_days": 7,
        "max_active_pats": UNLIMITED,
        "ai_regenerate": 0,
        "exports": 0,
    },
    "starter": {
        "api_calls": 10_000,
        "members": 5,
        "sso": False,
        "webhooks": False,
        "audit_days": 7,
        "max_active_pats": UNLIMITED,
        "ai_regenerate": 0,
        "exports": 0,
    },
    "pro": {
        "api_calls": 50_000,
        "members": 25,
        "sso": True,
        "webhooks": True,
        "audit_days": 30,
        "max_active_pats": UNLIMITED,
        "ai_regenerate": UNLIMITED,
        "exports": UNLIMITED,
    },
    "enterprise": {
        "api_calls": UNLIMITED,
        "members": UNLIMITED,
        "sso": True,
        "webhooks": True,
        "audit_days": 90,
        "max_active_pats": UNLIMITED,
        "ai_regenerate": UNLIMITED,
        "exports": UNLIMITED,
    },
    "custom": {
        # Gói thương lượng: KHÔNG giới hạn. Số thỏa thuận riêng được set trực tiếp
        # trên CoreTenant.api_calls_limit và được bảo toàn bởi sync (xem models.py).
        "api_calls": UNLIMITED,
        "members": UNLIMITED,
        "sso": True,
        "webhooks": True,
        "audit_days": 90,
        "max_active_pats": UNLIMITED,
        "ai_regenerate": UNLIMITED,
        "exports": UNLIMITED,
    },
    "internal": {
        "api_calls": UNLIMITED,
        "members": UNLIMITED,
        "sso": True,
        "webhooks": True,
        "audit_days": 90,
        "max_active_pats": UNLIMITED,
        "ai_regenerate": UNLIMITED,
        "exports": UNLIMITED,
    },
}

# Tập mọi giá trị api_calls hợp lệ. Giá trị KHÔNG nằm trong tập này được coi là
# thỏa thuận thủ công và được bảo toàn khi plan đổi (xong hàm _is_plan_derived).
ALL_CANONICAL_API_CALL_LIMITS = frozenset(
    int(entry["api_calls"]) for entry in PLAN_ENTITLEMENTS.values()
)

#: Plan trả phí — thay cho bảng `_paid_plans` trong identity_access/views/helpers.py:137.
PAID_PLAN_CODES = frozenset({"starter", "pro", "enterprise", "custom", "internal"})


def get_plan_entitlement(plan: str) -> dict:
    """Quyền của 1 plan. Plan lạ/None → quyền của 'free' (fail-closed, không phải unlimited)."""
    return PLAN_ENTITLEMENTS.get(plan or "", PLAN_ENTITLEMENTS["free"])


def get_api_calls_limit(plan: str) -> int:
    """Số API call tối đa / kỳ. UNLIMITED (-1) = không giới hạn."""
    return int(get_plan_entitlement(plan)["api_calls"])


def get_max_active_pats(plan: str) -> int:
    """Số PAT active tối đa. UNLIMITED (-1) = không giới hạn."""
    return int(get_plan_entitlement(plan)["max_active_pats"])


def get_meter_entitlement(plan: str, meter: str) -> int:
    """Quyền cho meter không có cột riêng (ai_regenerate, exports).

    0 = gói không có meter này; UNLIMITED (-1) = không giới hạn.
    Meter lạ → 0 (fail-closed).
    """
    entitlement = get_plan_entitlement(plan)
    if meter not in entitlement:
        return 0
    return int(entitlement[meter])


def is_paid_plan(plan: str) -> bool:
    """Thay cho `_paid_plans` (identity_access/views/helpers.py:137-143)."""
    return (plan or "") in PAID_PLAN_CODES


def is_plan_derived_api_calls_limit(value) -> bool:
    """Giá trị này có phải do plan sinh ra không.

    Nếu đúng → an toàn để ghi đè khi plan đổi.
    Nếu sai (vd 2_000_000 do thương lượng tay) → tuyệt đối giữ nguyên.
    """
    try:
        return int(value) in ALL_CANONICAL_API_CALL_LIMITS
    except (TypeError, ValueError):
        return False


def normalize_plan(raw_plan: str) -> str:
    """Chuẩn hóa mọi giá trị plan (VIP_* hoặc canonical) về canonical code.

    Trả về '' nếu không hợp lệ.
    """
    if not raw_plan:
        return ""
    raw_plan = raw_plan.strip()
    if raw_plan in CANONICAL_PLANS:
        return raw_plan
    return VIP_TO_CANONICAL.get(raw_plan, "")


def get_stripe_price_ids() -> dict:
    """Đọc Stripe Price IDs từ Django settings (nguồn cấu hình duy nhất)."""
    return getattr(settings, "STRIPE_PRICE_IDS", {})


def get_stripe_price_id(plan_code: str) -> str:
    """Lấy Stripe Price ID cho một canonical plan code."""
    return get_stripe_price_ids().get(plan_code, "")

"""
Plan Catalog — single source of truth cho taxonomy gói cước.

Giải quyết audit C2 (3 bộ từ vựng không khớp) và H9 (Stripe/VNPay plan param mismatch).
Backend dùng canonical: starter / pro / enterprise (khớp Stripe).
Frontend billing dùng VIP_1M / VIP_6M / VIP_12M → map về canonical qua VIP_TO_CANONICAL.
"""
from django.conf import settings

# Canonical plan codes — phải khớp với CoreTenant.PlanChoices và Stripe price ID keys.
CANONICAL_PLANS = ["starter", "pro", "enterprise"]

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

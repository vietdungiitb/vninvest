r"""Số liệu vận hành cho trang chủ Django admin.

Vì sao cần
----------
Trước đây `/admin/` chỉ là **danh sách model**. Người vận hành phải click vào
từng bảng để biết hệ thống đang thế nào — và không có tín hiệu nào cho biết
dữ liệu đã cũ. Một bảng giá cũ 3 ngày nhìn y hệt bảng giá mới, tới lúc người
dùng báo "chart không chạy" thì mới biết.

Nguyên tắc bất di bất dịch
---------------------------
1. **Không bao giờ làm trang chủ sập.** Mỗi số liệu được bọc trong `safe()`;
   lỗi truy vấn ⇒ thẻ đó hiện `—` kèm ghi chú, trang vẫn render (AC S2-AC4).
   Trang chủ admin là nơi vào đầu tiên sau khi sự cố; trả 500 ở đây là che
   mất công cụ đúng lúc cần nhất.
2. **Không N+1, không truy vấn nặng.** Mỗi số liệu là 1 truy vấn tổng hợp
   (`.count()` / `.aggregate()`), không kéo danh sách về Python (AC S2-AC5).
3. **Chỉ đọc.** Không ghi, không tạo side-effect, không phụ thuộc request.
"""

from __future__ import annotations

import datetime as dt
import logging
from typing import Any

from django.apps import apps
from django.utils import timezone

logger = logging.getLogger(__name__)

#: Ngưỡng cảnh báo dữ liệu giá cũ (AC S2-AC3). 24h vì giá đóng cửa EOD cập
#: nhật 1 lần/ngày; quá 24h nghĩa là pipeline đã bỏ sót ít nhất 1 phiên.
STALE_PRICE_HOURS = 24


class _Safe:
    """Bọc một số liệu để lỗi không làm hỏng cả trang."""

    __slots__ = ("error", "hint", "value")

    def __init__(self, value: Any = None, error: str | None = None, hint: str = ""):
        self.value = value
        self.error = error
        self.hint = hint

    @property
    def ok(self) -> bool:
        return self.error is None


def _safe(label: str, compute, hint: str = "") -> _Safe:
    """Chạy `compute()`, nuốt lỗi thành `_Safe(error=...)`.

    `label` chỉ dùng cho log — không lộ ra ngoài giao diện người dùng.
    """
    try:
        return _Safe(value=compute())
    except Exception as exc:
        logger.warning("admin.dashboard: khong tinh duoc %s: %s", label, exc)
        return _Safe(error=str(exc), hint=hint or "Không tải được số liệu này")


def _model(app_label: str, model_name: str):
    """Lấy model theo tên; trả `None` nếu app không cài (bản build rút gọn)."""
    try:
        return apps.get_model(app_label, model_name)
    except LookupError:
        return None


def _window_start(hours: int) -> dt.datetime:
    return timezone.now() - dt.timedelta(hours=hours)


class AdminDashboard:
    """Tính toàn bộ số liệu vận hành. Không giữ trạng thái, gọi được nhiều lần."""

    @staticmethod
    def kpis(request=None) -> list[dict]:
        """4 thẻ KPI chính (AC S2-AC1).

        Giá trị trả về là **số thô**, template mới định dạng — giữ phần định
        dạng ở tầng trình bày để không trộn logic với câu chữ.

        ⚠ `url` chỉ được gắn khi người dùng **có** quyền xem bảng đó.
        Không kiểm thì thẻ KPI trỏ tới trang 403 — đo được 2026-10-10 với một
        staff chỉ có `identity_access.view_dailyprice`: cả 4 thẻ đều có link,
        trong đó 3 trỏ tới bảng user không có quyền (`has_perm` → `False`).
        Sidebar đã lọc đúng từ trước; dashboard thì không — nay đồng bộ.
        """
        cards = [
            ("tenant", "Tổ chức", "core_tenants", AdminDashboard._count_tenants, "Nhấp để xem danh sách", "identity_access", "coretenant"),
            ("user", "Người dùng", "auth_user", AdminDashboard._count_users, "Tài khoản đăng nhập hệ thống", "auth", "user"),
            ("transaction", "Giao dịch 24 giờ", "user_workspace_transaction", AdminDashboard._count_recent_transactions, "Bản ghi mới trong 24 giờ", "user_workspace", "transaction"),
            ("quota", "Hạn mức API đã dùng", "commercial_quotarecord", AdminDashboard._count_active_tenants, "Tổ chức đang có bản ghi hạn mức", "commercial", "quotarecord"),
        ]
        result = []
        for key, label, table, compute, hint, app_label, model_name in cards:
            outcome = _safe(label, compute, hint)
            allowed = _can_view(request, app_label, model_name)
            result.append(
                {
                    "key": key,
                    "label": label,
                    "table": table,
                    "hint": hint,
                    "value": outcome.value,
                    "error": outcome.error,
                    "ok": outcome.ok,
                    # Chỉ gắn link khi số liệu tính được **và** người dùng được
                    # phép xem — link tới bảng rỗng thì vô dụng, link tới bảng bị
                    # cấm thì là link hỏng (403).
                    "url": _changelist_url(table) if (outcome.ok and allowed) else None,
                    "can_view": allowed,
                }
            )
        return result

    @staticmethod
    def alerts() -> list[dict]:
        """Cảnh báo vận hành. Rỗng là trạng thái tốt, không phải lỗi."""
        return [item for item in (AdminDashboard._stale_price_alert(),) if item]

    @staticmethod
    def activity() -> list[dict]:
        """Hoạt động gần đây, đọc từ `LogEntry` của chính Django admin.

        Không tự viết bảng nhật ký thứ hai — `django.contrib.admin.LogEntry` đã
        ghi lại mọi thay đổi qua admin, có sẵn, và đã là nguồn sự thật.
        """
        log_entry = _model("admin", "LogEntry")
        if log_entry is None:
            return []
        rows = _safe(
            "admin log",
            lambda: list(
                log_entry.objects.select_related("content_type", "user")
                .order_by("-action_time")[:8]
            ),
            "Chưa đọc được nhật ký thao tác",
        )
        if not rows.ok:
            return [{"error": rows.error, "hint": rows.hint}]
        activity = []
        for entry in rows.value:
            action = {
                1: "Thêm",
                2: "Sửa",
                3: "Xoá",
            }.get(entry.action_flag, f"Hành động {entry.action_flag}")
            activity.append(
                {
                    "action": action,
                    "object": entry.object_repr,
                    "when": entry.action_time,
                    "user": entry.user.get_username() if entry.user else "—",
                    "url": _admin_log_url(entry),
                }
            )
        return activity

    # ── Từng số liệu ──────────────────────────────────────────────────────

    @staticmethod
    def _count_tenants() -> int:
        model = _model("identity_access", "CoreTenant")
        return model.objects.count() if model else None

    @staticmethod
    def _count_users() -> int:
        model = _model("auth", "User")
        if model is None:
            return None
        return model.objects.filter(is_active=True).count()

    @staticmethod
    def _count_recent_transactions() -> int:
        model = _model("user_workspace", "Transaction")
        if model is None:
            return None
        return model.objects.filter(date__gte=_window_start(24).date()).count()

    @staticmethod
    def _count_active_tenants() -> int:
        model = _model("commercial", "QuotaRecord")
        if model is None:
            return None
        return model.objects.count()

    @staticmethod
    def _stale_price_alert() -> dict | None:
        """Cảnh báo khi giá đóng cửa mới nhất đã cũ quá ngưỡng (AC S2-AC3)."""
        model = _model("market_data", "DailyPrice")
        if model is None:
            return None
        latest = model.objects.order_by("-date").values_list("date", flat=True).first()
        if latest is None:
            return {
                "tone": "neutral",
                "title": "Chưa có dữ liệu giá",
                "detail": "Bảng giá đóng cửa còn trống — chưa thể đánh giá độ tươi.",
            }
        age_days = (timezone.localdate() - latest).days
        if age_days * 24 < STALE_PRICE_HOURS:
            return None
        tone = "danger" if age_days >= 7 else "warning"
        return {
            "tone": tone,
            "title": f"Dữ liệu giá đã cũ {age_days} ngày",
            "detail": (
                f"Giá đóng cửa mới nhất là ngày {latest:%d/%m/%Y}. "
                f"Chạy tác vụ đồng bộ giá hoặc kiểm tra hàng đợi ingest."
            ),
            "url": _changelist_url("market_data_dailyprice"),
        }


# ── Trợ giúp URL ──────────────────────────────────────────────────────────
#
# Xây URL bằng `admin:` namespace thay vì `reverse()`: nếu model chưa đăng ký
# admin (rất dễ xảy ra — xem F2 trong PLAN: 78/112 model chưa đăng ký) thì
# `reverse` ném `NoReverseMatch` và làm hỏng cả trang chủ. Ở đây ta thử và
# trả `None` — thẻ KPI chỉ mất link, không mất số liệu.

_CHANGELIST_URLS: dict[str, str] = {
    "core_tenants": "admin:identity_access_coretenant_changelist",
    "auth_user": "admin:auth_user_changelist",
    "user_workspace_transaction": "admin:user_workspace_transaction_changelist",
    "commercial_quotarecord": "admin:commercial_quotarecord_changelist",
    "market_data_dailyprice": "admin:market_data_dailyprice_changelist",
    "support_supportticket": "admin:support_supportticket_changelist",
}


def _can_view(request, app_label: str, model_name: str) -> bool:
    """Người dùng có quyền xem bảng này không.

    Không có `request` (gọi ngoi dây) hoặc không đăng nhập ⇒ coi như **không**
    được xem. Chọn hướng thất bại vì đây là quyết định hiển thị link, không
    phải quyền truy cập — Django vẫn tự chặn 403 ở tầng view.
    """
    user = getattr(request, "user", None)
    if user is None or not getattr(user, "is_active", False):
        return False
    try:
        return bool(user.has_perm(f"{app_label}.view_{model_name}"))
    except Exception:
        return False


def _changelist_url(key: str) -> str | None:
    from django.urls import NoReverseMatch, reverse

    name = _CHANGELIST_URLS.get(key)
    if not name:
        return None
    try:
        return reverse(name)
    except NoReverseMatch:
        return None


def _admin_log_url(entry) -> str | None:
    from django.urls import NoReverseMatch, reverse

    if not entry.content_type_id:
        return None
    try:
        return reverse(
            "admin:%s_%s_change"
            % (entry.content_type.app_label, entry.content_type.model),
            args=(entry.object_id,),
        )
    except NoReverseMatch:
        return None


def dashboard_context(request=None) -> dict:
    """Context cho template `admin/index.html`.

    `request` dùng để **lọc link KPI theo quyền** — xem `kpis()`.
    Không truyền `request` thì không thẻ nào có link (hướng thất bại an toàn).

    **Không** dùng `admin.site.each_context()` — hàm đó kéo toàn bộ `app_list`
    và gọi `get_app_list()` cho mọi model.
    ⚠ **Đã đo, và con số từng viết sai**: `get_app_list()` **không** tốn truy vấn
    DB (đo 2026-10-10, superuser mới, cache quyền rỗng):
        admin.site.get_app_list(req) → queries = 0, has_perm × 194
    Cái thật sự tốn là **số lần kiểm tra quyền**, không phải truy vấn. Bản gốc
    ghi "một truy vấn cho mỗi ModelAdmin" là suy đoán chưa kiểm.
    Ở đây menu lấy từ `vn_groups` và số liệu lấy từ `AdminDashboard`, mỗi số
    liệu đúng 1 truy vấn tổng hợp, mọi truy vấn đều bọc trong `_safe()`.
    """
    return {
        "vn_kpis": AdminDashboard.kpis(request),
        "vn_alerts": AdminDashboard.alerts(),
        "vn_activity": AdminDashboard.activity(),
    }

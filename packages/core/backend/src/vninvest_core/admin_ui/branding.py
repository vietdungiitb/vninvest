"""Branding + nhóm chức năng cho sidebar Django admin.

Vì sao tách riêng
-----------------
`admin.site.site_header` là **trạng thái toàn cục**. Trước đây nó được set
trong `identity_access/admin.py:34-36`. Vì `identity_access` nằm **sau**
`vninvest_core` trong `INSTALLED_APPS` (`settings.py:115-116`), module admin
của nó được autodiscover **sau**, nên nó ghi đè bất kỳ ai set trước đó. Đặt
branding ở 2 nơi là 2 nguồn sự thật với thứ tự thắng thua ngầm — đúng cái loại
lỗi đã được ghi nhận trong `AGENTS.md` (mục AI CC: "4 nguồn default prompt
config mỗi nơi một giá trị"). Nay chỉ còn 1 nơi.
"""

from __future__ import annotations

from django.contrib import admin

# ---------------------------------------------------------------------------
# Nhóm chức năng — theo nghiệp vụ vận hành, KHÔNG theo app_label kỹ thuật.
#
# Thứ tự nhóm là thứ tự hiển thị. Model chưa khai báo trong bản đồ sẽ tự rơi
# vào `DEFAULT_GROUP` (AC S4-AC3: model mới không cần sửa tuple này).
#
# Key là `app_label.model_name` — KHÔNG phải tên lớp Python, để ổn định khi
# đổi tên class.
# ---------------------------------------------------------------------------

MENU_GROUPS: tuple[dict, ...] = (
    {
        "key": "ops",
        "label": "Vận hành & Dữ liệu",
        "icon": "⚙",
        "models": (
            # Nguồn dữ liệu thị trường
            "market_data.StockProfile",
            "market_data.DailyPrice",
            "market_data.VnbrokerRuntimeConfig",
            "market_serving.SymbolSnapshot",
            "market_serving.SessionFacts",
            # Hạ tầng thu thập
            "data_ingest.IngestJob",
            "data_ingest.IngestRun",
            # Sức khoẻ dịch vụ + quét + backfill
            "service_ops.ServiceDefinition",
            "service_ops.ServiceConfig",
            "service_ops.ServiceHealth",
            "service_ops.ServiceHealthCheckLog",
            "service_ops.ServiceRunLog",
            "service_ops.MarketDataParitySnapshot",
            "service_ops.OwnershipRecord",
            "service_ops.ConfigChangeAudit",
            "service_ops.ScrapeMatrix",
            "service_ops.ScrapeMatrixCell",
            "service_ops.CustomSymbolGroup",
            "service_ops.CachedSymbolGroup",
            "service_ops.CachedSymbolGroupMember",
            "service_ops.BackfillExecutionRun",
            "service_ops.BackfillExecutionBatch",
        ),
    },
    {
        "key": "signals",
        "label": "Tín hiệu & Cảnh báo",
        "icon": "◈",
        "models": (
            "signal_intelligence.UnifiedAlert",
            "signal_intelligence.WhaleAlertCanonical",
            "signal_intelligence.OrderFlowEvent",
        ),
    },
    {
        "key": "customers",
        "label": "Khách hàng & Doanh thu",
        "icon": "◆",
        "models": (
            "identity_access.CoreTenant",
            "identity_access.TenantSettings",
            "identity_access.TenantMember",
            "identity_access.TenantInvite",
            "identity_access.UserProfile",
            "identity_access.CoreServiceAccount",
            "identity_access.CorePATCredential",
            "identity_access.SystemMailConfig",
            "identity_access.MailConfigAuditLog",
            "commercial.Subscription",
            "commercial.QuotaRecord",
            "commercial.Invoice",
            "tenant_lifecycle.TenantLifecycleEvent",
        ),
    },
    {
        "key": "portfolio",
        "label": "Danh mục & Giao dịch",
        "icon": "▤",
        "models": (
            "user_workspace.Portfolio",
            "user_workspace.Transaction",
            "user_workspace.Watchlist",
            "user_workspace.WatchlistItem",
        ),
    },
    {
        "key": "ai",
        "label": "AI & Tư vấn",
        "icon": "✦",
        "models": (
            "advisory.SystemAISettings",
            "advisory.AdvisorySession",
            "advisory.AdvisoryRecord",
            "advisory.AdvisoryComponent",
            "advisory.UserAICredential",
            "ai_agents.AgentRegistry",
            "ai_analytics.AIUsageRecord",
            "ai_analytics.AIUsageSummary",
        ),
    },
    {
        "key": "support",
        "label": "Hỗ trợ khách hàng",
        "icon": "✉",
        "models": (
            "support.SupportTicket",
            "support.TicketMessage",
            "support.TicketAttachment",
            "support.TicketAuditLog",
            "support.TicketCategory",
            "support.TicketPriority",
            "support.TicketStatus",
            "support.TicketCounter",
            "support.SenderRole",
        ),
    },
    {
        "key": "content",
        "label": "Quảng cáo",
        "icon": "◐",
        "models": (
            "advertising.AdCampaign",
            "advertising.AdDailySummary",
            "advertising.AdImpressionLog",
            "advertising.AdClickLog",
        ),
    },
    {
        "key": "jobs",
        "label": "Tác vụ nền",
        "icon": "⏱",
        "models": (
            # `django_celery_beat` tự đăng ký 5 model lịch chạy. Không khai báo
            # ở đây thì chúng rơi vào nhóm dự phòng "Khác" — đã đo được trước khi
            # thêm mục này (probe: `*** KHAC *** django_celery_beat.periodictask`).
            "django_celery_beat.PeriodicTask",
            "django_celery_beat.ClockedSchedule",
            "django_celery_beat.CrontabSchedule",
            "django_celery_beat.SolarSchedule",
            "django_celery_beat.IntervalSchedule",
        ),
    },
    {
        "key": "system",
        "label": "Nhật ký & Hệ thống",
        "icon": "⬡",
        "models": (
            "ops_audit.AuditEvent",
            "ops_audit.RequestTrace",
            "auth.User",
            "auth.Group",
        ),
    },
)

#: Nhóm dự phòng cho model chưa khai báo (AC S4-AC3).
DEFAULT_GROUP_KEY = "system"

#: Nhãn của `DEFAULT_GROUP_KEY`, lấy từ `MENU_GROUPS` nếu tồn tại.
DEFAULT_GROUP_LABEL = "Khác"

def group_key(app_label: str, model_name: str = "") -> str:
    """Chuẩn hoá một cặp `(app_label, model_name)` thành khoá tra cứu.

    Hàm **thuần**, nhận cả dạng `"identity_access.CoreTenant"` lẫn
    `("identity_access", "coretenant")` — hai dạng đều ra cùng một khoá.
    """
    if isinstance(app_label, str) and "." in app_label and not model_name:
        app_label, _, model_name = app_label.partition(".")
    return f"{app_label}.{model_name}".lower()


#: Bản đồ phẳng `app_label.model_name -> group key`, dựng **một lần** lúc import.
#: `MENU_GROUPS` là tuple hằng nên phẳng hoá ở đây là đủ; không cần dựng lại mỗi
#: lần render sidebar.
#:
#: ⚠ Khoá được **chuẩn hoá về chữ thường** bằng `group_key()`. `Model._meta.model_name`
#: của Django luôn là chữ thường (`CoreTenant` -> `coretenant`), còn khai báo trong
#: `MENU_GROUPS` dùng tên lớp Python cho dễ đọc. Không chuẩn hoá thì **không mục
#: nào** khớp và toàn bộ model rơi vào nhóm dự phòng — đã xảy ra và đã đo được
#: (probe in ra `GROUPS: [('•', 'Khác', '41')]`).
_MODEL_INDEX: dict[str, str] = {}
for _group in MENU_GROUPS:
    for _model in _group["models"]:
        # Nhóm sau ghi đè nhóm trước: `system` được khai sau `customers`, nên
        # `auth.User` vẫn thuộc `system`. Trùng cố ý = đổi nhóm bằng cách
        # đổi thứ tự khai báo, không cần sửa code khác.
        _MODEL_INDEX[group_key(_model)] = _group["key"]


def group_for_model(app_label: str, model_name: str = "") -> dict:
    """Trả về dict nhóm chứa `app_label.model_name`, hoặc nhóm dự phòng.

    Trả về **dict nhóm**, không phải key, để template không phải tra cứu lần 2.
    """
    key = _MODEL_INDEX.get(group_key(app_label, model_name), DEFAULT_GROUP_KEY)
    for group in MENU_GROUPS:
        if group["key"] == key:
            return group
    # Chỉ tới được khi `DEFAULT_GROUP_KEY` không khớp group nào — cấu hình sai.
    return {"key": DEFAULT_GROUP_KEY, "label": DEFAULT_GROUP_LABEL, "icon": "•", "models": ()}


def apply_branding() -> None:
    """Đặt branding của admin site. Gọi **một lần** từ `vninvest_core/admin.py`.

    Đây là nơi duy nhất được phép ghi `admin.site.site_*`.
    """
    admin.site.site_header = "VNInvest — Trung tâm điều hành"
    admin.site.site_title = "VNInvest Admin"
    admin.site.index_title = "Sơ đồ vận hành hệ thống"


# ⚠ KHÔNG thêm hàm nào đổi `Model._meta.verbose_name` ở đây.
#
# Đã thử và **đo** rồi, không đoán: gọi một hàm đổi `_meta.verbose_name` từ
# `vninvest_core/admin.py` **không có tác dụng**. Lý do đo được: Django autodiscover
# admin module của `vninvest_core` **trước** `identity_access` (thứ tự
# `INSTALLED_APPS`, settings.py:115-116), lúc đó `admin.site._registry` còn trống
# phần lớn ⇒ không model nào được đổi nhãn. Probe in ra `Core Tenant` (tiếng Anh).
#
# ⇒ Nhãn tiếng Việt được đổi ở **tầng trình bày**
# (`admin_ui/context_processors.py` + template admin của ta), nơi luôn thấy đủ
# registry và không phải ghi trạng thái toàn cục. Xem
# `admin_ui/context_processors.py` module docstring để biết vì sao.

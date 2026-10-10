"""VNInvest Admin — lớp trình bày dùng chung cho Django admin.

Mục đích: đưa Django admin (mặc định của Django) lên mức giao diện của một sản
phẩm thương mại — có design system, dashboard vận hành, chuẩn hoá bảng dữ liệu
và đạt WCAG 2.2 AA.

Nguyên tắc bất di bất dịch
--------------------------
1. **Lớp này KHÔNG đổi nghiệp vụ.** Chỉ đổi *cách hiển thị* và *cách điều hướng*.
   Mọi `has_*_permission` sẵn có của app giữ nguyên.
2. **URL gốc không đổi.** Đổi menu nhóm không được đổi `/admin/<app>/<model>/`
   (`docs/ADMIN_UI_IMPLEMENTATION_STEPS.md:80` yêu cầu rõ).
3. **Một nguồn sự thật.** Branding chỉ đặt ở đây; các `admin.py` của app
   không tự set `site_header` nữa (trước đây `identity_access/admin.py` tự set
   ⇒ 2 nơi cùng quyền ghi, nhưng thứ tự import quyết định thắng thua).
4. **Không có migration.** Đăng ký admin không sinh migration.

Tham chiếu thiết kế: `docs/saas_design_pack/D08_UI_UX_DESIGN_20261002.md`
§12 (design system) và §13 (WCAG 2.2 AA).
"""

from .branding import MENU_GROUPS, apply_branding, group_for_model
from .context_processors import admin_ui as admin_ui_context
from .dashboard import AdminDashboard, dashboard_context
from .display import (
    badge,
    badge_for,
    datetime_vi,
    decimal_vi,
    empty_dash,
    money_vi,
    percent_vi,
)
from .labels import MODEL_LABELS, label_for, status_label
from .mixins import VNAdminMixin, VNReadOnlyMixin

__all__ = [
    "MENU_GROUPS",
    "MODEL_LABELS",
    "AdminDashboard",
    "VNAdminMixin",
    "VNReadOnlyMixin",
    "admin_ui_context",
    "apply_branding",
    "badge",
    "badge_for",
    "dashboard_context",
    "datetime_vi",
    "decimal_vi",
    "empty_dash",
    "group_for_model",
    "label_for",
    "money_vi",
    "percent_vi",
    "status_label",
]

"""Kiểm thử lớp trình bày Django admin — `vninvest_core.admin_ui`.

Mỗi test gắn với **một** tiêu chí nghiệm thụ trong
`docs/PLAN_DJANGO_ADMIN_UIUX_20261010.md` §5. Tên test chứa mã AC để khi một
AC đổi trạng thái, người đọc biết ngay cái gì hỏng.

Nguyên tắc (skill `multi-agent-workflow` hazard 8 — proxy observable)
------------------------------------------------------------------
Không test "file CSS tồn tại" hay "hàm không ném lỗi". Mọi khẳng định giao diện
đều kiểm **thứ người dùng nhìn thấy**: HTML render ra có đúng lớp/liên kết/label
hay không. Test định dạng thì kiểm **chuỗi đầu ra đúng bằng chữ**, không kiểm
"hàm được gọi".
"""

from __future__ import annotations

import datetime as dt
import re
from decimal import Decimal
from pathlib import Path

from django.contrib import admin
from django.contrib.auth.models import User
from django.test import Client, TestCase, override_settings
from django.urls import reverse

from vninvest_core.admin_ui import (
    MENU_GROUPS,
    VNReadOnlyMixin,
    badge,
    badge_for,
    datetime_vi,
    decimal_vi,
    empty_dash,
    group_for_model,
    label_for,
    money_vi,
    percent_vi,
    tone_for,
)

BACKEND_ROOT = Path(__file__).resolve().parents[1]
SRC_ROOT = BACKEND_ROOT / "src"
CSS_PATH = SRC_ROOT / "vninvest_core" / "static" / "admin" / "css" / "vnadmin.css"
BASE_TEMPLATE = SRC_ROOT / "vninvest_core" / "templates" / "admin" / "base.html"

#: 28 block mà `django/contrib/admin/templates/admin/base.html` khai báo.
#: Đếm bằng script trên chính file gốc, KHÔNG đếm bằng mắt:
#:   [m.group(1) for m in re.finditer(r"\{%\s*block\s+([a-z0-9\-_]+)", open(django_base))]
DJANGO_ADMIN_BASE_BLOCKS = {
    "blockbots", "bodyclass", "branding", "breadcrumbs", "coltype", "content",
    "content_subtitle", "content_title", "dark-mode-vars", "extrabody", "extrahead",
    "extrastyle", "footer", "header", "messages", "nav-breadcrumbs", "nav-global",
    "nav-sidebar", "object-tools", "pretitle", "responsive", "sidebar", "stylesheet",
    "stylesheet_rtl", "title", "userlinks", "usertools", "welcome-msg",
}


# ---------------------------------------------------------------------------
# S1 — nền tảng
# ---------------------------------------------------------------------------

class BrandingTests(TestCase):
    """S1-AC1 + S4-AC5: branding và nhãn tiếng Việt đến từ một nơi duy nhất."""

    def test_S1_AC1_site_header_set_by_admin_ui(self):
        # Trước đây `identity_access/admin.py` tự set ⇒ 2 nơi cùng quyền ghi.
        # Nay nguồn duy nhất là `vninvest_core/admin.py`.
        self.assertEqual(admin.site.site_title, "VNInvest Admin")
        self.assertIn("VNInvest", admin.site.site_header)

    def test_S4_AC5_model_label_is_vietnamese_with_diacritics(self):
        label = label_for("identity_access", "coretenant")
        self.assertEqual(label, "Tổ chức")
        # `AGENTS.md` Constraints: tiếng Việt đủ dấu.
        self.assertNotIn(label, ("Tenant", "Core Tenant"))


class BaseTemplateTests(TestCase):
    """S1-AC2/S1-AC3: override `base.html` mà không phá template con."""

    def test_S1_AC2_keeps_all_28_django_blocks(self):
        source = BASE_TEMPLATE.read_text(encoding="utf-8")
        declared = {m.group(1) for m in re.finditer(r"\{%\s*block\s+([a-z0-9\-_]+)", source)}
        missing = DJANGO_ADMIN_BASE_BLOCKS - declared
        self.assertEqual(
            missing, set(),
            f"base.html override thiếu block: {sorted(missing)}. "
            "Thiếu block chỉ lộ ra lúc RENDER, không lộ lúc `manage.py check`.",
        )

    def test_S1_AC2_block_count_matches_django_52(self):
        self.assertEqual(len(DJANGO_ADMIN_BASE_BLOCKS), 28)

    def test_S1_AC3_keeps_django_dark_mode_block(self):
        source = BASE_TEMPLATE.read_text(encoding="utf-8")
        # Phá block này là mất chế độ sáng/tối do Django cung cấp.
        self.assertIn("dark-mode-vars", source)
        self.assertIn("color_theme_toggle.html", source)


class TemplateCommentTrapTests(TestCase):
    """Chống tái phát bẫy `{# #}` nhiều dòng đã gặp trong wave này.

    `tag_re` của Django là `({%.*?%}|{{.*?}}|{{.*?}}|{#.*?#})` — **không** có
    `re.DOTALL`, nên `{#` … `#}` **không** bắt được dấu xuống dòng. Django coi
    đoạn đó là text thường và **parse** mọi `{% %}` bên trong. Đã gặp thật:
    `TemplateSyntaxError: 'extends' takes one argument` khi render `/admin/`.
    """

    def test_no_multiline_hash_comments_in_admin_templates(self):
        offenders = []
        for template in (SRC_ROOT / "vninvest_core" / "templates" / "admin").glob("*.html"):
            source = template.read_text(encoding="utf-8")
            for match in re.finditer(r"\{#", source):
                end = source.find("#}", match.start())
                block = source[match.start():end + 2] if end != -1 else source[match.start():]
                if "\n" in block:
                    offenders.append(f"{template.name}:{source[: match.start()].count(chr(10)) + 1}")
        self.assertEqual(
            offenders, [],
            "Comment {# #} nhieu dong KHONG hoat dong trong Django template: "
            f"{offenders}. Dung `{{% comment %}}...{{% endcomment %}}`.",
        )

    def test_comment_blocks_are_balanced(self):
        for template in (SRC_ROOT / "vninvest_core" / "templates" / "admin").glob("*.html"):
            source = template.read_text(encoding="utf-8")
            opened = len(re.findall(r"\{%\s*comment\s*%\}", source))
            closed = len(re.findall(r"\{%\s*endcomment\s*%\}", source))
            self.assertEqual(opened, closed, f"{template.name}: comment/endcomment lệch")


class CssContractTests(TestCase):
    """S1-AC5/AC6/AC7: design token, vùng chạm, giảm chuyển động."""

    def setUp(self):
        # Bỏ comment `/* … */` trước khi quét. Nếu không, chính ghi chú L-F05
        # trong file CSS có chuỗi `transition:` sẽ thành báo động giả —
        # đúng loại lỗi `L-F06` (quét bằng heuristic cửa sổ dòng tạo false
        # positive rồi "sửa" nhầm vào code đúng).
        self.css = re.sub(r"/\*.*?\*/", "", CSS_PATH.read_text(encoding="utf-8"), flags=re.S)

    def test_S1_AC5_d08_palette_tokens_present(self):
        # 9 giá trị lấy nguyên văn từ docs/saas_design_pack/D08 §12.1.
        for token, value in [
            ("--vn-bg", "#0f1117"),
            ("--vn-surface", "#161922"),
            ("--vn-border", "#242838"),
            ("--vn-text", "#e8eaf0"),
            ("--vn-text-muted", "#9aa0ae"),
            ("--vn-primary", "#3b82f6"),
            ("--vn-success", "#22c55e"),
            ("--vn-warning", "#f59e0b"),
            ("--vn-danger", "#ef4444"),
        ]:
            self.assertIn(f"{token}: {value};", self.css, f"thiếu token D08 {token}")

    def test_S1_AC5_bloomberg_gain_loss_direction(self):
        # L-F08: Owner chốt 2026-10-07 — Việt Nam dùng chuẩn GIONG Bloomberg.
        self.assertIn("--vn-gain: #22c55e;", self.css)   # xanh = tăng
        self.assertIn("--vn-loss: #ef4444;", self.css)   # đỏ = giảm

    def test_S1_AC6_touch_target_min_24px(self):
        # D08 §13: vùng chạm tối thiểu 24×24px.
        self.assertIn("--vn-tap: 24px;", self.css)

    def test_S1_AC7_reduced_motion_supported(self):
        self.assertIn("prefers-reduced-motion: reduce", self.css)

    def test_LF05_every_transition_keeps_duration(self):
        """L-F05: khai báo transition mất `<time>` ⇒ chuyển động cắt cụt.

        `transition: color;` mặc định `transition-duration: 0s`. Bắt mọi
        transition phải có thời lượng.
        """
        broken = []
        for match in re.finditer(r"transition:\s*([^;]+);", self.css):
            value = match.group(1)
            if "var(--vn-dur" in value or "0.01ms" in value:
                continue
            if not re.search(r"\d+(\.\d+)?m?s", value):
                broken.append(value.strip())
        self.assertEqual(broken, [], f"transition khong giu thoi luong: {broken}")


# ---------------------------------------------------------------------------
# S3 — định dạng hiển thị
# ---------------------------------------------------------------------------

class DisplayTests(TestCase):
    """S3-AC3/AC4/AC5/AC6: badge, tiền, ngày, giá trị rỗng."""

    def test_S3_AC4_money_vi_uses_dot_thousands_and_symbol_first(self):
        # D08 §14.2: đúng là `199.000 ₫`, **sai** là `₫199.000`.
        # Cụm "ký hiệu trước" trong bảng tiếng Việt dễ đọc nhầm thành "ký hiệu đặt
        # trước số" — ví dụ mẫu mới là chuẩn.
        self.assertEqual(str(money_vi(Decimal("1240000"), "VND")), "1.240.000 ₫")
        self.assertEqual(str(money_vi(Decimal("-2500"), "VND")), "-2.500 ₫")
        self.assertEqual(str(money_vi(Decimal("1234.5"), "USD")), "1.234,50 $")

    def test_S3_AC4_decimal_vi_vietnamese_separators(self):
        self.assertEqual(str(decimal_vi(Decimal("1234567.89"))), "1.234.567,89")
        # Giá trị rỗng trả về ô có gạch dài + lớp CSS, nên kiểm "chứa" chứ
        # không kiểm "bằng" — đây là chủ ý (S3-AC6 cần lớp để tô xám).
        self.assertIn("—", str(decimal_vi(None)))

    def test_S3_AC5_datetime_vi_ddmmyyyy(self):
        value = dt.datetime(2026, 10, 10, 14, 5)
        self.assertIn("10/10/2026", str(datetime_vi(value)))
        self.assertIn("14:05", str(datetime_vi(value)))

    def test_S3_AC5_datetime_vi_empty(self):
        self.assertIn("—", str(datetime_vi(None)))

    def test_S3_AC6_empty_value_display_uses_dash(self):
        self.assertIn("—", str(empty_dash()))
        self.assertIn("vn-empty", str(empty_dash()))

    def test_S3_AC3_badge_always_has_text(self):
        """D08 §13: không chỉ dựa vào màu — badge phải có CHỮ."""
        rendered = str(badge("Đang hoạt động", "success"))
        self.assertIn("Đang hoạt động", rendered)
        self.assertIn("vn-badge--success", rendered)

    def test_S3_AC3_tone_mapping(self):
        self.assertEqual(tone_for("active"), "success")
        self.assertEqual(tone_for("failed"), "danger")
        self.assertEqual(tone_for("pending"), "warning")
        # Giá trị lạ ⇒ trung tính, KHÔNG đoán tone.
        self.assertEqual(tone_for("trang_thái_la"), "neutral")
        self.assertEqual(tone_for(None), "neutral")

    def test_S3_AC3_badge_for_boolean(self):
        self.assertIn("Có", str(badge_for(True)))
        self.assertIn("Không", str(badge_for(False)))

    def test_percent_vi_keeps_sign(self):
        self.assertIn("+1,25%", str(percent_vi(Decimal("1.25"))))
        self.assertIn("-1,25%", str(percent_vi(Decimal("-1.25"))))


class ModelAdminContractTests(TestCase):
    """S3-AC2/AC6/AC7/AC8/AC9: hợp đồng của từng ModelAdmin."""

    #: App **của ta**. `django.contrib.*` và `django_celery_beat.*` không dùng
    #: `VNAdminMixin` và không thuộc phạm vi refactor này — đòi họ tuân thủ
    #: hợp đồng là đòi sửa thư viện bên thứ ba (xem PLAN §1.2, non-goal N3).
    OWN_APPS = {
        "identity_access", "market_serving", "signal_intelligence", "commercial",
        "tenant_lifecycle", "ops_audit", "data_ingest", "advisory", "user_workspace",
        "market_data", "service_ops", "support", "advertising", "ai_agents",
        "ai_analytics",
    }

    @classmethod
    def _own_admins(cls):
        return {
            model.__name__: model_admin
            for model, model_admin in admin.site._registry.items()
            if model._meta.app_label in cls.OWN_APPS
        }

    def _admins_of(self, app_label):
        return {
            model._meta.model_name: model_admin
            for model, model_admin in admin.site._registry.items()
            if model._meta.app_label == app_label
        }

    def test_S3_AC6_every_own_admin_has_empty_value_display(self):
        missing = [
            name for name, model_admin in self._own_admins().items()
            if getattr(model_admin, "empty_value_display", "") != "—"
        ]
        self.assertEqual(missing, [], f"ModelAdmin chưa dat empty_value_display: {missing}")

    def test_S3_AC2_every_own_admin_has_time_filter_or_hierarchy(self):
        """Mọi bảng vận hành phải lọc được theo thời gian, nếu không thì
        nhân viên vận hành không tìm được bản ghi của hôm."""
        missing = []
        for name, model_admin in self._own_admins().items():
            # Ngoại lệ có tên: bảng ánh xạ thuần không có cột thời gian nào
            # (hiện chỉ `CachedSymbolGroupMember`). Bỏ qua có tên ≠ bỏ qua
            # im lặng — gate `check_admin_ux.py` in ra danh sách ngoại lệ.
            if getattr(model_admin, "vn_no_time_filter", False):
                continue
            has_hierarchy = bool(getattr(model_admin, "date_hierarchy", None))
            has_date_filter = any(
                getattr(f, "name", "").startswith((
                    "created_at", "updated_at", "occurred_at", "date",
                    "started_at", "session_date", "period_start", "period_end",
                    "current_period_start", "last_message_at", "applied_at",
                    "checked_at", "claimed_at", "captured_at", "generated_at",
                    "synced_at", "executed_at", "joined_at", "expires_at",
                ))
                for f in model_admin.list_filter
            )
            if not (has_hierarchy or has_date_filter):
                missing.append(name)
        self.assertEqual(missing, [], f"ModelAdmin khong loc duoc theo thoi gian: {missing}")

    def test_S3_AC8_readonly_models_still_block_writes(self):
        """Hành vi bảo mật: bảng nhật ký không được sửa tay.

        Trước đây mỗi app tự viết 3 hàm `has_*_permission` trả `False`. Nay gom
        vào `VNReadOnlyMixin` — test này khoá lại để lần refactor sau không nới.
        """
        protected = [
            model.__name__ for model, model_admin in admin.site._registry.items()
            if isinstance(model_admin, VNReadOnlyMixin)
        ]
        self.assertIn("AuditEvent", protected)
        self.assertIn("RequestTrace", protected)
        self.assertIn("TenantLifecycleEvent", protected)

    def test_S3_AC9_secret_fields_stay_readonly(self):
        model_admin = self._admins_of("identity_access")["corepatcredential"]
        self.assertIn("token_secret_hash", model_admin.readonly_fields)
        self.assertIn("token_prefix", model_admin.readonly_fields)

    def test_S3_AC7_support_ticket_has_select_related(self):
        model_admin = self._admins_of("support")["supportticket"]
        for field in ("tenant", "requester", "assignee"):
            self.assertIn(field, model_admin.list_select_related)


# ---------------------------------------------------------------------------
# S2 + S4 — dashboard và menu
# ---------------------------------------------------------------------------

class KpiPermissionTests(TestCase):
    """Thẻ KPI không được trỏ tới bảng người dùng KHÔNG có quyền.

    ⚠ Đây là lỗi **đã xảy ra và đã sửa**: `kpis()` ban đầu luôn gắn link
    changelist. Đo 2026-10-10 với staff chỉ có `identity_access.view_dailyprice`:
    cả 4 thẻ đều có link, trong đó `/admin/identity_access/coretenant/`,
    `/admin/auth/user/`, `/admin/user_workspace/transaction/` đều trả **403**.
    Sidebar đã lọc đúng từ trước — chỉ dashboard sai.
    """

    def setUp(self):
        from django.contrib.auth.models import Group, Permission

        self.limited = User.objects.create_user(
            "kpi_limited", "kpi@example.com", "x", is_staff=True
        )
        group, _ = Group.objects.get_or_create(name="VN_KPI_LIMITED")
        group.permissions.set(Permission.objects.filter(codename="view_dailyprice"))
        self.limited.groups.add(group)
        self.client.force_login(self.limited)

    def test_kpi_links_only_for_permitted_models(self):
        self.assertFalse(self.limited.has_perm("identity_access.view_coretenant"))
        html = self.client.get(reverse("admin:index")).content.decode("utf-8")
        self.assertNotIn("/admin/identity_access/coretenant/", html)
        self.assertNotIn("/admin/auth/user/", html)
        self.assertNotIn("/admin/user_workspace/transaction/", html)
        self.assertNotIn("/admin/commercial/quotarecord/", html)

    def test_permitted_model_still_linked_in_sidebar(self):
        html = self.client.get(reverse("admin:index")).content.decode("utf-8")
        self.assertIn("/admin/market_data/dailyprice/", html)

    def test_kpi_values_still_render_without_links(self):
        """Bỏ link KHÔNG được bỏ luôn số liệu — thẻ vẫn phải hiện giá trị."""
        html = self.client.get(reverse("admin:index")).content.decode("utf-8")
        self.assertIn("vn-kpi-card__value", html)
        self.assertIn("Tổ chức", html)


class DashboardTests(TestCase):
    """S2-AC1/AC2/AC4: trang chủ vận hành."""

    def setUp(self):
        self.staff = User.objects.create_superuser("admin_staff", "a@example.com", "x")
        self.client.force_login(self.staff)

    def test_S2_AC1_index_shows_four_kpis_with_values(self):
        response = self.client.get(reverse("admin:index"))
        self.assertEqual(response.status_code, 200)
        html = response.content.decode("utf-8")
        for key in ("tenant", "user", "transaction", "quota"):
            self.assertIn(f'id="vn-kpi-{key}"', html, f"thiếu thẻ KPI {key}")
        self.assertIn("Tổng quan hệ thống", html)

    def test_S2_AC2_empty_database_shows_zero_not_none(self):
        """DB rỗng ⇒ 4 thẻ hiện 0, không phải None/không render."""
        response = self.client.get(reverse("admin:index"))
        html = response.content.decode("utf-8")
        self.assertNotIn(">None<", html)
        self.assertIn("Tổ chức", html)

    def test_S2_AC3_stale_price_alert_appears_when_data_old(self):
        from market_data.models import DailyPrice

        DailyPrice.objects.create(
            symbol="VIC", date=dt.date.today() - dt.timedelta(days=9),
            open=1, high=1, low=1, close=1, volume=0, value=0,
            change_pct=0, source="test", is_adjusted=True,
        )
        response = self.client.get(reverse("admin:index"))
        html = response.content.decode("utf-8")
        self.assertIn("Dữ liệu giá đã cũ", html)

    def test_S2_AC4_broken_query_does_not_break_page(self):
        """AC S2-AC4: lỗi ở MỘT số liệu không được làm hỏng trang chủ.

        Trang chủ admin là nơi vào đầu tiên sau khi sự cố; trả 500 ở đây là
        che mất công cụ đúng lúc cần nhất.
        """
        from vninvest_core.admin_ui import dashboard

        original = dashboard.AdminDashboard._count_tenants
        dashboard.AdminDashboard._count_tenants = staticmethod(
            lambda: (_ for _ in ()).throw(RuntimeError("co loi DB"))
        )
        try:
            with self.assertLogs("vninvest_core.admin_ui.dashboard", level="WARNING"):
                response = self.client.get(reverse("admin:index"))
        finally:
            dashboard.AdminDashboard._count_tenants = original

        self.assertEqual(response.status_code, 200)
        html = response.content.decode("utf-8")
        self.assertIn("vn-kpi-card__value--error", html)
        # 3 thẻ còn lại vẫn có số.
        self.assertNotEqual(html.count("vn-kpi-card__value--error"), 4)


class MenuTests(TestCase):
    """S4-AC1/AC2/AC3: menu nhóm theo nghiệp vụ, URL không đổi."""

    def setUp(self):
        self.staff = User.objects.create_superuser("menu_staff", "m@example.com", "x")
        self.client.force_login(self.staff)

    def test_S4_AC1_menu_grouped_by_business_not_by_app(self):
        html = self.client.get(reverse("admin:index")).content.decode("utf-8")
        self.assertIn("Vận hành &amp; Dữ liệu", html)
        self.assertIn("Khách hàng &amp; Doanh thu", html)
        # Tên app kỹ thuật không được làm tiêu đề nhóm.
        self.assertNotIn(">identity_access<", html)

    def test_S4_AC2_original_admin_urls_unchanged(self):
        """Đổi cách nhóm KHÔNG được đổi URL — `ADMIN_UI_IMPLEMENTATION_STEPS.md:80`."""
        self.assertEqual(
            reverse("admin:identity_access_coretenant_changelist"),
            "/admin/identity_access/coretenant/",
        )
        self.assertEqual(
            reverse("admin:commercial_invoice_changelist"),
            "/admin/commercial/invoice/",
        )
        response = self.client.get("/admin/identity_access/coretenant/")
        self.assertEqual(response.status_code, 200)

    def test_S4_AC3_unmapped_model_lands_in_fallback_group(self):
        """Model đăng ký admin nhưng chưa khai báo trong MENU_GROUPS vẫn hiện.

        ⚠ KHÔNG so kết quả với tên nhóm `"system"`: `system` là một nhóm **có
        thật** trong `MENU_GROUPS` (`auth.User`, `ops_audit.AuditEvent`…), nên
        so bằng tên sẽ báo nhầm mọi model thuộc nhóm đó. Phải tra **trực tiếp**
        chỉ mục `_MODEL_INDEX`.
        """
        from vninvest_core.admin_ui.branding import _MODEL_INDEX
        from vninvest_core.admin_ui.context_processors import _model_index

        index = _model_index()
        unmapped = [key for key in index if key not in _MODEL_INDEX]
        self.assertEqual(
            [k for k in unmapped if not k.startswith(("auth.", "django_celery_beat."))],
            [],
            "Model đăng ký admin nhưng rơi vào nhóm dự phòng",
        )

        html = self.client.get(reverse("admin:index")).content.decode("utf-8")
        self.assertIn("Sơ đồ chức năng", html)
        # Model chưa khai báo vẫn xuất hiện trong sơ đồ chức năng.
        self.assertIn("django_celery_beat", html)

    def test_menu_groups_are_unique_and_ordered(self):
        keys = [group["key"] for group in MENU_GROUPS]
        self.assertEqual(len(keys), len(set(keys)), "trùng key nhóm")
        self.assertTrue(all(group["label"] for group in MENU_GROUPS))


# ---------------------------------------------------------------------------
# Render smoke — AC S1-AC2 nói rõ: phải RENDER, không chỉ `manage.py check`
# ---------------------------------------------------------------------------

class AdminRenderSmokeTests(TestCase):
    """Mọi trang admin phải render được, không chỉ `manage.py check`."""

    @classmethod
    def setUpTestData(cls):
        cls.staff = User.objects.create_superuser("smoke_staff", "s@example.com", "x")

    def setUp(self):
        self.client.force_login(self.staff)

    def test_S1_AC1_body_carries_vnadmin_hook_and_css_link(self):
        html = self.client.get(reverse("admin:index")).content.decode("utf-8")
        self.assertIn("vnadmin", html)
        # `CompressedManifestStaticFilesStorage` (settings.py) **đổi tên** file
        # kèm hash: `vnadmin.css` → `vnadmin.ac209d0784fe.css`. Không thể assert
        # chuỗi `vnadmin.css` — phải assert theo **đường dẫn** `admin/css/vnadmin`.
        # (Đây là lý do AC S1-AC1 viết "người dùng thấy giao diện mới", không
        # phải "tồn tại file tên vnadmin.css".)
        self.assertRegex(html, r'href="/static/admin/css/vnadmin\.[0-9a-f]+\.css"')
        self.assertRegex(html, r'src="/static/admin/js/vnadmin-nav\.[0-9a-f]+\.js"')

    def test_every_changelist_renders(self):
        failures = []
        for model, _model_admin in admin.site._registry.items():
            url = reverse(
                f"admin:{model._meta.app_label}_{model._meta.model_name}_changelist"
            )
            response = self.client.get(url)
            if response.status_code != 200:
                failures.append(f"{url} -> {response.status_code}")
        self.assertEqual(failures, [], f"trang changelist hong: {failures}")

    def test_every_change_form_renders(self):
        failures = []
        for model, _model_admin in admin.site._registry.items():
            url = reverse(
                f"admin:{model._meta.app_label}_{model._meta.model_name}_add"
            )
            response = self.client.get(url)
            if response.status_code not in (200, 403):
                failures.append(f"{url} -> {response.status_code}")
        self.assertEqual(failures, [], f"trang them/sua hong: {failures}")

    def test_popup_view_uses_same_shell(self):
        """Popup dùng chung `base.html` — thiếu block sẽ chỉ lộ ở đây.

        `admin:autocomplete` là POST + cần quyền, nên ta kiểm qua URL mà popup
        thật sự dùng: `?_popup=1`. Trước đây test gọi thẳng `reverse(
        'admin:autocomplete')` và nhận 403 — **đó là hành vi đúng**, nên test
        cũ sai chứ không phải code sai (L-G04: phải kiểm chứng từng "lỗi" bằng
        tay trước khi sửa).
        """
        url = reverse("admin:identity_access_coretenant_changelist") + "?_popup=1"
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertIn("vnadmin", response.content.decode("utf-8"))

    def test_login_page_renders(self):
        self.client.logout()
        response = self.client.get("/admin/login/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("vnadmin", response.content.decode("utf-8"))


class StaticAssetTests(TestCase):
    """S1-AC4: `collectstatic` + manifest phải tìm thấy file mới."""

    @override_settings(DEBUG=False)
    def test_S1_AC4_static_url_resolves(self):
        from django.templatetags.static import static

        # Với `CompressedManifestStaticFilesStorage` (settings.py), file không có
        # trong manifest sẽ ném `ValueError` — đúng lúc này ta muốn biết.
        with self.settings(
            STORAGES={
                "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
                "staticfiles": {
                    "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"
                },
            }
        ):
            self.assertTrue(static("admin/css/vnadmin.css").endswith("vnadmin.css"))
            self.assertTrue(static("admin/js/vnadmin-nav.js").endswith("vnadmin-nav.js"))

    def test_static_files_exist_in_app_dir(self):
        for relative in (
            "vninvest_core/static/admin/css/vnadmin.css",
            "vninvest_core/static/admin/js/vnadmin-nav.js",
        ):
            self.assertTrue((SRC_ROOT / relative).is_file(), f"thiếu {relative}")


class ClientSanityTests(TestCase):
    """Bảo đảm Client dùng trong test này không vô tình dựa vào thứ gì khác."""

    def test_client_is_available(self):
        self.assertIsInstance(Client(), Client)

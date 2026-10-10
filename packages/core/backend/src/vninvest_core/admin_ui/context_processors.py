"""Context processor cho template Django admin.

Vì sao cần
----------
Menu admin mặc định của Django nhóm theo **app** (`identity_access`,
`market_serving`…) — tức là đúng cách tổ chức *source code*. Người vận hành
không biết `identity_access` là gì; họ biết "tổ chức", "giao dịch", "cảnh báo".

`admin/app_list.html` của Django nhận `app_list` đã gom sẵn theo app từ
`AdminSite.get_app_list()`. Để nhóm theo nghiệp vụ mà không phải fork toàn bộ
`get_app_list()`, ta dựng cấu trúc **riêng** ở đây rồi template admin của ta
dùng nó.

Vì sao dựng ở đây chứ không đổi `_meta.verbose_name`
---------------------------------------------------
`_meta` là **trạng thái toàn cục** và bị ghi lúc `autodiscover()` — lúc đó
`identity_access/admin.py` **chưa** chạy, nên `CoreTenant` còn chưa có trong
`admin.site._registry`. Đo thực nghiệm: `apply_model_labels()` gọi từ
`vninvest_core/admin.py` **không** đổi được nhãn của `CoreTenant` (probe
2026-10-10 in ra `Core Tenant`). Trì hoãn sang lúc có request thì được, nhưng
thì mất tiêu đề tiếng Việt trên **mọi** trang changelist.

Cách đã chọn: để `_meta` nguyên vẹn, đổi tên ở **tầng trình bày**. Không có
trạng thái toàn cục nào bị ghi, nên không có "nguồn sự thật thứ hai".

Chi phí — đo thật 2026-10-10 (superuser mới, cache quyền rỗng)
----------------------------------------------------------
::

    admin.site.get_app_list(req)  →  queries = 0, has_perm × 194
    build_groups(req)             →  queries = 0, has_perm × 130

⚠ Bản docstring gốc của module này ghi "`get_app_list()` tốn **một truy vấn cho
mỗi ModelAdmin**" — đó là **suy đoán chưa kiểm**, và **sai**: cả hai đều 0
truy vấn. Cái thật sự giảm là **64 lần kiểm tra quyền** (−33%). Giữ con số đã
đo, kèm lệnh, thay vì con số nghe hợp lý.
"""

from __future__ import annotations

from django.contrib import admin

from .branding import (
    DEFAULT_GROUP_KEY,
    DEFAULT_GROUP_LABEL,
    MENU_GROUPS,
    group_key,
)
from .labels import label_for

#: `app_label.model_name -> group key`, dựng 1 lần lúc import (tuple hằng).
_MODEL_INDEX: dict[str, str] = {}
for _group in MENU_GROUPS:
    for _model in _group["models"]:
        _MODEL_INDEX[group_key(_model)] = _group["key"]


def _model_index() -> dict[str, object]:
    """`"app_label.model_name" -> lớp Model`, dựng từ `admin.site._registry`.

    Cấu trúc registry đã **đo** trên Django 5.2.15 (bản đang cài)::

        list(admin.site._registry)[:2]
        -> [<class 'django.contrib.auth.models.Group'>, ...]     # KHOÁ = lớp Model
        list(admin.site._registry.values())[:1]
        -> [<class 'market_data.admin.StockProfileAdmin'>]       # GIÁ TRI = ModelAdmin

    Django đổi khoá từ tuple `(app_label, model_name)` sang **lớp Model** ở 5.1.
    Hàm này **không** phụ thuộc kiểu khoá: nó luôn dựng chỉ mục riêng theo chuỗi
    `"app_label.model_name"`, nên đúng trên mọi phiên bản.

    Dựng lại mỗi lần gọi (O(khoá) ~ 41 phần tử, không truy vấn DB) thay vì cache
    ở module scope: registry đầy sau autodiscover, còn module scope được import
    **trước** ⇒ cache sẽ thu được dict rỗng.
    """
    index: dict[str, object] = {}
    for key, value in admin.site._registry.items():
        # Nhánh tương thích: khoá là lớp Model (>=5.1) hoặc tuple (<=5.0).
        model = key if hasattr(key, "_meta") else getattr(value, "model", None)
        if model is None:
            continue
        index[f"{model._meta.app_label}.{model._meta.model_name}".lower()] = model
    return index


def build_groups(request) -> list[dict]:
    """Dựng danh sách nhóm chức năng cho đúng request hiện tại.

    Chỉ model mà request **được phép** mới xuất hiện — không rò rỉ tên bảng mà
    người dùng không có quyền. Đây là cùng nguyên tắc `get_app_list()` của Django.
    """
    index = _model_index()
    groups: list[dict] = []
    seen: set[str] = set()

    for group in MENU_GROUPS:
        entries = []
        for raw_key in group["models"]:
            key = group_key(raw_key)
            model = index.get(key)
            if model is None:
                # Model chưa đăng ký admin (F2 trong PLAN: 78/112 model) hoặc
                # không còn tồn tại. Bỏ qua, KHÔNG làm hỏng menu.
                continue
            app_label = model._meta.app_label
            model_name = model._meta.model_name
            if not request.user.has_perm(f"{app_label}.view_{model_name}"):
                continue
            seen.add(key)
            admin_url = _safe_url(request, f"admin:{app_label}_{model_name}_changelist")
            entries.append(
                {
                    "key": key,
                    "app_label": app_label,
                    "model_name": model_name,
                    "name": model._meta.verbose_name,
                    "label": label_for(raw_key) or label_for(key)
                    or model._meta.verbose_name,
                    "admin_url": admin_url,
                    "add_url": _safe_url(request, f"admin:{app_label}_{model_name}_add"),
                    "is_current": _is_current(request, admin_url),
                    "view_only": not request.user.has_perm(
                        f"{app_label}.change_{model_name}"
                    ),
                }
            )
        if entries:
            groups.append(
                {
                    "key": group["key"],
                    "label": group["label"],
                    "icon": group["icon"],
                    "models": entries,
                }
            )

    leftovers = _unmapped_models(index, seen, request)
    if leftovers:
        groups.append(
            {
                "key": DEFAULT_GROUP_KEY,
                "label": DEFAULT_GROUP_LABEL,
                "icon": "•",
                "models": leftovers,
            }
        )
    return groups


def _unmapped_models(index: dict, seen: set[str], request) -> list[dict]:
    """Model đã đăng ký admin nhưng chưa khai báo trong `MENU_GROUPS`.

    AC S4-AC3: model thêm mới **tự xuất hiện**, không cần sửa danh sách. Nhóm
    dự phòng giữ đúng tên nhóm `system` nếu có, để không sinh nhóm trùng.
    """
    entries = []
    for key, model in index.items():
        if key in seen or key in _MODEL_INDEX:
            continue
        app_label = model._meta.app_label
        model_name = model._meta.model_name
        if not request.user.has_perm(f"{app_label}.view_{model_name}"):
            continue
        admin_url = _safe_url(request, f"admin:{app_label}_{model_name}_changelist")
        entries.append(
            {
                "key": key,
                "app_label": app_label,
                "model_name": model_name,
                "name": model._meta.verbose_name,
                "label": model._meta.verbose_name,
                "admin_url": admin_url,
                "add_url": _safe_url(request, f"admin:{app_label}_{model_name}_add"),
                "is_current": _is_current(request, admin_url),
                "view_only": not request.user.has_perm(f"{app_label}.change_{model_name}"),
            }
        )
    return sorted(entries, key=lambda item: item["label"])


def _safe_url(request, name: str) -> str | None:
    """`reverse()` bọc trong try — model có thể không có changelist (chỉ inline).

    Trả `None` thay vì để `NoReverseMatch` nổi lên: một URL thiếu làm mất một
    mục menu, còn nổi lên thì mất **cả trang**.
    """
    from django.urls import NoReverseMatch, reverse

    try:
        return reverse(name)
    except NoReverseMatch:
        return None


def _is_current(request, url: str | None) -> bool:
    """Đường dẫn hiện tại có nằm trong URL của mục menu không.

    So khớp theo **ranh giới đường dẫn** (`/admin/x/y` bắt đầu bằng `/admin/x/`),
    không dùng `startswith` trần: `/admin/commercial/invoice` cũng bắt đầu bằng
    `/admin/commercial/inv` nếu có model tên `inv…` — sẽ tô sáng nhầm.
    """
    if not url:
        return False
    return request.path == url or request.path.startswith(url.rstrip("/") + "/")


def _is_admin_index(request) -> bool:
    """Đường dẫn này có phải trang chủ admin không?

    So sánh **đường dẫn đã resolve**, không hard-code `"/admin/"`: prefix
    `admin.site.urls` có thể được mount ở nơi khác trong tương lai, và so
    `startswith("/admin/")` sẽ khớp cả `/admin/commercial/` ⇒ chạy 6 truy vấn
    dashboard trên mọi trang app.
    """
    from django.urls import NoReverseMatch, reverse

    try:
        index_url = reverse("admin:index")
    except NoReverseMatch:
        return False
    return request.path.rstrip("/") == index_url.rstrip("/")


def admin_ui(request) -> dict:
    """Context processor. Chỉ chạy khi `request` thuộc phạm vi admin.

    Template admin dùng `RequestContext` ⇒ context processor này áp dụng cho
    **mọi** template, kể cả template render JSON nếu có. Vì vậy phải **rẻ** và
    **an toàn khi không có `request.user`**.

    Menu (`vn_groups`) chỉ đọc registry trong bộ nhớ ⇒ rẻ, chạy mọi trang.
    Số liệu dashboard (`vn_kpis`…) thì **gây truy vấn**, nên chỉ chạy đúng
    trang chủ — nếu không thì mọi trang changelist đều tốn 6 truy vấn thừa.
    """
    user = getattr(request, "user", None)
    if user is None or not getattr(user, "is_active", False):
        return {"vn_groups": []}

    context = {"vn_groups": build_groups(request)}
    if _is_admin_index(request):
        from .dashboard import dashboard_context

        context.update(dashboard_context(request))
    return context

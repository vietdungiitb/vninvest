#!/usr/bin/env python
"""Gate lớp trình bày Django admin — `vninvest_core.admin_ui`.

Vì sao cần
----------
Quy tắc bằng văn bản về design token, WCAG, chuẩn định dạng Việt và bẫy
template Django đã chứng minh không ngăn được gì: trong chính wave này, 6
comment `{# #}` nhiều dòng làm `/admin/` trả 500, `percent_vi` mất dấu âm, và
nhãn tiếng Việt tra trượt vì khoá lệch hoa/thường — **mỗi lỗi đều lọt qua
`manage.py check`**. Chỉ một lệnh **exit khác 0** mới chan được
(`docs/LESSONS/INDEX.md` §1.1: "procedure beats prose").

Cách chạy
---------
    python packages/core/backend/scripts/check_admin_ux.py
    python packages/core/backend/scripts/check_admin_ux.py --self-test

Exit 0 = sạch. Exit 1 = có vi phạm chan. Exit 2 = **không verify được**
(môi trường thiếu) — đây là kết quả hợp lệ, không phải "PASS".
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
SRC = BACKEND / "src"
#: `…/packages/core/backend/scripts/check_admin_ux.py` -> parents[0]=scripts,
#: [1]=backend, [2]=core, [3]=packages, [4]=<repo root>.
REPO = Path(__file__).resolve().parents[4]
ADMIN_UI = SRC / "vninvest_core" / "admin_ui"
TEMPLATES = SRC / "vninvest_core" / "templates" / "admin"
CSS_PATH = SRC / "vninvest_core" / "static" / "admin" / "css" / "vnadmin.css"
JS_PATH = SRC / "vninvest_core" / "static" / "admin" / "js" / "vnadmin-nav.js"
BASE_TEMPLATE = TEMPLATES / "base.html"

#: 28 block của `django/contrib/admin/templates/admin/base.html` (Django 5.2).
#: ĐẾM BẰNG SCRIPT trên chính file thư viện, không đếm bằng mắt.
DJANGO_ADMIN_BASE_BLOCKS = {
    "blockbots", "bodyclass", "branding", "breadcrumbs", "coltype", "content",
    "content_subtitle", "content_title", "dark-mode-vars", "extrabody", "extrahead",
    "extrastyle", "footer", "header", "messages", "nav-breadcrumbs", "nav-global",
    "nav-sidebar", "object-tools", "pretitle", "responsive", "sidebar", "stylesheet",
    "stylesheet_rtl", "title", "userlinks", "usertools", "welcome-msg",
}

#: Tài liệu chuẩn — **NGUỒN SỰ THẬT DUY NHẤT** cho bảng màu của Django admin.
#: O5 (wave 17): trước đây bảng màu bị chép hai lần — một lần trong dict
#: `D08_COLOR_TOKENS` bên dưới, một lần trong `vnadmin.css`. Hai bản chép đó
#: trôi dạt theo thời gian và không cái nào báo cho ai biết. Nay `dict` bị
#: **suy ra từ chính §12.1 của D08**, nên sửa bảng màu trong doc ⇒ gate bắt
#: được ngay lập tức.
D08_DOC = REPO / "docs" / "saas_design_pack" / "D08_UI_UX_DESIGN_20261002.md"

#: Vai trò trong §12.1 → token CSS tương ứng. Đây là **ánh xạ vai trò**, không
#: phải bảng sao chép giá trị màu — giá trị luôn đọc từ doc.
D08_ROLE_TO_TOKEN = {
    "nền chính": "--vn-bg",
    "nền nâng cao": "--vn-surface",
    "đường viền": "--vn-border",
    "chữ chính": "--vn-text",
    "chữ phụ": "--vn-text-muted",
    "nhấn chính": "--vn-primary",
    "thành công": "--vn-success",
    "cảnh báo": "--vn-warning",
    "nguy hiểm": "--vn-danger",
}

#: Token dẫn xuất, không có dòng riêng trong §12.1.
#:   - `--vn-surface-2`: sắc +1 bậc so với `--vn-surface`, dùng cho header/sidebar.
#:   - `--vn-gain` / `--vn-loss`: chuẩn Bloomberg (L-F08, Owner chốt 2026-10-07)
#:     ⇒ **bắt buộc bằng** success/danger, không phải màu riêng. Gate kiểm
#:     bằng chứng minh, xem `check_token_aliases`.
D08_DERIVED_TOKENS = {
    "--vn-surface-2": "#1e2130",
    "--vn-gain": "#22c55e",
    "--vn-loss": "#ef4444",
}


def load_d08_palette() -> tuple[dict[str, str], list[str]]:
    """Đọc bảng màu từ D08 §12.1. Trả `(token → màu, lỗi)`.

    Cố ý **parse tài liệu** thay vì chép tay: đây là cách duy nhất để "một nguồn
    sự thật" (nguyên tắc 3 trong docstring của `admin_ui`) thật sự có hiệu lực.
    """
    if not D08_DOC.exists():
        return {}, [f"khong tim thay {D08_DOC} — khong lay duoc bang mau D08 §12.1"]

    text = D08_DOC.read_text(encoding="utf-8")
    # Chi lay trong §12.1, dung do bang mau do.
    start = text.find("### 12.1")
    if start < 0:
        return {}, ["D08 khong co muc '### 12.1'"]
    end = text.find("### 12.", start + 1)
    section = text[start:end if end > start else len(text)]

    palette: dict[str, str] = {}
    errors: list[str] = []
    # | Vai trò | `#RRGGBB` | Dùng cho |
    row_re = re.compile(r"^\|\s*([^|]+?)\s*\|\s*`(#[0-9a-fA-F]{6})`\s*\|", re.MULTILINE)
    for role, colour in row_re.findall(section):
        key = D08_ROLE_TO_TOKEN.get(role.strip().lower())
        if key is None:
            continue
        palette[key] = colour.lower()

    missing = sorted(set(D08_ROLE_TO_TOKEN.values()) - set(palette))
    if missing:
        errors.append(
            f"D08 §12.1 khong co dong cho: {', '.join(missing)} "
            f"(bang mau doc duoc {len(palette)}/{len(D08_ROLE_TO_TOKEN)})"
        )
    palette.update(D08_DERIVED_TOKENS)
    return palette, errors


#: (nền, chữ, ngưỡng) — ngưỡng theo D08 §12.1 (chữ chính >= 12:1, chữ phụ >= 4.5:1).
D08_CONTRAST_RULES = [
    ("#e8eaf0", "#0f1117", 12.0, "chu chinh / nen chinh"),
    ("#9aa0ae", "#0f1117", 4.5, "chu phu / nen chinh"),
    ("#e8eaf0", "#161922", 12.0, "chu chinh / nen nang cao"),
    ("#e8eaf0", "#1e2130", 12.0, "chu chinh / sidebar"),
    ("#3b82f6", "#0f1117", 4.5, "nhan chinh / nen"),
    ("#22c55e", "#0f1117", 4.5, "thanh cong / nen"),
    ("#f59e0b", "#0f1117", 4.5, "canh bao / nen"),
    ("#ef4444", "#0f1117", 4.5, "nguy hiem / nen"),
]

#: Badge luôn có nền mem + chu sang (do bang script, khong doan).
BADGE_CONTRAST_RULES = [
    ("#86efac", "#122e22", "badge thanh cong"),
    ("#fcd34d", "#342815", "badge canh bao"),
    ("#fca5a5", "#33191e", "badge nguy hiem"),
    ("#93c5fd", "#16233b", "badge chinh"),
    ("#d5d9e2", "#25282f", "badge trung tinh"),
]

REPLACEMENT_CHAR = "�"


# ---------------------------------------------------------------------------
# Tien ich
# ---------------------------------------------------------------------------

def relative_luminance(hex_colour: str) -> float:
    """WCAG 2.x relative luminance. `hex_colour` phải là `#rrggbb`."""
    value = hex_colour.lstrip("#")
    channels = []
    for offset in (0, 2, 4):
        raw = int(value[offset:offset + 2], 16) / 255
        channels.append(raw / 12.92 if raw <= 0.03928 else ((raw + 0.055) / 1.055) ** 2.4)
    red, green, blue = channels
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue


def contrast_ratio(fg: str, bg: str) -> float:
    """Tỷ lệ tuong phan WCAG 2.x, trả về số thôi — KHÔNG làm tròn."""
    first = relative_luminance(fg)
    second = relative_luminance(bg)
    lighter, darker = max(first, second), min(first, second)
    return (lighter + 0.05) / (darker + 0.05)


def strip_css_comments(css: str) -> str:
    """Bỏ `/* … */`.

    Bắt buộc: chính ghi chú L-F05 trong file CSS có chuỗi `transition:`, quét
    không bỏ comment sẽ **báo động giả** — đúng loại lỗi `L-F06`.
    """
    return re.sub(r"/\*.*?\*/", "", css, flags=re.S)


def strip_python_comments(source: str) -> str:
    """Bỏ phần sau `#` trên từng dòng (đủ dùng cho file Python của ta)."""
    return "\n".join(re.sub(r"#.*$", "", line) for line in source.splitlines())


# ---------------------------------------------------------------------------
# Kiem tra
# ---------------------------------------------------------------------------

def check_tokens(css: str) -> list[str]:
    errors = []
    palette, load_errors = load_d08_palette()
    if load_errors:
        return load_errors
    for token, expected in palette.items():
        if not re.search(rf"{re.escape(token)}\s*:\s*{re.escape(expected)}\s*;", css):
            actual = re.search(rf"{re.escape(token)}\s*:\s*([^;]+);", css)
            errors.append(
                f"token {token} phai la {expected} (nguon D08 §12.1)"
                + (f", hien tai la {actual.group(1).strip()}" if actual else ", hien tai THIEU")
            )
    return errors


def check_token_aliases(css: str) -> list[str]:
    """Màu tăng/giảm phải **bằng** success/danger (chuẩn Bloomberg, L-F08).

    Vì sao cần gate: `--vn-gain`/`--vn-loss` được sinh ra để người đọc CSS
    hiểu "tăng/giảm" khác với "thành công/nguy hiểm". Nếu ai đó sửa `--vn-gain`
    thành một sắc xanh khác, bảng giá trị cũng tự đổi theo mà không ai hỏi —
    và bảng P/L lệch màu so với phần còn lại của admin.
    """
    errors = []
    for gain, semantic in (("--vn-gain", "--vn-success"), ("--vn-loss", "--vn-danger")):
        def read(token: str) -> str | None:
            m = re.search(rf"{re.escape(token)}\s*:\s*(#[0-9a-fA-F]{{3,8}})\s*;", css)
            return m.group(1).lower() if m else None

        g, s = read(gain), read(semantic)
        if g is None or s is None:
            errors.append(f"thieu {gain} hoac {semantic} trong vnadmin.css")
        elif g != s:
            errors.append(
                f"{gain} phai BANG {semantic} (L-F08 Bloomberg tang/giam), "
                f"hien tai {g} != {s}"
            )
    return errors


#: Màu bị **miễn nhiễm kiểm tra lo**. Đây KHÔNG phải danh sách "cho phép sai" —
#: đây là các sắc chuẩn (Tailwind amber-700 / red-700 / red-300) mà D08 không
#: quy định cho light-mode nhưng lại **trùng vặt** với SOC. Không thể phân biệt
#: "chép từ SOC" với "cùng là sắc chuẩn" chỉ bằng giá trị màu — nên check này
#: là CẢNH BÁO, không chặn. Chặn ở đây sẽ dạy cả nhóm bỏ qua gate.
SOC_LEAK_ALLOWLIST = {
    "#b45309",  # amber-700 — light-mode `--vn-warning`
    "#b91c1c",  # red-700   — light-mode `--vn-danger` / `--vn-loss`
    "#fca5a5",  # red-300   — `--vn-badge-danger-fg` (đã qua kiểm tương phản)
}


def check_no_soc_leakage(css: str) -> list[str]:
    """Cảnh báo khi token `--vn-*` dùng màu chỉ có trong `soc.tokens.css`.

    O5 ghi nhận **hai design system cùng sống**: `soc.tokens.css` (vỏ SPA) và
    D08 (Django admin). Hai bảng màu khác nhau là chấp nhận được — **chép màu
    của nhau vào token** thì không: sửa `soc.tokens.css` sẽ không cập nhật
    admin và hai màn hình lệch màu mà không ai biết.

    ⚠ Chỉ soi **giá trị của token** (`--vn-…: #hex`), không soi mọi mã màu
    trong file: bảng D08 và bảng SOC có phần giao nhau (`#ef4444`, `#f59e0b`…)
    — thấy trùng ở đâu đó không phải lỗi.

    ⚠ **Cảnh báo, không chặn.** Vì sao: `#b45309`/`#b91c1c`/`#fca5a5` vừa là sắc
    chuẩn dùng cho light-mode vừa có mặt trong SOC. Giá trị màu **không phân
    biệt được** "chép từ SOC" với "cùng là sắc chuẩn" — gate chặn ở đây sẽ bị
    vượt qua bằng `SOC_LEAK_ALLOWLIST` rồi mất hết tác dụng. Để cảnh báo thì
    vẫn giữ được thông tin mà không tạo áp lực bypass.
    """
    soc_path = REPO / "packages" / "web" / "src" / "components" / "soc" / "soc.tokens.css"
    if not soc_path.exists():
        return []  # không có file SOC ⇒ không có gì để lọt

    soc = soc_path.read_text(encoding="utf-8")
    palette, _ = load_d08_palette()
    d08_colours = set(palette.values())
    soc_only = {
        c.lower()
        for c in re.findall(r"#[0-9a-fA-F]{6}\b", soc)
        if c.lower() not in d08_colours
    } - {"#ffffff", "#000000"} - SOC_LEAK_ALLOWLIST

    declared = re.findall(r"--vn-[a-z0-9-]+\s*:\s*(#[0-9a-fA-F]{3,8})\s*;", css)
    leaked = sorted({c.lower() for c in declared} & soc_only)
    if leaked:
        return [
            "token --vn-* dang dung mau chi co trong soc.tokens.css: "
            + ", ".join(leaked)
            + " — admin nen dung bang mau D08 (nguon: docs/saas_design_pack/D08_UI_UX_DESIGN_20261002.md §12.1)"
        ]
    return []


def check_contrast() -> list[str]:
    errors = []
    for fg, bg, minimum, label in D08_CONTRAST_RULES:
        ratio = contrast_ratio(fg, bg)
        if ratio < minimum:
            errors.append(
                f"tuong phan {label}: {ratio:.2f}:1 < {minimum}:1 ({fg} tren {bg})"
            )
    for fg, bg, label in BADGE_CONTRAST_RULES:
        ratio = contrast_ratio(fg, bg)
        if ratio < 4.5:
            errors.append(f"tuong phan {label}: {ratio:.2f}:1 < 4.5:1 ({fg} tren {bg})")
    return errors


def check_transitions(css: str) -> list[str]:
    """L-F05: `transition:` mất `<time>` ⇒ mặc định `duration: 0s` ⇒ cắt chuyen dong.

    Hàm tự bỏ comment `/* … */` **bên trong** chứ không nhờ caller: nếu bỏ ở
    caller thì bất kỳ ai gọi trực tiếp (kể cả self-test) sẽ quét trúng chính
    ghi chú L-F05 trong file CSS và **báo động giả** — đúng loại lỗi `L-F06`.
    """
    css = strip_css_comments(css)
    broken = []
    for match in re.finditer(r"transition:\s*([^;]+);", css):
        value = match.group(1)
        if "var(--vn-dur" in value or "0.01ms" in value:
            continue
        if not re.search(r"\d+(\.\d+)?m?s", value):
            broken.append(value.strip())
    return [f"transition khong giu thoi luong: {item}" for item in broken]


def check_a11y_css(css: str) -> list[str]:
    errors = []
    if "--vn-tap: 24px;" not in css:
        errors.append("thieu --vn-tap: 24px (D08 §13: vung cham toi thieu 24×24)")
    if "prefers-reduced-motion" not in css:
        errors.append("thieu prefers-reduced-motion (D08 §13, WCAG 2.3.3 muc AA)")
    if "--vn-focus-ring" not in css:
        errors.append("thieu --vn-focus-ring (D08 §13.1: vong focus phai nhin thay tren nen toi)")
    # D08 §13: "khong chi dua vao mau" — badge phai co chu.
    if ".vn-badge" in css:
        badge_block = css[css.index(".vn-badge"):css.index(".vn-badge") + 600]
        if "content:" in badge_block:
            errors.append(".vn-badge dung content de hien thi => thong tin chi qua mau (D08 §13)")
    # ── Wave 18 (2026-10-10) ────────────────────────────────────────────────
    # Ba loi phat hien bang ANH CHUP THAT + do computed style tren stack that.
    # Chi giu lop hien thi; khong dung nham loi nghiep vu.
    if "--vn-on-primary" not in css:
        errors.append(
            "thieu --vn-on-primary (chu tren nen primary): chu #ffffff tren "
            "--vn-primary (#3b82f6) chi dat 3.68:1 < 4.5:1 WCAG AA "
            "=> nut 'Dang nhap' khong doc duoc o nen toi"
        )
    if ".vnadmin.login" not in css:
        errors.append(
            "thieu style `.vnadmin.login` — login.html cua Django khong ke thua "
            "base.html cua ta => trang dang nhap khong duoc style hoa; do la nguon "
            "goc tuong phan nhan 1.04:1 (do, khong phai doan)"
        )
    if re.search(r"#changelist\s+\.results\s*\{[^}]*overflow-x:\s*hidden", css):
        errors.append(
            "#changelist .results dung overflow-x: hidden => cot ben phai bi cat "
            "va khong co thanh cuon; phai la 'auto'"
        )
    return errors


def check_base_template_blocks() -> list[str]:
    if not BASE_TEMPLATE.exists():
        return [f"KHONG TIM THAY {BASE_TEMPLATE}"]
    source = BASE_TEMPLATE.read_text(encoding="utf-8")
    declared = {m.group(1) for m in re.finditer(r"\{%\s*block\s+([a-z0-9\-_]+)", source)}
    missing = DJANGO_ADMIN_BASE_BLOCKS - declared
    errors = [f"base.html thieu block cua Django: {sorted(missing)}"] if missing else []
    if "dark-mode-vars" not in declared:
        errors.append("base.html mat khoi dark-mode-vars -> pha che do sang/toi cua Django")
    if "color_theme_toggle.html" not in source:
        errors.append("base.html khong include color_theme_toggle.html")
    return errors


def check_template_comments() -> list[str]:
    """`{# … #}` cua Django **khong** bat duoc xuong dong (xem module docstring)."""
    errors = []
    if not TEMPLATES.exists():
        return [f"KHONG TIM THAY {TEMPLATES}"]
    for template in sorted(TEMPLATES.glob("*.html")):
        source = template.read_text(encoding="utf-8")
        for match in re.finditer(r"\{#", source):
            end = source.find("#}", match.start())
            block = source[match.start():end + 2] if end != -1 else source[match.start():]
            if "\n" in block:
                line = source[: match.start()].count("\n") + 1
                errors.append(
                    f"{template.name}:{line} comment {{# #}} nhieu dong — Django se KHONG "
                    "coi la comment va se parse moi {% %} ben trong. Dung {% comment %}."
                )
        opened = len(re.findall(r"\{%\s*comment\s*%\}", source))
        closed = len(re.findall(r"\{%\s*endcomment\s*%\}", source))
        if opened != closed:
            errors.append(f"{template.name}: comment ({opened}) / endcomment ({closed}) lech")
    return errors


def check_encoding() -> list[str]:
    """Chan byte hỏng trong mã nguồn.

    Hazard 5: đọc/ghi sai encoding sinh ra `U+FFFD` **trông giống** file hỏng
    nhưng citation vẫn đúng dòng. Trong wave này đã ghi 4 ký tự `U+FFFD` vào
    `branding.py` bằng cách đọc file không khai bao encoding.
    """
    errors = []
    targets = sorted(ADMIN_UI.glob("*.py")) + [SRC / "vninvest_core" / "admin.py"]
    targets += sorted(TEMPLATES.glob("*.html")) if TEMPLATES.exists() else []
    for path in targets:
        text = path.read_text(encoding="utf-8", errors="replace")
        if REPLACEMENT_CHAR in text:
            errors.append(
                f"{path.name} chua U+FFFD ({text.count(REPLACEMENT_CHAR)} ky tu) — "
                "byte da bi hong khi doc/ghi"
            )
    return errors


def check_vietnamese_labels() -> list[str]:
    """Canh bao (không chan): model có nhãn tiếng Việt chưa.

    Không chan vì đăng ký nhãn là quyết định của từng model; gate chỉ báo để
    không ai quên mà không bị chan việc làm việc khác.
    """
    warnings = []
    labels_source = (ADMIN_UI / "labels.py")
    if not labels_source.exists():
        return [f"KHONG TIM THAY {labels_source}"]
    body = strip_python_comments(labels_source.read_text(encoding="utf-8"))
    block = body[body.index("MODEL_LABELS"):]
    block = block[: block.index("\n}")]
    declared = set(re.findall(r'"([a-z_]+\.[A-Za-z]+)"\s*:', block))
    for group_file in sorted(SRC.glob("*/admin.py")):
        group_source = strip_python_comments(group_file.read_text(encoding="utf-8"))
        for match in re.finditer(r"@admin\.register\((\w+)\)", group_source):
            model_name = match.group(1)
            if not any(key.split(".")[-1] == model_name for key in declared):
                warnings.append(
                    f"{group_file.parent.name}.{model_name} chua co nhan tieng Viet"
                )
    return warnings


def _ensure_django_ready() -> str | None:
    """Chuẩn bị môi trường để đếm model. Trả `None` nếu thành công, ngược lại lý do.

    ⚠ Vì sao hàm này tồn tại: `scripts/pre-push-gate.mjs` gọi gate **không** set
    `DJANGO_SETTINGS_MODULE`. Trước khi có hàm này, nhánh "model chưa khai bao
    admin" **luôn** rơi vào nhánh báo lỗi môi trường ⇒ check **chết âm thầm**
    trong đúng đường chạy tự động. Đây đúng là cái bẫy đã ghi ở
    `docs/LESSONS/INDEX.md` §1.1: quy tắc có trong văn bản nhưng không lệnh nào
    chạy nó. Gate phải **tự đủ**, không được trông chờ người gọi export biến.
    """
    import os

    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "vninvest_core.settings")
    # `settings.py:70` ném `ImproperlyConfigured` khi DEBUG thiếu và
    # `DJANGO_ALLOWED_HOSTS` rỗng — đặt trước khi `django.setup()`.
    os.environ.setdefault("DJANGO_DEBUG", "1")
    try:
        if str(SRC) not in sys.path:
            sys.path.insert(0, str(SRC))
        import django

        django.setup()
        return None
    except Exception as exc:  # noqa: BLE001 - phải trả lý do, không crash
        return f"{type(exc).__name__}: {exc}"


def check_unregistered_models() -> list[str]:
    """Canh bao (không chan): model chưa có admin.

    Không chan vì không phải model nào cũng nên mở quyền sửa (bảng phái sinh
    nội bộ, bảng chứa bí mật). Gate chỉ **báo** để quyết định còn sót là có ý
    thức.
    """
    warnings: list[str] = []
    reason = _ensure_django_ready()
    if reason:
        return [f"KHONG dem duoc model da dang ky admin: {reason}"]
    try:
        from django.apps import apps
        from django.contrib import admin as django_admin

        registered = set()
        for key, model_admin in django_admin.site._registry.items():
            model = key if hasattr(key, "_meta") else model_admin.model
            registered.add(f"{model._meta.app_label}.{model._meta.model_name}".lower())

        own_apps = {
            "identity_access", "market_serving", "signal_intelligence", "commercial",
            "tenant_lifecycle", "ops_audit", "data_ingest", "advisory", "user_workspace",
            "market_data", "service_ops", "support", "advertising", "ai_agents",
            "ai_analytics",
        }
        for app_label in sorted(own_apps):
            try:
                config = apps.get_app_config(app_label)
            except LookupError:
                continue
            for model in config.get_models():
                key = f"{app_label}.{model._meta.model_name}".lower()
                if key not in registered:
                    warnings.append(f"{key} chua duoc khai bao trong Django admin")
    except Exception as exc:  # noqa: BLE001 - gate phai bao loi, khong crash
        warnings.append(f"KHONG dem duoc model da dang ky admin: {type(exc).__name__}: {exc}")
    return warnings


BLOCKING_CHECKS = (
    ("duong dan", None),
    ("token mau D08", check_tokens),
    ("gain/loss = success/danger (L-F08)", check_token_aliases),
    ("tuong phan WCAG", check_contrast),
    ("chuyen dong (L-F05)", check_transitions),
    ("a11y CSS", check_a11y_css),
    ("block template Django", check_base_template_blocks),
    ("comment nhieu dong", check_template_comments),
    ("encoding UTF-8", check_encoding),
)

def check_soc_leakage_advisory() -> list[str]:
    """Bọc `check_no_soc_leakage` cho `WARNING_CHECKS` (vốn gọi không tham số)."""
    if not CSS_PATH.exists():
        return []
    return check_no_soc_leakage(strip_css_comments(CSS_PATH.read_text(encoding="utf-8")))


WARNING_CHECKS = (
    ("nhan tieng Viet", check_vietnamese_labels),
    ("model chua khai bao admin", check_unregistered_models),
    ("mau soc.tokens.css loot vao admin (O5)", check_soc_leakage_advisory),
)


def run_blocking() -> tuple[list[str], list[str]]:
    lines, failures = [], []
    for required in (CSS_PATH, JS_PATH, BASE_TEMPLATE, ADMIN_UI):
        if not required.exists():
            failures.append(f"[duong dan] KHONG TON TAI: {required}")
    if failures:
        return lines, failures

    css = strip_css_comments(CSS_PATH.read_text(encoding="utf-8"))
    payload = {
        "token mau D08": css,
        "gain/loss = success/danger (L-F08)": css,
        "chuyen dong (L-F05)": css,
        "a11y CSS": css,
    }
    for name, check in BLOCKING_CHECKS:
        if check is None:
            lines.append(f"  SKIP {name}")
            continue
        errors = check(payload[name]) if name in payload else check()
        if errors:
            failures.extend(f"[{name}] {item}" for item in errors)
            lines.append(f"  FAIL {name} ({len(errors)})")
        else:
            lines.append(f"  PASS {name}")
    return lines, failures


def run_warnings() -> tuple[list[str], list[str]]:
    lines, warnings = [], []
    for name, check in WARNING_CHECKS:
        try:
            found = check()
        except Exception as exc:  # noqa: BLE001
            found = [f"KHONG chay duoc: {type(exc).__name__}: {exc}"]
        if found:
            warnings.extend(f"[{name}] {item}" for item in found)
            lines.append(f"  CANH BAO {name} ({len(found)})")
        else:
            lines.append(f"  OK {name}")
    return lines, warnings


# ---------------------------------------------------------------------------
# Self-test — chung minh gate THAT SỰ bat loi
# ---------------------------------------------------------------------------

#: CSS a11y **day du** — dung lam nen cho case kiem lop trinh bay (wave 18).
#: Giu dung cac rule ma `check_a11y_css` yeu cau, de moi case tap trung vao
#: **mot** thieu sot thay v nhieu thieu sot mot luc.
_A11Y_OK = (
    ":root { --vn-tap: 24px; --vn-focus-ring: 0 0 0 2px; --vn-on-primary: #0f1117; } "
    "@media (prefers-reduced-motion: reduce) { a { transition: none; } } "
    ".vn-badge { padding: 2px; } "
    "body.vnadmin.login #container { color: var(--vn-text); } "
    "body.vnadmin #changelist .results { overflow-x: auto; }"
)
#: Khong co token chu tren nen primary.
_A11Y_NO_ONPRIMARY = _A11Y_OK.replace(" --vn-on-primary: #0f1117;", "")
#: Khong co style trang dang nhap.
_A11Y_NO_LOGIN = _A11Y_OK.replace("body.vnadmin.login #container { color: var(--vn-text); }", "")
#: Changelist cat cot.
_A11Y_HIDDEN = _A11Y_OK.replace("overflow-x: auto", "overflow-x: hidden")

SELF_TEST_CASES = [
    ("T01 token sai gia tri bi bat",
     lambda: check_tokens("body.vnadmin { --vn-bg: #ffffff; }")),
    ("T02 token thieu bi bat",
     lambda: check_tokens("body.vnadmin { --vn-bg: #0f1117; }")),
    ("T03 tuong phan qua nguong bi bat",
     lambda: _forced_low_contrast()),
    ("T04 transition mat thoi luong bi bat",
     lambda: check_transitions("a { transition: color; }")),
    ("T05 transition giu thoi luong KHONG bi bat",
     lambda: check_transitions("a { transition: color 180ms ease; }")),
    ("T06 comment trong CSS khong tao bao dong gia",
     lambda: check_transitions("/* transition: color; */ a { color: red; }")),
    ("T07 vung cham < 24px bi bat",
     lambda: check_a11y_css(":root { --vn-tap: 16px; } prefers-reduced-motion x --vn-focus-ring x .vn-badge")),
    ("T08 a11y CSS day du KHONG bi bat",
     lambda: check_a11y_css(_A11Y_OK)),
    ("T09 encoding U+FFFD bi bat",
     lambda: _forced_fffd()),
    ("T10 base.html hop le KHONG bi bat",
     lambda: check_base_template_blocks()),
    ("T11 khong co comment nhieu dong KHONG bi bat",
     lambda: check_template_comments()),
    ("T12 duong dan thieu bi bat",
     lambda: _forced_missing_path()),
    ("T13 khong chet khi stdout la cp1252",
     lambda: _forced_cp1252_stdout()),
    # ── Wave 17 / O5: hop dong design token ──────────────────────────────
    ("T14 D08 §12.1 la nguon su that — doi token trong CSS bi bat",
     lambda: check_tokens("body.vnadmin { --vn-bg: #081734; }")),
    ("T15 token dung theo D08 KHONG bi bat",
     lambda: _forced_correct_tokens()),
    ("T16 gain lech success bi bat (L-F08)",
     lambda: check_token_aliases(
         ":root { --vn-success: #22c55e; --vn-danger: #ef4444; "
         "--vn-gain: #00ff88; --vn-loss: #ef4444; }")),
    ("T17 loss lech danger bi bat (L-F08)",
     lambda: check_token_aliases(
         ":root { --vn-success: #22c55e; --vn-danger: #ef4444; "
         "--vn-gain: #22c55e; --vn-loss: #ff0055; }")),
    ("T18 gain/loss bang nhau KHONG bi bat (L-F08)",
     lambda: check_token_aliases(
         ":root { --vn-success: #22c55e; --vn-danger: #ef4444; "
         "--vn-gain: #22c55e; --vn-loss: #ef4444; }")),
    ("T19 mau SOC lo vao token bi canh bao (O5)",
     lambda: check_no_soc_leakage(":root { --vn-primary: #22d3ee; }")),
    ("T20 mau D08 trung voi SOC KHONG bi canh bao (O5)",
     lambda: check_no_soc_leakage(":root { --vn-danger: #ef4444; --vn-primary: #3b82f6; }")),
    ("T21 mau SOC trong allowlist (sắc chuẩn) KHONG bi canh bao",
     lambda: check_no_soc_leakage(":root { --vn-warning: #b45309; }")),
    # ── Wave 18: lớp trình bày chung ──────────────────────────────────────
    ("T22 thieu --vn-on-primary (nút bấm không đọc được) bi bắt",
     lambda: check_a11y_css(_A11Y_NO_ONPRIMARY)),
    ("T23 thieu style trang đăng nhập bi bắt",
     lambda: check_a11y_css(_A11Y_NO_LOGIN)),
    ("T24 changelist cắt cột (overflow-x:hidden) bi bắt",
     lambda: check_a11y_css(_A11Y_HIDDEN)),
    ("T25 a11y đầy đủ KHÔNG bi bắt",
     lambda: check_a11y_css(_A11Y_OK)),
]

#: Case nào **phải** phát hiện lỗi. So khớp bằng `name[:3]` — `str.startswith("T1")`
#: khớp CẢ "T10"/"T11", từng làm self-test báo sai 3 case.
SELF_TEST_EXPECT_ERROR = frozenset(
    {"T01", "T02", "T03", "T04", "T07", "T09", "T12",
     "T14", "T16", "T17", "T19", "T22", "T23", "T24"}
)


def _forced_low_contrast():
    """Tạo tình huống tương phân thấp để chứng minh ngưỡng bị áp dụng."""
    import tempfile

    original = D08_CONTRAST_RULES[0]
    try:
        D08_CONTRAST_RULES[0] = ("#111111", "#111111", 12.0, "canh co loi")
        return check_contrast()
    finally:
        D08_CONTRAST_RULES[0] = original


def _forced_fffd():
    """Ghi file tạm chứa U+FFFD rồi quét — chứng minh check bắt được."""
    import tempfile

    with tempfile.TemporaryDirectory() as tmp:
        target = Path(tmp) / "vninvest_core" / "admin_ui"
        target.mkdir(parents=True)
        (target / "broken.py").write_text("# comment\nx = 'A' + '�'\n", encoding="utf-8")
        original = ADMIN_UI
        try:
            import builtins

            globals()["ADMIN_UI"] = target
            return check_encoding()
        finally:
            globals()["ADMIN_UI"] = original


def _forced_missing_path():
    """Tạm dời `CSS_PATH` đi để chứng minh gate bắt được đường dẫn thiếu."""
    global CSS_PATH
    import tempfile

    original = CSS_PATH
    try:
        CSS_PATH = Path(tempfile.gettempdir()) / "khong-ton-tai.css"
        return run_blocking()[1]
    finally:
        CSS_PATH = original


def _forced_correct_tokens() -> list[str]:
    """Chứng minh: CSS khớp **đúng** bảng màu đọc từ D08 §12.1 ⇒ không lỗi.

    Sinh CSS từ chính `load_d08_palette()` thay vì chép tay, nên case này
    **tự** kiểm chứng việc đọc doc đúng — nếu parser hỏng, case này FAIL chứ
    không PASS mù.
    """
    palette, load_errors = load_d08_palette()
    if load_errors:
        return load_errors
    body = " ".join(f"{token}: {colour};" for token, colour in sorted(palette.items()))
    return check_tokens(f":root {{ {body} }}")


def _forced_cp1252_stdout():
    """Chứng minh gate **không chết** khi stdout là cp1252.

    ⚠ L-B03 (`docs/LESSONS/backend.md`): script chạy tự động không được in
    ký tự ngoài ASCII ra stdout non-UTF-8. `scripts/pre-push-gate.mjs` gọi gate
    **không** set `PYTHONIOENCODING` ⇒ stdout là `cp1252`.

    Đã xảy ra thật: dòng `print("... 0 loi chặn ...")` chứa `ặ` (U+1EB7) ⇒
    `UnicodeEncodeError` ⇒ gate FAIL ⇒ **chặn push**.

    Case này **phải thực sự in** chuỗi có dấu qua stream cp1252 thì mới
    chứng minh được. Bản đầu chỉ gọi `run_blocking()` — hàm đó **không**
    in gì ⇒ case luôn PASS kể cả khi đã vô hiệu hoá lớp phòng vệ
    (đã kiểm bằng phép phá thật: vô hiệu hoá ⇒ vẫn PASS ⇒ case vô dụng).
    """
    import io

    real = sys.stdout
    sys.stdout = io.TextIOWrapper(io.BytesIO(), encoding="cp1252", errors="strict")
    try:
        _force_utf8_stdout()
        # In CUNG chu co dau - day la phan thu nghiem.
        print("check_admin_ux: PASS \u2014 0 loi ch\u1eb7n")
        sys.stdout.flush()
        return []  # khong nem UnicodeEncodeError => PASS
    finally:
        try:
            sys.stdout = real
        except Exception:
            pass


def self_test() -> int:
    print("check_admin_ux --self-test")
    failures = []
    for name, case in SELF_TEST_CASES:
        try:
            found = case()
        except Exception as exc:  # noqa: BLE001
            print(f"  ERROR {name}: {type(exc).__name__}: {exc}")
            failures.append(name)
            continue
        expects_error = name[:3] in SELF_TEST_EXPECT_ERROR
        got_error = bool(found)
        verdict = "PASS" if got_error == expects_error else "FAIL"
        print(f"  {verdict} {name} — phat hien {len(found)} loi")
        if verdict == "FAIL":
            failures.append(name)
    if failures:
        print(f"\ncheck_admin_ux: --self-test FAIL ({len(failures)}/{len(SELF_TEST_CASES)})")
        return 1
    print(f"\ncheck_admin_ux: --self-test PASS ({len(SELF_TEST_CASES)}/{len(SELF_TEST_CASES)})")
    return 0


def _force_utf8_stdout() -> None:
    """Ép stdout sang UTF-8 với `errors="replace"` — **không bao giờ** để script chết vì encoding.

    ⚠ Bắt buộc, không phải tuỳ thích. L-B03 trong `docs/LESSONS/backend.md`:
    script chạy tự động **không** được in ký tự ngoài ASCII ra stdout non-UTF-8,
    hoặc phải xử lý encoding rõ ràng.

    Đã xảy ra thật: `scripts/pre-push-gate.mjs` gọi script này **không** set
    `PYTHONIOENCODING`, nên stdout là `cp1252`. Dòng `print("... 0 loi chan ...")`
    chứa `ặ` (U+1EB7) ⇒ `UnicodeEncodeError` ⇒ gate **FAIL** ⇒ **chan push**.

    Hai lớp phòng vệ (cả hai đều giữ):
    1. `errors="replace"` — kể cả sau này có sót dấu, script vẫn **không crash**.
    2. Thông điệp vẫn viết **không dấu** cho khớp với quy ước output của các
       gate khác trong repo (`check-lessons.mjs`, `check-multi-agent.mjs`).
    """
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if reconfigure is None:
            continue
        try:
            reconfigure(encoding="utf-8", errors="replace")
        except (ValueError, OSError):
            pass


def main() -> int:
    _force_utf8_stdout()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--self-test", action="store_true", help="chay bo case that chung minh gate bat loi")
    args = parser.parse_args()
    if args.self_test:
        return self_test()

    print("check_admin_ux — gate lop trinh bay Django admin")
    lines, failures = run_blocking()
    lines.extend(run_warnings()[0])
    for line in lines:
        print(line)

    if failures:
        print(f"\ncheck_admin_ux: FAIL — {len(failures)} loi chan")
        for item in failures:
            print(f"  x {item}")
        return 1

    warnings = run_warnings()[1]
    if warnings:
        print(f"\ncheck_admin_ux: PASS — 0 loi chan, {len(warnings)} canh bao")
        for item in warnings:
            print(f"  ! {item}")
    else:
        print("\ncheck_admin_ux: PASS — 0 loi chan, 0 canh bao")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

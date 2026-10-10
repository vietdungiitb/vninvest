# PLAN — Refactor Django Admin UI/UX đạt đẳng cấp phần mềm thương mại

**Ngày:** 2026-10-10 · **Agent:** `adminui-w15` · **Branch:** `feat/django-admin-uiux-pm` -> `dev`
**Base sha:** `origin/dev` = `2ea2948b8c3484a9ae1358b93499b12d29a8417d`
**Claim:** `docs/CLAIMS.md` mục `## 2026-10-10 - Wave 15`
**Lessons áp dụng:** L-001, L-002, L-003, L-006, L-007, L-008, L-A01, L-B01, L-B02, L-B03, L-G01, L-G02, L-G03, L-G05, L-G06, L-T01, L-T02, L-F03, L-F05, L-F08, L-M01, L-M02

> **Chế độ: Mode B (self-supervised solo).** Lý do: S1–S4 cùng chạm `admin.py` + `templates/admin/` + `static/` ⇒ **không disjoint** (skill `multi-agent-workflow` §0.5 bước 3 buộc chạy tuần tự khi không tách được file-set).

---

## 0. TL;DR — 4 phát hiện đã đo được

| # | Phát hiện | Bằng chứng (lệnh tái tạo) | Mức |
|---|---|---|---|
| **F1** | **`/admin/advertising` của Django bị nginx nuot** | `packages/web/docker/nginx.conf:140` là `location ^~ /admin/advertising` — prefix ⇒ khớp cả `/admin/advertising/adcampaign/` | **blocker** |
| **F2** | **78/112 model (70%) không quản trị được** | đếm bằng script §2.1 | **major** |
| **F3** | **0 template admin, 0 CSS admin** | `Get-ChildItem -Recurse -Filter index.html` trong `*/templates/admin/` ⇒ 0 kết quả | **major** |
| **F4** | **`docs/ADMIN_UI_IMPLEMENTATION_STEPS.md` STALE** | tham chiếu `backend/portfolio/` — không tồn tại (nguyên tắc 3 `AGENTS.md`) | minor |

---

## 1. Phạm vi

### 1.1 Trong phạm vi

- Design system + skin cho **Django admin** (`/admin/`) — server-rendered, không build step.
- Dashboard vận hành (quick stats, KPI, cảnh báo dữ liệu stale).
- Chuẩn hoá 34 `ModelAdmin` hiện có + khai báo admin cho model còn thiếu.
- Menu nhóm chức n��ng + nhãn tiếng Việt.
- A11y WCAG 2.2 AA theo D08 §13.
- Gate máy cho chính lớp admin (chống tái thoái).

### 1.2 NGOAI phạm vi (non-goals — audit sẽ tìm scope chưa thống nhất nếu thiếu mục này)

| # | Không làm | Lý do |
|---|---|---|
| N1 | **Không** sửa React SPA `/admin/*` (14 route trong `routeCatalog.js`) | Đó là sản phẩm khác, đã có 14 wave audit riêng |
| N2 | **Không** sửa `settings.py` | Không cần: `APP_DIRS=True` đủ để override template; đổi `USE_I18N` là thay đổi hệ thống toàn repo |
| N3 | **Không** thêm package pip mới (django-unfold, etc.) | `AGENTS.md`: không `pip install` khi chưa hỏi; và junction `node_modules`/`.venv` dùng chung |
| N4 | **Không** tạo migration | Chỉ đổi lớp trình bày + khai báo admin, **0 thay đổi model** |
| N5 | **Không** sửa `nginx.conf` trong PR này | F1 cần Owner duyệt (đụng route SPA đang chạy) → tách ticket, ghi ở §6 |
| N6 | **Không** viết lại nghiệp vụ admin có sẵn (OAuth2 mail, action `mark_as_default`) | Chỉ bọc UI, giữ nguyên luồng |

---

## 2. Audit hiện trạng (Stage 1 — số liệu đo được)

### 2.1 Bảng coverage model ↔ admin

Lệnh tái tạo (PowerShell, chạy từ repo root):

```powershell
$apps = @("identity_access","market_serving","signal_intelligence","commercial",
          "tenant_lifecycle","ops_audit","data_ingest","advisory","user_workspace",
          "market_data","service_ops","support","advertising","ai_agents","ai_analytics")
foreach ($a in $apps) {
  $m = (Select-String -Path "packages/core/backend/src/$a/models.py" -Encoding utf8 `
        -Pattern '^class\s+(\w+)\(').Count
  $r = if (Test-Path "packages/core/backend/src/$a/admin.py") {
        (Select-String -Path "packages/core/backend/src/$a/admin.py" -Encoding utf8 `
         -Pattern '@admin\.register\(').Count } else { 0 }
  "{0,-20} models={1,-3} admin={2,-3} thiếu={3}" -f $a,$m,$r,($m-$r)
}
```

| App | model | admin đăng ký | **thiếu** |
|---|---:|---:|---:|
| identity_access | 24 | 8 | 16 |
| market_serving | 3 | 2 | 1 |
| signal_intelligence | 7 | 3 | 4 |
| commercial | 6 | 3 | 3 |
| tenant_lifecycle | 1 | 1 | 0 |
| ops_audit | 3 | 2 | 1 |
| data_ingest | 2 | 0 | **2** |
| advisory | 6 | 4 | 2 |
| user_workspace | 20 | 4 | 16 |
| market_data | 8 | 3 | 5 |
| service_ops | 15 | 0 | **15** |
| support | 9 | 0 | **9** |
| advertising | 5 | 4 | 1 |
| ai_agents | 1 | 0 | **1** |
| ai_analytics | 2 | 0 | **2** |
| **TỔNG** | **112** | **34** | **78** |

> 5 app có `admin.py = 0` nhưng có model thật và **quan trọng vận hành**: `service_ops` (ScrapeMatrix, BackfillExecutionRun, ConfigChangeAudit, ServiceHealth), `support` (SupportTicket, TicketMessage, TicketAttachment).

### 2.2 Kiểm kê giao diện

| Hạng mục | Số | Bằng chứng |
|---|---:|---|
| Template `templates/admin/*.html` tự viết | **0** | `identity_access/templates/` chỉ có `emails/` + `reports/` |
| File CSS/JS admin tự viết | **0** | không có thư mục `*/static/admin/` ngoài `.venv` |
| `@admin.display` dùng định dạng hiển thị | **5** (toàn bộ trong `identity_access`) | `identity_access/admin.py:267,271,275,279,283` |
| ModelAdmin có `date_hierarchy` | **0** | grep `date_hierarchy` trong `src/*/admin.py` ⇒ 0 |
| ModelAdmin có `autocomplete_fields` | **0** | grep ⇒ 0 |
| ModelAdmin có `list_select_related` | **0** | grep ⇒ 0 |
| ModelAdmin có `actions` | 1 | `identity_access/admin.py:216` |
| ModelAdmin có `empty_value_display` | **0** | grep ⇒ 0 |
| ModelAdmin có `save_on_top` | **0** | grep ⇒ 0 |
| ModelAdmin có `show_full_result_count` | **0** | grep ⇒ 0 |

### 2.3 CONTRADICTIONS (plan/doc vs code)

| # | Tài liệu nói | Code thực tế | Tác động |
|---|---|---|---|
| **C1** | `docs/ADMIN_UI_IMPLEMENTATION_STEPS.md:38` — "Tạo template `portfolio/templates/admin/index.html`", `:392` — `backend/portfolio/admin.py` | Không tồn tại. App `portfolio` không có trong `INSTALLED_APPS` (`settings.py:103-131`). App thay thế là `user_workspace` | Tài liệu hướng dẫn người mới sửa file không tồn tại ⇒ mất thời gian |
| **C2** | `nginx.conf:75` — "Keep in sync with group `admin` in `src/app/routeCatalog.js` — enforced by `scripts/check-admin-spa-routes.mjs`" | Gate **chỉ quét 1 chiều** catalog→nginx (`check-admin-spa-routes.mjs:41-58`), **không** kiểm chiều ngược lại (nginx prefix nuốt URL Django) | F1 lọt qua gate |
| **C3** | D08 §12.1 — nền `#0F1117`, nhấn `#3B82F6` | `soc.tokens.css:7,14` — nền `#081734`/`#0f172a`, nhấn `#22d3ee` | 2 design system cùng tồn tại. Xem §3.3 |

---

## 3. Quyết định thiết kế

### 3.1 Kiến trúc lớp admin

```
packages/core/backend/src/vninvest_core/
├── admin_ui/
│   ├── __init__.py       # public API
│   ├── branding.py       # site_header/title/index_title + menu grouping
│   ├── mixins.py         # VNReadOnlyMixin, VNActionMixin
│   ├── display.py        # badge(), money(), pct(), dt(), bool_icon()
│   ├── dashboard.py      # AdminIndexDashboard -> context cho admin/index.html
│   └── labels.py         # ánh xạ nhãn tiếng Việt theo model
├── templates/admin/
│   ├── base.html         # override shell (giữ đủ block của Django 5.2)
│   ├── index.html        # dashboard vận hành
│   └── includes/…
└── static/admin/css/vnadmin.css
```

**Quyết định:** đặt trong `vninvest_core` (app đã có trong `INSTALLED_APPS`) ⇒ `APP_DIRS=True` tự tìm thấy, **không phải sửa `settings.py`** (non-goal N2).

### 3.2 Vì sao override `base.html` mà không chỉ `base_site.html`

`django/contrib/admin/templates/admin/base.html` (126 dòng, đọc ở `.venv/Lib/site-packages/…/admin/base.html`) có **28 block** (đếm bằng regex `{% block <name>` trên chính file đó — **không** đếm bằng mắt). Bọc bằng `base_site.html` chỉ đổi được header. Muốn thay shell (sidebar, card, token) thì phải override `base.html`. Bắt buộc **giữ nguyên tên mọi block** Django template con đang kế thừa, nếu không `{% extends %}` sẽ lỗi `block tag does not exist`.

28 block, theo thứ tự file gốc: `title`, `stylesheet`, `dark-mode-vars`, `extrastyle`, `stylesheet_rtl`, `extrahead`, `responsive`, `blockbots`, `bodyclass`, `header`, `branding`, `usertools`, `welcome-msg`, `userlinks`, `nav-global`, `nav-breadcrumbs`, `breadcrumbs`, `nav-sidebar`, `messages`, `coltype`, `pretitle`, `content_title`, `content_subtitle`, `content`, `object-tools`, `sidebar`, `footer`, `extrabody`.

**AC an toàn:** `python manage.py check` exit 0 **và** mọi trang admin render được (test client), vì block thiếu chỉ lộ ra lúc **render**, không lộ lúc `check`.

### 3.3 Xử lý CONTRADICTION C3 (2 design system)

| | D08 §12 (2026-10-02) | `soc.tokens.css` |
|---|---|---|
| Nền | `#0F1117` | `#081734` / `#0f172a` |
| Nhấn | `#3B82F6` | `#22d3ee` |
| Tăng/giảm | `#22C55E` / `#EF4444` | `#34d399` / `#f87171` |

**Quyết định:** Django admin dùng **bảng màu D08** — nó là system-design pack chính thức, mới hơn, và có bảng tương phản định lượng (§12.1: chữ chính ≥ 12:1, chữ phụ ≥ 4.5:1) để gate kiểm được. **Giữ nguyên hướng Bloomberg tăng/giảm** (xanh↑/đỏ↓) — khớp L-F08 và khớp cả hai bảng, không có xung đột chỉ đánh dấu.

**Ghi nhận (không tự sửa):** `packages/web/src/components/soc/` vẫn dùng palette cũ. Đồng bộ 2 palette là việc của wave riêng, **ngoài phạm vi**.

### 3.4 Ràng buộc kỹ thuật đã kiểm chứng

| Ràng buộc | Nguồn | Hệ quả |
|---|---|---|
| `USE_I18N = False`, `LANGUAGE_CODE = 'en-us'` (`settings.py:324,326`) | đọc file | `{% translate %}` trong template admin **không** dịch. ⇒ Mọi nhãn tiếng Việt phải viết **trực tiếp** trong template/`@admin.display(description=…)`, không qua `gettext` |
| `TEMPLATES['DIRS'] = []`, `APP_DIRS = True` (`settings.py:150-151`) | đọc file | override template phải đặt trong `<app>/templates/` |
| `STORAGES.staticfiles = CompressedManifestStaticFilesStorage` (`settings.py:333`) | đọc file | CSS mới phải nằm trong app `static/` để `collectstatic` thu được, và **không** được tham chiếu file không tồn tại (manifest sẽ ném `ValueError`) |
| Django **5.2.15** | `.venv` | Có sẵn `{% block dark-mode-vars %}` + `admin/color_theme_toggle.html` ⇒ **không tự viết** dark-mode toggle, phải giữ block |
| Admin mounted `path('admin/', admin.site.urls)` (`urls.py:45`) | đọc file | mọi URL admin có dạng `/admin/<app_label>/<model>/` |

---

## 4. Baseline gate — **đo thật, không giả định** (hazard 6 + 9)

Lệnh chính xác như plan sẽ chạy, và exit code **tại thời điểm lập kế hoạch**:

| # | Gate | Lệnh | Exit **hiện tại** | AC đòi hỏi |
|---|---|---|:---:|:---:|
| G1 | Django system check | `cd packages/core/backend; $env:DJANGO_DEBUG=1; .venv\Scripts\python.exe manage.py check` | **0** ✅ | 0 |
| G2 | Migration còn sạch | `… manage.py makemigrations --check --dry-run` | **CHƯA CHẠY** | 0 |
| G3 | Migration 1 leaf | `… manage.py showmigrations \| Select-String "\[X\]" \| Measure-Object` | **CHƯA CHẠY** | 1 leaf/app |
| G4 | BE test suite | `… .venv\Scripts\python.exe run_tests.py` | **đang chạy** (176 label) | ≤ baseline |
| G5 | Ruff | `.venv\Scripts\python.exe -m ruff check src` | **KHÔNG CHẠY ĐƯỢC** — `No module named ruff` | **KHÔNG ĐÒI HỎI** (gate đỏ sẵn — hazard 6) |
| G6 | FE typecheck | `cd packages/web; npx tsc --noEmit` | **CHƯA CHẠY** | 0 (không sửa FE ⇒ kỳ vọng không đổi) |
| G7 | FE lint | `npm run lint` | **CHƯA CHẠY** | 0 error |
| G8 | FE build | `npm run build` | **CHƯA CHẠY** | exit 0 |
| G9 | FE test | `npm run test:components` | **CHƯA CHẠY** | ≥ baseline |
| G10 | Multi-agent gate | `node packages/web/scripts/check-multi-agent.mjs` | **CHƯA CHẠY** | 0 |
| G11 | Admin UX gate (mới) | `python packages/core/backend/scripts/check_admin_ux.py` | **CHƯA TỒN TẠI** | tạo ở S5 |
| G12 | Pre-push gate | `node scripts/pre-push-gate.mjs` | **CHƯA CHẠY** | 0 FAIL |

> ⚠ **G5 không có ý nghĩa nếu chạy.** Đây chính là hazard 9 (`build:analyze` được liệt kê là gate nhưng exit 1). Không cài ruff (non-goal N3) ⇒ ghi **CHƯA CHẠY**, không đòi PASS.

---

## 5. Slice + Tiêu chí nghiệm thu

> Mỗi AC là **Given/When/Then** và phải trả lời được câu hỏi của hazard 8: *"nếu cái này PASS mà tính năng vẫn vô dụng, AC này có bắt được không?"*

### S1 — Nền tảng: brand + shell + design token

| AC | Given/When/Then |
|---|---|
| **S1-AC1** | Given user staff, When mở **bất kỳ** trang admin nào, Then HTML có `class="vnadmin"` trên `<body>` và link `admin/css/vnadmin.css` trong `<head>`. *(Quan sát được: người dùng thấy giao diện mới, không chỉ "CSS file tồn tại".)* |
| **S1-AC2** | Given `base.html` override, When render `admin/index.html`, `admin/change_list.html`, `admin/change_form.html`, `admin/login.html`, `admin/delete_confirmation.html`, `admin/select2.html` (popup), Then **không** `TemplateSyntaxError` (tức mọi block Django kế thừa vẫn tồn tại) |
| **S1-AC3** | Given `dark-mode-vars` block của Django 5.2, When render bất kỳ trang, Then block còn nguyên và `color_theme_toggle.html` vẫn include ⇒ chế độ sáng/tối của Django không bị phá |
| **S1-AC4** | Given `collectstatic` chạy với `CompressedManifestStaticFilesStorage`, When tham chiếu `admin/css/vnadmin.css`, Then **không** `ValueError: Missing staticfiles manifest entry` |
| **S1-AC5** | Given token `--vn-*`, When so token màu với bảng D08 §12.1, Then **12/12** khớp giá trị (gate `check_admin_ux.py` kiểm) |
| **S1-AC6** | Given mọi nút/link tương tác trong CSS mới, When tính vùng chạm, Then ≥ 24×24px (D08 §13) |
| **S1-AC7** | Given `prefers-reduced-motion: reduce`, When render trang, Then không còn transition ≥ 100ms trên phần tử `vnadmin` (D08 §13, mục 2.3.3) |

**File:** `admin_ui/{__init__,branding}.py`, `templates/admin/base.html`, `static/admin/css/vnadmin.css`
**Rollback:** `git revert <commit S1>` — không đụng model/migration.

### S2 — Dashboard vận hành

| AC | Given/When/Then |
|---|---|
| **S2-AC1** | Given staff mở `/admin/`, When trang render, Then thấy **4 thẻ KPI**: tổng tenant, người dùng, giao dịch 24h, tỷ lệ API. Giá trị khớp `Model.objects.count()` tại thời điểm render *(đối chiếu được — không phải "không crash")* |
| **S2-AC2** | Given DB rỗng, When render dashboard, Then 4 thẻ hiện `0`, **không** `None`, **không** `VariableDoesNotExist` |
| **S2-AC3** | Given dữ liệu mới nhất của `DailyPrice` > 24h, When render, Then xuất hiện cảnh báo "dữ liệu giá đã cũ" kèm mốc thời gian |
| **S2-AC4** | Given bất kỳ truy vấn dashboard nào lỗi, When render, Then dashboard **vẫn render** và thẻ đó hiện `—` kèm ghi chú, **không** trả 500 |
| **S2-AC5** | Given truy vấn dashboard, When đo thời gian, Then < 800ms với 10k tenant + 100k transaction |

**File:** `admin_ui/dashboard.py`, `templates/admin/index.html`, `templates/admin/includes/*.html`
**Rollback:** `git revert <commit S2>`; `admin/index.html` xoá ⇒ Django rơi về index mặc định.

### S3 — Chuẩn hoá ModelAdmin (34 cái) + khai báo admin cho model còn thiếu

| AC | Given/When/Then |
|---|---|
| **S3-AC1** | Given 5 app chưa có `admin.py`, When `makemigrations --check` chạy, Then **0 thay đổi model** (admin registration không sinh migration) |
| **S3-AC2** | Given bất kỳ `ModelAdmin` nào trong 15 app, When render changelist, Then có `date_hierarchy` **hoặc** `list_filter` có trường ngày — không model nào không có đường lọc theo thời gian |
| **S3-AC3** | Given cột trạng thái (`status`, `is_active`, `severity`…), When render changelist, Then hiển thị **badge màu** có **chữ** (không chỉ màu — D08 §13 "Không chỉ dựa vào màu") |
| **S3-AC4** | Given cột tiền (`amount_due`), When render, Then định dạng `1.240.000 ₫` (D08 §14.2: dấu chấm phân tách, ký hiệu trước) |
| **S3-AC5** | Given cột thời gian, When render, Then định dạng `dd/mm/YYYY HH:mm` giờ Việt Nam, không ISO thô |
| **S3-AC6** | Given trường nullable không có giá trị, When render, Then hiện `—` chứ không trống |
| **S3-AC7** | Given model FK đến model khác có ≥ 1000 bản ghi, When mở changelist, Then **không** N+1: `assertNumQueries` chặn trên `list_select_related`/`prefetch_related` |
| **S3-AC8** | Given model **read-only theo thiết kế** (`AuditEvent`, `RequestTrace`, `TenantLifecycleEvent`, `AdDailySummary`, `AdImpressionLog`, `AdClickLog`), When thử POST add/change, Then `403` — hành vi **giữ nguyên** như trước, không nới |
| **S3-AC9** | Given `CORE_PAT_PEPPER`-adjacent secret fields (`token_secret_hash`, `*_encrypted`), When mở change form, Then **vẫn** nằm trong `readonly_fields` — không lộ giá trị |
| **S3-AC10** | Given `support.SupportTicket`, When mở changelist, Then có `list_select_related('assignee')` + filter theo `status`/`priority`. ⚠ Tên trường là **`assignee`**, không phải `assigned_to` (`support/models.py`, `SupportTicket.assignee = models.ForeignKey(...)`) |

**File:** 10 `admin.py` hiện có + 5 `admin.py` mới + `admin_ui/{display,mixins,labels}.py`
**Rollback:** theo từng app. ⚠ **S3-AC8 là hành vi bảo mật** — revert S3 **không được** làm nới quyền.

### S4 — Menu nhóm chức năng + nhãn tiếng Việt

| AC | Given/When/Then |
|---|---|
| **S4-AC1** | Given sidebar admin, When render, Then nhóm theo **nghiệp vụ** (Vận hành & Dữ liệu / Khách hàng & Tài chính / Giao dịch & Danh mục / AI & Tư vấn / Nội dung quảng cáo / Hệ thống), không theo app-label kỹ thuật |
| **S4-AC2** | Given `CoreTenant` trong group "Khách hàng", When click, Then URL **vẫn** `/admin/identity_access/coretenant/` (URL gốc không đổi — `ADMIN_UI_IMPLEMENTATION_STEPS.md:80` yêu cầu giữ URL) |
| **S4-AC3** | Given model mới thêm sau khi deploy, When sidebar render, Then **tự xuất hiện** ở nhóm mặc định — không cần sửa tuple danh sách |
| **S4-AC4** | Given nhãn tiếng Việt, When so với bảng thuật ngữ (`AGENTS.md` Constraints), Then **đủ dấu**, không trộn "Tên"/"Ten" |
| **S4-AC5** | Given `USE_I18N = False`, When render sidebar, Then **không** còn chuỗi `Translate "` hay nhãn tiếng Anh thô cho model thuộc nhóm đã Việt hoá |

**File:** `admin_ui/branding.py`, `admin_ui/labels.py`
**Rollback:** `git revert <commit S4>`.

### S5 — A11y + gate máy

| AC | Given/When/Then |
|---|---|
| **S5-AC1** | Given `scripts/check_admin_ux.py`, When chạy trên repo sạch, Then **exit 0** |
| **S5-AC2** | Given gate, When cố tình xoá 1 token màu khỏi `vnadmin.css`, Then **exit khác 0** (negative test — hazard: gate chỉ mới được thấy PASS là chưa được kiểm) |
| **S5-AC3** | Given gate, When thêm model mới chưa khai báo admin, Then gate báo nhưng **không** fail build (cảnh báo, vì đăng ký admin là quyết định) |
| **S5-AC4** | Given trang admin, When audit `axe`/kiểm thủ công: focus ring nhìn thấy trên **cả** nền sáng và nền tối; skip-to-content còn nguyên |
| **S5-AC5** | Given viewport < 768px, When render changelist, Then bảng cuộn ngang **có** thanh cuộn rõ (D08 §15 ghi cuộn ngác là sai — nhưng admin desktop-first: chấp nhận cuộn ngang kèm dấu hiệu, KHÔNG biến thành card) |

**File:** `packages/core/backend/scripts/check_admin_ux.py` (+ `--self-test`), `pre-push-gate.mjs` (1 dòng)
**Rollback:** bỏ khỏi `pre-push-gate.mjs`.

---

## 6. Việc **cần Owner quyết** (KHÔNG tự làm trong PR này)

| # | Việc | Vì sao tách |
|---|---|---|
| **Q1** | **F1 — sửa `nginx.conf:140`** `location ^~ /admin/advertising` | Đụng 14 route SPA đang chạy production. Cần Owner duyệt + smoke test `/admin/advertising/adcampaign/` sau khi sửa. Cũng cần mở rộng `check-admin-spa-routes.mjs` thành gate **2 chiều** |
| **Q2** | Đồng bộ palette admin với `soc.tokens.css` | 2 design system; sửa palette SOC ảnh hưởng toàn bộ web app đã audit 14 wave |
| **Q3** | Bật `USE_I18N = True` | Đổi hệ thống toàn repo, ảnh hưởng mọi response API. Ngoài phạm vi admin |

---

## 7. Chiến lược kiểm chứng (hazard 8/9/10)

1. **Baseline trước, đo thật** — §4. Không AC nào đòi PASS từ gate đang đỏ.
2. **Fail-before/pass-after** cho mọi test mới: swap file bằng `git show <base-sha>:<file>` (L-A01 — **không** `git checkout --`).
3. **Negative test cho chính gate** (S5-AC2).
4. **Đếm bằng script, không đếm bằng mắt** (L-G04): số model, số badge, số nhãn.
5. **Render thật qua test client** — AC về template chỉ PASS khi đã render, không phải khi file tồn tại.
6. **Số liệu kèm lệnh tái tạo** — mọi con số trong `REPORT_FINAL` phải paste được command.

---

## 8. Định nghĩa "xong"

- [ ] S1–S5 đều có commit riêng trên `feat/django-admin-uiux-pm`.
- [ ] `AUDIT_DJANGO_ADMIN_UIUX_20261010.md`: **0 blocker, 0 major, `confidence: high`**.
- [ ] `TEST_REPORT`: mỗi dòng `Pass` **hoặc** `CHƯA CHẠY` + lý do. Không dòng nào `FAIL`.
- [ ] **Sau khi rebase lên `dev`**: chạy lại **toàn bộ** gate §4 (L-G01/L-G03 — gate trước rebase vô nghĩa).
- [ ] `makemigrations --check --dry-run` exit 0 + **1 leaf** mỗi app (L-M01/L-M02/L-M03).
- [ ] Ledger `## Entry 265` + `docs/CLAIMS.md` `done` + PR.
- [ ] Nhật ký bàn giao: `docs/audit-uiux/SESSION_LOG_WAVE15_ADMIN_20261010.md`.

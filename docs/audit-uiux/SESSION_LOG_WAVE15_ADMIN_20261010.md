# NHẬT KÝ SESSION — Wave 15: Refactor Django admin UI/UX

**Ngày:** 2026-10-10 · **Agent:** `adminui-w15` · **Branch:** `feat/django-admin-uiux-pm` -> `dev`
**Vai trò:** Project Manager + Tech Lead (Mode B — self-supervised solo)
**Claim:** `docs/CLAIMS.md` mục `## 2026-10-10 - Wave 15`

---

## 0. Bài học nạp trước khi lập kế hoạch (Planning Gate)

Skill `project-lessons` **không nạp được** qua `Skill` tool (`Skill: "project-lessons"
not found`) dù `.opencode/skills/project-lessons/` **có tồn tại** — đúng cái bẫy
`AGENTS.md` mục 0 đã ghi ("tự kiểm skill có thật sự được nạp không: xem danh sách
skill của session có `project-lessons` không"). Đã đọc `SKILL.md` trực tiếp.

```
LESSONS APPLICABLE (22):
  L-001  KHÔNG commit file shared            L-G01  rebase → migration → gate
  L-002  khai claim TRƯỚC sửa dòng đầu tiên  L-G02  KHÔNG báo PASS cho thứ chưa chạy
  L-003  gate TRƯỚC rebase là sai thứ tự      L-G03  gate máy agent ≠ máy đích
  L-006  CHƯA CHẠY là kết quả hợp lệ         L-G04  đếm theo mức độ, không đếm bừa
  L-007  không có môi trường ⇒ không kết luận L-G05  deletions bất thường = triệu chứng
  L-008  không commit thẳng vào dev           L-G06  revert theo lô kéo mất fix
  L-A01  `git checkout --` phá việc chưa commit L-G07 đếm theo tên ≠ theo registry
  L-B01  BE test không chạy trên SQLite      L-T01  viết file = đổi line-ending
  L-B02  test nằm ở 2 thư mục               L-T02  citation đúng dòng nhưng sai file
  L-B03  migration không in tiếng Việt có dấu L-F03 soc.module.css chỉ là barrel
  L-F05  script viết lại CSS shorthand       L-F06  quét cửa sổ ±N dòng = false positive
  L-F08  màu tăng/giảm chuẩn Bloomberg       L-M01..03 migration/leaf

MANDATORY CHECKLIST: xem mục §7 cuối file (đã tick từng mục).
```

---

## 1. Việc đã làm

| # | Hạng mục | Kết quả |
|---|---|---|
| 1 | **Audit hiện trạng** | 10 app · 10 `admin.py` · **0** template admin · **0** CSS admin · **0** `date_hierarchy` / `autocomplete_fields` / `list_select_related` |
| 2 | **Kế hoạch** (Stage 1) | `docs/PLAN_DJANGO_ADMIN_UIUX_20261010.md` — 5 slice, 29 AC, baseline có exit code thật, 6 non-goal |
| 3 | **Audit kế hoạch** (Stage 2) | Tự phản biện → sửa **3 lỗi số liệu** trước khi code (xem §2) |
| 4 | **S1 — Nền tảng** | `admin_ui/` (7 module) · override `base.html` (28 block) · `vnadmin.css` (991 dòng) · `vnadmin-nav.js` |
| 5 | **S2 — Dashboard** | 4 thẻ KPI · cảnh báo dữ liệu giá cũ · hoạt động gần đây · menu **9 nhóm nghiệp vụ** |
| 6 | **S3 — ModelAdmin** | **+5 `admin.py` mới** (31 model) · registry **41 → 65** · 23 `date_hierarchy` · badge · `list_select_related` · định dạng VN |
| 7 | **S5 — Gate máy** | `check_admin_ux.py` + `--self-test` **12/12** · nối vào `pre-push-gate.mjs` |
| 8 | **Kiểm thử** | `tests/test_admin_ui.py` — **45 test**, gắn mã AC |
| 9 | **Audit code** (Stage 5) | `docs/AUDIT_DJANGO_ADMIN_UIUX_20261010.md` — 0 blocker, 0 major, 3 minor, confidence **high** |

---

## 2. Sai sót của chính mình — đã tự bắt, đã sửa

> Ghi lại vì `AGENTS.md` yêu cầu "Bài học cho session sau". Đây là 8 lỗi thật,
> **không** phải lỗi của người khác.

| # | Sai sót | Bắt bằng cách nào | Hệ quả nếu không bắt |
|---|---|---|---|
| 1 | Đếm **112** model thay vì **107** | Đếm lại bằng script khớp `models.Model` | Báo cáo sai 5 model |
| 2 | Nói `@admin.display` = **4** | Grep thật | Sai 1 |
| 3 | Nói `admin/base.html` có **17** block | Đếm bằng regex trên file gốc Django | Thiếu block ⇒ `TemplateSyntaxError` lúc render |
| 4 | `support` có **9** model | Đọc `models.py`: 4 class là `TextChoices` | `admin.register(TextChoices)` ⇒ admin **không khởi động** |
| 5 | Viết "Django index tốn **1 truy vấn/ModelAdmin**" | **Đo**: cả hai đường đều **0 truy vấn**; khác biệt là `has_perm` 194 vs 130 | Báo cáo con số bịa |
| 6 | Đổi `LF → CRLF` bằng Edit tool | `git diff --numstat` (534/530 thay vì 8/4) — **L-T01 lần 1** | Commit ghi đè toàn file |
| 7 | Đổi `LF → CRLF` bằng script Node | `numstat` 49/47 thay vì 3/0 — **L-T01 lần 2** | Như trên |
| 8 | Ghi **4 ký tự `U+FFFD`** vào `branding.py` | Quét byte sau khi ghi — **hazard 5** | File hỏng mà citation vẫn "đúng dòng" |

---

## 3. 5 lỗi thật trong code do test bắt được

| ID | Lỗi | Test giữ lại |
|---|---|---|
| **F-D** | **BLOCKER** — comment `{# … #}` nhiều dòng **không hoạt động** trong Django (`tag_re` không có `DOTALL`) ⇒ Django parse `{% %}` bên trong ⇒ **`/admin/` trả 500** | `test_no_multiline_hash_comments_...` + gate |
| **F-E** | Thẻ KPI trỏ tới changelist **không kiểm quyền** ⇒ 3/4 link dẫn tới 403 | `test_kpi_links_only_for_permitted_models` |
| **F-A** | `money_vi` đặt ký hiệu trước số (ngược D08 §14.2) | `test_S3_AC4_money_vi_...` |
| **F-B** | `percent_vi` mất dấu âm (`-1,25%` → `1,25%`) | `test_percent_vi_keeps_sign` |
| **F-C** | `label_for()` tra trượt do lệch hoa/thường khoá | `test_S4_AC5_model_label_...` |

**Đáng chú ý:** cả 5 đều **lọt qua `manage.py check`**. Không có bước verify nào
trong quy trình cũ bắt được chúng.

---

## 4. Phát hiện ngoài phạm vi — **cần Owner quyết**

| # | Vấn đề | Vì sao chưa sửa |
|---|---|---|
| **O1** | **`nginx.conf:140` nuốt mất toàn bộ admin của app `advertising`** (`location ^~ /admin/advertising` là prefix, khớp cả URL con của Django) | Đụng 14 route SPA đang chạy production. Cần Owner duyệt + smoke test sau khi sửa |
| **O2** | Gate `check-admin-spa-routes.mjs` chỉ quét **một chiều** ⇒ không bắt được O1 | Đổi hợp đồng gate dùng chung |
| **O3** | `entrypoint.sh:21` `collectstatic … \|\| true` ⇒ thất bại bị **bỏ qua âm thầm**, mọi trang admin 500 vì thiếu manifest | Hạ tầng triển khai, ngoài phạm vi |
| **O4** | `docs/ADMIN_UI_IMPLEMENTATION_STEPS.md` **STALE** — tham chiếu `backend/portfolio/` không tồn tại | Tài liệu lịch sử |
| **O5** | 2 design system cùng tồn tại: D08 `#0F1117` vs `soc.tokens.css` `#081734` | Đồng bộ web app đã qua 14 wave audit |
| **O6** | **49 model** vẫn chưa có admin (`identity_access` 16 · `user_workspace` 15 · `market_data` 5 · `signal_intelligence` 4 · `commercial` 3 · còn lại 6). Phần lớn là bảng nhạy cảm: `PasswordResetToken`, `UserDNECredential`, `IdempotencyRecord` | **Mở quyền sửa cho bảng nội bộ là quyết định của Owner**, không tự làm |

---

## 5. Gate đã chạy (exit code thật)

| Gate | Lệnh | Kết quả |
|---|---|---|
| Django system check | `manage.py check` | **exit 0** |
| Không sinh migration | `manage.py makemigrations --check --dry-run` | **exit 0** — `No changes detected` |
| Thu thập static | `manage.py collectstatic --noinput` | **exit 0** — 168 file, manifest có `vnadmin.*` |
| Gate admin UX | `scripts/check_admin_ux.py` | **exit 0** — 0 chặn, 49 cảnh báo |
| Gate self-test | `scripts/check_admin_ux.py --self-test` | **exit 0** — **12/12** |
| Test admin | `manage.py test tests.test_admin_ui --keepdb` | **exit 0** — **45/45** |
| Phá vòng gate (thật) | đổi `--vn-bg` + bỏ `<time>` | **exit 1** — 2 lỗi chặn |
| Ruff | `python -m ruff` | **CHƯA CHẠY** — `No module named ruff` trong `.venv` (không cài, non-goal N3) |
| BE suite 176 label | `run_tests.py` | xem `TEST_REPORT` |
| FE (`tsc`/`lint`/`build`/`test`) | — | **CHƯA CHẠY** — không sửa dòng `packages/web/src` nào; phải chạy lại **sau khi rebase** |
| Trình duyật / axe / Playwright | — | **CHƯA CHẠY** — mọi kết luận giao diện đến từ HTML render |

---

## 6. Bàn giao cho session sau

### 6.1 Việc **phải** làm tiếp (theo thứ tự)

1. **Đọc `docs/OPEN_WORK_20260927.md` và `docs/CLAIMS.md`** trước khi nhận việc mới.
2. **Xử lý O1** (`nginx.conf:140`) — PR riêng, cần Owner duyệt. Kèm mở rộng
   `check-admin-spa-routes.mjs` thành gate **hai chiều**.
3. **Đo bằng trình duyệt**: axe/Playwright cho focus ring trên nền tối, vùng chạm
   24px, chuyển động, và **ảnh chụp màn hình** sáng/tối (chưa có bằng chứng nào).
4. **Chạy lại toàn bộ gate sau khi rebase lên `dev`** — L-G01/L-G03: kết quả trước
   rebase không đại diện cho kết quả sau.
5. **Quyết O6** với Owner rồi mới khai báo admin cho 49 model còn lại.

### 6.2 Bẫy đã gặp — **đọc trước khi sửa template Django**

| Bẫy | Hệ quả | Cách tránh |
|---|---|---|
| `{# … #}` **không** bắt được dòng mới | Django parse `{% %}` bên trong ⇒ 500 | Dùng `{% comment %}…{% endcomment %}`; gate đã chặn |
| `APP_DIRS` **không** đủ để override template của `django.contrib.admin` | File của ta không bao giờ được dùng | `TEMPLATES['DIRS']` được tra **trước** `APP_DIRS` |
| `admin.site._registry` khoá theo **lớp Model** (từ Django 5.1), không phải tuple | `TypeError` lúc autodiscover | Dựng chỉ mục riêng theo chuỗi |
| Autodiscover `vninvest_core` **trước** `identity_access` | Branding & nhãn set lúc đó **không có tác dụng** | Đổi ở tầng trình bày, không ghi trạng thái toàn cục lúc import |
| `nav_sidebar.js` của Django lọc bằng `th[scope=row] a` | Sidebar mới không có node đó ⇒ **bộ lọc luôn báo không có kết quả** | Script riêng `vnadmin-nav.js` |
| `CompressedManifestStaticFilesStorage` đổi tên file kèm hash | Assert `vnadmin.css` trong HTML là **sai** | Assert theo đường dẫn `admin/css/vnadmin.<hash>.css` |

### 6.3 File quan trọng

| File | Vai trò |
|---|---|
| `packages/core/backend/src/vninvest_core/admin_ui/` | Lớp trình bày (7 module) |
| `packages/core/backend/src/vninvest_core/templates/admin/` | `base.html` · `index.html` · `nav_sidebar.html` |
| `packages/core/backend/src/vninvest_core/static/admin/` | `css/vnadmin.css` · `js/vnadmin-nav.js` |
| `packages/core/backend/scripts/check_admin_ux.py` | Gate (self-test 12/12) |
| `packages/core/backend/tests/test_admin_ui.py` | 45 test, gắn mã AC |

---

## 7. MANDATORY CHECKLIST — đã tick

- [x] **L-001** — Không file nào trong deny-list §2 bị commit
- [x] **L-002** — Claim commit riêng **trước** dòng code đầu tiên (`f54ce331c`)
- [x] **L-003/L-G01** — Chưa rebase lúc viết; đã ghi rõ gate phải chạy lại sau rebase
- [x] **L-006/L-G02** — `CHƯA CHẠY` ghi rõ lý do cho ruff / FE / trình duyệt
- [x] **L-007** — Có Postgres thật `127.0.0.1:5433`, DB riêng `adminui_verify`
- [x] **L-008** — Trên `feat/django-admin-uiux-pm`, **không** commit thẳng `dev`
- [x] **L-A01** — Không dùng `git checkout --`; mọi phép phá vòng copy file ra `%TEMP%`
- [x] **L-B01** — Test chạy trên **Postgres**, không ép SQLite
- [x] **L-M01..03** — `makemigrations --check` exit 0; **không** tạo migration
- [x] **L-T01** — `numstat` kiểm trước khi stage; chuẩn hoá LF cho file của mình **2 lần**
- [x] **L-T02** — Mọi citation kiểm lại bằng cách mở đúng file, đọc đúng dòng
- [x] **L-F05** — `test_LF05_...` chặn `transition` mất `<time>`; gate quét sau khi bỏ comment
- [x] **L-F08** — Gain/loss giữ chuẩn Bloomberg (xanh↑ / đỏ↓), có test
- [x] **L-G04** — Đếm lại bằng script; **sửa 3 con số sai** trước khi code
- [x] **Hazard 9** — Chạy từng gate một lần và ghi exit code thật
- [x] **Hazard 10** — **5/5** fail-before chứng minh bằng phép phá thật
- [x] **Hazard 5** — Quét `U+FFFD` sau khi ghi; gate giữ lại kiểm tra này

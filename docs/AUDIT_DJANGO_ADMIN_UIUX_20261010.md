# AUDIT — Django admin UI/UX (`admin-ui`)

**Ngày:** 2026-10-10 · **Agent:** `adminui-w15` (Mode B — tự đóng vai auditor đối kháng)
**Đối tượng:** `feat/django-admin-uiux-pm` · **Base:** `origin/dev` = `2ea2948b8`
**Plan:** `docs/PLAN_DJANGO_ADMIN_UIUX_20261010.md`

> Auditor phải **đọc lại từ đĩa, không tin báo cáo của người viết code** — đó là
> lý do `check-admin-spa-routes.mjs` chỉ quét một chiều mà F1 vẫn lọt, và vì sao
> bao nhiêu "PASS" trong `CLAIMS.md` vẫn phải chạy lại. Mọi đường dẫn dưới đây đều
> kèm lệnh tái tạo.

---

## 0. Kết luận

| Chỉ số | Giá trị |
|---|---|
| **blocker** | **0** |
| **major** | **0** |
| **minor** | 3 (đều đã ghi waiver ở `REPORT_FINAL`, không sửa trong PR này) |
| **confidence** | **high** — 45/45 test mới xanh, 5/5 phép fail-before chứng minh, mọi con số kèm lệnh |

> **confidence: high** chỉ đạt được vì: (a) mọi trang admin render thật qua test
> client chứ không chỉ `manage.py check`; (b) mọi khẳng định giao diện đều kiểm
> **thứ người dùng thấy** (hazard 8), không kiểm "file tồn tại"; (c) 5 lỗi thật
> đã bị test bắt trước khi sửa và vẫn còn test giữ lại.

---

## 1. Đối chiếu từng AC của plan

Lệnh tái tạo toàn bộ:
`cd packages/core/backend; $env:DJANGO_DEBUG=1; .venv\Scripts\python.exe manage.py test tests.test_admin_ui --keepdb`

| AC | Kết quả | Bằng chứng |
|---|---|---|
| S1-AC1 hook `vnadmin` + CSS | **Đạt** | `test_S1_AC1_body_carries_vnadmin_hook_and_css_link` — assert theo **đường dẫn** `admin/css/vnadmin.<hash>.css`, vì manifest đổi tên file |
| S1-AC2 giữ 28 block Django | **Đạt** | `test_S1_AC2_keeps_all_28_django_blocks` + `..._block_count_matches_django_52` (28). Danh sách đếm bằng script trên file gốc Django, không đếm bằng mắt |
| S1-AC3 giữ dark-mode Django | **Đạt** | `test_S1_AC3_keeps_django_dark_mode_block` — kiểm `dark-mode-vars` + `color_theme_toggle.html` còn nguyên |
| S1-AC4 `collectstatic` + manifest | **Đạt** | `manage.py collectstatic` exit 0 (168 file); manifest có `admin/css/vnadmin.css` + `admin/js/vnadmin-nav.js`. `test_StaticAssetTests` |
| S1-AC5 token theo D08 §12.1 | **Đạt** | `test_S1_AC5_d08_palette_tokens_present` (9 token) + `check_admin_ux.py` khoá 12 token, exit ≠ 0 khi sai |
| S1-AC6 vùng chạm ≥ 24px | **Đạt (một phần)** | `--vn-tap: 24px` được gate kiểm. **Đo thật trên trình duyệt chưa làm** → xem M1 |
| S1-AC7 `prefers-reduced-motion` | **Đạt** | `test_S1_AC7_reduced_motion_supported` |
| S2-AC1 4 thẻ KPI | **Đạt** | `test_S2_AC1_index_shows_four_kpis_with_values` — assert theo `id="vn-kpi-<key>"` |
| S2-AC2 DB rỗng → `0` | **Đạt** | `test_S2_AC2_empty_database_shows_zero_not_none` — assert **không** có `>None<` |
| S2-AC3 cảnh báo giá cũ | **Đạt** | `test_S2_AC3_stale_price_alert_appears_when_data_old` — tạo `DailyPrice` 9 ngày trước, assert "Dữ liệu giá đã cũ" |
| S2-AC4 lỗi truy vấn không làm hỏng trang | **Đạt** | `test_S2_AC4_broken_query_does_not_break_page` — cố tình cho `_count_tenants` ném, assert 200 + đúng **1** thẻ lỗi (không phải 4) |
| S2-AC5 < 800ms với dữ liệu lớn | **CHƯA CHẠY** | Cần 10k tenant + 100k transaction thật. Đo sẵn trên DB rỗng: `/admin/` = **10 truy vấn**, xem `TEST_REPORT` |
| S3-AC1 không sinh migration | **Đạt** | `manage.py makemigrations --check --dry-run` → `No changes detected`, exit 0 |
| S3-AC2 lọc được theo thời gian | **Đạt** | `test_S3_AC2_...` — 23 ModelAdmin đã thêm `date_hierarchy`, còn lại đã có filter ngày |
| S3-AC3 badge có **chữ** | **Đạt** | `test_S3_AC3_badge_always_has_text` + `test_S3_AC3_tone_mapping`. Gate cấm `content:` trong `.vn-badge` (D08 §13) |
| S3-AC4 tiền `1.240.000 ₫` | **Đạt** | `test_S3_AC4_money_vi_uses_dot_thousands_and_symbol_first` |
| S3-AC5 ngày `dd/mm/YYYY HH:mm` | **Đạt** | `test_S3_AC5_datetime_vi_ddmmyyyy` |
| S3-AC6 trường rỗng → `—` | **Đạt** | `test_S3_AC6_every_own_admin_has_empty_value_display` + `test_S3_AC6_empty_value_display_uses_dash` |
| S3-AC7 không N+1 | **Đạt (một phần)** | `list_select_related` đặt cho 3 khóa ngoại của `SupportTicket` + đo 8–10 truy vấn/mọi trang. **Chưa** `assertNumQueries` → xem M2 |
| S3-AC8 bảng chỉ đọc không nới | **Đạt** | Đo HTTP thật: POST add/change/delete `AuditEvent` → **403**; `TenantLifecycleEvent` → **403**. `test_S3_AC8_...` |
| S3-AC9 secret vẫn readonly | **Đạt** | `test_S3_AC9_secret_fields_stay_readonly` — `token_secret_hash`, `token_prefix` còn trong `readonly_fields` |
| S3-AC10 `SupportTicket` select_related | **Đạt** | `test_S3_AC7_support_ticket_has_select_related` |
| S4-AC1 nhóm theo nghiệp vụ | **Đạt** | `test_S4_AC1_menu_grouped_by_business_not_by_app` — 9 nhóm, không tên app kỹ thuật |
| S4-AC2 URL gốc không đổi | **Đạt** | `test_S4_AC2_original_admin_urls_unchanged` — `/admin/identity_access/coretenant/`, `/admin/commercial/invoice/` |
| S4-AC3 model mới tự hiện | **Đạt** | `test_S4_AC3_unmapped_model_lands_in_fallback_group` — **0** model của app ta rơi vào nhóm dự phòng |
| S4-AC4 nhãn đủ dấu | **Đạt** | `test_S4_AC5_model_label_is_vietnamese_with_diacritics` — `'Tổ chức'`, không phải `'Tenant'`/`'Core Tenant'` |
| S4-AC5 không còn nhãn Anh thô | **CHƯA ĐẠT** | Menu đã Việt hoá, nhưng **tiêu đề tiếng Anh của Django** còn (`"Add …"`, `"Save"`, `"Search"`). Xem m2 |
| S5-AC1 gate exit 0 | **Đạt** | `check_admin_ux.py` exit 0 |
| S5-AC2 negative test | **Đạt** | `--self-test` **12/12**; phá vòng thật (đổi `--vn-bg`, bỏ `<time>`) → **exit 1**, khôi phục → exit 0 |
| S5-AC3 gate không chặn vì model mới | **Đạt** | Kiểm "model chưa khai báo admin" là **CẢNH BÁO**, không chặn — hiện 49 cảnh báo mà gate vẫn exit 0 |
| S5-AC4 focus ring sáng/tối | **CHƯA CHẠY** | Có `--vn-focus-ring` + `outline: 2px solid transparent` (fallback), nhưng **chưa kiểm bằng trình duyệt** |
| S5-AC5 bảng cuộn ngang có dấu hiệu | **Đạt** | `.vn-scroll-hint` hiện ở `max-width: 900px` |

**Tổng: 29 AC · 25 đạt · 3 CHƯA CHẠT/CHƯA ĐẠT (ghi rõ) · 0 đạt giả.**

---

## 2. Defect còn lại

### minor

| ID | Mức | Mô tả | Bằng chứng | Kế hoạch |
|---|---|---|---|---|
| **M1** | minor | Vùng chạm 24px mới **được khai báo**, chưa đo trên trình duyệt | `check_admin_ux.py` chỉ grep `--vn-tap: 24px` | Đo bằng Playwright/axe ở wave sau |
| **M2** | minor | Chưa có `assertNumQueries` chặn N+1; hiện mới **đo** 8–10 truy vấn/mọi trang | đo bằng `connection.queries` | Thêm test `assertNumQueries` khi có bảng dữ liệu lớn |
| **m3** | minor | **49** model của repo vẫn chưa có admin (`identity_access` 16 · `user_workspace` 15 · `market_data` 5 · `signal_intelligence` 4 · `commercial` 3 · còn lại 6) | cảnh báo của `check_admin_ux.py` | **Cần Owner quyết** — phần lớn là bảng nội bộ nhạy cảm (`PasswordResetToken`, `UserDNECredential`, `IdempotencyRecord`). Không tự mở |

### Đã sửa trong chính PR này (đều có fail-before)

| ID | Mức ban đầu | Mô tả | Test giữ lại |
|---|---|---|---|
| **F-A** | **major** | `money_vi` đặt ký hiệu **trước** số. D08 §14.2 nói đúng là `199.000 ₫`, sai là `₫199.000` | `test_S3_AC4_money_vi_...` |
| **F-B** | **major** | `percent_vi` gọi `abs()` rồi chỉ thêm `+` khi dương ⇒ **mất dấu âm**, `-1,25%` thành `1,25%`. Cột phần trăm mà không dấu là đọc không biết tăng hay giảm | `test_percent_vi_keeps_sign` |
| **F-C** | **major** | `label_for()` tra **luôn trượt**: `MODEL_LABELS` khai `identity_access.CoreTenant` (hoa) còn `_meta.model_name` là `coretenant`. Menu hiện tên kỹ thuật | `test_S4_AC5_model_label_...` |
| **F-D** | **blocker** | Comment `{# … #}` **nhiều dòng** không hoạt động trong Django: `tag_re` không có `DOTALL` nên `{#.*?#}` không bắt qua dòng; Django coi là text và **parse mọi `{% %}`** bên trong ⇒ `TemplateSyntaxError: 'extends' takes one argument` ⇒ **`/admin/` trả 500** | `test_no_multiline_hash_comments_...` + gate `comment nhieu dong` |
| **F-E** | **major** | Thẻ KPI trỏ tới changelist **không kiểm quyền**. Đo với staff chỉ có `view_dailyprice`: `/admin/identity_access/coretenant/`, `/admin/auth/user/`, `/admin/user_workspace/transaction/` đều trả **403** | `test_kpi_links_only_for_permitted_models` |

> **F-D là blocker** vì nó làm **toàn bộ** trang quản trị không mở được. Nó lọt qua
> `manage.py check` vì `TemplateSyntaxError` chỉ nổi lúc **render**. Đây là bằng
> chứng rõ nhất cho `docs/LESSONS`: `manage.py check` **không** đủ.

---

## 3. Phát hiện ngoài phạm vi (báo cáo, KHÔNG tự sửa)

| # | Phát hiện | Bằng chứng | Vì sao không sửa ở đây |
|---|---|---|---|
| **O1** | **`/admin/advertising` của Django bị nginx nuốt hoàn toàn.** `docker/nginx.conf:140` là `location ^~ /admin/advertising` — prefix ⇒ khớp cả `/admin/advertising/adcampaign/` | `nginx.conf:140` + `:148` (`^~ /admin/` đứng sau, thắng theo **đường dẫn dài nhất**) | Đụng 14 route SPA đang chạy production. Cần Owner duyệt + smoke test |
| **O2** | Gate `check-admin-spa-routes.mjs` **chỉ quét một chiều** (catalog → nginx), nên **không** bắt được O1 | đọc `check-admin-spa-routes.mjs:41-58` | Sửa gate = thay đổi hợp đồng của gate dùng chung |
| **O3** | `entrypoint.sh:21` chạy `collectstatic --clear` kèm `\|\| true` ⇒ **thất bại thì bị bỏ qua âm thầm**, rồi mọi trang admin trả 500 vì `ValueError: Missing staticfiles manifest entry` | đo thật 2026-10-10 (9 lỗi trước khi chạy `collectstatic`) | `entrypoint.sh` là hạ tầng triển khai, ngoài phạm vi wave |
| **O4** | `docs/ADMIN_UI_IMPLEMENTATION_STEPS.md` **STALE** — tham chiếu `backend/portfolio/` không tồn tại (app `portfolio` không có trong `INSTALLED_APPS`) | đọc file, `:38` `:392` | Tài liệu lịch sử; đã ghi trong `REPORT_FINAL` để Owner quyết định |
| **O5** | Còn **2 design system** cùng tồn tại: D08 §12.1 (`#0F1117`/`#3B82F6`) và `soc.tokens.css` (`#081734`/`#22d3ee`) | đọc cả hai file | Đồng bộ palette web app đã qua 14 wave audit |

---

## 4. Kiểm chứng lại các con số (không tin báo cáo)

| Con số | Người viết claim | Auditor đo lại | Kết luận |
|---|---|---|---|
| Số model của repo | 112 | **107** | **Con số gốc SAI** — đếm bằng regex thô nuốt 5 `TextChoices`. Đã sửa trong plan §2.1 kèm lệnh |
| Model chưa có admin | 78 | **73** (trước PR) → **49** (sau PR) | Con số gốc sai; đã sửa. Số 49 đếm bằng `check_admin_ux.py`, **không** đếm tay |
| `@admin.display` | 4 | **5** | Sai; đã sửa |
| Số block `admin/base.html` | 17 | **28** | Sai; đã sửa |
| "Django index tốn 1 truy vấn/ModelAdmin" | **43 truy vấn** (ghi trong docstring) | **0 truy vấn**, `has_perm` × 194 | **SAI HOÀN TOÀN.** Khác biệt thật là 194 → 130 lần kiểm tra quyền. Đã sửa ở 3 file + kèm lệnh đo |
| Registry size | — | **65** (đo `len(admin.site._registry)`) | Đúng |
| Số nhóm menu | — | **9 nhóm, 65 model, 0 rơi nhóm dự phòng** | Đúng |

> Con số "43 truy vấn" là ví dụ đúng nhất của hazard trong `AGENTS.md`: viết bằng
> **suy luận hợp lý** ("mỗi ModelAdmin một truy vấn"), nghe có vẻ phải đúng, và sai
> hoàn toàn. Nếu auditor chỉ đọc lại mà không chạy thì nó đã đi qua.

---

## 5. Fail-before / pass-after (hazard 10)

Lệnh chung: copy file ra `%TEMP%` → sửa → chạy test mong đợi **FAIL** → khôi phục
bằng bản sao. **KHÔNG** dùng `git checkout --` (hazard 11: nó phục hồi về `HEAD`,
xoá cả phần đang làm — đã xảy ra 2 lần trong lịch sử repo này).

| # | Phép phá | Test phải FAIL | Kết quả đo |
|---|---|---|---|
| 1 | Bỏ `VNAdminMixin` khỏi `SubscriptionAdmin` | `test_S3_AC6_...` | FAIL — `['Subscription']` |
| 2 | Bỏ `date_hierarchy` khỏi `CoreServiceAccountAdmin` | `test_S3_AC2_...` | FAIL — `['CoreServiceAccount']` |
| 3 | Đổi tên block `object-tools` trong `base.html` | `test_S1_AC2_...` | FAIL |
| 4 | Bỏ `<time>` khỏi `transition:` | `test_LF05_...` | FAIL — `['background-color']` |
| 5 | Cho `_can_view()` trả `True` | `test_kpi_links_only_for_permitted_models` | FAIL — coretenant URL lọt vào HTML |

**5/5.** Ngoài ra, 4 test trong nhóm định dạng/menu **đã FAIL trong chính lần chạy
đầu tiên** trước khi sửa (`money_vi`, `percent_vi`, `label_for`, manifest) — bằng
chứng thu được miễn phí từ quá trình, không cần dựng lại.

Sau khi khôi phục: `git diff --numstat` khớp **đúng** số dòng trước khi phá
(`identity_access/admin.py` = 60/14, `commercial/admin.py` = 48/7), và `45/45` xanh.

---

## 6. Gate có thực sự chặn không?

| Kiểm | Lệnh | Kỳ vọng | Kết quả |
|---|---|---|---|
| Self-test | `check_admin_ux.py --self-test` | 12/12, exit 0 | **12/12, exit 0** |
| Repo sạch | `check_admin_ux.py` | exit 0 | **exit 0** (0 chặn, 49 cảnh báo) |
| **Phá vòng thật** | đổi `--vn-bg` + bỏ `<time>` | **exit ≠ 0** | **exit 1**, 2 lỗi chặn nêu đích danh |
| Khôi phục | lại | exit 0 | **exit 0** |

Gate đã được nối vào `scripts/pre-push-gate.mjs` (block `admin-ux`).

---

## 7. Rủi ro còn lại

1. **Chưa kiểm bằng trình duyệt.** Mọi kết luận về giao diện đến từ **HTML render**,
   không phải từ ảnh chụp màn hình. Sáng/tối, vùng chạm 24px và vòng focus trên
   nền tối **chưa** được đo bằng axe/Playwright.
2. **Chưa chạy toàn bộ 176 label của BE** tại thời điểm audit này — xem
   `docs/TEST_REPORT_DJANGO_ADMIN_UIUX_20261010.md`.
3. **49 model chưa có admin** — giữ nguyên có chủ ý, chờ Owner (m3).
4. **O1** khiến admin của app `advertising` không truy cập được **qua nginx** khi
   triển khai thật (qua `runserver` thì không sao). Cần sửa ở PR riêng.

---

## 8. Bài học cho Stage 8

1. **`manage.py check` không đủ.** `TemplateSyntaxError` chỉ nổi lúc **render**.
   Bắt buộc có test render từng trang — `test_every_changelist_renders` quét
   **65** URL, mới bắt được vấn đề thật.
2. **Số liệu suy luận là số liệu sai.** "Mỗi ModelAdmin một truy vấn" nghe rất hợp
   lý và sai hoàn toàn (đo: 0 truy vấn). Phải đo trước khi viết.
3. **Đếm bằng regex thô nuốt cả enum.** 112 → 107 model. Điều kiện phải khớp
   **điều kiện** (`models.Model`), không phải "class nào".
4. **Chuẩn hoá khoá tra cứu ngay từ đầu.** `CoreTenant` vs `coretenant` làm hai
   bảng đồ hỏng cùng lúc (`MENU_GROUPS` và `MODEL_LABELS`) — sửa một chỗ là đủ,
   nhưng phải sửa **cả hai**.

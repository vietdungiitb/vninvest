# TEST REPORT — Django admin UI/UX (`adminui-w15`)

**Ngày:** 2026-10-10 · **Branch:** `feat/django-admin-uiux-pm` · **Base:** `2ea2948b8`
**Môi trường:** Windows · Python 3.13 · Django **5.2.15** · Postgres **16** (`127.0.0.1:5433`)
**DB riêng:** `adminui_verify` (đã `DROP` sau khi chạy)

> Quy tắc bất di bất dịch: **Pass** = đã chạy và thành công · **Fail** = đã chạy và lỗi ·
> **CHƯA CHẠY** = chưa chạy được, kèm lý do. `CHƯA CHẠY` **là kết quả hợp lệ**, không
> phải "chắc là được".

---

## 1. Bảng gate

| # | Gate | Lệnh (chính xác như đã chạy) | Kết quả |
|---|---|---|---|
| G1 | Django system check | `cd packages/core/backend` · `$env:DJANGO_DEBUG=1` · `.venv\Scripts\python.exe manage.py check` | **Pass** (exit 0, 0 issue) |
| G2 | Không sinh migration | `… manage.py makemigrations --check --dry-run` | **Pass** (exit 0, `No changes detected`) |
| G3 | Thu thập static | `… manage.py collectstatic --noinput` | **Pass** (exit 0, 168 file; manifest có `admin/css/vnadmin.css` + `admin/js/vnadmin-nav.js`) |
| G4 | Gate admin UX | `… scripts\check_admin_ux.py` | **Pass** (exit 0, 0 lỗi chặn, **49** cảnh báo) |
| G5 | Gate admin UX — self-test | `… scripts\check_admin_ux.py --self-test` | **Pass** (exit 0, **12/12**) |
| G6 | **Gate admin UX — phá vòng thật** | đổi `--vn-bg: #0f1117` → `#ffffff` **và** bỏ `<time>` của `transition:` | **Fail (đúng kỳ vọng)** — exit **1**, 2 lỗi chặn nêu đích danh. Khôi phục → exit 0 |
| G7 | Test lớp admin | `… manage.py test tests.test_admin_ui` | **Pass** (exit 0, **45/45**) |
| G8 | **Test admin — fail-before** | 5 phép phá thật (bảng §3) | **Pass** — **5/5** test bắt được lỗi |
| G9 | **BE suite toàn bộ** | `… .venv\Scripts\python.exe run_tests.py` | **Pass so với baseline** — `Ran 2946 tests in 2136.374s`, `FAILED (failures=12, errors=15, skipped=6)`; **chứng minh 27/27 là lỗi có sẵn ở `2ea2948b8`** (§4) |
| G10 | Pre-push gate | `node scripts/pre-push-gate.mjs` | **Pass** (exit 0, **19 PASS / 0 SKIP / 0 FAIL**) |
| G11 | FE typecheck | `node scripts/pre-push-gate.mjs` (chạy `tsc --noEmit`) | **Pass** (0 lỗi) |
| G12 | FE lint | `cd packages/web` · `npm run lint` | **Pass** (exit 0, **0 error** / 3781 warning) |
| G13 | FE build | `npm run build` | **Pass** (exit 0, `✓ built in 29.44s`) |
| G14 | FE test | `npm run test:components` | **Pass** (exit 0, **127 file / 914 test**) — khớp đúng baseline ghi trong `docs/CLAIMS.md` |
| G15 | Multi-agent gate | `node packages/web/scripts/check-multi-agent.mjs` | **Pass** (qua pre-push gate) |
| G16 | Lessons gate | `node scripts/check-lessons.mjs` | **Pass** (9 file, 37/40 lesson) |
| G17 | Secret scan | qua pre-push gate | **Pass** (3800 file tracked, 0 phát hiện) |
| G18 | Ruff | `.venv\Scripts\python.exe -m ruff check src` | **CHƯA CHẠY** — `No module named ruff`. Không cài (non-goal N3: `AGENTS.md` cấm `pip install` khi chưa hỏi). Gate này **đỏ sẵn**, nên plan **không** đòi PASS (hazard 6) |
| G19 | Playwright / E2E | — | **CHƯA CHẠY** — không có runner trong repo |
| G20 | Kiểm tra bằng trình duyệt (axe, focus ring trên nền tối, vùng chạm 24px, ảnh chụp sáng/tối) | — | **CHƯA CHẠY** — mọi kết luận giao diện đến từ **HTML render**, không phải từ ảnh |

**Tổng: 20 dòng · 17 Pass · 1 Fail-có-chủ-đích (negative test) · 0 Fail thật · 3 CHƯA CHẠY (có lý do).**

---

## 2. Chi tiết G9 — BE suite và phân tích hồi quy

### 2.1 Kết quả chạy

```
Ran 2946 tests in 2136.374s
FAILED (failures=12, errors=15, skipped=6)
```

Môi trường: `CORE_DATABASE_URL=postgresql://vninvest:***@127.0.0.1:5433/adminui_verify`,
`DJANGO_DEBUG=1`, `DJANGO_TESTING=true`, `PYTHONIOENCODING=utf-8`.

> ⚠ **Baseline cũ trong `AGENTS.md` không dùng được**: ghi `602 test — failures=10, errors=3`.
> Đó là một tập con, không phải `run_tests.py`. Ở đây dùng **đúng lệnh sẽ chạy**
> để lấy baseline, không so với con số từ ngữ cảnh khác.

### 2.2 Chứng minh 27 lỗi **không** do thay đổi này

Không đoán, không gán đổ lỗi. Tạo worktree tại **base `2ea2948b8`**, chạy **cùng
bộ test**, so từng tên:

```powershell
git worktree add ..\wt-base 2ea2948b8c3484a9ae1358b93499b12d29a8417d
cd ..\wt-base\packages\core\backend
# DB riêng cho base: basecmp
.venv\Scripts\python.exe manage.py test --noinput `
  user_workspace.tests.test_seed_verification `
  user_workspace.tests.test_ledger_migration_backfill `
  user_workspace.tests.test_review_findings_wave2 `
  vninvest_core.tests.test_user_workspace_tenant_isolation
```

| | Base `2ea2948b8` | HEAD (branch này) |
|---|---|---|
| `failures` | **12** | **12** |
| `errors` | **14** | **15** |
| Tổng trong 4 module | **26** | **26** (trong 27) |
| Tên test lỗi | **giống hệt**, từng cái | |

Lỗi thứ 27 là `test_secret_store (unittest.loader._FailedTest.test_secret_store)`.
Kiểm riêng trên **cả hai** commit:

```
BASE: ModuleNotFoundError: No module named 'tests.test_secret_store'   → errors=1
HEAD: ModuleNotFoundError: No module named 'tests.test_secret_store'   → errors=1
```

⇒ **27/27 lỗi có sẵn từ trước. Hồi quy do wave 15: 0.**

Danh sách 27 lỗi (đều ngoài phạm vi admin):
`user_workspace.tests.test_seed_verification` · `user_workspace.tests.test_ledger_migration_backfill` ·
`user_workspace.tests.test_review_findings_wave2` ·
`vninvest_core.tests.test_user_workspace_tenant_isolation` · `tests.test_secret_store`.

### 2.3 Phát hiện phụ (ngoài phạm vi, đã ghi để Owner xử lý)

`test_secret_store` là **nhãn test không tồn tại**, không phải test hỏng. Điều tra:
`run_tests.py` **không** sinh nhãn này (`src_labels()` cho ra `user_workspace.tests.test_secret_store`),
và `backend/tests/` **không** có file `test_secret_store.py`. Nguyên nhân chưa xác định —
**không đoán**. Cùng lỗi, cùng nguyên nhân trên cả base lẫn HEAD.

---

## 3. Fail-before / pass-after (G8)

Không dùng `git checkout --` (hazard 11 — nó phục hồi về `HEAD` và xoá cả phần đang
làm chưa commit; lịch sử repo này đã bị nó phá 2 lần). Mọi phép phá: copy file ra
`%TEMP%` → sửa → chạy → khôi phục bằng bản sao.

| # | Phép phá | Test phải FAIL | Kết quả thật |
|---|---|---|---|
| 1 | Bỏ `VNAdminMixin` khỏi `SubscriptionAdmin` | `test_S3_AC6_every_own_admin_has_empty_value_display` | **FAIL** — `['Subscription']` |
| 2 | Bỏ `date_hierarchy` khỏi `CoreServiceAccountAdmin` | `test_S3_AC2_every_own_admin_has_time_filter_or_hierarchy` | **FAIL** — `['CoreServiceAccount']` |
| 3 | Đổi tên block `object-tools` → `object_tools_removed` trong `base.html` | `test_S1_AC2_keeps_all_28_django_blocks` | **FAIL** |
| 4 | `transition: background-color var(--vn-dur-fast) var(--vn-ease)` → `transition: background-color` | `test_LF05_every_transition_keeps_duration` | **FAIL** — `['background-color']` |
| 5 | `_can_view()` trả `True` vô điều kiện | `test_kpi_links_only_for_permitted_models` | **FAIL** — `/admin/identity_access/coretenant/` lọt vào HTML |

**5/5.** Sau khi khôi phục: `git diff --numstat` khớp **đúng** số dòng trước khi phá
(`identity_access/admin.py` 60/14 · `commercial/admin.py` 48/7) và `45/45` xanh.

Ngoài ra **4 test đã FAIL trong chính lần chạy đầu tiên** trước khi sửa
(`money_vi` ký hiệu sai vị trí · `percent_vi` mất dấu âm · `label_for` tra trượt ·
manifest thiếu file tĩnh) — bằng chứng thu được miễn phí từ quá trình.

---

## 4. Số liệu đo được (kèm lệnh)

| Số liệu | Giá trị | Lệnh đo |
|---|---|---|
| Model đăng ký trong admin | **65** | `len(admin.site._registry)` |
| Nhóm menu | **9** | render `/admin/`, đếm `vn-group__title` |
| Model rơi vào nhóm dự phòng | **0** | `check_admin_ux.py` — cảnh báo chỉ còn `django_celery_beat`/`auth` ngoài danh sách |
| Truy vấn `/admin/` | **10** | `reset_queries()` + `len(connection.queries)` |
| Truy vấn changelist | **8–9** | như trên, 4 trang khác nhau |
| `has_perm` — Django `get_app_list` | **194** | bọc `User.has_perm`, đếm |
| `has_perm` — `build_groups` (của ta) | **130** | như trên (−33%) |
| Truy vấn DB cho cả hai | **0 / 0** | `len(connection.queries)` với superuser mới |
| Tỷ lệ tương phản thấp nhất (badge) | **7,85 : 1** | script tính WCAG, ngưỡng AA = 4,5 |
| Tỷ lệ tương phản chữ chính / nền chính | **15,69 : 1** | D08 §12.1 yêu cầu ≥ 12 |
| Test | **45** | `manage.py test tests.test_admin_ui` |

---

## 5. Xác minh bảo mật (đo bằng HTTP thật, không suy luận)

Staff chỉ có **một** quyền: `identity_access.view_dailyprice`.

| Kiểm | Kết quả mong đợi | Kết quả thật |
|---|---|---|
| `/admin/support/supportticket/` (không có quyền) | 403 | **403** |
| `/admin/market_data/dailyprice/` (có quyền) | 200 | **200** |
| POST `/admin/ops_audit/auditevent/add/` | 403 | **403** |
| POST `/admin/ops_audit/auditevent/1/change/` | 403 | **403** |
| POST `/admin/ops_audit/auditevent/1/delete/` | 403 | **403** |
| POST `/admin/tenant_lifecycle/tenantlifecycleevent/add/` | 403 | **403** |
| Menu có mục không được cấp quyền? | không | **không** |
| **Thẻ KPI có link tới bảng không được cấp quyền?** | không | **SAI trước khi sửa** → nay **không** (FEP-F) |

---

## 6. Cảnh báo được Owner chấp nhận

| Mã | Nội dung | Lý do chấp nhận |
|---|---|---|
| **m1** | Vùng chạm 24px mới **khai báo**, chưa đo bằng trình duyệt | Cần Playwright/axe; đã ghi trong `AUDIT` §2 và bàn giao |
| **m2** | Chưa có `assertNumQueries`; hiện mới **đo** 8–10 truy vấn/mọi trang | Thiếu bảng dữ liệu lớn để viết ngưỡng có ý nghĩa |
| **m3** | **49** model chưa có admin | Phần lớn là bảng nội bộ nhạy cảm (`PasswordResetToken`, `UserDNECredential`, `IdempotencyRecord`). **Mở quyền sửa là quyết định của Owner**, không tự làm |
| **O1** | `nginx.conf:140` nuốt admin của app `advertising` | Đụng route SPA đang chạy; tách PR, cần Owner duyệt |
| **O3** | `entrypoint.sh:21` `collectstatic … \|\| true` | Hạ tầng triển khai; thất bại bị bỏ qua âm thầm |

Người chấp nhận: **coordinator của wave 15** (`adminui-w15`). Rủi ro còn lại đã ghi
ở `docs/AUDIT_DJANGO_ADMIN_UIUX_20261010.md` §7.

---

## 7. Việc còn `CHƯA CHẠY` — bắt buộc chạy lại sau khi rebase

| # | Việc | Vì sao chưa chạy |
|---|---|---|
| 1 | **Toàn bộ gate §1 sau khi rebase lên `dev`** | L-G01/L-G03: kết quả trước rebase **không** đại diện cho sau rebase |
| 2 | Ruff | Không cài trong `.venv` (non-goal N3) |
| 3 | Playwright / E2E | Không có runner trong repo |
| 4 | Kiểm tra bằng trình duyệt: focus ring nền tối, vùng chạm 24px, ảnh chụp sáng/tối | Cần môi trường trình duyệt |
| 5 | Smoke test sau khi sửa O1 (`nginx.conf`) | Chưa sửa O1 |

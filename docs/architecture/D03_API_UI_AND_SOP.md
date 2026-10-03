# D03 (AS-IS) — Quy ước API, Kiến trúc UI/UX & SOP cho Coder

> **Bản AS-IS.** Đọc `docs/architecture/README.md` §0 trước.
> Đo tại `0ee1b8b4b`, 2026-10-03.

---

# PHẦN 5 — API & GIAO DIỆN

## 5.1 Quy ước thiết kế API

### 5.1.1 Có **hai** họ API, không thống nhất

| Họ | Tiền tố | Số route | Dùng cho | Bằng chứng |
|---|---|---|---|---|
| Chuẩn | `/core/v1/…` | **609** | Toàn bộ API sản phẩm | `vninvest_core/urls.py:39-60` |
| SOC (không version) | `/api/soc/…` | 135 | Console vận hành | `vninvest_core/urls.py:66` |
| Tương thích (không version) | `/api/auth/…` | 15 | Auth cũ | `vninvest_core/urls.py:68` |

> **Sự thật phải biết trước khi viết tài liệu hay code:** frontend **không** gọi
> `/api/soc/`. `packages/web/src/adapters/core/soc.js` dùng
> `/core/v1/**operator**/soc/…`. Còn `/api/soc/*` là bản sao không có consumer
> trong web. Chi tiết ở `D01` Q-04.

**Có phiên bản không?** Có `/core/v1/`. Có `/api/v1/` không? Có — nhưng chỉ
`advertising` dùng, và nó là hệ số khác hẳn (`advertising/api_urls.py:5-7`).
**158 route `/api/*` không có version** ⇒ khoảng 21% bề mặt API không được version.

### 5.1.2 Định danh & phương thức

| Quy ước | Hiện thực |
|---|---|
| Danh tài nguyên | `/core/v1/partner/pats/{pat_id}/usage/` — số nhiều, danh từ |
| Phương thức | REST đầy đủ: GET / POST / PUT / PATCH / DELETE |
| Xoá | **204 No Content**, không body (`identity_access/views_tenant.py:743`) |
| Phân trang | Cursor (`CoreCursorPagination`) hoặc khoá `tenant`,`meter_code` trong path |
| Cặp có & không có dấu `/` | 53 tên đường có **cả** `x/` và `x` — cố ý, regex khác nhau |

### 5.1.3 Mã trạng thái

| Mã | Dùng cho |
|---|---|
| 200 | Thành công, có body |
| 201 | Tạo mới (`partner_issue_pat`, `register_tenant_view`, `register_view`) |
| **204** | Xoá — **không body**. Endpoint 204 không được ghi `content` trong schema |
| 400 | Sai dữ liệu / thiếu trường |
| 401 | Chưa xác thực hoặc credential hỏng |
| 403 | Không đủ quyền, tenant bị suspend, `pat_tenant_mismatch` |
| 404 | Không tìm thấy |
| 409 | Xung đột (`ConflictErrorException`) |
| 429 | Vượt rate limit |
| 5xx | Lỗi hệ thống (`InternalErrorException`) |

## 5.2 Định dạng Request / Response

### 5.2.1 Success — hai hợp đồng cùng tồn tại

Hợp đồng `{data, meta}` là **chuẩn mới** (B5), nhưng **chưa áp dụng hết**:

| Nhóm | Hợp đồng | Số điểm |
|---|---|---|
| Đã bọc `{data, meta}` | `user_workspace`, `service_ops`, `identity_access`, `market_data`, `advisory`, `signal_intelligence`, `ops_audit` | 445 |
| **Phẳng** | `commercial` (16), `advertising` (9), `data_ingest` (3), `ai_analytics` (2), `ai_agents` (1) | 31 |
| F3 `{status, timestamp, request_id, data}` | `success_response()` — `identity_access/views/helpers.py:327-338` | 6 |
| F4 `{object, …}` | ví dụ `personal_keys_rotate`, `partner_revoke_pat` | 4 |
| F5 `{data, +siblings}` | `partner_api_timeline` | 2 |
| Hợp đồng riêng | `market_serving` `contract_version` `2.0` — **cố ý miễn trừ** | — |

> **Nguyên tắc khi viết endpoint mới:** thêm mô tả OpenAPI bằng
> `envelope_response(<serializer>)` cho success **nếu** view đã bọc; nếu view trả
> phẳng thì mô tả đúng hình dạng phẳng — **đừng bọc schema cho khớp**. Gate
> `scripts/check-envelope-contract.py` sẽ báo `UNWRAPPED` nếu bạn để lọt.

**Cấu trúc envelope:**

```json
{
  "data": { "…payload thật…" },
  "meta": { }
}
```

`meta` chỉ mang **provenance đã có sẵn** (`as_of`, `stale`, `calculation_version`,
`source`). Không có thì để `{}` — **không** bịa giá trị đo được lúc gọi.

### 5.2.2 Error — RFC 9457, **không** bao giờ bọc envelope

```json
{
  "type": "https://…/problems/validation_error",
  "title": "Validation Error",
  "status": 400,
  "detail": "Tên đăng nhập và mật khẩu không được để trống.",
  "code": "validation_error",
  "request_id": "req_ab12cd34ef567890",
  "timestamp": "2026-10-02T12:34:56.789012+00:00",
  "errors": ["…"]
}
```

- Content-Type: `application/problem+json` — `exceptions.py:47,229,251`
- Header `X-Request-ID` — `exceptions.py:208,230`
- Handler: `core_api_exception_handler` — `exceptions.py:606-711`
- Lỗi tầng Django (trước view) cũng theo chuẩn này — `exceptions.py:211-231`

### 5.2.3 Kiểm tra bằng máy trước khi giao

```powershell
cd packages/core/backend
python manage.py spectacular --file $env:TEMP\api.yml   # schema phải sinh được
python manage.py test --noinput vninvest_core.tests.test_api_envelope_schema
python scripts/check-envelope-contract.py <app>          # UNWRAPPED phải = 0
```

## 5.3 Kiến trúc UI/UX

### 5.3.1 Điều hướng

Router: `react-router-dom` 6, khai báo khai báo dạng `<Routes>` —
`src/main.tsx:123-126`. **64 khai báo route** trong `main.tsx`.

| Nhóm | Tiền tố | Số | Bảo vệ |
|---|---|---|---|
| Auth công khai | `/login`, `/register`, `/verify-email`, `/reset-password` | 4 | — |
| Người dùng | `/` + 20 route con | 21 | `ProtectedRoute` (`main.tsx:62`) |
| Tenant | `/tenant/*` | 3 | `TenantRoute` — cần `userTenants.length > 0` |
| Nhân viên | `/admin/*`, `/operations-center*` | 18 | `StaffRoute` — cần `isStaff \|\| isSuperuser` |

**Ba vấn đề điều hướng đã kiểm chứng:**

| ID | Mức | Bằng chứng | Vấn đề |
|---|---|---|---|
| **R-1** | **HIGH** | 7 file `Shell*Page` tồn tại: `ShellDashboardPage.tsx`, `ShellWatchlistPage.tsx`, `ShellTransactionsPage.tsx`, `ShellPortfoliosPage.tsx`, `ShellSettingsPage.tsx`, `ShellSupportPage.tsx`, `ShellAiCommandCenterPage.tsx` | `main.tsx:24-30` remap 7 route id sang bản `core-*`, khiến **7 component `Shell*` không tới được nơi nào** nhưng vẫn còn trong cây nguồn và được export. ≈4.500 dòng code chết |
| **R-2** | HIGH | `main.tsx:126` (64 route) vs `src/app/routeCatalog.js:5` (57 mục) | **Hai bảng route phải đồng bộ tay**, chỉ có gate so bằng regex. 5 route thật không có trong catalog; 16 mục mang cờ `externalEntry` để lách gate |
| **R-3** | MED | `docker/nginx.conf:148` có `location ^~ /admin/` trỏ về Django admin | `/admin/*` được phục vụ bởi React ở 14 tiền tố khai trước, còn phần còn lại rơi về Django admin. Thêm prefix admin mới mà quên khai nginx ⇒ 404/302 |

### 5.3.2 Cây thành phần & State

| Lớp | Thành phần | Số import |
|---|---|---|
| Vỏ ứng dụng | `ShellPageTemplate.js` (`ShellPanel`, `ShellMetric`, `ShellField`…) | 29 |
| Hộp thoại | `ConfirmModal.tsx` | 28 |
| Thông báo | `ShellToast.tsx` | 23 |
| Rỗng | `ShellEmptyState.tsx` | 15 |
| Nút / biểu mẫu | `src/components/ui/` — bộ **shadcn-style** 30 file | — |

**State:** React Context là chính, **không** có Redux/Zustand/Jotai/SWR (0 import).

| Provider | Sở hữu state | Vị trí |
|---|---|---|
| `PortfolioContext.js` (722 dòng) | 18 `useState`: token, user, tenant, quyền, plan | `src/context/PortfolioContext.js:104-123` |
| `LangContext.js` | `locale` | `src/context/LangContext.js:32` |
| `RealtimeContext.js` | `subscriptions` | `src/context/RealtimeContext.js:20` |
| `QueryProvider.tsx` | react-query: `staleTime` 30 s, `gcTime` 300 s | `src/providers/QueryProvider.tsx:6` |

> **Hai phát hiện đã kiểm chứng ở tầng state:**
>
> **S-1 (HIGH)** — `ShellAuthProvider` (`src/context/authReact.js:34`) **không
> bao giờ được mount**. Chỉ xuất hiện ở 4 chỗ: định nghĩa `authReact.js:34`, hai
> dòng throw, và export trong `packages/web/src/index.js:55`. `main.tsx` **không** nhắc tới.
> ⇒ một hệ thống auth thứ hai được đóng gói và xuất ra, không ai dùng.
>
> **S-2 (HIGH)** — Có **3 HTTP client**, chỉ **1** chỗ gắn token:
> | Client | Gắn `Authorization`? |
> |---|---|
> | `adapters/core/transport.js:386-410` | **Có** — điểm gắn duy nhất |
> | `adapters/core/coreAdapter.js` | **KHÔNG** — không có cả `Authorization` lẫn `X-Tenant-ID` |
> | `pages/admin/socCsv.ts:16` | Tự chép lại header |
>
> Hệ quả: refresh token trước thời hạn, retry 401, đọc header rate-limit đều chỉ
> có ở client #1. Sửa luật xác thực mà quên client #2 ⇒ **request không có token**.

### 5.3.3 Design tokens — **bốn** nguồn, đều ghi vào `:root`

| Nguồn | Dòng | Số token | Nạp qua |
|---|---|---|---|
| `src/index.css` (`@theme` Tailwind v4) | 694 | 81 | `main.tsx:14` |
| `src/theme/tokens.css` | 82 | 48 | `index.css:2` |
| `src/components/soc/soc.tokens.css` | 130 | 69 | `soc.module.css:2` |
| Module CSS riêng (9 file) | — | 189 | import trực tiếp |

**D-1 (HIGH) — 21 tên token trùng, 13 trong đó khác giá trị.**
`theme/tokens.css` và `soc.tokens.css` cùng định nghĩa 21 tên ở `:root`. 13 tên có
**giá trị khác nhau**, ví dụ:

| Token | `theme/tokens.css` | `soc.tokens.css` |
|---|---|---|
| `--fs-md` | `0.875rem` | `0.85rem` |
| `--font-sans` | `"Inter", "Segoe UI", system-ui…` | `ui-sans-system, -apple-system…` |
| `--bg-panel` | `var(--color-bg-panel, #0f172a)` | `rgba(var(--soc-rgb-081734) / 0.4)` |

**Thứ tự nạp quyết định thắng:** `index.css` nạp trước, `soc.tokens.css` nạp sau
(qua `soc.module.css` được lazy-load) ⇒ **SOC thắng**, và các giá trị trong
`theme/tokens.css` — kể cả font Inter — **chết lúc runtime**.

> **D-2 (CRITICAL) — chỉ dẫn trong `AGENTS.md` không thi hành được.**
> `AGENTS.md` yêu cầu *"SOC glassmorphism patterns, **soc.module.css** tokens"*.
> Nhưng `src/components/soc/soc.module.css` là **barrel 3 dòng / 139 byte**:
> ```css
> /* SOC Operations Center — CSS Module (re-exports tokens + components) */
> @import "./soc.tokens.css";
> @import "./soc.components.css";
> ```
> Nó có **0** token và **0** class. Token thật ở `soc.tokens.css:5-130`,
> class thật ở `soc.components.css` (3.916 dòng, 522 selector).
> Bảo thêm token vào `soc.module.css` là chỉ dẫn **không làm được**.

### 5.3.4 Đa ngữ

| Hạng mục | Giá trị |
|---|---|
| Thư viện | **Không có** — tự viết `createTranslator(locale)` (`src/i18n/index.js:31-54`) |
| Ngôn ngữ | 2 — `vi` (mặc định), `en` |
| Danh mục | `src/i18n/vi.js` 6.637 dòng · `en.js` 6.615 dòng · 89 nhóm |
| Số lần gọi `t(` | 4.011 (3.980 ở file production, 165 file) |
| Chuỗi tiếng Việt hardcode | **95** trong 33 file |

> **I-1 (HIGH)** — Gate `check:i18n-hardcoded` chỉ quét **5 đường dẫn**
> (`packages/web/package.json:33`): `src/components/advisory` (15 file) + 4 file đơn lẻ.
> Toàn bộ `src/pages/**` và phần lớn `src/components/**` **nằm ngoài phạm vi**
> — nơi chứa phần lớn 95 chuỗi hardcode.
>
> Ngoài ra `t()` trả **chính key** khi thiếu (`src/i18n/index.js:41-42`) và không
> có báo cáo key thiếu ⇒ key chết nhìn ra vẫn giống key sống.

### 5.3.5 Nợ kỹ thuật frontend (đã kiểm chứng)

| ID | Mức | Vấn đề | Bằng chứng |
|---|---|---|---|
| **D-2** | CRITICAL | `soc.module.css` rỗng, `AGENTS.md` chỉ sai | `soc.module.css:1-3` |
| **S-2** | HIGH | 2/3 HTTP client không gắn token | `coreAdapter.js` không có `Authorization` |
| **R-1** | HIGH | 7 component `Shell*` chết ≈4.500 dòng | 7 file tồn tại, `main.tsx:24-30` remap |
| **D-1** | HIGH | 13 token trùng tên khác giá trị, thứ tự nạp quyết định | `theme/tokens.css` vs `soc.tokens.css` |
| **R-2** | HIGH | 2 bảng route đồng bộ tay | `main.tsx:126` vs `routeCatalog.js:5` |
| **I-1** | HIGH | Gate i18n phủ 5/489 file | `packages/web/package.json:33` |
| **S-1** | HIGH | `ShellAuthProvider` không mount | `authReact.js:34`, không có trong `main.tsx` |
| **S-3** | HIGH | 9 `exports` trỏ tới file `.ts` không tồn tại | `packages/web/package.json:36-47` |
| R-4 | MED | Chuỗi `/core/v1` hardcode bỏ qua `resolveCoreApiBase()` | 9 dòng production trong 3 file page |
| — | MED | 18 dependency không có import nào (`axios`, 11 `d3-*`, `klinecharts`…) | `packages/web/package.json:49-54,74,77-87,90-92` |
| — | MED | File quá 800 dòng | `SocSignalsPanel.tsx` **2.454** · `WhaleBubbleChart.jsx` **1.843** |

---

# PHẦN 7 — CẨM NANG CHO CODER

## 7.1 Cấu trúc thư mục quy ước

**Backend** — `packages/core/backend/src/`:

```
<app_name>/
├── models.py            # Model + Meta (index, constraint, unique_together)
├── migrations/          # Sinh bằng makemigrations — KHÔNG tự đặt số
├── serializers.py       # Request/Response serializer
├── views*.py            # Handler (ClassView hoặc @api_view)
├── urls.py              # path() của app, KHÔNG gắn prefix
├── tasks.py             # Task Celery
├── schema.py            # Chỉ serializer MÔ TẢ OpenAPI (read-only)
├── envelope.py          # Bọc success 2xx thành {data, meta}
└── tests/               # test của app

vninvest_core/           # HẠ TẦNG DÙNG CHUNG — không được thêm nghiệp vụ vào đây
├── exceptions.py        # RFC 9457
├── api_envelope.py      # envelope_response() cho schema
├── settings.py
└── checks.py            # Django system check
```

**Quy tắc cứng:**
- `vninvest_core/` chỉ chứa hạ tầng. Logic nghiệp vụ đặt sai chỗ là lỗi kiến trúc.
- `schema.py` **không** được import vào tầng nghiệp vụ — nó chỉ phục vụ `@extend_schema`.
- App mới phải khai trong `INSTALLED_APPS` và có `migrations/`.

**Frontend** — `packages/web/src/`:

```
adapters/core/       # HTTP client DUY NHẤT (transport.js) — không gọi fetch trực tiếp
adapters/*.ts        # domain client, export qua coreApiAdapter
context/             # React Context provider
components/          # component dùng chung; ui/ là bộ shadcn-style nền
pages/               # 1 trang = 1 file trong pages/
i18n/vi.js en.js     # danh mục ngôn ngữ — KHÔNG sửa tay, dùng scanner
theme/tokens.css     # token chung
components/soc/      # subsystem SOC — soc.tokens.css + soc.components.css
```

## 7.2 Check-list 7 bước khi thêm API/tính năng mới

> Thứ tự này **bắt buộc**: đổi thứ tự sẽ phải viết lại migration hoặc vi phạm
> envelope.

| # | Bước | Làm gì | Kiểm chứng |
|---|---|---|---|
| **1** | **Migration** | `python manage.py makemigrations <app>` | `makemigrations --check --dry-run` phải ra *"No changes detected"* sau khi tạo |
| **2** | **Model** | Khai field, `db_index` cho field hay lọc/sắp xếp, `on_delete` **cố ý** chọn | Xem danh sách trường thiếu index ở `D02` §4.2 |
| **3** | **Quyền** | Chọn capability trong 21 giá trị (`D01` §2.3.3) hoặc thêm capability mới | Lời gọi `require_tenant_permission(request, '<domain>:<action>')` |
| **4** | **Domain logic** | Đặt ở service/helper của app, **không** viết thẳng trong view | Không có truy vấn DB trong hàm `serialize` |
| **5** | **View + envelope** | Trả 2xx qua `envelope(...)` nếu app đã bọc; trả phẳng nếu hợp đồng riêng | `scripts/check-envelope-contract.py <app>` → `UNWRAPPED: 0` |
| **6** | **DTO + mô tả** | Thêm `@extend_schema(responses={200: envelope_response(<Serializer>)})` | `manage.py spectacular --file $env:TEMP\api.yml` exit 0, không cảnh báo `identical names` |
| **7** | **Test** | Happy path · thiếu quyền · sai tenant · lỗi input · trường `null` | `manage.py test --noinput <app>` |

**Sau khi thêm capability mới** — bắt buộc thêm cả 3 nơi, nếu không sẽ im lặng hỏng:

1. Chuỗi trong lời gọi `require_tenant_permission(...)`.
2. `TenantCustomRole.permissions` mặc định của tenant (nếu ai đó phải tự tạo role).
3. Danh mục ngôn ngữ `packages/web/src/i18n/vi.js` + `en.js` nếu UI có nút/nhãn.

> **Lưu ý:** capability là **chuỗi rời**, không có bảng tra. Sai chính tả là **không
> được chặn** — endpoint sẽ trả 403 với mọi người. Đây là N-12/F-06 ở `D01`.

## 7.3 Definition of Done

Một tính năng chỉ **xong** khi **cả 12** mục dưới đây đúng:

| # | Mục | Lệnh kiểm |
|---|---|---|
| 1 | Migration đã tạo, không tự đặt số | `makemigrations --check --dry-run` |
| 2 | Không thêm file shared bị cấm commit | xem §2 `AGENTS.md` |
| 3 | `manage.py check` sạch | `python manage.py check` |
| 4 | Schema sinh được, **không** cảnh báo `identical names` | `manage.py spectacular --file …` |
| 5 | `UNWRAPPED: 0` | `scripts/check-envelope-contract.py <app>` |
| 6 | Ruff không có lỗi mới | `ruff check --output-format=concise <file>` |
| 7 | Test mới có **negative proof hai chiều** | sửa sai → đỏ → khôi phục byte-exact → xanh |
| 8 | Không để lọt `if tenant:` mới | grep trong file sửa |
| 9 | Mọi chuỗi UI mới qua `t()`, không hardcode | `npm run check:i18n-hardcoded` |
| 10 | Fetch mới đi qua `adapters/core/transport.js`, không `fetch()` trực tiếp | review |
| 11 | Test BE qua trên **PostgreSQL**, không SQLite | xem `D01` N-15 |
| 12 | Full suite không có regression | `python run_tests.py`, so với baseline |

**Định nghĩa "không regression"**: so **tập tên test đỏ** trước/sau, không so
tổng số. Bằng chứng ở `docs/CLAIMS.md` mục `b5-apiview`: baseline đo bằng worktree
riêng, lệch đúng 1 lỗi là do **artifact `staticfiles.json` không được git track**
chứ không phải code.

## 7.4 Bốn bẫy đã mắc thật — đọc trước khi commit

| Bẫy | Hậu quả | Cách tránh |
|---|---|---|
| **Sửa file bằng công cụ edit rồi tin là xong** | Đã có 1 lần bị đổi âm thầm `@permission_classes([permissions.AllowAny])` → `TENANT_PERMISSION_CLASSES` — **đổi logic phân quyền**. `ruff` **không** bắt được | Sau **mỗi** lần sửa: `git diff` xem toàn bộ hunk, và `ruff` |
| **`git stash` / `git checkout --`** | `git stash` từng fail `Permission denied`, đụng cây chính, 37 file conflict | Không dùng. Muốn so A/B thì `git cat-file blob HEAD:<path>` ra file tạm |
| **`git show HEAD:p \| Out-File`** | Hỏng chuỗi tiếng Việt (console cp1252) ⇒ fail giả | Copy bằng byte: `shutil.copy2` hoặc `subprocess` + `bytes` |
| **Chạy `manage.py test` trần** | Bỏ sót ~2.100 test trong `src/` | Full suite phải `python run_tests.py` |

Ngoài ra: **chọn sai interpreter là sinh lỗi giả.** Ba interpreter trên máy
không giống nhau:

| Interpreter | Django | Có khớp container (5.2.17)? |
|---|---|---|
| `vninvest\.venv` | 5.2.14 | ✅ gần nhất |
| `…\WindowsApps\python.exe` | **6.0.6** | ❌ **khác major** |
| Container `vninvest-dev-core-api` | **5.2.17** | chính là nó |

⚠ **Rủi ro thật:** baseline chạy trên `WindowsApps` (6.0.6) là **khác major với
production**. Test xanh trên 6.0.6 **không** bảo chứng xanh trên 5.2.17. Khi
đối chiếu regression, dùng interpreter `>=5.2,<6.0`.

Còn `django.utils.timezone.UTC` thì **chỉ có** ở Django 6.0 — test dùng nó sẽ đỏ
trên 5.2. Dùng `datetime.UTC` (Python ≥ 3.11) thay cho cả hai phía.

## 7.5 Trước khi bắt đầu viết code — đọc gì

1. `docs/architecture/README.md` §0 — xác nhận đang đọc bộ AS-IS hay TO-BE.
2. `D01` §2.1 (FBD) tìm app của mình · §2.3 (RBAC) xem capability · §6.3 xem P0/P1 đang mở.
3. `D02` §4.1 (ERD) xem bảng liên quan · §4.3.4 hỏi: *tính năng này có cần đọc dữ liệu vừa ghi ngay trong request không?*
4. `D03` §5.2 — hợp đồng response · §7.2 — check-list 7 bước.

---

## CHƯA CHÁY (tài liệu này)

| Hạng mục | Trạng thái |
|---|---|
| FE lint / `tsc` / vitest | **CHƯA CHẠY** — doc-only, không sửa code |
| Xác minh `ShellEmptyState` nào thắng lúc runtime | **CHƯA XÁC MINH** — hai bản cùng tên (`ShellPageTemplate.js:164` và `ShellEmptyState.tsx:4`) |
| `layout.nav.*` có trong danh mục i18n không | **CHƯA XÁC MINH** — `routeCatalog.js` dùng, không thấy trong 89 nhóm |
| Số request hardcode `/core/v1` | Đã đếm 88 dòng trong `src` nhưng phần lớn là **test và comment**; con số production thật **CHƯA tách riêng** |
| Thuật toán ký webhook + retry | **CHƯA XÁC MINH** — xem `D02` §3.3 |

---

*Hết Lượt 3. Bộ tài liệu AS-IS hoàn tất 3/3 file. Xem `README.md` §0.2.*

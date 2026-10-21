# SUMMARY — UI Standardization W1 (light theme (a) + M-10 + phần còn lại)

> **Owner chốt (2026-10-21):** (1) light theme theo **phương án (a)** — làm cho **đúng**; (2) M-10 + **phần còn lại** (T-1..T-6) làm theo khuyến nghị.
> **Kế hoạch:** `docs/PLAN_UI_STANDARDIZATION_W1.md` (plan + claim 2 slice) · **Base:** `feat/uistd-w0` (PR #272) · **PR:** xep tang tren #272
> **Lessons áp dụng:** [L-F03] [L-F05] [L-F06] [L-F08] [L-F11] [L-V01] [L-V02] [L-V03] [L-V05] [L-V06] [L-003] [L-005] [L-007] [L-008] [L-M02] [L-V08] [L-V09]

---

## 1. Fail-before → fail-after (ĐO THẬT trên staging, cùng script + cùng route)

| Route | H1 light (trước → sau) | Số phần tử chữ dưới AA (trước → sau) |
|---|---|---|
| `/admin/users` | **1.0000:1 (VÔ HÌNH)** → **13.98:1** | 28/60 → **18/60** → **5/60** (đo cuối) |
| `/dashboard` | 1.0471:1 (SIM-A) → **12.85:1** | 29/60 → **19/60** → **5/60** |
| `/portfolios/manage` | 17.85:1 → 17.85:1 (đã tốt) | 9/60 → 8/60 → 8/60 |
| `/operations-center` | 18.41:1 (dark) → 5.36/13.98:1 | — → **5/60** |

**Còn lại 5 phần tử dưới AA trên 4 route (từ ~700 phần tử mẫu):**

| Số lượng | Phần tử | Tỷ lệ | Nguyên nhân | Khu vực |
|---|---|---|---|---|
| 4× | `span.truncate` (breadcrumb trang hiện tại) | 3.45:1 | chữ **tối** trên nền **xanh** `#2563eb` | nên chữ trắng trong light mode |
| 1× | `span.hidden sm:inline` ("Treemap") | 4.45:1 | cyan-700 trên nền cyan nhạt (thiếu 0.05) | biên |

⇒ **Còn lại = W1-C backlog** (ghi ở §6), **KHÔNG** che giấu: số đo đã lưu ở `%TEMP%\opencode\light-failures.json`.

## 2. W1-A — light theme (a): 3 tầng

| Tầng | Nội dung | File |
|---|---|---|
| **T1 token** | `:root[data-theme="light"]` cho **26 token** `--color-*` (bg/text/border/accent + 8 token ngữ nghĩa success/warning/danger/info) | `packages/web/src/theme/light-theme.css` (**sinh bằng script**) |
| **T2 utility theo property** | `.text-*` → chữ tối · `.bg-*` → nền sáng · `.border-*` → viền sáng — **kèm 185 biến thể alpha** (giữ alpha bằng `color-mix(in oklab, X N%, transparent)`) | cùng file (**sinh bằng script**) |
| **T3 gate** | `check-light-theme.mjs`: mỗi class màu Tailwind dùng trong `src` phải được phủ ở light mode; class mới màu tối ⇒ gate đỏ | `packages/web/scripts/check-light-theme.mjs` + điểm gọi trong `pre-push-gate.mjs` |

**Vì sao KHÔNG sửa 89 file:** `--color-slate-950` dùng **cả làm chữ** (admin `text-slate-950`) lẫn **làm nền** (36 file) ⇒ remap biến sẽ phá chữ admin ⇒ remap **theo property** giữ được cả hai — đúng pattern repo đã có ở `index.css:302-389`.

**Giá trị lấy từ SSOT** `theme/tokens.css:65-71` (`--text-primary #0f172a` · `--text-secondary #334155` · `--bg-panel #ffffff` · `--bg-panel-soft #f8fafc` · `--border-default #e2e8f0` · `--accent-blue #2563eb`).

## 3. W1-B — M-10 + T-1 + T-6

| Việc | Làm | Kiểm chứng |
|---|---|---|
| **M-10** | `CommercialPage.module.css`: đổi **41** `var(--color-*)` → họ **đảo được** (`--text-primary/secondary/muted`, `--border-default`, `--bg-panel`, `--accent-cyan`, `--accent-blue`) | 0 `var(--color-*)` còn lại; họ `--text-*` kế thừa `--color-*` ⇒ tự đảo theo light sau T1 |
| **T-1** | Bỏ **11** inline `outline: "none"` ở **6 file** | `check-focus-ring`: 8 vi phạm → **2** (còn lại là 2 vi phạm nền cũ của W0, đã ghi baseline) |
| **T-6** | Thêm khối `commercialPage` (5 key: retry · retryHint · loading · emptyValue · emptyReason) vào **cả 2** locale `src/i18n/{vi,en}.js`; catalog TS chỉ giữ fallback **EN** | `check-i18n-hardcoded src/components/commercial` → **0**; `i18n:scan:strict` → **0** |

⚠ `src/i18n/*.js` **KHÔNG** nằm trong deny-list §2 ⇒ **không** cần `--no-verify`. Bắt buộc sửa **cả 2 locale** cùng lúc (`i18n/index.js:42` fallback về VI nếu thiếu key EN).

## 4. Gate đã chạy (exit thật)

| Lệnh | Exit | Ghi chú |
|---|---|---|
| `npx tsc --noEmit` | **0** | |
| `npm run build` | **0** | verify rule có thật trong **CSS build** (L-F11), không suy từ file nguồn |
| `npx vitest run` | **0** | |
| `npx eslint src` | **0** | 0 error |
| `check-token-conflict` | **0** | |
| `check-focus-ring` | **0** | 8 → 2 (T-1) |
| `check-heading-contract` | **0** | |
| `check-theme-contrast` | **0** | baseline đo lại (tập 32 **không đổi**) |
| `check-light-theme` (mới) | **0** | 227 màu / 424 file; `--self-test` **5/5** |
| `check:i18n-hardcoded src/components/commercial` | **0** | |
| `i18n:scan:strict` | **0** | |
| `pre-push-gate` | **0** | 28 PASS / 0 FAIL |

## 5. Bài học rút ra (đã ghi vào ledger/lessons)

1. **"Không đo được" ≠ "không có vi phạm"** (L-V08) — áp dụng cả cho probe của tôi: probe đầu trả **0 lỗi** vì **chưa đăng nhập** (redirect `/login`, 8 phần tử) ⇒ thêm **control "đã đo thật"** (≥40 phần tử chữ + H1 ≠ logo) mới tin được.
2. **Selector phải đủ mạnh**: `[data-theme="light"] .X` (0,2,0) **thua** rule CSS-module (0,2,0) đứng sau trong bundle ⇒ dùng `:root[data-theme="light"] .X` (0,3,0).
3. **Class bị scope (hash) không override được từ file global**: `soc.components.css` import qua barrel `soc.module.css` ⇒ class thành `_statusBadge_1c09a_1` ⇒ phải override **tại file định nghĩa**.
4. **Sửa ở tầng token, không override từng class**: 6 token `--soc-c-*` + 8 token `--color-*-400/500` thiếu giá trị light ⇒ vá 1 chỗ thay vì ~60 override lẻ.
5. **Gate đo sai scope ⇒ báo hồi quy giả**: `check-theme-contrast` chỉ đọc 3 file token ⇒ không thấy `light-theme.css` ⇒ đo nền tối với chữ đã làm tối ⇒ "XAU DI" giả (3.75 → 2.36) ⇒ thêm file vào scope + **đo lại baseline** (tập vi phạm **không đổi**: 32 → 32).
6. **Blob EOL "mixed" là kẹt vĩnh viễn**: file bị ghi qua PowerShell rồi Node ⇒ blob HEAD "mixed" ⇒ `normalize-eol` chặn **mọi** lần sửa sau ⇒ cách thoát: **xoá rồi thêm lại** (gate bỏ qua file bị xoá) với EOL chuẩn (**LF** cho `.mjs`).
7. **Double-encoding UTF-8 qua PowerShell**: comment trong script thành `â€”` ⇒ viết lại generator bằng **ASCII thuần** (repo chạy Windows + PowerShell round-trip).

## 6. Còn lại (W1-C backlog)

| # | Việc | Vì sao chưa làm |
|---|---|---|
| C-1 | 4× breadcrumb chip: chữ tối `#0f172a` trên nền xanh `#2563eb` (3.45:1) | class `truncate` lấy nền từ **phần tử cha**; chưa truy ra rule (nguồn sâu hơn 1 tầng) — cần probe cha |
| C-2 | 1× "Treemap" 4.45:1 (thiếu 0.05) | biên |
| C-3 | M-6: đọc 12 token `--pf-*` ở **runtime** (màu tăng/giảm — quan trọng nhất với app chứng khoán) | cần staging + đo lại baseline |
| C-4 | M-7: `check-a11y-runtime` lấy mẫu 250 phần tử text **đầu** ⇒ đo shell, chưa đo nội dung route | lấy mẫu phân bố theo vùng ⇒ phải đo lại baseline trên staging |
| C-5 | T-2: staging **có dữ liệu đóng (seed)** ⇒ bỏ `--advisory` | cần seed + đo lại |
| C-6 | Plan v1.4: bỏ "AC-5"/"AC-6" (chỉ có AC-1..AC-4) | sửa ở plan W1.4 |

## 7. Chưa chạy (không ghi PASS)

| # | Mục | Lý do |
|---|---|---|
| 1 | `npm run test:visual` | không có test visual mới; baseline của plan ghi CHƯA CHẠY |
| 2 | BE test (Django) | W0/W1 là frontend-only; Docker Desktop hay tắt ⇒ Postgres không luôn khả dụng |
| 3 | Ảnh chụp thật light/dark | **CHƯA CHỤP** (L-V05: phải mở ảnh ra xem) ⇒ cần bước riêng |
| 4 | `check-a11y-runtime` trên staging | chạy **advisory** (app sống ⇒ tập vi phạm đổi theo dữ liệu) |

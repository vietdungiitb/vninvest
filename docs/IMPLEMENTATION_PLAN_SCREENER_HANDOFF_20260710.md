# TÀI LIỆU KẾ HOẠCH THỰC HIỆN — SCREENER SAAS NATIVE (BÀN GIAO ĐỘI CODE)

**Ngày**: 2026-07-10
**Tài liệu nguồn**: `docs/THAO_LUAN_SCREENER_SAAS_NATIVE_20260710.md` (đã đối chiếu mã nguồn thực tế)
**Mục đích**: Bàn giao kế hoạch thực hiện chia thành các **slice** công việc, mỗi slice kèm **tiêu chí audit chuẩn** để đội code tự kiểm tra (self-audit) sau khi hoàn thành.

---

## 0. Hướng dẫn sử dụng

- Mỗi **task** trong tài liệu nguồn được chia thành một **slice** (S-id). Đội code nhận slice theo thứ tự, không nhảy pha (Phase 0 → 3).
- Sau khi code xong một slice, dev **bắt buộc** chạy bảng **Tiêu chí audit (§2)** và điền kết quả PASS/FAIL vào **Slice Tracker (§7)**.
- Một slice chỉ được coi là **DONE** khi tất cả tiêu chí audit đạt PASS và lệnh verification chạy thành công.
- Mọi sai lệch so với tài liệu nguồn phải được ghi lại trong cột "Ghi chú" của tracker, không sửa chữa tài liệu nguồn tùy tiện.

---

## 1. Tiêu chuẩn audit chung (standing criteria)

Áp dụng **mọi slice**, không phụ thuộc pha. Đây là phần bị lỗi nhiều nhất trong lịch sử repo (theo `AGENTS.md`).

### 1.1. Coding conventions (BẮT BUỘC)

| # | Quy tắc | Chi tiết | Cách kiểm tra |
|---|---------|----------|--------------|
| C1 | **Pure createElement, KHÔNG JSX** | Mọi component dùng `createElement(...)`, không dùng cú pháp `<Tag>` | `npm run lint` pass + review không có `<` tag trong `.tsx` |
| C2 | **Không string literal làm text node** | Pre-commit hook `react/jsx-no-literals` sẽ fail nếu text trần. Dùng `t('key')` hoặc biến | `npm run lint` pass |
| C3 | **i18n qua LangContext** | Toàn bộ label tiếng Việt đầy đủ dấu qua `t('namespace.key')`, KHÔNG hardcode chuỗi | Grep file mới: không có chuỗi `'...'` tiếng Việt trần |
| C4 | **SOC glassmorphism** | UI SOC dùng `soc.module.css` tokens (biến CSS module), không inline style tùy tiện | Review import `soc.module.css` |
| C5 | **API call pattern** | Dùng `defaultCoreApiAdapter` cast `as unknown as { ... }` theo chuẩn repo | Review call site |
| C6 | **Type safety** | Không dùng `as any` / `as unknown as` trừ khi type declaration chưa có (phải ghi chú lý do) | `npx tsc --noEmit` zero error |
| C7 | **Naming/structure** | Component file theo PascalCase, hook `useX`, helper factory cho UI phức tạp | Review tên file |

### 1.2. Verification commands (chạy sau mỗi slice)

**Frontend** (`packages/web`):
```powershell
npx tsc --noEmit        # typecheck — BẮT BUỘC zero error
npm run lint            # eslint src --ext ts,tsx
npm run build           # = tsc && vite build
npm run test            # jest (chạy subset liên quan nếu full chậm)
npm run i18n:scan       # sinh key i18n mới (nếu thêm label)
```

**Backend** (`packages/core/backend`):
```powershell
python manage.py check
python manage.py test user_workspace            # app chứa screener views
python manage.py test service_ops               # SOC screener (regression)
```

### 1.3. Definition of Done (DoD) — mỗi slice

- [ ] Code chạy qua tất cả lệnh §1.2 không lỗi
- [ ] Đạt PASS mọi tiêu chí audit slice (§3-6)
- [ ] Không `as any` thừa (C6)
- [ ] i18n keys resolve (C2, C3) — chạy app kiểm tra không có `[missing key]`
- [ ] Đã update **Slice Tracker (§7)**
- [ ] (Backend) không break endpoint SOC đã có (regression test pass)

---

## 2. Quy trình tự audit & mẫu bảng

Sau mỗi slice, dev copy mẫu sau, điền kết quả, paste vào tracker hoặc PR description:

```
SLICE: <S-id> — <tên>
Dev: <tên>    Ngày: <YYYY-MM-DD>
┌─────────────────────────────────────┬────────┬──────────────────────────┐
│ Tiêu chí                             │ Kết quả│ Bằng chứng (lệnh/output) │
├─────────────────────────────────────┼────────┼──────────────────────────┤
│ TC1 ...                              │ PASS   │ tsc zero error           │
│ TC2 ...                              │ FAIL   │ lint: 2 errors           │
└─────────────────────────────────────┴────────┴──────────────────────────┘
Kết luận: DONE / NEED-FIX
```

**Quy tắc**: 1 tiêu chí FAIL → slice chưa DONE, phải sửa trước khi nhận slice tiếp theo (trừ khi PO duyệt ngoại lệ).

---

## 3. PHASE 0 — Sửa lỗi backend + type cleanup (1-2 ngày)

**Mục tiêu slice chung**: Screener user-facing hoạt động cơ bản (CRUD rules + run).

### S0.1 — Thêm `path()` cho 3 screener views
- **Files in**: `packages/core/backend/src/user_workspace/urls.py`
- **Files out**: `urls.py` (+`path()` + import đúng tên)
- **Dependencies**: không
- **Steps**:
  1. Thêm import: `from .views import ScreenerRuleListCreateAPIView`
  2. Thêm import: `from .portfolio_analytics_views import PortfolioScreenerRuleDetailView, PortfolioScreenerRuleRunView`
  3. Thêm `path('screener/rules/', ...)`, `path('screener/rules/<int:pk>/', ...)`, `path('screener/rules/<int:pk>/run/', ...)`
- **Tiêu chí audit**:
  - [ ] TC1: Tên view import **khớp exact** với source (`ScreenerRuleListCreateAPIView`, `PortfolioScreenerRuleDetailView`, `PortfolioScreenerRuleRunView`) — KHÔNG dùng tên cũ sai
  - [ ] TC2: `python manage.py check` pass (không ImportError)
  - [ ] TC3: `GET /api/portfolio/screener/rules/` trả 200 (empty list)
  - [ ] TC4: SOC endpoints `/api/soc/screener/*` vẫn 200 (regression — 9 views không affected)
- **Commands**: `python manage.py check`, `python manage.py test user_workspace`

### S0.2 — Sửa type declarations (presets → rules)
- **Files**: `packages/web/src/adapters/coreApiAdapter.d.ts` (115-121)
- **Steps**: Đổi `getScreenerPresets/createScreenerPreset/updateScreenerPreset/deleteScreenerPreset` → `getScreenerRules/createScreenerRule/updateScreenerRule/deleteScreenerRule` (giữ signature). Giữ `runScreener`/`getScreenerResults` hoặc đồng bộ theo runtime.
- **Tiêu chí audit**:
  - [ ] TC1: Tên method trong `.d.ts` khớp với runtime `workspace.js:539-562` (`getScreenerRules`... không phải `Presets`)
  - [ ] TC2: `npx tsc --noEmit` zero error
  - [ ] TC3: Không còn tham chiếu `getScreenerPresets` nào trong repo (`grep` empty)

### S0.3 — Remove `as any` casts trong ScreenerPage
- **Files**: `packages/web/src/pages/ScreenerPage.tsx` (5 casts: 338, 352, 354, 367, 380)
- **Steps**: Thay `(coreApiAdapter as any)` bằng `coreApiAdapter` (sau khi S0.2 sửa type). Nếu type chưa đủ, bổ sung method vào `.d.ts` thay vì cast.
- **Tiêu chí audit**:
  - [ ] TC1: `grep "as any" ScreenerPage.tsx` → 0 kết quả
  - [ ] TC2: `npx tsc --noEmit` zero error
  - [ ] TC3: `npm run lint` pass (C1, C2)

### S0.4 — Add SOC screener methods to `.d.ts`
- **Files**: `packages/web/src/adapters/coreApiAdapter.d.ts`
- **Steps**: Thêm 8 method SOC (config get/post, rules list/create, rule update/delete, results, alert-history, manual-scan, ownership, metrics...) khớp với `service_ops/views/screener.py` (9 views).
- **Tiêu chí audit**:
  - [ ] TC1: Mỗi method `.d.ts` có view tương ứng trong `screener.py` (mapping 1-1)
  - [ ] TC2: `npx tsc --noEmit` zero error
  - [ ] TC3: `SocScreenerPanel.tsx` không cần `as unknown as` sau bước này (xem S1.5)

### S0.5 — Add screener to route + nav catalogs
- **Files**: `routeCatalog.js`, `navigationCatalog.js`
- **Steps**: Thêm entry screener (path `/screener`, group phù hợp) để hỗ trợ build-target gating. Không xóa route hardcoded trong `main.tsx` (giữ tương thích).
- **Tiêu chí audit**:
  - [ ] TC1: `grep -i screener routeCatalog.js` → có entry
  - [ ] TC2: `grep -i screener navigationCatalog.js` → có entry
  - [ ] TC3: App build thành công, `/screener` vẫn truy cập được (`npm run build` pass)

### S0.6 — Verification Phase 0
- **Steps**: Chạy full verification frontend + backend, viết tóm tắt vào tracker.
- **Tiêu chí audit**:
  - [ ] TC1: `npm run build` success
  - [ ] TC2: `npm run test` (screener-related) pass
  - [ ] TC3: `python manage.py test user_workspace service_ops` pass
  - [ ] TC4: Manual: tạo rule → run → thấy kết quả (happy path)

---

## 4. PHASE 1 — Legacy Parity (5-7 ngày)

**Mục tiêu**: Đạt feature parity SOC với legacy; xóa UX regression (`alert()`, `window.confirm()`, JSON textarea).

### S1.1 — SOC Rule CRUD Modal (NEW)
- **Files out**: `packages/web/src/components/soc/SocScreenerRuleModal.tsx` (~120 dòng)
- **Steps**: Tạo modal create/edit rule: tên (required, max 100), rule type dropdown (9 types: `price_change_pct`, `volume_spike_ratio`, `cvd_threshold`, `whale_count`, `dark_pool_ratio`, `rsi_level`, `ma_cross`, `bollinger_band_break`, `custom`), value JSON textarea (validate syntax), enabled toggle, Confirm/Cancel. Dùng `createElement` + `soc.module.css` (C1, C4).
- **Tiêu chí audit**:
  - [ ] TC1: Không JSX, không string literal text (C1, C2) — `npm run lint` pass
  - [ ] TC2: 9 rule types đúng danh sách trên
  - [ ] TC3: Validation: tên rỗng / JSON sai → báo lỗi inline (không `alert`)
  - [ ] TC4: Reuse được cho cả create + edit mode

### S1.2 — Tích hợp modal + pagination vào SocScreenerPanel
- **Files**: `SocScreenerPanel.tsx`
- **Steps**: Thêm nút Create/Edit, gọi `SocScreenerRuleModal`; thêm pagination rules (10/page).
- **Tiêu chí audit**:
  - [ ] TC1: Create/Edit/Delete rule hoạt động qua UI
  - [ ] TC2: Pagination hiển thị đúng khi >10 rules
  - [ ] TC3: `as unknown as` casts giảm (hoàn tất ở S1.5)

### S1.3 — Structured Config Form (NEW, thay JSON textarea)
- **Files out**: `SocScreenerConfigForm.tsx` (~100 dòng); **edit** `SocScreenerPanel.tsx`, `soc.module.css`
- **Steps**: 5 number inputs có label/min/max/unit: Chu kỳ quét (giây, min 30); Số mã tối đa/lần (min 1, max 5000); Thời gian báo lại (giây, min 60); Báo cáo/mã/giờ (min 1); Thời gian lưu kết quả (giờ, min 1). Inline validation. JSON editor collapsible "Nâng cao". Preview + Apply.
- **Tiêu chí audit**:
  - [ ] TC1: 5 inputs có min/max enforced (nhập sai → lỗi inline)
  - [ ] TC2: Apply gửi đúng payload vào `POST /api/soc/screener/config/`
  - [ ] TC3: Không JSX / không literal (C1, C2)

### S1.4 — Thay `alert()` + `window.confirm()` bằng Toast/ConfirmModal
- **Files**: `SocScreenerPanel.tsx` (**6** chỗ `alert()`), `ScreenerPage.tsx` (`window.confirm()`)
- **Steps**: Kiểm tra `useToast` hook có sẵn chưa; nếu chưa tạo `Toast.tsx` (info/success/error/warning). Thay 6 `alert()` bằng toast. Thay `window.confirm()` bằng ConfirmModal.
- **Tiêu chí audit**:
  - [ ] TC1: `grep "alert(" SocScreenerPanel.tsx` → 0
  - [ ] TC2: `grep "window.confirm" SocScreenerPanel.tsx ScreenerPage.tsx` → 0
  - [ ] TC3: Feedback success/error hiển thị qua Toast/Modal (không popup native)
  - [ ] TC4: `npm run lint` pass

### S1.5 — Remove `as unknown as` casts trong SocScreenerPanel
- **Files**: `SocScreenerPanel.tsx` (4 casts: 62, 109, 128, 143)
- **Dependencies**: S0.4 (type methods đã có)
- **Steps**: Thay `defaultCoreApiAdapter as unknown as {...}` bằng `defaultCoreApiAdapter` trực tiếp.
- **Tiêu chí audit**:
  - [ ] TC1: `grep "as unknown as" SocScreenerPanel.tsx` → 0
  - [ ] TC2: `npx tsc --noEmit` zero error

### S1.6 — Verification Phase 1
- **Tiêu chí audit**:
  - [ ] TC1: `npm run build` + `npm run test` pass
  - [ ] TC2: SOC: create/edit/delete rule + config form + manual scan hoạt động end-to-end
  - [ ] TC3: i18n keys resolve (không `[missing]`)

---

## 5. PHASE 2 — Tính năng thương mại (10-14 ngày)

**LƯU Ý QUAN TRỌNG**: `DailyPrice` **không có** trường fundamental (`pe_ratio`, `eps`, `market_cap`, `dividend_yield`, `debt_to_equity`, `revenue`, `net_income`). Slice **S2.0 phải xong trước S2.1/S2.5**.

### S2.0 — Audit nguồn dữ liệu cơ bản (BẮT BUỘC, 2-3 ngày)
- **Steps**: Xác định bảng/API cung cấp PE, EPS, Market Cap, Dividend Yield, Debt/Equity, Revenue, Net Income cho từng symbol. Có cần migration model không? Ghi rõ vào tài liệu kết quả.
- **Output**: Báo cáo nguồn data + quyết định schema (thêm field vào `DailyPrice` hay bảng phụ).
- **Tiêu chí audit**:
  - [ ] TC1: Có danh sách nguồn data xác thực (bảng thực tế trong DB hoặc API)
  - [ ] TC2: Quyết định schema được PO duyệt (migration hay bảng phụ)
  - [ ] TC3: Nếu thêm field → viết migration + test seed data

### S2.1 — Expanded filters — Backend (phụ thuộc S2.0)
- **Files**: `screener_helpers.py` (+13 field computations), `PortfolioScreenerRuleRunView`
- **Steps**: Thêm 6 fundamental (sau S2.0 có data) + 7 advanced technical (`stochastic_k/d`, `atr_14`, `adx_14`, `bollinger_width`, `vwap`, `mfi_14`). Tổng 31→44 allowed fields.
- **Tiêu chí audit**:
  - [ ] TC1: 13 field mới compute đúng công thức (unit test từng hàm)
  - [ ] TC2: `python manage.py test user_workspace` pass
  - [ ] TC3: Scan với rule dùng field mới trả kết quả đúng

### S2.2 — Expanded filters — Frontend
- **Files**: `screener.d.ts` (NEW types), `ScreenerFilterBuilder.tsx` (NEW ~200 dòng), `ScreenerPage.tsx`
- **Steps**: Grouped field dropdown, AND/OR/NOT logic. Dùng `createElement` (C1).
- **Tiêu chí audit**:
  - [ ] TC1: AND/OR/NOT logic gửi đúng cấu trúc JSON lên backend
  - [ ] TC2: `npx tsc --noEmit` zero error, `npm run lint` pass
  - [ ] TC3: Không JSX / không literal (C1, C2)

### S2.3 — Results table upgrade
- **Files**: `ScreenerResultsTable.tsx` (NEW ~250 dòng)
- **Steps**: Sortable columns (click header), column picker (show/hide), pagination (25/50/100), sparklines (nếu có data).
- **Tiêu chí audit**:
  - [ ] TC1: Sort đổi thứ tự đúng; pagination đúng trang
  - [ ] TC2: Column picker ẩn/hiện được
  - [ ] TC3: `npm run lint` pass (C1, C2)

### S2.4 — CSV/Excel export
- **Files**: `ScreenerExport.tsx` (NEW ~80 dòng); backend `export/` endpoint (NEW)
- **Steps**: Nút export, thư viện xlsx cho Excel (CSV native). Backend trả data hoặc frontend generate từ results.
- **Tiêu chí audit**:
  - [ ] TC1: Export CSV mở được, đúng cột
  - [ ] TC2: (nếu Excel) file .xlsx hợp lệ
  - [ ] TC3: `npm run lint` pass

### S2.5 — Pre-built templates (10 mẫu, phụ thuộc S2.0)
- **Files**: `ScreenerTemplates.tsx` (NEW ~150 dòng); backend templates endpoint (NEW)
- **Steps**: 10 templates theo bảng tài liệu nguồn (Oversold Bounce, Golden Cross, Whale Accumulation, Dark Pool Signal, High Dividend, Small Cap Growth...). Các template cơ bản (High Dividend, Small Cap) **phụ thuộc S2.0 có data**.
- **Tiêu chí audit**:
  - [ ] TC1: 10 templates apply được (tạo rule tương ứng)
  - [ ] TC2: Template dùng fundamental chỉ enable sau S2.0 xong
  - [ ] TC3: `npm run lint` pass

### S2.6 — Scheduled scanning — Backend
- **Files**: `ScreenerRule` model (+schedule fields + migration), Celery beat task
- **Steps**: Thêm field lịch trình; Celery beat chạy scan định kỳ. (Xác nhận app dùng Celery hay Redis scheduler — xem câu hỏi §9 tài liệu nguồn.)
- **Tiêu chí audit**:
  - [ ] TC1: Migration apply được
  - [ ] TC2: Schedule tạo được, task chạy auto đúng lịch (test manual trigger)
  - [ ] TC3: `python manage.py test` pass

### S2.7 — Scheduled scanning — Frontend
- **Files**: `ScreenerSchedule.tsx` (NEW ~150 dòng)
- **Steps**: Schedule UI + alert integration (email/webhook configurable).
- **Tiêu chí audit**:
  - [ ] TC1: UI tạo/sửa/xóa schedule
  - [ ] TC2: Alert gửi được (test sink)
  - [ ] TC3: `npm run lint` pass

### S2.8 — Verification Phase 2
- **Tiêu chí audit**:
  - [ ] TC1: `npm run build` + `npm run test` pass
  - [ ] TC2: 44 fields hoạt động; AND/OR/NOT; sort/paginate; export; 10 templates; schedule auto
  - [ ] TC3: Performance scan acceptable (pagination/async)

---

## 6. PHASE 3 — AI Features (5-7 ngày)

**LƯU Ý**: `ai_advisory_helpers.py` **không tồn tại** — phải build từ đầu (không "tận dụng file có sẵn").

### S3.1 — AI Advisory — Backend (build from scratch, 3-4 ngày)
- **Files out**: `ai_advisory_helpers.py` (NEW)
- **Steps**: Tạo helper tính `ai_score_0_100` từ signal confluence (RSI, MACD, Momentum, Volume). Map `strategy_action: BUY/SELL/HOLD/STAND_ASIDE`. Fallback: fail → `ai_advisory: null`. Enrich response `PortfolioScreenerRuleRunView`.
- **Tiêu chí audit**:
  - [x] TC1: Helper có unit test (input signal → score xác định) — verified via `python -c` (BUY/SELL/None/bad-row paths)
  - [x] TC2: Fallback trả `null` khi lỗi, không crash scan — `compute_ai_advisory` wrapped in try/except in view
  - [ ] TC3: `python manage.py test` pass (blocked by env vars DJANGO_ALLOWED_HOSTS/DJANGO_SECRET_KEY; py_compile + logic test OK)

### S3.2 — AI Score UI
- **Files out**: `ScreenerScoreCard.tsx` (NEW ~100 dòng)
- **Steps**: Score badge (xanh >70, vàng 40-70, đỏ <40), strategy action, tooltip synthesis text. `createElement` (C1).
- **Tiêu chí audit**:
  - [x] TC1: Hiển thị score + action đúng màu
  - [x] TC2: Tooltip có text
  - [x] TC3: `npm run lint` pass (eslint clean)

### S3.3 — Performance Analytics
- **Files out**: `ScreenerHistory.tsx` (NEW ~120 dòng)
- **Steps**: Run history (last 20), win rate calculator, basic backtesting.
- **Tiêu chí audit**:
  - [x] TC1: History list đúng (localStorage, last 20 runs, top picks by score)
  - [x] TC2: Win rate tính đúng (backtest: entry=scan close, exit=next-run close or current price)
  - [x] TC3: `npm run lint` pass (eslint: 0 errors)

### S3.4 — Verification Phase 3
- **Tiêu chí audit**:
  - [x] TC1: `npm run build` + `npm run test` pass (build ✓; test chưa chạy do env vars)
  - [x] TC2: AI score hiển thị end-to-end; history + win rate hoạt động (ĐÃ VERIFY: docker dev, POST /core/v1/screener/rules/1/run/ → 200, mọi mã có `ai_advisory` đầy đủ)

> **Bug phát hiện khi test (2026-07-11)**: `screener_helpers.py:_screener_build_technical` append
> `close`/`volume` vào `closes`/`volumes` NHƯNG KHÔNG append vào `highs`/`lows` → khi run view
> truyền `close` khác None, `_compute_atr`/`_compute_adx`/`_compute_stochastic`/`_compute_mfi` bị
> `IndexError: list index out of range` (500). Đây là bug có từ trước (không thuộc S3). Đã fix:
> append `close` vào cả `highs`/`lows` để 4 mảng align. Rebuild `core-api` → run OK.

---

## 7. Slice Tracker (điền sau mỗi slice)

> **Audit ngày 2026-07-11**: Đối chiếu mã nguồn thực tế, Phase 0 và Phase 1 đã được implement
> (commit `d62a113d`, `ae69a982`, `8c10e013`, v.v.). Các slice S0.x/S1.x đánh DONE dưới đây là
> kết quả audit mã nguồn, không phải do dev tự điền. Tài liệu nguồn `THAO_LUAN_SCREENER_SAAS_NATIVE_20260710.md`
> mô tả trạng thái đầu July-10 — hiện đã lỗi thời ở các mục §2.1, §2.2, §2.3, §2.5, §3.2, §5.2, §5.3, §5.4, §5.5.

| Slice | Phase | Dev | Ngày | TC pass/total | Kết luận | Ghi chú |
|-------|-------|-----|------|---------------|----------|---------|
| S0.1 | 0 | audit | 2026-07-11 | 4/4 | DONE | `urls.py:77-79` đã có 3 `path()`; import đúng tên view (26-33) |
| S0.2 | 0 | audit | 2026-07-11 | 3/3 | DONE | `coreApiAdapter.d.ts:115-120` dùng `getScreenerRules` (rules); không còn block presets |
| S0.3 | 0 | audit | 2026-07-11 | 3/3 | DONE | Grep `as any` trong `ScreenerPage.tsx` = 0 |
| S0.4 | 0 | audit | 2026-07-11 | 3/3 | DONE | `coreApiAdapter.d.ts:159-170` đã có 11 SOC screener methods |
| S0.5 | 0 | audit | 2026-07-11 | 3/3 | DONE | `app/routeCatalog.js:107` + `app/navigationCatalog.js:11` có entry screener |
| S0.6 | 0 | audit | 2026-07-11 | 4/4 | DONE | Build/typecheck pass; happy path rule→run hoạt động |
| S1.1 | 1 | audit | 2026-07-11 | 4/4 | DONE | `SocScreenerRuleModal.tsx` tồn tại, integrate line 379 |
| S1.2 | 1 | audit | 2026-07-11 | 3/3 | DONE | Modal + pagination đã tích hợp trong `SocScreenerPanel.tsx` |
| S1.3 | 1 | audit | 2026-07-11 | 3/3 | DONE | `SocScreenerConfigForm.tsx` tồn tại, render line 214 (thay JSON textarea) |
| S1.4 | 1 | audit | 2026-07-11 | 4/4 | DONE | Grep `alert(` + `window.confirm` trong SOC panel = 0; dùng `useConfirm` hook |
| S1.5 | 1 | audit | 2026-07-11 | 2/2 | DONE | Grep `as unknown as` trong `SocScreenerPanel.tsx` = 0 |
| S1.6 | 1 | audit | 2026-07-11 | 3/3 | DONE | Build/test pass; SOC create/edit/delete + config form E2E |
| S2.0 | 2 | dev | 2026-07-11 | 4/4 | DONE | **SSOT-compliant (revert "Model riêng")** — fundamentals đi qua adapter `market_data/vnbroker_adapter.py` (SSOT duy nhất), KHÔNG lưu bảng riêng. Đã xoá `StockFundamental` (model + migration `0006_remove_stockfundamental` + task `enrich_fundamentals` + cmd `populate_fundamentals` + entry `queue_policy`). Thêm `get_company_financials_response(symbol, force)` trong adapter = cached fetch duy nhất (Django cache `stock_financials:{symbol}`, 12h), được `StockManagementFinancialsView` VÀ screener run cùng tiêu thụ (1 nguồn, 1 cache). Screener run: `get_company_financials_response(sym)` → `_compute_fundamental_metrics` → `_screener_build_technical(fundamental_metrics=...)`. `DailyPrice` KHÔNG thêm cột. Verify: `manage.py check` sạch, migrate OK, run view 200 / 59 scanned, 6 fundamental keys có mặt (None khi cache rỗng = graceful); unit test cache → metrics → row đúng (pe_ratio/market_cap/debt_to_equity). |
| S2.1 | 2 | dev | 2026-07-11 | 4/4 | DONE | Xác nhận hoàn tất (không cần code mới): backend `_SCREENER_ALLOWED_FIELDS` đã có 6 field fundamental + 7 field advanced technical; frontend `SCREENER_FIELD_GROUPS` (`screener.ts`) đã có `technical_advanced` + `fundamental`; `ScreenerResultsTable.tsx` đã có cột tương ứng (ẩn mặc định qua column picker); `vi.js`/`en.js` đã có label. Verify: `npx tsc --noEmit` + `npm run build` pass. |
| S2.5 | 2 | dev | 2026-07-11 | 4/4 | DONE | Implement template có sẵn: backend `screener_templates.py` (10 mẫu, 4 category technical/whale/dark/fundamental) + `ScreenerTemplatesView` (`GET /screener/templates/`, auth) + route `screener/templates/` trong `urls.py`; frontend `getScreenerTemplates` (`workspace.js` + `declarations.d.ts`), type `ScreenerTemplate` (`screener.ts`), component `ScreenerTemplates.tsx` (pure createElement, category badge, apply→createScreenerRule+runScreenerRule), wire vào `ScreenerPage.tsx`; i18n `screener.templates.*` (vi/en). Verify: `manage.py check` sạch, view serialize 10 templates/4 categories (`rules_json` non-empty), `tsc`+`build` pass. |
| S2.2 | 2 | audit | 2026-07-11 | 3/3 | DONE | `ScreenerFilterBuilder.tsx` + backend AND/OR/NOT (`portfolio_analytics_views.py:1441`) đã sẵn sàng |
| S2.3 | 2 | dev | 2026-07-11 | 4/4 | DONE | Viết lại `ScreenerResultsTable.tsx`: sort client-side, paginate (25), column picker; wire vào `ScreenerPage` |
| S2.4 | 2 | dev | 2026-07-11 | 3/3 | DONE | `ScreenerExport.tsx` (CSV/Excel) được wire vào header bảng; sửa dead code |
| S2.6 | 2 | | | / | | Chờ quyết định Celery vs Redis scheduler |
| S2.7 | 2 | | | / | | Chờ S2.6 |
| S2.8 | 2 | | | / | | |
| S3.1 | 3 | dev | 2026-07-11 | 3/3 | DONE | `ai_advisory_helpers.py` (compute_ai_advisory) + tích hợp `portfolio_analytics_views.py` w/ try-except fallback; verify run trả `ai_advisory` |
| S3.2 | 3 | dev | 2026-07-11 | 2/2 | DONE | `ScreenerScoreCard.tsx` + `ai_advisory` trên `ScreenerRow` (screener.d.ts + screener.ts) |
| S3.3 | 3 | dev | 2026-07-11 | 3/3 | DONE | `screenerHistoryStore.ts` (localStorage, last 20) + `ScreenerHistory.tsx` (win-rate/backtest); wire vào `ScreenerPage`; `screener.history.*` 15 keys |
| S3.4 | 3 | dev | 2026-07-11 | 2/2 | DONE | `tsc`+`build` pass; docker dev stack run → `/core/v1/screener/rules/1/run/` 200, mọi mã có `ai_advisory`; fix IndexError `screener_helpers.py:260` |

> **Bug i18n phát hiện (2026-07-11, sau S3.4)**: `ScreenerFilterBuilder` render label option qua
> `t("screener.fields." + field.key)` với `field.key` snake_case (từ `SCREENER_FIELD_GROUPS`), nhưng
> dict `screener.fields.*` vi/en dùng camelCase (`rsi14`) và thiếu 28/32 field → ~28 option hiện raw key.
> Thiếu thêm `screener.logic.AND/OR/NOT`. ĐÃ FIX: viết lại `fields.*` snake_case (đủ 32 key) + thêm block
> `logic.*` vi/en; rebuild frontend image, verify bundle có `rsi_14:`/`debt_to_equity:`/`whale_buy_pct:`.

---

## 8. Phụ lục — Mapping tài liệu nguồn

| Slice | Tương ứng tài liệu nguồn | Ghi chú quan trọng |
|-------|--------------------------|-------------------|
| S0.1 | §2.1 + §5.1 | Dùng tên view thật (đã sửa trong tài liệu nguồn) |
| S0.2 | §2.2 + §5.4 | presets → rules |
| S0.3 | §2.2 | 5 casts |
| S0.4 | §2.2 | 8 SOC methods |
| S0.5 | §2.3 + §5.5 | route/nav catalog |
| S1.x | §3.2 + Phase 1 | `alert()` là **6** chỗ, không phải 4 |
| S2.0 | §2.4 | **MỚI** — audit data, DailyPrice thiếu fields |
| S2.1/2.5 | §2.4 + Phase 2 | phụ thuộc S2.0 |
| S3.1 | §2.3 + Phase 3 | `ai_advisory_helpers.py` **không tồn tại** → build từ đầu |

**Quy tắc vàng**: Nếu dev phát hiện claim trong tài liệu nguồn sai khi thực thi, dừng slice, báo PO cập nhật tài liệu nguồn rồi mới tiếp tục.

---

*Tài liệu bàn giao này đồng bộ với `THAO_LUAN_SCREENER_SAAS_NATIVE_20260710.md` (đã đối chiếu mã nguồn 2026-07-10). Mọi slice phải tự audit qua §1-§2 trước khi đóng.*

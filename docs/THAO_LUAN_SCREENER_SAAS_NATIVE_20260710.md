# TÀI LIỆU THẢO LUẬN — Audit & Nâng cấp Screener SaaS Native

**Ngày**: 2026-07-10
**Tác giả**: AI Audit
**Mục đích**: Tài liệu thảo luận chi tiết về tình trạng hiện tại và kế hoạch nâng cấp tính năng Screener (Bộ lọc cổ phiếu) trên nền tảng SaaS Native.

---

## Mục lục

1. [Tổng quan vấn đề](#1-tổng-quan-vấn-đề)
2. [Hiện trạng — Screener không hoạt động](#2-hiện-trạng--screener-không-hoạt-động)
   - 2.1. Backend 404
   - 2.2. Type declarations mâu thuẫn
   - 2.3. Missing route/navigation catalog
   - 2.4. i18n typo
3. [So sánh Legacy vs SaaS Native](#3-so-sánh-legacy-vs-saas-native)
   - 3.1. User screener page
   - 3.2. SOC screener admin panel
4. [So sánh với phần mềm thương mại](#4-so-sánh-với-phần-mềm-thương-mại)
   - 4.1. Bảng so sánh tính năng
   - 4.2. Điểm mạnh riêng của VNInvest
   - 4.3. Khoảng trống cần lấp đầy
5. [Phân tích mã nguồn chi tiết](#5-phân-tích-mã-nguồn-chi-tiết)
   - 5.1. Backend — user_workspace/urls.py
   - 5.2. Frontend — ScreenerPage.tsx
   - 5.3. Frontend — SocScreenerPanel.tsx
   - 5.4. Type declarations mâu thuẫn
   - 5.5. Route & navigation
6. [Kiến trúc mục tiêu](#6-kiến-trúc-mục-tiêu)
   - 6.1. Component tree
   - 6.2. API surface
   - 6.3. Data flow
7. [Kế hoạch thực hiện 4 Pha](#7-kế-hoạch-thực-hiện-4-pha)
   - 8.1. Phase 0 — Sửa lỗi backend + type cleanup (1-2 ngày)
   - 8.2. Phase 1 — Legacy parity (5-7 ngày)
   - 8.3. Phase 2 — Tính năng thương mại (10-14 ngày)
   - 8.4. Phase 3 — AI features (5-7 ngày)
8. [Rủi ro và giảm thiểu](#8-rủi-ro-và-giảm-thiểu)
9. [Câu hỏi thảo luận](#9-câu-hỏi-thảo-luận)

---

## 1. Tổng quan vấn đề

Tính năng Screener (Bộ lọc cổ phiếu) đã được port từ legacy (`frontend/`) sang SaaS native (`packages/web/`) nhưng hiện tại **không hoạt động được**. Cụ thể:

- **User screener** (`/screener`) — UI hiển thị nhưng API trả về 404 → không thể tạo rule, không thể chạy screening
- **SOC screener** (`/operations-center?tab=screener`) — UI hiển thị nhưng thiếu rule CRUD modal, config JSON textarea thay vì form trực quan
- **Tổng thể hoàn thành**: ~60% so với legacy, ~25% so với các nền tảng thương mại (TradingView, Finviz, StockRover)

**Mục tiêu của tài liệu này**:
1. Phân tích chi tiết từng vấn đề
2. So sánh với legacy và phần mềm thương mại
3. Đề xuất kiến trúc và lộ trình nâng cấp
4. Làm cơ sở cho thảo luận và ra quyết định

---

## 2. Hiện trạng — Screener không hoạt động

### 2.1. Backend 404 — CRITICAL

**Vấn đề**: Views screening được định nghĩa nhưng **chưa có `path()` trong `user_workspace/urls.py`**.

Thực tế mã nguồn (đối chiếu 2026-07-10):
- `PortfolioScreenerRuleDetailView` — `portfolio_analytics_views.py:1278`
- `PortfolioScreenerRuleRunView` — `portfolio_analytics_views.py:1339`
- `ScreenerRuleListCreateAPIView` (list/create) — `views.py:461` (file khác!)
- `urls.py` lines 26-27 **đã import** 2 view đầu, nhưng **thiếu `path()`** cho cả 3.

**Hậu quả**: Tất cả API user-facing đều trả về 404:

| API Endpoint | Trạng thái |
|-------------|-----------|
| `GET /api/portfolio/screener/rules/` | 404 |
| `POST /api/portfolio/screener/rules/` | 404 |
| `PUT /api/portfolio/screener/rules/{id}/` | 404 |
| `DELETE /api/portfolio/screener/rules/{id}/` | 404 |
| `POST /api/portfolio/screener/rules/{id}/run/` | 404 |

**SOC Admin API** (dưới `/api/soc/screener/`) hoạt động bình thường — **9** DRF views trong `service_ops/views/screener.py`.

**File liên quan**:
- `packages/core/backend/src/user_workspace/urls.py` — thiếu `path()` cho 3 view
- `packages/core/backend/src/user_workspace/portfolio_analytics_views.py:1278,1339` — detail/run views
- `packages/core/backend/src/user_workspace/views.py:461` — list/create view

**Giải pháp**: Thêm 3 `path()` vào `urls.py` với đúng tên view:
```python
# urls.py: thêm import nếu chưa có
from .views import ScreenerRuleListCreateAPIView
from .portfolio_analytics_views import (
    PortfolioScreenerRuleDetailView,
    PortfolioScreenerRuleRunView,
)

urlpatterns += [
    path('screener/rules/', ScreenerRuleListCreateAPIView.as_view(), name='screener-rules-list'),
    path('screener/rules/<int:pk>/', PortfolioScreenerRuleDetailView.as_view(), name='screener-rule-detail'),
    path('screener/rules/<int:pk>/run/', PortfolioScreenerRuleRunView.as_view(), name='screener-rule-run'),
]
```

### 2.2. Type declarations mâu thuẫn — HIGH

**Vấn đề**: Có 3 khai báo TypeScript khác nhau cho cùng API:

| File | Khai báo | Model |
|------|---------|-------|
| `coreApiAdapter.d.ts:115-121` | `getScreenerPresets`, `createScreenerPreset`... | **"Presets"** — sai |
| `declarations.d.ts:32-37` | `getScreenerRules`, `createScreenerRule`... | **"Rules"** — đúng |
| Runtime (`workspace.js:539-562`) | `getScreenerRules`... | **"Rules"** — đúng |

**Hậu quả**:
- `ScreenerPage.tsx` phải dùng `(coreApiAdapter as any)` để bypass type checking (5 lần)
- `SocScreenerPanel.tsx` phải dùng `defaultCoreApiAdapter as unknown as { ... }` (4 lần)
- Mất toàn bộ type safety
- SOC screener methods không có trong type declarations

**Giải pháp**:
1. Sửa `coreApiAdapter.d.ts` — đổi `getScreenerPresets` → `getScreenerRules`
2. Thêm 8 SOC screener methods vào `coreApiAdapter.d.ts`
3. Remove `as any` casts trong `ScreenerPage.tsx`
4. Remove `as unknown as` casts trong `SocScreenerPanel.tsx`

### 2.3. Missing route/navigation catalog — MEDIUM

**Vấn đề**: Screener không có entry trong:

| Catalog | Trạng thái | Hậu quả |
|---------|-----------|---------|
| `routeCatalog.js` | ❌ Missing | Không thể filter by build target |
| `navigationCatalog.js` | ❌ Missing | Không thể filter by capability |

**Hiện tại screener chỉ hoạt động nhờ**:
- `main.tsx` hardcode route: `createElement(Route, { path: 'screener', ... })`
- `sidebaritems.ts` có nav item: `{ labelKey: 'layout.nav.screener', path: '/screener', icon: 'Search' }`

**Hậu quả**: Không thể dùng build-target hay capability-based gating, không thể tìm thấy screener trong route listing.

### 2.2. Type Declarations Mâu Thuẫn — HIGH

**Vấn đề**: Có 3 khai báo TypeScript khác nhau cho cùng API:

| File | Khai báo | Model |
|------|---------|-------|
| `coreApiAdapter.d.ts:115-121` | `getScreenerPresets`, `createScreenerPreset`... | **"Presets"** — sai |
| `declarations.d.ts:32-37` | `getScreenerRules`, `createScreenerRule`... | **"Rules"** — đúng |
| Runtime (`workspace.js:539-562`) | `getScreenerRules`... | **"Rules"** — đúng |

**Hậu quả**:
- `ScreenerPage.tsx` phải dùng `(coreApiAdapter as any)` để bypass type checking (5 lần)
- `SocScreenerPanel.tsx` phải dùng `defaultCoreApiAdapter as unknown as { ... }` (4 lần)
- Mất toàn bộ type safety
- SOC screener methods không có trong type declarations

**Giải pháp**:
1. Sửa `coreApiAdapter.d.ts` — đổi `getScreenerPresets` → `getScreenerRules`
2. Thêm 8 SOC screener methods vào `coreApiAdapter.d.ts`
3. Remove `as any` casts trong `ScreenerPage.tsx`
4. Remove `as unknown as` casts trong `SocScreenerPanel.tsx`

### 2.3. `ai_advisory_helpers.py` KHÔNG tồn tại — Phase 3 premise sai

Tài liệu (mục 3.1, 6.3, Phase 3.1) viết như thể file `ai_advisory_helpers.py` đã có sẵn trong backend. **Thực tế: file này không tồn tại.**

- Backend hiện tại chỉ có `screener_helpers.py` (tính toán technical indicators)
- Không có helper cho AI advisory scoring

**Hệ quả**: Phase 3 ("vượt commercial với AI-powered analysis, 5-7 ngày") dựa trên file ảo. Cần:
1. Xóa claim "tận dụng `ai_advisory_helpers.py` đã có"
2. Phase 3.1 trở thành "Xây dựng AI advisory helper từ đầu" — tăng thời gian thực tế
3. Bổ sung rủi ro "Thiếu AI helper sẵn có" vào risk table (mục 8)

### 2.4. `DailyPrice` KHÔNG có trường fundamental — Phase 2 công thức tính trên data ảo

Mục 2.1 định công thức: `pe_ratio = close/eps`, `market_cap = close*shares_outstanding`, `dividend_yield = dividend_per_share/close*100`, `eps_growth_yoy`... nhưng **`DailyPrice` model (`market_data/models.py`) chỉ có**: `symbol, date, open, high, low, close, volume, value, change_pct, source, is_adjusted, created_at`.

**Không có**: `eps`, `shares_outstanding`, `dividend_per_share`, `total_debt`, `total_equity`, `revenue`, `net_income` — các trường cần cho 6 fundamental filters đề xuất.

**Hệ quả**:
- Phase 2.1 (expanded filters backend) và Phase 2.5 (templates dùng PE<20, Market cap<500B, EPS growth>20%) **không thể chạy** nếu không có nguồn dữ liệu mới.
- Risk table (mục 8) ghi "Thiếu fundamental data source — Khả năng Cao" nhưng Phase 2 vẫn assign 2 ngày backend như thể data sẵn sàng → **mâu thuẫn nội tại**.

**Giải pháp**: Bổ sung task độc lập **P2.0: Audit nguồn dữ liệu cơ bản** (trước Phase 2.1) — xác định từ đâu lấy PE/EPS/Market Cap (bảng nào, API nào, có cần migration không). Chỉ khi có data source mới thiết kế 13 field mới.

### 2.5. i18n typo "screenter" KHÔNG tồn tại — Phase 0.5 vô nghĩa

Tài liệu claim `SocScreenerPanel.tsx:121` dùng `t("soc.screenter.scan_started")`. **Thực tế**:
- Dòng 122: `t("soc.screener.scan_symbols_required")`
- Dòng 130: `t("soc.screener.scan_queued")`

Cả hai key **đúng chính tả** và tồn tại trong `vi.js`/`en.js`. → Task 0.5 (fix typo + add key) **không cần thiết**; nếu làm sẽ sinh key thừa.

→ **Xóa Phase 0.5 khỏi kế hoạch**.

---

## 3. So sánh Legacy vs SaaS Native

### 3.1. User Screener Page

| Tính năng | Legacy (Screener.jsx) | SaaS Native (ScreenerPage.tsx) | So sánh |
|-----------|----------------------|-------------------------------|---------|
| **Dòng code** | 414 dòng | 533 dòng | SaaS dài hơn (inline styles) |
| **CRUD rule** | ✅ Đầy đủ | ✅ Đầy đủ | Tương đương |
| **Rule builder** | ✅ AND logic | ✅ AND logic | Tương đương |
| **13 technical fields** | ✅ Đầy đủ | ✅ Đầy đủ | Tương đương |
| **5 operators** | ✅ Đầy đủ | ✅ Đầy đủ | Tương đương |
| **Run screening** | ✅ Đầy đủ | ✅ Đầy đủ | Tương đương |
| **Results table** | ✅ 10 columns | ✅ 10 columns | Tương đương |
| **Color-coded values** | ✅ RSI, MACD, RVOL | ✅ RSI, MACD, RVOL | Tương đương |
| **Symbol links** | ✅ | ✅ | Tương đương |
| **Loading state** | ✅ Skeleton | ✅ Skeleton | Tương đương |
| **Empty state** | ✅ | ✅ | Tương đương |
| **Error state** | ✅ Error banner | ✅ Error banner | Tương đương |
| **Delete confirm** | ✅ `window.confirm()` | ✅ `window.confirm()` | Y hệt — cần cải thiện |
| **Type safety** | N/A (JS) | ❌ `(coreApiAdapter as any)` | **Thụt lùi** |
| **Styling** | Tailwind CSS | Inline styles | Khác nhau |
| **API layer** | `api/client.js` trực tiếp | `coreApiAdapter` | Tương đương |
| **API hoạt động** | ✅ | ❌ **404** | **Critical** |

**Tổng thể**: UI parity ~95%, nhưng backend không hoạt động → không dùng được.

### 3.2. SOC Screener Admin Panel

| Tính năng | Legacy (ScreenerPanel.jsx) | SaaS Native (SocScreenerPanel.tsx) | So sánh |
|-----------|---------------------------|-----------------------------------|---------|
| **Dòng code** | 476 dòng | 344 dòng | SaaS ngắn hơn (ít tính năng) |
| **Config view/edit** | ✅ 5 input fields | ❌ Raw JSON textarea | **Thụt lùi** |
| **Config preview** | ✅ Diff + warnings | ✅ Basic diff | Tương đương |
| **Rule CRUD** | ✅ Create/Edit/Delete modal | ❌ **Xóa được** | **Critical gap** |
| **Rule type selector** | ✅ 9 types dropdown | ❌ Không có | **Missing** |
| **Rule enable/disable** | ✅ Toggle checkbox | ❌ Không có | **Missing** |
| **Rules pagination** | ✅ 10/page | ❌ Không có | LOW |
| **Manual scan** | ✅ | ✅ | Tương đương |
| **Results display** | ✅ Full table | ✅ Top 20 scrollable | PARTIAL |
| **Alerts display** | ✅ Full table | ✅ Top 10 scrollable | PARTIAL |
| **Metrics** | ✅ 2 cards | ✅ 2 cards | Tương đương |
| **Error feedback** | ✅ Inline messages | ❌ `alert()` | **Thụt lùi** |
| **i18n** | ✅ Correct | ✅ Đúng | Tương đương |
| **Styling** | Tailwind CSS | SOC glassmorphism (CSS modules) | SaaS đẹp hơn |

**Tổng thể**: SaaS native thụt lùi so với legacy ở config form và rule CRUD.

---

## 4. So sánh với phần mềm thương mại

### 4.1. Bảng so sánh tính năng

| Tính năng | VNInvest (hiện tại) | TradingView | Finviz Elite | StockRover | TrendSpider |
|-----------|-------------------|-------------|-------------|------------|-------------|
| **Giá/tháng** | Miễn phí | $12-60 | $39.50 | $7.95-37.95 | $39-79 |
| **Tổng số filters** | 31 (technical + whale) | 100+ | 60+ | 550+ | 80+ |
| **Technical indicators** | 5 (RSI, SMA, MACD, Mom, RVol) | ✅ Đầy đủ | ✅ Đầy đủ | ✅ Đầy đủ | ✅ Đầy đủ + AI |
| **Fundamental filters** | ❌ Không có | ✅ Có | ✅ Có | ✅ Mạnh nhất | ❌ Cơ bản |
| **Whale/Dark pool** | ✅ **DUY NHẤT** | ❌ | ❌ | ❌ | ❌ |
| **AI scoring** | ⏳ Đã kế hoạch | ❌ | ❌ | ❌ | ✅ Pattern recognition |
| **AND/OR/NOT logic** | AND only | AND/OR/NOT | AND/OR/NOT | AND/OR | AND/OR/NOT |
| **Sortable columns** | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Column customization** | ❌ Fixed 10 | ✅ Full | ✅ Full | ✅ Full | ✅ Full |
| **CSV/Excel export** | ❌ | ✅ | ✅ Elite | ✅ | ✅ |
| **Pre-built templates** | ❌ | ✅ Community | ✅ 30+ | ✅ 30+ | ✅ 20+ |
| **Saved screens** | ✅ Cơ bản | ✅ Pin board | ✅ Có | ✅ Có | ✅ Có |
| **Scheduled scanning** | ❌ | ✅ Alerts | ✅ Alerts | ✅ Alerts | ✅ Alerts |
| **Email/webhook alerts** | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Backtesting** | ❌ | ✅ Strategy tester | ✅ | ❌ | ✅ |
| **Heat map** | Portfolio only | ✅ | ✅ | ❌ | ❌ |
| **Multi-condition** | AND only | AND/OR/NOT | AND/OR/NOT | AND/OR | AND/OR/NOT |
| **Real-time results** | ❌ | ✅ | ✅ Elite | ✅ | ✅ |
| **Thị trường Việt Nam** | ✅ **Tập trung** | ❌ Hạn chế | ❌ | ❌ | ❌ |

### 4.2. Điểm mạnh riêng của VNInvest (Unique Selling Points)

**1. Whale & Dark Pool screening** — KHÔNG có nền tảng thương mại nào có:
- `whale_intensity`, `whale_net_value`, `whale_buy_pct`, `whale_sell_pct`
- `dark_flow_strength`, `dark_flow_cvd`, `dark_flow_signal_count`
- Đây là lợi thế cạnh tranh lớn nhất, cần tận dụng

**2. AI Advisory scoring 0-100** — Đã có kế hoạch từ 2026-04-25:
- `ai_score_0_100`, `strategy_action`, `risk_level`, `synthesis_text`
- Chưa implement, nhưng là tính năng độc đáo

**3. SOC admin panel** — Enterprise-grade:
- Config management, global rules, manual scan, metrics
- Các nền tảng thương mại không có

**4. Multi-tenant isolation** — SaaS-ready:
- FK đến `user` + `tenant`
- Ownership matrix, permission control

**5. Vietnamese market focus**:
- HOSE, HNX, UPCOM — dữ liệu chuyên biệt
- Giao diện tiếng Việt đầy đủ

### 4.3. Khoảng trống cần lấp đầy (Priority)

| Priority | Tính năng | Lý do |
|----------|----------|-------|
| **P0** | Backend URL fix | Screener không dùng được |
| **P1** | Fundamental filters (PE, Market Cap, Dividend) | User cần filter cơ bản |
| **P1** | Sortable + paginated results table | UX cơ bản |
| **P1** | CSV export | User cần xuất dữ liệu |
| **P1** | Pre-built templates (10+ mẫu) | User mới có thể bắt đầu nhanh |
| **P2** | OR/NOT operators | Filter linh hoạt hơn |
| **P2** | Column customization | UX nâng cao |
| **P2** | Scheduled scanning + alerts | Automate workflow |
| **P3** | AI scoring | Tính năng độc đáo |
| **P3** | Backtesting | Validation strategy |

---

## 5. Phân tích mã nguồn chi tiết

### 5.1. Backend — user_workspace/urls.py

**File**: `packages/core/backend/src/user_workspace/urls.py`

Phân tích:
- File chứa `simple_router` với các view sets (UserPreferences, Watchlists, Portfolios, Transactions, Symbols, v.v.)
- Screener rules views được define trong `portfolio_analytics_views.py` nhưng không được import ở urls.py
- Các views tồn tại:
  - `ScreenerRuleListCreateAPIView` — GET list, POST create
  - `ScreenerRuleDetailView` — GET, PUT, DELETE single rule
  - `ScreenerRuleRunView` — POST run screening

**Cần thêm**:
```python
from .portfolio_analytics_views import (
    ScreenerRuleListCreateAPIView,
    ScreenerRuleDetailView,
    ScreenerRuleRunView,
)
```

### 5.2. Frontend — ScreenerPage.tsx

**File**: `packages/web/src/pages/ScreenerPage.tsx` (533 dòng)

Cấu trúc:
```
ScreenerPage (exported function component)
├── State: rules, loading, editing, running, results, error
├── loadRules() — useCallback fetch rules
├── useEffect — load rules on mount
├── handleSave() — create/update rule
├── handleDelete() — delete rule with window.confirm
├── handleRun() — run screening rule
└── Render
    ├── Header (title + subtitle + Create Rule button)
    ├── Error banner (dismissable)
    ├── RuleEditor (when editing)
    ├── Loading skeleton (2 pulse items)
    ├── Empty state
    ├── Rule list (cards)
    └── ResultsTable

Inline components:
├── ConditionRow — field select + operator select + value input + delete
├── RuleEditor — rule name + conditions list + save/cancel
└── ResultsTable — 10-column table with color coding
```

**Technical debt**:
- `(coreApiAdapter as any)` — 5 occurrences (lines 338, 352, 354, 367, 380)
- `window.confirm()` — line 365
- `css` properties as inline styles — không tái sử dụng
- Không có error boundary

### 5.3. Frontend — SocScreenerPanel.tsx

**File**: `packages/web/src/components/soc/SocScreenerPanel.tsx` (344 dòng)

Cấu trúc:
```
SocScreenerPanel (exported function component)
├── State (13): loading, error, config, editConfig, rules, results, alerts, metrics,
│              previewModal, applying, manualSymbols, scanning
├── fetchData() — Promise.all 5 API calls
├── useEffect — fetch on mount
├── handlePreview() — parse JSON, show diff
├── handleApply() — apply config
├── handleManualScan() — split symbols, call API
├── handleDeleteRule() — window.confirm + delete
├── renderMetricCard() — helper factory
└── Render (createElement pattern)
    ├── ShellPanel wrapper
    ├── Config section (JSON textarea + Preview/Edit buttons)
    ├── Rules table (name, type, enabled, delete)
    ├── Manual scan (input + button)
    ├── Results + Alerts grid (scrollable lists)
    └── Metrics grid (2 cards)
```

**Gaps vs legacy**:
- Config: JSON textarea → thiếu 5 input fields, validation, error messages
- Rules: chỉ có delete → thiếu create/edit modal, rule type selector, enabled toggle
- Feedback: `alert()` (**6 lần**) + `window.confirm()` (1 lần) → thiếu Toast + ConfirmModal

### 5.4. Type declarations mâu thuẫn

**File 1**: `packages/web/src/adapters/coreApiAdapter.d.ts` (dòng 115-121)
```typescript
interface CoreApiAdapter {
  // Screener (WRONG — "presets" model)
  getScreenerPresets: () => Promise<ScreenerRule[]>;
  createScreenerPreset: (rule: Omit<ScreenerRule, 'id'>) => Promise<ScreenerRule>;
  updateScreenerPreset: (id: number, rule: Partial<ScreenerRule>) => Promise<ScreenerRule>;
  deleteScreenerPreset: (id: number) => Promise<void>;
  runScreener: (id: number) => Promise<ScreenerResult>;
  getScreenerResults: (id: number) => Promise<ScreenerResult>;
}
```

**File 2**: `packages/web/src/declarations.d.ts` (dòng 32-37)
```typescript
declare module './adapters/coreApiAdapter.js' {
  interface CoreApiAdapter {
    // Screener (CORRECT — "rules" model)
    getScreenerRules: () => Promise<ScreenerRule[]>;
    createScreenerRule: (rule: Omit<ScreenerRule, 'id'>) => Promise<ScreenerRule>;
    updateScreenerRule: (id: number, rule: Partial<ScreenerRule>) => Promise<ScreenerRule>;
    deleteScreenerRule: (id: number) => Promise<void>;
    runScreenerRule: (id: number) => Promise<ScreenerResult>;
  }
}
```

**Vấn đề**: Module augmentation trong `declarations.d.ts` override `coreApiAdapter.d.ts`. TypeScript compiler dùng cái nào? Tùy import path. Nếu import từ `'../adapters/coreApiAdapter.js'`, augmentation được áp dụng. Nhưng nếu compiler dùng `.d.ts` trực tiếp, "presets" model được dùng. **Không nhất quán**.

**Hậu quả**: Lập trình viên phải dùng `as any` để an toàn — mất toàn bộ type safety.

### 5.5. Route & Navigation

**SaaS native routing**:
```
main.tsx (line 77)
├── Route path: 'screener'
└── element: createElement(resolvePageComponent('screener'))
    └── pageRegistry.js → ScreenerPage.tsx

sidebaritems.ts (line 10)
└── { labelKey: 'layout.nav.screener', path: '/screener', icon: 'Search' }
```

**Missing**:
- `routeCatalog.js` — không có entry (24 routes khác đều có)
- `navigationCatalog.js` — không có entry

**Tác động**: Không thể:
- Filter screener theo build target (core/enterprise/lite)
- Gate screener theo capability/role
- Generate sitemap/tour guide tự động

---

## 6. Kiến trúc mục tiêu

### 6.1. Component Tree (Proposed)

```
packages/web/src/
│
├── pages/
│   ├── ScreenerPage.tsx          (refactor → thin orchestrator)
│   └── admin/
│       └── ShellOperationsCenterPage.tsx  (screener tab — hiện tại OK)
│
├── components/
│   └── screener/                              ★ NEW directory
│       ├── ScreenerFilterBuilder.tsx           ★ Multi-condition filter UI (AND/OR/NOT)
│       ├── ScreenerResultsTable.tsx            ★ Sortable, paginated, customizable columns
│       ├── ScreenerTemplates.tsx               ★ Pre-built template grid (10+ mẫu)
│       ├── ScreenerExport.tsx                  ★ CSV/Excel export
│       ├── ScreenerSchedule.tsx                ★ Scheduled scan config
│       ├── ScreenerScoreCard.tsx               ★ AI score badge
│       └── soc/
│           ├── SocScreenerPanel.tsx            (refactor — integrate modal + form)
│           ├── SocScreenerRuleModal.tsx         ★ Rule CRUD modal
│           └── SocScreenerConfigForm.tsx        ★ Structured config form
│
├── adapters/
│   └── core/
│       ├── screener.js           (user-facing API — OK)
│       └── soc.js                (SOC admin API — OK)
│
└── types/
    └── screener.d.ts             ★ NEW unified type declarations
```

### 6.2. API Surface (Target)

**User-facing (Portfolio)**:
```
GET    /api/portfolio/screener/rules/                → list rules
POST   /api/portfolio/screener/rules/                → create rule
GET    /api/portfolio/screener/rules/{id}/            → get rule
PUT    /api/portfolio/screener/rules/{id}/            → update rule
DELETE /api/portfolio/screener/rules/{id}/            → delete rule
POST   /api/portfolio/screener/rules/{id}/run/        → run screening
GET    /api/portfolio/screener/templates/             → list templates (★ NEW)
GET    /api/portfolio/screener/history/               → run history (★ NEW)
POST   /api/portfolio/screener/export/               → export results (★ NEW)
```

**SOC Admin** (đã có, cần bổ sung):
```
GET    /api/soc/screener/config/
POST   /api/soc/screener/config/
GET    /api/soc/screener/rules/
POST   /api/soc/screener/rules/
PUT    /api/soc/screener/rules/{id}/
DELETE /api/soc/screener/rules/{id}/delete/
GET    /api/soc/screener/results/
GET    /api/soc/screener/alert-history/
POST   /api/soc/screener/manual-scan/
GET    /api/soc/screener/ownership/
GET    /api/soc/screener/templates/
GET    /api/soc/screener/metrics/
```

### 6.3. Data Flow

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Browser    │────→│  Core API        │────→│  Backend Views  │
│  Screener   │     │  Adapter Layer   │     │  (Django REST)  │
│  Component  │←────│  (TypeScript)    │←────│  + helpers      │
└─────────────┘     └──────────────────┘     └────────┬────────┘
                                                       │
                                               ┌───────▼────────┐
                                               │ SymbolSnapshot │
                                               │ + DailyPrice   │
                                               │ + SessionFacts │
                                               └────────────────┘
```

Luồng chạy screening:
1. User click "Run" → `POST /screener/rules/{id}/run/`
2. Backend đọc rule conditions từ DB (`ScreenerRule.rules_json`)
3. Query `DailyPrice` + `SessionFacts` (qua `SymbolSnapshot` như `PortfolioScreenerRuleRunView` hiện tại)
4. Compute technical indicators (`screener_helpers.py`)
5. Apply conditions (AND/OR/NOT logic)
6. Compute AI advisory (helper mới, chưa có — Phase 3.1) — optional
7. Return `matched[]` + `matched_count` + `total_scanned`

---

## 7. Kế hoạch thực hiện 4 Pha

### Phase 0 — Sửa lỗi backend + type cleanup (1-2 ngày)

**Mục tiêu**: Screener có thể hoạt động cơ bản (CRUD rules + run screening).

| # | Task | File | Thời gian |
|---|------|------|-----------|
| 0.1 | Thêm `path()` cho 3 screener views | `user_workspace/urls.py` | 0.5 ngày |
| 0.2 | Sửa type declarations (presets → rules) | `coreApiAdapter.d.ts` | 0.5 ngày |
| 0.3 | Remove `as any` casts trong ScreenerPage | `ScreenerPage.tsx` | 0.3 ngày |
| 0.4 | Add SOC screener methods to d.ts | `coreApiAdapter.d.ts` | 0.3 ngày |
| 0.5 | Add screener to route + nav catalogs | `routeCatalog.js` + `navigationCatalog.js` | 0.2 ngày |
| 0.6 | Verification: tsc + build + test | — | 0.2 ngày |

**Rủi ro**: Fix URL patterns có thể ảnh hưởng SOC endpoints nếu shared namespace. Cần test cả user + SOC paths.

---

### Phase 1 — Legacy Parity (5-7 ngày)

**Mục tiêu**: Đạt feature parity với legacy, fix các UX regression.

| # | Task | File | Thời gian |
|---|------|------|-----------|
| 1.1 | SOC Rule CRUD Modal | `SocScreenerRuleModal.tsx` (NEW) | 1.5 ngày |
| 1.2 | Add rule create/edit buttons + pagination | `SocScreenerPanel.tsx` | 1 ngày |
| 1.3 | Structured config form (thay JSON textarea) | `SocScreenerConfigForm.tsx` (NEW) | 1 ngày |
| 1.4 | Replace alert() + window.confirm() | `SocScreenerPanel.tsx` + `ScreenerPage.tsx` | 1.5 ngày |
| 1.5 | Remove `as unknown as` casts | `SocScreenerPanel.tsx` | 0.5 ngày |
| 1.6 | Verification | — | 0.5 ngày |

**Chi tiết task 1.1 — Rule Modal**:
- Tên rule input (text, required, max 100 chars)
- Rule type dropdown (9 types: `price_change_pct`, `volume_spike_ratio`, `cvd_threshold`, `whale_count`, `dark_pool_ratio`, `rsi_level`, `ma_cross`, `bollinger_band_break`, `custom`)
- Value JSON textarea (syntax validated)
- Enabled/disabled toggle
- Create mode / Edit mode (reuse component)
- Confirm/Cancel buttons
- Style: `createElement` pattern, `soc.module.css` tokens

**Chi tiết task 1.3 — Config Form**:
- 5 number inputs với labels, min/max, units
  - Chu kỳ quét (giây): min 30
  - Số mã tối đa/lần: min 1, max 5000
  - Thời gian báo lại (giây): min 60
  - Báo cáo/mã/giờ: min 1
  - Thời gian lưu kết quả (giờ): min 1
- Inline validation
- JSON editor as "Nâng cao" collapsible
- Preview + Apply buttons

**Chi tiết task 1.4 — Toast + ConfirmModal**:
- Cần kiểm tra xem app đã có Toast component chưa (`useToast` hook?)
- Nếu chưa: tạo `Toast.tsx` với info/success/error/warning variants
- Thay thế `alert()` ở **6 vị trí** trong SocScreenerPanel
- Thay thế `window.confirm()` trong cả SocScreenerPanel + ScreenerPage

---

### Phase 2 — Tính năng thương mại (10-14 ngày)

**Mục tiêu**: Vượt legacy, tiến gần commercial platforms.

| # | Task | Thời gian | Mô tả |
|---|------|-----------|-------|
| 2.0 | **Audit nguồn dữ liệu cơ bản** | 2-3 ngày | **NEW**: Xác định nguồn PE/EPS/Market Cap/Dividend (bảng nào, API nào, có migration không) — phải xong trước 2.1 |
| 2.1 | Expanded filters — Backend | 2 ngày | Thêm 13 fields mới (fundamental + advanced technical) — *phụ thuộc 2.0* |
| 2.2 | Expanded filters — Frontend | 2 ngày | Grouped field dropdown, AND/OR/NOT logic |
| 2.3 | Results table upgrade | 2 ngày | Sortable columns, column picker, pagination, sparklines |
| 2.4 | CSV/Excel export | 1 ngày | Export button, xlsx library |
| 2.5 | Pre-built templates | 1.5 ngày | 10 templates grid + apply — *phụ thuộc 2.0 (data availability)* |
| 2.6 | Scheduled scanning — Backend | 2 ngày | Celery beat + schedule fields |
| 2.7 | Scheduled scanning — Frontend | 1 ngày | Schedule UI + alert integration |
| 2.8 | Verification | 1 ngày | — |

**Chi tiết task 2.1 — Expanded fields**:

**Fundamental (6 fields)**:
| Field | Label | Compute từ |
|-------|-------|-----------|
| `pe_ratio` | P/E Ratio | `close / eps` |
| `market_cap` | Vốn hóa | `close * shares_outstanding` |
| `dividend_yield` | Cổ tức % | `dividend_per_share / close * 100` |
| `eps_growth_yoy` | EPS growth % | `(eps_current - eps_last_year) / eps_last_year * 100` |
| `revenue_growth_yoy` | Doanh thu growth % | `(revenue_current - revenue_last_year) / revenue_last_year * 100` |
| `debt_to_equity` | D/E Ratio | `total_debt / total_equity` |

**Advanced technical (7 fields)**:
| Field | Label | Công thức |
|-------|-------|-----------|
| `stochastic_k` | Stochastic %K | `(close - low_14) / (high_14 - low_14) * 100` |
| `stochastic_d` | Stochastic %D | SMA(%K, 3) |
| `atr_14` | ATR(14) | Average True Range 14 periods |
| `adx_14` | ADX(14) | Average Directional Index |
| `bollinger_width` | Bollinger Width | `(upper - lower) / middle * 100` |
| `vwap` | VWAP | `Σ(price * volume) / Σ(volume)` |
| `mfi_14` | MFI(14) | Money Flow Index |

**Tổng cộng**: 31 (hiện tại) + 13 = **44 allowed fields**.

**Chi tiết task 2.5 — Templates (10 mẫu)**:

| Tên mẫu | Mô tả | Category | Conditions |
|---------|-------|----------|------------|
| 📉 Oversold Bounce | RSI < 30, khối lượng tăng | Kỹ thuật | RSI(14) < 30 AND Volume > SMA20 |
| 📈 Golden Cross | SMA20 cắt lên SMA50 | Kỹ thuật | SMA20 vs SMA50% > 0 |
| 🚀 Momentum Breakout | Giá > SMA20, Momentum > 5% | Kỹ thuật | Price vs SMA20% > 0 AND Momentum > 5% |
| 🔥 Volume Anomaly | RVOL > 3x, giá thay đổi > 2% | Kỹ thuật | RVOL > 3x AND |Price change| > 2% |
| 🐋 Whale Accumulation | Cá voi mua ròng | Cá voi | Whale net value > 0 |
| 🌊 Dark Pool Signal | Dark pool strength cao | Cá voi | Dark flow strength > 2 |
| 💰 High Dividend | Cổ tức cao, PE thấp | Cơ bản | Dividend yield > 3% AND PE < 20 |
| 🚀 Small Cap Growth | Vốn hóa nhỏ, tăng trưởng cao | Cơ bản | Market cap < 500B AND EPS growth > 20% |
| 📊 Range Trader | Gần đáy/đỉnh 52 tuần | Kỹ thuật | Range position < 20% OR > 80% |
| 🔷 Trend Follower | Xu hướng tăng + volume | Kết hợp | SMA20 > SMA50 AND Momentum > 0% AND RVOL > 1.5x |

---

### Phase 3 — AI Features (5-7 ngày)

**Mục tiêu**: Vượt commercial platforms với AI-powered analysis.

| # | Task | Thời gian | Mô tả |
|---|------|-----------|-------|
| 3.1 | AI Advisory — Backend | 3-4 ngày | **Tạo `ai_advisory_helpers.py` từ đầu** + enrich response (tăng từ 2 ngày do build từ 0) |
| 3.2 | AI Score UI | 1.5 ngày | Score badge, strategy action, tooltip |
| 3.3 | Performance Analytics | 2 ngày | Run history, win rate, basic backtesting |
| 3.4 | Verification | 1 ngày | — |

**Chi tiết task 3.1 — AI Advisory**:
- **Tạo mới `ai_advisory_helpers.py` từ đầu** (file không tồn tại)
- Tính `ai_score_0_100` từ signal confluence (RSI, MACD, Momentum, Volume)
- Map thành `strategy_action: BUY/SELL/HOLD/STAND_ASIDE`
- Fallback: nếu AI helper fail, trả `ai_advisory: null`
- Theo plan `IMPLEMENTATION_PLAN_SCREEENER_AI_SCORE_20260425.md` (đề xuất helper nhưng chưa implement)

**Chi tiết task 3.2 — Score Card**:
```
┌──────────────────────┐
│  ⬤ AI Score: 82     │  Màu: xanh (>70), vàng (40-70), đỏ (<40)
│  BUY (Confidence: 80%)│  BUY=xanh, SELL=đỏ, HOLD=vàng
│  "RSI oversold +     │  Tooltip text
│   momentum positive" │
└──────────────────────┘
```

---

## 8. Rủi ro và giảm thiểu

| Rủi ro | Tác động | Khả năng | Giảm thiểu |
|--------|---------|---------|------------|
| **Backend URL fix break SOC endpoints** | SOC screener ngừng hoạt động | Thấp (URLs khác namespace) | Test cả user + SOC paths sau khi sửa |
| **Expand fields làm chậm scan performance** | User chờ lâu | Trung bình | Pagination, async scan, caching |
| **Template conflicts với rule model** | Dữ liệu không nhất quán | Thấp | Templates frontend-only ở phase đầu |
| **Scheduled scanning tăng tải server** | Server overload | Trung bình | Rate limiting, Redis queue |
| **AI scoring tăng latency scan** | UX chậm | Trung bình | Async enrichment, non-blocking |
| **Type declaration fix gây compile error** | Build fail | Thấp | Test `npx tsc --noEmit` kỹ trước merge |
| **Thiếu AI helper sẵn có** (Phase 3 premise sai) | Phase 3 delay 1-2 ngày | **Cao** | Xác nhận sớm, build từ đầu trong Phase 3.1 |
| **Fundamental data cần nguồn mới** (DailyPrice thiếu fields) | Phase 2.1/2.5 không chạy được | **Cao** | Task P2.0 audit data source trước Phase 2.1 |
| **Thiếu fundamental data source** | Không thể compute filters | Cao (cần xác nhận) | Audit data availability trước phase 2 |
| **Thiếu AI helper sẵn có (`ai_advisory_helpers.py`)** | Phase 3 delay, phải build từ đầu | Cao | Đưa việc tạo helper vào Phase 3.1, tăng buffer thời gian |

---

## 9. Câu hỏi thảo luận

### Về phạm vi:

1. **Mức độ ưu tiên**: Nên tập trung Phase 0 + 1 (làm screener hoạt động + legacy parity) trước, hay nên làm luôn Phase 2 (commercial features)?

2. **Expanded filters**: Có sẵn dữ liệu fundamental (PE, EPS, Market Cap) trong `DailyPrice` hay cần nguồn khác? Cần audit data availability.

3. **Templates**: Nên làm frontend-only (template = preset conditions) hay có backend API lưu template?

### Về thiết kế:

4. **Component structure**: Nên refactor ScreenerPage.tsx thành nhiều components nhỏ (như đề xuất) hay giữ nguyên structure hiện tại, chỉ thêm tính năng?

5. **Scheduled scanning**: Nên dùng Celery beat hay Redis scheduler? Hiện tại app đang dùng gì cho background tasks?

6. **Type declarations**: Giải pháp nào tốt nhất — sửa `coreApiAdapter.d.ts`, hay bỏ hẳn dùng `declarations.d.ts` augmentation?

### Về AI:

7. **AI scoring**: Mức độ phức tạp — nên dùng rule-based (deterministic, như đề xuất) hay machine learning model?

8. **Backtesting**: Có cần thiết không? Nếu có, cần dữ liệu lịch sử bao nhiêu năm?

### Về data:

9. **Fundamental data**: Cần confirm — `DailyPrice` có chứa PE, EPS, Market Cap, Dividend Yield cho từng symbol không? Nếu không, cần nguồn dữ liệu nào?

10. **Export**: Nên support CSV (đơn giản) hay cả Excel (cần thư viện)? User preference?

### Về timeline:

11. **Resource allocation**: Có dev nào available để làm không? Cần bao nhiêu người cho timeline này?

12. **Dependencies**: Phase 0 cần merge trước. Có ai review được không?

---

## Phụ lục A — File changes summary

### Phase 0 (Critical — 5 files)

| File | Action | Dòng |
|------|--------|------|
| `user_workspace/urls.py` | EDIT | +12 dòng (import + `path()` cho 3 views) |
| `coreApiAdapter.d.ts` | EDIT | Replace 5 methods, add 8 methods |
| `ScreenerPage.tsx` | EDIT | Remove `as any` casts (5 places) |
| `routeCatalog.js` | EDIT | Add screener entry |
| `navigationCatalog.js` | EDIT | Add screener entry |

### Phase 1 (Legacy Parity — 5 files, 2 new)

| File | Action |
|------|--------|
| `SocScreenerRuleModal.tsx` | **NEW** — ~120 dòng |
| `SocScreenerConfigForm.tsx` | **NEW** — ~100 dòng |
| `SocScreenerPanel.tsx` | EDIT — integrate modal + form |
| `ScreenerPage.tsx` | EDIT — replace window.confirm |
| `soc.module.css` | EDIT — add modal styles |

### Phase 2 (Commercial — 9 files, 5 new)

| File | Action |
|------|--------|
| `screener.d.ts` | **NEW** — ~80 dòng types |
| `ScreenerFilterBuilder.tsx` | **NEW** — ~200 dòng |
| `ScreenerResultsTable.tsx` | **NEW** — ~250 dòng |
| `ScreenerExport.tsx` | **NEW** — ~80 dòng |
| `ScreenerTemplates.tsx` | **NEW** — ~150 dòng |
| `screener_helpers.py` | EDIT — +13 fields + computations |
| `portfolio_analytics_views.py` | EDIT — +templates + export endpoints |
| `ScreenerRule` model | EDIT — +schedule fields + migration |

### Phase 3 (AI — 4 files, 3 new)

| File | Action |
|------|--------|
| `ai_advisory_helpers.py` | **NEW** — build from scratch (file chưa tồn tại) |
| `ScreenerScoreCard.tsx` | **NEW** — ~100 dòng |
| `ScreenerHistory.tsx` | **NEW** — ~120 dòng |
| `ScreenerSchedule.tsx` | **NEW** — ~150 dòng |

---

## Phụ lục B — Glossary

| Thuật ngữ | Giải thích |
|-----------|-----------|
| **Screener** | Công cụ lọc cổ phiếu theo điều kiện kỹ thuật/cơ bản |
| **Condition** | Một điều kiện lọc (field + operator + value) |
| **Rule** | Bộ điều kiện (1+ conditions với AND/OR logic) |
| **Template** | Rule mẫu có sẵn (pre-built) |
| **SOC** | Service Operations Center — admin panel |
| **Matched count** | Số cổ phiếu thỏa mãn điều kiện |
| **Scan** | Quá trình chạy screening rule trên toàn bộ thị trường |
| **Scheduled scan** | Quét tự động theo lịch (hàng giờ/ngày/tuần) |
| **AI score** | Điểm AI 0-100 đánh giá cơ hội mua/bán |
| **Whale** | Giao dịch lớn (cá voi) |
| **Dark pool** | Giao dịch khớp lệnh không công khai |
| **RVOL** | Relative Volume — khối lượng tương đối so với trung bình |
| **SMA** | Simple Moving Average — đường trung bình động |
| **RSI** | Relative Strength Index — chỉ số sức mạnh tương đối |
| **MACD** | Moving Average Convergence Divergence — chỉ báo động lượng |
| **MDSU** | Market Data Service Unification — chương trình chuẩn hóa dữ liệu thị trường |

---

## Phụ lục C — Verification checklist (cho mỗi phase)

### Phase 0 Checklist
- [ ] `GET /api/portfolio/screener/rules/` — trả về 200 (empty list) ✅
- [ ] `POST /api/portfolio/screener/rules/` — tạo rule thành công ✅
- [ ] `GET /api/portfolio/screener/rules/{id}/` — trả về rule detail ✅
- [ ] `PUT /api/portfolio/screener/rules/{id}/` — update rule ✅
- [ ] `DELETE /api/portfolio/screener/rules/{id}/` — delete rule ✅
- [ ] `POST /api/portfolio/screener/rules/{id}/run/` — chạy screening ✅
- [ ] `npx tsc --noEmit` — zero errors ✅
- [ ] `npm run build` — success ✅
- [ ] `npm run test` — screener tests pass ✅
- [ ] SOC endpoints không bị ảnh hưởng ✅

### Phase 1 Checklist
- [ ] SOC rule modal — create/edit/delete hoat dong ✅
- [ ] SOC config form — 5 input fields + validation ✅
- [ ] Không còn `alert()` trong SOC panel ✅
- [ ] Không còn `window.confirm()` trong screener ✅
- [ ] Không còn `as unknown as` casts ✅
- [ ] i18n: tất cả keys đều resolve ✅

### Phase 2 Checklist
- [ ] 20+ technical filters hoat dong ✅
- [ ] 6 fundamental filters hoat dong ✅
- [ ] AND/OR/NOT operators hoat dong ✅
- [ ] Sortable columns (click header) ✅
- [ ] Column picker (show/hide columns) ✅
- [ ] Pagination (25/50/100) ✅
- [ ] CSV export hoat dong ✅
- [ ] 10 pre-built templates hoat dong ✅
- [ ] Scheduled scanning — tạo schedule, chạy auto ✅
- [ ] Email notification (configurable) ✅

### Phase 3 Checklist
- [ ] AI score 0-100 hiển thị trên mỗi symbol ✅
- [ ] Strategy action badge (BUY/SELL/HOLD) ✅
- [ ] Tooltip với synthesis text ✅
- [ ] Run history (last 20 runs) ✅
- [ ] Win rate calculator ✅
- [ ] Basic backtesting ✅

---

*Tài liệu này được tạo để phục vụ thảo luận và ra quyết định. Các thông tin kỹ thuật dựa trên mã nguồn thực tế tại thời điểm 2026-07-10.*

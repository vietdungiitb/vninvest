# KẾ HOẠCH THIẾT KẾ & TRIỂN KHAI FRONTEND PORTFOLIO — BÀN GIAO CHO ĐỘI CODE

> **Vai trò:** System Design + Team Code Leader
> **Ngày lập:** 2026-10-07 · **Baseline:** `dev @ c07fc0eec`
> **Phạm vi:** Wave 3 — 5 trang workspace portfolio (Overview · Holdings · Activity · Analytics · Allocation)
> **Ước lượng:** ~33 ed · 12 slice · 6 wave
> **Bản này thay thế bản 2026-10-07 v1** — v1 tự chế 9 gate, v2 dùng đúng **GT1–GT15** của kế hoạch master.

---

## 0. NGUỒN TRÍCH DẪN

> Plan này **không phát minh yêu cầu mới**. Mọi AC lấy từ tài liệu gốc, trích `file:line` đã **verify**.

| Mã | Tài liệu | Dùng cho | Quy mô |
|---|---|---|---|
| **[S1]** | `docs/archive/docs-flat/portfolio_exec_slices/PORTFOLIO_EXEC_SLICES_LEDGER_FE_20260927.md` | **AC gốc FE-01..08** (R / AC / PB / Test / Evidence) | 652 dòng |
| **[S2]** | `docs/archive/docs-flat/portfolio_ui_ux/PORTFOLIO_UI_UX_DESIGN_SPEC_20260927.md` | Palette · layout · ràng buộc widget · 11 rủi ro · quyết định chốt | 1.729 dòng |
| **[S3]** | `docs/PORTFOLIO_EXEC_PLAN_MASTER_20260927.md` | 61 slice · **bảng gate GT1–GT15** · D-19/D-31/D-36 · cạm bẫy gate | 369 dòng |
| **[S4]** | `docs/IMPLEMENTATION_PLAN_PORTFOLIO_COMMERCIAL_HARDENING_20260925.md` | Kiến trúc target · DAG · test catalog · release/canary/rollback | 1.100+ |
| **[S5]** | `docs/AUDIT_PORTFOLIO_COMMERCIAL_REDESIGN_20260925.md` | Audit hiện trạng · roadmap wave · AC từng wave | 1.296 |
| **[S6]** | `docs/PORTFOLIO_COMMERCIAL_UPGRADE_PROPOSAL_20260927.md` | Kiến trúc đề xuất · tính năng theo nhóm · rủi ro | 645+ |
| **[S7]** | `docs/evidence/portfolio-commercial/AUDIT_PORTFOLIO_20261005.md` | Audit 2026-10-05 (7 P0 đã merge) | 16.761 B |
| **[S8]** | `docs/UI_RESEARCH_COMMERCIAL_PORTFOLIO_PLATFORMS.md` | Nghiên cứu đối thủ | 27.585 B |
| **[S9]** | `docs/DOI_CHIEU_PLAN_BACKEND_FRONTEND_PORTFOLIO_20261007.md` | Đo plan↔code↔UI thực tế | 317 |

### 0.1 Điểm khác biệt so với bản v1 (đã đọc thêm tài liệu)

| V1 tự chế | V2 dùng bảng gốc |
|---|---|
| 9 gate tự nghĩ | **GT1–GT15** từ [S3]:103-118 |
| Không có phản biện | **21 Phản biện bắt buộc (PB)** từ [S1] |
| 13 cột Holdings tự đoán | **R1 của FE-03** [S1]:482 |
| Không có cạm bẫy gate | 3 cạm bẫy từ [S3] (pipe, SQLite, worktree) |

---

## 1. PHẠM VI

### 1.1 Quyết định của Owner (2026-10-07)

| # | Quyết định | Ảnh hưởng |
|---|---|---|
| 1 | License `vnbroker` là của Owner | Live mở khoá — **không** nằm trong plan này |
| 2 | **Chưa có API key broker ⇒ live trading để sau** | Phạm vi = FE + read path |
| 3 | Dev local, merge thẳng `dev`, **không dùng CI GitHub** | GT1–GT15 chạy **local** |
| 4 | Cho sửa `packages/web/package.json` | Mở đường widget 1.4.0 |

### 1.2 Quyết định thiết kế đã chốt (không hỏi lại)

| Quyết định | Nội dung | Nguồn |
|---|---|---|
| **D-31** | `vninvestcharts-widget` cho **mọi** chart trục thời gian. ECharts **chỉ** treemap/sunburst | [S3]:78 |
| **D-36** | 5 trang workspace. Broker Hub tách riêng | [S3]:83 |
| **D-19** | `test:components` chạy **3 lần liên tiếp** cùng commit, cả 3 xanh mới kỹ release | [S3]:66 |
| 1 engine | Dùng 2 engine tạo **2 UX khác nhau trên 1 trang** | [S2]:1711 |
| Widget version | 1.2.5 **đủ** `Line`/`Area`/`Comparison` — verify trong `dist` | [S2]:306-317 |

### 1.3 Ngoài phạm vi

| Ngoài | Lý do |
|---|---|
| **Live trading** (LIV-01..05) | Owner: chưa có API key broker |
| **Broker Hub / OrderTicket** | Cần `VirtualBrokerEngine` — **0 match** trong repo |
| **Nâng widget 1.4.0** | [S2]:317 — 1.2.5 đủ cho Wave 2 |
| CI GitHub | Owner chủ động tắt |

---

## 2. BỐI CẢNH — Backend sẵn sàng

### 2.1 API ↔ trang (đo 2026-10-07)

| Trang | Endpoint | Adapter | Trạng thái |
|---|---|---|---|
| **Overview** | `portfolios/{id}/summary/` | `getPortfolioSummary` | ⚠ chỉ `WatchlistContext` |
| **Overview** | `portfolios/{id}/analytics/` | `getPortfolioAnalytics` | ✅ adapter, ❌ UI chưa gọi |
| **Overview** | `portfolios/{id}/equity-curve/` | ❌ | 🔴 **thiếu route** |
| **Overview** | `portfolios/{id}/allocation/` | ❌ | 🔴 **thiếu route** |
| **Holdings** | `portfolios/{id}/holdings/` | `getPortfolioHoldings` | ✅ adapter, ❌ UI chưa gọi |
| **Holdings** | `portfolios/{id}/technicals/` | `getPortfolioTechnicals` | ✅ adapter, ❌ UI chưa gọi |
| **Activity** | `portfolios/{id}/transactions/` | có | ⚠ chưa timeline |
| **Analytics** | `portfolios/{id}/analytics/` | `getPortfolioAnalytics` | ✅ dùng chung |
| **Allocation** | `portfolios/{id}/allocation/` | ❌ | 🔴 **thiếu route** |

### 2.2 Ba dead-code view — nguyên nhân FE-02/FE-06 chưa làm được

```
PortfolioEquityCurveView   → import trong urls.py, 0 path()   ← CÓ logic thật
PortfolioAllocationView    → import trong urls.py, 0 path()   ← CÓ logic thật
PortfolioChartView         → import trong urls.py, 0 path()   ← alias equity curve
```
Đã kiểm: `EquityCurveView.get()` dùng `_compute_holdings` + `DailyPrice` — **không phải stub**.

### 2.3 Hàm backend có sẵn

| Hàm (`ledger/analytics.py`) | Cho UI |
|---|---|
| `twr` / `mwr` / `xnpv` / `xirr` | FE-05 R5 (method selector) |
| `benchmark_metrics` | FE-05 R4 (alpha/beta) |
| `risk_metrics` | FE-05 R6 (vol, VaR, drawdown, concentration) |
| `allocation` | FE-06 R3 (group by ngành) |
| `freshness` | FE-02 R6 (cờ `stale`) |
| `valuation.py:compute_nav` | FE-02 R4 (NAV → field `close`) |
| `_compute_holdings` | FE-03 (13 cột) |

---

## 3. RÀNG BUỘC KỸ THUẬT

> Nguồn: [S2] §3.1.1-B `:319-335` + §9.6 `:1715-1729`. **Mỗi ràng buộc có 1 test.**

| # | Ràng buộc | Hậu quả nếu vi phạm | Mức | Slice |
|---|---|---|---|---|
| **T1** | `Line`/`Area` đọc giá trị từ field **`close`** | Map NAV vào `value` ⇒ **mọi bar = 0** | **CỰC** | S-03, S-05, S-08 |
| **T2** | `showNonTradingDays={false}` | Lệch trục X ở 1M/3M/6M | Cao | S-03 |
| **T3** | Benchmark dùng series **`Comparison`** | Series có `tier`, gate fail-closed | Cao | S-03 |
| **T4** | Tier + license bắt buộc | Series Pro **không render**. **Cấm giả dữ liệu** | Cao | S-03 |
| **T5** | `data?: unknown[]` (`vninvestcharts-widget.d.ts:22-23`) | Lỗi runtime im lặng | Cao | S-03 |
| **T6** | 1 engine cho chart trục thời gian; ECharts **chỉ** treemap | 2 UX trên 1 trang | Cao | S-07 |
| **T7** | Token → `soc.tokens.css`, class → `soc.components.css`. **KHÔNG** `soc.module.css` | `soc.module.css` là barrel 3 dòng, **0 token 0 class** | Cao | S-01 |
| **T8** | `tabular-nums` cho mọi số | Số không căn cột | TB | S-01 |
| **T9** | P&L không chỉ dựa vào màu (WCAG 1.4.1) — thêm dấu `+`/`−` | Không đạt a11y | Cao | S-06 |
| **T10** | Tenant SSOT qua `tenantIdStorage` | Sai tenant ⇒ cross-tenant data | Cao | S-02 |

---

## 4. BẢNG GATE — GT1..GT15 theo [S3]:103-118

| Gate | Kiểm tra | Ngưỡng | Khi nào |
|---|---|---|---|
| **GT1** | `npx tsc --noEmit` | 0 lỗi | Tất cả FE slice |
| **GT2** | `npm run build` | exit 0 | Tất cả FE slice |
| **GT3** | `npm run lint` | 0 error | Tất cả FE slice |
| **GT4** | `npm run test:components` | **3 lần liên tiếp PASS (D-19)** | Tất cả FE slice |
| **GT5** | `npm run i18n:scan` + `npm run hardcode:scan` | 0 missing, 0 hardcode | FE-* |
| **GT6** | `python src/manage.py check` | 0 issue | FE slice |
| **GT7** | `makemigrations --check --dry-run` | "No changes detected" | Slice tạo model |
| **GT8** | `migrate` trên **Postgres** | exit 0 | Slice có migration |
| **GT9** | `python src/manage.py test <app>` | 0 failure, 0 error | FE slice |
| **GT10** | `git grep -InE 'github_pat_\|ghp_\|DNSE_CREDENTIAL_FERNET_KEY=[A-Za-z0-9]' -- . ':!*.example'` | **0 hit** | Tất cả slice |
| **GT11** | `node packages/web/scripts/check-multi-agent.mjs` | exit 0 | Khi ≥2 agent |
| **GT12** | `axe` scan 5 trang | **0 critical, 0 serious** | FE-02..FE-06 |
| **GT13** | A11y thủ công — WCAG 2.2 AA §0.4 | **5/5** | FE-02..FE-06 |
| **GT14** | `CORE_DATABASE_URL` trỏ **Postgres** + `DJANGO_DEBUG=1` | **Không** SQLite | Tất cả BE slice |
| **GT15** | Evidence pack `docs/evidence/<slice>/` đủ EV1..EVn | Không thiếu | Mỗi slice |

### 4.1 Ba cạm bẫy gate đã biết ([S3])

| Bẫy | Hậu quả | Cách tránh |
|---|---|---|
| BE test trên SQLite | `array_agg` ⇒ `OperationalError` lúc migrate | **GT14** — dựng Postgres riêng |
| **Gọi gate qua pipe** (`node check.mjs \| sed`) | Exit code lấy của lệnh cuối ⇒ **gate không báo fail** | Capture exit code, **không pipe** |
| Tin số migration đọc trong worktree | Không thấy việc chưa commit của agent khác | Đọc head trên branch hợp nhất |

> Cạm bẫy thứ 2 đã xảy ra thật: `core-api healthy` nhưng DB auth fail — log phải đọc trực tiếp.

### 4.2 Gate đã chạy ở baseline

| Gate | Kết quả 2026-10-07 |
|---|---|
| `pre-push-gate` | **17 PASS / 0 SKIP / 0 FAIL** |
| `check-multi-agent` (GT11) | 0 lỗi — PASS |
| `tsc --noEmit` (GT1) | 0 lỗi |
| BE test (GT9) | **679/679 OK** |
| SAFE-04 | 9/9 OK trong container |

---

## 5. CẤU TRÚC FILE — theo [S2] §8.3 `:1507-1568`

```text
packages/web/src/
├── pages/portfolio/
│   ├── PortfolioWorkspace.tsx          # FE-01
│   ├── PortfolioOverviewPage.tsx       # FE-02
│   ├── PortfolioHoldingsPage.tsx       # FE-03
│   ├── PortfolioActivityPage.tsx       # FE-04
│   ├── PortfolioAnalyticsPage.tsx      # FE-05
│   └── PortfolioAllocationPage.tsx     # FE-06
├── components/portfolio/
│   ├── PortfolioToolbar.tsx  ·  MetricGrid.tsx  ·  MetricCard.tsx  ·  MetricSparkline.tsx
│   ├── HoldingsTable.tsx  ·  HoldingsTableRow.tsx  ·  HoldingsSummaryBar.tsx
│   ├── EquityCurve.tsx  ·  AllocationChart.tsx  ·  PerformanceChart.tsx  ·  DrawdownChart.tsx
│   ├── ActivityTimeline.tsx  ·  ActivityRow.tsx  ·  CashFlowSummary.tsx
│   └── StaleBanner.tsx  ·  SkeletonScreen.tsx
├── hooks/
│   ├── usePortfolioWorkspace.ts  ·  usePortfolioOverview.ts  ·  useHoldings.ts  ·  usePerformance.ts
├── adapters/core/portfolio.js          # MỚI — 4 hàm còn thiếu
├── types/vninvestcharts-widget.d.ts    # SỬA — T5
└── styles/portfolio-tokens.css         # MỚI — FE-07
```

---

## 6. SLICE — 12 SLICE / 6 WAVE

| Wave | Slice | Tên | ed | Phụ thuộc |
|---|---|---|---|---|
| **W0** | **S-00** | Mở 3 route backend | **0.5** | — |
| **W0** | **S-01** | **FE-07** token + component CSS | 3 | — |
| **W0** | **S-02** | Adapter portfolio + hook workspace | 2.5 | S-01 |
| **W1** | **S-03** | Widget contract + type (T1–T5) | 3 | S-02 |
| **W1** | **S-04** | **FE-01** workspace shell + component shell | 4 | S-02 |
| **W2** | **S-05** | **FE-02** Trang Overview | 4 | S-03, S-04 |
| **W2** | **S-06** | **FE-03** Trang Holdings | 4 | S-04 |
| **W3** | **S-07** | **FE-06** Trang Allocation | 3 | S-04, S-00 |
| **W3** | **S-08** | **FE-05** Trang Analytics | 4 | S-03, S-04 |
| **W3** | **S-09** | **FE-04** Trang Activity | 3 | S-04 |
| **W4** | **S-10** | **FE-08** i18n + a11y + responsive | 2.5 | S-05..S-09 |
| **W4** | **S-11** | Tích hợp + evidence + nghiệm thu | 1 | S-05..S-09 |
| | | **Tổng** | **~33** | |

`ed` của FE-01..08 lấy từ [S3] §0.12 (FE-01=3, FE-02=4, FE-03=4, FE-04=3, FE-05=4, FE-06=3, FE-07=3, FE-08=3).
S-00/S-03/S-04/S-10/S-11 là **foundation tách nhỏ** để chạy song song an toàn.

---

## 7. CHI TIẾT TỪNG SLICE

### W0 — Nền tảng

---

#### S-00 — Mở 3 route backend ⚠ **BLOCKER**

**Vì sao trước:** 3 view có logic thật nhưng không `path()` ⇒ **FE-02 và FE-06 không thể làm**.

**Phạm vi** — thêm vào `packages/core/backend/src/user_workspace/urls.py`:
- `workspace/portfolios/<int:portfolio_id>/equity-curve/` → `PortfolioEquityCurveView`
- `workspace/portfolios/<int:portfolio_id>/allocation/` → `PortfolioAllocationView`
- `workspace/portfolios/<int:portfolio_id>/chart/` → `PortfolioChartView`

**Không** sửa logic view. **Không** tạo migration.

| # | AC | Gate |
|---|---|---|
| A1 | 3 route trả 200 với portfolio của user | GT9 |
| A2 | User **không sở hữu** portfolio → **404** (fail-closed) | GT9 |
| A3 | Shape là envelope `{data, meta}` | GT9 |
| A4 | `allocation` trả `[]` khi chưa có holding, không crash | GT9 |
| A5 | Không migration mới | GT7 |

Evidence: `docs/evidence/portfolio-fe/S-00/` · GT6, GT7, GT9

---

#### S-01 — FE-07 Design token portfolio + dark/light (3 ed)

**Yêu cầu gốc [S1]:594-600**

| R | Nội dung |
|---|---|
| **R1** | Tạo `portfolio-tokens.css` **dựa trên** `soc.tokens.css` (không tạo hệ mới) |
| **R2** | Accent `#FFA02F` · profit `#00B96B` · loss `#F23645` · info `#22d3ee` |
| **R3** | `:root[data-theme="light"]` override **đầy đủ** |
| **R4** | **Mọi** màu tài chính qua CSS variable — **0 hex hardcode** |
| **R5** | Typography 8pt (`--fs-*`, `--sp-*`) |
| **R6** | `tabular-nums` cho mọi số |

Palette 30 token: **[S2]:1213-1254** · Light mode: **[S2]:1256-1275** · Typography: **[S2]:1275-1300**

**AC gốc [S1]:602-606**

| # | AC | Gate |
|---|---|---|
| **AC1** | Grep hex trong `pages/portfolio/`, `components/portfolio/`, `components/broker/` ⇒ **0 hit** | `git grep -nE '#[0-9a-fA-F]{3,8}' -- src/pages/portfolio src/components/portfolio` |
| **AC2** | Đổi theme ⇒ mọi trang đổi theo | Playwright 2 theme |
| **AC3** | Contrast ≥ 4.5:1 **cả 2 theme** — **dán bảng đo** | `check:contrast` |
| **AC4** | Tất cả số dùng `tabular-nums` | grep `--font-variant-numeric` |

**Phản biện bắt buộc [S1]:608-611**
- **PB1:** Đo contrast light mode cho profit/loss/muted — **màu tối trên nền sáng thường fail**
- **PB2:** Còn CSS nào dùng `--port-c0` kiểu local không gắn theme?

⚠ **T7:** `soc.module.css` là barrel 3 dòng, **0 token 0 class** — đừng thêm vào đó.

---

#### S-02 — Adapter portfolio + hook workspace (2.5 ed)

1. Tạo `adapters/core/portfolio.js` — 4 hàm còn thiếu: `getPortfolioEquityCurve(id, days)` · `getPortfolioAllocation(id)` · `getPortfolioChart(id, days)` + re-export 4 hàm có sẵn
2. Tạo `hooks/usePortfolioWorkspace.ts` — `portfolioId`, `period`, `setPortfolioId`, `setPeriod`, `refresh()`, `isStale`

| # | AC |
|---|---|
| A1 | 4 hàm trả **đúng path** — test theo pattern `coreApiAdapter.test.js:366-410` |
| A2 | Tenant header qua `tenantIdStorage` SSOT (T10) |
| A3 | `usePortfolioWorkspace` **không fetch** — chỉ quản lý state |
| A4 | `period` map đúng: 1M→30 · 3M→90 · 6M→180 · 1Y→365 |

---

### W1 — Contract + shell

---

#### S-03 — Widget contract + type (3 ed) ⚠ **RỦI RO CỰC**

**Vì sao trước UI:** [S2] §9.5 bước 1 — *"Chốt contract bằng test **trước** khi làm UI. Không có bước này thì làm mù."*

1. Mở rộng `types/vninvestcharts-widget.d.ts` — thay `data?: unknown[]` (T5)
2. Tạo `components/portfolio/__tests__/widget-contract.test.ts` — **test contract trước**
3. Tạo `EquityCurve.tsx` wrapper: map `close` (T1), `showNonTradingDays: false` (T2), `Comparison` (T3)

| # | AC | Test |
|---|---|---|
| A1 | **T1**: adapter trả `{value}` ⇒ wrapper map thành `close` | `{date, value: 1}` → `panes[0].data[0].close === 1` |
| A2 | **T1 phản chứng**: map sai ⇒ test **ĐỎ** | xoá dòng map `close` → test fail |
| A3 | **T2**: `showNonTradingDays` = `false` | assert prop |
| A4 | **T3**: series benchmark là `Comparison` | assert registry name |
| A5 | **T4**: không giả dữ liệu lách tier gate | không có `mock license` |
| A6 | **T5**: `data`/`panes` có type | GT1 với type test |
| A7 | **T6**: equity curve dùng widget, **không** ECharts | assert import path |

**Phản biện [S1]:465-467**
- **PB1:** **Đọc giá trị thực từ chart** (không chỉ nhìn ảnh) — đây là bằng chứng quyết định AC1 của FE-02
- **PB2:** Cố tình map sai → xem chart → sửa lại. **Dán output 2 lần.**
- **PB3:** 1.2.5 đủ `Line`/`Comparison` — đã verify [S2]:317

---

#### S-04 — FE-01 Workspace shell + component shell (4 ed)

**Yêu cầu gốc [S1]:417-423**

| R | Nội dung |
|---|---|
| **R1** | 5 tab: Overview · Holdings · Activity · Analytics · Allocation (D-36) |
| **R2** | **URL phản ánh tab** (`/portfolios/:id/holdings`) để deep-link + refresh không mất tab |
| **R3** | Breadcrumb đầy đủ |
| **R4** | Portfolio selector có search + health badge |
| **R5** | Tenant hiển thị rõ (chống nhầm tenant) |
| **R6** | State tab đóng lại mở lại phải nhớ |

**AC gốc [S1]:425-430**

| # | AC |
|---|---|
| **AC1** | Mỗi tab có URL riêng; copy URL sang tab mới vẫn đúng tab |
| **AC2** | Chuyển tab giữ đúng portfolio context |
| **AC3** | Breadcrumb đúng cấp |
| **AC4** | Refresh giữ nguyên tab + portfolio |
| **AC5** | Keyboard: Tab/Shift+Tab đúng thứ tự; focus visible |

**Phản biện bắt buộc [S1]:433-434**
- **PB1:** Đổi tenant rồi F5 — selector có còn khớp tenant? **Bug class TEN-02.**
- **PB2:** URL chứa portfolio id của tenant khác ⇒ xử lý thế nào?

**Component shell (6 component):** `PortfolioToolbar` · `MetricGrid` + `MetricCard` + `MetricSparkline` · `SkeletonScreen` · `StaleBanner`

| # | AC |
|---|---|
| A6 | `MetricCard` hiển thị `—` khi `null`/`undefined` |
| A7 | Sparkline đúng số điểm; 0 điểm → ẩn, không crash |
| A8 | `StaleBanner` chỉ hiện khi `isStale === true` |
| A9 | `SkeletonScreen` hiện khi loading, ẩn khi xong |
| A10 | Toolbar emit `refresh` / `periodChange` / `exportCsv` |

---

### W2 — Trang lõi

---

#### S-05 — FE-02 Trang Overview ⭐ (4 ed)

**Yêu cầu gốc [S1]:445-453**

| R | Nội dung |
|---|---|
| **R1** | 6 metric card: Total Value · Daily P&L · Return (1Y) · Holdings count · Sharpe · Max Drawdown |
| **R2** | Mỗi card có sparkline |
| **R3** | Equity curve dùng widget series `Line` + `Comparison` (VN30) — **không** ECharts |
| **R4** | **Map NAV vào field `close`** — `Line` đọc `d.close` (`SeriesRegistry.ts:292`). *Điểm dễ sai nhất* |
| **R5** | `showNonTradingDays={false}` |
| **R6** | `StaleBanner` khi `stale: true` |
| **R7** | `SkeletonScreen` khi loading |
| **R8** | Số thiếu ⇒ `—` + lý do, **không** hiển thị `0` |

Layout chi tiết (ASCII + CSS class): **[S2]:186-252**

**AC gốc [S1]:455-462**

| # | AC |
|---|---|
| **AC1** | Equity curve **vẽ đúng** (không phải đường 0) — ảnh chụp **+ đọc giá trị từ chart** |
| **AC2** | `Comparison` series hiện đường VN30 |
| **AC3** | 6 card hiển thị đúng giá trị từ API |
| **AC4** | Dữ liệu stale ⇒ banner hiện |
| **AC5** | Loading ⇒ skeleton, **không nhấp nháy layout** |
| **AC6** | Thiếu NAV ⇒ `—` + lý do, **không** có `0` |
| **AC7** | axe 0 critical/serious (GT12) |

**Phản biện bắt buộc [S1]:465-467**
- **PB1:** **Đọc giá trị thực từ chart** — xác nhận đường khớp `nav` từ API. **Bằng chứng quyết định AC1.**
- **PB2:** Cố tình map sai → xem chart → sửa lại. **Dán output 2 lần.**

**Test** [S1]:470 — `portfolio-overview.component.test.tsx`, **8 case**: 6 card render · sparkline · equity chart **non-zero** · comparison series · stale banner · skeleton · `—` khi null · axe

**Evidence** [S1]:473 — `docs/evidence/FE-02/`: **ảnh chụp chart** + giá trị đọc từ chart + output axe · GT1 GT2 GT3 GT4×3 GT5 GT12 GT13

---

#### S-06 — FE-03 Trang Holdings ⭐ (4 ed)

**Yêu cầu gốc [S1]:481-490**

| R | Nội dung |
|---|---|
| **R1** | **13 cột**: select · symbol · name · quantity · avg cost · last price · market value · unrealized P&L · P&L % · weight · sector · 24h% · actions |
| **R2** | Sort được **mọi** cột |
| **R3** | Filter: search symbol, sector, P&L dương/âm |
| **R4** | Phân trang (20/hàng) |
| **R5** | Batch action: chọn nhiều → export CSV |
| **R6** | P&L > 0 xanh · < 0 đỏ · = 0 xám — **không chỉ dựa vào màu** (WCAG 1.4.1): thêm dấu `+`/`−` |
| **R7** | Click row → `/stocks/:symbol` |
| **R8** | Số hiển thị `font-variant-numeric: tabular-nums` |
| **R9** | Export CSV có BOM UTF-8 |

**AC gốc [S1]:492-500**

| # | AC |
|---|---|
| **AC1** | Đủ 13 cột header |
| **AC2** | Sort mỗi cột hoạt động, thứ tự đảo đúng |
| **AC3** | Filter **kết hợp** (search + sector + P&L) cùng lúc |
| **AC4** | Phân trang đúng tổng |
| **AC5** | Batch export CSV đủ dòng đã chọn, có BOM |
| **AC6** | P&L dương có dấu `+` **và** màu xanh |
| **AC7** | Bảng cuộn ngang được trên mobile |
| **AC8** | axe 0 critical |

**Phản biện bắt buộc [S1]:503-505**
- **PB1:** Đo contrast bằng công cụ: màu xanh trên nền glass ≥ 4.5:1? **In kết quả đo.**
- **PB2:** Sort cột số dùng so sánh **số** hay **chuỗi**? **Test `1.000.000` vs `900.000`** ← bẫy thật
- **PB3:** Batch action có gửi nhầm endpoint khi **không chọn dòng nào**? Test empty selection.

---

### W3 — Trang bổ sung

---

#### S-07 — FE-06 Trang Allocation (3 ed)

**Yêu cầu gốc [S1]:565-573**

| R | Nội dung |
|---|---|
| **R1** | Dùng **ECharts**, **không** widget (widget không có `Treemap`/`Sunburst` — D-31) |
| **R2** | **4 chế độ**: Treemap · Donut · Bar · Sunburst |
| **R3** | Group by: sector / market cap / exchange |
| **R4** | Màu theo P&L, **diverging scale** |
| **R5** | Tile nhỏ (<2%) gộp vào "Khác", click để tách |
| **R6** | Click sector → drill xuống danh sách symbol |
| **R7** | Legend tương tác |
| **R8** | Bảng chi tiết bên dưới |

**AC gốc [S1]:575-581**

| # | AC |
|---|---|
| **AC1** | Cả 4 chế độ vẽ được |
| **AC2** | Tổng weight hiển thị = 100% |
| **AC3** | Tile <2% gộp, click tách ra |
| **AC4** | Drill-down hoạt động |
| **AC5** | Legend click lọc |
| **AC6** | **Light mode vẫn đọc được** — audit ghi heatmap hiện chỉ có dark, **phải sửa** |

**Phản biện bắt buộc [S1]:584-586**
- **PB1:** `data-theme="light"` ⇒ còn tương phản ≥ 4.5:1? **Đo và dán.**
- **PB2:** **100 holdings** thì treemap có đọc được không, hay thành 1 khối?
- **PB3:** Có chế độ nào mất màu không?

---

#### S-08 — FE-05 Trang Analytics (4 ed)

**Yêu cầu gốc [S1]:535-543**

| R | Nội dung |
|---|---|
| **R1** | Widget: `Line` (cumulative return) + `Comparison` (VN30) · `Area` (drawdown) · `Bar` (monthly return) |
| **R2** | **Map giá trị vào `close`** cho **cả 3** loại series |
| **R3** | Period selector 1M/3M/6M/1Y/3Y/YTD/ALL |
| **R4** | Benchmark selector VN30/VN100/none |
| **R5** | Method selector TWR/MWR — **MWR chỉ hiện khi ≥2 cash flow** |
| **R6** | 11 metric card: total return · annualized · alpha · beta · Sharpe · Sortino · volatility · max drawdown · correlation · tracking error · information ratio |
| **R7** | Attribution chart theo ngành |
| **R8** | Best/worst day |

**AC gốc [S1]:545-552**

| # | AC |
|---|---|
| **AC1** | Cả 3 loại chart vẽ đúng (không đường 0) |
| **AC2** | Đổi period ⇒ chart cập nhật |
| **AC3** | Đổi benchmark ⇒ `Comparison` đổi |
| **AC4** | **MWR chỉ hiện khi ≥2 cash flow**; không đủ ⇒ ẩn + lý do |
| **AC5** | 11 metric card khớp API |
| **AC6** | `max_drawdown` **≤ 0** |
| **AC7** | axe 0 critical |

**Phản biện bắt buộc [S1]:554-557**
- **PB1:** `Bar` series có thật sự được register không? (`SeriesRegistry.ts:309`) — **đọc từ `dist` đã cài**
- **PB2:** Đổi period có **reset zoom** không, hay giữ zoom cũ gây hiển thị sai?
- **PB3:** Số liệu card khớp **chính xác** API, không làm tròn khác nhau? **So sánh từng card với response.**

---

#### S-09 — FE-04 Trang Activity (3 ed)

**Yêu cầu gốc [S1]:513-520**

| R | Nội dung |
|---|---|
| **R1** | Timeline nhóm theo ngày |
| **R2** | Mỗi dòng: loại (BUY/SELL/DIVIDEND) · symbol · số lượng · giá · **phí** · **thuế** · tổng |
| **R3** | Expand để xem chi tiết |
| **R4** | Filter: loại · khoảng ngày · symbol |
| **R5** | Summary card (4): Total Invested · Total Fees · Dividend Income · Realized P&L |
| **R6** | Export CSV BOM |
| **R7** | Phân trang |

**AC gốc [S1]:522-527**

| # | AC |
|---|---|
| **AC1** | Nhóm theo ngày đúng |
| **AC2** | Expand hiện phí/thuế/tổng |
| **AC3** | Filter kết hợp hoạt động |
| **AC4** | 4 summary card khớp tổng bảng — **kiểm tra bằng tính tay 1 case** |
| **AC5** | Export đủ dòng đã filter |

---

### W4 — Khép kín

---

#### S-10 — FE-08 i18n + a11y + responsive (2.5 ed)

**Yêu cầu gốc [S1]:618-623**

| R | Nội dung |
|---|---|
| **R1** | Namespace `portfolioWorkspace` + `brokerHub` + `paperTrading` đầy đủ VI + EN |
| **R2** | **0** chuỗi tiếng Việt hardcode — audit ghi `PortfoliosPage.tsx` có **8+ chuỗi hardcode** |
| **R3** | Key set VI và EN **bằng nhau** |
| **R4** | Số/chuỗi format theo `localeTag`, **không** hardcode `vi-VN` |
| **R5** | Dùng `createTranslator` cho shell page |

**Hiện trạng đo được:** `vi.js` **36** key portfolio · `en.js` **66** ⇒ lệch **30**.

**AC gốc [S1]:625-630**

| # | AC |
|---|---|
| **AC1** | `npm run i18n:scan` ⇒ 0 missing |
| **AC2** | `npm run hardcode:scan` ⇒ 0 hit trong thư mục portfolio/broker |
| **AC3** | Script parity: `\|keys(vi)\| == \|keys(en)\|` ⇒ bằng nhau — **dán output** |
| **AC4** | Đổi `locale` ⇒ toàn bộ UI đổi, **không** còn tiếng Việt sót |
| **AC5** | Ngày/giá format đúng locale |

**Phản biện bắt buộc [S1]:633-634**
- **PB1:** Đổi sang EN rồi **chụp ảnh từng trang** — còn chuỗi tiếng Việt? **Kiểm chứng thực tế, không thay bằng script.**
- **PB2:** Chuỗi trong `aria-label` / `title` / `placeholder` **có được scan không?**

**A11y + responsive bổ sung**

| # | AC | Gate |
|---|---|---|
| A6 | axe **0 critical, 0 serious** 5 trang | GT12 |
| A7 | Checklist WCAG 2.2 AA §0.4 — **5/5** | GT13 |
| A8 | Contrast ≥ 4.5:1 **cả 2 theme** — bảng đo | `check:contrast` |
| A9 | Responsive 3 breakpoint ([S2]:1355-1379) | Playwright 3 viewport |

---

#### S-11 — Tích hợp + evidence + nghiệm thu (1 ed)

- 5 route vào `app/routeCatalog.js` (theo FE-01 R2)
- `PortfoliosPage.tsx` thêm link vào workspace
- Viết `docs/evidence/portfolio-fe/VERIFICATION.md`

**Evidence pack** (GT15 + [S3] §0.7):

```text
docs/evidence/portfolio-fe/S-NN/
├── gates.md          # GT1..GT15 + exit code thật
├── ac-checklist.md   # từng AC + cách kiểm + kết quả
├── screenshots/      # chụp từng trạng thái, CÓ DỮ LIỆU THẬT
└── commands.txt      # đúng lệnh đã chạy + output
```

| # | Nguyên tắc bằng chứng |
|---|---|
| **E1** | **Fail trước / pass sau** — chứng minh test **thật sự bắt lỗi** |
| **E2** | **Không tin "build pass"** cho chart — **đọc giá trị từ chart** ([S1] PB1) |
| **E3** | Không báo PASS cho thứ chưa chạy (`docs/LESSONS/build-gates.md` L-G02) |
| **E4** | Screenshot phải có **dữ liệu thật từ DB dev** — **không** mock |
| **E5** | Ghi rõ phần **chưa verify** |

---

## 8. NGHIỆM THU

### 8.1 DoD — mỗi slice

- [ ] Mọi AC đã tick + cách kiểm
- [ ] Gate **GT1..GT15** áp dụng cho slice đó PASS, **có log**
- [ ] `test:components` **3 lần liên tiếp** xanh (D-19)
- [ ] Evidence pack đầy đủ (GT15)
- [ ] Không commit file shared (§9.2)
- [ ] Claim `done` trong `docs/CLAIMS.md` (**append cuối**)
- [ ] PR mở, gate xanh, **chưa merge** (chờ Owner)

### 8.2 DoD — toàn bộ plan (theo [S1]:638-648)

| # | Tiêu chí | Nguồn |
|---|---|---|
| 1 | 5 trang chạy, deep-link đúng, refresh giữ state | [S1]:640 |
| 2 | Equity curve / drawdown / monthly return **vẽ đúng** (đọc giá trị từ chart) | [S1]:641 |
| 3 | `Line`/`Area`/`Bar` map đúng field `close` | [S1]:642 |
| 4 | axe 0 critical; **5/5** tiêu chí WCAG thủ công | [S1]:643 |
| 5 | Contrast ≥ 4.5:1 **cả dark và light** — có bảng đo | [S1]:644 |
| 6 | **0 hex hardcode** trong component portfolio | [S1]:645 |
| 7 | i18n parity 100%, 0 hardcode, **ảnh chụp 2 locale** | [S1]:646 |
| 8 | `test:components` **3 lần liên tiếp xanh** (D-19) | [S1]:647 |
| 9 | **GT1–GT13 xanh** | [S1]:648 |

### 8.3 Đối chiếu Wave 3 exit criteria ([S3]:251)

> *"5 trang workspace chạy; axe 0 critical; i18n parity 100%; equity curve vẽ đúng (không phải 0)"*

| Exit criteria | Đạt khi |
|---|---|
| 5 trang workspace chạy | #1 |
| axe 0 critical | #4 |
| i18n parity 100% | #7 |
| equity curve vẽ đúng | #2 |

⇒ **Wave 3 đạt đủ 4/4 exit criteria.**

---

## 9. QUY TRÌNH CHO ĐỘI CODE

### 9.1 Trước mỗi slice

```
1. Đọc docs/LESSONS/INDEX.md → gọi skill project-lessons
2. Đọc docs/AGENT_PROTOCOL.md §11 (Planning Gate)
3. Ghi: "Lessons áp dụng: [L-00x, ...]"
4. Khai claim docs/CLAIMS.md (append cuối, commit riêng) — TRƯỚC khi sửa dòng đầu
5. Tạo branch: feat/s-05-overview
```

### 9.2 File SHARED — serialize

| File | Khi nào sửa |
|---|---|
| `app/routeCatalog.js` | ⚠ **Chỉ S-11** |
| `packages/web/package.json` | ⚠ **Chỉ S-10** — Owner cho phép nhưng **serialize** |
| `packages/web/package-lock.json` | Deny-list — **không** sửa |
| `docs/CLAIMS.md` | Append cuối, **commit riêng** |
| `AGENTS.md` | **Không** — chỉ Owner |
| `pyproject.toml` · `requirements.txt` · `docker-compose*.yml` · `.env*` | Không cần |

Cạm bẫy DAG từ [S3]:283: `PAP-01` phụ thuộc `FE-01` **và** widget 1.4.x ⇒ 2 người sửa `package.json` ⇒ phải giao **một** agent.

### 9.3 Git

```bash
# Đúng
git checkout -b feat/s-05-overview dev
git commit -F <file>          # PowerShell không hỗ trợ heredoc
git push -u origin feat/s-05-overview
gh pr create --base dev --head feat/s-05-overview

# SAI — đã vi phạm 1 lần (758c13141)
git commit -m "..."           # thẳng vào dev
```
Nguồn: `docs/LESSONS/multi-agent.md` **L-008**.

### 9.4 Khi gặp vấn đề

| Tình huống | Hành động |
|---|---|
| Backend trả shape khác spec | **Dừng**, ghi `commands.txt`, báo coordinator |
| Cần thêm route backend | Báo — không tự thêm (trừ S-00) |
| Cần migration | **Cấm** trong plan này |
| Widget không render series | Kiểm tier/license (T4) — **không** giả dữ liệu |
| Cần sửa deny-list | Dừng, báo Owner |
| Chart vẽ đường 0 | Kiểm T1 trước — 90% là map sai field |

---

## 10. RỦI RO

| # | Rủi ro | Mức | Xử lý | Nguồn |
|---|---|---|---|---|
| R1 | NAV map sai field ⇒ chart rỗng | **CỰC** | S-03 A1 + A2 (phản chứng) | [S2]:1719 |
| R2 | Equity curve lệch trục X | Cao | T2 + test 3 period | [S2]:1727 |
| R3 | Series bị tier gate chặn | Cao | Kiểm license; **không** giả dữ liệu | [S2]:1723 |
| R4 | Sort cột số so sánh chuỗi | Cao | S-06 PB2 — `1.000.000` vs `900.000` | [S1]:504 |
| R5 | Light mode contrast fail | Cao | S-07 PB1 + S-10 A8 | [S1]:584, 609 |
| R6 | Treemap 100 holdings thành 1 khối | TB | S-07 PB2 | [S1]:585 |
| R7 | Token thêm sai file | Cao | S-01 AC1 + T7 | AGENTS.md |
| R8 | Đổi period giữ zoom cũ | TB | S-08 PB2 | [S1]:556 |
| R9 | Trùng `routeCatalog.js` / `package.json` | TB | Serialize §9.2 | [S3]:283 |
| R10 | DB dev chỉ 1 portfolio ⇒ khó test chart | TB | Seed data 1 lần ở S-05 | — |
| R11 | `Panels` bị giữ khi nghi ngờ (bug đã xảy ra) | Cao | Append `superseded`, không sửa dòng gốc | `docs/LESSONS/multi-agent.md` L-002 |

---

## 11. BÀN GIAO

### 11.1 Đội code đọc theo thứ tự

| # | Tài liệu | Dùng để |
|---|---|---|
| 1 | Plan này §6 (slice + AC) | Biết cần làm gì |
| 2 | Plan này §3 (T1–T10) | Không vi phạm |
| 3 | Plan này §4 (GT1–GT15) + §8 (DoD) | Khi nào xong |
| 4 | Plan này §9 (quy trình) | Đúng thứ tự |
| 5 | **[S1]** `...LEDGER_FE_20260927.md:413-648` | **AC gốc + 21 Phản biện bắt buộc** |
| 6 | **[S2]** `...UI_UX_DESIGN_SPEC_20260927.md` | **Chi tiết giao diện** — palette, layout, ASCII |
| 7 | **[S3]** `...PLAN_MASTER_20260927.md:103-118` | Bảng gate + cạm bẫy |
| 8 | `docs/LESSONS/INDEX.md` | Bài học đã gặp |
| 9 | `docs/AGENT_PROTOCOL.md` §11 | Planning Gate |

### 11.2 Owner cần quyết định

| # | Câu hỏi | Khuyến nghị |
|---|---|---|
| 1 | Tuần tự 1 agent (~7 tuần) hay song song 2 agent (~4,5 tuần)? | **Song song 2 agent** — serialize `routeCatalog.js` + `package.json` |
| 2 | Cho phép seed DB dev (1 → ~10 portfolio + giao dịch)? | **Có** — cần cho E2 (đọc giá trị từ chart) + E4 (screenshot dữ liệu thật) |
| 3 | 5 URL riêng hay 1 route có tab? | **5 URL riêng** — FE-01 R2 |
| 4 | Nâng widget 1.4.0 trong plan này? | **Không** — [S2]:317 |
| 5 | Seed bao nhiêu holding để test PB2 (100 holdings)? | ≥30 để vượt ngưỡng 2%; **≥100** để test đúng PB2 |

### 11.3 Trạng thái bàn giao

| Hạng mục | Trạng thái |
|---|---|
| Spec thiết kế | ✅ [S2] 1.729 dòng, chốt 2026-09-27 |
| AC gốc + phản biện | ✅ [S1] FE-01..08 có R/AC/PB/Test/Evidence |
| Bảng gate | ✅ [S3] GT1–GT15 |
| Backend cho 5 trang | ✅ đủ (trừ 3 route = S-00, **0.5 ed**) |
| Adapter | ⚠ 4/8 hàm — S-02 bổ sung |
| Token | ✅ có trong [S2] §5.1 — S-01 đưa vào code |
| Widget | ✅ 1.2.5 **đủ** — verify trong `dist` |
| Seed data | ⚠ cần Owner duyệt |

---

## 12. ƯỚC LƯỢNG

| Wave | Slice | ed | Tích lũy |
|---|---|---|---|
| W0 | S-00, S-01, S-02 | 6 | 6 |
| W1 | S-03, S-04 | 7 | 13 |
| W2 | S-05, S-06 | 8 | 21 |
| W3 | S-07, S-08, S-09 | 10 | 31 |
| W4 | S-10, S-11 | 3.5 | **34.5** |

| Kịch bản | Thời gian |
|---|---|
| 1 agent tuần tự | ~8 tuần |
| **2 agent (W0–W1 chung, W2/W3 chia)** | **~4,5 tuần** ← khuyến nghị |

---

## PHỤ LỤC — Tra cứu nhanh

| Cần tra | Nguồn |
|---|---|
| AC gốc FE-01..08 | [S1]:413-648 |
| Phản biện bắt buộc (PB) | [S1]:432, 464, 502, 583, 608, 632 |
| Palette 30 token | [S2]:1213-1254 |
| Light mode override | [S2]:1256-1275 |
| Typography 8pt | [S2]:1275-1300 |
| Layout Overview (ASCII) | [S2]:186-252 |
| Ràng buộc widget T1–T5 | [S2]:319-335 |
| 11 rủi ro | [S2]:1715-1729 |
| File structure target | [S2]:1507-1568 |
| Component priority | [S2]:1482-1505 |
| Responsive breakpoints | [S2]:1355-1379 |
| Bảng gate GT1–GT15 | [S3]:103-118 |
| Cạm bẫy gate | [S3] sau bảng gate |
| D-19 / D-31 / D-36 | [S3]:66, 78, 83 |
| Wave 3 exit criteria | [S3]:251 |
| Roadmap audit Wave 2 AC | [S5]:1071-1080 |
| Type cần mở rộng | `packages/web/src/types/vninvestcharts-widget.d.ts:22-23` |

---

**Baseline đo khi lập plan:** `dev @ c07fc0eec` · 679 BE test OK · SAFE-04 9/9 trong container ·
`pre-push-gate` 17 PASS · 3 dead-code view đã xác nhận · `soc.tokens.css` 0 token portfolio ·
i18n vi 36 / en 66 · type `data?: unknown[]` đã xác nhận.

**CHƯA CHẠY khi lập plan:** 25 file test `src/*/tests/` · Playwright E2E · mobile · `agent-sync.ps1` ·
GT12 (axe) · GT13 (WCAG thủ công) · GT4×3 (D-19).
Mọi kết luận trong plan này chỉ dựa trên những gì **đã chạy thật**.
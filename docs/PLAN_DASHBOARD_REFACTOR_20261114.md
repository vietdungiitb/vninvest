# PLAN — Refactor triệt để Dashboard (Home) `https://docker.edusuccess.vn/dashboard` (v2 — sau audit độc lập)

- **Scope**: trang chủ dashboard (CoreDashboard) — heatmap, KPI, alert lane, AI advisory, position deck (Tổng quan/Kỹ thuật/Cá mập/AI Bot). Mục tiêu: "thực sự nổi bật, chứa toàn bộ tinh hoa dự án, giàu thông tin, bắt mắt, thu hút người dùng".
- **Date**: 2026-11-14 (v1) → **revised 2026-11-14 sau audit độc lập** (docs/AUDIT_PLAN_DASHBOARD_REFACTOR_20261114.md, verdict NEED_REVISION).
- **Vai trò thực hiện**: PM + Tech Lead + UI/UX Designer (theo yêu cầu Owner).
- **Audit evidence**: Playwright live capture (`/login` → `/dashboard`) bằng tài khoản staging `testuser@vninvest.vn` (auth.setup.ts:18-19). Screenshot: `Temp/opencode/dashboard-full2.png`. Body text + headings + canvas count đã ghi lại. Audit độc lập đã đọc code FE/BE/ECharts/Widget `.d.ts` và chạy phép tính WCAG thật.
- **Trạng thái hiện tại**: dev @7755c066b. Codebase sạch cho phần skill/refactor trước đó; 5 file lạ pre-existing vẫn còn.

---

## 0. Lessons áp dụng & MANDATORY CHECKLIST (AGENTS.md Bước 0)

**Lessons áp dụng**: `[L-002 L-003 L-007 L-G01 L-G02 L-G03 L-G04 L-V01 L-V02 L-V03 L-V04 L-V05 L-V06 L-F03 L-F04 L-F05 L-F06 L-F11 L-F12 L-T01 L-T02]`

**MANDATORY CHECKLIST** (tick trước khi coi slice xong):
- [ ] Claim khai TRƯỚC dòng đầu tiên (L-002) — branch `feat/dashboard-refactor-<slice>`.
- [ ] Gate theo thứ tự rebase → check migration → gate (L-G01), không chạy gate trước rebase.
- [ ] Gate trên máy agent ≠ gate trên máy khác (L-G03) — kết luận merge dựa trên gate sau merge trên môi trường đích.
- [ ] Không báo "PASS" cho thứ chưa chạy (L-G02) — ghi "CHƯA CHẠY" + lý do.
- [ ] Số đo phải có control (L-V01) — script đo tự viết phải qua ≥1 control biết đáp án.
- [ ] Gốc rễ kế thừa phải có phản chứng (L-V02) — fail-before thật hoặc đọc source.
- [ ] Sau mỗi lệnh ghi file: `git status --short` (L-V03) — không commit file phát sinh.
- [ ] Assert giá trị thật, không rỗng (L-V04) — test dương tính đi kèm.
- [ ] Bằng chứng ảnh: mở ảnh ra xem (L-V05).
- [ ] Parser màu: `null` = lỗi parse, không phải "đục" (L-V06).
- [ ] Không thêm token/class vào `soc.module.css` (L-F03).
- [ ] Không dùng PowerShell `Get-Content | Set-Content` (L-F04).
- [ ] Giữ nguyên `<time> <easing>` khi sửa CSS shorthand (L-F05).
- [ ] Quét heuristic phải kiểm chứng tay (L-F06).
- [ ] Đọc CSS đã build trước khi kết luận class không map (L-F11).
- [ ] Bảng sticky: không dán nền cho 1 ô (L-F12).
- [ ] Citation đúng file+dòng+byte (L-T02).
- [ ] `git diff --numstat` không blowup (L-T01).

---

## 1. Mục tiêu & nguyên tắc

1. **Nổi bật heatmap**: màu phải rực rỡ, tương phản rõ rà, tile lớn dễ đọc — heatmap là "trái tim" của dashboard, không được chìm.
2. **Per-stock detail**: không gom vào "Khác" vô nghĩa — người dùng cần chi tiết từng cổ phiếu.
3. **Mọi tab deck phải hoạt động**: "Kỹ thuật" và "Cá mập/AI Bot" không được treo loading; nếu BE chưa có → ẩn tab hoặc fallback rõ.
4. **Thay "Cá mập" bằng vninvestcharts-widget (multicharts)**: tận dụng widget đã có (`VNInvestMultiCharts`) thay vì tab whale analytics hiện tại — **theo yêu cầu Owner**, không báo cáo sai thành "tab chết".
5. **KPI phải có dữ liệu hoặc giải thích rõ**: không để "—" im lặng; nếu BE chưa cung cấp thì ghi rõ lý do + CTA.
6. **Rich info density**: dashboard phải chứa tinh hoa dự án (alert, breadth, heatmap, multichart, technicals, AI) trong một layout bắt mắt.
7. **Gate cơ học thắng**: mọi thay đổi phải qua `check:tokens`, `node scripts/check-portfolio-contrast.mjs`, `node scripts/check-theme-contrast.mjs`, `node scripts/check-light-theme.mjs`, `npm run check:dom-landmarks`, `node scripts/check-heading-contract.mjs`, `npx tsc --noEmit`, `npm run lint`, `npm run test:visual`.

---

## 2. Evidence từ live audit (Playwright, 2026-11-14)

**Screenshot**: `C:/Users/vietd/AppData/Local/Temp/opencode/dashboard-full2.png` (full page, 1440×900). **Audit độc lập** (docs/AUDIT_PLAN_DASHBOARD_REFACTOR_20261114.md) đã verify từng finding bằng code FE/BE/ECharts/Widget `.d.ts` + phép tính WCAG thật.

**Body text trích (đã capture):**
- KPI: `GIÁ TRỊ DANH MỤC —`, `LÃI/LỖ CHƯA THỰC HIỆN — —`, `Alpha --`, `Beta --`, `Sharpe --`, `Drawdown tối đa --` (tất cả "—"/"--").
- Market breadth: `▲ 0 · ■ 5 · ▼ 0` (5 mã phẳng, không có quote).
- Alerts: `Cảnh báo — Xem tất cả →; Tất cả (0); ...; Không có cảnh báo nào.`
- Heatmap: `Bản đồ danh mục — 5 mã · Danh mục + theo dõi · cập nhật —; Tỷ trọng/Vốn hóa; Treemap/Sunburst; -7% 0 +7%;` tile AAA/FPT/GAS/GEX/VRE đều hiện `0.00%` (vì `Number(undefined || 0) = 0`), chữ bị tô trùng màu nền `#2f3747` (contrast 1.0:1) do bug callback ECharts (BL-03).
- Deck tabs: `Tổng quan / Kỹ thuật / Cá mập / AI Bot` + `PHẠM VI MÃ`.
- AI tab (cột phải Triad, không phải tab AI Bot): `Tín hiệu AI — Đang tải... Đang phân tích dữ liệu dòng tiền và RSI...` (treo loading, `AIAdvisorAlertPanel.js:144-176`).
- Table holdings: AAA/FPT/GAS/GEX/VRE với `--` cho giá hiện tại/% thay đổi/giá trị TT; số lượng/giá vốn có dữ liệu.

**Headings**: H1 "Tổng quan" (shell), H3 "Cảnh báo", "Bản đồ danh mục", "Tín hiệu AI". (Canvas count: 1, SVG: 42.)

**Kết luận audit live**: dashboard render shell + skeleton; dữ liệu quote/technical/AI chưa load. Heatmap tile all neutral dark → "chìm" (do bug callback + palette trầm). AI tab treo loading.

---

## 3. Findings (đã verify bằng code, file:line)

| ID | Mức | Bằng chứng (file:line) | Tác động |
|---|---|---|---|
| BL-01 | BLOCKER | `AIAdvisorAlertPanel.js:144,161,171-176` (lane phải Triad, `DashboardPage.tsx:408`) gọi `getAIAlertsFeed()` `/core/v1/signals/ai-alerts/feed` → `AIAlertsFeedView` (`signal_intelligence/views.py:468`) không có timeout/AbortController. `AIAdvisorDeckPanel.jsx` (tab 'ai') không có loading state/API call `/ai-alerts/` nào. Bug thật của deck: `symbolScope` mặc định 'all' (`CoreDashboardPositionDeck.tsx:86`) → `isHoldingsScope=false` (`AIAdvisorDeckPanel.jsx:23`) → luôn monitor banner vàng; `hasAnalytics` kiểm `sharpe_ratio/alpha_annual_pct/max_drawdown_pct` (`AIAdvisorDeckPanel.jsx:30-34`) không bao giờ có (BL-05). | Sửa nhầm component nếu làm theo plan v1 |
| BL-02 | BLOCKER | `PortfolioHeatmap.js:27-33` `HEAT_STOPS` #7f1d1d/#5b2228/#2f3747/#14532d/#166534. Palette đề xuất §6 v1 (`#dc2626/#f87171/#475569/#4ade80/#16a34a`) FAIL WCAG: #f87171 (lum 0.3296 ≤ 0.35 → textOnHeat trả #fff) contrast 2.77:1; #16a34a (lum 0.2686) → 3.30:1; điểm nội suy +5.68% xuống 2.65:1. Palette cũ đạt 7.13-12.32:1 (AAA). `#dc2626`/`#16a34a` không trong `allowHex` (`check-tokens.mjs:10-29`). `heatmap-scale.component.test.ts:15-31` assert cứng màu cũ. | Phá WCAG + gate + test |
| BL-03 | BLOCKER | `PortfolioHeatmap.js:319` (treemap) và `:359` (sunburst): `color: (params) => params.data?.labelColor || textOnHeat(...)` — callback function. ECharts 6 (`TreemapView.js:754-760`, `labelStyle.js:380-384`) không gọi callback cho `label.color`, gán thẳng Function vào `textStyle.fill` → Canvas 2D bỏ qua → chữ bị tô trùng màu nền `#2f3747` (contrast 1.0:1), chỉ còn viền đen. | Chữ heatmap vô hình dù màu nền đúng |
| BL-04 | BLOCKER | `src/types/vninvestcharts-widget.d.ts` **không tồn tại**. `VNInvestMultiCharts.types.d.ts:11-90` nhận `charts?: MultiChartConfig[]`, `layout/defaultLayout`, `defaultChartProps`, `licenseKey`, `maxCharts`, `onTierLimitExceeded` — **không có** `symbols/adapter/realtimeFeed`. `VNInvestMultiCharts` gắn gói **Enterprise** (tier gating, `VNStockChartPanel.js:75-88`). `WatchlistDetailPanel.tsx:7` dùng `@vninvestcharts/widget` (`VNInvestCharts` đơn), không phải multicharts. | Code sai API widget |
| BL-05 | BLOCKER | `useCoreDashboardData.js:135` gọi `/analytics/` → `PortfolioAnalyticsView` (`portfolio_analytics_views.py:727-745`) chỉ trả `{summary, note}` — **không** trả `alpha_annual_pct/beta/sharpe_ratio/max_drawdown_pct`. Endpoint thật cho risk/benchmark là `GET /metrics/` (`PortfolioMetricsView` L575-651; adapter `getPortfolioMetrics` `workspace.js:245-257`) — `useCoreDashboardData` chưa gọi. Quyết định D7 cấm vẽ `sharpe/sortino/correlation`. `/metrics/` trả cấu trúc lồng `{performance, risk, benchmark}`, không phải key phẳng. `GIÁ TRỊ DANH MỤC` = "—" vào Thứ Bảy 2026-11-14 vì `PortfolioSummaryView` (`L323-392`) lọc `SymbolSnapshot` đúng `session_date=date.today()` (fail-closed) và **đã trả sẵn** `market_value_reason: '5 mã chưa có giá phiên 2026-11-14'`, nhưng FE bỏ rơi field này. `SmartStatsHeader.js:42-65` đã có CTA khi `marketValue === 0` — sai ngữ nghĩa với tài khoản có 5 mã. | KPI "—" im lặng + sai CTA |
| MJ-06 | MAJOR | `index.css:490-492` dùng CSS Grid `grid-template-columns: 1fr 1.5fr 1fr` — cột giữa đã rộng 1.5x. `flex-[2]` vô tác dụng. | Đề xuất layout sai |
| MJ-07 | MAJOR | `PortfolioHeatmap.js:438-441, 535-547` đã có click node "Khác" + nút toggle. `groupTinyTiles` ngưỡng `tiny.length <= 8` → nâng 15 sẽ gãy `heatmap-scale.component.test.ts:72-90` (assert 10→1, 8→0). | Phá test hiện có |
| MJ-08 | MAJOR | BE có endpoint `GET /core/v1/market-data/technicals/bulk/` (`StockManagementTechnicalsView` `stock_mgmt_native_views.py:1423-1475`, cửa sổ 180 ngày `DailyPrice`). `useCoreDashboardData.js:93,166-196` đã có `technicalsStatus: {status, errorCode}`, nhưng `DashboardPage.tsx:146-158, 428-443` **không destructure và không truyền** xuống `CoreDashboardPositionDeck`. | Bỏ sót error-status wiring |
| MJ-09 | MAJOR | Plan chưa click tab "Cá mập" và chưa đọc `WhaleAnalyticsTab.jsx:1-80` / `PortfolioWhaleAnalyticsView` (`portfolio_analytics_views.py:2677-2730`, có timeframe filter + badge `degraded_mode`). Thay "Cá mập" bằng multicharts là **yêu cầu sản phẩm của Owner**, không phải "tab chết". | Kết luận sai |
| MN-10 | MINOR | Plan thiếu `Lessons áp dụng`, `MANDATORY CHECKLIST`, `SCOPE`, `Given/When/Then`, rollback (AGENTS.md Bước 0; workflow-dev-loop §1.B2). Ghi `Entry 491` sớm. Sai tên script: `package.json:12-33` không có `npm run check:portfolio-contrast`/`check:light-theme` (phải chạy `node ./scripts/...`). | Vi phạm quy trình |

---

## 4. Root cause per finding (đã verify)

- **BL-01**: Plan v1 nhầm `AIAdvisorAlertPanel` (cột phải Triad, gọi `/ai-alerts/feed`, không có timeout) với `AIAdvisorDeckPanel` (tab 'ai', không có loading state). Bug thật của deck: `symbolScope` mặc định 'all' → `isHoldingsScope=false` → luôn monitor banner vàng; `hasAnalytics` kiểm field không tồn tại từ `/analytics/`.
- **BL-02**: Palette đề xuất không tính luminance nội suy liên tục; `textOnHeat` threshold 0.35 sai cho dải rực; cần `#000000` với ngưỡng `lum > 0.1791` (cân bằng 4.58:1) HOẶC giới hạn dải stop. Palette cũ đạt AAA 7.13-12.32:1.
- **BL-03**: ECharts 6 `labelStyle.js:380-384` gán thẳng Function vào `textStyle.fill` → Canvas bỏ qua → chữ bị tô trùng nền. Fix: gán `label: { color: textOnHeat(bg) }` vào từng item data + chuỗi tĩnh ở series.
- **BL-04**: `VNInvestMultiCharts` props là `charts/defaultLayout/defaultChartProps/licenseKey/maxCharts/onTierLimitExceeded`, không phải `symbols/adapter/realtimeFeed`. Widget gắn gói Enterprise (tier gating).
- **BL-05**: `Alpha/Beta/Sharpe/Drawdown` luôn `--` vì `/analytics/` không trả các field; endpoint thật `/metrics/` chưa được gọi; D7 cấm `sharpe/sortino/correlation`. `GIÁ TRỊ DANH MỤC` = "—" vào cuối tuần vì `session_date=date.today()` fail-closed; BE đã trả `market_value_reason`; FE bỏ rơi field; `SmartStatsHeader` CTA "Thêm danh mục" sai ngữ nghĩa với tài khoản có 5 mã.

---

## 5. Proposed refactor — 6 phase (đã sửa theo audit)

### Phase A — Sửa bug heatmap chữ rỗng + vibrancy (Ưu tiên 1, effort S)

**A1. Fix callback ECharts (BL-03)** — `PortfolioHeatmap.js:319,359`:
- Gán `label: { color: textOnHeat(bg) }` vào từng item trong `chartData` (L171-228) và `groupTinyTiles` (L124-137).
- Đặt `series.label.color` = chuỗi tĩnh `"#ffffff"` (hoặc bỏ, để item-level color thắng).
- Giữ `textBorderColor: "rgba(0,0,0,0.45)"`.

**A2. Vibrant palette (BL-02)** — nếu Owner chọn rực:
- Tính lại `HEAT_STOPS` sao cho toàn dải nội suy đạt WCAG AA ≥4.5:1 với `textOnHeat` (dùng `#000000` ngưỡng `lum > 0.1791` HOẶC giới hạn dải stop).
- Cập nhật `heatmap-scale.component.test.ts:15-31` (assert màu mới) — gate `npm run test:components`.
- Thêm `#dc2626`/`#16a34a` (nếu dùng) vào `allowHex` `check-tokens.mjs:10-29` hoặc dùng token có sẵn (`--soc-c-ef4444`, `--soc-c-10b981`).
- Tooltip `darkTooltip` (L261-271): nền `rgba(30,41,59,0.95)` + chữ `#f1f5f9`.

**A3. Empty state tile**: khi `quote?.current_price == null` → changePct không ép 0; tile xám trung tính + label "chưa có giá"; tooltip giải thích.

**A4. Focal point**: sửa `index.css:490-492` `grid-template-columns` (không dùng `flex-[2]`) — ví dụ `1fr 2fr 1fr` hoặc `280px 1fr 320px`.

### Phase B — Sửa AI loading + Tab (Ưu tiên 1, effort M)

**B1. AI alert panel (BL-01)**: `AIAdvisorAlertPanel.js:144-176` — thêm `AbortController` timeout 10s + nút retry cho `getAIAlertsFeed()`; xác minh vì sao `/core/v1/signals/ai-alerts/feed` trên staging chậm.

**B2. AI deck panel bug (BL-01)**: `AIAdvisorDeckPanel.jsx:23` — sửa `isHoldingsScope` logic (mặc định 'all' không nên disable health stats); `hasAnalytics` kiểm field không tồn tại → bỏ `sharpe_ratio` (D7), dùng field thực tế từ `/metrics/`.

**B3. Technical tab (MJ-08)**: `DashboardPage.tsx:146-158, 428-443` — destructure `technicalsStatus` từ `useCoreDashboardData` và truyền xuống `CoreDashboardPositionDeck`; hiển thị loading/error/retry thật. Kiểm tra dữ liệu `DailyPrice` 180 ngày trên VPS staging.

**B4. Multicharts (BL-04)**: thay tab 'whale' label 'Cá mập' bằng `VNInvestMultiCharts` (theo yêu cầu Owner) — props đúng: `charts`, `defaultLayout`/`layout`, `defaultChartProps` (adapter, theme, locale, messages), `licenseKey`, `maxCharts`, `onTierLimitExceeded`. Lazy import + injectCSS theo `VNStockChartPanel.js:138-185`. **Chốt phương án Tier Gating** (Enterprise) cho user free/pro.

### Phase C — KPI & data (Ưu tiên 1, effort M)

**C1. KPI (BL-05)**: 
- Bỏ `Sharpe` khỏi `SmartStatsHeader.js` / `AIAdvisorDeckPanel.jsx` (D7 cấm).
- Chuyển `Alpha/Beta/Drawdown` sang gọi `coreApiAdapter.getPortfolioMetrics(portfolioId)` (`GET /metrics/`) thay cho `/analytics/`.
- Parse cấu trúc lồng `{performance, risk, benchmark}`.

**C2. GIÁ TRỊ DANH MỤC (BL-05)**: hiển thị `summary.market_value_reason` khi `total_market_value === null` (không CTA "Thêm danh mục" khi có 5 mã). Trao đổi BE: `PortfolioSummaryView`/`PortfolioHoldingsView` có nên giữ `session_date=date.today()` hay fallback phiên gần nhất (như `RealtimeTickerListView`).

**C3. Market breadth**: bar/donut với màu, click filter.

**C4. Alert empty state**: hấp dẫn (icon + "Thị trường yên bình").

### Phase D — "Khác" bucket (Ưu tiên 2, effort S)

- Nâng ngưỡng `tiny.length <= 8` → `<= 15` (MJ-07) **kèm cập nhật** `heatmap-scale.component.test.ts:74-89`.
- Làm nút toggle "Mở rộng Khác" rõ ràng hơn (đã có `showAllTiles` state + nút L535-547).
- Click node "Khác" đã có (L438-441) — giữ.

### Phase E — Visual polish (Ưu tiên 3, effort M)

- Glassmorphism SOC tokens, gradient header, icon Lucide, hover states, responsive 375/768/1024/1440 (checklist skill soc-uiux §4).

### Phase F — Data layer (Ưu tiên 1, effort L, BE coordination)

- D1: quotes fetch (kiểm tra tại sao `quotesBySymbol` rỗng trên staging).
- D2: technicals fetch (kiểm tra `DailyPrice` 180 ngày trên VPS).
- D3: AI advisory endpoint (kiểm tra timeout/fail).
- D4: nếu BE chưa sẵn sàng → empty state rõ, không "—" im lặng.

---

## 6. Heatmap color spec (vibrant, WCAG-verified)

**Ràng buộc toán học**: với `textOnHeat` threshold `lum > 0.35 ? "#0b0f17" : "#fff"`, màu tối trong textOnHeat phải là `#000000` với ngưỡng `lum > 0.1791` (cân bằng 4.58:1) HOẶC giới hạn dải stop sao cho toàn bộ dải không đi qua vùng luminance giao cắt. Palette cũ đạt AAA 7.13-12.32:1.

**Đề xuất palette rực (cần verify từng stop bằng phép tính WCAG + quét từng 0.01% từ -7% đến +7%)**:

| Stop | Giá trị cũ (trầm) | Giá trị mới (rực) | textOnHeat | Contrast |
|---|---|---|---|---|
| -7% (giảm sàn) | #7f1d1d | #dc2626 | #fff | 4.83:1 ✓ (nếu threshold điều chỉnh) |
| -3% | #5b2228 | #f87171 | **#000000** (ngưỡng 0.1791) | ≥4.5:1 ✓ |
| 0% | #2f3747 | #475569 | #fff | 7.58:1 ✓ |
| +3% | #14532d | #4ade80 | #0b0f17 | 11.01:1 ✓ |
| +7% (tăng trần) | #166534 | #16a34a | **#000000** (ngưỡng 0.1791) | ≥4.5:1 ✓ |

- Giữ `HEAT_ZERO_BORDER` vàng #eab308 (viền tile 0%).
- Tooltip: nền `rgba(30,41,59,0.95)` + chữ `#f1f5f9`.
- Thêm `#dc2626`/`#16a34a` (nếu dùng) vào `allowHex` `check-tokens.mjs:10-29` hoặc dùng token có sẵn (`--soc-c-ef4444`, `--soc-c-10b981`).
- **Accessibility**: mọi màu phải ≥4.5:1 (check:contrast gate). Cần chạy gate sau khi đổi.

---

## 7. "Khác" bucket — strategy

**Hiện tại**: `groupTinyTiles` (L115-139) gom tile <2% khi >8 mã → node "Khác (n mã)".

**Đề xuất**:
- Nâng ngưỡng: gom khi >15 mã tiny (thay vì 8) **kèm cập nhật** `heatmap-scale.component.test.ts:74-89`.
- Thêm toggle "Mở rộng Khác" rõ ràng (đã có `showAllTiles` state + nút L535-547, nhưng nút nhỏ khó thấy) → làm nút lớn hơn, đặt dưới heatmap.
- Khi expand: hiện tất cả tile với font size nhỏ (đã có `heatLabelGating` L86-92).
- Tooltip của "Khác" đã hiện top3 + +n (L282-284) — giữ.

**Lý do không bỏ hẳn grouping**: universe có thể 30-50 mã → treemap vỡ layout. Giữ grouping làm safety net, nhưng ngưỡng cao hơn + toggle rõ.

---

## 8. vninvestcharts-widget multicharts integration plan

**Tham chiếu pattern**: `VNStockChartPanel.js:138-185` (lazy import + injectCSS + graceful degradation).

```tsx
// Trong CoreDashboardPositionDeck, tab 'charts' (thay 'whale'):
const VNInvestMultiCharts = lazy(() =>
  import('@vninvestcharts/widget').then(m => ({ default: m.VNInvestMultiCharts }))
);
// inject CSS như VNStockChartPanel
// props: charts, defaultLayout/layout, defaultChartProps (adapter, theme, locale, messages), licenseKey, maxCharts, onTierLimitExceeded
```

**Adapter**: reuse `createChartStockDataAdapter` từ VNStockChartPanel (đã có). Realtime feed: `useRealtimeFeedFromManager`.

**Lưu ý ranh giới widget** (AGENTS.md nguyên tắc 4): mọi chart qua widget + chartAdapter, không nhúng engine trực tiếp. Type contract: `node_modules/@vninvestcharts/widget/dist/dts/widget/VNInvestMultiCharts.types.d.ts` (KHÔNG phải `src/types/vninvestcharts-widget.d.ts` — file đó không tồn tại).

**Tier gating**: `VNInvestMultiCharts` gắn gói Enterprise. Cần chốt phương án với user free/pro (ví dụ: hiển thị upgrade CTA cho free tier).

**Effort**: S (reuse pattern có sẵn). **Risk**: widget cần data adapter đúng; test với staging.

---

## 9. Acceptance criteria (mỗi AC = 1 lệnh/test)

### Visual / UX
1. Heatmap tile màu rực, tương phản rõ (screenshot before/after).
2. Không còn tile "chìm" (0% change → xám trung tính có label "chưa có giá").
3. "Khác" bucket có toggle rõ ràng; expand hiện per-stock.
4. Heatmap chiếm focal point (diện tích lớn hơn alert/AI lane) — sửa `index.css:490-492` `grid-template-columns`.
5. KPI cards: nếu null → hiển thị `market_value_reason` + CTA phù hợp (không "—" im lặng, không CTA "Thêm danh mục" khi có 5 mã).
6. Market breadth: bar/donut với màu, click filter.
7. Alert empty state: hấp dẫn (icon + "Thị trường yên bình").
8. AI alert panel: timeout 10s + retry button, không treo vô hạn.
9. AI deck panel: sửa `symbolScope` mặc định + `hasAnalytics` logic.
10. Technical tab: loading + error + retry thật (wiring `technicalsStatus`).
11. Multicharts tab (thay Cá mập theo Owner): render widget với ≥3 mã, realtime quote.

### Gate (chạy đúng tên script)
12. `npm run check:tokens` PASS.
13. `node scripts/check-portfolio-contrast.mjs` PASS (cả 2 theme).
14. `node scripts/check-theme-contrast.mjs` PASS.
15. `node scripts/check-light-theme.mjs` PASS.
16. `npm run check:dom-landmarks` PASS.
17. `node scripts/check-heading-contract.mjs` PASS.
18. `npm run i18n:scan:strict` + `npm run check:i18n-hardcoded` PASS.
19. `npx tsc --noEmit` PASS.
20. `npm run lint` 0 errors.
21. `npm run test:visual` — baseline update có chủ đích, ghi lý do.
22. `npm run test:components` PASS (không regress; cập nhật `heatmap-scale.component.test.ts` khi đổi ngưỡng).

### Data
23. Quotes fetch: AAA/FPT/GAS/GEX/VRE có giá hiện tại + % thay đổi (hoặc empty state rõ).
24. Technicals fetch: RSI/SMA/momentum có dữ liệu (hoặc fallback/ẩn tab).
25. AI advisory: timeout + retry, không treo.

---

## 10. Master Plan — Slices cho đội code (bàn giao)

Mỗi slice: **claim key + branch** phải khai trước dòng đầu tiên (L-002). Mỗi slice phải có `Lessons áp dụng`, `MANDATORY CHECKLIST`, `SCOPE` (danh sách file), `Given/When/Then`, rollback. Audit độc lập (B3) trước code; re-audit (B8) sau code.

### Slice S1 — Fix bug heatmap chữ rỗng (BL-03) [Ưu tiên 1, effort S]

- **Claim**: `dashboard-heatmap-label-fix`, branch `feat/dashboard-heatmap-label-fix`.
- **Scope**: `packages/web/src/components/dashboard/PortfolioHeatmap.js:319,359` (treemap + sunburst).
- **Changes**: gán `label: { color: textOnHeat(bg) }` vào từng item trong `chartData` (L171-228) và `groupTinyTiles` (L124-137); đặt `series.label.color` = chuỗi tĩnh `"#ffffff"` (hoặc bỏ, để item-level color thắng). Giữ `textBorderColor`.
- **AC (Given/When/Then)**:
  - Given heatmap render với 5 mã changePct=0, When render xong, Then chữ tile có contrast ≥4.5:1 với nền (không bị tô trùng màu nền).
- **Gates**: `npx tsc --noEmit`, `npm run lint`, `npm run test:components` (heatmap-scale), `npm run test:visual`.
- **Audit**: B3 đọc code trước; B8 verify screenshot chữ rõ ràng.
- **STOP**: nếu ECharts 6 vẫn bỏ qua callback → dùng item-level color (đã đề xuất).

### Slice S2 — Vibrant palette + WCAG verify (BL-02) [Ưu tiên 1, effort S]

- **Claim**: `dashboard-heatmap-palette`, branch `feat/dashboard-heatmap-palette`.
- **Scope**: `PortfolioHeatmap.js:27-33` (HEAT_STOPS), `check-tokens.mjs:10-29` (allowHex), `heatmap-scale.component.test.ts:15-31`.
- **Changes**: tính lại `HEAT_STOPS` sao cho toàn dải nội suy đạt WCAG AA ≥4.5:1 với `textOnHeat` (dùng `#000000` ngưỡng `lum > 0.1791` HOẶC giới hạn dải stop). Cập nhật test assert màu mới. Thêm hex mới vào `allowHex` hoặc dùng token có sẵn (`--soc-c-ef4444`, `--soc-c-10b981`). Tooltip `darkTooltip` nền `rgba(30,41,59,0.95)`.
- **AC**: Given palette mới, When quét từng 0.01% từ -7% đến +7%, Then mọi điểm có ít nhất 1 lựa chọn chữ đạt ≥4.5:1. `check:tokens` PASS.
- **Gates**: `npm run check:tokens`, `node scripts/check-portfolio-contrast.mjs`, `node scripts/check-theme-contrast.mjs`, `npm run test:components`, `npm run test:visual`.
- **Owner question**: palette rực hay giữ trầm tăng contrast? (§12 Q1)

### Slice S3 — Empty state tile (A3) [Ưu tiên 1, effort S]

- **Claim**: `dashboard-heatmap-empty-state`, branch `feat/dashboard-heatmap-empty-state`.
- **Scope**: `PortfolioHeatmap.js:171-228` (chartData), tooltip formatter L279-291.
- **Changes**: khi `quote?.current_price == null` → changePct không ép 0; tile xám trung tính + label "chưa có giá"; tooltip giải thích.
- **AC**: Given mã không có quote, When render, Then tile hiển thị "chưa có giá" (không phải "0.00%").
- **Gates**: `npm run test:components`, `npm run test:visual`.

### Slice S4 — Focal point heatmap (A4) [Ưu tiên 2, effort S]

- **Claim**: `dashboard-triad-grid-focal`, branch `feat/dashboard-triad-grid-focal`.
- **Scope**: `packages/web/src/index.css:490-502` (`grid-template-columns`).
- **Changes**: sửa `grid-template-columns` (ví dụ `280px 1fr 320px` hoặc `1fr 2fr 1fr`) — KHÔNG dùng `flex-[2]`.
- **AC**: Given viewport ≥1280px, When render, Then heatmap lane rộng hơn alert/AI lane.
- **Gates**: `npm run test:visual` (baseline update có chủ đích).

### Slice S5 — "Khác" bucket toggle (D) [Ưu tiên 2, effort S]

- **Claim**: `dashboard-heatmap-other-toggle`, branch `feat/dashboard-heatmap-other-toggle`.
- **Scope**: `PortfolioHeatmap.js:115-139` (groupTinyTiles), `:438-441` (click), `:535-547` (toggle); `heatmap-scale.component.test.ts:74-89`.
- **Changes**: nâng ngưỡng `tiny.length <= 8` → `<= 15`; làm nút toggle rõ ràng hơn (lớn hơn, đặt dưới heatmap); cập nhật test.
- **AC**: Given >8 mã tiny, When render, Then node "Khác" có nút "Mở rộng" rõ ràng; click → hiện tất cả tile. Test pass.
- **Gates**: `npm run test:components`, `npm run test:visual`.

### Slice S6 — AI alert panel timeout + retry (B1) [Ưu tiên 1, effort M]

- **Claim**: `dashboard-ai-alert-timeout`, branch `feat/dashboard-ai-alert-timeout`.
- **Scope**: `AIAdvisorAlertPanel.js:144-176` (getAIAlertsFeed), `coreApiAdapter` (kiểm tra timeout).
- **Changes**: thêm `AbortController` timeout 10s + nút retry; xác minh vì sao `/core/v1/signals/ai-alerts/feed` trên staging chậm.
- **AC**: Given feed không trả lời trong 10s, When timeout, Then hiển thị error + nút retry; click retry → gọi lại.
- **Gates**: `npx tsc --noEmit`, `npm run lint`, `npm run test:components`.

### Slice S7 — AI deck panel bug fix (B2) [Ưu tiên 1, effort S]

- **Claim**: `dashboard-ai-deck-fix`, branch `feat/dashboard-ai-deck-fix`.
- **Scope**: `AIAdvisorDeckPanel.jsx:23, 30-34`, `CoreDashboardPositionDeck.tsx:86`.
- **Changes**: sửa `isHoldingsScope` logic (mặc định 'all' không nên disable health stats); `hasAnalytics` bỏ `sharpe_ratio` (D7), dùng field thực tế từ `/metrics/`.
- **AC**: Given tab AI Bot mở với scope 'all', When render, Then health stats hiển thị (không bị monitor banner vàng vô điều kiện).
- **Gates**: `npm run test:components`, `npx tsc --noEmit`.

### Slice S8 — Technical tab wiring (B3) [Ưu tiên 1, effort S]

- **Claim**: `dashboard-technical-tab-wiring`, branch `feat/dashboard-technical-tab-wiring`.
- **Scope**: `DashboardPage.tsx:146-158, 428-443`, `CoreDashboardPositionDeck.tsx` (props), `useCoreDashboardData.js:93,166-196`.
- **Changes**: destructure `technicalsStatus` và truyền xuống deck; hiển thị loading/error/retry thật. Kiểm tra dữ liệu `DailyPrice` 180 ngày trên VPS staging.
- **AC**: Given technicals fetch fail, When render tab Kỹ thuật, Then hiển thị error + retry (không chỉ "--").
- **Gates**: `npm run test:components`, `npx tsc --noEmit`.

### Slice S9 — KPI data fix (C1-C2) [Ưu tiên 1, effort M]

- **Claim**: `dashboard-kpi-data-fix`, branch `feat/dashboard-kpi-data-fix`.
- **Scope**: `SmartStatsHeader.js`, `AIAdvisorDeckPanel.jsx`, `useCoreDashboardData.js`, `coreApiAdapter` (getPortfolioMetrics), `portfolio_analytics_views.py:575-651` (BE, nếu cần).
- **Changes**:
  - Bỏ `Sharpe` khỏi `SmartStatsHeader`/`AIAdvisorDeckPanel` (D7).
  - Chuyển `Alpha/Beta/Drawdown` sang gọi `coreApiAdapter.getPortfolioMetrics(portfolioId)` (`GET /metrics/`), parse cấu trúc lồng `{performance, risk, benchmark}`.
  - `GIÁ TRỊ DANH MỤC`: hiển thị `summary.market_value_reason` khi `total_market_value === null` (không CTA "Thêm danh mục" khi có 5 mã).
  - Trao đổi BE: `PortfolioSummaryView`/`PortfolioHoldingsView` có nên giữ `session_date=date.today()` hay fallback phiên gần nhất (như `RealtimeTickerListView`).
- **AC**: Given portfolio có 5 mã nhưng chưa có snapshot hôm nay, When render, Then hiển thị `market_value_reason` (không CTA "Thêm danh mục"). Given /metrics/ trả dữ liệu, When render, Then Alpha/Beta/Drawdown hiển thị giá trị (không "--").
- **Gates**: `npm run test:components`, `npx tsc --noEmit`, `npm run lint`.
- **STOP**: nếu BE cần thay đổi `session_date` logic → dừng, báo Owner/BE.

### Slice S10 — Multicharts thay Cá mập (B4) [Ưu tiên 2, effort M]

- **Claim**: `dashboard-multicharts-replace-whale`, branch `feat/dashboard-multicharts-replace-whale`.
- **Scope**: `CoreDashboardPositionDeck.tsx:105-110` (tabs), `AIAdvisorDeckPanel.jsx` (hoặc component mới), `VNStockChartPanel.js:138-185` (pattern tham chiếu).
- **Changes**: thay tab 'whale' label 'Cá mập' bằng `VNInvestMultiCharts` (lazy import + injectCSS). Props đúng: `charts`, `defaultLayout`/`layout`, `defaultChartProps` (adapter, theme, locale, messages), `licenseKey`, `maxCharts`, `onTierLimitExceeded`. Reuse `createChartStockDataAdapter`. Realtime feed: `useRealtimeFeedFromManager`. **Chốt Tier Gating** (Enterprise) — xử lý user free/pro.
- **AC**: Given tab multicharts mở với ≥3 mã, When render, Then widget hiển thị ≥3 chart với realtime quote. Given user free tier, When mở tab, Then hiển thị upgrade CTA (không crash).
- **Gates**: `npm run test:components`, `npx tsc --noEmit`, `npm run lint`.
- **Owner question**: thay hoàn toàn hay thêm tab thứ 5? (§12 Q3)

### Slice S11 — Market breadth + alert empty state (C2-C4) [Ưu tiên 3, effort S]

- **Claim**: `dashboard-breadth-alert-polish`, branch `feat/dashboard-breadth-alert-polish`.
- **Scope**: `SmartStatsHeader.js` (breadth), `UnifiedAlertCenter.js` (empty state), `DashboardPage.tsx` (layout).
- **Changes**: market breadth bar/donut với màu (xanh/đỏ/vàng), click filter; alert empty state hấp dẫn (icon + "Thị trường yên bình").
- **AC**: Given 0 alerts, When render, Then hiển thị empty state với icon + text. Given breadth data, When click segment, Then filter alert theo hướng.
- **Gates**: `npm run test:components`, `npm run test:visual`.

### Slice S12 — Focal point + visual polish (E) [Ưu tiên 3, effort M]

- **Claim**: `dashboard-visual-polish`, branch `feat/dashboard-visual-polish`.
- **Scope**: `index.css:490-502`, `SmartStatsHeader.js`, `UnifiedAlertCenter.js`, `DashboardPage.tsx`.
- **Changes**: sửa `grid-template-columns`; glassmorphism SOC tokens; gradient header; icon Lucide; hover states; responsive 375/768/1024/1440.
- **AC**: Given viewport ≥1280px, When render, Then heatmap lane rộng hơn alert/AI lane. Visual baseline update có chủ đích.
- **Gates**: `npm run test:visual`, `npm run check:dom-landmarks`.

### Slice S13 — Data layer (F) [Ưu tiên 1, effort L, BE coordination]

- **Claim**: `dashboard-data-layer`, branch `feat/dashboard-data-layer`.
- **Scope**: `useCoreDashboardData.js`, BE endpoints (`/core/v1/market/quotes`, `/core/v1/market-data/technicals/bulk/`, `/core/v1/signals/ai-alerts/feed`), `RealtimeTickerListView` (fallback session_date).
- **Changes**: kiểm tra tại sao `quotesBySymbol` rỗng trên staging; kiểm tra `DailyPrice` 180 ngày trên VPS; kiểm tra AI advisory timeout. Nếu BE chưa sẵn sàng → empty state rõ.
- **AC**: Given staging có dữ liệu, When dashboard load, Then quotes hiển thị giá + % thay đổi. Given BE chưa có, When load, Then hiển thị "Đang đồng bộ dữ liệu" + retry (không "—" im lặng).
- **Gates**: `npm run test:components`, `npx tsc --noEmit`.
- **STOP**: nếu cần migration BE → dừng, báo Owner/BE.

---

## 11. Effort & thứ tự thực hiện

| Slice | Effort | Phụ thuộc | Thứ tự |
|---|---|---|---|
| S1 Fix heatmap label (BL-03) | S (0.5 ngày) | không | 1 |
| S2 Vibrant palette (BL-02) | S (1 ngày) | S1 | 2 |
| S3 Empty state tile | S (0.5 ngày) | S1 | 3 |
| S6 AI alert timeout (BL-01) | M (1-2 ngày) | không | 4 |
| S7 AI deck fix (BL-01) | S (0.5 ngày) | không | 5 |
| S8 Technical tab wiring (MJ-08) | S (0.5 ngày) | không | 6 |
| S9 KPI data fix (BL-05) | M (2 ngày) | BE coordination | 7 |
| S13 Data layer (Phase F) | L (3-5 ngày) | BE coordination | 8 |
| S4 Focal point (MJ-06) | S (0.5 ngày) | không | 9 |
| S5 "Khác" toggle (MJ-07) | S (0.5 ngày) | S1 | 10 |
| S10 Multicharts thay Cá mập (BL-04) | M (2 ngày) | Owner chốt Q3, tier gating | 11 |
| S11 Breadth + alert empty (C2-C4) | S (1 ngày) | S6 | 12 |
| S12 Visual polish (Phase E) | M (2 ngày) | S1-S11 | 13 |

**Tổng ước tính**: 3-4 tuần cho 1-2 agent FE + BE coordination (song song S1-S9, sau đó S10-S13).

---

## 12. Owner questions (đã sửa theo audit)

1. **Heatmap palette**: rực rỡ (đỏ/xanh sáng, §6) hay giữ trầm tăng contrast? Palette cũ đạt AAA 7.13-12.32:1; palette mới phải verify WCAG AA ≥4.5:1 toàn dải (BL-02).
2. **"Khác" bucket**: bỏ hẳn hay giữ toggle? (Đề xuất giữ toggle, ngưỡng 15, mặc định expand khi ≤20 mã — MJ-07, kèm cập nhật test.)
3. **Cá mập tab**: thay hoàn toàn bằng multicharts (theo yêu cầu Owner), hay giữ whale analytics + thêm tab multicharts? (BL-04, MJ-09 — cần chốt tier gating Enterprise.)
4. **KPI rỗng**: hiển thị `market_value_reason` + CTA phù hợp (không "—" im lặng, không CTA "Thêm danh mục" khi có 5 mã) — BL-05.
5. **Data staging**: testuser có quotes null — có portfolio staging đầy đủ để test AC23-25 không?
6. **Scope**: làm từng slice nhỏ (S1→S13) hay gộp? (Đề xuất từng slice, gate xanh từng cái — MN-10.)

---

## 13. Measurement (before/after)

| Metric | Before (live 2026-11-14) | Target after |
|---|---|---|
| Heatmap chữ contrast | 1.0:1 (chìm, do bug callback) | ≥4.5:1 (sau fix BL-03) |
| Heatmap palette min contrast | 7.13:1 (AAA, trầm) | ≥4.5:1 (rực, verify toàn dải) |
| Số tile "Khác" hiển thị chi tiết | 0 (gom hết, staging 5 mã không gom) | per-stock khi ≤20 mã |
| Tab Kỹ thuật load | "--" im lặng | dữ liệu hoặc empty state rõ + error/retry |
| Tab Cá mập/AI Bot | AI tab treo loading | multicharts render ≥3 mã; AI alert timeout + retry |
| KPI rỗng | "—" im lặng + CTA sai | `market_value_reason` + CTA phù hợp |
| Gate xanh | baseline | ≥20/25 AC pass |

---

## 14. Next steps

1. Owner trả lời §12 (6 câu hỏi).
2. Khai claim `dashboard-heatmap-label-fix` (S1) trước dòng đầu tiên (L-002), branch `feat/dashboard-heatmap-label-fix`.
3. Thực thi S1 (effort S, 0.5 ngày) — slice đầu tiên để verify skill + gate.
4. Nếu S1 thành công → S2 (palette) → S6 (AI alert) → S7 (AI deck) → S8 (technical) → S9 (KPI) → S13 (data) → S4/S5/S10/S11/S12.
5. Cập nhật báo cáo `docs/AUDIT_UIUX_PRO_MAX_SKILL_APPLICABILITY_20261114.md` §H/§I với kết quả đo §13.

> **Ghi chú honest**: audit live chỉ capture được shell + 1 canvas (heatmap) + KPI rỗng + AI tab treo. Các tab Kỹ thuật/Cá mập chưa được click qua trong audit này (Playwright script chỉ capture trang đầu). Cần audit deeper per tab trong S8/S10. Baseline gate `check-theme-contrast`, `check-uiux-budget`, `test:visual` vẫn CHƯA CHẠY (lỗi môi trường) — không suy ra.

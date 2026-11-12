# PLAN — Tận dụng năng lực vninvestcharts-widget (feature leverage) — 2026-11-12

> **Trạng thái: KẾ HOẠCH / BÁO CÁO NGHIÊN CỨU — CHƯA THỰC HIỆN.** Owner yêu cầu nghiên cứu và lập kế hoạch chi tiết.
> Ngày: 2026-11-12. Nguồn: `packages/web/node_modules/@vninvestcharts/widget@0.4.4` (registry GH) + `@vninvestcharts/widget-pro@0.4.4` + `@vninvestcharts/engine-core@0.5.6` + code vninvest hiện tại.
> Phạm vi: FE-only (không đụng BE contract, không migration DB). Tuân thủ deny-list + protocol.

## 0. Tóm tắt điều hành

Widget `@vninvestcharts/widget@0.4.4` export **~60 type + 25 component/hook + 67 indicator trong catalog** (+ Pine Editor, Strategy Tester, Bar Replay, Drawing Dock, Paper Trade, Settings Modal, Workspace Serializer qua widget-pro). vninvest hiện chỉ dùng **~15% bề mặt API** (single chart + 7 indicator mặc định + dock/paper/settings opt-in theo tier). Khoảng trống lớn nhất: **multi-chart workspace, advisory panel, tape panel, custom indicators VN-specific, workspace serializer (layout save/share), drawing persistence, comparison overlay, measurement**.

Đề xuất: **12 slice FE** chia 3 wave (P0/P1/P2), tổng ~3-5 ngày agent, không cần BE mới ngoại trừ corporate events (blocked). Mỗi slice có AC đo được + test fail-before.

## 1. Baseline — những gì vninvest ĐANG dùng (đã verify bằng grep)

File `packages/web/src/components/VNStockChartPanel.js` (362 dòng) + `WatchlistDetailPanel.tsx`:

| Capability widget | Đang dùng? | Ghi chú |
|---|---|---|
| `VNInvestCharts` (single) | ✅ | Stock detail + watchlist detail |
| `VNInvestMultiCharts` | ❌ | Chưa dùng (enterprise multi-pane) |
| `PaperTradePanel` | ✅ opt-in | `showPaperTrade && PaperTradePanel` (enterprise) |
| `SettingsModal` | ✅ opt-in | `showSettings && SettingsModal` (pro+) |
| `DrawingDock`/`Inspector`/`ListPanel` | ✅ opt-in | `showDrawingDock && DrawingDock` (pro+) |
| `WidgetI18nProvider`/`useWidgetI18n` | ✅ | locale + messages vi |
| `injectVNInvestChartsCSS` | ✅ | fallback CSS inject |
| `registerProExtension`/`isProExtensionActive` | ❌ | Chưa gọi (tier gating qua app-side) |
| `getIndicator`/`registerIndicator`/`registerIndicators` | ❌ | 0 custom indicator VN-specific |
| `evaluateRuntimePolicy`/`resolveRequestedRuntime` | ❌ | Chưa dùng cho perf tiering |
| `WorkspaceSerializer` | ❌ | Layout save/share vẫn localStorage only (PARTIAL) |
| `createLocalStorageAdapter` | ❌ | Drawing không persist server |
| `MeasurementOverlay` | ❌ | Chưa bật |
| `WidgetErrorBoundary`/`WidgetEmptyState` | ❌ | Chưa dùng cho graceful degradation |
| `showTapePanel` + `tapeEntries` | ❌ (false) | Demo parity — BE đã có `IntradayTapeView` |
| `showAdvisoryPanel` + `advisoryResult` | ❌ (false) | BE đã có AI advisory |
| `showCorporateEvents` + `corporateEvents` | ❌ (false) | BE chưa có nguồn corporate actions ([X]) |
| `onComparisonChange` | ❌ | Chưa so sánh mã trên cùng chart |
| `renderReplayBar` + replay props | ❌ | Bar Replay chưa bật |
| `onDrawingAlert` | ❌ | Alert khi giá cắt drawing chưa có |
| `symbolLinkGroup` | ❌ | Multi-chart symbol sync chưa có |
| `frozenSnapshot` | ❌ | First-paint instant chưa có |
| `onTelemetry` | ❌ | Observability chưa có |
| `upgradeUrl` | ❌ | Upsell CTA chưa có |
| `cvdMode` | ❌ (default) | Chưa chọn oscillator/histogram |
| `whaleThreshold` | ❌ (default) | Chưa tune |
| `timezone`/`defaultTimezone` | ❌ | Chưa hỗ trợ múi giờ |
| `measurementEnabled` | ❌ | Chưa bật measurement tool |
| `showDock` | ✅ isPro | Đã gate theo tier |
| `showLegend` | ❌ (default true) | Chưa tune |
| `darkFlowStrength`/`SignalType` | ❌ (removed) | UI cleanup — badge removed |

## 2. Capability widget chưa tận dụng — chi tiết

### 2.1 Multi-chart workspace (`VNInvestMultiCharts`)
- Export: `VNInvestMultiCharts`, `VNInvestMultiChartsProps`, `VNInvestMultiChartsRef`, `MultiChartConfig`, `ChartLayout`.
- Use case: trang `/portfolio` hoặc `/analytics` hiển thị nhiều mã song song (grid 2x2, 1x3, ...) với symbol link sync.
- Hiện tại: PortfolioChart dùng ECharts (line/bar/treemap/sunburst/pie) — không phải OHLCV multi-pane. Có chỗ cho cả hai: ECharts cho allocation, widget multi cho price comparison.
- Blocker: enterprise tier only (bundle size ~2MB extra). Cần dynamic import.

### 2.2 Custom indicators VN-specific
- API: `registerIndicator(def)`, `registerIndicators(list)`, `getIndicator(id)`, `listIndicators()` (67 built-in).
- Use case: đăng ký indicator "Whale Flow", "Dark Flow", "CVD VN", "Foreign Flow" làm indicator trong catalog widget → user bật/tắt qua UI widget thay vì app phải truyền prop.
- Hiện tại: whale/dark-flow/CVD được truyền qua prop `whaleOrders`/`enableCVD`/`externalCvdSeries` (app-side). Nếu đăng ký thành indicator, user tự chọn period/params.
- Effort: M (cần adapter data → indicator series).

### 2.3 Advisory panel trong chart
- Props: `showAdvisoryPanel`, `advisoryResult`, `isAdvisoryLoading`, `onAdvisoryRefresh`.
- Use case: hiển thị AI advisory (đã có BE `/advisory/latest`) ngay trong chart panel thay vì section riêng.
- BE đã có: `advisory` app (6 772 LOC) + `AdvisoryResult` type trong widget.
- Effort: S (wire prop).

### 2.4 Tape panel (time & sales)
- Props: `showTapePanel`, `tapeEntries`, `isTapeLoading`, `tapeFilterBillions`, `onTapeFilterChange`.
- Use case: bảng tick thật (BE `market_data.IntradayTick` → `IntradayTapeView`).
- Hiện tại: `showTapePanel: false` (demo parity — Ban/Mua ở footer). Có thể bật theo tier pro.
- Effort: S (wire data + prop).

### 2.5 Corporate events overlay
- Props: `showCorporateEvents`, `corporateEvents`, `corporateEventsMode` ('live'|'demo').
- Use case: overlay ex-date/dividend/split trên chart.
- Blocker: BE chưa có nguồn corporate actions (W5.3 gap). → giữ false cho đến khi BE có endpoint.
- Effort: L (cần BE endpoint mới — [X] partially).

### 2.6 Comparison overlays
- Prop: `onComparisonChange(overlays)`.
- Use case: so sánh 2-3 mã trên cùng chart (overlay normalize %).
- Effort: M.

### 2.7 Bar replay
- Props: `renderReplayBar`, `replaySelectionEnabled`, `replayInstanceId`.
- Use case: replay bar-by-bar (backtest visual). Widget đã có replay infra.
- Effort: M-L (cần UI controls).

### 2.8 Measurement overlay
- Export: `MeasurementOverlay`.
- Use case: đo khoảng cách giá/thời gian trên chart.
- Effort: S.

### 2.9 Workspace serializer (layout save/share)
- Export: `WorkspaceSerializer`.
- Use case: lưu layout pane/indicator/drawing vào BE (thay localStorage only → đóng PARTIAL gap "Layout save & share").
- Effort: M (cần BE endpoint lưu workspace JSON).

### 2.10 Drawing persistence
- API: `createLocalStorageAdapter`, `DrawingStorageAdapter`, `drawingStorageAdapter` prop, `drawingStorageKey`.
- Use case: drawings persist across sessions. Hiện tại drawings reset khi reload.
- Effort: M (localStorage adapter có sẵn; server persist là [X]).

### 2.11 Drawing alerts
- Prop: `onDrawingAlert(drawing, condition, currentPrice)`.
- Use case: alert khi giá cắt trendline/horizontal.
- Effort: S-M (wire vào alert center).

### 2.12 Runtime policy
- API: `evaluateRuntimePolicy`, `resolveRequestedRuntime`, `shouldForceLegacyRuntime`.
- Use case: chọn legacy vs modern runtime theo device capability (perf tiering).
- Effort: S.

### 2.13 Watchlist adapter
- Type: `WatchlistAdapter`, `WatchlistItem`, `WatchlistQuoteUpdate`.
- Use case: widget tự quản lý watchlist symbol switching trong chart (thay app-side).
- Effort: M.

### 2.14 Symbol link group
- Prop: `symbolLinkGroup`.
- Use case: multi-chart sync symbol (click 1 chart → all charts đổi mã).
- Effort: S (chỉ khi dùng MultiCharts).

### 2.15 Graceful degradation
- Exports: `WidgetErrorBoundary`, `WidgetEmptyState`.
- Use case: wrap chart trong error boundary; hiện empty state khi không có data.
- Effort: S.

### 2.16 Frozen snapshot (instant first paint)
- Prop: `frozenSnapshot` (ImageBitmap | HTMLCanvasElement).
- Use case: render snapshot cũ trong khi data load → giảm perceived latency.
- Effort: M (cần capture + cache).

### 2.17 Telemetry
- Prop: `onTelemetry(event)`.
- Use case: gửi widget events (render time, errors) về observability.
- Effort: S.

### 2.18 Upgrade URL + upsell
- Prop: `upgradeUrl`.
- Use case: CTA khi user click premium feature.
- Effort: S.

### 2.19 CVD mode + whale threshold + timezone + measurement
- Props: `cvdMode`, `whaleThreshold`, `timezone`/`defaultTimezone`/`onTimezoneChange`, `measurementEnabled`, `zoomSpeed`, `maxVisibleBars`, `historyMinResidentBars`.
- Use case: tune chart behavior per user preference.
- Effort: S each.

### 2.20 Pine Editor / Strategy Tester (widget-pro)
- widget-pro exports: Pine compiler, strategy tester, replay, drawing tools.
- Use case: Pine Editor tab trong chart (đã có trong widget default toolbar?). Currently "Pine Editor" mentioned in W0.9 but no prop to enable. Need check widget default toolbar includes pine.
- Effort: depends on widget default behavior.

## 3. Plan slices (ưu tiên)

### Wave 0 — Quick wins (S, 1-2 ngày, không BE)

| ID | Slice | File touched | AC đo được | Effort |
|---|---|---|---|---|
| **W-A** | Advisory panel trong chart | `VNStockChartPanel.js` | `showAdvisoryPanel: true` khi có advisoryResult; test assert prop + data flow | S |
| **W-B** | Tape panel toggle (pro+) | `VNStockChartPanel.js` | `showTapePanel` theo tier; wire `tapeEntries` từ BE tape API | S |
| **W-C** | Error boundary + empty state | `VNStockChartPanel.js` | Wrap chart trong `WidgetErrorBoundary`; `WidgetEmptyState` khi empty | S |
| **W-D** | Measurement overlay enable | `VNStockChartPanel.js` | `measurementEnabled: true` (pro+) | S |
| **W-E** | CVD mode + whale threshold + timezone | `VNStockChartPanel.js` | Props truyền đúng; test assert | S |
| **W-F** | Upgrade URL + telemetry hook | `VNStockChartPanel.js` | `upgradeUrl` + `onTelemetry` wire | S |

### Wave 1 — Medium (M, 2-3 ngày, có thể cần BE endpoint nhỏ)

| ID | Slice | File touched | AC đo được | Effort |
|---|---|---|---|---|
| **W-G** | Custom indicator registration (Whale Flow, Dark Flow, CVD VN) | new `src/lib/widgetIndicators.js` + panel | `registerIndicators` gọi; widget catalog hiển thị 3 indicator mới | M |
| **W-H** | Workspace serializer (layout save/share) | new component + BE endpoint | Save/load layout qua BE; test round-trip | M |
| **W-I** | Drawing persistence (localStorage adapter) | panel | Drawings persist across reload; test | M |
| **W-J** | Drawing alerts → alert center | panel + alert adapter | `onDrawingAlert` wire; alert tạo khi giá cắt | M |
| **W-K** | Comparison overlays | panel | `onComparisonChange` wire; UI chọn mã so sánh | M |

### Wave 2 — Enterprise (L, 3-5 ngày, cần tier gating + BE)

| ID | Slice | File touched | AC đo được | Effort |
|---|---|---|---|---|
| **W-L** | Multi-chart workspace (enterprise) | new `MultiChartWorkspace.tsx` | `VNInvestMultiCharts` render grid; symbol link sync | L |
| **W-M** | Corporate events overlay (blocked on BE) | panel + BE endpoint mới | `showCorporateEvents: true` khi BE có data; overlay render | L (BE) |
| **W-N** | Bar replay | panel | Replay controls + bar-by-bar | L |

## 4. Blockers & dependencies

| Blocker | Ảnh hưởng | Giải pháp |
|---|---|---|
| BE chưa có corporate actions endpoint | W-M | Cần BE endpoint mới (market_data app) — [X] partially, theo roadmap W5.3 |
| BE chưa có workspace save endpoint | W-H | Cần BE endpoint nhỏ (user_workspace app) — [T] |
| Tier gating pro/enterprise | W-L, W-B, W-D | Đã có app-side (`useTenantTier`) + offline license. OK |
| Widget-pro peer dep on widget 0.4.3 vs 0.4.4 | build | Đã xử lý (bump 044p) — cần verify build pass |
| Bundle size multi-chart (~2MB) | W-L | Dynamic import + IntersectionObserver (đã có pattern) |

## 5. Non-goals (rõ ràng)

- **KHÔNG** sửa widget package (repo khác).
- **KHÔNG** thêm dependency mới (widget đã có).
- **KHÔNG** đụng BE contract lớn (chỉ endpoint nhỏ cho workspace/corporate events).
- **KHÔNG** bật corporate events khi BE chưa có data (giữ false, ghi comment).
- **KHÔNG** bật 59 indicator cùng lúc (UX rối) — chỉ đăng ký 3 VN-specific.

## 6. Rủi ro

| Rủi ro | Giảm thiểu |
|---|---|
| Multi-chart bundle quá lớn | Dynamic import + IntersectionObserver (pattern C2) |
| Custom indicator data adapter sai | Test fail-before + verify trên staging |
| Workspace serializer schema drift | Version schema + migration |
| Drawing persistence localStorage quota | Fallback + error handling |
| Advisory panel duplicate với section riêng | Chỉ bật trong chart, tắt section riêng khi bật |

## 7. Ước lượng

- Wave 0 (6 slice S): 1-2 ngày
- Wave 1 (5 slice M): 2-3 ngày
- Wave 2 (3 slice L): 3-5 ngày
- Tổng: 6-10 ngày nếu full scope; có thể chia theo tier priority.

## 8. Câu hỏi cần Owner quyết định (Wave 0 xong 2026-11-12 — Wave 1/2 chờ trả lời)

> Wave 0 (W-A..W-F) đã merge 6/6 (PR #342..#347, Entry 457..462). Các câu hỏi dưới giữ nguyên cho Wave 1/2.

1. Wave 0 quick wins có làm ngay không (không cần BE, không cần Owner input ngoài tier)? → **ĐÃ XONG.**
2. Custom indicator "Whale Flow/Dark Flow/CVD VN" có đăng ký thành indicator trong catalog widget, hay giữ như prop (hiện tại)? Đề xuất: đăng ký (user tự bật/tắt). → **CHỜ (quyết định W-G).**
3. Workspace serializer: lưu layout ở BE (cần endpoint) hay localStorage only (đơn giản hơn, không cần BE)? Đề xuất: localStorage first, BE sau. → **CHỜ (quyết định W-H).**
4. Multi-chart workspace: enterprise tier only, hay pro tier? Đề xuất: enterprise. → **CHỜ (quyết định W-L).**
5. Advisory panel trong chart: thay thế section riêng, hay thêm vào (cả hai)? Đề xuất: thay thế (tránh duplicate). → **CHỜ (sau khi staging-pro-layout2 xong; W-A hiện giữ cả hai).**

## 9. Deliverables dự kiến

- 12 slice PR (hoặc gộp theo wave)
- Test fail-before cho mỗi slice (pattern `vnstock-chart-panel.data-unlock.component.test.ts`)
- Evidence: `docs/evidence/widget-feature-leverage/*`
- Ledger Entry cho mỗi slice
- Cập nhật `MASTER_TRACKING_2026Q4.md` indicator count (13 → ?)

---
**Chờ owner phê duyệt scope (Wave 0/1/2) trước khi thực hiện.**
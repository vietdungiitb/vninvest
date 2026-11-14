# AUDIT ĐỘC LẬP KẾ HOẠCH B3 — `docs/PLAN_DASHBOARD_REFACTOR_20261114.md`

- **Đối tượng audit**:
  - **Vòng 2 (Plan v2)**: [`docs/PLAN_DASHBOARD_REFACTOR_20261114.md`](PLAN_DASHBOARD_REFACTOR_20261114.md) (425 dòng, 13 slices `S1..S13`), [`docs/CODE_CHANGE_AUDIT_LEDGER.md`](CODE_CHANGE_AUDIT_LEDGER.md#L1-L60) (Entry 492).
  - **Vòng 1 (Plan v1 — lưu phía dưới để đối chiếu)**: bản v1 (264 dòng, Entry 491), [`dashboard-full2.png`](file:///C:/Users/vietd/AppData/Local/Temp/opencode/dashboard-full2.png), [`audit-dashboard4.js`](file:///C:/Users/vietd/AppData/Local/Temp/opencode/audit-dashboard4.js).
- **Ngày audit**: 2026-11-14 (Vòng 1 & Vòng 2).
- **Quy trình áp dụng**: [`workflow-dev-loop`](../.opencode/skills/workflow-dev-loop/SKILL.md) (Bước B3 — Audit kế hoạch độc lập, Quy tắc 5 & 6).
- **Lessons áp dụng**: `L-002`, `L-007`, `L-V01`, `L-V02`, `L-F04`, `L-F07`, `L-T01`, `L-T02`.

---

# PHẦN II — RE-AUDIT ĐỘC LẬP VÒNG 2 (Plan v2 — 13 Slices `S1..S13`)

## Kết luận tổng thể Vòng 2 (Verdict)

**`PASS_WITH_CONDITIONS`** — **Đủ điều kiện mở Slice S1 ngay (kèm ghi chú mở rộng line range), nhưng CHẶN code các slice `S2, S3, S7, S8, S9, S10, S11, S13` cho tới khi vá xong 6 phát hiện kỹ thuật mới ở tầng slice (`V2-01..V2-06`).**

Plan v2 (`425` dòng) đã tiếp thu **10/10 finding từ Vòng 1 (`BL-01..MN-10`)** ở cấp kiến trúc tổng quan (`§§0–9`), bổ sung `Lessons áp dụng` + `MANDATORY CHECKLIST` (`L11-34`), sửa đúng tên script gate (`L230-240`), và tách thành **13 slices (`S1..S13`)** (`L249-366`).

Tuy nhiên, khi kiểm chứng độc lập từng slice xuống tận code nguồn FE/BE/ECharts (`@vninvestcharts/widget`, `analytics.py`, `chartAdapter.js`, `PortfolioHeatmap.js`, `AIAdvisorDeckPanel.jsx`, `CoreDashboardPositionDeck.tsx`, `useRealtimeFeedCore.js`), phát hiện **6 khiếm khuyết mới ở tầng triển khai chi tiết (`V2-01..V2-06`)**: **2 Blocker cấp slice (`V2-01`, `V2-02`)**, **3 Major cấp slice (`V2-03`, `V2-04`, `V2-05`)**, và **1 Minor (`V2-06`)**.

---

## 1. Bảng đối chiếu khắc phục 10 Finding Vòng 1 (`BL-01..MN-10`)

| ID Vòng 1 | Nội dung cốt lõi | Trạng thái trong Plan v2 | Ghi chú Re-Audit Vòng 2 |
|---|---|---|---|
| `BL-01` | Nhầm `AIAdvisorAlertPanel` với `AIAdvisorDeckPanel`; bỏ sót bug scope `'all'` & `hasAnalytics` | **ĐÃ SỬA ở tầng ý tưởng** (§2 `L59`, §3 `L72`, §10 `S6` & `S7`) | `S6` (`READY`); `S7` vướng phụ thuộc ngược với `S9` và sót công thức Health Score (`V2-01`). |
| `BL-02` | Toán học WCAG palette rực, threshold `0.1791`, `allowHex`, `heatmap-scale.component.test.ts` | **ĐÃ SỬA công thức** (§6 `L158-174`, `S2`) | Đã kiểm chứng WCAG toàn dải: đạt `min 4.59:1` với `#000000`, nhưng bảng `L167` còn ghi `#0b0f17` và Scope `S2` thiếu `textOnHeat` (`L72-74`) + `L34-36` test (`V2-03`). |
| `BL-03` | Bug callback `series.label.color` trong ECharts 6 khiến chữ heatmap bị tô trùng nền | **ĐÃ SỬA** (`S1` `L253-262`) | Đã kiểm chứng `TreemapSeries.js:72-97` & `TreemapView.js:751-760`: gán item-level `label.color` hoạt động đúng; cần ghi đủ line `L129, L219` trong Scope (`V2-04`). |
| `BL-04` | Props API của `VNInvestMultiCharts` & bỏ `src/types/vninvestcharts-widget.d.ts`, thêm Tier Gating | **ĐÃ SỬA API widget** (§8 `L191-210`, `S10`) | Bỏ qua giới hạn `chartAdapter.js:114-127` chỉ hỗ trợ **1 listener realtime duy nhất** + Scope `S10` ghi nhầm `AIAdvisorDeckPanel.jsx` (`V2-02`). |
| `BL-05` | KPI gọi `/metrics/` thay `/analytics/`, tuân thủ D7, hiển thị `market_value_reason` | **ĐÃ SỬA hướng kiến trúc** (`S9` `L321-332`) | Chưa khớp tên field thật (`alpha_annualized`, `max_drawdown`) & **bẫy đơn vị x100** (`0.15` vs `15%`); lại xếp `S7` chạy trước `S9` (`V2-01`). |
| `MJ-06` | Triad dùng CSS Grid `1fr 1.5fr 1fr` (`index.css:490-492`), không dùng `flex-[2]` | **ĐÃ SỬA** (§3 `L77`, `S4` `L281-287`) | `S4` **READY**. |
| `MJ-07` | Bucket `"Khác"` đã có click/toggle, nâng ngưỡng `> 15` phải sửa `heatmap-scale.component.test.ts:74-89` | **ĐÃ SỬA** (§7 `L177-187`, `S5` `L289-295`) | `S5` **READY**. |
| `MJ-08` | Truyền `technicalsStatus` từ `useCoreDashboardData` xuống `CoreDashboardPositionDeck` | **ĐÃ SỬA** (§3 `L79`, `S8` `L313-319`) | `CoreDashboardPositionDeck.tsx:217-230` tự sinh 5 dòng toàn `null`, cần nhánh check riêng (`V2-06`). |
| `MJ-09` | Tab Cá mập có BE thật (`WhaleAnalyticsTab`), thay bằng Multicharts là yêu cầu Owner | **ĐÃ SỬA** (§1.4 `L42`, §3 `L80`) | Đạt. |
| `MN-10` | Bổ sung `Lessons áp dụng`, `MANDATORY CHECKLIST`, `Given/When/Then`, tên gate `node scripts/...` | **ĐÃ SỬA** (§0 `L11-34`, §9 `L230-240`, §10) | Đạt (với lưu ý còn 1 chỗ nhắc `check:contrast gate` ở `L173` — tên đúng trong `package.json` là `node scripts/...`). |

---

## 2. Chi tiết 6 Phát hiện kỹ thuật mới Vòng 2 (`V2-01` .. `V2-06`)

### V2-01 [Blocker cho S7 & S9] — Đảo ngược phụ thuộc (`S7` trước `S9`), sai tên trường + đơn vị `x100` của `/metrics/`, và hỏng Health Score 100 điểm khi gỡ Sharpe (D7)

1. **Đảo ngược thứ tự phụ thuộc giữa S7 và S9**:
   - Plan v2 §11 (`L378, L380`) và §14 (`L422`) xếp **S7 (`dashboard-ai-deck-fix`, Thứ tự 5, khai `Phụ thuộc: không`) chạy TRƯỚC S9 (`dashboard-kpi-data-fix`, Thứ tự 7)**.
   - Tuy nhiên, S7 (`L309-310`) yêu cầu `hasAnalytics` trong [`AIAdvisorDeckPanel.jsx:30-34`](../packages/web/src/components/dashboard/AIAdvisorDeckPanel.jsx#L30-L34) *"dùng field thực tế từ `/metrics/`"* và AC nghiệm thu *"Given tab AI Bot mở với scope 'all', When render, Then health stats hiển thị"*.
   - Thực tế tại [`useCoreDashboardData.js:135`](../packages/web/src/features/dashboard/useCoreDashboardData.js#L135), hook vẫn chỉ gọi `/analytics/` (`PortfolioAnalyticsView` trả `{ summary, note }`, `portfolio_analytics_views.py:727-745`). Nếu chưa chạy **S9** để gọi `getPortfolioMetrics(portfolioId)`, `analytics` truyền xuống `AIAdvisorDeckPanel` không có bất kỳ field risk/benchmark nào → AC của S7 **không thể PASS** ở Thứ tự 5!

2. **Lệch tên trường & bẫy đơn vị thập phân (`x100`) từ `/metrics/`**:
   - Đọc trực tiếp [`PortfolioMetricsView`](../packages/core/backend/src/user_workspace/portfolio_analytics_views.py#L575-L651) và [`ledger/analytics.py:235-384`](../packages/core/backend/src/user_workspace/ledger/analytics.py#L235-L384), payload trả về của `/metrics/` có schema và đơn vị thật như sau:

   | Field FE hiện tại (`SmartStatsHeader.js` / `AIAdvisorDeckPanel.jsx`) | Tên trường & đường dẫn thật từ `/metrics/` | Đơn vị BE (`analytics.py`) | Đơn vị FE đang render (`%` vs thô) | Rủi ro nếu không quy đổi |
   |---|---|---|---|---|
   | `alpha_annual_pct` (`SmartStatsHeader.js:97`, `AIAdvisorDeckPanel.jsx:32,39`) | `benchmark.alpha_annualized` (`analytics.py:314`) | **Thập phân** (`daily_returns`: `0.01 = 1%`, `analytics.py:332-333`) | Điểm `%` (`toFixed(2) + "%"`, `alpha / 20`) | `+8%` (`0.08`) bị hiển thị thành `0.08%`, `alphaScore` gần như `0` |
   | `beta` (`SmartStatsHeader.js:98`) | `benchmark.beta` (`analytics.py:315`) | Tỷ số (ratio) | Số thập phân (`toFixed(2)`) | Khớp đơn vị nếu đọc đúng `benchmark.beta` |
   | `max_drawdown_pct` (`SmartStatsHeader.js:100`, `AIAdvisorDeckPanel.jsx:33,40,154`) | `risk.max_drawdown` (`analytics.py:377`) | **Thập phân âm** (`<= 0`, vd `-0.15` cho `-15%`) | Điểm `%` (`${v}%`, `maxDD / 30`) | `-15%` (`-0.15`) bị hiển thị thành `-0.15%`, `ddScore` sai hoàn toàn |
   | `sharpe_ratio` (CẤM theo D7) | Không tồn tại (`portfolio_analytics_views.py:582-585`). Có `risk.volatility` (`analytics.py:357`) & `benchmark.information_ratio` (`analytics.py:317`) | Thập phân (`volatility`: `0.01 = 1%`) | Cũ: tỷ số 2 chữ số | Nếu thay bằng `volatility`, phải nhân `100` để thành `%` |

3. **Hỏng thang điểm Health Score & sót Scope trong `AIAdvisorDeckPanel.jsx`**:
   - Tại [`AIAdvisorDeckPanel.jsx:42-46`](../packages/web/src/components/dashboard/AIAdvisorDeckPanel.jsx#L42-L46), công thức tổng điểm `100` hiện là `sharpeScore (40đ) + alphaScore (30đ) + ddScore (30đ)`. Nếu chỉ bỏ `sharpe_ratio` theo D7 mà không định nghĩa lại trọng số mới cho đủ `100` điểm (vd dùng `alphaScore`, `ddScore`, `volatility`/`information_ratio`), điểm tối đa của danh mục tốt nhất chỉ còn **`60/100` (Hạng `C`)**!
   - Đồng thời, Scope S7 (`L308`) chỉ liệt kê `AIAdvisorDeckPanel.jsx:23, 30-34`, bỏ sót:
     - `L38-56` (tính điểm & grade),
     - `L123` (`aiNoAnalyticsHelp` vẫn ghi *"để tính Sharpe, Alpha và drawdown"*),
     - `L141-148` (card KPI `"Rủi ro (Sharpe)"` đọc trực tiếp `analytics?.sharpe_ratio` — **vi phạm D7**),
     - `L154` (hiển thị `analytics?.max_drawdown_pct`).
   - Tại [`SmartStatsHeader.js:57-62, 96-101`](../packages/web/src/components/dashboard/SmartStatsHeader.js#L57-L101), `hasAnalytics` đang check `sharpe_ratio` và `compactMetrics` hardcode 4 card phụ (gồm `sharpe` tại `L99`). S9 cần chốt rõ thay `sharpe` bằng `risk.volatility` (`* 100`, đơn vị `%`) hay ẩn thành 3 card.

- **Cách sửa trước khi code S7/S9**:
  1. Đổi thứ tự trong §11 & §14: **S9 chạy TRƯỚC S7** (hoặc gộp S7 vào cuối S9).
  2. Chuẩn hóa helper map dữ liệu `/metrics/` (nhân `100` cho `benchmark.alpha_annualized`, `risk.max_drawdown`, `risk.volatility`), mở rộng Scope S7 sang `AIAdvisorDeckPanel.jsx:23-57, 120-160`, gỡ card `Sharpe` ở `L141-148`, và chốt lại công thức Health Score tổng `100` điểm không dùng `sharpe`.

---

### V2-02 [Blocker cho S10] — `createChartStockDataAdapter` (`chartAdapter.js:114-127`) chỉ giữ 1 listener duy nhất (`_onBarCallback`) + `S10` ghi nhầm file trong Scope

1. **Single-listener & no-symbol bug trong `chartAdapter.js`**:
   - Plan v2 §8 (`L201, L204`) và §10 `S10` (`L338`) thiết kế tái sử dụng `createChartStockDataAdapter` truyền qua `defaultChartProps` cho `VNInvestMultiCharts` (hiển thị `>= 3` mã) và viết *"Realtime feed: `useRealtimeFeedFromManager`"*.
   - Kiểm chứng [`chartAdapter.js:114-127`](../packages/web/src/adapters/chartAdapter.js#L114-L127):
     ```js
     subscribeToBar(symbol, timeframe, onBar) {
       this._onBarCallback = onBar;
       return () => {
         this._onBarCallback = null;
       };
     },
     pushRealtimeBar(bar) {
       if (this._onBarCallback) {
         this._onBarCallback(bar);
         return true;
       }
       return false;
     },
     ```
     - Adapter hiện tại hoàn toàn **không định tuyến theo `symbol`** và chỉ lưu **1 biến `_onBarCallback` duy nhất**. Nếu chia sẻ 1 instance `adapter` qua `defaultChartProps` cho 3 chart (`AAA`, `FPT`, `GAS`), chart mount sau cùng sẽ ghi đè callback của 2 chart trước; và khi 1 chart unmount sẽ xóa sạch `_onBarCallback` của toàn bộ widget!
     - Ngoài ra, kiểm chứng [`VNStockChartPanel.js:187-222`](../packages/web/src/components/VNStockChartPanel.js#L187-L222): `useRealtimeFeedFromManager` **không tự đẩy bar vào adapter** — nó chỉ trả về `{ quotesBySymbol }`, còn FE phải tự chạy `buildBarFromQuote(quote)` và gọi `adapter.pushRealtimeBar(nextBar)`. Hiện `pushRealtimeBar(bar)` thậm chí chưa nhận tham số `symbol`.
2. **S10 ghi nhầm tên file trong `Scope` (`L337`)**:
   - Line `337` viết: `Scope: CoreDashboardPositionDeck.tsx:105-110 (tabs), AIAdvisorDeckPanel.jsx (hoặc component mới), VNStockChartPanel.js:138-185`.
   - Tab `'whale'` được render tại [`CoreDashboardPositionDeck.tsx:503-512`](../packages/web/src/components/dashboard/CoreDashboardPositionDeck.tsx#L503-L512) bằng [`WhaleAnalyticsTab`](../packages/web/src/components/dashboard/WhaleAnalyticsTab.jsx), hoàn toàn không liên quan `AIAdvisorDeckPanel.jsx`.

- **Cách sửa trước khi code S10**:
  - Hoặc (a) tạo 1 instance `adapter` riêng cho từng phần tử trong mảng `charts` (`charts: symbols.map(sym => ({ id: sym, symbol: sym, chartProps: { adapter: ... } }))`), hoặc (b) nâng cấp `chartAdapter.js:114-127` dùng `Map<symbolKey, Set<onBar>>` + `pushRealtimeBar(symbol, bar)` (giữ tương thích ngược 1 tham số cho `VNStockChartPanel.js:220`). Cập nhật lại `Scope` của S10 gồm `CoreDashboardPositionDeck.tsx:105-110, 503-512`, `chartAdapter.js`, `i18n`, và thành phần multicharts mới (hoặc thay `WhaleAnalyticsTab`).

---

### V2-03 [Major cho S2] — Bảng màu §6 mâu thuẫn nội tại (`#0b0f17` vs `#000000`), Scope `S2` thiếu `textOnHeat` (`L72-74`) & test (`L34-36`), và hiện tượng đảo chiều độ sáng

1. **Kiểm chứng toán học WCAG 2.1 trực tiếp bằng Node (1.401 điểm, bước `0.01%`, dải `[-7%, +7%]`)**:
   - Chạy kiểm chứng cho 5 stop đề xuất ở §6 (`#dc2626`, `#f87171`, `#475569`, `#4ade80`, `#16a34a`) với quy tắc `lum(bg) > 0.1791 ? "#000000" : "#ffffff"`:
     - `-7% (#dc2626)`: `lum = 0.1674`, chữ `#ffffff` → **`4.83:1`** (PASS AA; nếu dùng `#0b0f17` chỉ còn `3.97:1` FAIL)
     - `-3% (#f87171)`: `lum = 0.3296`, chữ `#000000` → **`7.59:1`** (PASS AAA)
     - `0% (#475569)`: `lum = 0.0886`, chữ `#ffffff` → **`7.58:1`** (PASS AAA)
     - `+3% (#4ade80)`: `lum = 0.5526`, chữ `#000000` → **`12.05:1`** (với `#0b0f17`: `11.01:1`)
     - `+7% (#16a34a)`: `lum = 0.2686`, chữ `#000000` → **`6.37:1`** (PASS AA)
     - Toàn dải `[-7%, +7%]` (`1401` điểm): **min = `4.59:1`** tại `-6.54%` (`#df2f2f`, chữ `#000000`) → **100% đạt WCAG AA (`>= 4.5:1`)** với điều kiện `textOnHeat` phải trả `"#000000"` và ngưỡng `0.1791`.
2. **Hai lỗi cụ thể còn sót trong Plan v2**:
   - **Mâu thuẫn bảng §6 (`L167`)**: Dòng `-3%` (`L165`) và `+7%` (`L168`) ghi `textOnHeat = #000000`, nhưng dòng `+3% (#4ade80)` (`L167`) vẫn ghi `#0b0f17` (`11.01:1`). Hàm `textOnHeat` chỉ trả 1 hằng số tối (`#000000`), khi đổi thì dòng `+3%` cũng sẽ trả `#000000` (`12.05:1`).
   - **Thiếu file/line trong Scope S2 (`L267`)**: Scope chỉ liệt kê `PortfolioHeatmap.js:27-33` và `heatmap-scale.component.test.ts:15-31`, **bỏ sót**:
     - [`PortfolioHeatmap.js:72-74`](../packages/web/src/components/dashboard/PortfolioHeatmap.js#L72-L74) nơi định nghĩa `textOnHeat` (hiện là `return lum(bg) > 0.35 ? "#0b0f17" : "#fff"`).
     - [`heatmap-scale.component.test.ts:26-37`](../packages/web/src/components/dashboard/__tests__/heatmap-scale.component.test.ts#L26-L37) nơi dòng `L34-36` đang assert cứng `expect(textOnHeat(...)).toBe("#0b0f17")`! Nếu sửa `textOnHeat` sang `"#000000"` mà không cập nhật `L34-36`, `npm run test:components` sẽ fail ngay!
3. **Lưu ý UI/UX — Đảo chiều độ chói & đổi màu chữ 3 lần trên cùng 1 treemap**:
   - Theo số đo thật, vùng nhẹ `±3%` (`#f87171` lum `0.3296`, `#4ade80` lum `0.5526`) **sáng rực hơn hẳn** vùng kịch biên `±7%` (`#dc2626` lum `0.1674`, `#16a34a` lum `0.2686`), và màu chữ tự động trên thang giá đổi tới 3 lần: **Trắng (`-7%`) → Đen (`-3%`) → Trắng (`0%`) → Đen (`+3%..+7%`)**. Nên xác nhận với Owner trước khi chốt bảng màu ở Q1.

---

### V2-04 [Major cho S1 & S3] — Thiếu hàm `formatHeatmapLabel` (`PortfolioHeatmap.js:93-108`) và line range gán `label.color` trong Scope `S1` & `S3`

1. **Với Slice S1 (`L256-257`)**:
   - Đã kiểm chứng mã nguồn ECharts 6 ([`TreemapSeries.js:65-99`](../packages/web/node_modules/echarts/lib/chart/treemap/TreemapSeries.js#L65-L99) và [`TreemapView.js:751-760`](../packages/web/node_modules/echarts/lib/chart/treemap/TreemapView.js#L751-L760)): ECharts đọc `nodeModel.getModel('label')` ưu tiên `data[i].label` rồi mới xuống `levels` / `series.label`. Do đó hướng sửa của S1 là **đúng đắn**.
   - Tuy nhiên, dòng `Scope:` của S1 (`L256`) chỉ ghi `PortfolioHeatmap.js:319,359`, chưa liệt kê [`PortfolioHeatmap.js:129`](../packages/web/src/components/dashboard/PortfolioHeatmap.js#L129) (`groupTinyTiles`) và [`PortfolioHeatmap.js:219`](../packages/web/src/components/dashboard/PortfolioHeatmap.js#L219) (`chartData`) — là 2 nơi thay `labelColor: textOnHeat(bg)` thành `label: { color: textOnHeat(bg) }` (có thể giữ `labelColor` nếu test ngoài dùng).
2. **Với Slice S3 (`L276-278`)**:
   - Scope S3 chỉ liệt kê `PortfolioHeatmap.js:171-228` (`chartData`) và `L279-291` (treemap tooltip), **bỏ quên hoàn toàn**:
     1) [`formatHeatmapLabel` (`PortfolioHeatmap.js:93-108`)](../packages/web/src/components/dashboard/PortfolioHeatmap.js#L93-L108): đây là hàm quyết định text vẽ trực tiếp lên ô treemap/sunburst. Hiện tại `L102` và `L107` luôn tính `Number(d.changePct || 0).toFixed(2)%`. Nếu không check `d.hasQuote === false` trong `formatHeatmapLabel` (cùng cập nhật [`heatmap-scale.component.test.ts:44-70`](../packages/web/src/components/dashboard/__tests__/heatmap-scale.component.test.ts#L44-L70)), **trên ô canvas vẫn hiện `0.00%` chứ không bao giờ hiện `"Chưa có giá"` hay `"—"`**!
     2) Sunburst tooltip formatter tại [`PortfolioHeatmap.js:334-343`](../packages/web/src/components/dashboard/PortfolioHeatmap.js#L334-L343).
     3) Điều kiện nhận biết thiếu quote ở `DashboardPage.tsx` vs `PortfolioHeatmap.js`: tại [`DashboardPage.tsx:261`](../packages/web/src/pages/DashboardPage.tsx#L261), đối với mã tracked chưa có giá, FE gán `current_price: Number(quote.current_price || tracked?.current_price || 0)` (`0`, **không phải `null`**). Do đó ở `PortfolioHeatmap.js:173-175`, điều kiện không có giá phải kiểm tra `!(Number(quote?.current_price ?? h?.current_price) > 0)` (hoặc `quote?.current_price == null && Number(h?.current_price || 0) <= 0`), **chứ không chỉ `quote?.current_price == null`**.

---

### V2-05 [Major cho S11 & S13] — Chưa xác định nguyên nhân FE khiến Market Breadth báo giả `▲ 0 · ■ 5 · ▼ 0` (`useRealtimeFeedCore.js:549-557` + `DashboardPage.tsx:212-227`)

- **Bằng chứng code thật**:
  1. Tại [`useRealtimeFeedCore.js:549-557`](../packages/web/src/hooks/useRealtimeFeedCore.js#L549-L557), ngay khi nhận `symbols` từ danh mục (`5` mã), hook tạo sẵn object giữ chỗ rỗng `{ symbol: normalizedSymbol }` (không hề có `current_price`, `change_pct` hay `change_value`).
  2. Tại [`DashboardPage.tsx:212-227`](../packages/web/src/pages/DashboardPage.tsx#L212-L227), `calculatedBreadth` duyệt qua `Object.values(mergedQuotes)`:
     ```ts
     const change = Number(q?.change_value ?? q?.change_pct ?? q?.change ?? 0);
     if (change > 0) up++;
     else if (change < 0) down++;
     else flat++;
     ```
     Khi `q` chỉ là placeholder `{ symbol: 'AAA' }`, mọi field change đều là `undefined` → rơi về `0` → tăng `flat++` (`L223`)! Đó là nguyên nhân chính xác tạo ra `▲ 0 · ■ 5 · ▼ 0` trên ảnh chụp staging (`L55` của Plan v2).
- **Thiếu sót của Plan v2 (`S11` & `S13`)**:
  - Cả `S11` (`L343-349`) lẫn `S13` (`L359-366`) đều không đưa `DashboardPage.tsx:212-227` vào Scope.
  - Để phân biệt **5 mã chưa có quote** (hiện `"Chưa có dữ liệu giá"`) với **5 mã có quote thật và đều đứng giá tham chiếu** (hiện `■ 5`), `calculatedBreadth` tại `DashboardPage.tsx:216` phải bỏ qua các object chưa có dữ liệu giá/biến động thực (ví dụ: bỏ qua khi `q?.change_pct == null && q?.change_value == null && q?.change == null && !(Number(q?.current_price) > 0)`), đồng thời giữ tương thích với [`DashboardPage.breadth-dedup.component.test.ts:6-34`](../packages/web/src/pages/DashboardPage.breadth-dedup.component.test.ts#L6-L34).

---

### V2-06 [Minor cho S8] — `CoreDashboardPositionDeck.tsx:217-230` tự sinh 5 dòng toàn `null` khi API `/technicals/bulk/` rỗng

- Tại [`CoreDashboardPositionDeck.tsx:217-231`](../packages/web/src/components/dashboard/CoreDashboardPositionDeck.tsx#L217-L231), `filteredTechnicals` luôn map `symbolsToShow` (`5` mã) sang `{ symbol: upperSym, rsi_14: null, sma20: null, sma50: null, momentum_20d_pct: null }` khi `technicals` rỗng.
- Tại `L448-449`, UI hiện tại chỉ kiểm tra `pagedTechnicals.length === 0`, nên trạng thái rỗng không bao giờ kích hoạt khi có holdings/trackedSymbols → in 5 dòng `--`.
- Vì vậy, trong Scope `S8` (`L316-318`), cần ghi rõ `CoreDashboardPositionDeck.tsx:445-501` phải check `technicalsStatus?.status === 'failed'` (kèm nút `refresh` / thử lại) và kiểm tra trường hợp tất cả các dòng đều toàn `null` (`filteredTechnicals.every(t => t.rsi_14 == null && t.sma20 == null && t.sma50 == null && t.momentum_20d_pct == null)`) trước khi render bảng dữ liệu.

---

## 3. Ma trận đánh giá sẵn sàng từng Slice (`S1..S13` Readiness Matrix)

| Slice | Tên & Claim key | Trạng thái Audit | Điều kiện / Điểm phải sửa trước khi code |
|---|---|---|---|
| **S1** | `dashboard-heatmap-label-fix` | **`READY` (kèm ghi chú)** | Ý tưởng & ECharts semantics chuẩn. Lưu ý mở rộng Scope sửa cả [`PortfolioHeatmap.js:129, 219`](../packages/web/src/components/dashboard/PortfolioHeatmap.js#L129) ngoài `L319, L359` (`V2-04`). |
| **S2** | `dashboard-heatmap-palette` | **`CONDITIONAL` (`V2-03`)** | Phải thêm [`PortfolioHeatmap.js:72-74`](../packages/web/src/components/dashboard/PortfolioHeatmap.js#L72-L74) (`textOnHeat` ngưỡng `0.1791`, `#000000`) + [`heatmap-scale.component.test.ts:26-37`](../packages/web/src/components/dashboard/__tests__/heatmap-scale.component.test.ts#L26-L37) (`#0b0f17` → `#000000`), sửa bảng §6 `L167`, và xác nhận Q1 với Owner. |
| **S3** | `dashboard-heatmap-empty-state` | **`CONDITIONAL` (`V2-04`)** | Phải thêm [`formatHeatmapLabel` (`L93-108`)](../packages/web/src/components/dashboard/PortfolioHeatmap.js#L93-L108) + test `L44-70` + sunburst tooltip (`L334-343`) + check `!(Number(price) > 0)` (vì `DashboardPage.tsx:261` gán `0` chứ không `null`). |
| **S4** | `dashboard-triad-grid-focal` | **`READY`** | Sửa `.dashboard-triad-grid` CSS Grid trong `index.css:490-502`. Lưu ý tránh trùng phạm vi nếu `S12` chạy song song. |
| **S5** | `dashboard-heatmap-other-toggle` | **`READY`** | Sửa `groupTinyTiles` + nút `showAllTiles` + `heatmap-scale.component.test.ts:74-89`. |
| **S6** | `dashboard-ai-alert-timeout` | **`READY`** | Sửa đúng [`AIAdvisorAlertPanel.js:144-176`](../packages/web/src/features/dashboard/AIAdvisorAlertPanel.js#L144-L176) + `AbortController` 10s + kiểm tra chậm ở BE `/core/v1/signals/ai-alerts/feed`. |
| **S7** | `dashboard-ai-deck-fix` | **`BLOCKED BY S9 & V2-01`** | Không được chạy ở Thứ tự 5 trước S9. Phải chạy SAU (hoặc gộp) S9; mở rộng Scope sang `L38-56, L123, L141-148`, gỡ card Sharpe (D7), thiết kế lại công thức Health Score 100 điểm. |
| **S8** | `dashboard-technical-tab-wiring` | **`CONDITIONAL` (`V2-06`)** | Bổ sung xử lý mảng 5 dòng toàn `null` tại `CoreDashboardPositionDeck.tsx:217-231, 445-501` kèm callback `onRetry` khi `technicalsStatus.status === 'failed'`. |
| **S9** | `dashboard-kpi-data-fix` | **`CONDITIONAL` (`V2-01`)** | Chuyển lên chạy TRƯỚC S7. Map đúng `benchmark.alpha_annualized * 100`, `risk.max_drawdown * 100`, `risk.volatility * 100`; xử lý card thứ 3 (`Sharpe` → `Volatility` hoặc 3 cột) tại `SmartStatsHeader.js:57-62, 96-101`. |
| **S10** | `dashboard-multicharts-replace-whale` | **`BLOCKED BY V2-02 & Q3`** | Chờ Owner chốt Q3 + Tier Gating. Phải giải quyết bug `_onBarCallback` đơn của [`chartAdapter.js:114-127`](../packages/web/src/adapters/chartAdapter.js#L114-L127) (per-chart adapter hoặc `Map` theo symbol) + sửa lại Scope (bỏ nhầm `AIAdvisorDeckPanel.jsx`). |
| **S11** | `dashboard-breadth-alert-polish` | **`CONDITIONAL` (`V2-05`)** | Bổ sung sửa [`DashboardPage.tsx:212-227`](../packages/web/src/pages/DashboardPage.tsx#L212-L227) để không đếm placeholder `{ symbol }` chưa có quote thành `■ 5`. |
| **S12** | `dashboard-visual-polish` | **`READY`** | Thực thi sau cùng khi S1–S11 ổn định để tránh xung đột visual baseline & CSS. |
| **S13** | `dashboard-data-layer` | **`CONDITIONAL` (`V2-05`)** | Cần phối hợp BE (`SymbolSnapshot` / `DailyPrice` 180d / AI advisory) và chốt placeholder `quotesBySymbol` (`useRealtimeFeedCore.js:549-557`). |

---

## 4. Khuyến nghị thứ tự triển khai thực tế sau Re-Audit Vòng 2

1. **Có thể khởi động ngay (không cần đợi chốt hết 6 câu hỏi Owner)**:
   - **S1 (`dashboard-heatmap-label-fix`)** — sửa bug hiển thị chữ heatmap (`L129, L219, L319, L359`), giải phóng nút thắt thị giác số 1 mà không đụng bảng màu hay test màu.
   - **S6 (`dashboard-ai-alert-timeout`)** — thêm `AbortController` timeout + retry cho `AIAdvisorAlertPanel.js` và đo endpoint `/core/v1/signals/ai-alerts/feed` trên staging.
   - **S8 (`dashboard-technical-tab-wiring`)** — nối `technicalsStatus` xuống `CoreDashboardPositionDeck.tsx` (nhớ lưu ý `V2-06`).
2. **Đảo thứ tự bắt buộc**: chạy **S9 (`dashboard-kpi-data-fix`) TRƯỚC S7 (`dashboard-ai-deck-fix`)** theo `V2-01`.
3. **Các nhóm cần bổ sung spec trước khi khai claim**: `S2` (`V2-03` + Owner Q1), `S3` (`V2-04`), `S7` (`V2-01` Health Score), `S10` (`V2-02` + Owner Q3 + Tier Gating), `S11/S13` (`V2-05`).

---
---

# PHẦN I — AUDIT ĐỘC LẬP VÒNG 1 (Bản kế hoạch v1 — Lịch sử đối chiếu)

- **Đối tượng audit Vòng 1**: `docs/PLAN_DASHBOARD_REFACTOR_20261114.md` bản v1 (264 dòng), [`docs/CODE_CHANGE_AUDIT_LEDGER.md`](CODE_CHANGE_AUDIT_LEDGER.md#L1-L10) (Entry 491), ảnh chụp [`dashboard-full2.png`](file:///C:/Users/vietd/AppData/Local/Temp/opencode/dashboard-full2.png), và script [`audit-dashboard4.js`](file:///C:/Users/vietd/AppData/Local/Temp/opencode/audit-dashboard4.js).

## Kết luận tổng thể Vòng 1 (Verdict)

**`NEED_REVISION`** — **Chặn chuyển sang B4 (Đồng thuận) / B5 (Claim) / B6 (Code).**

Kế hoạch gốc mắc **5 lỗi Blocker (`BL-01..BL-05`)**, **4 lỗi Major (`MJ-06..MJ-09`)**, và **1 lỗi Minor quy trình (`MN-10`)**. Nguyên nhân gốc: kế hoạch suy đoán kiến trúc và số liệu từ ảnh chụp màn hình đầu tiên (không click qua các tab, không đọc code BE tương ứng, không kiểm tra mã nguồn ECharts/Widget `.d.ts`, và không chạy phép tính tương phản WCAG thật). Nếu triển khai nguyên trạng sẽ sửa nhầm component, phá chuẩn WCAG AA nặng hơn hiện tại, viết code sai API của `@vninvestcharts/widget`, và làm hỏng unit test/gate sẵn có.

---

## 1. Phạm vi đã kiểm chứng trực tiếp (Evidence đã đọc ở Vòng 1)

- **Live screenshot & script**: `dashboard-full2.png` (1440×900) và `audit-dashboard4.js:1-53`.
- **Frontend**:
  - `packages/web/src/pages/DashboardPage.tsx:140-175, 340-451`
  - `packages/web/src/features/dashboard/useCoreDashboardData.js:85-210`
  - `packages/web/src/components/dashboard/PortfolioHeatmap.js:25-150, 170-370, 430-450, 525-555`
  - `packages/web/src/components/dashboard/__tests__/heatmap-scale.component.test.ts:1-90`
  - `packages/web/src/components/dashboard/SmartStatsHeader.js:1-205`
  - `packages/web/src/features/dashboard/AIAdvisorAlertPanel.js:1-200`
  - `packages/web/src/components/dashboard/AIAdvisorDeckPanel.jsx:1-75, 155-234`
  - `packages/web/src/components/dashboard/CoreDashboardPositionDeck.tsx:80-120, 200-240, 470-531`
  - `packages/web/src/components/dashboard/WhaleAnalyticsTab.jsx:1-80`
  - `packages/web/src/components/VNStockChartPanel.js:65-105, 135-260, 350-560`
  - `packages/web/src/pages/watchlist/components/WatchlistDetailPanel.tsx:1-50`
  - `packages/web/src/adapters/core/workspace.js:240-270`
  - `packages/web/src/index.css:485-515`
  - `packages/web/package.json:1-90` & `packages/web/scripts/check-tokens.mjs:1-40`
- **Thư viện bên thứ 3 (`node_modules`)**:
  - `packages/web/node_modules/echarts/lib/label/labelStyle.js:370-395`
  - `packages/web/node_modules/echarts/lib/chart/treemap/TreemapView.js:735-785`
  - `packages/web/node_modules/@vninvestcharts/widget/dist/dts/widget/VNInvestMultiCharts.d.ts:1-8`
  - `packages/web/node_modules/@vninvestcharts/widget/dist/dts/widget/VNInvestMultiCharts.types.d.ts:1-132`
  - `packages/web/node_modules/@vninvestcharts/widget/dist/dts/widget/VNInvestCharts.d.ts:1-5`
- **Backend**:
  - `packages/core/backend/src/user_workspace/portfolio_analytics_views.py:270-420, 575-655, 720-750, 2675-2730`
  - `packages/core/backend/src/market_data/stock_mgmt_native_views.py:1420-1490`
  - `packages/core/backend/src/market_serving/native_views.py:110-140`
  - `packages/core/backend/src/signal_intelligence/views.py:445-495`

---

## 2. Đối chiếu Thực tế Giao diện (`dashboard-full2.png`) vs Tuyên bố trong Plan v1

| Hạng mục | Tuyên bố trong `PLAN_DASHBOARD_REFACTOR_20261114.md` (v1) | Thực tế quan sát trên `dashboard-full2.png` & Code |
|---|---|---|
| **Chữ trên ô Heatmap** | *"tile AAA/FPT/GAS/GEX/VRE đều hiện `--` (không có giá/biến động)"* (§2 L31 v1) | Cả 5 ô đang vẽ chữ **`VRE 0.00%`**, **`GAS 0.00%`**, **`GEX 0.00%`**, **`FPT 0.00%`**, **`AAA 0.00%`** (`PortfolioHeatmap.js:102, 174` ép `Number(undefined \|\| 0) = 0`), nhưng ruột chữ bị tô **trùng màu nền `#2f3747`** nên chìm nghỉm, chỉ thấy viền đen mờ! (Xem `BL-03`) |
| **Vị trí khối AI treo loading** | *"AI tab: `Tín hiệu AI — Đang tải... Đang phân tích dữ liệu dòng tiền và RSI...` (treo loading)"* (§2 L33, F5 L50, B3 L97 v1) | Trên ảnh, tab đang mở ở Deck là **"Tổng quan"** (pill xanh lá); tab **"AI Bot"** hoàn toàn chưa được click (`audit-dashboard4.js:1-53`). Khung *"Tín hiệu AI — Đang tải..."* nằm ở **cột phải hàng trên (Triad Grid)** = [`AIAdvisorAlertPanel.js:144-176`](../packages/web/src/features/dashboard/AIAdvisorAlertPanel.js#L144-L176), **KHÔNG** phải [`AIAdvisorDeckPanel.jsx`](../packages/web/src/components/dashboard/AIAdvisorDeckPanel.jsx)! (Xem `BL-01`) |
| **Độ rộng cột Heatmap** | *"3 lane chia đều... heatmap lane `flex-[2]` thay vì `flex-1`"* (F7-F8 L52-53, A3 L79 v1) | `.dashboard-triad-grid` dùng **CSS Grid** `grid-template-columns: 1fr 1.5fr 1fr` ([`index.css:490-492`](../packages/web/src/index.css#L490-L492)). Cột giữa trên ảnh thực sự rộng gấp **1.5 lần** mỗi cột bên. `flex-[2]` vô tác dụng trong CSS Grid. (Xem `MJ-06`) |
| **Nhóm "Khác"** | *"`"Khác"` vô nghĩa, mất chi tiết per-stock"* (F2 L47, §12 L247 *"Số tile 'Khác' hiển thị chi tiết: 0 (gom hết)"* v1) | Ảnh chụp staging chỉ có 5 mã (`AAA, FPT, GAS, GEX, VRE`), `groupedCount = 0` — **không hề có node "Khác"** trên staging. Ngoài ra, tính năng click node `"Khác"` + nút toggle đã tồn tại sẵn (`PortfolioHeatmap.js:438-441, 535-547`). (Xem `MJ-07`) |

---

## 3. Chi tiết các phát hiện Audit Vòng 1 (BL-01 .. MN-10)

### BL-01 [Blocker] — Nhầm lẫn hoàn toàn `AIAdvisorAlertPanel` (Triad lane) với `AIAdvisorDeckPanel` (tab AI Bot)
- **Plan sai ở đâu**: §2 L33, §3 F5 L50, §4 B3 L97-98 (bản v1) chỉ định sửa `AIAdvisorDeckPanel` để xử lý thông báo `"Tín hiệu AI — Đang tải... Đang phân tích dữ liệu dòng tiền và RSI..."` với timeout 10s + retry.
- **Sự thật codebase**:
  - Thông báo trên thuộc về [`AIAdvisorAlertPanel.js:144, 161, 171-176`](../packages/web/src/features/dashboard/AIAdvisorAlertPanel.js#L144-L176) (mount tại [`DashboardPage.tsx:408`](../packages/web/src/pages/DashboardPage.tsx#L408) trong lane phải của Triad Grid), nơi gọi `coreApiAdapter.getAIAlertsFeed()` (`/core/v1/signals/ai-alerts/feed` → [`AIAlertsFeedView`](../packages/core/backend/src/signal_intelligence/views.py#L468) không có timeout/AbortController).
  - Trong khi đó, [`AIAdvisorDeckPanel.jsx:1-234`](../packages/web/src/components/dashboard/AIAdvisorDeckPanel.jsx#L1-L234) (tab `'ai'` tại [`CoreDashboardPositionDeck.tsx:109, 515`](../packages/web/src/components/dashboard/CoreDashboardPositionDeck.tsx#L515)) **không có bất kỳ loading state, spinner hay lời gọi API `/ai-alerts/` nào**.
- **Bug thật của `AIAdvisorDeckPanel.jsx` bị bỏ sót**:
  1. [`CoreDashboardPositionDeck.tsx:86`](../packages/web/src/components/dashboard/CoreDashboardPositionDeck.tsx#L86) mặc định `symbolScope = 'all'`, truyền xuống `AIAdvisorDeckPanel` (`L522`), nhưng `AIAdvisorDeckPanel.jsx:23` kiểm tra `const isHoldingsScope = symbolScope === 'holdings'`. Vì mặc định `'all' !== 'holdings'`, khi người dùng click tab "AI Bot" sẽ luôn rơi vào chế độ monitor banner vàng (`AIAdvisorDeckPanel.jsx:169-171`), ẩn Điểm sức khỏe & nút Tối ưu hóa.
  2. Kể cả khi chọn scope `'holdings'`, `AIAdvisorDeckPanel.jsx:30-34` kiểm tra `analytics.sharpe_ratio`, `analytics.alpha_annual_pct`, `analytics.max_drawdown_pct` — các field mà endpoint `/analytics/` không bao giờ trả về (xem `BL-05`), khiến `hasData` luôn là `false`.

### BL-02 [Blocker] — Số liệu tương phản màu Heatmap trong §6 & §12 sai toán học WCAG, vi phạm WCAG AA (< 4.5:1), phá `check:tokens` và unit test
- **Tuyên bố sai về bảng màu hiện tại**: Plan v1 (§12 L246) tuyên bố bảng màu hiện tại chỉ đạt `~3:1`. Đo trực tiếp bằng công thức sRGB luminance + `textOnHeat` của [`PortfolioHeatmap.js:36-74`](../packages/web/src/components/dashboard/PortfolioHeatmap.js#L36-L74) trên toàn dải `-7%..+7%`:
  - `-7% (#7f1d1d)`: lum `0.0548`, chữ `#ffffff` → **`10.02:1`** (WCAG AAA)
  - `-3% (#5b2228)`: lum `0.0352`, chữ `#ffffff` → **`12.32:1`** (WCAG AAA)
  - `0% (#2f3747)`: lum `0.0379`, chữ `#ffffff` → **`11.94:1`** (WCAG AAA)
  - `+3% (#14532d)`: lum `0.0652`, chữ `#ffffff` → **`9.11:1`** (WCAG AAA)
  - `+7% (#166534)`: lum `0.0973`, chữ `#ffffff` → **`7.13:1`** (WCAG AAA)
  - Giá trị min toàn dải cũ là **`7.13:1`** (không phải `~3:1`).
- **Bảng màu đề xuất trong §6 v1 FAIL WCAG AA nặng nề** với `lum(bg) > 0.35 ? "#0b0f17" : "#fff"`:
  - `-3% (#f87171)` (`lum=0.3296 <= 0.35`): chữ `#fff` → **`2.77:1` FAIL**
  - `+7% (#16a34a)` (`lum=0.2686 <= 0.35`): chữ `#fff` → **`3.30:1` FAIL**
  - Điểm nội suy `+5.68%` (`#27b65c`, `lum=0.3466`): chữ `#fff` → **`2.65:1` FAIL**.
  - Ràng buộc toán học: với màu chữ tối `#0b0f17` (`lum = 0.00475`), điểm cân bằng với `#ffffff` đạt tối đa **`4.38:1`** (`< 4.5:1`). Phải đổi sang `#000000` với ngưỡng `lum(bg) > 0.1791` (điểm cân bằng `4.58:1`) hoặc thu hẹp dải màu.
- **Lỗ hổng gate & vỡ test**:
  - `#dc2626` và `#16a34a` **không nằm trong `allowHex`** tại [`packages/web/scripts/check-tokens.mjs:10-29`](../packages/web/scripts/check-tokens.mjs#L10-L29).
  - [`heatmap-scale.component.test.ts:15-31`](../packages/web/src/components/dashboard/__tests__/heatmap-scale.component.test.ts#L15-L31) assert cứng `#7f1d1d`, `#166534`, `#2f3747`.

### BL-03 [Blocker] — Bỏ sót bug gốc làm chữ trên Heatmap bị rỗng/tối đen trên ảnh chụp (`PortfolioHeatmap.js:319, 359` + ECharts 6)
- Trong `dashboard-full2.png`, chữ `VRE 0.00%`, `GAS 0.00%` bị đen sẫm gần như vô hình trên nền `#2f3747`, dù `textOnHeat('#2f3747') === '#fff'`.
- Nguyên nhân kỹ thuật thực tế tại [`PortfolioHeatmap.js:319`](../packages/web/src/components/dashboard/PortfolioHeatmap.js#L319) (treemap) và `L359` (sunburst): truyền **hàm callback** vào `series.label.color`. ECharts 6 ([`TreemapView.js:754-760`](../packages/web/node_modules/echarts/lib/chart/treemap/TreemapView.js#L754-L760) và [`labelStyle.js:380-384`](../packages/web/node_modules/echarts/lib/label/labelStyle.js#L380-L384)) không gọi callback cho `label.color`, gán thẳng Function vào `textStyle.fill` → Canvas 2D bỏ qua và giữ nguyên fill nền `#2f3747` (contrast `1.0:1`), chỉ còn viền `textBorderColor`.

### BL-04 [Blocker] — §5 Tích hợp `VNInvestMultiCharts` sai Props API, trích file không tồn tại, bỏ qua Enterprise Tier Gate
- `packages/web/src/types/vninvestcharts-widget.d.ts` **không tồn tại** (`L-T02`). Contract thật nằm ở `packages/web/node_modules/@vninvestcharts/widget/dist/dts/widget/VNInvestMultiCharts.types.d.ts`.
- `VNInvestMultiChartsProps` nhận `charts`, `layout`/`defaultLayout`, `defaultChartProps`, `licenseKey`, `maxCharts`, `onTierLimitExceeded` — **không có** `symbols`, `adapter`, `realtimeFeed`.
- `VNInvestMultiCharts` gắn gói **Enterprise** (tier gating, `VNStockChartPanel.js:75-88`).

### BL-05 [Blocker] — Chẩn đoán sai nguyên nhân KPI (`GIÁ TRỊ DANH MỤC`, `Alpha`, `Beta`, `Sharpe`, `Drawdown`) hiển thị `—` / `--`
- `useCoreDashboardData.js:135` gọi `/analytics/` (`PortfolioAnalyticsView` chỉ trả `{ summary, note }`), chưa gọi `getPortfolioMetrics` (`GET /core/v1/workspace/portfolios/<id>/metrics/`, `PortfolioMetricsView`).
- Ràng buộc **D7** (`portfolio_analytics_views.py:582-585`, `workspace.js:248-251`) cấm FE vẽ `sharpe`/`sortino`/`correlation`.
- `GIÁ TRỊ DANH MỤC` & `LÃI/LỖ` là `—` vào Thứ Bảy `2026-11-14` vì `PortfolioSummaryView` (`L323-392`) lọc `SymbolSnapshot` đúng `session_date=date.today()` (fail-closed) và đã trả sẵn `market_value_reason`, trong khi FE bỏ rơi field này và `SmartStatsHeader.js:42-65` đã có CTA cho `marketValue === 0`.

### MJ-06 .. MN-10 (Vòng 1)
- `MJ-06`: `.dashboard-triad-grid` (`index.css:490-502`) dùng CSS Grid `1fr 1.5fr 1fr`, `flex-[2]` vô tác dụng.
- `MJ-07`: `PortfolioHeatmap.js:438-441, 535-547` đã có click node `"Khác"` + toggle; nâng ngưỡng `> 8` lên `> 15` làm gãy `heatmap-scale.component.test.ts:72-90`.
- `MJ-08`: BE đã có `StockManagementTechnicalsView` (`stock_mgmt_native_views.py:1423-1475`, cửa sổ 180d `DailyPrice`), `useCoreDashboardData.js:93, 166-196` đã có `technicalsStatus`, nhưng `DashboardPage.tsx:146-158, 428-443` không truyền xuống `CoreDashboardPositionDeck`.
- `MJ-09`: `WhaleAnalyticsTab.jsx:1-80` & `PortfolioWhaleAnalyticsView` (`L2677-2730`) hoạt động thật; thay thế bằng Multicharts là yêu cầu sản phẩm của Owner.
- `MN-10`: Thiếu `Lessons áp dụng`, `MANDATORY CHECKLIST`, `SCOPE`, `Given/When/Then`, rollback; ghi `Entry 491` sớm; sai tên script npm (`node ./scripts/check-*.mjs`).

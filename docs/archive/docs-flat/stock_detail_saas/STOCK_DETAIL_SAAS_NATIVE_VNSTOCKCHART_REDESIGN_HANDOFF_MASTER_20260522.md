# HANDOFF MASTER — Stock Detail SaaS Native VNStockChart Redesign

**Ngày**: 2026-05-22  
**Status**: APPROVED FOR IMPLEMENTATION HANDOFF  
**Phạm vi**: Tái thiết kế `/stocks/:symbol` thành chart-first workstation trên kiến trúc SaaS native, dùng `VNStockChart` làm surface trung tâm, khóa chặt cả thiết kế frontend lẫn thiết kế backend để đội code thực hiện không cần hỏi lại.

---

## 1. Vì sao cần workstream này

`/stocks/:symbol` hiện đã đi vào `packages/web`, nhưng mới ở mức MVP:

| Thành phần | Hiện trạng | Rủi ro nếu không khóa lại |
|---|---|---|
| Hero chart | Có `VNStockChartPanel` cơ bản | Dễ bị kéo lùi thành một card chart bình thường thay vì workspace trung tâm |
| Chart shell | Chưa có toolbar/meta strip/range footer theo ngôn ngữ VNStockChart reference | Đội code dễ dựng lệch visual shell và sai hierarchy |
| Selected session | Có nhưng chưa là SSOT cứng cho toàn page | Dễ sinh nhiều truth song song giữa chart, order flow, advisory |
| Order flow | Có panel nhưng chưa khóa vị trí chiến lược | Dễ bị đặt sang cạnh phải hoặc chìm trong deck phụ |
| User actions | Tracked/watchlist/alerts chưa hoàn chỉnh | Dễ quay lại legacy client hoặc fetch trực tiếp |
| News/fundamentals | Native backend còn stub | Dễ bị dựng giả ở client để “cho đủ UI” |
| SaaS-native boundary | Legacy `frontend/` và `backend/` vẫn có nhiều logic tham chiếu | Dễ xảy ra drift: frontend đẹp nhưng sai đích kiến trúc |

---

## 2. Quyết định đã khóa

1. Route canonical duy nhất là `/stocks/:symbol`.
2. Entry canonical phải đi qua `packages/web/src/pages/market/ShellStockDetailPage.js`.
3. `VNStockChart` là centerpiece bắt buộc và là selected-session truth owner cho toàn page.
4. Chart shell phải gần với ảnh VNStockChart tham chiếu ở topology: toolbar trong shell, meta strip ngay dưới toolbar, price pane chiếm ưu thế, các pane phụ xếp dọc đồng bộ trục X.
5. `OrderFlowRadarPanel` phải nằm ngay dưới hero chart, full-width, không được đặt ở right rail mặc định.
6. `CVD` phải ở pane riêng; `Buy Strength` và `Institutional Strength` phải ở strength pane riêng.
7. Shark markers chỉ áp dụng cho top 10% nến đang hiển thị trong viewport.
8. Heatmap giai đoạn này chỉ theo `time bucket`, không làm footprint theo giá x thời gian.
9. Mọi text UI mới trong `packages/web` phải đi qua i18n tiếng Việt đầy đủ dấu.
10. Mọi user actions và reads ở web phải đi qua `packages/web/src/adapters/coreApiAdapter.js`; cấm direct fetch, cấm quay lại `frontend/src/api/client.js` như canonical path.
11. Nếu backend phải đổi, chỉ được đổi trong `packages/core/backend/`, chỉ expose qua `/core/v1/*`, và phải qua OpenAPI governance.
12. Nếu `news` hoặc `financials` chưa có native truth, frontend phải hiển thị degraded state rõ ràng; tuyệt đối cấm dựng dữ liệu giả ở client.

---

## 3. Target architecture

```text
Browser
→ /stocks/:symbol
→ frontend host bridge (consumer only)
→ ShellStockDetailPage (@vninvest/web)
→ StockDetailPage (@vninvest/web)
→ coreApiAdapter
→ /core/v1/* core-api routes
```

`frontend/` và `backend/` cũ chỉ được dùng làm parity reference. Không có nghiệm thu nào hợp lệ nếu team chốt feature bằng cách sửa runtime mới trong hai thư mục legacy này.

---

## 4. Target information architecture

```text
[Header bar: symbol, realtime quote, change, market cap, actions]
[Hero chart workspace full-width]
  [Toolbar]
  [Meta strip OHLC/indicator]
  [Price pane + overlays]
  [Volume pane]
  [CVD pane]
  [Strength pane]
  [Range/action footer]
[OrderFlowRadarPanel full-width ngay dưới chart]
[Context deck 2-3 cột: intraday matched, liquidity/depth, alert/advisory summary]
[Deferred deck: news, financials, company profile]
```

---

## 5. Deliverables của doc pack này

| Loại tài liệu | File |
|---|---|
| Handoff Master | `docs/STOCK_DETAIL_SAAS_NATIVE_VNSTOCKCHART_REDESIGN_HANDOFF_MASTER_20260522.md` |
| Implementation Plan | `docs/IMPLEMENTATION_PLAN_STOCK_DETAIL_SAAS_NATIVE_VNSTOCKCHART_REDESIGN_20260522.md` |
| Tech Spec | `docs/TECH_SPEC_STOCK_DETAIL_SAAS_NATIVE_VNSTOCKCHART_REDESIGN_20260522.md` |
| Taskboard | `docs/TASKBOARD_STOCK_DETAIL_SAAS_NATIVE_VNSTOCKCHART_REDESIGN_20260522.md` |
| Traceability Matrix | `docs/STOCK_DETAIL_SAAS_NATIVE_VNSTOCKCHART_REDESIGN_TRACEABILITY_MATRIX_20260522.md` |
| Self Audit & Test Protocol | `docs/STOCK_DETAIL_SAAS_NATIVE_VNSTOCKCHART_REDESIGN_SELF_AUDIT_AND_TEST_PROTOCOL_20260522.md` |
| Execution Evidence Template | `docs/STOCK_DETAIL_SAAS_NATIVE_VNSTOCKCHART_REDESIGN_EXECUTION_EVIDENCE_TEMPLATE_20260522.md` |
| Config Ownership Matrix | `docs/STOCK_DETAIL_SAAS_NATIVE_VNSTOCKCHART_REDESIGN_CONFIG_OWNERSHIP_MATRIX_20260522.md` |
| Code Quality Constitution | `docs/STOCK_DETAIL_SAAS_NATIVE_VNSTOCKCHART_REDESIGN_CODE_QUALITY_CONSTITUTION_20260522.md` |
| Frontend Design | `docs/FRONTEND_DESIGN_STOCK_DETAIL_SAAS_NATIVE_VNSTOCKCHART_REDESIGN_20260522.md` |
| Backend Design | `docs/BACKEND_DESIGN_STOCK_DETAIL_SAAS_NATIVE_VNSTOCKCHART_REDESIGN_20260522.md` |
| Run Code Review | `docs/RUN_CODE_REVIEW_STOCK_DETAIL_SAAS_NATIVE_VNSTOCKCHART_REDESIGN_20260522.md` |
| Run Integration Tests | `docs/RUN_INTEGRATION_TESTS_STOCK_DETAIL_SAAS_NATIVE_VNSTOCKCHART_REDESIGN_20260522.md` |
| Run Spec Audit | `docs/RUN_SPEC_AUDIT_STOCK_DETAIL_SAAS_NATIVE_VNSTOCKCHART_REDESIGN_20260522.md` |

---

## 6. Anchor files

### Frontend — canonical target

1. `packages/web/src/pages/market/ShellStockDetailPage.js`
2. `packages/web/src/pages/StockDetailPage.js`
3. `packages/web/src/components/VNStockChartPanel.js`
4. `packages/web/src/components/OrderFlowRadarPanel.js`
5. `packages/web/src/adapters/coreApiAdapter.js`
6. `packages/web/package.json`

### Backend — canonical target

1. `packages/core/backend/src/market_data/stock_mgmt_native_views.py`
2. `packages/core/backend/src/market_data/core_urls.py`
3. `packages/core/backend/src/market_serving/native_views.py`
4. `packages/core/backend/tests/test_stock_management_api_routes.py`
5. `packages/core/backend/src/market_data/tests/test_stock_management_native_api.py`

### Reference-only sources

1. `frontend/src/pages/StockDetail.jsx`
2. `frontend/src/api/client.js`
3. `docs/KIEN_TRUC_VNSTOCKCHARTS_SMART_MONEY_FLOW_20260522.md`

---

## 7. Định nghĩa thành công

Workstream chỉ được coi là complete khi đồng thời đạt:

1. `/stocks/:symbol` là stock detail SaaS-native hoàn chỉnh, không còn dựa vào legacy runtime logic như end-state.
2. Hero chart dùng topology VNStockChart reference nhưng bám đúng semantics nghiệp vụ của VNInvest.
3. `OrderFlowRadarPanel` nằm ngay dưới chart và bám selected session truth.
4. Tracked/watchlist/alert actions chạy qua `coreApiAdapter` và native contracts.
5. Không có module nào dựng fake data để lấp chỗ trống từ backend stubs.
6. Frontend design và backend design đều được khóa đủ chặt để đội code không có khoảng trống diễn giải tùy tiện.
7. Tất cả gates review, integration tests, spec audit, ledger/progress/module-tree đều hoàn tất.

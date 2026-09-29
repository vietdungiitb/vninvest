# EXECUTION PLAN: Whale Alerts Symbol Kline Refactor

**Ngày tạo**: 2026-04-27  
**Phạm vi chương trình**: Whale Alerts Symbol Workspace Upgrade  
**Level**: A (Major - thay đổi frontend route composition, bubble analytics integration, AI advisory integration và có khả năng mở rộng data contract backend)  
**Owner**: Frontend Lead + Backend Lead + QA Lead  
**Reviewer**: Project Lead / Final Auditor  
**Trạng thái**: READY FOR IMPLEMENTATION HANDOFF

---

## 1. Business Objective

### Vấn đề cần giải quyết

Trang `whale-alerts/:symbol` hiện vẫn chia nhỏ trải nghiệm thành nhiều khối chart rời rạc:

- chart nến/dark money hiện hành không cùng ngữ nghĩa với chart ở Stock Detail,
- CVD/Strength tách khỏi nến nên người dùng phải tự ghép dữ liệu bằng mắt,
- bubble chart của luồng whale analytics chưa gắn chặt với phiên đang xem trên route symbol,
- advisory AI ở bubble chart không thống nhất với advisory module mạnh hơn đang có ở Stock Detail,
- bố cục phải chứa thêm các module chiến thuật nhưng chưa có nguyên tắc cô đặc thông tin,
- route hiện tại còn mang dấu vết của nhiều generation chart khác nhau nên khó bảo trì.

### Mục tiêu nghiệp vụ

1. Đưa `whale-alerts/:symbol` về một workspace phân tích theo phiên với một KlineChart trung tâm.
2. Hợp nhất toàn bộ tín hiệu whale buy/sell, CVD, buy/sell strength và institutional strength lên cùng trục thời gian của chart nến.
3. Khi người dùng click một phiên trên KlineChart, bubble chart phía dưới phải hiển thị đúng dữ liệu của phiên đó.
4. Bubble chart dùng bản sao của modern dashboard, không được gây regression cho module nguồn.
5. Advisory AI cho bubble chart phải dùng logic/adapter từ Stock Detail nhưng chỉ nói về phiên đang chọn.
6. Loại bỏ code chart cũ dư thừa sau khi cutover hoàn tất.

### KPI đầu ra

| Chỉ số | Baseline | Mục tiêu |
|---|---:|---:|
| Số chart rời rạc ở vùng trung tâm whale-alerts/symbol | 3+ | 1 KlineChart chính + 1 bubble chart theo phiên |
| Tỷ lệ mismatch giữa phiên đang xem và bubble session | Có rủi ro | 0 |
| Regression trên modern dashboard whale bubble | Rủi ro cao nếu sửa trực tiếp | 0 |
| Tỷ lệ tooltip hiển thị sai bucket dữ liệu | Có rủi ro | 0 |
| Tỷ lệ nến nổi bật cá mập không cập nhật theo zoom/pan | Chưa có | 0 |

---

## 2. Locked Directives and Hard Constraints

### 2.1 Quyết định đã khóa

1. Chart trung tâm mới phải dùng KlineChart theo hành vi đang chạy ở `StockDetail`, không dùng Recharts/ECharts thay thế cho phần nến chính.
2. Bubble chart nguồn của modern dashboard là bất biến trong đợt này:
   - `frontend/src/components/WhaleBubbleChart.jsx`
   - `frontend/src/components/WhaleAnalyticsTab.jsx`
   - `frontend/src/components/modern/ModularPositionDeck.jsx`
3. Route `whale-alerts/:symbol` chỉ được dùng bản sao hoặc adapter riêng; không sửa trực tiếp module bubble nguồn ở modern dashboard.
4. Phải bổ sung icon cá mập cho **10% nến đang hiển thị trong viewport** có tổng hoạt động mua/bán cá mập lớn nhất.
5. Tooltip trên KlineChart phải có công tắc ẩn/hiện.
6. Load lần đầu phải hiển thị bubble chart của phiên gần nhất có dữ liệu hợp lệ.
7. Module Order Flow Radar phải chuyển xuống dưới KlineChart ở `StockDetail`.
8. Các module `CHIẾN THUẬT W2+W4` và `NHẬN DIỆN DARK MONEY` phải được nén gọn và chuyển sang cột phải của `whale-alerts/:symbol`.
9. Sau cutover phải retire code cũ dư thừa ở route whale-alerts/symbol thay vì để song song.

### 2.2 Quy định thực thi bắt buộc cho đội code

1. Không mở rộng scope ngoài tài liệu này nếu chưa có phê duyệt mới.
2. Mỗi slice chỉ được chạm vào một lát cắt kỹ thuật rõ ràng và phải có focused validation ngay sau edit đầu tiên.
3. Sau mỗi slice có thay đổi runtime/UI:
   - rebuild hoặc restart dev stack bị ảnh hưởng,
   - cập nhật `docs/CODE_CHANGE_AUDIT_LEDGER.md`,
   - cập nhật `PROGRESS_DASHBOARD.md`,
   - đồng bộ danh sách file audit bắt buộc.
4. Text mới trên UI phải đi qua i18n tiếng Việt có đầy đủ dấu.
5. Sau mỗi slice phải tự audit nội bộ theo protocol trong gói này trước khi chuyển final auditor.

---

## 3. Scope và Non-Scope

### In-Scope

1. Refactor route `frontend/src/pages/WhaleAlertsDashboard.jsx` thành workspace theo phiên.
2. Tạo/copy module KlineChart dùng cho whale-alerts/symbol từ logic đang có ở `frontend/src/pages/StockDetail.jsx`.
3. Tạo pane kỹ thuật đồng bộ thời gian với nến, chứa:
   - whale buy value/volume,
   - whale sell value/volume,
   - CVD,
   - buy strength,
   - sell strength,
   - institutional strength.
4. Tạo tooltip đầy đủ theo phiên + toggle ẩn/hiện.
5. Tạo overlay icon cá mập cho top 10% nến hiển thị theo viewport.
6. Copy bubble chart stack từ modern dashboard sang namespace riêng cho whale-alerts/symbol.
7. Gắn selected session state để bubble chart đổi theo nến được click.
8. Thay advisory của bubble chart bằng adapter advisory từ Stock Detail, scope theo phiên đang chọn.
9. Chuyển Order Flow Radar về Stock Detail.
10. Cô đặc W2+W4 và Dark Money cards sang cột phải.
11. Dọn code cũ dư thừa sau cutover.
12. Bổ sung tài liệu self-audit, traceability, evidence và quality bootstrap cho đội code/AI.

### Out-of-Scope

1. Không thay đổi bubble source module của modern dashboard.
2. Không tái thiết kế tổng thể `ModernDashboard`.
3. Không thay đổi entitlement/quyền user.
4. Không thay đổi mobile app.
5. Không thay đổi bản chất advisory canonical của toàn symbol ngoài phần adapter theo phiên cho bubble route này.

---

## 4. Current-State Assessment

### File neo hiện tại

- `frontend/src/pages/WhaleAlertsDashboard.jsx`
- `frontend/src/pages/StockDetail.jsx`
- `frontend/src/components/WhaleBubbleChart.jsx`
- `frontend/src/components/WhaleAnalyticsTab.jsx`
- `frontend/src/components/OrderFlowRadarPanel.jsx`
- `frontend/src/components/BubbleOrderChart.jsx`

### Rủi ro kiến trúc hiện tại

1. `StockDetail` đang chứa logic KlineChart nội tuyến, gây khó tái sử dụng sạch cho route khác.
2. `WhaleAlertsDashboard` đang mount `DarkMoneyMasterChart` + `OrderFlowRadarPanel`, chưa có selected-session interaction với bubble chart.
3. Bubble chart advanced đang nằm trong luồng modern dashboard/whale analytics, nếu sửa trực tiếp sẽ có nguy cơ regression xuyên màn.
4. Advisory session logic mạnh đang nằm trong `StockDetail`, chưa có adapter tách rời để dùng lại an toàn.
5. Các module chiến thuật phía phải chưa được chuẩn hóa thành compact intelligence cards.
6. Chưa có visual semantics cho top whale candles trong viewport.

---

## 5. Target Design

## 5.1 Route composition mục tiêu

### Cột trung tâm trái

1. KlineChart chính:
   - nến,
   - volume nếu bật,
   - pane kỹ thuật hợp nhất,
   - tooltip phiên đầy đủ,
   - icon cá mập top 10% visible candles,
   - sự kiện click phiên.

2. Bubble chart theo phiên:
   - là bản sao từ modern dashboard stack,
   - dữ liệu mặc định là phiên gần nhất khi vào trang,
   - khi click nến khác thì bubble chart đổi theo `trade_date` hoặc bucket session tương ứng,
   - không thay đổi thông tin nội tại của bubble chart nguồn.

3. Bubble AI advisory:
   - dùng adapter logic từ Stock Detail,
   - text ngắn, tập trung phiên hiện tại,
   - bám tiêu chí prompt config hiện có.

### Cột phải

1. Whale feed / realtime support cards nếu còn cần cho trust context.
2. `CHIẾN THUẬT W2+W4` compact card.
3. `NHẬN DIỆN DARK MONEY` compact card.
4. Các card phải ưu tiên tín hiệu quyết định, không lặp thông tin từ chart trung tâm.

### Stock Detail alignment

1. `OrderFlowRadarPanel` được chuyển xuống dưới KlineChart ở `StockDetail`.
2. Stock Detail phải tiếp tục hoạt động ổn định sau khi trích/xào tách logic chart.

## 5.2 Immutable source map

Các file sau là **nguồn bất biến** trong đợt này:

- `frontend/src/components/WhaleBubbleChart.jsx`
- `frontend/src/components/WhaleAnalyticsTab.jsx`
- `frontend/src/components/modern/ModularPositionDeck.jsx`

Quy tắc audit:

1. Nếu các file trên có diff runtime ngoài comment hoặc import cleanup không được phê duyệt, slice bị FAIL.
2. Whale route phải dùng bản sao hoặc route-level adapter riêng trong namespace mới.

## 5.3 Canonical UI/data rules

1. Tooltip KlineChart là point-anchored theo đúng nến hover.
2. Tooltip không được ghép metric từ bucket lân cận.
3. Shark icon selection chỉ xét nến **đang hiển thị trong viewport** sau zoom/pan.
4. Số nến gắn icon = `max(1, ceil(visibleCandles * 10%))` nếu có dữ liệu whale.
5. Icon phải đổi theo bên trội:
   - xanh: mua trội,
   - đỏ: bán trội,
   - trung tính: cân bằng hoặc không đủ chênh lệch.
6. Bubble selected session phải lấy phiên giao dịch thực có dữ liệu, không lấy ngày lịch gần nhất một cách mù.

---

## 6. Execution Phases and Slices

## Phase 0 - Contract freeze and immutability guard (0.5 ngày)

### Slice ARC-01
Mục tiêu:
- Khóa source files bất biến và xác nhận namespace copy-only cho bubble stack.

DoD:
- Có danh sách immutable files trong handoff + quality docs.
- Taskboard có gate FAIL nếu source bubble bị sửa trực tiếp.

### Slice ARC-02
Mục tiêu:
- Chốt data contract logic cho Kline technical pane và selected-session bubble.

DoD:
- Quy định rõ fields bắt buộc cho mỗi candle/session.
- Chốt route hiện hữu nào được mở rộng và route nào không được tạo mới nếu chưa cần.

## Phase 1 - Shared chart foundation (1.5 ngày)

### Slice FE-1.1
Mục tiêu:
- Tách/copy KlineChart khỏi `StockDetail` sang module dùng cho whale-alerts/symbol.

File neo:
- `frontend/src/pages/StockDetail.jsx`
- module mới dưới `frontend/src/components/` hoặc `frontend/src/features/whale-alerts/`

DoD:
- Stock Detail vẫn render được.
- Whale route có thể mount KlineChart mới mà chưa cần bubble.

### Slice FE-1.2
Mục tiêu:
- Thêm pane kỹ thuật hợp nhất + tooltip đầy đủ + toggle ẩn/hiện.

DoD:
- Tooltip hiển thị đủ OHLCV, whale buy/sell, CVD, buy/sell strength, institutional strength.
- Có toggle ẩn/hiện tooltip.

### Slice FE-1.3
Mục tiêu:
- Thêm icon cá mập cho top 10% nến đang hiển thị theo viewport.

DoD:
- Icon cập nhật lại khi pan/zoom/timeframe change.
- Không dùng top 10% toàn dataset.
- Tooltip có dòng semantic cho nến top whale.

## Phase 2 - Bubble copy-only integration (1.5 ngày)

### Slice FE-2.1
Mục tiêu:
- Copy bubble chart stack từ modern dashboard sang namespace whale-alerts/symbol.

DoD:
- Không có diff trên 3 immutable source files.
- Namespace mới mount được độc lập.

### Slice FE-2.2
Mục tiêu:
- Gắn selected session state: mặc định latest valid session, click nến đổi bubble.

DoD:
- First load dùng phiên gần nhất.
- Click nến đổi bubble đúng phiên.

### Slice FE-2.3
Mục tiêu:
- Thay advisory của bubble bằng adapter từ Stock Detail, scope theo phiên.

DoD:
- Nội dung advisory ngắn, dựa trên dữ liệu phiên đang chọn.
- Không load advisory toàn symbol rồi gắn nhầm ngữ cảnh.

## Phase 3 - Whale route composition and cleanup (1 ngày)

### Slice FE-3.1
Mục tiêu:
- Thay chart cũ ở `WhaleAlertsDashboard` bằng Kline + bubble composite.

DoD:
- `DarkMoneyMasterChart` không còn là main chart surface trên route này.
- Bubble dưới chart hoạt động theo session.

### Slice FE-3.2
Mục tiêu:
- Compact hóa W2+W4 và Dark Money cards sang cột phải.

DoD:
- Card gọn, không lặp số liệu đã có trên chart.

### Slice FE-3.3
Mục tiêu:
- Xóa code cũ dư thừa và khóa path retired.

DoD:
- Không còn mount path cũ dư thừa.
- Không còn fetch thừa từ route cũ.

## Phase 4 - Stock Detail alignment (0.5 ngày)

### Slice FE-4.1
Mục tiêu:
- Chuyển `OrderFlowRadarPanel` xuống dưới KlineChart ở Stock Detail.

DoD:
- Layout mới đúng và không phá advisory/session behavior của Stock Detail.

### Slice FE-4.2
Mục tiêu:
- Regression pass cho Stock Detail sau khi trích/copy chart logic.

DoD:
- KlineChart, advisory session, radar và bubble cũ của Stock Detail vẫn dùng được theo semantics hiện tại.

## Phase 5 - Backend/data support if contract gap exists (1 ngày)

### Slice BE-5.1
Mục tiêu:
- Mở rộng endpoint hiện có để trả per-candle/per-session whale metrics cho technical pane.

Anchor hiện hữu:
- `getStockPriceChart`
- `getStockOrderFlow`
- `getWhaleFeed`
- `getWhaleAnalyticsSnapshot`

DoD:
- Có đủ fields cho chart mới mà không tạo dual-path logic mới.

### Slice BE-5.2
Mục tiêu:
- Cho phép bubble snapshot nhận `trade_date` hoặc session selector rõ ràng.

DoD:
- Bubble request theo phiên là deterministic và audit được.

## Phase 6 - QA, self-audit, release handoff (1 ngày)

### Slice QA-6.1
Mục tiêu:
- Viết/rerun focused unit and regression tests cho frontend/backend touched slices.

### Slice QA-6.2
Mục tiêu:
- Chạy self-audit matrix + visual UAT + evidence pack.

### Slice OPS-6.3
Mục tiêu:
- Rebuild/restart dev stack liên quan và chụp bằng chứng hoàn thành.

---

## 7. Testing and Verification Strategy

### Backend mandatory suites

1. `backend/portfolio/tests/test_whale_analytics_snapshot_api.py`
2. `backend/portfolio/tests/test_whale_analytics_snapshot_flow_series.py`
3. `backend/portfolio/tests/test_whale_orders_ssot_parity.py`
4. `backend/portfolio/tests/test_order_flow.py`
5. `backend/portfolio/tests/test_order_flow_source_parity.py`

### Frontend mandatory suites

1. `frontend/src/components/WhaleBubbleChart.tooltip.test.jsx` (nguồn tham chiếu, dùng để so semantics)
2. `frontend/src/components/WhaleBubbleChart.sync.test.jsx` (nguồn tham chiếu, dùng để so sync behavior)
3. `frontend/src/components/WhaleAnalytics.degraded.test.jsx`
4. `frontend/src/hooks/useWhaleAnalyticsData.test.js`
5. Suite mới cho whale-alerts/symbol Kline/Bubble integration phải được bổ sung ở slice FE-2.x hoặc FE-3.x.

### Exit criteria

1. Modern dashboard bubble source files không có diff runtime.
2. `whale-alerts/:symbol` mở vào là ra latest valid session bubble.
3. Click nến đổi bubble đúng phiên.
4. Tooltip toggle hoạt động.
5. Shark icon top 10% recompute đúng khi zoom/pan.
6. Stock Detail không regression sau khi dời Radar.
7. Audit ledger + progress dashboard + evidence template được cập nhật đầy đủ.

---

## 8. Release and Handoff Operations

1. Mỗi slice chỉ được đánh dấu complete sau khi đã có:
   - code,
   - validation,
   - evidence,
   - ledger/progress sync.
2. Mọi slice thay đổi runtime/UI phải rebuild dev stack bị ảnh hưởng để final auditor kiểm tra ngay.
3. Không gộp nhiều slice không liên quan vào một PR/patch lớn.
4. Sau phase cuối mới được retire hoàn toàn code cũ.

---

## 9. Canonical References

- `docs/WHALE_ALERTS_SYMBOL_KLINE_REFACTOR_HANDOFF_MASTER_20260427.md`
- `docs/WHALE_ALERTS_SYMBOL_KLINE_REFACTOR_EXECUTION_TASKBOARD_20260427.md`
- `docs/WHALE_ALERTS_SYMBOL_KLINE_REFACTOR_TRACEABILITY_MATRIX_20260427.md`
- `docs/WHALE_ALERTS_SYMBOL_KLINE_REFACTOR_SELF_AUDIT_AND_TEST_PROTOCOL_20260427.md`
- `docs/WHALE_ALERTS_SYMBOL_KLINE_REFACTOR_EXECUTION_EVIDENCE_TEMPLATE_20260427.md`
- `quality/QUALITY.md`
- `quality/RUN_CODE_REVIEW.md`
- `quality/RUN_INTEGRATION_TESTS.md`
- `quality/RUN_SPEC_AUDIT.md`
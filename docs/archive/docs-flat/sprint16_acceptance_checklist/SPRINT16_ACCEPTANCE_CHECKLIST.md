# Sprint 16 Acceptance Checklist — Whale Volume Weighting & Order Flow Time Window

**Sprint**: 16  
**Ngày lập**: 2026-04-04  
**TRẠNG THÁI: ✅ COMPLETED — 2026-04-04**

---

## Phase 1 — BE: `volume` Field trong Aggregate Whale Feed

### S16-01: Builder `_build_aggregate_event_payload`
- [x] Field `volume: int` xuất hiện trong dict trả về
- [x] `getattr(row, 'volume', 0) or 0` — không crash khi không có field

### S16-02: Builder `_build_aggregate_event_payload_from_record`
- [x] Field `volume: int` xuất hiện trong dict trả về
- [x] `record.get('volume') or 0` — không crash khi record thiếu key

### S16-03: Builder `_build_stream_aggregate_records`
- [x] `volume = float(tick.get('volume') or 0)` — parse từ tick dict
- [x] `'volume': int(volume)` trong record dict

### S16-04: Builder `_build_vnbroker_aggregate_records`
- [x] `volume = float(row.get('volume') or row.get('vol') or row.get('matchVolume') or 0)` — thử nhiều key vnbroker
- [x] `'volume': int(volume)` trong record dict

**Phase 1 Gate**: ✅ `manage.py test portfolio.tests.test_api_routes` — 45/45 PASS (subset)

---

## Phase 2 — FE: Whale Avg Price

### S16-05: `buildSymbolStatsFromFeed` trong `WhaleAlertsHub.jsx`
- [x] Khởi tạo `totalVolume: 0` trong map entry mới
- [x] Tích lũy `map[sym].totalVolume += Number(item.volume || 0)` mỗi item

### S16-06: `getFrequencyLabel` dùng `totalValue` (không còn count)
- [x] Ngưỡng ≥ 5 tỷ → `'Bùng nổ'` (rose)
- [x] Ngưỡng ≥ 2 tỷ → `'Cao'` (amber)
- [x] Ngưỡng ≥ 500 triệu → `'Trung bình'` (cyan)
- [x] Dưới ngưỡng → `'Thấp'` (slate)

### S16-07: `TrackedSymbolCard` hiển thị Whale Avg Price
- [x] Tính `whaleAvgPrice = totalVolume > 0 ? totalValue / totalVolume : 0`
- [x] Hiển thị "Avg giá: X VND/CP" chỉ khi `whaleAvgPrice > 0`
- [x] Hiển thị "Avg lệnh: X VND"
- [x] Hiển thị "Tổng N lệnh · X VND"

### S16-08: `buildSymbolStats` trong `WhaleAdvisory.jsx`
- [x] Tích lũy `totalVolume` tương tự WhaleAlertsHub
- [x] Sort list theo `b.totalValue - a.totalValue` (giảm dần theo giá trị)

### S16-09: `SymbolCell` trong `WhaleAdvisory.jsx`
- [x] Hiển thị "Avg giá: X VND/CP" conditional trên `whaleAvgPrice > 0`
- [x] "Avg lệnh" format đồng nhất với TrackedSymbolCard

**Phase 2 Gate**: ✅ `npm run build` — Compiled successfully

---

## Phase 3 — Order Flow `?window` Param

### S16-10: Backend query param `?window`
- [x] `_window_map = {'5m': 5, '15m': 15, '30m': 30, '1h': 60}` tồn tại trong `stock_order_flow_api`
- [x] Param mặc định `'30m'` khi không truyền
- [x] Param không hợp lệ (ví dụ `?window=abc`) → fallback về `30`
- [x] `compute_cvd_series` được gọi với `window_minutes` đúng
- [x] Response trả thêm `window` và `window_minutes`

### S16-11: Frontend API client
- [x] `getStockOrderFlow(symbol, window = '30m')` nhận tham số `window`
- [x] Axios gửi `{ params: { window } }` vào request

### S16-12: Frontend state trong `StockDetail.jsx`
- [x] `const [orderFlowWindow, setOrderFlowWindow] = useState('30m')` tồn tại
- [x] `fetchOrderFlow` phụ thuộc `orderFlowWindow` trong dependency array
- [x] `getStockOrderFlow(normalizedSymbol, orderFlowWindow)` được gọi đúng

### S16-13: Window selector UI
- [x] 4 buttons: `5m`, `15m`, `30m`, `1h`
- [x] Button đang chọn có class `bg-cyan-600 text-white`
- [x] Click button gọi `onWindowChange(w)`
- [x] UI nằm trong header `OrderFlowPanel`, không crash khi render

### S16-14: `OrderFlowPanel` nhận props window
- [x] Props `window={orderFlowWindow}` được truyền vào `<OrderFlowPanel>`
- [x] Props `onWindowChange={setOrderFlowWindow}` được truyền vào `<OrderFlowPanel>`

**Phase 3 Gate**: ✅ `manage.py test portfolio.tests.test_order_flow` — 38/38 PASS

---

## QA Tổng Hợp

### S16-QA: Kiểm thử toàn sprint
- [x] `manage.py test portfolio.tests.test_api_routes portfolio.tests.test_order_flow` → **83/83 PASS**
- [x] `npm run build` → **Compiled successfully** (293 kB gz)
- [x] `manage.py check` → 0 issues
- [x] Không regression trên test_realtime_gateway, test_whale_scoring
- [x] Execution log cập nhật trong `SPRINT_EXECUTION_LOG.md`
- [x] Taskboard `TASKBOARD_SPRINT16.csv` cập nhật Done

---

## Release Sign-off

- [x] Tất cả phase gates PASS
- [x] Không có P0/P1 blocking issue mới
- [x] Code được build thành công trước khi sign-off
- [x] `FETURE_EXPANSION_BACKLOG.md` cập nhật P1-4 → Delivered

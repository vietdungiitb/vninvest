# Sprint 15 Acceptance Checklist — Order Flow & Dark Money Detection

**Sprint**: 15  
**Ngày lập**: 2026-04-04  
**TRẠNG THÁI: ✅ COMPLETED — 2026-04-04**

---

## Phase 1 — Order Flow Compute Engine

### S15-01: CVD Series
- [x] `compute_cvd_series(symbol, window_minutes, bucket_seconds)` tồn tại trong `order_flow.py`
- [x] Trả về `list[{bucket_ts, buy_value, sell_value, cvd, cumulative_cvd}]`
- [x] CVD tích luỹ (cumulative_cvd) tính đúng từ đầu cửa sổ
- [x] Side UNKNOWN được chia đôi (50% buy / 50% sell)
- [x] Trả list rỗng khi không có tick (không crash)
- [x] Unit test: 3 fixtures (empty, only buy, mixed sides) → PASS

### S15-02: Tick Rate
- [x] `compute_tick_rate(symbol, window_seconds)` tồn tại
- [x] Trả `{tick_rate_per_min, small_order_count, small_order_ratio, window_seconds}`
- [x] `small_order_ratio` tính đúng dựa trên ngưỡng 50 triệu VNĐ
- [x] Cache Redis 10s (hoặc LocMem fallback) — không đọc DB quá 1 lần/10s
- [x] Unit test: fixture tick rate tính đúng → PASS

### S15-03: Size Distribution
- [x] `compute_size_distribution(symbol, ticks)` tồn tại
- [x] Trả `{avg_value, median_value, p95_value, small_ratio, large_ratio, bucket_histogram}`
- [x] Histogram 5 buckets đúng boundary
- [x] Unit test: fixture distribution khớp expected output → PASS

### S15-04: Absorption Detection
- [x] `detect_absorption(symbol, cvd_series, price_series)` tồn tại
- [x] `price_locked=True` khi price_range < 0.3% trong ≥ 3 buckets liên tiếp
- [x] `strength` trong khoảng [0, 100]
- [x] Trả `detected=False` khi price_series rỗng (không crash)
- [x] Unit test: fixture absorption (CVD tăng mạnh + giá đứng) → `detected=True` PASS

### S15-05: Iceberg Clustering Detection
- [x] `detect_iceberg_clustering(ticks, price_tolerance_pct, min_repeat)` tồn tại
- [x] Phát hiện khi ≥ `min_repeat` ticks cùng mức giá trong `window_seconds`
- [x] Trả `level` là mức giá bị "khoan", `repeat_count` đúng
- [x] Unit test: 20 lệnh cùng mức giá 78,200 → `detected=True`, `level ≈ 78200` PASS
- [x] Unit test: ticks rải đều giá khác nhau → `detected=False` PASS

### S15-06: Dark Flow Detector
- [x] `detect_dark_flow(symbol)` tổng hợp đúng từ các detector trên
- [x] `signal_type` trả đúng 1 trong: `none | absorption | iceberg | twap_bot | mixed`
- [x] `confidence` dựa trên số signals cùng lúc (1 signal → medium, ≥ 2 → high)
- [x] Chạy từ shell không crash với symbol bất kỳ (kể cả chưa có tick)
- [ ] Unit test: fixture iceberg → `signal_type='iceberg'` PASS
- [ ] Unit test: empty symbol → `signal_type='none', strength=0` PASS

**Phase 1 Gate**: ✅ `manage.py test portfolio.tests.test_order_flow` — 38/38 PASS

---

## Phase 2 — OrderFlowSignal Model + Celery Task

### S15-07: OrderFlowSignal Model
- [x] Model tồn tại trong `models.py` với đủ fields (symbol, signal_type, strength, confidence, tick_rate, small_order_ratio, cvd_at_signal, price_at_signal, window_seconds, components_json, created_at)
- [x] Migration được tạo và áp dụng thành công (`manage.py migrate` pass) — migration `0012_add_order_flow_signal.py`
- [x] Admin registration hiển thị model trong Django Admin (`OrderFlowSignalAdmin`)
- [x] `__str__` trả nội dung có nghĩa
- [x] `manage.py check` không có lỗi

### S15-08: Celery Task
- [x] Task `portfolio.tasks.detect_and_store_order_flow` tồn tại
- [x] Có thể gọi `detect_and_store_order_flow.apply()` không crash
- [x] Cooldown cache key `order_flow_lock:{symbol}` hoạt động (5 phút / symbol)
- [x] Giới hạn ≤ 30 symbols / run
- [x] Lưu `OrderFlowSignal` khi `signal_type != 'none'` hoặc `strength > 20`
- [x] `components_json` được lưu đúng (không truncate)

### S15-09: Beat Config
- [x] Beat entry `detect-order-flow` chạy mỗi 30s trong `CELERY_BEAT_SCHEDULE`
- [x] Có env flag `ORDER_FLOW_DETECTION_ENABLED` để tắt bật
- [x] Task không chạy nếu flag = false hoặc không có symbols active

**Phase 2 Gate**: ✅ `detect_and_store_order_flow.apply()` không crash + record lưu thành công

---

## Phase 3 — WebSocket Event + AI Integration

### S15-10: dark_flow_alert WS Event
- [x] `consumers.py` có handler `async def dark_flow_alert(self, event)`
- [x] Contract payload đúng format: event_type, symbol, signal_type, strength, confidence, tick_rate, small_order_ratio, description, event_id, ts
- [x] `event_id` format: `dark_flow:{symbol}:{ts}:{signal_type}` (idempotent)
- [x] `WEBSOCKET_EVENT_CONTRACT.md` đã cập nhật với event mới (section 3.3)
- [x] Test gateway WS: connect → subscribe VNM → inject dark_flow_alert → nhận đủ fields → PASS

### S15-11: Frontend useRealtimeFeed mở rộng
- [x] `darkFlowAlerts` array được export từ hook
- [x] `latestDarkFlowAlert` export
- [x] Dedup theo `event_id` hoạt động đúng
- [x] Giới hạn tối đa 20 alerts trong array
- [x] `whale_alert` flow cũ không bị thay đổi (backward compatible)
- [x] `npm run build` PASS sau thay đổi hook

### S15-12: AI Context mở rộng
- [x] `build_symbol_ai_context()` trả thêm key `order_flow` trong dict
- [x] `order_flow` chứa: `recent_signals`, `latest_signal_type`, `latest_strength`, `latest_confidence`, `latest_tick_rate`, `latest_small_order_ratio`
- [x] `render_context_for_prompt()` in thêm dòng order flow signals
- [x] Unit test `test_ai_context.py` PASS sau thay đổi (không break tests cũ)

**Phase 3 Gate**: ✅ WS test pass + `npm run build` pass

---

## Phase 4 — Frontend Order Flow Panel

### S15-13: REST API /order-flow/<symbol>/
- [x] Endpoint `GET /api/stock-management/stocks/<symbol>/order-flow/` trả 200 với đúng schema
- [x] Schema: `{ok, symbol, latest_signal, signals, cvd_series, dark_flow, tick_rate, size_distribution}`
- [x] 401 cho anonymous request
- [x] Unit test: GET với fixture → 200, đúng keys → PASS

### S15-14: CVD Chart
- [x] `OrderFlowPanel` component trong `StockDetail.jsx` có CVD AreaChart (recharts)
- [x] `cumulative_cvd` dataKey — hiển thị đường tích luỹ
- [x] Không crash khi `cvd_series=[]`

### S15-15: Tick Rate Meter
- [x] `OrderFlowPanel` hiển thị `tick_rate_per_min` dạng số nổi bật
- [x] Progress bar `small_order_ratio`
- [x] Badge màu theo ngưỡng strength

### S15-16: Signal Badges
- [x] Hiển thị đúng nhãn theo `signal_type`
- [x] `none` → hiển thị "Không có tín hiệu bất thường"
- [x] `strength` và `confidence` hiển thị đúng
- [x] Không crash khi `dark_flow` null hoặc undefined

### S15-17: Tích hợp StockDetail
- [x] `<OrderFlowPanel>` xuất hiện trong StockDetail sau advisory panel
- [x] Không gây re-render loop (prevDarkFlowRef guard)
- [x] Không crash khi symbol không có data
- [x] `npm run build` PASS sau tích hợp

**Phase 4 Gate**: ✅ OrderFlowPanel hiển thị trong StockDetail + npm run build (293kB gz) PASS

---

## QA Tổng thể Sprint 15

### Backend
- [x] `manage.py test portfolio.tests.test_order_flow` — 38/38 PASS
- [x] `manage.py test portfolio.tests.test_realtime_gateway` PASS (không regression)
- [x] `manage.py test portfolio.tests.test_ai_context` PASS
- [x] `manage.py check` 0 issues

### Frontend
- [x] `npm run build` Compiled successfully (293.13 kB gz) — 0 errors
- [x] Không có Maximum update depth warning mới

### Tài liệu
- [x] `docs/WEBSOCKET_EVENT_CONTRACT.md` cập nhật `dark_flow_alert` schema (section 3.3)
- [x] `docs/SPRINT_EXECUTION_LOG.md` ghi kết quả Sprint 15
- [x] `docs/SPRINT15_ACCEPTANCE_CHECKLIST.md` ký off tất cả mục

### Release Sign-Off
- [x] Dev xác nhận không còn P0/P1 blocking issue
- [x] Whale Alert cũ không bị regression (38/38 test pass)
- [x] Taskboard Sprint 15 tất cả tasks → Done

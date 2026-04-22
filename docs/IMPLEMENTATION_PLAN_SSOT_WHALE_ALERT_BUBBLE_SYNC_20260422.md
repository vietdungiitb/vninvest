# IMPLEMENTATION PLAN: SSOT Whale Alert - Bubble Sync

**Ngày tạo**: 2026-04-22  
**Phạm vi chương trình**: Whale Intelligence SSOT Consolidation  
**Level**: A (Major - thay đổi service/data contract, ảnh hưởng backend + frontend)  
**Owner**: Backend Lead + Frontend Lead  
**Reviewer**: Project Lead  
**Trạng thái**: READY FOR CODING

---

## 1. Business Objective

### Vấn đề cần giải quyết

Hiện tại người dùng có thể thấy cảnh báo lệnh mua lớn trong luồng whale alerts, nhưng Tab Cá mập trên Modern Dashboard không hiển thị bubble tương ứng.  
Lỗi này gây mất niềm tin nghiêm trọng vì hệ thống hiển thị hai kết quả khác nhau cho cùng một nghiệp vụ.

### Mục tiêu nghiệp vụ

- Đồng bộ 100% giữa Whale Alert và Bubble Chart theo cùng bộ lọc symbol/timeframe.
- Chuyển về một nguồn sự thật duy nhất (SSOT) cho whale event.
- Loại bỏ hoàn toàn dual-path logic gây sai lệch dữ liệu.

### KPI đầu ra

| Chỉ số | Baseline | Mục tiêu |
|---|---:|---:|
| Tỷ lệ mismatch alert-vs-bubble | Có xảy ra | 0 |
| Case "alert có nhưng bubble rỗng" | Có | 0 |
| Tỷ lệ degraded mode không giải thích được | Có | 0 |
| p95 API whale symbol endpoint | Chưa chuẩn hóa | Không tăng > 10% sau refactor |

---

## 2. Scope và Non-Scope

### In-Scope

- Hợp nhất backend path của:
  - `/api/realtime/whale-feed/{symbol}/`
  - `/api/portfolio/whale/orders/{symbol}/`
- Tạo canonical service trả whale events chuẩn hóa.
- Cập nhật Bubble chart frontend để render từ contract mới.
- Thêm quality flags + degraded-mode UX.
- Bổ sung parity tests và observability metrics.

### Out-of-Scope

- Không thay đổi logic AI advisory generation.
- Không thay đổi quyền gói user/entitlement hiện tại.
- Không tái thiết kế visual style tổng thể của Modern Dashboard.
- Không chạm mobile app trong đợt này.

---

## 3. Current-State Assessment

### Hệ quả kiến trúc hiện tại

1. Alert path và bubble path đang chạy logic fallback khác nhau.
2. Bubble path phụ thuộc cứng vào reference price, thiếu là trả rỗng.
3. Alert path vẫn có thể có data từ stream trong khi bubble path không có data tương ứng.
4. Người dùng diễn giải thành lỗi hệ thống sai lệch.

### Ràng buộc kỹ thuật

- Cần backward compatibility route để tránh phá frontend cũ.
- Dữ liệu có khả năng mixed unit (VND và THOUSAND_VND).
- Cần xử lý đồng nhất timezone phiên VN.

---

## 4. Target Design

### 4.1 SSOT Integration Map (Mandatory)

- Domain SSOT: `whale alert`.
- Canonical provider mới: `WhaleEventService.get_whale_events_by_symbol()`.
- Consumer bắt buộc:
  - Whale feed endpoint.
  - Whale orders endpoint cho bubble.
- Luồng cũ cần retire:
  - Logic query + transform riêng trong bubble endpoint.
  - Empty-state cứng do thiếu ref_price dù có events.

### 4.2 Canonical event contract

Trường bắt buộc per event:
- `symbol`
- `ts`
- `side` (`buy|sell|unknown`)
- `price_vnd`
- `volume`
- `matched_value_vnd`
- `threshold_vnd`
- `source` (`redis_stream|intraday_tick_db|vnstock`)
- `event_id`
- `quality_flags` (`has_ref_price`, `price_unit_normalized`, `degraded_mode`)

### 4.3 Render semantics

- Alert cards: đọc trực tiếp canonical events.
- Bubble chart: map cùng canonical events sang tọa độ.
- Nếu thiếu ref_price:
  - Không được trả rỗng toàn bộ.
  - Render fallback mode có banner giải thích.

---

## 5. Execution Phases

## Phase 0 - Contract and guardrails (0.5 ngày)

Mục tiêu:
- Chốt schema canonical và quy tắc normalize.

Công việc:
1. Chốt dataclass/schema cho whale event.
2. Tạo feature flag `WHALE_BUBBLE_USE_SSOT_EVENTS`.
3. Chốt dedupe key.

Files dự kiến:
- `backend/portfolio/market_data_service.py`
- `backend/config/settings.py`

DoD:
- Có contract thống nhất và test schema pass.

## Phase 1 - Backend unification (1.5 ngày)

Mục tiêu:
- Hai endpoint cùng dùng một service canonical.

Công việc:
1. Tạo service `get_whale_events_by_symbol(user, symbol, timeframe, window)`.
2. Refactor `WhaleFeedView` gọi service canonical.
3. Refactor `whale_orders_by_symbol_api` gọi service canonical.
4. Đảm bảo output có `source`, `quality_flags`, `degraded_mode_reason`.

Files dự kiến:
- `backend/portfolio/market_data_service.py`
- `backend/portfolio/views_realtime_advanced.py`
- `backend/portfolio/views_whale_orders.py`

DoD:
- Contract parity alert vs bubble ở backend pass.

## Phase 2 - Frontend sync + degraded UX (1 ngày)

Mục tiêu:
- Bubble chart không còn "trắng" khi đã có event.

Công việc:
1. Cập nhật mapping ở `WhaleBubbleChart` theo contract mới.
2. Thêm fallback banner khi thiếu reference price.
3. Chặn empty-state sai semantics khi event_count > 0.

Files dự kiến:
- `frontend/src/components/WhaleBubbleChart.jsx`
- `frontend/src/components/modern/ModularPositionDeck.jsx` (nếu cần metadata display)
- `frontend/src/i18n/vi.js`

DoD:
- UI hiển thị bubble fallback đúng và có thông điệp rõ.

## Phase 3 - Hardening + release (1 ngày)

Mục tiêu:
- Khóa hồi quy bằng test + metric.

Công việc:
1. Add test parity matrix đầy đủ.
2. Add mismatch metrics + alert rules.
3. Canary rollout theo feature flag.

Files dự kiến:
- `backend/portfolio/tests/test_api_routes_stock_workspace_realtime_bulk.py`
- `backend/portfolio/tests/test_whale_orders_ssot_parity.py` (mới)
- `backend/portfolio/market_data_service.py` (metrics hooks)

DoD:
- Không còn mismatch trên UAT matrix.

---

## 6. API and Data Contract Changes

### Endpoint giữ nguyên route

1. `GET /api/realtime/whale-feed/{symbol}/`
2. `GET /api/portfolio/whale/orders/{symbol}/?timeframe=...`

### Thay đổi payload (backward-compatible)

Thêm các field:
- `source`
- `quality_flags`
- `degraded_mode`
- `degraded_mode_reason`
- `event_count`

Không xóa ngay các field cũ để tránh phá tương thích.

---

## 7. Scheduling and Operations

- Không thêm scheduler mới ở phase này.
- Dùng luồng dữ liệu hiện tại: stream -> db -> vnstock fallback.
- Áp dụng timeout/rate-limit policy hiện hữu của realtime stack.

---

## 8. Testing and Verification

### Test bắt buộc

1. Stream có event, DB trễ: alert và bubble vẫn parity.
2. DB có event, stream stale: parity.
3. Thiếu ref_price: bubble có fallback render, không rỗng.
4. Mixed unit: matched_value không sai x1000.
5. Timeframe 15m/30m/1h/session: parity event set.
6. Scope all + chọn symbol cụ thể: parity đúng symbol.

### Exit criteria

- Tất cả test pass.
- UAT không còn case mismatch.
- p95 endpoint nằm trong ngưỡng cho phép.

---

## 9. Observability and Alerting

### Metrics mới

- `whale_ssot_alert_bubble_event_count_delta`
- `whale_ssot_degraded_mode_total`
- `whale_ssot_missing_ref_price_total`
- `whale_ssot_source_distribution`

### Alert rule

- Delta count khác 0 liên tiếp 3 chu kỳ -> warning.
- Tăng đột biến missing_ref_price -> warning tới team backend data feed.

---

## 10. Security and Governance

- Không mở rộng quyền truy cập mới.
- Giữ nguyên `IsAuthenticated`/`IsProPlan` theo endpoint hiện tại.
- Ghi log audit cho fallback/degraded reason để truy xuất sự cố.

---

## 11. Release Plan

1. Merge code sau khi test pass trong branch dev.
2. Bật feature flag canary cho 10% user nội bộ.
3. Theo dõi metric 24h.
4. Tăng dần 50% -> 100% nếu ổn định.
5. Rollback: tắt `WHALE_BUBBLE_USE_SSOT_EVENTS`.

---

## 12. Ownership and Timeline

- Backend Lead: Phase 0-1, Phase 3 backend.
- Frontend Lead: Phase 2.
- QA Lead: parity matrix + UAT.
- DevOps: rollout theo feature flag.

Timeline đề xuất: 4 ngày làm việc.

---

## 13. MDSU Compliance Map

Phạm vi này không thay thế trực tiếp DailyPrice read-path ở module khác.  
Tuy nhiên phải tuân thủ triết lý SSOT tương tự MDSU: một nguồn canonical cho một nghiệp vụ.

---

## 14. Definition of Ready / Done

### DoR
- Có đủ plan + tech spec + taskboard + walkthrough.
- Chốt contract payload và feature flag.

### DoD
- Hai endpoint whale dùng chung canonical service.
- Không còn mismatch alert-vs-bubble.
- Có fallback UX rõ ràng khi degraded.
- Có metric và alert.
- Có cập nhật audit ledger + progress dashboard.

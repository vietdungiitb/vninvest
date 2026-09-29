# TASKBOARD THỰC THI - WHALE ANALYTICS v2.0

## 1. Mục đích

Taskboard này dùng để giao việc trực tiếp cho đội code và cũng là checklist audit sau khi họ hoàn thành.

Quy ước trạng thái:
- `[ ]` Chưa bắt đầu
- `[/]` Đang làm
- `[x]` Hoàn thành

## 2. Slice Backend

### BE-01. Tạo snapshot endpoint hợp nhất

Trạng thái: `[x]`

- Priority: Critical
- Owner: Backend Lead
- Files neo:
  - `backend/portfolio/views_whale_orders.py`
  - `backend/portfolio/views_dark_money_history.py`
  - `backend/portfolio/services/` hoặc module service mới
- Output bắt buộc:
  - endpoint snapshot hợp nhất cho Whale Analytics
  - response có `symbol`, `trade_date`, `timeframe`, `session`, `meta`, `price_series`, `bubble_series`, `flow_series`, `summary`
- Acceptance:
  - chỉ 1 request logic cho 1 chart view
  - response đúng timeframe được yêu cầu
  - có `generated_at`, `cache_age_ms`, `is_stale`, `degraded_mode`, `data_state`

### BE-02. Chuẩn hóa time contract UTC+7 và fallback phiên gần nhất

Trạng thái: `[x]`

- Priority: Critical
- Owner: Backend
- Files neo:
  - `backend/portfolio/views_whale_orders.py`
  - `backend/portfolio/views_dark_money_history.py`
  - service time/session mới nếu cần
- Output bắt buộc:
  - logic resolve phiên theo `UTC+7`
  - weekend/holiday fallback về phiên gần nhất có dữ liệu
- Acceptance:
  - session `09:00-15:00`
  - không còn mismatch 08:45 vs 09:00
  - timestamp trong response đồng nhất timezone

### BE-03. Chốt rule bucket ATO/ATC và linear time gaps

Trạng thái: `[x]`

- Priority: High
- Owner: Backend
- Files neo:
  - service aggregate intraday mới hoặc logic hiện hữu trong views
- Output bắt buộc:
  - bucket rule cho `1m`, `15m`, `30m`, `1h`
  - metadata hoặc timestamp semantics đủ rõ để frontend render gap chính xác
- Acceptance:
  - không rải auction volume sang phút giả
  - bucket timestamp nhất quán với spec API

### BE-04. Refactor công thức strength

Trạng thái: `[x]`

- Priority: Critical
- Owner: Backend Quant/Lead
- Files neo:
  - `backend/portfolio/order_flow.py`
  - logic fallback trong `backend/portfolio/views_dark_money_history.py`
- Output bắt buộc:
  - rolling baseline
  - percentile window
  - sigmoid soft-saturation
  - low-volume penalty hoặc confidence band
- Acceptance:
  - strength không chạm 100 hàng loạt trên bucket nhỏ
  - công thức khớp spec backend
  - có test cho sparse bucket, skewed bucket, abnormal bucket

### BE-05. Refactor institutional strength

Trạng thái: `[x]`

- Priority: Critical
- Owner: Backend Quant/Lead
- Files neo:
  - `backend/portfolio/order_flow.py`
  - module helper liên quan dark flow
- Output bắt buộc:
  - pipeline baseline riêng cho institutional strength
- Acceptance:
  - không copy raw strength
  - response trả field rõ ràng cho institutional strength

### BE-06. Thêm cache headers và snapshot cache

Trạng thái: `[x]`

- Priority: High
- Owner: Backend Platform
- Files neo:
  - view snapshot mới
  - service cache mới
- Output bắt buộc:
  - `ETag`
  - `Last-Modified`
  - `Cache-Control`
  - cache key theo `symbol + trade_date + timeframe + profile`
- Acceptance:
  - request lặp lại có thể nhận `304`
  - response khi cache hit không rebuild snapshot

### BE-07. Single-flight/coalescing cho cache miss

Trạng thái: `[x]`

- Priority: Medium
- Owner: Backend Platform
- Files neo:
  - service snapshot/cache mới
- Output bắt buộc:
  - lock/coalescing khi nhiều request cùng key
- Acceptance:
  - cache miss hàng loạt không gây build trùng nhiều lần

### BE-08. Test backend contract và formulas

Trạng thái: `[x]`

- Priority: Critical
- Owner: Backend + QA
- Output bắt buộc:
  - test unit
  - test integration cho endpoint snapshot
  - fixture cho ngày giao dịch, cuối tuần, holiday, bucket rỗng, degraded mode
- Acceptance:
  - test pass
  - có evidence file/log đính kèm audit pack

## 3. Slice Frontend

### FE-01. Chuyển data hook sang snapshot endpoint

Trạng thái: `[x]`

- Priority: Critical
- Owner: Frontend Lead
- Files neo:
  - `frontend/src/hooks/useWhaleAnalyticsData.js`
  - `frontend/src/api/client.js`
- Output bắt buộc:
  - hook chỉ gọi snapshot endpoint
  - bỏ pattern `session + 1M`
- Acceptance:
  - mở chart intraday không còn 2 request nặng song song
  - cache key/state key đúng spec

### FE-02. Viết lại time adapter theo contract mới

Trạng thái: `[x]`

- Priority: Critical
- Owner: Frontend
- Files neo:
  - `frontend/src/utils/whaleTimeAdapter.js`
- Output bắt buộc:
  - session `09:00-15:00`
  - linear time axis
  - focus/off-hours behavior khớp backend contract
- Acceptance:
  - không còn 08:45 start
  - gap trưa hiện đúng

### FE-03. Refactor chart render 2 pane theo snapshot

Trạng thái: `[x]`

- Priority: Critical
- Owner: Frontend
- Files neo:
  - `frontend/src/components/WhaleBubbleChart.jsx`
  - `frontend/src/components/WhaleAnalyticsTab.jsx`
- Output bắt buộc:
  - bubble pane + price line
  - flow pane + CVD/strength/institutional strength
  - legend đúng màu
- Acceptance:
  - institutional strength không dùng màu dễ nhầm với buy
  - price line nhìn rõ nhưng không lấn bubble

### FE-04. Refactor tooltip point-anchored

Trạng thái: `[x]`

- Priority: Critical
- Owner: Frontend
- Files neo:
  - `frontend/src/components/WhaleBubbleChart.jsx`
- Output bắt buộc:
  - tooltip chỉ bind đúng điểm hover
  - empty state fail-safe
- Acceptance:
  - hover bubble chỉ ra dữ liệu bubble tại đúng timestamp
  - hover line chỉ ra dữ liệu line tại đúng timestamp
  - không có cross-bucket inference

### FE-05. Đồng bộ crosshair theo timestamp giữa 2 pane

Trạng thái: `[x]`

- Priority: High
- Owner: Frontend
- Files neo:
  - `frontend/src/components/WhaleBubbleChart.jsx`
- Output bắt buộc:
  - vertical crosshair sync hai chiều giữa 2 pane
- Acceptance:
  - crosshair sync vẫn không làm tooltip trộn dữ liệu khác điểm hover

### FE-06. Polling, background pause, immediate resume

Trạng thái: `[x]`

- Priority: Critical
- Owner: Frontend
- Files neo:
  - `frontend/src/hooks/useWhaleAnalyticsData.js`
- Output bắt buộc:
  - pause polling khi tab background
  - fetch ngay khi tab active trở lại
  - bỏ response stale hoặc response trễ không còn đúng context
- Acceptance:
  - không chờ đến chu kỳ 30s tiếp theo mới refresh
  - đổi symbol/timeframe không bị race

### FE-07. Trạng thái degraded/stale và empty data

Trạng thái: `[x]`

- Priority: High
- Owner: Frontend
- Files neo:
  - `frontend/src/components/WhaleBubbleChart.jsx`
  - `frontend/src/components/WhaleAnalyticsTab.jsx`
- Output bắt buộc:
  - badge hoặc notice ngắn gọn khi dữ liệu stale/degraded
  - trạng thái `Không có dữ liệu` đúng ngữ cảnh
- Acceptance:
  - không render giá trị gây hiểu nhầm khi payload thiếu

### FE-08. Test frontend behavior

Trạng thái: `[x]`

- Priority: High
- Owner: Frontend + QA
- Output bắt buộc:
  - test logic hook/state
  - test tooltip binding
  - test pause/resume lifecycle
- Acceptance:
  - có evidence log/network/video cho audit

## 4. Slice QA và Audit

### QA-01. Contract verification

Trạng thái: `[x]`

- Verify response thật khớp API spec
- Verify headers, metadata, timeframe, data_state

### QA-02. UI behavior verification

Trạng thái: `[/]`

- Verify chart với live session, off-hours, lunch gap, cuối tuần, holiday
- Verify tooltip/crosshair/resume logic

### QA-03. Formula sanity verification

Trạng thái: `[x]`

- Verify strength/institutional strength không bão hòa giả
- Verify bucket nhỏ không đẩy strength lên 100 vô lý

### QA-04. Load and cache verification

Trạng thái: `[x]`

- Verify cache hit behavior
- Verify conditional request
- Verify response `304` nếu chưa đổi

### QA-05. Evidence pack completion

Trạng thái: `[/]`

- Thu đủ screenshot, video, test log, payload mẫu, curl/devtools capture

### QA-06. Audit close-out

Trạng thái: `[/]`

- Ghi pass/fail theo từng task vào audit pack

## 4.1. Cập nhật trạng thái thực thi 2026-04-24

- Backend slice BE-01 -> BE-08 da duoc code hoa va khoa bang regression tests snapshot API / flow formula.
- Frontend slice FE-01 -> FE-08 da duoc code hoa; regression hien co gom degraded rendering, tooltip point-anchored binding va hook lifecycle `pause/resume + stale-response drop`.
- QA-02, QA-05, QA-06 giu `[/]` vi van can them bang chung manual nhu screenshot, video va devtools capture theo audit pack.

## 5. Điều kiện đóng taskboard

Taskboard chỉ được đóng khi:
- toàn bộ task Critical đạt `[x]`
- không còn bug blocker ở nhóm time, tooltip, snapshot contract, race condition
- audit pack có đủ bằng chứng cho BE, FE và QA
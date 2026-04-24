# TASKBOARD THUC THI - WHALE ANALYTICS V2

## 1. Mục đích

Taskboard này dùng để giao việc thực tế cho đội code và là checklist audit sau triển khai.

Quy ước trạng thái:

- `[ ]` Chưa bắt đầu
- `[/]` Đang làm
- `[x]` Hoàn thành
- `[!]` Bị chặn

Lưu ý bắt buộc: trạng thái chỉ được tick khi code, test và bằng chứng thật đã tồn tại. Không được đánh dấu hoàn thành trước.

## 2. Giai đoạn 1 - Giao diện va tiện ích

### FE-1.1 Tạo Information Panel docked

Trạng thái: `[ ]`

- Priority: Critical
- Owner: Frontend Lead
- Files neo:
  - `frontend/src/components/WhaleBubbleChart.jsx`
  - `frontend/src/utils/whaleTooltipFormatter.js`
- Output bắt buộc:
  - panel cố định ngoài vùng chart
  - cập nhật nội dung theo bubble/line hover
  - fallback khi không hover
- Acceptance:
  - không còn popup che vùng dữ liệu chính
  - hover bubble và line đều cập nhật panel đúng timestamp

### FE-1.2 Thêm filter ngưỡng lệnh minh bạch

Trạng thái: `[ ]`

- Priority: Critical
- Owner: Frontend
- Files neo:
  - `frontend/src/components/WhaleBubbleChart.jsx`
- Output bắt buộc:
  - preset ngưỡng nhanh
  - slider log-scale
  - text hiển thị ngưỡng đang áp dụng
- Acceptance:
  - mọi bubble trên ngưỡng hiện hành vẫn hiển thị đầy đủ
  - line price/CVD/strength không bị filter theo bubble threshold

### FE-1.3 Khóa rule visual truthfulness

Trạng thái: `[ ]`

- Priority: Critical
- Owner: Frontend + Reviewer
- Files neo:
  - `frontend/src/hooks/useOrderBubbleCoordinates.js`
  - `frontend/src/components/WhaleBubbleChart.jsx`
- Output bắt buộc:
  - bubble lớn nằm lớp trên
  - không opacity taper mặc định
  - không hidden-by-density
- Acceptance:
  - auditor xác nhận chart không làm sai cảm nhận mật độ giao dịch

### FE-1.4 Direct label/endLabel cho line chính

Trạng thái: `[ ]`

- Priority: High
- Owner: Frontend
- Files neo:
  - `frontend/src/components/WhaleBubbleChart.jsx`
- Output bắt buộc:
  - label trực tiếp cho price, CVD, buy strength, institutional strength
- Acceptance:
  - người dùng đọc được line chính mà không cần dò legend

### FE-1.5 Sửa fallback i18n của chart

Trạng thái: `[ ]`

- Priority: High
- Owner: Frontend
- Files neo:
  - `frontend/src/i18n/index.js`
  - `frontend/src/i18n/vi.js`
  - `frontend/src/i18n/en.js`
  - `frontend/src/components/WhaleBubbleChart.jsx`
- Output bắt buộc:
  - không còn raw i18n key trên chart
- Acceptance:
  - screenshot/QA xác nhận mọi nhãn chart hiển thị đúng tiếng Việt/Anh

## 3. Giai đoạn 2 - Dữ liệu và bối cảnh giá

### BE-2.1 Mở rộng snapshot với session_levels

Trạng thái: `[ ]`

- Priority: Critical
- Owner: Backend Lead
- Files neo:
  - `backend/portfolio/services_whale_analytics_snapshot.py`
- Output bắt buộc:
  - `reference_price`, `high_price`, `low_price`, `ceiling_price`, `floor_price`
- Acceptance:
  - payload thật có đủ field và đúng đơn vị

### FE-2.2 Render dashed price context lines

Trạng thái: `[ ]`

- Priority: Critical
- Owner: Frontend
- Files neo:
  - `frontend/src/components/WhaleBubbleChart.jsx`
  - `frontend/src/utils/whaleAnalyticsSnapshotAdapter.js`
- Output bắt buộc:
  - render ref/high/low/trần/sàn theo session_levels
- Acceptance:
  - UI phân biệt được các line mà không nhầm màu/ý nghĩa

### FE-2.3 Thêm DataZoom sync hai pane

Trạng thái: `[ ]`

- Priority: High
- Owner: Frontend
- Files neo:
  - `frontend/src/components/WhaleBubbleChart.jsx`
- Output bắt buộc:
  - zoom bubble pane và flow pane đồng thời
- Acceptance:
  - zoom không phá linear time và hover semantics

## 4. Giai đoạn 3 - Phân tích chuyên sâu

### BE-3.1 Thêm flow speed series

Trạng thái: `[ ]`

- Priority: High
- Owner: Backend Quant/Platform
- Files neo:
  - `backend/portfolio/services_whale_analytics_snapshot.py`
  - module tính toán intraday tốc độ nếu cần
- Output bắt buộc:
  - `flow_series.speed`
  - canonical unit rõ ràng
- Acceptance:
  - QA/auditor xác định được speed definition duy nhất

### BE-3.2 Thêm percentile baseline 10 phiên

Trạng thái: `[ ]`

- Priority: High
- Owner: Backend Quant
- Files neo:
  - service snapshot
  - module baseline/history liên quan
- Output bắt buộc:
  - `matched_value_percentile_10d`
  - `event_score_percentile_10d`
  - `baseline_sample_size`
- Acceptance:
  - thiếu baseline phải degrade rõ ràng, không trả 0 giả

### FE-3.3 Hiển thị speed và percentile trong panel

Trạng thái: `[ ]`

- Priority: High
- Owner: Frontend
- Files neo:
  - `frontend/src/components/WhaleBubbleChart.jsx`
  - `frontend/src/utils/whaleTooltipFormatter.js`
- Output bắt buộc:
  - progress bar percentile
  - label speed rõ nghĩa
- Acceptance:
  - thay thế được semantics nhị phân `Có/Có`

## 5. QA và audit

### QA-4.1 Chạy regression theo phase

Trạng thái: `[ ]`

- Priority: Critical
- Owner: QA
- Output bắt buộc:
  - evidence cho hover, filter, zoom, session levels, speed, percentile theo phase tương ứng

### AUD-4.2 Đối chiếu traceability matrix

Trạng thái: `[ ]`

- Priority: Critical
- Owner: Auditor
- Files neo:
  - `docs/WHALE_ANALYTICS_V2_TRACEABILITY_MATRIX_20260424.md`
- Acceptance:
  - mọi requirement đều map được tới code, test và evidence

## 6. Điều kiện fail ngay trên taskboard

Nếu xảy ra một trong các điều sau thì task tương ứng phải bị trả về `FAIL`, không được tick hoàn thành:

- bubble trên ngưỡng bị mất khỏi chart,
- Information Panel bind sai timestamp,
- raw i18n key còn hiện,
- session levels sai đơn vị,
- speed/percentile hiển thị dữ liệu giả khi backend thiếu source.

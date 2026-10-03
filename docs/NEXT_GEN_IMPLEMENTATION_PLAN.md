# VNInvest Next-Gen: Lộ Trình Triển Khai 4 Tuần (Bản Sẵn Sàng Coding)

> Mục tiêu: biến kế hoạch định hướng thành playbook triển khai có thể bắt đầu code ngay sau khi duyệt.
> Triết lý: thay đổi nhỏ, có cờ bật/tắt, có guard dữ liệu, có rollback drill, có tiêu chí go/no-go rõ ràng.
> Taskboard triển khai chi tiết: docs/NEXT_GEN_TASKBOARD_4_WEEKS.md

## 0) Mapping vào Roadmap Sprint hiện tại

Để tránh phá vỡ roadmap đang chạy (Sprint 19 và Sprint 20), kế hoạch 4 tuần này được tách thành 2 sprint mới:

1. Sprint 21 (Phase 1A)
- Tuần 1: Baseline + Infra + Feature Flags
- Tuần 2: Refactor Repository (không đổi nghiệp vụ)

2. Sprint 22 (Phase 1B)
- Tuần 3: ADV Pipeline + Shadow Mode
- Tuần 4A: Canary Dynamic Thresholds
- Tuần 4B: Global WS Provider Phase 1 (Watchlist Web)

Ghi chú phạm vi:
1. Sprint 20 giữ trọng tâm i18n theo kế hoạch đã có.
2. Sprint 21-22 là nhánh Next-Gen độc lập, không chen vào Sprint 19.

---

## 1) Scope Quyết Định

### 1.1 Hạng mục chốt làm trong 4 tuần
1. Trả Technical Debt: tách Data Access (Repository) khỏi Business Logic trong Order Flow.
2. Dynamic Thresholds theo ADV (thay dần ngưỡng hardcode).
3. Global WebSocket Provider cho Web Frontend theo Adapter Pattern (giữ tương thích hook cũ).

### 1.2 Hạng mục đóng băng
1. MessagePack/Protobuf cho realtime stream.
2. Multi-asset Derivatives.
3. AI Rebalancing.

### 1.3 Nguyên tắc không phá vỡ hệ thống cũ
1. Không thay đổi công thức cốt lõi trong giai đoạn refactor (tuần 2).
2. Dynamic chạy shadow trước khi canary.
3. WebSocket Provider rollout từng màn hình, không bật đồng loạt.
4. Mọi hạng mục đều có feature flag và rollback trong dưới 3 phút.

---

## 2) Definition of Ready / Definition of Done

### 2.1 Definition of Ready (trước khi code)
1. Có owner chính và owner dự phòng cho từng workstream.
2. Có branch strategy thống nhất và naming convention.
3. Có baseline metrics được chụp trước thay đổi.
4. Có danh sách file dự kiến sửa và test matrix.
5. Có cờ bật/tắt đã khai báo rõ tên, default value, nơi cấu hình.

### 2.2 Definition of Done (trước khi merge)
1. Unit + regression tests pass.
2. KPI tuần không xấu hơn baseline quá ngưỡng cho phép.
3. Có rollback drill bằng thao tác tắt cờ thành công.
4. Có changelog/nghiệm thu tuần và log quyết định go/no-go.
5. Không còn TODO blocker trong code path production.

---

## 3) Kiến Trúc Triển Khai Theo Workstream

## 3.1 Workstream A: Refactor Repository (Backend)
Mục tiêu: tách lớp truy vấn dữ liệu khỏi module tính toán để giảm circular import và tăng khả năng mở rộng.

Phạm vi file dự kiến:
1. backend/portfolio/order_flow.py
2. backend/portfolio/repositories.py (new)
3. backend/portfolio/realtime/compute.py (nếu cần thay interface nhập dữ liệu)
4. backend/portfolio/tests/* (regression + adapter tests)

Không được thay đổi trong tuần 2:
1. Công thức toán CVD/Iceberg/Absorption.
2. Rule nghiệp vụ cảnh báo hiện hành.

Acceptance:
1. Kết quả output các hàm chính không đổi trên cùng input fixture.
2. Không còn inline import model trong hàm tính toán.
3. Runtime p95 không xấu hơn baseline quá 10%.

## 3.2 Workstream B: Dynamic Thresholds theo ADV (Backend + Data)
Mục tiêu: thay hardcode bằng ngưỡng tương đối theo thanh khoản mã.

Phạm vi file dự kiến:
1. backend/portfolio/models.py
2. backend/portfolio/migrations/0015_stockprofile_adv10d.py
3. backend/portfolio/realtime/compute.py
4. backend/portfolio/tasks.py (cron/celery update ADV)
5. backend/portfolio/tests/test_dynamic_thresholds.py (new)

Data Guard bắt buộc:
1. ADV freshness SLO < 24h.
2. Nếu ADV thiếu hoặc stale, fallback static threshold + warning log.

Chế độ rollout:
1. Tuần 3: shadow mode, không ảnh hưởng alert user.
2. Tuần 4A: canary 10% user nội bộ.

Acceptance:
1. Có báo cáo shadow diff theo nhóm vốn hóa Large/Mid/Small.
2. Fallback hoạt động đúng khi data stale.
3. Canary không vi phạm điều kiện đỏ rollback.

## 3.3 Workstream C: Global WebSocket Provider (Frontend Web)
Mục tiêu: gom nhiều subscribe thành một kết nối socket dùng chung.

Phạm vi file dự kiến:
1. frontend/src/context/RealtimeContext.jsx (new)
2. frontend/src/hooks/useRealtimeFeed.js (adapter)
3. frontend/src/App.js (wrap provider)
4. frontend/src/screens/Watchlist* (migrate phase 1)

Nguyên tắc rollout:
1. Migrate Watchlist trước.
2. Dashboard migrate sau khi Watchlist ổn định.
3. Giữ API hook cũ để tránh sửa diện rộng cùng lúc.

Acceptance:
1. Số WS connection đồng thời giảm >= 40% so với baseline màn hình nhiều widget.
2. Drop/reconnect rate không tăng xấu vượt ngưỡng.
3. Không thay đổi UX chức năng với người dùng cuối.

---

## 4) Feature Flags, Kill-Switch, Rollback

### 4.1 Danh sách cờ tối thiểu
1. DYNAMIC_THRESHOLDS_ENABLED=false (default).
2. GLOBAL_WS_PROVIDER_ENABLED=false (default).
3. DYNAMIC_THRESHOLDS_CANARY_PERCENT=0 (0, 10, 25, 50, 100).

### 4.2 Điều kiện đỏ auto-rollback
1. WS reconnect rate > 5% trong 5 phút.
2. Alert volume tăng đột biến bất thường không giải thích được (spam) theo ngưỡng giám sát.
3. p95 latency realtime vượt SLA đã cam kết liên tục 10 phút.

### 4.3 Quy trình rollback chuẩn hóa
1. Tắt cờ liên quan.
2. Xác nhận metric quay lại baseline.
3. Ghi sự cố vào log tuần (incident note + nguyên nhân tạm thời).
4. Chặn rollout tiếp theo cho tới khi có fix + retest.

SLA rollback: dưới 3 phút từ khi phát hiện điều kiện đỏ.

---

## 5) Kế Hoạch 4 Tuần (Ready-to-Execute)

### Tuần 1: Baseline + Infra
Owner: Tech Lead + DevOps.
Effort: 0.5 man-week.

Checklist thực thi:
1. Chốt dashboard metrics: CPU worker, WS connections/user, reconnect rate, realtime latency p95.
2. Tạo wrapper feature flags cho BE + FE web.
3. Chụp baseline report tuần 1.

Go/No-Go cuối tuần:
1. Go nếu metrics baseline ổn định và flag toggle hoạt động trên staging.
2. No-Go nếu chưa có dashboard đo được theo giờ giao dịch cao điểm.

### Tuần 2: Refactor Repository
Owner: Backend Engineer.
Effort: 1 man-week.

Checklist thực thi:
1. Tạo repositories.py và chuyển truy vấn DB ra khỏi order_flow.py.
2. Giữ nguyên công thức tính toán.
3. Chạy regression tests đầy đủ.

Go/No-Go cuối tuần:
1. Go nếu output không đổi trên fixture regression.
2. No-Go nếu runtime tăng >10% hoặc có sai khác output chưa giải thích.

### Tuần 3: ADV Pipeline + Shadow Mode
Owner: Data/Backend Engineer.
Effort: 1 man-week.

Checklist thực thi:
1. Migration thêm trường ADV + timestamp update.
2. Job cập nhật ADV hằng ngày.
3. Dynamic thresholds chạy shadow, static vẫn phục vụ user.
4. Xuất báo cáo shadow diff.

Go/No-Go cuối tuần:
1. Go nếu ADV freshness đạt SLO và báo cáo shadow rõ.
2. No-Go nếu tỷ lệ thiếu ADV cao hoặc diff quá lệch không giải thích được.

### Tuần 4A: Canary Dynamic Thresholds
Owner: Backend + QA.
Effort: 0.5 man-week.

Checklist thực thi:
1. Bật canary 10% user nội bộ.
2. Theo dõi alert precision + spam risk + rollback drill.

Go/No-Go cuối pha:
1. Go nếu KPI ổn định và QA xác nhận không spam.
2. No-Go nếu chạm điều kiện đỏ rollback.

### Tuần 4B: WebSocket Provider Phase 1 (Watchlist)
Owner: Frontend Web Engineer.
Effort: 1 man-week.

Checklist thực thi:
1. Thêm RealtimeContext.
2. Hook useRealtimeFeed chạy theo adapter.
3. Migrate Watchlist trước, giữ Dashboard ở chế độ cũ.

Go/No-Go cuối pha:
1. Go nếu WS connections giảm và reconnect không xấu đi.
2. No-Go nếu có regression realtime UX.

---

## 6) KPI Nghiệm Thu Chung Sau 4 Tuần

1. P95 realtime latency < 1.5s.
2. WS connection đồng thời giảm >= 40% tại giờ cao điểm.
3. Reconnect rate < 3% trên web client.
4. Dynamic thresholds có bằng chứng giảm báo rác ở nhóm vốn hóa phù hợp.

---

## 7) Test Matrix Bắt Buộc

### 7.1 Backend
1. Regression tests hiện có phải pass toàn bộ.
2. Test mới cho fallback stale ADV.
3. Test shadow diff consistency.

### 7.2 Frontend Web
1. Test subscribe/unsubscribe lifecycle khi mount/unmount liên tục.
2. Test reconnect sau token refresh.
3. Test một trang nhiều widget nhưng chỉ còn một socket mở.

### 7.3 Manual QA
1. Drill tắt cờ trong giờ tải giả lập.
2. So sánh before/after trên Watchlist realtime.
3. Theo dõi log cảnh báo trong phiên giao dịch mock.

---

## 8) Quy Ước Git/PR Để Bắt Đầu Code

1. Branch naming:
- feature/nextgen-repository-refactor
- feature/nextgen-dynamic-thresholds
- feature/nextgen-global-ws-provider

2. PR template tối thiểu:
1. Mục tiêu thay đổi.
2. File thay đổi chính.
3. Cờ liên quan và default.
4. Test evidence.
5. Rollback note.

3. Merge policy:
1. Không squash nhiều workstream vào một PR.
2. Bắt buộc review chéo Backend/Frontend khi đụng interface realtime.

---

## 9) Quyết Định Sau Tuần 4

Nếu KPI đạt và vận hành ổn định, mới mở pha planning cho:
1. MessagePack/Protobuf (nếu chứng minh bottleneck băng thông).
2. AI Rebalancing (sau khi dữ liệu threshold ổn định ít nhất 1-2 tháng).
3. Multi-asset Derivatives (stream độc lập, không đi chung nhánh ổn định lõi).

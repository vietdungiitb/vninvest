# Kế hoạch Kỹ thuật Phase 2: Thành phần Hội tụ & Khắc phục lỗi lặp cảnh báo

**Tài liệu chỉ dẫn thực thi cho Đội phát triển (Dev Team)**  
**Vai trò Antigravity**: Auditor & Planner  
**Mục tiêu**: Hoàn thiện lớp hiển thị Dashboard V2 và triệt tiêu lỗi lặp dữ liệu Whale Alert.

---

## 1. Khắc phục lỗi lặp Whale Alerts (Backend & Frontend)

### 1.1 Backend: Chuẩn hóa Dữ liệu (compute.py)
- **Vị trí**: `backend/portfolio/realtime/compute.py`
- **Nhiệm vụ**:
    - Truncate `WhaleSignal.ts` về đơn vị giây (bỏ phần mili giây) trước khi tạo `event_id`.
    - Đảm bảo `_build_whale_event_id` tạo ra một chuỗi (string) có tính duy nhất tuyệt đối dựa trên: `Mã:Thời gian(Giây):Phe:Giá trị`.

### 1.2 Backend: Cải tổ Broadcast (tasks_realtime.py)
- **Vị trí**: `backend/portfolio/tasks_realtime.py`
- **Nhiệm vụ**:
    - Trong hàm `collect_and_publish_realtime`, thêm cờ đánh dấu (flag) các sự kiện đã được publish vào Redis Stream / Channel layer.
    - Đảm bảo một tín hiệu Whale chỉ được `publish` **duy nhất 1 lần** tới các Group WebSocket, tránh việc gửi chồng lấn giữa `whale:{symbol}` và `user:{id}:alerts`.

### 1.3 Frontend: Gia cố bộ lọc (useRealtimeFeedCore.js)
- **Vị trí**: `frontend/src/hooks/useRealtimeFeedCore.js`
- **Nhiệm vụ**:
    - Sử dụng `normalizeEventTimestamp` cho mọi payload nhận được từ WebSocket trước khi gọi `applyAlert`.
    - Bổ sung `Map` lưu trữ `lastProcessedEventIds` với thời gian hết hạn (TTL) 1000ms để chặn các gói tin trùng lặp ở tầng mạng.

---

## 2. Triển khai Component Hội tụ (Bloomberg V2)

### 2.1 UnifiedAlertBar (Thanh chỉ số tổng quát)
- **Vị trí mới**: `frontend/src/components/UnifiedAlertBar.jsx`
- **Thiết kế**: 
    - Hiển thị tóm tắt số lượng cảnh báo theo mức độ: `[32] Nghiêm trọng`, `[2] Cao`, `[1] Trung bình`.
    - Màu sắc tương ứng: Rose (Nghiêm trọng), Amber (Cao), Cyan (Trung bình).
    - **Tương tác**: Click vào từng số lượng để filter danh sách ở `UnifiedAlertCenter` bên dưới.
- **Data Source**: Consume dữ liệu từ hook `useUnifiedAlerts`.

### 2.2 UnifiedAlertCenter (Trung tâm cảnh báo chi tiết)
- **Vị trí mới**: `frontend/src/components/UnifiedAlertCenter.jsx` (Refactor từ WhaleFeedPanel)
- **Thiết kế**: 
    - Hiển thị danh sách Card cảnh báo đa nguồn (Whale, Dark Flow, Price Shock).
    - Mỗi Card cần có: Icon loại cảnh báo, Thời gian, Badge độ nghiêm trọng, Nút "Đã đọc", Nút "Mute 30p".
    - Hỗ trợ cuộn (scroll) và Load more (kết nối với hook `useUnifiedAlerts.loadMoreUnifiedSnapshot`).

### 2.3 Cập nhật Trang Dashboard
- **Vị trí**: `frontend/src/pages/Dashboard.jsx`
- **Nhiệm vụ**:
    - Thay thế toàn bộ `DashboardRealtimePanel` cũ bằng bộ đôi `UnifiedAlertBar` và `UnifiedAlertCenter`.
    - Bố trí Layout theo tỷ lệ 3:1 (Alert Center bên trái, Portfolio Analytics bên phải) theo đúng Mockup Image 4.

---

## 3. Quản lý tiến độ (Audit Governance)
Đội code sau khi hoàn thành mỗi đầu mục **BẮT BUỘC** phải:
1. Cập nhật dòng trạng thái vào [CODE_CHANGE_AUDIT_LEDGER.md](file:///c:/Mujoco%20Projects/vninvest/CODE_CHANGE_AUDIT_LEDGER.md).
2. Đánh dấu hoàn thành trong [PROGRESS_DASHBOARD.md](file:///c:/Mujoco%20Projects/vninvest/PROGRESS_DASHBOARD.md).
3. Chạy kiểm tra lỗi Compile/Lint trên các file mới tạo.

---

**Phê duyệt từ Auditor**: Bản kế hoạch này đã sẵn sàng để thực thi. Đội code có thể bắt đầu ngay lập tức dựa trên các chỉ dẫn cụ thể trên.

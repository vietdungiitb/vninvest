# Hướng dẫn Kỹ thuật: Khắc phục lỗi lặp lại Whale Alerts (V2)

**Tài liệu dành cho Đội phát triển (Dev Team)**  
**Người Audit**: Antigravity (Auditor Mode)  
**Trạng thái**: Chờ thực thi

---

## 1. Mô tả lỗi (Bug Report)
Trên giao diện Dashboard và Whale Hub, người dùng gặp tình trạng một giao dịch Whale (giao dịch lớn) hiển thị lặp lại từ 2 đến 4 lần với cùng một giá trị, cùng một thời điểm (giây), gây loãng dữ liệu và giảm trải nghiệm người dùng.

---

## 2. Phân tích nguyên nhân gốc rễ (RCA)

### 2.1 Backend: Broadcast Redundancy
Hệ thống phát tín hiệu qua WebSocket đang thực hiện "phát sóng kép" (Double Broadcast):
- **Kênh mã cổ phiếu**: `whale:{symbol}` (Ví dụ: `whale_BID`).
- **Kênh người dùng**: `user:{user_id}:alerts`.
- **Hậu quả**: Khi một người dùng đang theo dõi mã BID, họ vô tình nhận được tin nhắn từ cả 2 kênh này cùng lúc.

### 2.2 Backend: Idempotency (Tính duy nhất)
Mã định danh `event_id` cho cảnh báo Whale đang được tính toán theo công thức:
`f"whale:{symbol}:{ts}:{side}:{value}:{threshold}"`
- **Vấn đề**: Giá trị `ts` (thời gian) nếu lấy từ `iso_now()` mà không làm tròn đến giây sẽ tạo ra các `event_id` khác nhau cho cùng một sự kiện thực tế (do chênh lệch mili giây).
- **Hậu quả**: Hệ thống Cache Deduplication tại Backend không thể chặn được vì coi đó là 2 sự kiện khác nhau.

### 2.3 Frontend: Key Stability
Tại file `useRealtimeFeedCore.js`, logic lọc trùng (`filter`) dựa trên khóa tự tạo:
- **Khóa tự tạo**: `${symbol}-${ts}-${side}`
- **Vấn đề**: Frontend không chuẩn hóa `ts` về dạng giây (`Z`) trước khi tạo khóa, dẫn đến việc các chuỗi thời gian có định dạng khác nhau (từ REST API vs từ WebSocket) không khớp nhau.

---

## 3. Chỉ dẫn thực hiện cho Đội Code (Action Items)

### 3.1 Cải tổ Backend (Python)
- **Tệp chỉnh sửa**: `backend/portfolio/tasks_realtime.py` và `backend/portfolio/realtime/compute.py`.
- **Yêu cầu**:
    1. Chuẩn hóa `WhaleSignal.ts` luôn ở định dạng ISO-8601 làm tròn đến **giây** (vd: `2026-04-17T10:17:51Z`).
    2. Trong `collect_and_publish_realtime`, thêm logic kiểm tra nếu đã gửi qua `whale_channel` thành công thì có thể bỏ qua việc gửi lại vào `user_channel` đối với các loại sự kiện Whale chung.

### 3.2 Cải tổ Frontend (Javascript)
- **Tệp chỉnh sửa**: `frontend/src/hooks/useRealtimeFeedCore.js` và `frontend/src/components/WhaleFeedPanel.jsx`.
- **Yêu cầu**:
    1. Tại `applyAlert`: Trước khi lọc trùng, phải dùng hàm `normalizeEventTimestamp` (đã có sẵn trong project) để chuẩn hóa `ts` của mọi payload về cùng một định dạng giây.
    2. Implement một **"Deduplication Window"**: Sử dụng một `Map` hoặc `Set` lưu các `event_id` vừa nhận được trong vòng 1000ms. Nếu nhận được ID trùng trong khoảng thời gian này, hãy bỏ qua (ignore).
    3. Cập nhật `buildFeedEventKey` trong `WhaleFeedPanel` để đảm bảo logic khớp hoàn toàn với Backend `event_id`.

---

## 4. Kiểm tra và Xác nhận (Verification)
- Mở trang Whale Alerts chi tiết của một mã có thanh khoản cao (vd: BID, HPG).
- Quan sát luồng Realtime (WebSocket) trong DevTools Tab Network.
- Xác nhận: Mỗi giao dịch lớn chỉ xuất hiện **duy nhất 1 card** mới trong Feed.
- Kiểm tra tính nhất quán giữa dữ liệu cũ (kéo từ REST API khi load trang) và dữ liệu mới (đẩy qua WS) không bị chồng lấn.

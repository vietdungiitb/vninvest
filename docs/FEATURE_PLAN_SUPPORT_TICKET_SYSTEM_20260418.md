# Kế hoạch chi tiết: Hệ thống Ticket Hỗ trợ (Support Ticket System)

Tài liệu này cung cấp đặc tả kỹ thuật đầy đủ để triển khai tính năng Ticket hỗ trợ người dùng trong hệ thống VNInvest.

---

## 1. Tổng quan (Overview)
Tính năng này cho phép người dùng gửi các yêu cầu trợ giúp, báo lỗi hoặc đề xuất tính năng trực tiếp từ giao diện ứng dụng. Đội ngũ quản trị (Admin/Staff) có thể theo dõi, phản hồi và quản lý trạng thái của các yêu cầu này.

### Mục tiêu:
- Tăng tính tương tác và hỗ trợ người dùng kịp thời.
- Tập trung các kênh phản hồi về một đầu mối duy nhất.
- Theo dõi lịch sử hỗ trợ của từng khách hàng.

---

## 2. Thiết kế Cơ sở dữ liệu (Database Design)

Chúng ta sẽ tạo một App Django mới mang tên `support`.

### Model: `SupportTicket`
Lưu trữ thông tin chính của một yêu cầu.

| Trường | Kiểu dữ liệu | Mô tả |
| :--- | :--- | :--- |
| `user` | ForeignKey(User) | Người tạo ticket. |
| `ticket_id` | CharField | Mã định danh duy nhất (VD: VN-20260418-001). |
| `subject` | CharField(255) | Tiêu đề ngắn gọn của vấn đề. |
| `category` | CharField (Choices) | `TECHNICAL`, `ACCOUNT`, `BILLING`, `FEATURE_REQUEST`, `OTHER`. |
| `priority` | CharField (Choices) | `LOW`, `MEDIUM`, `HIGH`, `URGENT`. (Mặc định `MEDIUM`). |
| `status` | CharField (Choices) | `OPEN` (Mới), `IN_PROGRESS` (Đang xử lý), `RESOLVED` (Đã giải quyết), `CLOSED` (Đã đóng). |
| `created_at` | DateTimeField | Tự động ghi ngày tạo. |
| `updated_at` | DateTimeField | Tự động ghi ngày cập nhật cuối. |

### Model: `TicketMessage`
Lưu trữ nội dung trao đổi trong một ticket.

| Trường | Kiểu dữ liệu | Mô tả |
| :--- | :--- | :--- |
| `ticket` | ForeignKey(SupportTicket) | Liên kết với ticket cha. |
| `sender` | ForeignKey(User) | Người gửi tin nhắn (User hoặc Staff). |
| `text` | TextField | Nội dung tin nhắn. |
| `is_staff` | BooleanField | Flag đánh dấu tin nhắn từ phía quản trị viên. |
| `attachment` | FileField | (Optional) Đính kèm tệp tin/hình ảnh (max 5MB). |
| `created_at` | DateTimeField | Tự động ghi ngày gửi. |

---

## 3. Đặc tả API (Backend)

Sử dụng Django Rest Framework (DRF).

### Endpoints cho Người dùng (User):
- `GET /api/support/tickets/`: Lấy danh sách ticket của user hiện tại. Trả về metadata cơ bản.
- `POST /api/support/tickets/`: Tạo ticket mới. Payload yêu cầu `subject`, `category`, `description` (tạo message đầu tiên).
- `GET /api/support/tickets/<id>/`: Chi tiết ticket và toàn bộ thread tin nhắn (`TicketMessage`).
- `POST /api/support/tickets/<id>/reply/`: Gửi thêm tin nhắn vào ticket hiện có.

### Endpoints cho Quản trị (Staff):
- Sử dụng Django Admin (customized) để quản lý.
- (Tương lai) `GET /api/admin-ops/tickets/`: Danh sách toàn bộ ticket hệ thống.
- `PATCH /api/support/tickets/<id>/`: Cập nhật trạng thái (`status`) hoặc mức ưu tiên (`priority`).

### Phân quyền (Permissions):
- `IsAuthenticated`: Bắt buộc đăng nhập.
- `IsOwner`: Chỉ người tạo ticket hoặc staff mới có quyền xem/phản hồi ticket đó.

---

## 4. Thiết kế Giao diện (Frontend)

Trang Support sẽ nằm tại Route `/support`. Sử dụng phong cách thiết kế Bloomberg-style hiện có của hệ thống.

### Layout chính:
- **Left Sidebar**: Danh sách các Ticket hiện có (Card nhỏ hiển thị Ticket ID, Subject, Status Badge).
- **Right Area**: 
    - Nếu chưa chọn ticket: Hiển thị form "Tạo yêu cầu mới" hoặc màn hình Welcome.
    - Nếu đã chọn ticket: Hiển thị luồng chat (Thread), thông tin Ticket Meta (Category, Priority) và Box nhập tin nhắn.

### Các Component chính:
1. `SupportTicketList`: Hiển thị danh sách ticket với các badge màu sắc tương ứng trạng thái.
2. `TicketThread`: 
    - Tin nhắn của User: Căn phải, nền tối.
    - Tin nhắn của Support: Căn trái, viền `terminal-cyan`, có label "Support Team".
3. `TicketCreationForm`: Form validation chặt chẽ (Subject tối thiểu 10 ký tự, Category bắt buộc).

### Design Tokens (CSS Variables):
- Trạng thái `OPEN`: `--terminal-cyan`
- Trạng thái `RESOLVED`: `--terminal-rise` (Xanh lá)
- Trạng thái `URGENT`: `--terminal-fall` (Cam/Đỏ)
- Background: `--v2-shell-bg`

---

## 5. Quy trình thông báo (Notifications)

1. **User Tạo Ticket**:
    - Backend gửi email thông qua `mail_service.send_system_email` cho danh sách staff/admin.
    - Tiêu đề: `[Support] New Ticket Created: <Ticket ID>`.
2. **Staff Phản hồi**:
    - Backend gửi email cho User.
    - Tiêu đề: `[VNInvest] Re: <Subject> - Feedback from Support Team`.
    - Deep link dẫn trực tiếp đến URL: `/support?id=<ticket_id>`.

---

## 6. Lộ trình triển khai (Implementation Steps)

### Giai đoạn 1: Backend & Admin
- [ ] Khởi tạo Django app `support`.
- [ ] Định nghĩa Models & chạy Migrations.
- [ ] Cấu hình Django Admin (Inline messages để staff reply nhanh).
- [ ] Viết API Views & Serializers.

### Giai đoạn 2: Frontend & API Integration
- [ ] Thêm `api/support.js` để kết nối backend.
- [ ] Xây dựng trang `Support.jsx` với Layout 2 cột.
- [ ] Triển khai `TicketThread` component với hiệu ứng cuộn mượt.
- [ ] Thêm link "Hỗ trợ" vào `Sidebar.jsx`.

### Giai đoạn 3: Polishing & Email
- [ ] Tích hợp gửi email thông báo.
- [ ] Xử lý trạng thái Loading/Empty state cho danh sách Ticket.
- [ ] Hỗ trợ đính kèm hình ảnh (Drag & Drop).

---

## 7. Ghi chú Bảo mật
- Kiểm tra dung lượng và định dạng file đính kèm (`.jpg`, `.png`, `.pdf`) để tránh mã độc.
- Bắt buộc giới hạn rate limit cho API tạo ticket để tránh spam (Vd: tối đa 5 ticket/giờ/user).

---
**Tài liệu được soạn thảo bởi VNInvest AI Assistant - 18/04/2026.**

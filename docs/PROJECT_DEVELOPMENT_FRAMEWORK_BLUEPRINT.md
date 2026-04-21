# VNInvest Project Development Framework & Blueprint

Tài liệu này hệ thống hóa quy trình xây dựng dự án chuyên nghiệp dựa trên tiêu chuẩn của hệ thống VNInvest, dùng để tái sử dụng cho các dự án quy mô lớn khác.

---

## 1. Quy trình 5 Giai đoạn Phát triển (SDLC)

Hệ thống tuân thủ nghiêm ngặt quy trình "Plan-First, Code-Later".

### Giai đoạn 1: Xây dựng Ý tưởng (Concept Building)
- **Hoạt động**: Nghiên cứu thị trường, xác định nỗi đau của người dùng (User Painpoints).
- **Kết quả**: Tài liệu "Feature Backlog" và "Strategic Roadmap".
- **Quy tắc**: Mọi ý tưởng phải được lọc qua phễu "Value vs Effort" trước khi đưa vào Sprint Planning.

### Giai đoạn 2: Lập kế hoạch & Thiết kế (Planning & Architecture)
- **Chính sách bắt buộc**: Tuân thủ `IMPLEMENTATION_PLANNING_POLICY.md`, `AI_CODING_REGULATION.md`.
- **Nội dung Kế hoạch**:
    *   Mục tiêu nghiệp vụ (KPI đo lường được).
    *   Đánh giá hiện trạng (Current-state assessment).
    *   Thiết kế đích (Target Architecture & Data Flow).
    *   Hợp đồng API (API Contracts & Schema).
    *   Chiến lược Rollback và Quản trị rủi ro.
- **Quy tắc**: Chỉ được phép Code khi Kế hoạch đã được Review và Chốt (Definition of Ready).

### Giai đoạn 3: Triển khai & Chuẩn Code (Execution)
- **Chuẩn Code**: Phân tách rõ ràng Logic (Services), Giao diện (Views/Components) và Kết nối (Adapters).
- **Phát triển theo Sprints**: Chia nhỏ tính năng thành các Sprint (thường là 1-2 tuần) để kiểm soát tiến độ.
- **Sử dụng Feature Flags**: Tắt/Bật tính năng mới qua cấu hình để tránh làm gián đoạn hệ thống đang chạy.

### Giai đoạn 4: Kiểm thử & Đảm bảo chất lượng (QA & Verification)
- **Tháp Kiểm thử**: 
    1.  **Unit Tests (Chiếm 60%)**: Kiểm tra logic hàm, model.
    2.  **Integration Tests (Chiếm 30%)**: Kiểm tra Endpoint API, luồng dữ liệu giữa các module.
    3.  **E2E/UAT Tests (Chiếm 10%)**: Kiểm tra luồng nghiệp vụ thực tế trên giao diện.
- **Chỉ số Ready for Release**: Coverage > 90%, 0 lỗi nghiêm trọng (P0/P1).

### Giai đoạn 5: Vận hành & Cải tiến (Ops & Hardening)
- **Audit Ledger**: Lưu lại mọi thay đổi quan trọng vào `CODE_CHANGE_AUDIT_LEDGER.md`.
- **System Hardening**: Liên tục tối ưu hóa hiệu năng (Throttling, Caching, Query Optimization).

---

## 2. Checklist Test & Audit (Tái sử dụng)

### Checklist Test Tinh năng mới
- [ ] **Functional**: Đúng logic nghiệp vụ yêu cầu chưa?
- [ ] **Edge Cases**: Xử lý dữ liệu rỗng, dữ liệu sai định dạng chưa?
- [ ] **Security**: Phân quyền (Auth/Role) đã được áp dụng cho Endpoint mới chưa?
- [ ] **Performance**: Thời gian phản hồi API < 200ms không? Có bị N+1 query không?
- [ ] **Scalability**: Nếu có 10,000 user gọi cùng lúc, hệ thống có bị nghẽn không? (Cần async/background task không?)
- [ ] **Observability**: Đã có Logs và Metrics để theo dõi khi lỗi chưa?

### Checklist Audit Hệ thống (Định kỳ)
- [ ] **Code Quality**: Có file nào quá lớn (Fat views) cần refactor không?
- [ ] **Dependency Audit**: Các thư viện bên thứ 3 có phiên bản cũ/lỗ hổng bảo mật không?
- [ ] **Infrastructure Audit**: CPU/RAM/Redis memory có dấu hiệu quá tải không?
- [ ] **Data Integrity**: Dữ liệu giữa Cache (Redis) và DB (Postgres) có khớp nhau không?

---

## 3. Công nghệ cho Quy mô Lớn (Tens of Thousands of Users)

Để một dự án scale được như VNInvest, các công nghệ sau là xương sống:

| Lớp (Layer) | Công nghệ | Mục đích xử lý quy mô lớn |
| :--- | :--- | :--- |
| **Giao tiếp Realtime** | Daphne (ASGI) + WebSockets | Xử lý hàng nghìn kết nối đồng thời không chặn (Non-blocking). |
| **Application Server** | Gunicorn + UvicornWorker | Quản lý đa tiến trình ASGI; mỗi worker có event loop riêng biệt, tự động respawn khi deadlock. |
| **Xử lý Bất đồng bộ** | Celery + Redis | Đẩy tác vụ nặng xuống nền, giải phóng Web Worker ngay lập tức. |
| **Trạng thái Dữ liệu** | Redis Streams | Phân phối dòng dữ liệu (Ticker/Signals) cực nhanh với độ trễ thấp. |
| **Tính toán Hiệu năng** | Pandas (Vectorization) | Xử lý dữ liệu lịch sử lớn bằng tính toán mảng thay vì loop Python. |
| **Giao diện (FE)** | RAF Throttling | Gộp các cập nhật UI (Batching) để giảm tải cho CPU trình duyệt. |
| **Kiến trúc API** | 202 Accepted + Polling | Tránh Timeout cho các tác vụ lâu (như AI generation). |
| **Triển khai (Ops)** | Docker + Portainer | Dễ dàng nhân bản (Scale horizontal) các instance backend/worker. |

---

## 4. Kết luận

Bí quyết để tái sử dụng quy trình này cho dự án khác nằm ở việc **tuyên ngôn hóa các quy tắc** (Principles) và **công cụ hóa các bước kiểm tra** (Checklists). Đừng bắt đầu viết dòng code đầu tiên nếu chưa có một bản kế hoạch được Audit kỹ lưỡng.

# ĐỀ XUẤT KIẾN TRÚC CÔNG NGHỆ (TECH STACK) & ÁNH XẠ MODULE

**Date:** 2026-05-01
**Tình trạng:** Bản mở rộng đảm bảo khả năng mở rộng (Scale lên 10,000 CCU) và tích hợp mô hình B2B mà **KHÔNG** làm phá vỡ kiến trúc cũ (SSOT).

---

## 1. Bản Đồ Liên Kết Tài Liệu (Document Cross-References)
Để tránh bỏ sót bối cảnh, các module công nghệ dưới đây phục vụ trực tiếp cho các thiết kế đã được thống nhất tại:
1. Kiến trúc B2B/VIP Client: [B2B_ENTERPRISE_ARCHITECTURE_PROPOSAL](file:///c:/Mujoco%20Projects/vninvest/docs/B2B_ENTERPRISE_ARCHITECTURE_PROPOSAL_20260501.md)
2. Luồng chạy AI: [MULTI_AGENT_ORCHESTRATOR_DESIGN](file:///c:/Mujoco%20Projects/vninvest/docs/MULTI_AGENT_ORCHESTRATOR_DESIGN_20260501.md)
3. Handoff cho Đội Code: [MULTI_AGENT_AI_TRADING_INFRASTRUCTURE_HANDOFF_MASTER](file:///c:/Mujoco%20Projects/vninvest/docs/MULTI_AGENT_AI_TRADING_INFRASTRUCTURE_HANDOFF_MASTER_20260501.md)

---

## 2. Bảng Ánh Xạ: Hệ Thống Module & Công Nghệ Tương Ứng

Dưới đây là sự bóc tách rõ ràng các công nghệ sẽ được áp dụng cho **từng Module cụ thể** trong hệ thống VNInvest hiện tại.

| Module Hiện Tại | Phân Hệ (Subsystem) | Công Nghệ Áp Dụng (Cũ -> Mới/Bổ sung) | Lý do & Ý nghĩa Kiến trúc |
|---|---|---|---|
| **Data Ops (Lõi thu thập)** | Ingestion & Background Jobs | Python Scripts -> **Celery + RabbitMQ** | Xử lý nạp hàng triệu Intraday Ticks cuối ngày mà không làm treo Web Server. |
| **Data Storage (Lưu trữ)** | Market Data (KLine, Ticks, Dark Money) | PostgreSQL -> **PostgreSQL (OLTP) + ClickHouse (OLAP)** | Giữ PostgreSQL cho User/Billing. Bổ sung ClickHouse cho Ticks vì tốc độ truy vấn `SUM(Volume)` siêu tốc (~50ms cho hàng tỷ records). |
| **Money Flow Control Center** | Tính toán Logic (SSOT: Whale, CVD) | Django Models & Services | **Giữ nguyên 100%.** Các hàm như `global_signal_universe_policy` vẫn là trái tim hệ thống. |
| **API Backend (Khách phổ thông)**| Truy xuất KLine, Portfolio | Django WSGI (Gunicorn) | **Giữ nguyên.** Dùng cho các request đồng bộ thông thường (Login, Xem biểu đồ, Đọc tin tức). |
| **AI Advisory (Orchestrator)** | Multi-Agent Debate & Realtime Sync | Django WSGI -> **Django ASGI (Uvicorn) + Server-Sent Events (SSE)** | Uvicorn xử lý luồng bất đồng bộ (Async). Bắt buộc để Stream kết quả AI từng phần từ 4 Agents về UI mà không cạn kiệt thread-pool. |
| **Realtime Pub/Sub** | Truyền giá & Tín hiệu Whale nhanh | Truy vấn DB liên tục -> **Redis Cluster (Pub/Sub)** | Khi có Whale Tick mới, push vào Redis. Uvicorn subscribe Redis và broadcast cho 10,000 CCU. Database vật lý không bị hit. |
| **B2B API Gateway** | Phân luồng & Quản lý Token VIP | NGINX -> **Kong API Gateway + Redis** | Kong đứng trước Django. Nhiệm vụ duy nhất: Kiểm tra VNInvest API Token của Quỹ VIP và Rate Limit (Chống cào dữ liệu) siêu tốc trong RAM. |
| **VIP Client (Self-Hosted)** | Giao diện cho Khách B2B tự cài đặt | Web Browser -> **Docker Compose (React UI + Node.js/Python Orchestrator)** | Đóng gói phần mềm Frontend và Orchestrator thành File Docker. Khách VIP tự chạy trên server nội bộ, điền LLM Key và chạy độc lập. |

---

## 3. Luồng Hoạt Động Không Phá Vỡ (Non-breaking Workflow)

Sự bổ sung các công nghệ trên (Kong, ClickHouse, Redis Pub/Sub, Uvicorn) hoạt động như các **"Lớp Giáp Tăng Cường"** xung quanh code lõi của VNInvest.

*   **Tại sao không vỡ cấu trúc cũ?** 
    *   Code Python hiện tại của đội backend (như `runtime_policy_helpers.py` hay `PortfolioHeatmap.jsx` ở Frontend) hoàn toàn không biết tới sự tồn tại của Kong Gateway hay Redis Pub/Sub. 
    *   Các lệnh query bằng Django ORM (Ví dụ: `IntradayTick.objects.filter(...)`) vẫn hoạt động. Chúng ta chỉ việc cấu hình cho ORM tự định tuyến (Database Routing) các truy vấn nặng sang ClickHouse thay vì Postgres.

## 4. Hành Động Tiếp Theo Cho Đội Code

Để thực hiện roadmap này mà không gây rủi ro, đội code cần theo sát tài liệu triển khai:
- Trọng tâm ưu tiên 1: Chuyển đổi tính năng AI tĩnh hiện tại sang mô hình Async ASGI để làm quen với Uvicorn. (Tham khảo: [TECH_SPEC_MULTI_AGENT_AI_TRADING](file:///c:/Mujoco%20Projects/vninvest/docs/TECH_SPEC_MULTI_AGENT_AI_TRADING_INFRASTRUCTURE_20260501.md)).
- Trọng tâm ưu tiên 2: Cài đặt Kong Gateway ở môi trường Staging để dựng hệ thống cấp API Token cho đối tác.
- Trọng tâm ưu tiên 3: Tách dần dữ liệu Ticks sang ClickHouse khi dung lượng Postgres vượt ngưỡng báo động.

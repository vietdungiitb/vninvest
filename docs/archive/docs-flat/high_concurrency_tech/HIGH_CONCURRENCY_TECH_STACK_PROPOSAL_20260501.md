# ĐỀ XUẤT KIẾN TRÚC CÔNG NGHỆ (TECH STACK) & ÁNH XẠ MODULE

**Date:** 2026-05-01
**Tình trạng:** Target-state tech stack cho mục tiêu 10,000 CCU. Thứ tự áp dụng thực tế phải bám theo [EXECUTION_REBASELINE](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_B2B_MCP_TRANSFORMATION_EXECUTION_REBASELINE_20260501.md).

---

## 1. Bản Đồ Liên Kết Tài Liệu (Document Cross-References)
Để tránh bỏ sót bối cảnh, các module công nghệ dưới đây phục vụ trực tiếp cho các thiết kế đã được thống nhất tại:
1. Kiến trúc B2B/VIP Client: [B2B_ENTERPRISE_ARCHITECTURE_PROPOSAL](file:///c:/Mujoco%20Projects/vninvest/docs/B2B_ENTERPRISE_ARCHITECTURE_PROPOSAL_20260501.md)
2. Luồng chạy AI: [MULTI_AGENT_ORCHESTRATOR_DESIGN](file:///c:/Mujoco%20Projects/vninvest/docs/MULTI_AGENT_ORCHESTRATOR_DESIGN_20260501.md)
3. Handoff cho Đội Code: [MULTI_AGENT_AI_TRADING_INFRASTRUCTURE_HANDOFF_MASTER](file:///c:/Mujoco%20Projects/vninvest/docs/MULTI_AGENT_AI_TRADING_INFRASTRUCTURE_HANDOFF_MASTER_20260501.md)
4. Core contracts & schema direction: [ENTERPRISE_CORE_PLATFORM_ARCHITECTURE_BLUEPRINT_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_PLATFORM_ARCHITECTURE_BLUEPRINT_20260502.md), [ENTERPRISE_CORE_STORAGE_SCHEMA_STRATEGY_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_STORAGE_SCHEMA_STRATEGY_20260502.md), [ENTERPRISE_CORE_SCHEMA_ANALYSIS_20260502](file:///c:/Mujoco%20Projects/vninvest/docs/ENTERPRISE_CORE_SCHEMA_ANALYSIS_20260502.md)

---

## 1A. Quy tắc áp dụng theo code hiện tại

Để kế hoạch này khả thi với repo hiện có, cần áp dụng các nguyên tắc sau:

1. **Redis-first trước RabbitMQ:** tận dụng Celery + Redis + Redis Streams + Channels hiện có trước khi thêm một queue substrate mới.
2. **PostgreSQL-first trước ClickHouse:** tối ưu facts/materialization/cache/read path trước; chỉ đưa ClickHouse vào khi raw tick analytics vẫn là bottleneck sau tối ưu.
3. **WebSocket nội bộ trước, SSE đối ngoại sau:** internal web realtime tiếp tục dùng Channels/WebSocket; SSE ưu tiên cho external orchestrator/VIP stream contract.
4. **Django edge trước Kong:** PAT, DRF throttling, Redis-backed quota và NGINX edge đi trước; Kong chỉ vào khi partner API traffic đủ lớn.

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
- Trọng tâm ưu tiên 1: Chuẩn hóa **core-ready monolith** trên hạ tầng đang chạy: Redis Streams, Channels, Celery, PostgreSQL facts-first paths, rate limiting và entitlement hiện có.
- Trọng tâm ưu tiên 2: Dựng PAT / tenant quota / MCP wrapper routes ngay trong Django backend trước khi đưa Kong Gateway.
- Trọng tâm ưu tiên 3: Chỉ đưa Kong và ClickHouse vào sau khi các trigger về external traffic hoặc OLAP pressure được đo thấy trên runtime thật.

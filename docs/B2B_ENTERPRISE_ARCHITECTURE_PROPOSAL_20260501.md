# ĐỀ XUẤT KIẾN TRÚC: VNINVEST B2B ENTERPRISE & WHITE-LABEL MODEL

Bản thiết kế này giải quyết bài toán mở rộng VNInvest thành một **Hệ sinh thái B2B2C (Business-to-Business-to-Consumer)**. Khách VIP không chỉ là người dùng cá nhân, mà có thể là các Quỹ đầu tư, Đội nhóm môi giới (Brokers) muốn sử dụng dữ liệu của VNInvest để phục vụ cho *khách hàng riêng của họ*.

---

## 1. Cơ sở dữ liệu (Database Segregation)

Để đảm bảo bảo mật và tối ưu chi phí, dữ liệu sẽ được phân tách hoàn toàn (Decoupled) giữa Server Chủ và Server của VIP.

### 1.1. Server Chủ (Central VNInvest DB)
Sử dụng Cluster PostgreSQL + ClickHouse cấu hình cao. Lưu trữ:
- **Global Market Data:** Toàn bộ lịch sử giá, Intraday Ticks, Hồ sơ doanh nghiệp.
- **Proprietary Intelligence:** Dữ liệu Whale Flow, CVD, Dark Money.
- **Tenant Management:** Thông tin các khách hàng VIP (Tên Quỹ/Broker, API Token, Giới hạn Quota, Billing).
- **Lưu ý:** Server chủ **KHÔNG** lưu thông tin các User con của khách VIP. Server chủ chỉ biết "Khách hàng VIP A đang gọi API".

### 1.2. Máy chủ VIP (VIP Client Local DB)
Sử dụng PostgreSQL gọn nhẹ đi kèm trong gói cài đặt (Docker Compose). Lưu trữ:
- **Local User Management:** Tài khoản của các khách hàng/nhân viên thuộc tổ chức VIP đó.
- **Private Portfolios & Logs:** Danh mục đầu tư cá nhân, lịch sử lệnh giao dịch của User con.
- **AI Configurations:** API Keys của OpenAI/Anthropic, cấu hình Multi-Agent, System Prompts bảo mật của quỹ.
- **Lưu ý:** VIP DB **KHÔNG** lưu trữ dữ liệu thị trường (Market Data). Mỗi khi User con xem biểu đồ, VIP Server sẽ dùng API Token gọi thẳng lên Server Chủ để lấy data nóng, hoặc lưu Cache cục bộ (Redis) trong 5-10 phút.

---

## 2. Hệ thống Dịch vụ API (API Services)

Server Chủ sẽ cung cấp 3 cụm API chính cho VIP Client:

1. **Market Data Stream (WebSockets / gRPC):**
   - Đẩy dữ liệu realtime KLine, Tick cho VIP Server để hiển thị lên màn hình của các User con.
2. **MCP Intelligence Tools (REST / JSON-RPC):**
   - Các hàm gọi chuyên sâu cho AI: `get_whale_alerts`, `get_heatmap`, `global_screener`.
   - VIP Server gọi các hàm này khi AI Agent của họ cần dữ liệu để tranh luận.
3. **License & Billing API:**
   - Cập nhật số lượng Request còn lại (Rate Limits). Báo hiệu cho VIP Server nếu họ sắp hết hạn mức (Quota).

---

## 3. Giao diện Quản trị (Admin Dashboards)

Hệ thống sẽ có 2 cấp độ Giao diện quản trị hoàn toàn khác nhau.

### 3.1. Super Admin Dashboard (Dành cho Chủ hệ thống VNInvest)
Nằm trên Web chính (SaaS) của VNInvest:
- **Data Ops Control:** Monitor tiến trình ingest dữ liệu từ các sàn, quản lý sức khỏe của ClickHouse DB.
- **Tenant Manager:** Màn hình tạo mới Khách VIP (Tạo Tenant). Cấp phát `API Access Token`.
- **Billing & Analytics:** Biểu đồ hiển thị: *Quỹ A hôm nay gọi 500,000 API requests, Quỹ B gọi 10,000 requests*. Nút gạt để `Tạm khóa (Suspend)` Token của Quỹ A nếu họ chưa đóng tiền.

### 3.2. VIP Admin Dashboard (Dành cho Chủ Quỹ / Broker mua bản quyền)
Nằm trên hệ thống Self-Hosted của VIP (Truy cập bằng IP nội bộ hoặc domain riêng của họ):
- **Core Connection Settings:** Form để dán `VNInvest API Token`. Trạng thái hiển thị: *[Connected to VNInvest Central Server]*.
- **AI Engine Settings:** Form nhập `OpenAI API Key`, `Anthropic Key`. Nơi chỉnh sửa System Prompts (Ví dụ Quỹ A muốn AI của họ luôn tư vấn thiên về "Đầu tư giá trị dài hạn", họ sẽ sửa prompt ở đây).
- **Sub-User Management (White-label):** Giao diện thêm/sửa/xóa các User con (Khách hàng của quỹ). Cấp quyền cho User con nào được dùng AI, User nào chỉ được xem biểu đồ.

---

## 4. Trải nghiệm người dùng của VIP Client (B2B2C Flow)

**Trả lời câu hỏi: VIP Client có thể có người dùng của riêng họ không?**
-> **CHẮC CHẮN CÓ.** Đây chính là mô hình **White-label Software**.

1. Tổ chức Môi giới (Broker) "Alpha Invest" mua gói VIP của VNInvest.
2. Alpha Invest được cấp 1 `VNInvest Token` có hạn mức 1,000,000 requests/ngày.
3. Alpha Invest mang bộ source code (Docker) cài lên Server của họ, gán tên miền là `trading.alphainvest.com`.
4. Alpha Invest tạo tài khoản cho 500 khách hàng (User con) của họ.
5. Khi khách hàng "Nguyen Van A" truy cập `trading.alphainvest.com` và hỏi AI: *"Tư vấn cho tôi mã HPG"*.
6. Server của Alpha Invest (VIP Server) sẽ nhận lệnh -> Gọi OpenAI API (Bằng thẻ tín dụng của Alpha Invest) -> Gọi MCP API tới VNInvest Server Chủ (Trừ vào hạn mức 1 triệu requests) để lấy dữ liệu Whale Flow -> Trả kết quả cho Nguyen Van A.

---

## User Review Required

> [!IMPORTANT]
> Mô hình kiến trúc này chuyển đổi VNInvest thành một cỗ máy in tiền theo mô hình **B2B Data API + White-label Platform**. 
> 
> Bạn đánh giá thế nào về thiết kế Data Segregation (Tách bạch dữ liệu) và B2B2C Flow này? Nếu bạn đồng ý với tầm nhìn này, chúng ta sẽ cần phải cập nhật lại tài liệu `TECH_SPEC` của Backend để bổ sung thêm khái niệm `Tenant` (Khách hàng B2B) vào hệ thống User Management hiện tại của Django. Bạn có muốn tiến hành việc update thiết kế kỹ thuật này không?

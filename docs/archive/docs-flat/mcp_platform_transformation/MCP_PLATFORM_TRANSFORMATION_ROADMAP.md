# CHIẾN LƯỢC CHUYỂN ĐỔI: VNINVEST MCP API PLATFORM

**Date:** 2026-05-01
**Context:** Kế hoạch nâng cấp toàn bộ dự án VNInvest thành một Hệ sinh thái MCP Server trung tâm (Centralized Data & AI Infrastructure).

---

## 1. Tầm nhìn Kiến trúc (Platform Vision)

Đề xuất của bạn hoàn toàn khả thi và thực tế đây là **xu hướng kiến trúc tối ưu nhất (State-of-the-art)** cho các nền tảng dữ liệu tài chính hiện đại. Thay vì VNInvest chỉ đóng vai trò là một "Ứng dụng Web" (Web App) kết nối với Backend, VNInvest sẽ tiến hóa thành một **"Data API Hub & MCP Server"**.

Lợi ích khổng lồ của mô hình này:
1. **Phân tán chi phí AI (Decentralized Compute):** Việc chạy Multi-Agent Debate (Orchestrator) hay gọi GPT-4o/Claude sẽ diễn ra tại máy của người dùng (Client) hoặc server riêng của họ. VNInvest KHÔNG tốn chi phí API LLM, giải quyết triệt để bài toán BYOM/BYOK.
2. **Kinh doanh Dữ liệu độc quyền:** VNInvest có thể thu phí dạng Subscription / API Tiering (Basic, Pro, Premium) để cấp quyền truy cập các luồng data quý giá như Dark Money Flow hay Whale Alerts.
3. **Mở rộng Hệ sinh thái (Ecosystem):** Bất kỳ nhà phát triển nào cũng có thể tự build Frontend mới, Trading Bot riêng, hoặc tích hợp trực tiếp vào Cursor/Claude Desktop dựa trên data của VNInvest.

---

## 2. Kiến trúc Hệ thống MCP (Client - Server)

### 2.1. Phía VNInvest (Central MCP Server)
Backend Django hiện tại sẽ được bọc thêm một lớp **MCP Server Protocol**. Nhiệm vụ chính là Authentication, Rate Limiting và định tuyến data (Routing).

Hệ thống sẽ expose dữ liệu hiện tại (SSOT) qua 2 khái niệm chuẩn của MCP:

**A. MCP Resources (Dữ liệu đọc - Read-only Context):**
Cho phép AI Agent của người dùng chủ động đọc bối cảnh.
- `vninvest://user/profile`: Thông tin tài khoản, rủi ro chịu đựng.
- `vninvest://market/index`: Trạng thái VN-Index realtime.
- `vninvest://stock/{symbol}/price`: Giá hiện tại và lịch sử.
- `vninvest://stock/{symbol}/profile`: Hồ sơ doanh nghiệp (PE, PB, FA).
- `vninvest://stock/{symbol}/indicators`: KLine, MA, RSI.

**B. MCP Tools (Hàm thực thi - Function Calling):**
Cho phép AI Agent của người dùng gọi để thực hiện các phân tích phức tạp.
- `get_whale_alerts(symbol)`: Trả về trạng thái gom hàng của Cá mập.
- `get_dark_money_flow()`: Trả về heatmap dòng tiền ngầm.
- `screen_stocks(conditions)`: Gọi Global Screener của VNInvest.
- `run_backtest(rules)`: Chạy engine backtest trên server VNInvest.

### 2.2. Phía Người dùng (Client Systems)
Người dùng sẽ chạy các hệ thống Client (ví dụ: Hệ thống AI Trading Infrastructure mà chúng ta vừa thiết kế, hoặc Claude Desktop, AI Bot Telegram).
- **Cấu hình Client:** Cài đặt API Key của OpenAI/Anthropic + **VNInvest API Token**.
- **Luồng hoạt động:** 
  1. Client nhận lệnh: *"Phân tích mã VHM"*.
  2. Client tự dùng LLM của mình suy luận xem cần công cụ gì.
  3. Client gọi qua MCP Protocol tới VNInvest MCP Server xin data (VD: `get_whale_alerts("VHM")`).
  4. VNInvest kiểm tra Auth Token, xác thực user có gói Premium, trả về JSON data.
  5. Client LLM tổng hợp và đưa ra quyết định giao dịch cho người dùng.

---

## 3. Các bước để Nâng cấp từ Kiến trúc hiện tại

Để tiến lên mô hình này, đội ngũ Dev cần triển khai các bước (Milestones) sau:

### Bước 1: Authentication & API Gateway (Luật vào cửa)
- Sinh ra hệ thống quản lý **Developer API Keys** hoặc **Personal Access Tokens (PAT)** trong User Profile.
- Áp dụng các rules giới hạn: User Free (chỉ lấy giá delay 15 phút, không có whale alerts), User Premium (Realtime tick, Dark Money Flow).

### Bước 2: Xây dựng MCP Server Layer
- Không cần đập bỏ Django, có thể sử dụng thư viện `mcp-python-sdk` để tích hợp chuẩn MCP trực tiếp vào backend Django, hoặc dựng một Node.js/Go Gateway nhẹ đứng trước Django.
- Map các hàm `SSOT` hiện tại (trong `runtime_policy_helpers.py`, `global_signal_universe_policy`) thành các JSON Schemas để expose ra ngoài.

### Bước 3: Đóng gói Client Orchestrator làm Open-source/SDK
- Khối kiến trúc Orchestrator (Thiết kế Multi-Agent Debate) mà chúng ta bàn nãy có thể được VNInvest tách ra thành một SDK (ví dụ: thư viện `vninvest-trading-bot` trên Github).
- Người dùng chỉ việc clone thư viện đó về máy, điền LLM API Key của họ và VNInvest Token của họ vào `.env` là có ngay một hệ thống AI Trading tự động của riêng mình.

---

## 4. Rủi ro Cần chú ý khi mở Public API
1. **Data Scraping (Cào dữ liệu):** Người dùng có thể viết script gọi liên tục để cào toàn bộ DB Whale Flow. Cần cơ chế **Rate Limiting (Giới hạn số request/phút)** cực kỳ chặt chẽ dựa trên Token.
2. **Database Overload:** Khác với Web App (chỉ gọi API khi người dùng click), API Tools mở cho các AI Bots có thể bị gọi với tần suất điên cuồng 24/7. Tầng Cache (Redis) phải được tối ưu, tuyệt đối không cho phép AI truy vấn thẳng vào DB vật lý với các câu query tốn kém. Dữ liệu phải được *Materialized* (tính sẵn).

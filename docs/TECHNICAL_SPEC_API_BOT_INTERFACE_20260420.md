# Đặc tả Kỹ thuật: API Contract & Telegram Bot Interface

**Ngày soạn:** 2026-04-20  
**Đối tượng:** Đội ngũ Backend / Frontend / Bot Developer  

---

## 1. REST API Endpoints (Sentiment & Alerts)

### 1.1 Lấy điểm Tâm lý (Sentiment Gauge)
*   **Endpoint:** `GET /api/v1/stock/{symbol}/sentiment/`
*   **Response (JSON):**
    ```json
    {
      "symbol": "VNM",
      "current_score": 0.75,
      "status": "Bullish",
      "summary": "Dòng tiền lớn vào mạnh kết hợp tin tức tích cực về xuất khẩu.",
      "history_7d": [
        {"date": "2026-04-19", "score": 0.60},
        {"date": "2026-04-20", "score": 0.75}
      ]
    }
    ```

### 1.2 Lấy kết quả Backtest Tín hiệu
*   **Endpoint:** `GET /api/v1/whale/backtest-stats/`
*   **Params:** `symbol` (optional), `signal_type` (Whale/Dark)
*   **Gating:** Nếu User Free, chỉ trả về stats tổng quát (Overall Win-rate), ẩn chi tiết từng mã.

---

## 2. Telegram Bot Interface (I1)

### 2.1 Luồng link tài khoản (Authentication)
1.  User nhấn "Link Telegram" trên Web UI.
2.  Hệ thống sinh ra một `deep_link` dạng: `https://t.me/VNInvestBot?start=BASE64_TOKEN`.
3.  Khi User nhấn Start, Bot gửi Payload `BASE64_TOKEN` về Backend để xác thực và map `chat_id` vào `TelegramProfile`.

### 2.2 Định dạng Alert "Lệnh khủng" (Priority: Critical)
Tin nhắn Telegram phải dùng định dạng MarkdownV2 hoặc HTML:
```text
🚨 **GIGANTIC ORDER DETECTED** 🚨
--------------------------------
Symbol: **VNM** (VN30)
Value: **125.5 Billion VND**
Side: **BUY (Active)**
Indicator: **Dark Flow Strength: 85%**
--------------------------------
[Xem AI Advisory] [Mute 1h]
```
*(Ghi chú: Đối với User Free, Symbol sẽ hiện là **V***)*

### 2.3 Interactive Commands
*   `/portfolio`: Trả về Inline Keyboard liệt kê các danh mục. Khi nhấn nút, sẽ `editMessageText` hiển thị P/L của danh mục đó.
*   `/stock <symbol>`: Trả về tóm tắt AI Advisor cho mã đó (Sử dụng `ai_summary` từ `WhaleAdvisory`).

---

## 3. Quản lý Rate Limit & Gating

*   **API Throttling:** 
    *   Free: 20 req/minute.
    *   Pro: 100 req/minute.
*   **Gating:** 
    *   Backend phải sử dụng `FeatureGate` service để kiểm tra quyền truy cập trước khi trả dữ liệu.
    *   Mã cổ phiếu phải được băm (`mask_symbol`) ở tầng Serializer nếu user không có quyền Pro.

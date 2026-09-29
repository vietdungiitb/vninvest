# Audit & Ưu tiên Wishlist Tính năng VNInvest (2026-04-20)

## 1. Tổng quan
Tài liệu này thực hiện đánh giá các ý tưởng trong `WISHLIST_FUTURE_FEATURES.md` dựa trên thực tế phát triển hiện tại của dự án VNInvest vào tháng 04/2026, cụ thể là chiến dịch chuyển đổi sang mô hình **Open Core**.

## 2. Phân tích bối cảnh "Thực tế dự án"
*   **Trọng tâm chiến lược:** Chuyển đổi mã nguồn monorepo thành cấu trúc Community vs Pro (Open Core Hardening Sprint).
*   **Điểm mạnh hiện tại:** Pipeline dữ liệu realtime đã ổn định, hệ thống phát hiện Whale/Dark Money đã có độ phủ tốt, AI Advisory đã hỗ trợ context linh hoạt và đa tab.
*   **Thách thức:** Cần củng cố niềm tin vào tín hiệu (Professionalization) và xây dựng bộ khung thương mại hóa (Paywall/Licensing).

## 3. Đề xuất Lộ trình ưu tiên (Roadmap Prioritization)

### Nhóm P0: Sẵn sàng cho Open Core (1–4 tuần)
*Mục tiêu: Hoàn tất hạ tầng Open Core và tạo ra giá trị cốt lõi cho gói Pro để sẵn sàng launch.*

| Mã | Tính năng | Lý do ưu tiên | Ghi chú |
|---|---|---|---|
| **W6** | **Xác nhận sau tín hiệu** | **ƯU TIÊN (USER CONFIRMED)** - Tạo niềm tin cho gói Pro. User cần bằng chứng về hiệu quả tín hiệu whale/dark money. | Cơ chế backtesting nhẹ trên lịch sử tín hiệu. |
| **O6** | **Audit log tập trung** | Cần thiết cho vận hành chuyên nghiệp và đáp ứng tiêu chuẩn "Enterprise" trong lộ trình Open Core. | Log thay đổi settings, quyền hạn, giao dịch nhạy cảm. |
| **M3** | **Trial Pro tự động** | Kích thích chuyển đổi ngay khi user đăng ký bản Community. | 14 ngày dùng thử Pro mặc định. |
| **Fix** | **Bản tin danh mục** | **ƯU TIÊN (USER CONFIRMED)** - Ổn định hóa tính năng AI tiếp cận user hàng ngày nhất (News Digest). | Đã có backlog lỗi cần xử lý ngay. |

### Nhóm P1: Nâng tầm Chuyên nghiệp (1–2 tháng)
*Mục tiêu: Tăng chiều sâu phân tích và cải thiện trải nghiệm người dùng cao cấp.*

| Mã | Tính năng | Lý do ưu tiên | Ghi chú |
|---|---|---|---|
| **AI4** | **Sentiment analysis tin tức** | **ƯU TIÊN (USER CONFIRMED)** - Supercharge cho AI Advisory và News Digest bằng cách hiểu được "cảm xúc" thị trường. | Làm song song với Runtime Prompt Config. |
| **W4** | **Dark money trend** | Nâng cấp từ "Cảnh báo đơn lẻ" lên "Phân tích xu hướng dòng tiền" theo ngành. | Dashboard xu hướng vĩ mô của dòng tiền lớn. |
| **I1** | **Telegram / Zalo bot** | **ƯU TIÊN (USER CONFIRMED)** - Ưu tiên hơn Dark Mode để giữ chân người dùng và tạo thông báo realtime. | Đẩy alert cá mập và Advisory digest qua Bot. |
| **U1** | **Dark mode toàn cục** | Thay đổi diện mạo app theo chuẩn Bloomberg/Professional. | Tạm thời hạ ưu tiên sau Bot Telegram. |

### Nhóm P2: Tiện ích & Cộng đồng (Quý tiếp theo)
*Mục tiêu: Giữ chân người dùng và tạo hiệu ứng viral.*

| Mã | Tính năng | Lý do ưu tiên |
|---|---|---|
| **A1** | **Screener cổ phiếu** | Công cụ lọc mã CK chuyên sâu (đã có model `ScreenerRule` chờ triển khai). |
| **P7** | **Stoploss/Take-profit** | Tiện ích quản trị rủi ro cơ bản cho danh mục cá nhân. |
| **S1** | **Chia sẻ watchlist** | Tạo tính lan tỏa cho cộng đồng nhà đầu tư. |
| **M1** | **Subscription checkout** | Tự động hóa hoàn toàn luồng thanh toán Pro/Enterprise. |

---

## 4. Các tính năng "Cạm bẫy" (Cần cân nhắc kỹ)
*   **A4 (Backtesting XL):** Quá phức tạp để làm hoàn chỉnh. Nên tập trung vào **W6** (backtest tín hiệu whale) thay vì backtest chiến lược tổng quát của user.
*   **I3 (Order Gateway XL):** Rủi ro pháp lý và kỹ thuật lớn khi gửi lệnh thật qua các app chứng khoán (SSI, TCBS...). Nên giữ vai trò là nền tảng **Cố vấn (Advisory)**.

---

## 5. Vòng thảo luận chuyên sâu (Discussion Loops)

Để làm rõ phương án thực hiện cho các mục đã chọn, chúng ta cần thống nhất các điểm sau:

### Vòng 1: Xác nhận niềm tin (W6 - Whale Backtesting)
1. **Định nghĩa "Thành công"**: Một tín hiệu Whale được coi là đúng nếu giá tăng bao nhiêu % trong bao lâu? (VD: +2% trong 3 phiên, hay đơn giản là giá đóng cửa T+3 cao hơn điểm vào?)
2. **Hình thức hiển thị**: Chúng ta nên hiện "Tỉ lệ thắng (Win rate)" ngay cạnh mỗi mã trong Whale Feed, hay tạo một trang "Hall of Fame" vinh danh các mã có dòng tiền chuẩn xác nhất?
3. **Phạm vi dữ liệu**: Backtest chỉ dựa trên `matched_value` (vượt ngưỡng) hay cần tính cả `Dark Flow Strength`?

### Vòng 2: Kênh tương tác (I1 - Telegram Bot)
1. **Cấp độ thông báo**: Bot nên đẩy *tất cả* Whale Alerts hay chỉ những alert có severity "Critical" (ví dụ > 5 tỷ VNĐ)?
2. **Tính năng tương tác**: Anh có muốn user có thể chat với bot để tra cứu nhanh không? Ví dụ: `/p` để xem NAV nhanh, `/s VNM` để lấy AI Advisory tóm tắt?
3. **Phễu chuyển đổi**: Tin nhắn từ Bot có nên chứa link dẫn thẳng về app (Deep link) để tăng traffic cho bản Mobile/Web không?

### Vòng 3: Trí tuệ hóa (AI4 - Sentiment Analysis)
1. **Nguồn tin**: Chúng ta sẽ dùng Sentiment phân tích từ tin tức tổng hợp (OpenNews) hay cần nhúng thêm các nguồn chuyên biệt như báo cáo phân tích từ các CTCK (FiinPro/Vietstock)?
2. **Cách trình bày**: Chỉ số Sentiment (-1 đến 1) nên được hiện thành một đường Overlay trên chart hay thành một badge cảnh báo (Bullish/Bearish) trong phần AI Advisory?
3. **Tần suất**: Sentiment nên cập nhật realtime theo từng tin tức hay tổng hợp theo ngày (Daily Sentiment)?

### Vòng 4: Quản lý và Bản quyền (Open Core Context)
1. **Gating logic**: Các tính năng cao cấp này (Whale Backtest, Full Telegram Bot) sẽ được khóa cứng theo `feature_key` trong code hay dựa vào `quota_limit`?
2. **Bản Community**: Bản miễn phí sẽ nhận được gì từ Bot Telegram? (Ví dụ: Chỉ nhận tin thị trường chung, không nhận alert mã cụ thể?)

> **Tài liệu tham khảo:**
> - `docs/WISHLIST_FUTURE_FEATURES.md`
> - `docs/OPEN_CORE_22_HARDENING_SPRINT_21DAY_PLAN_20260418.md`
> - `docs/ROADMAP_STATUS.md`

# Đặc tả Kỹ thuật: Whale Backtesting, Telegram Bot & AI Sentiment (Final Draft)

**Ngày tạo:** 2026-04-20  
**Trạng thái:** FINAL DRAFT - Sẵn sàng cho thảo luận phiên tiếp theo  
**Phạm vi:** W6 (Backtesting), I1 (Telegram Bot), AI4 (Sentiment Analysis), Open Core Gating  

---

## 1. Whale Backtesting (W6) — "Niềm tin số liệu"

**Mục tiêu:** Chứng minh hiệu quả của các tín hiệu Whale Alert cho khách hàng Pro.

*   **Định nghĩa thành công (Success Metric):** Giá biến động **> +2% trong vòng T+3** (3 phiên giao dịch).
*   **Chỉ số hiệu quả:** Sử dụng **Standard Alpha = (stock_return - VNIndex_return)** để đo lường hiệu suất vượt trội so với thị trường.
*   **Xử lý ngoại lệ:**
    *   **IPO:** Loại khỏi backtesting cho đến khi mã có đủ 30 phiên giao dịch để tránh nhiễu số liệu.
    *   **Cổ tức:** Sử dụng `adjusted_close_price` (giá điều chỉnh) để tính toán, loại bỏ các biến động ảo do chia quyền.
    *   **Dữ liệu lỗi:** Triển khai `validate_adjusted_price()` so sánh chéo giữa vnbroker và nguồn backup (CafeF). Nếu lệch > 1%, gắn nhãn "Data Warning" thay vì tính toán kết quả.
*   **Thời điểm tính toán:** Task chạy định kỳ lúc **16:00 hàng ngày** (sau khi chốt giá đóng cửa) để lock dữ liệu.

---

## 2. Telegram Bot Multi-level (I1) — "Kênh tương tác Realtime"

**Mục tiêu:** Giữ chân người dùng qua thông báo tức thời và tương tác nhanh.

*   **Phân cấp thông báo (Tiered Alerts):**
    *   `Normal`: Alert chuẩn (theo threshold user cài).
    *   `Critical`: Lệnh khủng (> 50-100 tỷ) hoặc biến động Dark Money cực đại. Tín hiệu này sẽ **Bypass Mute** để đảm bảo user không bỏ lỡ sự kiện quan trọng.
*   **Giao diện & Tương tác:**
    *   Sử dụng **Inline Keyboard + `editMessageText`** để menu gọn gàng, tránh spam tin nhắn mới.
    *   Lệnh `/portfolio`: Trả về [Tổng hợp NAV] + [Menu chi tiết chọn danh mục]. 
    *   Lệnh `/stock <symbol>`: Trả về dữ liệu Realtime nhưng tuân thủ **Gating logic** (ẩn mã nếu là user Free).
*   **Bảo mật:**
    *   Xác thực qua mã OTP hoặc Deep link từ Web App.
    *   **Rate limit:** Áp dụng per user + per command (Ví dụ: tối đa 5 lần tra cứu AI/phút).
    *   **Chống Brute-force:** Captcha challenge/Khóa account 24h nếu user Free cố tình dò mã ẩn quá nhiều lần.

---

## 3. AI Sentiment Analysis (AI4) — "Thấu hiểu thị trường"

**Mục tiêu:** Nhúng yếu tố tâm lý tin tức vào quyết định đầu tư.

*   **Trực quan hóa (Visual):** 
    *   **Sentiment Gauge:** "Đồng hồ tâm lý" trong section AI Advisory.
    *   **Sentiment Overlay:** Đường chỉ báo tâm lý chạy dưới chart K-line để đối chiếu tin tức - giá.
*   **Logic tính toán:**
    *   **News Weights:** Quản lý trọng số nguồn tin qua DB (`news_source_weights`). Ví dụ: Tin từ CafeF/Vietstock có trọng số cao hơn.
    *   **Fallback:** Nếu thiếu tin tức, dùng `SectorAverageSentiment` (Trung bình ngành). Nếu vẫn không có, trả về **Neutral** kèm tooltip "Dữ liệu hạn chế".
    *   **AI Integration:** Nhúng điểm số tâm lý trực tiếp vào prompt AI Advisory để tạo ra nhận định có chiều sâu.

---

## 4. Chiến lược Open Core Gating — "Đòn bẩy chuyển đổi"

*   **Cơ chế ẩn mã (Masking):** Thực hiện **BẮT BUỘC tại Backend**.
    *   Quy tắc: `VNM` -> `V**`, `HP` -> `H*`, `VN30F1M` -> `VN**F1M`.
*   **Phân tầng tiêu chí:**
    *   `Free`: Chỉ dùng 1 tiêu chí cơ bản (Giá trị lệnh).
    *   `Pro`: Dùng trọn bộ 5 tiêu chí (Value, Dark Flow Strength, CVD Divergence, Tick Rate, Iceberg).
*   **Quà tặng Retention (Hook):** 
    *   Cho phép user Free xem **Full Alert cho tối đa 3 mã** tự chọn trong Watchlist. 
    *   Khi vượt quá 3 mã hoặc xem mã ngoài danh sách này, hệ thống áp dụng cơ chế Masking và đề xuất nút "Nâng cấp Pro".

---

## 5. Danh mục Rủi ro & Giải pháp (Audit)

| Rủi ro | Giải pháp |
|---|---|
| Dữ liệu IPO làm sai lệch Win-rate | Loại bỏ mã IPO < 30 ngày khỏi Backtesting |
| Brute-force dò mã ẩn trên Bot | Log tần suất tra cứu mã lạ + Captcha challenge |
| Spam lệnh nhạy cảm làm nghẽn Worker | Rate-limit chặt chẽ cấp độ User và Command |
| Tin tức mâu thuẫn gây nhiễu AI | Lọc tin rác (noise filter) và ghi chú "Dữ liệu mâu thuẫn" |

---

> [!IMPORTANT]
> **Hướng tiếp theo:** Bản đặc tả này sẽ được dùng làm căn cứ chính thức để thiết kế DB và Logic API cho các Sprint tới.

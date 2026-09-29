# 🕵️ Báo cáo Audit Kỹ thuật: Hệ thống Dark Money Flow & Whale Alerts

Báo cáo này trình bày kết quả phân tích chi tiết luồng dữ liệu, thuật toán và cấu trúc kiến trúc của tính năng **Dark Money Flow** và **Whale Alerts** trong nền tảng VNInvest, dựa trên mã nguồn BE (`order_flow.py`, `views_dark_money_history.py`) và FE (`WhaleAlertsDashboard.jsx`). Không có thay đổi code nào được thực hiện.

---

## 1. Kiến trúc chung & Dòng chảy Dữ liệu (Data Flow)

Hệ thống được thiết kế theo mô hình xử lý giao dịch tần suất cao (High-Frequency Trading - HFT) dành cho dữ liệu tick, gồm 2 thành phần chính:

*   **Realtime Detection (Engine S15):** Phân tích luồng lệnh (Order Flow) liên tục từ `IntradayTick` để phát hiện bất thường như Iceberg, Hấp thụ (Absorption), TWAP bot.
*   **Historical Aggregation (W2+W4 Module):** Kết hợp nến OHLC, tín hiệu Order Flow trong quá khứ, và lệnh Whale (Cá mập) để vẽ biểu đồ và phân tích chiến lược dòng tiền (Smart Money Flow Index - SMFI).
*   **Frontend Dashboard:** Layout 3-cột kiểu Bloomberg Terminal hiển thị dữ liệu live thông qua WebSockets (Realtime Feed) và các Widget trực quan (Radar, Chart, Donut).

---

## 2. Đi sâu vào Backend (Thuật toán lõi)

### A. Engine Phân tích Dòng tiền Ẩn (`backend/portfolio/order_flow.py`)
File quy tụ toàn bộ logic toán học để bóc tách hành vi của "Smart Money" (Dòng tiền lớn) đằng sau sổ lệnh.

1.  **CVD (Cumulative Volume Delta):**
    *   Chia thời gian thành các bucket nhỏ (mặc định 60s hoặc 30s).
    *   Tính `CVD = Tồn dư Mua chủ động (Buy_Value) - Bán chủ động (Sell_Value)`. Lệnh trạng thái UNKNOWN được chia `50/50`.
    *   Kết quả cho thấy lực cầu ròng tích lũy.

2.  **Absorption Detection (Theo dõi Sự Hấp thụ):**
    *   *Điều kiện kích hoạt:* Khoảng giá khóa chặt (`price_range_pct` < `0.3%`) **VÀ** CVD thay đổi mạnh (> `20%` so với mức trung bình tuyệt đối).
    *   *Ý nghĩa:* Giá không đổi dù lực mua/bán tăng vọt, cho thấy có Whale chặn lệnh Iceberg ở phía đối diện để gom/thoát hàng. Điểm số `strength` được nhân tuyến tính từ `0` đến `100`.

3.  **Iceberg Clustering: Gom hàng rải nhỏ**
    *   Nhóm các lệnh nhỏ (<50 triệu VNĐ) ở cùng một mức giá (độ sai số `< 0.05%`).
    *   *Điều kiện kích hoạt:* Nếu sự kiện "khớp lệnh nhỏ ở cùng mức giá" lặp lại trên 5 lần (`min_repeat=5`). Độ tin cậy (High/Medium/Low) dựa trên số lần lặp.

4.  **TWAP Bot Detection:**
    *   Phát hiện bot giao dịch rải khối lượng đều theo thời gian (Time-Weighted Average Price).
    *   *Điều kiện:* Tốc độ tick > 3 lần trung bình (baseline) + Số lượng lệnh nhỏ > 60% + Biến động CVD giữa các bucket phải cực thấp (CV < 50%).

### B. Module Lịch sử & Phân tích (`backend/portfolio/views_dark_money_history.py`)
API HTTP để truy xuất dữ liệu tổng hợp cho hệ thống biểu đồ.

1.  **Chỉ số Smart Money Flow Index (SMFI):**
    *   `SMFI = (Whale_Buy - Whale_Sell) / (Vol_Trung_Bình_20_Phiên) * 100`
    *   Đo lường sức mạnh thực sự của Whale so với tính thanh khoản tự nhiên.

2.  **Strategy Matrix (Ma trận chiến lược):**
    *   **All-in:** Dark Flow Strength > 60 và Whale Signal là BUY.
    *   **Accumulate (Gom thầm):** Dark Flow Strength thấp/phẳng nhưng Whale Signal là BUY.
    *   **Distribute (Thoát hàng):** Phân kỳ (Giá trị Dark Flow giảm sút hơn mức trung bình 70%) và Whale Signal là SELL.
    *   **Standby (Quan sát):** Dòng tiền yếu (<50% trung bình khóa).

---

## 3. Đi sâu vào Frontend (`WhaleAlertsDashboard.jsx`)

*   **Custom Hooks `useRealtimeFeed`:** Liên tục lắng nghe sự kiện WebSocket (`whale_alert`, `dark_flow_alert`) cho từng mã được theo dõi (symbol).
*   **Tổ chức Layout:** Sử dụng CSS Grid `2fr:2fr:1fr`.
    *   **Cột Trái (2 phần lưới):** Trọng tâm là `DarkMoneyMasterChart` (Kết hợp nến OHLC, vùng Absorption, SMFI) và `OrderFlowRadarPanel` (Chấm điểm radar tĩnh các chỉ số).
    *   **Cột Phải (Cố định 340px):** Xếp chồng các khối số liệu thực hoặc phân tích phụ bao gồm:
        1. `WhaleFeedPanel`: Luồng log các lệnh lớn theo thời gian thực (Live alerts board giới hạn 8 alert mới nhất).
        2. `RVOLChartPanel`: Khối lượng tương đối.
        3. `MoneyFlowDonut`: Tỷ lệ Buy/Sell.
        4. `DepthChartPanel`: Sổ lệnh nội bộ.

---

## 4. Phân tích Cấp độ Kiến trúc (Architecture Review) & Rủi ro

> [!TIP]
> **Điểm Cộng Lớn:**
> Logic tách biệt thành các hàm "pure function" bên trong `order_flow.py` không thực hiện truy vấn QuerySet thẳng mà nhận list tham số đã phân giải, rất dễ cho việc UT (Unit Test) và tối ưu. Data stream được cache qua Redis (interval 10s cho thông số `compute_tick_rate`).

> [!WARNING]
> **Vấn đề cần chú ý (Bottlenecks):**
>
> 1.  **Query N+1 & Memory Load (Order Flow):** Việc tải TẤT CẢ `IntradayTick` trong các bucket 5-60 phút vào memory (list của dict `_fetch_ticks`) có thể ngốn rất nhiều RAM (O(N) items) với các cổ phiếu thanh khoản hàng tỷ cổ.
> 2.  **Khóa đồng bộ (Global Lock issue):** Module thuật toán gọi `_today()` thay vì inject timeline (trừ một số tham số window).
> 3.  **Frontend Re-render:** Biến dependency `liveBoardAlerts` tính toán liên tục khi Websocket stream về. Feeds sẽ trigger `fetchFeed()` thông qua useEffect với dependency là thời gian timestamp mới nhất. Điều này dễ xảy ra "Bão REST API" (API Storm) khi Whale Alerts dồn dập về, vì một luồng WS alert lại vô tình đi kéo API `getWhaleFeed()` và `getStockWorkspaceOverview()`.

---

## Kết luận

Hệ thống cung cấp logic toán học rất tiên tiến cho Dark Money và Iceberg. Các chỉ báo tín hiệu phân kỳ hấp thụ (Absorption), tín hiệu cá mập (SMFI) đạt chuẩn như platform phân tích ngoại hối chuyên nghiệp.

Tuy nhiên, có nguy cơ liên quan đến **hiệu suất REST API Frontend khi có quá nhiều lượt khớp lệnh lớn** vì FE cập nhật toàn bộ Feed dữ liệu lịch sử bằng REST mỗi lần Websocket ping cảnh báo có Alert mới.

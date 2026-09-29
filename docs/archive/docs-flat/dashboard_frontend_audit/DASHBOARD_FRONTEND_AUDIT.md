# Báo cáo Phân Tích & Cải Tiến Giao Diện Dashboard (Frontend)
*Ngày tạo: 05-04-2026*

## 1. Phân tích chức năng hiện tại
Trang Dashboard (`/dashboard`) hiện tại đóng vai trò là trung tâm kiểm soát danh mục đầu tư, tích hợp luồng dữ liệu tĩnh (Snapshot) và dữ liệu chớp nhoáng (Realtime). Các thành phần cấu trúc bao gồm:
*   **Header & Overview Stat Cards**: Hiển thị tổng tài sản, lãi/lỗ chưa chốt, lãi/lỗ đã chốt và tổng cổ tức nhận được. Có nút **"Đồng bộ giá"** cho phép người dùng kích hoạt đồng bộ lấy giá snapshot mới nhất từ hệ thống.
*   **Radar Realtime Panel (`DashboardRealtimePanel.jsx`)**: 
    *   Sử dụng WebSocket (thiết kế với fallback sang Long-polling) để lắng nghe sự thay đổi của giá (quotes), cảnh báo cá mập (whale alerts) và luồng tiền ngầm (dark flow).
    *   Chứa bảng Observability hiển thị tình trạng hệ thống: Heartbeat, reconnects, latency, và trạng thái Redis/In-memory rất chi tiết.
    *   Tính toán "Giá trị gần realtime" và so sánh độ lệch (Delta) so với số liệu snapshot.
    *   Chia làm hai luồng nhỏ: Bảng cập nhật trạng thái giá của các mã đang giám sát và Log các Whale alerts/Dark Flow vừa xảy ra.
*   **Khu vực Charts**: Gồm `EquityVsBenchmarkChart` (hiệu suất danh mục so với VNIndex) và `AllocationPieChart` (cơ cấu tài sản).
*   **Holdings Table (`HoldingsTable.jsx`)**: Bảng thống kê chi tiết các vị thế (tồn kho) đang nắm giữ: số lượng, giá vốn, giá hiện tại và lãi/lỗ.

---

## 2. Nhận xét & Những điểm nghẽn (Pain points)
**Ưu điểm:**
*   Đã thiết lập được kiến trúc Realtime ổn định với các module giám sát sức khoẻ (System Health) rất rõ ràng.
*   Tích hợp thẳng Whale Alerts vào màn hình tổng quan, giúp nhà đầu tư nắm bắt rung lắc thị trường đối với những mã đang nắm giữ một cách trực quan.

**Điểm hạn chế:**
*   **Sự phân mảnh và bất đồng bộ Dữ liệu (Data Fragmentation):** Hệ thống đang chạy 2 luồng sự kiện khá tách biệt. Khu vực *Stat Cards trên đầu* và *HoldingsTable* chỉ lấy dữ liệu tĩnh (**Snapshot/API**) tại thời điểm truy cập hoặc khi bấm nút "Đồng bộ giá". Trong khi đó, module `DashboardRealtimePanel` ở giữa lại hiển thị **Realtime**. Việc 1 trang web hiện 2 con số "Tổng giá trị thị trường" khác nhau (1 cái snapshot, 1 cái realtime) rất dễ làm người dùng bối rối.
*   **Holdings Table "bị đóng băng":** Bảng chi tiết danh mục nắm giữ hoàn toàn tĩnh. Khi giá cổ phiếu thay đổi từng giây trên WebSocket, giá vốn và P/L dưới bảng Holdings không nhảy số theo, phung phí tính năng Realtime của ứng dụng.
*   **Giao diện mang tính kỹ thuật cao (Dev-oriented UI):** Phần Observability (hiển thị Heartbeat, Redis layer, Ticker counts, Latency) được đặt chễm chệ ở trung tâm màn hình. Đây là các thông số cực kỳ quan trọng cho người phát triển (Dev) hoặc SysAdmin, nhưng lại làm "nhiễu" không gian theo dõi của User cuối.
*   **UX của nút "Đồng bộ giá" (Manual Sync):** Nếu hệ thống đã duy trì kết nối WebSocket là `Live`, việc phải tự bấm "Đồng bộ giá" là dư thừa đi lùi về UI/UX trừ phi kết nối Websocket gặp sự cố. 

---

## 3. Đề xuất Cải tiến (Actionable Improvements)

Để nâng cấp toàn diện trải nghiệm theo chuẩn của một hệ thống giao dịch thời gian thực khép kín, đề xuất thực hiện các cải tiến sau:

1. **Kiến trúc lại Luồng Dữ liệu (Global Realtime Context)**
   * Đưa dữ liệu realtime (`useRealtimeFeed`) lên cấp cao hơn (Context hoặc parent `Dashboard.jsx`) để phân phối Data cho toàn bộ trang. 
   * **Kết quả:** Bảng `HoldingsTable` bên dưới sẽ nhận được `livePrice` trực tiếp, giúp các dòng lãi/lỗ (P/L) và tổng tiền "nhảy số" chớp tắt (flash green/red) tự động mỗi giây y như bảng điện tử chứng khoán, thay vì giữ số tĩnh.

2. **Gộp nhất Thông số Stat Cards**
    * Loại bỏ sự phân mảnh biến `snapshotMarketValue` và `liveMarketValue`. Cập nhật thẳng giá trị Realtime lên bộ 4 Stat Cards trên đầu trang. Thêm hiệu ứng transition hoặc glow số mỗi khi giá trị thị trường được tăng/giảm theo tick giá.

3. **Tối ưu hiển thị Observability & Giao diện Panel**
    * Chuyển toàn bộ các thông số dev/system health (`redis ok`, `latency`, `heartbeats`) vào một biểu tượng nhỏ gọn góc màn hình kiểu "System Status: 🟢 Chạy tốt (12ms)". Nhấp vào mới xổ ra (Tooltip/Popover) để giữ cho giao diện đầu tư gọn gàng, rộng rãi.

4. **Biến nút Sync thành "Auto-mode"**
    * Nút "Đồng bộ giá" khi phát hiện kết nối WebSocket là `Live` thì sẽ hiển thị dạng "🟢 Live Syncing..." (Không cho phép tĩnh/không cần thiết bấm). Nút chỉ sáng lên và chuyển thành nút bấm tay khi WebSocket ngắt kết nối (Rớt mạng, chuyển sang cơ chế Polling).

5. **Whale Alert Overlay vào Holdings Table**
    * Nếu một mã cổ phiếu vừa xuất hiện lệnh mua/bán "Cá mập" trong 5 phút gần nhất, hãy tạo hiệu ứng gán một Icon nhỏ (🦈/🐋) nhấp nháy hoặc bo viền dòng mã đó ngay trong bảng `HoldingsTable` để cảnh báo tức thời.
# Kế hoạch Khắc phục & Hoàn thiện Whale Alerts Symbol Kline (Remediation Plan)

Bản kế hoạch này tổng hợp các lỗi phát hiện trong đợt kiểm toán (Audit) và đề xuất giải pháp kỹ thuật cụ thể để đội code tiến hành sửa chữa, đảm bảo tính năng thực sự hữu dụng cho nhà đầu tư khi ra quyết định.

## Các Vấn đề & Giải pháp Đề xuất

### 1. Vấn đề Tooltip quá ngắn và thiếu nút Tắt/Bật (WAK-03)
**Hiện trạng:** Tooltip bị hard-code chỉ hiện OHLC + Volume, không có thông số dòng tiền. Không có nút bật/tắt tooltip.
**Giải pháp:**
- **Thêm nút Toggle UI:** Bổ sung một nút "Hiện/Ẩn Tooltip" trên thanh công cụ của `KLineChartPanel.jsx`. Nút này sẽ thay đổi thuộc tính `tooltip.showRule` của biểu đồ giữa `always`/`follow_cross` và `none`.
- **Mở rộng nội dung Tooltip:** Thay vì dùng tooltip mặc định, cấu hình hàm `tooltip.custom` hoặc `tooltip.values` trong `klineChartInit` để trích xuất và hiển thị thêm các giá trị từ `flowData` (như CVD, Strength) tương ứng với cây nến đang được trỏ chuột.

### 2. Vấn đề Nút bật/tắt các Pane Kỹ thuật không hoạt động (WAK-02)
**Hiện trạng:** Khi chưa có `flowData`, bấm nút bật CVD/Strength sẽ bị lỗi ngầm do klinecharts không tìm thấy chỉ báo mặc định tên là `CVD`.
**Giải pháp:**
- **Chặn lỗi logic:** Trong `handleToggleIndicator`, nếu `customIndicatorDefs[indicatorId]` chưa sẵn sàng (chưa có data), ta sẽ không gọi fallback `createIndicator(indicatorId)` đối với các chỉ báo dòng tiền. 
- **Quản lý trạng thái:** Làm mờ (disable) các nút bật/tắt CVD/Strength/Whale Flow cho đến khi `flowData` được load thành công, giúp người dùng không bị bối rối khi bấm mà không thấy phản hồi.

### 3. Vấn đề Thiếu Heatmap/Icon Cá Mập trên KLine (WAK-11)
**Hiện trạng:** Chưa có bất kỳ logic nào vẽ icon cá mập 🦈 lên các cây nến có khối lượng/dòng tiền đột biến.
**Giải pháp:**
- **Sử dụng Annotation API:** Dùng `chart.createAnnotation(annotations)` của thư viện `klinecharts`.
- **Thuật toán:** Đăng ký sự kiện lắng nghe khi người dùng cuộn/zoom biểu đồ (`onVisibleRangeChange`). Lấy danh sách nến đang hiển thị, lọc ra top 10% nến có `whale_buy` hoặc `whale_sell` cao nhất (tối thiểu 1 nến). Gắn icon cá mập vào mảng annotation cho các timestamp tương ứng và gọi hàm update lên KLineChart.

### 4. Vấn đề Thiếu Mô-đun AI Advisory (WAK-07)
**Hiện trạng:** Bubble chart cũ bị bê nguyên sang, chưa tích hợp AI Advisory theo ngữ cảnh của phiên giao dịch.
**Giải pháp:**
- Bổ sung import module AI Advisory (như `WhaleAdvisoryCommandPanel` hoặc component tương tự từ `StockDetail`) vào `WhaleAlertsDashboard.jsx`.
- Truyền `selectedTradeDate` (phiên được click trên Kline) vào module AI để nó chỉ tổng hợp và nhận định ngắn gọn theo diễn biến của đúng phiên giao dịch đó.

### 5. Vấn đề Thiếu Card Dark Money ở cột phải (WAK-09)
**Hiện trạng:** Cột phải mới có Whale Feed và Donut chart, thiếu thẻ Dark Money.
**Giải pháp:**
- Bổ sung `CompactDarkMoneyFlow` component vào vị trí dưới cùng ở cột phải của `WhaleAlertsDashboard.jsx`.

### 6. Vấn đề Click nến không cập nhật Bubble Chart
**Hiện trạng:** Khi click vào một nến trên KLine, hàm `normalizeTradeDate` trong `KLineChartPanel.jsx` bị lỗi parse ngày (`Invalid Date`) do không thể xử lý chuỗi số epoch milliseconds trả về từ klinecharts. Lỗi này làm sự kiện click bị hủy ngầm, khiến Bubble chart không được cập nhật.
**Giải pháp:**
- Sửa hàm `normalizeTradeDate` để xử lý an toàn dữ liệu dạng timestamp số: `new Date(Number.isFinite(Number(value)) ? Number(value) : value)`.

## Kế hoạch Triển khai (Proposed Changes)

### [MODIFY] frontend/src/components/KLineChartPanel.jsx
- Sửa lỗi parse timestamp của hàm `normalizeTradeDate` để xử lý đúng event click nến.
- Viết lại cấu hình tooltip trong `klineChartInit` để hỗ trợ custom HTML/Text lấy dữ liệu CVD và Strength.
- Thêm nút Toggle Tooltip lên Toolbar.
- Khắc phục lỗi fallback khi toggle các custom indicators.
- Lắng nghe event thay đổi viewport và tính toán gắn Annotation (Shark Icon) cho top 10% nến.

### [MODIFY] frontend/src/pages/WhaleAlertsDashboard.jsx
- Thêm AI Advisory Panel hiển thị phía dưới Bubble Chart, kết nối với `selectedTradeDate`.
- Import và thêm `CompactDarkMoneyFlow` vào danh sách các widget ở cột bên phải.

## Verification Plan

### Manual Verification
- Truy cập `whale-alerts/:symbol`.
- Bấm nút bật/tắt Tooltip trên KLine chart -> Tooltip ẩn hiện đúng.
- Trỏ chuột vào nến -> Tooltip hiển thị đầy đủ OHLC + Khối lượng + CVD + Sức mạnh dòng tiền.
- Bấm bật tắt CVD/Strength Pane -> Hiện/ẩn mượt mà, không bị văng lỗi.
- Zoom in/out trên biểu đồ -> Các icon cá mập tự động tính toán lại và di chuyển tới top 10% nến nổi bật nhất trên màn hình.
- Kiểm tra cột phải xem đã có card Dark Money chưa.
- Kiểm tra phần thông tin AI xem đã khớp với phiên giao dịch được chọn hay chưa.

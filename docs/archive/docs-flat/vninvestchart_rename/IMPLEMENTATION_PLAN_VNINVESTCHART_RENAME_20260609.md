# Kế hoạch thực hiện: Đổi tên vnstockcharts thành vninvestcharts & Nhúng Widget Standalone (VRE)

Tài liệu này mô tả chi tiết phương án kỹ thuật và các bước thực hiện để đổi tên gói biểu đồ từ `vnstockcharts` thành `vninvestcharts`, đồng thời cấu hình nhúng widget biểu đồ độc lập (standalone) đầy đủ tính năng chính chủ trên trang chi tiết cổ phiếu (`http://localhost/stocks/VRE`).

---

## 1. Bối cảnh & Mục tiêu

* **Đổi tên thương hiệu:** Đồng bộ hóa tên gọi từ `vnstockcharts` sang `vninvestcharts` trên toàn bộ hệ thống frontend để phù hợp với định hướng SaaS native mới.
* **Tích hợp SaaS Native:** Đảm bảo toàn bộ thay đổi nằm trong các thư mục hợp lệ theo quy định của `AGENTS.md` (`packages/web` cho Web Frontend).
* **Nhúng độc lập chuẩn xác:** Sử dụng các tính năng sẵn có của widget mới (thanh công cụ vẽ, header tìm kiếm mã, footer chọn khung thời gian và settings modal) thay vì tự viết lại HTML wrapper trong `VNStockChartPanel.js`.
* **Ràng buộc nghiệp vụ:** Giữ lại các canvas overlays tùy biến phục vụ hiển thị cá mập (shark) viewport và heatmap dòng tiền theo phân đoạn thời gian (time bucket).

---

## 2. Chi tiết các thay đổi đề xuất

### A. Đổi tên thư mục & file trong Web Frontend

1. **Xóa thư mục cũ:**
   * Xóa hoàn toàn thư mục `packages/web/src/components/vnstockcharts`.
2. **Sao chép mã nguồn mới:**
   * Sao chép đè/mới thư mục từ nguồn `C:\Mujoco Projects\vninvestcharts\src` sang `packages/web/src/components/vninvestcharts/`.
3. **Cập nhật ký tự/biến xuất hiện trong code:**
   * Thay thế component: `VNStockCharts` $\rightarrow$ `VNInvestCharts`
   * Thay thế các context, provider, hooks và helpers liên quan.

---

### B. Tích hợp Page & Component

1. **`StockDetailPage.js`**
   * Cập nhật phần gọi `<VNStockChartPanel>` để truyền prop `symbol` nhằm giúp panel nhận diện cổ phiếu đang được chọn.

2. **`VNStockChartPanel.js`**
   * Thay đổi import từ `./vnstockcharts/index.js` thành `./vninvestcharts/index.js` để import `VNInvestCharts` và các file tài nguyên liên quan.
   * **Bỏ mã HTML trùng lặp:** Loại bỏ hoàn toàn thanh toolbar chọn khung thời gian tùy biến, các nút chọn heatmap mode, nút chỉnh đổ màu (solid/fade) và các wrapper HTML thừa.
   * **Sử dụng widget native:** Nhúng component `<VNInvestCharts>` trực tiếp với các thuộc tính cấu hình standalone:
     * `showHeader={true}`: Bật header và ô tìm kiếm mã (VNSymbolSearch) của widget.
     * `showFooter={true}`: Bật thanh chọn khung thời gian và range ở phía dưới.
     * `showToolbar={true}`: Bật thanh công cụ vẽ bên trái.
     * `drawingUiEnabled={true}`: Cho phép tương tác vẽ kỹ thuật.
     * `locale="vi"`, `messages={widgetMessagesVi}`: Đồng bộ hóa đa ngôn ngữ tiếng Việt.
   * **Bản đồ hóa sự kiện (Callbacks):**
     * `onTimeframeChange`: Đồng bộ hóa thay đổi khung thời gian từ widget (`1m`, `5m`, `15m`, `1h`, `1d`) về các giá trị tương ứng của trang chi tiết (`1m`, `5m`, `15m`, `1H`, `D`).
     * `onSymbolChange`: Khi người dùng tìm kiếm mã mới trên header, thực hiện chuyển hướng trình duyệt: `window.location.href = '/stocks/' + symbol`.
   * **Hỗ trợ Overlays tùy biến:** Truyền `ViewportSharkMarkersOverlay` và `HeatmapBandOverlay` làm children của `<VNInvestCharts>` nhằm đáp ứng:
     * **Ràng buộc 5:** Hiển thị biểu tượng 🟢/🔴🦈 cho top 10% nến có volume lớn nhất đang hiển thị trên viewport.
     * **Ràng buộc 3:** Heatmap dòng tiền hiển thị dưới dạng dải màu nền theo time bucket.

---

### C. Build & Scripts Configurations

1. **`jest.config.js`**
   * Đổi đường dẫn bỏ qua kiểm thử từ `vnstockcharts` sang `vninvestcharts`.
2. **`find-extensionless.mjs` & `fix-esm-imports.mjs`**
   * Cập nhật đường dẫn quét thư mục gốc từ `vnstockcharts` sang `vninvestcharts`.

---

## 3. Kế hoạch kiểm thử (Verification Plan)

### Kiểm thử tự động
Chạy kiểm thử frontend để xác minh import đường dẫn và code biên dịch thành công:
```bash
npm run test
```

### Kiểm thử thủ công
1. Truy cập trang chi tiết mã chứng khoán: `http://localhost/stocks/VRE`
2. Xác nhận tiêu đề trên biểu đồ hiển thị nhãn `VNINVESTCHARTS` cùng thanh toolbar vẽ kỹ thuật bên trái.
3. Kiểm tra chọn các khung thời gian ở footer widget hoạt động và cập nhật dữ liệu.
4. Nhập mã khác trong ô tìm kiếm của header và kiểm tra chuyển hướng hoạt động chính xác.

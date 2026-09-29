# Báo Cáo Audit & Khắc Phục Lỗi Unit Test - Di Trú SaaS Frontend VNInvest

**Ngày thực hiện:** 21/06/2026  
**Trạng thái:** Chờ phê duyệt di trú  
**Mục tiêu:** Phân tích, phản biện kỹ thuật đối với kết quả triển khai 8 slices di trú giao diện và khắc phục 5 nhóm lỗi nghiêm trọng phát hiện trong quá trình chạy kiểm thử (`npm run test`).

---

## 1. Tóm tắt Phát hiện (Executive Summary)

Mặc dù quá trình biên dịch production (`npm run build`) của `packages/web` thành công với thời gian ~13 giây, việc chạy bộ kiểm thử đơn vị (`npm run test`) đã phát hiện **8/15 suite lỗi với 21/197 test case thất bại**. 

Các lỗi này được phân loại thành 3 nhóm chính:
1. **Lỗi logic hook/vòng lặp phản hồi** (`useRealtimePolling.js`) gây dư thừa request mạng.
2. **Lỗi cú pháp JSX** trong môi trường kiểm thử (`WorkstationLayout.test.jsx`) làm hỏng cấu trúc component.
3. **Sự sai lệch giữa kiểm thử và thực tế linh kiện (Stale Assertions)** do bộ test cũ viết cho phiên bản tiếng Anh và cấu trúc DOM cũ, trong khi linh kiện SaaS-native đã chuẩn hóa tiếng Việt và cấu trúc DOM mới.

---

## 2. Chi tiết Lỗi Kỹ thuật & Nguyên nhân Gốc (Root Cause Analysis)

### 2.1 Lỗi Double-Fetch Polling trên Hook `useRealtimePolling.js`
* **Triệu chứng:** Test case kiểm tra số lần gọi hàm fetch (`toHaveBeenCalledTimes(1)`) báo lỗi nhận được 2 lần gọi.
* **Nguyên nhân gốc:** 
  Trong useEffect theo dõi thay đổi của `dedupeKey` (mã cổ phiếu):
  ```javascript
  useEffect(() => {
    if (enabled && isPolling) {
      stop();
      start();
    }
  }, [dedupeKey, enabled, isPolling, start, stop]);
  ```
  Khi component mount, `start()` được gọi, đặt `isPolling` thành `true`. Việc thay đổi `isPolling` từ `false` sang `true` kích hoạt useEffect trên chạy lại ngay lập tức vì `isPolling` nằm trong mảng dependency. Phản ứng phụ này gọi `stop()` rồi `start()` một lần nữa trong cùng lượt render, dẫn đến việc gửi request fetch lần thứ hai không cần thiết.
* **Giải pháp:** Sử dụng một `useRef` lưu `dedupeKey` trước đó và chỉ gọi restart polling khi `dedupeKey` thực sự thay đổi giá trị.

### 2.2 Lỗi Cú pháp Comment JSX trong `WorkstationLayout.test.jsx`
* **Triệu chứng:** Lỗi `Unable to find an element by: [data-testid="left-content"]`.
* **Nguyên nhân gốc:**
  Tại dòng 125 của file test:
  ```jsx
  <WorkstationLayout enabled={false}> // enabled prop is false but ENV overrides
    {{ left: mockLeftContent, right: mockRightContent }}
  </WorkstationLayout>
  ```
  Phần comment `// enabled prop is false...` nằm trong vùng con của thẻ JSX được trình biên dịch React hiểu là một text node con. Điều này khiến `props.children` trở thành một mảng `[string, object]` thay vì một object `{left, right}` thông thường. Do đó, component render ra các cột trống vì không tìm thấy `children.left`.
* **Giải pháp:** Loại bỏ comment nằm sai cú pháp ra khỏi vùng con của thẻ JSX.

### 2.3 Lỗi Tính toán Index khi Prepend phần tử trong `useTradeLog.test.js`
* **Triệu chứng:** Test case `processNewTrades trims to maxItems and cleans seenKeys` thất bại với thông tin: `Expected: 100099, Received: 100098`.
* **Nguyên nhân gốc:**
  Bài test tạo mảng gốc gồm 100 phần tử (từ chỉ số 0 đến 99, với giá trị tăng dần từ `100000` đến `100099`). Khi thực hiện prepend (thêm vào đầu mảng) 1 phần tử mới, các phần tử cũ sẽ bị dịch chuyển sang phải (shift right). Phần tử cũ nhất ở cuối mảng (`100099`) bị đẩy ra ngoài giới hạn 100 và bị cắt bỏ.
  Phần tử nằm ở cuối mảng mới (chỉ số 99) thực tế là phần tử trước đó ở chỉ số 98 (`100098`). Tuy nhiên bài test cũ lại assert:
  `expect(trades[99].price).toBe(100099);` (nhầm lẫn giữa phần tử bị xóa và phần tử dịch sang).
* **Giải pháp:** Cập nhật kết quả mong đợi tại chỉ số 99 thành `100098`.

### 2.4 Sự bất đồng bộ Định dạng Locale Tiếng Việt trong `StockExecutionLogWidget.test.jsx`
* **Triệu chứng:** Lỗi tìm kiếm phần tử chứa chuỗi `'100,000.00'`.
* **Nguyên nhân gốc:**
  Linh kiện SaaS-native đã chuẩn hóa định dạng số sang tiếng Việt (`vi-VN`) hiển thị dấu chấm phân cách hàng nghìn và dấu phẩy phân cách thập phân (`100.000,00`). Bài test cũ vẫn tìm kiếm theo định dạng tiếng Anh (`100,000.00`). Đồng thời nhãn giao dịch hiển thị `"Mua"` / `"Bán"` thay vì ký hiệu viết tắt `"M"` / `"B"`.
* **Giải pháp:** Cập nhật các giá trị tìm kiếm trong test case khớp với định dạng thực tế của linh kiện.

### 2.5 Lỗi Tên Accessibility Role của Nhóm Hàng trong `StockOrderBookWidget.test.jsx`
* **Triệu chứng:** Không tìm thấy phần tử `rowgroup` có tên `/ba mức giá mua/i`.
* **Nguyên nhân gốc:**
  Linh kiện sản phẩm thực tế định nghĩa `aria-label` cho hai danh sách mua bán lần lượt là `"Giá Mua (Bid)"` và `"Giá Bán (Ask)"` để tối ưu SEO và hỗ trợ đầu đọc màn hình. Bài test cũ kiểm tra theo nhãn thử nghiệm cũ.
* **Giải pháp:** Cập nhật tên của accessibility query khớp với nhãn thực tế.

---

## 3. Đánh giá Chất lượng Kỹ thuật & Khuyến nghị Di trú

1. **Về App Shell & Sidebar:** Triển khai rất sạch sẽ, giải quyết tốt cơ chế responsive bằng Tailwind và quản lý Workspace Selector mượt mà.
2. **Về Cơ chế tự động co giãn Biểu đồ (`useChartResize`):** Sử dụng `ResizeObserver` là phương án chuẩn mực giúp tránh vỡ layout canvas khi đóng/mở sidebar.
3. **Nợ kỹ thuật:** Cần dọn dẹp ngay lập tức 11 tệp `.jsx` cũ trong các thư mục Whale Advisory để làm sạch cấu trúc thư mục, tránh nhập nhầm tệp khi bảo trì.

---

## 4. Kế hoạch vá lỗi & Nghiệm thu sau kiểm thử

Sau khi được phê duyệt kế hoạch, các tệp sau đây sẽ được cập nhật/xóa bỏ:

| STT | Loại | Đường dẫn tệp | Mục tiêu chỉnh sửa |
|---|---|---|---|
| 1 | Sửa | `packages/web/jest.config.js` | Thêm moduleNameMapper cho `coreApiAdapter.js` |
| 2 | Sửa | `packages/web/src/components/workstation/hooks/useRealtimePolling.js` | Tối ưu hóa dependency của useEffect khởi tạo lại polling |
| 3 | Sửa | `packages/web/src/components/workstation/WorkstationLayout.test.jsx` | Sửa comment JSX và thêm option `{ hidden: true }` cho query ẩn |
| 4 | Sửa | `packages/web/src/components/workstation/hooks/useTradeLog.test.js` | Sửa giá trị kỳ vọng dịch chuyển mảng từ 100099 thành 100098 |
| 5 | Sửa | `packages/web/src/components/workstation/StockExecutionLogWidget.test.jsx` | Khớp định dạng số vi-VN và nhãn Mua/Bán |
| 6 | Sửa | `packages/web/src/components/workstation/StockOrderBookWidget.test.jsx` | Khớp aria-label nhóm Giá Mua (Bid)/Giá Bán (Ask) |
| 7 | Xóa | `packages/web/src/components/advisory/*.jsx` | Loại bỏ 10 tệp JSX cũ đã di trú xong |
| 8 | Xóa | `packages/web/src/pages/signals/WhaleAdvisoryPage.jsx` | Loại bỏ tệp trang JSX cũ đã di trú xong |

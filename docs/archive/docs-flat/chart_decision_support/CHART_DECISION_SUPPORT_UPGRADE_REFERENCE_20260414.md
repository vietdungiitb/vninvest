# Tài liệu tham khảo nâng cấp biểu đồ hỗ trợ ra quyết định

Ngày cập nhật: 14/04/2026

## 1) Mục tiêu

Biến biểu đồ từ dạng hiển thị dữ liệu sang dạng hỗ trợ quyết định giao dịch, tập trung vào:

- Đọc nhanh tín hiệu quan trọng
- So sánh đồng thời Giá, CVD, Dark Flow theo cùng mốc thời gian
- Hạn chế các trạng thái zoom không còn giá trị phân tích

## 2) Các nâng cấp đã hoàn thành

### 2.1 Đồng bộ đa panel theo thời gian

- Đã dùng đồng bộ theo time range thay vì logical index để tránh lệch mốc giữa 3 panel.
- Kết quả: kéo, thu phóng ở một panel thì panel còn lại đi cùng khung thời gian thực.

### 2.2 Cải thiện trục X và định dạng thời gian

- Trục thời gian đã rõ ràng hơn cho người dùng.
- Định dạng xử lý tốt cho cả dữ liệu ngày và dữ liệu intraday dạng timestamp.

### 2.3 Tooltip OHLC và Volume

- Khi hover, hiển thị thông tin phiên chi tiết O, H, L, C, phần trăm thay đổi, khối lượng.
- Giúp soi từng nến thay vì nhìn tổng quan cảm tính.

### 2.4 Định dạng số CVD

- Số lớn đã chuyển về dạng compact như K, M, B.
- Tốc độ đọc biểu đồ tăng rõ rệt, giảm nhiễu thị giác.

### 2.5 Thanh kết luận nhanh chiến thuật

- Đã có thanh trạng thái chiến thuật active và mức rủi ro để người dùng nhận định nhanh.

### 2.6 Khung thời gian intraday

- Đã mở rộng hỗ trợ 1h, 30m, 15m cho chuỗi dữ liệu biểu đồ.
- Đã bổ sung chuẩn hóa interval, mapping dữ liệu và xử lý bucket intraday.

## 3) Kết luận về ý kiến viewport 30-300 nến

Ý kiến này hoàn toàn đúng cho mục tiêu phân tích thực chiến của sản phẩm.

### 3.1 Vì sao cần giới hạn số nến trong khung nhìn

- Khi chỉ còn 1 đến 5 nến: mất ngữ cảnh xu hướng, mất ý nghĩa so sánh với chỉ báo dòng tiền.
- Khi quá nhiều nến: quá nén, mất khả năng đọc cấu trúc giá ngắn hạn.
- Vùng hợp lý để phân tích hành vi giá và dòng tiền thường là khoảng 30 đến 300 nến.

### 3.2 Ngoại lệ

- Một số case giám sát vi mô có thể cần nhìn rất ít nến.
- Tuy nhiên với module này, mặc định nên ưu tiên vùng có ý nghĩa phân tích quyết định.

## 4) Đề xuất kỹ thuật bắt buộc cho zoom guardrail

## 4.1 Rule chuẩn

- Min bars visible: 30
- Max bars visible: 300
- Áp dụng trên panel giá làm chuẩn điều hướng
- Các panel còn lại bám theo time sync đã có

## 4.2 Cơ chế thực thi

- Lắng nghe thay đổi visible logical range của panel giá.
- Tính số nến đang hiển thị.
- Nếu nhỏ hơn min hoặc lớn hơn max thì set lại logical range về ngưỡng hợp lệ quanh tâm vùng nhìn hiện tại.
- Tránh vòng lặp bằng cờ isAdjusting.

## 4.3 Trải nghiệm người dùng

- Khi chạm ngưỡng zoom, hiển thị thông báo nhẹ: Khung nhìn phân tích được giới hạn 30 đến 300 nến.
- Không dùng popup chặn thao tác.

## 5) Các hạng mục tiếp theo theo ưu tiên triển khai

1. Đặt mặc định chart type là nến.
2. Đánh dấu Whale Buy và Whale Sell trực tiếp trên panel giá bằng marker nổi bật.
3. Thêm đường mốc trung tính 50 cho Dark Flow Strength.
4. Đồng bộ crosshair dọc theo cùng timestamp giữa 3 panel.
5. Vẽ hỗ trợ và kháng cự tự động, gắn nhãn breakout khi đủ điều kiện xác nhận.
6. Bổ sung tooltip giải thích Dark Flow Strength.
7. Bổ sung nhận diện phân kỳ giá và dòng tiền, highlight trực tiếp trên chart.
8. Xây dựng alert engine theo ngưỡng đơn và tín hiệu tổng hợp.

## 6) Tiêu chí nghiệm thu tối thiểu cho guardrail 30-300

- Không thể zoom vào mức dưới 30 nến.
- Không thể zoom ra mức trên 300 nến.
- Vẫn giữ đồng bộ thời gian giữa 3 panel.
- Không giật lag khi kéo và zoom liên tục.
- Không làm sai marker Whale, MA, CVD, Dark Flow.

## 7) File liên quan chính

- [frontend/src/components/DarkMoneyMasterChart.jsx](frontend/src/components/DarkMoneyMasterChart.jsx)
- [backend/portfolio/views_dark_money_history.py](backend/portfolio/views_dark_money_history.py)

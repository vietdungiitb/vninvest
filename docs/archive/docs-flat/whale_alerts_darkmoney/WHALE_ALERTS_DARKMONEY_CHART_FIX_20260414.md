# Whale Alerts DarkMoney Chart Fix - 2026-04-14

## 1. Bối cảnh sự cố

- Trang: /whale-alerts/:symbol
- Component bị lỗi: frontend/src/components/DarkMoneyMasterChart.jsx
- Lỗi runtime trên production bundle:
  - TypeError: e.addCandlestickSeries is not a function
  - Stack trace trỏ vào DarkMoneyMasterChart khi khởi tạo biểu đồ nến

## 2. Root cause

- Frontend đang dùng lightweight-charts version 5.1.0.
- Code chart trước đó gọi API kiểu cũ của lightweight-charts v4:
  - addCandlestickSeries
  - addHistogramSeries
  - addLineSeries
  - addAreaSeries
- Ở runtime hiện tại, object chart không có addCandlestickSeries nên throw TypeError và làm hỏng quá trình render.

## 3. Mục tiêu fix

- Không còn lỗi TypeError khi mở trang whale alerts.
- Tương thích cả API cũ và API mới của lightweight-charts (v4/v5).
- Nếu chart lỗi bất ngờ ở runtime, không làm sập toàn trang.

## 4. Thay đổi đã triển khai

### 4.1 Tương thích API lightweight-charts v4/v5

Trong DarkMoneyMasterChart:

- Thêm helper addSeriesCompat:
  - Ưu tiên dùng method cũ nếu tồn tại.
  - Fallback sang chart.addSeries(seriesCtor, options) cho v5.
- Thêm helper setMarkersCompat:
  - Dùng series.setMarkers nếu có.
  - Fallback createSeriesMarkers cho API mới.

Áp dụng cho toàn bộ series:

- Candlestick
- Histogram volume
- Line MA20/MA50
- Area CVD
- Histogram dark flow strength
- Line SMA

### 4.2 Hardening chống crash toàn trang

- Bọc khối render chart trong try/catch bên trong useEffect.
- Nếu có exception khi init/update chart:
  - log lỗi console
  - cleanup chart instances
  - hiển thị fallback UI tiếng Việt trong card chart
  - các widget còn lại của WhaleAlertsDashboard vẫn render bình thường

## 5. File đã chỉnh

- frontend/src/components/DarkMoneyMasterChart.jsx

## 6. Quy trình verify chuẩn

### 6.1 Verify build

- Chạy frontend build:
  - npm run build
- Kết quả mong đợi:
  - Compiled successfully

### 6.2 Verify runtime

- Rebuild frontend container:
  - docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build frontend
- Mở trang:
  - http://localhost/whale-alerts/VIC
- Mở DevTools Console và xác nhận:
  - Không còn lỗi addCandlestickSeries is not a function

### 6.3 Verify UX fail-safe

- Khi giả lập lỗi chart (ví dụ API chart bị đổi bất thường), trang không trắng.
- Card chart hiển thị thông báo fallback:
  - Biểu đồ tạm thời gián đoạn

## 7. Tiêu chuẩn code cho các chart mới

Khi dùng lightweight-charts trong dự án này:

1. Không gọi trực tiếp các method add...Series cứng vào 1 version.
2. Luôn qua helper compatibility để tránh lock theo version thư viện.
3. Luôn có fallback UI khi khởi tạo chart lỗi.
4. Không để lỗi chart phá render các panel khác trong cùng dashboard.

## 8. Checklist regression trước khi merge

- Truy cập được whale-alerts của ít nhất 3 mã (VIC, VHM, VCB).
- Chart pane 1, 2, 3 render đầy đủ.
- Marker whale_buy và whale_sell hiển thị bình thường.
- Chuyển period và interval không gây crash.
- Resize trình duyệt không làm chart lỗi.
- Console không có TypeError liên quan addCandlestickSeries/addSeries/setMarkers.

## 9. Hướng mở rộng tiếp theo

- Bổ sung Error Boundary cấp page cho WhaleAlertsDashboard.
- Bổ sung test hồi quy cho DarkMoneyMasterChart (compat v4/v5 + fallback UI).
- Bổ sung telemetry lỗi chart để theo dõi theo symbol và phiên runtime.

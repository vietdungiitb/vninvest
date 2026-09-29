# FRONTEND IMPLEMENTATION SPEC - WHALE ANALYTICS v2.0

## 1. Mục tiêu

Frontend phải chuyển từ mô hình ghép dữ liệu ở client sang mô hình render từ snapshot chuẩn hóa. Mọi hành vi chart phải phục vụ tính đúng và tính tin cậy trước khi tối ưu hiệu ứng.

## 2. File neo chính

- `frontend/src/components/WhaleAnalyticsTab.jsx`
- `frontend/src/components/WhaleBubbleChart.jsx`
- `frontend/src/hooks/useWhaleAnalyticsData.js`
- `frontend/src/utils/whaleTimeAdapter.js`
- `frontend/src/api/client.js`

## 3. Trách nhiệm theo file

### 3.1 WhaleAnalyticsTab.jsx

- giữ `symbol` và `timeframe`
- render trạng thái loading/error/stale/degraded ở cấp tab
- không tự xử lý logic ghép dữ liệu chart

### 3.2 useWhaleAnalyticsData.js

- là data orchestrator duy nhất cho Whale Analytics chart
- gọi đúng snapshot endpoint
- xử lý polling, pause khi background, resume ngay khi focus
- bỏ response cũ nếu request context không còn khớp

### 3.3 whaleTimeAdapter.js

- dùng cho label, session display và chart axis helper
- không tự đặt luật khác backend
- mọi session window phải bám contract backend

### 3.4 WhaleBubbleChart.jsx

- render pane trên và pane dưới
- sync crosshair theo timestamp
- tooltip point-anchored
- hiển thị empty state và degraded state đúng ngữ nghĩa

## 4. State machine bắt buộc

### 4.1 Initial load

1. Có `symbol` và `timeframe`.
2. Gửi request snapshot.
3. Nếu có cache local hợp lệ, render tạm snapshot cũ.
4. Khi response mới về, thay thế snapshot atomically.

### 4.2 Symbol/timeframe change

1. Invalid state cũ ngay lập tức.
2. Sinh request key mới theo `symbol + timeframe + trade_date/profile`.
3. Response nào không còn khớp request key hiện tại phải bị bỏ qua.

### 4.3 Background pause

1. Khi tab hidden, dừng polling.
2. Không tiếp tục request nền vô ích.

### 4.4 Focus resume

1. Khi tab visible lại, fetch ngay snapshot mới.
2. Không đợi tới chu kỳ polling tiếp theo.

## 5. Yêu cầu UI và render

### 5.1 Pane trên

- bubble series
- price line intraday
- bubble color theo side
- extreme order có viền hoặc halo riêng

### 5.2 Pane dưới

- CVD
- buy strength
- institutional strength

### 5.3 Quy ước màu

- Buy: xanh lá
- Sell: đỏ
- Institutional strength: xanh dương/cyan
- Price line: vàng cam hoặc màu tương phản cao với nền hiện tại

Không được dùng màu institutional strength quá gần màu buy.

## 6. Tooltip specification

### 6.1 Quy tắc tuyệt đối

- Chỉ mở tooltip khi hover đúng điểm bubble hoặc đúng marker/hit area của line.
- Tooltip phải bind đúng timestamp của điểm hover.
- Không được lấy số liệu từ điểm gần nhất nếu điểm đó không phải điểm đang hover.

### 6.2 Hover bubble

Hiển thị tối thiểu:
- timestamp
- side
- matched value
- volume
- trade price
- reference price
- delta %
- strength tại đúng bucket nếu có thể map cùng timestamp
- cờ whale/extreme

### 6.3 Hover line

Hiển thị tối thiểu:
- timestamp
- tên line đang hover
- giá trị line tại timestamp đó
- field ngữ cảnh cùng timestamp nếu thực sự đồng bộ được từ snapshot

### 6.4 Empty state

- Nếu bucket có flow nhưng không có bubble: hiển thị flow, ẩn bubble details.
- Nếu cả hai đều không có dữ liệu hợp lệ: `Không có dữ liệu`.

## 7. Crosshair sync

- Sync theo `timestamp` giữa pane trên và pane dưới.
- Khi pane A hover, pane B hiển thị vertical line tương ứng.
- Crosshair không được ép tooltip của pane còn lại phải xuất hiện dữ liệu nếu không có point hợp lệ.

## 8. Data gap và trục X

- Trục X phải là linear time.
- Khoảng nghỉ trưa phải là gap thực.
- Khoảng bucket không có giao dịch cũng phải giữ đúng tỷ lệ thời gian, không nối line giả.

## 9. API client changes

`frontend/src/api/client.js` phải có method snapshot mới, ví dụ:

```js
getWhaleAnalyticsSnapshot(symbol, { timeframe = 'session', compact = 1 } = {})
```

Không tiếp tục dùng song song:
- `getWhaleOrdersBySymbol()`
- `getDarkMoneyHistory()`

cho chart Whale Analytics v2.0.

## 10. Anti-pattern bị cấm ở frontend

- Merge từng mảng con từ nhiều response khác nhau vào state hiện tại.
- Tự cắt lại session từ payload lớn nếu backend đã trả snapshot đúng timeframe.
- Giữ polling khi tab background.
- Dùng tooltip formatter kiểu axis aggregate rồi trộn dữ liệu nhiều series khác timestamp.

## 11. Definition of done cho frontend

Frontend chỉ được coi là xong khi:
- hook dùng snapshot endpoint duy nhất
- time adapter khớp `09:00-15:00`
- crosshair sync hoạt động theo timestamp
- tooltip point-anchored và fail-safe đúng
- pause/resume hoạt động đúng
- có bằng chứng video hoặc devtools capture cho các case chính
# FRONTEND IMPLEMENTATION SPEC - WHALE ANALYTICS V2

## 1. Mục tiêu

Frontend phải phục vụ ba ưu tiên theo đúng thứ tự:

1. Đọc đúng.
2. Hiển thị trung thực.
3. Tối ưu tốc độ thao tác.

Không được đánh đổi tính trung thực thị giác chỉ để chart nhìn sạch hơn.

## 2. File neo chính

- `frontend/src/components/WhaleAnalyticsTab.jsx`
- `frontend/src/components/WhaleBubbleChart.jsx`
- `frontend/src/hooks/useWhaleAnalyticsData.js`
- `frontend/src/hooks/useOrderBubbleCoordinates.js`
- `frontend/src/utils/whaleTooltipFormatter.js`
- `frontend/src/utils/whaleAnalyticsSnapshotAdapter.js`
- `frontend/src/utils/whaleTimeAdapter.js`
- `frontend/src/api/client.js`
- `frontend/src/i18n/index.js`

## 3. Quy tắc sản phẩm bắt buộc ở frontend

### 3.1 Visual truthfulness

- Mọi bubble vượt ngưỡng lọc đang chọn phải được render đầy đủ.
- Không được tự động giảm opacity các lệnh nhỏ theo mật độ làm mặc định.
- Không được ẩn bớt bubble hợp lệ chỉ để chart đỡ rối.
- Không được cluster mặc định ở Giai đoạn 1.

### 3.2 Các cơ chế được phép dùng để hỗ trợ đọc

- Filter theo ngưỡng do user chủ động chọn.
- DataZoom.
- Information Panel docked.
- Z-order để bubble lớn nằm trên bubble nhỏ.
- Direct label/endLabel cho line chính.

### 3.3 Các kỹ thuật bị cấm làm mặc định

- opacity taper theo density,
- hidden-by-density,
- auto-cluster,
- merge tooltip từ các điểm lân cận,
- infer hover payload từ bucket gần nhất.

## 4. Giai đoạn 1 - Yêu cầu UI chi tiết

### 4.1 Docked Information Panel

Chart phải có một panel thông tin cố định nằm ngoài vùng vẽ chính.

Yêu cầu:

- cập nhật khi hover bubble hoặc line,
- không che chart,
- khi không hover thì hiển thị trạng thái hướng dẫn hoặc snapshot summary ngắn,
- khi hover bubble thì panel ưu tiên field event-level,
- khi hover line thì panel ưu tiên field series-level.

Không tiếp tục dựa vào popup tooltip nổi như nguồn đọc chính.

### 4.2 Filter quy mô lệnh

Giai đoạn 1 phải có:

- preset nhanh: `Tất cả`, `> 500 triệu`, `> 1 tỷ`, `> 3 tỷ`, `> 5 tỷ`, `> 10 tỷ`,
- slider log-scale cho người dùng tinh chỉnh,
- text hiển thị ngưỡng hiện hành rõ ràng.

Semantics bắt buộc:

- filter chỉ tác động tới bubble series,
- không được tác động tới price line, CVD, strength, institutional strength,
- mọi lệnh trên ngưỡng hiện hành phải còn nguyên số lượng và hình dạng.

### 4.3 Bubble layering

Bubble lớn phải được render ở lớp trên bubble nhỏ.

Mục tiêu:

- lệnh quan trọng không bị che,
- nhưng lệnh nhỏ hợp lệ vẫn tồn tại và vẫn nhìn thấy.

Đây là thay đổi z-order, không phải thay đổi semantics hiển thị.

### 4.4 Direct labels

Các line sau phải có nhãn trực tiếp ở cuối line hoặc vị trí tương đương:

- Đường giá
- CVD
- Sức mạnh mua
- Sức mạnh tổ chức

Legend phía trên chỉ là lớp phụ trợ, không phải cơ chế nhận diện chính.

### 4.5 i18n fallback

Không được để chart hiển thị raw key kiểu `whaleAnalytics.buyStrengthShort`.

Yêu cầu:

- translator fallback phải trả về default value thực sự nếu key thiếu,
- hoặc component phải dùng explicit defaultValue thay vì `t(key) || fallback` kiểu hiện tại.

## 5. Giai đoạn 2 - UI và interaction

### 5.1 Price context overlays

Khi contract backend sẵn sàng, chart phải render được:

- Giá tham chiếu
- High phiên
- Low phiên
- Trần
- Sàn

Quy tắc trực quan:

- ref: neutral dashed line,
- high/low: secondary dashed line,
- trần/sàn: strongest caution line.

### 5.2 DataZoom

DataZoom là công cụ hỗ trợ đọc vùng dày, không phải cách thay thế filter.

Yêu cầu:

- zoom trong bubble pane phải sync với flow pane,
- zoom không làm mất linear time semantics,
- zoom không được làm Information Panel đọc sai timestamp.

## 6. Giai đoạn 3 - UI nâng cao

### 6.1 Order flow speed presentation

Nếu backend có `flow_speed_series`, frontend phải render thành một panel phụ hoặc sparkline riêng, không trộn chung vào thang CVD.

### 6.2 Percentile presentation

Nếu backend có percentile 10 phiên, frontend phải hiển thị theo dạng:

- progress bar,
- label percentile,
- baseline sample size.

Không hiển thị kiểu nhị phân `Có/Có` khi đã có dữ liệu sâu hơn.

## 7. Tooltip và panel semantics

### 7.1 Bubble hover

Information Panel phải hiển thị tối thiểu:

- timestamp gốc của lệnh,
- side,
- matched value,
- volume,
- trade price,
- reference price,
- delta %, 
- event score nếu có,
- ngưỡng whale đang áp dụng nếu có,
- strength/institutional strength của cùng bucket nếu map đúng timestamp được.

### 7.2 Line hover

Information Panel phải hiển thị:

- tên line,
- timestamp,
- giá trị line,
- các field ngữ cảnh đồng timestamp nếu thật sự đồng bộ.

### 7.3 Fail-safe

Nếu không có bubble ở timestamp đang hover:

- không được bù bằng bubble gần nhất,
- panel chỉ hiển thị dữ liệu line hoặc trạng thái không có lệnh lớn tại thời điểm này.

## 8. State machine bắt buộc

### 8.1 Snapshot lifecycle

- một request key duy nhất theo `symbol + timeframe + trade_date + compact`,
- response cũ về muộn phải bị bỏ,
- background pause và focus resume phải giữ nguyên.

### 8.2 Filter lifecycle

- filter bubble là state độc lập ở frontend,
- đổi filter không được trigger refetch nếu backend chưa yêu cầu contract khác,
- mọi thay đổi filter phải là local transform minh bạch.

### 8.3 Hover lifecycle

- hover update panel,
- crosshair sync theo timestamp,
- panel clear khi `globalout` hoặc state invalidation.

## 9. Anti-pattern bị cấm

- dùng opacity để biểu đạt density khi không có chú thích rõ,
- render cluster bubble mặc định,
- gộp tooltip kiểu axis aggregate rồi ghép dữ liệu lệch timestamp,
- filter ngầm không hiển thị cho người dùng,
- suy diễn `high/low/trần/sàn` ở frontend nếu backend chưa khóa contract.

## 10. Definition of done cho frontend

Frontend chỉ được coi là xong khi:

- có Information Panel docked,
- có filter ngưỡng minh bạch,
- giữ đủ bubble trên ngưỡng,
- direct labels hoạt động,
- không còn raw i18n key,
- hover/panel bind đúng timestamp,
- QA có video/screenshot chứng minh visual truthfulness.

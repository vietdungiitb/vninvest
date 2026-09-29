# Báo cáo Audit Kỹ Thuật Đã Hiệu Chỉnh: Dark Money Flow & Whale Alerts

Ngày cập nhật: 2026-04-15
Phạm vi: đối chiếu lại báo cáo audit trước đó với code hiện tại ở backend, historical API, realtime feed và dashboard
Mục tiêu: tách rõ phần nào còn đúng, phần nào đã lỗi thời, và phần nào cần ưu tiên xử lý trong các phiên làm việc tiếp theo

## 1. Kết luận điều hành

Báo cáo audit ngày 2026-04-10 đúng hướng ở nhận định tổng thể: hệ thống đã có pipeline khá đầy đủ cho whale alerts và dark money, nhưng vẫn còn các điểm nghẽn rõ ràng ở tính nhất quán dữ liệu, semantics thời gian và cách frontend khuếch đại tải REST.

Tuy nhiên, khi đối chiếu với code hiện tại, một số nhận định trong báo cáo cũ cần chỉnh lại:

- Không nên mô tả `order_flow.py` là engine thuần pure-function theo nghĩa chặt, vì module vẫn query DB và dùng cache.
- Không có detector `detect_twap_bot()` độc lập; heuristic TWAP hiện đang được nhúng trong `detect_dark_flow()`.
- Rủi ro thực tế lớn nhất ở frontend hiện tại không chỉ là WebSocket kích hoạt REST refresh, mà còn là legacy realtime hook vẫn polling song song ngay cả khi WebSocket đã mở.
- Historical API đã hỗ trợ intraday cho candle và dark flow, nhưng whale signals cùng các annotation như absorption/aggression vẫn đang trả mốc thời gian ở mức ngày, tạo ra độ lệch ngữ nghĩa khi hiển thị trên chart intraday.

Vì vậy, bản audit này thay thế góc nhìn “điều tra ban đầu” bằng một bản đã hiệu chỉnh theo source code ngày 2026-04-15.

## 2. Thành phần đã đối chiếu

- `backend/portfolio/order_flow.py`
- `backend/portfolio/views_dark_money_history.py`
- `frontend/src/pages/WhaleAlertsDashboard.jsx`
- `frontend/src/hooks/useRealtimeFeed.js`
- `frontend/src/hooks/useRealtimeFeedLegacy.js`
- `frontend/src/context/RealtimeContext.jsx`

## 3. Các nhận định được xác nhận bởi code hiện tại

### F1. Historical API đang là endpoint hợp nhất, nhưng gộp nhiều lớp dữ liệu khác nhau vào cùng payload

`views_dark_money_history.py` hiện trả về trong cùng một response:

- OHLC candles
- dark flow series
- whale signals
- moving averages
- Smart Money Flow Index (SMFI)
- strategy interpretation table
- absorption zones
- aggression events

Điều này đúng với mô tả “một endpoint tổng hợp để phục vụ chart chiến lược”, và là nền tảng tốt cho frontend. Tuy nhiên, mức độ tổng hợp cao cũng đồng nghĩa với việc bất kỳ sai lệch nào về semantics thời gian hoặc bucket hóa sẽ lan ra toàn bộ chart.

### F2. Frontend dashboard hiện có rủi ro khuếch đại tải REST

`WhaleAlertsDashboard.jsx` đang có nhiều trigger gọi API chồng lên nhau:

- mount sẽ gọi `fetchFeed()`
- mỗi whale alert realtime mới sẽ gọi lại `fetchFeed()`
- mỗi 60 giây lại auto-refresh `fetchFeed()`
- `fetchOrderFlow()` được gọi định kỳ mỗi 30 giây
- mỗi dark flow alert mới lại gọi `fetchOrderFlow({ silent: true })`

Vấn đề này có thật và nghiêm trọng hơn mô tả ban đầu nếu hệ thống đang chạy legacy realtime hook.

### F3. Legacy realtime hook không phải WebSocket thuần, mà là mô hình WS + polling song song

`useRealtimeFeed.js` chỉ dùng realtime manager khi cờ môi trường `REACT_APP_ENABLE_REALTIME_CONNECTION_MANAGER` được bật và context manager sẵn sàng.

Nếu không, hệ thống sẽ rơi về `useRealtimeFeedLegacy.js`. Ở nhánh này, code ghi rõ polling vẫn được giữ như “source of truth” ngay cả khi WebSocket đang kết nối. Điều đó có nghĩa:

- WS không thay thế REST polling
- áp lực lên API `getRealtimeTicker()` vẫn còn thường trực
- khi dashboard còn tự refetch feed/order flow theo event, tổng tải sẽ tăng theo cả hai hướng: polling nền và event-driven re-fetch

### F4. `_fetch_ticks()` vẫn kéo toàn bộ tick trong ngày rồi mới lọc cửa sổ bằng Python

Trong `order_flow.py`, helper `_fetch_ticks()` query toàn bộ `IntradayTick` theo `symbol` và `trade_date`, sau đó mới chuyển `trade_time` sang giây và lọc `cutoff_secs` bằng vòng lặp Python.

Đây là điểm nghẽn backend quan trọng vì:

- bộ dữ liệu đầu vào tăng theo toàn phiên giao dịch, không theo đúng cửa sổ phân tích
- chi phí RAM và CPU sẽ tăng mạnh với các mã thanh khoản cao
- detector dark money hiện phụ thuộc trực tiếp vào helper này, nên bottleneck nằm ở gốc pipeline

## 4. Những nhận định trong báo cáo cũ cần chỉnh lại

### C1. `order_flow.py` không phải là module thuần pure-function theo nghĩa kiến trúc chặt

Ngay đầu file có comment mô tả đa số hàm là pure/side-effect-free, nhưng bản thân `_fetch_ticks()` đã query DB, `compute_tick_rate()` dùng cache, và `detect_dark_flow()` gọi cả hai. Vì vậy, module này phù hợp hơn với mô tả “logic tính toán pha trộn với I/O biên” thay vì “functional engine thuần”.

Ý nghĩa thực tế:

- khó unit-test tách biệt hoàn toàn nếu không mock biên dữ liệu
- khó tối ưu hiệu năng nếu chưa tách data access khỏi compute path
- các nhận định về purity trong audit cũ nên hạ từ mức “thiết kế đã tốt” xuống mức “đang nửa đường”

### C2. Không có detector `detect_twap_bot()` riêng

Code hiện tại không có hàm `detect_twap_bot()`. TWAP-like behavior đang là một nhánh heuristic bên trong `detect_dark_flow()` dựa trên:

- `tick_rate > baseline * 3`
- `small_ratio > 0.60`
- độ đều của biến thiên CVD (`cvd_steady`)

Do đó, nếu báo cáo cũ mô tả kiến trúc detector đã tách absorption, iceberg và TWAP thành các module độc lập thì mô tả đó đang đi trước thực trạng code.

### C3. Realtime manager đã tồn tại, nhưng chưa thể xem là kiến trúc mặc định đã áp dụng nhất quán

Hiện có abstraction manager tại `RealtimeContext.jsx`, nhưng việc dùng manager còn phụ thuộc cờ môi trường và điều kiện context. Vì thế, kết luận đúng hơn là:

- hệ thống đã có hướng đi sang realtime manager tập trung
- nhưng hành vi runtime thực tế vẫn có thể rơi về legacy mode
- mọi đánh giá về khả năng “đã xử lý triệt để fan-out/polling” là quá sớm

## 5. Rủi ro mới cần đưa lên cao hơn trong ưu tiên

### N1. Lệch semantics thời gian giữa các lớp dữ liệu trong historical API

Đây là điểm đáng chú ý nhất của lần re-audit này.

`dark_flow_series` đã hỗ trợ intraday bucket bằng unix timestamp. Nhưng:

- `whale_signals` vẫn group theo `trade_date` và serialize thành `YYYY-MM-DD`
- `absorption_zones` trả `time` theo ngày
- `aggression_events` cũng trả `time` theo ngày

Hệ quả:

- chart intraday có thể đang đặt overlay đúng dữ liệu nhưng sai mức thời gian
- người dùng dễ hiểu nhầm whale/dark annotations là tín hiệu cùng resolution với candle intraday
- backend hiện chưa thống nhất “time contract” giữa các series trong cùng một response

Đây là lỗi semantics sản phẩm chứ không chỉ là chi tiết trình bày.

### N2. Window selector và semantics detector cần được mô tả rõ hơn

Historical API hỗ trợ nhiều interval (`1D`, `1W`, `1h`, `30m`, `15m`) và có bucket hóa intraday cho dark flow. Tuy nhiên, detector core trong `order_flow.py` vẫn là logic riêng theo `window_minutes` ngắn hạn. Nếu frontend và backend không tách bạch rõ:

- đâu là chart interval
- đâu là detector lookback window
- đâu là aggregation bucket

thì UI rất dễ tạo kỳ vọng sai cho người dùng, kể cả khi code kỹ thuật vẫn chạy đúng.

## 6. Các việc đã lỗi thời hoặc cần hạ mức cảnh báo

### O1. Nhận định về lỗi timezone/local market window trong `order_flow.py` không còn là finding chính của bản re-audit này

Code hiện tại của `order_flow.py` đang dùng `django_timezone.localdate()` và `django_timezone.localtime().time()` cho `_today()` và `_now_time()`. Vì vậy, finding “đang dùng UTC cho cửa sổ local market” không còn là kết luận trung tâm ở trạng thái source hiện nay.

Điểm này nên được chuyển sang mục “đã từng là issue, cần giữ regression test”, thay vì tiếp tục để ở nhóm High/P0 của báo cáo mới.

## 7. Ưu tiên xử lý đề xuất cho các phiên tới

### P0 - Phải xử lý trước

1. Thống nhất contract thời gian trong historical API cho mode intraday.
2. Giảm REST amplification ở dashboard và realtime layer.

Kỳ vọng đầu ra:

- whale signals, absorption zones, aggression events phải có semantics thời gian nhất quán với chart intraday
- dashboard không còn tự nhân đôi tải giữa polling nền, WS event và periodic refetch

### P1 - Nên xử lý ngay sau P0

1. Đẩy lọc cửa sổ tick xuống DB thay vì lọc bằng Python sau khi query cả ngày.
2. Làm rõ ranh giới giữa chart interval, aggregation bucket và detector window.
3. Tách compute path khỏi I/O path trong `order_flow.py` để dễ test và tối ưu hơn.

### P2 - Nâng chất lượng kiến trúc

1. Tách heuristic TWAP thành detector độc lập nếu còn giữ hướng architecture theo strategy modules.
2. Xem lại direction model cho iceberg signal nếu muốn suy luận accumulation/distribution đáng tin hơn.
3. Bổ sung test hồi quy cho các hợp đồng dữ liệu intraday và realtime refresh semantics.

## 8. Danh sách nhiệm vụ ưu tiên để tiếp tục thảo luận

### Task A - Chuẩn hóa intraday time contract

Mục tiêu:

- thống nhất format `time` cho candles, dark flow, whale signals, absorption zones, aggression events khi interval là intraday
- tránh overlay sai resolution trên chart

Câu hỏi cần chốt ở phiên sau:

- muốn toàn bộ intraday dùng unix timestamp hay giữ mixed contract có kiểm soát
- whale signal intraday nên aggregate theo bucket hay giữ event-level

### Task B - Giảm tải REST ở dashboard/realtime

Mục tiêu:

- rà soát toàn bộ các đường gọi `fetchFeed`, `fetchOrderFlow`, polling ticker và WS-triggered refresh
- xác định mô hình cuối cùng: manager-first, polling fallback hay hybrid có backpressure

Câu hỏi cần chốt ở phiên sau:

- khi đã có WS event, có còn cần refetch full feed ngay lập tức không
- polling nền có nên tắt hoặc giảm tần suất khi socket khỏe và dữ liệu tươi không

### Task C - Refactor detector boundary

Mục tiêu:

- tách data-fetch layer khỏi compute layer trong `order_flow.py`
- tạo ranh giới rõ giữa detector logic và contract API/chart

Câu hỏi cần chốt ở phiên sau:

- có refactor theo hướng pure compute nhận ticks đầu vào không
- có tách TWAP thành detector độc lập trong cùng framework hay không

## 9. Kết luận

Bản audit cũ hữu ích ở vai trò cảnh báo ban đầu, nhưng nếu dùng làm cơ sở backlog hiện tại thì cần cập nhật. Ở trạng thái code ngày 2026-04-15, trọng tâm không còn là timezone bug như trước, mà là ba vấn đề có ảnh hưởng trực tiếp hơn:

- contract thời gian intraday chưa nhất quán
- frontend/realtime đang tự khuếch đại tải REST
- detector backend vẫn trộn I/O với compute và lọc cửa sổ chưa hiệu quả

Ba chủ đề này nên là xương sống cho các phiên thảo luận kỹ thuật tiếp theo.
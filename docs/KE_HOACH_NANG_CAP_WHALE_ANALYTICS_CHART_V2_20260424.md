# KẾ HOẠCH NÂNG CẤP WHALE ANALYTICS CHART — v2.0

## 1. Mục tiêu tài liệu

Tài liệu này là bản kế hoạch hợp nhất để duyệt scope nâng cấp toàn diện cho Whale Analytics Chart, bao gồm:
- chuẩn hóa trải nghiệm biểu đồ Whale Bubble + CVD/Dark Flow,
- sửa các điểm sai lệch nghiệp vụ đang thấy trên chart hiện tại,
- tăng tốc thời gian tải và độ ổn định khi dùng thực tế,
- chuẩn bị kiến trúc để chịu được tải lớn khi nhiều người dùng cùng mở chart.

Đây là bản kế hoạch dùng để duyệt trước khi code. Sau khi được phê duyệt, tài liệu này sẽ là SSOT cho phase triển khai kỹ thuật.

## 2. Tóm tắt điều hành

Whale Analytics Chart hiện có bốn nhóm vấn đề chính:

1. Sai lệch hiển thị và logic chart:
- Trục X chưa khóa chặt theo khung giao dịch 09:00-15:00.
- Ngoài giờ giao dịch chưa dùng snapshot phiên gần nhất một cách nhất quán.
- Trục Y của CVD/Strength chưa đủ ngữ cảnh để người dùng hiểu giá trị thật.
- Thuật toán strength và institutional strength bão hòa 100 quá sớm.
- Màu institutional strength dễ gây nhầm với màu mua.
- Bubble pane chưa có đường giá trong phiên để đối chiếu ngữ cảnh.

2. Hạn chế về kiến trúc dữ liệu:
- Frontend đang over-fetch full session và cả dữ liệu 1 tháng dù chỉ xem khung intraday ngắn.
- Whale Bubble và Dark Flow/CVD còn tách thành 2 request logic lớn.
- Client đang gánh quá nhiều bước normalize, filter, map series và đồng bộ tooltip.

3. Hạn chế về hiệu năng và khả năng scale:
- Polling live 30 giây tạo nguy cơ thundering herd.
- Chưa có snapshot cache hợp nhất theo symbol/timeframe.
- Chưa có request coalescing và precompute cho symbol nóng.

4. Hạn chế về vận hành và audit:
- Chưa có bộ KPI/observability riêng cho chart.
- Chưa có lộ trình rollout/degraded mode rõ ràng khi tải hệ thống tăng cao.

Mục tiêu của v2.0 là chuyển Whale Analytics Chart từ một chart “render được” thành một năng lực phân tích intraday có thể tin cậy, phản ứng nhanh, dễ audit và có đường nâng cấp rõ ràng lên quy mô lớn.

## 3. Phạm vi v2.0

### 3.1 In-scope

- Chuẩn hóa time window và off-hours behavior.
- Sửa logic hiển thị CVD/Strength/Institutional Strength.
- Bổ sung price line trong bubble pane.
- Thiết kế lại API payload theo hướng compact và đúng timeframe.
- Hợp nhất dữ liệu chart thành snapshot endpoint.
- Thêm Redis cache, cache metadata, polling jitter, pause khi tab background.
- Định nghĩa kiến trúc precompute và single-flight cho scale.
- Bổ sung KPI, logging, cache hit metrics, stale metadata.
- Hoàn thiện rollout plan, rollback plan, acceptance criteria.

### 3.2 Out-of-scope cho phase code đầu tiên

- WebSocket/SSE full realtime fan-out production-grade.
- Materialized minute store hoàn chỉnh cho toàn bộ universe ngay từ đầu.
- Viết lại toàn bộ chart bằng thư viện khác.
- Thay đổi sâu toàn bộ hệ thống dark money ngoài phạm vi Whale Analytics Chart.

## 4. Vấn đề hiện tại cần xử lý

### 4.1 Trục X và logic thời gian

Vấn đề:
- Chart còn lệch chuẩn mở cửa giữa frontend và backend.
- Ngoài giờ giao dịch chưa luôn hiển thị phiên giao dịch gần nhất.
- Timeframe nhỏ vẫn bị ảnh hưởng bởi dữ liệu full session rồi mới cắt ở client.

Yêu cầu v2.0:
- Chuẩn hóa session intraday về 09:00-15:00.
- Nếu đang ngoài giờ giao dịch, chart mặc định hiển thị snapshot của phiên giao dịch gần nhất đã hoàn tất.
- Tất cả timeframe `15m`, `30m`, `1h`, `morning`, `afternoon`, `session` phải được resolve từ cùng một contract thời gian.

Quy tắc bắt buộc để tránh tranh cãi khi triển khai:
- Server và client phải dùng cùng một mốc múi giờ chuẩn là `UTC+7` cho toàn bộ `trade_date`, `bucket_ts`, `generated_at` và logic session window.
- Thứ 7, Chủ nhật và ngày nghỉ lễ phải hiển thị phiên giao dịch gần nhất thực sự có dữ liệu, không hiển thị ngày lịch gần nhất nếu ngày đó không có giao dịch.
- Trục X phải là `linear time`, không được nén bỏ khoảng nghỉ trưa hoặc khoảng trống giao dịch chỉ vì không có data.
- Nếu từ `11:30` đến `13:00` không có giao dịch thì chart phải thể hiện một khoảng trắng đúng tỷ lệ thời gian, không nối liền hai điểm để tránh time-distortion.

Quy tắc ATO/ATC và aggregation:
- ATO đầu phiên và ATC cuối phiên là giai đoạn volume đột biến, nên bắt buộc có rule gom bucket riêng để chart không bị vỡ scale.
- Với view `1m`, vẫn giữ bucket phút nhưng áp dụng clamp hiển thị bubble size và soft-cap cho strength.
- Với view `15m`, `30m`, `1h`, các giao dịch ATO/ATC phải được aggregate vào bucket thời gian tương ứng theo `bucket_start`, không được rải giả sang các phút không tồn tại.
- Dev phải xác nhận rõ strategy cho auction buckets: `timestamp hiển thị = thời điểm bucket bắt đầu` và tooltip nêu rõ đây là dữ liệu đã aggregate của bucket đó.

### 4.2 CVD và các đường sức mạnh

Vấn đề:
- Người dùng khó hiểu CVD đang thể hiện độ lớn dòng tiền hay độ mạnh xu hướng.
- Strength và institutional strength đạt 100 quá nhanh trên những bucket có độ tinh khiết cao hoặc volume thấp.
- Cùng một vùng chart đang chứa nhiều tín hiệu nhưng thiếu hệ quy chiếu rõ ràng.

Yêu cầu v2.0:
- Tách bạch ý nghĩa giữa CVD tuyệt đối, normalized strength và institutional strength.
- Giảm bão hòa 100 bằng chuẩn hóa theo rolling baseline hoặc percentile-based scaling.
- Bổ sung metadata giải thích thang đo trong tooltip/legend.

### 4.3 Bubble pane thiếu ngữ cảnh giá

Vấn đề:
- Bubble lớn nhưng người dùng khó biết nó xuất hiện tại vùng giá nào của phiên.
- Không có đường giá khiến việc liên hệ whale order với biến động intraday bị đứt mạch.

Yêu cầu v2.0:
- Vẽ thêm đường giá intraday trên bubble pane.
- Hỗ trợ quy chiếu biến động so với giá tham chiếu và biên độ trong phiên.
- Tooltip phải cho thấy được quan hệ giữa bubble, giá khớp, giá tham chiếu và độ lệch phần trăm.

### 4.4 Hiệu năng và scale

Vấn đề:
- `useWhaleAnalyticsData` đang fetch rộng hơn nhu cầu thực tế.
- Hai endpoint chạy song song cho cùng một chart view.
- Polling 30 giây có thể tạo tải lặp vô ích.
- Chưa có cache snapshot theo symbol/timeframe.

Yêu cầu v2.0:
- Tải đúng cửa sổ dữ liệu đang cần xem.
- Một chart view chỉ nên dùng một snapshot payload logic.
- Backend ưu tiên trả snapshot cache thay vì aggregate lại trên request path.
- Frontend phải dừng polling khi tab background và thêm jitter khi live.

## 5. Kết quả mong muốn sau nâng cấp

### 5.1 Góc nhìn người dùng

- Mở chart nhanh hơn rõ rệt.
- Ngoài giờ xem được đúng phiên trước đó, không thấy chart “nửa sống nửa chết”.
- Dễ phân biệt whale order, CVD, buy strength, institutional strength.
- Có thể nhìn được dòng tiền lớn trong tương quan với đường giá intraday.

### 5.2 Góc nhìn kỹ thuật

- Một API snapshot cho chart.
- Payload nhỏ hơn đáng kể.
- Cache hit ratio cao trên symbol nóng.
- Có degraded mode và stale metadata để không bị timeout hàng loạt.

## 6. Thiết kế sản phẩm v2.0

### 6.1 Bố cục chart

Đề xuất giữ layout 2 pane nhưng định nghĩa lại rõ vai trò:

Pane trên: Whale Bubble + Price Context
- Bubble biểu diễn lệnh whale / extreme order.
- Đường giá intraday overlay nhẹ để người dùng có trục ngữ cảnh giá.
- Tùy chọn trục Y ưu tiên `matched_value` hoặc `volume`, nhưng tooltip luôn hiển thị đầy đủ giá trị tiền và khối lượng.

Pane dưới: Flow Context
- CVD line hoặc positive/negative area.
- Buy strength line.
- Institutional strength line với màu hoàn toàn khác họ màu mua.
- Có chú giải ngắn giải thích công thức chuẩn hóa đang áp dụng.

### 6.2 Quy ước màu sắc

- Mua: xanh lá.
- Bán: đỏ.
- Institutional strength: xanh dương/cyan, không dùng lại tông mua.
- Price line: vàng cam hoặc trắng ngà tùy nền hiện tại, ưu tiên độ tương phản cao nhưng không lấn bubble.
- Extreme order: viền nổi hoặc halo, không chỉ dựa vào đổi màu fill.

### 6.3 Tooltip và legend

Tooltip phải trả lời được 5 câu hỏi:
- Đây là lệnh gì?
- Nó lớn cỡ nào?
- Nó xảy ra ở vùng giá nào?
- Nó đang diễn ra trong bối cảnh CVD/strength nào?
- Dữ liệu này mới đến mức nào?

Nguyên tắc bắt buộc của tooltip v2.0:
- Chỉ hiện tooltip khi hover trực tiếp vào một bubble hoặc một điểm line có marker/hit area hợp lệ.
- Tooltip phải gắn với đúng `timestamp` của điểm đang hover, không được lấy số liệu của phút khác, bucket khác hay điểm gần nhất theo kiểu xấp xỉ mơ hồ.
- Nếu tại thời điểm hover không có bubble thì tooltip bubble không được tự sinh nội dung của lệnh ở thời điểm khác.
- Nếu hover vào line CVD/strength/institutional strength thì chỉ hiển thị dữ liệu của line đó tại đúng thời điểm đang hover, kèm các field ngữ cảnh cùng timestamp nếu thực sự đồng bộ được từ snapshot.
- Không hiển thị đồng thời dữ liệu của nhiều vị trí khác nhau trong cùng một tooltip nếu người dùng chỉ hover vào một điểm duy nhất.
- Không dùng tooltip tổng hợp kiểu “gom cả vùng lân cận” vì dễ tạo hiểu nhầm và quyết định sai cho nhà đầu tư.

Tooltip v2.0 nên có:
- timestamp,
- side,
- matched value,
- volume,
- trade price,
- reference price,
- delta %, 
- strength tại thời điểm đó,
- cache age/stale flag nếu payload không còn realtime tuyệt đối.

Quy tắc hiển thị theo loại hover:
- Hover bubble: ưu tiên thông tin lệnh, giá khớp, giá trị, khối lượng, delta so với tham chiếu, cờ whale/extreme, và chỉ số flow đúng tại timestamp đó.
- Hover line CVD: chỉ hiển thị `CVD` tại timestamp đó, kèm `strength`/`institutional_strength` cùng timestamp nếu snapshot có cùng bucket.
- Hover line strength hoặc institutional strength: chỉ hiển thị giá trị line đang hover tại timestamp đó; không kéo thêm thông tin bubble của timestamp khác.
- Nếu không có dữ liệu hợp lệ tại timestamp đang hover, tooltip phải hiện trạng thái ngắn gọn kiểu `Không có lệnh lớn tại thời điểm này` thay vì bù bằng dữ liệu gần đó.

Hệ quả thiết kế:
- Snapshot payload phải đồng bộ bucket thời gian giữa bubble series, price series và flow series.
- Frontend phải dùng hit-test theo point thay vì formatter tổng hợp theo axis nếu formatter đó làm trộn dữ liệu khác timestamp.
- Cần ưu tiên `trigger='item'` hoặc mô hình hover tương đương cho bubble/line point, chỉ dùng axis pointer như đường dẫn thị giác chứ không phải nguồn ghép dữ liệu tooltip.

## 7. Thiết kế dữ liệu và API

### 7.1 Snapshot endpoint mục tiêu

Đề xuất endpoint hợp nhất:

`GET /api/whale/analytics/{symbol}/?timeframe=15m&compact=1`

Response v2.0 ở mức khái niệm:

```json
{
  "symbol": "HPG",
  "trade_date": "2026-04-24",
  "timeframe": "15m",
  "session": {
    "market_open": "09:00",
    "market_close": "15:00",
    "resolved_from": "latest_completed_session"
  },
  "meta": {
    "generated_at": "2026-04-24T14:31:10+07:00",
    "cache_age_ms": 4200,
    "is_stale": false,
    "degraded_mode": false,
    "data_state": "live"
  },
  "price_series": [],
  "bubble_series": [],
  "flow_series": {
    "cvd": [],
    "buy_strength": [],
    "institutional_strength": []
  },
  "summary": {
    "total_buy_value": 0,
    "total_sell_value": 0,
    "net_cvd": 0,
    "whale_order_count": 0,
    "extreme_order_count": 0
  }
}
```

### 7.2 Quy tắc payload

- Chỉ trả về đúng timeframe được yêu cầu.
- `compact=1` là default path cho chart UI.
- Chỉ giữ field cần để render chart và tooltip.
- Field debug hoặc raw aggregate chỉ trả khi có mode nội bộ riêng.

### 7.3 Metadata bắt buộc

- `generated_at`
- `cache_age_ms`
- `is_stale`
- `data_state`
- `resolved_from`
- `degraded_mode`
- `degraded_reason` nếu có

### 7.4 API cache headers cho phase scale

Backend phải chuẩn bị sẵn contract HTTP để giảm tải client/server ở phase sau:

- `ETag`: cho phép client dùng conditional request và tránh tải lại toàn bộ payload nếu snapshot chưa đổi.
- `Last-Modified`: cho phép client biết chính xác độ mới của snapshot và hỗ trợ debug độ trễ.
- `Cache-Control`: phải phản ánh đúng chiến lược `stale-while-revalidate` hoặc cache ngắn trong giờ giao dịch.

Kỳ vọng kỹ thuật:
- Khi client resume từ background hoặc polling theo chu kỳ, request nên ưu tiên `If-None-Match` hoặc cơ chế tương đương.
- Nếu dữ liệu chưa đổi, server được phép trả `304 Not Modified` thay vì trả lại toàn bộ payload.

## 8. Định hướng thuật toán v2.0

### 8.1 CVD

Đề xuất giữ CVD tuyệt đối như một đại lượng nghiệp vụ thật, nhưng bổ sung:
- nhãn giải thích rõ đây là net flow tích lũy,
- normalization layer riêng cho strength thay vì bóp méo CVD gốc,
- trục hoặc tooltip định dạng theo đơn vị tiền phù hợp.

### 8.2 Strength

Hiện trạng bão hòa 100 quá sớm cần thay bằng một trong hai hướng sau:

Phương án ưu tiên:
- Chuẩn hóa theo rolling baseline intraday.
- Dùng logistic/soft-cap hoặc percentile band để tránh chạm trần sớm.

Công thức định hướng:
- raw flow intensity đo trên tỷ lệ mất cân bằng mua/bán và độ lớn bucket.
- normalized strength = hàm co giãn phi tuyến, có ngưỡng saturation mềm.

Công thức mẫu để đội code không phải tự đoán:

1. Tính cường độ dòng tiền thô theo bucket:

$$
x = w_1 \cdot \left|\frac{buy\_value - sell\_value}{buy\_value + sell\_value + \epsilon}\right| + w_2 \cdot \log\left(1 + \frac{bucket\_value}{baseline\_value + \epsilon}\right)
$$

Trong đó:
- $x$: cường độ dòng tiền thô.
- $bucket\_value$: tổng giá trị khớp của bucket hiện tại.
- $baseline\_value$: rolling median hoặc rolling mean của các bucket trước đó.
- $w_1, w_2$: trọng số, mặc định đề xuất $w_1 = 0.6$, $w_2 = 0.4$.
- $\epsilon$: hằng số nhỏ để tránh chia cho 0.

2. Chuẩn hóa theo percentile trên rolling window:

- Lấy mẫu $N$ bucket gần nhất để làm baseline động.
- Mặc định đề xuất:
  - `N = 30` bucket cho các timeframe ngắn `1m/15m/30m`.
  - `N = 60` bucket cho session live hoặc khi chart đang chạy suốt phiên.
- Tính percentile của $x$ trong cửa sổ $N$ bucket gần nhất.

3. Áp dụng soft-saturation bằng hàm sigmoid:

$$
Strength = \frac{100}{1 + e^{-k \cdot (x - m)}}
$$

Trong đó:
- $m$: rolling baseline hoặc điểm uốn, nơi strength tiến gần 50.
- $k$: hệ số độ dốc, mặc định nên thử trong khoảng $0.8$ đến $1.2$ sau benchmark.

Nguyên tắc nghiệp vụ cần khóa:
- Chỉ khi bucket hiện tại mạnh hơn khoảng `95th percentile` của baseline mới nên tiến gần vùng `90-100`.
- Không cho phép strength chạm 100 hàng loạt chỉ vì bucket nhỏ nhưng “tinh khiết” một phía.
- Nếu volume bucket quá thấp dưới ngưỡng tối thiểu, strength phải bị giảm trọng số hoặc đưa về low-confidence band.

Kỳ vọng:
- 100 chỉ xuất hiện ở bucket thực sự bất thường, không phải chỉ vì mẫu nhỏ nhưng “tinh khiết”.

### 8.3 Institutional strength

Institutional strength phải là thước đo riêng, không chỉ là bản sao màu khác của buy pressure.

Đề xuất:
- dựa trên whale/dark-flow weighted intensity,
- có baseline độc lập,
- hiển thị bằng màu khác hoàn toàn,
- legend giải thích đây là chỉ báo “dòng tiền tổ chức ước lượng”, không phải giá trị mua tuyệt đối.

Định hướng tính toán mẫu:

$$
Institutional\_Raw = \alpha \cdot whale\_ratio + \beta \cdot dark\_flow\_ratio + \gamma \cdot \log(1 + institutional\_value\_multiple)
$$

Sau đó áp dụng cùng pipeline `percentile -> sigmoid soft-saturation` như strength, nhưng bắt buộc dùng baseline riêng để tránh institutional strength trở thành bản sao của buy pressure.

### 8.4 Extreme order

Tiếp tục giữ logic extreme order nhưng cần đồng bộ xuyên suốt giữa:
- bubble highlight,
- summary cards,
- tooltip badges,
- export/debug mode.

## 9. Thiết kế hiệu năng và scale

### 9.1 Quick wins bắt buộc trong phase đầu

- Bỏ over-fetch full session / 1M khi chỉ xem intraday ngắn.
- Dùng snapshot endpoint thay cho 2 request logic riêng.
- Thêm compact payload mode.
- Pause polling khi tab background.
- Thêm polling jitter 0-5 giây.
- Trả metadata `cache_age_ms`, `generated_at`, `is_stale`.
- Off-hours trả snapshot phiên gần nhất.

### 9.1a Logic chuyển tiếp Real-time: Polling -> Snapshot

Đây là phần phải viết rõ để đội code không hiểu sai giữa “live polling” và “snapshot-driven UI”.

Nguyên tắc:
- UI luôn render từ `snapshot` đã chuẩn hóa.
- Polling chỉ là cơ chế làm mới snapshot, không phải cơ chế ghép chắp vá từng phần dữ liệu ở client.

Flow đề xuất:
1. Mở chart lần đầu:
- fetch ngay snapshot mới nhất theo timeframe.
- nếu có cache local hợp lệ thì render tạm snapshot cũ, sau đó silent refresh.

2. Khi tab đang active:
- polling theo chu kỳ cấu hình.
- mọi lần refresh đều thay thế snapshot atomically, không merge từng mảng con gây mismatched data.

3. Khi tab background:
- dừng polling hoàn toàn.

4. Khi tab quay lại focus:
- phải fetch ngay lập tức một snapshot mới nhất.
- không được chờ đến chu kỳ 30 giây tiếp theo.

5. Khi server trả `degraded_mode = true`:
- UI phải giữ snapshot gần nhất và hiện thông báo ngắn gọn như: `Dữ liệu đang được làm mới, có thể chậm khoảng 30 giây`.

### 9.1b Resume logic và state safety

- Khi chuyển timeframe `15m -> 1h` hoặc đổi symbol, state cũ phải bị vô hiệu hóa ngay để tránh `râu ông nọ chắp cằm bà kia`.
- Cache key ở frontend phải bao gồm ít nhất `symbol + timeframe + trade_date + profile`.
- Chỉ update state nếu response khớp với request context hiện tại; response cũ về muộn phải bị bỏ qua.

### 9.2 Backend cache và chống stampede

- Redis key theo `symbol + trade_date + timeframe + profile`.
- Single-flight/request coalescing khi cache miss.
- TTL khác nhau cho trong giờ, nghỉ trưa và ngoài giờ.
- Có stale-while-revalidate nếu snapshot vừa hết hạn nhẹ.

### 9.3 Hướng scale tiếp theo

- Precompute snapshot cho symbol nóng mỗi 5-15 giây.
- Theo dõi top symbol được xem nhiều để ưu tiên làm nóng cache.
- Chuẩn bị minute-level snapshot store để giảm aggregate online.
- Khi đủ nhu cầu, nâng lên SSE/WebSocket fan-out cho delta updates.

### 9.4 Cơ chế Sync Tooltip & Crosshair

Đây là yêu cầu kỹ thuật bắt buộc cho frontend khi chart có 2 pane.

Logic:
- Khi `mousemove` hoặc hover trên pane trên, frontend phát event đồng bộ chứa `timestamp` của điểm đang hover.
- Pane dưới lắng nghe event đó và dựng vertical crosshair tại đúng `timestamp` tương ứng.
- Chiều ngược lại cũng áp dụng khi hover từ pane dưới lên pane trên.

Nguyên tắc:
- Crosshair là công cụ đối chiếu thời gian giữa 2 pane.
- Tooltip vẫn phải tuân thủ rule point-anchored, không vì crosshair sync mà suy diễn dữ liệu ngoài điểm hover.

### 9.5 Logic xử lý data gap

- Chart phải giữ trục X dạng linear time cho toàn bộ session.
- Khoảng nghỉ trưa hoặc giai đoạn không có giao dịch phải hiển thị gap, không nối liền line bằng nội suy gây hiểu lầm.
- Nếu `bubble_series` tại thời điểm $T$ rỗng nhưng `flow_series` có dữ liệu, tooltip phải hiện flow tại $T$ và ẩn riêng phần bubble.

## 10. Chỉ tiêu mục tiêu

### 10.1 KPI sản phẩm

- Người dùng cảm nhận chart mở nhanh và ổn định.
- Không còn nhầm lẫn màu institutional strength với dòng mua.
- Tooltip đủ ngữ cảnh để giải thích hành vi whale.

### 10.2 KPI kỹ thuật

- P50 first chart data ready < 1.2s.
- P95 first chart data ready < 2.5s.
- P95 snapshot API response < 300ms khi cache nóng.
- Giảm 60-80% payload bytes với các timeframe ngắn.
- Cache hit ratio >= 80% trên symbol nóng trong giờ giao dịch.

### 10.3 Checklist nghiệm thu nhanh cho QA/QC

| Tính năng | Trạng thái đạt |
|-----------|----------------|
| Time Window | Chart luôn bắt đầu từ 09:00, kết thúc 15:00 bất kể dữ liệu có trống hay không |
| Holiday/Weekend | Ngoài ngày giao dịch, chart hiển thị phiên gần nhất có dữ liệu |
| Price Line | Đường giá chạy đè lên bubble pane và vẫn nhìn rõ cả price lẫn bubble |
| Color | Institutional Strength dùng màu khác biệt hoàn toàn với Buy/Sell |
| Tooltip | Tooltip chỉ hiện dữ liệu của đúng bubble/line point đang hover |
| Background Tab | Network tab không phát sinh polling khi tab browser bị ẩn |
| Resume | Khi quay lại tab, hệ thống fetch snapshot mới ngay lập tức |
| Data Gap | Khoảng nghỉ trưa hiển thị gap trên trục X, không bị nối line giả |
| Degraded Mode | UI hiện thông báo dữ liệu chậm thay vì hiển thị dữ liệu gây hiểu nhầm |

## 11. Kế hoạch triển khai theo phase

### Phase 0 — Chốt thiết kế và contract

Mục tiêu:
- khóa scope v2.0,
- chốt API contract,
- chốt quy tắc time window, off-hours, color semantics, strength normalization direction.

Đầu ra:
- tài liệu kế hoạch này được duyệt,
- decision log cho các điểm cần chốt,
- taskboard triển khai.

### Phase 1 — Sửa đúng hành vi chart hiện tại

Mục tiêu:
- chuẩn hóa trục X 09:00-15:00,
- xử lý off-hours = phiên gần nhất,
- thêm price line,
- chỉnh màu institutional strength,
- chỉnh legend/tooltip để người dùng hiểu đúng tín hiệu.

Tác động mong đợi:
- chart đúng hơn ngay lập tức ở mặt nghiệp vụ và UX.

Ưu tiên thực thi trong Phase 1:
- Ưu tiên số 1: khóa trục X đúng session time.
- Ưu tiên số 2: sửa màu institutional strength để tránh hiểu nhầm ngay lập tức.
- Đây là nhóm thay đổi low-effort nhưng high-impact, cần triển khai trước để người dùng thấy chart “đúng” ngay.

### Phase 2 — Sửa contract dữ liệu và hiệu năng nền

Mục tiêu:
- bỏ over-fetch,
- hợp nhất snapshot endpoint,
- compact payload,
- cache metadata,
- pause polling + jitter.

Tác động mong đợi:
- giảm rõ rệt thời gian tải và CPU phía client.

### Phase 3 — Cache và scale trung hạn

Mục tiêu:
- Redis snapshot cache,
- single-flight,
- stale-while-revalidate,
- observability cho cache/payload/latency.

Tác động mong đợi:
- chịu tải tốt hơn với số lượng người dùng tăng mạnh.

### Phase 4 — Scale lớn và tối ưu sâu

Mục tiêu:
- precompute symbol nóng,
- minute snapshot store,
- SSE/WebSocket nếu cần,
- degraded mode theo tình trạng hệ thống.

Tác động mong đợi:
- tối ưu hệ thống theo số symbol nóng thay vì theo số user đang xem.

## 12. Rủi ro và phương án kiểm soát

### 12.1 Rủi ro nghiệp vụ

- Strength mới có thể làm thay đổi cảm nhận của user cũ.
- Nếu không giải thích kỹ, người dùng có thể hiểu nhầm institutional strength là dòng tiền mua tuyệt đối.

Kiểm soát:
- tooltip/legend phải nêu rõ ý nghĩa chỉ báo,
- rollout có so sánh trước/sau trên bộ mã mẫu.

### 12.2 Rủi ro kỹ thuật

- Hợp nhất API có thể làm tăng complexity ở backend nếu không tách service rõ.
- Cache sai key hoặc sai TTL có thể gây stale data khó debug.

Kiểm soát:
- thiết kế key chuẩn hóa,
- metadata stale rõ ràng,
- log cache hit/miss và generation time.

### 12.3 Rủi ro rollout

- Nếu triển khai quá nhiều thay đổi cùng lúc, khó tách nguyên nhân khi có lỗi.

Kiểm soát:
- rollout theo phase,
- có feature flag cho snapshot endpoint hoặc chart v2,
- giữ đường rollback về contract cũ trong thời gian chuyển tiếp.

## 13. Kiểm thử và xác nhận

### 13.1 Test nghiệp vụ

- Ngoài giờ giao dịch phải trả snapshot phiên gần nhất.
- Trục X luôn khóa đúng 09:00-15:00.
- Price line khớp với dữ liệu intraday.
- Strength không còn chạm 100 dày đặc trên bucket thông thường.
- Institutional strength có màu và legend riêng.
- Hover bubble chỉ hiện dữ liệu của chính bubble đó tại đúng timestamp đang trỏ.
- Hover line chỉ hiện dữ liệu của point line tại đúng timestamp, không lẫn số liệu của điểm khác.
- Khi timestamp không có bubble, tooltip không được tái sử dụng thông tin lệnh từ thời điểm khác.

### 13.2 Test hiệu năng

- So sánh payload size trước/sau theo từng timeframe.
- Đo P50/P95 thời gian mở chart.
- Đo cache hit ratio cho symbol nóng.
- Mô phỏng burst nhiều user cùng mở một mã.

### 13.3 Test vận hành

- Khi cache miss hàng loạt, chỉ một luồng được build snapshot.
- Khi backend chậm, chart vẫn hiện stale snapshot với metadata rõ ràng.
- Khi tab background, polling phải dừng.
- Tooltip không được suy diễn chéo bucket khi payload thiếu hoặc lệch timestamp; trường hợp đó phải fail-safe bằng thông điệp ngắn gọn.

## 14. Checklist dành riêng cho Lead Developer

Lead Dev phải xác nhận trước khi code:

1. Data Structure
- Payload snapshot đã đủ gọn chưa.
- Có thể dùng cấu trúc mảng phẳng cho series nặng thay vì lặp key object nếu benchmark cho thấy lợi ích rõ rệt.

2. State Management
- Cache key đã bao gồm đủ `symbol`, `timeframe`, `trade_date`, `profile` chưa.
- Khi đổi timeframe hoặc symbol, state cũ có bị vô hiệu hóa để tránh mismatched data không.

3. Error Handling
- Nếu API trả `degraded_mode: true`, UI sẽ hiện thông báo gì.
- Nếu API thiếu bubble tại timestamp đang hover nhưng flow còn đủ, tooltip có ẩn riêng phần bubble thay vì báo sai không.

4. Session & Time Rules
- Toàn bộ layer đã thống nhất `UTC+7` chưa.
- Weekend/holiday đã fallback đúng phiên gần nhất có dữ liệu chưa.
- Auction buckets ATO/ATC đã có rule gom và hiển thị nhất quán chưa.

5. Frontend Interaction
- Crosshair sync hai pane đã dùng chung `timestamp` chưa.
- Tooltip có đang là `trigger=item` hoặc cơ chế tương đương thay vì axis formatter trộn dữ liệu không.

## 15. Điều kiện phê duyệt

Tôi đề xuất dùng tài liệu này để duyệt 6 quyết định chính:

1. Có chốt Whale Analytics Chart v2.0 là một scope hợp nhất gồm cả UX/chart logic và hiệu năng/scale hay không.
2. Có chấp nhận hướng snapshot endpoint hợp nhất thay cho 2 request logic hiện tại hay không.
3. Có chốt off-hours luôn hiển thị phiên giao dịch gần nhất hay không.
4. Có chốt bổ sung price line trên bubble pane hay không.
5. Có chốt strength/institutional strength chuyển sang hướng normalization mềm, tránh bão hòa 100 sớm hay không.
6. Có chốt rollout theo 4 phase như trên hay muốn dồn thành 2 đợt lớn.

## 16. Đề xuất phê duyệt

Đề xuất duyệt theo cấu hình sau:

- Duyệt toàn bộ Phase 0, Phase 1, Phase 2 trong đợt triển khai đầu tiên.
- Duyệt thiết kế trước cho Phase 3, nhưng chỉ code khi benchmark xác nhận cần thiết.
- Phase 4 giữ ở mức roadmap sau khi hệ thống có tín hiệu tải thực tế cao.

Lý do:
- Đây là điểm cân bằng tốt nhất giữa tốc độ ra kết quả, độ đúng nghiệp vụ và chi phí triển khai.
- Nếu chỉ sửa UI/chart mà không sửa contract dữ liệu, chart vẫn chậm.
- Nếu nhảy thẳng lên scale lớn mà chưa chuẩn hóa hành vi chart, rủi ro scope phình to và khó nghiệm thu.

## 17. Kết luận

Whale Analytics Chart v2.0 không nên được hiểu là một lần “tút lại giao diện”, mà là một đợt nâng cấp nền tảng phân tích intraday theo ba lớp cùng lúc:
- đúng hơn về mặt nghiệp vụ,
- rõ hơn về mặt trực quan,
- mạnh hơn về mặt hiệu năng và scale.

Nếu duyệt đúng theo cấu trúc của tài liệu này, team có thể triển khai theo phase nhỏ nhưng vẫn giữ được một kiến trúc đích rõ ràng, tránh sửa rời rạc từng lỗi đơn lẻ rồi lại phải làm lại từ đầu.

Lời nhắn cho đội code:
- Mục tiêu của v2.0 là sự tin cậy.
- Thà hiển thị `Không có dữ liệu` còn tốt hơn hiển thị dữ liệu sai hoặc dữ liệu gây hiểu lầm.
- Tooltip là pháp lý của dữ liệu, phải chính xác theo đúng điểm hover và đúng timestamp của dữ liệu đang được hiển thị.
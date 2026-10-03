# Whale Alerts Master Document

## Mục đích tài liệu

Tài liệu này là nguồn tham chiếu duy nhất cho Whale Alerts trong dự án VNInvest, gộp cả 3 lớp nội dung trước đây:
- hiện trạng chức năng và kiến trúc đang có,
- các điểm hardening đã thực hiện,
- roadmap sản phẩm, intelligence và admin cho các sprint tiếp theo.

## 1. Hiện trạng hiện tại

### 1.1 Mục tiêu chức năng hiện tại

WhaleAlertsDashboard là màn phân tích chuyên sâu theo từng mã cổ phiếu cho luồng whale alert của dự án VNInvest. Mục tiêu hiện tại của màn này là biến một tín hiệu giao dịch lớn thành bối cảnh hành động rõ ràng: lệnh nào vừa xảy ra, money flow đang nghiêng về đâu, khối lượng có đột biến hay không, và sổ lệnh đang hình thành tường mua hoặc tường bán ở đâu.

Route chính:
- `/whale-alerts/:symbol`

Điểm vào tổng quát:
- `/whale-alerts`

### 1.2 Thành phần frontend hiện có

File chính:
- `frontend/src/pages/WhaleAlertsDashboard.jsx`

Các panel trong trang:
- `WhaleFeedPanel`: hiển thị whale orders từ REST feed, đồng thời chèn tối đa 3 WebSocket alerts mới nhất của đúng mã lên đầu danh sách.
- `MoneyFlowDonut`: hiển thị tỷ trọng dòng tiền theo 3 lớp shark, whale, small; đồng thời cho biết tổng mua, tổng bán và flow ròng.
- `BubbleOrderChart`: mô tả phân bố các lệnh lớn theo giá và kích thước giao dịch.
- `RVOLChartPanel`: hiển thị khối lượng theo bucket 15 phút, SMA20 nội phiên và cờ spike khi RVOL >= 2.
- `DepthChartPanel`: dựng độ sâu thị trường rút gọn từ bid/ask và đánh dấu tường lệnh.

Hành vi realtime:
- Sử dụng `useRealtimeFeed.js` làm nguồn realtime duy nhất.
- Nhận `whale_alert`, `ticker_update`, `heartbeat` từ WebSocket.
- Khi có whale alert mới của đúng mã, dashboard tự gọi lại whale feed để đồng bộ snapshot.
- Có auto-refresh REST feed mỗi 60 giây.

### 1.3 Backend hiện phục vụ dashboard như thế nào

Endpoints chính:
- `GET /api/realtime/whale-feed/:symbol/`
- `GET /api/realtime/rvol/:symbol/`
- `GET /api/realtime/depth-chart/:symbol/`

WhaleFeedView hiện:
- Ưu tiên Redis Stream intraday nếu có, fallback về `vnbroker.quote.intraday()` nếu cần.
- Đọc `whale_alert_threshold` từ `UserConfig` của user.
- Quy đổi threshold từ triệu VND sang VND.
- Tính `matched_value = price * volume` cho từng tick intraday.
- Chuẩn hóa side thành `buy`, `sell`, `neutral`.
- Phân loại `shark`, `whale`, `small` theo giá trị giao dịch.
- Trả về summary gồm `buy_value`, `sell_value`, `flow_net`, `shark_value`, `whale_value`, `small_value` và tỷ trọng phần trăm.

RVOLView hiện:
- Resample intraday theo bucket 15 phút.
- Tính SMA20 nội phiên.
- Tính RVOL và gắn cờ `is_spike` khi RVOL >= 2.

DepthChartView hiện:
- Đọc `price_board` từ vnbroker.
- Dùng 3 mức bid và 3 mức ask gần nhất.
- Tính cumulative volume cho mỗi phía.
- Xác định tường lệnh khi volume ở một mức giá vượt ngưỡng so với trung bình các mức hiện có.

### 1.4 Tích hợp với realtime và AI Advisory

Hệ whale detection đầy đủ hiện gồm 3 lớp:
- Celery realtime task phát hiện whale signal.
- WebSocket phát `whale_alert` theo symbol.
- Celery advisory task tạo AI Advisory và phát `whale_advisory` sau đó.

WhaleAlertsDashboard hiện tập trung vào phân tích giao dịch lớn và trực quan hóa. AI Advisory là module riêng ở route `/ai-advisory`, có phân quyền theo plan; legacy `/whale-advisory` alias đã được retire.

### 1.5 Data flow định hướng cho giai đoạn intelligence

Để hiện thực hóa đầy đủ các lớp như Whale Score, Intent, Crowding Level và Realtime Refresh nâng cao, pipeline không thể chỉ là chuỗi request-response đơn giản. Kiến trúc nên vận hành theo 2 lớp:
- lớp ingest và detect gần realtime,
- lớp stateful intelligence để suy luận trong cửa sổ thời gian ngắn.

Điểm mấu chốt:
- `stateful processing`: các bài toán như `trade_cluster`, `intent`, `crowding_level` cần giữ trạng thái ngắn hạn của tick stream gần nhất.
- `feedback loop`: thay đổi ở Prompt Studio và AI QC phải tác động lại trực tiếp vào inference layer mà không cần chạm vào code core.

Quyết định kỹ thuật bổ sung:
- Nên dùng Redis theo kiểu sliding window state hoặc Redis TimeSeries cho các cửa sổ ngắn, thay vì query ngược DB giao dịch ứng dụng cho mỗi signal.
- Mỗi symbol nên có state ngắn hạn riêng, ví dụ 30 giây, 2 phút, 5 phút, để đủ vật liệu tính score và context mà không làm chậm pipeline chính.
- State cho từng symbol phải có TTL rõ ràng để tránh memory leak trong phiên giao dịch dài.
- Detection pipeline và AI pipeline cần tách biệt: detection phải ưu tiên độ trễ thấp, AI có thể chạy async nhưng phải gắn lại cùng event id.
- Prompt Studio, Prompt A/B và Human Override tạo thành một vòng feedback khép kín cho AI layer, cần được coi là một phần chính thức của kiến trúc chứ không phải công cụ phụ trợ.

## 2. Hardening đã thực hiện

### 2.1 Cache whale feed theo user threshold

Vấn đề cũ:
- Cache key chỉ dùng symbol.
- Trong khi threshold whale feed lấy theo `UserConfig` của từng user.
- Hệ quả là nhiều user khác ngưỡng có thể nhận cùng một response trong thời gian cache còn sống.

Đã vá:
- Cache key mới gồm `user_id`, `symbol`, `threshold_vnd`.

### 2.2 Route gốc `/whale-alerts`

Vấn đề cũ:
- Link `Xem tất cả` ở Radar Realtime dẫn về `/whale-alerts`.
- Route này redirect ngay về `/watchlist`, nên không có entry point thực sự cho Whale Alerts.

Đã vá:
- Tạo Whale Alerts Hub làm trang vào chung của module.
- Hub hiển thị shortcut theo mã tracked và preview AI Advisory nếu plan cho phép.

### 2.3 Độ bền alert feed trên dashboard radar

Vấn đề cũ:
- Dashboard radar chỉ giữ `maxAlerts = 5`.
- Khi nhiều mã cùng phát alert, event có thể bị đẩy khỏi feed quá sớm.

Đã vá:
- Tăng lên `maxAlerts = 20` trong dashboard radar.

### 2.4 Điểm mạnh hiện tại

- Có dashboard chuyên sâu theo mã, không dừng ở card alert đơn giản.
- Kiến trúc hybrid giữa WebSocket và REST hợp lý cho realtime trading UI.
- Có phân tầng rõ ràng giữa whale feed, order visualization, RVOL và depth chart.
- Có AI layer riêng cho người dùng Pro/Premium.

### 2.5 Hạn chế còn tồn tại

- Chưa có test frontend riêng cho WhaleAlertsDashboard.
- RVOL và depth chart hiện vẫn thiên về snapshot nội phiên hơn là realtime liên tục.
- Depth chart mới dùng độ sâu rút gọn 3 mức bid/ask, chưa phải full order book.
- Whale Alerts Hub hiện là entry point và điều hướng tốt hơn, nhưng chưa phải aggregate board hoàn chỉnh cho toàn module.

## 3. Tầm nhìn sản phẩm

Nâng Whale Alerts từ mức dashboard phân tích theo mã lên thành một module intelligence hoàn chỉnh gồm:
- phát hiện nhanh,
- điều hướng tốt,
- lịch sử đủ dài,
- AI commentary có thể hành động,
- observability rõ cho backend realtime.

## 4. Sprint 14

### 1. Aggregate feed toàn module

Mục tiêu:
- Có trang tổng hợp whale signal gần đây trên nhiều mã, không chỉ hub điều hướng.

Công việc:
- Thêm endpoint `GET /api/realtime/whale-feed/aggregate/`.
- Hỗ trợ filter theo danh sách symbol tracked hoặc nhóm watchlist của user.
- Trả về `symbol`, `side`, `matched_value`, `threshold`, `ts`, `size_class`, `source`.
- Cho phép sort theo `ts` hoặc `matched_value`.

Quyết định kỹ thuật:
- Aggregate feed không nên đọc trực tiếp từ bộ nhớ tạm của WebSocket consumer hoặc state frontend. Nó cần một event source ổn định ở backend để phân trang, backfill và đối soát được.
- Nguồn đọc khuyến nghị cho Sprint 14 là event store tối thiểu theo symbol và timestamp, có thể là Redis Stream đã chuẩn hóa thêm metadata hoặc một bảng persistence nhẹ cho whale events gần realtime.
- Dùng cursor-based pagination thay cho page-number pagination.
- Cursor nên dựa trên cặp khóa ổn định như `created_at` + `id` hoặc `ts` + `sequence` để tránh duplicate hoặc missing item khi user đang scroll mà alert mới vẫn tiếp tục đổ về.
- Response nên hỗ trợ shape kiểu feed realtime: `results`, `next_cursor`, `has_more`, `server_time`.
- Nếu có sắp xếp theo `matched_value`, vẫn cần secondary sort key ổn định để đảm bảo paging deterministic.
- Nên tách rõ 2 mode đọc dữ liệu:
	- `latest`: tối ưu cho feed gần realtime
	- `history`: tối ưu cho truy vết sâu hơn khi user kéo xuống cuối

Điểm chốt phạm vi:
- Sprint 14 chỉ nên làm aggregate feed cho dữ liệu whale event đã detect xong.
- Chưa nên nhồi thêm replay hoặc score backtest vào cùng endpoint này để tránh API bị gánh quá nhiều trách nhiệm ngay từ đầu.

Kết quả mong đợi:
- Route `/whale-alerts` trở thành live aggregate board thực sự.

### 2. Đồng bộ entitlement rõ giữa Whale Alerts và AI Advisory

Mục tiêu:
- Phân biệt rành mạch giữa data feed cơ bản và AI layer trả phí.

Công việc:
- Free/basic: xem aggregate alerts + dashboard theo mã.
- Pro: mở AI summary inline.
- Premium: mở AI detail inline và lịch sử advisory sâu.
- Bổ sung badge entitlement trực tiếp trên hub và dashboard.

Quyết định kỹ thuật:
- Không nên query DB kiểm tra plan ở mỗi request feed khi user đang lướt liên tục.
- Cần cache entitlement ở backend bằng Redis hoặc encode trực tiếp vào JWT/custom claim nếu vòng đời token phù hợp.
- Nếu dùng cache backend, key nên gắn với `user_id` và version của plan state để dễ invalidation khi user nâng gói.
- Nếu dùng JWT claim, cần chấp nhận eventual consistency ngắn hạn hoặc bắt buộc rotate token ngay sau khi upgrade plan.
- Nên có helper backend thống nhất như `resolve_user_entitlements(user)` để mọi endpoint whale/advisory dùng chung một contract, tránh lệch logic giữa API list, WebSocket masking và UI routing.
- Cần thêm metric theo dõi cache hit ratio cho entitlement lookup để tránh một tối ưu giả tạo nhưng khó quan sát.

Khuyến nghị chốt hướng:
- Mặc định nên chọn `Redis-backed entitlement resolver` làm hướng triển khai đầu tiên.
- JWT/custom claim chỉ nên là bước tối ưu tiếp theo nếu thực tế cho thấy entitlement lookup vẫn là điểm nghẽn.
- Lý do là Redis giúp invalidation khi nâng gói hoặc đổi feature flag đơn giản hơn nhiều so với vòng đời token.

### 3. Frontend test coverage

Mục tiêu:
- Chốt regression cho 2 màn chính.

Công việc:
- Test render WhaleAlertsHub.
- Test WhaleAlertsDashboard với mock WebSocket + REST.
- Test route `/whale-alerts` và `/whale-alerts/:symbol`.

## 5. Sprint 15

### 1. Realtime RVOL và depth refresh chiến lược

Mục tiêu:
- Giảm độ trễ giữa feed whale và biểu đồ phụ trợ.

Công việc:
- Trigger refresh RVOL khi có volume jump đủ lớn.
- Trigger refresh depth chart theo throttle 5 đến 10 giây khi market đang mở.
- Bổ sung stale badge cho từng panel.

Quyết định kỹ thuật:
- Thay vì chỉ throttle cố định, áp dụng adaptive throttling theo mức độ nghiêm trọng của signal.
- Nếu `whale_score` đạt mức `extreme`, depth chart refresh ngay lập tức và được phép bypass throttle một lần để user thấy biến động orderbook tức thời.
- Nếu severity thấp hoặc thị trường lặng, có thể nới refresh interval để giảm call vnbroker và tải UI.
- Nên tách refresh policy thành hàm riêng, ví dụ `getDepthRefreshPolicy(severity, marketState, lastRefreshAt)` để dễ test và tuning.
- Với depth refresh nóng, cần có request coalescing hoặc dedupe ở frontend để tránh bắn nhiều request chồng nhau khi nhận burst alerts.

Kết quả mong đợi:
- Dashboard nhất quán hơn với event vừa xảy ra.

### 2. Whale score và signal ranking

Mục tiêu:
- Không chỉ hiển thị từng lệnh lớn, mà xếp hạng độ quan trọng của tín hiệu.

Công việc:
- Xây `whale_score` dựa trên matched value, RVOL, side imbalance, wall proximity.
- Hiển thị ranking top signals trong ngày.
- Tạo alert severity: low, medium, high, extreme.
- Bổ sung các thuộc tính data-level mang tính ngữ cảnh để trader hiểu nhanh chất lượng tín hiệu.

Quyết định kỹ thuật:
- Bổ sung trọng số `time_decay` để tín hiệu cũ tự giảm giá trị theo thời gian.
- Một signal cách đây 30 phút phải có ảnh hưởng thấp hơn đáng kể so với signal cách đây 30 giây trong ranking realtime.
- Công thức ban đầu nên giữ đơn giản và giải thích được, ví dụ:
	- `whale_score = size_weight + rvol_weight + imbalance_weight + wall_weight + freshness_weight`
	- trong đó `freshness_weight` là hàm suy giảm theo thời gian.
- Có thể bắt đầu với exponential decay hoặc piecewise decay trước khi chuyển sang model tinh hơn.
- Severity mapping nên dựa trên score band ổn định và phải có telemetry để hiệu chỉnh sau khi chạy thực tế.

Chuẩn hóa công thức score:
- Để `whale_score` khách quan và có thể so sánh xuyên phiên, nên chuẩn hóa toàn bộ về thang 100.
- Công thức đích nên theo dạng:

$$
WhaleScore = \sum_{i=1}^{n} (w_i \cdot f_i(x)) \cdot Decay(t)
$$

Trong đó:
- $w_i$: trọng số của từng yếu tố như Size, RVOL, Imbalance, Wall Proximity, Intent Evidence.
- $f_i(x)$: hàm chuẩn hóa đầu vào về dải $[0,1]$.
- $Decay(t) = e^{-\lambda \Delta t}$: hàm suy giảm theo thời gian để đảm bảo tính thời sự.

Lưu ý mô hình:
- Không nên đưa `intent` vào score ngay ở phiên bản đầu nếu `intent` lại được suy ra từ chính score hoặc các feature phụ thuộc score, vì sẽ tạo vòng lặp logic.
- Score v1 nên dựa trên feature khách quan hơn như size, aggressiveness, RVOL, imbalance, wall proximity.
- `intent` nên là lớp suy luận riêng, sau khi ổn định mới cân nhắc đưa `intent evidence` vào score v2 hoặc score explainability layer.

Nguyên tắc triển khai:
- Mỗi feature đưa vào score phải được chuẩn hóa độc lập trước khi cộng trọng số, tránh để một đại lượng có scale lớn áp đảo toàn bộ score.
- Nên lưu cả `raw_features`, `normalized_features` và `score_breakdown` để admin có thể giải thích vì sao một signal được chấm điểm cao hoặc thấp.
- Các band severity như low, medium, high, extreme nên được map từ score 0-100 bằng config thay vì hardcode trong UI.

Thiết kế scoring service:
- Backend nên có một service riêng, ví dụ `calculate_whale_score(trade, context, weights)`, thay vì nhúng logic trực tiếp trong view hoặc consumer.
- Service này phải đọc weights từ admin-config runtime để support Sprint 14 `Scoring Rules`.
- Score nên được tách thành 2 lớp:
	- `event_score`: điểm tại thời điểm signal xảy ra, không decay
	- `display_score`: điểm đã decay theo thời gian để dùng cho aggregate feed hoặc ranking realtime

Các thành phần nên có trong score service:
- `size_impact`: quy đổi giá trị lệnh so với baseline whale value của mã hoặc bucket thanh khoản.
- `aggression_bonus`: thưởng điểm nếu lệnh sweep vào ask hoặc bid đủ mạnh.
- `rvol_bonus`: cộng điểm khi context volume đang nóng.
- `wall_proximity_bonus`: cộng điểm khi signal xảy ra gần vùng thanh khoản dày có ý nghĩa.
- `time_decay`: chỉ áp dụng cho ranking hiển thị, không làm biến dạng lại event gốc trong lưu trữ lịch sử.

Ranh giới trách nhiệm:
- `calculate_event_score(...)`: cho điểm tại thời điểm detect.
- `calculate_display_score(...)`: áp dụng decay và ranking context cho UI aggregate.
- `classify_intent(...)`: classifier riêng, không nằm chung một hàm với score để dễ kiểm thử và rollback.

Yêu cầu implementation:
- Nên lưu `weights_version` cùng score để sau này backtest biết signal được tính theo phiên bản rule nào.
- Score service cần deterministic: cùng input, cùng weights phải cho cùng output.
- Mọi field tham gia score cần có floor và ceiling rõ ràng để tránh score bùng nổ khi dữ liệu đầu vào bất thường.

Thuộc tính signal nên bổ sung:
- `aggressiveness`: đo độ quyết liệt của lệnh dựa trên việc khớp vào bid hay ask, hoặc mức sweep qua nhiều level orderbook.
- `trade_cluster`: phân loại đây là single print hay cụm lệnh ngắn kiểu iceberg/algo.
- `concentration_ratio`: tỷ trọng của whale signal so với tổng volume của nến hiện tại và của cả phiên.
- `distance_to_wall`: khoảng cách từ giá khớp tới buy wall hoặc sell wall gần nhất.
- `wall_interaction`: cho biết whale đang tiến gần, đâm xuyên hay bị hấp thụ bởi wall.

Yêu cầu backend:
- `aggressiveness` cần dựa trên dữ liệu intraday + side inference đáng tin cậy, tránh gắn nhãn quá mạnh nếu nguồn dữ liệu không đủ chi tiết.
- `trade_cluster` nên được tính bằng clustering theo `symbol`, `side`, khoảng thời gian ngắn và price band gần nhau.
- `concentration_ratio` nên trả về cả giá trị số và context window, ví dụ `ratio_of_5m_volume`, `ratio_of_session_volume`.
- `distance_to_wall` cần dùng cùng một snapshot orderbook hoặc snapshot gần nhất để tránh so sánh lệch thời điểm.

Định hướng product:
- Đây là lớp dữ liệu rất phù hợp với user trader ngắn hạn và nhà đầu tư chủ động vì nó chuyển một con số `matched_value` khô sang ngữ nghĩa giao dịch cụ thể hơn.
- Với tệp người dùng hiện tại của VNInvest, nhóm thuộc tính này là hợp lý, nhưng nên rollout theo thứ tự: `aggressiveness` và `concentration_ratio` trước, `trade_cluster` và `wall_interaction` sau.

### 3. Whale contextual analysis

Mục tiêu:
- Trả lời câu hỏi thực dụng nhất cho trader: whale xuất hiện lúc này có ý nghĩa gì trong bối cảnh giá hiện tại.

Công việc:
- Tự động gán `intent` cho alert theo ngữ cảnh giá, volume và orderbook.
- Tính `crowding_level` để đo xem retail có đang đu bám sau whale signal hay không.
- Hiển thị intent badge trực tiếp trên feed, bubble chart và advisory card.

Intent taxonomy giai đoạn đầu:
- `ABSORPTION`: whale xuất hiện ở vùng hỗ trợ nhưng giá không giảm thêm, thiên về hấp thụ cung.
- `BREAKOUT_CATALYST`: whale đẩy giá vượt kháng cự cùng RVOL cao.
- `DISTRIBUTION`: whale liên tục xuất hiện gần vùng đỉnh nhưng giá không mở rộng tăng tương xứng.
- `STOP_LOSS_HUNTING`: whale quét nhanh qua vùng thanh khoản mỏng rồi giá rút chân mạnh.

Quyết định kỹ thuật:
- `intent` không nên dựa trên một signal đơn lẻ. Nên dùng cửa sổ ngắn gồm price action, RVOL, wall interaction và follow-through sau alert.
- `crowding_level` có thể bắt đầu bằng cách đo tỷ lệ lệnh nhỏ theo sau whale signal trong 30 giây đến 3 phút tiếp theo.
- Cần coi `intent` là inference có xác suất, không phải ground truth. Nên trả thêm `confidence` hoặc `evidence_count`.
- Nếu tín hiệu không đủ dữ liệu để phân loại, hệ thống nên trả `intent = neutral` hoặc `unknown` thay vì ép gán nhãn.

Heuristic định lượng cho `crowding_level`:
- Có thể bắt đầu bằng rule đơn giản, dễ kiểm chứng:
	- đếm số transaction có giá trị nhỏ hơn 50 triệu VND trong cửa sổ 2 phút sau khi whale alert phát hành,
	- so sánh với baseline rolling của chính mã đó.
- Nếu số lượng lệnh nhỏ tăng mạnh so với baseline, `crowding_level` tăng tương ứng.
- Nếu `crowding_level` đạt mức rất cao, advisory nên phát cảnh báo kiểu: tín hiệu đang quá đông đu bám, rủi ro rung lắc hoặc shakeout cao.

Yêu cầu dữ liệu:
- Baseline nên được tính theo intraday seasonality của từng mã, tránh so sánh phiên sáng thanh khoản cao với đoạn cuối phiên lặng.
- `crowding_level` nên trả về cả label và evidence, ví dụ `crowding_label`, `retail_count`, `baseline_count`, `surge_ratio`.

Yêu cầu UI:
- Badge intent phải đọc nhanh được trong 1 giây, không dùng label quá học thuật.
- Crowding level nên hiển thị như low, medium, high kèm tooltip giải thích nguy cơ bị rũ bỏ.

### 4. Visual aids và decision support UI

Mục tiêu:
- Giúp user nhìn phát hiểu ngay thay vì phải đọc nhiều bảng số.

Công việc:
- Thêm `Whale Heatmap Overlay` lên biểu đồ giá.
- Thêm `Pressure Gauge` để so sánh lực whale mua hoặc bán ngắn hạn với baseline dài hơn.
- Đánh dấu `Liquidity Void` sau các cú sweep lớn.

Quyết định kỹ thuật:
- Heatmap overlay nên dùng chung hệ trục với chart giá để trader không phải map thủ công giữa 2 panel khác nhau.
- Bubble hoặc marker cần encode ít nhất 3 chiều: size theo matched value, màu theo side, stroke hoặc glow theo severity.
- Pressure gauge nên so sánh cửa sổ 1 giờ với baseline 24 giờ hoặc baseline phiên gần nhất, tránh chỉ hiển thị số tuyệt đối.
- Liquidity void không nên chỉ là highlight hình ảnh. Cần có rule backend rõ ràng, ví dụ vùng giá bị sweep qua với volume thấp kế tiếp và ít resting liquidity.
- Mọi visual aid cần có chế độ tắt bớt để tránh chart overload trên màn hình nhỏ.

### 5. AI action framing

Mục tiêu:
- Advisory không chỉ mô tả, mà gợi ý hành động theo ngữ cảnh.

Công việc:
- Chuẩn hóa output AI theo schema: `summary`, `thesis`, `risk`, `watch_levels`, `next_check`.
- Cho phép render card advisory dạng structured UI.
- Gắn link trực tiếp từ advisory đến stock workspace và depth chart state.

Schema đề xuất mở rộng:
- Thêm `action_type` để UI có thể render hành động rõ ràng thay vì chỉ hiển thị văn bản.
- Enum khởi điểm:
	- `WATCH`: gắn badge vào Watchlist hoặc ưu tiên theo dõi thêm.
	- `HEDGE`: mở nhanh panel hedge/phái sinh khi hệ thống có module phù hợp.
	- `SCALP`: mở nhanh depth chart và các entry point tác vụ tốc độ cao.
	- `AVOID`: cảnh báo rủi ro, giảm prominence của nút mua nhanh.
- Schema tối thiểu giai đoạn đầu:
	- `summary`
	- `thesis`
	- `risk`
	- `watch_levels`
	- `next_check`
	- `action_type`
	- `confidence`
	- `expires_at`
- `action_type` phải được coi là advisory hint, không phải lệnh giao dịch tự động.
- UI cần fallback an toàn khi AI trả về action không hợp lệ hoặc ngoài enum cho phép.

Schema nên giàu ngữ cảnh hơn:
- Bên cạnh text advisory, nên bổ sung block `attributes` để AI và UI cùng dùng chung ngữ nghĩa tín hiệu.
- Các field nên có trong giai đoạn sau:
	- `intent`
	- `aggressiveness`
	- `vol_participation`
	- `liquidity_impact`
	- `crowding_level`
- Block `actionable_insight` nên có cấu trúc rõ để trader chuyển từ đọc hiểu sang hành động có kiểm soát:
	- `thesis`
	- `entry_zone`
	- `invalid_level`
	- `risk_reward`
	- `next_check`

Ví dụ schema mục tiêu:

```json
{
	"symbol": "HPG",
	"whale_score": 85,
	"severity": "high",
	"attributes": {
		"intent": "breakout_catalyst",
		"aggressiveness": "high_sweep_ask",
		"vol_participation": "15% of 5m volume",
		"liquidity_impact": "cleared_2_major_sell_walls",
		"crowding_level": "medium"
	},
	"actionable_insight": {
		"thesis": "Whale đang chủ động đẩy giá vượt vùng cản ngắn hạn.",
		"entry_zone": "28.10 - 28.25",
		"invalid_level": "5m close < 27.80",
		"risk_reward": "1:3",
		"next_check": "confirm follow-through in next 2 candles"
	}
}
```

Định hướng rollout:
- Giai đoạn đầu backend chỉ cần trả schema chuẩn hóa.
- AI layer và UI layer cùng bám schema này để tránh mỗi nơi diễn giải một kiểu.
- Những field chưa tính được bằng rule engine có thể để AI sinh ra có kiểm soát, nhưng các field quan trọng như `aggressiveness`, `concentration_ratio`, `distance_to_wall` nên ưu tiên tính từ dữ liệu thật.

## 6. Admin roadmap cho Whale Alerts

## Mục tiêu quản trị

Phần quản trị của Whale Alerts không nên dừng ở CRUD cấu hình. Nó phải là control plane cho toàn bộ hệ thống intelligence:
- hiệu chỉnh độ nhạy phát hiện mà không cần deploy lại,
- kiểm soát chất lượng AI commentary,
- quan sát độ trễ và tính nhất quán của pipeline realtime,
- quản trị entitlement và rollout tính năng mới.

Nói cách khác, nếu Whale Alerts là sản phẩm cho user cuối thì Whale Alerts Admin là sản phẩm cho đội vận hành nội bộ.

## Sprint 14 Admin Foundation

### 1. Whale detection admin

Mục tiêu:
- Cho phép admin tinh chỉnh engine phát hiện mà không cần sửa code hoặc restart service.

Công việc:
- Xây `Threshold Configurator` để cấu hình ngưỡng matched value theo nhóm mã, sector hoặc liquidity bucket.
- Tách threshold thành nhiều lớp:
	- global default
	- per market bucket như bluechip, midcap, penny
	- per symbol override
- Bổ sung `Symbol Watchlist Management` cho danh sách mã được track realtime.
- Cho phép thêm hoặc bỏ mã khỏi stream consumer nhanh, có audit trail.
- Tạo `Scoring Rules` UI để chỉnh trọng số whale score theo market regime.

Quyết định kỹ thuật:
- Cấu hình nên được lưu trong DB và cache ở Redis để runtime đọc nhanh.
- Mọi thay đổi admin phải có `effective_at`, `updated_by`, `reason` để tránh chỉnh nhầm mà khó truy vết.
- Engine runtime nên dùng config versioning. Mỗi event whale được tính ra nên biết nó được sinh dưới `config_version` nào.
- Phần threshold cần hỗ trợ preview impact, ví dụ “nếu dùng threshold mới, trong 1 ngày vừa qua sẽ phát sinh thêm bao nhiêu alerts”.

Điểm cần thực tế hóa:
- `Preview impact` không nên là bài toán realtime trong Sprint 14. Nên chạy bằng job nền trên dữ liệu lịch sử gần đây hoặc sample session, tránh làm chậm màn admin.

Màn admin nên có:
- `Alert Engine > Thresholds`
- `Alert Engine > Symbol Coverage`
- `Alert Engine > Scoring Rules`

### 2. Entitlement và feature rollout admin

Mục tiêu:
- Phân quyền và rollout sản phẩm Whale Alerts rõ ràng theo gói người dùng.

Công việc:
- Tạo `Tier Management` để map tính năng Whale Alerts theo plan Free, Pro, Premium.
- Cho phép cấu hình giới hạn như:
	- max alerts per minute
	- historical retention visible
	- advisory summary/detail access
	- access to whale score, intent, heatmap
- Tạo `Feature Flags` cho rollout từng module như Whale Score, Intent, Heatmap, Counter-party Detection.
- Hỗ trợ rollout theo cohort: staff only, beta users, premium only, percentage rollout.

Quyết định kỹ thuật:
- Feature flags nên đọc nhanh từ cache và có fallback an toàn nếu config service lỗi.
- Entitlement admin nên dùng chung contract với `resolve_user_entitlements(user)` đã nêu ở Sprint 14 để tránh UI và backend hiểu khác nhau.
- Cần có audit log cho thay đổi entitlement vì đây là phần liên quan trực tiếp đến monetization.

Màn admin nên có:
- `Business > Entitlement`
- `Business > Feature Flags`
- `Business > Release Cohorts`

### 3. Quan sát pipeline cơ bản

Mục tiêu:
- Cho đội vận hành thấy được pipeline realtime có thực sự “realtime” hay không.

Công việc:
- Xây `Pipeline Stats` cho các mốc:
	- exchange tick time
	- backend ingest time
	- detect time
	- broadcast time
	- client receive time nếu đo được
- Hiển thị `consumer lag`, queue depth, error rate, throughput.
- Bổ sung cảnh báo khi latency vượt ngưỡng, ví dụ > 500ms hoặc backlog tăng bất thường.

Quyết định kỹ thuật:
- Cần chuẩn hóa event timestamps ở toàn pipeline để đo latency end-to-end đáng tin cậy.
- Nên lưu metrics tách theo symbol hot và overall để tránh trung bình che mất điểm nghẽn trên mã nóng.
- Các cảnh báo admin nên có severity và suppression window để tránh spam nội bộ.

Màn admin nên có:
- `Monitoring > Pipeline Stats`
- `Monitoring > Queue Lag`
- `Monitoring > Alert Health`

## Sprint 15 Admin Intelligence Ops

### 1. AI advisory ops

Mục tiêu:
- Biến AI commentary thành một hệ thống có thể đo, kiểm soát và hiệu chỉnh được.

Công việc:
- Xây `Prompt Studio` để quản lý prompt template theo version.
- Hỗ trợ A/B testing prompt theo model, prompt version hoặc cohort user.
- Tạo `Advisory QC` list để review các advisory AI đã sinh.
- Thêm `Override` workflow cho analyst hoặc admin sửa nội dung AI nếu AI hiểu sai ngữ cảnh.
- Hỗ trợ trạng thái duyệt:
	- draft
	- auto-published
	- human-reviewed
	- overridden
	- rejected

Mở rộng vận hành:
- Bổ sung `Shadow Mode` cho Prompt Studio.
- Prompt mới được chạy song song với prompt đang live nhưng chỉ hiển thị cho admin để so sánh chất lượng trước khi go-live.
- Shadow mode nên hỗ trợ so sánh theo:
  - output schema validity,
  - latency,
  - token cost,
  - manual reviewer score,
  - downstream engagement nếu cần.

Quyết định kỹ thuật:
- Advisory nên lưu cả raw prompt input, prompt version, model name, token usage, latency và output schema status.
- Human override không nên ghi đè mất bản gốc AI. Cần lưu song song `ai_original` và `human_override` để còn audit.
- Nếu advisory bị override, frontend cần biết đang hiển thị bản human-reviewed hay original.
- Prompt A/B test nên gắn với evaluation outcome, ví dụ CTR, dwell time, user flag rate hoặc manual score.

QC workflow chi tiết:
- Quy trình nên hoạt động như một hệ thống biên tập nội dung chuyên nghiệp, không phải chỉ là nút sửa text thủ công.
- Luồng gợi ý:
	- `AI_GENERATED`: provider sinh bản nháp theo schema.
	- `PENDING_REVIEW`: advisory chờ analyst hoặc admin xác thực.
	- `APPROVED`: được phép publish cho user phù hợp entitlement.
	- `EDITED`: đã được người vận hành chỉnh lại một phần như `entry_zone`, `risk_reward`, `invalid_level`.
	- `REJECTED`: advisory bị loại do signal nhiễu hoặc schema sai.
- Hệ thống phải lưu song song `original_payload`, `edited_payload`, `reviewer_id`, `review_reason`, `reviewed_at`.
- Đây là dữ liệu đầu vào quan trọng cho learning loop hàng tuần để đánh giá prompt nào đang tạo ra nhiều edit hoặc reject nhất.

Màn admin nên có:
- `AI Center > Prompt Studio`
- `AI Center > Advisory QC`
- `AI Center > A/B Experiments`

### 2. Inference monitoring

Mục tiêu:
- Theo dõi chất lượng vận hành của nhà cung cấp AI và phát hiện sớm suy giảm dịch vụ.

Công việc:
- Theo dõi token usage, cost estimate, latency, timeout rate, parse error rate.
- Hiển thị tỷ lệ advisory thành công theo model và prompt version.
- Cảnh báo khi OpenClaw hoặc provider khác tăng lỗi, tăng latency hoặc vượt budget.

Quyết định kỹ thuật:
- Metrics nên tách theo model, endpoint, prompt type và market condition nếu cần.
- Nếu AI provider lỗi nhiều, hệ thống cần có degraded mode rõ ràng: fallback về summary-only hoặc skip advisory.
- Admin cần thấy backlog của advisory generation để quyết định scale worker hoặc tạm giảm phạm vi advisory.

Phạm vi metric:
- Latency AI provider phải được tách riêng khỏi latency detect whale event.
- Không nên gộp provider latency vào KPI realtime detection nếu không sẽ làm sai đánh giá chất lượng pipeline lõi.

Màn admin nên có:
- `AI Center > Inference Monitoring`
- `AI Center > Provider Health`

### 3. Data consistency và reconciliation

Mục tiêu:
- Đảm bảo Whale Alerts không bị mất event hoặc sai khác giữa dữ liệu realtime và dữ liệu cuối phiên.

Công việc:
- Tạo `Data Consistency Checker` đối soát giữa Redis Stream, WebSocket broadcast log và REST snapshot.
- Đối soát số lượng whale signals theo symbol, theo phiên, theo time bucket.
- Cho phép chạy reconciliation job thủ công cho một symbol hoặc một khoảng thời gian cụ thể.

Quyết định kỹ thuật:
- Nên có event id hoặc deterministic event fingerprint để so khớp across systems.
- Cần phân biệt rõ 3 loại mismatch:
	- missed detection
	- delayed detection
	- duplicated broadcast
- Admin screen nên chỉ ra nguyên nhân khả dĩ, không chỉ hiển thị mismatch count.

Màn admin nên có:
- `Monitoring > Data Consistency`
- `Monitoring > Replay & Reconcile`

### 4. Live event trace và chế độ war room

Mục tiêu:
- Cho đội vận hành và analyst nhìn được hành trình đầy đủ của một whale event khi cần điều tra sự cố hoặc giải đáp khiếu nại của user premium.

Công việc:
- Tạo màn `Live Event Trace` cho phép chọn 1 symbol hoặc 1 event id.
- Hiển thị toàn bộ timeline của sự kiện:
	- vào hệ thống lúc nào,
	- detect lúc nào,
	- score tính ra bao nhiêu,
	- AI bắt đầu generate và hoàn tất lúc nào,
	- WebSocket broadcast lúc nào,
	- client ack hoặc delivery signal nếu đo được.
- Cho phép lọc theo event bị miss, delayed hoặc downgraded do degraded mode.

Quyết định kỹ thuật:
- Muốn có war room trace usable, mọi stage trong pipeline phải phát cùng một `event_id` hoặc `trace_id`.
- Trace phải lưu được cả metadata vận hành lẫn metadata nghiệp vụ, ví dụ `score`, `intent`, `config_version`, `prompt_version`, `provider_latency`.
- Đây là công cụ rất quan trọng để xử lý case user hỏi tại sao một lệnh lớn không được báo hoặc báo chậm.

Màn admin nên có:
- `Monitoring > Live Event Trace`
- `Monitoring > War Room`

## Backlog admin sau Sprint 15

### 1. User analytics và product steering

- Theo dõi top symbols được xem nhiều nhất qua Whale Alerts.
- Theo dõi top alert types có CTR hoặc dwell time cao.
- Dùng dữ liệu này để điều hướng prompt focus, symbol coverage và roadmap ưu tiên.

### 2. Feedback loop từ người dùng

- Cho phép user flag advisory sai hoặc thiếu ngữ cảnh.
- Xây `Feedback Loop` để admin xem các advisory bị gắn cờ và gom theo prompt version, model, symbol, intent.
- Dùng feedback để huấn luyện lại rule engine hoặc tinh chỉnh prompt.

### 3. Auto-scaling control

- Khi consumer lag hoặc advisory backlog tăng cao, admin có thể bật auto-scaling hoặc scale thủ công worker group.
- Cần có guardrail để tránh scale quá mức gây tốn chi phí nhưng không cải thiện độ trễ.

### 4. Regime-aware scoring profiles

- Cho phép lưu nhiều profile scoring theo chế độ thị trường như trend up, trend down, sideway, event-driven.
- Admin có thể chuyển profile thủ công hoặc hệ thống đề xuất profile dựa trên market regime detection.

## Menu backend admin đề xuất

### Alert Engine

- `Thresholds`: cấu hình ngưỡng lọc theo symbol, sector, liquidity bucket.
- `Symbol Coverage`: quản lý danh sách mã được track realtime.
- `Scoring Rules`: chỉnh trọng số tính whale score.
- `Config Versions`: xem lịch sử version cấu hình và rollback khi cần.

### AI Center

- `Prompt Studio`: soạn thảo, versioning và test prompt.
- `Advisory QC`: review, override và phê duyệt advisory.
- `Inference Monitoring`: token, latency, error rate, provider health.
- `Experiments`: A/B testing prompt, model hoặc schema.

### Monitoring

- `Pipeline Stats`: latency end-to-end, TPS, queue lag.
- `System Logs`: tra cứu lỗi xử lý whale event hoặc AI advisory.
- `Data Consistency`: kiểm tra miss, duplicate, delayed events.
- `Replay & Reconcile`: chạy đối soát hoặc replay theo symbol và time range.

### Business

- `Entitlement`: phân quyền theo gói cước.
- `Feature Flags`: bật hoặc tắt nhanh tính năng mới.
- `Release Cohorts`: rollout theo nhóm user.
- `User Insights`: top symbols được xem nhiều, hành vi dùng Whale Alerts.

## Tiêu chí hoàn thành cho admin

Sprint 14 admin thành công khi:
- Admin có thể đổi threshold, symbol coverage và entitlement mà không cần sửa code.
- Có observability cơ bản cho latency, lag và health của pipeline.
- Mọi thay đổi cấu hình quan trọng đều có audit trail và config version.

Sprint 15 admin thành công khi:
- Có Prompt Studio, Advisory QC và monitoring riêng cho AI.
- Có khả năng đối soát miss hoặc duplicate whale events.
- Admin có đủ dữ liệu để quyết định rollout, scale và hiệu chỉnh score logic.

## 7. Backlog sau Sprint 15

### 1. Historical replay

- Lưu whale events đủ dài để replay theo phiên.
- Cho phép scrub timeline và xem từng alert chồng lên price action.

Tính khả thi dữ liệu:
- Historical replay không phù hợp nếu chỉ dựa vào bảng giao dịch ứng dụng thông thường khi volume dữ liệu tăng lên hàng triệu bản ghi.
- Nên cân nhắc time-series storage như ClickHouse hoặc TimescaleDB để tối ưu truy vấn theo thời gian, symbol và replay window.
- Yêu cầu schema phải hỗ trợ query kiểu:
	- khoảng thời gian theo symbol
	- seek theo timestamp để scrub timeline mượt
	- aggregate nhanh theo bucket thời gian
- Nếu chưa muốn mở thêm hạ tầng lớn ngay, có thể triển khai theo 2 bước:
	- bước 1: lưu raw whale events vào PostgreSQL partition theo ngày
	- bước 2: chuyển sang ClickHouse hoặc TimescaleDB khi retention và truy vấn replay tăng mạnh
- Từ đầu cần thiết kế event envelope ổn định để không phải migrate nặng khi đổi storage backend.

Thiết kế lưu trữ time-series gợi ý:
- Nếu dùng TimescaleDB: model dữ liệu nên map sang hypertable.
- Nếu dùng ClickHouse: ưu tiên MergeTree hoặc biến thể phù hợp với sort theo `symbol`, `ts`.

Khuyến nghị chọn đường triển khai:
- Nếu mục tiêu gần là tích hợp nhanh vào stack Django hiện tại, TimescaleDB hợp lý hơn cho giai đoạn đầu vì giảm chi phí vận hành và tích hợp ORM/SQL quen thuộc.
- Nếu mục tiêu là retention lớn, replay sâu trên nhiều mã và truy vấn analytics nặng, ClickHouse nên được xem là đích đến trung hạn.
- Vì vậy roadmap hợp lý là:
	- giai đoạn 1: persistence tối thiểu hoặc PostgreSQL partition / TimescaleDB
	- giai đoạn 2: chuyển hoặc mirror sang ClickHouse khi replay và backtest trở thành workload chính

`whale_events_history` nên lưu:
- `ts`: timestamp độ chính xác cao, nhưng nên bám sát độ phân giải thực tế từ nguồn dữ liệu. Không cần thiết kế vượt quá precision mà source không cung cấp ổn định.
- `symbol`: mã chứng khoán, có index hoặc sort key
- `price`
- `matched_value`
- `side`
- `whale_score`
- `intent_id` hoặc `intent_key`
- `snapshot_context`: JSONB hoặc structured blob chứa RVOL, spread, wall distance, crowding evidence tại thời điểm xảy ra
- `event_id`
- `weights_version`
- `config_version`

Ý nghĩa của `snapshot_context`:
- Replay không phải tính lại toàn bộ context từ dữ liệu thô mỗi lần user kéo timeline.
- Backtest và QC có thể tái hiện lại “lý do” hệ thống đã chấm điểm hoặc gán intent như vậy tại thời điểm quá khứ.

`market_depth_snapshots` nên lưu:
- snapshot đầy đủ theo chu kỳ cho các mã nóng hoặc các mã vừa phát whale alert
- hoặc delta-encoding nếu muốn tiết kiệm dung lượng
- metadata như `snapshot_type`, `source_ts`, `symbol`, `depth_version`

Chiến lược lưu depth:
- Không cần snapshot dày cho toàn bộ universe mọi lúc.
- Nên snapshot mỗi 5 đến 10 giây cho các mã đang hot hoặc quanh thời điểm có whale alert.
- Khi không nóng, có thể giảm tần suất hoặc chỉ lưu delta.

Replay engine logic:
- Khi user kéo timeline về thời điểm $T$, backend nên:
  - lấy `market_depth_snapshot` gần nhất trước $T$
  - lấy toàn bộ `whale_events_history` trong khoảng $[T - 5m, T]`
  - căn chỉnh nến giá lịch sử tương ứng với $T$
- Frontend nên nhận payload theo shape gần giống realtime payload để giảm việc viết 2 bộ renderer khác nhau.
- Cần có một `replay middleware` hoặc adapter backend để biến dữ liệu lịch sử sang đúng envelope mà UI realtime hiện đang dùng.

Ràng buộc thực tế:
- Replay chỉ thật sự đáng tin nếu depth snapshot, candles và whale events dùng cùng mốc thời gian quy chiếu.
- Nếu không đảm bảo clock alignment, UI replay sẽ nhìn hợp lý nhưng có thể sai bối cảnh theo vài giây, đủ để trader hiểu sai intent.

Nguyên tắc thiết kế replay:
- Không cố ép frontend hiểu một schema lịch sử hoàn toàn khác schema realtime.
- Càng reuse được renderer hiện tại cho bubble, heatmap, depth, alert cards thì chi phí bảo trì càng thấp.

### 2. Portfolio-aware whale relevance

- Đánh dấu signal nào liên quan tới holdings hiện tại.
- Tính mức ảnh hưởng tới NAV và sector exposure của user.

### 3. Whale sentiment index

- Tạo chỉ số tổng hợp 0-100 cho toàn thị trường dựa trên hành vi whale trong 24 giờ hoặc theo từng phiên.
- Có thể tách theo sàn, sector hoặc universe do user theo dõi.
- Dùng làm lớp context vĩ mô để user biết signal đang thuận thị trường hay đi ngược dòng.

### 4. Counter-party detection

- Phát hiện khi hai dòng lệnh lớn đối ứng mạnh tại cùng vùng giá, ví dụ một bên xả cực lớn và một bên hấp thụ mạnh.
- Đây là tín hiệu rất hữu ích để phân biệt breakout thật với phân phối hoặc hấp thụ.
- Có thể bắt đầu bằng heuristic dựa trên cùng price band, side opposite và thời gian rất sát nhau.

### 5. Ops and observability

- Dashboard riêng cho tỷ lệ detect whale, advisory queue latency, stream lag.
- Alert khi OpenClaw advisory backlog tăng hoặc stream consumer bị chậm.

### 6. Replay và backtest infrastructure

- Tạo middleware hoặc service layer xuất dữ liệu quá khứ theo đúng contract của realtime feed.
- Cho phép analyst chạy backtest trên `whale_score`, `intent`, `crowding_level` theo weights version cụ thể.
- Mọi replay nên hỗ trợ `as_of_config_version` để biết signal lịch sử sẽ trông như thế nào dưới từng phiên bản rule.

## 8. Success metrics

Ngoài tiêu chí hoàn thành theo checklist, mỗi sprint nên có metric định lượng để biết cải tiến có thực sự tạo giá trị hay không.

### Sprint 14 metrics

- `Aggregate Feed Latency`: thời gian tải trang `/whale-alerts` và page tiếp theo khi dùng cursor pagination.
- `Entitlement Cache Hit Ratio`: tỷ lệ cache hit khi resolve quyền user.
- `Feed Stability`: tỷ lệ duplicate hoặc missing item khi user scroll trong lúc alert mới tiếp tục đổ về.
- `Hub CTR`: tỷ lệ click từ Whale Alerts Hub sang dashboard theo mã.

### Sprint 15 metrics

- `Signal Accuracy`: tỷ lệ các signal có `intent = BREAKOUT_CATALYST` thực sự tăng giá vượt ngưỡng mục tiêu, ví dụ >2% trong 1 giờ tiếp theo.
- `Advisory Engagement`: dwell time trung bình trên AI Advisory card hoặc session.
- `Pipeline Latency P99`: nên tách thành 2 chỉ số:
	- `Detect Pipeline P99`: từ ingest tới detect/broadcast nội bộ
	- `Advisory Pipeline P99`: từ detect tới advisory published
- Mục tiêu kiểu 300ms chỉ nên áp dụng cho detect pipeline nội bộ nếu hạ tầng và nguồn data cho phép, không nên áp lên toàn bộ luồng có AI inference.
- `Intent Coverage`: tỷ lệ signal có đủ dữ liệu để gắn intent với confidence chấp nhận được.
- `Crowding Warning Precision`: tỷ lệ advisory cảnh báo crowding cao thực sự dẫn tới rung lắc hoặc shakeout sau đó.
- `Replay Readiness`: tỷ lệ whale events có đủ `snapshot_context`, `event_id`, `weights_version` và depth snapshot để tái hiện lại đúng.
- `QC Edit Rate`: tỷ lệ advisory bị analyst chỉnh sửa sau khi AI generate, dùng làm chỉ báo chất lượng prompt và schema.

Nguyên tắc đánh giá:
- Mỗi metric phải có owner, nguồn dữ liệu và cửa sổ đo rõ ràng.
- Không dùng metric engagement đơn lẻ để đánh giá chất lượng advisory; cần đi cùng độ chính xác tín hiệu và phản hồi người dùng.
- Nếu P99 latency là KPI chính, phải ưu tiên pipeline design và instrumentation trước khi mở rộng thêm lớp suy luận nặng.

## 9. Tiêu chí hoàn thành

Sprint 14 thành công khi:
- `/whale-alerts` có aggregate feed thật.
- Có test cơ bản cho hub và dashboard.
- Người dùng hiểu rõ phần nào miễn phí, phần nào thuộc advisory trả phí.

Sprint 15 thành công khi:
- Dashboard phản ứng nhanh hơn với biến động nội phiên.
- Tín hiệu whale có ranking và severity rõ ràng.
- Advisory AI chuyển từ dạng text thuần sang dạng decision support có cấu trúc.
- Feed whale bắt đầu mang được context giao dịch như aggressiveness, intent và concentration thay vì chỉ hiển thị matched value.

## 10. Action plan ưu tiên

Để triển khai tài liệu này theo thứ tự hợp lý, nên đi theo 3 ưu tiên lớn:

## 10.1 Các điểm chưa hợp lý đã chỉnh

- Chốt Redis-backed entitlement resolver là hướng mặc định thay vì để mở cả Redis và JWT cùng lúc.
- Tách score v1 khỏi intent để tránh vòng lặp logic.
- Sửa lại thứ tự mục trong Sprint 15, phần AI action framing thành mục 5.
- Hạ phạm vi `preview impact` của admin về background job thay vì tính trực tiếp realtime.
- Tách `Detect Pipeline P99` và `Advisory Pipeline P99` để metric phản ánh đúng thực tế.
- Làm rõ aggregate feed phải có event source ổn định ở backend, không đọc từ state tạm.
- Làm rõ Historical Replay nên đi theo lộ trình tích hợp dần, không nhảy ngay lên hạ tầng phức tạp nếu chưa cần.

## 10.2 Kế hoạch code theo thứ tự ưu tiên

Trước khi code, phạm vi nên được chia theo phase rõ ràng để tránh mở quá nhiều nhánh cùng lúc.

### Phase 0: Contract và nền tảng tối thiểu

Mục tiêu:
- Chốt contract dữ liệu và điểm neo kỹ thuật trước khi viết feature lớn.

Việc cần làm:
- Chốt envelope cho whale event aggregate.
- Chốt helper `resolve_user_entitlements(user)` và contract trả quyền.
- Chốt `event_id`, `config_version`, `weights_version` cho signal lifecycle.
- Chốt source of truth cho aggregate feed trong Sprint 14.

Output mong đợi:
- spec API và service contract rõ ràng
- tránh phải refactor ngược khi sang scoring hoặc replay

### Priority 1

- Xây `GET /api/realtime/whale-feed/aggregate/` với cursor-based pagination.
- Đây là nền cho Whale Alerts Hub và aggregate board của Sprint 14.

Scope code nên gồm:
- backend endpoint aggregate
- serializer hoặc response builder cho cursor payload
- persistence hoặc read model tối thiểu cho aggregate events
- frontend update cho Whale Alerts Hub dùng aggregate feed thật
- test backend cho cursor stability và entitlement visibility

### Priority 2

- Xây scoring service chuẩn hóa và UI severity badge cho Whale Score.
- Backend phải support weights runtime từ admin config.
- Frontend chỉ nên hiển thị severity theo contract backend, không tự tính điểm riêng.

Scope code nên gồm:
- service `calculate_event_score` và `calculate_display_score`
- score breakdown model hoặc payload field
- severity band config
- UI badge mapping theo contract backend
- test deterministic score và mapping severity

### Priority 3

- Xây replay middleware xuất dữ liệu lịch sử theo định dạng gần giống realtime.
- Đây là chìa khóa để Historical Replay không làm frontend tách thành hai hệ hiển thị độc lập.

Scope code nên gồm:
- schema draft cho `whale_events_history`
- adapter hoặc service `build_replay_payload(as_of_time, symbol)`
- chọn storage phase 1: PostgreSQL partition hoặc TimescaleDB
- replay response contract reuse renderer hiện có
- chưa cần làm full UI replay ở bước đầu nếu backend contract chưa ổn định

### Phase sau Priority 3

Chỉ nên mở tiếp khi 3 ưu tiên trên ổn định:
- intent classifier
- crowding engine
- admin Prompt Studio / QC workflow đầy đủ
- war room trace
- historical replay UI hoàn chỉnh

Lưu ý triển khai:
- Các ưu tiên trên hiện mới được ghi vào tài liệu master.
- Chưa có code nào được triển khai thêm ở bước cập nhật tài liệu này.
- Nếu muốn bắt đầu code, cần chốt thứ tự ưu tiên và xác nhận phạm vi thực hiện trước.
# WHALE ANALYTICS v2.0 - BỘ TÀI LIỆU CHUYỂN GIAO THỰC THI

## 1. Mục tiêu

Đây là tài liệu master để chuyển giao công việc Whale Analytics v2.0 cho đội code mà không cần hỏi lại thêm về scope, nguyên tắc dữ liệu, thứ tự triển khai hay tiêu chí nghiệm thu.

Tài liệu này không thay thế bản kế hoạch duyệt scope. Nó là lớp triển khai thực thi bám trên các quyết định đã chốt trong:
- `docs/KE_HOACH_NANG_CAP_WHALE_ANALYTICS_CHART_V2_20260424.md`
- `docs/IMPLEMENTATION_PLAN_WHALE_ANALYTICS_PERFORMANCE_AND_SCALE_20260424.md`

## 2. Mục tiêu đầu ra của đội code

Sau khi hoàn thành, hệ thống phải đạt đồng thời 4 nhóm kết quả:

1. Chart đúng nghiệp vụ
- Trục X luôn chuẩn hóa theo phiên 09:00-15:00.
- Ngoài giờ giao dịch, cuối tuần và ngày lễ hiển thị phiên giao dịch gần nhất có dữ liệu.
- Bubble, price, CVD, strength và institutional strength cùng dùng chung contract thời gian.

2. Chart đúng ngữ nghĩa dữ liệu
- Tooltip chỉ hiển thị dữ liệu của đúng điểm đang hover.
- Không suy diễn dữ liệu từ bucket khác hoặc timestamp gần đó.
- Nếu không có dữ liệu hợp lệ thì hiển thị `Không có dữ liệu` hoặc trạng thái fail-safe tương đương.

3. Chart đủ nhanh để dùng thực tế
- Frontend không over-fetch full session hoặc `1M` khi người dùng chỉ xem intraday ngắn.
- Backend có snapshot endpoint, metadata, cache headers và degraded mode rõ ràng.

4. Có thể audit sau triển khai
- Mỗi task đều có owner, file neo, acceptance criteria và bằng chứng nghiệm thu.
- QA có checklist đủ để bắt lỗi lệch thời gian, lệch tooltip, saturation giả và race condition khi polling/resume.

## 3. Thứ tự ưu tiên tài liệu

Khi có xung đột diễn giải, áp dụng thứ tự sau:

1. `docs/KE_HOACH_NANG_CAP_WHALE_ANALYTICS_CHART_V2_20260424.md`
Vai trò: nguồn sự thật về nghiệp vụ và quyết định sản phẩm.

2. `docs/WHALE_ANALYTICS_V2_API_CONTRACT_AND_DATA_SHAPE_20260424.md`
Vai trò: nguồn sự thật cho request/response, header, metadata, bucket time và fail-safe semantics.

3. `docs/WHALE_ANALYTICS_V2_FRONTEND_IMPLEMENTATION_SPEC_20260424.md`
Vai trò: nguồn sự thật cho logic UI, state, tooltip, crosshair sync, polling/resume, rendering.

4. `docs/WHALE_ANALYTICS_V2_BACKEND_IMPLEMENTATION_SPEC_20260424.md`
Vai trò: nguồn sự thật cho snapshot build, normalize dữ liệu, công thức strength và cache strategy.

5. `docs/WHALE_ANALYTICS_V2_QA_UAT_AUDIT_PACK_20260424.md`
Vai trò: nguồn sự thật cho test, UAT, bằng chứng và audit sau bàn giao.

6. `docs/WHALE_ANALYTICS_V2_EXECUTION_TASKBOARD_20260424.md`
Vai trò: danh sách đầu việc thực thi và trạng thái hoàn thành.

## 4. Danh mục tài liệu trong gói bàn giao

### 4.1 Tài liệu chỉ đạo chung

- `docs/WHALE_ANALYTICS_V2_HANDOFF_MASTER_20260424.md`
- `docs/WHALE_ANALYTICS_V2_EXECUTION_TASKBOARD_20260424.md`

### 4.2 Tài liệu kỹ thuật

- `docs/WHALE_ANALYTICS_V2_API_CONTRACT_AND_DATA_SHAPE_20260424.md`
- `docs/WHALE_ANALYTICS_V2_FRONTEND_IMPLEMENTATION_SPEC_20260424.md`
- `docs/WHALE_ANALYTICS_V2_BACKEND_IMPLEMENTATION_SPEC_20260424.md`

### 4.3 Tài liệu nghiệm thu và audit

- `docs/WHALE_ANALYTICS_V2_QA_UAT_AUDIT_PACK_20260424.md`

## 5. Các quyết định đã chốt, đội code không được hỏi lại

### 5.1 Timezone và session

- Toàn bộ hệ thống dùng `UTC+7`.
- Session intraday chuẩn là `09:00-15:00`.
- Trục X hiển thị tuyến tính theo thời gian, không được nén khoảng trống giao dịch.
- Khoảng nghỉ trưa phải hiện gap thời gian thật.

### 5.2 Off-hours, weekend, holiday

- Khi không ở ngày giao dịch, chart mặc định hiển thị phiên giao dịch gần nhất có dữ liệu.
- Không hiển thị ngày lịch gần nhất nếu ngày đó không có giao dịch.

### 5.3 Tooltip và crosshair

- Tooltip là point-anchored.
- Crosshair chỉ dùng để đồng bộ vị trí thời gian giữa 2 pane.
- Crosshair không phải là lý do để ghép dữ liệu từ điểm khác vào tooltip.

### 5.4 Data gap và empty state

- Nếu `bubble_series` rỗng tại thời điểm $T$ nhưng `flow_series` có dữ liệu, tooltip chỉ hiển thị flow.
- Nếu không có dữ liệu hợp lệ thì ưu tiên `Không có dữ liệu` thay vì nội suy hoặc xấp xỉ.

### 5.5 ATO/ATC

- ATO/ATC là bucket hợp lệ và phải được aggregate theo bucket time tương ứng.
- Không được rải volume auction sang các phút giả chỉ để làm chart “mượt”.

### 5.6 Strength và institutional strength

- Không dùng logic saturate thô khiến strength chạm 100 hàng loạt.
- Bắt buộc dùng rolling baseline + percentile + sigmoid soft-saturation theo spec backend.
- Institutional strength phải có baseline riêng, không được là bản sao của buy strength.

## 6. Phạm vi file dự kiến sẽ bị tác động

### 6.1 Frontend file anchors

- `frontend/src/components/WhaleAnalyticsTab.jsx`
- `frontend/src/components/WhaleBubbleChart.jsx`
- `frontend/src/hooks/useWhaleAnalyticsData.js`
- `frontend/src/utils/whaleTimeAdapter.js`
- `frontend/src/api/client.js`

### 6.2 Backend file anchors

- `backend/portfolio/views_whale_orders.py`
- `backend/portfolio/views_dark_money_history.py`
- `backend/portfolio/order_flow.py`
- `backend/portfolio/serializers.py` nếu cần serializer riêng cho snapshot
- `backend/portfolio/services/*` nếu tách snapshot builder/cache service

## 7. Thứ tự triển khai bắt buộc

1. Backend chốt data contract và snapshot builder.
2. Frontend chuyển hook sang snapshot contract và state machine mới.
3. Frontend chỉnh chart rendering, tooltip, crosshair, data gap.
4. Backend tối ưu cache/coalescing/headers.
5. QA chạy full matrix nghiệm thu và audit bằng chứng.

Không được làm ngược theo kiểu chỉnh chart trước khi data contract mới được khóa, vì sẽ dẫn tới vá tạm và phải sửa lại lần hai.

## 8. Định nghĩa hoàn thành của gói Whale Analytics v2.0

Chỉ được coi là xong khi đồng thời đạt đủ:

1. API snapshot hoạt động và trả đúng metadata.
2. Frontend không còn gọi combo `session + 1M` cho view intraday ngắn.
3. Tooltip không còn trộn dữ liệu khác timestamp.
4. Resume từ background fetch ngay snapshot mới.
5. QA pack có đầy đủ bằng chứng trước/sau và checklist được tick hoàn chỉnh.
6. Audit ledger đã ghi nhận toàn bộ file đổi thực tế.

## 9. Nguyên tắc audit sau khi đội code bàn giao

Khi audit, reviewer phải đối chiếu theo thứ tự:

1. So taskboard với commit/diff thực tế.
2. So API contract với payload thật trên network.
3. So frontend behavior với video/screenshot bằng chứng.
4. So backend formulas với code thật và test output.
5. So QA evidence với tiêu chí trong audit pack.

## 10. Câu chốt bắt buộc cho toàn đội

Whale Analytics v2.0 là bài toán độ tin cậy trước, tối ưu đẹp sau.

Nguyên tắc vận hành không được vi phạm:
- Thà hiển thị `Không có dữ liệu` còn tốt hơn hiển thị dữ liệu sai hoặc dữ liệu gây hiểu lầm.
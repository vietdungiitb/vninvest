# KẾ HOẠCH NÂNG CẤP WHALE ANALYTICS CHART V2

## 1. Mục tiêu tài liệu

Tài liệu này là bản kế hoạch chuẩn để đội code, QA và auditor cùng bám vào một nguồn sự thật duy nhất khi triển khai nâng cấp Whale Analytics Chart.

Mục tiêu của v2 không còn là chỉ làm chart "đẹp hơn" hay "đầy dữ liệu hơn". Mục tiêu đúng là:

- tăng tốc độ đọc lệnh theo tư duy tape reading,
- giữ trung thực thị giác để không làm sai cảm nhận về mật độ giao dịch,
- bổ sung bối cảnh giá để người dùng hiểu lệnh lớn đang diễn ra ở đâu trong cấu trúc phiên,
- chuẩn bị contract dữ liệu cho các chỉ báo chuyên sâu như speed và percentile.

## 2. Tóm tắt điều hành

Whale Analytics Chart hiện có ba nhóm hạn chế chính:

1. Hạn chế về khả năng đọc chart nhanh
- Tooltip che dữ liệu ngay tại vùng người dùng đang quan sát.
- Legend phụ thuộc vào việc đối chiếu màu, chưa phù hợp với người dùng đọc lệnh nhanh.
- Chưa có filter theo quy mô lệnh đủ rõ và đủ an toàn về mặt nhận thức.

2. Hạn chế về bối cảnh giá và ngữ nghĩa dữ liệu
- Có đường giá intraday nhưng chưa có các mốc tham chiếu mạnh như ref/high/low/trần/sàn.
- Tooltip hiện còn quá nhị phân ở một số trường quan trọng như whale/extreme.
- Time bucket hiện hữu phù hợp với intraday snapshot nhưng chưa đủ cho nhu cầu đọc tốc độ lệnh sát thời điểm.

3. Hạn chế về khả năng mở rộng lên lớp phân tích thực chiến
- Chưa có order flow speed.
- Chưa có percentile theo baseline 10 phiên.
- Chưa có contract rõ ràng cho audit về tính đúng của các tín hiệu chuyên sâu.

## 3. Nguyên tắc sản phẩm không được vi phạm

### 3.1 Trung thực thị giác là rule cứng

Mọi lệnh đã vượt ngưỡng lọc hiện hành phải được hiển thị đầy đủ.

Không được dùng các kỹ thuật sau làm mặc định:

- tự động làm mờ các lệnh nhỏ chỉ vì mật độ cao,
- tự động ẩn bớt bubble hợp lệ để chart trông sạch hơn,
- cluster mặc định khiến người dùng mất khả năng ước lượng số lượng lệnh thật,
- nội suy hoặc xấp xỉ dữ liệu hover từ bucket khác.

Lý do: với nhiều mã có ngưỡng whale thấp hoặc dòng tiền lớn phân bổ dày nhưng không cực đại, việc làm sạch theo kiểu thị giác có thể làm sai đánh giá của người dùng về chất lượng dòng tiền.

### 3.2 Declutter chỉ được phép theo cách minh bạch

Các cơ chế hỗ trợ đọc chart được phép gồm:

- filter ngưỡng lệnh do người dùng chủ động chọn,
- zoom vào khoảng thời gian hẹp hơn,
- panel thông tin cố định để tránh che biểu đồ,
- direct label/endLabel để giảm phụ thuộc vào legend.

Các chế độ hỗ trợ nâng cao như density assist hoặc cluster chỉ được xem xét ở bước sau, phải có nhãn rõ ràng và mặc định tắt.

### 3.3 Audit phải bám đúng yêu cầu người dùng và code thực tế

Mọi tài liệu phase/task/QA phải đối chiếu được tới:

- yêu cầu UX cụ thể,
- contract dữ liệu cụ thể,
- file neo triển khai cụ thể,
- bằng chứng nghiệm thu cụ thể.

## 4. Phân kỳ triển khai đã khóa

## 4.1 Giai đoạn 1 - Giao diện và tiện ích đọc chart

Mục tiêu: tăng tốc độ đọc chart mà chưa yêu cầu thay đổi backend lớn.

In-scope:

- Docked Information Panel thay cho popup tooltip che dữ liệu.
- Filter quy mô lệnh với preset rõ ràng và slider log-scale.
- Direct label hoặc endLabel cho các line chính.
- Sửa fallback i18n để không lộ raw key.
- Giữ đủ toàn bộ bubble trên ngưỡng lọc đang chọn.
- Ưu tiên bubble lớn nằm lớp trên nhưng không được làm biến mất bubble nhỏ hợp lệ.

Out-of-scope:

- cluster bubble mặc định,
- density heat overlay,
- percentile lịch sử,
- speed series mới.

## 4.2 Giai đoạn 2 - Dữ liệu và bối cảnh giá

Mục tiêu: giúp người dùng hiểu whale order đang tác động ở đâu trong cấu trúc giá của phiên.

In-scope:

- thêm `Giá tham chiếu` lên chart,
- thêm `High phiên`, `Low phiên`, `Trần`, `Sàn` khi contract backend sẵn sàng,
- thêm DataZoom để người dùng tự giãn mật độ bubble,
- khóa semantics render dashed line và thứ tự ưu tiên trực quan.

Out-of-scope:

- speed,
- percentile 10 phiên,
- profile theo giá hoàn chỉnh.

## 4.3 Giai đoạn 3 - Phân tích chuyên sâu

Mục tiêu: nâng chart từ công cụ quan sát lên công cụ ra quyết định intraday mạnh hơn.

In-scope:

- order flow speed,
- percentile matched value và event score so với baseline 10 phiên,
- mở rộng Information Panel với context chuyên sâu,
- degraded/fallback semantics rõ ràng cho từng tín hiệu nâng cao.

## 5. Kết quả mong muốn theo góc nhìn người dùng

Sau Giai đoạn 1:

- người dùng không còn bị tooltip che biểu đồ,
- có thể lọc theo ngưỡng lệnh một cách minh bạch,
- nhìn line chính mà không cần dò legend,
- không bị méo cảm nhận về mật độ giao dịch.

Sau Giai đoạn 2:

- nhìn chart là biết whale order đang xảy ra dưới ref, sát high, phá high hay đè near-low,
- có thể zoom vào khung 15-30 phút để đọc vùng dày tốt hơn.

Sau Giai đoạn 3:

- phân biệt được lệnh to nhưng bình thường với lệnh thực sự cực đoan,
- đọc được tốc độ vào lệnh và bối cảnh dị thường của từng event.

## 6. Rủi ro đã nhận diện

1. Nếu dùng opacity như công cụ declutter mặc định, người dùng sẽ đánh giá sai mật độ whale activity.
2. Nếu thêm trần/sàn/high/low bằng suy luận frontend thay vì backend trả chuẩn, audit sẽ rất khó chốt.
3. Nếu taskboard đánh dấu hoàn thành trước khi code thật tồn tại, audit sẽ sai ngay từ lớp tài liệu.
4. Nếu speed/percentile không có degraded mode rõ ràng, UI sẽ dễ hiển thị tín hiệu giả chính xác.

## 7. Definition of done theo phase

### 7.1 Done cho Giai đoạn 1

- Information Panel docked hoạt động đúng.
- Filter ngưỡng lệnh có preset và semantics rõ ràng.
- Mọi bubble trên ngưỡng lọc được hiển thị đầy đủ.
- Không còn raw i18n key trên chart.
- QA có evidence hover, filter và visual truthfulness.

### 7.2 Done cho Giai đoạn 2

- Các line ref/high/low/trần/sàn hiển thị đúng contract.
- DataZoom hoạt động mà không phá sync giữa 2 pane.
- QA có evidence off-hours, lunch gap, zoom, price context.

### 7.3 Done cho Giai đoạn 3

- Speed có contract rõ ràng.
- Percentile 10 phiên có baseline sample size rõ ràng.
- UI không giả lập dữ liệu thiếu bằng số 0 hoặc nội suy mơ hồ.

## 8. Danh mục tài liệu bắt buộc đi kèm

- `docs/WHALE_ANALYTICS_V2_FRONTEND_IMPLEMENTATION_SPEC_20260424.md`
- `docs/WHALE_ANALYTICS_V2_BACKEND_IMPLEMENTATION_SPEC_20260424.md`
- `docs/WHALE_ANALYTICS_V2_API_CONTRACT_AND_DATA_SHAPE_20260424.md`
- `docs/WHALE_ANALYTICS_V2_EXECUTION_TASKBOARD_20260424.md`
- `docs/WHALE_ANALYTICS_V2_HANDOFF_MASTER_20260424.md`
- `docs/WHALE_ANALYTICS_V2_QA_UAT_AUDIT_PACK_20260424.md`
- `docs/WHALE_ANALYTICS_V2_TRACEABILITY_MATRIX_20260424.md`

## 9. Kết luận

Whale Analytics Chart v2 phải được triển khai theo nguyên tắc:

- đọc đúng trước,
- hiển thị trung thực trước,
- thêm ngữ cảnh giá sau,
- thêm chỉ báo nâng cao cuối cùng.

Mọi thay đổi nếu xung đột với nguyên tắc trung thực thị giác đều phải bị coi là sai thiết kế, kể cả khi nhìn bề ngoài chart có vẻ sạch hơn.

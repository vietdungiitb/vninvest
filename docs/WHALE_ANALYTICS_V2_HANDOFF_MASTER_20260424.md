# WHALE ANALYTICS V2 - BO TAI LIEU CHUYEN GIAO THUC THI

## 1. Mục tiêu

Tài liệu này là entry point cho đội code và đội audit. Người nhận việc phải có thể triển khai mà không cần hỏi thêm về:

- ưu tiên sản phẩm,
- rule hiển thị,
- contract dữ liệu,
- thứ tự phase,
- cách audit pass/fail.

## 2. Quyết định đã khóa, không hỏi lại

### 2.1 Quyết định sản phẩm

- Tooltip popup nổi không còn là cơ chế đọc chính; phải chuyển sang Information Panel docked.
- Chart phải ưu tiên đọc đúng trước, không ưu tiên "sạch" theo kiểu làm mất dữ liệu.
- Mọi lệnh trên ngưỡng đang chọn phải hiển thị đầy đủ.
- Không opacity taper mặc định.
- Không cluster mặc định.
- Zoom và filter là hai công cụ hợp lệ để giảm nhiễu, nhưng đều phải minh bạch với người dùng.

### 2.2 Quyết định dữ liệu

- Session chuẩn `09:00-15:00`, `UTC+7`.
- Off-hours/weekend/holiday phải trả phiên gần nhất có dữ liệu.
- Giai đoạn 2 mới khóa `ref/high/low/trần/sàn` bằng contract backend.
- Giai đoạn 3 mới khóa `speed` và `percentile 10 phiên`.

### 2.3 Quyết định audit

- Taskboard không được tick hoàn thành trước khi có code và evidence thật.
- Auditor phải đối chiếu qua traceability matrix.
- Audit fail ngay nếu chart làm mất lệnh hợp lệ trên ngưỡng hoặc bind sai timestamp.

## 3. Thứ tự ưu tiên tài liệu

Khi có mâu thuẫn diễn giải, dùng thứ tự sau:

1. `docs/KE_HOACH_NANG_CAP_WHALE_ANALYTICS_CHART_V2_20260424.md`
2. `docs/WHALE_ANALYTICS_V2_API_CONTRACT_AND_DATA_SHAPE_20260424.md`
3. `docs/WHALE_ANALYTICS_V2_FRONTEND_IMPLEMENTATION_SPEC_20260424.md`
4. `docs/WHALE_ANALYTICS_V2_BACKEND_IMPLEMENTATION_SPEC_20260424.md`
5. `docs/WHALE_ANALYTICS_V2_EXECUTION_TASKBOARD_20260424.md`
6. `docs/WHALE_ANALYTICS_V2_QA_UAT_AUDIT_PACK_20260424.md`
7. `docs/WHALE_ANALYTICS_V2_TRACEABILITY_MATRIX_20260424.md`

## 4. Thứ tự triển khai bắt buộc

1. Giai đoạn 1 - FE usability và visual truthfulness.
2. Giai đoạn 2 - price context contract và rendering.
3. Giai đoạn 3 - speed và percentile.

Không được nhảy sang Giai đoạn 3 khi Giai đoạn 1 chưa khóa xong rule hiển thị trung thực.

## 5. Bộ tài liệu trong gói chuyển giao

### 5.1 Tài liệu chỉ đạo

- `docs/KE_HOACH_NANG_CAP_WHALE_ANALYTICS_CHART_V2_20260424.md`
- `docs/WHALE_ANALYTICS_V2_HANDOFF_MASTER_20260424.md`

### 5.2 Tài liệu triển khai

- `docs/WHALE_ANALYTICS_V2_FRONTEND_IMPLEMENTATION_SPEC_20260424.md`
- `docs/WHALE_ANALYTICS_V2_BACKEND_IMPLEMENTATION_SPEC_20260424.md`
- `docs/WHALE_ANALYTICS_V2_API_CONTRACT_AND_DATA_SHAPE_20260424.md`
- `docs/WHALE_ANALYTICS_V2_EXECUTION_TASKBOARD_20260424.md`

### 5.3 Tài liệu audit

- `docs/WHALE_ANALYTICS_V2_QA_UAT_AUDIT_PACK_20260424.md`
- `docs/WHALE_ANALYTICS_V2_TRACEABILITY_MATRIX_20260424.md`

## 6. Hướng dẫn cho đội code

### 6.1 Frontend team

Phải đọc tối thiểu:

- frontend spec,
- API contract,
- taskboard,
- traceability matrix.

### 6.2 Backend team

Phải đọc tối thiểu:

- backend spec,
- API contract,
- taskboard,
- traceability matrix.

### 6.3 QA/auditor

Phải đọc tối thiểu:

- plan,
- QA/UAT pack,
- traceability matrix,
- taskboard.

## 7. Definition of ready cho từng phase

Một phase chỉ được coi là ready để code khi:

- requirements phase đó đã map vào taskboard,
- contract phase đó đã khóa trong spec API nếu có thay đổi backend,
- QA pack đã có checklist tương ứng,
- traceability matrix đã có mapping requirement -> task -> audit.

## 7.1 Ready-to-code cho slice đầu tiên

Slice code đầu tiên của Whale Analytics V2 được coi là đủ điều kiện bắt đầu ngay khi thỏa đồng thời các điểm sau:

- bắt đầu từ Giai đoạn 1, không nhảy sang Giai đoạn 2 hoặc 3,
- task được chọn nằm trong nhóm `FE-1.5`, `FE-1.1`, `FE-1.3`, `FE-1.2` theo đúng thứ tự ưu tiên ở taskboard,
- task đó map được về `Req ID` trong traceability matrix,
- task đó có tiêu chí nghiệm thu hẹp, đo được, và có thể audit riêng,
- sau khi merge hoặc commit chính thức phải cập nhật lại ledger và progress dashboard.

## 7.2 Nhịp audit vận hành bắt buộc cho mỗi slice code

Từ đây về sau, mỗi slice code Whale Analytics V2 phải đi theo cùng một nhịp audit, không bỏ bước:

1. Chọn `Task ID` từ taskboard.
2. Gắn `Req ID` tương ứng từ traceability matrix.
3. Code trong phạm vi hẹp của đúng task đó.
4. Chạy validation hẹp nhất có thể.
5. Cập nhật trạng thái taskboard nếu và chỉ nếu đã có code + validation + evidence.
6. Ghi entry mới vào `docs/CODE_CHANGE_AUDIT_LEDGER.md`.
7. Đồng bộ danh sách file sửa vào `PROGRESS_DASHBOARD.md`.

Nếu thiếu bước 5, 6 hoặc 7 thì slice đó chưa được coi là audit-ready.

## 8. Definition of done toàn gói

Toàn gói chỉ được coi là hoàn thành khi:

- mọi requirement trong traceability matrix đều có trạng thái cuối,
- taskboard phản ánh đúng code thực tế,
- ledger và progress dashboard đã đồng bộ danh sách file sửa,
- auditor có thể audit mà không phải hỏi lại người viết code về semantics cơ bản.

## 9. Chốt hướng triển khai

Whale Analytics v2 không phải là dự án "làm đẹp chart".

Đây là dự án khóa lại một chart có thể dùng thực chiến, có audit trail rõ ràng, và không lừa người dùng bằng các kỹ thuật làm sạch thị giác thiếu trung thực.

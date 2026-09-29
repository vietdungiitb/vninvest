# HANDOFF MASTER - Whale Alerts Symbol Kline Refactor

## 1. Mục tiêu bàn giao

Đây là tài liệu master để chuyển giao trọn gói cho đội code và đội audit nội bộ triển khai refactor `whale-alerts/:symbol` mà không cần hỏi lại về scope, thứ tự thực thi, giới hạn chỉnh sửa, test gates và bằng chứng nghiệm thu.

Tài liệu này không thay thế yêu cầu nghiệp vụ đã chốt. Nó là lớp điều phối thực thi bám trực tiếp trên các yêu cầu đã thống nhất với final auditor.

## 2. Kết quả cuối mà đội code phải tạo ra

Sau khi hoàn thành, hệ thống phải đồng thời đạt đủ các nhóm kết quả sau:

1. Chart trung tâm đúng mô hình phân tích theo phiên
- KlineChart là surface trung tâm duy nhất cho nến và tín hiệu kỹ thuật.
- Whale buy/sell, CVD, buy/sell strength và institutional strength cùng trục thời gian với nến.

2. Bubble chart đúng theo phiên đang xem
- Lần đầu vào là phiên gần nhất có dữ liệu.
- Click nến khác thì bubble chart đổi đúng phiên đó.

3. Bubble source của modern dashboard không bị ảnh hưởng
- Module nguồn không bị chỉnh sửa trực tiếp.
- Route whale-alerts/symbol dùng bản sao hoặc adapter riêng.

4. Toàn bộ gói có thể audit độc lập
- Có plan, taskboard, traceability matrix, self-audit/test protocol, evidence template và quality bootstrap.
- Mỗi slice đều có owner, file neo, acceptance và bằng chứng tối thiểu.

## 3. Thứ tự ưu tiên tài liệu

Khi có xung đột diễn giải, dùng thứ tự sau:

1. `docs/WHALE_ALERTS_SYMBOL_KLINE_REFACTOR_EXECUTION_PLAN_20260427.md`
2. `docs/WHALE_ALERTS_SYMBOL_KLINE_REFACTOR_EXECUTION_TASKBOARD_20260427.md`
3. `docs/WHALE_ALERTS_SYMBOL_KLINE_REFACTOR_TRACEABILITY_MATRIX_20260427.md`
4. `docs/WHALE_ALERTS_SYMBOL_KLINE_REFACTOR_SELF_AUDIT_AND_TEST_PROTOCOL_20260427.md`
5. `docs/WHALE_ALERTS_SYMBOL_KLINE_REFACTOR_EXECUTION_EVIDENCE_TEMPLATE_20260427.md`
6. `quality/QUALITY.md`
7. `quality/RUN_CODE_REVIEW.md`
8. `quality/RUN_INTEGRATION_TESTS.md`
9. `quality/RUN_SPEC_AUDIT.md`
10. `AGENTS.md`

## 4. Danh mục tài liệu trong gói bàn giao

### 4.1 Tài liệu chỉ đạo chung

- `docs/WHALE_ALERTS_SYMBOL_KLINE_REFACTOR_EXECUTION_PLAN_20260427.md`
- `docs/WHALE_ALERTS_SYMBOL_KLINE_REFACTOR_EXECUTION_TASKBOARD_20260427.md`
- `docs/WHALE_ALERTS_SYMBOL_KLINE_REFACTOR_HANDOFF_MASTER_20260427.md`

### 4.2 Tài liệu truy vết và kiểm soát chất lượng

- `docs/WHALE_ALERTS_SYMBOL_KLINE_REFACTOR_TRACEABILITY_MATRIX_20260427.md`
- `docs/WHALE_ALERTS_SYMBOL_KLINE_REFACTOR_SELF_AUDIT_AND_TEST_PROTOCOL_20260427.md`
- `docs/WHALE_ALERTS_SYMBOL_KLINE_REFACTOR_EXECUTION_EVIDENCE_TEMPLATE_20260427.md`
- `quality/QUALITY.md`
- `quality/RUN_CODE_REVIEW.md`
- `quality/RUN_INTEGRATION_TESTS.md`
- `quality/RUN_SPEC_AUDIT.md`
- `AGENTS.md`

## 5. Các quyết định đã khóa, đội code không được hỏi lại

### 5.1 KlineChart và chart semantics

- Kline behavior được lấy từ logic đang có trong `StockDetail`.
- KlineChart mới là main surface thay cho cụm chart cũ ở `whale-alerts/:symbol`.
- Tooltip có toggle ẩn/hiện và phải point-anchored theo nến.

### 5.2 Bubble source immutability

- Không sửa trực tiếp:
  - `frontend/src/components/WhaleBubbleChart.jsx`
  - `frontend/src/components/WhaleAnalyticsTab.jsx`
  - `frontend/src/components/modern/ModularPositionDeck.jsx`
- Chỉ copy sang namespace mới cho whale-alerts/symbol.

### 5.3 Selected session truth

- Bubble chart phải theo selected session từ KlineChart.
- Mặc định là phiên giao dịch gần nhất có dữ liệu thực.

### 5.4 Shark icon rule

- Icon cá mập chỉ áp dụng cho top 10% nến đang hiển thị trong viewport.
- Không dùng top 10% toàn bộ dataset.
- Quy tắc đếm tối thiểu là `max(1, ceil(visible*10%))` nếu có dữ liệu whale.

### 5.5 Stock Detail alignment

- `OrderFlowRadarPanel` phải chuyển xuống dưới KlineChart trong Stock Detail.
- Advisory session ở Stock Detail không được regress.

## 6. Chỉ dẫn cho đội code

1. Không nhảy cóc sang advisory nếu Kline/session state chưa khóa.
2. Không merge nhiều slice độc lập vào một patch lớn.
3. Không gắn cứng logic selected session trong bubble copy nếu contract backend chưa rõ.
4. Mọi text mới đi qua i18n tiếng Việt có đầy đủ dấu.
5. Sau mỗi burst runtime/UI phải rebuild hoặc restart dev stack bị ảnh hưởng.
6. Sau mỗi slice phải cập nhật ledger và progress dashboard.
7. Nếu slice chạm data contract thì phải chụp payload thật làm evidence, không chỉ mô tả bằng lời.

## 7. Chỉ dẫn cho auditor nội bộ

1. Audit theo traceability matrix trước, không audit cảm tính.
2. Với slice `FE-2.x`, kiểm diff để xác nhận source bubble files vẫn bất biến.
3. Với slice `FE-1.3`, kiểm riêng viewport-dependent shark icons bằng zoom/pan hoặc đổi timeframe.
4. Với slice `FE-2.3`, kiểm advisory theo đúng selected session, không được dùng summary toàn symbol.
5. Với slice `FE-3.3`, kiểm dual-fetch/double-mount của chart path cũ.
6. Slice không được PASS nếu thiếu một trong bốn thứ:
   - code thực tế,
   - validation,
   - evidence,
   - ledger/progress sync.

## 8. Checklist nghiệm thu nội bộ tối thiểu

### 8.1 Visual / UX

1. Trang `whale-alerts/:symbol` có KlineChart chính.
2. Pane kỹ thuật hiển thị đủ nhóm tín hiệu đã chốt.
3. Tooltip có toggle ẩn/hiện.
4. Có icon cá mập trên top 10% visible candles.
5. Click nến làm bubble chart đổi đúng phiên.
6. First load hiện bubble phiên mới nhất.
7. W2+W4 và Dark Money nằm ở cột phải dưới dạng compact cards.

### 8.2 Functional

1. Bubble source files của modern dashboard không bị sửa.
2. Stock Detail vẫn hoạt động sau khi Radar đổi vị trí.
3. Advisory bubble dùng ngữ cảnh phiên đang chọn.
4. Old chart path ở whale-alerts/symbol đã bị retire.

### 8.3 Validation / Evidence

1. `npm run build` PASS cho frontend.
2. Backend focused suites PASS nếu có mở rộng contract.
3. Dev stack đã rebuild/restart khi slice chạm runtime/UI.
4. Evidence template đã được điền cho từng slice đã đóng.
5. Ledger và progress dashboard đã được cập nhật.

## 9. Quy tắc chuyển sang coding

Đội code chỉ được xem là đủ điều kiện coding khi:

1. Bộ tài liệu này đã tồn tại đầy đủ.
2. Final auditor đã duyệt scope và hard constraints.
3. Taskboard đã chốt thứ tự slice.

## 10. Quy tắc kết thúc đợt triển khai

Đợt triển khai chỉ được coi là đủ điều kiện báo final auditor khi đồng thời đạt đủ:

1. Taskboard đã tick hết.
2. Matrix đã có evidence cho toàn bộ `Req ID` liên quan.
3. Self-audit protocol đã được chạy và có verdict cho từng slice.
4. Evidence template có đủ command log, ảnh/video, payload snapshot và residual risk.
5. Ledger và Progress Dashboard đã đồng bộ.

## 11. Câu chốt bắt buộc

Whale Alerts Symbol Refactor là bài toán nhất quán dữ liệu và độ tin cậy trước, thẩm mỹ sau.

Nguyên tắc không được vi phạm:
- Thà hiển thị trạng thái thiếu dữ liệu còn tốt hơn hiển thị sai phiên, sai bubble hoặc sai tín hiệu cá mập.
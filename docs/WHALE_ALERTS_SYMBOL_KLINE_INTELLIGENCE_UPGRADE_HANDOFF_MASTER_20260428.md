# HANDOFF MASTER - Whale Alerts Symbol KLine Intelligence Upgrade

## 1. Mục tiêu bàn giao

Đây là tài liệu master để chuyển giao trọn gói chương trình tối ưu `whale-alerts/:symbol` theo hướng đủ dùng cho nhà đầu tư thực chiến, có khả năng mở rộng bền vững và tránh vòng lặp sửa lặt vặt nhiều lần.

Chương trình này không mở rộng bừa bãi sang toàn bộ Whale workspace. Nó tập trung vào một mục tiêu duy nhất:

1. dựng một KLine intelligence workspace chuẩn cho `whale-alerts/:symbol`,
2. tích hợp đầy đủ `heatmap`, `CVD`, `strength`, `whale marker`,
3. khóa semantics dữ liệu và quality gates để đội code triển khai theo slice mà không phải đoán lại.

## 2. Kết quả cuối bắt buộc

Sau khi hoàn thành, hệ thống phải đồng thời đạt đủ các nhóm kết quả sau:

1. KLineChart là surface phân tích trung tâm duy nhất cho route `whale-alerts/:symbol`.
2. Cụm 2 pane kỹ thuật `CVD` và `Strength` phải thay thế cách nhồi `CVD normalized`, `Buy Strength`, `Institutional Strength` vào cùng một pane.
3. Heatmap dòng tiền phải bám đúng candle bucket, không được là lớp tô màu mang tính trang trí.
4. Whale marker phải tính theo viewport hiện tại, không theo toàn dataset.
5. Bubble chart và AI advisory vẫn bám `selected session` từ KLine, không bị regress.
6. Module bubble nguồn của modern dashboard vẫn bất biến.
7. Bộ tài liệu phải đủ để đội code, QA và auditor nội bộ có thể đi hết vòng triển khai mà không cần hỏi lại về semantics, acceptance, test gates hay evidence.

## 3. Bộ tài liệu trong gói này

### 3.1 Triad bắt buộc theo policy

1. `docs/IMPLEMENTATION_PLAN_WHALE_ALERTS_SYMBOL_KLINE_INTELLIGENCE_UPGRADE_20260428.md`
2. `docs/TECH_SPEC_WHALE_ALERTS_SYMBOL_KLINE_INTELLIGENCE_UPGRADE_20260428.md`
3. `docs/TASKBOARD_WHALE_ALERTS_SYMBOL_KLINE_INTELLIGENCE_UPGRADE_20260428.md`

### 3.2 Tài liệu điều phối và kiểm soát chất lượng

1. `docs/WHALE_ALERTS_SYMBOL_KLINE_INTELLIGENCE_UPGRADE_HANDOFF_MASTER_20260428.md`
2. `docs/WHALE_ALERTS_SYMBOL_KLINE_INTELLIGENCE_UPGRADE_TRACEABILITY_MATRIX_20260428.md`
3. `docs/WHALE_ALERTS_SYMBOL_KLINE_INTELLIGENCE_UPGRADE_SELF_AUDIT_AND_TEST_PROTOCOL_20260428.md`
4. `docs/WHALE_ALERTS_SYMBOL_KLINE_INTELLIGENCE_UPGRADE_EXECUTION_EVIDENCE_TEMPLATE_20260428.md`
5. `docs/WHALE_ALERTS_SYMBOL_KLINE_INTELLIGENCE_UPGRADE_HANDOFF_AUDIT_REPORT_20260428.md`
6. `quality/QUALITY.md`
7. `quality/RUN_CODE_REVIEW.md`
8. `quality/RUN_INTEGRATION_TESTS.md`
9. `quality/RUN_SPEC_AUDIT.md`
10. `AGENTS.md`

## 4. Thứ tự ưu tiên tài liệu

Khi có xung đột diễn giải, dùng thứ tự sau:

1. `docs/TECH_SPEC_WHALE_ALERTS_SYMBOL_KLINE_INTELLIGENCE_UPGRADE_20260428.md`
2. `docs/IMPLEMENTATION_PLAN_WHALE_ALERTS_SYMBOL_KLINE_INTELLIGENCE_UPGRADE_20260428.md`
3. `docs/TASKBOARD_WHALE_ALERTS_SYMBOL_KLINE_INTELLIGENCE_UPGRADE_20260428.md`
4. `docs/WHALE_ALERTS_SYMBOL_KLINE_INTELLIGENCE_UPGRADE_TRACEABILITY_MATRIX_20260428.md`
5. `docs/WHALE_ALERTS_SYMBOL_KLINE_INTELLIGENCE_UPGRADE_SELF_AUDIT_AND_TEST_PROTOCOL_20260428.md`
6. `quality/QUALITY.md`
7. `quality/RUN_CODE_REVIEW.md`
8. `quality/RUN_INTEGRATION_TESTS.md`
9. `quality/RUN_SPEC_AUDIT.md`
10. `AGENTS.md`

## 5. Các quyết định đã khóa

### 5.1 Surface và semantics chính

1. `whale-alerts/:symbol` tiếp tục dùng `KLineChartPanel` làm surface trung tâm.
2. Không thay candle surface bằng ECharts hoặc chart engine khác.
3. KLine intelligence phải được hiểu là một workspace thống nhất, không phải tập hợp pane chắp vá.

### 5.2 Flow intelligence target design

1. `CVD normalized` phải đi ở pane CVD riêng.
2. `Buy Strength` và `Institutional Strength` phải đi ở pane strength riêng nhưng cùng trục X với pane CVD.
3. `CVD raw` không được vẽ chung scale trực tiếp với `Strength raw` nếu chưa chuẩn hóa.
4. `CVD raw` vẫn phải hiện trong tooltip hoặc info panel để giữ tính trung thực dữ liệu.
5. Heatmap giai đoạn này chỉ làm theo `time bucket`, chưa làm footprint theo giá x thời gian.

### 5.3 Whale marker rule

1. Whale marker chỉ áp dụng cho top 10% nến đang hiển thị trong viewport.
2. Quy tắc đếm là `max(1, ceil(visibleCandles * 10%))` khi có candidate hợp lệ.
3. Marker score phải dựa trên dữ liệu whale thực, không dùng heuristic trang trí.

### 5.4 Selected session truth

1. Bubble chart và advisory tiếp tục bám `selected session` từ KLine.
2. Hover không đổi selected session.
3. Click candle đổi selected session.
4. Khi đổi symbol hoặc timeframe làm session cũ không còn hợp lệ, phải reset theo `latest valid session`.

### 5.5 Immutable source protection

Không được sửa trực tiếp các file sau:

1. `frontend/src/components/WhaleBubbleChart.jsx`
2. `frontend/src/components/WhaleAnalyticsTab.jsx`
3. `frontend/src/components/modern/ModularPositionDeck.jsx`

### 5.6 SSOT và MDSU

1. Không tạo pipeline song song ngoài SSOT hiện có cho `whale alert`, `darkmoney flow`, `ai advisory`.
2. Nếu cần mở rộng dữ liệu KLine intelligence, ưu tiên mở rộng contract `whale analytics snapshot` hiện có thay vì dựng route nghiệp vụ mới song song.
3. Nếu có đụng tới dữ liệu nến/OHLCV ở backend, phải tuân thủ MDSU và không được mở direct query mới ở layer view/service nghiệp vụ.

## 6. File anchors hiện tại

### Frontend

1. `frontend/src/components/KLineChartPanel.jsx`
2. `frontend/src/pages/WhaleAlertsDashboard.jsx`
3. `frontend/src/pages/StockDetail.jsx`
4. `frontend/src/hooks/useWhaleAnalyticsData.js`
5. `frontend/src/utils/whaleTimeAdapter.js`

### Backend

1. `backend/portfolio/services_whale_analytics_snapshot.py`
2. `backend/portfolio/views_whale_analytics.py`
3. `backend/portfolio/tests/test_whale_analytics_snapshot_api.py`
4. `backend/portfolio/tests/test_whale_analytics_snapshot_flow_series.py`
5. `backend/portfolio/tests/test_whale_orders_ssot_parity.py`
6. `backend/portfolio/tests/test_order_flow.py`

## 7. Chỉ dẫn cho đội code

1. Bắt đầu từ `Flow View Model` và contract semantics, không nhảy vào tô heatmap trước.
2. Sau edit thực chất đầu tiên trong từng slice phải chạy focused validation ngay.
3. Không gộp nhiều slice độc lập vào một patch lớn.
4. Mọi text UI mới phải qua i18n tiếng Việt có đầy đủ dấu.
5. Không được đánh dấu xong nếu chưa có evidence pack, ledger sync và progress sync.
6. Với mọi slice chạm UI/runtime, phải refresh dev stack trước khi giao auditor.

## 8. Chỉ dẫn cho auditor nội bộ

1. Audit theo traceability matrix trước, không audit cảm tính.
2. Kiểm đầu tiên luôn là immutable source protection.
3. Với heatmap và marker, phải audit bằng zoom/pan/timeframe change, không chỉ screenshot tĩnh.
4. Với pane CVD và pane strength, phải đối chiếu đúng bucket giữa candle, tooltip, pane và selected session.
5. Slice nào thiếu payload proof hoặc residual risk note thì chưa được PASS.

## 9. Checklist nghiệm thu tối thiểu

### 9.1 Visual / UX

1. KLineChart là surface trung tâm duy nhất.
2. Có pane `CVD` và pane `Strength` độc lập nhưng cùng trục X.
3. Có heatmap overlay bật/tắt được.
4. Có whale marker theo viewport.
5. Tooltip có toggle và có đủ ngữ cảnh flow.

### 9.2 Functional

1. Bubble và advisory đổi đúng theo selected session.
2. Heatmap không lệch bucket với candle.
3. Whale marker không tính theo toàn dataset.
4. Bubble source files bất biến.
5. Stock Detail không regress.

### 9.3 Validation / Evidence

1. Frontend build pass.
2. Backend focused suites pass nếu có contract diff.
3. Có screenshot/video cho heatmap, pane, marker, session sync.
4. Có payload snapshot cho contract slices.
5. Ledger và Progress Dashboard đã đồng bộ.

## 10. Quy tắc chuyển sang coding

Đội code chỉ được xem là đủ điều kiện coding khi:

1. Bộ tài liệu trong gói này đã tồn tại đầy đủ.
2. Reviewer xác nhận semantics và run order đã khóa.
3. Taskboard có owner, acceptance, test gate và evidence cho từng slice.

## 11. Câu chốt bắt buộc

Whale Alerts Symbol KLine Intelligence Upgrade là bài toán độ tin cậy dữ liệu và khả năng ra quyết định thực chiến trước, hiệu ứng thị giác sau.

Nguyên tắc không được vi phạm:

1. Thà hiển thị trạng thái degraded còn hơn hiển thị sai bucket.
2. Thà giảm một lớp visual còn hơn phá selected session truth.
3. Thà mở rộng SSOT hiện có còn hơn tạo thêm pipeline song song.
# TRACEABILITY MATRIX - Whale Alerts Symbol KLine Intelligence Upgrade

## 1. Mục tiêu

Ma trận này dùng để truy vết trực tiếp từ yêu cầu tối ưu KLine intelligence sang quyết định kiến trúc, slice thực hiện và bằng chứng audit bắt buộc.

## 2. Ma trận truy vết

| Req ID | Yêu cầu | Quyết định đã khóa | Tài liệu triển khai | Task ID | Bằng chứng audit bắt buộc |
|---|---|---|---|---|---|
| KIU-01 | KLine phải là surface trung tâm duy nhất cho route `whale-alerts/:symbol` | Không thay candle engine; không quay lại chart chắp vá | Implementation Plan mục 4, Handoff Master mục 5.1 | FE-3.1, FE-5.3 | Route screenshot + code-path cleanup proof |
| KIU-02 | Tooltip, pane, heatmap, marker phải cùng bucket thời gian với candle | Mọi lớp dùng chung `Flow View Model` và `canonical minute key` | Tech Spec mục 3, 7 | FE-1.1, FE-1.2, FE-3.2, FE-4.3 | Tooltip parity test + payload proof |
| KIU-03 | CVD và Strength phải gộp thành một pane so sánh duy nhất | `Flow Compare pane` thay cho multiple panes | Implementation Plan mục 4, Tech Spec mục 4 | FE-3.1 | Screenshot pane + regression tests |
| KIU-04 | Heatmap dòng tiền phải tích hợp trên KLine và có thể dùng để đọc nóng/lạnh theo bucket | Heatmap chỉ theo time bucket ở giai đoạn này; không làm footprint giá | Implementation Plan mục 4, Tech Spec mục 5 | FE-4.1 | 4 screenshot mode + payload heatmap |
| KIU-05 | Whale marker phải phản ánh top 10% visible candles, không theo toàn dataset | `max(1, ceil(visible*10%))`, score theo whale data thật | Handoff Master mục 5.3, Tech Spec mục 6 | FE-4.2, FE-4.3 | Zoom/pan video + viewport test |
| KIU-06 | Tooltip phải đủ ngữ cảnh thực chiến và có toggle | Tooltip v2 gồm OHLCV + flow + heat + confidence | Tech Spec mục 7 | FE-3.2 | Hover screenshot + tooltip test |
| KIU-07 | Bubble chart và AI advisory phải tiếp tục bám selected session từ KLine | Hover không mutate session; click candle là source of truth | Handoff Master mục 5.4, Tech Spec mục 8 | FE-5.1 | Click-sync video + request payload `trade_date` |
| KIU-08 | Khi dữ liệu flow/heatmap thiếu, UI phải báo degraded thay vì im lặng hoặc hiển thị sai | `quality_flags` và `quality_state` là bắt buộc | Implementation Plan mục 6, Tech Spec mục 9 | BE-2.2, FE-3.3 | Degraded payload snapshot + UI proof |
| KIU-09 | Bubble source của modern dashboard phải bất biến | Không sửa 3 source files immutable | Handoff Master mục 5.5 | FE-5.3, QA-6.3 | Diff proof sạch cho 3 file immutable |
| KIU-10 | Không tạo pipeline song song ngoài SSOT hiện có | Mở rộng snapshot route hiện có; không thêm route nghiệp vụ song song | Implementation Plan mục 6, mục 13 | ARC-02, BE-2.1, FE-5.3 | SSOT map + review note + code proof |
| KIU-11 | Tối ưu phải chịu được runtime thực, không làm route chậm bất thường | Cache key versioning, cold-path hardening, feature flags | Implementation Plan mục 7, mục 11 | BE-2.3, OPS-6.4 | Timing evidence + runtime rebuild smoke |
| KIU-12 | Mỗi slice phải có test gate và evidence đủ để audit độc lập | Không có evidence thì xem như chưa làm | Taskboard mục J, Self-Audit Protocol | QA-6.3, DOC-6.5 | Evidence template + ledger + progress sync |
| GOV-01 | Mọi text UI mới phải qua i18n tiếng Việt đầy đủ dấu | Không lộ raw key hoặc text tạm | AGENTS, Handoff Master mục 7 | FE-3.2, FE-3.3, FE-4.1 | i18n diff + runtime proof |
| GOV-02 | Runtime/UI change phải refresh dev stack trước khi bàn giao | Rebuild frontend/backend đúng bề mặt touched | Self-Audit Protocol mục 3 | OPS-6.4 | Docker rebuild log + smoke note |
| GOV-03 | Mọi docs thay đổi phải được audit và sync ledger/progress | Doc-only change vẫn phải có audit report | AI Coding Regulation, Evidence Template | DOC-6.5 | Audit report + ledger/progress entry |

## 3. Quy tắc sử dụng matrix

1. Mỗi slice phải map ít nhất một `Req ID`.
2. Không có bằng chứng ở cột cuối thì slice chưa được PASS.
3. Nếu immutable source files có diff runtime, toàn bộ chương trình phải bị kéo về `FAIL` cho tới khi sửa sạch.
4. Nếu heatmap hoặc marker không có video zoom/pan mà chỉ có screenshot tĩnh, slice tương ứng chỉ được `PASS WITH NOTES` tối đa trong audit nội bộ.
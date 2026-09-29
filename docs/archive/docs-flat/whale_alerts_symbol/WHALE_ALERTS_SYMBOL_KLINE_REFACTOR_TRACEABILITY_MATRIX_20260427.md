# TRACEABILITY MATRIX - Whale Alerts Symbol Kline Refactor

## 1. Mục tiêu

Ma trận này dùng để truy vết trực tiếp từ yêu cầu người dùng sang tài liệu triển khai, slice thực hiện và bằng chứng audit.

## 2. Ma trận truy vết

| Req ID | Yêu cầu gốc | Quyết định đã khóa | Tài liệu triển khai | Task ID | Bằng chứng audit bắt buộc |
|---|---|---|---|---|---|
| WAK-01 | Thay 3 chart cũ bằng một KlineChart trung tâm | Dùng Kline behavior từ Stock Detail, không giữ DarkMoneyMasterChart làm main surface | Execution Plan mục 5.1 | FE-1.1, FE-3.1 | Build PASS, route render proof, diff xác nhận main chart path mới |
| WAK-02 | Pane kỹ thuật phải hiển thị whale buy/sell, CVD, strength mua/bán, institutional strength cùng trục thời gian | Mọi metric gắn theo candle/session contract thống nhất | Execution Plan mục 5.1, 5.3 | ARC-03, FE-1.2, BE-5.1 | Payload sample + tooltip proof + regression tests |
| WAK-03 | Hover nến có tooltip đầy đủ và có tùy chọn ẩn/hiện | Tooltip point-anchored, có toggle rõ trên UI | Execution Plan mục 5.3 | FE-1.2 | UI recording, build PASS, test toggle/hover PASS |
| WAK-04 | Click 1 phiên phải hiện bubble chart của đúng phiên đó | Selected session state là nguồn sự thật cho bubble | Execution Plan mục 5.1, 5.3 | FE-1.4, FE-2.2 | Session click proof, payload `trade_date`, sync test PASS |
| WAK-05 | Lần đầu load phải hiện bubble của phiên mới nhất | Latest valid trading session, không lấy ngày lịch mù | Execution Plan mục 5.3 | FE-1.4, FE-2.2 | First-load screenshot/video + session selector payload |
| WAK-06 | Không sửa code bubble chart của modern dashboard, chỉ copy sang whale-alert/symbol | Source files `WhaleBubbleChart.jsx`, `WhaleAnalyticsTab.jsx`, `ModularPositionDeck.jsx` là immutable | Execution Plan mục 2.1, 5.2 | ARC-01, FE-2.1, FE-2.4 | Git diff/source immutability report = clean |
| WAK-07 | Bubble AI advisory phải thay bằng module từ Stock Detail, nội dung ngắn theo phiên hiện tại | Dùng advisory adapter từ Stock Detail nhưng scope theo selected session | Execution Plan mục 5.1 | FE-2.3 | Advisory request/response snapshot + UI evidence + regression note |
| WAK-08 | Chuyển Order Flow Radar xuống dưới KlineChart ở Stock Detail | Stock Detail layout đổi, semantics giữ nguyên | Execution Plan mục 5.1 | FE-4.1, FE-4.2 | Stock Detail screenshot trước/sau, build PASS, regression checks |
| WAK-09 | W2+W4 và Dark Money phải gọn hơn và sang cột phải | Compact cards, không lặp số liệu chart | Execution Plan mục 5.1 | FE-3.2 | Screenshot cột phải + content review checklist |
| WAK-10 | Loại bỏ code cũ dư thừa chỉ giữ code sau refactor | Old chart path retired sau cutover | Execution Plan mục 5.1, 6 | FE-3.3 | Diff cleanup + self-audit dual-path checklist PASS |
| WAK-11 | Bổ sung icon cá mập cho 10% nến đang hiển thị có hoạt động cá mập lớn nhất | Chỉ tính theo viewport hiện tại, `max(1, ceil(visible*10%))` | Execution Plan mục 5.3 | FE-1.3 | Zoom/pan video + integration test + tooltip semantic proof |
| GOV-01 | Tôn trọng quy định dự án, AI coding và self-audit theo slice | Mỗi slice phải có validation ngay sau sửa chính, có evidence và ledger sync | Self-Audit Protocol mục 3, QUALITY.md mục 5 | QA-6.3 | Self-audit checklist đã tick, evidence pack đủ 5 mục |
| GOV-02 | Tiếng Việt i18n đầy đủ cho text mới | Text mới bắt buộc qua i18n có dấu | Execution Plan mục 2.2 | FE-1.2, FE-3.2, FE-4.1 | i18n diff + runtime proof không lộ raw key |
| GOV-03 | Runtime/UI change phải refresh dev stack để audit | Bắt buộc rebuild/restart stack bị ảnh hưởng sau mỗi burst runtime/UI | Self-Audit Protocol mục 6 | OPS-6.4 | Docker rebuild/restart log + smoke proof |
| QA-01 | Phải có tài liệu tự audit nội bộ, test và minh chứng hoàn thành từng slice | Handoff pack + protocol + evidence template là bắt buộc | Handoff Master mục 4, Self-Audit Protocol, Evidence Template | QA-6.1, QA-6.2, QA-6.3 | Evidence template đã điền + verdict mỗi slice |

## 3. Quy tắc sử dụng matrix

1. Mỗi PR hoặc slice phải tham chiếu ít nhất một `Req ID`.
2. Slice không được đánh dấu PASS nếu chưa có cột bằng chứng tương ứng.
3. Nếu source immutable files có diff, toàn bộ slice FE-2.x phải bị chuyển về FAIL cho đến khi được sửa.
4. Nếu code đã đổi nhưng matrix chưa cập nhật, final auditor phải giữ trạng thái `PARTIAL` hoặc `FAIL`.
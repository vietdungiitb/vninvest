# TRACEABILITY MATRIX - WHALE ANALYTICS V2

## 1. Mục tiêu

Ma trận này dùng để audit sát yêu cầu gốc của người dùng với code và bằng chứng thực tế.

## 2. Ma trận truy vết

| Req ID | Yêu cầu gốc | Quyết định đã khóa | Tài liệu triển khai | Task ID | Bằng chứng audit |
|-------|-------------|--------------------|---------------------|---------|------------------|
| UX-01 | Tooltip không che dữ liệu | Dùng Information Panel docked thay cho popup làm nguồn đọc chính | Frontend Spec mục 4.1 | FE-1.1 | `npm run build` PASS; `WhaleBubbleChart.tooltip.test.jsx` PASS; panel render path nằm ngoài plot trong `WhaleBubbleChart.jsx` |
| UX-02 | Filter quy mô lệnh phải rõ ràng | Filter do user chủ động chọn, dùng preset + slider log-scale | Frontend Spec mục 4.2 | FE-1.2 | Build PASS; local filter path trong `WhaleBubbleChart.jsx`; self-audit diff xác nhận line series không đi qua bubble threshold |
| UX-03 | Không làm sai cảm nhận mật độ lệnh | Cấm opacity taper mặc định, cấm hidden-by-density, cấm cluster mặc định | Plan mục 3.1, Frontend Spec mục 3 | FE-1.3 | Render path dùng global bubble layering; build PASS; self-audit diff không có opacity taper/hidden-by-density |
| UX-04 | Nhìn chart biết line nào là gì | Dùng direct label/endLabel | Frontend Spec mục 4.4 | FE-1.4 | Build PASS; line label/endLabel path trong `WhaleBubbleChart.jsx` |
| UX-05 | Không được lộ raw key | Sửa fallback i18n | Frontend Spec mục 4.5 | FE-1.5 | `vi.js/en.js` dictionary coverage; degraded/tooltip/component copy dùng `defaultValue`; build PASS |
| DATA-01 | Có mốc ref/high/low/trần/sàn để so bối cảnh giá | Thêm `session_levels` từ backend, không suy diễn ở FE | API Spec mục 6.2, Backend Spec mục 4.2 | BE-2.1, FE-2.2 | Backend regression `14/14` PASS; HTTP smoke `HPG` trả đủ `session_levels`; FE adapter + overlay render path tồn tại |
| DATA-02 | Zoom để giãn vùng dày | DataZoom sync hai pane, không phá linear time | Frontend Spec mục 5.2 | FE-2.3 | Build PASS; synchronized `dataZoom` path với `xAxisIndex: [0,1]` và `filterMode: none` trong `WhaleBubbleChart.jsx` |
| ADV-01 | Có order flow speed | Backend trả `flow_series.speed` với canonical unit | API Spec mục 6.3, Backend Spec mục 7 | BE-3.1, FE-3.3 | Backend regression PASS; HTTP smoke `HPG` có `speed_unit=events_per_second`; tooltip/panel tests PASS |
| ADV-02 | Có percentile 10 phiên thay cho nhị phân | Backend trả percentile + sample size, FE render progress bar | API Spec mục 6.3, Backend Spec mục 8 | BE-3.2, FE-3.3 | Backend regression PASS; HTTP smoke `HPG` có percentile + sample size, `FPT/DGC` trả `null`; panel render path dùng progress bar |
| AUD-01 | Audit phải bám đúng yêu cầu và code thực tế | Taskboard không tick trước, audit theo matrix | Handoff mục 2.3, QA Pack mục 4 | AUD-4.2 | Taskboard + ledger + progress dashboard đã đồng bộ; matrix này đã đối chiếu lại theo validation runtime và focused tests ngày 2026-04-24 |

## 3. Quy tắc sử dụng matrix

1. Mỗi PR hoặc slice phải tham chiếu ít nhất một `Req ID`.
2. Auditor không được kết luận pass nếu không có bằng chứng tương ứng cột cuối.
3. Nếu code thay đổi nhưng matrix chưa cập nhật, audit phải gắn cờ `PARTIAL` hoặc `FAIL` tùy mức độ.
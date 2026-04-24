# TRACEABILITY MATRIX - WHALE ANALYTICS V2

## 1. Mục tiêu

Ma trận này dùng để audit sát yêu cầu gốc của người dùng với code và bằng chứng thực tế.

## 2. Ma trận truy vết

| Req ID | Yêu cầu gốc | Quyết định đã khóa | Tài liệu triển khai | Task ID | Bằng chứng audit |
|-------|-------------|--------------------|---------------------|---------|------------------|
| UX-01 | Tooltip không che dữ liệu | Dùng Information Panel docked thay cho popup làm nguồn đọc chính | Frontend Spec mục 4.1 | FE-1.1 | Video hover bubble/line + screenshot panel |
| UX-02 | Filter quy mô lệnh phải rõ ràng | Filter do user chủ động chọn, dùng preset + slider log-scale | Frontend Spec mục 4.2 | FE-1.2 | Screenshot preset + clip slider |
| UX-03 | Không làm sai cảm nhận mật độ lệnh | Cấm opacity taper mặc định, cấm hidden-by-density, cấm cluster mặc định | Plan mục 3.1, Frontend Spec mục 3 | FE-1.3 | Screenshot vùng dày + review diff |
| UX-04 | Nhìn chart biết line nào là gì | Dùng direct label/endLabel | Frontend Spec mục 4.4 | FE-1.4 | Screenshot chart với labels |
| UX-05 | Không được lộ raw key | Sửa fallback i18n | Frontend Spec mục 4.5 | FE-1.5 | Screenshot ngôn ngữ thực tế |
| DATA-01 | Có mốc ref/high/low/trần/sàn để so bối cảnh giá | Thêm `session_levels` từ backend, không suy diễn ở FE | API Spec mục 6.2, Backend Spec mục 4.2 | BE-2.1, FE-2.2 | Payload capture + screenshot chart |
| DATA-02 | Zoom để giãn vùng dày | DataZoom sync hai pane, không phá linear time | Frontend Spec mục 5.2 | FE-2.3 | Video zoom |
| ADV-01 | Có order flow speed | Backend trả `flow_series.speed` với canonical unit | API Spec mục 6.3, Backend Spec mục 7 | BE-3.1, FE-3.3 | Payload + screenshot/clip |
| ADV-02 | Có percentile 10 phiên thay cho nhị phân | Backend trả percentile + sample size, FE render progress bar | API Spec mục 6.3, Backend Spec mục 8 | BE-3.2, FE-3.3 | Payload + screenshot |
| AUD-01 | Audit phải bám đúng yêu cầu và code thực tế | Taskboard không tick trước, audit theo matrix | Handoff mục 2.3, QA Pack mục 4 | AUD-4.2 | Review checklist + ledger |

## 3. Quy tắc sử dụng matrix

1. Mỗi PR hoặc slice phải tham chiếu ít nhất một `Req ID`.
2. Auditor không được kết luận pass nếu không có bằng chứng tương ứng cột cuối.
3. Nếu code thay đổi nhưng matrix chưa cập nhật, audit phải gắn cờ `PARTIAL` hoặc `FAIL` tùy mức độ.
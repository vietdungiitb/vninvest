# TRACEABILITY MATRIX - WHALE ANALYTICS UI REFACTOR 2026-04-24

## 1. Mục tiêu

Ma trận này dùng để đối chiếu trực tiếp yêu cầu giao diện mới với task triển khai, code path dự kiến và bằng chứng nghiệm thu nội bộ.

## 2. Ma trận truy vết

| Req ID | Yêu cầu đã khóa | Quyết định triển khai | Tài liệu tham chiếu | Task ID | Bằng chứng nghiệm thu bắt buộc |
|-------|------------------|-----------------------|---------------------|---------|--------------------------------|
| UI-01 | Header chart phải ưu tiên mã cổ phiếu và giá hiện tại | Thay khối filter text cũ bằng symbol CTA + live price | Plan mục 4.1 | FE-UI-1 | `WhaleBubbleChart.jsx` render symbol link + current quote badge; route canonical khóa `/stocks/:symbol`; `npm run build` PASS |
| UI-02 | Preset buttons phải đổi thành một combobox duy nhất | Dùng select cho ngưỡng bubble, giữ các mức cũ | Plan mục 4.1 | FE-UI-1 | Chỉ còn một `select` cho `BUBBLE_FILTER_PRESETS`; preset buttons cũ đã bị loại bỏ; build PASS |
| UI-03 | Nhà đầu tư phải có thể ẩn panel phải để xem chart rộng hơn | Thêm toggle panel ngay cạnh combobox | Plan mục 4.3 | FE-UI-2 | `isInfoPanelVisible` điều khiển mount/unmount panel; build PASS; frontend container rebuild PASS |
| UI-04 | Các nhãn line không được chiếm không gian ngang của chart | Loại label nổi không cần thiết, dời toàn bộ line label vào bảng thông tin | Plan mục 4.2 | FE-UI-3 | `endLabel` chính đã được gỡ khỏi chart; panel phải render `infoPanelLineItems`; build PASS |
| UI-05 | Không được mất bất kỳ thông tin line nào khi bỏ label khỏi chart | Bảng thông tin phải chứa đủ reference/high/low/ceiling/floor/price/CVD/buy strength/institutional strength/speed | Plan mục 4.2 | FE-UI-3 | Checklist 10 label đã được khóa trong `getPanelLineItems(...)`; diagnostics sạch; reviewer self-audit pass |
| UI-06 | Người dùng phải hiểu line qua màu mà không cần label nổi | Label trong bảng thông tin dùng đúng màu line | Plan mục 4.2 | FE-UI-3 | Mỗi label panel đi kèm dot màu tương ứng với line chart trong `infoPanelLineItems`; build + Docker rebuild PASS |
| AI-01 | Có CTA Tư vấn AI ngay tại Whale Analytics | Thêm nút `Tư vấn AI` cạnh `Xác thực SSOT` và `Dữ liệu realtime` | Plan mục 4.4 | FE-AI-4 | `WhaleAnalyticsTab.jsx` đã thêm CTA cạnh hai badge hiện hữu; build PASS |
| AI-02 | Advisory mở tại chỗ cho mã đang xem | Modal advisory lazy-load theo symbol hiện tại | Plan mục 4.4 | FE-AI-4 | `WhaleAnalyticsAdvisoryModal.jsx` mount theo state mở modal và dùng symbol hiện tại; loading/error/fallback đã có |
| AI-03 | Không để advisory phá trải nghiệm chart | Modal không auto-load nặng trước click, không block chart khi lỗi | Plan mục 4.4, mục 7 | FE-AI-4 | `useEffect` chặn fetch khi `!isOpen`; modal hiển thị fallback thay vì chặn chart; build PASS |
| AUD-UI-01 | Mọi thay đổi phải có audit trail và bằng chứng thật | Cập nhật taskboard, matrix, ledger, progress dashboard cho từng slice | Plan mục 6, mục 9 | QA-AUD-5 | Taskboard + matrix + ledger + progress đã đồng bộ; diagnostics sạch; build + Docker rebuild PASS |

## 3. Quy tắc sử dụng matrix

1. Mỗi commit hoặc slice phải tham chiếu tối thiểu một `Req ID`.
2. Nếu code thay đổi nhưng matrix chưa cập nhật, auditor nội bộ phải đánh dấu `PARTIAL` hoặc `FAIL`.
3. Không có bằng chứng ở cột cuối thì không được phép đánh dấu slice hoàn thành.
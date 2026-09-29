# TASKBOARD THỰC THI - WHALE ANALYTICS UI REFACTOR 2026-04-24

## 1. Mục đích

Taskboard này là checklist giao việc chính thức cho đội code và là bảng tick audit nội bộ sau triển khai.

Quy ước trạng thái:

1. `[ ]` Chưa bắt đầu
2. `[/]` Đang làm
3. `[x]` Hoàn thành
4. `[!]` Bị chặn

Nguyên tắc tick trạng thái:

1. Không tick hoàn thành nếu chưa có code.
2. Không tick hoàn thành nếu chưa có validation thật.
3. Không tick hoàn thành nếu progress dashboard và ledger chưa cập nhật.

## 2. Trình tự triển khai bắt buộc

Đội code phải đi theo thứ tự sau:

1. `FE-UI-1` Header + Filter Refactor
2. `FE-UI-2` Panel Toggle + Space Recovery
3. `FE-UI-3` Legend Migration vào bảng thông tin
4. `FE-AI-4` Advisory CTA + Modal
5. `QA-AUD-5` Validation + Audit Closure

Lý do:

1. `FE-UI-1` khóa bề mặt đầu vào và điều hướng chính trước.
2. `FE-UI-2` giải quyết cấu trúc layout trước khi dời legend semantics.
3. `FE-UI-3` chỉ nên làm sau khi layout panel đã ổn định.
4. `FE-AI-4` là mở rộng hành động, nên vào sau khi visual shell đã khóa.
5. `QA-AUD-5` chỉ thực hiện sau khi toàn bộ slice code đã xong.

## 3. Danh sách slice

### FE-UI-1 Refactor header điều khiển bubble chart

Trạng thái: `[x]`

1. Priority: Critical
2. Owner: Frontend Lead
3. Files neo:
   - `frontend/src/components/WhaleBubbleChart.jsx`
   - `frontend/src/components/WhaleAnalyticsTab.jsx`
   - `frontend/src/i18n/vi.js`
   - `frontend/src/i18n/en.js`
4. Output bắt buộc:
   - link mã cổ phiếu sang `/stocks/:symbol`
   - hiển thị giá hiện tại trong header chart
   - combobox filter duy nhất thay cho preset buttons
   - vẫn giữ slider log-scale
5. Acceptance:
   - link điều hướng đúng route canonical `/stocks/:symbol`
   - giá hiện tại lấy từ state thực, không hard-code
   - preset buttons cũ bị loại bỏ hoàn toàn
   - build pass
6. Minh chứng yêu cầu:
   - ảnh hoặc ghi chú runtime xác nhận header mới
   - `npm run build` PASS

Ghi chú triển khai 2026-04-24:

1. Đã thay block filter cũ bằng symbol CTA link tới `/stocks/:symbol` và badge giá hiện tại lấy từ `quotesBySymbol` với fallback `--`.
2. Preset button cũ đã được thay hoàn toàn bằng một combobox duy nhất, vẫn giữ slider log-scale bên dưới.
3. Validation đã PASS với `npm run build` trong `frontend/`.

### FE-UI-2 Thêm toggle ẩn/hiện bảng thông tin

Trạng thái: `[x]`

1. Priority: Critical
2. Owner: Frontend
3. Files neo:
   - `frontend/src/components/WhaleBubbleChart.jsx`
4. Output bắt buộc:
   - icon hoặc nút rõ trạng thái panel mở/đóng
   - chart mở rộng khi panel ẩn
5. Acceptance:
   - thao tác toggle không phá layout
   - hover, zoom, sync không hỏng
   - mobile/desktop không vỡ markup
6. Minh chứng yêu cầu:
   - `npm run build` PASS
   - self-audit runtime note về panel toggle

Ghi chú triển khai 2026-04-24:

1. Đã thêm nút toggle panel ngay cạnh combobox để mở/đóng bảng thông tin theo state cục bộ `isInfoPanelVisible`.
2. Khi panel ẩn, chart thu hồi toàn bộ chiều ngang phần còn lại mà không đụng tới `dataZoom`, hover sync hoặc flow pane.
3. Validation đã PASS với `npm run build` và `docker compose -f c:/Mujoco Projects/vninvest/docker-compose.dev.yml up -d --build frontend`.

### FE-UI-3 Di chuyển toàn bộ label line vào bảng thông tin

Trạng thái: `[x]`

1. Priority: Critical
2. Owner: Frontend + Reviewer
3. Files neo:
   - `frontend/src/components/WhaleBubbleChart.jsx`
   - `frontend/src/i18n/vi.js`
   - `frontend/src/i18n/en.js`
4. Output bắt buộc:
   - bỏ label nổi không còn cần trong chart
   - bảng thông tin hiển thị đủ line label với màu tương ứng
   - không mất thông tin so với trước
5. Checklist label bắt buộc trong bảng thông tin:
   - Giá tham chiếu
   - Đỉnh phiên
   - Đáy phiên
   - Giá trần
   - Giá sàn
   - Đường giá hiện tại
   - CVD
   - Sức mạnh mua
   - Sức mạnh tổ chức
   - Tốc độ sự kiện
6. Acceptance:
   - auditor nội bộ xác nhận không thiếu label line nào
   - màu label khớp line trên chart
   - chart có thêm không gian ngang hữu ích
7. Minh chứng yêu cầu:
   - `npm run build` PASS
   - checklist label được tick đầy đủ trong audit note

Ghi chú triển khai 2026-04-24:

1. Đã bỏ các `endLabel` nổi của price/CVD/buy strength/institutional strength và giữ semantics line trong bảng thông tin.
2. Checklist label đã được bù đủ trong panel phải: Giá tham chiếu, Đỉnh phiên, Đáy phiên, Giá trần, Giá sàn, Đường giá hiện tại, CVD, Sức mạnh mua, Sức mạnh tổ chức, Tốc độ sự kiện.
3. Mapping màu đã khóa theo line thực tế trên chart bằng dot màu trong panel; validation PASS với build, diagnostics sạch và frontend container rebuild thành công.

### FE-AI-4 Thêm CTA Tư vấn AI và modal advisory

Trạng thái: `[x]`

1. Priority: High
2. Owner: Frontend + AI Integrator
3. Files neo:
   - `frontend/src/components/WhaleAnalyticsTab.jsx`
   - `frontend/src/api/client.js`
   - component modal advisory mới hoặc component tái sử dụng
   - `frontend/src/i18n/vi.js`
   - `frontend/src/i18n/en.js`
4. Output bắt buộc:
   - nút `Tư vấn AI` cạnh `Xác thực SSOT` và `Dữ liệu realtime`
   - modal advisory mở theo symbol hiện tại
   - loading/error/fallback state rõ ràng
5. Acceptance:
   - modal không làm block chart khi API lỗi hoặc chậm
   - advisory hiển thị tối thiểu action/risk/confidence/summary
   - không tự tải advisory nặng trước khi user bấm nút
6. Minh chứng yêu cầu:
   - `npm run build` PASS
   - runtime note hoặc focused test cho modal state

Ghi chú triển khai 2026-04-24:

1. Đã thêm nút `Tư vấn AI` cạnh `Xác thực SSOT` và `Dữ liệu realtime` trong `WhaleAnalyticsTab.jsx`.
2. Đã thêm `WhaleAnalyticsAdvisoryModal.jsx` với lazy-load theo `isOpen`, hiển thị action/risk/confidence/summary và loading/error/fallback rõ ràng.
3. Runtime note: advisory chỉ fetch khi user bấm nút vì `useEffect` trong modal chặn bằng `if (!isOpen || !normalizedSymbol) return;`; build PASS và diagnostics sạch.

### QA-AUD-5 Chạy validation và đóng audit vòng nội bộ

Trạng thái: `[x]`

1. Priority: Critical
2. Owner: QA + Auditor nội bộ
3. Output bắt buộc:
   - build pass
   - Docker frontend rebuild/restart pass
   - diagnostics sạch
   - traceability matrix cập nhật
   - ledger/progress dashboard đồng bộ
4. Acceptance:
   - không còn slice nào thiếu minh chứng
   - final report đủ cho final auditor đọc lại nhanh
5. Minh chứng yêu cầu:
   - `npm run build`
   - `docker compose -f c:/Mujoco Projects/vninvest/docker-compose.dev.yml up -d --build frontend`
   - diagnostics sạch ở file chạm tới

Ghi chú triển khai 2026-04-24:

1. PASSED: `npm run build` trong `frontend/`.
2. PASSED: diagnostics sạch trên `WhaleBubbleChart.jsx`, `WhaleAnalyticsTab.jsx`, `WhaleAnalyticsAdvisoryModal.jsx`, `vi.js`, `en.js`.
3. PASSED: `docker compose -f c:/Mujoco Projects/vninvest/docker-compose.dev.yml up -d --build frontend` đã rebuild/restart frontend dev container thành công.
4. PASSED: taskboard, traceability matrix, ledger và progress dashboard đã được đồng bộ cho final auditor.

## 4. Điều kiện fail ngay

Slice phải bị trả về `FAIL` nếu xảy ra một trong các điều sau:

1. Link mã cổ phiếu không điều hướng đúng `/stocks/:symbol`.
2. Bỏ label line nổi nhưng bảng thông tin không bù đủ thông tin.
3. Panel toggle làm hỏng hover, zoom hoặc time sync.
4. Modal advisory tự phát sinh request nặng ngay khi load trang mà user chưa bấm.
5. Frontend đổi UI nhưng không rebuild/restart container dev.
6. Có sửa code nhưng không cập nhật ledger và progress dashboard.

## 5. Điều kiện sẵn sàng trình final auditor

1. Tất cả slice đã `[x]` với minh chứng thực tế.
2. Matrix truy vết đã map đủ yêu cầu mới.
3. Có báo cáo ngắn gọn nêu rõ kết quả validation, residual risk nếu có.
4. Chỉ sau đó mới được báo final auditor audit lần cuối.
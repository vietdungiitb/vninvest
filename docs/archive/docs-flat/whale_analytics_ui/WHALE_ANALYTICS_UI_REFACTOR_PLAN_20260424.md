# KẾ HOẠCH CHI TIẾT - WHALE ANALYTICS UI REFACTOR 2026-04-24

## 1. Mục tiêu

Đợt thay đổi này nhằm tái cấu trúc giao diện Whale Analytics theo hướng ưu tiên không gian đọc biểu đồ, giảm nhiễu thị giác, tăng tính điều hướng sang Stock Detail và mở một bề mặt AI advisory ngắn gọn ngay trong màn hình Whale Analytics.

Phạm vi mục tiêu đã khóa:

1. Thay block `Lọc ngưỡng bubble / Ngưỡng hiện hành` bằng header mã cổ phiếu có link sang `/stocks/:symbol` và hiển thị giá hiện tại.
2. Thay dãy preset filter button bằng một combobox filter duy nhất.
3. Thêm icon ẩn/hiện bảng thông tin bên phải để người dùng mở rộng vùng chart khi cần.
4. Chuyển toàn bộ nhãn line đang hiển thị nổi trong chart vào bảng thông tin, giữ đúng màu line để không mất ngữ nghĩa.
5. Thêm nút `Tư vấn AI` cạnh `Xác thực SSOT` và `Dữ liệu realtime`, mở modal advisory cho mã đang xem.
6. Giữ đầy đủ tính đúng đắn hiện có: session levels, speed, percentile, degraded mode, zoom sync, tooltip/panel semantics.

Ngoài phạm vi ở vòng này:

1. Không đổi backend contract Whale Analytics snapshot nếu không có blocker thực sự.
2. Không thay route chi tiết cổ phiếu; route canonical hiện tại là `/stocks/:symbol`.
3. Không hợp nhất Whale Analytics vào Stock Detail ở vòng này.
4. Không viết lại AI advisory workflow đầy đủ như Stock Detail; chỉ mở surface advisory tóm tắt phục vụ đọc nhanh.

## 2. Bối cảnh kỹ thuật đã xác nhận

1. Route chi tiết cổ phiếu hiện có trong `frontend/src/App.jsx` là `/stocks/:symbol`.
2. Wrapper chính của Whale Analytics là `frontend/src/components/WhaleAnalyticsTab.jsx`.
3. Biểu đồ và bảng thông tin đang được điều khiển trong `frontend/src/components/WhaleBubbleChart.jsx`.
4. Luồng AI advisory hiện hữu đã có ở `frontend/src/pages/StockDetail.jsx` cùng các API trong `frontend/src/api/client.js`.
5. Footer badge `Xác thực SSOT / Dữ liệu realtime` hiện nằm trong `WhaleAnalyticsTab.jsx`, là vị trí phù hợp để thêm CTA `Tư vấn AI`.

## 3. Nguyên tắc triển khai bắt buộc

1. Chỉ thực hiện thay đổi nhỏ, bám sát bề mặt hiện có, không mở rộng scope ngoài checklist.
2. Mọi text mới phải có i18n Việt/Anh, tiếng Việt là mặc định có dấu đầy đủ.
3. Các line label không còn hiển thị nổi trong chart phải được bù lại đầy đủ trong bảng thông tin; không được mất thông tin.
4. Màu label trong bảng thông tin phải khớp với màu line trên chart.
5. Modal AI chỉ được mở theo nhu cầu người dùng, không tự tải advisory nặng khi chưa bấm nút.
6. Sau mỗi thay đổi frontend phải có build pass và Docker frontend rebuild/restart pass.
7. Mọi slice hoàn thành phải cập nhật progress dashboard và audit ledger.

## 4. Thiết kế mục tiêu

### 4.1 Header điều khiển mới trong WhaleBubbleChart

Thiết kế đích:

1. Góc trái hiển thị mã cổ phiếu dạng CTA/link tới `/stocks/:symbol`.
2. Kề bên là giá hiện tại lấy từ `quotesBySymbol[selectedSymbol]` hoặc fallback hợp lý nếu chưa có quote realtime.
3. Góc phải cùng hàng gồm:
   - combobox filter ngưỡng bubble,
   - nút/icon ẩn/hiện bảng thông tin,
   - giữ slider log-scale ở hàng dưới hoặc cùng khối tùy không gian.

Yêu cầu hiển thị:

1. Khi chưa có quote realtime, phải hiện fallback `--` rõ ràng, không bịa số.
2. Link mã cổ phiếu phải clickable và điều hướng đúng sang `/stocks/:symbol`.
3. Combobox phải giữ các mức filter hiện có:
   - Tất cả
   - > 500 triệu
   - > 1 tỷ
   - > 3 tỷ
   - > 5 tỷ
   - > 10 tỷ

### 4.2 Bảng thông tin phải trở thành legend giàu ngữ nghĩa

Sau refactor, bảng thông tin phải chứa đủ các line/label đang có trong chart, bao gồm tối thiểu:

1. Giá tham chiếu
2. Đỉnh phiên
3. Đáy phiên
4. Giá trần / sàn
5. Đường giá hiện tại
6. CVD hiện tại hoặc giá trị line CVD khi hover line
7. Sức mạnh mua
8. Sức mạnh tổ chức
9. Tốc độ sự kiện

Nguyên tắc mapping màu:

1. Giá tham chiếu: màu sáng trung tính theo line reference.
2. Đỉnh phiên: xanh lá.
3. Đáy phiên: đỏ.
4. Giá trần: tím.
5. Giá sàn: xanh dương nhạt.
6. Đường giá: vàng/amber.
7. CVD: cyan.
8. Sức mạnh mua: lime/green sáng.
9. Sức mạnh tổ chức: sky/cyan-blue.

Nguyên tắc dữ liệu:

1. Snapshot mặc định hiển thị trạng thái line gần nhất có ý nghĩa.
2. Hover line phải cập nhật giá trị đúng series tại timestamp đang hover.
3. Hover bubble vẫn ưu tiên event-level, nhưng bảng line context không được biến mất hoàn toàn.

### 4.3 Cơ chế ẩn/hiện panel phải

1. Trạng thái mặc định: panel mở.
2. Người dùng có thể toggle panel bằng icon rõ trạng thái.
3. Khi panel đóng:
   - chart mở rộng toàn chiều ngang còn lại,
   - không làm hỏng `dataZoom`, hover sync, tooltip logic,
   - footer action bar vẫn giữ nguyên.

### 4.4 AI Advisory modal

Mục tiêu:

1. Tạo một modal advisory ngắn gọn cho mã đang xem mà không kéo toàn bộ workspace Stock Detail sang.
2. Tận dụng API và workflow hiện có từ Stock Detail.

Nội dung tối thiểu trong modal:

1. Tên mã cổ phiếu.
2. Trạng thái advisory hoặc action chính.
3. Risk level.
4. Confidence.
5. Executive summary hoặc summary text tóm tắt.
6. Trạng thái tải và message fallback rõ ràng.

Luồng dữ liệu ưu tiên:

1. Thử gọi `getStockAIAdvisorySession(symbol)` để lấy advisory hiện có.
2. Nếu chưa có advisory khả dụng, cho phép gọi `refreshStockAIAdvisorySession(symbol)` theo pattern an toàn.
3. Không ép generate full advisory components nếu chưa cần; ưu tiên summary/session có sẵn.

## 5. Kế hoạch triển khai theo slice

### Slice FE-UI-1 Header + Filter Refactor

Mục tiêu:

1. Thay header filter cũ bằng header mã cổ phiếu + giá hiện tại + combobox filter.
2. Giữ slider log-scale nhưng không còn preset buttons.

File neo:

1. `frontend/src/components/WhaleBubbleChart.jsx`
2. `frontend/src/components/WhaleAnalyticsTab.jsx`
3. `frontend/src/i18n/vi.js`
4. `frontend/src/i18n/en.js`

Acceptance:

1. Link mã mở đúng `/stocks/:symbol`.
2. Giá hiện tại hiển thị đúng hoặc fallback `--`.
3. Combobox filter thay thế hoàn toàn preset buttons.
4. Build frontend pass.

Minh chứng tối thiểu:

1. `npm run build` pass.
2. Screenshot/dev visual xác nhận header mới.

### Slice FE-UI-2 Panel Toggle + Chart Space Recovery

Mục tiêu:

1. Thêm icon ẩn/hiện panel phải.
2. Mở rộng chart khi panel đóng.

File neo:

1. `frontend/src/components/WhaleBubbleChart.jsx`

Acceptance:

1. Toggle không phá layout.
2. Panel mở/đóng mượt, chart không bị render sai.
3. `dataZoom` và hover vẫn hoạt động.

Minh chứng tối thiểu:

1. `npm run build` pass.
2. Focused UI test hoặc regression manual note cho toggle.

### Slice FE-UI-3 Legend Migration vào bảng thông tin

Mục tiêu:

1. Loại bỏ endLabel/direct label nổi không còn cần thiết trong vùng chart.
2. Chuyển đủ toàn bộ line label vào bảng thông tin với màu tương ứng.

File neo:

1. `frontend/src/components/WhaleBubbleChart.jsx`
2. `frontend/src/i18n/vi.js`
3. `frontend/src/i18n/en.js`

Acceptance:

1. Không thiếu label line nào sau khi migration.
2. Màu label trong bảng thông tin khớp màu line trên chart.
3. Không còn text nổi gây chiếm chiều ngang ngoài nhu cầu bắt buộc.

Minh chứng tối thiểu:

1. `npm run build` pass.
2. Focused test hoặc self-audit checklist xác nhận đủ label.

### Slice FE-AI-4 Advisory CTA + Modal

Mục tiêu:

1. Thêm nút `Tư vấn AI` cạnh các badge footer.
2. Mở modal advisory cho symbol hiện tại.

File neo:

1. `frontend/src/components/WhaleAnalyticsTab.jsx`
2. `frontend/src/api/client.js` nếu cần helper mỏng
3. component modal mới nếu cần
4. `frontend/src/i18n/vi.js`
5. `frontend/src/i18n/en.js`

Acceptance:

1. Nút CTA hiển thị rõ ràng trên cả desktop và mobile tương đối rộng.
2. Modal mở được, hiển thị loading/fallback chuẩn.
3. Advisory không làm block chart khi API chậm hoặc lỗi.

Minh chứng tối thiểu:

1. `npm run build` pass.
2. Focused test cho modal state hoặc audit runtime note.

### Slice QA-AUD-5 Validation + Audit Closure

Mục tiêu:

1. Chạy validation sau các slice UI/AI.
2. Đồng bộ matrix, ledger, progress dashboard.

Acceptance:

1. Build pass.
2. Frontend container rebuild/restart pass.
3. Diagnostics sạch ở file chạm tới.
4. Tài liệu audit được cập nhật nhất quán.

## 6. Kế hoạch test và minh chứng

## 6.1 Test bắt buộc

1. Build:
   - `npm run build` trong `frontend/`
2. Container refresh:
   - `docker compose -f c:/Mujoco Projects/vninvest/docker-compose.dev.yml up -d --build frontend`
3. Diagnostics:
   - kiểm tra sạch lỗi ở các file frontend/docs vừa sửa

## 6.2 Test nên có thêm

1. Focused test cho modal advisory nếu component tách riêng.
2. Focused test hoặc assertion cho toggle panel nếu logic đủ phức tạp.
3. Regression check rằng hover bubble/line vẫn update đúng bảng thông tin.

## 6.3 Minh chứng audit nội bộ

Mỗi slice phải có tối thiểu:

1. Danh sách file sửa.
2. Lệnh validation đã chạy.
3. Kết quả pass/fail.
4. Ghi chú residual risk nếu có.

## 7. Rủi ro và phương án giảm thiểu

1. Rủi ro advisory API chậm hoặc chưa có session.
   - Giảm thiểu: modal có loading/fallback rõ, không khóa chart.
2. Rủi ro mất ngữ nghĩa khi bỏ line label nổi.
   - Giảm thiểu: checklist bắt buộc kiểm đủ line label đã được chuyển vào bảng thông tin.
3. Rủi ro layout vỡ ở màn hình hẹp.
   - Giảm thiểu: panel toggle và container classes phải được kiểm tra ở breakpoint `lg` trở lên và trạng thái stacked.

## 8. Điều kiện sẵn sàng để bắt đầu code

Chỉ được phép bắt đầu code khi đồng thời thỏa:

1. Bộ tài liệu plan + taskboard + matrix + handoff đã tồn tại.
2. Final user approval cho bước coding đã được xác nhận.
3. Mọi slice có acceptance và minh chứng tối thiểu rõ ràng.

## 9. Điều kiện hoàn thành để trình final audit

1. Tất cả slice trên taskboard được tick bằng bằng chứng thật.
2. Build frontend và Docker rebuild pass ở phiên hiện tại.
3. Traceability matrix đã map đủ yêu cầu -> task -> bằng chứng.
4. Progress dashboard và audit ledger đã đồng bộ.
5. Kết quả được báo lại cho final auditor để audit vòng cuối.
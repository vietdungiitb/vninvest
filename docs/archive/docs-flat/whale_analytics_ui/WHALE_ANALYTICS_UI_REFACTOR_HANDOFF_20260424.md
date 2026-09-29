# HANDOFF PACK - WHALE ANALYTICS UI REFACTOR 2026-04-24

## 1. Mục đích bàn giao

Bộ tài liệu này được tạo để bàn giao chính thức cho đội code triển khai đợt refactor UI Whale Analytics theo đúng yêu cầu người dùng và tạo sẵn khung audit nội bộ trước khi final auditor rà soát vòng cuối.

## 2. Thành phần tài liệu bàn giao

1. `docs/WHALE_ANALYTICS_UI_REFACTOR_PLAN_20260424.md`
   - kế hoạch tổng thể, phạm vi, nguyên tắc triển khai, slice và test strategy
2. `docs/WHALE_ANALYTICS_UI_REFACTOR_EXECUTION_TASKBOARD_20260424.md`
   - checklist giao việc và acceptance theo slice
3. `docs/WHALE_ANALYTICS_UI_REFACTOR_TRACEABILITY_MATRIX_20260424.md`
   - ma trận truy vết yêu cầu -> task -> bằng chứng
4. `docs/WHALE_ANALYTICS_UI_REFACTOR_HANDOFF_20260424.md`
   - tài liệu bàn giao này dùng để định hướng cách làm cho đội code và auditor

## 3. Chỉ dẫn cho đội code

1. Bắt đầu đúng thứ tự taskboard, không nhảy thẳng sang modal AI khi phần header/layout chưa khóa.
2. Mọi thay đổi phải bám các file neo đã nêu trong plan và taskboard.
3. Không tự ý đổi route stock detail; route canonical hiện tại là `/stocks/:symbol`.
4. Không được làm mất bất kỳ label line nào khi dời legend vào bảng thông tin.
5. Mọi text mới phải đi qua i18n Việt/Anh.
6. Sau mỗi burst sửa frontend phải chạy build và rebuild frontend container dev.

## 4. Chỉ dẫn cho auditor nội bộ

1. Audit theo traceability matrix trước, không audit cảm tính.
2. Dùng taskboard để xác nhận slice nào đã có code + validation + audit trail.
3. Nếu thiếu một trong ba thứ sau, slice không được pass:
   - code thực tế
   - validation thực tế
   - progress/ledger đồng bộ
4. Với slice `FE-UI-3`, phải kiểm riêng checklist line label, vì đây là chỗ dễ mất thông tin nhất.
5. Với slice `FE-AI-4`, phải kiểm riêng lazy-load behavior để tránh advisory request tự phát khi trang vừa mở.

## 5. Checklist nghiệm thu nội bộ tối thiểu

### 5.1 Visual / UX

1. Header chart có symbol link + giá hiện tại.
2. Chỉ còn 1 combobox filter.
3. Có toggle ẩn/hiện panel phải.
4. Chart không còn dày đặc label nổi làm hẹp chiều ngang.
5. Bảng thông tin hiển thị đủ mọi line label cần thiết và đúng màu.
6. Nút `Tư vấn AI` hiện cạnh `Xác thực SSOT` và `Dữ liệu realtime`.

### 5.2 Functional

1. Click symbol mở đúng Stock Detail.
2. Filter combobox vẫn tác động đúng lên bubble threshold.
3. Toggle panel không phá zoom/hover.
4. Modal AI mở đúng theo symbol đang xem.
5. Advisory lỗi hoặc chậm vẫn không làm block chart.

### 5.3 Validation / Evidence

1. `npm run build` PASS.
2. `docker compose -f c:/Mujoco Projects/vninvest/docker-compose.dev.yml up -d --build frontend` PASS.
3. Diagnostics sạch trên toàn bộ file mới sửa.
4. Progress dashboard và ledger có entry mới cho từng đợt hoàn thành.

## 6. Quy tắc chuyển sang bước coding

Chỉ sau khi bộ docs này đã tồn tại và được final user chấp thuận cho coding thì đội code mới được phép bắt đầu sửa code giao diện.

## 7. Quy tắc kết thúc đợt triển khai

Đợt triển khai chỉ được coi là đủ điều kiện báo final auditor khi:

1. Taskboard đã tick đầy đủ.
2. Matrix đã có bằng chứng tương ứng cho các `Req ID` mới.
3. Build + Docker rebuild + diagnostics đã pass ở phiên hiện tại.
4. Có báo cáo ngắn gọn nêu rõ phần đã hoàn thành và residual risk nếu còn.
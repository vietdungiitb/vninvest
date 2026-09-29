# TRACEABILITY MATRIX - Global Signal Services Control Center

## 1. Mục tiêu

Ma trận này truy vết trực tiếp từ yêu cầu đã thống nhất sang quyết định kiến trúc, slice thực hiện và bằng chứng audit bắt buộc.

## 2. Ma trận truy vết

| Req ID | Yêu cầu | Quyết định đã khóa | Tài liệu triển khai | Task ID | Bằng chứng audit bắt buộc |
|---|---|---|---|---|---|
| GSC-01 | Whale và dark-flow phải detect ở chế độ global, không phụ thuộc từng user | Detection tách khỏi audience resolution | Handoff Master mục 5.1, Tech Spec mục 6 | ARC-01, BE-2.1, BE-3.2 | test cùng input cho nhiều user context -> cùng persisted canonical event |
| GSC-02 | Universe global phải do admin điều khiển nhưng có thể hợp nhất demand thực từ tracked/watchlist | `effective universe snapshot` hybrid | Handoff Master mục 5.3, Tech Spec mục 5 | ARC-02, BE-1.1, FE-6.2 | universe preview payload + apply proof |
| GSC-03 | Whale global phải có event-store canonical riêng | Tạo `WhaleAlertEvent`; không dùng `WhaleAdvisory` thay thế | Handoff Master mục 5.2, Tech Spec mục 4.1 | BE-3.1, BE-3.2 | migration proof + persisted event payload |
| GSC-04 | Dark-flow persisted signal phải tiếp tục là canonical truth | `OrderFlowSignal` giữ vai trò canonical, detector được làm sạch | Handoff Master mục 5.2, Tech Spec mục 4.2 | BE-2.1, BE-2.3 | signal payload + severity regression tests |
| GSC-05 | Mọi user đang theo dõi mã phải nhận được signal sau khi event được persist | distribution resolve union tracked + watchlist | Handoff Master mục 5.4, Tech Spec mục 6.3 | BE-2.2, BE-4.1 | websocket + `UserAlertHistory` proof |
| GSC-06 | Không phải lọc lại từ `IntradayTick` cho global consumer chính | read-model/cache bám canonical event store | Handoff Master mục 2, Tech Spec mục 7 | BE-3.3, BE-4.3 | cache/read-model payload + code review proof |
| GSC-07 | Admin phải có một trung tâm quản lý thống nhất cho hai service | `Signal Control Center` là operator UI chính | Handoff Master mục 5.5, Tech Spec mục 10 | ARC-03, FE-6.1 đến FE-6.5 | screenshot shell + navigation proof |
| GSC-08 | Mọi thay đổi config/universe nguy hiểm phải có preview trước khi apply | preview-before-apply là bắt buộc | Handoff Master mục 5.5, Tech Spec mục 5.2, 9 | ARC-03, BE-5.2, FE-6.2 | preview payload + modal/confirmation proof |
| GSC-09 | Jobs whale và dark-flow phải xem được trên một control-plane thống nhất | tạo run registry chung hoặc adapter về một UI table | Tech Spec mục 8 | BE-4.2, FE-6.4 | jobs payload + screenshot |
| GSC-10 | Retention phải ưu tiên an toàn canonical event trước khi purge raw ticks | purge có preview, raw tick không được xóa mù | Handoff Master mục 5.2, Tech Spec mục 11 | ARC-02, BE-4.3, FE-6.4 | retention preview payload + audit note |
| GSC-11 | Coding phải đi theo explicit consent của owner | không code trước lệnh xác nhận rõ | Handoff Master mục 5.6, Code Quality Constitution mục 5 | GOV-01 | plan docs + owner confirmation record |
| GSC-12 | Team phải biết ai code phần nào và skill AI nào được dùng | role matrix + skill matrix bắt buộc | Handoff Master mục 6, Implementation Plan mục 5 | DOC-7.5 | docs cross-reference proof |
| GOV-01 | Không sửa source code trước explicit consent | `docs/AI_CODING_REGULATION.md` là luật cứng | Handoff Master mục 5.6 | ARC-01, DOC-7.5 | audit report + session record |
| GOV-02 | Admin UI mới phải tuân thủ React 19 rules, i18n Việt và PaginationBar | skill + coding standards khóa cứng | Handoff Master mục 6, Tech Spec mục 10.3 | FE-6.1 đến FE-6.5 | frontend code review + UI proof |
| GOV-03 | Mỗi slice phải có test gate và evidence riêng | evidence template bắt buộc | Self-Audit Protocol, Evidence Template | QA-7.3 | evidence template điền đủ + ledger/progress sync |

## 3. Quy tắc sử dụng matrix

1. Mỗi slice phải map ít nhất một `Req ID`.
2. Không có bằng chứng ở cột cuối thì slice chưa được PASS.
3. Nếu một coding slice không chỉ ra required AI skill và human gate tương ứng, slice bị coi là chưa đủ điều kiện execute.
4. Nếu preview-before-apply bị bỏ qua ở bất kỳ write action nào, toàn bộ gói vận hành phải bị đánh `FAIL` trong audit nội bộ.
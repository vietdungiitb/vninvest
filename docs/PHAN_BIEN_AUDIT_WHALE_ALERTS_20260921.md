# Phản biện audit: Trung tâm cảnh báo (whale-alerts)

Ngày: 2026-09-21  
Phạm vi: `packages/web/src/pages/AlertCenterPage.tsx`, `packages/web/src/components/alert-center/*`, hooks AlertCenter, i18n `alertCenter`, `packages/core/backend/src/signal_intelligence/{serializers.py,views.py,materializers.py,models.py}`, CSS SOC.  
Tham chiếu ledger: Entry 134.

## 0. Giới hạn phương pháp

- Tôi không đọc được 3 ảnh đính kèm, nên các ước lượng pixel/màu trong báo cáo gốc được coi là **không thể xác minh độc lập**.
- Phản biện này đối chiếu từng claim với code thật, không suy đoán hành vi runtime từ screenshot.
- Trang trong ảnh là `AlertCenterPage`, được mount tại `/whale-alerts` trong `frontend/src/App.jsx:133`, đồng thời có canonical route `/alert-center` trong `packages/web/src/app/routeCatalog.js:66-85` và alias `whale-alerts → alert-center` trong `packages/web/src/main.tsx:21-25`.

## 1. Phán quyết chung

Báo cáo gốc có giá trị như một **UX review**, nhưng chưa đạt chuẩn technical audit vì:

- Gán P0 cho nhiều vấn đề chỉ thuộc mật độ, copy hoặc ước lượng hình ảnh.
- Có ít nhất 7 điểm **sai hoặc đã lỗi thời** so với code hiện tại.
- Bỏ sót một bug CSS có thể mới là nguyên nhân mất cân đối hai cột.
- Một số đề xuất trong mục 2 đã tồn tại trong code.

## 2. CONTRADICTIONS chính: báo cáo vs code

| Báo cáo | Code thực tế | Tác động |
|---|---|---|
| #8: filter không có trạng thái chọn, không có “Xóa lọc” | Severity/family dùng `filterBtnActive/filterBtnInactive` tại `packages/web/src/components/alert-center/FilterBar.tsx:124-145`; CSS active/inactive đã phân biệt tại `packages/web/src/components/soc/soc.components.css:672-680`; nút “Xóa lọc” tồn tại tại `FilterBar.tsx:146-155` | Claim P1 này **sai phần quan trọng nhất**. Thiếu count và `aria-pressed` thì đúng. |
| #6: feed scroll riêng, nên dùng virtual list | Feed đã dùng `FixedSizeList`, cao 460px, mỗi item 280px tại `packages/web/src/pages/AlertCenterPage.tsx:518-523` | Đề xuất virtual list là **redundant**. Vấn đề thật là fixed-size + `overflow:hidden`, không phải thiếu virtualization. |
| #25: bảng không sticky header, không hover, số chưa tabular-nums | Header đã `position:sticky`, số đã `tabular-nums`, hàng đã hover tại `packages/web/src/components/soc/soc.components.css:1782-1799`; hàng có link `/stocks/...` tại `packages/web/src/components/alert-center/StatsTable.tsx:73-81` | Phần lớn claim này **sai**. Thiếu sort và keyboard mới đúng. |
| Mục E: chưa thấy loading, empty, lỗi mạng | Có skeleton lần đầu tại `AlertCenterPage.tsx:496-497`, empty phân biệt scope tại `AlertCenterPage.tsx:509-510`, retry feed tại `AlertCenterPage.tsx:498-508`, banner lỗi summary/stats tại `AlertCenterPage.tsx:444-451` | Báo cáo screenshot-only nên **false negative**. Chỉ đúng ở chỗ thiếu banner mất kết nối/dữ liệu quá hạn tường minh. |
| #7: cột thống kê không sticky, không cùng kiểu card | Layout đã là grid hai cột và cột phải sticky tại `packages/web/src/components/soc/soc.components.css:2115-2140` | Sai mechanism. Nhưng phản biện tìm thấy vấn đề thật khác ở mục 3, #7. |
| #16: marker evidence không xoay | Nút evidence hiển thị `▼` khi mở và `▶` khi đóng tại `packages/web/src/components/alert-center/AlertCard.tsx:196-205` | Claim **sai**. Vấn đề nhãn Anh/Việt và hierarchy thì còn đúng một phần. |
| #17: “Mute 30 phút” mơ hồ | Nút mute mở `MuteModal` với 15/30/60/240 phút và lý do tại `packages/web/src/components/alert-center/MuteModal.tsx:19-64`; hành động mute gửi cả symbol và family tại `packages/web/src/hooks/useAlertCenterActions.ts:94-121` | Nhãn nút gây hiểu nhầm, nhưng hành vi phía sau đã rõ hơn báo cáo mô tả. |

## 3. Verdict chi tiết

### A. Dữ liệu và nội dung

#### #1 Nội dung lặp trong card — ĐÚNG, nhưng fix đề xuất chưa chuẩn

Root cause hai tầng:

- Backend tạo whale alert với `body = ''` tại `packages/core/backend/src/signal_intelligence/materializers.py:831-832`.
- Serializer fallback `summary = body || title` tại `packages/core/backend/src/signal_intelligence/serializers.py:41-45`.
- UI render cả `title` tại `AlertCard.tsx:147-149` và `summary/body` tại `AlertCard.tsx:168-170`.

Số tiền lặp vì tiêu đề chuẩn đã chứa số tiền tại `materializers.py:209-210`, trong khi góc phải render giá trị riêng tại `AlertCard.tsx:158-161`. “Độ tươi” lặp vì vừa có badge tại `AlertCard.tsx:140-145`, vừa có metadata tại `AlertCard.tsx:189`.

Tuy nhiên đề xuất “tiêu đề chỉ còn `VBB · Cá mập mua`” là can thiệp sai chỗ. Tiêu đề chuẩn còn dùng ở drawer tại `DetailDrawer.tsx:117-127` và CSV tại `AlertCenterPage.tsx:337-351`. Fix rẻ và an toàn hơn là UI ẩn `summary` khi chuẩn hóa xong trùng `title`.

#### #2 Nhiều định dạng số/ngày — ĐÚNG HIỆN TƯỢNG, SAI CHẨN ĐOÁN

Hiện tượng đúng, nhưng không phải “3 format tùy tiện” mà là hai pipeline format khác nhau:

- Giá trị góc phải dùng `toLocaleString("vi-VN")` tại `AlertCenterPage.tsx:68-72`.
- Tiêu đề backend dùng Python `f"{matched_value:,}đ"` tại `materializers.py:209-210`.
- `session_date` render thô tại `AlertCard.tsx:190`.
- Timestamp card dùng `toLocaleTimeString/toLocaleDateString("vi-VN")` tại `AlertCenterPage.tsx:74-83`.
- Bảng dùng `toLocaleString("vi-VN")` tại `StatsTable.tsx:37-42`.
- Date input là native browser control tại `FilterBar.tsx:101-108`, nên hiển thị `mm/dd/yyyy`.

Vụ thập phân VND cũng có root cause rõ: backend aggregate dùng `DecimalField(decimal_places=2)` tại `views.py:273`, còn frontend chỉ `Number(...).toLocaleString("vi-VN")` tại `AlertCenterPage.tsx:68-72`, không chuẩn hóa fraction.

Đề xuất formatter thống nhất là đúng hướng. Nhưng hiển thị gọn `588,5 triệu` không thể thay hoàn toàn số chính xác trong trang pháp y/giao dịch. Nên làm hai lớp: gọn cho KPI/bảng, đầy đủ cho tooltip/detail/CSV.

#### #3 Số liệu mâu thuẫn — CẦN TÁCH 4 Ý

- **“Chưa đọc: 0 nhưng đầy thẻ MỚI”: SAI khi gọi là mâu thuẫn.** `unseen` đếm theo delivery-state tại `views.py:229-236`, còn badge “MỚI” là `freshness_state` tại `AlertCard.tsx:140-145`. Đây là hai semantics khác nhau. Vấn đề thật là nhãn gây nhầm, không phải một nguồn đếm duy nhất.
- **“Hiển thị 50 nhưng tổng 76”: ĐÚNG MỘT PHẦN.** Subtitle dùng số alert đã load tại `AlertCenterPage.tsx:457`, còn KPI dùng summary toàn scope tại `AlertCenterPage.tsx:399-405`. Nên sửa nhãn thành “Đang hiển thị X/Y”.
- **“8 Mã CP nhưng Trang 1/3”: ĐÚNG và là bug thật.** Header dùng `rows.length`, mà `rows` đã là slice của trang hiện tại tại `StatsPanel.tsx:31-36` và `AlertCenterPage.tsx:329-335`. Backend đã trả `total_symbols` và frontend đã giữ field này tại `useAlertCenterData.js:129-137`, nhưng UI không dùng.
- **“Cao & Siêu cao” vs “Nghiêm trọng/Cao”: ĐÚNG về thuật ngữ.** KPI cộng `critical + high` tại `AlertCenterPage.tsx:322-324`, nhưng không có severity “Siêu cao” trong model tại `models.py:24-28`. Đây là P1/P2 copy, không phải lỗi đếm P0.

#### #4 Timestamp — GIỮ ĐIỀU TRA, BÁC GIẢ THUYẾT CHẮC CHẮN

Báo cáo đặt điều kiện “nếu là giờ khớp thật” nên việc yêu cầu xác minh là hợp lý. Nhưng giả thuyết “cộng +7 hai lần” chưa có bằng chứng.

Code cho thấy rủi ro thật:

- UI phân biệt `executed_at` và `triggered_at/session` tại `AlertCard.tsx:186-192`.
- `executed_at` lấy từ `whale_detail` tại `serializers.py:47-51`.
- Formatter frontend không pin timezone, dùng timezone của trình duyệt tại `AlertCenterPage.tsx:74-83`.
- Server đặt `TIME_ZONE = 'Asia/Ho_Chi_Minh'` tại `settings.py:214`.

Muốn kết luận phải có payload thô gồm `session_date`, `triggered_at`, `executed_at`, timezone server và timezone thiết bị. Không thể chốt root cause từ screenshot.

#### #5 Ngôn ngữ — ĐÚNG KHOẢNG 70%

Đúng ở subtitle lộ ngôn ngữ dev tại `vi.js:5402`, family giữ tiếng Anh tại `vi.js:5492-5519`, `Mute`, `evidence`, và badge `LIVE (WS)` tại `vi.js:5403-5406`.

Nhưng có 3 phản biện:

- `B/S` không hẳn là rò rỉ tiếng Anh. Đó là compact label, tooltip đã dùng “Mua/Bán/Khác” tại `StatsTable.tsx:89-113`.
- `Online` và `LIVE` có thể thuộc hai lớp khác nhau: kết nối chung và luồng alert. Page đã phân biệt live/polling/pause tại `AlertCenterPage.tsx:381-395`, chỉ sai ở chỗ lộ chữ `WS`.
- Breadcrumb `whale-alerts` là route alias hợp lệ, không phải bug i18n.

Bảng thuật ngữ vẫn nên làm, nhưng đừng gộp mọi chữ viết tắt kỹ thuật vào cùng một lỗi.

### B. Layout, filter và điều khiển

#### #6 Cuộn lồng nhau — SAI P0, ĐÚNG P1 CLIPPING

Virtual list đã có. Vấn đề thật là mỗi card bị ép vào slot 280px và style thêm `overflow:hidden` tại `AlertCenterPage.tsx:539`. Khi mở evidence hoặc nội dung dài, card có thể bị cắt đúng như ảnh.

Nên hạ từ P0 xuống P1 và chuyển sang `VariableSizeList`/đo chiều cao động thay vì đề xuất lại virtual list.

#### #7 Hai cột mất cân đối — SAI MECHANISM, NHƯNG TÌM RA BUG MỚI

Cột phải đã sticky theo code. Tuy nhiên báo cáo vô tình chỉ đúng hiện tượng “cột phải mất khung” vì:

- `StatsPanel.tsx:31` dùng `soc.panel`.
- Quét toàn thư mục SOC nhưng không thấy định nghĩa `.panel`.
- Cột trái dùng `ShellPanel`, vốn có card radius 24 tại `ShellPageTemplate.module.css:176-182`.

Nếu build đúng như source, đây có thể mới là root cause của mất cân đối, chứ không phải thiếu `position:sticky`. Cần xác minh render thực tế trước khi gọi là bug tuyệt đối, nhưng đây là finding giá trị hơn #7 gốc.

#### #8 Filter không trạng thái — SAI PHẦN LỚN

Screenshot không có filter nào được chọn, nên chip inactive là trạng thái đúng. Code đã có active/inactive và nút xóa.

Phần còn đúng:

- Không có count trên chip.
- Không có `aria-pressed` trong các nút tại `FilterBar.tsx:124-145`.

#### #9 Hai chiều lọc chung segmented — ĐÚNG MỘT PHẦN

DOM có separator tại `FilterBar.tsx:77`, nhưng class `.separator` chỉ là `border-top` tại `soc.components.css:1489-1492`, không tạo vạch dọc rõ ràng trong toolbar ngang. Quan sát “không có vạch ngăn” vì vậy vẫn có cơ sở.

Vấn đề kỹ thuật sâu hơn báo cáo: chọn ngày không xóa preset timeframe. `sessionDate` chỉ set riêng tại `AlertCenterPage.tsx:425-426`, trong khi backend có thể áp cả cutoff timeframe lẫn `session_date` tại `views.py:211-225`.

#### #10 Toolbar lãng phí — ĐÚNG

Toolbar là flex column tại `soc.components.css:617-626`. Ô tìm mã bị giới hạn 160px tại `soc.components.css:1593-1599`, date giới hạn 170px tại `FilterBar.tsx:101-108`, còn nút refresh bị đẩy xa vì `space-between` tại `soc.components.css:627-633`.

#### #11 Ba ô tìm mã — ĐÚNG HIỆN TƯỢNG, SAI GIẢI PHÁP

Ba ô tồn tại thật, nhưng phạm vi khác nhau:

- Search header: toàn cục.
- “Lọc Mã”: filter feed.
- Tìm nhanh trong stats: lọc client trên snapshot tại `AlertCenterPage.tsx:315-318`.

Placeholder bị cắt nhiều khả năng do `max-width:160px`. Không nên xóa mù ô stats search; nên ghi rõ phạm vi hoặc dùng chung một ô có scope rõ ràng.

#### #12 KPI — ĐÚNG ENHANCEMENT, SAI BUG

Metrics hiện là tĩnh tại `AlertCenterPage.tsx:398-405`, còn `ShellMetric` không nhận hành động click tại `ShellPageTemplate.js:12-19`.

Grid CSS vốn có 4 cột tại `ShellPageTemplate.module.css:104-109`, nhưng lane main chỉ render 3 metric vì metric AI bị điều kiện tại `AlertCenterPage.tsx:401-403`. Khoảng trống bên phải vì vậy là hệ quả logic, không phải lỗi đếm.

Radius thực tế cũng không đơn trị: shell 28px, panel 24px, metric 20px. Báo cáo đúng hướng token, sai số tuyệt đối.

#### #13 Header trang — P2 COPY, KHÔNG PHẢI P0/P1

Phần hamburger, sidebar, selector ngôn ngữ nằm ngoài code page Alert Center nên không thể kết luận từ component này. Phần thuộc page thì badge live đã có tooltip pause/resume và trạng thái polling.

Giữ lại hai ý đúng: bỏ chữ `WS`, dùng breadcrumb/label tiếng Việt thân thiện.

### C. Card feed

#### #14 Card quá cao — ĐÚNG VỀ MẬT ĐỘ

Slot virtual đang là 280px, viewport list 460px. Đề xuất card gọn 96–120px là hợp lý, nhưng chỉ khả thi nếu chi tiết/metadata/chứng cứ chuyển sang expandable. Hiện card đã có toggle evidence, nên hướng này làm được.

#### #15 Thiếu dữ liệu quyết định — ĐÚNG VÀ LÀ GAP DỮ LIỆU THẬT

Response feed chuẩn không expose giá/khối lượng vì `UnifiedAlertSerializer` chỉ trả các field tại `serializers.py:12-18`, trong khi `WhaleAlertCanonical` có `price`, `volume`, `matched_value` tại `models.py:87-95`.

Evidence hiện chỉ có source/signal/event/whale_intensity/matched_value tại `materializers.py:32-39`. Công thức confidence có thể suy ra từ ngưỡng tại `materializers.py:42-54`, nhưng UI không giải thích. `% GTGD phiên` thì cần aggregate phiên mới, không phải chỉ render lại frontend.

#### #16 Evidence quá to — SAI PHẦN MARKER, ĐÚNG MỘT PHẦN HIERARCHY

Marker có xoay/đổi theo trạng thái, không phải marker tĩnh. Vấn đề còn lại là nhãn Anh/Việt và hierarchy của accordion.

#### #17 Ba nút cùng cấp — ĐÚNG HIERARCHY, SAI MỨC MƠ HỒ

“Chi tiết” đã dùng active style, còn ack/mute dùng inactive style tại `AlertCard.tsx:211-236`. Mute mở modal tùy chọn, không chỉ là hành động 30 phút mù. Việc còn đúng là nên thêm icon/tooltip và “Đánh dấu tất cả đã xem”.

#### #18 “Tải thêm / Xuất CSV” và sort — ĐÚNG VỀ IA

“Tải thêm” nằm trên cùng vì nằm trong actions của panel tại `AlertCenterPage.tsx:459-488`, dù hành vi là cursor-append. Nút sort “Mới nhất” đang active nên không thể nói hoàn toàn không có selected state.

Xuất CSV đã giới hạn 5000 dòng tại `AlertCenterPage.tsx:345`, nên đề xuất icon-button/export là cải tiến, không phải fix thiếu tính năng.

#### #19 Cyan trùng severity/accent — ĐÚNG, NHƯNG LÀ LỰA CHỌN CÓ CHỦ Ý

Severity medium map sang `statusBadgeInfo` tại `AlertCard.tsx:54-58`, mà info là cyan tại `soc.components.css:2551-2555`. Tách palette severity khỏi accent tương tác là đề xuất đúng, nhưng mức P1 chứ không phải lỗi logic.

#### #20 Pill Mua/Bán — ĐÚNG KHẢ NĂNG CSS

`.signalLabel` không có width riêng tại `soc.components.css:1250-1256`, trong khi container phải co theo số tiền tại `AlertCard.tsx:158-165`. Fix `fit-content` + căn phải là hợp lý. Contrast nhãn family cần đo thực tế, chưa nên chốt chỉ từ ảnh.

### D. Bảng thống kê theo mã

#### #21 Cột Mua/Bán — ĐÚNG RESPONSIVE, SAI I18N

`B/S` là compact có tooltip đầy đủ, không phải rò rỉ tiếng Anh. Nhưng container cột hẹp tối đa 150px tại `AlertCenterPage.module.css:20-25`, nên nhãn và số dễ vỡ hàng khi hẹp. Tooltip đã có nhãn đầy đủ, vì vậy nên giữ B/S gọn và sửa layout một dòng.

#### #22 Badge xuống hai dòng — ĐÚNG

`.statusBadge` không có `nowrap` tại `soc.components.css:170-180`, trong khi badge tần suất dùng class này tại `StatsTable.tsx:115-119`. Fix `white-space:nowrap` là đúng và rẻ.

#### #23 Hàng quá cao — ĐÚNG MẬT ĐỘ

Mỗi hàng render thêm timestamp/ngày tại `StatsTable.tsx:82-84`. Đề xuất giờ tương đối + tooltip ngày là hợp lý.

#### #24 “Tần suất” dễ nhầm severity — ĐÚNG

Giá trị này thực chất là ngưỡng theo count tại `AlertCenterPage.tsx:308-313`, nhưng nhãn và màu đỏ/cam dễ gây liên tưởng tới severity. Đổi tên thành “Mật độ/Cường độ” và dùng icon là đề xuất tốt.

#### #25 Sticky/sort/hover — PHẦN LỚN SAI

Sticky, hover, tabular-nums và link chi tiết đều đã có. Ảnh mất header có thể do crop/scroll, không đủ chứng minh header không sticky. Chỉ giữ lại hai việc thật: thiếu sort và thiếu keyboard semantics cho bảng.

#### #26 Phân trang nhỏ — ĐÚNG UX, SAI ĐÁNH GIÁ BACKEND

Page size 8 là hardcode frontend tại `AlertCenterPage.tsx:329-335`, trong khi stats fetch snapshot 200 tại `useAlertCenterData.js:67-77`. Backend hỗ trợ `page/page_size`, chỉ là frontend chọn client-slice. Nên tăng page size hoặc virtualize bảng, không cần đổ lỗi backend.

### E. Toàn cục

- **Type scale:** code H1 là 34px tại `ShellPageTemplate.module.css:70-74`, panel title 21px tại `ShellPageTemplate.module.css:193-196`, metric label/value 12px/21px tại `ShellPageTemplate.module.css:131-143`. Các con số 48px/32px trong báo cáo có thể bị ảnh hưởng zoom/DPR. Hướng chuẩn hóa type scale thì đúng.
- **Radius:** giá trị thật phân tán shell/panel/metric/card/chip/pill, nên đề xuất token 8/12/999 là hợp lý.
- **Trạng thái:** báo cáo bỏ sót skeleton/empty/retry. Việc còn thiếu thật là banner tường minh cho mất kết nối và dữ liệu quá hạn.
- **Accessibility:** feed đã `aria-live/busy` tại `AlertCenterPage.tsx:512`, card đã keyboard tại `AlertCard.tsx:126-130`, drawer đã focus-trap và `aria-labelledby` tại `DetailDrawer.tsx:40-83`, focus ring và reduced-motion đã có tại `soc.components.css:3343-3372`. Phần còn thiếu là `aria-pressed` cho chip filter, semantics/sort cho bảng và segment mua/bán chỉ dựa vào màu.

## 4. Đánh giá mục 2 của báo cáo gốc

Nên giữ:

- Formatter `vi-VN` thống nhất + compact/full.
- Tách màu severity khỏi accent tương tác.
- Card gọn + expandable.
- Đổi tên tần suất, `nowrap`, thời gian tương đối.
- Bảng thuật ngữ Việt hóa.

Đã redundant hoặc lỗi thời:

- Virtual list feed.
- Sticky header/tabular-nums/hover bảng.
- Lưu filter vào URL tại `AlertCenterPage.tsx:96-134`.
- Tạm dừng luồng tại `AlertCenterPage.tsx:381-416`.
- Xuất CSV tại `AlertCenterPage.tsx:337-364`.
- Skeleton/empty/retry và nhiều phần a11y.

Thứ tự làm lại nên là:

1. Xác minh timestamp phiên 21/09 bằng payload thô.
2. Sửa header stats dùng tổng thay vì độ dài trang.
3. Xác minh và sửa khả năng missing `soc.panel`.
4. Chuẩn hóa format số/ngày từ backend tới UI.
5. Sửa clipping do fixed-size virtual list.
6. Gỡ xung đột date/timeframe và làm rõ scope 3 ô tìm mã.
7. Mới tới card gọn, bảng 20–25 dòng, token và polish realtime.

## 5. Câu hỏi còn mở

- Payload thô phiên 21/09 gồm `session_date`, `triggered_at`, `executed_at` là gì?
- Timezone của server, backend response và thiết bị render có khớp không?
- Ngữ nghĩa mong muốn của “Mới” freshness vs “Chưa đọc” delivery-state là gì?
- Header stats mong muốn hiển thị tổng toàn scope hay số dòng trang hiện tại?
- `soc.panel` missing là regression hay vốn không dùng class đó?

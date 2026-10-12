# KẾ HOẠCH & ĐẶC TẢ THIẾT KẾ UI/UX TOÀN DIỆN CHO TOÀN BỘ SUBPAGES DJANGO ADMIN
## VNInvest Enterprise Console — Hệ Thống Quản Trị Dữ Liệu & Vận Hành Tài Chính

> **Phiên bản**: Rev 1.0 (2026-10-11)  
> **Vai trò phụ trách**: System UI/UX Lead & Design Architect  
> **Trạng thái**: Sẵn sàng bàn giao đội Code thực hiện (Ready for Implementation)  
> **Phạm vi**: Toàn bộ hệ sinh thái giao diện Django Admin (`/admin/`) gồm 6 nhóm Subpages: Global Shell, Dashboard, Changelist, Changeform, Delete Confirmation, Object History.  
> **Cam kết thiết kế**: Chấm dứt hoàn toàn phương pháp sửa chắp vá thủ công; xác lập kiến trúc giao diện doanh nghiệp chuẩn hóa (Design System), phân rã 5 Slices công việc độc lập kèm mã Acceptance Criteria (AC) và minh chứng xác thực đo kiểm được.

---

## 1. TỔNG QUAN & TẦM NHÌN THIẾT KẾ (DESIGN SYSTEM VISION)

### 1.1. Hiện trạng & Phê phán thiết kế cũ
Qua các lần nghiệm thu thực tế, giao diện Django Admin bộc lộ các vấn đề cốt tử về mặt thiết kế trải nghiệm:
1. **Lãng phí không gian màn hình nghiêm trọng**: Nút đóng/mở thanh điều hướng (`#toggle-nav-sidebar`) chiếm trọn một cột dọc 23px riêng biệt ở mép trái từ trên xuống dưới màn hình chỉ để chứa một ký tự mũi tên thô sơ `«`. Việc này cắt xén không gian hiển thị của bảng dữ liệu và menu điều hướng.
2. **Toolbar bị tràn khung bao bọc (Container Overflow)**: Khi một Model có từ 2–4 bộ lọc (ví dụ: `StockProfile`, `DailyPrice`, `CommercialOrder`), việc ép thanh tìm kiếm, nút submit, badge kết quả và các filter pills trên cùng 1 hàng flexbox duy nhất đã khiến các nút phía bên phải bị tràn ra ngoài viền của thẻ Card (`.vn-toolbar-card`), gây vỡ layout và tạo cảm giác chắp vá, thiếu chuyên nghiệp.
3. **Sự đứt gãy giữa các trang con (Subpage Inconsistency)**: Trong khi trang Changelist đã được đầu tư nâng cấp một phần, các trang con khác như **Changeform (Thêm/Sửa)**, **Delete Confirmation (Xóa)** và **Object History (Lịch sử)** vẫn chạy trên template thô sơ 100% của Django 10 năm trước (form 1 cột kéo dài vô tận, nút Lưu nằm tít đáy trang, bảng inline vỡ viền, danh sách xóa cascade dạng text đơn điệu).

### 1.2. Triết lý thiết kế mục tiêu: Industrial B2B Console
Toàn bộ hệ thống quản trị sẽ tuân theo tiêu chuẩn thiết kế bảng điều khiển doanh nghiệp hiện đại (**Stripe Dashboard / GitHub Console / Linear App**):
* **Density-First (Mật độ thông tin cao)**: Dành trọn từng pixel cho dữ liệu nghiệp vụ, loại bỏ các cột đệm thừa thãi.
* **Zero Layout Overflow (Không bao giờ tràn khung)**: Kiến trúc co giãn linh hoạt (Adaptive Layout), tự động xuống hàng thông minh theo tầng bậc (2-Tier Toolbar) ở mọi độ phân giải từ 1024px đến 4K.
* **Componentized & Systematic**: Mọi thành phần đều kế thừa từ bảng token chuẩn (`vnadmin.css`), tuân thủ tỷ lệ lưới 8-pt, đạt chứng chỉ tiếp cận **WCAG 2.2 Level AA** và quy ước màu tài chính **Bloomberg Standard (L-F08)** (xanh tăng, đỏ giảm).

---

## 2. HỆ THỐNG TIÊU CHUẨN UI/UX CỐT LÕI (DESIGN SYSTEM SPECIFICATIONS)

### 2.1. Thang đo không gian & Lưới (8-pt Spatial Grid)
Mọi khoảng cách (`padding`, `margin`, `gap`) bắt buộc phải dùng các biến token có sẵn:
* `--vn-sp-1`: `4px` (Khoảng cách giữa icon và label, padding badge siêu nhỏ).
* `--vn-sp-2`: `8px` (Khoảng cách giữa các pill, padding ô nhập liệu nhỏ).
* `--vn-sp-3`: `12px` (Khoảng cách giữa các khối chức năng, padding trong card toolbar).
* `--vn-sp-4`: `16px` (Padding card chính, lề giữa các cột form).
* `--vn-sp-5`: `24px` (Khoảng cách giữa các section lớn).
* `--vn-sp-6`: `32px` (Khoảng cách chia khối trang).

### 2.2. Thang Typography & Phân cấp thị giác
* **Display/H1 (Page Header)**: `20px`, `font-weight: 700`, `letter-spacing: -0.02em`, `line-height: 28px`.
* **Section Title/H2**: `16px`, `font-weight: 600`, `letter-spacing: -0.01em`, `line-height: 24px`.
* **Body / Table Content**: `13px`, `font-weight: 400`, `line-height: 20px`.
* **Muted / Subtitle / Meta**: `12px`, `font-weight: 500`, `color: var(--vn-text-muted)`.
* **Code / Numbers / Currencies**: Bắt buộc áp dụng `font-variant-numeric: tabular-nums;` để các con số thẳng hàng hoàn hảo theo chiều dọc.
* **Độ dài dòng (Line length)**: Tối đa 80 ký tự cho văn bản mô tả, form descriptions.

### 2.3. Bảng màu & Tương phản WCAG 2.2 Level AA
* **Background & Surfaces**: `--vn-bg` (`#f8fafc` / `#0b0f17`), `--vn-surface` (`#ffffff` / `#111827`), `--vn-surface-2` (`#f1f5f9` / `#1f2937`).
* **Borders**: `--vn-border` (`#e2e8f0` / `#374151`), `--vn-border-subtle` (`#edf2f7` / `#1f2937`).
* **Text Contrast**: Text trên Surface đảm bảo tỷ lệ tương phản tối thiểu **4.5:1** cho văn bản thường, **3.0:1** cho văn bản lớn/badge.
* **Trạng thái tài chính (L-F08)**: 
  * Gain / Active / Success: `--vn-gain: #1f883d;` (Xanh lá).
  * Loss / Danger / Failed: `--vn-loss: #cf222e;` (Đỏ).
  * Warning / In-progress: `--vn-warning: #9a6700;` (Vàng hổ phách).
  * Info / Running / Neutral: `--vn-info: #0969da;` (Xanh dương).

---

## 3. AUDIT CHI TIẾT & TÁI THIẾT KẾ 6 NHÓM SUBPAGES

```
+--------------------------------------------------------------------------------------------------+
| VNInvest Console Top Header [#header]                                       [Admin User] [Theme] |
+-----------------------+--------------------------------------------------------------------------+
| SIDEBAR [260px]       | BREADCRUMBS: Trang chu / Data Ingest / Lenh thu thap du lieu             |
| [Q Loc nhanh...   /]  |--------------------------------------------------------------------------|
|                       | PAGE HEADER: Lenh thu thap du lieu [Badge 3]          [+ Add Lenh thu...] |
| v Van hanh & Du lieu  |--------------------------------------------------------------------------|
|   - Lenh thu thap (v) | TOOLBAR CARD:                                                            |
|   - Lan chay thu thap | [ Q Tim kiem theo ma...   ] [Tim kiem] [3 ket qua]                       |
|   - Dinh nghia dv     | [Y Bo loc: ] [Nguon: Tat ca v] [Trang thai: Tat ca v] [Xoa loc]          |
|                       | [📅 Thoi gian: ] [< 2026] [May 2026]                                      |
| > Thi truong & GD     |--------------------------------------------------------------------------|
| > AI & Khuyen nghi    | DATA TABLE (Full width, Sticky Th, Compact Density 38px, Tabular Nums)   |
| > Thuong mai & TT     | [ ] | TEN LENH | NGUON DU LIEU | TRANG THAI | CHU KY | CAP NHAT LUC       |
| > Quan tri he thong   |--------------------------------------------------------------------------|
|                       | PAGINATION FOOTER: Showing 1-3 of 3 | Prev [ 1 ] Next                    |
+-----------------------+--------------------------------------------------------------------------+
```

---

### SUBPAGE 1: GLOBAL NAVIGATION & SHELL ARCHITECTURE
*Tập tin liên quan:* `base.html`, `nav_sidebar.html`, `vnadmin.css`, `vnadmin-nav.js`

#### Vấn đề hiện tại:
1. `toggle-nav-sidebar` là 1 thẻ `<button class="sticky toggle-nav-sidebar">` nằm ngoài `nav#nav-sidebar`, được Django gán `flex: 0 0 23px; width: 23px; border-right: 1px solid...`. Nó tạo ra **một rãnh cột màu xám vô nghĩa rộng 23px chạy suốt từ đỉnh tới chân màn hình**, đè lên mắt người dùng và đẩy lùi thanh menu vào trong.
2. Thiếu nút Toggle hiển thị trên Top Header khiến người dùng ở màn hình nhỏ không có điểm tựa để bật lại sidebar nếu lỡ thu gọn.

#### Giải pháp tái thiết kế chuẩn hóa:
1. **Triệt tiêu hoàn toàn cột dọc 23px**:
   - Gán `body.vnadmin .toggle-nav-sidebar { display: none !important; width: 0 !important; flex: 0 0 0 !important; }`. Trả lại toàn bộ 23px chiều ngang cho nội dung chính.
2. **Tích hợp nút Toggle vào Header Sidebar**:
   - Đặt 1 nút icon thu gọn `◀` (`.vn-sidebar-collapse-btn`) nằm gọn gàng bên phải ô tìm kiếm `#nav-filter` ngay trong `.vn-nav-header`. Kích thước chuẩn `28x28px`.
   - Phím tắt: Bấm `[` hoặc click icon để thu gọn sidebar mượt mà với animation `transform: translateX(-100%); transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)`.
3. **Thêm nút Hamburger Toggle trên Top Header**:
   - Đặt cạnh logo `VNInvest`: Khi sidebar bị thu gọn, nút này sáng lên với icon `☰` để người dùng mở lại tức thì mà không cần thanh cột phụ.

---

### SUBPAGE 2: DASHBOARD OVERVIEW / INDEX PAGE (`/admin/`)
*Tập tin liên quan:* `index.html`, `admin_ui/views.py`, `vnadmin.css`

#### Vấn đề hiện tại:
1. Trang chủ `/admin/` có các khối tổng quan nhưng tỷ lệ hiển thị chưa tối ưu; các bảng module xếp theo thứ tự bảng chữ cái mặc định của Django khiến các phân hệ quan trọng (Vận hành, Dữ liệu, Giao dịch) bị chìm xuống dưới.
2. Luồng hoạt động gần đây (`Recent Actions`) chiếm cột phụ nhưng chưa có avatar, thời gian tương đối (`10 phút trước`, `2 giờ trước`), và chưa gom nhóm thao tác.

#### Giải pháp tái thiết kế chuẩn hóa:
1. **Lưới Metrics Summary (5 Thẻ KPI Đầu Trang)**:
   - Hồ sơ chứng khoán (Tổng mã niêm yết, mã mới thêm).
   - Dữ liệu giá phiên (Số bản ghi hôm nay, tiến độ ingest).
   - Lệnh thu thập tự động (Active/Paused/Failed jobs).
   - Tín hiệu AI & Khuyến nghị (Phiên khuyến nghị active).
   - Người dùng & Tenants (Tài khoản đang hoạt động).
2. **Ma trận Phân hệ Nghiệp vụ (5 Domain Cards Accordion)**:
   - Nhóm 1: Vận hành & Dữ liệu (Data Ingest, Service Ops).
   - Nhóm 2: Thị trường & Giao dịch (Market Data, Signal Intelligence).
   - Nhóm 3: AI & Khuyến nghị (Advisory, AI Agents, AI Analytics).
   - Nhóm 4: Thương mại & Thanh toán (Commercial, Billing, Subscription).
   - Nhóm 5: Quản trị hệ thống (Identity Access, Ops Audit, Support).
3. **Audit Activity Stream Hiện Đại**:
   - Icon phân loại hành động (Thêm: Xanh lá `+`, Sửa: Vàng bút chì `✎`, Xóa: Đỏ thùng rác `🗑`).
   - Hiển thị người thao tác, thời gian thân thiện tiếng Việt, đường link dẫn thẳng tới bản ghi.

---

### SUBPAGE 3: CHANGELIST / BẢNG DỮ LIỆU (`/admin/<app>/<model>/`)
*Tập tin liên quan:* `change_list.html`, `search_form.html`, `filter.html`, `date_hierarchy.html`, `actions.html`

#### Vấn đề hiện tại:
1. **Tràn khung bao bọc (Container Overflow)**: Khi có nhiều filter, các nút filter dồn về mép phải và đâm thủng viền phải của `.vn-toolbar-card`.
2. Hàng ngày tháng Date Hierarchy bị co kéo nếu chiều rộng màn hình thu hẹp.

#### Giải pháp tái thiết kế chuẩn hóa: Kiến Trúc Adaptive 2-Tier Toolbar

```
+--------------------------------------------------------------------------------------------------+
| TIER 1: SEARCH & RESULT COUNT ROW (Chiếm trọn hàng trên)                                         |
| [ Q Tìm kiếm theo mã, tên, từ khoá...               ]  [Tìm kiếm]   [ 71,762 kết quả ]          |
|--------------------------------------------------------------------------------------------------|
| TIER 2: HORIZONTAL FILTER PILLS ROW (Tự động bẻ dòng, KHÔNG BAO GIỜ TRÀN MÉP CONTAINER)         |
| [ 🝖 Bộ lọc: ]  [ Sàn giao dịch: Tất cả ▾ ]  [ Trạng thái: Tất cả ▾ ]  [ Nguồn: Tất cả ▾ ]  [✕ Xóa] |
|--------------------------------------------------------------------------------------------------|
| TIER 3: DATE HIERARCHY TIMELINE (Nếu có phân cấp thời gian)                                      |
| [ 📅 Thời gian: ]   [ < 2026 ]   [ Tháng 5 2026 ]   [ Tháng 9 2026 ]   [ Tháng 10 2026 ]         |
+--------------------------------------------------------------------------------------------------+
```

1. **Quy tắc Tầng 1 (Search Row)**:
   - Ô nhập tìm kiếm: `flex: 1 1 260px; max-width: 420px; min-width: 220px;`.
   - Nút submit: `white-space: nowrap !important; flex-shrink: 0; height: 32px; padding: 0 16px;`.
   - Badge kết quả: `display: inline-flex; align-items: center; white-space: nowrap;`.
2. **Quy tắc Tầng 2 (Filter Row)**:
   - Luôn nằm trên một hàng riêng biệt bên dưới Search Row (ngăn cách bằng `border-top: 1px solid var(--vn-border); padding-top: 10px; margin-top: 10px;`).
   - Sử dụng `display: flex; flex-wrap: wrap; gap: 8px; align-items: center; width: 100%;`.
   - Các Filter Pills: Được xếp liên tiếp từ trái sang phải. Nếu có 10 filters, chúng sẽ tự động xuống dòng thứ 3 một cách trật tự, tuyệt đối không bị tràn ra ngoài lề phải.
   - Nút `✕ Xóa lọc` xuất hiện ở cuối danh sách pill khi có ít nhất 1 filter active.
3. **Quy tắc Tầng 3 (Date Hierarchy)**:
   - Đặt ở đáy Toolbar Card, các pill cách nhau `gap: 10px;`, padding `5px 14px;`, pill active có nền primary và chữ tương phản cao.

---

### SUBPAGE 4: CHANGEFORM / THÊM & SỬA BẢN GHI (`/admin/<app>/<model>/<id>/change/`)
*Tập tin liên quan:* `change_form.html` (tạo mới), `includes/fieldset.html` (tạo mới), `submit_line.html` (tạo mới), `vnadmin.css`

#### Vấn đề hiện tại:
1. Hiện tại chưa có template override nào cho `change_form.html` trong `vninvest_core/templates/admin/`. Toàn bộ chạy trên giao diện thô của Django.
2. Các trường nhập liệu dàn hàng ngang 100% gây mỏi mắt trên màn hình rộng 1920px.
3. Nút Lưu nằm ở tận đáy trang web. Khi sửa một bản ghi có 20 trường hoặc có inline, người dùng phải cuộn chuột qua 3–4 màn hình mới tìm thấy nút Lưu.

#### Giải pháp tái thiết kế chuẩn hóa: 2-Column Responsive Form & Sticky Actions Bar

```
+--------------------------------------------------------------------------------------------------+
| HEADER: Sửa Hồ sơ cổ phiếu: VIC                    [Xem trên web] [Lịch sử thay đổi] [Xóa]      |
+----------------------------------------------------------------+---------------------------------+
| CỘT CHÍNH: NỘI DUNG DỮ LIỆU (68% Width)                         | CỘT PHỤ: METADATA (32% Width)   |
|                                                                |                                 |
| [ Thẻ Card: Thông tin cơ bản ]                                 | [ Thẻ Card: Trạng thái & Meta ] |
| - Mã chứng khoán: [ VIC             ]                          | - Trạng thái: (o) Active ( ) De |
| - Tên công ty:    [ Tập đoàn Vingroup ]                          | - Sàn GD:     [ HOSE          ] |
| - Ngành:          [ Bất động sản      ]                          | - Tạo lúc:    10/05/2026 09:00  |
|                                                                | - Cập nhật:   11/10/2026 09:30  |
| [ Thẻ Card: Số liệu lưu hành ]                                 |                                 |
| - Cổ phiếu lưu hành: [ 3,823,661,561 ]                         | [ Thẻ Card: Ghi chú quản trị ]  |
|                                                                | [ Textarea...                 ] |
| [ Thẻ Card: Dữ liệu Inlines (Bảng giá liên quan) ]             |                                 |
| [ Compact Inline Table with Add Row button ]                   |                                 |
+----------------------------------------------------------------+---------------------------------+
| STICKY BOTTOM ACTION BAR (Cố định ở đáy màn hình khi cuộn trang)                                 |
| [ Nút Xóa (Đỏ nhạt) ]                     [ Nút Hủy ]  [ Lưu & Thêm mới ]  [ LƯU THAY ĐỔI (Xanh) ] |
+--------------------------------------------------------------------------------------------------+
```

1. **Bố cục 2 Cột (Two-Column Layout)**:
   - Cột trái (Primary, 68%): Các trường dữ liệu chính, trường văn bản dài, và các bảng Inlines.
   - Cột phải (Sidebar, 32%): Trạng thái hoạt động, cờ boolean, phân loại danh mục, thông tin kiểm toán (Người tạo, ngày tạo, lần sửa cuối).
   - Trên màn hình di động/tablet (< 1024px): Cột phụ tự động gập xuống dưới cột chính.
2. **Sticky Bottom Action Bar (Thanh nút Lưu cố định)**:
   - Cố định ở đáy màn hình: `position: sticky; bottom: 0; z-index: 40; background: var(--vn-surface); border-top: 1px solid var(--vn-border); box-shadow: 0 -4px 16px rgba(0,0,0,0.06);`.
   - Nút `LƯU THAY ĐỔI`: Màu xanh GitHub green `#1f883d`, nổi bật góc phải.
   - Nút `Lưu và tiếp tục sửa`, `Lưu và thêm mới`: Nút secondary gọn gàng.
   - Nút `Xóa bản ghi`: Nằm tách biệt ở góc trái thanh action bar, chữ màu đỏ `--vn-danger`, có hover feedback an toàn.
3. **Thẻ Fieldset dạng Card**:
   - Mỗi Fieldset được bọc trong một thẻ Card có viền mảnh, bo góc 8px, tiêu đề rõ ràng kèm đoạn mô tả giải thích mục đích dữ liệu.
4. **Hiển thị Lỗi Form Trực Quan (Accessible Error Feedback)**:
   - Khi validate thất bại: Ô nhập liệu có viền đỏ `border-color: var(--vn-danger); box-shadow: 0 0 0 3px rgba(207, 34, 46, 0.15);`.
   - Thông báo lỗi hiển thị ngay dưới trường với icon cảnh báo `⚠` và text màu đỏ rõ ràng, không dùng bảng lỗi gắt màu vàng mặc định.

---

### SUBPAGE 5: DELETE CONFIRMATION / XÁC NHẬN XÓA (`/admin/<app>/<model>/<id>/delete/`)
*Tập tin liên quan:* `delete_confirmation.html` (tạo mới), `vnadmin.css`

#### Vấn đề hiện tại:
1. Trang xác nhận xóa mặc định của Django liệt kê danh sách các đối tượng liên đới (cascade objects) dưới dạng cây danh sách `<ul><li>` đơn điệu, dễ gây hoang mang hoặc người dùng bấm nhầm mà không nhận thức được hậu quả mất mát dữ liệu liên kết.

#### Giải pháp tái thiết kế chuẩn hóa:
1. **Thẻ Cảnh Báo Nguy Hiểm (Danger Callout Banner)**:
   - Nền đỏ cảnh báo dịu mắt, icon `⚠`, tiêu đề: **"Cảnh báo: Hành động này không thể hoàn tác!"**.
   - Tóm tắt số lượng bản ghi sẽ bị xóa: *"Bạn đang chuẩn bị xóa bản ghi chính và **42 bản ghi phụ thuộc** liên đới."*
2. **Cây Đối Tượng Liên Đới Dạng Bảng Phân Cấp (Structured Impact Tree)**:
   - Nhóm theo từng Model (ví dụ: *10 Lần chạy thu thập, 32 Dữ liệu giá*).
   - Badge đếm số lượng cho từng bảng liên quan.
3. **Cặp Nút Hành Động Rõ Ràng**:
   - Nút Xác nhận: Đỏ đậm `background: #cf222e; color: #fff;` với nhãn: **"Xác nhận xóa vĩnh viễn"**.
   - Nút Hủy: Nút phụ nổi bật với nhãn: **"Hủy bỏ và quay lại"** (dẫn về trang trước).

---

### SUBPAGE 6: OBJECT HISTORY / NHẬT KÝ THAY ĐỔI (`/admin/<app>/<model>/<id>/history/`)
*Tập tin liên quan:* `object_history.html` (tạo mới), `vnadmin.css`

#### Vấn đề hiện tại:
1. Trang lịch sử của Django là một bảng HTML đơn điệu chỉ có cột Thời gian, Người thao tác, và một câu mô tả ngắn.

#### Giải pháp tái thiết kế chuẩn hóa:
1. **Thiết kế Dạng Dòng Thời Gian Trực Quan (Audit Timeline)**:
   - Trục thời gian dọc kết nối các mốc lịch sử.
   - Mỗi mốc là một Timeline Card gồm:
     - Avatar tròn và tên tài khoản người thao tác.
     - Badge hành động: `Tạo mới` (Xanh lá), `Thay đổi` (Xanh dương), `Xóa` (Đỏ).
     - Chi tiết các trường đã thay đổi (Field-level diff highlight).
     - Thời gian thực và thời gian tương đối (`11/10/2026 09:30 — 15 phút trước`).

---

## 4. KẾ HOẠCH THỰC HIỆN CHI TIẾT (WORK BREAKDOWN STRUCTURE - 5 SLICES)

Đội ngũ kỹ thuật thực hiện theo đúng 5 lát cắt (Slices) tuần tự dưới đây. Mỗi slice có đầu vào, danh sách file, yêu cầu kỹ thuật và tiêu chí nghiệm thu rõ ràng.

### SLICE 1: GLOBAL SHELL & NAVIGATION RE-ARCHITECTURE
*Mục tiêu:* Xóa bỏ hoàn toàn cột thừa 23px của `#toggle-nav-sidebar`, tái cấu trúc nút toggle vào header sidebar và top header, trả lại 100% diện tích cho nội dung.
*Tập tin sửa đổi:*
- `packages/core/backend/src/vninvest_core/templates/admin/nav_sidebar.html`
- `packages/core/backend/src/vninvest_core/templates/admin/base.html`
- `packages/core/backend/src/vninvest_core/static/admin/css/vnadmin.css`
- `packages/core/backend/src/vninvest_core/static/admin/js/vnadmin-nav.js`
*Yêu cầu kỹ thuật:*
1. Triệt tiêu `.toggle-nav-sidebar` cũ (`display: none !important; width: 0 !important;`).
2. Thêm nút thu gọn `.vn-sidebar-toggle-btn` trong `.vn-nav-header`.
3. Thêm nút mở rộng `.vn-header-sidebar-toggle` trong `#header`.
4. Logic JS: Lưu trạng thái thu gọn vào `localStorage.getItem('django.admin.navSidebar')`, toggle class `.main.shifted` mượt mà.
*Tiêu chí nghiệm thu:* `[AC-SH-01]` đến `[AC-SH-04]`.

---

### SLICE 2: CHANGELIST 2-TIER ADAPTIVE TOOLBAR & DATA TABLE
*Mục tiêu:* Triệt tiêu 100% lỗi tràn khung bao bọc của nút tìm kiếm và bộ lọc; chuẩn hóa bảng dữ liệu mật độ cao.
*Tập tin sửa đổi:*
- `packages/core/backend/src/vninvest_core/templates/admin/change_list.html`
- `packages/core/backend/src/vninvest_core/templates/admin/search_form.html`
- `packages/core/backend/src/vninvest_core/templates/admin/filter.html`
- `packages/core/backend/src/vninvest_core/templates/admin/date_hierarchy.html`
- `packages/core/backend/src/vninvest_core/static/admin/css/vnadmin.css`
*Yêu cầu kỹ thuật:*
1. Tái cấu trúc `.vn-toolbar-card` thành 2 tầng độc lập:
   - Hàng 1 (`.vn-toolbar-search-tier`): Search input (co giãn 260px - 420px) + Nút Tìm kiếm (1 dòng, nowrap) + Result count badge.
   - Hàng 2 (`.vn-toolbar-filter-tier`): Icon filter + Danh sách filter pills bọc với `display: flex; flex-wrap: wrap; gap: 8px;` + Nút xóa lọc.
   - Hàng 3 (`.vn-date-hierarchy-wrap`): Timeline phân cấp ngày tháng (gap 10px, padding 5px 14px).
2. Đảm bảo dù có 10 filters, toolbar vẫn tự động xuống hàng trong container, không có phần tử nào chọc ra ngoài viền phải.
3. Bảng dữ liệu: Chiều cao hàng compact 38px–42px, right-align số liệu tài chính (`tabular-nums`), sticky header.
*Tiêu chí nghiệm thu:* `[AC-CL-01]` đến `[AC-CL-06]`.

---

### SLICE 3: CHANGEFORM 2-COLUMN LAYOUT & STICKY ACTION BAR
*Mục tiêu:* Thiết kế lại toàn bộ trang tạo mới và chỉnh sửa bản ghi theo tiêu chuẩn Shopify/GitHub Console hiện đại.
*Tập tin tạo mới & sửa đổi:*
- `packages/core/backend/src/vninvest_core/templates/admin/change_form.html` (Tạo mới)
- `packages/core/backend/src/vninvest_core/templates/admin/includes/fieldset.html` (Tạo mới)
- `packages/core/backend/src/vninvest_core/templates/admin/submit_line.html` (Tạo mới)
- `packages/core/backend/src/vninvest_core/static/admin/css/vnadmin.css`
*Yêu cầu kỹ thuật:*
1. Bố cục 2 cột: `.vn-form-layout { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: 20px; }`.
2. Fieldset dạng Card: Viền mỏng, padding 16px, bo góc 8px.
3. Sticky Bottom Submit Bar: Nút Lưu xanh lá góc phải, nút Hủy secondary, nút Xóa đỏ góc trái. Cố định dưới chân màn hình khi cuộn.
4. Inline tables: Bọc trong card gọn gàng, nút "Thêm dòng" dạng dashed button thân thiện.
*Tiêu chí nghiệm thu:* `[AC-CF-01]` đến `[AC-CF-05]`.

---

### SLICE 4: DELETE CONFIRMATION CALLOUT & OBJECT HISTORY TIMELINE
*Mục tiêu:* Chuẩn hóa trang xác nhận xóa và trang lịch sử thay đổi bản ghi.
*Tập tin tạo mới & sửa đổi:*
- `packages/core/backend/src/vninvest_core/templates/admin/delete_confirmation.html` (Tạo mới)
- `packages/core/backend/src/vninvest_core/templates/admin/object_history.html` (Tạo mới)
- `packages/core/backend/src/vninvest_core/static/admin/css/vnadmin.css`
*Yêu cầu kỹ thuật:*
1. `delete_confirmation.html`: Callout cảnh báo màu đỏ `--vn-danger`, bảng thống kê đối tượng liên đới bị xóa, nút "Xác nhận xóa vĩnh viễn" màu đỏ đậm và nút "Hủy bỏ".
2. `object_history.html`: Layout trục thời gian dọc (Vertical Timeline), badge màu phân loại hành động (Thêm/Sửa/Xóa), thời gian thân thiện tiếng Việt.
*Tiêu chí nghiệm thu:* `[AC-DL-01]`, `[AC-HS-01]`.

---

### SLICE 5: POLISH, A11Y WCAG 2.2 AA & AUTOMATED GATE VERIFICATION
*Mục tiêu:* Kiểm định khả năng tiếp cận, điều hướng bàn phím, dark/light mode parity và chạy các script kiểm tra chất lượng.
*Tập tin sửa đổi:*
- `packages/core/backend/scripts/check_admin_ux.py`
- `packages/core/backend/src/vninvest_core/static/admin/css/vnadmin.css`
*Yêu cầu kỹ thuật:*
1. Keyboard Navigation: Hỗ trợ phím tắt `/` để focus ô tìm kiếm, `[` để đóng mở sidebar, `Tab` focus ring rõ nét (`outline: 2px solid var(--vn-primary)`).
2. Dark Mode Parity: Mọi subpage đều hiển thị hoàn hảo ở cả Light và Dark mode.
3. Chạy toàn bộ Gate: `check_admin_ux.py` PASS 0 lỗi, `check-multi-agent.mjs` PASS.
*Tiêu chí nghiệm thu:* `[AC-QA-01]` đến `[AC-QA-04]`.

---

## 5. MA TRẬN TIÊU CHÍ NGHIỆM THU (ACCEPTANCE CRITERIA MATRIX)

| Mã AC | Phạm vi | Mô tả chi tiết yêu cầu nghiệm thu | Phương thức kiểm chứng |
|---|---|---|---|
| **AC-SH-01** | Shell / Sidebar | Rãnh cột 23px `.toggle-nav-sidebar` cũ bị triệt tiêu 100% (`width: 0`, không chiếm chỗ trong DOM flow). | Đo computed style: `width == 0px` hoặc `display: none`. |
| **AC-SH-02** | Shell / Sidebar | Header Sidebar có nút toggle icon `◀` tích hợp cạnh ô tìm kiếm; click làm sidebar thu gọn mượt mà. | Browser interaction test; click thu gọn thành công. |
| **AC-SH-03** | Shell / Header | Top Header có nút toggle icon mở lại sidebar khi sidebar đang ở trạng thái đóng. | Browser interaction test; click mở rộng thành công. |
| **AC-SH-04** | Shell / Responsive | Không có hiện tượng giật cục layout (layout shift) khi đóng/mở sidebar. | Đo CLS (Cumulative Layout Shift) < 0.05. |
| **AC-CL-01** | Changelist / Toolbar | Toolbar chia thành 2 tầng rõ rệt: Tầng 1 (Search + Result Badge), Tầng 2 (Filter Pills). | Kiểm tra DOM: `.vn-toolbar-search-tier` & `.vn-toolbar-filter-tier`. |
| **AC-CL-02** | Changelist / Toolbar | Chữ "Tìm kiếm" nằm thẳng tắp trên 1 hàng, không bị wrap thành 2 dòng ở bất kỳ độ phân giải nào. | Đo chiều cao nút `== 32px`, `white-space: nowrap`. |
| **AC-CL-03** | Changelist / Toolbar | 100% các nút và Filter Pills nằm trọn vẹn trong viền của `.vn-toolbar-card`, không có nút nào nhô ra ngoài lề phải. | Đo tọa độ `element.getBoundingClientRect().right <= card.getBoundingClientRect().right`. |
| **AC-CL-04** | Changelist / Filter | Bộ lọc hiển thị đúng nhãn tiếng Việt (`Trạng thái: Tất cả ▾`, `Sàn: Tất cả ▾`), không có ký tự rác `→` hay `None`. | Assert text content không chứa `→` và không chứa `None`. |
| **AC-CL-05** | Changelist / Date | Mốc thời gian Date Hierarchy có khoảng cách `gap >= 10px`, padding `5px 14px`, tách biệt rõ với hàng trên. | Computed style check: `gap: 10px; padding: 5px 14px;`. |
| **AC-CL-06** | Changelist / Table | Bảng dữ liệu chiếm 100% full-width, chiều cao hàng compact (38px–42px), số liệu căn phải `tabular-nums`. | Computed style table rows & cells. |
| **AC-CF-01** | Changeform / Layout | Trang Form chia 2 cột rõ rệt: Cột chính 68% (dữ liệu nhập), Cột phụ 32% (metadata, audit info). | Computed style `.vn-form-layout` grid template. |
| **AC-CF-02** | Changeform / Sticky | Thanh submit buttons cố định ở chân màn hình khi cuộn trang; nút Lưu chính màu xanh lá góc phải. | Đo `position: sticky; bottom: 0;` khi scroll. |
| **AC-CF-03** | Changeform / Cards | Mỗi Fieldset hiển thị dưới dạng thẻ Card bo góc 8px, viền mảnh, có tiêu đề và mô tả. | Visual check & CSS class `.vn-fieldset-card`. |
| **AC-CF-04** | Changeform / Errors | Khi form có lỗi, ô nhập liệu có viền đỏ cảnh báo, thông báo lỗi nằm ngay dưới ô với icon `⚠`. | Submit form rỗng, assert hiển thị lỗi inline. |
| **AC-CF-05** | Changeform / Inlines | Bảng inline dữ liệu gọn gàng, không bị vỡ chiều ngang, nút thêm dòng rõ ràng. | Mở model có TabularInline, kiểm tra bảng hiển thị. |
| **AC-DL-01** | Delete Conf / Callout | Trang xác nhận xóa có Banner cảnh báo màu đỏ, tóm tắt tổng số bản ghi bị ảnh hưởng, nút xác nhận đỏ đậm. | Visual check trang `/delete/`. |
| **AC-HS-01** | History / Timeline | Trang lịch sử hiển thị dạng Vertical Timeline với avatar người dùng, badge màu hành động và thời gian thân thiện. | Visual check trang `/history/`. |
| **AC-QA-01** | Quality / Gate | Script `check_admin_ux.py` chạy đạt PASS 0 lỗi chặn, 0 cảnh báo. | Chạy lệnh `python scripts/check_admin_ux.py` exit 0. |
| **AC-QA-02** | Quality / Multi-agent | Script `check-multi-agent.mjs` chạy đạt PASS 0 lỗi, 0 trùng migration. | Chạy lệnh `node check-multi-agent.mjs` exit 0. |
| **AC-QA-03** | Quality / A11y | Tỷ lệ tương phản văn bản đạt chuẩn WCAG 2.2 AA (>= 4.5:1 text thường, >= 3.0:1 UI controls). | Automated contrast scan pass. |
| **AC-QA-04** | Quality / Evidence | Đầy đủ 6 ảnh chụp màn hình nghiệm thu thực tế trên Docker Dev runtime cho cả 6 nhóm Subpages. | 6 file ảnh `.png` lưu trong thư mục bằng chứng. |

---

## 6. MINH CHỨNG XÁC THỰC & HƯỚNG DẪN BÀN GIAO CHO ĐỘI CODE

### 6.1. Quy trình thực hiện tự chủ (Autonomous Implementation Flow)
Đội ngũ lập trình viên tiến hành lần lượt từng slice theo quy trình khép kín:
1. **Tiếp nhận tài liệu**: Đọc tài liệu này và đối chiếu mã tiêu chí `[AC-*]`.
2. **Triển khai code**: Cập nhật template và CSS tương ứng với slice được giao.
3. **Đồng bộ runtime**: Sao chép file vào Docker dev container và chạy collectstatic:
   ```powershell
   docker cp packages/core/backend/src/vninvest_core/static/admin/css/vnadmin.css vninvest-dev-core-api:/app/src/staticfiles/admin/css/vnadmin.css
   docker cp packages/core/backend/src/vninvest_core/templates/admin/. vninvest-dev-core-api:/app/src/vninvest_core/templates/admin/
   docker restart vninvest-dev-core-api
   ```
4. **Chạy Machine Gate**: Bắt buộc kiểm tra 2 lệnh gate máy:
   ```powershell
   python packages/core/backend/scripts/check_admin_ux.py
   node packages/web/scripts/check-multi-agent.mjs
   ```
5. **Chụp ảnh nghiệm thu thực tế**: Dùng browser kiểm tra trên `http://localhost:8080/admin/` và xuất ảnh chụp chứng minh từng tiêu chí AC đạt chuẩn.

### 6.2. Kết luận từ Design Lead
Kế hoạch và đặc tả này đóng vai trò là **Hợp đồng thiết kế (Design Contract)** duy nhất cho toàn bộ hệ thống Django Admin của VNInvest. Đội code có toàn quyền tự chủ thực thi theo đúng các thông số pixel, token CSS và cấu trúc template đã được định nghĩa chi tiết ở trên mà không cần hỏi lại bất kỳ quyết định thiết kế nào.

# KẾ HOẠCH NÂNG CẤP GIAO DIỆN DJANGO ADMIN ĐẠT CHUẨN THƯƠNG MẠI (GITHUB-STYLE CONSOLE)

**Ngày:** 2026-10-11  
**Tác giả:** System Designer / Admin UI Lead  
**Tài liệu tham chiếu:** `docs/saas_design_pack/D08_UI_UX_DESIGN_20261002.md`, `docs/PLAN_DJANGO_ADMIN_UIUX_20261010.md`  
**Lessons áp dụng:** `L-001`, `L-002`, `L-003`, `L-006`, `L-007`, `L-008`, `L-F03`, `L-F05`, `L-F08`, `L-T01`, `L-B01`, `L-B02`, `L-B03`, `L-G01`, `L-G02`

---

## 1. MỤC TIÊU VÀ BỐI CẢNH

Giao diện Django Admin hiện tại (`/admin/`) bộc lộ nhiều điểm nghẽn nghiêm trọng về UI/UX:
1. **Lỗi tương phản (Contrast Failure):** Header chữ vàng cam nhạt trên nền trắng kem (`~1.8:1`), vi phạm WCAG 2.2 AA.
2. **Layout changelist bị bóp méo:** Cột `FILTER` bên phải chiếm cố định 240px–280px (25–30% màn hình), ép bảng dữ liệu `#result_list` vào giữa làm cắt cụt chữ các cột và sinh ra thanh cuộn ngang gây ức chế.
3. **Nút CTA thô thiển:** Nút `ADD...` to đùng, xanh dương chói lọi, viết hoa toàn bộ (ALL-CAPS), nằm trơ trọi phía trên cột filter.
4. **Action Bar lỗi thời:** `Action: ---------- [Go]` và số lượng chọn bị rớt dòng chữ `selected`.
5. **Sidebar dài vô tận:** Hơn 70 model trải dài phẳng lì, không có tính năng Collapsible (thu gọn / mở rộng theo nhóm).
6. **Dashboard thiếu cân đối:** Widget "Hoạt động gần đây" chiếm một góc lơ lửng, bảng chức năng phía dưới bị thanh cuộn ngang cắt cụt chữ.

**Mục tiêu thiết kế đích:** Chuyển đổi toàn diện giao diện Django Admin sang phong cách **GitHub Console (GitHub Primer Design)**:
- Top Navigation Bar tinh gọn, độ tương phản sắc nét ≥ 12:1.
- Sidebar phân cấp có khả năng Collapse/Expand theo nhóm nghiệp vụ, ghi nhớ qua `localStorage`.
- **Horizontal Unified Filter Bar:** Xóa bỏ hoàn toàn cột filter dọc bên phải, chuyển các bộ lọc thành các Pill Dropdowns nằm ngang trên đầu bảng; giải phóng 100% chiều rộng cho Data Table.
- **Modern Data Table:** Header sticky, viền 1px bo góc 6px, row-selection highlight, bulk actions bar tích hợp vào header bảng khi chọn dòng, badges trạng thái dạng dot + pill.
- **Operational Command Center Dashboard:** Lưới KPI cards cân xứng, alert callout banners kiểu GitHub, matrix module rõ ràng.

---

## 2. PHẠM VI CÔNG VIỆC

### Trong phạm vi
* Override templates Django Admin: `base.html`, `nav_sidebar.html`, `change_list.html`, `search_form.html`, `filter.html`, `date_hierarchy.html`, `actions.html`, `index.html`.
* Bổ sung styling CSS hiện đại trong `packages/core/backend/src/vninvest_core/static/admin/css/vnadmin.css`.
* Bổ sung script tương tác trong `packages/core/backend/src/vninvest_core/static/admin/js/vnadmin-nav.js` (collapse groups, filter popovers, bulk action bar).
* Đảm bảo kiểm tra độ tương phản WCAG 2.2 Level AA trên cả Light và Dark mode.
* Bảo toàn đầy đủ 28 block kế thừa của Django 5.2 base template (không làm hỏng các trang con).
* Xác thực hiển thị thực tế trên môi trường Docker Dev stack (`start_dev.ps1`) qua Browser Subagent.

### Ngoài phạm vi
* Không sửa schema cơ sở dữ liệu hoặc tạo migration.
* Không cài thêm thư viện Python bên ngoài (`django-unfold`, etc.).
* Không sửa React SPA `/admin/*` (thuộc routeCatalog của Frontend).

---

## 3. CHI TIẾT CÁC SLICE TRIỂN KHAI VÀ TIÊU CHÍ NGHIỆM THU

### Slice 1: Shell Architecture & GitHub TopNav + Collapsible Sidebar
* **Nhiệm vụ:**
  - Tái cấu trúc Top Navigation Bar: Nền tối/sạch sẽ, logo VNInvest + nhãn Admin Console sắc nét (tương phản ≥ 12:1), breadcrumbs phẳng tích hợp mượt mà.
  - Tái cấu trúc Sidebar: Chia theo nhóm nghiệp vụ với header Accordion có icon chevron xoay khi đóng/mở; lưu trạng thái mở/đóng vào `localStorage`. Bổ sung badge số lượng model dạng pill `(28)` nhỏ gọn.
* **Tiêu chí nghiệm thu (AC):**
  - `S1-AC1`: Header branding có độ tương phản tối thiểu 4.5:1 (WCAG AA), không còn chữ vàng trên nền trắng.
  - `S1-AC2`: Các nhóm trong sidebar có thể click đóng/mở mượt mà, sau khi reload trang giữ nguyên trạng thái.
  - `S1-AC3`: Giữ đủ 28 block của Django 5.2 `base.html`, `manage.py check` exit 0.

### Slice 2: GitHub-style Horizontal Filter Bar & Unified Search Toolbar
* **Nhiệm vụ:**
  - Override `change_list.html` và `filter.html`: Xóa bỏ layout 2 cột; loại bỏ hoàn toàn `#changelist-filter` dọc bên phải.
  - Chuyển toàn bộ các bộ lọc thành các Pill Buttons nằm ngang (`[Sàn: Tất cả ▾]`, `[Trạng thái: Niêm yết ▾]`). Khi click mở ra menu popover lựa chọn gọn gàng.
  - Tích hợp Search Box bên trái có icon kính lúp và placeholder gợi ý.
  - Chuyển nút `Add Object` thành GitHub-style Button (`+ Thêm [Tên model]`) màu xanh lá GitHub `#1f883d` hoặc Brand Accent ở góc phải toolbar.
  - Cho bảng dữ liệu chiếm trọn 100% chiều ngang màn hình.
* **Tiêu chí nghiệm thu (AC):**
  - `S2-AC1`: Bảng dữ liệu chiếm 100% container width, không còn cột sidebar filter đè ép bên phải.
  - `S2-AC2`: Nhấp vào filter pill mở menu dropdown, chọn bộ lọc tải lại URL với đúng query params của Django.
  - `S2-AC3`: Nút "+ Thêm..." nằm ở góc phải toolbar, chữ thường lịch thiệp thay vì ALL-CAPS chói lọi.

### Slice 3: Modern GitHub Data Table & Header Bulk Actions
* **Nhiệm vụ:**
  - Bảng dữ liệu: Khung viền bo góc 6px, table header phẳng có đường kẻ phân cách, sticky header khi cuộn chuột.
  - Status Badges: Dạng pill viền mềm có chấm tròn màu (Open: xanh lá, Paused: vàng/cam, Disabled: xám/đỏ).
  - Bulk Actions: Khi tick chọn ít nhất 1 checkbox hàng, table header chuyển thành Bulk Action Bar (hiện số mục đã chọn, dropdown hành động và nút Thực thi).
  - Footer Paginator: Thiết kế phân trang kiểu GitHub ("Previous", các trang, "Next", thông số bản ghi).
* **Tiêu chí nghiệm thu (AC):**
  - `S3-AC1`: Bảng dữ liệu không còn scrollbar ngang ở độ phân giải 1280px tiêu chuẩn (với bảng dưới 10 cột).
  - `S3-AC2`: Checkbox chọn nhiều hoạt động mượt mà, header tự chuyển đổi trạng thái bulk action.
  - `S3-AC3`: 100% cột trạng thái hiển thị đúng format badge dot + text.

### Slice 4: Operational Command Center Dashboard (`/admin/` Index)
* **Nhiệm vụ:**
  - Bố cục lại Grid full-width cân xứng:
    - Lưới 4 Thẻ KPI Metrics lớn dạng GitHub Metrics Box (số lớn, nhãn nhỏ, trạng thái liên kết).
    - GitHub Flash Callout Banner cho cảnh báo vận hành (dữ liệu giá cũ).
    - Function Matrix: Chia thành các Card Module độc lập bo góc có header rõ ràng, icon và badge số lượng model.
    - Chuyển "Hoạt động gần đây" thành Activity Feed phẳng bên dưới, giải phóng không gian bề ngang.
* **Tiêu chí nghiệm thu (AC):**
  - `S4-AC1`: Không còn thanh cuộn ngang ở đáy trang `/admin/`.
  - `S4-AC2`: Các card chức năng và KPI hiển thị đồng đều trên cả desktop và laptop.

### Slice 5: Changeform & Detail View
* **Nhiệm vụ:**
  - Tái cấu trúc trang chỉnh sửa chi tiết: Fieldset dạng Card nhóm trường hợp lý, nhãn in đậm rõ ràng, các trường nhạy cảm/readonly được highlight an toàn.
  - Sticky Bottom Action Bar: Thanh nút "Lưu", "Lưu và tiếp tục", "Xóa" ghim cố định ở đáy màn hình khi cuộn form dài.
* **Tiêu chí nghiệm thu (AC):**
  - `S5-AC1`: Form thêm/sửa có thanh nút Lưu luôn hiển thị ở đáy màn hình, thuận tiện thao tác.
  - `S5-AC2`: Không làm ảnh hưởng đến chức năng validate và submit form của Django.

### Slice 6: Design Tokens, Dark/Light Mode Theme & Verification
* **Nhiệm vụ:**
  - Chuẩn hóa bộ Design Tokens theo chuẩn GitHub Primer: Canvas, Foreground, Borders, Accents.
  - Đảm bảo độ tương phản cả chế độ Sáng và Tối đạt chuẩn WCAG 2.2 AA.
  - Chạy gate kiểm thử tự động `check_admin_ux.py`.
  - Kiểm tra thực tế trên Docker dev stack bằng Browser Subagent, chụp ảnh màn hình lưu vào evidence artifacts.
* **Tiêu chí nghiệm thu (AC):**
  - `S6-AC1`: `python packages/core/backend/scripts/check_admin_ux.py` exit code 0.
  - `S6-AC2`: Ảnh chụp màn hình trình duyệt thực tế xác nhận giao diện mới sắc nét, không còn bất kỳ lỗi vỡ layout nào.

---

## 4. CHIẾN LƯỢC ROLLBACK VÀ AN TOÀN HỆ THỐNG
* Toàn bộ thay đổi nằm trong tầng trình bày của app `vninvest_core` (`templates/admin/`, `static/admin/`), tuyệt đối không chạm vào `models.py` hay sinh migration.
* Nếu có sự cố bất ngờ: `git checkout HEAD -- packages/core/backend/src/vninvest_core/templates/admin packages/core/backend/src/vninvest_core/static/admin` để khôi phục trạng thái ban đầu.

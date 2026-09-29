# Phương Án Thiết Kế UI/UX Cao Cấp: Service Operations Center (SOC) DataOps

**Mã tài liệu**: `docs/DESIGN_PROPOSAL_SOC_DATAOPS_PREMIUM_20260625.md`  
**Ngày lập**: 2026-06-25  
**Mục tiêu**: Nâng cấp giao diện DataOps của VNInvest đạt chuẩn thương mại, chuyên nghiệp ngang tầm với các nền tảng giám sát dữ liệu hàng đầu thế giới (**Datadog**, **Snowflake**, **Apache Airflow**, và **Grafana**).

---

## 1. Phân Tích & Đánh Giá Giao Diện Hiện Tại (UI/UX Audit)

Mặc dù giao diện hiện tại đã có cấu trúc cơ bản và tuân thủ phong cách tối (Dark theme), nó vẫn mang cảm giác của một bảng dashboard nội bộ nghiệp dư với một số điểm hạn chế về UX:

* **Sử dụng không gian chưa tối ưu (Low Information Density)**: Khoảng cách giữa các phần còn quá loãng. Đối với màn hình vận hành kỹ thuật (Operational Console), operator cần nhìn thấy tối đa thông tin trên một màn hình mà không cần cuộn trang nhiều.
* **Các chỉ số "tĩnh" (Static Metrics)**: 4 thẻ số liệu trên cùng (`TỔNG SỐ DÒNG`, `TỔNG MÃ HOẠT ĐỘNG`,...) chỉ hiển thị chữ số phẳng, không có đồ thị xu hướng (Sparkline), không có thông tin so sánh biên độ tăng/giảm so với 24 giờ trước.
* **Phân cấp Tab chồng chéo**: Hai thanh tab chồng lên nhau (Tab chính: *Tổng quan, Signals, DataOps...* và Tab phụ: *Kho dữ liệu, Vận hành...*) gây nhiễu thị giác. Cần thiết kế lại thanh tab phụ nhỏ gọn, thanh thoát hơn để phân biệt rõ ràng cấp độ điều hướng.
* **Thiếu chỉ báo trạng thái động (Status indicators)**: Các thẻ loại dữ liệu (`GIÁ NGÀY`, `SNAPSHOT GIA REALTIME`...) hiển thị thông số phẳng, thiếu các hạt tròn phát sáng nhấp nháy (pulsing status indicator) báo hiệu tiến trình cào dữ liệu có đang hoạt động tốt (Active/Green), bị chậm (Stale/Amber) hay lỗi kết nối (Critical/Red).

---

## 2. Phương Án Thiết Kế UI/UX Đạt Chuẩn Thương Mại

Chúng tôi đề xuất nâng cấp toàn diện 5 tab con theo ngôn ngữ thiết kế **Liquid Glass (Kính mờ phản chiếu)** kết hợp **Glow Neon** độ tương phản cao:

### 2.1 Tab 1: Kho dữ liệu (Data Inventory) — Chuẩn *Snowflake* & *Datadog*

```
┌────────────────────────────────────────────────────────────────────────┐
│  📦 KHO DỮ LIỆU THỊ TRƯỜNG                                             │
├────────────────────────────────────────────────────────────────────────┤
│ ┌────────────────┐ ┌────────────────┐ ┌────────────────┐ ┌───────────┐ │
│ │ TỔNG BẢN GHI   │ │ TỔNG MÃ        │ │ NGÀY ĐẦU TIÊN  │ │ NGÀY CUỐI │ │
│ │ 3,316,460      │ │ 1,534          │ │ 2000-07-28     │ │ 2026-06-24│ │
│ │ 📈 +15,240 (24h)│ │ 🟢 Active      │ │                │ │ 🔴 1d ago │ │
│ │ ░░▒▒▓▓██████   │ │                │ │                │ │           │ │
│ │ (Sparkline)    │ │                │ │                │ │           │ │
│ └────────────────┘ └────────────────┘ └────────────────┘ └───────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

* **Thẻ Metric thông minh (Smarter Metric Cards)**:
  - Tích hợp **Sparkline (Biểu đồ đường mini)** vẽ bằng SVG/CSS mờ phía dưới chân mỗi card thể hiện tốc độ tăng trưởng số lượng bản ghi trong 7 ngày gần nhất.
  - Bổ sung chỉ số chênh lệch, ví dụ: `+15,240 (24h)` màu xanh neon hoặc nhãn cảnh báo `🔴 Trễ 1 ngày` để operator phát hiện bất thường ngay lập tức.
* **Phân bổ theo năm dạng Histogram tương tác (Interactive Histogram)**:
  - Thay thế danh sách thanh phẳng bằng một biểu đồ histogram cột đứng trực quan. Khi click vào từng cột năm, toàn bộ danh sách bảng biểu bên dưới sẽ tự động filter tương ứng với năm đó.
* **Loại dữ liệu (Data Types) với Pulsing Status**:
  - Mỗi card Dataset sẽ có một chấm tròn phát sáng neon (pulsing dot) chỉ trạng thái:
    - 🟢 **Xanh lá (Pulsing)**: Tiến trình cào đang hoạt động real-time, độ trễ nhỏ hơn 1 phút.
    - 🟡 **Vàng (Static)**: Tiến trình tạm nghỉ (idle) hoặc trễ dữ liệu dạng nhẹ.
    - 🔴 **Đỏ (Glow)**: Lỗi pipeline cào, starvation được kích hoạt.

---

### 2.2 Tab 2: Vận hành (Operations / Ops) — Chuẩn *Apache Airflow*

Thay vì một biểu mẫu nhập liệu phẳng, giao diện vận hành sẽ được chia làm 2 cột rõ rệt theo tỷ lệ `3:2` hoặc dạng lưới song song:

* **Bên trái: Backfill Center (Giao diện điều khiển chạy bù)**:
  - Thiết kế danh sách dataset dạng lưới các card nhỏ có checkbox.
  - Bộ chọn nhóm mã (Symbol Groups) sử dụng dạng **Segmented Control Button** (nút bấm chia đoạn phẳng) có ánh sáng viền khi active, mang lại cảm giác hiện đại hơn bộ lọc dropdown thô.
  - Khi chọn nhóm mã `CUSTOM`, một vùng văn bản lớn (Textarea) mở ra với hiệu ứng chuyển động mượt mà (smooth height transition), tự động kiểm tra cú pháp và đếm số lượng mã hợp lệ ngay khi người dùng gõ.
* **Bên phải: Planner Console (Bộ lập kế hoạch) & Git-style Preview**:
  - Giao diện nhập liệu danh sách mã tự do được trang bị công cụ **Preview** (Xem trước kế hoạch).
  - Khi click "Xem kế hoạch chạy", phần preview sẽ hiển thị dạng **Git-diff** trực quan:
    - **Planned Items** (Màu xanh lá): Danh sách mã và ngày dữ liệu sẽ được cào bổ sung.
    - **Skipped Items** (Màu xám): Danh sách mã đã có sẵn dữ liệu và bị bỏ qua để tiết kiệm tài nguyên.
  - Bảng Planned/Skipped hỗ trợ phân trang mượt mà ngay trên panel phụ, không cần tải lại toàn bộ trang.

---

### 2.3 Tab 3: Giám sát (Monitor) — Chuẩn *Datadog* & *Grafana*

Đây phải là màn hình "sống" nhất của hệ thống với mật độ thông tin rất cao (High Density Dashboard):

* **Live Snapshot Matrix (Ma trận cào song song)**:
  - Bản đồ nhiệt (Heatmap Grid) hiển thị lưới `Nhóm mã × Nhà cung cấp (Providers)`. Mỗi ô trạng thái đại diện cho tiến trình cào:
    - Ô nhấp nháy xanh dương: Đang tải dữ liệu.
    - Ô xanh lá cây: Hoàn thành tốt.
    - Ô đỏ neon: Timeout/Mất kết nối.
  - Click vào từng ô sẽ mở ra một **Drawer Panel (Ngăn kéo trượt)** từ cạnh phải hiển thị lịch sử log chi tiết của Provider đó.
* **Parity Gates & Retention Health (Đồng bộ & Sức khỏe lưu trữ)**:
  - **Parity Gauge Chart**: Đồ thị hình bán nguyệt thể hiện phần trăm đồng bộ dữ liệu (Strict vs Relaxed) với kim chỉ động.
  - **Retention Histogram**: Đồ thị cột thể hiện khối lượng dữ liệu đã dọn dẹp hàng tuần, cột có tooltip hiển thị kích thước cơ sở dữ liệu trước và sau khi dọn dẹp (Database Compression ratio).
* **Cổng Giám sát dị thường (Anomaly Guard)**:
  - Bảng cảnh báo có hiệu ứng viền phát sáng màu cam neon (Amber Glow). Các dòng cảnh báo Critical (ví dụ: mã VCB bị mất nến 5 phút) có nút hành động nhanh **"Kích hoạt cào bù ngay" (Quick Backfill)** giúp xử lý lỗi chỉ với 1 click.

---

### 2.4 Tab 4: Lịch chạy (Scheduler) — Chuẩn *Grafana Celery Dashboard*

* **Scheduler Gantt Chart (Biểu đồ tiến trình lịch chạy)**:
  - Thêm một mini Gantt Chart biểu diễn thời gian bắt đầu chạy, thời gian kết thúc, và khoảng chồng lấn (overlap) giữa các Celery Tasks trên trục thời gian.
* **Terminal Logs Integration**:
  - Khi click vào một Job đang chạy hoặc đã kết thúc, hệ thống sẽ mở ra một khung terminal màu đen giả lập, hỗ trợ hiển thị log dạng dòng lệnh có màu sắc nổi bật (ANSI syntax coloring) để operator dễ dàng debug.

---

### 2.5 Tab 5: Cấu hình (Config) — Chuẩn *Retool Code Editor*

* **JSON Monaco Editor**:
  - Thay thế textarea thô bằng một trình soạn thảo mã nguồn chuyên nghiệp giả lập (Monaco/Ace Editor) tích hợp sẵn tính năng tự động thụt dòng (auto-format), bôi màu cú pháp JSON (syntax highlighting), và báo lỗi đỏ ngay khi thiếu dấu ngoặc.
* **Version Control Audit Trail**:
  - Bảng Audit Trail lịch sử cấu hình cho phép click vào từng phiên bản để hiển thị hộp thoại so sánh song song (**Diff Viewer**) chỉ ra chính xác dòng cấu hình nào đã bị sửa đổi (đỏ là dòng cũ bị xóa, xanh lá là dòng mới được thêm vào), ai sửa và lý do sửa.

---

## 3. Bản Màu Chủ Đạo (Color Palette) & CSS Token Khuyến Nghị

Để đạt giao diện đạt chuẩn chuyên nghiệp, hệ thống DataOps nên sử dụng các mã màu có độ phát quang cao trên nền tối sâu (Deep Dark Background):

| Token | Giá trị HEX | Sử dụng | Cảm xúc thiết kế |
|---|---|---|---|
| `--bg-deep-dark` | `#030712` | Nền màn hình chính | Sâu thẳm, tập trung |
| `--panel-glass` | `rgba(15, 23, 42, 0.45)` | Nền thẻ điều khiển (blur 12px) | Kính mờ cao cấp, hiện đại |
| `--accent-cyan` | `#22d3ee` | Các chỉ số bình thường, link | Hiện đại, công nghệ |
| `--neon-emerald`| `#10b981` | Trạng thái cào tốt, Hoàn thành | An toàn, đang chạy |
| `--neon-amber`  | `#f59e0b` | Cảnh báo trễ tiến trình, Starvation | Cần lưu ý |
| `--neon-rose`   | `#ef4444` | Lỗi cào, Hot Tier breach, Mất kết nối| Nguy cấp, cần xử lý ngay |
| `--border-glow`  | `rgba(34, 211, 238, 0.15)`| Viền panel | Ánh sáng phản chiếu huyền ảo |

---

## 4. Lộ Trình Nâng Cấp Giao Diện

* **Phase 1: Quick Layout Alignment (1 ngày)**:
  - Ẩn/gỡ bỏ Scheduler board trùng lặp ở Config.
  - Phân chia lại kích thước và khoảng cách CSS padding/margin để tăng mật độ hiển thị (High Density).
  - Tích hợp chấm phát sáng trạng thái (pulsing green indicator) cho các Data Type cards.
* **Phase 2: Component Reconstruction (3-5 ngày)**:
  - Tách đôi tab Operations thành Backfill Center và Planner Console dạng hai cột. Khôi phục bảng Planned/Skipped items.
  - Thay thế JSON dump ở tab Monitor bằng bảng Coverage Matrix vẽ bằng các ô lưới màu sắc thể hiện độ tươi mới (freshness).
* **Phase 3: Visual Polish (2-3 ngày)**:
  - Tích hợp biểu đồ cột đứng cho tab Kho dữ liệu.
  - Tích hợp Sparklines SVG cho 4 metric cards chính.
  - Thiết kế lại trình soạn thảo cấu hình JSON có tô màu cú pháp.

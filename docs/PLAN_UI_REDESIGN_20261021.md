# PLAN — Redesign UI 2 panel Operations Center (Registry môi giới + Console nguồn dữ liệu)

> **Owner yêu cầu (2026-10-21):** 2 giao diện cần **refactor** để **bố trí gọn hơn, giàu thông tin hơn, dễ sử dụng hơn**; **cách đặt tên dễ nhầm** ⇒ đổi thành tên khác để phân biệt; làm theo **đúng template của hệ thống**.
> **2 màn hình:** ① tab **"Môi giới"** = `SocBrokerPanel.tsx` (505d) · ② tab **"VNBroker"** = `SocVnbrokerPanel.tsx` (1382d) — cùng nằm trong shell `/operations-center` (`ShellOperationsCenterPage.tsx`).
> **Skills dùng:** `pbakaus/layout` (reading order · grouping · rhythm · density) · `pbakaus/distill` (bỏ nhiễu, progressive disclosure) · `mengto/tailwindcss` (idiom Tailwind v4 của repo) · `ui-skills-root` (router).
> **Template hệ thống:** `packages/web/src/components/commercial/CommercialPage.tsx` + `primitives/{CommercialToolbar,CommercialTable,CommercialState,CommercialMeta}.tsx` (tạo ở W0, PR #272).
> **Lessons áp dụng:** [L-F03] class mới → `soc.components.css`, token mới → `soc.tokens.css`, **KHÔNG** `soc.module.css` (barrel 3 dòng) · [L-F05] script sửa CSS giữ transition duration/easing · [L-F06] không kết luận từ heuristic cửa sổ dòng — đọc `file:line` · [L-V02] mọi "gốc rễ" phải có phản chứng (khảo sát đã đọc source thật) · [L-V04] assert giá trị thật, có test dương tính · [L-V05] ảnh phải mở ra xem · [L-M02] branch = `feat/<tên-agent>` · [L-008] không commit thẳng `dev`

---

## 1. Gốc rễ của "tên dễ nhầm" (đã xác minh, không phải cảm nhận)

Hệ thống dùng chữ **"provider"** cho **hai thứ khác nhau**, và mã **`DNSE` tồn tại ở cả hai**:

| Hệ | Ý nghĩa | Mã | SSOT |
|---|---|---|---|
| **VNBroker** | **nguồn dữ liệu** thị trường | `vci` (chính) · `kbs` · `dnse` | `packages/core/backend/src/service_ops/provider_catalog.py:9-37` |
| **Broker** | **nhà môi giới** (broker) | `dnse` · `ssi` · `tcbs` | `packages/core/backend/src/service_ops/domain_configs/broker.py:12` |

⇒ Người dùng thấy "DNSE" ở cả 2 tab ⇒ **không biết đang cấu hình cái gì** ⇒ đây là gốc rễ, không phải lỗi bố cục.

## 2. Bảng đổi tên (21 nhãn) — R1

| # | Key i18n | Hiện tại | **Mới** | Lý do |
|---|---|---|---|---|
| 1 | `soc.vnbroker.kpi_title` | Tổng quan nhà cung cấp | **Tổng quan nguồn dữ liệu** | "nhà cung cấp" trùng nghĩa với "nhà môi giới" ở tab kế bên |
| 2 | `soc.vnbroker.providers_title` | Danh sách Providers | **Danh sách nguồn dữ liệu** | |
| 3 | `soc.vnbroker.core_config_title` | Cấu hình Kết nối Providers | **Cấu hình nguồn dữ liệu** | |
| 4 | `soc.vnbroker.role_primary` | CHÍNH | **Nguồn chính** | |
| 5 | `soc.vnbroker.role_fallback` | DỰ PHÒNG | **Nguồn dự phòng** | |
| 6 | `soc.vnbroker.role_inactive` | NGOÀI CHU KỲ | **Không dùng** | nghe như đã bị loại/lỗi |
| 7 | `soc.vnbroker.set_primary` | Đặt làm chính | **Đặt làm nguồn chính** | rõ đối tượng |
| 8 | `soc.vnbroker.enabled` | Bật | **Bật nguồn dữ liệu** | "Bật cái gì?" |
| 9 | `soc.vnbroker.benchmark_title` | Benchmark provider | **Đo hiệu năng nguồn dữ liệu** | lẫn tiếng Anh |
| 10 | `soc.vnbroker.benchmark_provider_label` | Provider cần đo | **Nguồn dữ liệu cần đo** | |
| 11 | `soc.vnbroker.circuit_breaker_title` (runtime) | Trạng thái Ngắt mạch (Circuit Breaker) | **Trạng thái ngắt mạch** | tách khỏi form |
| 12 | `soc.vnbroker.circuit_breaker_section` (form) | Trạng thái Ngắt mạch (Circuit Breaker) | **Ngưỡng ngắt mạch** | form ≠ runtime |
| 13 | `soc.vnbroker.kpi_retry` | Số lần retry | *(xoá — trùng form)* | trùng `max_retries` |
| 14 | `soc.vnbroker.max_retries` | Số lần retry tối đa | **Số lần thử lại tối đa** | gộp 2 nhãn |
| 15 | `soc.vnbroker.credential_mode` (raw `builtin`/`api-key`) | `builtin` / `api-key` | **Có sẵn** / **Cần API key** | raw tiếng Anh trong UI |
| 16 | `soc.broker.config_title` | Registry providers | **Danh sách nhà môi giới** | raw tiếng Anh + trùng "provider" |
| 17 | `soc.broker.kill_switch` | Ngắt mọi write hệ thống (kill-switch) | **Tạm khóa mọi lệnh ghi** | lẫn tiếng Anh |
| 18 | `soc.broker.quiet` | Giờ yên tĩnh | **Khung giờ tạm dừng** | ảnh chụp ghi "Gời địa" — không đọc được |
| 19 | `soc.broker.purposes` (+ giá trị raw) | Mục đích · `backfill/snapshot/signal` | **Mục đích sử dụng** · **Bù dữ liệu / Chụp snapshot / Tín hiệu** | raw tiếng Anh |
| 20 | `soc.broker.unverified` | Chưa xác minh | **Chưa kiểm tra kết nối** | dễ nhầm với xác minh OTP |
| 21 | `soc.badge.write` | Ghi được | **Có quyền ghi** | |

## 3. Bố cục mới (R2 VNBroker / R3 Broker) — theo `pbakaus/layout`

**Nguyên tắc:** *reading order theo ưu tiên vận hành* → **trạng thái → cấu hình → hành động**; *grouping theo nghĩa*; *rhythm* bằng thang spacing có chủ đích; *density* theo tần suất dùng.

### 3.1 VNBroker (`SocVnbrokerPanel.tsx`)

| Khối | Hiện tại | **Mới** | Lý do |
|---|---|---|---|
| Đầu trang | 6 ô KPI rời rạc; "Người áp dụng" **ở cuối trang** | **Dải meta 1 dòng** ngay dưới tiêu đề: `nguồn chính · cập nhật lúc {time} bởi {user} · quyền ghi` + nút "Làm mới" | thông tin deploy là thứ cần thấy đầu tiên, không phải cuối trang (D4.1) |
| KPI | 6 ô (3 ô trùng form) | **4 ô trạng thái**: Nguồn chính · Nguồn dự phòng · Sẵn sàng *x/y* · Circuit breaker | bỏ 3 ô trùng (D2.1–D2.3) |
| Danh sách nguồn | **tile card** lưới, mỗi tile 10 dòng (nhiều dòng rỗng "—") | **1 bảng dày**: Nguồn · Vai trò · Sẵn sàng · Độ trễ · Thành công · Request/Lỗi · Circuit · Kiểm cuối · Hành động | tile ⇒ scan khó, không thêm được cột; **BE đã có** `total_requests`, `failed_requests`, `error_rate`, `circuit_state`, `last_error` mà UI chưi dùng (D4.4–D4.6) |
| Cấu hình | 1 cột dọc, 4 nhóm, mỗi nhóm 2–4 ô | **2 cột**: trái = chọn nguồn chính/dự phòng + bật/tắt + lý do; phải = lưới tham số nhỏ (timeout / thử lại / tốc độ / ngưỡng ngắt mạch) | form 1 cột ⇒ rất dài, phải cuộn |
| Runtime | 3 card + 1 bảng per-provider (**trùng** dữ liệu với tile) | **gộp vào bảng nguồn** (cột độ trễ/thành công/circuit) + **1 dải** "sức khỏe service" (trạng thái, lần kiểm, lỗi liên tiếp, độ trễ TB) | bỏ trùng (D2.6–D2.7) |
| Benchmark | toolbar + bảng 7 cột, rỗng khi chưa chạy | toolbar gộp 1 dòng + bảng (**thêm** cột p95, lỗi timeout/transport) + **ẩn toolbar khi chưa có kết quả** | D1.7 + D4.7–D4.8 |
| Ownership | 2 card cuối trang | **gộp vào dải meta đầu trang** | D1.8 |

### 3.2 Broker (`SocBrokerPanel.tsx`)

| Khối | Hiện tại | **Mới** |
|---|---|---|
| Registry providers | 3 khối to: mỗi khối 1 checkbox + **khối "REQUEST" rỗng** + select "RỒ PHẠT" | **1 bảng**: Nhà môi giới · Bật · Mục đích · Loại credential · Kiểm tra · Hành động · **ô nhập hạn mức gọi** (dùng ô đang rỗng) |
| Chính sách | "Gời địa" 2 ô rỗng + kill-switch | **1 dải "Chính sách"**: khung giờ tạm dừng (2 ô `type=time`, placeholder `17:00` / `08:30`) + công tắc tạm khóa ghi + nút Áp dụng |
| Kiểm tra brokerage | 3 card, mỗi card badge **"Chưa xác minh: Chưa xác minh chưa hoàn tất!"** lặp | **1 bảng** "Tình trạng kiểm tra" + **1 badge** duy nhất/cell (D2.5) |
| Celery | card 1 dòng rỗng khi không có hàng đợi | **gộp** vào card sức khỏe (dòng "Hàng đợi Celery") + empty state (D1.1) |
| Credentials | card riêng | **gộp** vào bảng nhà môi giới (cột credential) |
| Nhật ký audit | bảng | giữ, dùng `CommercialTable` |

### 3.3 Dùng template hệ thống

| Primitive | Dùng cho |
|---|---|
| `CommercialPage` | khung 2 panel (title · description · toolbar · region) |
| `CommercialToolbar` | thanh bộ lọc/thanh công cụ (nguồn · vai trò · chu kỳ · tìm kiếm) |
| `CommercialTable` | 3 bảng chính (nguồn dữ liệu · nhà môi giới · tình trạng kiểm tra) + bảng benchmark + audit |
| `CommercialState` | loading / empty / error (thay 3 banner lỗi rời rạc) |
| `CommercialMeta` | dải siêu dữ liệu (người apply · lúc · quyền ghi) |

⇒ class mới **phải** vào `packages/web/src/components/soc/soc.components.css` (token mới → `soc.tokens.css`); **KHÔNG** dùng `soc.module.css` (L-F03).

## 4. AC

| # | Điều kiện | Cách kiểm |
|---|---|---|
| **AC-1** | **Không mất chức năng** — giữ đủ 15 hành động của Môi giới + 29 hành động của VNBroker (checklist C.1/C.2 của khảo sát) | test component hiện có (`soc-vnbroker-console.component.test.tsx`) + cập nhật assertion theo tên mới |
| **AC-2** | Đủ 21 nhãn đổi tên (bảng §2) + **0** chuỗi raw tiếng Anh còn sót trong 2 panel | `npm run i18n:scan:strict` + grep `builtin\|api-key\|backfill\|snapshot\|signal\|kill-switch\|Benchmark provider` trong JSX |
| **AC-3** | Không còn **khối rỗng** (ô "REQUEST" rỗng, badge lặp, card celery rỗng, ô số hiện `0` khi chưa đặt) | grep + review ảnh chụp |
| **AC-4** | Bổ sung thông tin còn thiếu: `total_requests` · `error_rate` · `circuit_state` · `last_error` · "ai apply / lúc nào" ở đầu trang | test component + đọc code |
| **AC-5** | 2 panel dùng `CommercialPage` + ≥3 primitive của hệ thống | grep import |
| **AC-6** | Không hồi quy: `tsc` 0 · `lint` 0 error · `vitest` ≥ baseline · `check:contrast` 0 · `check:dom-landmarks` 0 · `check:light-theme` 0 | chạy thật, ghi exit code |
| **AC-7** | Ảnh chụp thật **2 panel × light/dark**, **mở ảnh ra xem** (L-V05) | lưu `docs/evidence/ui-redesign-20261021/` |

## 5. Slice

| Slice | Agent / branch | Nội dung |
|---|---|---|
| **R1** | `uistd-r1-rename` / `feat/uistd-r1-rename` | 21 nhãn + 4 giá trị raw → dịch (chỉ i18n, không đổi logic) |
| **R2** | `uistd-r2-vnbroker` / `feat/uistd-r2-vnbroker` | Tái bố trí `SocVnbrokerPanel.tsx` theo §3.1 + `CommercialTable` + dải meta + bảng dày + cột mới |
| **R3** | `uistd-r3-broker` / `feat/uistd-r3-broker` | Tái bố trí `SocBrokerPanel.tsx` theo §3.2 (bảng nhà môi giới + dải chính sách + bảng tình trạng kiểm tra) |

## 6. Rủi ro

| # | Rủi ro | Giảm thiểu |
|---|---|---|
| R-1 | Đổi nhãn ⇒ **test cũ đỏ** | cập nhật assertion cùng commit R1 (test là bằng chứng contract) |
| R-2 | Bỏ 3 ô KPI trùng ⇒ mất thông tin | giữ dạng **"3/3"** gộp 1 ô "Sẵn sàng 3/3" + số trùng vẫn hiện trong bảng |
| R-3 | Bảng dày ⇒ tràn ngang ở 1280px | `CommercialTable` cuộn ngang có wrapper (kiểm ở 1280 + 1920) |
| R-4 | Thêm cột mới (request/lỗi/circuit) ⇒ BE chưa trả ở mọi nơi | hiện "—" khi thiếu (không giả số) |
| R-5 | 2 agent cùng sửa `soc.components.css` | claim từng khối class; R2 xong mới R3 merge; kiểm `git diff --numstat` |

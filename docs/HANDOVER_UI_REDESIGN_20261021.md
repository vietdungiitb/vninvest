# HANDOVER — UI Redesign Operations Center (2 panel) + light theme (a)

> **Nhánh:** `dev` (đã push, không còn PR đang mở cho W0/W1 — #272/#273/#274/#275/#276 đều **MERGED**) · **Build staging hiện tại:** `9c9d8b204`
> **Owner yêu cầu (2026-10-21):** 2 giao diện refactor cho **gọn · giàu thông tin · dễ dùng**, **đổi tên dễ nhầm**, **theo đúng template hệ thống**; light theme theo **phương án (a)**.
> **Tài liệu:** plan `docs/PLAN_UI_REDESIGN_20261021.md` · audit W0 `docs/AUDIT_UI_STANDARDIZATION_W0.md` · ADR `docs/ADR_THEME_LIGHT_20261020.md` · ledger **Entry 390/391/392** · lessons `L-V08`/`L-V09`/`L-G09` · ảnh `docs/evidence/ui-redesign-20261021/`

---

## 1. Kết quả đo thật (staging, build `9c9d8b204`, script `measure-theme-tokens.mjs` có control 21.00:1)

| Chỉ số | Trước | Sau | Ghi chú |
|---|---|---|---|
| H1 `/admin/users` — **light** | **1.0000:1 (VÔ HÌNH)** | **19.2806:1** | lỗi nghiêm trọng nhất đã hết |
| H1 `/admin/users` — **dark** | 20.1728:1 | 20.1728:1 | **không hồi quy** |
| Logo sidebar — light | — | 5.3578:1 | |
| Chữ dưới AA — light | 28/60 | **10/60** | thấp nhất 1.0471:1 → **2.5526:1** |
| Chữ dưới AA — dark | 8/60 | 8/60 | **không hồi quy** |

## 2. Đổi tên (gốc rễ: hệ thống dùng chữ "provider" cho **hai** thứ, mã `DNSE` tồn tại ở cả hai)

| Hệ | Trước | Sau |
|---|---|---|
| VNBroker (nguồn dữ liệu) | "Tổng quan nhà cung cấp" / "Danh sách Providers" / "Cấu hình Kết nối Providers" | "Tổng quan **nguồn dữ liệu**" / "Danh sách **nguồn dữ liệu**" / "Cấu hình **nguồn dữ liệu**" |
| Vai trò | CHÍNH / DỰ PHÒNG / NGOÀI CHU KỲ | "Nguồn chính" / "Nguồn dự phòng" / "Không dùng" |
| Broker (nhà môi giới) | "Registry providers" | "Danh sách **nhà môi giới**" |
| Raw | `builtin`/`api-key` · `backfill`/`snapshot`/`signal` · "PROVIDER" | "Có sẵn"/"Cần API key" · "Bù dữ liệu"/"Chụp snapshot"/"Tín hiệu" · "Nhà môi giới" |

## 3. Bố cục (dùng template hệ thống `CommercialPage`/`CommercialTable`/`CommercialState`/`CommercialMeta`)

| Panel | Trước | Sau |
|---|---|---|
| **VNBroker** | lưới **tile** (mỗi tile 10 dòng, nhiều dòng "—") · KPI 6 ô (3 ô trùng form) · "Người áp dụng" ở **cuối trang** | **1 bảng 9 cột** (Nguồn · Vai trò · Sẵn sàng · Độ trễ · Thành công · **Request/Lỗi** · **Ngắt mạch** · Kiểm cuối · Thao tác) · KPI **4** ô · **dải meta đầu trang** |
| **Môi giới** | 3 khối **"Registry providers"** to (mỗi khối 1 card) · khung giờ tạm dừng rỗng (`type=text`) · badge "Chưa xác minh" **lặp 2 lần** · card Celery rỗng | **1 bảng 5 cột** · **1 dải chính sách** (khóa ghi + khung giờ `type=time` + lý do + nút) · **1 badge** duy nhất · empty state |

**3 cột mới** (Request/Lỗi, Ngắt mạch) lấy từ dữ liệu **BE đã trả về nhưng UI cũ bỏ trống** (`total_requests`/`failed_requests`, `circuit_state`).

## 4. Sửa thị giác light theme (5 vòng, mỗi vòng **chụp ảnh → mở ảnh ra xem**)

| Vòng | Vấn đề thấy trong ảnh | Sửa |
|---|---|---|
| 1 | nền panel xám-trung tính; chữ sáng trên nền xám; nút bó chữ | override `.glassPanel`/`.sectionCard`/`.vnbActionBtn` + `.vnbCellValue` |
| 2 | ô input nền xám-đậm (chữ tối trên nền tối) | dò **computed style** ⇒ đúng class là `.fieldInput` (không phải `.searchInput`) |
| 3 | nút bị bóp (w=44 vs scrollWidth=119) | `min-width: 7.5rem` + `nowrap` |
| 4 | card "Quan sát trực tiếp" nền xám-đậm; tiêu đề section nhạt; empty state xám | override `.metricCard`/`.sectionCardTitle`/`.emptyState` + `.vnbTileActions` 1 hàng |
| 5 | "PROVIDER" + "BACKFILL/SNAPSHOT/SIGNAL" raw; textarea `{}` | đổi giá trị i18n + placeholder JSON mẫu |

⇒ **Bằng chứng:** `docs/evidence/ui-redesign-20261021/{01,02}-vnbroker-{light,dark}.png`, `{03,04}-broker-{light,dark}.png`.

## 5. ⚠ Phát hiện 2 lỗi nghiêm trọng về **chính quy trình gate** (đã sửa)

1. **`pre-push-gate.mjs` hỏng cú pháp** ⇒ gate **không chạy** ⇒ các push sau đó **không được gate thật** (false green). Thủ phạm: commit `1fe43761c` (merge W1) — **ghép conflict bằng script tay** nối thêm dòng rác. Đã sửa (`b45b9c8ed`) + `node --check` 0 + chạy lại gate **28 PASS**.
2. **`.githooks/pre-push` kết thúc bằng `exit 0`** ⇒ gate FAIL vẫn cho push đi ⇒ **và** hook **bỏ qua toàn bộ gate khi đang ở `dev`** ⇒ mọi lần squash-merge vào `dev` đều **không qua gate**. Đã sửa (`688f73243`): gate fail ⇒ `exit $gate_status` (fail-closed) + `dev` chỉ bỏ qua khi **không có gì để đẩy** ⇒ nay push từ `dev` **có** chạy gate (đã kiểm chứng: output "pre-push-gate: 28 PASS" khi push từ `dev`).
3. ⇒ Bài học mới **L-G09** (`docs/LESSONS/build-gates-2.md`): *"push thành công" **KHÔNG** chứng minh gate đã chạy*; sau mỗi lần ghép conflict tay phải `node --check` + chạy lại gate.

## 6. Còn lại (W1-C backlog, đã đo)

| # | Việc | Số đo |
|---|---|---|
| C-1 | 10/60 chữ dưới AA ở light (chủ yếu `th` của bảng admin: `#94a3b8` trên `#f8fafc` = 2.45:1) | đo trên staging |
| C-2 | 4× breadcrumb chip: chữ `#0f172a` trên nền xanh `#2563eb` = 3.45:1 | |
| C-3 | **M-6**: đọc 12 token `--pf-*` (màu tăng/giảm) ở **runtime** | quan trọng nhất với app chứng khoán |
| C-4 | **M-7**: `check-a11y-runtime` lấy mẫu 250 phần tử text **đầu** ⇒ đo shell, chưa đo nội dung route | |
| C-5 | **T-2**: staging **có dữ liệu đóng (seed)** ⇒ bỏ `--advisory` (gate runtime hiện chỉ báo động vì app sống ⇒ tập vi phạm đổi 113→141→173) | |
| C-6 | Màu chữ/nền cứng ở **các trang khác** ngoài 2 panel này (~89 file / 497 chỗ chữ + 36 file nền theo ADR §4a) | |
| C-7 | Ảnh chụp 4 route khác (chỉ mới 2 panel) | |

## 7. Việc cần làm TIẾP THEO

1. **Owner xem ảnh** `docs/evidence/ui-redesign-20261021/` (light + dark) — đây là bằng chứng, không phải mô tả.
2. Quyết định: chấp nhận mức light theme hiện tại (28/60 → **10/60**) hay đẩy tiếp C-1/C-2/C-6.
3. Mở **W1-C** cho C-1/C-2/C-3/C-4/C-5 (mỗi mục 1 slice + claim + PR).
4. **W2–W3** (migrate 41 route sang template `CommercialPage`) — chỉ mở sau khi light theme ổn định.

## 8. Trạng thái claim / PR / worktree

| Hạng mục | Trạng thái |
|---|---|
| PR #271 (VNBroker) · #272 (W0) · #274 (R1) · #275 (R2) · #276 (R3) | **MERGED** |
| PR #273 (W1) | **CLOSED** (đã merge trực tiếp vào `dev` — commit `1fe43761c`) |
| Claim | 10 claim `uistd-*` đã **done** (xem `docs/CLAIMS.md`) |
| Worktree | chỉ còn main tree + `agent-infra-p0` (của agent khác) ⇒ 5 worktree `agent-uistd-*` đã xoá |
| Branch | `dev` sạch; các branch `feat/uistd-*` đã xoá (local + remote) |

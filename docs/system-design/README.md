# vninvest — Bộ Hồ Sơ Phân Tích & Thiết Kế Hệ Thống

> **Nền tảng đầu tư chứng khoán Việt Nam** — danh mục, dữ liệu thị trường, tín hiệu,
> khuyến nghị AI, môi giới DNSE, đa tenant.
>
> **Ngày lập:** 2026-10-14 · **Phạm vi:** `packages/core` (Django) + `packages/web`
> (React) · **Phương pháp:** đo từ source thật; con số máy đo được thì máy canh.
> **Giai đoạn:** Phase 1 — xương sống (governance + skeleton + tools). Nội dung từng
> phân hệ viết dần theo slice có claim riêng.

---

## 1. Bốn điều cần biết ngay

### 1.1. Bộ hồ sơ này là tài liệu điều hành chính thức từ Phase 1

Từ 2026-10-14, `docs/system-design/` là **xương sống và kim chỉ nam** cho đội code:
mọi lập kế hoạch, audit và thực hiện đều bắt đầu ở đây. Khi hai tài liệu mâu thuẫn,
tài liệu nào **được máy đo** thì tài liệu đó thắng — xem
[00.03](00-GOVERNANCE/00.03-quy-trinh-dong-bo.md).

### 1.2. Nó KHÔNG thay thế hai bộ di sản — mà đứng cạnh và điều hướng

| | `docs/architecture/` | `docs/saas_design_pack/` | `docs/system-design/` (bộ này) |
|---|---|---|---|
| Trả lời | Hệ thống **đang** chạy thế nào | Hệ thống **sẽ** xây thế nào | Đọc **cái gì, ở đâu**, và cái gì còn đúng |
| Hướng | AS-IS (hiện trạng) | TO-BE (kế hoạch SaaS) | Điều hướng + lấp phần thiếu |
| Tính chất | Viết tay, verify 262/262 citation (2026-10-03) | Viết tay, 12/13 file | Số định lượng máy sinh + phân tích viết tay |
| Chủ sở hữu | Session kiến trúc (giữ nguyên) | Session SaaS (giữ nguyên) | PM/Tech Lead — `sysdesign-p1` |

> ⚠ Đọc nhầm hướng là sai ngay: `saas_design_pack/D06` mô tả bảng chưa tồn tại
> trong `vninvest`. Quy tắc chọn bộ tài liệu: xem
> [`docs/architecture/README.md`](../architecture/README.md) §0.

### 1.3. Tài liệu này tự cập nhật một phần — phần đó được bảo đảm bằng máy

| | File | Cách bảo đảm |
|---|---|---|
| 🤖 | [`_meta/freshness-report.md`](_meta/freshness-report.md) | Sinh từ source. Lệch ⇒ cổng đỏ |
| 🤖 | [`_meta/inventory.json`](_meta/inventory.json) | Kiểm kê cây tài liệu. Lệch ⇒ cổng đỏ |
| 🤖 | [`_meta/claims.json`](_meta/claims.json) | Đối chiếu tuyên bố viết tay với code. Sai ⇒ cổng đỏ |
| ✍️ | Mọi tài liệu còn lại | Người viết. Quy trình ở [00.03](00-GOVERNANCE/00.03-quy-trinh-dong-bo.md) |

Cổng chặn: `node docs/system-design/_meta/tools/check-system-design.mjs --check`,
nối vào `scripts/pre-push-gate.mjs` (khối có guard, chỉ chặn khi drift thật).

### 1.4. Mọi khẳng định đều mang mức độ tin cậy

| Ký hiệu | Nghĩa |
|---|---|
| ✅ XÁC MINH | Đọc code, chạy lệnh kiểm chứng, kèm `file:line` |
| ⚠ SUY LUẬN | Suy từ hành vi code, chưa chạy thật |
| ❓ CHƯA XÁC MINH | Cần kiểm chứng thêm, không dùng để kết luận |

---

## 2. Bắt đầu ở đâu

| Bạn là | Đọc theo thứ tự này | Mục tiêu |
|---|---|---|
| Lãnh đạo / người quyết định | [`01.01`](01-SYSTEM-OVERVIEW/01.01-tom-tat-dieu-hanh.md) → [`13.01`](13-ROADMAP/13.01-lo-trinh.md) | Biết hệ thống ở đâu, cần làm gì tiếp |
| Người mới vào dự án | [`00.02`](00-GOVERNANCE/00.02-thuat-ngu.md) → [`_meta/freshness-report.md`](_meta/freshness-report.md) → [`11.01`](11-DEVELOPMENT/11.01-quy-trinh-phat-trien.md) | Hiểu bản đồ trong 1 giờ |
| Backend developer | [`06.01`](06-DATA-ARCHITECTURE/06.01-tong-quan-mo-hinh-du-lieu.md) → [`07.01`](07-API-SPEC/07.01-quy-uoc-api.md) → [`MODULES/`](MODULES/) | Biết viết code đúng kiểu dự án này |
| Frontend developer | [`02.01`](02-ARCHITECTURE/02.01-tong-quan-kien-truc.md) → [`07.01`](07-API-SPEC/07.01-quy-uoc-api.md) | Hiểu shell, route, adapter |
| Kiến trúc sư | [`02.01`](02-ARCHITECTURE/02.01-tong-quan-kien-truc.md) → [`00-GOVERNANCE/adr/`](00-GOVERNANCE/adr/) → [`13.02`](13-ROADMAP/13.02-so-no-ky-thuat.md) | Hiểu quyết định và nợ kỹ thuật |
| DevOps | [`09.01`](09-DEPLOYMENT-OPS/09.01-trien-khai-va-van-hanh.md) | Dựng và vận hành staging/prod |
| QA / Tester | [`10.01`](10-QUALITY-SECURITY/10.01-chien-luoc-kiem-thu.md) | Viết test có ý nghĩa |
| Agent (AI) | [`00.03`](00-GOVERNANCE/00.03-quy-trinh-dong-bo.md) → [`00.04`](00-GOVERNANCE/00.04-ban-do-chu-de.md) | Sửa code mà không làm tài liệu lệch |

---

## 3. Hệ thống này trong 60 giây

> Các con số dưới đây do máy đo (xem `_meta/freshness-report.md`). Mỗi con số trong
> bảng này đều có một mục trong `_meta/claims.json` để máy canh.

| | |
|---|---|
| **Là gì** | Nền tảng đầu tư chứng khoán VN: quản lý danh mục, dữ liệu thị trường, trung tâm tín hiệu (SOC), khuyến nghị AI, kết nối môi giới DNSE, đa tenant |
| **Công nghệ** | Django + DRF + PostgreSQL (bắt buộc) · React 19 + Vite · xem [08.01](08-TECH-STACK/08.01-cong-nghe-va-ky-thuat.md) |
| Quy mô BE | 15 Django app nghiệp vụ · 107 model · 115 migration |
| Vận hành | 10 compose stack · 42 lịch Celery beat |
| Quy mô tài liệu | 38 file trong bộ hồ sơ · toàn cây `docs/` xem [00.04](00-GOVERNANCE/00.04-ban-do-chu-de.md) |

---

## 4. Cấu trúc bộ hồ sơ

| Phân hệ | Nội dung | Trạng thái Phase 1 |
|---|---|---|
| `00-GOVERNANCE/` | Quản trị, thuật ngữ, đồng bộ, bản đồ chủ đề, ADR | ✅ Đầy đủ |
| `01-SYSTEM-OVERVIEW/` | Tóm tắt điều hành, ngữ cảnh hệ thống | ✅ 01.01 có số liệu máy đo |
| `02-ARCHITECTURE/` | Tổng quan kiến trúc, container, bản đồ module | ⏳ Skeleton — trỏ `D02` |
| `03-DIAGRAMS/` | Danh mục sơ đồ (C4, FBD, DFD, ERD) | ⏳ Skeleton — trỏ `D01`/`D02` |
| `04-FUNCTIONAL-SPEC/` | Phân rã chức năng, sổ quy tắc nghiệp vụ | ✅ 04.01 theo 7 cụm (nhóm route máy trích + cột tin cậy + 3 GAP 0-test) |
| `05-WORKFLOW/` | Luồng công việc end-to-end | ✅ 05.01 trace 5 workflow (mỗi bước `file:line` + cột tin cậy) |
| `06-DATA-ARCHITECTURE/` | Mô hình dữ liệu, data dictionary | ✅ 06.01 ba bất biến verify + 06.02 máy sinh 107 model (vòng so trong `--check`) |
| `07-API-SPEC/` | Quy ước API, danh mục endpoint | ✅ 07.02 máy sinh 1473 route (vòng so trong `--check`) |
| `08-TECH-STACK/` | Công nghệ, dependency, toolchain | ✅ 08.01 có stack đã verify |
| `09-DEPLOYMENT-OPS/` | Triển khai, vận hành | ⏳ Skeleton — trỏ runbook staging |
| `10-QUALITY-SECURITY/` | Kiểm thử, bảo mật, findings | ⏳ Skeleton — trỏ gate + lesson |
| `11-DEVELOPMENT/` | Quy trình phát triển, multi-agent | ⏳ Skeleton — trỏ `AGENT_PROTOCOL.md` |
| `13-ROADMAP/` | Lộ trình, nợ kỹ thuật | ✅ 13.02 có 2 nợ đã đo |
| `MODULES/` | Dossier từng Django app (15 app) | ✅ 15 dossier v1 (số liệu máy + mục đích/findings có cột tin cậy) |
| `_meta/` | Tools, claims, inventory, freshness | ✅ Tools + gate |

---

## 5. Quy ước toàn bộ

- Ngôn ngữ: **tiếng Việt** (tên file không dấu, nội dung có dấu đầy đủ).
- Mọi khẳng định về code kèm `file:line` đọc từ file thật (không đoán).
- Không viết tay con số mà máy đo được — khai vào `_meta/claims.json`.
- Bổ sung ở cuối file khi file đã có trích dẫn trỏ tới (giữ số dòng ổn định).
- Xem chi tiết: [00.01](00-GOVERNANCE/00.01-quan-tri-tai-lieu.md).

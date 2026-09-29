# Phản Biện Báo Cáo Audit SOC DataOps Migration Gap

**Phản biện cho**: `docs/AUDIT_SOC_DATAOPS_MIGRATION_GAP_20260625.md`  
**Ngày lập**: 2026-06-25  
**Cơ sở xác minh**: Code legacy (`frontend/src/components/soc/DataOpsPanel.jsx`) và native (`packages/web/src/components/soc/`)

---

## 1. Đánh giá tổng quan

### Mức độ chính xác: ~90%

Đa số claim trong tài liệu audit là **chính xác và có thể xác minh qua code**. Đây là một tài liệu gap analysis có giá trị, tuy nhiên cần điều chỉnh một số điểm về mức độ nghiêm trọng và scope đề xuất.

---

## 2. Xác nhận các claim (đã đối chiếu code)

### 2.1 i18n & Terminology Gaps — ✅ Đúng

| Claim | Bằng chứng | Verdict |
|---|---|---|
| `soc.scheduler.*` (8 keys) thiếu | `SocSchedulerBoard.tsx:93-207` gọi 8 key; không tồn tại trong `vi.js`/`en.js` | ✅ |
| `soc.actions.confirm` thiếu | `SocSchedulerBoard.tsx:235` gọi key; không tồn tại trong `vi.js`/`en.js` | ✅ |
| `soc.actions.cancel` tồn tại | Key tồn tại trong i18n | ✅ (audit không claim thiếu) |

### 2.2 Tab Kho dữ liệu — ✅ Đúng (3/4 claim)

| Claim | Bằng chứng | Verdict |
|---|---|---|
| Thiếu cột `calendar_days` | Legacy `DataOpsPanel.jsx:183-185`: `g.calendar_days < 30` cảnh báo ⚠. Native `SocDataInventorySection.tsx:131` hiển thị `"Recent (30d)"` thay vì `calendar_days` | ✅ |
| Thiếu nhận diện Custom Groups (icon ★, text-teal-300) | Legacy dùng CSS class `text-teal-300` cho custom groups. Native không có xử lý này | ✅ |
| Thừa cột "Recent (30d)" | Native `SocDataInventorySection.tsx:131-145` thêm cột này. Legacy không có cột này trong coverage table | ✅ |
| Thiếu border dynamic cho DataType cards | Legacy dùng `border-emerald-800 bg-emerald-950/30` nếu `total_rows > 0`. Native `SocDataInventorySection.tsx:84-96` dùng `styles.dataTypeCard` tĩnh | ✅ |

### 2.3 Tab Điều phối — ✅ Đúng (cả 3 claim)

| Claim | Bằng chứng | Verdict |
|---|---|---|
| Gộp Backfill vs Planner sai | Legacy: `BackfillCenterSection` (lines 225-2767) + Planner section riêng (lines 2060-2392) với `textarea` + `previewDataOpsPlanner`/`runDataOpsPlanner` API. Native: gộp vào `SocDataOpsBackfillForm.tsx` | ✅ |
| Thiếu textarea danh sách mã tự do (Planner Console) | Legacy `DataOpsPanel.jsx:2076-2093` có `textarea` + `soc.dataops.planner_symbols` label. Native có textarea (dòng 196-204) nhưng gộp chung form với Backfill | ✅ |
| Thiếu bảng Planned/Skipped Items phân trang | Legacy `DataOpsPanel.jsx:2204-2392`: tables có pagination (12 items/page) với expand/collapse. Native `SocDataOpsBackfillForm.tsx` show summary counts (`planned_count`, `skipped_count`) nhưng không có bảng chi tiết | ✅ |
| Thiếu Custom Group CRUD Manager | Legacy `DataOpsPanel.jsx:2637-2650`: render danh sách custom groups + nút tạo/xóa. Native không có | ✅ |

### 2.4 Tab Giám sát — ⚠️ Cần điều chỉnh

| Claim | Bằng chứng | Verdict |
|---|---|---|
| JSON dump cho coverage | ✅ `SocDataOpsMonitorSection.tsx:159`: `createElement("pre", ..., JSON.stringify(coverage))` | ✅ |
| "Khung rỗng" — sai mức độ | Monitor section render **3 card**: (1) Queue tiers grid, (2) Observability (fail rate 1h/24h, backlog, starvation alerts), (3) Coverage JSON dump. Chỉ coverage card dùng JSON dump. Hai card còn lại render đúng UI | ⚠️ Overstated |
| Thiếu LiveMatrix, Parity Gates, Retention Health, Anomaly Guard | Legacy thực sự có các panel này? Cần xác minh thêm. Monitor section trong legacy (`DataOpsPanel.jsx`) chưa được kiểm tra đầy đủ | ⚠️ Unverified |

### 2.5 Tab Cấu hình — ✅ Đúng

| Claim | Bằng chứng | Verdict |
|---|---|---|
| Duplicate Scheduler board | `SocDataOpsConfigSection.tsx:4` import + `:185` render `SocSchedulerBoard` với `domain: "dataops"`. Subtab Scheduler riêng đã có | ✅ |

---

## 3. Điểm cần điều chỉnh trong tài liệu audit

### 3.1 Monitor Section bị đánh giá thấp hơn thực tế

Audit gọi Monitor section là "khung rỗng" và "chỉ kết xuất JSON thô", nhưng thực tế:

```
MonitorSection render:
├── Card 1: Queue Tiers (grid với tier name, symbol count, cadence, examples)
├── Card 2: Observability
│   ├── Fail rate 1h (metric card, color-coded)
│   ├── Fail rate 24h (metric card, color-coded)
│   ├── Backlog by dataset (badge list, màu đỏ nếu > 100)
│   └── Starvation alerts (inline error list)
└── Card 3: Coverage (JSON dump — đây là phần duy nhất bị lỗi)
```

Đề xuất sửa audit: "Coverage panel dùng JSON dump thô thay vì visual matrix" — chính xác hơn "khung rỗng".

### 3.2 Scope inflation trong đề xuất phân rã

Mục 6 đề xuất 7 component mới:
- `SocBackfillCenter.tsx`
- `SocDataOpsPlannerConsole.tsx`
- `SocCustomGroupManager.tsx`
- `SocLiveMatrixPanel.tsx`
- `SocParityGatesPanel.tsx`
- `SocRetentionHealthPanel.tsx`
- `SocAnomalyGuardPanel.tsx`

**Vấn đề vê scope**: Phase 1 ban đầu target ~50% parity. Đề xuất này tương đương Phase 2 (expand parity lên ~80-90%). Cần tách bạch:

| Nhóm | Mức độ | Thời gian ước tính |
|---|---|---|
| **Quick wins** (i18n, CSS tuning, xóa duplicate) | Dễ | 1-2 giờ |
| **Phase 1 Extended** (Planner Console, Custom Group CRUD) | Trung bình | 4-8 giờ |
| **Phase 2** (Monitor panels: LiveMatrix, Parity Gates, Retention Health, Anomaly Guard) | Lớn | 2-4 tuần |

### 3.3 Bỏ sót Tab 4 — Scheduler subtab

Tài liệu audit phân tích Tab 1, 2, 3, 5 nhưng không có mục riêng cho **Tab 4: Lịch chạy (Scheduler)**. Subtab này được định tuyến riêng nhưng không được đánh giá.

### 3.4 Duplicate Scheduler — thiếu context

Audit kết luận "Scheduler ở Config là trùng lặp thừa thãi". Tuy nhiên instance ở Config dùng `domain: "dataops"` — có thể đây là scheduler scoped cho DataOps config cụ thể, khác với Scheduler subtab tổng quan. Cần kiểm tra legacy để xác nhận.

### 3.5 Chưa ghi nhận phần đã làm đúng

Audit tập trung hoàn toàn vào gap mà không ghi nhận các phần đã đạt parity:

- **Inventory section (Steps 2a-2d)**: Data types grid, Coverage by group table (5/6 columns), Queue tiers accordion, Year distribution bar chart — đạt parity cơ bản
- **Backfill form**: Dataset checkboxes, VN100+CUSTOM groups, Preview+Run flow, inline error/success messages, Run Logs — đạt parity cơ bản
- **Scheduler board**: Danh sách jobs, pause/resume/trigger actions, confirm modal — UI hoàn chỉnh

---

## 4. Phân loại ưu tiên sửa chữa đề xuất

### ⚡ Priority 0 — Quick wins (ước tính 1-2 giờ)

| Task | File | Khó |
|---|---|---|
| Thêm `soc.scheduler.*` (8 keys) + `soc.actions.confirm` vào `vi.js`/`en.js` | `packages/web/src/i18n/vi.js`, `en.js` | Dễ |
| Xóa `SocSchedulerBoard` khỏi `SocDataOpsConfigSection.tsx:185` | `SocDataOpsConfigSection.tsx` | Dễ |
| Thêm `total_rows > 0` border dynamic cho DataType cards | `SocDataInventorySection.tsx` | Dễ |
| Đổi cột "Recent (30d)" → "Ngày lịch" + warning nếu < 30 | `SocDataInventorySection.tsx` | Dễ |
| Thêm icon ★ + `text-teal-300` cho custom groups | `SocDataInventorySection.tsx` | Dễ |

### 🎯 Priority 1 — Phase 1 Extended (ước tính 4-8 giờ)

| Task | Mô tả |
|---|---|
| Tách `SocDataOpsBackfillForm.tsx` thành `SocBackfillCenter.tsx` + `SocDataOpsPlannerConsole.tsx` | Planner console có textarea + bảng Planned/Skipped phân trang |
| Thêm `SocCustomGroupManager.tsx` | CRUD custom symbol groups, đồng bộ vào radio list |

### 🏗️ Priority 2 — Phase 2 (ước tính 2-4 tuần)

| Task | Mô tả |
|---|---|
| `SocLiveMatrixPanel.tsx` | Canvas heatmap matrix cho dataset x freshness states |
| `SocParityGatesPanel.tsx` | 24h/72h pass/fail parity gates với lịch sử 7 kỳ |
| `SocRetentionHealthPanel.tsx` | Retention monitoring + histogram |
| `SocAnomalyGuardPanel.tsx` | Critical gap symbols + hot tier breach |
| Thay coverage JSON dump bằng visual matrix | Tận dụng `SocMatrixScrapeMonitor.tsx` đã có |

---

## 5. Kết luận

Tài liệu audit là **gap analysis chất lượng tốt** với độ chính xác ~90%. Các quick wins nên được xử lý ngay (ước tính 1-2 giờ). Phase 1 Extended (Planner Console + Custom Groups) là bước tiếp theo hợp lý nếu muốn tăng parity từ ~50% lên ~70%. Phase 2 (Monitor panels) nên được lên kế hoạch riêng do scope lớn.

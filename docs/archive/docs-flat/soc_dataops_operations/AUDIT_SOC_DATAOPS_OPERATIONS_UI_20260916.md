# Audit UI/UX — Vận hành (Operations) — `SocDataOpsOperationsSection`

**Date:** 2026-09-16
**Scope:** `packages/web/src/components/soc/SocDataOpsOperationsSection.tsx:1-824` (Vận hành) + `DataOpsContext.tsx:1-165` + `soc.js:207-213` + `dataops_base.py:80-164` + `dataops_planner.py:95-112` + `soc.components.css` ops* classes
**Khung:** `AGENTS.md:136-216` — mọi khẳng định `file:line`, grep toàn repo `.css/.module.css/i18n`, không đoán
**Build:** `tsc 0`, `build 58s` sau P0 hotfix

---

## 0. Tóm tắt — 3 lỗi “—” + bố trí rời rạc

1. **Nhật ký chạy chỉ hiện “—” (P0):** `SocDataOpsOperationsSection.tsx:666` `log.dataset ? t(dataset) : "—"` luôn “—” vì BE `dataops_base.py:152-164` `_serialize_market_data_run_log` **không trả `dataset/message/planned/inserted`** — chỉ `run_id/status/mode/reason/execution_mode/started_at/finished_at/summary{planned_items,skipped_items,inserted,updated,skipped_existing,failed}`. FE đọc `log.dataset`/`log.planned` sai key → trống. Tương tự `log.message` không tồn tại.

2. **Bố trí rời rạc, thiếu thông tin (P1):** Form chia `opsFormGrid 1.2fr 1fr` (`soc.components.css:1893-1903`) nhưng trái chỉ datasets, phải nhồi `symbol_group + date + mode + exec + reason + 2 checkboxes` vertical → density cao, label `0.65rem uppercase` khó đọc, không có group box, không có summary preview inline. So Airflow DAG trigger có 3 zone rõ: *Scope → Execution → Reason*, Temporal có timeline.

3. **Thiếu chuẩn công nghiệp:** Không có **timeline** (run như DAG run list với duration bar), không có **execution plan inline**, không có **validation hint** cạnh input, không có **primary CTA hierarchy** (Chạy vs Xem trước cùng cấp `runBtn` vs `actionBtn`), không có **empty illustration**, không có `aria` cho form.

---

## A. Findings chi tiết (file:line)

| ID | Mức | file:line | Thực tế | Tác động |
|---|---|---|---|---|
| **O01** | CRITICAL | `OperationsSection.tsx:14-26` `RunLogEntry {dataset, planned, inserted…}` vs `dataops_base.py:152-164` return shape | FE interface sai contract. BE `summary` lồng, FE đọc flat → luôn “—” và stats null. | Nhật ký trống, user tưởng không có dữ liệu. |
| **O02** | CRITICAL | `OperationsSection.tsx:666-688` `log.started_at?.split("T").join(" ")` raw + `log.message` | BE `started_at` ISO, FE chỉ cắt `T`, không `formatLastCheck` như Overview (`socTime.ts`), không duration, không `finished_at`. | Thiếu thời gian chuẩn, khó audit. |
| **O03** | HIGH | `OperationsSection.tsx:737-762` `opsFormGrid` 2 cột + `renderDatasetCheckboxes:250-300` 8 cards `dataTypeCard` + `renderSymbolGroupSelect:302-355` filterBtn list + `renderDateModeRow:357-401` 4 cols | 3 nhóm nằm 2 cột không đều, `filterBtn` cho symbol group (22 items) tràn, không search, không selected count. Label `opsFormLabel` `0.7rem 600` nhạt. | Scan chậm, chọn VN100 khó. |
| **O04** | HIGH | `soc.components.css:1926-1936` `opsSectionHeader 0.85rem 700 border 00b4d8/0.15` | Header chỉ text + border, không có icon, không có help tooltip, không có required marker. | Không hướng dẫn. |
| **O05** | HIGH | `OperationsSection.tsx:415-437` `renderDryRunCheckbox` 2 checkboxes stacked | Dry-run và Force refresh cùng cấp, không có warning màu, không có description. So Datadog có toggle + helper text. | Dễ tick nhầm force. |
| **O06** | MEDIUM | `OperationsSection.tsx:439-462` `renderActionRow` 2 buttons `runBtn` vs `actionBtn` | Cùng cấp, không hierarchy: primary “Chạy” nên solid, secondary “Xem trước” outline. Hiện `runBtn` `00b4d8/0.2` nhạt, `actionBtn` transparent. | CTA mờ. |
| **O07** | MEDIUM | `OperationsSection.tsx:615-722` `renderRunLogsSection` `sectionCard` + `select 5/10/15/20` + `opsRunLogCard` flex column `0.35rem gap` | Card `opsRunLogCard` không có left accent theo status, không có timeline dot, không có duration bar, không có `reason/mode` badge. Pagination `Prev/Next` text nhỏ, không `showing_range`. | Không đạt Airflow run list. |
| **O08** | MEDIUM | `OperationsSection.tsx:793-822` Preview drawer `opsPreviewDrawer 560px` | Drawer tách khỏi form, không có sticky summary, `planned/skipped` metricCard click toggle nhưng không có icon, table `previewTable` 0.7rem không sticky header, không zebra. | Xem trước rời rạc. |
| **O09** | LOW | `OperationsSection.tsx:318-319` Drawer button `⚙ + t(subtab.config)` | Nhãn sai ngữ cảnh (mở Custom Groups), dùng emoji `⚙` thay `LucideIcon Settings`. | Thiếu nhất quán. |
| **O10** | LOW | `soc.components.css:1888-1999` ops* classes | Nhiều style inline `style:{cursor,opacity,border}` trong TSX, không qua token, `opsDryRunRow` không định nghĩa trong CSS. | Khó theming. |

---

## B. So sánh chuẩn công nghiệp

| Tiêu chí | Airflow | Datadog Workflow | Temporal | SOC Vận hành hiện tại | Gap |
|---|---|---|---|---|---|
| **Header** | DAG name + description + tags + last run | Service + env + live dot | Namespace + workflow id | Chỉ `backfill_form_title` + ownership badge | Thiếu context |
| **Form layout** | 2 cột: Scope (datasets+symbols) / Execution (schedule+params) + collapsible Advanced | Left form + Right preview sticky | Left inputs + Right history timeline | 2 cột không đều, Advanced lẫn trong main | Cần regroup |
| **Run list** | Timeline: run_id + status badge + duration bar + started/finished + summary + actions | Table + health bar | History with run_id + status dot + duration | Card flex column, chỉ “—” + status + time raw | Thiếu duration bar, summary |
| **Preview** | Inline summary cards + DAG graph + task table paginated | Preview modal + diff | Sticky preview + JSON | Drawer tách, không inline | Cần inline sticky |
| **Validation** | Inline error under input + top banner | Banner + field error | Inline | Top `inlineError` generic | Cần field-level |

---

## C. Nguyên nhân “—”

- BE `DataOpsRunLogsView:95-112` `paginate_queryset` → `_serialize_market_data_run_log` → `run_id, status, mode, reason, execution_mode, started/finished, summary{planned_items,…}`.
- FE `RunLogEntry` định nghĩa `dataset: string` (`:16`) không tồn tại → `log.dataset ? … : "—"` luôn “—”.
- Stats `log.planned` etc không có, phải là `log.summary.planned_items` hoặc `log.summary.inserted`.

**Verify grep:**
- `grep -R "dataset" packages/core/backend/src/service_ops/views/dataops_base.py` → không có `dataset` trong serialize.
- `grep -R "getSocDataOpsRunLogs" packages/web` → `soc.js:173-174` và `OperationsSection.tsx:106`.

---

## D. Ảnh hưởng với user khó tính

- Không biết run nào chạy gì (thiếu dataset/mode/reason), không ước lượng duration, không phân biệt queued/running/success/failed bằng màu rõ.
- Form rời rạc → phải scroll nhiều, không thấy preview khi chọn.

---

*Audit này là cơ sở cho `IMPLEMENTATION_PLAN_SOC_DATAOPS_OPERATIONS_RESTRUCTURE_20260916.md`.*

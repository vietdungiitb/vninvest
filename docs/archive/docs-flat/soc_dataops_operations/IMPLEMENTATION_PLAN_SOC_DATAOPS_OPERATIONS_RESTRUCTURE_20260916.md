# Kế Hoạch Tái Cấu Trúc Vận Hành — Chuẩn Công Nghiệp (Airflow/Datadog/Temporal)

**Mã:** SOC-OPS-RESTRUCTURE-20260916
**Nguồn audit:** `docs/AUDIT_SOC_DATAOPS_OPERATIONS_UI_20260916.md` (O01-O10)
**Mục tiêu:** Bố trí lại `SocDataOpsOperationsSection` thành **chuẩn công nghiệp**, hết “—”, hết rời rạc, đạt user khó tính — bàn giao không hỏi lại.

---

## 0. Quyết định đã chốt (không hỏi lại)

1. **Single contract:** FE `RunLogEntry` đổi sang BE shape `service_ops/views/dataops_base.py:152-164` — đọc `summary.*` và `mode/reason`, bỏ `dataset/message` top-level. Thêm mapping `O01` để hiện “—” → hiện mode/reason/datasets count.
2. **Layout 3 zone (Airflow):** `ShellPanel` > `opsLayout = [Form 2-col sticky] + [History timeline sticky]` — trái `scope` (datasets+symbol) / phải `execution` (mode+exec+reason+flags) / dưới `actions + preview inline sticky + timeline`.
3. **Timeline:** Run list dạng **Airflow DAG runs**: left accent `statusColor`, header `run_id + SocStatusBadge + duration bar`, meta `mode • reason • execution_mode`, stats `planned/inserted/updated/failed` từ `summary`, time `formatLastCheck` + `duration_seconds`.
4. **Hierarchy CTA:** Primary `Chạy` solid `runBtn` (cyan), Secondary `Xem trước` outline `actionBtn` — `Xem trước` không mở drawer mà **inline sticky preview** dưới actions.
5. **Token:** Không hardcode `rgba`, dùng `soc.tokens.css` semantic.

---

## 1. WBS & file:line

### W-OPS-01 — Fix “—” contract (P0, 1h)

| File | Dòng | Sửa |
|---|---|---|
| `SocDataOpsOperationsSection.tsx:14-26` | Interface `RunLogEntry` thêm `mode, reason, execution_mode, summary: {planned_items, inserted, updated, skipped_existing, failed}, finished_at, duration_seconds` bỏ `dataset, message, planned` flat. | Map `runLogs` từ `data.results` → `map(r=> ({...r, summary: r.summary||{}, datasetLabel: r.summary?.datasets?}))` |
| `:656-691` `renderRunLogsSection` | `log.dataset ? t(dataset) : "—"` → `createElement("span", {className: styles.opsRunLogDatasets}, (log.summary?.datasets?.join(", ") || log.mode) )` + `SocStatusBadge` + `formatLastCheck` + `duration` | Hiện mode/reason thay “—” |
| `soc.components.css` | Thêm `opsRunLogCard` left border `statusColor`, `opsRunLogTimelineDot` |  |

**Tiêu chí:** Given BE trả `run_id: md-run-5, mode: missing_only, summary: {inserted:5}` → Then row hiện `missing_only • ops_soc • 5 inserted` không “—”, time `2 phút trước` + duration `12s`.

### W-OPS-02 — Bố trí lại form 3 zone (P1, 2h)

| Zone | Component | File:line | Chi tiết |
|---|---|---|---|
| **A. Scope** | `renderDatasetCheckboxes` + `renderSymbolGroupSelect` | `OperationsSection.tsx:250-355` | Gom vào `opsScopeCard` với `sectionCardTitle` icon `Database` + `Users`, `opsCheckboxGrid 3col` (was 2), `opsGroupBar` filterBtn + selected count `3/8` |
| **B. Execution** | `renderDateModeRow` + `renderReasonInput` + `renderDryRunCheckbox` | `:357-437` | Gom vào `opsExecCard` với `sectionCardTitle` icon `Play` — 2 rows: row1 `mode + exec` (2col), row2 `reason` full width, row3 `dryRun + forceRefresh` với helper text màu warning |
| **Layout** | `opsFormGrid` | `soc.components.css:1893-1903` | Đổi `1.2fr 1fr` → `1fr 1fr` + gap `1.5rem`, sticky `opsRightCol` top `1rem`, responsive `1024px → 1fr` |

**Tiêu chí:** Form nhìn như Airflow Trigger DAG: trái Scope, phải Execution, không scroll quá 1 viewport.

### W-OPS-03 — Preview inline sticky (P1, 1h)

- Bỏ `isPreviewDrawerOpen` drawer (`:101,798-821`), thay bằng `renderPreviewInline` ngay dưới `renderActionRow` trong `opsExecCard`, sticky `top:1rem` khi có `preview`.
- `planned/skipped` metricCard giữ click toggle, table `previewTable` thêm sticky th + zebra (đã có global).

### W-OPS-04 — Timeline history (P1, 1.5h)

- `renderRunLogsSection` → `opsTimeline` vertical line `::before`, mỗi `opsRunLogCard` có `timelineDot` màu `statusColor`, `progressBar` nếu `running`, `opsRunLogStats` badge `inserted/failed`, pagination `showing_range` như Overview.

### W-OPS-05 — Polish (P2, 0.5h)

- `opsSectionHeader` thêm `LucideIcon`, `filterBtn` → `domainPill` style, `actionBtn` hierarchy, `emptyState` illustration, `inlineError` icon.

---

## 2. Tiêu chí bàn giao (DoD)

- [ ] `npx tsc --noEmit` 0, `npm run build` PASS
- [ ] Vận hành: không còn “—”, row hiện `run_id • mode • reason • status • duration • summary`
- [ ] Form 3 zone rõ, preview inline, history timeline, responsive 390 không tràn
- [ ] A11y `role=region`, `aria-label`, `focus-visible`
- [ ] `grep " —" packages/web/src/components/soc/SocDataOpsOperationsSection.tsx` không còn fallback “—” cho dataset (chỉ cho optional)

---

## 3. Timeline

| Phase | Việc | Ước |
|---|---|---|
| P0 | W-OPS-01 fix “—” | 1h |
| P1 | W-OPS-02+03+04 layout + preview + timeline | 4.5h |
| P2 | W-OPS-05 polish | 0.5h |
| QA | gates | 0.5h |

*Đội code làm theo file:line và Given/When/Then, không hỏi lại.*

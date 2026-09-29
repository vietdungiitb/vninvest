# Kế Hoạch Tái Cấu Trúc Giám sát — Chuẩn Công Nghiệp

**Mã:** SOC-MONITOR-RESTRUCTURE-20260916
**Nguồn audit:** `docs/AUDIT_SOC_DATAOPS_MONITOR_UI_20260916.md` (M01-M14)
**Mục tiêu:** Bố trí lại `SocDataOpsMonitorSection` hết rời rạc, đạt demanding customer — bàn giao không hỏi lại.

---

## 0. Quyết định đã chốt

1. **IA 4 nhóm (Datadog):** Hero 4 → System Live (Matrix+Active) → Backlog & Failures (2-col) → Coverage Health (Heatmap+Top gaps+Queue tiers compact) → Governance (Parity/Retention 2-col + Anomaly full + Exports footer). Dùng `sectionGrid` 2-col, `inventoryRoot gap 1.25rem`, sticky `top 1rem` cho preview.
2. **Matrix luôn mở:** Bỏ `matrixExpanded` collapsed, default expanded, header có `live dot + cycle count + providers count` + button `Thu gọn` secondary.
3. **Hero:** 4 `metricCard` như Overview: `Backlog total | Fail 1h | Starved | Coverage stale` — tính từ `observability` + `coverage`.
4. **Backlog viz:** `by_dataset` thành **bar chart** (reuse `yearChart` styles) + table, `by_tier` thêm `datasets` breakdown pills, `starvation` thành **progress bar** `seconds/threshold`.
5. **Coverage heatmap:** `coverageTable` ô có `background` theo count (0→50→200 scale) + `color` contrast, `total` bold, sticky header.
6. **Queue tiers deduplicate:** Giữ ở Monitor nhưng compact `pill` style, không accordion như Inventory.

---

## 1. WBS

### W-MON-01 — Hero + System Live (P0, 1h)

| File | Dòng | Sửa |
|---|---|---|
| `MonitorSection.tsx:158-169` | State `matrixExpanded` → default `true`, remove toggle logic hoặc giữ nhưng default true | Header `matrix_snapshot` + `live dot + X cycles` + `Y providers` |
| `:371-396` | Trước Observability, chèn `hero: metricGrid 4` tính `backlogTotal = sum by_dataset backlog_count`, `starvedCount = starvation.filter(s=>is_starved).length`, `fail1h, fail24h` | Reuse `renderMetricCard` |
| `:377-396` | Matrix sectionCard `sectionCard` full width, `matrixExpanded ? <Monitor> : null` → luôn `<Monitor>` + header `sectionCardTitle` icon `Radio` |  |

**Tiêu chí:** Hero 4 cards hiện đúng số, Matrix mở mặc định, không cần click.

### W-MON-02 — Backlog & Failures 2-col (P1, 1.5h)

| Block | File:line | Chi tiết |
|---|---|---|
| Fail rates | `:441-455` | Giữ 2 cards nhưng thêm `total_runs` caption `failed/total` + `degraded_rate` small text, màu `danger>10, warning>5` giữ |
| Backlog dataset | `:461-506` | Thêm bar: `max = max(backlog_count)`, mỗi row có `<div yearBarTrack><div yearBarFill width pct>` + count, giữ table hoặc thay bar+table |
| Starvation | `:508-558` | Mỗi tier `div accordion` → `div progress` : `track 4px` + `fill width = min(seconds/threshold*100,100)` + label `12s / 90s` + badge `Starved/Stable` |
| Backlog tier | `:562-608` | Thêm `datasets` pills dưới mỗi tier row: `tier.datasets.map(d=> pill dataset:count)` |

**Tiêu chí:** Backlog nhìn là biết dataset nào nhiều nhất (bar), Starvation thấy ngay tier nào starved (red progress).

### W-MON-03 — Coverage Heatmap (P1, 1h)

| File:line | Sửa |
|---|---|
| `:635-709` | Mỗi `td` count → `style background: count>100? rgba(239,68,68,0.25) : count>20? rgba(245,158,11,0.2) : count>0? rgba(34,211,238,0.08) : transparent` + `color` tương phản. `total` bold + `background rgba(15,23,42,0.4)` |
| Header | Giữ `FRESHNESS_LABEL_KEYS`, thêm `title` tooltip `count/total` |

**Tiêu chí:** Nhìn heatmap biết ngay `daily_prices missing 8` đỏ hơn `warm 10` vàng.

### W-MON-04 — Top gaps bulk (P2, 0.5h)

- Thêm `selectedGaps` state, checkbox per row, header checkbox, footer `Hydrate selected (N)` button gọi `previewSocDataOpsPlanner` với `symbols: selected` (không queue, chỉ preview) — như commercial bulk.

### W-MON-05 — Queue tiers compact (P2, 0.25h)

- Đổi `queueTiers` list `div` → `dataTypeGrid` pills: mỗi tier `metricCard` nhỏ với `tier label + symbol_count + cadence + examples pills` — không accordion.

---

## 2. DoD

- [ ] `tsc 0`, `build PASS`, `vitest 20/20`
- [ ] Giám sát: Hero 4, Matrix mở, Backlog bar+progress, Coverage heatmap màu, Top gaps bulk, responsive 390
- [ ] Không double fetch (giữ interval 30s+jitter đã có)
- [ ] A11y `role=region`, `aria-label`, `focus-visible`

---

## 3. Timeline

| Phase | Việc | Ước |
|---|---|---|
| P0 | W-MON-01 Hero+Matrix | 1h |
| P1 | W-MON-02+03 Backlog+Heatmap | 2.5h |
| P2 | W-MON-04+05 bulk+compact | 0.75h |
| QA | gates | 0.5h |

*Làm theo file:line và Given/When/Then, không hỏi lại.*

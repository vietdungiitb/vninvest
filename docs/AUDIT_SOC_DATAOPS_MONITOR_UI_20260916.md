# Audit UI/UX — Giám sát (Monitor) — `SocDataOpsMonitorSection`

**Date:** 2026-09-16
**Scope:** `packages/web/src/components/soc/SocDataOpsMonitorSection.tsx:1-817` + 3 delegate panels (`ParityGates`, `RetentionHealth`, `AnomalyGuard`) + `SocMatrixScrapeMonitor` + BE `dataops_observability.py` + `soc.components.css` monitor classes
**Khung:** `AGENTS.md:136-216` — mọi khẳng định `file:line`

---

## 0. Tóm tắt — 5 vấn đề “rời rạc khó hiểu”

1. **Một cột dài 7 sectionCard:** Matrix (collapsed) → Observability (2 metric + 3 glassPanels) → Parity → Retention → Anomaly → Coverage matrix → Top gaps → Queue tiers → vertical stack không nhóm, phải scroll 3 viewport mới hết. So Datadog có 2-col grid + sticky.
2. **Ma trận cào bị giấu:** `matrixExpanded=false` default (`:167`), nút “Mở rộng/Thu gọn” nhỏ `actionBtn` trong header, không có preview heatmap, không có live count. User khó tính không biết có gì bên trong.
3. **Observability 3 glassPanels lồng sectionCard:** `backlog_by_dataset` + `starvation` + `backlog_by_tier` mỗi cái là `glassPanel` trong `sectionCard` (`:463,509,562`) — visual nesting 2 cấp cùng border 0.15, khó phân biệt.
4. **Coverage matrix thuần text:** `coverageTable` 6 cột `fresh/warm/stale/missing/error/unknown` + `total` (`:665-704`) chỉ số, không heatmap, không sort, không filter. GrandTotal 0 → `emptyState` nhưng không có illustration.
5. **Queue tiers trùng Inventory:** Monitor render lại `queueTiers` list (`:782-815`) giống `SocDataInventorySection` accordion — duplicate, double fetch `getSocDataOpsQueueTiers` (cả 2 tab).

---

## A. Findings chi tiết

| ID | Mức | file:line | Thực tế | Tác động |
|---|---|---|---|---|
| M01 | CRITICAL | `MonitorSection.tsx:377-396` Matrix sectionCard header `matrix_snapshot` + button `matrix_expand/collapse` | Collapsed mặc định, `SocMatrixScrapeMonitor` chỉ render khi `matrixExpanded===true`. Không có badge “N cycles / M providers”, không có live dot. | User không biết có dữ liệu. |
| M02 | HIGH | `:398-434` Observability header `observability_title` + `observability_updated_at` + 2 export buttons inline `gap 0.5rem` | 2 export `actionBtn` nằm cạnh title, không icon, không tooltip, không `service_key` hint. `observability_description` là `<p>` generic. | Khó phát hiện export, không biết filter. |
| M03 | HIGH | `:441-455` `metricGrid` 2 cards `fail_rate_1h/24h` | Chỉ 2 số, không có sparkline, không có `total_runs/failed_runs` chi tiết, không có trend vs trước. So Grafana có 4 stats + sparkline. | Thiếu context. |
| M04 | HIGH | `:457-509` `backlog_by_dataset` glassPanel table 2 cột `dataset/backlog_count` | Table 2 cột đơn giản, không có bar, không có sort, không có total. | Khó so sánh. |
| M05 | HIGH | `:509-558` `starvation_indicator` map `tier → is_starved` + `statusBadge` `Starved/Stable` | Mỗi tier là `div` với `flex` không card, không progress `seconds_since_last_progress / threshold`, không có `latest_progress_started_at` formatted. | Khó biết mức độ starvation. |
| M06 | MEDIUM | `:562-608` `backlog_by_tier` table `tier/symbol_count/backlog_symbols` | Thiếu breakdown `datasets[]` per tier (`observability.backlog.by_tier[].datasets` có nhưng không render). | Thiếu chi tiết. |
| M07 | MEDIUM | `ParityGatesPanel.tsx:1-204` `window_24h/72h` + trend + history 7 dots | Nằm riêng 1 sectionCard `metricGrid` 2 cols, history là `statusBadge` list, không có line chart. | Khó thấy trend. |
| M08 | MEDIUM | `RetentionHealthPanel.tsx:1-223` `deleted/retained` + `trend` + histogram 7 bars | Histogram là `div flex 34px` bars `7px` width, không có axis, không có tooltip `before`. | Khó đọc. |
| M09 | MEDIUM | `AnomalyGuardPanel.tsx:1-180` `promotion_backlog` + `repair_age` + 2 tables | Mỗi table là `glassPanel` trong `sectionCard`, header `h4` nhỏ, `gap_score` không có color scale. | Thiếu visual priority. |
| M10 | HIGH | `MonitorSection.tsx:635-709` Coverage `datasets x freshness` matrix | 7 cột, không có heatmap (màu theo count), không có row total highlight, `count >0 ? toLocale : "—"` — “—” khó scan. | Khó thấy dataset nào stale. |
| M11 | MEDIUM | `:711-780` Top gaps `symbol/dataset/freshness/next_action` pag 20 | Table 4 cột, `freshness` badge màu `danger/warning` nhưng `next_action` là `t(ACTION_LABEL_KEYS)` dài, không có bulk hydrate CTA. So commercial có checkbox + “Hydrate selected”. | Thiếu action. |
| M12 | LOW | `:782-815` Queue tiers `tier/symbol_count • Cadence` + `examples` | Duplicate Inventory, không có `poll_interval` vs `max_batch_size` như Inventory, chỉ show 5 examples. | Trùng lặp. |
| M13 | LOW | `:346-352` Skeleton `inventorySkeletonGrid 4` | Monitor dùng skeleton của Inventory (4 cards) dù có 7 sections — không khớp. | Loading không chính xác. |
| M14 | LOW | `soc.components.css:438-608` coverageTable etc | `coverageTableWrap` không có `max-height` + sticky, mobile scroll không shadow hint. |  |

---

## B. So sánh chuẩn công nghiệp

| Tiêu chí | Datadog | Grafana | PagerDuty | Monitor hiện tại | Gap |
|---|---|---|---|---|---|
| **Layout** | 2-col: left metrics + right timeline, sticky | Dashboard grid 12col, collapsible rows | Service health + incidents + timeline | 1-col 7 cards | Cần 2-col grouped |
| **Matrix** | Live heatmap + auto-refresh | Table + sparkline | Live | Collapsed | Cần expanded + live |
| **Backlog** | Bar chart + table + total | Bar gauge | Table + trend | Table text | Cần bar |
| **Starvation** | Progress ring + threshold | Stat + threshold | Badge + time | Badge | Cần progress |
| **Coverage** | Heatmap green→red | Heatmap | Matrix | Table text | Cần heatmap |
| **Gaps** | Table + bulk action | Table + pagination | List + action | Table pag | Cần bulk |

---

## C. Gợi ý tái cấu trúc (đã chốt cho plan)

- **Hero 4 cards:** `Backlog total | Fail 1h | Fail 24h | Starved tiers` — như Overview hero, icon + value + trend.
- **Group A — System Live:** `Matrix (expanded, live) + Active runs banner` — 1 sectionCard full width, matrix không collapsed, header có live dot + cycle count.
- **Group B — Backlog & Failures:** `2-col`: left `Fail rates (2 cards + sparkline)` + right `Starvation (progress bars)`, dưới `Backlog by dataset (bar) | Backlog by tier (table + datasets breakdown)`.
- **Group C — Coverage Health:** `Heatmap matrix` (color scale) + `Top gaps` (search + bulk hydrate) + `Queue tiers` (remove duplicate, hoặc keep nhưng dạng compact pills).
- **Group D — Governance:** `Parity + Retention` 2-col, `Anomaly` full width với color scale, `Exports` footer sticky.

Chi tiết trong `IMPLEMENTATION_PLAN_SOC_DATAOPS_MONITOR_RESTRUCTURE_20260916.md`.

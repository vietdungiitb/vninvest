# Kế Hoạch Triển Khai SOC DataOps — Final Consolidated

## Tham chiếu tài liệu

| Tài liệu | Vai trò |
|---|---|
| `docs/GAP_ANALYSIS_DATAOPS_LEGACY_VS_SAAS_NATIVE.md` | Chi tiết từng gap feature |
| `docs/REVIEW_IMPLEMENTATION_PLAN_SOC_DATAOPS_20260625.md` | 10 điểm phản biện gốc |
| `docs/GAP_ANALYSIS_DATAOPS_LEGACY_VS_SAAS_NATIVE.md §10` | 4 điểm phản biện bổ sung + triangulation |
| `docs/IMPLEMENTATION_PLAN_SOC_DATAOPS_SAAS_NATIVE_MIGRATION_20260625.md` | Plan gốc (cần thay thế bởi tài liệu này) |

---

## Phase 1: Parity (P0 + P1)

**Mục tiêu:** Đạt parity tối thiểu 1:1 với legacy DataOpsPanel.
**Thời gian:** ~5-7 ngày.
**Nguyên tắc:** Không enhancement, không premium viz, port đúng những gì legacy có.

### Bước 0: Backend Contract Verification (~0.5 ngày)

**Files:**
- `packages/core/backend/src/service_ops/urls.py`
- `packages/core/backend/src/service_ops/views/*` (các views liên quan DataOps)
- `packages/core/backend/src/service_ops/serializers/*` (serializers)

**URL existence check:**
- [ ] Verify từng endpoint trong Dataset Translation Map (GAP §10.2)
- [ ] Xác nhận matrix cycle endpoints
- [ ] Xác nhận scheduler endpoints

**Payload schema verification (quan trọng — xem phản biện #2):**
- [ ] Đọc View/Serializer cho `POST /operator/soc/dataops/backfill/run-now/`:
  - Input keys: `dataset`, `symbol_group`, `symbols`, `date_from`, `date_to`, `mode`, `dry_run`, `execution_mode`, `reason`
  - Kiểu dữ liệu: string / array / date format
- [ ] Đọc View/Serializer cho `POST /operator/scraping/dataops/planner/preview/` + `run/`:
  - Input keys: `symbols[]`, `datasets[]`, `mode`, `force_refresh`, `execution_mode`, `reason`
  - Response keys: `planned_items[]`, `skipped_items[]`, `total_planned`, `total_skipped`
- [ ] Đọc View cho `POST /operator/scraping/matrix/cycles/start/`:
  - Input: `providers[]`, `symbol_group_ids[]`
  - Response: `cycle_id`, `status`, `providers`, `symbol_groups`

**Backend permission check (phản biện #5):**
- [ ] Verify `POST/PUT/DELETE` endpoints có `permission_classes` tương ứng:
  - `IsOperator` hoặc `IsStaffUser` trên backfill/planner/cycle endpoints
  - `WriteGuard` check trên runtime-config endpoints
- [ ] Nếu thiếu, ghi nhận để báo backend team

**Test thực tế:**
- [ ] Gọi `GET /operator/soc/dataops/inventory/` — ghi nhận response keys
- [ ] Gọi `GET /operator/scraping/dataops/coverage/` — ghi nhận structure
- [ ] Gọi `GET /operator/scraping/dataops/observability/` — ghi nhận structure
- [ ] Gọi `GET /operator/scraping/dataops/queue-tiers/` — ghi nhận structure

**Output:** Dataset Translation Map confirmed + payload schema map + permission coverage report.

### Bước 1: i18n Keys Audit + Vietnamese Terminology (~0.5 ngày)

**Files:** `packages/web/src/i18n/vi.js`, `packages/web/src/i18n/en.js`

**Audit keys hiện có (phản biện #6):**
- [ ] Grep toàn bộ `soc.dataops.` pattern trong `packages/web/src/components/soc/`:
  ```bash
  grep -rh "soc\.dataops\." packages/web/src/components/soc/ | sort -u
  ```
- [ ] Đối chiếu với danh sách keys cần tạo — đảm bảo không sót
- [ ] Ghi nhận keys đã tồn tại trong cả `vi.js` + `en.js`

**Tạo block i18n mới:**
- [ ] Tạo block `soc.dataops.*` keys theo bảng thuật ngữ thống nhất (GAP §10.4)
- [ ] Keys bắt buộc tối thiểu:
  - Labels cho 8 datasets + descriptions
  - Subtab labels (inventory, operations, monitor, scheduler, config)
  - Form labels: backfill mode, execution, dry-run, reason
  - Status labels: run status (queued, running, success, partial, failed, skipped)
  - Freshness states (fresh, warm, stale, missing, error, unknown)
  - Queue tier labels (hot, warm, cold, recovery)
  - Parity, retention, anomaly terminology
  - Matrix status labels

### Bước 2: Inventory Section — 4 gaps (P0) (~1 ngày)

**File:** `SocDataInventorySection.tsx`

| Gap | Mô tả | Priority |
|---|---|---|
| GAP-2.2 | Year distribution: badges → horizontal bar chart | P2 |
| GAP-2.3 | Coverage by group table (6 columns, color coding) | P1 |
| GAP-2.4 | Data types: hardcoded → dynamic từ `inventory.data_types` | P2 |
| GAP-2.6 | Queue tiers accordion | P1 |

**Thứ tự thực hiện:**
1. Data types dynamic (dễ nhất, ít phụ thuộc)
2. Coverage by group table (cần API `inventory.by_group`)
3. Queue tiers accordion (gọi `getSocDataOpsQueueTiers`)
4. Year distribution bar chart (chỉ CSS change)

**CSS:** Thêm vào `soc.module.css`:
- `.coverageTable`, `.coverageCell`, `.coverageFull`, `.coveragePartial`, `.coverageNone`
- `.barChart`, `.barFill`
- `.accordionToggle`, `.accordionContent`
- `.dataTypeGrid`, `.dataTypeCard`, `.dataTypeCardActive`

### Bước 3: Operations Section — 4 gaps (P0 + P1) (~1.5 ngày)

**File:** `SocDataOpsBackfillForm.tsx`

| Gap | Mô tả | Priority |
|---|---|---|
| GAP-3.1 | Dataset checkboxes + descriptions (thay dropdown) | P0 |
| GAP-3.1 | Custom symbols text input | P0 |
| GAP-3.1 | Dry-run checkbox + mode select + execution select | P0 |
| GAP-3.2 | **Planner Console** (textarea + preview + run + results + pagination) | P1 |

**Note:** Run Logs + Purge chuyển từ Config → Ops tab ngay trong Phase 1 (phản biện #1 — tránh redundant work). Thêm section "Lịch sử chạy" ở cuối Operations tab.

**File mới:** `SocDataOpsPlannerConsole.tsx`
- Textarea symbols input
- Dataset checkboxes
- Mode select (missing_only / force_refresh)
- Preview button → `previewSocDataOpsPlanner()`
- Run button (disabled until preview)
- Preview summary cards (planned count, skipped count)
- Planned items table + pagination
- Skipped items table + pagination

**CSS:** Thêm vào `soc.module.css`:
- `.plannerConsole`, `.plannerTextarea`
- `.previewSummary`, `.previewCard`
- `.plannerTable`, `.plannerTableHeader`, `.plannerTableRow`
- `.paginationControls`
- `.backfillCheckbox`, `.backfillCheckboxDisabled`
- `.backfillCustomSymbolsInput`

**DataOpsContext cập nhật:**
- Giữ nguyên state hiện tại (runs, inventory, coverage)
- Thêm action: không cần — Planner Console dùng adapter trực tiếp

### Bước 4: Config Section — 3 gaps (P0) (~0.5 ngày)

**File:** `SocDataOpsConfigSection.tsx`

| Gap | Mô tả | Priority |
|---|---|---|
| GAP-6.2 | Preview modal: change summary + impact warnings + validation errors | P2 |
| GAP-6.3 | WriteGuardBanner (`canApply` check) | P1 |
| GAP-6.5 | OwnershipBadge integration | P3 |

**Thứ tự thực hiện:**
1. OwnershipBadge — đã có `SocOwnershipBadge.tsx`, chỉ cần integrate
2. WriteGuardBanner — đã có `SocWriteGuardBanner.tsx`, chỉ cần integrate
3. Preview modal enhancements — compute warnings từ `buildChangeSummary()` / `buildImpactWarnings()`

**Note:** Run Logs + Purge chuyển hẳn sang Ops tab ở Step 3c. Config section không còn chứa run logs.

### Bước 5: Monitor Section — 5 gaps (P1) (~2 ngày)

**File:** `SocDataOpsMonitorSection.tsx`

| Gap | Mô tả | Priority |
|---|---|---|
| GAP-4.1 | Matrix live snapshot integration + Start/Abort | P1 |
| GAP-4.3 | Parity Gates 24h/72h (strict/relaxed metrics, trend) | P1 |
| GAP-4.4 | Retention Health (deleted rows, histogram, threshold) | P1 |
| GAP-4.5 | Backlog: by_dataset + by_tier tables | P1 |
| GAP-4.7 | Coverage compact table (datasets x freshness) thay JSON dump | P0 |
| GAP-4.8 | Anomaly Guard (critical gap symbols, hot tier breach) | P1 |
| GAP-4.9 | Coverage top gaps paginated list | P1 |

**Lưu ý quan trọng từ reviewer (§10.3):**
- Run Logs + Purge **KHÔNG** đưa vào Monitor tab
- Run Logs sẽ được thêm vào Ops tab ở cuối Step 3

**File mới:** `SocParityGatesPanel.tsx`, `SocRetentionHealthPanel.tsx`, `SocAnomalyGuardPanel.tsx`

**Matrix integration:**
- Matrix state: local trong `SocDataOpsMonitorSection.tsx` (không context) — theo reviewer §10.1
- Chỉ `matrixCycleId` trong context (nếu cần Backfill Center tham chiếu)
- Provider selection: toggle buttons
- Symbol group selection: checkboxes
- Start/Abort cycle buttons
- Nhúng `SocMatrixScrapeMonitor` component đã có sẵn

**⚠️ Xử lý mất state khi tab switch (phản biện #3):**
- Dùng **module-level SimpleCache** (object ngoài React tree) để lưu matrix polling state
- Khi component mount: check cache → nếu có thì dùng, không thì fetch mới
- Khi component unmount: KHÔNG clear cache (chỉ clear polling interval)
- Khi quay lại tab: đọc từ cache → hiển thị ngay, không loading flicker
- Cache không ảnh hưởng DataOpsContext → không gây re-render tree
```typescript
// SimpleCache pattern
const matrixCache: { cycleId?: string; status?: string; providers?: string[]; cells?: unknown } = {};
```

**CSS:** Thêm vào `soc.module.css`:
- `.parityGateCard`, `.parityGatePass`, `.parityGateFail`
- `.trendUp`, `.trendDown`, `.trendFlat`
- `.retentionHistogram`, `.retentionBar`
- `.anomalyPanel`, `.anomalyCriticalRow`, `.anomalyHotRow`
- `.coverageMatrix`, `.coverageCellFresh`, `.coverageCellWarm`, `.coverageCellStale`, `.coverageCellMissing`
- `.gapsTable`, `.gapsPagination`

---

## Phase 1.5: UX Refinements (P2)

**Mục tiêu:** Cải thiện UX dựa trên phản biện, trước khi chuyển sang premium viz.
**Thời gian:** ~1-2 ngày sau Phase 1.

### Bước 5.5: Backfill Form UX Alignment

- [ ] Dataset dropdown → checkbox list (8 datasets với descriptions)
- [ ] Symbol group: thêm "Tuỳ chỉnh" (radio) + custom symbols text input
- [ ] Thêm mode select, execution select, dry-run checkbox
- [ ] Thêm `canApply` write guard check

---

## Phase 2: Premium Visualization (P3)

**Mục tiêu:** Nâng cấp vượt legacy.
**Thời gian:** ~2-3 ngày (có thể推迟).

- Retention histogram (CSS bar chart)
- Parity trend charts với tooltip sequence points
- Airflow-style mini progress bar cho active runs
- Custom Symbol Groups CRUD Manager

---

## Hard Constraints

1. **Tất cả UI component dùng `React.createElement`**, không JSX (pre-commit hook `react/jsx-no-literals`). Với UI phức tạp (bảng, matrix), dùng helper factory functions để giảm verbosity:
   ```typescript
   const div = (props: Record<string, unknown>, ...children: ReactNode[]) => createElement("div", props, ...children);
   const span = (props: Record<string, unknown>, ...children: ReactNode[]) => createElement("span", props, ...children);
   ```
2. **Mọi text mới qua i18n** — tiếng Việt đầy đủ dấu, theo bảng thuật ngữ §10.4
3. **CSS module** (`soc.module.css`) — không inline styles cho layout/theme (chỉ dùng inline cho dynamic values như color)
4. **Matrix state local** — không đưa vào DataOpsContext (chỉ `matrixCycleId` nếu cần share)
5. **Run Logs ở Ops tab** — không Monitor tab
6. **Dataset keys phải verified** với backend trước khi code (Step 0)
7. **Build = `npm run build`** trong `packages/web/`
8. **Rebuild Docker = `.\start_dev.ps1`** (theo AGENTS.md §6.8)
9. **Audit trail**: mọi thay đổi phải ghi vào `docs/CODE_CHANGE_AUDIT_LEDGER.md`

---

## Thứ tự thực hiện chi tiết

```
Step 0: Backend verification (0.5d)
    │
    ▼
Step 1: i18n keys (0.5d)
    │
    ▼
Step 2: Inventory section (1d)
    ├── 2a: Dynamic data types grid
    ├── 2b: Coverage by group table
    ├── 2c: Queue tiers accordion
    └── 2d: Year distribution bar chart
    │
    ▼
Step 3: Operations section (1.5d)
    ├── 3a: Backfill form expansion (checkboxes, custom symbols, dry-run, mode)
    ├── 3b: Planner Console (new component)
    └── 3c: Run Logs integration
    │
    ▼
Step 4: Config section (0.5d)
    ├── 4a: OwnershipBadge integration
    ├── 4b: WriteGuardBanner integration
    └── 4c: Preview modal warnings
    │
    ▼
Step 5: Monitor section (2d)
    ├── 5a: Coverage compact table (thay JSON dump)
    ├── 5b: Matrix live snapshot integration
    ├── 5c: Parity Gates panel (new component)
    ├── 5d: Retention Health panel (new component)
    ├── 5e: Backlog by_dataset + by_tier tables
    ├── 5f: Anomaly Guard panel (new component)
    └── 5g: Coverage top gaps paginated list
    │
    ▼
Step 6: Build + Docker rebuild + smoke test (0.5d)
```

---

## Files chạm

### Modify
- `packages/web/src/components/soc/SocDataInventorySection.tsx`
- `packages/web/src/components/soc/SocDataOpsBackfillForm.tsx`
- `packages/web/src/components/soc/SocDataOpsMonitorSection.tsx`
- `packages/web/src/components/soc/SocDataOpsConfigSection.tsx`
- `packages/web/src/components/soc/DataOpsContext.tsx` (minimal — chỉ thêm matrixCycleId nếu cần)
- `packages/web/src/components/soc/soc.module.css`
- `packages/web/src/i18n/vi.js`
- `packages/web/src/i18n/en.js`

### New
- `packages/web/src/components/soc/SocDataOpsPlannerConsole.tsx`
- `packages/web/src/components/soc/SocParityGatesPanel.tsx`
- `packages/web/src/components/soc/SocRetentionHealthPanel.tsx`
- `packages/web/src/components/soc/SocAnomalyGuardPanel.tsx`

### Reference (read only)
- `frontend/src/components/soc/DataOpsPanel.jsx` (legacy — feature reference)
- `packages/core/backend/src/service_ops/urls.py` (backend contract verification)

---

## Verification

### Mỗi sub-step (2a, 2b, 2c, 3a, 3b...)
- `npx tsc --noEmit` (trong `packages/web/`) — typecheck nhanh, phát hiện lỗi createElement sớm

### Mỗi bước hoàn chỉnh
- `npm run build` (trong `packages/web/`)
- Fix linter errors nếu có

### Cuối Phase 1
- `.\start_dev.ps1` — rebuild Docker stack
- Smoke test: mở SOC → DataOps tab → verify từng subtab không crash
- Ghi vào `docs/CODE_CHANGE_AUDIT_LEDGER.md`

---

## Risk Register

| Risk | Impact | Mitigation |
|---|---|---|
| Backend dataset keys khác với frontend kỳ vọng | 400 errors, crash | Step 0: verify backend trước |
| Matrix polling + context gây re-render | UI lag, mất focus | Matrix state local (§10.1) |
| i18n keys thiếu → fallback raw key | UX xấu | Step 1: tạo đủ keys trước |
| Planner Console preview schema thay đổi | Preview không render | Verify backend contract Step 0 |
| Monitor tab quá nặng load | Timeout, blank screen | Load từng section async (lazy) |

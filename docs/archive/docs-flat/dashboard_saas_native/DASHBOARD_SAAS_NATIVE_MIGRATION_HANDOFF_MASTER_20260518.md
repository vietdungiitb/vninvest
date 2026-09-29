# HANDOFF MASTER — Dashboard SaaS Native Migration

**Ngày**: 2026-05-18  
**Trạng thái**: APPROVED FOR TEAM EXECUTION  
**Phiên bản**: 1.0  
**Phạm vi**: Migrate toàn bộ dashboard từ `frontend/src/pages/modern/ModernDashboard.jsx` (apiClient) sang `packages/web/src/pages/DashboardPage.js` (coreApiAdapter), loại bỏ hoàn toàn legacy code sau parity gate

---

## 1. Bối cảnh và lý do tạo gói tài liệu này

### Tình trạng hiện tại

| Layer | Component | Trạng thái |
|-------|-----------|------------|
| nginx `/api/*` | → core-api:8100 | ✅ Done (B1 complete) |
| core-api `/api/portfolio/...` | `user_workspace` native views | ✅ Done (B4 complete) |
| `packages/web/src/pages/DashboardPage.js` | Skeleton — chỉ list portfolios + watchlists | ❌ Incomplete |
| `coreApiAdapter.js` portfolio analytics methods | Chưa có | ❌ Missing |
| `/dashboard` route | Vẫn trỏ `ModernDashboard.jsx` dùng `apiClient` | ❌ Legacy |
| 5 bugs đã identify | `useAlertCenterFeed`, `UnifiedAlertCenter`, `client.js`, `SmartStatsHeader` | ❌ Pending |

### Vấn đề cốt lõi

`ModernDashboard.jsx` (`frontend/src/`) hiện đang hoạt động NHƯNG vi phạm kiến trúc SaaS vì:
1. Dùng `apiClient` (axios) thay `coreApiAdapter` — không tuân theo `packages/web` data layer
2. Page component sống trong `frontend/src/` thay vì `packages/web/src/` — không thể serve cho SaaS subscribers độc lập với legacy shell
3. Không có slot/render-prop pattern → component coupling với `frontend/src/components/` trực tiếp

### Mục tiêu sau migration

```
Browser → nginx:80 → core-api:8100
  /dashboard → PackageDashboardHost (frontend/src/pages/) → DashboardPage (@vninvest/web)
                  ↳ coreApiAdapter → /core/v1/portfolio/portfolios/{id}/holdings/
                  ↳ coreApiAdapter → /core/v1/portfolio/portfolios/{id}/summary/
                  ↳ coreApiAdapter → /core/v1/portfolio/portfolios/{id}/analytics/
                  ↳ coreApiAdapter → /core/v1/portfolio/portfolios/{id}/technicals/
                  ↳ coreApiAdapter → /api/stock-management/technicals/bulk/
                  ↳ coreApiAdapter → /core/v1/stock-management/tracked-symbols/
                  ↳ coreApiAdapter → /core/v1/portfolio/watchlist/groups/
                  ↳ coreApiAdapter → /core/v1/signals/alert-center/feed
```

**Backend không thay đổi** — tất cả endpoints đã tồn tại native trong core-api.

---

## 2. Phân rã công việc

### Phase 1 — Pre-flight Bug Fixes (Slice DM-00)

| Slice | Mô tả | Priority |
|-------|-------|----------|
| DM-00 | Fix 5 dashboard bugs đã approve (session trước) | P0 CRITICAL |

### Phase 2 — API & Data Layer (Slices DM-01, DM-02)

| Slice | Mô tả | Priority | Estimate |
|-------|-------|----------|---------|
| DM-01 | Add 7 portfolio analytics methods vào `coreApiAdapter.js` | P0 | 2h |
| DM-02 | Create `useCoreDashboardData` hook trong `packages/web` | P0 | 2h |

### Phase 3 — Frontend Page Migration (Slices DM-03, DM-04, DM-05)

| Slice | Mô tả | Priority | Estimate |
|-------|-------|----------|---------|
| DM-03 | Upgrade `DashboardPage.js` thành full-featured (slot injection) | P0 | 4–5h |
| DM-04 | Tạo `PackageDashboardHost.jsx` inject legacy components | P0 | 2h |
| DM-05 | Swap `/dashboard` route + add shadow `/dashboard/legacy` | P0 | 30m |

### Phase 4 — Parity & Decommission (Slices DM-06, DM-07)

| Slice | Mô tả | Gate bắt buộc |
|-------|-------|---------------|
| DM-06 | Parity validation 3 ngày trade | DM-05 PASS + 3 ngày real trade |
| DM-07 | Decommission `ModernDashboard.jsx` | DM-06 PASS ≥ 99% parity |

---

## 3. Dependency graph

```
DM-00
  ↓
DM-01 → DM-02 → DM-03 → DM-04 → DM-05 → DM-06 → DM-07
```

**DM-01 và DM-02 có thể song song** sau DM-00.  
**DM-03 phải chờ DM-01 và DM-02 DONE**.  
**DM-06 gate không được bỏ qua**.

---

## 4. Anchor files

### Frontend (sẽ bị modify/tạo mới)
- `packages/web/src/adapters/coreApiAdapter.js` — thêm 7 methods (DM-01)
- `packages/web/src/features/dashboard/useCoreDashboardData.js` — NEW (DM-02)
- `packages/web/src/pages/DashboardPage.js` — rewrite full-featured (DM-03)
- `frontend/src/pages/PackageDashboardHost.jsx` — NEW (DM-04)
- `frontend/src/App.jsx` — route swap (DM-05)

### Frontend (sẽ bị xóa sau DM-07)
- `frontend/src/pages/modern/ModernDashboard.jsx` — decommission sau parity gate

### Frontend (immutable — chỉ được inject qua props)
- `frontend/src/components/WhaleBubbleChart.jsx`
- `frontend/src/components/modern/ModularPositionDeck.jsx`
- `frontend/src/components/WhaleAnalyticsTab.jsx`

### Backend (không thay đổi)
- `packages/core/backend/src/user_workspace/portfolio_analytics_views.py`
- `packages/core/backend/src/user_workspace/legacy_views.py`
- `packages/core/backend/src/market_data/stock_mgmt_native_views.py`

---

## 5. Hard constraints trong migration này

1. **Không sửa immutable sources** — `WhaleBubbleChart`, `ModularPositionDeck`, `WhaleAnalyticsTab` chỉ được inject qua render props.
2. **Không import `apiClient` trong `packages/web/`** — tất cả data calls phải qua `coreApiAdapter`.
3. **`packages/web` không được import trực tiếp từ `frontend/src/`** — components được truyền vào qua slot props.
4. **DM-06 parity gate không được bỏ qua** — 3 ngày calendar, parity ≥ 99%.
5. **Text mới trong `packages/web/src/`** — hardcode tiếng Việt có dấu (không có i18n context của `frontend/src/`), text trong `frontend/src/PackageDashboardHost.jsx` phải qua `t()`.
6. **`useCoreDashboardData` dùng `AbortController`** cho cleanup khi component unmount.
7. **Không JSX trong `packages/web/src/`** — chỉ `createElement` thuần.

---

## 6. Evidence obligations

Mỗi slice phải có:
1. Danh sách files thay đổi
2. Command validation và output
3. Screenshot/video nếu là UI change
4. API payload snapshot nếu chạm contract
5. Residual risk note nếu còn vấn đề

Template: `docs/DASHBOARD_SAAS_NATIVE_MIGRATION_EXECUTION_EVIDENCE_TEMPLATE_20260518.md`

---

## 7. Governance artifacts (cập nhật sau mỗi slice)

- `docs/CODE_CHANGE_AUDIT_LEDGER.md`
- `PROGRESS_DASHBOARD.md`
- `module_tree_full.md` (regenerate sau DM-02, DM-04, DM-07)

---

## 8. Tài liệu kỹ thuật liên quan

| Tài liệu | Mục đích |
|---------|---------|
| `TECH_SPEC_DASHBOARD_SAAS_NATIVE_MIGRATION_20260518.md` | Contract kỹ thuật chi tiết |
| `IMPLEMENTATION_PLAN_DASHBOARD_SAAS_NATIVE_MIGRATION_20260518.md` | Kế hoạch từng slice |
| `TASKBOARD_DASHBOARD_SAAS_NATIVE_MIGRATION_20260518.md` | Tracking per-task |
| `FRONTEND_DESIGN_DASHBOARD_SAAS_NATIVE_MIGRATION_20260518.md` | Design spec frontend |
| `BACKEND_DESIGN_DASHBOARD_SAAS_NATIVE_MIGRATION_20260518.md` | Inventory endpoints backend |
| `DASHBOARD_SAAS_NATIVE_MIGRATION_TRACEABILITY_MATRIX_20260518.md` | Requirement traceability |
| `DASHBOARD_SAAS_NATIVE_MIGRATION_SELF_AUDIT_AND_TEST_PROTOCOL_20260518.md` | Validation sau mỗi slice |
| `DASHBOARD_SAAS_NATIVE_MIGRATION_CODE_QUALITY_CONSTITUTION_20260518.md` | Hard rules chất lượng code |
| `RUN_CODE_REVIEW_DASHBOARD_SAAS_NATIVE_MIGRATION_20260518.md` | Code review checklist |
| `RUN_INTEGRATION_TESTS_DASHBOARD_SAAS_NATIVE_MIGRATION_20260518.md` | E2E integration tests |
| `RUN_SPEC_AUDIT_DASHBOARD_SAAS_NATIVE_MIGRATION_20260518.md` | Spec audit cross-check |
| `DASHBOARD_SAAS_NATIVE_MIGRATION_EXECUTION_EVIDENCE_TEMPLATE_20260518.md` | Evidence template |

# WhaleAdvisoryPage Port Plan

**Ngày**: 2026-06-21
**Mục tiêu**: Port legacy `frontend/src/pages/WhaleAdvisory.jsx` sang `packages/web` với adapter `advisory.js` đã có sẵn.

---

## Dependency Tree

```
WhaleAdvisoryPage.jsx  (233 lines)
├── WhaleAdvisoryBentoHeader        ─ 87 lines   — header with refresh/shell link
├── WhaleSymbolSidebar              ─ 152 lines  — symbol list with search/pagination
│   └── PaginationBar               ─ shared component
├── WhaleAdvisoryCommandPanel       ─ 229 lines  — main advisory display
│   ├── RecommendationCardExplainability
│   ├── DataFreshnessBadge
│   ├── ActionChecklist
│   └── AgenticThoughtStream
├── FactsFirstWhaleBubbleChart      ─ complex chart component
├── TrustTelemetryPanel             ─ support tab
├── RiskModeSelector                ─ support tab
└── RecommendationHistoryMini       ─ support tab

Hook dependency:
└── useWhaleAdvisoryData            ─ 307 lines
    └── legacy api/client.js imports → migrate to advisory.js adapter
```

---

## Port Strategy

### Phase 1: Core infrastructure (ước tính 4h)
1. **Migrate `useWhaleAdvisoryData` hook** — port to `packages/web/src/hooks/useWhaleAdvisoryData.js`
   - Replace `api/client.js` imports với `defaultCoreApiAdapter.*` (advisory.js + market.js + workspace.js)
   - Keep logic intact (fetchAll, handleRefresh, handleDelete, loadRefreshInfo)
   - Đã có sẵn functions: `getWhaleAdvisories`, `refreshWhaleAdvisory`, `deleteCurrentWhaleAdvisory`, `getAdvisoryAutoRefreshInfo`, `getWhaleAdvisorySymbolStats`

2. **Create advisory components directory** — `packages/web/src/components/advisory/`
   - Port các components phụ thuộc trực tiếp

### Phase 2: Leaf components (ước tính 6h)
3. **Simple port** (ít logic, mostly render):
   - `WhaleAdvisoryBentoHeader` — 87 lines
   - `DataFreshnessBadge` — likely small
   - `ActionChecklist` — likely small
   - `RecommendationHistoryMini` — likely small
   - `RiskModeSelector` — likely small

4. **Medium port** (có logic phức tạp hơn):
   - `WhaleSymbolSidebar` — 152 lines, depends on PaginationBar
   - `TrustTelemetryPanel` — trust metrics display
   - `RecommendationCardExplainability` — explainability display

### Phase 3: Complex components (ước tính 8h)
5. **`WhaleAdvisoryCommandPanel`** — 229 lines
   - Orchestrates multiple sub-components
   - Depends on RecommendationCardExplainability, DataFreshnessBadge, ActionChecklist, AgenticThoughtStream
   - Uses `Can` (authorization) component

6. **`AgenticThoughtStream`** — likely moderate complexity
   - Agent thought process display

7. **`FactsFirstWhaleBubbleChart`** — complex chart component
   - Already has immutable source version in packages/web or can be ported
   - Related to `WhaleBubbleChart` ecosystem (see hard constraint §5)

### Phase 4: Page assembly (ước tính 2h)
8. **Port `WhaleAdvisoryPage.jsx`** — 233 lines
   - Wire all ported components together
   - Replace `useI18n()` with hardcoded Vietnamese (matching packages/web convention)
   - Register in `pageRegistry.js` + `main.js`

---

## Estimated total: ~20 hours

| Phase | Hours | Dependencies |
|-------|-------|-------------|
| Phase 1: Hook + infra | 4 | advisory.js adapter ✅ (exists) |
| Phase 2: Leaf components | 6 | Phase 1 |
| Phase 3: Complex components | 8 | Phase 2 |
| Phase 4: Page assembly | 2 | Phase 3 |
| **Total** | **20** | |

---

## Residual risks

1. **`PaginationBar`** shared component — cần check xem đã có ở packages/web chưa
2. **`FactsFirstWhaleBubbleChart`** — có thể cần port cả `WhaleBubbleChart` ecosystem
3. **Authorization** — `Can` component cần equivalent trong packages/web
4. **i18n keys** — `whaleAdvisory.*`, `whaleChart.*` keys cần hardcode hoặc thêm vào i18n
5. **CSS classes** — `neon-glass-panel`, `card-section`, `panel-scrollbar` cần check Tailwind equivalents

---

## Recommendation

Không port ngay do phụ thuộc dây chuyền. Nên **để WhaleAdvisoryPage ở legacy** cho đến khi:
- Các leaf components được ưu tiên port trước (Phase 2)
- Hook `useWhaleAdvisoryData` được migrate
- Có slice riêng trong task board cho whale advisory port

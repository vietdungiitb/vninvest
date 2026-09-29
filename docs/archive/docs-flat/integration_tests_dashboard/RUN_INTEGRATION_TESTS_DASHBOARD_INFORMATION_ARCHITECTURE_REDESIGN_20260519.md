# RUN INTEGRATION TESTS — Dashboard Information Architecture Redesign

**Ngày**: 2026-05-19  
**Scope**: UI integration + API sanity checks cho redesign dashboard

---

## 1. Setup

```powershell
# 1. Refresh runtime
.\start_dev.ps1

# 2. Frontend build sanity
Push-Location ./frontend
npm run build
Pop-Location
```

---

## 2. Suite A — API sanity (no-contract-change confirmation)

### Goal

Xác nhận redesign không cần backend change và existing dashboard APIs vẫn trả dữ liệu như cũ.

### Checks

1. portfolio summary responds
2. holdings responds
3. analytics responds
4. alert center feed responds
5. tracked symbols / watchlist groups respond

### Expected

- Không có endpoint mới.
- Existing payloads vẫn usable cho layout mới.

---

## 3. Suite B — Desktop IA smoke (1440px)

### Steps

1. Open `/dashboard`.
2. Verify `SmartStatsHeader` appears at top.
3. In `Workstation`, verify top triad order: `UnifiedAlertCenter | Heatmap | AIAdvisorAlertPanel`.
4. Switch to `Classic` and verify `Heatmap` is on row 1 while `UnifiedAlertCenter | AIAdvisorAlertPanel` are on row 2.
5. Verify `FactsFirstModularPositionDeck` is below the whole top area and spans the available width.
6. Hover heatmap tile.
7. Scroll alert lane.
8. Switch AI panel between `AI Alerts` and `AI News`.
9. Open a deck tab other than overview.

### Expected

- `Workstation` shows one equal-width row `Alert | Heatmap | AI`.
- `Classic` shows `Heatmap` above `Alert | AI`.
- No sticky alert strip above triad.
- No standalone sidebar under AI lane.
- No tooltip clipping.

---

## 4. Suite C — Sparse/empty-state behavior

### Steps

1. Use a portfolio or filter state with no holdings in current scope.
2. Confirm deck shows:
   - `Không có mã trong phạm vi đã chọn`
   - helper copy
   - CTA `Mở Transactions`
3. If no alerts available, confirm alert lane quiet state is stable.
4. If no AI digest/news, confirm AI quiet state does not collapse top-row height unexpectedly.

### Expected

- Empty states remain helpful, not broken.

---

## 5. Suite D — Responsive matrix

| Viewport | Checks |
|---|---|
| 1280px Workstation | Triad still 3 columns, no horizontal overflow |
| 1280px Classic | Heatmap row 1, Alert + AI row 2 |
| 1024px Workstation | Alert + heatmap + AI remain in one equal-width triad row |
| 1024px Classic | Heatmap row 1, Alert + AI row 2 |
| 768px Workstation | Workstation compact triad still readable as 3 equal columns |
| 768px Classic | Heatmap row 1, Alert + AI row 2 |
| 390px | Heatmap → Alert → AI → Deck |

### Expected

- Content hierarchy preserved at every viewport.
- No focus trap or unusable internal scroll.

---

## 6. Suite E — Package-host parity

### Preconditions

- Package-host route is enabled or temporary QA route is available.

### Steps

1. Open live route and package-host route side by side.
2. Compare panel order.
3. Compare presence/absence of sticky/sidebar blocks.
4. Compare deck position and width.
5. Compare AI lane availability.

### Expected

- Same IA contract.
- Any remaining differences are cosmetic only.

---

## 7. Pass criteria

- [ ] All API sanity checks PASS
- [ ] Desktop IA smoke PASS
- [ ] Sparse-state behavior PASS
- [ ] Responsive matrix PASS
- [ ] Package-host parity PASS

---

## 8. Suite F — SaaS native architecture compliance

### Goal

Xác nhận team không dùng redesign này để giữ lại dashboard legacy monolith như kiến trúc đích.

### Checks

1. Review canonical route/path documentation.
2. Review package-host route and verify it contains the same IA as live route.
3. Review implementation diff to ensure no new dashboard-only logic was added exclusively to legacy path.
4. If a temporary legacy bridge remains, verify owner + expiry + removal condition are recorded.
5. If backend changed, verify:
   - files are in `packages/core/backend/`
   - routes are `/core/v1/*`
   - OpenAPI metadata/checklist was updated

### Expected

- Legacy monolith is not treated as accepted target architecture.
- SaaS native path is the only accepted destination.

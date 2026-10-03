# SELF AUDIT & TEST PROTOCOL — Dashboard Information Architecture Redesign

**Ngày**: 2026-05-19  
**Scope**: Validation protocol per slice. Chạy ngay sau mỗi slice, không tích lũy.

---

## 1. Validation principles

1. Sau slice UI đầu tiên phải validate ngay bằng check hẹp nhất có thể.
2. `npm run build` là gate bắt buộc trước khi đánh dấu done bất kỳ slice code nào.
3. Với UI/runtime slice, `./start_dev.ps1` phải chạy trước final evidence.
4. Route parity giữa live route và package-host là blocking gate, không phải optional polish.

---

## 2. `DIR-01` — Shared Layout Contract

### Validation commands

```powershell
# 1. Verify AI lane slot exists
Select-String -Path "packages/web/src/pages/DashboardPage.js" -Pattern "renderAiPanel|renderAI|renderInsight" 

# 2. Verify bubble is no longer default top-fold dependency
Select-String -Path "packages/web/src/pages/DashboardPage.js" -Pattern "renderBubble"

# 3. Verify host file aligns slot contract
Select-String -Path "frontend/src/pages/PackageDashboardHost.jsx" -Pattern "renderAiPanel|renderAI|renderInsight"

# 4. Verify layout primitives exist
Select-String -Path "frontend/src/index.css" -Pattern "triad|full-width|dashboard"
```

### Expected

- Dedicated AI lane slot found.
- `renderBubble` absent from top-fold shell logic or clearly marked deprecated.
- Host and package page use same slot semantics.

---

## 3. `DIR-02` — Top Triad

### Validation commands

```powershell
# 1. Verify top-fold no longer renders side rail layout
Select-String -Path "frontend/src/pages/modern/ModernDashboard.jsx" -Pattern "page-body-grid__side"

# 2. Verify required components remain present
Select-String -Path "frontend/src/pages/modern/ModernDashboard.jsx" -Pattern "PortfolioHeatmap|UnifiedAlertCenter|AIAdvisorAlertPanel"

# 3. Frontend build
Push-Location ./frontend
npm run build
Pop-Location
```

### Manual smoke

1. Open `/dashboard` in `Workstation` mode at 1440px and confirm `Alert | Heatmap | AI` is one equal-width row.
2. Switch to `Classic` mode and confirm `Heatmap` occupies row 1 while `Alert | AI` occupies row 2.
3. Hover heatmap tiles and verify tooltip is not clipped.

---

## 4. `DIR-03` — Full-width Deck

### Validation commands

```powershell
Select-String -Path "frontend/src/pages/modern/ModernDashboard.jsx" -Pattern "FactsFirstModularPositionDeck"
```

### Manual smoke

1. Confirm deck appears below the whole triad.
2. Switch scope filter and symbol filter.
3. Verify empty state still shows `Không có mã trong phạm vi đã chọn` and `Mở Transactions` when applicable.
4. Check overview/technical tables are not visually cramped.

---

## 5. `DIR-04` — Remove Low-value Blocks

### Validation commands

```powershell
# StickyAlertBar must disappear from default route
Select-String -Path "frontend/src/pages/modern/ModernDashboard.jsx" -Pattern "StickyAlertBar"

# ModernSidebar must disappear from default route
Select-String -Path "frontend/src/pages/modern/ModernDashboard.jsx" -Pattern "ModernSidebar"

# Header compact metrics presence
Select-String -Path "frontend/src/components/modern/SmartStatsHeader.jsx" -Pattern "alpha|beta|sharpe|drawdown"
```

### Manual smoke

1. Reload `/dashboard`.
2. Verify no sticky alert strip appears above triad.
3. Verify no standalone sidebar panel remains.
4. Verify compact metrics in header do not create excessive height.

---

## 6. `DIR-05` — Package-host Parity

### Validation commands

```powershell
# Check host imports public package page
Select-String -Path "frontend/src/pages/PackageDashboardHost.jsx" -Pattern "@vninvest/web"

# Check AI slot wiring in host and page
Select-String -Path "frontend/src/pages/PackageDashboardHost.jsx" -Pattern "renderAiPanel|renderAI|renderInsight"
Select-String -Path "packages/web/src/pages/DashboardPage.js" -Pattern "renderAiPanel|renderAI|renderInsight"
```

### Manual smoke

1. Enable package-host debug route if needed.
2. Compare live route and host route side by side.
3. Check that order is stats → triad → deck in both surfaces.
4. Check that host route does not show a dead bubble placeholder.

---

## 7. `DIR-06` — Responsive + Accessibility

### Manual smoke matrix

| Viewport | Expected |
|---|---|
| 1440px Workstation | Alert + Heatmap + AI nằm trên 1 hàng 3 cột đều nhau |
| 1440px Classic | Heatmap hàng 1; Alert + AI hàng 2 |
| 1280px Workstation | Triad 3 cột không overflow ngang |
| 1280px Classic | Heatmap full-width hàng trên; Alert + AI hàng dưới, không overflow ngang |
| 1024px Workstation | Alert + Heatmap + AI vẫn nằm 1 hàng 3 cột đều nhau |
| 1024px Classic | Heatmap hàng 1; Alert + AI hàng 2 |
| 768px Workstation | Workstation compact triad vẫn giữ 3 cột rõ hierarchy |
| 768px Classic | Heatmap hàng 1; Alert + AI hàng 2 |
| 390px | Heatmap → Alert → AI → Deck |

### Accessibility checks

1. Tabbing đi qua controls của header, alert lane, heatmap controls, AI panel, deck toolbar.
2. Scroll nội bộ của alert/AI lane không trap bàn phím.
3. Contrast text vs background đọc được trong dark theme hiện tại.

---

## 8. `DIR-07` — Final gates

### Commands

```powershell
Push-Location ./frontend
npm run build
Pop-Location

.\start_dev.ps1
```

### Required evidence

- Desktop screenshot
- Tablet screenshot
- Mobile screenshot
- Residual risk note
- Updated `CODE_CHANGE_AUDIT_LEDGER.md`
- Updated `PROGRESS_DASHBOARD.md`

---

## 9. SaaS native / OpenAPI compliance checks

### Architecture compliance

```powershell
# 1. No new apiClient in package-host/package page path
Select-String -Path "packages/web/src/**/*.js" -Pattern "apiClient"

# 2. No direct fetch in packages/web dashboard path unless already abstracted by adapter
Select-String -Path "packages/web/src/pages/DashboardPage.js" -Pattern "fetch\("

# 3. Host/page must expose AI lane slot
Select-String -Path "frontend/src/pages/PackageDashboardHost.jsx" -Pattern "renderAiPanel|renderAI|renderInsight"
Select-String -Path "packages/web/src/pages/DashboardPage.js" -Pattern "renderAiPanel|renderAI|renderInsight"
```

### Legacy bridge policy

If `ModernDashboard` or legacy `/api` path is still present for parity reasons, evidence must explicitly record:

1. owner,
2. expiry,
3. removal condition.

Missing any of the three means FAIL.

### If backend files are touched

Run extra manual audit:

1. Confirm files are under `packages/core/backend/`, not `backend/`.
2. Confirm route path is `/core/v1/*`.
3. Confirm OpenAPI metadata/checklist updates are attached.
4. Confirm no new compat `/api` business route was introduced.

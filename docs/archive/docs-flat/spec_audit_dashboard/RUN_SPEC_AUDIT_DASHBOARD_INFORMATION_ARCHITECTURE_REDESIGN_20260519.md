# RUN SPEC AUDIT — Dashboard Information Architecture Redesign

**Ngày**: 2026-05-19  
**Mục đích**: Cross-check implementation với `DIR-REQ-01` → `DIR-REQ-24`

**Legend**: `⏳` chưa verify | `✅` PASS | `❌` FAIL | `🔒` blocking gate

---

## `DIR-REQ-01` — Workstation desktop triad 3 cột 🔒

**Expected**: top fold `Workstation` desktop là 3 cột rõ ràng  
**Verify**: 1440px screenshot  
**Status**: ⏳

---

## `DIR-REQ-02` — Mode-specific heatmap placement 🔒

**Expected**: `Workstation` đặt heatmap ở lane giữa; `Classic` đặt heatmap full-width ở hàng 1  
**Verify**: screenshot + DOM/layout inspection  
**Status**: ⏳

---

## `DIR-REQ-03` — Deck full-width second row 🔒

**Expected**: `FactsFirstModularPositionDeck` nằm hàng dưới, span toàn chiều ngang  
**Verify**: screenshot  
**Status**: ⏳

---

## `DIR-REQ-04` — Remove `StickyAlertBar` 🔒

```powershell
Select-String -Path "frontend/src/pages/modern/ModernDashboard.jsx" -Pattern "StickyAlertBar"
```

**Expected**: no active render path  
**Status**: ⏳

---

## `DIR-REQ-05` — Remove `ModernSidebar` 🔒

```powershell
Select-String -Path "frontend/src/pages/modern/ModernDashboard.jsx" -Pattern "ModernSidebar"
```

**Expected**: no active render path  
**Status**: ⏳

---

## `DIR-REQ-06` — Alert lane left

**Expected**: `Workstation` alert lane ở trái heatmap; `Classic` alert lane ở hàng 2  
**Verify**: desktop screenshot  
**Status**: ⏳

---

## `DIR-REQ-07` — AI lane right

**Expected**: `Workstation` AI lane ở phải heatmap; `Classic` AI lane ở hàng 2 cạnh alert lane  
**Verify**: desktop screenshot  
**Status**: ⏳

---

## `DIR-REQ-08` — Compact metrics in header only

**Verify**: header screenshot + code review of `SmartStatsHeader.jsx`  
**Status**: ⏳

---

## `DIR-REQ-09` — No backend endpoint change 🔒

**Verify**: diff review  
**Expected**: no backend feature endpoint changes required  
**Status**: ⏳

---

## `DIR-REQ-10` — No extra fetch fan-out 🔒

**Verify**: network tab comparison baseline vs after  
**Status**: ⏳

---

## `DIR-REQ-11` — AI lane slot in `DashboardPage.js` 🔒

```powershell
Select-String -Path "packages/web/src/pages/DashboardPage.js" -Pattern "renderAiPanel|renderAI|renderInsight"
```

**Status**: ⏳

---

## `DIR-REQ-12` — Bubble no longer default top-fold lane

**Verify**: code review of `DashboardPage.js` / host route  
**Status**: ⏳

---

## `DIR-REQ-13` — Package-host parity 🔒

**Verify**: side-by-side screenshot live vs host  
**Status**: ⏳

---

## `DIR-REQ-14` — Tablet hierarchy

**Expected**: `Workstation` 1024px vẫn là 1 hàng 3 cột đều; `Classic` 1024px vẫn là heatmap hàng 1, alert + AI hàng 2  
**Verify**: 1024px screenshot  
**Status**: ⏳

---

## `DIR-REQ-15` — Mobile order

**Verify**: 390px screenshot  
**Status**: ⏳

---

## `DIR-REQ-16` — Deck empty state preserved

**Verify**: empty-state screenshot  
**Status**: ⏳

---

## `DIR-REQ-17` — Single event truth lane

**Verify**: visual audit; ensure no remaining alert strip/live stream duplicates  
**Status**: ⏳

---

## `DIR-REQ-18` — AI lane not duplicating raw alerts

**Verify**: manual content audit of AI panel  
**Status**: ⏳

---

## `DIR-REQ-19` — Frontend build PASS 🔒

```powershell
Push-Location ./frontend
npm run build
Pop-Location
```

**Status**: ⏳

---

## `DIR-REQ-20` — Runtime refresh PASS 🔒

```powershell
.\start_dev.ps1
```

**Status**: ⏳

---

## `DIR-REQ-21` — Review + spec audit executed

**Verify**: reviewer sign-off + completed checklist  
**Status**: ⏳

---

## `DIR-REQ-22` — Governance files updated

**Verify**: diff in `CODE_CHANGE_AUDIT_LEDGER.md` and `PROGRESS_DASHBOARD.md`  
**Status**: ⏳

---

## `DIR-REQ-23` — No overflow / focus trap / scroll trap

**Verify**: manual smoke on 1280px, 1024px, 390px  
**Status**: ⏳

---

## `DIR-REQ-24` — Heatmap tooltip not clipped

**Verify**: hover test on desktop and tablet  
**Status**: ⏳

---

## `DIR-REQ-25` — SaaS native canonical architecture 🔒

**Expected**: canonical dashboard path is `PackageDashboardHost -> DashboardPage -> coreApiAdapter -> /core/v1/*`  
**Verify**: docs + code review  
**Status**: ⏳

---

## `DIR-REQ-26` — Legacy path transitional only 🔒

**Expected**: any retained `ModernDashboard` / `apiClient` / legacy `/api` path has owner + expiry and is not treated as end-state  
**Verify**: evidence review  
**Status**: ⏳

---

## `DIR-REQ-27` — No legacy-only redesign logic 🔒

**Expected**: no redesign behavior exists only in legacy monolith path  
**Verify**: diff review live route vs host route  
**Status**: ⏳

---

## `DIR-REQ-28` — Backend change only in core-api native path 🔒

**Expected**: if backend touched, files are under `packages/core/backend/` and route is `/core/v1/*`  
**Verify**: diff review  
**Status**: ⏳

---

## `DIR-REQ-29` — OpenAPI metadata and PR gates if contract changes 🔒

**Expected**: any backend/API contract change includes OpenAPI metadata update and passes checklist  
**Verify**: docs review + checklist review  
**Status**: ⏳

---

## `DIR-REQ-30` — Final sign-off blocked if legacy remains canonical 🔒

**Expected**: reviewer/tech lead cannot mark COMPLETE while legacy monolith remains accepted dashboard target  
**Verify**: architecture sign-off section  
**Status**: ⏳

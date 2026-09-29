# RUN CODE REVIEW — Dashboard Information Architecture Redesign

**Ngày**: 2026-05-19  
**Mục đích**: Checklist review để reviewer xác nhận redesign đúng IA, không duplicate signals, và không drift package-host parity.

---

## 1. Review checklist — architecture

| # | Check | Command / Method | Expected |
|---|---|---|---|
| 1 | `ModernDashboard` không còn render `StickyAlertBar` | `Select-String frontend/src/pages/modern/ModernDashboard.jsx -Pattern "StickyAlertBar"` | 0 active render usages |
| 2 | `ModernDashboard` không còn render `ModernSidebar` | `Select-String frontend/src/pages/modern/ModernDashboard.jsx -Pattern "ModernSidebar"` | 0 active render usages |
| 3 | `DashboardPage.js` có AI lane slot | `Select-String packages/web/src/pages/DashboardPage.js -Pattern "renderAiPanel|renderAI|renderInsight"` | >= 1 |
| 4 | `renderBubble` không còn là top-fold requirement | code review | confirmed |
| 5 | Không có backend file thay đổi ngoài tài liệu/validation không liên quan | git diff review | confirmed |

---

## 2. Review checklist — layout hierarchy

| # | Check | Method | Expected |
|---|---|---|---|
| 1 | `Workstation` desktop là 3 cột đều `Alert | Heatmap | AI` | 1440px screenshot | PASS |
| 2 | `Classic` desktop giữ `Heatmap` ở hàng 1 | 1440px screenshot | PASS |
| 3 | `Classic` desktop giữ `Alert | AI` ở hàng 2 | 1440px screenshot | PASS |
| 4 | FactsFirst deck full-width ở hàng dưới | 1440px screenshot | PASS |
| 5 | Header không quá cao sau khi thêm compact metrics | screenshot | PASS |

---

## 3. Review checklist — duplication and content quality

| # | Check | Method | Expected |
|---|---|---|---|
| 1 | Không còn sticky alert strip | visual | PASS |
| 2 | Không còn live signal stream panel riêng | visual | PASS |
| 3 | AI lane không lặp raw alert cards từ alert lane | visual content audit | PASS |
| 4 | Deck empty state vẫn có CTA `Mở Transactions` | empty-state smoke | PASS |

---

## 4. Review checklist — package-host parity

| # | Check | Command / Method | Expected |
|---|---|---|---|
| 1 | Host injects same top triad semantics | host route visual | PASS |
| 2 | No direct import from `frontend/src` into `packages/web` | grep / diff review | PASS |
| 3 | Package-host no dead/blank right lane | host route visual | PASS |

---

## 5. Review checklist — validation gates

| # | Check | Command | Expected |
|---|---|---|---|
| 1 | Frontend build | `Push-Location ./frontend; npm run build; Pop-Location` | exit 0 |
| 2 | Runtime refresh | `./start_dev.ps1` | exit 0 |
| 3 | Governance updated | inspect files | ledger/progress updated |

---

## 6. Reviewer sign-off block

- Reviewer: ____________________
- Date: ____________________
- Result: `PASS / FAIL`
- Notes: ______________________________________________

---

## 7. SaaS native / OpenAPI compliance addendum

| # | Check | Method | Expected |
|---|---|---|---|
| 1 | Dashboard canonical path documented as package-host + packages/web | doc/code review | PASS |
| 2 | `ModernDashboard` not accepted as end-state | evidence + docs review | PASS |
| 3 | Any temporary legacy bridge has owner + expiry | evidence review | PASS |
| 4 | No new dashboard logic only in legacy path | diff review | PASS |
| 5 | If backend touched: only `packages/core/backend/` changed | diff review | PASS |
| 6 | If backend touched: `/core/v1/*` + OpenAPI metadata/checklist updated | diff/docs review | PASS |

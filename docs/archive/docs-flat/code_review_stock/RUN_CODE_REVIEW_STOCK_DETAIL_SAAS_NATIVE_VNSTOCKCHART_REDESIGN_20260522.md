# RUN CODE REVIEW — Stock Detail SaaS Native VNStockChart Redesign

**Ngày**: 2026-05-22  
**Mục đích**: Checklist review để reviewer xác nhận implementation đúng hierarchy đã khóa, không drift selected-session truth, và không phá boundary SaaS-native.

---

## 1. Review checklist — architecture

| # | Check | Command / Method | Expected |
|---|---|---|---|
| 1 | Route vẫn đi qua shell host package | review `ShellStockDetailPage` + shell check | PASS |
| 2 | Không có direct fetch ở stock-detail path | `Select-String packages/web/src/**/*.js -Pattern "fetch\("` | 0 unexpected matches |
| 3 | Không có canonical import/use từ `frontend/src/api/client.js` | grep / diff review | PASS |
| 4 | Không có logic end-state mới trong root legacy `frontend/` / `backend/` | diff review | PASS |
| 5 | Nếu backend touched: chỉ `packages/core/backend/` thay đổi | diff review | PASS |

---

## 2. Review checklist — layout hierarchy

| # | Check | Method | Expected |
|---|---|---|---|
| 1 | Hero chart là block full-width dominant | 1440px screenshot | PASS |
| 2 | Toolbar + meta strip + pane stack + footer actions đúng shell reference | screenshot | PASS |
| 3 | `OrderFlowRadarPanel` nằm ngay dưới chart | screenshot | PASS |
| 4 | Context deck không tranh chart | 1366px/1024px screenshot | PASS |
| 5 | `news`/`financials` không leo lên trên chart/order-flow lane | screenshot | PASS |

---

## 3. Review checklist — selected session truth

| # | Check | Method | Expected |
|---|---|---|---|
| 1 | `selectedSession` owned at page root | code review | PASS |
| 2 | Order flow lane sync theo session click | browser smoke | PASS |
| 3 | Advisory / alert summary sync theo session click | browser smoke | PASS |
| 4 | Không có second truth trong child components | code review | PASS |

---

## 4. Review checklist — adapter and backend discipline

| # | Check | Method | Expected |
|---|---|---|---|
| 1 | Adapter có wrappers bắt buộc cho tracked/watchlist/alerts/news/financials | review `coreApiAdapter.js` | PASS |
| 2 | Adapter tests được cập nhật | `npm test -- --runTestsByPath src/adapters/coreApiAdapter.test.js --watch=false` | PASS |
| 3 | Nếu backend touched: route/native tests pass | manage.py test | PASS |
| 4 | Nếu backend touched: no new compat `/api/*` route | diff review | PASS |

---

## 5. Review checklist — degraded states and honesty

| # | Check | Method | Expected |
|---|---|---|---|
| 1 | `news`/`financials` unavailable state trung thực | UI review | PASS |
| 2 | stale/loading/error states rõ ở modules phụ | UI review | PASS |
| 3 | not-found symbol có state riêng | `/stocks/INVALID` smoke | PASS |

---

## 6. Review checklist — validation gates

| # | Check | Command | Expected |
|---|---|---|---|
| 1 | Package shell check | `Push-Location ./packages/web; npm run check:stock-detail-shell; Pop-Location` | exit 0 |
| 2 | Package build | `Push-Location ./packages/web; npm run build-community; Pop-Location` | exit 0 |
| 3 | Consumer frontend build | `Push-Location ./frontend; npm run build; Pop-Location` | exit 0 |
| 4 | Runtime refresh | `./start_dev.ps1` | exit 0 |
| 5 | Governance updated | inspect files | PASS |

---

## 7. Reviewer sign-off block

- Reviewer: ____________________
- Date: ____________________
- Result: `PASS / FAIL`
- Notes: ______________________________________________

---

## 8. Reject conditions

1. Chart shell nhìn đúng nhưng order flow không ở dưới chart.
2. Selected session không sync tới advisory/order flow.
3. Adapter thiếu wrapper và page quay lại direct fetch.
4. Backend touched nhưng không có OpenAPI/test evidence.
5. Degraded state không trung thực với backend stubs.

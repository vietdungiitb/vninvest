# TASKBOARD — Stock Detail SaaS Native VNStockChart Redesign

**Ngày**: 2026-05-22  
**Legend**: `[ ]` Not started | `[~]` In progress | `[x]` Done | `[!]` Blocked

---

## Slice `SD-00` — Doc Pack Baseline

- [x] `SD-00.1` Tạo đầy đủ handoff master, implementation plan, tech spec, taskboard, traceability, self-audit, evidence template  
  Owner: Planner / Tech Lead  
  Estimate: 2h  
  DoD:
  - 14 tài liệu handoff tồn tại với naming thống nhất
  - frontend/backend design docs tồn tại như artifacts riêng
  - scope, hard rules, runbooks, governance gates đã khóa

- [x] `SD-00.2` Khóa hình thái giao diện theo ảnh VNStockChart và boundary SaaS-native  
  Owner: Product + Frontend Lead + Tech Lead  
  Estimate: 30m  
  DoD:
  - chart-first workstation được chốt
  - order flow dưới chart được chốt
  - canonical architecture được chốt: `packages/web` + `packages/core`

---

## Slice `SD-01` — VNStockChart Workspace Contract & Page Architecture

- [ ] `SD-01.1` Tạo `useStockDetailPageModel` làm page-level SSOT  
  Owner: Frontend Platform  
  Estimate: 2h  
  Req: `SDR-REQ-01`, `SDR-REQ-04`, `SDR-REQ-27`  
  DoD:
  - symbol/session/visible-range/loading lanes nằm trong một model thống nhất
  - `ShellStockDetailPage` chỉ còn routing concerns

- [ ] `SD-01.2` Khóa chart workspace model: toolbar, meta strip, pane topology, visible-range hooks  
  Owner: Frontend Platform  
  Estimate: 2h  
  Req: `SDR-REQ-03`, `SDR-REQ-05`, `SDR-REQ-06`, `SDR-REQ-07`, `SDR-REQ-08`  
  DoD:
  - toolbar/meta strip/footer contract rõ
  - viewport hooks cho shark markers tồn tại

- [ ] `SD-01.3` Giữ canonical route `/stocks/:symbol` đi qua shell host package  
  Owner: Frontend Platform  
  Estimate: 45m  
  Req: `SDR-REQ-01`, `SDR-REQ-20`, `SDR-REQ-26`  
  DoD:
  - shell wiring pass qua `npm run check:stock-detail-shell`

---

## Slice `SD-02` — Hero Workspace Frontend Redesign

- [ ] `SD-02.1` Tạo header bar + quote card + chart toolbar  
  Owner: Frontend Product UI  
  Estimate: 1.5h  
  Req: `SDR-REQ-02`, `SDR-REQ-03`, `SDR-REQ-19`  
  DoD:
  - header mỏng, chart shell scan nhanh được
  - không biến page thành dashboard nhiều card ngang hàng

- [ ] `SD-02.2` Tạo meta strip + session witness strip + range/action footer  
  Owner: Frontend Product UI  
  Estimate: 1.5h  
  Req: `SDR-REQ-03`, `SDR-REQ-04`, `SDR-REQ-19`, `SDR-REQ-28`  
  DoD:
  - user luôn biết phiên đang chọn và data có stale hay không

- [ ] `SD-02.3` Khóa proportion chart workspace giống ảnh tham chiếu nhưng đúng semantics VNInvest  
  Owner: Frontend Product UI  
  Estimate: 1h  
  Req: `SDR-REQ-02`, `SDR-REQ-05`, `SDR-REQ-06`  
  DoD:
  - price pane dominant
  - volume/CVD/strength không lấn chart

---

## Slice `SD-03` — Order Flow Lane & Contextual Modules

- [ ] `SD-03.1` Đặt `OrderFlowRadarPanel` full-width ngay dưới chart  
  Owner: Frontend Product UI  
  Estimate: 45m  
  Req: `SDR-REQ-09`, `SDR-REQ-27`  
  DoD:
  - order flow lane đứng ngay dưới hero chart trên desktop và laptop

- [ ] `SD-03.2` Tạo contextual modules cho intraday matched + depth/liquidity + user state  
  Owner: Frontend Dev  
  Estimate: 2h  
  Req: `SDR-REQ-10`, `SDR-REQ-28`  
  DoD:
  - modules phụ không tranh chiều ngang với chart
  - không có fixed right rail mặc định ở 1366px

- [ ] `SD-03.3` Bảo toàn selected-session sync giữa chart và flow lane  
  Owner: Frontend Dev  
  Estimate: 1h  
  Req: `SDR-REQ-04`, `SDR-REQ-27`  
  DoD:
  - đổi session trên chart thì flow lane đổi theo ngay

---

## Slice `SD-04` — Insight Deck Native

- [ ] `SD-04.1` Tạo alert/advisory summary modules dưới order flow lane  
  Owner: Frontend Dev  
  Estimate: 1.5h  
  Req: `SDR-REQ-14`, `SDR-REQ-27`, `SDR-REQ-28`  
  DoD:
  - deck bám selected session truth hoặc symbol truth đúng nghĩa

- [ ] `SD-04.2` Tạo `news`/`financials` modules với degraded-state rõ ràng  
  Owner: Frontend Dev  
  Estimate: 1h  
  Req: `SDR-REQ-14`, `SDR-REQ-29`  
  DoD:
  - nếu backend chưa có truth thì UI nói rõ unavailable/stub

- [ ] `SD-04.3` Đảm bảo mỗi module có loading/empty/stale/error state riêng  
  Owner: Frontend Dev  
  Estimate: 45m  
  Req: `SDR-REQ-28`  
  DoD:
  - không có page-level crash vì một module lỗi

---

## Slice `SD-05` — Adapter Completion

- [ ] `SD-05.1` Hoàn thiện wrapper tracked/watchlist/price-alert actions  
  Owner: Frontend Platform  
  Estimate: 1h  
  Req: `SDR-REQ-11`, `SDR-REQ-15`  
  DoD:
  - page mới không cần gọi `frontend/src/api/client.js`

- [ ] `SD-05.2` Hoàn thiện wrapper `getStockNews` / `getStockFinancials`  
  Owner: Frontend Platform  
  Estimate: 45m  
  Req: `SDR-REQ-15`, `SDR-REQ-29`  
  DoD:
  - wrappers có validation và error propagation rõ ràng

- [ ] `SD-05.3` Bổ sung/khóa adapter tests  
  Owner: Frontend Platform  
  Estimate: 45m  
  Req: `SDR-REQ-11`, `SDR-REQ-12`, `SDR-REQ-15`, `SDR-REQ-21`  
  DoD:
  - package test focused pass

---

## Slice `SD-06` — Core Contract Completion

- [ ] `SD-06.1` Xác nhận backend không cần đổi nếu native truth đã đủ  
  Owner: Backend Lead  
  Estimate: 30m  
  Req: `SDR-REQ-16`, `SDR-REQ-18`  
  DoD:
  - inventory quyết định backend no-change hoặc change-minimal được ghi rõ

- [ ] `SD-06.2` Nếu cần, hoàn thiện endpoint blocker thật sự trong `packages/core/backend`  
  Owner: Backend Market Data / Market Serving  
  Estimate: 2h  
  Req: `SDR-REQ-16`, `SDR-REQ-17`, `SDR-REQ-18`, `SDR-REQ-22`  
  DoD:
  - không có legacy route mới
  - tests route/native pass

- [ ] `SD-06.3` Nếu backend touched, cập nhật OpenAPI metadata + route tests + native tests  
  Owner: Backend Lead + QA  
  Estimate: 1h  
  Req: `SDR-REQ-17`, `SDR-REQ-22`  
  DoD:
  - `tests.test_stock_management_api_routes` và `market_data.tests.test_stock_management_native_api` xanh

---

## Slice `SD-07` — Validation, Evidence, Final Gates

- [ ] `SD-07.1` Package-local shell/build/test gates  
  Owner: Frontend Platform  
  Estimate: 45m  
  Req: `SDR-REQ-20`, `SDR-REQ-21`  
  DoD:
  - `check:stock-detail-shell`, `build-community`, adapter tests pass

- [ ] `SD-07.2` Consumer frontend build + browser smoke  
  Owner: Frontend QA  
  Estimate: 45m  
  Req: `SDR-REQ-21`, `SDR-REQ-23`, `SDR-REQ-30`  
  DoD:
  - `/stocks/FPT`, `/stocks/HPG`, `/stocks/VCB`, `/stocks/INVALID` pass smoke

- [ ] `SD-07.3` Runtime refresh via `./start_dev.ps1`  
  Owner: Runtime operator  
  Estimate: 20m  
  Req: `SDR-REQ-23`  
  DoD:
  - refreshed stack ready for auditor

- [ ] `SD-07.4` Governance updates and evidence sync  
  Owner: Implementer  
  Estimate: 20m  
  Req: `SDR-REQ-24`, `SDR-REQ-25`  
  DoD:
  - `CODE_CHANGE_AUDIT_LEDGER.md`, `PROGRESS_DASHBOARD.md`, modified-files audit, module tree updated

---

## Block merge conditions

1. Chart shell không bám hierarchy đã khóa.
2. `OrderFlowRadarPanel` không ở ngay dưới chart.
3. Có direct fetch hoặc canonical path quay lại legacy client.
4. `news`/`financials` bị dựng giả ở client.
5. Runtime mới nằm ngoài `packages/web` + `packages/core`.
6. Thiếu evidence hoặc governance updates.

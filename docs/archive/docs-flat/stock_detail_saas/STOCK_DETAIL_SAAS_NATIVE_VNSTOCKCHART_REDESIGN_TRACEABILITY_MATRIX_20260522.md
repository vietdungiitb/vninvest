# TRACEABILITY MATRIX — Stock Detail SaaS Native VNStockChart Redesign

**Ngày**: 2026-05-22  
**Scope**: 7 slices, 30 requirements

---

## 1. Requirements

| ID | Requirement | Priority | Slice |
|---|---|---|---|
| `SDR-REQ-01` | Route canonical là `/stocks/:symbol` qua `ShellStockDetailPage` trong `packages/web` | P0 | `SD-01` |
| `SDR-REQ-02` | Hero chart workspace full-width là bề mặt số 1 | P0 | `SD-02` |
| `SDR-REQ-03` | Chart shell phải theo topology ảnh VNStockChart reference | P0 | `SD-01`, `SD-02` |
| `SDR-REQ-04` | `selectedSession` là SSOT ở page root | P0 | `SD-01`, `SD-03`, `SD-04` |
| `SDR-REQ-05` | `CVD` nằm ở pane riêng | P0 | `SD-01`, `SD-02` |
| `SDR-REQ-06` | `Strength` nằm ở pane riêng | P0 | `SD-01`, `SD-02` |
| `SDR-REQ-07` | Shark markers chỉ tính theo top 10% viewport hiện tại | P0 | `SD-01` |
| `SDR-REQ-08` | Heatmap phase này chỉ theo `time bucket` | P0 | `SD-01` |
| `SDR-REQ-09` | `OrderFlowRadarPanel` phải ở ngay dưới chart | P0 | `SD-03` |
| `SDR-REQ-10` | Context modules không được cạnh tranh chiều ngang với chart ở desktop/laptop mặc định | P1 | `SD-03` |
| `SDR-REQ-11` | User actions/read paths ở web đi qua `coreApiAdapter` | P0 | `SD-05` |
| `SDR-REQ-12` | Không có direct fetch hay canonical fallback về `frontend/src/api/client.js` | P0 | `SD-05`, `SD-07` |
| `SDR-REQ-13` | Không có logic end-state mới trong `frontend/` hoặc `backend/` legacy | P0 | `SD-01`, `SD-05`, `SD-06`, `SD-07` |
| `SDR-REQ-14` | `news`/`financials` chỉ render nếu có native truth hoặc degraded state rõ | P0 | `SD-04` |
| `SDR-REQ-15` | Adapter wrappers cho tracked/watchlist/alerts/news/financials đầy đủ | P0 | `SD-05` |
| `SDR-REQ-16` | Nếu backend đổi thì chỉ đổi trong `packages/core/backend/` | P0 | `SD-06`, `SD-07` |
| `SDR-REQ-17` | Nếu backend đổi thì phải có OpenAPI metadata + test updates | P0 | `SD-06`, `SD-07` |
| `SDR-REQ-18` | Không tạo compat `/api` business route hay legacy shortcut mới | P0 | `SD-06`, `SD-07` |
| `SDR-REQ-19` | Text UI mới phải qua i18n tiếng Việt đầy đủ dấu | P0 | `SD-02`, `SD-04` |
| `SDR-REQ-20` | `npm run check:stock-detail-shell` phải pass | P0 | `SD-01`, `SD-07` |
| `SDR-REQ-21` | Package build/test + root frontend build phải pass | P0 | `SD-05`, `SD-07` |
| `SDR-REQ-22` | Focused backend route/native suites phải pass nếu backend touched | P0 | `SD-06`, `SD-07` |
| `SDR-REQ-23` | `./start_dev.ps1` + browser smoke phải pass trước final evidence | P0 | `SD-07` |
| `SDR-REQ-24` | `CODE_CHANGE_AUDIT_LEDGER.md` và `PROGRESS_DASHBOARD.md` phải cập nhật | P0 | `SD-07` |
| `SDR-REQ-25` | `module_tree_full.md` phải regenerate | P0 | `SD-07` |
| `SDR-REQ-26` | Host bridge/package shell không được drift kiến trúc canonical | P0 | `SD-01`, `SD-07` |
| `SDR-REQ-27` | Đổi selected session phải đồng bộ order flow/advisory/alert summary | P0 | `SD-01`, `SD-03`, `SD-04` |
| `SDR-REQ-28` | Mỗi module phải có loading/empty/stale/error state riêng | P1 | `SD-02`, `SD-03`, `SD-04` |
| `SDR-REQ-29` | Không synthesize fake news/fundamentals/business truth ở client | P0 | `SD-04`, `SD-05` |
| `SDR-REQ-30` | Final sign-off bị block nếu drift layout hierarchy hoặc drift canonical architecture | P0 | `SD-07` |

---

## 2. Requirement → Task mapping

| Requirement | Task IDs | Verification method |
|---|---|---|
| `SDR-REQ-01` | `SD-01.1`, `SD-01.3` | shell check + code review |
| `SDR-REQ-02` | `SD-02.1`, `SD-02.3` | desktop screenshot |
| `SDR-REQ-03` | `SD-01.2`, `SD-02.1`, `SD-02.2` | UI review vs reference shell |
| `SDR-REQ-04` | `SD-01.1`, `SD-03.3`, `SD-04.1` | state flow audit + session smoke |
| `SDR-REQ-05` | `SD-01.2`, `SD-02.3` | chart pane screenshot |
| `SDR-REQ-06` | `SD-01.2`, `SD-02.3` | chart pane screenshot |
| `SDR-REQ-07` | `SD-01.2` | zoom/pan smoke |
| `SDR-REQ-08` | `SD-01.2` | code review + payload check |
| `SDR-REQ-09` | `SD-03.1` | layout screenshot |
| `SDR-REQ-10` | `SD-03.2` | 1366px/1024px screenshot |
| `SDR-REQ-11` | `SD-05.1`, `SD-05.2` | adapter test + grep |
| `SDR-REQ-12` | `SD-05.1`, `SD-07.1` | grep no direct fetch / no legacy client |
| `SDR-REQ-13` | `SD-01.3`, `SD-05.1`, `SD-06.2`, `SD-07.4` | diff review |
| `SDR-REQ-14` | `SD-04.1`, `SD-04.2` | degraded-state smoke |
| `SDR-REQ-15` | `SD-05.1`, `SD-05.2`, `SD-05.3` | adapter unit tests |
| `SDR-REQ-16` | `SD-06.1`, `SD-06.2` | diff review backend paths |
| `SDR-REQ-17` | `SD-06.2`, `SD-06.3` | docs + tests review |
| `SDR-REQ-18` | `SD-06.2`, `SD-07.4` | diff review no new compat routes |
| `SDR-REQ-19` | `SD-02.1`, `SD-04.1` | i18n review |
| `SDR-REQ-20` | `SD-01.3`, `SD-07.1` | `npm run check:stock-detail-shell` |
| `SDR-REQ-21` | `SD-05.3`, `SD-07.1`, `SD-07.2` | package tests + builds |
| `SDR-REQ-22` | `SD-06.3`, `SD-07.2` | backend focused suites |
| `SDR-REQ-23` | `SD-07.2`, `SD-07.3` | runtime smoke |
| `SDR-REQ-24` | `SD-07.4` | file diff |
| `SDR-REQ-25` | `SD-07.4` | regenerated file present |
| `SDR-REQ-26` | `SD-01.3`, `SD-07.4` | shell/host architecture review |
| `SDR-REQ-27` | `SD-01.1`, `SD-03.3`, `SD-04.1` | session change smoke |
| `SDR-REQ-28` | `SD-02.2`, `SD-03.2`, `SD-04.3` | module state matrix audit |
| `SDR-REQ-29` | `SD-04.2`, `SD-05.2` | UI + adapter review |
| `SDR-REQ-30` | `SD-07.2`, `SD-07.4` | final architecture + layout audit |

---

## 3. Slice → Files mapping

| Slice | Files expected to change |
|---|---|
| `SD-01` | `packages/web/src/pages/StockDetailPage.js`, `packages/web/src/pages/market/ShellStockDetailPage.js`, `packages/web/src/features/stock-detail/**/*` |
| `SD-02` | `packages/web/src/pages/StockDetailPage.js`, feature components/CSS for header/toolbar/meta strip/footer |
| `SD-03` | feature components for order flow lane, intraday matched, depth/liquidity, user state |
| `SD-04` | feature components for advisory/alert/news/fundamentals deck |
| `SD-05` | `packages/web/src/adapters/coreApiAdapter.js`, `packages/web/src/adapters/coreApiAdapter.test.js` |
| `SD-06` | `packages/core/backend/src/market_data/stock_mgmt_native_views.py`, `core_urls.py`, `native_views.py`, corresponding tests |
| `SD-07` | `CODE_CHANGE_AUDIT_LEDGER.md`, `PROGRESS_DASHBOARD.md`, `MODIFIED_FILES_AUDIT_T12_PHASE_4_20250501.md`, `module_tree_full.md` |

---

## 4. Residual-risk registry

| Risk ID | Risk | Probability | Impact | Mitigation |
|---|---|---|---|---|
| `SDR-R-01` | Đội code dựng UI giống ảnh nhưng sai semantics pane | M | H | Frontend design + tech spec lock pane meanings |
| `SDR-R-02` | Order flow bị đẩy sang cạnh phải vì “tiện layout” | H | H | Hard rule + review gate |
| `SDR-R-03` | Selected session bị duplicate giữa chart và advisory | H | H | Page-level SSOT + smoke tests |
| `SDR-R-04` | News/financials bị fabricate ở client | M | H | Degraded-state rule + backend design doc |
| `SDR-R-05` | Canonical architecture drift về legacy path | H | H | Shell check + architecture review gate |

# Realtime Freshness Contract Implementation Plan (2026-04-17)

## 1. Business objective

Van de can giai quyet:
- Module Khop lenh trong phien dang fallback cache khi upstream gap su co tam thoi, nhung hien tai co nguy co dung cache qua cu va hien thi nhu du lieu moi.
- Root cause da xac nhan: stale payload dang co the bi ghi de fetched_at bang thoi diem response, lam user va he thong observability hieu sai tuoi du lieu.

KPI/ket qua ky vong:
- 100% response intraday co freshness contract day du: source_event_at, fetched_at, served_at, age_seconds.
- Trong gio giao dich: khong serve stale payload qua nguong freshness (15s cho ma thuong, 10s cho VN30).
- Frontend tu dong retry 3s khi stale qua nguong, khong hien thi trang thai nhu du lieu realtime.
- Giam ty le stale over-threshold duoc hien thi xuong <= 1% tong response intraday trong gio giao dich.

## 2. Scope and non-scope

In-scope:
- Chuan hoa contract freshness cho endpoint intraday matched.
- Rang buoc stale threshold theo nhom symbol (VN30 vs non-VN30).
- Dam bao source_event_at dong bo voi trade_time/ts goc cua IntradayTick.
- Cap nhat fallback logic trong dashboardRealtimeViewModel de phan biet ro stale vs no data o pre-open/offhours.
- Cap nhat RealtimeQuoteTable de ho tro hien thi age_seconds trong COLUMN_PRESETS.
- Cap nhat useRealtimeFeedLegacy retry 3s cho stale over-threshold.
- Bo sung tests: unit/integration/e2e + cap nhat case whale aggregate mixed unit.

Out-of-scope:
- Khong thay doi chinh sach gia don vi canonical ngoai pham vi lien quan freshness.
- Khong mo rong them endpoint moi cho intraday matched.
- Khong doi scheduler tong the cua toan bo realtime stack ngoai co che refresh can thiet cho contract nay.

## 3. Current-state assessment

Hien trang lien quan:
- Backend intraday fallback co stale payload va rate-limit fallback, nhung contract timestamp chua nhat quan cho viec tinh freshness.
- Frontend Khop lenh hien thong diep stale cache nhung chua chan stale qua nguong theo SLO.
- dashboardRealtimeViewModel can phan biet ro tinh huong pre-open/offhours de tranh bao stale gia.
- RealtimeQuoteTable chua uu tien hien thi tuoi du lieu trong preset cot.

Constraint ky thuat:
- Can backward-compatible voi payload cu de tranh vo cac panel dang dung contract hien tai.
- Can duy tri retry de uu tien realtime nhung khong gay spam API khi upstream dang rate-limited.

## 4. Target design

Kien truc dich (freshness contract):
- source_event_at: thoi diem goc cua event giao dich (uu tien tu trade_time/trade_datetime tu stream/DB).
- fetched_at: thoi diem backend lay du lieu tu nguon goc hoac fallback snapshot goc (khong ghi de bang now cho stale).
- served_at: thoi diem API tra response.
- age_seconds: do lech giua served_at va source_event_at.

Nguyen tac stale gating:
- Neu symbol thuoc VN30: stale_max_seconds = 10.
- Neu symbol khong thuoc VN30: stale_max_seconds = 15.
- Neu payload stale va age_seconds > stale_max_seconds:
  - Backend danh dau stale_over_threshold = true.
  - Frontend khong coi la du lieu realtime hop le, hien trang thai dang dong bo va retry sau 3s.

Dong bo timestamp IntradayTick:
- source_event_at phai map nhat quan voi trade_time/trade_datetime cua IntradayTick (theo timezone thi truong).
- stream_consumers xac thuc timestamp truoc khi persist de tranh mâu thuan voi ledger cu.

## 5. Execution phases

Phase 0 - Prep + feature flags
- Them config:
  - INTRADAY_STALE_MAX_SECONDS_DEFAULT = 15
  - INTRADAY_STALE_MAX_SECONDS_VN30 = 10
  - INTRADAY_STALE_RETRY_SECONDS_FRONTEND = 3
- Bo sung guardrail cho fallback stale over-threshold.
- Rollback phase 0:
  - Dat VN30 threshold = default threshold qua env de tat branch logic theo nhom.

Phase 1 - Backend freshness contract hardening
- File chinh:
  - backend/portfolio/market_data_service.py
  - backend/portfolio/realtime/stream_consumers.py
- Cong viec:
  - Khong ghi de fetched_at trong stale payload.
  - Bo sung source_event_at, served_at, age_seconds cho payload intraday.
  - Them stale_over_threshold, stale_threshold_seconds.
  - Dam bao source_event_at dong bo voi trade_time/trade_datetime.
- Rollback phase 1:
  - Feature flag de fallback ve contract cu (giu them field moi nhung khong enforce stale gate).

Phase 2 - Frontend consume + auto refresh
- File chinh:
  - frontend/src/utils/dashboardRealtimeViewModel.js
  - frontend/src/hooks/useRealtimeFeedLegacy.js
  - frontend/src/components/RealtimeQuoteTable/RealtimeQuoteTable.jsx
  - frontend/src/pages/StockDetail.jsx
- Cong viec:
  - dashboardRealtimeViewModel: tach nhom trang thai pre-open/offhours/no data/stale.
  - useRealtimeFeedLegacy: retry 3s khi stale_over_threshold = true.
  - RealtimeQuoteTable: them age_seconds vao COLUMN_PRESETS va format hien thi ro rang.
  - StockDetail intraday panel: uu tien realtime, neu stale qua nguong thi chuyen trang thai dang dong bo.
- Rollback phase 2:
  - Tat stale-over-threshold UI gating qua config va quay lai che do stale warning hien tai.

Phase 3 - Tests + observability + handoff
- Bo sung test matrix day du (muc 8).
- Bo sung metrics dashboard (muc 9).
- Chot tai lieu va update audit ledger.
- Rollback phase 3:
  - Giu metrics read-only, khong chan luong nghiep vu.

## 6. API and data contract changes

Endpoint cap nhat:
- GET /api/realtime/intraday/<symbol>/?page_size=<n>

Response contract muc tieu:
- symbol: string
- trades: array
- total: number
- source: string
- stale: boolean
- stale_over_threshold: boolean
- stale_threshold_seconds: number
- source_event_at: ISO8601 string | null
- fetched_at: ISO8601 string | null
- served_at: ISO8601 string
- age_seconds: number | null
- fallback_reason: string | null
- rate_limited: boolean (neu co)

Backward compatibility:
- Giu nguyen cac field cu dang duoc frontend su dung.
- Field moi la additive; frontend cu van chay duoc.

## 7. Scheduling and operations

Auto refresh/retry:
- Frontend retry 3s khi stale_over_threshold = true.
- Polling nen giu 30s, uu tien trigger bo sung theo volume/tick.

Guardrail runtime:
- Neu rate-limited: cho phep stale trong nguong, nhung danh dau ro source + rate_limited.
- Neu stale qua nguong lien tuc > 3 lan: phat canh bao observability.

Lock/retry/timeout:
- Tuan thu lock/rate-limit hien co cua backend realtime.
- Khong tang tan suat fetch mac dinh cho du lieu binh thuong.

## 8. Testing and verification

### Test matrix

1) Unit tests backend
- market_data_service:
  - stale payload khong ghi de fetched_at.
  - age_seconds tinh dung theo source_event_at.
  - stale threshold 10s cho VN30, 15s cho ma thuong.
  - stale_over_threshold true khi vuot nguong.
- stream_consumers:
  - source_event_at mapping dung voi trade_time/trade_datetime.
  - reject/sanitize timestamp bat thuong.

2) Integration/API tests
- test_api_routes_stock_workspace_realtime_bulk.py:
  - Cap nhat va bo sung case:
    - test_whale_feed_aggregate_handles_mixed_intraday_price_units_without_1000x
      + verify khong regression khi co field freshness moi.
  - Them case intraday stale over-threshold -> contract response dung.

3) Frontend tests
- dashboardRealtimeViewModel:
  - pre-open/offhours no data khong bi gan stale sai.
- useRealtimeFeedLegacy:
  - stale over-threshold => retry 3s.
- RealtimeQuoteTable:
  - COLUMN_PRESETS co age_seconds, format hien thi dung.

4) E2E tests
- Scenario bat buoc: stale qua nguong -> trang thai dong bo realtime.
  - Input: mock response stale_over_threshold=true.
  - Expected:
    - Hien state dong bo (khong coi la cap nhat moi).
    - Tu dong retry 3s.
    - Khi nhan payload fresh, UI quay lai state realtime binh thuong.

### Exit criteria
- Toan bo test moi pass.
- Khong co regression cho whale aggregate mixed-unit test.
- Manual smoke tren MWG/FPT/MBB + 1 ma VN30 (vi du: VCB) pass theo checklist.

## 9. Observability and alerting

Metrics can bo sung:
- intraday_freshness_age_seconds (histogram)
- intraday_stale_served_total (counter)
- intraday_stale_over_threshold_total (counter)
- intraday_realtime_refresh_trigger_total (counter)
- intraday_retry_3s_total (frontend counter/telemetry)

Dashboard de xay:
- Panel 1: p50/p95 age_seconds theo symbol group (VN30/non-VN30).
- Panel 2: stale_over_threshold_total theo 5p window.
- Panel 3: top symbols co stale over-threshold cao nhat.
- Panel 4: ty le refresh thanh cong sau retry 3s.

Alert thresholds:
- Warning: p95 age_seconds > threshold trong 3 cua so lien tiep.
- Critical: stale_over_threshold_total tang dot bien > 5x baseline 15 phut.

## 10. Security and governance

- Khong thay doi quyen truy cap endpoint.
- Khong bo sung secrets moi.
- Audit trail bat buoc:
  - Moi thay doi phase code phai cap nhat docs/CODE_CHANGE_AUDIT_LEDGER.md voi file list + test evidence.
  - Entry audit phai tham chieu file plan nay.

## 11. Release plan

Canary/phased rollout:
- Buoc 1: Enable freshness contract additive fields (read-only).
- Buoc 2: Enable stale threshold gating backend.
- Buoc 3: Enable frontend auto retry/state gating.
- Buoc 4: Theo doi metrics 1 phien giao dich day du.

Backout plan:
- Tat stale threshold gating qua env/flag neu co incident.
- Giu cac field additive de khong vo contract.
- Revert frontend stale-over-threshold state gating neu UX anh huong lon.

Post-release checklist:
- Verify metrics dashboard co data.
- Verify alert route va oncall receiver.
- Verify khong con case stale payload bi hien nhu realtime moi.

## 12. Ownership and timeline

Ownership:
- Owner chinh: Backend + Frontend realtime squad.
- Reviewer: Team dashboard + Team market data.
- Approver: Tech lead stock workspace.

Timeline de xuat:
- D0: review va chot plan.
- D1: phase 1 backend contract.
- D2: phase 2 frontend consume + retry.
- D3: phase 3 tests + observability + signoff.

## Definition of Ready (DoR)

- Plan nay da duoc review va approved.
- Chot nguong freshness: 15s non-VN30, 10s VN30, retry 3s.
- Chot test matrix va owner cho tung phase.

## Definition of Done (DoD)

- Da implement day du backend/frontend theo plan.
- Da chay pass test matrix (unit/integration/frontend/e2e).
- Da cap nhat CODE_CHANGE_AUDIT_LEDGER voi file-list va ket qua verify.
- Da theo doi metrics sau rollout va khong co stale over-threshold regression nghiem trong.

## Rollback strategy (consolidated)

- Rollback muc 1 (an toan): tat stale-over-threshold gating, giu additive fields.
- Rollback muc 2 (frontend): tat retry state machine ve polling/read path cu.
- Rollback muc 3 (full): revert commit theo phase, uu tien phase 2 truoc phase 1.

## Appendix A - File inventory du kien sua

Backend:
- backend/portfolio/market_data_service.py
- backend/portfolio/realtime/stream_consumers.py
- backend/portfolio/tests/test_api_routes_stock_workspace_realtime_bulk.py

Frontend:
- frontend/src/components/RealtimeQuoteTable/RealtimeQuoteTable.jsx
- frontend/src/utils/dashboardRealtimeViewModel.js
- frontend/src/hooks/useRealtimeFeedLegacy.js
- frontend/src/pages/StockDetail.jsx

Docs:
- docs/REALTIME_FRESHNESS_CONTRACT_IMPLEMENTATION_PLAN_20260417.md
- docs/CODE_CHANGE_AUDIT_LEDGER.md

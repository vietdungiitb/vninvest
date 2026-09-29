# NATIVE ONLY RUNTIME AUDIT EVIDENCE - 2026-05-08

**Muc dich**: Luu lai minh chung runtime thuc te cho bo handoff native-only, de doi code co the verify ngay, khong can doan.

---

## 1. Audit snapshot

### 1.1 Dashboard

- Route: `/dashboard`
- Result: page load duoc, khong crash JS.
- Observed state: empty state `Vui long chon hoac tao danh muc de bat dau.`
- Severity: P2 (data empty, not crash)

### 1.2 Stock detail

- Route: `/stocks/VCB`
- Result: crash JS.
- Console error: `[useWhaleAnalyticsData] Error: Error: Failed to fetch valid analytics snapshot`
- Page error: `TypeError: Cannot read properties of undefined (reading 'slice')`
- API snapshot: `/api/portfolio/whale/analytics/VCB/?timeframe=session&compact=0` returned `{}`
- Root-cause refs:
  - [frontend/src/hooks/useWhaleAnalyticsData.js](../frontend/src/hooks/useWhaleAnalyticsData.js#L66)
  - [frontend/src/hooks/useWhaleAnalyticsData.js](../frontend/src/hooks/useWhaleAnalyticsData.js#L86)
  - [frontend/src/pages/StockDetail.jsx](../frontend/src/pages/StockDetail.jsx#L602)
  - [packages/core/backend/src/vninvest_core/compat_urls.py](../packages/core/backend/src/vninvest_core/compat_urls.py#L95)
- Severity: P0

### 1.3 Admin core overview

- Route: `/admin/core/overview`
- Result: shell load duoc, nhung du lieu bi fail.
- Observed state: `Khong tai duoc du lieu tong quan nen tang.`
- API snapshot:
  - `/api/core/v1/operator/overview/` -> 404
  - `/api/core/v1/operator/health/` -> 404
- Severity: P0

### 1.4 Support

- Route: `/support`
- Result: shell load duoc, nhung backend data fail.
- Observed state: `Khong tai duoc du lieu ho tro.`
- Severity: P1

### 1.5 Transactions

- Route: `/transactions`
- Result: shell load duoc.
- Observed state: `Chua co danh muc nao duoc chon`.
- Severity: P2

### 1.6 Whale alerts workspace

- Route: `/whale-alerts`
- Result: shell load duoc, khong crash.
- Observed state: workspace hien bat dau, chua co analytics crash trong audit nay.
- Severity: P2

### 1.7 Admin Ops

- Route: `/admin-ops`
- Result: hoat dong.
- Observed state: recent activity card da hien event that sau khi fix audit-log helper.
- API snapshot: `/core/v1/audit-log?limit=5` -> 200 with events
- Root-cause refs:
  - [frontend/src/api/client.js](../frontend/src/api/client.js#L735)
  - [packages/core/backend/src/vninvest_core/urls.py](../packages/core/backend/src/vninvest_core/urls.py#L17)
- Severity: DONE / not blocker

---

## 2. Conclusion for handoff

1. Test pass khong dong nghia runtime pass.
2. Stock detail va admin core overview la hai blocker P0 phai xu ly truoc.
3. Dashboard, support, transactions va whale alerts can duoc chuan hoa thanh empty/error states ro rang, khong duoc crash.
4. Admin Ops da duoc xac nhan live va khong con la blocker.

## 3. Post-fix smoke

### 3.1 Surfaces rechecked after code fixes

- `/stocks/VCB`: khong con JS crash page-level sau khi harden workspace/market-group memberships; page now fallback ve empty/degraded state khi snapshot chua san sang.
- `/admin/core/overview`: authenticated browser page render snapshot native; core-api container route resolver confirms `/core/v1/operator/overview/` and `/core/v1/operator/health/` resolve to native contract views instead of browser 404.
- `/dashboard`: reloaded ve empty state co chu y, khong crash.
- `/support`: render empty/error state hop le, khong crash.
- `/transactions`: render empty state hop le, khong crash.
- `/whale-alerts`: shell / aggregate view stable, khong crash.
- `/ai-advisory`: shell / empty advisory state stable, khong crash.

### 3.2 Residual risk

- Stock detail van log `useWhaleAnalyticsData` va websocket 404 trong console khi backend snapshot / realtime chua san sang; page-level crash da duoc loai bo.

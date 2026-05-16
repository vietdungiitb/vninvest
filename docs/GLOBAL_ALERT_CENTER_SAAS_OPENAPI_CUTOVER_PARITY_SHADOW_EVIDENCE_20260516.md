# Parity / Shadow Evidence — Global Alert Center SaaS OpenAPI Cutover
**Ngày**: 2026-05-16

---

## 1. Mục đích

Tài liệu này là bằng chứng rằng alert-center đã đi qua gate parity/shadow tối thiểu trước khi legacy alert paths được sunset tiếp. Nó không mở thêm bridge mới và không hợp thức hóa việc bỏ soak/shadow.

---

## 2. Evidence summary

### Frontend bridge sunset
- Browser-side alert synthesis đã bị cắt khỏi `frontend/src/hooks/useUnifiedAlerts.js`.
- `frontend/src/api/client.js` bridge sang canonical core delivery và chuẩn hóa cursor cho contract cũ.
- `frontend/src/pages/WhaleAlertsHub.jsx` đã trở thành wrapper mỏng trỏ sang canonical `AlertCenterPage`.
- `frontend/src/pages/LegacyDashboard.jsx` đã trở thành wrapper mỏng trỏ sang `ModernDashboard`.

### Canonical alert delivery
- Backend canonical delivery route đang sống ở `/core/v1/unified-alert/delivery`.
- Delivery contract là per-user projection theo watchlist, tracked symbols, holdings, và whale threshold.
- Main feed / AI lane vẫn giữ tách lane theo OpenAPI contract.

### Validation evidence
- `src/components/DashboardRealtimePanel.test.jsx`
- `src/pages/WhaleAlertsHub.test.jsx`
- `src/api/client.unifiedAlerts.test.js`
- `signal_intelligence.tests.test_materializers`
- `./start_dev.ps1` smoke: Core API health OK, Frontend health OK

---

## 3. Shadow / parity gate status

| Gate | Status | Evidence |
|---|---|---|
| No browser-side alert synthesis | PASS | `useUnifiedAlerts.js` no longer assembles whale/dark-flow/price-shock/stale-quote browser truth |
| Canonical delivery bridge only | PASS | `frontend/src/api/client.js` reads `coreApiAdapter.getUnifiedAlertDelivery(...)` |
| Legacy whale route sunset | PASS | `WhaleAlertsHub` delegates to canonical alert-center page |
| Legacy dashboard monolith sunset | PASS | `LegacyDashboard` delegates to `ModernDashboard` |
| No bypass of shadow/parity gates | PASS | Self-audit protocol still blocks any skip-soak/skip-shadow path |

---

## 4. Residual risk

- D03 wrapper removal wave has removed `WhaleAlertsHub` and `LegacyDashboard`, but other legacy route contracts still exist for compatibility and must be audited before final sunset.
- No new compat business logic was introduced in this slice.

---

## 5. Approval note

This report is sufficient to close D02 for the current cutover slice because it records the existing parity/shadow evidence, the wrapper-based sunset state, and the explicit anti-bypass rule.
# Global Alert Center SaaS OpenAPI Cutover — Parity & Shadow Evidence
**Date**: 2026-05-16
**Status**: Partial evidence package (pre-legacy-sunset)

---

## 1. Scope

This document captures parity/shadow evidence for Global Alert Center SaaS OpenAPI cutover slices completed in this execution window.

Included slices:

1. B01/B02/D08 fact-first materialization closure
2. C01/C02/B03 endpoint and delivery projection closure
3. D01/D05 frontend/mobile bridge naming alignment

Excluded:

1. Legacy alert path sunset (no hard decommission executed in this slice)
2. Production soak run >= 3 trading days (not in this implementation window)

---

## 2. Validation commands and outcomes

### 2.1 Signal-intelligence focused parity pack

```powershell
Push-Location ./packages/core/backend
$env:DJANGO_DEBUG='true'
$env:DJANGO_ALLOWED_HOSTS='localhost,127.0.0.1'
$env:DJANGO_SECRET_KEY='test-secret'
$env:CORE_PAT_PEPPER='test-pepper'
..\..\..\.venv\Scripts\python.exe manage.py test \
	signal_intelligence.tests.test_materializers \
	signal_intelligence.tests.test_market_anomaly_events \
	signal_intelligence.tests.test_ai_signal_lane \
	signal_intelligence.tests.test_alert_center_api \
	signal_intelligence.tests.test_user_alert_delivery \
	signal_intelligence.tests.test_delivery_service \
	--keepdb
Pop-Location
```

Outcome: **25 tests passed**.

### 2.2 packages/web adapter parity

```powershell
Push-Location ./packages/web
$env:CI='true'
npm test -- --runInBand src/adapters/coreApiAdapter.test.js --watch=false
Pop-Location
```

Outcome: **17 tests passed**.

### 2.3 frontend bridge parity

```powershell
Push-Location ./frontend
$env:CI='true'
npm test -- --runInBand src/api/client.unifiedAlerts.test.js src/components/DashboardRealtimePanel.test.jsx --watch=false
Pop-Location
```

Outcome: **5 tests passed**.

### 2.4 runtime smoke

```powershell
.\start_dev.ps1
```

Outcome: **Core API health OK**, **Frontend health OK**, queue drift check clean.

---

## 3. Requirement-to-evidence mapping

| Requirement | Evidence |
|---|---|
| Native `/core/v1/signals/alert-center/*` and `/core/v1/signals/ai-alerts/*` contracts | `test_alert_center_api`, adapter tests, runtime smoke |
| Delivery projection statefulness | `test_user_alert_delivery`, `test_delivery_service` |
| Canonical fact-first materialization | `test_materializers`, `test_market_anomaly_events`, `test_ai_signal_lane` |
| Browser-side truth removal | frontend bridge tests + adapter parity |
| Lane isolation (main vs AI) | `test_ai_signal_lane`, `test_alert_center_api` |

---

## 4. Shadow / parity gate status

### 4.1 Shadow status (legacy vs native)

Status: **Partial**.

Notes:

1. This wave validated native contracts and parity regressions at test/runtime level.
2. No new legacy business route was introduced.
3. A long-horizon production shadow run report (>= 3 trading days) is **not** part of this slice.

### 4.2 Parity status

Status: **Partial-to-pass for implementation slices in scope**.

Notes:

1. Test-level parity for contract, lane separation, delivery state, and fact linkage is green.
2. Program-level parity gate for final legacy sunset remains pending governance decision and soak evidence.

---

## 5. Rollback posture

1. Native endpoints are additive over prior frontend bridge migration path and still support compatibility aliases where required.
2. No destructive legacy deletion was executed in this slice.
3. Rollback at code level is available via per-slice commits on `dev`.

---

## 6. Residual risks

1. AI advisory ingestion still accepts `OrderFlowEvent(signal_type=OTHER, metadata.ai_signal)` as shim source; a stricter native advisory producer-only cutover is pending.
2. Program-level soak/shadow evidence for final legacy decommission remains open and must be completed before any irreversible sunset.

---

## 7. Next required artifacts for D02 close

1. `docs/GLOBAL_ALERT_CENTER_SAAS_OPENAPI_CUTOVER_PRODUCTION_SHADOW_SOAK_EVIDENCE_20260516.md` filled with >= 3 real trading days.
2. `docs/GLOBAL_ALERT_CENTER_SAAS_OPENAPI_CUTOVER_PARITY_DASHBOARD_CHECKLIST_20260516.md` filled with parity dashboard outputs and PASS evidence.
3. `docs/GLOBAL_ALERT_CENTER_SAAS_OPENAPI_CUTOVER_LEGACY_DECOMMISSION_READY_INVENTORY_20260516.md` maintained as pre-delete inventory + rollback map.
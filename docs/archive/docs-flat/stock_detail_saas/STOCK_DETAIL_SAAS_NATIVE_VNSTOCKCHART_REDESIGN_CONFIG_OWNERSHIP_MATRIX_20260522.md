# CONFIG OWNERSHIP MATRIX — Stock Detail SaaS Native VNStockChart Redesign

**Ngày**: 2026-05-22

---

## 1. Ownership summary

| Area | Artifact / Config | Owner | Change in this workstream |
|---|---|---|---|
| Canonical route shell | `packages/web/src/pages/market/ShellStockDetailPage.js` | Frontend Platform | Yes |
| Page orchestration | `packages/web/src/pages/StockDetailPage.js` | Frontend Platform | Yes |
| Chart shell design | feature components/CSS under `packages/web/src/features/stock-detail/` | Frontend Product UI | Yes |
| Adapter contract | `packages/web/src/adapters/coreApiAdapter.js` | Frontend Platform | Yes |
| Stock-management native views | `packages/core/backend/src/market_data/stock_mgmt_native_views.py` | Backend Market Data | Conditional |
| Realtime/native flow views | `packages/core/backend/src/market_serving/native_views.py` | Backend Market Serving | Conditional |
| Route tests | `packages/core/backend/tests/test_stock_management_api_routes.py` | Backend QA / Core API | Conditional |
| Native tests | `packages/core/backend/src/market_data/tests/test_stock_management_native_api.py` | Backend QA / Market Data | Conditional |
| i18n keys and Vietnamese copy | `packages/web` i18n surfaces | Frontend Product UI | Yes |
| Runtime refresh | `./start_dev.ps1` evidence | Runtime operator | Yes |

---

## 2. Decision rights

### Frontend Product UI

1. Quyết định chart-first hierarchy, spacing, density, semantics màu, module order.
2. Quyết định module nào thuộc context deck và module nào là deferred.

### Frontend Platform

1. Quyết định page state model, route shell, adapter contract, component boundaries.
2. Quyết định strategy deprecate/fallback nếu còn temporary legacy bridge.

### Backend Market Data / Market Serving

1. Quyết định có thực sự cần backend change hay không.
2. Quyết định route/file owner trong `packages/core/backend/` nếu blocker được chứng minh.

### Core API Guild / QA

1. Quyết định OpenAPI compliance và route-test coverage nếu contract bị đổi.
2. Có quyền block mọi backend shortcut trái governance.

---

## 3. Hard governance notes

1. Không thêm feature flag mới cho stock-detail redesign nếu chưa chứng minh rollout risk thực sự cần.
2. Không owner nào được tự tuyên bố legacy `frontend/` hoặc `backend/` là end-state của workstream.
3. Temporary bridge nếu còn phải có owner + expiry + removal condition trong evidence.
4. `news`/`financials` unavailable không phải lý do hợp lệ để client dựng fake content.

---

## 4. Architecture authority

| Decision | Owner | Non-owner constraints |
|---|---|---|
| Canonical stock-detail frontend architecture (`packages/web` + host bridge) | Frontend Platform Lead | Legacy page owners không được tự declare root `frontend` là end-state |
| Hero chart hierarchy and order-flow placement | Frontend Product UI Lead | Backend/Platform không được di dời `OrderFlowRadarPanel` khỏi vị trí đã khóa |
| Backend change necessity | Backend Lead + Tech Lead | Frontend không được ép thêm endpoint mới nếu adapter/view model fix là đủ |
| OpenAPI compliance | Core API Guild | Không contract change nào được merge thiếu metadata/tests |

Temporary legacy bridge nếu tồn tại phải có owner rõ ràng, expiry date, và recorded evidence. Không owner thì bridge bị coi là vi phạm kiến trúc.

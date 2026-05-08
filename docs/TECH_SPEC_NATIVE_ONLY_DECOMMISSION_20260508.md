# TECH SPEC - Native-Only Decommission: xoa hybrid bridge va proxy fallback

**Ngay**: 2026-05-08  
**Trang thai**: APPROVED FOR IMPLEMENTATION  
**Muc tieu**: Chuyen production sang native-only, khong con hybrid route fallback

---

## 1. Nguyen tac bat di bat dich

1. **No proxy fallback**: Sau cutover, khong con catch-all legacy proxy trong runtime.
2. **Native ownership**: Moi endpoint con song phai co owner ro rang trong app native, khong duoc list qua compat layer.
3. **Contract stability**: External `/api/*` co the duoc giu, nhung implementation phai la native route, khong phai bridge.
4. **No silent legacy dependency**: Production khong duoc co env/service giu duong lui am tham ve legacy.
5. **No dual truth**: Khong duoc co hai implementation song song cho cung mot contract sau khi slice cutover PASS.

---

## 2. Current route map and target native homes

### 2.1 Auth / partner / tenant

- Current hybrid surface: `identity_access.compat_urls.py`
- Target native home: `identity_access.urls` + `identity_access.partner_urls`
- Decommission action: move auth/partner routes into native app URLConfs; delete compat file after consumer parity pass.

### 2.2 Portfolio / workspace

- Current hybrid surface: `user_workspace.compat_urls.py`, `vninvest_core.compat_portfolio.py`
- Target native home: `user_workspace.urls`
- Decommission action: keep portfolio CRUD, transaction and watchlist routes in user_workspace native routes only; no proxy shim.

### 2.3 Realtime / market

- Current hybrid surface: `market_serving.compat_urls.py`, `signal_intelligence.compat_urls.py`
- Target native home: owning native app URLConfs under `market_serving` and `signal_intelligence`
- Decommission action: move any remaining compat alias into native route modules and then delete compat wrappers.

### 2.4 Market data / stock management

- Current hybrid surface: `market_data.compat_urls.py`, `CompatTrackedSymbolsView`
- Target native home: `market_data.urls`
- Decommission action: `tracked-symbols`, `symbols`, `daily-prices` and related stock-management contracts must be owned natively by market-data domain.

### 2.5 Public legal content

- Current hybrid surface: `CompatPublicLegalPagesView`
- Target native home: a small native public-content route in core (recommended owner: `commercial` if no dedicated content app exists)
- Decommission action: serve legal pages via a native route with fail-soft empty list semantics, not via proxy or compat shim.

### 2.6 Proxy fallback

- Current hybrid surface: `vninvest_core.legacy_proxy_view`
- Target state: deleted

---

## 3. File-level technical changes required

### 3.1 Delete / remove

1. `packages/core/backend/src/vninvest_core/legacy_proxy.py`
2. `path('api/<path:remaining>', legacy_proxy_view, ...)` from `vninvest_core/urls.py`
3. `LEGACY_BACKEND_URL` and any legacy-only proxy env from production compose files
4. `compat_*` route files once their route set is fully native

### 3.2 Add / move

1. Native URLConfs inside owning apps for auth, partner, workspace, market, data, legal content
2. Native serializer/view adapters where compat route shapes currently differ from frontend expectations
3. Focused regression tests for each route family before removing compat file

### 3.3 Preserve

1. Frontend external contract if clients still expect `/api/*`
2. Security rules: PAT pepper, allowed hosts, CORS, no source mount in prod
3. Audit hooks and evidence generation

---

## 4. Decommission architecture

### Before

Browser/clients -> core-api -> compat_* -> legacy_proxy_view -> legacy backend

### After

Browser/clients -> core-api -> native domain URLConfs and views

No request path should traverse a generic fallback proxy.

---

## 5. Validation invariants

1. `resolve('/api/...')` for every active route must land on a native view in the owning app.
2. Browser network trace on production must show zero hits to `legacy_proxy_view`.
3. `grep` for `compat_` in runtime URLConfs must return only legacy cleanup references, not active mounts.
4. `LEGACY_BACKEND_URL` must be absent from production compose once decommission complete.

---

## 6. Non-goals

1. Không đổi semantically meaningful client payloads chỉ để xóa proxy.
2. Không thêm domain mới vào compat layer.
3. Không giữ lại proxy để "phòng hờ" sau khi all routes native.

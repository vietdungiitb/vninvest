# CONFIG OWNERSHIP MATRIX — SOC Config UI Upgrade & Admin-Ops Decommission

**Ngày**: 2026-05-16  
**Scope**: Write permission và ownership cho mọi cấu hình được quản lý qua SOC

---

## 1. Nguyên tắc

1. **SOC là operator surface duy nhất** — không tạo parallel config path bên ngoài SOC.
2. **`can_apply: True`** là điều kiện cần để UI cho phép write; backend enforce thêm `has_object_permission`.
3. **DNSE credentials không được ghi qua UI** — chỉ đọc env status.
4. **Screener rules là CRUD objects** — mỗi rule có `owner` hoặc domain-level permission.
5. **DataOps backfill là operator action** — không phải user action; phân quyền theo role.
6. **Config write phải qua ConfigPreviewModal** — không silent write.

---

## 2. Domain Config Ownership Matrix

| Domain | Config object | Read | Write | Reset | Notes |
|--------|--------------|------|-------|-------|-------|
| **Prefetch** | `PrefetchRuntimeConfig` | SOC viewer | SOC operator | SOC operator | Single record |
| **Prefetch** | Universe groups multiselect | SOC viewer | SOC operator | — | Linked to `UniverseGroup` model |
| **Prefetch** | Time policy profiles | SOC viewer | SOC operator | SOC operator | 6 profiles |
| **VnBroker** | `VnbrokerRuntimeConfig` | SOC viewer | SOC operator | SOC operator | Single record |
| **VnBroker** | DNSE API credentials | SOC viewer (status only) | ✗ (env only) | ✗ | No DB storage |
| **VnBroker** | Benchmark (action) | SOC viewer | SOC operator | — | Stateless action |
| **DataOps** | Backfill dispatch (action) | SOC viewer | SOC operator | — | Stateless action |
| **DataOps** | Planner preview (dry-run) | SOC viewer | SOC operator | — | Read-like action |
| **Screener** | `ScreenerDomainConfig` | SOC viewer | SOC operator | SOC operator | Domain-wide config |
| **Screener** | `ScreenerRule` (create) | SOC viewer | SOC operator | — | CRUD object |
| **Screener** | `ScreenerRule` (edit) | SOC viewer | Rule owner + SOC admin | — | Owner-level check |
| **Screener** | `ScreenerRule` (delete) | SOC viewer | SOC admin | — | Admin-only |
| **Screener** | Manual scan (action) | SOC viewer | SOC operator | — | `symbols` field |
| **Screener** | Alert history | SOC viewer | ✗ (read-only) | — | Append-only |

---

## 3. Role Definitions

| Role | Scope | Permissions |
|------|-------|------------|
| `soc_viewer` | SOC surface | Read all config, no write |
| `soc_operator` | SOC surface | Read + write runtime configs, dispatch actions |
| `soc_admin` | SOC surface | All of operator + delete rules + decommission |
| `superuser` | Global | All |

---

## 4. Frontend `can_apply` Gates

| Panel | `can_apply` source | UI behavior when False |
|-------|-------------------|----------------------|
| `PrefetchPanel` | `GET /api/soc/prefetch/config/` → `can_apply` | Show `WriteGuardBanner`, disable Save + Warm Now |
| `DataOpsPanel` | Domain-level flag | Show `WriteGuardBanner`, disable dispatch |
| `ScreenerPanel` | `GET /api/soc/screener/config/` → `can_apply` | Show `WriteGuardBanner`, disable config save + Rule CRUD + manual scan |
| `VnbrokerPanel` | `GET /api/soc/vnbroker/config/` → `can_apply` | Show `WriteGuardBanner`, disable save + reset + benchmark |

---

## 5. API Endpoint Permission Matrix

| Endpoint | Method | Permission class | Role required |
|----------|--------|-----------------|--------------|
| `/api/soc/prefetch/config/` | GET | `SOCDomainPermission` | `soc_viewer` |
| `/api/soc/prefetch/config/` | POST | `SOCDomainPermission` | `soc_operator` |
| `/api/soc/prefetch/warm-now/` | POST | `SOCDomainPermission` | `soc_operator` |
| `/api/soc/vnbroker/config/` | GET | `SOCDomainPermission` | `soc_viewer` |
| `/api/soc/vnbroker/config/` | PUT | `SOCDomainPermission` | `soc_operator` |
| `/api/soc/vnbroker/benchmark/` | POST | `SOCDomainPermission` | `soc_operator` |
| `/api/soc/dataops/planner/preview/` | POST | `SOCDomainPermission` | `soc_operator` |
| `/api/soc/dataops/planner/apply/` | POST | `SOCDomainPermission` | `soc_operator` |
| `/api/soc/screener/config/` | GET | `SOCDomainPermission` | `soc_viewer` |
| `/api/soc/screener/config/` | POST | `SOCDomainPermission` | `soc_operator` |
| `/api/soc/screener/rules/` | GET | `SOCDomainPermission` | `soc_viewer` |
| `/api/soc/screener/rules/` | POST | `SOCDomainPermission` | `soc_operator` |
| `/api/soc/screener/rules/<id>/` | PUT | `SOCRulePermission` | `soc_operator` |
| `/api/soc/screener/rules/<id>/delete/` | DELETE | `SOCRulePermission` | `soc_admin` |
| `/api/soc/screener/manual-scan/` | POST | `SOCDomainPermission` | `soc_operator` |

---

## 6. Decommission Phase Permission

| Phase | Requires | Sign-off |
|-------|----------|----------|
| D1 (parity gate) | Tech Lead verify 10 checks pass | Tech Lead |
| D2 (backend 410) | D1 PASS + deploy approval | Tech Lead |
| D3 (frontend cleanup) | D2 PASS + 1 week soak | Tech Lead |

---

## 7. Immutable / Read-Only Surfaces (post-decommission)

| Surface | Status | Reason |
|---------|--------|--------|
| `/api/admin-ops/*` | 410 GONE (D2) | Fully replaced by SOC |
| `admin-ops` page in App.jsx | Removed (D3) | No more routing |
| `client.js` bridge functions | Removed (D3) | Replaced by socApi.js |

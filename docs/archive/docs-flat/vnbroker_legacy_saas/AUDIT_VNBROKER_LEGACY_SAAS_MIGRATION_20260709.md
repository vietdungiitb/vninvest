# Audit: VNBroker Legacy→SaaS Migration — `operations-center?tab=vnbroker` Not Working

**Date**: 2026-07-09
**Scope**: Legacy frontend (`frontend/`), SaaS frontend (`packages/web/`), routing layer, API client layer
**Author**: AI codebase audit
**Status**: COMPLETE

---

## Executive Summary

Tính năng `operations-center?tab=vnbroker` **không hoạt động** khi chạy qua legacy frontend (`frontend/src/App.jsx`) — đây là code path đang được dùng trong production. Nguyên nhân gốc: file `frontend/src/api/socApi.js` (592 dòng, 16 method VNBroker) **đã bị xoá** trong commit `c90cd003` (22/06/2026), nhưng tất cả legacy SOC components đều vẫn import module này. SaaS native path (`packages/web/`) hoạt động bình thường nhưng chỉ active khi feature flag `packageShellHostEnabled = true` — không phải cấu hình production mặc định.

---

## 1. Root Cause: `socApi.js` Deleted, 10+ Files Still Import It

### Deleted file
`frontend/src/api/socApi.js` — bị xoá trong commit `c90cd003` (message: "docs: add visual audit report; fix: beta dashboard layout bugs"). File này chứa tất cả API methods cho mọi SOC domain:
- `socApi.getVnbrokerConfig()` → `GET /api/soc/vnbroker/config/`
- `socApi.getVnbrokerHealth()` → `GET /api/soc/vnbroker/health/`
- `socApi.getVnbrokerProviders()` → `GET /api/soc/vnbroker/providers/`
- `socApi.getVnbrokerBenchmarkLatest()` → `GET /api/soc/vnbroker/benchmark/`
- ... và 12 method VNBroker khác

### Files still importing from deleted module

| File | Line | Import | Impact |
|---|---|---|---|
| `frontend/src/pages/SOCPage.jsx` | 5 | `import { socApi } from '../api/socApi'` | Toàn bộ SOCPage crash, không render được tab nào |
| `frontend/src/pages/SOCPage.test.jsx` | 7 | `import { socApi } from '../api/socApi'` | Test suite failed |
| `frontend/src/components/soc/VnbrokerPanel.jsx` | 6 | `import { socApi } from '../../api/socApi'` | Vnbroker tab không render → màn hình trắng / crash |
| `frontend/src/components/soc/DataOpsPanel.jsx` | 4 | `import { socApi } from '../../api/socApi'` | DataOps tab không render |
| `frontend/src/components/soc/OverviewPanel.jsx` | 6 | `import { socApi } from '../../api/socApi'` | Overview tab không render |
| `frontend/src/components/soc/SignalsPanel.jsx` | 7 | `import { socApi } from '../../api/socApi'` | Signals tab không render |
| `frontend/src/components/soc/PrefetchPanel.jsx` | 6 | `import { socApi } from '../../api/socApi'` | Prefetch tab không render |
| `frontend/src/components/soc/ScreenerPanel.jsx` | 6 | `import { socApi } from '../../api/socApi'` | Screener tab không render |
| `frontend/src/components/soc/BackfillProgressPanel.jsx` | 3 | `import { socApi } from '../../api/socApi'` | BackfillProgress tab không render |
| `frontend/src/components/soc/SOCComponents.test.jsx` | 8 | `import { socApi } from '../../api/socApi'` | Test suite failed |

→ **Module-not-found error tại runtime cho bất kỳ route nào render SOCPage. Không riêng VNBroker, toàn bộ `/operations-center` sập.**

---

## 2. Two Code Paths: Legacy (Broken) vs SaaS (Working)

### Path A — Legacy Frontend (active trong production)

```
Browser URL: /operations-center?tab=vnbroker
  ↓
Route: frontend/src/App.jsx:339
  <Route path="operations-center" element={<SOCPage />} />
  ↓
Component: frontend/src/pages/SOCPage.jsx
  - useSearchParams() đọc "tab" param (dòng 23)
  - Validate tab hợp lệ (dòng 17: VALID_DOMAINS includes 'vnbroker')
  - Panel map: panels['vnbroker'] = <VnbrokerPanel t={pageT} /> (dòng 59)
  ↓
Component: frontend/src/components/soc/VnbrokerPanel.jsx
  - Mount → gọi fetchData() (dòng ~200)
  - fires 6 Promise.all calls tới socApi.*
  - socApi not found → 💥 RUNTIME CRASH
```

### Path B — SaaS Native (chỉ active khi feature flag ON)

```
Browser URL: /operations-center?tab=vnbroker
  ↓
Route: packages/web/src/main.js:87
  <Route path="operations-center" element={resolvePageComponent('operations-center')} />
  ↓
Registry: packages/web/src/pages/pageRegistry.js:175
  makePageEntry("operations-center", "baseline", () =>
    import("./admin/ShellOperationsCenterPage.tsx"))
  ↓
Component: packages/web/src/pages/admin/ShellOperationsCenterPage.tsx
  - useSearchParams() đọc "tab" param (dòng 59)
  - switch case "vnbroker" → <SocVnbrokerPanel /> (dòng 78)
  ↓
Component: packages/web/src/components/soc/SocVnbrokerPanel.tsx
  - Dùng defaultCoreApiAdapter (cast as typed, dòng 52-66)
  - 5 Promise.all calls tới adapter.*
  - ✅ HOẠT ĐỘNG BÌNH THƯỜNG (446 dòng, full chức năng core)
```

### Feature Gate

Tại `frontend/src/App.jsx:84-86`:
```javascript
const packageShellHostEnabled = (
  process.env.REACT_APP_ENABLE_PACKAGE_SHELL_HOST === '1' && debugPagesEnabled
);
```
với `debugPagesEnabled = process.env.REACT_APP_ENABLE_DEBUG_PAGES === '1'`.

**Mặc định production**: cả 2 flag đều `'0'` → `packageShellHostEnabled = false` → **Path A (legacy, broken) được dùng**.

---

## 3. Legacy SaaS — So sánh VnbrokerPanel

| Khía cạnh | Legacy (`VnbrokerPanel.jsx`) | SaaS (`SocVnbrokerPanel.tsx`) |
|---|---|---|
| **Dòng code** | 827 dòng | 446 dòng |
| **API client** | `socApi` (đã xoá) | `defaultCoreApiAdapter` cast as typed |
| **Base URL** | `/api/soc/vnbroker/*` | `/core/v1/operator/soc/vnbroker/*` |
| **Config editor** | Structured form (select + number inputs) | Raw JSON textarea |
| **Per-provider override** | Accordion với override timeout/retry/rate-limit | Không có |
| **Optimize config từ benchmark** | `buildOptimizedConfigFromBenchmark()` + recommendation | Không có |
| **Preview modal** | `ConfigPreviewModal` (before/after diff + change summary) | `SocConfigPreviewModal` (before/after) |
| **Health metrics** | 3-column grid (healthy/degraded/critical) | Giống + thêm throughput + avg latency |
| **Benchmark** | Table với latency, RPM, success%, rate-limited% | Giống + color-coded tốt hơn |
| **Providers grid** | Status cards (runtime_ready / configured) | Dùng `SocServiceHealthCard` component |
| **Circuit breaker** | Không có | Card riêng + status badge + test connection |
| **Test connection** | Không có | Button `testSocVnbrokerConnection()` |
| **Reset to defaults** | `handleResetToDefaults()` + confirm dialog | Có |
| **i18n keys** | `t('soc.vnbroker.*')` | Cùng keys |

---

## 4. Issues Found

### P0 — `socApi.js` Deleted (entire SOC page broken)
- **File**: `frontend/src/api/socApi.js` — **DELETED** in `c90cd003`
- **Impact**: Mọi legacy SOC component crash vì import không resolve được
- **Fix**: Restore file OR chuyển hướng route sang SaaS OR tạo bridge adapter

### P1 — Legacy SOCPage dead code `getServiceList()`
- **File**: `frontend/src/pages/SOCPage.jsx:25-44`
- **Issue**: `useEffect` fetch `socApi.getServiceList()` → lưu vào state `serviceList` → **không bao giờ dùng** trong render
- **Impact**: Gây thêm 1 API call failed (socApi deleted) dù không cần thiết

### P1 — SOCPage.test.jsx outdated
- **File**: `frontend/src/pages/SOCPage.test.jsx:27`
- **Issue**: Mock `MatrixPanel` đã bị xoá (merged vào DataOps); test "Ma trận" tab button (dòng 74) không còn tồn tại
- **Impact**: Test fail

### P2 — SOCComponents.test.jsx imports deleted module
- **File**: `frontend/src/components/soc/SOCComponents.test.jsx:8`
- **Issue**: `import { socApi } from '../../api/socApi'`
- **Impact**: Test suite cho SOC components không chạy được

### P3 — SaaS Config Editor Clear/Reset bug (đã có trong audit trước)
- **File**: `packages/web/src/components/soc/SocVnbrokerPanel.tsx:68`
- **Issue**: `value: editConfig || JSON.stringify(config || {}, null, 2)` — `||` fallback ngăn user clear editor
- **Impact**: Không thể set empty config

---

## 5. Risk Assessment

| Rủi ro | Mức độ | Mô tả |
|---|---|---|
| Production crash khi truy cập `/operations-center` | 🔴 Critical | 100% crash, toàn bộ SOC tab không hoạt động |
| Test suite red | 🟡 Medium | `SOCPage.test.jsx` + `SOCComponents.test.jsx` fail |
| User không clear được config (SaaS) | 🟢 Low | Workaround: xoá hết trừ `{}` |
| API URL mismatch (legacy vs SaaS) | 🟢 Low | `/api/soc/*` vs `/core/v1/operator/soc/*` — tuỳ backend config |

---

## 6. Key Files Reference

| File | Status | Ghi chú |
|---|---|---|
| `frontend/src/api/socApi.js` | ❌ Deleted (c90cd003) | Cần khôi phục hoặc thay thế |
| `frontend/src/App.jsx:339` | ✅ Active | Route `/operations-center` → SOCPage |
| `frontend/src/pages/SOCPage.jsx` | ❌ Broken | Import socApi (đã xoá) |
| `frontend/src/components/soc/VnbrokerPanel.jsx` | ❌ Broken | Import socApi (đã xoá) |
| `packages/web/src/main.js:87` | ✅ Active (flagged) | Route SaaS → ShellOperationsCenterPage |
| `packages/web/src/pages/admin/ShellOperationsCenterPage.tsx` | ✅ Working | Tab router, switch case "vnbroker" |
| `packages/web/src/components/soc/SocVnbrokerPanel.tsx` | ✅ Working (minor bug) | Config editor clear bug |
| `packages/web/src/adapters/core/soc.js` | ✅ Working | Adapter thay thế socApi |
| `packages/web/src/adapters/core/__tests__/soc.test.js` | ✅ Working | Test cho adapter mới |
| `packages/core/backend/src/service_ops/views/vnbroker.py` | ✅ Working | Backend views |

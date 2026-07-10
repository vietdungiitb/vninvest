# Implementation Plan: VNBroker Legacy→SaaS Migration Fix

**Based on**: `docs/AUDIT_VNBROKER_LEGACY_SAAS_MIGRATION_20260709.md`
**Date**: 2026-07-09
**Target**: `operations-center?tab=vnbroker` hoạt động ổn định — cả legacy path lẫn SaaS path

---

## Phân tích chiến lược

3 approach có thể fix:

| Approach | Mô tả | Ưu điểm | Nhược điểm |
|---|---|---|---|
| **A — Restore `socApi.js`** | Git-restore file đã xoá | Quick fix, 0 risk, 5 phút | Legacy code vẫn tồn tại, không tiến gần hơn đến SaaS native |
| **B — Route đến SaaS component** | Sửa `App.jsx:339` render `ShellOperationsCenterPage` | Dùng code đã working, tiến đến SaaS native | Cần verify import path, phụ thuộc vào webpack alias |
| **C — Bridge adapter** | Tạo `socApi.js` mới delegate sang `packages/web/src/adapters/core/soc.js` | Legacy components không cần sửa, tái dùng adapter mới | Tạo dependency từ legacy → SaaS package |

**Kết luận**: Chọn **A (restore)** làm P0 hotfix — unblock production ngay lập tức. Sau đó **B** và **C** song song để tiến tới SaaS native.

---

## P0: Hotfix — Restore `socApi.js` cho legacy path

**Mục tiêu**: Production không còn crash khi truy cập `/operations-center`

### Bước 0a — Restore file từ git history

```bash
git restore c90cd003^1 -- frontend/src/api/socApi.js
git restore c90cd003^1 -- frontend/src/__tests__/socApi.dataops.test.js
```

**Verify**:
- [ ] `import { socApi } from '../../api/socApi'` resolve được ở VnbrokerPanel.jsx, SOCPage.jsx, etc.
- [ ] `node -e "require('./frontend/src/api/socApi.js')"` không báo lỗi

### Bước 0b — Trim dead endpoints khỏi `socApi.js` (tuỳ chọn)

Nếu muốn cleanup, xoá các method không còn backend tương ứng (đã verify qua SOC DataOps mapping). Giữ lại VNBroker methods.

**Verify**:
- [ ] `npx tsc --noEmit` (nếu file được import trong TS context)
- [ ] `npm run build` (legacy frontend)

---

## P1: Route Redirect — Đưa production sang SaaS path

**Mục tiêu**: Production chạy SaaS native component thay vì legacy. Không cần maintain legacy SOCPage nữa.

### Bước 1a — Verify import path

Kiểm tra `frontend/src/App.jsx` có thể import `ShellOperationsCenterPage` từ `packages/web` không:

- Nếu cùng webpack config: import trực tiếp
- Nếu khác build context: cần webpack alias hoặc copy vào `frontend/src/`

**File**: `frontend/src/App.jsx`

```javascript
// Lazy load từ packages/web
const ShellOperationsCenterPage = React.lazy(() =>
  import('@vninvest/web/pages/admin/ShellOperationsCenterPage')
    .then(m => ({ default: m.ShellOperationsCenterPage }))
);
```

**Verify**:
- [ ] Import không báo module-not-found
- [ ] Component render được trong legacy layout

### Bước 1b — Sửa route

**File**: `frontend/src/App.jsx:339`

```
Before:
  <Route path="operations-center" element={<SOCPage />} />

After:
  <Route path="operations-center" element={<ShellOperationsCenterPage />} />
```

**Verify**:
- [ ] `npm run build` pass
- [ ] Truy cập `/operations-center?tab=vnbroker` render đúng tab VNBroker (không crash)
- [ ] Check network tab: API gọi vào `/core/v1/operator/soc/vnbroker/*`

### Bước 1b — Update navigation

Nếu `frontend/src/App.jsx` có navigation links trỏ đến `/operations-center`, verify không cần sửa (cùng URL path).

**Verify**:
- [ ] Click "Operations Center" trong nav → render đúng page
- [ ] Tab switching hoạt động (vnbroker, overview, dataops, ...)

---

## P2: Legacy Cleanup — Xoá dead code

### Bước 2a — Remove `getServiceList()` from SOCPage

**File**: `frontend/src/pages/SOCPage.jsx:25-44`

Xoá useEffect fetch `getServiceList()` vì `serviceList` state không được dùng trong render.

**Verify**:
- [ ] `SOCPage.jsx` không còn gọi `socApi.*` nào khác không cần thiết

### Bước 2b — Fix SOCPage.test.jsx

**File**: `frontend/src/pages/SOCPage.test.jsx`

- Remove mock `MatrixPanel` (dòng 27) — component đã merged vào DataOps
- Update test "Ma trận" button check (dòng 74) — tab không còn tồn tại
- Add mocks cho `VnbrokerPanel`, `RuntimeKPIPanel`, `DNSEBackfillPanel`

**Verify**:
- [ ] `npx jest frontend/src/pages/SOCPage.test.jsx` — pass

### Bước 2c — Fix SOCComponents.test.jsx

**File**: `frontend/src/components/soc/SOCComponents.test.jsx:8`

- Update mock cho `socApi` (hoặc remove nếu component đã chuyển sang adapter mới)

**Verify**:
- [ ] `npx jest frontend/src/components/soc/SOCComponents.test.jsx` — pass

---

## P3: SaaS Fix — Config Editor Clear/Reset Bug

### Bước 3a — Fix `||` fallback

**File**: `packages/web/src/components/soc/SocVnbrokerPanel.tsx:68`

```
Before:
  value: editConfig || JSON.stringify(config || {}, null, 2),

After:
  value: editConfig,
```

Và khởi tạo `editConfig` sau `fetchData()` thành công:
```typescript
setEditConfig(JSON.stringify(cfg || {}, null, 2));
```

**Verify**:
- [ ] User có thể clear toàn bộ editor (set empty string)
- [ ] User có thể nhập JSON hợp lệ, preview hoạt động
- [ ] `npx tsc --noEmit` pass
- [ ] `npm run build` (tại packages/web) pass

### Bước 3b — Server-side preview validation (enhancement)

**File**: `packages/web/src/components/soc/SocVnbrokerPanel.tsx:handlePreview`

Hiện tại `handlePreview` chỉ làm client-side diff. Sửa gọi `previewSocVnbrokerConfig` (endpoint có sẵn trong adapter) để lấy server-side validation.

**Verify**:
- [ ] Preview modal hiển thị server validation response (không chỉ client diff)
- [ ] `npx tsc --noEmit` pass

---

## P4: Legacy→SaaS Bridge Adapter (approach C — optional)

Nếu muốn tái dùng adapter thay vì restore `socApi.js`:

### Bước 4a — Tạo bridge file

**File mới**: `frontend/src/api/socApi.js`

```javascript
// Bridge adapter: delegates to packages/web SaaS adapter
import { defaultCoreApiAdapter } from '@vninvest/web/adapters/core/adapter';

// Cast to legacy shape
const adapter = defaultCoreApiAdapter;

export const socApi = {
  getVnbrokerConfig: (...args) => adapter.getVnbrokerConfig(...args),
  getVnbrokerHealth: (...args) => adapter.getSocVnbrokerHealth(...args),
  // ... map all 16 methods
};
```

**Verify**:
- [ ] Legacy SOC components hoạt động qua bridge
- [ ] API calls gọi đúng `/core/v1/operator/soc/vnbroker/*`
- [ ] `npm run build` pass

---

## Timeline

| Priority | Bước | Thời gian | Phụ thuộc |
|---|---|---|---|
| **P0** | 0a — Restore `socApi.js` | ⏱ 5 phút | — |
| **P0** | 0b — Trim dead endpoints | ⏱ 15 phút | 0a |
| **P1** | 1a — Verify import path | ⏱ 15 phút | — |
| **P1** | 1b — Sửa route | ⏱ 5 phút | 1a |
| **P2** | 2a — Remove dead code | ⏱ 10 phút | 0a |
| **P2** | 2b — Fix SOCPage.test.jsx | ⏱ 15 phút | 2a |
| **P2** | 2c — Fix SOCComponents.test.jsx | ⏱ 10 phút | 0a |
| **P3** | 3a — Fix config editor clear | ⏱ 10 phút | — |
| **P3** | 3b — Server-side preview | ⏱ 20 phút | — |
| **P4** | 4a — Bridge adapter | ⏱ 30 phút | — |

**Total**: ~2h cho P0-P2 (critical path), ~3h full scope.

---

## Rollback Plan

| Thay đổi | Rollback |
|---|---|
| Restore `socApi.js` | `git restore frontend/src/api/socApi.js` (xoá file) |
| Route redirect | Revert dòng `App.jsx:339` về `<SOCPage />` |
| Config editor fix | Revert dòng `SocVnbrokerPanel.tsx:68` về `||` fallback |
| Bridge adapter | Xoá `frontend/src/api/socApi.js` |

---

## Build Verification

Sau mỗi sub-step:

```bash
# Legacy path
cd frontend && npm run build

# SaaS path (nếu có thay đổi)
cd packages/web && npx tsc --noEmit && npm run build

# Root workspace
npx tsc --noEmit
```

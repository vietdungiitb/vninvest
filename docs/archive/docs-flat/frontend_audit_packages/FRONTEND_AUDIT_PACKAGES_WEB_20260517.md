# Frontend Audit — `packages/web`
**Ngày:** 2026-05-17  
**Phạm vi:** `packages/web/src/` — Shell pages, adapters, auth runtime, route/navigation catalog  
**Người thực hiện:** Kombai AI

---

## Trạng thái remediation (2026-05-18)

| Mục audit | Trạng thái | Ghi chú triển khai |
|---|---|---|
| 3.1 Factory + static properties chồng nhau (`coreApiAdapter`) | ✅ Đã xử lý | `coreApiAdapter.js` đã tách rõ `createCoreApiAdapter`, `defaultCoreApiAdapter`, singleton alias `coreApiAdapter` |
| 3.2 Thiếu token refresh tự động | ✅ Đã xử lý | Transport đã có single-flight refresh (`/auth/token/refresh/`) + retry 401 một lần |
| 3.3 Coupling localStorage trực tiếp | ✅ Đã xử lý | Adapter hỗ trợ inject `getToken/getRefreshToken/setTokens/clearTokens` |
| 3.4 `features/*` còn trống | ✅ Đã xử lý | Đã dựng skeleton chuẩn `components/hooks/pages/index` cho `community`, `saas`, `vip` |
| 3.5 `pageRegistry` static imports, không code splitting | ✅ Đã xử lý | Chuyển sang `loadComponent` dynamic import + deferred component theo route |
| 3.6 `ShellPageTemplate` imperative render helpers | ✅ Đã xử lý | Đã bổ sung named components (`ShellMetric`, `ShellPanel`,...) và giữ wrappers tương thích ngược |

---

## 1. Kiến trúc tổng thể

```
packages/web/src/
├── adapters/          ← HTTP transport (coreApiAdapter, vipAppAdapter)
├── app/               ← Route & navigation catalog (SSOT)
├── components/        ← Shared shell UI primitives
├── config/            ← Build target config
├── context/           ← Auth runtime, React context, bootstrap
├── features/          ← community / saas / vip (hiện còn trống)
├── pages/             ← Page components (Shell* + core SM-P4 pages)
└── index.js           ← Public exports
```

**Stack:** React 18, ESM-native (`"type": "module"`), không JSX (dùng `createElement`), không transpiler runtime trong package.

---

## 2. Điểm mạnh

| Hạng mục | Nhận xét |
|---|---|
| `coreApiAdapter.js` | Facade đầy đủ — có `X-Request-ID`, auth header, error throwing chuẩn, phân tách `coreGet/corePost/corePatch/coreDelete` |
| `ShellAuthProvider` | Dùng `useSyncExternalStore` đúng chuẩn React 18, tách runtime khỏi React context |
| `routeCatalog` / `pageRegistry` | SSOT rõ ràng, có `buildTargets` + `requiredCapabilities` per route |
| ESM-native | Không dùng CommonJS — đúng hướng cho tree-shaking và modern bundlers |
| Không JSX trong package | Tránh phụ thuộc transpiler, tương thích nhiều host app hơn |
| `createBootstrapClient` | Bootstrap pattern tách biệt, hỗ trợ `fetchImpl` injectable |

---

## 3. Vấn đề & Khuyến nghị

### 3.1 🔴 Anti-pattern: factory function + static properties chồng nhau

**File:** `packages/web/src/adapters/coreApiAdapter.js` (dòng 629–633)

```js
// ❌ Hiện tại
export function coreApiAdapter(options = undefined) {
  return createCoreApiAdapter(options || {});
}
Object.assign(coreApiAdapter, createCoreApiAdapter());
```

Tạo ra hai cách dùng inconsistent:
- `coreApiAdapter.getSymbolSnapshot(...)` — dùng instance mặc định, không có `env`
- `coreApiAdapter({env}).getSymbolSnapshot(...)` — tạo instance mới với `env`

**Khuyến nghị:**
```js
// ✅ Đề xuất
export function createCoreApiAdapter({ env = {}, getToken } = {}) { ... }

// Default singleton dùng localStorage token
export const defaultCoreApiAdapter = createCoreApiAdapter({
  getToken: () => (typeof window !== "undefined" ? window.localStorage?.getItem("access_token") : null),
});
```

---

### 3.2 🔴 Không có token refresh tự động

**File:** `packages/web/src/adapters/coreApiAdapter.js`

Khi `access_token` hết hạn, mọi request sẽ throw `401` mà không retry. Logic refresh token đã có trong `frontend/src/api/client.js` (Axios interceptor) nhưng **chưa được port** sang `packages/web`.

**Khuyến nghị:** Thêm interceptor-style retry vào `createCoreTransport`:
```js
async function coreGet(path, options = {}) {
  let response = await fetchWithAuth(path, options);
  if (response.status === 401) {
    const refreshed = await tryRefreshToken();
    if (refreshed) response = await fetchWithAuth(path, options); // retry once
    else throw new UnauthorizedError();
  }
  // ...
}
```

---

### 3.3 🟡 Auth token lấy trực tiếp từ `window.localStorage`

**File:** `packages/web/src/adapters/coreApiAdapter.js` (dòng 40–45)

```js
// ❌ Hiện tại — coupling với browser storage
function getAuthorizationHeader() {
  const token = window.localStorage?.getItem("access_token");
  ...
}
```

Nếu storage key đổi hoặc cần hỗ trợ SSR/test environment, phải sửa nhiều nơi.

**Khuyến nghị:** Inject `getToken` callback khi tạo adapter:
```js
// ✅ Đề xuất
function createCoreTransport(env = {}, { getToken = () => null } = {}) {
  function getAuthorizationHeader() {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }
  ...
}
```

---

### 3.4 🟡 `features/` còn trống hoàn toàn

**Files:** `packages/web/src/features/community/`, `saas/`, `vip/` — chỉ có `README.md`

Logic feature-specific đang bị viết lẫn vào `pages/` thay vì được tổ chức theo feature slice. Nếu không định nghĩa cấu trúc sớm, code sẽ phình ra khó maintain.

**Khuyến nghị cấu trúc mỗi feature:**
```
features/saas/
├── components/   ← UI components riêng của saas build
├── hooks/        ← Data fetching hooks
├── pages/        ← Page compositions
└── index.js      ← Public exports của feature
```

---

### 3.5 🟡 `pageRegistry` import tất cả pages tĩnh — không có code splitting

**File:** `packages/web/src/pages/pageRegistry.js`

```js
// ❌ Hiện tại — 12+ static imports
import { ShellOperationsCenterPage } from "./admin/ShellOperationsCenterPage.js";
import { ShellAiAdvisoryPage } from "./signals/ShellAiAdvisoryPage.js";
// ...
```

Toàn bộ page bundle được load ngay lập tức, kể cả các trang admin/vip ít dùng.

**Khuyến nghị:**
```js
// ✅ Lazy registry với dynamic import
export const pageRegistry = Object.freeze([
  {
    routeId: "operations-center",
    component: () => import("./admin/ShellOperationsCenterPage.js")
      .then(m => m.ShellOperationsCenterPage),
    status: "baseline",
  },
  // ...
]);
```

---

### 3.6 🟢 `ShellPageTemplate.js` dùng imperative render helpers

**File:** `packages/web/src/components/ShellPageTemplate.js`

```js
// Khó test, khó type-safe
renderShellMetric(...), renderShellPanel(...) // trả về ReactElement trực tiếp
```

**Khuyến nghị:** Chuyển sang named React components:
```js
// ✅ Đề xuất
export function ShellMetric({ label, value, delta }) { ... }
export function ShellPanel({ title, children }) { ... }
```

---

## 4. Ma trận ưu tiên

| # | Việc | File | Mức độ | Effort |
|---|---|---|---|---|
| 1 | Tách `defaultCoreApiAdapter` khỏi factory anti-pattern | `adapters/coreApiAdapter.js` | 🔴 Cao | Thấp |
| 2 | Port token refresh / 401 retry từ `frontend` | `adapters/coreApiAdapter.js` | 🔴 Cao | Vừa |
| 3 | Inject `getToken` callback — bỏ localStorage coupling | `adapters/coreApiAdapter.js` | 🟡 Vừa | Thấp |
| 4 | Lazy import trong `pageRegistry` | `pages/pageRegistry.js` | 🟡 Vừa | Thấp |
| 5 | Định nghĩa cấu trúc `features/saas`, `features/vip` | `src/features/` | 🟡 Vừa | Thấp |
| 6 | Chuyển `ShellPageTemplate` helpers sang React components | `components/ShellPageTemplate.js` | 🟢 Thấp | Vừa |

---

## 5. Hard constraints cần nhớ

Theo `AGENTS.md` section 13 (Global Alert Center) và section 8 (SaaS Migration):

- Tất cả API calls từ `packages/web` **phải** đi qua `coreApiAdapter.js` — không direct fetch.
- `packages/web` **không được** tạo adapter song song ngoài `coreApiAdapter`.
- Text mới trong `packages/web` **phải** qua i18n tiếng Việt đầy đủ dấu.
- Browser-side synthesis cho `price_shock`, `stale_quote` là **cấm** — client chỉ render server truth.

---

*File này được tạo tự động bởi Kombai AI — 2026-05-17*

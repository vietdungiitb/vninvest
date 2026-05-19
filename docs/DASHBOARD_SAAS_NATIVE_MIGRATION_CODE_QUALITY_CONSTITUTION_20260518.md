# CODE QUALITY CONSTITUTION — Dashboard SaaS Native Migration

**Ngày**: 2026-05-18  
**Scope**: Hard rules chất lượng code áp dụng cho toàn bộ workstream DM-00 → DM-07

---

## 1. Hard Rules (blocking — vi phạm = không merge)

### 1.1 API & Data Layer

| # | Rule | Rationale |
|---|------|-----------|
| CQ-01 | `packages/web/src/` **không được import `apiClient`** từ `frontend/src/api/client.js` | coreApiAdapter là SSOT duy nhất cho packages/web |
| CQ-02 | `packages/web/src/` **không được import trực tiếp** từ `frontend/src/components/` hoặc `frontend/src/pages/` | packages/web phải độc lập với legacy frontend |
| CQ-03 | **`legacyApiGet()`** trong coreApiAdapter phải là private (không export) | Không tạo public surface cho legacy paths |
| CQ-04 | **Không gọi API trực tiếp** bằng `fetch()` hay `axios()` trong components/hooks của `packages/web/` — phải qua `coreApiAdapter` | Đảm bảo auth và error handling nhất quán |

### 1.2 React & Component Patterns

| # | Rule | Rationale |
|---|------|-----------|
| CQ-05 | **Không JSX** trong `packages/web/src/pages/`, `packages/web/src/features/`, `packages/web/src/components/` | Convention packages/web |
| CQ-06 | **`useEffect` với async fetch phải dùng `AbortController`** và check `signal.aborted` trước mọi `setState` | Tránh memory leak và stale state sau unmount |
| CQ-07 | **Immutable sources** (`WhaleBubbleChart`, `ModularPositionDeck`, `WhaleAnalyticsTab`) **không được modify** trong bất kỳ slice nào | AGENTS.md §3 constraint 4 |
| CQ-08 | **Slot render props** phải nhận một data object, không nhận store/context trực tiếp | Decoupling giữa DashboardPage và legacy context |

### 1.3 i18n

| # | Rule | Rationale |
|---|------|-----------|
| CQ-09 | **Text mới trong `frontend/src/`** (components, pages) phải qua `t()` với key trong `vi.js` và `en.js` | AGENTS.md §3 constraint 8 |
| CQ-10 | **Text trong `packages/web/src/`** — hardcode tiếng Việt có dấu đúng chuẩn (không có i18n context từ frontend/src/) | Convention packages/web |
| CQ-11 | **Không hardcode tiếng Anh thuần** trong UI-visible strings của bất kỳ file nào | UX consistency cho user Việt Nam |

### 1.4 Security

| # | Rule | Rationale |
|---|------|-----------|
| CQ-12 | **Không log request body** trong bất kỳ transport helper nào của coreApiAdapter | Sensitive data protection |
| CQ-13 | **portfolioId phải là số nguyên dương** hoặc string numeric trước khi gọi API — validate trước khi `encodeURIComponent` | Prevent path traversal |
| CQ-14 | **Không catch và bỏ qua `except Exception: pass`** pattern hay JavaScript `catch (e) {}` empty trong API paths | Lỗi phải được propagate lên UI |

### 1.5 Code Hygiene

| # | Rule | Rationale |
|---|------|-----------|
| CQ-15 | **Không để dead imports** sau mỗi slice — xóa ngay nếu không dùng | Build size và readability |
| CQ-16 | **Không dùng `console.log` production code** trong files mới — chỉ `console.error` cho genuinely unexpected errors | Noise reduction |
| CQ-17 | **`module_tree_full.md` phải được regenerate** sau khi tạo file mới (DM-02, DM-04, DM-07) | AGENTS.md §3 operating discipline |
| CQ-18 | **`CODE_CHANGE_AUDIT_LEDGER.md` phải cập nhật** sau mỗi slice đã done | Governance requirement |

---

## 2. Quy tắc cho coreApiAdapter (DM-01 specific)

```js
// ✅ ĐÚNG — Thêm vào factory return object
getPortfolioHoldings(portfolioId) {
  if (!portfolioId) throw new Error("portfolioId is required for getPortfolioHoldings");
  return coreGet(`/portfolio/portfolios/${encodeURIComponent(portfolioId)}/holdings/`);
},

// ❌ SAI — Direct fetch
async getPortfolioHoldings(portfolioId) {
  const resp = await fetch(`/api/portfolio/portfolios/${portfolioId}/holdings/`);
  return resp.json();
},

// ❌ SAI — Export legacyApiGet
export function legacyApiGet(path) { ... }  // KHÔNG export

// ❌ SAI — Log body
console.log("Request to", url, "body:", JSON.stringify(body));

// ✅ ĐÚNG — Validate portfolioId
if (!portfolioId || typeof portfolioId !== 'string' && typeof portfolioId !== 'number') {
  throw new Error("portfolioId must be a non-empty string or number");
}
```

---

## 3. Quy tắc cho useCoreDashboardData (DM-02 specific)

```js
// ✅ ĐÚNG — AbortController pattern
useEffect(() => {
  if (!portfolioId) return;
  const controller = new AbortController();
  const mountedRef = { current: true };
  
  async function load() {
    try {
      // ... fetch
      if (controller.signal.aborted || !mountedRef.current) return;
      setState(/* ... */);
    } catch (err) {
      if (controller.signal.aborted) return;
      // handle error
    }
  }
  
  load();
  return () => {
    controller.abort();
    mountedRef.current = false;
  };
}, [portfolioId, refreshToken]);

// ❌ SAI — Không cleanup
useEffect(() => {
  fetch('/api/portfolio/portfolios/1/holdings/')
    .then(r => r.json())
    .then(data => setState(data));  // có thể set state sau unmount!
}, []);

// ❌ SAI — Import apiClient
import { apiClient } from '../../frontend/src/api/client';  // FORBIDDEN
```

---

## 4. Quy tắc cho DashboardPage.js (DM-03 specific)

```js
// ✅ ĐÚNG — createElement pattern
import { createElement, useState } from "react";
const e = createElement;

export function DashboardPage({ renderStatsHeader = null, portfolioId = null, env = {} }) {
  return e("div", { className: "core-dashboard-page" },
    e("section", { className: "core-dashboard__stats" },
      renderStatsHeader
        ? renderStatsHeader({ summary, holdings, loading })
        : e(BuiltinStatsHeader, { summary, loading })
    )
  );
}

// ❌ SAI — JSX syntax
export function DashboardPage() {
  return (
    <div className="core-dashboard-page">  {/* JSX trong packages/web — FORBIDDEN */}
      ...
    </div>
  );
}

// ❌ SAI — Import từ frontend/src
import SmartStatsHeader from '../../../frontend/src/components/modern/SmartStatsHeader';  // FORBIDDEN
```

---

## 5. Quy tắc cho PackageDashboardHost (DM-04 specific)

```jsx
// ✅ ĐÚNG
import { DashboardPage } from '@vninvest/web';  // qua npm package alias

// ❌ SAI — Direct path import
import { DashboardPage } from '../../../packages/web/src/pages/DashboardPage.js';  // FORBIDDEN

// ✅ ĐÚNG — portfolioId từ context
const { portfolioId } = usePortfolio();

// ❌ SAI — portfolioId hardcoded
<DashboardPage portfolioId={1} />  // FORBIDDEN

// ✅ ĐÚNG — i18n cho text mới
<div>{t('dashboard.noDataMessage')}</div>

// ❌ SAI — Hardcode text tiếng Việt trong frontend/src
<div>Không có dữ liệu</div>  // FORBIDDEN nếu là text mới
```

---

## 6. Pull Request Gates

Trước khi merge bất kỳ PR nào trong workstream này, reviewer phải verify:

- [ ] Tất cả CQ rules từ 01–18 PASS
- [ ] Không có code mới vi phạm hard rules AGENTS.md §9 (SaaS Full Independence)
- [ ] `npm run build` exit 0 trong CI
- [ ] Không có console.log mới trong API/data layer
- [ ] Text mới đã qua i18n check
- [ ] Không còn references đến decommissioned code (sau DM-07)

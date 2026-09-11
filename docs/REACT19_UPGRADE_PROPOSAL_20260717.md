# Nghiên Cứu: Nâng Cấp Lên React 19

**Phạm vi:** `packages/web` tại `C:\Mujoco Projects\vninvest`
**Ngày:** 2026-07-17
**Phương pháp:** grep/read trên source thật + peerDep trong `node_modules`
**Mục đích:** Đề xuất phương án nâng cấp dự án từ React 18.3.1 lên React 19+ (host web app).

---

## A. Bản Đồ Kiến Trúc (Phụ Thuộc Trọng Yếu)

| Package | Hiện tại | Peer React 19? | Hành động |
|---------|----------|---------------|-----------|
| `react` / `react-dom` | `^18.3.1` | — (target) | → `^19.0.0` |
| `@types/react` / `@types/react-dom` | `^18.3.1` | ❌ | → `^19` (bắt buộc để hết type error) |
| `react-test-renderer` | `^18.3.1` | ❌ | **XÓA** (chỉ có React 18) |
| `recharts` | `^2.12.7` (installed 2.15.4) | ✅ peer `^16 \|\| ^17 \|\| ^18 \|\| ^19` | Không đổi |
| `react-router-dom` | `^6.30.3` | ✅ `>=16.8` | Không đổi |
| `@testing-library/react` | `^16.3.2` | ✅ React 19 | Không đổi |
| `@vitejs/plugin-react` | `^5.0.0` | ✅ | Không đổi |
| Tất cả `@radix-ui/react-*` (16 pkgs) | `^1.x / ^2.x` | ✅ R19-compatible | Không đổi |
| `@headlessui/react` | `^2.1.1` | ✅ `^18 \|\| ^19` | Không đổi |
| `@tanstack/react-query` / `-table` | `^5.101.2` / `^8.21.3` | ✅ | Không đổi |
| `echarts-for-react` | `^3.0.6` | ✅ `>=16` | Không đổi |
| `lucide-react` | `^0.544.0` | ✅ `^19` | Không đổi |
| `react-hook-form` | `^7.81.0` | ✅ `^19` | Không đổi |
| `@casl/react` | `^5.0.1` | ✅ `^19` | Không đổi |
| `simplebar-react` | `^3.3.2` | ✅ `>=16.8` | Không đổi |
| `@heroicons/react` | `^2.1.3` | ✅ `>=16 \|\| ^19` | Không đổi |
| `@iconify/react` | `^6.0.1` | ✅ `>=16` | Không đổi |
| `@marsidev/react-turnstile` | `^1.5.2` | ✅ `^19` | Không đổi |

---

## B. Ranh Giới External: `vninvestcharts-widget` (NGUYÊN NHÂN GỐC)

`packages/web/node_modules/vninvestcharts-widget/package.json:14`:
```json
"peerDependencies": {
  "@monaco-editor/react": "^4.7.0",
  "monaco-editor": "^0.55.1",
  "peggy": "^5.1.0",
  "react": "^19.0.0",
  "react-dom": "^19.0.0"
}
```

→ Đúng như AGENTS.md ghi nhận. App hiện dùng React 18 → buộc phải lazy-load widget
(`VNStockChartPanel.js`) để tránh TDZ (`Cannot access 'N' before initialization`).
**Khi app lên React 19, conflict peerDep biến mất**, workaround lazy-load có thể hoàn tác
về static import (tùy chọn, không bắt buộc). Widget đã khai báo `@types/react@^19.2.14`
trong devDeps → xác nhận ecosystem target là React 19.

---

## C. Source-code Breaking-Pattern Scan (`packages/web/src`)

| Pattern bị xóa ở R19 | Kết quả | file:line |
|----------------------|---------|-----------|
| `ReactDOM.render` / `ReactDOM.hydrate` | **0 hit** | — |
| `findDOMNode` | **0 hit** | — |
| `UNSAFE_` lifecycle methods | **0 hit** | — |
| `defaultProps` trên function component | **0 hit** | — |
| `propTypes` | **0 hit** | — |
| Legacy context (`contextTypes`/`childContextTypes`) | **0 hit** | — |
| `React.createFactory` | **0 hit** | — |
| String refs (`ref="..."`) | **0 hit** (các hit `href=` là `<a>` false positive) | — |

- **Bootstrap:** `src/main.tsx:2` `import { createRoot } from 'react-dom/client'` +
  `src/main.tsx:128` `createRoot(container)` → **đã dùng API hiện đại, sẵn sàng R19**.
- `src/main.js` tồn tại nhưng là **dead duplicate** (`index.html:10` chỉ引用 `main.tsx`).
  Nên xóa khi dọn dẹp.
- **`React.FC`:** 1 hit `WatchlistContext.tsx:59` nhưng đã khai báo tường minh
  `children: ReactNode` → không bị ảnh hưởng bởi thay đổi "R19 bỏ implicit children của `React.FC`".
- **`react-test-renderer`:** 1 hit `AuthPages.test.js:8` `import("react-test-renderer")`
  dùng `create(...)` → **đây là 1 thay đổi code bắt buộc** (đổi sang `@testing-library/react`).
- Tất cả `useRef`/`forwardRef`/`createRef` (100+ hit) dùng API hiện đại → R19-compatible.
- App **không** khai báo `StrictMode` trong source → không lo double-invoke assumption.

---

## D. CONTRADICTIONS (AGENTS.md vs thực tế)

| Plan/Assumption (AGENTS.md) | Thực tế (code) | Tác động |
|------------------------------|----------------|----------|
| "Giữ React 18 để tránh recharts v3 migration (sẽ ép recharts v3 rủi ro)" | `recharts@2.15.4` đã peer `^16 \|\| ^17 \|\| ^18 \|\| ^19` — **không cần lên v3** | Lý do giữ R18 trong AGENTS.md **ĐÃ LỖI THỜI**; có thể lên R19 an toàn mà GIỮ recharts v2 |
| "Widget lazy-load (Option B) là giải pháp cố định" | Lazy-load chỉ là workaround TDZ do mismatch peerDep | Sau khi lên R19, hoàn tác về static import là optional (không bắt buộc) |

---

## E. Findings

| ID | Sev | file:line | Thực tế | Tác động | Đề xuất |
|----|-----|-----------|---------|----------|---------|
| F1 | HIGH (blocker) | `packages/web/package.json` (`@types/react` `^18.3.1`, `@types/react-dom` `^18.3.1`) | Types v18 không khớp React 19 | Type error sau upgrade | Nâng → `^19` |
| F2 | HIGH (blocker) | `src/pages/auth/AuthPages.test.js:8` + `package.json` `react-test-renderer@18.3.1` | Thư viện chỉ có R18, không thuộc R19 | Test gãy / install lỗi | Xóa dep + đổi test sang `@testing-library/react` (đã có sẵn `^16.3.2`) |
| F3 | HIGH | `node_modules/vninvestcharts-widget/package.json:14` | peerDep `react ^19.0.0` | Chính là lý do app kẹt R18 | Thỏa mãn bằng cách upgrade host lên R19 |
| F4 | MED | `src/features/watchlist/components/WatchlistContext.tsx:59` | `React.FC` có `children` khai báo tường minh | R19 type thay đổi không ảnh hưởng | Không đổi |
| F5 | LOW | `src/main.js` | dead duplicate entry, flag router khác biệt (`v7_startTransition`) | Drift / gây rối | Xóa khi cleanup |
| F6 | INFO | `src/components/VNStockChartPanel.js` (dynamic `import()`) | lazy-load widget do TDZ | Sau R19 có thể static import | Optional, hoàn tác nếu muốn |

**Không có blocker về source runtime** — app đã viết bằng idiom R19-compatible
(functional components + hooks + `createRoot`).

---

## F. Đề Xuất Phương Án (Upgrade Sequence)

1. **Bước 1 — Dep upgrade (bắt buộc):**
   - `react` + `react-dom` → `^19.0.0`
   - `@types/react` + `@types/react-dom` → `^19`
   - Xóa `react-test-renderer` khỏi devDependencies
2. **Bước 2 — Fix test (F2):** `AuthPages.test.js:8` đổi
   `import("react-test-renderer")` + `create(...)` → dùng `render()` từ
   `@testing-library/react` (đã có `^16.3.2`, R19-ready).
3. **Bước 3 — Quality gates:** `npm run lint` → `npm run build` (tsc && vite) →
   `npm run test` → `npm run test:components`. Friction type có khả năng nhất:
   `@types/react@19` strict hơn (Ref/forwardRef, children) — đã scan thấy chỉ 1 `FC`
   và đã an toàn (F4).
4. **Bước 4 — Optional hoàn tác widget:** Sau B1, `VNStockChartPanel.js` có thể chuyển
   từ dynamic `import()` về static import (xóa async chunk split, đơn giản hóa).
   Giữ nguyên lazy-load cũng được — vẫn chạy tốt trên R19.
5. **Bước 5 — Cleanup:** Xóa `src/main.js` dead duplicate.
6. **Cập nhật AGENTS.md:** Sửa ghi chú "React 18 để tránh recharts v3" → recharts v2.15
   đã R19-compatible; ghi nhận quyết định lên R19 thay thế Option B.

**Rủi ro tổng thể: THẤP.** Không có breaking API trong source. Chỉ 2 blocker dễ sửa
(types + 1 file test). recharts GIỮ NGUYÊN v2 — không cần migration v3 như lo ngại cũ.

---

## G. Đánh Giá Tổng Thể

**Có thể implement được, ưu tiên CAO nếu muốn đóng hẳn TDZ workaround và đồng bộ với
`vninvestcharts-widget`.** Blocker duy nhất thực sự là `@types/react` + `react-test-renderer`
(+ 1 test file). Ước tính effort: ~0.5–1 ngày (chủ yếu chạy build/test sửa type).
**Không cần refactor component nào.**

---

## H. Câu Hỏi Cần Làm Rõ

1. Có muốn **hoàn tác lazy-load widget về static import** (Bước 4) sau khi lên R19,
   hay giữ nguyên để giữ chunk tách biệt?
2. Có đồng ý **xóa `src/main.js`** (dead file) không?
3. Có cần giữ `react-test-renderer` cho test khác không (hiện chỉ 1 file dùng) —
   hay chuyển hẳn sang `@testing-library/react`?

---

## I. Quality Gates (trước/sau upgrade)

| Gate | Trước upgrade | Sau upgrade (dự kiến) |
|------|---------------|----------------------|
| `npm run build` (tsc && vite) | ✅ PASS | ✅ PASS (sau B1-B2) |
| `npx tsc --noEmit` | ✅ 0 errors | ⚠️ cần sửa type do `@types/react@19` |
| `npm run lint` | ✅ 0 new errors | ✅ không đổi |
| `npm run test` | ⚠️ có `react-test-renderer` | ✅ sau đổi sang RTL |
| `npm run test:components` | ✅ | ✅ |

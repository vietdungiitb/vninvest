# Sidebar brand h1 fix — test

- **Lệnh**: từ `packages/web`, `node node_modules/vitest/vitest.mjs run src/layouts/full/vertical/sidebar/__tests__/sidebar-heading.component.test.tsx`
- **Kết quả**: exit 0, `Test Files 1 passed`, `Tests 2 passed`.
- Control dương: detector bắt `e('h1')` và `<h1>` — không phải tautology.
- Control âm: `Sidebar.tsx` (đã strip comment) không còn literal `'h1'`/`<h1`.

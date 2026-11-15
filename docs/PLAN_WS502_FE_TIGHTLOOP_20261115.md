# PLAN — Fix FE tight-loop gọi bulk liên tục gây WS 502 (2026-11-15)

- **Date**: 2026-11-15. **Claim sau**: `ws-502-fe-tightloop`. **Lessons áp dụng**: [L-002 L-V01 L-V02 L-V03 L-V04 L-G02 L-T01 L-T02]
- **Root cause (có bằng chứng log)**: `WatchlistContext.tsx:482-485` dùng `useEffect([activeItems])` → mỗi khi `activeItems` đổi gọi `fetchTechnicals` → `Promise.all(chunks.map(getBulkTechnicalsBySymbols))` bắn **10 chunk đồng thời**; cùng `useCoreDashboardData.js:204` gọi bulk mỗi khi mount. Log staging: **10 POST bulk mỗi 13-45 giây liên tục** (26:07:10, 26:07:23, 26:08:08), đều 200 ~216KB → event loop daphne bị đói liên tục → WS handshake 502 liên tục. S4 (2 daphne) + S5 (concurrency 2) giảm chứ không triệt để vì FE vẫn gọi liên tục.
- **Phương án (FE-only, smallest change)**:
  - S1: Thêm **debounce 30s** vào `fetchTechnicals` (WatchlistContext) — cùng symbols gọi lại trong 30s bị bỏ; symbols khác → cho phép.
  - S2: Thêm **debounce 30s** vào bulk call trong `useCoreDashboardData.js` — cùng nguyên lý.
  - S3 (guard): Chỉ gọi bulk khi `document.visibilityState === 'visible'` (tab không bị ẩn) — tránh gọi khi user chuyển tab.
  - Không đổi contract/shape/envelope; không FE UI mới; không migration; không package.json.
- **AC (Given/When/Then)**:
  - AC1: Gọi `fetchTechnicals` cùng symbols 2 lần cách nhau <30s → `fetch` bulk đúng 1 lần.
  - AC2: Gọi cùng symbols cách nhau >30s → fetch 2 lần (không chặn dữ liệu mới).
  - AC3 (live staging): sau khi user reload dashboard, bulk POST **không còn 10 phát/giây liên tục** — tối đa 1-2 phát, cách nhau ≥30s; 502 mới ≈ 0 trong cửa sổ reload.
- **Fail-before**: test mới `test_bulk_debounce.tsx` (hoặc thêm vào test hiện có) chạy trên code chưa sửa → 2 fetch cùng symbols (đỏ đúng lý do); sau fix → 1 fetch.
- **Gates**: jest file `coreApiAdapter.test.js` + WatchlistContext test + dashboard lifecycle test; `tsc` 0; eslint 0 errors; check-multi-agent PASS; check-lessons 60/60; deploy staging + verify live AC3.
- **Rollback**: revert 1 commit (2 file FE + test). Cache key `v1` đã có để xoay.
- **Files**: 2 FE + 1 test + plan + ledger. **Next**: merge -> deploy -> user reload -> dem POST/502 -> Entry 516.

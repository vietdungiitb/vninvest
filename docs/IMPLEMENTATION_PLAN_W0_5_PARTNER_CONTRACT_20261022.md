# IMPLEMENTATION PLAN — W0.5 PARTNER CONTRACT (gate tự phát hiện path 404)

**Agent:** `w0-5-partner-contract` · **Branch:** `feat/w0-5-partner-contract` -> `dev`
**Base:** `origin/dev` @ `c204928d7` · **Worktree:** `C:\Mujoco Projects\agent-w0-5`
**Nguồn:** `docs/ROADMAP_MASTER_2026Q4_2027.md` §4.2 **W0.5** — "đưa ~17 endpoint `/partner/*` gọi thẳng từ page về `adapters/core/operator.js`" + "mở rộng `route-contract.test.js` để quét cả page"
**Lessons áp dụng:** L-001 L-002 L-003 L-007 L-008 L-M02 L-M05 L-M08 L-V01 L-V02 L-V04 L-G01 L-G02 L-G04 L-G05 L-G07 L-G08 L-T01 L-T02 L-A01
**Skill:** `multi-agent-workflow` (8 stage) · `tdd-workflow` (RED → GREEN) · `verification-loop` · `project-lessons`

---

## 0. Đính chính: audit trước đã BÁO SAI 2 "lỗi path"

Roadmap §4.2 W0.5 nói: *"2 cặp lệch số ít/số nhiều — `/partner/usage/alert-config/` (adapter `:69`) vs `alert-configs/` (page) và `/partner/usage/trend/` vs `trends/`"*.

**Đọc code thật ⇒ KHÔNG phải lỗi.** Cả 3 chuỗi đó nằm ở **`useTenantAdminQuery` — tham số cache key**, KHÔNG phải URL gọi:
- `pages/tenant-admin/TenantAdminUsagePage.tsx:185` `"/partner/usage/trends/"` → cache key; URL thật = `adapter.getAllUsageTrends(historyDays)` → `/partner/usage/trend/` ✓
- `pages/tenant-admin/TenantAdminUsagePage.tsx:224` `"/partner/usage/alert-configs/"` → cache key; URL thật = `adapter.getAlertConfigs()` → `/partner/usage/alert-config/` ✓
- `pages/tenant-admin/TenantAdminUsagePage.tsx:211` `"/partner/usage/analytics/"` → cache key; URL thật = `adapter.getApiUsageAnalytics()` → `/partner/usage/api-calls/?group_by=…` ✓

⇒ **SSOT = manifest sinh từ resolver thật** (`src/adapters/core/__tests__/core-route-manifest.json`, 612 route) — không đoán bằng mắt.

## 1. Vấn đề thật: gate contract **chỉ quét adapter**, không quét page

`packages/web/src/adapters/core/__tests__/route-contract.test.js:23` `ADAPTER_DIR = path.resolve(HERE, "..")` ⇒ chỉ `src/adapters/core/*.js`. Mọi lời gọi `coreGet/corePost/...` **trong `src/pages/**` và `src/context/**`** nằm **ngoài tầm gate** ⇒ một path sai trong page chỉ lộ ra khi user bấm (404 im lặng).

## 2. Scope (2 phần + 1 phần coordinator)

### S1 — Mở rộng gate contract quét **cả page + context** (TDD: RED tự chỉ ra path 404)
- **File:** `packages/web/src/adapters/core/__tests__/route-contract.test.js`
- **Sửa:** thay `collectAdapterCalls()` bằng bộ quét **đệ quy** trên 3 thư mục: `src/adapters/core` · `src/pages` · `src/context` (bỏ qua `*.test.*` / `*.spec.*` / `__tests__`). Giữ nguyên `toResolvablePath` + `toRegExp` + manifest (SSOT).
- **AC:** (1) test "finds calls to check" vẫn > 300 (chống quét rỗng) (2) **RED**: gate **tự liệt kê** path nào không resolve (3) sau khi sửa path ⇒ **GREEN**
- **Non-goal:** KHÔNG đưa mọi lời gọi về adapter (làm W0.5b, nhiều file) — slice này làm **gate + sửa path sai**, đủ để chặn 404.

### S2 — Sửa path thật bị 404 (do RED chỉ ra, không đoán)
Danh sách chính xác lấy từ output RED + đối chiếu manifest (không hardcode từ trí nhớ).

### S3 — W0.3: sửa `exports` 10/10 trỏ file `.ts` không tồn tại (coordinator)
- **File:** `packages/web/package.json:36-48` — ⚠ **DENY-LIST** ⇒ chỉ **coordinator** được commit, tách hunk riêng.
- **Sự thật đã verify**: 10/10 entry trỏ `.ts` (không tồn tại); file thật là `.js` (đã verify đủ 10 bằng script `require.resolve`).
- **AC:** `node -e` resolve từng entry export ⇒ 0 lỗi.

## 3. Cổng chất lượng (Stage 6)

| Gate | Nơi chạy |
|---|---|
| **`npm run test`** (jest — chứa route-contract) | **VPS staging** (runbook §12.4) — **KHÔNG local** (§12.1 cấm `npm run test*` local) |
| `npm run test:components` (vitest) | VPS staging |
| `npm run build` · `npm run lint` | VPS staging (§12.1: build RAM-heavy, cấm local) |
| `npx tsc --noEmit` | local (§12.2 cho phép) |
| `pre-push-gate` · `check-experiment-env` · `check-lessons` · `check-multi-agent` | local (§12.2) |

**Dọn sau thử nghiệm:** worktree VPS **remove** + prune · `node_modules` VPS **xoá** nếu lock đổi · `docker ps` xác nhận **không còn container thử nghiệm**.

## 4. Rủi ro

| Rủi ro | Giảm thiểu |
|---|---|
| Quét `src/pages/**` bắt nhầm **cache key** (chuỗi `/partner/…` không nằm trong lời gọi) | Chỉ quét chuỗi **bên trong** `coreGet/corePost/corePut/corePatch/coreDelete(...)` ⇒ cache key không bị quét |
| File `.tsx`/`.ts` cần transform | Test hiện là `.js` (jest+babel) — thêm `.jsx/.ts/.tsx` cần `extensionsToTreatAsEsm`; **giải pháp: quét bằng regex trên NGUYEN VAN BAN** (không import) ⇒ không cần transform |
| Manifest cũ ⇒ gate báo path đúng là sai | Manifest **sinh từ resolver thật** (`packages/core/backend/scripts/dump-core-route-manifest.py`) ⇒ SSOT; nếu BE đổi thì regenerate (ghi trong plan) |
| Sửa path làm FE gọi nhầm endpoint khác | Đối chiếu **từng** path với manifest + đọc context BE route; không đoán |

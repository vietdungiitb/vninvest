# HANDOFF — Sidebar SPA navigation (bỏ reload cả trang khi bấm menu)

> **Ngày:** 2026-11-12 · **Phạm vi:** `packages/web` — menu sidebar dùng SPA navigate thay vì `<a href>` reload cả trang
> **Nhánh:** `feat/sidebar-spa-nav` → `dev` (PR #360, merged `d584d9a4a`) · closeout `feat/sidebar-closeout` (file này)
> **Worktree:** `D:/Mujoco Projects/vninvest-wt-sidebar-closeout` (worktree riêng — rút kinh nghiệm vụ làm thẳng trên worktree chính ở slice này)

## 1. Trạng thái

| Item | Trạng thái | Evidence |
|---|---|---|
| Fix reload menu | **done** — merged PR #360 | merge `d584d9a4a`, parents `2ceffecf0` + `49168bb88`; diff 4 file đúng scope |
| Test | **done** — 4/4 xanh (TDD fail-before T1+T2 ĐỎ) | `packages/web/src/layouts/full/vertical/sidebar/__tests__/sidebar-spa-nav.component.test.tsx` |
| Claim `sidebar-spa-nav` | **done** | `docs/CLAIMS.md` |
| Ledger | **Entry 470** appended | `docs/CODE_CHANGE_AUDIT_LEDGER.md:1` |
| Restyle fallback boot clock-only | **chưa làm** (ngoài scope, đề xuất của user để dành slice riêng) | — |

## 2. Root cause + kết quả (evidence `file:line`, không suy diễn)

- **Bệnh:** bấm menu = full page reload = app remount = bootstrap chạy lại = full-screen `shellFallback.verifyingAccount` (`main.tsx:88-96`, `vi/shellFallback.js:7`) trên MỖI lần chuyển trang + mất state client.
- **Nguyên nhân:** menu item render `e('a', { href: item.path, onClick: () => onMobileClose() })` (`Sidebar.tsx:160-182`) — không `preventDefault`, không `navigate()`. Provider nằm NGOÀI Routes (`main.tsx:279-293`) nên SPA nav không remount — chỉ reload mới gây ra.
- **Fix:** onClick → early-return khi modifier-click/middle-click (giữ mở-tab-mới) + `preventDefault` + `navigate(item.path)` + guard cùng-path; giữ `href` (`Sidebar.tsx:163-184`, test T1-T4).
- **B8:** NEED_REVISION (1 BLOCKER modifier-click + T1/T2 xanh giả) → đã sửa + **mutation check chạy thật** (xóa guard → T4 ĐỎ).
- **Gates chạy thật:** vitest 4/4 + subset 18/18 · `tsc` 0 · `eslint` 0 · `npm run build` PASS 27s · `check-multi-agent` 0 lỗi · `check-ledger-entry` **FAIL do trùng Entry 386 PRE-EXISTING trên `origin/dev`** (PR #353; Entry 470 xuất hiện 1 lần).
- **CHƯA CHẠY:** full vitest 181 file · E2E trình duyệt thật (click menu + xác nhận không reload).

## 3. Sự cố quy trình trong phiên (bài học)

1. **Làm thẳng trên worktree chính** dù đã tách branch riêng → move HEAD của session khác + dính vào edit chưa commit của họ (`docs/CODE_CHANGE_AUDIT_LEDGER.md` 1 dòng Entry 469). Đã khôi phục: không đụng file đó; nhánh local đã xóa; worktree chính để nguyên cho session kia tự xử lý.
2. **Quy tắc từ nay:** mọi thay đổi code làm trong **worktree riêng** (`git worktree add <path> -b feat/<slice> origin/dev`) — đúng TẦNG 2 multi-agent — kể cả khi tin rằng "chỉ 1 file, branch riêng là đủ". Branch riêng KHÔNG thay thế worktree riêng.

## 4. Next steps + owner

| Bước | Owner |
|---|---|
| E2E click menu xác nhận không reload (staging/Playwright) | session QA / Owner |
| Restyle fallback boot clock-only (nếu vẫn muốn) | slice FE riêng |
| `secret-scan` đỏ pre-existing (`facts20.json`) + re-baseline gate trùng 386 | coordinator + session `staging-pro-layout` |
| Xoá worktree `vninvest-wt-sidebar-closeout` khi không cần sửa bổ sung | agent phiên này/coordinator |

*Quy ước bằng chứng repo: mọi khẳng định kèm `file:line`; CHƯA XÁC MINH thì ghi rõ, không suy diễn.*

# Handoff — UI/UX vòng Phase B: đã đóng hoàn toàn (2026-11-08)

Phiên này đóng toàn bộ vòng kín UI/UX Phase B của `feat/uiux-phase-a` (claim `uiux-phase-a` = `done`),
chuyển 4 mục nợ còn lại thành ticket riêng thật, và dọn dẹp branch. Nguồn sự thật về trạng thái:
`docs/CODE_CHANGE_AUDIT_LEDGER.md` (Entry 422, 423, 424) + `git log origin/dev` + `docs/CLAIMS.md`.

## 1. Đã merge vào `dev` (4 PR, đã verify)

| PR | Commit merge | Nội dung |
|---|---|---|
| #302 | `2ab38208b` | Phase B: B2 6/6 states (`984475e9e`), B3 6 file i18n (`c95511111`..`f10a2059c`), B4 gate scope (`d0819d969` + regen `6a682c01d`), B5 scope/aria (`7b63cae7b`), C1/C2 widget defer (`1b6e5b9ff`), fix dup-key + Whale test (`0e0a60676`), ledger 422 |
| #303 | `3a497453d` | Đóng 15 fail `tenantreg-auth-pages` của B6: FormField required-marker ra khỏi `<label>`, `minLength=10`, reset-before-setValue (D10), regex D9 loại trừ `defaultValues:` — **66/66 PASS**, tsc 0 |
| #304 | `5f9422694` | AC4 `check-ai-cc`: CC GET dùng `_get_default_prompt_config()` tường minh — gate SẠCH |
| #305 | `ad4d66f32` | Verdict Phase B v4 = **AGREE** + ledger Entry 423 |

Gates đo lại sau rebase (HEAD `origin/dev`): tsc 0, tokens PASS, contrast PASS 7×2 ≥4.5:1,
dom-landmarks PASS, i18n-scope PASS 306/306, targeted vitest 66/66 + 41/41, build PASS 17.23s.
**Full suite** (`npx vitest run --exclude auth-forms-rhf-extra`, 66s): **177/178 files PASS, 1198/1199 tests PASS**.

Staging VPS (`14.225.255.47`, `/opt/vninvest`, `docker.edusuccess.vn`): deploy + `--verify` PASS,
API health 2xx, public health 200. Chú ý ops-side: `docker-compose.staging.yml` trên VPS có thêm
`CORE_AD_SIGNING_SECRET` ở 5 service (giá trị trong `compose.staging.env`, KHÔNG commit vào git vì
deny-list; backup `.bak.20261108`). Lần pull sau phải kiểm tra conflict ở file này trước.

## 2. Branch & file đã dọn

Đã xoá (local + remote): `feat/uiux-phase-a`, `fix/uiux-auth-closeout`, `fix/ai-cc-ac4-canonical`,
`docs/uiux-phase-b-closeout`. File tạm đã xoá: `packages/web/test-components-full*.log`, script debug
trong `C:\Users\vietd\AppData\Local\Temp\opencode\`.

## 3. Còn nợ — 3 ticket ngoài scope UI/UX (không chặn)

1. **`ai-cc-i18n-clean` AC5** (1/1199 tests): còn comment tiếng Việt trong 9 file AI CC
   (`npx vitest run src/components/__tests__/ai-cc-i18n-clean.component.test.ts` để tái hiện).
   Thuộc tracker AI CC (R0.5/R1), đã ghi nợ từ Entry 420; fix = dịch/giảm comment, không chạm logic.
2. **`auth-forms-rhf-extra.component.test.tsx` treo khi chạy lẻ** (pre-existing — chứng minh bằng
   stash; không phải do slice này). Khi chạy full suite cùng cả repo thì không treo.
   Cách tái hiện: `npx vitest run src/pages/auth/__tests__/auth-forms-rhf-extra.component.test.tsx --testTimeout=20000`.
3. **`agent-sync.ps1` / `agent-cleanup.ps1` lỗi parse Windows PowerShell 5.1** (tồn tại trước;
   handoff phiên này đã làm thủ công: fetch/rebase → gate → claim `done` → push → PR → merge).

Ngoài phạm vi và chưa làm (cần owner/coordinator quyết): **C3** i18n lazy namespace, **D1** light theme
(a/b), **D2** recharts → widget/echarts, BE suite trên VPS, axe 5 route 390×851, visual baseline 5 route × 2 theme.

## 4. Quy tắc không quên cho phiên sau

- `packages/core/backend/src/commercial/*` trong worktree chính là của agent khác — không commit hộ,
  không sửa hộ; làm việc theo claim trong `docs/CLAIMS.md`.
- vi/en namespace mới phải kiểm trùng top-level key trước (test `tenantreg-dup-i18n-keys` bắt được).
- Gate i18n bỏ qua dòng chứa `className` → đọc code thật trước khi kết luận "0 hit".
- Mọi kết luận cần phản chứng đo được; ghi `CHƯA CHẠY` thay vì suy diễn PASS (L-G02).

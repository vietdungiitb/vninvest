# Plan: Khôi phục plugin `.opencode-plugins` trên `main` (OpenCode 2.x)

- **Ngày**: 2026-11-25
- **Branch**: `fix/opencode-plugin-v2` (worktree riêng, base `main`)
- **Trigger**: `Plugin failed: .opencode-plugins` (báo cáo từ session trên `main`)

## 1. Bằng chứng đo lường (đã tự mở file)

| Bằng chứng | Kết quả |
|---|---|
| `opencode --version` | `opencode v2.4.0` |
| `opencode.jsonc:4` | `"plugin": [".opencode-plugins"]` — key cũ (V1), path thiếu `./` |
| `.opencode-plugins/vninvest-hooks.ts:1` | `import type { PluginInput } from "@opencode-ai/plugin"` — API V1 |
| `.opencode-plugins/vninvest-hooks.ts:37-85` | trả hook object `tool.execute.before` / `permission.ask` — API V1 |
| `.opencode-plugins/index.ts:1` | re-export từ `./vninvest-hooks.js` |
| `git merge-base --is-ancestor cc15400f7 HEAD` (trên `main`) | `1` — bản fix V2 trên `dev` chưa vào `main` |
| `git show dev:opencode.jsonc:4` | `"plugins": ["./.opencode-plugins"]` |
| `git show dev:.opencode-plugins/package.json:7` | `@opencode/plugin` `2.1.4` |
| `node scripts/check-multi-agent.mjs` | `MODULE_NOT_FOUND` — repo này **KHÔNG CÓ** gate đó (`CHƯA CHẠY`) |

Lịch sử fix sẵn có trên `dev` (chưa merge vào `main`): `cc15400f7` (V1→V2), sau đó `4aa075876` (precise legacy-path check, ancestor trung gian), cuối cùng `70a50feea` (bash-guard chỉ chặn legacy thật; parent trực tiếp là `90918977d`, **không phải** `4aa075876`).

Bằng chứng gốc: `git show dev:docs/CODE_CHANGE_AUDIT_LEDGER.md` **Entry 405 (dòng 2185-2192)** ghi rõ root cause `NpmInstallFailedError: ENOENT … .opencode-plugins/package.json`, 3 lớp lỗi (key `plugin` deprecated + thiếu `./`, thiếu package.json, code V1), verify `plugin list vninvest-hooks local` + functional 5/5. SDK drift: `dev:.opencode-plugins/package.json:7` pin `@opencode/plugin 2.1.4`, trong khi local `opencode v2.4.0` và `npm view @opencode/plugin version` = `2.4.1` → REQ-01 bắt buộc smoke-test log load thực tế, không chỉ tin lịch sử.

## 2. Mục tiêu / nghiệm thu

- **REQ-01**: OpenCode 2.4.0 load được plugin local mà không báo `Plugin failed`.
  - Given cấu hình `plugins` V2 + hook `Plugin.define`, When khởi động OpenCode trong repo, Then server log không có lỗi load plugin `.opencode-plugins`.
- **REQ-02**: Hành vi guard cũ được giữ nguyên (chặn ghi `backend/`/`frontend/` legacy, cảnh báo tiếng Việt hardcoded, chặn lệnh bash đụng legacy), đồng thời không còn chặn nhầm `packages/core/backend/...`.
  - Given path `packages/core/backend/src/x.py`, When hook `evaluate` xét lệnh có chứa path đó, Then không deny.
- **REQ-03**: Có bằng chứng audit + ledger + claim cho thay đổi.

## 3. SCOPE / LIMIT / non-goals / rollback

- **SCOPE**: `opencode.jsonc`, `.opencode-plugins/vninvest-hooks.ts`, `.opencode-plugins/package.json` (new), tài liệu `docs/PLAN_*`, `docs/AUDIT_*`, `docs/CODE_CHANGE_AUDIT_LEDGER.md`, `docs/handoffs/*`.
- **KHÔNG chạm**: `.opencode-plugins/index.ts` — giữ nguyên nội dung `dev:` (re-export `./vninvest-hooks.js` dù file vật lý là `.ts`); Entry 405 xác nhận entrypoint `index.ts` load thành công, Entry 404 cảnh báo không "sửa" theo kiểu W0.3.
- **CLAIM**: `docs/CLAIMS.md` **KHÔNG TỒN TẠI** trên `main` (`git cat-file -e HEAD:docs/CLAIMS.md` → 128). Không tạo file shared mới: ghi claim vào entry `docs/CODE_CHANGE_AUDIT_LEDGER.md` + `docs/handoffs/` (đây là SSOT claim của repo này). Đây là deviation có chủ đích so với `MANDATORY-WORKFLOW.md` (repo không có gate/check-multi-agent tương ứng).
- **LIMIT**: copy nội dung 3 file từ `dev` (không cherry-pick — `4aa075876` sửa `docs/CLAIMS.md:1873` sẽ conflict modify/delete trên `main`), tối đa 1 vòng re-audit; không sửa logic guard ngoài nội dung đã audit trên `dev`.
- **Non-goals**: không merge `dev` vào `main`; không upgrade OpenCode; không đụng `packages/web` / `packages/core`; không chạy npm install.
- **Rollback**: `git reset --hard` về `main` trên branch riêng; worktree có thể xoá bằng `git worktree remove`.

## 4. Baseline cổng (trước sửa)

| Cổng | Lệnh | Baseline |
|---|---|---|
| Plugin load | báo cáo session | FAIL (`Plugin failed: .opencode-plugins`) |
| Multi-agent gate | `node scripts/check-multi-agent.mjs` | CHƯA CHẠY (file không tồn tại, `KHÔNG TỒN TẠI`) |
| tsc web | `npx tsc --noEmit` (packages/web) | không đổi (scope không đụng web) — sẽ chạy lại để khẳng định |
| Build web | `npm run build` (packages/web) | không đổi — sẽ chạy lại nếu khả thi |

## 5. Ma trận truy vết

| REQ | Task | Test / evidence |
|---|---|---|
| REQ-01 | T1: `opencode.jsonc` → `plugins` + `./.opencode-plugins`; lấy nguyên nội dung `dev:opencode.jsonc`, `dev:.opencode-plugins/vninvest-hooks.ts`, `dev:.opencode-plugins/package.json` (không cherry-pick) | `opencode --version`, `git hash-object` so sánh với blob `dev:`, smoke-test log load plugin trên 2.4.0 |
| REQ-02 | T2: giữ nguyên byte-for-byte 3 file lấy từ `dev` (đã gồm precision + bash guard) | `git hash-object` khớp `git rev-parse dev:<path>`; grep `isLegacyCandidate` / `Plugin.define` |
| REQ-03 | T3: audit độc lập + ledger + handoff (không tạo CLAIMS.md) | `docs/AUDIT_*`, `docs/CODE_CHANGE_AUDIT_LEDGER.md`, `docs/handoffs/*` |

## 6. Đã đọc system-design

Repo này **KHÔNG CÓ** `docs/system-design/` trong scope plugin config (`Test-Path` → false tại thời điểm lập plan). Đây là cấu hình tool, không phải tính năng sản phẩm → *xây mới không có nguồn system-design*, nguồn là Entry 405 của `dev:docs/CODE_CHANGE_AUDIT_LEDGER.md` (audit ngày 2026-10-24).

## 7. Phản hồi audit độc lập vòng 1 (NEED_REVISION)

| # | Objection | Xử lý |
|---|---|---|
| 1 | `docs/CLAIMS.md` không tồn tại, cherry-pick `4aa075876` conflict | Bỏ khỏi SCOPE; dùng ledger + handoff làm claim (§3); copy thay cherry-pick (§3 LIMIT) |
| 2 | Plan mâu thuẫn cherry-pick vs copy; baseline byte-identical | Thống nhất copy 3 file từ `dev`, giữ nguyên `index.ts` (§3, §5) |
| 3 | Sai chuỗi commit ở dòng 22 | Sửa: `70a50feea` có parent `90918977d`; `4aa075876` chỉ là ancestor (§1) |
| 4 | Thiếu evidence Entry 405 + SDK drift 2.1.4 vs 2.4.1 | Bổ sung §1 + bắt buộc smoke-test REQ-01 |
| 5 | `index.ts` không đổi, `.js`→`.ts` không phải blocker | Ghi rõ §3 "KHÔNG chạm" |

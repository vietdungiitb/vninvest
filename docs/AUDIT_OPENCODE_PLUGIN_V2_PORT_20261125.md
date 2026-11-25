# Audit: Port bản fix plugin OpenCode V2 từ `dev` sang `main`

- **Ngày / phạm vi**: 2026-11-25 · branch `fix/opencode-plugin-v2` (base `main`) · cấu hình plugin local `.opencode-plugins`.
- **Kế hoạch**: `docs/PLAN_FIX_OPENCODE_PLUGIN_V2_20261125.md` (audit v1 NEED_REVISION → v2 AGREE).
- **Claim**: `opencode-plugin-v2` (repo không có `docs/CLAIMS.md`; ghi trong handoff + ledger Entry 42).

## Tóm tắt 5 findings nghiêm trọng nhất

1. `main` dùng cấu hình V1 (`opencode.jsonc:4` `"plugin": [".opencode-plugins"]`) → server 2.4.0 hiểu là npm spec, log lỗi `NpmInstallFailedError … .opencode-plugins\package.json ENOENT` lúc 03:55:50 UTC. Đã đổi sang `"plugins": ["./.opencode-plugins"]` (`opencode.jsonc:4`).
2. Hook V1 (`@opencode-ai/plugin`, trả object hook) → V2 `Plugin.define` + `ctx.tool.hook`/`ctx.permission.hook` (`.opencode-plugins/vninvest-hooks.ts:1,97,113,139`).
3. Thiếu `.opencode-plugins/package.json` → added, pin `@opencode/plugin 2.1.4` (`:7`).
4. Guard legacy cũ chặn nhầm `packages/core/backend/...` → bản V2 dùng `isLegacyCandidate` relativize theo worktree (`:85,144,161`), functional 5/5 PASS.
5. Bản fix đã có trên `dev` (Entry 405, dòng 2185-2192) nhưng chưa vào `main` (`git merge-base --is-ancestor cc15400f7 HEAD` → 1) → port byte-for-byte thay vì cherry-pick (tránh conflict `docs/CLAIMS.md:1873` không tồn tại trên `main`).

## A. Bản đồ file

| File | Dòng | Trách nhiệm | Note |
|---|---|---|---|
| `opencode.jsonc` | 5 | Khai báo plugin local | `:4` key `plugins`, path `./.opencode-plugins` |
| `.opencode-plugins/index.ts` | 2 | Entry point, re-export hooks | **Không đổi**, hash khớp `dev:` |
| `.opencode-plugins/vninvest-hooks.ts` | 173 | Guard legacy + i18n, API V2 | hash `7131427e…` khớp `dev:` |
| `.opencode-plugins/package.json` | 9 | Khai báo dep plugin | hash `fdc483ae…` khớp `dev:` |

## B. Luồng đã trace

1. `opencode.jsonc:4` → server đọc config → resolve `./.opencode-plugins/index.ts`.
2. Log server `04:02:18.517Z`: `loading plugin id=…/fix-opencode-plugin-v2/.opencode-plugins entrypoint=file:///…/index.ts` — **không** có dòng `failed to load plugin` cho path này (chỉ lỗi plugin `ponytail` global, không liên quan).
3. `index.ts:1` → `vninvest-hooks.ts:97` `Plugin.define` → `setup(ctx)` → `:113` hook `execute.before` (chặn ghi legacy, cảnh báo tiếng Việt) + `:139` hook `permission.ask/evaluate` (deny path legacy, deny bash chạm legacy).
4. `:85,144,161` `isLegacyCandidate` relativize hoá path → `packages/core/backend/...` không bị chặn.

## C. CONTRADICTIONS (plan/doc vs code)

| Plan/doc | Thực tế | Tác động |
|---|---|---|
| `docs/PLAN_FIX_OPENCODE_PLUGIN_V2_20261125.md` bản đầu ghi "cherry-pick 3 commit" | `git show --stat 4aa075876` sửa `docs/CLAIMS.md:1873`, file `KHÔNG TỒN TẠI` trên `main` | Đã sửa plan sang copy byte-for-byte; tránh conflict modify/delete |
| `MANDATORY-WORKFLOW.md` yêu cầu claim trong `docs/CLAIMS.md` + gate `scripts/check-multi-agent.mjs` | `git cat-file -e HEAD:docs/CLAIMS.md` → 128; gate → `MODULE_NOT_FOUND` | Deviation có lý do, ghi rõ trong plan §3/handoff; dùng ledger + handoff làm SSOT |

## D. Findings

| ID | Loại | Mức | file:line | Thực tế | Tác động | Fix |
|---|---|---|---|---|---|---|
| F1 | ERROR | P0 | `opencode.jsonc:4` | key V1, thiếu `./` | Plugin load fail | `plugins` + `./` |
| F2 | ERROR | P0 | `vninvest-hooks.ts:1,97` | API V1 | Hook không đăng ký trên server 2.x | `Plugin.define` |
| F3 | GAP | P1 | `.opencode-plugins/package.json` (mới) | Thiếu package.json | `NpmInstallFailedError` | thêm, pin 2.1.4 |
| F4 | RISK | P1 | `vninvest-hooks.ts:85,161` | Guard cũ chặn nhầm path mới | block dev workflow | relativize theo worktree |
| F5 | GAP | P2 | `main` vs `dev` | fix chỉ ở `dev` | lỗi lặp lại trên `main` | port + merge |

## E. Quality gates (chạy thật)

| Cổng | Lệnh | Kết quả |
|---|---|---|
| Red evidence | log `C:\Users\Pham Viet Dung\.local\share\opencode\log\opencode.log` @ 03:55:50Z | FAIL như báo cáo (`target=.opencode-plugins`, `NpmInstallFailedError … ENOENT … package.json`) |
| Plugin config | `opencode plugin list` | HIỆN `vninvest-hooks local …\.opencode-plugins` |
| Plugin load (sau fix) | log @ 04:02:18.517Z | `loading plugin …/.opencode-plugins entrypoint=…index.ts`, 0 failed-to-load cho vninvest |
| Hash byte-identical | `git hash-object <p>` vs `git rev-parse dev:<p>` | 4/4 match (gồm `index.ts` giữ nguyên) |
| Functional guard | `node <temp>/verify-vninvest-legacy-guard.js .opencode-plugins/vninvest-hooks.ts` | 5/5 PASS (legacy deny, new path allow) |
| Multi-agent gate | `node scripts/check-multi-agent.mjs` | **CHƯA CHẠY** — file `KHÔNG TỒN TẠI` trên repo này |
| `npx tsc --noEmit` / `npm run build` (packages/web) | — | **CHƯA CHẠY** — worktree không có `node_modules`, scope không đụng FE; không `npm install` khi chưa hỏi |
| i18n scan / FE test | — | **CHƯA CHẠY** — không đổi file FE/i18n |

## F. Câu hỏi cần làm rõ

- Có nên thống nhất pin `@opencode/plugin` lên `2.4.x` theo server local 2.4.0 không? (`npm view` = 2.4.1). Hiện giữ nguyên bản đã audit trên `dev` (2.1.4) và smoke-test PASS trên 2.4.0 → không blocker.

## G. Đánh giá tổng thể

**Implementable, không blocker.** Plugin load PASS trên OpenCode 2.4.0, guard functional 5/5, byte-identical với bản đã audit trên `dev`. Cổng FE **CHƯA CHẠY** nhưng nằm ngoài scope (không sửa code FE) → chấp nhận. Ưu tiên tiếp theo: merge branch vào `main`, verify handoff landing trên main.

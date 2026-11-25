# HANDOFF 2026-11-25 — Khôi phục plugin `.opencode-plugins` (OpenCode 2.x)

- **Trạng thái**: `done` (chờ merge vào `main`)
- **Claim**: `opencode-plugin-v2` · **Agent**: `opencode-plugin-v2` · **Branch**: `fix/opencode-plugin-v2` (worktree riêng, base `main`)
- **Phạm vi**: `opencode.jsonc`, `.opencode-plugins/vninvest-hooks.ts`, `.opencode-plugins/package.json`, docs/plan/audit/ledger/handoff. Không đụng `.opencode-plugins/index.ts`, `packages/web`, `packages/core`.
- **Kế hoạch**: `docs/PLAN_FIX_OPENCODE_PLUGIN_V2_20261125.md`
- **Audit vòng 1**: NEED_REVISION (5 objection) → đã sửa; **vòng 2**: AGREE (2 reservation không chặn).
- **Bằng chứng red (trước sửa)**:
  - `opencode --version` → `v2.4.0`
  - `opencode.jsonc:4` → `"plugin": [".opencode-plugins"]` (key V1, thiếu `./`)
  - `.opencode-plugins/vninvest-hooks.ts:1,37-85` → API V1 (`@opencode-ai/plugin`, hook object)
  - Session báo `Plugin failed: .opencode-plugins`
  - `git merge-base --is-ancestor cc15400f7 HEAD` (trên `main`) → `1`
- **Lưu ý SSOT**: repo này có `docs/handoffs/` trên nhánh chính; file này phải landing trên `main` (merge/cherry-pick) trước khi đóng phiên. `docs/CLAIMS.md` **KHÔNG TỒN TẠI** → claim được ghi tại đây + `docs/CODE_CHANGE_AUDIT_LEDGER.md` (Entry 42).
- **Kết quả**: copy 3 file byte-identical từ `dev` (`git hash-object` 4/4 match, giữ nguyên `index.ts`); server log `04:02:18.517Z` load plugin thành công, `opencode plugin list` → `vninvest-hooks local`; functional guard 5/5 PASS; audit evidence `docs/AUDIT_OPENCODE_PLUGIN_V2_PORT_20261125.md`; ledger Entry 42.
- **CHƯA CHẠY**: multi-agent gate (`KHÔNG TỒN TẠI`), `tsc`/`build`/i18n/FE test (worktree không có `node_modules`, ngoài scope).
- **Next steps / owner**: merge commit vào `main` (owner `opencode-plugin-v2`), verify `git log --oneline -3 -- docs/handoffs` trên `main`, rồi cleanup worktree.

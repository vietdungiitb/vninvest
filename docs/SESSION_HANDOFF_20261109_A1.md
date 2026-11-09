# Handoff — A1 re-verify (staging) đóng vòng (2026-11-09)

**Phiên này đóng vòng kín cho slice `a1-verify` (branch `feat/a1-verify` → PR).** Nguồn sự thật: `docs/CODE_CHANGE_AUDIT_LEDGER.md` (Entry 433) + `git log origin/dev` + `docs/CLAIMS.md` (claim `a1-verify` = done) + `docs/evidence/a1-verify/`.

## 1. Đã merge

| Commit | Nội dung |
|---|---|
| `30db0e94d` | Claim riêng (`docs/CLAIMS.md` +1) |
| *(B6)* | VPS `docker exec vninvest-core-api` (staging `5f9422694`, tre 26 commits): `Ran 3 tests OK` (54.5s) cho 2 class + `makemigrations --check` No changes; 2 class xanh → **A1 đóng bằng "không còn bug"**, không sửa code (đúng Step 1 re-verify-first) |
| *(B9)* | Claim `done` + `B7_GATES` + `AUDIT_B8` (PASS 0 blocker/0 major, **staging-only**) + handoff này + ledger Entry 433 |

Gates B7: VPS docker-exec đã chạy thật (OK), `check-multi-agent` PASS, `check-lessons` 57/60, `check-experiment-env` PASS, `normalize-eol` OK. `pre-push-gate` 2 FAIL pre-existing (thiếu `node_modules/typescript`). **CHƯA CHẠY**: BE suite trên dev mới, tsc, PWSh-7 runtime.

## 2. Còn nợ — giao phiên tiếp theo (theo thứ tự)

1. **P0-1 AUD-01 (coordinator, deny-list)** `packages/core/backend/requirements.txt:9` → `redis>=6.1.0` + rebuild staging — Workers RestartCount đã **2796/1575** (tăng từ 1486/837). Chờ Owner duyệt (Q1). Blocker BE suite trên dev mới.
2. **P0-3 pull staging** `5f9422694` → dev mới (stash hotfix secret `docker-compose.staging.yml` trước) rồi re-verify lại A1 + A5 (vì A1 hiện chỉ cho staging cũ, chưa nói hết dev).
3. **A5/B1/B2** (xem `PLAN_NEXT_DIRECTION` + `SESSION_HANDOFF_20261109_T3_PR.md`): OpenClaw D4, AI contract return schema, gỡ order live. Mỗi task 1 branch/PR, file-disjoint, VPS test sau P0-1.
4. **T3 còn sót:** `agent-pr.ps1` đã xong (PR #311); `agent-sync/cleanup/pr` parse 5.1 xong. Không còn T3 infra mở.

## 3. Quy tắc không quên

- Không commit thẳng `dev`; branch `feat/<tên-agent>` đúng ký tự, claim trước dòng đầu tiên.
- `.ps1` mới: `--` thay em dash; tránh **dòng backtick-kết-thúc trong here-string expandable** (LF nuốt terminator `"@`).
- Staging test kết quả **chỉ cho code staging**, không suy ra dev (tre 26 commits).
- Mọi verdict thành file.

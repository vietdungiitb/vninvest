# Handoff — T3-pr agent-pr.ps1 đóng vòng (2026-11-09)

**Phiên này đóng vòng kín cho slice `agent-pr-ps51` (branch `feat/agent-pr-ps51` → PR).** Nguồn sự thật: `docs/CODE_CHANGE_AUDIT_LEDGER.md` (Entry 432) + `git log origin/dev` + `docs/CLAIMS.md` (claim `agent-pr-ps51` = done) + `docs/evidence/agent-pr-ps51/`.

## 1. Đã merge

| Commit | Nội dung |
|---|---|
| `ee41c67af` | Claim riêng (`docs/CLAIMS.md` +1) |
| *(B6)* | `scripts/agent-pr.ps1` 11 em dash → `--` + 3 trailing-space trong here-string PR body (dòng 110/121/123 `in-progress/done/```) — Tổng diff **14 dòng**. Fail-before probe **2 errors** `42:25/38:26` → sau fix **0 errors** trên cả LF và CRLF qua PS Parser probe. Gốc 2 lớp: (1) em dash trong string vỡ chuỗi như T3-1; (2) **backtick-kết-thúc-dòng + LF** nuốt newline đóng here-string (`"@` không còn đầu dòng), CRLF không bị — trailing-space vô hình dừng escape, giữ nguyên markdown hiển thị. File giữ LF để pass `normalize-eol` + parse. |
| *(B9)* | Claim `done` + `B7_GATES` + `AUDIT_B8` (PASS 0 blocker/0 major) + handoff này + ledger Entry 432 |

Gates B7: `check-multi-agent` PASS · `check-lessons` 57/60 · `check-experiment-env` PASS · `normalize-eol` OK. `pre-push-gate` 2 FAIL pre-existing (thiếu `node_modules/typescript`). **CHƯA CHẠY**: tsc / BE / VPS / PWSh-7 runtime.

B3: 1 vòng **PASS**. B8: **PASS** 0 blocker/0 major.

## 2. Còn nợ — giao phiên tiếp theo (theo thứ tự)

1. **P0-1 AUD-01 (coordinator, deny-list)** `packages/core/backend/requirements.txt:9` → `redis>=6.1.0` + rebuild staging — không agent tự sửa. Chờ Owner duyệt (Q1). Blocker BE test.
2. **P0-2/3**: verify script đã có RestartCount gate (`deploy-staging.sh:74-116`), pull staging `5f9422694` → hiện tại (stash hotfix secret trước).
3. **A1 re-verify-first** (`test_no_timezone_utc.py` + `test_api_envelope_schema.py` trên VPS) → **A5/B1/B2**.

## 3. Quy tắc không quên

- Không commit thẳng `dev`; branch `feat/<tên-agent>` đúng ký tự, claim trước dòng đầu tiên.
- `.ps1` mới: `--` thay em dash trong string; **tránh đường backtick-kết-thúc-dòng trong here-string expandable** (LF sẽ nuốt terminator `"@`).
- Mọi verdict thành file (`docs/evidence/<slice>/`).

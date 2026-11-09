# Handoff — T3 scripts parse PS 5.1 đóng vòng (2026-11-09)

**Phiên này đóng vòng kín cho slice `scripts-ps51` (branch `feat/scripts-ps51` → PR).** Nguồn sự thật: `docs/CODE_CHANGE_AUDIT_LEDGER.md` (Entry 431) + `git log origin/dev` + `docs/CLAIMS.md` (claim `scripts-ps51` = done) + `docs/evidence/scripts-ps51/`.

## 1. Đã merge

| Commit | Nội dung |
|---|---|
| `6a8b379e8` | Claim riêng (`docs/CLAIMS.md` +1) |
| *(B6)* | `scripts/agent-sync.ps1` 18 `—`→`--` + `scripts/agent-cleanup.ps1` 3 `—`→`--` (fail-before 1+3 parse error → 0 error cả 2 file trên Windows PowerShell 5.1 qua `.NET Parser`) + `normalize-eol --fix` (worktree CRLF → LF khớp blob) |
| *(B9)* | Claim `done` + `B7_GATES` + `AUDIT_B8` (PASS 0 blocker/0 major) + handoff này + ledger Entry 431 |

Gates B7: `check-multi-agent` PASS · `check-lessons` 57/60 · `check-experiment-env` PASS · `normalize-eol` OK (sau --fix). `pre-push-gate` 2 FAIL/32 PASS/2 SKIP — **pre-existing** (baseline `origin/dev` sạch cùng 2 FAIL, thiếu `node_modules/typescript`), T3 không gây. **CHƯA CHẠY**: tsc / BE suite / VPS verify / PWSh-7 runtime (slice chỉ claim parse 5.1).

## 2. Còn nợ — giao phiên tiếp theo (theo thứ tự)

1. **`agent-pr.ps1` còn 11 `—`** (auditor B8 phát hiện ngoài scope T3) — slice riêng tương tự: thay `--` trong strings, probe parse lại. Không gộp vào PR này.
2. **P0-1 AUD-01 (coordinator, deny-list)** `requirements.txt:9` → `redis>=6.1.0` + rebuild staging — vẫn blocker BE test.
3. **A1 re-verify-first** (`test_no_timezone_utc.py` + `test_api_envelope_schema.py` trên VPS) → **A5/B1/B2** (xem `docs/PLAN_NEXT_DIRECTION_20261109.md` + `docs/SESSION_HANDOFF_20261109.md`).
4. **T2** (`auth-forms-rhf-extra` treo lẻ) — repro ×3 trên VPS, có thể dùng `agent-sync.ps1` đã sửa để sync an toàn.

## 3. Quy tắc không quên

- Không commit thẳng `dev`; branch `feat/<tên-agent>` đúng ký tự, claim trước dòng đầu tiên.
- `.ps1` mới: dùng ASCII `--` thay em dash trong string literal (PS 5.1 đọc UTF-8 không BOM thành ANSI, byte 0x94 thành smart quote đóng chuỗi).
- Mọi verdict phải thành file (`docs/evidence/<slice>/`).

# AUDIT B8 lần 2 — gates-fix re-audit (2026-11-08)

> **Scope:** `feat/gates-1108` @ `f07faddd5` (`origin/dev` đối chiếu) trong worktree `C:\Mujoco Projects\agent-gates-1108` — chỉ đọc + chạy gate, không sửa code, không commit.
> **Gốc:** B8 lần 1 (`AUDIT_B8_GATES_20261108.md`) verdict NEED_REVISION với blocker B8-01 (self-test CONTROL fail) + major B8-02 (predicate nuốt drift).
> **Phương pháp:** mọi kết quả dưới đây là auditor chạy trực tiếp (lệnh + exit code) hoặc đọc dòng thật, không tin comment.

## Bảng từng mục

| # | Mục | Kết quả | Bằng chứng (file:line + lệnh đã chạy) |
|---|---|---|---|
| 1 | B8-01: `check-system-design --self-test` — CONTROL + suite | PASS (blocker đóng) | Auditor chạy `node docs/system-design/_meta/tools/check-system-design.mjs --self-test` → `SELF-TEST PASS: 7 case (1 control + 4 bat loi + 1 predicate + 1 catalog)`, exit 0. CONTROL `sach thi exit 0 exit=0` (không còn `exit=2` như lần 1). CATALOG tích hợp `gen-ok exit0, django exit2-SKIP, requests exit1-FAIL` pass thật. |
| 2 | B8-02: `checkGenerated` — predicate hẹp, không nuốt drift | PASS (major đóng) | Đọc dòng thật: `check-system-design.mjs:520-521` `isMissingDjangoOutput` chỉ regex `/No module named ['"]django['"]/`. `checkGenerated:542-549` — `if (r.status !== 0)` rồi `if (isMissingDjangoOutput(blob)) return code 2`, còn lại `return code 1`. Không còn nhánh `r.status===2` cho SKIP. Self-test tích hợp `:789-794` assert `c3` gen in `No module named 'requests'` exit 2 → `status===1` + không chứa `CHUA CHAY` (module khác vẫn FAIL đúng chủ trương). |
| 3 | `check-system-design --check` — exit + các phần còn lại | PASS | Auditor chạy `--check` → `KHONG VERIFY DUOC — exit 2` (expected trên máy thiếu django). Các phần khác đều khớp: `check-inventory: 44 file — khop`, `check-freshness: khop ban sinh`, `check-doc-links: 44 file · 34 lien ket · 220 citation — sach`, `check-duplicate-topics: 44 file · 41 chu de — khong trung`, `check-claims: 6 tuyen bo — khop code`. Chỉ catalog SKIP vì thiếu Django runtime. |
| 4 | `scripts/pre-push-gate.mjs` — 0 FAIL, 2 SKIP rõ lý do | PASS | Auditor chạy `node scripts/pre-push-gate.mjs` → `34 PASS / 2 SKIP / 0 FAIL` exit 0. Hai SKIP có lý do riêng, kiểm chứng được: `system-design — catalog CHUA CHAY (thieu Django runtime tren may nay) — chay VPS`; `openapi-budget — django chua co tren may nay — CHUA CHAY; chay tren VPS staging`. Không có FAIL, không bịa PASS. |
| 5 | `check-ai-cc.mjs` + `--self-test` | PASS | Auditor chạy `node packages/web/scripts/check-ai-cc.mjs` → `SACH` exit 0 (12 AC PASS). `--self-test` → `SELF-TEST PASS: 20/20` exit 0. |
| 6 | Spec scope: 12 file có ngoài plan không? | PASS (trong phạm vi) | `git diff origin/dev..HEAD --stat` = 12 file: `check-ai-cc.mjs`, `01.01-tom-tat-dieu-hanh.md`, `claims.json`, `inventory.json`, `freshness-report.md`, `check-system-design.mjs`, `pre-push-gate.mjs`, `PLAN_GATES_FIX_20261108.md`, 3 file `evidence/gates-fix/*` (B8 + PLAN + PLAN v2), + `CLAIMS.md`. Tất cả khớp phạm vi claim (`PLAN_GATES_FIX_20261108.md:57`) cộng hygiene 3 dòng stale `in-progress→superseded` đã được G4 thừa nhận (`:45`) + 1 dòng claim `gates-1108`. Không chạm `commercial/*`, không thêm dependency. Diff `check-ai-cc` chỉ thêm chuẩn hoá EOL (`.replace(/\r\n/g,"\n")`), diff `pre-push-gate` giới hạn đúng 2 block (exit-2→skip + openapi probe django). |

## VERDICT: PASS

- B8-01 (blocker) đã đóng: self-test CONTROL xanh trở lại, cả suite 7/7 pass, exit 0.
- B8-02 (major) đã đóng: chỉ `isMissingDjangoOutput` quyết định SKIP; gen exit 2 với module khác vẫn FAIL.
- Không còn blocker, không còn major. Các cổng còn lại (--check, pre-push, check-ai-cc) đúng expected, scope trong plan.

## Bằng chứng đã chạy (auditor B8 lần 2, 2026-11-08)

```
node docs/system-design/_meta/tools/check-system-design.mjs --self-test → SELF-TEST PASS: 7 case exit 0
node docs/system-design/_meta/tools/check-system-design.mjs --check     → KHONG VERIFY DUOC exit 2 (SKIP catalog, claims/freshness/links/dups khop)
node scripts/pre-push-gate.mjs                                          → 34 PASS / 2 SKIP / 0 FAIL exit 0
node packages/web/scripts/check-ai-cc.mjs                               → SACH exit 0
node packages/web/scripts/check-ai-cc.mjs --self-test                   → SELF-TEST PASS: 20/20 exit 0
git diff origin/dev..HEAD --stat                                       → 12 files (trong pham vi plan + hygiene CLAIMS)
```

*Auditor độc lập — không sửa code, không commit.*

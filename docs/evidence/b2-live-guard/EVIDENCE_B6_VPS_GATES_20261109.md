# B6/B7 — evidence VPS + gates (b2-live-guard) — 2026-11-09

**Revision**: `9db59ffee` · **Branch**: `feat/b2-live-guard` · **Base**: `35ca2afc5`.

## B6 — Re-verify VPS (chạy thật, không suy diễn)

1. **Cách chạy**: container staging (`vninvest-core-api`, image bake `@5f9422694`) đọc code cũ hơn dev `35ca2afc5` ⇒ `docker cp` đè cả 2 file revision mới (`views_dnse.py` + `test_order_safety.py`) vào `/app/src/user_workspace/`, chạy `manage.py test user_workspace.test_order_safety` (bypass pgbouncer per-exec, env override → `core-db:5432`, pattern A5), rồi restore.
2. **Kết quả full file**: `Ran 49 tests → OK (skipped=3)`, `TEST_EXIT 0` (9.070s).
3. **Live-mode explicit (6 tests, OK)**: `test_live_mode_rejected_with_explicit_code` (live→403+`live_ordering_disabled`+broker rỗng), `test_dry_run_false_is_an_explicit_live_request` (200→403), `test_paper_mode_reaches_the_broker_as_dry_run_true` (paper→200+dry_run=True), `test_live_mode_rejection_is_audited`, `test_otp_live_mode_rejected` (403 qua send-email-otp), `test_trading_token_live_mode_rejected` (403 qua create-trading-token). `Ran 6 tests → OK`, `TEST_EXIT 0`.
4. **Kết luận (L-V02)**: Hành vi W1.2 đã đúng từ PA-1 tới dev `35ca2afc5` — **không sửa code sản phẩm** (pattern A1: đóng bằng "không còn bug", không bịa fail-before).
5. **Restore**: chép lại bản gốc từ `git -C /opt/vninvest show HEAD:...` (@ `5f9422694`) → **md5 khớp** (`views_dnse.py` `8681a255...`, `test_order_safety.py` `bd4eedd1...`); `git -C /opt/vninvest status` chỉ còn dirty sẵn có (`M docker-compose.staging.yml` + 5 untracked hotfix) — **không còn gì của slice**; `/tmp` trên VPS đã xóa.

## B7 — Gates (chạy thật sau B6)

| Cổng | Kết quả |
|---|---|
| `node packages/web/scripts/check-multi-agent.mjs` | **PASS** — 0 lỗi, 0 trùng |
| `node scripts/check-lessons.mjs` | **PASS** — 57/60 |
| `node scripts/normalize-eol.mjs` | **OK** — 0 thay đổi |
| `node scripts/check-experiment-env.mjs` | **PASS** — 1 dòng mới trong `origin/dev...HEAD`, 0 docker local |
| `node scripts/pre-push-gate.mjs` | **2 FAIL / 32 PASS / 2 SKIP** — giống baseline, pre-existing |
| `git diff --numstat` | **0 file code** (chỉ PLAN + evidence doc) |

## B8

Auditor độc lập kiểm trên revision `9db59ffee` (nội dung doc-only + chi tiết VPS trên). Pattern A1/A5: re-verify không sửa code.

## CHƯA CHẠY

- `workspace.js` nhãn "phiếu thử nghiệm"/FE order UI: **chỉ đọc, không sửa** (2 claim in-progress stale `:1826`,`:1886`) — follow-up sau coordinator đóng claim.
- B1 orchestrator return schema (L-size): slice riêng (phiên sau).
- P0-1 (`requirements.txt` redis, deny-list) — coordinator-only, không chạm.
- BE suite toàn repo trên dev mới: **CHƯA CHẠY**.
- `tsc`/E2E Playwright/screenshot UI: **CHƯA CHẠY** (không thay UI/FE).
- A4-remainder: BLOCKED (coordinator đóng `CLAIMS.md:1754`).

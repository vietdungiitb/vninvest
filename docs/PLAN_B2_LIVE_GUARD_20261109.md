# PLAN — B2 gỡ order placement khỏi sản phẩm (W1.2) — re-verify VPS — 2026-11-09 (B2)

> **For agentic workers:** REQUIRED SUB-SKILL: `workflow-dev-loop` — B3/B4 verdict bằng văn bản trước claim. **Plan này là B2 — chưa B3/B4, chưa claim, chưa viết code cho tới khi có verdict PASS/AGREE bằng văn bản (luật cứng #6).**

**Goal:** Xác nhận `live` order placement đã bị chặn (4xx) và `paper` vẫn chạy dry_run an toàn — re-verify-first kiểu A1: **không sửa code khi hành vi đã đúng**; fix TDD **chỉ** nếu re-verify thật sự đỏ.

**Architecture:** Chạy suite hiện có `user_workspace.test_order_safety` trên VPS staging bằng `docker cp` 2 file (`views_dnse.py` + `test_order_safety.py` ở revision mới) vào container (staging image bake code `@5f9422694`, khác dev `35ca2afc5`), rồi **restore** về bản bake trước khi kết thúc (bảo toàn container như A5). Không rebuild image, không đổi `/opt/vninvest`.

**Tech Stack:** VPS staging (`docker cp` + `docker exec`), env-override per-exec bypass pgbouncer cho test DB (A5 proven).

**Spec:** `docs/PLAN_NEXT_DIRECTION_20261109.md` §B2 (Step 1-3) + `docs/SESSION_HANDOFF_20261109_A5.md` §3 (⑤) + `docs/evidence/b2-live-guard/B1_MEASURE_20261109.md`.

## Global Constraints

- Không `npm/pip install` · không migration · **không chạm deny-list** (`requirements.txt` P0-1 coordinator-only).
- **Không sửa `workspace.js`** (2 claim `in-progress` stale tại `CLAIMS.md:1826` (`w0-10-close-be-gaps`) và `:1886` (`pm-review-20261108`, dòng `:1888` cùng agent đã `done` ⇒ stale) — chỉ đọc qua Read tool; nếu phát hiện cần sửa FE → DỪNG, ghi follow-up, tuân thủ §3). Không sửa `vi.js`/`en.js`, không sửa `orchestrator.py`.
- Không đọc tiếng Việt qua console; chỉ đếm exit code/số lượng (luật cứng #4).
- Mọi số kèm lệnh tái hiện; chưa chạy = `CHƯA CHẠY`.

## Review Focus

- **L-V02 (fail-before thật)**: Không kết luận từ đọc code — chỉ kết luận từ test chạy thật trên VPS với code revision mới (docker cp đè cả test + source, tránh staging cũ `@5f9422694` khác dev).
- **L-V04 (false-green)**: `test_order_safety.py` assert **status_code thật** (403) + `code` + `request_id` + broker không nhận gọi (`order_calls == []`) — đủ chiều dương/phủ. Bổ sung nếu cần: kiểm tra `broker.order_calls == []` khi `mode='live'` qua API thật (đã có ở `:184`).
- Không "fix" cho có nếu suite xanh — đóng slice bằng re-verify (pattern A1: "không còn bug", không bịa fail-before).
- Staging API có cửa sổ ngắn đọc được file docker-cp trong lúc test (đã ghi nhận A5) — cố gắng giữ ngắn + restore ngay.

---

## Baseline exit-code tại HEAD (B2, đo thật)

| Cổng | Lệnh | Kết quả |
|---|---|---|
| Quy trình | `node packages/web/scripts/check-multi-agent.mjs` | **PASS** — 0 lỗi, 0 trùng (2 cảnh báo stale) |
| Lessons | `node scripts/check-lessons.mjs` | **PASS** — 14 file, 57/60, sạch |
| EOL | `node scripts/normalize-eol.mjs` | **OK** — 0 file thay đổi |
| Pre-push gate | `node scripts/pre-push-gate.mjs` (ở A5 cuối phiên) | **2 FAIL / 32 PASS / 2 SKIP** (pre-existing, thiếu `node_modules/typescript`) |
| Git | `git status --short` | `?? docs/PLAN_A4_ROADMAP_20261109.md` + `?? docs/evidence/a4-roadmap/` (A4 BLOCKED, không stage) + evidence/plan slice này |

**Lessons áp dụng:** [L-001, L-002, L-003, L-008, L-M02, L-V01, L-V02, L-V03, L-V04, L-T01, L-B01, L-G02]

## SCOPE / LIMIT / NON-GOALS / ROLLBACK

- **SCOPE:** Re-verify đọc-only + VPS test run (docker cp 2 file → test → restore) + `docs/CLAIMS.md` (B5) + `docs/CODE_CHANGE_AUDIT_LEDGER.md` (B9 Entry) + `docs/evidence/b2-live-guard/*` + `docs/PLAN_B2_LIVE_GUARD_20261109.md` (+handoff).
- **LIMIT:** Tối đa **3 vòng thử**. Không sửa code sản phẩm (trừ khi re-verify đỏ **và** TDD fix xác nhận bằng test trên VPS + restore).
- **Non-goals:** Không sửa `orchestrator.py` (B1 slice), không sửa `workspace.js`/i18n (coordinator đóng claim trước), không mở P0-1/P0-3 (coordinator-only/T4).
- **Rollback:** revert PR (merge-commit). **Môi trường:** VPS staging `docker exec` + helper env-override (A5 pattern); không rebuild image, không đổi `/opt/vninvest`.

## Việc

### B2-1: Re-verify W1.2 trên VPS (live → 403, paper → dry_run)

- [ ] **Step 1 (re-verify-first, không bịa fail-before):** `docker cp` 2 file revision mới (`views_dnse.py` + `test_order_safety.py`) vào `/app/src/user_workspace/` trong container staging (giữ bản gốc bak). Chạy `user_workspace.test_order_safety` (bypass pgbouncer per-exec): ghi lại `Ran X tests → OK/FAIL` + `TEST_EXIT`. **Tất cả đều bắt buộc**: `test_live_mode_rejected_with_explicit_code` (live→403+code), `test_dry_run_false_is_an_explicit_live_request` (dry_run=false→403), `test_paper_mode_reaches_the_broker_as_dry_run_true` (paper→200+dry_run), `test_live_mode_rejection_is_audited`, `test_otp_live_mode_rejected`, `test_trading_token_live_mode_rejected`. Nếu có test nào FAIL → đi Step 2 (fix TDD tối thiểu + chạy lại + restore). Nếu PASS toàn bộ → đóng slice "không còn bug" (pattern A1).
- [ ] **Step 2 (chỉ khi Step 1 đỏ):** Root cause → TDD fix tối thiểu trong `views_dnse.py` → chạy lại trên VPS → PASS → restore. Ghi rõ mọi `CHƯA CHẠY` còn lại. Không sửa `workspace.js` trong vòng này (defer).
- [ ] **Step 3:** Restore container (chép lại bản gốc từ `git show HEAD` trên VPS + `rm` file test-copy nếu có dir mới + kiểm chứng md5/diff trong container) + `git status` VPS chỉ còn dirty sẵn có. `check-multi-agent`/`check-lessons`/`normalize-eol` PASS + `git diff --numstat` (expect 0 file code nếu PASS toàn bộ; nếu sửa thì đúng file sửa). Acceptance: **Given** client gửi `mode='live'` (hoặc `dry_run=false`), **When** đặt lệnh, **Then** nhận **403** + `code='live_ordering_disabled'` + broker **không** nhận order; **Given** `mode='paper'`, **When** đặt lệnh, **Then** 200 + broker nhận `dry_run=True`.

## Bàn giao

Plan là **B2**. B3 cần auditor độc lập ghi `docs/evidence/b2-live-guard/AUDIT_PLAN_20261109.md` trước claim (luật cứng #6). Agent đề xuất: `b2-live-guard` → `feat/b2-live-guard`.

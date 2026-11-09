# Handoff — A5 OpenClaw D4 BE-only (đóng vòng kín, 2026-11-09)

**Slice `a5-openclaw` (`feat/a5-openclaw` → PR #313 MERGED `b509f35f8`).** Nguồn sự thật: `docs/CODE_CHANGE_AUDIT_LEDGER.md` (Entry 434) + `git log origin/dev` + `docs/CLAIMS.md` (claim `a5-openclaw` = done) + `docs/evidence/a5-openclaw/`.

## 1. Đã merge

| Commit | Nội dung |
|---|---|
| `5be163ffb` | Claim riêng (`a5-openclaw` in-progress) |
| `809c2076c` | Code: `_MSG_NOT_CONFIGURED` → "Tính năng hỗ trợ đang chưa bật ..." + test mới `OpenClawSupportPositioningTests` (SimpleTestCase; B3 PASS 1-3 vòng, B8 pending → cuối cùng PASS) |
| `60b1dce58` | Claim done + ledger Entry 434 + B6 evidence + B8 (PASS, 0 blocker/0 major) |
| `b509f35f8` | Merge PR #313 (merge commit) |

Gates B7: VPS TDD RED→GREEN; full file `tests.test_ai_client_openclaw` **Ran 17 tests → OK** (bypass pgbouncer bằng env override per-exec `_RUN` thủ thuật — xem evidence); `check-multi-agent` PASS, `check-lessons` 57/60, `check-experiment-env` PASS, `normalize-eol` OK. `pre-push-gate` **2 FAIL / 32 PASS / 2 SKIP** pre-existing (thiếu `node_modules/typescript`). **CHƯA CHẠY**: FE/locale, `models.py:250` nhãn (migration, coordinator), P0-1, `tsc`, E2E.

## 2. Container/staging sau slice

- VPS staging `@5f9422694` không đổi: `openclaw.py` restore md5 `2f6c4ee7...`, `/app/src/tests` đã rm, `/tmp` sạch, `git status` VPS chỉ còn dirty sẵn có (`M docker-compose.staging.yml` hotfix + 5 untracked).
- Pgbouncer test-DB workaround cho phiên sau (BE test có DB trên VPS): env override per-exec đổi host `pgbouncer:6432` → `core-db:5432` (helper python, không in password; code evidence tại `docs/evidence/a5-openclaw/EVIDENCE_B6_VPS_GATES_20261109.md` §3). Django tự tạo+drop test DB. KHÔNG đổi pgbouncer config.

## 3. Còn nợ — giao phiên tiếp theo (theo thứ tự)

1. **P0-1 AUD-01 (coordinator-only, deny-list)**: `packages/core/backend/requirements.txt:9` pin `redis>=5.0,<6.0` vs kombu cần `redis>=6.1.0` (VPS worker 2796/beat 1575). Coordinator bump + verify `channels-redis>=4.1,<5.0`. Agent ghi `note` + báo coordinator, **không tự sửa**.
2. **P0-3**: stash hotfix VPS, pull staging `5f9422694` → dev mới (`b509f35f8`), migrate, `--verify` (gate RestartCount đã có ở `scripts/deploy-staging.sh:74-116`), re-verify A1/A5 trên code dev mới.
3. **A4-remainder** (`docs/PLAN_A4_ROADMAP_20261109.md`, 2 file untracked): BLOCKED — `CLAIMS.md:1754` còn `in-progress` giữ `docs/ROADMAP_MASTER_2026Q4_2027.md`; chỉ coordinator được đóng (§3). Agent không tự sửa vòng qua coordinator.
4. **B1 (orchestrator `:845-891` return schema)** — scope audit: prompt đã `posture` tại `:720-726`. File `orchestrator.py` không claim in-progress (toàn `released`).
5. **B2 (live order 4xx)** — `user_workspace/views_dnse.py` + `test_order_safety.py` (expect 403 `live_ordering_disabled`, đã có tests); claim `views_dnse` chỉ còn ở các dòng done/released — cần kiểm lại §3 trước claim.
6. **Liên quan A5**: FE/locale + `models.py:250` nhãn "System Default" + `catalog.py:42`/`model_choices.py:46` — làm trong slice riêng sau khi coordinator đóng claim stale `vi.js`/`en.js`.

## 4. Stato hiện tại

- `dev @ b509f35f8` (= `origin/dev`), tree sạch ngoại trừ 2 untracked A4 (đã ghi lý do BLOCKED, không stage).
- Mọi vòng A5 hoàn tất: claim done, ledger Entry 434, PR merge, branch xóa local + remote.

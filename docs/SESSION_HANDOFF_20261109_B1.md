# Handoff — B1 AI contract BE core (đóng vòng kín, 2026-11-09)

**Slice `b1-ai-contract` (`feat/b1-ai-contract` → PR #316 MERGED).** Nguồn sự thật: `docs/CODE_CHANGE_AUDIT_LEDGER.md` (Entry 436) + `git log origin/dev` + `docs/CLAIMS.md` (claim `b1-ai-contract` = done) + `docs/evidence/b1-ai-contract/`.

## 1. Đã merge

| Commit | Nội dung |
|---|---|
| `b2a1a3a37` | Claim riêng (`b1-ai-contract` in-progress) |
| `06aa4ac5e` | PLAN B1 (B2 REV3) + B1 measure + audit PASS |
| `bd0458abe` | BE core: orchestrator return schema + tasks structured output + serializers posture/levels (RED→GREEN VPS, B8 pending) |
| `2554484af` | fix fail-closed theo posture (`structured.get('posture')`) |
| `10216ead4` | audit fix: mock posture, signal-free prompt, ai_trace/runtime fixtures, symbol-stats posture test, evidence (B8 follow-up) |
| `6199aaa93` | RED contract test (`test_b1_contract.py` RED-a/RED-b) |
| merge PR #316 | claim done + ledger Entry 436 + handoff này |

Gates B7: VPS docker-exec đã chạy thật (OK), `check-multi-agent` PASS, `check-lessons` 57/60, `check-experiment-env` PASS, `normalize-eol` OK. `pre-push-gate` **2 FAIL / 32 PASS / 2 SKIP** pre-existing (thiếu `node_modules/typescript`). **CHƯA CHẠY**: FE (vitest ai-cc-i18n-clean, labels, disclaimer), `tsc`, E2E.

## 2. Contract mới (BE)

- Orchestrator trả `posture` (enum BULLISH/BEARISH/NEUTRAL) + `levels` (support/resistance) + summary/confidence/rationale/risk_level — không còn `signal`/`signal_raw`/`recommendation`/`target_price`. Mock branch debug cũng trả posture+levels.
- Tasks structured_output ghi `posture`+`levels`, fail-closed khi posture UNKNOWN.
- Serializers expose `posture`/`levels` + giữ `side` derived từ posture (backfill legacy signal qua SSOT, không ghi mới).
- Cross-consumer: `_extract_backtest_side` loop posture trước signal; portfolio symbol-stats fallback `posture or signal`.

## 3. Còn nợ — giao phiên tiếp theo (theo thứ tự)

1. **P0-1 AUD-01** (coordinator-only, deny-list): `packages/core/backend/requirements.txt:9` pin `redis>=5.0,<6.0` vs kombu cần `redis>=6.1.0` (VPS worker 2796/beat 1575). Coordinator bump + verify `channels-redis>=4.1,<5.0`. Agent ghi `note` + báo coordinator.
2. **P0-3**: stash hotfix VPS, pull staging `5f9422694` → dev mới, migrate, `--verify` (gate RestartCount tại `scripts/deploy-staging.sh:74-116`), re-verify A1/A5/B2/B1 trên dev mới.
3. **B1-FE (follow-up)**: `useWhaleAdvisoryData.js` (`resolveSide` + `target_price`/`recommendation` đọc BE contract cũ — cần chuyển posture/levels), `WhaleSymbolSidebar.jsx` (`item.side || item.signal`), labels posture/levels + disclaimer UI + vitest ai-cc-i18n-clean. BE giữ `side` nên không vỡ ngay.
4. **B2 FE follow-up**: `workspace.js` nhãn "phiếu thử nghiệm"/FE order UI — cần coordinator đóng 2 claim in-progress stale (`:1826` w0-10-close-be-gaps, `:1886` pm-review-20261108).
5. **A4-remainder**: BLOCKED — coordinator đóng `CLAIMS.md:1754` trước; untracked `docs/PLAN_A4_ROADMAP_20261109.md` + `docs/evidence/a4-roadmap/` đợi nguyên.
6. **A5 follow-up**: FE/locale + `models.py:250` nhãn "System Default" (migration, coordinator).
7. **Tests coverage**: khôi phục dạng posture cho `test_vietnamese_sell_survives_serializer`/`test_negated_buy_is_unknown_not_buy`/`test_confidence_never_invents_value` (đã xóa đợt đổi contract; SSOT normalize không đổi).

## 4. Hạ tầng test DB cho phiên sau

Django test DB qua pgbouncer fail `FATAL: no such database: test_vninvest_core`. Workaround đã dùng ở A5/B2/B1: helper python trong container đổi host `pgbouncer:6432` → `core-db:5432` **per-exec** (không in password, không đổi config infra). VPS container bake code nên `docker cp` đè file src+test mới, chạy xong restore.

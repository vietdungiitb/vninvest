# Handoff — B2 live-order guard W1.2 (đóng vòng kín, 2026-11-09)

**Slice `b2-live-guard` (`feat/b2-live-guard` → PR #315 MERGED).** Nguồn sự thật: `docs/CODE_CHANGE_AUDIT_LEDGER.md` (Entry 435) + `git log origin/dev` + `docs/CLAIMS.md` (claim `b2-live-guard` = done) + `docs/evidence/b2-live-guard/`.

## 1. Đã merge

| Commit | Nội dung |
|---|---|
| `d298c0a88` | Claim riêng (`b2-live-guard` in-progress) |
| `9db59ffee` | PLAN B2 + B1 measure (doc-only, B3 PASS 2 vòng sau 2 OBJ citation) |
| `4ee240392` | Evidence VPS B6 (B8 audit bắt stage) |
| merge PR #315 | claim done + ledger Entry 435 + handoff này |

Gates B7: VPS docker-exec đã chạy thật (OK), `check-multi-agent` PASS, `check-lessons` 57/60, `check-experiment-env` PASS, `normalize-eol` OK. `pre-push-gate` **2 FAIL / 32 PASS / 2 SKIP** pre-existing (thiếu `node_modules/typescript`). **CHƯA CHẠY**: FE/locale, `models.py:250`, P0-1, `tsc`, E2E, BE suite toàn repo.

## 2. Kết luận slice (pattern A1)

- `views_dnse.py:392-401` live → 403 `live_ordering_disabled` (kèm `field_errors` 3 gate thiếu). `paper` → `dry_run=True` do server quyết (`:403-404`). `workspace.js:23-30` default paper.
- VPS (docker cp đè cả 2 file dev `35ca2afc5` vào container staging bake `5f9422694`): full `user_workspace.test_order_safety` **49 tests OK** (skipped=3, 9.07s) + live 6 explicit OK. Restore md5 khớp, VPS tree chỉ còn dirty sẵn có.
- Không sửa code — đóng bằng "không còn bug" (không bịa fail-before). B8: PASS (0 blocker; 1 major là evidence chưa stage, đã fix trước merge).

## 3. Còn nợ — giao phiên tiếp theo (theo thứ tự)

1. **P0-1 AUD-01** (coordinator-only, deny-list): `packages/core/backend/requirements.txt:9` pin `redis>=5.0,<6.0` vs kombu cần `redis>=6.1.0` (VPS worker 2796/beat 1575). Coordinator bump + verify `channels-redis>=4.1,<5.0`. Agent ghi `note` + báo coordinator.
2. **P0-3**: stash hotfix VPS (`M docker-compose.staging.yml`), pull staging `5f9422694` → dev mới, migrate, `--verify` (gate RestartCount tại `scripts/deploy-staging.sh:74-116`), re-verify A1/A5/B2 trên dev mới.
3. **B1 (L-size)**: orchestrator return schema `:845-891` đổi khỏi `signal/target_price/recommendation` sang `posture/levels` + serializer advisory + i18n + disclaimer UI. Lưu ý cascade: `tasks.py` `PICK_KEYS` (`signal`, `confidence_score`), `serializers.py` `get_signal:206-214`, `get_recommendation`, `get_target_price`, backtest/parametrize tests trong `test_advisory_api_contract.py` (assert `signal==SELL`), `test_advisory_ssot.py`, `test_advisory_orchestrator_contract.py` (fixture có `signal/target_price`). Mở slice riêng, tách FE/i18n nếu chạm claim.
4. **B2 FE follow-up**: `workspace.js` nhãn "phiếu thử nghiệm"/FE order UI — cần coordinator đóng 2 claim in-progress stale (`:1826` w0-10-close-be-gaps, `:1886` pm-review-20261108).
5. **A4-remainder**: BLOCKED — coordinator đóng `CLAIMS.md:1754` trước; untracked `docs/PLAN_A4_ROADMAP_20261109.md` + `docs/evidence/a4-roadmap/` đợi nguyên (không stage lung tung).
6. **A5 follow-up**: FE/locale + `models.py:250` nhãn "System Default" (migration, coordinator).

## 4. Hạ tầng test DB cho phiên sau

Django test DB qua pgbouncer fail `FATAL: no such database: test_vninvest_core` (pgbouncer chỉ map `vninvest_core`). Workaround đã dùng ở A5+B2: helper python trong container đổi host `pgbouncer:6432` → `core-db:5432` **per-exec** (không in password, không đổi config infra). Helper tối thiểu tại `docs/evidence/b2-live-guard/EVIDENCE_B6_VPS_GATES_20261109.md` (script transient, không commit vào repo — viết lại per-session).

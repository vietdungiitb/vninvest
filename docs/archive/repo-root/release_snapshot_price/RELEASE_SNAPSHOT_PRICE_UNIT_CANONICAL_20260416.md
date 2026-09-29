# RELEASE SNAPSHOT - PRICE UNIT CANONICAL REFACTOR

Date: 2026-04-16  
Scope: Phases 0-8 (canonical unit standardization + legacy data migration)  
Branch: dev

---

## 1) Release Outcome

- Data poisoning issue resolved (same symbol no longer appears with mixed scales).
- Canonical quote unit standardized to THOUSAND_VND from adapter through UI.
- Legacy DailyPrice historical records migrated and post-checked clean.

---

## 2) Commit Evidence

Primary implementation chain:

- `9154c681` - Phase 0-1 canonical standardization foundation
- `1c8b3af0` - Phase 2-6 backend canonical refactor
- `722b225e` - Phase 6 frontend heuristic removal pass
- `64234c9c` - Phase 8 final audit documentation
- `f5e13a88` - Sync progress dashboard with actual phase state
- `32a6c991` - Remove StockDetail normalize helpers completely
- `64f9b1a0` - Add safe Phase 7 migration command + dry-run docs
- `235ed347` - Execute migration force + finalize post-check docs
- `a0e8931a` - Add changelog summary and dashboard sync

---

## 3) Test and Build Evidence

Backend tests:
- `tests/test_price_units_canonical.py` -> 40 passed
- `tests/test_adapter_canonical.py` -> 8 passed
- Total -> 48/48 passed

Frontend build:
- `npm run build` -> Compiled successfully

---

## 4) Migration Evidence (Phase 7)

Command:
- `python manage.py finalize_price_unit_migration --force`

Pre-check (dry-run):
- Scope records: 71,655
- Suspicious (`close_price > 1000`): 71,288

Apply:
- Updated rows: 71,288

Post-check (dry-run):
- Suspicious (`close_price > 1000`): 0

---

## 5) Rollback Note

Code rollback (if needed):
- Revert to commit before canonical chain rollout in dev history.
- Recommended operational rollback anchor: `449ab6fe` (pre-canonical sequence in this branch history view).

Data rollback (if migration must be reversed):
- There is no automatic reverse migration command currently.
- Safe rollback path is DB backup restore taken before `--force` run.
- If backup restore is not available, custom one-off reverse script is required and must be validated in staging first.

---

## 6) Audit File Index

Core docs for this release:
- `AUDIT_PRICE_UNIT_CANONICAL_PHASE1_20260416.md`
- `AUDIT_PRICE_UNIT_CANONICAL_PHASE2_6_20260416.md`
- `PROGRESS_DASHBOARD_CANONICAL_UPDATE_20260416.md`
- `PROGRESS_DASHBOARD.md`
- `backend/CHANGELOG.md`
- `RELEASE_SNAPSHOT_PRICE_UNIT_CANONICAL_20260416.md`

Status: READY FOR QA SIGN-OFF

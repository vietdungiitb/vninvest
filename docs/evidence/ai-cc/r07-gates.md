# R0.7 gates — audit FK + usage (plan Rev.2 §R0.7)

Branch: `feat/ai-r07-audit` (stack tren `feat/ai-r06-ssrf`, PR #177 chua merge)
Claim: `ai-r07` · Migration: advisory 0013 + ai_analytics 0002 (makemigrations sinh,
khong tu dat so) · Khong FE · Khong package.json.

## 1. AC doi chieu (L-V02: doc code that truoc khi ket luan)

| AC | Plan | Truoc fix (code that) | Sau fix |
|---|---|---|---|
| AC1 | User A khong thay log user B | **DO**: `AIAuditLog` khong co FK, view loc theo `actor` CharField (R0.11) — actor gia duoc | FK `user` + scope `Q(user) \| Q(legacy actor)` |
| AC2 | Staff tenant A khong thay log tenant B | **DO**: staff thay ALL (`objects.all()`) | Hint `X-Tenant-ID`/`?tenant=` qua SSOT `resolve_tenant_for_user`; hint la ma khong membership => `none()` |
| AC3 | Moi create truyen user+tenant | **DO**: 3 diem create (PAV:1279,1399,1461) chi co actor | Ca 3 + user/tenant; test source-scan |
| AC4 | `?actor=admin` khong tra `administrator` | **DO**: `actor__icontains` (PAV:1682) | Exact match `actor=` |
| AC5 | POST /ai/usage/ → 405 | **DO**: 201 + echo lai tokens user gui (bang chung trong output RED) | 405 + message tinh. FE chi GET (workspace.js:746-760) |
| AC6 | Task chay => record du provider/model/tokens/latency/status | **DO**: 0 writer ngoai test | Instrument `generate_advisory_task` (do latency that, floor 1ms) |
| AC7 | Loi provider => record error | **DO**: khong ghi | Except path ghi status='error', tokens 0 |
| AC8 | Nightly summary, 2 lan khong dup | **DO**: khong co task | Moi `rollup_usage_daily` (update_or_create theo unique). Chua noi beat — bao coordinator (follow-up) |
| AC9 | Usage that, thieu => 0 + co | **DO**: chi doc total_tokens | Moi `_extract_usage` (2 nhanh test); khong co thi (0,0,True) |
| AC10 | Cost tu bang gia, khong thi 0 + co | **DO**: khong co bang gia, khong co | Moi `_resolve_cost` => (0, False) + field `pricing_available`; `usage_unavailable`/`pricing_available` vao model+serializer (migration 0002) |

Backfill 0013: actor→User.username; khong khop => NULL + `legacy_unattributed=True`;
tenant de NULL (khong biet — khong gan sai). Response them `legacy_unattributed_count`.

## 2. Fail-before (VPS Postgres, DB tam ai_r07)

- 7 test: **6 ERROR + 1 FAIL** — `TypeError: AIAuditLog() got unexpected keyword
  arguments: 'user', 'tenant'` (5) · `No module named 'ai_analytics.tasks'` (1) ·
  `201 != 405` (AC5).
- Hoi quy sau fix lan 1: **3 ERROR** `AdvisoryRefreshViewFallbackTests` —
  helper moi chen giua `@shared_task` va `generate_advisory_task`, cuop decorator
  (`.delay` mat; production `.delay()` cung se crash). Fix: tra decorator ve
  (1+/1-). Test cu bat duoc — khong can test moi.

## 3. GREEN (VPS Postgres, commit 614bc3c71)

- Moi: `test_ai_audit_tenant_isolation` + `test_ai_usage_instrumentation` → 12/12.
- Hoi quy: audit_logs + management_center + cc_config_isolation + cc_prompt_history
  + cc_r04_r05 + cc_r0_foundation + endpoint_probe + endpoint_safety + r06 +
  usage_permissions → 122/122 (tong **134/134 OK**).

## 4. Gate khac

- `makemigrations --check --dry-run`: No changes detected.
- `check-multi-agent`: 0 loi · `agent-sync`: dong bo origin/dev, khong trung migration.
- `pre-push-gate`: 23/23 (system-design regen: migration 122→124 + model catalog;
  can `PYTHONUTF8=1` tren console cp1252 — bug latent cua `gen-model-catalog.py`,
  follow-up).
- FE/tsc/i18n/build: KHONG CHAM FE → **CHUA CHAY**.

## 5. Non-goals / follow-up

- Beat schedule cho rollup (bao coordinator; task test truc tiep theo AC8).
- Bang gia AICostRate (R2.x pricing; hien cost=0 + co).
- TOCTOU rebinding (giu residual risk tu R0.6).
- R0.9 (tach lop A/B): slice tiep theo.
- Don sach: worktree VPS `/tmp/ai-r07` + DB `ai_r07` (sau verify).

# CLAIMS — Registry công việc đang giữ (multi-agent)

> **Cơ chế chống xung đột số 1: hai agent không được sửa cùng một file mà không khai báo.**
>
> File này **append-only ở CUỐI file**. Không sửa, không xoá, không sắp xếp lại dòng cũ.
> `.gitattributes` đã đặt `merge=union` cho file này ⇒ hai agent cùng append sẽ **tự merge, không conflict**.
>
> **Cách dùng:** trước khi sửa file, kiểm tra cột `files`. Nếu file đã bị agent khác giữ mà agent đó còn `in-progress` ⇒ **dừng, không sửa**. Nếu `done` hoặc `released` thì được sửa (nhưng phải đổi claim sang mình).
> Xác nhận tự động: `node packages/web/scripts/check-multi-agent.mjs`

## Quy tắc đặt claim

| Trạng thái | Ý nghĩa | Agent khác được làm gì |
|---|---|---|
| `proposed` | Đã khai, chưa bắt đầu | được sửa nếu cần, nhưng phải báo lại trong claim của mình |
| `in-progress` | Đang sửa | **KHÔNG** được sửa file đó. Phải chờ hoặc phối hợp |
| `blocked` | Bị chặn bởi yêu cầu ngoài | được sửa, nhưng ghi chú vào claim của mình |
| `done` | Xong, chưa merge | được sửa nếu cần thiết, ưu tiên mở PR hợp nhất |
| `released` | Đã merge, claim mở lại cho ai cũng được | tự do |

**Cột `files` là danh sách glob.** Ví dụ `packages/core/backend/src/advisory/views.py` hoặc `packages/core/backend/src/advisory/*`.

**File bị khóa tập trung (shared file)** — xem `docs/AGENT_PROTOCOL.md` §2. Agent **không bao giờ** claim các file này.

---

## Claims đang hoạt động

<!-- APPEND BELOW THIS LINE. Keep newest at the BOTTOM. One row per claim. -->

| agent | branch | scope | files | status | since | note |
|---|---|---|---|---|---|---|
| `core-team` | `feat/advisory-runtime-integrity` | AI CC Slice C — multi-tenant config plane | `packages/core/backend/tests/test_ai_cc_config_isolation.py`, `packages/web/src/shared/providerModels.ts` | done | 2026-09-26 | Đã lên branch. Xác minh: test file + `providerModels.ts` có trong `dev..HEAD`. PR #9. |
| `core-team` | `feat/advisory-runtime-integrity` | AI Advisory (Entry 215) | `packages/core/backend/src/advisory/{orchestrator,serializers,tasks,urls,views,models}.py` | done | 2026-09-26 | Đã lên branch. Xác minh: 10 file advisory thay đổi, gồm module mới `signal_norm.py` (SSOT signal) — **trùng mục R0.1 của plan AI CC**. PR #9. |
| `core-team` | `feat/advisory-runtime-integrity` | i18n hardcode gate | `packages/web/src/components/{advisory/*,WhaleBubbleChart.jsx,dashboard/WhaleAnalyticsTab.jsx}`, `packages/web/src/pages/signals/WhaleAdvisoryPage.tsx` | done | 2026-09-26 | Đóng sau commit coordinator `b32ac3f1`: `check:i18n-hardcoded` đã đăng ký trong `package.json` + nối vào `check:shell`. Trước đó script có trong tree nhưng **chưa được gọi từ đâu**. PR #9. |
| `ai-cc-agent` | `feat/ai-cc-r0` | ~~AI Advisory W0 — contract BE~~ | `packages/core/backend/src/advisory/signal_norm.py`, `model_choices.py`, `orchestrator.py`, `tasks.py`, `serializers.py` | superseded | 2026-09-26 | **Đã bị `core-team` làm trước trong PR #9.** `signal_norm.py` + `model_choices.py` + 4 file kia đều đã có trong branch. Claim này thành vô nghĩa — không tạo lại thứ đã tồn tại. Worktree `C:\Mujoco Projects\agent-ai-cc` + DB `aicc_r0` vẫn giữ để dùng lại. |

## Claims đã đóng

<!-- APPEND BELOW THIS LINE. -->

| agent | branch | scope | status | closed | note |
|---|---|---|---|---|---|
| `audit-agent` | `dev` (954c0ef2, c21711d4) | Audit + plan AI Command Center | released | 2026-09-26 | Doc-only, 0 dòng runtime. Plan `docs/IMPLEMENTATION_PLAN_AI_COMMAND_CENTER_COMMERCIAL_20260925.md` (46 slice). |
| `ai-cc-agent` | `feat/ai-cc-r0` | ~~AI Command Center R0 wave~~ | superseded | 2026-09-26 | **Claim gốc vi phạm chính protocol:** khai 5 file mà chưa kiểm tra `core-team` đã giữ 2 trong số đó (`portfolio_analytics_views.py`, `providerModels.ts`). Đã thu hẹp lại 6 file advisory-only. Không sửa file nào. Bài học: **kiểm tra CLAIMS.md + `git status` TRƯỚC khi khai claim, không phải sau.** |

| `advisory-audit` | `feat/advisory-audit` | ~~Audit AI Advisory W0 contract BE~~ | — | released | 2026-09-26 | Được cấp phát nhưng **chưa tạo file nào, 0 commit** — audit bị `core-team` làm trong PR #9 (ledger Entry 231). Worktree `C:\Mujoco Projects\advisory-audit` + DB `ag_advisory_audit` giữ nguyên để tái dùng. Không có citation nào cần rebase vì không có việc. |

## Self-service tenant register + workspace hardening (2026-09-26) — 6 slice, file DISJOINT

Base `dev` = `2e172cb8`. Worktree = `C:\Mujoco Projects\tenantreg-<x>`, branch `feat/tenantreg-<x>`, DB `tr_<x>`.
Coordinator split file ownership so that **no two slices touch the same file**. `settings.py` is coordinator-gated (slice S only).

| agent | branch | scope | files | status | since | note |
|---|---|---|---|---|---|---|
| `tenantreg-s` | `feat/tenantreg-s` | Slice S — settings/security infra (PREREQUISITE, runs first) | `packages/core/backend/src/vninvest_core/settings.py`, `packages/core/backend/src/vninvest_core/env_validation.py`, `packages/core/backend/src/vninvest_core/client_ip.py` (new), `packages/web/docker/nginx.conf`, `frontend/docker/nginx.conf` | in-progress | 2026-09-26 | Fix double-assign `STRICT_TURNSTILE_ENFORCEMENT` (settings.py:182 vs :792), `TESTING` argv substring (settings.py:10), add missing `RESEND_IP_LIMIT_THRESHOLD`/`RESEND_SUBNET_LIMIT_THRESHOLD`, create `get_client_ip()` SSOT, add `TURNSTILE_SECRET_KEY` to prod env validation, nginx real_ip. MUST NOT schedule `manage_subscriptions_lifecycle` (slice C reports that need). |
| `tenantreg-a` | `feat/tenantreg-a` | Slice A — BE registration/auth pipeline | `packages/core/backend/src/identity_access/views/register.py`, `packages/core/backend/src/identity_access/serializers.py`, `packages/core/backend/src/identity_access/views/password_reset.py`, `packages/core/backend/src/identity_access/views/password_change.py`, `packages/core/backend/src/identity_access/views/login.py`, `packages/core/backend/src/identity_access/security_utils.py`, `packages/core/backend/src/identity_access/throttles.py`, `packages/core/backend/src/identity_access/onboarding_views.py`, `packages/core/backend/src/identity_access/email_tasks.py`, `packages/core/backend/src/identity_access/tests/test_tenantreg_a*.py` (new) | in-progress | 2026-09-26 | P0: reset-confirm field mismatch, `validate_password` bypass, turnstile double-assign, enumeration, 500-after-commit, non-atomic rate limits, onboarding unreachable, password reset/change must revoke PATs. Uses `client_ip.get_client_ip()` from slice S. Owns `CoreTenantSerializer` read-only fix (plan/status). |
| `tenantreg-b` | `feat/tenantreg-b` | Slice B — BE tenant isolation + resolver unification | `packages/core/backend/src/identity_access/middleware.py`, `packages/core/backend/src/identity_access/utils/resolve_tenant.py`, `packages/core/backend/src/identity_access/permissions.py`, `packages/core/backend/src/identity_access/authentication.py`, `packages/core/backend/src/user_workspace/permissions.py`, `packages/core/backend/src/ops_audit/views.py`, `packages/core/backend/src/ops_audit/middleware.py`, `packages/core/backend/src/identity_access/tests/test_tenantreg_b*.py` (new) | in-progress | 2026-09-26 | P0: `resolve_tenant()` trusts `X-Tenant-ID` with no membership check; `logger` NameError x3; `AuditLogListView` degrades to `objects.all()`; PAT CIDR bypass via XFF; 4 divergent tenant resolvers. Uses `client_ip.get_client_ip()` from slice S. |
| `tenantreg-c` | `feat/tenantreg-c` | Slice C — lifecycle / quota / deprovision correctness | `packages/core/backend/src/identity_access/tasks.py`, `packages/core/backend/src/identity_access/models.py`, `packages/core/backend/src/tenant_lifecycle/tasks.py`, `packages/core/backend/src/tenant_lifecycle/models.py`, `packages/core/backend/src/commercial/tasks.py`, `packages/core/backend/src/commercial/models.py`, `packages/core/backend/src/data_ingest/tasks.py`, `*/migrations/*` (only via `makemigrations`), `packages/core/backend/tests/test_tenantreg_c*.py` (new) | in-progress | 2026-09-26 | P0: `deprovision_tenant_async` FieldError (`CorePATCredential` has no `tenant`); `QuotaRecord.api_calls_limit` default -1 and no writer so quota is NEVER enforced; outbox double-consumer marks PROCESSED without sending mail; `CoreServiceAccount` missing unique (tenant,name). **Does NOT touch settings.py** — reports the `CELERY_BEAT_SCHEDULE` additions it needs for the coordinator. |
| `tenantreg-d` | `feat/tenantreg-d` | Slice D — FE auth screens + i18n | `packages/web/src/pages/auth/*`, `packages/web/src/components/auth/*`, `packages/web/src/adapters/core/auth.js`, `packages/web/src/adapters/coreApiAdapter.d.ts`, `packages/web/src/i18n/vi.js`, `packages/web/src/i18n/en.js`, `packages/web/src/__tests__/*tenantreg*d*` (new) | in-progress | 2026-09-26 | P0: Turnstile reads `process.env.REACT_APP_*` in a Vite app so it silently uses the always-pass Cloudflare **test** key and blocks prod registration; password-reset confirm sends wrong field name; duplicate top-level `auth:` i18n key kills 40 keys/locale; 429/field-error handling; a11y labels; client password rule 8 vs BE 10. ONLY slice allowed to add i18n keys. |
| `tenantreg-e` | `feat/tenantreg-e` | Slice E — FE session + tenant switch | `packages/web/src/context/PortfolioContext.js`, `packages/web/src/adapters/core/transport.js`, `packages/web/src/layouts/full/vertical/sidebar/Sidebar.tsx`, `packages/web/src/layouts/full/**Header*.tsx`, `packages/web/src/components/StaffRoute.tsx`, `packages/web/src/hooks/useCoreQuery.ts`, `packages/web/src/providers/QueryProvider.tsx`, `packages/web/src/__tests__/*tenantreg*e*` (new) | in-progress | 2026-09-26 | P0: `switchTenant` writes localStorage but transport reads sessionStorage so `X-Tenant-ID` is NEVER sent — tenant switch is a no-op end-to-end; logout never revokes the PAT and never clears `tenant_id` (cross-user 403); `userIdentity.id`/`entitlements` permanently null from `/identity/profile/`. **Adds NO i18n keys** (slice D owns vi.js/en.js) — use existing keys or `t(key, { defaultValue })`. |

## Portfolio Commercial PA-4 — models/worker slice (2026-09-26)

Base `dev`. Worktree = `C:\Mujoco Projects\pf4-modelsworker`, branch `feat/pf4-modelsworker`, DB `ag_pf4_modelsworker`.
Audit: `docs/AUDIT_PORTFOLIO_COMMERCIAL_REDESIGN_20260925.md` §D1 (`P0-ISO-03`, `P0-MIG-01`, `P0-DATA-01`, `P0-DATA-02`).
Plan: `docs/IMPLEMENTATION_PLAN_PORTFOLIO_COMMERCIAL_HARDENING_20260925.md` TEN-04 / TEN-05 / LED-02.
Evidence: `docs/evidence/portfolio-commercial/pa-4-gates.md`.

| agent | branch | scope | files | status | since | note |
|---|---|---|---|---|---|---|
| `pf4-modelsworker` | `feat/pf4-modelsworker` | PA-4 — `user_workspace` models/worker: repair migration `0008` (`FieldError TenantMember.is_active`), `UserBrokerConfig.tenant` FK + unique + quarantine backfill, `SubAccount` signal tenant, `Transaction` financial validators | `packages/core/backend/src/user_workspace/models.py`, `packages/core/backend/src/user_workspace/tasks.py`, `packages/core/backend/src/user_workspace/signals.py`, `packages/core/backend/src/user_workspace/migrations/0019_pf4_tenant_and_financial_guards.py`, `packages/core/backend/src/user_workspace/test_worker_tenant.py`, `packages/core/backend/src/user_workspace/test_broker_config_tenant.py`, `packages/core/backend/src/user_workspace/test_migration_0008_rehearsal.py`, `docs/evidence/portfolio-commercial/pa-4-gates.md` | done | 2026-09-26 | Xong, chưa merge. **AC 8/8 PASS.** Chọn phương án (a): `0008` **đã apply** (`vninvest_core` 2026-05-22 17:43:57 UTC, `aicc_r0`) ⇒ không sửa (BR-07); tạo `0019_pf4_tenant_and_financial_guards` (số do `makemigrations` tự đặt, head đọc từ `origin/dev` = `0018_broker_config_unverified`). `UserBrokerConfig.tenant` `null=True` (expand) — số row thật ở dev = 0 **không chứng minh được cho production**, nên NOT NULL ngay sẽ chặn deploy; contract phase để ticket sau. 3 CONTRADICTION với đề bài đã kiểm chứng bằng bằng chứng, ghi ở evidence §8: (1) `SubAccount` **đã có** signal tại `models.py:901` nhưng bản cũ dùng `.first()` + tự tạo `CoreTenant` trong `save()`; (2) `bulk_update(['tenant_id'])` **không** phải lỗi (probe Django 6.0.6); (3) `0008.reverse_backfill` nguy hiểm hơn `FieldError` — `objects.all().update(tenant=None)` **không chạy được** sau `0012` (NotNullViolation) ⇒ reverse của `0019` là no-op có chủ đích. Gate: `check` 0 · `makemigrations --check` exit 0 · 19/19 applied, 1 leaf · 3 suite mới `58/58 OK` · rehearsal thật `migrate 0018→0019` trên DB có dữ liệu (assigned=1/quarantined=1, idempotent) · `user_workspace` 170 tests 4 errors **PRE-EXISTING** (reproduce `git stash` trên HEAD sạch) · `identity_access` 288 tests 1 error PRE-EXISTING · `check:multi-agent` PASS. **CHƯA CHẠY:** harness `migration-rehearsal` trên CI, chạy trên DB clone có dữ liệu production-like (evidence §11). 9 việc ngoài phạm vi đã báo coordinator, không tự sửa (evidence §10) — trong đó quan trọng nhất: `views_broker.py`/`views_dnse.py` vẫn gọi helper không truyền `tenant` (tương thích ngược + log warning) nên credential **còn tenant-blind** tới khi view được migrate. |
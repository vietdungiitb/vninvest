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
| `tenantreg-s` | `feat/tenantreg-s` | Slice S — settings/security infra (PREREQUISITE, runs first) | `packages/core/backend/src/vninvest_core/settings.py`, `packages/core/backend/src/vninvest_core/env_validation.py`, `packages/core/backend/src/vninvest_core/client_ip.py` (new), `packages/web/docker/nginx.conf`, `frontend/docker/nginx.conf` | released | 2026-09-26 | Fix double-assign `STRICT_TURNSTILE_ENFORCEMENT` (settings.py:182 vs :792), `TESTING` argv substring (settings.py:10), add missing `RESEND_IP_LIMIT_THRESHOLD`/`RESEND_SUBNET_LIMIT_THRESHOLD`, create `get_client_ip()` SSOT, add `TURNSTILE_SECRET_KEY` to prod env validation, nginx real_ip. MUST NOT schedule `manage_subscriptions_lifecycle` (slice C reports that need). |
| `tenantreg-a` | `feat/tenantreg-a` | Slice A — BE registration/auth pipeline | `packages/core/backend/src/identity_access/views/register.py`, `packages/core/backend/src/identity_access/serializers.py`, `packages/core/backend/src/identity_access/views/password_reset.py`, `packages/core/backend/src/identity_access/views/password_change.py`, `packages/core/backend/src/identity_access/views/login.py`, `packages/core/backend/src/identity_access/security_utils.py`, `packages/core/backend/src/identity_access/throttles.py`, `packages/core/backend/src/identity_access/onboarding_views.py`, `packages/core/backend/src/identity_access/email_tasks.py`, `packages/core/backend/src/identity_access/tests/test_tenantreg_a*.py` (new) | released | 2026-09-26 | P0: reset-confirm field mismatch, `validate_password` bypass, turnstile double-assign, enumeration, 500-after-commit, non-atomic rate limits, onboarding unreachable, password reset/change must revoke PATs. Uses `client_ip.get_client_ip()` from slice S. Owns `CoreTenantSerializer` read-only fix (plan/status). |
| `tenantreg-b` | `feat/tenantreg-b` | Slice B — BE tenant isolation + resolver unification | `packages/core/backend/src/identity_access/middleware.py`, `packages/core/backend/src/identity_access/utils/resolve_tenant.py`, `packages/core/backend/src/identity_access/permissions.py`, `packages/core/backend/src/identity_access/authentication.py`, `packages/core/backend/src/user_workspace/permissions.py`, `packages/core/backend/src/ops_audit/views.py`, `packages/core/backend/src/ops_audit/middleware.py`, `packages/core/backend/src/identity_access/tests/test_tenantreg_b*.py` (new) | released | 2026-09-26 | P0: `resolve_tenant()` trusts `X-Tenant-ID` with no membership check; `logger` NameError x3; `AuditLogListView` degrades to `objects.all()`; PAT CIDR bypass via XFF; 4 divergent tenant resolvers. Uses `client_ip.get_client_ip()` from slice S. |
| `tenantreg-c` | `feat/tenantreg-c` | Slice C — lifecycle / quota / deprovision correctness | `packages/core/backend/src/identity_access/tasks.py`, `packages/core/backend/src/identity_access/models.py`, `packages/core/backend/src/tenant_lifecycle/tasks.py`, `packages/core/backend/src/tenant_lifecycle/models.py`, `packages/core/backend/src/commercial/tasks.py`, `packages/core/backend/src/commercial/models.py`, `packages/core/backend/src/data_ingest/tasks.py`, `*/migrations/*` (only via `makemigrations`), `packages/core/backend/tests/test_tenantreg_c*.py` (new) | released | 2026-09-26 | P0: `deprovision_tenant_async` FieldError (`CorePATCredential` has no `tenant`); `QuotaRecord.api_calls_limit` default -1 and no writer so quota is NEVER enforced; outbox double-consumer marks PROCESSED without sending mail; `CoreServiceAccount` missing unique (tenant,name). **Does NOT touch settings.py** — reports the `CELERY_BEAT_SCHEDULE` additions it needs for the coordinator. |
| `tenantreg-d` | `feat/tenantreg-d` | Slice D — FE auth screens + i18n | `packages/web/src/pages/auth/*`, `packages/web/src/components/auth/*`, `packages/web/src/adapters/core/auth.js`, `packages/web/src/adapters/coreApiAdapter.d.ts`, `packages/web/src/i18n/vi.js`, `packages/web/src/i18n/en.js`, `packages/web/src/__tests__/*tenantreg*d*` (new) | released | 2026-09-26 | P0: Turnstile reads `process.env.REACT_APP_*` in a Vite app so it silently uses the always-pass Cloudflare **test** key and blocks prod registration; password-reset confirm sends wrong field name; duplicate top-level `auth:` i18n key kills 40 keys/locale; 429/field-error handling; a11y labels; client password rule 8 vs BE 10. ONLY slice allowed to add i18n keys. |
| `tenantreg-e` | `feat/tenantreg-e` | Slice E — FE session + tenant switch | `packages/web/src/context/PortfolioContext.js`, `packages/web/src/adapters/core/transport.js`, `packages/web/src/layouts/full/vertical/sidebar/Sidebar.tsx`, `packages/web/src/layouts/full/**Header*.tsx`, `packages/web/src/components/StaffRoute.tsx`, `packages/web/src/hooks/useCoreQuery.ts`, `packages/web/src/providers/QueryProvider.tsx`, `packages/web/src/__tests__/*tenantreg*e*` (new) | released | 2026-09-26 | P0: `switchTenant` writes localStorage but transport reads sessionStorage so `X-Tenant-ID` is NEVER sent — tenant switch is a no-op end-to-end; logout never revokes the PAT and never clears `tenant_id` (cross-user 403); `userIdentity.id`/`entitlements` permanently null from `/identity/profile/`. **Adds NO i18n keys** (slice D owns vi.js/en.js) — use existing keys or `t(key, { defaultValue })`. |

## Portfolio commercial hardening (2026-09-26) — PA-2, file DISJOINT

Base `dev`. Worktree = `C:\Mujoco Projects\pf2-analyticsledger`, branch `feat/pf2-analyticsledger`, DB `ag_pf2_analyticsledger`.
Env: `CORE_DATABASE_URL=postgresql://vninvest:devpassword@127.0.0.1:5433/ag_pf2_analyticsledger` + `DJANGO_DEBUG=1`.

<!-- APPEND BELOW THIS LINE. Keep newest at the BOTTOM. -->

| agent | branch | scope | files | status | since | note |
|---|---|---|---|---|---|---|
| `pf2-analyticsledger` | `feat/pf2-analyticsledger` | PA-2 — analytics tenant scope (P0-ISO-01) + ledger semantics cổ tức/phí/thuế/realized P&L (P0-DATA-03) + provenance (P1-DATA-03) | `packages/core/backend/src/user_workspace/portfolio_analytics_views.py`, `packages/core/backend/src/user_workspace/ledger/__init__.py`, `packages/core/backend/src/user_workspace/ledger/holdings.py`, `packages/core/backend/src/user_workspace/ledger/services.py`, `packages/core/backend/src/user_workspace/test_analytics_tenant_matrix.py`, `packages/core/backend/src/user_workspace/test_ledger_holdings.py`, `packages/core/backend/src/user_workspace/test_golden/holdings.json`, `docs/evidence/portfolio-commercial/pa-2-gates.md` | released | 2026-09-26 | Dòng này **thay thế** dòng `proposed` của coordinator cho `pf2-analyticsledger` (dòng đó ghi "(chua khai file cu the)"). Bỏ hậu tố `(new)` trong cột `files` vì `check-multi-agent.mjs` ghép thẳng chuỗi vào `fs.existsSync` nên `(new)` sinh cảnh báo giả. Fix: `_get_user_portfolio()` lọc thêm `tenant` dùng `request.tenant` do `TenantResolutionMiddleware` gán sẵn (`identity_access/middleware.py:112`) — **không** tạo resolver thứ 5 (tenantreg-b đang hợp nhất 4 resolver). 404 không 403 để tránh oracle tồn tại. **Blast radius thật = 4 endpoint có route** (`urls.py:54-57`); 4 view `PortfolioChartView`/`PortfolioEquityCurveView`/`PortfolioAllocationView`/`PortfolioSyncView` import ở `urls.py:9-13` nhưng không có route = code chết, vẫn sửa scope nhưng KHÔNG xoá. **KHÔNG tạo migration** (`*/migrations/*` do `tenantreg-c` claim; head vẫn `0018_broker_config_unverified.py`). **KHÔNG** sửa `user_workspace/permissions.py` (tenantreg-b claim) hay `test_portfolio_analytics_native_routes.py` (ngoài phạm vi). **Còn nợ (xem `pa-2-gates.md` §6/§7/§9):** (a) `meta` chưa thêm vào `holdings`/`technicals` vì chúng trả list thuần, bọc vào `{data,meta}` là breaking với `packages/web/src/adapters/core/workspace.js:150-184`; (b) `nav` chưa tính được — cần trường số dư mở đầu ⇒ migration ⇒ ngoài phạm vi; (c) `user_workspace/views.py:99-103,205-209,340-344` còn fail-open `if tenant: … else: <lọc user-only>` — **cùng anti-pattern** với cái PA-2 vừa đóng, cần ticket riêng; (d) `test_portfolio_analytics_native_routes.py:29` dùng `force_authenticate` nên fixture không còn mô tả request hợp lệ (fail-closed) — coordinator sửa. **Gate:** `check` 0 · `makemigrations --check` exit 0 · 30/30 test mới OK · AI Advisory 151/151 OK · `check-multi-agent` exit 0 · `user_workspace` 142 test / 4 error **trùng đúng baseline** 121 test / 4 error (đo bằng `git stash push -u`). **`test_portfolio_analytics_native_routes` vẫn đỏ** (pre-existing `httpx.UnsupportedProtocol` từ `legacy_proxy.py:77`) — đừng đọc là regression xanh. |
| `pf1-ordersafety` | `feat/pf1-ordersafety` | PA-1 order safety fail-closed (P0-SAFETY-01 + X.1 + X.2) | (chua khai file cu the) | superseded | 2026-09-26 | Worktree `pf1-ordersafety`. DB `ag_pf1_ordersafety`. Env: `CORE_DATABASE_URL=postgresql://vninvest:devpassword@127.0.0.1:5433/ag_pf1_ordersafety` + `DJANGO_DEBUG=1`. Hoan tat: `pwsh -File scripts/agent-sync.ps1` rồi `pwsh -File scripts/agent-pr.ps1` |

| `pf2-analyticsledger` | `feat/pf2-analyticsledger` | PA-2 analytics tenant scope + ledger semantics (P0-ISO-01 + P0-DATA-03) | (chua khai file cu the) | superseded | 2026-09-26 | Worktree `pf2-analyticsledger`. DB `ag_pf2_analyticsledger`. Env: `CORE_DATABASE_URL=postgresql://vninvest:devpassword@127.0.0.1:5433/ag_pf2_analyticsledger` + `DJANGO_DEBUG=1`. Hoan tat: `pwsh -File scripts/agent-sync.ps1` rồi `pwsh -File scripts/agent-pr.ps1` |

| `pf3-brokerhub` | `feat/pf3-brokerhub` | PA-3 broker hub SSRF + adapter lifecycle (P1-SEC-01 + P1-AUTH-01) | `packages/core/backend/src/user_workspace/broker/egress.py`, `packages/core/backend/src/user_workspace/broker/tcbs.py`, `packages/core/backend/src/user_workspace/broker/ssi.py`, `packages/core/backend/src/user_workspace/broker/base.py`, `packages/core/backend/src/user_workspace/broker/adapters.py`, `packages/core/backend/src/user_workspace/test_broker_egress.py`, `packages/core/backend/src/user_workspace/test_broker_adapter_lifecycle.py`, `docs/evidence/portfolio-commercial/pa-3-gates.md` | released | 2026-09-26 | **DONE** - egress allowlist moi (`broker/egress.py`: https-only, exact-match host, chan IP literal/loopback/link-local/metadata `169.254.169.254`, mo rong CHI qua env server-side `BROKER_EGRESS_EXTRA_HOSTS`); `tcbs.validate_secrets`/`test_connection` fail-closed co code, KHONG echo gia tri nguoi nhap; `adapters.py` co `authenticate`/`refresh`/`close` + `__enter__/__exit__`, cache client theo fingerprint (X.8: 4 read -> 1 client), SSI read bat buoc authenticate, TCBS `connection_status()` tra `unverified` truoc khi co token. C-04: capability matrix versioned trong `broker/base.py` - **coordinator noi vao `views_broker.py:31-32` (`FULLY_SUPPORTED`)**, file do coordinator giu, slice nay KHONG sua. Gate (chay lai sau rebase): check 0, makemigrations --check 0, 60/60 test moi, 13/13 regression, check-multi-agent PASS. `vnbroker` KHONG cai => `LiveBrokerContractTests` **CHUA CHAY**. Bang chung: `docs/evidence/portfolio-commercial/pa-3-gates.md`. Worktree `pf3-brokerhub`. DB `ag_pf3_brokerhub`. Env: `CORE_DATABASE_URL=postgresql://vninvest:devpassword@127.0.0.1:5433/ag_pf3_brokerhub` + `DJANGO_DEBUG=1`. Hoan tat: `pwsh -File scripts/agent-sync.ps1` rồi `pwsh -File scripts/agent-pr.ps1` |

| `pf4-modelsworker` | `feat/pf4-modelsworker` | PA-4 tenant FK + validators + worker tenant (P0-ISO-03 + P0-DATA-01/02) | (chua khai file cu the) | superseded | 2026-09-26 | Worktree `pf4-modelsworker`. DB `ag_pf4_modelsworker`. Env: `CORE_DATABASE_URL=postgresql://vninvest:devpassword@127.0.0.1:5433/ag_pf4_modelsworker` + `DJANGO_DEBUG=1`. Hoan tat: `pwsh -File scripts/agent-sync.ps1` rồi `pwsh -File scripts/agent-pr.ps1` |

## Portfolio commercial PA-1 — order safety (2026-09-26)

Worktree `C:\Mujoco Projects\pf1-ordersafety`, branch `feat/pf1-ordersafety`, DB `ag_pf1_ordersafety`.
Base `dev` = `51776e83`. File ownership **disjoint** khỏi các slice `tenantreg-*` và `pf1-*` khác.
Audit: `docs/AUDIT_PORTFOLIO_COMMERCIAL_REDESIGN_20260925.md` §D1 `P0-SAFETY-01`.

| agent | branch | scope | files | status | since | note |
|---|---|---|---|---|---|---|
| `pf1-ordersafety` | `feat/pf1-ordersafety` | PA-1 — DNSE order fail-closed + 2 P0 mới (X.1 400 regression, X.2 audit no-op) + X.3/X.4/X.5/X.6 + P1-CONTRACT-00 | `packages/core/backend/src/user_workspace/views_dnse.py`, `packages/core/backend/src/user_workspace/urls.py`, `packages/core/backend/src/user_workspace/dnse_adapter.py`, `packages/core/backend/src/user_workspace/services/idempotency.py` (new), `packages/core/backend/src/user_workspace/test_order_safety.py` (new), `packages/core/backend/src/user_workspace/test_broker_routes_unique.py` (new), `docs/evidence/portfolio-commercial/pa-1-gates.md` (new) | released | 2026-09-26 | X.1 `_validate_order_payload` chỉ đọc `volume` nhưng cả 2 caller FE gửi `quantity` ⇒ HTTP 400 giờ. X.2 `action='broker.place_order'` (18 ký tự) > `ops_audit.models.AuditEvent.action` `max_length=16` ⇒ `DataError` bị nuốt bởi `except Exception` ⇒ **không còn dòng audit nào cho order**. X.3 `market_type` không allowlist. X.4 `order_category` không validate. X.5 còn rò `str(exc)` ở `send-email-otp` + `create-trading-token`. X.6 TOCTOU: validate bản `.upper()` nhưng execute bản gốc. **KHÔNG tạo migration** (`tenantreg-c` đang claim `*/migrations/*`; `OrderJob` durable đẩy wave sau) — idempotency làm bằng Django `cache` trong `services/idempotency.py`, TTL 7 ngày. **KHÔNG đụng `ops_audit/models.py`** (`tenantreg-b` giữ `ops_audit/**`; nếu `max_length=16` cần nới thì coordinator quyết) — sửa bằng cách dùng `action` hợp lệ + đưa `broker.place_order` vào `metadata`. **Việc ngoài phạm vi phát hiện, KHÔNG tự sửa:** `ops_audit/models.py:25` `action` `max_length=16` quá hẹp cho mọi action dài → nên nới `max_length` + thêm choice `broker.*` (cần migration, để coordinator). Test FLAT `src/user_workspace/test_*.py` — **CẤM** tạo `src/user_workspace/tests/` vì `tests.py` đã tồn tại sẽ bị che. |

**KẾT QUẢ (xem `docs/evidence/portfolio-commercial/pa-1-gates.md`):** 6 commit `060467ee` (test đỏ 42 test, 32F+20E) · `913f4e0e` (route trùng) · `c922ced1` (X.1/X.3/X.4/X.6) · `d8a55ef3` (X.2 audit fail-closed) · `b8d59fd6` (SAFE-01 + idempotency + X.5) · `1ee8eafb` (evidence). Gate: `manage.py check` exit 0 · `makemigrations --check --dry-run` exit 0 · **50/50 test OK** · `check:multi-agent` exit 0 · **AC 10/10**. `dnse_adapter.py` **không cần sửa** (chỉ là glue sang `vnbroker`). **2 điều coordinator cần biết:** (1) `ops_audit.models.AuditEvent.action` `max_length=16` còn quá hẹp cho action dạng `broker.*` — nới + thêm choice cần migration nên **để coordinator/claim `ops_audit` + `*/migrations/*` xử lý**; PA-1 đi vòng bằng `action='create'` + `metadata['operation']='broker.place_order'`. (2) **Đặt lệnh đang TẮT cho tới khi FE sửa** — `DNSEConnectionPanel.js:207-218` và `AdvisoryOrderTicket.js:43-53` gửi không `mode`/`Idempotency-Key` nên luôn 400 (`order_mode_required` / `idempotency_key_required`); `packages/web/**` ngoài phạm vi PA-1 ⇒ cần ticket FE riêng. Thêm: `agent-sync.ps1` bước 5c đỏ vì **14 test pre-existing** (`manage.py test tests` ⇒ 534 test, 10F+4E, **giống hệt** khi chạy trên base `51776e83` sạch) — ngoài phạm vi, cần ticket riêng. **0 dùng `--no-verify`.**
## Portfolio Commercial PA-4 — models/worker slice (2026-09-26)

Base `dev`. Worktree = `C:\Mujoco Projects\pf4-modelsworker`, branch `feat/pf4-modelsworker`, DB `ag_pf4_modelsworker`.
Audit: `docs/AUDIT_PORTFOLIO_COMMERCIAL_REDESIGN_20260925.md` §D1 (`P0-ISO-03`, `P0-MIG-01`, `P0-DATA-01`, `P0-DATA-02`).
Plan: `docs/IMPLEMENTATION_PLAN_PORTFOLIO_COMMERCIAL_HARDENING_20260925.md` TEN-04 / TEN-05 / LED-02.
Evidence: `docs/evidence/portfolio-commercial/pa-4-gates.md`.

| agent | branch | scope | files | status | since | note |
|---|---|---|---|---|---|---|
| `pf4-modelsworker` | `feat/pf4-modelsworker` | PA-4 — `user_workspace` models/worker: repair migration `0008` (`FieldError TenantMember.is_active`), `UserBrokerConfig.tenant` FK + unique + quarantine backfill, `SubAccount` signal tenant, `Transaction` financial validators | `packages/core/backend/src/user_workspace/models.py`, `packages/core/backend/src/user_workspace/tasks.py`, `packages/core/backend/src/user_workspace/signals.py`, `packages/core/backend/src/user_workspace/migrations/0019_pf4_tenant_and_financial_guards.py`, `packages/core/backend/src/user_workspace/test_worker_tenant.py`, `packages/core/backend/src/user_workspace/test_broker_config_tenant.py`, `packages/core/backend/src/user_workspace/test_migration_0008_rehearsal.py`, `docs/evidence/portfolio-commercial/pa-4-gates.md` | released | 2026-09-26 | Xong, chưa merge. **AC 8/8 PASS.** Chọn phương án (a): `0008` **đã apply** (`vninvest_core` 2026-05-22 17:43:57 UTC, `aicc_r0`) ⇒ không sửa (BR-07); tạo `0019_pf4_tenant_and_financial_guards` (số do `makemigrations` tự đặt, head đọc từ `origin/dev` = `0018_broker_config_unverified`). `UserBrokerConfig.tenant` `null=True` (expand) — số row thật ở dev = 0 **không chứng minh được cho production**, nên NOT NULL ngay sẽ chặn deploy; contract phase để ticket sau. 3 CONTRADICTION với đề bài đã kiểm chứng bằng bằng chứng, ghi ở evidence §8: (1) `SubAccount` **đã có** signal tại `models.py:901` nhưng bản cũ dùng `.first()` + tự tạo `CoreTenant` trong `save()`; (2) `bulk_update(['tenant_id'])` **không** phải lỗi (probe Django 6.0.6); (3) `0008.reverse_backfill` nguy hiểm hơn `FieldError` — `objects.all().update(tenant=None)` **không chạy được** sau `0012` (NotNullViolation) ⇒ reverse của `0019` là no-op có chủ đích. Gate: `check` 0 · `makemigrations --check` exit 0 · 19/19 applied, 1 leaf · 3 suite mới `58/58 OK` · rehearsal thật `migrate 0018→0019` trên DB có dữ liệu (assigned=1/quarantined=1, idempotent) · `user_workspace` 170 tests 4 errors **PRE-EXISTING** (reproduce `git stash` trên HEAD sạch) · `identity_access` 288 tests 1 error PRE-EXISTING · `check:multi-agent` PASS. **CHƯA CHẠY:** harness `migration-rehearsal` trên CI, chạy trên DB clone có dữ liệu production-like (evidence §11). 9 việc ngoài phạm vi đã báo coordinator, không tự sửa (evidence §10) — trong đó quan trọng nhất: `views_broker.py`/`views_dnse.py` vẫn gọi helper không truyền `tenant` (tương thích ngược + log warning) nên credential **còn tenant-blind** tới khi view được migrate. |
## Portfolio Commercial PA-5 — FE order contract (2026-09-26)

Base `dev` (đã merge PA-1..PA-4). Worktree = `C:\Mujoco Projects\pf5-orderfe`, branch `feat/pf5-orderfe`.
Đóng nốt nợ PA-1 đã ghi ở claim trên: **đặt lệnh đang TẮT** vì FE không gửi `mode`/`Idempotency-Key`.

| agent | branch | scope | files | status | since | note |
|---|---|---|---|---|---|---|
| `pf5-orderfe` | `feat/pf5-orderfe` | PA-5 — FE gửi `mode` + `Idempotency-Key` header cho `placeDNSEOrder` | `packages/web/src/adapters/core/workspace.js`, `packages/web/src/components/DNSEConnectionPanel.js`, `packages/web/src/components/advisory/AdvisoryOrderTicket.js`, `packages/web/src/__tests__/*order*` (existing, update), `packages/web/src/adapters/core/__tests__/*dnse*` (new), `docs/evidence/portfolio-commercial/pa-5-gates.md` (new) | released | 2026-09-26 | **KHÔNG đụng `packages/web/src/adapters/core/transport.js`** — đã xác minh `corePost(path, body, options)` spread `options` vào `fetchOptions`, và `requestWithAuth` merge `...(init.headers || {})` ⇒ truyền `headers` qua `options` là đủ. `transport.js` + `PortfolioContext.js` + `useCoreQuery.ts` + `QueryProvider.tsx` thuộc `tenantreg-e`. **KHÔNG thêm i18n key** (`vi.js`/`en.js` thuộc `tenantreg-d`) — dùng `t(key, { defaultValue })` hoặc chuỗi không mới. **KHÔNG sửa `coreApiAdapter.d.ts`** (thuộc `tenantreg-d`). BE contract: `mode` ∈ {`paper`,`live`} bắt buộc trong body; `Idempotency-Key` bắt buộc là **header**; `market_type`/`order_category` allowlist (default `STOCK`/`NORMAL`); live ⇒ `live_ordering_disabled`. FE chỉ gửi `mode: 'paper'` — live phải chờ Exit-5 + license vnbroker. |

**KẾT QUẢ PA-5 (xem `docs/evidence/portfolio-commercial/pa-5-gates.md`):** 2 commit · `6c2a4491` (claim) · `180a6b60` (code). Đóng nợ PA-1 "đặt lệnh đang TẮT". **3 adapter method** (`placeDNSEOrder`/`sendDNSEEmailOtp`/`createDNSETradingToken`) + 2 UI call site gửi `mode`; `placeDNSEOrder` gửi header `Idempotency-Key`. Gate: `tsc` 0 · jest **255/255** · `test:components` lần 1 **545/545** · eslint 0 · build 45.67s · `check:i18n-hardcoded` 0 · `check:shell` exit 0. **D-19 CHƯA ĐẠT**: `test:components` cần 3 lần xanh, thực tế **1 xanh 2 đỏ** — cùng test `useAlertCenterSnapshot.pagination.component.test.ts`, đã chứng minh **pre-existing** (chạy trên main tree `dev` sạch cũng đỏ y hệt; chạy riêng file 3/3 xanh; PA-5 không sửa file nào liên quan) → cần ticket riêng. **Không đụng `transport.js`** (`tenantreg-e`) sau khi xác minh `requestWithAuth` merge `...(init.headers || {})`; **không thêm i18n key** (`tenantreg-d`). **Chỉ gửi `paper`** — `live` cần Exit-5 + commercial license vnbroker. **0 dùng `--no-verify`.**
| `pf5-orderfe` | `feat/pf5-orderfe` | PA-5 FE gui mode + Idempotency-Key cho DNSE order (dong 400 order) | (chua khai file cu the) | superseded | 2026-09-26 | Worktree `pf5-orderfe`. DB `ag_pf5_orderfe`. Env: `CORE_DATABASE_URL=postgresql://vninvest:devpassword@127.0.0.1:5433/ag_pf5_orderfe` + `DJANGO_DEBUG=1`. Hoan tat: `pwsh -File scripts/agent-sync.ps1` rồi `pwsh -File scripts/agent-pr.ps1` |

## Portfolio Commercial PA-1..PA-5 — ĐÓNG (2026-09-26, coordinator gộp deny-list + ghi nhật ký)

Cả 5 PR đã merge vào `dev`. Coordinator gộp việc đóng session theo `docs/AGENT_PROTOCOL.md` §3 + §10.6.

| PR | agent | nhánh | nội dung | claim status |
|---|---|---|---|---|
| #12 | `pf3-brokerhub` | `feat/pf3-brokerhub` | broker egress allowlist + adapter lifecycle fail-closed (P1-SEC-01, P1-AUTH-01, C-04) | released |
| #13 | `pf2-analyticsledger` | `feat/pf2-analyticsledger` | analytics tenant scope + ledger dividend/fee/tax/realized-P&L (P0-ISO-01, P0-DATA-03) | released |
| #14 | `pf1-ordersafety` | `feat/pf1-ordersafety` | order fail-closed + 2 P0 mới X.1/X.2 + X.3–X.6 + P1-CONTRACT-00 | released |
| #15 | `pf4-modelsworker` | `feat/pf4-modelsworker` | repair migration `0008` + `UserBrokerConfig.tenant` FK + validators (P0-MIG-01, P0-ISO-03, P0-DATA-01/02) | released |
| #16 | `pf5-orderfe` | `feat/pf5-orderfe` | FE gửi `mode` + `Idempotency-Key` — đóng nợ "đặt lệnh đang TẮT" | released |
| #17 | `coordinator` | `docs/portfolio-audit-verification` | addendum verify audit + báo cáo SEC-01 | released |

**4 dòng `proposed` (stub `new-agent.ps1`) chuyển `superseded`, KHÔNG xoá** — mỗi agent đã khai claim
chi tiết thay thế ở dòng `done`/`released` tương ứng. Theo `AGENT_PROTOCOL.md` §3: claim bị thu hẹp thì
giữ dấu vết, không xoá.

**4 nhóm file-disjoint, 0 conflict, 0 vi phạm deny list §2.** Chỉ `docs/CLAIMS.md` trùng giữa các
nhánh (`merge=union`). Migration duy nhất `0019_pf4_tenant_and_financial_guards` — số do
`makemigrations` tự đặt, head đọc từ `origin/dev` = `0018_broker_config_unverified`, 1 leaf.

**1 bug thật do coordinator tìm khi merge lại** (cả 4 agent đều báo PASS):
`0019:264-272` `print()` chuỗi tiệng Việt có dấu ⇒ `UnicodeEncodeError` trên stdout cp1252 ⇒
**làm `migrate` thất bại giữa chừng**, không chỉ test đỏ. Sửa ở `934a19c0`. Đây là bằng chứng
"gate PASS của agent" không đủ — phải merge rồi chạy lại trên máy coordinator.

**Còn nợ, chuyển ticket riêng (KHÔNG sửa ở phiên này):**
- **D-19 CHƯA ĐẠT** — `test:components` cần 3 lần liên tiếp xanh, thực tế 1 xanh 2 đỏ vì
  `useAlertCenterSnapshot.pagination.component.test.ts` flaky. Đã chứng minh pre-existing (chạy
  trên `dev` sạch cũng đỏ y hệt, riêng file 3/3 xanh). Thêm delay để làm xanh là che triệu chứng.
- `ops_audit.AuditEvent.action` `max_length=16` quá hẹp cho `broker.*` — cần nới + choice mới
  (cần migration ⇒ `*/migrations/*` của `tenantreg-c`).
- `UserBrokerConfig.tenant` đang `null=True` (expand). Contract phase cần ticket sau khi
  quarantine = 0 ở **mọi** môi trường; DB dev có 0 row không chứng minh được cho production.
- `Idempotency-Key` trên Django `cache`: `TESTING` là LocMemCache, prod Redis. Nếu prod cấu hình
  LocMemCache multi-process thì còn cửa sổ trùng ⇒ thay bằng `OrderJob` + unique `(user,scope,key)`.
- `order_type` (`'LO'`) chưa validate — không có nguồn allowlist đáng tin thì thêm là **bịa contract**.
- Khoảng 6 chỗ fail-open `if tenant: … else: <lọc user-only>` còn nguyên trong `views.py`
  (portfolio/watchlist/subaccount/screener list) — cùng họ P0-ISO-02, cần ticket riêng.
- **P0-SEC-01 `CHƯA XỬ LÝ`** — chờ owner revoke/rotate. Xem `docs/evidence/portfolio-commercial/SEC-01-REPORT.md`.
- **P0-LEGAL-01** — license `vnbroker` chưa ký ⇒ **R3 live trading không tồn tại**.

## legacy_proxy 502 guard (2026-09-26)

Worktree = `C:\Mujoco Projects\lp-guard`, branch `feat/lp-guard`, DB `ag_lp_guard`.
Đóng B5 trong `docs/evidence/portfolio-commercial/AUDIT_VERIFICATION_20260926.md` §14 / rà soát backlog 2026-09-26.

| agent | branch | scope | files | status | since | note |
|---|---|---|---|---|---|---|
| `lp-guard` | `feat/lp-guard` | `legacy_proxy` bat `httpx.TransportError` (thay vi `ConnectError`+`TimeoutException`) + guard `LEGACY_BACKEND_URL` rong + regression test | `packages/core/backend/src/vninvest_core/legacy_proxy.py`, `packages/core/backend/src/vninvest_core/tests/test_legacy_proxy_transport_error.py` (new) | released | 2026-09-26 | PR #20 (`92f2d2ac`). Bug: `httpx.UnsupportedProtocol` là con của `TransportError` nhưng **không** phải `ConnectError`/`TimeoutException` ⇒ `legacy_proxy.py:84` không bắt ⇒ **HTTP 500 thay vì 502**. Route `/api/*` là catch-all cuối urlpatterns nên lỗi này phát ra mọi request chưa match native. **KHÔNG đụng `settings.py`** (đang claim bởi `tenantreg-s`) nên thay vì sửa default setting, thêm guard tại view trả `503 legacy_backend_not_configured`. KHÔNG tạo migration. Convention: `vninvest_core` dùng `tests/` package (`vninvest_core.tests.test_x`). |
| `lp-guard` (mở rộng) | `feat/lp-guard` | Sua fixture `test_portfolio_analytics_native_routes.py` — `force_authenticate` -> `force_login` + tenant that; tach phan so-sanh legacy (can legacy backend that) | `packages/core/backend/src/user_workspace/test_portfolio_analytics_native_routes.py` | released | 2026-09-26 | PR #20 (`92f2d2ac`). File nao **do coordinator giao** cho `pf2-analyticsledger` ("(d) ... force_authenticate nen fixture khong con mo ta request hop le (fail-closed) - coordinator sua"; agent ghi rang file nay **ngoai pham vi** va no "do regression xanh"). Sua `legacy_proxy` lam loi 500 -> 503/502, **che** loi 404 cua native route: `force_authenticate` bo qua `AuthenticationMiddleware` + `TenantResolutionMiddleware` nen `request.tenant is None` ⇒ `_get_user_portfolio()` fail-closed 404 theo P0-ISO-01. Fix theo dung pattern cua `test_analytics_tenant_matrix.py:131` (`force_login` + `CoreTenant` that). Phan so-sanh `/api/*` **khong chay duoc** khi thieu legacy backend (`legacy_stubs.py` co san nhung 0 import, `/api/*` di qua `legacy_proxy`) ⇒ `skipUnless(LEGACY_BACKEND_URL)`, khong gia lap bang stub de tranh bien parity test thanh tautology. |
| `lp-guard` (mở rộng 2) | `feat/lp-guard` | P0: `_deserialize` khoi phuc `meta.as_of` ve `date` (cache-hit lam `/summary/` 500) | `packages/core/backend/src/user_workspace/ledger/services.py`, `packages/core/backend/src/user_workspace/test_ledger_cache_as_of.py` (new) | released | 2026-09-26 | PR #20 (`92f2d2ac`). Phat hien khi sua fixture parity test. `_serialize` (`services.py:125`) doi `as_of` `date` -> `str`, nhung `_deserialize` (`:130-146`) **khong doi nguoc lai** (van restore `Decimal` cho moi field khac) ⇒ `build_meta` (`:226`) go `.isoformat()` tren `str` ⇒ `AttributeError` ⇒ **HTTP 500**. Hau qua: moi request **thu 2 tro di** cua portfolio co holdings = 500 (chi request tinh tay moi duoc). **Lý do test PA-2 khong bat:** `test_ledger_holdings.py:280,295,386` deu go `get_cached_ledger(..., use_cache=False)` ⇒ bo qua cache ⇒ `as_of` luon la `date`. Test moi phai bao phu **duong cache-hit**. Khong tao migration. |

### Self-service tenant register + workspace — all 6 slices released (2026-09-26)

Coordinator consolidation. All six claims `in-progress` -> `released`; the six
branches were file-disjoint and merged with **zero** collisions (verified by
building a 6x6 overlap matrix before the first merge).

| slice | commits | outcome |
|---|---|---|
| S | 4 | client_ip SSOT, Turnstile fail-closed, TESTING argv fix, nginx realip |
| A | 9 | reset-confirm 100% broken, password policy bypass, 500-after-commit, atomic rate limits, enumeration |
| B | 6 | cross-tenant `X-Tenant-ID` primitive, 2 NameErrors incl. a dead 429 path, AuditLogListView fail-closed, 4 resolvers -> 1 |
| C | 8 | deprovision FieldError, quota never enforced, outbox double-consumer, unique (tenant,name) |
| D | 6 | Turnstile site key unresolvable in Vite, duplicate top-level i18n `auth:` killing 40 keys/locale |
| E | 6 | tenant switch never reached the API, logout never revoked the PAT |

Plus two coordinator commits (`b24eca1c`, `96753858`): the 11 cross-slice gaps every
agent correctly refused to touch alone (settings/beat schedule, the A10 email
uniqueness migration, the onboarding exemption, the login case-sensitivity
lockout, i18n keys, `.d.ts`), and the response to an **independent** audit which
found 1 P0 (the client-IP fix had become a platform-wide DoS), 1 refuted claim
(two tenant resolvers still disagreed), 2 zero-coverage claims, and 3 P1s.

Honest status at close: **3 items deliberately left open**, each with a reason —
quota compares a per-DAY counter against a per-MONTH budget (~30x too permissive,
needs a product decision on the unit); `AuditLogListView` now fails closed, which
narrows the SOC operator's cross-tenant view; and the owner-only
`CoreTenant.objects.get(owner_user=...)` pattern in `commercial/views.py` still
500s for a member. Pre-existing red on `dev` and unchanged by this work:
`data_ingest.test_c9_*` (2, `No module named 'vnbroker'`) and
`vninvest_core`'s ~50 URL-routing failures.
| `tw-wire` | `feat/tw-wire` | Noi day 2 khoa Turnstile qua hanh lang hien tai: `VITE_TURNSTILE_SITE_KEY` (FE build arg) + `TURNSTILE_SECRET_KEY` (BE env) + contract test | `docker-compose.dev.yml` (**SHARED / deny-list §2**), `compose.dev.env.example` (**SHARED / deny-list §2**), `packages/web/Dockerfile`, `packages/web/src/components/auth/turnstile-wiring.component.test.js` (new), `docs/evidence/portfolio-commercial/tw-wire-gates.md` | released | 2026-09-26 | **RELEASED qua PR #22 (`850a7f72`).** Phat hien khi doi chieu bao cao "can set TURNSTILE_SECRET_KEY + VITE_TURNSTILE_SITE_KEY truoc khi deploy" voi code that. **Ca 2 khoa deu khong toi duoc container:** (1) `docker-compose.dev.yml:515-518` `frontend.build.args` chi co `VITE_API_URL`/`STOCKCHART_REF`/`GITHUB_TOKEN` — thieu `VITE_TURNSTILE_SITE_KEY`; (2) `packages/web/Dockerfile:14-19` khai bao `ARG VITE_API_URL`/`VITE_WS_BASE_URL`/`VITE_DISABLE_REALTIME_WEBSOCKET` — thieu `ARG VITE_TURNSTILE_SITE_KEY`, nen Vite khong co env nao de inject; (3) service `core-api` khai bao `environment:` **khong co** `TURNSTILE_SECRET_KEY`/`STRICT_TURNSTILE_ENFORCEMENT`. Hieu qua: dat key vao `compose.dev.env` van khong co tac dung. `TurnstileWidget.js:26` doc dung `import.meta.env.VITE_TURNSTILE_SITE_KEY` nen phia doc la dung — thieu o khoi build. **Den 2 file deny-list §2** (`docker-compose*.yml`, `.env*`): agent nay la **coordinator** va **khong co agent nao in-flight** tren 2 file nay (worktree `tenantreg-*` da cleanup), nen sua truc tiep va ghi ro tai day. Default an toan: `${TURNSTILE_SECRET_KEY:-}` rong + `STRICT_TURNSTILE_ENFORCEMENT` default `not DEBUG` (`settings.py:246`) ⇒ dev `DEBUG=true` khong hard-fail, production van `ImproperlyConfigured` nhu `apps.py:38-45`. Khong them secret that vao git. |

# VNInvest — Enterprise Audit Report (Revised)

**Audit Date**: 2026-09-24  
**Audit Board**: CTO · Solution Architect · Senior Backend Architect · Senior Frontend Architect · UI/UX Expert · Product Manager · QA Lead · DevOps Engineer · Security Expert · Performance Engineer  
**Scope**: Full-stack VNInvest SaaS platform (`packages/web` React + `packages/core` Django)  
**Evidence Basis**: Source code inspection of committed files, quality gate execution (`npx tsc --noEmit`, `npm run build`, `npm run lint`, `vitest run`, `manage.py check` with env vars), `docker-compose.yml` + `docker-compose.dev.yml`, `nginx.conf`, `settings.py`, `urls.py`, i18n dictionaries, `AGENTS.md` progress ledger (Entries 166–204), `CODE_CHANGE_AUDIT_LEDGER.md` (4,756 lines)

---

# Methodology: Evidence Classification

**Every finding in this report is classified by evidence type.** This is critical — "not seen" ≠ "does not exist."

| Classification | Meaning | Confidence |
|----------------|---------|------------|
| **Fact** | Directly observed in source code, config, or verified by running command | High — reifiable |
| **Inference** | Logically derived from observed code patterns, architecture, or dependency declarations | Medium — requires additional validation |
| **Hypothesis** | Possible but not confirmed; needs targeted investigation | Low — not a finding |
| **Absence** | Not found in scanned files; may exist outside scope | Unknown — do not treat as proof of absence |

**Confidence levels for severity:**
- **Confirmed**: Reproduced or direct evidence (bug, security exploit, data loss)
- **High confidence**: Code/config strongly indicates risk but not yet exploited in production
- **Medium confidence**: Reasonable inference, needs validation
- **Hypothesis**: Direction for investigation, not actionable without verification

**What was scanned:**
- `packages/web/src/` (TypeScript/React/Vite)
- `packages/core/backend/src/` (Django Python)
- `docker-compose.yml`, `docker-compose.dev.yml`, `Dockerfile`, `nginx.conf`
- `packages/web/package.json`, `packages/web/tsconfig.json`
- `requirements.txt`
- `i18n/vi.js`, `i18n/en.js` (~6,300 lines each)
- `src/i18n/index.js`
- AGENTS.md progress ledger
- CODE_CHANGE_AUDIT_LEDGER.md

**Not scanned (explicitly excluded):**
- `node_modules/`, `__pycache__/`, `.git/`
- `.env` files (credentials)
- Database contents
- Running production instances
- External dependencies' vulnerability state
- Repository `packages/mobile/`, `packages/opencore/`, `packages/vip-app/` (not present in working tree)
- Any repository outside `packages/web/` and `packages/core/backend/`

---

# 1. Executive Summary

## 1.1 Project Description

VNInvest is a stock tracker and robo-advisor SaaS platform for Vietnamese securities market (HOSE/HNX/UPCOM). Core capabilities: realtime WebSocket ticker feeds, portfolio tracking, watchlists, AI-powered signals (Screener, Whale Alerts, AI Advisory), SOC monitoring for operators, admin/tenant management, billing, and SAML SSO.

**Architecture** (from source): React 19 + Vite + TypeScript (frontend) · Django 5.2 + Daphne/Channels + Celery 5 + Redis + PostgreSQL 16 (backend) · Docker Compose with 8 named services (core-db, core-redis, core-api, core-worker, core-beat, frontend, prometheus, grafana) + ~7 specialized dev workers.

## 1.2 Technical Assurance Assessment

**The system demonstrates strong engineering discipline at the technical layer.** Evidence: `npx tsc --noEmit` = 0 errors, `npm run build` PASS, `npm run lint` = 0 errors (3,531 warnings), `vitest run` = 76 files / 446 tests PASS, Django `manage.py check` = 0 (when env vars provided). The `CODE_CHANGE_AUDIT_LEDGER.md` tracks 204+ entries with consistent quality gate verification.

**However, technical assurance ≠ production readiness.** The following are confirmed as **unverified**:
- Backup restore / PITR procedure
- DR drill / RTO / RPO
- Load testing with target workload
- Vulnerability scan / dependency audit
- Tenant isolation test (BE side)
- Rollback deployment test
- Alert delivery test
- Incident runbook / on-call
- Capacity model
- SLO definitions and error budgets (partially implemented in `service_ops`)

**Conclusion**: VNInvest shows production-capable characteristics but **cannot be confirmed production-ready at enterprise level** until the above verification gates are completed.

## 1.3 Scores (Separated by Domain)

### Technical Assurance Score: **7.3/10**
| Area | Score | Basis |
|------|-------|-------|
| Build/Type/Test discipline | 8.5 | All quality gates pass consistently |
| Architecture | 7.2 | Modular monolith, clear boundaries, some coupling |
| Backend API design | 7.8 | RESTful, documented, versioned |
| Frontend architecture | 7.3 | Type-safe, React Query, component-rich |
| Security posture | 7.2 | Env-based secrets, OWASP coverage present, gaps in CSP/headers |
| Queue/async | 8.2 | 9 purpose-built queues, tuned via measurement |
| Observability | 7.5 | Metrics + traces + logs + SSE |
| Infrastructure reliability | 6.2 | Single DB/Redis, Docker complexity, no DR verified |
| Testing coverage | 6.8 | Good unit/component, weak E2E/load |
| Documentation | 8.0 | Excellent ledger, AGENTS.md, plans |

### Product/Business Assessment: **Not Assessed (Insufficient Data)**
The source code cannot validate:
- Actual user adoption, DAU/MAU, retention
- Revenue, ARPU, CAC, LTV
- Conversion rates, churn
- Market size verification
- Whether features are used or built but unused
- Whether AI advisory generates revenue

**These require telemetry data not present in repository.** Any score assigned would be speculation.

## 1.4 Top Risks (by evidence type)

| # | Risk | Evidence Type | Severity | Confidence |
|---|------|---------------|----------|------------|
| 1 | `legacy_proxy.py` catch-all route | Fact (urls.py:61) | High/Medium* | Medium — needs attack path validation |
| 2 | `DJANGO_ALLOWED_HOSTS` hard fail | Fact (settings.py:29) | Medium (availability) | Confirmed — fail-closed is correct behavior |
| 3 | 3,531 lint warnings accumulate | Fact (`npm run lint`) | Medium | Confirmed |
| 4 | Docker Compose OOM history | Inference (AGENTS.md Entries 113–118) | High | Medium — historical incidents documented |
| 5 | Single PostgreSQL/Redis in compose | Fact (docker-compose.yml) | Medium | High in compose — **Unknown** for actual production topology |
| 6 | `db_router._CORE_APPS` missing apps | Fact (AGENTS Entry 200) | High (was Critical) | Confirmed — caused prod 500 |
| 7 | No backup/DR verification | Absence | High | Hypothesis — needs procedure validation |
| 8 | `google-genai` dependency missing (F6b) | Fact (requirements.txt comment) | Medium | Confirmed — blocks AI feature |
| 9 | No K8s / autoscaling | Absence | Low | Hypothesis — may not be needed |
| 10 | No CSP headers in nginx.conf | Fact (nginx.conf inspected) | Medium | Confirmed in nginx — **Unknown** at CDN/ingress |

## 1.5 Key Strengths

- **Quality gate discipline**: 204+ ledger entries with tsc 0, build PASS, eslint 0 errors, vitest passing, manage.py check 0
- **9-queue Celery topology**: Purpose-built workers, memory/CPU tuned via live measurement
- **Comprehensive i18n**: ~6,300-line vi.js + en.js dictionaries with scanner validation
- **Modular Django architecture**: 19 apps with clear domain boundaries
- **SOC compliance features**: Complete DataOps tab, SLO model, alerting, export
- **Admin SPA route protection**: `check-admin-spa-routes.mjs` preventing 404 regressions
- **Multi-tenant isolation**: TenantResolutionMiddleware, TenantQuotaMiddleware, CASL ability
- **Excellent documentation**: AGENTS.md (483 lines), ledger, implementation plans, audit docs

---

# 2. Product Audit (Technical Capability Only)

## 2.1 Technical Product Capability: **7.5/10**

**What the source code demonstrates:**
- Core features implemented: portfolio, watchlist, screener, signals, AI advisory, SOC monitoring
- 11 frontend page groups, 6 feature domains, route catalog with capability gating
- Pricing tier structure (`plans` i18n namespace: Free→Enterprise + internal)
- SAML SSO implemented (Sprint 5)
- Admin/tenant operations complete (R0–R8)

**What source code cannot demonstrate:**
- Whether users actually use these features
- Whether the product solves the problem effectively
- Whether the market values it
- Retention, engagement, conversion

## 2.2 Feature Completeness (Source-Verified)

| Feature | Status | Evidence |
|---------|--------|----------|
| Portfolio/Watchlist | ✅ Implemented | `user_workspace` app, `workspace` pages |
| Market data/Screener | ✅ Implemented | `market_data` app, `features/dashboard` |
| Signals/AI | ✅ P0/P1/P2 complete | Entries 99–112, `signal_intelligence` app |
| SOC DataOps | ✅ ~95% parity | Entries 84–127, `service_ops` app |
| Admin/Tenant | ✅ R0–R8 done | Entry 182/184/186 |
| SAML SSO | ✅ Implemented | Sprint 5 |
| AI Advisory (Gemini) | 🔶 F6a done, F6b blocked | `requirements.txt` comment, AGENTS Entry 203 |
| Mobile app | ❌ Not found in working tree | — |
| Billing/Commercial | 🔶 Present but unclear maturity | `commercial` app, `pages/commercial` |

## 2.3 Feature Gaps (Hypothesis — Needs Product Data)

| Gap | Priority | Basis |
|-----|----------|-------|
| Mobile app | High (if market data supports) | Not found in repo — may be separate repo |
| Onboarding wizard | Medium | No wizard component found |
| Push notifications | Medium | SSE exists for Signals only |
| Portfolio backtesting | Medium | No backtest engine visible |
| PDF export | Low | CSV export exists |
| Social/sharing | Low | Not found |

**Note**: Priority assignment requires user data, market research, or feature usage telemetry — not available from source code.

## 2.4 User Flow (Source-Inferred)

**Observed**: Route catalog defines auth → dashboard → market → signals → AI → admin flows. Main menu (5 groups/13 items) organized logically (Entry 166). `hubNav` 5-tab pattern in AI Command Center (Entry 204).

**Hypothesis**: Navigation mixing hash-based and route-based patterns in AI Command Center may create UX inconsistency — needs UX testing to confirm.

---

# 3. Business Assessment (Not Assessed — Insufficient Data)

**This section is intentionally left as "Not Assessed."** The repository contains no telemetry, business metrics, or customer data. Assigning a business score from source code would be speculative.

**What would be needed**: DAU/MAU, retention cohorts, revenue, ARPU, CAC, LTV, churn, NPS, feature adoption rates, support ticket volume, competitive analysis.

---

# 4. Architecture Audit

## 4.1 Architecture Type (Fact)

**Modular monolith with asynchronous worker topology and real-time messaging** — not microservices.

**Evidence**: Single `core-api` Django process serving all 19 apps. Celery workers for async jobs. Daphne for WebSocket. No independent deployment boundaries visible. No service-to-service HTTP communication (all internal).

**Why this matters**: 9 Celery queues ≠ microservices. Microservices require independent deployability, data ownership, and failure isolation. VNInvest's apps share a single database and Django process.

## 4.2 Architecture Score: **7.2/10**

### Strengths (Fact)
- Clear app boundaries: each Django app has `models.py`, `views.py`, `urls.py`, `serializers.py`, `tests/`, `migrations/`
- `packages/web/src/` separation: `pages/` (route-level), `features/` (domain-level), `adapters/` (infrastructure)
- API versioned at `/core/v1/`
- `drf-spectacular` for OpenAPI schema

### Weaknesses (Inference)
- `legacy_proxy.py` catch-all (`path('api/<path:remaining>', legacy_proxy_view)`) creates ambiguous boundary — **Inference**: may indicate incomplete SaaS migration
- `db_router.CoreRouter` creates database-level coupling — **Fact**: previously missing `ai_agents`/`ai_analytics` caused prod 500 (Entry 200)
- 19 backend apps may be over-segregated — **Hypothesis**: some apps (support, advertising) may consolidate

### Anti-patterns Identified
| Anti-pattern | Evidence | Impact |
|--------------|----------|--------|
| Catch-all proxy | `urls.py:61` | Ambiguous API boundary |
| `cast as unknown as { … }` | `packages/web/src/adapters/core/` | Type unsafety |
| `LEGACY_BACKEND_URL` env var | `settings.py:130,143` | Dual-system complexity |
| `legacy_readonly` database | `settings.py:134-139` | Conditional database adds routing complexity |

## 4.3 Clean Architecture Assessment: **6.5/10**

**Fact**: Frontend follows `pages/` → `features/` → `adapters/` separation reasonably well.

**Inference**: `legacy_proxy.py` and `LEGACY_BACKEND_URL` leak infrastructure concerns into the application layer. `packages/web/src/utils/whaleTimeAdapter.js` appears orphaned (unused `referenceDate` — eslint warning at `whaleTimeAdapter.js:70`).

## 4.4 DDD Assessment: **6.5/10**

**Bounded Contexts Identified** (Inference from app names):
- Identity & Access, Market Data, Signal Intelligence, Commercial, Operations, User Workspace, AI Advisory, AI Agents, Data Ingest, Tenant Lifecycle, Support, Advertising, Ops Audit

**Weaknesses (Fact)**:
- `service_ops` contains health, SLO, config, analytics, SOC, DataOps — too many responsibilities
- `advisory` mixes AI config, user credentials, AND prompt engineering
- `db_router._CORE_APPS` previously excluded `ai_agents`/`ai_analytics` (Entry 200)

**Fact**: `UserAICredential` has both per-user fields AND system fallback fields — dual-write risk partially addressed but not fully eliminated (Entry 202).

## 4.5 Scalability Assessment: **6.8/10**

**Horizontal scaling**: Celery workers can scale independently. React SPA is stateless. ✅

**Bottlenecks (Fact)**:
1. Single PostgreSQL instance in compose
2. Single Redis instance
3. No connection pooling (PgBouncer not visible)
4. No read replicas configured
5. Daphne single process for WebSocket

**Unknown**: Actual production topology may differ from compose (managed DB, cloud Redis, etc.). **Cannot confirm SPOF** without deployment topology verification.

## 4.6 Coupling & Cohesion: **6.5/10**

**High Coupling**:
- All apps share `vninvest_core.settings` (19 apps in `INSTALLED_APPS`)
- `CELERY_QUEUES` env var must be synchronized across all containers
- `LEGACY_BACKEND_URL` couples old and new systems
- `db_router` creates database-level coupling

**Low Cohesion**:
- `service_ops` has too many responsibilities
- `advisory` mixes distinct concerns

## 4.7 Architecture Recommendations (Risk-Reduction First)

**P0 — Verify before changing**:
1. Confirm actual production deployment topology (managed vs self-hosted DB/Redis)
2. Measure traffic to `legacy_proxy.py` before any removal
3. Add comprehensive `db_router` test coverage

**P1 — Reduce complexity**:
4. Sunset `compat` module completely (COMPAT-001/002)
5. Remove `legacy_proxy.py` only after traffic measurement and deprecation period
6. Consolidate `service_ops` if boundaries are unclear

**P2 — Optimize for scale (only if measured)**:
7. Add read replicas if DB query latency is proven problematic
8. Add PgBouncer if connection pooling is proven needed
9. Add Redis Sentinel/Cluster only if Redis is proven SPOF

---

# 5. Backend Audit

## 5.1 API Design: **7.8/10**

**Fact**: RESTful conventions consistent across 19 apps. `drf-spectacular` for schema. URL namespacing. Health endpoints.

**Concern (Fact)**: `path('api/<path:remaining>', legacy_proxy_view)` catch-all violates REST purity. `re_path(r'^api/admin-ops/.*$', admin_ops_gone)` returns 410 GONE — correct but unusual.

**Inference**: Mixed API versions (`/core/v1/` native + `/api/` compat + `/api/admin-ops/` dead) increase cognitive load.

## 5.2 Code Structure: **7.5/10**

Django pattern adherence is strong. `manage.py` at `packages/core/backend/manage.py` with `src/` layout adds import complexity but maintains separation.

## 5.3 Error Handling: **7.5/10**

**Fact**: `exceptions.py` exists. `ops_audit.middleware.RequestTraceMiddleware` for tracing. `django-ratelimit` for rate limiting. `sentry-sdk[django]` for error tracking. `RateLimitHeadersMiddleware`.

**Hypothesis**: Structured error response format may not be fully standardized — not verifiable from inspected code alone.

## 5.4 Validation: **7.5/10**

**Fact**: `drf-spectacular` schemas, `zod` in frontend, `BLOCKED_DISPOSABLE_DOMAINS`, `TenantQuotaMiddleware`.

**Gap**: No evidence of middleware-level input sanitization. This is **not necessarily a vulnerability** — Django ORM and React JSX provide significant protection.

**Clarification**: XSS prevention requires context-aware output encoding:
- React JSX auto-escapes by default (Fact)
- Django templates auto-escape by default (Inference)
- CSP headers would add defense-in-depth (Unknown — not in nginx.conf)
- `dangerouslySetInnerHTML` usage not checked (Absence)

## 5.5 Logging: **7.0/10**

**Fact**: `logger.exception()` added in `tasks.py` (Entry 113 fix). Sentry SDK. `django-prometheus` for metrics.

**Gap**: No evidence of structured JSON logging. `python-json-logger` not visible. Log format unclear.

**Note**: `django-prometheus` provides metrics, not logging. These are distinct observability layers.

## 5.6 Caching: **7.0/10**

**Fact**: Redis used as Celery broker (`redis://core-redis:6379/3`). `cache.add('scheduler:inflight:{job_key}', task_id, 7200)` for dedup-guard (Entry 113). `channels-redis` for WebSocket pub/sub.

**Inference**: Django `CACHES` backend may not be configured with Redis — only Celery broker and Channels uses Redis. No evidence of query caching.

## 5.7 Queue Architecture: **8.2/10** (Major Strength)

**Fact**: 9 purpose-built queues with dedicated workers:

| Queue | Worker (from compose) | Concurrency | Memory | Type |
|-------|----------------------|-------------|--------|------|
| `celery` | core-worker | 2 | 256m | Default |
| `realtime_prefetch` | core-worker-realtime-prefetch | 5 (prefork) | 1g | I/O-bound |
| `realtime_scheduler` | core-worker-realtime-scheduler | 1 (solo) | 256m | Heartbeat |
| `enrichment_offhours` | core-worker-enrichment | 1 (prefork) | 1g | I/O-bound |
| `enrichment_eod` | core-worker-enrichment-eod | 3 (prefork) | 1g | I/O-bound |
| `manual_on_demand` | core-worker-manual | 1 (solo) | 256m | Demand |
| `analytics_heavy` | core-worker-analytics | 1 (solo) | 512m | CPU-bound |
| `screener` | core-worker-screener | 1 (solo) | 256m | Demand |
| `realtime_stream` | core-worker-realtime-stream | 1 (solo) | 512m | WebSocket |

**Strengths**: Memory/CPU tuned via live measurement (AGENTS.md Entries 113–118). Prefork vs solo optimized per queue type. `queue-drain-monitor` for LLEN tracking.

**Concerns (Inference)**: 9 queues × workers creates complexity. `CELERY_QUEUES` env var must be synchronized. Docker dev has 15+ services. Historical OOM incidents (Entries 113–118).

**Hypothesis**: 9 queues may be more than needed. Consider consolidating if throughput measurements show capacity headroom.

## 5.8 Event-Driven Design: **7.0/10**

**Fact**: `tenant-changed` CustomEvent, Django Channels WebSocket, Celery task signals, SSE for Signals (`GET /operator/soc/signals/stream/`), `OverviewStreamView` for overview SSE.

**Inference**: Events are at infrastructure level (task completion, WebSocket), not domain events. No evidence of "portfolio.created" → trigger analytics pattern.

## 5.9 Database Access: **7.0/10**

**Fact**: `dj_database_url`, `CONN_MAX_AGE: 60`, `CoreRouter`, `psycopg2-binary`.

**Fact**: `db_router._CORE_APPS` previously missing `ai_agents`/`ai_analytics` → prod 500 (Entry 200). **This was a real production incident.**

**Hypothesis**: `select_related`/`prefetch_related` optimization may not be consistently applied — not verifiable without query analysis.

**Fact**: `LEGACY_DATABASE_URL` conditional creates `legacy_readonly` database — adds routing complexity.

## 5.10 Security: **7.2/10**

**Fact**: `SECURE_PROXY_SSL_HEADER`, `USE_X_FORWARDED_HOST`, `ALLOWED_HOSTS` enforcement, `DJANGO_SECRET_KEY` env-based, `CORE_PAT_PEPPER`, `django-ratelimit`, `corsheaders`, `BLOCKED_DISPOSABLE_DOMAINS`, `TURNSTILE_SECRET_KEY`, SAML 2.0 SSO.

**Gaps**:
- No evidence of CSP headers (nginx.conf does not contain `Content-Security-Policy`)
- No evidence of `X-Content-Type-Options` or `X-Frame-Options`
- `SECRET_KEY` default `'dev-only-insecure-key-replace-in-production'` exists as defensive fallback
- No evidence of password strength requirements
- No evidence of 2FA/MFA

### OWASP Coverage (Fact + Inference)

| OWASP | Status | Evidence | Confidence |
|-------|--------|----------|------------|
| A01 Broken Access Control | ✅ Covered | CASL, tenant middleware, route gating | High |
| A02 Cryptographic Failures | ✅ Covered | `CORE_PAT_PEPPER`, env secrets | High |
| A03 Injection | ✅ Low risk | Django ORM (parameterized) | High |
| A04 Insecure Design | 🔶 `legacy_proxy.py` | Catch-all route | Medium |
| A05 Security Misconfiguration | 🔶 Env-dependent | `DJANGO_DEBUG`, `ALLOWED_HOSTS` | Medium |
| A06 Vulnerable Components | 🔶 `vnbroker` Git dep | Private dependency | Medium |
| A07 Auth Failures | ✅ Covered | Rate limiting, CAPTCHA, PAT | High |
| A08 Integrity | ✅ Covered | `django-ratelimit`, CSRF | High |
| A09 Logging | ✅ Covered | RequestTraceMiddleware, Sentry | High |
| A10 SSRF | ❓ Unknown | `legacy_proxy_view` not inspected | **Hypothesis** |

**Note on SSRF**: The catch-all `legacy_proxy_view` could theoretically proxy user-controlled URLs, but without inspecting the implementation, this is **Hypothesis, not a finding**. The claim that "SSRF risk is low" is **unsupported** — it should be marked as needing validation.

**Note on SQL injection**: Django ORM significantly reduces risk, but raw SQL (`raw()`, `cursor.execute`) in management commands and migrations has not been verified. Rated as "lower baseline risk" not "confirmed safe."

---

# 6. Database Audit

## 6.1 Schema: **7.0/10**

**Fact**: PostgreSQL 16. Multiple databases: `default` + conditional `legacy_readonly`. `CoreRouter` for routing. `CONN_MAX_AGE: 60`.

**Inference (from app names)**: ~20+ tables across apps. `UserAICredential` has migration `0007` adding 5 fields. `ai_agents` has migration `0002` for `UniqueConstraint(name, created_by)`.

**Absence**: No actual schema files inspected in this audit scope. Index definitions, table structures, and foreign key constraints not verified.

## 6.2 Normalization: **7.0/10**

**Fact**: Multi-tenant pattern with user-scoped data (`ai_analytics` self-scope `filter(user=request.user)`). `UniqueConstraint(name, created_by)`. `UserAICredential` separates per-user config from `SystemAISettings`.

**Inference**: `UserAICredential` having both user fields AND system fallback fields creates denormalization risk. `SystemAISettings` global fields previously leaked to user writes (Entry 202 fix).

## 6.3 Indexing: **6.5/10**

**Fact**: Django auto-creates PK indexes. `UniqueConstraint` creates composite indexes. `db_router` implies indexed foreign keys.

**Absence**: No evidence of:
- Composite indexes for common query patterns
- Partial indexes
- Full-text search indexes
- GIN indexes for JSONB

**Important**: Index recommendations cannot be made without actual query logs, `EXPLAIN ANALYZE` output, and cardinality data. Generic SQL index suggestions (e.g., `CREATE INDEX ON ai_agents(created_by, status)`) are **hypotheses** that require validation with actual query patterns.

## 6.4 Query Optimization: **6.5/10**

**Fact**: `CONN_MAX_AGE: 60`. No `select_related`/`prefetch_related` visible in inspected code (but this is absence, not confirmation of absence).

**Hypothesis**: N+1 query issues may exist in `ai_analytics` and other list views — needs query analysis.

## 6.5 Locking: **7.0/10**

**Fact**: Optimistic lock pattern implemented for DataOps config (Entry 121, C5: `CONFIG_CONFLICT` 409 + `expected_updated_at`). Celery `acks_late` + dedup-guard cache.

**Inference**: Database-level locking strategies (row-level locks, advisory locks) not verified.

## 6.6 Migration Strategy: **7.5/10**

**Fact**: Systematic migrations: `0002_agent_name_per_creator`, `0007_user_aicredential_fields`, `0008_systemaisettings_gemini_38_flash`, `0012_service_health_slo`. `makemigrations --check` clean in quality gates.

**Absence**: No evidence of migration rollback testing or data migration strategies for large datasets.

## 6.7 Backup Strategy: **6.0/10**

**Fact**: PostgreSQL volume `core_pgdata` persisted. Redis AOF (`--appendonly yes`). Prometheus/Grafana volumes persisted. `backups/` directory exists (contents unknown).

**Absence**: No evidence of:
- Automated backup scheduling (cron, `pg_dump`)
- Point-in-time recovery (PITR) configuration
- Cross-region backup
- WAL archiving
- Backup encryption
- Restore testing procedure
- RTO/RPO documentation

**This is a significant gap for enterprise production readiness.**

## 6.8 Partitioning (Hypothesis)

**Absence**: No evidence of table partitioning. If `price_board` or `ai_analytics` tables grow large, partitioning would be a valid consideration — but this requires actual data volume measurement first.

## 6.9 Data Governance (Not Assessed)

Absent from source code: data classification, PII inventory, retention policies, tenant export/delete procedures, backup encryption, audit immutability, data residency compliance, GDPR/PDPA compliance.

---

# 7. Frontend Audit

## 7.1 Project Structure: **7.5/10**

**Fact**: Well-organized with clear separation: `pages/` (11 groups), `features/` (6 domains), `components/`, `adapters/`, `context/`, `hooks/`, `i18n/`, `config/`, `utils/`.

## 7.2 Component Architecture: **7.5/10**

**Fact**: Shared component library in `components/`. `adminUi.tsx` shared kit (Entry 190). `LucideIcon` whitelist. `soc.module.css` → split into `soc.tokens.css` + `soc.components.css` (Entry 88). Glassmorphism patterns consistent.

**Inference**: `vninvestcharts-widget` lazy-loaded via dynamic `import()` adds async boundary complexity.

## 7.3 State Management: **7.5/10**

**Fact**: `@tanstack/react-query` ^5.101.2 for server state. `QueryProvider` wrapping app. `useTenantAdminQuery`/`useTenantAdminMutation` hooks. `queryKey` scoped by `tenant_id` (F1+F2 fix, Entry ~190). `DataOpsContext` for config (Entry 121 C7). `LangContext` for i18n.

**Absence**: No evidence of client-side state library (Zustand/Jotai). Local state may be scattered via `useState`/`useReducer`.

## 7.4 Performance: **7.0/10**

**Fact**: Vite build ~46-53s. `react-window` for virtualization. Multiple charting libraries (d3, echarts, lightweight-charts, klinecharts). `vninvestcharts-widget` ^1.2.5 lazy-loaded. React 19 with concurrent features.

**Concern**: Multiple charting libraries may increase bundle size. No evidence of bundle size analysis or budget enforcement.

**Absence**: No evidence of code splitting configuration, `React.lazy()` + `Suspense` usage, or Core Web Vitals monitoring.

## 7.5 SEO: **5.5/10**

**Fact**: React SPA rendered client-side (no SSR/SSG). `react-router-dom` ^6.30.3.

**Inference**: SEO relies on client-side rendering — suboptimal for LCP. Public pages (landing, pricing, documentation) would benefit from SSR/SSG, but authenticated admin dashboard SEO is less critical.

**Hypothesis**: SSR could be considered for public marketing pages, but not for authenticated dashboard.

## 7.6 Accessibility: **7.0/10**

**Fact**: `@radix-ui/react-*` components, `@headlessui/react`, `check:contrast` script, `dom-landmarks` check, `i18n:scan` for translation completeness.

**Absence**: No evidence of manual a11y audit or screen reader testing.

## 7.7 Frontend Quality Gates (Fact)

- `npx tsc --noEmit` = 0 errors ✅
- `npm run build` = PASS ✅
- `npm run lint` = 0 errors, 3,531 warnings ⚠️
- `vitest run` = 76 files / 446 tests PASS ✅
- `npm run i18n:scan` = exit 0 ✅

## 7.8 Lint Warnings (Fact)

3,531 warnings, 0 errors. This is a **Medium severity maintainability issue**, not a bug risk.

**Inference**: The warnings likely include:
- `react/jsx-no-literals` (JSX strings not extracted)
- `no-unused-vars` (dead code references)
- `exhaustive-deps` (React hooks dependencies)
- Style/formatting issues

**Recommendation**: Capture baseline, enforce no new warnings, auto-fix safe rules, reduce by 15%/sprint. **Do NOT add mass `eslint-disable` comments** — this hides debt and makes future detection harder.

---

# 8. UI Audit

## 8.1 Visual Hierarchy: **7.0/10**

**Fact**: `soc.module.css` token system, `glassPanel` pattern, `sectionCard`, `configHeaderMeta`, `stickyActionBar`.

**Inference**: Consistent glassmorphism and card-based layouts.

## 8.2 Layout: **7.2/10**

**Fact**: `TenantAdminLayout` + `TenantAdminSidebar` (JSX, Entry ~190). `hubNav` 5-tab navigation. `routeCatalog.js` defines all routes. Admin SPA routes whitelisted in nginx (10 prefixes).

**Concern**: 11 page groups with potentially inconsistent layouts. Some pages may have custom layouts.

## 8.3 Color System: **7.2/10**

**Fact**: `soc.tokens.css` (43 lines) + `soc.components.css` (2715 lines). `tone.ts` with light+`dark:` pairs. `check:contrast` script. `data-theme` attribute for dark/light mode.

**Fact**: Contrast improved from 1.3 to 4.5+ (Entry 188 F1).

## 8.4 Typography: **6.8/10**

**Fact**: Tailwind CSS ^4.0. `tailwind-merge`, `clsx`, `class-variance-authority`. `text-slate-100` → `slate-950/dark:white` fix (Entry 188 F1).

**Absence**: No evidence of custom type scale or font family definitions in inspected files.

## 8.5 Responsive Design: **7.0/10**

**Fact**: Tailwind responsive prefixes. `lg:h-[500px]` / `h-auto min-h-[380px]` for card responsive heights (Entry 191). `tailwind-sidebar` ^1.3.2. `simplebar-react` for scrollable areas.

**Concern**: Some responsive heights hardcoded. No evidence of mobile-first design audit.

## 8.6 Mobile UX: **5.5/10**

**Absence**: No mobile app found in working tree. React SPA is desktop-first.

**Important**: This does **not** confirm "mobile app does not exist." It may be in a separate repository, or planned but not started. **Cannot be used as a finding.**

**Inference**: The platform is designed as a desktop SaaS tool for traders and operators. Mobile responsiveness is secondary.

## 8.7 UI Scorecard

| Category | Score | Basis |
|----------|-------|-------|
| Visual Hierarchy | 7.0 | Fact: consistent patterns |
| Layout | 7.2 | Fact: admin/tenant layouts |
| Typography | 6.8 | Fact: Tailwind utilities |
| Color System | 7.2 | Fact: token-based, dark mode |
| Design Consistency | 7.0 | Fact: shared components |
| Responsive Design | 7.0 | Fact: Tailwind responsive |
| Mobile UX | 5.5 | Absence: not found in repo |
| Desktop UX | 7.5 | Fact: rich feature set |

---

# 9. UX Audit

## 9.1 User Journey (Source-Inferred)

**Fact**: Route catalog defines auth → dashboard → market → signals → AI → admin flows. Main menu (5 groups/13 items) organized logically (Entry 166). `hubBackLink` navigation (Entry 204).

**Hypothesis**: `hubNav` mixing hash-based (`#overview`) and route-based navigation may create UX inconsistency.

## 9.2 Onboarding: **5.0/10 (Hypothesis)**

**Absence**: No onboarding wizard, guided tutorial, or interactive walkthrough found. `shellFallback` routes indicate loading states.

**Important**: Absence of onboarding component does **not** prove the product lacks onboarding. It may exist outside the scanned scope, or be planned.

## 9.3 Navigation: **7.2/10**

**Fact**: `routeCatalog.js` + `navigationCatalog.js`. `check-admin-spa-routes.mjs` prevents route regressions. Main menu well-organized.

**Concern**: Mixed navigation paradigms in AI Command Center. `shellFallback` routes indicate dynamic loading states.

## 9.4 Error State: **6.8/10**

**Fact**: `shellFallback.loadErrorDefault`, `common.noPermission`. Inline error/success in `SocConfigPreviewModal` (Entry 121 C2). `useSignalStream` with retry/backoff.

**Absence**: No evidence of global error boundary. No evidence of error logging UI.

**Hypothesis**: Error messages may not be user-friendly — not verifiable without UX testing.

## 9.5 Empty State: **6.5/10**

**Fact**: `EmptyState` component in `adminUi.tsx` (Entry 190). Skeleton loading states (Entry ~190 Step 6.3).

**Absence**: No evidence of empty-state illustrations or guidance.

## 9.6 Feedback System: **7.0/10**

**Fact**: Toast notifications on mutations (Entry ~190 Step 6.5). Inline error/success (Entry 121 C2). i18n translations for all user-facing strings.

**Absence**: No evidence of user feedback collection (surveys, NPS). No feature request system.

## 9.7 Friction Points (Hypothesis)

| Friction | Evidence Type | Impact |
|----------|---------------|--------|
| No onboarding wizard | Absence | Medium — needs validation |
| Complex admin navigation | Fact | Medium — 11 page groups |
| Mixed hub navigation | Fact | Low — needs UX testing |
| No global error boundary | Absence | Low — may exist |
| No onboarding guidance | Absence | Low — may be planned |

**Note**: All friction points are classified as Hypothesis. Actual impact requires UX testing and analytics.

---

# 10. Security Audit

## 10.1 Authentication: **7.5/10**

**Fact**: Django `django.contrib.auth`. `identity_access` app. `django-ratelimit` for brute-force protection. `TURNSTILE_SECRET_KEY` for CAPTCHA. `CORE_PAT_PEPPER` for secure PAT hashing. `BLOCKED_DISPOSABLE_DOMAINS` for registration anti-spam.

**Absence**: No evidence of MFA/2FA implementation. No password strength requirements visible.

**Confidence**: Medium — absence of evidence does not mean absence of feature. MFA may exist but not be visible in the scanned files.

## 10.2 Authorization: **7.5/10**

**Fact**: `TenantResolutionMiddleware`, `TenantQuotaMiddleware`. `@casl/ability` ^6.8.0 + `@casl/react` ^5.0.1. `requiredCapabilities` in `routeCatalog.js`. `common.noPermission`. Staff-only routes (`check-admin-spa-routes`). `is_staff/is_superuser` checks (Entry 167 H0 fix).

**Inference**: Authorization may be route-level only, not data-level. Row-level security not verified.

## 10.3 Session Management: **7.5/10**

**Fact**: `django.contrib.sessions` in `INSTALLED_APPS`. `django-prometheus` for metrics.

**Hypothesis**: Redis-backed sessions — **cannot confirm** without checking `SESSION_ENGINE` and `CACHES` configuration. This was previously classified as fact but is actually inference.

**Absence**: No evidence of session timeout configuration or concurrent session limits.

## 10.4 HTTPS and Headers: **6.5/10**

**Fact**: `SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')`. `USE_X_FORWARDED_HOST = True`. `django-cors-headers`. `CsrfViewMiddleware`.

**Absence**: No `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security` headers visible in `nginx.conf`.

**Important**: This does **not** mean CSP headers are absent — they may be applied at CDN, load balancer, or reverse proxy outside the repository. **This is Absence in the repo, not proof of absence in production.**

## 10.5 Secrets Management: **7.0/10**

**Fact**: All secrets from environment variables (`DJANGO_SECRET_KEY`, `CORE_PAT_PEPPER`, `CORE_DB_PASSWORD`, `CORE_DJANGO_SECRET_KEY`, `CORE_CORS_ALLOWED_ORIGINS`, `VNBROKER_GITHUB_TOKEN` as Docker secret). `docker-compose.yml` uses `${VAR:?must be set}` syntax. No hardcoded secrets in inspected code.

**Concern**: `COMPOSE.dev.env` has `DNSE_CREDENTIAL_FERNET_KEY` hardcoded (development only). `.env.example` files may contain placeholder values.

**Absence**: No evidence of secret rotation policy. No evidence of HashiCorp Vault or cloud KMS. No evidence of encrypted secrets at rest.

## 10.6 OWASP Coverage Assessment

| OWASP | Finding Type | Evidence | Confidence |
|-------|-------------|----------|------------|
| A01 | Fact | CASL, tenant middleware | High |
| A02 | Fact | Env secrets, PAT pepper | High |
| A03 | Fact | Django ORM parameterized | High |
| A04 | Hypothesis | `legacy_proxy.py` — needs attack path | Medium |
| A05 | Inference | Env-dependent config | Medium |
| A06 | Hypothesis | `vnbroker` Git dep risk | Medium |
| A07 | Fact | Rate limiting, CAPTCHA | High |
| A08 | Fact | CSRF, ratelimit | High |
| A09 | Fact | RequestTraceMiddleware, Sentry | High |
| A10 | **Unknown** | `legacy_proxy_view` not inspected | **Cannot assess** |

**Critical correction**: Previous classification of SSRF as "low risk" was **unsupported** and has been corrected to "Unknown." The `legacy_proxy_view` catch-all route needs inspection to determine actual SSRF exposure.

**Critical correction**: SQL injection rating of 8.5/10 was **too confident** for an unverified claim. Corrected to "lower baseline risk" — Django ORM reduces risk significantly, but raw SQL paths have not been verified.

## 10.7 Security Findings (Revised Severity)

| ID | Finding | Severity | Confidence | Evidence | Action |
|----|---------|----------|------------|----------|--------|
| SEC-01 | `legacy_proxy.py` catch-all — SSRF potential | **High** (needs validation) | Medium | `urls.py:61` | Inspect `legacy_proxy_view` for upstream URL construction, auth bypass, redirect |
| SEC-02 | No CSP headers in nginx.conf | **Medium** | High | `nginx.conf` inspected | Confirm if applied at CDN/ingress |
| SEC-03 | No MFA/2FA visible | **Medium** | Low (absence) | Absence in scanned files | Verify feature existence |
| SEC-04 | `SECRET_KEY` default exists | **Low** | High | `settings.py:19` | Confirm overridden in production env |
| SEC-05 | No secret rotation policy | **Medium** | Medium | Absence of policy docs | Implement rotation |
| SEC-06 | `vnbroker` private Git dependency | **Medium** | High | `requirements.txt:30` | Pin SHA, use artifact registry |
| SEC-07 | `DJANGO_DEBUG` env toggle | **Medium** | High | `settings.py:21` | Ensure `DEBUG=False` in prod |
| SEC-08 | `COMPOSE.dev.env` hardcoded credential | **Low** | High | `compose.dev.env` | Remove from repo, use env |

## 10.8 Software Supply Chain (Not Fully Assessed)

**Absence**: No evidence of:
- Dependency vulnerability scan (e.g., `npm audit`, `safety`, `pip-audit`)
- SBOM generation
- Container image scanning
- GitHub Actions branch protection or pinning
- Secret scanning in CI
- License scanning

**Inference**: The absence of these in the visible CI configuration suggests they may not be implemented, but this is **Hypothesis** — actual CI pipeline configuration was not inspected.

## 10.9 AI-Specific Security (Not Assessed — Needs Dedicated Audit)

The system has AI advisory capabilities but AI security was not audited:
- Prompt injection
- Hallucination management
- Financial disclaimer enforcement
- Sensitive data sent to AI providers
- Model/version tracking
- Per-tenant key isolation
- AI output logging and retention

**This is a significant gap for a financial platform.**

---

# 11. DevOps Audit

## 11.1 Infrastructure Overview (Fact)

**Production** (`docker-compose.yml`): 8 named services + volumes + networks + secrets:
- `core-db` (PostgreSQL 16)
- `core-redis` (Redis 7, AOF)
- `core-api` (gunicorn)
- `core-worker` (Celery)
- `core-beat` (Celery Beat)
- `frontend` (nginx + React)
- `prometheus`
- `grafana`

**Development** (`docker-compose.dev.yml`): 8 production + ~7 specialized workers + monitoring = ~15 services

**Note**: Previous report stated "9 production services" but actual count is 8 named services in `docker-compose.yml`. The discrepancy is noted and corrected.

## 11.2 Docker: **7.2/10**

**Fact**: Health checks on all critical services. Memory/CPU limits. Docker secrets for `vnbroker_github_token`. Isolated networks. Persistent volumes.

**Concern**: Docker dev has 15+ services. Historical OOM incidents (Entries 113–118). `CELERY_QUEUES` env var synchronization required.

## 11.3 Kubernetes: **Not Assessed**

**Absence**: No Kubernetes manifests found.

**Important correction**: No K8s is **not** a technical debt item or finding by default. K8s adds significant complexity and is only justified when:
- Autoscaling is needed
- Rolling deployment complexity requires it
- Workload isolation is needed
- Multi-node scheduling required
- Multiple independent operations groups

**Recommendation**: Do NOT add K8s to roadmap unless measured need exists. Docker Compose is valid for many deployment scenarios.

## 11.4 Observability: **7.5/10**

**Fact**: `django-prometheus` for metrics. `ops_audit.middleware.RequestTraceMiddleware`. `redis-exporter`. Prometheus + Grafana. `queue_depths` in observability API (Entry 113 Slice G). `check_scheduler_queue_drift` management command. `health/` endpoint. Sentry SDK.

**Clarification**: `django-prometheus` provides **metrics**, not traces. Prometheus does **not** provide distributed tracing. Jaeger/Tempo needed for traces — not present.

**Fact**: `RequestTraceMiddleware` provides request IDs — but this is **logging correlation**, not distributed tracing.

**Absence**: No evidence of log aggregation (ELK/Loki). No distributed tracing system. No synthetic monitoring. No alert delivery verification.

## 11.5 Alerting: **6.5/10**

**Fact**: `queue-drain-monitor` alerts on high queue depth. `check_scheduler_queue_drift` warns on beat drift. `SOC_ALERT_COOLDOWN_HOURS` for service health alerts (Entry 88 Step 5).

**Absence**: No evidence of PagerDuty, Slack, or email alerting integration. No alert routing/escalation policies. No incident runbook visible.

## 11.6 Disaster Recovery: **5.5/10**

**Fact**: PostgreSQL volume persisted. Redis AOF enabled. Prometheus/Grafana volumes persisted.

**Absence**: No evidence of:
- Automated backup scheduling
- Point-in-time recovery (PITR)
- Cross-region replication
- DR drill/testing
- RTO/RPO documentation
- `pg_dump` cron or script

**This is a significant gap.** For enterprise production, backup/restore and DR verification are **mandatory**.

## 11.7 Single Points of Failure

**Correction to previous assessment**:

Single PostgreSQL/Redis in `docker-compose.yml` is a **fact about the compose file**. Whether this represents a SPOF depends on actual production topology.

**Hypothesis**: The production environment likely uses managed services (AWS RDS, Elasticache) with built-in HA. The compose file is for orchestration reference, not necessarily production deployment.

**Recommendation**: Verify actual production deployment topology before concluding SPOF. If managed services are used, the SPOF concern is mitigated.

**Single Celery beat**: **Not necessarily a problem**. Scheduler best practice is typically one active scheduler to avoid duplicate scheduling. HA for beat requires leader election — not simple replica addition.

**Recommendation**: Keep one active beat. Add supervised restart and heartbeat alert. Add leader election only if running multiple beat instances.

---

# 12. Performance Audit

## 12.1 API Latency: **7.0/10**

**Fact**: `nginx` rate limiting (`limit_req_zone rate=50r/s`). `limit_req` on `/api/*` with burst=20. `proxy_read_timeout 300s` for long requests. `django-ratelimit` backend.

**Absence**: No evidence of response time SLAs or p95/p99 latency monitoring. No evidence of API-layer caching.

**Hypothesis**: Without query analysis, database latency may be a bottleneck for complex list views.

## 12.2 Database Latency: **6.5/10**

**Fact**: `CONN_MAX_AGE: 60` for connection reuse. `dj_database_url`. PostgreSQL 16.

**Clarification**: `CONN_MAX_AGE` is Django persistent connection reuse (application-level), **not** external connection pooling like PgBouncer. Previous report incorrectly conflated these.

**Absence**: No evidence of PgBouncer or other external connection pooler. No read replicas in compose. No query performance monitoring.

**Hypothesis**: If database latency is high, adding PgBouncer or read replicas would help — but this requires measurement first.

## 12.3 TTFB: **6.5/10**

**Fact**: `gunicorn` for WSGI. `Daphne` for ASGI. `whitenoise` for static files. `nginx` reverse proxy.

**Absence**: No evidence of CDN for static assets. No response caching middleware. No TTFB optimization.

**Hypothesis**: React SPA client-side rendering inherently has higher LCP than SSR — this is expected for SPAs but impacts Core Web Vitals.

## 12.4 Core Web Vitals: **5.5/10**

**Absence**: No evidence of Core Web Vitals monitoring. No LCP, FID, CLS optimization visible. No evidence of prerendering, SSR, or dynamic meta tags.

**Inference**: React SPA has inherently higher LCP. Multiple charting libraries may impact FID. Dynamic content injection may affect CLS.

**Hypothesis**: Route-based code splitting and lazy loading could improve LCP — but this requires bundle analysis first.

## 12.5 Performance Recommendations (Risk-Reduction First)

**P0 — Measure**:
1. Add bundle size analysis to Vite build
2. Add Core Web Vitals RUM monitoring
3. Measure database query performance (slow query log)
4. Measure API response times (p95/p99)

**P1 — Optimize based on data**:
5. Route-based code splitting (if bundle > threshold)
6. Lazy-load charting libraries (if identified as large)
7. Add response caching (if latency proven high)
8. Add PgBouncer (if connection pool saturation proven)

**Do NOT do (solution-first)**:
- Add React Server Components without measurement
- Migrate to Next.js without evidence of SEO need
- Add Kubernetes without evidence of scaling need
- Replace Celery with Kafka without benchmark

---

# 13. Testing Audit

## 13.1 Test Results (Fact)

| Suite | Result | Command |
|-------|--------|---------|
| Vitest (FE component) | 76 files / 446 tests PASS | `npm run test:components` |
| Jest (FE unit) | 239 tests | `npm run test` (with `--no-coverage`) |
| `jest soc.test.js` | 90/90 | — |
| `test_ai_cc_config_isolation.py` | 8/8 OK | BE |
| `test_scheduler_catalog` | 35 OK | BE |
| `test_repair_beat_schedule` | 6 OK | BE |
| `test_drift_enabled_missing` | 3 OK | BE |
| `test_dataops_config_conflict` | 3 OK | BE |
| `RealtimeWhaleFeedAggregateCompatTest` | 3/3 | BE |
| `test_soc_tasks` | 6 FAIL (pre-existing) | BE |

**Note**: `npm run test` uses `--no-coverage` flag — coverage is **not enforced**.

## 13.2 Coverage: **6.5/10**

**Absence**: No coverage thresholds. No coverage reports visible in quality gates. `--no-coverage` in Jest config. No evidence of coverage dashboards.

**Inference**: Coverage likely varies across modules. Without thresholds, there is no enforcement mechanism.

## 13.3 E2E Testing: **4.5/10**

**Fact**: `playwright/test` ^1.45.0 in devDependencies. `npm run test:visual`. `npm run capture:baseline`. `scripts/check-admin-spa-routes.mjs`.

**Absence**: No evidence of Playwright tests in CI pipeline. E2E tests appear manual/ad-hoc. No comprehensive E2E suite visible.

## 13.4 Missing Test Types

| Test Type | Status | Recommendation |
|-----------|--------|----------------|
| Contract tests | Partial | Add API contract tests |
| E2E in CI | Ad-hoc | Add Playwright to CI |
| Load testing | Ad-hoc | Add k6/Artillery |
| Mutation testing | None | Add Stryker |
| Security scanning | Partial | Add OWASP ZAP |
| Accessibility scanning | Partial | Add axe-core |
| Performance | None | Add Lighthouse CI |
| DR/restore testing | None | Schedule quarterly |
| Tenant isolation | Partial | Expand BE isolation tests |

## 13.5 Testing Scorecard: **6.8/10**

**Fact**: Good unit/component test discipline with consistent quality gates. Multiple test types present.

**Absence**: No enforced coverage thresholds. No E2E in CI. No load testing. No security scanning in pipeline.

---

# 14. Code Quality Audit

## 14.1 SOLID: **7.0/10**

| Principle | Score | Evidence |
|-----------|-------|----------|
| Single Responsibility | 7.0 | Apps have clear boundaries. But `service_ops` too broad. |
| Open/Closed | 7.0 | `LegacyRouter` extends without modifying. But adds complexity. |
| Liskov Substitution | 7.5 | DRF serializers follow LSP. But `cast as unknown as { … }` violates type safety. |
| Interface Segregation | 6.5 | `adapters/core` uses generic pattern. Type declarations unclear. |
| Dependency Inversion | 6.5 | `defaultCoreApiAdapter` is concrete. `QueryProvider` inverts dependencies. |

## 14.2 DRY: **6.5/10**

**Fact**: Shared components (`adminUi.tsx`, `soc.module.css` split, `tone.ts`). Shared routing (`routeCatalog.js`).

**Fact**: 3,531 lint warnings include unused variables and potential duplicate patterns.

**Fact**: `packages/web/src/utils/whaleTimeAdapter.js` appears orphaned (`referenceDate` unused — eslint warning at line 70).

**Fact**: `packages/vninvestcharts/` local component tree was deleted (Entry ~194) — reduced duplication.

## 14.3 KISS: **7.0/10**

**Fact**: Django ORM, React hooks, Vite build keep core logic simple.

**Concern**: Docker Compose complexity (15+ services), `db_router.CoreRouter`, `legacy_proxy.py` add unnecessary complexity without user value.

**Hypothesis**: 9 Celery queues may be more than needed. Consolidation could reduce operational complexity.

## 14.4 Clean Code: **7.0/10**

**Fact**: `npm run lint` = 0 errors. TypeScript strict mode enabled (`strict: true`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`). `eslint-plugin-react-hooks`. `prettier` + `lint-staged`.

**Fact**: 3,531 warnings, 0 errors. `react/jsx-no-literals` warnings. `no-unused-vars` in `whaleTimeAdapter.js:70`.

**Fact**: 7 `exhaustive-deps` errors fixed (Entry 192).

## 14.5 Naming: **7.2/10**

**Fact**: Consistent conventions: lowercase underscores for Django apps, PascalCase for components, `use` prefix for hooks, camelCase for variables, dot notation for i18n keys.

**Concern**: Some inconsistent naming (`SocDataOps*` vs `SocScheduler*` vs `SocOverview*`).

## 14.6 Design Patterns: **7.2/10**

| Pattern | Evidence |
|---------|----------|
| Repository | `adapters/core/` abstracts data access |
| Observer | `tenant-changed` CustomEvent |
| Factory | `get_ai_client(provider)` (Entry 203 C3), `getSocOverviewStreamUrl()` |
| Singleton | React Query `QueryProvider` |
| Proxy | `legacy_proxy.py`, `defaultCoreApiAdapter` |
| Middleware | Django `MIDDLEWARE` stack |
| Command | Celery tasks (`tasks.py`) |
| Strategy | Provider model selection |

**Inference**: Proxy pattern can mask problems. `defaultCoreApiAdapter cast as unknown as { … }` is a type-unsafe proxy pattern.

## 14.7 Code Quality Scorecard: **7.0/10**

| Criterion | Score |
|-----------|-------|
| SOLID | 7.0 |
| DRY | 6.5 |
| KISS | 7.0 |
| Clean Code | 7.0 |
| Naming | 7.2 |
| Design Patterns | 7.2 |

---

# 15. Technical Debt Audit

## 15.1 Technical Debt Register (Revised)

| # | Debt | Evidence Type | Impact | Cost | Priority | Action |
|---|------|---------------|--------|------|----------|--------|
| 1 | `legacy_proxy.py` + `LEGACY_BACKEND_URL` | Fact | Security + complexity | Medium | **High** | Inspect proxy, measure traffic, deprecate, then remove |
| 2 | `whale_engine.py` dead code | Fact (Entry 194) | Cognitive load | Low | **Medium** | Remove (0 callers confirmed) |
| 3 | `admin-ops` endpoints (410 GONE) | Fact | Dead code | Low | **Medium** | Remove if no external callers |
| 4 | `compat` module | Fact | Dual maintenance | High | **High** | Complete sunset (COMPAT-001/002) |
| 5 | 3,531 lint warnings | Fact | Code quality | Medium | **Medium** | Baseline, no new, auto-fix safe rules |
| 6 | `google-genai` missing (F6b) | Fact | AI feature incomplete | Low | **Medium** | Complete proxy test C2 |
| 7 | `db_router._CORE_APPS` fragility | Fact | Prod 500 (Entry 200) | High | **High** | Comprehensive test coverage |
| 8 | No backup/DR verification | Absence | Data loss risk | Medium | **High** | Implement and test backup/restore |
| 9 | No CSP headers | Fact (nginx.conf) | XSS risk | Low | **Medium** | Verify CDN/ingress, add if needed |
| 10 | No secret rotation | Absence | Security | Medium | **Medium** | Implement rotation policy |
| 11 | No E2E CI pipeline | Absence | Regression risk | Medium | **Medium** | Add Playwright to CI |
| 12 | Docker Compose complexity | Inference | OOM/cascade risk | High | **High** | Simplify, add health checks |
| 13 | No K8s | Absence | Scaling limit | — | **Not a debt** | Only if measured need exists |
| 14 | Single PostgreSQL/Redis | Fact (compose) | Potential SPOF | — | **Unknown** | Verify production topology |
| 15 | `data-theme` OS-dependent | Fact | UX inconsistency | Low | **Low** | Add user preference toggle |
| 16 | `exhaustive-deps` errors | Fact | React hooks | Low | **Low** | Fixed in Entry 192 |
| 17 | `check:shell:legacy` deprecated | Fact | Script cleanup | Low | **Low** | Remove or mark deprecated |

## 15.2 Debt Classification

**Critical (verify immediately)**:
- `legacy_proxy.py` (needs attack path analysis)
- `db_router._CORE_APPS` fragility (prod 500 history)
- No backup/DR verification (data loss risk)

**High (this quarter)**:
- `compat` module sunset
- `whale_engine.py` removal
- Docker Compose simplification
- Comprehensive `db_router` testing

**Medium (next quarter)**:
- Lint warning reduction
- Secret rotation
- E2E CI pipeline
- CSP header verification

**Low (ongoing)**:
- Script cleanup
- CSS polish
- `data-theme` preference toggle
- `exhaustive-deps` continued fixes

---

# 16. Risk Assessment (Revised)

| Risk | Level | Impact | Likelihood | Confidence | Recommendation |
|------|-------|--------|------------|------------|----------------|
| `legacy_proxy.py` SSRF exploit | **High** | High | Unknown | Medium | Inspect `legacy_proxy_view`; if user-controlled upstream → Critical; if fixed target → Medium |
| `db_router._CORE_APPS` missing app → write RuntimeError | **High** | Critical | Low | Confirmed | Add comprehensive test coverage |
| Docker Compose misconfiguration → OOM cascade | **High** | High | Medium | Medium | Simplify compose; add auto-restart; measure memory |
| No backup/DR → data loss | **High** | Critical | Unknown | Hypothesis | Implement backup schedule, test restore, define RPO/RTO |
| No CSP headers → XSS | **Medium** | Medium | Low | High (in nginx) | Verify CDN/ingress; add headers if not already |
| 3,531 lint warnings accumulate | **Medium** | Medium | High | Confirmed | Baseline, no new, reduce 15%/sprint |
| `DJANGO_ALLOWED_HOSTS` missing → crash | **Medium** | High | Medium | Confirmed | Preflight validation; clear error; CI env check. **Keep fail-closed.** |
| `google-genai` missing → AI incomplete | **Medium** | Medium | Medium | Confirmed | Complete proxy test C2 |
| Single PostgreSQL (if self-hosted) | **Medium** | High | Low | Hypothesis | Verify managed services; add replica if needed |
| No K8s → scaling limit | **Low** | Medium | Medium | Hypothesis | Only plan K8s if measured scaling need exists |
| No E2E CI → regressions | **Medium** | Medium | High | Hypothesis | Add Playwright to CI |
| No secret rotation | **Medium** | High | Low | Hypothesis | Implement rotation |
| `vnbroker` supply chain | **Medium** | High | Low | High | Pin SHA; use artifact registry |
| Queue complexity → operational errors | **Medium** | High | Medium | Medium | Measure queue depth; consolidate if possible |
| No load testing → unknown capacity | **Medium** | High | High | Hypothesis | Add k6/Artillery to CI |
| React 19 peer dependency compatibility | **Low** | Medium | Low | Fact | React 19 confirmed working with recharts ^2.15.4 |
| `data-theme` OS-dependent UX | **Low** | Low | High | Fact | Add user preference toggle |

**Critical methodology correction**: Severity must be matched with confidence. A "Critical" risk with "Hypothesis" confidence is not actionable — it's a monitoring target. The previous report mixed severity and confidence, leading to misprioritized remediation.

---

# 17. Roadmap (Risk-Reduction First)

## P0 — Verify Production Readiness (30 days)

All P0 items are **verification activities**, not implementation. They answer: "Can we recover from failure?"

| # | Action | Impact | Effort | Verification |
|---|--------|--------|--------|-------------|
| 1 | **Implement and test backup/restore** (PITR) | Data loss prevention | 1 week | Restore test from backup |
| 2 | **Define and test RTO/RPO** | DR readiness | 1 week | DR drill with measured times |
| 3 | **Verify tenant isolation** | Security | 1 week | Cross-tenant data access test |
| 4 | **Inspect `legacy_proxy_view`** for SSRF | Security | 2 days | Attack path analysis |
| 5 | **Verify production deployment topology** | Architecture | 2 days | Confirm managed vs self-hosted |
| 6 | **Critical dependency scan** | Security | 2 days | `npm audit`, `safety`, `pip-audit` |
| 7 | **Test deployment rollback** | Reliability | 2 days | Simulate failed deploy, measure rollback time |
| 8 | **Verify alert delivery** | Operations | 2 days | Trigger test alert, confirm receipt |
| 9 | **Verify AI data/privacy flow** | Compliance | 3 days | Audit data sent to AI providers |
| 10 | **Add pre-deployment env validation** | Reliability | 1 day | CI checks all required env vars |

## P1 — Reliability (60 days)

| # | Action | Impact | Effort | Verification |
|---|--------|--------|--------|-------------|
| 11 | **Load test with target workload** | Performance | 1 week | p95/p99 latency measured |
| 12 | **Reproduce and fix OOM scenarios** | Reliability | 1 week | Memory profiling, fix leaks |
| 13 | **Database connection saturation test** | Performance | 1 week | Connection pool utilization measured |
| 14 | **Redis/DB failure drill** | Availability | 3 days | Simulated failure, measured recovery |
| 15 | **Critical E2E flows in CI** | Quality | 1 week | Playwright CI pipeline |
| 16 | **Queue depth monitoring and alerting** | Operations | 2 days | Alerts at thresholds |
| 17 | **Add structured JSON logging** | Observability | 1 week | Log format verified |
| 18 | **Add distributed tracing (Jaeger/Tempo)** | Observability | 2 weeks | Trace sampling verified |

## P2 — Maintainability (90 days)

| # | Action | Impact | Effort | Verification |
|---|--------|--------|--------|-------------|
| 19 | **Lint baseline capture + no-new-warnings policy** | Quality | 1 week | Warning count stable or decreasing |
| 20 | **Remove `whale_engine.py`** | Cleanup | 1 day | 0 callers confirmed |
| 21 | **Complete `compat` module sunset** | Cleanup | 2 weeks | Zero imports to compat |
| 22 | **Measure `legacy_proxy.py` traffic** | Security | 3 days | Traffic log analyzed |
| 23 | **Deprecate `legacy_proxy.py`** | Cleanup | 1 week | Deprecation notice sent |
| 24 | **Structured logging implementation** | Maintainability | 1 week | JSON logs verified |
| 25 | **Add module boundary documentation** | Maintainability | 1 week | Architecture decision records |
| 26 | **Add `eslint-disable` audit** (not mass additions) | Quality | 2 days | Baseline documented |

## P3 — Product Enhancement (Requires Data)

These require product/telemetry data to justify prioritization:

| # | Action | Depends On |
|---|--------|-----------|
| 27 | Onboarding wizard | User onboarding data |
| 28 | Push notifications | Engagement data |
| 29 | Mobile app | Market data, user feedback |
| 30 | SSR for public pages | SEO metrics, public traffic data |
| 31 | Backtesting engine | User demand data |
| 32 | Usage-based billing | Revenue data |

**Do NOT add to roadmap without data**:
- ❌ Full microservices migration
- ❌ Kafka replacing Celery
- ❌ Kubernetes (unless measured need)
- ❌ React Server Components (without measurement)
- ❌ Next.js/Remix (without SEO evidence)
- ❌ GraphQL (without user demand)
- ❌ NFT/blockchain (no business case)

## Architecture Evolution Decision (Hypothesis)

**If growth requires scaling** (measured, not assumed):
1. **First**: Scale database (read replicas, connection pooling) — lowest complexity, highest impact
2. **Second**: Scale Celery workers independently — already supported by queue topology
3. **Third**: Consider service extraction **only at proven bottlenecks** — not all 19 apps
4. **Fourth**: Consider K8s **only if** multi-node, autoscaling, or complex deployment needed

**Service extraction candidates** (if needed):
- Market data ingestion/streaming
- Realtime distribution
- AI inference
- Notification delivery
- Billing webhook processing

**Do NOT extract all services** — modular monolith is valid for many growth stages.

---

# 18. Final Scorecard

> **Errata BL-20 (2026-09-24)**: headline section này ghi 7.3 nhưng bảng weighted cộng đúng = **7.53** (1.275+0.72+1.17+0.73+1.08+0.82+0.375+0.62+0.34+0.40). File giữ nguyên số gốc vì tính lịch sử; số hiệu chỉnh xem audit hợp nhất (69.1/100, 11 dimensions).

## Technical Assurance: **7.3/10** (headline gốc; weighted đúng 7.53 — xem errata)

| Dimension | Score | Weight | Weighted | Confidence |
|-----------|-------|--------|----------|------------|
| Build/Type/Test discipline | 8.5 | 15% | 1.275 | High |
| Architecture | 7.2 | 10% | 0.72 | Medium |
| Backend API | 7.8 | 15% | 1.17 | High |
| Frontend architecture | 7.3 | 10% | 0.73 | High |
| Security posture | 7.2 | 15% | 1.08 | Medium |
| Queue/async | 8.2 | 10% | 0.82 | High |
| Observability | 7.5 | 5% | 0.375 | Medium |
| Infrastructure reliability | 6.2 | 10% | 0.62 | Medium |
| Testing coverage | 6.8 | 5% | 0.34 | Medium |
| Documentation | 8.0 | 5% | 0.40 | High |
| **TOTAL** | | **100%** | **7.53** | |

## Product/Business: **Not Assessed**

Insufficient telemetry data from repository to assign meaningful scores. Requires DAU/MAU, retention, revenue, churn, ARPU, CAC, LTV, feature adoption.

## Combined Assessment

**VNInvest demonstrates strong technical engineering discipline and a well-structured platform. Technical assurance scores are high. However, enterprise production readiness cannot be confirmed without completing P0 verification gates (backup/restore, DR, tenant isolation, SSRF analysis).**

The platform is **production-capable** with many features of production readiness, but **production-ready at enterprise level** requires additional verification.

---

# Appendix A: Top 20 Issues (by Risk Reduction Value)

1. **Implement and test backup/restore with PITR** — Data loss prevention — P0
2. **Define and test RTO/RPO** — DR readiness — P0
3. **Verify tenant isolation** — Security — P0
4. **Inspect `legacy_proxy_view` for SSRF** — Security — P0
5. **Verify production deployment topology** — Architecture — P0
6. **Critical dependency vulnerability scan** — Security — P0
7. **Test deployment rollback procedure** — Reliability — P0
8. **Verify alert delivery** — Operations — P0
9. **Audit AI data/privacy flow** — Compliance — P0
10. **Add pre-deployment env validation** — Reliability — P0
11. **Load test with target workload** — Performance — P1
12. **Reproduce and fix OOM scenarios** — Reliability — P1
13. **Database connection saturation test** — Performance — P1
14. **Redis/DB failure drill** — Availability — P1
15. **Critical E2E flows in CI** — Quality — P1
16. **Remove `whale_engine.py` dead code** — Cleanup — P2
17. **Complete `compat` module sunset** — Cleanup — P2
18. **Lint baseline + no-new-warnings policy** — Quality — P2
19. **Add structured JSON logging** — Maintainability — P2
20. **Queue depth monitoring refinement** — Operations — P2

# Appendix B: Quick Wins (1 Week)

1. **Remove `whale_engine.py`** dead code (0.5 day) — confirmed 0 callers
2. **Add pre-deployment env validation** (1 day) — prevent `DJANGO_ALLOWED_HOSTS` crash
3. **Pin `vnbroker` to SHA** (0.5 day) — supply chain security
4. **Add CSP headers to nginx.conf** (0.5 day) — if not at CDN
5. **Remove deprecated `check:shell:legacy`** (0.5 day)
6. **Add `eslint-disable` audit** (2 days) — document baseline, do NOT mass add
7. **Add `no-unused-vars` auto-fix to lint-staged** (0.5 day)
8. **Inspect `legacy_proxy_view`** (2 days) — SSRF analysis
9. **Add `Content-Security-Policy` header** (0.5 day)
10. **Verify `DJANGO_DEBUG=False` in production env** (0.5 day)
11. **Add `.env` file to `.gitignore`** (0.5 day) — if not already
12. **Document `CELERY_QUEUES` synchronization requirement** (1 day)

# Appendix C: Fact/Inference Summary

**Facts confirmed by source code**:
- Quality gates pass (tsc 0, build PASS, eslint 0 errors, 446 vitest tests PASS)
- 9 Celery queues with purpose-built workers
- `legacy_proxy.py` catch-all exists at `urls.py:61`
- `DJANGO_ALLOWED_HOSTS` hard-fails in production if unset
- 3,531 lint warnings, 0 errors
- Multi-tenant middleware exists
- React Query for server state
- SAML SSO implemented
- SOC DataOps features implemented
- 204+ ledger entries with consistent quality gates

**Inferences (likely but not confirmed)**:
- `legacy_proxy.py` may create SSRF risk (needs attack path analysis)
- Docker complexity causes OOM incidents (historical evidence)
- No CSP headers at nginx level (may exist at CDN)
- `CONN_MAX_AGE` is app-level connection reuse, not PgBouncer
- Redis session backend (needs `SESSION_ENGINE` verification)
- `service_ops` has too many responsibilities
- 9 queues may be more than needed

**Hypotheses (needs investigation)**:
- Actual production topology may differ from compose
- Single DB/Redis may not be SPOF if managed services
- K8s may not be needed
- SSRF risk level depends on `legacy_proxy_view` implementation
- Raw SQL injection risk depends on management commands
- N+1 queries may exist but not confirmed
- CSP headers may exist at CDN/ingress level

**Absence (cannot be treated as evidence of non-existence)**:
- Mobile app (may be separate repo)
- MFA/2FA (may exist but not visible)
- E2E CI pipeline (may exist but not visible)
- Bundle analysis (may exist but not visible)
- Core Web Vitals monitoring
- Load testing
- Secret rotation policy
- DR procedure
- Backup schedule
- K8s manifests

---

# Appendix D: Architecture Evolution (100x Growth)

**Conditional architecture evolution — only if measured growth requires it.**

```
┌─────────────────────────────────────────────────────────────┐
│              CONDITIONAL EVOLUTION TRIGGER                      │
│  (NOT automatic — requires measured need)                      │
│                                                                │
│  Triggers:                                                     │
│  ✓ Database read latency > threshold (measured)                 │
│  ✓ Celery queue depth sustained > threshold (measured)          │
│  ✓ Need independent deployment cadence for bounded context      │
│  ✓ Compliance/ownership requires service isolation              │
│  ✗ "100x growth" alone is NOT a trigger                        │
└──────────────────────┬────────────────────────────────────────┘
                       │
          ┌────────────▼────────────┐
          │  IF TRIGGERED:          │
          │  1. Scale database      │
          │     (read replicas,     │
          │    connection pooler)   │
          │  2. Scale workers       │
          │     independently       │
          │  3. Extract ONE service │
          │     at proven bottleneck│
          │  4. Evaluate K8s        │
          │     if multi-node       │
          │     deployment needed   │
          └─────────────────────────┘
```

**NOT recommended as default path**:
- Full microservices migration
- Kafka replacing Celery
- Kubernetes for its own sake
- React Server Components without measurement
- GraphQL without user demand
- Next.js/Remix without SEO evidence
- NFT/blockchain without business case

---

## Audit Conclusion

VNInvest demonstrates **strong technical engineering discipline** with consistent quality gate adherence, comprehensive feature implementation, and excellent documentation. The modular monolith architecture with purpose-built Celery topology is a sound approach.

**However, this audit cannot confirm enterprise production readiness** because critical verification gates remain incomplete: backup/restore procedures, DR drills, tenant isolation testing, SSRF analysis, load testing, and security scanning.

**Three critical corrections from previous version**:
1. **"Not seen" ≠ "does not exist"** — All absences are explicitly labeled as Absence/Hypothesis, not treated as proof of non-existence.
2. **`DJANGO_ALLOWED_HOSTS` fail-closed is correct behavior** — Classified as Medium availability issue (deployment configuration), not Critical security finding. The fix is preflight validation, not graceful fallback.
3. **No K8s is not technical debt** — Only adds complexity without proven need. Roadmap items like Kafka replacing Celery, full microservices, React Server Components, and Kubernetes are removed as solution-first recommendations.

**Recommended next step**: Complete P0 verification gates, then re-assess production readiness. Do not pursue large architectural migrations without measured justification.

---

*Audit completed 2026-09-24. Revised version addressing methodology and severity corrections from previous audit.*
*Evidence basis: source code inspection, quality gate execution, docker-compose configuration, nginx.conf, settings.py, urls.py, i18n dictionaries, AGENTS.md progress ledger (Entries 166–204), CODE_CHANGE_AUDIT_LEDGER.md.*

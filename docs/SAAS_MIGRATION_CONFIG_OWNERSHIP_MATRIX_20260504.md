# CONFIG OWNERSHIP MATRIX — SaaS Production Migration & Legacy Monolith Decommission

**Ngày**: 2026-05-04  
**Mục tiêu**: Xác định rõ owner của mỗi config/setting trong hệ thống. Ai được ghi vào đâu. Ai chỉ được đọc.

---

## 1. Nguyên tắc ownership

1. **Single canonical writer per config**: mỗi business setting chỉ có một nơi được ghi.
2. **Read-only bridge được phép**: core containers được đọc legacy config nhưng KHÔNG ghi.
3. **Migration cutover là atomic**: khi core domain đã live, legacy writer phải bị disable.
4. **No shadow config stores**: không tạo config blob mới nếu chỉ mirror config đã tồn tại.

---

## 2. Ma trận ownership chi tiết

### 2.1 Security & Authentication Config

| Config | Current canonical file | Current owner | Phase 1 owner | Phase 3 end-state |
|---|---|---|---|---|
| `DJANGO_SECRET_KEY` | `backend/config/settings.py` | Legacy Backend | Legacy (keep) | Split: legacy + core riêng |
| `CORE_SECRET_KEY` | `packages/core/backend/src/vninvest_core/settings.py` | Core API | Core API | Core API |
| `CORE_PAT_PEPPER` | Env var | Both backends | Both backends | Core API (legacy decommissioned) |
| `JWT_SECRET_KEY` | `backend/config/settings.py` | Legacy Backend | Legacy Backend | Legacy → decommission Phase 6 |
| `SIMPLE_JWT['BLACKLIST_AFTER_ROTATION']` | `backend/config/settings.py` | Legacy Backend | **Phase 1: MUST set True** | Legacy → decommission |
| `ALLOWED_HOSTS` (core) | `packages/core/backend/src/vninvest_core/settings.py` | Core API | **Phase 1: Must be explicit** | Core API |
| `CORS_ALLOWED_ORIGINS` (core) | `packages/core/backend/src/vninvest_core/settings.py` | Core API | **Phase 1: Must be explicit** | Core API |
| `SystemEmailAccount` smtp credentials | `portfolio_systememailaccount` DB table | Legacy Backend | **Phase 1: Migrate to Fernet key** | `ops_audit.SystemEmailAccount` (Phase 3) |

**Read-only (Phase 1-2)**:
- Core API đọc `LEGACY_DB_PASSWORD` để connect legacy DB — chỉ đọc, không ghi config

---

### 2.2 Database Config

| Config | Current | Phase 2 transition | Phase 6 end-state |
|---|---|---|---|
| `POSTGRES_DB` (legacy) | `vninvest` | `vninvest` (readonly từ core) | Decommission |
| `POSTGRES_USER` (legacy) | `postgres` | `postgres` | Decommission |
| `POSTGRES_PASSWORD` (legacy) | `${VAR:?}` after P1.5 | Unchanged | Decommission |
| `CORE_DB_NAME` | (new P2.1) | `vninvest_core` | `vninvest_core` |
| `CORE_DB_USER` | (new P2.1) | `core_user` | `core_user` |
| `CORE_DB_PASSWORD` | (new P2.1) | `${VAR:?}` | `${VAR:?}` |
| `CONN_MAX_AGE` (legacy) | 0 (unset) → **P0.2: 60** | 60 | Decommission |
| `CONN_MAX_AGE` (core) | P2.1 | 60 | 60 |
| PgBouncer pool size | N/A → **P5.1** | 20 | 20 |
| PgBouncer max clients | N/A → **P5.1** | 500 | 500 |

---

### 2.3 Redis / Celery Config

| Config | Legacy namespace | Core namespace | Notes |
|---|---|---|---|
| Redis broker | `db=0` | `db=3` | Không overlap |
| Redis cache | `db=1` | `db=4` | Không overlap |
| Redis streams | `db=2` | `db=5` | Không overlap |
| Celery task queue (main) | `celery` | `core` | Tách routing |
| Celery task queue (ingest) | `ingest` (legacy) | `ingest` (core P2.3) | Cutover Phase 3 |
| Celery task queue (advisory) | N/A | `advisory` (P3.4) | Mới trong core |
| Celery beat schedule | `celery_beat_schedule` | `django_celery_beat` | DatabaseScheduler cho core |
| Beat task: materialize_symbol_snapshot | N/A | 60s interval | Core-only |
| Beat task: detect_and_store_global_whale_alerts | Legacy beat | Shadow P3.3.3 → Core cutover | Shadow run required |

**Writer rule**: Chỉ một beat scheduler được schedule cùng một task. Shadow tasks có tên khác, queue khác.

---

### 2.4 vnstock / Market Data Config

| Config | Canonical file | Writer | Read access |
|---|---|---|---|
| `RuntimeVnstockConfig` | `portfolio_runtimevnstockconfig` | `runtime_policy_helpers.py` | Legacy backend (all) + Core (read-only via materializer) |
| Default provider (KBS/VCI) | `RuntimeVnstockConfig.default_provider` | `runtime_policy_helpers.py` | Both |
| Provider fallback chain | `RuntimeVnstockConfig.fallback_chain` | `runtime_policy_helpers.py` | Both |
| Ingest concurrency | `RuntimeVnstockConfig.ingest_concurrency` | `runtime_policy_helpers.py` | Legacy only |
| **Phase 3.6**: `VnstockRuntimeConfig` | `market_data_vnstockriuntimeconfig` | `market_data.service` | Core only (post-cutover) |

**Transition rule**: Trong Phase 3.6, core `market_data.VnstockRuntimeConfig` được seed từ legacy `RuntimeVnstockConfig`. Sau cutover, legacy config becomes read-only reference, core config is canonical.

---

### 2.5 Signal Intelligence / Whale Policy Config

| Config | Canonical writer | Current location | Core end-state |
|---|---|---|---|
| Global detection universe | `global_signal_policy_helpers.py` | `portfolio_globalsignalpolicy` | `signal_intelligence.GlobalSignalPolicy` (Phase 3.3) |
| Whale alert threshold | `global_signal_policy_helpers.py` | `portfolio_globalsignalservicesconfig.whale_service` | `signal_intelligence.WhalePolicy` |
| Dark flow threshold | `global_signal_policy_helpers.py` | `portfolio_globalsignalservicesconfig.dark_flow_service` | `signal_intelligence.DarkFlowPolicy` |
| Whale governance versioning | Whale mission-control services | `portfolio_whaleconfigversion` | `signal_intelligence.WhaleConfigVersion` (Phase 3.3) |
| `intraday_universe_group_ids` (hint) | `runtime_policy_helpers.py` | `portfolio_runtimevnstockconfig` | Decommission Phase 6 (hint becomes unnecessary) |

**Rules (Phase 1-3)**:
- Core containers KHÔNG ghi vào `portfolio_globalsignalpolicy` hoặc `portfolio_whaleconfigversion`.
- Core chỉ đọc effective config từ legacy tables để populate materializers.
- Sau Phase 3.3 cutover: `global_signal_policy_helpers.py` phải redirect writes sang core tables.

---

### 2.6 AI / Advisory Config

| Config | Current canonical | Phase 3.4 canonical | Notes |
|---|---|---|---|
| `SystemAISettings.default_provider` | `portfolio_systemaisettings` | `advisory_systemaisettings` | Cutover Phase 3.4 |
| `SystemAISettings.openclaw_api_key` | `portfolio_systemaisettings` | `advisory_systemaisettings` | Encrypted with Fernet key |
| `SystemAISettings.openai_api_key` | `portfolio_systemaisettings` | `advisory_systemaisettings` | Encrypted with Fernet key |
| Token budget per user | `UserConfig.advisory_max_tokens_per_day` | `commercial_quota` | Phase 3.4 |
| Advisory max tokens global | `SystemAISettings.max_tokens` | `advisory_systemaisettings` | Phase 3.4 |
| Prompt config | `ai_prompt_config_ssot.py` | `advisory.prompt_engine` | Phase 3.4 |

**Security note**: AI provider API keys phải dùng Fernet key riêng — không phụ thuộc Django SECRET_KEY. Fernet key stored in `ADVISORY_FERNET_KEY` env var.

---

### 2.7 Commercial / Subscription Config

| Config | Current location | Phase 3.2 canonical |
|---|---|---|
| User plan | `UserConfig.plan` | `commercial_subscription.plan` |
| Plan expiry | `UserConfig.plan_expires_at` | `commercial_subscription.expires_at` |
| Trial end | `UserConfig.trial_ends_at` | `commercial_subscription.trial_ends_at` |
| Daily token limit | `UserConfig.advisory_max_tokens_per_day` | `commercial_quota.limit_value` |
| VNPay webhook secret | Env var `VNPAY_HASH_SECRET` | Env var (keep) |
| MoMo webhook secret | Env var `MOMO_SECRET_KEY` | Env var (keep) |

---

### 2.8 Infrastructure / Observability Config

| Config | File | Owner | Notes |
|---|---|---|---|
| Prometheus scrape config | `infra/prometheus/prometheus.yml` | DevOps | Phase 5.2 |
| Grafana admin password | `${GRAFANA_PASSWORD:?}` | DevOps | Phase 5.2 |
| Sentry DSN | `SENTRY_DSN` env var | DevOps | Phase 5.3 |
| GitHub Actions secrets | GitHub repo settings | DevOps | Phase 5.4 |
| Cloudflare R2 access key | `CF_R2_ACCESS_KEY` env var | DevOps | Phase 5.5 |
| Docker image registry | `ghcr.io/vninvest/` | DevOps | Phase 5.4 |
| PgBouncer auth | `infra/pgbouncer/userlist.txt` | DevOps | Phase 5.1 |

---

## 3. Prohibited config patterns

| Pattern | Tại sao cấm | Thay thế đúng |
|---|---|---|
| Hardcode secret trong source | Exposed in git history | Env var với `${VAR:?error}` |
| Default secret trong compose | Prod có thể dùng default | `${VAR:?}` syntax |
| Hai writers cho cùng config | Inconsistency, race condition | Single writer rule |
| Core container ghi vào `portfolio_*` | Breaks separation | CoreRouter block |
| Chỉnh config qua Django shell trực tiếp | Not tracked, not reproducible | Via management command hoặc API |
| `CORE_PAT_PEPPER` unset trong production | Degraded to plain SHA-256 | Require env var |
| AI API keys trong settings.py string | Exposed in logs | Encrypted DB field |

---

## 4. Config change procedure

### Thông thường

1. Thay đổi env var trong `.env.prod` (không commit)
2. Update `.env.prod.example` nếu là biến mới (commit)
3. Restart service bị ảnh hưởng
4. Verify behavior sau restart

### Config liên quan security (PAT pepper, secret key)

1. Tạo migration plan trước (vì sẽ invalidate existing tokens/data)
2. Thông báo stakeholders ít nhất 48h
3. Chạy migration command (rotate tokens, re-encrypt credentials)
4. Deploy config mới
5. Verify tất cả credentials hoạt động với config mới

### Config liên quan business logic (AI provider, whale threshold)

1. Dùng API endpoint admin để preview impact
2. Preview/apply workflow — không ghi trực tiếp vào DB
3. Có rollback plan sẵn

---

## 5. Environment-specific config

| Config | Development | Staging | Production |
|---|---|---|---|
| `DEBUG` | True | False | False |
| `ALLOWED_HOSTS` | `localhost,127.0.0.1` | explicit domain | explicit domain |
| `CONN_MAX_AGE` | 60 | 60 | 60 |
| `CELERY_TASK_ALWAYS_EAGER` | False | False | False |
| `SENTRY_DSN` | (empty) | staging DSN | production DSN |
| PgBouncer pool | N/A | 10 | 20 |
| Celery workers | 2 | 2 | 4 |
| `CORE_ENV` | development | staging | production |
| Docker source mount | YES (dev only) | NO | NO |
| Auto-migrate on startup | YES (dev only) | NO | NO |

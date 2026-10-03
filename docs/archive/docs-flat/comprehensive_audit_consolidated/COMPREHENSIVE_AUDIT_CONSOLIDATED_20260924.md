# VNInvest — Hồ sơ Audit Hợp nhất (Consolidated) — 2026-09-24

> **Tài liệu hoàn chỉnh duy nhất**, hợp nhất 3 lớp:
> - **Lớp 1** (`docs/COMPREHENSIVE_AUDIT_20260924.md`, 1343 dòng): audit revised với phân loại bằng chứng Fact/Inference/Hypothesis/Absence.
> - **Lớp 2** (phản biện độc lập cùng ngày): verify lại từng claim bằng grep/read, phát hiện 8 contradictions + 2 findings mới.
> - **Lớp 3** (hội đồng 10 vai trò cùng ngày): audit full 18 sections dưới đây, mọi kết luận kèm `file:line`.
>
> **Hội đồng**: CTO · Solution Architect · Senior Backend · Senior Frontend · UI/UX · Product Manager · QA Lead · DevOps · Security · Performance.
> **Scope**: `packages/web` (React 19 + Vite 5 + TS) + `packages/core/backend` (Django 5.2). `packages/mobile` tồn tại dạng scaffold; `opencore`/`vip-app` ngoài scope kỹ thuật đợt này.
> **Xác minh hôm nay**: `npx tsc --noEmit` (packages/web) = **EXIT 0**. Các gate nặng khác (vitest full, eslint full, BE tests) ghi rõ CHƯA RE-RUN.

**5 findings nặng nhất**: (1) SAML signature verification là stub có điều kiện — `saml_service.py:318-333`; (2) Không có `AUTH_PASSWORD_VALIDATORS`, không có `SESSION_*`/`SECURE_*` trong `settings.py`; (3) PgBouncer deploy nhưng chết (không dùng); (4) Test stale import module đã xoá — `tests/test_workstation_endpoints.py:34`; (5) `whale_engine.py` unimportable (SyntaxError dòng 1).

---

# PHẦN I — Kế thừa từ audit Lớp 1 (giữ nguyên, đã verify)

| Verdict Lớp 1 | Kết quả verify Lớp 2/3 |
|---|---|
| Phân loại bằng chứng 4 nhãn | Giữ, nhưng fix 2 Absence sai (C1, C2 §II) |
| `DJANGO_ALLOWED_HOSTS` → Medium, fail-closed là đúng | **Đúng** — bổ sung: CORS (`settings.py:298-302`) + CSRF (`:320-324`) cũng fail-closed |
| `legacy_proxy` High cần validate | **Sửa**: SSRF cổ điển ≈ Low (host từ env); risk thật là 3 điểm khác (SEC-D §III.10) |
| K8s = "Not a debt" | **Đúng** — 0 manifest, không đưa roadmap |
| Single DB/Redis = Unknown (cần verify topology) | **Đúng** — compose chính single PG/Redis (`docker-compose.yml:17-53`) |
| Xóa roadmap solution-first | **Đúng** — deny-list microservices/Kafka/RSC/Next.js/GraphQL/NFT giữ nguyên |
| Product/Business = Not Assessed | **Đúng** — không telemetry trong repo |
| Production-capable (không phải ready) + P0 gates | **Đúng** — P0 Lớp 3 cụ thể hơn (§III.17) |
| Scorecard Technical 7.3 | **Sửa**: bảng weighted = 7.53; Lớp 3 chấm lại độc lập = 69.1/100 (§III.18) |

---

# PHẦN II — Corrections Register (Lớp 1/ledger vs code)

| # | Doc (file:line) | Thực tế (file:line) | Tác động |
|---|---|---|---|
| C1 | Lớp 1 §5.6: "CACHES may not be Redis" | `settings.py:347-354` = `RedisCache` + `REDIS_URL` (Fact; chỉ TESTING override LocMemCache `:372-377`) | Premise sai |
| C2 | Lớp 1 §5.4:313 "`dangerouslySetInnerHTML` not checked" | `ShellToast.tsx:106`: 1 usage, static `@keyframes`, benign (Fact) | Absence sai |
| C3 | Lớp 1: "Complete compat sunset" như việc còn lại | `compat/urls.py:12-15` rỗng + DONE; nhưng `market_data/legacy_views.py` + `user_workspace/legacy_views.py` còn tồn tại, 0 importer | Roadmap mơ hồ |
| C4 | Ledger Entry 90: "không còn import legacy_views" | `tests/test_workstation_endpoints.py:34` import module đã xoá; `market_serving/legacy_views.py` glob = KHÔNG TỒN TẠI | Test broken, gate mù |
| C5 | PgBouncer "not visible" (Lớp 1) | Tồn tại `docker-compose.prod.yml:446-477` nhưng core-api/worker trỏ `core-db:5432` (`:91`,`:140`) | Dead infra |
| C6 | Mobile "not found in working tree" (Lớp 1) | `packages/mobile/package.json` v0.1.0 "package-track scaffold" tồn tại | Sai scope |
| C7 | Backups "no evidence" (Lớp 1) | 3 dump ad-hoc trong `backups/` (69MB/69MB/23MB); lịch tự động/PITR = 0 hit | Có backup tay, thiếu chiến lược |
| C8 | `whale_engine.py` "dead, 0 callers" | Không chỉ dead mà **unimportable** (dòng 1 text trần, `ast.parse` SyntaxError; 0 importer trong `src/`) | Lý do xóa mạnh hơn |
| C9 | Scorecard header 7.3 vs bảng 7.53; CSP liệt kê trùng (§15.1:1047-1048) | Tính lại = 7.53; duplicate editorial | Số headline sai |

---

# PHẦN III — Audit hội đồng 18 sections (bằng chứng đầy đủ)

## 1. Executive Summary

VNInvest: SaaS chứng khoán VN + robo-advisory (ticker realtime, portfolio/watchlist, screener, whale/signal, AI advisory, SOC, admin/tenant, Stripe, SAML SSO). Stack: React 19.2.7 + Vite 5.3.1 + react-query 5.101.2 (`package.json:67,91-92,140`) · Django 5.2 + Channels/Daphne + Celery 5 + Redis 7 + PG16 (`requirements.txt:1-24`, `docker-compose.yml:18,39`). **Kỹ thuật 7.0/10**: kỷ luật gates tốt, monolith modular hợp lý, queue chín chắn — nhưng **chưa production-ready enterprise**: SAML stub, password/session policy trống, backup tay, thiếu DR/loadtest/coverage-gate. Rủi ro top: SEC-A (§10), password/session trống, backup/DR, proxy `verify=False`. Điểm mạnh top: fail-closed env 3 lớp, 9-queue Celery, tenant middleware + tests, OpenAPI, i18n 6320/6300 dòng, CI 7 workflows.

## 2. Product Audit

Bài toán: NĐT VN cần theo dõi danh mục + tín hiệu dòng tiền lớn + tư vấn AI. Bằng chứng: `advisory/models.py:16,55,113` (SystemAISettings/AdvisoryRecord/AdvisorySession), screener (`ScreenerFilterBuilder.tsx`…), alert-center (`AlertCard.tsx`, `MuteModal.tsx`). Hoàn thiện (source-verified): portfolio/watchlist, screener, signals P0–P2c, SOC ~95%, admin R0–R8, SAML protocol, Stripe (`settings.py:201-211`). Gemini 3.8: catalog xong, SDK chờ (`requirements.txt:28`). **PMF/retention/conversion/ROI: Không đủ bằng chứng** (0 telemetry) — không chấm, không ưu tiên High cho feature mới khi chưa đo. Thiếu (Hypothesis): onboarding wizard (0 hit `packages/web/src`), push, backtest, PDF. Thừa: không kết luận được từ source.

## 3. Business Audit

Thương mại hóa có nền: pricing + Stripe (`settings.py:201-211`), tenant + quota middleware (`identity_access/middleware.py:17,286`). Scale/O&M cost/ROI: **Không đủ bằng chứng** — không chấm. Rủi ro vận hành thấy từ source: single DB/Redis + beat đơn (compose chính), backup tay.

## 4. Architecture Audit

Modular monolith + workers + realtime — **không phải microservices** (1 Django process, 15 `models.py`, 1 DB). Boundaries tốt: mount `/core/v1/` + namespace (`urls.py:36-51`), OpenAPI (`settings.py:274-284`), FE `pages/features/adapters`. Bottleneck (Fact): single PG/Redis, single worker ăn 7 queues (`docker-compose.yml:120`), beat đơn, Daphne đơn. Anti-pattern: catch-all proxy (`urls.py:61`); `LEGACY_BACKEND_URL` gán 2 lần (`settings.py:130`→`:143`, dòng 130 chết); `service_ops` ôm đồm; `db_router` coupling (đã gây 500 prod, nay fix `db_router.py:34-35`). Hướng: giữ monolith; scale theo số liệu: replica → nối PgBouncer → tách worker → tách 1 service ở bottleneck đã đo.

## 5. Backend Audit

REST nhất quán + version + 410 GONE (`urls.py:56`); trừ catch-all proxy + rewrite 2 đường vào (`nginx.conf:238-251`). Middleware tenant/trace (`identity_access/middleware.py:17,286`, `ops_audit/middleware.py:15`), exception tập trung (`exceptions.py:166`), throttle đa bucket (`settings.py:246-271`). Turnstile (`:169-170`); **thiếu `AUTH_PASSWORD_VALIDATORS`** (grep 0 hit). RedisCache thật (`:347-354`); 9 queues dev (`docker-compose.dev.yml:191-463`) + LLEN monitor; SSE + Channels. Dead: `whale_engine.py` (broken), stale test `:34`, `LEGACY_BACKEND_URL` default trỏ host không tồn tại ở prod (`docker-compose.yml:77`) → proxy luôn 502 — bằng chứng khai tử. N+1/leak: **Không đủ bằng chứng**.

## 6. Database Audit

FK user-scoped (`AdvisoryRecord.user :72`), UUID + `db_index` (`:69,93-94,125`), migration hệ thống (0002/0007/0008/0012). Index tổ hợp/partial/GIN, `select_related`, lock, rollback test: **Không đủ bằng chứng** — cấm đề xuất CREATE INDEX khi chưa `EXPLAIN`. Backup: 3 dump tay (Fact) + lịch/PITR/WAL/restore-test 0 hit → **có backup ad-hoc, không có chiến lược**.

## 7. Frontend Audit

`pages/features/components/adapters/context/hooks/i18n` rõ; shared kit + `routeCatalog.js` (16KB) + gate regression (`package.json:12`). RQ 5.101 + key scope `tenant_id`; không zustand/jotai (0 hit) → state phân tán (Inference). Widget lazy-load dynamic import. Re-render/bundle-leak: **Không đủ bằng chứng** (chưa analyzer/profile). SEO = CSR-only (Fact cấu trúc); a11y có Radix + `check:contrast` + `dom-landmarks` (Fact `package.json:12`), thiếu test screen-reader.

## 8. UI Audit

Hierarchy 7.0 · Layout 7.0 · Typography 6.5 (thiếu type-scale) · Color 7.0 (`tone.ts`, contrast 1.3→4.5+) · Consistency 7.0 · Responsive 7.0 · Mobile 5.0 (scaffold) · Desktop 7.5.

## 9. UX Audit

Journey suy từ catalog + menu 5 nhóm/13 mục: logic (Inference). Onboarding: 0 hit (Absence). Error/empty/feedback tốt ở tầng component (`PageErrorBoundary`, `AISettingsErrorBoundary:1`, `EmptyState`, toast, inline error). Friction (Hypothesis): mixed hash/route nav AI CC, 11 nhóm admin, thiếu global boundary tập trung. Conversion: **Không đủ bằng chứng**.

## 10. Security Audit

| ID | Finding | Sev | Căn cứ |
|---|---|---|---|
| SEC-A | SAML verify stub (chờ `python3-saml`+xmlsec1, STRICT qua env) | High | `saml_service.py:318-333`, `views/sso.py:4-6` |
| SEC-B | Không `AUTH_PASSWORD_VALIDATORS` | Medium | grep 0 hit |
| SEC-C | Không `SESSION_*`/`SECURE_*`/HSTS ở code | Medium | scoped grep 0 hit |
| SEC-D | Proxy `verify=False :42`, `csrf_exempt :21`, forward Auth `:28-33`, reflect headers `:69-74` | Medium | `legacy_proxy.py` toàn file |
| SEC-E | SSRF cổ điển qua proxy | Low | host từ env `:23` |
| SEC-F | CSP/HSTS/X-Frame vắng ở nginx, Unknown ở CDN | Med/Unknown | `nginx.conf` 279 dòng |
| SEC-G | `SECRET_KEY` default nhưng prod fail-closed | Low | `settings.py:19-20,33-36` |
| SEC-H | MFA/rotation/dep-scan/SBOM | Unknown | 0 bằng chứng |
| Mạnh | PAT pepper (`:37-42`), throttle+Turnstile (`:246-271,:169-170`), tenant MW + tests, CORS/CSRF fail-closed (`:298-324`), vnbroker ghim SHA (`requirements.txt:30`) | — | — |

## 11. DevOps Audit

CI 7 workflows — `web-ci.yml:39,42,65,89` chạy lint+tsc+test+build (điểm mạnh Lớp 1 bỏ sót). Prod 8 services; dev ~15 + 9 queue workers + drain-monitor + exporter. K8s 0 manifest — không phải debt. Observability: Prometheus/Grafana/exporter + `RequestTraceMiddleware` + Sentry conditional; trace phân tán/log tập trung 0 bằng chứng. **PgBouncer chết**: tồn tại (`docker-compose.prod.yml:446-477`) nhưng không dùng (`:91,:140`). DR: volumes + 3 dump tay; PITR/RTO/RPO/drill 0 bằng chứng.

## 12. Performance Audit

p95/p99/TTFB/Web Vitals RUM: **Không đủ bằng chứng**. Fact: nginx `50r/s` + timeout 300s API/SSE (`nginx.conf:2,196,209`); `CONN_MAX_AGE` 60 là reuse app-level, không phải pooling ngoài. Thứ tự: bundle analysis → RUM → slow-log → nối PgBouncer → cache. Cấm Next.js/Kafka/K8s khi chưa đo.

## 13. Testing Audit

Có: Jest + Vitest, `playwright.config.ts`, tests SAML/middleware/SLO/conflict, parity + contract-smoke (Entries 206-207). Thiếu (Fact): coverage gate (`--no-coverage`, `package.json:23`), E2E trong CI (web-ci không có job playwright), loadtest, mutation, ZAP/axe/Lighthouse CI, DR test, secret-scan. Vết nứt: stale import `test_workstation_endpoints.py:34` (ERROR-Medium).

## 14. Code Quality

SOLID 7.0 · DRY 6.5 (trừ 3531 warnings chưa re-run) · KISS 7.0 · Clean 7.0 (tsc 0 hôm nay, strict) · Naming 7.0 · Patterns 7.0 (Repository/Observer/Factory/Middleware/Command).

## 15. Technical Debt

P0: SAML stub (1-2w) · password/session (2-3d) · proxy TLS/headers (2-3d) · backup/DR (1-2w) · PgBouncer nối (0.5-1d). P1: `whale_engine` + stale test (0.5d) · compat/legacy_views sót (1-2w) · sunset proxy (1w, đo trước) · E2E CI/coverage/loadtest (2-4w). P2: warnings 15%/sprint (cấm mass `eslint-disable`). Không phải debt: K8s/microservices/Kafka/Next.js/GraphQL/NFT.

## 16. Risk Assessment

R-01 SAML unverified-High · R-02 password/session-Med · R-03 MITM proxy-Med · R-04 mất dữ liệu-High · R-05 PgBouncer chết + single DB-Med · R-06 stale test-Med · R-07 OOM/queue-Med · R-08 headers-Med/Low · R-09 không E2E/load-Med · R-10 supply chain (`latest` prometheus/grafana `docker-compose.yml:191,211`)-Med. (Chi tiết impact/likelihood/khuyến nghị như audit hội đồng.)

## 17. Roadmap

**30 ngày (P0)**: SAML STRICT+xmlsec1 · password/session flags · proxy TLS+header scope · backup schedule + restore test + RTO/RPO · nối PgBouncer · sửa stale test + xóa `whale_engine` · env preflight · dep-scan · verify CDN + topology.
**90 ngày (P1)**: Playwright vào `web-ci.yml` · k6 smoke + DB saturation · sunset compat/proxy (đo trước) · JSON logging · coverage gate dần · secret rotation.
**6 tháng (P2)**: warnings −15%/sprint · tracing nếu cần · docs biên · mobile nếu có tín hiệu product.
**1 năm (P3, cần dữ liệu)**: read-replica · tách 1 service ở bottleneck đo được · K8s chỉ khi multi-node/autoscale.

## 18. Final Scorecard

Architecture 7.2 · Backend 7.5 · Database 6.8 · Frontend 7.3 · UI 6.9 · UX 6.8 · Security 6.5 · DevOps 7.0 · Performance 6.5 · Testing 6.5 · Maintainability 7.0 · Product N/A · Business N/A.
**Tổng (11 dimensions): 76.0/110 → 69.1/100.**

**Top 20 vấn đề / Top 20 cải tiến / Quick wins / Kiến trúc 100x**: xem audit hội đồng (edge CDN → API replicas → PgBouncer → PG primary+replicas (+partition tick theo tháng khi có số) → Redis Cluster → workers theo queue-depth → tách 1 service → K8s+HPA cuối cùng; quick wins 1 tuần: xóa `whale_engine`, sửa import test, nối PgBouncer, auth flags, proxy `verify=True`, CSP, grep-gate, dep-scan, preflight env, xóa gán trùng `settings.py:130`).

---

# Phụ lục: Gates & câu hỏi mở

- `npx tsc --noEmit` (packages/web): EXIT 0 (verify 2026-09-24). vitest/eslint-full/BE: CHƯA RE-RUN đợt này.
- Mở: topology prod thật (managed DB?) · headers ở CDN? · `test_workstation_endpoints.py` có trong CI collect? · cookie/session flags prod set ở đâu? · mobile repo riêng hay chính `packages/mobile`?

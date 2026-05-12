# HANDOFF MASTER — SaaS Production Migration & Legacy Monolith Decommission

**Ngày**: 2026-05-04  
**Trạng thái**: READY FOR TEAM EXECUTION  
**Phiên bản**: 1.0

---

## 1. Mục tiêu bàn giao

Tài liệu này là master coordination cho toàn bộ chương trình di cư VNInvest từ kiến trúc hybrid monolith sang SaaS production-grade hoàn toàn, bao gồm:

1. Loại bỏ toàn bộ legacy monolith code (`backend/`) sau khi di cư đầy đủ.
2. Đưa `packages/core/backend/` trở thành hệ thống duy nhất phục vụ production.
3. Chuyển toàn bộ frontend từ `frontend/src/` sang `packages/web/src/`.
4. Đảm bảo bảo mật, khả năng chịu tải và monitoring đạt tiêu chuẩn production.
5. Không có data loss, không có downtime kéo dài trong quá trình chuyển đổi.

Chương trình này giải quyết đồng thời các vấn đề đã được audit xác nhận:

1. Core API không có data do materializers trỏ sai bảng.
2. Bảo mật có 6 lỗ hổng xác định (JWT, PAT, CORS, ALLOWED_HOSTS, secrets, email encryption).
3. Kiến trúc hybrid gây memory overhead ~1.7GB từ Celery workers dư thừa.
4. Source-mount trong production Docker compose tạo nguy cơ trực tiếp cho production data.
5. Không có monitoring, không có automated backup, không có CI/CD.

---

## 2. Kết quả cuối bắt buộc

Sau khi hoàn thành toàn bộ chương trình, hệ thống phải đồng thời đạt đủ các kết quả sau:

1. **Không còn `backend/` trong production**: legacy container đã tắt, code đã xoá khỏi main branch.
2. **Không còn `frontend/src/` phục vụ users**: mọi traffic frontend đi qua `packages/web/dist/`.
3. **Tất cả API traffic qua `/core/v1/`**: nginx routing đã cắt hoàn toàn legacy `/api/`.
4. **Zero security regressions**: tất cả 6 lỗ hổng đã audit phải được verify đã sửa.
5. **Data continuity**: tất cả historical data đã migrate với parity >= 99% trên sample verification.
6. **Uptime SLA**: API p95 latency < 200ms, concurrent users 500+, uptime 99.9%.
7. **Observability**: Prometheus + Grafana running, Sentry capturing errors, alerts configured.
8. **Automated backup**: daily pg_dump chạy thành công ít nhất 7 ngày liên tiếp trước decommission.
9. **CI/CD**: mọi push to main phải trigger test + build + deploy pipeline.
10. **Documentation parity**: `module_tree_full.md` đã regenerate, `docs/CODE_CHANGE_AUDIT_LEDGER.md` đã sync.

---

## 3. Bộ tài liệu trong gói này

### 3.1 Triad bắt buộc

1. `docs/IMPLEMENTATION_PLAN_SAAS_MIGRATION_20260504.md`
2. `docs/TECH_SPEC_SAAS_MIGRATION_20260504.md`
3. `docs/TASKBOARD_SAAS_MIGRATION_20260504.md`

### 3.2 Tài liệu bàn giao, audit và thực thi

1. `docs/SAAS_MIGRATION_HANDOFF_MASTER_20260504.md` ← file này
2. `docs/SAAS_MIGRATION_TRACEABILITY_MATRIX_20260504.md`
3. `docs/SAAS_MIGRATION_SELF_AUDIT_AND_TEST_PROTOCOL_20260504.md`
4. `docs/SAAS_MIGRATION_EXECUTION_EVIDENCE_TEMPLATE_20260504.md`
5. `docs/SAAS_MIGRATION_CONFIG_OWNERSHIP_MATRIX_20260504.md`
6. `docs/SAAS_MIGRATION_CODE_QUALITY_CONSTITUTION_20260504.md`
7. `docs/RUN_CODE_REVIEW_SAAS_MIGRATION_20260504.md`
8. `docs/RUN_INTEGRATION_TESTS_SAAS_MIGRATION_20260504.md`
9. `docs/RUN_SPEC_AUDIT_SAAS_MIGRATION_20260504.md`

### 3.3 Master plan gốc để tham chiếu

1. `docs/SAAS_PRODUCTION_MIGRATION_MASTER_PLAN_20260504.md` — full narrative plan
2. `docs/audit reports/audit_saas_report_20260504.md` — audit evidence đầu vào

### 3.4 Repo rulebook phải tuân thủ

1. `AGENTS.md`
2. `quality/QUALITY.md`

---

## 4. Thứ tự ưu tiên khi có xung đột diễn giải

1. `docs/TECH_SPEC_SAAS_MIGRATION_20260504.md`
2. `docs/IMPLEMENTATION_PLAN_SAAS_MIGRATION_20260504.md`
3. `docs/SAAS_MIGRATION_TRACEABILITY_MATRIX_20260504.md`
4. `docs/TASKBOARD_SAAS_MIGRATION_20260504.md`
5. `docs/SAAS_MIGRATION_CONFIG_OWNERSHIP_MATRIX_20260504.md`
6. `docs/SAAS_MIGRATION_CODE_QUALITY_CONSTITUTION_20260504.md`
7. `docs/SAAS_MIGRATION_SELF_AUDIT_AND_TEST_PROTOCOL_20260504.md`
8. `docs/RUN_CODE_REVIEW_SAAS_MIGRATION_20260504.md`
9. `docs/RUN_INTEGRATION_TESTS_SAAS_MIGRATION_20260504.md`
10. `docs/RUN_SPEC_AUDIT_SAAS_MIGRATION_20260504.md`
11. `docs/SAAS_PRODUCTION_MIGRATION_MASTER_PLAN_20260504.md`
12. `AGENTS.md`
13. `quality/QUALITY.md`

---

## 5. Các quyết định đã khóa

### 5.1 Kiến trúc mục tiêu

1. **`packages/core/backend/`** là backend duy nhất trong production end-state. Không tạo thêm `packages/legacy-proxy/` hay bất kỳ bridge container nào chạy mãi.
2. **`packages/web/src/`** là frontend duy nhất trong production end-state. Không giữ `frontend/` như alternate entry point sau Phase 4.
3. **Immutable Docker images**: mọi service production phải build từ Dockerfile, không mount source code vào container production.
4. **Separate databases**: `vninvest` DB cho legacy (readonly sau Phase 2), `vninvest_core` DB cho SaaS core. Không chia sẻ schema.
5. **Single Redis namespace per layer**: core sử dụng Redis db=3 broker + db=4 cache + db=5 streams. Không overlap with legacy db=0/1/2.

### 5.2 Migration strategy

1. **Materializer-first**: Trước khi migrate business logic, phải có data flowing qua core materializers. Phase 0 không thể bỏ qua.
2. **Shadow run mandatory cho Celery tasks**: Mọi task migration ở Phase 3 phải chạy song song legacy + core ít nhất 3 ngày trade trước khi tắt legacy task. Parity threshold: 99%.
3. **No big-bang cutover**: Frontend và backend migration theo domain nhỏ dần. Nginx routing chuyển dần từng path.
4. **Pre-decommission gates là hard stop**: Không được xoá `backend/` code nếu chưa pass tất cả 7 gates trong Phase 6.

### 5.3 Security constraints

1. **JWT blacklist phải enable** trước bất kỳ production deployment nào. Đây là hard requirement, không có exception.
2. **PAT HMAC pepper phải apply** trước Phase 2 (vì Phase 2 sẽ có users thật dùng PAT).
3. **ALLOWED_HOSTS không được là wildcard** trong production. Phải có explicit domain list.
4. **Không có default passwords trong compose**: mọi secret phải dùng `${VAR:?error}` syntax.
5. **Email credentials không được depend vào Django SECRET_KEY** — long-term phải migrate sang Fernet key riêng.

### 5.4 Data integrity constraints

1. **Không xoá data legacy trước 30 ngày** sau khi migration verify hoàn thành.
2. **Rename deprecated tables** sang `_deprecated_` prefix thay vì DROP ngay.
3. **Backup verify** phải có restore test thực tế trên staging trước khi decommission.
4. **PAT token migration**: phải notify service accounts 48h trước khi apply PAT hash fix, cung cấp script rotate.

### 5.5 Nghiêm cấm

1. **Không merge code xoá `backend/` trước khi Phase 3-5 complete** và tất cả gates pass.
2. **Không chạy `manage.py migrate` legacy từ core-api container** — hai migration histories phải hoàn toàn tách biệt.
3. **Không tạo service mới ghi vào `portfolio_*` tables từ core containers** — đọc thì được (materializers), ghi thì không.
4. **Không duplicate Celery beat schedule** giữa legacy beat và core beat cho cùng một task business. Shadow run phải có explicit dedup logic.
5. **Không copy-paste component từ `frontend/src/` sang `packages/web/src/`** — phải rewrite sạch theo packages/web patterns với coreApiAdapter.
6. **Không bỏ qua i18n** cho text mới trên UI — phải qua tiếng Việt đầy đủ dấu.

### 5.6 Config ownership

1. `global_signal_policy_helpers.py` tiếp tục là SSOT cho detection universe và whale/dark-flow policy trong thời gian legacy vẫn chạy.
2. `runtime_policy_helpers.py` và `RuntimeVnbrokerConfig` tiếp tục là SSOT cho ingest cadence và provider config.
3. Core không được tạo parallel writer cho các domain này cho đến khi Phase 3 migration hoàn thành.

### 5.7 Evidence obligation

Mọi slice phải có đủ evidence theo `docs/SAAS_MIGRATION_EXECUTION_EVIDENCE_TEMPLATE_20260504.md` trước khi được đánh dấu `DONE` trên taskboard. Không có exception.

---

## 6. Sơ đồ architecture end-state

```
Internet Traffic
      │
      ▼
[Nginx SSL Termination]
      │
      ├─ /core/v1/*  ──► [core-api: gunicorn 4 workers]
      │                         │
      │                    [core-db: postgres 16]
      │                    [core-redis: redis 7]
      │                         │
      │                   [core-worker] ←─── [core-beat]
      │
      └─ /static/*  ──► [web: nginx packages/web/dist/]

[pgbouncer] ─── manages connection pool to core-db
[prometheus] ── scrapes metrics from all services
[grafana] ────── dashboards from prometheus
[sentry] ─────── error tracking from core-api + core-worker
```

---

## 7. Phase overview và dependencies

| Phase | Tên | Prerequisite | Critical path |
|---|---|---|---|
| **Phase 0** | Fix immediate blockers | Không có | YES — unblocks tất cả |
| **Phase 1** | Security hardening | Phase 0 complete | YES — required trước production |
| **Phase 2** | SaaS data plane live | Phase 0 + Phase 1 | YES — required trước Phase 3 |
| **Phase 3** | Business logic migration | Phase 2 complete | YES — longest phase |
| **Phase 4** | Frontend cutover | Phase 3 domains done | PARALLEL với Phase 3 |
| **Phase 5** | Infra hardening | Phase 2 | PARALLEL với Phase 3-4 |
| **Phase 6** | Legacy decommission | Phase 3+4+5 ALL complete | FINAL GATE |
| **Phase 7** | Post-production | Phase 6 complete | Ongoing |

---

## 8. Owner matrix tổng thể

| Vai trò | Trách nhiệm | Phase chính |
|---|---|---|
| **Tech Lead** | Architecture decisions, phase gates, final audit | Tất cả phases |
| **Backend Lead** | Phase 0, 1, 2, 3 (domain migrations), Phase 6 cleanup | Phase 0-3, 6 |
| **Backend Dev** | Phase 3 individual domain slices, Phase 5 ops tasks | Phase 3, 5 |
| **Frontend Lead** | Phase 4 frontend cutover, packages/web patterns | Phase 4 |
| **Frontend Dev** | Individual page migrations | Phase 4 |
| **DevOps** | Phase 5 infra hardening, CI/CD, monitoring, backup | Phase 5, 6 |
| **QA Lead** | Integration tests, parity verification, performance gates | Phase 2-6 |

---

## 9. Quy tắc vận hành cho team

1. **Slice nhỏ, focused**: mỗi PR không được chạm quá 2 domain cùng lúc.
2. **Validation ngay sau edit đầu tiên**: không để qua ngày mà chưa chạy test suite.
3. **Evidence bắt buộc trước DONE**: không đánh dấu task xong nếu chưa có evidence theo template.
4. **Sync docs sau mỗi slice**: `docs/CODE_CHANGE_AUDIT_LEDGER.md` và `PROGRESS_DASHBOARD.md` phải update ngay.
5. **Shadow run nghiêm túc**: Celery task migration phải shadow ít nhất 3 ngày trade, không rút ngắn.
6. **Pre-decommission gates là hard stop**: mọi thành viên team đều phải sign off trên 7 gates trước Phase 6.
7. **Không tự ý mở rộng scope**: nếu phát hiện vấn đề ngoài scope slice hiện tại, ghi issue và tiếp tục slice đang làm, không tự ý fix thêm.
8. **Mandatory Docker Rebuild**: Sau mỗi lần sửa code, bắt buộc chạy lệnh build/update docker dev (ví dụ: `docker compose -f ./docker-compose.dev.yml up -d --build frontend backend`) để đảm bảo code mới được cập nhật; nếu không hệ thống sẽ vẫn chạy code cũ.

---

## 10. Điều kiện đủ để khai báo chương trình COMPLETE

1. Tất cả 7 pre-decommission gates đã pass và được ký bởi Tech Lead.
2. Legacy containers đã tắt ít nhất 72 giờ mà không có incident.
3. `backend/` và `frontend/` đã xoá khỏi main branch.
4. Sentry không có unhandled exception mới từ core code trong 72 giờ.
5. Grafana API p95 latency < 200ms trong 24 giờ liên tiếp.
6. `module_tree_full.md` đã regenerate phản ánh cấu trúc mới.
7. `docs/CODE_CHANGE_AUDIT_LEDGER.md` đã cập nhật đầy đủ tất cả slices.
8. `PROGRESS_DASHBOARD.md` đã cập nhật trạng thái COMPLETE.

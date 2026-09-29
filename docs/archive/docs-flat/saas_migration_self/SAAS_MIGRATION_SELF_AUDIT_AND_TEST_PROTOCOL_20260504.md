# SELF-AUDIT AND TEST PROTOCOL — SaaS Production Migration & Legacy Monolith Decommission

**Ngày**: 2026-05-04

---

## 1. Mục đích

Protocol này là checklist bắt buộc cho đội code và QA nội bộ sau mỗi slice của chương trình SaaS Migration.

Mục tiêu là chặn sớm các nhóm lỗi nguy hiểm nhất:

1. Materializer query sai bảng, data không chảy vào core.
2. Security fix áp dụng không đúng — PAT hash đổi nhưng không rotate, JWT blacklist thiếu migration.
3. Source code mount vẫn còn trong prod compose dù có Dockerfile.
4. Shadow run bị bỏ qua, task migration cutover thiếu parity evidence.
5. Data migration parity < 99% nhưng vẫn mark done.
6. Frontend page dùng legacy fetch/axios trực tiếp thay vì coreApiAdapter.
7. Text mới không qua i18n tiếng Việt.
8. Pre-decommission gates bị bỏ qua hoặc self-signed không có evidence.
9. Backup chưa có restore test trước khi decommission.
10. module_tree_full.md chưa regenerate sau thay đổi cấu trúc lớn.

---

## 2. Nguyên tắc vận hành

1. Không có evidence thì xem như chưa làm.
2. Không có focused validation ngay sau edit đầu tiên thì slice chưa pass.
3. UI/runtime slice phải refresh stack trước evidence final.
4. Docs-only slice phải có cross-reference review và sync ledger/progress.
5. Shadow run slice phải có log cover >= 3 ngày trade thật.
6. Decommission slice phải có Tech Lead sign-off — không self-approve.

---

## 3. Workflow audit bắt buộc cho mỗi slice

### Bước 1 — Khóa phạm vi slice

Ghi rõ trước khi code:

1. **Slice ID**: (ví dụ: SM-P0.1)
2. **Req IDs liên quan**: từ Traceability Matrix
3. **Files thực tế sẽ chạm**: liệt kê explicit
4. **Loại slice**: backend-infra / backend-domain / frontend / data-migration / shadow-run / decommission / docs-only
5. **Owner**: người chịu trách nhiệm evidence
6. **Scope boundary**: ghi rõ những gì KHÔNG làm trong slice này

Nếu slice chạm nhiều hơn 2 domain, **phải tách** trước khi bắt đầu.

---

### Bước 2 — Focused validation ngay sau slice

#### A. Backend-infra slice (Phase 0, 1, 2, 5)

Chạy tối thiểu:

```bash
# 1. Cấu trúc và syntax
cd backend  # hoặc packages/core/backend
../.venv/Scripts/python.exe manage.py check

# 2. Test suite liên quan slice
../.venv/Scripts/python.exe manage.py test <app>.tests.<test_module> --keepdb -v 2

# 3. Docker build (nếu slice chạm Dockerfile)
docker build -t vninvest-test packages/core/backend/

# 4. Container check
docker run --rm vninvest-test python manage.py check --deploy
```

Checklist:
- [ ] `manage.py check` PASS không warnings
- [ ] Focused test suite PASS
- [ ] Docker build thành công nếu Dockerfile thay đổi
- [ ] Container startup không crash loop

---

#### B. Security slice (Phase 1)

Tất cả security slices phải có **regression test mới** chứng minh fix đúng.

```bash
# JWT blacklist
curl -X POST /api/token/refresh/ -d '{"refresh": "<old_token>"}' \
  → Expected: 401 {"detail": "Token is blacklisted"}

# PAT HMAC
python -c "
from portfolio.models import _hash_pat_secret
h1 = _hash_pat_secret('test-secret')
print('Has pepper:', 'hmac' in _hash_pat_secret.__code__.co_names or True)
# Verify: không phải sha256(secret) thuần
import hashlib
plain = hashlib.sha256('test-secret'.encode()).hexdigest()
assert h1 != plain, 'FAIL: Still using plain SHA-256'
print('PASS: Hash is not plain SHA-256')
"

# ALLOWED_HOSTS
docker run --rm -e DEBUG=0 -e DJANGO_SECRET_KEY=x vninvest-core-api:test \
  python -c "import django; django.setup()" 2>&1 | grep -i "ALLOWED_HOSTS\|ImproperlyConfigured"
```

Checklist:
- [ ] Regression test mới EXISTS và PASS
- [ ] Không có test chỉ verify format mà không verify behavior thật
- [ ] Secret vars không xuất hiện trong test output

---

#### C. Data migration slice (Phase 3)

```bash
# Dry run trước
python manage.py migrate_<domain>_from_legacy --dry-run

# Execute
python manage.py migrate_<domain>_from_legacy --execute

# Verify parity
python manage.py migrate_<domain>_from_legacy --verify-parity
# Expected output: Parity: XX.X% (N/M) where XX.X >= 99.0
```

Checklist:
- [ ] `--dry-run` chạy không lỗi
- [ ] `--execute` chạy không lỗi, ghi log mỗi batch
- [ ] Parity >= 99.0%
- [ ] Sample records verify manually (10 records random)
- [ ] `event_id` hoặc primary key preserved (không generate mới)

---

#### D. Shadow run slice (Phase 3 Celery tasks)

```bash
# Kiểm tra shadow task đang chạy
docker compose exec core-worker \
  celery -A vninvest_core inspect active

# Kiểm tra parity logs (3 ngày liên tiếp)
docker compose logs core-worker --since=72h | grep "SHADOW_PARITY" | \
  python -c "
import sys, json
lines = [json.loads(l.split('SHADOW_PARITY')[1]) for l in sys.stdin if 'SHADOW_PARITY' in l]
parity = [l['parity_pct'] for l in lines]
min_p = min(parity) if parity else 0
avg_p = sum(parity) / len(parity) if parity else 0
print(f'Count: {len(parity)}, Min: {min_p:.1f}%, Avg: {avg_p:.1f}%')
assert avg_p >= 99.0, f'FAIL: Average parity {avg_p:.1f}% below 99%'
print('PASS: Shadow parity OK')
"
```

Checklist:
- [ ] Shadow log tồn tại cho ít nhất 3 ngày trade thật
- [ ] Average parity >= 99.0%
- [ ] Không có log kỳ lạ (NaN, negative, 0%)
- [ ] Không có lỗi timeout hoặc dedup collision

---

#### E. Frontend migration slice (Phase 4)

```bash
# Build frontend
cd packages/web
npm run build
# Phải thành công, 0 errors

# Verify không dùng fetch/axios trực tiếp
grep -r "fetch\|axios" src/pages/ --include="*.jsx" | \
  grep -v "coreApiAdapter\|import"
# Phải không có kết quả (tất cả calls qua adapter)

# Verify i18n
grep -r "text\|label\|title\|placeholder" src/pages/ --include="*.jsx" | \
  grep -v "t(" | grep -v "i18n" | grep -v "//\|import"
# Các string hardcoded tiếng Việt phải minimal/none
```

Checklist:
- [ ] `npm run build` PASS, 0 errors
- [ ] Không có direct fetch/axios calls ngoài coreApiAdapter
- [ ] Text tiếng Việt đều qua i18n function `t()`
- [ ] Page accessible tại route đúng
- [ ] Không có console errors khi mở trang

---

#### F. Infra slice (Phase 5)

```bash
# PgBouncer
docker compose exec pgbouncer psql -p 6432 pgbouncer -c "SHOW POOLS;" 2>&1

# Prometheus targets
curl -s http://localhost:9090/api/v1/targets | python -m json.tool | grep "state"
# Tất cả phải "up"

# Grafana
curl -sf http://localhost:3000/api/health
# {"database":"ok","version":"x.x.x"}

# Backup task
docker compose exec core-worker \
  celery -A vninvest_core call ops_audit.daily_db_backup
# Verify file tồn tại sau 5 phút
```

Checklist:
- [ ] Tất cả Prometheus targets UP
- [ ] Grafana accessible và hiển thị đúng metrics
- [ ] PgBouncer SHOW POOLS có active connections
- [ ] Backup task chạy không lỗi

---

#### G. Decommission slice (Phase 6)

**KHÔNG tự approve.** Tech Lead phải review mỗi bước.

```bash
# Gate A — data parity
python scripts/verify_migration_parity.py --domain=all --sample-size=1000
# Expected: All domains >= 99.0%

# Gate C — nginx traffic
grep "backend:8000" /var/log/nginx/access.log | wc -l
# Expected: 0

# Gate G — Celery queue drain
docker compose exec core-redis redis-cli keys "celery*" | wc -l
# Expected: 0 hoặc chỉ có core tasks
```

Checklist:
- [ ] Tất cả 7 gates pass và được document
- [ ] Tech Lead sign-off trước khi `git rm`
- [ ] Archive tag tồn tại trước khi xoá code
- [ ] 24h monitoring sau mỗi decommission step

---

### Bước 3 — Runtime refresh nếu slice chạm UI/runtime

Sau khi code changes:

```bash
# Rebuild và restart containers bị ảnh hưởng
docker compose -f docker-compose.dev.yml up -d --build <service-name>

# Verify service health
docker compose ps
docker compose logs <service-name> --tail=20
```

---

### Bước 4 — Thu bằng chứng

Bắt buộc lưu vào evidence file theo template `SAAS_MIGRATION_EXECUTION_EVIDENCE_TEMPLATE_20260504.md`:

1. Command đã chạy và PASS/FAIL với output
2. Payload snapshot nếu slice chạm API contract
3. Screenshot/video nếu slice là UI
4. Performance snapshot nếu slice chạm route load path
5. Parity report nếu slice là data migration hoặc shadow run
6. Residual risk note
7. Danh sách file đổi thực tế

---

### Bước 5 — Đồng bộ audit docs

Sau mỗi slice PASS:

```bash
# Cập nhật CODE_CHANGE_AUDIT_LEDGER.md
# Format:
# | 2026-05-04 | SM-P0.1 | Fix materializer SQL | materializers.py | PASS | <link-to-evidence> |

# Cập nhật PROGRESS_DASHBOARD.md
# Mark task done, ghi ngày và owner
```

Checklist:
- [ ] `docs/CODE_CHANGE_AUDIT_LEDGER.md` đã có row mới
- [ ] `PROGRESS_DASHBOARD.md` đã update status
- [ ] Evidence file đã tạo với đầy đủ fields

---

## 4. Phase-specific checklist nhanh

### Phase 0 checklist

- [ ] `materialize_symbol_snapshot` → `upserted > 0`
- [ ] `materialize_session_facts` → `upserted > 0`
- [ ] API `/core/v1/market/symbol-snapshot/` không rỗng
- [ ] `CONN_MAX_AGE` set trong legacy settings
- [ ] Dockerfile build thành công
- [ ] Prod compose không còn source mount
- [ ] Entrypoint.sh tồn tại và chạy migrate trước start

### Phase 1 checklist

- [ ] Dùng refresh token cũ sau rotation → 401
- [ ] PAT hash không phải SHA-256 thuần
- [ ] `rotate_all_pat_tokens` command tested trên staging
- [ ] Core API không start khi thiếu ALLOWED_HOSTS trong production mode
- [ ] Core API không start khi thiếu CORS_ALLOWED_ORIGINS trong production mode
- [ ] `docker compose config` fail khi thiếu secret env vars
- [ ] Email credential decrypt không depend on SECRET_KEY

### Phase 2 checklist

- [ ] `vninvest_core` DB tồn tại và migrations applied
- [ ] Write to legacy DB từ core container → RuntimeError
- [ ] `celery inspect active` trả real worker info
- [ ] Beat log có "Sending due task" entries
- [ ] data_ingest task trigger thủ công thành công

### Phase 3 checklist (mỗi domain)

- [ ] Model migration apply thành công
- [ ] API endpoint trả data hợp lệ
- [ ] Data migration parity >= 99%
- [ ] Shadow run log >= 3 ngày trade
- [ ] Shadow parity >= 99% trong 3 ngày liên tiếp
- [ ] Cutover: legacy task disabled, core task active
- [ ] 48h post-cutover monitoring không incident

### Phase 4 checklist (mỗi page)

- [ ] `npm run build` PASS
- [ ] Không có direct API calls ngoài coreApiAdapter
- [ ] i18n coverage: text tiếng Việt qua `t()`
- [ ] Page render đúng tại route
- [ ] Data hiển thị từ core API
- [ ] Không có console errors

### Phase 5 checklist

- [ ] Load test 500 VUs PASS, p95 < 200ms
- [ ] Tất cả Prometheus targets UP
- [ ] Grafana 4 dashboards functional
- [ ] Sentry test exception captured
- [ ] CI/CD pipeline run on test PR PASS
- [ ] Backup task verified với restore test
- [ ] IntradayTick partitions exist

### Phase 6 checklist

- [ ] Gate A: parity >= 99% (all domains)
- [ ] Gate B: all API endpoints covered
- [ ] Gate C: 0 traffic to legacy (nginx log)
- [ ] Gate D: 0 Sentry critical in 72h
- [ ] Gate E: backup restore PASS
- [ ] Gate F: p95 < 200ms at 500 VUs
- [ ] Gate G: 0 legacy tasks in queue
- [ ] Tech Lead sign-off
- [ ] 24h+ monitoring after each step
- [ ] Archive tag before code deletion

---

## 5. Anti-patterns bị cấm

| Anti-pattern | Tại sao cấm | Thay thế đúng |
|---|---|---|
| Tự approve decommission gate | Conflict of interest, bias | Tech Lead review bắt buộc |
| Bỏ qua shadow run vì "code tương tự" | Môi trường khác nhau = behavior khác | Shadow run luôn |
| Parity check chỉ trên sample nhỏ | Có thể miss edge cases | Minimum 1000 records random sample |
| Mark DONE trước khi có evidence | Gaming metrics | Evidence-first discipline |
| Fix scope creep trong slice | Tạo ẩn số mới | Ghi issue mới, slice hiện tại không đổi |
| Deploy production khi test chưa PASS | Obvious | Test gate là hard blocker |
| Copy-paste từ frontend/ sang packages/web | Kéo legacy patterns | Rewrite sạch |
| i18n hardcode tiếng Việt vào JSX | Không maintainable | `t('key')` từ i18n file |
| Ghi vào legacy DB từ core container | Vi phạm DB separation | CoreRouter sẽ block, không workaround |
| Multiple shadow tasks cùng queue | Dedup collision | Separate queue hoặc explicit dedup key |

# RUN CODE REVIEW — SaaS Production Migration & Legacy Monolith Decommission

**Ngày**: 2026-05-04  
**Mục tiêu**: Protocol cho AI Agent hoặc Tech Lead review từng slice của SaaS Migration.

---

## 1. Bootstrap — Đọc trước khi review

Đọc các file sau theo thứ tự trước khi chạy bất kỳ review nào:

```
1. quality/QUALITY.md
2. docs/SAAS_MIGRATION_HANDOFF_MASTER_20260504.md
3. docs/TECH_SPEC_SAAS_MIGRATION_20260504.md
4. docs/IMPLEMENTATION_PLAN_SAAS_MIGRATION_20260504.md
5. docs/TASKBOARD_SAAS_MIGRATION_20260504.md
6. docs/SAAS_MIGRATION_TRACEABILITY_MATRIX_20260504.md
7. docs/SAAS_MIGRATION_CONFIG_OWNERSHIP_MATRIX_20260504.md
8. docs/SAAS_MIGRATION_CODE_QUALITY_CONSTITUTION_20260504.md
9. docs/SAAS_MIGRATION_SELF_AUDIT_AND_TEST_PROTOCOL_20260504.md
```

Sau đó mới đọc code trong PR được review.

**Guardrail quan trọng**:
- Đọc hết body của function/class, không chỉ đọc signature.
- Grep codebase để verify claims trước khi kết luận.
- Trích dẫn line number cụ thể trong mọi comment.
- Nếu không chắc về một pattern, kiểm tra file liên quan trước khi flag.

---

## 2. Pre-review checklist tự động

Trước khi review code, verify:

```bash
# 1. Scope check — PR có vượt scope slice không?
git diff --name-only origin/dev...HEAD | sort > /tmp/actual_files.txt
cat docs/evidence/SM-<SLICE_ID>-*.md | grep -A 20 "File.*thay đổi" > /tmp/declared_files.txt
diff /tmp/actual_files.txt /tmp/declared_files.txt
# Expected: no unexpected files

# 2. Build check
# Frontend
cd packages/web && npm run build

# Backend
cd packages/core/backend && ../.venv/Scripts/python.exe manage.py check

# 3. Tests exist for new code
# Verify: không có new non-trivial function/class không có test
git diff origin/dev...HEAD --stat | grep "\.py$" | grep -v test
# Liệt kê file .py mới. Với mỗi file → verify có test tương ứng.
```

---

## 3. Focus areas per phase

### Phase 0 — Materializer & Infrastructure baseline

#### 3.0.1 SQL correctness

```bash
# Verify: query đúng bảng
grep -n "portfolio_tickersessionclose\|tickersessionclose" \
    packages/core/backend/src/market_serving/materializers.py

# Verify: KHÔNG còn query bảng sai
grep -n "portfolio_symbolsnapshot\|SymbolSnapshot.*portfolio" \
    packages/core/backend/src/market_serving/materializers.py
# Expected: 0 kết quả
```

Checklist:
- [ ] `materialize_symbol_snapshot` đọc từ `portfolio_tickersessionclose`
- [ ] `materialize_session_facts` extract từ `portfolio_advisoryaggregatesnapshot.state_json`
- [ ] `materialize_unified_alerts` đọc từ `portfolio_whalealertevent`
- [ ] Mỗi upsert có `update_conflicts=True` và đúng `unique_fields`
- [ ] Không có plain `INSERT` có thể gây duplicate

#### 3.0.2 Connection pooling

```bash
grep -n "CONN_MAX_AGE" backend/config/settings.py
# Expected: CONN_MAX_AGE = int(os.environ.get('CONN_MAX_AGE', '60'))
```

#### 3.0.3 Production container

```bash
# Verify: không có source mount trong prod compose
grep -n "volumes\|source\|./backend\|./packages" docker-compose.prod.yml
# Expected: không có source code mount, chỉ data volumes
```

---

### Phase 1 — Security hardening

#### 3.1.1 JWT Blacklist

```bash
grep -n "BLACKLIST_AFTER_ROTATION\|ROTATE_REFRESH_TOKENS\|token_blacklist" \
    backend/config/settings.py

# Verify: JWT settings đúng
python -c "
import ast, sys
code = open('backend/config/settings.py').read()
tree = ast.parse(code)
# Scan for SIMPLE_JWT dict assignments
for node in ast.walk(tree):
    if isinstance(node, ast.Assign):
        for target in node.targets:
            if isinstance(target, ast.Name) and target.id == 'SIMPLE_JWT':
                print(ast.dump(node.value))
"
```

Checklist:
- [ ] `BLACKLIST_AFTER_ROTATION = True`
- [ ] `ROTATE_REFRESH_TOKENS = True`
- [ ] `rest_framework_simplejwt.token_blacklist` trong `INSTALLED_APPS`
- [ ] Migration cho `token_blacklist` đã được tạo và apply
- [ ] Test: 401 khi dùng refresh token sau rotation

#### 3.1.2 PAT HMAC

```bash
# Find _hash_pat_secret function
grep -rn "_hash_pat_secret\|hash_pat\|pat_hash" \
    backend/ packages/core/backend/src/ --include="*.py"

# Read and verify HMAC usage
grep -A 15 "def _hash_pat_secret" backend/portfolio/models.py
```

Checklist:
- [ ] Dùng `hmac.new(pepper, secret, sha256)` — KHÔNG phải `hashlib.sha256(secret)`
- [ ] `pepper` từ env var `CORE_PAT_PEPPER` — KHÔNG hardcoded
- [ ] Fallback khi pepper không set → explicit error, không silent degradation
- [ ] `hmac.compare_digest()` cho token comparison — không `==`
- [ ] `rotate_all_pat_tokens` management command tồn tại

#### 3.1.3 ALLOWED_HOSTS và CORS

```bash
grep -n "ALLOWED_HOSTS\|CORS_ALLOW" \
    packages/core/backend/src/vninvest_core/settings.py

# Verify: không còn wildcard
python -c "
import ast
code = open('packages/core/backend/src/vninvest_core/settings.py').read()
assert \"'*'\" not in code or 'DEBUG' in code, 'FAIL: Wildcard in settings'
print('PASS: No unconditional wildcard')
"
```

Checklist:
- [ ] `ALLOWED_HOSTS` không phải `['*']` unconditionally
- [ ] Raise `ImproperlyConfigured` khi thiếu env var trong production
- [ ] `CORS_ALLOW_ALL_ORIGINS` không `= DEBUG` (có thể vẫn True trong dev khi DEBUG=True nhưng production False phải explicit)
- [ ] Test: container exit với clear error khi thiếu config

#### 3.1.4 Secrets trong compose

```bash
grep -n ":?}" docker-compose.prod.yml | wc -l
# Phải cover tất cả secret variables

grep -n "insecure\|default_password\|change_me\|example_key" docker-compose.prod.yml
# Expected: 0 kết quả
```

---

### Phase 2 — Core infrastructure activation

#### 3.2.1 DB Router isolation

```bash
# Find and read CoreRouter
grep -rn "class CoreRouter\|DATABASE_ROUTERS" \
    packages/core/backend/src/ --include="*.py"
```

Checklist:
- [ ] `allow_migrate()` trả False cho legacy app_label
- [ ] `db_for_write()` raise RuntimeError khi route là 'legacy' từ core containers
- [ ] `db_for_read()` trả 'legacy' chỉ cho explicit `using='legacy')` queries
- [ ] Test coverage cho router block behavior tồn tại

#### 3.2.2 Real Celery workers

```bash
grep -n "command:" docker-compose.prod.yml | grep -A 2 "core-worker\|core-beat"
# Verify: không phải stub command
```

Checklist:
- [ ] `core-worker` dùng real `celery -A vninvest_core worker` command
- [ ] `core-beat` dùng real `celery -A vninvest_core beat` command
- [ ] Không có `tail -f /dev/null` hoặc stub commands

---

### Phase 3 — Domain migration

#### 3.3.1 Domain model review

Cho mỗi domain migration slice, verify:

```bash
# Verify model field types
grep -n "FloatField\|CharField.*max_length=50.*symbol" \
    packages/core/backend/src/<domain>/models.py
# Expected: 0 (symbol phải max_length=12, giá phải DecimalField/BigIntegerField)

# Verify explicit db_table
grep -n "db_table" packages/core/backend/src/<domain>/models.py
# Phải có db_table cho mỗi model
```

Checklist:
- [ ] `event_id` / primary key preserved từ legacy data (không generate mới)
- [ ] Unique constraints đúng spec
- [ ] Indexes cho query patterns thường gặp
- [ ] Data migration command có `--dry-run` mode

#### 3.3.2 Shadow task review

```bash
grep -rn "SHADOW_PARITY\|shadow_parity\|log_shadow" \
    packages/core/backend/src/ --include="*.py"
```

Checklist:
- [ ] Shadow task tên khác legacy task (không conflict)
- [ ] Shadow task ở queue khác (ví dụ: `core-shadow`)
- [ ] `log_shadow_parity()` được gọi sau mỗi compare
- [ ] Shadow task KHÔNG ghi vào legacy tables
- [ ] Parity log có format parseable để auto-analyze

---

### Phase 4 — Frontend migration

#### 3.4.1 coreApiAdapter usage

```bash
# Verify: không có direct fetch/axios calls trong packages/web pages
grep -rn "fetch\|axios\." \
    packages/web/src/pages/ --include="*.jsx" \
    | grep -v "coreApiAdapter\|import\|adapter\|//\|*"

# Phải empty hoặc chỉ thấy trong coreApiAdapter itself
```

Checklist:
- [ ] Tất cả API calls qua `coreApiAdapter.js`
- [ ] Không có hardcoded API URLs trong components
- [ ] Error states được handle (không crash khi API fail)

#### 3.4.2 i18n coverage

```bash
# Find hardcoded Vietnamese strings
grep -rn "=['\"].*[àáảãạ]" \
    packages/web/src/pages/ --include="*.jsx" \
    | grep -v "i18n\|t(\|//\|import"

# Phải empty
```

Checklist:
- [ ] Tất cả Vietnamese text qua `t()`
- [ ] i18n key tồn tại trong locale files
- [ ] Không có string dùng dấu không đầy đủ (ví dụ: `Canh bao` thay vì `Cảnh báo`)

---

### Phase 5 — Infrastructure hardening

#### 3.5.1 PgBouncer config

```bash
cat infra/pgbouncer/pgbouncer.ini | grep "max_client_conn\|pool_size\|pool_mode"
# Expected: max_client_conn=500, pool_size=20, pool_mode=transaction
```

#### 3.5.2 CI/CD pipeline

```bash
# Verify: test gate trước deploy
cat .github/workflows/deploy.yml | grep -A 5 "run: pytest\|run: npm test"
# Phải có test step trước deploy step
```

---

### Phase 6 — Decommission

#### 3.6.1 Pre-decommission gate evidence

```bash
# Verify: evidence files tồn tại cho tất cả gates
ls docs/evidence/ | grep "SM-P6\|gate-"
```

Checklist:
- [ ] Gate A-G tất cả có evidence files
- [ ] Tech Lead sign-off documented
- [ ] Archive tag tồn tại: `git tag | grep "pre-decommission"`
- [ ] Code removal không có dangling imports

---

## 4. Cross-cutting concerns

### 4.1 Response envelope `source` field

```bash
# Verify: tất cả response serializers có meta.source field
grep -rn "\"source\"\|'source'" \
    packages/core/backend/src/ --include="serializers.py"

# Verify: source value hợp lệ
grep -rn "facts-first\|materializer\|cache-hit\|legacy-fallback" \
    packages/core/backend/src/ --include="*.py" | wc -l
# Phải > 0 — có ít nhất một nơi set source value
```

### 4.2 module_tree_full.md currency

```bash
# Verify: module_tree không còn reference đến deleted modules
# Sau Phase 3+ completion
python -c "
with open('module_tree_full.md') as f:
    content = f.read()
# Nếu backend/ đang được decommission:
if 'backend/portfolio' in content:
    print('WARN: module_tree still references legacy backend — regenerate required')
"
```

### 4.3 No legacy patterns in core codebase

```bash
# Verify: không import từ backend/ trong packages/core/
grep -rn "from backend\.\|import backend\." \
    packages/core/backend/src/ --include="*.py"
# Expected: 0 kết quả

# Verify: không dùng vnbroker trực tiếp trong core (phải qua adapter)
grep -rn "from vnbroker import\|import vnbroker" \
    packages/core/backend/src/ --include="*.py" \
    | grep -v "adapters\|vnbroker_adapter"
# Expected: 0 kết quả
```

---

## 5. Review output format

Mỗi review phải output theo format:

```markdown
## Code Review — SM-<SLICE_ID> — <date>

### Summary

- Files reviewed: N
- Critical issues: N
- High issues: N
- Medium issues: N
- Low issues: N
- Overall: PASS / FAIL / PASS WITH CONDITIONS

### Issues

#### CRITICAL: <issue title>
- File: path/to/file.py, Line: N
- Evidence: (quoted code)
- Rule violated: (từ Code Quality Constitution)
- Required fix: (cụ thể)

#### HIGH: <issue title>
...

### Passing items

- [X] SQL queries use parameterized form — Line 45, 67, 89
- [X] HMAC comparison at Line 123
- ...

### Approval

- [ ] Approved as-is
- [ ] Approved pending fixes (list issues)
- [ ] Rejected — must rework
```

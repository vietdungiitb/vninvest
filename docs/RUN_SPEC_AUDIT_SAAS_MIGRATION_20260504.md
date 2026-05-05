# RUN SPEC AUDIT — SaaS Production Migration & Legacy Monolith Decommission

**Ngày**: 2026-05-04  
**Mục tiêu**: Multi-model spec audit (Council of Three) để kiểm tra alignment giữa spec, implementation, và evidence.

---

## 1. Mục đích

Spec audit là bước cuối cùng trước khi mark phase COMPLETE. Không phải code review (đó là `RUN_CODE_REVIEW`) mà là kiểm tra sự nhất quán giữa tài liệu, code, và bằng chứng.

**Ba model trong Council of Three**:
- **Model 1** (Spec Auditor): Đọc Tech Spec + Implementation Plan, kiểm tra code có đúng spec không.
- **Model 2** (Coverage Auditor): Đọc Taskboard + Traceability Matrix, kiểm tra mọi requirement có task và evidence.
- **Model 3** (Integration Auditor): Cross-check tất cả để tìm gaps và inconsistencies.

---

## 2. Bootstrap files

Đọc theo thứ tự trước khi chạy spec audit:

```
1. docs/SAAS_MIGRATION_HANDOFF_MASTER_20260504.md
2. docs/TECH_SPEC_SAAS_MIGRATION_20260504.md
3. docs/IMPLEMENTATION_PLAN_SAAS_MIGRATION_20260504.md
4. docs/TASKBOARD_SAAS_MIGRATION_20260504.md
5. docs/SAAS_MIGRATION_TRACEABILITY_MATRIX_20260504.md
6. docs/SAAS_MIGRATION_CONFIG_OWNERSHIP_MATRIX_20260504.md
7. docs/SAAS_MIGRATION_CODE_QUALITY_CONSTITUTION_20260504.md
8. docs/SAAS_MIGRATION_SELF_AUDIT_AND_TEST_PROTOCOL_20260504.md
```

---

## 3. Model 1 — Spec Auditor

**Câu hỏi Model 1 phải trả lời**:

> "Code hiện tại có implement đúng những gì Tech Spec và Implementation Plan mô tả không?"

### 3.1 Checklist Model 1

#### Phase 0 — Materializer

```bash
# Q1: materialize_symbol_snapshot đọc từ bảng đúng?
grep -n "FROM.*portfolio_tickersessionclose\|portfolio_tickersessionclose" \
    packages/core/backend/src/market_serving/materializers.py

# Expected: có ít nhất 1 match
```

| Spec requirement | File | Line | Status |
|---|---|---|---|
| `materialize_symbol_snapshot` reads `portfolio_tickersessionclose` | materializers.py | ? | PASS/FAIL |
| `materialize_session_facts` extracts from `state_json` JSONB | materializers.py | ? | PASS/FAIL |
| `materialize_unified_alerts` reads `portfolio_whalealertevent` | materializers.py | ? | PASS/FAIL |
| Upsert with `update_conflicts=True` | materializers.py | ? | PASS/FAIL |
| `CONN_MAX_AGE >= 60` | backend/config/settings.py | ? | PASS/FAIL |
| No source mount in prod compose | docker-compose.prod.yml | ? | PASS/FAIL |

#### Phase 1 — Security

| Spec requirement | File | Line | Status |
|---|---|---|---|
| `BLACKLIST_AFTER_ROTATION = True` | backend/config/settings.py | ? | PASS/FAIL |
| `ROTATE_REFRESH_TOKENS = True` | backend/config/settings.py | ? | PASS/FAIL |
| `token_blacklist` in INSTALLED_APPS | backend/config/settings.py | ? | PASS/FAIL |
| `_hash_pat_secret` uses HMAC with pepper | portfolio/models.py | ? | PASS/FAIL |
| ALLOWED_HOSTS raises without env var | vninvest_core/settings.py | ? | PASS/FAIL |
| CORS not wildcard in production | vninvest_core/settings.py | ? | PASS/FAIL |
| All compose secrets use `${VAR:?}` | docker-compose.prod.yml | ? | PASS/FAIL |

#### Phase 2 — Core infrastructure

| Spec requirement | File | Line | Status |
|---|---|---|---|
| `CoreRouter.db_for_write()` raises for legacy models | vninvest_core/routers.py | ? | PASS/FAIL |
| `DATABASE_ROUTERS = ['CoreRouter']` | vninvest_core/settings.py | ? | PASS/FAIL |
| Redis namespaces: core uses db=3,4,5 | vninvest_core/settings.py | ? | PASS/FAIL |
| Celery queue = 'core' (not 'celery') | vninvest_core/celery.py | ? | PASS/FAIL |
| `core-worker` real celery command | docker-compose.prod.yml | ? | PASS/FAIL |

#### Phase 3 — Domain models

For each domain, verify field types match Tech Spec mục 6:

```bash
# Check field types for UnifiedAlert
grep -A 30 "class UnifiedAlert" \
    packages/core/backend/src/signal_intelligence/models.py
```

| Model | Field | Spec type | Actual type | Status |
|---|---|---|---|---|
| `UnifiedAlert` | `event_id` | `CharField(max_length=64, unique=True)` | ? | PASS/FAIL |
| `UnifiedAlert` | `symbol` | `CharField(max_length=12)` | ? | PASS/FAIL |
| `SymbolSnapshot` | `last_price` | `DecimalField(18,2)` | ? | PASS/FAIL |
| `UserProfile` | `user` | `OneToOneField(CoreUser)` | ? | PASS/FAIL |
| `Subscription` | `plan` | `CharField(max_length=20, choices=PlanChoices)` | ? | PASS/FAIL |

#### Phase 4 — Frontend

| Spec requirement | Verification | Status |
|---|---|---|
| coreApiAdapter is single API caller | `grep -r "fetch\|axios" packages/web/src/pages` | PASS/FAIL |
| All text through i18n | `grep -r "t('" packages/web/src/pages` exists | PASS/FAIL |
| Envelope has `meta.source` | API response snapshot | PASS/FAIL |

#### Phase 5 — Infra

| Spec requirement | Verification | Status |
|---|---|---|
| PgBouncer max_client_conn=500 | `cat infra/pgbouncer/pgbouncer.ini` | PASS/FAIL |
| Prometheus 4 dashboards | Grafana dashboard count | PASS/FAIL |
| CI test gate before deploy | `.github/workflows/deploy.yml` has test step | PASS/FAIL |

---

## 4. Model 2 — Coverage Auditor

**Câu hỏi Model 2 phải trả lời**:

> "Mọi Req ID có task? Mọi task có evidence? Mọi shadow run có >= 3 ngày?"

### 4.1 Req ID coverage check

```bash
# Tất cả SM-REQ-01..34 và GOV-01..04 phải có task ID
python scripts/verify_req_coverage.py
```

**Script**:
```python
# scripts/verify_req_coverage.py
import re

REQUIRED_REQS = [f'SM-REQ-{i:02d}' for i in range(1, 35)] + \
                [f'GOV-0{i}' for i in range(1, 5)]

# Read traceability matrix
with open('docs/SAAS_MIGRATION_TRACEABILITY_MATRIX_20260504.md') as f:
    matrix_content = f.read()

# Read taskboard
with open('docs/TASKBOARD_SAAS_MIGRATION_20260504.md') as f:
    taskboard_content = f.read()

missing_reqs = []
for req_id in REQUIRED_REQS:
    if req_id not in matrix_content:
        missing_reqs.append(f'{req_id}: NOT in traceability matrix')
    if req_id not in taskboard_content:
        missing_reqs.append(f'{req_id}: NOT in taskboard')

if missing_reqs:
    print('FAIL:')
    for m in missing_reqs:
        print(f'  - {m}')
else:
    print(f'PASS: All {len(REQUIRED_REQS)} Req IDs covered')
```

### 4.2 Evidence completeness check

```bash
# Verify evidence files exist for completed tasks
ls docs/evidence/ | sort

# Verify each completed task has evidence
python -c "
import os, glob

# Tasks marked DONE in taskboard (extract from file)
with open('docs/TASKBOARD_SAAS_MIGRATION_20260504.md') as f:
    content = f.read()

done_tasks = [line.split('|')[1].strip() for line in content.split('\n')
              if '| DONE |' in line or '| ✅ |' in line]

evidence_files = os.listdir('docs/evidence') if os.path.exists('docs/evidence') else []

missing = [t for t in done_tasks if not any(t in f for f in evidence_files)]
if missing:
    print('FAIL: Missing evidence for:', missing)
else:
    print(f'PASS: All {len(done_tasks)} done tasks have evidence')
"
```

### 4.3 Shadow run duration check

```bash
# Verify shadow run evidence covers >= 3 trade days
for task in detect_whale_alerts detect_global_signals materialize_advisory; do
    python scripts/analyze_shadow_parity.py --task=$task --days=3
done
```

### 4.4 Task completeness checklist

| Check | Command | Expected |
|---|---|---|
| All 62 tasks in taskboard | `grep -c "^| SM-P" docs/TASKBOARD_SAAS_MIGRATION_20260504.md` | 62 |
| All Req IDs have tasks | `python scripts/verify_req_coverage.py` | PASS |
| All shadow tasks have >= 3 day log | `python scripts/analyze_shadow_parity.py` | PASS |
| All decommission tasks have sign-off field | `grep -c "Tech Lead sign-off" docs/TASKBOARD_SAAS_MIGRATION_20260504.md` | >= 5 |

---

## 5. Model 3 — Integration Auditor

**Câu hỏi Model 3 phải trả lời**:

> "Có gaps hoặc contradictions giữa Tech Spec, Implementation Plan, Taskboard, Traceability Matrix, và actual code không?"

### 5.1 Common gap patterns

**Pattern A — Spec claims X but code does Y**:
```bash
# Example: Spec says parity >= 99%, verify threshold in code
grep -rn "99\.\|parity_threshold\|PARITY_MIN" \
    packages/core/backend/src/ --include="*.py"
```

**Pattern B — Task exists but no evidence file**:
```bash
# Check for tasks marked DONE with no evidence
python scripts/verify_req_coverage.py --check-evidence
```

**Pattern C — Evidence claims PASS but test output contradicts**:
```bash
# Read each evidence file and verify outputs are plausible
for f in docs/evidence/SM-*.md; do
    echo "=== $f ==="
    grep -A 3 "RESULT:" "$f"
done
```

**Pattern D — Config ownership conflict**:
```bash
# Verify no parallel writers to same table
grep -rn "portfolio_globalsignalpolicy\|WhalePolicy\|GlobalSignalPolicy" \
    packages/core/backend/src/ --include="*.py" \
    | grep -v "read\|filter\|get\|#"
# Expected: 0 write operations from core (only reads allowed before Phase 3.3 cutover)
```

**Pattern E — Req IDs in evidence but not in matrix**:
```bash
# Extract all Req IDs from evidence files
grep -rh "SM-REQ-[0-9]\+" docs/evidence/ | sort -u > /tmp/evidence_reqs.txt
# Compare with traceability matrix
grep -oh "SM-REQ-[0-9]\+" docs/SAAS_MIGRATION_TRACEABILITY_MATRIX_20260504.md | sort -u > /tmp/matrix_reqs.txt
diff /tmp/evidence_reqs.txt /tmp/matrix_reqs.txt
```

### 5.2 Integration audit output format

```markdown
## Spec Audit Report — Phase <N> — <date>

### Model 1 (Spec Auditor) findings

#### PASS items
- [x] Materializer SQL reads from correct tables (verified Line 45-67, materializers.py)
- [x] JWT blacklist enabled (verified Line 123, settings.py)

#### FAIL items
- [ ] PAT hash at Line 89, portfolio/models.py: still uses hashlib.sha256, not hmac
  - Spec ref: Tech Spec mục 4.2
  - Req: SM-REQ-04
  - Required fix: Replace with hmac.new(pepper, secret, sha256)

### Model 2 (Coverage Auditor) findings

#### PASS items
- [x] All 34 SM-REQ-xx have tasks in taskboard
- [x] All GOV requirements covered

#### GAPS found
- [ ] SM-REQ-23 (i18n): No test exists for i18n coverage — task SM-P4.x doesn't have a test spec
  - Required fix: Add test_i18n_coverage.py

### Model 3 (Integration Auditor) findings

#### CONTRADICTIONS found
- [ ] Evidence for SM-P0.1 claims "upserted > 0" but materializer code at Line 88 returns early with empty list when legacy table empty — parity not verified with real data
  - Recommended: Run test against staging DB with real data

### Overall verdict

- Phase verdict: PASS / CONDITIONAL PASS / FAIL
- Blocking issues: N
- Non-blocking issues: N
- Conditional approval: (list conditions if any)
```

---

## 6. When to run spec audit

| Trigger | Scope |
|---|---|
| Phase N complete (all tasks DONE) | Full phase audit (Model 1+2+3) |
| Before Phase 6 decommission start | Full program audit |
| After any spec amendment | Affected requirements only |
| After security incident | Security requirements (SM-REQ-03 to SM-REQ-07) |

---

## 7. Spec audit acceptance criteria

Phase is APPROVED for decommission when:

1. **Model 1**: 0 critical issues, 0 high issues outstanding.
2. **Model 2**: All Req IDs have tasks; all DONE tasks have evidence files.
3. **Model 3**: 0 contradictions between spec and code; 0 orphan tasks.
4. **Shadow run**: All migrated tasks have >= 3 day shadow parity log with avg >= 99%.
5. **Security**: All 6 security issues from audit have regression tests passing.
6. **Load test**: p95 < 200ms at 500 VUs (gate for Phase 6 start).

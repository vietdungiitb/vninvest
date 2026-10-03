# CODE QUALITY CONSTITUTION — SaaS Production Migration & Legacy Monolith Decommission

**Ngày**: 2026-05-04  
**Scope**: Áp dụng cho tất cả code mới và code sửa trong phạm vi chương trình SaaS Migration.

---

## 1. Triết lý chất lượng

1. **Evidence over assertion**: không nói "tôi đã test" mà không có output.
2. **Explicit over implicit**: không có magic config, không có hidden defaults.
3. **Fail fast over silent failure**: production phải từ chối start khi thiếu critical config.
4. **Data integrity over performance**: không hy sinh data correctness để lấy tốc độ.
5. **Single writer per domain**: không bao giờ có hai paths ghi cùng một business concept.
6. **Immutable production builds**: không source mount, không runtime pip install.

---

## 2. Python / Django — Rules bắt buộc

### 2.1 Model design

```python
# ĐÚNG: Explicit field names, constraints, indexes
class UnifiedAlert(models.Model):
    event_id = models.CharField(max_length=64, unique=True, db_index=True)
    symbol = models.CharField(max_length=12, db_index=True)
    
    class Meta:
        db_table = 'signal_intelligence_unifiedalert'  # Explicit table name
        indexes = [
            models.Index(fields=['symbol', 'session_date']),
        ]

# SAI: Không có explicit table name, không có indexes cho FK hay date fields
class BadModel(models.Model):
    symbol = models.CharField(max_length=50)  # Too wide
    # No Meta class
```

**Rules**:
- Luôn có `db_table` explicit trong `Meta` — không dùng Django auto-generated names.
- Mọi field được JOIN hoặc filter thường xuyên phải có `db_index=True` hoặc trong `Meta.indexes`.
- `CharField` cho symbol: max_length=12. Không dùng 50 hay 100 cho symbol code.
- `BigIntegerField` cho giá trị VND — không dùng `FloatField`.
- `DecimalField` cho giá và tỷ lệ phần trăm — không dùng `FloatField`.

---

### 2.2 Query patterns

```python
# ĐÚNG: SQL-first projection, chỉ select cột cần
snapshots = SymbolSnapshot.objects.filter(
    session_date=today
).values('symbol', 'last_price', 'total_volume').iterator(chunk_size=500)

# ĐÚNG: Pandas vectorized cho aggregation lớn
df = pd.DataFrame.from_records(snapshots)
df['value_bucket'] = pd.cut(df['total_volume'], bins=[0, 1e6, 5e6, float('inf')])
result = df.groupby('value_bucket')['total_volume'].sum()

# SAI: N+1 query
for snapshot in SymbolSnapshot.objects.filter(session_date=today):
    facts = SessionFacts.objects.get(symbol=snapshot.symbol, ...)  # N+1!

# SAI: Full payload khi chỉ cần một vài fields
snapshots = SymbolSnapshot.objects.all()  # Không .values(), không filter
```

**Rules**:
- Dùng `.values()` hoặc `.only()` khi không cần full ORM objects.
- Dùng `.select_related()` / `.prefetch_related()` cho FK relationships.
- Dùng `.iterator(chunk_size=N)` cho bulk reads (N > 1000 records).
- Phân tách: SQL cho filtering/selection, Pandas vectorized cho computation nặng.
- Không raw SQL string interpolation — luôn dùng parameterized queries.

---

### 2.3 Security patterns

```python
# ĐÚNG: Parameterized query
cursor.execute(
    "SELECT * FROM portfolio_whalealertevent WHERE symbol = %s AND session_date = %s",
    [symbol, session_date]
)

# SAI: String interpolation (SQL injection)
cursor.execute(f"SELECT * FROM table WHERE symbol = '{symbol}'")

# ĐÚNG: Secret từ env var với explicit error
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY')
if not SECRET_KEY:
    raise ImproperlyConfigured('DJANGO_SECRET_KEY phải được set trong production.')

# SAI: Default secret
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', 'dev-only-insecure-key')

# ĐÚNG: Constant-time comparison
import hmac
if not hmac.compare_digest(provided_hash, stored_hash):
    raise AuthenticationFailed('Invalid token')

# SAI: Direct comparison (timing attack)
if provided_hash != stored_hash:
    raise AuthenticationFailed('Invalid token')
```

**Rules**:
- Tuyệt đối không string interpolation trong SQL — dùng parameterized queries.
- Tuyệt đối không default value cho SECRET_KEY, POSTGRES_PASSWORD, CORE_PAT_PEPPER.
- Token/hash comparison phải dùng `hmac.compare_digest()`.
- Không log secrets, tokens, passwords — kể cả debug logs.
- Không raise exception với secret values trong message.

---

### 2.4 Celery task patterns

```python
# ĐÚNG: Idempotent task với explicit queue và retry
@shared_task(
    name='signal_intelligence.detect_whale_alerts',
    queue='core',
    bind=True,
    max_retries=3,
    default_retry_delay=30,
    acks_late=True,
)
def detect_whale_alerts(self, symbol: str, session_date: str) -> dict:
    """Idempotent: re-run cùng inputs → cùng kết quả."""
    try:
        result = _do_work(symbol, session_date)
        return {'status': 'ok', 'symbol': symbol, 'count': result['count']}
    except Exception as exc:
        raise self.retry(exc=exc)

# SAI: Task không idempotent, không có retry
@shared_task
def bad_task():
    data = SomeModel.objects.create(...)  # Tạo duplicate nếu retry
    return data.id
```

**Rules**:
- Mọi task phải idempotent — re-run an toàn.
- Mọi task phải có explicit `name` (không dùng auto-name).
- Mọi task phải có `max_retries` và `default_retry_delay`.
- Task quan trọng phải có `acks_late=True`.
- Return value phải là serializable dict/primitive, không phải ORM object.

---

### 2.5 Shadow run patterns

```python
# ĐÚNG: Shadow task với parity logging
@shared_task(name='signal_intelligence.detect_whale_alerts_shadow')
def detect_whale_alerts_shadow(self, symbol: str, session_date: str) -> dict:
    """Shadow mode: chạy song song, so sánh với legacy, không affect production."""
    from signal_intelligence.shadow import log_shadow_parity
    
    # 1. Lấy kết quả legacy (đọc từ DB, không trigger lại task)
    legacy_result = _read_legacy_result(symbol, session_date)
    
    # 2. Tính kết quả core
    core_result = _do_core_work(symbol, session_date)
    
    # 3. Log parity — KHÔNG modify production state nếu mismatch
    log_shadow_parity(
        task_name='detect_whale_alerts',
        symbol=symbol,
        legacy_result=legacy_result,
        core_result=core_result
    )
    
    # 4. Ghi vào core DB (shadow = safe side effect)
    _write_to_core_db(core_result)
    
    return {'status': 'shadow', 'parity': ...}
```

---

### 2.6 Data migration patterns

```python
# ĐÚNG: Batch migration với error isolation
def migrate_batch(objects_qs, batch_size: int, dry_run: bool) -> dict:
    migrated = 0
    errors = []
    
    for batch in _chunked_qs(objects_qs, batch_size):
        try:
            core_objects = [_transform(obj) for obj in batch]
            if not dry_run:
                CoreModel.objects.bulk_create(
                    core_objects,
                    update_conflicts=True,
                    unique_fields=['event_id'],
                    update_fields=['value_vnd', 'metadata', 'updated_at']
                )
            migrated += len(batch)
        except Exception as e:
            errors.append({'batch_start': batch[0].id, 'error': str(e)})
            # Không raise — isolate errors per batch
    
    return {'migrated': migrated, 'errors': errors}
```

---

## 3. Frontend / React — Rules bắt buộc

### 3.1 API call patterns

```jsx
// ĐÚNG: Dùng coreApiAdapter
import { coreApi } from '../adapters/coreApiAdapter';

function SymbolPage({ symbol }) {
    const [snapshot, setSnapshot] = useState(null);
    
    useEffect(() => {
        coreApi.getSymbolSnapshot(symbol).then(setSnapshot);
    }, [symbol]);
}

// SAI: Direct fetch
useEffect(() => {
    fetch(`/api/portfolio/snapshot/?symbol=${symbol}`)  // Legacy URL, no adapter
        .then(r => r.json())
        .then(setSnapshot);
}, [symbol]);
```

**Rules**:
- Tất cả API calls phải qua `coreApiAdapter.js`.
- Không có hardcoded URLs trong components.
- Không gọi legacy `/api/` endpoints từ packages/web pages mới.

---

### 3.2 i18n patterns

```jsx
// ĐÚNG: i18n function
import { useTranslation } from 'react-i18next';

function AlertCard({ alert }) {
    const { t } = useTranslation();
    return (
        <div>
            <h3>{t('whale.alert.title')}</h3>
            <p>{t('whale.alert.value', { value: alert.value_vnd })}</p>
        </div>
    );
}

// SAI: Hardcode tiếng Việt trong JSX
function AlertCard({ alert }) {
    return (
        <div>
            <h3>Cảnh báo cá mập</h3>  {/* Hardcode — SAI */}
        </div>
    );
}
```

**Rules**:
- Mọi text hiển thị cho user phải qua `t()`.
- i18n key format: `<domain>.<component>.<element>`.
- Tiếng Việt đầy đủ dấu trong file i18n — không viết tắt.

---

### 3.3 Component patterns

```jsx
// ĐÚNG: Error boundary và loading state rõ ràng
function DataPanel({ symbol }) {
    const { data, isLoading, error } = useCoreQuery(
        () => coreApi.getSessionFacts(symbol),
        { enabled: !!symbol }
    );
    
    if (isLoading) return <LoadingSpinner />;
    if (error) return <ErrorBoundaryFallback error={error} />;
    if (!data) return <EmptyState message={t('common.noData')} />;
    
    return <FactsDisplay facts={data} />;
}

// SAI: Không handle loading/error states
function BadPanel({ symbol }) {
    const [data, setData] = useState(null);
    useEffect(() => { coreApi.getSessionFacts(symbol).then(setData); }, [symbol]);
    return <FactsDisplay facts={data} />;  // data có thể null → crash
}
```

---

## 4. Docker / Infrastructure — Rules bắt buộc

### 4.1 Immutable builds

```dockerfile
# ĐÚNG: Multi-stage, no runtime pip
FROM python:3.13-slim AS builder
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt --target=/deps

FROM python:3.13-slim
COPY --from=builder /deps /usr/local/lib/python3.13/site-packages/
COPY . .

# SAI: pip install at runtime
CMD ["sh", "-c", "pip install -r requirements.txt && gunicorn ..."]
```

### 4.2 Secret management

```yaml
# ĐÚNG: Required env var với error message
environment:
  SECRET_KEY: ${DJANGO_SECRET_KEY:?Must set DJANGO_SECRET_KEY in .env}

# SAI: Default secret
environment:
  SECRET_KEY: insecure-dev-key  # Hardcode
```

### 4.3 Healthcheck bắt buộc

```dockerfile
# ĐÚNG: Healthcheck để detect crash loop
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8100/core/health/')"
```

---

## 5. Test requirements

### 5.1 Coverage thresholds

| Layer | Minimum coverage |
|---|---|
| Backend models | 90% |
| Backend services/tasks | 80% |
| Backend API views | 85% |
| Data migration scripts | 95% |
| Frontend utils/adapters | 80% |
| Frontend components | 70% |

### 5.2 Test categories bắt buộc

| Category | Mô tả | Khi nào bắt buộc |
|---|---|---|
| **Unit test** | Function-level, isolated mocks | Mọi service/helper functions |
| **Integration test** | API endpoint với test DB | Mọi API endpoint mới |
| **Migration test** | Parity verify sau data migration | Mọi domain migration slice |
| **Shadow parity test** | Parity report review | Mọi Celery task migration |
| **Security regression** | Verify vulnerability đã fix | Mọi security slice |
| **Load test** | k6 500 VUs | Phase 5 + Phase 6 gate |

### 5.3 Test naming convention

```python
class TestMaterializeSymbolSnapshot(TestCase):
    """SM-P0.1: Verify materializer reads from correct legacy table."""
    
    def test_reads_from_tickersessionclose(self):
        """Phải đọc từ portfolio_tickersessionclose, không phải portfolio_symbolsnapshot."""
        ...
    
    def test_upsert_returns_count_greater_than_zero(self):
        """Phải upsert ít nhất 1 record khi legacy DB có data."""
        ...
    
    def test_handles_empty_legacy_table_gracefully(self):
        """Không crash khi legacy table rỗng."""
        ...
```

---

## 6. Git / PR discipline

### 6.1 PR rules

- PR title phải chứa Slice ID: `[SM-P0.1] Fix materializer SQL — SymbolSnapshot + SessionFacts`
- PR description phải link đến evidence file: `docs/evidence/SM-P0.1-20260505.md`
- PR không được chạm file ngoài scope slice — nếu cần thêm thì tạo PR mới
- PR phải pass tất cả CI checks trước khi merge

### 6.2 Commit message convention

```
SM-P0.1: Rewrite materializer SQL for SymbolSnapshot

- Read from portfolio_tickersessionclose instead of portfolio_symbolsnapshot
- Add JSONB extraction for SessionFacts from portfolio_advisoryaggregatesnapshot
- Add unit tests for SQL queries

Fixes: SM-REQ-01, SM-REQ-02
Evidence: docs/evidence/SM-P0.1-20260505.md
```

### 6.3 Branch strategy

```
main                     ← Production-only, protected
├── dev                  ← Integration branch
│   ├── sm/p0.1-materializer-fix
│   ├── sm/p1.1-jwt-blacklist
│   ├── sm/p2.1-core-db-separation
│   └── ...
```

Branch naming: `sm/<slice-id>-<short-description>`

---

## 7. Documentation requirements

### 7.1 Sau mỗi slice

- [ ] `docs/CODE_CHANGE_AUDIT_LEDGER.md`: thêm row mới
- [ ] `PROGRESS_DASHBOARD.md`: update task status
- [ ] Evidence file: tạo tại `docs/evidence/`

### 7.2 Sau Phase 3 hoàn thành

- [ ] `module_tree_full.md`: regenerate (user memory preference)

### 7.3 Sau Phase 6 hoàn thành

- [ ] `module_tree_full.md`: regenerate toàn bộ
- [ ] `AGENTS.md`: update anchor files list
- [ ] `README.md`: update architecture section
- [ ] `PROGRESS_DASHBOARD.md`: final status COMPLETE

---

## 8. Nghiêm cấm (violations = PR rejected)

1. **`git push --force` lên main hoặc dev** — không bao giờ, không có exception.
2. **SQL string interpolation** — tuyệt đối không.
3. **Secret trong source code** — tuyệt đối không, kể cả test files.
4. **Source mount trong production Docker compose** — phải build từ Dockerfile.
5. **Direct API calls ngoài coreApiAdapter** — packages/web không dùng fetch/axios trực tiếp.
6. **Hardcode tiếng Việt trong JSX** — phải qua i18n.
7. **Ghi vào legacy DB từ core containers** — CoreRouter phải block, không workaround.
8. **Deploy production mà test chưa PASS** — CI gate là hard blocker.
9. **Mark task DONE mà không có evidence** — không có exception.
10. **Decommission code mà chưa có Tech Lead sign-off** — không có exception.
11. **Ghi hoặc phát triển code mới trong legacy directories** — Thư mục `backend/` và `frontend/` cũ ở gốc hoàn toàn chỉ là để tham khảo tính năng (deprecated). Mọi chức năng mới bắt buộc phải nằm tại `packages/core` (core-api) và `packages/web`.

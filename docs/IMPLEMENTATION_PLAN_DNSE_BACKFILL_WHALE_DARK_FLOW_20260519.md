# Implementation Plan — DNSE Historical Backfill Whale & Dark Flow
**Ngày**: 2026-05-19
**Status**: Approved — Ready for execution
**Parent**: docs/DNSE_BACKFILL_WHALE_DARK_FLOW_HANDOFF_MASTER_20260519.md

---

## 1. Tổng quan

Kế hoạch gồm 6 slice tuần tự + 1 slice frontend:

| Slice | Nội dung | Phụ thuộc |
|---|---|---|
| D1 | SSOT adapter: `fetch_intraday_tape_history()` | — |
| D2 | Model `UserDNSECredential` + migration + CRUD API | D1 |
| D3 | System backfill Celery task + SOC trigger endpoint | D1, D2 |
| D4 | User self-serve backfill task + user trigger endpoint | D1, D2 |
| D5 | Extend `detect_and_store_global_whale_alerts` với `session_date` | D3, D4 |
| D6 | Integration test suite | D1–D5 |
| D7 | Frontend: SOC panel + User settings DNSE tab | D2, D3, D4 |

---

## 2. Dependency graph

```text
D1 (adapter) ─────────────────────────────────┐
                                               ▼
D2 (model/migration/CRUD) ────────────────────┤
                                               ▼
                               D3 (system task + SOC endpoint) ──┐
                               D4 (user task + user endpoint) ───┤
                                                                  ▼
                                               D5 (detect task session_date) ──┐
                                                                                ▼
                                                               D6 (tests) ──────┤
                                                               D7 (frontend) ───┘
```

---

## 3. Task breakdown

| Task ID | Tên | Artifact chính | DoD |
|---|---|---|---|
| D1 | SSOT adapter historical fetch | `market_data/vnbroker_adapter.py` | `fetch_intraday_tape_history()` trả list[dict] đúng schema, VN→UTC convert, không log credential |
| D2 | UserDNSECredential model | `identity_access/models.py`, migration, `identity_access/views.py`, `identity_access/serializers.py` | Model tạo OK, Fernet encrypt/decrypt round-trip pass, CRUD API hoạt động, credential không lộ trong response |
| D3 | System backfill task + endpoint | `data_ingest/tasks.py`, `data_ingest/views.py`, `data_ingest/serializers.py` | Task reads system provider credential, presence-check đúng, ServiceRunLog ghi, SOC trigger endpoint trả 202 |
| D4 | User backfill task + endpoint | `data_ingest/tasks.py`, `signal_intelligence/views.py` hoặc `data_ingest/views.py` | Rate limit 5/day/user enforce, task fetch đúng user credential, merge rule (skip nếu đã có) hoạt động, auto-trigger detection |
| D5 | Extend detection task | `signal_intelligence/tasks.py` | `detect_and_store_global_whale_alerts(symbol, session_date=d)` hoạt động cho phiên lịch sử, backwards compatible với call không có session_date |
| D6 | Integration tests | `data_ingest/tests/`, `signal_intelligence/tests/`, `identity_access/tests/` | ≥ 12 test cases cover: credential CRUD, system backfill idempotency, user backfill rate limit, merge rule, detection trigger |
| D7 | Frontend SOC + Settings | `frontend/src/pages/SOCPage.jsx` hoặc SOC panel component, `frontend/src/pages/UserSettings.jsx` | SOC có widget trigger backfill, Settings có tab DNSE credential, i18n đầy đủ |

---

## 4. Chi tiết task

### D1 — SSOT adapter: `fetch_intraday_tape_history()`

**Mục tiêu**: Thêm hàm public duy nhất cho historical DNSE tape vào SSOT adapter. Không có code nào ngoài adapter được import vnbroker.

**Files bị ảnh hưởng**:
- `packages/core/backend/src/market_data/vnbroker_adapter.py` (MODIFY)

**Interface cần implement**:
```python
def fetch_intraday_tape_history(
    symbol: str,
    trade_date: str,           # "YYYY-MM-DD"
    api_key: str | None = None,
    api_secret: str | None = None,
) -> list[dict]:
    """
    Fetch full DNSE intraday tape cho một ngày giao dịch cụ thể.

    - Dùng DNSEQuote.intraday(date=trade_date, get_all=True, page_size=1000)
    - Convert timestamp VN UTC+7 → UTC-aware datetime
    - Không cache (historical = immutable)
    - Không log api_key/api_secret
    - Trả về [] nếu API lỗi (không raise)

    Return schema mỗi dict:
    {
        'timestamp': datetime (UTC-aware),
        'price': Decimal,
        'volume': int,
        'side': 'BUY' | 'SELL' | 'UNKNOWN',
        'match_type': str,
        'source': 'dnse_system' | 'dnse_user',
    }
    """
```

**Test cases bắt buộc**:
1. Mock DNSEQuote → trả về DataFrame 3 rows → output là list 3 dicts đúng schema
2. Timestamp VN 09:30:00 → UTC 02:30:00 (UTC+7 offset)
3. API lỗi (exception) → trả về [] không raise
4. `side` = 'BUY'/'SELL' map đúng; giá trị khác → 'UNKNOWN'
5. `api_key=None` → dùng DNSEQuote không credentials (public mode nếu có)

**DoD**:
- [ ] Hàm tồn tại tại đúng vị trí trong `vnbroker_adapter.py`
- [ ] Không có import `DNSEQuote` nào bên ngoài `vnbroker_adapter.py`
- [ ] 5 test cases PASS trong `market_data/tests/test_vnbroker_adapter_history.py`
- [ ] `get_errors()` không lỗi mới

**Không thuộc scope D1**: Lưu vào DB, task Celery, model migration.

---

### D2 — Model `UserDNSECredential` + migration + CRUD API

**Mục tiêu**: Lưu trữ DNSE API key/secret của người dùng một cách an toàn. Admin có thể đánh dấu credential của mình là system provider.

**Files bị ảnh hưởng**:
- `packages/core/backend/src/identity_access/models.py` (MODIFY — thêm class)
- `packages/core/backend/src/identity_access/migrations/` (CREATE migration)
- `packages/core/backend/src/identity_access/serializers.py` (MODIFY)
- `packages/core/backend/src/identity_access/views.py` (MODIFY)
- `packages/core/backend/src/identity_access/api_urls.py` (MODIFY)
- `packages/core/backend/src/vninvest_core/settings.py` (MODIFY — thêm `DNSE_CREDENTIAL_FERNET_KEY` env var)

**Model schema**:
```python
class UserDNSECredential(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE,
        related_name='dnse_credential', verbose_name='Người dùng')
    api_key_encrypted = models.BinaryField(verbose_name='API Key (mã hóa)')
    api_secret_encrypted = models.BinaryField(verbose_name='API Secret (mã hóa)')
    is_system_provider = models.BooleanField(default=False, db_index=True,
        verbose_name='Dùng làm nguồn cấp hệ thống')
    is_verified = models.BooleanField(default=False,
        verbose_name='Đã xác minh với DNSE')
    last_verified_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['is_system_provider'],
                condition=models.Q(is_system_provider=True),
                name='unique_system_provider_credential',
            )
        ]
```

**API endpoints**:
```
POST   /core/v1/user/dnse-credential/        — Lưu credential (tự động encrypt)
GET    /core/v1/user/dnse-credential/        — Xem trạng thái (KHÔNG trả key)
DELETE /core/v1/user/dnse-credential/        — Xóa credential
POST   /core/v1/user/dnse-credential/verify/ — Gọi DNSE test để xác minh key
PATCH  /core/v1/user/dnse-credential/set-system-provider/  — (Admin only) đánh dấu system provider
```

**Response GET** (không trả key):
```json
{
    "has_credential": true,
    "is_system_provider": false,
    "is_verified": true,
    "last_verified_at": "2026-05-19T10:00:00Z"
}
```

**Helpers cần implement**:
```python
def encrypt_dnse_credential(plain_text: str) -> bytes:
    """Fernet encrypt. Key từ settings.DNSE_CREDENTIAL_FERNET_KEY."""

def decrypt_dnse_credential(cipher_bytes: bytes) -> str:
    """Fernet decrypt."""

def get_system_provider_credentials() -> tuple[str, str] | None:
    """Trả về (api_key, api_secret) của system provider, hoặc None."""
```

**Test cases bắt buộc**:
1. Tạo credential → encrypt round-trip → decrypt đúng
2. GET response không chứa `api_key`, `api_secret` trong JSON
3. Non-admin user set `is_system_provider=True` → HTTP 403
4. Admin set `is_system_provider=True` → OK; admin thứ 2 set → unique constraint error → HTTP 400
5. DELETE → credential xóa khỏi DB
6. `get_system_provider_credentials()` khi không có system provider → trả `None`

**DoD**:
- [ ] Migration tạo table `identity_access_userdnsecredential` thành công
- [ ] Unique constraint `unique_system_provider_credential` hoạt động
- [ ] 6 test cases PASS
- [ ] Credentials không xuất hiện trong GET response, logs
- [ ] `DNSE_CREDENTIAL_FERNET_KEY` documented trong `compose.dev.env` và `compose.prod.env.example`

**Không thuộc scope D2**: Backfill logic, UI.

---

### D3 — System backfill Celery task + SOC trigger endpoint

**Mục tiêu**: Admin trigger backfill hàng loạt mã từ SOC. Task đọc credential system provider, fetch DNSE per-day, insert IntradayTick thiếu, ghi ServiceRunLog.

**Files bị ảnh hưởng**:
- `packages/core/backend/src/data_ingest/tasks.py` (MODIFY — thêm task)
- `packages/core/backend/src/data_ingest/serializers.py` (MODIFY)
- `packages/core/backend/src/data_ingest/views.py` (MODIFY — thêm action)
- `packages/core/backend/src/data_ingest/models.py` (MODIFY — thêm source choice)

**Task signature**:
```python
@shared_task(bind=True, name='data_ingest.tasks.backfill_intraday_tick_system',
             queue='manual_on_demand', max_retries=1)
def backfill_intraday_tick_system(
    self,
    symbols: list[str] | None = None,  # None → GlobalSymbolRegistry hot+warm
    days_back: int = 90,
    overwrite: bool = False,
    service_run_log_id: int | None = None,
) -> dict:
    """
    Returns:
    {
        'status': 'done' | 'partial' | 'aborted',
        'symbols_processed': int,
        'dates_inserted': int,
        'ticks_inserted': int,
        'dates_skipped_already_exists': int,
        'errors': list[str],
    }
    """
```

**Nội bộ task**:
1. `creds = get_system_provider_credentials()` → nếu `None` → abort với status='aborted', reason='no_system_provider'
2. `symbols` default → `GlobalSymbolRegistry.objects.filter(is_active=True, current_priority_tier__in=['hot','warm'])`
3. Lọc ngày giao dịch (thứ 2–6, không phải ngày nghỉ lễ) trong `days_back` ngày gần nhất
4. Per (symbol, date): `IntradayTick.objects.filter(symbol=sym, timestamp__date=d).exists()` → skip nếu True và `overwrite=False`
5. `rows = fetch_intraday_tape_history(sym, d, creds[0], creds[1])`
6. `IntradayTick.objects.bulk_create([...], batch_size=500)` với `source='dnse_system'`
7. Throttle: `time.sleep(1.2)` giữa các (symbol, date) request
8. Ghi `ServiceRunLog` với input/output summary

**SOC trigger endpoint**:
```
POST /core/v1/data-ingest/trigger/whale-backfill/
Body: {
    "symbols": ["HPG", "ACB"],    # optional, null → tất cả hot+warm
    "days_back": 90,
    "overwrite": false
}
Response 202: { "task_id": "...", "status": "queued", "message": "..." }
```
- Permission: `IsAdminUser`
- Throttle: `IngestAdminThrottle` (đã có)

**DoD**:
- [ ] Task bị abort khi không có system provider credential
- [ ] Presence check hoạt động — chạy 2 lần cùng symbol/date không tạo duplicate
- [ ] ServiceRunLog được ghi với đủ input/output summary
- [ ] Endpoint trả 202 và task_id
- [ ] 4 test cases PASS

---

### D4 — User self-serve backfill task + endpoint

**Mục tiêu**: User với DNSE credential hợp lệ tự trigger backfill 1 mã. Dữ liệu ghi vào shared DB nếu thiếu.

**Files bị ảnh hưởng**:
- `packages/core/backend/src/data_ingest/tasks.py` (MODIFY — thêm task)
- `packages/core/backend/src/signal_intelligence/views.py` hoặc `data_ingest/views.py` (MODIFY)
- `packages/core/backend/src/signal_intelligence/urls.py` hoặc `data_ingest/urls.py` (MODIFY)

**Task signature**:
```python
@shared_task(bind=True, name='data_ingest.tasks.backfill_intraday_tick_user',
             queue='manual_on_demand', max_retries=0)
def backfill_intraday_tick_user(
    self,
    user_id: int,
    symbol: str,
    days_back: int = 90,
) -> dict:
    """
    Returns:
    {
        'status': 'done' | 'partial' | 'no_credential',
        'symbol': str,
        'dates_inserted': int,
        'ticks_inserted': int,
        'dates_skipped_system_has_data': int,
        'errors': list[str],
    }
    """
```

**User trigger endpoint**:
```
POST /core/v1/whale/backfill-symbol/
Body: { "symbol": "ACB", "days_back": 90 }
Auth: JWT user token
Response 202: { "task_id": "...", "symbol": "ACB", "status": "queued" }
```
- Rate limit: `UserBackfillThrottle` — 5/day/user + 1/2min (burst)
- `days_back` clamp: min=1, max=180

**Merge rule**:
- Nếu `IntradayTick.objects.filter(symbol=sym, timestamp__date=d).count() >= threshold_min` → skip date, tăng `dates_skipped_system_has_data`
- Threshold: 100 ticks (một ngày DNSE thực có 5000+, nếu hệ thống chỉ có < 100 coi là missing)

**DoD**:
- [ ] Rate limit 429 khi vượt 5 req/ngày
- [ ] User không có credential → task trả `status='no_credential'`
- [ ] Merge rule hoạt động: ngày đủ data → skip
- [ ] `source='dnse_user'` cho records được user insert
- [ ] Auto-trigger `detect_and_store_global_whale_alerts` cho mỗi date đã insert
- [ ] 4 test cases PASS

---

### D5 — Extend `detect_and_store_global_whale_alerts` với `session_date`

**Mục tiêu**: Detection task nhận optional `session_date` để xử lý phiên lịch sử.

**Files bị ảnh hưởng**:
- `packages/core/backend/src/signal_intelligence/tasks.py` (MODIFY)

**Thay đổi**:
```python
def detect_and_store_global_whale_alerts(self, symbol=None, session_date=None):
    # session_date: str "YYYY-MM-DD" hoặc None
    # Nếu None → dùng _get_latest_session_date() như hiện tại (backwards compatible)
    # Nếu str → parse thành date object, filter IntradayTick theo ngày đó
```

**DoD**:
- [ ] Call không có `session_date` hoạt động như trước (backwards compatible)
- [ ] Call với `session_date="2026-05-10"` filter đúng IntradayTick của ngày đó
- [ ] 2 test cases PASS
- [ ] Không phá vỡ existing tests

---

### D6 — Integration test suite

**Mục tiêu**: Đảm bảo toàn bộ pipeline D1→D5 hoạt động end-to-end.

**Files bị ảnh hưởng**:
- `packages/core/backend/src/market_data/tests/test_vnbroker_adapter_history.py` (CREATE)
- `packages/core/backend/src/identity_access/tests/test_dnse_credential.py` (CREATE)
- `packages/core/backend/src/data_ingest/tests/test_backfill_tasks.py` (CREATE)
- `packages/core/backend/src/signal_intelligence/tests/test_detect_historical.py` (CREATE)

**Test matrix**:

| Test | File | Mô tả |
|---|---|---|
| T-A1 | adapter_history | fetch trả đúng schema |
| T-A2 | adapter_history | VN→UTC convert chính xác |
| T-A3 | adapter_history | API error → [] |
| T-B1 | dnse_credential | encrypt/decrypt round-trip |
| T-B2 | dnse_credential | GET không expose key |
| T-B3 | dnse_credential | non-admin set is_system_provider → 403 |
| T-B4 | dnse_credential | duplicate system provider → 400 |
| T-C1 | backfill_tasks | system task abort khi no system provider |
| T-C2 | backfill_tasks | presence check idempotency |
| T-C3 | backfill_tasks | user task rate limit 429 |
| T-C4 | backfill_tasks | merge rule: ngày đủ data → skip |
| T-D1 | detect_historical | session_date param filter đúng |
| T-D2 | detect_historical | backwards compat (no session_date) |

**DoD**:
- [ ] 13 test cases PASS
- [ ] Không có pytest warning mới
- [ ] `--keepdb` mode hoạt động

---

### D7 — Frontend: SOC panel + User settings DNSE tab

**Mục tiêu**: Operator trigger backfill từ SOC; user kết nối DNSE credential và trigger backfill cho mã cụ thể.

**Files bị ảnh hưởng**:
- `packages/web/src/` hoặc `frontend/src/` — xem AGENTS.md anchor files
- SOC panel component (MODIFY)
- User settings page (MODIFY — thêm tab)
- `coreApiAdapter.js` (MODIFY — thêm 4 methods)
- i18n locale vi.json (MODIFY)

**Chi tiết xem**: `docs/FRONTEND_DESIGN_DNSE_BACKFILL_WHALE_DARK_FLOW_20260519.md`

**DoD**:
- [ ] Build thành công không warning mới
- [ ] i18n đầy đủ tiếng Việt
- [ ] Tất cả API calls qua `coreApiAdapter.js`
- [ ] Không direct fetch
- [ ] Rate limit feedback hiển thị đúng khi API trả 429

---

## 5. Validation gates toàn workstream

```powershell
# Backend tests
Push-Location ./packages/core/backend
python manage.py test data_ingest.tests.test_backfill_tasks --keepdb
python manage.py test identity_access.tests.test_dnse_credential --keepdb
python manage.py test market_data.tests.test_vnbroker_adapter_history --keepdb
python manage.py test signal_intelligence.tests.test_detect_historical --keepdb
Pop-Location

# Frontend build
Push-Location ./frontend
npm run build
Pop-Location

# Stack rebuild
.\start_dev.ps1

# Smoke check
docker exec vninvest-dev-core-api python -c "
import django,os; os.environ.setdefault('DJANGO_SETTINGS_MODULE','vninvest_core.settings')
django.setup()
from identity_access.models import UserDNSECredential
print('UserDNSECredential table OK, rows:', UserDNSECredential.objects.count())
"
```

---

## 6. Governance artifacts

- `docs/CODE_CHANGE_AUDIT_LEDGER.md`: cập nhật sau mỗi slice
- `docs/TASKBOARD_DNSE_BACKFILL_WHALE_DARK_FLOW_20260519.md`: update status mỗi task
- `module_tree_full.md`: regenerate sau D2 (model mới) và D7 (component mới)
- Commit riêng mỗi task, push ngay `origin/dev`

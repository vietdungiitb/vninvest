# EXECUTION EVIDENCE TEMPLATE — Full Independence Cutover (Mục tiêu C)

**Mục đích**: Template ghi nhận bằng chứng thực thi cho mỗi slice  
**Save location**: `docs/evidence/CUT-{SLICE_ID}-EVIDENCE-{YYYYMMDD}.md`  
**Ví dụ**: `docs/evidence/CUT-C2-EVIDENCE-20260513.md`  

---

## [COPY TỪ ĐÂY VÀ ĐIỀN VÀO]

---

# Evidence: CUT-{SLICE_ID} — {Tên slice}

**Ngày thực hiện**: {YYYY-MM-DD}  
**Người thực hiện**: {Tên}  
**Slice**: C{N} — {Mô tả}  
**Status**: ✅ PASS / ❌ FAIL / ⚠️ PARTIAL  

---

## 1. Files đã thay đổi

| File | Loại thay đổi | Dòng thay đổi |
|------|--------------|---------------|
| `{đường dẫn}` | ADD/MODIFY/DELETE | L{from}–L{to} |
| `{đường dẫn}` | ADD/MODIFY/DELETE | L{from}–L{to} |

**Diff summary** (paste output `git diff --stat`):
```
{paste git diff --stat output here}
```

---

## 2. Validation commands & output

### Test {N}: {Tên test}

**Command**:
```powershell
{paste command here}
```

**Output thực tế**:
```
{paste actual output here}
```

**Result**: ✅ PASS / ❌ FAIL / ⚠️ WARN  
**Ghi chú**: {nếu có}

---

### Test {N+1}: {Tên test}

**Command**:
```powershell
{paste command here}
```

**Output thực tế**:
```
{paste actual output here}
```

**Result**: ✅ PASS / ❌ FAIL / ⚠️ WARN

---

## 3. Smoke test table

| Endpoint | Method | Status code | Response preview | Pass? |
|---------|--------|-------------|-----------------|-------|
| `/api/{path}/` | GET | 200 | `{"symbol":"VCB",...}` | ✅ |
| `/api/{path}/` | GET | 200 | `[...]` | ✅ |
| `/api/{path}/` | POST | 400 | `{"error":"..."}` | ✅ |

---

## 4. Payload snapshots

### Route: `/api/{path}/`

**Request**:
```http
GET /api/{path}/ HTTP/1.1
Authorization: Bearer {PAT_MASKED}
```

**Response** (truncated nếu dài):
```json
{
  "symbol": "VCB",
  "price": "85500.00",
  "price_change": "500.00",
  "price_change_pct": "0.0059",
  "volume": 1234567,
  "market_status": "closed",
  "stale": false
}
```

---

## 5. Docker stack health

**Command**:
```powershell
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

**Output thực tế**:
```
NAMES                       STATUS          PORTS
vninvest-core-api-1         Up 5 minutes    0.0.0.0:8100->8100/tcp
vninvest-core-beat-1        Up 5 minutes
vninvest-core-worker-1      Up 5 minutes
vninvest-frontend-1         Up 5 minutes    0.0.0.0:80->80/tcp
vninvest-redis-1            Up 5 minutes    6379/tcp
vninvest-postgres-1         Up 5 minutes    5432/tcp
```

**Verify port 8000 không exposed**:
```powershell
docker ps --format "{{.Ports}}" | Select-String "8000"
# Expected: no output (empty)
```

---

## 6. Residual risks

| Risk | Severity | Mitigation |
|------|---------|-----------|
| {Mô tả risk} | LOW/MED/HIGH | {Cách xử lý} |

**Known limitations**:
- {Liệt kê nếu có}

---

## 7. Sign-off

- [ ] Developer đã chạy tất cả tests trong SELF_AUDIT_TEST_PROTOCOL §C{N}
- [ ] Tất cả mandatory tests PASS
- [ ] Docker stack healthy (core-api UP, không có `backend` container)
- [ ] Evidence file này đã được commit vào `docs/evidence/`

**Reviewer** (nếu cần): {Tên reviewer}  
**Sign-off date**: {YYYY-MM-DD}

---

## [KẾT THÚC TEMPLATE]

---

# Ví dụ hoàn chỉnh: CUT-C1 Evidence

---

# Evidence: CUT-C1 — Kích hoạt ingest core-beat

**Ngày**: 2026-05-13  
**Người thực hiện**: Backend Dev  
**Slice**: C1 — Thêm `ingest-price-board-60s` vào CELERY_BEAT_SCHEDULE  
**Status**: ✅ PASS  

---

## 1. Files đã thay đổi

| File | Loại thay đổi | Dòng thay đổi |
|------|--------------|---------------|
| `packages/core/backend/src/vninvest_core/settings.py` | MODIFY | ~L390 (trong CELERY_BEAT_SCHEDULE) |

**Diff summary**:
```
 packages/core/backend/src/vninvest_core/settings.py | 8 ++++++++
 1 file changed, 8 insertions(+)
```

---

## 2. Validation commands & output

### Test C1-T1: Beat schedule entry

**Command**:
```powershell
Push-Location ./packages/core/backend
..\..\..\.venv\Scripts\python.exe manage.py shell -c "
from django.conf import settings
key = 'ingest-price-board-60s'
print('found:', key in settings.CELERY_BEAT_SCHEDULE)
print('task:', settings.CELERY_BEAT_SCHEDULE[key]['task'])
print('schedule:', settings.CELERY_BEAT_SCHEDULE[key]['schedule'])
print('queue:', settings.CELERY_BEAT_SCHEDULE[key]['options']['queue'])
"
Pop-Location
```

**Output thực tế**:
```
found: True
task: data_ingest.tasks.fetch_and_upsert_price_board
schedule: 60.0
queue: realtime_prefetch
```

**Result**: ✅ PASS

---

### Test C1-T2: SymbolSnapshot fresh

**Command**:
```powershell
Push-Location ./packages/core/backend
..\..\..\.venv\Scripts\python.exe manage.py shell -c "
from market_serving.models import SymbolSnapshot
from django.utils.timezone import now
latest = SymbolSnapshot.objects.order_by('-fetched_at').first()
age = (now() - latest.fetched_at).seconds
print(f'latest: {latest.symbol} age: {age}s')
print('PASS' if age < 90 else 'WARN stale')
"
Pop-Location
```

**Output thực tế**:
```
latest: VCB age: 45s
PASS
```

**Result**: ✅ PASS

---

## 3. Smoke test table

| Test | Result | Note |
|------|--------|------|
| Beat schedule entry | ✅ PASS | key `ingest-price-board-60s` present |
| SymbolSnapshot fresh | ✅ PASS | age = 45s |
| core-beat logs no error | ✅ PASS | task ran, upserted 50 rows |

---

## 5. Docker stack health

```
NAMES                       STATUS
vninvest-core-api-1         Up 10 minutes
vninvest-core-beat-1        Up 3 minutes    ← rebuilt for C1
vninvest-core-worker-1      Up 10 minutes
vninvest-frontend-1         Up 10 minutes
vninvest-redis-1            Up 10 minutes
vninvest-postgres-1         Up 10 minutes
```

Port 8000 check: `(empty)` — không exposed ✅

---

## 6. Residual risks

| Risk | Severity | Mitigation |
|------|---------|-----------|
| vnbroker_adapter mock data (không phải real market data) | LOW | Production sẽ cần integrate vnbroker library thật |
| SymbolSnapshot chỉ có top 50 symbols | LOW | StockProfile sẽ được expand sau |

---

## 7. Sign-off

- [x] Developer đã chạy C1-T1, C1-T2, C1-T3
- [x] Mandatory tests PASS
- [x] Docker stack healthy
- [x] Evidence committed

---

*End of template file*

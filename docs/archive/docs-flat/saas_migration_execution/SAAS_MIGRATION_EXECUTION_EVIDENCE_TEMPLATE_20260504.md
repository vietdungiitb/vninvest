# EXECUTION EVIDENCE TEMPLATE — SaaS Production Migration & Legacy Monolith Decommission

**Ngày**: 2026-05-04  
**Hướng dẫn**: Copy file này cho mỗi slice. Điền đầy đủ TRƯỚC khi đánh dấu task DONE trên taskboard.  
**Lưu tại**: `docs/evidence/SM-<SLICE_ID>-<date>.md`

---

## 1. Slice identity

- **Slice ID**: (ví dụ: SM-P0.1)
- **Ngày**: 
- **Owner**: 
- **Req IDs**: (từ Traceability Matrix — ví dụ: SM-REQ-01, SM-REQ-02)
- **Loại slice**: backend-infra / backend-domain / frontend / data-migration / shadow-run / security / infra / decommission / docs-only

---

## 2. Mục tiêu slice

- **Vấn đề cần giải quyết**:
- **Expected behavior trước slice**:
- **Expected behavior sau slice**:
- **Files dự kiến chạm**:

---

## 3. Danh sách file thực tế đã thay đổi

| File | Loại thay đổi | Ghi chú |
|---|---|---|
| (path/to/file.py) | new / modified / deleted | |
| | | |

---

## 4. Validation commands và kết quả

Ghi **từng command** với **output thực tế**. Không được ghi "đã chạy và PASS" mà không có output.

```
COMMAND: 
OUTPUT:
RESULT: PASS / FAIL
```

```
COMMAND: 
OUTPUT:
RESULT: PASS / FAIL
```

```
COMMAND: 
OUTPUT:
RESULT: PASS / FAIL
```

---

## 5. Payload snapshots (bắt buộc nếu slice chạm API contract)

### 5.1 Request/response snapshot

```json
// Request
GET /core/v1/...
Authorization: Bearer <PAT>

// Response
{
  "data": {},
  "meta": {
    "source": "...",
    "freshness_ts": "...",
    "is_complete": true
  }
}
```

### 5.2 Source field verify

- `meta.source` value:  
- Expected: `facts-first` / `materializer` / `cache-hit` / `legacy-fallback`  
- Actual: 

---

## 6. Data migration evidence (bắt buộc nếu là data-migration slice)

### 6.1 Migration command output

```
DRY RUN:
COMMAND: python manage.py migrate_<domain> --dry-run
OUTPUT: (paste actual output)

EXECUTE:
COMMAND: python manage.py migrate_<domain> --execute
OUTPUT: (paste actual output with record counts)
```

### 6.2 Parity verification

```
COMMAND: python manage.py migrate_<domain> --verify-parity
OUTPUT:
  Legacy count: N
  Core count: M
  Parity: XX.X%
  
THRESHOLD: >= 99.0%
RESULT: PASS / FAIL
```

### 6.3 Manual sample verification (10 records random)

| Legacy ID | Legacy value | Core ID | Core value | Match |
|---|---|---|---|---|
| | | | | ✓ / ✗ |

---

## 7. Shadow run evidence (bắt buộc nếu là shadow-run slice)

### 7.1 Shadow duration

- Start date: 
- End date: 
- Trade days covered: (minimum 3 bắt buộc)

### 7.2 Parity metrics

```
COMMAND: docker compose logs core-worker --since=72h | grep "SHADOW_PARITY" | <parse>
OUTPUT:
  Count: N data points
  Min parity: XX.X%
  Average parity: XX.X%
  Days below 99%: N

THRESHOLD: avg >= 99.0%, no day below 98%
RESULT: PASS / FAIL
```

### 7.3 Anomaly review

- Có log bất thường không? (NaN, negative, timeout):
- Action nếu có:

---

## 8. Security evidence (bắt buộc nếu là security slice)

### 8.1 Vulnerability verification — BEFORE

```
COMMAND: (kiểm tra behavior cũ)
OUTPUT: (minh chứng vulnerability tồn tại trước fix)
```

### 8.2 Fix verification — AFTER

```
COMMAND: (kiểm tra behavior sau fix)
OUTPUT: (minh chứng vulnerability đã được fix)
```

### 8.3 Regression test

```
TEST: <test_class.test_method>
OUTPUT:
RESULT: PASS
```

---

## 9. UI evidence (bắt buộc nếu là frontend slice)

### 9.1 Build output

```
COMMAND: npm run build
OUTPUT: (last 20 lines)
ERRORS: 0
WARNINGS: (list nếu có)
```

### 9.2 Runtime verification

- Screenshot/video: (attach hoặc link)
- Route tested: 
- API data hiển thị từ: `core-api` / `legacy` 
- Console errors: 0 / (list nếu có)

### 9.3 i18n verification

```
COMMAND: grep -r "t(" src/pages/<PageName>.jsx | wc -l
OUTPUT: N (số lần dùng i18n function)

COMMAND: grep -rn "['\"]tiếng Việt" src/pages/<PageName>.jsx
OUTPUT: (phải empty — không có hardcode string)
```

---

## 10. Performance evidence (bắt buộc nếu slice chạm load path)

### 10.1 Baseline timing (trước slice)

```
Symbol: VNM
Session date: <date>
Command: curl -w "@infra/curl-format.txt" ...
p50: Xms
p95: Xms
Source: (legacy-raw / facts-first / cache)
```

### 10.2 After timing (sau slice)

```
Symbol: VNM
Session date: <date>
Command: curl -w "@infra/curl-format.txt" ...
p50: Xms
p95: Xms
Source: (phải là facts-first hoặc cache-hit)
Improvement: X% faster
```

---

## 11. Infrastructure evidence (bắt buộc nếu là infra slice)

### 11.1 Service health

```
COMMAND: docker compose ps
OUTPUT: (tất cả services Up)
```

### 11.2 Connectivity test

```
COMMAND: (test endpoint hoặc connection)
OUTPUT:
RESULT: PASS
```

---

## 12. Pre-decommission gates (chỉ cho Phase 6 slices)

> Tất cả gates phải PASS và có evidence trước khi Tech Lead sign-off.

| Gate | Verification command | Result | Evidence |
|---|---|---|---|
| **Gate A** — Data parity >= 99% | `python scripts/verify_migration_parity.py --domain=all` | PASS/FAIL | (link) |
| **Gate B** — All API endpoints covered | `bash scripts/smoke_test_core_api.sh` | PASS/FAIL | (link) |
| **Gate C** — Zero legacy traffic | `grep "backend:8000" /var/log/nginx/access.log \| wc -l` | PASS(0)/FAIL | (link) |
| **Gate D** — Zero Sentry critical 72h | Sentry dashboard | PASS/FAIL | (screenshot) |
| **Gate E** — Backup restore PASS | `bash scripts/test_backup_restore.sh` | PASS/FAIL | (link) |
| **Gate F** — p95 < 200ms at 500 VUs | `k6 run infra/load-tests/api-load.js` | PASS/FAIL | (report) |
| **Gate G** — Zero legacy Celery tasks | `docker compose exec core-redis redis-cli keys "celery*" \| wc -l` | PASS(0)/FAIL | (link) |

**Tech Lead sign-off**: _______________  
**Date**: _______________

---

## 13. Residual risk note

- Vấn đề chưa giải quyết trong slice này:
- Rủi ro nếu không xử lý:
- Task ID để follow up:
- Deadline đề xuất:

---

## 14. Audit sync checklist

- [ ] `docs/CODE_CHANGE_AUDIT_LEDGER.md` đã có row mới với slice ID, files changed, date
- [ ] `PROGRESS_DASHBOARD.md` đã update status của task tương ứng
- [ ] Runtime stack đã refresh nếu slice chạm UI/runtime
- [ ] Evidence file đã lưu tại `docs/evidence/SM-<SLICE_ID>-<date>.md`
- [ ] PR description link đến evidence file này

---

## Ví dụ điền cho SM-P0.1

> Đây là ví dụ tham khảo. Điền theo format này.

**Slice ID**: SM-P0.1  
**Ngày**: 2026-05-05  
**Owner**: Backend Lead  
**Req IDs**: SM-REQ-01, SM-REQ-02  
**Loại slice**: backend-infra  

**Validation command 1**:
```
COMMAND: docker compose exec core-api python manage.py shell -c "
from market_serving.materializers import materialize_symbol_snapshot
result = materialize_symbol_snapshot()
print(result)
assert result['upserted'] > 0
print('PASS')
"
OUTPUT: {'status': 'ok', 'upserted': 756, 'duration_ms': 234}
PASS
RESULT: PASS
```

**Payload snapshot**:
```json
GET /core/v1/market/symbol-snapshot/?symbol=VNM
{
  "data": {
    "symbol": "VNM",
    "last_price": "82500.00",
    "total_volume": 1234567,
    "price_change_pct": "0.61",
    "session_date": "2026-05-05"
  },
  "meta": {
    "source": "materializer",
    "freshness_ts": "2026-05-05T09:30:00Z",
    "is_complete": true
  }
}
```

**Files changed**:
- `packages/core/backend/src/market_serving/materializers.py` — modified (SQL rewrite)
- `packages/core/backend/tests/test_saas14_materializers.py` — modified (add test cases)

**Residual risk**: SessionFacts JSONB extraction assumes field names stable in `portfolio_advisoryaggregatesnapshot.state_json`. If schema changes, materializer will return null values.  
**Follow-up task**: SM-P3.4 (advisory domain migration will replace this materializer path)

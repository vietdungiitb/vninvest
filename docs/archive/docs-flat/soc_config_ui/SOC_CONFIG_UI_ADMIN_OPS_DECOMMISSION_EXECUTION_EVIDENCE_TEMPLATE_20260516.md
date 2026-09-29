# EXECUTION EVIDENCE TEMPLATE — SOC Config UI Upgrade & Admin-Ops Decommission

**Ngày**: 2026-05-16  
**Hướng dẫn**: Copy template này cho mỗi slice, điền evidence trước khi đánh dấu DONE trong TASKBOARD.

---

## Template Slice (copy cho mỗi slice)

```markdown
## Evidence: Slice [ID] — [Tên slice]
**Ngày thực hiện**: YYYY-MM-DD  
**Thực hiện bởi**: [tên/agent]  
**Commit**: [hash]  
**Branch**: dev  

### 1. Files thay đổi
| File | Loại thay đổi |
|------|--------------|
| ... | Modified / Created / Deleted |

### 2. Validation command và kết quả
```powershell
[paste command]
```
Output:
```
[paste output]
```
Expected: [describe expected]
Actual: ✓ PASS / ✗ FAIL + mô tả

### 3. Build check
```
npm run build output snippet
```
Exit code: 0 / non-zero

### 4. Screenshot/payload snapshot
[Mô tả hoặc paste payload JSON nếu là API call]

### 5. Residual risk
[Mô tả nếu còn risk, hoặc "Không có"]
```

---

## Evidence: Slice S5-BE — Screener Rule Backend

**Ngày thực hiện**: ___________  
**Thực hiện bởi**: ___________  
**Commit**: ___________

### 1. Files thay đổi
| File | Loại thay đổi |
|------|--------------|
| `packages/core/backend/src/service_ops/views/screener.py` | Modified — thêm 2 views |
| `packages/core/backend/src/service_ops/urls.py` | Modified — thêm 2 paths |
| `packages/core/backend/src/service_ops/tests/test_screener_rule_crud.py` | Created |

### 2. Validation command và kết quả
```powershell
Push-Location ./backend
../.venv/Scripts/python.exe manage.py test service_ops.tests.test_screener_rule_crud --keepdb -v 2
Pop-Location
```
Output:
```
[paste here]
```
Expected: `Ran 5 tests in ...s OK`  
Actual: ___________

### 3. Residual risk
___________

---

## Evidence: Slice S1 — PrefetchPanel

**Ngày thực hiện**: ___________  
**Thực hiện bởi**: ___________  
**Commit**: ___________

### 1. Files thay đổi
| File | Loại thay đổi |
|------|--------------|
| `frontend/src/components/soc/PrefetchPanel.jsx` | Modified — refactor |
| `frontend/src/i18n/vi.js` | Modified — thêm keys |
| `frontend/src/i18n/en.js` | Modified — thêm keys |

### 2. Build check
```
[npm run build output snippet]
```
Exit code: ___

### 3. API payload snapshot — save config
```json
{
  "config_payload": {
    "batch_size": 20,
    "...": "..."
  }
}
```
Response: ___________

### 4. Warm Now test
```
curl /api/soc/prefetch/warm-now/?mode=async
Response: [paste]
```

### 5. Screenshot
Mô tả: Form PrefetchPanel với 11 inputs điền đúng giá trị từ API.

### 6. Residual risk
___________

---

## Evidence: Slice S3 — DataOps Backfill

**Ngày thực hiện**: ___________  
**Commit**: ___________

### 1. Files thay đổi
| File | Loại thay đổi |
|------|--------------|
| `frontend/src/components/soc/DataOpsPanel.jsx` | Modified — thêm BackfillCenterSection |
| `frontend/src/i18n/vi.js`, `en.js` | Modified |

### 2. Dry-run payload snapshot
```json
{
  "symbols": [],
  "datasets": ["daily_prices"],
  "mode": "missing_only",
  "force_refresh": false
}
```
Response preview: ___________

### 3. Run backfill result
```
task_id: ___________
status: ___________
```

### 4. Residual risk
___________

---

## Evidence: Slice S5-FE — ScreenerPanel CRUD

**Ngày thực hiện**: ___________  
**Commit**: ___________

### 1. Files thay đổi
| File | Loại thay đổi |
|------|--------------|
| `frontend/src/components/soc/ScreenerPanel.jsx` | Refactor toàn bộ |
| `frontend/src/api/socApi.js` | Modified — fix contract + 3 new functions |
| `frontend/src/i18n/vi.js`, `en.js` | Modified |

### 2. Contract fix verification
```
Network DevTools: POST /api/soc/screener/manual-scan/
Request payload: {"symbols": ["VNM"]}   ← phải có symbols, KHÔNG phải rule_ids
```
Verified: ___________

### 3. Rule CRUD cycle
```
Create: rule_id = ___
Update: HTTP 200 ✓
Delete: HTTP 204 ✓
```

### 4. Pagination test
```
Page 1: [X] rules
Page 2: [Y] rules
```

### 5. Residual risk
___________

---

## Evidence: Slice S2 — VnbrokerPanel

**Ngày thực hiện**: ___________  
**Commit**: ___________

### 1. Files thay đổi
| File | Loại thay đổi |
|------|--------------|
| `frontend/src/components/soc/VnbrokerPanel.jsx` | Modified |
| `frontend/src/i18n/vi.js`, `en.js` | Modified |

### 2. Benchmark result snapshot
```json
{
  "provider": "KBS",
  "latency_ms": ___,
  "success_rate": ___,
  "rate_limit_hits": ___,
  "timestamp": "___"
}
```

### 3. Residual risk
___________

---

## Evidence: Slice S4 — SOCPage Tabs

**Ngày thực hiện**: ___________  
**Commit**: ___________

### 1. Files thay đổi
| File | Loại thay đổi |
|------|--------------|
| `frontend/src/pages/SOCPage.jsx` | Modified |
| `frontend/src/components/soc/SOCDomainTabs.jsx` | Modified |

### 2. Tab routing test
```
?tab=vnbroker → VnbrokerPanel renders: ✓/✗
?tab=runtime-kpi → RuntimeKPIPanel renders: ✓/✗
6 tabs cũ còn hoạt động: ✓/✗
```

---

## Evidence: Gate D1 — Parity Verification

**Ngày thực hiện**: ___________  
**Thực hiện bởi**: Tech Lead

### D1 check results
```
[1] Prefetch config load: ✓/✗
[2] Warm Now async: ✓/✗
[3] DataOps dry-run: ✓/✗
[4] Screener config: ✓/✗
[5] Manual scan (symbols): ✓/✗
[6a] Create rule: ✓/✗
[6b] Update rule: ✓/✗
[6c] Delete rule (204): ✓/✗
[7] VnBroker config: ✓/✗
[8] Build PASS: ✓/✗
[9] Stack health: ✓/✗
[10] Tabs count: ✓/✗
```

**GATE DECISION**: PASS / FAIL  
Sign-off: ___________

---

## Evidence: Phase D2 — Backend Decommission

**Ngày thực hiện**: ___________  
**Commit**: ___________

### Files thay đổi
| File | Loại thay đổi |
|------|--------------|
| `backend/config/urls.py` | Modified — 35 routes → 410 handler |

### 410 verification
```
/api/admin-ops/stats/             → ___ (expected: 410)
/api/admin-ops/runtime-kpi/       → ___ (expected: 410)
/api/admin-ops/vnbroker-config/current/ → ___ (expected: 410)
/api/admin-ops/prefetch/config/   → ___ (expected: 410)
/api/admin-ops/signals/config/    → ___ (expected: 410)
/api/soc/overview/                → ___ (expected: 200)
```

---

## Evidence: Phase D3 — Frontend Cleanup

**Ngày thực hiện**: ___________  
**Commit**: ___________

### Files thay đổi
| File | Loại thay đổi |
|------|--------------|
| `frontend/src/api/client.js` | Modified — xóa 15 bridge functions |
| `frontend/src/App.jsx` | Modified — xóa admin-ops routes |

### Grep clean check
```
grep "admin-ops" frontend/src/api/client.js → [0 matches] ✓/✗
npm run build exit 0 ✓/✗
./start_dev.ps1 stack healthy ✓/✗
```

### Residual risk
___________

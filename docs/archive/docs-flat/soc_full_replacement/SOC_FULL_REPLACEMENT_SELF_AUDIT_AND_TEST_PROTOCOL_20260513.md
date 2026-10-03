# SOC Full Replacement — Self Audit & Test Protocol
**Ngày**: 2026-05-13  
**Status**: Mandatory  
**Parent**: `docs/SOC_FULL_REPLACEMENT_HANDOFF_MASTER_20260513.md`

---

## 1. Mục tiêu

Tài liệu này là protocol kiểm tra bắt buộc **sau mỗi task** và **trước khi merge**. Mọi reviewer / AI agent thực thi task phải chạy đủ các bước dưới đây và ghi lại kết quả.

---

## 2. Self-Audit Checklist Per Task

### SA-01: Code Quality (sau mỗi backend task)

```powershell
# Chạy từ backend directory
cd "C:\Mujoco Projects\vninvest\backend"

# 1. Syntax check
../.venv/Scripts/python.exe manage.py check --deploy 2>&1 | head -20

# 2. No except: pass
../.venv/Scripts/python.exe -c "
import ast, sys, pathlib
found = []
for f in pathlib.Path('packages/core/backend/src/vninvest_core/service_ops').rglob('*.py'):
    src = f.read_text()
    if 'except:' in src or 'except Exception: pass' in src:
        found.append(str(f))
if found:
    print('FAIL - except:pass found in:', found)
    sys.exit(1)
else:
    print('PASS - no except:pass')
"

# 3. Imports check (no direct vnbroker import)
grep -r "from vnbroker" packages/core/backend/src/vninvest_core/service_ops/
grep -r "import vnbroker" packages/core/backend/src/vninvest_core/service_ops/
# Expected: no output
```

**Pass criteria**:
- `manage.py check` → 0 errors
- Không có `except:` hay `except Exception: pass` trong service_ops/
- Không có direct vnbroker imports

---

### SA-02: Migration Health

```powershell
../.venv/Scripts/python.exe manage.py showmigrations service_ops
../.venv/Scripts/python.exe manage.py migrate service_ops --check
# Expected: "[X]" next to all migrations, no pending
```

**Pass criteria**:
- Tất cả migrations có `[X]`
- `--check` exit code 0

---

### SA-03: Unit Tests

```powershell
../.venv/Scripts/python.exe -m pytest packages/core/backend/tests/test_soc_*.py \
  -v \
  --cov=vninvest_core.service_ops \
  --cov-report=term-missing \
  --tb=short 2>&1 | tail -30
```

**Pass criteria**:
- 0 failures
- 0 errors
- Coverage ≥ 80%

---

### SA-04: Frontend Build (sau mỗi frontend task)

```powershell
cd "C:\Mujoco Projects\vninvest\frontend"
npm run build 2>&1 | Select-String -Pattern "error|Error|ERROR" | Where-Object { $_ -notmatch "errorboundary|ErrorBoundary" }
```

**Pass criteria**:
- Build exit code 0
- Không có unresolved import errors
- Không có undefined variable warnings trên soc/ components

---

### SA-05: i18n Completeness

```powershell
# Kiểm tra tất cả soc.* keys trong vi.json
../.venv/Scripts/python.exe -c "
import json
vi = json.load(open('frontend/src/i18n/vi.json'))
soc = vi.get('soc', {})
required_keys = [
    'title', 'tab.overview', 'tab.signals', 'tab.dataops', 'tab.prefetch', 'tab.screener', 'tab.matrix',
    'service.status.healthy', 'service.status.degraded', 'service.status.unhealthy',
    'ownership.mode.canonical', 'ownership.mode.native-write', 'ownership.writeBlocked',
    'config.apply', 'config.preview', 'config.applySuccess', 'config.confirmTitle',
    'matrix.cycle', 'matrix.progress', 'matrix.cell.done', 'matrix.cell.failed',
]
missing = []
for key in required_keys:
    parts = key.split('.')
    obj = soc
    for p in parts:
        if not isinstance(obj, dict) or p not in obj:
            missing.append(f'soc.{key}')
            break
        obj = obj[p]
if missing:
    print('FAIL - Missing i18n keys:', missing)
else:
    print('PASS - All i18n keys present')
"
```

**Pass criteria**: PASS — tất cả required keys có trong vi.json

---

### SA-06: Ownership Matrix Integrity

```powershell
../.venv/Scripts/python.exe -c "
from vninvest_core.service_ops.ownership import ServiceOwnershipMatrix

# Test tất cả 4 domains
for domain in ['vnbroker', 'prefetch', 'signals', 'screener']:
    info = ServiceOwnershipMatrix.get_domain_ownership(domain)
    assert 'domain' in info, f'Missing domain key for {domain}'
    assert 'mode' in info, f'Missing mode key for {domain}'
    assert 'can_apply' in info, f'Missing can_apply key for {domain}'
    assert 'writer' in info, f'Missing writer key for {domain}'
    print(f'{domain}: mode={info[\"mode\"]} can_apply={info[\"can_apply\"]}')

# Signals phải có write_block_reason vì là bridge-write
reason = ServiceOwnershipMatrix.get_write_block_reason('signals')
assert reason is not None, 'signals should have write block reason'
print('PASS - Ownership matrix OK')
"
```

---

### SA-07: API Contract Spot Check

```powershell
# Chạy server trước, sau đó test các endpoints
# (Dùng token từ gen_token.py hoặc /api/auth/token/)

$TOKEN = "your_token_here"

# Overview endpoint
$resp = Invoke-WebRequest -Uri "http://localhost:8001/api/soc/overview/" `
  -Headers @{Authorization="Bearer $TOKEN"} -UseBasicParsing
$data = $resp.Content | ConvertFrom-Json
Write-Host "overview.summary.total:", $data.summary.total
Write-Host "overview.by_domain keys:", ($data.by_domain | Get-Member -MemberType NoteProperty).Name

# Signals ownership
$resp2 = Invoke-WebRequest -Uri "http://localhost:8001/api/soc/signals/ownership/" `
  -Headers @{Authorization="Bearer $TOKEN"} -UseBasicParsing
$ownership = $resp2.Content | ConvertFrom-Json
Write-Host "signals.can_apply:", $ownership.can_apply
# Expected: False

# 401 check
$resp401 = Invoke-WebRequest -Uri "http://localhost:8001/api/soc/overview/" `
  -UseBasicParsing -ErrorAction SilentlyContinue
Write-Host "Unauthenticated status:", $resp401.StatusCode
# Expected: 401
```

---

## 3. Fitness-to-Purpose Scenarios

### Scenario SOC-F1: Operator apply vnbroker config với timeout sai

**Tình huống**: Operator nhập `timeout.read = 1.0` (dưới min 5.0) → API phải trả 400 rõ ràng.

**Kiểm tra**:
```powershell
$body = '{"timeout": {"read": 1.0, "connect": 10.0}}' | ConvertTo-Json
Invoke-WebRequest -Uri "http://localhost:8001/api/soc/vnbroker/config/apply/" `
  -Method POST -Body $body -ContentType "application/json" `
  -Headers @{Authorization="Bearer $TOKEN"} -UseBasicParsing
# Expected: 400 với field_errors.timeout.read có message
```

**Pass criteria**: 400 với `field_errors.timeout.read` có message tiếng Việt.

---

### Scenario SOC-F2: Operator cố ghi signals config từ SOC (bridge-write domain)

**Tình huống**: Signals domain là bridge-write — SOC không được ghi trực tiếp.

**Kiểm tra**:
```powershell
$body = '{"whale_detection": {"enabled": true, "min_value_threshold": 10000000}}' | ConvertTo-Json
Invoke-WebRequest -Uri "http://localhost:8001/api/soc/signals/config/apply/" `
  -Method POST -Body $body -ContentType "application/json" `
  -Headers @{Authorization="Bearer $TOKEN"} -UseBasicParsing
# Expected: 403 với write_block_reason rõ ràng
```

**Pass criteria**: 403 với `write_block_reason` giải thích domain là bridge-write.

---

### Scenario SOC-F3: Matrix cycle — 2 workers race cùng cell

**Tình huống**: 2 Celery workers cùng claim cell (G1, vci) → chỉ 1 thành công.

**Kiểm tra** (unit test):
```python
# test_soc_matrix.py
def test_matrix_no_double_claim():
    coordinator = MatrixCoordinator('test_cycle_001', ['vci'])
    coordinator.create_cycle(['G1'])
    
    with ThreadPoolExecutor(max_workers=2) as executor:
        futures = [executor.submit(coordinator.try_claim_cell, 'G1', 'vci', f'w{i}') for i in range(2)]
        results = [f.result() for f in futures]
    
    assert results.count(True) == 1  # Chỉ 1 claim thành công
    claimed_cell = ScrapeMatrixCell.objects.get(matrix__cycle_id='test_cycle_001', symbol_group_id='G1', provider='vci')
    assert claimed_cell.status == 'claimed'
```

---

### Scenario SOC-F4: Frontend WriteGuardBanner hiện đúng khi signals domain

**Tình huống**: Khi mở tab Tín hiệu, nếu API trả `can_apply=False`, WriteGuardBanner phải hiển thị.

**Kiểm tra** (manual browser):
1. Mở `/operations-center?tab=signals`
2. Verify: WriteGuardBanner hiển thị với text tiếng Việt giải thích write-block
3. Verify: Button "Áp dụng cấu hình" bị disabled hoặc ẩn

---

### Scenario SOC-F5: MatrixScrapeMonitor poll và update heatmap

**Tình huống**: MatrixScrapeMonitor poll mỗi 5s và cập nhật màu cell đúng.

**Kiểm tra** (manual browser):
1. Mở `/operations-center?tab=matrix`
2. Click "Bắt đầu chu kỳ mới"
3. Verify: heatmap grid hiện
4. Verify: cells chuyển màu (pending=slate → working=amber → done=emerald)
5. Verify: progress bar cập nhật

---

## 4. Regression Checks

Sau mỗi task backend, chạy regression test cho Admin-Ops hiện tại:

```powershell
# Admin-Ops endpoints không được bị break
$endpoints = @(
    "http://localhost:8001/api/admin-ops/stats/",
    "http://localhost:8001/api/admin-ops/signals/summary/",
    "http://localhost:8001/api/admin-ops/vnbroker-config/",
)
foreach ($url in $endpoints) {
    $resp = Invoke-WebRequest -Uri $url -Headers @{Authorization="Bearer $TOKEN"} -UseBasicParsing
    Write-Host "$url → $($resp.StatusCode)"
    # Expected: 200 cho tất cả
}
```

**Pass criteria**: Tất cả Admin-Ops endpoints vẫn trả 200 sau khi thêm service_ops.

---

## 5. Pre-Merge Final Checklist

```
[ ] SA-01 PASS — không except:pass, không direct vnbroker import
[ ] SA-02 PASS — migrations clean
[ ] SA-03 PASS — tests ≥ 80% coverage, 0 failures
[ ] SA-04 PASS — npm build 0 errors
[ ] SA-05 PASS — i18n đầy đủ
[ ] SA-06 PASS — ownership matrix integrity
[ ] SA-07 PASS — API contract spot check
[ ] Scenarios SOC-F1 đến SOC-F5 manually verified
[ ] Admin-Ops regression check PASS
[ ] CODE_CHANGE_AUDIT_LEDGER.md updated
[ ] TASKBOARD_SOC_FULL_REPLACEMENT_20260513.md updated
[ ] module_tree_full.md regenerated
[ ] Committed to dev branch
```

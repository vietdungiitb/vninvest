# SOC Full Replacement — Run Spec Audit
**Ngày**: 2026-05-13  
**Status**: Mandatory  
**Trigger**: Trước khi đóng workstream, sau khi T10 pass  
**Parent**: `docs/SOC_FULL_REPLACEMENT_HANDOFF_MASTER_20260513.md`

---

## Mục tiêu

Spec Audit kiểm tra **traceability** — mọi requirement trong TECH_SPEC đều có implementation và test tương ứng. Sử dụng Traceability Matrix làm checklist.

---

## SPEC-AUDIT-01: Endpoint Count Verification

```powershell
# Đếm URLs đã implement
../.venv/Scripts/python.exe -c "
import django, os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest.settings')
django.setup()

from django.urls import reverse, NoReverseMatch
import re

# Load urls.py và đếm
content = open('packages/core/backend/src/vninvest_core/service_ops/urls.py').read()
url_count = len(re.findall(r\"path\('\", content))
print(f'SOC URL patterns found: {url_count}')
# Expected: 40
if url_count >= 38:
    print('PASS: Endpoint count meets spec (>=38/40)')
else:
    print(f'FAIL: Only {url_count} endpoints, spec requires 38+')
"
```

---

## SPEC-AUDIT-02: Domain Coverage Check

```powershell
# Kiểm tra tất cả 6 domains có views
$domains = @('overview', 'vnbroker', 'prefetch', 'signals', 'screener', 'matrix')
foreach ($domain in $domains) {
    $viewFile = "packages/core/backend/src/vninvest_core/service_ops/views/$domain.py"
    if (Test-Path $viewFile) {
        Write-Host "PASS: $domain views exist"
    } else {
        Write-Host "FAIL: $domain views NOT found"
    }
}

# Kiểm tra 4 domain config files
$configs = @('vnbroker', 'prefetch', 'signals', 'screener')
foreach ($cfg in $configs) {
    $cfgFile = "packages/core/backend/src/vninvest_core/service_ops/domain_configs/$cfg.py"
    if (Test-Path $cfgFile) {
        Write-Host "PASS: $cfg domain config exists"
    } else {
        Write-Host "FAIL: $cfg domain config NOT found"
    }
}
```

---

## SPEC-AUDIT-03: Model Fields Completeness

```powershell
../.venv/Scripts/python.exe -c "
import django, os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest.settings')
django.setup()

from vninvest_core.service_ops.models import (
    ServiceDefinition, ServiceConfig, ServiceHealth, 
    ServiceRunLog, OwnershipRecord, ConfigChangeAudit
)

# Check ServiceDefinition fields
svc_fields = {f.name for f in ServiceDefinition._meta.get_fields()}
required = {'service_key', 'name', 'domain', 'owner_team', 'is_active', 'is_deprecated', 'created_at', 'updated_at'}
missing = required - svc_fields
if missing:
    print(f'FAIL ServiceDefinition missing fields: {missing}')
else:
    print('PASS ServiceDefinition fields')

# Check OwnershipRecord has is_writable method
assert hasattr(OwnershipRecord, 'is_writable'), 'OwnershipRecord missing is_writable()'
assert hasattr(OwnershipRecord, 'get_write_block_reason'), 'OwnershipRecord missing get_write_block_reason()'
print('PASS OwnershipRecord methods')

# Check ConfigChangeAudit has request_id
ca_fields = {f.name for f in ConfigChangeAudit._meta.get_fields()}
assert 'request_id' in ca_fields, 'ConfigChangeAudit missing request_id'
print('PASS ConfigChangeAudit fields')
"
```

---

## SPEC-AUDIT-04: Ownership Matrix Completeness

```powershell
../.venv/Scripts/python.exe -c "
from vninvest_core.service_ops.ownership import ServiceOwnershipMatrix

domains = ['vnbroker', 'prefetch', 'signals', 'screener']
for domain in domains:
    info = ServiceOwnershipMatrix.get_domain_ownership(domain)
    required_keys = {'domain', 'mode', 'writer', 'can_apply', 'locked_fields', 'write_surface'}
    missing = required_keys - set(info.keys())
    if missing:
        print(f'FAIL {domain}: missing keys {missing}')
    else:
        print(f'PASS {domain}: mode={info[\"mode\"]} can_apply={info[\"can_apply\"]}')

# Signals must be non-writable
assert not ServiceOwnershipMatrix.is_domain_writable('signals'), 'signals must not be writable from SOC'
print('PASS signals write-block enforced')

# VNBroker must be writable
assert ServiceOwnershipMatrix.is_domain_writable('vnbroker'), 'vnbroker must be writable'
print('PASS vnbroker writable')
"
```

---

## SPEC-AUDIT-05: Frontend Components Completeness

```powershell
$requiredComponents = @(
    'frontend/src/components/soc/ServiceHealthCard.jsx',
    'frontend/src/components/soc/OwnershipBadgeRow.jsx',
    'frontend/src/components/soc/WriteGuardBanner.jsx',
    'frontend/src/components/soc/ConfigPreviewModal.jsx',
    'frontend/src/components/soc/MatrixScrapeMonitor.jsx',
    'frontend/src/components/soc/SOCDomainTabs.jsx',
    'frontend/src/components/soc/index.js',
    'frontend/src/components/soc/panels/SOCOverviewPanel.jsx',
    'frontend/src/components/soc/panels/SOCSignalsPanel.jsx',
    'frontend/src/components/soc/panels/SOCDataOpsPanel.jsx',
    'frontend/src/components/soc/panels/SOCPrefetchPanel.jsx',
    'frontend/src/components/soc/panels/SOCScreenerPanel.jsx',
    'frontend/src/components/soc/panels/SOCMatrixPanel.jsx',
    'frontend/src/pages/SOCPage.jsx',
    'frontend/src/api/socApi.js'
)

$missing = @()
foreach ($f in $requiredComponents) {
    if (-not (Test-Path $f)) {
        $missing += $f
        Write-Host "FAIL: NOT FOUND $f"
    } else {
        Write-Host "PASS: $f"
    }
}

if ($missing.Count -eq 0) {
    Write-Host "`nSPEC-AUDIT-05 PASS: All $($requiredComponents.Count) frontend files present"
} else {
    Write-Host "`nSPEC-AUDIT-05 FAIL: $($missing.Count) files missing"
}
```

---

## SPEC-AUDIT-06: Traceability Matrix Sync

Mở `docs/SOC_FULL_REPLACEMENT_TRACEABILITY_MATRIX_20260513.md` và kiểm tra:

```
[ ] REQ-01 đến REQ-40 đều có implementation file ghi rõ
[ ] REQ-01 đến REQ-31 đều có test file ghi rõ
[ ] HC-01 đến HC-12 đều có enforcement point ghi rõ
[ ] GAP-01 đến GAP-07 đều đã giải quyết
[ ] Test coverage map: tất cả module có coverage target đã đạt
```

---

## SPEC-AUDIT-07: OpenAPI Constitution Compliance

```powershell
../.venv/Scripts/python.exe -c "
import pathlib, re

# Scan views/ cho potential issues
issues = []
view_dir = pathlib.Path('packages/core/backend/src/vninvest_core/service_ops/views')
for f in view_dir.rglob('*.py'):
    text = f.read_text()
    lines = text.splitlines()
    
    for i, line in enumerate(lines, 1):
        # R5: No except: pass
        if line.strip() in ('except:', 'except Exception: pass'):
            issues.append(f'{f}:{i} R5_VIOLATION: except:pass')
        
        # R4: Error responses should use standard format
        if 'Response({\"error\"' in line or \"Response({'error'\" in line:
            issues.append(f'{f}:{i} R4_WARNING: Non-standard error response')
        
        # R3: 200 for errors
        if 'status=200' in line and ('error' in line.lower() or 'fail' in line.lower()):
            issues.append(f'{f}:{i} R3_WARNING: Potential 200 for error')

if issues:
    for issue in issues:
        print(issue)
    print(f'SPEC-AUDIT-07 FAIL: {len(issues)} violations found')
else:
    print('SPEC-AUDIT-07 PASS: No OpenAPI constitution violations')
"
```

---

## SPEC-AUDIT-08: Hard Constraints Final Check

```
[ ] HC-01 PASS: grep "from vnbroker" service_ops/ → 0 results
[ ] HC-02 PASS: Mọi domain view trả ownership dict trong response
[ ] HC-03 PASS: WriteGuardBanner render khi can_apply=False (manual verify)
[ ] HC-04 PASS: ConfigApplyMixin gọi config.validate() trước save
[ ] HC-05 PASS: grep "from 'antd'" components/soc/ → 0 results
[ ] HC-06 PASS: SA-05 i18n completeness PASS
[ ] HC-07 PASS: try_claim_cell dùng select_for_update
[ ] HC-08 PASS: Error envelope đủ fields trên mọi error path
[ ] HC-09 PASS: grep "except:" service_ops/ → 0 results
[ ] HC-10 PASS: Tất cả list endpoints có pagination
[ ] HC-11 PASS: ConfigChangeAudit tạo sau mỗi apply
[ ] HC-12 PASS: SOCBaseView.permission_classes = [IsAuthenticated, IsAdminUser]
```

---

## SPEC-AUDIT-09: Production Readiness Gates

```
Gate 1 — Build:       docker compose up --build core-api → [ ] PASS
Gate 2 — Migrations:  manage.py migrate service_ops → [ ] PASS (0 conflicts)
Gate 3 — Tests:       pytest test_soc_*.py → [ ] PASS (≥ 80% coverage)
Gate 4 — OpenAPI:     SPEC-AUDIT-07 → [ ] PASS
Gate 5 — Browser:     /operations-center loads → [ ] PASS
Gate 6 — Governance:  CODE_CHANGE_AUDIT_LEDGER.md updated → [ ] PASS

PRODUCTION READY: [ ] YES (all 6 gates pass) / [ ] NO (gates failing: ...)
```

---

## Spec Audit Sign-Off Template

```
# SOC Full Replacement — Spec Audit Sign-Off

Date: ___________
Auditor: ___________

SPEC-AUDIT-01 Endpoint count: [ ] PASS / [ ] FAIL
SPEC-AUDIT-02 Domain coverage: [ ] PASS / [ ] FAIL
SPEC-AUDIT-03 Model fields: [ ] PASS / [ ] FAIL
SPEC-AUDIT-04 Ownership matrix: [ ] PASS / [ ] FAIL
SPEC-AUDIT-05 Frontend completeness: [ ] PASS / [ ] FAIL
SPEC-AUDIT-06 Traceability sync: [ ] PASS / [ ] FAIL
SPEC-AUDIT-07 OpenAPI compliance: [ ] PASS / [ ] FAIL
SPEC-AUDIT-08 Hard constraints: [ ] PASS / [ ] FAIL
SPEC-AUDIT-09 Production gates: [ ] PASS / [ ] FAIL

Residual risks:
1. ___________
2. ___________

Decision: [ ] APPROVED FOR PRODUCTION / [ ] BLOCKED (reasons above)
```

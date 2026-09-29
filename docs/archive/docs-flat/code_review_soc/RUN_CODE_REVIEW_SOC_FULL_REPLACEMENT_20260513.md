# SOC Full Replacement — Run Code Review Protocol
**Ngày**: 2026-05-13  
**Status**: Mandatory  
**Trigger**: Sau mỗi task hoàn thành, trước mỗi PR merge  
**Parent**: `docs/SOC_FULL_REPLACEMENT_HANDOFF_MASTER_20260513.md`

---

## Mục tiêu

Runbook này hướng dẫn reviewer thực hiện code review đầy đủ cho service_ops backend và soc frontend. Thực hiện theo thứ tự từ trên xuống dưới.

---

## Bước 1: Static Analysis

```powershell
cd "C:\Mujoco Projects\vninvest\backend"

# 1.1 Django check
../.venv/Scripts/python.exe manage.py check
# Expected: "System check identified no issues"

# 1.2 Check no except:pass
../.venv/Scripts/python.exe -c "
import pathlib, sys
issues = []
for f in pathlib.Path('packages/core/backend/src/vninvest_core/service_ops').rglob('*.py'):
    lines = f.read_text().splitlines()
    for i, line in enumerate(lines, 1):
        stripped = line.strip()
        if stripped in ('except:', 'except Exception: pass', 'except: pass'):
            issues.append(f'{f}:{i}: {line}')
if issues:
    for i in issues: print('FAIL:', i)
    sys.exit(1)
print('PASS: No bare except')
"

# 1.3 Check no direct vnbroker imports
../.venv/Scripts/python.exe -c "
import pathlib, sys
issues = []
for f in pathlib.Path('packages/core/backend/src/vninvest_core/service_ops').rglob('*.py'):
    text = f.read_text()
    if 'from vnbroker' in text or 'import vnbroker' in text:
        issues.append(str(f))
if issues:
    for i in issues: print('FAIL: direct vnbroker import in', i)
    sys.exit(1)
print('PASS: No direct vnbroker imports')
"

# 1.4 Frontend check
cd "C:\Mujoco Projects\vninvest\frontend"
npm run build -- --mode production 2>&1 | Select-String "error|Error" | Where-Object { $_ -notmatch "errorboundary" }

# 1.5 Check no Ant Design in soc components
../.venv/Scripts/python.exe -c "
import pathlib, sys
issues = []
for f in pathlib.Path('frontend/src/components/soc').rglob('*.jsx'):
    text = f.read_text()
    if \"from 'antd'\" in text or 'from \"antd\"' in text:
        issues.append(str(f))
    if 'from @mui' in text or \"from '@mui'\" in text:
        issues.append(str(f))
if issues:
    for i in issues: print('FAIL: Ant Design/MUI import in', i)
    sys.exit(1)
print('PASS: No Ant Design imports')
"
```

**Kết quả expected**: Tất cả PASS

---

## Bước 2: Review Models

Mở `packages/core/backend/src/vninvest_core/service_ops/models.py` và kiểm tra:

```
[ ] ServiceDefinition có đủ 11 fields theo TECH_SPEC section 2.1
[ ] ServiceConfig.save() tự set is_current=False cho các records khác
[ ] ServiceHealth.STATUS_CHOICES có đủ 5 values
[ ] ServiceRunLog.STATUS_CHOICES có đủ 6 values
[ ] OwnershipRecord.is_writable() logic đúng với WRITABLE_MODES set
[ ] OwnershipRecord.get_write_block_reason() trả None khi writable
[ ] ConfigChangeAudit có request_id field
[ ] Tất cả models có Meta.ordering và indexes
[ ] Tất cả FK có on_delete=CASCADE hoặc on_delete=PROTECT đúng context
```

---

## Bước 3: Review Domain Configs

Mở `packages/core/backend/src/vninvest_core/service_ops/domain_configs/` và kiểm tra:

```
[ ] VnbrokerTimeoutConfig.validate() check bounds: connect[1-60], read[5-300]
[ ] VnbrokerDomainConfig.from_dict() không raise KeyError với missing optional fields (có defaults)
[ ] PrefetchTimePolicyConfig có đúng 6 profiles
[ ] TimePolicyProfile.validate() check interval_seconds bounds [30, 3600]
[ ] SignalServicesDomainConfig.validate() check hot_tier_days bounds [1, 30]
[ ] ScreenerDomainConfig.validate() check len(rules) <= 50
[ ] Tất cả validate() messages bằng tiếng Việt có dấu đầy đủ
```

---

## Bước 4: Review Ownership Matrix

Mở `packages/core/backend/src/vninvest_core/service_ops/ownership.py` và kiểm tra:

```
[ ] WRITABLE_MODES set có đúng 6 values: canonical, native-write, bridge-write, write-through, write-enabled, direct-writer
[ ] vnbroker domain: mode=native-write, can_apply=True
[ ] prefetch domain: mode=native-write, can_apply=True
[ ] signals domain: mode=bridge-write, can_apply=False, locked_fields không rỗng
[ ] screener domain: mode=native-write, can_apply=True
[ ] get_write_block_reason() trả None cho writable domain
[ ] get_write_block_reason() trả string tiếng Việt cho non-writable domain
[ ] Không có circular import từ admin_ops
```

---

## Bước 5: Review Views + Error Handling

Mở `packages/core/backend/src/vninvest_core/service_ops/views/base.py` và kiểm tra:

```
[ ] SOCBaseView.permission_classes = [IsAuthenticated, IsAdminUser]
[ ] handle_exception() wrap tất cả errors thành error envelope chuẩn
[ ] Error envelope có: detail, code, timestamp, request_id
[ ] get_request_id() lấy từ HTTP_X_REQUEST_ID header
[ ] Không có except: pass trong base view
```

Mở `views/mixins.py` và kiểm tra:

```
[ ] ConfigApplyMixin.apply_config() flow: validate → ownership check → save → audit
[ ] Ownership check xảy ra TRƯỚC khi save
[ ] ConfigChangeAudit được tạo SAU khi save thành công
[ ] field_errors được populate từ domain config validate()
```

---

## Bước 6: Review Frontend Components

Mở `frontend/src/components/soc/` và kiểm tra từng file:

```
ServiceHealthCard.jsx:
[ ] PropTypes đầy đủ với isRequired cho serviceKey, name, domain, status
[ ] STATUS_COLORS mapping đúng (5 statuses)
[ ] Text qua t() i18n calls

OwnershipBadgeRow.jsx:
[ ] canApply prop ảnh hưởng trực tiếp đến UI (disabled state hoặc visual indicator)
[ ] MODE_COLORS đúng 5 modes

WriteGuardBanner.jsx:
[ ] Banner không render khi reason = null
[ ] Background amber/warning, không success color
[ ] Hiển thị cả reason VÀ writeSurface

ConfigPreviewModal.jsx:
[ ] Disabled confirm button khi isSubmitting=true
[ ] Hiện impactWarnings nếu có
[ ] Hiện validationErrors nếu có

MatrixScrapeMonitor.jsx:
[ ] useEffect với poll interval, cleanup khi unmount
[ ] 6 cell status colors đúng
[ ] Progress indicator

SOCDomainTabs.jsx:
[ ] Tab key mapping đúng 6 tabs
[ ] Active tab highlighted
[ ] URL search param sync
```

---

## Bước 7: Review i18n

```powershell
# Chạy SA-05 từ Self Audit Protocol
../.venv/Scripts/python.exe -c "
import json
vi = json.load(open('frontend/src/i18n/vi.json'))
soc = vi.get('soc', {})
required = [
    'title', 'tab.overview', 'tab.signals', 'tab.dataops', 'tab.prefetch', 'tab.screener', 'tab.matrix',
    'service.status.healthy', 'service.status.degraded', 'service.status.unhealthy', 'service.status.unknown', 'service.status.maintenance',
    'ownership.mode.canonical', 'ownership.mode.native-write', 'ownership.mode.bridge-write', 'ownership.mode.read-only',
    'ownership.writeBlocked', 'ownership.writeBlockedHint',
    'config.apply', 'config.preview', 'config.applySuccess', 'config.applyFailed', 'config.confirmTitle', 'config.confirmMessage',
    'matrix.cycle', 'matrix.progress', 'matrix.startCycle', 'matrix.abortCycle',
    'matrix.cell.pending', 'matrix.cell.working', 'matrix.cell.done', 'matrix.cell.failed', 'matrix.cell.skipped',
    'health.checkNow', 'health.lastCheck', 'health.avgResponse',
    'signals.universePolicy', 'signals.retentionPolicy', 'signals.jobTrigger',
]
missing = []
for key in required:
    parts = key.split('.')
    obj = soc
    for p in parts:
        if not isinstance(obj, dict) or p not in obj:
            missing.append(f'soc.{key}')
            break
        obj = obj[p]
if missing:
    print('FAIL - Missing:', missing)
else:
    print('PASS - All i18n keys present (' + str(len(required)) + ' checked)')
"
```

---

## Bước 8: Chạy Unit Tests

```powershell
cd "C:\Mujoco Projects\vninvest\backend"
../.venv/Scripts/python.exe -m pytest packages/core/backend/tests/test_soc_*.py \
  -v --tb=short \
  --cov=vninvest_core.service_ops \
  --cov-report=term-missing \
  2>&1 | tail -40
# Expected: 0 failures, coverage ≥ 80%
```

---

## Bước 9: Admin-Ops Regression

```powershell
# Chạy existing Admin-Ops tests để đảm bảo không regression
../.venv/Scripts/python.exe manage.py test \
  vninvest_core.contracts.admin_ops \
  --keepdb -v 2
# Expected: 0 failures
```

---

## Bước 10: Ghi Kết Quả

Sau khi review xong, cập nhật:
1. `docs/TASKBOARD_SOC_FULL_REPLACEMENT_20260513.md` — update task status
2. `CODE_CHANGE_AUDIT_LEDGER.md` — thêm entry với kết quả review
3. Comment PR: tất cả bước pass / danh sách items cần fix

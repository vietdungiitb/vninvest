# SOC Full Replacement — Execution Evidence Template
**Ngày**: 2026-05-13  
**Status**: Template — điền vào sau mỗi task  
**Parent**: `docs/SOC_FULL_REPLACEMENT_HANDOFF_MASTER_20260513.md`

---

## Template sử dụng

Copy section tương ứng vào `CODE_CHANGE_AUDIT_LEDGER.md` sau mỗi task. Điền đầy đủ — không để trống.

---

## Evidence: T01 — service_ops app + 6 Core Models

```
Date: ___________
Task: T01
Status: [ ] DONE / [ ] PARTIAL / [ ] BLOCKED

### Files Changed
| File | Action | Lines Changed |
|------|--------|---------------|
| packages/core/backend/src/vninvest_core/service_ops/__init__.py | CREATE | - |
| packages/core/backend/src/vninvest_core/service_ops/apps.py | CREATE | - |
| packages/core/backend/src/vninvest_core/service_ops/models.py | CREATE | ___ |
| packages/core/backend/src/vninvest_core/service_ops/migrations/0001_initial.py | CREATE | - |
| (settings file) | MODIFY | +1 |

### Validation Output
manage.py check:
```
(paste output here)
```

manage.py migrate service_ops:
```
(paste output here)
```

### Commit
SHA: ___________
Message: "SOC-T01: service_ops app + 6 core models"

### Residual Risk
___________
```

---

## Evidence: T02 — Domain Config Typed Schemas

```
Date: ___________
Task: T02
Status: [ ] DONE / [ ] PARTIAL / [ ] BLOCKED

### Files Changed
| File | Action | Lines Changed |
|------|--------|---------------|
| service_ops/domain_configs/__init__.py | CREATE | - |
| service_ops/domain_configs/vnbroker.py | CREATE | ___ |
| service_ops/domain_configs/prefetch.py | CREATE | ___ |
| service_ops/domain_configs/signals.py | CREATE | ___ |
| service_ops/domain_configs/screener.py | CREATE | ___ |

### Validation Output
```
(paste python -c "from domain_configs import *; print('PASS')" output)
```

### Commit
SHA: ___________
Message: "SOC-T02: domain config typed schemas (4 dataclasses)"
```

---

## Evidence: T03 — ServiceOwnershipMatrix

```
Date: ___________
Task: T03
Status: [ ] DONE / [ ] PARTIAL / [ ] BLOCKED

### Files Changed
| File | Action | Lines Changed |
|------|--------|---------------|
| service_ops/ownership.py | CREATE | ___ |

### Validation Output
```
(paste ownership matrix test output)
vnbroker writable: True
prefetch writable: True
signals writable: False
signals block reason: (string)
```

### Commit
SHA: ___________
Message: "SOC-T03: ServiceOwnershipMatrix + ownership constants"
```

---

## Evidence: T04 — Serializers + Base Views + URLs

```
Date: ___________
Task: T04
Status: [ ] DONE / [ ] PARTIAL / [ ] BLOCKED

### Files Changed
| File | Action | Lines Changed |
|------|--------|---------------|
| service_ops/serializers.py | CREATE | ___ |
| service_ops/views/__init__.py | CREATE | - |
| service_ops/views/base.py | CREATE | ___ |
| service_ops/views/overview.py | CREATE | ___ |
| service_ops/urls.py | CREATE | ___ |
| (contracts router file) | MODIFY | +3 |

### Validation Output
```
(paste curl /api/soc/overview/ → 200 response)
(paste curl /api/soc/overview/ unauthenticated → 401)
```

### Commit
SHA: ___________
Message: "SOC-T04: serializers + base views + overview endpoints (6 URLs)"
```

---

## Evidence: T05 — Domain Views

```
Date: ___________
Task: T05
Status: [ ] DONE / [ ] PARTIAL / [ ] BLOCKED

### Files Changed
| File | Action | Lines Changed |
|------|--------|---------------|
| service_ops/views/mixins.py | CREATE | ___ |
| service_ops/views/vnbroker.py | CREATE | ___ |
| service_ops/views/prefetch.py | CREATE | ___ |
| service_ops/views/signals.py | CREATE | ___ |
| service_ops/views/screener.py | CREATE | ___ |

### Validation Output
```
VNBroker config apply invalid → 400 with field_errors: (paste)
Signals config apply → 403 with write_block_reason: (paste)
Signals ownership → can_apply=False: (paste)
```

### Commit
SHA: ___________
Message: "SOC-T05: domain views for vnbroker/prefetch/signals/screener (33 endpoints)"
```

---

## Evidence: T06 — ScrapeMatrix + MatrixCoordinator

```
Date: ___________
Task: T06
Status: [ ] DONE / [ ] PARTIAL / [ ] BLOCKED

### Files Changed
| File | Action | Lines Changed |
|------|--------|---------------|
| service_ops/models_matrix.py | CREATE | ___ |
| service_ops/matrix_coordinator.py | CREATE | ___ |
| service_ops/tasks.py | CREATE | ___ |
| service_ops/views/matrix.py | CREATE | ___ |
| migrations/0002_scrape_matrix.py | CREATE | - |

### Validation Output
```
Migration output: (paste)
Cycle create test: (paste - cells=N×M)
Atomic claim concurrency: results=[True, False] (paste)
Mark done + skip peers: (paste)
```

### Commit
SHA: ___________
Message: "SOC-T06: ScrapeMatrix models + MatrixCoordinator + matrix endpoints"
```

---

## Evidence: T07 — Frontend Base Components

```
Date: ___________
Task: T07
Status: [ ] DONE / [ ] PARTIAL / [ ] BLOCKED

### Files Changed
| File | Action | Lines Changed |
|------|--------|---------------|
| frontend/src/components/soc/ServiceHealthCard.jsx | CREATE | ___ |
| frontend/src/components/soc/OwnershipBadgeRow.jsx | CREATE | ___ |
| frontend/src/components/soc/WriteGuardBanner.jsx | CREATE | ___ |
| frontend/src/components/soc/ConfigPreviewModal.jsx | CREATE | ___ |
| frontend/src/components/soc/MatrixScrapeMonitor.jsx | CREATE | ___ |
| frontend/src/components/soc/SOCDomainTabs.jsx | CREATE | ___ |
| frontend/src/components/soc/index.js | CREATE | ___ |
| frontend/src/i18n/vi.json | MODIFY | +~80 |

### Validation Output
```
npm run build output: (paste last 5 lines)
i18n check: PASS - All i18n keys present
```

### Commit
SHA: ___________
Message: "SOC-T07: 6 frontend base components + soc.* i18n namespace"
```

---

## Evidence: T08 — SOC Page + Domain Panels + Route

```
Date: ___________
Task: T08
Status: [ ] DONE / [ ] PARTIAL / [ ] BLOCKED

### Files Changed
| File | Action | Lines Changed |
|------|--------|---------------|
| frontend/src/api/socApi.js | CREATE | ___ |
| frontend/src/pages/SOCPage.jsx | CREATE | ___ |
| frontend/src/components/soc/panels/SOCOverviewPanel.jsx | CREATE | ___ |
| frontend/src/components/soc/panels/SOCSignalsPanel.jsx | CREATE | ___ |
| frontend/src/components/soc/panels/SOCDataOpsPanel.jsx | CREATE | ___ |
| frontend/src/components/soc/panels/SOCPrefetchPanel.jsx | CREATE | ___ |
| frontend/src/components/soc/panels/SOCScreenerPanel.jsx | CREATE | ___ |
| frontend/src/components/soc/panels/SOCMatrixPanel.jsx | CREATE | ___ |
| frontend/src/App.jsx (or router) | MODIFY | +5 |

### Validation Output
```
npm run build: (paste last 5 lines)
Browser screenshot: /operations-center loaded (attach or describe)
WriteGuardBanner in signals tab: (describe what's visible)
```

### Commit
SHA: ___________
Message: "SOC-T08: SOCPage + 6 domain panels + /operations-center route"
```

---

## Evidence: T09 — Backend Tests

```
Date: ___________
Task: T09
Status: [ ] DONE / [ ] PARTIAL / [ ] BLOCKED

### Files Changed
| File | Action | Lines Changed |
|------|--------|---------------|
| tests/test_soc_models.py | CREATE | ___ |
| tests/test_soc_domain_configs.py | CREATE | ___ |
| tests/test_soc_ownership.py | CREATE | ___ |
| tests/test_soc_api_overview.py | CREATE | ___ |
| tests/test_soc_api_vnbroker.py | CREATE | ___ |
| tests/test_soc_api_signals.py | CREATE | ___ |
| tests/test_soc_matrix.py | CREATE | ___ |

### Test Results
```
pytest output:
(paste full test summary)
Coverage: ___% (target ≥ 80%)
```

### Commit
SHA: ___________
Message: "SOC-T09: backend tests (unit + integration, ___% coverage)"
```

---

## Evidence: T10 — Docker Build + Final Audit

```
Date: ___________
Task: T10
Status: [ ] DONE / [ ] PARTIAL / [ ] BLOCKED

### Docker Build
```
docker compose up --build core-api: (PASS/FAIL)
docker compose up --build frontend: (PASS/FAIL)
manage.py migrate service_ops: (paste output)
manage.py check: (paste output)
```

### Smoke Tests
```
GET /api/soc/overview/ → (status code + response size)
Browser /operations-center → (describe: tabs visible, loading state, etc.)
Admin-Ops regression: (admin-ops/stats/ → 200 ✓)
```

### Governance
- [ ] CODE_CHANGE_AUDIT_LEDGER.md updated (T01–T09 all entries)
- [ ] PROGRESS_DASHBOARD.md updated
- [ ] module_tree_full.md regenerated
- [ ] All pushed to dev branch

### Final commit
SHA: ___________
Message: "SOC-T10: docker build + final audit + governance docs update"
```

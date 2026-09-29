# SOC Full Replacement — Traceability Matrix
**Ngày**: 2026-05-13  
**Status**: Active  
**Parent**: `docs/SOC_FULL_REPLACEMENT_HANDOFF_MASTER_20260513.md`

---

## 1. Requirement → Implementation Tracing

| Req ID | Requirement | Implementation File(s) | Test File(s) | Status |
|--------|-------------|------------------------|--------------|--------|
| REQ-01 | 6 core service governance models | `service_ops/models.py` | `test_soc_models.py` | ✅✅ |
| REQ-02 | VnbrokerTimeoutConfig + VnbrokerDomainConfig typed schema | `domain_configs/vnbroker.py`, `domain_configs/__init__.py` | `test_soc_domain_configs.py`, `test_soc_api_domain.py` | ✅✅ |
| REQ-03 | PrefetchTimePolicyConfig typed schema | `domain_configs/prefetch.py` | `test_soc_domain_configs.py` | ✅✅ |
| REQ-04 | SignalServicesDomainConfig typed schema | `domain_configs/signals.py` | `test_soc_domain_configs.py` | ✅✅ |
| REQ-05 | ScreenerDomainConfig typed schema | `domain_configs/screener.py` | `test_soc_domain_configs.py` | ✅✅ |
| REQ-06 | ServiceOwnershipMatrix.is_domain_writable() | `service_ops/ownership.py` | `test_soc_ownership.py` | ✅✅ |
| REQ-07 | ServiceOwnershipMatrix.get_write_block_reason() | `service_ops/ownership.py` | `test_soc_ownership.py` | ✅✅ |
| REQ-08 | GET /api/soc/overview/ — health summary | `views/overview.py` | `test_soc_api_overview.py` | ✅✅ |
| REQ-09 | GET /api/soc/services/ — paginated list | `views/overview.py` | `test_soc_api_overview.py` | ✅✅ |
| REQ-10 | GET /api/soc/vnbroker/config/ | `views/vnbroker.py` | `test_soc_api_domain.py` | ✅✅ |
| REQ-11 | POST /api/soc/vnbroker/config/apply/ with validation | `views/vnbroker.py`, `domain_configs/vnbroker.py` | `test_soc_api_domain.py` | ✅✅ |
| REQ-12 | GET /api/soc/vnbroker/ownership/ | `views/vnbroker.py`, `ownership.py` | `test_soc_api_domain.py` | ✅✅ |
| REQ-13 | GET /api/soc/prefetch/config/ (6 profiles) | `views/prefetch.py` | `test_soc_api_domain.py` | ✅✅ |
| REQ-14 | POST /api/soc/prefetch/config/apply/ | `views/prefetch.py` | `test_soc_api_domain.py` | ✅✅ |
| REQ-15 | POST /api/soc/prefetch/warm-now/ | `views/prefetch.py` | `test_soc_api_domain.py` | ✅✅ |
| REQ-16 | GET /api/soc/signals/config/ | `views/signals.py` | `test_soc_api_signals.py` | ✅✅ |
| REQ-17 | POST /api/soc/signals/config/apply/ → 403 write-blocked | `views/signals.py`, `ownership.py` | `test_soc_api_signals.py` | ✅✅ |
| REQ-18 | GET /api/soc/signals/ownership/ (with locked_fields) | `views/signals.py`, `ownership.py` | `test_soc_api_signals.py` | ✅✅ |
| REQ-19 | GET /api/soc/signals/summary/ | `views/signals.py` | `test_soc_api_signals.py` | ✅✅ |
| REQ-20 | GET /api/soc/signals/retention-policy/ | `views/signals.py` | `test_soc_api_signals.py` | ✅✅ |
| REQ-21 | POST /api/soc/signals/materialization/preview/ | `views/signals.py` | `test_soc_api_signals.py` | ✅✅ |
| REQ-22 | GET /api/soc/screener/config/ | `views/screener.py` | `test_soc_api_domain.py` | ✅✅ |
| REQ-23 | POST /api/soc/screener/rules/run/ | `views/screener.py` | `test_soc_api_domain.py` | ✅✅ |
| REQ-24 | ScrapeMatrix + ScrapeMatrixCell models | `service_ops/models.py` | `test_soc_matrix.py` | ✅✅ |
| REQ-25 | MatrixCoordinator.try_claim_cell() atomic | `matrix_coordinator.py` | `test_soc_matrix.py` | ✅✅ |
| REQ-26 | MatrixCoordinator row dedup (skip on done) | `matrix_coordinator.py` | `test_soc_matrix.py` | ✅✅ |
| REQ-27 | POST /api/soc/matrix/cycles/start/ | `views/matrix.py` | `test_soc_matrix.py` | ✅✅ |
| REQ-28 | GET /api/soc/matrix/monitor/ (poll) | `views/matrix.py` | `test_soc_matrix.py` | ✅✅ |
| REQ-29 | Celery task: health_check_all_services | `tasks.py` | `test_soc_tasks.py` | ✅✅ |
| REQ-30 | Celery task: scrape_cell_task | `tasks.py` | `test_soc_tasks.py` | ✅✅ |
| REQ-31 | ConfigChangeAudit sau mỗi apply | `views/mixins.py` | `test_soc_api_domain.py` | ✅✅ |
| REQ-32 | ServiceHealthCard component (emerald/amber/rose colors) | `components/soc/ServiceHealthCard.jsx`, `components/soc/OverviewPanel.jsx` | `frontend/src/components/soc/SOCComponents.test.jsx` | ✅✅ |
| REQ-33 | OwnershipBadgeRow component (mode colors) | `components/soc/OwnershipBadgeRow.jsx`, `components/soc/SignalsPanel.jsx` | `frontend/src/components/soc/SOCComponents.test.jsx` | ✅✅ |
| REQ-34 | WriteGuardBanner component (amber, i18n) | `components/soc/WriteGuardBanner.jsx`, `components/soc/SignalsPanel.jsx` | `frontend/src/components/soc/SOCComponents.test.jsx` | ✅✅ |
| REQ-35 | ConfigPreviewModal (before/after diff, warnings) | `components/soc/ConfigPreviewModal.jsx`, `components/soc/VnbrokerPanel.jsx` | `frontend/src/components/soc/SOCComponents.test.jsx` | ✅✅ |
| REQ-36 | MatrixScrapeMonitor (heatmap, poll) | `components/soc/MatrixScrapeMonitor.jsx` | `frontend/src/components/soc/SOCComponents.test.jsx` | ✅✅ |
| REQ-37 | SOCDomainTabs (6 tabs, i18n) | `components/soc/SOCDomainTabs.jsx`, `pages/SOCPage.jsx` | `frontend/src/components/soc/SOCComponents.test.jsx`, `frontend/src/pages/SOCPage.test.jsx` | ✅✅ |
| REQ-38 | i18n namespace soc.* tiếng Việt đầy đủ | `i18n/vi.js` | `frontend/src/components/soc/SOCComponents.test.jsx` | ✅✅ |
| REQ-39 | Route /operations-center → SOCPage | `App.jsx`, `pages/SOCPage.jsx` | `frontend/src/App.test.jsx`, `frontend/src/pages/SOCPage.test.jsx` | ✅✅ |
| REQ-40 | Route /admin-ops → redirect /operations-center | `App.jsx` | `frontend/src/App.test.jsx` | ✅✅ |

**Legend**: ⬜ NOT STARTED | 🔄 IN PROGRESS | ✅ IMPLEMENTED | ✅✅ TESTED

---

## 2. Hard Constraint → Enforcement Tracing

| Constraint ID | Constraint (từ AGENTS.md / Handoff) | Enforcement Point | Test |
|---------------|-------------------------------------|-------------------|------|
| HC-01 | VnBroker SSOT — không direct import | `R-PY-09` trong Code Quality Constitution | `grep -r "from vnbroker" service_ops/` → 0 |
| HC-02 | Ownership Matrix trong mọi domain response | `views/mixins.py` OwnershipMixin | `test_soc_ownership.py` |
| HC-03 | Write Guard derive từ ownership API (FE) | `components/soc/SignalsPanel.jsx`, `components/soc/WriteGuardBanner.jsx` | `npm run build` |
| HC-04 | Typed Config validate() trước save | `views/mixins.py` ConfigApplyMixin | `test_soc_domain_configs.py` |
| HC-05 | Tailwind dark theme, không Ant Design | `components/soc/*.jsx` | `grep -r "from 'antd'" src/components/soc/` → 0 |
| HC-06 | i18n cho mọi text mới | `components/soc/*.jsx`, `pages/SOCPage.jsx`, `i18n/vi.js` | `npm run build` |
| HC-07 | select_for_update trong try_claim_cell | `matrix_coordinator.py` | `test_soc_matrix.py` concurrency test |
| HC-08 | Error envelope chuẩn {detail, code, timestamp, request_id} | `views/base.py` handle_exception() | `test_soc_api_overview.py` error path tests |
| HC-09 | Không except: pass | `R-PY-01` Code Quality Constitution | SA-01 grep scan |
| HC-10 | Pagination trên list endpoints | `views/base.py` StandardResultsSetPagination | `test_soc_api_overview.py` pagination tests |
| HC-11 | ConfigChangeAudit immutable trail | `views/mixins.py` ConfigApplyMixin | `test_soc_api_domain.py` |
| HC-12 | Auth: IsAuthenticated + IsAdminUser | `views/base.py` SOCBaseView | 401/403 tests trong mọi test file |

---

## 3. Gap Analysis (Admin-Ops → SOC)

| Gap # | Admin-Ops Strength | SOC Coverage | File Implementing |
|-------|--------------------|--------------|-------------------|
| GAP-01 | 4 typed config schemas | ✅ domain_configs/ (4 dataclasses + validate()) | `domain_configs/*.py` |
| GAP-02 | 10 signals-specific endpoints | ✅ 13 signals endpoints trong TECH_SPEC | `views/signals.py` |
| GAP-03 | Ownership dict trong mọi response | ✅ OwnershipMixin.get_ownership_context() | `views/mixins.py` |
| GAP-04 | Thực tế 27 Admin-Ops endpoints, không phải 50+ | ✅ Thiết kế 40 SOC endpoints có chủ đích | `urls.py` |
| GAP-05 | Ant Design clash | ✅ Tất cả components dùng Tailwind dark | `components/soc/*.jsx` |
| GAP-06 | Thiếu i18n | ✅ soc.* namespace đầy đủ trong vi.js | `i18n/vi.js` |
| GAP-07 (NEW) | Symbol Universe Matrix parallel scraping | ✅ ScrapeMatrix + MatrixCoordinator | `models_matrix.py`, `matrix_coordinator.py` |

---

## 4. Test Coverage Map

| Module | Target Coverage | Test Files | Priority |
|--------|----------------|------------|----------|
| `service_ops/models.py` | 90% | `test_soc_models.py` | HIGH |
| `service_ops/domain_configs/*.py` | 95% | `test_soc_domain_configs.py` | CRITICAL |
| `service_ops/ownership.py` | 95% | `test_soc_ownership.py` | CRITICAL |
| `service_ops/views/overview.py` | 85% | `test_soc_api_overview.py` | HIGH |
| `service_ops/views/vnbroker.py` | 85% | `test_soc_api_domain.py` | HIGH |
| `service_ops/views/signals.py` | 90% | `test_soc_api_signals.py` | CRITICAL (write-block) |
| `service_ops/views/prefetch.py` | 80% | `test_soc_api_domain.py` | MEDIUM |
| `service_ops/views/screener.py` | 80% | `test_soc_api_domain.py` | MEDIUM |
| `service_ops/matrix_coordinator.py` | 90% | `test_soc_matrix.py` | HIGH (concurrency) |
| `service_ops/views/matrix.py` | 80% | `test_soc_matrix.py` | HIGH |
| `service_ops/tasks.py` | 75% | `test_soc_tasks.py` | MEDIUM |
| `service_ops/views/mixins.py` | 90% | included in domain tests | HIGH |

**Overall target**: ≥ 80% coverage toàn service_ops app.

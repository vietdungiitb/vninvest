# SOC Full Replacement — Handoff Master
**Ngày**: 2026-05-13  
**Status**: Approved for execution  
**Scope**: Thay thế Admin-Ops bằng Service Operations Center (SOC) thống nhất, kế thừa toàn bộ Admin-Ops strengths, bổ sung Symbol Matrix Parallel Scraping  
**SSOT policy**:
- `docs/CORE_API_OPENAPI_FUNCTION_DESIGN_CONSTITUTION_20260513.md`
- `docs/CORE_API_OPENAPI_PR_GATE_CHECKLIST_20260513.md`
- `quality/QUALITY.md`

---

## 1. Mục tiêu

Bàn giao cho đội code một gói thực thi đầy đủ để:

1. Xây dựng Django app `service_ops` với **6 core models + 4 domain config models + 2 matrix models** — SSOT cho toàn bộ service governance.
2. Expose **35–40 REST endpoints** theo chuẩn OpenAPI: domain contracts riêng biệt cho VNBroker / Prefetch / Signals / Screener + Matrix scraping.
3. Kế thừa và nâng cấp toàn bộ logic **Ownership Matrix** từ Admin-Ops cũ — không bỏ write-guard, không bỏ preview diff.
4. Xây **Symbol Universe Matrix** song song đa provider — tăng throughput 2–4x, đảm bảo dedup bằng atomic claim.
5. Xây **6 frontend components** Tailwind dark theme với i18n tiếng Việt đầy đủ dấu.
6. Viết **unit tests + integration tests** coverage ≥ 80%.
7. Đạt trạng thái **production-ready**: Docker build clean, 0 migration conflicts, 0 type errors.

---

## 2. Mandatory policies

Tất cả thay đổi BAT BUỘC tuân theo:
- `docs/CORE_API_OPENAPI_FUNCTION_DESIGN_CONSTITUTION_20260513.md` — contract-first, typed schema, error envelope chuẩn
- `docs/CORE_API_OPENAPI_PR_GATE_CHECKLIST_20260513.md` — 6 gates: Design, Security, Reliability, Performance, Testing, Governance
- `AGENTS.md` section 10 — OpenAPI hard constraints
- `AGENTS.md` section 11 — VnBroker data access SSOT

Không pass gate → không merge.

---

## 3. Deliverables trong gói bàn giao

| # | Tài liệu | Đường dẫn |
|---|----------|-----------|
| 1 | Implementation Plan | `docs/IMPLEMENTATION_PLAN_SOC_FULL_REPLACEMENT_20260513.md` |
| 2 | Technical Spec | `docs/TECH_SPEC_SOC_FULL_REPLACEMENT_20260513.md` |
| 3 | Taskboard | `docs/TASKBOARD_SOC_FULL_REPLACEMENT_20260513.md` |
| 4 | Traceability Matrix | `docs/SOC_FULL_REPLACEMENT_TRACEABILITY_MATRIX_20260513.md` |
| 5 | Self Audit & Test Protocol | `docs/SOC_FULL_REPLACEMENT_SELF_AUDIT_AND_TEST_PROTOCOL_20260513.md` |
| 6 | Code Quality Constitution | `docs/SOC_FULL_REPLACEMENT_CODE_QUALITY_CONSTITUTION_20260513.md` |
| 7 | Run Code Review | `docs/RUN_CODE_REVIEW_SOC_FULL_REPLACEMENT_20260513.md` |
| 8 | Run Integration Tests | `docs/RUN_INTEGRATION_TESTS_SOC_FULL_REPLACEMENT_20260513.md` |
| 9 | Run Spec Audit | `docs/RUN_SPEC_AUDIT_SOC_FULL_REPLACEMENT_20260513.md` |
| 10 | Execution Evidence Template | `docs/SOC_FULL_REPLACEMENT_EXECUTION_EVIDENCE_TEMPLATE_20260513.md` |

---

## 4. Kiến trúc tổng quan

```
┌─────────────────────────────────────────────────────────────────┐
│  SOC Frontend (React 19 + Tailwind dark)                         │
│  ┌─────────────┬──────────────┬────────────┬──────────────────┐  │
│  │ ServiceHealth│ OwnershipBadge│ConfigPreview│MatrixScrapeMonitor│  │
│  │ Card        │ Row + Write  │ Modal (diff │ (heatmap poll)  │  │
│  │             │ GuardBanner  │ + impact)   │                 │  │
│  └─────────────┴──────────────┴────────────┴──────────────────┘  │
│  SOCDomainTabs: Overview | Tín hiệu | DataOps | Prefetch | Screener | Matrix │
└────────────────────────────────┬────────────────────────────────┘
                                 │ /api/soc/
┌────────────────────────────────▼────────────────────────────────┐
│  SOC Backend (Django + DRF)                                      │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  service_ops app (packages/core/backend/)                 │    │
│  │  ├── models.py (ServiceDefinition, Config, Health, Run)  │    │
│  │  ├── domain_configs/ (4 typed schemas + validation)      │    │
│  │  ├── ownership.py (ServiceOwnershipMatrix)               │    │
│  │  ├── models_matrix.py (ScrapeMatrix, ScrapeMatrixCell)   │    │
│  │  ├── matrix_coordinator.py (MatrixCoordinator)           │    │
│  │  ├── views/ (domain viewsets + mixin)                    │    │
│  │  ├── serializers.py                                      │    │
│  │  ├── urls.py (35–40 endpoints)                           │    │
│  │  ├── tasks.py (health check, scrape cycle)               │    │
│  │  └── tests/ (unit + integration)                         │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                   │
│  Domain Bridges (kế thừa Admin-Ops ownership model)              │
│  ├── signals → bridge-write to legacy SSOT (existing)           │
│  ├── vnbroker → native-write (existing VnbrokerRuntimeConfig)   │
│  ├── prefetch → native-write (existing PrefetchTimePolicyConfig) │
│  └── screener → native-write (existing GlobalScreenerConfig)    │
└─────────────────────────────────────────────────────────────────┘
                                 │
┌────────────────────────────────▼────────────────────────────────┐
│  Symbol Universe Matrix (Celery parallel)                        │
│  ┌────────────────────────────────────────────────────────┐      │
│  │  N Symbol Groups × M Providers                         │      │
│  │                                                         │      │
│  │        VCI    KBS    TCBS   SSI                         │      │
│  │  G1   [DONE] [SKIP] [SKIP] [SKIP]                       │      │
│  │  G2   [FAIL] [DONE] [SKIP] [SKIP]   ← reassignment     │      │
│  │  G3   [WORK] [    ] [    ] [    ]                       │      │
│  │  G4   [PEND] [    ] [    ] [    ]                       │      │
│  │                                                         │      │
│  │  MatrixCoordinator → dispatch → scrape_cell_task        │      │
│  │  monitor_scrape_cycle → reassign_failed → check_done    │      │
│  └────────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Hard constraints

1. **VnBroker SSOT**: Mọi fetch từ vnbroker phải qua `market_data.vnbroker_adapter` — tuyệt đối không import trực tiếp `vnbroker.*`.
2. **Ownership Matrix**: Mọi domain response PHẢI có field `ownership` — không simplify thành `enabled=True/False`.
3. **Write Guard**: Frontend phải derive write capability từ `ownership.domains.*.status` — không hardcode.
4. **Typed Config**: Mỗi domain phải có typed dataclass riêng với `validate()` method — không dùng raw JSON blob.
5. **Tailwind dark theme**: Tuyệt đối không dùng Ant Design / MUI / Chakra UI — phải nhất quán với app hiện tại.
6. **i18n**: Mọi text mới phải qua `useI18n()` với key `soc.*` — không hardcode string.
7. **Atomic claim**: `ScrapeMatrixCell.try_claim()` phải dùng `select_for_update` — không có race condition.
8. **Error envelope**: Mọi error response phải theo chuẩn `{detail, code, timestamp, request_id, field_errors}`.
9. **No except pass**: Cấm `except: pass` và `except Exception: pass` trong mọi API path.
10. **Pagination**: Mọi list endpoint phải có pagination (default page_size=20, max=100).

---

## 6. Tích hợp với hệ thống hiện tại

| Hệ thống hiện tại | Điểm tích hợp | Hành động |
|-------------------|---------------|-----------|
| `contracts/admin_ops/views.py` | Import signals ownership config | SOC kế thừa constants; không sửa admin_ops |
| `market_data/vnbroker_adapter.py` | MatrixCoordinator gọi fetch functions | Import qua adapter SSOT, không direct |
| `signal_intelligence/models.py` | SOC signals domain reads UnifiedAlert, WhaleAlertCanonical | Read-only, không modify |
| `market_serving/models.py` | SOC reads SessionFacts, SymbolSnapshot | Read-only |
| `frontend/src/api/client.js` | Frontend gọi SOC endpoints | Thêm SOC API functions vào client.js |
| `frontend/src/i18n/` | SOC i18n keys | Thêm namespace `soc.*` vào vi.json |
| `docker-compose.dev.yml` | service_ops migrations | Chạy trong core-api container |

---

## 7. Definition of "Production Ready"

Đạt trạng thái production-ready khi **TẤT CẢ** các gate sau pass:

```
Gate 1 — Build
  ✅ docker compose -f docker-compose.dev.yml up -d --build core-api → exit 0
  ✅ npm run build (frontend) → exit 0, 0 warnings về imports

Gate 2 — Migrations  
  ✅ python manage.py migrate service_ops → không có conflict
  ✅ python manage.py check → 0 errors

Gate 3 — Tests
  ✅ pytest packages/core/backend/tests/test_soc_*.py → ≥ 80% coverage
  ✅ npm test -- --runTestsByPath src/components/soc/ → 0 failures

Gate 4 — OpenAPI compliance
  ✅ Tất cả 35–40 endpoints có request + response schema
  ✅ Error envelope đúng format trên tất cả error paths
  ✅ Không còn except: pass trong views/

Gate 5 — Browser smoke
  ✅ /operations-center load thành công
  ✅ ServiceHealthCard hiện đúng 23 services
  ✅ MatrixScrapeMonitor poll và update heatmap
  ✅ WriteGuardBanner hiện khi signal domain read-preview

Gate 6 — Governance
  ✅ CODE_CHANGE_AUDIT_LEDGER.md cập nhật
  ✅ PROGRESS_DASHBOARD.md cập nhật
  ✅ module_tree_full.md regenerated
```

---

## 8. Team roles và phân công

| Role | Trách nhiệm | Artifact |
|------|-------------|---------|
| Backend Lead | Phase 1 models, Phase 2 domain configs, Phase 3 matrix | models.py, domain_configs/, models_matrix.py |
| Backend Dev | Phase 4 REST API views + serializers + tests | views/, serializers.py, tests/ |
| Frontend Dev | Phase 5 components + i18n + domain panels | components/soc/, pages/SOC.jsx |
| DevOps | Phase 6 Docker build + migration validation | docker-compose.dev.yml |
| QA | Phase 7 integration tests + browser smoke | tests/integration/, evidence/ |

---

## 9. Liên kết tài liệu liên quan

- Kế hoạch gốc (đã bổ sung Supplement A): `docs/IMPLEMENTATION_PLAN_SOC_FULL_REPLACEMENT_OPTION1_20260512.md`
- OpenAPI Constitution: `docs/CORE_API_OPENAPI_FUNCTION_DESIGN_CONSTITUTION_20260513.md`
- PR Gate Checklist: `docs/CORE_API_OPENAPI_PR_GATE_CHECKLIST_20260513.md`
- Admin-Ops hiện tại: `packages/core/backend/src/vninvest_core/contracts/admin_ops/`
- Frontend Admin-Ops: `frontend/src/components/adminops/`

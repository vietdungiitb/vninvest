# Code Quality Constitution: Django API Routing Cleanup — `/core/v1/` Standardization

**Program:** DJANGO_API_ROUTING_CLEANUP  
**Date Stamp:** 20260616  
**Version:** 1.0  
**Authority:** Derived from `quality/QUALITY.md` and `AGENTS.md` hard rules  

---

## 1. Coverage Targets per Subsystem

| Subsystem | Line Coverage | Branch Coverage | Mutation Score | Rationale |
|-----------|---------------|-----------------|----------------|-----------|
| `identity_access` | ≥ 90% | ≥ 85% | ≥ 70% | Auth/security critical; merged routes from api_urls |
| `signal_intelligence` | ≥ 85% | ≥ 80% | ≥ 65% | Alert/whale feed core; api_urls deleted |
| `user_workspace` | ≥ 85% | ≥ 80% | ≥ 65% | Portfolio/watchlist core; legacy stubs removed |
| `market_serving` | ≥ 80% | ≥ 75% | ≥ 60% | Real-time data; legacy bridge views removed |
| `market_data` | ≥ 80% | ≥ 75% | ≥ 60% | Stock management; public_urls decision pending |
| `commercial` | ≥ 85% | ≥ 80% | ≥ 65% | Billing/payments; unchanged |
| `advisory` | ≥ 85% | ≥ 80% | ≥ 65% | AI advisory; unchanged |
| `ops_audit` | ≥ 80% | ≥ 75% | ≥ 60% | Audit logging; unchanged |
| `support` | ≥ 80% | ≥ 75% | ≥ 60% | Tickets; duplicate mount removed |
| `advertising` | ≥ 80% | ≥ 75% | ≥ 60% | Ad tracking; unchanged |
| `data_ingest` | ≥ 80% | ≥ 75% | ≥ 60% | Ingestion jobs; unchanged |
| **Overall Backend** | ≥ 80% | ≥ 75% | ≥ 60% | Aggregate |
| **Frontend (packages/web)** | ≥ 75% | ≥ 70% | N/A | Migration surface area |

---

## 2. Coverage Theater Prevention Rules

| Rule ID | Rule | Enforcement | Violation = |
|---------|------|-------------|-------------|
| CTP-01 | **No mock-only tests** — every test must assert real behavior (status code, response shape, side effect) | CI: `grep -r "Mock\|mock" tests/ \| grep -v "assert\|expect"` → flag | Block merge |
| CTP-02 | **No trivial assertions** — `assertTrue(True)`, `assertEqual(1, 1)`, `assertIsNotNone(response)` without content check | CI: AST pattern match | Block merge |
| CTP-03 | **Integration over unit for routing** — test actual URL resolution + view dispatch, not just `reverse()` | CI: Require `Client().get('/core/v1/...')` in routing tests | Block merge |
| CTP-04 | **Coverage delta gate** — PR must not decrease coverage on modified files | CI: `coverage diff` | Block merge |
| CTP-05 | **Dead code detection** — unused imports, unreachable routes, orphaned urlpatterns | CI: `vulture` or `pyflakes` on routing files | Warning |

---

## 3. Fitness-to-Purpose Scenarios (Mandatory Validation)

Each scenario must have at least one passing test (integration or E2E) at Final Gate.

| Scenario ID | Description | Test Type | Apps Involved | Phase |
|-------------|-------------|-----------|---------------|-------|
| **FTP-01** | **Tenant Isolation**: Tenant A cannot read Tenant B's portfolio via `/core/v1/workspace/portfolios/` | Integration | `user_workspace`, `identity_access` | 1, 3 |
| **FTP-02** | **Auth Required**: Unauthenticated request to `/core/v1/auth/me` returns 401 with error envelope | Integration | `identity_access` | 0, 3 |
| **FTP-03** | **Public Health**: `/core/v1/health` returns 200 without any headers/auth | Smoke | `vninvest_core` | All |
| **FTP-04** | **Pagination Contract**: `/core/v1/workspace/portfolios/?limit=5` returns cursor envelope with `next_cursor` + `has_more` | Integration | `user_workspace` | 1, 3 |
| **FTP-05** | **Error Envelope**: Invalid symbol `/core/v1/stock-management/stocks/INVALID/` returns 404 with `{error: {code, message, details}}` | Integration | `market_data` | 2, 3 |
| **FTP-06** | **Frontend Login Flow**: End-to-end login via `/core/v1/auth/login` → sets cookies → `/core/v1/auth/me` works | E2E | Frontend, `identity_access` | 1, 3 |
| **FTP-07** | **Partner Self-Service**: Tenant owner accesses `/core/v1/partner/billing/subscription` and sees own data only | Integration | `commercial`, `identity_access` | 0, 3 |
| **FTP-08** | **Real-time Data**: `/core/v1/realtime/ticker/VCB` returns live price data with timestamp < 5s old | Staging/Manual | `market_serving` | 2, 3 |
| **FTP-09** | **Advisory Refresh**: POST `/core/v1/advisory/refresh/VCB` triggers generation and returns session ID | Integration | `advisory` | 3 |
| **FTP-10** | **Whale Analytics**: `/core/v1/workspace/whale-analytics/VCB` returns structured analytics (not empty stub) | Integration | `user_workspace`, `signal_intelligence` | 1, 3 |
| **FTP-11** | **Symbol Investigation**: `/core/v1/realtime/symbol-investigation/VCB` returns investigation data (preserved from api_urls) | Integration | `market_serving` | 2, 3 |
| **FTP-12** | **Backward Compat**: `/core/v1/operator/mail-config/` (singular) and `/core/v1/operator/mail-configs/` (plural) both work | Integration | `identity_access` | 0, 3 |

---

## 4. Code Style & Architecture Rules

| Rule ID | Rule | Scope | Tool |
|---------|------|-------|------|
| AR-01 | **No logic in urls.py** — only `path()`/`include()` declarations | All routing files | Manual review |
| AR-02 | **Views in views/ or views_*.py** — not in urls.py, not in models.py | All apps | `grep -r "class.*View" packages/core/backend/src/*/urls.py` → 0 |
| AR-03 | **Serializers in serializers.py** — not inline in views | All apps | Manual review |
| AR-04 | **Permissions explicit** — every view declares `permission_classes` | All `/core/v1/` views | `grep -L "permission_classes" packages/core/backend/src/*/views.py` → flag |
| AR-05 | **OpenAPI annotations** — every view has `@extend_schema` or serializer with `Meta` | All `/core/v1/` views | `drf-spectacular --validate` |
| AR-06 | **No duplicate route logic** — single canonical route per function | All routing | Route diff script (Checklist A-01) |
| AR-07 | **Legacy code removal** — no `GenericEmpty*`, `Legacy*`, `*Stub` views in production urls.py | `user_workspace`, `identity_access` | `grep -r "GenericEmpty\|Legacy" packages/core/backend/src/*/urls.py` → 0 |
| AR-08 | **Consistent naming** — `snake_case` for URL paths, `kebab-case` for route names | All urls.py | Manual review |

---

## 5. Technical Debt Budget

| Category | Current Debt | This Program | Post-Program Budget |
|----------|--------------|--------------|---------------------|
| Duplicate routes | 9 apps with `/api/` duplicates | **Eliminated** (Phase 0-2) | 0 |
| Legacy stub views | ~20 in `user_workspace/urls.py` | **Eliminated** (Phase 1) | 0 |
| Dead api_urls files | 3 (`identity_access`, `signal_intelligence`, `market_serving`) | **Eliminated** (Phase 0, 2) | 0 |
| Duplicate mounts | 4 in root urls.py | **Eliminated** (Phase 0) | 0 |
| Baseline test bugs | 2 mock patches wrong | **Fixed** (Phase 0) | 0 |
| **Total** | **High** | **Zero** | **Zero** |

**Post-Program Rule:** Any new duplicate route or legacy stub introduced = immediate blocker.

---

## 6. Definition of Done (Quality Gate)

A slice/PR is **Done** only when:

- [ ] All Checklist A-E checks pass (Self-Audit Protocol)
- [ ] Coverage targets met for modified subsystems
- [ ] No Coverage Theater Prevention violations
- [ ] All Fitness-to-Purpose scenarios for scope have passing tests
- [ ] All Architecture Rules (AR-01 to AR-08) satisfied
- [ ] Zero new technical debt introduced
- [ ] Execution Evidence Template completed and signed
- [ ] Governance artifacts updated (if Final Gate)

---

*Part of 12-document handoff pack. See HANDOFF_MASTER for index.*
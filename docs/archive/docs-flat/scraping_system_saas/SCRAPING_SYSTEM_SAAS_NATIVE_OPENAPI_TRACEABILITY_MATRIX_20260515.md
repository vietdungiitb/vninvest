# TRACEABILITY MATRIX - Scraping System SaaS-Native + OpenAPI

**Date**: 2026-05-15

| Requirement | Source doc | Implementation task | Validation |
|---|---|---|---|
| Broker access SSOT only via adapter | `docs/SCRAPING_SYSTEM_SAAS_NATIVE_HANDOFF_MASTER_20260514.md` + AGENTS | P02 | direct import grep gate |
| Canonical OpenAPI contracts | `docs/CORE_API_OPENAPI_FUNCTION_DESIGN_CONSTITUTION_20260513.md` | P02 | schema + example review |
| Runtime config/admin in frontend | this bundle | P06 | component/smoke test |
| Permission-aware operator control | `docs/TECH_SPEC_SCRAPING_SYSTEM_SAAS_NATIVE_OPENAPI_20260515.md` | P03, P06 | auth/readonly tests |
| Raw tick short retention | this bundle | P04 | retention policy check |
| Long-lived canonical facts | existing SaaS-native docs | P04 | materializer/read-path tests |
| Selected-session truth in UI | `docs/SCRAPING_SYSTEM_SAAS_NATIVE_OPENAPI_FRONTEND_DESIGN_20260515.md` | P07 | chart/advisory integration |
| No direct fetch bypass | AGENTS + frontend design | P05 | adapter usage test |
| Audit trail for config changes | backend design | P03, P08 | audit history tests |
| Evidence package per slice | this bundle | P08, P09 | ledger/progress update |

---

## Notes

- Traceability must be read as a living map, not a one-time spreadsheet.
- If a requirement changes, update the owning design doc and the taskboard in the same slice.

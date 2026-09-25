# BL-16 gates — coverage gate (PARTIAL; global fail-under follow-up) (2026-09-24)

## Change
- New `packages/core/backend/.coveragerc` (omit migrations/tests/wsgi/asgi).
- `core-api.yml`: install `coverage` + job `coverage` (report-only + artifact upload).
- FE: `@vitest/coverage-v8` install **BLOCKED** (`npm i` arborist error 2 lần) → FE coverage follow-up.

## Baseline đo thật (touched modules, 90 green tests)
- `saml_service.py` 90% · `legacy_proxy.py` 95% · `json_logging.py` 100% · `middleware.py` 84% · `env_validation.py` 79% (62→79 sau khi thêm tests đường lỗi) · **TOTAL 89%**.
- Lệnh: `coverage run --source=<5 modules> manage.py test <7 test modules>` → Ran 90 OK.

## Pre-existing failures (verify HEAD sạch qua stash — KHÔNG do W1/P1)
- `test_status_codes_and_errors` (envelope request_id/timestamp — response HTML thay vì JSON), `test_exception_handling[_a6]` (request_id), `test_pat_tenant_binding` (1 case). Global `--fail-under` chỉ bật sau khi fix xong các case này (ticket follow-up).

## DoD tick
- [x] config · [x] CI wiring · [x] baseline số touched-modules · [ ] global fail-under (chờ fix pre-existing) · [ ] FE provider (blocked npm).

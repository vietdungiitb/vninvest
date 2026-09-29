# TASKBOARD — SaaS Intraday API (Chart + Tape)

**Ngày**: 2026-05-12 | **Feature**: SAAS-MIGRATION Market Data — Intraday Gap Fill  
**Ref Spec**: `docs/TECH_SPEC_SAAS_INTRADAY_API_20260512.md`  
**Ref Plan**: `docs/IMPLEMENTATION_PLAN_SAAS_INTRADAY_API_20260512.md`

---

## TASKBOARD

| ID | Slice | File | Thao tác | DoD | Status |
|----|-------|------|---------|-----|--------|
| MD-I-01 | 1 | `packages/core/backend/src/market_data/views.py` | Append `IntradayPricesView` (58 dòng, copy từ TECH_SPEC §3.1) | `resolve('/api/market-data/intraday-prices/VCB/')` không raise | ☐ |
| MD-I-02 | 1 | `packages/core/backend/src/market_data/views.py` | Append `IntradayTapeView` (ngay sau MD-I-01) | `resolve('/api/market-data/intraday-tape/VCB/')` không raise | ☐ |
| MD-I-03 | 1 | `packages/core/backend/src/market_data/urls.py` | Thêm route `intraday-prices/<str:symbol>/` trước `]` | `resolve` trả `IntradayPricesView` | ☐ |
| MD-I-04 | 1 | `packages/core/backend/src/market_data/urls.py` | Thêm route `intraday-tape/<str:symbol>/` trước `]` | `resolve` trả `IntradayTapeView` | ☐ |
| MD-I-05 | 1 | — | **Validate Slice 1**: chạy DoD script từ IMPL_PLAN §Slice 1 | Output: `SLICE 1 OK` | ☐ |
| MD-I-06 | 1 | — | **Commit Slice 1**: `feat(market_data): add IntradayPricesView and IntradayTapeView bridge endpoints` | `git log --oneline -1` hiển thị commit message | ☐ |
| MD-I-07 | 2 | `packages/core/backend/tests/test_market_data_api_routes.py` | Thêm `from unittest.mock import patch, MagicMock` nếu chưa có | File parse được, không ImportError | ☐ |
| MD-I-08 | 2 | `packages/core/backend/tests/test_market_data_api_routes.py` | Append `IntradayApiRouteTests` (10 test methods, copy từ TECH_SPEC §3.3) | File syntax valid | ☐ |
| MD-I-09 | 2 | — | **Validate Slice 2**: `python manage.py test tests.test_market_data_api_routes --keepdb -v2` | `Ran 13 tests … OK` | ☐ |
| MD-I-10 | 2 | — | **Commit Slice 2**: `test(market_data): add 9 unit tests for IntradayPricesView and IntradayTapeView` | `git log --oneline -1` hiển thị commit message | ☐ |
| MD-I-11 | 3 | — | **Rebuild dev stack**: `docker compose -f docker-compose.dev.yml --env-file compose.dev.env up -d --build core-api` | Container healthy, `docker ps` hiển thị `core-api` Up | ☐ |
| MD-I-12 | 3 | — | **Smoke test**: curl `GET /core/v1/market-data/intraday-prices/VCB/` với valid token | HTTP 200, body có `symbol=VCB` | ☐ |
| MD-I-13 | 3 | — | **Smoke test**: curl `GET /core/v1/market-data/intraday-tape/VCB/` với valid token | HTTP 200, body có `symbol=VCB` | ☐ |
| MD-I-14 | 3 | — | **Auth check**: curl cả 2 endpoint KHÔNG có token | HTTP 401 | ☐ |
| MD-I-15 | 3 | `docs/CODE_CHANGE_AUDIT_LEDGER.md` | Append entry SAAS-INTRADAY-API | Entry tồn tại trong file | ☐ |
| MD-I-16 | 3 | `PROGRESS_DASHBOARD.md` | Update dòng intraday API status → DONE | File updated | ☐ |
| MD-I-17 | 3 | — | **Commit Slice 3**: `chore: smoke-tested intraday bridge endpoints, updated audit ledger` | `git log --oneline -1` hiển thị commit message | ☐ |
| MD-I-18 | 3 | — | **Push to dev**: `git push origin dev` | Remote updated | ☐ |

---

## TEST COUNT CHECK

| File | Tests trước | Tests sau | Delta |
|------|------------|----------|-------|
| `test_market_data_api_routes.py` | 4 | 13 | +9 |
| **Total** | **4** | **13** | **+9** |

---

## AUDIT LEDGER ENTRY

Copy-paste vào `docs/CODE_CHANGE_AUDIT_LEDGER.md` khi hoàn thành:

```markdown
## SAAS-INTRADAY-API — 2026-05-12

**Task**: Add intraday-prices + intraday-tape bridge endpoints to packages/core/backend  
**Author**: [dev name]  
**Slice**: SAAS-MIGRATION Market Data Gap Fill

### Files Modified
1. `packages/core/backend/src/market_data/views.py` — +58 lines, append IntradayPricesView + IntradayTapeView
2. `packages/core/backend/src/market_data/urls.py` — +2 lines, 2 new routes
3. `packages/core/backend/tests/test_market_data_api_routes.py` — +75 lines, IntradayApiRouteTests (9 test methods)

### Validation
- Unit tests: 13/13 pass (python manage.py test tests.test_market_data_api_routes)
- Smoke test: GET /core/v1/market-data/intraday-prices/VCB/ → HTTP 200
- Smoke test: GET /core/v1/market-data/intraday-tape/VCB/ → HTTP 200
- Auth check: 401 without token ✓

### Residual Risk
- Bridge-first: if legacy is down, graceful degradation returns empty lists (not error)
- Phase 2 required: after legacy decommission, replace with native vnbroker adapter
```

---

## PROGRESS DASHBOARD ENTRY

Update dòng này trong `PROGRESS_DASHBOARD.md`:

```markdown
| Intraday Chart API (/core/v1/market-data/intraday-prices/) | ☐ | DONE ✅ 2026-05-12 — Bridge to legacy |
| Intraday Tape API (/core/v1/market-data/intraday-tape/)    | ☐ | DONE ✅ 2026-05-12 — Bridge to legacy |
```

---

## DONE CONDITION (toàn bộ task)

Task được coi là DONE khi:
1. ✅ `python manage.py test tests.test_market_data_api_routes --keepdb` → `Ran 13 tests … OK`
2. ✅ `GET /core/v1/market-data/intraday-prices/VCB/` từ dev stack → HTTP 200 với `symbol=VCB`
3. ✅ `GET /core/v1/market-data/intraday-tape/VCB/` từ dev stack → HTTP 200 với `symbol=VCB`
4. ✅ `CODE_CHANGE_AUDIT_LEDGER.md` có entry `SAAS-INTRADAY-API — 2026-05-12`
5. ✅ `PROGRESS_DASHBOARD.md` đã update
6. ✅ 3 commits pushed lên branch `dev`

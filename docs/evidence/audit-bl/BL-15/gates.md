# BL-15 gates — structured JSON logging (2026-09-24)

## Change (stdlib-only, 0 new dep)
- New `vninvest_core/json_logging.py`: `JsonFormatter` (`ts/level/logger/msg/module/request_id?/exc?`) + `request_id_var` ContextVar.
- `ops_audit/middleware.py`: set ContextVar mỗi request (additive, try/except, không đổi flow audit).
- `settings.py` LOGGING: formatter `json` prod-default / `text` dev, `LOG_FORMAT` override có guard (unknown → default, không crash boot).
- New `vninvest_core/tests/test_json_logging.py`: 5 tests.

## Gates
- `manage.py test vninvest_core.tests.test_json_logging`: **Ran 5 OK** (parse keys, request_id set/unset, exc, middleware propagation với mocked AuditEvent).
- Prod-mode live probe (DEBUG=false): handler formatter = `json`, dòng log ra JSON hợp lệ (copy output trong evidence này).
- `manage.py check`: 0 (chạy cùng đợt).

## DoD tick
- [x] JSON parse được · [x] request_id tương quan · [x] không dep mới · [x] format verified prod-mode.

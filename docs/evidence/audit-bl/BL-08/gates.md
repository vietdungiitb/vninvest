# BL-08 gates — merge duplicate `LEGACY_BACKEND_URL` (2026-09-24)

## Change
- `settings.py`: removed second assignment (old `:143-144` incl. "Transitional admin bridge" comment); single source at `:131` keeping strip-slash behavior with default `''`.
- No behavior change: effective old default was already `''` (second assignment overrode the first `'http://backend:8000'`); compose files set the var explicitly at runtime.

## Gates (run 2026-09-24, local)
- `Select-String "LEGACY_BACKEND_URL\s*=" settings.py` = **1 hit** (`:131`).
- `ast.parse` settings: OK.
- `manage.py check` (DEBUG=true test env): **0 issues, exit 0**.
- Boot dev (compose sets `LEGACY_BACKEND_URL=http://backend:8000` explicitly): unaffected — env-driven, verified by reading `compose.dev.env:22`, `docker-compose.yml:77`.

## DoD tick
- [x] 1 assignment · [x] check 0 · [x] runtime unaffected (env-driven).

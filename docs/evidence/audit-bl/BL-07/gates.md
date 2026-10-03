# BL-07 gates — delete broken `whale_engine.py` (2026-09-24)

## Change
- Deleted `packages/core/backend/src/signal_intelligence/services/whale_engine.py` (was unimportable: line 1 bare text, `ast.parse` SyntaxError pre-delete).

## Gates (run 2026-09-24, local)
- Pre-delete: `Select-String whale_engine` over `src/**/*.py` + `tests/*.py` = **0 hits** (only docs mention history — allowed).
- Post-delete: same grep = **0 hits**; file confirmed removed (`Remove-Item` exit True).
- Sibling modules `services/*.py` all `ast.parse` OK (no traceback).
- `manage.py check` (DEBUG=true test env): **0 issues, exit 0** (shared gate with BL-06/08 run).

## DoD tick
- [x] grep 0 · [x] BE check 0. No test referenced the module (0 importer), so no test changes needed.

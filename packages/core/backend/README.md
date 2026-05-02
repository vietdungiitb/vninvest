# packages/core/backend

This subtree now contains the first importable backend baseline for `packages/core`.

Current foundation:
- `src/vninvest_core/app_manifest.py` as package identity and topology SSOT
- `src/vninvest_core/api_stub.py` as the API edge stub
- `src/vninvest_core/worker_stub.py` as the async worker stub
- `src/vninvest_core/beat_stub.py` as the scheduler stub
- `src/vninvest_core/contracts/*` as boundary namespaces for `access`, `market`, `operator`, `partner`

Rules:
- Keep this path additive and package-track-only.
- Do not bulk-copy legacy backend into this subtree.

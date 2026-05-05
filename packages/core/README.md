# packages/core

Purpose:
- Own the future central backend, serving APIs, commercial plane, and data ops.
- Absorb backend, opennews-main, infra, and scripts gradually during package-track implementation.

Boundary rules:
- Do not import from web, opencore, mobile, or vip-app.
- Expose package contracts through APIs and shared definitions only.
- Keep legacy runtime behavior as reference until package parity is proven.

Initial scaffold:
- backend/
- backend/src/vninvest_core/
- opennews-main/
- infra/
- scripts/
- pyproject.toml
- docker-compose.core.yml

# packages/opencore

Purpose:
- Package the community and self-host lane without creating a second frontend source.
- Own install assets, compose overlays, activation hooks, and public-safe onboarding materials.

Boundary rules:
- Consume build artifacts from packages/web.
- Consume activation and commercial contracts from packages/core.
- Do not own entitlement, quota, billing, or market truth.

Initial scaffold:
- distribution/
- activation/
- docs-public/
- docker-compose.opencore.yml

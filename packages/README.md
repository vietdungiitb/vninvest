# Packages Track

This directory is the implementation track for the approved packages-first migration.

Rules:
- Build new architecture here instead of expanding legacy runtime paths.
- Keep boundary ownership aligned with the approved architecture docs.
- Treat legacy backend/frontend/mobile-app/opennews-main/infra as reference and fallback until cutover.

Current scaffold:
- core
- web
- opencore
- mobile
- vip-app

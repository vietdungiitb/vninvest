# packages/web

Purpose:
- Host the single shared frontend source for community, saas, and vip build targets.
- Own human-facing UI shells, route catalogs, and adapter seams.

Boundary rules:
- Do not fork frontend source for opencore or vip.
- Consume core through API contracts instead of direct backend imports.
- Keep feature boundaries under shared build-target gating.

Initial scaffold:
- src/config
- src/components
- src/pages
- src/features/community
- src/features/saas
- src/features/vip
- src/context

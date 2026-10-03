# packages/vip-app

Purpose:
- Host the thin local backend and orchestration plane for VIP deployments.
- Keep VIP browser traffic behind local APIs instead of direct machine credentials.

Boundary rules:
- Do not add a separate frontend source here.
- Do not copy core market truth or commercial truth into this package.
- Integrate with core through approved partner and global APIs only.

Initial scaffold:
- local-backend/
- orchestrator/
- docker-compose.vip.yml

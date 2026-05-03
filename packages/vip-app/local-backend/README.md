# packages/vip-app/local-backend

Planned responsibilities:
- local auth and RBAC
- local secret storage
- local audit and chat logs
- local API facade for VIP browser flows

Current foundation:
- `api_stub.py` serves health, capability bootstrap and session bootstrap for `vipAppAdapter`.
- `store.py` persists local users, active session state, and audit logs to `data/state.json`.

Current HTTP surface:
- `GET /vip-app/v1/health`
- `GET /vip-app/v1/access/capabilities`
- `GET /vip-app/v1/session/bootstrap`
- `GET /vip-app/v1/rbac/users`
- `GET /vip-app/v1/audit/logs?limit=20`
- `POST /vip-app/v1/auth/login`
- `POST /vip-app/v1/auth/logout`
- `POST /vip-app/v1/auth/reset`
- `POST /vip-app/v1/rbac/users`

Default local smoke credentials:
- username: `vip-local-admin`
- password: `vip-demo-pass`

Focused validation path:
- `python api_stub.py`
- `loadShellBootstrap({ adapter: 'vip-app', env: { VNINVEST_VIP_APP_BASE_URL: 'http://127.0.0.1:8200/vip-app/v1' } })`

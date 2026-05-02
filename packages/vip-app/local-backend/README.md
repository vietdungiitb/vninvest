# packages/vip-app/local-backend

Planned responsibilities:
- local auth and RBAC
- local secret storage
- local audit and chat logs
- local API facade for VIP browser flows

Current foundation:
- `api_stub.py` serves health, capability bootstrap and session bootstrap for `vipAppAdapter`.

Focused validation path:
- `python api_stub.py`
- `loadShellBootstrap({ adapter: 'vip-app', env: { VNINVEST_VIP_APP_BASE_URL: 'http://127.0.0.1:8200/vip-app/v1' } })`

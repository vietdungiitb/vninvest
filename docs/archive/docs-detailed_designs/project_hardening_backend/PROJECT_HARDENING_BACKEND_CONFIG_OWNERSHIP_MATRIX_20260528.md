# Config Ownership Matrix — Project Hardening Backend
**Ngày**: 2026-05-28  
**Parent**: docs/detailed_designs/PROJECT_HARDENING_BACKEND_HANDOFF_MASTER_20260528.md

---

| Concern | Current owner | Allowed writer in this plan | End-state owner | Forbidden parallel writer | Validation |
|---|---|---|---|---|---|
| Core backend Python dependency set | `packages/core/backend/requirements.txt` | Core Backend | Core Backend | ad hoc pip installs không được ghi nhận | env bootstrap command pass |
| Core backend runtime env vars | local shell / dev runtime | Core Backend + Ops | Core Backend + Ops | hidden env assumptions trong docs | runbook reproducibility |
| Tenant isolation migration | `user_workspace` migrations | Core Backend | Core Backend | manual SQL hotfix không audit | migration + tests |
| Orphan quarantine artifact | migration support script | Core Backend + Ops | Core Backend + Ops | overwrite trực tiếp records gốc | audit output |
| App-level auth throttling | `identity_access/views_auth.py` | Identity Backend | Identity Backend | frontend-side retry workaround | auth tests |
| Gateway throttling | nginx config | Infra/Ops | Infra/Ops | per-route ad hoc local proxy hacks | config review + 429 smoke |
| Web packaging lane | `packages/web/scripts/build-community.mjs` + frontend shell | Package Web | Package Web | direct switch sang `npm run build` | build-community pass |
| Commercial payment extension | `commercial/*` | Commercial Backend | Commercial Backend | rewrite `Subscription` / `QuotaRecord` / `Invoice` | model + API review |
| Notification channel secrets/config | env + backend provider config | Signal Intelligence + Ops | Signal Intelligence + Ops | frontend-stored provider keys | delivery smoke |
| AI quota/cache/router | advisory/runtime config | Advisory Backend | Advisory Backend | per-page cost logic ở client | quota/cache tests |
| Governance artifacts | repo root docs | Feature owner | Feature owner | missing ledger/progress sync | audit review |

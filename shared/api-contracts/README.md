# shared/api-contracts

Use this directory for cross-package request and response contracts, schemas, and compatibility notes.

Guidelines:
- Prefer additive changes.
- Version breaking changes explicitly.
- Keep contracts independent from implementation internals.

Current baseline contracts:
- `build-target.contract.json`
- `capability-bootstrap.contract.json`
- `session-payload.contract.json`

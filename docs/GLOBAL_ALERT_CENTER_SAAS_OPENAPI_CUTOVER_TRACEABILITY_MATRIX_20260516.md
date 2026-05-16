# Traceability Matrix — Global Alert Center SaaS OpenAPI Cutover
**Ngày**: 2026-05-16

| Requirement ID | Yêu cầu | Source | Planned Tasks | Validation |
|---|---|---|---|---|
| GAC-01 | `global symbol matrix` là foundation duy nhất của alert-center | User direction + global matrix hard rules | F01, F02, F03 | Registry tests + operator summary evidence |
| GAC-02 | Detection toàn cục, delivery theo user | User direction | B01, B02, C01 | Delivery projection tests + tenant isolation tests |
| GAC-03 | Main feed chỉ chứa alert time-critical | User direction | B01, B03, C02 | API contract tests + UI smoke |
| GAC-04 | AI Alerts là lane riêng | User direction | B01, B03, C02 | AI lane API/UI tests |
| GAC-05 | Mọi contract mới phải qua `/core/v1/` | OpenAPI constitution + SaaS migration | B03, C02, D01 | Schema generation + adapter tests |
| GAC-06 | packages/web là UI target, dùng `coreApiAdapter` | SaaS migration hard rule | C02 | Adapter tests + packages/web smoke |
| GAC-07 | Không còn browser-side synthesis cho alert nghiệp vụ | Audit findings | B02, D01 | frontend regression tests + code review grep |
| GAC-08 | Không mở thêm compat/legacy bridge mới | Full independence + SaaS migration | B03, D01, D02 | Route audit + code review |
| GAC-09 | Không được bypass shadow/parity/soak gate | SaaS migration hard rules | D02 | Rollout evidence + self-audit fail gate |
| GAC-10 | Legacy alert paths chỉ được sunset sau parity | SaaS migration + full independence | D02 | Shadow run report + parity dashboard |

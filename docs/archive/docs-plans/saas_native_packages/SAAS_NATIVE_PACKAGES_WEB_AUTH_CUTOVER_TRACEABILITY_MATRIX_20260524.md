# TRACEABILITY MATRIX - SAAS NATIVE PACKAGES WEB AUTH CUTOVER

| Requirement ID | Requirement | Tasks | Validation |
|---|---|---|---|
| RQ-01 | Login UI production runs from packages/web | A1, A2, A3 | Unit + route smoke |
| RQ-02 | Register/verify/resend UI production runs from packages/web | A1, A2, A3 | Unit + integration |
| RQ-03 | Reset password public route in package layer | A2, A3 | Component + route smoke |
| RQ-04 | Auth HTTP only through coreApiAdapter | A1, A4 | Grep gate + code review |
| RQ-05 | Legacy frontend no longer auth source of truth | A5 | Regression + grep imports |
| RQ-06 | i18n Vietnamese complete for new auth pages | A2 | UI review + i18n snapshot |
| RQ-07 | Error envelope fields shown correctly | A1, A2 | Unit + component tests |
| RQ-08 | Token refresh lifecycle stable post-cutover | A1, A4 | Integration tests |

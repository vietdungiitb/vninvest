# TRACEABILITY MATRIX — SaaS Services Recovery

**Ngày**: 2026-05-11

| Req ID | Requirement | Plan Phase | Task IDs | Validation | Evidence |
|---|---|---|---|---|---|
| SSR-REQ-01 | Khôi phục data plane ổn định (`db`, `redis`) | R1 | SSR-R1.1, SSR-R1.2, SSR-R1.3 | Health checks + restart test | Slice evidence section 2, 6 |
| SSR-REQ-02 | Khôi phục core runtime đầy đủ | R2 | SSR-R2.1..R2.4 | Core/API health + startup logs | Slice evidence section 2, 3 |
| SSR-REQ-03 | Khôi phục background jobs và scheduler | R3 | SSR-R3.1..R3.3 | Worker/beat/queue tests | Slice evidence section 2, 3 |
| SSR-REQ-04 | Pass domain smoke tests trọng yếu | R3 | SSR-R3.4 | Integration test suite | Integration run report |
| SSR-REQ-05 | Đạt runtime path SaaS-only cho đường chính | R4 | SSR-R4.1..R4.3 | Cutover/parity checklist | Gate sign-off evidence |
| SSR-REQ-06 | Soak và hardening đạt SLO | R5 | SSR-R5.1..R5.3 | 24-72h monitoring report | Soak evidence |
| SSR-REQ-07 | Bàn giao hoàn chỉnh có audit trail | R6 | SSR-R6.1..R6.3 | Ledger + progress + sign-off | Final handover package |

## Coverage summary
1. Plan coverage: 7/7 requirements mapped.
2. Task coverage: 100% requirements có task IDs.
3. Validation coverage: 100% requirements có test/verification path.
4. Evidence coverage: 100% requirements có evidence anchor.

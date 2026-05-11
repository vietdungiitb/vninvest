# TRACEABILITY MATRIX — SaaS Background Services Multi-Provider

**Ngày**: 2026-05-11

| Req ID | Requirement | Phase | Task IDs | Validation | Evidence |
|---|---|---|---|---|---|
| SBMP-REQ-01 | Queue isolation giữa realtime và heavy jobs | P1 | SBMP-P1.1..P1.4 | Queue lag test + routing verification | Slice evidence section 2 |
| SBMP-REQ-02 | Multi-provider fallback và best-source routing | P2 | SBMP-P2.1..P2.4 | Provider failover tests | Provider routing report |
| SBMP-REQ-03 | Manual trigger có quota/priority/audit | P3 | SBMP-P3.1..P3.3 | Auth + quota + starvation tests | API evidence bundle |
| SBMP-REQ-04 | Offhours enrichment đầy đủ và đúng hạn | P4 | SBMP-P4.1..P4.3 | Completeness + timing checks | Offhours execution report |
| SBMP-REQ-05 | Đạt SLO mốc 10k users | P5 | SBMP-P5.1..P5.3 | Load + soak + SLO gates | Final sign-off package |
| SBMP-REQ-06 | Runtime policy có SSOT và rollback | P0/P2 | SBMP-P0.1..P0.3, P2.3 | Drift checks + rollback drills | Governance evidence |

## Coverage summary
1. Requirement coverage: 6/6 mapped.
2. Task coverage: 100% requirements có task IDs.
3. Validation coverage: 100% requirements có test path.
4. Evidence coverage: 100% requirements có evidence anchor.

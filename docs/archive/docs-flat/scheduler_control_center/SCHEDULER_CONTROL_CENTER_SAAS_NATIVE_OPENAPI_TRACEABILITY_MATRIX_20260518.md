# Traceability Matrix - Scheduler Control Center SaaS Native OpenAPI
**Ngay**: 2026-05-18

---

| Req ID | Requirement | Planned Tasks | Validation |
|---|---|---|---|
| R1 | Co scheduler plan table hop nhat cho backfill/prefetch | S01, S06, S07 | API contract tests + SOC UI tests |
| R2 | Co control actions bat/tat/tam dung/chay ngay/dung run | S03 | Action endpoint tests + integration revoke tests |
| R3 | Co ownership guard va audit trail cho moi write action | S02, S03 | Ownership deny tests + audit record assertions |
| R4 | Co runtime status trung thuc (lag/freshness/inflight) | S04 | Aggregator tests + queue metrics parity checks |
| R5 | Endpoints moi theo OpenAPI canonical namespace/envelope | S05 | Spectacular schema checks + error envelope tests |
| R6 | Frontend chi render server truth, khong synthesize state | S06, S07 | UI tests + adapter payload tests |
| R7 | Rollout an toan read-only truoc write-mode | S08, S09 | Soak evidence + rollback drill evidence |
| R8 | SaaS native hard constraints khong bi vi pham | S01-S09 | Spec audit + code review checklist |

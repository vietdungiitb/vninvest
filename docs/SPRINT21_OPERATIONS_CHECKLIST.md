# Sprint 21 operations checklist (S21-01, S21-04, S21-12)

Trang thai: READY FOR EXECUTION

Muc tieu: dong 3 task con pending de chot Exit Gate Sprint 21.

Runbook lenh thao tac chi tiet:
- docs/SPRINT21_OPS_RUNBOOK_COMMANDS.md

Mau evidence theo ngay van hanh:
- docs/SPRINT21_EXECUTION_EVIDENCE_TEMPLATE_20260405.md
- docs/SPRINT21_EXECUTION_EVIDENCE_STAGING_PREFILL_20260405.md

- S21-01: measurement contract + rollback thresholds co ky duyet.
- S21-04: dashboard baseline + alert fire test.
- S21-12: benchmark + canary 10% trong 24h.

## 1) Pre-flight (T-60 -> T-15)

1. Chot owner trực ca:
- Tech Lead: ____
- DevOps: ____
- QA: ____
- Backend on-call: ____

2. Xac nhan commit/phien ban can rollout:
- Backend commit: ____
- Frontend commit (neu lien quan): ____
- Feature flags:
  - ENABLE_NEW_MARKET_VIEWS=false (ban dau)
  - ENABLE_NEW_TRADING_VIEWS=false

3. Xac nhan rollback channel:
- Pager/Slack channel: ____
- Lenh rollback nhanh da duoc xac minh: PASS / FAIL

## 2) S21-01 - Measurement contract sign-off (T-15 -> T0)

1. Chot KPI theo doi:
- p95 latency
- 5xx rate
- throttle error rate
- cache hit/miss ratio

2. Chot rollback triggers:
- 5xx > 1.5% trong 5 phut
- p95 > 500ms trong 5 phut

3. Chot benchmark acceptance:
- p95 implementation moi khong xau hon legacy qua 10%

4. Ky duyet nhanh:
- Tech Lead: ____
- DevOps: ____
- Thoi diem: ____

## 3) S21-04 - Dashboard baseline + alert test (T0 -> T+60)

1. Baseline dashboard (truoc canary):
- p95 (legacy): ____
- 5xx (legacy): ____
- throttle rate (legacy): ____
- cache hit/miss (legacy): ____

2. Alert rule check:
- Rule p95 configured: PASS / FAIL
- Rule 5xx configured: PASS / FAIL
- Rule throttle configured: PASS / FAIL

3. Alert fire test 1 lan:
- Fire test done: PASS / FAIL
- Time-to-alert: ____
- Ack flow: PASS / FAIL

4. Ghi evidence:
- Dashboard screenshot: ____
- Alert event link: ____

## 4) S21-12 - Benchmark + canary 10% (T+60 -> T+24h)

1. Khoi dong canary:
- Bat ENABLE_NEW_MARKET_VIEWS cho 10% traffic: ____
- Start time: ____

2. Cua so quan sat 24h:
- T+1h quick check: PASS / FAIL
- T+4h check: PASS / FAIL
- T+12h check: PASS / FAIL
- T+24h final check: PASS / FAIL

3. KPI during canary:
- p95 delta vs baseline: ____
- 5xx peak: ____
- throttle delta: ____
- cache hit/miss delta: ____
- contract mismatch count: ____

4. Rollback rehearsal:
- Rehearsal executed: PASS / FAIL
- Time to rollback: ____
- Recovery verification: PASS / FAIL

5. Decision:
- Sprint 21 Exit Gate: GO / NO-GO
- Notes/Risks: ____

## 5) Incident handling nhanh (neu cham trigger)

1. Tat canary ngay: ENABLE_NEW_MARKET_VIEWS=false.
2. Xac nhan KPI ve baseline trong 15 phut.
3. Tao incident note trong ngay:
- Trigger
- Blast radius
- Mitigation
- Next action

## 6) Deliverables bat buoc de dong Sprint 21

1. Measurement contract co ky (S21-01).
2. Dashboard + alert fire evidence (S21-04).
3. Benchmark + canary 10% report 24h (S21-12).
4. Gate sign-off duoc ky trong docs:
- docs/SPRINT21_EXIT_GATE_SIGNOFF_TEMPLATE.md

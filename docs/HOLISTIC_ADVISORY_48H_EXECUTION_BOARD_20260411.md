# HOLISTIC ADVISORY 48H EXECUTION BOARD (2026-04-11)

## Muc tieu 48h

Dong correctness gaps high-risk va chot design contract cho AdvisoryAggregateState v1.

## Definition of Done (48h)

1. Co 1 PR correctness hotfix da pass regression block.
2. Co 1 PR migration skeleton cho snapshot + audit log.
3. Co baseline KPI report ban dau.
4. Co sign-off schema v1 tu BE + FE + QA.

## Ticket board

### H0-01: Chot AdvisoryAggregateState v1 contract
- Owner: BE lead
- Priority: P0
- Inputs: master plan + API session flow hien tai
- Output:
  - JSON schema v1
  - field naming conventions
  - validation rules
- Acceptance:
  - Team sign-off
  - Co tai lieu contract update

### H0-02: Hotfix source/severity semantics dark-flow merge
- Owner: BE
- Priority: P0
- Output:
  - Source mapping ro rang trong merge->flush->generate
  - Severity branch dark-flow kich hoat dung theo policy
- Tests:
  - Unit test severity mapping cho merged dark-flow case
  - Integration test flush path
- Acceptance:
  - No regression whale advisory task suite

### H0-03: Tick-rate field mapping hardening
- Owner: BE
- Priority: P0
- Output:
  - Dong bo ten field tick-rate giua detector output va prompt context
- Tests:
  - Unit test prompt payload includes valid tick-rate value
- Acceptance:
  - Component generation khong con tick-rate = 0 do field mismatch

### H0-04: Timeframe propagation consistency
- Owner: BE
- Priority: P0
- Output:
  - Component generate/refresh deu truyen window/timeframe semantics nhat quan
- Tests:
  - API route tests cho 15m/30m/1h
- Acceptance:
  - Detector nhan dung window_minutes o cac path lien quan

### H0-05: First-create threshold semantics hardening
- Owner: BE
- Priority: P1
- Output:
  - Session first-create ton trong symbol override semantics khi co du lieu tracked
- Tests:
  - API test cho case co/khong co override
- Acceptance:
  - Advisory dau tien khong lech threshold_source

### H0-06: Migration skeleton cho snapshot + audit log
- Owner: BE
- Priority: P1
- Output:
  - Models: AdvisoryAggregateSnapshot, AdvisoryAggregateAuditLog
  - Migration file + basic admin registration
- Tests:
  - Migration apply clean tren sqlite/local
- Acceptance:
  - Migrate up/down thanh cong

### H0-07: Baseline KPI capture
- Owner: Data/QA
- Priority: P0
- Output:
  - Report baseline: actionability, noise, severity consistency, p95 latency, skip reasons
- Acceptance:
  - Baseline file luu trong docs + metric query script luu trong scripts/

## Regression gate can chay sau H0-02..H0-05

1. portfolio.tests.test_whale_advisory_task
2. portfolio.tests.test_order_flow
3. portfolio.tests.test_realtime_compute
4. ApiRouteSmokeTests -k whale

## Risk watchlist (48h)

1. Thay doi source semantics co the anh huong token logging source labels.
2. Timeframe propagation sua o nhieu endpoint de de phat sinh regression.
3. Migration skeleton can giu backward compatibility cho endpoint cu.

## Evidence can luu

1. Link PR + commit hash.
2. Ket qua test pass (so test + timestamp).
3. Truoc/sau payload sample cho advisory merge case dark-flow.
4. Baseline KPI snapshot.

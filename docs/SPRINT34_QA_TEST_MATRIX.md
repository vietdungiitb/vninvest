# Sprint 34 QA Test Matrix

Status: READY
Scope: A1 + A2 + B1
Date: 2026-04-10

## 1) Test objectives

1. Validate deterministic identity behavior.
2. Validate cursor v2 pagination consistency.
3. Validate dark-flow severity remap quality.

## 2) Environment matrix

1. Local dev:
- redis_stream available and unavailable modes.

2. Staging:
- normal load and burst load windows.

## 3) Functional test cases

### F-A1 deterministic identity
1. TC-A1-01
- Same query twice in short interval.
- Expected: same events keep stable identity.

2. TC-A1-02
- Fallback source transition (redis -> db/vnbroker).
- Expected: identity remains consistent by defined key policy.

### F-A2 cursor v2
1. TC-A2-01
- Traverse 5 pages with fixed filters.
- Expected: no duplicate and no missing event.

2. TC-A2-02
- Replay cursor request in short interval.
- Expected: deterministic ordering and stable page boundaries.

3. TC-A2-03
- Invalid cursor payload.
- Expected: validation error follows contract.

### F-B1 severity remap
1. TC-B1-01
- Low strength + low confidence sample.
- Expected: info.

2. TC-B1-02
- Mid strength + persistent signal sample.
- Expected: warning.

3. TC-B1-03
- High strength + high confidence + strong cvd_change.
- Expected: urgent.

4. TC-B1-04
- Boundary values around threshold edges.
- Expected: deterministic mapping per rulebook.

## 4) Non-functional checks

1. Pagination latency p95 stays within current acceptable envelope.
2. No regression crash in FE pagination flow.
3. No blocker critical remains open at sprint close.

## 5) Pass/fail gate

Pass when all conditions hold:
1. A1/A2/B1 functional tests pass.
2. Duplicate event rate < 1% on pilot set.
3. Pagination consistency > 99.9%.
4. Severity distribution is not info-collapsed.

## 6) Evidence required

1. Test execution log with timestamps.
2. KPI before/after snapshot.
3. Defect list with closure status.
4. Final QA sign-off note for Sprint 34.
# PREFETCH TIME POLICY - BASELINE CAPTURE PLAYBOOK (2026-04-12)

## Muc tieu

Chup baseline KPI truoc Gate B (canary deploy approval) theo 4 nhom:
- 429 pressure
- cooldown events
- freshness
- p95 latency

Artifacts duoc luu tai `docs/ops-evidence/prefetch-policy-baseline/<timestamp>/`.

---

## Script chuan

- `scripts/ops/prefetch_policy_capture_baseline.ps1`
- `scripts/ops/prefetch_policy_gate_b2_check.ps1`

Script se:
1. Sample lien tuc cac endpoint observability.
2. Do latency p95 cho endpoint lien quan.
3. Thu so lieu freshness va policy counters.
4. (Neu co auth) thu 429 ratio qua ticker probe + lay admin stats.
5. Validate Gate B2 readiness tu artifact baseline bang checker script.

---

## Cach chay

### Cach 1: Co username/password

```powershell
& "scripts/ops/prefetch_policy_capture_baseline.ps1" `
  -ApiBase "http://127.0.0.1:8000" `
  -Username "admin_username" `
  -Password "admin_password" `
  -Symbol "FPT" `
  -Samples 24 `
  -IntervalSeconds 5 `
  -RequestTimeoutSec 12
```

### Cach 2: Co san bearer token

```powershell
& "scripts/ops/prefetch_policy_capture_baseline.ps1" `
  -ApiBase "http://127.0.0.1:8000" `
  -AccessToken "<jwt_access_token>" `
  -Symbol "FPT" `
  -Samples 24 `
  -IntervalSeconds 5
```

### Cach 3: Khong auth (chi baseline public health)

```powershell
& "scripts/ops/prefetch_policy_capture_baseline.ps1" `
  -ApiBase "http://127.0.0.1:8000" `
  -Samples 24 `
  -IntervalSeconds 5
```

Luu y:
- Khong auth thi script bo qua `/api/admin-ops/stats/` va ticker probe 429.
- De co du Gate B2, nen chay co auth.
- Neu endpoint cham/treo, giam `-RequestTimeoutSec` (vi du 8-12s) de script ket thuc on dinh va van co baseline so sanh.

---

## Outputs

Moi lan chay tao 1 thu muc timestamp gom:
- `baseline-samples.json`: raw samples theo moi lan poll.
- `baseline-summary.json`: tong hop KPI baseline.
- `README.md`: tom tat nhanh de dinh vao release gate.
- `_run.log`: log chay script.
- `gate-b2-check.json`: ket qua pass/fail theo tung tieu chi Gate B2.
- `gate-b2-check.md`: report markdown de dinh kem release gate.

---

## Validate Gate B2 (tu dong)

Sau khi capture baseline, chay:

```powershell
& "scripts/ops/prefetch_policy_gate_b2_check.ps1"
```

Hoac chi dinh artifact cu the:

```powershell
& "scripts/ops/prefetch_policy_gate_b2_check.ps1" `
  -BaselineSummaryPath "docs/ops-evidence/prefetch-policy-baseline/<timestamp>/baseline-summary.json"
```

Ket qua:
- Exit code 0: Gate B2 readiness pass.
- Exit code khac 0: chua du Gate B2, can chay lai baseline co auth.

---

## Mapping vao Gate B2

- Baseline 429 rate:
  - `baseline-summary.json -> kpi.ticker_probe_429_ratio_pct`
- Baseline cooldown events:
  - `baseline-summary.json -> kpi.policy_counters.multiplier_total_*`
- Baseline freshness:
  - `baseline-summary.json -> kpi.prefetch_freshness.*`
- Baseline latency p95:
  - `baseline-summary.json -> kpi.endpoint_latency_p95_ms.*`

---

## Checklist thao tac cho PM/QA/SRE

1. Chay script baseline truoc canary va luu artifacts.
2. Dinh link artifact vao release gates.
3. Chot nguong canh bao/rollback theo rollback matrix.
4. Xin sign-off Gate B.

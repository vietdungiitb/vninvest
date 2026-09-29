# PREFETCH TIME POLICY - GUARDRAIL THRESHOLDS (2026-04-12)

## Muc tieu

Dat nguong canh bao va rollback cho Gate B3 dua tren baseline auth artifact:
- `docs/ops-evidence/prefetch-policy-baseline/20260412-080254/baseline-summary.json`
- `docs/ops-evidence/prefetch-policy-baseline/20260412-080254/gate-b2-check.md`

---

## Baseline tham chieu (auth run @ 127.0.0.1:8010)

- ticker probe 429 ratio: `0%`
- latency p95 prefetch health: `20011.05ms`
- latency p95 market observability: `20012.78ms`
- latency p95 admin-ops stats: `19924.57ms`
- market observability overall last: `http_5xx_ratio_pct=100%` (realtime-ticker dominated)

Luu y:
- Baseline hien tai rat cao (likely local env under stress/degraded).
- Nguong ben duoi duoc de xuat theo huong practical cho canary compare, khong phai SLO production final.

---

## De xuat nguong Gate B3

### 1) 429 rate

- Warn threshold: `>= 2%` trong cua so 15 phut
- Rollback threshold: `>= 5%` lien tiep 2 cua so 15 phut

### 2) Cooldown events (policy 429 multiplier)

- Warn threshold: `multiplier_total_delta > 0` trong 15 phut ngoai market_open
- Rollback threshold: `multiplier_total_delta >= 10` trong 30 phut market_open

### 3) Freshness

- Warn threshold: `freshness_p95_seconds > 120`
- Rollback threshold: `freshness_p95_seconds > 300` lien tiep 2 cua so 15 phut

### 4) Latency p95 (endpoint)

- Warn threshold:
  - prefetch health p95 > baseline * 1.25
  - admin-ops stats p95 > baseline * 1.25
- Rollback threshold:
  - prefetch health p95 > baseline * 1.5
  - admin-ops stats p95 > baseline * 1.5

Tinh san nguong tu baseline 20260412-080254:
- prefetch warn: `25013.81ms`
- prefetch rollback: `30016.58ms`
- admin warn: `24905.71ms`
- admin rollback: `29886.86ms`

---

## Rule thuc thi canary

1. Bat dau canary voi scope nho (1 tenant/service slice).
2. Theo doi metric moi 15 phut.
3. Neu cham nguong rollback bat ky KPI nao -> rollback theo runbook.
4. Neu chi cham nguong warn -> giam scope/hold rollout va dieu tra.

---

## Checklist Gate B3 mapping

- B3.1 Co nguong canh bao va rollback cho tung KPI: DONE (tai lieu nay)
- B3.2 Co alert route den kenh van hanh: PENDING (can wiring theo stack chatops/oncall)

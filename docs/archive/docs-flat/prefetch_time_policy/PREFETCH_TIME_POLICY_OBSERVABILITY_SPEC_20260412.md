# PREFETCH TIME POLICY - OBSERVABILITY SPEC (2026-04-12)

## 1) KPI dashboard

Bat buoc co 4 nhom KPI:
- Upstream pressure: 429 rate.
- Runtime stability: cooldown events.
- Data quality: freshness trong market_open.
- Performance: p95 latency endpoint lien quan.

---

## 2) Metrics definition

### Counters
- `prefetch_policy_profile_hits_total{profile}`
  - Tang moi lan resolver chon profile.
- `prefetch_policy_skip_total{reason}`
  - Tang khi query skip do policy.
- `prefetch_policy_429_multiplier_total`
  - Tang khi ap multiplier sau 429.
- `prefetch_policy_fallback_total{reason}`
  - Tang khi fallback default/safe profile.

### Gauges
- `prefetch_policy_effective_interval_seconds{profile}`
- `prefetch_policy_effective_batch_size{profile}`
- `prefetch_policy_effective_symbol_limit{profile}`

### Histograms (optional)
- `prefetch_policy_resolver_duration_ms`

---

## 3) Logs

Structured log fields:
- `event`: `prefetch_policy_applied` | `prefetch_policy_fallback` | `prefetch_policy_validation_error`
- `profile`
- `query_enabled`
- `effective_interval_seconds`
- `reason`
- `request_id` (neu co)

---

## 4) Alert rules

- A1: 429 rate tang > nguong rollback trong 30-60 phut.
- A2: fallback_total tang dot bien.
- A3: freshness market_open duoi nguong.
- A4: p95 latency vuot SLO.

Alert severity:
- Sev-2: A1/A3 lap lai lien tuc.
- Sev-3: A2/A4.

---

## 5) Dashboard panels

1. Profile hit distribution theo thoi gian.
2. Skip count theo reason.
3. 429 multiplier events.
4. Freshness trend by window.
5. p95 latency trend.

---

## 6) Canary comparison

Truoc canary:
- Chup baseline KPI 24h.

Trong canary:
- Theo doi KPI moi 2h.

Sau canary:
- So sanh baseline vs canary trong 24-48h.

Decision:
- Neu KPI dat -> mo full rollout.
- Neu khong dat -> rollback theo runbook.

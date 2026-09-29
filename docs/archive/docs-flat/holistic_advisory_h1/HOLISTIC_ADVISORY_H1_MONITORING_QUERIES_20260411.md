# Holistic Advisory H1 Monitoring Queries (2026-04-11)

## 1) Purpose

Operational query pack for first 24h after production deployment.

## 2) Core DB Queries

### Q1. Component sample throughput (last 24h)

```sql
SELECT
  symbol,
  COUNT(*) AS sample_count
FROM portfolio_advisoryaggregateauditlog
WHERE created_at >= NOW() - INTERVAL '24 hours'
  AND metadata_json ->> 'operation' = 'component_generation'
GROUP BY symbol
ORDER BY sample_count DESC;
```

### Q2. Latency distribution snapshot (last 24h)

```sql
SELECT
  percentile_cont(0.50) WITHIN GROUP (ORDER BY (metadata_json ->> 'latency_ms')::numeric) AS p50_ms,
  percentile_cont(0.95) WITHIN GROUP (ORDER BY (metadata_json ->> 'latency_ms')::numeric) AS p95_ms,
  percentile_cont(0.99) WITHIN GROUP (ORDER BY (metadata_json ->> 'latency_ms')::numeric) AS p99_ms,
  AVG((metadata_json ->> 'latency_ms')::numeric) AS avg_ms
FROM portfolio_advisoryaggregateauditlog
WHERE created_at >= NOW() - INTERVAL '24 hours'
  AND metadata_json ->> 'operation' = 'component_generation'
  AND (metadata_json ? 'latency_ms');
```

### Q3. Error recovery events (last 24h)

```sql
SELECT
  metadata_json -> 'error_recovery' AS error_recovery,
  COUNT(*) AS hits
FROM portfolio_advisoryaggregateauditlog
WHERE created_at >= NOW() - INTERVAL '24 hours'
  AND metadata_json ->> 'operation' = 'component_generation'
  AND metadata_json ? 'error_recovery'
GROUP BY metadata_json -> 'error_recovery'
ORDER BY hits DESC;
```

### Q4. Source and actor sanity check

```sql
SELECT
  reason,
  actor,
  COUNT(*) AS row_count
FROM portfolio_advisoryaggregateauditlog
WHERE created_at >= NOW() - INTERVAL '24 hours'
  AND metadata_json ->> 'operation' = 'component_generation'
GROUP BY reason, actor
ORDER BY row_count DESC;
```

### Q5. Missing/invalid metrics payload guardrail

```sql
SELECT
  COUNT(*) AS invalid_rows
FROM portfolio_advisoryaggregateauditlog
WHERE created_at >= NOW() - INTERVAL '24 hours'
  AND metadata_json ->> 'operation' = 'component_generation'
  AND (
    metadata_json IS NULL
    OR NOT (metadata_json ? 'latency_ms')
    OR (metadata_json ->> 'latency_ms') !~ '^[0-9]+(\\.[0-9]+)?$'
  );
```

## 3) Management Command Checks

### C1. Single-symbol baseline refresh

```powershell
python backend/manage.py generate_advisory_baseline_report --username <admin_user> --symbol <SYMBOL> --days 1 --limit 500 --operation component_generation --output docs/tmp_baseline_<SYMBOL>.json
```

### C2. All-symbol baseline refresh

```powershell
python backend/manage.py generate_advisory_baseline_report --username <admin_user> --days 1 --limit 5000 --operation component_generation --output docs/tmp_baseline_all.json
```

## 4) Alert Threshold Guidance

- p95 latency > 2x latest accepted baseline for 15m -> page on-call.
- invalid_rows > 0.5% of total samples -> investigate serialization/persistence path.
- sample throughput drop > 50% vs previous 24h -> check endpoint traffic and background workers.

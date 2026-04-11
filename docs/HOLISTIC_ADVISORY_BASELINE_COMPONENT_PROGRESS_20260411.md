# Holistic Advisory H1 - Component Baseline Progress (2026-04-11)

## Scope
- User: `phamvietdung`
- Symbol: `FPT`
- Operation filter: `component_generation`
- Data source: `AdvisoryAggregateAuditLog.metadata_json`

## Baseline Delta
- Previous snapshot: 9 samples
- Current snapshot: 50 samples
- Delta: +41 samples

## Latency Delta (9 -> 50 samples)
- p50: 13.23 ms -> 11.20 ms
- p95: 15.82 ms -> 15.82 ms
- p99: 15.82 ms -> 31.72 ms
- avg: 13.45 ms -> 12.03 ms
- min/max: 12.43/15.82 ms -> 10.10/31.72 ms

## Quality/Behavior Signals
- token_cost: stable at 0 (fallback/template path)
- actionability_avg: stable at 0.5833
- confidence_avg: stable at ~0.48
- component participation: 100% for all expected component phases
- errors: 0

## Interpretation
- The component-generation flow now emits stable component-level latency samples at production-like API path.
- Central tendency improved after larger sample volume (p50 and avg lower).
- p99 widened with larger N, which is expected and now gives a more realistic tail-latency view.

## Reproduction Command
```powershell
cd "c:\Mujoco Projects\vninvest"
& "c:/Mujoco Projects/vninvest/.venv/Scripts/python.exe" backend/manage.py generate_advisory_baseline_report --username phamvietdung --symbol FPT --days 30 --limit 500 --operation component_generation --output docs/HOLISTIC_ADVISORY_BASELINE_COMPONENT_FPT_20260411.json
```

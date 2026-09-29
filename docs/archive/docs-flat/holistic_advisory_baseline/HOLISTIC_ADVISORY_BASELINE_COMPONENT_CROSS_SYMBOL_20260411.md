# Holistic Advisory H1 - Component Baseline Cross-Symbol (2026-04-11)

## Account used
- Admin account: `phamvietdung` (superuser)

## Symbols
- `FPT`
- `MBS`
- `TPB`

## Snapshot summary
- FPT: sample_count=50, p50=11.20 ms, p95=15.82 ms, p99=31.72 ms, avg=12.03 ms
- MBS: sample_count=40, p50=11.17 ms, p95=13.51 ms, p99=13.70 ms, avg=11.41 ms
- TPB: sample_count=40, p50=11.24 ms, p95=12.67 ms, p99=14.93 ms, avg=11.28 ms

## Observations
- Component-flow latency is stable around ~11-12 ms p50 across 3 symbols.
- MBS/TPB tails are tighter than FPT in current local sample window.
- All three baselines are fallback/template path in local environment (token metrics remain 0).
- Error metrics remained 0 for all symbols.

## Generated baseline files
- `docs/HOLISTIC_ADVISORY_BASELINE_COMPONENT_FPT_20260411.json`
- `docs/HOLISTIC_ADVISORY_BASELINE_COMPONENT_MBS_20260411.json`
- `docs/HOLISTIC_ADVISORY_BASELINE_COMPONENT_TPB_20260411.json`

## Reproduction commands
```powershell
cd "c:\Mujoco Projects\vninvest"
$env:DB_ENGINE='sqlite'

& "c:/Mujoco Projects/vninvest/.venv/Scripts/python.exe" backend/manage.py generate_advisory_baseline_report --username phamvietdung --symbol FPT --days 30 --limit 500 --operation component_generation --output docs/HOLISTIC_ADVISORY_BASELINE_COMPONENT_FPT_20260411.json
& "c:/Mujoco Projects/vninvest/.venv/Scripts/python.exe" backend/manage.py generate_advisory_baseline_report --username phamvietdung --symbol MBS --days 30 --limit 200 --operation component_generation --output docs/HOLISTIC_ADVISORY_BASELINE_COMPONENT_MBS_20260411.json
& "c:/Mujoco Projects/vninvest/.venv/Scripts/python.exe" backend/manage.py generate_advisory_baseline_report --username phamvietdung --symbol TPB --days 30 --limit 200 --operation component_generation --output docs/HOLISTIC_ADVISORY_BASELINE_COMPONENT_TPB_20260411.json
```
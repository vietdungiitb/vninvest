# Sprint 29 — AI Advisory Chart Context Execution Plan

## 1. Sprint metadata
- Sprint: 29
- Name: AI Advisory + Kline Chart Context
- Status: READY TO EXECUTE
- Date: 2026-04-08
- Scope: Stock Detail AI advisory tabs on /stocks/:symbol

## 2. Business objective
- Tang do khop giua advisory va chart user dang xem.
- Giam hallucination trong noi dung AI tab.
- Co telemetry de do hieu qua truoc/sau rollout.

## 3. Technical objective
- FE gui chart_context (du lieu so) khi tao AI tab.
- BE validate + sanitize + inject chart_context vao prompt.
- API response co `chart_context_used` + `chart_context_warnings`.
- Rollout qua feature flag + canary.

## 4. In-scope
1. Numeric chart context:
- visible range
- ohlcv subset
- active indicators
- derived metrics
2. Backend contract + prompt integration + telemetry.
3. FE UX badge/warning states cho context usage.
4. QA API/E2E/perf + go/no-go.

## 5. Out-of-scope
1. Model fine-tuning.
2. OCR screenshot.
3. Full multimodal redesign.

## 6. Deliverables canonical
- `docs/SPRINT29_AI_ADVISORY_KLINE_CONTEXT_EXECUTION_PLAN.md`
- `docs/SPRINT29_ACCEPTANCE_CHECKLIST.md`
- `docs/SPRINT29_TASKBOARD.csv`

Companion implementation docs:
- `docs/AI_ADVISORY_KLINE_CONTEXT_UPGRADE_PLAN_20260408.md`
- `docs/AI_ADVISORY_KLINE_CONTEXT_TASKBOARD_20260408.md`
- `docs/AI_ADVISORY_KLINE_CONTEXT_EXECUTION_TRACKER_20260408.md`

## 7. Workstreams
### WS-A Backend
- Serializer cho chart_context v1.
- Update endpoint generate components.
- Prompt injection chart block.
- Telemetry fields.

### WS-B Frontend
- Collector chart context tu Kline instance.
- Gui payload khi generate AI tab.
- Badge/warning UI.

### WS-C QA/Release
- API contract matrix.
- E2E VNM/VCB/FPT.
- p95/fail-rate benchmark.
- Canary 10% + rollback readiness.

## 8. Feature flags
- `AI_ADVISORY_ENABLE_CHART_CONTEXT` (default: false)
- Optional phase sau: `AI_ADVISORY_ENABLE_CHART_IMAGE_CONTEXT`

## 9. Risk & mitigation
1. Prompt qua dai -> clamp 300 ohlcv points, compact schema.
2. Payload malformed -> fallback non-blocking + warnings.
3. Latency tang -> benchmark + canary threshold.
4. Provider incompatibility -> non-vision fallback strategy.

## 10. KPI gates
- >=95% request generate tab co chart_context hop le (trong request co context).
- p95 latency tang <=15% so voi baseline.
- failure rate tang <=1% absolute.
- complaint "AI khong dung chart" giam >=25%.

## 11. Go/No-Go gate
GO khi:
- Acceptance checklist pass.
- KPI gate dat trong canary 24-48h.
- Rollback da test.

NO-GO khi:
- Vuot nguong latency/failure.
- Regression UX chart indicator/generate flow.

## 12. Rollback
1. Tat `AI_ADVISORY_ENABLE_CHART_CONTEXT`.
2. Quay ve flow cu (symbol + timeframe).
3. Theo doi 30 phut post-rollback.

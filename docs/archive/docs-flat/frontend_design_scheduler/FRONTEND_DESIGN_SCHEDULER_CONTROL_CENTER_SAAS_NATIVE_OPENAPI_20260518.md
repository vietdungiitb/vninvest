# Frontend Design - Scheduler Control Center SaaS Native OpenAPI
**Ngay**: 2026-05-18

---

## 1. Muc tieu frontend

1. Cung cap scheduler board de operator quan ly lich chay va runtime controls.
2. Bao toan server-truth rendering (khong client-side synthesis).
3. Giao dien an toan cho thao tac rui ro (confirm + reason + rollback feedback).

---

## 2. Scope UI

1. DataOps scheduler board:
- table jobs (job_key, domain, data_types, trigger_type, status)
- runtime columns (next_run, last_run, lag, freshness, queue)
- action buttons theo capability

2. Prefetch scheduler board:
- profile intervals + runtime enabled state
- warm-now and schedule-level controls
- health snippets (cache hit ratio, queue lag)

3. Global scheduler health strip:
- jobs totals by status
- queue drift warning
- stale/inflight anomaly indicators

---

## 3. UX control safety

1. `disable`/`abort_active` bat buoc confirm modal.
2. Require `reason` field cho write action.
3. Lock buttons khi `can_apply=false` hoac action unsupported.
4. Show explicit success/failure banners with request_id when available.

---

## 4. Contract requirements

1. Frontend consume endpoints via adapter, khong direct fetch business route moi.
2. Required response fields:
- `capabilities`
- `status`
- `status_reason`
- `next_run_at`
- `last_run_at`
- `lag_seconds`
- `freshness_state`

3. Error rendering:
- show `detail`
- include `code` va `request_id` neu co

---

## 5. i18n requirements

1. Tat ca text moi qua i18n (vi/en).
2. Vietnamese full diacritics cho operator-facing strings.
3. Khong hardcoded text trong JSX.

---

## 6. Test requirements

1. Component tests cho scheduler table render + sorting + empty state.
2. Action tests cho confirm modal flow.
3. Adapter tests cho payload mapping và error envelope rendering.
4. Regression tests cho active-run lock behavior.

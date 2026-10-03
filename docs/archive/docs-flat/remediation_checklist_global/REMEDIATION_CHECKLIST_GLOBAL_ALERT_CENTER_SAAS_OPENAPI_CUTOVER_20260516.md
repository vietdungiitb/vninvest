# Remediation Checklist — Global Alert Center SaaS OpenAPI Cutover

Ngày: 2026-05-16  
Mục đích: chuyển trạng thái `REOPENED` (B01..D08) thành các slices có thể triển khai ngay, có bằng chứng test/evidence rõ ràng trước khi close lại.

---

## 1. Hard rule của checklist

1. Không đóng task nếu chưa có code + test + evidence.
2. Không coi doc update là remediation kỹ thuật.
3. Không đổi status DONE nếu endpoint family và domain model chưa khớp spec hoặc spec chưa được sửa chính thức.

---

## 2. Phase R1 — Domain entities and lifecycle state

### R1.1 Models and migrations
- [ ] Add `MarketAnomalyEvent`
- [ ] Add `AdvisorySignalEvent`
- [ ] Add `UserAlertDelivery`
- [ ] Add `UserAlertPreference`
- [ ] Add migrations for all new entities

### R1.2 Service layer
- [ ] Delivery state machine: `new -> seen -> acknowledged -> muted/suppressed`
- [ ] Preference policy: mute/snooze/cooldown without deleting canonical events
- [ ] Tenant isolation guard at query layer for delivery operations

### R1.3 Tests
- [ ] Model tests for constraints/indexes/state transitions
- [ ] API tests for cross-tenant access denial
- [ ] API tests for mute/snooze/ack lifecycle

---

## 3. Phase R2 — OpenAPI contract family alignment

### R2.1 Endpoints required by TECH_SPEC
- [ ] `GET /core/v1/signals/alert-center/feed`
- [ ] `GET /core/v1/signals/alert-center/summary`
- [ ] `GET /core/v1/signals/alert-center/events/{alert_id}`
- [ ] `GET /core/v1/signals/alert-center/symbols/{symbol}/context`
- [ ] `POST /core/v1/signals/alert-center/events/{alert_id}/ack`
- [ ] `POST /core/v1/signals/alert-center/preferences/mute`
- [ ] `GET /core/v1/signals/ai-alerts/feed`
- [ ] `GET /core/v1/signals/ai-alerts/summary`

### R2.2 Contract metadata
- [ ] OpenAPI params reflect real runtime filters (`lane`, `symbol`, `severity`, `session_date`, `cursor`, `page_size`)
- [ ] Error envelope documented for all alert-center endpoints
- [ ] Rate-limit semantics documented in endpoint metadata

### R2.3 Tests
- [ ] Contract tests for all list endpoints (pagination required)
- [ ] Contract tests for error envelope fields
- [ ] Contract tests for auth/rate-limit behavior

---

## 4. Phase R3 — Taxonomy and payload consistency

### R3.1 Taxonomy normalization
- [ ] Represent `price_shock` and `stale_quote` as explicit families (or approve spec update with traceability)
- [ ] Ensure lane logic matches family definitions from handoff/spec

### R3.2 Payload parity
- [ ] Resolve `summary` field drift between UI and serializer contract
- [ ] Keep `title/body/evidence` semantics consistent across endpoints

### R3.3 Tests
- [ ] API tests for family-specific filtering and lane separation
- [ ] UI adapter tests for payload compatibility

---

## 5. Phase R4 — Observability and governance closure

### R4.1 Metrics
- [ ] Producer lag metric
- [ ] Unified materialization lag metric
- [ ] Delivery lag metric
- [ ] Dedupe count metric
- [ ] Suppression ratio metric
- [ ] Symbol churn metric

### R4.2 Governance
- [ ] Update self-audit pass-state only after evidence exists
- [ ] Update taskboard status per slice with explicit residual risk
- [ ] Record evidence in ledger/progress after each slice

---

## 6. Close criteria (must all pass)

1. `B01..D08` tasks no longer `REOPENED` and each has code/test/evidence links.
2. Runtime endpoint family matches TECH_SPEC or TECH_SPEC is revised with formal sign-off.
3. Delivery lifecycle endpoints and persistence exist with tenant-safe behavior.
4. OpenAPI contract gates pass for pagination, envelope, auth, and rate-limit semantics.
5. `./start_dev.ps1` smoke remains healthy after remediation slices.

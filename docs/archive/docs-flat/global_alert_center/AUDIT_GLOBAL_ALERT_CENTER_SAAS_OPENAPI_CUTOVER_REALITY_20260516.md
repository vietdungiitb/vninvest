# AUDIT REPORT — Global Alert Center SaaS OpenAPI Cutover (Reality Check)

Ngày audit: 2026-05-16  
Auditor: Copilot (GPT-5.3-Codex)  
Mục tiêu: Đối chiếu tài liệu cutover Global Alert Center với code thực tế đang chạy trong workspace, không tô hồng, không giảm nhẹ lỗi.

---

## 1) Executive Summary

Kết quả tổng thể: **FAIL-GATE (Architecture + Contract)**

Mặc dù taskboard và progress đang thể hiện đa số wave đã DONE, implementation hiện tại vẫn thiếu các thành phần nền tảng bắt buộc theo TECH_SPEC cho SaaS-native domain và OpenAPI contract family.

### Severity distribution

- Critical: 2
- High: 4
- Medium: 2

### Kết luận điều hành

1. Có thể chạy được ở mức skeleton cho unified alert feed.
2. Chưa đạt chuẩn kiến trúc SaaS-native theo spec (thiếu delivery domain entities).
3. Chưa đạt chuẩn OpenAPI contract family theo spec (endpoint family drift, contract coverage chưa đầy đủ).
4. Cần re-open nhiều task đã đánh dấu DONE để tránh governance drift.

---

## 2) Audit Scope And Sources

### Tài liệu chuẩn được đối chiếu

1. `docs/GLOBAL_ALERT_CENTER_SAAS_OPENAPI_CUTOVER_HANDOFF_MASTER_20260516.md`
2. `docs/IMPLEMENTATION_PLAN_GLOBAL_ALERT_CENTER_SAAS_OPENAPI_CUTOVER_20260516.md`
3. `docs/TECH_SPEC_GLOBAL_ALERT_CENTER_SAAS_OPENAPI_CUTOVER_20260516.md`
4. `docs/TASKBOARD_GLOBAL_ALERT_CENTER_SAAS_OPENAPI_CUTOVER_20260516.md`
5. `docs/GLOBAL_ALERT_CENTER_SAAS_OPENAPI_CUTOVER_TRACEABILITY_MATRIX_20260516.md`
6. `docs/GLOBAL_ALERT_CENTER_SAAS_OPENAPI_CUTOVER_SELF_AUDIT_AND_TEST_PROTOCOL_20260516.md`

### Code surfaces được kiểm tra

1. `packages/core/backend/src/signal_intelligence/models.py`
2. `packages/core/backend/src/signal_intelligence/views.py`
3. `packages/core/backend/src/signal_intelligence/urls.py`
4. `packages/core/backend/src/signal_intelligence/api_urls.py`
5. `packages/core/backend/src/signal_intelligence/materializers.py`
6. `packages/core/backend/src/signal_intelligence/serializers.py`
7. `packages/core/backend/src/signal_intelligence/tests/test_materializers.py`
8. `packages/core/backend/src/vninvest_core/urls.py`
9. `packages/core/backend/src/vninvest_core/settings.py`
10. `packages/web/src/adapters/coreApiAdapter.js`
11. `packages/web/src/pages/AlertCenterPage.js`

---

## 3) Findings (Ordered By Severity)

## F-001 (CRITICAL) — Missing SaaS-native delivery entities required by spec

### Requirement baseline

TECH_SPEC yêu cầu các entity:

- `MarketAnomalyEvent`
- `AdvisorySignalEvent`
- `UserAlertDelivery`
- `UserAlertPreference`

### Code reality

Trong signal_intelligence models hiện tại chỉ có:

- `UnifiedAlert`
- `WhaleAlertCanonical`
- `OrderFlowEvent`

Không có 4 entity bắt buộc ở trên.

### Impact

1. Không có persistence cho per-user delivery state (`new`, `seen`, `acknowledged`, `muted`, `suppressed`).
2. Không có dữ liệu chuẩn cho mute/snooze/cooldown ở tầng domain.
3. Dễ tạo illusion “delivery đúng theo user” trong khi chỉ đang filter symbol nhất thời.

### Gate status

Fail `C01` DoD trong implementation plan.

---

## F-002 (CRITICAL) — Endpoint family in spec not implemented in runtime

### Requirement baseline

TECH_SPEC định nghĩa contract family:

- `/core/v1/signals/alert-center/feed`
- `/core/v1/signals/alert-center/summary`
- `/core/v1/signals/alert-center/events/{alert_id}`
- `/core/v1/signals/alert-center/symbols/{symbol}/context`
- `/core/v1/signals/alert-center/events/{alert_id}/ack`
- `/core/v1/signals/alert-center/preferences/mute`
- `/core/v1/signals/ai-alerts/feed`
- `/core/v1/signals/ai-alerts/summary`

### Code reality

Runtime path hiện tại vẫn là:

- `unified-alert`
- `unified-alert/delivery`
- `whale-feed`
- `signals/order-flow/<symbol>/`

### Impact

1. Contract drift giữa spec và runtime.
2. Consumer bám spec sẽ không gọi được API thực tế.
3. DONE-state ở taskboard không còn tin cậy khi đối chiếu theo contract đích.

### Gate status

Fail `B03` DoD trong implementation plan.

---

## F-003 (HIGH) — Alert taxonomy drift from hard rule

### Requirement baseline

Handoff master khóa main feed gồm: `whale`, `dark_flow`, `price_shock`, `stale_quote`, `system`.

### Code reality

1. Alert type choices dùng `signal` và `system`, không có `price_shock` và `stale_quote` explicit type.
2. Materializer map stale quote thành `system`.
3. Materializer map market anomaly thành `signal`.
4. Lane classifier main/ai dựa trên `signal/system` thay vì family explicit theo spec.

### Impact

1. Mất semantic clarity của taxonomy.
2. Giảm khả năng policy routing, analytics và traceability theo family.
3. Tăng nguy cơ regression khi mở rộng alert-center lane rules.

### Gate status

Fail `B01` DoD trong implementation plan.

---

## F-004 (HIGH) — Self-audit pass-state overclaims delivery completeness

### Requirement baseline

Self-audit đánh dấu đã pass mục mute/snooze và delivery correctness.

### Code reality

Test coverage hiện thấy tập trung vào filter theo symbol + threshold và route registration, chưa chứng minh đầy đủ ack/mute/snooze state machine theo spec.

### Impact

1. Governance drift: tài liệu pass nhưng capability chưa đủ.
2. Release risk: team tưởng đã sẵn sàng sunset trong khi thiếu domain path quan trọng.

### Gate status

Fail integrity gate cho `D02` evidence quality.

---

## F-005 (HIGH) — OpenAPI contract for delivery endpoint is under-documented

### Requirement baseline

TECH_SPEC yêu cầu request/response schema rõ ràng và list endpoints có pagination contract hoàn chỉnh.

### Code reality

1. Client đang truyền `symbol`, `severity`, `page_size`, `cursor` cho delivery endpoint.
2. OpenAPI parameters ở delivery view hiện chủ yếu công bố `lane`, chưa phản ánh đầy đủ các filter thực dùng từ client.

### Impact

1. Contract docs không đủ cho external consumers.
2. Dễ sinh lỗi tích hợp dù code backend vẫn chạy với params đó.

### Gate status

Fail một phần `B03` contract gate.

---

## F-006 (HIGH) — Missing required feature endpoints: summary, ack, mute, context

### Requirement baseline

Spec yêu cầu các endpoint nghiệp vụ để hoàn tất vòng đời delivery.

### Code reality

Không thấy các route/view implement cho summary, ack, mute, context ở signal_intelligence runtime URL.

### Impact

1. UI/UX delivery lifecycle không hoàn chỉnh.
2. Không thể đạt mục tiêu “stateful per-user delivery” theo spec.

### Gate status

Fail `C01` và fail một phần `C02` DoD.

---

## F-007 (MEDIUM) — UI contract drift: `alert.summary` not in canonical serializer

### Requirement baseline

Feed item shape cần nhất quán với fields server cung cấp.

### Code reality

`AlertCenterPage` render `alert.summary`, nhưng serializer canonical của unified alert không có field `summary` (chỉ có `title`, `body`, ...).

### Impact

1. UI fallback “Không có tóm tắt” xuất hiện thường xuyên.
2. Làm giảm trust vào chất lượng dữ liệu feed.

---

## F-008 (MEDIUM) — Rate-limit semantics not explicit in current API config evidence

### Requirement baseline

Spec yêu cầu endpoint private phải có auth + rate-limit semantics.

### Code reality

Global REST_FRAMEWORK block đã có auth/permission và exception handler, nhưng chưa thấy bằng chứng throttle policy rõ ràng cho alert-center contract trong phần cấu hình được đối chiếu.

### Impact

1. Không đạt trọn vẹn contract gate theo tài liệu.
2. Rủi ro overload nếu traffic spike vào feed endpoints.

---

## 4) Claim Verification Matrix (User Report vs Code Reality)

| Claim | Verdict | Note |
|---|---|---|
| Thiếu `MarketAnomalyEvent`, `AdvisorySignalEvent`, `UserAlertDelivery`, `UserAlertPreference` | ✅ Đúng | Chưa thấy entity tương ứng trong models hiện hành |
| Endpoint spec và code lệch (`alert-center/*` vs `unified-alert/*`) | ✅ Đúng | Contract family drift rõ ràng |
| Thiếu endpoint summary/ack/mute/context | ✅ Đúng | Chưa có route/view tương ứng |
| AI lane chưa tách chuẩn domain | ✅ Đúng một phần | Có lane filter runtime nhưng chưa có domain objects như spec |
| `AlertCenterPage` dùng `alert.summary` nhưng backend không có field | ✅ Đúng | UI-contract drift thực tế |
| `coreApiAdapter` có thể 404 vì thiếu `signals/` prefix | ❌ Sai trong cấu hình hiện tại | Base `/core/v1` + backend runtime path `unified-alert` vẫn khớp |
| Thiếu observability metrics theo spec mục 10 | ✅ Đúng một phần | Chưa có bằng chứng rõ cho bộ lag/dedupe/suppression/churn metrics chuyên biệt alert-center |

---

## 5) Residual Risk Register

1. **Release governance risk**: DONE-state không phản ánh mức hoàn thiện thực tế theo spec.
2. **Product risk**: người dùng không có vòng đời ack/mute/snooze đúng nghĩa.
3. **Integration risk**: external client dựa OpenAPI spec hiện sẽ lệch endpoint/runtime behavior.
4. **Observability risk**: thiếu telemetry chuẩn cho producer/materialization/delivery lag.

---

## 6) Required Re-open Proposal (No Softening)

Đề xuất re-open các task sau trong taskboard:

1. **B01** — Alert taxonomy + canonical fact models
2. **B03** — OpenAPI alert-center contracts
3. **C01** — Per-user delivery projection
4. **D02** — Parity/shadow evidence integrity (self-audit pass-state correction)
5. **D08** — signal_intelligence canonical alert model wave

Lý do: các task trên đang có khoảng cách đáng kể giữa DoD tài liệu và code thực tế.

---

## 7) Remediation Plan To Raise Code Quality

### Phase R1 — Domain completion (critical)

1. Bổ sung models + migrations:
   - `MarketAnomalyEvent`
   - `AdvisorySignalEvent`
   - `UserAlertDelivery`
   - `UserAlertPreference`
2. Thiết lập service layer cho state transitions: new -> seen -> acknowledged -> muted/suppressed.
3. Bổ sung unit tests cho delivery state machine và tenant isolation.

### Phase R2 — Contract correction (critical)

1. Implement endpoint family đúng spec dưới `/core/v1/signals/alert-center/*` và `/core/v1/signals/ai-alerts/*`.
2. Giữ compat routes (nếu cần) ở chế độ bridge-only có deprecation marker rõ ràng.
3. Đồng bộ OpenAPI parameters với thực usage (`lane`, `symbol`, `severity`, `cursor`, `page_size`, `session_date`).

### Phase R3 — Taxonomy and payload consistency (high)

1. Chuẩn hóa `alert_type` để có `price_shock`, `stale_quote` explicit.
2. Cập nhật lane classifier và materializers theo taxonomy mới.
3. Đồng bộ UI payload (`summary`) với serializer contract hoặc thay UI dùng `body` chuẩn hóa.

### Phase R4 — Observability and hard gates (high)

1. Thêm metrics bắt buộc: producer lag, materialization lag, delivery lag, dedupe count, suppression ratio, churn.
2. Cập nhật self-audit sang trạng thái truthful-by-evidence.
3. Block DONE-state nếu thiếu bằng chứng test và payload snapshot.

---

## 8) Acceptance Criteria For Closing This Audit

Chỉ được đóng audit khi đồng thời đạt:

1. Endpoint family runtime khớp spec hoặc spec được sửa chính thức và traceability matrix cập nhật tương ứng.
2. Delivery domain entities và stateful APIs tồn tại, có test pass.
3. Taxonomy chính xác theo hard rules.
4. OpenAPI contract đầy đủ params/errors/pagination semantics.
5. Self-audit và taskboard phản ánh đúng tình trạng thực, không over-claim.

---

## 9) Final Verdict

**Current verdict: NOT READY FOR TRUE SAAS-NATIVE CUTOVER.**

Code đã có nền vận hành tối thiểu, nhưng chưa đạt chuẩn kiến trúc SaaS-native và OpenAPI design như tài liệu chuẩn đang cam kết.

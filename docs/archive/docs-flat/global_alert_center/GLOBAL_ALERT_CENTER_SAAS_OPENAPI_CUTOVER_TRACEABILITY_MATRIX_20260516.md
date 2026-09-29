# Traceability Matrix — Global Alert Center SaaS OpenAPI Cutover
**Ngày**: 2026-05-16

| Requirement ID | Yêu cầu | Source | Planned Tasks | Validation |
|---|---|---|---|---|
| GAC-01 | `global symbol matrix` là foundation duy nhất của alert-center | User direction + global matrix hard rules | F01, F02, F03 | Registry tests + operator summary evidence |
| GAC-02 | Detection toàn cục, delivery theo user | User direction | B01, B02, C01 | Delivery projection tests + tenant isolation tests |
| GAC-03 | Main feed chỉ chứa alert time-critical | User direction | B01, B03, C02 | API contract tests + UI smoke |
| GAC-04 | AI Alerts là lane riêng | User direction | B01, B03, C02 | AI lane API/UI tests |
| GAC-05 | Mọi contract mới phải qua `/core/v1/` | OpenAPI constitution + SaaS migration | B03, C02, D01 | Schema generation + adapter tests |
| GAC-06 | packages/web là UI target, dùng `coreApiAdapter` | SaaS migration hard rule | C02 | Adapter tests + packages/web smoke |
| GAC-07 | Không còn browser-side synthesis cho alert nghiệp vụ | Audit findings | B02, D01 | frontend regression tests + code review grep |
| GAC-08 | Không mở thêm compat/legacy bridge mới | Full independence + SaaS migration | B03, D01, D02 | Route audit + code review |
| GAC-09 | Không được bypass shadow/parity/soak gate | SaaS migration hard rules | D02 | Rollout evidence + self-audit fail gate |
| GAC-10 | Legacy alert paths chỉ được sunset sau parity | SaaS migration + full independence | D02 | Shadow run report + parity dashboard |

---

## Reality-check status (2026-05-16)

| Requirement ID | Reality status | Evidence summary |
|---|---|---|
| GAC-01 | ✅ PASS (partial scope) | Foundation registry/coverage/planner path hiện hữu và có test ở market_data/service_ops waves |
| GAC-02 | ✅ PASS | Delivery projection đã có stateful persistence + user-scope controls với API tests cho cross-user ack block và mute filtering |
| GAC-03 | ✅ PASS (current scope) | Main feed hỗ trợ family truth `price_shock/stale_quote/whale/dark_flow/system` và đã có regression cho family-filter path |
| GAC-04 | ✅ PASS | AI lane endpoint family `/core/v1/signals/ai-alerts/*` hoạt động, có feed/summary tests và lane-isolation regression |
| GAC-05 | ✅ PASS | Native contract family `/core/v1/signals/alert-center/*` và `/core/v1/signals/ai-alerts/*` đã chạy end-to-end qua backend + adapter + UI tests |
| GAC-06 | ✅ PASS (current contract) | `packages/web` gọi qua `coreApiAdapter`, không direct fetch business endpoints |
| GAC-07 | ✅ PASS (current scope) | Frontend bridge đã bỏ browser-side synthesis cho alert nghiệp vụ và bám server truth từ native alert-center delivery/feed |
| GAC-08 | ✅ PASS (current evidence) | Chưa thấy compat route business logic mới cho alert-center trong phạm vi audit này |
| GAC-09 | 🟠 PARTIAL | Evidence package đã có tại `GLOBAL_ALERT_CENTER_SAAS_OPENAPI_CUTOVER_PARITY_SHADOW_EVIDENCE_20260516.md`; chưa đủ production soak/shadow horizon để close hoàn toàn |
| GAC-10 | 🟠 PARTIAL | Legacy sunset vẫn chưa thể close vì chưa có parity dashboard + shadow run >= 3 ngày trade thật |

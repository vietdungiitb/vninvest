# ĐÁNH GIÁ KIẾN TRÚC & GAP ANALYSIS — VNInvest SaaS Transformation

**Ngày:** 2026-05-03  
**Trạng thái:** Root anchor document — bắt buộc đọc trước mọi slice SAAS-12 trở đi  
**Mục tiêu:** Ghi lại toàn bộ khoảng cách (gap) giữa kiến trúc mục tiêu SaaS đã được thiết kế và trạng thái codebase thực tế sau khi SAAS-11 hoàn thành. Tài liệu này làm nền cho bộ execution plan giải quyết từng gap.

---

## 1. Tóm tắt điều hành

Sau khi hoàn thành SAAS-00 đến SAAS-11, VNInvest đã có:
- Package scaffolding cho `packages/core`, `packages/web`, `packages/vip-app`, `packages/mobile`
- Shell host infrastructure với dual-run flag
- Package-owned screens cho toàn bộ mobile surfaces
- Production manifest deploy qua package-shell

**Tuy nhiên**, mô hình SaaS thực sự yêu cầu nhiều hơn scaffolding. Đánh giá chi tiết xác định **10 gap cốt lõi** mà nếu không giải quyết, dự án sẽ dừng lại ở "monolith có package wrapper" thay vì SaaS thực sự.

---

## 2. Trạng thái hiện tại theo từng package

### 2.1 `packages/core`

| Hạng mục | Kỳ vọng SaaS | Thực tế hiện tại | Gap |
|---|---|---|---|
| Runtime | Django/DRF stack đầy đủ | `ThreadingHTTPServer` stdlib stub | **CRITICAL** |
| Models | Domain models tách biệt theo bounded context | Không có model nào trong packages/core | **CRITICAL** |
| Business logic | Nghiệp vụ nằm trong packages/core | Toàn bộ logic còn ở `backend/portfolio/` | **CRITICAL** |
| API surface | `/core/v1` DRF views với versioned contracts | Chỉ có stub endpoints trả JSON tĩnh | **HIGH** |
| Worker/beat | Celery worker + beat trong core boundary | `worker_stub.py` / `beat_stub.py` — không có Celery thật | **HIGH** |
| Auth integration | Tích hợp với CoreTenant/CoreServiceAccount | Không có auth middleware thật | **HIGH** |
| Tests | Unit + integration tests thật | Chỉ có `test_runtime_baseline.py` kiểm tra stub | **MEDIUM** |

### 2.2 `packages/web`

| Hạng mục | Kỳ vọng SaaS | Thực tế hiện tại | Gap |
|---|---|---|---|
| Route coverage | Tất cả SaaS routes trong packages/web | Có 7 shell pages + route catalog | **MEDIUM** |
| Build targets | `community`, `saas`, `vip` từ một source | Chưa có build variant config | **MEDIUM** |
| Data fetching | Gọi `/core/v1` contracts | Vẫn gọi legacy `/api/v1` paths | **MEDIUM** |

### 2.3 `packages/mobile`

| Hạng mục | Kỳ vọng SaaS | Thực tế hiện tại | Gap |
|---|---|---|---|
| Screen coverage | Tất cả screens trong packages/mobile | ✅ SAAS-11 hoàn thành — 7 screens | **NONE** |
| API service paths | Gọi `/core/v1` versioned contracts | Vẫn gọi legacy paths (`/stock-management/`, `/portfolio/`, `/whale-analytics/`) | **HIGH** |
| Auth flow | Gọi package-core auth | Gọi legacy `/api/auth/` | **MEDIUM** |

### 2.4 `shared/api-contracts`

| Contract file | Kỳ vọng SaaS | Thực tế hiện tại | Gap |
|---|---|---|---|
| `capability-bootstrap.contract.json` | ✅ Có | ✅ Có | NONE |
| `build-target.contract.json` | ✅ Có | ✅ Có | NONE |
| `session-payload.contract.json` | ✅ Có | ✅ Có | NONE |
| `symbol-snapshot.contract.json` | ✅ Bắt buộc | ❌ Thiếu | **HIGH** |
| `session-facts.contract.json` | ✅ Bắt buộc | ❌ Thiếu | **HIGH** |
| `unified-alert.contract.json` | ✅ Bắt buộc | ❌ Thiếu | **HIGH** |
| `whale-feed-aggregate.contract.json` | ✅ Bắt buộc | ❌ Thiếu | **HIGH** |
| `tenant-lifecycle.contract.json` | ✅ Bắt buộc | ❌ Thiếu | **MEDIUM** |
| `partner-pat.contract.json` | ✅ Bắt buộc | ❌ Thiếu | **MEDIUM** |

### 2.5 `backend/portfolio/models.py`

| Vấn đề | Mô tả | Gap |
|---|---|---|
| Tight coupling | `CoreTenant`, `CoreServiceAccount`, `CorePATCredential` nằm cùng file với 1000+ dòng legacy models | **CRITICAL** |
| Bounded context vi phạm | Platform/identity models không tách khỏi business/portfolio models | **HIGH** |
| Migration risk | Mọi thay đổi trên một model đều risk breakage cho toàn bộ | **HIGH** |

### 2.6 API Design

| Vấn đề | Mô tả | Gap |
|---|---|---|
| Cursor pagination | Data APIs không có cursor pagination — N+1 risk với lượng data lớn | **HIGH** |
| Request traceability | Không có `X-Request-ID` / `X-Trace-ID` propagation | **MEDIUM** |
| API versioning | `/api/v1` nhưng không có versioning middleware thực sự | **MEDIUM** |

### 2.7 `packages/opencore`

| Hạng mục | Kỳ vọng SaaS | Thực tế hiện tại | Gap |
|---|---|---|---|
| Distribution bundle | Self-hostable community package | Chưa có implementation | **LOW** |
| Commercial funnel | Upgrade journey từ community → SaaS | Chưa có | **LOW** |

---

## 3. Danh sách 10 gap cốt lõi (ưu tiên giải quyết)

### Gap 1 — `packages/core` là stub, không phải Django thực (CRITICAL)

**Mô tả:** `api_stub.py` hiện tại dùng `ThreadingHTTPServer` từ stdlib Python, không phải Django/DRF. Không có model nào, không có view nào, không có auth middleware nào.

**Tác động:** Mọi route `/core/v1` chỉ trả JSON static. Không thể phục vụ business logic thực tế.

**Giải pháp:** Cần SAAS-13 — extraction packages/core thành Django app đầy đủ.

---

### Gap 2 — Thiếu data-plane contracts trong `shared/api-contracts/` (HIGH)

**Mô tả:** Ba contracts hiện có chỉ cover capability bootstrap, build target và session payload. Thiếu contracts cho các luồng dữ liệu chính: symbol snapshot, session facts, unified alert, whale feed aggregate.

**Tác động:** Không có contract chuẩn → frontend và mobile mỗi nơi tự format → divergence không kiểm soát được.

**Giải pháp:** SAAS-12 — shared contract lock.

---

### Gap 3 — Mobile services vẫn gọi legacy paths (HIGH)

**Mô tả:** `packages/mobile/src/services/portfolioApi.ts`, `watchlistApi.ts` vẫn hardcode `/stock-management/`, `/portfolio/`, `/whale-analytics/`. Khi legacy backend bị decommission, mobile sẽ break hoàn toàn.

**Tác động:** Mobile không SaaS-ready kể cả khi đã có package-owned screens.

**Giải pháp:** SAAS-12 — migrate mobile services sang `/core/v1` versioned paths sau khi contracts được lock.

---

### Gap 4 — `backend/portfolio/models.py` tight coupling (CRITICAL)

**Mô tả:** `CoreTenant` (line ~1010), `CoreServiceAccount` (line ~1131), `CorePATCredential` (line ~1213) nằm trong cùng file với toàn bộ portfolio/market models. Không có bounded context separation.

**Tác động:** Không thể decommission legacy backend mà không risk mất identity/access models. Không thể test core models độc lập.

**Giải pháp:** SAAS-13 — domain extraction, tạo standalone models trong `packages/core/backend/`.

---

### Gap 5 — Data-plane read models không được materialized (HIGH)

**Mô tả:** Theo SAAS-04, `symbol_snapshot`, `session_facts`, `unified_alert` đã được xác nhận là "serving truth" về mặt design. Tuy nhiên, chưa có Django models và Celery materializer jobs tương ứng trong `packages/core`.

**Tác động:** Serving path vẫn phụ thuộc vào raw scan legacy models, không có facts-first path thực sự.

**Giải pháp:** SAAS-14 — data-plane serving models materialization trong packages/core.

---

### Gap 6 — Cursor pagination thiếu (HIGH)

**Mô tả:** Tất cả data APIs hiện tại dùng offset pagination hoặc không pagination. Không có cursor-based pagination cho whale alerts, transactions, audit logs.

**Tác động:** Performance degradation với large dataset; không scale được cho enterprise B2B tenant với nhiều data.

**Giải pháp:** Thêm vào SAAS-13 scope hoặc SAAS-14 scope.

---

### Gap 7 — Request traceability thiếu (MEDIUM)

**Mô tả:** Không có `X-Request-ID` header generation và propagation qua Django middleware. Audit logs không liên kết được với request trail.

**Tác động:** Debugging và audit cho enterprise B2B không đáp ứng được enterprise grade.

**Giải pháp:** Thêm vào SAAS-13 scope — traceability middleware trong packages/core.

---

### Gap 8 — `packages/opencore` chưa hoàn chỉnh implementation (LOW)

**Mô tả:** `packages/opencore` theo kiến trúc là community/self-host distribution bundle. Hiện tại đã có bootstrap assets (compose overlay, activation/distribution manifests, public-safe docs) và build producer `packages/web/scripts/build-community.mjs`, nhưng release automation end-to-end vẫn còn thiếu.

**Tác động:** Community funnel và upgrade journey từ community → SaaS vẫn thiếu release publication đầy đủ.

**Giải pháp:** SAAS-16 (build pipeline wired) — hoàn tất release automation và artifact publication sau SAAS-15.

---

### Gap 9 — `packages/web` data fetching chưa migration (MEDIUM)

**Mô tả:** Shell pages trong packages/web khi được render vẫn gọi legacy API paths qua frontend/src/api/client.js. Chưa có adapter layer thống nhất gọi `/core/v1`.

**Tác động:** Khi legacy backend bị decommission, web package sẽ cần refactor lớn.

**Giải pháp:** SAAS-13 hoặc SAAS-14 — tạo `packages/web/src/adapters/coreApiAdapter.js`.

---

### Gap 10 — SAAS-15 (legacy decommission) không an toàn khi chưa có các gate (CRITICAL)

**Mô tả:** Theo kế hoạch, legacy roots (`backend/`, `frontend/`, `mobile-app/`) sẽ bị decommission. Nhưng hiện tại chưa có proof nào rằng package layer có thể thay thế hoàn toàn legacy runtime cho tất cả business flows.

**Tác động:** Decommission sớm sẽ break production cho tất cả users.

**Giải pháp:** SAAS-15 — formal pre-conditions checklist và go/no-go gate trước khi decommission.

---

## 4. Ma trận gap → slice

| Gap # | Mức độ | Slice giải quyết | Phụ thuộc |
|---|---|---|---|
| Gap 2 — Thiếu data-plane contracts | HIGH | SAAS-12 | SAAS-11 ✅ |
| Gap 3 — Mobile legacy paths | HIGH | SAAS-12 | SAAS-12 contracts phải xong trước |
| Gap 1 — packages/core là stub | CRITICAL | SAAS-13 | SAAS-12 |
| Gap 4 — models.py tight coupling | CRITICAL | SAAS-13 | SAAS-12 |
| Gap 7 — Request traceability | MEDIUM | SAAS-13 | SAAS-13 base |
| Gap 5 — Data-plane read models | HIGH | SAAS-14 | SAAS-13 |
| Gap 6 — Cursor pagination | HIGH | SAAS-14 | SAAS-13 |
| Gap 9 — packages/web data fetching | MEDIUM | SAAS-14 | SAAS-13 |
| Gap 10 — Legacy decommission gate | CRITICAL | SAAS-15 | SAAS-14 |
| Gap 8 — packages/opencore | LOW | SAAS-16 | SAAS-15 |

---

## 5. Điều kiện "SaaS thực sự"

Dự án đạt mô hình SaaS thực sự khi TẤT CẢ các điều kiện sau đều đúng:

1. `packages/core` chạy Django/DRF đầy đủ với domain models, views, auth middleware và Celery workers.
2. `shared/api-contracts` có contracts cho tất cả data-plane flows; không còn client nào gọi unversioned API.
3. `packages/mobile`, `packages/web`, `packages/vip-app` tất cả gọi `/core/v1` versioned contracts — không gọi legacy paths.
4. Tenant lifecycle: onboard/activate/upgrade/downgrade/suspend/deprovision đều có truth trong `packages/core`, không cần DB manual.
5. Data-plane: `symbol_snapshot`, `session_facts`, `unified_alert` được materialized bởi Celery jobs trong `packages/core`, không phải raw scan từ `backend/portfolio`.
6. Legacy roots không còn trong normal operation path — chỉ còn là read-only fallback trong decommission window.
7. Cursor pagination trên tất cả list APIs.
8. `X-Request-ID` propagation qua toàn bộ stack.
9. Go/no-go gate SAAS-15 pass với evidence đầy đủ.

---

## 6. Tài liệu liên quan

Đọc theo thứ tự:

1. `docs/SAAS_ARCHITECTURE_GAPS_ASSESSMENT_20260503.md` ← tài liệu này
2. `docs/SAAS_COMPLETION_MASTER_ROADMAP_20260503.md` — tổng lộ trình giải quyết
3. `docs/SAAS12_SHARED_CONTRACT_LOCK_EXECUTION_PLAN_20260503.md` — SAAS-12
4. `docs/SAAS13_PACKAGES_CORE_DOMAIN_EXTRACTION_PLAN_20260503.md` — SAAS-13
5. `docs/SAAS14_DATA_PLANE_SERVING_MODELS_PLAN_20260503.md` — SAAS-14
6. `docs/SAAS15_LEGACY_DECOMMISSION_GATES_20260503.md` — SAAS-15
7. `docs/ENTERPRISE_B2B_MCP_TRANSFORMATION_SAAS_CUTOVER_TASKBOARD_20260503.md` — cập nhật taskboard

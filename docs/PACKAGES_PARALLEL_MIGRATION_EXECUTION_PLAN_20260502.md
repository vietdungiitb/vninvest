# PACKAGES PARALLEL MIGRATION EXECUTION PLAN

**Date:** 2026-05-02  
**Status:** Owner-approved execution plan  
**Purpose:** Chốt kế hoạch thực thi chi tiết cho mô hình `packages-first parallel migration`, trong đó kiến trúc mới được xây hoàn toàn trong `packages/` và `shared/` cho tới khi đủ ổn định để cutover và loại bỏ kiến trúc cũ. Trong mô hình nay, `packages/opencore` la package funnel/distribution quan trong giua community va VIP.

**Companion artifacts:**

- [CORE_WEB_VIP_APP_INTEGRATED_ARCHITECTURE_20260502](./CORE_WEB_VIP_APP_INTEGRATED_ARCHITECTURE_20260502.md)
- [ENTERPRISE_B2B_MCP_TRANSFORMATION_EXECUTION_REBASELINE_20260501](./ENTERPRISE_B2B_MCP_TRANSFORMATION_EXECUTION_REBASELINE_20260501.md)
- [REPO_STRATEGY_AND_EXECUTION_ROADMAP_20260501](./REPO_STRATEGY_AND_EXECUTION_ROADMAP_20260501.md)
- [CODEBASE_RESTRUCTURING_PROPOSAL_20260501](./CODEBASE_RESTRUCTURING_PROPOSAL_20260501.md)
- [WEB_VIP_APP_SHARED_FRONTEND_BLUEPRINT_20260502](./WEB_VIP_APP_SHARED_FRONTEND_BLUEPRINT_20260502.md)
- [PACKAGE_TRACK_FOUNDATION_BASELINE_HANDOFF_MASTER_20260502](./PACKAGE_TRACK_FOUNDATION_BASELINE_HANDOFF_MASTER_20260502.md)

---

## 1. Quyết định điều hành đã chốt

1. Kiến trúc mới được xây trong `packages/core`, `packages/web`, `packages/opencore`, `packages/mobile`, `packages/vip-app`, và `shared`.
2. `backend/`, `frontend/`, `mobile-app/`, `opennews-main/`, `infra/` không còn là nơi triển khai kiến trúc mới; chúng chỉ giữ vai trò runtime đang chạy, reference behavior và rollback lane.
3. Không clone frontend cho VIP hay OpenCore. `packages/web` là shared frontend source duy nhất; `packages/opencore` package hoa community/self-host funnel, còn `packages/vip-app` không chứa frontend.
4. Không bulk-move legacy folders sang `packages/` bằng một PR rename lớn.
5. Sau khi package track đạt parity và cutover ổn định, kiến trúc cũ phải bị decommission thay vì duy trì song song vô thời hạn.

---

## 2. Non-goals ở giai đoạn này

1. Không tách repo ngay.
2. Không đưa Kong vào trước khi partner APIs, quota và route governance ổn định.
3. Không đưa ClickHouse vào trước khi facts/materialization trên PostgreSQL đã được chứng minh là chưa đủ.
4. Không xây frontend thứ hai cho VIP.
5. Không biến `vip-app` thành bản sao thu nhỏ của `core`.
6. Không biến `opencore` thành backend truth thứ hai cho entitlement/quota/billing.

---

## 3. Cấu trúc mục tiêu đã được phê duyệt

```text
vninvest/
├── packages/
│   ├── core/
│   ├── web/
│   ├── opencore/
│   ├── mobile/
│   └── vip-app/
├── shared/
│   ├── api-contracts/
│   └── constants/
├── backend/          ← legacy runtime/reference tới cutover
├── frontend/         ← legacy runtime/reference tới cutover
├── mobile-app/       ← legacy runtime/reference tới cutover
├── opennews-main/    ← legacy runtime/reference tới cutover
└── infra/            ← legacy runtime/reference tới cutover
```

---

## 4. Hard rules bắt buộc

1. Mọi hạng mục kiến trúc mới phải đi vào `packages/*` hoặc `shared/*`.
2. Legacy paths chỉ nhận hotfix hoặc parity fix khi thật sự cần để giữ runtime hiện hành hoặc hỗ trợ đối chiếu.
3. `packages/web` chỉ giao tiếp với `packages/core` qua APIs/contracts; không import backend code trực tiếp.
4. `packages/opencore` chỉ package hoa build artifacts tu `packages/web` va tieu thu commercial/user APIs tu `packages/core`; khong fork frontend source va khong so huu backend truth rieng.
5. `packages/vip-app` chỉ giao tiếp với `packages/core` qua versioned partner/global APIs và các tool contracts phù hợp.
6. Browser VIP không được cầm PAT hoặc machine credential của `core`.
7. `shared/` là SSOT cho contracts/constants dùng chung giữa các packages.
8. Không được mở thêm một nhánh frontend độc lập kiểu `vip-frontend`, `admin-frontend` hay `opencore-frontend`.
9. Với mỗi handoff pack đang active, phải có một taskboard sống phản ánh đúng `completed / in-progress / next` slices; `CODE_CHANGE_AUDIT_LEDGER` và `PROGRESS_DASHBOARD` là bằng chứng lịch sử, không thay cho live status board.
10. Mỗi slice bị pause hoặc complete phải để lại handoff packet tối thiểu gồm: trạng thái hiện tại, lệnh validation pass cuối cùng, bước kế tiếp được khuyến nghị và residual risk để phiên sau resume mà không đoán.

---

## 5. Kế hoạch thực thi theo phase

### 5.1 Phase 0 — Governance freeze

**Mục tiêu:** Khóa execution mode và ngăn drift ngay từ đầu.

**Việc phải làm:**

1. Chốt rõ file/dir nào là legacy hotfix-only, file/dir nào là package implementation target.
2. Chốt evidence model: contract parity, build parity, auth parity, UX parity.
3. Chốt cutover gates và rollback gates ở cấp tài liệu trước khi scaffold.
4. Chỉ định control surfaces sống cho nhiều phiên: taskboard là trạng thái hiện hành, audit ledger là log bằng chứng chi tiết, progress dashboard là mirror cho auditor, evidence template là handoff packet bắt buộc.

**Exit criteria:**

1. Owner phê duyệt execution plan này.
2. Bộ docs SSOT, roadmap và restructuring proposal cùng dùng một sequencing.
3. Control surfaces cho nhiều phiên đã được khóa để không có hai session cùng đoán trạng thái từ các nguồn khác nhau.

### 5.2 Phase 1 — Scaffold `packages/` và `shared/`

**Mục tiêu:** Tạo workspace mới để nhóm code có thể triển khai kiến trúc mới mà không chạm legacy runtime.

**Việc phải làm:**

1. Tạo skeleton cho `packages/core`, `packages/web`, `packages/opencore`, `packages/mobile`, `packages/vip-app`.
2. Tạo `shared/api-contracts` và `shared/constants`.
3. Bổ sung workspace/compose/dev helpers để package track có thể được build/test/run độc lập.

**Exit criteria:**

1. Package tree tồn tại và được IDE/CI nhìn thấy.
2. Có chỗ rõ ràng để triển khai từng workstream mà không phải sửa vào legacy runtime.

### 5.2A Phase 1.5 — Foundation baseline for `core`, `web`, `shared`

**Mục tiêu:** Biến scaffold thành baseline thật đủ để workstreams tiếp theo đi tiếp mà không tranh luận lại về package identity, route shell hay shared contracts.

**Việc phải làm:**

1. Tạo Python manifest, app skeleton và compose topology stub cho `packages/core`.
2. Tạo route catalog, navigation catalog và adapter seams cho `packages/web`.
3. Tạo ba contracts đầu tiên trong `shared/api-contracts`: build target, capability bootstrap, session payload.

**Exit criteria:**

1. `packages/core` compile pass ở mức source skeleton.
2. `packages/web` pass shell validation ở mức imports/exports/catalog integrity.
3. `shared/api-contracts` đã có baseline contract pack đầu tiên.

### 5.3 Phase 2 — Build `packages/core`

**Mục tiêu:** Dựng `core` mới theo boundaries đã chốt, nhưng bám sát semantics đã chứng minh từ runtime hiện tại.

**Việc phải làm:**

1. Dựng access/commercial foundation: tenant, service account, PAT, quota, billing, capability snapshot.
2. Dựng serving foundation: symbol snapshot, session facts, partner APIs, AI runtime contracts.
3. Giữ hướng Redis/PostgreSQL/Channels/Streams-first.

**Exit criteria:**

1. `packages/core` có contract surfaces đầu tiên đủ dùng cho `packages/web`, `packages/opencore` và `packages/vip-app`.
2. Các API/canonical models quan trọng đã có định nghĩa parity với legacy runtime.

### 5.4 Phase 3 — Build `packages/web`

**Mục tiêu:** Dựng shared frontend shell duy nhất cho SaaS, VIP, Community trong `packages/web`.

**Việc phải làm:**

1. Tạo `BUILD_TARGET`, route catalog, navigation catalog, capability bootstrap.
2. Chia features thành `shared`, `saas`, `vip`.
3. Dựng adapter seams rõ ràng cho `core` và `vip-app`.

**Exit criteria:**

1. `packages/web` build được ít nhất lane `saas` và `vip`.
2. Không có frontend thứ hai cho VIP.

### 5.5 Phase 4 — Build `packages/opencore`

**Mục tiêu:** Dựng package funnel/distribution cho Community, self-host va upgrade journey.

**Việc phải làm:**

1. Package hoa community/self-host build tu `packages/web` thanh release/distribution lane ro rang.
2. Bo sung install scripts, compose overlays, activation hooks va pricing/feature catalog public-safe.
3. Chot migration/onboarding path tu OpenCore len SaaS hoac VIP.

**Exit criteria:**

1. `packages/opencore` co the phan phoi lane Community/Pro-self-host ma khong fork frontend source.
2. OpenCore funnel su dung dung commercial/capability contracts tu `core`.

### 5.6 Phase 5 — Build `packages/vip-app`

**Mục tiêu:** Dựng thin local control plane cho VIP trong package track mới.

**Việc phải làm:**

1. Local auth, local RBAC, local secret vault, PAT connection management.
2. Prompt studio, provider key management, local audit/chat log, usage analytics tối thiểu.
3. Local APIs làm facade cho browser VIP và gateway lên `core`.

**Exit criteria:**

1. VIP browser chỉ đi qua `packages/vip-app` local APIs.
2. `packages/vip-app` không chứa market truth, signal truth hay frontend source riêng.

### 5.7 Phase 6 — Parity, shadow run, pilot

**Mục tiêu:** Chứng minh package track có thể thay thế legacy runtime.

**Việc phải làm:**

1. So sánh payloads, auth flow, capability gating, route behavior và UX outcomes giữa legacy và package track.
2. Chạy focused tests/builds theo từng workstream.
3. Nếu cần, chạy shadow traffic hoặc pilot rollout trước cutover.

**Exit criteria:**

1. Package track đạt parity ở các flows đã scope.
2. Runbook cutover và rollback đã sẵn sàng.

### 5.8 Phase 7 — Cutover và decommission legacy

**Mục tiêu:** Chuyển runtime chính sang packages và loại bỏ kiến trúc cũ.

**Việc phải làm:**

1. Chuyển compose, CI, workspace, scripts, deployment sang `packages/*`.
2. Để legacy runtime ở chế độ read-only fallback trong một khoảng ổn định ngắn.
3. Sau khi ổn định, xóa legacy paths và các docs/scripts không còn giá trị.

**Exit criteria:**

1. Runtime chính chạy hoàn toàn từ `packages/*`.
2. Legacy runtime đã bị gỡ khỏi luồng vận hành bình thường.

---

## 6. Cutover gates bắt buộc

Chỉ được cắt chuyển khi đồng thời đạt đủ các điều kiện sau:

1. Contract parity đã được chứng minh ở các API surfaces trọng yếu.
2. Build và focused validation suites của package track pass ổn định.
3. Auth model, capability gating và secret handling đã được kiểm tra lại trên package track.
4. Compose/CI/workspace có thể chạy trực tiếp theo package paths.
5. Có rollback runbook rõ ràng nếu cutover gặp sự cố.
6. Taskboard, audit ledger và progress dashboard khớp nhau trước khi mở cutover window.
7. Route coverage và runtime ownership của từng package phải được chốt bằng văn bản trước khi ban cutover.

### 6.1 Readiness gate matrix

| Gate | Mục tiêu | Minimum evidence | Pass khi |
|---|---|---|---|
| Parity gate | Chứng minh package track khớp contract, behavior và capability/routing cho flows ưu tiên | route catalog diff, payload snapshots, shell parity proofs | surfaces trọng yếu khớp expectation của current-code contract |
| Validation gate | Đảm bảo package build/test có thể lặp lại và không chỉ pass một lần | `npm run check:shell`, `compileall`, focused tests | ít nhất một vòng validation focused PASS ổn định cho lane đã chọn |
| Rollback gate | Có thể quay lại legacy runtime mà không đoán đường | rollback runbook, compose switchback path, restore order | runbook chỉ rõ kích hoạt, verify và restore path |
| Route coverage gate | Route families cốt lõi đã cover đủ cho cutover scope | route inventory, navigation inventory, missing-route list | không còn missing route trong scope đã freeze |
| Runtime ownership gate | Không còn ambiguity về package owner của runtime path | ownership matrix, adapter boundary notes, import/call graph review | package path là owner của runtime mới; legacy chỉ còn reference/fallback |
| Audit gate | Trạng thái slice phải khớp across board | taskboard diff, audit ledger entry, progress dashboard mirror, handoff packet | taskboard, ledger, progress và evidence packet đều đồng bộ |
| Approval gate | Chỉ ký cutover khi các gate trên đều xanh | completed gate matrix, signoff note, freeze window | owner review evidence pack và mở cutover window |

### 6.2 Cutover approval rule

Package track hiện tại chưa được xem là cutover-ready chỉ vì baseline tồn tại. Chỉ khi `PKG-01` đến `PKG-03` hoàn tất, cùng với parity/validation/rollback/route coverage/runtime ownership gates đều xanh, thì mới được chuyển sang Phase 7.

---

## 7. Checklist decommission legacy

1. Gỡ các đường dẫn runtime cũ khỏi compose, CI và workspace.
2. Gỡ các scripts/dev helpers chỉ phục vụ legacy paths.
3. Gỡ docs hướng dẫn triển khai bám trực tiếp vào legacy runtime nếu đã lỗi thời.
4. Đảm bảo không còn package mới nào import/call ngược vào legacy runtime internals.
5. Cập nhật audit ledger và progress dashboard cho mốc cutover/decommission.

---

## 8. Mapping workstreams vào package track

| Workstream | Package chính | Kết quả bắt buộc |
|---|---|---|
| Core foundation | `packages/core` | tenant, PAT, quota, billing, capability snapshot |
| Core serving | `packages/core` | symbol snapshot, chart/session facts, partner APIs |
| Web shared shell | `packages/web` | build targets, route/nav catalog, shared adapters |
| OpenCore distribution & funnel | `packages/opencore` | self-host bundle, activation, upgrade path, public-safe docs |
| Web admin surfaces | `packages/web` | operator admin, tenant admin, admin gating |
| VIP local backend | `packages/vip-app` | local auth, secret vault, local APIs |
| VIP AI & ops | `packages/vip-app` | prompt studio, provider keys, local analytics |
| Shared contracts | `shared` | API contracts, constants, additive change policy |

---

## 9. Kết luận

Kế hoạch này tồn tại để giữ đúng một nguyên tắc: **xây kiến trúc mới ở `packages/`, bảo vệ runtime hiện tại bằng lane song song, rồi cắt chuyển khi đủ bằng chứng thay vì sửa trực tiếp monolith đang chạy**.

Nếu một hạng mục không map được vào package track, không có parity gate rõ ràng, hoặc ngầm kéo đội quay lại sửa trực tiếp legacy runtime như nơi triển khai chính, thì hạng mục đó đang đi sai execution model đã được chốt.
# IMPLEMENTATION PLAN - Package Track Foundation Baseline

**Ngày**: 2026-05-02  
**Phạm vi chương trình**: Baseline đầu tiên cho `packages/core`, `packages/web`, `shared`  
**Level**: A (Major - tạo mới package-track code, contracts và execution docs)  
**Owner**: Platform Lead + Frontend Lead + Backend Lead  
**Trạng thái**: READY FOR IMPLEMENTATION HANDOFF

---

## 1. Business objective

### Vấn đề cần giải quyết

Package track đã có kiến trúc và scaffold, nhưng chưa có baseline thật để đội code tiếp tục xây theo cùng một trục.

Hiện trạng còn thiếu bốn mảnh nền tảng:

1. `packages/core` chưa có Python manifest và app skeleton đủ để trở thành điểm bắt đầu thật.
2. `packages/core/docker-compose.core.yml` mới chỉ là placeholder rỗng, chưa phản ánh topology mục tiêu.
3. `packages/web` chưa có shared shell artifacts cho route, navigation và backend adapter seams.
4. `shared/api-contracts` chưa có contract SSOT nào để các packages cùng bám.

### Mục tiêu nghiệp vụ

1. Khóa baseline đầu tiên cho package track mà không động vào runtime legacy.
2. Tạo bề mặt code đủ rõ để các slice sau có thể đi tiếp vào feature-level work thay vì tiếp tục tranh luận về structure.
3. Giảm rủi ro drift giữa `core`, `web`, `vip-app` bằng các contracts và adapter shapes đầu tiên.

---

## 2. Scope và non-scope

### In-scope

1. Tạo Python manifest cho `packages/core`.
2. Tạo app skeleton importable cho `packages/core/backend/src`.
3. Tạo contract folders tối thiểu trong `packages/core`.
4. Mở rộng `packages/core/docker-compose.core.yml` thành topology stub có tên service rõ.
5. Tạo `packages/web/src/app/routeCatalog.js`.
6. Tạo `packages/web/src/app/navigationCatalog.js`.
7. Tạo `packages/web/src/adapters/core/*` và `packages/web/src/adapters/vip-app/*`.
8. Tạo ba contracts đầu tiên trong `shared/api-contracts`.
9. Bổ sung validation path cho `packages/web` và `packages/core`.

### Out-of-scope

1. Không migrate code từ `backend/` sang `packages/core` theo kiểu bulk move.
2. Không dựng React app hoàn chỉnh trong `packages/web` ở slice này.
3. Không dựng runtime production-ready cho `packages/core` compose stack.
4. Không thêm public partner APIs thật hay read models thật ở `packages/core`.
5. Không sửa `frontend/src/*` hoặc `backend/*` để tiêu thụ package baseline mới.

---

## 3. Execution order bắt buộc

### Step 1 - Shared contracts before adapters

Tạo ba contract đầu tiên trong `shared/api-contracts` trước, vì route/navigation/adapters của `packages/web` phải biết chúng đang bám vào shape nào.

**Files target:**

1. `shared/api-contracts/build-target.contract.json`
2. `shared/api-contracts/capability-bootstrap.contract.json`
3. `shared/api-contracts/session-payload.contract.json`

**Exit criteria:**

1. Có schema/title/version rõ.
2. Contract additive-first, không chứa chi tiết implementation nội bộ.

### Step 2 - Build `packages/core` baseline

Tạo Python manifest và app skeleton để `packages/core` có thể được import/compile độc lập.

**Files target tối thiểu:**

1. `packages/core/pyproject.toml`
2. `packages/core/backend/src/vninvest_core/__init__.py`
3. `packages/core/backend/src/vninvest_core/app_manifest.py`
4. `packages/core/backend/src/vninvest_core/api_stub.py`
5. `packages/core/backend/src/vninvest_core/worker_stub.py`
6. `packages/core/backend/src/vninvest_core/beat_stub.py`
7. `packages/core/backend/src/vninvest_core/contracts/*`
8. `packages/core/docker-compose.core.yml`

**Exit criteria:**

1. Python compile pass cho `packages/core/backend/src`.
2. Compose file có service topology rõ ràng cho `core-api`, `core-worker`, `core-beat`, `core-redis`, `core-db`.

### Step 3 - Build `packages/web` shared shell

Tạo route và navigation catalogs cùng adapter seams bám theo current auth/capability semantics.

**Files target tối thiểu:**

1. `packages/web/src/app/routeCatalog.js`
2. `packages/web/src/app/navigationCatalog.js`
3. `packages/web/src/adapters/core/coreAdapter.js`
4. `packages/web/src/adapters/core/index.js`
5. `packages/web/src/adapters/vip-app/vipAppAdapter.js`
6. `packages/web/src/adapters/vip-app/index.js`
7. `packages/web/src/index.js`
8. `packages/web/package.json`

**Exit criteria:**

1. `npm run check:shell` pass trong `packages/web`.
2. Route/navigation/adapters export được cùng một surface ổn định.

### Step 4 - Refresh repo indexing and audit docs

Sau khi code baseline xong phải refresh module tree, sync audit trail và cập nhật live execution state để session sau không bị mất ngữ cảnh.

**Files target:**

1. `module_tree_full.md`
2. `docs/CODE_CHANGE_AUDIT_LEDGER.md`
3. `PROGRESS_DASHBOARD.md`
4. `docs/TASKBOARD_PACKAGE_TRACK_FOUNDATION_BASELINE_20260502.md`

**Exit criteria:**

1. `module_tree_full.md` đã ghi nhận package-track files mới.
2. Ledger và progress dashboard ghi rõ file list cùng validation commands.
3. Taskboard phản ánh đúng những gì đã hoàn thành, task nào đang được claim và task kế tiếp hợp lệ; không được để nhiều hơn một slice ở trạng thái `[/]`.

### Step 5 - Emit a handoff packet for the next session

Mỗi slice phải kết thúc bằng một gói bàn giao đủ nhỏ nhưng đủ sắc để phiên tiếp theo resume trực tiếp từ cùng execution lane.

**Fields bắt buộc:**

1. trạng thái khi rời slice: `completed`, `paused`, hoặc `blocked`,
2. lệnh validation PASS cuối cùng có thể chạy lại ngay,
3. bước kế tiếp được khuyến nghị và dependency cần giữ,
4. blockers/residual risk và các guardrail bất biến,
5. audit entry IDs liên quan.

**Exit criteria:**

1. Không cần đọc lại transcript dài để biết phải làm gì tiếp.
2. Phiên sau có thể quyết định ngay giữa `resume`, `repair`, hoặc `step to next slice`.

---

## 4. File-level implementation details

### 4.1 Shared contracts

#### A. Build target contract

Phải chốt được:

1. enum canonical `community | saas | vip`,
2. default target `saas`,
3. compile-time env key `REACT_APP_BUILD_TARGET`,
4. visibility groups cho route/navigation.

#### B. Capability bootstrap contract

Phải chốt được:

1. current principal summary,
2. plan/build target info,
3. CASL-ready abilities,
4. navigation gates,
5. surface flags cho admin/vip/community.

#### C. Session payload contract

Phải chốt được:

1. principal identity,
2. active tenant/service account context,
3. actor mode `human` vs `machine-bridge`,
4. session freshness/request identifiers,
5. package-aware capability envelope.

### 4.2 Core baseline

#### A. Python manifest

`pyproject.toml` phải encode:

1. package name cho `vninvest-core`,
2. Python version floor,
3. dependency families tương thích với Django, DRF, Celery, Redis, psycopg, pandas,
4. package-dir mapping `src`.

#### B. App skeleton

Namespace `vninvest_core` phải chứa tối thiểu:

1. app metadata,
2. manifest object/export,
3. `api_stub`, `worker_stub`, `beat_stub` để compose command có entrypoint rõ,
4. `contracts/access`, `contracts/market`, `contracts/operator`, `contracts/partner`.

#### C. Compose topology stub

Compose file phải có:

1. `core-db`,
2. `core-redis`,
3. `core-api`,
4. `core-worker`,
5. `core-beat`.

Các service có thể chạy ở mức stub, nhưng tên, env families và dependency graph phải rõ ràng.

### 4.3 Web shared shell

#### A. Route catalog

Mỗi route item phải có tối thiểu:

1. `id`,
2. `path`,
3. `titleKey`,
4. `group`,
5. `buildTargets`,
6. `requiredCapabilities`,
7. `adapter`,
8. `status`.

#### B. Navigation catalog

Mỗi navigation group phải có tối thiểu:

1. `id`,
2. `labelKey`,
3. `buildTargets`,
4. `requiredCapabilities`,
5. `items`.

#### C. Adapter interface

Hai adapter `core` và `vip-app` phải cùng một interface tối thiểu:

1. `adapterId`,
2. `displayName`,
3. `resolveBaseUrl()`,
4. `getBuildMeta()`,
5. `getCapabilityBootstrapEndpoint()`,
6. `getSessionPayloadEndpoint()`,
7. `getHealthcheckEndpoint()`.

---

## 5. Validation plan

### 5.1 Focused validation after Step 2

```powershell
& ".\.venv\Scripts\python.exe" -m compileall packages/core/backend/src
```

Expected result: compile pass, không syntax error.

### 5.2 Focused validation after Step 3

```powershell
Push-Location ./packages/web
npm run check:shell
Pop-Location
```

Expected result: Node import/export smoke pass cho catalogs và adapters.

### 5.3 Final repository validation

```powershell
& ".\.venv\Scripts\python.exe" scripts/ops/generate_module_tree.py
```

Expected result: module tree ghi nhận files mới trong `packages/` và `shared/`.

---

## 6. Rollback philosophy

1. Vì slice này additive-only trong `packages/` và `shared/`, rollback đơn giản nhất là bỏ toàn bộ files baseline mới.
2. Không có lý do chạm `backend/` hoặc `frontend/` để rollback hành vi runtime hiện hành.
3. Nếu validation của `packages/web` hoặc `packages/core` fail, không được mở rộng sang feature work; phải fix baseline trước.
4. Nếu taskboard, audit ledger và progress dashboard lệch nhau sau một slice, phải sửa control docs trước khi mở slice kế tiếp.
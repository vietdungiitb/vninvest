# TASKBOARD - Package Track Foundation Baseline

**Ngày**: 2026-05-02  
**Mục tiêu**: Giao việc theo slice cho baseline đầu tiên của `packages/core`, `packages/web`, `shared`.

---

## 1. Quy ước trạng thái

- `[ ]` Chưa bắt đầu
- `[/]` Đang làm
- `[x]` Hoàn thành

Nguyên tắc tick trạng thái:

1. Không tick hoàn thành nếu chưa có code thật.
2. Không tick hoàn thành nếu chưa có focused validation sau edit đầu tiên.
3. Không tick hoàn thành nếu chưa sync ledger và progress dashboard.
4. Taskboard này là live status board; nếu nó lệch với entry audit mới nhất thì phải sửa ngay trước khi code tiếp.
5. Tại một thời điểm chỉ được có một task ở trạng thái `[/]` trong queue đang active.
6. Claim slice mới bằng cách cập nhật taskboard trước, không claim bằng chat transcript hay suy đoán từ diff.

---

## 2. Governance guard

- [x] `ARC-01` Khóa naming và package ownership cho baseline  
Owner: Platform Lead  
Estimate: 1h  
DoD: Handoff/Plan/Tech Spec/Taskboard dùng cùng một naming `package track foundation baseline`; không có drift về package responsibilities.

- [x] `ARC-02` Khóa ba contract SSOT đầu tiên trước khi viết adapter shell  
Owner: Platform Lead + Frontend Lead  
Estimate: 1h  
Dependency: ARC-01  
DoD: `build target`, `capability bootstrap`, `session payload` được freeze ở `shared/api-contracts` trước khi tạo adapter files.

- [x] `ARC-03` Khóa continuity protocol cho nhiều phiên và live control docs  
Owner: Platform Lead  
Estimate: 1h  
Dependency: ARC-01  
Anchor files: `HANDOFF_MASTER`, `IMPLEMENTATION_PLAN`, `TASKBOARD`, `SELF_AUDIT`, `EXECUTION_EVIDENCE_TEMPLATE`  
DoD: Doc pack định nghĩa rõ taskboard authoritative, one-active-slice rule, handoff packet bắt buộc và queue kế tiếp đã được khóa để session sau không bị chồng chéo.

---

## 3. Shared contracts

- [x] `SH-01` Tạo build target contract  
Owner: Platform Lead  
Estimate: 1h  
Dependency: ARC-02  
Anchor files: `shared/api-contracts/`, `packages/web/src/config/buildTarget.js`  
DoD: schema chốt `community|saas|vip`, default `saas`, env key `REACT_APP_BUILD_TARGET`.

- [x] `SH-02` Tạo capability bootstrap contract  
Owner: Platform Lead + Frontend Lead  
Estimate: 2h  
Dependency: SH-01  
Anchor files: `shared/api-contracts/`, `frontend/src/context/PortfolioContext.jsx`, `frontend/src/context/AbilityContext.js`  
DoD: payload đủ để dựng principal, abilities, navigation gating, surface flags.

- [x] `SH-03` Tạo session payload contract  
Owner: Platform Lead + Backend Lead  
Estimate: 2h  
Dependency: SH-02  
Anchor files: `shared/api-contracts/`, `frontend/src/context/PortfolioContext.jsx`  
DoD: payload chốt principal, tenant, build target, session identity và freshness markers.

---

## 4. Core baseline

- [x] `CORE-01` Tạo Python manifest cho `packages/core`  
Owner: Backend Lead  
Estimate: 1h  
Dependency: ARC-01  
Anchor files: `packages/core/pyproject.toml`  
DoD: manifest phản ánh Python ecosystem mục tiêu của `core`, source layout `backend/src`.

- [x] `CORE-02` Tạo `vninvest_core` app manifest và stub entrypoints  
Owner: Backend Lead  
Estimate: 3h  
Dependency: CORE-01  
Anchor files: `packages/core/backend/src/vninvest_core/*`  
DoD: `app_manifest.py`, `api_stub.py`, `worker_stub.py`, `beat_stub.py` import/run được ở mức stub.

- [x] `CORE-03` Tạo contract namespaces trong `packages/core`  
Owner: Backend Lead  
Estimate: 1h  
Dependency: CORE-02  
Anchor files: `packages/core/backend/src/vninvest_core/contracts/*`  
DoD: có tối thiểu `access`, `market`, `operator`, `partner`.

- [x] `CORE-04` Mở rộng compose topology stub cho `packages/core`  
Owner: Backend Lead + DevOps  
Estimate: 2h  
Dependency: CORE-02  
Anchor files: `packages/core/docker-compose.core.yml`  
DoD: topology có `core-db`, `core-redis`, `core-api`, `core-worker`, `core-beat`; command/depends_on phản ánh manifest.

---

## 5. Web shared shell

- [x] `WEB-01` Nâng package metadata và exports cho `packages/web`  
Owner: Frontend Lead  
Estimate: 1h  
Dependency: ARC-01  
Anchor files: `packages/web/package.json`  
DoD: có `type: module`, `exports`, `scripts.check:shell`.

- [x] `WEB-02` Tạo `routeCatalog`  
Owner: Frontend Lead  
Estimate: 2h  
Dependency: SH-01, WEB-01  
Anchor files: `packages/web/src/app/routeCatalog.js`  
DoD: route registry có ids unique, group, buildTargets, requiredCapabilities, adapter.

- [x] `WEB-03` Tạo `navigationCatalog`  
Owner: Frontend Lead  
Estimate: 2h  
Dependency: WEB-02, SH-02  
Anchor files: `packages/web/src/app/navigationCatalog.js`  
DoD: navigation groups tham chiếu route ids, encode build target + capability gating.

- [x] `WEB-04` Tạo core adapter seam  
Owner: Frontend Lead  
Estimate: 2h  
Dependency: SH-02, SH-03  
Anchor files: `packages/web/src/adapters/core/*`  
DoD: core adapter export đúng interface chung và endpoint metadata cho capability/session/health.

- [x] `WEB-05` Tạo vip-app adapter seam  
Owner: Frontend Lead  
Estimate: 2h  
Dependency: SH-02, SH-03  
Anchor files: `packages/web/src/adapters/vip-app/*`  
DoD: vip-app adapter export đúng interface chung và route base/local control-plane metadata.

- [x] `WEB-06` Tạo shell entrypoint và validation logic  
Owner: Frontend Lead  
Estimate: 2h  
Dependency: WEB-03, WEB-04, WEB-05  
Anchor files: `packages/web/src/index.js`  
DoD: shell entrypoint export đủ surface; validation script bắt duplicate route ids và navigation drift.

---

## 6. Validation and audit

- [x] `QA-01` Compile-check `packages/core`  
Owner: Backend Lead  
Estimate: 0.5h  
Dependency: CORE-04  
DoD: `python -m compileall packages/core/backend/src` PASS.

- [x] `QA-02` Shell-check `packages/web`  
Owner: Frontend Lead  
Estimate: 0.5h  
Dependency: WEB-06  
DoD: `npm run check:shell` PASS trong `packages/web`.

- [x] `OPS-01` Regenerate module tree và sync audit docs  
Owner: Platform Lead  
Estimate: 0.5h  
Dependency: QA-01, QA-02  
DoD: `module_tree_full.md`, `docs/CODE_CHANGE_AUDIT_LEDGER.md`, `PROGRESS_DASHBOARD.md` đã cập nhật đầy đủ.

---

## 7. Next runtime slices

- [x] `WEB-07` Wire bootstrap client vao package-track auth/context runtime that  
Owner: Frontend Lead  
Estimate: 3h  
Dependency: WEB-06, QA-02  
Anchor files: `packages/web/src/context/*`, `packages/web/src/index.js`, `packages/web/scripts/check-shell.mjs`  
DoD: shell co runtime-facing bootstrap/auth state manager hoac context helper that su dung `loadShellBootstrap()` va `deriveLegacyAuthState()` de tao state on dinh cho lane `core`.

- [x] `WEB-08` Them focused validation cho auth/context runtime moi  
Owner: Frontend Lead  
Estimate: 1h  
Dependency: WEB-07  
Anchor files: `packages/web/scripts/check-shell.mjs`, `packages/web/src/context/*`  
DoD: co smoke proof cho bootstrap state tu `core` stub ma khong phai suy dien bang tay tu payload.

- [x] `VIP-01` Dung local bootstrap-ready stub cho `packages/vip-app`  
Owner: Backend Lead  
Estimate: 3h  
Dependency: WEB-05, SH-02, SH-03  
Anchor files: `packages/vip-app/local-backend/*`, `packages/vip-app/docker-compose.vip.yml`  
DoD: local stub tra ve health, capability bootstrap va session bootstrap theo interface ma `vipAppAdapter` va `bootstrapClient` co the tieu thu truc tiep.

- [x] `VIP-02` Validate parity giua `vipAppAdapter` va vip-app stub  
Owner: Backend Lead + Frontend Lead  
Estimate: 1h  
Dependency: VIP-01, WEB-08  
Anchor files: `packages/web/src/context/bootstrapClient.js`, `packages/web/src/adapters/vip-app/*`, `packages/vip-app/local-backend/*`  
DoD: `loadShellBootstrap()` co smoke proof thanh cong khi noi vao vip-app stub thay vi core stub.

- [x] `OPS-02` Sync taskboard, audit docs va module tree sau runtime slices  
Owner: Platform Lead  
Estimate: 0.5h  
Dependency: VIP-02  
Anchor files: `docs/TASKBOARD_PACKAGE_TRACK_FOUNDATION_BASELINE_20260502.md`, `docs/CODE_CHANGE_AUDIT_LEDGER.md`, `PROGRESS_DASHBOARD.md`, `module_tree_full.md`  
DoD: taskboard phan anh dung `WEB-07` toi `OPS-02`, ledger/progress co evidence va handoff packet, module tree da refresh neu co code moi.

---

## 8. React shell runtime slices

- [x] `WEB-09` Boc `authRuntime` thanh React provider/hook that cho `packages/web`  
Owner: Frontend Lead  
Estimate: 3h  
Dependency: WEB-08, OPS-02  
Anchor files: `packages/web/src/context/*`, `packages/web/src/index.js`, `packages/web/package.json`  
DoD: `packages/web` co `ShellAuthProvider` va hooks runtime/auth co the tieu thu truc tiep state tu `createShellAuthRuntime()` ma khong import legacy frontend.

- [x] `WEB-10` Them React-focused shell smoke cho provider/hook moi  
Owner: Frontend Lead  
Estimate: 1h  
Dependency: WEB-09  
Anchor files: `packages/web/scripts/check-shell.mjs`, `packages/web/src/context/*`  
DoD: `npm run check:shell` co React smoke proof cho context provider/hook va hydrated auth state.

- [x] `OPS-03` Sync taskboard, audit docs va module tree sau React shell slice  
Owner: Platform Lead  
Estimate: 0.5h  
Dependency: WEB-10  
Anchor files: `docs/TASKBOARD_PACKAGE_TRACK_FOUNDATION_BASELINE_20260502.md`, `docs/CODE_CHANGE_AUDIT_LEDGER.md`, `PROGRESS_DASHBOARD.md`, `module_tree_full.md`  
DoD: taskboard phan anh dung `WEB-09` toi `OPS-03`, ledger/progress co evidence va module tree da refresh neu co code moi.

---

## 9. Next backend/runtime queue

- [x] `VIP-03` Nang vip-app tu stub len local backend co persistence toi thieu cho auth, RBAC va audit logs  
Owner: Backend Lead  
Estimate: 5h  
Dependency: VIP-02, OPS-03  
Anchor files: `packages/vip-app/local-backend/*`, `packages/vip-app/docker-compose.vip.yml`, `packages/web/src/adapters/vip-app/*`  
DoD: local backend luu duoc principal/session/audit co ban, co bootstrap/session path on dinh va khong pha interface `vipAppAdapter` hien tai.

- [x] `VIP-04` Validate local persistence flows va audit semantics cua vip-app  
Owner: Backend Lead + Frontend Lead  
Estimate: 2h  
Dependency: VIP-03  
Anchor files: `packages/vip-app/local-backend/*`, `packages/web/src/context/*`, `packages/web/src/adapters/vip-app/*`  
DoD: co smoke/evidence cho login-bootstrap-reset/audit write path toi thieu va parity contract voi shell runtime.

- [x] `OPS-04` Sync taskboard, audit docs va module tree sau vip-app persistence slice  
Owner: Platform Lead  
Estimate: 0.5h  
Dependency: VIP-04  
Anchor files: `docs/TASKBOARD_PACKAGE_TRACK_FOUNDATION_BASELINE_20260502.md`, `docs/CODE_CHANGE_AUDIT_LEDGER.md`, `PROGRESS_DASHBOARD.md`, `module_tree_full.md`  
DoD: control docs va audit evidence dong bo sau khi vip-app co persistence lane dau tien.

---

## 10. Next shell control queue

- [x] `WEB-11` Them vip-app control client cho auth, RBAC va audit routes moi  
Owner: Frontend Lead  
Estimate: 2h  
Dependency: VIP-04, OPS-04  
Anchor files: `packages/web/src/adapters/vip-app/*`, `packages/web/src/index.js`, `packages/web/scripts/check-shell.mjs`  
DoD: `packages/web` co client mỏng bám adapter seam de goi `login/logout/reset/listUsers/upsertUser/listAuditLogs` tren vip-app local backend ma khong bypass route metadata.

- [x] `WEB-12` Validate control client parity voi compose runtime cua vip-app  
Owner: Frontend Lead + Backend Lead  
Estimate: 1h  
Dependency: WEB-11  
Anchor files: `packages/web/src/adapters/vip-app/*`, `packages/vip-app/local-backend/*`  
DoD: co proof bang `packages/web` client rang auth/RBAC/audit routes moi tra ve du lieu dung shape tren runtime `:8200`.

- [x] `OPS-05` Sync taskboard, audit docs va module tree sau vip-app control client slice  
Owner: Platform Lead  
Estimate: 0.5h  
Dependency: WEB-12  
Anchor files: `docs/TASKBOARD_PACKAGE_TRACK_FOUNDATION_BASELINE_20260502.md`, `docs/CODE_CHANGE_AUDIT_LEDGER.md`, `PROGRESS_DASHBOARD.md`, `module_tree_full.md`  
DoD: control docs va audit evidence dong bo sau khi `packages/web` co vip-app control client lane dau tien.

---

## 11. Next VIP shell UI queue

- [x] `WEB-13` Dung page VIP local control toi thieu cho login, user list va audit log  
Owner: Frontend Lead  
Estimate: 4h  
Dependency: WEB-12, OPS-05  
Anchor files: `packages/web/src/pages/*`, `packages/web/src/app/routeCatalog.js`, `packages/web/src/index.js`, `packages/web/src/adapters/vip-app/*`  
DoD: `packages/web` co route-level page React toi thieu cho `vip-local-control`, hien thi duoc local login, user list va audit log bang `createVipAppControlClient`, dong thoi bat buoc bam template UI chung cua phan nang cap: giao dien giau thong tin, spacing thap, khong drift sang layout qua thoang.

- [x] `WEB-14` Validate SSR va live parity cho VIP local control page  
Owner: Frontend Lead + Backend Lead  
Estimate: 1.5h  
Dependency: WEB-13  
Anchor files: `packages/web/scripts/check-shell.mjs`, `packages/web/src/pages/*`, `packages/vip-app/local-backend/*`  
DoD: co shell proof render page va live smoke xac nhan route/page moi tieu thu duoc login, user list va audit logs tren runtime `:8200`, kem screenshot hoac preview review xac nhan page bam template UI chung voi mat do thong tin cao va spacing thap.

- [x] `OPS-06` Sync taskboard, audit docs va module tree sau VIP shell UI slice  
Owner: Platform Lead  
Estimate: 0.5h  
Dependency: WEB-14  
Anchor files: `docs/TASKBOARD_PACKAGE_TRACK_FOUNDATION_BASELINE_20260502.md`, `docs/CODE_CHANGE_AUDIT_LEDGER.md`, `PROGRESS_DASHBOARD.md`, `module_tree_full.md`  
DoD: control docs va audit evidence dong bo sau khi `packages/web` co VIP local control page dau tien.

---

## 12. Shared shell template queue

- [x] `WEB-15` Tach shared shell page template primitive dau tien cho `packages/web`  
Owner: Frontend Lead  
Estimate: 2h  
Dependency: WEB-14, OPS-06  
Anchor files: `packages/web/src/components/*`, `packages/web/src/pages/vip/VipLocalControlPage.js`, `packages/web/src/index.js`, `packages/web/scripts/check-shell.mjs`  
DoD: `packages/web` co shared template primitive cho page chrome, panel, metric va form fields de cac route-level pages sau co the reuse mot grammar UI chung thay vi copy inline layout.

- [x] `WEB-16` Refactor VIP local control page len shared template va validate parity  
Owner: Frontend Lead + Backend Lead  
Estimate: 1h  
Dependency: WEB-15  
Anchor files: `packages/web/src/components/*`, `packages/web/src/pages/vip/VipLocalControlPage.js`, `packages/web/scripts/check-shell.mjs`  
DoD: `VipLocalControlPage` dung shared template helper thay cho inline page shell, `npm run check:shell` pass khong con React key warning va live SSR parity tren runtime `:8200` van render duoc shared shell classes cung seeded local identity.

- [x] `OPS-07` Sync taskboard, audit docs va module tree sau shared shell template slice  
Owner: Platform Lead  
Estimate: 0.5h  
Dependency: WEB-16  
Anchor files: `docs/TASKBOARD_PACKAGE_TRACK_FOUNDATION_BASELINE_20260502.md`, `docs/CODE_CHANGE_AUDIT_LEDGER.md`, `PROGRESS_DASHBOARD.md`, `module_tree_full.md`  
DoD: control docs va audit evidence dong bo sau khi shared shell template primitive dau tien duoc merge vao `packages/web`.

---

## 13. Core shell page reuse queue

- [x] `WEB-17` Dung page `settings` dau tien cho core shell bang shared template  
Owner: Frontend Lead  
Estimate: 2h  
Dependency: WEB-15, WEB-16  
Anchor files: `packages/web/src/pages/system/*`, `packages/web/src/pages/pageRegistry.js`, `packages/web/src/index.js`, `packages/web/src/context/*`  
DoD: `packages/web` co route-level page cho `settings` bám `core` bootstrap/session/health seam, reuse shared shell template thay vi dung them mot layout grammar rieng.

- [x] `WEB-18` Validate live parity cho core settings shell page  
Owner: Frontend Lead + Backend Lead  
Estimate: 1h  
Dependency: WEB-17  
Anchor files: `packages/web/scripts/check-shell.mjs`, `packages/web/src/pages/system/*`, `packages/core/backend/src/vninvest_core/*`  
DoD: `npm run check:shell` pass va live SSR parity tren runtime core `:8100` xac nhan page `settings` moi render duoc principal, health va shared shell classes tu core stub.

- [x] `OPS-08` Sync taskboard, audit docs va module tree sau core settings shell slice  
Owner: Platform Lead  
Estimate: 0.5h  
Dependency: WEB-18  
Anchor files: `docs/TASKBOARD_PACKAGE_TRACK_FOUNDATION_BASELINE_20260502.md`, `docs/CODE_CHANGE_AUDIT_LEDGER.md`, `PROGRESS_DASHBOARD.md`, `module_tree_full.md`  
DoD: control docs va audit evidence dong bo sau khi `settings` tro thanh route-level page thu hai dung shared shell template.

---

## 14. Admin shell page reuse queue

- [x] `WEB-19` Dung page `admin-ops` bang shared template cho core shell  
Owner: Frontend Lead  
Estimate: 2h  
Dependency: WEB-17, WEB-18  
Anchor files: `packages/web/src/pages/admin/*`, `packages/web/src/app/routeCatalog.js`, `packages/web/src/pages/pageRegistry.js`, `packages/web/src/index.js`  
DoD: `admin-ops` duoc nang thanh route-level page `baseline`, reuse shared shell template va chi doc du lieu tu core bootstrap/session/health seam thay vi mo them contract moi.

- [x] `WEB-20` Validate live parity cho admin shell page  
Owner: Frontend Lead + Backend Lead  
Estimate: 1h  
Dependency: WEB-19  
Anchor files: `packages/web/scripts/check-shell.mjs`, `packages/web/src/pages/admin/*`, `packages/core/backend/src/vninvest_core/*`  
DoD: `npm run check:shell` pass va live SSR parity tren `:8100` xac nhan page `admin-ops` render duoc operator identity, admin route visibility va surface flag `show_admin_ops` tu core stub.

- [x] `OPS-09` Sync taskboard, audit docs va module tree sau admin shell slice  
Owner: Platform Lead  
Estimate: 0.5h  
Dependency: WEB-20  
Anchor files: `docs/TASKBOARD_PACKAGE_TRACK_FOUNDATION_BASELINE_20260502.md`, `docs/CODE_CHANGE_AUDIT_LEDGER.md`, `PROGRESS_DASHBOARD.md`, `module_tree_full.md`  
DoD: control docs va audit evidence dong bo sau khi `admin-ops` tro thanh route-level page thu ba dung shared shell template.
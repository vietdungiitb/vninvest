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

---

## 15. AI shell page reuse queue

- [x] `WEB-21` Dung page `ai-command-center` bang shared template cho core shell  
Owner: Frontend Lead  
Estimate: 2h  
Dependency: WEB-17, WEB-18, WEB-19, WEB-20  
Anchor files: `packages/web/src/pages/system/*`, `packages/web/src/app/routeCatalog.js`, `packages/web/src/pages/pageRegistry.js`, `packages/web/src/index.js`  
DoD: `ai-command-center` duoc nang thanh route-level page `baseline`, reuse shared shell template va chi doc du lieu tu core bootstrap/session/health seam thay vi mo them contract moi.

- [x] `WEB-22` Validate live parity cho AI shell page  
Owner: Frontend Lead + Backend Lead  
Estimate: 1h  
Dependency: WEB-21  
Anchor files: `packages/web/scripts/check-shell.mjs`, `packages/web/src/pages/system/*`, `packages/core/backend/src/vninvest_core/*`  
DoD: `npm run check:shell` pass va live SSR parity tren `:8100` xac nhan page `ai-command-center` render duoc operator identity, AI route visibility va surface flag `show_ai_command_center` tu core stub.

- [x] `OPS-10` Sync taskboard, audit docs va module tree sau AI shell slice  
Owner: Platform Lead  
Estimate: 0.5h  
Dependency: WEB-22  
Anchor files: `docs/TASKBOARD_PACKAGE_TRACK_FOUNDATION_BASELINE_20260502.md`, `docs/CODE_CHANGE_AUDIT_LEDGER.md`, `PROGRESS_DASHBOARD.md`, `module_tree_full.md`  
DoD: control docs va audit evidence dong bo sau khi `ai-command-center` tro thanh route-level page thu tu dung shared shell template.

---

## 16. Core shell helper extraction queue

- [x] `WEB-23` Tach shared bootstrap helper cho core shell pages  
Owner: Frontend Lead  
Estimate: 2h  
Dependency: WEB-17, WEB-19, WEB-21  
Anchor files: `packages/web/src/pages/*`, `packages/web/src/context/*`  
DoD: state machine bootstrap/error/refresh chung cua `settings`, `admin-ops` va `ai-command-center` duoc gom vao helper dung chung thay vi lap lai trong tung page.

- [x] `WEB-24` Refactor ba core shell page len shared helper va validate parity  
Owner: Frontend Lead + Backend Lead  
Estimate: 1h  
Dependency: WEB-23  
Anchor files: `packages/web/src/pages/*`, `packages/web/scripts/check-shell.mjs`, `packages/core/backend/src/vninvest_core/*`  
DoD: `npm run check:shell` pass, live SSR parity tren `:8100` pass cho `settings`, `admin-ops`, `ai-command-center`, khong thay doi contract hay markup gating.

- [x] `OPS-11` Sync taskboard, audit docs va module tree sau core helper extraction slice  
Owner: Platform Lead  
Estimate: 0.5h  
Dependency: WEB-24  
Anchor files: `docs/TASKBOARD_PACKAGE_TRACK_FOUNDATION_BASELINE_20260502.md`, `docs/CODE_CHANGE_AUDIT_LEDGER.md`, `PROGRESS_DASHBOARD.md`, `module_tree_full.md`  
DoD: control docs, file list audit va module tree phan anh dung helper extraction slice moi nhat.

---

## 17. Core shell mapper cleanup queue

- [x] `WEB-25` Tach shared mapper helpers cho core shell view-model  
Owner: Frontend Lead  
Estimate: 1.5h  
Dependency: WEB-23, WEB-24  
Anchor files: `packages/web/src/pages/*`  
DoD: normalization chung cho `capabilities`, `navigation`, `surfaces`, `abilities`, route filtering va state badges cua `settings`, `admin-ops`, `ai-command-center` duoc dua vao helper dung chung thay vi lap lai o tung page.

- [x] `WEB-26` Refactor ba core shell page len mapper helpers va validate parity  
Owner: Frontend Lead + Backend Lead  
Estimate: 1h  
Dependency: WEB-25  
Anchor files: `packages/web/src/pages/*`, `packages/web/scripts/check-shell.mjs`, `packages/core/backend/src/vninvest_core/*`  
DoD: `npm run check:shell` pass, live SSR parity tren `:8100` pass cho `settings`, `admin-ops`, `ai-command-center`, markup marker va route semantics giu nguyen sau cleanup.

- [x] `OPS-12` Sync taskboard, audit docs va module tree sau core mapper cleanup slice  
Owner: Platform Lead  
Estimate: 0.5h  
Dependency: WEB-26  
Anchor files: `docs/TASKBOARD_PACKAGE_TRACK_FOUNDATION_BASELINE_20260502.md`, `docs/CODE_CHANGE_AUDIT_LEDGER.md`, `PROGRESS_DASHBOARD.md`, `module_tree_full.md`  
DoD: control docs, file list audit va module tree phan anh dung mapper cleanup slice moi nhat.

---

## 18. Portfolio workspace shell queue

- [x] `WEB-27` Dung page `portfolios` bang shared helper layer cho core shell  
Owner: Frontend Lead  
Estimate: 2h  
Dependency: WEB-25, WEB-26  
Anchor files: `packages/web/src/pages/workspace/*`, `packages/web/src/app/routeCatalog.js`, `packages/web/src/pages/pageRegistry.js`, `packages/web/src/index.js`  
DoD: `portfolios` duoc nang thanh route-level page `baseline`, reuse shared shell helper layer va chi doc du lieu tu core bootstrap/session/health seam thay vi mo them contract moi.

- [x] `WEB-28` Expose va validate `portfolios` tren core bootstrap runtime  
Owner: Frontend Lead + Backend Lead  
Estimate: 1h  
Dependency: WEB-27  
Anchor files: `packages/core/backend/src/vninvest_core/*`, `packages/web/scripts/check-shell.mjs`  
DoD: core stub expose `portfolios` trong bootstrap navigation/abilities, `npm run check:shell` pass va live SSR parity tren `:8100` xac nhan route/page moi render duoc marker runtime expected.

- [x] `OPS-13` Sync taskboard, audit docs va module tree sau portfolio shell slice  
Owner: Platform Lead  
Estimate: 0.5h  
Dependency: WEB-28  
Anchor files: `docs/TASKBOARD_PACKAGE_TRACK_FOUNDATION_BASELINE_20260502.md`, `docs/CODE_CHANGE_AUDIT_LEDGER.md`, `PROGRESS_DASHBOARD.md`, `module_tree_full.md`  
DoD: control docs, file list audit va module tree phan anh dung route-level page `portfolios` moi nhat.

---

## 19. Support system shell queue

- [x] `WEB-29` Dung page `support` bang shared helper layer cho core shell  
Owner: Frontend Lead  
Estimate: 1.5h  
Dependency: WEB-25, WEB-26  
Anchor files: `packages/web/src/pages/system/*`, `packages/web/src/pages/pageRegistry.js`, `packages/web/src/index.js`  
DoD: `support` co route-level page that reuse shared helper layer, bám system routes/bootstrap seam va khong mo them backend contract moi.

- [x] `WEB-30` Expose va validate support ability/runtime parity  
Owner: Frontend Lead + Backend Lead  
Estimate: 1h  
Dependency: WEB-29  
Anchor files: `packages/core/backend/src/vninvest_core/*`, `packages/web/scripts/check-shell.mjs`  
DoD: core stub bootstrap expose support ability phu hop, `npm run check:shell` pass va live SSR parity tren `:8100` xac nhan route/page `support` render duoc marker runtime expected.

- [x] `OPS-14` Sync taskboard, audit docs va module tree sau support shell slice  
Owner: Platform Lead  
Estimate: 0.5h  
Dependency: WEB-30  
Anchor files: `docs/TASKBOARD_PACKAGE_TRACK_FOUNDATION_BASELINE_20260502.md`, `docs/CODE_CHANGE_AUDIT_LEDGER.md`, `PROGRESS_DASHBOARD.md`, `module_tree_full.md`  
DoD: control docs, file list audit va module tree phan anh dung route-level page `support` moi nhat.

---

## 20. Dashboard workspace shell queue

- [x] `WEB-31` Dung page `dashboard` bang shared helper layer cho core shell  
Owner: Frontend Lead  
Estimate: 1.5h  
Dependency: WEB-25, WEB-26  
Anchor files: `packages/web/src/pages/workspace/*`, `packages/web/src/pages/pageRegistry.js`, `packages/web/src/index.js`  
DoD: `dashboard` co route-level page that reuse shared helper layer, bam workspace routes/bootstrap seam va khong mo them backend contract moi.

- [x] `WEB-32` Validate dashboard runtime parity va registry coverage  
Owner: Frontend Lead + Backend Lead  
Estimate: 1h  
Dependency: WEB-31  
Anchor files: `packages/web/scripts/check-shell.mjs`, `packages/core/backend/src/vninvest_core/*`  
DoD: `npm run check:shell` pass va live SSR parity tren `:8100` xac nhan route/page `dashboard` render duoc marker runtime expected tu bootstrap payload hien co.

- [x] `OPS-15` Sync taskboard, audit docs va module tree sau dashboard shell slice  
Owner: Platform Lead  
Estimate: 0.5h  
Dependency: WEB-32  
Anchor files: `docs/TASKBOARD_PACKAGE_TRACK_FOUNDATION_BASELINE_20260502.md`, `docs/CODE_CHANGE_AUDIT_LEDGER.md`, `PROGRESS_DASHBOARD.md`, `module_tree_full.md`  
DoD: control docs, file list audit va module tree phan anh dung route-level page `dashboard` moi nhat.

---

## 21. Watchlist workspace shell queue

- [x] `WEB-33` Dung page `watchlist` bang shared helper layer cho core shell  
Owner: Frontend Lead  
Estimate: 1.5h  
Dependency: WEB-25, WEB-26  
Anchor files: `packages/web/src/pages/workspace/*`, `packages/web/src/pages/pageRegistry.js`, `packages/web/src/index.js`  
DoD: `watchlist` co route-level page that reuse shared helper layer, bam workspace routes/bootstrap seam va khong mo them backend contract moi.

- [x] `WEB-34` Validate watchlist runtime parity va registry coverage  
Owner: Frontend Lead + Backend Lead  
Estimate: 1h  
Dependency: WEB-33  
Anchor files: `packages/web/scripts/check-shell.mjs`, `packages/core/backend/src/vninvest_core/*`  
DoD: `npm run check:shell` pass va live SSR parity tren `:8100` xac nhan route/page `watchlist` render duoc marker runtime expected tu bootstrap payload hien co.

- [x] `OPS-16` Sync taskboard, audit docs va module tree sau watchlist shell slice  
Owner: Platform Lead  
Estimate: 0.5h  
Dependency: WEB-34  
Anchor files: `docs/TASKBOARD_PACKAGE_TRACK_FOUNDATION_BASELINE_20260502.md`, `docs/CODE_CHANGE_AUDIT_LEDGER.md`, `PROGRESS_DASHBOARD.md`, `module_tree_full.md`  
DoD: control docs, file list audit va module tree phan anh dung route-level page `watchlist` moi nhat.

---

## 22. Transactions workspace shell queue

- [x] `WEB-35` Dung page `transactions` bang shared helper layer cho core shell  
Owner: Frontend Lead  
Estimate: 1.5h  
Dependency: WEB-25, WEB-26  
Anchor files: `packages/web/src/pages/workspace/*`, `packages/web/src/pages/pageRegistry.js`, `packages/web/src/index.js`  
DoD: `transactions` co route-level page that reuse shared helper layer, bam workspace routes/bootstrap seam va khong mo them backend contract moi.

- [x] `WEB-36` Validate transactions runtime parity va registry coverage  
Owner: Frontend Lead + Backend Lead  
Estimate: 1h  
Dependency: WEB-35  
Anchor files: `packages/web/scripts/check-shell.mjs`, `packages/core/backend/src/vninvest_core/*`  
DoD: `npm run check:shell` pass va live SSR parity tren `:8100` xac nhan route/page `transactions` render duoc marker runtime expected tu bootstrap payload hien co.

- [x] `OPS-17` Sync taskboard, audit docs va module tree sau transactions shell slice  
Owner: Platform Lead  
Estimate: 0.5h  
Dependency: WEB-36  
Anchor files: `docs/TASKBOARD_PACKAGE_TRACK_FOUNDATION_BASELINE_20260502.md`, `docs/CODE_CHANGE_AUDIT_LEDGER.md`, `PROGRESS_DASHBOARD.md`, `module_tree_full.md`  
DoD: control docs, file list audit va module tree phan anh dung route-level page `transactions` moi nhat.

---

## 23. AI advisory signals shell queue

- [x] `WEB-37` Dong bo advisory ability va dung page `ai-advisory` tren shared helper layer  
Owner: Frontend Lead + Backend Lead  
Estimate: 2h  
Dependency: WEB-25, WEB-26  
Anchor files: `packages/core/backend/src/vninvest_core/*`, `packages/web/src/pages/signals/*`, `packages/web/src/pages/pageRegistry.js`, `packages/web/src/index.js`  
DoD: core stub bootstrap expose advisory subject phu hop voi route contract, `ai-advisory` co route-level page that reuse shared helper layer va khong lam vo whale lane hien co.

- [x] `WEB-38` Validate AI advisory runtime parity va registry coverage  
Owner: Frontend Lead + Backend Lead  
Estimate: 1h  
Dependency: WEB-37  
Anchor files: `packages/web/scripts/check-shell.mjs`, `packages/core/backend/src/vninvest_core/*`  
DoD: `npm run check:shell` pass va live SSR parity tren `:8100` xac nhan route/page `ai-advisory` render duoc marker runtime expected, dong thoi payload that chua subject `AiAdvisory`.

- [x] `OPS-18` Sync taskboard, audit docs va module tree sau AI advisory shell slice  
Owner: Platform Lead  
Estimate: 0.5h  
Dependency: WEB-38  
Anchor files: `docs/TASKBOARD_PACKAGE_TRACK_FOUNDATION_BASELINE_20260502.md`, `docs/CODE_CHANGE_AUDIT_LEDGER.md`, `PROGRESS_DASHBOARD.md`, `module_tree_full.md`  
DoD: control docs, file list audit va module tree phan anh dung route-level page `ai-advisory` va drift fix cua advisory ability.

---

## 24. Whale alerts signals shell queue

- [x] `WEB-39` Dong bo whale ability va dung page `whale-alerts` tren shared helper layer  
Owner: Frontend Lead + Backend Lead  
Estimate: 2h  
Dependency: WEB-25, WEB-26  
Anchor files: `packages/core/backend/src/vninvest_core/*`, `packages/web/src/pages/signals/*`, `packages/web/src/pages/pageRegistry.js`, `packages/web/src/index.js`  
DoD: core stub bootstrap expose subject whale phu hop voi route contract, `whale-alerts` co route-level page that reuse shared helper layer va giu nguyen compatibility voi naming legacy `WhaleAdvisory`.

- [x] `WEB-40` Validate whale-alerts runtime parity va registry coverage  
Owner: Frontend Lead + Backend Lead  
Estimate: 1h  
Dependency: WEB-39  
Anchor files: `packages/web/scripts/check-shell.mjs`, `packages/core/backend/src/vninvest_core/*`  
DoD: `npm run check:shell` pass va live SSR parity tren `:8100` xac nhan route/page `whale-alerts` render duoc marker runtime expected, dong thoi payload that chua ca `WhaleAlerts` va `WhaleAdvisory`.

- [x] `OPS-19` Sync taskboard, audit docs va module tree sau whale-alerts shell slice  
Owner: Platform Lead  
Estimate: 0.5h  
Dependency: WEB-40  
Anchor files: `docs/TASKBOARD_PACKAGE_TRACK_FOUNDATION_BASELINE_20260502.md`, `docs/CODE_CHANGE_AUDIT_LEDGER.md`, `PROGRESS_DASHBOARD.md`, `module_tree_full.md`  
DoD: control docs, file list audit va module tree phan anh dung route-level page `whale-alerts` va drift fix cua whale ability naming.

---

## 25. Signals naming canon va advisory read-model queue

- [x] `WEB-41` Canonicalize signals ability subject ve `WhaleAdvisory` trong package shell  
Owner: Frontend Lead + Backend Lead  
Estimate: 1.5h  
Dependency: WEB-38, WEB-40  
Anchor files: `packages/core/backend/src/vninvest_core/*`, `packages/web/src/pages/signals/*`, `packages/web/scripts/check-shell.mjs`  
DoD: core stub va package shell khong con phat `AiAdvisory` hay `WhaleAlerts` alias trong live bootstrap payload; `ai-advisory` va `whale-alerts` van render duoc tren shared helper layer voi canonical subject `WhaleAdvisory`.

- [x] `WEB-42` Wire read-only advisory session data slice vao `ai-advisory` shell  
Owner: Frontend Lead + Backend Lead  
Estimate: 2h  
Dependency: WEB-41  
Anchor files: `packages/web/src/adapters/core/*`, `packages/web/src/pages/signals/*`, `backend/portfolio/views_ai_advisory_session.py`, `backend/portfolio/tests/test_api_routes_stock_ai_advisory_session.py`  
DoD: `ShellAiAdvisoryPage` doc endpoint `/api/stock-management/stocks/<symbol>/ai-advisory-session/` contract `v2`, hien advisory quality va benchmark aggregate cho symbol cau hinh duoc, va `check-shell` co proof cho client + SSR render.

- [x] `OPS-20` Sync taskboard, audit docs, module tree va runtime proof sau signals canon slice  
Owner: Platform Lead  
Estimate: 0.5h  
Dependency: WEB-42  
Anchor files: `docs/TASKBOARD_PACKAGE_TRACK_FOUNDATION_BASELINE_20260502.md`, `docs/CODE_CHANGE_AUDIT_LEDGER.md`, `PROGRESS_DASHBOARD.md`, `module_tree_full.md`  
DoD: control docs, file list audit, module tree va live core stub proof phan anh dung canonical `WhaleAdvisory` payload va data slice advisory read-only tren route `ai-advisory`.

---

## 26. AI advisory symbol routing queue

- [x] `WEB-43` Mo query-driven symbol target cho `ai-advisory` shell  
Owner: Frontend Lead  
Estimate: 1h  
Dependency: WEB-42  
Anchor files: `packages/web/src/pages/signals/ShellAiAdvisoryPage.js`, `packages/web/scripts/check-shell.mjs`  
DoD: `ShellAiAdvisoryPage` uu tien prop `advisorySymbol`, neu khong co thi doc `?symbol=` tu browser query string, va co control tai cho de doi symbol advisory ma khong can sua source/env.

- [x] `OPS-21` Sync audit docs va module tree sau advisory symbol routing slice  
Owner: Platform Lead  
Estimate: 0.5h  
Dependency: WEB-43  
Anchor files: `docs/TASKBOARD_PACKAGE_TRACK_FOUNDATION_BASELINE_20260502.md`, `docs/CODE_CHANGE_AUDIT_LEDGER.md`, `PROGRESS_DASHBOARD.md`, `module_tree_full.md`  
DoD: control docs, file list audit va module tree phan anh dung query-driven advisory symbol path, proof `check-shell`, va khong co regression tren advisory data slice truoc do.

---

## 27. Whale alerts read-model queue

- [x] `WEB-44` Noi facts-first whale snapshot vao `whale-alerts` shell  
Owner: Frontend Lead + Backend Lead  
Estimate: 2h  
Dependency: WEB-41, WEB-42  
Anchor files: `packages/web/src/adapters/core/*`, `packages/web/src/pages/signals/ShellWhaleAlertsPage.js`, `backend/portfolio/views_whale_analytics.py`, `backend/portfolio/tests/test_whale_analytics_snapshot_api.py`  
DoD: `ShellWhaleAlertsPage` doc endpoint `/api/portfolio/whale/analytics/<symbol>/` bang thin client, surfacing `session_summary`, `materialization`, `quality_flags`, `summary` va symbol control nhe ma khong mo route/contract song song.

- [x] `OPS-22` Sync audit docs va module tree sau whale snapshot shell slice  
Owner: Platform Lead  
Estimate: 0.5h  
Dependency: WEB-44  
Anchor files: `docs/TASKBOARD_PACKAGE_TRACK_FOUNDATION_BASELINE_20260502.md`, `docs/CODE_CHANGE_AUDIT_LEDGER.md`, `PROGRESS_DASHBOARD.md`, `module_tree_full.md`  
DoD: control docs, file list audit va module tree phan anh dung whale snapshot read-model facts-first, focused backend proof va shell SSR proof khong regression.

---

## 28. Whale alerts trade-date targeting queue

- [x] `WEB-45` Mo selected trade-date control cho `whale-alerts` shell  
Owner: Frontend Lead  
Estimate: 1h  
Dependency: WEB-44  
Anchor files: `packages/web/src/pages/signals/ShellWhaleAlertsPage.js`, `packages/web/scripts/check-shell.mjs`, `backend/portfolio/tests/test_whale_analytics_snapshot_api.py`  
DoD: `ShellWhaleAlertsPage` doc `trade_date` tu prop/query/env, co date input nhe tren page, sync query string bang `history.replaceState`, va render ro requested date cung resolved session source ma khong tao route hay backend contract moi.

- [x] `OPS-23` Sync audit docs va module tree sau whale trade-date slice  
Owner: Platform Lead  
Estimate: 0.5h  
Dependency: WEB-45  
Anchor files: `docs/TASKBOARD_PACKAGE_TRACK_FOUNDATION_BASELINE_20260502.md`, `docs/CODE_CHANGE_AUDIT_LEDGER.md`, `PROGRESS_DASHBOARD.md`, `module_tree_full.md`  
DoD: control docs, file list audit va module tree phan anh dung selected trade-date path moi, `check-shell` xanh va backend weekend-fallback contract proof van pass.

---

## 29. Whale alerts fallback and host-runtime queue

- [x] `WEB-46` Them quick action nhay ve phien hop le gan nhat cho `whale-alerts` shell  
Owner: Frontend Lead  
Estimate: 1h  
Dependency: WEB-45  
Anchor files: `packages/web/src/pages/signals/ShellWhaleAlertsPage.js`, `packages/web/scripts/check-shell.mjs`  
DoD: `ShellWhaleAlertsPage` surfacing `latest_valid_trade_date` thanh quick action ro rang, cho phep auditor doi ve phien hop le gan nhat bang mot nut bam va giu query/form state dong bo ma khong tao route hay backend contract moi.

- [x] `WEB-47` Mount `ShellWhaleAlertsPage` vao frontend runtime that  
Owner: Frontend Lead + Backend Lead + DevOps  
Estimate: 4h  
Dependency: WEB-46  
Anchor files: `frontend/package.json`, `frontend/src/App.jsx`, `frontend/src/pages/WhaleAlertsHub.jsx`, `frontend/src/pages/WhaleAlertsShellHost.jsx`, `frontend/Dockerfile.dev-package-shell`, `docker-compose.dev.yml`, `packages/core/backend/src/vninvest_core/api_stub.py`, `backend/portfolio/models.py`  
DoD: route `/whale-alerts/shell` render duoc sau login trong `frontend`, dung JWT session hien tai cho `/api`, goi duoc core stub qua browser bang CORS, dev compose rebuild thanh cong va vendor copy `@vninvest/web` khong con duplicate React/invalid hook call; drift `UserConfig.ai_prompt_config` khong con chan login va seed user dev.

- [x] `OPS-24` Sync audit docs va module tree sau whale host-runtime slice  
Owner: Platform Lead  
Estimate: 0.5h  
Dependency: WEB-47  
Anchor files: `docs/TASKBOARD_PACKAGE_TRACK_FOUNDATION_BASELINE_20260502.md`, `docs/CODE_CHANGE_AUDIT_LEDGER.md`, `PROGRESS_DASHBOARD.md`, `module_tree_full.md`  
DoD: control docs, file list audit, runtime proof browser that va module tree phan anh dung quick action fallback moi, host route `/whale-alerts/shell`, dev Docker path va backend auth drift fix.

---

## 30. Whale hub to shell context carry-over queue

- [x] `WEB-48` Giu context symbol/query khi mo whale shell tu hub  
Owner: Frontend Lead  
Estimate: 0.5h  
Dependency: WEB-47  
Anchor files: `frontend/src/pages/WhaleAlertsHub.jsx`, `frontend/src/pages/WhaleAlertsShellHost.jsx`  
DoD: nut `Mo shell kiem chung` khong con reset context auditor; no uu tien giu `location.search` hien tai, va khi hub chua co query thi it nhat phai carry duoc ma dang dieu tra hoac tracked symbol dau tien sang `/whale-alerts/shell`.

- [x] `OPS-25` Sync audit docs va module tree sau whale hub context slice  
Owner: Platform Lead  
Estimate: 0.5h  
Dependency: WEB-48  
Anchor files: `docs/TASKBOARD_PACKAGE_TRACK_FOUNDATION_BASELINE_20260502.md`, `docs/CODE_CHANGE_AUDIT_LEDGER.md`, `PROGRESS_DASHBOARD.md`, `module_tree_full.md`  
DoD: control docs, file list audit va module tree phan anh dung link carry-over moi, frontend build xanh, dev frontend da refresh, va browser proof xac nhan query `symbol`/`trade_date` duoc giu qua buoc nhay hub -> shell -> hub.

---

## 31. Package-shell host expansion queue

- [x] `WEB-49` Dua core shell host runtime ve same-origin `/core/v1`  
Owner: Frontend Lead + DevOps  
Estimate: 1h  
Dependency: WEB-47  
Anchor files: `frontend/docker/nginx.conf`, `frontend/Dockerfile.dev-package-shell`, `docker-compose.dev.yml`, `frontend/src/pages/WhaleAlertsShellHost.jsx`  
DoD: browser-hosted package shell khong con goi truc tiep `http://127.0.0.1:8100`; frontend nginx proxy `/core/v1/*` ve core stub host, env shell host mac dinh dung `/core/v1`, va browser proof `http://127.0.0.1/core/v1/health` tra payload hop le qua same-origin.

- [x] `WEB-50` Mo AI advisory package-shell host consumer trong frontend that  
Owner: Frontend Lead  
Estimate: 2h  
Dependency: WEB-49  
Anchor files: `frontend/src/App.jsx`, `frontend/src/pages/AiAdvisoryShellHost.jsx`, `frontend/src/pages/packageShellHostRuntime.js`, `frontend/src/pages/WhaleAdvisory.jsx`, `frontend/src/components/advisory/WhaleAdvisoryBentoHeader.jsx`  
DoD: route `/ai-advisory/shell` mount duoc `ShellAiAdvisoryPage` bang runtime helper dung chung, header advisory legacy co link `Mo shell kiem chung`, va link do carry duoc symbol hien tai hoac fallback `BCM` khi chua co advisory live.

- [x] `OPS-26` Sync audit docs va module tree sau package-shell host expansion slice  
Owner: Platform Lead  
Estimate: 0.5h  
Dependency: WEB-50  
Anchor files: `docs/TASKBOARD_PACKAGE_TRACK_FOUNDATION_BASELINE_20260502.md`, `docs/CODE_CHANGE_AUDIT_LEDGER.md`, `PROGRESS_DASHBOARD.md`, `module_tree_full.md`  
DoD: control docs, file list audit, same-origin proxy proof, AI advisory host proof va module tree phan anh dung helper runtime chung, route `/ai-advisory/shell` va count module moi.

---

## 32. Advisory host runtime resilience queue

- [x] `WEB-51` Hardening advisory host runtime truoc rollout/data drift  
Owner: Frontend Lead + Backend Lead  
Estimate: 2h  
Dependency: WEB-50  
Anchor files: `packages/web/src/adapters/core/coreAdapter.js`, `packages/web/scripts/check-shell.mjs`, `backend/create_test_users.py`  
DoD: advisory client thu `contract=v2` truoc nhung co the tu fallback ve `v1` khi rollout gate `holistic_disabled`; script `create_test_users.py` luon initialize canonical DPI plans truoc khi seed `testpro`, de host runtime khong bi `feature_locked` chi vi local plan drift; live route `/ai-advisory/shell?symbol=BCM` khong con dung o 403 va render duoc advisory session card trong frontend that.

- [x] `OPS-27` Sync audit docs va module tree sau advisory host resilience slice  
Owner: Platform Lead  
Estimate: 0.5h  
Dependency: WEB-51  
Anchor files: `docs/TASKBOARD_PACKAGE_TRACK_FOUNDATION_BASELINE_20260502.md`, `docs/CODE_CHANGE_AUDIT_LEDGER.md`, `PROGRESS_DASHBOARD.md`, `module_tree_full.md`  
DoD: control docs, file list audit, shell-check regression proof, seed-script validation, frontend rebuild/runtime proof va module tree phan anh dung advisory fallback + canonical test-user plan fix.
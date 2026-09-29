# SELF-AUDIT AND TEST PROTOCOL - Package Track Foundation Baseline

## 1. Mục đích

Protocol này là checklist bắt buộc cho đội code sau mỗi slice của baseline `packages/core`, `packages/web`, `shared`.

Mục tiêu là chặn sớm các lỗi nguy hiểm nhất:

1. package baseline vẫn chỉ là placeholder, không import/run được,
2. shared contracts chứa implementation details hoặc drift khỏi current auth semantics,
3. `packages/web` route/navigation/adapters lệch nhau hoặc dùng build target không canonical,
4. `packages/core` compose topology không khớp với app manifest,
5. changed files vô tình chạm vào legacy runtime như implementation target,
6. đã tạo file mới nhưng quên module tree, ledger và progress sync.

## 2. Nguyên tắc vận hành

1. Không có evidence thì xem như chưa làm.
2. Không có focused validation ngay sau edit đầu tiên thì slice chưa pass.
3. Với slice baseline này, ưu tiên validation hẹp thay vì build toàn repo.
4. Docs-only slice phải có cross-reference review và sync ledger/progress.
5. Coding chỉ được coi là hoàn tất khi `module_tree_full.md` đã ghi nhận files mới.
6. Taskboard là live status board; nếu nó lệch với entry audit mới nhất thì phải sửa control docs trước khi code tiếp.
7. Tại một thời điểm chỉ được có một task ở trạng thái `[/]` trong queue đang active.
8. Không được handoff chỉ bằng chat transcript; phải có handoff packet nằm trong evidence/audit surfaces.

## 3. Workflow audit bắt buộc cho mỗi slice

### Bước 0 - Resume và claim slice

Trước khi chạm code hoặc docs của slice mới:

1. đọc taskboard hiện hành,
2. đọc entry audit mới nhất trong ledger/progress,
3. xác nhận dependency của slice mục tiêu đã ở trạng thái `[x]`,
4. xác nhận không có task khác đang ở trạng thái `[/]`,
5. claim slice bằng cách cập nhật taskboard trước khi bắt đầu edit.

### Bước 1 - Khóa phạm vi slice

Ghi rõ:

1. Slice ID
2. Req IDs liên quan
3. File thực tế đã chạm
4. Loại slice: shared / core / web / docs-only / audit
5. Boundary owner chính của slice

### Bước 2 - Focused validation ngay sau slice

#### Shared contract slice

Validation tối thiểu:

1. diagnostics sạch trên JSON contracts,
2. contract titles/required keys đúng spec,
3. không có field nào lộ implementation internals kiểu Django model hoặc React component name.

#### Core baseline slice

Validation tối thiểu:

1. `python -m compileall packages/core/backend/src`,
2. import smoke nếu slice chạm manifest/entrypoints,
3. compose naming review nếu slice chạm topology.

#### Web shell slice

Validation tối thiểu:

1. `npm run check:shell` trong `packages/web`,
2. ids unique cho route catalog,
3. navigation items map đúng route ids,
4. adapter interface đồng nhất giữa `core` và `vip-app`,
5. nếu slice chạm UI, page hoặc component, phải có proof rằng surface mới vẫn bám template chung: giàu thông tin, spacing thấp và không trôi sang layout quá thoáng.

#### Docs-only slice

Validation tối thiểu:

1. cross-reference giữa Handoff, Plan, Tech Spec, Taskboard, Traceability,
2. naming consistency,
3. sync `docs/CODE_CHANGE_AUDIT_LEDGER.md` và `PROGRESS_DASHBOARD.md`.

### Bước 3 - Thu bằng chứng

Bắt buộc lưu tối thiểu:

1. command đã chạy và PASS/FAIL,
2. payload snapshot nếu slice chạm contract,
3. residual risk note,
4. danh sách file đổi thực tế.

### Bước 4 - Đồng bộ audit docs

Sau mỗi slice đã PASS nội bộ:

1. cập nhật `docs/TASKBOARD_PACKAGE_TRACK_FOUNDATION_BASELINE_20260502.md`,
2. cập nhật `docs/CODE_CHANGE_AUDIT_LEDGER.md`,
3. cập nhật `PROGRESS_DASHBOARD.md`,
4. điền evidence template của pack này.

### Bước 5 - Đóng gói handoff cho phiên sau

Mỗi slice khi rời trạng thái active phải ghi rõ:

1. slice đang `completed`, `paused` hay `blocked`,
2. lệnh validation PASS cuối cùng có thể chạy lại ngay,
3. bước kế tiếp được khuyến nghị,
4. blockers/residual risk và guardrails bất biến,
5. entry IDs vừa cập nhật trong audit surfaces.

## 4. Test matrix theo bề mặt rủi ro

## A. Shared contracts

### A1. Build target canonicalization

PASS khi contract chỉ cho phép `community`, `saas`, `vip` và default là `saas`.

### A2. Capability bootstrap compatibility

PASS khi contract map được về `plan`, `abilities`, `userIdentity` mà không cần invent thêm bridge logic mơ hồ.

### A3. Session payload completeness

PASS khi contract đủ cho human session và VIP local bridge context.

## B. Core baseline

### B1. Importable package

PASS khi `vninvest_core` compile/import được.

### B2. Manifest/topology consistency

PASS khi service names trong manifest khớp compose topology.

### B3. Contract namespace completeness

PASS khi có đủ `access`, `market`, `operator`, `partner`.

## C. Web shell

### C1. Route catalog integrity

PASS khi route ids unique, build targets canonical, adapters hợp lệ.

### C2. Navigation integrity

PASS khi mọi navigation item trỏ tới route id hợp lệ.

### C3. Adapter symmetry

PASS khi `core` và `vip-app` cùng export một interface.

## D. Audit hygiene

### D1. Legacy runtime untouched

PASS khi changed-files audit không chứa implementation edits ở `backend/` hoặc `frontend/`.

### D2. Module tree refreshed

PASS khi files mới trong `packages/` và `shared/` đã xuất hiện trong `module_tree_full.md`.

### D3. Ledger/progress sync

PASS khi cả hai file audit đã được cập nhật cùng file list và validation results.

### D4. Taskboard parity

PASS khi taskboard phản ánh đúng các slice đã hoàn thành, slice đang active và không còn stale unchecked tasks đã có bằng chứng audit.

### D5. Handoff completeness

PASS khi evidence của slice có trạng thái khi rời slice, lệnh PASS cuối, bước kế tiếp và blockers đủ để session sau resume trực tiếp.

### D6. Unified UI template compliance

PASS khi screenshot hoặc preview và review note chứng minh surface UI mới bám template chung của phần nâng cấp: information-dense, compact spacing và cùng grammar bố cục với các surface khác trong lane.
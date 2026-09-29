# SELF-AUDIT AND TEST PROTOCOL - Money Flow Control Center and Data Lifecycle

## 1. Mục đích

Protocol này là checklist bắt buộc cho đội code và QA nội bộ sau mỗi slice của chương trình `Money Flow Control Center and Data Lifecycle`.

Mục tiêu là chặn sớm các nhóm lỗi nguy hiểm nhất:

1. sinh parallel writers cho cùng business meaning,
2. facts-first path vẫn lén phụ thuộc vào raw-full-scan,
3. purge xóa raw hoặc facts trước khi completeness/freshness đạt chuẩn,
4. whale governance bị drift khỏi active version vì UI ghi sai domain,
5. UI control center khiến operator hiểu sai đâu là effective owner của một knob,
6. báo hoàn thành nhưng thiếu performance evidence hoặc doc sync,
7. legacy writer surface vẫn còn viết được dù UI đã demote,
8. recompute/backfill xong nhưng L4 cache vẫn stale,
9. link-out upstream render chết vì thiếu quyền,
10. forensic window chỉ là tag trên raw thay vì physical carve-out.

## 2. Nguyên tắc vận hành

1. Không có evidence thì xem như chưa làm.
2. Không có focused validation ngay sau edit đầu tiên thì slice chưa pass.
3. UI/runtime slice phải refresh stack trước evidence final.
4. Docs-only slice phải có cross-reference review và sync ledger/progress.
5. Mọi coding slice đều phải đối chiếu explicit consent trước khi bắt đầu.

## 3. Workflow audit bắt buộc cho mỗi slice

### Bước 1 - Khóa phạm vi slice

Ghi rõ:

1. Slice ID
2. Req IDs liên quan
3. File thực tế đã chạm
4. Loại slice: backend / frontend / integration / ops / docs-only
5. Canonical writer hoặc effective owner mà slice này tác động

### Bước 2 - Focused validation ngay sau slice

#### Backend lifecycle/materialization slice

Chạy suite hẹp nhất chứng minh:

1. owner boundary vẫn đúng,
2. facts parity đúng với selected-session semantics,
3. raw-full-scan không còn là primary path nếu slice chạm read path.

#### Admin API slice

Chạy suite hẹp cho:

1. summary/effective owner payload,
2. preview/apply contract,
3. retention/materialization safety gate.

#### Frontend control-center slice

Validation tối thiểu:

1. `npm run build`,
2. targeted UI tests cho panel đã chạm,
3. smoke chứng minh panel không tạo thêm writer mơ hồ.

#### Performance slice

Validation tối thiểu:

1. before/after timing cùng symbol/trade-date,
2. payload/source markers cho thấy route đang đọc từ facts-first primary path,
3. residual risk note nếu còn degraded fallback.

#### Docs-only slice

Validation tối thiểu:

1. cross-reference giữa Handoff, Plan, Tech Spec, Taskboard, Traceability,
2. naming consistency,
3. sync `docs/CODE_CHANGE_AUDIT_LEDGER.md` và `PROGRESS_DASHBOARD.md`.

### Bước 3 - Runtime refresh nếu slice chạm UI/runtime

Nếu slice chạm frontend/backend/celery runtime, phải refresh stack bị ảnh hưởng và xác nhận service health trước khi chụp evidence final.

### Bước 4 - Thu bằng chứng

Bắt buộc lưu tối thiểu:

1. command đã chạy và PASS/FAIL,
2. payload snapshot nếu slice chạm contract,
3. screenshot hoặc video nếu slice là UI,
4. performance snapshot nếu slice chạm route load path,
5. residual risk note,
6. danh sách file đổi thực tế.

### Bước 5 - Đồng bộ audit docs

Sau mỗi slice đã PASS nội bộ:

1. cập nhật `docs/CODE_CHANGE_AUDIT_LEDGER.md`,
2. cập nhật `PROGRESS_DASHBOARD.md`,
3. điền evidence template của pack này.

## 4. Test matrix theo bề mặt rủi ro

## A. Writer ownership

### A1. Single effective writer

PASS khi cùng một knob chỉ có một nơi apply hợp lệ; mọi nơi khác là read-only hoặc write-through.

### A2. Whale policy bridge

PASS khi whale domain update đi qua whale mission-control flow, không ghi blob song song ở signal config.

### A3. Raw retention ownership

PASS khi raw keep-days có duy nhất một canonical owner và UI hiển thị effective value đúng.

## B. Materialization correctness

### B1. Facts parity

PASS khi bucket/session facts dựng lại được selected-session flow semantics theo spec.

### B2. Freshness and completeness

PASS khi UI và API phân biệt được `fresh`, `stale`, `degraded fallback`, `recompute pending`.

### B3. Dark-flow parity

PASS khi dark-flow lifecycle có freshness/session summary đủ dùng cho control plane.

## C. Retention and forensic safety

### C1. Preview safety

PASS khi mọi purge/recompute action có preview impacted counts và blocked reasons.

### C2. Forensic carve-out

PASS khi severe/anomalous events tạo selective forensic window thay vì buộc giữ raw toàn phần dài hạn.

## D. Admin control center

### D1. Effective owner visibility

PASS khi operator nhìn thấy knob thuộc domain nào và panel nào chỉ là link-out.

### D2. Preview-before-apply

PASS khi materialization, retention, universe, policy updates đều có preview rõ ràng.

### D3. Pagination and i18n

PASS khi list lớn dùng `PaginationBar` và text mới đi qua i18n tiếng Việt.

### D4. Hard-blocked legacy writers

PASS khi deprecated write surfaces trả 400/403 hoặc redirect có chủ đích và không còn tạo state mới.

### D5. Recompute invalidation

PASS khi recompute/backfill invalidate impacted L4 cache keys ngay sau materialization.

### D6. Permission-gated link-out

PASS khi operator thiếu quyền upstream chỉ thấy disabled state + badge, không thấy link chết.

### D7. Physical forensic carve-out

PASS khi forensic sample nằm ở L5 vật lý riêng, có reason/expiry và không phụ thuộc tagging-only trên raw.

## E. Performance

### E1. Facts-first route load

PASS khi route `whale-alerts/:symbol` không còn full-scan raw ticks trên primary path sau cutover.

### E2. Selected-session truth preservation

PASS khi tối ưu hiệu năng không làm bubble/advisory/flow pane drift khỏi selected session.

## 5. Suggested suites to run or create

### Backend

1. `portfolio.tests.test_money_flow_lifecycle_summary`
2. `portfolio.tests.test_money_flow_materialization_whale`
3. `portfolio.tests.test_money_flow_materialization_dark_flow`
4. `portfolio.tests.test_money_flow_retention_preview`
5. `portfolio.tests.test_whale_analytics_snapshot_facts_first`

### Frontend

1. `src/components/adminops/MoneyFlowControlCenter.test.jsx`
2. `src/components/adminops/money-flow/SharedLifecyclePanel.test.jsx`
3. `src/components/adminops/money-flow/WhaleGovernancePanel.test.jsx`
4. `src/components/adminops/money-flow/DarkFlowPolicyPanel.test.jsx`
5. `src/components/adminops/money-flow/StorageRetentionPanel.test.jsx`
6. `src/components/adminops/money-flow/LinkOutPermission.test.jsx`

### Runtime / performance

1. route timing snapshot cho `whale-alerts/:symbol` trước/sau facts-first,
2. payload source marker snapshot,
3. rebuild/restart evidence cho services bị ảnh hưởng.
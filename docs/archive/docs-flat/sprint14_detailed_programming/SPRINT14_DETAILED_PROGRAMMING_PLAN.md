# Sprint 14 Detailed Programming Plan (Priority-Ordered, Mission Control Upgrade)

**Ngày lập**: 2026-04-03  
**Mục tiêu**: Chia nhỏ kế hoạch lập trình theo thứ tự ưu tiên để triển khai tuần tự, giảm rủi ro regression, nâng trang Django Admin Whale Config thành **Mission Control**  
**Lưu ý**: Đây là kế hoạch chi tiết, chưa thay đổi code

---

## 0) Quy ước thực thi

- Mỗi Phase có:
  - Scope
  - Task kỹ thuật theo file
  - Acceptance criteria
  - Test checklist
  - Rollback note
- Chỉ chuyển phase khi phase trước đạt DoD.
- Mọi thay đổi API contract phải cập nhật docs ngay trong cùng PR.
- Áp dụng nguyên tắc **maker-checker** cho thay đổi config production (Analyst ≠ Supervisor).

---

## 1) Kiến trúc Mission Control cho Global Whale Alerts Config

### 1.1 Trụ cột chức năng
1. **Warm-up & Integrity Check trước Apply**
2. **Dashboard mini theo thời gian thực (At-a-glance)**
3. **Safety Net đa lớp (Guardrails + Auto-Revert)**
4. **Effective From mở rộng (Now/Scheduled/Canary)**
5. **Symbol Coverage UX nâng cao (bulk + dynamic groups)**
6. **Compliance phân quyền 2 vai trò (Analyst/Supervisor)**

### 1.2 Data model đề xuất (mức thiết kế)
- `WhaleConfigVersion` (immutable version)
- `WhaleConfigDraft`
- `WhaleConfigApproval`
- `WhaleConfigRollout` (now/scheduled/canary)
- `WhaleConfigWorkerAck` (propagation status per worker)
- `WhaleConfigAuditLog` (who/when/why/before/after)

### 1.3 Runtime policy
- Worker đọc config active từ cache + DB fallback
- Mỗi event/alert gắn `config_version`
- Có cơ chế kiểm tra propagation ACK để phát hiện worker dùng config cũ

---

## Phase 1 (P0-Ưu tiên cao nhất): Mission Control Foundation (Backend Admin Core)

## 1.1 Mục tiêu
Tạo xương sống quản lý versioned config, draft, audit, và permission nền tảng trong Django Admin.

## 1.2 File dự kiến tác động
- `backend/portfolio/models.py`
- `backend/portfolio/admin.py`
- `backend/portfolio/migrations/*.py` (mới)
- `backend/portfolio/permissions.py` (nếu cần custom permission helper)
- `backend/portfolio/tests/test_admin_ops.py` (mở rộng)
- `backend/portfolio/tests/test_admin_mail_accounts.py` hoặc file test admin mới

## 1.3 Breakdown task lập trình
### Task MC-F1 — Data schema
- Tạo model version/draft/approval/audit/rollout/worker-ack.
- Enforce unique/constraint phù hợp (ví dụ 1 active version tại 1 thời điểm).

### Task MC-F2 — Django admin registration
- Tạo admin sections:
  - Drafts
  - Versions
  - Rollouts
  - Audit Log
  - Worker ACK Status
- Form fieldsets theo workflow, không chỉ raw fields.

### Task MC-F3 — Permission split
- Analyst: create/edit draft, preview.
- Supervisor: approve/apply/rollback.
- Enforce maker-checker (người tạo không được tự approve).

### Task MC-F4 — Audit first
- Mọi hành động lifecycle bắt buộc ghi audit:
  - create draft / edit / submit / approve / apply / rollback.

## 1.4 Acceptance criteria
- Có thể tạo draft và lưu version lịch sử đầy đủ.
- Phân quyền Analyst/Supervisor chạy đúng.
- Audit trail có đủ before/after + reason.

## 1.5 Rollback note
- Nếu workflow mới gây nghẽn, tạm cho phép “single-admin mode” bằng feature flag nội bộ dev.

---

## Phase 2 (P0): Warm-up & Integrity Check + Safety Guardrails

## 2.1 Mục tiêu
Chặn cấu hình nguy hiểm trước khi apply production.

## 2.2 File dự kiến tác động
- `backend/portfolio/admin.py`
- `backend/portfolio/services.py` (validator/service layer)
- `backend/portfolio/views.py` (nếu expose preview/check API)
- `backend/portfolio/tests/test_api_routes.py` + test admin mới

## 2.3 Breakdown task lập trình
### Task MC-I1 — Snapshot Diff Preview
- Khi submit/apply: hiển thị diff old vs new cho trường quan trọng:
  - whale/shark thresholds
  - cooldown
  - coverage mode
  - weights
  - rate limits

### Task MC-I2 — Dependency Check
- Pre-apply checks:
  - data provider health
  - Redis health
  - channel layer health
  - worker availability
- Nếu degraded:
  - chặn Apply Now
  - chỉ cho Schedule/Draft với cảnh báo

### Task MC-I3 — Hard Limits Guardrails
- Guardrails code-level:
  - `whale_threshold >= MIN_WH_THRESHOLD`
  - quan hệ threshold hợp lệ
  - cooldown/rate-limit nằm trong khung an toàn
  - canary scope không vượt max cho phép

### Task MC-I4 — Validation messaging
- Trả lỗi rõ ràng để admin hiểu “vì sao bị chặn”.

## 2.4 Acceptance criteria
- Không thể apply config vi phạm guardrails.
- Diff và dependency check luôn xuất hiện trước apply.

## 2.5 Rollback note
- Nếu health check external quá nhiễu, cho phép bypass có audit + supervisor-only.

---

## Phase 3 (P0): Apply Engine + Propagation Tracking

## 3.1 Mục tiêu
Đảm bảo config mới được áp dụng đồng nhất trên các worker.

## 3.2 File dự kiến tác động
- `backend/portfolio/tasks.py`
- `backend/config/health.py`
- `backend/config/settings.py`
- `backend/portfolio/views.py`
- `backend/portfolio/tests/test_realtime_gateway.py` (nếu cần)
- `backend/portfolio/tests/test_api_routes.py`

## 3.3 Breakdown task lập trình
### Task MC-P1 — Apply workflow
- Apply Now:
  - set active version
  - invalidate cache
  - publish control signal
- Record apply transaction atomically.

### Task MC-P2 — Worker ACK
- Mỗi worker gửi ACK version đã load.
- Lưu `WhaleConfigWorkerAck`.
- UI hiển thị x/y workers ACK.

### Task MC-P3 — Propagation status API/Admin panel
- “green/red signal”:
  - GREEN: tất cả worker ACK đúng version
  - RED: thiếu ACK hoặc stale worker

### Task MC-P4 — Retry/timeout policy
- Nếu worker chưa ACK sau timeout:
  - đánh dấu degraded
  - raise alert cho supervisor

## 3.4 Acceptance criteria
- Có thể xác nhận hệ thống đang chạy version nào theo worker-level.
- Không còn trạng thái mù “config đã save nhưng worker chưa nhận”.

---

## Phase 4 (P0/P1): Scheduled Activation + Canary Rollout

## 4.1 Mục tiêu
Giảm rủi ro apply toàn cục bằng cơ chế lịch và rollout phân đoạn.

## 4.2 File dự kiến tác động
- `backend/portfolio/tasks.py`
- `backend/portfolio/models.py`
- `backend/portfolio/admin.py`
- `backend/portfolio/views.py`
- tests liên quan scheduling/canary

## 4.3 Breakdown task lập trình
### Task MC-R1 — Scheduled activation
- Cho phép đặt `effective_from` (timezone-safe).
- Job nền kích hoạt đúng giờ.

### Task MC-R2 — Canary scope
- Scope theo:
  - market group (VD: VN30)
  - exchange
  - explicit symbols
- Tỷ lệ rollout hoặc fixed subset.

### Task MC-R3 — Auto promote / manual promote
- Nếu canary pass health window -> cho phép promote full.
- Supervisor có thể promote thủ công.

### Task MC-R4 — Rollback integration
- Rollback được từ cả trạng thái scheduled/canary/full.

## 4.4 Acceptance criteria
- Schedule chạy đúng giờ.
- Canary không ảnh hưởng ngoài scope định nghĩa.

---

## Phase 5 (P1): Auto-Revert & Anomaly Detection Safety Net

## 5.1 Mục tiêu
Tự động phòng vệ khi config mới gây bùng nổ alert bất thường.

## 5.2 File dự kiến tác động
- `backend/portfolio/tasks.py`
- `backend/portfolio/services.py`
- `backend/portfolio/views.py`
- `backend/config/settings.py` (thresholds)
- test anomaly/autorevert mới

## 5.3 Breakdown task lập trình
### Task MC-S1 — Baseline calculation
- Tính baseline alert volume theo cửa sổ thời gian.

### Task MC-S2 — Spike detector
- Trigger khi alerts/minute vượt ngưỡng (ví dụ 5x baseline).

### Task MC-S3 — Auto-revert executor
- Tự rollback về version trước.
- Ghi audit + reason “auto_revert_anomaly”.

### Task MC-S4 — Notifications
- Gửi cảnh báo Telegram/Email đến Supervisor.

## 5.4 Acceptance criteria
- Có thể mô phỏng spike và hệ thống rollback an toàn.
- Mọi auto-action đều có audit trace.

---

## Phase 6 (P1): Mission Dashboard + Symbol Coverage UX nâng cao

## 6.1 Mục tiêu
Biến admin page thành trung tâm điều hành dễ vận hành, không chỉ form nhập liệu.

## 6.2 File dự kiến tác động
- `backend/portfolio/admin.py`
- `backend/portfolio/views.py` (nếu cần endpoint nội bộ)
- `backend/portfolio/services.py`
- `frontend/src/pages/AdminOps.jsx` (nếu mở rộng hiển thị qua FE page)
- test admin/ui tương ứng

## 6.3 Breakdown task lập trình
### Task MC-D1 — Mini status dashboard
- Hiển thị:
  - alerts last 5m/10m
  - worker CPU/RAM summary
  - propagation signal
  - active/pending version badges

### Task MC-D2 — Bulk upload symbols
- Upload CSV/XLSX allow/exclude list.
- Validate/normalize symbols + deduplicate.

### Task MC-D3 — Dynamic group selectors
- Chọn theo exchange/sector/market group.
- Tùy chọn auto-include mã mới trong group.

### Task MC-D4 — UX quality
- Action buttons rõ:
  - Save Draft
  - Preview Impact
  - Submit Approval
  - Approve & Apply
  - Rollback

## 6.4 Acceptance criteria
- Admin xử lý danh sách lớn mà không cần text area thủ công.
- Trạng thái hệ thống nhìn “at a glance” trong 5–10 giây.

---

## 7) Thorough Testing Plan (UI/API/Edge/Compliance)

## 7.1 UI/Web thorough testing
### A. Django Admin Mission Control
- Tất cả fieldsets/sections render đúng theo role.
- Workflow đầy đủ:
  - Draft -> Preview -> Submit -> Approve -> Apply -> Rollback
- Buttons enable/disable đúng theo state/dependency.
- Diff view hiển thị chính xác old/new values.
- Dashboard mini cập nhật status đúng (ACK, health, load).

### B. Nếu có FE liên quan (AdminOps/Whale dashboard)
- Kiểm tra toàn bộ route/section liên quan config status.
- Kiểm tra phản ánh version/health/realtime warning.

## 7.2 Backend/API thorough testing (curl + automated)
### Endpoint groups cần cover
1. Config lifecycle APIs (draft/preview/approval/apply/rollback)
2. Rollout APIs (schedule/canary/promote)
3. Propagation/health APIs
4. Audit log APIs
5. Dependency check APIs

### Scenario matrix
- Happy path
- Validation errors
- Permission denied
- Conflict/race
- Idempotency
- Timeout/retry
- Degraded dependency
- Auto-revert trigger path

### Curl coverage tối thiểu
- 40+ calls gồm happy + error + edge + permission/compliance

## 7.3 Edge/Failure testing
- Redis down giữa apply
- Worker stale cache
- Provider timeout/intermittent
- Schedule clock skew
- Canary scope invalid
- Concurrent approvals
- Rollback during active rollout

## 7.4 Compliance testing
- Analyst không thể apply production.
- Supervisor không thể bypass reason/audit.
- Maker-checker enforced.
- Audit log đầy đủ before/after/reason/ticket.
- Traceability config_version trong event lifecycle.

## 7.5 Non-functional testing
- p95 latency của apply/preview endpoints
- Propagation convergence time
- Logging correlation completeness
- Security checks (CSRF/session/permission boundaries)

---

## 8) Definition of Done (Mission Control)

Done khi đồng thời đạt:
1. Warm-up diff + dependency check trước apply.
2. Guardrails cứng chặn cấu hình nguy hiểm.
3. Approval workflow Analyst/Supervisor + maker-checker.
4. Apply propagation có worker ACK visibility.
5. Schedule + canary rollout chạy đúng.
6. Auto-revert hoạt động khi anomaly.
7. Bulk coverage UX vận hành được với danh sách lớn.
8. Thorough tests pass (UI/API/edge/compliance).
9. Docs đồng bộ với code + execution log cập nhật.

---

## 9) Thứ tự triển khai bắt buộc

1. Phase 1 — Foundation  
2. Phase 2 — Integrity + Guardrails  
3. Phase 3 — Propagation  
4. Phase 4 — Schedule/Canary  
5. Phase 5 — Auto-Revert  
6. Phase 6 — Dashboard + Bulk UX  

Không đảo thứ tự để tránh:
- Rollout trước khi có guardrails/compliance
- Apply trước khi có propagation visibility
- UX mở rộng khi core control plane chưa ổn định

---

## 10) Danh sách tài liệu cần cập nhật khi code bắt đầu

- `docs/ROADMAP_STATUS.md`
- `docs/SPRINT_EXECUTION_LOG.md`
- `docs/IMPLEMENTATION_BOARDS.md`
- `docs/FEATURE_EXPANSION_BACKLOG.md`
- `docs/SPRINT14_EXECUTION_PLAN_REBASELINED.md`
- Checklist nghiệm thu Sprint 14 (sẽ tạo mới khi coding start)

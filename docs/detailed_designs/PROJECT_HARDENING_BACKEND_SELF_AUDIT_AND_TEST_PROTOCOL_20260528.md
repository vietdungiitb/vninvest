# Self Audit and Test Protocol — Project Hardening Backend
**Ngày**: 2026-05-28  
**Parent**: docs/detailed_designs/PROJECT_HARDENING_BACKEND_HANDOFF_MASTER_20260528.md

---

## 1. Entry criteria

Trước khi bắt đầu một slice, bắt buộc xác nhận:

1. Đã đọc action plan nguồn và tech spec của pack này.
2. Đã xác định đúng slice ID trong taskboard.
3. Đã khóa file neo và validation gate của slice.
4. Đã biết rõ slice này có chạm runtime code hay chỉ chạm docs/config.

---

## 2. Audit checklist theo phase

### A. Governance and scope

- [ ] Slice nằm trong `packages/core` hoặc `packages/web`, trừ khi là config Nginx đã được plan chỉ định.
- [ ] Không tự ý mở rộng sang unrelated roadmap blocker.
- [ ] Không claim “done” nếu chưa có evidence template.

### B. Tenant isolation hardening

- [ ] Scope migration đúng 6 thực thể mục tiêu.
- [ ] Có pre-audit output cho orphan records.
- [ ] Không có logic fallback `system_tenant` hoặc default tenant assignment.
- [ ] Migration fail-fast nếu dữ liệu chưa sạch.

### C. Security and throttling

- [ ] App-level auth throttling không bị xoá hoặc yếu đi.
- [ ] Gateway config có `limit_req_zone` và `limit_req` ở đúng vị trí.
- [ ] Có proof HTTP 429 hoặc config-level smoke cho abuse path.

### D. Refactor integrity

- [ ] Refactor không làm drift public contract.
- [ ] Backend files target đã tách responsibility rõ.
- [ ] `packages/web` vẫn pass `build-community`.

### E. Phase 2 greenfield safety

- [ ] `commercial/` foundation cũ được reuse đúng.
- [ ] Notification pipeline không tạo truth layer mới bên ngoài backend.
- [ ] AI cost control có quota, cache, router guardrails.

---

## 3. Validation protocol

### 3.1 Docs/config-only slice

1. `git diff --check`
2. cập nhật governance docs
3. regenerate `module_tree_full.md`

### 3.2 Backend slice

1. bootstrap env theo runbook
2. chạy focused Django tests
3. nếu chạm runtime path, chạy `./start_dev.ps1`
4. lưu evidence command + result

### 3.3 Web slice

1. chạy focused web tests nếu có
2. chạy `npm --prefix packages/web run build-community`
3. nếu chạm runtime/UI, chạy lane refresh phù hợp
4. chụp payload/UI evidence nếu contract thay đổi

---

## 4. Mandatory stop conditions

Phải stop và raise blocker nếu gặp một trong các tình huống sau:

1. Core backend env chưa bootstrap được nhưng vẫn định kết luận QG-1 pass.
2. Còn orphan unresolved nhưng migration đã chuẩn bị set `NOT NULL`.
3. Có ý định dùng `system_tenant` để lấp dữ liệu thiếu.
4. `build-community` fail sau refactor web.
5. Phase 2 implementation cố rewrite các foundation `Subscription`, `QuotaRecord`, `Invoice` mà không có lý do kiến trúc mới được duyệt.

---

## 5. Exit checklist

- [ ] Commands đã chạy và được ghi vào evidence
- [ ] Residual risks được ghi rõ
- [ ] Taskboard status đã cập nhật
- [ ] Traceability row được cross-check
- [ ] `CODE_CHANGE_AUDIT_LEDGER.md` đã cập nhật
- [ ] `PROGRESS_DASHBOARD.md` đã cập nhật
- [ ] `MODIFIED_FILES_AUDIT_T12_PHASE_4_20250501.md` đã cập nhật
- [ ] `module_tree_full.md` đã regenerate

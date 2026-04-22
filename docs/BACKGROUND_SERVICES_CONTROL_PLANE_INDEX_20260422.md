# BACKGROUND SERVICES CONTROL PLANE — DOCUMENT INDEX

**Ngày tạo**: 2026-04-22  
**Mục tiêu**: Index điều hướng 1 trang cho PM/Lead/Team Code đọc nhanh toàn bộ documentation pack.

---

## 1. Mục tiêu chương trình

Chương trình này tạo một control plane thống nhất để quản lý mọi dịch vụ chạy ngầm trong hệ thống, thay vì xử lý rời rạc theo từng task như backfill, prefetch, sync, advisory, realtime enrichment.

Kết quả mong muốn:
1. Biết chính xác service nào đang chạy, service nào stalled/zombie.
2. Biết worker nào đang chạy lệch version/release/config.
3. Chặn chạy chồng cùng scope.
4. Chạy lại an toàn, có write-mode governance, tránh ghi đè dữ liệu ngoài ý muốn.
5. Có tài liệu đủ sâu để team code bắt đầu implementation không cần họp lại kiến trúc nền.

---

## 2. Bộ tài liệu chính thức

### Nhóm nền tảng
1. [docs/crawling_control_center_proposal.md](docs/crawling_control_center_proposal.md)
2. [docs/IMPLEMENTATION_PLAN_BACKGROUND_SERVICES_CONTROL_PLANE_20260422.md](docs/IMPLEMENTATION_PLAN_BACKGROUND_SERVICES_CONTROL_PLANE_20260422.md)
3. [docs/TECH_SPEC_BACKGROUND_SERVICES_CONTROL_PLANE_20260422.md](docs/TECH_SPEC_BACKGROUND_SERVICES_CONTROL_PLANE_20260422.md)
4. [docs/TASKBOARD_BACKGROUND_SERVICES_CONTROL_PLANE_20260422.md](docs/TASKBOARD_BACKGROUND_SERVICES_CONTROL_PLANE_20260422.md)

### Nhóm bàn giao / điều hành
5. [docs/WALKTHROUGH_BACKGROUND_SERVICES_CONTROL_PLANE_20260422.md](docs/WALKTHROUGH_BACKGROUND_SERVICES_CONTROL_PLANE_20260422.md)
6. [docs/RUNBOOK_BACKGROUND_SERVICES_CONTROL_PLANE_20260422.md](docs/RUNBOOK_BACKGROUND_SERVICES_CONTROL_PLANE_20260422.md)
7. [docs/GO_NO_GO_BACKGROUND_SERVICES_CONTROL_PLANE_20260422.md](docs/GO_NO_GO_BACKGROUND_SERVICES_CONTROL_PLANE_20260422.md)

### Nhóm bổ sung cho kickoff coding
8. [docs/PILOT_SERVICE_SELECTION_BACKGROUND_CONTROL_PLANE_20260422.md](docs/PILOT_SERVICE_SELECTION_BACKGROUND_CONTROL_PLANE_20260422.md)
9. [docs/CODING_KICKOFF_PHASE0_PHASE1_BACKGROUND_CONTROL_PLANE_20260422.md](docs/CODING_KICKOFF_PHASE0_PHASE1_BACKGROUND_CONTROL_PLANE_20260422.md)

---

## 3. Thứ tự đọc theo vai trò

### PM / Project Lead
1. Proposal
2. Index này
3. Implementation Plan
4. Walkthrough
5. Go / No-Go

### Backend Lead
1. Proposal
2. Implementation Plan
3. Tech Spec
4. Pilot Service Selection
5. Coding Kickoff Phase 0-1
6. Taskboard

### Frontend Lead
1. Proposal
2. Implementation Plan
3. Tech Spec
4. Taskboard
5. Walkthrough

### Ops / QA
1. Proposal
2. Runbook
3. Go / No-Go
4. Taskboard
5. Walkthrough

---

## 4. Tài liệu nào dùng khi nào

| Tình huống | Tài liệu cần mở |
|---|---|
| Cần hiểu vì sao phải làm control plane | Proposal |
| Cần biết rollout theo phase | Implementation Plan |
| Cần biết model/API/Redis key/state machine | Tech Spec |
| Cần chia task cho dev | Taskboard |
| Cần kickoff cả team | Walkthrough |
| Cần xử lý sự cố vận hành | Runbook |
| Cần quyết định có cho coding bắt đầu hay chưa | Go / No-Go |
| Cần chọn pilot services | Pilot Service Selection |
| Cần triển khai ngay phase đầu | Coding Kickoff Phase 0-1 |

---

## 5. Exit condition của gói tài liệu

Gói tài liệu này được xem là đủ để handoff khi:
1. Team code chốt được pilot services phase đầu.
2. Team backend hiểu rõ schema/API/state machine cần triển khai.
3. Team frontend hiểu màn hình ops cần dựng.
4. Team ops hiểu alert/runbook tối thiểu.
5. PM/Lead có đủ checklist Go/No-Go trước coding.
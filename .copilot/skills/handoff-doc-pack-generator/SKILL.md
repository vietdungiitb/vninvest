---
name: handoff-doc-pack-generator
description: >
  Tạo bộ tài liệu bàn giao đầy đủ cho đội code theo chuẩn governance của VNInvest.
  Dùng khi user yêu cầu "lập bộ tài liệu bàn giao", "handoff pack", "doc pack cho đội code",
  hoặc cần chuẩn hóa implementation package gồm handoff/plan/spec/taskboard/traceability/runbooks.
argument-hint: "Mô tả vấn đề, phạm vi hệ thống, ngày stamp (YYYYMMDD), và tên chương trình"
---

# Handoff Doc Pack Generator

## Mục tiêu

Skill này chuẩn hóa quy trình tạo bộ tài liệu bàn giao để đội code có thể triển khai ngay, không cần hỏi lại context.

Đầu ra mặc định gồm 12 tài liệu chuẩn:
1. Handoff Master
2. Implementation Plan
3. Tech Spec
4. Taskboard
5. Traceability Matrix
6. Self Audit and Test Protocol
7. Execution Evidence Template
8. Config Ownership Matrix
9. Code Quality Constitution
10. Run Code Review
11. Run Integration Tests
12. Run Spec Audit

## Khi nào dùng

Bắt buộc dùng khi có một trong các tín hiệu:
1. User yêu cầu "tạo bộ tài liệu bàn giao".
2. Cần giao việc cho đội code hoặc agent khác thực thi nhiều slice.
3. Cần khóa scope/DoD/test gates trước khi coding.
4. Cần compliance package cho audit/review/spec-audit.

## Quy trình chuẩn

### Bước 1: Thu thập context bắt buộc

Đọc tối thiểu:
1. AGENTS.md
2. quality/QUALITY.md
3. module_tree_full.md
4. Bộ tài liệu mẫu gần nhất cùng domain trong docs/

Mục tiêu của bước này:
1. Xác định naming pattern của docs hiện hữu.
2. Xác định hard rules phải carry sang gói mới.
3. Xác định phạm vi SaaS native (packages/core + packages/web).

### Bước 2: Định nghĩa package identity

Tạo identifier thống nhất:
1. PROGRAM_NAME: ví dụ GLOBAL_ALERT_CENTER_SUMMARY_SYMBOL_STATS_PARITY_REMEDIATION
2. DATE_STAMP: ví dụ 20260521

Từ đó sinh tên file:
1. docs/{PROGRAM_NAME}_HANDOFF_MASTER_{DATE_STAMP}.md
2. docs/IMPLEMENTATION_PLAN_{PROGRAM_NAME}_{DATE_STAMP}.md
3. docs/TECH_SPEC_{PROGRAM_NAME}_{DATE_STAMP}.md
4. docs/TASKBOARD_{PROGRAM_NAME}_{DATE_STAMP}.md
5. docs/{PROGRAM_NAME}_TRACEABILITY_MATRIX_{DATE_STAMP}.md
6. docs/{PROGRAM_NAME}_SELF_AUDIT_AND_TEST_PROTOCOL_{DATE_STAMP}.md
7. docs/{PROGRAM_NAME}_EXECUTION_EVIDENCE_TEMPLATE_{DATE_STAMP}.md
8. docs/{PROGRAM_NAME}_CONFIG_OWNERSHIP_MATRIX_{DATE_STAMP}.md
9. docs/{PROGRAM_NAME}_CODE_QUALITY_CONSTITUTION_{DATE_STAMP}.md
10. docs/RUN_CODE_REVIEW_{PROGRAM_NAME}_{DATE_STAMP}.md
11. docs/RUN_INTEGRATION_TESTS_{PROGRAM_NAME}_{DATE_STAMP}.md
12. docs/RUN_SPEC_AUDIT_{PROGRAM_NAME}_{DATE_STAMP}.md

### Bước 3: Soạn nội dung theo vai trò từng tài liệu

1. Handoff Master:
- Mục tiêu
- Vấn đề đã xác nhận
- Quyết định đã khóa
- Deliverables
- Định nghĩa thành công

2. Implementation Plan:
- Dependency graph
- Task breakdown theo Task ID
- DoD từng task
- Validation gates toàn workstream

3. Tech Spec:
- Scope model
- Invariants bắt buộc
- API contracts/response shape
- Thuật toán aggregate
- Observability requirements

4. Taskboard:
- Trạng thái task
- Gate notes
- Điều kiện block merge/close

5. Traceability Matrix:
- Requirement ID -> task -> validation

6. Self Audit and Test Protocol:
- Checklist A/B/C/D/E
- Fail conditions block merge

7. Execution Evidence Template:
- Slice metadata
- Files changed
- Validation commands
- Payload/UI/parity evidence
- Residual risks

8. Config Ownership Matrix:
- Canonical writer cho từng concern
- Transition owner -> end-state owner

9. Code Quality Constitution:
- Coverage targets theo subsystem
- Coverage theater prevention
- Fitness-to-purpose scenarios

10. Run Code Review:
- Bootstrap docs
- Review focus
- Grep checks
- Reject conditions

11. Run Integration Tests:
- Backend suites
- Frontend suites
- Runtime smoke (start_dev)
- Mandatory gate

12. Run Spec Audit:
- Audit questions
- Output format findings

### Bước 4: Hậu kiểm tài liệu

Checklist pass tối thiểu:
1. Đủ 12/12 file.
2. Naming đồng nhất PROGRAM_NAME + DATE_STAMP.
3. Có Task IDs, Requirement IDs, và Gate conditions rõ ràng.
4. Không mâu thuẫn hard rules trong AGENTS.md/QUALITY.md.

### Bước 5: Cập nhật governance artifacts

Bắt buộc cập nhật:
1. CODE_CHANGE_AUDIT_LEDGER.md
2. PROGRESS_DASHBOARD.md

Entry phải nêu:
1. Vấn đề đã giải quyết.
2. Danh sách file tạo/sửa.
3. Validation của doc pack.
4. Residual risk (doc-only hay đã code).

### Bước 6: Module tree discipline

Sau khi hoàn tất thay đổi, regenerate:
1. module_tree_full.md

Lệnh chuẩn:
```powershell
python scripts/ops/generate_module_tree.py
```

## Tiêu chí Done của skill

Chỉ được coi là done khi đồng thời đạt:
1. 12 tài liệu đã tạo đầy đủ và có nội dung triển khai được.
2. CODE_CHANGE_AUDIT_LEDGER và PROGRESS_DASHBOARD đã cập nhật.
3. module_tree_full.md đã regenerate.
4. User nhận được danh mục link đầy đủ để bàn giao ngay.

## Anti-patterns cấm

1. Chỉ tạo 1-2 tài liệu rồi gọi là handoff pack.
2. Không có taskboard/traceability/self-audit.
3. Không có runbooks review/test/spec audit.
4. Không cập nhật ledger/progress.
5. Dùng naming tùy hứng không theo pattern docs hiện hữu.

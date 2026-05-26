---
name: handoff-doc-pack-scaffold
description: >
  Sinh nhanh skeleton bộ 12 tài liệu bàn giao cho đội code theo chuẩn VNInvest.
  Dùng khi user cần khởi tạo khung docs trước, sau đó điền nội dung chi tiết theo chương trình.
  Trigger: "tạo skeleton doc pack", "khởi tạo bộ tài liệu bàn giao", "scaffold handoff docs".
argument-hint: "PROGRAM_NAME (UPPER_SNAKE_CASE) + DATE_STAMP (YYYYMMDD) + optional scope summary"
---

# Handoff Doc Pack Scaffold

## Mục tiêu

Khởi tạo nhanh bộ khung 12 tài liệu để đội code hoặc agent khác điền nội dung chi tiết mà không bị thiếu artifact governance.

## Đầu vào bắt buộc

1. PROGRAM_NAME (UPPER_SNAKE_CASE), ví dụ: ALERT_CENTER_PARITY_FIX
2. DATE_STAMP (YYYYMMDD), ví dụ: 20260521
3. Scope summary ngắn (khuyến nghị)

## Bộ file phải tạo

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

## Quy trình scaffold

### Bước 1: Validate naming

1. PROGRAM_NAME chỉ gồm A-Z, 0-9, underscore.
2. DATE_STAMP đúng 8 chữ số YYYYMMDD.
3. Check chưa trùng file existing trong docs/.

### Bước 2: Tạo skeleton nội dung tối thiểu

Mỗi file phải có:
1. Title chuẩn theo tên tài liệu.
2. Metadata ngày + status.
3. Các section placeholder theo đúng vai trò từng file.
4. TODO markers rõ để assignee điền.

### Bước 3: Chèn placeholders theo vai trò

1. Handoff Master: mục tiêu, vấn đề, quyết định, deliverables, success criteria.
2. Implementation Plan: dependency graph, task breakdown, DoD, gates.
3. Tech Spec: scope model, invariants, contract, algorithm.
4. Taskboard: task list + status + gate notes.
5. Traceability: requirement map.
6. Self-audit: checklist + fail conditions.
7. Evidence template: slice record block.
8. Config ownership: canonical writer matrix.
9. Quality constitution: coverage targets + anti-theater.
10. Run code review: bootstrap + reject conditions.
11. Run integration tests: suites + smoke + mandatory gate.
12. Run spec audit: audit questions + output format.

### Bước 4: Governance updates

Sau khi scaffold xong, bắt buộc:
1. Cập nhật CODE_CHANGE_AUDIT_LEDGER.md.
2. Cập nhật PROGRESS_DASHBOARD.md.
3. Regenerate module_tree_full.md.

## Tiêu chí Done

1. 12/12 file tồn tại đúng pattern.
2. Không thiếu placeholder section lõi theo vai trò.
3. Governance artifacts đã cập nhật.
4. module_tree_full.md đã regenerate.

## Anti-patterns cấm

1. Tạo thiếu file runbooks.
2. Tạo file nhưng bỏ trống hoàn toàn không có heading/section.
3. Dùng naming không nhất quán giữa các file trong cùng package.
4. Quên cập nhật ledger/progress/module tree.

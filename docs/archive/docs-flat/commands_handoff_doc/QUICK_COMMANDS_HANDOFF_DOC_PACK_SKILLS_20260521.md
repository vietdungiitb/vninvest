# Quick Commands — Handoff Doc Pack Skills
**Ngày**: 2026-05-21

Mục tiêu: cho team dùng nhanh 2 skill theo chuỗi:
1. Scaffold bộ khung 12 tài liệu
2. Fill nội dung đầy đủ theo governance

---

## 1. Biến đầu vào chuẩn

- PROGRAM_NAME: UPPER_SNAKE_CASE
- DATE_STAMP: YYYYMMDD
- SCOPE_SUMMARY: mô tả ngắn bài toán

Ví dụ:
- PROGRAM_NAME = GLOBAL_ALERT_CENTER_SUMMARY_SYMBOL_STATS_PARITY_REMEDIATION
- DATE_STAMP = 20260521
- SCOPE_SUMMARY = khắc phục lệch số KPI tổng và thống kê theo mã

---

## 2. Lệnh nhanh Bước 1 — Scaffold

Dán nguyên văn vào chat:

```text
Dùng skill handoff-doc-pack-scaffold.
PROGRAM_NAME={PROGRAM_NAME}
DATE_STAMP={DATE_STAMP}
SCOPE={SCOPE_SUMMARY}
Hãy scaffold đủ 12 tài liệu theo pattern docs của dự án, cập nhật CODE_CHANGE_AUDIT_LEDGER.md, PROGRESS_DASHBOARD.md, MODIFIED_FILES_AUDIT_T12_PHASE_4_20250501.md và regenerate module_tree_full.md.
```

---

## 3. Lệnh nhanh Bước 2 — Fill nội dung đầy đủ

Dán nguyên văn vào chat:

```text
Dùng skill handoff-doc-pack-generator.
PROGRAM_NAME={PROGRAM_NAME}
DATE_STAMP={DATE_STAMP}
SCOPE={SCOPE_SUMMARY}
Hãy điền đầy đủ nội dung triển khai thực thi cho toàn bộ 12 tài liệu theo chuẩn governance hiện có, bao gồm task IDs, requirement IDs, DoD, validation gates, self-audit fail conditions, runbooks review/test/spec-audit, rồi cập nhật CODE_CHANGE_AUDIT_LEDGER.md, PROGRESS_DASHBOARD.md, MODIFIED_FILES_AUDIT_T12_PHASE_4_20250501.md và regenerate module_tree_full.md.
```

---

## 4. Lệnh một phát (scaffold + fill)

```text
Thực hiện chuỗi 2 bước:
(1) dùng skill handoff-doc-pack-scaffold để tạo skeleton 12 tài liệu
(2) dùng skill handoff-doc-pack-generator để điền đầy đủ nội dung
Input:
- PROGRAM_NAME={PROGRAM_NAME}
- DATE_STAMP={DATE_STAMP}
- SCOPE={SCOPE_SUMMARY}
Yêu cầu bắt buộc: cập nhật CODE_CHANGE_AUDIT_LEDGER.md, PROGRESS_DASHBOARD.md, MODIFIED_FILES_AUDIT_T12_PHASE_4_20250501.md và regenerate module_tree_full.md.
```

---

## 5. Checklist sau khi chạy

1. Có đủ 12 file docs theo đúng pattern tên.
2. Taskboard có status + gate notes.
3. Traceability có Requirement IDs.
4. Self-audit có fail conditions block merge.
5. Runbooks code review/integration/spec audit đầy đủ.
6. CODE_CHANGE_AUDIT_LEDGER.md đã có entry mới.
7. PROGRESS_DASHBOARD.md đã có entry mới.
8. MODIFIED_FILES_AUDIT_T12_PHASE_4_20250501.md đã có entry mới.
9. module_tree_full.md đã được regenerate.

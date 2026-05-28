# Traceability Matrix — Project Hardening Backend
**Ngày**: 2026-05-28  
**Parent**: docs/detailed_designs/PROJECT_HARDENING_BACKEND_HANDOFF_MASTER_20260528.md

---

| Req ID | Requirement | Source | Planned Tasks | Validation |
|---|---|---|---|---|
| R1 | Sub-plan phải subordinate với roadmap SSOT | Action plan + roadmap | PH00 | doc review + spec audit |
| R2 | Không được auto-map orphan về `system_tenant` | Audit finding | PH02, PH03 | grep review + migration audit |
| R3 | Pre-migration audit phải quét đủ 6 bảng `user_workspace` | Action plan | PH02 | audit script output |
| R4 | Migration tenant scope phải khớp 6 thực thể mục tiêu | Action plan + code anchors | PH03 | migration diff + model review |
| R5 | App-level throttling hiện có phải được bảo toàn | `views_auth.py` + tests | PH05 | auth tests + code review |
| R6 | Gateway-level throttling phải được thêm ở Nginx | Action plan | PH05 | config diff + 429 smoke |
| R7 | QG-1 backend gate phải dùng đúng `manage.py` path | Audit finding | PH01, PH08 | runbook command pass |
| R8 | QG-1 backend gate phải khóa env bootstrap rõ ràng | Audit finding | PH01, PH08 | runbook review + execution evidence |
| R9 | QG-1 web gate phải dùng `build-community` | Audit finding + package.json | PH07, PH08 | build command pass |
| R10 | `commercial/` phải được mô tả đúng foundation hiện tại | Audit finding | PH09 | spec review |
| R11 | Notification pipeline phải xuất phát từ backend truth hiện có | Action plan | PH10 | contract review + tests |
| R12 | AI cost control phải có quota/cache/router guardrails | Action plan | PH11 | integration tests + spec audit |
| R13 | Governance artifacts phải cập nhật mỗi slice | Skill + repo rules | PH00-PH11 | ledger/progress/modified-files |
| R14 | `module_tree_full.md` phải regenerate sau hoàn tất thay đổi | Skill + repo rules | PH00-PH11 | module tree timestamp |

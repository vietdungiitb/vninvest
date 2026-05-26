# Taskboard — Global Alert Center Summary-Symbol Stats Parity Remediation
**Ngày**: 2026-05-21  
**Status**: Active  
**Parent**: `docs/IMPLEMENTATION_PLAN_GLOBAL_ALERT_CENTER_SUMMARY_SYMBOL_STATS_PARITY_REMEDIATION_20260521.md`

---

## Trạng thái tổng quan

| Task | Tên | Status | Assignee | Note |
|---|---|---|---|---|
| D00 | Doc pack bàn giao | ✅ DONE | Copilot | Bộ 12 tài liệu đã tạo |
| P01 | Shared scope + timeframe parser | ⬜ NOT STARTED | Core backend | Chuẩn hóa scope builder |
| P02 | Summary aggregate correctness | ⬜ NOT STARTED | Core backend | Sửa unseen/user-scope + anti-dup |
| P03 | Symbol-stats endpoints | ⬜ NOT STARTED | Core backend | Main + AI lanes |
| P04 | Adapter extension | ⬜ NOT STARTED | Web frontend | Add methods + tests |
| P05 | AlertCenterPage switch | ⬜ NOT STARTED | Web frontend | Bỏ local aggregate |
| P06 | UI semantics hardening | ⬜ NOT STARTED | Web frontend | Label rõ scope |
| P07 | Test & parity gates | ⬜ NOT STARTED | Core + Web | Invariant tests |
| P08 | Runtime verification | ⬜ NOT STARTED | Ops + QA | start_dev smoke + screenshots |
| P09 | Audit docs update | ⬜ NOT STARTED | Assignee từng slice | ledger/progress/evidence |

**Legend**: ⬜ NOT STARTED | 🔄 IN PROGRESS | ✅ DONE | ❌ BLOCKED

---

## Gate notes

1. Không close `P05` nếu chưa close `P03`.
2. Không close `P06` nếu chưa có text semantics tiếng Việt đầy đủ dấu.
3. Không close `P07` nếu thiếu invariant test tổng-khớp-theo-mã.
4. Không close chương trình nếu thiếu `P08` runtime verification.
5. Mọi slice phải có evidence theo template trước khi mark DONE.

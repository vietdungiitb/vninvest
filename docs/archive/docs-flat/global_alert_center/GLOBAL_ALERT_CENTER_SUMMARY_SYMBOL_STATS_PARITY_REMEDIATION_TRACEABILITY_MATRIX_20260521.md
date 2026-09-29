# Traceability Matrix — Global Alert Center Summary-Symbol Stats Parity Remediation
**Ngày**: 2026-05-21

| Requirement ID | Yêu cầu | Source | Planned Tasks | Validation |
|---|---|---|---|---|
| ACP-01 | Tổng KPI phải khớp tổng theo mã cùng scope | User bug report + analysis | P02, P03, P05, P07 | Backend invariant tests + UI verify |
| ACP-02 | Bảng theo mã không được aggregate từ feed page sample | Technical audit | P03, P05 | Code review + payload snapshots |
| ACP-03 | Timeframe phải được backend thực thi thật | Technical audit | P01, P07 | API tests theo timeframe |
| ACP-04 | Scope filter thống nhất giữa feed/summary/symbol-stats/context | Technical audit | P01, P03, P05 | Cross-endpoint scope tests |
| ACP-05 | Unseen phải theo user hiện tại | Technical audit | P02, P07 | Multi-user delivery tests |
| ACP-06 | UI phải ghi rõ semantics toàn phạm vi vs trang hiển thị | UX requirement | P06, P08 | Screenshot + manual QA checklist |
| ACP-07 | packages/web gọi qua coreApiAdapter | SaaS native hard rule | P04, P05 | Adapter test + grep audit |
| ACP-08 | Bàn giao có evidence đầy đủ mỗi slice | Workflow rule | P09 | Evidence template fill + ledger update |

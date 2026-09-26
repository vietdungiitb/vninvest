# ~~Gap Analysis: Legacy DataOpsPanel.jsx vs SaaS Native~~ — ĐÃ ĐÓNG

> **File này đã bị thay thế ngày 2026-09-26.**
> Nội dung cũ (280 dòng) báo cáo parity `~30–80%` theo 5 subtab. **Con số đó
> sai** — tại thời điểm hiện tại toàn bộ 20 gap đã đóng và parity ~95%+.
>
> Giữ lại file (thay vì xoá hẳn) để không ai phải phân tích lại từ đầu.
> Lịch sử đầy đủ vẫn còn trong `git log`.

## Trạng thái thật

| Subtab      | Legacy key  | Native key   | Kết quả |
| ----------- | ----------- | ------------ | ------- |
| Kho dữ liệu | `data`      | `inventory`  | đóng    |
| Điều phối   | `ops`       | `operations` | đóng    |
| Giám sát    | `monitor`   | `monitor`    | đóng    |
| Lịch chạy   | `scheduler` | `scheduler`  | đóng    |
| Cấu hình    | `config`    | `config`     | đóng    |

Tổng: **20/20 gap đóng** — P0 #1–5, P1 #6–11, P2 #12–16, P3 #17–20.

## Đọc gì thay thế

| Tài liệu                                                 | Nội dung                                                                              |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `docs/IMPLEMENTATION_PLAN_SOC_DATAOPS_FINAL_20260625.md` | Kế hoạch hiện thực đã chạy                                                            |
| `docs/CODE_CHANGE_AUDIT_LEDGER.md` → Entry 88            | Phase 3 commercial hoàn tất: SLO model, SLO computation, SLO FE, alerting, export CSV |
| `docs/CODE_CHANGE_AUDIT_LEDGER.md` → Entry 121           | DataOps config U1–U4 + commercial C1→C7 (19 dòng commit)                              |
| `docs/CODE_CHANGE_AUDIT_LEDGER.md` → Entry 111           | DataOps realtime sync fix W0–W6                                                       |
| `AGENTS.md` → mục `## Done`, SOC DataOps gap analysis    | Tóm tắt                                                                               |

## Ghi chú thay đổi

Bản cũ **không bị xoá khỏi git** — xem `git show <commit>^:packages/web/docs/GAP_ANALYSIS_DATAOPS_LEGACY_VS_SAAS_NATIVE.md`
trước khi thay đổi này (2026-09-26).

Bài học: tài liệu phân tích có số liệu sẽ **hỏng theo thời gian** và trở thành
mối nguy hiểm — người sau đọc số cũ sẽ tưởng còn gap. Bài này bị bỏ sót từ
2026-07-17 (khi 20 gap đã đóng) đến 2026-09-26 mới bị phát hiện, và việc phát
hiện là do dọn dẹp chứ không phải do có gate nào canh.

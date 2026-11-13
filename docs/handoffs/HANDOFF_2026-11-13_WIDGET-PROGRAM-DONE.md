# HANDOFF — Chương trình backend vninvest cho widget Enterprise — HOÀN THÀNH

> Ngày: 2026-11-13 · Base: `origin/dev` @ `1a2289035` (sau PR #378/#379/#380) · Ledger: Entry 484 (next 485)
> PM-proxy toàn quyền đã quyết D1–D8 thay Owner (xem `docs/evidence/widget-backend-roadmap/decisions/d1-d8-final.md`).

## 1. Kết quả từng slice (mỗi slice 1 PR merge-commit, đã push GitHub)

| Slice | PR | Nội dung | Gates |
|---|---|---|---|
| Plan + claims | #377 | Review 11 yêu cầu widget, plan S1–S9 rev 2, 8 claim (1 done + 7 proposed). B3 NEED_REVISION → B4 PASS. Entry 480. | doc-only; local gates xanh |
| S1 WS ticket G0.2 | #378 | `POST auth/ws-ticket` cache 60s single-use + consumers `?ticket=` + `?token=` compat. Entry 481. | 8/8 + hồi quy 504 OK + spectacular clean |
| S2 constituents EP-6 | #379 | `GET market-data/index/<code>/constituents/` reuse helper. Entry 482. | 5/5 + hồi quy 172 OK + spectacular clean |
| S3+S4+S5+S6+S8 | #380 | Probes (year OK/events 0/refresh serve) + decisions D1–D8. Entry 483. | read-only; local gates xanh |

## 2. Trạng thái cuối từng yêu cầu widget (R1–R11)

- **Xong, widget dùng được ngay:** R1 WS ticket · R5 constituents · R9 refresh · R4 (year data thật; cash_flow giữ null trung thực) · B-1..B-6 (có sẵn).
- **Giữ nguyên trung thực theo quyết định PM:** R2 depth rỗng (D2) · R3 `adjusted:false` (D1) · R6 WS+poll (D3).
- **Defer/redirect:** R7 EP-9 (D4) · R10 → vnsaas (D5) · R11/E5 conformance: vninvest đã đủ làm reference (endpoint + scope + typed); kit test do widget team viết.

## 3. Việc tiếp theo (ngoài chương trình này)

- Widget team: bật `wsTicketEnabled`, map contract constituents/financials, verify E2E WS từ ngoài (ghi CHƯA CHẠY — không có PAT thật trong phiên này).
- Mở lại EP-1/EP-3 khi Owner ký nguồn dữ liệu vendor.
- Full BE/FE suite + deploy staging: ticket riêng (ghi CHƯA CHẠY trong Entry 481–483).

## 4. Dọn dẹp

VPS: worktree/DB tạm các slice đã DROP + remove + prune (chỉ còn `/tmp/wt-gatep0*` của slice cũ — để coordinator). Local: nhánh slice đã xóa hết; `dev` fast-forward sạch.

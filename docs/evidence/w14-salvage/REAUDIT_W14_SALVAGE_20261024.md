# Hồ sơ re-audit độc lập — slice W1.4-salvage, trạng thái cuối (2026-10-24)

> Backfill từ transcript phiên làm việc (auditor: subagent độc lập, chỉ đọc).
> File này tồn tại vì quy tắc cứng số 6 (Owner chốt 2026-10-24): mọi re-audit PHẢI thành văn bản.
> Hồ sơ điều tra gốc: `docs/evidence/w14-salvage/AUDIT_W14_SALVAGE_20261024.md` (viết bởi implementer).
> Hồ sơ này là verdict độc lập trên code cuối (sau revert).

## Verdict: `AGREE` (+reservation) — 0 blocker

### Đã xác minh bằng đọc thật

- `packages/core/backend/src/market_data/views.py` byte-identical với `origin/dev` (cùng hash `62e0243c`, diff 0 char) — revert sạch, slice không để lại code BE nào.
- Kết luận refute đúng: route chart chỉ dùng `StockManagementChartView` (`core_urls.py:14,62` + `public_urls.py:17,64`); `StockChartView` chỉ định nghĩa tại `views.py:177`, 0 import — khớp evidence `docs/evidence/api02/map/m1.md:291` (`on_route=NO`). Helper live tính thật tại `stock_mgmt_native_views.py:805-859` (SMA20/50, RSI14, momentum, bias, latest_close).
- Hook bash-guard đúng tinh thần "chỉ chặn legacy": trace 4 case qua `vninvest-hooks.ts:85-95,152-168` — `packages/core/backend/...` → ALLOW (relativize qua worktree), `rm backend/cache` / `python backend/...` → DENY, `node scripts/...` → ALLOW. Bonus live: chính lệnh simulation của auditor (chứa token legacy trong string) đã bị guard chặn — guard có lửa thật.

### Reservations (non-blocking, đã xử lý hết trước PR)

1. Claim row `w14-salvage` vẫn khai scope `views.py` + `in-progress` trong khi code không còn hunk nào ở `views.py` → đã sửa row: bỏ `views.py`, ghi rõ refute/hoàn tác, chuyển `done`.
2. `docs/PLAN_W14_SALVAGE_20261024.md` header (HOÀN TÁC/KHÔNG salvage) mâu thuẫn nội bộ §1/§2/§4 (SCOPE cherry-pick, G1/G2 như thể vẫn làm) → đã đóng dấu SUPERSEDED, giữ body tham khảo.
3. PLAN viện dẫn "ledger Entry 407" khi ledger mới nhất là 406 → đã append Entry 407 trước PR (đúng kế hoạch).
4. Branch chạm `.opencode-plugins/vninvest-hooks.ts` ngoài claim SCOPE (file thuộc slice opencode-plugin-fix đã done) → đã bổ sung scope vào claim; không tách branch vì harmless.
5. Hook còn kẽ nhỏ (dotted `python -m backend.module` lọt; thiếu verb `del` win32; FP "mention-vs-use" khi lệnh chỉ nhắc đường dẫn legacy trong quote) → chấp nhận cho guard nudge, không yêu cầu sửa.

## Dấu vết phiên bản

- Audit trên cây sau revert (views.py == dev), trước commit re-audit.
- Auditor: subagent `general` (session `ses_e92934f26ffeDt3wKD6tDtQIg7`).

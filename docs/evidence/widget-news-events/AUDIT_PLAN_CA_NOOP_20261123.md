# Audit độc lập plan CA-NOOP (2026-11-23)

> Auditor: subagent `general` (chỉ đọc, không sửa code). Đối tượng: `docs/PLAN_CA_NOOP_PARTIAL_FACTOR_20261123.md`.
> Verdict: **NEED_REVISION** — dừng trước dòng code đầu tiên theo B4.

## Objections

1. **Test cũ sẽ đỏ.** `test_corporate_action_adjustment.py:59-71` (`test_unparsed_is_per_date`) assert `adj_close is None` cho factor `partial` no-op. Plan khẳng định "test hiện có vẫn xanh" là sai; phải thừa nhận đảo ngược semantics có chủ đích.
2. **Sai lầm tài chính (chí mạng).** `factor_total == 1` trên factor `partial` không có nghĩa "sự kiện không đổi giá" mà là **parser không trích được số liệu**. VIC có rights issue 20.2% / chuyển trái phiếu ⇒ pha loãng thật. Bỏ qua chúng sẽ phát `adj_close` sai + `is_adjusted=True` — đúng điều fail-closed hiện tại chặn. Muốn đổi policy phải có **owner chốt**.
3. **Mục tiêu không đạt trong SCOPE.** Badge "Chưa điều chỉnh" do FE quyết (`showAdjustedBadge = !hasAdjusted`, `hasAdjusted = typeof adapter.fetchAdjustedBars === 'function'`). Plan cấm đụng FE ⇒ badge vẫn còn dù BE sửa.
4. **Số liệu thiếu lệnh tái tạo.** Các con number `2.254.058/4.584.956`, `63/64`, `0.6246096190` chỉ có trong plan, không có trong evidence file được cite. Vi phạm quy tắc "mọi số kèm lệnh tái tạo".
5. **Process.** Đánh `[x]` claim khi chưa commit; trùng ID lesson `L-M02` giữa 2 file; `npx tsc --noEmit` vô nghĩa với slice Python-only.

## Quyết định
Không viết code. Claim chuyển `blocked`. Cần owner chốt policy: có chấp nhận phát adjusted price khiếu sự kiện chưa parse được không? Nếu KHÔNG, hướng đúng là kiếm nguồn có số liệu (rights issue cần giá phát hành) — không phải sửa parser hay fail-closed.

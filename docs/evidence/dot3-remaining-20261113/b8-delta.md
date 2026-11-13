# B8 delta — re-audit 2 commit sau `ad9dc55ce` (2026-11-13)

> Branch `feat/dot3-remaining-20261113` vs `origin/dev` · Delta: `e6701a6f9` (code+test+evidence) + `914eaa898` (docs closeout) · Verdict: **PASS — merge được**.

- **M1 (code) — ĐÓNG**: diff `views.py` vs `origin/dev` có 8 guard `require_pat_scopes_or_human_session(request, 'market:read')` (8 import + 8 call) tại 7 method GET + 1 POST (`TrackedSymbolsView.post`); test thứ 9 `test_b6_marketdata_pat_without_scope_403` gọi đúng route `/core/v1/market-data/symbols/` → 403 + chứa `scope`. `middleware.py`/`models.py` 0 diff (claim `:1939` đã ghi chú trung thực).
- **M2 (evidence) — ĐÓNG**: `gates.md` tồn tại, khớp số B8 yêu cầu — fail-before 6đ/2x đúng lý do; pass-after 8/8 → 9/9 (`Ran 176 tests — OK`: 9 dot3 + 167 market_data); hồi quy 203 OK (`market_serving`+`market_data`); signal+advisory 77 + 1 error pre-existing (đối chứng trên dev cùng lỗi); sau 0008: 11/11 OK; `makemigrations --check` sạch; spectacular bằng baseline dev (124 warn/56 err, 0 financial).
- **m1 (quy trình) — ĐÓNG**: claim `:1939` đã `done` (ghi chú B8-M1 + 0-diff trung thực); `HANDOFF_2026-11-13_DOT3-REMAINING.md` tồn tại (27 dòng); Entry 479 tồn tại ở đầu ledger.
- **Lưu ý không chặn**: số 203 OK là gộp 2 app scope ảnh hưởng (không phải full suite); full BE/FE, D6, token 401, ruff vẫn CHƯA CHẠY — đã khai trung thực trong gates §5 + handoff §3 + Entry 479.

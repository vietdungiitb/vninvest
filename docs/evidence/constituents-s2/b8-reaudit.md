# B8 Re-audit S2 constituents (độc lập, chỉ đọc) — 2026-11-13

- Phạm vi: `git diff origin/dev...feat/constituents-s2 --stat` = 12 file do branch stacked trên S1 (chưa merge); delta S2 thật: `market_data/views.py`, `market_data/urls.py`, `tests/test_index_constituents.py` + `evidence/constituents-s2/gates.md` (untracked). Khớp claim `constituents-s2` (đã sửa đúng `views.py`, không còn `stock_mgmt_native_views.py`).
- Deny-list: không. Migration: không (`makemigrations --check` = `No changes detected` theo evidence, hợp lý vì 0 model mới).
- Guard `market:read` có (`views.py:528` `require_pat_scopes_or_human_session(request, 'market:read')`); code lạ 400 `INVALID_INDEX` (`views.py:544-549`, regex `_INDEX_CODE_RE` + allowlist); shape `{code,count,symbols,note}` đúng (`views.py:551-556`, serializer `views.py:504-508`).
- Không bịa symbols: dùng `fetch_symbol_group_members` thật (`vnbroker_adapter.py:840`), lọc rỗng + upper (`views.py:550`); `hnx30`/`custom_` chưa có trong adapter → trả `[]` + note trung thực, test rỗng khớp.
- Evidence `gates.md` khớp đếm được: 5 test trong file, fail-before 5×404, pass-after 5/5; `172 OK` và `spectacular clean` auditor CHƯA CHẠY lại được (chỉ đọc) — tin có điều kiện.
- Lưu ý nhỏ (không chặn): `gates.md:19` ghi "spectacular diff RỖNG" diễn đạt sai — thêm route phải đổi schema; ý đúng phải là "không warning/thiếu serializer".
- Claim `constituents-s2` = `in-progress` đúng branch `feat/constituents-s2` hiện tại; S1 flip `done` nằm chung diff do stacked, nên rebase sau khi S1 merge.

Verdict: **PASS** (gộp sau khi S1 merge; sửa chữ "diff RỖNG" ở evidence).

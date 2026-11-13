# B8 Re-audit slice S1 `ws-ticket-s1` — Verdict: PASS (merge được, kèm 2 việc close-out)
Ngày: 2026-11-14 · Branch `feat/ws-ticket-s1` (tip `62cc325dc`) vs `origin/dev` · Auditor độc lập, chỉ đọc (không chạy lại test).
1. Scope: diff 6 file — `identity_access/ws_ticket.py` (new, 62 dòng), `identity_access/views_ws_ticket.py` (new, 36 dòng), `identity_access/urls.py` (+4), `signal_intelligence/consumers.py` (−38/+13), `tests/test_ws_ticket.py` (new, 80 dòng), `CLAIMS.md` (flip proposed→in-progress). Không file deny-list.
2. Lệch nhỏ (close-out, không phải lỗi code): claim `CLAIMS.md:1941` liệt kê 4 file mà thiếu `ws_ticket.py` (module lõi của slice) → bổ sung 1 dòng trước merge.
3. Single-use thật: `ws_ticket.py:28-35` `cache.get` rồi `cache.delete` ngay; test phủ redeem lần 2 → None (`test_ws_ticket.py:43-50,54-58`). Race get+delete không atomic — rủi ro thấp với ticket 60s, chấp nhận.
4. Tương thích + secret: `ws_ticket.py:47-59` ưu tiên `?ticket=`, fallback `?token=` qua `resolve_from_raw_secret` + check ACTIVE; consumers chỉ log symbol/generic (`consumers.py:58,127`), không log token/ticket.
5. Response flat `{"ticket","expiresIn"}` (`views_ws_ticket.py:36`) đúng contract slice; ref widget `VNInvestClient.ts:813-826` là package npm ngoài nên không verify local (grep `packages/web` không thấy — phù hợp `AGENTS.md`: widget đã tách khỏi repo).
6. Evidence `gates.md` khớp số đếm được: đúng 8 test methods ↔ 8/8; 504 OK + spectacular `56/14 == dev` tin theo evidence (B8 không re-run). Lưu ý: cả `docs/evidence/ws-ticket-s1/` đang untracked → phải `git add` cùng PR.
Điều kiện merge: (a) commit evidence (`gates.md` + file này), (b) bổ sung `ws_ticket.py` vào claim `:1941`. Không cần sửa code.

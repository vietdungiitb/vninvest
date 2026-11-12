# HANDOFF — B-1 Enterprise demo (mount 2 route realtime) + đáp án Q-B1..Q-B4

> **Ngày:** 2026-11-12 · **Phạm vi:** backend `vninvest` — slice B-1 theo `docs/BACKEND_VNINVEST_ENTERPRISE_DEMO_SPEC_2026-11-12.md` §2 + trả lời §8 (Q-B1..Q-B4) cho đội backend + widget team
> **Nhánh:** `feat/enterprise-b1-routes` → `dev` (PR #357, merged `c0bf7c65d`) · closeout `feat/enterprise-b1-closeout` (file này)
> **Worktree:** `D:/Mujoco Projects/vninvest-wt-b1` (giữ lại để sửa bổ sung nếu backend hỏi lại)

## 1. Trạng thái

| Item | Trạng thái | Evidence |
|---|---|---|
| B-1 mount 2 route | **done** — merged PR #357 | merge `c0bf7c65d`, parents `ff0fd28ae` + `d61c8990b`; diff 7 file đúng scope |
| Q-B1..Q-B4 | **done** — đáp án trong repo | `docs/BACKEND_QA_ANSWERS_QB1_QB4_2026-11-12.md` (Q-B1 không có order book; Q-B2 CHƯA XÁC MINH + probe; Q-B3 không cash_flow/kỳ quarter; Q-B4 có tick thật) |
| Claim `enterprise-b1-routes` | **done** | `docs/CLAIMS.md` (1 dòng, đã chuyển `in-progress` → `done`) |
| Ledger | **Entry 466** appended | `docs/CODE_CHANGE_AUDIT_LEDGER.md:1` (`## Entry 466: B-1 ...`) |
| B-2..B-6 | **chưa bắt đầu** (ngoài slice) | timeline spec §7: tuần 1 B-1+B-5 · tuần 2 B-2+B-4 · tuần 3 B-3+B-6 |

## 2. Kết quả + evidence `file:line` (không suy diễn)

- **Route mới (đúng AC spec):** `packages/core/backend/src/market_serving/urls.py:41-42` — `realtime/unified-alerts/` → `RealtimeUnifiedAlertsView`, `realtime/whale-campaigns/<str:symbol>/` → `RealtimeWhaleCampaignsView`; prefix `/core/v1/` xác nhận ở `packages/core/backend/src/vninvest_core/urls.py:61`.
- **View fix (AC chính):** `packages/core/backend/src/market_serving/native_views.py:1406-1415` — campaigns ưu tiên `kwargs['symbol']` (mirror class cha `:944-950`); không có bước này thì URL có symbol bị bỏ qua. Gating `IsAuthenticated` kế thừa (`:543`), không bypass.
- **Test (fail-before → pass-after, chạy thật trên VPS):** `packages/core/backend/src/market_serving/tests/test_native_views.py:225-319` (`RealtimeCampaignRoutesTest`, 5 test) — fail-before 5 ĐỎ (`NoReverseMatch` + 404), sau code 12/12 OK; suite app `market_serving` 31/31 OK.
- **Gates chạy thật:** `manage.py check` no issues · `makemigrations --check` còn `commercial/0008_licensekey` (**pre-existing**, branch không đụng commercial ⇒ không tạo migration) · `check-multi-agent.mjs` 0 lỗi · `check-ledger-entry.mjs` **FAIL do trùng Entry 386 PRE-EXISTING trên `origin/dev`** (PR #353; Entry 466 của slice xuất hiện 1 lần) — ghi trung thực, không sửa baseline khi chưa có quyết định coordinator.
- **CHƯA CHẠY:** E2E staging ngoài (Rule 17 — phía widget team) · `spectacular` (không đổi serializer) · full BE suite · CI `secret-scan` (dev đỏ sẵn `facts20.json`, ngoài scope).
- **B8 (tự audit, PASS):** AC `code=invalid_query` **chưa đạt** (400 chỉ có `detail`, chưa có `code`) ⇒ để B-5, không đánh dấu sai.

## 3. Việc dở + câu hỏi mở (cho backend)

1. **Probe staging Q-B2** (chặn B-3): `curl -H "Authorization: Bearer $PAT" .../stock-management/stocks/VNM/overview/ | jq '.events[0:3]'` — có ex-date/ratio ⇒ làm `adj_close`; không ⇒ `adjusted:false` + `note`.
2. **Đo độ phủ tick Q-B4** (E4): `SELECT count(DISTINCT symbol), min/max(timestamp) FROM market_data_intraday_tick WHERE timestamp >= now() - interval '1 day'`.
3. **B-5 envelope `code`** cho cả 2 endpoint mới (400 hiện chỉ có `detail`).
4. **Baseline gate** `ledger-entry-baseline.json` cần coordinator chốt (trùng 386 đã merge vào dev ⇒ mọi push sau đều FAIL gate cho tới khi re-baseline).
5. **Ticket `staging-pro-layout`**: `secret-scan` đỏ do `docs/evidence/staging-pro-layout/facts20.json` chứa blob `vni_*` (pre-existing trên dev).

## 4. Next steps + owner

| Bước | Owner |
|---|---|
| Backend cắt ticket B-1+B-5 (tuần 1, cần probe §3.1 trước) → B-2+B-4 (tuần 2) → B-3+B-6 (tuần 3) | đội backend `vninvest` |
| Widget build E0–E5 song song; E0 không phụ thuộc 4 câu trả lời | widget team (`vninvestcharts-widget`) |
| Trả lời 4 câu hỏi còn mở (Q-B2 probe, Q-B4 đo phủ) | đội backend `vninvest` |
| Xoá worktree `vninvest-wt-b1` khi backend không còn hỏi bổ sung (không có `node_modules` junction ⇒ xoá an toàn) | agent phiên này/coordinator |

*Quy ước bằng chứng repo: mọi khẳng định kèm `file:line`; CHƯA XÁC MINH thì ghi rõ, không suy diễn.*

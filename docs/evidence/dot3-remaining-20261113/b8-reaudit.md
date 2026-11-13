# Re-audit B8 — slice `dot3-remaining-20261113` (pre-merge, read-only)

> Ngày: 2026-11-13 · Auditor độc lập (subagent, chỉ đọc) · Branch `feat/dot3-remaining-20261113` (tip `ad9dcce`) vs `origin/dev` · Verdict: **NEED_REVISION** (2 M / 1 m)

## 1. Diff stat — ĐÚNG scope, sạch deny-list
12 file: 7 BE + 1 test + 1 migration + plan/audit/b4-verdict/CLAIMS. Không deny-list. Untracked session khác (`PLAN_A4*`, `PLAN_WIDGET*`, `WIDGET_EMBEDDING*`, `evidence/a4-roadmap/`, `facts32.json`, `21-fullbleed-test.png`) vẫn untracked, không lọt diff.

## 2. Code đã đọc — guard đúng pattern, migration đúng
Guard `require_pat_scopes_or_human_session` đúng scope từng app (`market:read`/`signals:read`/`ai:invoke`, `permissions.py:39`); schema đóng sau `if DEBUG` (`urls.py:83-88`); B-4 typed 5 key + cache theo period + 400 `INVALID_PERIOD`/`FINANCIALS_YEAR_UNAVAILABLE`; không logic lạ. Migration `0008_licensekey.py`: deps `0007` + `identity_access 9000` + AUTH_USER_MODEL, 1 CreateModel, file `0008_*` duy nhất — khớp AC-License.

## 3. Objection M1 (code) — `market_data/views.py` hứa nhưng 0 dòng đổi
Plan §2 + claim đều liệt kê file này (B-6 scope), nhưng diff = 0, grep guard = 0. 7 endpoint LIVE qua `core_urls.py:44` (`shared_urlpatterns`: `market-data/symbols/`, `daily-prices`, `intraday-prices`, `intraday-tape`…, chỉ `IsAuthenticated`) → PAT `scopes=[]` vẫn đọc được, AC-B6 "market data → 403" chưa đủ; test mới cũng không có case nào cho các route này. Yêu cầu: thêm guard `market:read` + 1 test, hoặc gỡ route/khẳng định defer có bằng chứng.

## 4. Objection M2 (evidence) — số liệu VPS CHƯA XÁC MINH từ repo
`evidence/` chỉ có `audit.md` + `b4-verdict.md`; toàn bộ số executor báo (fail-before 6đ/2x, pass-after 8/8, hồi quy 203, signal+advisory 77+1 pre-existing, seed 11/11, `makemigrations --check`, spectacular 124/56) không có file log nào trong repo → ghi `CHƯA XÁC MINH`, không được merge với nhãn PASS. Yêu cầu: commit 1 file evidence (log excerpt VPS) trước merge.

## 5. Minor m1 — claim khai thừa 5 file, thiếu DoD
Claim `:1939` liệt kê `market_data/views.py`, `middleware.py`, `commercial/models.py`, handoff, ledger Entry 479 — cả 5 đều 0 diff (chưa commit). Sửa claim + commit handoff/ledger trước merge.

## 6. Claim/branch — sạch
Claim `:1939` in-progress đúng branch; `vet-finish :1879` released tại `:1935`, `chart-widget-team :40` tại `:1936`; `:1884` còn in-progress nhưng doc-only, không trùng file. Không xung đột.

## Verdict: NEED_REVISION — sửa M1 (+test), commit evidence VPS (M2) + handoff/ledger/sửa claim (m1), rồi re-audit nhanh trước merge. Câu hỏi follow-up (không chặn): các view `StockManagement*` còn lại (Groups/Seed/Sync/PriceAlerts/OrderFlow…) cũng chưa guard — xác nhận trong hay ngoài scope B-6?

# HANDOFF — Dot3 remaining BE (S2.2 B-4 + S3.2 B-6 + license 0008) — DONE, chờ PR merge

> Ngày: 2026-11-13 · Branch: `feat/dot3-remaining-20261113` → `dev` · Claim: `dot3-remaining-20261113` done
> Base: `origin/dev` @ `02a8891ce` (PR #375 dot2 đã merge) · Ledger: Entry 479 (next 480)

## 1. Đã làm (BE-only, 0 file FE, 0 deny-list)

- **P1 S2.2 B-4** (`vnbroker_adapter.py`, `stock_mgmt_native_views.py`): `fetch_company_financials(..., period)`; record 5 key (`period,year,quarter,report_date,items`); số là number/thiếu là null; `cash_flow: null`; `?period=quarter|year`, sai → 400 `INVALID_PERIOD`, year rỗng → 400 `FINANCIALS_YEAR_UNAVAILABLE`; serializer `$ref` (không `{}`).
- **P2 S3.2 B-6**: guard `require_pat_scopes_or_human_session` — 12 `market_serving` (`market:read`), 16 `market_data` (8 stock_mgmt + 8 `views.py`, `market:read`), 8 `signal_intelligence` (`signals:read`), 2 `advisory` (`ai:invoke`); schema mount chỉ khi `DEBUG` (`urls.py`, không DEBUG → 404).
- **P3 license**: `commercial/migrations/0008_licensekey.py` do `makemigrations` sinh trên VPS (deps `0007`, 1 CreateModel) — đồng thời sửa luôn lỗi pre-existing `test_delete_cleans_up` (`commercial_licensekey` missing).
- **Boundary B-6 (trung thực)**: ack/mute/detail POST user-scoped + `StockManagement*` quản trị (Seed/Sync/Groups/Tracked/Alerts/AdvisoryComp) giữ nguyên — follow-up nếu Owner muốn siết tiếp.

## 2. Gates (bằng chứng: `docs/evidence/dot3-remaining-20261113/gates.md`)

- Fail-before VPS: 6 đỏ/2 xanh đúng lý do · Pass-after: 9/9 OK · Hồi quy: market_serving+market_data 203 OK, signal+advisory 77 với 1 error pre-existing (chứng minh trên dev), sau 0008: 11/11 OK · `makemigrations --check` sạch · spectacular bằng baseline dev (124 warn/56 err, 0 financial) · local: multi-agent 0, ledger PASS, lessons PASS, eol OK, secrets OK.

## 3. CHƯA CHẠY / defer (không chặn merge)

S4.x (C2/C3/E2E/visual) · timeframe chart unification (defer, cần widget sign-off) · merge mù branch stale → đã verify-equivalence ở dot2 · deploy staging D6 · verify token 401 · full BE/FE suite · ruff (thay bằng `manage.py check` sạch trên VPS).

## 4. Rủi ro duy nhất (Owner chấp nhận)

D2-final: consumer ngoài đọc TRỰC TIẾP raw API (không qua adapter/FE `Number()`) sẽ thấy `price` number thay vì string. Trong repo: FE đã `Number()`-hóa, adapter normalize — không vỡ.

## 5. Việc tiếp theo

PR merge-commit → `agent-cleanup.ps1` → VPS đã dọn (`/tmp/wt-dot3-fail`, `/tmp/wt-dot3-fix`, DB `dot3_fail`/`dot3_fix` DROP + prune).

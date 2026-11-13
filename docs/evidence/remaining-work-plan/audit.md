# Evidence — Audit độc lập kế hoạch `PLAN_REMAINING_WORK_20261113.md` (rev 1 → rev 2)

> **Ngày:** 2026-11-13 · **Auditor:** subagent read-only (session `ses_e2d0e5cc9ffePEKPsMSlPpSrBP`)
> **Đối tượng:** `docs/PLAN_REMAINING_WORK_20261113.md` trên worktree `vninvest-wt-plan` @ `55a6a8741`
> **Nguồn sự thật:** `docs/CLAIMS.md`, `git grep`, `git show b3920f980`, baseline gates chạy thật.
> **Kết quả:** `VERDICT: NEED_REVISION` → sau khi sửa 6 điểm, plan rev 2 sẵn sàng thực thi (vẫn chờ Owner chốt D1–D8).

## VERDICT (nguyên văn auditor)

`NEED_REVISION` — nhiều claim `file:line` chính xác; 3 blocker factual + 3 major.

## BLOCKERS (đã sửa trong rev 2)

| # | Plan claim | Thực tế | Evidence | Cách sửa |
|---|---|---|---|---|
| B1 | §S0.4: "đã kiểm: hiện không có claim `in-progress` nào giữ file này" (`vnstock-chart-panel.data-unlock.component.test.ts`) | `CLAIMS.md:1815` claim `w0-9-chart-data-unlock` **in-progress** (worktree `agent-w0-9`) liệt kê đúng file đó; `CLAIMS.md:1821` bản **done** (PR #282) | `CLAIMS.md:1814-1821` | Thêm "Lưu ý" §S0.4: coordinator phải release claim stale trước khi sửa |
| B2 | §S5.1: "13 claim in-progress stale" | `audit-status-claims.mjs` → **17 open** (15 in-progress + 2 proposed); MASTER_TRACKING A2 chỉ ghi đóng 8 | `audit-status-claims` output, `MASTER_TRACKING.md:169` | Đổi "13" → "17 open theo tool, ~13 stale, chốt danh sách trước khi làm" |
| B3 | §S0.1 AC: `git grep -l "vni_internal_"` phải = 0 file | Plan prose chứa `vni_internal_` ở nhiều dòng ⇒ grep luôn ≥1 | `PLAN:15,86,89,90,297` | Sửa AC: điều kiện là `scan-secrets` exit 0 + 0 file runtime/evidence chứa token thật |

## MAJOR (đã sửa trong rev 2)

| # | Plan claim | Thực tế | Evidence | Cách sửa |
|---|---|---|---|---|
| M1 | §S1.2 probe: `from market_data.vnbroker_adapter import fetch_company_profile` | Function thực là `fetch_company_info` (`vnbroker_adapter.py:1138`), gọi `company.events()` ở `:1188` | `vnbroker_adapter.py:1138,1186-1197` | Sửa import + tên hàm trong probe command |
| M2 | §1 baseline: "2 warning file claim mới chưa tồn tại" | Chạy thật: **165 warning** | `check-multi-agent.mjs` output | Sửa "2" → "165 warning (phần lớn claim cũ parse multi-file path như 1 path)" |
| M3 | §S0.3: không nhắc claim giữ file `AIUsageDashboard.component.test.js` | `CLAIMS.md:1165` claim `uiux-w11-alerturl` trạng thái **abandoned** liệt kê file đó | `CLAIMS.md:1165` | Thêm "Lưu ý" §S0.3: coordinator xác nhận trước khi sửa |

## MINOR (đã verify đúng — không sửa)

- Token evidence: `facts20.json:7-10`, len=77, sha256 `ec8f9b90` — khớp plan.
- Ledger Entry 386 trùng 2 lần (dòng 969 & 1036) — khớp.
- Gates baseline: `check-ledger-entry` FAIL, `scan-secrets` FAIL, `check-lessons` PASS — khớp.
- D2 regression: `AIUsageDashboard.tsx:11` → `RechartsCompat.tsx:46,58` (CanvasRenderer), `vitest.config.ts:13` `setupFiles: []` — khớp; `git show b3920f980 --stat` xác nhận đổi import từ `recharts` sang shim.
- B-2: `native_views.py:451,453,522,524` `is_mock`/`synthetic_from_snapshot` — khớp.
- B-5: `native_views.py:69,128,267,376` `str(price)`; `/chart/` `_normalize_timeframe` `:902-920` nhận `30m`/`Y`; `/bars/` `INVALID_TIMEFRAME` `:4148-4168`, `_OHLCV_VALID_TIMEFRAMES` `:3887` — khớp.
- B-4: `vnbroker_adapter.py:1226,1239,1252` hardcode `period='quarter'`; schema `stock_mgmt_native_views.py:311-319` `financials` object nullable — khớp.
- B-6: 0 `require_pat_scopes` trong 4 app; scope catalog `serializers.py:20-27`; schema public `urls.py:56-58`; middleware exempt `:41-43`/`:333`; X-RateLimit `:579-612`; admin-ops 410 `:39-44,79`; SSE ping 15s `views.py:778`; nginx `/api/` 300s `:289`, `/core/v1/` 120s `:303` — khớp.
- `adj_close|corporate_action|adj_factor` = 0 hit backend — khớp.
- `invalid_query` = 0 hit — khớp.
- `StockOrderBookWidget.jsx:153-161` badge "Dữ liệu ước tính" — khớp.
- Worktree `vninvest-wt-b1` detached `4e86657e4` — khớp.
- Test count: 6 it trong `AIUsageDashboard.component.test.js` + 1 trong `ai-usage-chart-r16` = 7 đỏ; S4 tại `vnstock-chart-panel...test.ts:53-55` — khớp.
- `__mocks__/RechartsCompat.tsx` export đủ symbol (ResponsiveContainer, BarChart, AreaChart, LineChart, PieChart, Bar, Area, Line, Pie, Cell, XAxis, YAxis, Tooltip, CartesianGrid, Legend, Brush) — mock usable cho S0.3.
- `AIUsageDashboard.tsx:380` `data-testid="usage-chart"` nằm ngoài chart (aria-hidden trên wrapper) ⇒ AC3 không bị vô hiệu.

## KHÔNG XÁC MINH ĐƯỢC (máy local thiếu runtime)

- `zrender/lib/canvas/Layer.js:82` dpr error — zrender không cài local; claim lấy từ log VPS 2026-11-13 (không tái tạo được ở đây). Không blocker.
- `check-lessons.mjs` PASS — đã chạy, OK.
- BE test (Postgres) — không có DB local; theo runbook §12.3 chỉ chạy VPS.

## Khuyến nghị trước khi thực thi (auditor)

1. Sửa S0.4: xử lý claim `w0-9-chart-data-unlock` (in-progress) trước khi đụng test file; hoặc đổi phạm vi.
2. S5.1: đổi "13" → theo `audit-status-claims` (17 open) hoặc danh sách stale cụ thể do Owner chốt.
3. S0.1: sửa AC git grep thành điều kiện thực thi được.
4. S1.2: sửa import `fetch_company_info` trong probe command.
5. Cập nhật chi tiết warning check-multi-agent (165, không phải 2).

## Kết luận

Plan rev 2 (sau 6 sửa trên) đạt mức audit: mọi claim `file:line` còn lại đã verify đúng; AC đo được; thứ tự phụ thuộc hợp lý (S1.2 chặn S3.1, S0.5 sau S0.3/S0.4). **Chờ Owner chốt D1–D8 trước khi mở slice code.**

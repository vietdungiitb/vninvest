# RE-AUDIT B8 — Đối chiếu 6 P0 UI/UX `/dashboard` với code thật sau fix

> **Ngày:** 2026-11-18 · **Auditor:** subagent độc lập, CHỈ ĐỌC (không sửa code runtime).
> **Revision:** branch `feat/dash-p0-uiux`, HEAD `96eee27655d21e70956e299e2645d458fbc6f257` (commit `fix(dashboard): close 6 P0 UI/UX defects on /dashboard`).
> **Base đối chiếu:** `dev @ 577ddf64650066225f1317a659f20e851721ce08`.
> **Tài liệu đối chiếu:** `docs/PLAN_DASHBOARD_P0_20261118.md` (AC S1–S6) · `docs/evidence/dashboard-uiux/AUDIT_20261118.md` · `docs/evidence/dashboard-uiux/AUDIT_PLAN_B3.md` (3 round + B4 consensus).
> **Nguyên tắc:** mọi khẳng định kèm `file:line` tự mở bằng read/grep; luminance tự tính bằng Node độc lập, KHÔNG tin assertion của test; không tin báo cáo/commit message khi chưa tự kiểm.

---

## 0. Verdict

**AGREE**

6/6 P0 đã đóng thật trong code, AC tương ứng có bằng chứng `file:line` và test đi kèm. Không có blocker hay major ở mức code. Có **1 major ở mức evidence/quy trình** (plan hứa `docs/evidence/dashboard-uiux/gates.md` nhưng file không tồn tại — kết quả gate chỉ nằm trong commit message) và **4 minor** (gate i18n yếu/không phủ file đổi, `limit` bị BE bỏ qua, citation `file:line` bị lệch dòng do thêm comment, AC1.4 không có test riêng). Các minor này không làm sai kết luận đóng P0.

Lessons áp dụng: `[L-V01, L-V02, L-V04, L-T02, L-T01]` — đã chạy control tự tính luminance (L-V01), tự mở đúng file thay vì tin citation (L-T02), không tin gate "xanh" của script không phủ file đổi (L-V04).

---

## 1. Kết quả verify từng slice

### S1 — Header search + autocomplete — **ĐÓNG ĐÚNG**

| Kiểm tra | Bằng chứng | Kết luận |
|---|---|---|
| Enter/chọn gợi ý navigate object `{pathname, search:''}` | `Header.tsx:129-139` — `navigate({ pathname: `/stocks/${sym}`, search: '' })` tại `:135` | ĐÚNG |
| KHÔNG gọi `setSearchVal('')` sau navigate | `Header.tsx:135-139` — sau navigate chỉ có `setSuggestions([])`, `setActiveIdx(-1)`, `setShowSuggestions(false)` (local state). Grep toàn file: `setSearchVal` chỉ xuất hiện tại `:81` (khai) và `:279` (`onChange`) | ĐÚNG |
| Dropdown `role=listbox` / `role=option` | `Header.tsx:288` (`role: 'listbox'`), `:293` (`role: 'option'`, `aria-selected`) | ĐÚNG |
| ArrowDown / Enter / Escape (+ArrowUp) | `Header.tsx:142-159` — ArrowDown `:142`, ArrowUp `:147`, Escape `:152`, Enter `:156` chọn `suggestions[activeIdx]?.symbol` khi highlight, else text thô | ĐÚNG |
| Mock test có `getSymbolList` | `Header.component.test.tsx:35` (hoisted `h.getSymbolList`), `:42` (factory mock), `:107-108` (mockReset + mockResolvedValue), `:195` (`mockResolvedValueOnce`); `LocationProbe` `:68-70`, `currentPath()` `:72-74` | ĐÚNG |
| Response shape / guard | `Header.tsx:109-115` — đọc `payload?.results`, `Array.isArray` guard, map `symbol ?? code`, `name ?? company_name`, `.filter(s => s.symbol)` | ĐÚNG (khớp `market.js:187` `{results,next}`) |
| Debounce cleanup | `Header.tsx:99-126` — flag `active` + `clearTimeout(timer)` trong cleanup; guard `q.length < 2` `:93-98`; catch lỗi `:120-124` | ĐÚNG, không có stale-response race |
| Adapter method tồn tại | `coreApiAdapter.js:63` tạo `marketClient`, `:136` spread `...marketClient`, `:171` export; `market.js:189` `getSymbolList` | ĐÚNG, không crash runtime |

**Rủi ro regression đã kiểm:** cơ chế `search:''` xoá `?q=` đúng (đã audit ở B3 Round 1); cleanup debounce đúng; API lỗi được catch (AC1.4) — **nhưng AC1.4 không có test riêng** (xem Minor M4). Backend `views.py:52` nhận `q` (search/company_name icontains), `:56-57`; frontend gửi thêm `limit:20` nhưng BE **không đọc `limit`** (paginator `page_size=100` tại ` views.py:31`) — response vẫn `{results,next}` nên không gãy, chỉ không giới hạn 20 server-side (Minor M3).

### S2 — Heatmap color scale — **ĐÓNG ĐÚNG**

- `HEAT_STOPS` 5 màu mới: `PortfolioHeatmap.js:27-33` = `#991b1b / #b91c1c / #eab308 / #15803d / #166534` — khớp Owner Q1 (`plan:11`).
- `NO_DATA_COLOR = '#1e293b'`: `PortfolioHeatmap.js:35`; dùng tại `:244` (`bg = noData ? NO_DATA_COLOR : heatColorContinuous(...)`), label `:256-257`, border `:253-254` — tách khỏi `0%`.
- `heatmapLegendGradient()`: `PortfolioHeatmap.js:38-40`, sinh chuỗi từ `HEAT_STOPS.map(...)`. Inline style gọi helper: `PortfolioHeatmap.js:642` (`style: { background: heatmapLegendGradient() }`). **Lưu ý citation**: plan/AC2.4 ghi `:609`, nhưng `:609` hiện là `onClick` của nút groupTiny (số dòng dời do thêm comment) — substance đúng, chỉ sai số dòng (Minor M2).
- `index.css`: gradient hardcode cũ đã bị xoá, `index.css:757-763` chỉ còn comment giải thích. Grep `linear-gradient` trong `index.css` chỉ trúng `:636` (mask-image, không liên quan).
- 3 key i18n có `≤/≥` ở cả 2 locale: `vi/heatmap.js:13-15` và `en/heatmap.js:13-15` = `≤ -7% / 0% / ≥ +7%`; `sizeFallbackCap` `vi:7` / `en:7`.
- **Độ sáng tự tính (không tin test)** — Node, công thức WCAG y chính `lum()` tại `PortfolioHeatmap.js:69-76`:

| Stop | Luminance |
|---|---|
| `#991b1b` (-7) | 0.0764 |
| `#b91c1c` (-3) | 0.1123 |
| `#eab308` (0) | 0.4975 |
| `#15803d` (+3) | 0.1593 |
| `#166534` (+7) | 0.0973 |

→ `-7 < -3 < 0` **true**; `0 > +3 > +7` **true**. `lum('#eab308')=0.4975 > 0.35` ⇒ `textOnHeat('#eab308') === '#0b0f17'` (AC2.1) đúng. AC2.1–AC2.5 thỏa.

### S3 — Alert metric `%` vs `₫` — **ĐÓNG ĐÚNG**

- Helper `formatAlertMetric` tại `alertCenterFormat.ts:125-155`:
  - family detect `:129-131` (`price_shock` hoặc field khác) + `:138` (`Number.isFinite(price_change_pct)`).
  - map buy/sell: `:146-149` — `sell/down/short` ⇒ âm, `buy/up/long` ⇒ dương; số dương metadata được ưu tiên `:144`.
  - price_shock: `:152-154` → `−/+NN.NN%`, **không nối currency**; non-priceShock: `:140-142` trả `formatters.compact/full` (đã tự nối `₫` ở `formatMarket.js`).
- `UnifiedAlertCenter.js:11` import helper; `alertValueNode` `:40-47` gọi `formatAlertMetric(..., {compact: formatVNDCompact, full: formatFullVND})` tại `:42`, render `metric.text` `:46` — **không cộng `' VND'`**. Double currency: **không có**.
- `AlertCard.tsx:223-231` — nhánh price_shock `:227-229` dùng `formatAlertMetric(..., {compact: formatVnd, full: formatVnd}).text` ⇒ `%`, không `₫`/`VND`. Nhánh whale `:230` = `${formatAlertValue(...)} ${t('alertCenter.currency')}`; `formatAlertValue` = `formatVnd` (`AlertCenterPage.tsx:77-79`, không nối `₫`) ⇒ `1.500.000.000 VND`, **không** `₫ VND`. AC3.1–3.3 thỏa.
- Test: `alert-format.component.test.ts:9-41` (3 case, assert `not.toMatch(/₫|VND/)`, whale `toContain('₫')` + `not.toContain('VND')`).

### S4 — SmartStatsHeader CTA — **ĐÓNG ĐÚNG**

- `SmartStatsHeader.js:2` import `useNavigate`; `:30` khởi tạo; CTA 1 `navigate('/portfolios/manage')` `:173`; CTA 2 `navigate('/broker')` `:181`.
- `onRefresh` chỉ còn ở `:241` (nút Refresh) — grep xác nhận 2 CTA không gọi. AC4.1–4.3 thỏa. Test `smart-stats-cta.component.test.tsx:33-60` assert navigate + `onRefresh.not.toHaveBeenCalled()`.

### S5 — marketCap fallback sizing — **ĐÓNG ĐÚNG**

- `resolveTileSize` `PortfolioHeatmap.js:96-115` — nhánh `weight` + không holdings ⇒ `:114` `sizeValue = marketCap > 0 ? marketCap : 1`, `capFallback: true`; mode `marketCap` `:105-107`; có vị thế `:108-113` giữ marketValue/avg.
- Flag dùng tại `:232-240`, gắn vào data `:258`; subtitle notice `:271-273` + render `:519-522` nối `t('heatmap.sizeFallbackCap')`.
- Key 2 locale: `vi/heatmap.js:7` / `en/heatmap.js:7`. AC5.1–5.3 thỏa. Test `heatmap-sizing.component.test.ts:4-46` (3 case, assert `not.toBe(100_000*100)`, fallback `1`, giữ marketValue khi có vị thế).

### S6 — first-symbol split — **ĐÓNG ĐÚNG**

- `DashboardPage.tsx:320` — `collectUniqueSortedSymbols(holdings, trackedSymbols, watchlists, []).split('|')[0]`. (Plan/AC6 ghi `:319`; dòng `:319` hiện là comment giải thích — lệch 1 dòng, Minor M2.)
- Helper contract **không đổi**: `dashboardSymbols.js:18` vẫn `join("|")`. 2 call-site sản xuất khác vẫn dùng chuỗi: `DashboardPage.tsx:202`, `:298`. 4 assertion `dashboard_lifecycle.test.js:41-54` nguyên vẹn. Test mới `dashboard-first-symbol.component.test.ts:8-20` assert token `"ACB|FPT"`, `split('|')[0] === 'ACB'`, `token[0] === 'A'` + source regex. AC6.1 thỏa.

---

## 2. Gate evidence — tự kiểm được gì

| Gate (commit báo) | Tự kiểm của B8 | Kết luận |
|---|---|---|
| `tsc 0` | Chạy `.\node_modules\.bin\tsc --noEmit` trong `packages/web` ⇒ `TSC_EXIT=0` | **XÁC NHẬN** |
| `lint 0 errors` | Chạy eslint trên 7 file đổi ⇒ `✖ 56 problems (0 errors, 56 warnings)`, `ESLINT_EXIT=0` | **XÁC NHẬN** (warnings chủ yếu `react/jsx-no-literals`/`no-unused-vars` pre-existing) |
| `tokens PASS` | Chạy `node ./scripts/check-tokens.mjs` ⇒ `✓ check:tokens — PASS (79 allowlisted hex, 0 violations)`, exit 0 | **XÁC NHẬN** |
| `i18n scan 0` | Không tự chạy (`i18n:scan:strict` chỉ bắt TS `as` trong options — `scripts/i18n-scan-strict.mjs:15-25`). Tự mở file: key mới có ở cả 2 locale (`vi/en/heatmap.js`) | **CHƯA CHẠY** (thay bằng verify thủ công, đạt) |
| `i18n-hardcoded 0` | Script `check:i18n-hardcoded` (`package.json:33`) chỉ quét `advisory/WhaleBubbleChart/FactsFirstWhaleBubbleChart/WhaleAnalyticsTab/WhaleAdvisoryPage` — **không phủ file nào trong 6 P0** | **CHƯA CHẠY / không phải evidence cho slice này** (xem Minor M1) |
| `TDD 16 RED before` | Không checkout base để replay ⇒ **CHƯA CHẠY** | Commit message tự báo; B8 không xác minh |
| `35 GREEN after` | Đếm `\bit\(` trên 6 file test đổi/mới: 7+17+3+3+3+2 = **35** — khớp con số commit | **NHẤT QUÁN** (không phải kết quả thực thi) |
| `full FE suite + build + visual VPS + pre-push gate` | Không chạy | **CHƯA CHẠY** — commit message cũng ghi `CHUA CHAY`, nhất quán |

Sau 3 lệnh chạy: `git status --short` ⇒ rỗng (không artifact sinh ra, tuân L-V03).

**Evidence file:** thư mục `docs/evidence/dashboard-uiux/` hiện chỉ có `AUDIT_20261118.md` + `AUDIT_PLAN_B3.md`. Plan `§5:117` hứa ghi baseline exit-code vào `gates.md` — **file KHÔNG TỒN TẠI** (xem Major M0). AUDIT + PLAN có đủ (3 round audit plan + consensus B4).

---

## 3. Findings

### Blocker
*Không có.*

### Major

**M0 — Thiếu `docs/evidence/dashboard-uiux/gates.md`; kết quả gate chỉ nằm trong commit message.**
- Bằng chứng: `docs/PLAN_DASHBOARD_P0_20261118.md:117` — *"Baseline exit-code hiện tại: CHƯA ĐO (sẽ ghi vào `docs/evidence/dashboard-uiux/gates.md`)"*; glob thư mục chỉ trả 2 file audit/plan, không có `gates.md`.
- Tác động: vi phạm `documentation-evidence-rule` (kết luận quan trọng chỉ ở chat/commit ⇒ không phải project evidence). Không ai tái tạo được lệnh + exit-code của 5 gate đã báo. B8 tự chạy được 3 gate (xem §2) nhưng đó là bằng chứng của auditor, không thay thế evidence file của implementer.
- Đề xuất: coordinator/implementer tạo `gates.md` với bảng `lệnh | exit code | output tóm tắt | thời điểm | revision`, ghi rõ `CHƯA CHẠY` cho 4 gate chưa chạy. **Ưu tiên: cao.** Không yêu cầu sửa code.

### Minor

**M1 — Hai gate i18n được báo nhưng không phủ file của slice.**
- `package.json:33` `check:i18n-hardcoded` quét 5 path `advisory/Whale*`, không đụng `Header.tsx`, `PortfolioHeatmap.js`, `SmartStatsHeader.js`, `UnifiedAlertCenter.js`, `AlertCard.tsx`, `DashboardPage.tsx`. `scripts/i18n-scan-strict.mjs:15-25` tự thừa nhận chỉ bắt 1 case (TS `as` trong options).
- Tác động: "i18n scan 0 / i18n-hardcoded 0" không chứng minh được 6 P0 không có hardcoded string. B8 đã tự mở key 2 locale ⇒ nội dung đúng, nhưng gate thì yếu. Đề xuất: ghi rõ giới hạn gate trong `gates.md`, đừng dùng con số đó làm bằng chứng AC.

**M2 — Citation `file:line` trong plan/audit bị lệch dòng do thêm comment.**
- `plan:61,66` và `audit:90` ghi legend inline tại `PortfolioHeatmap.js:609` → thực tế `:642`; `plan:47,94` / task ghi `DashboardPage.tsx:319` → thực tế `:320` (dòng `:319` là comment). 
- Tác động: người sau tra cứu theo citation thấy đúng dòng nhưng sai nội dung (L-T02) — ở đây không đổi kết luận vì substance đã đúng. Đề xuất: cập nhật lại số dòng trong evidence doc khi chốt, hoặc ghi kèm tên helper/`split('|')` để không phụ thuộc số dòng.

**M3 — `limit: 20` gửi tới BE nhưng BE bỏ qua.**
- `Header.tsx:106` gọi `getSymbolList({ q, limit: SUGGEST_LIMIT })`; `market.js:189-193` dựng query; BE `market_data/views.py:52` đọc `q` (đúng) nhưng paginator `page_size = 100` tại `:29-31`, không có tham số `limit`.
- Tác động: dropdown có thể nhận tới 100 kết quả thay vì 20 (UI có `max-h-64 overflow-auto` nên không vỡ). Không gãy AC. Đề xuất: đổi sang `page_size: 20` nếu muốn đúng ý đồ, hoặc bỏ `limit` khỏi comment.

**M4 — AC1.4 (API lỗi) không có test riêng.**
- Code xử lý đúng `Header.tsx:120-124` (`catch` ⇒ `setSuggestions([])`, `setShowSuggestions(false)`), nhưng `Header.component.test.tsx:101-205` không có case mock `getSymbolList.mockRejectedValue(...)`.
- Tác động: nhánh fail-closed chỉ được verify bằng đọc code, không bằng test. Đề xuất: thêm 1 test `mockRejectedValue` + assert dropdown ẩn, input vẫn gõ được (không chặn P0).

---

## 4. Kết luận & next steps

- 6 P0 **đã đóng thật**; chất lượng fix cao: dùng adapter có sẵn, SSOT gradient, helper thuần dễ test, debounce có cleanup, sign mapping rõ, không double currency, giữ contract helper S6. Không có regression code.
- **AGREE** với việc merge/đóng P0. Điều kiện đi kèm (không chặn code): bổ sung `gates.md` (M0) trước khi coi hồ sơ evidence hoàn chỉnh.
- **CHƯA CHẠY** (phải báo đúng, không suy diễn): full `test:components`, `build`, visual QA trên VPS staging `14.225.255.47`, pre-push gate, replay fail-before. Theo runbook chỉ chạy FE test/build trên staging.
- **Owner:** coordinator `feat/dash-p0-uiux` — đóng M0; M1–M4 có thể đưa vào wave P1/backlog.
- Ledger `docs/CODE_CHANGE_AUDIT_LEDGER.md`: B8 là auditor chỉ đọc, không tự append để tránh đụng entry của coordinator — đề coordinator ghi 1 Entry cho kết luận re-audit này theo quy ước repo.

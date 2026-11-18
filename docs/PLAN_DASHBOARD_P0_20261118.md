# PLAN — Dashboard UI/UX P0 Remediation (2026-11-18)

> **Trạng thái:** PLAN (B2) — chưa code. Branch `feat/dash-p0-uiux`, base `dev @ 577ddf64650066225f1317a659f20e851721ce08`.
> **Nguồn audit:** `docs/evidence/dashboard-uiux/AUDIT_20261118.md` (đã nhập từ artifact ngoài repo để tuân quy tắc documentation-evidence).
> **Phạm vi:** 6 P0 + test liên quan. P1/P2 để wave sau (xem Non-goals).

## 0. Quyết định Owner (chốt 2026-11-18)

| # | Quyết định | Giá trị đã chốt |
|---|---|---|
| Q1 | Dải màu & biên độ Heatmap | **Giữ kẹp ±7% (HOSE)**; `0%` = vàng `#eab308`; dải liên tục 5 mốc Đỏ→Vàng→Xanh; tách màu `noData` riêng; legend ghi rõ `≤ -7% … 0% … ≥ +7%`. KHÔNG thêm Tím/Xanh lơ trần/sàn. |
| Q2 | Sizing chế độ `"Tỷ trọng"` khi chưa có danh mục | **Fallback vốn hóa (`marketCap`)**, kèm thông báo nhỏ trên subtitle. Không dùng equal-weight. |
| Q3 | Ô tìm kiếm Header | **Sửa bug Enter + bổ sung dropdown gợi ý** (mã/tên công ty) → chọn mở `/stocks/:symbol`; cập nhật test kiểm tra `pathname`. |
| Q4 | Click ô Heatmap | **Kích hoạt popover xem nhanh** (sparkline 24h). Tuy nhiên nằm ngoài scope P0-1..P0-6 ⇒ ghi nhận quyết định, thực hiện ở wave P2 (xem Non-goals). |
| Q5 | Phạm vi thực thi | **P0 trước** — 1 PR, 6 P0 + test. |

## 1. Lessons áp dụng

`Lessons áp dụng: [L-001, L-002, L-003, L-008, L-M02, L-A01, L-F09, L-F10, L-V01, L-V02, L-V03, L-V04, L-F03, L-F08]`

Files đã đọc: `docs/LESSONS/multi-agent.md`, `docs/LESSONS/frontend.md`, `docs/LESSONS/verification.md`, `.opencode/skills/soc-uiux/SKILL.md`.

MANDATORY CHECKLIST (tick trước khi coi slice xong):
- [x] `git status --short` sạch trước khi tạo branch; đọc `docs/CLAIMS.md` — không có agent `in-progress` nào giữ 6 file đích.
- [ ] Claim append + commit riêng **trước dòng code đầu tiên** (L-002); branch tên đúng `feat/dash-p0-uiux` = agent `dash-p0-uiux` (L-M02).
- [ ] Không đụng shared/deny-list (`AGENTS.md`, `package.json`, `docker-compose*`, `.env*`), không migration, không `npm install` (L-001).
- [ ] TDD fail-before: test mới phải ĐỎ trên code cũ trước khi sửa (L-V04).
- [ ] S1 dùng `coreApiAdapter` **có sẵn** (`Header.tsx:14`) + mở rộng mock tại `Header.component.test.tsx:40-42` — KHÔNG import adapter mới (sẽ gãy export mock).
- [ ] S6 trước khi đổi helper: grep verify 3 call-site (`DashboardPage.tsx:202,298,319`) + 4 assertion `dashboard_lifecycle.test.js:41-54`; giữ contract chuỗi, chỉ `.split('|')[0]` tại call-site.
- [ ] L-F09: trong 1 tick không gọi 2 setter URL; handler gộp thành 1 `navigate()` duy nhất.
- [ ] L-F10: mọi object option của hook (debounce/autocomplete) khai ở cấp module.
- [ ] L-V02: mọi root cause kế thừa đã tự mở code đối chiếu (đã làm, §2).
- [ ] Sau mỗi lần ghi file: `git diff --numstat` khớp dự kiến; không mojibake/EOL drift.
- [ ] Sau mỗi lệnh có thể ghi file (test/visual): `git status --short` review artifact (L-V03).
- [ ] Đóng phiên: `pwsh -File scripts/agent-sync.ps1` (rebase → migration → gate) rồi mới chạy gate cuối (L-003, L-008).
- [ ] Màu tăng/giảm giữ chuẩn Bloomberg (xanh tăng/đỏ giảm) — L-F08; token/class mới (nếu có) vào `soc.tokens.css` / `soc.components.css`, KHÔNG `soc.module.css` (L-F03).

## 2. Bằng chứng đã tự verify (không tin báo cáo của tool khác)

| P0 | File:line @ `577ddf6` | Thực tế đọc được |
|---|---|---|
| P0-1 | `packages/web/src/layouts/full/vertical/header/Header.tsx:77,83-88` | `useUrlValue('q', …, {replace:true})`; Enter `navigate('/stocks/…')` rồi `setSearchVal('')` → `setParams` navigate tương đối pathname cũ (`useUrlState.ts:106,114-125`) ⇒ nuốt điều hướng. |
| P0-2 | `packages/web/src/components/dashboard/PortfolioHeatmap.js:27-34,50-61,226-231,609` | `0%` = `#334155` + chỉ viền vàng; `-7%` `#991b1b` sáng hơn `-3%` `#7f1d1d`; `noData` chạy `Number(null)||0` → trùng màu `0%`; legend hardcode gradient khác `HEAT_STOPS`. |
| P0-3 | `packages/web/src/components/dashboard/UnifiedAlertCenter.js:436-441`; `packages/core/backend/src/signal_intelligence/materializers.py:585-600` | BE lưu `alert.value = abs(pct)`, `direction`, `metadata.price_change_pct`; FE gọi `formatVNDCompact(alert.value)` cho **mọi** family. |
| P0-4 | `packages/web/src/components/dashboard/SmartStatsHeader.js:168-182` | Cả 2 CTA `onClick: () => onRefresh?.()`. |
| P0-5 | `packages/web/src/components/dashboard/PortfolioHeatmap.js:193-213` | `sizeMode==='weight'` + không holdings ⇒ `sizeValue = currentPrice * 100`. |
| P0-6 | `packages/web/src/pages/DashboardPage.tsx:318-320`; `packages/web/src/utils/dashboardSymbols.js:18` | Hàm trả `join("|")` (chuỗi); `[0]` ⇒ 1 ký tự. |

## 3. Thiết kế fix & Tiêu chí nghiệm thu (Given/When/Then)

### S1 — P0-1 Header search + autocomplete
**Fix:** Tách điều hướng khỏi URL-setter trong cùng tick. Trên Enter/chọn gợi ý gọi **duy nhất** `navigate({ pathname: '/stocks/' + sym, search: '' })` — `q` tự biến mất vì state derive từ URL; **không gọi** `setSearchVal('')` (đã verify `@remix-run/router/dist/router.js:296-305`: navigate object với `search:''` thay thế toàn bộ search; không setter nào khác trong tick ghi đè). Giữ `onChange → setSearchVal` để các test AC-B/AC-B'/AC-B'' vẫn đúng. Thêm dropdown gợi ý: debounce module-scope, gọi **`coreApiAdapter.getSymbolList({ q, limit: 20 })`** — adapter đã import sẵn tại `Header.tsx:14`, **không** import `defaultCoreApiAdapter` mới vì mock test tại `Header.component.test.tsx:40-42` chỉ có `getAlertCenterSummary`; phải mở rộng mock với `getSymbolList` trong cùng slice. Response shape là `{ results, next }` (`src/adapters/core/market.js:187`) ⇒ đọc `.results`, guard `Array.isArray`, map `{symbol, name}`. arrow up/down + Enter chọn; Escape đóng; click chọn. Không thêm dependency.

- **AC1.1** Given ô rỗng, when gõ `VCB`, then URL `?q=VCB` (replace, không push) **và** dropdown hiện gợi ý sau debounce.
- **AC1.2** Given dropdown có kết quả, when nhấn Enter, then `pathname === '/stocks/VCB'` **và** `search === ''` (URL sạch). *(Test cũ chỉ assert `q` rỗng ⇒ mù lỗi; phải sửa.)*
- **AC1.3** Given dropdown mở, when ArrowDown rồi Enter, then điều hướng tới mã được highlight (không phải text thô).
- **AC1.4** Given API lỗi, when gõ, then dropdown ẩn/không crash; ô nhập vẫn hoạt động.
- **Test harness (implementer S1 đóng ở fail-before):** mở rộng mock `Header.component.test.tsx:40-42` với `getSymbolList: h.getSymbolList` (thêm h vào `vi.hoisted` `:30-35`); thêm `LocationProbe` dùng `useLocation()` để assert `pathname` (probe hiện tại `:47-50` chỉ đọc `useSearchParams`). Không đổi 5 test AC-A..B''' cũ.

### S2 — P0-2 Heatmap color scale
**Fix:** `HEAT_STOPS` = `[-7:#991b1b, -3:#b91c1c, 0:#eab308, +3:#15803d, +7:#166534]` (độ sáng tăng dần -7→0, giảm dần 0→+7; `textOnHeat` tự chọn chữ tối cho vàng — đã kiểm chứng không vi phạm L-F08). Thêm `NO_DATA_COLOR = '#1e293b'`; `chartData.itemStyle.color = noData ? NO_DATA_COLOR : bg`, `labelColor` tương ứng; bỏ viền vàng khi không phải `isZero`. Legend **đổi inline `style.background` tại `PortfolioHeatmap.js:609`** thành `linear-gradient(to right, ${HEAT_STOPS.map(s=>s.color).join(', ')})` (SSOT — inline style override CSS, chỉ xoá CSS là chưa đủ), **và xoá** gradient hardcode cũ trong `index.css:757-768`; cập nhật 3 key `heatmap.legendMin/legendMid/legendMax` tại **cả** `src/i18n/locales/vi/heatmap.js:12-14` và `en/heatmap.js:12-14` thành `≤ -7% / 0% / ≥ +7%` (bản en: `≤ -7% / 0% / ≥ +7%`).

- **AC2.1** `heatColorContinuous(0) === '#eab308'`; `textOnHeat('#eab308') === '#0b0f17'`.
- **AC2.2** Độ sáng đơn điệu: `-7 < -3 < 0` và `0 > +3 > +7` (dùng `luminance()`).
- **AC2.3** `noData` có màu nền khác `heatColorContinuous(0)`.
- **AC2.4** Export helper thuần `heatmapLegendGradient(): string` từ `PortfolioHeatmap.js`, inline style tại `:609` dùng helper này. Test assert **giá trị helper** = `linear-gradient(to right, #991b1b, #b91c1c, #eab308, #15803d, #166534)` (KHÔNG render DOM — jsdom convert hex→`rgb()` nên assert rendered style sẽ đỏ giả, auditor Round 3 đã probe) + assert `index.css` không còn chuỗi `linear-gradient(to right, #7f1d1d, #5b2228, #2f3747, #14532d, #166534)`. Helper là SSOT duy nhất cho cả tile lẫn legend.
- **AC2.5** Cập nhật 2 assertion cũ trong `heatmap-scale.component.test.ts:16-21` (đang ghim màu cũ) sang màu mới.

### S3 — P0-3 Sai đơn vị `%` → `₫`
**Fix:** Thêm helper dùng chung trong `utils/alertCenterFormat.*` (cùng module với `isDuplicateSummary`, import tại `UnifiedAlertCenter.js:11`): `formatAlertMetric(alert, { compact, full })` → `{ text, full }`.
- **price_shock** (`alert_family === 'price_shock'` hoặc `metadata.price_change_pct != null`): `raw = Number(metadata.price_change_pct)` nếu finite, else `Number(alert.value)` với dấu suy từ `direction` (`sell`/`down`/`short` / số âm ⇒ âm; `buy`/`up`/`long` ⇒ dương — BE emit `buy|sell` tại `models.py:31-32`, `materializers.py:538`). `text = full = ${raw < 0 ? '−' : '+'}${Math.abs(raw).toFixed(2)}%`. **KHÔNG nối currency.**
- **khác**: `text = compact(value)`, `full = full(value)` — `formatVNDCompact`/`formatFullVND` **đã tự nối `₫`** (`formatMarket.js:20-23,31`), tuyệt đối không cộng `t('alertCenter.currency')` (= `"VND"`) vào nữa.
Dùng ở `UnifiedAlertCenter.js:436-441`. Ở `/alert-center`: `formatAlertValue` thật nằm ở **`AlertCenterPage.tsx:77-79`** (không phải utils) — giữ nguyên chữ ký prop `(value)=>string` của `AlertCard`/`StatsTable`/`StatsPanel` để khỏi sửa 4 file test; tại `AlertCard.tsx:223` chỉ thay nhánh price_shock bằng `helper.text`, nhánh khác giữ nguyên `formatAlertValue(...) + ' ' + t('alertCenter.currency')`.

- **AC3.1** Given alert `price_shock` value `26.88` `metadata.price_change_pct = -26.88` direction `sell`, when render, then text `−26.88%` (không chứa `₫`/`VND`).
- **AC3.2** Given alert `whale` value `1.5e9`, when render, then vẫn `1,5 tỷ ₫` (không thành `1,5 tỷ ₫ VND`).
- **AC3.3** Trang `/alert-center` (`AlertCard`) price_shock không còn hiển thị `%` thành `₫`; nhánh khác giữ nguyên chuỗi cũ.

### S4 — P0-4 CTA giả
**Fix:** `SmartStatsHeader` import `useNavigate`; CTA `"Tạo danh mục"` → `navigate('/portfolios/manage')`, `"Kết nối Paper Trading"` → `navigate('/broker')`. Giữ `onRefresh` cho nút Refresh ở chỗ khác (nếu có).

- **AC4.1** Click CTA 1 → `pathname === '/portfolios/manage'`.
- **AC4.2** Click CTA 2 → `pathname === '/broker'`.
- **AC4.3** Không gọi `onRefresh` từ 2 CTA này.

### S5 — P0-5 Sizing fallback vốn hóa
**Fix:** `PortfolioHeatmap.js:210-212`: `sizeValue = marketCap > 0 ? marketCap : 1` (kèm comment giải thích) — thay `currentPrice*100`. Thêm cờ `capFallback` (true khi dùng nhánh này) và hiển thị `t('heatmap.sizeFallbackCap')` nối vào subtitle. Thêm key `sizeFallbackCap` vào cả `src/i18n/locales/vi/heatmap.js` + `en/heatmap.js`.

- **AC5.1** Given `holdings=[]`, `sizeMode='weight'`, mã có `market_cap_bn > 0`, when build `chartData`, then `value === marketCap` (không phải `price*100`).
- **AC5.2** Given `marketCap = 0`, then fallback `value >= 1` (không NaN/0).
- **AC5.3** Subtitle có câu thông báo fallback; cả 2 locale có key.

### S6 — P0-6 index chuỗi
**Fix:** Giữ nguyên contract chuỗi của `collectUniqueSortedSymbols` (đã verify 3 call-site `DashboardPage.tsx:202,298,319` + 4 assertion `features/dashboard/__tests__/dashboard_lifecycle.test.js:41-54` phụ thuộc chuỗi). `DashboardPage.tsx:319` → `collectUniqueSortedSymbols(...).split('|')[0]`. Không đổi helper, không đụng test lifecycle.

- **AC6.1** Given `trackedSymbols=[]`, holdings/watcher chứa `ACB, FPT`, when auto-select, then `selectedSymbol === 'ACB'` (không phải `'A'`).

## 4. TDD fail-before (chạy TRƯỚC khi sửa code)

| Test file | Assertion mới | Kỳ vọng trên code cũ |
|---|---|---|
| `Header.component.test.tsx` (sửa AC-B''') | `currentPath() === '/stocks/VCB'` | ĐỎ (pathname vẫn `/dashboard`) |
| `heatmap-scale.component.test.ts` (sửa 2 assertion + thêm 4) | `heatColorContinuous(0)==='#eab308'`, monotonic, `heatmapLegendGradient()` đúng 5 hex, old gradient bị xoá | ĐỎ |
| `__tests__/alert-format.component.test.ts` (mới) | price_shock → `%`, whale → `₫` | ĐỎ |
| `__tests__/smart-stats-cta.component.test.ts` (mới) | navigate pathname | ĐỎ |
| `__tests__/heatmap-sizing.component.test.ts` (mới) | marketCap fallback | ĐỎ |
| `dashboardSymbols` test (mới) | first symbol = `ACB` | ĐỎ |

Chạy fail-before bằng `npx vitest run <files>` — **CHƯA CHẠY** tại thời điểm viết plan.

## 5. Gates (baseline cần đo lại sau rebase)

Lokal (chạy được): `node packages/web/scripts/check-multi-agent.mjs` · `npx tsc --noEmit` · `npm run lint` · `npm run check:tokens` · `npm run i18n:scan:strict` · `npm run check:i18n-hardcoded` · `git diff --numstat`.

Theo runbook (AGENTS.md / workflow-dev-loop B7): **FE test + build chỉ trên VPS staging** `14.225.255.47` (`bash scripts/deploy-staging.sh --verify`, `docs/STAGING_VPS_RUNBOOK.md`) — KHÔNG local Docker. `npm run test:components`, `npm run build`, visual QA trên staging. Mọi cổng không chạy được ⇒ ghi `CHƯA CHẠY`.

Baseline exit-code hiện tại: **CHƯA ĐO** (sẽ ghi vào `docs/evidence/dashboard-uiux/gates.md`).

## 6. Non-goals / đã defer

- P1-1..P1-7, P2-1..P2-5 — wave sau.
- **Q4 (popover Heatmap)** — Owner đã chốt "kích hoạt", nhưng thuộc P2/P2-1 ⇒ thực hiện ở wave P2, không gộp vào PR P0 này để giữ phạm vi & nghiệm thu nhỏ.
- Không đổi `collectUniqueSortedSymbols` contract trả về (đã verify 3 call-site + 4 assertion giữ nguyên).
- Không đổi màu tăng/giảm Bloomberg (`--pf-gain`/`--pf-loss`), không tạo file token mới.

## 7. Rollback

Mỗi commit là 1 slice độc lập (S1..S6). Rollback = revert commit slice tương ứng trên branch; `git checkout --` bị cấm (L-A01) — dùng `git show HEAD:<file> > <file>` hoặc `git stash`.

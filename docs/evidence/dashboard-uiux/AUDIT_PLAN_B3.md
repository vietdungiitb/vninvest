# AUDIT PLAN B3 — Đối chiếu `PLAN_DASHBOARD_P0_20261118.md` với code thật

> **Ngày audit:** 2026-11-18 · **Auditor:** subagent độc lập, CHỈ ĐỌC (không sửa code runtime).
> **Phạm vi:** `docs/PLAN_DASHBOARD_P0_20261118.md` (B2) đối chiếu branch `feat/dash-p0-uiux`, HEAD `577ddf64650066225f1317a659f20e851721ce08`.
> **Nguyên tắc:** mọi khẳng định kèm `file:line` tự mở bằng read/grep; không tin plan, không tin báo cáo audit khác. Không chạy gate (không sửa file).

---

## 1. Bảng finding (bằng chứng `file:line` thật)

| # | Mục kiểm tra | Khẳng định trong plan | Code thật / bằng chứng độc lập | Kết luận |
|---|---|---|---|---|
| 1 | P0-1 root cause | `Header.tsx:77,83-88`: `useUrlValue('q', …, {replace:true})`; Enter `navigate()` rồi `setSearchVal('')` nuốt điều hướng | `Header.tsx:77` đúng; `Header.tsx:83-88` đúng; `useUrlState.ts:114-128` → `setParams` (`:106`) với `{replace}` (`:124`). `useUrlState.ts:180-189` ghi rõ 2 `setParams` cùng tick **không compose** (probe 6.30.3 `a=1,b=2 ⇒ ?b=2`) | **ĐÚNG** |
| 2 | S1 `navigate({pathname, search:''})` có xoá `?q=`? | `q` tự biến mất, không bị setter khác ghi đè | `useUrlValue` derive từ `params.get(key)` (`useUrlState.ts:109-112`) ⇒ sau navigate `search=''` thì `q` biến mất, input rỗng. `@remix-run/router/dist/router.js:296-305` `createPath`: `if (search && search !== "?")` ⇒ `search:''` **không** nối `?`. `useNavigate` 6.30.3 xác nhận (`node_modules/react-router-dom/package.json` = 6.30.3). Sau fix, handler Enter **không còn lời gọi setter nào** trong cùng tick | **ĐÚNG** (cơ chế đúng) — nhưng xem Objection 1 |
| 3 | S2 root cause heatmap | `0%`=`#334155`, `-7%` sáng hơn `-3%`, `noData` trùng màu `0%`, legend lệch | `PortfolioHeatmap.js:27-34` đúng; `:50-61` `Number(changePct)||0` với `changePct=null` (`:183`) ⇒ `0` ⇒ `#334155`; `:216-218,227-228` viền vàng; `index.css:761-768` gradient hardcode khác `HEAT_STOPS` | **ĐÚNG** |
| 4 | S2 màu mới / L-F08 / soc-uiux | 5 stops mới, độ sáng đơn điệu, `noData` riêng; không đổi `--pf-gain/--pf-loss` | Tính theo `lum()` tại `PortfolioHeatmap.js:63-70`: `#991b1b≈0.076 < #b91c1c≈0.112 < #eab308≈0.497 > #15803d≈0.160 > #166534≈0.097` ⇒ đơn điệu đúng; `textOnHeat('#eab308')` (`:72-74`, ngưỡng 0.35) ⇒ `#0b0f17` đúng. L-F08 (`docs/LESSONS/css-soc.md:65-81`) chỉ cấm đổi `--pf-gain/--pf-loss`; plan §6:118 giữ nguyên. `check-tokens.mjs:37-45` **chỉ quét `.css`** ⇒ hex trong `.js` không bị gate. Q1 (plan:11) Owner đã chốt dải màu này | **ĐÚNG** — nhưng xem Objection 3 |
| 5 | S3 root cause `%`→`₫` | BE lưu `value=abs(pct)`, `direction`, `metadata.price_change_pct`; FE format VND mọi family | `materializers.py:585-600` đúng (`value=abs(pct)`, `:588-590` `direction`, `:592-601` `price_change_pct` có dấu); `materializers.py:538` `BUY if pct>=0 else SELL` ⇒ `alert.direction` cho sign được. `UnifiedAlertCenter.js:436-441` `formatVNDCompact(alert.value)` mọi family đúng; `alert.direction` có dùng ở `:337,420` | **Root cause ĐÚNG**; field tồn tại thật. **Fix location SAI** — Objection 2 |
| 6 | S4 CTA giả | `SmartStatsHeader.js:168-182` cả 2 nút `onRefresh` | `SmartStatsHeader.js:167-182` đúng (`:170`, `:178`) | **ĐÚNG** |
| 7 | S5 field `marketCap` | `marketCap > 0 ? marketCap : 1`, thay `currentPrice*100` | `PortfolioHeatmap.js:188` khai `marketCap` từ `market_cap_bn`/`market_cap`; `:210-212` đúng `currentPrice*100`; `:221` `value: Math.max(sizeValue,1)` ⇒ AC5.1/5.2 khả thi. Tên field `marketCap` (biến local) **đúng**, AC5.1 dùng `market_cap_bn` (nguồn) cũng đúng | **ĐÚNG** |
| 8 | S6 index chuỗi | Hàm trả `join("|")`, `[0]` ⇒ `"A"` | `dashboardSymbols.js:18` `return uniqueSorted.join("|")`; `DashboardPage.tsx:319` `[0]` đúng. **Có 2 call-site khác phụ thuộc contract chuỗi**: `DashboardPage.tsx:202,298` + 4 assertion tại `features/dashboard/__tests__/dashboard_lifecycle.test.js:41-54` | **Root cause ĐÚNG**; fix `.split('|')[0]` đúng, nhưng Objection 4 |
| 9 | TDD fail-before AC-B''' | Test cũ chỉ assert `q` rỗng ⇒ mù lỗi; assertion mới pathname sẽ ĐỎ | `Header.component.test.tsx:168-175` chỉ `expect(currentSearch()).toBe("")` — đúng mù lỗi. Trên code cũ, `navigate('/stocks/…')` rồi `setSearchVal('')` (`:85-86`) ⇒ pathname `/dashboard`, assertion `'/stocks/VCB'` **ĐỎ** thật. `heatmap-scale.component.test.ts:16-21` ghim `heatColorContinuous(7)==='#15803d'` & `(0)==='#334155'` ⇒ với stops mới ĐỎ thật (dòng 16 `-7` vẫn `#991b1b`, nên "2 assertion" là chính xác) | **ĐÚNG** |
| 10 | Scope / 5 quyết định Owner | Q1 giữ ±7%, Q2 fallback vốn hóa, Q3 Enter+dropdown+test pathname, Q4 popover defer, Q5 1 PR | Plan §0:11-15 khớp; §3 S1 có dropdown (`:50-55`), S5 fallback cap (`:81`), §6:116 defer Q4, §6:115 1 PR. Không mâu thuẫn giữa Q1–Q5 | **ĐÚNG** (trừ chi tiết Objection 3) |

---

## 2. Verdict

**NEED_REVISION**

Lý do: 6 root cause P0 đều khớp code thật; cơ chế `navigate({pathname, search:''})` đúng và không bị setter ghi đè; màu mới không vi phạm L-F08/soc-uiux theo đúng phạm vi đã được Owner chốt. Tuy nhiên có **4 objection kỹ thuật cụ thể** (2 objection chặn nghiệm thu AC, 2 objection cần bổ sung checklist) — phải sửa plan trước khi vào code.

---

## 3. Objections (đánh số)

1. **[BLOCK AC1.1–AC1.4] S1 dùng `defaultCoreApiAdapter` sẽ làm gãy mock test Header.**
   Plan §3 S1 (`:50`) bắt gọi `getSymbolList` "qua `defaultCoreApiAdapter` cast `as unknown as { getSymbolList }`". `Header.tsx:14` hiện **chỉ import `coreApiAdapter`**; `Header.component.test.tsx:40-42` mock module này với **duy nhất** `coreApiAdapter: { getAlertCenterSummary: … }`. Thêm named import `defaultCoreApiAdapter` ⇒ Vitest báo export không tồn tại trên mock, **tất cả** test AC-A/B/B'/B''/B''' (`:116-175`) gãy trước khi chạm assertion mới. Phải dùng `coreApiAdapter` đã import (`coreApiAdapter.js:171` chính là `defaultCoreApiAdapter`), **hoặc** sửa mock tại `:40-42` và bổ sung mock `getSymbolList` trả `{results:[…]}`; plan §4 (`:96-101`) không liệt kê việc sửa mock này.

2. **[BLOCK AC3.3] S3 sửa sai địa chỉ hàm `formatAlertValue`.**
   Plan `:67` viết "nếu `formatAlertValue` không phân biệt family thì sửa chung trong `utils/alertCenterFormat`". Thực tế `formatAlertValue` được định nghĩa ở `AlertCenterPage.tsx:77-79` (= `formatVnd(value)` thuần), truyền xuống `AlertCard` tại `:703,:723`; `utils/alertCenterFormat.ts:35-53` chỉ có `formatVnd`/`formatVndCompact`, **không có** hàm family-aware nào. Thêm vào đó `AlertCard.tsx:223` nối cứng `{t("alertCenter.currency")}` sau mọi giá trị ⇒ dù đổi formatter cũng vẫn ra `₫`. Muốn AC3.3 đúng phải sửa **cả** `AlertCenterPage.tsx:77-79` + `AlertCard.tsx:223` (bỏ/locale-hoá hậu tố), không phải "sửa chung trong utils". Ngoài ra `metadata.price_change_pct` (`materializers.py:592-601`) không hề được đọc ở `UnifiedAlertCenter.js` (grep `metadata` chỉ trúng 2 comment ở `:336,:450`) ⇒ fallback này vô hiệu ở tầng FE; dùng `alert.direction` (`UnifiedAlertCenter.js:337,420`) làm sign là đủ và phải ghi rõ trong plan.

3. **[CẦN BỔ SUNG CHECKLIST] Q1 legend `≤ -7% … 0% … ≥ +7%` chưa được implement hoá.**
   `PortfolioHeatmap.js:606,614-615` đọc `t("heatmap.legendMin/Mid/Max")` với fallback `"-7%"`, `"0"`, `"+7%"`; giá trị hiện tại `i18n/locales/vi/heatmap.js:12-14` (**không có** `≤`/`≥`). Plan `:58` nói lấy nhãn từ `heatmap.legend*` nhưng không có bước sửa 3 key này ở cả 2 locale. Thêm vào đó AC2.4 (`:63`) "assert gradient chứa đúng 5 hex của `HEAT_STOPS`" sẽ là **tautology** nếu gradient tự sinh từ `HEAT_STOPS.map(...)`; phải assert thẳng rendered `style.backgroundImage` (hoặc xoá/đè gradient cứng tại `index.css:761-768`), nếu không AC2.4 xanh dù CSS cũ vẫn còn.

4. **[CẦN BỔ SUNG CHECKLIST] S6 phải cấm đổi contract helper bằng grep, không chỉ nói ở Non-goals.**
   `collectUniqueSortedSymbols` có 2 call-site sản xuất khác (`DashboardPage.tsx:202` `symbolString`, `:298` `token`) và 4 assertion trong `dashboard_lifecycle.test.js:41-54` so sánh chuỗi token. Plan `:88` cho phép "đổi helper trả mảng nếu không call-site nào khác — verify bằng grep trước", nhưng checklist §1 (`:23-34`) **không** có bước grep này; §6:117 chỉ nói mục tiêu. Phải ghi cứng: giữ contract `join("|")`, chỉ dùng `.split('|')[0]` tại `:319`, và chạy lại `dashboard_lifecycle.test.js`.

---

## 4. Câu hỏi cần làm rõ

1. Coordinator chốt hướng S1: dùng `coreApiAdapter` đã import (`Header.tsx:14`) hay thêm `defaultCoreApiAdapter` + sửa mock `Header.component.test.tsx:40-42`? (Khuyến nghị: dùng `coreApiAdapter`.)
2. AC3.3 có nằm trong slice S3 của PR P0 này không? Nếu có, ai đóng `AlertCenterPage.tsx:77-79` + `AlertCard.tsx:223` — implementer S3 hay tách slice? (Plan hiện đưa AC3.3 vào S3 nhưng fix location sai.)
3. Q1 yêu cầu `≤/≥`; có chấp nhận cập nhật `heatmap.legendMin/Mid/Max` trong cả 2 locale trong S2 không, hay giữ nhãn cũ và chỉ đổi màu?
4. AC2.4 sẽ assert rendered style hay assert `HEAT_STOPS`? Nếu assert constant, đề đổi thành assert DOM để không phải tautology.
5. Test harness `Header.component.test.tsx:77-85` không có `<Routes>` và không có probe `useLocation()`; ai thêm probe pathname cho AC1.2 (`:53`)? Plan §4 liệt kê assertion mới nhưng không liệt kê sửa harness.

---

## 5. Ghi chú không phải objection

- Không vi phạm `soc.module.css` (plan không đụng file này), không migration, không shared/deny-list, không `npm install` — phù hợp L-001/L-F03.
- Không đụng `--pf-gain/--pf-loss` (`soc.tokens.css:40-53`) ⇒ L-F08 an toàn; dải heatmap là ECharts nội bộ, Owner Q1 đã chốt.
- `npm run check:tokens` không quét `.js` (`check-tokens.mjs:43`) ⇒ hex mới trong `PortfolioHeatmap.js` không bị chặn; **caveat**: nếu implementer đưa hex mới vào `.css` (legend) thì `#eab308/#15803d/#166534/#991b1b` **không** nằm trong allowlist (`check-tokens.mjs:10-29`) ⇒ gate đỏ. Giữ gradient inline từ `HEAT_STOPS`.
- Không chạy gate nào (auditor chỉ đọc). Mọi con số luminance ở finding #4 tính bằng chính hàm `lum()` tại `PortfolioHeatmap.js:63-70`, có thể tái tạo bằng cách import `luminance()` (`:76-78`).

---
---

# ROUND 2 — AUDIT PLAN B3 (sửa sau objection Round 1)

> **Ngày:** 2026-11-18 · **Auditor:** subagent độc lập, CHỈ ĐỌC.
> **Đối tượng:** `docs/PLAN_DASHBOARD_P0_20261118.md` bản đã sửa (đọc lại toàn bộ 124 dòng) + code thật tại HEAD `577ddf64650066225f1317a659f20e851721ce08`.
> **Phạm vi:** (a) 5 objection Round 1 đã giải quyết chưa; (b) tìm objection mới. Không sửa code, không chạy gate.

## R2.1 — Trạng thái 5 objection Round 1

| Objection R1 | Bằng chứng sửa trong plan | Code thật đối chiếu | Kết luận |
|---|---|---|---|
| 1. `defaultCoreApiAdapter` gãy mock | Plan `:28` + `:52`: dùng `coreApiAdapter` có sẵn, mở rộng mock `getSymbolList` | `Header.tsx:14` import `coreApiAdapter` ✓; `coreApiAdapter.js:136` `...marketClient` và `market.js:189` `getSymbolList` ⇒ method có thật ✓; `Header.component.test.tsx:40-42` hiện chỉ mock `getAlertCenterSummary`, plan đã yêu cầu mở rộng trong cùng slice ✓ (chưa làm — đúng vì plan B2) | **ĐÃ GIẢI QUYẾT** (ở mức thiết kế) |
| 2. S3 sửa sai chỗ `formatAlertValue` | Plan `:69` nêu rõ `AlertCenterPage.tsx:77-79`, bọc tại `AlertCard.tsx:223`, giữ chữ ký prop | `AlertCenterPage.tsx:77-79` = `formatVnd` ✓; `utils/alertCenterFormat.ts:35-39` không có family formatter ✓; `AlertCard.tsx:223` nối `t('alertCenter.currency')` ✓ | **ĐÃ GIẢI QUYẾT** (nhưng sinh objection mới R2-1) |
| 3. Q1 legend `≤/≥` chưa implement | Plan `:60` sửa 3 key ở cả 2 locale | `vi/heatmap.js:12-14` & `en/heatmap.js:12-14` đúng là `legendMin/Mid/Max`; `PortfolioHeatmap.js:606,614-615` đọc đúng 3 key ✓ | **ĐÃ GIẢI QUYẾT** |
| 4. AC2.4 tautology | Plan `:65` assert **rendered** `style.background` + kiểm `index.css` hết gradient cũ | `.heatmap-legend-bar` render tại `PortfolioHeatmap.js:607-613` ✓ | **ĐÃ GIẢI QUYẾT** (nhưng sinh objection mới R2-2) |
| 5. S6 đổi contract helper | Plan `:29,:90`: giữ chuỗi, chỉ `.split('|')[0]` tại `:319`, không đụng test | `dashboardSymbols.js:18` trả `join("|")`; `DashboardPage.tsx:202,298,319` + `dashboard_lifecycle.test.js:41-55` (3 assertion, `:46-50` + `:54-55`) phụ thuộc chuỗi ✓ | **ĐÃ GIẢI QUYẾT** (xem R2-4 về dòng `:119` còn sót) |

## R2.2 — Finding mới

| # | Chủ đề | Bằng chứng code thật | Tác động |
|---|---|---|---|
| A | `formatVNDCompact`/`formatFullVND` **đã tự nối `₫`** | `formatMarket.js:20-23` (`tỷ ₫`, `triệu ₫`, `nghìn ₫`, `₫`), `:31` (`₫`) | Plan `:69` lại cộng thêm `' ' + currency` với `currency = t('alertCenter.currency')` = `'VND'` (`vi/alertCenter.js:120`, `en/alertCenter.js:120`) ⇒ `"1,50 tỷ ₫ VND"`, **vi phạm AC3.2** ("vẫn format VND như cũ") |
| B | Gradient legend nguồn thật là **inline style**, không phải CSS | `PortfolioHeatmap.js:609` `style: { background: "linear-gradient(to right, #7f1d1d, #5b2228, #2f3747, #14532d, #166534)" }`; `index.css:757-768` là rule bị inline override | Plan `:60` chỉ dặn "xoá gradient hardcode cũ trong `index.css:761-768`" — nếu làm đúng vậy mà không sửa `:609`, rendered style vẫn là 5 hex cũ ⇒ AC2.4 ĐỎ sau fix |
| C | Sign mapping không được định nghĩa | BE `models.py:31-32` `DirectionChoices.BUY='buy'`, `SELL='sell'`; `materializers.py:538` gán BUY khi `pct>=0`; `serializers.py:33` có `metadata`, `:44-49` `get_alert_family` trả `'price_shock'` | Plan `:69` chỉ nói "fallback `alert.direction`" nhưng **AC3.1** (`:71`) dùng `direction: 'down'` — giá trị BE không bao giờ emit. Helper cần map rõ `buy/sell/up/down` + số có dấu, nếu không AC3.1 có thể ĐỎ tuỳ input test |
| D | Response `getSymbolList` chưa được mô tả | `market.js:187-194` trả `{ results, next }` (không phải mảng) | Plan `:52` chỉ nói gọi API + mở rộng mock `getSymbolList`; không nói đọc `.results` hay field `symbol`/`company_name` ⇒ AC1.1/AC1.3 dễ viết mock sai shape |
| E | Non-goals còn câu điều kiện cũ | Plan `:119` "Không đổi contract ... **(trừ khi verify không có call-site khác)**" mâu thuẫn với `:90` "Không đổi helper" (đã verify có 3 call-site) | Sót văn bản R1, có thể làm implementer hiểu sai và đổi helper |

## R2.3 — Verdict

**NEED_REVISION**

5 objection Round 1 đều đã được sửa ở mức thiết kế. Tuy nhiên xuất hiện **2 objection kỹ thuật mới chặn nghiệm thu** (R2-1 double currency, R2-2 inline gradient) + 3 objection mức trung bình (R2-3 sign mapping, R2-4 mock shape, R2-5 văn bản sót). Chưa thể AGREE vì AC3.2 và AC2.4 sẽ đỏ nếu code đúng theo plan hiện tại.

## R2.4 — Objections mới (đánh số riêng Round 2)

1. **[BLOCK AC3.2] Double currency trong helper `formatAlertMetric`.** Plan `:69` đặt `text = compact(value) + ' ' + currency` với `compact = formatVNDCompact` — hàm này **đã nối ` ₫`** (`formatMarket.js:20-23`) — và `currency = t('alertCenter.currency') = 'VND'` (`vi/alertCenter.js:120`, `en/alertCenter.js:120`). Kết quả `1,5 tỷ ₫ VND`. Phải chọn một: (a) `currency: ''` cho nhánh VND của `UnifiedAlertCenter`, hoặc (b) dùng `formatVnd`/`formatVndCompact` từ `alertCenterFormat.ts:35-53` (không nối ký hiệu) rồi mới thêm `' VND'`. Nhánh `AlertCard` (`:223`) dùng `formatAlertValue` (`AlertCenterPage.tsx:77-79` → `formatVnd`, `:35-39` không nối ₫) nên **đúng** — đừng đổi nhánh này.

2. **[BLOCK AC2.4] Plan bỏ sót nguồn gradient thật tại `PortfolioHeatmap.js:609`.** Inline style này thắng `index.css:757-768`. Phải sửa plan thành: sinh `background: linear-gradient(to right, ${HEAT_STOPS.map(s => s.color).join(', ')})` **tại `:609`**, và (tuỳ chọn) xoá rule CSS `:761-768` cho sạch. Nếu chỉ xoá CSS, assertion "rendered style chứa 5 hex mới" (plan `:65`) vẫn đỏ.

3. **[AC3.1] Sign mapping phải được ghi cứng.** `materializers.py:538` + `models.py:31-32` ⇒ BE chỉ emit `'buy'`/`'sell'`; `metadata.price_change_pct` mang dấu thật (`materializers.py:595,600`). Plan `:71` lại dùng input `direction: 'down'`. Cần định nghĩa: `sign = price_change_pct < 0 || ['sell','down','short'].includes(String(direction).toLowerCase()) ? '−' : '+'`, kèm handling `pct === 0`.

4. **[AC1.1/AC1.3] Mock `getSymbolList` cần đúng shape.** `market.js:187` trả `{results, next}`; plan `:52` chỉ yêu cầu "mở rộng mock". Phải ghi rõ mock trả `{ results: [{ symbol: 'VCB', company_name: '...' }], next: null }` và component đọc `resp.results`, nếu không AC1.1 (dropdown hiện sau debounce) sẽ lỗi ngay cả khi code fix đúng.

5. **[NHỎ] Xoá điều kiện sót ở Non-goals.** Plan `:119` còn "(trừ khi verify không có call-site khác)" — trái `:90`. Sửa thành câu khẳng định tuyệt đối để tránh implementer đổi helper.

## R2.5 — Câu hỏi cần làm rõ

1. Chọn phương án (a) hay (b) cho objection R2-1? Khuyến nghị (b): dùng formatter không có ₫ rồi thêm `' VND'` — đồng nhất với `AlertCard.tsx:223`.
2. Có đồng ý bổ sung `PortfolioHeatmap.js:609` vào danh sách file đích của S2 không (hiện plan `:60` chỉ nêu `index.css`)?
3. AC3.1 có đổi input thành `direction: 'sell'` (khớp BE `models.py:32`) hay giữ `'down'` và bắt helper map cả hai?
4. Test harness `Header.component.test.tsx:77-85` vẫn không có probe `useLocation()` — R1 câu hỏi 5 chưa được trả lời trong plan sửa; ai thêm `currentPath()`/`currentSearch()` probe trong slice S1?

## R2.6 — Ghi chú

- Không vi phạm soc-uiux/L-F08 ở bản sửa: plan `:60` vẫn giữ stops Owner Q1, `:120` giữ `--pf-gain/--pf-loss`; `check-tokens.mjs:37-45` chỉ quét `.css`.
- `alertCenter.currency` tồn tại thật ở cả 2 locale (`vi/alertCenter.js:120`, `en/alertCenter.js:120`), giá trị `'VND'`.
- `serializers.py:31-33` xác nhận `metadata`, `direction`, `alert_family` đều được trả về FE ⇒ field trong plan S3 là có thật; chỉ có sign mapping là chưa rõ (R2-3).
- Auditor không chạy gate; mọi assertion "ĐỎ/ĐÚNG" ở trên suy từ code tĩnh đã đọc, không phải kết quả test thực thi.

---
---

# ROUND 3 — AUDIT PLAN B3 (vòng cuối)

> **Ngày:** 2026-11-18 · **Auditor:** subagent độc lập, CHỈ ĐỌC.
> **Đối tượng:** `docs/PLAN_DASHBOARD_P0_20261118.md` bản sửa cuối (127 dòng) + code thật tại HEAD `577ddf64650066225f1317a659f20e851721ce08`.
> **Phạm vi:** (1) 5 objection Round 2; (2) objection mới về tính khả thi thi công (circular import, header mock, jsdom render, AC5 vs test cũ). Không sửa code runtime.

## R3.1 — Trạng thái 5 objection Round 2

| Objection R2 | Bằng chứng sửa trong plan | Code thật đối chiếu | Kết luận |
|---|---|---|---|
| 1. Double currency | Plan `:71` bỏ hẳn `t('alertCenter.currency')`, AC3.2 (`:75`) đổi thành `1,5 tỷ ₫` | `formatMarket.js:20-23,31` tự nối `₫`; `vi/alertCenter.js:120` = `'VND'` | **ĐÃ GIẢI QUYẾT** |
| 2. Inline gradient `:609` | Plan `:60` đổi thẳng inline `style.background` tại `PortfolioHeatmap.js:609` + xoá `index.css:757-768` | `PortfolioHeatmap.js:609` là nguồn rendered thật, `index.css:757-768` bị override | **ĐÃ GIẢI QUYẾT** |
| 3. Sign mapping `buy/sell` | Plan `:70` map rõ `sell/down/short`/số âm ⇒ `−`, `buy/up/long` ⇒ `+`, ưu tiên `metadata.price_change_pct` | `models.py:31-32`, `materializers.py:538`, `serializers.py:33,44-49` | **ĐÃ GIẢI QUYẾT** |
| 4. Mock shape `{results,next}` | Plan `:52` ghi rõ đọc `.results`, guard `Array.isArray`, map `{symbol,name}` | `market.js:187-194` trả `{results, next}` | **ĐÃ GIẢI QUYẾT** |
| 5. Văn bản mâu thuẫn Non-goals | Plan `:122` thành câu khẳng định, bỏ điều kiện "(trừ khi…)" | — | **ĐÃ GIẢI QUYẾT** |

## R3.2 — Finding mới (khả thi thi công)

| # | Chủ đề | Bằng chứng | Tác động |
|---|---|---|---|
| A | **jsdom chuẩn hoá hex → `rgb()`** | Probe thực thi (read-only): `node -e "const {JSDOM}=require('jsdom');const d=new JSDOM('<div id=x></div>');const el=d.window.document.getElementById('x');el.style.background='linear-gradient(to right, #991b1b, #b91c1c, #eab308, #15803d, #166534)';console.log(el.style.background)"` ⇒ `linear-gradient(to right, rgb(153, 27, 27), rgb(185, 28, 28), rgb(234, 179, 8), rgb(21, 128, 61), rgb(22, 101, 52))`. `jsdom 29.1.1`; `vitest.config.ts:10` `environment:"jsdom"` | Plan `:65` assert rendered `style.background` **"chứa đủ 5 hex mới"** ⇒ **ĐỎ ngay cả sau fix đúng**, vì chuỗi hex không còn trong DOM |
| B | **Không có test render `PortfolioHeatmap`** | `heatmap-scale.component.test.ts:1-2` chỉ import helper thuần; các test `:4-90` đều gọi hàm, không `render()`. Thư mục `__tests__` chỉ có 3 file (`alert-card-compact`, `alert-list-20repro`, `heatmap-scale`) — grep `PortfolioHeatmap` trong test chỉ trúng dòng import `:2`. `vitest.config.ts:12` include `*.component.test.*`, `:13` `setupFiles: []` | Muốn assert rendered style phải **thêm test render mới** kèm wrapper (`useI18n`, router, echarts) — plan §4 `:102` không liệt kê file này; dễ bị bỏ sót hoặc viết test sai |
| C | Extension của `alertCenterFormat.*` mơ hồ | Glob chỉ có `utils/alertCenterFormat.ts` + `alertCenterFormat.component.test.ts`; `AlertCard.tsx:9` import `.../alertCenterFormat.js` (Vite resolve sang `.ts`) | Plan `:69` viết `.*` — nếu implementer tạo file `.js` mới sẽ sinh module trùng; phải ghi đích danh `.ts`. **Không có circular import**: toàn file `alertCenterFormat.ts:1-117` có **0 lệnh import** (chỉ các `export` ở `:5,6,35,43,56,63,70,79,88,104,113`), helper nhận `compact`/`full` qua tham số ⇒ an toàn |
| D | Header mock/probe chưa nêu đủ trong plan | `Header.component.test.tsx:30-35` khai `h` (4 fn), `:40-42` factory mock, `:92-110` `beforeEach` reset 4 fn; `:77-85` `renderHeader` chỉ có `SearchProbe`/`NavTypeProbe`, **không có `useLocation()` probe**. Plan `:28,:52` chỉ dặn "mở rộng mock tại `:40-42`"; `:101` dùng `currentPath()` | Phải thêm `getSymbolList` vào `h`, factory, `mockReset` + `mockResolvedValue` ở `beforeEach`, và thêm LocationProbe — nếu không AC1.1/AC1.2 lỗi ngay cả khi fix đúng. Đây là câu hỏi R1#5 / R2#4 **vẫn chưa được trả lời** trong plan |
| E | AC5 vs test cũ | Grep toàn `*.test.*`: **0 kết quả** cho `currentPrice * 100`, `market_cap_bn`, `sizeMode`, `capFallback`, `heatmap-sizing`; `heatmap-scale.component.test.ts:2,4-90` chỉ test helper thuần (`heatColorContinuous`, `groupTinyTiles`, `heatLabelGating`, `formatHeatmapLabel`) | **Không có xung đột** — AC5 an toàn |

## R3.3 — Verdict

**NEED_REVISION**

Lý do: 5 objection Round 2 đều đã sửa xong; không có circular import; AC5 không đụng test cũ. Nhưng **2 objection mới chặn AC2.4**: (R3-1) jsdom normalise hex thành `rgb()` nên assertion "chứa 5 hex" sẽ đỏ sau fix đúng; (R3-2) plan không liệt kê việc tạo test render `PortfolioHeatmap` (hiện chỉ test helper thuần). Thêm 2 reservation thiết kế (R3-3 extension `.ts`, R3-4 mock/probe). Đây là vòng cuối → đề nghị coordinator chốt sửa 2 dòng trong plan rồi mới vào code.

## R3.4 — Objections mới

1. **[BLOCK AC2.4] Đổi assertion từ hex sang rgb (hoặc convert).** Plan `:65` phải sửa thành: assert `style.background` chứa `rgb(153, 27, 27)`, `rgb(185, 28, 28)`, `rgb(234, 179, 8)`, `rgb(21, 128, 61)`, `rgb(22, 101, 52)` — hoặc trong test convert hex→rgb rồi so sánh. Bằng chứng: probe jsdom 29.1.1 ở R3.2-A + `vitest.config.ts:10`. Giữ nguyên phần "index.css hết gradient cũ" (plan `:65`) là đúng.

2. **[BLOCK AC2.4] Bổ sung test render vào §4.** Plan `:102` hiện ghi "sửa `heatmap-scale.component.test.ts` … + legend" nhưng file này (`:1-2`) không render component. Phải thêm 1 file `*.component.test.tsx` render `PortfolioHeatmap` với mock `useI18n`/`coreApiAdapter` + `<MemoryRouter>`, hoặc tách `LegendBar` thành helper thuần export để test không cần render. Ai đóng: implementer slice **S2**, ngay bước viết test fail-before (trước khi sửa `:609`).

3. **[NHỎ] Ghi đích danh `utils/alertCenterFormat.ts`** ở plan `:69` (thay `.*`), tránh tạo `.js` trùng module; `AlertCard.tsx:9` đã import từ module này ⇒ thêm named export là đủ, không circular import.

4. **[RESERVATION] Header mock + probe.** Bổ sung vào plan `:28/:52`: thêm `getSymbolList` vào `h` (`Header.component.test.tsx:30-35`), factory mock (`:40-42`), `beforeEach` (`:92-110`) với `mockResolvedValue({results:[...], next:null})`; thêm `LocationProbe` dùng `useLocation()` vào `renderHeader` (`:77-85`) để `currentPath()` (plan `:101`) tồn tại. Ai đóng: implementer slice **S1**, cùng commit fail-before.

## R3.5 — Câu hỏi cần làm rõ

1. Chọn assert rgb hay convert hex→rgb trong test AC2.4? (Khuyến nghị: convert để test vẫn đọc được ý nghĩa 5 stops từ `HEAT_STOPS`.)
2. AC2.4 tách file render mới hay export `LegendBar` helper? (Khuyến nghị: export helper — rẻ hơn, tránh mock ECharts.)
3. Có chấp nhận reservation R3-4 (Header probe/mock) đóng ngay trong slice S1 không, hay tách ticket riêng?

## R3.6 — Ghi chú tích cực (đã verify)

- **Không circular import**: `alertCenterFormat.ts:1-117` có 0 import; `UnifiedAlertCenter.js:11`, `AlertCard.tsx:5-9`, `DetailDrawer.tsx:4`, `StatsTable.tsx:4`, `AlertCenterPage.tsx:10` chỉ tiêu thụ named export.
- **AC5 an toàn**: không test cũ nào pin `currentPrice * 100` / `sizeMode` / `market_cap_bn`; `heatmap-scale.component.test.ts:4-90` là helper-pure.
- **Scope/Q1–Q5 nhất quán**: plan `:11-15`, `:60`, `:86`, `:122` không mâu thuẫn; L-F08/soc-uiux không bị vi phạm (`soc-uiux/SKILL.md:19,22`; `check-tokens.mjs:37-45` chỉ quét `.css`).
- Auditor không chạy test suite; chỉ có 1 lệnh thực thi read-only là probe jsdom ở R3.2-A (không ghi file). Mọi kết luận khác từ code tĩnh đã mở.

---

## B4 CONSENSUS

**Ngày 2026-11-18.** Đọc lại 3 đoạn amend: `plan:54-58` (AC1.x + test harness), `plan:66` (AC2.4), `plan:98-109` (bảng TDD). **2 blocker Round 3 đều đã hết:** (1) jsdom hex→`rgb()` — AC2.4 (`:66`) bỏ render DOM, đổi sang export helper thuần `heatmapLegendGradient()` và assert chuỗi hex trực tiếp; (2) thiếu test render — bảng TDD `:103` cập nhật "sửa 2 assertion + thêm 4", helper được test như hàm thuần, không cần wrapper ECharts/i18n/router. Reservation R3-4 cũng đã đóng: `plan:58` gán rõ implementer **S1**, bước fail-before, mở rộng mock `getSymbolList` (`Header.component.test.tsx:30-35,40-42`) + thêm `LocationProbe` (`:47-50`). **Reservation còn lại (không chặn):** (a) `plan:70` vẫn viết `utils/alertCenterFormat.*` — phải ghi đích danh `.ts` (glob chỉ có `alertCenterFormat.ts`; `AlertCard.tsx:9` import `...alertCenterFormat.js` resolve sang `.ts`) — implementer **S3**, bước fail-before; (b) `plan:61` vẫn mô tả inline `${HEAT_STOPS.map(...).join(', ')}` trong khi `:66` bắt dùng helper làm SSOT — implementer **S2** gọi thẳng `heatmapLegendGradient()` tại `PortfolioHeatmap.js:609` cho thống nhất. **Verdict cuối: AGREE (kèm 2 reservation trên).** Không còn objection chặn; gate thực thi vẫn `CHƯA CHẠY` (`plan:109,:116`) — báo đúng sau khi chạy, không suy diễn.

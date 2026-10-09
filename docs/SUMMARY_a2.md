# SUMMARY a2 — S2 (AC-3): `renderRoutePage()` + 6 case h1 + fix 2×h1 trên `/stocks/:symbol`

Slice S2 của `docs/PLAN_UIUX_WAVE4.md` (§2 dòng 158, §3 AC-2.1 … AC-2.5).
Branch `feat/uiux-wave4`. Worker **a2**.

---

## 1. Files changed (đúng 3 file được giao)

| File | Loại | Nội dung |
|---|---|---|
| `packages/web/src/pages/__tests__/render-route-page.tsx` | **MỚI** (74 dòng) | Helper `renderRoutePage({ Component, routePath, entry })` — cây provider đầy đủ dùng chung |
| `packages/web/src/pages/__tests__/page-heading-ac3.component.test.tsx` | **MỚI** (~264 dòng) | 6 case, `toHaveLength(1)`, mọi `await import()` ở **module scope** |
| `packages/web/src/features/stock-detail/components/StockDetailHeader.js` | SỬA 1 dòng | `:76` `e("h1", …)` → `e("h2", …)` + 5 dòng comment giải thích |

Không đụng file nào khác. `git status` xác nhận 3 file trên là file của a2;
các file `playwright.config.ts` / `src/index.css` / `mobile-ergonomics.spec.ts` /
`check-h1-graph.mjs` / `SUMMARY_a1.md` là của agent khác — **không chạm**.

**`StockDetailPage.component.test.tsx` KHÔNG cần sửa.** Đã đọc đủ 197 dòng:
nó import `StockDetailPage` trực tiếp (`:46`) nhưng **không assert `<h1>` ở đâu cả**
(4 case assert `.sdp-premium-header`, `.sdp-price-green/red`, `textContent`,
và 1 case chỉ kiểm adapter là mock). Đã chạy lại để chứng minh — xem §3.

---

## 2. Nguồn `<h1>` — tự dò lại, KHÔNG tin danh sách được giao

Tất cả 6 đều xác minh đúng `file:line`:

| Route (`main.tsx`) | Nguồn h1 | Nhánh sớm **không** có h1? |
|---|---|---|
| `/support` | `SupportPage.tsx:311` `e("h1", …, t('support.pageTitle', …))` | không — `:309` là `return` chính |
| `/transactions` | `TransactionsPage.tsx:194` `e("h1", null, "Giao dịch")` | **CÓ** — `:181` (`portfoliosLoading`) và `:185` (`!portfolioId && portfolios.length === 0`) |
| `/settings` | `UserSettingsPage.tsx:182` `e("h1", null, t("userSettings.title", …))` | **CÓ** — `:170` (`loading`), `:174` (`error`), `:178` (`!form` → `return null`) |
| `/upgrade` | `UpgradePage.tsx:54` `e("h1", { className: "mt-2 text-3xl …" }, …)` | không |
| `/stocks/:symbol` | `WorkstationShell.tsx:53` `e("h1", { id: titleId, className: styles.title }, displayTitle)` | không |
| `/ai-advisory` | `WhaleAdvisoryBentoHeader.js:44` — `'h1'` **nằm trên dòng riêng** trong lời gọi `createElement` | không (`WhaleAdvisoryPage.tsx:336` là `return` chính) |

⇒ Kết luận của plan (`PLAN_UIUX_WAVE4.md:29`, O3) **đúng**: 4/6 tự render,
2/6 qua component con. Comment cũ ở `page-heading-fu02c.component.test.tsx:216-220`
nói *"nạp dữ liệu bất đồng bộ, đếm h1 quá sớm thấy 0, chờ lâu vẫn 0"* cho cả 4 trang
là **sai nguyên nhân** — `UpgradePage` và `SupportPage` không nạp gì cản h1.

### Provider nào là **bắt buộc** (không phải "cho đủ") — tự tra, đều có `throw`

| Provider | Bằng chứng buộc dùng |
|---|---|
| `PortfolioProvider` | `usePortfolio()` **throw** (`PortfolioContext.js:718-721`). Gọi ở thân component: `SupportPage.tsx:46`, `UpgradePage.tsx:16`, `WhaleAdvisoryPage.tsx:101` |
| `LangProvider` | `LangContext.d.ts:22` `useI18n()`. Gọi: `SupportPage.tsx:45`, `UserSettingsPage.tsx:90`, `UpgradePage.tsx:15`, `WhaleAdvisoryBentoHeader.js:15`, `StockDetailHeader.js:36` |
| `ConfirmProvider` | `useConfirm()` **throw** (`ConfirmModal.tsx:18-24`). Gọi: `BrokerSettingsSection.tsx:66` (qua `UserSettingsPage.tsx:5`) và `WhaleAdvisoryPage.tsx:103` |

### Adapter / hook mock từng trang (mỗi cái đều vì một lý do cụ thể)

| Trang | Mock | Vì sao (file:line) |
|---|---|---|
| `TransactionsPage` | `getPortfolios` → `{results:[{id:1,name:"P"}]}` | `TransactionsPage.tsx:67`; nếu trả rỗng thì `:185` rơi vào nhánh **không có h1** |
| | `getTransactions` → `{results:[]}` | `TransactionsPage.tsx:104` |
| `UserSettingsPage` | `getUserProfile` → profile đầy đủ | `UserSettingsPage.tsx:68`; `loading` (`:170`) và `error` (`:174`) đều **không có h1** |
| | `getBrokerProviders` / `getBrokerSchema` / `getBrokerConfig` | `BrokerSettingsSection.tsx:93` / `:106-107` |
| | **`ConfirmProvider`** (helper, không mock) | `BrokerSettingsSection.tsx:66` `useConfirm()` — không có provider là throw |
| `SupportPage` | `listSupportTickets` / `listStaffSupportTickets` / `getSupportTicketDetail` / `getStaffSupportDashboard` | `SupportPage.tsx:81/88/121/139` — không mock thì bắn mạng thật trong jsdom |
| `WhaleAdvisoryPage` | `useWhaleAdvisoryData` (giữ `...actual`) | `useWhaleAdvisoryData.js:327-331` có `setInterval(…, 60000)` ⇒ giữ timer sống hết suite; `:323-325` bắn mạng ngay khi mount |
| `ShellStockDetailPage` | `useStockDetailPageModel` | `StockDetailPage.tsx:5`/`:133` — model thật là hook network lớn |
| | `createCoreApiAdapter` | `StockDetailPage.tsx:14` gọi **ở module scope** ⇒ factory phải sẵn sàng trước khi `ShellStockDetailPage` được import |
| | `workstation/hooks/index.js` → `useOrderBook`/`useTradeLog` | `StockDetailPage.tsx:25`/`:309-311` |
| | `VNStockChartPanel.js` + `WhaleBubbleChart.jsx` → stub | `StockDetailPage.tsx:20,22` — panel echarts nặng, thay đúng như `StockDetailPage.component.test.tsx:31-37` |

### ⚠ Một bẫy thật phát hiện khi làm (không có trong tài liệu nào)

`coreApiAdapter.js:170` là `export const coreApiAdapter = defaultCoreApiAdapter;`
— một **binding riêng**, không phải alias. `page-heading-fu02c.component.test.tsx:69-81`
chỉ override `defaultCoreApiAdapter` ⇒ `TransactionsPage` / `UserSettingsPage` /
`SupportPage` **vẫn gọi adapter thật**. File mới override **cả hai** export.
Đây là lý do một số bản harness cũ "không render ổn định trong jsdom" chứ không
đơn thuần là thiếu provider.

---

## 3. Gates — lệnh + output thật + exit code

Tất cả chạy từ `C:\Mujoco Projects\vninvest\packages\web`.

### 3.1 Test 2 file được giao (AC-2.2)

```
> npx vitest run src/pages/__tests__/page-heading-ac3.component.test.tsx `
    src/features/stock-detail/__tests__/StockDetailPage.component.test.tsx

 Test Files  2 passed (2)
      Tests  11 passed (11)
   Duration  35.76s (transform 2.80s, setup 0ms, import 8.94s, tests 1.54s, environment 56.04s)
EXIT=0
```
(6 case mới + 5 case cũ của `StockDetailPage.component.test.tsx`.)

### 3.2 `tsc` (AC bắt buộc)

```
> npx tsc --noEmit
(no output)
TSC_EXIT=0
```
Lưu ý: `tsconfig.json` có `"exclude": ["src/**/*.test.*", "src/**/*.spec.*"]`
⇒ **2 file test KHÔNG được `tsc` soi**; chỉ `render-route-page.tsx` (không phải
file test) thực sự được type-check. Không được báo "tsc đã kiểm file test".

### 3.3 Lint + các gate tĩnh liên quan (đều exit 0)

| Lệnh | Kết quả | Exit |
|---|---|---|
| `npx eslint src/pages/__tests__/render-route-page.tsx src/pages/__tests__/page-heading-ac3.component.test.tsx src/features/stock-detail/components/StockDetailHeader.js` | không output | **0** |
| `npm run check:stock-detail-shell` | `core-stock-detail shell wiring OK — WorkstationShell variant (P2-1)` | **0** |
| `npm run check:ts-imports` | `✓ PASS (no dangling relative imports)` | **0** |
| `npm run check:dom-landmarks` | `✓ PASS` (4 assert) | **0** |
| `npm run check:contrast` | `✓ PASS (7 tone pairs × 2 modes >= 4.5:1)` | **0** |

`check:contrast` exit 0 là có ý nghĩa: `.sdp-company-name` tự set
`color: var(--color-text-primary)` (`StockDetailPage.css:150`) nên đổi thẻ
`h1`→`h2` **không** đụng màu.

---

## 4. Fail-trước (hazard 10) — bằng CÁCH AN TOÀN (hazard 11, KHÔNG `git checkout --`)

Cả 2 lần đều: copy file ra `$env:TEMP` **trước**, ghi đè, chạy, copy lại,
rồi xác nhận bằng `git status --short` rằng file đã về đúng byte gốc.

### 4.1 Fix 2×h1 — đo trước/sau trên `/stocks/:symbol`

```
$ Copy-Item $p "$env:TEMP\a2_StockDetailHeader.mine.js"     # backup bản đã sửa
$ git show "dev:packages/web/src/features/stock-detail/components/StockDetailHeader.js"
    | Out-File "$env:TEMP\a2_StockDetailHeader.dev.js"
$ Copy-Item "$env:TEMP\a2_StockDetailHeader.dev.js" $p      # ghi đè bản dev (h1)
  → line 76: : e("h1", { className: "sdp-company-name" }, companyName),

$ npx vitest run src/pages/__tests__/page-heading-ac3.component.test.tsx -t "ShellStockDetailPage"

 ❯ page-heading-ac3.component.test.tsx (6 tests | 1 failed | 5 skipped) 673ms
   × ShellStockDetailPage (/stocks/:symbol) — WorkstationShell.tsx:53 là h1 DUY NHẤT

 FAIL  … > AC-3 — 6 route chỉ được có ĐÚNG 1 h1 > ShellStockDetailPage …
 AssertionError: expected [ …(2) ] to have a length of 1 but got 2
 - Expected
 + Received
 - 1
 + 2
  ❯ src/pages/__tests__/page-heading-ac3.component.test.tsx:256:16

 Test Files  1 failed (1)
      Tests  1 failed | 5 skipped (6)
EXIT=1
```

**Đo được: 2 `<h1>` trước khi sửa.** Khôi phục bản của tôi:
`git diff -- StockDetailHeader.js` = **1 hunk, `6 insertions(+), 1 deletion(-)`**
(5 dòng là comment giải thích). Chạy lại §3.1 ⇒ **11/11 PASS, exit 0**.

### 4.2 Chính cái guard — bỏ h1 khỏi 1 trang

```
$ Copy-Item src/pages/UpgradePage.tsx "$env:TEMP\a2_UpgradePage.mine.tsx"
$ (Get-Content … -Raw) -replace 'e\("h1", { className: "mt-2 text-3xl …" }, …'
                                  -replace 'e("p",  { className: "mt-2 text-3xl …" }, …' | Set-Content …
  h1 count before tamper = 1 ; after = 0

$ npx vitest run src/pages/__tests__/page-heading-ac3.component.test.tsx -t "UpgradePage"

   × UpgradePage (/upgrade) — h1 ngay trong file, UpgradePage.tsx:54 143ms
 FAIL  … > AC-3 — 6 route chỉ được có ĐÚNG 1 h1 > UpgradePage …
 AssertionError: expected [] to have a length of 1 but got +0
 - Expected
 + Received
 - 1
 + 0
  ❯ src/pages/__tests__/page-heading-ac3.component.test.tsx:209:16

 Test Files  1 failed (1)
      Tests  1 failed | 5 skipped (6)
EXIT=1
```

**Đo được: 0 `<h1>` khi bỏ h1.** Đây chính là case mà `toBeLessThanOrEqual(1)`
sẽ **pass im lặng** — bằng chứng thực nghiệm cho AC-2.2.
Khôi phục xong: `git status --short -- packages/web/src/pages/UpgradePage.tsx`
→ **rỗng** (byte-identical với HEAD).

### 4.3 Vì sao 2 lần fail-trước này đáng tin

Không chỉ "file sửa thì test đỏ". Lần 4.1 bỏ **fix** ⇒ đỏ vì **2** h1;
lần 4.2 bỏ **h1 của trang khác** ⇒ đỏ vì **0** h1. Hai nguyên nhân độc lập,
cùng một assertion, cùng exit 1. Test bắt được cả "thêm h1 thứ hai" lẫn "mất h1".

---

## 5. `CHƯA CHẠY` (kèm lý do)

| Việc | Lý do |
|---|---|
| `npm run test:components` (full 117 file) | **Cấm theo lệnh supervisor** — agent khác đang sửa file trong cùng working tree; kết quả sẽ lẫn lộn. Đã chạy đúng 2 file được giao. |
| `npm run build` (`tsc && vite build`) | Không chạy `tsc` phần `vite build` — cùng lý do trên (build đọc cả `src/index.css` của a1). Phần `tsc` **đã chạy, exit 0**. |
| `npm run lint` (toàn bộ `src`) | Cùng lý do. Đã chạy `npx eslint` **đúng 3 file của tôi**, exit 0. |
| `node docs/audit-uiux/scripts/scan-ui-guidelines.mjs` + `check-uiux-budget` | **Cấm** (3–5 phút, `PLAN_UIUX_WAVE4.md:127`). Không liên quan: tôi không đổi CSS/comment `.js` nào ngoài 1 dòng tag. |
| Playwright / visual | Ngoài scope S2 (thuộc S1 của a1). |
| `docs/CODE_CHANGE_AUDIT_LEDGER.md` — append Entry | **`AGENTS.md` yêu cầu ledger cho mọi thay đổi, nhưng file này KHÔNG nằm trong 3 file tôi được giao** và đang là việc chung của cả wave ⇒ **cố ý KHÔNG làm, giao lại supervisor.** Xem §7. |

---

## 6. Risks

1. **Thấp — đổi thẻ `h1`→`h2` không đổi hiển thị.** Đã tự kiểm
   `StockDetailPage.css:150`: `.sdp-company-name` set `margin: 0`,
   `font-size: 1.25rem`, `font-weight: 700`, `color: var(--color-text-primary)`,
   `line-height: 1.3` — **đủ 5 thuộc tính** UA cần cho `h1`. Có thêm media query
   `.sdp-company-name` ở `StockDetailPage.css:2846` (cũng theo class, không theo tag).
   `check:contrast` exit 0.
2. **Thấp — không có ngữ cảnh nào mất h1.** Đã grep toàn repo: `StockDetailHeader`
   dùng ở **đúng 1 chỗ** (`StockDetailPage.tsx:330`); `StockDetailPage` chỉ được
   mount bởi `ShellStockDetailPage.js:35`, và loader duy nhất tới shell là
   `pageRegistry.js:235` → route `main.tsx:181` (`/stocks/:symbol`).
3. **Cần supervisor biết — `src/index.js:32` re-export `StockDetailPage` trong
   barrel công khai.** Đã grep `packages/**` — **không package nào** trong monorepo
   import nó, và trong `packages/web` chỉ có `ShellStockDetailPage.js:35` +
   `StockDetailPage.component.test.tsx:46`. Nhưng đây là **API export công khai**:
   nếu về sau có consumer bên ngoài render `StockDetailPage` **không** qua
   `WorkstationShell` thì trang đó sẽ **mất h1**. Không sửa được ở S2 (ngoài 3 file).
   Nên mở ticket nốt `src/index.js` hoặc bỏ export đó.
4. **Thấp — flake.** 2 trang có nhánh sớm không h1 nên dùng
   `waitFor(…, { timeout: 4000 })` thay vì assert đồng bộ. Đây là **settle race**,
   không phải nâng timeout (khác hẳn `page-heading-fu02c:168-174`). Mọi
   `await import()` nằm ở module scope nên không ăn budget của test nào
   (nguyên nhân flake 27.5 s > 20 s). Chạy 2 file: `import 8.94 s` tổng cho 11 test.
5. **Tranh chấp working tree — đã tránh.** Không `git add/commit/stash/checkout/restore`
   (đúng như lệnh dặn); mọi thao tác fail-trước đều đi qua `$env:TEMP` + `Copy-Item`,
   và mỗi lần đều verify `git status` sạch trở lại.

---

## 7. Một bài học quy trình

**Một test đỏ KHÔNG tự chứng minh nó đáng tin — phải đỏ với *hai* nguyên nhân
đối nghịch trước khi tính là fail-before hợp lệ.**

Ở đây nếu tôi chỉ làm 1 phép fail-trước thì dễ dỗ lỗi nhầm:
lần 4.1 đỏ vì **2 h1** (thừa) — chứng minh guard bắt "thêm h1 lần 2";
lần 4.2 đỏ vì **0 h1** (thiếu) — chứng minh `toHaveLength(1)` khác hẳn
`toBeLessThanOrEqual(1)` ở chỗ quan trọng nhất. Một phép duy nhất chỉ chứng minh
"assertion nhạy cảm", không chứng minh "assertion **đúng**". Trong đợt này còn
thêm một bẫy tương tự: nếu tôi tin danh sách "cần mock `getPortfolios`" mà
không đọc `TransactionsPage.tsx:181-190`, tôi sẽ viết test **xanh** trong khi
trang thực tế rơi vào nhánh không có h1 — xanh giả, đúng thứ mà comment cũ
`page-heading-fu02c:221-222` cảnh báo.

Nói cách khác: **"fail trước" phải được đo bằng con số (2 vs 1, 0 vs 1), không
bằng màu đỏ.** Số đo là thứ khiến người đọc biết test đang bảo vệ điều gì.

# PLAN — UI/UX wave 4: đóng nốt việc dở của wave 3 + 2 major audit Stage 5

- **Nhánh**: `feat/uiux-wave4` (từ `dev` @ `ea0002d00`)
- **Ngày**: 2026-10-09 · **Bản**: **rev 2** — sau Stage 2 audit (2 vòng, cả 2 đều `NEED_REVISION`)
- **Quy trình**: `multi-agent-workflow` — **Mode A (3 worker + 1 supervisor)**
- **Đo tại**: cwd = repo root, **trừ** dòng nào ghi `cd packages/web`

> Mọi trích dẫn `file:line` là **số dòng thật**, đọc bằng công cụ biết UTF-8.
> Mọi số đo kèm **lệnh tái lập** (giữ AC-3.3 của wave 3).

---

## 0. ĐÁP ỨNG 2 VÒNG STAGE 2

Hai auditor **độc lập**, đều trả `NEED_REVISION`, `confidence: high`:
`docs/PLAN_AUDIT_UIUX_WAVE4.md` (**O1–O5**, 2 blocker + 3 major) và
`docs/PLAN_AUDIT2_UIUX_WAVE4.md` (**11 blocker + 14 major**).

⚠ **Số NAV-1 ở rev 1 SAI.** Auditor 2 đã refute bằng dữ liệu thật; tôi tự kiểm
lại trên đĩa trước khi nhận — **đúng, tôi sai**. Ghi lại vì đây là bài học lặp lại
lần thứ 2 trong wave này.

### 0.A Bảng đóng objection

| # | Nguồn | Mức | Nội dung | Xử lý ở rev 2 |
|---|---|---|---|---|
| **O1** | A1 | blocker | `vite.config.ts` **không có** `build.rollupOptions.input` (chỉ có `output.manualChunks`) | §3 AC-3.1: entry = **`index.html:27`** (`<script type="module" src="/src/main.tsx">`) — đây *là* input của Vite. Đọc `index.html` từ `root` trong config, không hardcode |
| **O2** | A1 | blocker | `src/app/pageRegistry.js` **không tồn tại** | → **`src/pages/pageRegistry.js:235`** (grep xác nhận) |
| **O3** | A1 | major | Chỉ **2/6** trang lấy h1 từ `WorkstationShell`/`WhaleAdvisoryBentoHeader`; 4 trang có `e("h1",…)` riêng | §3 AC-2.1 liệt kê nguồn h1 **từng trang** (đã tự dò: `SupportPage.tsx:311` · `TransactionsPage.tsx:194` · `UserSettingsPage.tsx:182` · `UpgradePage.tsx:54`) |
| **O4** | A1 | major | AC-4.3 nói 111 còn AC-4.8 nói "99→94" ⇒ **STOP #2 khai hoang** | §0.3 + §5.2 dùng **một** con số: `108 → 104` |
| **O5** | A1 | major | ≥6/12 hit lộ ra là **false positive** ⇒ nâng baseline sẽ "thánh thiện hóa" nợ bẩn | §3 AC-4.6: **bảng lý do từng hit lộ ra**, giữ nguyên trong gate (không xoá bằng nới rule) |
| **O6** | A2 | **blocker** | **`111` sai.** Regex NAV-1 cần **định danh** ngay sau `[`, mà **mọi** call site `useUrlState` đều destructure **bản ghi**: `const [{…}, setUrlState] = …` ⇒ rule **không nhìn thấy** call site nào. Chỉ `useUrlValue("key",…)` nhìn thấy: đúng **3** site, cả 3 ở `CampaignTable.jsx:64,75,89` | §0.2 số đúng = **108**. Tôi đã tự grep xác nhận: 7 file dùng `useUrlState` đều destructure `{`, **0 hit** ⇒ escape cấp file hiện tại **không giúp ích file nào đã sửa** |
| **O7** | A2 | **blocker** | S1: 22/22 control đo được đều **≤ 38.4 px** ⇒ AC 44×44 **không bao giờ xanh** nếu S1 chỉ sửa comment | §2 S1 **mở rộng**: thêm sửa CSS thật. Xem §0.3-D |
| **O8** | A2 | blocker | `dist` bị gitignore, **0 file tracked** ⇒ worktree sạch không có `dist`, `vite preview` fail | §0.4: wave 4 chạy ở **main tree** (`dist` đã có, `Test-Path` = True). Ghi `CHƯA CHẠY` cho người chạy trên worktree sạch |
| **O9** | A2 | **blocker** | `ShellStockDetailPage` render **2 `<h1>`** ⇒ AC-2.2 `toHaveLength(1)` **bắt buộc** sửa code sản phẩm, vi phạm AC-2.3 | **Đây là finding thật, không phải lỗi harness.** Tôi đã tự xác minh chuỗi: `ShellStockDetailPage.js:32-36` bọc `StockDetailPage` trong `WorkstationShell` (`title`) → `WorkstationShell.tsx:53` render `h1`; `StockDetailPage.tsx:330` → `StockDetailHeader.js:76` render `e("h1", …)` **thêm nữa**. Xem §0.3-C |
| **O10** | A2 | major | `TransactionsPage` cần mock `getPortfolios`; `UserSettingsPage` cần `getUserProfile` + `ConfirmProvider` | §3 AC-2.2 liệt kê từng mock bắt buộc |
| **O11** | A2 | major | AC-1.2(i) (`scrollWidth`) **đã pass sẵn** ⇒ "fail-trước" sai cho tiêu chí này | §3 AC-1.3: chỉ AC-1.2(ii) yêu cầu fail-trước; (i) ghi rõ là **guard chống hồi quy** (không tính là tiến bộ) |
| **O12** | A2 | major | AC-4.7 (`replace`) **không quan sát được** — `RouterState` không có history index, `@remix-run/router` không phải dep trực tiếp | §3 AC-4.7: quan sát bằng **spy lên `setParams`** (assert `{replace:true}`), không đòi lịch sử trình duyệt |
| **O13** | A2 | major | 12/99 hit chỉ khớp vì nhánh regex `\|q` ⇒ `quantity`/`quota`/`quotesBySymbol`/`selectedRequestId` là **hiện tượng regex**, không phải bộ lọc | §0.3-B: danh sách "sửa được" rút từ 5 → **4** |
| **O14** | A1 | minor | "211 s" **không tái lập được** (đo 311.7 s) | §1 ghi "≈3–5 phút, đo 211 s và 312 s ở 2 lần" |
| **O15** | A1 | minor | `nav1-report.mjs` được §0.1 viện dẫn nhưng **chưa tồn tại** | §0.2 ghi rõ: số đo bằng reimplementation độc lập, **2 auditor tái lập khớp**; script là deliverable của S4 |
| **O16** | A1 | minor | `npx tsc --noEmit` **từ repo root** exit 1 (sai binary) | §1: mọi lệnh npm/tsc ghi rõ `cd packages/web` |

### 0.B Số NAV-1 ĐÚNG (rev 2)

Đo bằng reimplementation độc lập của rule, **tác giả plan + 2 auditor** đều ra
cùng con số:

| Số | Ý nghĩa | Giá trị |
|---|---|---|
| `counted` | NAV-1 gate đếm hôm nay (escape cấp file che) | **99** |
| `suppressed` | hit bị escape cấp file ẩn | **12** |
| — | escape **cấp biến** đúng sẽ bỏ 3 hit (3 call site `useUrlValue` thật) | **−3** |
| **`counted` sau khi sửa rule** | | **108** |
| — | sửa 4 bản ghi `filters` trong 4 file P1 | **−4** |
| **`counted` cuối wave 4** | | **104** |

⇒ `TONG` 172 → **181** (172 + 12 − 3) rồi → **177** sau khi sửa 4 `filters`.

**Bằng chứng escape cấp file vô dụng**: 7 file dùng `useUrlState`
(`CoreDashboardPositionDeck.tsx:76` · `FactsFirstModularPositionDeck.jsx:38` ·
`PortfolioHoldingsPage.tsx:96` · `TenantAdminMembersPage.tsx:87` ·
`AdminBillingFleetPage.tsx:34` · `AdminAuditPage.tsx:44` ·
`AdminCoreTenantsPage.tsx:32`) — tất cả destructure `{` ⇒ regex không khớp ⇒
**0 hit NAV-1** ⇒ **không file nào đã sửa cần escape**. Escape chỉ che 12 hit ở 7
file khác, trong đó **không file nào** dùng `useUrlState`.

### 0.3 AC-2.4 (rev 4) — thay `PLAN_UIUX_WAVE3.md:482`

> **(a)** `counted` **99 → 94** không phải mục tiêu; mục tiêu là
> **108 → 104** (sau khi siết rule). Giảm **≥ 4**.
> **(b)** **7 hit cố ý không đồng bộ URL**, liệt kê tường minh, **không** xoá bằng
> cách làm yếu gate:
> - 5 `*Draft` — `AdminCoreAuditTracePage.tsx:68` · `AdminCoreJobsPage.tsx:52` ·
>   `AdminCorePATsPage.tsx:25` · `AdminCoreServiceAccountsPage.tsx:23` ·
>   `AdminCoreTenantsPage.tsx:27`
> - 2 ô nhập trong form — `AdvisoryOrderTicket.js:14` · `DNSEConnectionPanel.js:78`
> **(c)** `check-uiux-budget` exit 0 với baseline **nâng** lên `NAV-1 = 108`,
> `TONG = 181`.
> **(d)** Bỏ hẳn "≥ 26": ceiling thật = **4** (chỉ 4 bản ghi `filters`).
> `selectedRequestId` **không** sửa được vì khớp regex nhờ nhánh `q` — nó **không
> phải** bộ lọc (đây là lý do rev 1 tính sai).

### 0.3-B Danh sách "sửa được" — chỉ 4

| File | Biến | Vì sao sửa được |
|---|---|---|
| `AdminCoreAuditTracePage.tsx:69` | `filters` | bản ghi phẳng 7 field, áp dụng bằng nút |
| `AdminCoreJobsPage.tsx:53` | `filters` | 5 field |
| `AdminCorePATsPage.tsx:32` | `filters` | bản ghi phẳng |
| `AdminCoreServiceAccountsPage.tsx:30` | `filters` | bản ghi phẳng |

`AdminCoreAuditTracePage.tsx:71 selectedRequestId` — **không** sửa (O13).

### 0.3-C Phát hiện mới: `/stocks/:symbol` có **2 `<h1>`** (O9)

Đây là **lỗi thật**, không phải lỗi harness — đúng thứ bộ test phòng thủ sinh ra
để bắt. Chuỗi đã tự xác minh:

```
ShellStockDetailPage.js:32-36   WorkstationShell(title=symbol) > StockDetailPage
  WorkstationShell.tsx:53        e("h1", …, displayTitle)
    StockDetailPage.tsx:330     e(StockDetailHeader, …)
      StockDetailHeader.js:76   e("h1", { className:"sdp-company-name" }, companyName)
```

`StockDetailHeader` chỉ dùng ở **đúng 1 chỗ** (`StockDetailPage.tsx:330`), và
`StockDetailPage` chỉ được route bọc qua `ShellStockDetailPage`
(`pageRegistry.js:235`). `.sdp-company-name` (`StockDetailPage.css:150`) set **đủ**
`margin/font-size/font-weight/color/line-height` ⇒ đổi thẻ **không đổi hiển thị**.

⇒ **Fix: `h1` → `h2`.** Đây là **ngoại lệ duy nhất** của non-goal "không sửa code
sản phẩm", do nó là **defect a11y** (WCAG 2.4.6) và do chính AC-2.2 phát hiện.

### 0.3-D S1: AC 44×44 cần sửa CSS thật (O7)

Auditor đo 22/22 control ≤ 38.4 px. ⇒ Không thể chỉ sửa comment. Fix: thêm
`@media (pointer: coarse)` trong `src/index.css` đặt `min-height: 44px` cho **đúng
danh sách control** đã khai ở `:777-787`. Chọn `pointer: coarse` (không phải
`max-width`) để **không** đụng desktop. S1 phải chứng minh **fail-trước** bằng
cách an toàn (hazard 11).

---

## 1. BẢNG BASELINE — đo thật ở `dev` @ `ea0002d00` (hazard 6 + 9)

⚠ **`scan-ui-guidelines.mjs` chạy 3–5 PHÚT.** Đo 2 lần: **211 s** và **312 s**
(tùy tải máy). Nguyên nhân: `selectorName` (`scan-ui-guidelines.mjs:348-357`) chạy
regex O(40·n) **cho từng dòng của mọi file CSS**. **Không phải treo** — đừng
timeout 30 s rồi kết luận "script hỏng" (suýt vậy).

| # | Lệnh (đúng như sẽ chạy) | Exit | Kết quả |
|---|---|---|---|
| G1 | `node docs/audit-uiux/scripts/scan-ui-guidelines.mjs packages/web/src` | 0 | `TONG = 172  P0=0 P1=107 P2=63 P3=2` |
| G2 | `node packages/web/scripts/check-uiux-budget.mjs` | 0 | baseline 246 → 172 (−74) · **3–5 phút** |
| G3 | `node packages/web/scripts/check-uiux-budget.mjs --self-test` | 0 | 1 trường hợp tăng bị bắt |
| G4 | `node docs/audit-uiux/scripts/check-ledger-entry.mjs` | 0 | 59 nhóm trùng cũ, cảnh báo |
| G5 | `node docs/audit-uiux/scripts/check-ledger-entry.mjs --next-entry` | 0 | in **257** |
| G6 | `node packages/web/scripts/check-multi-agent.mjs` | 0 | + ~66 cảnh báo claim cũ |
| G7–G13 | `cd packages/web` + `check:tokens` `check:contrast` `check:dom-landmarks` `check:ts-imports` `check:i18n-hardcoded` `check:admin-spa-routes` `check:shell` | 0 | |
| G14 | `cd packages/web && npx tsc --noEmit` | 0 | ⚠ **phải `cd`** — từ repo root dùng nhầm binary, exit 1 |
| G15 | `cd packages/web && npm run lint` | 0 | 3743 problems / **0 error** |
| G16 | `cd packages/web && npm run test:components` | 0 | **117 file / 817 test** |
| G17 | `cd packages/web && npm run build` | 0 | |
| G18 | `cd packages/web && npm run test:visual --project=mobile-ergonomics` | **CHƯA CHẠY** | project chưa tồn tại — S1 tạo |
| G19 | `python manage.py makemigrations --check --dry-run` | **N/A** | 0 file `.py` trong wave này |

**Phạm vi hứa PASS**: G1–G17, G19. **G18** chỉ hứa sau khi S1 xong; trước đó
`CHƯA CHẠY` (hazard 4).

---

## 2. SLICE — file set **rời nhau**

| Slice | Nội dung | File | Worker |
|---|---|---|---|
| **S1** | Mobile: project Playwright + spec + **CSS 44 px thật** + comment | `packages/web/playwright.config.ts` · `packages/web/tests/visual/mobile-ergonomics.spec.ts` **(mới)** · `packages/web/src/index.css` | a1 |
| **S2** | AC-3: `renderRoutePage()` + 6 case + **fix 2×h1** | `packages/web/src/pages/__tests__/render-route-page.tsx` **(mới)** · `packages/web/src/pages/__tests__/page-heading-ac3.component.test.tsx` **(mới)** · `packages/web/src/features/stock-detail/components/StockDetailHeader.js` | a2 |
| **S3** | AC-4: `check-h1-graph.mjs` | `docs/audit-uiux/scripts/check-h1-graph.mjs` **(mới)** + `docs/audit-uiux/scripts/__fixtures__/` **(mới)** | a3 |
| **S4** | Major 1 + Major 2 + `useUrlRecord` + 4 file P1 | `docs/audit-uiux/scripts/scan-ui-guidelines.mjs` · `docs/audit-uiux/scripts/nav1-report.mjs` **(mới)** · `packages/web/scripts/uiux-baseline.json` · `packages/web/src/hooks/useUrlState.ts` · `packages/web/src/hooks/useUrlRecord.ts` **(mới)** · `packages/web/src/hooks/__tests__/*` · 4 file `pages/admin/AdminCore{AuditTrace,Jobs,PATs,ServiceAccounts}Page.tsx` | **supervisor** |
| **S5** | Sửa 2 chỗ sai TEST_REPORT wave 2 | `docs/TEST_REPORT_UIUX_WAVE2.md` | a2 (sau S2) |

Không file nào nằm trong 2 slice. S1 đụng `src/index.css`; S4 đụng `src/hooks/` +
`pages/admin/` — không giao.

---

## 3. AC THEO SLICE

### S1 — Mobile

- **AC-1.1** project `mobile-ergonomics`: **không** `dependencies`,
  `storageState: { cookies: [], origins: [] }`, `browserName: 'chromium'`
  tường minh, `viewport 393×851`, `hasTouch: true`,
  **`testMatch: /mobile-ergonomics\.spec\.ts/`** (thiếu nó ⇒ nhận cả 18 spec
  chụp có-auth và đỏ sai lý do).
- **AC-1.2** spec đo trên **route công khai** (`main.tsx` khai ngoài
  `ProtectedRoute`): (i) `documentElement.scrollWidth <= window.innerWidth`;
  (ii) control tương tác chính ≥ **44×44 px**.
- **AC-1.3** **Fail-trước chỉ bắt buộc cho (ii)** — auditor đo (i) **đã pass sẵn**
  ⇒ (i) là **guard chống hồi quy**, **không tính là tiến bộ**. Cách làm an toàn
  (hazard 11): copy ra `%TEMP%` → `git show dev:<file> > <file>` → chạy → copy lại.
  **KHÔNG** `git checkout --`.
- **AC-1.4** `src/index.css`: thêm `@media (pointer: coarse)` đặt `min-height: 44px`
  cho danh sách control ở `:777-787` (§0.3-D). Sửa comment `:763-768` đã lỗi thời
  (nói "= 0, không cần media query" trong khi `:777-806` đã khai cả 3).
- **AC-1.5** Không hứa `env(safe-area-inset-*)` khác 0 — headless không notch.
- **AC-1.6** `CHƯA CHẠY`: thiết bị thật · notch · Safari iOS · focus ring chạm
  thật · tốc độ cuộn thật · `webkit`/`firefox` (không cài) · **worktree sạch không
  có `dist`** (`dist` gitignored, 0 file tracked ⇒ `vite preview` fail; wave 4
  chạy ở main tree nên `dist` có sẵn).

### S2 — AC-3

- **AC-2.1** `renderRoutePage()` **dùng chung**. Nguồn `<h1>` **từng trang** (đã dò):
  `SupportPage.tsx:311` · `TransactionsPage.tsx:194` · `UserSettingsPage.tsx:182` ·
  `UpgradePage.tsx:54` (tự render) · `ShellStockDetailPage` → `WorkstationShell.tsx:53` ·
  `WhaleAdvisoryPage` → `WhaleAdvisoryBentoHeader.js:44`.
- **AC-2.2** 6 case, **`toHaveLength(1)`** — **không** `toBeLessThanOrEqual(1)`
  (`≤1` pass khi **0**). Mock **bắt buộc**: `TransactionsPage` → `getPortfolios`;
  `UserSettingsPage` → `getUserProfile` + `ConfirmProvider`
  (`BrokerSettingsSection.tsx:66`).
- **AC-2.3** `StockDetailHeader.js:76` `h1` → `h2` (§0.3-C). Phải kèm **assert**
  trong test để chứng minh trước đó là 2, sau là 1 (hazard 10).
- **AC-2.4** `await import()` ở **module scope** (nguyên nhân flake 27.5 s > 20 s).
- **AC-2.5** **Fail-trước**: bỏ h1 khỏi 1 trang ⇒ đỏ. An toàn (không `git checkout --`).

### S3 — AC-4

- **AC-3.1** entry = `index.html:27` `<script type="module" src="/src/main.tsx">`,
  đọc `root` từ `vite.config.ts`; **không** `build.rollupOptions.input` (O1),
  **không** từ doc, **không** từ tên file (hazard 7).
- **AC-3.2** alias `@/` → `src/`; đi **transitive**.
- **AC-3.3** dò `<h1` + `createElement("h1",…)` + dạng nhiều dòng
  (`WhaleAdvisoryBentoHeader.js:44`).
- **AC-3.4** `--json` + `--self-test` âm (fixture tự chứa trong `__fixtures__/`).
- **AC-3.5** **Bắt buộc** in phần **động** (`e(tag,…)` với `tag` không literal).
- **AC-3.6** đối chiếu **`src/pages/pageRegistry.js`** (O2). **KHÔNG** glob
  `Portfolio*Page.tsx` — glob khớp 6 file **kể cả** `PortfolioWorkspacePage.tsx`
  là entry thật (O11 của A2). Liệt kê tường minh.

### S4 — Major 1 + Major 2 + `useUrlRecord`

- **AC-4.1** **Major 1** — bỏ `fileHasUrlSync` cấp file. Escape **cấp biến**, chỉ
  trên **dòng không phải comment**, neo vào **call site** (không thu thập key cả
  file — nếu thu cả file thì `FactsFirstModularPositionDeck.jsx:47 selectedSymbol`
  bị che oan). Dạng nhận biết duy nhất đã kiểm: `useUrlValue("<key>", …)` →
  biến destructure ở **cùng dòng** với tên biến đó.
- **AC-4.2** **self-test âm** cho rule NAV-1: (a) **comment** chứa tên hook **không**
  che hit; (b) file gọi hook cho biến A **không** che hit biến B. Chưa thấy đỏ
  ⇒ coi như gate chưa kiểm chứng.
- **AC-4.3** `counted` sau đổi rule **= 108**, `TONG` **= 181**. Nếu ≠ ⇒ **dừng**.
- **AC-4.4** `useUrlRecord(spec, defaults, prefix)` — primitive cho **bản ghi phẳng
  nhiều field có tiền tố**. Cùng file `useUrlState.ts`.
- **AC-4.5** test **identity**: 2 render liên tiếp cùng URL ⇒ `value` **cùng tham
  chiếu** (bug `boolCodec` đã xảy ra 1 lần — `spec` literal trong render).
- **AC-4.6** AC-4.3 + sửa 4 `filters` **cùng một commit**: baseline **108**,
  `current` **104**. Commit message nêu *"baseline NÂNG vì siết rule, không phải vì
  nới"* + **bảng lý do từng hit lộ ra** (O5).
- **AC-4.7** `*Draft` **giữ nguyên local** (loop `useEffect` — `useUrlState.ts:9-11`).
- **AC-4.8** **Major 2** — thêm tuỳ chọn `replace`; **mặc định giữ `false`** (không
  đổi hành vi hiện tại). Ô nhập văn bản truyền `replace: true`.
  **Quan sát bằng spy `setParams`**, assert `{replace:true}` — **không** đòi lịch sử
  trình duyệt (O12: `RouterState` không có history index).

### S5

- **AC-5.1** `TEST_REPORT_UIUX_WAVE2.md:36` — file lỗi lint: `FactsFirstWhaleBubbleChart.jsx`
  → **`src/components/OrderFlowRadarPanel.js`**.
- **AC-5.2** `TEST_REPORT_UIUX_WAVE2.md:25` — ghi `exit 0, 116/804`; thật **exit 1,
  2 failed / 802**, và **không tái lập được**. Ghi đúng "không ổn định".

---

## 4. NON-GOALS

1. **KHÔNG** sửa NAV-1 ngoài 4 file P1 (12 hit lộ ra **chỉ để lộ**, không sửa).
2. **KHÔNG** đổi tên `filtersDraft`/`searchDraft` để né regex.
3. **KHÔNG** sửa `CSS-2` (46 hit), `A11Y-2/4/5/7/8/10/11`, `TYPO-3`, `I18N-1`, `PERF-1`.
4. **KHÔNG** đụng 3710 lint warning — chỉ giữ **0 error**.
5. **KHÔNG** thêm dependency, **KHÔNG** thêm npm script vào `packages/web/package.json`.
6. **KHÔNG** chạy `npm install` / `pip install` / `npx playwright install`.
7. **KHÔNG** tạo migration ⇒ G19 N/A.
8. **KHÔNG** sửa `soc.module.css` / `soc.components.css` / `soc.tokens.css`.
9. **KHÔNG** commit 9 file deny-list. Ledger **KHÔNG** còn trong deny-list từ
   2026-10-03 ⇒ **ĐƯỢC** append.
10. **KHÔNG** `git add .` / `-A` / `git commit -a`.
11. **KHÔNG** sửa 18 `*.spec.ts` chụp có-auth trong `tests/visual/`.
12. **KHÔNG** tối ưu tốc độ scanner (`selectorName`) — ngoài phạm vi; chỉ ghi nhận.

---

## 5. ĐIỀU KIỆN DỪNG

1. `check-uiux-budget` fail vì rule **khác** NAV-1 ⇒ dừng, báo.
2. Sau khi sửa rule mà `NAV-1 counted ≠ 108` ⇒ **dừng** (escape cấp biến sai).
3. `test:components` đỏ ở commit không liên quan ⇒ dừng, tìm root cause.
4. AC pass mà diff **không có** thay đổi liên quan ⇒ coi như AC rác.
5. G18 đỏ vì auth chứ không vì 2 tiêu chí ⇒ dừng, kiểm `testMatch`.
6. Cần số Entry mới ⇒ `check-ledger-entry.mjs --next-entry`.
7. `git add` bất kỳ lần nào có file deny-list ⇒ `git restore --staged`, dừng.
8. `git status --short` trong main tree **có** `docs/CODE_CHANGE_AUDIT_LEDGER.md`
   bị sửa bởi người khác ⇒ dừng ghi ledger, báo Owner.
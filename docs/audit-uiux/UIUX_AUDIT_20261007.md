# AUDIT UI/UX TOÀN DIỆN — vninvest web app

> **CẬP NHẬT sau đợt cải tiến (`feat/uiux-improvement`)** — xem mục 9.
> Kết quả đo được: **327 → 246** (P0=0 · P1=123 · P2=121 · P3=2), không rule nào tăng.

- **Ngày**: 2026-10-07
- **Phạm vi**: `packages/web/src` — 454 file · **49 route** · **75 page** (không tính file test)
- **Base**: `dev@3adcdd428`
- **Nguồn tiêu chí** (3 skill đã cài vào `.agents/skills/`):
  1. `web-design-guidelines` (vercel) — bảng 40+ luật: A11y · Focus · Form · Animation · Typography · Content · Images · Performance · Navigation & State · Touch · Dark Mode · i18n · Hydration · Hover · Copy · anti-pattern
  2. `fixing-accessibility` (ibelick) — 9 nhóm theo thứ tự ưu tiên, **tool boundaries = critical**
  3. `ui-skills-root` (ibelick) + 6 skill con — định tuyến chọn skill nhỏ nhất hữu ích
- **Tái lập**: `node docs/audit-uiux/scripts/scan-ui-guidelines.mjs packages/web/src`

---

## 0. PHƯƠNG PHÁP — VÀ MỘT SỰ THẬT PHẢI NÓI TRƯỚC

Lần chạy đầu của scanner trả **1.535 hit thô**. Đọc kỹ thì **phần lớn là false positive**:

| Nguyên nhân nhiễu | Ví dụ | Đã lọc bằng |
|---|---|---|
| Comment/JSDoc chứa `...` | `workspace.js:224` `PortfolioEquityCurveView().get(...)` | `isCommentLine()` |
| Regex loading-state khớp `setLoading(true)` | 526 hit vô nghĩa | viết lại regex theo chuỗi hiển thị |
| `outline-none` **đã có** `focus:` thay thế | `AIAuditLogsPanel.tsx:125` có `focus:border-cyan-500` | kiểm tra ngữ cảnh ±8 dòng |
| `<Input>` là component, label ở component khác | 106 hit | bỏ qua wrapper, quét `<label>` ±6 dòng |

⇒ Báo cáo này dùng **327** (không phải 1.535). Bài học: một con số không kèm
đường lọc là con số vô dụng.

**Giới hạn của phương pháp này**: script chỉ đếm được **mẫu văn bản**. Nó không
biết `placeholder` có cho đủ ngữ cảnh không, không biết label đọc lên có đúng
không, không biết bố cục có hợp lý không. Mọi mục dưới đây đều là **nghi vấn có
bằng chứng `file:line`**, không phải kết luận cuối. Phần cần đọc hiểu được đánh
dấu riêng ở mục 5.

---

## 1. KẾT QUẢ TỔNG

```
TONG = 327     P0=0   P1=176   P2=149   P3=2
```

| Mức | Số | Định nghĩa |
|---|---|---|
| **P0** | **0** | Không có lỗi chặn người dùng không dùng được (không tên truy cập, không điều khiển bằng bàn phím) |
| **P1** | 176 | Lỗi trải nghiệm thật, sửa theo lô |
| **P2** | 149 | Lỗi ổn định/a11y mức thấp |
| **P3** | 2 | Đội hình chữ, dễ sửa |

**Điểm tốt nhất**: **0 P0**. Mọi button có tên truy cập, không có `tabindex > 0`,
không có `user-scalable=no`, không chặn paste, không `transition: all` chặn tương
tác. Nền tảng a11y của repo **đúng**.

---

## 2. BẢN ĐỒ APP (đo từ `routeCatalog.js`)

```
TONG ROUTE = 49
theo group: {"admin":32, "workspace":7, "system":5, "signals":3, "market":1, "vip-local":1}
```

| Nhóm | Số | Route tiêu biểu | Người dùng |
|---|---|---|---|
| **admin** | 32 | `/admin/users` `/admin/billing` `/admin/audit` `/admin/analytics` `/admin/tenants` `/admin/jobs` `/admin/audit-trace` + 9 trang `/tenant-admin/*` + `/operations-center*` | operator (staff) |
| **workspace** | 7 | `/portfolios` + 5 tab `/portfolios/:id/{overview,holdings,allocation,analytics,activity}` + `/transactions` | end-user |
| **system** | 5 | `/settings/ai` + `/agents` + `/usage`, `/commercial/billing`, `/commercial/payment-return` | end-user + staff |
| **signals** | 3 | `/ai-advisory` `/whale-alerts` `/alert-center` | end-user |
| **market** | 1 | `/stocks/:symbol` | end-user |
| **vip-local** | 1 | `/vip/local-control` | dev |

**Điểm kiến trúc tốt**: mọi route khai đủ 8 trường schema (`id, path, titleKey,
group, buildTargets, requiredCapabilities, adapter, status`) và có gate
`route-catalog-contract` chặn route mồ côi. `requiredCapabilities` gắn đúng phân
tầng: 32 route admin đều `admin.operator.read`; 7 route workspace đều
`workspace.portfolios.manage`.

---

## 3. FINDING THEO NHÓM (kèm `file:line` thật)

### 3.1 NAV-1 · P1 · 115 hit — state không đồng bộ URL (lớn nhất)

Luật: *"URL reflects state — filters, tabs, pagination, expanded panels in query params"*
và *"Deep-link all stateful UI"*.

`useState` cho bộ lọc / sắp xếp / phân trang ở **115 chỗ**, file không hề import
`useSearchParams` / `URLSearchParams` / `useNavigate` / `useLocation`.

| File:dòng | State mất deep-link |
|---|---|
| `src/components/AIAuditLogsPanel.tsx:31` | `filterAction` |
| `src/components/AIAuditLogsPanel.tsx:32` | `filterActor` |
| `src/components/AIAuditLogsPanel.tsx:33` | `filterDateFrom` |
| `src/components/AIAuditLogsPanel.tsx:34` | `filterDateTo` |
| `src/components/AIAuditLogsPanel.tsx:36` | `page` |
| `src/components/AIUsageDashboard.tsx:109` | `page` |
| `src/components/AIUsageDashboard.tsx:110` | `pageSize` |
| `src/components/advisory/AdvisoryOrderTicket.js:14` | `quantity` |
| … +107 nữa (xem output scanner) | |

**Tác động thật**: người dùng lọc audit log rồi copy link gửi đồng nghiệp →
đối tác thấy dữ liệu **không lọc**. F5 → mất toàn bộ bộ lọc. Không quay lại được
trạng thái đang xem.

**Nghịch lý cần nói**: trang Portfolio mới (`src/pages/portfolio/`) **đã làm
đúng** — tab nằm trong path (`/portfolios/1/holdings`), có test
`portfolio-real-path.component.test.tsx` khoá hành vi. Vấn đề nằm ở 115 chỗ
cũ hơn.

### 3.2 CSS-2 · P2 · 57 hit — thiếu `prefers-reduced-motion`

| File:dòng | Nội dung |
|---|---|
| `src/components/aiSettings.module.css:147,178,195,339,436,464` | `transition:` |
| `src/components/aiSettings.module.css:629` | `transition: width 0.3s ease` |
| `src/components/aiSettings.module.css:673` | `animation: aiDrawerSlideIn 0.25s ease` |
| +49 nữa | |

File **không hề** có `@media (prefers-reduced-motion)` nào. Với người bị hạn chế
vận động, drawer vẫn trượt và thanh tiến trình vẫn chạy.

### 3.3 CSS-1 · P1 · 51 hit — `transition: all`

Anti-pattern được guidelines nêu tên. `transition: all` chuyển mọi thuộc tính,
kể cả `width`/`height` — kích hoạt reflow mỗi frame thay vì chỉ `transform`/`opacity`.

| File:dòng |
|---|
| `src/components/soc/soc.components.css:44,104,116,140,382,436` |
| `src/components/DNSEConnectionPanel.css:116,145` |
| +43 nữa |

### 3.4 A11Y-9 · P2 · 46 hit — control thiếu label

| File:dòng | Control |
|---|---|
| `src/components/alert-center/FilterBar.tsx:107` | `<input>` |
| `src/components/alert-center/FilterBar.tsx:117` | `<input>` |
| `src/components/alert-center/StatsPanel.tsx:51` | `<input>` |
| `src/components/dashboard/OptimizationModal.jsx:85` | `<input>` |
| `src/components/shared/PaginationBar.jsx:50` | `<select>` (chọn số trang) |
| `src/components/shared/PaginationBar.jsx:102` | `<select>` |
| `src/components/TenantAdminCommandPalette.tsx:57` | `<input>` (palette tìm trang) |
| `src/components/ui/command.tsx:17` | `<input>` |
| +38 nữa | |

**Bắt được khi đọc**: `PaginationBar` là thành phần dùng lại cho **mọi bảng có
phân trang** trong app. Thiếu label ở đây = thiếu tên ở hàng loạt màn hình.

### 3.5 I18N-1 · P2 · 34 hit — `toLocale*` không truyền locale

Luật: *"Numbers/currency: use `Intl.NumberFormat` not hardcoded formats"*.
`toLocaleString()` không tham số lấy locale của **máy người dùng**, không phải
locale app đang chọn ⇒ đổi sang EN vẫn ra `1.234,56` kiểu Việt.

| File:dòng |
|---|
| `src/components/AIUsageDashboard.tsx:203,204,331,332` (số token) |
| `src/components/advisory/DataFreshnessBadge.js:79` (`toLocaleTimeString()`) |
| `src/components/screener/ScreenerHistory.tsx:289` (`toLocaleString()`) |
| `src/components/soc/SocDataInventorySection.tsx:128,129` |
| +26 nữa |

### 3.6 A11Y-8 · P1 · 6 hit — bỏ outline mà không có focus thay thế

Đã lọc hết các case **có** `focus:`; 6 case dưới đây thật sự trần:

| File:dòng |
|---|
| `src/components/aiSettings.module.css:435,463` |
| `src/components/ui/VninvestInput.module.css:39` |
| `src/components/ui/popover.tsx:19` |
| `src/components/WhaleBubbleChart.jsx:1480` |
| `src/pages/UserSettingsPage.css:96` |

### 3.7 A11Y-5 · P1 · 3 hit — `<div onClick>` thay `<button>`

Đã bỏ qua các overlay nền modal (`drawerOverlay`, `absolute inset-0`) vì đó là
pattern hợp lệ. 3 case còn lại thật:

| File:dòng | Vấn đề |
|---|---|
| `src/components/TenantAdminCommandPalette.tsx:56` | `stopPropagation()` trên `<div>` |
| `src/pages/tenant-admin/TenantAdminReportsPage.tsx:244` | modal backdrop + `:245` content — **không Escape, không focus trap** |
| `src/pages/tenant-admin/TenantAdminReportsPage.tsx:245` | click trong modal chặn đóng, không phải `<button>` |

### 3.8 Các nhóm còn lại

| Rule | P | Số | Điểm tiêu biểu |
|---|---|---|---|
| A11Y-11 no `autoComplete` | P2 | 5 | `AdminAuditPage.tsx:81,82` · `PortfolioHoldingsPage.tsx:138` · `TenantAdminWebhooksPage.tsx:497,504` |
| A11Y-7 `autoFocus` | P2 | 3 | `TenantAdminCommandPalette.tsx:57` (hợp lý — palette mở bằng Ctrl+K) · `WatchlistSidebar.tsx:241` · `WatchlistTable.tsx:597` (cần lý do) |
| A11Y-4 `<img>` no `width/height` | P2 | 2 | `CampaignDetailDrawer.jsx:74` · `CampaignForm.jsx:169` |
| A11Y-10 no `inputMode` | P2 | 2 | `TenantAdminWebhooksPage.tsx:497,504` (`type=number`) |
| A11Y-2 `svg` no `aria-hidden` | P1 | 1 | `WhaleBubbleChart.jsx:1497` |
| TYPO-3 `%` tự chế | P3 | 2 | `SmartStatsHeader.js:111` · `ScreenerResultsTable.tsx:70` |

---

## 4. NHỮNG THỨ SCRIPT KHÔNG ĐO ĐƯỢC (nhưng đáng lo)

| # | Vấn đề | Bằng chứng | Mức |
|---|---|---|---|
| **1** | **Không có skip link** — không tìm thấy `skip-link` / `skipToContent` / "Đến nội dung" ở bất kỳ đâu | `Select-String -Path packages/web/src/**/*.tsx,... -Pattern "skip-link\|skipToContent"` → 0 hit | P1 |
| **2** | **75 page nhưng chỉ 12 `<h1>`** — 63 page không có `<h1>` nào; screen reader không có điểm neo đầu trang | `Select-String -Pattern "<h1"` trong `src/pages` → 12 hit / 75 file | P1 |
| **3** | **Thiếu `<meta name="theme-color">`** và `color-scheme` | `index.html` chỉ có viewport (dòng 5); `Select-String "color-scheme"` trong toàn bộ CSS → 0 hit | P2 |
| **4** | **Nhãn màu tài chính theo chuẩn Tây** — `soc` và `portfolioWorkspace` đều dùng xanh = lãi, đỏ = lỗ. Thị trường VN **dùng GIỐNG Bloomberg**: xanh = tăng, đỏ = giảm ⇒ token hiện tại **đã đúng**, không cần đổi (Owner chốt 2026-10-08) | `docs/archive/docs-flat/portfolio_ui_ux/PORTFOLIO_UI_UX_DESIGN_SPEC_20260927.md:156-157,1222,1225` ghi rõ "Bloomberg green (up)"; token `--pf-gain` (xanh) / `--pf-loss` (đỏ) | **P0 nghiệp vụ** |
| **5** | **Dark mode mặc định kể cả khi OS sáng** — chủ đích, nhưng phải nói rõ với người dùng | `src/index.css:6-13` (comment giải thích) | P3 |
| **6** | Bảng số chưa `tabular-nums` — 20 file có `<table>` mà không khai (bỏ qua file đã có class `pf-`) | output scanner rule TYPO-2 | P2 |

---

## 5. KHU VỰC CẦN ĐỌC HIỂU CHỨ SCRIPT KHÔNG KẾT LUẬN ĐƯỢC

Script **không** trả lời được, cần người/camera test:

1. **`portfolioWorkspace` 4 thẻ số "không có nguồn"** ở Overview
   (`PortfolioOverviewPage.tsx:114-121`): Daily P&L · Return 1Y · Sharpe · Max
   Drawdown đều hiện `—` + "BE chưa cung cấp". **Đúng về trung thực**, nhưng 4
   thẻ trống trên màn hình đầu tiên là trải nghiệm xấu. Cần quyết định: bỏ hẳn
   4 thẻ, hay đổi thành trạng thái "sắp có", hay chờ backend.
2. **Độ khác nhau giữa 32 trang admin / tenant-admin**: có dùng chung
   `adminUi.tsx` (có `<h1>` tại `:24`) không, hay mỗi trang tự dựng layout.
3. **Focus trap / Escape** cho các modal: `TenantAdminReportsPage.tsx:244-245`,
   `MuteModal.tsx`, `OptimizationModal.jsx`, `CampaignDetailDrawer.jsx`,
   `TenantAdminCommandPalette.tsx:55` (có `role="dialog" aria-modal="true"`).
4. **Độ tương phản thật** khi hover/active trên nền trong suốt — script chỉ đo được
   token tĩnh. Gate `check-portfolio-contrast.mjs` (viết ở kỳ trước) chỉ đo 12 cặp
   portfolio, chưa đo hover.
5. **Mobile** — không có thiết bị/emulator trong phiên này. `touch-action`,
   `safe-area-inset`, rubber-band **chưa kiểm**.

---

## 6. KHUYẾN NGHỊ — THỨ TỰ ĐỀ XỬ LÝ

| # | Việc | Nỗ lực | Vì sao trước |
|---|---|---|---|
| **1** | **Chốt quy ước màu tăng/giảm** (mục 4 #4) | 5 phút + 1 commit | Đây là lỗi **ý nghĩa**, không phải lỗi kỹ thuật. Tiếp tục ship với quy ước sai thì mọi thứ khác sửa xong vẫn sai |
| **2** | Thêm skip link + `<meta name="theme-color">` + `color-scheme` | ~30 phút | 3 thứ, 3 dòng, sửa ở `index.html` + shell. Lợi ích a11y cao nhất trên số dòng |
| **3** | Bỏ `transition: all` (51) + thêm `prefers-reduced-motion` (57) | ~2 giờ | Sửa cục bộ trong CSS, không đụng logic, rủi ro thấp, giảm reflow |
| **4** | Label cho `PaginationBar` + `FilterBar` + `command.tsx` | ~1 giờ | Component dùng lại ⇒ sửa 1 chỗ ra hàng loạt màn hình |
| **5** | `<h1>` cho 63 page còn thiếu | ~4 giờ | Việc cơ bản nhưng số lượng lớn. Nên gộp khi refactor từng trang, không làm dồn một lần |
| **6** | Đồng bộ URL cho 115 `useState` filter/pagination | ~3 ngày | Rẻ nhất nếu dùng `nuqs` một lần cho toàn app; đắt nhất nếu sửa tay từng chỗ. **Cần quyết định thư viện trước** |
| **7** | `toLocale*` nhận locale từ `LangContext` (34) | ~2 giờ | Sửa `toLocaleString("vi-VN")` / `Intl` một dòng mỗi chỗ |
| **8** | Focus trap + Escape cho 5 modal | ~4 giờ | Cần test thủ công từng modal |
| 9 | `autoComplete`/`inputMode`/`width`+`height` (12) | 30 phút | Rẻ |
| 10 | Tabular-nums cho 20 bảng số (20) | 1 giờ | Rẻ, sửa ở `table.tsx` là được |

---

## 7. GHI CHÚ VỀ QUY TRÌNH

- **Không sửa code UI trong phiên audit này.** Đây là báo cáo, không phải PR sửa.
  Các finding P1 trở lên cần khai claim + tách slice như kỳ Portfolio vừa rồi.
- **Đừng tin con số không kèm đường lọc.** 1.535 → 327 là ví dụ ngay trong báo
  cáo này; từ 327 còn xuống nữa cần đọc hiểu từng dòng.
- **3 skill đã cài vào `.agents/skills/`** (9 skill tổng). Chạy lại:
  ```bash
  node docs/audit-uiux/scripts/scan-ui-guidelines.mjs packages/web/src
  ```
- Số liệu bản đồ route tái lập bằng `docs/audit-uiux/scripts/` hoặc đọc
  `packages/web/src/app/routeCatalog.js` (49 mục, regex 8 trường).

---

## 8. CÀI ĐẶT SKILL — CHỈ COMMIT `skills-lock.json`, KHÔNG COMMIT THÂN SKILL

```
npx skills add ibelick/ui-skills -y --agent "*"
npx skills add https://github.com/vercel-labs/agent-skills --skill web-design-guidelines -y --agent "*"
npx skills add https://github.com/anthropics/skills --skill frontend-design -y --agent "*"
```

⚠ Cần `-y --agent "*"`: bản `npx skills add` gốc mở prompt chọn skill và **hủy
ngay** khi stdin không phải TTY — không có gì được cài.

**Kết quả cài**:

| Skill | Nguồn | Vai trò trong audit |
|---|---|---|
| `web-design-guidelines` | vercel-labs | bảng 40+ luật — nguồn chính |
| `fixing-accessibility` | ibelick/ui-skills | 9 nhóm ưu tiên a11y |
| `ui-skills-root` | ibelick/ui-skills | định tuyến chọn skill nhỏ nhất |
| `baseline-ui` · `improve-ui` · `fixing-motion-performance` · `fixing-metadata` · `create-design-md` | ibelick/ui-skills | bổ sung (motion / metadata / baseline) |
| `frontend-design` | anthropics/skills | thiết kế component, không dùng cho audit |

**Vì sao chỉ commit `skills-lock.json`**:
`skills/{baseline-ui,fixing-accessibility,…}` là **symlink/junction** trỏ vào
`.agents/skills/` — mà `.agents/` đã nằm trong `.gitignore:96`:

```
Get-ChildItem skills -Recurse -Force | ? { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }
→ skills\baseline-ui, skills\create-design-md, skills\fixing-accessibility,
  skills\fixing-metadata, skills\fixing-motion-performance, skills\frontend-design,
  skills\improve-ui, skills\ui-skills-root, skills\web-design-guidelines   (9 reparse point)
```

Commit 9 symlink đó sẽ tạo **link hỏng** trên máy khác (đích không có trong repo).
`skills-lock.json` đã lưu đủ nguồn + `computedHash` cho từng skill ⇒ cài lại được
bằng 3 lệnh trên. Đây là cơ chế đúng.

⚠ **Không xóa đệ quy `skills/`** — đi qua junction sẽ xóa cả `.agents/skills/`
(đã xảy ra 1 lần trong repo này, ghi ở `AGENTS.md`).

---

## 9. KẾT QUẢ CẢI TIẾN (eat/uiux-improvement, 7 commit)

### 9.1 Đo được bằng gate, không phải bằng cảm nhận

packages/web/scripts/check-uiux-budget.mjs — **nhân bản nguyên tắc từ check-openapi-schema-budget.py sẵn có trong repo**:

| Tình huống | Hành động |
|---|---|
| Tổng TĂNG so baseline | **FAIL** |
| Bằng baseline | PASS |
| BẾ hơn baseline | PASS + đề xuất `--write-baseline` |
| Có rule MỚI không khai trong baseline | **FAIL** |
| Không có baseline | FAIL |

Gate có `--self-test` (negative proof). Không sửa `package.json` (deny-list).

`
node packages/web/scripts/check-uiux-budget.mjs              # gate
node packages/web/scripts/check-uiux-budget.mjs --write-baseline
node docs/audit-uiux/scripts/scan-ui-guidelines.mjs packages/web/src   # số liệu gốc
`

### 9.2 Delta

| Rule | P | Trước | Sau | Cách |
|---|---|---|---|---|
| CSS-1 `transition: all` | P1 | 51 | **0** | script compute danh sách property thật + 2 sửa tay |
| A11Y-8 outline-none không focus | P1 | 6 | 4 | 1 sửa thật; 5 là false positive (mục 9.4) |
| A11Y-9 thiếu label | P2 | 46 | 44 | `PaginationBar` — component dùng chung |
| I18N-1 `toLocale*` không locale | P2 | 34 | 19 | `formatNumber(x, localeTag)` — helper có sẵn |
| A11Y-5 `<div onClick>` | P1 | 3 | 3 | chưa làm |
| NAV-1 state không đồng bộ URL | P1 | 115 | 115 | **chưa làm** (mục 9.5) |
| **TỔNG** | | **327** | **246** | P0=0 P1=123 P2=121 P3=2 |

Không rule nào tăng. Gate chặn được hồi quy.

### 9.3 Đã làm

- **UX-00** gate + baseline.
- **UX-01** skip link (`index.html` → `#main-content` ở `FullLayout.tsx`), `<meta name="color-scheme">`, `<meta name="theme-color">`. Trước đó toàn repo **không có** skip link.
- **UX-02** `@media (prefers-reduced-motion: reduce)` ở mức global thay vì sửa 46 file; bỏ 51 `transition: all`.
- **UX-03** `WhaleBubbleChart.jsx:1516` — `<select>` bỏ outline vô điều kiện → thêm `focus:border-cyan-400` như 2 select anh em.
- **UX-05** `PaginationBar`: 8 nút icon có `aria-label`; 2 `<select>` có `<label htmlFor>`.
- **UX-07** 15 chỗ `toLocaleString()` → `formatNumber(x, localeTag)`.

### 9.4 Sai lầm đã phát hiện và sửa (ghi lại vì đã "PASS" nhiều lần)

| # | Sai lầm | Cách bị bắt |
|---|---|---|
| 1 | `transition: all 0.18s` → `transition: color, background;` **vứt mất duration** ⇒ CSS mặc định `0s` ⇒ **49 rule hover chớp tức thay** | audit Stage 5 đếm trực tiếp |
| 2 | Sửa file rồi tìm theo line cũ ⇒ chỉ sửa 38/51 | tự phát hiện |
| 3 | `parseBlocks` trả dòng của selector không phải dòng `transition` ⇒ `0/13` | tự phát hiện |
| 4 | Scanner bỏ sót comment nhiều dòng `/* … */` | tự phát hiện |
| 5 | Vòng PowerShell `Get-Content` → `Set-Content -NoNewline` **gép `soc.components.css` 3482 dòng còn 1 dòng** | `git diff --stat` báo `3944 deletions` |
| 6 | Gate A11Y-8 báo 6 lỗi nhưng **3/6 file CSS đã có** `:focus` + `box-shadow` ring thật | kiểm chứng tay |

⇒ **Quy tắc mới**: dùng `Write`/`Edit` tool hoặc script Node với `lines.join("\n")`; **không** dùng `Get-Content|Set-Content` để sửa file nhiều dòng. `deletions` bất thường là triệu chứng, không phải chuyện thường.

⇒ **A11Y-8 có sẵn ngưỡng false-positive.** "Có `:focus` không" cần phần tử đã render, regex không đủ.

### 9.5 Chưa làm — ghi rõ, không giữ làm xong

| Mục | Số | Vì sao |
|---|---|---|
| NAV-1 state không đồng bộ URL | 115 | Cần chốt thư viện (`nuqs` hay tự viết) **trước** — sửa tay 115 chỗ là cách đắt nhất |
| I18N-1 còn lại | 19 | Script bắt 15/34; 3 chỗ khác scope, 1 cần truyền locale qua props, 6 chỗ trên biểu thức ngoặc |
| A11Y-9 còn lại | 44 | Rải ở 40+ file, phần lớn là `<Input>` wrapper cần kiểm component gốc |
| **Màu tăng/giảm chuẩn VN** | P0 nghiệp vụ | **Chưa đổi** — cần Owner chốt (mục 4 #4) |
| 63 page thiếu `<h1>` | 63 | Gộp khi refactor từng trang, không dồn một lần |
| Mobile / touch / safe-area | — | Không có thiết bị trong phiên |

### 9.6 Test mới

`PaginationBar.a11y.component.test.tsx` (5 test) — fail-trước/pass-sau bằng chính bộ test: bản gốc **5 failed** → bản mới **5 passed**.

1 test hồi qu do thay đổi của tôi: `soc-queue-depth.component.test.tsx:83` kỳ vọng `"5,000"` — đó là `toLocaleString()` không tham số ⇒ locale **của máy chạy test** (jsdom mặc định en-US). Test đang khoá lại hành vi sai; sau khi dùng `formatNumber(x, 'vi-VN')` ra `"5.000"`. Đã cập nhật kèm ghi chú.


---


## 10. PHÂN TÍCH 5 MỤC CÒN LẠI — CON SỐ CŨ CỦA TÔI BỊ THỔI PHỒNG

> Nguyên tắc: **đếm máy không phải đếm lỗi.** Mỗi mục dưới đây được đo lại
> bằng script riêng, và 3/5 mục **con số cũ sai**. Đây là bài học L-F06 áp
> dụng lại cho chính báo cáo của tôi.

Tái lập: `node docs/audit-uiux/scripts/scan-ui-guidelines.mjs packages/web/src`

### 10.1 NAV-1 — con số 115 là **thổi phồng ~4 lần**

Scanner chỉ làm một phép: thấy `useState(filter|search|sort|page|tab)` trong file
không dùng `useNavigate` ⇒ báo. Nhưng **không phải cái nào cũng là lỗi**.

Phân loại lại theo mức độ:

| Nhóm | File | Điểm | Đánh giá |
|---|---|---|---|
| **A — Thật** | 12 | **29** | Bảng có phân trang + filter. Gửi link cho đồng nghiệp → **họ thấy dữ liệu không lọc**. Đây mới là lỗi |
| **B — Tương đối** | 30 | 84 | Có filter/sort nhưng hiếm khi gửi link. Nên sửa nhưng không gấp |
| **C — Không phải lỗi** | 2 | 2 | `AdvisoryOrderTicket.js:14` `quantity`, `DNSEConnectionPanel.js` `orderQuantity` — **ô nhập trong form**, deep-link sẽ vô nghĩa và còn nguy hiểm |

⇒ Việc cần làm thật: **29 điểm / 12 file**, không phải 115.

**Nhóm A (ưu tiên cao nhất)**:

| File | State |
|---|---|
| `components/dashboard/CoreDashboardPositionDeck.tsx` | `activeTab`, `pageSize`, `currentPage` |
| `components/dashboard/FactsFirstModularPositionDeck.jsx` | `activeTab`, `pageSize`, `currentPage` |
| `pages/admin/AdminCoreAuditTracePage.tsx` | `filtersDraft`, `filters`, `selectedRequestId` |
| `pages/admin/AdminCoreJobsPage.tsx` | `filtersDraft`, `filters` |
| `pages/admin/AdminCorePATsPage.tsx` | `filtersDraft`, `filters` |
| `pages/admin/AdminCoreServiceAccountsPage.tsx` | `filtersDraft`, `filters` |
| `pages/admin/AdminCoreTenantsPage.tsx` | `searchDraft`, `search`, `page` |
| `pages/admin/AdminBillingFleetPage.tsx` | `page`, `search` |
| `pages/admin/AdminAuditPage.tsx` | `page` |
| `pages/tenant-admin/TenantAdminMembersPage.tsx` | `searchQuery`, `roleFilter`, `activeTab` |
| `pages/portfolio/PortfolioHoldingsPage.tsx` | `search`, `sortKey`, `sortDir` |
| `features/advertising/components/CampaignTable.jsx` | `sorting`, `globalFilter` |

**Vì sao vẫn cần chốt thư viện trước**: `PortfolioHoldingsPage` + `AIAuditLogsPanel`
+ `AdminCore*Page` đều có **cả bộ lọc + phân trang + sắp xếp**. Sửa tay = lặp
cùng một đoạn parse/serialize `URLSearchParams` 12 lần. Một hook `useUrlState`
viết một lần rồi áp cho cả 12 là rẻ hơn nhiều.

### 10.2 I18N-1 — 19 còn lại, và có 1 lỗi **tôi tự gây ra**

Không phải 19 "lỗi chưa ai đụng". Phân loại:

| Loại | Số | Đánh giá |
|---|---|---|
| `new Date(x).toLocaleString()` (ngày/giờ) | phần lớn | `toLocaleString()` trên **Date** khác `toLocaleString()` trên **number**. Cần `Intl.DateTimeFormat(localeTag, …)`, không dùng lại `formatNumber` |
| `(s.total_rows ?? 0).toLocaleString()` | vài chỗ | Script không bắt vì biểu thức có ngoặc. Sửa tay được, chỉ là script chưa khoét |
| `ui/calendar.tsx` | 1 | Không gọi `useI18n()` — cần truyền `locale` qua props |
| `TenantAdminBillingPage.tsx` | 3 | `useI18n()` gọi ở dòng 117 nhưng dùng ở dòng 85–101 ⇒ khác scope |

⚠ **`AIUsageDashboard.tsx:204-205` là do tôi bỏ sót**: script `fix-locale.mjs`
báo sửa 2 điểm trong file đó nhưng sau đó tôi revert file khi `TenantAdminBillingPage`
lỗi scope — **kéo cả 2 điểm đã sửa đúng đi lại**. Đây là cái giá của revert theo
lô thay vì theo file. Cần sửa lại.

⇒ Còn **21 điểm**, không phải 19. Và cần một helper `formatDateTime` mới — hiện
chưa có (`LangContext.js:110` chỉ có `formatDate` trả nguyên `d`).

### 10.3 A11Y-9 — 44 còn lại, tập trung đủ để sửi rẻ

Đã loại trừ `<Input>` wrapper (`ui/input.tsx:6` có sẵn prop `label` render
`<label>`). Còn lại là **control thô**. Phân bố:

| Nhóm | Số | Nghĩa |
|---|---|---|
| `features/advertising/components` | **15** | Sửa một chỗ → được nhiều màn hình |
| `pages/admin` | 10 | |
| `pages/tenant-admin` | 8 | |
| `components/ui` | 5 | **Sửa ở đây = được mọi trang** |
| `components/alert-center` | 3 | |
| còn lại | 4 | rải rác, 1 điểm/lần |

`components/ui/command.tsx:17` là ví dụ điển hình: `<input>` chỉ có `placeholder`
— `placeholder` **không phải** accessible name.

⇒ 45 điểm nhưng **tập trung**: sửa 5 file trong `components/ui` + 15 trong
advertising = 20/45 chỉ bằng 2 nhóm. Không cần chạm 40+ file.

### 10.4 `<h1>` — con số 63 sai, và **thêm `<h1>` vào chỗ đã có sẽ tạo 2 `<h1>`**

Đây là mục tôi sai nặng nhất vì bỏ qua kiến trúc có sẵn:

`components/ShellPageTemplate.js:119` **đã render `<h1>`**, kèm
`role="region"` + `aria-labelledby` ở dòng 106–107. **42 file dùng shell này.**
Có test khoá hành vi đó: `dom-landmarks.component.test.tsx:24-25`.

| Nhóm | Số |
|---|---|
| Tự viết `<h1>` riêng | 11 |
| **Đi qua shell (đã có `<h1>`)** | **33** ← không phải lỗi |
| **Thật sự không có `<h1>`** | **24** |

⇒ Nếu tôi "sửa" theo danh sách 63 trang cũ thì **33 trang sẽ có 2 `<h1>`**.

**24 trang thật** gồm 6 trang auth (`AuthLoginPage` … `AuthVerifyEmailPage`),
`DashboardPage`, `StockDetailPage`, `SupportPage`, `TransactionsPage`,
`UpgradePage`, `UserSettingsPage`, `WhaleAdvisoryPage`, 5 trang admin, và
**5 trang portfolio tôi tự viết trong đợt trước** — cái này là nợ của tôi.

### 10.5 Mobile — không phải "chưa kiểm", mà là **thiếu 4 thứ cụ thể**

Đo được:

| Hạng mục | Trạng thái |
|---|---|
| `viewport` | ✅ `width=device-width, initial-scale=1` — **không** có `user-scalable=no` ⇒ không chặn zoom |
| Responsive Tailwind | Có: `sm:` 30 · `md:` 59 · `lg:` 43 · `xl:` 35 · `2xl:` 3 |
| `@media` | 48 chỗ |
| Sidebar mobile | `FullLayout.tsx:14-29` có `mobileSidebarOpen`, toggle, đóng khi chuyển trang |
| `safe-area-inset-*` | **0** — trên iPhone có notch, thanh trên/dưới sẽ bị đè |
| `touch-action: manipulation` | **0** — nhấn nút trên mobile chậm ~300ms do chờ double-tap-zoom |
| `overscroll-behavior` | **0** — kéo modal/drawer sẽ kéo luôn cả trang |

⇒ Không phải "chưa kiểm được" mà là **3 thiếu cụ thể**, mỗi cái sửa được
bằng vài dòng CSS ở `index.css`:
- `env(safe-area-inset-*)` cho header/sidebar cố định
- `touch-action: manipulation` cho control tương tác
- `overscroll-behavior: contain` cho modal/drawer

Việc **không thể làm trong phiên này** là kiểm bằng thiết bị thật (viewport
thật, focus ring trên touch, tốc độ cuộn). Cái đó cần máy/Playwright.

### 10.6 Tóm tắt: con số cũ vs con số thật

| Mục | Tôi đã báo | Thật | Sai vì sao |
|---|---|---|---|
| NAV-1 | 115 | **29** (12 file) | Đếm mọi `useState`, kể cả form input vô nghĩa deep-link |
| I18N-1 | 19 | **21** | Revert lô kéo mất 2 điểm đã sửa đúng |
| A11Y-9 | 44 | **45** | Đếm gần đúng nhưng chưa tách theo mức tập trung |
| `<h1>` | 63 | **24** | Bỏ qua shell đã render `<h1>`; "sửa" theo số cũ sẽ tạo 33 trang có 2 `<h1>` |
| Mobile | "chưa kiểm" | **3 thiếu cụ thể** | Không đo ⇒ nói chung chung |

⇒ Tổng việc thật còn lại **ít hơn nhiều** so với con số đầu: **29 + 21 + 45 + 24
+ 3 rule CSS**. Đều tập trung theo nhóm, không phải rải đều.


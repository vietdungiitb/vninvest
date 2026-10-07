# AUDIT UI/UX TOÀN DIỆN — vninvest web app

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
| **4** | **Nhãn màu tài chính theo chuẩn Tây** — `soc` và `portfolioWorkspace` đều dùng xanh = lãi, đỏ = lỗ. Thị trường VN dùng **ngược lại** (đỏ = tăng, xanh = giảm) | `docs/archive/docs-flat/portfolio_ui_ux/PORTFOLIO_UI_UX_DESIGN_SPEC_20260927.md:156-157,1222,1225` ghi rõ "Bloomberg green (up)"; token `--pf-gain` (xanh) / `--pf-loss` (đỏ) | **P0 nghiệp vụ** |
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

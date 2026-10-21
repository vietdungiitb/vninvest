# Implementation Plan: Chuẩn hóa UI/UX toàn dự án về 1 template thương mại hóa

> **Feature slug:** `commercial-ui-standardization`
> **Ngày:** 2026-10-20 · **Baseline:** `dev` @ `e7b008f25` · **Nhánh đề xuất:** `feat/commercial-ui-standardization`
> **Claim đề xuất:** `uistandard` (theo `docs/CLAIMS.md`)
> **Trạng thái:** PLAN-ONLY — chưa sửa dòng code production nào.

---

## 0. Ghi chú về quy trình multi-model

Lệnh `/ccg:plan` yêu cầu gọi song song Codex + Gemini qua `~/.claude/bin/codeagent-wrapper`.
**Môi trường này KHÔNG có wrapper, role prompt hay CLI đó** (đã kiểm tra: `.claude/bin` không tồn tại,
`.claude/.ccg/prompts/**` không tồn tại, `codex`/`gemini` không có trong PATH).
⇒ **Không thể** tạo `CODEX_SESSION` / `GEMINI_SESSION`; **không giả lập** số đó.
Thay thế bằng đúng thứ anh/chị yêu cầu: **các agent chuyên dụng + skill UI/UX có sẵn trong repo** —
agent `explore` (bản đồ template/69 route), agent `general` đóng vai **system frontend designer** (đặc tả
template + token), agent `general` đóng vai **accessibility auditor WCAG 2.2** (baseline đo runtime),
kèm skill `ui-skills-root` → `pbakaus/layout` + `jakubkrehel/better-interface`, và các gate máy
`check:dom-landmarks` · `check:contrast` · `check:tokens`.

---

## 1. Hiện trạng (đã đo, không suy đoán)

### 1.1 Quy mô

| Hạng mục | Số liệu | Nguồn |
|---|---|---|
| Route | **69** (6 nhóm: system 16 · workspace 14 · signals 3 · market 1 · admin 34 · vip-local 1) | `packages/web/src/app/routeCatalog.js` |
| Page component | **125** file `.jsx/.tsx` | đếm đệ quy `packages/web/src/pages` |
| Component | **199** file | đếm đệ quy |
| File CSS | **21** | đếm đệ quy |
| Template family đang tồn tại | **7** | bảng dưới |
| File page tự dựng `<h1>` (không qua shell) | **27/125** (đo của tôi; agent đếm 21–24) | script đo + explore agent |
| Hex cứng inline trong `.tsx/.jsx` | **≥116** (agent) — **538** (bộ lọc thô của tôi) | ⇒ `check:tokens` **không quét** file JSX/TSX |
| Tên class định nghĩa ở >1 file CSS | **47** (trong đó **42** giá trị khác nhau) | script đo của tôi |
| Trùng giữa `ShellPageTemplate.module.css` ↔ `soc.components.css` | **9** (agent đo 10) | script đo của tôi |
| Token trùng tên ở `:root` giữa 3 file định nghĩa | **13 CONFLICT** / 8 cùng giá trị (trong 192 token) | script đo của tôi |
| Breakpoint đang tồn tại trong CSS | **13** (480·520·640·700·768·900·980·1024·1099·1100·1180·1279·1280) | agent đo |

### 1.2 Bản đồ template (nguồn: explore agent, đã đối chiếu `main.tsx` + `pageRegistry.js`)

| Template | File nguồn | #route | % |
|---|---|---|---|
| **C — `ShellPageChrome`** | `components/ShellPageTemplate.js:90` | **28** | **40,6%** |
| AD — ad-hoc thô | – | 13 | 18,8% |
| AH2 — hero inline + `AdminPanel` | `pages/admin/adminUi.tsx:41` | 8 | 11,6% |
| PW — `PortfolioWorkspace` | `pages/portfolio/PortfolioWorkspace.tsx:44` | 6 | 8,7% |
| AH — `adminUi.AdminPageHeader` | `pages/admin/adminUi.tsx:16` | 5 | 7,2% |
| AI — AI-hub `aiSettings.module.css` | `components/aiSettings.module.css` | 5 | 7,2% |
| WS — `WorkstationShell` | `components/WorkstationShell.tsx:23` | 1 | 1,4% |
| TA — `TenantAdminLayout` | `components/TenantAdminLayout.tsx:77` | 1 | 1,4% |
| RD — redirect | `main.tsx:173,247-248` | 2 | 2,9% |

⇒ **Không tồn tại "template thương mại hóa" hiện hữu.** Phải **chọn** `ShellPageChrome` làm chuẩn và
migrate 41 route còn lại — không phải "chuẩn hóa về cái đang có".

### 1.3 Template chuẩn mẫu (đã refactor, đạt chuẩn)

`pages/admin/ShellOperationsCenterPage.tsx` + `components/soc/SocVnbrokerPanel.tsx` —
0 console error · số đo thật · 12 test vitest · 5 khối tải độc lập · poll 60s · A11Y có test.
Đây là **mẫu tham chiếu** để mọi wave sau bám theo.

### 1.4 Baseline A11Y đo runtime (13 trang × 2 theme = 26 lần đo, staging, Chromium thật)

| Nhóm | Kết quả tiêu biểu |
|---|---|
| Heading | **12/13 trang có 2 `<h1>`** (sidebar render `<h1>VNInvest</h1>` tại `Sidebar.tsx:81`); `/transactions` **không có `<h1>` nào trong `<main>`**; nhảy cấp h1→h3 ở 25/26 lần đo (`Sidebar.tsx:150`) |
| Landmark | `<main>` lồng nhau trên 18 route `/tenant-admin/*` (`FullLayout.tsx:90` + `TenantAdminLayout.tsx:82`) |
| Accessible name | 0–4 control thiếu tên/trang (theo AX tree) — `/admin/users` 4 · `/dashboard` 2 · `/stocks/VIC` 3 |
| Focus ring | `/dashboard` mất ring 4–6 control; `focus:outline-none` **64 chỗ** trong `src`, 3 chỗ không có ring thay thế |
| Contrast | xem §1.5 — **nguyên nhân gốc đã tự verify** |
| Target size | `/stocks/VIC` **24/120** control < 24px; `/screener` 4; `/dashboard` 4 |
| Trạng thái | 9 trang có text "Đang tải…" nhưng `role=status=0`, `aria-live=0`; `/settings/ai` có error nhưng **không nêu cách khắc phục** |
| Điểm tốt | skip-link có ở 26/26 lần đo · **không tràn ngang** ở 320/768/1280 (26/26) · 1 `main` đúng ở 25/26 |

### 1.5 ⭐ LIGHT THEME — nguyên nhân gốc **tôi tự verify** (không tin claim của agent)

Agent A11Y báo light theme hỏng (H1 vô hình 1.01:1). Tôi **tự probe** trên staging:

```
theme=light : --text-primary = #0f172a (chữ TỐI)   --color-bg-primary = #020617 (nền TỐI)
theme=dark  : --text-primary = #f1f5f9 (chữ SÁNG)  --color-bg-primary = #020617 (nền TỐI)
```

**Cơ chế (đọc CSS đã build `index-ZvEAG5nN.css`):**
1. `index.css:53-74` khai nhóm token Tailwind `@theme` (`--color-bg-primary: #020617`, `--color-text-primary: #f1f5f9`) — **không có** khối `:root[data-theme="light"]` nào định nghĩa lại ⇒ **canvas không bao giờ chuyển sáng** (vẫn `rgb(2,6,23)`).
2. `theme/tokens.css:65-82` + `soc.tokens.css:124-198` **có** override light cho `--text-primary` ⇒ đổi thành `#0f172a`.
3. ⇒ **Chữ tối trên nền tối** ⇒ contrast **1.13:1** ⇒ tiêu đề biến mất.

**Hệ quả:** mọi surface dùng `--text-primary` (SOC, admin kit, AI hub) đều hỏng ở light theme; chỉ shell `body` (dùng `--color-text-primary`) còn đọc được.
⇒ Đây là **P0 wave 0** của kế hoạch này, và là lý do **không** thể coi light theme là "đã xử lý".

**⚠ Correction quan trọng cho hồ sơ cũ:** bằng chứng `docs/evidence/vnbroker-console/contrast-light.json` **trùng nội dung** `contrast-dark.json` (đã verify bằng so sánh JSON). Nguyên nhân: sau khi khoá palette tối cho `.vnbConsole` (`soc.components.css:4340-4368`), **console trở nên theme-invariant** ⇒ light và dark phải cho **cùng** số đo. ⇒ file evidence **đúng cho console** nhưng **không đại diện cho app**; kế hoạch phải **sinh lại** evidence bằng quy trình có ghi rõ `data-theme` + `--text-primary` + `--color-bg-primary` vào JSON.

### 1.6 Gate máy hiện có — chất lượng bằng chứng

| Gate | Exit | Nhận xét |
|---|---|---|
| `check:dom-landmarks` | **0** | static; script tự ghi *"runtime DOM on 4 routes is planned Playwright at P4"* (`check-dom-landmarks.mjs:42`) |
| `check:contrast` | **0** | **không đọc file CSS nào** — bảng màu tĩnh trong JS (`check-contrast.mjs:26-34`) ⇒ xoá sạch palette vẫn PASS |
| `check:tokens` | **1** | 1 dòng **nền có sẵn**: `brokerData.css #c4b5fd` (claim `pfmodalsurface`) · **không quét `.tsx/.jsx`** ⇒ bỏ sót ≥116 hex inline |
| `check-portfolio-contrast.mjs` | 0 | **có** đọc `soc.tokens.css` nhưng **chưa có npm alias** |
| `check:uiux` | — | ngân sách UI/UX ≤ 246 rule (audit 2026-10-07) |
| `mobile-ergonomics.spec.ts` | — | đã có assert no-h-scroll + target ≥44px (project `chromium`, `hasTouch`) |

---

## 2. Mục tiêu & nguyên tắc

> **Mục tiêu:** mọi sub-page (69 route) dùng **MỘT** template (`CommercialPage`) trên **MỘT** hệ token,
> đạt **5 quy tắc chuẩn thương miali hóa** (R1–R5) + **5 quy tắc A11Y** (A1–A5), và **mọi vi phạm mới bị gate chặn**.

### 2.1 Mục tiêu đo được (Definition of Done)

| # | Mục tiêu | Ngưỡng đo |
|---|---|---|
| D1 | Route dùng template chuẩn | **≥ 95%** (từ 40,6%) |
| D2 | Page tự dựng `<h1>` | **0** |
| D3 | Token `:root` trùng tên khác giá trị | **0** (từ 13) |
| D4 | Tên class định nghĩa ở >1 file CSS với giá trị khác | **0** (từ 42) |
| D5 | Hex cứng trong `.tsx/.jsx` | **0** (từ ≥116) |
| D6 | Contrast fail runtime (dark + light) | **0** ở cả 2 theme |
| D7 | Control thiếu accessible name / mất focus ring | **0** |
| D8 | `<main>` lồng nhau | **0** |
| D9 | Trạng thái loading/error không có `role`/`aria-live`/hướng khắc phục | **0** |
| D10 | Gate mới (A11Y runtime + token + theme) | **5** gate, exit 0, có `--self-test` |

### 2.2 Template chuẩn `CommercialPage` — 6 vùng (đặc tả từ agent designer, đã đối chiếu code)

| Vùng | Nội dung | Token | A11Y |
|---|---|---|---|
| **1. Header** | eyebrow + `<h1>` + description (max 720px) + badge | `--accent-shell` · `--fs-4xl` · `--text-secondary` | đúng **1 `<h1>`** trong `<main>`; `<div role="region" aria-labelledby>` |
| **2. Toolbar** | filter/search/select + hành động | `--border-default` · `--bg-panel-soft` · `--r-sm` | mỗi filter có `<label htmlFor>` **hoặc** `role="group" aria-labelledby` |
| **3. Nội dung** | `ShellPanel` (title→`<h2>`, subtitle→`<p>`) | `--bg-panel-soft` · `--border-default` · `--r-md/lg` | mỗi vùng là `<section aria-labelledby>` |
| **4. Trạng thái** | loading skeleton · empty (CTA) · error (nút Retry) | `.skeleton` · `.emptyState` · `.inlineError` | skeleton `aria-hidden` + `aria-busy`; **vùng live mount sẵn** (`role=alert`/`status`); lỗi **phải nêu cách khắc phục** |
| **5. Hành động** | 1 primary/trang → secondary → ghost → danger | `--accent-cyan` · `--border-strong` | icon-only có `aria-label`; huỷ phá huỷ qua `useConfirm` |
| **6. Metadata** | mốc cập nhật + nguồn dữ liệu + người áp dụng | `--text-muted` / `--text-primary` | `tabular-nums`; mốc thời gian bọc `<time dateTime>` |

### 2.3 Quy tắc chuẩn thương mại hóa (5 + 5)

**R1** — 1 `<h1>`, 1 hệ token, 1 hệ class · **R2** — đủ 6 vùng; trạng thái phải có hướng khắc phục · **R3** — layout fluid (`auto-fit/auto-fill`), chỉ 3 mốc MQ (1280/768/480) · **R4** — verify bằng gate đọc file thật + đo runtime, **không** tin `check:contrast` · **R5** — không để token/class xung đột đi vào trang mới; palette riêng phải khoá trong scope (`mẫu .vnbConsole`).

**A1** — 1 `<h1>` trong `<main>`, không nhảy cấp, sidebar/header **không** chứa heading · **A2** — theme là hợp đồng: canvas + panel + text đổi **đồng thời** ≥4.5:1 ở cả 2 theme · **A3** — mọi control có tên (AX tree) + focus ring ≥2px · **A4** — target ≥24×24 (44 mobile), không tràn ngang 320px · **A5** — loading/empty/error phải nói, lỗi phải chỉ đường ra.

### 2.4 Phân cấp responsive (3 mốc)

| Mốc | Nội dung | Grid |
|---|---|---|
| **≥1280px** | đầy đủ | `.sectionGrid` 3–4 cột (minmax 320) · tile 3–4 (minmax 260) · form 4–5 (minmax 240) · KPI 7 cột |
| **768–1279px** | thu gọn | grid tự co (**không** cần MQ) · KPI 4 cột · bảng cuộn ngang trong wrapper |
| **<768px** | 1 cột | toolbar xuống cột · drawer full-width · vùng chạm ≥44px khi `pointer:coarse` |

---

## 3. Giải pháp kỹ thuật

### 3.1 Kiến trúc

```
components/commercial/
  CommercialPage.tsx          # 1 template: 6 vùng (props: eyebrow,title,description,badge,
                              #   metrics,notice,error,toolbar,actions,children,className,id)
  CommercialPage.module.css   # class DUY NHẤT, tiền tố .cm-
  primitives/
    CommercialToolbar.tsx     # filter + actions
    CommercialState.tsx       # <CommercialState kind="loading|empty|error" ...>
    CommercialTable.tsx       # bảng: caption + scope + wrapper cuộn ngang
    CommercialMeta.tsx        # metadata (mốc cập nhật / nguồn / người áp dụng)
theme/
  tokens.css                 # SSOT DUY NHẤT cho --cm-* + alias các token cũ
```

**Quyết định quan trọng — KHÔNG gộp `soc.tokens.css` vào `theme/tokens.css` ngay** (nó đang là nguồn conflict). Thay vào đó:
`theme/tokens.css` giữ vai trò **SSOT** cho tên token *nghĩa* (`--text-*`, `--bg-*`, `--border-*`, `--accent-*`, `--status-*`, `--sp-*`, `--r-*`, `--shadow-*`, `--fs-*`);
`soc.tokens.css` **chỉ khai các token riêng của SOC** (`--soc-c-*`, `--soc-rgb-*`) và **xoá** các khai báo trùng tên.

### 3.2 Cầu nối token (chặn xung đột trước khi migrate route)

```
theme/tokens.css  :root                     → giá trị DARK chuẩn
theme/tokens.css  :root[data-theme=light]   → giá trị LIGHT chuẩn  (BAO GỒM --color-bg-primary)
index.css          @theme                   → XOÁ nhóm --color-* trùng nghĩa; chỉ giữ token Tailwind thật sự
soc.tokens.css    :root                     → chỉ --soc-c-*/--soc-rgb-*/--pf-*
soc.components.css .vnbConsole              → scope override tạm (giữ tới khi wave 0 xong)
```

**Điều kiện bắt buộc:** sau wave 0, **mọi** cặp token phải có **cùng giá trị** ở dark và **cùng giá trị** ở light ⇒ `check-theme-contrast.mjs` (gate mới) assert được.

### 3.3 Cơ chế migrate route không phá layout

3 bước cho mỗi route (lặp lại được, mỗi bước là 1 PR nhỏ):
1. **Bọc** — thay markup thô bằng `<CommercialPage>` giữ nguyên children ⇒ layout không đổi.
2. **Chuẩn hoá class** — đổi class cũ (`.sectionCardTitle` dùng sai vai) sang class chuẩn, **không** đổi giá trị ⇒ không nhảy layout.
3. **Dọn token** — thay hex/px cứng bằng token, mỗi đổi phải **đo lại** contrast + tràn ngang.

### 3.4 Gate mới (5)

| # | Gate | Cơ chế | Ngưỡng chặn |
|---|---|---|---|
| **G1** | `check-a11y-runtime.mjs` | Playwright + chromium, đăng nhập thật, đo 1 trang đại diện mỗi họ × 2 theme. **Bắt buộc chạy 1 control** (#fff/#000 = 21.00) trước khi tin | `h1 trong main = 1` · `main lồng = 0` · `thiếu accessible name = 0` · `mất focus ring = 0` · `contrast fail = 0` · `target <24px = 0` · `tràn ngang 320px = false` |
| **G2** | `check-focus-ring.mjs` | static AST: chặn `focus:outline-none` không kèm ring/shadow/border thay thế; bắt rule focus global nằm ngoài `@layer base` | `outline-none` không thay thế = **0** |
| **G3** | `check-heading-contract.mjs` | 1 `<h1>` trong `<main>`, không nhảy cấp, sidebar không chứa heading | 3 mục = 0 |
| **G4** | `check-theme-contrast.mjs` | ép `data-theme=light`, đọc **file thật** (`index.css` + `theme/tokens.css` + `soc.tokens.css`), assert **mọi cặp text/bg** ≥4.5 ở cả 2 theme; assert `--color-bg-primary` **đổi** theo theme | 0 cặp fail · canvas đổi theo theme |
| **G5** | `check-token-conflict.mjs` | parse 3 file định nghĩa `:root`, chặn **cùng tên khác giá trị**; chặn class trùng tên ở >1 file CSS; mở rộng `check-tokens.mjs` sang `.tsx/.jsx` | conflict = **0** · class trùng = **0** · hex inline = **0** |

Mỗi gate có `--self-test` (negative test) để chứng minh nó **thật sự chặn**.

---

## 4. Các bước triển khai (6 wave)

### W0 — Nền tảng: token + theme + bằng chứng (P0, **chặn mọi wave sau**)

| Bước | Việc | AC | Gate |
|---|---|---|---|
| W0.1 | Sinh lại evidence light theme **đúng quy trình** (ghi `data-theme`, `--text-primary`, `--color-bg-primary`, body bg vào JSON) | JSON light ≠ dark, có `dataTheme=light` | — |
| W0.2 | **Sửa light theme app-wide**: thêm `:root[data-theme=light]` định nghĩa lại `--color-bg-primary` / `--color-text-primary` / `--color-border-*` / `--color-accent-*` **hoặc** chính thức **tắt light theme** (product decision) | canvas đổi theo theme **hoặc** light bị ẩn khỏi bộ chọn | G4 |
| W0.3 | Xoá 13 token `:root` trùng tên (giữ 1 nguồn) | conflict = 0 | G5 |
| W0.4 | Tạo `theme/tokens.css` làm SSOT: thêm nhóm `--status-*` + alias; xoá nhóm trùng ở `soc.tokens.css` | 1 nguồn cho mỗi tên | G5 |
| W0.5 | Tạo `CommercialPage` + primitives + `CommercialPage.module.css` (**chưa** migrate route nào) | render đủ 6 vùng, snapshot test | `test:components` |
| W0.6 | Viết 5 gate mới (G1–G5) kèm `--self-test` | mỗi gate có ≥1 negative test chứng minh nó chặn | tự test |

**AC wave:** W0.1–W0.6 xong ⇒ D3, D6 (sau khi W0.2) đạt; 5 gate chạy được.

### W1 — Sửa 8 trang `AdminCore*` (ROI cao nhất, rẻ nhất)

8 route hero copy-paste y hệt dù `AdminPageHeader` đã export sẵn (`adminUi.tsx:16-39`) ⇒ chỉ đổi 3 dòng/trang.
**AC:** 8 route về họ `adminUi`; **0** `<h1>` tự dựng ở 8 file; h1 cùng size với 5 trang admin còn lại.
**Rủi ro:** thấp — đổi cấu trúc header, không đổi nội dung.

### W2 — Migrate 13 route ad-hoc → `CommercialPage`

Ưu tiên `/dashboard` (route quan trọng nhất, 451 dòng, h1 riêng) · `/transactions` (thiếu `<h1>`, **hardcode chuỗi tiếng Việt** `TransactionsPage.tsx:194,212,214,231-238` — phải i18n) · `/screener` (797 dòng, h1 inline style, 16 hex) · `/settings` · `/support` · `/upgrade` · `/ai-advisory` · `/admin-crawl-control` · `/admin/advertising` · 4 trang auth (auth **ngoài** AppShell — tách riêng, không ép shell).
**AC:** 13 route về họ C ⇒ D1 = 59,4%; mỗi route có đúng 1 `<h1>`; 0 chuỗi hardcode.

### W3 — Migrate nhóm còn lại (13 route)

AI-hub 5 (`aiSettings.module.css` đã có `page/pageHeader/…` ⇒ map thẳng sang `CommercialPage`) · Portfolio 6 (giữ tab-nav riêng) · `WorkstationShell` 1 (bổ sung 4 prop `badge/metrics/notice/error` để đạt parity) · `TenantAdminLayout` 1 (fix `<main>` lồng) · 2 redirect (giữ).
**AC:** D1 = 100%; `<main>` lồng = 0.

### W4 — Chuẩn hoá class & token trong các page đã migrate

42 class trùng tên khác giá trị → đổi 1 file gốc + alias; 9 trùng giữa `ShellPageTemplate.module.css` ↔ `soc.components.css` → gộp về `CommercialPage.module.css` (tiền tố `.cm-`) · phân cấp 3 bậc heading (`sectionTitle` / `sectionCardTitle` / `vnbFormGroupTitle`) · `--fs-xs` ≥ 12px.
**AC:** D4 = 0; mỗi class chỉ còn 1 nơi định nghĩa; `soc.module.css` chỉ còn là barrel được ghi rõ trong `AGENTS.md`.

### W5 — Xoá code chết + dọn gate

7 file `Shell*Page` legacy (~1.100 dòng) không route nào render (đã remap ở `main.tsx:24,27,28,32,49`) + 7 entry `pageRegistry.js` chết + export `src/index.js:20-27` + assert của `check-shell.mjs:151-157` (script đã tự ghi DEPRECATED) · file CSS hỏng `components/ui/VninvestInput.module.css` (chứa output lỗi git, 0 consumer) · `socStatusColors.ts:21-27` tham chiếu 5 token `--soc-bg-*` **không tồn tại** · 2 file CSS global đè class Tailwind (`WatchlistPage.css` định nghĩa `.text-white`; `SmartStatsHeader.css` định nghĩa `.bg-slate-800`/`.text-slate-600` — **không** phải `.module.css` ⇒ rò global).
**AC:** D5 = 0; không còn export trỏ file chết; `check-shell.mjs` được gỡ khỏi `check:shell` hoặc viết lại.

### W6 — Chuẩn hoá A11Y toàn app + bằng chứng cuối

`Sidebar.tsx:81` `<h1>VNInvest</h1>` → `<div>` · `Sidebar.tsx:150` nhóm nav `<h3>` → `<div role="presentation">` (fix nhảy cấp 25/26) · `Sidebar.tsx:91-97` nút toggle 55×20 → ≥24×24 · `Sidebar.tsx:106,151` 8 fail contrast nền shell → ≥4.5 · `index.css:114-141` rule focus global ra khỏi `@layer base` (để utility không đè) · 64 chỗ `focus:outline-none` → thay ring thật · `TenantAdminLayout.tsx:82` `<main>` lồng → `<div>` · hook `<StatusRegion>` dùng chung cho loading/empty/error (role=status + aria-live + hướng khắc phục) · 15 control thiếu accessible name · 24+ control <24px.
**AC:** D6–D9 = 0; G1–G5 PASS.

---

## 5. Key files

| File | Operation | Mô tả |
|---|---|---|
| `packages/web/src/theme/tokens.css` | Modify | SSOT token; thêm `:root[data-theme=light]` cho `--color-*`; xoá trùng |
| `packages/web/src/index.css` | Modify | bỏ nhóm `--color-*` trùng ở `@theme`; đưa rule focus ra `@layer utilities` |
| `packages/web/src/components/soc/soc.tokens.css` | Modify | chỉ giữ `--soc-c-*`/`--soc-rgb-*`/`--pf-*`; bỏ trùng |
| `packages/web/src/components/soc/soc.components.css` | Modify | bỏ 9 class trùng; `.vnbConsole` chuyển thành tạm → xoá sau W0.2 |
| `packages/web/src/components/commercial/CommercialPage.tsx` | **New** | template 1 trang, 6 vùng |
| `packages/web/src/components/commercial/CommercialPage.module.css` | **New** | class `.cm-*` duy nhất |
| `packages/web/src/components/commercial/primitives/*.tsx` | **New** | Toolbar · State · Table · Meta |
| `packages/web/src/components/ShellPageTemplate.js` | Modify | `ShellPageChrome` → bọc/gọi `CommercialPage`; giữ API cũ 1 đợt deprecate |
| `packages/web/src/components/ShellPageTemplate.module.css` | Modify | bỏ 9 class trùng, alias `.cm-*` |
| `packages/web/src/layouts/full/vertical/sidebar/Sidebar.tsx` | Modify | bỏ `<h1>`/`<h3>` trong nav; nút ≥24px; contrast |
| `packages/web/src/components/TenantAdminLayout.tsx` | Modify | bỏ `<main>` lồng |
| `packages/web/src/pages/admin/AdminCore*.tsx` (8 file) | Modify | dùng `AdminPageHeader`/`CommercialPage` |
| `packages/web/src/pages/DashboardPage.tsx` | Modify | bọc `CommercialPage` |
| `packages/web/src/pages/TransactionsPage.tsx` | Modify | bọc + i18n chuỗi hardcode |
| `packages/web/src/pages/ScreenerPage.tsx` | Modify | bọc + bỏ hex |
| `packages/web/src/pages/**` (còn lại) | Modify | bọc `CommercialPage` |
| `packages/web/scripts/check-a11y-runtime.mjs` | **New** | G1 |
| `packages/web/scripts/check-focus-ring.mjs` | **New** | G2 |
| `packages/web/scripts/check-heading-contract.mjs` | **New** | G3 |
| `packages/web/scripts/check-theme-contrast.mjs` | **New** | G4 |
| `packages/web/scripts/check-token-conflict.mjs` | **New** | G5 |
| `packages/web/scripts/check-tokens.mjs` | Modify | mở rộng quét `.tsx/.jsx` |
| `packages/web/package.json` | Modify | thêm npm script cho 5 gate (**deny-list** ⇒ cần claim riêng + coordinator) |
| `packages/web/src/pages/pageRegistry.js` | Modify | gỡ 7 entry chết |
| `packages/web/src/index.js` | Modify | gỡ export file chết |
| `docs/AUDIT_UIUX_STANDARDIZATION_20261020.md` | **New** | báo cáo audit + số đo nền |
| `docs/CODE_CHANGE_AUDIT_LEDGER.md` | Modify | Entry từng wave |

---

## 6. Rủi ro & giảm thiểu

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| **Sửa token toàn cục làm đổi mọi màn hình** | Cao | W0.2 tách riêng 1 PR + chụp ảnh trước/sau **từng nhóm route**; `check:contrast` (file thật) + G4 chặn trước khi merge; revert được trong 1 commit |
| **Chuyển 41 route làm nghẽn tiến độ / khó review** | Cao | **1 route = 1 PR** (hoặc 1 nhóm ≤5 route); không gộp 2 hệ trong 1 PR |
| **Thêm 5 gate ⇒ chặn nhầm PR khác** | Trung bình | Mỗi gate có `--self-test` + chỉ bật sau khi **đã** pass trên `dev`; gate mới báo lỗi (không chặn) 2 tuần trước khi chặn |
| `package.json` là **file shared (deny-list)** | Trung bình | Cần claim riêng + coordinator gộp (theo `AGENTS.md` §2) |
| Xoá 7 file legacy ⇒ mất API public | Trung bình | Kiểm `src/index.js` consumer ngoài repo; giữ alias 1 đợt deprecate |
| Light theme là **quyết định sản phẩm** | Trung bình | **Cần Owner chốt**: (a) làm light theme đúng, hay (b) tắt light theme khỏi bộ chọn cho tới khi đủ token. Không tự quyết |
| Số đo audit cũ (`docs/audit-uiux/*`) đã cũ ~12 ngày | Thấp | Đã **đo lại từ code**; mọi con số trong plan này có phép đo kèm theo |

---

## 7. Verify (bằng chứng, không phải "có/không")

| # | Đo | Ngưỡng | Công cụ |
|---|---|---|---|
| V1 | 1 `<main>`/trang, không `<main>` lồng | 0 lỗi | `npm run check:dom-landmarks` (static) + G1 (runtime) |
| V2 | Contrast **đọc file thật**, 2 theme | ≥4.5 / ≥3.0 | `node scripts/check-portfolio-contrast.mjs` (đã có, thiếu npm alias) + **G4** |
| V3 | Contrast runtime dark + light, **≥18 selector** (hiện file cũ chỉ 8) | 0 fail | script Playwright (mẫu: `docs/evidence/vnbroker-console/`) |
| V4 | Hex cứng `.css` + inline `.tsx/.jsx` | 0 | `npm run check:tokens` (mở rộng) + G5 |
| V5 | Token `:root` trùng tên | 0 | G5 |
| V6 | Class trùng tên ở >1 file | 0 | G5 |
| V7 | Heading: 1 `<h1>` trong `<main>`, không nhảy cấp | 0 lỗi | G3 |
| V8 | Accessible name + focus ring + target ≥24px | 0 lỗi | G1 (AX tree + Tab thật + `getBoundingClientRect`) |
| V9 | Tràn ngang 320/768/1280 | `scrollWidth <= innerWidth` | `tests/visual/mobile-ergonomics.spec.ts` + G1 |
| V10 | Loading/empty/error có role + hướng khắc phục | 0 trang thiếu | G1 |
| V11 | Console error | 0 | Playwright (`consoleErrors: []`) |
| V12 | Ngân sách UI/UX | ≤246, 0 rule mới | `npm run check:uiux` |
| V13 | Regression ảnh | `maxDiffPixels:100`, `threshold:0.2` | `playwright.config.ts:78-83` |
| V14 | Test component | 0 fail | `npm run test:components` (baseline 1154/1154) |
| V15 | Token switch theo theme | canvas đổi | `tests/visual/theme-verify.spec.ts` |

**Quy tắc dữ liệu:** mọi script đo đặt ở `%TEMP%`; **ảnh chụp** đẩy vào `docs/evidence/<feature>/` kèm JSON kèm `data-theme` + giá trị token đọc được để **tự kiểm chứng lại được** (bài học từ chính lần audit này: file `contrast-light.json` trùng `contrast-dark.json` ⇒ không đủ bằng chứng).

---

## 8. Câu hỏi cần Owner chốt (chặn W0.2)

1. **Light theme**: (a) làm cho đúng (thêm override `--color-*` + đổi canvas), hay (b) **tắt** light theme khỏi bộ chọn cho tới khi đủ token? ⇒ hiện light theme làm **tiêu đề biến mất** (1.13:1, tự đo).
2. **`ShellPageChrome` hay `adminUi.AdminPageHeader` làm gốc?** Đề xuất: `CommercialPage` mới làm gốc, `ShellPageChrome` + `adminUi` thành alias 1 đợt ⇒ không phá API cũ.
3. **Phạm vi wave**: 41 route trong 1 PR lớn hay chia 8–10 PR nhỏ theo nhóm? (đề xuất: chia theo nhóm, 1 nhóm/PR)
4. **Auth 4 trang**: có thuộc phạm vi "chuẩn hóa sub-page" không (chúng nằm ngoài AppShell, thiết kế riêng)?
5. **`package.json` (deny-list)**: cho phép thêm 5 npm script gate hay gộp script vào 1 runner để **không** đụng file shared?

---

## 9. Đề xuất thứ tự thực thi

```
W0 (token + theme + 5 gate)  →  W1 (8 AdminCore)  →  W2 (13 ad-hoc)  →  W3 (13 còn lại)
   →  W4 (class/token cleanup)  →  W5 (code chết + gate)  →  W6 (A11Y toàn app)
```

Mỗi wave: **1 branch + 1 PR** (`feat/uistandard-w<N>`), khai claim trước, chạy đủ V1–V15 trước khi đóng.
**Không merge wave sau khi wave trước chưa merge** để review được từng bước.

---

## 10. SESSION_ID (cho `/ccg:execute`)

- `CODEX_SESSION`: **không có** — `~/.claude/bin/codeagent-wrapper` + `~/.claude/.ccg/prompts/codex/*` không tồn tại trong môi trường này; CLI `codex` không cài.
- `GEMINI_SESSION`: **không có** — lý do tương tự (`~/.claude/.ccg/prompts/gemini/*` không tồn tại; CLI `gemini` không cài).
- Thay thế đã dùng: agent `explore` (bản đồ 69 route + 7 template + drift token) · agent `general` vai **system frontend designer** (đặc tả `CommercialPage` + bảng token + 5 quy tắc R1–R5) · agent `general` vai **accessibility auditor** (baseline 26 lần đo runtime) · skill `pbakaus/layout` + `jakubkrehel/better-interface` + `ui-skills-root` · script đo của tôi (token conflict, class trùng, probe light theme).

> Khi `/ccg:execute` chạy ở môi trường có wrapper, có thể bổ sung 2 call Codex/Gemini để **đối chiếu** kế hoạch này — nhưng kế hoạch hiện đã dựa trên **đo thật** (69 route · 26 lần đo A11Y · 13 conflict token · 42 class trùng · probe light theme).

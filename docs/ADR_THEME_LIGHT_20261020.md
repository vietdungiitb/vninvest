# ADR — Light theme của app VNInvest: canvas không bao giờ chuyển sáng, chữ thì có

> **Trạng thái:** Đề xuất (PROPOSED) — **chưa sửa gì cả** · **Ngày:** 2026-10-20
> **Agent:** `uistd-w0-tokens` (slice S3 của `docs/PLAN_UI_STANDARDIZATION_W0.md` — **DOC-ONLY**)
> **Base mã nguồn:** `dev` @ `e7b008f25` · **App đang chạy trên staging:** `6a127002e` (branch `feat/vnbroker-console`)
> **Lệnh tái lập toàn bộ số trong tài liệu này:** `node packages/web/scripts/measure-theme-tokens.mjs`
> **Đo lúc:** 2026-10-20T17:00:46.128Z (lần đo cuối, dùng cho **mọi** số dưới đây) · **xác nhận tái lập:** 2026-10-20T17:03:02.873Z — **mọi số trong bảng dưới đây trùng khớp tuyệt đối** giữa 2 lần đo liên tiếp (trừ `/dashboard`, xem ghi chú ở §1) · **CONTROL (L-V01):** `#fff` trên `#000` = **21.00:1**, `#777` trên `#fff` = **4.48:1** — chạy **32 lần**, **0** lần lệch ⇒ mọi số dưới đây đáng tin.
> **Quét tĩnh (bán kính ảnh hưởng của phương án (a)):** `node packages/web/scripts/measure-theme-tokens.mjs --scan-hardcoded`

---

## 1. Triệu chứng (đo thật, có số)

Bật **Giao diện: Sáng** (`UserSettingsPage.tsx:206-209` → `<select name="theme">`, lưu `localStorage['vninvest-theme']`) thì **tiêu đề trang biến mất** trên các trang admin.

| Route | H1 (nội dung) | dark (không `data-theme`) | light (`data-theme="light"`) |
|---|---|---|---|
| `/admin/users` | "Quản trị người dùng" | `#ffffff` trên `#020617` = **20.1728:1** | `#020617` trên `#020617` = **1.0000:1 ← VÔ HÌNH** |
| `/operations-center?tab=vnbroker` | "Trung tâm Hoạt động Dịch vụ" | `#f1f5f9` trên `#020617` = **18.4140:1** | `#f1f5f9` trên `#020617` = **18.4140:1** (H1 này **cứng sáng** ⇒ không bị ảnh hưởng) |
| `/dashboard` | "Tổng quan" | `#f1f5f9` trên `#020617` = **18.4140:1** | `#f1f5f9` trên `#020617` = **18.4140:1** (tương tự) |
| `/portfolios/manage` | "Quản lý danh mục" | `#f1f5f9` = **17.6506:1** | `#0f172a` trên `#ffffff` = **17.8525:1** (trang này **có nền sáng** ⇒ vẫn đọc được) |

⇒ Light theme **hỏng một cách không đồng nhất**: trang nào nền vẫn tối + chữ đảo sang tối ⇒ **vô hình**; trang nào có bề mặt sáng ⇒ vẫn đọc được. Đây không phải "theme sáng thiếu chút", mà là **trộn 2 theme trong cùng 1 trang**.

**Quy mô (mẫu chữ, đo trong trình duyệt — mọi phần tử có chữ trực tiếp, nền composite nhiều lớp):**

| Route | dark: dưới WCAG AA / tổng mẫu | light: dưới WCAG AA / tổng mẫu | thấp nhất (light) |
|---|---|---|---|
| `/admin/users` | 8 / 60 | **28 / 60** | **1.0000:1** |
| `/operations-center?tab=vnbroker` | 8 / 60 | **20 / 60** | 1.9482:1 |
| `/dashboard` | 8 / 60 | 14 / 60 | 1.3284:1 |
| `/portfolios/manage` | 8 / 60 | 9 / 60 | 3.6292:1 |

> ⚠ **Tổng mẫu chữ phụ thuộc dữ liệu thật** (số dòng bảng/thẻ đang tải). Script đã chờ trang **ổn định** trước khi đo (`networkidle` + hết trạng thái "Đang tải") ⇒ ở lần đo cuối cả 4 route đều ra **60** phần tử ⇒ tổng mẫu **tái lập được**. Riêng **`/dashboard`** còn biến động vì widget thị trường nạp bất đồng bộ: số "dưới WCAG AA" ở light theme quan sát **11 → 14 → 14 / 60** trong 3 lần đo liên tiếp (16:53:48Z → 17:00:46Z → 17:03:02Z), còn H1 contrast **không** đổi. **Số ổn định tuyệt đối** (không phụ thuộc dữ liệu): H1 contrast · `--text-primary` · `--color-bg-primary` · `--bg-panel` · `--bg-panel-solid` · canvas thật.

**Canvas thật (không phải giá trị token):** `getComputedStyle(document.body).backgroundColor` = `oklch(0.13 0.028 261.692)` → `#030712` ở **CẢ** light lẫn dark. Lớp trong `<div class="… bg-[var(--color-bg-primary)] …">` = `#020617` ở **CẢ** hai theme.
⇒ **Canvas không bao giờ chuyển sáng** (đo được, không phải suy luận).

---

## 2. Nguyên nhân gốc (trích nguyên văn + `file:line @ sha`)

### R1 — Canvas: **không có** khối `:root[data-theme="light"]` nào định nghĩa lại `--color-bg-primary`

`packages/web/src/index.css:53 @ e7b008f25` (trùng cả ở `6a127002e`):

```css
  --color-bg-primary: #020617;
```

Trong `packages/web/src/index.css` **không tồn tại** khối `:root[data-theme="light"]` (quét toàn file: `:root` chỉ xuất hiện ở dòng **13** (trong `@custom-variant`) và dòng **696**; các dòng `302–436` đều là selector dạng `[data-theme="light"] .<class>` — **không** phải khối khai báo token).

Hệ quả: `--color-bg-primary` = `#020617` ở mọi theme ⇒ mọi lớp nền dùng token này vẫn tối.

### R2 — Chữ: **có** override light ⇒ chữ đảo sang tối trong khi canvas vẫn tối

`packages/web/src/theme/tokens.css:2` và `:65-66 @ e7b008f25`:

```css
:root {
  --text-primary: var(--color-text-primary, #f1f5f9);      /* dòng 2 */
...
:root[data-theme="light"] {                                  /* dòng 65 */
  --text-primary: #0f172a;                                  /* dòng 66 */
```

`packages/web/src/components/soc/soc.tokens.css:7` và `:124-125 @ e7b008f25` (ở commit **đang chạy** `6a127002e` thì dòng này dịch thành **:143-144** vì PR #271 thêm token vnbroker):

```css
:root {
  --text-primary: var(--soc-c-f1f5f9);                       /* dòng 7 */
...
:root[data-theme="light"] {                                  /* dòng 124 */
  --text-primary: #0f172a;                                  /* dòng 125 */
```

⇒ Ở light theme `--text-primary` = **`#0f172a`** (đo được), nhưng `--color-bg-primary` vẫn = **`#020617`** ⇒ **chữ tối trên nền tối**.

### R3 — H1 admin dùng `text-slate-950` **cứng** ⇒ **đổi `--text-primary` KHÔNG sửa được**

`packages/web/src/pages/admin/adminUi.tsx:24 @ e7b008f25` (trùng ở `6a127002e`):

```tsx
      <h1 className="text-2xl font-bold text-slate-950 dark:text-white">{title}</h1>
```

- Ở **dark**: biến `dark:` bật ⇒ chữ = `#ffffff` ⇒ **20.1728:1** (đo được).
- Ở **light**: `dark:` tắt ⇒ chữ = `text-slate-950` = `#020617` ⇒ trên nền `#020617` ⇒ **1.0000:1** (đo được).

⇒ Lỗi **không nằm ở `--text-primary`** mà nằm ở class **cứng** trong JSX. Sửa `--text-primary` sẽ **không** làm H1 này hiện ra.

### R4 — "Sửa nhỏ" bằng cách override `text-slate-950` **toàn cục** ⇒ **phá** các trang admin khác

Cặp màu tham chiếu (tính bằng đúng hàm contrast của script đo):

| Mã | Cặp | Kết quả | Ý nghĩa |
|---|---|---|---|
| **R1** | `#020617` trên `#ffffff` | **20.1728:1** | tiêu đề trong panel nền trắng (`adminUi.tsx:48` `bg-white` + `:51` `text-slate-950`) ở light theme |
| **R2** | `#f1f5f9` trên `#ffffff` | **1.0955:1** | **sau khi** override `--color-slate-950: #f1f5f9` ⇒ tiêu đề đó **biến mất** |

⇒ Đổi `--color-slate-950` toàn cục **đổi lỗi chứ không sửa lỗi**: H1 admin trên nền tối được sửa (18.4140:1), nhưng **mọi chữ `text-slate-950` trên panel nền trắng** rơi từ 20.17:1 xuống **1.0955:1**.
**Mô phỏng đo thật (inject CSS, không sửa app) — SIM-B:** `/admin/users` H1 `#020617 → #f1f5f9` ⇒ **18.4140:1** ✔ nhưng số phần tử dưới WCAG AA ở light theme **tăng 28 → 29 / 60** (và ở `/operations-center` **20 → 22 / 60**, `/dashboard` **14 → 16 / 60**).

### R5 — Token conflict có **hệ quả runtime** (mục 3)

---

## 3. Hệ quả runtime của token conflict (đo được)

Cùng **dark theme**, nhưng `--bg-panel` **khác nhau giữa các route**, vì khối token SOC nằm trong **lazy chunk** chỉ được nạp khi route đó import `soc.tokens.css`:

| Route | `--bg-panel` (dark) | `--bg-panel-solid` (dark) | Nạp SOC chunk? |
|---|---|---|---|
| `/dashboard` | **`#0f172a`** | **(KHÔNG định nghĩa)** | không |
| `/admin/users` | **`rgba(8 23 52 / .4)`** | `rgb(8 23 52)` | có |
| `/operations-center?tab=vnbroker` | **`rgba(8 23 52 / .4)`** | `rgb(8 23 52)` | có |
| `/portfolios/manage` | **`rgba(8 23 52 / .4)`** | `rgb(8 23 52)` | có (`PortfoliosPage.tsx:32`) |

⇒ Cùng 1 theme, **1 biến CSS có 2 giá trị khác nhau tùy route** ⇒ panel trông khác nhau giữa các trang, và `--bg-panel-solid` **không tồn tại** trên route chưa nạp SOC chunk (⇒ mọi rule dùng nó sẽ rơi về `transparent`/không khai báo ở đó — đây chính là nguồn của giả thuyết R9 đã bị bác, xem §6).

**Số token conflict (đếm tĩnh, lệnh trong repo):**

```bash
node packages/web/scripts/measure-theme-tokens.mjs --token-conflict
```

| Mode (định nghĩa: cùng token, **khác giá trị**, khai ở ≥2 khối; khối `:root[data-theme="light"]` bị loại) | Kết quả | Baseline plan |
|---|---|---|
| mode B (`:root` + `@theme`) | **13** | 13 ✔ **không đổi** |
| mode A (`:root` thuần) | **11** | 11 ✔ **không đổi** |

Phạm vi đếm: `packages/web/src/index.css` (khối `@theme` + mọi khối `:root`) · `packages/web/src/theme/tokens.css` · `packages/web/src/components/soc/soc.tokens.css`.
**Không sửa 1 dòng CSS nào** trong slice này ⇒ số conflict **bằng nguyên baseline** (xác minh thêm bằng `git diff --numstat` — không có file CSS nào trong diff).

---

## 4. Hai phương án để Owner chọn (mỗi cái có số đo)

### (a) Làm light theme **đúng** (canvas sáng ⇒ phải sửa *mọi* chỗ đảo màu)

Mô phỏng SIM-A (inject `:root[data-theme="light"]{--color-bg-primary:#f8fafc}` — **không sửa app**):

| Route | H1 sau khi canvas sáng | Chữ dưới WCAG AA (light thật → SIM-A) | Kết luận |
|---|---|---|---|
| `/admin/users` | `#020617` trên `#f8fafc` = **19.2806:1** | 28/60 → **22/60** | ✔ sửa được |
| `/operations-center?tab=vnbroker` | `#f1f5f9` trên `#f8fafc` = **1.0471:1** | 20/60 → **17/60** | ✘ **vô hình** |
| `/dashboard` | `#f1f5f9` trên `#f8fafc` = **1.0471:1** | 14/60 → **29/60** | ✘ **vô hình** (tệ hơn: chữ sáng cứng càng nhiều, hỏng càng nhiều) |
| `/portfolios/manage` | `#0f172a` trên `#ffffff` = **17.8525:1** | 9/60 → **11/60** | ✔ (trang này có nền sáng riêng) |

⇒ **(a) KHÔNG phải đổi 1 token.** Nó đòi sửa **mọi chỗ dùng màu chữ sáng cứng** (vì canvas sáng ⇒ chữ sáng biến mất). Quy mô đo được (lệnh trong repo: `node packages/web/scripts/measure-theme-tokens.mjs --scan-hardcoded` — quét `packages/web/src/**/*.{ts,tsx,js,jsx}`, bỏ qua biến thể `dark:`):

| Chỉ số | Số đo |
|---|---|
| Tổng file JS/TS trong `packages/web/src` | **585** |
| Chỗ dùng màu chữ sáng cứng (`text-white` \| `text-slate-100…400`, **không** kèm `dark:`) | **497 chỗ trong 89 / 585 file** |
| Chỗ dùng class nền tối cứng (`bg-gray-950` \| `bg-slate-950` \| `bg-[var(--color-bg-primary)]`) | **76 chỗ trong 36 file** |
| File CSS **có** khối `:root[data-theme="light"]` **thật** (bỏ qua dòng trong comment) | **4 file**: `theme/tokens.css:65` · `components/soc/soc.tokens.css:124` · `components/aiSettings.module.css:31` · `components/ShellPageTemplate.module.css:24` |

⇒ (a) là **W1–W3 trở lên**, không phải W0. Ước lượng: ≥ **89 file / 497 chỗ** màu chữ cứng phải rà (file nhiều nhất: `components/WhaleBubbleChart.jsx` **59 chỗ**, `components/dashboard/PortfolioHeatmap.js` **18**), thêm **36 file** có nền tối cứng.

### (b) **Tắt** light theme khỏi bộ chọn cho tới khi đủ token

| Việc | File |
|---|---|
| Gỡ option "Sáng" khỏi `<select name="theme">` | `packages/web/src/pages/UserSettingsPage.tsx:206-209` |
| Chặn boot bằng theme sáng đã lưu | `packages/web/src/main.tsx:259-270` (`localStorage['vninvest-theme']`) |
| (tuỳ) ép `profile.theme` về `dark` | `packages/web/src/pages/UserSettingsPage.tsx:109` (`profile.theme ?? "light"` → nên đổi fallback) |

Số đo của (b) = **trạng thái dark hiện tại**, đã đo ổn định: H1 `/admin/users` **20.1728:1**, H1 `/operations-center` & `/dashboard` **18.4140:1**, H1 `/portfolios/manage` **17.6506:1**; số phần tử dưới WCAG AA **8** trên mọi route (8/60 · 8/60 · 8/60 · 8/60) — *bằng đúng* mức nền của dark.

---

## 5. Câu hỏi chặn Owner

> **Owner chốt: W0.2' làm theo (a) hay (b)?**
> **(a)** làm light theme đúng ⇒ thêm 1 wave sửa **≥89 file / 497 chỗ** màu chữ cứng + **36 file** nền tối cứng (đo ở §4a), và mọi trang phải được đo lại bằng `measure-theme-tokens.mjs`;
> **(b)** tắt light theme khỏi bộ chọn (`UserSettingsPage.tsx:206-209` + `main.tsx:259-270`) cho tới khi đủ token ⇒ chi phí ~3 dòng, mọi trang về dark với số đo đã ổn định ở §4b.
> *(Trung gian, không khuyến nghị: giữ nguyên UI nhưng **cảnh báo** cho user khi họ bật Sáng — không sửa được gốc, chỉ che triệu chứng.)*

---

## 6. Ghi chú: **claim sai đã bị bác** (R9 của plan)

Giả thuyết ban đầu trong plan (audit v1.0) là: *"`--bg-panel-solid` chỉ có trong SOC chunk ⇒ panel modal/drawer bị **trong suốt** ở light theme"* ⇒ **SAI**, và **đã bị gỡ khỏi scope** (audit v1.1 O10). Bằng chứng:

1. `--bg-panel-solid` **có** thật: `packages/web/src/components/soc/soc.tokens.css:18` → `--bg-panel-solid: rgb(var(--soc-rgb-081734));` (đo trên staging: `/portfolios/manage` → `--bg-panel-solid` = **`rgb(8 23 52)`**, light theme = **`#ffffff`**).
2. Route **duy nhất** render panel đó **đã** nạp SOC chunk: `packages/web/src/pages/PortfoliosPage.tsx:32` → `import "../components/soc/soc.tokens.css";` ⇒ token có mặt trước khi panel được vẽ.
3. Consumer duy nhất của `theme.module.css` là `packages/web/src/components/WorkstationShell.tsx` — và nó chỉ làm `void theme;` (`WorkstationShell.tsx:32`, import ở `:3`) ⇒ class `.modalContent` (khai ở `theme.module.css:257`) **không bao giờ được áp dụng** ⇒ **`theme.module.css:260` (`background-color: var(--bg-panel-solid);`) là CSS CHẾT**.
4. Panel thật dùng `background: var(--bg-panel-solid)` ở `packages/web/src/pages/portfolio/manage/portfolioManage.css:407` (`.pfm-modal__panel`) và `:504` (`.pfm-drawer__panel`); markup ở `packages/web/src/pages/portfolio/manage/PortfolioFormDialog.tsx:94` và `packages/web/src/pages/portfolio/manage/PortfolioManageDrawer.tsx:251` (2 file này là **consumer duy nhất** của 2 class đó — đã quét toàn `packages/web/src`).

⇒ **Kết luận:** panel **đã đục sẵn**, không phải nguồn của lỗi light theme. **Không thêm token mới** trong W0 (thêm `--bg-panel-solid` vào `theme/tokens.css` sẽ **tạo** conflict **13 → 14** ⇒ làm đỏ gate baseline-locked `check-token-conflict` ⇒ tự làm hỏng AC-4).

---

## 7. Việc **KHÔNG** làm trong W0 (đừng hiểu nhầm là đã sửa)

| Không làm | Vì sao |
|---|---|
| **KHÔNG** sửa `packages/web/src/theme/tokens.css` | NG-6 — thêm token mới ⇒ conflict 13→14 ⇒ đỏ gate của S2 |
| **KHÔNG** sửa `packages/web/src/index.css` | NG-4 — nhóm `--color-*` của Tailwind |
| **KHÔNG** sửa `packages/web/src/components/soc/**` | NG-5 — PR #271 chưa merge ⇒ tránh xung đột |
| **KHÔNG** sửa `adminUi.tsx` (bỏ `text-slate-950`) | R4 — sửa H1 admin sẽ làm hỏng panel nền trắng (20.1728:1 → 1.0955:1) |
| **KHÔNG** thêm `--bg-panel-solid` vào `theme/tokens.css` | §6 — panel đã đục, thêm token chỉ làm tăng conflict |
| **KHÔNG** tắt/toggle light theme trong code | Chưa có quyết định của Owner ⇒ chưa sửa (NG-1 của plan) |
| **KHÔNG** chụp/ghi file ảnh vào repo | Script đo không ghi file nào ⇒ working tree sạch |

⇒ **Light theme HIỆN VẪN HỎNG.** Tài liệu này chỉ **ghi nhận** + **đưa ra lựa chọn**, không phải bản sửa.

---

## 8. Rủi ro còn lại (đo được)

| # | Rủi ro | Số đo | Mức |
|---|---|---|---|
| R-1 | User bật "Giao diện: Sáng" ⇒ **tiêu đề admin biến mất** | H1 `/admin/users` = **1.0000:1**; **28/60** chữ dưới WCAG AA (dark 8/60) | **P0** (chưa ai bị chặn, nhưng lỗi hiển thị rõ ràng) |
| R-2 | Light theme **không** phải trạng thái hiếm | Backend mặc định `ThemeChoices.DARK` (`identity_access/models.py:165` và `:522`) ⇒ **opt-in**; nhưng `UserSettingsPage.tsx:109` fallback là `"light"` khi `profile.theme` rỗng, và toggle **đang tồn tại** (`:206-209`) | **P1** |
| R-3 | `--bg-panel` khác nhau giữa các route cùng dark theme | `/dashboard` `#0f172a` vs `/admin/users` `rgba(8 23 52 / .4)` | **P1** |
| R-4 | `--bg-panel-solid` **không tồn tại** trên route chưa nạp SOC chunk | `/dashboard` → `(KHÔNG định nghĩa)` | **P2** |
| R-5 | Nếu Owner chọn (a) mà làm "nửa" (chỉ đổi canvas) | SIM-A: H1 `/dashboard` & `/operations-center` → **1.0471:1** (vô hình) ⇒ **tạo lỗi mới** | **P0** nếu làm nửa |
| R-6 | Số đo gắn với app đang chạy, không phải `dev` | staging = `6a127002e` (`feat/vnbroker-console`) ≠ base `e7b008f25` | **P2** — đã ghi rõ sha trong mọi lần đo |

---

## 9. Tái lập

```bash
# 1) ĐO (cần staging + playwright chromium trong packages/web)
node packages/web/scripts/measure-theme-tokens.mjs            # báo cáo đầy đủ + CONTROL
node packages/web/scripts/measure-theme-tokens.mjs --json     # cùng dữ liệu, dạng máy đọc được
node packages/web/scripts/measure-theme-tokens.mjs --token-conflict   # đếm conflict (tĩnh, không cần mạng)
node packages/web/scripts/measure-theme-tokens.mjs --scan-hardcoded   # quét tĩnh bán kính ảnh hưởng phương án (a)

# 2) Nếu KHÔNG có staging ⇒ script in "CHUA CHAY: <lý do>" và exit 0 (không chặn push)
#    BASE_URL=http://localhost:5173 node packages/web/scripts/measure-theme-tokens.mjs

# 3) Sha đang chạy trên staging (script tự đọc qua SSH; có thể ép bằng env)
ssh -i "$HOME/.ssh/id_ed25519" root@14.225.255.47 "cd /opt/vninvest && git rev-parse HEAD"
#   => 6a127002e392a8aa66484ee33e61c119ec9a36d8 (branch feat/vnbroker-console)

# 4) Đối chiếu dòng trích dẫn giữa base và commit đang chạy
git show e7b008f25:packages/web/src/index.css | sed -n '53p'
git show 6a127002e:packages/web/src/index.css | sed -n '53p'
git show 6a127002e:packages/web/src/components/soc/soc.tokens.css | sed -n '143,144p'

# 5) Token conflict phải giữ nguyên 13 (mode B) / 11 (mode A) — AC-1
node packages/web/scripts/measure-theme-tokens.mjs --token-conflict | findstr /C:"MODE"
```

**Mọi số trong tài liệu này đều kèm lệnh tái lập** (mục 1–3 dùng chung 1 lệnh `measure-theme-tokens.mjs`).

> **Bằng chứng phụ (đo trong trình duyệt, không phải suy luận):** màu `oklch()` do `getComputedStyle` trả về được ép về `rgba` bằng **span tạm + canvas 1×1** trong chính browser (L-V06) ⇒ không parse chuỗi bằng regex; nền hiệu dụng được **composite nhiều lớp** từ phần tử lên `<html>`; mọi số contrast đi qua **cùng một hàm** với **control** `#fff`/`#000` = 21.00 và `#777`/`#fff` = 4.48 (chạy 32/32 lần khớp).
>
> **Dữ liệu thô của lần đo cuối (JSON):** `node packages/web/scripts/measure-theme-tokens.mjs --json` (lưu ra ngoài repo; **không** commit file đo vào repo để giữ working tree sạch — L-V03).

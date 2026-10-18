# PLAN — Nâng cấp UI/UX `/settings/ai` (AI Command Center)

> **Artifact Stage 1** của skill `multi-agent-workflow` (Mode B — bounded solo loop).
> **Slice tài liệu, không phải code.** Người thực thi plan này **không có** ngữ cảnh của phiên audit — mọi khẳng định dưới đây đều tự chứa minh chứng.

| | |
|---|---|
| **Task** | `ai-cc-uiux` |
| **Branch** | `feat/ai-cc-uiux` → `dev` |
| **Baseline đo** | `dev` @ `295dc15d8`, working tree sạch |
| **HEAD khi lập plan** | `6037303c5` (commit claim, cha = `295dc15d8`) |
| **Ngày** | 2026-10-18 |
| **Claim** | `docs/CLAIMS.md:1605-1609`, trạng thái `in-progress` |
| **Lessons áp dụng** | L-001, L-002, L-003, L-007, L-008, L-M02, L-A01, L-F01, L-F02, L-F03, L-F05, L-F06, L-F08, L-F09, L-F10, L-G01, L-G02, L-G04, L-G05, L-G06, L-G07, L-G08, L-V01, L-V02, L-V03, L-V04, L-V05, L-T01, L-T02 |
| **Skill** | `ui-skills-root` (router) → `improve-ui` (methodology) → `web-design-guidelines` (checklist) |
| **Sai lệch quy trình đã biết** | `improve-ui` yêu cầu ghi plan vào `design-plans/`. **Không làm** — `multi-agent-workflow` §0: "repo's own file wins on conflict", và `docs/AGENT_PROTOCOL.md` quy định artifact ở `docs/`. |

---

## 0. SCOPE / LIMIT

### SCOPE — file được phép sửa

| File | Slice nào sửa |
|---|---|
| `packages/web/src/pages/AICommandCenterPage.tsx` | S1, S2, S3, S4 |
| `packages/web/src/components/AICommandCenterForm.tsx` | S0, S2 |
| `packages/web/src/pages/UserSettingsPage.tsx` | S4 (Q2 — link nhãn ngắn, `UserSettingsPage.tsx:275-276`) |
| `packages/web/src/components/Breadcrumb.tsx` | S4 (Q2 — `AI_ROUTE_LABELS`) |
| `packages/web/src/shared/providerModels.ts` | S3 |
| `packages/web/src/i18n/vi.js` | S3, S4 (**chỉ thêm key mới**) |
| `packages/web/src/i18n/en.js` | S3, S4 (**chỉ thêm key mới**) |
| `packages/web/scripts/check-ai-cc.mjs` | S5 (**KHÔNG** nối vào `package.json` — deny-list) |
| `packages/web/src/pages/AICommandCenterPage.component.test.js` | S4 (Q3 — 3 dòng `:37,:159,:167` tham chiếu `aiCommandCenter.eyebrow`) |
| `packages/web/src/pages/__tests__/ai-hub-breadcrumb.component.test.tsx` | S4 (AC4.2 thêm case) |
| `docs/CLAIMS.md`, `docs/CODE_CHANGE_AUDIT_LEDGER.md` | mọi slice |

**KHÔNG sửa** (đã khai ở bản v1 nhưng không AC nào đụng — bỏ khỏi SCOPE để không vi phạm `LIMIT`):

| File | Vì sao không sửa |
|---|---|
| `packages/web/src/components/AiHubNav.tsx` | Q1 xoá nav ở **page**, không đụng `AiHubNav`. Hệ 5 tab giữ nguyên. |
| `packages/web/src/components/aiSettings.module.css` | Q1 **không** xoá class `.hubNav*` — `AiHubNav.tsx:117` vẫn là consumer. Không cần sửa CSS cho 4 quyết định. |

**TẠO MỚI** (test đi kèm từng slice — không tính vào giới hạn file sửa):

| File | Slice |
|---|---|
| `packages/web/src/pages/__tests__/ai-cc-single-nav.component.test.tsx` | S1 |
| `packages/web/src/pages/__tests__/ai-cc-config-layers.component.test.tsx` | S2 |
| `packages/web/src/pages/__tests__/ai-cc-enum-labels.component.test.tsx` | S3 |
| `packages/web/src/shared/__tests__/providerModels.component.test.ts` | S3 |

### LIMIT

- **5 slice** (S0–S5). Không thêm scope nào ngoài danh sách trên.
- **Tối đa 3 lần thử** mỗi AC. Lần thứ 3 fail ⇒ ghi `blocker`, **dừng**, trả về trạng thái một phần nêu rõ AC nào đã PASS.
- **Không migration.** AI CC không đụng Django schema.
- **Không thêm dependency.** `package.json` nằm trong deny-list (§2 `AGENT_PROTOCOL.md`).

### OVERLAP PHẢI PHỐI HỢP

`pf-manage-rebuild` (`docs/CLAIMS.md:1223-1228`) từng sửa `packages/web/src/i18n/vi.js` + `en.js`.
**Trạng thái hiện tại (đọc lại @ `96cc87e12`): `done (PR #121; phần 1-3)`** — cột `status` tại `CLAIMS.md:1228`. Claim `audit-followup-5q` (`CLAIMS.md:1229`) cùng nhánh `feat/pf-manage-rebuild` cũng `done`.

⇒ **Rủi ro overlap thấp hơn nhiều so với dự đoán ban đầu** (bản plan v1 ghi `in-progress` dựa trên `Get-Content -Tail` — **stale**, đã sửa).

Vẫn giữ quy tắc phòng thủ cho tới khi branch `feat/pf-manage-rebuild` thực sự đóng:
- Chỉ **thêm key mới** ở cuối khối `aiCommandCenter`, **không** viết lại file, **không** `Get-Content|Set-Content` (L-F04).
- Trước khi commit: `git diff --numstat packages/web/src/i18n/vi.js` — mọi dòng khác nghĩa là đã đổi line-ending, **dừng lại** (L-T01).
- Không cần worktree riêng cho `i18n` nếu PR #121 đã merge vào `dev`.

---

## 1. Design language

| | |
|---|---|
| **Audited surface** | Route `/settings/ai` + 4 sub-route `/settings/ai/{usage,traces,slo,audit}`, entry `AICommandCenterPage` |
| **Design sources** | **KHÔNG có `DESIGN.md`** (glob `**/DESIGN.md` → 0 hit). Nguồn thiết kế thực tế là: `packages/web/src/components/soc/soc.tokens.css` (185 dòng, 140 biến) + `soc.components.css` (4076 dòng) + `packages/web/src/theme/tokens.css`. `AGENTS.md` §Constraints ràng buộc SOC glassmorphism. |
| **Documented decisions** | `L-F08` — Việt Nam dùng chuẩn Bloomberg: **xanh = tăng, đỏ = giảm**; token `--pf-gain`/`--pf-loss` (Owner chốt 2026-10-07). Plan này **không** đụng màu tăng/giảm. |
| **Governing owners** | `AiHubNav.tsx` = hệ tab route dùng chung 5 route AI. `ShellPageTemplate.js:69` `ShellPanel` = primitive panel (render `h2` tại `:80`). `providerModels.ts:4-5` = interface `ProviderModelOption` **đã có** field `labelKey?`. |
| **Explicit exceptions** | **None documented.** |
| **Ba hệ token cùng sống** | `aiSettings.module.css` khai 13 token `--ai-*` ở `:root` toàn cục (`:55-69`) **và** dùng `var(--ai-surface)` chứ không dùng class của `soc.components.css`. Hai hệ **không dùng chung class nào**. Đây là nợ kiến trúc, **không** thuộc SCOPE plan này (xem §6 Non-goals). |

---

## 2. Findings

Skill `improve-ui` §5 giới hạn **3 findings** sau khi đã sàng lọc. Mỗi finding phải qua đủ 3 phép chứng minh: **Contract** (quy tắc/điểm mâu thuẫn trong chính UI) · **Runtime** (đường chạy thật tới bề mặt) · **Correction** (đúng 1 sửa, không bịa ý đồ sản phẩm).

### F1 — Hai thanh điều hướng chồng nhau, giống hệt nhau, trùng nhãn · **BLOCKER**

| | |
|---|---|
| **Contract** | Trong **cùng một tác vụ**, trang render **hai** thanh tab dùng **cùng một bộ class CSS** và **trùng nhãn ở 2/3 mục**, trỏ tới **3 mục tiêu khác nhau**. Đây là mâu thuẫn trực tiếp trong nội dung hiển thị của cùng tác vụ. |
| **Runtime** | `AICommandCenterPage.tsx:227` → `AiHubNav` (5 tab route: Tổng quan · Usage AI · Dấu vết AI · SLO AI · Nhật ký audit). `AICommandCenterPage.tsx:229-245` → `<nav className={styles.hubNav}>` thứ 2 (3 anchor: Tổng quan · Runtime · Nhật ký audit). Cả hai dùng `styles.hubNav`/`hubNavLink`/`hubNavLinkActive` — `aiSettings.module.css:132,145,169` — **không có modifier nào phân biệt**. Cả hai nhận **cùng** `aria-label: t("aiCommandCenter.title")` (`:229` vs `AiHubNav.tsx:117`). `AiHubNav` được gọi **không truyền `className`** ⇒ không ghi đè được (`AiHubNav.tsx:60` default `""`). |
| **Cơ chế 2 ô "Tổng quan" cùng sáng** | `AiHubNav.tsx:79` `active: location.pathname === "/settings/ai"` **ĐÚNG** khi vừa tải. `AICommandCenterPage.tsx:233` `location.hash === "#overview" \|\| (!location.hash && location.pathname === "/settings/ai")` **ĐÚNG** khi vừa tải. ⇒ **Không có hash nào thì CẢ HAI ô "Tổng quan" đều active cùng lúc.** Xác minh bằng đọc mã, không phải suy luẫn. |
| **Nhãn trùng là cùng khoá i18n** | `tabOverview` = `"Tổng quan"` (`vi.js:5412`) dùng cho **cả** anchor (`AICommandCenterPage.tsx:234`) và tab route (`AiHubNav.tsx:78`). `tabAudit` = `"Nhật ký audit"` (`vi.js:5414`) dùng cho **cả** anchor (`AICommandCenterPage.tsx:244`) và tab route (`AiHubNav.tsx:109`). Anchor `"Nhật ký audit"` → `#audit` (panel trong trang), tab route `"Nhật ký audit"` → `/settings/ai/audit` (**một route riêng**). |
| **Correction** | **Xoá `<nav>` anchor thứ 2** khỏi `AICommandCenterPage.tsx:229-245`. Lý do đủ để xoá: `#overview` = đầu trang (đã là nơi đổ bậy), `#audit` **trùng nghiệp vụ** với route `/settings/ai/audit` đã tồn tại, `#runtime` = panel thứ 3 trong cùng trang. Sau khi xoá: **1 hệ điều hướng duy nhất**. |
| **Confidence** | **high** — đọc trực tiếp 2 file mã + 1 file CSS, không suy luận. |

> **Đã cố phản chứng và không thất bại:** (a) nav thứ 2 có bị ẩn với non-staff không? — không có điều kiện nào; (b) 2 thanh có khác style không? — cùng class, `AiHubNav` không nhận `className`; (c) đây có phải 2 hệ cố ý không? — không có tài liệu nào ghi như vậy, `docs/audit-uiux/*` chưa từng báo lỗi này.

---

### F2 — Tùy chọn **cá nhân** nằm trong panel **chính sách hệ thống** · **MAJOR**

Đây là **gốc rễ trực tiếp** của nhận xét *"lẫn lộn cài đặt tài khoản và cấu hình trung tâm AI"*.

| | |
|---|---|
| **Contract** | Panel tên `operationPolicy` = **"Chính sách vận hành"** (`vi.js:5380`) — ngữ nghĩa **hệ thống**. Ô đầu tiên trong panel là `eventGate` = **"Gate sự kiện"** (`vi.js:5381`) — đây là **tùy chọn cá nhân của user**. Trang đặt tên mình là cấu hình trung tâm AI (`vi.js:5409`) nhưng breadcrumb của nó là **"Cài đặt tài khoản"** (`vi.js:2487` qua `Breadcrumb.tsx:49`). Ba nhãn, ba khái niệm khác nhau trên **cùng một màn hình**. |
| **Runtime** | `AICommandCenterPage.tsx:119-134` đọc `getUserConfig()` → `userConfig?.preferences.advisory_whale_signal_enabled`. `AICommandCenterPage.tsx:175` gọi `updateUserConfig({ advisory_whale_signal_enabled })`. Đây là **endpoint + kho lưu khác hẳn** AI CC config — adapter AI CC khai ở `AICommandCenterPage.tsx:32-36` (`getAICommandCenterConfig` / `updateAICommandCenterConfig` / `testAICommandCenterConnection`). Render tại `:262-276` trong `ShellPanel` title `operationPolicy` (`:260`). |
| **Correction** | **Tách `eventGate` ra khỏi panel "Chính sách vận hành"** — chuyển nó sang một panel riêng mang tên đúng bản chất (tùy chọn cá nhân), hoặc bỏ hẳn khỏi trang này nếu đã có nơi khác chứa nó. 1 sửa. |
| **Confidence** | **high** — đọc trực tiếp 2 nhánh ghi/đọc, xác nhận khác endpoint. |

---

### F3 — 2 giá trị hiển thị hai nơi; 1 giá trị **không sửa được ở bất kỳ đâu** · **MAJOR**

| | |
|---|---|
| **Contract** | Panel "Chính sách vận hành" hiện 3 số; ngay bên dưới, form "CẤU HÌNH AI RUNTIME" sửa **2 trong 3** số đó với **tên khác nhau**. Người dùng thấy "24" ở trên (chỉ đọc) và "24" ở dưới (sửa được) — không có tín hiệu nào cho biết chúng là cùng một thứ. |
| **Runtime — trùng 2 field** | `advisory_refresh_interval_hours`: đọc để hiển thị `AICommandCenterPage.tsx:112` (`refreshIntervalDisplay`) + render `:277-280`; sửa `AICommandCenterForm.tsx:272` (`setRefreshInterval(data.advisory_refresh_interval_hours \|\| 24)`) + input `:764-783`. |
| | `advisory_max_tokens_per_day`: hiển thị `AICommandCenterPage.tsx:114` + render `:285-288`; sửa `AICommandCenterForm.tsx:271` (`setMaxTokens(...)`) + input `:745-760`. |
| **Tên khác nhau** | Panel: `refreshInterval` = "Khoảng làm mới" + `refreshIntervalValue` = **"24 giờ/lần"** (`vi.js:5385,5541`). Form: `refreshIntervalLabel` = **"Khoảng làm mới tự động (giờ)"** (`vi.js:5497`). Panel: `tokensPerDay` = "Token/ngày" (`5387`). Form: `maxTokensLabel` = "Định mức Token / ngày" (`5496`). |
| **Runtime — giá trị mồ côi** | `advisory_max_auto_refreshes_per_day` hiển thị tại `AICommandCenterPage.tsx:113` + render `:281-284` (ô "Auto refresh/ngày"). Quét **đệ quy toàn bộ** `packages/web/src` (581 file `.ts/.tsx/.js/.jsx`, script Node, `@ 96cc87e12`) cho chuỗi này ra **10 hit**: `AICommandCenterForm.tsx:31` (khai báo type) · `AICommandCenterPage.tsx:113` (chỗ đọc) · `pages/signals/WhaleAdvisoryPage.tsx:28,548` (type + hiển thị ở trang khác) · 5 hit trong `__tests__/` (`ai-cc-contract-smoke.component.test.ts:27,44,168`, `whale-advisory-banner.component.test.tsx:79,102`, `AICommandCenterPage.component.test.js:226`). **Không hit nào là `<input>`/`<select>` ghi giá trị này.** Người dùng thấy một con số không thể sửa ở bất kỳ đâu. |
| ⚠ **Đính chính (v2)** | Bản plan v1 ghi "3 hit" — **sai**, do quét bằng wildcard PowerShell `src\**\*.tsx` bỏ sót file. Số đúng là **10**. Kết luận "không có ô nhập" **vẫn đúng**, nhưng con số ở bản v1 không. Đã ghi vào `docs/CODE_CHANGE_AUDIT_LEDGER.md`. |
| **Correction** | **Bỏ 2 metric trùng** (`refreshInterval`, `tokensPerDay`) khỏi panel chính sách; giữ lại `autoRefreshPerDay` và **gắn nhãn nó là chỉ đọc** (hoặc thêm field sửa — nhưng đó là scope BE, nêu ở §6 Non-goals). 1 sửa. |
| **Confidence** | **high** — đọc trực tiếp + grep toàn repo bằng chuỗi đầy đủ, không suy ra từ việc "không nhớ thấy". |

---

### `## Improve first`

**F1 (hai thanh tab chồng nhau).** Vì sao: nó là **điều Owner nhìn thấy đầu tiên và nêu tên**; nó xuất hiện ở **mọi** lần truy cập `/settings/ai` (100% reach); nó là **nguyên nhân vì sao "Cài đặt" (eyebrow `vi.js:5410`) đọc như nhãn của cả trang trong khi breadcrumb nói "Cài đặt tài khoản"**; và nó **rẻ nhất để sửa** (xoá ~17 dòng, 0 migration, 0 dependency). Sửa F1 làm F2 và F4 dễ định vị hơn vì mất đi một lớp nhãn trùng.

---

### Ngoài 3 findings (đã verify, đưa vào backlog S3–S5)

Không phải 3 finding trên, nhưng đều có bằng chứng và **có trong plan**:

| ID | Vấn đề | Bằng chứng |
|---|---|---|
| B1 | `effectiveSource` render giá trị thô `command_center` | `AICommandCenterPage.tsx:253` render thẳng `effectiveSource`; state khởi tạo là chuỗi hằng `"command_center"` tại `:72`. BE: `portfolio_analytics_views.py:1176,1301,1492,1580` — `metadata.get('effective_ai_source') or 'command_center'`. Grep toàn backend (7 hit) ⇒ **không chỗ nào ghi** key này ⇒ hôm nay giá trị **luôn** là `command_center`. `effectiveSourceDesc` (`vi.js:5374`) tự viết *"command_center hoặc system fallback"* ⇒ chính bản dịch đã thừa nhận lộ enum. |
| B2 | `effectiveProvider` render key thô (`gemini`) | `AICommandCenterPage.tsx:251`. `PROVIDER_OPTIONS` (`providerModels.ts:67-73`) **0/5** có `labelKey`, trong khi interface `ProviderModelOption` **đã có** field `labelKey?` (`:4-5`) ⇒ primitive có sẵn, chưa dùng. Render tại `AICommandCenterForm.tsx:584-586` dùng `t(p.labelKey ?? p.label)` ⇒ fallback về chuỗi thô tiếng Anh. |
| B3 | `entry.source` lộ vào "Lịch sử prompt" | `AICommandCenterPage.tsx:416` |
| B4 | 4 tên gọi khác nhau cho **cùng 1 trang** | Sidebar `sidebaritems.ts:39` → "Trung tâm AI" (`vi.js:98`) · Breadcrumb `Breadcrumb.tsx:50` → "Trí tuệ nhân tạo" (`vi.js:2490`) · H1 `AICommandCenterPage.tsx:219` → "Trung tâm điều hành AI" (`vi.js:5409`) · Link từ `/settings` `UserSettingsPage.tsx:276` → "Mở trung tâm AI" (`vi.js:2492`). Thêm nữa eyebrow `vi.js:5410` = "Cài đặt" — trùng khái niệm với crumb 1 "Cài đặt tài khoản" trên cùng màn hình. ⚠ Số dòng nhãn ở `en.js` **lệch** so với `vi.js` (ví dụ `title`: `vi.js:5409` ↔ `en.js:5342`) — luôn tra đúng file khi sửa. |
| B5 | `SUB_AGENT_PROMPT_FIELDS` khai trong thân component, thiếu dep | `AICommandCenterForm.tsx:181-186` khai 4 hằng số **bên trong** thân hàm component ⇒ mất identity mỗi render; `:305` `useCallback` (`applySettings`) thiếu dep ⇒ **`npm run lint` exit 1** (xem §3). |
| B6 | `--ai-accent-soft` **không bao giờ resolve** (cả 2 theme) | `aiSettings.module.css:60` khai `--ai-accent-soft: var(--accent-cyan-soft, rgba(18,199,232,.22))`. Quét đệ quy **21 file `.css`** trong `packages/web/src` (script Node, `@ 96cc87e12`): `--accent-cyan-soft` có **0 định nghĩa**, **2** `var()` sử dụng — `aiSettings.module.css:60` (có fallback) và **`pages/WatchlistPage.css:407`** `background: var(--accent-cyan-soft);` (**không fallback** ⇒ nền trong suốt). ⚠ **Đính chính 2 lần:** (a) bản v1 nói `--ai-border-strong` (`:62`) cũng không resolve — **sai**, `--border-strong` **có** 2 định nghĩa `soc.tokens.css:11,123`; (b) bản v2 nói **1** `var()` sử dụng — **sai**, thật là **2**, và file thứ hai nằm **ngoài SCOPE** (objection N9). |
| B7 | 15 nhãn VI viết **không dấu** | `vi.js:5449-5463` — bao gồm `titleAudit` = `"Nhat ky kiem toan AI"` và 6 nhãn cột bảng audit hiển thị trực tiếp cho staff. Vi phạm quy ước "Vietnamese labels full dấu" (`AGENTS.md` §Constraints). |

---

## 3. Baseline gate — đo THẬT trên `dev` sạch

Đo tại `6037303c5`, **không sửa dòng code nào**. Lệnh chạy từ `packages/web/`.

| # | Gate | Lệnh | Exit | Ghi chú |
|---|---|---|---|---|
| G1 | Type-check | `npx tsc --noEmit` | **0** ✅ | |
| G2 | Lint | `npm run lint` | **1** ❌ | **1 error**: `AICommandCenterForm.tsx:305` `react-hooks/exhaustive-deps` thiếu `'SUB_AGENT_PROMPT_FIELDS'`; 4156 warning |
| G3 | Tokens | `npm run check:tokens` | **1** ❌ | Lỗi **có sẵn, không thuộc surface này** (`src/components/brokerData/brokerData.css: #c4b5fd`) |
| G4 | Contrast | `npm run check:contrast` | **0** ✅ | Chỉ đo 7 tone pair admin. **KHÔNG phủi `/settings/ai`** ⇒ không dùng làm bằng chứng cho trang này |
| G5 | i18n strict | `npm run i18n:scan:strict` | **0** ✅ | |
| G6 | AI CC gate | `node ./scripts/check-ai-cc.mjs` | **0** ✅ | 10/10 PASS |
| G7 | UI/UX budget | `node ./scripts/check-uiux-budget.mjs` | **1** ❌ | **ĐÃ ĐỎ**: CSS-1 0→4 · CSS-2 46→55 · I18N-1 0→1 · A11Y-9 5→8 · NAV-1 89→37 (giảm) |
| G8 | Test component | `npm run test:components` | **0** ✅ | 164 file / 1122 test PASS (112.58s) |

### ⚠ Hệ quả bắt buộc (hazard 6 — kế hoạch đòi PASS một gate vốn đang đỏ)

**G2, G3, G7 đang đỏ trên `dev` sạch.** Vì vậy:

- **KHÔNG** viết AC nào đòi `npm run lint` exit 0 **nếu chưa xử lý B5** (chính B5 là error duy nhất của G2).
- **KHÔNG** viết AC nào đòi `check:tokens` exit 0 — lỗi nằm ở `brokerData.css`, **ngoài SCOPE**. AC chỉ được đòi *"check:tokens không có hit mới trong file thuộc SCOPE"*.
- **KHÔNG** viết AC nào đòi `check-uiux-budget` exit 0. AC chỉ được đòi **"3 chỉ số CSS-1 / CSS-2 / I18N-1 không tăng thêm so với baseline 4 / 55 / 1"**, và nêu rõ gate tổng vẫn đỏ.
- Ghi `CHƯA CHẠY` cho mọi thứ không chạy. **KHÔNG** báo `PASS` cho thứ chưa chạy (L-G02).

---

## 4. Slice + Acceptance criteria

Mỗi AC có **lệnh tái tạo** (hazard 13). AC viết **trước** lần sửa đầu tiên (hazard 12).

---

### S0 — Gỡ 1 lỗi lint chặn cả file · **BLOCKER, làm trước mọi thứ**

**Bối cảnh:** `AICommandCenterForm.tsx:305` là lỗi `error` **duy nhất** của toàn bộ `npm run lint`. S2 và S5 đều sửa file này ⇒ không gỡ thì mọi AC "lint sạch" về sau đều không kiểm chứng được.

**File:** `packages/web/src/components/AICommandCenterForm.tsx`

- **AC0.1 — Given** `SUB_AGENT_PROMPT_FIELDS` được dùng ở `:181-186`, `:298`, `:377`, `:415`, `:420`, `:894`.
  **When** kéo nó ra khỏi thân component, lên **cấp module** (ngay sau `const e = createElement;` tại `:17`), đặt tên giữ nguyên, thêm comment 1 dòng giải thích vì sao phải ở cấp module.
  **Then** `npm run lint` **không còn** dòng error `react-hooks/exhaustive-deps` trong file này.
  *Tái tạo:* `npm run lint 2>&1 | Select-String "AICommandCenterForm.tsx" -Context 0,2`
  *Fail-before:* tại `6037303c5` lệnh trên in `305:5 error React Hook useCallback has a missing dependency: 'SUB_AGENT_PROMPT_FIELDS'`.

- **AC0.2 — Given** hằng đã lên cấp module.
  **When** chạy `npx tsc --noEmit`.
  **Then** exit **0**.
  *Tái tạo:* `npx tsc --noEmit; echo $LASTEXITCODE`

- **AC0.3 — Given** S0 xong.
  **When** chạy `npm run test:components`.
  **Then** exit **0** và **≥ 1122** test (không được mất test nào).
  *Tái tạo:* `npm run test:components`
  *Baseline:* 164 file / 1122 test PASS tại `6037303c5`.

**Non-goal S0:** không thêm `// eslint-disable-next-line` (hazard 18 — thêm dep để tắt lint đã hỏng 3 test một lần rồi).

---

### S1 — Bỏ thanh điều hướng thứ hai (F1)

**File:** `packages/web/src/pages/AICommandCenterPage.tsx`

- **AC1.1 — Given** trang `/settings/ai` render.
  **When** đếm phần tử `<nav>` có `aria-label` bằng giá trị của `aiCommandCenter.title`.
  **Then** kết quả **= 1**, không phải 2.
  *Tái tạo:* `npx vitest run src/pages/__tests__/ai-cc-single-nav.component.test.tsx` (test mới, xem AC1.4).
  *Fail-before:* tại `6037303c5` đếm ra **2** (`AICommandCenterPage.tsx:227` + `:229`).

- **AC1.2 — Given** trang `/settings/ai` vừa tải, `location.hash === ""`.
  **When** render.
  **Then** **không có phần tử nào** mang `aria-current="page"` trong **cả hai** hệ, và chỉ **một** mục "Tổng quan" mang trạng thái active.
  *Tại `6037303c5`:* `AiHubNav.tsx:79` (route tab, true) **và** `AICommandCenterPage.tsx:233` (anchor, true) ⇒ 2 mục active cùng lúc.
  *Tái tạo:* test mới assert `container.querySelectorAll('[aria-current="page"]').length === 1`.

- **AC1.3 — Given** đã xoá nav anchor.
  **When** chạy script kiểm 3 class `.hubNav*`.
  **Then** in `PASS` — cả 3 class **vẫn phải còn** và **vẫn còn consumer**.
  ⚠ **ĐÍNH CHÍNH (objection N4 vòng 2):** bản v2 viết Then là *"không còn class mồ côi nào"* — đó là **AC rỗng**: lệnh in `PASS` **ngay bây giờ, trước khi sửa**, nên AC xanh trước **và** sau ⇒ không bao giờ đỏ. Đã đổi thành kiểm đúng thứ liên quan tới S1.
  *Lệnh (PowerShell, byte-exact):*
  ```powershell
  node -e "const fs=require('fs');const c=fs.readFileSync('src/components/aiSettings.module.css','utf8');const used=['src/pages/AICommandCenterPage.tsx','src/components/AiHubNav.tsx'].map(f=>fs.readFileSync(f,'utf8')).join('');const need=['.hubNav','.hubNavLink','.hubNavLinkActive'];const miss=need.filter(x=>!c.includes(x+'{')||!used.includes('styles.'+x.slice(1)));console.log(miss.length?'FAIL thieu: '+miss.join(', '):'PASS: 3/3 class .hubNav* con va con consumer')"
  ```
  **Kết luận đã đo trước (Q1):** sau khi xoá nav anchor, `AiHubNav.tsx:117` **vẫn** dùng `styles.hubNav` ⇒ **KHÔNG xoá** 3 class này. Việc dọn **6 class mồ côi thật** (`.hubBackLink:175` `.panelActions:239` `.textarea:467` `.alertInfo:558` `.statusSuccess:620` `.statusDefault:1192` — đo bằng script quét đệ quy 125 class × 17 importer) **KHÔNG** thuộc Q1–Q4 ⇒ đưa sang **N10**, không làm ở đây.
  ⚠ **Giải quyết mâu thuẫn tiềm ẫn với AC1.4 (objection O13):** AC1.3 và AC1.4 là **hai kiểm tra khác nhau**, chạy ở **hai thời điểm khác nhau**. AC1.4 chạy **trên bản tiền-sửa** (file còn nguyên nav thứ 2) để chứng minh test đỏ trước; AC1.3 chạy **sau khi sửa xong**. Nếu AC1.4 trả xanh ⇒ test không có tác dụng ⇒ **dừng**, sửa test.

- **AC1.4 — Given** cần test hồi quy chứng minh **fail-before**.
  **When** chạy trình tự 5 bước dưới đây trên PowerShell.
  **Then** test **ĐỎ** trên bản tiền-sửa, **XANH** sau khi khôi phục; và **byte-size file khớp blob gốc** ở mọi bước.

  ⚠⚠ **BẪY ĐÃ ĐO — KHÔNG dùng `git show … > <file>` trên PowerShell.**
  Đo tại `96cc87e12`: blob gốc `AICommandCenterPage.tsx` = **20 984 byte**; `git show HEAD:<path> > <file>` ghi ra file **42 864 byte**, 2 byte đầu = **`255,254`** (UTF-16LE BOM) ⇒ **HỎNG FILE**. Mẫu `git show HEAD:<f> > <f>` trong `agent-lessons` §11 chỉ đúng với **bash**, sai trên PowerShell 5.1.

  ```powershell
  $f   = "src/pages/AICommandCenterPage.tsx"
  $keep= "$env:TEMP\keep-AICommandCenterPage.tsx"
  $sz0 = (git cat-file -s (git rev-parse "HEAD:packages/web/$f"))
  Copy-Item $f $keep                       # byte-exact
  cmd /c "git show HEAD:packages/web/$f > $f"     # cmd.exe redirect = byte-exact
  $sz1 = (Get-Item $f).Length
  if ($sz1 -ne $sz0) { throw "CORRUPT: $sz1 != $sz0 — cmd redirect hong, DUNG lai" }
  npx vitest run src/pages/__tests__/ai-cc-single-nav.component.test.tsx   # ky vong FAIL
  Copy-Item $keep $f                       # byte-exact khoi phuc
  $sz2 = (Get-Item $f).Length
  if ($sz2 -ne $sz0) { throw "CORRUPT after restore: $sz2 != $sz0" }
  ```

  ⚠ **KHÔNG** dùng `git checkout -- <file>` (L-A01 — đã mất việc 2 lần trong 1 session).
  ⚠ Sau **mỗi** lần ghi file bằng script: `git diff --numstat` (L-T01). Nếu `deletions` lớn bất thường ⇒ file bị viết lại toàn bộ ⇒ dừng (L-G05).

- **AC1.5 — Given** S1 xong.
  **When** chạy `npx tsc --noEmit` và `npm run test:components`.
  **Then** cả hai exit **0**, test count **≥ 1122**.

**Test file cần tạo ở S1:** `packages/web/src/pages/__tests__/ai-cc-single-nav.component.test.tsx` — 3 case: (1) đếm `<nav>` có `aria-label` = 1; (2) `aria-current="page"` = 1 khi `location.hash === ""`; (3) cả 5 tab route vẫn còn và dẫn đúng `href`.

**Nếu Owner muốn giữ điều hướng trong trang:** KHÔNG dùng `.hubNav`. Dùng primitive đã có sẵn của hệ SOC: `.subTabBar` / `.subTabBtn` / `.subTabBtnActive` (`soc.components.css:1442,1460,1482`) — khác hẳn về mặt thị giác, kèm `aria-label` riêng, và **3 nhãn phải khác 3 nhãn của tab route** (ví dụ "Cấu hình runtime" thay vì "Runtime"). Đây là **quyết định của Owner**, xem §7.

---

### S2 — Tách tùy chọn cá nhân khỏi chính sách hệ thống + dọn metric trùng (F2 + F3)

**File:** `packages/web/src/pages/AICommandCenterPage.tsx`

- **AC2.1 — Given** trang render với user **không phải** staff.
  **When** nhìn panel "Chính sách vận hành".
  **Then** **không** có ô "Gate sự kiện" trong đó.
  *Tại `6037303c5`:* `AICommandCenterPage.tsx:262-276` render `eventGate` **bên trong** `ShellPanel` `operationPolicy` (`:260`).
  *Tái tạo:* test mới — `container` render, query theo text `"Gate sự kiện"`, assert **không** nằm trong panel có `Chính sách vận hành`.

- **AC2.2 — Given** `eventGate` đã tách.
  **When** bấm checkbox đó.
  **Then** nó **vẫn** gọi `updateUserConfig` — hành vi không đổi, chỉ đổi chỗ hiển thị.
  *Tái tạo:* test mới mock `updateUserConfig`, bấm, assert được gọi với `{ advisory_whale_signal_enabled: false }`.

- **AC2.3 — Given** panel chính sách sau khi dọn.
  **When** đếm các nhãn `refreshInterval` và `tokensPerDay`.
  **Then** **0** — 2 metric đó chỉ còn trong form (`field-refresh-interval`, `field-max-tokens`).
  *Tại `6037303c5`:* `AICommandCenterPage.tsx:277-280` + `:285-288` đang render chúng; form sửa chúng ở `AICommandCenterForm.tsx:745-760` và `:764-783`.
  *Tái tạo:* test mới assert `container.textContent` **không** chứa `"Khoảng làm mới"` và **không** chứa `"Token/ngày"` ở cấp panel chính sách.

- **AC2.4 — Given** ô "Auto refresh/ngày" còn lại.
  **When** render.
  **Then** nó **có** nhãn phụ nói rõ chỉ đọc (dùng khoá i18n mới `aiCommandCenter.readOnlyBadge` — xem S3), vì **không có** ô nhập nào cho nó: quét đệ quy 581 file `.ts/.tsx/.js/.jsx` trong `packages/web/src` (script Node) cho `advisory_max_auto_refreshes_per_day` ra **10 hit**, trong đó chỉ **2 file production** (`AICommandCenterForm.tsx:31` khai type, `AICommandCenterPage.tsx:113` chỗ đọc); 8 hit còn lại là test + `pages/signals/WhaleAdvisoryPage.tsx:28,548` (trang khác). **Không hit nào tạo `<input>`/`<select>` ghi field này.**
  *Tái tạo:* test mới assert phần tử đó chứa text khoá mới.

- **AC2.5 — Given** S2 xong.
  **When** `npx tsc --noEmit` · `npm run lint` · `npm run test:components`.
  **Then** lần lượt exit **0** · **0** (sau S0) · **0**, test **≥ 1122**.

**Nếu Owner muốn sửa được "Auto refresh/ngày":** cần thêm field vào `AICommandCenterForm` **và** xác nhận BE có nhận `advisory_max_auto_refreshes_per_day` trong PUT (`portfolio_analytics_views.py:1518` liệt kê field được phép — **phải đọc xác nhận**, không đoán). Nằm ngoài SCOPE plan này.

---

### S3 — Enum thô → nhãn dịch (B1, B2, B3, B7)

**File:** `packages/web/src/shared/providerModels.ts`, `packages/web/src/i18n/vi.js`, `packages/web/src/i18n/en.js`, `packages/web/src/pages/AICommandCenterPage.tsx`

**Khoá i18n mới — BẮT BUỘC khai dạng OBJECT LỒNG, không được khai phẳng.**

⚠⚠ **BẪY ĐÃ ĐO (objection N3 vòng 2) — sửa theo đúng chữ bảng này sẽ tạo đúng bug AC3.2/AC3.4 sinh ra để sửa.**
`packages/web/src/i18n/index.js:12-16` `getNestedValue()` **tách key theo `.`** rồi đi từng cấp:
```js
function getNestedValue(source, path) {
  return String(path || '').split('.')
    .reduce((acc, part) => (acc && typeof acc === 'object' ? acc[part] : undefined), source);
}
```
Khối `aiCommandCenter` có **186 khoá phẳng ở depth-1** + **1** object lồng duy nhất (`subAgent`, `vi.js:5352`). Mô phỏng trên chính hàm đó:
- khoá **phẳng** `"aiCommandCenter.provider.gemini": "Google Gemini"` ⇒ `t()` tra `dict.aiCommandCenter['provider']['gemini']` ⇒ **`undefined`** ⇒ UI in ra **chuỗi khoá**.
- **object lồng** ⇒ resolve đúng.

⇒ **Sửa đúng hình dạng sau** (thêm ở CUỐI khối `aiCommandCenter`, ngay sau `subAgent` ở `vi.js:5368` / `en.js:5300`, **không sửa dòng cũ nào**):

```js
  // S3 — nhãn enum + badge chỉ đọc. PHẢI là object lồng: getNestedValue tách key
  // theo "." (i18n/index.js:12-16); khoá phẳng có dấu chấm sẽ không resolve.
  provider: {
    openclaw: "OpenClaw (mặc định hệ thống)",
    openai: "OpenAI (ChatGPT)",
    gemini: "Google Gemini",
    claude: "Anthropic (Claude)",
    local: "Mô hình cục bộ (Ollama/vLLM)",
  },
  source: {
    commandCenter: "Cấu hình trung tâm AI",
    native: "Cấu hình dữ liệu gốc",
    unknown: "Không xác định",
  },
  readOnlyBadge: "Chỉ đọc",
```

Bản `en.js` **cùng hình dạng**, giá trị:

| Khoá | EN |
|---|---|
| `provider.openclaw` | `OpenClaw (system default)` |
| `provider.openai` | `OpenAI (ChatGPT)` |
| `provider.gemini` | `Google Gemini` |
| `provider.claude` | `Anthropic (Claude)` |
| `provider.local` | `Local model (Ollama/vLLM)` |
| `source.commandCenter` | `AI command center config` |
| `source.native` | `Native data config` |
| `source.unknown` | `Unknown` |
| `readOnlyBadge` | `Read-only` |

- **AC3.1 — Given** `PROVIDER_OPTIONS` (`providerModels.ts:67-73`).
  **When** thêm `labelKey` cho **cả 5** provider theo bảng trên.
  **Then** số dòng chứa `labelKey` trong `providerModels.ts` ≥ **11**, và dropdown ở `AICommandCenterForm.tsx:584-586` hiện nhãn tiếng Việt.
  *Baseline đo:* tại `96cc87e12` số dòng chứa `labelKey` = **6** (1 khai báo interface `ProviderModelOption.labelKey?` tại `:4-5` + 5 entry `custom` của `PROVIDER_MODELS`).
  *Lệnh tái tạo (PowerShell — **`grep` KHÔNG tồn tại trên máy này**, đã kiểm `Get-Command grep` ⇒ `$null`):*
  ```powershell
  (Get-Content packages\web\src\shared\providerModels.ts -Encoding utf8 | Select-String "labelKey" | Measure-Object).Count
  ```
  ⇒ phải **≥ 11**. (Ngưỡng `≥ 6` của bản plan v1 là **AC rỗng** — đã đúng sẵn từ baseline, không bắt được gì. Đính chính theo objection O2.)
  *Fail-before:* `PROVIDER_OPTIONS` **0/5** có `labelKey` ⇒ `t(p.labelKey ?? p.label)` rơi về chuỗi thô tiếng Anh.

- **AC3.2 — Given** BE trả `effective_ai_source`.
  **When** render ô "Nguồn hiệu lực".
  **Then** **không** bao giờ in chuỗi `command_center` ra UI; giá trị lạ chưa biết rơi về `source.unknown`.
  *Tại `6037303c5`:* `AICommandCenterPage.tsx:253` render thẳng `effectiveSource`; state `:72` khởi tạo bằng hằng `"command_center"`.
  *Tái tạo:* test mới — bảng ánh xạ `{command_center: 'aiCommandCenter.source.commandCenter', native: 'aiCommandCenter.source.native'}` + fallback `unknown`; assert không còn chuỗi `_` nào trong text render.
  **Lưu ý bằng chứng:** grep toàn backend `effective_ai_source` = **7 hit**, **không có chỗ nào GHI** ⇒ hôm nay giá trị luôn là `command_center`; `native` chỉ xuất hiện ở `market_data/stock_mgmt_native_views.py:2634` (endpoint khác, không phải trang này) nhưng vẫn cần khoá để không in thô.

- **AC3.3 — Given** lịch sử prompt có `entry.source`.
  **When** render dòng lịch sử.
  **Then** đi qua cùng bảng ánh xạ, không in thô.
  *Tại `6037303c5`:* `AICommandCenterPage.tsx:416` nội suy thẳng `${entry.source}`.

- **AC3.4 — Given** `effectiveProvider` trả `gemini`.
  **When** render ô "Nhà cung cấp hiệu lực".
  **Then** hiện `"Google Gemini"`, không hiện `"gemini"`.
  *Tại `6037303c5`:* `AICommandCenterPage.tsx:251` render thẳng `effectiveProvider`.
  *Fail-before:* ảnh chụp màn hình thật của staging cho thấy ô này hiện `gemini`.

- **AC3.5 — Given** 15 nhãn không dấu ở `vi.js:5449-5463`.
  **When** thay bằng bản có dấu đầy đủ, khớp **cả 15 khoá** với bảng bên dưới.
  **Then** lệnh dưới in `PASS 15/15`.
  ⚠ **ĐÍNH CHÍNH (objection N5 vòng 2):** bản v2 assert 9 chuỗi, trong đó **5 chuỗi đã tồn tại ở nơi khác** trong `vi.js` (`Xuất CSV` 12 hit, `Thời điểm` 13, `Hành động` 36, `Người thực hiện` 12, `Lý do` 28) ⇒ kiểm chúng là **vô nghĩa**; và **6/15 dòng không dấu bị bỏ sót**. Lệnh mới khớp theo **tên khoá + giá trị** nên không trùng chuỗi ở nơi khác.
  *Lệnh tái tạo (viết đầy đủ, không placeholder — objection O14):*
  ```powershell
  node -e "const s=require('fs').readFileSync('packages/web/src/i18n/vi.js','utf8');const want=[['titleAudit','Nhật ký kiểm toán AI'],['descriptionAudit','Mọi thay đổi cấu hình AI đều được ghi lại theo thời gian và người thực hiện.'],['auditStaffOnly','Trang này chỉ dành cho quản trị viên.'],['auditFilter','Lọc nhật ký'],['auditActionPlaceholder','Lọc theo hành động'],['auditExport','Xuất CSV nhật ký'],['auditTotal','Tổng số dòng:'],['auditLegacy','dòng chưa gán người thực hiện.'],['auditLoading','Đang tải nhật ký...'],['auditEmpty','Chưa có dòng nhật ký nào.'],['auditPager','Phân trang nhật ký'],['auditColWhen','Thời điểm'],['auditColAction','Hành động'],['auditColActor','Người thực hiện'],['auditColReason','Lý do']];const miss=want.filter(([k,v])=>!new RegExp(k+String.fromCharCode(9)+String.fromCharCode(34)+v.replace(/[.*+?^$()|[\]\\\\]/g,String.fromCharCode(92)+String.fromCharCode(36))).test(s));console.log(miss.length?'FAIL '+miss.length+'/15: '+miss.map(x=>x[0]).join(', '):'PASS 15/15')"
  ```
  ⚠ **Chỉ sửa 15 dòng đó.** Không đụng dòng nào khác trong `vi.js` (file 7233 dòng).
  *Kiểm byte:* `git diff --numstat packages/web/src/i18n/vi.js` ⇒ phải **bằng số dòng thực sự sửa**; lệch ⇒ dừng (L-T01).

- **AC3.6 — Given** S3 xong.
  **When** `npm run i18n:scan:strict` · `npx tsc --noEmit` · `npm run test:components`.
  **Then** exit **0** · **0** · **0**, test **≥ 1122**.

---

### S4 — Một trang, một danh tính (B4)

**File:** `packages/web/src/i18n/vi.js`, `packages/web/src/i18n/en.js`, `packages/web/src/components/Breadcrumb.tsx`, `packages/web/src/pages/AICommandCenterPage.tsx`

**Bảng hiện trạng — 4 nơi, 4 tên, 1 trang:**

| Nơi hiển thị | Chuỗi | Nguồn |
|---|---|---|
| Sidebar | "Trung tâm AI" | `sidebaritems.ts:39` → `vi.js:98` |
| Breadcrumb crumb 2 | "Trí tuệ nhân tạo" | `Breadcrumb.tsx:50` → `vi.js:2490` |
| H1 | "Trung tâm điều hành AI" | `AICommandCenterPage.tsx:219` → `vi.js:5409` |
| Link từ `/settings` | "Mở trung tâm AI" | `UserSettingsPage.tsx:276` → `vi.js:2492` |
| Eyebrow | "Cài đặt" | `vi.js:5410` — trùng khái niệm với crumb 1 "Cài đặt tài khoản" |

**Đề xuất (cần Owner chốt — xem §7):** lấy **"Trung tâm AI"** làm tên chuẩn cho cả 4 nơi (ngắn nhất, khớp sidebar + route `routes.aiCommandCenter` `vi.js:131`), và **xoá eyebrow "Cài đặt"** vì nó trùng khái niệm với breadcrumb.

- **AC4.1 — Given** 4 nơi hiển thị tên trang.
  **When** render `/settings/ai` và trang `/settings`.
  **Then** **không nơi nào** hiện 2 tên khác nhau cho cùng 1 trang; sidebar và breadcrumb cùng khớp `routes.aiCommandCenter`.
  *Tái tạo:* test mới — mount `AICommandCenterPage`, đọc `h1.textContent`; assert bằng chuỗi lấy từ `routes.aiCommandCenter` chứ **không** hardcode.

- **AC4.2 — Given** breadcrumb map (`Breadcrumb.tsx:50`).
  **When** `AI_ROUTE_LABELS` (`Breadcrumb.tsx:59-64`) thêm khoá `ai`.
  **Then** crumb 2 lấy từ `AI_ROUTE_LABELS` tường minh thay vì rơi xuống fallback `I18N_MAP` 2 tầng.
  *Tái tạo:* `packages/web/src/pages/__tests__/ai-hub-breadcrumb.component.test.tsx` (file đã tồn tại) — thêm case.

- **AC4.3 — Given** eyebrow.
  **When** xoá `aiCommandCenter.eyebrow` và node render nó (`AICommandCenterPage.tsx:218`), **và** sửa 3 dòng tham chiếu trong `AICommandCenterPage.component.test.js` (`:37` dict mock, `:159` tên test, `:167` assertion).
  **Then** lệnh quét đệ quy dưới in `PASS` — **0 hit trong toàn bộ `packages/web/src`**, kể cả file test.
  ⚠ **ĐÍNH CHÍNH (objection N1 vòng 2 — lỗi CHẶN):** bản v2 chỉ xoá node ở `.tsx` nhưng lệnh kiểm **quét cả `__tests__`** — mà file thật chứa literal lại **không nằm trong `__tests__`** mà nằm cạnh page. Chạy lệnh bản v2 hôm nay in **2 HIT**; sau khi xoá node vẫn còn **1 HIT** trong test ⇒ AC **không bao giờ xanh**. Đã đưa `AICommandCenterPage.component.test.js` vào SCOPE và AC nay bắt sửa cả 3 dòng đó.
  *Lệnh tái tạo (**không** dùng `grep -rn` — `grep` không tồn tại trên máy này, objection O3):*
  ```powershell
  node -e "const fs=require('fs'),p=require('path');let n=0;(function w(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const f=p.join(d,e.name);if(e.isDirectory())w(f);else if(/\.(ts|tsx|js|jsx)$/.test(e.name)){const s=fs.readFileSync(f,'utf8');if(s.includes('aiCommandCenter.eyebrow')){n++;console.log('HIT '+f)}}}})('packages/web/src');console.log(n?'FAIL: '+n+' hit':'PASS: 0 hit')"
  ```
  ⇒ phải in **`PASS: 0 hit`**. Lệnh này **cố ý quét cả `i18n/` và cả file test cạnh page** — thu hẹp phạm vi quét là cách làm AC này xanh giả.
  ⚠ `AICommandCenterPage.component.test.js:159` tên test là *"renders translated eyebrow and overview without raw i18n keys (Slice A)"* — sau khi xoá eyebrow, **đổi tên** thành *"renders overview without raw i18n keys (Slice A)"**, **không** xoá cả test (nó còn assert phần `overview`).

- **AC4.4 — Given** S4 xong.
  **When** `npx tsc --noEmit` · `npm run i18n:scan:strict` · `npm run test:components`.
  **Then** exit **0** · **0** · **0**, test **≥ 1122**.

⚠ **Cảnh báo địa lý:** `/settings/ai` chưa được bọc `StaffRoute` ở `main.tsx:195`, trong khi `/settings/ai/audit` **có** (`:204`). Đây là vấn đề **quyền**, **không** phải UI/UX — `improve-ui` §3 nêu rõ loại. **BÁO CÁO, KHÔNG SỬA** trong plan này. Tách ticket riêng.

---

### S5 — Cơ chế chặn tái phát (hazard 12: viết rule theo **hậu quả**, không theo câu chữ)

**File:** `packages/web/scripts/check-ai-cc.mjs`

- **AC5.1 — Given** rule mới `AC10-single-navigation-system`.
  **When** quét `AICommandCenterPage.tsx`.
  **Then** **FAIL** nếu có **≥ 2** phần tử dùng cùng một class `styles.hubNav`, hoặc nếu 2 phần tử dùng cùng một `aria-label` cho 2 `nav`.
  *Rule phải viết theo hậu quả:* `"2 nav cùng aria-label"` ⇒ tác giả đổi tên class thì **vẫn bắt**. Không viết rule theo chuỗi `"hub-nav"`.

- **AC5.2 — Given** rule mới.
  **When** chạy `node ./scripts/check-ai-cc.mjs --self-test`.
  **Then** có **≥ 1** case **phủ định** mà tác giả **không** viết: ví dụ 2 `nav` khác class nhưng cùng `aria-label` ⇒ vẫn phải FAIL.
  ⚠ **Đính chính (objection O7 + N6 vòng 2):** bản plan v1 yêu cầu self-test "qua hook", bản v2 yêu cầu "strip `GIT_*` trước `spawnSync`" — **cả hai đều không kiểm chứng được**. Đo `check-ai-cc.mjs`: `spawnSync|child_process|GIT_` = **0 hit**; self-test chạy **in-process** qua `process.argv.includes("--self-test")` tại `:147`. Đã **gỡ cả hai vế**, chỉ giữ đúng 1 yêu cầu có referent thật: **self-test phải có 1 case paraphrase mà tác giả không viết** (hazard 12).
  *Tái tạo:* `node ./scripts/check-ai-cc.mjs --self-test; echo $LASTEXITCODE` — baseline `96cc87e12`: in `SELF-TEST PASS: 11/11`, exit **0**.

- **AC5.3 — Given** rule mới.
  **When** chạy `node ./scripts/check-ai-cc.mjs` trên `dev` sạch.
  **Then** exit **0** và output có chứa đúng mã rule mới.
  *Baseline đo:* tại `96cc87e12` ⇒ **10 rule PASS**, in chữ `check-ai-cc: SACH.`, exit **0**.
  ⚠ **Đính chính (objection O8):** bản plan v1 đòi "11/11" — **không assert được**. Lần chạy thường **không** in dạng `N/N`; con số `11/11` là kết quả `--self-test` riêng và **đã là 11/11 trước khi thêm rule**. AC chỉ được đòi **exit 0 + có mã rule mới trong output**.
  ```powershell
  node ./scripts/check-ai-cc.mjs; $st=$LASTEXITCODE; Write-Output "EXIT=$st"
  ```
  ⚠ **KHÔNG** thêm script này vào `packages/web/package.json` — **deny-list §2**. Ghi nhu cầu vào claim + báo coordinator.

- **AC5.4 — Given** gate UI/UX budget đang đỏ (G7).
  **When** chạy `node ./scripts/check-uiux-budget.mjs` sau tất cả slice.
  **Then** **CSS-1 ≤ 4**, **CSS-2 ≤ 55**, **I18N-1 ≤ 1** (không tăng so với baseline `6037303c5`). **KHÔNG** đòi exit 0.
  *Tái tạo:* `node ./scripts/check-uiux-budget.mjs; echo $LASTEXITCODE` — **kỳ vọng vẫn là 1**, ghi rõ trong báo cáo.

---

## 5. Thứ tự + rollback

```
S0 (gỡ lint)  →  S1 (nav)  →  S2 (tách lớp)  →  S3 (i18n)  →  S4 (tên)  →  S5 (gate)
```

- Mỗi slice = **1 commit riêng**, branch `feat/ai-cc-uiux`.
- **Rollback từng slice độc lập:** `git revert <sha-slice>` — không slice nào chạm file của slice trước theo cách làm hỏng nó (S3/S4 cùng sửa `vi.js`/`en.js` ⇒ gộp S3+S4 thành **1 commit** để revert gọn, hoặc giữ tách nhưng ghi rõ thứ tự phụ thuộc).
- **Đóng phiên đúng thứ tự** (L-G01): `pwsh -File scripts/agent-sync.ps1` (**rebase → check migration → gate**) → claim `done` → push → `pwsh -File scripts/agent-pr.ps1`.
- **KHÔNG** chạy gate trước rebase rồi báo kết quả đó.
- Sau mỗi commit: `git diff --numstat` — `deletions` > số dòng sửa ⇒ file bị viết lại toàn bộ ⇒ dừng (L-G05).
- Merge: **giữ trail từng slice** (merge commit, không squash) để revert được độc lập.

---

## 6. Non-goals — việc ĐÃ thấy nhưng CỐ Ý KHÔNG làm

| # | Việc | Vì sao không làm ở đây |
|---|---|---|
| N1 | Hợp nhất 3 hệ token (`--ai-*` toàn cục · `--soc-*` · `--pf-*`) | Nợ kiến trúc, ảnh hưởng mọi trang dùng `aiSettings.module.css`. Cần ticket riêng + gate `check:tokens` đang đỏ sẵn. |
| N2 | Sửa B6 (`--ai-accent-soft` không resolve) | Là sửa token ⇒ đụng `soc.tokens.css` + `theme/tokens.css`, vượt SCOPE. **BÁO CÁO** trong `SUMMARY`, không sửa. |
| N3 | Thêm `@media (prefers-reduced-motion)` | Đã báo ở `docs/audit-uiux/UIUX_AUDIT_20261007.md` §3.2 (CSS-2) và `HANDOFF_UIUX_REMAINING_20261008.md:218` ghi rõ **"P2, để"**. Không mở lại ở slice này. |
| N4 | Thêm focus ring cho `.btn` / `.hubNavLink` / `.checkbox` / `.range` | Là **a11y**; `improve-ui` §3 nêu rõ loại trừ khi Owner yêu cầu. **BÁO CÁO**. |
| N5 | Bọc `StaffRoute` cho `/settings/ai` (`main.tsx:195`) | Vấn đề **quyền truy cập**, không phải UI/UX. **BÁO CÁO**, tách ticket. |
| N6 | Thêm field sửa `advisory_max_auto_refreshes_per_day` | ⚠ **Đính chính (objection O9):** bản plan v1 ghi `portfolio_analytics_views.py:1518` là "liệt kê field được phép". **Sai** — đọc lại `:1516-1520` cho thấy đó là **whitelist diff audit** (`for field in [...]` → `diff_parts`), **không phải** danh sách field PUT nhận. Dữ kiện có lợi: whitelist đó **có** `advisory_max_auto_refreshes_per_day` ở `:1519` ⇒ BE **biết** field này, nên ticket thêm field **khả thi** — nhưng contract PUT phải đọc và kiểm thật, **chưa verify**. |
| N7 | Sửa `AIAuditLogsPanel.tsx:407` (`'system'` hardcode) và `AIAuditPage.tsx:146` (`row.action` thô) | Ngoài `/settings/ai` (thuộc `/settings/ai/audit`). Ghi backlog. |
| N8 | `packages/web/package.json` (thêm `check-ai-cc` vào scripts) | **DENY-LIST §2**. Chỉ ghi claim + báo coordinator. |
| N9 | Mobile / viewport hẹp | Không có `@media max-width` nào trong `aiSettings.module.css`; **không có thiết bị đo** ⇒ `CHƯA CHẠY`, không AC nào đòi. |
| N10 | Dọn **6 class mồ côi thật** trong `aiSettings.module.css` | Đo bằng script quét đệ quy (125 class khai × 17 importer, tất cả đều alias `styles`): `.hubBackLink:175` · `.panelActions:239` `.textarea:467` · `.alertInfo:558` · `.statusSuccess:620` · `.statusDefault:1192`. Không thuộc Q1–Q4; dọn nó là **việc cosmetic riêng**, kèm rủi ro regression style. **BÁO CÁO** trong `SUMMARY`. |

---

## 7. Quyết định của Owner (2026-10-19) — ĐÃ CHỐT, không còn là câu hỏi

Owner phê duyệt **toàn bộ khuyến nghị**. Bốn quyết định dưới đây là **ý đồ sản phẩm do Owner quyết**, không phải suy đoán của agent (`improve-ui` §3.3 cho phép dùng khi có quyết định tường minh).

| # | Câu hỏi | **QUYẾT ĐỊNH** | Hệ quả bắt buộc cho code |
|---|---|---|---|
| **Q1** | Xoá hẳn nav anchor hay giữ dạng sub-tab SOC? | **XOÁ HẲN** nav anchor thứ 2 | Xoá `AICommandCenterPage.tsx:229-245` + node `styles.hubNav` không còn consumer thì xoá class. **KHÔNG** dùng `.subTabBar`. |
| **Q2** | Tên chuẩn của trang? | **Tên ngắn cho vị trí hẹp, tên dài cho H1**: sidebar + breadcrumb = **"Trung tâm AI"**; H1 = **"Trung tâm điều hành AI"** (giữ nguyên `aiCommandCenter.title`); link từ `/settings` = **"Trung tâm AI"** (bỏ hậu tố "Mở") | `Breadcrumb.tsx:50` → trỏ `routes.aiCommandCenter` thay vì `userSettings.aiGroup.title`. Link `UserSettingsPage.tsx:276` dùng chung nhãn ngắn. |
| **Q3** | Xoá eyebrow "Cài đặt"? | **XOÁ** | Xoá node `AICommandCenterPage.tsx:218` + key `aiCommandCenter.eyebrow` ở **cả** `vi.js` + `en.js` (tránh key chết). |
| **Q4** | "Auto refresh/ngày"? | **Gắn nhãn "Chỉ đọc"** ngay; ticket BE để thêm ô nhập để sau | Thêm khoá `aiCommandCenter.readOnlyBadge` + render badge cạnh ô đó. |

**Ngoài ra Owner chốt:** làm theo khuyến nghị để UI/UX **thật sự chuyên nghiệp** ⇒ ưu tiên **độ rõ ràng của thị giác và tính nhất quán nhãn**, không chỉ dừng ở "không còn lỗi kỹ thuật".

---

## 8. Báo cáo bắt buộc khi kết thúc

Ghi `docs/SUMMARY_ai-cc-uiux.md` theo khung skill, mỗi mục kèm **output thật**:

- commit hash từng slice
- **Baseline** (§3) in lại nguyên văn
- Gate sau rebase: `G1`-`G8` với exit code thật — mục nào **vẫn đỏ** ghi `ĐỎ (có sẵn)` kèm lý do
- Mọi `CHƯA CHẠY` nêu rõ lý do
- Danh sách việc quan sát được nhưng **không** sửa (N1–N9)
- Ảnh chụp **đã mở ra xem** trước khi báo (L-V05)

Và append **1 `## Entry N`** vào `docs/CODE_CHANGE_AUDIT_LEDGER.md` (KHÔNG cần claim trước — ledger đã gỡ khỏi deny-list 2026-10-03) + 1 dòng index ở bảng cuối file.

---

## 9. Revision log

### v2 — `96cc87e12` → sau Stage 2 (`PLAN_AUDIT_AI_CC_UIUX_20261018.md`)

**Verdict v1: `NEED_REVISION`, confidence `high`.** Auditor độc lập (read-only) phản biện bằng công cụ khác. **15 objection**, tôi đã **tự kiểm chứng lại từng cái** trước khi sửa (L-V02) — kết quả:

| # | Loại | Objection | Tôi kiểm chứng | Xử lý |
|---|---|---|---|---|
| O1 | **P0** | `git show … > f` trên PS 5.1 ghi **UTF-16LE BOM** ⇒ hỏng file | ✅ **Đúng**: blob gốc **20 984** byte → file ghi ra **42 864** byte, 2 byte đầu `255,254` | **Đã sửa AC1.4** — thay bằng `cmd /c "git show … > f"` + assert byte-size trước/sau |
| O2 | P0 | `AC3.1` là AC **rỗng**: `grep -c labelKey` đã = 6, ngưỡng `≥ 6` | ✅ **Đúng**: đo lại = **6** | **Đã sửa** — ngưỡng `≥ **11**` (6 baseline + 5 `labelKey` mới) |
| O3 | P0 | AC dùng `grep` — máy này **không có** `grep` | ✅ **Đúng**: `Get-Command grep` ⇒ `$null` | **Đã sửa AC3.1 / AC4.3** — thay bằng `Select-String` và script Node đệ quy |
| O4 | P1 | Overlap `pf-manage-rebuild` ở `CLAIMS.md:1359` — dòng đó **không phải** claim đó; trạng thái thật là `done` | ✅ **Đúng**: `:1359` là dòng kẻ bảng; claim thật ở `:1223-1228`, `status` = **`done (PR #121; phần 1-3)`** | **Đã sửa §0 OVERLAP** — hạ mức rủi ro, bỏ yêu cầu worktree riêng |
| O5 | P1 | B6: `--border-strong` **có** 2 định nghĩa, không phải 0 | ✅ **Đúng**: `soc.tokens.css:11` (dark) + `:123` (light). Chỉ `--accent-cyan-soft` mới thật sự không định nghĩa (0 def / 1 use) | **Đã sửa B6 + N2** |
| O6 | P1 | F3 "3 hit" → thật **10 hit** | ✅ **Đúng**: quét đệ quy 581 file ra **10 hit** (bản v1 dùng wildcard PowerShell bỏ sót) | **Đã sửa F3** + ghi "Đính chính (v2)". Kết luận "không có ô nhập" **vẫn đúng** |
| O7 | P1 | `AC5.2` đòi self-test "qua hook" — script **không có** hook mode | ✅ Đúng (lập luận hợp lý, tôi đã kiểm: `check-ai-cc.mjs` không có chế độ hook) | **Đã sửa AC5.2** — thay bằng yêu cầu paraphrase case + strip `GIT_*` (hazard 12/17) |
| O8 | P1 | `AC5.3` "11/11" **không assert được** | ✅ Đúng — lần chạy thường in `SACH.`, không in `N/N` | **Đã sửa AC5.3** — chỉ đòi exit 0 + mã rule có trong output |
| O9 | P2 | `:1518` là whitelist **diff audit**, không phải field PUT | ✅ **Đúng** (đọc lại `:1516-1520`) | **Đã sửa N6** |
| O10 | P2 | Số dòng nhãn `tabOverview`/`tabAudit` lệch | ✅ Đúng — số dòng nhãn ở `vi.js` không trùng số dòng trong `en.js` | **Đã sửa** bảng đối chiếu ở phần backlog |
| O11 | P2 | SCOPE lệch claim; thiếu "TẠO MỚI: test" | ✅ Đúng | **Đã thêm** bảng TẠO MỚI ở §0 |
| O12 | P2 | Claim ghi "chưa chạy gate nào" mâu thuẫn §3 (đã đo 8 gate thật) | ✅ Đúng | **Đã cập nhật claim** bằng dòng bổ sung (append-only) |
| O13 | P2 | `AC1.3` và `AC1.4` mâu thuẫn tiềm ẩn | ✅ Đúng nếu đọc vội | **Đã giải quyết** — ghi rõ 2 kiểm tra ở 2 thời điểm khác nhau |
| O14 | P2 | `AC3.5` là placeholder `node -e "..."` | ✅ Đúng | **Đã sửa** — viết lệnh đầy đủ |
| O15 | P2 | `AICommandCenterForm.tsx:83` **0 hit** `getAICommandCenterConfig` | ✅ **Đúng**: `:83` là `updateConfig:` của interface | **Đã sửa F2 Runtime** → trỏ `AICommandCenterPage.tsx:32-36` |

**Phần auditor tự phê bình (L-V01) đáng ghi nhận:** chính auditor suýt kết luận B5 sai vì `SUB_AGENT_PROMPT_FIELDS` ở `AICommandCenterForm.tsx:181` thụt 0 dòng trông như cấp module. Đo brace depth (= 1, hàm mở ở `:124`) + chạy `eslint --stdin` mới lật ngược — **plan đúng, suy luận của auditor sai**. Script đếm đầu tiên của auditor cũng tự lỗi (thiếu đuôi `.py` ⇒ báo B1 = 0 hit), sau khi thêm control mới ra **7 hit / 0 chỗ ghi**.

**Điểm plan giữ được sau vòng audit:** 8/8 gate khớp tuyệt đối (G7 đủ cả 5 chỉ số 4/55/1/8/37, G8 164 file/1122 test, G2 đúng 1 error tại `305:5`). `AC0.1` là fix **duy nhất** hoạt động — `eslint --stdin` chứng minh: chuyển hằng lên module ⇒ exit 0; thêm dep ⇒ exit 1. Hazard 6 được tôn trọng: **không** AC nào đòi `check:tokens` exit 0.
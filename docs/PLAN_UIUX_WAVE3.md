# PLAN — UI/UX wave 3: đóng 9 mục "CHƯA LÀM" của Entry 255

- **Nhánh**: `feat/uiux-wave3` (từ `dev` @ `7aeef9503`)
- **Ngày**: 2026-10-08
- **Quy trình**: `multi-agent-workflow` — **Mode B (self-supervised solo)**, Stage 1
- **Cwd khi đo**: `packages/web` trừ khi ghi khác
- **Đầu vào**: `docs/TEST_REPORT_UIUX_WAVE2.md`, `docs/audit-uiux/HANDOFF_UIUX_REMAINING_20261008.md`, ledger `Entry 255`

Mọi trích dẫn `file:line` trong plan này là **số dòng thật**, đọc bằng công cụ biết
encoding UTF-8. Xem mục 0.1 về lý do.

---

## 0. SAI SỐ ĐÃ SỬA TRƯỚC KHI LẬP KẾ HOẠCH

Plan này **không** tin số liệu nào của Entry 255 mà chưa đo lại. Ba số sai đã tìm ra:

### 0.1 SCANNER IN SAI SỐ DÒNG — nguyên nhân gốc của nhiều lần "sai số"

`docs/audit-uiux/scripts/scan-ui-guidelines.mjs:294`

```js
const lines = raw.filter((l) => !isCommentLine(l, cState));
```

Dòng comment bị **xoá khỏi mảng**, rồi `scan-ui-guidelines.mjs:339` in `line: i + 1`
— chỉ số trong mảng **đã lọc**, không phải trong file. ⇒ **mọi `file:line` scanner in ra
lệch đúng bằng số dòng comment đứng trước vị trí đó.**

Bằng chứng kiểm chứng từng file (số dòng thật lấy bằng `Select-String`, scanner lấy từ output):

| File | Scanner in | Dòng thật | Lệch | Số dòng comment trước đó |
|---|---|---|---|---|
| `src/components/ui/command.tsx` | 20 | **22** | 2 | 2 (dòng 15–16) |
| `src/pages/admin/AdminAuditPage.tsx` | 18 | **19** | 1 | 1 |
| `src/pages/admin/AdminCoreTenantsPage.tsx` | 15 | **16** | 1 | 1 |

⇒ Lệch **tích luỹ**, tới được vài chục dòng ở file nhiều comment. Đây là lý do
`HANDOFF_UIUX_REMAINING_20261008.md` và Entry 254/255 phải sửa số nhiều lần: mọi
`file:line` lấy từ scanner đều là con trỏ sai, và grep lại thì ra con số khác ⇒
thấy "sai số lần thứ 5/6" trong khi **con số đếm đúng, chỉ dòng sai**.

⚠ **Nội dung finding vẫn đúng** (rule chạy trên đúng dòng code), chỉ **số dòng** sai.
Gate `check-uiux-budget.mjs` so **count theo rule**, không đụng số dòng ⇒ baseline
không đổi khi sửa.

### 0.2 `npm run lint` — file bị quy sai, và số cảnh báo đã trôi

`docs/TEST_REPORT_UIUX_WAVE2.md:36` ghi lỗi nằm ở `FactsFirstWhaleBubbleChart.jsx`.
Đo lại:

```
npm run lint --silent   # eslint src
  src\components\OrderFlowRadarPanel.js
    155:6  error  React Hook useMemo has a missing dependency: 'locale'  react-hooks/exhaustive-deps
✖ 3711 problems (1 error, 3710 warnings)     EXIT=1
```

⇒ **Lỗi ở `OrderFlowRadarPanel.js`, không phải `FactsFirstWhaleBubbleChart.jsx`.**
Cùng `155:6` cùng message ⇒ TEST_REPORT gán nhầm file (giữ nguyên số dòng cột khi copy).
Cả hai file đều `git diff dev..HEAD` = **rỗng** ⇒ lỗi **có sẵn**, đúng như ghi.

### 0.3 Baseline `test:components` **ĐANG ĐỎ** — và không phải flake được ghi

`docs/TEST_REPORT_UIUX_WAVE2.md:25` ghi `116 file / 804 test PASS`, exit 0. Đo lại
ở `dev` @ `7aeef9503`:

```
npm run test:components --silent      EXIT=1
  Test Files  1 failed | 115 passed (116)
       Tests  2 failed | 802 passed (804)
  Duration  106.31s (transform 37.30s, import 366.43s, tests 179.09s)

  x AIUsageAnalyticsPage co 1 h1 khong rong 27527ms
  x AdminUsersPage co 1 h1 khong rong 306ms
```

Chạy **riêng** file đó: `npx vitest run src/pages/__tests__/page-heading-fu02c.component.test.tsx`
→ **15 passed, 8.05s, EXIT=0**.

⇒ **Không phải file `whale-advisory-a11y` mà Entry 255 ghi là flake.** File đỏ là
`page-heading-fu02c` — **file chính wave 2 tạo ra**. Đây là flake tải-phụ-thuộc thật,
và nguyên nhân **chung** với file mà Entry 255 ghi (mục 2).

---

## 1. BẢNG BASELINE — mọi gate đo thật, exit code thật (hazard 6 + 9)

Đo tại `dev` @ `7aeef9503`, 2026-10-08. `dev` == `origin/dev` (không có commit
trường), `git status --short` sạch.

| # | Lệnh (đúng như sẽ chạy) | Exit | Kết quả |
|---|---|---|---|
| G1 | `node docs/audit-uiux/scripts/scan-ui-guidelines.mjs packages/web/src` | 0 | `TONG = 224  P0=0 P1=120 P2=102 P3=2` |
| G2 | `node packages/web/scripts/check-uiux-budget.mjs` | 0 | baseline 246 → **224** (−22). `A11Y-9` 44 · `NAV-1` 112 · `I18N-1` 0 |
| G3 | `node packages/web/scripts/check-uiux-budget.mjs --self-test` | 0 | âm: 1 trường hợp tăng bị phát hiện |
| G4 | `npm run check:tokens` | 0 | 72 hex allowlisted, 0 vi phạm |
| G5 | `npm run check:contrast` | 0 | 7 tone pairs × 2 mode ≥ 4.5:1 |
| G6 | `npm run check:dom-landmarks` | 0 | PASS |
| G7 | `npm run check:ts-imports` | 0 | không dangling import |
| G8 | `npm run check:i18n-hardcoded` | 0 | 0 chuỗi / 19 file |
| G9 | `npm run check:admin-spa-routes` | 0 | 14 catalog `/admin/*` |
| G10 | `npm run i18n:scan:strict` | 0 | PASS |
| G11 | `npm run check:stock-detail-shell` | 0 | PASS |
| G12 | `npm run check:shell` | 0 | PASS (compose 9 gate trên) |
| G13 | `npx tsc --noEmit` | 0 | 0 error |
| G14 | `npm run lint` (`eslint src`) | **1** | **3711 problems = 1 error + 3710 warning**. 1 error là `OrderFlowRadarPanel.js:155:6` |
| G15 | `npm run test:components` | **1** | **2 failed / 802 passed (804)**, 116 file. ĐỎ — xem 0.3 |
| G16 | `npm run build` | **CHƯA CHẠY** | chạy ở Stage 6 (cần cho Playwright preview) |
| G17 | `node packages/web/scripts/check-multi-agent.mjs` (cwd root) | 0 | 0 lỗi, 0 trùng migration; ~40 cảnh báo claim cũ |
| G18 | `pwsh -File scripts/agent-sync.ps1` | **CHƯA CHẠY** | từ chối chạy trên `dev` (đúng thiết kế); chạy ở Stage 7 trên nhánh |
| G19 | `python manage.py makemigrations --check --dry-run` | **N/A** | wave này **không** tạo migration (chỉ `packages/web` + `docs/`) |
| G20 | `npm run check:uiux` | **KHÔNG TỒN TẠI** | hazard 9 — `HANDOFF_UIUX_REMAINING_20261008.md:244` ghi sai. Gate thật là **G2** |
| G21 | `npm run check:i18n` | **KHÔNG TỒN TẠI** | hazard 9 — `PLAN_UIUX_WAVE2_FINAL.md` đã ghi. Gate thật là **G8 + G10** |

⚠ **Hazard 6 nêu tên:** `HANDOFF_UIUX_REMAINING_20261008.md` §8 bắt chạy
`npm run check:uiux` — **lệnh này không tồn tại**. Nếu làm theo handoff thì sẽ kết
luận "gate đỏ" cho một lệnh không có. Plan này chỉ yêu cầu PASS của G2/G13/G15.

**AC nào KHÔNG được hứa "PASS" ở G14/G15** vì chúng **đã đỏ sẵn**: AC phải là
*"không tăng so với baseline"* + ghi rõ lý do.

---

## 2. BẢNG 9 MỤC "CHƯA LÀM" → slice

| # | Mục Entry 255 | Số đo lại (2026-10-08) | Slice |
|---|---|---|---|
| 1 | FU-02b A11Y-9 | **44 hit / 16 file** (G1) | **W3-1** |
| 2 | FU-05 11/12 file | **26 hit / 11 file** còn lại (NAV-1 112 − 26 đã làm) | **W3-2** |
| 3 | AC-3 6/14 trang | 6 trang: `SupportPage`, `TransactionsPage`, `UserSettingsPage`, `UpgradePage`, `market/ShellStockDetailPage`, `signals/WhaleAdvisoryPage` | **W3-3** |
| 4 | AC-4 script `<h1>` import-graph | chưa có | **W3-3** |
| 5 | NAV-1 ngoài scope | **86 hit / 31 file** còn lại — Owner chốt **chỉ 12 file P1 có phân trang** ⇒ 11 file / 26 hit | **W3-2** |
| 6 | Mobile CHƯA CHẠY | Owner chốt chạy Playwright **mobile emulation** (không phải thiết bị thật) | **W3-5** |
| 7 | flake | Thật, nhưng **file khác** và **cơ chế khác** (0.3) | **W3-4** |
| 8 | lint | **file thật = `OrderFlowRadarPanel.js:155:6`** (0.2) | **W3-4** |
| 9 | ledger 59 số trùng | **59 số trùng / 305 header / 243 số khác nhau** | **W3-0** |

### 2.1 Vì sao **Mode B** chứ không chia agent song song (Stage 0.5)

Kiểm tra giao nhau thật giữa 2 slice code lớn nhất:

```
NAV1 files = 11   A11Y9 files = 16   OVERLAP = 5
  src/pages/admin/AdminCoreTenantsPage.tsx
  src/pages/admin/AdminBillingFleetPage.tsx
  src/pages/admin/AdminAuditPage.tsx
  src/pages/tenant-admin/TenantAdminMembersPage.tsx
  src/features/advertising/components/CampaignTable.jsx
```

⇒ Không tách được thành 2 agent song song mà **không** tái tạo **Hazard 1** (một
hunk gộp hai agent, không tách được) — đúng như Owner đã nhận ở wave 2.
⇒ **Mode B, tuần tự, 1 người + subagent read-only cho 2 vòng audit.**

Còn 4 file `pages/admin` mà Owner nêu: `AdminCoreTenantsPage` · `AdminBillingFleetPage` ·
`AdminAuditPage` nằm trong **cả hai** slice; `AdminCoreAuditTracePage` · `AdminCoreJobsPage` ·
`AdminCorePATsPage` · `AdminCoreServiceAccountsPage` chỉ W3-2.

---

## 3. QUYẾN ĐỊNH OWNER (2026-10-08, hỏi trước khi lập plan)

| # | Câu hỏi | Chọn |
|---|---|---|
| D-1 | Sửa scanner sai số dòng? | **Sửa tại chỗ**, chứng minh count theo rule **không đổi** |
| D-2 | NAV-1 tới đâu? | **Chỉ 11 file P1 có phân trang** (74 hit còn lại ghi CHƯA LÀM kèm lý do) |
| D-3 | Ledger 59 số trùng? | **Gate chặn tái phát + script `--next-entry`**, không đánh số lại lịch sử |
| D-4 | Mobile? | **Playwright mobile emulation**, ghi rõ là **giả lập** |

---

## 4. SLICE W3-0 — Nền: số dòng scanner + gate ledger

**Vì sao đầu tiên:** mọi citation của W3-1..W3-3 lấy từ scanner. Sửa sau = phải
làm lại citation toàn bộ.

### AC-0.1 Scanner trả số dòng thật
`scan-ui-guidelines.mjs:294` giữ chỉ số dòng gốc; `:339` in `raw` index thay vì
index đã lọc.

- **Given** file có dòng comment đứng trước hit · **When** chạy scanner ·
  **Then** số dòng in ra khớp dòng thật trong file.
- Chứng minh bằng 3 cặp đã lập ở mục 0.1: `command.tsx` 20 → **22**,
  `AdminAuditPage.tsx` 18 → **19**, `AdminCoreTenantsPage.tsx` 15 → **16**.

### AC-0.2 Count theo rule **không đổi** (bất biến tuyệt đối)
Sửa số dòng **không được** đổi số lần đếm. Bắt buộc so **12 rule** của G1
(`A11Y-10, A11Y-11, A11Y-2, A11Y-4, A11Y-5, A11Y-7, A11Y-8, A11Y-9, CSS-2, I18N-1,
NAV-1, TYPO-3`) và `TONG` trước/sau, từng số.

⚠ **Nếu bất kỳ số nào đổi ⇒ dừng**, vì nghĩa là đã đổi hành vi gate ⇒ AC-0.1 sai.
(Biến `spec`/`defaults` trong `useUrlState.ts:110-117` cũng phải memo ổn định —
xem W3-2.)

### AC-0.3 Gate ledger chặn **số trùng mới**, không chặn 59 cái có sẵn
Script mới `docs/audit-uiux/scripts/check-ledger-entry.mjs`:
- `--next-entry` → in số `## Entry` lớn nhất **+ 1** (đọc head thật, không đoán).
- Mặc định → so `## Entry N` trong ledger với baseline 59 số trùng đã ghi:
  **trùng mới ⇒ exit 1**; đúng 59 cái cũ ⇒ **exit 0 + cảnh báo**.
- `--self-test` → âm: file mẫu có số trùng mới ⇒ **exit ≠ 0**.
- `--manifest` → in bảng 59 số trùng kèm tiêu đề từng bản để Owner quyết việc
  đánh số lại sau (không tự ý làm).

Vì sao mô hình này: `check-uiux-budget.mjs:8-16` đã làm đúng vậy — *"CHẶN THOÀI LÙI,
KHÔNG CHẶN NỒ SẴN"*. Gate fail ngay ở hôm nay sẽ chặn **mọi** agent.

### AC-0.4 Gate chạy được từ entrypoint chuẩn
Gắn vào `scripts/agent-sync.ps1` (bước gates, cạnh `check-multi-agent.mjs:121`).
`scripts/agent-sync.ps1` **không** nằm trong deny-list
(`docs/AGENT_PROTOCOL.md` §2). `packages/web/package.json` **có** nằm trong
deny-list ⇒ **không** thêm npm script; chạy bằng `node <path>`.

---

## 5. SLICE W3-1 — A11Y-9: accessible name cho control thô

**Đo**: 44 hit / 16 file (G1). `A11Y-9` là **P2**.

### AC-1.1 Bảng phân loại 44 hit — **mỗi dòng có kết luận, không có "chắc là"**

Mỗi hit phải thuộc đúng 1 trong 3 nhóm, và mỗi nhóm có hành xử khác nhau:

| Nhóm | Tiêu chí | Hành động |
|---|---|---|
| **(a) thật** | control thô, không `<label>` trong ±6 dòng, không `aria-label` cùng dòng, không `id=` | thêm `aria-label` (i18n qua `t()`) |
| **(b) false positive của scanner** | đã có `aria-label`/`id`+`<label>` nhưng **không cùng dòng** | KHÔNG sửa code; ghi vào bảng + giải thích vì sao scanner thấy |
| **(c) không nên sửa** | `AdvisoryOrderTicket` `quantity`, `DNSEConnectionPanel` `orderQuantity` — ô nhập trong form | ghi rõ lý do, không đụng |

⚠ **Đã biết trước 1 false positive**: `src/components/ui/input.tsx:28` — `<input>`
ở dòng 28, `id={inputId}` ở **dòng 30**, `label` render `<label htmlFor>` ở
`input.tsx:20-27`. Scanner (`scan-ui-guidelines.mjs:162`) chỉ kiểm `id=` **cùng
dòng** ⇒ thấy thiếu. Nhưng `Input` **không có** `aria-label` fallback khi caller
không truyền `label` ⇒ đây là lỗ hổng thật (nhóm (a) ở mức primitive), **không
phải** chỉ là false positive. Phải xử lý như (a) + ghi rõ.

### AC-1.2 Mọi thay đổi (a) đều có **accessible name** đo được bằng DOM
Test mới `src/components/__tests__/a11y-9-accessible-name.component.test.tsx`,
theo pattern có sẵn
`src/components/shared/__tests__/PaginationBar.a11y.component.test.tsx`:
`getByRole('input'|'combobox'|'textbox', { name: /…/ })` — **tên phải đọc được**,
không phải "có `aria-label` attribute".

- **Given** mỗi component đã sửa · **When** render · **Then** **không** còn
  control nào trong cây đó `queryAllByRole(...)` trả về tên rỗng.
- **Fail-trước**: hoàn nguyên file về `dev` ⇒ test đỏ. Chứng minh bằng
  `git show dev:<file> > <file>` + chạy + **copy file ra ngoài trước** (hazard 11 —
  **không** dùng `git checkout --`).

### AC-1.3 Gate `A11Y-9` **giảm**, không tăng
`check-uiux-budget.mjs` exit 0. Vì rule `scan-ui-guidelines.mjs:163` chỉ kiểm
`aria-label` **cùng dòng**, nhiều hit nhóm (a) sẽ **vẫn còn** nếu đặt `aria-label`
xuống dòng khác ⇒ **không** hứa "A11Y-9 → 0". AC đúng là: **không tăng**, và
bảng 0.1 nêu rõ hit nào còn lại vì lý do cấu trúc. Đây là hạn chế đã biết từ
`docs/TEST_REPORT_UIUX_WAVE2.md:85-88`.

### AC-1.4 i18n: nhãn mới phải có ở **cả** `vi` và `en`
`npm run i18n:scan:strict` (G10) exit 0. Không hardcode tiếng Việt/Anh.

---

## 6. SLICE W3-2 — NAV-1: deep-link cho 11 file P1

**Đo**: 26 hit / 11 file (NAV-1 112 tổng; 26 hit đã xong ở FU-05 cho
`PortfolioHoldingsPage`). Owner chốt **chỉ 11 file P1 có phân trang**.

Danh sách 11 file + state thật (đã đo bằng `Select-String`, không lấy từ scanner):

| File | State cần đồng bộ URL | Dòng thật |
|---|---|---|
| `src/components/dashboard/CoreDashboardPositionDeck.tsx` | `activeTab` · `pageSize` · `currentPage` | 52 · 53 · 54 |
| `src/components/dashboard/FactsFirstModularPositionDeck.jsx` | `activeTab` · `pageSize` · `currentPage` | 27 · 28 · 29 |
| `src/pages/admin/AdminCoreAuditTracePage.tsx` | `filters` · `selectedRequestId` | 69 · 71 |
| `src/pages/admin/AdminCoreJobsPage.tsx` | `filters` | 53 |
| `src/pages/admin/AdminCorePATsPage.tsx` | `filters` | 32 |
| `src/pages/admin/AdminCoreServiceAccountsPage.tsx` | `filters` | 30 |
| `src/pages/admin/AdminCoreTenantsPage.tsx` | `search` · `status` · `page` | 18 · 19 · 27 |
| `src/pages/admin/AdminBillingFleetPage.tsx` | `page` · `status` · `plan` · `search` | 21 · 22 · 23 · 24 |
| `src/pages/admin/AdminAuditPage.tsx` | `page` · `tenantId` · `actor` · `action` · `resourceType` · `dateFrom` · `dateTo` | 19 · 20 · 21 · 22 · 23 · 24 · 25 |
| `src/pages/tenant-admin/TenantAdminMembersPage.tsx` | `searchQuery` · `roleFilter` · `activeTab` | 65 · 66 · 67 |
| `src/features/advertising/components/CampaignTable.jsx` | `sorting` · `globalFilter` | 52 · 53 |

⚠ **`*Draft` TUYỆT ĐỐI KHÔNG vào URL.** `AdminCoreAuditTracePage.tsx:68`,
`AdminCoreJobsPage.tsx:52`, `AdminCorePATsPage.tsx:25`,
`AdminCoreServiceAccountsPage.tsx:23`, `AdminCoreTenantsPage.tsx:16-17`.
Đồng bộ cả hai ⇒ `useEffect` loop (đã ghi ở `useUrlState.ts:9-11`).

### AC-2.1 Observable mà **người dùng** quan tâm (hazard 8)

> *"Nếu AC này pass nhưng tính năng vẫn vô dụng, AC có bắt được không?"*

AC đúng **KHÔNG** phải "hook đã được gọi". AC đúng là:

- **Given** tôi mở `URL` có `?page=3&q=FPT` · **When** trang nạp xong ·
  **Then** bảng **đang ở trang 3** và **lọc theo `FPT`** — và ô tìm kiếm hiển thị
  `FPT`, đếm phần tử khớp con số đã lọc.
- **Given** tôi đổi bộ lọc rồi copy URL cho đồng nghiệp · **When** họ mở ·
  **Then** họ thấy **đúng bộ lọc của tôi**, không phải bộ lọc mặc định.
- **Given** tôi bấm nút Back · **When** trình duyệt quay lại ·
  **Then** trạng thái bảng quay lại đúng bộ lọc trước.
- **Given** tôi bỏ ô tìm kiếm rồi Apply với chuỗi rỗng · **Then** tham số rỗng
  **bị xoá khỏi URL** (không để lại `?q=`).

Đây là 4 hành vi người dùng thấy, không phải "state đã đồng bộ".

### AC-2.2 Ranh giới: chỉ dùng `useUrlState.ts` **có sẵn**
Không viết hook thứ hai. Dùng `useUrlState` (nhóm) / `useUrlValue` (đơn) +
`intCodec` / `stringCodec` / `boolCodec` (`useUrlState.ts:27-60`).

### AC-2.3 Memo ổn định — **AC này chặn một bug đã xảy ra 1 lần**
`useUrlState.ts:113` lặp `for (const k of Object.keys(spec))` và `useMemo` phụ thuộc
`spec` (`useUrlState.ts:117`). Nếu caller truyền object literal `{...}` **trong
render**, `spec` đổi mỗi lần ⇒ `value` là object mới mỗi render ⇒ có thể gây
render loop. Wave 2 đã dính **đúng lỗi này** ở `boolCodec` (TEST_REPORT dòng 76:
"bắt bug `boolCodec`").
⇒ **AC bắt buộc**: `spec` và `defaults` phải `useMemo`/`const` ngoài render **hoặc**
truyền qua `useMemo`; và phải có test khẳng định **2 lần render liên tiếp cho cùng
URL không sinh object `value` khác nhau** (identity check) kèm guard số lần render.

### AC-2.4 `NAV-1` giảm ≥ 26, `check-uiux-budget` exit 0

### AC-2.5 **KHÔNG** thêm dependency
`packages/web/package.json` + `package-lock.json` nằm trong deny-list
(`docs/AGENT_PROTOCOL.md` §2). Chỉ dùng `useSearchParams` của
`react-router-dom@6.30.3` (đã có sẵn — Owner chốt ở wave 2).

---

## 7. SLICE W3-3 — AC-3 (6 trang) + AC-4 (script import-graph)

### AC-3.1 6 trang còn lại có test phòng thủ
`SupportPage` · `TransactionsPage` · `UserSettingsPage` · `UpgradePage` ·
`market/ShellStockDetailPage` · `signals/WhaleAdvisoryPage`.

Họ **đã có** đúng 1 `<h1>` (Entry 255 ① liệt kê nguồn). Slice này **không** thêm
`<h1>` — chỉ thêm **assert phòng thủ** `toHaveLength(1)`.

⚠ `page-heading-fu02c.component.test.tsx:224-227` đã ghi lý do: dùng
`toBeLessThanOrEqual(1)` thì pass ở cả 0. **Dùng `toHaveLength(1)`.**

Lý do 6 trang này chưa có test (ghi ở
`page-heading-fu02c.component.test.tsx:186-194`): nạp dữ liệu bất đồng bộ, `<h1>`
đến từ component con (`src/components/WorkstationShell.tsx:53` —
`e("h1", {…})`, và `src/components/advisory/WhaleAdvisoryBentoHeader.js:44` —
`'h1'` nằm **trên dòng riêng** trong lời gọi `createElement`), cần cây provider khác.
⇒ **AC yêu cầu một `renderRoutePage()` dùng chung** có cây provider đầy đủ, thay vì
ép từng trang.

### AC-3.2 Script `<h1>` theo import graph **transitive + alias-aware**
`docs/audit-uiux/scripts/check-h1-graph.mjs`:
- Bắt đầu từ **entry point lấy từ build config**, không từ doc, không từ tên file
  (hazard 7 — bài học L-G07 đã đóng 2 lần sai số vì đếm theo tên file).
- Phân giải alias `@/` → `src/`.
- Đi **transitive** qua component con ⇒ bắt được `<h1>` đến từ
  `createElement("h1", …)`, `AdminPageHeader`, `WorkstationShell`,
  `WhaleAdvisoryBentoHeader`.
- **`--json`** để gate đọc được; **`--self-test`** âm.
- Phải **đối chiếu** với `pageRegistry.js` (61 component thật sự render), không
  đếm `*Page.tsx` (5 file `pages/portfolio/Portfolio*Page.tsx` là tab con, không
  phải route).

⚠ **Rủi ro đã biết của AC-4**: import graph là **tĩnh**. `<h1>` sinh động qua
`React.createElement` với biến (`e("h1", …)`) thì phải dò **cả** `createElement`
với string literal `"h1"`. Script phải báo rõ phần nào là **động** (không quyết
đoán) thay vì im lặng coi là "không có h1" — nếu không, script sẽ tạo ra hàng loạt
finding giả, đúng thứ đã xảy ra 6 lần.

### AC-3.3 Script cho **con số có lệnh tái lập**
Mọi số trong báo cáo phải kèm lệnh. Không có lệnh ⇒ ghi `ƯỚC LƯỢNG` hoặc xoá.

---

## 8. SLICE W3-4 — flake + lint

### AC-4.1 Sửa flake bằng **cơ chế**, không bằng nới timeout

Bằng chứng cơ chế (mục 0.3): `import 366.43s` trong tổng 106.31s wall-clock của
full suite; `AIUsageAnalyticsPage` tốn **27527 ms** trong full suite nhưng file
chạy riêng hết **8.05 s**. Cả 2 file nghi vấn đều gọi `await import(...)` **bên
trong thân test**:
- `page-heading-fu02c.component.test.tsx:126,134,146,156,166,176,181,221`
- `whale-advisory-a11y.component.test.tsx:55` (`renderPage()`)

⇒ Phí nạp module **được tính vào timeout của test**. Dưới tải full suite thì vượt.

**Cách sửa**: đưa `await import(...)` lên **module scope** (top-level await) để
nạp ở lúc collect, không tính vào test. **KHÔNG** chỉ tăng `timeout` — tăng
timeout không xoá cơ chế, chỉ che nó (hazard 8 dạng test).

- **Given** chạy full suite · **When** cả 2 file · **Then** **0 fail**.
- **Fail-trước** đã có: `npm run test:components` EXIT=1, 2 failed (mục 0.3).
- AC phải chứng minh **giảm rõ** `AIUsageAnalyticsPage` (< 3 s trong full suite).

### AC-4.2 Chạy full suite **≥ 3 lần** để chắc không phải chỉ hạnh
Một lần xanh **không** đủ — 0.3 cho thấy lỗi chỉ lộ dưới tải. Ghi rõ số lần chạy.

### AC-4.3 `npm run lint` exit **0**
Sửa `src/components/OrderFlowRadarPanel.js:155` — thêm `'locale'` vào deps của
`useMemo`. **Chứng minh fail-trước**: chạy `npm run lint` ở `dev` → 1 error (bảng
G14). Sau sửa → 0 error.

⚠ **Không** đụng 3710 warning — ngoài phạm vi. AC chỉ là `error` 1 → 0, và
`problems` **không tăng**.

---

## 9. SLICE W3-5 — Mobile: Playwright **mobile emulation** (KHÔNG phải thiết bị thật)

Owner chốt chạy giả lập. Đã kiểm tra môi trường (hazard 9 — không tin "script có
tồn tại"):
- `@playwright/test@^1.45.0` có trong `devDependencies` của
  `packages/web/package.json`.
- **KHÔNG có** npm script và **KHÔNG có** `playwright.config.*` ⇒ chạy bằng
  `npx playwright test`.
- Browser **đã cài sẵn**: `%LOCALAPPDATA%\ms-playwright\chromium-1228` +
  `chromium_headless_shell-1228`. `npx playwright --version` → `1.61.0`.
⇒ **Không cần `npm install`** (AGENTS.md cấm khi chưa hỏi).

### AC-5.1 Test đo được trên viewport 390×844, `hasTouch: true`
- **Given** app build (`npm run build`) + `vite preview` · **When** mở route ·
  **Then** `document.documentElement.scrollWidth <= innerWidth` (không cuộn ngang).
- Touch target của control tương tác chính ≥ 44×44 px (tiêu chuẩn WCAG 2.5.5).
- `getComputedStyle(...).touchAction` có `manipulation` cho control.
- Header/sidebar cố định có padding theo `env(safe-area-inset-*)`.

### AC-5.2 Báo cáo phải **tự ghi giới hạn của giả lập**
Chromium headless **không có** notch thật, **không phải** Safari iOS, **không đo**
được focus ring khi chạm thật, tốc độ cuộn thật. Những phần đó ghi `CHƯA CHẠY`.

### AC-5.3 Route bị auth chặn → ghi `CHƯA CHẠY`, không đo bằa
Không giả vờ đã kiểm trang không mở được.

---

## 10. NON-GOALS (những gì cố ý KHÔNG làm)

1. **KHÔNG** đánh số lại 59 Entry trùng (Owner chốt D-3) — sẽ hỏng mọi trích dẫn
   `Entry N` trong `AGENTS.md`, `CLAIMS.md`, `docs/*`.
2. **KHÔNG** sửa 74 hit NAV-1 ngoài 11 file P1 (Owner chốt D-2). Ghi rõ CHƯA LÀM.
3. **KHÔNG** sửa 3710 lint warning.
4. **KHÔNG** đụng `CSS-2` (46 hit `prefers-reduced-motion` ở `aiSettings.module.css`),
   `A11Y-2`, `A11Y-4`, `A11Y-5`, `A11Y-7`, `A11Y-8`, `A11Y-10`, `A11Y-11`, `TYPO-3`.
5. **KHÔNG** thêm dependency, **KHÔNG** thêm npm script vào `packages/web/package.json`.
6. **KHÔNG** tạo migration ⇒ `makemigrations` **N/A** (G19).
7. **KHÔNG** sửa `soc.module.css` / `soc.components.css` / `soc.tokens.css` trong
   slice này.
8. **KHÔNG** chạy `npm install` / `pip install`.
9. **KHÔNG** commit 9 file deny-list: `AGENTS.md`, `packages/web/package.json`,
   `pyproject.toml`, `requirements.txt`, `package-lock.json`,
   `docker-compose*.yml`, `.env*`.
   *(ledger `docs/CODE_CHANGE_AUDIT_LEDGER.md` đã được gỡ khỏi deny-list — append
   bình thường, xem `AGENTS.md` mục Q-01.)*
10. **KHÔNG** đụng `docs/audit-uiux/scripts/scan-blocks.mjs` hay
    `packages/web/scripts/` — ngoài phạm vi, cần hỏi Owner riêng.

---

## 11. DANH SÁCH FILE SẼ ĐỤNG (thành claim)

**Mới** (11):
```
docs/audit-uiux/scripts/check-ledger-entry.mjs
docs/audit-uiux/scripts/check-h1-graph.mjs
docs/PLAN_UIUX_WAVE3.md            (plan — đã tạo)
docs/PLAN_AUDIT_UIUX_WAVE3.md      (Stage 2)
docs/AUDIT_UIUX_WAVE3.md           (Stage 5)
docs/TEST_REPORT_UIUX_WAVE3.md     (Stage 6)
docs/REPORT_FINAL_UIUX_WAVE3.md    (Stage 8)
docs/CLAIMS.md                     (Stage 3 — append cuối)
packages/web/src/components/__tests__/a11y-9-accessible-name.component.test.tsx
packages/web/tests/mobile/…          (Playwright — kiểm tra vị trí ở Stage 4)
packages/web/src/pages/__tests__/page-heading-fu02c-ac3.component.test.tsx
```

**Sửa** (nhóm theo slice):
- W3-0: `docs/audit-uiux/scripts/scan-ui-guidelines.mjs` · `scripts/agent-sync.ps1`
- W3-1: 16 file A11Y-9 (bảng 2.1) + i18n `vi.js`/`en.js` nếu thêm key
- W3-2: 11 file NAV-1 ở mục 6 + test của chúng
- W3-3: 2 file test h1
- W3-4: `src/pages/__tests__/page-heading-fu02c.component.test.tsx` ·
  `src/components/__tests__/whale-advisory-a11y.component.test.tsx` ·
  `src/components/OrderFlowRadarPanel.js`
- W3-8: `docs/CODE_CHANGE_AUDIT_LEDGER.md` (Entry 256 — coordinator mới ghi được)

**Rollback từng slice**: `--no-ff` merge nên `git revert -m 1 <merge-sha>` revert
được **từng slice một** nếu mỗi slice là 1 commit.

---

## 12. ĐIỀU KIỆN DỪNG (STOP condition)

1. **AC-0.2 sai** (đổi số lần đếm rule) ⇒ dừng, scanner đã đổi hành vi gate.
2. **Gate W3-0 fail ngay từ đầu** (chặn 59 cái cũ) ⇒ dừng, thiết kế sai.
3. **`npm run test:components` đỏ ở commit nào không liên quan** ⇒ dừng, tìm
   root cause trước khi sửa tiếp.
4. **Sửa 1 file làm hỏng file khác** không nằm trong claim ⇒ dừng, báo, không tự
   mở rộng phạm vi.
5. **Số Entry mới trùng** số cũ ⇒ dừng, dùng `--next-entry`.
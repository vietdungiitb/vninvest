# PLAN — UI/UX wave 3: đóng 9 mục "CHƯA LÀM" của Entry 255

- **Nhánh**: `feat/uiux-wave3` (từ `dev` @ `7aeef9503`)
- **Ngày**: 2026-10-08 · **Bản**: **rev 2** (sau Stage 2 audit `NEED_REVISION`)
- **Quy trình**: `multi-agent-workflow` — **Mode B (self-supervised solo)**
- **Cwd khi đo**: `packages/web` trừ khi ghi khác
- **Đầu vào**: `docs/TEST_REPORT_UIUX_WAVE2.md`, `docs/audit-uiux/HANDOFF_UIUX_REMAINING_20261008.md`, ledger `Entry 255`

Mọi trích dẫn `file:line` là **số dòng thật**, đọc bằng công cụ biết UTF-8.

---

## 0. ĐÁP ỨNG PHẢN ĐỐI CỦA STAGE 2

### 0.A Vòng 2 — verdict `AGREE`, `confidence: high`, 7 objection mới (đã đóng hết)

Audit vòng 2 (`PLAN_AUDIT_OUT2.md`): **10/10** objection nặng của vòng 1 đã đóng **đúng**,
tác giả audit **tự chạy lại** và khớp tuyệt đối (ledger `305/243/59` + tần suất;
`A11Y-9` `44/16` với **16/16** số hit từng file; phân loại `38/6/0`; `NAV-1` `112/43`
→ `86/32`; scanner **11** header rule; deny-list **10 entry**). Điều kiện để vào code:

| # | Mức | Nội dung | Xử lý ở rev 3 |
|---|---|---|---|
| **N-01** | **cao** | Project Playwright mới thiếu `testMatch` ⇒ `--project=<tên>` chạy **cả 18 spec** chụp có-auth ⇒ đỏ **vì lý do khác với AC-5.1** | §9 AC-5.1: **bắt buộc** `testMatch: /mobile-ergonomics\.spec\.ts/` + `browserName: 'chromium'` tường minh |
| **N-02** | TB | AC-4.1a **đảo chiều** nội dung comment mà nó dẫn làm bằng chứng — `:139-142` viết *"KHÔNG phải lựa chọn"*, plan nói ngược lại | §8 viết lại đúng nguyên văn + thêm yêu cầu sửa **isolation/cleanup** (nguyên nhân gốc comment chỉ ra) |
| **N-03** | thấp | Citation `playwright.config.ts:23,28,34,44,49` sai 2/5, thiếu 1 | → `28,33,38,44,49` |
| **N-04** | thấp | Tiêu chí nhóm (b) mô tả lệch với danh sách (`input-otp.tsx:67` lệch 16 dòng) | §5: tiêu chí (b) thành "trong **±6 dòng thật**", ghi `input-otp.tsx:67` là ngoại lệ đã kiểm tay |
| **N-05** | thấp | AC-0.3 bỏ trống trường hợp số **không có trong baseline** (đúng lúc `256` của agent khác nằm trong worktree) | §4 AC-0.3: `count=1` ⇒ exit 0; `count≥2` ⇒ exit 1 |
| **N-06** | rất thấp | AC-2.3 dẫn `useUrlState.ts:113`, thật là `:112` | → `:112` |
| **N-07** | thấp | Non-goal 11 lệch quy định cứng của `AGENTS.md` mà plan không tự nêu | §10.11 đánh dấu **ngoại lệ cần Owner xác nhận** |

### 0.B Vòng 1 — verdict `NEED_REVISION`, 20 objection (đã đóng hết)

Audit vòng 1 (`PLAN_AUDIT_OUT.md`): **20 objection**, `confidence: high`. **Tôi đã tự kiểm
lại từng phản đối trên đĩa trước khi nhận** — 4 phản đối là lỗi của tôi, 16 phản đối
còn lại đều đúng.

| # | Mức | Nội dung | Xử lý ở rev 2 |
|---|---|---|---|
| O-01 | chặn | W3-5: `playwright.config.ts` **có**, `test:visual` **có**, mọi project `dependencies:['setup']` + login thật ⇒ chết trước thân test; thiếu webkit/firefox | §9 viết lại toàn bộ; thêm project không phụ thuộc `setup`; AC-5.1 thu hẹp |
| O-02 | chặn | AC-5.1 2/4 tiêu chí **đã có sẵn** ở `index.css:788,798,804-805` ⇒ tautology | §9: thu hẹp còn 2 tiêu chí có fail-trước; 2 tiêu chí kia thành guard |
| O-03 | chặn | `env(safe-area-inset-*)` = `0px` trong headless ⇒ **không thể pass** | §9 AC-5.2 ghi rõ là giới hạn, không phải AC |
| O-04 | chặn | Baseline đỏ §0.3 **không tái lập được** (audit chạy 2 lần đều xanh) | §0.3 viết lại thành "ghi nhận 1 lần, không tái lập được"; AC-4.2 thay bằng tiêu chí **có điều kiện tải** |
| O-05 | chặn | `AdminUsersPage` fail ở **306ms** = settle race, **không phải** timeout ⇒ fix của tôi không chữa được | §8 tách **AC-4.1a** (import scope) + **AC-4.1b** (settle race, sửa **test**) |
| O-06 | cao | Nhóm (c) rỗng 0; nhóm (b) là **6** chứ không phải 1 | §5 bảng phân loại: (a) **38** · (b) **6** kèm `file:line` · (c) **0** |
| O-07 | cao | §11 thiếu file + tham chiếu treo "bảng 2.1" ⇒ **không viết được claim** | §11 liệt kê **đường dẫn đầy đủ**, thêm 6 file thiếu |
| O-08 | cao | AC-0.1 mô tả sửa scanner **không đủ**; bỏ `.filter` sẽ đổi count | §4 AC-0.1 nêu **chính xác** mảng chỉ số song song + AC giữ format header |
| O-09 | TB | 4 số sai: 9→7 gate · ~40→66 cảnh báo · 31→32 file · 12→11 rule | §1 và §2 đã sửa, mỗi số kèm lệnh |
| O-10 | TB | Diễn giải sai 26 hit `PortfolioHoldingsPage` | §2 viết lại: 26 hit là của **11 file P1**, không phải phần đã xong |
| O-11 | TB | §10.9 thiếu `docs/CLAIMS.md`, đếm sai (10 entry / 3 nguồn cưỡng chế) | §10.9 viết lại |
| O-12 | thấp | Slice `W3-8` không tồn tại (lẫn số Entry vào số slice) | §11 bỏ, thay bằng `W3-0` |
| O-13 | cao | **`Entry 256` đã bị agent khác chiếm** trong worktree (vnbroker audit, chưa commit) | §4 AC-0.3: `--next-entry` đọc **worktree**; §11 + §12: **KHÔNG đụng ledger**, Entry nằm trong `REPORT_FINAL` |
| O-14 | cao | Gate ledger allowlist dạng **tập** ⇒ thêm `Entry 33` lần nữa không bị bắt | §4 AC-0.3: lưu **đa tập tần suất** `N → count` |
| O-15 | thấp | AC-1.3 đúng kết luận nhưng thiếu 2 escape hatch (`:162` `id=`, `:165` wrapper) | §5 AC-1.3 bổ sung |
| O-16 | TB | "≥3 lần" là tiêu chí yếu, không đặt điều kiện tải | §8 AC-4.2 thay bằng tiêu chí **cố tình tăng tải**; không tái lập ⇒ `CHƯA CHẠY` |
| O-17 | TB | Bullet "nút Back" đo `react-router`, không đo feature | §6 AC-2.1 hạ bullet Back xuống ghi chú (dẫn `useUrlState.ts:12-13`) |
| O-18 | thấp | §1 tự mâu thuẫn về "hứa PASS" ở G14/G15 | §1 viết lại rõ ngoại lệ |
| O-19 | thấp | Citation `check-multi-agent.mjs:121` trỏ nhầm file | §4 AC-0.4 sửa thành `scripts/agent-sync.ps1:121` |
| O-20 | thấp | G16 `CHƯA CHẠY` — audit đã chạy, exit 0 | §1 G16 = 0, `built in 44.52s` |

**Phần audit xác nhận plan ĐÚNG** (không sửa): cơ chế lỗi dòng scanner + 3 cặp số ·
kết luận D-1 có bản sửa bảo toàn count · file lỗi lint `OrderFlowRadarPanel.js:155:6` ·
44 hit / 16 file · 26 hit / 11 file · OVERLAP = 5 · 26/26 dòng state NAV-1 · 5 dòng
`*Draft` · ledger 59/305/243 · G20/G21 không tồn tại · AC-1.3 đúng.

### 0.0 ⚠ SỰ KIỆN MỚI PHÁT HIỆN KHI AUDIT: **agent khác đang ghi vào ledger trong cùng thư mục**

```
git status --short
  M docs/CODE_CHANGE_AUDIT_LEDGER.md        (+57 −1, CHƯA commit)
docs/CODE_CHANGE_AUDIT_LEDGER.md:1
  ## Entry 256: AUDIT THU VI?N `vnbroker` ...
```

Agent khác đang sửa ledger **trong cùng working directory** và **chưa commit**, cũng
**chưa khai claim** trong `docs/CLAIMS.md`. Đây là **Hazard 1 đang xảy ra**.

⇒ Quy tắc bắt buộc cho wave 3 (thêm vào checklist Stage 4/7):
1. **`docs/CODE_CHANGE_AUDIT_LEDGER.md` là CỦA AGENT KHÁC ⇒ KHÔNG ĐỤNG VÀO.**
   Entry retrospective của wave 3 nằm trong `docs/REPORT_FINAL_UIUX_WAVE3.md`.
2. **`git add` LUÔN chỉ đường dẫn tường minh.** Tuyệt đối không `git add .` /
   `git add -A` / `git commit -a` — sẽ nuốt 57 dòng của agent kia.
3. **KHÔNG** stash, **KHÔNG** `git checkout --` file ledger (hazard 11).

---

## 0.1 SAI SỐ ĐÃ SỬA TRƯỚC KHI LẬP KẾ HOẠCH (giữ nguyên, đã audit xác nhận đúng)

### SCANNER IN SAI SỐ DÒNG — nguyên nhân gốc của nhiều lần "sai số"

`docs/audit-uiux/scripts/scan-ui-guidelines.mjs:294`

```js
const lines = raw.filter((l) => !isCommentLine(l, cState));
```

Dòng comment bị **xoá khỏi mảng**, rồi `:339` in `line: i + 1` — chỉ số trong mảng
**đã lọc**. ⇒ **mọi `file:line` scanner in ra lệch**, đúng bằng số dòng comment
đứng trước vị trí đó.

| File | Scanner in | Dòng thật | Lệch | Số dòng comment trước |
|---|---|---|---|---|
| `src/components/ui/command.tsx` | 20 | **22** | 2 | 2 (dòng 15–16) |
| `src/pages/admin/AdminAuditPage.tsx` | 18 | **19** | 1 | 1 |
| `src/pages/admin/AdminCoreTenantsPage.tsx` | 15 | **16** | 1 | 1 |

Đo trên **toàn bộ 224 hit**: max delta = **36** (`WhaleBubbleChart.jsx`); 89 hit
delta = 0; 25 hit delta = 1. ⇒ Lệch **tích luỹ**, tới vài chục dòng ở file nhiều
comment. Đây là lý do `HANDOFF_UIUX_REMAINING_20261008.md` + Entry 254/255 phải sửa
số nhiều lần: **con số đếm đúng, chỉ dòng sai**.

⚠ **Nội dung finding vẫn đúng** (rule chạy trên đúng dòng code). Gate
`check-uiux-budget.mjs` so **count theo rule** ⇒ baseline không đổi khi sửa.

### `npm run lint` — TEST_REPORT gán nhầm file

`docs/TEST_REPORT_UIUX_WAVE2.md:36` ghi `FactsFirstWhaleBubbleChart.jsx`. Đo lại:

```
npm run lint --silent   # eslint src
  src\components\OrderFlowRadarPanel.js
    155:6  error  React Hook useMemo has a missing dependency: 'locale'  react-hooks/exhaustive-deps
✖ 3711 problems (1 error, 3710 warnings)     EXIT=1
```

⇒ Lỗi ở **`OrderFlowRadarPanel.js`**, không phải `FactsFirstWhaleBubbleChart.jsx`
(cái sau **chỉ có warning**). Cùng `155:6` cùng message ⇒ copy-paste gán nhầm file.
Cả hai `git diff dev..HEAD` = **rỗng** ⇒ **có sẵn**, đúng như ghi.

### Baseline `test:components` — 1 lần đỏ, **không tái lập được**

`docs/TEST_REPORT_UIUX_WAVE2.md:25` ghi `116 file / 804 test PASS`, exit 0.

**Lần 1 (của tôi)** ở `dev` @ `7aeef9503`: **EXIT=1** — `2 failed | 802 passed (804)`,
116 file, `Duration 106.31s (import 366.43s)`. Hai test đỏ **đều ở
`src/pages/__tests__/page-heading-fu02c.component.test.tsx`**:
`AIUsageAnalyticsPage co 1 h1 khong rong 27527ms` · `AdminUsersPage co 1 h1 khong rong 306ms`.

**Lần 2, 3 (audit chạy, máy khác tải)**: **EXIT=0** — `116 passed / 804 passed`,
47.77s rồi 53.52s (`import` 126.68s / 135.39s).

⇒ **KHÔNG TÁI LẬP ĐƯỢC.** Không phải file `whale-advisory-a11y` mà Entry 255 ghi.
File đỏ là `page-heading-fu02c` — **file chính wave 2 tạo ra**. Chạy **riêng** file đó
lúc đầu: `15 passed, 8.05s, EXIT=0`; audit chạy riêng: `15 passed, 45.33s, EXIT=0`.

---

## 1. BẢNG BASELINE — mọi gate đo thật, exit code thật (hazard 6 + 9)

Đo tại `dev` @ `7aeef9503`. `dev` == `origin/dev`, `git status` sạch (ngoại trừ
ledger của agent khác — mục 0.0).

| # | Lệnh (đúng như sẽ chạy) | Exit | Kết quả |
|---|---|---|---|
| G1 | `node docs/audit-uiux/scripts/scan-ui-guidelines.mjs packages/web/src` | 0 | `TONG = 224  P0=0 P1=120 P2=102 P3=2`, **11 rule** phát ra header (không có `I18N-1` vì 0 hit) |
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
| G12 | `npm run check:shell` | 0 | compose **7** gate (đếm bằng `scripts."check:shell"` trong `package.json`) |
| G13 | `npx tsc --noEmit` | 0 | 0 error |
| G14 | `npm run lint` (`eslint src`) | **1** | **3711 problems = 1 error + 3710 warning**; error ở `src/components/OrderFlowRadarPanel.js:155:6` |
| G15 | `npm run test:components` | **1 / 0** | **không ổn định**: lần 1 = EXIT 1 (2/802), lần 2–3 = EXIT 0 (804/804). Xem §0.1 |
| G16 | `npm run build` | 0 | `built in 44.52s` (có cảnh báo chunk >1000 kB, không chặn) |
| G17 | `node packages/web/scripts/check-multi-agent.mjs` (cwd root) | 0 | 0 lỗi, 0 trùng migration; **66** cảnh báo claim cũ |
| G18 | `pwsh -File scripts/agent-sync.ps1` | **CHƯA CHẠY** | từ chối chạy trên `dev` (đúng thiết kế); chạy ở Stage 7 trên nhánh |
| G19 | `python manage.py makemigrations --check --dry-run` | **N/A** | wave này **không** tạo migration — §11 toàn `packages/web/**` + `docs/**`, 0 file `.py` |
| G20 | `npm run check:uiux` | **KHÔNG TỒN TẠI** | hazard 9 — `HANDOFF_UIUX_REMAINING_20261008.md:244` ghi sai. Gate thật là **G2** |
| G21 | `npm run check:i18n` | **KHÔNG TỒN TẠI** | hazard 9 — `PLAN_UIUX_WAVE2_FINAL.md` đã ghi. Gate thật là **G8 + G10** |
| G22 | `npm run test:visual` (`playwright test`) | **CHƯA CHẠY** | tồn tại (`packages/web/package.json:26`) nhưng cần backend sống — xem §9 |

⚠ **Hazard 6 nêu tên:** `HANDOFF_UIUX_REMAINING_20261008.md` §8 bắt chạy
`npm run check:uiux` — **lệnh này không tồn tại**. Làm theo handoff thì sẽ kết luận
"gate đỏ" cho một lệnh không có.

**Phạm vi hứa PASS** (viết rõ để hết mâu thuẫn ở rev 1):
- Plan hứa **PASS** của: G1 · G2 · G3 · G4–G13 · G16 · G17.
- **G14**: plan **KHÔNG** hứa PASS ở các AC không liên quan tới lint. Ngoại lệ
  **có chủ ý**: AC-4.3 hứa `error` 1 → 0 vì slice đó **sửa đúng** lỗi đó. Tổng
  `problems` được phép **không tăng**; **3710 warning không nằm trong phạm vi**.
- **G15**: không hứa PASS ở bất kỳ AC nào không liên quan flake, vì gate **không ổn
  định** (mục 0.1). AC liên quan: §8.

---

## 2. BẢNG 9 MỤC "CHƯA LÀM" → slice

| # | Mục Entry 255 | Số đo lại (2026-10-08) | Slice |
|---|---|---|---|
| 1 | FU-02b A11Y-9 | **44 hit / 16 file** (G1) | **W3-1** |
| 2 | FU-05 11/12 file | 11 file P1 chiếm **26 hit** | **W3-2** |
| 3 | AC-3 6/14 trang | 6 trang ở §7 | **W3-3** |
| 4 | AC-4 script `<h1>` import-graph | chưa có | **W3-3** |
| 5 | NAV-1 ngoài scope | **86 hit / 32 file** còn lại — Owner chốt **11 file P1** | **W3-2** |
| 6 | Mobile CHƯA CHẠY | Owner chốt Playwright **mobile emulation** | **W3-5** |
| 7 | flake | Thật, nhưng **file khác** + **2 cơ chế khác nhau** (§0.1) | **W3-4** |
| 8 | lint | **file thật = `OrderFlowRadarPanel.js:155:6`** | **W3-4** |
| 9 | ledger 59 số trùng | **59 nhóm trùng / 305 header / 243 số khác nhau** | **W3-0** |

**Diễn giải đúng con số 26** (sửa O-10): `NAV-1` = **112 hit / 43 file**.
`PortfolioHoldingsPage.tsx:96` đã migrate sang `useUrlState` ở wave 2 (4 state) nên
**không còn hit NAV-1** và **không** nằm trong 43 file. Con số **26 hit là của chính
11 file P1** mà wave 3 sẽ làm — không phải phần "đã xong". Ngoài phạm vi còn
**86 hit / 32 file** (`112−26`, `43−11`).

### 2.1 Vì sao **Mode B** chứ không chia agent song song

```
NAV1 files = 11   A11Y9 files = 16   OVERLAP = 5
  src/pages/admin/AdminCoreTenantsPage.tsx
  src/pages/admin/AdminBillingFleetPage.tsx
  src/pages/admin/AdminAuditPage.tsx
  src/pages/tenant-admin/TenantAdminMembersPage.tsx
  src/features/advertising/components/CampaignTable.jsx
```

4 file `pages/admin` còn lại (`AdminCoreAuditTracePage`, `AdminCoreJobsPage`,
`AdminCorePATsPage`, `AdminCoreServiceAccountsPage`) xác nhận **không** có trong
16 file A11Y-9. ⇒ Không tách được mà **không** tái tạo **Hazard 1** ⇒ Mode B,
tuần tự, subagent read-only cho 2 vòng audit.

### 2.2 Danh sách **16 file A11Y-9** (đủ để viết dòng CLAIMS.md — sửa O-07/C-18)

Đếm bằng script riêng trên output scanner. Tổng 44 hit / 16 file:

| # | File (`packages/web/src/…`) | Hit |
|---|---|---|
| 1 | `features/advertising/components/CampaignForm.jsx` | 13 |
| 2 | `pages/tenant-admin/TenantAdminSSOPage.tsx` | 7 |
| 3 | `pages/admin/AdminAuditPage.tsx` | 6 |
| 4 | `features/advertising/components/CampaignTable.jsx` | 1 |
| 5 | `features/advertising/components/TrademarkConfigPanel.jsx` | 1 |
| 6 | `pages/admin/AdminBillingFleetPage.tsx` | 3 |
| 7 | `pages/admin/AdminCoreTenantsPage.tsx` | 1 |
| 8 | `pages/tenant-admin/TenantAdminMembersPage.tsx` | 1 |
| 9 | `components/alert-center/FilterBar.tsx` | 2 |
| 10 | `components/alert-center/StatsPanel.tsx` | 1 |
| 11 | `components/dashboard/OptimizationModal.jsx` | 1 |
| 12 | `components/TenantAdminCommandPalette.tsx` | 1 |
| 13 | `components/ui/command.tsx` | 2 |
| 14 | `components/ui/input-otp.tsx` | 2 |
| 15 | `components/ui/input.tsx` | 1 |
| 16 | `components/WhaleBubbleChart.jsx` | 1 |

Tổng: 13+7+6+1+1+3+1+1+2+1+1+1+2+2+1+1 = **44** ✅

---

## 3. QUYẾT ĐỊNH OWNER (2026-10-08)

| # | Câu hỏi | Chọn |
|---|---|---|
| D-1 | Sửa scanner sai số dòng? | **Sửa tại chỗ**, chứng minh count theo rule **không đổi** |
| D-2 | NAV-1 tới đâu? | **Chỉ 11 file P1 có phân trang** |
| D-3 | Ledger 59 số trùng? | **Gate chặn tái phát + `--next-entry`**, không đánh số lại lịch sử |
| D-4 | Mobile? | **Playwright mobile emulation**, ghi rõ là **giả lập** |

---

## 4. SLICE W3-0 — Nền: số dòng scanner + gate ledger

**Vì sao đầu tiên:** mọi citation của W3-1..W3-3 lấy từ scanner.

### AC-0.1 Scanner trả số dòng thật — bản sửa **bắt buộc**, không phải gợi ý (sửa O-08)

Không được bỏ `.filter(...)`. Phải giữ mảng đã lọc **và** thêm mảng chỉ số song song:

```js
// docs/audit-uiux/scripts/scan-ui-guidelines.mjs — thay dòng 294
const kept = [];
raw.forEach((l, idx) => { if (!isCommentLine(l, cState)) kept.push({ t: l, n: idx + 1 }); });
const lines = kept.map((k) => k.t);        // GIỮ NGUYÊN mảng đã lọc
const trueLine = kept.map((k) => k.n);     // mảng chỉ số dòng thật
// dòng 339 -> line: trueLine[i]
```

⚠ **Vì sao không được bỏ `.filter`:** `prev6`/`next6`/`block`/`next1..3`
(`:324-330`) tính trên mảng đã lọc. Bỏ filter ⇒ các cửa sổ ±6 chứa cả dòng comment
⇒ rule A11Y-9 (`:167-168`, tìm `<label` trong ±6) **đổi kết quả** ⇒ count đổi ⇒
gate đổi hành vi.

- **Given** file có dòng comment đứng trước hit · **When** chạy scanner ·
  **Then** số dòng in ra khớp dòng thật.
- Chứng minh bằng 3 cặp §0.1: `command.tsx` 20 → **22**,
  `AdminAuditPage.tsx` 18 → **19**, `AdminCoreTenantsPage.tsx` 15 → **16**.

### AC-0.2 Count theo rule **không đổi** (bất biến tuyệt đối)

Sửa số dòng **không được** đổi số lần đếm. So **11 rule** mà G1 thực sự phát ra
(`NAV-1` 112 · `CSS-2` 46 · `A11Y-9` 44 · `A11Y-11` 5 · `A11Y-8` 4 · `A11Y-5` 3 ·
`A11Y-7` 3 · `A11Y-10` 2 · `A11Y-4` 2 · `TYPO-3` 2 · `A11Y-2` 1) **và** `TONG = 224`.

⚠ **Dừng** nếu bất kỳ số nào đổi ⇒ nghĩa là đã đổi hành vi gate.

### AC-0.3 Gate ledger chặn **trùng mới theo tần suất**, không chặn nồ sẵn (sửa O-14)

Script mới `docs/audit-uiux/scripts/check-ledger-entry.mjs`:

- `--next-entry` → in số `## Entry` lớn nhất **+ 1**, đọc **WORKTREE** (nơi agent
  đang viết), **không** đọc HEAD — vì HEAD bỏ sót Entry của agent đang ghi dở
  (mục 0.0: HEAD max = 255, worktree max = 256).
- **Đa tập tần suất**, không phải tập số: baseline lưu `number → expectedCount`.
  Đo trên HEAD: `33→2`, `52→3`, `53→3`, `62→3`, các số còn lại `→2`
  (tổng 59 nhóm trùng).
  - Trùng **vượt** tần suất ⇒ **exit 1**.
  - Khớp tần suất ⇒ **exit 0 + cảnh báo**.
  - **Số KHÔNG có trong baseline** (Entry mới): `count = 1` ⇒ **exit 0** (hợp lệ);
    `count ≥ 2` ⇒ coi như trùng ⇒ **exit 1 + cảnh báo**. Không bỏ trống định nghĩa
    này — đúng lúc `256` của agent khác đang nằm trong worktree (mục 0.0).
  - ⚠ Dùng tập đơn thuần sẽ **không bắt** được `## Entry 33` lần thứ 3, vì 33 đã
    nằm trong tập 59 ⇒ đó là lỗ hổng thiết kế, không phải chi tiết.
- `--self-test` → âm: file mẫu có trùng **vượt** tần suất ⇒ **exit ≠ 0**.
- `--manifest` → in bảng `N → count` kèm tiêu đề từng bản để Owner quyết việc đánh
  số lại sau (không tự ý làm).
- Baseline lưu ở `docs/audit-uiux/scripts/ledger-entry-baseline.json`.

Mô hình lấy từ `packages/web/scripts/check-uiux-budget.mjs:8-16` — *"CHẶN THOÀI LÙI,
KHÔNG CHẶN NỒ SẴN"*. Gate fail ngay hôm nay sẽ chặn **mọi** agent.

### AC-0.4 Gate chạy được từ entrypoint chuẩn (sửa O-19)

Gắn vào `scripts/agent-sync.ps1` bước gates — cạnh dòng **121** (`& node
packages/web/scripts/check-multi-agent.mjs`; **không** phải
`check-multi-agent.mjs:121`, dòng đó là `note.push(` trong nhánh VERBOSE).
`scripts/agent-sync.ps1` **không** nằm trong deny-list. `packages/web/package.json`
**có** nằm trong deny-list ⇒ **không** thêm npm script; chạy bằng `node <path>`.

---

## 5. SLICE W3-1 — A11Y-9: accessible name cho control thô

### AC-1.1 Bảng phân loại 44 hit — **số đã đo, không phải ước lượng** (sửa O-06)

Đo bằng script riêng, đọc **±6 dòng thật** trong file (không theo index scanner):

| Nhóm | Số | Tiêu chí | Hành động |
|---|---|---|---|
| **(a) thật** | **38** | không `aria-label` **và** không `<label>` trong ±6 dòng thật | thêm `aria-label` (i18n qua `t()`) |
| **(b) false positive của rule** | **6** | đã có `aria-label` **trong ±6 dòng thật** nhưng **không cùng dòng** | **KHÔNG** sửa code; ghi vào bảng |
| **(c)** | **0** | form input mà deep-link vô nghĩa | **nhóm trống** — xem ghi chú |

6 hit nhóm (b) — `file:line` **thật**, đã tự kiểm:

| `file:line` thật | `aria-label` ở dòng | Ghi chú |
|---|---|---|
| `packages/web/src/components/ui/command.tsx:22` | 27 | đã có `aria-label={ariaLabel ?? placeholder}` |
| `packages/web/src/components/ui/command.tsx:54` | 58 | `CommandInput` |
| `packages/web/src/components/ui/input-otp.tsx:67` | 83 | `${digitLabel ?? 'Digit'} ${index + 1}` — **lệch 16 dòng, NGOÀI ±6** ⇒ theo cửa sổ ±6 thuộc (a), nhưng theo tiêu chí "rule chỉ nhìn cùng dòng" vẫn là (b) — **ngoại lệ đã kiểm tay**, xem ghi chú |
| `packages/web/src/components/alert-center/FilterBar.tsx:107` | 111 | |
| `packages/web/src/components/alert-center/FilterBar.tsx:117` | 123 | |
| `packages/web/src/components/WhaleBubbleChart.jsx:1513` | 1517 | `<select>`; delta scanner = **36** |

Đo thêm: `<label` trong ±6 dòng thật: **0 hit** ⇒ không có hit nào thuộc dạng "có
`<label>` nhưng label nằm ngoài ±6".

**Ghi chú nhóm (c) trống**: `AdvisoryOrderTicket.js` (`quantity`) và
`DNSEConnectionPanel.js` (`orderQuantity`) — 2 file mà
`HANDOFF_UIUX_REMAINING_20261008.md:38-39` nêu — **không phải hit A11Y-9**, chúng là
hit **NAV-1** (`scan-ui-guidelines.mjs:261`). Rev 1 của plan đã lẫn 2 nhóm này. Slice
này **giữ** nhóm (c) như một tiêu chí phòng thủ, ghi rõ hiện **0 thành viên**, và
áp dụng nó cho **NAV-1** ở W3-2 (2 file trên tuyệt đối không đồng bộ URL).

**Ứng viên nhóm (a) đã kiểm tay (không theo đoán)**:
`TenantAdminCommandPalette.tsx:57` — `<input>` **không** có `aria-label` riêng;
`aria-label="Quick navigation"` ở dòng 55 thuộc `<div role="dialog">` ⇒ thuộc (a),
**không** thuộc (b).

**`packages/web/src/components/ui/input.tsx:28`** (rev 1 gọi là false positive — chỉ đúng một nửa):
`<input>` ở dòng 28, `id={inputId}` ở dòng **30**, `<label htmlFor>` ở dòng 20-27.
Scanner (`:162`) chỉ kiểm `id=` **cùng dòng** nên thấy thiếu. Nhưng `Input` **không có**
`aria-label` fallback khi caller không truyền `label` ⇒ đây là **lỗ hổng thật ở
primitive** ⇒ xử lý như **(a)**, đồng thời ghi rõ đây là 1 hit mà scanner nhìn sai
lý do.

⚠ **Vẫn chưa xác minh hết**: 38 hit nhóm (a) mới chỉ được đo bằng heuristic ±6 dòng.
AC-1.2 mới là nơi **chốt** bằng DOM thật; hit nào hóa ra đã có tên ở component cha
thì chuyển sang nhóm (b) và ghi lại — **không** sửa code cho nó.

### AC-1.2 Mọi thay đổi (a) đều có **accessible name** đo bằng DOM

Test mới `packages/web/src/components/__tests__/a11y-9-accessible-name.component.test.tsx`,
theo pattern có sẵn
`packages/web/src/components/shared/__tests__/PaginationBar.a11y.component.test.tsx`:
`getByRole('textbox'|'combobox'|'searchbox', { name: /…/ })` — **tên phải đọc được**,
không phải "có attribute `aria-label`".

- **Given** component đã sửa · **When** render · **Then** **không** control nào
  `queryAllByRole(...)` trả về tên rỗng.
- **Fail-trước**: hoàn nguyên file về `dev` ⇒ test đỏ. Cách làm (hazard 11 — **KHÔNG**
  dùng `git checkout --`): **copy file ra ngoài repo trước**, rồi
  `git show dev:<file> > <file>`, chạy test, copy lại.

### AC-1.3 Gate `A11Y-9` **không tăng** — và nêu rõ 3 đường thoát của rule

Đo: **0/44** hit có `aria-label` **cùng dòng** ⇒ đặt `aria-label` xuống dòng khác vẫn
bị đếm ⇒ **không** hứa "A11Y-9 → 0".

Ba đường thoát của rule (`scan-ui-guidelines.mjs:158-169`):
1. `:163` `aria-label`/`aria-labelledby` **cùng dòng**;
2. `:162` `id=` **cùng dòng** (kèm `<label htmlFor>` là fix đúng **và** làm hit biến mất);
3. `:165` wrapper `<Input>/<Select>/<Textarea>/<Checkbox>/<Switch>` — **không bao giờ**
   thành hit ⇒ mệnh đề "sửa ở primitive rồi mọi trang hết hit" **sai** với rule này;
   sửa `<Input>` chỉ giảm **1** hit (`input.tsx:28`), **không** giảm các trang gọi nó.

⇒ AC là: **không tăng**, + bảng 0.1 nêu hit nào còn lại và vì sao.

### AC-1.4 i18n: nhãn mới phải có ở **cả** 2 locale

Key mới thêm vào `packages/web/src/i18n/vi.js` **và** `packages/web/src/i18n/en.js`.
`npm run i18n:scan:strict` (G10) exit 0. Không hardcode tiếng Việt/Anh.

---

## 6. SLICE W3-2 — NAV-1: deep-link cho 11 file P1

**Đo**: 11 file P1 chiếm **26 hit** của `NAV-1` 112.

| File (`packages/web/src/…`) | State cần đồng bộ URL | Dòng thật |
|---|---|---|
| `components/dashboard/CoreDashboardPositionDeck.tsx` | `activeTab` · `pageSize` · `currentPage` | 52 · 53 · 54 |
| `components/dashboard/FactsFirstModularPositionDeck.jsx` | `activeTab` · `pageSize` · `currentPage` | 27 · 28 · 29 |
| `pages/admin/AdminCoreAuditTracePage.tsx` | `filters` · `selectedRequestId` | 69 · 71 |
| `pages/admin/AdminCoreJobsPage.tsx` | `filters` | 53 |
| `pages/admin/AdminCorePATsPage.tsx` | `filters` | 32 |
| `pages/admin/AdminCoreServiceAccountsPage.tsx` | `filters` | 30 |
| `pages/admin/AdminCoreTenantsPage.tsx` | `search` · `status` · `page` | 18 · 19 · 27 |
| `pages/admin/AdminBillingFleetPage.tsx` | `page` · `status` · `plan` · `search` | 21 · 22 · 23 · 24 |
| `pages/admin/AdminAuditPage.tsx` | `page` · `tenantId` · `actor` · `action` · `resourceType` · `dateFrom` · `dateTo` | 19 · 20 · 21 · 22 · 23 · 24 · 25 |
| `pages/tenant-admin/TenantAdminMembersPage.tsx` | `searchQuery` · `roleFilter` · `activeTab` | 65 · 66 · 67 |
| `features/advertising/components/CampaignTable.jsx` | `sorting` · `globalFilter` | 52 · 53 |

⚠ **`*Draft` TUYỆT ĐỐI KHÔNG vào URL** (5 vị trí đã kiểm):
`AdminCoreAuditTracePage.tsx:68` · `AdminCoreJobsPage.tsx:52` ·
`AdminCorePATsPage.tsx:25` · `AdminCoreServiceAccountsPage.tsx:23` ·
`AdminCoreTenantsPage.tsx:16-17`.
Đồng bộ cả hai ⇒ `useEffect` loop (đã ghi ở `useUrlState.ts:9-11`).

⚠ **2 hit NAV-1 không bao giờ sửa** (`HANDOFF_UIUX_REMAINING_20261008.md:38-39`):
`packages/web/src/components/advisory/AdvisoryOrderTicket.js:14` (`quantity`) ·
`components/DNSEConnectionPanel.js` (`orderQuantity`) — ô nhập trong form, deep-link
vô nghĩa. Đây là **2 hit không nằm trong 11 file P1** ⇒ **không** tính vào AC-2.4.

### AC-2.1 Observable mà **người dùng** quan tâm (hazard 8)

AC **KHÔNG** phải "hook đã được gọi". 3 hành vi kiểm được trong jsdom:

1. **Given** tôi mở URL có `?page=3&q=FPT` · **When** trang nạp xong · **Then** ô
   tìm kiếm hiển thị `FPT`, bảng đang ở trang 3, và đếm phần tử khớp con số đã lọc.
2. **Given** tôi đổi bộ lọc rồi copy URL cho đồng nghiệp · **When** họ mở · **Then**
   họ thấy **đúng bộ lọc của tôi** (render lại từ URL, assert giống (1) nhưng trên
   component khác ⇒ chống được copy-paste cứng).
3. **Given** tôi bỏ ô tìm kiếm rồi Apply với chuỗi rỗng · **Then** `useLocation().search`
   **không** chứa `q=` ⇒ tham số rỗng bị xoá khỏi URL.

> **Ghi chú — ĐÃ HẠ XUỐNG KHÔNG PHẢI AC** (sửa O-17): nút **Back/forward** là hành vi
> của `react-router-dom`, đã ghi rõ ở `useUrlState.ts:12-13` ("Ranh giới tuyệt đối:
> hook chỉ đọc/ghi `URLSearchParams`, **không điều hướng**"). jsdom không có nút Back
> của trình duyệt; muốn có AC thì phải dựng `createMemoryRouter` (có sẵn trong
> `react-router-dom@6.30.3`) — **không** làm trong wave này.

### AC-2.2 Ranh giới: chỉ dùng `useUrlState.ts` **có sẵn**
Không viết hook thứ hai. Dùng `useUrlState` / `useUrlValue` + `intCodec` /
`stringCodec` / `boolCodec` (`useUrlState.ts:27-60`).

### AC-2.3 Memo ổn định — **AC chặn một bug đã xảy ra 1 lần**

`useUrlState.ts:112` lặp `Object.keys(spec)`, `useMemo` phụ thuộc `spec`
(`:117`). Caller truyền object literal `{...}` **trong render** ⇒ `spec` đổi mỗi lần
⇒ `value` là object mới mỗi render. Wave 2 đã dính **đúng lỗi này** ở `boolCodec`
(`docs/TEST_REPORT_UIUX_WAVE2.md:76`: "bắt bug `boolCodec`").
⇒ **AC bắt buộc**: `spec`/`defaults` phải `useMemo` hoặc khai ngoài render; và test
identity khẳng định **2 lần render liên tiếp cùng URL không sinh `value` khác nhau**,
thêm guard số lần render. Test bổ sung vào file **đã có**:
`packages/web/src/hooks/__tests__/useUrlState.component.test.tsx`.

### AC-2.4 `NAV-1` giảm **≥ 26 hit**, `check-uiux-budget` exit 0

### AC-2.5 **KHÔNG** thêm dependency
`packages/web/package.json` + `package-lock.json` nằm trong deny-list. Chỉ dùng
`useSearchParams` của `react-router-dom@6.30.3` (đã có sẵn — Owner chốt wave 2).

---

## 7. SLICE W3-3 — AC-3 (6 trang) + AC-4 (script import-graph)

### AC-3.1 6 trang còn lại có test phòng thủ
`SupportPage.tsx` · `TransactionsPage.tsx` · `UserSettingsPage.tsx` ·
`UpgradePage.tsx` · `market/ShellStockDetailPage.js` · `signals/WhaleAdvisoryPage.tsx`.

Họ **đã có** đúng 1 `<h1>`. Slice này **không** thêm `<h1>` — chỉ thêm **assert phòng
thủ**. Bắt buộc `toHaveLength(1)`, **không** `toBeLessThanOrEqual(1)` — vì `≤1` cũng
pass khi **0** (đã ghi ở `page-heading-fu02c.component.test.tsx:224-227`).

Lý do 6 trang chưa có test (`page-heading-fu02c.component.test.tsx:186-194`): nạp dữ
liệu bất đồng bộ; `<h1>` đến từ component con
(`packages/web/src/components/WorkstationShell.tsx:53` — `e("h1", {…})`; và
`packages/web/src/components/advisory/WhaleAdvisoryBentoHeader.js:44` — `'h1'` **trên dòng riêng**
trong lời gọi `createElement`) ⇒ cần cây provider khác.
⇒ **AC yêu cầu một `renderRoutePage()` dùng chung** có cây provider đầy đủ, thay vì
ép từng trang.

### AC-3.2 Script `<h1>` theo import graph **transitive + alias-aware**
`docs/audit-uiux/scripts/check-h1-graph.mjs`:
- Bắt đầu từ **entry point lấy từ build config**, không từ doc, không từ tên file
  (hazard 7 — L-G07 đã đóng 2 lần sai số vì đếm theo tên file).
- Phân giải alias `@/` → `src/`.
- Đi **transitive** qua component con ⇒ bắt được `<h1>` từ `createElement("h1", …)`,
  `AdminPageHeader`, `WorkstationShell`, `WhaleAdvisoryBentoHeader`.
- Phải dò **cả** `createElement` với string literal `"h1"` **và** dạng nhiều dòng như
  `WhaleAdvisoryBentoHeader.js:44`.
- **`--json`** để gate đọc được; **`--self-test`** âm.
- Đối chiếu với `packages/web/src/app/pageRegistry.js` (61 component thật sự
  render), **không** đếm `*Page.tsx` (5 file `pages/portfolio/Portfolio*Page.tsx` là
  tab con, không phải route).

⚠ **Rủi ro đã biết**: import graph là **tĩnh**. `<h1>` sinh động qua biến (`e(tag, …)`
với `tag` không phải literal) thì **không** phát hiện được. Script phải báo rõ phần
nào là **động** thay vì im lặng coi là "không có h1" — nếu không, script tạo ra hàng
loạt finding giả, đúng thứ đã xảy ra 6 lần.

### AC-3.3 Mọi số trong báo cáo phải kèm lệnh tái lập
Không có lệnh ⇒ ghi `ƯỚC LƯỢNG` hoặc xoá.

---

## 8. SLICE W3-4 — flake + lint (AC đã tách theo cơ chế, sửa O-05/O-16)

Hai failure ở §0.1 có **cơ chế khác nhau** ⇒ hai AC khác nhau:

### AC-4.1a — Phí nạp module (chỉ giải thích `AIUsageAnalyticsPage`)
Bằng chứng: 27527 ms > timeout **20000** (`page-heading-fu02c.component.test.tsx:143`)
⇒ timeout do phí `await import` ở dòng 134.
**Cách sửa**: đưa `await import(...)` lên **module scope** cho
`packages/web/src/pages/__tests__/page-heading-fu02c.component.test.tsx` và
`packages/web/src/components/__tests__/whale-advisory-a11y.component.test.tsx:55`
(`renderPage()`), để nạp ở lúc collect, không tính vào timeout test.
- **Đo được**: `AIUsageAnalyticsPage` < 3 s trong full suite.

⚠ **KHÔNG** chỉ tăng `timeout`. Comment `page-heading-fu02c.component.test.tsx:139-142`
viết: *"Timeout o day **KHONG phai lua chon**: dat mac dinh 5s thi test nay fail khi chay
chung voi 100+ file khac, va do `cleanup` khong chay => DOM ban con lai => test SAU do thay
2 h1."* ⇒ **20 s là hệ quả bắt buộc, KHÔNG phải lựa chọn thiết kế**, và comment chỉ ra
nguyên nhân gốc là **`cleanup` không chạy còn sót DOM**. Tăng lên 30 s chỉ che thêm, không
xoá cơ chế. ⇒ **AC-4.1a phải sửa luôn isolation/cleanup**, không chỉ chuyển `await import`
lên module scope.

### AC-4.1b — Settle race (chỉ giải thích `AdminUsersPage`)
Bằng chứng: fail ở **306 ms** ⇒ **không** phải timeout. Test
`page-heading-fu02c.component.test.tsx:145-151` gọi `wrapRoute()` rồi
`expect(countH1()).toHaveLength(1)` **đồng bộ**, không `waitFor`. Chính comment
`:155-156` nói `SocUsersPanel` ở trạng thái `loading` **return sớm** và **không có
`h2`**; test kế tiếp `:153-163` đã workaround đúng bằng
`waitFor(..., { timeout: 4000 })`.
**Cách sửa**: thêm `await waitFor(...)` theo đúng pattern `:158-160`.

> ⚠ **Đây là sửa TEST, không phải sửa code sản phẩm.** Ghi rõ để không ai tính nhầm
> là thay đổi hành vi sản phẩm.

⇒ **AC-4.1a không chữa được failure 306 ms**; phải có cả 4.1a lẫn 4.1b thì gate mới xanh.

### AC-4.2 Thay cho "chạy ≥ 3 lần" — **tiêu chí có khả năng phát hiện** (sửa O-04/O-16)
Vì gate **không ổn định** và nguyên nhân phụ thuộc **tải** (`import` 366 s máy tôi vs
127–135 s máy audit), "3 lần xanh" **không** phải bằng chứng — với tỉ lệ lộ ~1/5 thì
vẫn còn 51% cơ hội xanh 3/3 dù còn lỗi.

Tiêu chí thay thế, theo thứ tự:
1. Chạy full suite, **ghi lại** `import` tổng trong `Duration` (biến quyết định).
2. Chạy **cố tình tăng tải** để đẩy về vùng fail (ví dụ serialize bằng
   `--maxWorkers` giảm, hoặc chạy song song 2 suite).
3. **Không tái lập được** ⇒ ghi `CHƯA CHẠY` — **không** ghi "đã hết flake".
4. Tuyệt đối **không** để AC này pass khi **không có thay đổi dòng nào** trong diff.

### AC-4.3 `npm run lint` exit **0**
Sửa `packages/web/src/components/OrderFlowRadarPanel.js:155` — thêm `'locale'` vào
deps của `useMemo`.
- **Fail-trước**: `npm run lint` ở `dev` → exit 1, 1 error (G14).
- Sau sửa: **0 error**; tổng `problems` **không tăng**.
- **KHÔNG** đụng 3710 warning (non-goal 4).

---

## 9. SLICE W3-5 — Mobile: Playwright **mobile emulation** (KHÔNG phải thiết bị thật)

Owner chốt D-4: chạy giả lập, ghi rõ giới hạn.

### 9.1 Môi trường đã kiểm (hazard 9 — không tin "script có tồn tại")

| Hạng mục | Thật | Bằng chứng |
|---|---|---|
| npm script | **CÓ**: `packages/web/package.json:26` `"test:visual": "playwright test"` | đọc `package.json` |
| config | **CÓ**: `packages/web/playwright.config.ts` (67 dòng, tracked) | `git ls-files` |
| `testDir` | `./tests/visual` (`playwright.config.ts:6`) | đọc config |
| browser | **chỉ chromium** (`chromium-1223`, `chromium-1228`, `chromium_headless_shell-1223/1228`, `ffmpeg`, `winldd`); **KHÔNG có** webkit/firefox | `Get-ChildItem $env:LOCALAPPDATA\ms-playwright` |

⇒ **Rev 1 của plan sai** khi nói "không có npm script / không có config" — đó là
chính hazard 9 mà skill cảnh báo. Đã sửa.

### 9.2 Vì sao `npm run test:visual` nguyên trạng **không chạy được** (sửa O-01)

- `playwright.config.ts:28,33,38,44,49`: mọi project trừ `setup` đều có
  `dependencies: ['setup']` + `storageState: 'tests/visual/.auth/user.json'`.
- `packages/web/tests/visual/auth.setup.ts:5-30` **bắt buộc login thật**:
  `page.goto('/login')` → điền `testuser@vninvest.vn` →
  `waitForURL('**/dashboard', { timeout: 15000 })`.
- `webServer` là `npm run preview` (`playwright.config.ts:53-58`) — bản build **tĩnh**,
  **không có backend** ⇒ login fail ⇒ project `setup` fail ⇒ **cả 6 project bị chặn
  trước khi vào thân test**.
- Config có project `firefox` (`:31-34`) và `webkit` (`:35-39`) — máy **không có**
  2 browser đó ⇒ chạy không filter sẽ fail ở 3 project.

⇒ **AC-5.3 ("route bị auth chặn → CHƯA CHẠY") không che được**, vì auth chặn ở
mức **project**, không phải mức route.

### AC-5.1 Chỉ 2 tiêu chí **có fail-trước** (sửa O-02/O-03/N-01)
Thêm **1 project mới** trong `packages/web/playwright.config.ts`: **không**
`dependencies`, `storageState: { cookies: [], origins: [] }`,
**`browserName: 'chromium'`** tường minh (vì `devices['Pixel 5']` kéo theo
`isMobile` chỉ hỗ trợ Chromium), viewport **393×851** + `hasTouch: true` (lấy của
project `mobile-chrome` sẵn có qua `devices['Pixel 5']`, **không** dùng 390×844 vì
390×844 là `iPhone 12` ⇒ cần webkit không cài).

⚠ **BẮT BUỘC khai `testMatch`** (sửa N-01 — không có nó, lệnh chạy sẽ đỏ **vì lý do sai**):
`playwright.config.ts:6` đặt `testDir: './tests/visual'`, mặc định `testMatch` của
Playwright là `**/*.@(spec|test)…` ⇒ project mới không `testMatch` sẽ nhận **toàn bộ
18 file `*.spec.ts`** trong thư mục đó. Chúng được chụp **có auth**
(`tests/visual/*-snapshots/`) trong khi project mới để `storageState` rỗng ⇒ đỏ hàng
loạt **không liên quan gì tới AC-5.1**. ⇒ project mới **phải** có
`testMatch: /mobile-ergonomics\.spec\.ts/`.

Lệnh chạy: `npm run test:visual --project=<tên project mới>` ⇒ chạy **đúng 1 file**.

1. **Given** app build + `vite preview` · **When** mở route không cần auth ·
   **Then** `document.documentElement.scrollWidth <= window.innerWidth`
   (không cuộn ngang ở viewport mobile).
2. **Given** trang render xong · **When** đo mọi control tương tác chính ·
   **Then** vùng chạm ≥ **44×44 px** (WCAG 2.5.5).

> **KHÔNG hứa** `env(safe-area-inset-*)` khác 0. Trong Chromium headless không có
> notch ⇒ `env()` trả `0px` ⇒ **không kiểm chứng được** bằng hành vi (O-03).

### AC-5.2 Guard trên **source CSS**, không phải AC hành vi (sửa O-02)
`packages/web/src/index.css` **đã có** sẵn từ wave 2 FU-03:
`touch-action: manipulation` (`:788`) · `overscroll-behavior: contain` (`:798`) ·
`padding-left/right: env(safe-area-inset-left/right, 0px)` (`:804-805`).
⇒ Assert `readFileSync(index.css)` chứa các khai báo này là **guard chống hồi quy**,
**không** được tính là bằng chứng tiến bộ (vì nó **pass trước khi wave 3 viết code**).
⚠ `index.css:764` còn **comment cũ** ghi "safe-area-inset-* = 0, touch-action = 0" —
đã lỗi thời so với `:788`/`:804-805`. Cập nhật comment cho khỏi sai (P2).

### AC-5.3 Phần **không** làm được — ghi `CHƯA CHẠY`, không đo bằng
- **Thiết bị thật**: không có. Chromium headless **không có** notch, **không phải**
  Safari iOS.
- **Focus ring khi chạm thật**, **tốc độ cuộn thật**: không đo được.
- **Toàn bộ route cần đăng nhập**: chặn ở mức project `setup` (mục 9.2) ⇒ không đo
  được bằng `vite preview` tĩnh.
- `webkit` / `firefox`: **KHÔNG cài** ⇒ không chạy được, không `npm install`
  (non-goal 8).

---

## 10. NON-GOALS

1. **KHÔNG** đánh số lại 59 Entry trùng (D-3) — sẽ hỏng mọi trích dẫn `Entry N` trong
   `AGENTS.md`, `CLAIMS.md`, `docs/*`.
2. **KHÔNG** sửa 86 hit NAV-1 ngoài 11 file P1 (D-2). Ghi rõ CHƯA LÀM.
3. **KHÔNG** sửa 3710 lint warning.
4. **KHÔNG** đụng `CSS-2` (46 hit `prefers-reduced-motion`), `A11Y-2`, `A11Y-4`,
   `A11Y-5`, `A11Y-7`, `A11Y-8`, `A11Y-10`, `A11Y-11`, `TYPO-3`.
5. **KHÔNG** thêm dependency, **KHÔNG** thêm npm script vào `packages/web/package.json`.
6. **KHÔNG** tạo migration ⇒ G19 **N/A**.
7. **KHÔNG** sửa `soc.module.css` / `soc.components.css` / `soc.tokens.css`.
8. **KHÔNG** chạy `npm install` / `pip install` (kể cả `npx playwright install`).
9. **KHÔNG** commit file deny-list: **10 entry theo 3 nguồn cưỡng chế**
   (`.githooks/pre-commit:19-31`, `scripts/agent-pr.ps1:44`,
   `packages/web/scripts/check-multi-agent.mjs:27`) — không gồm ledger.
   `docs/AGENT_PROTOCOL.md:29-33` §2 **còn có** `docs/CLAIMS.md`, nhưng §3 cho phép
   **append-cuối** mọi agent ⇒ Stage 3 sẽ append **1 dòng**, không sửa/xoá dòng cũ.
10. **KHÔNG** đụng `docs/audit-uiux/scripts/scan-blocks.mjs` hay bất kỳ script nào
    trong `packages/web/scripts/` — ngoài phạm vi, cần hỏi Owner riêng.
11. **KHÔNG** đụng `docs/CODE_CHANGE_AUDIT_LEDGER.md` — agent khác đang ghi dở trong
    cùng thư mục (mục 0.0).
    > ⚠ **ĐÂY LÀ NGOẠI LỆ CẦN OWNER XÁC NHẬN** so với `AGENTS.md` mục "Ghi chú ledger"
    > (bắt buộc append 1 `## Entry N` sau mọi thay đổi). Lý do rất hợp lý: Hazard 1 —
    > agent khác đang giữ 57 dòng **chưa commit** trong cùng file, mỗi bên prepend ở
    > đầu file sẽ hợp nhất thành một hunk không tách được. Entry retrospective của
    > wave 3 nằm đầy đủ trong `docs/REPORT_FINAL_UIUX_WAVE3.md` và **coordinator ghi hộ
    > sau khi ledger sạch**.

---

## 11. DANH SÁCH FILE SẼ ĐỤNG (đủ để viết dòng CLAIMS.md — sửa O-07)

**Mới** (9):
```
docs/audit-uiux/scripts/check-ledger-entry.mjs
docs/audit-uiux/scripts/ledger-entry-baseline.json
docs/audit-uiux/scripts/check-h1-graph.mjs
docs/PLAN_UIUX_WAVE3.md                          (đã tạo)
docs/PLAN_AUDIT_UIUX_WAVE3.md                    (Stage 2)
docs/AUDIT_UIUX_WAVE3.md                         (Stage 5)
docs/TEST_REPORT_UIUX_WAVE3.md                   (Stage 6)
docs/REPORT_FINAL_UIUX_WAVE3.md                  (Stage 8)
docs/CLAIMS.md                                   (Stage 3 — append cuối, 1 dòng)
packages/web/src/components/__tests__/a11y-9-accessible-name.component.test.tsx
packages/web/src/pages/__tests__/page-heading-fu02c-ac3.component.test.tsx
```

**Sửa — W3-0 (2 + 1 config)**:
```
docs/audit-uiux/scripts/scan-ui-guidelines.mjs
scripts/agent-sync.ps1
packages/web/scripts/uiux-baseline.json            (chỉ khi gate đề xuất --write-baseline)
```

**Sửa — W3-1 (16 file nguồn + 2 i18n + 1 test)**:
```
packages/web/src/features/advertising/components/CampaignForm.jsx
packages/web/src/features/advertising/components/CampaignTable.jsx
packages/web/src/features/advertising/components/TrademarkConfigPanel.jsx
packages/web/src/pages/admin/AdminAuditPage.tsx
packages/web/src/pages/admin/AdminBillingFleetPage.tsx
packages/web/src/pages/admin/AdminCoreTenantsPage.tsx
packages/web/src/pages/tenant-admin/TenantAdminMembersPage.tsx
packages/web/src/pages/tenant-admin/TenantAdminSSOPage.tsx
packages/web/src/components/alert-center/FilterBar.tsx
packages/web/src/components/alert-center/StatsPanel.tsx
packages/web/src/components/dashboard/OptimizationModal.jsx
packages/web/src/components/TenantAdminCommandPalette.tsx
packages/web/src/components/ui/command.tsx
packages/web/src/components/ui/input-otp.tsx
packages/web/src/components/ui/input.tsx
packages/web/src/components/WhaleBubbleChart.jsx
packages/web/src/i18n/vi.js
packages/web/src/i18n/en.js
packages/web/src/components/__tests__/a11y-9-accessible-name.component.test.tsx
```

**Sửa — W3-2 (11 file + 1 test hook)**:
```
packages/web/src/components/dashboard/CoreDashboardPositionDeck.tsx
packages/web/src/components/dashboard/FactsFirstModularPositionDeck.jsx
packages/web/src/pages/admin/AdminCoreAuditTracePage.tsx
packages/web/src/pages/admin/AdminCoreJobsPage.tsx
packages/web/src/pages/admin/AdminCorePATsPage.tsx
packages/web/src/pages/admin/AdminCoreServiceAccountsPage.tsx
packages/web/src/pages/admin/AdminCoreTenantsPage.tsx
packages/web/src/pages/admin/AdminBillingFleetPage.tsx
packages/web/src/pages/admin/AdminAuditPage.tsx
packages/web/src/pages/tenant-admin/TenantAdminMembersPage.tsx
packages/web/src/features/advertising/components/CampaignTable.jsx
packages/web/src/hooks/__tests__/useUrlState.component.test.tsx
```

**Sửa — W3-3 (2 file test)**:
```
packages/web/src/pages/__tests__/page-heading-fu02c.component.test.tsx
packages/web/src/components/__tests__/whale-advisory-a11y.component.test.tsx
```

**Sửa — W3-4 (3 file)**:
```
packages/web/src/pages/__tests__/page-heading-fu02c.component.test.tsx
packages/web/src/components/__tests__/whale-advisory-a11y.component.test.tsx
packages/web/src/components/OrderFlowRadarPanel.js
```

**Sửa — W3-5 (3 file)**:
```
packages/web/playwright.config.ts                   (thêm 1 project không phụ thuộc setup)
packages/web/src/index.css                         (sửa comment :764 lỗi thời)
packages/web/tests/visual/<tên-mới>.spec.ts         (file test mới, đặt trong testDir)
```

**Không đụng** (agent khác đang giữ): `docs/CODE_CHANGE_AUDIT_LEDGER.md`.

**Rollback từng slice**: merge `--no-ff` ⇒ `git revert -m 1 <merge-sha>` revert được
**từng slice một** nếu mỗi slice là 1 commit.

---

## 12. ĐIỀU KIỆN DỪNG (STOP condition)

1. **AC-0.2 sai** (đổi số lần đếm rule) ⇒ dừng, scanner đã đổi hành vi gate.
2. **Gate W3-0 fail ngay từ đầu** (chặn 59 cái cũ) ⇒ dừng, thiết kế sai.
3. **`npm run test:components` đỏ ở commit nào không liên quan** ⇒ dừng, tìm root
   cause trước khi sửa tiếp.
4. **Sửa 1 file làm hỏng file khác** không nằm trong claim ⇒ dừng, báo, không mở rộng.
5. **Số Entry mới trùng** số đã có ⇒ dừng, dùng `--next-entry`.
6. **`docs/CODE_CHANGE_AUDIT_LEDGER.md` vẫn đang đổi bởi agent khác khi tới Stage 8**
   ⇒ **dừng việc ghi ledger**, để Entry trong `REPORT_FINAL_UIUX_WAVE3.md` và báo Owner.
7. **`git add` bất kỳ lần nào có `docs/CODE_CHANGE_AUDIT_LEDGER.md`** ⇒ dừng ngay,
   `git restore --staged`, tuyệt đối không commit file đó.
8. **Một AC nào pass mà diff không có thay đổi liên quan** ⇒ coi như AC rác, ghi lại
   chứ không tính là đạt.
9. **`AC-4.1a` pass nhưng `AC-4.1b` chưa** ⇒ gate vẫn đỏ, coi W3-4 chưa xong.
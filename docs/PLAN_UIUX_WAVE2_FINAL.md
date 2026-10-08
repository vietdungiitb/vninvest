# PLAN_UIUX_WAVE2_FINAL — 4 slice còn lại + audit độc lập + merge

- **Ngày**: 2026-10-08
- **Nhánh**: `feat/uiux-followup` (từ `dev@61c602733`)
- **Claim**: `uiux-followup` — `docs/CLAIMS.md`
- **Nguồn**: `docs/audit-uiux/HANDOFF_UIUX_REMAINING_20261008.md`
- **Mode**: B (self-supervised solo) cho code — 4 slice **chồng file** (xem §3).
  Audit Stage 2 + Stage 5 giao cho subagent **read-only độc lập**.

## 1. Baseline gate — chạy thật, ghi exit code (hazard 6 + 9)

Tại `dev@61c602733`, **trước** khi sửa dòng nào:

| Lệnh thật (không dùng npm alias) | Exit | Ghi chú |
|---|---|---|
| `node packages/web/scripts/check-uiux-budget.mjs` (**cwd = repo root**) | **0** | PASS — 0 tăng so baseline 246 |
| `npm run check:tokens` (**cwd = `packages/web`**) | **0** | 72 allowlisted hex, 0 violations |
| `npm run check:contrast` | **0** | 7 tone pairs × 2 modes ≥ 4.5:1 |
| `npm run check:dom-landmarks` | **0** | static gate |
| `npm run check:ts-imports` | **0** | không có dangling import |
| `npm run check:i18n-hardcoded` | **0** | 0 chuỗi hardcode trong 19 file |
| `npm run check:admin-spa-routes` | **0** | 14 catalog /admin/* |
| `npm run i18n:scan:strict` | **0** | |
| `npm run check:shell` | **0** | chạy chuỗi con ở trên |
| `npm run lint` | **0** | **3696 warnings, 0 errors** — warning là baseline |
| `npx tsc --noEmit` | **0** | |
| `npm run build` | **0** | tsc && vite build — chạy lại sau audit Stage 2: built in 1m 15s |
| `npm run test:components` | **0** | **112 file / 766 test** — nhưng có **1 flake đã biết**: `whale-advisory-a11y` R1.1 timeout 5000ms; chạy riêng file → 12/12 pass. Stage 6 phải ghi rõ, không đổi đỏ vì flake |
| `node packages/web/scripts/check-multi-agent.mjs` | **0** | 66 cảnh báo claim cũ, không chặn |
| `python manage.py makemigrations --check --dry-run` | **CHƯA CHẠY** | cần Postgres; **không đụng migration** nên coi là N/A |
| `npm run check:i18n` | **KHÔNG TỒN TẠI** | hazard 9 — script không có trong `package.json`. **Không được đòi gate này.** |

> **Không có gate nào đỏ sẵn.** Mọi tiêu chí "PASS" dưới đây vì thế là khả thi.

### Kết quả Audit Stage 2 (subagent độc lập, read-only, `@173f52283`) — `NEED_REVISION`

Đã sửa **8/8** phản đối trước khi vào Stage 4:

| Mức | Phản đối | Cách sửa |
|---|---|---|
| HIGH | FU-02c "18 trang" — 14/18 **đã có** `<h1>` | Số **4**; thêm bảng bằng chứng 14 trang + AC-3 test phòng thủ |
| HIGH | FU-05 không phân biệt scope 29/115 | Ghi rõ **29 hit / 12 file = 26%**, 86 hit / 32 file OUT OF SCOPE |
| WARNING | FU-04 "21 điểm" không tái lập được | Số **19 (gate) + 4 `toLocale*(undefined)` = 23** |
| WARNING | FU-02b "~41" không có nguồn | Nguồn = 44 gate − 3 hit FU-02a; nêu 2 hit fp/dead; cảnh báo gate **không giảm** |
| WARNING | AC-3 bảo vệ sai phạm vi (chỉ nhóm shell) | Đổi thành test phòng thủ 14 trang đã có h1 |
| WARNING | `node scripts/check-uiux-budget.mjs` sai đường dẫn | Sửa thành `node packages/web/scripts/…` + ghi `cwd` |
| WARNING | `test:components` có 1 flake | Ghi rõ flake `whale-advisory-a11y` R1.1, chạy riêng 12/12 pass |
| SUGGESTION | FU-04 AC-2 vô nghĩa (7 file fp không có hit nào) | Chuyển xuống **Non-goal** |
| SUGGESTION | handoff trích sai `pageRegistry.js:210-211` | Đã sửa (xem §7) |

**Bài học cho Stage 5**: chính kế hoạch do tôi viết còn chứa **con số sai**, và
subagent độc lập bắt được 2 lỗi HIGH mà tôi không thấy. Đây là bằng chứng cho
`confidence` — **audit độc lập không phải nghi thức**.

## 2. 4 slice còn lại — tiêu chí kiểm được

Mọi tiêu chí theo mẫu: *nếu cái này pass nhưng tính năng vẫn vô dụng, tiêu chí có bắt được không?*

### FU-02c — `<h1>` cho **4 trang**

⚠ **Con số "18 trang" trong bản plan đầu SAI — đã sửa sau audit độc lập (Stage 2).**
14/18 trang **đã có** đúng 1 `<h1>`, chỉ là **không nằm trong file page** mà đến từ
component con / dạng gọi hàm. Bằng chứng từng trang:

| Trang | `<h1>` đã có ở đâu |
|---|---|
| `auth/AuthLoginPage.tsx` | `createElement("h1", …)` tại :134 và :146 (2 nhánh loại trừ nhau, :127 return sớm) |
| `auth/AuthRegisterPage.tsx` | :147 |
| `auth/AuthVerifyEmailPage.tsx` | :101 |
| `auth/AuthResetPasswordPage.tsx` | :152 |
| `admin/AdminBillingFleetPage.tsx` · `AdminUsageFleetPage` · `AdminAuditPage` · `AdminAnalyticsPage` | `pages/admin/adminUi.tsx:24` — cả 4 import `AdminPageHeader` |
| `pages/SupportPage.tsx` | :311 `e("h1", …)` |
| `pages/TransactionsPage.tsx` | :194 `e("h1", null, "Giao dịch")` |
| `pages/UserSettingsPage.tsx` | :182 |
| `pages/UpgradePage.tsx` | :54 |
| `market/ShellStockDetailPage.js` | `components/WorkstationShell.tsx:53` |
| `signals/WhaleAdvisoryPage.tsx` | `components/advisory/WhaleAdvisoryBentoHeader.js:44` (dùng tại :338) |

**4 trang thật sự thiếu** (đã tự kiểm chứng từng trang, không còn tin grep):

| File | Ghi chú |
|---|---|
| `pages/DashboardPage.tsx` | 429 dòng, 0 `<h1>` |
| `pages/AIAgentFederationPage.tsx` | 21 dòng |
| `pages/AIUsageAnalyticsPage.tsx` | 21 dòng |
| `pages/admin/AdminUsersPage.tsx` | 11 dòng, chỉ `return e(SocUsersPanel)`; `components/soc/SocUsersPanel.tsx` cũng 0 `<h1>` |

**Nguyên nhân sai số (lần thứ 6, xem L-G04 + L-G07)**: script đếm của tôi grep
`<h1` **trong file page**, nên bỏ qua (a) `createElement("h1", …)` — không phải JSX,
(b) `<h1>` đến từ component con, (c) import alias `@/` mà regex không theo.
⇒ **Số đo duy nhất đáng tin là DOM thật** (`getAllByRole`), không phải grep.

- **AC-1** Mỗi trong 4 trang có **đúng 1** `role=heading level=1` **không rỗng**,
  đo bằng `getAllByRole("heading", { level: 1 })` — **không** dùng grep.
- **AC-2** Test **fail-trước** chỉ áp cho **4 trang này** (bằng `git show HEAD:<file>`),
  **pass-sau**.
- **AC-3** Thêm test **phòng thủ** cho 14 trang đã có `<h1>`: khẳng định chúng vẫn
  đúng **1** `h1` sau khi sửa. Bắt được lỗi "thêm h1 thứ 2".
- **AC-4** Gate tĩnh: script đếm `<h1>` theo **import graph transitive** (alias-aware)
  cho 61 `makePageEntry`, ghi kết quả vào `docs/audit-uiux/` để lần sau không đo lại bằng grep.

### FU-02b — tên accessible, **41 hit** (44 gate − 3 đã sửa ở FU-02a `c79e6ac00`)
⚠ **Gate sẽ KHÔNG giảm.** Rule `scan-ui-guidelines.mjs` chỉ kiểm `aria-label`
**trên cùng một dòng** với `<input`; code đúng đặt `aria-label` ở dòng riêng nên
vẫn bị đếm. ⇒ **Đừng dùng delta của gate A11Y-9 làm bằng chứng tiến triển.**
Trong 44 còn **2 hit không phải lỗi thật**: `ui/input.tsx:28` (`<label htmlFor>` ở
:21–27, cách 7 dòng ⇒ lọt khỏi cửa sổ ±6) và `ui/input-otp.tsx:98`
(`InputOtpSlot` — **dead export**, grep toàn `src` ra 0 chỗ dùng).
- **AC-1** **Không** dùng "mọi control tương tác" — đó là tập vô hạn, không falsifiable.
  Thay bằng: **liệt kê đúng 41 hit theo file**, và assert theo danh sách đó.
- **AC-2** Sửa ở `features/advertising/components` trước (15 điểm, phủ rộng nhất).
- **AC-3** Test fail-trước/pass-sau cho **từng nhóm**, không gộp 1 test đại.

### FU-04 — I18N locale, **19 hit (theo gate) + 4 hit `toLocale*(undefined, …)` = 23**
⚠ "21 điểm" trong bản plan đầu **không tái lập được** bằng method nào (gate = 19;
kẹp `undefined` = 23). Đã sửa.
- **AC-1** `toLocale*()` không truyền locale còn lại: **0**.
  **Lưu ý giới hạn rule**: rule của scanner chỉ bắt `toLocale*()` rỗng, **không** bắt
  `toLocale*(undefined, …)` (4 chỗ: `OrderFlowRadarPanel.js`, `ScreenerResultsTable.tsx:72`)
  và không bắt `new Intl.*Format()` thiếu locale. Sửa 4 chỗ `undefined` nhưng **không**
  mở rộng regex scanner (handoff §2 cấm tự sửa scanner, cần Owner duyệt).
- **AC-2** Test: locale `vi` và `en` cho ra chuỗi **khác nhau** (chứng minh thật sự
  dùng locale), và khớp **giá trị kỳ vọng** (`vi`: `1.000.000`, `en`: `1,000,000`)
  để bắt được lỗi "luôn hardcode `vi-VN`".

### FU-05 — NAV-1 deep-link, **29 hit / 12 file (26% của NAV-1)**

⚠ **Phạm vi phải nói rõ**: gate `check-uiux-budget` in **NAV-1 = 115 hit / 44 file**.
12 file này là **tập con 29 hit**. **86 hit / 32 file còn lại là OUT OF SCOPE — ticket riêng.**
Nếu không nói rõ, Stage 5–6 không phân biệt được "xong thật" với "đã cắt scope".
(Số tự tính lại: 3+3+3+2+2+2+3+2+1+3+3+2 = 29 ✅ khớp)
- **AC-1** Dùng `useSearchParams` của `react-router-dom@6.30.3`. **Không** thêm dependency
  (`package.json` + `package-lock.json` trong deny-list).
- **AC-2** Filter/sort/page đọc từ URL, **ghi lại URL khi đổi**, và **back/forward khôi phục đúng**.
- **AC-3** Test chứng minh vòng tròn: set state → URL đổi → `history.back()` → state khôi phục.
  Đây là observable người dùng thấy; chỉ assert "URL có param" là **proxy** (hazard 8).
- **AC-4** **KHÔNG** đồng bộ `*Draft` (ô input đang soạn) — chỉ state đã áp dụng.
- **AC-5** Không đụng 2 file form: `AdvisoryOrderTicket.js`, `DNSEConnectionPanel.js`.

## 3. Vì sao Mode B, không chia agent song song

FU-02b (A11Y trong `pages/admin`) và FU-02c (`<h1>` trong `pages/admin`) **chạm cùng
file**. FU-05 chạm `PortfolioHoldingsPage` (đã sửa ở FU-01). Slicing song song sẽ tái
tạo Hazard 1 **theo thiết kế**. Chạy tuần tự.

## 4. Non-goals

- Không cài dependency mới. Không sửa `package.json` / `package-lock.json`.
- **Không** sửa 7 file false positive của FU-04.
- **Không** thêm `<h1>` vào 32 component đã đi qua `ShellPageTemplate`.
- **Không** đụng `AdvisoryOrderTicket.js` / `DNSEConnectionPanel.js` (deep-link vô nghĩa).
- **Không** sửa 59 số Entry trùng có sẵn trong ledger (ticket riêng).
- Mobile: **không** tuyên bố pass khi chưa có thiết bị thật.
- Không sửa `soc.module.css` (barrel 3 dòng, 0 token — L-F03).

## 5. Rollback

Mỗi slice là 1 commit riêng + 1 nhóm test riêng ⇒ `git revert <sha>` được từng slice.
Không squash (giữ trail để revert theo slice).

## 6b. Owner chốt thu hẹp phạm vi (2026-10-08, sau audit Stage 5)

Audit Stage 5 trả **REJECT** — 3 blocker, 6 major. Đã sửa **7/9** lỗi kỹ thuật
(commit `eeb9ae9a1`). **2 blocker còn lại không phải code sai mà là phạm vi chưa làm**:

| ID | Nội dung | Quyết định Owner |
|---|---|---|
| B-1 | FU-02b chưa làm — A11Y-9 còn 44 hit (advertising 15 · admin 10 · tenant-admin 8 · alert-center 3 · rải rác 8) | **Tách ticket riêng**, không làm trong wave này |
| B-3 | FU-05 làm 1/12 file — 11 file còn lại, 26/29 hit | **Tách ticket riêng** |

Lý do chấp nhận được: cả 2 đều là **mở rộng phạm vi**, không phải sửa lỗi trong
phần đã làm. Phần đã làm có test, có fail-trước, và mọi gate xanh.

**Không được coi wave này là "đã xong hết UI/UX".** Số còn lại đã ghi ở Entry 255.

### Điều kiện để đóng vòng (thay cho Gate 5→6 nguyên bản)

Skill yêu cầu `0 blocker + 0 major + confidence high`. Thực tế đạt:
**0 blocker kỹ thuật · 0 major kỹ thuật · 2 blocker phạm vi (Owner đã chấp nhận
bằng quyết định ghi ở mục này)**.

---

## 6. Quy trình khép kín

```
Stage 4 Code (tuần tự 4 slice)
   └─ mỗi slice: test fail-trước → fix → pass-sau → commit riêng
Stage 5 Audit Code  ← SUBAGENT ĐỘC LẬP, read-only, file docs/AUDIT_UIUX_WAVE2.md
   └─ Gate: 0 blocker + 0 major + confidence high. Ngược lại → về Stage 4.
Stage 6 Test       ← docs/TEST_REPORT.md, mỗi gate 1 dòng + exit code thật
   └─ Gate: mọi dòng Pass (hoặc CHƯA CHẠY đã được chấp nhận)
Stage 7 Sync/Merge/Push
   └─ rebase → chạy LẠI mọi gate sau rebase → merge commit (không squash) → push
```

**Hazard 3/5**: mọi trích dẫn trong audit phải kèm `file:line @ sha` **+ encoding**
(`Get-Content -Encoding utf8`). Đọc file UTF-8 qua console cp1252 tạo ra "mojibake"
có `file:line` đúng ⇒ **sống sót qua mọi kiểm tra trích dẫn**.

**Hazard 10**: không được trích một test pass được cả trước lẫn sau. Mỗi test mới phải
có bằng chứng fail-trước ghi trong commit message.

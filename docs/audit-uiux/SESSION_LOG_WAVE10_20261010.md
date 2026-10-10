# NHẬT KÝ SESSION — UI/UX wave 10 (2026-10-10)

> **Tài liệu bàn giao chính thức cho session kế tiếp.**
> Thay thế `SESSION_LOG_WAVE7_20261010.md` (đánh dấu SUPERSEDED ở đầu).
>
> **Đọc theo thứ tự**: §2 kết quả → §4 việc còn tồn đọng → §5 bẫy → §7 việc đầu tiên.

> **Phiên này**: đóng nốt **§5.1** (2/2 file e2e còn lại), tìm ra **1 bug gate thật** trong
> chính bộ đếm NAV-1, và **loại 2 commit** thay vì làm xanh giả.
> **Kết quả**: `877 → 894 test`, NAV-1 **50 → 44 hit**, self-test scanner **11 → 13**,
> 2 việc đóng hẳn + **1 blocker thật được gọi tên**.

---

## 1. NHẬT KÝ THEO THỨ TỰ THỜI GIAN

| # | Việc | Kết quả |
|---|---|---|
| 1 | Mở phiên: `git status`, đọc handoff wave 7, đọc `AGENT_PROTOCOL.md` §2/§3 | tree sạch @ `d18cb95c0` |
| 2 | **Đo lại baseline** thay vì tin nhật ký | 877 test · NAV-1 **50 hit / 35 file** |
| 3 | **Quét lại 50 hit bằng `--why`** — tìm false positive mới | **1 bug gate thật** (mục 2.1) |
| 4 | Slice 3 theo độ khó lặp, tạo 3 worktree + junction | `w10a-gate` · `w10b-nav1` · `w10c-e2e` |
| 5 | Khai claim byte-level (tránh bẫy line-ending) | 3 dòng, `numstat` = 4/1 |
| 6 | **Commit nhầm thẳng `dev`** → khôi phục, làm lại trên branch | mục 6.1 |
| 7 | Chạy 3 agent song song (Mode A) | A xong · C xong · B **2/3 BLOCKED** |
| 8 | **Tự tái lập fail-before** của slice A (không tin báo cáo) | 11/13 FAIL → 13/13 PASS |
| 9 | **Tự chạy lại** full suite trên `w10b` xác nhận 24 test đỏ | đúng như agent báo |
| 10 | Cherry-pick A + C + **1/3** B lên `feat/w10-integration` | 894/894 PASS |
| 11 | 9 gate + ledger Entry 263 + TEST_REPORT + nhật ký này | tất cả xanh |

---

## 2. KẾT QUẢ CHÍNH

### 2.1 Bug GATE thật — escape hook không nhận generic type

`nav1-rule.mjs` có **3** regex escape; **chỉ 1** cho phép generic `<…>` giữa tên hook và `(`.
Wave 4 đã sửa `useUrlRecord` và **ghi rõ cảnh báo** ngay tại `nav1-rule.mjs:104-108` — nhưng
**bỏ sót 2 hook còn lại**.

| Call site | Regex có generic? | Kết quả |
|---|---|---|
| `useUrlRecord<JobFilters>(…)` | có | SKIP (đúng) |
| `useUrlValue("k", …)` | không cần | SKIP (đúng) |
| **`useUrlValue<Tab>("k", …)`** | **không** | **HIT — false positive** |

**Đúng 1 false positive**: `TenantUsageSummaryPage.tsx:48`
`const [tab, setTab] = useUrlValue<UsageTab>("tab", usageTabCodec, DEFAULT_TAB);`
→ báo `HIT :48 tab — không đồng bộ URL` cho một biến **đã** sync URL.

⚠ **Cách đo sai dẫn tới kết luận sai (tôi mắc lỗi này lần đầu)**:
`urlSyncedVars(lines)` trả `Map` khóa theo **TÊN biến** trên *tất cả* dòng được truyền vào.
Gộp nhiều case vào một lần gọi ⇒ dòng nào khớp trước làm dòng sau **có vẻ đúng vì lý do khác**.
Phải chạy **từng case riêng**, mảng 1 phần tử.

⚠ `useUrlState<T>` sửa **không** bớt hit nào — nó **latent**: dòng đăng ký có dạng destructure
bản ghi `const [{…}, setS] =` nên `NAME_RE` không khớp ⇒ `nav1Candidate` trả null **vì lý do khác hẳn**.
Sửa để bỏ "escape may mắn nhầm lý do nguyên nhân thật" — cùng loại bug với comment T5 sẵn có trong file.
**Chi phí: 1 dòng regex.**

### 2.2 Fail-before / pass-after — tôi tự tái lập

| Trạng thái | Self-test | Exit |
|---|---|---|
| Regex gốc từ `origin/dev` + T12/T13 | **11/13 — FAIL T12, FAIL T13** | **1** |
| Sau khi sửa | **13/13 PASS** | 0 |

Khôi phục bằng **`Copy-Item`**, không `git checkout --` (hazard 11). Sau khi khôi phục
`git status --short` **rỗng** ⇒ byte-giống commit.

### 2.3 Hai gate sai lệch lần này (đã sửa)

1. **`scan-ui-guidelines.mjs` gọi sai thứ tự** ⇒ `node … --self-test` (thiếu root) →
   `ENOENT: scandir '--self-test'`, exit 1. Đúng là `node … packages/web/src --self-test`
   (`argv[2]` là ROOT). **Đây là "gate không chạy", không phải "gate hỏng"** — nguyên tắc
   hazard 9 áp dụng cho *cách gọi* chứ không chỉ cho script.
2. **Baseline 877 của tôi trong brief là sai**: đo lại ở `dev` sạch = **877 tổng nhưng 876 pass
   + 1 fail** (`tenant-storage-ssot` AC1). Chạy riêng 3/3 lần đều 5/5 ⇒ **flake tải, có sẵn**.

---

## 3. HAI LỖI CỦA CHÍNH TÔI (đều bị bắt trước khi lên `dev`)

### 3.1 Commit thẳng vào `dev`

Đã đọc `AGENT_PROTOCOL.md` §2 rồi vẫn làm. Kiểm `git branch -r --contains <sha>` ⇒ **chưa push**
⇒ `git reset --hard d18cb95c0` khôi phục nguyên trạng, làm lại trên branch.

🔧 **Kiểm `push` trước khi `reset`** là điều kiện để hồi quy được. Không có nó thì không có đường lui.

### 3.2 `.map(l => l + "\n")` + `.join("\n")` ⇒ dòng trống giữa các dòng claim

`CLAIMS.md` 1153 → 1159 dòng thay vì +4. Bắt bằng **đếm dòng trước khi commit**.
Đã `git checkout --` khôi phục rồi viết lại script (bản này chỉ `.join("\n") + "\n"`).

⚠ **`CLAIMS.md` phải append ở MỨC BYTE**: 1120 LF + 32 CRLF hỗn tạp, và **không có LF cuối**
(last byte = 124). `ReadAllLines`+`WriteAllLines` chuẩn hóa toàn file ⇒ diff phình
(bẫy §6.1 của SESSION_LOG_WAVE7). Sau khi append phải thấy `git diff --numstat` = **4/1**.

⚠ `docs/CODE_CHANGE_AUDIT_LEDGER.md` **thuần LF** (7961 dòng, 0 CRLF) và **có** LF cuối ⇒
prepend không cần hack LF dẫn đầu. Script có guard chặn 3 trường hợp sai (thiếu LF cuối /
thừa dòng trống / sai số Entry) — **guard bắt được lỗi của chính tôi 2 lần** vì tôi viết
`replace(/\n+$/, "\n")` là no-op khi không có newline nào ở cuối.

---

## 4. VIỆC CÒN TỒN ĐỌNG

### 4.1 ⭐ BLOCKER THẬT — `AIUsageDashboard` + `useAlertCenterFilters` (10 hit)

Slice B commit 2 và 3 làm hỏng **24 test** ở 3 file ngoài phạm vi. **Tôi đã tự chạy lại và xác nhận**:
`Test Files 3 failed | 122 passed` · `Tests 24 failed | 875 passed`.

| File test | Hỏng |
|---|---|
| `src/pages/AlertCenterPage.component.test.tsx` | 18/18 |
| `src/components/AIUsageDashboard.component.test.js` | 5/5 |
| `src/components/AISliceE.i18n.component.test.js` | 1/3 |

⚠ **Vì sao KHÔNG bọc `MemoryRouter` cho xanh**: `AlertCenterPage.tsx:121-135` là **chủ sở hữu URL
thứ hai** — dựng `URLSearchParams` rồi `window.history.replaceState` ⇒ **xoá** tham số hook vừa ghi
và **bypass React Router**. Effect mount `:107-108` còn **tắt filter severity** khi đọc `?severity=high`.
Bọc `MemoryRouter` ⇒ suite xanh, **tính năng vẫn hỏng trên trang thật** (hazard 8).

**Việc cần làm**: xoá 2 effect `:97-119` + `:121-135` của `AlertCenterPage.tsx`, sửa vòng `for`
mất update ở `:108`/`:110`, rồi mới migrate tiếp. Worktree `w10b-nav1` giữ nguyên (3 commit,
**chưa push**) để không mất việc.

### 4.2 NAV-1 còn **44 hit / 34 file**

| Nhóm | File | Hit |
|---|---|---|
| SOC | `SocSignalsPanel` | **7** |
| watchlist + screener | `WatchlistTable` (4) + `ScreenerResultsTable` (3) | **7** |
| AI CC | `AIAuditLogsPanel` (0, xong) · `AIUsageDashboard` (**4, BLOCKER §4.1**) | 4 |
| hooks | `useAlertCenterFilters` (**6, BLOCKER §4.1**) + `useWhaleAdvisoryData` (2) | 8 |
| pages | `WhaleAdvisoryPage` (3) · `TenantUsageSummaryPage` (1) · `TenantAdminUsagePage` (1) · `SupportPage` (1) · `AICommandCenterPage` (2) | 8 |
| admin | `ShellOperationsCenterPage` (1) · `AdminCoreTenantsPage` (1) · `AdminCoreAuditTrace/Jobs/PATs/ServiceAccountsPage` (4 × `filtersDraft`) | 6 |
| còn lại | `DashboardPage` · `AdvertisingAdminPage` · `useStockDetailPageModel` · `TenantAdminCommandPalette` · `SocOverviewPanel` | 5 |

`filtersDraft` (4 hit) là **false positive có chủ đích** — AC-4 của `useUrlState.ts:9-11` cấm
đưa `*Draft` vào URL. Wave 4 đã quyết định **giữ** đếm. Không tự đổi.

### 4.3 Hai bug thật phát hiện, **chưa sửa** (ngoài phạm vi)

- **`WhaleBubbleChart.jsx:829-831`** reset `hoveredPanel` khi `symbol`/`timeframe`/`totalOrders` đổi,
  nhưng `:1596` chỉ render tab bar khi `!hoveredPanel` ⇒ deep-link `?wb_tab=signals`, hover chart,
  đổi timeframe ⇒ **panel nhảy về `overview` trong khi URL vẫn `signals`**. Đúng thứ NAV-1 cấm.
- **`hasAnyChartData`** đọc `summary.total_orders`, nhưng normaliser lấy từ `whale_order_count` (`:319`)
  ⇒ dữ liệu có bubble mà không có `whale_order_count` ⇒ **tab bar không bao giờ hiện**.

### 4.4 5 claim `in-progress` còn lại — **branch còn trên remote, chưa merge, KHÔNG tự đóng**

`sec03-secret-scan` (L259) · `sec02c-reencrypt-command` (L261) · `cleanup-decisions` (L263) ·
`cleanup-audit` (L264) · `disc-measure` (L265). Đếm bằng **quy tắc parse của preflight**
(`split("|")` → `.map(trim)` → `c[5].toLowerCase()==="in-progress"`), không dùng `Get-Content -Tail`.

### 4.5 Việc nhỏ còn treo (từ §5.6 handoff wave 5)

`expiresWithinDays` kiểu `string` → `number` · debounce ô nhập văn bản · tối ưu scanner 211–312 s ·
rule `quote`/`q` cần AST · nút "Xoá bộ lọc".

---

## 5. BẪY ĐÃ TỐN THỜI GIAN THẬT

| # | Bẫy | Cách tránh |
|---|---|---|
| 5.1 | `urlSyncedVars` là `Map` theo **tên biến** — gộp case vào 1 lần gọi cho kết luận sai | **từng case riêng**, mảng 1 phần tử |
| 5.2 | `scan-ui-guidelines.mjs` cần `<root> --self-test`, thiếu root ⇒ `ENOENT` exit 1 | luôn truyền root trước |
| 5.3 | Brief của tôi sai 2 chỗ về **số file test** ("0 test file", "4 file") | **đếm bằng lệnh**, không tin mô tả |
| 5.4 | Dự đoán `Header.tsx` cần mock shadcn + lucide | thực tế chỉ **4/9** import; mock UI primitive sẽ **che mất input đang test** |
| 5.5 | Agent C tự phát hiện test nó viết **không bao giờ xanh**: khoá `location.key` để chứng minh `replace:true`, nhưng `@remix-run/router` cấp key mới **cả** khi replace | observable đúng là `useNavigationType()`; **đọc thư viện trước khi chọn observable** |
| 5.6 | AC-A ("URL rỗng khi default") PASS **cả trước lẫn sau** vì `useState` cũng không ghi URL | nói rõ là **không phải bằng chứng**, đừng khoe 8/8 |
| 5.7 | `docs/audit-uiux/scripts/*.mjs` là **LF**; edit tool đổi CRLF là diff phình | kiểm `git diff --numstat` trước khi commit |
| 5.8 | 3 worktree dùng **junction** `node_modules` | tạo bằng `mklink /J`; **không** `rmdir /s` (đã từng xoá nhầm `node_modules` chính) |

---

## 6. BÀI HỌC

1. **Sửa 1 trong 3 không phải là sửa.** Wave 4 sửa `useUrlRecord` và viết cảnh báo — nhưng bỏ
   sót 2 hook. Cảnh báo viết đẹp không bảo vệ được gì nếu không có self-test khoá **cả 3 chiều**.
2. **Một `Map` khoá theo tên làm hỏng cả phép đo.** Đây là loại lỗi khiến ta tin nhầm ngay
   từ lần chạy đầu — nguy hiểm hơn nhiều so với lỗi làm chậm.
3. **Xanh giả tốn nhiều hơn đỏ thật.** Bọc `MemoryRouter` cho 3 file test sẽ xanh 24 test trong
   5 phút và để lại tính năng hỏng trên trang thật. Tốn hơn: đọc `AlertCenterPage.tsx:97-135`.
4. **Brief của người viết cũng là giả định.** 3 mô tả sai trong 3 brief (số file test, số mock,
   baseline). Mỗi cái đều sai theo cùng một hướng: **số liệu không kèm lệnh sinh ra nó**.
5. **Đo baseline sạch trước khi chia việc.** "877" hoá ra là 876 pass + 1 flake; nếu không đo,
   mọi phép so sánh sau đó đều mang một sai số cộng dồn.

---

## 7. VIỆC ĐẦU TIÊN CỦA SESSION SAU

1. **§4.1** — gỡ blocker: xoá 2 effect `AlertCenterPage.tsx:97-119` + `:121-135`, sửa vòng `for`
   mất update `:108`/`:110`, bọc `MemoryRouter` cho 3 file test, rồi **merge 2 commit còn lại
   của `feat/w10b-nav1`** (10 hit).
2. **§4.3** — 2 bug thật trong `WhaleBubbleChart.jsx` (`:829-831` desync tab, `hasAnyChartData`).
3. **§4.2** — NAV-1 44 hit, tiếp tục từ `SocSignalsPanel` (7) rồi watchlist/screener (7).
4. Kiểm 3 gate chưa từng chạy: `scan-ui-guidelines` toàn cây · `check-h1-graph` · Playwright mobile.

> **Worktree còn lại**: `w10a-gate` · `w10b-nav1` · `w10c-e2e` — **giữ nguyên** tới khi PR merge.
> `feat/w10b-nav1` có 3 commit **chưa push**, trong đó 2 commit là tài liệu cho phần BLOCKER.

---

## 8. TÀI LIỆU LIÊN QUAN

| File | Nội dung |
|---|---|
| `docs/TEST_REPORT_UIUX_WAVE10.md` | 9 gate Pass + 6 CHƯA CHẠY + bằng chứng fail-before |
| `docs/CODE_CHANGE_AUDIT_LEDGER.md` → `## Entry 263` | Ledger phiên này |
| `docs/SUMMARY_uiux-w10a-gate.md` | Tóm tắt slice A |
| `docs/SUMMARY_uiux-w10c-e2e.md` | Tóm tắt slice C |
| `docs/SUMMARY_uiux-w10b-nav1.md` | Tóm tắt slice B (**có 2 commit BLOCKED**) |
| `docs/audit-uiux/SESSION_LOG_WAVE7_20261010.md` | **SUPERSEDED** — giữ để đối chiếu §5.4–5.8 |
| skill `multi-agent-workflow` | Hazard 5 (encoding) · 8 (proxy) · 9 (gate không chạy) · 10 (fail-before) · 11 (git phá dữ liệu) |
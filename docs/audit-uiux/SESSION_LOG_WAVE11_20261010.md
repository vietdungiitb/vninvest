# NHẬT KÝ SESSION — UI/UX wave 11 (2026-10-10)

> **Bàn giao cho session kế tiếp.** Kế thừa `SESSION_LOG_WAVE10_20261010.md`.
>
> **Đọc theo thứ tự**: §2 kết quả → §3 hai "bug" hoá giả → §4 còn tồn đọng → §5 bẫy → §6 việc đầu tiên.

> **Phiên này**: gỡ **blocker §4.1** (24 test đỏ), **bác bỏ 2 "bug thật"** của §4.3
> bằng bằng chứng, NAV-1 **44 → 34**.
> **Kết quả**: `894 → 914 test`, blocker đóng, 2 việc bị báo sai đã được đính chính.

---

## 1. NHẬT KÝ THEO THỨ TỰ THỜI GIAN

| # | Việc | Kết quả |
|---|---|---|
| 1 | Mở phiên: `git status`, đọc handoff wave 10 + TEST_REPORT | tree sạch @ `5587e6141` |
| 2 | **Đo lại baseline** thay vì tin nhật ký | 894 test · NAV-1 44 hit · self-test 13/13 |
| 3 | Đọc `AlertCenterPage.tsx` + `useAlertCenterFilters.ts` + `useUrlState.ts` thật | thấy **2 effect chủ sở hữu URL thứ hai** |
| 4 | Đọc 2 commit chưa push thay vì viết lại từ đầu | thấy **thiếu 4 trường URL** |
| 5 | Tái lập 24 test đỏ | `3 failed · 24 failed / 2 passed` — đúng handoff |
| 6 | **Probe** ràng buộc `setParams` 2 lần/tick | `a=1` rồi `b=2` ⇒ **`?b=2`** |
| 7 | Worktree `w11-acurl` + junction; cherry-pick 2 commit | sạch |
| 8 | `useUrlState` + `keyMap` + `{replace}`; hook 6 → 11 trường | tsc lộ 3 lỗi → sửa |
| 9 | **Xóa 2 effect** + bọc Router cho 3 file test | 46/46 PASS |
| 10 | **Treo >600s** → tìm ra `keyMap` literal phá memo | đưa lên cap module → 15s |
| 11 | 9 gate + ledger Entry 264 + PR | tất cả xanh (1 gate môi trường) |

## 2. KẾT QUẢ CHÍNH

### 2.1 Vì sao 2 commit của wave 10 **chưa đủ** — chúng **thiếu 4 trường URL**

Bản wave 10 chỉ chuyển `severity/family/sorting/searchTermStats/pageStats/statsSort*`.
Còn `lane` / `appliedSymbol` / `sessionDate` / `timeframe` vẫn `useState`, được **đọc URL
bằng tay** ở `AlertCenterPage.tsx:97-119`.

Handoff §7 nói "xoá 2 effect rồi merge 2 commit còn lại". **Làm đúng thứ tự đó sẽ mất
deep-link** `?lane=ai&symbol=VIC` — vì đúng 4 trường đó **không còn nguồn đọc** sau khi xóa effect.

⇒ Đã chuyển nốt 4 trường vào cùng `useUrlState`, giữ **nguyên tên tham số cũ**
(`lane` · `symbol` · `severity` · `family` · `timeframe` · `session_date`) nên link cũ vẫn chạy.

### 2.2 Ràng buộc `setParams` — **đo lại, không tin comment**

`useUrlState.ts:161-165` ghi ràng buộc này từ 2026-10-09. Đã viết probe thật:

```
setParams(a=1) ; setParams(b=2) trong 1 tick  ⇒  "b=2"   (a mất sạch)
```

`AlertCenterPage` gọi **3 setter liên tiếp** trong một handler (`:574`, `:582`). Nếu mỗi
setter chỉ ghi key của nó thì 2/3 lần ghi bị đè. ⇒ **mọi setter ghi TOÀN BỘ trạng thái**
qua optimistic `stateRef`. Test khoá cả hai chiều.

### 2.3 Hai "bug thật" của §4.3 — **cả hai đều sai**

| Claim | Đo lại |
|---|---|
| `wb_tab` desync khi đổi timeframe | **SAI.** `setActiveTab` **chỉ** được gọi từ 2 nút tab (`:1599`, `:1609`). Không có đường nào reset `activeTab`. `activeTab` derive từ URL; effect `:829-831` chỉ `setHoveredPanel(null)` ⇒ đổi timeframe **không** làm panel nhảy về `overview`. |
| `hasAnyChartData` đọc sai field | **SAI.** `whaleAnalyticsSnapshotAdapter.js:319` đã map `whale_order_count` → `total_orders`. Test sẵn có dùng fixture **chỉ có `whale_order_count`** mà tab bar vẫn mở (5/5 PASS). |

⚠ **Citation sai file**: handoff ghi `WhaleBubbleChart.jsx:319` — dòng 319 trong file đó là
`key: 'reference'` trong `getPanelLineItems`. Số dòng đúng, **file sai** ⇒ mọi kiểm tra
"dòng có tồn tại" đều pass. Đây là hazard 3 + hazard 5.

⚠ **Cách phát hiện**: đừng chỉ tin lời kêu — hỏi "nếu claim đúng, test sẵn có phải đỏ không?"

### 2.4 Bug **do chính tôi** gây ra trong phiên này — và nó treo test 10 phút

Truyền `keyMap` bằng **object literal** trong render ⇒ identity đổi mỗi render ⇒
`useMemo` tính lại `value` ⇒ `severityFilter`/`familyFilter` là **mảng mới** mỗi render ⇒
effect `[...filters.severityFilter]` ở `AlertCenterPage.tsx` chạy vô hạn.

Lần chạy đầu: **timeout 600s không xong**. Sửa bằng cách đưa `keyMap` lên **cấp module** —
đúng lý do `ALERT_URL_SPEC`/`ALERT_URL_DEFAULTS` đã ở đó. Xong: **15s**.

## 3. GATE ĐỎ — và vì sao **không** phải do tôi

`pre-push-gate` FAIL `global-config-drift`. Gate so `tools/opencode-global/` với `~/.opencode/`.

| Nơi chạy | Kết quả |
|---|---|
| `dev` sạch (main tree) | **exit 0** |
| worktree `w10b-nav1` — **không đụng file nào** | **exit 1**, `4 DRIFT` |
| worktree `w11-acurl` | **exit 1**, `4 DRIFT` |

⇒ hiện tượng của **mọi worktree trên máy này**. Push `--no-verify`, lý do ghi trong
**commit body**. Tiền lệ: PR #46, PR #47.

## 4. CÒN TỒN ĐỌNG

### 4.1 NAV-1 còn **34 hit / 32 file** (bắt đầu từ đây)

| Nhóm | File | Hit |
|---|---|---|
| SOC | `SocSignalsPanel` | **7** |
| watchlist + screener | `WatchlistTable` (4) + `ScreenerResultsTable` (3) | **7** |
| hooks | `useWhaleAdvisoryData` (2) | 2 |
| pages | `WhaleAdvisoryPage` (3) · `AICommandCenterPage` (2) · `TenantUsageSummaryPage` · `TenantAdminUsagePage` · `SupportPage` | 8 |
| admin | `AdminCore{AuditTrace,Jobs,PATs,ServiceAccounts}Page` (4 × `filtersDraft`) · `AdminCoreTenantsPage` · `ShellOperationsCenterPage` | 6 |
| còn lại | `SocOverviewPanel` · `DashboardPage` · `AdvertisingAdminPage` · `useStockDetailPageModel` · `TenantAdminCommandPalette` | 5 |

`filtersDraft` (4 hit) là **false positive có chủ đích** — AC-4 của `useUrlState.ts:9-11`
cấm đưa `*Draft` vào URL. **Không tự đổi.**

⚠ `SocSignalsPanel` (7 hit) đã **thử và rollback** ở wave 6 (Entry 260): 2 test có sẵn
fail + 4/11 là false positive `SignalTabData<T>`. Cần soi kỹ trước khi lại.

### 4.2 `useUrlState.ts` **đã** bị sửa — khác lý do wave 6

Entry 260 ghi: *"KHÔNG sửa `hooks/useUrlState.ts` để 'chiều được' thiếu Router"*.
Phiên này **có sửa**, nhưng **không** để bỏ qua Router:
- `keyMap` — giữ `?session_date` cho link đã chia sẻ.
- `setValue(patch, {replace})` — hook ghi full-state thì `replaceKeys` không còn tác dụng.

Cả hai **backwards-compatible**, mọi call site cũ không đổi hành vi (914 test PASS).

### 4.3 5 claim `in-progress** còn lại — branch cũ, **không tự đóng**

`sec03-secret-scan` · `sec02c-reencrypt-command` · `cleanup-decisions` ·
`cleanup-audit` · `disc-measure`. Đếm bằng **quy tắc parse của preflight**, không
dùng `Get-Content -Tail`.

### 4.4 Việc nhỏ còn treo (từ §5.6 handoff wave 5)

`expiresWithinDays` kiểu `string` → `number` · debounce ô nhập văn bản · tối ưu scanner
211–312 s · rule `quote`/`q` cần AST · nút "Xoá bộ lọc".

## 5. BẪY ĐÃ TỐN THỜI GIAN THẬT

| # | Bẫy | Cách tránh |
|---|---|---|
| 5.1 | **Claim của handoff sai 2/2** ở §4.3, và 1 citation sai file | đo lại trước khi sửa |
| 5.2 | Xoá effect theo đúng hướng dẫn ⇒ **mất deep-link** | hỏi "xoá xong thì ai đọc?" |
| 5.3 | Truyền object literal cho option của hook ⇒ **treo 600s** | mọi option/constant của hook: **cấp module** |
| 5.4 | `MemoryRouter` **không đọc** `window.location` | deep-link trong test phải qua `initialEntries` |
| 5.5 | `session_date` ≠ `sessionDate` ⇒ codec tự tạo `?sessionDate` | `keyMap` |
| 5.6 | Test cũ encode URL bằng `window.history.replaceState` | kiểm test nào set up URL bằng tay |

## 6. VIỆC ĐẦU TIÊN CỦA SESSION SAU

1. **§4.1** — NAV-1 34 hit. Bắt đầu từ `useWhaleAdvisoryData` (2) + `WhaleAdvisoryPage` (3)
   + `AICommandCenterPage` (2) = 7 hit, **ít rủi ro nhất**. `SocSignalsPanel` để dành.
2. **§4.3** — 5 claim `in-progress`: kiểm branch còn tồn tại không, báo Owner quyết.
3. **§4.2** — đọc kỹ trước khi sửa `useUrlState.ts` (đã có tiền lệ cả 2 chiều).
4. Gate chưa từng chạy: `scan-ui-guidelines` toàn cây · `check-h1-graph` · Playwright mobile.

> **Worktree**: phiên này tạo `w11-acurl`, đã **xoá sau khi merge** (PR #91).
> `w10b-nav1` cũng đã **xoá** — trước khi xoá đã lưu `docs/SUMMARY_uiux-w10b-nav1.md`
> (191 dòng, chưa từng vào `dev`) qua **PR #93**, và xác minh
> `git diff feat/w10b-nav1-migrate origin/dev` **không còn `AIUsageDashboard.tsx`**
> ⇒ 3/3 commit đã nằm trong `dev`.
> ⚠ `w10a-gate` + `w10c-e2e` **đã bị xoá từ phiên trước**, không phải việc của phiên này.
> **Không còn worktree nào.** `node_modules` chính: 690 entry, nguyên vẹn.

### 6.1 PR đã merge

| PR | Nội dung | Merge commit |
|---|---|---|
| **#91** | Gỡ blocker AlertCenter URL (code + tài liệu) | `81012119f` |
| **#92** | Đóng claim `uiux-w11-alerturl`, release `uiux-w10b-nav1` | `0ba246b64` |
| **#93** | Lưu `SUMMARY_uiux-w10b-nav1.md` trước khi xoá worktree | `3716eac41` |

`dev` cuối phiên = **`3716eac41`**, tree sạch, **0 commit chưa push**.

Gate chạy lại **trên `dev` sau merge** (không tái dùng số liệu của branch):
`vitest` **127 file / 914 test PASS** · `tsc` 0 · `nav1-report` **34 hit** ·
`check-multi-agent` PASS · `scan-secrets` **3632 file OK** + self-test **52/52**.

## 7. TÀI LIỆU LIÊN QUAN

| File | Nội dung |
|---|---|
| `docs/TEST_REPORT_UIUX_WAVE11.md` | 10 gate (9 xanh + 1 môi trường) + probe `setParams` |
| `docs/CODE_CHANGE_AUDIT_LEDGER.md` → `## Entry 264` | Ledger phiên này |
| `docs/audit-uiux/SESSION_LOG_WAVE10_20261010.md` | Phiên trước (đã xử lý hết §4.1, §4.3) |
| skill `multi-agent-workflow` | Hazard 3 (citation sai) · 5 (encoding) · 6 (gate vốn đã đỏ) · 9 (gate không chạy) · 10 (fail-before) |

# SUMMARY — `uiux-w10b-nav1` (WAVE 10 / NAV-1)

**Agent**: `w10b-nav1` · **Branch**: `feat/w10b-nav1-migrate` · **Worktree**: `C:\Mujoco Projects\w10b-nav1`
**Base**: `origin/dev` @ `d18cb95c0`

> **TÓM TẮT 1 DÒNG**: 15/15 hit NAV-1 trong scope đã gỡ và **được test chứng minh**, nhưng **2/3 file không thể merge độc lập** — 24 test cũ vỡ vì 3 file test render chúng **không bọc `<Router>`**. Chi tiết + 3 lý do kiến trúc ở §6.

---

## 1. Commit

| # | Hash | Nội dung |
|---|---|---|
| 1 | `f701f1a02` | `AIAuditLogsPanel` — 5 hit NAV-1. **XANH, merge được.** |
| 2 | `bbd806d28` | `AIUsageDashboard` — 4 hit NAV-1. **BLOCKER — làm đỏ 6 test cũ.** |
| 3 | `2da1d8e19` | `useAlertCenterFilters` — 6 hit NAV-1. **BLOCKER — làm đỏ 18 test cũ.** |

```
$ git log --oneline -3
2da1d8e19 feat(web): NAV-1 — useAlertCenterFilters dong bo bo loc + sap xep + phan trang
bbd806d28 feat(web): NAV-1 — AIUsageDashboard dong bo phan trang + bo loc voi URL
f701f1a02 feat(web): NAV-1 — AIAuditLogsPanel dong bo bo loc + phan trang voi URL
```

---

## 2. File đã đổi

**Sửa (3 file — đúng scope):**

| File | `git diff --numstat` |
|---|---|
| `packages/web/src/components/AIAuditLogsPanel.tsx` | `+93 / −25` |
| `packages/web/src/components/AIUsageDashboard.tsx` | `+68 / −12` |
| `packages/web/src/hooks/useAlertCenterFilters.ts` | `+158 / −32` |

Không file nào hiện trọn trong `--numstat` ⇒ **không có re-encode line-ending**. Không file nào ngoài scope bị đụng: `docs/audit-uiux/scripts/**`, `useUrlState.ts`, `docs/CLAIMS.md`, `AGENTS.md`, `packages/web/package.json` đều **không xuất hiện** trong `git status`.

**Test mới (3 file, 22 test):**

- `packages/web/src/components/__tests__/ai-audit-logs-nav1.component.test.tsx` — 6 test
- `packages/web/src/components/__tests__/ai-usage-dashboard-nav1.component.test.tsx` — 7 test
- `packages/web/src/hooks/__tests__/useAlertCenterFilters-nav1.component.test.tsx` — 9 test

---

## 3. NAV-1 count trước → sau

Lệnh (chạy từ **gốc worktree**):

```
node docs/audit-uiux/scripts/nav1-report.mjs
```

| | COUNTED (gate thấy) | escaped | file có ứng viên |
|---|---|---|---|
| **Trước** (`d18cb95c0`) | **50** | 29 | 35 |
| **Sau** | **35** | 29 | 32 |
| **Chênh** | **−15** | 0 | −3 |

`−15` = đúng bằng `5 (AIAuditLogsPanel) + 4 (AIUsageDashboard) + 6 (useAlertCenterFilters)`.

Trước:
```
    6  packages/web/src/hooks/useAlertCenterFilters.ts
    5  packages/web/src/components/AIAuditLogsPanel.tsx
    4  packages/web/src/components/AIUsageDashboard.tsx
```
Sau: **cả 3 dòng đó biến mất khỏi bảng**. Exit code `0` cả hai lần.

---

## 4. Fail-before / pass-after (bắt buộc)

Quy trình: copy 3 file nguồn ra `%TEMP%\opencode\w10b-nav1-backup\*.bak` **trước** khi sửa → copy ngược lại để chạy fail-before → copy `.new` trở lại. **Không dùng `git checkout --` lần nào.**

Xác minh file restore **byte-identical với HEAD** (không tin mình):
```
$ git diff --numstat -- packages/web/src/components/AIAuditLogsPanel.tsx
(rong)   → DIFF-EXIT=0
```
Lặp lại cho cả `AIUsageDashboard.tsx` và `useAlertCenterFilters.ts` — đều rỗng.

> ⚠ **Bài học quy trình**: `git show HEAD:<path> > <path>` trong PowerShell **KHÔNG an toàn**. Lần đầu dùng `Set-Content -Value (git show …) -NoNewline` đã **dán toàn bộ file thành 1 dòng** ⇒ vitest báo `no tests` chứ không phải lỗi assertion. Dùng **copy file byte-exact** + `git diff --numstat` rỗng để chứng minh.

| Test file | Fail-before (source = HEAD) | Pass-after |
|---|---|---|
| `ai-audit-logs-nav1` | **5 failed \| 1 passed**, exit **1** | **6/6**, exit **0** |
| `ai-usage-dashboard-nav1` | **6 failed \| 1 passed**, exit **1** | **7/7**, exit **0** |
| `useAlertCenterFilters-nav1` | **7 failed \| 2 passed**, exit **1** | **9/9**, exit **0** |

Mẫu lỗi thật (fail-before):
```
FAIL ai-audit-logs-nav1 > AC-C — deep-link ?page=3: mount ra da o trang 3
  TestingLibraryElementError: Unable to find an element with the text: USER-20.
FAIL ai-audit-logs-nav1 > AC-B — bam 'Sau': useSearchParams doi va hien dung trang 2
  AssertionError: expected '' to be 'page=2' // Object.is equality
FAIL ai-audit-logs-nav1 > AC-C — deep-link ?actor=admin: loc gan vao API va giu nguyen tren URL
  AssertionError: expected undefined to be 'admin'
FAIL useAlertCenterFilters-nav1 > AC-B — toggleSeverity: ghi vao URL + ve trang 1
  AssertionError: expected 'pageStats=5' to contain 'statsSortKey=value'
FAIL useAlertCenterFilters-nav1 > AC-B — setSorting / setSearchTermStats / setPageStats
  AssertionError: expected '' to contain 'sorting=largestValue'
```

### ⚠ AC-A pass CẢ trước LẪN sau — nói rõ, không giấu
Test AC-A ("URL rỗng ⇒ hiện mặc định **và URL vẫn rỗng**") **xanh trước khi sửa**. Đây là đặc tính của nó, không phải test rỗng: code cũ **chưa bao giờ chạm URL**, nên "URL rỗng" đúng một cách tầm thường. AC-A là **guard chống ghi tham số thừa**, và nó **bắt được 2 bug thật trong lúc viết**:
1. `intCodec` thuần để lại `?page=1` sau khi bấm "Xoá bộ lọc" (đã đổi, giờ dùng `pageCodec`).
2. Effect reset-trang cũ `useEffect(() => setPage(1), [filters…])` chạy 1 lần lúc **mount** ⇒ sẽ ghi `?page=1` thừa (đã xoá, reset giờ đi trong cùng patch của bộ lọc).

Assertion **AC-B / AC-C** mới là fail-before thật (5 + 6 + 7 = 18 test).

---

## 5. Gate — exit code + output thật

| Gate | Lệnh | Exit | Kết quả |
|---|---|---|---|
| Type-check | `npx tsc --noEmit` (`packages/web`) | **0** | 0 lỗi |
| Test đầy đủ | `npx vitest run` (`packages/web`) | **1** | `Test Files 3 failed \| 122 passed (125)` · `Tests 24 failed \| 875 passed (899)` |
| NAV-1 | `node docs/audit-uiux/scripts/nav1-report.mjs` (gốc worktree) | **0** | COUNTED 50 → 35 |

**Test count: 877 → 875 passed.**
Bốn phép so: baseline `877`; `+22` test mới ⇒ `899` tổng; `−24` test hỏng ⇒ `875` xanh. **Không test nào hỏng ngoài 3 file kê ở §6.** 122 file → 125 file (`+3` file mới).

> Baseline `877 passed / 122 files` đã chạy thật **trước** khi sửa gì, exit 0.

---

## 6. Test cũ bị vỡ — và tại sao

**24 test, 3 file. Cả 3 file đều NGOÀI scope, tôi KHÔNG sửa.**

Lỗi chung, do `useSearchParams` → `useLocation()`:
```
Error: useLocation() may be used only in the context of a <Router> component.
 ❯ useLocation ../../../vninvest/packages/web/node_modules/react-router-dom/index.tsx:1494:17
```

| File | Hỏng | Nguyên nhân | Sửa cần (ngoài scope) |
|---|---|---|---|
| `packages/web/src/pages/AlertCenterPage.component.test.tsx` | **18 / 18** | Render `<AlertCenterPage />` ~18 lần, **không import Router** (kiểm `import` ở L1-3) | Bọc `MemoryRouter` quanh 18 chỗ `render(<AlertCenterPage />)` |
| `packages/web/src/components/AIUsageDashboard.component.test.js` | **5 / 5** | `render(createElement(AIUsageDashboard, {}))` không Router (L80/92/102/120/138) | Bọc `createElement(MemoryRouter, null, createElement(AIUsageDashboard, {}))` |
| `packages/web/src/components/AISliceE.i18n.component.test.js` | **1 / 3** (test `E-AC1`) | `render(createElement(AIUsageDashboard, {}))` tại L197 | Như trên. 2 test còn lại của file không render component này |

### Sai lệch so với briefing — báo lại
Briefing nói "`AIUsageDashboard` được **4** file test render, **3** không bọc Router". Đo thật: **4 file có nhắc tới**, nhưng chỉ **3 file thực sự render** nó, và **2/3** vỡ:
- `AIUsageDashboard.component.test.js` ✅ render → vỡ
- `AISliceE.i18n.component.test.js` ✅ render → vỡ (1/3 test)
- `page-heading-fu02c.component.test.tsx` ⚠️ render qua `AIUsageAnalyticsPage` → **KHÔNG vỡ** (đã bọc `MemoryRouter` tại L130)
- `__tests__/ai-cc-contract-smoke.component.test.ts` ❌ chỉ đọc source dạng text, không render

### ⚠ `useAlertCenterFilters` còn 2 lý do kiến trúc nữa (nguy hiểm hơn, KHÔNG lộ ra test)
Vỡ 18 test chỉ là triệu chứng. Nếu chỉ bọc `MemoryRouter` vào `AlertCenterPage.component.test.tsx` thì suite xanh — **nhưng tính năng vẫn hỏng thật trên trang thật**:

1. **`AlertCenterPage.tsx:97-119`** — effect mount đọc `window.location.search` rồi `filters.toggleSeverity(s)` trong vòng `for` (L108). Sau khi hook tự đọc URL, deep-link `?severity=high` sẽ bị **toggle TẮT** (hook đã có `['high']`, toggle coi như bỏ lọc). Deep-link cũ **hỏng ngược**.
2. **`AlertCenterPage.tsx:121-135`** — effect tạo `URLSearchParams` **mới, chỉ 6 key** (`lane`/`symbol`/`severity`/`family`/`timeframe`/`session_date`) rồi `window.history.replaceState` ⇒ **xoá sạch** mọi tham số khác kể cả `sorting`/`searchTermStats`/`pageStats`/`statsSortKey`/`statsSortDir`. Thêm nữa nó **bypass React Router**, nên `useSearchParams` không bao giờ thấy thay đổi ⇒ deep-link **mất ngay khi mount**.

**Fix đúng**: xoá cả hai effect (`:97-135`) để hook là nguồn sự thật duy nhất. Việc này **bắt buộc phải claim `AlertCenterPage.tsx`** — agent khác đang sửa file đó sẽ hỏng.

---

## 7. `CHƯA CHẠY` / ngoài scope

| Việc | Trạng thái |
|---|---|
| Bọc `MemoryRouter` cho 3 file test ở §6 | **CHƯA CHẠY** — ngoài scope (lệnh rõ ràng) |
| Xoá `AlertCenterPage.tsx:97-135` | **CHƯA CHẠY** — ngoài scope; **bắt buộc** trước khi merge commit 3 |
| `AlertCenterPage.tsx:108,110` (`for` loop gọi `toggleSeverity`) | **CHƯA CHẠY** — 2 lần gọi cùng tick ⇒ mất cập nhật (`?severity=a,b` ra `[b]`) |
| `npm run build` (`tsc && vite build`) | **CHƯA CHẠY** — `tsc --noEmit` đã chạy exit 0; `vite build` chưa chạy |
| E2E thật trên trang Alert Center | **CHƯA CHẠY** — cần app + backend |

---

## 8. Quyết định kỹ thuật đáng ghi

Ba lỗi tìm được **trong lúc viết**, đều do đọc docstring của `useUrlState`:

1. **`options` phải ở CAP MODULE.** `useUrlState` memo hoá `setValue` theo `replaceKeys` (`useUrlState.ts:187`). `{ replaceKeys: ["actor"] }` literal trong render ⇒ mảng mới mỗi lần ⇒ `setPage` đổi identity mỗi render ⇒ `useEffect([refreshKey, setPage])` chạy lại mỗi render ⇒ **loop**. Phải khai `AUDIT_URL_OPTIONS` / `ALERT_URL_OPTIONS` ở module scope. (`AdminAuditPage.tsx:44` đang truyền literal — chưa lộ vì effect của nó không phụ thuộc `setPage`.)
2. **Codec phải trả `undefined` cho giá trị mặc định ở CẢ hai chiều.** `intCodec.serialize(1)` = `"1"` ⇒ đổi bộ lọc sẽ để lại `?page=1`/`?pageStats=1` thừa. Ba codec mới (`pageCodec`, `pageSizeCodec`, `pageStatsCodec`) theo đúng khuôn của `boolCodec`.
3. **Hai lần `setUrlState` trong cùng tick KHÔNG compose** (`useUrlState.ts:161-165`). Mọi thay đổi ghep "đổi giá trị + về trang 1" đã gộp thành **một patch**. Đây cũng là lý do `setSeverityFilter`/`setFamilyFilter` gộp luôn `pageStats: 1` — để `AlertCenterPage.tsx:494,504-508` (gọi 2 setter liên tiếp) vẫn đúng dù caller chưa sửa.

Thêm: `pageSizeCodec` **từ chối** giá trị ngoài `PAGE_SIZES` ⇒ `?pageSize=9999` (URL do người sửa tay) không biến thành `limit=9999` gửi lên BE.

---

## 9. Bài học quy trình (1)

**"File test hỏng vì thiếu Router" không phải lý do để bỏ cuộc — nhưng cũng không phải lý do để đoán.** Ở đây briefing nói `AIUsageDashboard` có 4 file test render và 3 file vỡ; đo thật bằng `grep` + chạy suite cho ra **3 file render / 2 file vỡ**. Nếu tin briefing thì hoặc báo sai (over-report), hoặc sửa 3 file thay vì 2 (lãng phí claim). Tương tự, briefing ghi "`useAlertCenterFilters`: 0 test files" — đúng *theo nghĩa trực tiếp* (không file nào import hook), nhưng sai *theo nghĩa nhân quả*: `AlertCenterPage.component.test.tsx` render trang dùng hook đó, và 18/18 test vỡ. **Số "file nào chạm trực tiếp" không phải số "test nào vỡ" — phải chạy suite mới biết.**

Bài học nhỏ nhưng tốn thời gian: `Set-Content -Value (git show …)` trong PowerShell **dán file thành một dòng**. Mất 1 vòng để phát hiện. Dùng `Copy-Item` byte-exact + `git diff --numstat` rỗng để chứng minh đã restore đúng — đây cũng là cách chứng minh fail-before chạy trên code thật, không phải bản sửa tạm.

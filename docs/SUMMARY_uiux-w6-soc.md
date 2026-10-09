# SUMMARY — `uiux-w6-soc` (Wave 6 / NAV-1, slice SOC panels)

- **Branch:** `feat/uiux-w6-soc`
- **Worktree:** `C:\Mujoco Projects\uiux-w6-soc`
- **Claim commit:** `18c55aa70` — `docs(claims): khai claim uiux-w6-soc`
- **Code commit:** `b9d75c9bd` — `feat(web): NAV-1 wave 6 slice soc - dong bo phan trang 4 panel voi URL`
- **Docs commit (file này):** xem `git log -1`
- **Kết quả:** giảm **9/41 hit** trong 11 file của slice. **32 hit còn lại BỊ CHẶN** (mục 3), **4 hit là false positive thật** (mục 5).

---

## 1. File đã đổi (chỉ trong 11 file được giao)

| File | Hit trước | Hit sau | Ghi chú |
|---|---|---|---|
| `SocScreenerPanel.tsx` | 2 | **0** | `rulesPage` + `resultsPage` → 1 `useUrlState` record |
| `SocDataOpsOperationsSection.tsx` | 4 | **0** | `runLogsPage`+`runLogsPageSize` và `plannedPage`+`skippedPage`, mỗi cặp 1 record |
| `SocDataOpsPlannerConsole.tsx` | 2 | **0** | `plannedPage` + `skippedPage` → 1 record |
| `SocDnseBackfillPanel.tsx` | 1 | **0** | `jobsPage` → `useUrlValue` |
| **Tổng** | **9** | **0** | |

File mới (test): `packages/web/src/components/__tests__/soc-nav1-url-state.component.test.tsx`

**Không** đụng `packages/web/src/hooks/useUrlState.ts`, `uiux-baseline.json`, `docs/audit-uiux/scripts/*`,
`docs/CODE_CHANGE_AUDIT_LEDGER.md`, `AGENTS.md`, `packages/web/package.json`. Xác nhận bằng `git diff --name-only HEAD`:
đúng 4 file `.tsx` trong danh sách + 1 file test mới.

### Chi tiết thay đổi ngữ nghĩa

- **Quy tắc A (default y hệt cũ):** `fallback` đặt đúng giá trị `useState` cũ —
  `1` cho `dnse_jobs_page` / `runLogsPage` / `rulesPage` / `resultsPage`, `10` cho `runLogsPageSize`, `0` cho `plannedPage` / `skippedPage`.
  URL không có tham số ⇒ hành vi **y hệt trước**, và **không** ghi tham số thừa ra URL (test AC-A khoá điều này).
- **Quy tắc B (`replace`):** **không** dùng `replace` ở bất kỳ chỗ nào. 9 hit này đều là **phân trang**, không phải ô nhập văn bản ⇒ theo quy tắc B phải `push` để giữ nút Back. `replaceKeys` không dùng.
- **Quy tắc C (giữ reset page):**
  - `SocDataOpsOperationsSection` `handlePageSizeChange` — trước gọi 2 `setState`; nay gom **1 patch** `{ runLogsPageSize, runLogsPage: 1 }` ⇒ 1 `setParams` thay vì 2 (đây là cải thiện, không phải hồi quy). Reset về trang 1 **giữ nguyên**.
  - `handlePreview` reset `plannedPage`/`skippedPage` về `0` — gom 1 patch, hành vi **giữ nguyên**.
  - `SocDnseBackfillPanel` `handleSubmit` reset `jobsPage` về `1` — **giữ nguyên**.
- **Bẫy đã xử lý — setter không phải updater.** `useState` nhận lambda `(p) => p + 1`; `useUrlValue` nhận **giá trị**,
  `useUrlState` nhận **patch object**. Mọi call site đã đổi tương ứng:
  `setJobsPage((p) => p + 1)` → `setJobsPage(jobsPage + 1)`;
  `setRulesPage((p) => p + 1)` → `setScreenerPaging({ rulesPage: rulesPage + 1 })`.
  ⚠ Nếu quên, `setRulesPage(2)` sẽ làm `Object.keys(2)` = `[]` ⇒ **ghi URL rỗng, im lặng** — không nên có chuyện đó.
- **Tên tham số có tiền tố** (`dnse_jobs_page`, `runLogsPage`, `rulesPage`, `plannedPage`, `skippedPage`) vì các panel
  này nằm trên cùng route `/soc/*`; tên trần (`page`) sẽ đụng nhau giữa các panel.
- **Khai `spec`/`defaults` ở NGOÀI component** (`SocScreenerPanel.tsx:99-111`, `SocDataOpsOperationsSection.tsx:18-42`,
  `SocDataOpsPlannerConsole.tsx:8-20`) vì `useUrlState` memo hoá trên `spec`/`defaults` (`useUrlState.ts:150-157`);
  literal trong render sẽ phá memo. Dùng `type` chứ không `interface` (interface không có implicit index signature).

---

## 2. Gate — output thật

| Gate | Lệnh | Exit | Kết quả |
|---|---|---|---|
| Type-check | `npx tsc --noEmit` (từ `packages/web`) | **0** | không output |
| Lint | `npm run lint` | **0** | `✖ 3755 problems (0 errors, 3755 warnings)` — baseline 3754, **+1** |
| Test | `npm run test:components` | **0** | `Test Files 120 passed (120)` / `Tests 847 passed (847)` |
| NAV-1 | `node docs/audit-uiux/scripts/nav1-report.mjs packages/web/src --json` | **0** | `counted` **89 → 80** |

**Baseline cùng máy, cùng worktree, trước khi sửa dòng code đầu tiên:**
`Test Files 119 passed (119)` / `Tests 844 passed (844)`, exit 0, 97.11s.
Sau: 120 file / 847 test ⇒ **+1 file, +3 test** (đúng 3 test mới), **không** test nào cũ đổi trạng thái.
Flake `useAlertCenterSnapshot.pagination.component.test.ts` **không** xảy ra ở cả 2 lần chạy.

**+1 warning lint** là `react/jsx-no-literals` bắt nhầm thuộc tính `data-testid="search"` trong file test mới:
`37:15  warning  Invalid prop value: "data-testid="search""  react/jsx-no-literals`. Là false positive của rule
(giá trị attribute, không phải text hiển thị), **0 error**.

### Bằng chứng FAIL trước / PASS sau (hazard 10)

File gốc lấy bằng `git show HEAD:<file>` (không dùng `git checkout --` — hazard 11).

```
# BẢN GỐC (HEAD) — phải FAIL
$ npx vitest run src/components/__tests__/soc-nav1-url-state.component.test.tsx
EXIT=1
❯ src/components/__tests__/soc-nav1-url-state.component.test.tsx (3 tests | 2 failed) 2264ms
× AC-C — deep-link ?dnse_jobs_page=3: mount ra da o trang 3 1022ms
  TestingLibraryElementError: Unable to find an element with the text: SYM-20. …
× AC-B — bam Next: useSearchParams doi va hien dung trang 2 1067ms
  - Expected  + Received
  - dnse_jobs_page=2
Test Files  1 failed (1)
Tests       2 failed | 1 passed (3)

# BẢN ĐÃ SỬA — phải PASS
$ npx vitest run src/components/__tests__/soc-nav1-url-state.component.test.tsx
EXIT=0
 Test Files  1 passed (1)
      Tests  3 passed (3)
```

`AC-A` **cố ý pass ở cả 2 bản**: nó kiểm URL rỗng ⇒ trang 1, mà `useState(1)` cũ cũng ra trang 1. Đó là test
**chống hồi quy** cho quy tắc A, không phải bằng chứng hành vi mới — hai hành vi mới là AC-B (ghi URL) và AC-C (deep-link).

### Nội dung test mới

`SocDnseBackfillPanel` thật (mock `getDnseBackfillJobs` trả 25 job ⇒ 3 trang vì `jobsPageSize = 10`), bọc `MemoryRouter`,
kèm `SearchProbe` dùng `useSearchParams` để đọc `location.search` — **bằng chứng trực tiếp** URL đã đổi chứ không phải
đoán qua UI. Ba AC: URL rỗng ⇒ trang 1 + URL không bị ghi bẩn · deep-link `?dnse_jobs_page=3` ⇒ mount ra trang 3 ·
bấm Next ⇒ `search` = `dnse_jobs_page=2` **và** render đúng tầng `SYM-10..19`.

---

## 3. BÁO LẠI — blocker chặn 32 hit còn lại (KHÔNG tự sửa)

**Đây là phát hiện quan trọng nhất của slice, và là lý do 7/11 file không thể sửa.**

`useUrlState` → `useSearchParams` (react-router-dom **6.30.3**) gọi `useLocation()` tại
`packages/web/node_modules/react-router-dom/dist/react-router-dom.development.js:1072`.
`useLocation()` có invariant tại `packages/web/node_modules/react-router/dist/react-router.development.js:160`:
**`useLocation() may be used only in the context of a <Router> component.`** ⇒ **throw**, không phải trả undefined.

Trong khi đó `packages/web/vitest.config.ts` có `setupFiles: []` (không Router toàn cục), và **11 file test hiện có**
render 7 component của slice **không bọc `MemoryRouter`**:

| Component bị chặn | Hit | File test render nó (đều **không** có Router) |
|---|---|---|
| `SocSignalsPanel.tsx` | 11 | `soc-signals-tab.component.test.tsx`, `soc-signals-stream.component.test.tsx` |
| `SocOverviewPanel.tsx` | 7 | `soc-overview-tab.component.test.tsx`, `soc-p2.component.test.tsx`, `soc-overview-stream.component.test.tsx` |
| `SocUsersPanel.tsx` | 5 | `soc-users.component.test.tsx` |
| `SocDataOpsConfigSection.tsx` | 3 | `SocDataOpsConfigSection.component.test.tsx` |
| `SocDataOpsMonitorSection.tsx` | 3 | `soc-monitor.component.test.tsx`, `soc-queue-depth.component.test.tsx` |
| `SocSchedulerBoard.tsx` | 2 | `soc-scheduler-degraded.component.test.tsx` |
| `DataOpsContext.tsx` | 1 | `dataops-context.config.component.test.tsx` |

### Chứng minh bằng thực nghiệm (không suy luận)

Đổi `SocUsersPanel.tsx:55` `useState(1)` → `useUrlValue("users_page", intCodec, 1)` (rồi khôi phục bằng
`Copy-Item` từ `%TEMP%`, **không** dùng `git checkout --`):

```
$ npx vitest run src/components/__tests__/soc-users.component.test.tsx
EXIT=1
Error: useLocation() may be used only in the context of a <Router> component.
 ❯ SocUsersPanel src/components/soc/SocUsersPanel.tsx:56:27
 ❯ src/components/__tests__/soc-users.component.test.tsx (4 tests | 4 failed) 59ms
Test Files  1 failed (1)
Tests       4 failed (4)
```

4/4 test đỏ. Nhân với 11 file test ⇒ **thêm hook vào 7 component này sẽ làm đỏ 11 file test hiện có**.

### Vì sao không tự lách

Cả 2 lối thoát đều nằm **ngoài 11 file được giao**:

1. **Bọc `MemoryRouter` cho 11 file test** — file test không thuộc danh sách. Ngoài ra `MemoryRouter` + `navigate`
   sẽ phát `Not implemented: navigation to another Document` trong jsdom (đã thấy 4 dòng cảnh báo này ở baseline
   từ test khác), nên cần kiểm lại từng assertion.
2. **Thêm biến thể "router-optional" vào `hooks/useUrlState.ts`** — file shared, lệnh 2 cấm sửa.

Có thể lách bằng `useInRouterContext()` + hook phân nhánh, nhưng:
hook count đổi giữa "có Router" / "không Router" ⇒ vi phạm quy tắc hooks của React và bắt `react-hooks/rules-of-hooks`;
đồng thời nhân bản logic của hook shared vào file component — sai hướng và tạo nợ kỹ thuật khi 11 file test kia sớm
được sửa. **Không làm.**

### Đề xuất cho coordinator (chọn 1)

- **(a) Mở rộng file-set** cho 11 file test ở bảng trên, bọc `MemoryRouter` (đúng chuẩn repo —
  `packages/web/src/pages/portfolio/__tests__/portfolio-pages.component.test.tsx:25` đã làm vậy cho `useUrlState`).
  ⇒ mở được **28 hit** thật.
- **(b) Thêm `useUrlValueNoRouter`/tuỳ chọn fallback vào `hooks/useUrlState.ts`** (1 lần, cho cả repo).
- **(c) Bỏ 7 file khỏi scope NAV-1** và ghi vào baseline là nợ riêng.

**Lưu ý thêm cho (a):** `SocSchedulerBoard.tsx:323` là state của component `JobHistoryDrawer` — drawer mount/unmount
khi mở/đóng. Đồng bộ URL sẽ làm **trang đã lật tồn dư trên URL sau khi đóng drawer**, và mở lại drawer sẽ nhảy thẳng
về trang cũ (trước đây luôn về trang 1). Cần chốt có chấp nhận hay không.

---

## 4. Ngoại lệ đã áp dụng

| Ngoại lệ | Ở đâu | Lý do |
|---|---|---|
| Không đưa biến nào vào URL ngoài 9 hit đã sửa | 4 file | 32 hit còn lại bị chặn (mục 3), báo lại chứ không sửa bừa |
| Không xoá biến không dùng | `SocDataOpsPlannerConsole.tsx` | File tự khai `@deprecated - Orphan (F17). Not imported anywhere (grep 0 hit)` ở dòng 1-2. Đã sửa đồng bộ URL cho nhất quán nhưng **không** xoá — quy tắc "dead code ⇒ báo lại". Báo: nên xoá ở P2 cleanup như đã ghi. |

Không có ngoại lệ nào cho `*Draft` — 9 hit đã sửa đều là state **đã áp dụng**, không phải ô input đang soạn.

---

## 5. False positive của rule NAV-1 (báo lại, **không** sửa)

Có **4 hit** trong `SocSignalsPanel.tsx` mà rule bắt **sai hoàn toàn** — tên biến chứa chữ `tab` nhưng **không phải
trạng thái điều hướng**:

| Hit | Bằng chứng |
|---|---|
| `configTab@359` | `useState<SignalTabData<{config, ownership}>>(emptyTab())` |
| `detectionTab@360` | `useState<SignalTabData<{whale, dark, screener}>>(emptyTab())` |
| `retentionTab@361` | `useState<SignalTabData<Record<string, unknown>>>(emptyTab())` |
| `rulesTab@389` | `useState<SignalTabData<{rules: SignalRule[]}>>(emptyTab())` |

`SignalTabData<T>` (`SocSignalsPanel.tsx:279`) = `{ loading, loaded, error, data }` — **cache dữ liệu lazy** theo tab
(comment `:357` "lazy data cho 3 subtabs mới"), **không** phải tab đang chọn (tab đang chọn là `subTab@346`).
Đưa chúng vào URL là vô nghĩa (là object `{loading, data}`, không phải khoá điều hướng). Nên thêm escape cho 4 tên này ở
`nav1-rule.mjs` — **không tự sửa** vì `docs/audit-uiux/scripts/*` nằm ngoài phạm vi.

Thêm 1 hit **bán hợp lệ**: `SocOverviewPanel.tsx:145` `debouncedSearch` — nó là **bản sao debounce** của `search`,
derive hoàn toàn qua `useEffect` (`:259-262`). Đồng bộ nó vào URL sẽ tạo **hai nguồn sự thật cho một khái niệm**
(ghi URL bị trễ 300 ms so với `search`) ⇒ nên giữ `useState` và chỉ đồng bộ `search@144`.

---

## 6. CHƯA CHẠY + lý do

| Gate | Trạng thái | Lý do |
|---|---|---|
| `npm run build` (`tsc && vite build`) | **CHƯA CHẠY** | Đã chạy `tsc --noEmit` (exit 0) — phần check type thực sự gây lỗi. Phần `vite build` không chạy vì ngoài yêu cầu verify của slice. |
| `scan-ui-guidelines.mjs` | **CHƯA CHẠY** | Không nằm trong danh sách gate của slice. Đã chạy `nav1-report.mjs` (cùng dùng `nav1-rule.mjs`) nên mục tiêu NAV-1 đã được đo. |
| `check-uiux-budget` / `check-multi-agent` / `check-ledger-entry` | **CHƯA CHẠY** độc lập | `check-multi-agent` **có** chạy tự động qua pre-commit hook 2 lần, cả 2 lần đều `0 lỗi — PASS`. 2 gate còn lại không nằm trong scope. |
| Test trình duyệt thật (deep-link bằng tay) | **CHƯA CHẠY** | Test mới chỉ phủ jsdom + `MemoryRouter`. Hành vi `push`/`Back` thật phụ thuộc `BrowserRouter` + lịch sử trình duyệt — jsdom không kiểm được. |
| BE test | **KHÔNG LIÊN QUAN** | Slice chỉ đụng frontend. |

---

## 7. Rủi ro còn lại

1. **32 hit chưa giảm** — nguyên nhân ngoài phạm vi, đã định danh chính xác ở mục 3.
2. **11 file test phải bọc `MemoryRouter`** trước khi 7 component kia dùng được hook URL. Nếu coordinator chọn phương án
   khác, công việc test này không bị phí.
3. **`SocSchedulerBoard` drawer** giữ trang trên URL sau khi đóng (mục 3, cuối).
4. **Ghi tham số thừa khi action = reset về 0.** `plannedPage`/`skippedPage` mặc định `0`; bấm "Preview" gọi
   `setPreviewPaging({plannedPage: 0, skippedPage: 0})` sẽ ghi `?plannedPage=0&skippedPage=0` **ngay cả khi URL
   đang sạch** (`intCodec.serialize(0)` trả `"0"`, không phải `undefined`). Không sai hành vi, nhưng URL bị nhiễu.
   Không tự chặn vì quy tắc B nói rõ phân trang phải `push`, và thêm chặn ở call site là logic ngoài phạm vi slice.
5. **`useUrlState` ghi TẤT CẢ key trong `spec`** mỗi lần ghi (`useUrlState.ts:243-262`) — không phải chỉ key vừa chạm.
   Với 2 record tách biệt (`runLogsPage…` vs `plannedPage…`) thì không lẫn, nhưng nếu ai đó sau này gộp 2 cặp vào
   1 record thì **một lần đổi pageSize của Run Logs sẽ xoá luôn `plannedPage`** trên URL. Đã ghi chú trong code.
6. **+1 warning lint** từ file test mới (false positive `react/jsx-no-literals`), không chặn gate.

---

## 8. Bài học quy trình

**File-set chia theo "component" thì không đủ — phải chia theo "component nào đã được test trong Router hay chưa".**

Wave 1-5 chỉ đụng **page** (`AdminAuditPage`, `PortfolioHoldingsPage`, …) — mọi page đều nằm dưới `BrowserRouter` nên
đổi hook là an toàn. Wave 6 chạm **panel nhúng** trong `components/soc/`, và 11 file test của SOC render chúng
**trần, không Router**. Cùng một thay đổi cơ học (`useState` → `useUrlValue`) là **PASS trên page** nhưng **đỏ cả
file test** trên panel.

Bài học vận hành cho wave 7: **trước khi nhận slice, chạy `grep -l "MemoryRouter" ` trên mọi test file chạm tới
component trong danh sách.** Chi phí 30 giây, tiết kiệm một vòng sửa–test–đỏ–khôi phục. Đáng chú ý là hai component
đã dùng `useUrlState` từ wave trước (`CoreDashboardPositionDeck.tsx`, `FactsFirstModularPositionDeck.jsx`) đều
**không có file test nào** — tức là wave trước chưa từng đụng vào bài toán này.

Bài học thứ hai (nhỏ hơn, về công cụ): **đừng kết luận blocker từ việc đọc code của thư viện.** `react-router` đúng
là throw — nhưng phải **chạy thử 1 lần** mới dám viết vào báo cáo rằng nó làm đỏ 4/4 test. Bằng chứng thực nghiệm
đó chính là thứ biến "tôi nghĩ là vậy" thành "đã kiểm chứng", và là thứ khiến coordinator chấp nhận mở rộng file-set.

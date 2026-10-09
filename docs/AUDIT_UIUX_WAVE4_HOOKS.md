# AUDIT — Stage 5 độc lập — UIUX WAVE 4 / S4 (hooks URL + 4 trang admin P1)

- **Branch**: `feat/uiux-wave4` · **Base**: `dev` · **HEAD**: `06ed45030`
- **Auditor**: Stage 5, READ-ONLY (chỉ ghi file báo cáo này)
- **Phạm vi**: `useUrlState.ts`, `useUrlRecord.component.test.tsx`, 4 trang `AdminCore*Page.tsx`, `AdminAuditPage.tsx`, `AdminBillingFleetPage.tsx`, `PortfolioHoldingsPage.tsx`, `portfolio-deep-link-fu05.component.test.tsx`
- **Ngoài phạm vi** (auditor khác): `scan-ui-guidelines.mjs`, `nav1-rule.mjs`, `check-h1-graph.mjs`, CSS

---

## VERDICT

# `NEED_REVISION`

**`confidence: high`** (8/10) — mọi khẳng định dưới đây đều chạy lại được; 4 mutation test + 4 probe độc lập đều cho kết quả tái lập.

| blocker | major | minor |
|---|---|---|
| **0** | **4** | **4** |

Lý do không phải `PASS`: diff **giữa được** gates và **các test mới thật sự có tác dụng** (hazard 10 đã kiểm bằng mutation, không phải bằng lời hứa). Nhưng nó **vừa tạo ra 2 lỗi người dùng thật mà không có test nào bắt**, và **1 điểm mà comment trong chính file test nói là đã tài liệu hoá thì tài liệu đó không tồn tại**.

---

## GATE — đã tự chạy, ghi exit code

| Gate | Lệnh | Kết quả |
|---|---|---|
| Type-check | `npx tsc --noEmit` (packages/web) | **exit 0** |
| Lint | `npm run lint` | **exit 0** — `3754 problems (0 errors, 3754 warnings)` |
| Test | `npx vitest run src/hooks/__tests__ src/pages/portfolio/__tests__/portfolio-deep-link-fu05.component.test.tsx` | **exit 0** — `3 files / 39 tests PASS` (33.75 s) |
| Test bổ sung | `npx vitest run AdminCoreServiceAccountsPage` | **exit 0** — `1 file / 2 tests PASS` |
| `npm run test:components` | — | **CHƯA CHẠY** (bỏ qua có chủ ý, ~3+ phút) |

Lưu ý: `git status --short` trong cây chính **có** `docs/audit-uiux/scripts/nav1-rule.mjs` đang sửa (dịch `synced.has(name)` → `synced.size > 0`) — **không phải sửa của tôi**, thuộc phạm vi auditor kia. Các file trong phạm vi tôi sạch sau mọi thí nghiệm.

---

## HAZARD 10 — kiểm chứng thật (KHÔNG tin comment)

Không dùng `git checkout --` (sẽ phá công việc chưa commit của agent khác). Phương pháp: **copy file về `$env:TEMP\w4audit\backup` → ghi bản `dev` bằng `git show dev:<path> > <path>` → chạy test → copy lại bản gốc**. Xác nhận bằng `git status --short` sạch.

### H1. Comment `useUrlState.ts:161-169` ("2 `setParams` trong 1 tick KHÔNG compose") — **ĐÚNG**

Không tin comment, tự dựng probe (`$env:TEMP/w4audit/compose.test.tsx`, jsdom, `node_modules` junction):

```
TWO-IN-ONE-TICK URL = /p?keep=1&alpha=A
TWO-IN-ONE-TICK has alpha? true
TWO-IN-ONE-TICK has beta?  false      ← lần ghi 2 ĐỄT mất lần ghi 1
```

Cơ chế xác nhận từ source `react-router-dom@6.30.3` (`dist/react-router-dom.development.js`, `useSearchParams`):

```js
let setSearchParams = React.useCallback((nextInit, navigateOptions) => {
  let newSearchParams = createSearchParams(typeof nextInit === "function" ? nextInit(searchParams) : nextInit);
  ...
```

`setSearchParams` đóng trên `searchParams` của **render hiện tại** (`useMemo` theo `location.search`), **không** có ref động. Hai lần gọi trong cùng tick ⇒ lần hai đọc `searchParams` cũ ⇒ đè mất lần một. ⇒ **Thiết kế 1 `setParams` duy nhất là bắt buộc, không phải lựa chọn.** Comment đúng.

### H2. AC-3 rev 2 + AC-3b (bỏ `replaceKeys` ở `PortfolioHoldingsPage`) — **CẢ HAI ĐỎ**

```
git show dev:packages/web/src/pages/portfolio/PortfolioHoldingsPage.tsx > <path>
npx vitest run src/pages/portfolio/__tests__/portfolio-deep-link-fu05.component.test.tsx
→ Tests  2 failed | 5 passed (7)     EXIT=1
→ AC-3 (rev 2): Expected "REPLACE" Received "PUSH"
→ AC-3b (rev 2): Expected: "search=" Received: "/p?search=HP"
```

Bản AC-3/AC-3b cũ **vẫn xanh** với code cũ (5 passed gồm nó) ⇒ team nói "bản cũ pass vì lý do sai" là **có bằng chứng**.

### H3. Mutation A — `merged = {...value, ...next}` thay `{...defaults, ...next}` — **BẮT ĐƯỢC**

```
Tests  1 failed | 23 passed (24)
FAIL > "Apply mot lan sau XOA duoc tham so cu da dat truoc do"
```
⇒ test chứng minh quyết định thiết kế "hợp với `defaults`" **không phải** rác. Đúng ý comment `useUrlState.ts:228-233`.

### H4. Mutation D — cài lại thiết kế "chia 2 nhóm, 2 `setParams`" mà comment gọi là lỗi — **BẮT ĐƯỢC, và tái hiện đúng lỗi**

```
FAIL > "patch nhieu key: chi replace khi patch CHI cham key duoc liet ke"
expected '/admin/x?search=fpt&status=active' to contain 'search=hdb'
Received: "/admin/x?search=fpt&status=active"
```
⇒ `search=hdb` **bị mất** — y hệt probe H1. Comment mô tả đúng nguyên nhân gốc, và test giữ được đúng cái nguyên nhân đó.

### H5. Mutation C — `useUrlRecord` bỏ qua `replaceKeys` (`allReplace = false`) — **BẮT ĐƯỢC**
`FAIL > "replace: true ap dung cho MOI key"` (lưu ý: bắt bởi test `replace:true`, **không** bởi test nào về `replaceKeys` + `useUrlRecord` — xem F-3).

### H6. Mutation E — `useUrlState` bỏ qua `replaceKeys` — **BẮT ĐƯỢC**
```
Tests  4 failed | 20 passed (24)
FAIL > useUrlRecord > "replaceKeys chi ap dung cho key duoc liet ke"
FAIL > useUrlRecord > "patch nhieu key: ..."
FAIL > portfolio-deep-link > "AC-3 (rev 2): go N ky tu ..."
FAIL > portfolio-deep-link > "AC-3b (rev 2): ..."
```

**Kết luận hazard 10**: 6/6 kiểm chứng đều có tác dụng. Đây là phần **đáng ghi nhận mạnh** của diff — test ở đây thật sự bảo vệ fix.

---

## FINDINGS

### ID-1 · `major` · `useUrlState.ts:161-173` + `AdminBillingFleetPage.tsx:131,137` (+ `AdminAuditPage.tsx:124`)
**Vấn đề**: comment `:161-169` đã **tìm ra đúng** cơ chế "2 `setParams` trong 1 tick không compose" nhưng **không sửa call site nào đang dính bug đó** — và có 1 call site đang dính ngay trong phạm vi diff này.

`AdminBillingFleetPage.tsx:131`:
```tsx
onChange={(e) => { setStatus(e.target.value); setPage(1); }}
```
Hai lần `setUrlState` trong cùng một tick ⇒ lần `setPage(1)` đọc `searchParams` cũ rồi ghi đè ⇒ **giá trị `status` vừa chọn bị xoá khỏi URL**.

Đo thật, dựng lại đúng pattern với hook HEAD (`$env:TEMP/w4audit/probe2.test.tsx`):
```
(b) rendered status = ""      ← select quay về "all"
(b) URL = "?page=1"
(b) => status=paid TON TAI TRONG URL: false
```
Chạy lại với **bản `dev` của hook** (`$env:TEMP/w4audit/probe3.test.tsx`, `git show dev:...useUrlState.ts`):
```
DEV rendered status = ""   DEV URL = "?page=1"   DEV => status=paid MAT trong URL: false
```
⇒ **Bug có sẵn trên `dev`, không phải hồi quy do diff này.**

**Ảnh hưởng**: người dùng chọn trạng thái hóa đơn ở `AdminBillingFleetPage` thì bộ lọc **không hề có hiệu lực** — select hiển thị "tất cả", bảng vẫn lọc sai, URL chỉ còn `?page=1`. Đây đúng là loại bug "test xanh nhưng tính năng hỏng".

**Đề xuất sửa**: gộp 1 patch trong `useUrlState` (giờ đã an toàn vì 1 `setParams` cho cả patch):
```tsx
onChange={(e) => setUrlState({ status: e.target.value, page: 1 })}
```
áp cho cả `:131` và `:137`. Ngoài ra `useUrlState` nên **export một helper `setMany`** hoặc tối thiểu thêm 1 test khẳng định "patch nhiều key trong 1 tick giữ được tất cả" để chặn tái phát.

---

### ID-2 · `major` · `AdminCorePATsPage.tsx:80-93,160-163` (+ 3 trang admin còn lại)
**Vấn đề**: `filtersDraft` (`useState` local) **không bao giờ được gieo từ `filters`**. Sau khi đổi `filters` sang `useUrlRecord`, **form và bộ lọc đã áp dụng lệch nhau ngay từ lúc tải trang**.

Đo thật với bản sao nguyên cấu trúc `AdminCorePATsPage` (`$env:TEMP/w4audit/callsite.test.tsx`):
```
P1 applied = {"search":"abc",...}     ← bảng ĐANG lọc theo abc
P1 draft   = {"search":"",...}        ← ô input VẪN trống
P2 applied BEFORE Apply = {"search":"abc",...}
P2 url AFTER Apply = ""                       ← mất sạch
P2 => search=abc BI XOA khi bam Apply: true
```
Cùng cấu trúc lặp lại ở:
- `AdminCoreAuditTracePage.tsx:90` (`useState(DEFAULT_FILTERS)`) + `:209` (`setFilters({ ...filtersDraft })`)
- `AdminCoreJobsPage.tsx:70` + `:143`
- `AdminCoreServiceAccountsPage.tsx:47` + `:124`

**Ảnh hương**: người dùng mở link được chia sẻ `?search=abc` ⇒ **bảng lọc đúng nhưng 4 ô form đều trống**. Bấm "Áp dụng" (chỉ để refresh, không sửa gì) ⇒ **toàn bộ filter trong link bị xoá im lặng**. Đây là hệ quả trực tiếp của việc `useState` → `useUrlRecord`, tức lỗi **mới**, không có trên `dev`.

**Đề xuất sửa**: gieo draft 1 lần từ `filters`, dùng ref cờ để không tạo loop:
```tsx
const seeded = useRef(false);
useEffect(() => {
  if (seeded.current) return;
  seeded.current = true;
  setFiltersDraft(filters);
}, [filters]);
```
(tương tự cho 3 trang còn lại). Bắt buộc kèm test: "mở `?search=abc` → ô input phải hiện `abc`".

---

### ID-3 · `major` · `useUrlState.ts:245-247` vs `useUrlState.ts:170-173`
**Vấn đề**: `useUrlRecord` tính `allReplace` bằng **`keys` = `Object.keys(spec)` — TOÀN BỘ key của bản ghi**, trong khi `useUrlState` dùng `keys` = key **thực sự được patch**. Với `replaceKeys: ['search']` và spec 5–7 field, điều kiện `keys.every(k => replaceKeys.includes(k))` **không bao giờ đúng** ⇒ `replaceKeys` trên `useUrlRecord` là **tính năng chết**.

Bằng chứng thiếu test: mutation C (`allReplace = false`) bị bắt bởi test `replace: true` — **không có test nào** khẳng định `useUrlRecord` + `replaceKeys`. Test duy nhất nhắc `replaceKeys` (`useUrlRecord.component.test.tsx:188-196`) dùng `ProbeState` (tức `useUrlState`), không phải `ProbeRecord`.

**Ảnh hưởng**: âm thầm. Ngày mai có ai đó thêm `replaceKeys: ['search']` vào `AdminCorePATsPage` thì **không có tác dụng gì** mà test vẫn xanh — đúng mẫu "test xanh nhưng fix không có" mà `AGENTS.md` cảnh báo.

**Đề xuất sửa**: thống nhất ngữ nghĩa với `useUrlState` — dùng `touched`:
```ts
const allReplace = touched.length > 0 && touched.every(
  (k) => replaceAll || Boolean(replaceKeys?.includes(k)),
);
```
(và vì `useUrlRecord` ghi **tất cả** key nên `push` vẫn phải ghi hết — chấp nhận được, chỉ cần nói rõ trong comment). Bắt buộc thêm test `useUrlRecord` + `replaceKeys` ⇒ `REPLACE`.

---

### ID-4 · `major` · `portfolio-deep-link-fu05.component.test.tsx:102-104`
**Vấn đề**: comment trong test tự nhận đây là **đổi hành vi người dùng thật** và hứa *"Ghi trong `docs/REPORT_FINAL_UIUX_WAVE4.md`"*. **File đó không tồn tại**:

```
Test-Path docs/REPORT_FINAL_UIUX_WAVE4.md          → False
Test-Path docs/AUDIT_UIUX_WAVE4.md                → False
Test-Path docs/TEST_REPORT_UIUX_WAVE4.md           → False
Test-Path docs/audit-uiux/HANDOFF_UIUX_WAVE4_20261009.md → False
```
(`docs/CLAIMS.md:1077` có liệt kê cả 4 là "Mới" — tức đang để dở, **KHÔNG** phải đã ghi.)

**Ảnh hưởng**: đổi hành vi có thật (mất undo-bộ-lọc-bằng-nút-Back) hiện **chỉ được ghi trong comment của file test** — nơi người đọc sản phẩm không tới. Đúng loại việc `PLAN_UIUX_WAVE4.md` §5 STOP #4 ("AC pass mà diff không có thay đổi liên quan") và văn hoá ledger của repo đang cấm.

**Đề xuất sửa**: hoặc tạo `docs/REPORT_FINAL_UIUX_WAVE4.md` có mục "Đổi hành vi (Major 2)" liệt kê 3 trang bị ảnh hưởng (`PortfolioHoldingsPage`, `AdminAuditPage`, `AdminBillingFleetPage`), hoặc bỏ câu "Ghi trong ..." và ghi ngay trong `docs/CLAIMS.md` dòng `uiux-wave4`.

---

### ID-5 · `minor` · `AdminCorePATsPage.tsx:19` (vs `:28-34`, `:56-61`)
**Vấn đề**: comment đầu file nói
> `expiresWithinDays` là SỐ ⇒ dùng `intCodec`, không phải `stringCodec`.

nhưng code **không** dùng `intCodec` — nó giữ kiểu `string` và dùng codec regex tự viết (`:56-61`). Comment `:28-34` ngay bên dưới lại giải thích đúng ngược lại. Hai comment trong cùng file, cách nhau 10 dòng, nói ngược nhau.

**Ảnh hưởng**: người đọc/sửa sau sẽ tin dòng 19 và "sửa" sang `intCodec`, làm vỡ adapter (`filters.expiresWithinDays || undefined` ở `:112`).

**Đề xuất sửa**: sửa dòng 19 thành khớp thực tế.

---

### ID-6 · `minor` · `AdminCorePATsPage.tsx:56-61` + `:23-43`
**Vấn đề**: `expiresWithinDays` vốn là `<input type="number" min={0} step={1}>` (`:325-333`). Codec chỉ nhận `/^\d+$/`, còn `min`/`step` của HTML **không chặn gõ**: người dùng gõ `1.5` hoặc `-3` thì `.value` là `"1.5"` / `"-3"` ⇒ `serialize` trả `undefined` ⇒ **xoá khoả khỏi URL, bộ lọc âm thầm không áp dụng**, trong khi ô input vẫn hiện `1.5`.

Đo thật (`$env:TEMP/w4audit/probe4.test.tsx`): `?expiresWithinDays=abc` ⇒ applied `expiresWithinDays: ""` (bị loại, đúng như comment); `?expiresWithinDays=7` ⇒ `"7"` (đúng).

**Trả lời câu hỏi "có phải regression không?"**: **KHÔNG**. Trên `dev`, `filters` là `useState` thuần ⇒ URL **hoàn toàn không được đọc** ⇒ `?expiresWithinDays=abc` vốn đã vô tác dụng. Sau thay đổi vẫn vô tác dụng. Không có URL nào "trước đây được chấp nhận" bị đổi hành vi.

**Đề xuất sửa**: hoặc siết thành `/^\d*$/` + `parse` trả `''` cho `1.5`, hoặc thêm `setCustomValidity`/validate, hoặc đơn giản nhất: bỏ `step={1}` và chấp nhận số thực. Hiện tại hành vi "gõ sai ⇒ lọc biến mất im lặng" chưa có test nào.

---

### ID-7 · `minor` · `AdminCorePATsPage.tsx:23-43`
**Vấn đề**: `PatsFilters` và `PatsFiltersDraft` có **cùng 5 field, cùng kiểu** — trùng lặp nguyên văn. Comment gọi đây là "Bản GỐC soạn của form" nhưng không có khác biệt nào để biện minh.

Kiểm chứng bằng `npx tsc --noEmit --strict --types node --skipLibCheck probe5.test.ts` ⇒ **exit 0** khi gán `PatsFiltersDraft → PatsFilters` và ngược lại ⇒ 2 type tương đương cấu trúc.

**Ģnh hưởng**: thêm 1 type phải sửa 2 chỗ; dễ tạo tình huống "sửa 1 bên quên bên kia".

**Đề xuất sửa**: bỏ `PatsFiltersDraft`, dùng `PatsFilters` cho cả hai (đã kiểm bằng tsc là hợp lệ), hoặc nếu muốn giữ thì phải có 1 field khác nhau thật.

---

### ID-8 · `minor` · `useUrlState.ts:43-53,245-247`
**Vấn đề**: JSDoc của `UrlStateOptions.replaceKeys` (`:49-51`) và của `useUrlState` (`:137-139`) viết **"tách patch thành 2 nhóm, mỗi nhóm 1 lần `setParams`"** — mô tả **chính xác thiết kế đã bị bỏ** vì nó hỏng (H1/H4). Comment cũ còn sót lại, đối lập trực tiếp với comment `:161-169` ngay bên dưới.

**Ảnh hưởng**: đọc `:137-139` sẽ tin rằng tách 2 nhóm là hợp lệ và "sửa" lại — tái phát đúng bug H4.

**Đề xuất sửa**: viết lại 2 đoạn JSDoc đó thành "1 lần `setParams` duy nhất; không thể tách" và trỏ tới dòng 161.

---

## ĐIỂM ĐÃ KIỂM TRA VÀ XÁC NHẬN ĐÚNG (không phải finding)

Ghi lại để không phải kiểm lại lần sau:

1. **Comment `interface` vs `type`** (`AdminCorePATsPage.tsx:21-22`, và 3 trang nữa) — **đúng**. Kiểm chứng: `npx tsc --noEmit --strict --types node --skipLibCheck tscheck.ts` với `hookIface<IfaceFilters>` ⇒ `error TS2344: Type 'IfaceFilters' does not satisfy the constraint 'Record<string, unknown>'. Index signature for type 'string' is missing`, còn `hookType<TypeFilters>` **không lỗi**.
2. **Không có `useUrlRecord<any>`** — đúng; 4 trang dùng `<AuditTraceFilters>` / `<JobFilters>` / `<PatsFilters>` / `<ServiceAccountFilters>` cụ thể.
3. **`spec`/`defaults` khai ngoài component** — đúng, cả 4 trang (`AdminCoreAuditTracePage.tsx:32,91`; `AdminCoreJobsPage.tsx:28,71`; `AdminCorePATsPage.tsx:51,90`; `AdminCoreServiceAccountsPage.tsx:25,57`). AC-4.5 identity có test thật.
4. **`useUrlRecord` không đụng tham số của trang khác** — kiểm chứng P5: URL `?search=abc&tab=pats&cursor=xyz` sau Apply còn nguyên `tab`/`cursor`. Và 4 trang là 4 route riêng (`pageRegistry.js:248-259`) nên không đụng nhau dù không dùng `prefix`.
5. **Reset / clear** — kiểm chứng P3: `?search=abc&status=active&serviceAccountId=sa1` → clear ⇒ URL `""`, đúng như `useState` cũ.
6. **Setter nào per-keystroke vs sau Apply** — `PortfolioHoldingsPage.tsx:189` (`search`, per-keystroke, **có** `replaceKeys`) · `AdminBillingFleetPage.tsx:143` (`search`, per-keystroke, **có**) · `AdminAuditPage.tsx:115-116` (`tenantId`, `actor`, **có**) — đều đúng. **Nhưng** `AdminAuditPage.tsx:121` `resourceType` cũng là `<input>` text gắn thẳng `onChange` mà **không** có trong `replaceKeys` ⇒ vẫn đẩy 1 entry/ký tự (xem ghi chú dưới).
7. **AC-3 rev 2 + AC-3b có mạnh hơn bản cũ không** — **CÓ, và tôi đã chứng minh bằng H2** (cả hai đỏ với code cũ). Nhưng xem ghi chú bên dưới về AC-3b.

### Ghi chú nhỏ (không tính vào bảng đếm)
- **`AdminAuditPage.tsx:121`** (`resourceType`): `<input value={resourceType} onChange={e => setResourceType(...)}>` — per-keystroke nhưng `replaceKeys: ["tenantId","actor"]` (`:49`) không liệt kê nó ⇒ Major 2 **bỏ sót 1 call site** trong đúng 3 trang mà Major 2 tự nhận là đã xử lý. Đề xuất: thêm `"resourceType"`.
- **`AC-3b` dựng lịch sử giả**: `mount("", ["/p"])` (`:127`) tạo 2 entry giống hệt nhau để `navigate(-1)` quay về "trang chưa lọc". Trình duyệt thật **không** tạo ra tình huống đó (Back sẽ **rời trang**) — đúng như chính comment `:102-103` thừa nhận. Test vẫn **đỏ với code cũ** nên không rác, nhưng nó chứng minh cơ chế chứ không phải hành vi người dùng. Nên thêm 1 test khẳng định điều đó, hoặc đổi tên để không ám chỉ "undo bộ lọc" còn tồn tại.

---

## KHÔNG VERIFY ĐƯỢC

1. **Hành vi thật của nút Back trên trình duyệt thật** — mọi phép đo dùng `createMemoryRouter` + `router.state.historyAction`. Chính team cũng ghi (`useUrlRecord.component.test.tsx:9-14`) rằng `RouterState` không expose chỉ số history. Không chạy Playwright/dev-server thật.
2. **`npm run test:components` (full suite, ~3+ phút)** — **CHƯA CHẠY**. Không kết luận được full suite còn xanh sau diff.
3. **Số NAV-1 / `check-uiux-budget` (AC-4.3, AC-4.6: baseline 108, current 104)** — ngoài phạm vi tôi (scanner/scripts thuộc auditor khác). Không đo.
4. **Hệ quả với `docs/CODE_CHANGE_AUDIT_LEDGER.md`** — không có Entry nào cho S4 trong diff (`git diff --stat dev..HEAD` không liệt kê file ledger). Việc ledger có bắt buộc hay không thuộc Stage 6.
5. **`?expiresWithinDays=abc` trên bản deploy cũ** — tôi kết luận "không phải regression" dựa trên việc `dev` dùng `useState` thuần nên URL không được đọc; chưa kiểm tra log/sự cố production thật nào có URL dạng đó.
6. **`nav1-rule.mjs` đang bị sửa giữa chứng tôi audit** — không đọc nội dung, thuộc phạm vi auditor khác. Nếu thay đổi đó ảnh hưởng con số NAV-1 mà S4 dựa vào thì AC-4.3/AC-4.6 cần đánh giá lại.

---

## TÓM TẮT

Diff này **làm đúng** những gì nó nói và **nói thật** trong các comment: claim "2 `setParams` trong 1 tick không compose" là **đúng** (tôi đo được `beta` bị mất), claim `interface` không tho `Record<string, unknown>` là **đúng** (`tsc` báo `TS2344`), và các test mới **không phải rác** — 6/6 phép kiểm chứng hazard 10 đều cho kết quả mong đợi.

Nhưng chính vì comment viết tử tế đến vậy mà 4 lỗi dưới đây đáng gọi là `NEED_REVISION` chứ không phải `PASS`: (1) tác giả **phát hiện** cơ chế 2-`setParams`-không-compose rồi **bỏ qua** `AdminBillingFleetPage.tsx:131` đang dính đúng bug đó — đo thật thì chọn trạng thái hóa đơn xong bị xoá, và bug này có sẵn trên `dev`; (2) `filtersDraft` không được gieo từ URL nên deep-link lọc đúng bảng nhưng form trống, bấm "Áp dụng" là xoá sạch filter trong link (lỗi **mới**, do `useState` → `useUrlRecord`); (3) `replaceKeys` trên `useUrlRecord` là tính năng chết vì kiểm `keys.every` trên toàn bộ key của spec, và **không test nào** bảo vệ; (4) đổi hành vi "mất undo bằng Back" được hứa ghi vào `docs/REPORT_FINAL_UIUX_WAVE4.md` — **file không tồn tại**.
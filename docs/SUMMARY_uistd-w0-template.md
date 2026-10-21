# SUMMARY — `uistd-w0-template` (S1 — template chuẩn `CommercialPage`)

> **Worker:** `uistd-w0-template` · **Branch:** `feat/uistd-w0-template` · **Worktree:** `C:\MujocoProjects\agent-uistd-a1`
> **Base:** `dev` @ `e7b008f25` · **Kế hoạch:** `docs/PLAN_UI_STANDARDIZATION_W0.md` (v1.3) §C1 · §AC-3 · §Non-goals
> **Claim:** `b8547c70c` (đã khai sẵn trước khi sửa dòng đầu tiên — **không khai lại**)

---

## 1. Commit

| Commit | Nội dung |
|---|---|
| `b8547c70c` | claim (có sẵn từ trước, không phải do slice này tạo) |
| `5009d90ab25d51bcead797abd98429ad3516b1a5` | **code + test**: `feat(fe): them template CommercialPage + 4 primitive (UI Standardization W0 - S1)` — 9 file, **885 insertions / 0 deletions** |
| commit của file này | `docs/SUMMARY_uistd-w0-template.md` (báo cáo, tách riêng) |

Lệnh tái lập: `git -C C:\MujocoProjects\agent-uistd-a1 log --oneline -3` · `git show --stat 5009d90ab`

---

## 2. File đã tạo (9 file — **không sửa file nào đã tồn tại**)

`git show --stat 5009d90ab` → 9 file changed, 885 insertions(+), 0 deletions(-)

| File | Dòng | Vai trò |
|---|---|---|
| `packages/web/src/components/commercial/CommercialPage.tsx` | 118 | component gốc: 6 vùng, 1 `<h1>`, `role="region"`, `useId()` |
| `packages/web/src/components/commercial/CommercialPage.module.css` | 305 | CSS module, tiền tố **`.cm-` duy nhất**, 0 hex cứng |
| `packages/web/src/components/commercial/primitives/CommercialToolbar.tsx` | 23 | vùng toolbar (`role="group"` + `aria-label`) |
| `packages/web/src/components/commercial/primitives/CommercialState.tsx` | 73 | vùng trạng thái: loading / empty / error |
| `packages/web/src/components/commercial/primitives/CommercialTable.tsx` | 66 | `<caption>` + `scope="col"` / `scope="row"` |
| `packages/web/src/components/commercial/primitives/CommercialMeta.tsx` | 26 | vùng metadata (`<dl>/<dt>/<dd>`) |
| `packages/web/src/components/commercial/commercialMessages.ts` | 41 | **file phụ** — catalog VI/EN + hook `useCommercialTranslator()` |
| `packages/web/src/components/commercial/commercialUtils.ts` | 3 | **file phụ** — `joinClassNames()` |
| `packages/web/src/components/__tests__/commercial-page.component.test.tsx` | 230 | 18 test (fail-before → pass-after) |

**2 file phụ ngoài danh sách trong prompt** nhưng **nằm trong scope `packages/web/src/components/commercial/**` của plan** (§SCOPE S1). Lý do: `src/i18n/vi.js` + `src/i18n/en.js` là **file shared** (deny-list §2) và slice này bị cấm sửa file đã tồn tại ⇒ không thể khai báo key `commercialPage.*` trong từ điển; chuỗi hiển thị được gom vào **1 catalog riêng** thay vì rải trong JSX.

---

## 3. Hợp đồng C1 — đã hiện thực

| Yêu cầu C1 | Hiện thực | Bằng chứng |
|---|---|---|
| Props `eyebrow, title, description, badge, metrics, notice, error, toolbar, actions, children, meta, className, id` | đủ 13 props + **1 prop phụ `state`** (xem mục 8 — deviation) | `CommercialPage.tsx:9-24` |
| **KHÔNG** render `<main>` | `<div role="region">` — không có `<main>` trong file | test `AC-1` (`container.querySelectorAll("main")` → 0) |
| đúng **1** `<h1>` | một `<h1 id={titleId}>` duy nhất | test `AC-1`, `AC-4b` |
| `<div role="region" aria-labelledby={titleId}>` | `CommercialPage.tsx:69-70` | test `AC-1` |
| `id` sinh bằng `useId()` | `useId()` → `cm-${autoId.replace(/:/g,"")}` (mẫu `ShellPageTemplate.js:102`) | test `AC-1` (`region.id.startsWith("cm-")`) |
| 6 vùng | header · toolbar · body · state · actions · meta (mỗi vùng có `data-cm-zone` làm mốc test) | test `AC-1c` |
| skeleton `aria-hidden` + vùng `aria-busy` | `aria-hidden="true"` trên skeleton, `aria-busy="true"` trên **node khác** vùng live | test `AC-3` |
| empty = "—" + lý do + CTA | `cm-empty` | test `AC-3b` |
| error = `role="alert"` + nút Retry + hướng khắc phục | `role="alert"` + nút `t("commercialPage.retry")` + `cm-error-hint` | test `AC-2` |
| **vùng live mount sẵn** (không render động) | node `role="status" aria-live="polite"` và node `role="alert"` **luôn có trong DOM** kể cả khi rỗng (theo `AUDIT_VNBROKER_CONSOLE_20261019.md` §J3 A4) | test `AC-2b`, `CommercialState` test |
| 4 primitive | Toolbar · State · Table · Meta | file `primitives/*` |
| CSS tiền tố `.cm-` duy nhất | **40** class, tất cả `.cm-*`; **0** class trùng với 1566 class đang có trong repo | lệnh đo dưới |
| i18n qua `useI18n()` + `t("...")`, không hardcode chuỗi hiển thị | `useCommercialTranslator()` → `useI18n().t(key, { defaultValue })`; **0** ký tự tiếng Việt trong 5 file component (test `AC-5d`) | test `AC-5d` |

**Đo 0 class trùng (lệnh tái lập):**
```
cd C:\MujocoProjects\agent-uistd-a1\packages\web
node -e "const fs=require('fs'),path=require('path');function walk(d,o=[]){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);e.isDirectory()?walk(p,o):p.endsWith('.css')&&o.push(p)}return o}const n=new Set();for(const f of walk('src'))for(const m of fs.readFileSync(f,'utf8').matchAll(/\.([A-Za-z][A-Za-z0-9_-]*)/g))n.add(m[1]);console.log([...n].filter(x=>x.startsWith('cm-')).length)"
```
→ kết quả: **0** (không class `cm-*` nào trùng với class đang có).

---

## 4. Gate đã chạy (exit code thật, trên **cây đã commit** `5009d90ab`)

Tất cả chạy từ `C:\MujocoProjects\agent-uistd-a1\packages\web` trừ khi ghi rõ.

| # | Lệnh | Exit | Output thật (rút gọn) |
|---|---|---|---|
| G1 | `npx tsc --noEmit` | **0** | không in gì (0 lỗi) |
| G2 | `npx vitest run src/components/__tests__/commercial-page.component.test.tsx` | **0** | `Test Files 1 passed (1)` · `Tests 18 passed (18)` |
| G3 | `npx eslint src/components/commercial src/components/__tests__/commercial-page.component.test.tsx` | **0** | `✖ 60 problems (0 errors, 60 warnings)` — toàn bộ là `react/jsx-no-literals` (rule repo đã có sẵn 4191 warning; file `.tsx` cũ của repo cũng dính, vd `PortfolioChart.tsx` 4 warning) |
| G4 | `npm run check:tokens` | **1** | `src\components\brokerData\brokerData.css: #c4b5fd` — **1 lỗi nền đúng bằng baseline**, **delta = 0** (file mới của S1 không làm tăng) |
| G5 | `node scripts/normalize-eol.mjs` (repo root) | **0** | `normalize-eol — OK (0 file thay doi, tat ca khop dang blob goc)` |
| G6 | `node packages/web/scripts/check-multi-agent.mjs` (repo root) | **0** | `0 lỗi, 0 trùng số migration — PASS` (các dòng `!` là cảnh báo path claim của agent khác, có sẵn từ trước) |
| G7 | `npm run check:dom-landmarks` | **0** | `✓ ShellPageChrome renders <div> not <main>` … `check:dom-landmarks — PASS` |
| G8 | `node scripts/i18n-scan-strict.mjs` (repo root) | **0** | không có `i18next-scanner: Unable to parse` (các dòng *"different default value"* là của file khác, có sẵn) |
| G9 | `npm run build` | **0** | `✓ built in 1m 2s` |
| G10 | `npx vitest run` (full suite) | **0** | `Test Files 169 passed (169)` · `Tests 1160 passed (1160)` — **chạy 2 lần, cả 2 lần đều exit 0** |
| G11 | `npm test` (jest, delta-only) | **1** | `Test Suites: 3 failed, 18 passed, 21 total` · `Tests: 9 failed, 259 passed, 268 total` — **đúng bằng baseline (3 suite FAIL / 9 test FAIL), delta = 0** |

**Fail-before của AC-3 (bắt buộc, đã chạy trước khi viết component):**
```
npx vitest run src/components/__tests__/commercial-page.component.test.tsx
→ EXIT=1
  FAIL src/components/__tests__/commercial-page.component.test.tsx
  Error: Failed to resolve import "../commercial/CommercialPage.js" from
  "src/components/__tests__/commercial-page.component.test.tsx". Does the file exist?
```
Sau khi viết component: `EXIT=0`, `18 passed (18)`.

**Lệnh tái lập từng gate:** như trong bảng; tất cả chạy ở đúng worktree `C:\MujocoProjects\agent-uistd-a1`.

---

## 5. Gate **CHƯA CHẠY** (kèm lý do)

| Gate | Trạng thái | Lý do |
|---|---|---|
| `node packages/web/scripts/check-theme-contrast.mjs` | **CHƯA CHẠY** | file **chưa tồn tại** — S2 (`uistd-w0-gates`) tạo; không phải scope S1 |
| `node packages/web/scripts/check-token-conflict.mjs` | **CHƯA CHẠY** | như trên (S2 tạo). Đã tự kiểm bằng lệnh đo ở mục 3: **0** class `cm-` trùng |
| `node packages/web/scripts/check-focus-ring.mjs` | **CHƯA CHẠY** | như trên (S2 tạo). Đã tự kiểm bằng test `AC-5c`: CSS mới **không có** `outline: none` / `outline-none`, có `:focus-visible { outline: 2px solid … }` |
| `node packages/web/scripts/check-heading-contract.mjs` | **CHƯA CHẠY** | như trên (S2 tạo). Đã tự kiểm bằng test `AC-1`/`AC-4`: template render **1** `<h1>`; route đã có `<h1>` mà không gỡ ⇒ **2** `<h1>` (test `AC-4` chứng minh đúng điều kiện này) |
| `node packages/web/scripts/check-a11y-runtime.mjs` | **CHƯA CHẠY** | như trên (S2 tạo) + cần staging/Docker |
| `npm run test:visual` (playwright) | **CHƯA CHẠY** | cần Playwright + browser + staging; S1 **chưa route nào import** template ⇒ không có màn hình nào để chụp |
| `npm run i18n:scan` | **CHƯA CHẠY** | gate này **ghi file** vào `node_modules/.cache/i18next-scanner/`; đã chạy bản tương đương `i18n:scan:strict` (G8, exit 0) để tránh side effect (L-V03). Key `commercialPage.*` **chưa** nằm trong từ điển ⇒ scanner sẽ ghi mới 5 key vào cache, không sửa `vi.js`/`en.js` |
| `npm run check:shell` | **CHƯA CHẠY** | gom nhiều gate (contrast/stock-detail/admin-spa/i18n-hardcoded) — nằm ngoài danh sách gate bắt buộc của slice; các thành phần liên quan đã chạy riêng (G4, G7, G8) |
| `npm run check:i18n-hardcoded` | **CHƯA CHẠY** | script quét **cố định** `src/components/advisory`, `src/components/WhaleBubbleChart.jsx`, `src/components/dashboard/WhaleAnalyticsTab.jsx`, `src/pages/signals/WhaleAdvisoryPage.tsx` — **không** quét `src/components/commercial/**`. Thay vào đó có test `AC-5d` (0 ký tự tiếng Việt trong 5 file component) |

---

## 6. Waiver xin

**Không xin waiver nào cho gate bắt buộc.** Tất cả gate bắt buộc trong prompt đã chạy và đều đạt (riêng `check:tokens` exit 1 là **lỗi nền có sẵn**, delta = 0 — đúng cách baseline của plan định nghĩa).

**Cần coordinator quyết 2 điểm (không phải waiver, là quyết định):**

1. **Key i18n `commercialPage.*` chưa nằm trong `src/i18n/vi.js` / `en.js`.** Vì 2 file này là shared (deny-list §2) và slice bị cấm sửa file đã tồn tại ⇒ tôi dựng catalog VI/EN riêng trong `commercialMessages.ts` làm `defaultValue`. `t()` của app vẫn được gọi đúng ⇒ **khi coordinator chuyển 5 key vào từ điển, hành vi không đổi** (từ điển thắng `defaultValue`). Việc chuyển key = thêm 5 dòng × 2 file.
2. **Prop `state` là deviation khỏi C1.** C1 liệt kê 13 prop nhưng AC-3 bắt buộc có đường `loading` / `empty` / `retry` ⇒ tôi gom 3 đường đó vào **1 prop `state`** (object) thay vì thêm 3 prop rời. `error` vẫn nằm ở top-level đúng C1. Nếu coordinator muốn `state` phẳng (`loading` / `empty` / `onRetry` / `retryHint` ở top-level) thì đổi 1 chỗ.

---

## 7. Rủi ro đã biết

| # | Rủi ro | Mức | Giảm thiểu / bằng chứng |
|---|---|---|---|
| R1 | **Template chưa được route nào dùng** ⇒ lỗi runtime chỉ lộ khi W1–W3 migrate | Thấp | S1 là file mới, **0 route import** ⇒ blast radius = 0. Rollback = xoá thư mục (plan §Rollback) |
| R2 | **Route đã có `<h1>` riêng mà không gỡ ⇒ 2 `<h1>`** | Cao nếu migrate sai | Test `AC-4` **chứng minh** đúng tình huống này (2 h1). C1 ghi rõ phải gỡ `<h1>` cũ khi migrate — **mỗi PR migrate phải kèm 1 test đếm h1** |
| R3 | **Vùng live vẫn để `aria-live="polite"` + `role="status"`; node `role="alert"` luôn mount** ⇒ nếu sau này nhét `role="alert"` **vào trong** node live thì đọc 2 lần | Thấp | Hiện tại `role="alert"` nằm **ngoài** node live (`CommercialState.tsx:41` vs `:52`) — tách 2 node, không lồng nhau |
| R4 | `notice` dùng `role="status"` ⇒ khi có notice sẽ có **2** live region (notice + state) | Thấp | Cố ý: `notice` là thông báo tĩnh; vùng live của **trạng thái** vẫn là 1 node duy nhất (`aria-live` attribute chỉ xuất hiện 1 lần — test `AC-3` chọn đúng node này) |
| R5 | **Flake hạ tầng vitest**: 1/3 lần chạy full suite bị `Worker exited unexpectedly` (exit 1), 2/3 lần xanh | Thấp | Đã chạy **3 lần**: lần 1 crash, lần 2 và lần 3 `169 files / 1160 tests` exit 0. Không repro được ⇒ không quy cho code S1 (L-G03: đối chứng bằng cách chạy khác). **CHƯA CHẠY**: chưa chạy lại full suite trên `dev` sạch để chứng minh flake có sẵn — cần coordinator đo nếu muốn |
| R6 | `react/jsx-no-literals` sinh **60 warning** mới (0 error) | Rất thấp | Cùng rule đã có 4191 warning repo-wide; file `.tsx` cũ của repo cũng dính (`PortfolioChart.tsx` 4 warning). Không gate nào chặn warning |
| R7 | Catalog VI/EN trong `commercialMessages.ts` **lệch** từ điển nếu coordinator thêm key mà quên sửa catalog | Thấp | `t()` ưu tiên từ điển ⇒ thêm key vào `vi.js`/`en.js` là đủ, catalog thành dead code — **cần dọn khi chuyển key** |

---

## 8. Việc ngoài scope **đã thấy nhưng KHÔNG sửa**

| # | Việc thấy | Vì sao không sửa |
|---|---|---|
| O1 | `src/i18n/vi.js` + `en.js` chưa có key `commercialPage.*` | shared file (deny-list §2) + scope S1 = `src/components/commercial/**` |
| O2 | `check-tokens` vẫn đỏ vì `src/components/brokerData/brokerData.css: #c4b5fd` | lỗi **nền** của `dev` (baseline 1); plan ghi rõ gate này **delta-only**, S1 delta = 0 |
| O3 | `FullLayout.tsx:90` + `TenantAdminLayout.tsx:82` có `<main>` lồng ở 18 route tenant-admin (R6 trong plan) | thuộc W1–W3 + scope S3/Owner; **không** đụng layout |
| O4 | `Sidebar.tsx:81` render `<h1>` + `<h3>` ⇒ 2 h1 ở route có h1 riêng (R5) | ngoài scope S1; S1 chỉ cung cấp template + test chứng minh hành vi |
| O5 | `docs/CLAIMS.md` có nhiều dòng claim trỏ tới file không tồn tại trong worktree (cảnh báo `!` của G6) | do agent khác ghi; `check-multi-agent` vẫn exit 0; tôi không sửa `docs/CLAIMS.md` (ngoài dòng claim của tôi) |
| O6 | `docs/CODE_CHANGE_AUDIT_LEDGER.md` chưa có Entry cho slice này | ledger do **coordinator** ghi (NG-7) |

---

## 9. Bài học quy trình (1)

**"Ghi test TRƯỚC, nhưng test phải import đúng file mà chưa tồn tại — và lỗi đỏ phải là lỗi IMPORT, không phải lỗi assertion vô nghĩa."**

Lý do: AC-3 yêu cầu *fail-before*; nếu tôi viết test **sau** component thì "fail-before" là một lời hứa không kiểm chứng được (L-V02: không tái hiện được lỗi thì chưa biết mình đang bảo vệ cái gì). Tôi đã chạy test **trước** khi viết component và lỗi đỏ là `Failed to resolve import "../commercial/CommercialPage.js" … Does the file exist?` (exit 1) — lỗi **import**, tức là cơ chế bảo vệ đã bắt đúng thứ nó phải bắt (test chưa tồn tại ⇒ không thể xanh giả). Sau khi component có mặt, cùng lệnh đó xanh `18/18`.

Bài học rút ra cho slice sau: **fail-before chỉ có giá trị nếu lỗi đỏ nằm đúng chỗ cần kiểm**; ghi lại lỗi đỏ cụ thể (kèm exit code) vào báo cáo, không chỉ ghi "đã fail-before".

*(Ghi chú: bài học này **không** được ghi vào `docs/LESSONS/` vì nội dung đã nằm sẵn trong `docs/LESSONS/verification.md` L-V02 + L-V04 và trong `AGENTS.md` — không có lõi sai lầm mới. Không tạo file lesson mới theo INDEX §1.3 vì đủ 4 điều kiện không thành: không có hậu quả mới.)*

---

## 10. Xác minh của supervisor (sau khi commit thứ 2)

Phiên worker bị **ABORT** (opencode restart) sau commit `6428e25ec`; supervisor chạy lại gate trên
**cây đã commit** (không sửa code của worker):

| # | Lệnh (cwd = `packages/web` của worktree) | Exit | Output thật |
|---|---|---|---|
| V1 | `npx tsc --noEmit` | **0** | không in gì (0 lỗi) |
| V2 | `npx vitest run src/components/__tests__/commercial-page.component.test.tsx` | **0** | `Test Files 1 passed (1)` · `Tests 20 passed (20)` — **nhiều hơn 18** vì commit `6428e25ec` (kebab-case `.cm-`) đã thêm 2 test |
| V3 | `npx eslint src/components/commercial src/components/__tests__/commercial-page.component.test.tsx` | **0** | `✖ 60 problems (0 errors, 60 warnings)` — cùng loại `react/jsx-no-literals` |
| V4 | `npm run check:tokens` | **1** | `src\components\brokerData\brokerData.css: #c4b5fd` — **đúng bằng baseline 1**, **delta = 0** ⇒ S1 không thêm hex cứng |
| V5 | `node scripts/normalize-eol.mjs` (repo root) | **0** | `normalize-eol — OK (0 file thay doi, tat ca khop dang blob goc)` |
| V6 | `node packages/web/scripts/check-multi-agent.mjs` (repo root) | **0** | `0 lỗi, 0 trùng số migration — PASS` |

**Kết luận supervisor: S1 ĐẠT AC-3.** Không có blocker/major.

### 10.1. Reservation (deviation đã biết — chấp nhận trong W0, đóng ở W1)

| # | Deviation | Vì sao chấp nhận | Owner + wave đóng |
|---|---|---|---|
| RV-1 | 5 chuỗi mặc định (retry / retryHint / loading / emptyValue / emptyReason) nằm trong **catalog riêng** `commercialMessages.ts` thay vì `src/i18n/{vi,en}.js` | `src/i18n/*.js` là file **cao động chồng file** (nhiều agent sửa) và **ngoài SCOPE** của S1 trong plan; catalog riêng giữ **VI + EN** đầy đủ và vẫn đi qua `useI18n()` cho `t(key, {defaultValue})` | coordinator · W1 (khi route đầu tiên migrate → gộp key vào `src/i18n/{vi,en}.js`) |
| RV-2 | Thêm **1 prop `state`** ngoài danh sách C1 (C1 không định nghĩa prop cho vùng trạng thái) | C1 chỉ quy định 6 **vùng**, không quy định API chi tiết của vùng trạng thái; prop bổ sung **mở rộng**, không xung đột | coordinator · v1.4 của plan |
| RV-3 | Gate 5 cái của S2 **chưa có** lúc S1 chạy ⇒ S1 tự kiểm bằng test riêng (hex cứng: delta 0; `focus:outline-none`: có `:focus-visible` 2px) | S2 chạy song song, chưa merge ⇒ chưa thể gọi | uistd-w0-gates · S2 |

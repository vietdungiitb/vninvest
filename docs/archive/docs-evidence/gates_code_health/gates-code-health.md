# GATE — code-health (dọn dead code + hồi test chết + siết gate)

**Agent:** `code-health` · **Branch:** `cleanup/code-health` · **Base:** `dev @ a8e22135`
**Ngày:** 2026-09-27 · Chạy local (user: *"làm những việc bạn cho là tốt nhất"*)
**0 đổi API, 0 migration, 0 đụng BE.**

---

## 0. Đính chính phân tích của phiên trước — tôi đã kết luận SAI

Phiên trước tôi báo *"17 test Playwright fail mới = regression của 3 wave"* và đề xuất
re-baseline snapshot. **Kết luận đó sai.** Đo lại mới biết:

| Bằng chứng | Kết quả |
|---|---|
| `unified-layout-pilot.pilot0.spec.ts-snapshots` có **0 file trong git**, 18 file trên đĩa | Baseline **chưa từng được commit** ⇒ lần chạy đầu sinh ra rồi fail, lần sau pass |
| Cùng build, chạy 2 lần liên tiếp | Lần 1: **24 fail** · lần 2: **7 fail** |
| `critical-pages` trên **baseline `94f1d5c5`**, chạy 3 lần | **12/12 fail, đúng y tập 12 như bản của tôi**, ổn định |

⇒ **3 wave của tôi không gây regression visual nào.** Con số "9 vs 12" trong lần so sánh
đầu là nhiễu của một lần chạy full-suite cụ thể, không phải khác biệt thật.

**Sai ở đâu:** tôi đếm khác biệt giữa hai lần chạy full-suite, mà lần đó bị nhiễu bởi
sinh-baseline lần đầu. Đáng lẽ phải kiểm tra baseline có trong git không *trước khi*
kết luận, và chạy nhiều lần trước khi so.

**Hệ quả thực tế — 2 spec visual đang hỏng về thiết kế, không phải về pixel:**

| Spec | Vấn đề | Hậu quả |
|---|---|---|
| `unified-layout-pilot.pilot0.spec.ts` | baseline 18 ảnh **không commit** | clone mới luôn đỏ lần đầu; xoá local là đỏ lại |
| `critical-pages.spec.ts` | chụp **trang thật với dữ liệu thật** + `maxDiffPixels: 100` | nội dung đổi theo dữ liệu ⇒ không bao giờ ổn định |

Cách sửa đúng là **mock API** (như `dashboard-alert-probe.spec.ts` đang làm) rồi
re-baseline **một lần**. **CHƯA LÀM** — đó là ticket riêng cho 4 trang, và
re-baseline lúc này sẽ chấp nhận một cách mù drift chưa ai hiểu.

## 1. Dead code do chính Wave 2 để lại

`useAlertCenterSnapshot` sau Wave 2 chỉ còn `DashboardPage.tsx` dùng, và chỉ lấy
`alerts`/`loading`/`error`/`loadInitial`. Phần cursor pagination trở thành code chết.

| Xử lý | Chi tiết |
|---|---|
| `src/utils/feedCursor.ts` (**mới**) | SSOT cho `extractFeedCursor` |
| `useAlertCenterSnapshot.ts` | Bỏ `nextCursor`/`cursorHistory`/`goToNextPage`/`goToPrevPage`/`hasNextPage`/`hasPrevPage` + bản `extractFeedCursor` riêng. 132 → 100 dòng |
| `AlertCenterPage.tsx` | Xoá local `extractFeedCursor`, import từ SSOT |

**Hai bản trùng lặp trước đó KHÁC NHAU về hành vi** — đây mới là lý do đáng tách:

| Bản | `catch` | Hậu quả |
|---|---|---|
| `useAlertCenterSnapshot.ts` | `return next` | gửi **lại chính URL hỏng** → BE 400 |
| `AlertCenterPage.tsx` | `return null` | dừng phân trang |

Giữ bản fail-closed.

Lợi phụ: poll 15s không còn phụ thuộc `cursorHistory` nên luôn đọc trang đầu của scope
hiện tại thay vì trang user đang đứng.

**Test:** xoá `useAlertCenterSnapshot.pagination.component.test.ts` (test code đã xoá) và
tách thành 2 file đúng trọng tâm:
- `useAlertCenterSnapshot.component.test.ts` — 4 test: không còn API phân trang, map param, lỗi, response thiếu `results`
- `feedCursor.component.test.ts` — 6 test, giữ ý bảo vệ bug 404 "Invalid cursor"

> **Bẫy `vitest.config.ts:12`:** `include: ["src/**/*.component.test.{js,ts,tsx}"]`.
> File tên `*.test.ts` **không bao giờ chạy**. Tôi đặt tên `feedCursor.test.ts` trước,
> không có test nào chạy, phải đổi tên mới được thu thập.

## 2. Hồi test chết: 5/18 jest suite không chạy được

`Test Suites: 5 failed, 13 passed` nhưng `Tests: 226 passed, 226 total` ⇒ 5 suite chết ở
tầng **load module**, không phải assertion.

**Ba lớp nguyên nhân, tìm ra theo thứ tự:**

### Lớp 1 — top-level `await` (CJS của Jest không transform)
```
SyntaxError: await is only valid in async functions and the top level bodies of modules
```
Cả 5 file có top-level `await import(...)` sau `jest.unstable_mockModule`.
Sửa: gộp vào `beforeAll`, giữ nguyên thứ tự "đăng ký mock → import".
Suite bắt đầu load — **và lộ ra 16 lỗi assertion thật** mà tôi đã cảnh báo trước.

### Lớp 2 — `unstable_mockModule` không chặn được CJS
Babel ép các module sang CommonJS (`at Object.require (...:6:1)`), còn
`unstable_mockModule` **chỉ chặn ESM `import()`** ⇒ mock đăng ký im lặng, không có tác
dụng. Chứng minh: `useOrderBook` `expect(mockAdapter.getRealtimeDepthChart).toHaveBeenCalledWith('FPT')`
→ **Number of calls: 0** dù mock có đúng hình dạng.

Sửa: `jest.mock` (được `babel-plugin-jest-hoist` nâng lên trên import).

### Lớp 3 — `import.meta` trong `TurnstileWidget.js:31`
```
SyntaxError: Cannot use 'import.meta' outside a module
```
Giết cả `AuthPages`. Sửa bằng test double giữ **đúng contract** widget thật phục vụ
(`TurnstileWidget.js:103-114`: nút `turnstile-test-trigger` → `onVerify("cf-test-token")`).
Trả `null` như lần mock đầu sẽ giết chính test cần nó. Widget thật có test riêng.

### Ba bug tiềm ẩn phát hiện thêm
1. `AuthPages.test.js` mock `../src/context/LangContext.js` — **sai đường dẫn**; comment trong file giả định `unstable_mockModule` resolve tương đối với `setupTests.js`, thực tế resolve từ chính file test.
2. `viewportWhaleMarkers.test.js` gọi hook **trực tiếp ngoài render context** → `TypeError: Cannot read properties of null (reading 'useMemo')`. Tác giả thêm mock React để lách, nhưng mock không ăn (lớp 2). Sửa bằng `renderHook` — không cần mock framework.
3. `dashboard_lifecycle.test.js` dùng **fake-React harness tự viết** (`mockStateVal` registry + setter giả), và test **đọc thẳng `mockStateVal` để assert**. Chuyển sang `renderHook` là viết lại kiến trúc test, không phải dọn code.

### Kết quả

| | Trước | Sau |
|---|---|---|
| `Test Suites` | 5 failed / 13 passed | **1 failed / 17 passed** |
| `Tests` | 226 passed / 226 total | **253 passed / 255 total** |

4/5 suite hồi phục hoàn toàn:
| Suite | Kết quả |
|---|---|
| `AuthPages.test.js` | **7/7 PASS** |
| `viewportWhaleMarkers.test.js` | **5/5 PASS** |
| `useOrderBook.test.js` | **6/6 PASS** |
| `useSessionFacts.test.js` | PASS |
| `dashboard_lifecycle.test.js` | 3/5 — **CHƯA XỬ LÝ**, cần viết lại fake-React harness |

Không cần `npm install` (vi phạm AGENTS.md) — mọi fix đều bằng `jest.mock` / `beforeAll` /
`renderHook`.

Không sửa 2 test còn lại của `dashboard_lifecycle` bằng cách đổi kỳ vọng cho khớp hành vi
hiện tại — đó là "sửa test cho xanh".

## 3. Siết gate

### `check-multi-agent.mjs` — 17 cảnh báo giả → 0
`CLAIMS.md` quy ước ghi kèm trạng thái `.../file.js (new)` / `.../file.js (delete)`, nhưng
dòng 179 check `existsSync` trên **cả chuỗi có hậu tố** ⇒ 17/21 cảnh báo là giả, làm gate
mất tác dụng cảnh báo thật.

Sửa 2 điều:
1. Bỏ hậu tố ` (new)` / ` (delete)` trước khi check.
2. `(delete)` **không** check tồn tại — agent xoá file thì không tồn tại mới đúng; check là ngược ý nghĩa.

Còn lại 0 cảnh báo, 0 lỗi, 0 trùng số migration.

### `agent-sync.ps1` — build trở thành gate bắt buộc
Bước `5b` chạy `tsc` nhưng **không** chạy `build` — đúng lỗ hổng đã lọt 3 wave code phá
build. Thêm bước `5b2: npm run build`, fail ⇒ chặn PR.

Bằng chứng lý do: `tsc` PASS, `vitest` 52/52 PASS, `vite build` FAIL trên cùng một lỗi
import (`alertCenterFormat.js` vs `.ts`).

## 4. Gate phiên này

| Gate | Exit | Kết quả |
|---|---|---|
| `npm run build` | **0** | 3667 modules, 36.41s |
| `npx tsc --noEmit` | **0** | 0 lỗi |
| `npx eslint src` | **0** | 0 error |
| `npm run check:shell` | **0** | PASS |
| `npx vitest run` (full) | **0** | 101 file / 676 test PASS |
| `npx jest` | **1** | 17/18 suite PASS, 253/255 test (2 fail ở `dashboard_lifecycle`) |
| `node scripts/check-multi-agent.mjs` | **0** | 0 cảnh báo, 0 lỗi, 0 trùng migration |

## 5. CHƯA LÀM

| Việc | Vì sao |
|---|---|
| `dashboard_lifecycle.test.js` 2 test | Cần viết lại fake-React harness → quyết định test giữ gì |
| `critical-pages` / `unified-layout-pilot` | Cần mock API + re-baseline 1 lần. Ticket riêng, 4 trang |
| 3 stash `lint-staged automatic backup` | Rất cũ (`stash@{0}`: 1384 file / 144k dòng từ thời `vninvestcharts/`). `pop` là thảm hoạ. Không đụng |
| Dead code khác | `PaginationBar.jsx` dùng API offset, không liên quan hook cursor |

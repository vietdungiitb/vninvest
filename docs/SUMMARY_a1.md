# SUMMARY_a1 — Slice S1 (W3-5): mobile ergonomics

**Branch:** `feat/uiux-wave4` · **Worker:** a1 · **Ngày:** 2026-10-09
**Phạm vi:** AC-1.1 … AC-1.6 của `docs/PLAN_UIUX_WAVE4.md:170-191` + §0.3-D.

---

## 1. File đã đổi (đúng 3, trong danh sách được giao)

| File | Hành động |
|---|---|
| `packages/web/playwright.config.ts` | **Sửa** — thêm project `mobile-ergonomics` |
| `packages/web/tests/visual/mobile-ergonomics.spec.ts` | **Mới** — 2 assertion |
| `packages/web/src/index.css` | **Sửa** — thêm `@media (pointer: coarse)` + sửa comment stale |

Không đụng `package.json`, không chạy `npm install`, không `npx playwright install`.

---

## 2. AC-1.1 — project `mobile-ergonomics`

`playwright.config.ts:41-70`:

```ts
{
  name: 'mobile-ergonomics',
  testMatch: /mobile-ergonomics\.spec\.ts/,
  use: {
    browserName: 'chromium',
    viewport: { width: 393, height: 851 },
    hasTouch: true,
    storageState: { cookies: [], origins: [] },
  },
},
```

- ✅ **không** `dependencies` ⇒ project `setup` (login thật) không chạy
- ✅ `storageState: { cookies: [], origins: [] }`
- ✅ `browserName: 'chromium'` tường minh
- ✅ `viewport 393×851`, `hasTouch: true` (không dùng 390×844 của iPhone 12 vì cần webkit)
- ✅ `testMatch` bắt buộc — xác nhận bằng thực tế: lần chạy đầu chỉ collect **2 test** từ
  1 file, không nhặt 18 `*.spec.ts` còn lại.

---

## 3. AC-1.2 — route công khai, và tại sao chọn 2 route này

`packages/web/src/main.tsx:130-133` khai 4 route **ngoài** `ProtectedRoute`:

```
main.tsx:130  /login
main.tsx:131  /register
main.tsx:132  /verify-email
main.tsx:133  /reset-password
```

Mọi route còn lại treo dưới `ProtectedRoute` (`main.tsx:137`) — hàm này redirect
`/login` khi không có token (`main.tsx:64`). Nếu đo route private thì sẽ **âm thầm đo
lại trang login**, tức là tự thỏa mãn AC mà không đo gì thật.

Đo 2 route: **`/login`** và **`/register`** — cả hai có form đầy đủ control đo được
(input + submit), và là 2 route mà người dùng mobile chạm đầu tiên.

⚠ **Bẫy đã gặp:** lần probe đầu tôi chạy project `chromium` (có `storageState` trỏ
`tests/visual/.auth/user.json`) ⇒ đo nhầm **AppShell đã đăng nhập** (sidebar 255×44,
nút 40×40), không phải form công khai. Đã tạo config probe riêng với storage rỗng để
đo đúng. File probe đã xoá.

---

## 4. AC-1.3 — chứng minh fail-trước / pass-sau (hazard 10, **không** dùng hazard 11)

Cách an toàn đúng như yêu cầu: `git show dev:… > file`, **không** `git checkout --`.

### 4.1 FAIL-TRƯỚC (CSS = bản `dev`, tức chưa có block coarse)

Lệnh (từ `packages/web`):

```
npx playwright test --project=mobile-ergonomics --reporter=line
```

Output thật (rút gọn, `EXITCODE=1`):

```
[h-scroll] /login scrollWidth=393 innerWidth=393
[h-scroll] /register scrollWidth=393 innerWidth=393
[hit-area] undersized (<44px): /login <input> "Nhập tên đăng nhập hoặc email" 295x38 |
  /login <input> "••••••••" 295x38 | /login <button> "Đăng nhập" 295x36 |
  /register <input> "Tên đăng nhập" 295x38 | /register <input> "Email" 295x38 |
  /register <input> "Mật khẩu" 295x38 | /register <input> "Nhập lại mật khẩu" 295x38

  1 failed
    [mobile-ergonomics] › (ii) primary controls meet 44x44 target size
    Error: controls smaller than 44x44 (WCAG 2.5.5):
      /login <input> "Nhập tên đăng nhập hoặc email" → 295x38
      /login <input> "••••••••" → 295x38
      /login <button> "Đăng nhập" → 295x36
      /register <input> "Tên đăng nhập" → 295x38
      /register <input> "Email" → 295x38
      /register <input> "Mật khẩu" → 295x38
      /register <input> "Nhập lại mật khẩu" → 295x38
  1 passed
EXITCODE=1
```

**Đo được trước: 7 control nhỏ hơn 44 px — input 38 px, button submit 36 px.**

### 4.2 PASS-SAU (CSS đã thêm `@media (pointer: coarse)` + rebuild)

```
npm run build
  ✓ built in 1m 57s
BUILD_EXIT=0

npx playwright test --project=mobile-ergonomics --reporter=line
  [h-scroll] /login scrollWidth=393 innerWidth=393
  [h-scroll] /register scrollWidth=393 innerWidth=393
  [hit-area] undersized (<44px): none
  2 passed (36.2s)
EXITCODE=0
```

**Đo được sau: 0 control nhỏ hơn 44 px.**

⚠ **Rebuild là bắt buộc, không phải lựa chọn.** `vite preview` phục vụ `dist/`, và
`dist/` là build cũ. Nếu chỉ sửa `src/index.css` mà không `npm run build`, test vẫn
chạy bundle cũ và **vẫn xanh dù CSS sai** — tức là xanh giả. Đã kiểm chứng block
thực sự có trong CSS build:

```
dist/assets/index-ClyHoIWk.css coarse=YES
@media (pointer:coarse){button,select,textarea,summary,[role=button],…}
```

**Cảnh báo cho coordinator:** `dist/` là gitignored nhưng nằm trong main tree dùng chung.
Lệnh `npm run build` của tôi **xoá và viết lại toàn bộ `dist/`** ⇒ nếu agent khác đang
chạy `vite preview` song song thì có thể rơi vào cửa sổ `dist` không nhất quán. May mắn
là wave 4 không có agent nào khác chạy Playwright (chỉ S1 đụng `playwright.config.ts`),
nhưng ai đó chạy `vite preview` thì cần biết điều này.

### 4.3 Assertion (i) — guard chống hồi quy, KHÔNG tính là tiến bộ

`(i)` **đã pass sẵn** cả trước lẫn sau (`scrollWidth=393 == innerWidth=393`).
Đúng như O11 đã cảnh báo. Không tính vào thành tích.

---

## 5. AC-1.4 — fix CSS thật

`src/index.css:801-847`, selector list **giống hệt** danh sách `:777-787` của block
`touch-action` cũ (cùng nguồn SSOT):

```css
@media (pointer: coarse) {
  button, select, textarea, summary,
  [role='button'], [role='tab'], [role='switch'],
  [role='checkbox'], [role='radio'],
  input:not([type='checkbox']):not([type='radio'])
      :not([type='hidden']):not(.invisible-honeypot) {
    min-height: 44px;
  }

  button, [role='button'], [role='tab'],
  [role='switch'], [role='checkbox'], [role='radio'], summary {
    min-width: 44px;
  }
}
```

**Vì sao `pointer: coarse` chứ không phải `@media (max-width: …)`** — đây là thuoc tính
con trỏ, không phải độ rộng màn hình. Máy tính desktop đặt chuột (`coarse=false`) ở cửa
1200px **không** bị tăng kích thước; tablet/mobile ở 1920px vẫn được. Dùng `max-width` sẽ
phá desktop — đúng cái AC yêu cầu tránh.

**3 chỗ tôi CỐ Ý loại khỏi list (có bằng chứng, không phải tự ý):**

1. `input[type=checkbox]` / `[type=radio]` — ô vuông nhỏ cố định đồng bộ theo label;
   ép `min-height: 44px` làm nó phóng to và phá layout form.
2. `.invisible-honeypot` — `AuthRegisterPage.tsx:294-303`, 1×1, `aria-hidden="true"`,
   `tabIndex={-1}`, `pointer-events:none` (`AuthRegisterPage.css:1-8`). Đây là bẫy chống
   bot, **không phải mục tiêu chạm**; để nó ở 44 px là vô nghĩa. Probe đo được nó ở
   `382x1` và spec cũng loại nó (`classList.contains('invisible-honeypot')`).
3. `a[href]` — **không** đặt `min-width/min-height`. Link trong văn bản dài (`Quên mật
   khẩu?` 102×20) sẽ làm vỡ layout dọc. Đo thật trước khi loại, không đoán.

`check:tokens` PASS ⇒ không vi phạm rule token của repo.

---

## 6. AC-1.5 — safe-area

Không hứa `env(safe-area-inset-*)` khác 0. Headless Chromium **không có notch**, nên
`env()` trả `0px`; test hiện tại **không** assert giá trị safe-area. Giữ nguyên block
`:803-806` như cũ.

---

## 7. AC-1.6 — CHƯA CHẠY (không đoán)

| Hạng mục | Trạng thái | Lý do |
|---|---|---|
| Thiết bị thật (Android/iOS) | **CHƯA CHẠY** | không có thiết bị/emulator trong phiên |
| Notch / safe-area khác 0 | **CHƯA CHẠY** | headless Chromium không có notch |
| Safari iOS | **CHƯA CHẠY** | không cài webkit (`npx playwright install` bị cấm) |
| Firefox | **CHƯA CHẠY** | không cài browser |
| Tốc độ cuộn thật / `touch-action` | **CHƯA CHẠY** | `manipulation` đã có sẵn ở `:777-787` từ trước, test này **không** đo lại; cần máy thật |
| Focus ring khi chạm thật | **CHƯA CHẠY** | cần thiết bị |
| Route **có đăng nhập** (dashboard, watchlist, screener, stock detail, admin) | **CHƯA CHẠY** | `auth.setup.ts` login thật vào `:4173` — `vite preview` không có backend ⇒ mọi project có-auth chết trước khi test body chạy. Sửa hậu gốc nằm ngoài scope S1. |

**Hệ quả cần nói thẳng:** AC 44×44 hiện **chỉ được chứng minh trên 2 route auth**.
Các route trong app sau đăng nhập chưa hề được đo ở 393 px — nhưng chúng **dùng chung
selector list** nên nhiều khả năng đã đạt, chỉ là **chưa chứng minh**. Không được báo
"đã sửa xong toàn bộ".

---

## 8. Lệnh đã chạy + exit code thật

| # | Lệnh (từ `packages/web`) | Exit | Kết quả |
|---|---|---|---|
| 1 | `npx playwright test --project=mobile-ergonomics --reporter=line` (CSS = `dev`) | **1** | 1 failed / 1 passed — 7 control < 44 px |
| 2 | `npm run build` | **0** | `✓ built in 1m 57s` |
| 3 | `npx playwright test --project=mobile-ergonomics --reporter=line` | **0** | 2 passed (36.2s) |
| 4 | `npx eslint playwright.config.ts tests/visual/mobile-ergonomics.spec.ts` | **0** | 0 error (1 warning "file ignored" cho `playwright.config.ts`) |
| 5 | `npx tsc --noEmit` | **0** | sạch |
| 6 | `npm run check:tokens` | **0** | `✓ PASS (72 allowlisted hex, 0 violations outside)` |

Cố ý **không** chạy `npm run test:components` (agent khác đang sửa file trong cùng cây)
và **không** chạy UIUX scanner (3–5 phút, plan §1 đã cảnh báo).

---

## 9. Rủi ro

1. **`npm run build` ghi đè `dist/` dùng chung.** Agent khác chạy `vite preview` song
   song có thể gặp `dist` nửa cũ nửa mới.
2. **Chỉ 2 route auth được đo.** Route đã đăng nhập chưa đo (xem §7). Đây là giới hạn
   thật của AC-1.2, không phải đạt một phần rồi coi như xong.
3. **`min-height: 44px` có thể làm chồng layout ở module khác** — ví dụ hàng nút sát nhau
   (`gap` < 6 px) sẽ giãn ra. Đã tác động tới **mọi** `button` trong app trên touch
   pointer, không chỉ 2 trang này. Không có screenshot toàn-app để so (CHƯA CHẠY).
4. **Không có test hồi quy desktop** trong wave này. Lập luận "desktop không đụng" dựa
   trên đặc tính `pointer: coarse` — đúng về mặt CSS, nhưng chưa có test khoá lại.
5. **`dist/` gitignored** ⇒ thay đổi CSS của tôi **không xuất hiện trong diff**. Reviewer
   nhìn diff sẽ thấy `index.css` có block mới nhưng không thấy bằng chứng build. Bằng
   chứng thật nằm ở log §4.2.

---

## 10. Bài học quy trình (1)

**"Test xanh lần đầu" gần như luôn là test hỏng, không phải tín hiệu tốt.**

Lần chạy đầu của tôi: **2 passed, `undersized: none`** — trông như AC đã đạt sẵn, sẽ
dễ dàng báo cáo "không cần fix". Thực tế là **2 lỗi cùng lúc**:

1. **Đo 0 control** vì trang là lazy chunk (`resolvePageComponent`) — `domcontentloaded`
   nổi trước khi React mount, `querySelectorAll` trả về rỗng ⇒ mọi assertion đều pass.
   Sửa: chờ `form input`/`form button` `waitFor({state:'visible'})` trước khi đo.
2. **Đo nhầm AppShell đã đăng nhập** vì probe dùng chung `storageState` của project
   `chromium` — số đo đúng cho trang khác, sai cho trang cần đo.

Điểm chung: **cả hai lỗi đều tạo ra "pass" giả.** Chỉ khi buộc test **fail** mới lộ ra
chúng. Bài học rút: với test đo lường, **hãy làm hỏng nó có chủ đích trước khi tin vào
nó** — đây chính là lý do AC-1.3 đòi fail-trước, chứ không chỉ là nghi thức.
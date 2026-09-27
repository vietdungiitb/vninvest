# GATE — uiux-wave0 (Wave 0, dashboard `/dashboard`)

**Agent:** `uiux-wave0` · **Branch:** `feat/uiux-wave0` · **Base:** `dev @ 57116ecc`
**Worktree:** `C:\Mujoco Projects\agent-uiux-w0` · **Ngày:** 2026-09-27
**Phạm vi:** sửa layout dashboard + i18n + dọn dead CSS. **0 đổi API, 0 migration.**

---

## 1. Đã làm (6/9)

| # | Việc | File | Ghi chú |
|---|---|---|---|
| 0.2 | Lane content-sized thay `clamp` cứng | `index.css:412-433` | `height: auto; min-height: 360px; max-height: 720px`. Comment cũ nói `--dash-chrome` số đo thật — **không ai define** nên fallback 320px vĩnh viễn |
| 0.2b | `align-items: start` trên grid | `index.css` `.dashboard-triad-grid` | Mặc định `stretch` kéo lane ngắn (heatmap, AI) bằng chiều cao lane cao nhất ⇒ **tái tạo đúng khoảng trống rỗng** mà `height:auto` nhằm xoá |
| 0.3 | Bỏ sàn `min-height` lồng 3 tầng ở deck | `index.css` `.dashboard-full-width-deck` (bỏ `min-height: 400px`) · `CoreDashboardPositionDeck.tsx:305` (`min-h-[400px]`→`min-h-[280px]`) | 1 dòng bảng trước ra khối ~545px |
| 0.4 | Gỡ `dashboard-full-width-deck` ở 2 chỗ lồng | `CoreDashboardPositionDeck.tsx:236` · `WhaleAnalyticsTab.jsx:67` | Còn 3 viền + 3 `overflow` chồng; giữ class ở `DashboardPage.tsx:415` làm chủ sở hữu layout |
| 0.5 | Xoá 3 rule CSS chết | `SmartStatsHeader.css` | `.bg-current/10`, `.ring-emerald-400/80`, `.ring-offset-slate-950` — cả 3 **bare count = 0** |
| 0.6 | Thêm 5 i18n key + bỏ mock che lỗi | `vi.js` + `en.js` + `alert-card-compact.component.test.tsx` | Có **negative test**, xem §3 |
| 0.9 | Xoá 4 rule/tên class chết | `index.css` | `.glass` · `.agentic-glow-cyan` (3 rule) · `.bento-card-hover` (2 rule) · `.focus-visible-ring` (4 khai báo **Tailwind directive, không phải CSS property**) · rule rỗng `.core-dashboard-slot--deck` |
| 0.9b | Sửa comment sai | `index.css` | Comment "top stays 1.25rem for header alignment" — **sai**: heatmap lane 1.25rem vs 2 lane kia 1rem ⇒ lệch 4px, không thẳng hàng |

## 2. KHÔNG làm — 2 mục, có lý do

### 0.1 (gỡ trần 1280px) — **chờ owner**

`--layout-content-max-width: 80rem` ở `index.css:109` được dùng bởi `FullLayout.tsx:95` — **wrapper content của toàn app**, không riêng dashboard. Nới nó ảnh hưởng **mọi** màn hình, và report §8-Q2 đã nêu câu hỏi này cho owner:
- (a) trần 1280px là **cố ý** chống dashboard rộng quá?
- (b) nếu **không cố ý**, thì 304px/màn 1920px là lãng phí thật

Không tự quyết vì blast radius toàn app + **chưa có visual QA** (không có browser).

### 0.8 (xoá menu catalog chết) — **sai, đã bỏ**

Bản gốc đề xuất xoá `app/navigationCatalog.js`. **Kiểm tra thực tế cho thấy nó KHÔNG chết:**

- `package.json` khai public subpath `"./navigation-catalog"` ⇒ là API công khai của package
- `scripts/check-shell.mjs:26` import nó, `:70-73` vòng lặp assert mọi `routeId` trong catalog tồn tại trong `pageRegistry`

Xoá đi ⇒ **vỡ `npm run check:shell`**. Grep đầu chỉ trong `src/**/*.js` đã bỏ sót vì không quét `scripts/` và `package.json`.

**Bug thật phát hiện được nhờ việc này** (chưa sửa — ngoài phạm vi, script dùng chung):

> `check-shell.mjs` validate `navigationCatalog` (shape `{ id, items: [routeId] }`), còn `Sidebar.tsx` render `sidebaritems` (shape `{ group, items: [{ labelKey, path, icon }] }`). **Hai shape khác nhau, và gate không validate cái user thật bấm.** Mọi `path` trong `sidebaritems` chưa từng được đối chiếu với `pageRegistry`. Repo đã có pattern đúng cho việc này: `check-admin-spa-routes.mjs` (14 path ↔ 11 location) — chỉ là chưa áp cho menu chính.

## 3. Negative test — bằng chứng fix 0.6 có tác dụng

Mock cũ trong `alert-card-compact.component.test.tsx` **tự viết dict chứa đúng những key component cần**, nên 5 key thiếu trong `vi.js`/`en.js` vẫn test xanh.

Đã thay bằng `createTranslator("vi")` thật. Chứng minh nó bắt lỗi:

```
Xoá tạm key alert.showing khỏi vi.js  ->  Tests 1 failed | 9 passed   EXIT=1
Khôi phục vi.js                      ->  Tests 10 passed              EXIT=0
git diff --numstat vi.js/en.js       ->  5 insertions, 0 deletions  (restore sach)
```

Sau khi thêm 5 key: **10/10 PASS**.

## 4. Gate — chạy thật trên worktree này

| Gate | Lệnh | Exit | Kết quả |
|---|---|---|---|
| Type-check | `npx tsc --noEmit` | **0** | 0 lỗi |
| Lint | `npx eslint src/components/dashboard src/components/ui src/pages/DashboardPage.tsx` | **0** | 0 error |
| Shell gate | `npm run check:shell` | **0** | PASS 7/7 sub-gate |
| Test | `npx vitest run src/components/dashboard src/pages/DashboardPage.breadth-dedup.component.test.ts src/components/__tests__/main-menu-contract.component.test.tsx` | **0** | **5 file / 38 test PASS** |

**Migration:** không tạo. Không đụng model.

### CHƯA CHẠY

| Gate | Lý do |
|---|---|
| **`npm run build`** | **CHƯA CHẠY** |
| **Visual QA 3 viewport** | **CHƯA CHẠY — không có browser.** Đây là khoản trống lớn nhất: 0.2/0.2b/0.3/0.4 đều là thay đổi layout **bằng mắt**. Bắt buộc chụp 1920×1080 / 1440×900 / 1280×800 trước khi merge |
| `vitest` suite đầy | CHƯA CHẠY — chỉ chạy scope dashboard + menu contract |
| `jest` | CHƯA CHẠY |
| BE test | CHƯA CHẠY — không đụng BE |

## 5. Sửa claim sai trong report (KH-2)

`KH-2` ghi **P0 · WCAG 2.4.7 fail**: `.ring-offset-slate-950` ghi đè `box-shadow` nên focus ring luôn hiện.

**⛔ SAI.** Selector `.smart-stats-header .ring-offset-slate-950` không bao giờ match, vì token trong DOM là `focus-visible:ring-offset-slate-950` — có tiền tố variant là một phần của tên class, không phải class riêng. Token trần chỉ có ở `ui/tabs.tsx:44`, mà file đó không có class `smart-stats-header`.

Đã hạ `KH-2` P0→P3 (dead CSS) và `AC-6` P1→P3. Vẫn xoá 3 rule, nhưng **vì chết chứ không phải vì hỏng**.

**Bài học quy trình (thêm vào skill):** phải hỏi *"selector này có match element nào không"* **trước** khi lập luận về specificity hay cascade. Một rule vô hiệu không thể phá gì; lập luận specificity mà không kiểm match là lập luận về một thứ không tồn tại.

**Tự sửa 3 lần trong phiên này** khi viết script exact-token:
1. chỉ bắt `className=` ⇒ báo nhầm `glass-strong` là DEAD (thật ra dùng dạng `className:`)
2. không bắt template literal trần ⇒ báo nhầm `alert-card` là DEAD
3. sửa xong mới đối chiếu được với 6 class biết chắc là sống (`glass-strong`, `alert-card`, `alert-sym`, `alert-head`, `core-alert-list`, `panel-body`) — tất cả đều tìm thấy

⇒ **Đừng tin tool cho tới khi đã kiểm chứng nó trên một ca biết-đúng.**

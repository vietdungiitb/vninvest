# GATE — gate-honesty (bổ sung đo đạc + hồi phục regression)

**Agent:** `gate-honesty` · **Branch:** `fix/gate-honesty` · **Base:** `dev @ 2f3ac0b9`
**Ngày:** 2026-09-27 · Chạy local (user: *"GitHub đang rate-limit tạm thời, chạy local vậy"*)

Bổ sung cho `gates-wave2.md`. Ở đây chỉ ghi những gì **đo được** trong phiên này.

---

## 1. `npm run build` — lần đầu chạy, lộ ra deploy blocker

Wave 2 (PR #27) import `../../utils/alertCenterFormat.js` nhưng file thật là
`src/utils/alertCenterFormat.**ts**`:

```
Could not resolve "../../utils/alertCenterFormat.js" from "src/components/dashboard/UnifiedAlertCenter.js"
```

**Ba gate đều bỏ sót, chỉ bundler bắt:**

| Gate | Kết quả |
|---|---|
| `tsc --noEmit` | **0 lỗi** — `tsc` tự map `.js` → `.ts` theo `allowJs` |
| `vitest` | **52/52 PASS** — resolver dev/test lenient hơn Rollup |
| `npm run build` | **FAIL** (`handleInvalidResolvedId`) |

Sửa theo convention repo (6 tiền lệ trong `src` đều extensionless) → hotfix PR #28,
build lại **exit 0, 3667 modules, 36.10s**.

**⇒ `npm run build` phải là gate bắt buộc mỗi wave.** Ba wave liên tiếp đều chỉ chạy
`tsc` + `vitest`, cả ba đều xanh trên code làm hỏng build.

## 2. Test pagination flaky — đã định danh và sửa

`useAlertCenterSnapshot.pagination.component.test.ts`, **chỉ test 2** (dòng 76) fail:

```
AssertionError: expected "vi.fn()" to be called 2 times, but got 1 times
1027ms   ← = waitFor timeout 1000ms
```

`toHaveBeenCalledTimes(1)` hài lòng ngay khi mock **được gọi** — tức trước khi `await` trong
`fetchFeed` resolve và `setNextCursor` chạy. `goToNextPage` chặn bằng `if (nextCursor)`
(`useAlertCenterSnapshot.ts:107`) nên gọi lúc đó là no-op ⇒ không có call thứ 2.
Test 1 (dòng 43) **đã** chờ `hasNextPage` nên ổn định; test 2 thiếu bước đó.

Đây là **race của test, không phải của hook** — hook cư xử đúng khi `nextCursor` chưa có.

| | Trước | Sau |
|---|---|---|
| Chạy riêng | 2/3 FAIL | **5/5 PASS** |
| Mỗi lần | ~1016ms (đợi hết timeout) | ~2s |

Chạy trong full suite lại **PASS** (overhead che race) — chính là lý do gate có số liệu
đảo chiều không ổn định qua nhiều wave.

## 3. `.glass` — regression CSS do tôi ở Wave 0

Wave 0 (PR #25) xoá 4 rule khỏi `index.css` với kết luận "dead CSS", grep **chỉ dẫn dashboard**:

| Selector | Ref toàn repo | Xử lý |
|---|---|---|
| `.glass` | **26 ref / 9 file** | ❌ **xoá nhầm → đã khôi phục** |
| `.bento-card-hover` | 0 | ✅ xoá đúng |
| `.agentic-glow-cyan` | 0 | ✅ xoá đúng |
| `.focus-visible-ring` | 0 | ✅ xoá đúng |

9 file: `StockDetailTabs.js` (10), `StockContextDeck.js`, `StockInsightDeck.js`,
`PortfolioHeatmap.js`, `adminUi.tsx`, `WhaleAdvisoryPage.tsx` + 3 advisory component.
⇒ mất nền ở `/stock-detail`, `/admin`, `/ai-advisory`, `/dashboard`.

## 4. Baseline thật của visual suite

Rebuild frontend từ `94f1d5c5` (trước cả 3 wave), `project=chromium --workers=1`:

| Bản | failed | passed | skipped |
|---|---|---|---|
| Baseline `94f1d5c5` | **68** | 53 | 2 |
| Sau 3 wave (có khôi phục `.glass`) | **77** | 44 | 2 |

**8 test fail → pass** (bằng chứng `.glass` là regression thật của tôi):
5 `stock-detail-workstation` (Mobile Layout ×2, Feature Flag ×2, Accessibility),
2 `screener-p1`, 1 khác.

**17 test fail mới — 100% pixel-diff, không phải code hỏng:**

- `critical-pages.spec.ts` mobile 375x667 → `dashboard`, `alert-center`, `ai-command-center`
- `unified-layout-pilot.pilot0.spec.ts` (14) → `dashboard` @6 viewport,
  `alert-center` @4, `stocks-HPG` @3

Baseline PNG **có** commit trong git (55 file `tests/visual/*-snapshots/`) ⇒ cần
`--update-snapshots`. **CHƯA LÀM** vì `stocks-HPG` và `ai-command-center` ngoài phạm vi
3 wave — cần owner quyết.

### Sai lầm tôi đã tự sửa trong lúc điều tra

Tôi **đoán** `.glass` gây ra 78 fail. Đo thật thì nó chỉ sửa **1** test (78→77).
Phải dựng baseline mới phân định được. Nếu tôi dừng ở giả thuyết thì sẽ báo cáo sai.

## 5. Jest: 5/18 suite chết do top-level `await`

`Test Suites: 5 failed, 13 passed` nhưng `Tests: 226 passed, 226 total`
⇒ lỗi ở tầng **load module**, không phải assertion:

```
SyntaxError: await is only valid in async functions and the top level bodies of modules
  src/pages/auth/AuthPages.test.js:49
```

5 file đều có top-level `await` ở source: `AuthPages.test.js` (6 chỗ),
`dashboard_lifecycle.test.js` (3), `useSessionFacts.test.js`, `useOrderBook.test.js`,
`viewportWhaleMarkers.test.js`. `babel.config.json` có `@babel/preset-env` nhưng không có
plugin transform TLA, và plugin đó **không** có trong `node_modules`.

**KHÔNG SỬA** — cần `npm install @babel/plugin-transform-top-level-await`, mà AGENTS.md
cấp tự chạy `npm install` (junction `node_modules` dùng chung).

Cảnh báo: 5 suite này **chưa từng chạy** ở trạng thái hiện tại, nên sau khi transform được
sửa có thể lộ ra lỗi assertion thật. Không thể hứa "xanh".

## 6. Dead code lộ ra sau Wave 2 (chưa sửa, cần owner quyết)

- `useAlertCenterSnapshot` giờ chỉ còn `DashboardPage.tsx` dùng, và chỉ dùng
  `alerts`/`loading`/`error`/`loadInitial` — phần cursor pagination
  (`goToNextPage`/`goToPrevPage`/`hasNextPage`/`hasPrevPage`/`cursorHistory`) thành **dead code**.
- `extractFeedCursor` bị **nhân bản**: `useAlertCenterSnapshot.ts:38-47` và
  `AlertCenterPage.tsx:241-247` giống nhau. Docstring của hook tự thừa nhận
  *"AlertCenterPage.extractFeedCursor làm việc tương tự"*.
- `PaginationBar.jsx` dùng API offset (`onPageChange`/`hasNext`) — **không** dùng hook này.

## 7. Gate phiên này

| Gate | Exit | Kết quả |
|---|---|---|
| `npm run build` | **0** | 3667 modules, 36.10s |
| `npx tsc --noEmit` | **0** | 0 lỗi |
| `npx eslint src tests` | **0** | 0 error |
| `npm run check:shell` | **0** | PASS |
| `npx vitest run` (full) | **0** | **101 file / 676 test PASS** |
| Playwright `dashboard-alert-probe` | **0** | 3/3 |
| Playwright full suite | **1** | 77F/44P — 68 pre-existing + 17 pixel-diff |
| `npx jest` | **1** | 226/226 test pass, 5/18 suite chết |

## 8. CHƯA CHẠY

BE test (cần Postgres + `DJANGO_DEBUG=1`) · re-baseline 17 snapshot (chờ owner) ·
fix 5 jest suite (chờ `npm install`) · Lighthouse.

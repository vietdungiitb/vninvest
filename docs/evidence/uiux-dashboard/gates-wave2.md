# GATE — uiux-wave2 (Wave 2, Alert UX) — ĐÃ ĐO LẠI BẰNG PLAYWRIGHT

**Agent:** `uiux-wave2` (PR #27) + `gate-honesty` (bổ sung đo đạc)
**Base:** `dev @ 0b326bbe` → hotfix `b26e9f05`
**Ngày:** 2026-09-27
**Phạm vi:** chấm dứt pill-soup + curation 5 alert. 0 đổi API, 0 migration, 0 đụng BE.

---

## 1. Đã làm (7/9)

| # | Việc | File |
|---|---|---|
| 2.1 | `sortAlertsByPriority` + `topAlerts` | `utils/alertDedup.js` |
| 2.2 | 4 pill viền → 2 badge + 1 dòng typography | `UnifiedAlertCenter.js` |
| 2.3 | Bỏ filter trùng; `severityCounts` đếm trên list chưa lọc | `DashboardPage.tsx` |
| 2.5 | Xoá 2 nút phân trang → link "Xem thêm N cảnh báo" | `UnifiedAlertCenter.js` |
| 2.6 | 8 family dùng `alertCenter.fam*`; xoá 5 key chết `alert.source.*` | + `vi.js`/`en.js` |
| 2.7 | Render `title` + `isDuplicateSummary` + `freshness_state` | `UnifiedAlertCenter.js` |
| 2.8 | Xoá 21 prop chết + import thừa + `activeTab` | 2 file |
| 2.9 | Sửa 3 test khoá cứng 20 | xem §4 |

## 2. Số đo THẬT (Playwright) — đính chính §3

Bản đầu của tài liệu này và PR #27 ghi **"~130px → ~93px"**. Đó là **ước lượng, và sai cả hai đầu**.
Đã chạy Playwright thật (docker stack còn sống, Chromium đã tải, có `user.json`), dựng lại **cả hai vế**:

| Metric | Wave 1 (trước) | Wave 2 (sau) | Δ |
|---|---|---|---|
| `cardHeights` 1-col (343px) | `[125,125,…]` | `[98,98,…]` | **−27px (−21.6%)** |
| `firstCardH` 2-col (484px) | `100` | `98` | −2px |
| `cardCount` | `20` | `5` | −75% |
| `laneH` | `720` | `701` | −19px |
| `counter` | — | `Hiển thị 5/20` | |
| `activeChips` | — | `["Tất cả (20)"]` | đếm trên list chưa lọc ✓ |

Ở layout 2-col cải thiện chỉ ~2px — chip vốn đã vừa đúng 1 hàng ở bề rộng đó. Giảm rõ chỉ ở 1-col.

Assertion trong `dashboard-alert-probe.spec.ts` đã siết theo số đo thật: `cardCount === 5`,
`cardHeights` mỗi cái `<= 110`, `firstCardH <= 100`.

## 3. Baseline thật của toàn bộ visual suite

Frontend rebuild từ `94f1d5c5` (trước cả 3 wave) rồi chạy `project=chromium --workers=1`:

| Bản | failed | passed | skipped |
|---|---|---|---|
| Baseline `94f1d5c5` | **68** | 53 | 2 |
| Sau 3 wave | **77** | 44 | 2 |

**8 test chuyển từ fail → pass**: 5 `stock-detail-workstation` (Mobile Layout ×2, Feature Flag ×2, Accessibility),
2 `screener-p1`, 1 khác.

**17 test fail mới — 100% là pixel-diff 2 file snapshot**, không phải code hỏng:

- `critical-pages.spec.ts` mobile 375x667: `dashboard`, `alert-center`, `ai-command-center`
- `unified-layout-pilot.pilot0.spec.ts` (14): `dashboard` @1920/1440/1280/1024/768/390,
  `alert-center` @1920/1440/1280/1024/390, `stocks-HPG` @1920/1440/768

Baseline PNG **có** được commit (55 file trong `tests/visual/*-snapshots/`) ⇒ cần `--update-snapshots`,
**không** sửa code. **CHƯA QUYẾT** vì `stocks-HPG` và `ai-command-center` không nằm trong phạm vi
3 wave — cần owner quyết có chấp nhận thay baseline cho các trang đó hay không.

## 4. 🔴 Regression CSS do tôi: `.glass`

Wave 0 (PR #25) xoá 4 rule khỏi `index.css` với kết luận "dead CSS" — **grep chỉ dẫn dashboard**:

| Selector | Ref toàn repo | Kết luận |
|---|---|---|
| `.glass` | **26 ref / 9 file** | ❌ **xoá nhầm** |
| `.bento-card-hover` | 0 | ✅ xoá đúng |
| `.agentic-glow-cyan` | 0 | ✅ xoá đúng |
| `.focus-visible-ring` | 0 | ✅ xoá đúng |

`.glass` dùng ở `StockDetailTabs.js` (10), `StockContextDeck.js`, `StockInsightDeck.js`,
`PortfolioHeatmap.js`, `adminUi.tsx`, `WhaleAdvisoryPage.tsx` + 3 advisory component.
Xoá nó làm mất nền ở `/stock-detail`, `/admin`, `/ai-advisory`, `/dashboard` — và **5 test
`stock-detail-workstation` chính là bằng chứng**, chúng fail rồi pass lại sau khi khôi phục.

Bài học: dò CSS chết phải grep **toàn repo**, đúng như `AGENTS.md` đã ghi — tôi đã viết luật đó
rồi không làm theo.

## 5. Test đã sửa — đổi hợp đồng, không sửa cho xanh

3 test assert `cardCount === 20` — chính là test bảo vệ hành vi "dump 20 dòng vào widget tóm tắt"
đang bị bỏ. Đổi sang `<=5 && >0`, thêm test chứng minh xếp theo **ưu tiên** chứ không theo thời gian,
ghi rõ trong comment cả 3 file.

## 6. 🔴 `tsc` + `vitest` đều bỏ sót lỗi phá build

`npm run build` fail trên `dev` sau PR #27:

```
Could not resolve "../../utils/alertCenterFormat.js"
```

File thật là `src/utils/alertCenterFormat.**ts**`, import viết `.js`.

| Gate | Kết quả |
|---|---|
| `tsc --noEmit` | **0 lỗi** (`tsc` tự map `.js`→`.ts` theo `allowJs`) |
| `vitest` | **52/52 PASS** (resolver dev/test lenient hơn) |
| `npm run build` | **FAIL** |

⇒ **`npm run build` phải là gate bắt buộc mỗi wave**, không phải gate "cho có". Đã hotfix PR #28.

## 7. Sai sót quy trình của tôi (ghi rõ)

1. **Claim append sau khi đã sửa 7 file** (protocol: claim trước dòng đầu tiên).
2. **Làm hỏng file 1 lần**: `Set-Content -Value <array> -NoNewline` nối 466 dòng thành 1 dòng.
   Phát hiện ngay khi grep, khôi phục `git checkout --`, làm lại bằng `edit`.
3. **`-replace` toàn file tạo 3 dòng nhân bản** — `tsc` không bắt (optional-call lặp vẫn hợp lệ về kiểu),
   chỉ test mới phát hiện.
4. **Con số "~130px → ~93px" publish khi chưa đo** — sai cả hai đầu. Đã đính chính ở §2.
5. **Giả thuyết "`.glass` gây 78 fail"** — sai, chỉ 1 test. Đã đo baseline để kiểm chứng thay vì kết luận.

## 8. Gate

| Gate | Exit | Kết quả |
|---|---|---|
| `npm run build` | **0** | 3667 modules, 36.10s |
| `npx tsc --noEmit` | **0** | 0 lỗi |
| `npx eslint src tests` | **0** | 0 error |
| `npm run check:shell` | **0** | PASS |
| `npx vitest run` (full) | **0** | **101 file / 676 test PASS** |
| Playwright `dashboard-alert-probe` | **0** | 3/3, số đo §2 |
| Playwright full suite | **1** | 77 failed / 44 passed — **68 lỗi pre-existing, 17 pixel-diff cần re-baseline** |
| `npx jest` | **1** | 226/226 test pass nhưng **5/18 suite chết** (top-level `await`) |

## 9. CHƯA CHẠY / CHƯA LÀM

| Việc | Vì sao |
|---|---|
| Re-baseline 17 snapshot | Chờ owner quyết (chạm cả trang ngoài phạm vi) |
| Fix 5 jest suite chết | Cần `@babel/plugin-transform-top-level-await` = **`npm install`**, AGENTS.md cấp tự chạy |
| 2.4 read-state | Cần endpoint BE + quyết định sản phẩm |
| 0.1 `--layout-content-max-width` | Chờ owner (ảnh hưởng toàn app) |
| BE test | Cần Postgres + `DJANGO_DEBUG=1` |

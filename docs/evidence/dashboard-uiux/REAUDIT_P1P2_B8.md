# RE-AUDIT B8 — Dashboard wave 2 (P1 + P2 + Q4) đối chiếu code thật

> **Ngày:** 2026-11-18 · **Auditor:** subagent độc lập, **CHỈ ĐỌC** (không sửa code runtime; chỉ ghi file báo cáo này).
> **Revision cuối được audit:** `261d7ef2a03f3a425ea0cc8aceb7b3f90eceabb2` · branch `feat/dash-p1p2-uiux` · `git status --short` sạch.
> **Base đối chiếu:** `dev @ 6aa570fa2` (đã gồm PR #429 / P0). **AC nguồn:** `docs/PLAN_DASHBOARD_P1P2_20261118.md:19-52` · TDD `§2:54-69` · Gates `§3:71-75`.
> **B3/B4 nguồn:** `docs/evidence/dashboard-uiux/AUDIT_PLAN_P1P2_B3.md:1-92` (NEED_REVISION 5 objection → B4 AGREE, 3 reservation ở `:88-91`).
> **Lessons áp dụng:** `[L-V01, L-V02, L-V04, L-T02, L-T01]` — checklist: tự mở đúng file khi trích `file:line` (L-T02); không tin `PASS`/số kế thừa khi chưa tự đếm (L-V02/L-V04); mọi con số kèm lệnh tái tạo (L-V01); ghi `CHƯA CHẠY` khi không tự chạy được.

---

## 0. Verdict

**AGREE (reservation)**

- **Mức CODE: PASS.** 12/12 mục P1/P2 + Q4 đều có thay đổi thật trong code, khớp AC, kèm `file:line` tự mở đọc ở §1. 3 reservation B4: (a) và (b) **đóng hoàn toàn**; (c) **đóng một phần** (giá trị đã định nghĩa và dùng, nhưng số đo thực chưa có bằng chứng — xem M2).
- **Regression Router:** không còn fail thực trong suite hiện tại (§3). Có 1 rủi ro phòng thủ còn sót (m1) nhưng không gây lỗi ở revision này.
- **Mức EVIDENCE: có 2 major (M1, M2)** — không phải lỗi code, nhưng phải đóng trước B9/handoff. Theo tiền lệ `REAUDIT_B8.md:15` (P0 wave cũng AGREE với 1 major evidence), các major này **không đổi verdict code**, nhưng là điều kiện để coi hồ sơ hoàn chỉnh.
- **Blocker:** không có. **CHƯA CHẠY (chấp nhận theo luật):** visual QA/screenshot, E2E Playwright, a11y runtime, jest `npm run test` — auditor chỉ đọc, không tự chạy gate nào.

---

## 1. Verify 12 mục P1/P2 + Q4 (mỗi mục kèm `file:line` tự mở)

| ID | AC (plan) | Bằng chứng code thật | Kết luận |
|---|---|---|---|
| **A1 P1-1** | 5 pill wrap, không cắt | `index.css:625-632` — `.seg { display:inline-flex; flex-wrap:wrap; gap:4px; max-width:100% }` (`:629` = `flex-wrap: wrap`, không còn `nowrap`/`overflow-x:auto`). 5 button vẫn map đủ tại `UnifiedAlertCenter.js:263-284`. Test source-scan `wave2-source-contracts…test.ts:9-13`. | **ĐÓNG** |
| **A2 P1-2** | `bodyText` không lặp title, hiện `-26.88%` | `UnifiedAlertCenter.js:370-377` — `bodyText = summaryText && !isDuplicateSummary(titleText, summaryText) ? summaryText : titleText` (bỏ ghép `` `${titleText} — ${summaryText}` ``); `:464` đổi `truncate` → `line-clamp-2`. `isDuplicateSummary` (`utils/alertCenterFormat.ts:113-117`) chỉ so bằng nhau sau normalize ⇒ ví dụ plan (title ≠ summary) trả summary chứa `%`. Test `:15-19`. | **ĐÓNG** |
| **A3 P1-7** | SPA Link + đủ 4 prop + wrapper read/mute | `UnifiedAlertCenter.js:8` `Link, useInRouterContext`; `:114-118` bridge; `:244` + `:484` dùng `AlertLink`/`alertLinkProps` (có router → `to`, không router → `href`). `DashboardPage.tsx:385-404`: `readAlertIds` `:388`, `unreadCount` `:389-391` (⇒ `hasReadState=true` tại `UnifiedAlertCenter.js:126`), `markAlertAsRead` `:392-393` → `handleAcknowledge({ alert_id: id })`, `muteSymbolFor30m` `:394-395` → `handleMute({ symbol })`. Test `:21-29`. | **ĐÓNG** (xem reservation b) |
| **B1 P1-3** | header heatmap wrap, subtitle đủ | `PortfolioHeatmap.js:524` `panel-head … flex flex-wrap … gap-3`; `:528` `<h3>` 1 dòng; `:529-532` subtitle `break-words` (bỏ `truncate`) nối đủ scope time + grouped + fallback; `:536` cụm nút `shrink-0`. Test `:31-35`. | **ĐÓNG** |
| **B2 P1-4** | `--dash-chrome` có thật, lane vừa viewport, giữ `stretch` | `index.css:458-460` `.core-dashboard-page { --dash-chrome: 296px; }`; `:477` `max-height: min(720px, calc(100dvh - var(--dash-chrome)))`; `:512` `align-items: stretch` **vẫn giữ** (đúng yêu cầu không đảo lại `start`); `.panel-body` tự cuộn `index.css:634+`. Test `:37-42`. **Nhưng số đo chưa có evidence** → M2. | **ĐÓNG code / reservation (c) chưa đóng evidence** |
| **B3 P2-1/Q4** | popover + Escape + symbol link + sunburst isOther + resize | `PortfolioHeatmap.js:494-505` `handleClick` → `setSelectedDetail` (tile thường **không** navigate; `:496-499` nhánh `isOther` vẫn `setShowAllTiles(true)` = regression guard); `:486-492` Escape đóng; `:661-668` overlay `role="dialog"`/`aria-modal`; `:672-675` nút mã → `handleNavigateToStock` `:438-440` → `/stocks/:symbol`; `:100-120` `formatHeatmapTooltip` nhánh `isOther` `:106-112`, dùng chung cho treemap `:349` **và sunburst `:392`** (bản cũ sunburst thiếu); `:324-329` nhãn "Khác" treemap. `useChartResize.js:17-22` `resizeEChart` gọi `ref.current.getEchartsInstance().resize()` (fallback `ref.current.resize()`), được `useEChartsResize` `:69-70` dùng tại `PortfolioHeatmap.js:232`. Test `wave2:44-55` + `use-chart-resize…test.ts:1-16`. | **ĐÓNG** |
| **C1 P1-5** | bell chỉ mở menu, status từ context, i18n | `Header.tsx:349-370` `DropdownMenuTrigger` **không còn `onClick navigate`**; chỉ menu item `:378-380` đi `/alert-center`; `:374,376` dùng `t('layout.notifications')` / `t('layout.noNotifications')` (xóa hardcode `"No new notifications"`); `:90-94` `useRealtimeContext()?.feed?.realtimeStatus` → derive `wsStatus`, **không** gọi `useRealtimeFeedFromManager` (sẽ register consumer mới `RealtimeContext.js:113-138`). Key 2 locale `layout.js:20` (vi/en). Test `wave2:57-62`. Minor: m2. | **ĐÓNG** |
| **C2 P1-6** | SmartStats dưới Header | `SmartStatsHeader.js:115` `smart-stats-header sticky top-[4.5rem] z-20`; `Header.tsx:230` `sticky top-0 z-30`. Test `wave2:64-66`. | **ĐÓNG** |
| **C3 P2-5** | breadcrumb có nhãn, chỉ VI/EN, search mobile | `Header.tsx:33-44` `DashboardBreadcrumbLabel` map `dashboard → 'Tổng quan'`, dùng tại `:277`; `:345-346` chỉ `VI`/`EN` (không emoji 🇻🇳); `:283` search `block relative min-w-[7rem]` (bỏ `hidden md:block`). Test `wave2:68-73`. Minor: m3. | **ĐÓNG** |
| **D1 P2-2** | không alert lạ lúc mount, bỏ nút chết + key rác, rescan giữ | `AIAdvisorAlertPanel.js:61-75` init `[]`, filter propAlerts chỉ `ai_alert`/`ai_suggest`; `:167-182` nút header chỉ `disabled: loading`; `:200-225` empty state không còn nút `disabled: true`/`viewPrevSession`, rescan tại `:222` dùng `t('aiAdvisor.panel.rescan')`. Diff i18n: `vi/en/aiAdvisor.js` xóa `viewPrevSession` (0/1 mỗi file), giữ `rescan: 'Quét lại'`/`'Rescan'` tại `:10`; grep toàn `src` không còn call-site `viewPrevSession`. Test `wave2:75-81`. | **ĐÓNG** |
| **D2 P2-3** | tab/badge i18n, `t` xuống AI panel, mã link, placeholder giữ | `CoreDashboardPositionDeck.tsx:109-114` 4 tab `t('dashboard.tab*')`; `:275-279` 3 badge `t('dashboard.source*')`; `:544` truyền `t={t}` vào `AIAdvisorDeckPanel` — component nhận và dùng ở `AIAdvisorDeckPanel.jsx:14,69-73,98`; `:388-394` `<Link to={/stocks/${encodeURIComponent(row.symbol)}}>`; `:525-530` tab Biểu đồ giữ placeholder Owner Q3. Key `vi/dashboard.js:24-30` + `en/dashboard.js:21-27` đủ 2 locale. Test `wave2:83-88`. Minor: m4. | **ĐÓNG** |
| **E1 P2-4** | breadth ưu tiên pct, watchlistGroups 2 nơi, status dịch, giữ 2 hook | `utils/dashboardBreadth.js:6-24` `change = Number(q.change_pct ?? q.change ?? q.change_value ?? 0)` (`:17` ⇒ `change_value=0, change_pct=2.1` → up); `:26-35` `STATUS_LABELS` + `formatRealtimeStatus`. `DashboardPage.tsx:226-229` dùng helper; `:243-248` `watchlistGroups` vào `heatmapSymbols`; `:457` truyền `watchlistGroups` vào deck (không còn `watchlistGroups={watchlists}`); `:209-214` **giữ cả 2 hook** + comment giải thích; `:351-357` banner Việt, `:354` gọi `formatRealtimeStatus`. Test `dashboard-breadth…test.ts:4-23` + `wave2:90-94`. | **ĐÓNG** |

---

## 2. Đóng 3 reservation B4 (`AUDIT_PLAN_P1P2_B3.md:88-91`)

| # | Reservation | Kết quả verify B8 | Trạng thái |
|---|---|---|---|
| (a) | Export `useRealtimeContext` | `RealtimeContext.js:7-10` `export function useRealtimeContext() { return React.useContext(RealtimeContext); }` — **không** đăng ký consumer mới. `RealtimeContext.d.ts:28-29` có khai export tương ứng. `Header.tsx:14` import, `:90` dùng. | **ĐÓNG** |
| (b) | Wrapper scalar→object | Component gọi `markAlertAsRead(alertId)` scalar (`UnifiedAlertCenter.js:391,425`) / `muteSymbolFor30m(alert.symbol)` (`:408`). `DashboardPage.tsx:392-395` bọc thành `{ alert_id: id }` / `{ symbol }`; hook đọc đúng field tại `useAlertCenterActions.ts:50` (`alert_id ?? event_id`) và `:71` (`alert.symbol`). Không còn no-op im lặng. | **ĐÓNG** |
| (c) | `--dash-chrome` đo thực, ghi evidence | Giá trị **đã định nghĩa** `index.css:459` (296px) và **được dùng** `:477`; `align-items: stretch` giữ `:512`. **Nhưng** comment `index.css:454-457` tự thừa nhận *"cần đối chiếu computed style trên staging (visual QA)"*; grep toàn `docs/` cho `296px` / `--dash-chrome` chỉ trúng plan + B3 audit + archive, **không có file evidence nào ghi số đo thực**. | **ĐÓNG MỘT PHẦN → M2** |

---

## 3. Regression "hook/element cần Router render ngoài `<Router>`" (yêu cầu riêng)

Grep mọi import `react-router-dom` trong các file branch này đổi (`git diff --name-status 6aa570fa2..HEAD`):

| File | Import | Đánh giá |
|---|---|---|
| `UnifiedAlertCenter.js:8` | `Link, useInRouterContext` | Đã bridge `:114-118` — an toàn (fix của HEAD `261d7ef2a`). |
| `SmartStatsHeader.js:2` | `useInRouterContext, useNavigate` | Đã bridge `:259-269` — an toàn (fix P0 `2927ced2a`). |
| `CoreDashboardPositionDeck.tsx:2` | `Link` — **MỚI trong wave này** (diff `:2`, `:388-394`) | Không bridge. **Nhưng** không test nào mount trực tiếp component này (`grep` test chỉ thấy pure-helper import từ `heatmap-scale/heatmap-sizing/wave2-source-contracts`; `DashboardPage` được mount qua `wrapRoute` trong `page-heading-fu02c…test.tsx:18,116,187-188` = trong `MemoryRouter`). ⇒ **không gây fail ở revision này**; rủi ro phòng thủ khi có test mount deck ngoài Router → m1. |
| `PortfolioHeatmap.js:7` | `useNavigate` — **có sẵn trước wave** (không nằm trong diff) | Không bridge, nhưng chưa từng gây lỗi; `handleClick` giờ mở popover, navigate只剩 ở nút mã trong popover (đúng AC). |
| `Header.tsx:2` | `useLocation, useNavigate` — có sẵn | Test `Header.component.test.tsx:21` import `MemoryRouter` — an toàn. |

**Kết luận:** hai lần regression đã gặp (`useNavigate` ở P0, `<Link>` ở wave 2) **không còn fail thực** ở `261d7ef2a`; head commit sửa đúng chỗ AlertCenter. Không có blocker.

---

## 4. Đối chiếu bằng chứng VPS (theo yêu cầu)

Tuyên bố cần đối chiếu: *full suite 196 file / 1299 test · 5 fail SSE baseline · build exit 0 · worktree đã dọn*.

**Tự kiểm được (không chạy lại VPS — auditor chỉ đọc):**

- `docs/evidence/dashboard-uiux/gates.md:40` (wave P0): **193 file / 1281 test**, 5 fail = đúng 2 file SSE; `:41` baseline `dev @ 577ddf646` → **5/5 fail y hệt**; `:43` build exit 0; `:45` lệnh dọn worktree.
- Wave này thêm đúng **3 file test mới**: `wave2-source-contracts…test.ts` = **12** `it(` (đếm bằng `Select-String '\bit\('`), `use-chart-resize…test.ts` = **2**, `dashboard-breadth…test.ts` = **4** → **+18 test**.
- ⇒ `193 + 3 = 196` file, `1281 + 18 = 1299` test. **Số học khớp 100%** với baseline P0 đã có evidence. Không có test file nào bị xóa trong diff (`git diff --name-status` chỉ có `A` cho 3 file test, không có `D`).
- ⇒ Con số 196/1299 là **nhất quán với nền tảng có thật**; không phát hiện mâu thuẫn.

**Điểm chưa khớp về evidence:** toàn repo **không có file tài liệu nào ghi kết quả 196/1299 của wave này**. `gates.md` là của wave P0 (193/1281); commit body `c2a06706d`/`261d7ef2a` chỉ ghi TDD/tsc/lint/tokens + "4 pre-existing dev baseline FAIL (Entry 527)", **không** ghi full-suite VPS. Theo `documentation-evidence-rule` (chat-only ≠ evidence) và `workflow-dev-loop` luật 6 → **M1**.

---

## 5. Findings

### Blocker
*Không có.*

### Major (evidence/quy trình — không phải code)

**M1 — Kết quả VPS 196 file/1299 test của wave này chỉ tồn tại ở chat, không có file evidence trong repo.**
- Bằng chứng: `git grep -E "1299|196 file"` trên `HEAD -- docs` → 0 trúng liên quan dashboard; `docs/evidence/dashboard-uiux/gates.md:1,40` ghi rõ phạm vi `feat/dash-p0-uiux` 193/1281; commit `c2a06706d`/`261d7ef2a` bodies không nhắc full suite.
- Tác động: số liệu đúng về mặt số học (§4) nhưng không ai tái tạo được lệnh/exit-code/revision của lần chạy; vi phạm quy tắc evidence. Ảnh hưởng B9/handoff, không ảnh hưởng đúng sai của code.
- Đề xuất: implementer/coordinator append mục "Wave P1/P2 — VPS full suite" vào `docs/evidence/dashboard-uiux/gates.md` (hoặc file riêng) với lệnh + exit code + revision + baseline diff + lệnh dọn worktree. **Owner: implementer/coordinator.**

**M2 — Reservation B4(c): số đo `--dash-chrome: 296px` chưa có bằng chứng đo thực.**
- Bằng chứng: `docs/PLAN_DASHBOARD_P1P2_20261118.md:13,30` và `AUDIT_PLAN_P1P2_B3.md:91` yêu cầu "đo thực (computed style/Chrome) ghi vào evidence, không suy diễn"; code `index.css:454-457` tự ghi "cần đối chiếu computed style trên staging (visual QA)"; grep `docs/` không thấy số đo nào.
- Tác động: cấu trúc CSS đúng (giá trị được định nghĩa và dùng, `stretch` giữ nguyên), nhưng AC B2 "legend và tile đáy nằm trong khung nhìn đầu ở viewport 900px" **chưa được xác minh runtime**. Không phải lỗi code; là reservation chưa đóng đúng quy trình.
- Đề xuất: ghi số đo computed style (`Header` height, `h1`, SmartStats, padding → tổng chrome) vào evidence, hoặc nếu staging chưa deploy branch này thì ghi rõ `CHƯA CHẠY` + quyết định giữ 296px kèm rationale. **Owner: implementer.**

### Minor

**m1 — Bridge Router chưa áp dụng cho `<Link>` mới trong deck.** `CoreDashboardPositionDeck.tsx:2,388-394` dùng `<Link>` trực tiếp, trong khi 2 component khác đã dùng `useInRouterContext`. Không gây fail hiện tại (§3), nhưng test mount deck ngoài Router sẽ nổ invariant. Đề xuất: cân nhắc dùng pattern `inRouter ? Link : 'a'` như `UnifiedAlertCenter.js:114-118` nếu deck đi vào unit test độc lập.

**m2 — Nhãn trạng thái mạng chưa trung thực/i18n.** `Header.tsx:334` hardcode `'Online'/'Offline'`; khi `feedStatus` rỗng → `wsStatus='connecting'` (`:92-94`) nhưng vẫn hiển thị `'Offline'` + chấm đỏ — không đúng yêu cầu "nhãn trung tính khi không có status" của plan `:36`, và là chuỗi Anh cứng. Đề xuất: thêm nhãn third state qua `layout.*`.

**m3 — Breadcrumb cố định tiếng Việt.** `Header.tsx:36-43` map `dashboard → 'Tổng quan'` bất kể `locale`; ở `en` vẫn hiện "Tổng quan". AC C3 chỉ yêu cầu không để chữ thường `dashboard` (đã đạt), nên không chặn; nên dùng `t()` nếu muốn nhất quán D2.

**m4 — `scopeOptions` trong deck vẫn hardcode VI.** `CoreDashboardPositionDeck.tsx:133-136` (`'Đang nắm giữ'`, `'Theo dõi riêng'`, `'Watchlist'`, `'Tất cả'`) nằm ngoài AC D2 (chỉ 4 tab + 3 badge), nhưng lệch mục tiêu i18n. Đề xuất: đưa vào backlog.

**m5 — TDD phần lớn là source-scan.** `wave2-source-contracts…test.ts:8-95` assert trên nội dung tệp (được plan `:57-64` cho phép làm fail-before); chỉ `dashboard-breadth`/`use-chart-resize` là test hành vi thuần. Theo L-V04, source-scan không chứng minh runtime — đã có `CHƯA CHẠY` visual/E2E ở §6, nên không đánh giá cao hơn minor.

---

## 6. CHƯA CHẠY (báo đúng, không suy diễn)

- **Visual QA / screenshot** triad @ viewport 900px (cần để đóng M2) — CHƯA CHẠY; staging theo `gates.md:49` vẫn chạy code khác.
- **E2E Playwright** `/dashboard` + `/alert-center` (popover, Escape, symbol link) — CHƯA CHẠY.
- **a11y runtime** (`role="dialog"`, focus ring, status label) — CHƯA CHẠY; jsdom test chỉ phủ `role`/source.
- **`npm run test` (jest)** — CHƯA CHẠY (theo tiền lệ `gates.md:52`).
- Auditor B8 **không tự chạy** tsc/lint/vitest/build/VPS (đọc-only); các con số §4 là tự đếm/tự đối chiếu tài liệu, không phải kết quả thực thi của auditor.

---

## 7. Kết luận & next step

- 12/12 mục P1/P2 + Q4 **đã đóng thật trong code** tại `261d7ef2a`; chất lượng fix nhất quán với P0 (dùng hook/adapter có sẵn, helper thuần, bridge Router, giữ quyết định CSS cũ). Không có blocker, không có major ở mức CODE.
- **Verdict AGREE (reservation)** với điều kiện trước B9: đóng M1 (ghi evidence VPS 196/1299) và M2 (ghi số đo `--dash-chrome` hoặc ghi rõ `CHƯA CHẠY` + rationale). m1–m5 đưa backlog, không chặn merge.
- **Owner:** implementer `feat/dash-p1p2-uiux` (M1, M2) + coordinator (kiểm tra evidence trước khi claim `done` / prepend Entry ledger). Auditor B8 **không tự append ledger** (đúng tiền lệ `REAUDIT_B8.md:142`) để tránh đụng Entry của coordinator.

# GATE — uiux-wave1 (Wave 1, sửa chỗ "nói dối dữ liệu")

**Agent:** `uiux-wave1` · **Branch:** `feat/uiux-wave1` · **Base:** `dev @ 3e78169d`
**Worktree:** `C:\Mujoco Projects\agent-uiux-w1` · **Ngày:** 2026-09-27
**Phạm vi:** 8 lỗi trung thực dữ liệu trên dashboard. **0 đổi API, 0 migration, 0 đụng BE.**

---

## 1. Đã sửa (8)

### 1.1 Dark-flow alert mất `severity`/`direction`/`title`/`body`/`triggered_at`

`useRealtimeFeedCore.js:264` `normalizeDarkFlowAlert` bỏ sót **5 field** mà BE gửi cho **mọi** loại alert (`signal_intelligence/broadcasting.py:78-85`).

Hệ quả trước đây: `severity === undefined` ⇒ **không vào pill lọc nào**, rơi về viền xám mặc định, **không có dòng mô tả nào**, và nhãn nguồn rơi về "Hệ thống" (sai).
Thêm: `severity`, `direction`, `title`, `body`, `triggered_at`, `value`, `confidence_level`.

### 1.2 `lastScanAt` bịa thời gian quét

`AIAdvisorAlertPanel.js` khi API **không** trả `last_scan_at` thì gán `Date.now()` ⇒ UI hiện "Lần quét gần nhất 22:20" trong khi **chưa có lượt quét nào**. Comment trong code tự nhận "không bịa API" — code làm ngược lại.
Sửa: gán `null` ⇒ nhánh `aiAdvisor.panel.noScan` (đã tồn tại) **trở nên reachable**.

### 1.3 `"0 tín hiệu"` nằm cứng trong chuỗi dịch

`lastScan: 'Lần quét gần nhất {time} · 0 tín hiệu'` — số 0 nằm trong template nên không bao giờ phản ánh thực tế.
Sửa: `{count}` + truyền `alerts.length`.

### 1.4 Nút "Chạy phân tích" không chạy phân tích

`onClick: fetchFeed` — **y hệt** nút refresh ở header. Nhãn hứa 1 hành động, code làm hành động khác.
Sửa: đổi nhãn thành `rescan` ("Quét lại"/"Rescan"). Xoá key `runAnalysis` (0 ref sau khi đổi).

### 1.5 Badge "Dữ liệu Realtime" hiện vô điều kiện

`WhaleAnalyticsTab.jsx` render "Xác thực SSOT" + "Dữ liệu Realtime" **ngay cạnh** nhánh `isStale`/`isDegraded` ⇒ khi dữ liệu chậm, UI nói **đồng thời** "Dữ liệu chậm" và "Realtime".
Sửa: 2 badge chỉ hiện khi `!isStale && !isDegraded`; ngược lại hiện `notRealtime` ("Không realtime"/"Not realtime").

### 1.6 "Cập nhật vừa xong" là thông tin sai

`SmartStatsHeader.js` đọc `summary.updated_at` — BE **không có field này** (`portfolio_analytics_views.py:134-139` chỉ có `as_of` = `today.isoformat()`). Rơi về `Date.now()` ⇒ nói "vừa xong" **mãi mãi**, và `isStale` luôn false.

Sửa, tách 2 nguồn thời gian vì chúng **không cùng loại**:
| Nguồn | Kiểu | Hiển thị |
|---|---|---|
| `updatedAt` | timestamp | "Cập nhật Xs trước" |
| `asOf` | **ngày** `YYYY-MM-DD` | "Dữ liệu ngày DD/MM/YYYY" |
| không có | — | "Chưa có giờ cập nhật" — **không** dùng giờ render |

> Nếu render ngày bằng relative time thì hôm nay 00:00 sẽ thành "20 giờ trước" — sai theo cách khác. Đó là lý do tách.

Nối `asOf` từ `DashboardPage.tsx:341`.

### 1.7 `total_market_value` là **string** ⇒ mất đơn vị + CTA chết

BE trả `str(round(..., 2))` = `"0.00"`. `"0.00" || 0` → `"0.00"` (truthy) ⇒ `!marketValue` = false ⇒ **empty-state CTA không bao giờ hiện**; `"0.00" > 0` = false ⇒ **mất chữ `đ`** khi giá trị = 0.
Sửa: `Number(...) || 0` và hiện `đ` khi `!loading` (thay vì `> 0`).

### 1.8 Badge "20" không phải số chưa đọc

`DashboardPage` không truyền `unreadCount`/`readAlertIds`/`markAlertAsRead` ⇒ `unreadAlertCount` = **tổng số alert**, nhưng tooltip ghi "{count} chưa đọc".
Sửa: badge hiện `totalTooltip` ("N cảnh báo trong danh sách") + đổi tone từ đỏ sang trung tính (đỏ trông như báo động, sai nghĩa với tổng số). Thêm `hasReadState` để `isUnread` không phụ thuộc vào Set rỗng. Xoá key chết `unreadTooltip`.

## 2. Test đã sửa theo (vì nó mã hoá chính cái lỗi)

`alert-card-compact.component.test.tsx` assert `title="2 chưa đọc"` — tức **bảo vệ cái nói dối**. Đã đổi thành assert `totalTooltip` + assert `unreadTooltip` **không** còn, và thêm 1 test cho trường hợp có read-state thật.

## 3. Gate

| Gate | Lệnh | Exit |
|---|---|---|
| Type-check | `npx tsc --noEmit` | **0** |
| Lint | `npx eslint src/components/dashboard src/features/dashboard src/hooks/useRealtimeFeedCore.js src/pages/DashboardPage.tsx` | **0** |
| Shell gate | `npm run check:shell` | **0** |
| Test | `npx vitest run src/components/dashboard src/features/dashboard` | **0** — 26/26 |
| i18n parity | đếm tay 5 key mới | OK, đủ ở vi + en |

## 4. Test flaky — CHỨNG MINH pre-existing, KHÔNG phải do PR này

`useAlertCenterSnapshot.pagination.component.test.ts` fail khi chạy full suite. Đã kiểm chứng 3 bước:

| Cách chạy | worktree của tôi | `dev` HEAD sạch, CÙNG scope |
|---|---|---|
| Riêng file | **3/3 PASS** (3 lần liên tiếp) | **3/3 PASS** |
| Full scope (15 file) | 1 failed \| 76 passed | **1 failed \| 14 passed** (2/2 lần) |

⇒ **Cùng một test fail trên `dev` sạch.** Đây là flake đã ghi trong `AGENTS.md` ("fail không ổn định trong full suite"), **không** phải hậu quả của PR này. Cần ticket riêng.

### 🔴 Tôi đã kết luận sai một lần trong lúc làm

Lần đầu chạy riêng file thấy đỏ, tôi kết luận **"tôi đã gây ra"**. Chạy lại 3 lần → 3/3 PASS. Kết luận đúng chỉ đến khi chạy lặp + so sánh với HEAD sạch.
⇒ **Một lần chạy đỏ không đủ để quy kết nguyên nhân.** Đã ghi vào bài học bên dưới.

## 5. CHƯA LÀM

| Mục | Lý do |
|---|---|
| **1.9** — BE trả thật 4 KPI risk (`sharpe`/`beta`/`alpha`/`maxDD`) | `portfolio_analytics_views.py` là file 2780 dòng, cần implement + test BE. `AGENTS.md` yêu cầu khai claim riêng. PR này đã đủ 8 mục — tách ticket |
| **1.10** — `formatTimeAgo` → `Intl.RelativeTimeFormat` | Cần cả `localeTag`; chạm nhiều call site. Tách ticket |
| Visual QA | Không có browser |
| `npm run build` · vitest suite đầy · jest · BE test | CHƯA CHẠY |

## 6. Bài học

1. **Một lần chạy đỏ không đủ kết luận.** Phải chạy lặp + đối chiếu HEAD sạch cùng scope.
2. **`Date.now()` là một dạng nói dối.** Cả 1.2 và 1.6 đều là "khi không có dữ liệu thì dựng số ra". Cùng một lỗi, hai chỗ.
3. **Fallback im lặng là nơi sinh ảo giác nhiều nhất.** Audit tìm ra 4 lỗi P0 ở `/dashboard`; **không lỗi nào** là do component/style sai — tất cả là fallback nói thay dữ liệu.
4. **Dữ liệu ngày không phải timestamp.** `as_of` là ngày; ép nó qua relative time tạo ra lỗi mới. Kiểu dữ liệu quyết định cách hiển thị, không phải ngược lại.

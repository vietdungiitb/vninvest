# AUDIT GIAO DIỆN `/watchlist` — TỪ ẢNH CHỤP THẬT + ĐỐI CHIẾU CODE

**Ngày:** 2026-09-13
**Nguồn ảnh:** screenshot `http://localhost/watchlist` do user cung cấp (viewport desktop ~1920, locale VI, tab "Cảnh báo dòng tiền" 50 mã)
**Phạm vi code:** `packages/web/src/pages/watchlist/components/{WatchlistTable.tsx, WatchlistSidebar.tsx, WatchlistMainWorkspace.tsx}` + `pages/WatchlistPage.css` + `pages/WatchlistPage.tsx`
**Phương pháp:** từng vùng ảnh → `grep/read` code xác nhận nguyên nhân `file:line` (không đoán). Không sửa code.
**Kết luận 1 đoạn:** Ảnh xác nhận 3 phàn nàn của user đều đúng và đều có nguyên nhân code cụ thể: (1) "không có phân trang" vì pager chỉ render khi `length > pageSize` (`Table:506`) nên đúng 50 mã/50 dòng thì pager biến mất; (2) menu trái cards Thị trường & Chỉ số nhồi tên+badge+count trong 1 hàng ở cột 22% nên chữ wrap vỡ (`Sidebar:431-468`); (3) cột HÀNH ĐỘNG toàn pill "—" vì actions chỉ hiện khi hover (`W-06` lộ rõ trên ảnh tĩnh). Thêm 2 phát hiện data hiển thị đáng ngờ: DAC +40.00% vượt trần sàn và ngưỡng "32.4M" không đơn vị. Tất cả fix được trong 3 slices thuần FE (~3-4 ngày), không đụng BE.

---

## 0. NGUYÊN TẮC (AGENTS.md:65)

Mọi khẳng định kèm `file:line`; vùng ảnh nào cũng phải có dòng code tương ứng; không bịa file; tiếng Việt.

## 1. ĐỐI CHIẾU ẢNH → CODE (bản đồ vùng)

| Vùng ảnh | Mô tả thấy | Nguyên nhân code | Mức |
|---|---|---|---|
| A. Title block | Eyebrow "RADA THỊ TRƯỜNG" + H1 "Radar thị trường" + desc chiếm ~150px chiều cao | `WatchlistPage.tsx:46-48` render 3 dòng block riêng; không compact | P2 |
| B. Sidebar "Danh sách tự tạo" | Trống: chỉ 2 hàng (holdings 0 mã, tracked 50 mã) + form tạo list; không có list tự tạo nào để minh họa | `WatchlistSidebar.tsx:100-192` không có empty-state hướng dẫn; form `new_list_placeholder :337` chiếm chỗ cố định | P1 |
| C. Sidebar "Thị trường & Chỉ số" | Cards "Ngân hàng / Bất động sản / Thép & Vật liệu / Dầu khí" wrap 2 dòng, badge "Hệ thống" + ô count "85 mã" chen nhau, có scrollbar | Card 1 hàng chứa `🌐 name + badge-system :441-462` rồi `count :464-468` trong cột `minmax(240px,22%)` (`WatchlistPage.css:26`); badge lặp ở mọi card dù section đã nói "hệ thống" | P1 |
| D. Table header | "Cảnh báo dòng tiền [50 mã]" + "Offline" + "Cập nhật lúc 9:24:24 PM" + toggle 2 icons + search phải | `MainWorkspace:217-230` title+badge; `:267` offline; `:270` `toLocaleTimeString()` (ra format PM vì thiếu locale `vi-VN`); density toggle `:360-372` không label | P2 |
| E. Table body | 5 hàng: giá đỏ/xanh đúng; tên DN tiếng Anh dài; cột HÀNH ĐỘNG toàn pill "—"; XU HƯỚNG bị cắt phải | Actions hover-only (`WatchlistPage.css` rowActions opacity 0→1, đã ghi W-06); cột tên DN flex rộng đẩy 2 cột phải ra ngoài viewport (thiếu `table-layout:fixed` + width) | P0/P1 |
| F. Pager | **Không thấy phân trang** dù 50 mã | `Table:506` chỉ render `WatchlistTablePager` khi `filteredSortedItems.length > pageSize` → 50 == 50 nên ẩn; pager `:633-716` tồn tại nhưng user không bao giờ thấy ở đúng ngưỡng | P0 |
| G. Ô NGƯỠNG GIÁM SÁT | "32.4M / 42.9M / 44.2M / 27.8M / 48.7M" — M là gì? | Weight/threshold format triệu không nhãn (`Table` hiển thị `whale_alert_threshold_million`, ảnh là giá trị M) — thiếu đơn vị + tooltip | P2 |
| H. Hàng DAC | **+40.00%** — vượt trần HOSE ±7% / HNX ±10% | Data `price_change_pct` từ realtime/bulk không qua validate/clamp; không có stale/invalid flag ở cell | P2 |

## 2. CONTRADICTIONS (báo cáo trước vs ảnh thật)

| # | Tài liệu cũ | Ảnh thật | Tác động |
|---|---|---|---|
| C-U1 | Plan P2-2 "pager dùng `totalPages/getPageCount`" (Entry 54-55) — tưởng phân trang xong | Pager tồn tại nhưng **ẩn ở đúng ngưỡng 50/50** (`Table:506`) → user báo "không có phân trang" là đúng trải nghiệm | Pager phải luôn render (disabled khi 1 trang) + sticky |
| C-U2 | Audit W-06 "hover-only mất action trên mobile" (P1) | Ảnh desktop đã lộ: cả 5 hàng hiện "—", user desktop cũng không biết có action | Nâng W-06 P1→P0 cho đợt UI này |
| C-U3 | Slice 2.3 a11y/CSS module (Entry 43) — có trong plan nhưng **chưa thấy thực thi** ở các Entry 45-56 | Ảnh vẫn_WRAP cards, actions "—", title block lớn → 2.3 chưa làm | Đưa 2.3 vào đợt UI này |

## 3. FINDINGS CHI TIẾT

### Đỏ — sai trải nghiệm rõ

- **[U-01 | ERROR | P0 | `WatchlistTable.tsx:506`] Phân trang "lúc ẩn lúc hiện".** Điều kiện `length > pageSize` khiến đúng 50 mã thì pager biến mất; user kết luận "không có phân trang". Thêm: pager nằm cuối table, list dài phải cuộn mới tới. Fix: luôn render pager (Prev/1/[50]/Next disabled khi 1 trang) + sticky bottom trong container table + giữ `pageSize` select 50/100/200 (`:704-716` đã có).
- **[U-02 | GAP | P0 | `WatchlistTable.tsx` + CSS] Cột HÀNH ĐỘNG chết trên ảnh tĩnh.** Nâng W-06 lên P0 đợt này: luôn hiện 4 icon buttons (chart/alert/trade/remove) kích thước 28px, `aria-label` đã có; bỏ pill "—". Cột XU HƯỚNG: cố định width 110px + `table-layout:fixed`, cột tên DN `max-width + ellipsis` (tên EN dài đẩy layout).
- **[U-03 | GAP | P1 | `WatchlistSidebar.tsx:431-468`] Cards thị trường vỡ chữ.** Chuyển card sang 2 dòng: dòng 1 `🌐 Tên nhóm` (ellipsis), dòng 2 `• 85 mã • Hệ thống` muted 0.75rem — bỏ badge pill lặp. Tăng min col `240px→264px` (`WatchlistPage.css:26`) hoặc cho sidebar scroll độc lập đã có.

### Vàng — trình bày + data hiển thị

- **[U-04 | GAP | P1 | `WatchlistSidebar.tsx:100-192`] Empty "Danh sách tự tạo".** Thêm empty-state: icon + "Chưa có danh sách — tạo để nhóm mã theo chiến lược" + nút CTA focus vào input `:337`; gộp form tạo thành 1 hàng (input + nút [+]) thay vì 2 hàng full-width.
- **[U-05 | GAP | P2 | `WatchlistPage.tsx:46-48`] Title block tốn ~150px.** Gọn thành 1 hàng: `Radar thị trường [50 mã] • ● Live/Offline • Cập nhật 21:24:27` — bỏ eyebrow + desc (desc chuyển vào tooltip `?`).
- **[U-06 | RISK | P2 | Table cells] DAC +40.00% không thể trên sàn VN.** Thêm guard hiển thị: `|pct| > 15%` → badge ⚠️ + tooltip "Biến động vượt trần — kiểm tra nguồn" (không sửa số, chỉ gắn cờ). Ghi nhận BE kiểm tra pipeline giá sau.
- **[U-07 | GAP | P2 | Cột ngưỡng] "32.4M" mơ hồ.** Format `32,4 tr` (vi-VN) + `title="Ngưỡng giám sát dòng tiền: 32.4 triệu"`; header thêm đơn vị `(tr)`.
- **[U-08 | GAP | P2 | Tên DN + ngành] Toàn tên pháp lý EN + "Khác".** Ưu tiên `company_name_vi || short_name || EN`; ngành "Khác" → ẩn dòng ngành thay vì hiện chữ Khác (3/5 hàng đang là Khác gây nhiễu).
- **[U-09 | GAP | P2 | `MainWorkspace.tsx:267-270`] "Offline" + giờ PM.** `toLocaleTimeString()` thiếu locale → dùng `toLocaleTimeString("vi-VN", {hour12:false})` = "21:24:27"; dot Offline thêm text "đang kết nối lại…" khi polling fallback (phân biệt chết hẳn vs fallback).

### Xanh — polish

- **[U-10 | GAP | P3] Density toggle 2 icons không label** (`:360-372`): thêm `title`/`aria-pressed` + tooltip "Chế độ xem: gọn/rộng".
- **[U-11 | GAP | P3] Search table trùng search global header:** giữ search table (lọc local nhanh) nhưng thêm đếm kết quả `"8 / 50 mã"` cạnh ô search khi filter active.

## 4. QUALITY GATES (đợt này thuần FE, không đổi contract)

`tsc` + `eslint scope` sau mỗi slice; `vitest` giữ 69 xanh (không đụng logic nên không thêm test, chỉ snapshot testids đã có); `build` cuối; 3 screenshots before/after vào `docs/evidence/watchlist-20260912/ui/`.

## 5. KẾ HOẠCH NÂNG CẤP (3 slices, ~3-4 ngày, 1 FE)

| Slice | Việc (file:line) | Done khi |
|---|---|---|
| UI-1 (1d) Pager + table layout (U-01, U-02) | `Table:506` luôn render pager + sticky; `table-layout:fixed` + widths (Mã 70, Giá 100, % 90, Tên DN flex ellipsis, Ngưỡng 110, Hành động 150 luôn hiện 4 icons, Xu hướng 110); bỏ pill "—" | 50 mã vẫn thấy pager disabled; ảnh after: actions hiện đủ, không cột nào bị cắt ở 1366px |
| UI-2 (1-1.5d) Sidebar (U-03, U-04) | Cards 2 dòng + bỏ badge lặp (`Sidebar:441-468`); empty-state CTA "Danh sách tự tạo"; form 1 hàng | Không còn wrap ở 1440px; sidebar không scrollbar khi ≤8 groups |
| UI-3 (1d) Data hiển thị (U-05→U-09) | Title 1 hàng; guard ±15% ⚠️; ngưỡng "tr" + tooltip; tên VI + ẩn "Khác"; giờ 24h vi-VN + trạng thái reconnect | DAC hiện ⚠️; giờ "21:24:27"; EN locale không còn PM |

DoD: user mở `/watchlist` ở 1366×768 thấy đủ pager + actions + không wrap + không cột cắt; Lighthouse a11y không giảm; ledger 1 entry/slice.

## 6. CÂU HỎI CHO USER

1. Tên DN tiếng Việt có sẵn ở BE không (`company_name_vi`?), hay FE tự map ngắn gọn?
2. DAC +40% có phải data thật (sự kiện đặc biệt) không — hay pipeline giá sai?
3. Giữ ngưỡng đơn vị "triệu" hay đổi sang "tỷ" khi >1000M?

## 7. ĐÁNH GIÁ TỔNG THỂ

Giao diện hiện **chưa đạt chuẩn thương mại** đúng như user nhận xét, nhưng khung (2-col, dark, realtime flash, TanStack) đã tốt — vấn đề nằm ở 3 điểm render có điều kiện (pager, actions, empty-state) + typography/units. Không blocker hạ tầng, không cần BE (trừ xác minh DAC + tên VI). Làm xong 3 slices UI trên + F3/F4 còn mở là đủ đóng sổ Watchlist.

# Audit UI/UX + Kế hoạch hiệu chỉnh — SOC Overview Tab (`?tab=overview`)

> **Ngày**: 2026-09-16 · **Nguồn ảnh**: screenshot runtime docker dev (27 services, all healthy, 3 trang × 9 cards)
> **Nền**: PR-1 `d39f9fed` + PR-2 `25c26c96` đã merge; stack dev đang chạy (`start_dev.ps1` smoke OK)
> **Phạm vi**: chỉ cân đối layout + trải nghiệm (không đổi logic, không đổi contract). Mọi khẳng định kèm `file:line`.

---

## 1. Audit visual (từ screenshot đối chiếu code)

| ID | Mức | Quan sát trên ảnh | Root cause (`file:line`) | Tác động |
|----|-----|-------------------|--------------------------|----------|
| **U-01** | **P0** | Hàng metric cuối chỉ có **1 card "Đã tắt"** lẻ loi, mất cân đối | `.overviewMetricGrid` = `repeat(3, 1fr)` (`soc.components.css:338`) trong khi có **7 cards** → 3+3+1. Media query ≤768px 2 cột (:346) còn tệ hơn: 2+2+2+1 | Lệch bố cục ngay cái nhìn đầu tiên; càng nhiều status khác 0 càng lộ |
| **U-02** | **P0** | Tên service nào cũng **cụt**: "Daily Prefetch Orch…", "Daily Price Backfill S…", "Dark Pool Signal Dete…" — không đọc được đang xem gì | `.overviewServiceName` `nowrap + ellipsis` 1 dòng (`soc.components.css:476-484`); `h4` không có `title` (`SocOverviewPanel.tsx:720`) | Operator không phân biệt nổi các service cùng prefix; phải click từng card |
| **U-03** | **P1** | Cột phải mỗi card là **3 chips SLO xếp dọc** (Uptime/Burn/Budget) → card cao, loãng, các card cao không đều | `.sloBadges` `flex-direction: column; align-items: flex-end` (`soc.components.css:456-461`); render `:756-766` | Lãng phí ~40% diện tích card; grid 3×3 trông nặng nề |
| **U-04** | **P1** | Metric card **trống nửa phải** (icon+chữ trái, khoảng trắng phải), mật độ thông tin thấp | `.overviewMetricCard` flex icon+body, không có caption phụ (`soc.components.css:334-345`, render `:536-...`) | Nhìn "rỗng", kém chuẩn Grafana (card nào cũng có context thứ cấp) |
| **U-05** | **P1** | **2 hàng pill lọc nhìn giống hệt nhau** (domain: Tất cả domains/data_ingest… + trạng thái: Tất cả/Hoạt động tốt…) — không biết đang lọc theo chiều nào | Domain pills dùng chung class `filterBtn` (`SocOverviewPanel.tsx:588-603`), status filters `:652`; không có nhãn hàng nào | Dễ nhầm/bỏ sót điều kiện lọc; click nhầm phải reset mò |
| **U-06** | **P1** | Toolbar dồn 1 cột: search full-width, 6 nút lọc, 2 dropdown (sort/pageSize) chảy tự do | `.toolbar` column (`soc.components.css:551-560`); class `.toolbarRow` **đã tồn tại** (`:561-567`) nhưng overview **không dùng** | Mất cấu trúc hàng-lối, khó quét mắt; dropdown sort/pageSize lẫn vào nút lọc |
| **U-07** | **P2** | Badge xanh "27/27 dịch vụ hoạt động" **lặp lại đúng số** 2 metric cards, không cho biết dữ liệu mới/cũ | Hero badge chỉ render health ratio (`SocOverviewPanel.tsx:466-...`); BE có `generated_at` (`overview.py:320`) nhưng FE bỏ qua (interface `OverviewData` không khai báo) | Thừa 1 element, thiếu freshness — thứ operator cần nhất khi poll 15s |
| **U-08** | **P2** | Health bar 6px gần như **vô hình** khi đồng nhất (toàn xanh), không có chú thích màu | `.overviewHealthBar` 6px (`soc.components.css:286-294`); không legend | Người mới không hiểu thanh màu là gì; khi sự cố mới thấy nhưng không đọc được cơ cấu |
| V-01 | Verify | Hàng stats card ghi **"Time"** + ngày giờ — khó hiểu là độ trễ hay lần kiểm | Panel dùng `latency_label/last_check_label` (VI: Độ trễ/Lần kiểm gần nhất) — ảnh mờ, chưa khẳng định được | Nếu đúng là chữ "Time" hard-code → bug i18n; nếu đọc nhầm → bỏ qua |
| V-02 | Verify | Pagination đọc như "Hiển thị 9 / 27" thay vì "Hiển thị 1–9 / 27" | Key `showing_range` render `:865` — ảnh mờ | Xác nhận runtime trước khi đụng |

**Điểm tốt (giữ nguyên)**: theme dark + glassmorphism nhất quán; grid cards 3×3 đều; 3 nút/card phân cấp màu rõ (đỏ Tắt / trung tính / cyan Cấu hình); pagination có số trang + pageSize; a11y roles PR-2 còn nguyên.

---

## 2. Kế hoạch hiệu chỉnh — 1 PR UI polish (~0.5–1 ngày)

**Nguyên tắc**: CSS-first, TSX sửa tối thiểu; không đổi logic/filter/sort/poll; không thêm dep; giữ mọi `role/aria` PR-2.

### W-U1 — Metric grid hết orphan (U-01)
- `soc.components.css:338`: `.overviewMetricGrid` → `grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));` (pattern có sẵn `.metricGrid:545`).
- Xóa/sửa media queries `:346/:352` (auto-fit đã responsive; giữ fallback 1 cột ≤480px nếu muốn).
- Skeleton 7 items giữ nguyên.
- **Nghiệm thu**: 1920px → 7 cards 1 hàng đều; 1366px → 4+3 hoặc 7 đều không orphan 1; 768px/390px không hàng 1 card.

### W-U2 — Tên service đọc được (U-02)
- `SocOverviewPanel.tsx:720`: thêm `title: service.name` vào `h4`.
- `soc.components.css:476-484`: bỏ `nowrap`, thêm 2-line clamp (`display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; min-height:2.2em`) để các card thẳng hàng.
- **Nghiệm thu**: tên dài hiện đủ 2 dòng + tooltip đầy đủ; card cùng hàng bằng nhau.

### W-U3 — SLO chips gọn 1 hàng (U-03)
- `.sloBadges:456`: → `flex-direction: row; flex-wrap: wrap; justify-content: flex-end;` font `.sloBadge` 0.68→0.65rem nếu cần.
- **Nghiệm thu**: card thấp hơn rõ rệt, 3 chips cùng 1 hàng ở ≥1366px; không tràn ở 390px (wrap xuống).

### W-U4 — Caption % cho metric (U-04)
- Render thêm dòng caption dưới value với 6 card trạng thái: `{pct}%` (pct = value/total), dùng class `.overviewMetricLabel` tái sử dụng; card `total` bỏ qua.
- i18n 1 key: `metric_share` VI `{pct}% tổng số` / EN `{pct}% of total`.
- **Nghiệm thu**: mỗi card có context thứ cấp; test cũ query theo label/value không vỡ (chỉ thêm node).

### W-U5 — Phân biệt 2 chiều lọc (U-05)
- CSS mới `.domainPill` (nhỏ hơn `filterBtn`: padding 0.25/0.6rem, font 0.7rem, dạng outline, font mono cho tên domain) — áp cho strip domain, giữ `aria-pressed`.
- Thêm nhãn hàng: `filter_by_domain` (VI `Theo domain` / EN `By domain`), `filter_by_status` (VI `Theo trạng thái` / EN `By status`).
- **Nghiệm thu**: nhìn là biết đang lọc theo chiều nào; 2 keys VI/EN render đúng.

### W-U6 — Toolbar 2 hàng (U-06)
- Dùng `.toolbarRow` có sẵn: hàng 1 = search (`flex:1`) + sort select + pageSize select; hàng 2 = status filters.
- **Nghiệm thu**: 1366px gọn 2 hàng; 390px wrap tự nhiên không vỡ.

### W-U7 — Hero badge có freshness (U-07)
- `OverviewData` thêm `generated_at?: string`; hero badge append `· cập nhật HH:mm:ss` (dùng `formatLastCheck` có sẵn, chỉ lấy phần giờ) — key `hero_updated_at` VI `cập nhật {time}` / EN `updated {time}`.
- **Nghiệm thu**: badge hiện giờ snapshot khớp `generated_at` API.

### W-U8 — Legend cho health bar (U-08)
- Dưới bar thêm hàng legend 6 chấm màu + label metric (tái dùng `METRIC_LABEL_KEYS`, chỉ hiện status có >0 để gọn).
- **Nghiệm thu**: người mới đọc được cơ cấu màu; tổng legend = 100%.

---

## 3. i18n keys thêm (4 keys, VI+EN)

| Key | VI | EN |
|-----|----|----|
| `metric_share` | `{pct}% tổng số` | `{pct}% of total` |
| `filter_by_domain` | `Theo domain` | `By domain` |
| `filter_by_status` | `Theo trạng thái` | `By status` |
| `hero_updated_at` | `cập nhật {time}` | `updated {time}` |

---

## 4. Tests + gates

- **Tests**: mở rộng `soc-overview-tab.component.test.tsx` (+3): tên dài có `title` đầy đủ; caption `%` hiện đúng (vd 27/27 → 100%); domain pills dùng class `domainPill` phân biệt filterBtn. Test cũ giữ xanh.
- **Gates mỗi sub-step**: `npx tsc --noEmit` 0 → vitest file soc → cuối PR `npm run build` PASS + `npm run lint` 0 errors + `i18n:scan`.
- **Visual (stack dev đang chạy)**: chụp `?tab=overview` ở 1920 / 1366 / 390, đối chiếu checklist: không orphan metric; tên 2 dòng; chips 1 hàng; 2 hàng lọc có nhãn; badge có giờ cập nhật; legend bar đúng.

## 5. Không làm (có lý do)

- Đổi theme/màu/spacing tổng thể: theme đã nhất quán, đụng vào rủi ro drift token (C5).
- Gộp 7 cards thành 6: `maintenance` là yêu cầu audit C3/C6, phải giữ.
- Chuyển JSX, SSE, ETag: backlog §8 của plan overview, epic riêng.
- V-01/V-02: xác nhận runtime trước; nếu đúng là bug thì tách hotfix nhỏ, không nhét vào PR polish.

# IMPLEMENTATION PLAN — OPENCORE SITE UI UPGRADE
**Ngày:** 2026-05-07  
**Version:** 1.0

---

## Nguyên tắc thực hiện

1. **Làm theo thứ tự Slice** — S1 phải hoàn chỉnh và pass build trước khi bắt S2.
2. **Sau mỗi Slice** phải chạy `npm run build` và xác nhận zero TypeScript errors.
3. **Sau mỗi Slice** phải visual review tại `http://localhost:3007/vi` và `http://localhost:3007/en`.
4. **Sau mỗi Slice** update TASKBOARD trạng thái.
5. **Không commit** cho đến khi một Slice đã pass build + visual review.
6. **S3 bị block** vì cần asset — skip S3, thực hiện S4, S5 trước, quay lại S3 khi có asset.

---

## SLICE 1 — Bug Fixes & Content Quality
**Ước tính:** 1–2 giờ  
**Phụ thuộc:** Không có  
**Unblock tiếp:** S2, S4, S5

### Bước thực hiện

**Bước 1.1 — Cập nhật `vi.json` và `en.json`**

Mở đồng thời cả hai file:
- `packages/opencore-site/src/messages/vi.json`
- `packages/opencore-site/src/messages/en.json`

Thêm các namespace/key sau vào cuối JSON (trước dấu `}`):

**vi.json — thêm vào namespace `featureGrid` (namespace mới):**
```json
"featureGrid": {
  "heading": "Năng lực nền tảng",
  "item1": "Phân tích dòng tiền thông minh với dữ liệu whale theo thời gian thực.",
  "item2": "Bộ lọc tín hiệu tùy chỉnh cho từng chiến lược giao dịch.",
  "item3": "Pyodide sandbox — chạy Python phân tích ngay trên trình duyệt.",
  "item4": "Engine VNStockCharts tự phát triển, hiệu năng cao, không phụ thuộc ngoài."
}
```

**vi.json — thêm vào namespace `pricing`:**
```json
"recommended": "Phổ biến nhất",
"freeF1": "Xem dữ liệu thị trường cơ bản",
"freeF2": "Theo dõi tối đa 3 mã cổ phiếu",
"freeF3": "Truy cập Pyodide sandbox",
"proF1": "Tất cả tính năng gói Miễn phí",
"proF2": "Phân tích whale và dòng tiền không giới hạn",
"proF3": "Theo dõi không giới hạn mã cổ phiếu",
"proF4": "Cảnh báo tín hiệu real-time qua email",
"entF1": "Tất cả tính năng gói Pro",
"entF2": "API tích hợp riêng cho đội trading",
"entF3": "Hỗ trợ ưu tiên 24/7",
"entF4": "Tùy chỉnh alert threshold theo yêu cầu"
```

**vi.json — thêm vào namespace `common`:**
```json
"siteSubtitle": "Nền tảng công khai",
"footerDescription": "Mặt tiền công khai cho VNInvest, vnstock và VNStockCharts.",
"openMenu": "Mở menu",
"closeMenu": "Đóng menu"
```

Làm tương tự cho `en.json` với bản dịch tiếng Anh (xem chi tiết tại TECH_SPEC).

**Bước 1.2 — Sửa `FeatureGrid.tsx`**

Đổi namespace từ `'home'` sang `'featureGrid'`, đổi key từ `feature1..4` sang `item1..4`.  
Tham khảo đoạn code mẫu tại TECH_SPEC mục S1-T1.

**Bước 1.3 — Sửa `PricingTable.tsx`**

- Cập nhật `plans` array để thêm `featureKeys` và `highlight` field.
- Thay bullet hardcode bằng vòng lặp render từ `featureKeys`.
- Thêm highlight ring cho gói Pro.
- Tham khảo đoạn code mẫu tại TECH_SPEC mục S1-T2.

**Bước 1.4 — Sửa `TopNav.tsx`**

Thay text hardcode "About Site" bằng `{t('siteSubtitle')}`.  
Tham khảo TECH_SPEC mục S1-T3.

**Bước 1.5 — Sửa `Footer.tsx`**

Thay text hardcode description bằng `{t('footerDescription')}`.  
Tham khảo TECH_SPEC mục S1-T4.

**Bước 1.6 — Validation S1**

```powershell
Push-Location packages/opencore-site
npm run build
Pop-Location
```

Kiểm tra:
- [ ] Build exit code = 0
- [ ] Không có TypeScript error
- [ ] Không có missing i18n key warning
- [ ] Visual review `http://localhost:3007/vi` — FeatureGrid có nội dung khác HeroSection
- [ ] Visual review `http://localhost:3007/vi/pricing` — Ba gói có feature list riêng biệt
- [ ] Visual review header — subtitle là "Nền tảng công khai" (không phải "About Site")
- [ ] Visual review `http://localhost:3007/en` — English version đúng

---

## SLICE 2 — ProductCards Upgrade
**Ước tính:** 1.5–2 giờ  
**Phụ thuộc:** S1 hoàn chỉnh

### Bước thực hiện

**Bước 2.1 — Cập nhật `vi.json` và `en.json`**

Thêm vào namespace `products`:
- `vinvestMetric`, `vnstockMetric`, `chartMetric`
- `vinvestCta`, `vnstockCta`, `chartCta`

Xem chi tiết tại TECH_SPEC mục S2-T2, S2-T3.

**Bước 2.2 — Sửa `ProductCards.tsx`**

- Thêm object `PRODUCT_ICONS` với 3 SVG inline (amber/cyan/emerald gradient).
- Thêm object `PRODUCT_CTAURL` ánh xạ key → URL.
- Thêm render icon trên đầu mỗi card.
- Thêm render metric tagline (text nhỏ, màu subdued).
- Thêm `<a>` hoặc `<Link>` CTA ở cuối mỗi card.
- Thêm hover class vào `<article>`.

Tham khảo TECH_SPEC mục S2-T1 đến S2-T4.

**Bước 2.3 — Validation S2**

```powershell
Push-Location packages/opencore-site
npm run build
Pop-Location
```

Kiểm tra:
- [ ] Build pass
- [ ] Visual: 3 card có icon gradient riêng
- [ ] Visual: Mỗi card có tagline metric riêng biệt
- [ ] Visual: Mỗi card có CTA button/link ở cuối
- [ ] Visual: Hover effect hoạt động (card lift lên)

---

## SLICE 3 — Hero Right Panel (Đang chờ asset)
**Ước tính:** 1 giờ (khi có asset) hoặc 2 giờ (nếu dùng animated placeholder)  
**Phụ thuộc:** S1 + quyết định của Product Owner về asset  
**Trạng thái:** BLOCKED

### Quyết định cần từ Product Owner

Chọn một trong hai hướng:

**Hướng A — Dùng screenshot thật:**  
Product Owner cung cấp file `dashboard-preview.png` (dark theme, tối thiểu 800×500px, lý tưởng là 1:1.2 ratio).  
Developer đặt vào `public/images/dashboard-preview.png` và dùng `<Image>` của Next.js.

**Hướng B — Animated placeholder SVG/JSX:**  
Không cần asset. Developer tự code mini chart SVG + whale signal badge.  
Tham khảo TECH_SPEC mục S3 để lấy code mẫu.

### Bước thực hiện (khi unblock)

**Bước 3.1** — Nhận xác nhận hướng từ Product Owner.

**Bước 3.2** — Thêm i18n key `home.whaleSignal` vào vi.json và en.json.

**Bước 3.3** — Sửa right panel của `HeroSection.tsx` theo hướng đã chọn.

**Bước 3.4 — Validation S3**

- [ ] Build pass
- [ ] Visual: Right panel không còn là text list đơn thuần
- [ ] Visual: Có visual element (chart/image) gợi lên dashboard
- [ ] Visual: Whale signal badge hiển thị

---

## SLICE 4 — Stats Strip
**Ước tính:** 1 giờ  
**Phụ thuộc:** S1 hoàn chỉnh  
**Ghi chú:** Số liệu cần confirm từ Product Owner trước khi hardcode vào component

### Bước thực hiện

**Bước 4.1 — Confirm số liệu**

Xác nhận với Product Owner 4 con số trong StatsStrip:
- `600+` mã cổ phiếu — có đúng không?
- `3` sản phẩm — đúng
- `2` ngôn ngữ — đúng
- `100%` mã nguồn mở — đúng cho vnstock, nhưng VNInvest có thể không 100% open source → **cần confirm**

**Bước 4.2 — Cập nhật `vi.json` và `en.json`**

Thêm namespace `stats` với các label key.  
Xem chi tiết tại TECH_SPEC mục S4-T1.

**Bước 4.3 — Tạo file `StatsStrip.tsx`**

Tạo file mới tại `src/components/sections/StatsStrip.tsx`.  
Copy code mẫu từ TECH_SPEC mục S4-T1.

**Bước 4.4 — Thêm vào home page**

Mở `src/app/[locale]/page.tsx`.  
Import `StatsStrip` và đặt sau `HeroSection`, trước `ProductCards`.

**Bước 4.5 — Validation S4**

```powershell
Push-Location packages/opencore-site
npm run build
Pop-Location
```

Kiểm tra:
- [ ] Build pass
- [ ] Visual: StatsStrip hiển thị sau Hero section
- [ ] Visual: 4 số liệu đúng và đẹp

---

## SLICE 5 — Mobile Nav + Scroll Animations
**Ước tính:** 2–3 giờ  
**Phụ thuộc:** S1, S2, S4 hoàn chỉnh

### Bước thực hiện

**Bước 5.1 — Thêm i18n key mobile nav**

Thêm `openMenu` và `closeMenu` vào `common` namespace (đã làm ở S1-T3 nếu chưa).

**Bước 5.2 — Tạo `useReveal.ts` hook**

Tạo file mới tại `src/hooks/useReveal.ts`.  
Copy code mẫu từ TECH_SPEC mục S5-T2.

**Bước 5.3 — Thêm CSS reveal vào `globals.css`**

Thêm `.reveal` và `.reveal.visible` classes.  
Tham khảo TECH_SPEC mục S5-T2.

**Bước 5.4 — Cập nhật `TopNav.tsx`**

- Thêm `useState` import.
- Thêm `mobileOpen` state.
- Ẩn desktop CTA trên mobile (`hidden md:inline-flex`).
- Thêm hamburger button chỉ hiển thị trên mobile (`md:hidden`).
- Thêm mobile overlay menu conditional render.

Tham khảo TECH_SPEC mục S5-T1.

**Bước 5.5 — Apply reveal animation**

Thêm `reveal` class và `useReveal` hook vào: `StatsStrip`, `ProductCards`, `FeatureGrid`, `PricingTable`.

**Bước 5.6 — Validation S5**

```powershell
Push-Location packages/opencore-site
npm run build
Pop-Location
```

Kiểm tra:
- [ ] Build pass
- [ ] Mobile (viewport 390px): Hamburger button hiển thị thay nav links
- [ ] Mobile: Click hamburger → overlay menu xuất hiện
- [ ] Mobile: Click link trong overlay → menu đóng lại
- [ ] Desktop (viewport 1280px): Nav links hiển thị bình thường, hamburger ẩn
- [ ] Scroll: Các section fade-in khi scroll vào viewport
- [ ] `http://localhost:3007/en` — English version đúng

---

## Commit & Deploy cuối cùng

Sau khi tất cả Slice đã pass (trừ S3 nếu vẫn blocked):

```powershell
# Trong thư mục gốc
git add packages/opencore-site/src/
git commit -m "feat(opencore-site): UI upgrade S1-S2-S4-S5 — fix i18n bugs, product cards, stats strip, mobile nav"
git push origin dev
```

Rebuild dev stack:
```powershell
docker compose -f ./docker-compose.dev.yml up -d --build frontend
```

---

## Checklist cuối cùng (Pre-PR)

- [ ] `npm run build` — zero errors
- [ ] BUG-01 (FeatureGrid duplicate) — FIXED
- [ ] BUG-02 (PricingTable identical bullets) — FIXED
- [ ] BUG-03 (TopNav "About Site" hardcode) — FIXED
- [ ] BUG-04 (Footer hardcode description) — FIXED
- [ ] ProductCards có icon + metric + CTA
- [ ] StatsStrip trên home page
- [ ] Mobile hamburger nav hoạt động
- [ ] Scroll animations trên ít nhất 4 section
- [ ] Tất cả i18n keys có cả vi và en
- [ ] `docs/CODE_CHANGE_AUDIT_LEDGER.md` đã cập nhật
- [ ] Committed và pushed lên `dev`

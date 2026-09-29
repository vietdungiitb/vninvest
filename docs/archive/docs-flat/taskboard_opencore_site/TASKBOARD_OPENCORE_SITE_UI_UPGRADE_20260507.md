# TASKBOARD — OPENCORE SITE UI UPGRADE
**Ngày:** 2026-05-07  
**Cập nhật lần cuối:** 2026-05-07

Hướng dẫn cập nhật:
- Khi bắt đầu task: đổi `[ ]` → `[~]` và ghi tên developer
- Khi hoàn thành: đổi `[~]` → `[x]` và ghi ngày hoàn thành
- Khi blocked: đổi `[ ]` → `[!]` và ghi lý do

---

## SLICE 1 — Bug Fixes & Content Quality
**Assignee:** ___________  
**Target:** ___________  
**Trạng thái:** `NOT STARTED`

| ID | Task | Trạng thái | Ghi chú |
|----|------|-----------|---------|
| S1-T1 | Thêm namespace `featureGrid` vào `vi.json` | `[ ]` | 4 keys: heading, item1..4 |
| S1-T2 | Thêm namespace `featureGrid` vào `en.json` | `[ ]` | Bản dịch tiếng Anh |
| S1-T3 | Thêm pricing feature keys vào `vi.json` | `[ ]` | freeF1..3, proF1..4, entF1..4, recommended |
| S1-T4 | Thêm pricing feature keys vào `en.json` | `[ ]` | Bản dịch tiếng Anh |
| S1-T5 | Thêm `siteSubtitle`, `footerDescription`, `openMenu`, `closeMenu` vào `vi.json` | `[ ]` | Namespace `common` |
| S1-T6 | Thêm các key trên vào `en.json` | `[ ]` | Namespace `common` |
| S1-T7 | Sửa `FeatureGrid.tsx` — đổi namespace sang `featureGrid` | `[ ]` | BUG-01 fix |
| S1-T8 | Sửa `PricingTable.tsx` — plans array + render từ i18n | `[ ]` | BUG-02 fix |
| S1-T9 | Sửa `PricingTable.tsx` — highlight ring cho gói Pro | `[ ]` | UX improvement |
| S1-T10 | Sửa `TopNav.tsx` — đổi "About Site" hardcode sang `t('siteSubtitle')` | `[ ]` | BUG-03 fix |
| S1-T11 | Sửa `Footer.tsx` — đổi description hardcode sang `t('footerDescription')` | `[ ]` | BUG-04 fix |
| S1-T12 | `npm run build` — xác nhận zero error | `[ ]` | Gate pass để sang S2 |
| S1-T13 | Visual review `/vi` — FeatureGrid khác HeroSection | `[ ]` | Screenshot bằng chứng |
| S1-T14 | Visual review `/vi/pricing` — 3 gói có feature list riêng | `[ ]` | Screenshot bằng chứng |
| S1-T15 | Visual review `/en` — English version đúng | `[ ]` | Screenshot bằng chứng |

**S1 GATE: Tất cả 15 task ✅ → mới được bắt S2**

---

## SLICE 2 — ProductCards Upgrade
**Assignee:** ___________  
**Target:** ___________  
**Trạng thái:** `BLOCKED — chờ S1`

| ID | Task | Trạng thái | Ghi chú |
|----|------|-----------|---------|
| S2-T1 | Thêm `vinvestMetric`, `vnbrokerMetric`, `chartMetric` vào `vi.json` | `[ ]` | Namespace `products` |
| S2-T2 | Thêm metric keys vào `en.json` | `[ ]` | Namespace `products` |
| S2-T3 | Thêm `vinvestCta`, `vnbrokerCta`, `chartCta` vào `vi.json` | `[ ]` | Namespace `products` |
| S2-T4 | Thêm CTA keys vào `en.json` | `[ ]` | Namespace `products` |
| S2-T5 | Thêm `PRODUCT_ICONS` object với 3 SVG inline vào `ProductCards.tsx` | `[ ]` | amber/cyan/emerald gradient |
| S2-T6 | Thêm `PRODUCT_CTAURL` mapping object | `[ ]` | vinvest/vnbroker/chart |
| S2-T7 | Render icon trên đầu mỗi card | `[ ]` | `<div className="mb-3">` wrap icon |
| S2-T8 | Render metric tagline dưới title mỗi card | `[ ]` | Text nhỏ, màu slate-400 |
| S2-T9 | Thêm CTA button/link ở cuối mỗi card | `[ ]` | Hover transition, padding |
| S2-T10 | Thêm hover effect vào `<article>` | `[ ]` | `-translate-y-1 shadow-lg` |
| S2-T11 | `npm run build` — xác nhận zero error | `[ ]` | |
| S2-T12 | Visual review — 3 card có icon, metric, CTA, hover | `[ ]` | Screenshot bằng chứng |

**S2 GATE: Tất cả 12 task ✅ → mới được đánh dấu S2 done**

---

## SLICE 3 — Hero Right Panel (Asset required)
**Assignee:** ___________  
**Target:** TBD — chờ asset  
**Trạng thái:** `BLOCKED — chờ Product Owner`

| ID | Task | Trạng thái | Ghi chú |
|----|------|-----------|---------|
| S3-T0 | Product Owner xác nhận hướng A (ảnh thật) hoặc B (animated placeholder) | `[!]` | **BLOCKER** |
| S3-T1 | Nếu hướng A: nhận file `dashboard-preview.png` từ Product Owner | `[ ]` | Min 800×500px |
| S3-T2 | Nếu hướng A: đặt file vào `public/images/` | `[ ]` | |
| S3-T3 | Thêm `home.whaleSignal` vào `vi.json` | `[ ]` | |
| S3-T4 | Thêm `home.whaleSignal` vào `en.json` | `[ ]` | |
| S3-T5 | Sửa right panel `HeroSection.tsx` theo hướng đã chọn | `[ ]` | Xem TECH_SPEC S3 |
| S3-T6 | `npm run build` — xác nhận zero error | `[ ]` | |
| S3-T7 | Visual review — Hero right panel có visual element | `[ ]` | Screenshot bằng chứng |

**S3 GATE: S3-T7 pass ✅**

---

## SLICE 4 — Stats Strip
**Assignee:** ___________  
**Target:** ___________  
**Trạng thái:** `BLOCKED — chờ S1`

| ID | Task | Trạng thái | Ghi chú |
|----|------|-----------|---------|
| S4-T0 | Confirm 4 số liệu với Product Owner (600+, 3, 2, 100%) | `[ ]` | Đặc biệt xác nhận "100% open source" |
| S4-T1 | Thêm namespace `stats` với 4 label keys vào `vi.json` | `[ ]` | |
| S4-T2 | Thêm namespace `stats` vào `en.json` | `[ ]` | |
| S4-T3 | Tạo file mới `src/components/sections/StatsStrip.tsx` | `[ ]` | NEW FILE |
| S4-T4 | Import và render `<StatsStrip />` trong `page.tsx` sau HeroSection | `[ ]` | |
| S4-T5 | `npm run build` — xác nhận zero error | `[ ]` | |
| S4-T6 | Visual review — StatsStrip hiển thị đúng vị trí | `[ ]` | Screenshot bằng chứng |

**S4 GATE: Tất cả 7 task ✅**

---

## SLICE 5 — Mobile Nav + Scroll Animations
**Assignee:** ___________  
**Target:** ___________  
**Trạng thái:** `BLOCKED — chờ S1, S2, S4`

| ID | Task | Trạng thái | Ghi chú |
|----|------|-----------|---------|
| S5-T1 | Tạo file `src/hooks/useReveal.ts` | `[ ]` | NEW FILE — IntersectionObserver |
| S5-T2 | Thêm `.reveal` và `.reveal.visible` CSS vào `globals.css` | `[ ]` | |
| S5-T3 | Thêm `useState` và `mobileOpen` state vào `TopNav.tsx` | `[ ]` | |
| S5-T4 | Thêm hamburger button (SVG icon, `md:hidden`) vào `TopNav.tsx` | `[ ]` | |
| S5-T5 | Thêm mobile overlay menu (`{mobileOpen && ...}`) vào `TopNav.tsx` | `[ ]` | |
| S5-T6 | Ẩn desktop CTA trên mobile (`hidden md:inline-flex`) | `[ ]` | |
| S5-T7 | Apply `useReveal` + class `reveal` vào `StatsStrip.tsx` | `[ ]` | |
| S5-T8 | Apply `useReveal` + class `reveal` vào `ProductCards.tsx` | `[ ]` | |
| S5-T9 | Apply `useReveal` + class `reveal` vào `FeatureGrid.tsx` | `[ ]` | |
| S5-T10 | Apply `useReveal` + class `reveal` vào `PricingTable.tsx` | `[ ]` | |
| S5-T11 | `npm run build` — xác nhận zero error | `[ ]` | |
| S5-T12 | Visual review mobile (390px) — hamburger hiển thị | `[ ]` | DevTools responsive mode |
| S5-T13 | Visual review mobile — click open/close menu hoạt động | `[ ]` | |
| S5-T14 | Visual review desktop — nav links hiển thị, hamburger ẩn | `[ ]` | |
| S5-T15 | Visual review scroll — sections fade-in đúng | `[ ]` | |
| S5-T16 | Visual review `/en` — English mobile nav đúng | `[ ]` | |

**S5 GATE: Tất cả 16 task ✅**

---

## Final commit gate

| ID | Task | Trạng thái |
|----|------|-----------|
| F1 | S1 GATE PASSED | `[ ]` |
| F2 | S2 GATE PASSED | `[ ]` |
| F4 | S4 GATE PASSED | `[ ]` |
| F5 | S5 GATE PASSED | `[ ]` |
| F6 | `docs/CODE_CHANGE_AUDIT_LEDGER.md` đã cập nhật | `[ ]` |
| F7 | `git commit` với message chuẩn | `[ ]` |
| F8 | `git push origin dev` | `[ ]` |
| F9 | Dev stack rebuilt (docker compose) | `[ ]` |
| F10 | S3 GATE PASSED (khi asset sẵn sàng) | `[ ]` — có thể sau |

---

## Phân công gợi ý

Slice có thể gán cho cùng một developer vì phụ thuộc tuần tự:

```
Developer A: S1 → S2 → S4
Developer A hoặc B: S5 (sau S4)
Developer A hoặc B: S3 (khi có asset)
```

Nếu có 2 developer:
```
Developer A: S1 → S2
Developer B: S4 (sau S1, không phụ thuộc S2)
Developer A: S5 (sau S2 + S4)
```

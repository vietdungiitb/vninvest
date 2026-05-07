# OPENCORE SITE UI UPGRADE — HANDOFF MASTER
**Ngày:** 2026-05-07  
**Feature pack:** opencore-site UI Upgrade v1  
**Owner:** Tech Lead  
**Status:** READY FOR EXECUTION

---

## 1. Mục tiêu

Nâng cấp giao diện trang công khai `packages/opencore-site` từ bản scaffold placeholder sang một publish site production-grade, đủ để:

1. Truyền thông điều rõ ràng về ba sản phẩm VNInvest / vnstock / VNStockCharts.
2. Sửa các lỗi nội dung hiện tại (nội dung trùng lặp, text hardcode không qua i18n).
3. Nâng cấp thẩm mỹ thành phần ProductCards và Hero.
4. Phân cấp rõ ba gói giá Free / Pro / Enterprise với feature list thật.
5. Đảm bảo mobile-first và có scroll animation.

---

## 2. Phạm vi — Năm Slice

| Slice | Tiêu đề | Loại | Phụ thuộc |
|-------|---------|------|-----------|
| S1 | Bug Fixes & Content Quality | Sửa lỗi + i18n | Không có |
| S2 | ProductCards Upgrade | UI Enhancement | S1 |
| S3 | Hero Right Panel — Dashboard Preview | UI Enhancement | S1, cần ảnh/asset từ Product Owner |
| S4 | Stats Strip + WhySection Replacement | UI Enhancement | S1 |
| S5 | Mobile Nav Hamburger + Scroll Animations | UI Enhancement | S1, S2, S4 |

**Thứ tự ưu tiên:** S1 → S2 → S4 → S5 → S3 (S3 bị block chờ asset)

---

## 3. Trạng thái hiện tại (Baseline)

### 3.1 Bugs đã xác nhận

| ID | File | Mô tả lỗi |
|----|------|-----------|
| BUG-01 | `FeatureGrid.tsx` | Dùng cùng i18n namespace `home.feature1..4` với `HeroSection.tsx` → nội dung trùng hoàn toàn |
| BUG-02 | `PricingTable.tsx` | Ba gói giá có cùng bullet list hardcode: "Bảng giá public rõ ràng" × 3 → không phân biệt |
| BUG-03 | `TopNav.tsx` | Subtitle "About Site" hardcode tiếng Anh, không qua i18n |
| BUG-04 | `Footer.tsx` | Description "Public surface cho VNInvest..." hardcode tiếng Việt, không qua i18n |

### 3.2 Gaps UI đã xác nhận

| ID | File | Mô tả |
|----|------|-------|
| GAP-01 | `ProductCards.tsx` | Không có icon, không có số liệu, không có CTA riêng từng sản phẩm, không có hover effect |
| GAP-02 | `HeroSection.tsx` | Right panel là text list đơn giản, không có visual preview dashboard |
| GAP-03 | `page.tsx` (home) | Không có stats strip (social proof numbers) |
| GAP-04 | `page.tsx` (home) | Không có WhySection thật — chỉ có FeatureGrid text |
| GAP-05 | `TopNav.tsx` | Không có hamburger menu mobile |
| GAP-06 | Toàn trang | Không có scroll animations (Intersection Observer) |

---

## 4. Kiến trúc kỹ thuật

```
packages/opencore-site/
├── src/
│   ├── app/
│   │   ├── [locale]/
│   │   │   └── page.tsx               # Home page — thứ tự section
│   │   └── globals.css                # CSS variables, utility classes
│   ├── components/
│   │   ├── layout/
│   │   │   ├── TopNav.tsx             # S1/S5
│   │   │   └── Footer.tsx             # S1
│   │   └── sections/
│   │       ├── HeroSection.tsx        # S3
│   │       ├── ProductCards.tsx       # S2
│   │       ├── FeatureGrid.tsx        # S1
│   │       ├── PricingTable.tsx       # S1
│   │       ├── StatsStrip.tsx         # S4 (NEW FILE)
│   │       └── WhySection.tsx         # S4 (NEW FILE)
│   └── messages/
│       ├── vi.json                    # S1, S2, S4
│       └── en.json                    # S1, S2, S4
```

**Stack:** Next.js 15 App Router, Tailwind CSS 4, next-intl, TypeScript strict

---

## 5. Nguyên tắc không được vi phạm

1. **Tất cả text hiển thị phải qua i18n** — không hardcode bất kỳ chuỗi tiếng Việt hay tiếng Anh nào trong TSX.
2. **Thêm i18n key phải đồng bộ cả `vi.json` và `en.json`** — thiếu một bên là build lỗi TypeScript.
3. **Không sửa logic định tuyến locale** — `localeHref()` pattern đã đúng, giữ nguyên.
4. **Không dùng Framer Motion** — dùng Intersection Observer + CSS `transition-*` thuần để tránh bundle size.
5. **Không tự thêm npm package mới** — trừ khi được Tech Lead phê duyệt trong Tech Spec.
6. **Tất cả SVG icon phải inline** (không import file, không external CDN) vì bundle size nhỏ.
7. **Mobile breakpoint chuẩn** là `md:` (768px) — không dùng `sm:` cho major layout shift.

---

## 6. Điều kiện "Done" cho toàn feature pack

- [ ] `npm run build` không có lỗi TypeScript hoặc i18n missing key
- [ ] BUG-01, BUG-02, BUG-03, BUG-04 đã sửa và verify bằng visual review
- [ ] ProductCards có icon, metric, CTA riêng và hover effect
- [ ] PricingTable có feature list riêng biệt cho từng gói
- [ ] Mobile nav hoạt động (hamburger toggle)
- [ ] StatsStrip hiển thị trên home
- [ ] Scroll fade-in animation hoạt động trên ít nhất 3 section
- [ ] Tất cả i18n keys đồng bộ vi/en
- [ ] Commit push lên branch `dev`
- [ ] `docs/CODE_CHANGE_AUDIT_LEDGER.md` đã cập nhật

---

## 7. Files tài liệu đi kèm

| Tài liệu | Mục đích |
|----------|----------|
| [TECH_SPEC_OPENCORE_SITE_UI_UPGRADE_20260507.md](TECH_SPEC_OPENCORE_SITE_UI_UPGRADE_20260507.md) | Chi tiết kỹ thuật từng thay đổi component |
| [IMPLEMENTATION_PLAN_OPENCORE_SITE_UI_UPGRADE_20260507.md](IMPLEMENTATION_PLAN_OPENCORE_SITE_UI_UPGRADE_20260507.md) | Thứ tự thực hiện slice và checklist |
| [TASKBOARD_OPENCORE_SITE_UI_UPGRADE_20260507.md](TASKBOARD_OPENCORE_SITE_UI_UPGRADE_20260507.md) | Task atomic, assignee, trạng thái |

---

## 8. Liên lạc và escalation

- **Blocked trên S3** (asset chưa có): Ghi vào TASKBOARD, tiếp tục S4, S5, không dừng toàn bộ.
- **Build lỗi TypeScript**: Check i18n key đồng bộ trước, sau mới check component type.
- **Câu hỏi về nội dung** (copy, số liệu stats): hỏi Product Owner trước khi tự điền.

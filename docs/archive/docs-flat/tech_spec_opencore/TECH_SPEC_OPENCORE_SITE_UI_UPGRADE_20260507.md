# TECH SPEC — OPENCORE SITE UI UPGRADE
**Ngày:** 2026-05-07  
**Version:** 1.0  
**Trạng thái:** APPROVED FOR IMPLEMENTATION

---

## SLICE 1 — Bug Fixes & Content Quality

### S1-T1: Sửa FeatureGrid — Tách namespace i18n riêng

**File:** `packages/opencore-site/src/components/sections/FeatureGrid.tsx`

**Vấn đề:** Hiện tại dùng `useTranslations('home')` và key `feature1..4`, trùng với HeroSection.

**Thay đổi:**
```tsx
// TRƯỚC
const t = useTranslations('home');
// ...
<p>{t('feature1')}</p>  // Bị duplicate với HeroSection

// SAU
const t = useTranslations('featureGrid');
// ...
<p>{t('item1')}</p>  // Nội dung riêng biệt
```

**i18n keys cần thêm vào `vi.json` (namespace `featureGrid`):**
```json
"featureGrid": {
  "heading": "Năng lực nền tảng",
  "item1": "Phân tích dòng tiền thông minh với dữ liệu whale theo thời gian thực.",
  "item2": "Bộ lọc tín hiệu tùy chỉnh cho từng chiến lược giao dịch.",
  "item3": "Pyodide sandbox — chạy Python phân tích ngay trên trình duyệt.",
  "item4": "Engine VNBrokerCharts tự phát triển, hiệu năng cao, không phụ thuộc ngoài."
}
```

**i18n keys cần thêm vào `en.json` (namespace `featureGrid`):**
```json
"featureGrid": {
  "heading": "Platform capabilities",
  "item1": "Smart money-flow analysis with real-time whale data.",
  "item2": "Customizable signal filters for any trading strategy.",
  "item3": "Pyodide sandbox — run Python analysis directly in the browser.",
  "item4": "Custom-built VNBrokerCharts engine, high performance, zero external dependency."
}
```

**Thêm section heading trước grid** (tùy chọn, nếu Product Owner đồng ý):
```tsx
<div className="mb-8 text-center">
  <h2 className="text-2xl font-semibold text-white md:text-3xl">{t('heading')}</h2>
</div>
```

---

### S1-T2: Sửa PricingTable — Feature list riêng từng gói

**File:** `packages/opencore-site/src/components/sections/PricingTable.tsx`

**Vấn đề:** Ba gói có cùng bullet list hardcode, không phân biệt.

**Thay đổi cấu trúc data:**
```tsx
// TRƯỚC
const plans = [
  { key: 'free', accent: 'text-cyan-200', price: '0đ' },
  { key: 'pro', accent: 'text-amber-200', price: '299k/tháng' },
  { key: 'enterprise', accent: 'text-emerald-200', price: 'Liên hệ' }
] as const;

// SAU
const plans = [
  {
    key: 'free',
    accent: 'text-cyan-200',
    price: '0đ',
    featureKeys: ['freeF1', 'freeF2', 'freeF3'] as const,
  },
  {
    key: 'pro',
    accent: 'text-amber-200',
    price: '299k/tháng',
    featureKeys: ['proF1', 'proF2', 'proF3', 'proF4'] as const,
    highlight: true,
  },
  {
    key: 'enterprise',
    accent: 'text-emerald-200',
    price: 'Liên hệ',
    featureKeys: ['entF1', 'entF2', 'entF3', 'entF4'] as const,
  },
] as const;
```

**Render thay đổi:**
```tsx
// TRƯỚC (hardcode)
<ul className="mt-5 space-y-3 text-sm leading-7 text-slate-300">
  <li>• Bảng giá public rõ ràng</li>
  <li>• Tập trung vào điều nhà đầu tư cần</li>
  <li>• Nâng cấp theo hành trình sử dụng</li>
</ul>

// SAU (từ i18n)
<ul className="mt-5 space-y-3 text-sm leading-7 text-slate-300">
  {plan.featureKeys.map((fk) => (
    <li key={fk} className="flex items-start gap-2">
      <span className="mt-1 text-cyan-400">✓</span>
      {t(fk)}
    </li>
  ))}
</ul>
```

**Highlight gói Pro** — thêm class khi `plan.highlight === true`:
```tsx
<article
  key={plan.key}
  className={`card rounded-[1.75rem] p-6 ${plan.highlight ? 'ring-1 ring-amber-300/40' : ''}`}
>
  {plan.highlight && (
    <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
      {t('recommended')}
    </div>
  )}
  ...
</article>
```

**i18n keys cần thêm vào `vi.json` (namespace `pricing`):**
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

**i18n keys cần thêm vào `en.json` (namespace `pricing`):**
```json
"recommended": "Most popular",
"freeF1": "View basic market data",
"freeF2": "Track up to 3 stock symbols",
"freeF3": "Access Pyodide sandbox",
"proF1": "Everything in Free",
"proF2": "Unlimited whale and money-flow analysis",
"proF3": "Unlimited symbol watchlist",
"proF4": "Real-time signal alerts via email",
"entF1": "Everything in Pro",
"entF2": "Dedicated API integration for trading teams",
"entF3": "Priority 24/7 support",
"entF4": "Custom alert thresholds on request"
```

---

### S1-T3: Sửa TopNav — i18n subtitle "About Site"

**File:** `packages/opencore-site/src/components/layout/TopNav.tsx`

**Vấn đề:** `<div className="text-xs uppercase tracking-[0.28em] text-slate-400">About Site</div>` hardcode.

**Thay đổi:**
```tsx
// TRƯỚC
<div className="text-xs uppercase tracking-[0.28em] text-slate-400">About Site</div>

// SAU
<div className="text-xs uppercase tracking-[0.28em] text-slate-400">{t('siteSubtitle')}</div>
```

**i18n keys cần thêm vào `vi.json` (namespace `common`):**
```json
"siteSubtitle": "Nền tảng công khai"
```

**i18n keys cần thêm vào `en.json` (namespace `common`):**
```json
"siteSubtitle": "Public platform"
```

---

### S1-T4: Sửa Footer — i18n description

**File:** `packages/opencore-site/src/components/layout/Footer.tsx`

**Vấn đề:** `Public surface cho VNInvest, vnbroker và VNBrokerCharts.` hardcode tiếng Việt.

**Thay đổi:**
```tsx
// TRƯỚC
<p className="mt-3 max-w-sm text-sm leading-6 text-slate-400">
  Public surface cho VNInvest, vnbroker và VNBrokerCharts.
</p>

// SAU
<p className="mt-3 max-w-sm text-sm leading-6 text-slate-400">
  {t('footerDescription')}
</p>
```

**i18n keys cần thêm vào `vi.json` (namespace `common`):**
```json
"footerDescription": "Mặt tiền công khai cho VNInvest, vnbroker và VNBrokerCharts."
```

**i18n keys cần thêm vào `en.json` (namespace `common`):**
```json
"footerDescription": "The public front door for VNInvest, vnbroker, and VNBrokerCharts."
```

---

## SLICE 2 — ProductCards Upgrade

**File:** `packages/opencore-site/src/components/sections/ProductCards.tsx`

### S2-T1: Thêm SVG icon cho từng sản phẩm

Thêm object icons vào đầu file (trước `cards`):

```tsx
const PRODUCT_ICONS: Record<string, React.ReactNode> = {
  vninvest: (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <rect width="28" height="28" rx="8" fill="url(#gi)" />
      <path d="M7 19l4-7 3 5 3-3 4 5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <defs>
        <linearGradient id="gi" x1="0" y1="0" x2="28" y2="28">
          <stop stopColor="#FBBF24"/>
          <stop offset="1" stopColor="#F59E0B"/>
        </linearGradient>
      </defs>
    </svg>
  ),
  vnbroker: (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <rect width="28" height="28" rx="8" fill="url(#gs)" />
      <path d="M8 20v-4m4 4v-8m4 8v-5m4 5v-10" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/>
      <defs>
        <linearGradient id="gs" x1="0" y1="0" x2="28" y2="28">
          <stop stopColor="#22D3EE"/>
          <stop offset="1" stopColor="#0891B2"/>
        </linearGradient>
      </defs>
    </svg>
  ),
  chart: (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <rect width="28" height="28" rx="8" fill="url(#gc)" />
      <path d="M6 14l4-4 3 3 4-6 5 7" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="6" cy="14" r="1.5" fill="#fff"/>
      <circle cx="22" cy="14" r="1.5" fill="#fff"/>
      <defs>
        <linearGradient id="gc" x1="0" y1="0" x2="28" y2="28">
          <stop stopColor="#34D399"/>
          <stop offset="1" stopColor="#059669"/>
        </linearGradient>
      </defs>
    </svg>
  ),
};
```

### S2-T2: Thêm metric tagline cho từng sản phẩm

**i18n keys cần thêm vào `vi.json` (namespace `products`):**
```json
"vinvestMetric": "Quản lý danh mục · Robo-advisor · Tín hiệu whale",
"vnbrokerMetric": "600+ mã · HNX, HOSE, UPCOM · REST API",
"chartMetric": "KLine engine · CVD · Whale overlay · Real-time"
```

**i18n keys cần thêm vào `en.json` (namespace `products`):**
```json
"vinvestMetric": "Portfolio manager · Robo-advisor · Whale signals",
"vnbrokerMetric": "600+ symbols · HNX, HOSE, UPCOM · REST API",
"chartMetric": "KLine engine · CVD · Whale overlay · Real-time"
```

### S2-T3: Thêm CTA riêng từng sản phẩm

**i18n keys cần thêm vào `vi.json` (namespace `products`):**
```json
"vinvestCta": "Dùng ngay",
"vnbrokerCta": "Xem tài liệu",
"chartCta": "Xem demo chart"
```

**i18n keys cần thêm vào `en.json` (namespace `products`):**
```json
"vinvestCta": "Get started",
"vnbrokerCta": "View docs",
"chartCta": "See chart demo"
```

**URLs tương ứng:**
```tsx
const PRODUCT_CTAURL: Record<string, string> = {
  vninvest: 'https://vninvest.edusuccess.vn/register',
  vnbroker: '#vnbroker',  // sẽ update khi có trang /vnbroker
  chart: '/[locale]/chart',  // dùng localeHref
};
```

### S2-T4: Hover effect

Thêm class vào `<article>`:
```tsx
<article className="card rounded-[1.75rem] p-6 transition-transform duration-200 hover:-translate-y-1 hover:shadow-lg hover:shadow-cyan-500/10 cursor-default">
```

---

## SLICE 3 — Hero Right Panel (Blocked — Cần Asset)

**File:** `packages/opencore-site/src/components/sections/HeroSection.tsx`

**Trạng thái:** BLOCKED — cần Product Owner cung cấp:
- Screenshot dashboard VNInvest (dark theme, 800×500px tối thiểu)
- Hoặc xác nhận dùng placeholder card animation

**Nếu dùng placeholder animation** (không cần asset), implement pattern sau:

```tsx
// Thay thế right panel hiện tại bằng fake-dashboard card
<div className="card overflow-hidden rounded-[2rem] p-5">
  <div className="rounded-[1.5rem] border border-white/8 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6">
    {/* Mini chart placeholder */}
    <div className="mb-4 flex items-center justify-between">
      <span className="text-xs font-semibold text-cyan-200">VNM</span>
      <span className="text-xs text-emerald-400">+2.34%</span>
    </div>
    {/* SVG sparkline */}
    <svg viewBox="0 0 200 60" className="w-full" aria-hidden="true">
      <polyline
        points="0,45 30,35 60,42 90,20 120,28 150,15 170,22 200,10"
        fill="none" stroke="#22d3ee" strokeWidth="2" strokeLinecap="round"
      />
      <path
        d="M0,45 30,35 60,42 90,20 120,28 150,15 170,22 200,10 L200,60 L0,60 Z"
        fill="url(#sg)"
        opacity="0.18"
      />
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#22d3ee" stopOpacity="0.8"/>
          <stop offset="1" stopColor="#22d3ee" stopOpacity="0"/>
        </linearGradient>
      </defs>
    </svg>
    {/* Whale signal indicator */}
    <div className="mt-4 flex items-center gap-2 rounded-xl border border-amber-300/20 bg-amber-300/8 px-3 py-2">
      <span className="text-base">🐋</span>
      <span className="text-xs text-amber-200">{t('whaleSignal')}</span>
    </div>
    {/* 4 feature pills */}
    <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-300">
      <div className="rounded-xl border border-white/8 bg-white/5 px-3 py-2">{t('feature1')}</div>
      <div className="rounded-xl border border-white/8 bg-white/5 px-3 py-2">{t('feature2')}</div>
      <div className="rounded-xl border border-white/8 bg-white/5 px-3 py-2">{t('feature3')}</div>
      <div className="rounded-xl border border-white/8 bg-white/5 px-3 py-2">{t('feature4')}</div>
    </div>
  </div>
</div>
```

**i18n key cần thêm vào `vi.json` (namespace `home`):**
```json
"whaleSignal": "Tín hiệu cá mập · 2 lệnh lớn hôm nay"
```

**i18n key cần thêm vào `en.json` (namespace `home`):**
```json
"whaleSignal": "Whale signal · 2 large orders today"
```

---

## SLICE 4 — Stats Strip + WhySection

### S4-T1: Tạo StatsStrip component (NEW FILE)

**File mới:** `packages/opencore-site/src/components/sections/StatsStrip.tsx`

```tsx
'use client';

import { useTranslations } from 'next-intl';

export function StatsStrip() {
  const t = useTranslations('stats');

  const items = [
    { value: '600+', labelKey: 'symbolsLabel' },
    { value: '3', labelKey: 'productsLabel' },
    { value: '2', labelKey: 'languagesLabel' },
    { value: '100%', labelKey: 'openLabel' },
  ] as const;

  return (
    <section className="border-y border-white/8 bg-slate-950/40 py-8">
      <div className="container grid grid-cols-2 gap-6 md:grid-cols-4">
        {items.map((item) => (
          <div key={item.labelKey} className="text-center">
            <div className="text-3xl font-semibold text-white md:text-4xl">{item.value}</div>
            <div className="mt-1 text-xs uppercase tracking-[0.22em] text-slate-400">{t(item.labelKey)}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
```

**i18n keys cần thêm vào `vi.json` (namespace `stats`):**
```json
"stats": {
  "symbolsLabel": "Mã cổ phiếu",
  "productsLabel": "Sản phẩm",
  "languagesLabel": "Ngôn ngữ",
  "openLabel": "Mã nguồn mở"
}
```

**i18n keys cần thêm vào `en.json` (namespace `stats`):**
```json
"stats": {
  "symbolsLabel": "Stock symbols",
  "productsLabel": "Products",
  "languagesLabel": "Languages",
  "openLabel": "Open source"
}
```

### S4-T2: Thêm StatsStrip vào home page

**File:** `packages/opencore-site/src/app/[locale]/page.tsx`

```tsx
// Import
import { StatsStrip } from '@/components/sections/StatsStrip';

// Vị trí: sau HeroSection, trước ProductCards
<HeroSection />
<StatsStrip />
<ProductCards />
```

---

## SLICE 5 — Mobile Nav + Scroll Animations

### S5-T1: Mobile hamburger menu

**File:** `packages/opencore-site/src/components/layout/TopNav.tsx`

**Thêm state toggle và menu overlay:**

```tsx
'use client';

import { useState } from 'react';
// ... existing imports

export function TopNav() {
  const [mobileOpen, setMobileOpen] = useState(false);
  // ... existing code

  return (
    <header className="sticky top-0 z-40 border-b border-white/8 bg-slate-950/45 backdrop-blur-xl">
      <div className="container flex items-center justify-between gap-4 py-4">
        {/* Logo — unchanged */}

        {/* Desktop nav — unchanged */}
        <nav className="hidden items-center gap-6 text-sm text-slate-300 md:flex">
          ...
        </nav>

        <div className="flex items-center gap-3">
          <LangToggle />
          {/* Desktop CTA */}
          <a href={REGISTER_URL} className="hidden rounded-full bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 md:inline-flex">
            {t('primaryCta')}
          </a>
          {/* Mobile hamburger */}
          <button
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/8 text-slate-300 md:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? t('closeMenu') : t('openMenu')}
          >
            {mobileOpen ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu overlay */}
      {mobileOpen && (
        <div className="border-t border-white/8 bg-slate-950/95 px-4 pb-6 pt-4 md:hidden">
          <nav className="grid gap-4 text-sm text-slate-300">
            <Link href={localeHref(pathname, '')} onClick={() => setMobileOpen(false)}>{t('home')}</Link>
            <Link href={localeHref(pathname, '/chart')} onClick={() => setMobileOpen(false)}>{t('chart')}</Link>
            <Link href={localeHref(pathname, '/vnbroker')} onClick={() => setMobileOpen(false)}>{t('vnbroker')}</Link>
            <Link href={localeHref(pathname, '/pricing')} onClick={() => setMobileOpen(false)}>{t('pricing')}</Link>
            <Link href={localeHref(pathname, '/blog')} onClick={() => setMobileOpen(false)}>{t('blog')}</Link>
            <Link href={localeHref(pathname, '/legal')} onClick={() => setMobileOpen(false)}>{t('legal')}</Link>
          </nav>
          <a href={REGISTER_URL} className="mt-5 block rounded-full bg-cyan-300 py-3 text-center text-sm font-semibold text-slate-950">
            {t('primaryCta')}
          </a>
        </div>
      )}
    </header>
  );
}
```

**i18n keys cần thêm vào `vi.json` (namespace `common`):**
```json
"openMenu": "Mở menu",
"closeMenu": "Đóng menu"
```

**i18n keys cần thêm vào `en.json` (namespace `common`):**
```json
"openMenu": "Open menu",
"closeMenu": "Close menu"
```

### S5-T2: Scroll fade-in animation

**File:** `packages/opencore-site/src/app/globals.css`

Thêm vào cuối file:
```css
/* Scroll reveal */
.reveal {
  opacity: 0;
  transform: translateY(20px);
  transition: opacity 0.5s ease, transform 0.5s ease;
}
.reveal.visible {
  opacity: 1;
  transform: translateY(0);
}
```

**File mới:** `packages/opencore-site/src/hooks/useReveal.ts`

```ts
'use client';

import { useEffect, useRef } from 'react';

export function useReveal() {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('visible');
          obs.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return ref;
}
```

**Áp dụng vào các section (ví dụ `StatsStrip.tsx`):**
```tsx
import { useReveal } from '@/hooks/useReveal';

export function StatsStrip() {
  const ref = useReveal();
  return (
    <section ref={ref as React.RefObject<HTMLElement>} className="reveal border-y ...">
      ...
    </section>
  );
}
```

**Apply tương tự cho:** `ProductCards`, `FeatureGrid`, `PricingTable`.

---

## Tóm tắt tất cả file thay đổi

| File | Slice | Loại |
|------|-------|------|
| `src/components/sections/FeatureGrid.tsx` | S1 | Edit |
| `src/components/sections/PricingTable.tsx` | S1 | Edit |
| `src/components/layout/TopNav.tsx` | S1, S5 | Edit |
| `src/components/layout/Footer.tsx` | S1 | Edit |
| `src/components/sections/ProductCards.tsx` | S2 | Edit |
| `src/components/sections/HeroSection.tsx` | S3 | Edit |
| `src/components/sections/StatsStrip.tsx` | S4 | NEW |
| `src/app/[locale]/page.tsx` | S4 | Edit |
| `src/app/globals.css` | S5 | Edit |
| `src/hooks/useReveal.ts` | S5 | NEW |
| `src/messages/vi.json` | S1–S5 | Edit |
| `src/messages/en.json` | S1–S5 | Edit |

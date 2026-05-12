'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useReveal } from '@/hooks/useReveal';

function localeHref(pathname: string, targetPath: string) {
  const currentLocale = pathname.split('/')[1] || 'vi';
  return `/${currentLocale}${targetPath}`;
}

const PRODUCT_ICONS = {
  vninvest: (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <rect width="28" height="28" rx="8" fill="url(#gi)" />
      <path d="M7 19l4-7 3 5 3-3 4 5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <defs>
        <linearGradient id="gi" x1="0" y1="0" x2="28" y2="28">
          <stop stopColor="#FBBF24" />
          <stop offset="1" stopColor="#F59E0B" />
        </linearGradient>
      </defs>
    </svg>
  ),
  vnbroker: (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <rect width="28" height="28" rx="8" fill="url(#gs)" />
      <path d="M8 20v-4m4 4v-8m4 8v-5m4 5v-10" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
      <defs>
        <linearGradient id="gs" x1="0" y1="0" x2="28" y2="28">
          <stop stopColor="#22D3EE" />
          <stop offset="1" stopColor="#0891B2" />
        </linearGradient>
      </defs>
    </svg>
  ),
  chart: (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <rect width="28" height="28" rx="8" fill="url(#gc)" />
      <path d="M6 14l4-4 3 3 4-6 5 7" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <defs>
        <linearGradient id="gc" x1="0" y1="0" x2="28" y2="28">
          <stop stopColor="#34D399" />
          <stop offset="1" stopColor="#059669" />
        </linearGradient>
      </defs>
    </svg>
  ),
};

const PRODUCT_CARDS = [
  {
    id: 'vninvest' as const,
    accent: 'text-amber-300',
    titleKey: 'vinvestTitle' as const,
    textKey: 'vinvestText' as const,
    metricKey: 'vinvestMetric' as const,
    ctaKey: 'vinvestCta' as const,
    ctaHref: 'https://vninvest.edusuccess.vn/register',
    external: true,
  },
  {
    id: 'vnbroker' as const,
    accent: 'text-cyan-200',
    titleKey: 'vnbrokerTitle' as const,
    textKey: 'vnbrokerText' as const,
    metricKey: 'vnbrokerMetric' as const,
    ctaKey: 'vnbrokerCta' as const,
    ctaHref: '/vnbroker',
    external: false,
  },
  {
    id: 'chart' as const,
    accent: 'text-emerald-300',
    titleKey: 'chartTitle' as const,
    textKey: 'chartText' as const,
    metricKey: 'chartMetric' as const,
    ctaKey: 'chartCta' as const,
    ctaHref: '/chart',
    external: false,
  },
];

export function ProductCards() {
  const pathname = usePathname();
  const t = useTranslations('home');
  const products = useTranslations('products');
  const ref = useReveal();

  return (
    <section ref={ref} className="reveal container pb-10 md:pb-16">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.26em] text-cyan-200/80">{t('productHeading')}</div>
          <h2 className="mt-2 text-2xl font-semibold text-white md:text-3xl">{t('productHeading')}</h2>
        </div>
        <Link href={localeHref(pathname, '/pricing')} className="hidden text-sm text-cyan-200 md:inline-flex">
          {t('secondaryCta')}
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {PRODUCT_CARDS.map((card) => (
          <article
            key={card.id}
            className="card flex flex-col rounded-[1.75rem] p-6 transition-transform duration-200 hover:-translate-y-1 hover:shadow-lg hover:shadow-cyan-500/10"
          >
            <div className="mb-3">{PRODUCT_ICONS[card.id]}</div>
            <div className={`text-sm uppercase tracking-[0.24em] ${card.accent}`}>{products(card.titleKey)}</div>
            <p className="mt-2 text-xs tracking-wide text-slate-500">{products(card.metricKey)}</p>
            <p className="mt-3 flex-1 text-sm leading-7 text-slate-300">{products(card.textKey)}</p>
            <div className="mt-5">
              {card.external ? (
                <a
                  href={card.ctaHref}
                  className={`inline-flex rounded-full border border-white/10 px-4 py-2 text-xs font-semibold transition hover:border-white/30 ${card.accent}`}
                >
                  {products(card.ctaKey)} →
                </a>
              ) : (
                <Link
                  href={localeHref(pathname, card.ctaHref)}
                  className={`inline-flex rounded-full border border-white/10 px-4 py-2 text-xs font-semibold transition hover:border-white/30 ${card.accent}`}
                >
                  {products(card.ctaKey)} →
                </Link>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

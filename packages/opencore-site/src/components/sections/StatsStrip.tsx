'use client';

import { useTranslations } from 'next-intl';

const STATS = [
  { value: '600+', labelKey: 'symbolsLabel' as const },
  { value: '3', labelKey: 'productsLabel' as const },
  { value: '2', labelKey: 'languagesLabel' as const },
  { value: '100%', labelKey: 'openLabel' as const },
];

export function StatsStrip() {
  const t = useTranslations('stats');

  return (
    <section className="reveal border-y border-white/8 bg-slate-950/40 py-8">
      <div className="container grid grid-cols-2 gap-6 md:grid-cols-4">
        {STATS.map((item) => (
          <div key={item.labelKey} className="text-center">
            <div className="text-3xl font-semibold text-white md:text-4xl">{item.value}</div>
            <div className="mt-1 text-xs uppercase tracking-[0.22em] text-slate-400">{t(item.labelKey)}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

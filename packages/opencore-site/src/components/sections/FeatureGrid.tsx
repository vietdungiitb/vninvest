'use client';

import { useTranslations } from 'next-intl';

export function FeatureGrid() {
  const t = useTranslations('home');

  return (
    <section className="container pb-14 md:pb-20">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="card rounded-[1.5rem] p-5">
          <div className="text-xs uppercase tracking-[0.26em] text-slate-500">01</div>
          <p className="mt-3 text-sm leading-7 text-slate-200">{t('feature1')}</p>
        </div>
        <div className="card rounded-[1.5rem] p-5">
          <div className="text-xs uppercase tracking-[0.26em] text-slate-500">02</div>
          <p className="mt-3 text-sm leading-7 text-slate-200">{t('feature2')}</p>
        </div>
        <div className="card rounded-[1.5rem] p-5">
          <div className="text-xs uppercase tracking-[0.26em] text-slate-500">03</div>
          <p className="mt-3 text-sm leading-7 text-slate-200">{t('feature3')}</p>
        </div>
        <div className="card rounded-[1.5rem] p-5">
          <div className="text-xs uppercase tracking-[0.26em] text-slate-500">04</div>
          <p className="mt-3 text-sm leading-7 text-slate-200">{t('feature4')}</p>
        </div>
      </div>
    </section>
  );
}

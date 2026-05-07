'use client';

import { useTranslations } from 'next-intl';
import { useReveal } from '@/hooks/useReveal';

export function FeatureGrid() {
  const t = useTranslations('featureGrid');
  const ref = useReveal();

  return (
    <section ref={ref} className="reveal container pb-14 md:pb-20">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="card rounded-[1.5rem] p-5">
          <div className="text-xs uppercase tracking-[0.26em] text-slate-500">01</div>
          <p className="mt-3 text-sm leading-7 text-slate-200">{t('item1')}</p>
        </div>
        <div className="card rounded-[1.5rem] p-5">
          <div className="text-xs uppercase tracking-[0.26em] text-slate-500">02</div>
          <p className="mt-3 text-sm leading-7 text-slate-200">{t('item2')}</p>
        </div>
        <div className="card rounded-[1.5rem] p-5">
          <div className="text-xs uppercase tracking-[0.26em] text-slate-500">03</div>
          <p className="mt-3 text-sm leading-7 text-slate-200">{t('item3')}</p>
        </div>
        <div className="card rounded-[1.5rem] p-5">
          <div className="text-xs uppercase tracking-[0.26em] text-slate-500">04</div>
          <p className="mt-3 text-sm leading-7 text-slate-200">{t('item4')}</p>
        </div>
      </div>
    </section>
  );
}

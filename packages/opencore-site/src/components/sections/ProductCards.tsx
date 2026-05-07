'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

function localeHref(pathname: string, targetPath: string) {
  const currentLocale = pathname.split('/')[1] || 'vi';
  return `/${currentLocale}${targetPath}`;
}

const cards = [
  { key: 'vinvestTitle', bodyKey: 'vinvestBody', href: 'https://vninvest.edusuccess.vn/' },
  { key: 'vnstockTitle', bodyKey: 'vnstockBody', href: '#vnstock' },
  { key: 'chartTitle', bodyKey: 'chartBody', href: '#chart' }
] as const;

export function ProductCards() {
  const pathname = usePathname();
  const t = useTranslations('home');
  const products = useTranslations('products');

  return (
    <section className="container pb-10 md:pb-16">
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
        <article className="card rounded-[1.75rem] p-6">
          <div className="text-sm uppercase tracking-[0.24em] text-amber-300">{products('vinvestTitle')}</div>
          <p className="mt-3 text-sm leading-7 text-slate-300">{products('vinvestText')}</p>
        </article>
        <article className="card rounded-[1.75rem] p-6">
          <div className="text-sm uppercase tracking-[0.24em] text-cyan-200">{products('vnstockTitle')}</div>
          <p className="mt-3 text-sm leading-7 text-slate-300">{products('vnstockText')}</p>
        </article>
        <article className="card rounded-[1.75rem] p-6">
          <div className="text-sm uppercase tracking-[0.24em] text-emerald-300">{products('chartTitle')}</div>
          <p className="mt-3 text-sm leading-7 text-slate-300">{products('chartText')}</p>
        </article>
      </div>
    </section>
  );
}

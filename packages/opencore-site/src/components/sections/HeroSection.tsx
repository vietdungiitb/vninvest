'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { DashboardPreview } from './DashboardPreview';

function localeHref(pathname: string, targetPath: string) {
  const currentLocale = pathname.split('/')[1] || 'vi';
  return `/${currentLocale}${targetPath}`;
}

export function HeroSection() {
  const pathname = usePathname();
  const t = useTranslations('home');
  const common = useTranslations('common');

  return (
    <section className="container pb-12 pt-12 md:pb-20 md:pt-20">
      <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
        <div className="space-y-6">
          <div className="badge">{t('eyebrow')}</div>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight text-white md:text-5xl">
            <span className="gradient-text">{t('title')}</span>
          </h1>
          <p className="max-w-2xl text-base leading-8 text-slate-300 md:text-lg">{t('description')}</p>
          <div className="flex flex-wrap gap-3">
            <Link href={localeHref(pathname, '/chart')} className="rounded-full bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200">
              {common('learnMore')}
            </Link>
            <a
              href="https://vninvest.edusuccess.vn/register"
              className="rounded-full border border-slate-600/70 bg-slate-950/50 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:border-amber-300/70 hover:text-amber-100"
            >
              {t('primaryCta')}
            </a>
          </div>
          <div className="grid gap-3 rounded-3xl border border-white/8 bg-slate-950/40 p-4 md:grid-cols-3">
            <div>
              <div className="text-xs uppercase tracking-[0.24em] text-slate-500">{t('featureTitle')}</div>
              <div className="mt-1 text-sm font-medium text-white">{t('statsLabel')}</div>
            </div>
            <div className="md:col-span-2 text-sm leading-6 text-slate-300">{t('statsValue')}</div>
          </div>
        </div>
        <DashboardPreview />
      </div>
    </section>
  );
}

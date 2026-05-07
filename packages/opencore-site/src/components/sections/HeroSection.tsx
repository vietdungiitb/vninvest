'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

function localeHref(pathname: string, targetPath: string) {
  const currentLocale = pathname.split('/')[1] || 'vi';
  return `/${currentLocale}${targetPath}`;
}

export function HeroSection() {
  const pathname = usePathname();
  const t = useTranslations('home');
  const common = useTranslations('common');

  return (
    <section className="container pb-10 pt-10 md:pb-16 md:pt-16">
      <div className="grid gap-8 lg:grid-cols-[1.12fr_0.88fr] lg:items-center">
        <div className="space-y-6">
          <div className="badge">{t('eyebrow')}</div>
          <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-white md:text-6xl">
            <span className="gradient-text">{t('title')}</span>
          </h1>
          <p className="max-w-2xl text-base leading-8 text-slate-300 md:text-lg">{t('description')}</p>
          <div className="flex flex-wrap gap-3">
            <Link href={`/${pathname.split('/')[1] || 'vi'}/chart`} className="rounded-full bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200">
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
        <div className="card overflow-hidden rounded-[2rem] p-5">
          <div className="rounded-[1.5rem] border border-white/8 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6">
            <div className="badge">{t('eyebrow')}</div>
            <div className="mt-5 text-lg font-semibold text-white">{t('featureHeading')}</div>
            <p className="mt-3 text-sm leading-7 text-slate-300">{t('featureLead')}</p>
            <div className="mt-6 grid gap-3 text-sm text-slate-200">
              <div className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3">{t('feature1')}</div>
              <div className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3">{t('feature2')}</div>
              <div className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3">{t('feature3')}</div>
              <div className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3">{t('feature4')}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

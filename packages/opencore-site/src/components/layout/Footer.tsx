'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

function localeHref(pathname: string, targetPath: string) {
  const currentLocale = pathname.split('/')[1] || 'vi';
  return `/${currentLocale}${targetPath}`;
}

export function Footer() {
  const pathname = usePathname();
  const t = useTranslations('common');

  return (
    <footer className="border-t border-white/8 bg-slate-950/40">
      <div className="container grid gap-6 py-10 md:grid-cols-3">
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-200">VNInvest</div>
          <p className="mt-3 max-w-sm text-sm leading-6 text-slate-400">
            {t('footerDescription')}
          </p>
        </div>
        <div className="text-sm text-slate-300">
          <div className="mb-3 font-semibold text-white">{t('home')}</div>
          <div className="grid gap-2">
            <Link href={localeHref(pathname, '/chart')}>{t('chart')}</Link>
            <Link href={localeHref(pathname, '/vnstock')}>{t('vnstock')}</Link>
            <Link href={localeHref(pathname, '/pricing')}>{t('pricing')}</Link>
            <Link href={localeHref(pathname, '/blog')}>{t('blog')}</Link>
          </div>
        </div>
        <div className="text-sm text-slate-300">
          <div className="mb-3 font-semibold text-white">{t('legal')}</div>
          <div className="grid gap-2">
            <Link href={localeHref(pathname, '/legal')}>{t('legal')}</Link>
            <a href="https://github.com/vietdungiitb/vnstockcharts" target="_blank" rel="noreferrer">
              GitHub
            </a>
          </div>
        </div>
      </div>
      <div className="border-t border-white/8 py-4 text-center text-xs text-slate-500">
        © 2026 VNInvest. All rights reserved.
      </div>
    </footer>
  );
}

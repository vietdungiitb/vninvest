'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { LangToggle } from './LangToggle';

const REGISTER_URL = 'https://vninvest.edusuccess.vn/register';

function localeHref(pathname: string, targetPath: string) {
  const currentLocale = pathname.split('/')[1] || 'vi';
  return `/${currentLocale}${targetPath}`;
}

export function TopNav() {
  const pathname = usePathname();
  const t = useTranslations('common');

  return (
    <header className="sticky top-0 z-40 border-b border-white/8 bg-slate-950/45 backdrop-blur-xl">
      <div className="container flex items-center justify-between gap-4 py-4">
        <Link href={localeHref(pathname, '')} className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-amber-300 text-slate-950 shadow-lg shadow-cyan-500/20">
            <span className="text-base font-black">VN</span>
          </div>
          <div>
            <div className="text-sm font-semibold tracking-[0.22em] text-cyan-200">{t('siteName')}</div>
            <div className="text-xs uppercase tracking-[0.28em] text-slate-400">About Site</div>
          </div>
        </Link>

        <nav className="hidden items-center gap-6 text-sm text-slate-300 md:flex">
          <Link href={localeHref(pathname, '')}>{t('home')}</Link>
          <Link href={localeHref(pathname, '/chart')}>{t('chart')}</Link>
          <Link href={localeHref(pathname, '/vnstock')}>{t('vnstock')}</Link>
          <Link href={localeHref(pathname, '/pricing')}>{t('pricing')}</Link>
          <Link href={localeHref(pathname, '/blog')}>{t('blog')}</Link>
          <Link href={localeHref(pathname, '/legal')}>{t('legal')}</Link>
        </nav>

        <div className="flex items-center gap-3">
          <LangToggle />
          <a
            href={REGISTER_URL}
            className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
          >
            {t('primaryCta')}
          </a>
        </div>
      </div>
    </header>
  );
}

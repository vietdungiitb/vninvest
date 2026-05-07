'use client';

import { useState } from 'react';
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const t = useTranslations('common');

  const navLinks = [
    { key: 'home' as const, href: '' },
    { key: 'chart' as const, href: '/chart' },
    { key: 'vnstock' as const, href: '/vnstock' },
    { key: 'pricing' as const, href: '/pricing' },
    { key: 'blog' as const, href: '/blog' },
    { key: 'legal' as const, href: '/legal' },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-white/8 bg-slate-950/45 backdrop-blur-xl">
      <div className="container flex items-center justify-between gap-4 py-4">
        <Link href={localeHref(pathname, '')} className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-amber-300 text-slate-950 shadow-lg shadow-cyan-500/20">
            <span className="text-base font-black">VN</span>
          </div>
          <div>
            <div className="text-sm font-semibold tracking-[0.22em] text-cyan-200">{t('siteName')}</div>
            <div className="text-xs uppercase tracking-[0.28em] text-slate-400">{t('siteSubtitle')}</div>
          </div>
        </Link>

        <nav className="hidden items-center gap-6 text-sm text-slate-300 md:flex">
          {navLinks.map(({ key, href }) => (
            <Link key={key} href={localeHref(pathname, href)}>{t(key)}</Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <LangToggle />
          <a
            href={REGISTER_URL}
            className="hidden rounded-full bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 md:inline-flex"
          >
            {t('primaryCta')}
          </a>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/8 text-slate-300 transition hover:border-white/20 md:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? t('closeMenu') : t('openMenu')}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-white/8 bg-slate-950/95 px-4 pb-6 pt-4 md:hidden">
          <nav className="grid gap-4 text-sm text-slate-300">
            {navLinks.map(({ key, href }) => (
              <Link
                key={key}
                href={localeHref(pathname, href)}
                onClick={() => setMobileOpen(false)}
              >
                {t(key)}
              </Link>
            ))}
          </nav>
          <a
            href={REGISTER_URL}
            className="mt-5 block rounded-full bg-cyan-300 py-3 text-center text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
            onClick={() => setMobileOpen(false)}
          >
            {t('primaryCta')}
          </a>
        </div>
      )}
    </header>
  );
}


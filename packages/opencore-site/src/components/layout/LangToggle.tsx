'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { defaultLocale, isLocale, type Locale } from '@/i18n/routing';

function swapLocale(pathname: string, nextLocale: Locale) {
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length === 0) {
    return `/${nextLocale}`;
  }

  if (isLocale(segments[0])) {
    segments[0] = nextLocale;
  } else {
    segments.unshift(nextLocale);
  }

  return `/${segments.join('/')}`;
}

export function LangToggle() {
  const pathname = usePathname();
  const t = useTranslations('common');
  const currentLocale = pathname.split('/')[1];
  const activeLocale: Locale = isLocale(currentLocale) ? currentLocale : defaultLocale;
  const nextLocale: Locale = activeLocale === 'vi' ? 'en' : 'vi';
  const href = swapLocale(pathname, nextLocale);

  return (
    <Link
      href={href}
      className="inline-flex items-center rounded-full border border-slate-700/80 bg-slate-950/60 px-3 py-2 text-sm font-medium text-slate-100 transition hover:border-cyan-400/70 hover:text-cyan-200"
      aria-label={t(`languageSwitchTo${nextLocale === 'vi' ? 'Vi' : 'En'}`)}
    >
      {nextLocale === 'vi' ? t('languageSwitchToVi') : t('languageSwitchToEn')}
    </Link>
  );
}

"use client";

import Link from 'next/link';
import { useTranslations } from 'next-intl';

export default function NotFound() {
  const t = useTranslations('errors');

  return (
    <div className="container flex min-h-[60vh] flex-col items-center justify-center gap-4 py-16 text-center">
      <div className="badge">404</div>
      <h1 className="text-3xl font-semibold tracking-tight text-white">{t('notFoundTitle')}</h1>
      <p className="max-w-xl text-sm leading-7 text-slate-300">{t('notFoundBody')}</p>
      <Link href="/vi" className="rounded-full bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200">
        {t('notFoundTitle')}
      </Link>
    </div>
  );
}

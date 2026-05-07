'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

const plans = [
  { key: 'free', accent: 'text-cyan-200', price: '0đ' },
  { key: 'pro', accent: 'text-amber-200', price: '299k/tháng' },
  { key: 'enterprise', accent: 'text-emerald-200', price: 'Liên hệ' }
] as const;

function localeHref(pathname: string, targetPath: string) {
  const currentLocale = pathname.split('/')[1] || 'vi';
  return `/${currentLocale}${targetPath}`;
}

export function PricingTable() {
  const pathname = usePathname();
  const t = useTranslations('pricing');
  const common = useTranslations('common');

  return (
    <section className="container pb-16 md:pb-20">
      <div className="mb-6 space-y-3">
        <div className="badge">{t('badge')}</div>
        <h2 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">{t('title')}</h2>
        <p className="max-w-3xl text-sm leading-7 text-slate-300 md:text-base">{t('lead')}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {plans.map((plan) => (
          <article key={plan.key} className="card rounded-[1.75rem] p-6">
            <div className={`text-xs uppercase tracking-[0.24em] ${plan.accent}`}>{t(plan.key)}</div>
            <div className="mt-3 text-3xl font-semibold text-white">{plan.price}</div>
            <ul className="mt-5 space-y-3 text-sm leading-7 text-slate-300">
              <li>• Bảng giá public rõ ràng</li>
              <li>• Tập trung vào điều nhà đầu tư cần</li>
              <li>• Nâng cấp theo hành trình sử dụng</li>
            </ul>
          </article>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <a
          href="https://vninvest.edusuccess.vn/register"
          className="rounded-full bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
        >
          {t('cta')}
        </a>
        <Link href={localeHref(pathname, '/chart')} className="rounded-full border border-slate-600/70 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:border-amber-300/70">
          {common('learnMore')}
        </Link>
      </div>
    </section>
  );
}

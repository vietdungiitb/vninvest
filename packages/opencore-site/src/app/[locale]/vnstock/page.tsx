import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { SiteFrame } from '@/components/layout/SiteFrame';
import { buildPageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'seo' });
  return buildPageMetadata({
    title: `${t('siteName')} — vnstock`,
    description: t('description'),
    pathname: `/${locale}/vnstock`,
    locale: locale === 'en' ? 'en' : 'vi'
  });
}

export default function VnstockPage() {
  return (
    <SiteFrame>
      <section className="container py-14 md:py-20">
        <div className="card rounded-[1.75rem] p-6 md:p-10">
          <div className="badge">vnstock</div>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-white md:text-5xl">vnstock: Python library cho dữ liệu thị trường Việt Nam</h1>
          <p className="mt-4 max-w-3xl text-base leading-8 text-slate-300 md:text-lg">
            vnstock là công cụ research và automation để kéo dữ liệu thị trường Việt Nam vào Python notebook, backtest hoặc pipeline nội bộ.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-white/8 bg-white/5 p-4 text-sm text-slate-200">`pip install vnstock`</div>
            <div className="rounded-2xl border border-white/8 bg-white/5 p-4 text-sm text-slate-200">Lấy dữ liệu giá, profile và listing</div>
            <div className="rounded-2xl border border-white/8 bg-white/5 p-4 text-sm text-slate-200">Chạy thử ngay trong playground</div>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="./playground" className="rounded-full bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200">Mở playground</Link>
            <Link href="../chart" className="rounded-full border border-slate-600/70 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:border-amber-300/70">Xem biểu đồ</Link>
          </div>
        </div>
      </section>
    </SiteFrame>
  );
}

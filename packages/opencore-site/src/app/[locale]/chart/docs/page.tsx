import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { SiteFrame } from '@/components/layout/SiteFrame';
import { buildPageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'seo' });
  return buildPageMetadata({
    title: `${t('siteName')} — Chart docs`,
    description: t('description'),
    pathname: `/${locale}/chart/docs`,
    locale: locale === 'en' ? 'en' : 'vi'
  });
}

export default function ChartDocsPage() {
  return (
    <SiteFrame>
      <section className="container py-14 md:py-20">
        <div className="card rounded-[1.75rem] p-6 md:p-10">
          <div className="badge">Tài liệu component</div>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-white md:text-5xl">VNStockCharts API</h1>
          <div className="mt-6 space-y-6 text-sm leading-7 text-slate-300 md:text-base">
            <p><strong className="text-white">Install:</strong> `npm install vnstockcharts`</p>
            <p><strong className="text-white">Core component:</strong> `VNStockChart` nhận `data`, `symbol`, `timeframe`, `locale`, `theme` và `children` overlay.</p>
            <p><strong className="text-white">Overlay:</strong> `WhaleBubbleOverlay` nhận `events` dạng <code>{'{ ts, price, side, matchedValue, severity }'}</code>.</p>
            <p><strong className="text-white">Data path:</strong> client fetch `/api/bars/[symbol]` rồi truyền bars thẳng vào chart, không gọi KLineCharts.</p>
          </div>
          <pre className="mt-8 overflow-x-auto rounded-[1.5rem] border border-white/8 bg-slate-950/80 p-5 text-sm text-slate-200">
{`<VNStockChart data={bars} symbol="VNM" timeframe="1d" locale="vi" theme="dark">
  <WhaleBubbleOverlay events={whaleEvents} />
</VNStockChart>`}
          </pre>
        </div>
      </section>
    </SiteFrame>
  );
}

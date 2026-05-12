import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { SiteFrame } from '@/components/layout/SiteFrame';
import { buildPageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'seo' });
  return buildPageMetadata({
    title: `${t('siteName')} — Chart embed`,
    description: t('description'),
    pathname: `/${locale}/chart/embed`,
    locale: locale === 'en' ? 'en' : 'vi'
  });
}

export default function ChartEmbedPage() {
  return (
    <SiteFrame>
      <section className="container py-14 md:py-20">
        <div className="card rounded-[1.75rem] p-6 md:p-10">
          <div className="badge">Embed</div>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-white md:text-5xl">Mã nhúng chart</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300 md:text-base">
            Tạo snippet để nhúng biểu đồ VNBrokerCharts vào dashboard nội bộ. Trước phase 1, đây là một generator đơn giản với cấu hình rõ ràng.
          </p>
          <pre className="mt-8 overflow-x-auto rounded-[1.5rem] border border-white/8 bg-slate-950/80 p-5 text-sm text-slate-200">
{`<iframe
  src="https://about.vninvest.edusuccess.vn/vi/chart"
  width="100%"
  height="760"
  loading="lazy"
></iframe>`}
          </pre>
        </div>
      </section>
    </SiteFrame>
  );
}

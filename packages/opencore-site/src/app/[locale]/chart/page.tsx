import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { SiteFrame } from '@/components/layout/SiteFrame';
import { ChartDemo } from '@/components/sections/ChartDemo';
import { buildPageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'seo' });
  return buildPageMetadata({
    title: `${t('siteName')} — ${locale === 'en' ? 'VNBrokerCharts live demo' : 'VNBrokerCharts bản demo trực tiếp'}`,
    description: t('description'),
    pathname: `/${locale}/chart`,
    locale: locale === 'en' ? 'en' : 'vi'
  });
}

export default function ChartPage() {
  return (
    <SiteFrame>
      <ChartDemo />
    </SiteFrame>
  );
}

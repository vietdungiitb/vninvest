import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { SiteFrame } from '@/components/layout/SiteFrame';
import { PricingTable } from '@/components/sections/PricingTable';
import { buildPageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'seo' });
  return buildPageMetadata({
    title: `${t('siteName')} — Pricing`,
    description: t('description'),
    pathname: `/${locale}/pricing`,
    locale: locale === 'en' ? 'en' : 'vi'
  });
}

export default function PricingPage() {
  return (
    <SiteFrame>
      <PricingTable />
    </SiteFrame>
  );
}

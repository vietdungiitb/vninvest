import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { HeroSection } from '@/components/sections/HeroSection';
import { ProductCards } from '@/components/sections/ProductCards';
import { FeatureGrid } from '@/components/sections/FeatureGrid';
import { StatsStrip } from '@/components/sections/StatsStrip';
import { SiteFrame } from '@/components/layout/SiteFrame';
import { buildPageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'seo' });
  return buildPageMetadata({
    title: `${t('siteName')} — ${locale === 'en' ? 'Ecosystem Hub' : 'Hệ sinh thái công khai'}`,
    description: t('description'),
    pathname: `/${locale}`,
    locale: locale === 'en' ? 'en' : 'vi'
  });
}

export default function HomePage() {
  return (
    <SiteFrame>
      <HeroSection />
      <StatsStrip />
      <ProductCards />
      <FeatureGrid />
    </SiteFrame>
  );
}

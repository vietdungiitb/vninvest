import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { SiteFrame } from '@/components/layout/SiteFrame';
import { PlaygroundPanel } from '@/components/sections/PlaygroundPanel';
import { buildPageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'seo' });
  return buildPageMetadata({
    title: `${t('siteName')} — Playground`,
    description: t('description'),
    pathname: `/${locale}/vnstock/playground`,
    locale: locale === 'en' ? 'en' : 'vi'
  });
}

export default function PlaygroundPage() {
  return (
    <SiteFrame>
      <PlaygroundPanel />
    </SiteFrame>
  );
}

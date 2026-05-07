import type { Metadata } from 'next';

export const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://about.vninvest.edusuccess.vn';

export function canonicalUrl(pathname: string) {
  return new URL(pathname, siteUrl).toString();
}

export function buildPageMetadata({
  title,
  description,
  pathname,
  locale = 'vi'
}: {
  title: string;
  description: string;
  pathname: string;
  locale?: 'vi' | 'en';
}): Metadata {
  const url = canonicalUrl(pathname);

  return {
    metadataBase: new URL(siteUrl),
    title,
    description,
    alternates: {
      canonical: url,
      languages: {
        vi: canonicalUrl(pathname.replace(/^\/(vi|en)/, '/vi')),
        en: canonicalUrl(pathname.replace(/^\/(vi|en)/, '/en'))
      }
    },
    openGraph: {
      title,
      description,
      url,
      siteName: 'VNInvest',
      locale: locale === 'vi' ? 'vi_VN' : 'en_US',
      type: 'website'
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description
    }
  };
}

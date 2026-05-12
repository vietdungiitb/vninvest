import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://about.vninvest.edusuccess.vn';
  const now = new Date();
  const routes = [
    '/',
    '/chart',
    '/chart/docs',
    '/chart/embed',
    '/vnbroker',
    '/vnbroker/playground',
    '/pricing',
    '/blog',
    '/legal'
  ];

  return ['vi', 'en'].flatMap((locale) =>
    routes.map((route) => ({
      url: new URL(`/${locale}${route}`, siteUrl).toString(),
      lastModified: now,
      changeFrequency: route === '/blog' ? 'daily' : 'weekly',
      priority: route === '/' ? 1 : 0.7
    }))
  );
}

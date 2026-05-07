import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { SiteFrame } from '@/components/layout/SiteFrame';
import { blogPosts, getBlogPostBySlug } from '@/lib/blog';
import { buildPageMetadata } from '@/lib/seo';

export function generateStaticParams() {
  return blogPosts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: 'seo' });
  const post = getBlogPostBySlug(slug);

  if (!post) {
    return buildPageMetadata({
      title: `${t('siteName')} — Blog`,
      description: t('description'),
      pathname: `/${locale}/blog/${slug}`,
      locale: locale === 'en' ? 'en' : 'vi'
    });
  }

  return buildPageMetadata({
    title: `${post.title} — ${t('siteName')}`,
    description: post.summary,
    pathname: `/${locale}/blog/${slug}`,
    locale: locale === 'en' ? 'en' : 'vi'
  });
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getBlogPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const Content = post.Component;

  return (
    <SiteFrame>
      <section className="container py-14 md:py-20">
        <article className="card rounded-[1.75rem] p-6 md:p-10">
          <div className="text-xs uppercase tracking-[0.24em] text-slate-500">{post.date} · {post.readingTime}</div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-5xl">{post.title}</h1>
          <div className="prose prose-invert mt-8 max-w-none">
            <Content />
          </div>
        </article>
      </section>
    </SiteFrame>
  );
}

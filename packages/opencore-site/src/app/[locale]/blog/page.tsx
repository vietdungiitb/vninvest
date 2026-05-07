import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { SiteFrame } from '@/components/layout/SiteFrame';
import { blogPosts } from '@/lib/blog';
import { buildPageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'seo' });
  return buildPageMetadata({
    title: `${t('siteName')} — Blog`,
    description: t('description'),
    pathname: `/${locale}/blog`,
    locale: locale === 'en' ? 'en' : 'vi'
  });
}

export default async function BlogPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;

  return (
    <SiteFrame>
      <section className="container py-14 md:py-20">
        <div className="mb-6 space-y-3">
          <div className="badge">Blog</div>
          <h1 className="text-3xl font-semibold tracking-tight text-white md:text-5xl">Bài viết và hướng dẫn</h1>
          <p className="max-w-3xl text-sm leading-7 text-slate-300 md:text-base">
            Những ghi chú ngắn, thẳng và đủ rõ để đội code hoặc người dùng mới không phải hỏi lại.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {blogPosts.map((post) => (
            <article key={post.slug} className="card rounded-[1.75rem] p-5">
              <div className="text-xs uppercase tracking-[0.24em] text-slate-500">{post.date} · {post.readingTime}</div>
              <h2 className="mt-3 text-xl font-semibold text-white">{post.title}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-300">{post.summary}</p>
              <Link href={`/${locale}/blog/${post.slug}`} className="mt-5 inline-flex text-sm font-semibold text-cyan-200 hover:text-cyan-100">
                Đọc bài viết →
              </Link>
            </article>
          ))}
        </div>
      </section>
    </SiteFrame>
  );
}

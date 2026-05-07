import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { SiteFrame } from '@/components/layout/SiteFrame';
import { buildPageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'seo' });
  return buildPageMetadata({
    title: `${t('siteName')} — Legal`,
    description: t('description'),
    pathname: `/${locale}/legal`,
    locale: locale === 'en' ? 'en' : 'vi'
  });
}

export default function LegalPage() {
  return (
    <SiteFrame>
      <section className="container py-14 md:py-20">
        <div className="card rounded-[1.75rem] p-6 md:p-10">
          <div className="badge">Pháp lý</div>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-white md:text-5xl">Điều khoản và quyền riêng tư</h1>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <article className="rounded-[1.5rem] border border-white/8 bg-white/5 p-5">
              <h2 className="text-xl font-semibold text-white">Điều khoản sử dụng</h2>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                Site công khai chỉ dành cho giới thiệu sản phẩm, không cung cấp tư vấn đầu tư cá nhân hóa và không lưu session người dùng.
              </p>
            </article>
            <article className="rounded-[1.5rem] border border-white/8 bg-white/5 p-5">
              <h2 className="text-xl font-semibold text-white">Chính sách quyền riêng tư</h2>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                Mọi relay công khai đều được whitelist và rate limit. Không có form thu thập dữ liệu nhạy cảm trên about site phase 1.
              </p>
            </article>
          </div>
        </div>
      </section>
    </SiteFrame>
  );
}

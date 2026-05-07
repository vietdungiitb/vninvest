import type { ComponentType } from 'react';
import VnInvestIntro from '@/content/blog/vninvest-intro.mdx';
import VnstockQuickstart from '@/content/blog/vnstock-quickstart.mdx';
import VnstockChartsWhaleGuide from '@/content/blog/vnstockcharts-whale-guide.mdx';

export type BlogPost = {
  slug: string;
  title: string;
  summary: string;
  date: string;
  readingTime: string;
  Component: ComponentType;
};

export const blogPosts: BlogPost[] = [
  {
    slug: 'vninvest-intro',
    title: 'VNInvest: vì sao chúng tôi xây một hệ sinh thái public',
    summary: 'Bối cảnh mặt tiền công khai và cách một site public giúp người mới hiểu toàn bộ stack.',
    date: '2026-05-06',
    readingTime: '4 phút',
    Component: VnInvestIntro
  },
  {
    slug: 'vnstock-quickstart',
    title: 'vnstock quickstart cho nhà nghiên cứu dữ liệu',
    summary: 'Cách lấy dữ liệu VN từ Python nhanh, sạch và có thể nhúng vào research workflow.',
    date: '2026-05-06',
    readingTime: '5 phút',
    Component: VnstockQuickstart
  },
  {
    slug: 'vnstockcharts-whale-guide',
    title: 'VNStockCharts và whale flow trên biểu đồ',
    summary: 'Tại sao chúng tôi thay KLineCharts bằng chart engine tự phát triển cho thị trường Việt Nam.',
    date: '2026-05-06',
    readingTime: '6 phút',
    Component: VnstockChartsWhaleGuide
  }
];

export function getBlogPostBySlug(slug: string) {
  return blogPosts.find((post) => post.slug === slug);
}

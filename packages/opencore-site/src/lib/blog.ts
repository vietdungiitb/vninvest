import type { ComponentType } from 'react';
import VnInvestIntro from '@/content/blog/vninvest-intro.mdx';
import VnstockQuickstart from '@/content/blog/vnstock-quickstart.mdx';
import VnstockChartsWhaleGuide from '@/content/blog/vnstockcharts-whale-guide.mdx';
import RealtimeArchitecture from '@/content/blog/realtime-architecture.mdx';

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
    title: 'VNInvest: nền tảng theo dõi danh mục và robo-advisor cho thị trường Việt Nam',
    summary: 'Tổng quan hệ sinh thái Open Core — SaaS, vnstock và VNStockCharts — và lý do chúng tôi xây ba sản phẩm liên kết thay vì một ứng dụng đơn lẻ.',
    date: '2026-05-07',
    readingTime: '4 phút',
    Component: VnInvestIntro
  },
  {
    slug: 'vnstock-quickstart',
    title: 'vnstock quickstart cho nhà nghiên cứu dữ liệu',
    summary: 'Cài đặt, lấy giá lịch sử, intraday và thông tin doanh nghiệp chứng khoán Việt Nam bằng Python trong vài dòng lệnh.',
    date: '2026-05-07',
    readingTime: '5 phút',
    Component: VnstockQuickstart
  },
  {
    slug: 'vnstockcharts-whale-guide',
    title: 'VNStockCharts: whale flow, CVD và biểu đồ theo ngữ cảnh phiên',
    summary: 'Tại sao cần chart engine riêng, cách whale marker và CVD bám session truth, và nguyên tắc độ trung thực thị giác.',
    date: '2026-05-07',
    readingTime: '6 phút',
    Component: VnstockChartsWhaleGuide
  },
  {
    slug: 'realtime-architecture',
    title: 'Kiến trúc realtime: từ vnstock API đến WebSocket trình duyệt',
    summary: 'Luồng dữ liệu đầy đủ: prefetch Celery, Redis pub/sub, Django Channels, time-based policy và provider fallback khi rate-limit.',
    date: '2026-05-07',
    readingTime: '5 phút',
    Component: RealtimeArchitecture
  }
];

export function getBlogPostBySlug(slug: string) {
  return blogPosts.find((post) => post.slug === slug);
}

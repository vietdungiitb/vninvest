import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
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

// Map slug → static MDX component (for rendering)
const componentMap: Record<string, ComponentType> = {
  'vninvest-intro': VnInvestIntro,
  'vnstock-quickstart': VnstockQuickstart,
  'vnstockcharts-whale-guide': VnstockChartsWhaleGuide,
  'realtime-architecture': RealtimeArchitecture,
};

const CONTENT_DIR = path.join(process.cwd(), 'src/content/blog');

function loadBlogPosts(): BlogPost[] {
  const files = fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith('.mdx'));
  return files
    .map((file) => {
      const slug = file.replace(/\.mdx$/, '');
      const raw = fs.readFileSync(path.join(CONTENT_DIR, file), 'utf-8');
      const { data } = matter(raw);
      return {
        slug,
        title: data.title || slug,
        summary: data.summary || '',
        date: data.date ? String(data.date).slice(0, 10) : '',
        readingTime: data.readingTime || '5 phút',
        Component: componentMap[slug] ?? (() => null),
      };
    })
    .sort((a, b) => (b.date > a.date ? 1 : -1));
}

export const blogPosts: BlogPost[] = loadBlogPosts();

export function getBlogPostBySlug(slug: string) {
  return blogPosts.find((post) => post.slug === slug);
}

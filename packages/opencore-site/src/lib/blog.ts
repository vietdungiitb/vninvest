import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

export type BlogPost = {
  slug: string;
  title: string;
  summary: string;
  date: string;
  readingTime: string;
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
      };
    })
    .sort((a, b) => (b.date > a.date ? 1 : -1));
}

export const blogPosts: BlogPost[] = loadBlogPosts();

export function getBlogPostBySlug(slug: string) {
  return blogPosts.find((post) => post.slug === slug);
}

/** Đọc raw MDX source của một bài — dùng cho MDXRemote ở slug page */
export function getBlogPostSource(slug: string): string | null {
  const filePath = path.join(CONTENT_DIR, `${slug}.mdx`);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, 'utf-8');
}

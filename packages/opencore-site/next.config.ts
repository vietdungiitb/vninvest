import type { NextConfig } from 'next';
import createMDX from '@next/mdx';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');
const withMDX = createMDX({
  extension: /\.mdx$/
});

const isProduction = process.env.NODE_ENV === 'production';
const csp = isProduction
  ? [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com",
      "style-src 'self' 'unsafe-inline' https://unpkg.com",
      "img-src 'self' data: https:",
      "connect-src 'self' https://cdn.jsdelivr.net https://unpkg.com https://api.github.com https://github.com",
      "worker-src 'self' blob:",
      "frame-ancestors 'none'"
    ].join('; ')
  : [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:* https://cdn.jsdelivr.net https://unpkg.com",
      "style-src 'self' 'unsafe-inline' https://unpkg.com",
      "img-src 'self' data: https:",
      "connect-src 'self' http://localhost:* https://cdn.jsdelivr.net https://unpkg.com https://api.github.com https://github.com",
      "worker-src 'self' blob:"
    ].join('; ');

const nextConfig: NextConfig = {
  output: 'standalone',
  pageExtensions: ['ts', 'tsx'],
  experimental: {
    externalDir: true
  },
  async rewrites() {
    return [
      { source: '/admin', destination: '/admin/index.html' }
    ];
  },
  async headers() {
    const adminCsp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com",
      "style-src 'self' 'unsafe-inline' https://unpkg.com",
      "img-src 'self' data: https:",
      "connect-src 'self' https://cdn.jsdelivr.net https://unpkg.com https://api.github.com https://github.com",
      "worker-src 'self' blob:",
      "frame-ancestors 'none'"
    ].join('; ');
    const commonHeaders = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    ];
    return [
      {
        source: '/:path*',
        headers: [...commonHeaders, { key: 'Content-Security-Policy', value: csp }]
      },
      {
        // Admin rule comes AFTER so it overrides /:path* for /admin path
        source: '/admin',
        headers: [...commonHeaders, { key: 'Content-Security-Policy', value: adminCsp }]
      },
    ];
  }
};

export default withNextIntl(withMDX(nextConfig));

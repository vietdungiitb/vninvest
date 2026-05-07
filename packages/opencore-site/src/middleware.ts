import { NextRequest, NextResponse } from 'next/server';
import { defaultLocale, isLocale } from './i18n/routing';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === '/') {
    const url = request.nextUrl.clone();
    url.pathname = `/${defaultLocale}`;
    return NextResponse.redirect(url);
  }

  const firstSegment = pathname.split('/')[1];
  if (!isLocale(firstSegment) && !pathname.startsWith('/api') && !pathname.startsWith('/admin') && !pathname.startsWith('/_next') && !pathname.includes('.')) {
    const url = request.nextUrl.clone();
    url.pathname = `/${defaultLocale}${pathname}`;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)']
};

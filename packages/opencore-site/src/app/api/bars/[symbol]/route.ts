import { NextRequest, NextResponse } from 'next/server';
import { allowRequest } from '@/lib/rateLimit';
import { buildChartFeed } from '@/lib/chartFeed';
import { isAllowedSymbol, normalizeTimeframe } from '@/lib/validation';

const RATE_LIMIT = 20;
const WINDOW_MS = 60_000;

function requestKey(request: NextRequest) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
}

export async function GET(request: NextRequest, context: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await context.params;
  const requestSymbol = symbol.toUpperCase();
  const timeframe = normalizeTimeframe(request.nextUrl.searchParams.get('tf'));
  const ipKey = requestKey(request);

  if (!isAllowedSymbol(requestSymbol)) {
    return NextResponse.json({ error: 'symbol not allowed' }, { status: 400 });
  }

  if (!allowRequest(`bars:${ipKey}`, RATE_LIMIT, WINDOW_MS)) {
    return NextResponse.json({ error: 'rate limit exceeded' }, { status: 429, headers: { 'Cache-Control': 'no-store' } });
  }

  const backendUrl = process.env.ABOUT_SITE_BACKEND_URL;
  if (backendUrl) {
    const params = new URLSearchParams({
      tf: timeframe,
      from: request.nextUrl.searchParams.get('from') ?? '',
      to: request.nextUrl.searchParams.get('to') ?? ''
    });

    try {
      const upstream = await fetch(`${backendUrl.replace(/\/$/, '')}/api/bars/${requestSymbol}/?${params.toString()}`, {
        headers: { accept: 'application/json' },
        cache: 'no-store'
      });

      if (upstream.ok) {
        const payload = await upstream.json();
        return NextResponse.json(payload, {
          headers: {
            'Cache-Control': 'public, max-age=300'
          }
        });
      }
    } catch {
      // Fallback to local sample feed below.
    }
  }

  const feed = buildChartFeed(requestSymbol, timeframe);
  return NextResponse.json(feed, {
    headers: {
      'Cache-Control': 'public, max-age=300'
    }
  });
}

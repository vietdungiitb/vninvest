import { NextRequest, NextResponse } from 'next/server';
import { allowRequest } from '@/lib/rateLimit';
import { buildChartFeed } from '@/lib/chartFeed';
import { isAllowedSymbol } from '@/lib/validation';

const RATE_LIMIT = 10;
const WINDOW_MS = 60_000;

function requestKey(request: NextRequest) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
}

export async function GET(request: NextRequest) {
  const symbol = (request.nextUrl.searchParams.get('symbol') ?? 'VNM').toUpperCase();
  const dataType = request.nextUrl.searchParams.get('data_type') ?? 'ohlcv';
  const period = request.nextUrl.searchParams.get('period') ?? '1M';
  const ipKey = requestKey(request);

  if (!isAllowedSymbol(symbol)) {
    return NextResponse.json({ error: 'symbol not allowed' }, { status: 400 });
  }

  if (!allowRequest(`vnbroker:${ipKey}`, RATE_LIMIT, WINDOW_MS)) {
    return NextResponse.json({ error: 'rate limit exceeded' }, { status: 429, headers: { 'Cache-Control': 'no-store' } });
  }

  const backendUrl = process.env.ABOUT_SITE_BACKEND_URL;
  if (backendUrl) {
    const params = new URLSearchParams({ symbol, data_type: dataType, period });
    try {
      const upstream = await fetch(`${backendUrl.replace(/\/$/, '')}/api/public/vnbroker-data/?${params.toString()}`, {
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

  const feed = buildChartFeed(symbol, '1d');
  return NextResponse.json(
    {
      symbol,
      data_type: dataType,
      period,
      source: 'about-site-local-fallback',
      generated_at: new Date().toISOString(),
      rows: feed.bars
    },
    {
      headers: {
        'Cache-Control': 'public, max-age=300'
      }
    }
  );
}

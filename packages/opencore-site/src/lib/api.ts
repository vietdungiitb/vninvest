import type { ChartFeed } from './chartFeed';

async function parseJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function fetchChartFeed(symbol: string, timeframe: string, from: Date, to: Date): Promise<ChartFeed> {
  const params = new URLSearchParams({
    tf: timeframe,
    from: from.toISOString(),
    to: to.toISOString()
  });

  const response = await fetch(`/api/bars/${symbol}?${params}`);
  return parseJsonResponse<ChartFeed>(response);
}

export async function fetchVnstockData(symbol: string, dataType = 'ohlcv', period = '1M') {
  const params = new URLSearchParams({ symbol, data_type: dataType, period });
  const response = await fetch(`/api/public/vnstock-data?${params}`);
  return parseJsonResponse<Record<string, unknown>>(response);
}

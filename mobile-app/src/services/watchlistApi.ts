import authClient from './http';
import type {
  TrackedSymbolItem,
  WatchlistGroup,
  WhaleAdvisoryItem,
  WhaleFeedAggregateResponse,
} from '../types/watchlist';

export async function getTrackedSymbols(): Promise<TrackedSymbolItem[]> {
  const response = await authClient.get<TrackedSymbolItem[]>('/stock-management/tracked-symbols/');
  return response.data;
}

export async function addTrackedSymbol(symbol: string): Promise<TrackedSymbolItem> {
  const response = await authClient.post<TrackedSymbolItem>('/stock-management/tracked-symbols/', {
    symbol: symbol.trim().toUpperCase(),
  });
  return response.data;
}

export async function deleteTrackedSymbol(id: number): Promise<void> {
  await authClient.delete(`/stock-management/tracked-symbols/${id}/`);
}

export async function getWatchlistGroups(): Promise<WatchlistGroup[]> {
  const response = await authClient.get<WatchlistGroup[]>('/portfolio/watchlist/groups/');
  return response.data;
}

export async function getAggregateWhaleFeed(params: {
  symbols?: string[];
  sort?: 'ts' | 'matched_value';
  limit?: number;
  cursor?: string;
} = {}): Promise<WhaleFeedAggregateResponse> {
  const search = new URLSearchParams();
  if (params.symbols && params.symbols.length > 0) {
    search.set('symbols', params.symbols.join(','));
  }
  if (params.sort) {
    search.set('sort', params.sort);
  }
  if (params.limit) {
    search.set('limit', String(params.limit));
  }
  if (params.cursor) {
    search.set('cursor', params.cursor);
  }

  const query = search.toString();
  const response = await authClient.get<WhaleFeedAggregateResponse>(
    `/realtime/whale-feed/aggregate/${query ? `?${query}` : ''}`
  );
  return response.data;
}

export async function getWhaleAdvisories(): Promise<WhaleAdvisoryItem[]> {
  const response = await authClient.get<WhaleAdvisoryItem[]>('/portfolio/whale-advisory/');
  return response.data;
}

export async function refreshWhaleAdvisory(symbol: string): Promise<{ queued: boolean; message: string }> {
  const response = await authClient.post<{ queued: boolean; message: string }>(
    `/portfolio/whale-advisory/${encodeURIComponent(symbol.trim().toUpperCase())}/refresh/`
  );
  return response.data;
}
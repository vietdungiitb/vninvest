import authClient from './http';
import { getUnifiedAlerts, getWhaleFeedAggregate } from './coreApiClient';
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
  // Use core /core/v1/unified-alert for aggregate feed (multi-symbol).
  // For single-symbol feed, use getWhaleFeedAggregate from coreApiClient.
  const coreResponse = await getUnifiedAlerts({
    alert_type: 'whale',
    cursor: params.cursor,
  });
  return {
    results: coreResponse.results.map((alert) => ({
      alert_id: alert.alert_id,
      symbol: alert.symbol,
      side: alert.direction === 'buy' ? 'buy' : 'sell',
      matched_value: 0,
      price: 0,
      is_dark_flow: alert.alert_type === 'dark_flow',
      triggered_at: alert.triggered_at,
    })),
    next: coreResponse.next,
    previous: coreResponse.previous,
  } as unknown as WhaleFeedAggregateResponse;
}

export async function getWhaleAdvisories(): Promise<WhaleAdvisoryItem[]> {
  // Remapped to core /core/v1/unified-alert?alert_type=whale
  const coreResponse = await getUnifiedAlerts({ alert_type: 'whale' });
  return coreResponse.results.map((alert) => ({
    alert_id: alert.alert_id,
    symbol: alert.symbol,
    direction: alert.direction,
    severity: alert.severity,
    message: alert.message,
    triggered_at: alert.triggered_at,
  })) as unknown as WhaleAdvisoryItem[];
}

export async function refreshWhaleAdvisory(_symbol: string): Promise<{ queued: boolean; message: string }> {
  // NOTE: Refresh trigger for whale advisory is a legacy operation.
  // In packages/core, materialization is handled by the Celery beat scheduler.
  // Return a no-op response until a dedicated refresh endpoint is added to core.
  return { queued: false, message: 'Materialization is handled by core beat scheduler.' };
}

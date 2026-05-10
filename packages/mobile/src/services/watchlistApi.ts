import authClient from './http';
import { getUnifiedAlerts, getWhaleFeedAggregate } from './coreApiClient';
import type {
  TrackedSymbolItem,
  WatchlistGroup,
  WhaleAdvisoryItem,
  WhaleFeedAggregateResponse,
} from '../types/watchlist';

type CoreWatchlist = {
  id: number;
  name: string;
  description?: string;
  is_default?: boolean;
  created_at?: string;
};

type CoreWatchlistItem = {
  id: number;
  symbol: string;
  added_at: string;
};

const trackedSymbolIndex = new Map<number, { watchlistId: number; symbol: string; addedAt: string }>();

async function ensureDefaultWatchlist(): Promise<CoreWatchlist> {
  const listResponse = await authClient.get<{ results?: CoreWatchlist[] }>('/core/v1/workspace/watchlists/');
  const watchlists = listResponse.data?.results ?? [];
  const preferred = watchlists.find((item) => item.is_default) || watchlists[0];
  if (preferred) {
    return preferred;
  }

  const createdResponse = await authClient.post<CoreWatchlist>('/core/v1/workspace/watchlists/', {
    name: 'Theo doi',
    description: 'Danh sach theo doi mac dinh',
    is_default: true,
  });
  return createdResponse.data;
}

async function loadTrackedFromWatchlist(): Promise<TrackedSymbolItem[]> {
  const watchlist = await ensureDefaultWatchlist();
  const response = await authClient.get<{ results?: CoreWatchlistItem[] }>(
    `/core/v1/workspace/watchlists/${watchlist.id}/items/`
  );
  const rows = response.data?.results ?? [];

  trackedSymbolIndex.clear();
  return rows.map((row) => {
    trackedSymbolIndex.set(row.id, {
      watchlistId: watchlist.id,
      symbol: row.symbol,
      addedAt: row.added_at,
    });
    return {
      id: row.id,
      symbol: row.symbol,
      source_group_id: watchlist.id,
      source_group_name: watchlist.name,
      current_price: null,
      prev_price: null,
      change_value: null,
      change_pct: null,
      last_date: null,
      added_at: row.added_at,
    };
  });
}

export async function getTrackedSymbols(): Promise<TrackedSymbolItem[]> {
  return loadTrackedFromWatchlist();
}

export async function addTrackedSymbol(symbol: string): Promise<TrackedSymbolItem> {
  const watchlist = await ensureDefaultWatchlist();
  const response = await authClient.post<CoreWatchlistItem>(
    `/core/v1/workspace/watchlists/${watchlist.id}/items/`,
    {
    symbol: symbol.trim().toUpperCase(),
    }
  );
  const row = response.data;
  trackedSymbolIndex.set(row.id, {
    watchlistId: watchlist.id,
    symbol: row.symbol,
    addedAt: row.added_at,
  });
  return {
    id: row.id,
    symbol: row.symbol,
    source_group_id: watchlist.id,
    source_group_name: watchlist.name,
    current_price: null,
    prev_price: null,
    change_value: null,
    change_pct: null,
    last_date: null,
    added_at: row.added_at,
  };
}

export async function deleteTrackedSymbol(id: number): Promise<void> {
  let tracked = trackedSymbolIndex.get(id);
  if (!tracked) {
    await loadTrackedFromWatchlist();
    tracked = trackedSymbolIndex.get(id);
  }
  if (!tracked) {
    return;
  }

  await authClient.delete(
    `/core/v1/workspace/watchlists/${tracked.watchlistId}/items/${encodeURIComponent(tracked.symbol)}/`
  );
  trackedSymbolIndex.delete(id);
}

export async function getWatchlistGroups(): Promise<WatchlistGroup[]> {
  const response = await authClient.get<{ results?: CoreWatchlist[] }>('/core/v1/workspace/watchlists/');
  const watchlists = response.data?.results ?? [];
  return watchlists.map((item) => ({
    id: item.id,
    name: item.name,
    description: item.description || '',
    created_at: item.created_at || '',
  }));
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

/**
 * coreApiClient.ts
 *
 * Typed client for packages/core /core/v1/* data-plane endpoints.
 * Replaces direct legacy path calls for whale/signal intelligence data.
 *
 * Portfolio management data (holdings, portfolios, transactions, watchlist groups)
 * remains on legacy backend until core portfolio management is implemented (post-SAAS-15).
 */
import axios from 'axios';
import { API_BASE_URL } from '../runtimeConfig.js';
import { getAccessToken } from './tokenStorage';

const CORE_API_PREFIX = `${API_BASE_URL}/core/v1`;

function generateRequestId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const coreClient = axios.create({
  baseURL: CORE_API_PREFIX,
  headers: { 'Content-Type': 'application/json' },
});

coreClient.interceptors.request.use(async (config) => {
  const token = await getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  config.headers['X-Request-ID'] = generateRequestId();
  return config;
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UnifiedAlertItem {
  alert_id: string;
  symbol: string;
  alert_type: 'whale' | 'dark_flow' | 'signal' | 'system';
  severity: 'critical' | 'high' | 'medium' | 'low';
  direction: 'buy' | 'sell' | 'neutral';
  triggered_at: string;
  message: string;
  extra_data?: Record<string, unknown>;
}

export interface WhaleFeedItem {
  alert: UnifiedAlertItem;
  side: 'buy' | 'sell';
  matched_value: number;
  price: number;
  is_dark_flow: boolean;
}

export interface PaginatedResponse<T> {
  results: T[];
  next: string | null;
  previous: string | null;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

/**
 * Fetch unified alerts (whale / dark-flow / signal).
 * Core unified alerts endpoint.
 */
export async function getUnifiedAlerts(params: {
  symbol?: string;
  alert_family?: string;
  alert_type?: string;
  severity?: string;
  session_date?: string;
  cursor?: string;
} = {}): Promise<PaginatedResponse<UnifiedAlertItem>> {
  const search = new URLSearchParams(
    Object.fromEntries(
      Object.entries(params).filter(([, v]) => v != null && v !== '') as [string, string][]
    )
  );
  const query = search.toString();
  const response = await coreClient.get<PaginatedResponse<UnifiedAlertItem>>(
    `/signals/alert-center/feed${query ? `?${query}` : ''}`
  );
  return response.data;
}

/**
 * Fetch whale feed aggregate for a symbol.
 * Core whale feed endpoint.
 */
export async function getWhaleFeedAggregate(
  symbol: string,
  params: { session_date?: string; cursor?: string } = {}
): Promise<PaginatedResponse<WhaleFeedItem>> {
  const search = new URLSearchParams(
    Object.fromEntries(
      Object.entries(params).filter(([, v]) => v != null && v !== '') as [string, string][]
    )
  );
  const query = search.toString();
  const response = await coreClient.get<PaginatedResponse<WhaleFeedItem>>(
    `/whale-feed-aggregate/${encodeURIComponent(symbol.toUpperCase())}/${
      query ? `?${query}` : ''
    }`
  );
  return response.data;
}

/**
 * Get latest SymbolSnapshot for a symbol.
 */
export async function getSymbolSnapshot(symbol: string): Promise<Record<string, unknown>> {
  const response = await coreClient.get(
    `/symbol-snapshot/${encodeURIComponent(symbol.toUpperCase())}/`
  );
  return response.data as Record<string, unknown>;
}

/**
 * Get SessionFacts (CVD, buy/institutional strength) for a symbol + date.
 */
export async function getSessionFacts(
  symbol: string,
  date?: string
): Promise<Record<string, unknown>> {
  const query = date ? `?date=${encodeURIComponent(date)}` : '';
  const response = await coreClient.get(
    `/session-facts/${encodeURIComponent(symbol.toUpperCase())}/${query}`
  );
  return response.data as Record<string, unknown>;
}

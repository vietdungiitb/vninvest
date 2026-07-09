export interface WatchlistItem {
  id?: string | number;
  symbol: string;
  note?: string;
  whale_alert_threshold_million?: number;
  industry?: string;
  company_name?: string;
  quantity?: number;
  avg_cost?: number;
  market_value?: number;
  unrealized_pnl?: number;
  unrealized_pnl_pct?: number;
}

export interface Watchlist {
  id: string | number;
  name: string;
  description?: string;
  items?: WatchlistItem[];
}

export interface LegacyGroup {
  id: string | number;
  name: string;
  description?: string;
  items?: WatchlistItem[];
}

export interface Holding {
  symbol: string;
  quantity?: number;
  avg_cost?: number;
  market_value?: number;
  unrealized_pnl?: number;
  unrealized_pnl_pct?: number;
}

export interface TrackedSymbol {
  id?: string | number;
  symbol: string;
  whale_alert_threshold_million?: number;
  industry?: string;
  company_name?: string;
}

export interface PriceAlert {
  id: string | number;
  symbol: string;
  condition: "ABOVE" | "BELOW" | "EQUAL";
  target_price: number;
  current_price?: number;
  is_active: boolean;
  cooldown_seconds?: number;
  alert_type?: string;
  price_threshold?: number;
}

export interface TechnicalData {
  symbol: string;
  rsi_14?: number;
  sma20?: number;
  sma50?: number;
  momentum_20d_pct?: number;
  rvol?: number;
  ma20_distance_pct?: number;
  bias_label?: string;
  industry?: string;
  company_name?: string;
  price?: number;
  price_change?: number;
  price_change_pct?: number;
  volume?: number;
}

export interface QuoteData {
  current_price?: number;
  change_pct?: number;
  change_value?: number;
  price?: number;
  change?: number;
  price_change?: number;
  price_change_pct?: number;
  volume?: number;
}

export interface MergedData extends TechnicalData {
  price?: number;
  price_change?: number;
  price_change_pct?: number;
  volume?: number;
}

export interface Identity {
  is_staff?: boolean;
  is_superuser?: boolean;
  username?: string;
  email?: string;
}

export interface Session {
  is_staff?: boolean;
  is_superuser?: boolean;
  session_id?: string;
  principal?: {
    username?: string;
    identity?: Identity;
  };
}

export interface RealtimeFeedData {
  quotesBySymbol?: Record<string, QuoteData>;
  realtimeStatus?: string;
  lastEventAt?: string | null;
  alerts?: unknown[];
  darkFlowAlerts?: unknown[];
  marketDiscoveryEvents?: unknown[];
  latestWhaleAlert?: unknown | null;
  latestDarkFlowAlert?: unknown | null;
  latestMarketDiscoveryEvent?: unknown | null;
  metrics?: {
    eventCounts?: Record<string, number>;
    lastLatencyMs?: number | null;
    connectionState?: { transport?: string };
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

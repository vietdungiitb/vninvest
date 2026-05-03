export type TrackedSymbolItem = {
  id: number;
  symbol: string;
  source_group_id: number | null;
  source_group_name: string | null;
  current_price: number | null;
  prev_price: number | null;
  change_value: number | null;
  change_pct: number | null;
  last_date: string | null;
  added_at: string;
};

export type WatchlistGroup = {
  id: number;
  name: string;
  description: string;
  created_at: string;
};

export type WhaleAlertItem = {
  id: number;
  symbol: string;
  ts: string;
  time?: string;
  side?: string;
  price?: number;
  volume?: number;
  matched_value: number;
  display_score?: number;
  severity?: string;
  event_type?: string;
};

export type WhaleFeedAggregateResponse = {
  results: WhaleAlertItem[];
  next_cursor: string | null;
  has_more: boolean;
  source?: string;
};

export type WhaleAdvisoryItem = {
  id: number;
  symbol: string;
  matched_value: number;
  side: string;
  threshold: number;
  ai_summary: string;
  ai_detail: string;
  ai_provider: string;
  created_at: string;
};

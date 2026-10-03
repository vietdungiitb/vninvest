export interface ScreenerCondition {
  field: string;
  op: 'lt' | 'lte' | 'gt' | 'gte' | 'eq';
  // P0.3: "" = user cleared the input (kept until save so valueRequired fires)
  value: number | '';
  logic?: 'AND' | 'OR' | 'NOT';  // Logic to combine with next condition
}

export interface ScreenerRule {
  id?: number;
  name: string;
  rules_json: ScreenerCondition[];
  is_active?: boolean;
  // W8 P3 preset cộng đồng: shared catalog flag + owner display name.
  is_public?: boolean;
  owner_username?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type ScreenerTemplateCategory = 'technical' | 'whale' | 'dark' | 'fundamental';

export interface ScreenerTemplate {
  id: string;
  name_key: string;
  desc_key: string;
  category: ScreenerTemplateCategory;
  rules_json: ScreenerCondition[];
}

export interface ScreenerRow {
  symbol: string;
  close: number | null;
  rsi_14: number | null;
  sma20: number | null;
  sma50: number | null;
  price_vs_sma20_pct: number | null;
  price_vs_sma50_pct: number | null;
  sma20_vs_sma50_pct: number | null;
  macd_hist: number | null;
  volume_rvol: number | null;
  momentum_20d_pct: number | null;
  range_position_pct: number | null;
  avg_volume_20: number | null;
  // Advanced technical (NEW)
  stochastic_k: number | null;
  stochastic_d: number | null;
  atr_14: number | null;
  adx_14: number | null;
  bollinger_width: number | null;
  vwap: number | null;
  mfi_14: number | null;
  // Fundamental (NEW)
  pe_ratio: number | null;
  market_cap: number | null;
  dividend_yield: number | null;
  eps_growth_yoy: number | null;
  revenue_growth_yoy: number | null;
  debt_to_equity: number | null;
  ai_advisory: {
    ai_score_0_100: number;
    strategy_action: "BUY" | "SELL" | "HOLD" | "STAND_ASIDE";
    risk_level: "low" | "medium" | "high";
    synthesis_text: string;
  } | null;
  date: string;
}

export interface ScreenerResult {
  matched: ScreenerRow[];
  matched_count: number;
  total_scanned: number;
  rule_name: string;
  rule_id: number;
  // P0.1 additions (optional — older cached responses lack them)
  session_date?: string;
  is_stale?: boolean;
  days_old?: number;
  missing_fields?: string[];
  missing_counts?: Record<string, number>;
  // P1.1 server paging meta (present only when scan params were sent)
  page?: number;
  limit?: number;
  pages?: number;
  sort?: string;
  order?: "asc" | "desc";
  // P1.3: calendar-day price window actually used (Entry 75, tested via window_days 35/88)
  window_days?: number;
}

// NOTE (P0.6): runtime registries live ONLY in ./screener.ts (single source).
// This declaration file keeps types/interfaces — do not add runtime consts here.
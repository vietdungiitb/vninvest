export interface ScreenerCondition {
  field: string;
  op: 'lt' | 'lte' | 'gt' | 'gte' | 'eq';
  value: number;
  logic?: 'AND' | 'OR' | 'NOT';  // Logic to combine with next condition
}

export interface ScreenerRule {
  id?: number;
  name: string;
  rules_json: ScreenerCondition[];
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
}

// Screener field definitions with grouping
export const SCREENER_FIELD_GROUPS = {
  price: {
    label: 'Giá & Khối lượng',
    fields: {
      close: { key: 'close', label: 'Giá đóng cửa', format: 'number' },
      volume: { key: 'volume', label: 'Khối lượng', format: 'number' },
    }
  },
  technical_momentum: {
    label: 'Động lượng & Xu hướng',
    fields: {
      rsi_14: { key: 'rsi_14', label: 'RSI(14)', format: 'number' },
      momentum_20d_pct: { key: 'momentum_20d_pct', label: 'Momentum 20D (%)', format: 'pct' },
      macd_hist: { key: 'macd_hist', label: 'MACD Histogram', format: 'number' },
      adx_14: { key: 'adx_14', label: 'ADX(14)', format: 'number' },
    }
  },
  technical_ma: {
    label: 'Đường trung bình động',
    fields: {
      sma20: { key: 'sma20', label: 'SMA20', format: 'number' },
      sma50: { key: 'sma50', label: 'SMA50', format: 'number' },
      price_vs_sma20_pct: { key: 'price_vs_sma20_pct', label: 'Giá vs SMA20 (%)', format: 'pct' },
      price_vs_sma50_pct: { key: 'price_vs_sma50_pct', label: 'Giá vs SMA50 (%)', format: 'pct' },
      sma20_vs_sma50_pct: { key: 'sma20_vs_sma50_pct', label: 'SMA20 vs SMA50 (%)', format: 'pct' },
    }
  },
  technical_advanced: {
    label: 'Chỉ báo nâng cao',
    fields: {
      stochastic_k: { key: 'stochastic_k', label: 'Stochastic %K', format: 'number' },
      stochastic_d: { key: 'stochastic_d', label: 'Stochastic %D', format: 'number' },
      atr_14: { key: 'atr_14', label: 'ATR(14)', format: 'number' },
      bollinger_width: { key: 'bollinger_width', label: 'Bollinger Width (%)', format: 'pct' },
      vwap: { key: 'vwap', label: 'VWAP', format: 'number' },
      mfi_14: { key: 'mfi_14', label: 'MFI(14)', format: 'number' },
    }
  },
  volume: {
    label: 'Khối lượng',
    fields: {
      volume_rvol: { key: 'volume_rvol', label: 'RVOL', format: 'ratio' },
      avg_volume_20: { key: 'avg_volume_20', label: 'Avg Volume 20D', format: 'number' },
    }
  },
  price_position: {
    label: 'Vị trí giá',
    fields: {
      range_position_pct: { key: 'range_position_pct', label: 'Vị trí 52 tuần (%)', format: 'pct' },
    }
  },
  whale: {
    label: 'Cá voi & Dark Pool',
    fields: {
      whale_intensity: { key: 'whale_intensity', label: 'Whale Intensity', format: 'number' },
      whale_net_value: { key: 'whale_net_value', label: 'Whale Net Value', format: 'number' },
      whale_buy_pct: { key: 'whale_buy_pct', label: 'Whale Buy %', format: 'pct' },
      whale_sell_pct: { key: 'whale_sell_pct', label: 'Whale Sell %', format: 'pct' },
      dark_flow_strength: { key: 'dark_flow_strength', label: 'Dark Flow Strength', format: 'number' },
      dark_flow_cvd: { key: 'dark_flow_cvd', label: 'Dark Flow CVD', format: 'number' },
    }
  },
  fundamental: {
    label: 'Cơ bản',
    fields: {
      pe_ratio: { key: 'pe_ratio', label: 'P/E Ratio', format: 'number' },
      market_cap: { key: 'market_cap', label: 'Market Cap (B VND)', format: 'number' },
      dividend_yield: { key: 'dividend_yield', label: 'Dividend Yield (%)', format: 'pct' },
      eps_growth_yoy: { key: 'eps_growth_yoy', label: 'EPS Growth YoY (%)', format: 'pct' },
      revenue_growth_yoy: { key: 'revenue_growth_yoy', label: 'Revenue Growth YoY (%)', format: 'pct' },
      debt_to_equity: { key: 'debt_to_equity', label: 'Debt/Equity', format: 'number' },
    }
  },
} as const;

export const OP_OPTIONS = [
  { value: 'lt', label: '<' },
  { value: 'lte', label: '<=' },
  { value: 'gt', label: '>' },
  { value: 'gte', label: '>=' },
  { value: 'eq', label: '=' },
] as const;

export const LOGIC_OPTIONS = [
  { value: 'AND', label: 'AND' },
  { value: 'OR', label: 'OR' },
  { value: 'NOT', label: 'NOT' },
] as const;

export type ScreenerFieldKey = keyof typeof SCREENER_FIELD_GROUPS[keyof typeof SCREENER_FIELD_GROUPS]['fields'];
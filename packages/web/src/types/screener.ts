export type ScreenerOp = "lt" | "lte" | "gt" | "gte" | "eq";
export type ScreenerLogic = "AND" | "OR" | "NOT";

export interface ScreenerFieldSpec {
  key: string;
  label: string;
  format: "number" | "pct" | "ratio";
  /** Default operator/value when a condition is added from the picker (P0.3). */
  defaultOp: ScreenerOp;
  defaultValue: number;
  /** Value domain for validation (P0.3 R3.2); absent = any finite number. */
  min?: number;
  max?: number;
}

export interface ScreenerFieldGroup {
  label: string;
  fields: Record<string, ScreenerFieldSpec>;
}

// P0.3/P0.6: single runtime source for fields (types only in screener.d.ts).
export const SCREENER_FIELD_GROUPS: Record<string, ScreenerFieldGroup> = {
  price: {
    label: "price",
    fields: {
      close: { key: "close", label: "close", format: "number", defaultOp: "gt", defaultValue: 0, min: 0 },
      volume: { key: "volume", label: "volume", format: "number", defaultOp: "gt", defaultValue: 0, min: 0 },
    }
  },
  technical_momentum: {
    label: "technical_momentum",
    fields: {
      rsi_14: { key: "rsi_14", label: "rsi14", format: "number", defaultOp: "lt", defaultValue: 30, min: 0, max: 100 },
      momentum_20d_pct: { key: "momentum_20d_pct", label: "momentum20dPct", format: "pct", defaultOp: "gt", defaultValue: 20 },
      macd_hist: { key: "macd_hist", label: "macdHist", format: "number", defaultOp: "gt", defaultValue: 0 },
      adx_14: { key: "adx_14", label: "adx14", format: "number", defaultOp: "gt", defaultValue: 20, min: 0, max: 100 },
    }
  },
  technical_ma: {
    label: "technical_ma",
    fields: {
      sma20: { key: "sma20", label: "sma20", format: "number", defaultOp: "gt", defaultValue: 0, min: 0 },
      sma50: { key: "sma50", label: "sma50", format: "number", defaultOp: "gt", defaultValue: 0, min: 0 },
      price_vs_sma20_pct: { key: "price_vs_sma20_pct", label: "priceVsSma20Pct", format: "pct", defaultOp: "lt", defaultValue: 0 },
      price_vs_sma50_pct: { key: "price_vs_sma50_pct", label: "priceVsSma50Pct", format: "pct", defaultOp: "gt", defaultValue: 0 },
      sma20_vs_sma50_pct: { key: "sma20_vs_sma50_pct", label: "sma20VsSma50Pct", format: "pct", defaultOp: "gt", defaultValue: 0 },
    }
  },
  technical_advanced: {
    label: "technical_advanced",
    fields: {
      stochastic_k: { key: "stochastic_k", label: "stochasticK", format: "number", defaultOp: "lt", defaultValue: 20, min: 0, max: 100 },
      stochastic_d: { key: "stochastic_d", label: "stochasticD", format: "number", defaultOp: "lt", defaultValue: 20, min: 0, max: 100 },
      atr_14: { key: "atr_14", label: "atr14", format: "number", defaultOp: "gt", defaultValue: 0, min: 0 },
      bollinger_width: { key: "bollinger_width", label: "bollingerWidth", format: "pct", defaultOp: "lt", defaultValue: 3, min: 0 },
      vwap: { key: "vwap", label: "vwap", format: "number", defaultOp: "gt", defaultValue: 0, min: 0 },
      mfi_14: { key: "mfi_14", label: "mfi14", format: "number", defaultOp: "lt", defaultValue: 20, min: 0, max: 100 },
    }
  },
  volume: {
    label: "volume",
    fields: {
      volume_rvol: { key: "volume_rvol", label: "volumeRvol", format: "ratio", defaultOp: "gt", defaultValue: 1, min: 0 },
      avg_volume_20: { key: "avg_volume_20", label: "avgVolume20", format: "number", defaultOp: "gt", defaultValue: 0, min: 0 },
    }
  },
  price_position: {
    label: "price_position",
    fields: {
      range_position_pct: { key: "range_position_pct", label: "rangePositionPct", format: "pct", defaultOp: "gt", defaultValue: 80, min: 0, max: 100 },
    }
  },
  whale: {
    label: "whale",
    fields: {
      whale_intensity: { key: "whale_intensity", label: "whaleIntensity", format: "number", defaultOp: "gt", defaultValue: 0, min: 0 },
      whale_net_value: { key: "whale_net_value", label: "whaleNetValue", format: "number", defaultOp: "gt", defaultValue: 0 },
      whale_buy_pct: { key: "whale_buy_pct", label: "whaleBuyPct", format: "pct", defaultOp: "gt", defaultValue: 60, min: 0, max: 100 },
      whale_sell_pct: { key: "whale_sell_pct", label: "whaleSellPct", format: "pct", defaultOp: "lt", defaultValue: 40, min: 0, max: 100 },
      dark_flow_strength: { key: "dark_flow_strength", label: "darkFlowStrength", format: "number", defaultOp: "gt", defaultValue: 0.5, min: 0 },
      dark_flow_cvd: { key: "dark_flow_cvd", label: "darkFlowCvd", format: "number", defaultOp: "gt", defaultValue: 0, min: -1, max: 1 },
    }
  },
  fundamental: {
    label: "fundamental",
    fields: {
      pe_ratio: { key: "pe_ratio", label: "peRatio", format: "number", defaultOp: "lt", defaultValue: 15, min: 0 },
      market_cap: { key: "market_cap", label: "marketCap", format: "number", defaultOp: "lt", defaultValue: 10000, min: 0 },
      dividend_yield: { key: "dividend_yield", label: "dividendYield", format: "pct", defaultOp: "gt", defaultValue: 5, min: 0 },
      eps_growth_yoy: { key: "eps_growth_yoy", label: "epsGrowthYoy", format: "pct", defaultOp: "gt", defaultValue: 10 },
      revenue_growth_yoy: { key: "revenue_growth_yoy", label: "revenueGrowthYoy", format: "pct", defaultOp: "gt", defaultValue: 15 },
      debt_to_equity: { key: "debt_to_equity", label: "debtToEquity", format: "number", defaultOp: "lt", defaultValue: 1, min: 0 },
    }
  },
};

export const OP_OPTIONS = [
  { value: "lt", label: "<" },
  { value: "lte", label: "<=" },
  { value: "gt", label: ">" },
  { value: "gte", label: ">=" },
  { value: "eq", label: "=" },
] as const;

export const LOGIC_OPTIONS = [
  { value: "AND", label: "AND" },
  { value: "OR", label: "OR" },
  { value: "NOT", label: "NOT" },
] as const;

export type ScreenerCondition = {
  field: string;
  op: ScreenerOp;
  // P0.3: "" = user cleared the input (kept until save so valueRequired fires — R3.1)
  value: number | "";
  logic?: ScreenerLogic;
};

export type ScreenerRule = {
  id?: number;
  name: string;
  rules_json: ScreenerCondition[];
  created_at?: string;
  updated_at?: string;
};

export type ScreenerRow = {
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
  stochastic_k: number | null;
  stochastic_d: number | null;
  atr_14: number | null;
  adx_14: number | null;
  bollinger_width: number | null;
  vwap: number | null;
  mfi_14: number | null;
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
};

export type ScreenerResult = {
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
};

export type ScreenerFieldKey = string;

export type ScreenerTemplateCategory = 'technical' | 'whale' | 'dark' | 'fundamental';

export type ScreenerTemplate = {
  id: string;
  name_key: string;
  desc_key: string;
  category: ScreenerTemplateCategory;
  rules_json: ScreenerCondition[];
};

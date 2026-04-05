export type PortfolioItem = {
  id: number;
  name: string;
};

export type PortfolioSummary = {
  portfolio_name?: string;
  total_market_value?: number | string;
  total_unrealized_pl?: number | string;
  total_unrealized_pl_pct?: number | string;
  total_realized_pl?: number | string;
  total_dividends?: number | string;
  last_updated?: string;
};

export type HoldingItem = {
  symbol: string;
  quantity?: number | string;
  avg_cost?: number | string;
  current_price?: number | string;
  market_value?: number | string;
  unrealized_pl?: number | string;
  unrealized_pl_pct?: number | string;
};

export type AllocationItem = {
  symbol: string;
  value: number;
  percentage: number;
};
